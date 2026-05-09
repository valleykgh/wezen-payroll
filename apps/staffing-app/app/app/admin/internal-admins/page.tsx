'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { apiFetch } from '@/lib/api-client';
import { meRequest } from '@/lib/auth-client';

type AdminUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isSystemUser?: boolean;
};

export default function InternalAdminsPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState('Loading...');
  const [isDefaultAdmin, setIsDefaultAdmin] = useState(false);

  async function load() {
    const me = await meRequest();
    setIsDefaultAdmin(
      String(me.data.email || '').toLowerCase() === 'admin@wezenstaffing.com'
    );

    const res = await apiFetch<{ data: AdminUser[] }>('/api/admin/internal-admins');
    setItems(res.data || []);
    setMessage('');
  }

  async function setActive(userId: string, active: boolean) {
    await apiFetch(`/api/admin/internal-admins/${userId}/active`, {
      method: 'PUT',
      body: JSON.stringify({ active }),
    });
    await load();
  }

  async function deleteAdmin(userId: string) {
    await apiFetch(`/api/admin/internal-admins/${userId}`, {
      method: 'DELETE',
    });
    await load();
  }

  useEffect(() => {
    load().catch((e) =>
      setMessage(e instanceof Error ? e.message : 'Failed to load')
    );
  }, []);

  return (
    <AppShell
      role="admin"
      title="Internal Admins"
      subtitle="Manage internal admin accounts."
    >
      <div className="grid gap-3">
        {message ? (
          <div className="rounded-2xl bg-white p-4 text-sm text-slate-600 shadow-sm">
            {message}
          </div>
        ) : null}

        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
          >
            <div className="font-bold text-slate-950">
              {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}
            </div>

            <div className="mt-1 text-sm text-slate-600">{item.email}</div>

            <div className="mt-1 text-xs text-slate-500">
              {item.isActive ? 'Active' : 'Disabled'}
            </div>

            {isDefaultAdmin && !item.isSystemUser ? (
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => setActive(item.id, !item.isActive)}
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white"
                >
                  {item.isActive ? 'Disable' : 'Activate'}
                </button>

                <button
                  onClick={() => deleteAdmin(item.id)}
                  className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
