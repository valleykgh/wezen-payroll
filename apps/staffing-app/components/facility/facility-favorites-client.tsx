'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type FavoriteWorker = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  role: string;
  city?: string | null;
  state?: string | null;
  approvedCount: number;
};

export function FacilityFavoritesClient() {
  const [favorites, setFavorites] = useState<FavoriteWorker[]>([]);
  const [message, setMessage] = useState('Loading favorites...');
  const [busyId, setBusyId] = useState('');

  async function load() {
    const res = await apiFetch<{ data: FavoriteWorker[] }>('/api/facility/favorites');
    setFavorites(res.data || []);
    setMessage('');
  }

  async function removeFavorite(id: string) {
    try {
      setBusyId(id);
      await apiFetch(`/api/facility/favorites/${id}`, { method: 'DELETE' });
      setFavorites((current) => current.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove favorite');
    } finally {
      setBusyId('');
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load favorites'));
  }, []);

  return (
    <div className="grid gap-3">
      {message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">{message}</div> : null}
      {favorites.map((worker) => {
        const name = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email;
        return (
          <div key={worker.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-950">★ {name}</h2>
                <p className="mt-1 text-sm text-slate-600">{worker.role} • {[worker.city, worker.state].filter(Boolean).join(', ') || 'Location not listed'}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{worker.email}</p>
                <p className="mt-3 text-xs font-bold text-emerald-700">{worker.approvedCount} approved shift(s)</p>
              </div>
              <button onClick={() => removeFavorite(worker.id)} disabled={busyId === worker.id} className="rounded-full bg-yellow-50 px-3 py-2 text-xs font-extrabold text-yellow-700 ring-1 ring-yellow-200">Remove</button>
            </div>
          </div>
        );
      })}
      {favorites.length === 0 && !message ? <div className="rounded-3xl bg-white p-5 text-sm text-slate-600">No favorite workers yet.</div> : null}
    </div>
  );
}
