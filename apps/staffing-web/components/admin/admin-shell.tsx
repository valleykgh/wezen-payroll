'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppLogo } from '@/components/shared/app-logo';
import { CurrentUserCard } from '@/components/shared/current-user-card';
import { apiFetch } from '@/lib/api-client';

const adminNav = [
  { href: '/admin/notifications', label: 'Alerts', badgeKey: 'alerts' },
  { href: '/admin/workers', label: 'Workers' },
  { href: '/admin/facilities', label: 'Facilities' },
  { href: '/admin/facilities/new', label: 'Create Facility' },
  { href: '/admin/facility-invites', label: 'Facility Invites' },
  { href: '/admin/shifts', label: 'Shifts' },
  { href: '/admin/shift-requests', label: 'Shift Requests' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    async function loadAlerts() {
      try {
        const res = await apiFetch<{ data: { count?: number; unreadCount?: number } }>('/api/admin/notifications/unread-count');
        setAlertCount(res.data.count || res.data.unreadCount || 0);
      } catch {
        setAlertCount(0);
      }
    }

    loadAlerts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white px-6 py-6 lg:block">  
	  <AppLogo />

          <div className="mt-6 rounded-[1.5rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-5 text-white shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
              Internal Admin
            </div>
            <div className="mt-2 text-lg font-bold tracking-tight">
              Wezen Operations
            </div>
            <p className="mt-2 text-sm text-cyan-50/90">
              Review workers, verify compliance, and manage marketplace readiness.
            </p>
          </div>

          <nav className="mt-8 space-y-2">
            {adminNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? 'block rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700'
                      : 'block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950'
                  }
                >
                  {item.label}
                  {(item as any).badgeKey === 'alerts' && alertCount > 0 ? (
                    <span className="ml-2 inline-flex min-w-[24px] items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {alertCount > 9 ? '9+' : alertCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="border-b border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-500">Internal Admin Console</div>
                <div className="text-lg font-semibold tracking-tight text-slate-950">
                  Wezen Staffing
                </div>
              </div>

              <div className="flex items-center gap-3">
		<button
  type="button"
  onClick={() => setMobileMenuOpen((open) => !open)}
  className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-900 lg:hidden"
>
<span className="flex flex-col gap-[3px]">
  <span className="h-[2px] w-5 bg-slate-900"></span>
  <span className="h-[2px] w-5 bg-slate-900"></span>
  <span className="h-[2px] w-5 bg-slate-900"></span>
</span>
</button>
                <CurrentUserCard />
              </div>
            </div>
          </header>

{mobileMenuOpen ? (
  <div className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden">
    <nav className="grid gap-2">
      {adminNav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileMenuOpen(false)}
          className="rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  </div>
) : null}
	  <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
