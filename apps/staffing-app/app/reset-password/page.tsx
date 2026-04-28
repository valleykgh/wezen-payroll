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
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-950">Reset password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter a new password. Reset links expire in 30 minutes.</p>

        {message ? <div className="mt-5 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">{message}</div> : null}

        <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="Minimum 8 characters" />

        <button type="submit" disabled={busy || !token} className="mt-5 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? 'Resetting...' : 'Reset Password'}
        </button>

        <a href="/login/index.html" className="mt-5 block text-center text-sm font-bold text-slate-600">Back to login</a>
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
