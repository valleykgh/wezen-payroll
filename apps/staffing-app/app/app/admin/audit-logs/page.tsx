import { AppShell } from '@/components/app/app-shell';
import { AdminAuditLogsClient } from '@/components/admin/admin-audit-logs-client';

export default function AdminAuditLogsPage() {
  return (
    <AppShell role="admin" title="Audit Logs" subtitle="Review sensitive admin actions.">
      <AdminAuditLogsClient />
    </AppShell>
  );
}
