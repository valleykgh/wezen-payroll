'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type ShiftDetail = {
  id: string;
  facilityId: string;
  facilityName: string;
  role: string;
  shiftType: string;
  date: string;
  time: string;
  workersNeeded: number;
  fillCount: number;
  pendingCount?: number;
  rejectedCount?: number;
  fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED';
  fillLabel: string;
  status: string;
  payRateLabel: string;
  specialInstructions?: string | null;
  applicants: Array<{
    id: string;
    status: string;
    requestedAt: string;
    reviewedAt?: string | null;
    professional: {
      id: string;
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

export default function FacilityShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const [shiftId, setShiftId] = useState('');
  const [detail, setDetail] = useState<ShiftDetail | null>(null);
  const [message, setMessage] = useState('Loading shift detail...');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  async function load(id: string) {
    const res = await apiFetch<{ data: ShiftDetail }>(`/api/facility/shifts/${id}`);
    setDetail(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        const resolved = await params;
        setShiftId(resolved.shiftId);
        await load(resolved.shiftId);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shift detail');
      }
    }

    init();
  }, [params]);

  async function updateRequest(requestId: string, action: 'approve' | 'reject') {
    try {
      setBusyId(requestId);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shift-requests/${requestId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to ${action} request`);
      }

      if (shiftId) {
        await load(shiftId);
      }

      setMessage(
        action === 'approve'
          ? 'Applicant approved successfully.'
          : 'Applicant rejected successfully.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update applicant');
    } finally {
      setBusyId(null);
    }
  }

  async function updateShift(action: 'close' | 'reopen' | 'cancel') {
    try {
      if (!shiftId) return;

      setActionBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts/${shiftId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(text || `Failed to ${action} shift`);
      }

      await load(shiftId);

      setMessage(
        action === 'close'
          ? 'Shift closed successfully.'
          : action === 'reopen'
            ? 'Shift reopened successfully.'
            : 'Shift cancelled successfully.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update shift');
    } finally {
      setActionBusy(false);
    }
  }

  if (!detail) {
    return (
      <div className="space-y-8">
        <div className="page-gradient rounded-[2rem] p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Shift Detail
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Review shift staffing
          </h1>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Shift Detail
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {detail.role} • {detail.shiftType}
            </h1>
            <p className="mt-2 text-slate-600">
              {new Date(detail.date).toLocaleDateString()} • {detail.time}
            </p>
          </div>

          <Link
            href="/facility/shifts"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Back to Shifts
          </Link>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Shift Status
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{detail.status}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fill Status
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{detail.fillStatus}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Filled
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{detail.fillCount}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Workers Needed
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{detail.workersNeeded}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {detail.status === 'OPEN' ? (
          <>
            <button
              onClick={() => updateShift('close')}
              disabled={actionBusy}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {actionBusy ? 'Working...' : 'Close Shift'}
            </button>

            <button
              onClick={() => updateShift('cancel')}
              disabled={actionBusy}
              className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
            >
              {actionBusy ? 'Working...' : 'Cancel Shift'}
            </button>
          </>
        ) : (
          <button
            onClick={() => updateShift('reopen')}
            disabled={actionBusy}
            className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
          >
            {actionBusy ? 'Working...' : 'Reopen Shift'}
          </button>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Applicant queue
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Review all applicants for this shift only.
          </p>

          <div className="mt-6 space-y-4">
            {detail.applicants.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                No applicants for this shift yet.
              </div>
            ) : (
              detail.applicants.map((request) => {
                const fullName =
                  [request.professional.firstName, request.professional.lastName]
                    .filter(Boolean)
                    .join(' ') || 'Unnamed professional';

                return (
                  <div
                    key={request.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="text-lg font-bold text-slate-950">{fullName}</div>
                          <StatusBadge
                            label={request.status}
                            tone={
                              request.status === 'APPROVED'
                                ? 'success'
                                : request.status === 'REJECTED'
                                  ? 'danger'
                                  : 'warning'
                            }
                          />
                          <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {request.professional.role}
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-slate-600">
                          {request.professional.email}
                        </div>

                        <div className="mt-1 text-sm text-slate-500">
                          {request.professional.city || 'Unknown city'}
                          {request.professional.state ? `, ${request.professional.state}` : ''}
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
                          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Approved: {request.professional.approvedDocCount}
                          </div>
                          <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
                            Pending: {request.professional.pendingDocCount}
                          </div>
                          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            Rejected: {request.professional.rejectedDocCount}
                          </div>
                          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            Expired: {request.professional.expiredDocCount}
                          </div>
                        </div>
                      </div>

                      <div className="flex w-full flex-col gap-3 lg:w-56">
                        <Link
                          href={`/facility/applicants/${request.id}`}
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          Review Applicant
                        </Link>

                        <button
                          onClick={() => updateRequest(request.id, 'approve')}
                          disabled={busyId === request.id || request.status === 'APPROVED' || detail.status !== 'OPEN'}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busyId === request.id ? 'Working...' : 'Approve'}
                        </button>

                        <button
                          onClick={() => updateRequest(request.id, 'reject')}
                          disabled={busyId === request.id || request.status === 'REJECTED' || detail.status !== 'OPEN'}
                          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                        >
                          {busyId === request.id ? 'Working...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Coverage Progress
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">{detail.fillLabel}</div>
            <div className="mt-2 text-cyan-50">
              Approved workers count toward actual coverage.
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Shift Notes
            </h2>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              {detail.specialInstructions || 'No special instructions added for this shift.'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
