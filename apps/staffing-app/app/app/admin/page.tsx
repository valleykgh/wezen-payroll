import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';

export default function AdminApp() {
  return (
    <AppShell role="admin" title="Internal Admin" subtitle="Manage workers, facilities, onboarding, and shifts.">
      <div className="grid gap-4">
        <Link href="/app/admin/workers/index.html" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-cyan-700">Workers</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Review onboarding</h2>
          <p className="mt-2 text-sm text-slate-600">Approve documents, ICA status, and worker eligibility.</p>
        </Link>

        <Link href="/app/admin/facilities/index.html" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-cyan-700">Facilities</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Manage facilities</h2>
          <p className="mt-2 text-sm text-slate-600">Review facility setup and account status.</p>
        </Link>

        <Link href="/app/admin/shifts/index.html" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-cyan-700">Shifts</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Monitor shift activity</h2>
          <p className="mt-2 text-sm text-slate-600">View open shifts, applicants, and coverage.</p>
        </Link>
      </div>
    </AppShell>
  );
}
