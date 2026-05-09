'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type StaffUser = {
  id: string;
  userId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  title?: string | null;
  isActive: boolean;
  appNotificationsEnabled: boolean;
};

export function FacilityStaffClient() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [title, setTitle] = useState('Scheduler');
  const [password, setPassword] = useState('');

  async function loadStaff() {
    try {
      const res = await apiFetch<{ data: StaffUser[] }>('/api/facility/staff');
      setStaff(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load staff');
    }
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      await apiFetch('/api/facility/staff', {
        method: 'POST',
        body: JSON.stringify({
          email,
          firstName,
          lastName,
          title,
          password,
        }),
      });

      setEmail('');
      setFirstName('');
      setLastName('');
      setTitle('Scheduler');
      setPassword('');
      setMessage('Facility staff user created.');
      await loadStaff();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create staff user');
    } finally {
      setBusy(false);
    }
  }

  async function setActive(staffId: string, isActive: boolean) {
    setBusy(true);
    setMessage('');

    try {
      await apiFetch(`/api/facility/staff/${staffId}/active`, {
        method: 'PUT',
        body: JSON.stringify({ isActive }),
      });

      await loadStaff();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update staff user');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadStaff();
  }, []);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-3xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">
          {message}
        </div>
      ) : null}

      <form onSubmit={createStaff} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-extrabold text-slate-950">Add Staff User</h2>

        <div className="mt-4 grid gap-3">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Login email" type="email" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" type="password" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm" />

          <button disabled={busy} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            {busy ? 'Saving...' : 'Create Staff'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-extrabold text-slate-950">Staff Users</h2>

        <div className="mt-4 grid gap-3">
          {staff.length === 0 ? (
            <p className="text-sm text-slate-600">No staff users yet.</p>
          ) : null}

          {staff.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="font-extrabold text-slate-950">
                {[item.firstName, item.lastName].filter(Boolean).join(' ') || item.email}
              </p>
              <p className="mt-1 text-sm text-slate-600">{item.email}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">
                {item.title || 'Scheduler'} • {item.isActive ? 'Active' : 'Disabled'} • App Alerts {item.appNotificationsEnabled ? 'On' : 'Off'}
              </p>

              <button
                type="button"
                disabled={busy}
                onClick={() => setActive(item.id, !item.isActive)}
                className={item.isActive ? 'mt-3 rounded-full bg-rose-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60' : 'mt-3 rounded-full bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-60'}
              >
                {item.isActive ? 'Disable' : 'Enable'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
