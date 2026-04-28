import { AppShell } from '@/components/app/app-shell';
import { WorkerProfileClient } from '@/components/worker/worker-profile-client';

export default function WorkerProfilePage() {
  return (
    <AppShell role="worker" title="Profile" subtitle="Manage profile, address, and shift alerts.">
      <WorkerProfileClient />
    </AppShell>
  );
}
