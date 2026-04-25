import { RoleGuard } from '@/components/app/role-guard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowed={['INTERNAL_ADMIN']}>{children}</RoleGuard>;
}
