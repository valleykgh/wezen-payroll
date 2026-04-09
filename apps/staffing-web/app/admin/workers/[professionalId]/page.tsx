'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { TextArea } from '@/components/ui/text-area';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type WorkerDetail = {
  id: string;
  role: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  maxDistanceMiles?: number | null;
  hourlyRateCents?: number | null;
  bio?: string | null;
  onboardingStatus?: string | null;
  approvedByWezen: boolean;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
  documents: Array<{
    id: string;
    name: string;
    category: string;
    status: string;
    expiresAt?: string | null;
    notes?: string | null;
    fileUrl: string;
    createdAt: string;
  }>;
  agreements: Array<{
    id: string;
    agreementType: string;
    status: string;
    signedAt?: string | null;
    signerName?: string | null;
    signerEmail?: string | null;
  }>;
  requests: Array<{
    id: string;
    status: string;
    requestedAt: string;
    shift: {
      id: string;
      role: string;
      shiftType: string;
      date: string;
      time: string;
      facilityName: string;
    };
  }>;
};

export default function AdminWorkerDetailPage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const [professionalId, setProfessionalId] = useState('');
  const [worker, setWorker] = useState<WorkerDetail | null>(null);
  const [message, setMessage] = useState('Loading worker detail...');
  const [busy, setBusy] = useState(false);
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  async function load(id: string) {
    const res = await apiFetch<{ data: WorkerDetail }>(`/api/admin/workers/${id}`);
    setWorker(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        const resolved = await params;
        setProfessionalId(resolved.professionalId);
        await load(resolved.professionalId);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load worker detail');
      }
    }

    init();
  }, [params]);

  async function approveDocument(documentId: string) {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/documents/${documentId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to approve document');
      await load(professionalId);
      setMessage('Document approved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to approve document');
    } finally {
      setBusy(false);
    }
  }

  async function rejectDocument(documentId: string) {
    try {
      setBusy(true);
      const notes = rejectNotes[documentId]?.trim();
      if (!notes) throw new Error('Please enter rejection notes.');

      const res = await fetch(`${API_BASE_URL}/api/admin/documents/${documentId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to reject document');

      await load(professionalId);
      setMessage('Document rejected successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reject document');
    } finally {
      setBusy(false);
    }
  }

  async function updateWorkerApproval(action: 'approve' | 'unapprove') {
    try {
      setBusy(true);

      const res = await fetch(`${API_BASE_URL}/api/admin/workers/${professionalId}/${action}`, {
        method: 'POST',
        credentials: 'include',
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Failed to ${action} worker`);

      await load(professionalId);
      setMessage(
        action === 'approve'
          ? 'Worker approved by Wezen.'
          : 'Worker moved back to under review.'
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update worker');
    } finally {
      setBusy(false);
    }
  }

  if (!worker) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        {message}
      </div>
    );
  }

  const fullName =
    [worker.firstName, worker.lastName].filter(Boolean).join(' ') || 'Unnamed worker';
  const ica = worker.agreements.find((agreement) => agreement.agreementType === 'ICA');

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Internal Admin
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight">{fullName}</h1>
            <p className="mt-3 max-w-3xl text-base text-slate-200">
              Review compliance documents, agreement completion, and marketplace readiness.
            </p>
          </div>

          <Link
            href="/admin/workers"
            className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Worker summary
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

            <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Bio
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {worker.bio || 'No professional summary provided.'}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Compliance documents
            </h2>

            <div className="mt-5 space-y-4">
              {worker.documents.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No documents uploaded yet.
                </div>
              ) : (
                worker.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-2xl border border-slate-200 p-5"
                  >
                    <div className="flex flex-col gap-4">
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

                      <div className="text-sm text-slate-600">{doc.category}</div>

                      {doc.notes ? (
                        <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
                          {doc.notes}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          View Document
                        </a>

                        <button
                          onClick={() => approveDocument(doc.id)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                        >
                          Approve
                        </button>

                        <button
                          onClick={() => rejectDocument(doc.id)}
                          disabled={busy}
                          className="inline-flex items-center justify-center rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                        >
                          Reject
                        </button>
                      </div>

                      <TextArea
                        rows={3}
                        value={rejectNotes[doc.id] || ''}
                        onChange={(e) =>
                          setRejectNotes((prev) => ({
                            ...prev,
                            [doc.id]: e.target.value,
                          }))
                        }
                        placeholder="Enter rejection reason if rejecting this document"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Marketplace readiness
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              {worker.approvedByWezen ? 'APPROVED' : 'UNDER REVIEW'}
            </div>
            <div className="mt-2 text-cyan-50">
              Onboarding status: {worker.onboardingStatus || 'PENDING'}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Agreement status
            </h2>

            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-base font-semibold text-slate-950">
                  Independent Contractor Agreement
                </div>
                <StatusBadge
                  label={ica?.status || 'NOT_STARTED'}
                  tone={ica?.status === 'SIGNED' ? 'success' : 'warning'}
                />
              </div>

              <div className="mt-3 text-sm text-slate-600">
                {ica?.signedAt
                  ? `Signed on ${new Date(ica.signedAt).toLocaleString()}`
                  : 'ICA has not been signed yet.'}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Worker approval
            </h2>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => updateWorkerApproval('approve')}
                disabled={busy || worker.approvedByWezen}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
              >
                Approve by Wezen
              </button>

              <button
                onClick={() => updateWorkerApproval('unapprove')}
                disabled={busy || !worker.approvedByWezen}
                className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-amber-400 disabled:opacity-60"
              >
                Mark Under Review
              </button>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Request history
            </h2>

            <div className="mt-4 space-y-3">
              {worker.requests.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No shift request history yet.
                </div>
              ) : (
                worker.requests.map((request) => (
                  <div
                    key={request.id}
                    className="rounded-2xl bg-slate-50 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="text-sm font-semibold text-slate-950">
                        {request.shift.role} • {request.shift.shiftType}
                      </div>
                      <StatusBadge
                        label={request.status}
                        tone={
                          request.status === 'APPROVED'
                            ? 'success'
                            : request.status === 'REJECTED'
                              ? 'danger'
                              : 'warning'
                        }
                      />
                    </div>
                    <div className="mt-2 text-sm text-slate-600">
                      {request.shift.facilityName} • {new Date(request.shift.date).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
