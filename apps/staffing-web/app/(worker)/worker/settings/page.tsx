'use client';

import { formatApiErrorText } from '@/lib/api-client';
import { useState } from 'react';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

export default function WorkerSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    try {
      setBusy(true);
      setMessage('');

      if (!currentPassword.trim()) {
        throw new Error('Current password is required.');
      }

      if (newPassword.trim().length < 8) {
        throw new Error('New password must be at least 8 characters.');
      }

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to change password'));
      }

      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Settings
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Worker settings
        </h1>
        <p className="mt-2 text-slate-600">
          Manage your account security and password.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Change password
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Update the password for your worker account.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={changePassword}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </section>
    </div>
  );
}
