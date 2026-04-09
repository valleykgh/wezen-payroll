'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppLogo } from '@/components/shared/app-logo';
import { CurrentUserCard } from '@/components/shared/current-user-card';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

const PAYROLL_PORTAL_URL = 'https://payroll.wezenstaffing.com';

const workerNav = [
  { href: '/worker/dashboard', label: 'Dashboard' },
  { href: '/worker/profile', label: 'Profile' },
  { href: '/worker/documents', label: 'Documents' },
  { href: '/worker/agreements', label: 'Agreements' },
  { href: '/worker/shifts', label: 'Find Shifts' },
  { href: '/worker/requests', label: 'My Requests' },
  { href: '/worker/notifications', label: 'Notifications', badgeKey: 'notifications' },
  { href: '/worker/schedule', label: 'Schedule' },
  { href: '/worker/settings', label: 'Settings' },
];

export function WorkerShell({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function loadUnreadCount() {
      try {
	const res = await fetch(
  `${STAFFING_API_BASE_URL}/api/worker/notifications/unread-count`,
  {
    credentials: 'include',
    cache: 'no-store',
  }
);
	
        const data = await res.json();
        setUnreadCount(data?.data?.unreadCount ?? 0);
      } catch {
        setUnreadCount(0);
      }
    }

    loadUnreadCount();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-6 py-6">
          <AppLogo />

          <nav className="mt-8 space-y-2">
            {workerNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <span>{item.label}</span>

                {item.badgeKey === 'notifications' && unreadCount > 0 ? (
                  <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-rose-600 px-2 py-1 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>

          <div className="mt-8 rounded-[1.5rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-5 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
              Payroll
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight">
              Access your payroll portal
            </div>
            <p className="mt-2 text-sm text-cyan-50/90">
              View payroll-related activity in your dedicated payroll environment.
            </p>
            <a
  href={PAYROLL_PORTAL_URL}
  target="_blank"
  rel="noreferrer"
  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
>
  <span className="whitespace-nowrap">Go to Payroll ↗</span>
</a>  
	</div>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Professional Portal</div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  Wezen Staffing
                </div>
              </div>

              <div className="flex items-center gap-3">
                <CurrentUserCard />

                <a
                  href={PAYROLL_PORTAL_URL}
                  target="_blank"
                  rel="noreferrer"
                 className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:bg-slate-50"
		>
                  Payroll ↗
                </a>

                <Link
                  href="/worker/shifts"
                  className="rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
                >
                  Find Shifts
                </Link>
              </div>
            </div>
          </header>

          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
