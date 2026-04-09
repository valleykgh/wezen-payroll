'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';

type DashboardData = {
  data: {
    stats: {
      openShifts: number;
      pendingRequests: number;
      approvedRequests: number;
      activeWorkers: number;
      complianceAlerts: number;
    };
    recentShifts: Array<{
      id: string;
      role: string;
      shiftType: string;
      date: string;
      applicants: number;
      approvedCount: number;
      status: string;
    }>;
  };
};

export default function FacilityDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData['data'] | null>(null);
  const [message, setMessage] = useState('Loading dashboard...');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<DashboardData>('/api/facility/dashboard');
        setDashboard(res.data);
        setMessage('');
              } catch (error) {
        const fallback = 'Failed to load dashboard';

        if (
          error instanceof Error &&
          error.message.includes('Facility is inactive')
        ) {
          setMessage(
            'Facility access has been deactivated. Please contact Wezen Staffing support.'
          );
        } else {
          setMessage(error instanceof Error ? error.message : fallback);
        }
      }
}
    load();
  }, []);

  const stats = dashboard
    ? [
        { label: 'Open shifts', value: String(dashboard.stats.openShifts), helper: 'Currently open', tone: 'info' as const },
        { label: 'Pending requests', value: String(dashboard.stats.pendingRequests), helper: 'Awaiting review', tone: 'warning' as const },
        { label: 'Approved requests', value: String(dashboard.stats.approvedRequests), helper: 'Approved so far', tone: 'success' as const },
        { label: 'Active workers', value: String(dashboard.stats.activeWorkers), helper: 'Connected to facility', tone: 'default' as const },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Overview
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Facility Operations
        </h1>
        <p className="mt-2 text-slate-600">
          Live snapshot of staffing, approvals, and compliance.
        </p>
      </div>

        {message && !dashboard ? (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <div className="text-lg font-semibold text-amber-900">
            Access unavailable
          </div>
          <p className="mt-2 text-sm text-amber-800">
            {message}
          </p>
        </div>
      ) : null}

      {dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                helper={stat.helper}
                tone={stat.tone}
              />
            ))}
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  Recent shifts
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Review active and recent shift activity.
                </p>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-3 pr-4 font-medium">Role</th>
                      <th className="py-3 pr-4 font-medium">Shift</th>
                      <th className="py-3 pr-4 font-medium">Date</th>
                      <th className="py-3 pr-4 font-medium">Applicants</th>
                      <th className="py-3 pr-4 font-medium">Approved</th>
                      <th className="py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentShifts.map((shift) => (
                      <tr
                        key={shift.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50 last:border-0"
                      >
                        <td className="py-4 pr-4 font-medium text-slate-950">{shift.role}</td>
                        <td className="py-4 pr-4 text-slate-600">{shift.shiftType}</td>
                        <td className="py-4 pr-4 text-slate-600">
                          {new Date(shift.date).toLocaleDateString()}
                        </td>
                        <td className="py-4 pr-4 text-slate-600">{shift.applicants}</td>
                        <td className="py-4 pr-4 text-slate-600">{shift.approvedCount}</td>
                        <td className="py-4">
                          <StatusBadge label={shift.status} tone="info" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  Quick actions
                </h2>
                <div className="mt-4 space-y-3">
                  <Link
                    href="/facility/shifts/post"
                    className="block rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700"
                  >
                    Post a new shift
                  </Link>

                  <Link
                    href="/facility/applicants"
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Review applicants
                  </Link>

                  <Link
                    href="/facility/compliance"
                    className="block rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    Check compliance alerts
                  </Link>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  Compliance alerts
                </h2>
                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700">
                    {dashboard.stats.complianceAlerts} active compliance alert(s).
                  </div>
                  <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-cyan-700">
                    {dashboard.stats.pendingRequests} shift request(s) awaiting facility review.
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
