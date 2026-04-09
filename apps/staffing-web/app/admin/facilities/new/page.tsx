'use client';

import { useState } from 'react';
import Link from 'next/link';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type CreatedFacility = {
  id: string;
  name: string;
  facilityType: string;
  city: string;
  state: string;
  zipCode: string;
};

export default function AdminCreateFacilityPage() {
  const [form, setForm] = useState({
    name: '',
    facilityType: '',
    city: '',
    state: '',
    zipCode: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [createdFacility, setCreatedFacility] = useState<CreatedFacility | null>(null);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setCreatedFacility(null);

    try {
      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/facilities`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to create facility');
      }

      const parsed = text ? JSON.parse(text) : null;
      setCreatedFacility(parsed?.data ?? null);
      setMessage('Facility created successfully.');
      setForm({
        name: '',
        facilityType: '',
        city: '',
        state: '',
        zipCode: '',
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create facility');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Create new facility
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Create the facility record first. After that, generate an activation invite for the facility administrator.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Facility details
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Enter the facility information exactly as you want it to appear internally.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Facility name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Facility type
              </label>
              <input
                type="text"
                value={form.facilityType}
                onChange={(e) => update('facilityType', e.target.value)}
                placeholder="Skilled Nursing, Hospital, Rehab, etc."
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                City
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => update('city', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                State
              </label>
              <input
                type="text"
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                ZIP code
              </label>
              <input
                type="text"
                value={form.zipCode}
                onChange={(e) => update('zipCode', e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                required
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating facility...' : 'Create Facility'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Workflow
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              Create facility, then generate invite
            </div>
            <div className="mt-3 text-sm leading-7 text-cyan-50/90">
              This mirrors your real business process: contract first, internal facility setup second, account activation third.
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Latest created facility
            </h2>

            {!createdFacility ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No facility created in this session yet.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Facility
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {createdFacility.name}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Type
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {createdFacility.facilityType}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Location
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {createdFacility.city}, {createdFacility.state} {createdFacility.zipCode}
                    </div>
                  </div>
                </div>

                <Link
                  href="/admin/facility-invites"
                  className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                >
                  Generate Invite for This Facility
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
