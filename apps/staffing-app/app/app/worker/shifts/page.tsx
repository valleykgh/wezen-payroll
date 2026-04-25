import { AppShell } from '@/components/app/app-shell';
import { WorkerShiftsClient } from '@/components/worker/worker-shifts-client';

export default function WorkerShiftsPage() {
  return (
    <AppShell role="worker" title="Find Shifts" subtitle="Search by title, shift type, and distance.">
      <WorkerShiftsClient />
    </AppShell>
  );
}
