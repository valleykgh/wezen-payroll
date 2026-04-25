'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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

function formatShiftDate(dateValue: string) {
  const dateOnly = dateValue.split('T')[0];
  const [year, month, day] = dateOnly.split('-');
  return `${Number(month)}/${Number(day)}/${year}`;
}

export default function FacilityDashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData['data'] | null>(null);
  const [message, setMessage] = useState('Loading dashboard...');
  const [report, setReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const today = new Date();
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(today.getDate() - 30);

const [startDate, setStartDate] = useState(
  thirtyDaysAgo.toISOString().split('T')[0]
);
const [endDate, setEndDate] = useState(
  today.toISOString().split('T')[0]
);  
 
async function loadReport() {
  try {
    setLoadingReport(true);

    const res = await apiFetch<{ data: any }>(
      `/api/facility/reports/shifts?startDate=${startDate}&endDate=${endDate}`
    );

    setReport(res.data);
  } catch (err) {
    console.error('Failed to load report', err);
  } finally {
    setLoadingReport(false);
  }
}

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
    loadReport();
  }, []);

const chartData = report
  ? [
      { name: 'Total', value: report.summary.totalShifts },
      { name: 'Completed', value: report.summary.completedShifts },
      { name: 'Unfilled', value: report.summary.unfilledShifts },
      { name: 'Cancelled', value: report.summary.cancelledShifts },
    ]
  : [];

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
  {dashboard.recentShifts.map((shift) => {
    const needsReview = shift.applicants > 0 && shift.approvedCount === 0;

    return (
      <tr
        key={shift.id}
        className={`border-b border-slate-100 transition last:border-0 ${
          needsReview ? 'bg-amber-50 hover:bg-amber-100/60' : 'hover:bg-slate-50'
        }`}
      >
        <td className="py-4 pr-4 font-medium text-slate-950">{shift.role}</td>
        <td className="py-4 pr-4 text-slate-600">{shift.shiftType}</td>
        <td className="py-4 pr-4 text-slate-600">
        {formatShiftDate(shift.date)}
	</td>

        <td className="py-4 pr-4">
          {needsReview ? (
            <Link
              href="/facility/applicants"
              className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 animate-pulse"
            >
              {shift.applicants} applicant{shift.applicants > 1 ? 's' : ''} to review
            </Link>
          ) : (
            <span className="text-slate-600">{shift.applicants}</span>
          )}
        </td>

        <td className="py-4 pr-4 text-slate-600">{shift.approvedCount}</td>

        <td className="py-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label={shift.status} tone="info" />
            {needsReview ? (
              <Link
                href="/facility/applicants"
                className="inline-flex items-center rounded-full bg-cyan-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-cyan-700"
              >
                Review Applicants
              </Link>
            ) : null}
          </div>
        </td>
      </tr>
    );
  })}
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
           <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h2 className="text-xl font-bold text-slate-950">
      Shift Analytics
    </h2>
  <a
    href={`${STAFFING_API_BASE_URL}/api/facility/reports/shifts/export?startDate=${startDate}&endDate=${endDate}`}
    className="inline-flex items-center justify-center rounded-full border border-cyan-300 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
  >
    Export CSV
  </a>  
  </div>

  {/* Date Filters */}
  <div className="mt-4 flex flex-wrap gap-3">
    <input
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      className="rounded-xl border px-3 py-2"
    />
    <input
      type="date"
      value={endDate}
      onChange={(e) => setEndDate(e.target.value)}
      className="rounded-xl border px-3 py-2"
    />
    <button
      onClick={loadReport}
      className="rounded-full bg-cyan-600 px-4 py-2 text-white text-sm font-semibold"
    >
      Refresh
    </button>
  </div>

  {/* Summary Cards */}
  {report ? (
   <> 
    <div className="mt-6 grid gap-4 md:grid-cols-4">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="text-xs text-slate-500">Total Shifts</div>
        <div className="text-xl font-bold">{report.summary.totalShifts}</div>
      </div>

      <div className="rounded-2xl bg-emerald-50 p-4">
        <div className="text-xs text-emerald-700">Completed</div>
        <div className="text-xl font-bold">{report.summary.completedShifts}</div>
      </div>

      <div className="rounded-2xl bg-amber-50 p-4">
        <div className="text-xs text-amber-700">Unfilled</div>
        <div className="text-xl font-bold">{report.summary.unfilledShifts}</div>
      </div>

      <div className="rounded-2xl bg-cyan-50 p-4">
        <div className="text-xs text-cyan-700">Fill Rate</div>
        <div className="text-xl font-bold">{report.summary.fillRate}%</div>
      </div>
    </div>
    <div className="mt-6 h-72 rounded-2xl border border-slate-200 bg-white p-4">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData}>
      <XAxis dataKey="name" />
      <YAxis allowDecimals={false} />
      <Tooltip />
      <Bar dataKey="value" />
    </BarChart>
  </ResponsiveContainer>
</div>
  </>
  ) : (
    <div className="mt-6 text-sm text-slate-500">
      {loadingReport ? 'Loading analytics...' : 'No data'}
    </div>
  )}
</section>
        </>
      ) : null}
    </div>
  );
}
