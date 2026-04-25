import { redirect } from 'next/navigation';
import { meRequestServer } from '@/lib/auth-server';

type RoleGuardProps = {
  allowed: Array<'PROFESSIONAL' | 'FACILITY_ADMIN' | 'INTERNAL_ADMIN'>;
  children: React.ReactNode;
};

export async function RoleGuard({ allowed, children }: RoleGuardProps) {
  try {
    const res = await meRequestServer();
    const role = res.data.role;

    if (!allowed.includes(role)) {
      if (role === 'PROFESSIONAL') redirect('/app/worker');
      if (role === 'FACILITY_ADMIN') redirect('/app/facility');
      if (role === 'INTERNAL_ADMIN') redirect('/app/admin');
      redirect('/login');
    }

    return <>{children}</>;
  } catch {
    redirect('/login');
  }
}
