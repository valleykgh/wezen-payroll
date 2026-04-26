import { AppShell } from '@/components/app/app-shell';
import { WorkerRequestsClient } from '@/components/worker/worker-requests-client';

export default function WorkerRequestsPage() {
  return (
    <AppShell
      role="worker"
      title="Requests"
      subtitle="Track shift requests, approvals, rejections, and cancellations."
    >
      <WorkerRequestsClient />
    </AppShell>
  );
}
