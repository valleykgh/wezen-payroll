'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';
import { FacilityShiftsClient } from '@/components/facility/facility-shifts-client';
import { FacilityAlertsCard } from '@/components/facility/facility-alerts-card';

export default function FacilityApp() {
  return (
    <AppShell role="facility" title="Facility App" subtitle="Post shifts, view applicants, and approve requests.">
      <div className="grid gap-4">
        <FacilityAlertsCard />

        <div className="grid grid-cols-2 gap-3">
          <Link href="/app/facility/post-shift/index.html" className="rounded-3xl bg-cyan-600 p-5 text-center text-sm font-bold text-white">
            Post Shift
          </Link>
          <Link href="/app/facility/applicants/index.html" className="rounded-3xl bg-white p-5 text-center text-sm font-bold text-slate-900 ring-1 ring-slate-200">
            Review Applicants
          </Link>
        </div>

        <FacilityShiftsClient />
      </div>
    </AppShell>
  );
}
