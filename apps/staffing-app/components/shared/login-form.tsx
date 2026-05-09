'use client';

import { useEffect, useState } from 'react';
import { loginRequest, meRequest } from '@/lib/auth-client';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';

type LoginFormProps = {
  next?: string;
};

export function LoginForm({ next = '' }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function autoRouteIfLoggedIn() {
      try {
        const res = await meRequest();
        if (!mounted) return;

        const role = res.data.role;

        if (role === 'INTERNAL_ADMIN') {
          window.location.replace('/app/admin/index.html');
        } else if ((role === 'FACILITY_ADMIN' || role === 'FACILITY_STAFF')) {
          window.location.replace('/app/facility/index.html');
        } else if (role === 'PROFESSIONAL') {
          window.location.replace('/app/worker/index.html');
        }
      } catch {
        // Stay on login page if no valid saved session exists.
      }
    }

    autoRouteIfLoggedIn();

    return () => {
      mounted = false;
    };
  }, []);

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setSubmitting(true);
  setMessage('');

  try {
    const result = await loginRequest(email, password);
    const role = result?.data?.role;

    const params = new URLSearchParams(window.location.search);
    const requestedNextRaw = params.get('next') || '';
    const requestedNext = requestedNextRaw.trim();
    const requestedNextLower = requestedNext.toLowerCase();

    let target = '/';

    if (role === 'INTERNAL_ADMIN') {
  target = '/app/admin/index.html';
} else if ((role === 'FACILITY_ADMIN' || role === 'FACILITY_STAFF')) {
  target = '/app/facility/index.html';
} else if (role === 'PROFESSIONAL') {
  target = '/app/worker/index.html';
}
    window.location.href = target;
    return;
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Login failed');
  } finally {
    setSubmitting(false);
  }
}
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);


  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="text-2xl font-bold tracking-tight text-slate-950">
        Login
      </div>
      <p className="mt-3 text-slate-600">
        Sign in as a facility admin, internal admin, or healthcare professional.
      </p>

      {message ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <FormField label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <TextInput
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
            required
          />
        </FormField>
      </div>

      <div className="mt-4 text-right">
        <a
          href="/forgot-password/index.html"
          className="text-sm font-medium text-cyan-700 underline underline-offset-4"
        >
          Forgot password?
        </a>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
        Use your Wezen Staffing account to access staffing workflows. Payroll access is managed separately through the payroll portal.
      </div>
    </form>
  );
}
