'use client';

import { useEffect, useState } from 'react';
import { registerProfessionalRequest } from '@/lib/auth-client';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';
import { SelectInput } from '@/components/ui/select-input';

export function ProfessionalSignupForm() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    openShiftAlertsEnabled: false,
    openShiftAlertRadiusMiles: '50',
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
        phone: form.phone || undefined,
        addressLine1: form.addressLine1 || undefined,
        addressLine2: form.addressLine2 || undefined,
        openShiftAlertsEnabled: form.openShiftAlertsEnabled,
        openShiftAlertRadiusMiles: Number(form.openShiftAlertRadiusMiles || 50),
        role: form.role as 'CNA' | 'LVN' | 'RN',
        city: form.city || undefined,
        state: form.state || undefined,
        zipCode: form.zipCode || undefined,
      });

      setMessage('Success! Your professional account has been created. Opening your worker profile...');
      setTimeout(() => {
        window.location.href = '/app/worker/profile/index.html';
      }, 2200);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Signup failed');
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
        Professional Sign Up
      </div>
      <p className="mt-3 text-slate-600">
        Create your healthcare professional account to browse shifts and manage requests.
      </p>

      {message ? (
        <div className="fixed inset-x-4 bottom-24 z-50 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center text-sm font-bold text-emerald-800 shadow-lg">
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

	<FormField label="Phone number" htmlFor="phone">
  <TextInput
    id="phone"
    value={form.phone}
    onChange={(e) => update('phone', e.target.value)}
  />
</FormField>

	<FormField label="Address line 1" htmlFor="addressLine1">
  <TextInput
    id="addressLine1"
    value={form.addressLine1}
    onChange={(e) => update('addressLine1', e.target.value)}
  />
</FormField>

<FormField label="Address line 2" htmlFor="addressLine2">
  <TextInput
    id="addressLine2"
    value={form.addressLine2}
    onChange={(e) => update('addressLine2', e.target.value)}
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
        <div className="rounded-3xl border-2 border-cyan-200 bg-cyan-50 p-5">
        <label className="flex items-start gap-3 text-sm font-extrabold text-cyan-950">
          <input
            type="checkbox"
            checked={form.openShiftAlertsEnabled}
            onChange={(e) => update('openShiftAlertsEnabled', e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          Notify me when matching shifts open near me
        </label>

        <label className="mt-4 block text-sm font-bold text-cyan-950">
          Alert radius in miles
          <input
            type="number"
            min={1}
            value={form.openShiftAlertRadiusMiles}
            onChange={(e) => update('openShiftAlertRadiusMiles', e.target.value)}
            className="mt-2 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-base font-bold"
          />
        </label>
      </div>

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
