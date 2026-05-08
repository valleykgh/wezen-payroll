'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

function getNotificationLink(message: string) {
  const applicantsMatch = message.match(/Link:\s*\/facility\/applicants\?shiftId=([^\s]+)/);
  if (applicantsMatch?.[1]) {
    return `/app/facility/shift-detail/index.html?shiftId=${applicantsMatch[1]}`;
  }

  const shiftMatch = message.match(/Link:\s*\/facility\/shifts\/([^\s]+)/);
  if (shiftMatch?.[1]) {
    return `/app/facility/shift-detail/index.html?shiftId=${shiftMatch[1]}`;
  }

  return '';
}

function getNotificationActionLabel(title: string) {
  const lower = title.toLowerCase();

  if (lower.includes('accepted')) return 'Review Applicant';
  if (lower.includes('declined')) return 'View Declined Worker';

  return 'Open Related Item';
}

function cleanNotificationMessage(message: string) {
  return message.replace(/\n?Link:\s*\/[^\s]+/g, '').trim();
}

type ReviewItem = {
  id: string;
  type: string;
  label: string;
  status: string;
  route: string;
  createdAt: string;
  workerName: string;
  workerEmail: string;
  workerRole: string;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
  };
};

type Notification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export function FacilityNotificationsClient() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const res = await apiFetch<{ data: Notification[] }>('/api/facility/notifications');
      setItems(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load alerts');
    }
  }

  async function markRead(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/facility/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, isRead: true } : item));
      window.dispatchEvent(new CustomEvent('wezen-notifications-changed', { detail: { unreadCount: 0 } }));
    } finally {
      setBusy('');
    }
  }

  async function markAllRead() {
    setBusy('all');
    try {
      await apiFetch('/api/facility/notifications/mark-all-read', { method: 'POST' });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new CustomEvent('wezen-notifications-changed', { detail: { unreadCount: 0 } }));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl border-2 border-rose-200 bg-rose-50 p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-rose-700">
          Facility Alert Center
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-rose-950">
          {unreadCount} urgent unread alert{unreadCount === 1 ? '' : 's'}
        </h2>
        <button
          type="button"
          onClick={markAllRead}
          disabled={busy === 'all' || unreadCount === 0}
          className="mt-4 w-full rounded-2xl bg-rose-600 px-5 py-4 text-base font-extrabold text-white disabled:opacity-60"
        >
          Mark All Read
        </button>
      </div>

      {message ? (
        <div className="rounded-3xl bg-red-600 p-5 text-center text-lg font-extrabold text-white">
          {message}
        </div>
      ) : null}
      {items.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
          No facility alerts yet.
        </div>
      ) : null}

      {items.map((item) => (
        <div
          key={item.id}
          className={
            item.isRead
              ? 'rounded-3xl bg-white p-5 ring-1 ring-slate-200'
              : 'rounded-3xl border-2 border-rose-300 bg-rose-50 p-5'
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold text-slate-700">{cleanNotificationMessage(item.message)}</p>
              {getNotificationLink(item.message) ? (
                <a
                  href={getNotificationLink(item.message)}
                  className="mt-3 block w-full rounded-2xl bg-cyan-700 px-4 py-3 text-center text-sm font-bold text-white"
                >
                  {getNotificationActionLabel(item.title)}
                </a>
              ) : null}
              <p className="mt-3 text-xs font-bold text-slate-500">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>
            {!item.isRead ? (
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-extrabold text-white">
                NEW
              </span>
            ) : null}
          </div>

          {!item.isRead ? (
            <button
              type="button"
              onClick={() => markRead(item.id)}
              disabled={busy === item.id}
              className="mt-4 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              Mark Read
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
