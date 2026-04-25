import { AppShell } from '@/components/app/app-shell';

export default function AdminShiftsPage() {
  return (
    <AppShell role="admin" title="Shifts" subtitle="View shift activity across all facilities.">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-bold text-slate-950">Shift activity</h2>
        <p className="mt-2 text-sm text-slate-600">All shift requests, approvals, and cancellations will appear here.</p>
      </div>
    </AppShell>
  );
}
