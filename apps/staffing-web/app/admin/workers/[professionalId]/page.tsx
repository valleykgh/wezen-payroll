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
  regularPayRateCents?: number | null;
  overtimePayRateCents?: number | null;
  doublePayRateCents?: number | null;
  bio?: string | null;
  onboardingStatus?: string | null;
  approvedByWezen: boolean;
  isSystemUser?: boolean;
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
    storageProvider?: string | null;
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
  const [workerRejectReason, setWorkerRejectReason] = useState('');
  const [regularPayRateDollars, setRegularPayRateDollars] = useState('');
  const [overtimePayRateDollars, setOvertimePayRateDollars] = useState('');
  const [doublePayRateDollars, setDoublePayRateDollars] = useState('');
  async function load(id: string) {
    const res = await apiFetch<{ data: WorkerDetail }>(`/api/admin/workers/${id}`);
    setWorker(res.data);
    setRegularPayRateDollars(
  res.data.regularPayRateCents != null
    ? (res.data.regularPayRateCents / 100).toFixed(2)
    : ''
);

setOvertimePayRateDollars(
  res.data.overtimePayRateCents != null
    ? (res.data.overtimePayRateCents / 100).toFixed(2)
    : ''
);

setDoublePayRateDollars(
  res.data.doublePayRateCents != null
    ? (res.data.doublePayRateCents / 100).toFixed(2)
    : ''
);
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
      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/documents/${documentId}/approve`, {
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

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/documents/${documentId}/reject`, {
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

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}/${action}`, {
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

  async function rejectWorker() {
    try {
      setBusy(true);

      const reason = workerRejectReason.trim();
      if (!reason) {
        throw new Error('Please enter a rejection reason.');
      }

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}/reject`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to reject worker');

      await load(professionalId);
      setWorkerRejectReason('');
      setMessage('Worker rejected successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to reject worker');
    } finally {
      setBusy(false);
    }
  }

async function savePayRates() {
  try {
    setBusy(true);

    const res = await fetch(
      `${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}/pay-rates`,
      {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          regularPayRateCents: regularPayRateDollars.trim()
            ? Math.round(Number(regularPayRateDollars) * 100)
            : null,
          overtimePayRateCents: overtimePayRateDollars.trim()
            ? Math.round(Number(overtimePayRateDollars) * 100)
            : null,
          doublePayRateCents: doublePayRateDollars.trim()
            ? Math.round(Number(doublePayRateDollars) * 100)
            : null,
        }),
      }
    );

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to save pay rates');

    await load(professionalId);
    setMessage('Worker pay rates saved successfully.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to save pay rates');
  } finally {
    setBusy(false);
  }
}

