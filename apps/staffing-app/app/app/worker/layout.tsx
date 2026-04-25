import { RoleGuard } from '@/components/app/role-guard';

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allowed={['PROFESSIONAL']}>{children}</RoleGuard>;
}
