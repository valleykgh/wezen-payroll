'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Worker = {
  id: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  onboardingStatus: string;
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

export function AdminWorkersClient() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function loadWorkers() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: Worker[] }>('/api/admin/workers');
      setWorkers(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load workers');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);



  useEffect(() => {
    loadWorkers();
  }, []);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading workers...
        </div>
      ) : null}

      {!loading && workers.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No workers found.
        </div>
      ) : null}

      {workers.map((worker) => {
        const name =
          [worker.firstName, worker.lastName].filter(Boolean).join(' ') ||
          worker.email ||
          'Unnamed worker';

        return (
          <Link href={`/app/admin/worker-detail/index.html?professionalId=${worker.id}`} key={worker.id} className="block rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {worker.role}
                </p>
                <h2 className="mt-2 text-lg font-bold text-slate-950">{name}</h2>
                <p className="mt-1 text-sm text-slate-600">{worker.email}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}
                </p>
              </div>

              <div
                className={
                  worker.approvedByWezen
                    ? 'rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700'
                    : 'rounded-full bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700'
                }
              >
                {worker.approvedByWezen ? 'Approved' : 'Review'}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{worker.counts.approvedDocs}</p>
                <p className="text-slate-500">Approved docs</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{worker.counts.pendingDocs}</p>
                <p className="text-slate-500">Pending docs</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="font-bold text-slate-950">{worker.icaStatus}</p>
                <p className="text-slate-500">ICA</p>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
