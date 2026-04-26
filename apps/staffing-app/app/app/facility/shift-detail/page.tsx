'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { FacilityShiftDetailClient } from '@/components/facility/facility-shift-detail-client';

export default function FacilityShiftDetailPage() {
  const searchParams = useSearchParams();
  const shiftId = searchParams.get('shiftId') || '';

  return (
    <AppShell role="facility" title="Shift Detail" subtitle="Review applicants and manage coverage.">
      <FacilityShiftDetailClient shiftId={shiftId} />
    </AppShell>
  );
}
