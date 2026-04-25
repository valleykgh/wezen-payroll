'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type WorkerDetail = {
  id: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  onboardingStatus: string;
  approvedByWezen: boolean;
  documents: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    fileUrl: string | null;
    createdAt: string;
  }>;
  agreements: Array<{
    id: string;
    agreementType: string;
    status: string;
    signedAt: string | null;
  }>;
};

export function AdminWorkerDetailClient({ professionalId }: { professionalId: string }) {
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState('');

  async function loadWorker() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: WorkerDetail }>(`/api/admin/workers/${professionalId}`);
      setWorker(res.data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load worker');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(label: string, path: string) {
    setBusy(label);
    setMessage('');

    try {
      await apiFetch(path, { method: 'POST' });
      setMessage(`${label} completed.`);
      await loadWorker();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed`);
    } finally {
      setBusy('');
    }
  }

  useEffect(() => {
    loadWorker();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [professionalId]);

  if (loading) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Loading worker...</div>;
  }

  if (!worker) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Worker not found.</div>;
  }

  const name = [worker.firstName, worker.lastName].filter(Boolean).join(' ') || worker.email || 'Worker';
  const ica = worker.agreements.find((item) => item.agreementType === 'ICA');

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-800 ring-1 ring-cyan-200">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">{worker.role}</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">{name}</h2>
        <p className="mt-1 text-sm text-slate-600">{worker.email}</p>
        <p className="mt-1 text-sm text-slate-500">
          {[worker.city, worker.state, worker.zipCode].filter(Boolean).join(', ') || 'Location not listed'}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Onboarding</p>
            <p className="font-bold text-slate-950">{worker.onboardingStatus}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Wezen approval</p>
            <p className="font-bold text-slate-950">{worker.approvedByWezen ? 'Approved' : 'Not approved'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">ICA</p>
            <p className="font-bold text-slate-950">{ica?.status || 'NOT_STARTED'}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Documents</p>
            <p className="font-bold text-slate-950">{worker.documents.length}</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-lg font-bold text-slate-950">Admin actions</h3>
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            onClick={() => runAction('Approve worker', `/api/admin/workers/${professionalId}/approve`)}
            disabled={Boolean(busy)}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === 'Approve worker' ? 'Approving...' : 'Approve worker'}
          </button>

          <button
            type="button"
            onClick={() => runAction('Move under review', `/api/admin/workers/${professionalId}/unapprove`)}
            disabled={Boolean(busy)}
            className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === 'Move under review' ? 'Updating...' : 'Move under review'}
          </button>

          <button
            type="button"
            onClick={() => runAction('Mark ICA sent', `/api/admin/workers/${professionalId}/ica-sent`)}
            disabled={Boolean(busy)}
            className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === 'Mark ICA sent' ? 'Updating...' : 'Mark ICA sent'}
          </button>

          <button
            type="button"
            onClick={() => runAction('Mark ICA signed', `/api/admin/workers/${professionalId}/ica-signed`)}
            disabled={Boolean(busy)}
            className="rounded-2xl bg-cyan-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy === 'Mark ICA signed' ? 'Updating...' : 'Mark ICA signed'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-lg font-bold text-slate-950">Documents</h3>
        <div className="mt-4 grid gap-3">
          {worker.documents.length === 0 ? (
            <p className="text-sm text-slate-600">No documents uploaded.</p>
          ) : null}

          {worker.documents.map((doc) => (
            <div key={doc.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-950">{doc.name}</p>
              <p className="mt-1 text-sm text-slate-600">{doc.category} • {doc.status}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
