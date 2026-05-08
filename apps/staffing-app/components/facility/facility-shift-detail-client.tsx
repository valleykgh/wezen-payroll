'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ShiftDetail = {
  id: string;
  role: string;
  shiftType: string;
  date: string;
  time: string;
  workersNeeded: number;
  fillCount: number;
  pendingCount: number;
  rejectedCount: number;
  fillLabel: string;
  status: string;
  payRateLabel: string;
  specialInstructions?: string | null;
  declinedInvitations?: Array<{
    id: string;
    respondedAt?: string | null;
    message?: string | null;
    professional: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      role: string;
      city?: string | null;
      state?: string | null;
    };
  }>;
  applicants: Array<{
    id: string;
    status: string;
    requestedAt: string;
    reviewedAt?: string | null;
    professional: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      role: string;
      city?: string | null;
      state?: string | null;
      approvedDocCount: number;
      pendingDocCount: number;
      rejectedDocCount: number;
      expiredDocCount: number;
    };
  }>;
};

export function FacilityShiftDetailClient({ shiftId }: { shiftId: string }) {
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function loadShift() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: ShiftDetail }>(`/api/facility/shifts/${shiftId}`);
      setDetail(res.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shift detail');
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(requestId: string, action: 'approve' | 'reject' | 'no-show') {
    setBusyId(requestId);
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

      await apiFetch(`/api/shift-requests/${requestId}/${action}`, {
        method: 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      setMessage(
        action === 'approve'
          ? 'Applicant approved.'
          : action === 'reject'
            ? 'Applicant rejected.'
            : 'Worker marked no-show.'
      );
      await loadShift();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update applicant');
    } finally {
      setBusyId('');
    }
  }
  async function updateCancellation(requestId: string, action: 'approve-cancellation' | 'deny-cancellation') {
    setBusyId(requestId);
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

      await apiFetch(`/api/shift-requests/${requestId}/${action}`, {
        method: 'POST',
        ...(reason ? { body: JSON.stringify({ reason }) } : {}),
      });

      setMessage(
        action === 'approve-cancellation'
          ? 'Cancellation approved. Worker released from shift.'
          : 'Cancellation denied. Worker remains scheduled.'
      );

      await loadShift();
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
    loadShift();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shiftId]);

  if (loading) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Loading shift...</div>;
  }

  if (!detail) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Shift not found.</div>;
  }

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
          {detail.role} • {detail.shiftType}
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">
          {new Date(detail.date).toLocaleDateString()} • {detail.time}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{detail.status} • {detail.fillLabel}</p>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold text-slate-950">{detail.applicants.length}</p>
            <p className="text-slate-500">Applicants</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold text-slate-950">{detail.pendingCount}</p>
            <p className="text-slate-500">Pending</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="font-bold text-slate-950">{detail.payRateLabel}</p>
            <p className="text-slate-500">Rate</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        {detail.declinedInvitations && detail.declinedInvitations.length > 0 ? (
          <div className="mb-5 rounded-3xl border border-rose-200 bg-rose-50 p-4">
            <h3 className="text-lg font-extrabold text-rose-950">Declined invitations</h3>
            <p className="mt-1 text-sm font-semibold text-rose-800">
              These workers declined this shift invitation.
            </p>

            <div className="mt-4 grid gap-3">
              {detail.declinedInvitations.map((invite) => {
                const workerName =
                  [invite.professional.firstName, invite.professional.lastName]
                    .filter(Boolean)
                    .join(' ') || invite.professional.email;

                return (
                  <div key={invite.id} className="rounded-2xl bg-white p-4 ring-1 ring-rose-100">
                    <div className="font-extrabold text-slate-950">{workerName}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-600">
                      {invite.professional.role} • {invite.professional.email}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {[invite.professional.city, invite.professional.state].filter(Boolean).join(', ') || 'Location not listed'}
                    </div>
                    {invite.respondedAt ? (
                      <div className="mt-2 text-xs font-extrabold text-rose-700">
                        Declined: {new Date(invite.respondedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <h3 className="text-lg font-bold text-slate-950">Applicants</h3>

        <div className="mt-4 grid gap-3">
          {detail.applicants.length === 0 ? (
            <p className="text-sm text-slate-600">No applicants yet.</p>
          ) : null}

          {detail.applicants.map((request) => {
            const name =
              [request.professional.firstName, request.professional.lastName].filter(Boolean).join(' ') ||
              request.professional.email;

            return (
              <div key={request.id} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">{name}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {request.professional.role} • {request.professional.email}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Approved docs: {request.professional.approvedDocCount}
                    </p>
                  </div>

                  <span className="rounded-full bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                    {request.status}
                  </span>
                </div>

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
                ) : request.status !== 'APPROVED' && request.status !== 'REJECTED' && request.status !== 'CANCELLED' && request.status !== 'NO_SHOW' ? (
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

                {request.status === 'APPROVED' ? (
                  <button
                    type="button"
                    onClick={() => updateRequest(request.id, 'no-show')}
                    disabled={busyId === request.id}
                    className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Mark No-Show'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
