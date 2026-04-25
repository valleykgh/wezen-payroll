import { AppShell } from '@/components/app/app-shell';
import { FacilityShiftDetailClient } from '@/components/facility/facility-shift-detail-client';

export default async function FacilityShiftDetailPage({
  params,
}: {
  params: Promise<{ shiftId: string }>;
}) {
  const { shiftId } = await params;

  return (
    <AppShell role="facility" title="Shift Detail" subtitle="Review applicants and manage coverage.">
      <FacilityShiftDetailClient shiftId={shiftId} />
    </AppShell>
  );
}
