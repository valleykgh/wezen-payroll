'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type AdminWorker = {
  id: string;
  role: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  workerCode?: string | null;
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

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  async function loadWorkers() {
    try {
      const params = new URLSearchParams();

      if (search.trim()) {
        params.set('q', search.trim());
      }

      if (roleFilter) {
        params.set('role', roleFilter);
      }

      const qs = params.toString();

      const res = await apiFetch<{ data: AdminWorker[] }>(
        `/api/admin/workers${qs ? `?${qs}` : ''}`
      );

      setWorkers(res.data);
      setSelectedWorkerIds((current) => current.filter((id) => res.data.some((worker) => worker.id === id)));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load workers');
    }
  }

  function toggleWorker(workerId: string) {
    setSelectedWorkerIds((current) =>
      current.includes(workerId)
        ? current.filter((id) => id !== workerId)
        : [...current, workerId]
    );
  }

  async function deleteSelectedWorkers() {
    const selectedWorkers = workers.filter((worker) => selectedWorkerIds.includes(worker.id));
    if (selectedWorkers.length === 0) return;

    const confirmation = window.prompt(
      `Permanently delete ${selectedWorkers.length} selected worker account${selectedWorkers.length === 1 ? '' : 's'}, related records, and candidate OneDrive documents? This cannot be undone. Type DELETE to continue.`
    );
    if (confirmation !== 'DELETE') return;

    setDeleting(true);
    setMessage('');
    const deletedIds: string[] = [];
    const failures: string[] = [];

    for (const worker of selectedWorkers) {
      const workerName = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
      try {
        const response = await fetch(`${STAFFING_API_BASE_URL}/api/admin/workers/${worker.id}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        const text = await response.text();
        if (!response.ok) {
          let reason = text || 'Deletion failed';
          try { reason = JSON.parse(text)?.error || reason; } catch {}
          failures.push(`${workerName}: ${reason}`);
        } else {
          deletedIds.push(worker.id);
        }
      } catch (error) {
        failures.push(`${workerName}: ${error instanceof Error ? error.message : 'Deletion failed'}`);
      }
    }

    setWorkers((current) => current.filter((worker) => !deletedIds.includes(worker.id)));
    setSelectedWorkerIds((current) => current.filter((id) => !deletedIds.includes(id)));
    setMessage(
      failures.length
        ? `Deleted ${deletedIds.length} worker account${deletedIds.length === 1 ? '' : 's'}. Could not delete ${failures.length}: ${failures.join(' | ')}`
        : `Deleted ${deletedIds.length} worker account${deletedIds.length === 1 ? '' : 's'} successfully.`
    );
    setDeleting(false);
  }

  useEffect(() => {
    loadWorkers();
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

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_220px_180px]">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Search worker
            </label>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  loadWorkers();
                }
              }}
              placeholder="Search by name or email"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Role
            </label>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            >
              <option value="">All roles</option>
              <option value="CNA">CNA</option>
              <option value="LVN">LVN</option>
              <option value="RN">RN</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={loadWorkers}
              className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-cyan-700"
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {message && workers.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {message && workers.length > 0 ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-5 py-4 text-sm font-medium text-cyan-900">
          {message}
        </div>
      ) : null}

      {workers.length > 0 ? (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-slate-900">
              {selectedWorkerIds.length} selected
            </span>
            <button
              type="button"
              onClick={() => setSelectedWorkerIds(workers.map((worker) => worker.id))}
              className="text-sm font-semibold text-cyan-700 hover:text-cyan-900"
            >
              Select all visible
            </button>
            {selectedWorkerIds.length > 0 ? (
              <button type="button" onClick={() => setSelectedWorkerIds([])} className="text-sm font-semibold text-slate-600 hover:text-slate-900">
                Clear selection
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={deleteSelectedWorkers}
            disabled={deleting || selectedWorkerIds.length === 0}
            className="rounded-full bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {deleting ? 'Deleting selected workers...' : `Delete Selected Workers${selectedWorkerIds.length ? ` (${selectedWorkerIds.length})` : ''}`}
          </button>
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
                role="checkbox"
                aria-checked={selectedWorkerIds.includes(worker.id)}
                tabIndex={0}
                onClick={() => toggleWorker(worker.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleWorker(worker.id);
                  }
                }}
                className={`relative cursor-pointer rounded-[1.75rem] border bg-white p-6 pl-16 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                  selectedWorkerIds.includes(worker.id)
                    ? 'border-cyan-500 ring-2 ring-cyan-200'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${fullName}`}
                  checked={selectedWorkerIds.includes(worker.id)}
                  onClick={(event) => event.stopPropagation()}
                  onChange={() => toggleWorker(worker.id)}
                  className="absolute left-6 top-7 h-5 w-5 accent-cyan-600"
                />
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

                    {worker.workerCode ? (
                      <div className="mt-1 text-sm font-semibold text-cyan-700">
                        Worker ID: {worker.workerCode}
                      </div>
                    ) : null}
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

                  <div className="w-full lg:w-64 space-y-3">
                    <Link
                      href={`/admin/workers/${worker.id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex w-full items-center justify-center rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white no-underline shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                    >
                      Review Worker
                    </Link>

                    <Link
                      href={`/admin/workers/${worker.id}/availability`}
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex w-full items-center justify-center rounded-full border border-cyan-600 bg-white px-5 py-3 text-sm font-semibold text-cyan-700 no-underline transition hover:bg-cyan-50"
                    >
                      View Availability Calendar
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
