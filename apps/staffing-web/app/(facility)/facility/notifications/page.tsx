'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Notification = {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default function FacilityNotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [message, setMessage] = useState('Loading alerts...');
  const [busy, setBusy] = useState('');

  async function load() {
    try {
      const res = await apiFetch<{ data: Notification[] }>('/api/facility/notifications');
      setItems(res.data || []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load alerts');
    }
  }

  async function markAllRead() {
    setBusy('all');
    try {
      await apiFetch('/api/facility/notifications/mark-all-read', { method: 'POST' });
      setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
      window.dispatchEvent(new Event('wezen-notifications-changed'));
    } finally {
      setBusy('');
    }
  }

  async function markRead(id: string) {
    setBusy(id);
    try {
      await apiFetch(`/api/facility/notifications/${id}/read`, { method: 'POST' });
      setItems((prev) => prev.map((item) => item.id === id ? { ...item, isRead: true } : item));
      window.dispatchEvent(new Event('wezen-notifications-changed'));
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unread = items.filter((item) => !item.isRead).length;

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border-2 border-rose-200 bg-rose-50 p-6">
        <div className="text-sm font-bold uppercase tracking-[0.2em] text-rose-700">Facility Alerts</div>
        <h1 className="mt-2 text-3xl font-extrabold text-rose-950">{unread} unread alert{unread === 1 ? '' : 's'}</h1>
        <button onClick={markAllRead} disabled={busy === 'all' || unread === 0} className="mt-4 rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          Mark All Read
        </button>
      </div>

      {message ? <div className="rounded-2xl bg-white p-5 text-slate-600 shadow-sm">{message}</div> : null}

      {items.map((item) => (
        <div key={item.id} className={item.isRead ? 'rounded-[1.5rem] border border-slate-200 bg-white p-5' : 'rounded-[1.5rem] border-2 border-rose-300 bg-rose-50 p-5'}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{item.message}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            {!item.isRead ? <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">NEW</span> : null}
          </div>
          {!item.isRead ? (
            <button onClick={() => markRead(item.id)} disabled={busy === item.id} className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              Mark Read
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
