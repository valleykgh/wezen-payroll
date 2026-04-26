'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { apiFetch } from '@/lib/api-client';

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

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Facility[] }>('/api/admin/facilities');
        setFacilities(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load facilities');
      }
    }

    load();
  }, []);

  return (
    <AppShell role="admin" title="Facilities" subtitle="Manage facility accounts and access.">
      <div className="grid gap-4">
        {message ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            {message}
          </div>
        ) : null}

        {facilities.map((facility) => (
          <div key={facility.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {facility.facilityType || 'Facility'}
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">{facility.name}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {[facility.city, facility.state, facility.zipCode].filter(Boolean).join(', ') || 'Location not listed'}
                </p>
              </div>

              <span
                className={
                  facility.isActive
                    ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700'
                    : 'rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700'
                }
              >
                {facility.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>
          </div>
        ))}

        {!message && facilities.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            No facilities found.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
