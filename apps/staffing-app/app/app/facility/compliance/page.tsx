import { AppShell } from '@/components/app/app-shell';
import { FacilityComplianceClient } from '@/components/facility/facility-compliance-client';

export default function FacilityCompliancePage() {
  return (
    <AppShell role="facility" title="Compliance" subtitle="Document issues for workers connected to your facility.">
      <FacilityComplianceClient />
    </AppShell>
  );
}
