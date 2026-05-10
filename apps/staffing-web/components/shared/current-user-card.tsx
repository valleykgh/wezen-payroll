'use client';

import { useEffect, useState } from 'react';
import { meRequest, logoutRequest, type AuthMeResponse } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
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

  async function toggleAppNotifications() {
    if (!user) return;
    const next = !user.appNotificationsEnabled;

    await apiFetch('/api/users/me/app-notifications', {
      method: 'PUT',
      body: JSON.stringify({ enabled: next }),
    });

    setUser({ ...user, appNotificationsEnabled: next });
  }

  async function handleLogout() {
    try {
      await logoutRequest();
      router.push('/login');
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
            onClick={toggleAppNotifications}
            className={
              user.appNotificationsEnabled
                ? 'inline-flex items-center justify-center rounded-full border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 shadow-sm'
                : 'inline-flex items-center justify-center rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 shadow-sm'
            }
          >
            <span
              className={
                user.appNotificationsEnabled
                  ? 'mr-2 h-2.5 w-2.5 rounded-full bg-emerald-500'
                  : 'mr-2 h-2.5 w-2.5 rounded-full bg-rose-500'
              }
            />
            {user.appNotificationsEnabled ? 'App Alerts ON' : 'App Alerts OFF'}
          </button>

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
