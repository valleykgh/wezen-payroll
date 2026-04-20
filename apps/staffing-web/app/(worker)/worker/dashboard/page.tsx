'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { apiFetch } from '@/lib/api-client';
import { PAYROLL_PORTAL_URL } from '@/lib/payroll';
import { getPayrollSummary, type PayrollSummary } from '@/lib/payroll-client';
import { useRouter } from 'next/navigation';

type WorkerDashboardResponse = {
  profile: {
    professionalId: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    role: string;
    onboardingStatus?: string | null;
    approvedByWezen: boolean;
  };
  stats: {
    profileStatus: string;
    documents: {
      approved: number;
      pending: number;
      rejected: number;
      expired: number;
      total: number;
    };
    agreementStatus: string;
    requests: {
      total: number;
      approved: number;
      pending: number;
      rejected: number;
    };
    upcomingShiftCount: number;
    eligibleForShifts: boolean;
    eligibilityReasons: string[];
  };
  upcomingShifts: Array<{
    id: string;
    facilityName: string;
    role: string;
    shiftType: string;
    date: string;
    time: string;
    startTimeLabel?: string;
    endTimeLabel?: string;
    city?: string | null;
    state?: string | null;
    address?: string | null;
    specialInstructions?: string | null;
    status: string;
  }>;
};

