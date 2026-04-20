'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type FacilitySettings = {
  id: string;
  name: string;
  facilityType?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  defaultCnaRateCents?: number | null;
  defaultLvnRateCents?: number | null;
  defaultRnRateCents?: number | null;
  allowRateOverride: boolean;
};

export default function FacilitySettingsPage() {
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  const [message, setMessage] = useState('Loading facility settings...');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [defaultCnaRateDollars, setDefaultCnaRateDollars] = useState('');
  const [defaultLvnRateDollars, setDefaultLvnRateDollars] = useState('');
  const [defaultRnRateDollars, setDefaultRnRateDollars] = useState('');
  const [allowRateOverride, setAllowRateOverride] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');


  async function load() {
    const res = await apiFetch<{ data: FacilitySettings }>('/api/facility/settings');
    const data = res.data;

    setSettings(data);
    setName(data.name || '');
    setFacilityType(data.facilityType || '');
    setCity(data.city || '');
    setState(data.state || '');
    setZipCode(data.zipCode || '');
    setDefaultCnaRateDollars(
      data.defaultCnaRateCents != null ? (data.defaultCnaRateCents / 100).toFixed(2) : ''
    );
    setDefaultLvnRateDollars(
      data.defaultLvnRateCents != null ? (data.defaultLvnRateCents / 100).toFixed(2) : ''
    );
    setDefaultRnRateDollars(
      data.defaultRnRateCents != null ? (data.defaultRnRateCents / 100).toFixed(2) : ''
    );
    setAllowRateOverride(Boolean(data.allowRateOverride));
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load facility settings');
      }
    }

    init();
  }, []);

  async function saveSettings() {
    try {
      setBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/facility/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          facilityType,
          city,
          state,
          zipCode,
          defaultCnaRateCents: defaultCnaRateDollars
            ? Math.round(Number(defaultCnaRateDollars) * 100)
            : null,
          defaultLvnRateCents: defaultLvnRateDollars
            ? Math.round(Number(defaultLvnRateDollars) * 100)
            : null,
          defaultRnRateCents: defaultRnRateDollars
            ? Math.round(Number(defaultRnRateDollars) * 100)
            : null,
          allowRateOverride,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to save settings');
      }

      await load();
      setMessage('Facility settings saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        {message}
      </div>
    );
  }

async function changePassword() {
  try {
    setBusy(true);
    setMessage('');

    if (!currentPassword.trim()) {
      throw new Error('Current password is required.');
    }

    if (newPassword.trim().length < 8) {
      throw new Error('New password must be at least 8 characters.');
    }

    const res = await fetch(`${STAFFING_API_BASE_URL}/api/facility/change-password`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
      }),
    });

    const text = await res.text();

    if (!res.ok) {
      throw new Error(text || 'Failed to change password');
    }

    setCurrentPassword('');
    setNewPassword('');
    setMessage('Password changed successfully.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to change password');
  } finally {
    setBusy(false);
  }
}

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Settings
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Facility settings
        </h1>
        <p className="mt-2 text-slate-600">
          Update facility information and negotiated pay settings.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Facility profile
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Facility name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Facility type
            </label>
            <input
              value={facilityType}
              onChange={(e) => setFacilityType(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              City
            </label>
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              State
            </label>
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              ZIP code
            </label>
            <input
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>
        </div>
      </section>

	<section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-bold tracking-tight text-slate-950">
    Change password
  </h2>
  <p className="mt-2 text-sm text-slate-600">
    Update the password for this facility account.
  </p>

  <div className="mt-6 grid gap-4 md:grid-cols-2">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Current password
      </label>
      <input
        type="password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        New password
      </label>
      <input
        type="password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </div>
  </div>

  <div className="mt-6">
    <button
      type="button"
      onClick={changePassword}
      disabled={busy}
      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? 'Updating...' : 'Update Password'}
    </button>
  </div>
</section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Negotiated pay settings
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              CNA default rate ($/hr)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={defaultCnaRateDollars}
              onChange={(e) => setDefaultCnaRateDollars(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              LVN default rate ($/hr)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={defaultLvnRateDollars}
              onChange={(e) => setDefaultLvnRateDollars(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              RN default rate ($/hr)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={defaultRnRateDollars}
              onChange={(e) => setDefaultRnRateDollars(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              placeholder="Optional"
            />
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
              <input
                type="checkbox"
                checked={allowRateOverride}
                onChange={(e) => setAllowRateOverride(e.target.checked)}
              />
              Allow rate override while posting shift
            </label>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={saveSettings}
            disabled={busy}
            className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </section>
    </div>
  );
}
