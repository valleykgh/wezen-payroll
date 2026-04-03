import { FacilityShell } from '@/components/facility/facility-shell';

export default function FacilityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FacilityShell>{children}</FacilityShell>;
}
