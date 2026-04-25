'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type WorkerNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  data: WorkerNotification[];
};

export function WorkerNotificationsClient() {
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadNotifications() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<NotificationsResponse>('/api/worker/notifications');
      setNotifications(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/worker/notifications/${id}/read`, {
        method: 'POST',
      });

      setNotifications((items) =>
        items.map((item) => (item.id === id ? { ...item, isRead: true } : item))
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to mark notification read');
    }
  }

  async function markAllRead() {
    try {
      await apiFetch('/api/worker/notifications/mark-all-read', {
        method: 'POST',
      });

      setNotifications((items) => items.map((item) => ({ ...item, isRead: true })));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to mark all read');
    }
  }

  useEffect(() => {
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Unread</p>
            <h2 className="text-3xl font-bold text-slate-950">{unreadCount}</h2>
          </div>

          <button
            type="button"
            onClick={markAllRead}
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
          >
            Mark all read
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading notifications...
        </div>
      ) : null}

      {!loading && notifications.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No notifications yet.
        </div>
      ) : null}

      {notifications.map((item) => (
        <div
          key={item.id}
          className={
            item.isRead
              ? 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200'
              : 'rounded-3xl bg-cyan-50 p-5 shadow-sm ring-2 ring-cyan-200'
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                {item.type}
              </p>
              <h3 className="mt-2 text-lg font-bold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
              <p className="mt-3 text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleString()}
              </p>
            </div>

            {!item.isRead ? (
              <button
                type="button"
                onClick={() => markRead(item.id)}
                className="shrink-0 rounded-full bg-white px-3 py-2 text-xs font-bold text-cyan-700 ring-1 ring-cyan-200"
              >
                Read
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
