'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type FacilityRequest = {
  id: string;
  status: string;
  requestedAt: string;
  shift: {
    role: string;
    shiftType: string;
    date: string;
    time: string;
    facilityName: string;
    city: string | null;
    state: string | null;
  };
  professional: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    role: string;
    city: string | null;
    state: string | null;
  };
};

export function FacilityApplicantsClient() {
  const [requests, setRequests] = useState<FacilityRequest[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');

  async function loadRequests() {
    setLoading(true);
    setMessage('');

    try {
      const res = await apiFetch<{ data: FacilityRequest[] }>('/api/facility/requests');
      setRequests(res.data || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load applicants');
    } finally {
      setLoading(false);
    }
  }

  async function updateRequest(id: string, action: 'approve' | 'reject') {
    setBusyId(id);
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

      await apiFetch(`/api/shift-requests/${id}/${action}`, {
        method: 'POST',
        ...(reason ? { body: JSON.stringify({ reason }) } : {}),
      });
      setMessage(action === 'approve' ? 'Applicant approved.' : 'Applicant rejected.');
      await loadRequests();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Failed to ${action} applicant`);
    } finally {
      setBusyId('');
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);



  useEffect(() => {
    loadRequests();
  }, []);

  return (
    <div className="grid gap-4">
      {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Loading applicants...
        </div>
      ) : null}

      {!loading && requests.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No applicants yet.
        </div>
      ) : null}

      {requests.map((request) => {
        const workerName =
          [request.professional.firstName, request.professional.lastName].filter(Boolean).join(' ') ||
          request.professional.email ||
          'Unknown worker';

        return (
          <div key={request.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {request.professional.role}
                </p>
                <Link href={`/app/facility/applicant-detail/index.html?requestId=${request.id}`} className="mt-2 block text-lg font-bold text-slate-950 underline decoration-slate-300 underline-offset-4">{workerName}</Link>
                <p className="mt-1 text-sm text-slate-600">{request.professional.email}</p>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                {request.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Shift</p>
                <p className="font-bold text-slate-950">
                  {request.shift.role} • {request.shift.shiftType}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Date</p>
                <p className="font-bold text-slate-950">
                  {new Date(request.shift.date).toLocaleDateString()}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Time</p>
                <p className="font-bold text-slate-950">{request.shift.time}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-slate-500">Location</p>
                <p className="font-bold text-slate-950">
                  {[request.shift.city, request.shift.state].filter(Boolean).join(', ') || '—'}
                </p>
              </div>
            </div>

            {request.status !== 'APPROVED' && request.status !== 'REJECTED' ? (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateRequest(request.id, 'approve')}
                  disabled={busyId === request.id}
                  className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyId === request.id ? 'Working...' : 'Approve'}
                </button>

                <button
                  type="button"
                  onClick={() => updateRequest(request.id, 'reject')}
                  disabled={busyId === request.id}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {busyId === request.id ? 'Working...' : 'Reject'}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
