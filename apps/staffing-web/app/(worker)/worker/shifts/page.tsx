'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { ShiftResultsClient } from '@/components/worker/shift-results-client';
import { ShiftSearchFilters } from '@/components/worker/shift-search-filters';
import { useSearchParams } from 'next/navigation';

type ShiftInvitation = {
  id: string;
  status: string;
  message?: string | null;
  createdAt: string;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
    city?: string | null;
    state?: string | null;
    status: string;
  };
};

type Shift = {
  id: string;
  role: string;
  facilityId?: string;
  facilityName: string;
  city: string;
  state: string;
  distanceMiles: number | null;
  shiftType: string;
  date: string;
  time: string;
  payRateLabel: string;
  applicants: number;
  workersNeeded: number;
  fillCount: number;
  pendingCount?: number;
  fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED';
  fillLabel: string;
  status: string;
  isBlockedByFacilityDnr?: boolean;
  blockReason?: string | null;
};

export default function WorkerShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading shifts...');
  const [invitations, setInvitations] = useState<ShiftInvitation[]>([]);
  const [respondingInviteId, setRespondingInviteId] = useState('');
  const searchParams = useSearchParams();

  async function loadInvitations() {
    try {
      const res = await apiFetch<{ data: ShiftInvitation[] }>('/api/worker/shift-invitations');
      setInvitations((res.data || []).filter((item) => item.status === 'SENT'));
    } catch {
      setInvitations([]);
    }
  }

  async function respondToInvitation(invitationId: string, action: 'ACCEPTED' | 'DECLINED') {
    try {
      setRespondingInviteId(invitationId);
      await apiFetch(`/api/worker/shift-invitations/${invitationId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setMessage(action === 'ACCEPTED' ? 'Invitation accepted. Facility will review your request.' : 'Invitation declined.');
      await loadInvitations();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to respond to invitation');
    } finally {
      setRespondingInviteId('');
    }
  }

  useEffect(() => {
  async function load() {
    try {
      const query = searchParams.toString();
      const url = query ? `/api/worker/shifts?${query}` : '/api/worker/shifts';

      const res = await apiFetch<{ data: Shift[] }>(url);

      setShifts(res.data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
    }
  }

  load();
  loadInvitations();
}, [searchParams]);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Shift Marketplace
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Search and request available shifts
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Browse open shifts, review facility coverage needs, and request assignments you are eligible to work.
        </p>
      </div>

      {invitations.length > 0 ? (
        <section className="rounded-[1.75rem] border-2 border-cyan-200 bg-cyan-50 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Shift Invitations</h2>
          <p className="mt-1 text-sm text-slate-700">Facilities invited you to these shifts.</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {invitations.map((invite) => (
              <div key={invite.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-cyan-100">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                  {invite.shift.role} • {invite.shift.shiftType}
                </div>
                <div className="mt-2 text-lg font-extrabold text-slate-950">
                  {invite.shift.facilityName}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {new Date(invite.shift.date).toLocaleDateString()} • {invite.shift.time}
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {[invite.shift.city, invite.shift.state].filter(Boolean).join(', ') || 'Location not listed'}
                </div>
                {invite.message ? (
                  <div className="mt-3 rounded-2xl bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-900">
                    {invite.message}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => respondToInvitation(invite.id, 'ACCEPTED')}
                    disabled={respondingInviteId === invite.id}
                    className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => respondToInvitation(invite.id, 'DECLINED')}
                    disabled={respondingInviteId === invite.id}
                    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-bold text-slate-900 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <ShiftSearchFilters />

      {message && shifts.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {shifts.length > 0 ? <ShiftResultsClient shifts={shifts} /> : null}
    </div>
  );
}
