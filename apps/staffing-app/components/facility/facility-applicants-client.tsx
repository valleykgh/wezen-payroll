'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type FacilityRequest = {
  id: string;
  status: string;
  requestedAt: string;
  reviewNotes?: string | null;
  shift: {
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
    city: string | null;
    state: string | null;
  };
  professional: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: string;
    city: string | null;
    state: string | null;
  };
};

export function FacilityApplicantsClient() {
  const [requests, setRequests] = useState<FacilityRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function loadRequests() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: FacilityRequest[] }>('/api/facility/requests');
      setRequests(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }

  async function sendApplicantMessage(id: string) {
    const subject = window.prompt('Message subject?')?.trim();
    if (!subject) return;

    const body = window.prompt('Message to applicant?')?.trim();
    if (!body) return;

    setBusyId(id);
    setMessage('');

    try {
      await apiFetch(`/api/facility/applicants/${id}/message`, {
        method: 'POST',
        body: JSON.stringify({ subject, message: body }),
      });

      setMessage('Message sent to applicant by email and app notification.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setBusyId('');
    }
  }

  async function updateRequest(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
    setMessage('');

    try {
      const reason =
        action === 'reject'
          ? window.prompt('Please enter the reason for rejecting this applicant:')?.trim()
          : undefined;

      if (action === 'reject' && !reason) {
        setMessage('Rejection reason is required.');
        return;
      }

      const body =
        action === 'approve'
          ? undefined
          : reason
            ? { reason }
            : undefined;

      await apiFetch(`/api/shift-requests/${id}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setMessage(action === 'approve' ? 'Applicant approved.' : 'Applicant rejected.');
      await loadRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} applicant`);
    } finally {
      setBusyId('');
    }
  }
  async function updateCancellation(id: string, action: 'approve-cancellation' | 'deny-cancellation') {
    setBusyId(id);
    setMessage('');

    try {
      const reason =
        action === 'deny-cancellation'
          ? window.prompt('Please enter the reason for denying this cancellation request:')?.trim()
          : undefined;

      if (action === 'deny-cancellation' && !reason) {
        setMessage('Denial reason is required.');
        return;
      }

      await apiFetch(`/api/shift-requests/${id}/${action}`, {
        method: 'POST',
        ...(reason ? { body: JSON.stringify({ reason }) } : {}),
      });

      setMessage(
        action === 'approve-cancellation'
          ? 'Cancellation approved. Worker released from shift.'
          : 'Cancellation denied. Worker remains scheduled.'
      );

      await loadRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update cancellation request');
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
          Loading applicants...
        </div>
      ) : null}

      {!loading && requests.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No applicants yet.
        </div>
      ) : null}

      {requests.map((request) => {
        const workerName =
          [request.professional.firstName, request.professional.lastName].filter(Boolean).join(' ') ||
          request.professional.email ||
          'Unknown worker';

        return (
          <div key={request.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {request.professional.role}
                </p>
                <Link href={`/app/facility/applicant-detail/index.html?requestId=${request.id}`} className="mt-2 block text-lg font-bold text-slate-950 underline decoration-slate-300 underline-offset-4">{workerName}</Link>
                <p className="mt-1 text-sm text-slate-600">{request.professional.email}</p>
              </div>

              <span
                className={
                  request.status === 'CANCELLATION_REQUESTED'
                    ? 'rounded-full bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800'
                    : request.status === 'REJECTED'
                      ? 'rounded-full bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800'
                      : 'rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700'
                }
              >
                {request.status === 'CANCELLATION_REQUESTED'
                  ? 'CANCEL REQUEST'
                  : request.reviewNotes?.startsWith('Cancellation denied')
                    ? 'CANCEL DENIED'
                    : request.status}
              </span>
            </div>

            {request.reviewNotes ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <span className="font-bold">
                  {request.reviewNotes.startsWith('Cancellation') ? 'Cancellation note: ' : 'Reason: '}
                </span>
                {request.reviewNotes}
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Shift</p>
                <p className="font-bold text-slate-950">
                  {request.shift.role} • {request.shift.shiftType}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Date</p>
                <p className="font-bold text-slate-950">
                  {new Date(request.shift.date).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Time</p>
                <p className="font-bold text-slate-950">{request.shift.time}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Location</p>
                <p className="font-bold text-slate-950">
                  {[request.shift.city, request.shift.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => sendApplicantMessage(request.id)}
              disabled={busyId === request.id}
              className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busyId === request.id ? 'Working...' : 'Send Message'}
            </button>

            {request.status === 'CANCELLATION_REQUESTED' ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-bold text-amber-900">
                  Worker requested cancellation. Approve to release them, or deny to keep them scheduled.
                </p>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updateCancellation(request.id, 'approve-cancellation')}
                    disabled={busyId === request.id}
                    className="rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Approve Cancel'}
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCancellation(request.id, 'deny-cancellation')}
                    disabled={busyId === request.id}
                    className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Deny Cancel'}
                  </button>
                </div>
              </div>
            ) : request.status !== 'APPROVED' && request.status !== 'REJECTED' && request.status !== 'CANCELLED' ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateRequest(request.id, 'approve')}
                  disabled={busyId === request.id}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyId === request.id ? 'Working...' : 'Approve'}
                </button>

                <button
                  type="button"
                  onClick={() => updateRequest(request.id, 'reject')}
                  disabled={busyId === request.id}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyId === request.id ? 'Working...' : 'Reject'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
