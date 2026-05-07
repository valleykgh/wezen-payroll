'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type WorkerSearchResult = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  city?: string | null;
  state?: string | null;
};

function formatTimeLabel(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';

  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    const hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || 0);
    const suffix = ampmMatch[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return value;
    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  let hour = 0;
  let minute = 0;

  if (raw.includes(':')) {
    const [h, m] = raw.split(':');
    hour = Number(h);
    minute = Number(m || 0);
  } else {
    hour = Number(raw);
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function PostShiftForm() {
  const [role, setRole] = useState('CNA');
  const [shiftType, setShiftType] = useState('AM');
  const [date, setDate] = useState('');
  const [startTimeLabel, setStartTimeLabel] = useState('');
  const [endTimeLabel, setEndTimeLabel] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const [inviteMode, setInviteMode] = useState(false);
  const [createdInviteShiftId, setCreatedInviteShiftId] = useState('');
  const [workerSearch, setWorkerSearch] = useState('');
  const [workers, setWorkers] = useState<WorkerSearchResult[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const inviteSectionRef = useRef<HTMLDivElement | null>(null);

  async function createShift(visibility: 'PUBLIC' | 'INVITE_ONLY') {
    setLoading(true);
    setMessage('');

    try {
      const me = await apiFetch<{ data: { facilityId?: string | null } }>('/api/auth/me');

      const res = await apiFetch<{ data: { id: string } }>('/api/shifts', {
        method: 'POST',
        body: JSON.stringify({
          facilityId: me.data.facilityId,
          role,
          shiftType,
          date,
          startTimeLabel: formatTimeLabel(startTimeLabel),
          endTimeLabel: formatTimeLabel(endTimeLabel),
          workersNeeded,
          specialInstructions,
          visibility,
        }),
      });

      if (visibility === 'INVITE_ONLY') {
        setCreatedInviteShiftId(res.data.id);
        setInviteMode(true);
        setMessage('✅ Invite-only shift created. Search and invite workers.');
        await searchWorkers();
        return;
      }

      setMessage('✅ Success! Shift posted successfully. Nearby eligible workers are being notified.');
      setDate('');
      setStartTimeLabel('');
      setEndTimeLabel('');
      setWorkersNeeded(1);
      setSpecialInstructions('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to post shift');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createShift('PUBLIC');
  }

  async function searchWorkers() {
    const params = new URLSearchParams();
    params.set('role', role);
    if (workerSearch.trim()) params.set('q', workerSearch.trim());

    const res = await apiFetch<{ data: WorkerSearchResult[] }>(
      `/api/facility/workers/search?${params.toString()}`
    );
    setWorkers(res.data || []);
  }

  function toggleWorker(workerId: string) {
    setSelectedWorkerIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId]
    );
  }

  async function inviteSelectedWorkers() {
    try {
      if (!createdInviteShiftId) throw new Error('Create invite-only shift first.');
      if (selectedWorkerIds.length === 0) throw new Error('Select at least one worker.');

      setLoading(true);
      setMessage('');

      await apiFetch(`/api/shifts/${createdInviteShiftId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({
          professionalIds: selectedWorkerIds,
          message: inviteMessage || undefined,
        }),
      });

      setMessage(`✅ Invitation sent to ${selectedWorkerIds.length} worker${selectedWorkerIds.length === 1 ? '' : 's'}.`);
      setSelectedWorkerIds([]);
      setInviteMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send invitations');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!inviteMode) return;
    setTimeout(() => {
      inviteSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 150);
  }, [inviteMode]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <form onSubmit={handleSubmit} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-lg font-bold text-slate-950">Post a Shift</h2>

      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-xl font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <select value={role} onChange={(e) => setRole(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
            <option value="CNA">CNA</option>
            <option value="LVN">LVN</option>
            <option value="RN">RN</option>
          </select>

          <select value={shiftType} onChange={(e) => setShiftType(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm">
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="NOC">NOC</option>
          </select>
        </div>

        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-4 text-base font-semibold text-slate-950" />

        <input placeholder="Start time: 7 or 7:00 or 15:30" value={startTimeLabel} onChange={(e) => setStartTimeLabel(e.target.value)} onBlur={(e) => setStartTimeLabel(formatTimeLabel(e.target.value))} required className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <input placeholder="End time: 15:30 or 3:30 PM" value={endTimeLabel} onChange={(e) => setEndTimeLabel(e.target.value)} onBlur={(e) => setEndTimeLabel(formatTimeLabel(e.target.value))} required className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <input type="number" min={1} value={workersNeeded} onChange={(e) => setWorkersNeeded(Number(e.target.value))} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <textarea placeholder="Special instructions" value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} className="min-h-24 rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

        <button type="submit" disabled={loading} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? 'Posting...' : 'Post Shift Publicly'}
        </button>

        <button type="button" onClick={() => createShift('INVITE_ONLY')} disabled={loading} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
          {loading ? 'Working...' : 'Invite Workers First'}
        </button>
      </div>

      {inviteMode ? (
        <div ref={inviteSectionRef} className="mt-5 rounded-3xl border border-cyan-200 bg-cyan-50 p-4">
          <h3 className="text-base font-extrabold text-slate-950">Invite workers</h3>
          <p className="mt-1 text-xs text-slate-600">This shift is invite-only until posted publicly.</p>

          <input value={workerSearch} onChange={(e) => setWorkerSearch(e.target.value)} placeholder="Search name or email" className="mt-3 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm" />

          <button type="button" onClick={searchWorkers} className="mt-3 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Search Workers
          </button>

          <textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} placeholder="Optional invite message" className="mt-3 min-h-20 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm" />

          <div className="mt-3 grid gap-3">
            {workers.map((worker) => {
              const selected = selectedWorkerIds.includes(worker.id);
              const fullName = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;

              return (
                <button key={worker.id} type="button" onClick={() => toggleWorker(worker.id)} className={selected ? 'rounded-2xl border-2 border-cyan-700 bg-white p-4 text-left' : 'rounded-2xl border border-cyan-200 bg-white p-4 text-left'}>
                  <p className="text-sm font-bold text-slate-950">{fullName}</p>
                  <p className="mt-1 text-xs text-slate-600">{worker.email}</p>
                  <p className="mt-2 text-xs font-bold text-cyan-800">{worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}</p>
                  <p className="mt-2 text-xs font-extrabold text-slate-500">{selected ? 'Selected ✓' : 'Tap to select'}</p>
                </button>
              );
            })}
          </div>

          <button type="button" onClick={inviteSelectedWorkers} disabled={loading || selectedWorkerIds.length === 0} className="mt-4 w-full rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60">
            Send Invite{selectedWorkerIds.length ? ` (${selectedWorkerIds.length})` : ''}
          </button>
        </div>
      ) : null}
    </form>
  );
}
