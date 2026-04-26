'use client';

import { useEffect, useState } from 'react';
import { meRequest, logoutRequest, type AuthMeResponse } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

export function CurrentUserCard() {
  const router = useRouter();
  const [user, setUser] = useState<AuthMeResponse['data'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    meRequest()
      .then((res) => {
        if (mounted) setUser(res.data);
      })
      .catch(() => {
        if (mounted) setError('Not signed in');
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await logoutRequest();
      window.location.href = '/login/index.html';
      router.refresh();
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {user ? (
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-950">
              {user.firstName || 'User'} {user.lastName || ''}
            </div>
            <div className="text-xs text-slate-500">
              {user.email} • {user.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 hover:border-slate-400 cursor-pointer"
	  >
            Logout
          </button>
        </div>
      ) : (
        <div className="text-sm text-slate-500">{error || 'Loading user...'}</div>
      )}
    </div>
  );
}
