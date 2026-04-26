'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { WorkerShiftsClient } from '@/components/worker/worker-shifts-client';

export default function WorkerApp() {
  return (
    <AppShell role="worker" title="Worker App" subtitle="Search shifts, request shifts, and view approvals.">
      <div className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/app/worker/shifts/index.html" className="rounded-3xl bg-cyan-600 p-5 text-center text-sm font-bold text-white">
            Find Shifts
          </Link>
          <Link href="/app/worker/notifications/index.html" className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-900 ring-1 ring-slate-200">
            Alerts
          </Link>
        </div>

        <WorkerShiftsClient />
      </div>
    </AppShell>
  );
}
