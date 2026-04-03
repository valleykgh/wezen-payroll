import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { workerDashboardStats, workerUpcomingShifts } from '@/lib/mock-data';

export default function WorkerDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Professional Dashboard"
        title="Track approvals, documents, and upcoming shifts"
        description="Manage your onboarding progress, view approved requests, and jump into payroll when needed."
      />

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
                className="rounded-[1.25rem] border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-lg font-semibold text-slate-950">
                      {shift.role} • {shift.shiftType}
                    </div>
                    <div className="mt-1 text-sm text-slate-600">{shift.facility}</div>
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
              Use the payroll portal for payroll-related activity while keeping shift workflows inside Wezen Staffing.
            </p>
            <a
              href="https://payroll.wezenstaffing.com"
              className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900"
            >
              Go to Payroll Portal
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
