'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type FacilityRequest = {
  id: string;
  status: string;
  reviewNotes?: string | null;
  professional: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  shift: {
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
  };
};

export function FacilityAlertsCard() {
  const [requests, setRequests] = useState<FacilityRequest[]>([]);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const res = await apiFetch<{ data: FacilityRequest[] }>('/api/facility/requests');
        setRequests(
          (res.data || []).filter((item) =>
            ['REQUESTED', 'UNDER_REVIEW', 'CANCELLATION_REQUESTED'].includes(item.status)
          )
        );
      } catch {
        setRequests([]);
      }
    }

    loadAlerts();
  }, []);

  const cancellationCount = requests.filter((item) => item.status === 'CANCELLATION_REQUESTED').length;
  const applicantCount = requests.filter((item) => item.status !== 'CANCELLATION_REQUESTED').length;

  if (requests.length === 0) return null;

  return (
    <Link
      href="/app/facility/applicants/index.html"
      className="block rounded-3xl border-2 border-red-600 bg-red-600 p-5 text-white shadow-xl"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">
        Urgent facility alerts
      </p>

      <h2 className="mt-2 text-2xl font-extrabold">
        {requests.length} item{requests.length === 1 ? '' : 's'} need review
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
        <div className="rounded-2xl bg-white/15 p-3">
          <p className="text-2xl font-extrabold">{applicantCount}</p>
          <p className="text-white/85">Applicants</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3">
          <p className="text-2xl font-extrabold">{cancellationCount}</p>
          <p className="text-white/85">Cancellations</p>
        </div>
      </div>

      <p className="mt-4 text-sm font-bold text-white">
        Tap to review applicants and cancellation requests.
      </p>
    </Link>
  );
}
