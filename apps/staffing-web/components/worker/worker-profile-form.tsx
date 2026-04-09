'use client';

import { useState } from 'react';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';
import { TextArea } from '@/components/ui/text-area';
import { SelectInput } from '@/components/ui/select-input';

const API_BASE_URL = 'http://localhost:4001';

type WorkerProfile = {
  id: string;
  role: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  maxDistanceMiles?: number | null;
  hourlyRateCents?: number | null;
  bio?: string | null;
  onboardingStatus?: string | null;
  approvedByWezen: boolean;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
};

type Props = {
  profile: WorkerProfile;
};

export function WorkerProfileForm({ profile }: Props) {
  const [form, setForm] = useState({
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phone: profile.phone || '',
    city: profile.city || '',
    state: profile.state || '',
    zipCode: profile.zipCode || '',
    maxDistanceMiles: String(profile.maxDistanceMiles ?? 25),
    hourlyRateDollars: profile.hourlyRateCents
      ? String(profile.hourlyRateCents / 100)
      : '',
    bio: profile.bio || '',
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
      const res = await fetch(`${API_BASE_URL}/api/worker/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professionalId: profile.id,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          maxDistanceMiles: form.maxDistanceMiles
            ? Number(form.maxDistanceMiles)
            : undefined,
          hourlyRateCents: form.hourlyRateDollars
            ? Math.round(Number(form.hourlyRateDollars) * 100)
            : undefined,
          bio: form.bio || undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to update profile');
      }

      setMessage('Profile updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Professional profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Keep your profile up to date so facilities can review your information quickly.
          </p>
        </div>

        {message ? (
          <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
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
            <TextInput id="email" value={profile.email} disabled />
          </FormField>

          <FormField label="Phone" htmlFor="phone">
            <TextInput
              id="phone"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
            />
          </FormField>

          <FormField label="Role" htmlFor="role">
            <SelectInput id="role" value={profile.role} disabled>
              <option value={profile.role}>{profile.role}</option>
            </SelectInput>
          </FormField>

          <FormField label="Max distance (miles)" htmlFor="maxDistanceMiles">
            <TextInput
              id="maxDistanceMiles"
              type="number"
              value={form.maxDistanceMiles}
              onChange={(e) => update('maxDistanceMiles', e.target.value)}
            />
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

          <FormField label="Preferred pay ($/hr)" htmlFor="hourlyRateDollars">
            <TextInput
              id="hourlyRateDollars"
              type="number"
              step="0.01"
              value={form.hourlyRateDollars}
              onChange={(e) => update('hourlyRateDollars', e.target.value)}
            />
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Professional summary" htmlFor="bio">
              <TextArea
                id="bio"
                rows={5}
                value={form.bio}
                onChange={(e) => update('bio', e.target.value)}
                placeholder="Brief summary of your experience, specialties, and shift preferences"
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Onboarding status
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">
            {profile.onboardingStatus || 'PENDING'}
          </div>
          <div className="mt-2 text-cyan-50">
            {profile.approvedByWezen ? 'Approved by Wezen' : 'Awaiting approval'}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold tracking-tight text-slate-950">
            Profile checklist
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              1. Complete your profile details.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              2. Upload required compliance documents.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              3. Complete agreement signing.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              4. Receive approval and begin accepting shifts.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
