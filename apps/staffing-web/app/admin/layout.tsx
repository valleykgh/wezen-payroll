import { RouteGuard } from '@/components/shared/route-guard';
import { AdminShell } from '@/components/admin/admin-shell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard mode="admin">
      <AdminShell>{children}</AdminShell>
    </RouteGuard>
  );
}
