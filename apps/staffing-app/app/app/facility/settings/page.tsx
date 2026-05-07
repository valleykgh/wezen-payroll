import { AppShell } from '@/components/app/app-shell';
import { FacilitySettingsClient } from '@/components/facility/facility-settings-client';

export default function Page() {
  return (
    <AppShell role="facility" title="Profile & Settings" subtitle="Facility profile and default shift times.">
      <FacilitySettingsClient />
    </AppShell>
  );
}
