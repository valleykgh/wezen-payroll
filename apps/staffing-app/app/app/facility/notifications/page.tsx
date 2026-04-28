import { AppShell } from '@/components/app/app-shell';
import { FacilityNotificationsClient } from '@/components/facility/facility-notifications-client';

export default function FacilityNotificationsPage() {
  return (
    <AppShell role="facility" title="Facility Alerts" subtitle="Urgent requests and staffing notifications.">
      <FacilityNotificationsClient />
    </AppShell>
  );
}
