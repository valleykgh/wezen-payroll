'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import Link from 'next/link';

type Worker = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: string;
  city?: string | null;
  state?: string | null;
  totalRequests: number;
  approvedCount: number;
  lastRequestedAt?: string | null;
  isFavorite?: boolean;
};

export default function FacilityWorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [message, setMessage] = useState('Loading workers...');
  const [busyFavoriteId, setBusyFavoriteId] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<{ data: Worker[] }>('/api/facility/workers');
        setWorkers(res.data);
        setMessage('');
	      } catch (error) {
        const fallback = 'Failed to load dashboard';

        if (
          error instanceof Error &&
          error.message.includes('Facility is inactive')
        ) {
          setMessage(
            'Facility access has been deactivated. Please contact Wezen Staffing support.'
          );
        } else {
          setMessage(error instanceof Error ? error.message : fallback);
        }
      }
    }
    load();
  }, []);


  async function toggleFavorite(worker: Worker) {
    try {
      setBusyFavoriteId(worker.id);
      await apiFetch(`/api/facility/favorites/${worker.id}`, {
        method: worker.isFavorite ? 'DELETE' : 'POST',
      });

      setWorkers((current) =>
        current.map((item) =>
          item.id === worker.id ? { ...item, isFavorite: !worker.isFavorite } : item
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update favorite');
    } finally {
      setBusyFavoriteId('');
    }
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Workers
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Facility worker roster
        </h1>
        <p className="mt-2 text-slate-600">
          Workers connected to your staffing workflow.
        </p>
      </div>

      {message && workers.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Worker activity
        </h2>

        <div className="mt-6 space-y-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="rounded-[1.25rem] border border-slate-200 p-4 transition hover:shadow-sm"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFavorite(worker)}
                      disabled={busyFavoriteId === worker.id}
                      title={worker.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      className={worker.isFavorite ? 'text-2xl text-yellow-500' : 'text-2xl text-slate-300 hover:text-yellow-500'}
                    >
                      ★
                    </button>
                    <div className="text-lg font-semibold text-slate-950">
                      {worker.firstName} {worker.lastName}
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {worker.role} • {worker.city || 'Unknown city'}
                    {worker.state ? `, ${worker.state}` : ''}
                  </div>
                  <div className="mt-2 text-sm text-slate-500">{worker.email}</div>
                </div>
			<div className="flex flex-wrap items-center gap-2">
  <div className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
    {worker.totalRequests} request(s)
  </div>
  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
    {worker.approvedCount} approved
  </div>
  <Link
    href={`/facility/workers/${worker.id}`}
    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
  >
    View Worker
  </Link>
</div>
              
		</div>
            </div>
          ))}

          {workers.length === 0 && !message ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No workers found for this facility yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
