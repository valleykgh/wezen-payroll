'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type WorkerShift = {
  id: string;
  role: 'CNA' | 'LVN' | 'RN';
  facilityName: string;
  city: string | null;
  state: string | null;
  distanceMiles: number | null;
  shiftType: 'AM' | 'PM' | 'NOC';
  date: string;
  time: string;
  payRateLabel: string;
  workersNeeded: number;
  fillLabel: string;
  pendingCount?: number | null;
  status: string;
  isBlockedByFacilityDnr: boolean;
  blockReason: string | null;
  specialInstructions?: string | null;
};

type ShiftDetail = WorkerShift & {
  startTimeLabel?: string;
  endTimeLabel?: string;
};

export function WorkerShiftsClient() {
  const [shifts, setShifts] = useState<WorkerShift[]>([]);
  const [role, setRole] = useState('');
  const [shiftType, setShiftType] = useState('');
  const [radius, setRadius] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState('');
  const [message, setMessage] = useState('');
  const [requestedShiftIds, setRequestedShiftIds] = useState<string[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [shiftDetail, setShiftDetail] = useState<ShiftDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) || null,
    [shifts, selectedShiftId]
  );

  async function loadShifts() {
    setLoading(true);
    setMessage('');

    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (shiftType) params.set('shiftType', shiftType);
    if (radius) params.set('radius', radius);
    if (location.trim()) params.set('location', location.trim());

    try {
      const res = await apiFetch<{ data: WorkerShift[] }>(
        `/api/worker/shifts${params.toString() ? `?${params.toString()}` : ''}`
      );
      setShifts(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }

  async function loadShiftDetail(shiftId: string) {
    setDetailLoading(true);
    setDetailError('');
    setShiftDetail(null);

    try {
      const res = await apiFetch<{ data: ShiftDetail }>(`/api/worker/shifts/${shiftId}`);
      setShiftDetail(res.data);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to load shift details');
    } finally {
      setDetailLoading(false);
    }
  }

  async function requestShift(shiftId: string) {
    setRequestingId(shiftId);
    setMessage('');

    try {
      await apiFetch('/api/shift-requests', {
        method: 'POST',
        body: JSON.stringify({ shiftId }),
      });

      setRequestedShiftIds((current) =>
        current.includes(shiftId) ? current : [...current, shiftId]
      );

      setMessage('Shift request sent. The facility will review it.');
      setSelectedShiftId(null);
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Failed to request shift';

      if (text.includes('Unique constraint') || text.includes('P2002') || text.includes('already')) {
        setRequestedShiftIds((current) =>
          current.includes(shiftId) ? current : [...current, shiftId]
        );
        setMessage('You already requested this shift. The facility will review it.');
      } else {
        setMessage(text);
      }
    } finally {
      setRequestingId('');
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDetails(shiftId: string) {
    setSelectedShiftId(shiftId);
    loadShiftDetail(shiftId);
  }

  const detail = shiftDetail || selectedShift;

  return (
    <div className="grid gap-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Search facility, city, state, zip"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500"
          />

          <div className="grid grid-cols-3 gap-2">
            <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
              <option value="">Title</option>
              <option value="CNA">CNA</option>
              <option value="LVN">LVN</option>
              <option value="RN">RN</option>
            </select>

            <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
              <option value="">Shift</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="NOC">NOC</option>
            </select>

            <select value={radius} onChange={(e) => setRadius(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
              <option value="">Miles</option>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>

          <button type="button" onClick={loadShifts} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Search shifts
          </button>
        </div>
      </div>

      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-md -translate-x-1/2 -translate-y-1/2 whitespace-pre-line rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading shifts...
        </div>
      ) : null}

      {!loading && shifts.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No open shifts found.
        </div>
      ) : null}

      {shifts.map((shift) => (
        <div key={shift.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                {shift.role} • {shift.shiftType}
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">{shift.facilityName}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {[shift.city, shift.state].filter(Boolean).join(', ') || 'Location not listed'}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-100 px-3 py-2 text-right">
              <p className="text-xs text-slate-500">Distance</p>
              <p className="text-sm font-bold text-slate-950">
                {shift.distanceMiles == null ? '—' : `${shift.distanceMiles} mi`}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Info label="Date" value={new Date(shift.date).toLocaleDateString()} />
            <Info label="Time" value={shift.time} />
            <Info label="Rate" value={shift.payRateLabel} />
            <Info label="Filled" value={shift.fillLabel} />
          </div>

          {shift.isBlockedByFacilityDnr ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {shift.blockReason || 'You cannot request shifts from this facility.'}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => openDetails(shift.id)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-900"
              >
                View Details
              </button>

              <button
                type="button"
                onClick={() => requestShift(shift.id)}
                disabled={requestingId === shift.id || requestedShiftIds.includes(shift.id)}
                className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {requestedShiftIds.includes(shift.id)
                  ? 'Request sent'
                  : requestingId === shift.id
                    ? 'Requesting...'
                    : 'Request'}
              </button>
            </div>
          )}
        </div>
      ))}

      {selectedShiftId ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/60 p-3">
          <div className="max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-700">
                  Shift Details
                </p>
                <h2 className="mt-2 text-2xl font-extrabold text-slate-950">
                  {detailLoading ? 'Loading...' : detail ? `${detail.role} • ${detail.shiftType}` : 'Shift'}
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">
                  {detail?.facilityName || ''}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShiftId(null)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-bold text-slate-900"
              >
                Close
              </button>
            </div>

            {detailError ? (
              <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">
                {detailError}
              </div>
            ) : null}

            {detail ? (
              <div className="mt-5 grid gap-3">
                <Info label="Facility" value={detail.facilityName} />
                <Info label="Location" value={[detail.city, detail.state].filter(Boolean).join(', ') || 'Location not listed'} />
                <Info label="Date" value={new Date(detail.date).toLocaleDateString()} />
                <Info label="Time" value={detail.time} />
                <Info label="Pay Rate" value={detail.payRateLabel} />
                <Info label="Filled" value={detail.fillLabel} />
                <Info label="Pending Requests" value={String(detail.pendingCount ?? 0)} />
                <Info label="Special Instructions" value={detail.specialInstructions?.trim() || 'No special instructions provided.'} />

                <button
                  type="button"
                  onClick={() => requestShift(detail.id)}
                  disabled={requestingId === detail.id || requestedShiftIds.includes(detail.id) || detail.isBlockedByFacilityDnr}
                  className="mt-2 rounded-2xl bg-cyan-600 px-5 py-4 text-base font-extrabold text-white disabled:opacity-60"
                >
                  {requestedShiftIds.includes(detail.id)
                    ? 'Request sent'
                    : requestingId === detail.id
                      ? 'Requesting...'
                      : 'Request Shift'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-slate-950">{value}</p>
    </div>
  );
}
