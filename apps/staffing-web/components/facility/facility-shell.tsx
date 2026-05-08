'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AppLogo } from '@/components/shared/app-logo';
import { CurrentUserCard } from '@/components/shared/current-user-card';
import { apiFetch } from '@/lib/api-client';

type FacilityNavItem = {
  href: string;
  label: string;
  badgeKey?: 'pendingRequests' | 'alerts';
};

const facilityNav: FacilityNavItem[] = [
  { href: '/facility/dashboard', label: 'Dashboard' },
  { href: '/facility/notifications', label: 'Alerts', badgeKey: 'alerts' },
  { href: '/facility/settings', label: 'Profile & Settings' },
  { href: '/facility/shifts', label: 'Shifts' },
  { href: '/facility/shifts/post', label: 'Post Shift' },
  { href: '/facility/applicants', label: 'Applicants', badgeKey: 'pendingRequests' },
  { href: '/facility/workers', label: 'Workers' },
  { href: '/facility/availability', label: 'Available Workers' },
  { href: '/facility/compliance', label: 'Compliance' },
  { href: '/facility/favorites', label: 'Favorites' },
  { href: '/facility/schedule', label: 'Schedule' },
];

export function FacilityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [alertCount, setAlertCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    async function loadBadgeCounts() {
      try {
        const res = await apiFetch<{
          data: {
            stats: {
              pendingRequests: number;
            };
          };
        }>('/api/facility/dashboard');

        setPendingRequests(res.data.stats.pendingRequests || 0);

        const alerts = await apiFetch<{ data: { count?: number; unreadCount?: number } }>('/api/facility/notifications/unread-count');
        setAlertCount(alerts.data.count || alerts.data.unreadCount || 0);
      } catch {
        setPendingRequests(0);
        setAlertCount(0);
      }
    }

    loadBadgeCounts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white px-6 py-6 lg:block">  
	  <AppLogo />

          <nav className="mt-8 space-y-2">
            {facilityNav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              const badgeCount =
                item.badgeKey === 'pendingRequests' ? pendingRequests : item.badgeKey === 'alerts' ? alertCount : 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    active
                      ? 'flex items-center justify-between rounded-2xl bg-cyan-50 px-4 py-3 text-sm font-semibold text-cyan-700'
                      : 'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950'
                  }
                >
                  <span>{item.label}</span>

                  {badgeCount > 0 ? (
                    <span className="inline-flex min-w-[24px] items-center justify-center rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                      {badgeCount}
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
                <div className="text-sm font-medium text-slate-500">Facility Portal</div>
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

                <Link
                  href="/facility/shifts/post"
                  className="rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
                >
                  Post Shift
                </Link>
              </div>
            </div>
          </header>

	   {mobileMenuOpen ? (
  <div className="border-b border-slate-200 bg-white px-4 py-4 lg:hidden">
    <nav className="grid gap-2">
      {facilityNav.map((item) => (
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
