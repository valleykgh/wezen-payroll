'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
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
        throw new Error(text || `Failed to ${action} applicant`);
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

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
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

                {request.status !== 'APPROVED' ? (
                  <button
                    onClick={() => updateRequest(request.id, 'approve')}
                    disabled={busyId === request.id}
                    className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Approve'}
                  </button>
                ) : null}

                {request.status !== 'REJECTED' ? (
                  <button
                    onClick={() => updateRequest(request.id, 'reject')}
                    disabled={busyId === request.id}
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Reject'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
