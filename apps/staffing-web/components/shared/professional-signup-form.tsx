'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { registerProfessionalRequest } from '@/lib/auth-client';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';
import { SelectInput } from '@/components/ui/select-input';

export function ProfessionalSignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'LVN',
    city: '',
    state: '',
    zipCode: '',
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
      await registerProfessionalRequest({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role as 'CNA' | 'LVN' | 'RN',
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
      });

      router.push('/worker/dashboard');
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
        Professional Sign Up
      </div>
      <p className="mt-3 text-slate-600">
        Create your healthcare professional account to browse shifts and manage requests.
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

        <FormField label="Role" htmlFor="role">
          <SelectInput
            id="role"
            value={form.role}
            onChange={(e) => update('role', e.target.value)}
          >
            <option value="CNA">CNA</option>
            <option value="LVN">LVN</option>
            <option value="RN">RN</option>
          </SelectInput>
        </FormField>

        <FormField label="City" htmlFor="city">
          <TextInput
            id="city"
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
          />
        </FormField>

        <FormField label="State" htmlFor="state">
          <TextInput
            id="state"
            value={form.state}
            onChange={(e) => update('state', e.target.value)}
          />
        </FormField>

        <FormField label="ZIP code" htmlFor="zipCode">
          <TextInput
            id="zipCode"
            value={form.zipCode}
            onChange={(e) => update('zipCode', e.target.value)}
          />
        </FormField>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
	>
          {submitting ? 'Creating account...' : 'Create Professional Account'}
        </button>
      </div>
    </form>
  );
}
