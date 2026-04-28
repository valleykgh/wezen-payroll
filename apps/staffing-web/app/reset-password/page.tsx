'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { resetPasswordRequest } from '@/lib/auth-client';

function ResetPasswordPageInner() {
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      if (!token) throw new Error('Reset token is missing.');
      if (newPassword.trim().length < 8) throw new Error('Password must be at least 8 characters.');

      await resetPasswordRequest(token, newPassword);
      setNewPassword('');
      setMessage('Password reset successfully. You can now log in.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reset password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Reset password</h1>
        <p className="mt-3 text-sm text-slate-600">Enter a new password. Reset links expire after 30 minutes.</p>

        {message ? <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">{message}</div> : null}

        <label className="mt-6 block text-sm font-semibold text-slate-700">New password</label>
        <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Minimum 8 characters" />

        <button type="submit" disabled={busy || !token} className="mt-6 w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Resetting...' : 'Reset Password'}
        </button>

        <a href="/login" className="mt-5 block text-center text-sm font-semibold text-slate-600">Back to login</a>
      </form>
    </main>
  );
}


export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 px-6 py-12">Loading reset form...</main>}>
      <ResetPasswordPageInner />
    </Suspense>
  );
}
