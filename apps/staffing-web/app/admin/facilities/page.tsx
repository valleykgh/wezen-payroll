'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type Facility = {
  id: string;
  name: string;
  facilityType?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  isActive: boolean;
};

export default function AdminFacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [message, setMessage] = useState('Loading facilities...');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await apiFetch<{ data: Facility[] }>('/api/admin/facilities');
    setFacilities(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load facilities');
      }
    }

    init();
  }, []);

  async function updateFacility(facilityId: string, action: 'deactivate' | 'reactivate') {
    try {
      setBusyId(facilityId);
      setMessage('');

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/admin/facilities/${facilityId}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `Failed to ${action} facility`);
      }

      await load();
      setMessage(
        action === 'deactivate'
          ? 'Facility deactivated successfully.'
          : 'Facility reactivated successfully.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update facility');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Facility controls
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Manage facility access, review active status, and control operational availability.
        </p>
      </div>

      <div className="flex flex-wrap gap-4">
        <Link
          href="/admin/facilities/new"
          className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
        >
          Create Facility
        </Link>

        <Link
          href="/admin/facility-invites"
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Facility Invites
        </Link>

      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {facilities.map((facility) => (
          <div
            key={facility.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-bold tracking-tight text-slate-950">
                    {facility.name}
                  </div>

                  {facility.isActive ? (
                    <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </div>
                  ) : (
                    <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                      Inactive
                    </div>
                  )}
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {facility.facilityType || 'Facility type not set'}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {facility.city || 'Unknown city'}
                  {facility.state ? `, ${facility.state}` : ''}
                  {facility.zipCode ? ` ${facility.zipCode}` : ''}
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-56">
                {facility.isActive ? (
                  <button
                    onClick={() => updateFacility(facility.id, 'deactivate')}
                    disabled={busyId === facility.id}
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyId === facility.id ? 'Working...' : 'Deactivate Facility'}
                  </button>
                ) : (
                  <button
                    onClick={() => updateFacility(facility.id, 'reactivate')}
                    disabled={busyId === facility.id}
                    className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {busyId === facility.id ? 'Working...' : 'Reactivate Facility'}
                  </button>
                )}

		  <Link
    href={`/admin/facilities/${facility.id}`}
    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
  >
    Edit Facility
  </Link>		

                <Link
                  href="/admin/facility-invites"
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Manage Invites
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {facilities.length === 0 && !message ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No facilities found.
        </div>
      ) : null}
    </div>
  );
}
