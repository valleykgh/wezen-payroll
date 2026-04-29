import { AppShell } from '@/components/app/app-shell';
import { AdminDashboardClient } from '@/components/admin/admin-dashboard-client';

export default function AdminApp() {
  return (
    <AppShell role="admin" title="Internal Admin" subtitle="Manage workers, facilities, onboarding, and shifts.">
      <AdminDashboardClient />
    </AppShell>
  );
}
