'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { logoutRequest } from '@/lib/auth-client';
import { PushRegistration } from '@/components/app/push-registration';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Badge } from '@capawesome/capacitor-badge';

type AppShellProps = {
  title: string;
  subtitle?: string;
  role: 'worker' | 'facility' | 'admin';
  children: React.ReactNode;
};

const navByRole = {
  worker: [
    { label: 'Home', href: '/app/worker/index.html' },
    { label: 'Shifts', href: '/app/worker/shifts/index.html' },
    { label: 'Requests', href: '/app/worker/requests/index.html' },
    { label: 'Alerts', href: '/app/worker/notifications/index.html' },
    { label: 'Docs', href: '/app/worker/documents/index.html' },
    { label: 'Profile', href: '/app/worker/profile/index.html' },
  ],
  facility: [
    { label: 'Home', href: '/app/facility/index.html' },
    { label: 'Shifts', href: '/app/facility/shifts/index.html' },
    { label: 'Post', href: '/app/facility/post-shift/index.html' },
    { label: 'Applicants', href: '/app/facility/applicants/index.html' },
    { label: 'More', href: '/app/facility/more/index.html' },
  ],
  admin: [
    { label: 'Home', href: '/app/admin/index.html' },
    { label: 'Alerts', href: '/app/admin/notifications/index.html' },
    { label: 'Workers', href: '/app/admin/workers/index.html' },
    { label: 'Sites', href: '/app/admin/facilities/index.html' },
    { label: 'Shifts', href: '/app/admin/shifts/index.html' },
    { label: 'Audit', href: '/app/admin/audit-logs/index.html' },
  ],
};

export function AppShell({ title, subtitle, role, children }: AppShellProps) {
  const pathname = usePathname();
  const nav = navByRole[role];
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (role !== 'worker' && role !== 'facility' && role !== 'admin') return;

    async function loadUnreadCount() {
      try {
        const endpoint =
          role === 'worker'
            ? '/api/worker/notifications/unread-count'
            : role === 'facility'
              ? '/api/facility/notifications/unread-count'
              : '/api/admin/notifications/unread-count';

        const res = await apiFetch<{ data: { count?: number; unreadCount?: number } }>(endpoint);
        const nextCount = res.data.count || res.data.unreadCount || 0;
        setUnreadCount(nextCount);

        if (Capacitor.isNativePlatform()) {
          if (nextCount > 0) await Badge.set({ count: nextCount });
          else await Badge.clear();
        }
      } catch {
        setUnreadCount(0);
        if (Capacitor.isNativePlatform()) {
          await Badge.clear();
        }
      }
    }

    loadUnreadCount();

    function handleNotificationsChanged(event: Event) {
      const customEvent = event as CustomEvent<{ unreadCount?: number }>;
      const nextCount = customEvent.detail?.unreadCount;

      if (typeof nextCount === 'number') {
        setUnreadCount(nextCount);
        if (Capacitor.isNativePlatform()) {
          if (nextCount > 0) Badge.set({ count: nextCount });
          else Badge.clear();
        }
        return;
      }

      loadUnreadCount();
    }

    window.addEventListener('wezen-notifications-changed', handleNotificationsChanged);

    const interval = window.setInterval(loadUnreadCount, 25000);

    let removeListener: (() => void) | undefined;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) loadUnreadCount();
      }).then((listener) => {
        removeListener = () => listener.remove();
      });
    }

    return () => {
      window.removeEventListener('wezen-notifications-changed', handleNotificationsChanged);
      window.clearInterval(interval);
      removeListener?.();
    };
  }, [role]);

  async function handleLogout() {
    try {
      await logoutRequest();
    } finally {
      window.location.href = '/login/index.html';
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 pb-28">
      <PushRegistration />
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-7 pb-5 pt-[calc(env(safe-area-inset-top)+5.25rem)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Wezen Staffing
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-tight text-slate-950">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm leading-snug text-slate-600">{subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-1 shrink-0 rounded-full bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="px-5 py-5">{children}</section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-none">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              pathname === item.href.replace('/index.html', '');

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'rounded-2xl bg-cyan-600 px-1.5 py-2.5 text-center text-[11px] font-bold text-white shadow-none'
                    : 'rounded-2xl px-1.5 py-2.5 text-center text-[11px] font-semibold text-slate-600'
                }
              >
                {item.label}
                {item.label === 'Alerts' && unreadCount > 0 ? (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
