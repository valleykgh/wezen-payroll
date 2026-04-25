import { AppShell } from '@/components/app/app-shell';
import { FacilityShiftsClient } from '@/components/facility/facility-shifts-client';

export default function FacilityShiftsPage() {
  return (
    <AppShell role="facility" title="Facility Shifts" subtitle="Manage posted shifts and coverage.">
      <FacilityShiftsClient />
    </AppShell>
  );
}
