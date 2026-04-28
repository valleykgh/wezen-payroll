import { AppShell } from '@/components/app/app-shell';
import { AdminNotificationsClient } from '@/components/admin/admin-notifications-client';

export default function AdminNotificationsPage() {
  return (
    <AppShell role="admin" title="Admin Alerts" subtitle="Worker signup, document, and approval notifications.">
      <AdminNotificationsClient />
    </AppShell>
  );
}
