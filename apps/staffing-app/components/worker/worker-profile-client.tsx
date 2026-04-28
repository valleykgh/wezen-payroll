'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Profile = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  maxDistanceMiles?: number | null;
  openShiftAlertsEnabled?: boolean | null;
  openShiftAlertRadiusMiles?: number | null;
};

export function WorkerProfileClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState('Loading profile...');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    maxDistanceMiles: '25',
    openShiftAlertsEnabled: false,
    openShiftAlertRadiusMiles: '50',
  });

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadProfile() {
    try {
      const me = await apiFetch<{ data: { professionalId?: string | null } }>('/api/auth/me');
      const professionalId = me.data.professionalId;

      if (!professionalId) {
        setMessage('Professional profile not found.');
        return;
      }

      const res = await apiFetch<{ data: Profile }>(`/api/worker/profile?professionalId=${professionalId}`);
      const p = res.data;

      setProfile(p);
      setForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        phone: p.phone || '',
        addressLine1: p.addressLine1 || '',
        addressLine2: p.addressLine2 || '',
        city: p.city || '',
        state: p.state || '',
        zipCode: p.zipCode || '',
        maxDistanceMiles: String(p.maxDistanceMiles ?? 25),
        openShiftAlertsEnabled: Boolean(p.openShiftAlertsEnabled),
        openShiftAlertRadiusMiles: String(p.openShiftAlertRadiusMiles ?? 50),
      });
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load profile.');
    }
  }

  async function saveProfile() {
    if (!profile?.id) return;

    setBusy(true);
    setMessage('');

    try {
      await apiFetch('/api/worker/profile', {
        method: 'PUT',
        body: JSON.stringify({
          professionalId: profile.id,
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || undefined,
          addressLine1: form.addressLine1 || undefined,
          addressLine2: form.addressLine2 || undefined,
          city: form.city || undefined,
          state: form.state || undefined,
          zipCode: form.zipCode || undefined,
          maxDistanceMiles: Number(form.maxDistanceMiles || 25),
          openShiftAlertsEnabled: form.openShiftAlertsEnabled,
          openShiftAlertRadiusMiles: Number(form.openShiftAlertRadiusMiles || 50),
        }),
      });

      setMessage('Profile saved.');
      await loadProfile();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save profile.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-3xl bg-white p-4 text-center text-sm font-bold text-slate-800 ring-1 ring-slate-200">
          {message}
        </div>
      ) : null}

      {profile ? (
        <div className="grid gap-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {[
            ['First name', 'firstName'],
            ['Last name', 'lastName'],
            ['Phone', 'phone'],
            ['Address line 1', 'addressLine1'],
            ['Address line 2', 'addressLine2'],
            ['City', 'city'],
            ['State', 'state'],
            ['Zip code', 'zipCode'],
          ].map(([label, key]) => (
            <label key={key} className="text-sm font-bold text-slate-900">
              {label}
              <input
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4"
                value={String(form[key as keyof typeof form] || '')}
                onChange={(e) => update(key as keyof typeof form, e.target.value)}
              />
            </label>
          ))}

          <label className="text-sm font-bold text-slate-900">
            Search distance in miles
            <input
              type="number"
              min={1}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-4"
              value={form.maxDistanceMiles}
              onChange={(e) => update('maxDistanceMiles', e.target.value)}
            />
          </label>

          <div className="rounded-3xl border-2 border-cyan-200 bg-cyan-50 p-5">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-800">
              Shift Alerts
            </p>

            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-slate-950">
              <input
                type="checkbox"
                checked={form.openShiftAlertsEnabled}
                onChange={(e) => update('openShiftAlertsEnabled', e.target.checked)}
                className="mt-1 h-5 w-5"
              />
              Notify me when matching shifts open nearby
            </label>

            <label className="mt-4 block text-sm font-bold text-slate-900">
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
            type="button"
            onClick={saveProfile}
            disabled={busy}
            className="rounded-2xl bg-cyan-600 px-5 py-4 text-base font-extrabold text-white disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
