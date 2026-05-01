'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { meRequest } from '@/lib/auth-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { PAYROLL_PORTAL_URL } from '@/lib/payroll';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type WorkerRequest = {
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
    city?: string | null;
    state?: string | null;
    startTimeLabel?: string;
    endTimeLabel?: string;
    address?: string;
    specialInstructions?: string | null;

  };
};

export default function WorkerRequestsPage() {
  const [items, setItems] = useState<WorkerRequest[]>([]);
  const [message, setMessage] = useState('Loading requests...');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await meRequest();
        const professionalId = me.data.professionalId ?? null;

        if (!professionalId) {
          setMessage('You must be signed in as a professional.');
          return;
        }

        const res = await apiFetch<{ data: WorkerRequest[] }>(
          `/api/worker/requests?professionalId=${professionalId}`
        );

        setItems(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load requests');
      }
    }

    load();
  }, []);
async function requestCancellation(requestId: string) {
  const reason = window.prompt('Reason for requesting cancellation?')?.trim();

  if (!reason) {
    setMessage('Cancellation reason is required.');
    return;
  }

  try {
    setBusyId(requestId);
    setMessage('');

    const res = await fetch(
      `${STAFFING_API_BASE_URL}/api/shift-requests/${requestId}/request-cancellation`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      }
    );

    const text = await res.text();

    if (!res.ok) {
      throw new Error(text || 'Failed to request cancellation');
    }

    const me = await meRequest();
    const professionalId = me.data.professionalId ?? null;

    if (!professionalId) {
      throw new Error('You must be signed in as a professional.');
    }

    const refreshed = await apiFetch<{ data: WorkerRequest[] }>(
      `/api/worker/requests?professionalId=${professionalId}`
    );

    setItems(refreshed.data);
    setMessage('Cancellation request sent to the facility for review.');
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Failed to request cancellation';
    setMessage(text.includes('within 4 hours') ? 'Cancellation is locked within 4 hours of shift start. Please contact Wezen Staffing support.' : text);
  } finally {
    setBusyId(null);
  }
}

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          My Requests
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Track your requested, approved, and rejected shifts
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review the latest status of your shift requests and see which opportunities have been approved by facilities.
        </p>
      </div>

       <div className="flex justify-end">
  <a
    href={PAYROLL_PORTAL_URL}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
  >
    Payroll Portal ↗
  </a>
</div>      

      {message && items.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((request) => (
            <div
              key={request.id}
              className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-2xl font-bold tracking-tight text-slate-950">
                      {request.shift.role} • {request.shift.shiftType}
                    </div>
                    <StatusBadge
                      label={request.status}
                      tone={
                        request.status === 'APPROVED'
                          ? 'success'
                          : request.status === 'REJECTED' || request.status === 'CANCELLED'
                            ? 'danger'
                            : 'warning'
                      }
                    />
                  </div>

                  <div className="mt-3 text-lg font-semibold text-slate-800">
                    {request.shift.facilityName}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {request.shift.city || 'Unknown city'}
                    {request.shift.state ? `, ${request.shift.state}` : ''}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {new Date(request.shift.date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Time
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {request.shift.time}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Requested
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {new Date(request.requestedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

              <div className="w-full lg:w-64">
  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
    <div className="font-semibold text-slate-900">Current status</div>

    <div className="mt-2">
      {request.status === 'APPROVED' ? (
        <div className="mt-4 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Approved Shift
          </div>

          <div className="mt-2 text-lg font-bold">
            {request.shift.facilityName}
          </div>

          <div className="mt-2 text-sm text-emerald-900">
            {new Date(request.shift.date).toLocaleDateString()} • {request.shift.time}
          </div>

          {request.shift.address ? (
            <div className="mt-2 text-sm text-emerald-800">
              Address: {request.shift.address}
            </div>
          ) : null}

          {request.shift.specialInstructions ? (
            <div className="mt-2 text-sm text-emerald-800">
              Notes: {request.shift.specialInstructions}
            </div>
          ) : null}

          <div className="mt-4">
            <button
              type="button"
              onClick={() => requestCancellation(request.id)}
              disabled={busyId === request.id || String(request.reviewNotes || '').includes('Cancellation denied by facility')}
              className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {String(request.reviewNotes || '').includes('Cancellation denied by facility') ? 'Cancellation Denied' : busyId === request.id ? 'Submitting...' : 'Request Cancellation'}
            </button>
            {String(request.reviewNotes || '').includes('Cancellation denied by facility') ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                Facility denied this cancellation request. Please contact Wezen Staffing support if you need further help.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {request.status === 'CANCELLATION_REQUESTED' ? (
        <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-700">
            Cancellation Requested
          </div>
          <div className="mt-2 text-sm">
            Your cancellation request has been sent to the facility and is awaiting review.
          </div>
        </div>
      ) : null}

      {request.status === 'CANCELLED' ? (
        <div className="mt-4 rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4 text-rose-900">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-700">
            Shift / Cancellation Closed
          </div>
          <div className="mt-2 text-sm">
            If this was a cancellation request, you have been released from the shift.
          </div>
        </div>
      ) : null}

      {request.status === 'REJECTED' ? (
        <div className="mt-2">
          This facility rejected your request.
        </div>
      ) : null}

      {(request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW') ? (
        <div className="mt-2">
          This request is still under review.
        </div>
      ) : null}
    </div>
  </div>
</div>

		</div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
