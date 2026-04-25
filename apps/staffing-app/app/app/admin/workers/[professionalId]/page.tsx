import { AppShell } from '@/components/app/app-shell';
import { AdminWorkerDetailClient } from '@/components/admin/admin-worker-detail-client';

export default async function AdminWorkerDetailPage({
  params,
}: {
  params: Promise<{ professionalId: string }>;
}) {
  const { professionalId } = await params;

  return (
    <AppShell role="admin" title="Worker Detail" subtitle="Review onboarding and actions.">
      <AdminWorkerDetailClient professionalId={professionalId} />
    </AppShell>
  );
}
