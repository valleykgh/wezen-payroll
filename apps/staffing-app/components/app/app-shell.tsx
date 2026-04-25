'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type AppShellProps = {
  title: string;
  subtitle?: string;
  role: 'worker' | 'facility' | 'admin';
  children: React.ReactNode;
};

const navByRole = {
  worker: [
    { label: 'Home', href: '/app/worker' },
    { label: 'Shifts', href: '/app/worker/shifts' },
    { label: 'Alerts', href: '/app/worker/notifications' },
    { label: 'Profile', href: '/app/worker/profile' },
  ],
  facility: [
    { label: 'Home', href: '/app/facility' },
    { label: 'Post', href: '/app/facility/post-shift' },
    { label: 'Applicants', href: '/app/facility/applicants' },
    { label: 'Shifts', href: '/app/facility/shifts' },
  ],
  admin: [
    { label: 'Home', href: '/app/admin' },
    { label: 'Workers', href: '/app/admin/workers' },
    { label: 'Facilities', href: '/app/admin/facilities' },
    { label: 'Shifts', href: '/app/admin/shifts' },
  ],
};

export function AppShell({ title, subtitle, role, children }: AppShellProps) {
  const pathname = usePathname();
  const nav = navByRole[role];

  return (
    <main className="min-h-screen bg-slate-100 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
          Wezen Staffing
        </p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </header>

      <section className="px-5 py-5">{children}</section>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-3 py-3">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
          {nav.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  active
                    ? 'rounded-2xl bg-slate-950 px-2 py-3 text-center text-xs font-bold text-white'
                    : 'rounded-2xl px-2 py-3 text-center text-xs font-semibold text-slate-600'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
