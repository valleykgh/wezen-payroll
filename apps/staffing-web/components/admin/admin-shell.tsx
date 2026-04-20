'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AppLogo } from '@/components/shared/app-logo';
import { CurrentUserCard } from '@/components/shared/current-user-card';

const adminNav = [
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

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-6 py-6">
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
                <CurrentUserCard />
              </div>
            </div>
          </header>

          <main className="px-6 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
