import { AppShell } from '@/components/app/app-shell';
import { AdminWorkersClient } from '@/components/admin/admin-workers-client';

export default function AdminWorkersPage() {
  return (
    <AppShell role="admin" title="Workers" subtitle="Review onboarding, documents, and compliance.">
      <AdminWorkersClient />
    </AppShell>
  );
}
