'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { registerFacilityRequest } from '@/lib/auth-client';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';

export function FacilitySignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      await registerFacilityRequest({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        inviteCode: form.inviteCode,
      });

      router.push('/facility/dashboard');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm"
    >
      <div className="text-2xl font-bold tracking-tight text-slate-950">
        Activate Facility Account
      </div>
      <p className="mt-3 text-slate-600">
        Facility access is activated by Wezen Staffing after contract setup. Use the
        invite code provided to your facility administrator to create your account.
      </p>

      {message ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <FormField label="First name" htmlFor="firstName">
          <TextInput
            id="firstName"
            value={form.firstName}
            onChange={(e) => update('firstName', e.target.value)}
            required
          />
        </FormField>

        <FormField label="Last name" htmlFor="lastName">
          <TextInput
            id="lastName"
            value={form.lastName}
            onChange={(e) => update('lastName', e.target.value)}
            required
          />
        </FormField>

        <FormField label="Email" htmlFor="email">
          <TextInput
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            required
          />
        </FormField>

        <FormField label="Password" htmlFor="password">
          <TextInput
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            required
          />
        </FormField>

        <div className="md:col-span-2">
          <FormField label="Facility invite code" htmlFor="inviteCode">
            <TextInput
              id="inviteCode"
              value={form.inviteCode}
              onChange={(e) => update('inviteCode', e.target.value)}
              placeholder="Enter the invite code provided by Wezen"
              required
            />
          </FormField>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Activating account...' : 'Activate Facility Account'}
        </button>
      </div>
    </form>
  );
}
