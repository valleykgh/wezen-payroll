'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';
import { meRequest } from '@/lib/auth-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type Shift = {
  id: string;
  role: string;
  facilityId?: string;
  facilityName: string;
  city: string;
  state: string;
  distanceMiles: number;
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
};

type SortValue = 'date-asc' | 'date-desc' | 'most-requested';

function formatShiftDate(dateValue: string) {
  const dateOnly = dateValue.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

export default function FacilityShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading shifts...');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [shiftTypeFilter, setShiftTypeFilter] = useState('ALL');
  const [fillFilter, setFillFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortValue>('date-asc');
  const [selectedShiftIds, setSelectedShiftIds] = useState<string[]>([]);
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  async function loadShifts(currentFacilityId?: string | null) {
    try {
      if (!currentFacilityId) return;

      const res = await apiFetch<{ data: Shift[] }>(
        `/api/shifts?facilityId=${currentFacilityId}`
      );

      setShifts(res.data || []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
    }
  }

  useEffect(() => {
    async function init() {
      try {
        const me = await meRequest();
	const id = me.data.facilityId ?? null;
	setFacilityId(id);
        await loadShifts(id);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
      }
    }

    init();
  }, []);

  function toggleSelectedShift(id: string) {
    setSelectedShiftIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  function selectAllVisibleShifts() {
    setSelectedShiftIds(filteredShifts.map((shift) => shift.id));
  }

  function clearSelectedShifts() {
    setSelectedShiftIds([]);
  }

  async function deleteSelectedShifts() {
    if (selectedShiftIds.length === 0) {
      setMessage('Please select at least one shift to delete.');
      return;
    }

    if (!window.confirm(`Delete ${selectedShiftIds.length} selected shift${selectedShiftIds.length === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }

    try {
      setBusyId('bulk-delete');
      setMessage('');

      for (const id of selectedShiftIds) {
        const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts/${id}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const text = await res.text();

        if (!res.ok) {
          throw new Error(formatApiErrorText(text, 'Failed to delete one or more selected shifts'));
        }
      }

      setSelectedShiftIds([]);
      await loadShifts(facilityId);
      setMessage('Selected shifts deleted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete selected shifts');
    } finally {
      setBusyId(null);
    }
  }

  async function duplicateShift(id: string) {
    try {
      setBusyId(id);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts/${id}/duplicate`, {
        method: 'POST',
	credentials: 'include',
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to duplicate shift'));
      }

      await loadShifts(facilityId);
      setMessage('Shift duplicated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to duplicate shift');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteShift(id: string) {
    const confirmed = window.confirm('Delete this shift permanently? This cannot be undone.');
    if (!confirmed) return;

    try {
      setBusyId(id);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) throw new Error(formatApiErrorText(text, 'Failed to delete shift'));

      await loadShifts(facilityId);
      setMessage('Shift deleted successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete shift');
    } finally {
      setBusyId(null);
    }
  }

  async function updateShift(id: string, action: 'close' | 'reopen' | 'cancel') {
    try {
      setBusyId(id);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts/${id}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(formatApiErrorText(text, `Failed to ${action} shift`));
      }

      await loadShifts(facilityId);
      setMessage(
        action === 'close'
          ? 'Shift completed successfully.'
          : action === 'reopen'
            ? 'Shift reopened successfully.'
            : 'Shift cancelled successfully.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update shift');
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    return {
      total: shifts.length,
      open: shifts.filter((s) => s.status === 'OPEN').length,
      completed: shifts.filter((s) => s.status === 'COMPLETED').length,
      cancelled: shifts.filter((s) => s.status === 'CANCELLED').length,
    };
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    let items = [...shifts];

    if (roleFilter !== 'ALL') {
      items = items.filter((shift) => shift.role === roleFilter);
    }

    if (shiftTypeFilter !== 'ALL') {
      items = items.filter((shift) => shift.shiftType === shiftTypeFilter);
    }

    if (fillFilter !== 'ALL') {
      items = items.filter((shift) => shift.fillStatus === fillFilter);
    }

    if (statusFilter !== 'ALL') {
      items = items.filter((shift) => shift.status === statusFilter);
    }

    if (startDateFilter) {
      items = items.filter((shift) => shift.date.split('T')[0] >= startDateFilter);
    }

    if (endDateFilter) {
      items = items.filter((shift) => shift.date.split('T')[0] <= endDateFilter);
    }

    items.sort((a, b) => {
      if (sortBy === 'date-asc') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      if (sortBy === 'date-desc') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      return b.fillCount - a.fillCount;
    });

    return items;
  }, [shifts, roleFilter, shiftTypeFilter, fillFilter, statusFilter, sortBy, startDateFilter, endDateFilter]);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Facility Shifts
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Manage coverage and shift status
        </h1>
        <p className="mt-2 text-slate-600">
          Track open, completed, and cancelled shifts across your facility schedule.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Shifts
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.total}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Open
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-700">{counts.open}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Completed
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">{counts.completed}</div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Cancelled
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-700">{counts.cancelled}</div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="ALL">All roles</option>
              <option value="CNA">CNA</option>
              <option value="LVN">LVN</option>
              <option value="RN">RN</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shift type</label>
            <select
              value={shiftTypeFilter}
              onChange={(e) => setShiftTypeFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="ALL">All types</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
              <option value="NOC">NOC</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Fill status</label>
            <select
              value={fillFilter}
              onChange={(e) => setFillFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="ALL">All fill states</option>
              <option value="OPEN">Open</option>
              <option value="PARTIAL">Partial</option>
              <option value="FILLED">Filled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Shift status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="INVITE_ONLY">Invite only</option>
              <option value="UNFILLED">Unfilled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortValue)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
            >
              <option value="date-asc">Date ascending</option>
              <option value="date-desc">Date descending</option>
              <option value="most-requested">Most requested</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">
          {selectedShiftIds.length} selected
          <span className="ml-2 text-slate-500">({filteredShifts.length} visible)</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={selectAllVisibleShifts}
            disabled={filteredShifts.length === 0}
            className="rounded-full border border-cyan-300 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Select All Visible
          </button>

          <button
            type="button"
            onClick={clearSelectedShifts}
            disabled={selectedShiftIds.length === 0}
            className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear Selection
          </button>

          <button
            type="button"
            onClick={deleteSelectedShifts}
            disabled={busyId === 'bulk-delete' || selectedShiftIds.length === 0}
            className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busyId === 'bulk-delete' ? 'Deleting...' : 'Delete Selected'}
          </button>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {filteredShifts.map((shift) => (
          <div
            key={shift.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedShiftIds.includes(shift.id)}
                  onChange={() => toggleSelectedShift(shift.id)}
                  className="mt-1 h-5 w-5 rounded border-slate-300"
                  aria-label="Select shift"
                />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-bold tracking-tight text-slate-950">
                    {shift.role} • {shift.shiftType}
                  </div>

                  <div
                    className={
                      shift.status === 'CANCELLED'
                        ? 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700'
                        : shift.status === 'COMPLETED'
                          ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                          : 'rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700'
                    }
                  >
                    {shift.status}
                  </div>

                  <div
                    className={
                      shift.fillStatus === 'FILLED'
                        ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                        : shift.fillStatus === 'PARTIAL'
                          ? 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700'
                    }
                  >
                    {shift.fillLabel}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">{shift.facilityName}</div>
                <div className="mt-1 text-sm text-slate-500">
                {formatShiftDate(shift.date)}
	        </div>

                {((shift.pendingCount ?? 0) > 0 || (shift.fillCount ?? 0) > 0) ? (
                  <Link
                    href={`/facility/applicants?shiftId=${shift.id}`}
                    className={(shift.pendingCount ?? 0) > 0 ? 'mt-4 inline-flex animate-pulse items-center justify-center rounded-full bg-red-600 px-6 py-3 text-sm font-extrabold text-white shadow-sm' : 'mt-4 inline-flex items-center justify-center rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50'}
                  >
                    Review Applicants
                  </Link>
                ) : null}


                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Workers Needed
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {shift.workersNeeded}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Filled
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {shift.fillCount}
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
              </div>

              <div className="flex w-full flex-col gap-3 lg:w-56">
	        {['OPEN', 'FILLED', 'INVITE_ONLY'].includes(shift.status) && shift.fillCount === 0 ? (
  <Link
    href={`/facility/shifts/${shift.id}/edit`}
    className="inline-flex items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
  >
    Edit Shift
  </Link>
) : null}

                {['OPEN', 'INVITE_ONLY', 'FILLED'].includes(shift.status) ? (
                  <>
                    <button
                      onClick={() => updateShift(shift.id, 'close')}
                      disabled={busyId === shift.id}
                      className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {busyId === shift.id ? 'Working...' : 'Complete Shift'}
                    </button>

                    <button
                      onClick={() => updateShift(shift.id, 'cancel')}
                      disabled={busyId === shift.id}
                      className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                    >
                      {busyId === shift.id ? 'Working...' : 'Cancel Shift'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => updateShift(shift.id, 'reopen')}
                    disabled={busyId === shift.id}
                    className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
                  >
                    {busyId === shift.id ? 'Working...' : 'Reopen Shift'}
                  </button>
                )}

                <button
                  onClick={() => duplicateShift(shift.id)}
                  disabled={busyId === shift.id}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  {busyId === shift.id ? 'Working...' : 'Duplicate Shift'}
                </button>

                {shift.status !== 'COMPLETED' ? (
                  <button
                    onClick={() => deleteShift(shift.id)}
                    disabled={busyId === shift.id}
                    className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    {busyId === shift.id ? 'Working...' : 'Delete Shift'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredShifts.length === 0 && shifts.length > 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No shifts match the selected filters.
        </div>
      ) : null}
    </div>
  );
}
