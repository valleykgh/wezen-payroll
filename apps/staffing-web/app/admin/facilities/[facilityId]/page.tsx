'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';

type FacilityDetail = {
  id: string;
  name: string;
  facilityType?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  isActive: boolean;
  defaultCnaRateCents?: number | null;
  defaultLvnRateCents?: number | null;
  defaultRnRateCents?: number | null;
  allowRateOverride: boolean;
};

export default function AdminFacilityDetailPage({
  params,
}: {
  params: Promise<{ facilityId: string }>;
}) {
  const [facilityId, setFacilityId] = useState('');
  const [facility, setFacility] = useState<FacilityDetail | null>(null);
  const [message, setMessage] = useState('Loading facility...');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [city, setCity] = useState('');
  const [stateValue, setStateValue] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [defaultCnaRateDollars, setDefaultCnaRateDollars] = useState('');
  const [defaultLvnRateDollars, setDefaultLvnRateDollars] = useState('');
  const [defaultRnRateDollars, setDefaultRnRateDollars] = useState('');
  const [allowRateOverride, setAllowRateOverride] = useState(false);

  async function load(id: string) {
    const res = await apiFetch<{ data: FacilityDetail }>(`/api/admin/facilities/${id}`);
    const data = res.data;

    setFacility(data);
    setName(data.name || '');
    setFacilityType(data.facilityType || '');
    setCity(data.city || '');
    setStateValue(data.state || '');
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
        const resolved = await params;
        setFacilityId(resolved.facilityId);
        await load(resolved.facilityId);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load facility');
      }
    }

    init();
  }, [params]);

  async function saveFacility() {
    try {
      setBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/facilities/${facilityId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          facilityType,
          city,
          state: stateValue,
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
        throw new Error(formatApiErrorText(text, 'Failed to save facility'));
      }

      await load(facilityId);
      setMessage('Facility updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save facility');
    } finally {
      setBusy(false);
    }
  }

  if (!facility) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Internal Admin
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">{facility.name}</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-200">
              Manage negotiated rates and whether this facility can override pay while posting shifts.
            </p>
          </div>

          <Link
            href="/admin/facilities"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Back to Facilities
          </Link>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Facility profile</h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">Facility name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Facility type</label>
              <input
                value={facilityType}
                onChange={(e) => setFacilityType(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">City</label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">State</label>
              <input
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">ZIP code</label>
              <input
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">Shift pay controls</h2>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">CNA default rate ($/hr)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultCnaRateDollars}
                onChange={(e) => setDefaultCnaRateDollars(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">LVN default rate ($/hr)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultLvnRateDollars}
                onChange={(e) => setDefaultLvnRateDollars(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">RN default rate ($/hr)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultRnRateDollars}
                onChange={(e) => setDefaultRnRateDollars(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              />
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allowRateOverride}
                onChange={(e) => setAllowRateOverride(e.target.checked)}
              />
              Allow facility users to override pay rate when posting shifts
            </label>

            <button
              type="button"
              onClick={saveFacility}
              disabled={busy}
              className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {busy ? 'Saving...' : 'Save Facility Settings'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
