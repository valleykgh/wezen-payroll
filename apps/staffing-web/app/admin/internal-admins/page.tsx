'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function InternalAdminsPage() {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');

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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create internal admin');
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
        <h1 className="mt-2 text-3xl font-bold text-slate-950">Add internal admin</h1>
        <p className="mt-2 text-slate-600">Create another Wezen internal admin with the same admin rights.</p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
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
    </div>
  );
}
