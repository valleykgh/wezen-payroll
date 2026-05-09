import { RoleGuard } from '@/components/app/role-guard';

export default function FacilityLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowed={['FACILITY_ADMIN', 'FACILITY_STAFF']}>{children}</RoleGuard>;
}