async function markIcaSent() {
  try {
    setBusy(true);

    const res = await fetch(
      `${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}/ica-sent`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to mark ICA as sent');

    await load(professionalId);
    setMessage('ICA marked as sent. Worker has been notified to complete Adobe eSign.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to update ICA status');
  } finally {
    setBusy(false);
  }
}

async function markIcaSigned() {
  try {
    setBusy(true);

    const res = await fetch(
      `${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}/ica-signed`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const text = await res.text();
    if (!res.ok) throw new Error(text || 'Failed to mark ICA as signed');

    await load(professionalId);
    setMessage('ICA has been marked as signed. If all documents are approved and the worker is approved by Wezen, shift requests can proceed.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to update ICA status');
  } finally {
    setBusy(false);
  }
}

async function downloadAllDocuments() {
  try {
    if (!worker || worker.documents.length === 0) return;

    setBusy(true);
    setMessage('');

    const link = document.createElement('a');
    link.href = `${STAFFING_API_BASE_URL}/api/admin/workers/${worker.id}/documents/download-all`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage('Document ZIP download started.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to download documents');
  } finally {
    setBusy(false);
  }
}
  async function deleteWorker() {
    try {
      const confirmed = window.confirm(
        'Are you sure you want to permanently delete this worker? This should only be used for test or duplicate accounts.'
      );

      if (!confirmed) return;

      setBusy(true);

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/admin/workers/${professionalId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to delete worker');

      setMessage('Worker deleted successfully.');
      window.location.href = '/admin/workers';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete worker');
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
const isIcaSent = ica?.status === 'SENT' || ica?.status === 'SIGNED';
const isIcaSigned = ica?.status === 'SIGNED';

const hasSavedPayRates =
  worker.regularPayRateCents != null ||
  worker.overtimePayRateCents != null ||
  worker.doublePayRateCents != null;

const payRatesStepLabel = hasSavedPayRates
  ? 'Step 0 complete ✓ Pay rates saved'
  : 'Step 0 pending — Save ICA pay rates';

const icaSentStepLabel = isIcaSent
  ? 'Step 1 complete ✓ ICA sent'
  : 'Step 1 pending — Send ICA';

const icaSignedStepLabel = isIcaSigned
  ? 'Step 2 complete ✓ ICA signed'
  : isIcaSent
    ? 'Step 2 pending — Waiting for signed agreement'
    : 'Step 2 locked — Send ICA first';

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
          
	worker.documents.map((doc) => {
  const daysUntilExpiration = doc.expiresAt
    ? Math.ceil(
        (new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;

  return (
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
          {doc.storageProvider === 'ONEDRIVE' ? (
            <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
              Uploaded to OneDrive
            </span>
          ) : null}
        </div>

        <div className="text-sm text-slate-600">{doc.category}</div>

        <div className="mt-1 text-sm text-slate-500">
          {doc.expiresAt
            ? `Expires on ${new Date(doc.expiresAt).toLocaleDateString()}`
            : 'No expiry date provided'}
        </div>

        {doc.expiresAt && daysUntilExpiration != null ? (
          daysUntilExpiration < 0 ? (
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              This document expired on {new Date(doc.expiresAt).toLocaleDateString()}.
            </div>
          ) : daysUntilExpiration < 30 ? (
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Warning: expires in {daysUntilExpiration} day{daysUntilExpiration === 1 ? '' : 's'}.
            </div>
          ) : null
        ) : null}

        {doc.notes ? (
          <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {doc.notes}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <a
            href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/view`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            View Document
          </a>

          <a
            href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/download`}
            className="inline-flex items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            Download Document
          </a>

          {doc.status === 'PENDING' ? (
            <>
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
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
})	
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

		{worker.isSystemUser ? (
  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
    This is a protected system user account. Approval, rejection, and deletion actions are disabled.
  </div>
) : (
  <>
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

    <div className="mt-4">
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Rejection reason
      </label>
      <TextArea
        rows={3}
        value={workerRejectReason}
        onChange={(e) => setWorkerRejectReason(e.target.value)}
        placeholder="Enter reason for rejecting this worker"
      />
    </div>

    <div className="mt-4 flex flex-wrap gap-3">
      <button
        onClick={rejectWorker}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
      >
        Reject Worker
      </button>

      <button
        onClick={deleteWorker}
        disabled={busy}
        className="inline-flex items-center justify-center rounded-full border border-rose-300 bg-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:opacity-60"
      >
        Delete Worker
      </button>
    </div>
  </>
)}
          
	   </section>

<section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-bold tracking-tight text-slate-950">
    ICA pay rates
  </h2>
  <p className="mt-2 text-sm text-slate-600">
    Set the compensation values the worker should review before signing the Independent Contractor Agreement.
  </p>

  <div className="mt-6 grid gap-4 md:grid-cols-3">
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Regular Pay Rate ($/hr)
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={regularPayRateDollars}
        onChange={(e) => setRegularPayRateDollars(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Overtime Pay Rate ($/hr)
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={overtimePayRateDollars}
        onChange={(e) => setOvertimePayRateDollars(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </div>

    <div>
      <label className="mb-2 block text-sm font-medium text-slate-700">
        Double-Time Pay Rate ($/hr)
      </label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={doublePayRateDollars}
        onChange={(e) => setDoublePayRateDollars(e.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
      />
    </div>
  </div>
 
        {hasSavedPayRates ? (
  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
    ICA pay rates have been saved for this worker.
  </div>
) : null}

  <div className="mt-6">
  <button
  type="button"
  onClick={savePayRates}
  disabled={busy || hasSavedPayRates}
  className={
    hasSavedPayRates
      ? 'inline-flex items-center justify-center rounded-full bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700 shadow-sm'
      : 'inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60'
  }
>
  {busy ? 'Saving...' : hasSavedPayRates ? 'ICA Pay Rates Saved ✓' : 'Save ICA Pay Rates'}
</button>
<div className="mt-4 space-y-1 text-xs text-slate-500">
  <div>{payRatesStepLabel}</div>
  <div>{icaSentStepLabel}</div>
  <div>{icaSignedStepLabel}</div>
</div>
  </div>
</section>

<section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="text-xl font-bold tracking-tight text-slate-950">
    ICA workflow
  </h2>
  <p className="mt-2 text-sm text-slate-600">
    Send the ICA through Adobe eSign, then confirm once the signed agreement has been received.
  </p>

{isIcaSigned ? (
  <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
    ICA has been marked as signed.
    {worker.approvedByWezen
      ? ' Worker is eligible to proceed if all required documents are approved.'
      : ' Worker is still pending final Wezen approval before shift requests are allowed.'}
  </div>
) : isIcaSent ? (
  <div className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-700">
    ICA has been marked as sent. Waiting for signed agreement confirmation.
  </div>
) : (
  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
    Step 1 pending — Send ICA. Step 2 locked — Send ICA first.
  </div>
)}

<div className="mt-6 flex flex-wrap gap-3">
  <button
    type="button"
    onClick={markIcaSent}
    disabled={busy || isIcaSent}
    className={
      isIcaSent
        ? 'inline-flex items-center justify-center rounded-full bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm'
        : 'inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60'
    }
  >
    {busy ? 'Working...' : isIcaSent ? 'ICA Sent ✓' : 'Mark ICA Sent'}
  </button>

<button
  type="button"
  onClick={markIcaSigned}
  disabled={busy || isIcaSigned || !isIcaSent}
  className={
    isIcaSigned
      ? 'inline-flex items-center justify-center rounded-full bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 shadow-sm'
      : !isIcaSent
        ? 'inline-flex items-center justify-center rounded-full bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed'
        : 'inline-flex items-center justify-center rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60'
  }
>
  {busy ? 'Working...' : isIcaSigned ? 'ICA Signed ✓' : 'Mark ICA Signed'}
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
