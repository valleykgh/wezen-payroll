'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';

type AdminWorker = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  city?: string | null;
  state?: string | null;
  onboardingStatus?: string | null;
  approvedByWezen: boolean;
  icaStatus: string;
  counts: {
    approvedDocs: number;
    pendingDocs: number;
    rejectedDocs: number;
    expiredDocs: number;
    totalDocs: number;
  };
};

export default function AdminWorkersPage() {
  const [workers, setWorkers] = useState<AdminWorker[]>([]);
  const [message, setMessage] = useState('Loading workers...');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: AdminWorker[] }>('/api/admin/workers');
        setWorkers(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load workers');
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Worker review console
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Review workers, verify compliance documents, monitor agreement completion,
          and control marketplace approval status.
        </p>
      </div>

      {message && workers.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {workers.length > 0 ? (
        <div className="space-y-5">
          {workers.map((worker) => {
            const fullName =
              [worker.firstName, worker.lastName].filter(Boolean).join(' ') ||
              'Unnamed worker';

            return (
              <div
                key={worker.id}
                className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                        {fullName}
                      </h2>

                      <StatusBadge
                        label={worker.approvedByWezen ? 'APPROVED_BY_WEZEN' : 'UNDER_REVIEW'}
                        tone={worker.approvedByWezen ? 'success' : 'warning'}
                      />

                      <StatusBadge
                        label={`ICA ${worker.icaStatus}`}
                        tone={worker.icaStatus === 'SIGNED' ? 'success' : 'warning'}
                      />
                    </div>

                    <div className="mt-3 text-sm font-medium text-slate-700">
                      {worker.role} • {worker.email}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {worker.city || 'Unknown city'}
                      {worker.state ? `, ${worker.state}` : ''}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl bg-emerald-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                          Approved Docs
                        </div>
                        <div className="mt-1 text-lg font-bold text-emerald-900">
                          {worker.counts.approvedDocs}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-cyan-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
                          Pending Docs
                        </div>
                        <div className="mt-1 text-lg font-bold text-cyan-900">
                          {worker.counts.pendingDocs}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-rose-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">
                          Rejected Docs
                        </div>
                        <div className="mt-1 text-lg font-bold text-rose-900">
                          {worker.counts.rejectedDocs}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-amber-50 px-4 py-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                          Expired Docs
                        </div>
                        <div className="mt-1 text-lg font-bold text-amber-900">
                          {worker.counts.expiredDocs}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-56">
                    <Link
                      href={`/admin/workers/${worker.id}`}
                      className="inline-flex w-full items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white no-underline shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                    >
                      Review Worker
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
