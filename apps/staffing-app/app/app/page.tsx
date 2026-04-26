'use client';

import { useEffect } from 'react';
import { meRequest } from '@/lib/auth-client';

export default function AppLandingPage() {
  useEffect(() => {
    async function routeUser() {
      try {
        const res = await meRequest();
        const role = res.data.role;

        if (role === 'PROFESSIONAL') window.location.assign('/app/worker/index.html');
        else if (role === 'FACILITY_ADMIN') window.location.assign('/app/facility/index.html');
        else if (role === 'INTERNAL_ADMIN') window.location.assign('/app/admin/index.html');
        else window.location.assign('/login/index.html');
      } catch {
        window.location.assign('/login/index.html');
      }
    }

    routeUser();
  }, []);

  return <div className="p-5 text-sm text-slate-600">Opening your workspace...</div>;
}
