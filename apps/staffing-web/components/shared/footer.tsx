import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="text-lg font-bold tracking-tight text-slate-950">
            Wezen Staffing
          </div>
          <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">
            Connecting healthcare facilities with vetted independent CNA, LVN,
            and RN professionals for AM, PM, and NOC shift coverage.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Platform
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>
              <Link href="/facilities" className="hover:text-slate-950">
                Facilities
              </Link>
            </div>
            <div>
              <Link href="/professionals" className="hover:text-slate-950">
                Professionals
              </Link>
            </div>
            <div>
              <Link href="/how-it-works" className="hover:text-slate-950">
                How It Works
              </Link>
            </div>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-900">
            Access
          </div>
          <div className="mt-4 space-y-2 text-sm text-slate-600">
            <div>
              <Link href="/login" className="hover:text-slate-950">
                Login
              </Link>
            </div>
            <div>
              <a href="https://payroll.wezenstaffing.com" className="hover:text-slate-950">
                Payroll Portal
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
