'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { meRequest, type AuthMeResponse } from '@/lib/auth-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type AdminShiftRequest = {
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
    facilityCity?: string | null;
    facilityState?: string | null;
  };
  professional: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
    city?: string | null;
    state?: string | null;
  };
};

export default function AdminShiftRequestsPage() {
  const [requests, setRequests] = useState<AdminShiftRequest[]>([]);
  const [message, setMessage] = useState('Loading shift requests...');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthMeResponse['data'] | null>(null);
  const isDefaultAdmin = currentUser?.email?.toLowerCase() === 'admin@wezenstaffing.com';

  async function load() {
    const res = await apiFetch<{ data: AdminShiftRequest[] }>('/api/admin/shift-requests');
    setRequests(res.data);
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load shift requests');
      }
    }

    init();
  }, []);

  async function cancelRequest(requestId: string) {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this shift request?'
    );

    if (!confirmed) return;

    try {
      setBusyId(requestId);
      setMessage('');

      const res = await fetch(
        `${STAFFING_API_BASE_URL}/api/admin/shift-requests/${requestId}/cancel`,
        {
          method: 'POST',
          credentials: 'include',
        }
      );

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to cancel shift request');
      }

      await load();
      setMessage('Shift request cancelled successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to cancel shift request');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          Shift request controls
        </h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Review worker requests across facilities and cancel requests when admin override is needed.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.id}
            className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-xl font-bold tracking-tight text-slate-950">
                    {request.professional.firstName} {request.professional.lastName}
                  </div>

                  <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {request.status}
                  </div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {request.professional.role} • {request.professional.email}
                </div>

                <div className="mt-1 text-sm text-slate-500">
                  {request.professional.city || 'Unknown city'}
                  {request.professional.state ? `, ${request.professional.state}` : ''}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Facility
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.facilityName}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Shift
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.role} • {request.shift.shiftType}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {new Date(request.shift.date).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">
                      {request.shift.time}
                    </div>
                  </div>
                </div>

                {request.reviewNotes ? (
                  <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    <span className="font-semibold text-slate-900">Notes:</span>{' '}
                    {request.reviewNotes}
                  </div>
                ) : null}
              </div>

              {isDefaultAdmin ? (
                <div className="flex w-full flex-col gap-3 lg:w-56">
                  <button
                    onClick={() => cancelRequest(request.id)}
                    disabled={busyId === request.id || request.status === 'CANCELLED'}
                    className="inline-flex items-center justify-center rounded-full bg-rose-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                  >
                    {busyId === request.id ? 'Working...' : 'Cancel Request'}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {requests.length === 0 && !message ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          No shift requests found.
        </div>
      ) : null}
    </div>
  );
}
