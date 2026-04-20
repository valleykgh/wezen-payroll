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
  badgeKey?: 'pendingRequests';
};

const facilityNav: FacilityNavItem[] = [
  { href: '/facility/dashboard', label: 'Dashboard' },
  { href: '/facility/shifts', label: 'Shifts' },
  { href: '/facility/shifts/post', label: 'Post Shift' },
  { href: '/facility/applicants', label: 'Applicants', badgeKey: 'pendingRequests' },
  { href: '/facility/workers', label: 'Workers' },
  { href: '/facility/compliance', label: 'Compliance' },
  { href: '/facility/favorites', label: 'Favorites' },
  { href: '/facility/settings', label: 'Settings' },
  { href: '/facility/schedule', label: 'Schedule' },
];

export function FacilityShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingRequests, setPendingRequests] = useState(0);

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
      } catch {
        setPendingRequests(0);
      }
    }

    loadBadgeCounts();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-6 py-6">
          <AppLogo />

          <nav className="mt-8 space-y-2">
            {facilityNav.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              const badgeCount =
                item.badgeKey === 'pendingRequests' ? pendingRequests : 0;

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

          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
