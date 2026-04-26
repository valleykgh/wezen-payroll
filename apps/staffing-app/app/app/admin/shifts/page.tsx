'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { apiFetch } from '@/lib/api-client';

type AdminShiftRequest = {
  id: string;
  status: string;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
    facilityCity?: string | null;
    facilityState?: string | null;
  };
  professional: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
    city?: string | null;
    state?: string | null;
  };
};

function formatDate(value: string) {
  const dateOnly = value.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

function statusClass(status: string) {
  if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED' || status === 'NO_SHOW' || status === 'CANCELLED') return 'bg-rose-50 text-rose-700';
  if (status === 'CANCELLATION_REQUESTED') return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function AdminShiftsPage() {
  const [requests, setRequests] = useState<AdminShiftRequest[]>([]);
  const [message, setMessage] = useState('Loading shift activity...');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: AdminShiftRequest[] }>('/api/admin/shift-requests');
        setRequests(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shift activity');
      }
    }

    load();
  }, []);

  const counts = useMemo(() => {
    return {
      total: requests.length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      requested: requests.filter((r) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW').length,
      noShow: requests.filter((r) => r.status === 'NO_SHOW').length,
    };
  }, [requests]);

  return (
    <AppShell role="admin" title="Shifts" subtitle="View shift activity across all facilities.">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">Total Requests</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{counts.total}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">Approved</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{counts.approved}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">Pending</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{counts.requested}</p>
          </div>
          <div className="rounded-3xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">No-Show</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{counts.noShow}</p>
          </div>
        </div>

        {message ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            {message}
          </div>
        ) : null}

        {requests.map((request) => {
          const workerName =
            `${request.professional.firstName || ''} ${request.professional.lastName || ''}`.trim() ||
            request.professional.email;

          return (
            <div key={request.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                    {request.shift.role} • {request.shift.shiftType}
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-slate-950">{request.shift.facilityName}</h2>
                  <p className="mt-1 text-sm text-slate-600">{workerName}</p>
                  <p className="mt-1 text-sm text-slate-500">{request.professional.email}</p>
                </div>

                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(request.status)}`}>
                  {request.status}
                </span>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm">
                <div>
                  <p className="text-slate-500">Date</p>
                  <p className="font-bold text-slate-950">{formatDate(request.shift.date)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Time</p>
                  <p className="font-bold text-slate-950">{request.shift.time}</p>
                </div>
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-bold text-slate-950">
                    {[request.shift.facilityCity, request.shift.facilityState].filter(Boolean).join(', ') || '—'}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {!message && requests.length === 0 ? (
          <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 ring-1 ring-slate-200">
            No shift activity found.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
