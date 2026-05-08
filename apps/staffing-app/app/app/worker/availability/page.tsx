import { AppShell } from '@/components/app/app-shell';
import { WorkerAvailabilityClient } from '@/components/worker/worker-availability-client';

export default function WorkerAvailabilityPage() {
  return (
    <AppShell role="worker" title="Availability" subtitle="Set AM / PM / NOC availability.">
      <WorkerAvailabilityClient />
    </AppShell>
  );
}
