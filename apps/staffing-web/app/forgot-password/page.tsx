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
      setMessage('If this email exists, a password reset link has been sent. The link expires in 30 minutes.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to request reset link');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <form onSubmit={submit} className="mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Forgot password</h1>
        <p className="mt-3 text-sm text-slate-600">Enter your Wezen Staffing login email.</p>

        {message ? <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">{message}</div> : null}

        <label className="mt-6 block text-sm font-semibold text-slate-700">Email</label>
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm" placeholder="you@example.com" />

        <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? 'Sending...' : 'Send Reset Link'}
        </button>

        <a href="/login" className="mt-5 block text-center text-sm font-semibold text-slate-600">Back to login</a>
      </form>
    </main>
  );
}
