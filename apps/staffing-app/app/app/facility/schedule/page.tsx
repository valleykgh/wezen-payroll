import { AppShell } from '@/components/app/app-shell';
import { FacilityScheduleClient } from '@/components/facility/facility-schedule-client';

export default function Page() {
  return (
    <AppShell role="facility" title="Schedule" subtitle="Filter shifts by date, status, and shift type.">
      <FacilityScheduleClient />
    </AppShell>
  );
}
