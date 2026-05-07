import { AppShell } from '@/components/app/app-shell';
import { FacilityWorkersClient } from '@/components/facility/facility-workers-client';

export default function Page() {
  return (
    <AppShell role="facility" title="Workers" subtitle="Workers connected to your facility.">
      <FacilityWorkersClient />
    </AppShell>
  );
}
