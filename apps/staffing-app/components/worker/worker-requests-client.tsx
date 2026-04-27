'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

function requestStatusLabel(status: string, notes?: string | null) {
  if (status === 'CANCELLATION_REQUESTED') return 'CANCELLATION PENDING';
  if (status === 'CANCELLED' && notes?.startsWith('Cancellation approved')) return 'CANCELLATION APPROVED';
  if (status === 'APPROVED' && notes?.startsWith('Cancellation denied')) return 'CANCELLATION DENIED';
  if (status === 'REJECTED') return 'SHIFT REJECTED';
  if (status === 'APPROVED') return 'SHIFT APPROVED';
  return status;
}

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
  };
};

export function WorkerRequestsClient() {
  const [requests, setRequests] = useState<WorkerRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function loadRequests() {
    setLoading(true);
    setMessage('');

    try {
      const me = await apiFetch<{ data: { professionalId?: string | null } }>('/api/auth/me');
      const professionalId = me.data.professionalId || '';

      if (!professionalId) {
        setMessage('Professional profile not found.');
        setRequests([]);
        return;
      }

      const res = await apiFetch<{ data: WorkerRequest[] }>(
        `/api/worker/requests?professionalId=${encodeURIComponent(professionalId)}`
      );
      setRequests(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }

  async function requestCancellation(requestId: string) {
    const reason = window.prompt('Reason for requesting cancellation?')?.trim();

    if (!reason) {
      setMessage('Cancellation reason is required.');
      return;
    }

    setBusyId(requestId);
    setMessage('');

    try {
      await apiFetch(`/api/shift-requests/${requestId}/request-cancellation`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      setMessage('Cancellation request sent to facility.');
      await loadRequests();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to request cancellation';

      if (text.includes('within 4 hours')) {
        setMessage('Cancellation is locked within 4 hours of shift start. Please contact Wezen Staffing support.');
      } else {
        setMessage(text);
      }
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading requests...
        </div>
      ) : null}

      {!loading && requests.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No shift requests yet.
        </div>
      ) : null}

      {requests.map((request) => (
        <div key={request.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                {request.shift.role} • {request.shift.shiftType}
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">
                {request.shift.facilityName}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {new Date(request.shift.date).toLocaleDateString()} • {request.shift.time}
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
              {requestStatusLabel(request.status, request.reviewNotes)}
            </span>
          </div>

          {request.reviewNotes ? (
            <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-200">
              {request.reviewNotes}
            </div>
          ) : null}

          {request.status === 'APPROVED' ? (
            <button
              type="button"
              onClick={() => requestCancellation(request.id)}
              disabled={busyId === request.id}
              className="mt-4 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busyId === request.id ? 'Sending...' : 'Request Cancellation'}
            </button>
          ) : null}

          {request.status === 'CANCELLATION_REQUESTED' ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
              Cancellation pending facility review.
            </div>
          ) : null}

          {request.status === 'CANCELLED' && request.reviewNotes?.startsWith('Cancellation approved') ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
              Cancellation approved. You have been released from this shift.
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
