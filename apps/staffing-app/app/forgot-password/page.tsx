'use client';

import { useState } from 'react';
import { forgotPasswordRequest } from '@/lib/auth-client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      await forgotPasswordRequest(email);
      setMessage('If this email exists, a reset link has been sent. It expires in 30 minutes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to request reset link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-10">
      <form onSubmit={submit} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-extrabold text-slate-950">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your Wezen Staffing login email.</p>

        {message ? <div className="mt-5 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-bold text-cyan-800">{message}</div> : null}

        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="you@example.com" />

        <button type="submit" disabled={busy} className="mt-5 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
          {busy ? 'Sending...' : 'Send Reset Link'}
        </button>

        <a href="/login/index.html" className="mt-5 block text-center text-sm font-bold text-slate-600">Back to login</a>
      </form>
    </main>
  );
}
