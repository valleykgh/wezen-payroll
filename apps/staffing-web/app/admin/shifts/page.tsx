'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { meRequest, type AuthMeResponse } from '@/lib/auth-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type AdminShift = {
  id: string;
  facilityId: string;
  facilityName: string;
  facilityCity?: string | null;
  facilityState?: string | null;
  role: string;
  shiftType: string;
  date: string;
  startTimeLabel: string;
  endTimeLabel: string;
  workersNeeded: number;
  status: string;
  requestCount: number;
  payRateLabel: string;
};
function formatShiftDate(dateValue: string) {
  const dateOnly = dateValue.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}
export default function AdminShiftsPage() {
  const [shifts, setShifts] = useState<AdminShift[]>([]);
  const [message, setMessage] = useState('Loading shifts...');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthMeResponse['data'] | null>(null);

  async function load() {
    const res = await apiFetch<{ data: AdminShift[] }>('/api/admin/shifts');
    setShifts(res.data);
  }

  const isDefaultAdmin = currentUser?.email?.toLowerCase() === 'admin@wezenstaffing.com';

  useEffect(() => {
    meRequest().then((res) => setCurrentUser(res.data)).catch(() => setCurrentUser(null));
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
      }
    }

    init();
  }, []);

    async function cancelShift(shiftId: string) {
    const reason = window.prompt('Enter a reason for cancelling this shift:');

    if (!reason || reason.trim().length < 3) {
      return;
    }

    try {
      setBusyId(shiftId);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/shifts/${shiftId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: reason.trim(),
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to cancel shift');
      }

      await load();
      setMessage('Shift cancelled successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to cancel shift');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteShift(shiftId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete this shift? This cannot be undone.'
    );

    if (!confirmed) return;

    try {
      setBusyId(shiftId);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/shifts/${shiftId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to delete shift');
      }

      await load();
      setMessage('Shift deleted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete shift');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Shift controls
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Cancel or delete shifts when facility owners are unavailable or contract conditions require admin override.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {shifts.map((shift) => (
          <div
            key={shift.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-bold tracking-tight text-slate-950">
                    {shift.role} • {shift.shiftType}
                  </div>

                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {shift.status}
                  </div>

                  <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    {shift.payRateLabel}
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold text-slate-900">
                  {shift.facilityName}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {shift.facilityCity || 'Unknown city'}
                  {shift.facilityState ? `, ${shift.facilityState}` : ''}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                    {formatShiftDate(shift.date)}
		    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {shift.startTimeLabel} - {shift.endTimeLabel}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Workers needed
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {shift.workersNeeded}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Requests
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {shift.requestCount}
                    </div>
                  </div>
                </div>
              </div>

              {isDefaultAdmin ? (
                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <button
                    onClick={() => cancelShift(shift.id)}
                    disabled={busyId === shift.id || shift.status === 'CANCELLED'}
                    className="inline-flex items-center justify-center rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:opacity-60"
                  >
                    {busyId === shift.id ? 'Working...' : 'Cancel Shift'}
                  </button>

                  <button
                    onClick={() => deleteShift(shift.id)}
                    disabled={busyId === shift.id}
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyId === shift.id ? 'Working...' : 'Delete Shift'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {shifts.length === 0 && !message ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No shifts found.
        </div>
      ) : null}
    </div>
  );
}
