import { AppShell } from '@/components/app/app-shell';
import { FacilityAvailableWorkersClient } from '@/components/facility/facility-available-workers-client';

export default function FacilityAvailabilityPage() {
  return (
    <AppShell role="facility" title="Available Workers" subtitle="Search availability and invite workers.">
      <FacilityAvailableWorkersClient />
    </AppShell>
  );
}
