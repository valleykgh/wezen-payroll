'use client';

import { useEffect, useState } from 'react';
import { meRequest } from '@/lib/auth-client';

type RoleGuardProps = {
  allowed: Array<'PROFESSIONAL' | 'FACILITY_ADMIN' | 'INTERNAL_ADMIN'>;
  children: React.ReactNode;
};

export function RoleGuard({ allowed, children }: RoleGuardProps) {
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function check() {
      try {
        const res = await meRequest();
        const role = res.data.role;

        if (!allowed.includes(role)) {
          if (role === 'PROFESSIONAL') window.location.assign('/app/worker/index.html');
          else if (role === 'FACILITY_ADMIN') window.location.assign('/app/facility/index.html');
          else if (role === 'INTERNAL_ADMIN') window.location.assign('/app/admin/index.html');
          else window.location.assign('/login/index.html');
          return;
        }

        setOk(true);
      } catch (error) {
        window.location.assign('/login/index.html');
      }
    }

    check();
  }, [allowed]);

  if (!ok) {
    return <div className="p-6 text-sm text-slate-600">Checking access...</div>;
  }

  return <>{children}</>;
}
