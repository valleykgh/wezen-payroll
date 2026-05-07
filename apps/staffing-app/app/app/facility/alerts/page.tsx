import { AppShell } from '@/components/app/app-shell';
import { FacilityAlertsCard } from '@/components/facility/facility-alerts-card';

export default function FacilityAlertsPage() {
  return (
    <AppShell role="facility" title="Alerts" subtitle="Urgent staffing requests and cancellation alerts.">
      <FacilityAlertsCard />
    </AppShell>
  );
}
