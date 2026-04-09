'use client';

import { useEffect, useMemo, useState } from 'react';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { apiFetch } from '@/lib/api-client';

type Facility = {
  id: string;
  name: string;
  facilityType?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

type CreatedInvite = {
  id: string;
  facilityId: string;
  facilityName: string;
  inviteCode: string;
  email?: string | null;
  isUsed: boolean;
  expiresAt?: string | null;
  createdAt: string;
};

export default function AdminFacilityInvitesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState('');
  const [email, setEmail] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [message, setMessage] = useState('Loading facilities...');
  const [submitting, setSubmitting] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvite | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Facility[] }>('/api/admin/facilities');
        setFacilities(res.data);
        if (res.data.length > 0) {
          setFacilityId(res.data[0].id);
        }
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load facilities');
      }
    }

    load();
  }, []);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setCreatedInvite(null);

    try {
      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/facility-invites`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId,
          email: email || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to create facility invite');
      }

      const parsed = text ? JSON.parse(text) : null;
      setCreatedInvite(parsed?.data ?? null);
      setMessage('Facility invite created successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === facilityId) ?? null,
    [facilities, facilityId]
  );

  const activationLink = createdInvite
    ? `${window.location.origin}/signup/facility?invite=${createdInvite.inviteCode}`
    : '';

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Facility invite management
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Generate one-time activation codes for pre-approved facilities after contract setup.
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
            Create facility invite
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Generate an activation code for a contracted facility administrator.
          </p>

          <form onSubmit={createInvite} className="mt-6 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Facility
              </label>
              <select
                value={facilityId}
                onChange={(e) => setFacilityId(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                required
              >
                {facilities.map((facility) => (
                  <option key={facility.id} value={facility.id}>
                    {facility.name}
                    {facility.city || facility.state
                      ? ` — ${facility.city || ''}${facility.city && facility.state ? ', ' : ''}${facility.state || ''}`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Restrict to email (optional)
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="facility.admin@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Expiration date/time (optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !facilityId}
              className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Generating invite...' : 'Generate Invite'}
            </button>
          </form>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Selected facility
            </h2>

            {selectedFacility ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-950">{selectedFacility.name}</div>
                <div className="mt-2">
                  {selectedFacility.facilityType || 'Facility type not set'}
                </div>
                <div className="mt-1 text-slate-500">
                  {selectedFacility.city || 'Unknown city'}
                  {selectedFacility.state ? `, ${selectedFacility.state}` : ''}
                  {selectedFacility.zipCode ? ` ${selectedFacility.zipCode}` : ''}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No facility selected.
              </div>
            )}
          </div>

          <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Invite workflow
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              Contract first, activation second
            </div>
            <div className="mt-3 text-sm leading-7 text-cyan-50/90">
              Generate an invite only after the facility agreement is complete and the facility record has been created internally.
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Latest generated invite
            </h2>

            {!createdInvite ? (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No invite generated in this session yet.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Facility
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {createdInvite.facilityName}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Invite code
                  </div>
                  <div className="mt-1 break-all text-lg font-bold tracking-tight text-slate-950">
                    {createdInvite.inviteCode}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Activation link
                  </div>
                  <div className="mt-1 break-all text-sm font-medium text-slate-900">
                    {activationLink}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Restricted email
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {createdInvite.email || 'Not restricted'}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Expires
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {createdInvite.expiresAt
                        ? new Date(createdInvite.expiresAt).toLocaleString()
                        : 'No expiration'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
