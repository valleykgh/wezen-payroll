import { marketplaceShifts } from '@/lib/mock-data';
import { StatusBadge } from '@/components/shared/status-badge';

export function ShiftResults() {
  return (
    <div className="space-y-4">
      {marketplaceShifts.map((shift) => (
        <div
          key={shift.id}
          className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <div className="h-1.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500" />

          <div className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="text-2xl font-bold tracking-tight text-slate-950">
                    {shift.role} • {shift.shiftType}
                  </div>
                  <StatusBadge label={shift.status} tone="info" />
                  <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {shift.payRateLabel}
                  </div>
                </div>

                <div className="mt-3 text-lg font-semibold text-slate-800">
                  {shift.facilityName}
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {shift.city}, {shift.state} • {shift.distanceMiles} miles away
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Date
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{shift.date}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Time
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{shift.time}</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Applicants
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-900">{shift.applicants} currently</div>
                  </div>
                </div>
              </div>

              <div className="flex w-full shrink-0 flex-col gap-3 lg:w-56">
                <button className="rounded-full bg-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5">
                  Request Shift
                </button>
                <button className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                  View Details
                </button>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Approved workers will have documents routed to the facility automatically.
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
