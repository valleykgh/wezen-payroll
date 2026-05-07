'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

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
  isFavorite?: boolean;
};

export function FacilityWorkersClient() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [message, setMessage] = useState('Loading workers...');
  const [busyId, setBusyId] = useState('');

  async function load() {
    const res = await apiFetch<{ data: Worker[] }>('/api/facility/workers');
    setWorkers(res.data || []);
    setMessage('');
  }

  async function toggleFavorite(worker: Worker) {
    try {
      setBusyId(worker.id);
      await apiFetch(`/api/facility/favorites/${worker.id}`, { method: worker.isFavorite ? 'DELETE' : 'POST' });
      setWorkers((current) => current.map((item) => item.id === worker.id ? { ...item, isFavorite: !worker.isFavorite } : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update favorite');
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load workers'));
  }, []);

  return (
    <div className="grid gap-3">
      {message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">{message}</div> : null}
      {workers.map((worker) => {
        const name = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
        return (
          <div key={worker.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start gap-3">
              <button onClick={() => toggleFavorite(worker)} disabled={busyId === worker.id} className={worker.isFavorite ? 'text-3xl text-yellow-500' : 'text-3xl text-slate-300'}>★</button>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-extrabold text-slate-950">{name}</h2>
                <p className="mt-1 text-sm text-slate-600">{worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{worker.email}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{worker.totalRequests} request(s)</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{worker.approvedCount} approved</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {workers.length === 0 && !message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600">No workers found.</div> : null}
    </div>
  );
}
