import { FacilityShell } from '@/components/facility/facility-shell';
import { RouteGuard } from '@/components/shared/route-guard';

export default function FacilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RouteGuard mode="facility">
      <FacilityShell>{children}</FacilityShell>
    </RouteGuard>
  );
}
