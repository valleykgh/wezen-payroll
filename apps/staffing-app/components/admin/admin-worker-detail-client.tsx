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
    expiresAt?: string | null;
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
  const [resetPassword, setResetPassword] = useState('');

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

  async function resetWorkerPassword() {
    const newPassword = resetPassword.trim();

    if (newPassword.length < 8) {
      setMessage('Temporary password must be at least 8 characters.');
      return;
    }

    setBusy('Reset password');
    setMessage('');

    try {
      await apiFetch(`/api/admin/workers/${professionalId}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });

      setResetPassword('');
      setMessage(`Password reset successfully for ${worker?.email || 'worker'}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Password reset failed');
    } finally {
      setBusy('');
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
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);



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
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
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

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200">
        <h3 className="text-lg font-bold text-slate-950">Reset worker password</h3>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Username/email: {worker.email || 'Not available'}
        </p>

        <input
          type="text"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
          placeholder="Temporary password"
          className="mt-4 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
        />

        <button
          type="button"
          onClick={resetWorkerPassword}
          disabled={Boolean(busy) || resetPassword.trim().length < 8}
          className="mt-3 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {busy === 'Reset password' ? 'Resetting...' : 'Reset Password'}
        </button>

        <p className="mt-3 text-xs font-semibold text-slate-500">
          Temporary password must be at least 8 characters. Give it directly to the worker.
        </p>
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
              {doc.expiresAt ? (
                <p className={
                  new Date(doc.expiresAt) < new Date()
                    ? "mt-1 text-xs font-bold text-red-600"
                    : "mt-1 text-xs font-semibold text-slate-500"
                }>
                  Expires {new Date(doc.expiresAt).toLocaleDateString()}
                </p>
              ) : (
                <p className="mt-1 text-xs font-semibold text-amber-600">
                  No expiration date listed
                </p>
              )}

              {doc.fileUrl ? (
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-800 ring-1 ring-slate-200"
                >
                  View document
                </a>
              ) : null}

              {doc.status === 'PENDING' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => runAction('Approve document', `/api/admin/documents/${doc.id}/approve`)}
                    disabled={Boolean(busy)}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    onClick={() => runAction('Reject document', `/api/admin/documents/${doc.id}/reject`)}
                    disabled={Boolean(busy)}
                    className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
