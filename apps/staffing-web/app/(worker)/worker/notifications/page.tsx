'use client';

import { useEffect, useState } from 'react';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function WorkerNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState('Loading notifications...');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiFetch<{ data: Notification[] }>(
      '/api/worker/notifications'
    );
    setItems(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load notifications');
      }
    }

    init();
  }, []);

  async function markRead(id: string) {
    try {
      setBusy(true);

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to mark notification as read'));
      }

      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update notification');
    } finally {
      setBusy(false);
    }
  }

  async function markAllRead() {
    try {
      setBusy(true);

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/notifications/mark-all-read`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to mark all notifications as read'));
      }

      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update notifications');
    } finally {
      setBusy(false);
    }
  }

  const unreadCount = items.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Notifications
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              Stay updated on requests and compliance
            </h1>
            <p className="mt-2 max-w-3xl text-slate-600">
              View approvals, rejections, DNR blocks, and document updates in one place.
            </p>
          </div>

          <button
            onClick={markAllRead}
            disabled={busy || unreadCount === 0}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Mark All Read
          </button>
        </div>
      </div>

      {message && items.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{items.length}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Unread
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{unreadCount}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Read
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {items.filter((item) => item.isRead).length}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 && !message ? (
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
            No notifications yet.
          </div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className={
              item.isRead
                ? 'rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm'
                : 'rounded-[1.75rem] border border-cyan-200 bg-cyan-50 p-6 shadow-sm'
            }
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="text-lg font-bold tracking-tight text-slate-950">
                  {item.title}
                </div>
                <div className="mt-2 text-sm text-slate-700">{item.message}</div>
                <div className="mt-3 text-xs text-slate-500">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>

              {!item.isRead ? (
                <button
                  onClick={() => markRead(item.id)}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-60"
                >
                  Mark Read
                </button>
              ) : (
                <div className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-500 border border-slate-200">
                  Read
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
