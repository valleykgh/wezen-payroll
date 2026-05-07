'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Shift = {
  id: string;
  role: string;
  facilityId: string;
  facilityName: string;
  city: string | null;
  state: string | null;
  shiftType: string;
  date: string;
  time: string;
  payRateLabel: string;
  applicants: number;
  workersNeeded: number;
  fillCount: number;
  pendingCount: number;
  fillStatus: string;
  fillLabel: string;
  status: string;
};

function toInputDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function FacilityShiftsClient() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  async function loadShifts() {
    setLoading(true);
    setMessage('');

    try {
      const me = await apiFetch<{ data: { facilityId?: string | null } }>('/api/auth/me');
      const facilityId = me.data.facilityId || '';

      if (!facilityId) {
        setMessage('Facility account not found.');
        return;
      }

      const res = await apiFetch<{ data: Shift[] }>(
        `/api/shifts?facilityId=${encodeURIComponent(facilityId)}`
      );

      setShifts(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }

  async function runShiftAction(shiftId: string, action: 'cancel' | 'close' | 'reopen') {
    setBusyId(shiftId);
    setMessage('');

    try {
      await apiFetch(`/api/shifts/${shiftId}/${action}`, { method: 'POST' });
      setMessage(`Shift ${action} completed.`);
      await loadShifts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} shift`);
    } finally {
      setBusyId('');
    }
  }

  async function updateShift(shift: Shift, formData: FormData) {
    setBusyId(shift.id);
    setMessage('');

    try {
      await apiFetch(`/api/facility/shifts/${shift.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          date: String(formData.get('date') || ''),
          shiftType: String(formData.get('shiftType') || ''),
          startTimeLabel: String(formData.get('startTimeLabel') || ''),
          endTimeLabel: String(formData.get('endTimeLabel') || ''),
          workersNeeded: Number(formData.get('workersNeeded') || shift.workersNeeded),
          specialInstructions: String(formData.get('specialInstructions') || ''),
        }),
      });

      setMessage('Shift updated.');
      setEditingId('');
      await loadShifts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update shift');
    } finally {
      setBusyId('');
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  }

  async function duplicateShift(id: string) {
    setBusyId(id);
    setMessage('');

    try {
      await apiFetch(`/api/shifts/${id}/duplicate`, { method: 'POST' });
      setMessage('Shift duplicated.');
      await loadShifts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to duplicate shift');
    } finally {
      setBusyId('');
    }
  }

  async function deleteShift(id: string) {
    if (!window.confirm('Delete this shift permanently?')) return;

    setBusyId(id);
    setMessage('');

    try {
      await apiFetch(`/api/shifts/${id}`, { method: 'DELETE' });
      setSelectedIds((current) => current.filter((item) => item !== id));
      setMessage('Shift deleted.');
      await loadShifts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete shift');
    } finally {
      setBusyId('');
    }
  }

  async function deleteSelected() {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected shift(s)?`)) return;

    setBusyId('bulk-delete');
    setMessage('');

    try {
      await Promise.all(
        selectedIds.map((id) => apiFetch(`/api/shifts/${id}`, { method: 'DELETE' }))
      );
      setSelectedIds([]);
      setMessage('Selected shifts deleted.');
      await loadShifts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete selected shifts');
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
    loadShifts();
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
          Loading posted shifts...
        </div>
      ) : null}

      {!loading && shifts.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No shifts posted yet.
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <button
          type="button"
          onClick={deleteSelected}
          disabled={busyId === 'bulk-delete'}
          className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busyId === 'bulk-delete' ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
        </button>
      ) : null}

      {shifts.map((shift) => {
        const [start = '', end = ''] = shift.time.split(' - ');
        const isEditing = editingId === shift.id;

        return (
          <div key={shift.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(shift.id)}
                  onChange={() => toggleSelected(shift.id)}
                  className="mt-1 h-5 w-5"
                />
                <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {shift.role} • {shift.shiftType}
                </p>
                <Link href={`/app/facility/shift-detail/index.html?shiftId=${shift.id}`} className="mt-2 block text-lg font-bold text-slate-950 underline decoration-slate-300 underline-offset-4">
                  {new Date(shift.date).toLocaleDateString()} • {shift.time}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {[shift.city, shift.state].filter(Boolean).join(', ') || shift.facilityName}
                </p>
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                {shift.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{shift.applicants}</p>
                <p className="text-slate-500">Applicants</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{shift.fillLabel}</p>
                <p className="text-slate-500">Filled</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{shift.payRateLabel}</p>
                <p className="text-slate-500">Rate</p>
              </div>
            </div>

            {isEditing ? (
              <form action={(formData) => updateShift(shift, formData)} className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4">
                <input name="date" type="date" defaultValue={toInputDate(shift.date)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

                <select name="shiftType" defaultValue={shift.shiftType} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                  <option value="NOC">NOC</option>
                </select>

                <input name="startTimeLabel" defaultValue={start} placeholder="Start time" className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
                <input name="endTimeLabel" defaultValue={end} placeholder="End time" className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
                <input name="workersNeeded" type="number" min={1} defaultValue={shift.workersNeeded} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />
                <textarea name="specialInstructions" placeholder="Special instructions" className="min-h-20 rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

                <div className="grid grid-cols-2 gap-3">
                  <button type="submit" disabled={busyId === shift.id} className="rounded-2xl bg-cyan-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50">
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId('')} className="rounded-2xl bg-slate-200 px-3 py-3 text-xs font-bold text-slate-800">
                    Cancel Edit
                  </button>
                </div>
              </form>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setEditingId(shift.id)}
                disabled={!['OPEN', 'INVITE_ONLY'].includes(shift.status) || shift.fillCount > 0}
                className="rounded-2xl bg-cyan-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={() => runShiftAction(shift.id, 'cancel')}
                disabled={busyId === shift.id || shift.status === 'CANCELLED'}
                className="rounded-2xl bg-rose-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => runShiftAction(shift.id, 'close')}
                disabled={busyId === shift.id || ['COMPLETED', 'CLOSED', 'CANCELLED'].includes(shift.status)}
                className="rounded-2xl bg-slate-950 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => runShiftAction(shift.id, 'reopen')}
                disabled={busyId === shift.id || !['CLOSED', 'CANCELLED', 'UNFILLED'].includes(shift.status)}
                className="rounded-2xl bg-cyan-700 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Reopen
              </button>

              <button
                type="button"
                onClick={() => duplicateShift(shift.id)}
                disabled={busyId === shift.id}
                className="rounded-2xl bg-emerald-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Duplicate
              </button>

              <button
                type="button"
                onClick={() => deleteShift(shift.id)}
                disabled={busyId === shift.id}
                className="rounded-2xl bg-red-600 px-3 py-3 text-xs font-bold text-white disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
