import { WorkerShell } from '@/components/worker/worker-shell';
import { RouteGuard } from '@/components/shared/route-guard';

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard mode="worker">
      <WorkerShell>{children}</WorkerShell>
    </RouteGuard>
  );
}
