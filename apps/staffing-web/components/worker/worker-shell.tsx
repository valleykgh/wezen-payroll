import Link from 'next/link';
import { AppLogo } from '@/components/shared/app-logo';

const workerNav = [
  { href: '/worker/dashboard', label: 'Dashboard' },
  { href: '/worker/profile', label: 'Profile' },
  { href: '/worker/documents', label: 'Documents' },
  { href: '/worker/agreements', label: 'Agreements' },
  { href: '/worker/shifts', label: 'Find Shifts' },
  { href: '/worker/requests', label: 'My Requests' },
  { href: '/worker/schedule', label: 'Schedule' },
  { href: '/worker/settings', label: 'Settings' },
];

export function WorkerShell({ children }: { children: React.ReactNode }) {
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
                className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              >
                {item.label}
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
              href="https://payroll.wezenstaffing.com"
              className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Go to Payroll
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
                <button className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
                  Profile Status
                </button>
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
