'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

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
    }>;
  };
};

export function FacilityApplicantDetailClient({ requestId }: { requestId: string }) {
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dnrReason, setDnrReason] = useState('');
  const [facilityNotes, setFacilityNotes] = useState('');

  async function loadDetail() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: ApplicantDetail }>(
        `/api/facility/applicants/${requestId}`
      );
      setDetail(res.data);
      setFacilityNotes(res.data.reviewNotes || '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load applicant detail');
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(action: 'approve' | 'reject' | 'no-show') {
    setBusy(true);
    setMessage('');

    try {
      const reason =
        action === 'reject'
          ? window.prompt('Please enter the reason for rejecting this applicant:')?.trim()
          : undefined;

      if (action === 'reject' && !reason) {
        setMessage('Rejection reason is required.');
        return;
      }

      await apiFetch(`/api/shift-requests/${requestId}/${action}`, {
        method: 'POST',
        ...(reason ? { body: JSON.stringify({ reason }) } : {}),
      });

      setMessage(
        action === 'approve'
          ? 'Applicant approved.'
          : action === 'reject'
            ? 'Applicant rejected.'
            : 'Worker marked no-show.'
      );
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update applicant');
    } finally {
      setBusy(false);
    }
  }

  async function updateCancellation(action: 'approve-cancellation' | 'deny-cancellation') {
    setBusy(true);
    setMessage('');

    try {
      const reason =
        action === 'deny-cancellation'
          ? window.prompt('Reason for denying cancellation request?')?.trim()
          : undefined;

      if (action === 'deny-cancellation' && !reason) {
        setMessage('Cancellation denial reason is required.');
        return;
      }

      await apiFetch(`/api/shift-requests/${requestId}/${action}`, {
        method: 'POST',
        ...(reason ? { body: JSON.stringify({ reason }) } : {}),
      });

      setMessage(
        action === 'approve-cancellation'
          ? 'Cancellation approved. Shift slot reopened if needed.'
          : 'Cancellation denied. Worker remains scheduled.'
      );

      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to update cancellation request');
    } finally {
      setBusy(false);
    }
  }

  async function saveFacilityNotes() {
    setBusy(true);
    setMessage('');

    try {
      await apiFetch(`/api/shift-requests/${requestId}/notes`, {
        method: 'PUT',
        body: JSON.stringify({ notes: facilityNotes }),
      });

      setMessage('Facility note saved.');
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save facility note');
    } finally {
      setBusy(false);
    }
  }

  async function addDnr() {
    if (!detail?.professional.id) return;

    setBusy(true);
    setMessage('');

    try {
      await apiFetch('/api/facility/dnr', {
        method: 'POST',
        body: JSON.stringify({
          professionalId: detail.professional.id,
          reason: dnrReason || undefined,
        }),
      });

      setMessage('Worker added to DNR list.');
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add worker to DNR');
    } finally {
      setBusy(false);
    }
  }

  async function removeDnr() {
    if (!detail?.professional.id) return;

    setBusy(true);
    setMessage('');

    try {
      await apiFetch(`/api/facility/dnr?professionalId=${detail.professional.id}`, {
        method: 'DELETE',
      });

      setMessage('Worker removed from DNR list.');
      await loadDetail();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to remove worker from DNR');
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);





  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  if (loading) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Loading applicant...</div>;
  }

  if (!detail) {
    return <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">Applicant not found.</div>;
  }

  const workerName =
    [detail.professional.firstName, detail.professional.lastName].filter(Boolean).join(' ') ||
    detail.professional.email;

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
          {detail.professional.role}
        </p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">{workerName}</h2>
        <p className="mt-1 text-sm text-slate-600">{detail.professional.email}</p>
        <p className="mt-1 text-sm text-slate-500">{detail.professional.phone || 'No phone listed'}</p>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">
              {detail.status === 'NO_SHOW' ? 'Shift Attendance' : 'Request Status'}
            </p>
            <p className="font-bold text-slate-950">
              {detail.status === 'NO_SHOW' ? 'No-show for this shift only' : detail.status}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Location</p>
            <p className="font-bold text-slate-950">
              {[detail.professional.city, detail.professional.state].filter(Boolean).join(', ') || '—'}
            </p>
          </div>
        </div>

        {detail.status === 'NO_SHOW' ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            This no-show status applies only to this shift request.
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-900">Facility private note</p>
          <p className="mt-1 text-xs text-slate-500">Visible to facility/admin only. Not shown to worker.</p>

          <textarea
            value={facilityNotes}
            onChange={(e) => setFacilityNotes(e.target.value)}
            placeholder="Example: strong worker, late response, good fit for NOC..."
            className="mt-3 min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
          />

          <button
            type="button"
            onClick={saveFacilityNotes}
            disabled={busy}
            className="mt-3 w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Saving...' : 'Save Facility Note'}
          </button>
        </div>

        {detail.professional.isDnr ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <div>Facility DNR active: {detail.professional.dnrReason || 'No reason listed'}</div>
            <button
              type="button"
              onClick={removeDnr}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-bold text-rose-700 ring-1 ring-rose-200 disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Remove from DNR'}
            </button>
          </div>
        ) : (
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              Advanced action: Add worker to facility DNR
            </summary>

            <p className="mt-3 text-xs text-slate-600">
              Use only if your facility does not want this worker to request future shifts. This does not affect other facilities.
            </p>

            <textarea
              value={dnrReason}
              onChange={(e) => setDnrReason(e.target.value)}
              placeholder="Optional reason"
              className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
            />

            <button
              type="button"
              onClick={addDnr}
              disabled={busy}
              className="mt-3 w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Confirm Add to DNR'}
            </button>
          </details>
        )}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-lg font-bold text-slate-950">Requested Shift</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Role</p>
            <p className="font-bold text-slate-950">{detail.shift.role} • {detail.shift.shiftType}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Date</p>
            <p className="font-bold text-slate-950">{new Date(detail.shift.date).toLocaleDateString()}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Time</p>
            <p className="font-bold text-slate-950">{detail.shift.time}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-3">
            <p className="text-slate-500">Facility</p>
            <p className="font-bold text-slate-950">{detail.shift.facilityName}</p>
          </div>
        </div>

        {detail.status !== 'APPROVED' && detail.status !== 'REJECTED' && detail.status !== 'NO_SHOW' ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => updateStatus('approve')}
              disabled={busy}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Approve'}
            </button>

            <button
              type="button"
              onClick={() => updateStatus('reject')}
              disabled={busy}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? 'Working...' : 'Reject'}
            </button>
          </div>
        ) : null}

        {detail.status === 'CANCELLATION_REQUESTED' ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">Cancellation requested</p>
            <p className="mt-1 text-xs text-amber-800">
              Approve to release the worker and reopen the shift slot if coverage is still needed. Deny to keep the worker scheduled.
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateCancellation('approve-cancellation')}
                disabled={busy}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Working...' : 'Approve Cancel'}
              </button>

              <button
                type="button"
                onClick={() => updateCancellation('deny-cancellation')}
                disabled={busy}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Working...' : 'Deny Cancel'}
              </button>
            </div>
          </div>
        ) : null}

        {detail.status === 'APPROVED' ? (
          <button
            type="button"
            onClick={() => updateStatus('no-show')}
            disabled={busy}
            className="mt-4 w-full rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Working...' : 'Mark No-Show'}
          </button>
        ) : null}
      </div>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h3 className="text-lg font-bold text-slate-950">Documents</h3>

        <div className="mt-4 grid gap-3">
          {detail.professional.documents.length === 0 ? (
            <p className="text-sm text-slate-600">No documents uploaded.</p>
          ) : null}

          {detail.professional.documents.map((doc) => (
            <div key={doc.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-950">{doc.name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {doc.category} • {doc.status}
                  </p>
                  {doc.expiresAt ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Expires {new Date(doc.expiresAt).toLocaleDateString()}
                    </p>
                  ) : null}
                </div>

                {doc.fileUrl ? (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-white px-3 py-2 text-xs font-bold text-cyan-700 ring-1 ring-cyan-200"
                  >
                    View
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
