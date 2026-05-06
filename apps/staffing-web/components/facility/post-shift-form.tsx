'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { FormField } from '@/components/ui/form-field';
import { SelectInput } from '@/components/ui/select-input';
import { TextArea } from '@/components/ui/text-area';
import { TextInput } from '@/components/ui/text-input';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type ShiftType = 'AM' | 'PM' | 'NOC';

type FacilitySettings = {
  id?: string;
  name?: string;
  defaultCnaRateCents?: number | null;
  defaultLvnRateCents?: number | null;
  defaultRnRateCents?: number | null;
  allowRateOverride?: boolean;
};

export function PostShiftForm() {
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null);

  const [shiftType, setShiftType] = useState<ShiftType>('AM');
  const [role, setRole] = useState('CNA');
  const [date, setDate] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [payRateDollars, setPayRateDollars] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadFacilityContext() {
      try {
        const me = await apiFetch<{ data: { facilityId?: string | null } }>('/api/auth/me');
        const currentFacilityId = me.data.facilityId ?? null;
        setFacilityId(currentFacilityId);

        const dashboard = await apiFetch<{
          data: {
            facility?: FacilitySettings;
          };
        }>('/api/facility/dashboard');

        setFacilitySettings(dashboard.data.facility ?? null);
      } catch {
        setFacilityId(null);
        setFacilitySettings(null);
      }
    }

    loadFacilityContext();
  }, []);

  const selectedDefaultRateCents = useMemo(() => {
    if (!facilitySettings) return null;

    if (role === 'CNA') return facilitySettings.defaultCnaRateCents ?? null;
    if (role === 'LVN') return facilitySettings.defaultLvnRateCents ?? null;
    if (role === 'RN') return facilitySettings.defaultRnRateCents ?? null;

    return null;
  }, [facilitySettings, role]);

  const currentDefaultRateLabel =
    selectedDefaultRateCents != null
      ? `$${(selectedDefaultRateCents / 100).toFixed(2)}/hr`
      : 'Not configured';

  useEffect(() => {
    if (!facilitySettings) return;

    if (facilitySettings.allowRateOverride) {
      setPayRateDollars('');
    } else if (selectedDefaultRateCents != null) {
      setPayRateDollars((selectedDefaultRateCents / 100).toFixed(2));
    } else {
      setPayRateDollars('');
    }
  }, [selectedDefaultRateCents, facilitySettings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      if (!facilityId) {
        throw new Error('You must be signed in as a facility admin.');
      }

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId,
          role,
          shiftType,
          date,
          startTimeLabel: formatTimeLabel(startTime),
          endTimeLabel: formatTimeLabel(endTime),
          workersNeeded: Number(workersNeeded),
          specialInstructions: instructions || undefined,
          payRateCents: facilitySettings?.allowRateOverride
            ? Math.round(Number(payRateDollars) * 100)
            : selectedDefaultRateCents ?? undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to create shift');
      }

      setMessage('✅ Shift published successfully. Nearby eligible workers are being notified.');
      setRole('CNA');
      setShiftType('AM');
      setDate('');
      setWorkersNeeded(1);
      setStartTime('');
      setEndTime('');
      setInstructions('');

      if (facilitySettings?.allowRateOverride) {
        setPayRateDollars('');
      } else if (selectedDefaultRateCents != null) {
        setPayRateDollars((selectedDefaultRateCents / 100).toFixed(2));
      } else {
        setPayRateDollars('');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create shift');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <form
        onSubmit={handleSubmit}
        className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Shift details
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the role, schedule, and requirements for the shift you want to fill.
          </p>
        </div>

        {message ? (
          <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-xl font-extrabold text-white shadow-2xl">
            {message}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Role" htmlFor="role">
            <SelectInput id="role" value={role} onChange={(e) => setRole(e.target.value)}>
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
            <TextInput
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
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
            <TextInput
              id="startTime"
              type="text"
              placeholder="7, 7am, 15:30, 3:30pm"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)} onBlur={(e) => setStartTime(normalizeTimeInput(e.target.value))}
              required
            />
          </FormField>

          <FormField label="End time" htmlFor="endTime">
            <TextInput
              id="endTime"
              type="text"
              placeholder="7, 7am, 15:30, 3:30pm"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)} onBlur={(e) => setEndTime(normalizeTimeInput(e.target.value))}
              required
            />
          </FormField>

          {facilitySettings?.allowRateOverride ? (
            <FormField label="Pay rate ($/hr)" htmlFor="payRateDollars">
              <TextInput
                id="payRateDollars"
                type="number"
                min={0}
                step="0.01"
                value={payRateDollars}
                onChange={(e) => setPayRateDollars(e.target.value)}
                placeholder="Enter shift pay rate"
                required
              />
            </FormField>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Pay rate
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900">
                {currentDefaultRateLabel}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                This rate is managed by Wezen Staffing. Facility users cannot change it.
              </div>
            </div>
          )}

          <div className="md:col-span-2">
            <FormField label="Special instructions" htmlFor="instructions">
              <TextArea
                id="instructions"
                rows={5}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Unit details, arrival notes, dress code, charting system, or any facility-specific requirements"
              />
            </FormField>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || !facilityId}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Publishing...' : 'Publish Shift'}
          </button>

          <button
            type="button"
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Save Draft
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Shift preview
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">
            {role} • {shiftType} Shift
          </div>
          <div className="mt-2 text-cyan-50">
            {facilitySettings?.name || 'Your facility'}
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Date: {date || 'Select a date'}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Time:{' '}
              {startTime && endTime
                ? `${formatTimeLabel(startTime)} - ${formatTimeLabel(endTime)}`
                : 'Select times'}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Workers Needed: {workersNeeded}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Pay Rate:{' '}
              {facilitySettings?.allowRateOverride
                ? payRateDollars
                  ? `$${payRateDollars}/hr`
                  : 'Not listed'
                : currentDefaultRateLabel}
            </div>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold tracking-tight text-slate-950">
            Approval flow
          </h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              1. Shift is posted to the marketplace.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              2. Professionals request the shift.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              3. Documents route for review and approval.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              4. Approved worker is confirmed for coverage.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
