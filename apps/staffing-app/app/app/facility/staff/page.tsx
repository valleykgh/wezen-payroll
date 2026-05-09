import { AppShell } from '@/components/app/app-shell';
import { FacilityStaffClient } from '@/components/facility/facility-staff-client';

export default function FacilityStaffPage() {
  return (
    <AppShell role="facility" title="Manage Staff" subtitle="Create and manage facility staff access.">
      <FacilityStaffClient />
    </AppShell>
  );
}