export default function WorkerDashboardPage() {
  const [dashboard, setDashboard] = useState<WorkerDashboardResponse | null>(null);
  const [message, setMessage] = useState('Loading dashboard...');
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollMessage, setPayrollMessage] = useState('Loading payroll summary...');
  const router = useRouter();
  useEffect(() => {
    async function loadDashboard() {
      try {
        const res = await apiFetch<{ data: WorkerDashboardResponse }>('/api/worker/dashboard');
        setDashboard(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load dashboard');
      }
    }

    async function loadPayrollSummary() {
      try {
        const summary = await getPayrollSummary();
        setPayrollSummary(summary);
        setPayrollMessage('');
      } catch (error) {
        setPayrollMessage(
          error instanceof Error ? error.message : 'Failed to load payroll summary'
        );
      }
    }

    loadDashboard();
    loadPayrollSummary();
  }, []);
  
useEffect(() => {
  if (!dashboard) return;

  const docs = dashboard.stats.documents;
  const agreementStatus = dashboard.stats.agreementStatus;
  const approvedByWezen = dashboard.profile.approvedByWezen;

  const hasRequiredDocs =
    docs.total > 0 &&
    docs.pending === 0 &&
    docs.rejected === 0 &&
    docs.expired === 0;

  if (!hasRequiredDocs) {
    router.push('/worker/documents');
    return;
  }

  if (agreementStatus !== 'SIGNED') {
    router.push('/worker/agreements');
    return;
  }

  if (!approvedByWezen) {
    return;
  }
}, [dashboard, router]);

 const statCards = dashboard
    ? [
{
  label: 'Profile Status',
  value:
  dashboard.stats.profileStatus === 'UNDER_REVIEW'
    ? 'Under Review'
    : dashboard.stats.profileStatus === 'APPROVED'
      ? 'Approved'
      : dashboard.stats.profileStatus,
  helper: dashboard.profile.approvedByWezen
    ? 'Ready for shifts'
    : dashboard.stats.documents.pending > 0 ||
      dashboard.stats.documents.rejected > 0 ||
      dashboard.stats.documents.expired > 0 ||
      dashboard.stats.documents.total === 0
      ? 'Complete docs'
      : dashboard.stats.agreementStatus !== 'SIGNED'
        ? 'ICA pending'
        : 'Awaiting approval', 
 tone: dashboard.profile.approvedByWezen
    ? ('success' as const)
    : dashboard.stats.documents.pending > 0 ||
      dashboard.stats.documents.rejected > 0 ||
      dashboard.stats.documents.expired > 0 ||
      dashboard.stats.documents.total === 0
      ? ('warning' as const)
      : dashboard.stats.agreementStatus !== 'SIGNED'
        ? ('warning' as const)
        : ('info' as const),
},	
	{
          label: 'Documents',
          value: `${dashboard.stats.documents.approved}/${dashboard.stats.documents.total}`,
          helper: `${dashboard.stats.documents.pending} pending, ${dashboard.stats.documents.rejected} rejected`,
          tone:
            dashboard.stats.documents.pending > 0 || dashboard.stats.documents.rejected > 0
              ? ('warning' as const)
              : ('success' as const),
        },
        {
          label: 'My Requests',
          value: String(dashboard.stats.requests.total),
          helper: `${dashboard.stats.requests.pending} pending`,
          tone: dashboard.stats.requests.pending > 0 ? ('info' as const) : ('default' as const),
        },
        {
          label: 'Upcoming Shifts',
          value: String(dashboard.stats.upcomingShiftCount),
          helper:
            dashboard.stats.upcomingShiftCount > 0 ? 'Approved schedule' : 'No approved shifts yet',
          tone:
            dashboard.stats.upcomingShiftCount > 0 ? ('success' as const) : ('default' as const),
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Your Activity
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Shift &amp; Approval Overview
        </h1>
        <p className="mt-2 text-slate-600">
          Track your onboarding progress, requests, upcoming schedule, and payroll access.
        </p>
      </div>

      {message && !dashboard ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {dashboard ? (
  (() => {
    const docs = dashboard.stats.documents;
    const agreementStatus = dashboard.stats.agreementStatus;
    const approvedByWezen = dashboard.profile.approvedByWezen;

    const hasDocIssues =
      docs.total === 0 ||
      docs.pending > 0 ||
      docs.rejected > 0 ||
      docs.expired > 0;

    if (approvedByWezen) {
      return (
        <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-6 py-5 text-emerald-800 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
            Approved
          </div>
          <div className="mt-2 text-xl font-bold">
            Your profile has been approved by Wezen
          </div>
          <div className="mt-2 text-sm">
            You can now request available shifts from the marketplace.
          </div>
        </div>
      );
    }

    if (hasDocIssues) {
      return (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-6 py-5 text-amber-800 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            Next step
          </div>
          <div className="mt-2 text-xl font-bold">
            Complete your required documents
          </div>
          <div className="mt-2 text-sm">
            Upload and resolve all required compliance documents so your onboarding can move forward.
          </div>
        </div>
      );
    }

    if (agreementStatus !== 'SIGNED') {
      return (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-6 py-5 text-amber-900 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-700">
            ICA Required
          </div>
          <div className="mt-2 text-xl font-bold">
            Your Independent Contractor Agreement must be completed
          </div>
          <div className="mt-2 text-sm">
            Wezen Staffing will send your ICA through Adobe eSign. After it is signed and confirmed,
            you will be approved to begin requesting shifts.
          </div>
        </div>
      );
    }	

    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-5 text-slate-700 shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
          Status
        </div>
        <div className="mt-2 text-xl font-bold text-slate-950">
          Your profile is under Wezen review
        </div>
        <div className="mt-2 text-sm">
          Your agreement has been signed and your profile is waiting for final approval.
        </div>
      </div>
    );
  })()
) : null}


      {dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((stat) => (
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
                  Upcoming shifts
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Your approved schedule for upcoming dates.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {dashboard.upcomingShifts.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    No approved upcoming shifts yet.
                  </div>
                ) : (
                  dashboard.upcomingShifts.map((shift) => (
  <div
    key={shift.id}
    className="rounded-[1.25rem] border border-slate-200 p-4 transition hover:shadow-sm"
  >
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <div className="text-lg font-semibold text-slate-950">
          {shift.role} • {shift.shiftType}
        </div>

        <div className="mt-1 text-sm font-medium text-slate-700">
          {shift.facilityName}
        </div>

        <div className="mt-1 text-sm text-slate-500">
          {shift.address?.trim()
            ? shift.address
            : [shift.city, shift.state].filter(Boolean).join(', ') || 'Location not available'}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Date
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {new Date(shift.date).toLocaleDateString()}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Time
            </div>
            <div className="mt-1 text-sm font-medium text-slate-900">
              {shift.time}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status
            </div>
            <div className="mt-1">
              <StatusBadge label={shift.status} tone="success" />
            </div>
          </div>
        </div>

        {shift.specialInstructions?.trim() ? (
          <div className="mt-4 rounded-2xl bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <div className="text-xs font-semibold uppercase tracking-wide text-cyan-700">
              Special instructions
            </div>
            <div className="mt-1">{shift.specialInstructions}</div>
          </div>
        ) : null}
      </div>
    </div>
  </div>
))
		)}
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-xl font-bold tracking-tight text-slate-950">
                  Onboarding status
                </h2>

                <div className="mt-5 space-y-3 text-sm text-slate-600">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-slate-900">Approval:</span>{' '}
                    {dashboard.profile.approvedByWezen ? 'Approved by Wezen' : 'Pending internal review'}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-slate-900">Agreement:</span>{' '}
                    {dashboard.stats.agreementStatus}
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="font-semibold text-slate-900">Documents:</span>{' '}
                    {dashboard.stats.documents.approved} approved, {dashboard.stats.documents.pending} pending,{' '}
                    {dashboard.stats.documents.rejected} rejected, {dashboard.stats.documents.expired} expired
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
                <h2 className="text-xl font-bold tracking-tight">Payroll portal</h2>
                <p className="mt-3 text-sm leading-6 text-cyan-50/90">
                  Use the payroll portal for pay cycles, payments, payroll history, and ledger-related activity.
                </p>
                <a
                  href={PAYROLL_PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 inline-flex min-h-[44px] items-center justify-center rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                >
                  <span className="whitespace-nowrap">Go to Payroll Portal ↗</span>
                </a>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-slate-950">
                      Payroll summary
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      This section is read-only and connects to the payroll side when available.
                    </p>
                  </div>

                  <div
                    className={
                      payrollSummary?.status === 'connected'
                        ? 'rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700'
                        : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'
                    }
                  >
                    {payrollSummary?.status === 'connected' ? 'Connected' : 'Portal Only'}
                  </div>
                </div>

                {payrollMessage && !payrollSummary ? (
                  <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    {payrollMessage}
                  </div>
                ) : null}

                {payrollSummary ? (
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Current pay period
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {payrollSummary.currentPayPeriodLabel || 'Available in payroll portal'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Latest payment
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {payrollSummary.latestPaymentAmountLabel || 'Available in payroll portal'}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {payrollSummary.latestPaymentDateLabel || ''}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Pending payroll
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {payrollSummary.pendingPayrollAmountLabel || 'Available in payroll portal'}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ledger summary
                      </div>
                      <div className="mt-1 text-sm font-medium text-slate-900">
                        {payrollSummary.ledgerSummaryLabel || 'Open payroll portal for details'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
