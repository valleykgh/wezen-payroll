import Link from 'next/link';
import { AppLogo } from '@/components/shared/app-logo';

const facilityNav = [
  { href: '/facility/dashboard', label: 'Dashboard' },
  { href: '/facility/shifts', label: 'Shifts' },
  { href: '/facility/shifts/post', label: 'Post Shift' },
  { href: '/facility/applicants', label: 'Applicants' },
  { href: '/facility/workers', label: 'Workers' },
  { href: '/facility/compliance', label: 'Compliance' },
  { href: '/facility/favorites', label: 'Favorites' },
  { href: '/facility/billing', label: 'Billing' },
  { href: '/facility/settings', label: 'Settings' },
];

export function FacilityShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-6 py-6">
          <AppLogo />

          <nav className="mt-8 space-y-2">
            {facilityNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
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
                <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                  Notifications
                </button>
                <Link
                  href="/facility/shifts/post"
                  className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
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
