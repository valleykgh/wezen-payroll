'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { FormField } from '@/components/ui/form-field';
import { SelectInput } from '@/components/ui/select-input';
import { TextArea } from '@/components/ui/text-area';
import { TextInput } from '@/components/ui/text-input';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type ShiftType = 'AM' | 'PM' | 'NOC';
type Role = 'CNA' | 'LVN' | 'RN';

type ShiftDetail = {
  id: string;
  role: Role;
  shiftType: ShiftType;
  date: string;
  workersNeeded: number;
  startTimeLabel?: string;
  endTimeLabel?: string;
  time?: string;
  payRateLabel?: string;
  specialInstructions?: string | null;
  status: string;
  fillCount: number;
};

function toDateInput(value: string) {
  return new Date(value).toISOString().split('T')[0];
}

function toTimeInput(label?: string) {
  if (!label) return '';

  const match = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';

  let hour = Number(match[1]);
  const minute = match[2];
  const suffix = match[3].toUpperCase();

  if (suffix === 'AM' && hour === 12) hour = 0;
  if (suffix === 'PM' && hour !== 12) hour += 12;

  return `${String(hour).padStart(2, '0')}:${minute}`;
}



function normalizeTimeInput(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return '';

  const ampmMatch = raw.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    const hour = Number(ampmMatch[1]);
    const minute = Number(ampmMatch[2] || 0);
    const suffix = ampmMatch[3].toUpperCase();

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return value;

    return `${hour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  let hour = 0;
  let minute = 0;

  if (raw.includes(':')) {
    const [h, m] = raw.split(':');
    hour = Number(h);
    minute = Number(m || 0);
  } else if (/^\d{3,4}$/.test(raw)) {
    hour = Number(raw.slice(0, -2));
    minute = Number(raw.slice(-2));
  } else {
    hour = Number(raw);
  }

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;

  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;

  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatTimeLabel(value: string) {
  return normalizeTimeInput(value);
}

export default function EditShiftPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const [shiftId, setShiftId] = useState('');
  const [role, setRole] = useState<Role>('CNA');
  const [shiftType, setShiftType] = useState<ShiftType>('AM');
  const [date, setDate] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [message, setMessage] = useState('Loading shift...');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const resolved = await params;
        setShiftId(resolved.shiftId);

        const res = await apiFetch<{ data: ShiftDetail }>(
          `/api/facility/shifts/${resolved.shiftId}`
        );

        const shift = res.data;

        if (!['OPEN', 'INVITE_ONLY'].includes(shift.status) || shift.fillCount > 0) {
          setMessage('This shift cannot be edited because it is no longer open/invite-only or already has approved coverage.');
          return;
        }

        setRole(shift.role);
        setShiftType(shift.shiftType);
        setDate(toDateInput(shift.date));
        setWorkersNeeded(shift.workersNeeded);
        setStartTime(toTimeInput(shift.startTimeLabel || shift.time?.split(' - ')[0]));
        setEndTime(toTimeInput(shift.endTimeLabel || shift.time?.split(' - ')[1]));
        setInstructions(shift.specialInstructions || '');
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shift');
      }
    }

    load();
  }, [params]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSubmitting(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/facility/shifts/${shiftId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          shiftType,
          date,
          startTimeLabel: formatTimeLabel(startTime),
          endTimeLabel: formatTimeLabel(endTime),
          workersNeeded: Number(workersNeeded),
          specialInstructions: instructions || undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to update shift');
      }

      setMessage('Shift updated successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update shift');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Edit Shift
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Update open shift details
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Only open shifts with no approved workers can be edited.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Role" htmlFor="role">
            <SelectInput id="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="CNA">CNA</option>
              <option value="LVN">LVN</option>
              <option value="RN">RN</option>
            </SelectInput>
          </FormField>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Shift type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['AM', 'PM', 'NOC'] as ShiftType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setShiftType(type)}
                  className={
                    shiftType === type
                      ? 'rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white'
                      : 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900'
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Date" htmlFor="date">
            <TextInput id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </FormField>

          <FormField label="Workers needed" htmlFor="workersNeeded">
            <TextInput
              id="workersNeeded"
              type="number"
              min={1}
              value={workersNeeded}
              onChange={(e) => setWorkersNeeded(Number(e.target.value))}
              required
            />
          </FormField>

          <FormField label="Start time" htmlFor="startTime">
            <TextInput id="startTime" type="text" value={startTime} onChange={(e) => setStartTime(e.target.value)} onBlur={(e) => setStartTime(normalizeTimeInput(e.target.value))} required />
          </FormField>

          <FormField label="End time" htmlFor="endTime">
            <TextInput id="endTime" type="text" value={endTime} onChange={(e) => setEndTime(e.target.value)} onBlur={(e) => setEndTime(normalizeTimeInput(e.target.value))} required />
          </FormField>

          <div className="md:col-span-2">
            <FormField label="Special instructions" htmlFor="instructions">
              <TextArea
                id="instructions"
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || !shiftId}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>

          <Link
            href="/facility/shifts"
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Back to Shifts
          </Link>
        </div>
      </form>
    </div>
  );
}
