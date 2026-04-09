'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Shift = {
  id: string;
  role: string;
  shiftType: string;
  date: string;
  time: string;
  status: string;
  applicants: number;
};

export default function FacilitySchedulePage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [message, setMessage] = useState('Loading schedule...');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Shift[] }>('/api/shifts');
        setShifts(res.data);
        setMessage('');
      } catch (e) {
        setMessage('Failed to load schedule');
      }
    }

    load();
  }, []);

  // group by date
  const grouped = shifts.reduce<Record<string, Shift[]>>((acc, shift) => {
    const date = new Date(shift.date).toDateString();
    acc[date] = acc[date] || [];
    acc[date].push(shift);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <h1 className="text-3xl font-bold text-slate-950">
          Staffing Schedule
        </h1>
        <p className="mt-2 text-slate-600">
          View and manage your upcoming shifts.
        </p>
      </div>

      {message && <div>{message}</div>}

      <div className="space-y-6">
        {Object.entries(grouped).map(([date, shifts]) => (
          <div key={date} className="rounded-2xl border bg-white p-6">
            <div className="text-lg font-bold">{date}</div>

            <div className="mt-4 space-y-3">
              {shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex items-center justify-between rounded-xl border p-4"
                >
                  <div>
                    <div className="font-semibold">
                      {shift.role} • {shift.shiftType}
                    </div>
                    <div className="text-sm text-slate-600">
                      {shift.time}
                    </div>
                  </div>

                  <div className="text-sm text-slate-500">
                    {shift.applicants} applicants
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
