import { AppShell } from '@/components/app/app-shell';
import { WorkerNotificationsClient } from '@/components/worker/worker-notifications-client';

export default function WorkerNotificationsPage() {
  return (
    <AppShell
      role="worker"
      title="Alerts"
      subtitle="Shift approvals, cancellations, and onboarding updates."
    >
      <WorkerNotificationsClient />
    </AppShell>
  );
}
