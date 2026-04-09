import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <div className="text-lg font-semibold tracking-tight text-slate-950">
            Wezen Staffing
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
            A healthcare staffing marketplace built for facilities and professionals,
            with onboarding, compliance, shift management, and payroll handoff.
          </p>
        </div>

        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Platform
          </div>
          <div className="mt-4 space-y-3">
            <Link href="/facilities" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Facilities
            </Link>
            <Link href="/professionals" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Professionals
            </Link>
            <Link href="/how-it-works" className="block text-sm text-slate-600 transition hover:text-slate-950">
              How It Works
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Access
          </div>
          <div className="mt-4 space-y-3">
            <Link href="/login" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Login
            </Link>
            <Link href="/signup/facility" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Create Facility Account
            </Link>
            <Link href="/signup/professional" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Create Professional Account
            </Link>
          </div>
        </div>

        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Legal
          </div>
          <div className="mt-4 space-y-3">
            <Link href="/contact" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Contact
            </Link>
            <Link href="/privacy" className="block text-sm text-slate-600 transition hover:text-slate-950">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>© 2026 Wezen Staffing. All rights reserved.</div>
          <div>Healthcare staffing marketplace</div>
        </div>
      </div>
    </footer>
  );
}
