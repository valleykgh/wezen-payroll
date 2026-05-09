'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type InternalAdmin = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isSystemUser?: boolean;
  notificationEmail?: string | null;
  appNotificationsEnabled?: boolean;
  createdAt?: string;
};

export default function InternalAdminsPage() {
  const [items, setItems] = useState<InternalAdmin[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

  async function loadAdmins() {
    try {
      const res = await apiFetch<{ data: InternalAdmin[] }>('/api/admin/internal-admins');
      setItems(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load internal admins');
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  async function createAdmin() {
    try {
      setBusy(true);
      setMessage('');

      await apiFetch('/api/admin/internal-admins', {
        method: 'POST',
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          password,
          notificationEmail: notificationEmail || undefined,
        }),
      });

      setEmail('');
      setNotificationEmail('');
      setFirstName('');
      setLastName('');
      setPassword('');
      setMessage('Internal admin created successfully.');
      await loadAdmins();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create internal admin');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(userId: string, active: boolean) {
    try {
      setBusy(true);
      setMessage('');

      await apiFetch(`/api/admin/internal-admins/${userId}/active`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });

      setMessage(active ? 'Internal admin activated.' : 'Internal admin disabled.');
      await loadAdmins();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update internal admin');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAdmin(userId: string, email: string) {
    if (!window.confirm(`Delete internal admin ${email}? This cannot be undone.`)) return;

    try {
      setBusy(true);
      setMessage('');

      await apiFetch(`/api/admin/internal-admins/${userId}`, {
        method: 'DELETE',
      });

      setMessage('Internal admin deleted.');
      await loadAdmins();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete internal admin');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Internal Admins
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Manage internal admins</h1>
        <p className="mt-2 text-slate-600">Create, disable, or delete Wezen internal admin users.</p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Add internal admin</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Login email" type="email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="Notification email optional" type="email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" type="password" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" />
        </div>

        <button onClick={createAdmin} disabled={busy} className="mt-6 rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          Create Internal Admin
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Current internal admins</h2>

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? <div className="text-sm text-slate-600">No internal admins found.</div> : null}

          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-950">
                    {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{item.email}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {item.isActive ? 'Active' : 'Disabled'}
                    {item.isSystemUser ? ' • System Admin' : ''}
                    {item.notificationEmail ? ` • Notifications: ${item.notificationEmail}` : ''}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActive(item.id, !item.isActive)}
                    disabled={busy || item.isSystemUser}
                    className={item.isActive ? 'rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60' : 'rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60'}
                  >
                    {item.isActive ? 'Disable' : 'Activate'}
                  </button>

                  <button
                    onClick={() => deleteAdmin(item.id, item.email)}
                    disabled={busy || item.isSystemUser}
                    className="rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
