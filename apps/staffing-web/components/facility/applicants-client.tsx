'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type FacilityRequest = {
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

type Props = {
  requests: FacilityRequest[];
};

export function ApplicantsClient({ requests }: Props) {
  const [items, setItems] = useState<FacilityRequest[]>(requests);
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setItems(requests);
  }, [requests]);

  async function updateCancellationRequest(requestId: string, action: 'approve-cancellation' | 'deny-cancellation') {
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

      setItems((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: action === 'approve-cancellation' ? 'CANCELLED' : 'APPROVED',
                reviewNotes:
                  action === 'approve-cancellation'
                    ? 'Cancellation approved by facility. Worker released from this shift.'
                    : `Cancellation denied by facility.${reason ? ` Reason: ${reason}` : ''}`,
              }
            : item
        )
      );

      router.refresh();

      setMessage(
        action === 'approve-cancellation'
          ? 'Cancellation approved. Worker released from shift.'
          : 'Cancellation denied. Worker remains scheduled.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update cancellation request');
    } finally {
      setBusyId('');
    }
  }

  async function sendApplicantMessage(requestId: string) {
    const subject = window.prompt('Message subject?')?.trim();
    if (!subject) return;

    const body = window.prompt('Message to applicant?')?.trim();
    if (!body) return;

    try {
      setBusyId(requestId);
      setMessage('');

      await apiFetch(`/api/facility/applicants/${requestId}/message`, {
        method: 'POST',
        body: JSON.stringify({ subject, message: body }),
      });

      setMessage('Message sent to applicant by email and app notification.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setBusyId(null);
    }
  }

  async function updateRequest(requestId: string, action: 'approve' | 'reject') {
    try {
      setBusyId(requestId);
      setMessage('');

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/shift-requests/${requestId}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(formatApiErrorText(text, `Failed to ${action} applicant`));
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: action === 'approve' ? 'APPROVED' : 'REJECTED',
              }
            : item
        )
      );

      setMessage(
        action === 'approve'
          ? 'Applicant approved successfully.'
          : 'Applicant rejected successfully.'
      );

      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : `Failed to ${action} applicant`
      );
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="space-y-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2 -translate-y-1/2 whitespace-pre-line rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No shift requests yet.
        </div>
      ) : null}

      {items.map((request) => {
        const fullName =
          [request.professional.firstName, request.professional.lastName]
            .filter(Boolean)
            .join(' ') || 'Unnamed professional';

        return (
          <div
            key={request.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-bold tracking-tight text-slate-950">
                    {fullName}
                  </div>

                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {request.status}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {request.professional.role} • {request.professional.email}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {request.professional.city || 'Unknown city'}
                  {request.professional.state ? `, ${request.professional.state}` : ''}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Facility
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.facilityName}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Shift
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.role} • {request.shift.shiftType}
                    </div>
                  </div>

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
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-56">
                <Link
                  href={`/facility/applicants/${request.id}`}
                  className="rounded-full border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Review Details
                </Link>

                <Link
                  href={`/facility/applicants/${request.id}#applicant-documents`}
                  className="rounded-full border border-cyan-300 bg-cyan-50 px-5 py-3 text-center text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  View / Download Documents
                </Link>

                <button
                  type="button"
                  onClick={() => sendApplicantMessage(request.id)}
                  disabled={busyId === request.id}
                  className="inline-flex items-center justify-center rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === request.id ? 'Working...' : 'Send Message'}
                </button>

                {request.status === 'CANCELLATION_REQUESTED' ? (
                  <>
                    <button
                      onClick={() => updateCancellationRequest(request.id, 'approve-cancellation')}
                      disabled={busyId === request.id}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === request.id ? 'Working...' : 'Approve Cancellation'}
                    </button>

                    <button
                      onClick={() => updateCancellationRequest(request.id, 'deny-cancellation')}
                      disabled={busyId === request.id}
                      className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === request.id ? 'Working...' : 'Deny Cancellation'}
                    </button>
                  </>
                ) : (
                  <>
                    {request.status !== 'APPROVED' && request.status !== 'CANCELLED' ? (
                      <button
                        onClick={() => updateRequest(request.id, 'approve')}
                        disabled={busyId === request.id}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === request.id ? 'Working...' : 'Approve'}
                      </button>
                    ) : null}

                    {request.status !== 'REJECTED' && request.status !== 'CANCELLED' ? (
                      <button
                        onClick={() => updateRequest(request.id, 'reject')}
                        disabled={busyId === request.id}
                        className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {busyId === request.id ? 'Working...' : 'Reject'}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
