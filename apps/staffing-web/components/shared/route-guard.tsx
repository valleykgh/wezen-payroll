'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { meRequest, type AuthMeResponse } from '@/lib/auth-client';

type GuardMode = 'worker' | 'facility' | 'admin';

type RouteGuardProps = {
  mode: GuardMode;
  children: React.ReactNode;
};

export function RouteGuard({ mode, children }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'allowed' | 'blocked'>('loading');
  const [user, setUser] = useState<AuthMeResponse['data'] | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const res = await meRequest();
        if (!mounted) return;

        const currentUser = res.data;
        setUser(currentUser);

        const isWorkerAllowed =
          mode === 'worker' && currentUser.role === 'PROFESSIONAL';
        const isFacilityAllowed =
          mode === 'facility' && currentUser.role === 'FACILITY_ADMIN';
        const isAdminAllowed =
          mode === 'admin' && currentUser.role === 'INTERNAL_ADMIN';

        if (isWorkerAllowed || isFacilityAllowed || isAdminAllowed) {
          setStatus('allowed');
          return;
        }

        setStatus('blocked');

        if (currentUser.role === 'PROFESSIONAL') {
          router.replace('/worker/dashboard');
          return;
        }

        if (currentUser.role === 'FACILITY_ADMIN') {
          router.replace('/facility/dashboard');
          return;
        }

        if (currentUser.role === 'INTERNAL_ADMIN') {
          router.replace('/admin/workers');
          return;
        }

        router.replace('/login');
      } catch {
        if (!mounted) return;
        setStatus('blocked');
        router.replace(`/login?next=${encodeURIComponent(pathname || '/')}`);
      }
    }

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [mode, pathname, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Checking access...
        </div>
      </div>
    );
  }

  if (status === 'blocked') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm text-slate-600 shadow-sm">
          Redirecting...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
