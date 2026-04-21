'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type WorkerDetail = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  role: string;
  city?: string | null;
  state?: string | null;
  documents: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    expiresAt?: string | null;
    notes?: string | null;
    createdAt: string;
  }>;
};

export default function FacilityWorkerDetailPage({
  params,
}: {
  params: Promise<{ workerId: string }>;
}) {
  const [workerId, setWorkerId] = useState('');
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [message, setMessage] = useState('Loading worker detail...');
  const [busy, setBusy] = useState(false);

  async function load(id: string) {
    const res = await apiFetch<{ data: WorkerDetail }>(`/api/facility/workers/${id}`);
    setWorker(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        const resolved = await params;
        setWorkerId(resolved.workerId);
        await load(resolved.workerId);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load worker detail');
      }
    }

    init();
  }, [params]);

  async function downloadAllDocuments() {
    try {
      if (!worker) return;

      setBusy(true);
      worker.documents.forEach((doc) => {
        window.open(
          `${STAFFING_API_BASE_URL}/api/documents/${doc.id}/download`,
          '_blank'
        );
      });
      setMessage('Document downloads started.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to download documents');
    } finally {
      setBusy(false);
    }
  }

  if (!worker) {
    return (
      <div className="space-y-8">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      </div>
    );
  }

  const fullName =
    [worker.firstName, worker.lastName].filter(Boolean).join(' ') || 'Unnamed worker';

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Worker Detail
            </div>
            <h1 className="mt-2 text-3xl font-bold text-slate-950">{fullName}</h1>
            <p className="mt-2 text-slate-600">
              Review worker information and download available compliance documents.
            </p>
          </div>

          <Link
            href="/facility/workers"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Back to Workers
          </Link>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Worker information
        </h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Role</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{worker.role}</div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{worker.email}</div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</div>
            <div className="mt-1 text-sm font-medium text-slate-900">{worker.phone || 'Not provided'}</div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {worker.city || 'Unknown city'}{worker.state ? `, ${worker.state}` : ''}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Compliance documents
          </h2>

          <button
            type="button"
            onClick={downloadAllDocuments}
            disabled={busy || worker.documents.length === 0}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Download All Documents
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {worker.documents.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
              No documents uploaded yet.
            </div>
          ) : (
            worker.documents.map((doc) => (
              <div
                key={doc.id}
                className="rounded-2xl border border-slate-200 px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-base font-semibold text-slate-950">{doc.name}</div>
                  <StatusBadge
                    label={doc.status}
                    tone={
                      doc.status === 'APPROVED'
                        ? 'success'
                        : doc.status === 'REJECTED'
                          ? 'danger'
                          : doc.status === 'EXPIRED'
                            ? 'warning'
                            : 'info'
                    }
                  />
                </div>

                <div className="mt-2 text-sm text-slate-600">{doc.category}</div>

                {doc.expiresAt ? (
                  <div className="mt-2 text-sm text-slate-500">
                    Expires: {new Date(doc.expiresAt).toLocaleDateString()}
                  </div>
                ) : null}

                {doc.notes ? (
                  <div className="mt-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {doc.notes}
                  </div>
                ) : null}

                <div className="mt-4">
                  <a
                    href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Download Document
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
