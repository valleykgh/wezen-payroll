'use client';

import { formatApiErrorText } from '@/lib/api-client';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type Shift = {
  id: string;
  role: string;
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

type ShiftDetail = {
  id: string;
  facilityId?: string;
  facilityName: string;
  city: string;
  state: string;
  role: string;
  shiftType: string;
  date: string;
  time: string;
  startTimeLabel: string;
  endTimeLabel: string;
  workersNeeded: number;
  fillCount: number;
  pendingCount?: number;
  fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED';
  fillLabel: string;
  status: string;
  payRateLabel: string;
  specialInstructions?: string;
};

type Props = {
  shifts: Shift[];
};

export function ShiftResultsClient({ shifts }: Props) {
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [requestedShiftIds, setRequestedShiftIds] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [eligible, setEligible] = useState<boolean>(false);
  const [eligibilityReasons, setEligibilityReasons] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [lastMessageShiftId, setLastMessageShiftId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/eligibility`, {
          credentials: 'include',
        });

        const data = await res.json();

        setEligible(Boolean(data?.data?.eligible));
        setEligibilityReasons(data?.data?.reasons || []);
      } catch {
        setEligible(false);
        setEligibilityReasons(['Unable to verify worker eligibility']);
      }
    }

    load();
  }, []);

  useEffect(() => {
    async function loadShiftDetail() {
      if (!selectedShiftId) {
        setShiftDetail(null);
        setDetailError('');
        return;
      }

      try {
        setDetailLoading(true);
        setDetailError('');

        const res = await fetch(
          `${STAFFING_API_BASE_URL}/api/worker/shifts/${selectedShiftId}`,
          {
            credentials: 'include',
          }
        );

        const text = await res.text();

        if (!res.ok) {
          throw new Error(formatApiErrorText(text, 'Failed to load shift details'));
        }

        const parsed = text ? JSON.parse(text) : null;
        setShiftDetail(parsed?.data ?? null);
      } catch (error) {
        setShiftDetail(null);
        setDetailError(
          error instanceof Error ? error.message : 'Failed to load shift details'
        );
      } finally {
        setDetailLoading(false);
      }
    }

    loadShiftDetail();
  }, [selectedShiftId]);

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? null,
    [shifts, selectedShiftId]
  );

  function normalizeRequestError(text: string) {
    if (text.includes('same shift type on the same day')) {
      return 'You already have an active request for this shift type on the same day.';
    }

    if (text.includes('already have an active request for this shift')) {
      return 'You already requested this shift.';
    }

    if (text.includes('restricted from requesting shifts at this facility')) {
      return 'You cannot request shifts from this facility.';
    }

    if (text.includes('no longer open')) {
      return 'This shift is no longer open.';
    }

    if (text.includes('not been approved by Wezen')) {
      return 'Your profile must be approved by Wezen before requesting shifts.';
    }

    if (text.includes('inactive')) {
      return 'This facility is no longer accepting shift requests.';
    }
    
    if (text.includes('fully assigned')) {
      return 'This shift is already fully assigned.';
    }

    try {
      const parsed = JSON.parse(text);
      return parsed.error || 'Failed to request shift.';
    } catch {
      return text || 'Failed to request shift.';
    }
  }

  async function requestShift(shiftId: string) {
    try {
      setSubmittingId(shiftId);
      setLastMessageShiftId(shiftId);
      setSuccessMessage('');
      setErrorMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shift-requests`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shiftId,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(normalizeRequestError(text));
      }

      setRequestedShiftIds((current) =>
        current.includes(shiftId) ? current : [...current, shiftId]
      );
      setSuccessMessage('Shift request sent. The facility will review and approve/reject it.');
    } catch (error) {
      const normalized = error instanceof Error ? error.message : 'Request failed.';
      if (normalized.toLowerCase().includes('already')) {
        setRequestedShiftIds((current) =>
          current.includes(shiftId) ? current : [...current, shiftId]
        );
      }
      setErrorMessage(normalized);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {successMessage || errorMessage ? (
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-xl -translate-x-1/2 -translate-y-1/2 whitespace-pre-line rounded-3xl border-2 border-red-700 bg-red-600 px-8 py-7 text-center text-xl font-extrabold text-white shadow-2xl">
            {successMessage || errorMessage}
            <button
              type="button"
              onClick={() => {
                setSuccessMessage('');
                setErrorMessage('');
              }}
              className="mt-5 block w-full rounded-full bg-white px-5 py-3 text-sm font-bold text-red-700"
            >
              OK
            </button>
          </div>
        ) : null}

        {!eligible && eligibilityReasons.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            <div className="font-semibold">You are not yet eligible to request shifts.</div>
            <ul className="mt-2 list-disc pl-5">
              {eligibilityReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        ) : null}


        {shifts.map((shift) => {
          const blocked = Boolean(shift.isBlockedByFacilityDnr);
          const isCurrentShift = lastMessageShiftId === shift.id;
	
	  return (
            <div
              key={shift.id}
              className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />

              <div className="p-6">
 		{successMessage && isCurrentShift ? (
  <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
    {successMessage}
  </div>
) : null}

{errorMessage && isCurrentShift ? (
  <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
    {errorMessage}
  </div>
) : null}
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-2xl font-bold tracking-tight text-slate-950">
                        {shift.role} • {shift.shiftType}
                      </div>
                      <StatusBadge label={shift.status} tone="info" />
                      <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {shift.payRateLabel}
                      </div>

                      {blocked ? (
                        <div className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          DNR Blocked
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-3 text-lg font-semibold text-slate-800">
                      {shift.facilityName}
                    </div>

		    <div className="mt-1 text-sm text-slate-500">
  {shift.city}, {shift.state}
  {typeof shift.distanceMiles === 'number'
    ? ` • ${shift.distanceMiles} miles away`
    : ''}
</div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Date
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {new Date(shift.date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Time
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {shift.time}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Filled
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {shift.fillLabel}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Pending
                        </div>
                        <div className="mt-1 text-sm font-medium text-slate-900">
                          {shift.pendingCount ?? 0}
                        </div>
                      </div>
                    </div>

                    {blocked ? (
                      <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {shift.blockReason || 'This facility has restricted future requests.'}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
                    <button
                      onClick={() => requestShift(shift.id)}
                      disabled={submittingId === shift.id || requestedShiftIds.includes(shift.id) || !eligible || blocked}
                      className="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {requestedShiftIds.includes(shift.id) ? 'Requested — Pending Approval' : submittingId === shift.id ? 'Submitting...' : 'Request Shift'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedShiftId(shift.id)}
                      className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                    >
                      View Details
                    </button>

                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      {blocked
                        ? 'This shift cannot be requested because this facility has blocked future requests.'
                        : 'Requesting shifts is enabled after Wezen approval, signed ICA, and required compliance documents.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedShiftId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[2rem] bg-white shadow-2xl">
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                    Shift Details
                  </div>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                    {detailLoading
                      ? 'Loading...'
                      : shiftDetail
                        ? `${shiftDetail.role} • ${shiftDetail.shiftType}`
                        : selectedShift
                          ? `${selectedShift.role} • ${selectedShift.shiftType}`
                          : 'Shift'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {shiftDetail?.facilityName || selectedShift?.facilityName || ''}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedShiftId(null)}
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  Loading shift details...
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
                  {detailError}
                </div>
              ) : shiftDetail ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Facility
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {shiftDetail.facilityName}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {shiftDetail.city}, {shiftDetail.state}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Time
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {shiftDetail.time}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Date
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {new Date(shiftDetail.date).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pay Rate
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {shiftDetail.payRateLabel}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Filled
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {shiftDetail.fillLabel}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pending Requests
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {shiftDetail.pendingCount ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Special Instructions
                    </div>
                    <div className="mt-1 text-sm text-slate-900">
                      {shiftDetail.specialInstructions?.trim()
                        ? shiftDetail.specialInstructions
                        : 'No special instructions provided for this shift.'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm text-slate-600">
                  No shift details available.
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedShiftId(null)}
                  className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const id = shiftDetail?.id || selectedShift?.id;
                    if (!id) return;
                    setSelectedShiftId(null);
                    requestShift(id);
                  }}
                  disabled={
                    !shiftDetail ||
                    submittingId === (shiftDetail?.id || selectedShift?.id || '') ||
                    requestedShiftIds.includes(shiftDetail?.id || selectedShift?.id || '') ||
                    !eligible
                  }
                  className="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submittingId === (shiftDetail?.id || selectedShift?.id || '')
                    ? 'Submitting...'
                    : requestedShiftIds.includes(shiftDetail?.id || selectedShift?.id || '')
                      ? 'Requested — Pending Approval'
                      : 'Request Shift'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
