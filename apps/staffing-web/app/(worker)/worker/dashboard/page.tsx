'use client';

import { useEffect, useState } from 'react';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { workerDashboardStats, workerUpcomingShifts } from '@/lib/mock-data';
import { PAYROLL_PORTAL_URL } from '@/lib/payroll';
import { getPayrollSummary, type PayrollSummary } from '@/lib/payroll-client';

export default function WorkerDashboardPage() {
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [payrollMessage, setPayrollMessage] = useState('Loading payroll summary...');

  useEffect(() => {
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

    loadPayrollSummary();
  }, []);

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
          Track your progress, requests, upcoming schedule, and payroll access.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workerDashboardStats.map((stat) => (
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
              Your approved schedule for the next few days.
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {workerUpcomingShifts.map((shift) => (
              <div
                key={shift.id}
                className="rounded-[1.25rem] border border-slate-200 p-4 transition hover:shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      {shift.role} • {shift.shiftType}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      {shift.facility}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {shift.date} • {shift.distance}
                    </div>
                  </div>
                  <StatusBadge label={shift.status} tone="success" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Documents status
            </h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-700">
                License verification approved.
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">
                TB test needs upload.
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">
                CPR certificate expires in 14 days.
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
                  This section is read-only and will later connect to the payroll system directly.
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
    </div>
  );
}
