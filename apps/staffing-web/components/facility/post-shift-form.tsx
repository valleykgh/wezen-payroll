'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

type WorkerSearchResult = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  availableDateCount?: number;
  availabilities?: Array<{
    date: string;
    shiftType: string;
    note?: string | null;
  }>;
};


function getDateRange(startDate: string, endDate?: string) {
  if (!startDate) return [];
  const start = new Date(`${startDate}T12:00:00`);
  const end = endDate ? new Date(`${endDate}T12:00:00`) : start;

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return [startDate];
  }

  const dates: string[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(cursor.toISOString().split('T')[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function toggleShiftTypeSelection(
  value: ShiftType,
  selected: ShiftType[],
  setSelected: (items: ShiftType[]) => void,
  setPrimary: (item: ShiftType) => void
) {
  const next = selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];

  const finalItems = next.length > 0 ? next : [value];
  setSelected(finalItems);
  setPrimary(finalItems[0]);
}


export function PostShiftForm() {
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [facilitySettings, setFacilitySettings] = useState<FacilitySettings | null>(null);

  const [shiftType, setShiftType] = useState<ShiftType>('AM');
  const [selectedShiftTypes, setSelectedShiftTypes] = useState<ShiftType[]>(['AM']);
  const [role, setRole] = useState('CNA');
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(1);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [instructions, setInstructions] = useState('');
  const [payRateDollars, setPayRateDollars] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteMode, setInviteMode] = useState(false);
  const [workerSearch, setWorkerSearch] = useState('');
  const [workers, setWorkers] = useState<WorkerSearchResult[]>([]);
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [inviteMessage, setInviteMessage] = useState('');
  const inviteSectionRef = useRef<HTMLDivElement | null>(null);

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

  async function createShift(visibility: 'PUBLIC' | 'INVITE_ONLY') {
    setSubmitting(true);
    setMessage('');

    try {
      if (!facilityId) {
        throw new Error('You must be signed in as a facility admin.');
      }

      const datesToCreate = getDateRange(date, endDate);
      const typesToCreate = selectedShiftTypes.length ? selectedShiftTypes : [shiftType];

      if (datesToCreate.length === 0) {
        throw new Error('Please select a start date.');
      }

      let firstCreatedShiftId = '';

      for (const currentDate of datesToCreate) {
        for (const currentShiftType of typesToCreate) {
          const res = await fetch(`${STAFFING_API_BASE_URL}/api/shifts`, {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              facilityId,
              role,
              shiftType: currentShiftType,
              date: currentDate,
              workersNeeded: Number(workersNeeded),
              specialInstructions: instructions || undefined,
              payRateCents: facilitySettings?.allowRateOverride
                ? Math.round(Number(payRateDollars) * 100)
                : selectedDefaultRateCents ?? undefined,
              visibility,
            }),
          });

          const text = await res.text();

          if (!res.ok) {
            throw new Error(text || 'Failed to create shift');
          }

          const payload = text ? JSON.parse(text) : null;
          firstCreatedShiftId = firstCreatedShiftId || payload?.data?.id || '';
        }
      }

      setMessage(`✅ ${datesToCreate.length * typesToCreate.length} shift${datesToCreate.length * typesToCreate.length === 1 ? '' : 's'} published successfully. Nearby eligible workers are being notified.`);
      setRole('CNA');
      setShiftType('AM');
      setSelectedShiftTypes(['AM']);
      setDate('');
      setEndDate('');
      setWorkersNeeded(1);
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await createShift('PUBLIC');
  }

  async function searchWorkers(nextRole = role) {
    try {
      const params = new URLSearchParams();
      params.set('role', nextRole);
      if (workerSearch.trim()) params.set('q', workerSearch.trim());

      if (!date) {
        throw new Error('Please select a start date before searching available workers.');
      }

      params.set('startDate', date);
      params.set('endDate', endDate || date);
      params.set('shiftTypes', selectedShiftTypes.join(','));

      const res = await apiFetch<{ data: WorkerSearchResult[] }>(
        `/api/facility/available-workers?${params.toString()}`
      );

      setWorkers(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to search workers');
    }
  }

  async function inviteSelectedWorkers() {
    try {
      if (selectedWorkerIds.length === 0) throw new Error('Please select at least one worker.');
      if (!date) throw new Error('Please select a start date.');
      if (selectedShiftTypes.length === 0) throw new Error('Select at least one shift type.');

      setSubmitting(true);
      setMessage('');

      const res = await apiFetch<{ data: Array<{ shiftId: string }> }>('/api/facility/availability-invitations', {
        method: 'POST',
        body: JSON.stringify({
          startDate: date,
          endDate: endDate || date,
          role,
          shiftTypes: selectedShiftTypes,
          professionalIds: selectedWorkerIds,
          workersNeeded: Number(workersNeeded),
          message: inviteMessage || undefined,
        }),
      });

      setMessage(`✅ Invitations sent. ${res.data.length} invite-only shift${res.data.length === 1 ? '' : 's'} created.`);
      setInviteMode(false);
      setWorkers([]);
      setSelectedWorkerIds([]);
      setInviteMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send invitations');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleWorker(workerId: string) {
    setSelectedWorkerIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId]
    );
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
                  onClick={() =>
                    toggleShiftTypeSelection(type, selectedShiftTypes, setSelectedShiftTypes, setShiftType)
                  }
                  className={
                    selectedShiftTypes.includes(type)
                      ? 'rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white'
                      : 'rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900'
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <FormField label="Start date" htmlFor="date">
            <TextInput
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </FormField>

          <FormField label="End date (optional)" htmlFor="endDate">
            <TextInput
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
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
            {submitting ? 'Publishing...' : 'Post Shift Publicly'}
          </button>

          <button
            type="button"
            disabled={submitting || !facilityId}
            onClick={async () => {
              setInviteMode(true);
              setMessage('Search and select workers. The shift will only be created after you press Send Invite.');
              await searchWorkers();
              setTimeout(() => {
                inviteSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }, 150);
            }}
            className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Working...' : 'Invite Workers First'}
          </button>
        </div>
      </form>


      {inviteMode ? (
        <section ref={inviteSectionRef} className="rounded-[1.75rem] border-2 border-cyan-200 bg-cyan-50 p-6 shadow-sm xl:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                Invite workers to this shift
              </h2>
              <p className="mt-1 text-sm text-slate-700">
                No shift is created until you press Send Invite.
              </p>
            </div>
            
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input
              value={workerSearch}
              onChange={(e) => setWorkerSearch(e.target.value)}
              placeholder="Search approved workers by name or email"
              className="rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => searchWorkers()}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white"
            >
              Search Workers
            </button>
          </div>

          <textarea
            value={inviteMessage}
            onChange={(e) => setInviteMessage(e.target.value)}
            placeholder="Optional message to workers"
            rows={3}
            className="mt-4 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-3 text-sm text-slate-900"
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {workers.map((worker) => {
              const fullName =
                [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
              const selected = selectedWorkerIds.includes(worker.id);

              return (
                <button
                  key={worker.id}
                  type="button"
                  onClick={() => toggleWorker(worker.id)}
                  className={
                    selected
                      ? 'rounded-2xl border-2 border-cyan-700 bg-white p-4 text-left shadow-sm'
                      : 'rounded-2xl border border-cyan-200 bg-white p-4 text-left hover:border-cyan-500'
                  }
                >
                  <div className="text-sm font-bold text-slate-950">{fullName}</div>
                  <div className="mt-1 text-xs text-slate-600">{worker.email}</div>
                  <div className="mt-2 text-xs font-semibold text-cyan-800">
                    {worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}
                  </div>

                  {worker.availabilities && worker.availabilities.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <div className="w-full text-xs font-extrabold text-emerald-700">
                        Available dates:
                      </div>
                      {worker.availabilities.map((item, index) => (
                        <span
                          key={`${worker.id}-${item.date}-${item.shiftType}-${index}`}
                          className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700"
                        >
                          {formatAvailabilityDate(item.date)} {item.shiftType}
                        </span>
                      ))}
                    </div>
                  ) : date ? (
                    <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      No matching availability found for selected date/shift.
                    </div>
                  ) : null}

                  <div className="mt-2 text-xs font-bold text-slate-500">
                    {selected ? 'Selected ✓' : 'Tap to select'}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={inviteSelectedWorkers}
              disabled={submitting || selectedWorkerIds.length === 0}
              className="rounded-full bg-cyan-700 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              Send Invite{selectedWorkerIds.length ? ` (${selectedWorkerIds.length})` : ''}
            </button>
          </div>
        </section>
      ) : null}

      <div className="space-y-6">
        <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
            Shift preview
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight">
            {role} • {selectedShiftTypes.join(' + ')} Shift
          </div>
          <div className="mt-2 text-cyan-50">
            {facilitySettings?.name || 'Your facility'}
          </div>
          <div className="mt-5 grid gap-3">
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Date: {date || 'Select a start date'}{endDate ? ` through ${endDate}` : ''}
            </div>
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm">
              Time: Uses facility default times for {selectedShiftTypes.join(' + ')}
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

function formatAvailabilityDate(dateValue: string) {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string) {
  return normalizeTimeInput(value);
}
