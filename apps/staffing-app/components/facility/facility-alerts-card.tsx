'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type ReviewItem = {
  id: string;
  type: string;
  label: string;
  status: string;
  route: string;
  createdAt: string;
  workerName: string;
  workerEmail: string;
  workerRole: string;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
  };
};

export function FacilityAlertsCard() {
  const [items, setItems] = useState<ReviewItem[]>([]);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const res = await apiFetch<{ data: ReviewItem[] }>('/api/facility/review-items');
        setItems(res.data || []);
      } catch {
        setItems([]);
      }
    }

    loadAlerts();
  }, []);

  if (items.length === 0) return null;

  const href =
    items.length === 1
      ? items[0].route
      : '/app/facility/notifications/index.html';

  const requestedCount = items.filter((item) => item.type === 'REQUEST').length;
  const declinedCount = items.filter((item) => item.type === 'DECLINED_INVITATION').length;

  return (
    <Link
      href={href}
      className="block rounded-3xl border-2 border-red-600 bg-red-600 p-5 text-white shadow-xl"
    >
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-white/80">
        Urgent facility review
      </p>

      <h2 className="mt-2 text-2xl font-extrabold">
        {items.length} item{items.length === 1 ? '' : 's'} need review
      </h2>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
        <div className="rounded-2xl bg-white/15 p-3">
          <p className="text-2xl font-extrabold">{requestedCount}</p>
          <p className="text-white/85">Applicants</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3">
          <p className="text-2xl font-extrabold">{declinedCount}</p>
          <p className="text-white/85">Rejected Invites</p>
        </div>
      </div>

      {items.length === 1 ? (
        <div className="mt-4 rounded-2xl bg-white/15 p-3 text-sm font-bold">
          {items[0].workerName} • {items[0].label}
          <br />
          {items[0].shift.role} {items[0].shift.shiftType} • {new Date(items[0].shift.date).toLocaleDateString()}
        </div>
      ) : null}

      <p className="mt-4 text-sm font-bold text-white">
        Tap to review applicants and rejected invitations.
      </p>
    </Link>
  );
}
