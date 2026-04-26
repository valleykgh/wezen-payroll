'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { AdminWorkerDetailClient } from '@/components/admin/admin-worker-detail-client';

export default function AdminWorkerDetailPage() {
  const searchParams = useSearchParams();
  const professionalId = searchParams.get('professionalId') || '';

  return (
    <AppShell role="admin" title="Worker Detail" subtitle="Review onboarding and actions.">
      <AdminWorkerDetailClient professionalId={professionalId} />
    </AppShell>
  );
}
