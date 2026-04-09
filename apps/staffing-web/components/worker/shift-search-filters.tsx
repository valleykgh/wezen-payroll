'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { availableShiftFilters } from '@/lib/mock-data';
import { FormField } from '@/components/ui/form-field';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { useState } from 'react';

export function ShiftSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [role, setRole] = useState(searchParams.get('role') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [radius, setRadius] = useState(searchParams.get('radius') || '25 miles');
  const [shiftType, setShiftType] = useState(searchParams.get('shiftType') || '');

  function applyFilters() {
    const params = new URLSearchParams();

    if (role) params.set('role', role);
    if (location) params.set('location', location);
    if (radius) params.set('radius', radius);
    if (shiftType) params.set('shiftType', shiftType);

    router.push(`/worker/shifts?${params.toString()}`);
  }

  function resetFilters() {
    setRole('');
    setLocation('');
    setRadius('25 miles');
    setShiftType('');
    router.push('/worker/shifts');
  }

  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Search filters
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Search nearby shifts by role, location, radius, and schedule.
          </p>
        </div>
        <button
          type="button"
          onClick={resetFilters}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Reset
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FormField label="Role" htmlFor="role">
          <SelectInput
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">All roles</option>
            {availableShiftFilters.roles.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Location" htmlFor="location">
          <TextInput
            id="location"
            placeholder="ZIP or city"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </FormField>

        <FormField label="Radius" htmlFor="radius">
          <SelectInput
            id="radius"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          >
            {availableShiftFilters.radii.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </FormField>

        <FormField label="Shift type" htmlFor="shiftType">
          <SelectInput
            id="shiftType"
            value={shiftType}
            onChange={(e) => setShiftType(e.target.value)}
          >
            <option value="">All shifts</option>
            {availableShiftFilters.shiftTypes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectInput>
        </FormField>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={applyFilters}
          className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
        >
          Search shifts
        </button>
        <button
          type="button"
          className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
        >
          Save search
        </button>
      </div>
    </div>
  );
}
