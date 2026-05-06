'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { meRequest } from '@/lib/auth-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { TextArea } from '@/components/ui/text-area';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type ApplicantDetail = {
  id: string;
  status: string;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewNotes?: string | null;
  shift: {
    id: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
    city?: string | null;
    state?: string | null;
  };
  professional: {
    id: string;
    role: string;
    city?: string | null;
    state?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    isDnr?: boolean;
    dnrReason?: string | null;
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
  };
};

function getDaysUntilExpiration(expiresAt?: string | null) {
  if (!expiresAt) return null;
  return Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
}

export default function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const [requestId, setRequestId] = useState('');
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [message, setMessage] = useState('Loading applicant detail...');
  const [busy, setBusy] = useState(false);
  const [dnrReason, setDnrReason] = useState('');

  async function load(id: string) {
    const res = await apiFetch<{ data: ApplicantDetail }>(
      `/api/facility/applicants/${id}`
    );
    setDetail(res.data);
    setDnrReason(res.data.professional.dnrReason || '');
  }

  useEffect(() => {
    async function init() {
      try {
        const resolved = await params;
        setRequestId(resolved.requestId);

	const me = await meRequest();
	setFacilityId(me.data.facilityId ?? null);

        await load(resolved.requestId);
        setMessage('');

      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : 'Failed to load applicant detail'
        );
      }
    }

    init();
  }, [params]);

  async function sendApplicantMessage() {
    if (!requestId) return;

    const subject = window.prompt('Message subject?')?.trim();
    if (!subject) return;

    const body = window.prompt('Message to applicant?')?.trim();
    if (!body) return;

    try {
      setBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/facility/applicants/${requestId}/message`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, message: body }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to send message');
      }

      setMessage('Message sent to applicant by email and app notification.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus(action: 'approve' | 'reject') {
    try {
      if (!requestId) return;

      setBusy(true);
      setMessage('');

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/shift-requests/${requestId}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || `Failed to ${action} request`);
      }

      await load(requestId);
      setMessage(
        action === 'approve'
          ? 'Applicant approved successfully.'
          : 'Applicant rejected successfully.'
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Failed to update applicant'
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateCancellation(action: 'approve-cancellation' | 'deny-cancellation') {
  try {
    if (!requestId) return;

    setBusy(true);
    setMessage('');

    const res = await fetch(
      `${STAFFING_API_BASE_URL}/api/shift-requests/${requestId}/${action}`,
      {
        method: 'POST',
        credentials: 'include',
      }
    );

    const text = await res.text();

    if (!res.ok) {
      throw new Error(
        text ||
          (action === 'approve-cancellation'
            ? 'Failed to approve cancellation request'
            : 'Failed to deny cancellation request')
      );
    }

    await load(requestId);
    setMessage(
      action === 'approve-cancellation'
        ? 'Cancellation request approved successfully.'
        : 'Cancellation request denied successfully.'
    );
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : 'Failed to update cancellation request'
    );
  } finally {
    setBusy(false);
  }
}

  async function addDnr() {
    try {
      if (!facilityId || !detail?.professional.id) {
        throw new Error('Facility or professional information is missing.');
      }

      setBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/facility/dnr`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          facilityId,
          professionalId: detail.professional.id,
          reason: dnrReason || undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to add worker to DNR list');
      }

      await load(requestId);
      setMessage('Worker added to this facility’s DNR list.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update DNR');
    } finally {
      setBusy(false);
    }
  }

  async function removeDnr() {
    try {
      if (!facilityId || !detail?.professional.id) {
        throw new Error('Facility or professional information is missing.');
      }

      setBusy(true);
      setMessage('');

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/facility/dnr?facilityId=${facilityId}&professionalId=${detail.professional.id}`,
        {
          method: 'DELETE',
	  credentials: 'include',
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to remove worker from DNR list');
      }

      await load(requestId);
      setDnrReason('');
      setMessage('Worker removed from this facility’s DNR list.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update DNR');
    } finally {
      setBusy(false);
    }
  }

useEffect(() => {
  if (!message || message === 'Loading applicant detail...') return;
  const timer = setTimeout(() => setMessage(''), 2500);
  return () => clearTimeout(timer);
}, [message]);

async function downloadAllApplicantDocuments() {
  try {
    if (!requestId) return;

    setBusy(true);
    setMessage('');

    const link = document.createElement('a');
    link.href = `${STAFFING_API_BASE_URL}/api/facility/applicants/${requestId}/documents/download-all`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setMessage('Document ZIP download started.');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Failed to download applicant documents');
  } finally {
    setBusy(false);
  }
}

  if (!detail) {
    return (
      <div className="space-y-8">
        <div className="page-gradient rounded-[2rem] p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Applicant Review
          </div>
          <h1 className="mt-2 text-3xl font-bold text-slate-950">
            Review applicant details
          </h1>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      </div>
    );
  }

  const fullName =
    [detail.professional.firstName, detail.professional.lastName]
      .filter(Boolean)
      .join(' ') || 'Unnamed professional';

  const approvedCount = detail.professional.documents.filter(
    (doc) => doc.status === 'APPROVED'
  ).length;
  const pendingCount = detail.professional.documents.filter(
    (doc) => doc.status === 'PENDING'
  ).length;
  const rejectedCount = detail.professional.documents.filter(
    (doc) => doc.status === 'REJECTED'
  ).length;
  const expiredCount = detail.professional.documents.filter(
    (doc) => doc.status === 'EXPIRED'
  ).length;

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Applicant Review
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">{fullName}</h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Review the applicant’s shift request and compliance documents before making a decision.
        </p>
      </div>

      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[90%] max-w-xl -translate-x-1/2 -translate-y-1/2 whitespace-pre-line rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                Request overview
              </h2>
              <StatusBadge
  label={detail.status}
  tone={
    detail.status === 'APPROVED'
      ? 'success'
      : detail.status === 'REJECTED' || detail.status === 'CANCELLED' || detail.status === 'CANCELLED'
        ? 'danger'
        : 'warning'
  }
/>
	    </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Shift
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.shift.role} • {detail.shift.shiftType}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Date
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(detail.shift.date).toLocaleDateString()}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Time
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.shift.time}
                </div>
              </div>
            </div>

           <div className="mt-6 flex flex-wrap gap-3">
  <button
    type="button"
    onClick={sendApplicantMessage}
    disabled={busy}
    className="rounded-full bg-cyan-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
  >
    {busy ? 'Working...' : 'Send Message'}
  </button>

  <a
    href="#applicant-documents"
    className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
  >
    View / Download Documents
  </a>
  {detail.status === 'CANCELLATION_REQUESTED' ? (
    <>
      <button
        onClick={() => updateCancellation('approve-cancellation')}
        disabled={busy}
        className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Working...' : 'Approve Cancellation'}
      </button>

      <button
        onClick={() => updateCancellation('deny-cancellation')}
        disabled={busy}
        className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Working...' : 'Deny Cancellation'}
      </button>
    </>
  ) : (
    <>
      <button
        onClick={() => updateStatus('approve')}
        disabled={
          busy ||
          detail.status === 'APPROVED' ||
          detail.status === 'REJECTED' || detail.status === 'CANCELLED' ||
          detail.status === 'CANCELLED'
        }
        className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Working...' : 'Approve Applicant'}
      </button>

      <button
        onClick={() => updateStatus('reject')}
        disabled={
          busy ||
          detail.status === 'REJECTED' || detail.status === 'CANCELLED' ||
          detail.status === 'CANCELLED'
        }
        className="rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Working...' : 'Reject Applicant'}
      </button>
    </>
  )}
</div> 
{detail.status === 'CANCELLATION_REQUESTED' ? (
  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
    This worker requested cancellation of an approved shift. Please approve or deny the request.
  </div>
) : null}
 
	</section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Applicant information
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Name
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">{fullName}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Role
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.professional.role}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Email
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.professional.email}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Phone
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.professional.phone || 'Not provided'}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-3 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Location
                </div>
                <div className="mt-1 text-sm font-medium text-slate-900">
                  {detail.professional.city || 'Unknown city'}
                  {detail.professional.state ? `, ${detail.professional.state}` : ''}
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
    onClick={downloadAllApplicantDocuments}
    disabled={busy || detail.professional.documents.length === 0}
    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
  >
    Download All Documents
  </button>
</div>	

            <div className="mt-5 space-y-4">
              {detail.professional.documents.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No documents uploaded yet.
                </div>
              ) : (
            detail.professional.documents.map((doc) => {
  const daysUntilExpiration = getDaysUntilExpiration(doc.expiresAt);

  return (
    <div
      key={doc.id}
      className="rounded-2xl border border-slate-200 px-4 py-4"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-base font-semibold text-slate-950">
            {doc.name}
          </div>

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

        {doc.expiresAt ? (
          <div className="text-sm text-slate-500">
            Expires: {new Date(doc.expiresAt).toLocaleDateString()}
          </div>
        ) : null}

        {/* EXPIRATION WARNING */}
        {doc.expiresAt && daysUntilExpiration != null ? (
          daysUntilExpiration < 0 ? (
            <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              This document expired on{' '}
              {new Date(doc.expiresAt).toLocaleDateString()}.
            </div>
          ) : daysUntilExpiration < 30 ? (
            <div className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Warning: expires in {daysUntilExpiration} day
              {daysUntilExpiration === 1 ? '' : 's'}.
            </div>
          ) : null
        ) : null}

        {doc.notes ? (
          <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {doc.notes}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/view`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            View Document
          </a>

          <a
            href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/download`}
            className="inline-flex rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
          >
            Download Document
          </a>
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
              Compliance summary
            </div>
            <div className="mt-3 text-2xl font-bold tracking-tight">
              {detail.professional.documents.length} document
              {detail.professional.documents.length === 1 ? '' : 's'}
            </div>
            <div className="mt-2 text-cyan-50">
              Review uploaded compliance records before approving this applicant.
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Document status counts
            </h2>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Approved: {approvedCount}
              </div>
              <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-700">
                Pending: {pendingCount}
              </div>
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                Rejected: {rejectedCount}
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Expired: {expiredCount}
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Do Not Return (DNR)
            </h2>

            {detail.professional.isDnr ? (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-700">
                This worker is currently on this facility’s DNR list.
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Add this worker to the facility DNR list to block future shift requests.
              </div>
            )}

            <div className="mt-4">
              <TextArea
                rows={4}
                value={dnrReason}
                onChange={(e) => setDnrReason(e.target.value)}
                placeholder="Optional DNR reason"
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {!detail.professional.isDnr ? (
                <button
                  onClick={addDnr}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                >
                  Mark DNR
                </button>
              ) : (
                <button
                  onClick={removeDnr}
                  disabled={busy}
                  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Remove DNR
                </button>
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold tracking-tight text-slate-950">
              Review guidance
            </h2>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Focus on compliance document readiness for this shift request.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Check for rejected, expired, or missing required documents.
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                Use DNR when a worker should not be allowed to return to this facility.
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
