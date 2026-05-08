'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ApplicantsClient } from '@/components/facility/applicants-client';
import { apiFetch } from '@/lib/api-client';

type FacilityRequest = {
  id: string;
  status: string;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
  };
  professional: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
    city?: string | null;
    state?: string | null;
  };
};

type SortValue = 'newest' | 'oldest' | 'shift-date';

export default function FacilityApplicantsPage() {
  const [requests, setRequests] = useState<FacilityRequest[]>([]);
  const [message, setMessage] = useState('Loading applicants...');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortValue>('newest');
  const searchParams = useSearchParams();
  const shiftIdFilter = searchParams.get('shiftId') || '';

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: FacilityRequest[] }>(
          '/api/facility/requests'
        );

        setRequests(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load applicants');
      }
    }

    load();
  }, []);

  const counts = useMemo(() => {
    return {
      total: requests.length,
      requested: requests.filter((r) => r.status === 'REQUESTED').length,
      approved: requests.filter((r) => r.status === 'APPROVED').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      underReview: requests.filter((r) => r.status === 'UNDER_REVIEW').length,
    };
  }, [requests]);

  const filteredAndSorted = useMemo(() => {
    let items = [...requests];

    if (shiftIdFilter) {
      items = items.filter((item) => item.shift.id === shiftIdFilter);
    }

    if (statusFilter !== 'ALL') {
      items = items.filter((item) => item.status === statusFilter);
    }

    items.sort((a, b) => {
      if (sortBy === 'newest') {
        return (
          new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
        );
      }

      if (sortBy === 'oldest') {
        return (
          new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
        );
      }

      return new Date(a.shift.date).getTime() - new Date(b.shift.date).getTime();
    });

    return items;
  }, [requests, statusFilter, sortBy]);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Applicants
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Review incoming shift requests
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review healthcare professionals who requested your open shifts and approve
          or reject them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total Requests
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.total}</div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Requested
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.requested}</div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Under Review
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.underReview}</div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approved
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.approved}</div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-5 shadow-sm border border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Rejected
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">{counts.rejected}</div>
        </div>
      </div>

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Request filters
            </h2>
            <p className="mt-1 text-sm text-slate-600">
{shiftIdFilter ? 'Review applicants for this specific shift.' : 'Narrow the list by status and sort requests by timing.'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              >
                <option value="ALL">All statuses</option>
                <option value="REQUESTED">Requested</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortValue)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
              >
                <option value="newest">Newest request</option>
                <option value="oldest">Oldest request</option>
                <option value="shift-date">Shift date</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {message && requests.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {filteredAndSorted.length > 0 ? (
        <ApplicantsClient requests={filteredAndSorted} />
      ) : requests.length > 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No applicants match the selected filter.
        </div>
      ) : null}
    </div>
  );
}
