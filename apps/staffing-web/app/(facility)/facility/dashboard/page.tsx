import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { facilityDashboardStats, recentFacilityShifts } from '@/lib/mock-data';

export default function FacilityDashboardPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Facility Dashboard"
        title="Manage shifts, applicants, and compliance"
        description="See open coverage needs, review incoming applicants, and keep your facility staffed with qualified professionals."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {facilityDashboardStats.map((stat) => (
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                Recent shifts
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Review active and recently posted shifts.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 pr-4 font-medium">Role</th>
                  <th className="py-3 pr-4 font-medium">Shift</th>
                  <th className="py-3 pr-4 font-medium">Date</th>
                  <th className="py-3 pr-4 font-medium">Location</th>
                  <th className="py-3 pr-4 font-medium">Applicants</th>
                  <th className="py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentFacilityShifts.map((shift) => (
                  <tr key={shift.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-4 pr-4 font-medium text-slate-950">{shift.role}</td>
                    <td className="py-4 pr-4 text-slate-600">{shift.shiftType}</td>
                    <td className="py-4 pr-4 text-slate-600">{shift.date}</td>
                    <td className="py-4 pr-4 text-slate-600">{shift.location}</td>
                    <td className="py-4 pr-4 text-slate-600">{shift.applicants}</td>
                    <td className="py-4">
                      <StatusBadge
                        label={shift.status}
                        tone={
                          shift.status === 'Filled'
                            ? 'success'
                            : shift.status === 'Pending'
                              ? 'warning'
                              : 'info'
                        }
                      />
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
            <div className="mt-5 grid gap-3">
              <button className="rounded-2xl bg-slate-900 px-4 py-3 text-left text-sm font-semibold text-white">
                Post a new shift
              </button>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900">
                Review applicants
              </button>
              <button className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-900">
                Check compliance alerts
              </button>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Compliance alerts
            </h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-700">
                2 applicants have missing TB test documentation.
              </div>
              <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-700">
                1 clinician has a CPR certification expiring soon.
              </div>
              <div className="rounded-2xl bg-cyan-50 px-4 py-3 text-cyan-700">
                3 new shift requests are awaiting facility review.
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
