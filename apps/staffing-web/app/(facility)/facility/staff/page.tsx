'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type StaffUser = {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  isActive: boolean;
  appNotificationsEnabled: boolean;
};

export default function FacilityStaffPage() {
  const [items, setItems] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState('Loading staff...');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('Scheduler');
  const [password, setPassword] = useState('');

  async function load() {
    try {
      const res = await apiFetch<{ data: StaffUser[] }>('/api/facility/staff');
      setItems(res.data || []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load staff');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createStaff() {
    try {
      setBusy(true);
      setMessage('');

      await apiFetch('/api/facility/staff', {
        method: 'POST',
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          title,
          password,
          notificationEmail: notificationEmail || undefined,
        }),
      });

      setEmail('');
      setNotificationEmail('');
      setFirstName('');
      setLastName('');
      setTitle('Scheduler');
      setPassword('');
      setMessage('Facility staff user created.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create staff user');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(staffId: string, active: boolean) {
    try {
      setBusy(true);
      setMessage('');

      await apiFetch(`/api/facility/staff/${staffId}/active`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });

      await load();
      setMessage(active ? 'Staff user activated.' : 'Staff user disabled.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update staff user');
    } finally {
      setBusy(false);
    }
  }

  async function deleteStaff(staffId: string, email: string) {
    if (!window.confirm(`Delete facility staff user ${email}? This cannot be undone.`)) return;

    try {
      setBusy(true);
      setMessage('');

      await apiFetch(`/api/facility/staff/${staffId}`, {
        method: 'DELETE',
      });

      await load();
      setMessage('Staff user deleted.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete staff user');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Facility Staff
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Manage staff users</h1>
        <p className="mt-2 text-slate-600">
          Add scheduler users with access to Post Shift, Shifts, Available Workers, Applicants, and Alerts.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Add staff user</h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Login email" type="email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={notificationEmail} onChange={(e) => setNotificationEmail(e.target.value)} placeholder="Notification email optional" type="email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" type="password" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
        </div>

        <button onClick={createStaff} disabled={busy} className="mt-6 rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          Create Staff User
        </button>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Current staff</h2>

        <div className="mt-5 grid gap-3">
          {items.length === 0 ? <div className="text-sm text-slate-600">No staff users yet.</div> : null}

          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-950">
                    {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{item.email}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {item.title || 'Scheduler'} • {item.isActive ? 'Active' : 'Disabled'} • App Alerts {item.appNotificationsEnabled ? 'On' : 'Off'}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setActive(item.id, !item.isActive)}
                    disabled={busy}
                    className={item.isActive ? 'rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60' : 'rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60'}
                  >
                    {item.isActive ? 'Disable' : 'Activate'}
                  </button>

                  <button
                    onClick={() => deleteStaff(item.id, item.email)}
                    disabled={busy}
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
