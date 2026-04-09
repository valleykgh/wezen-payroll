import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function HomePage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Wezen Staffing
            </div>

            <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              A modern staffing marketplace for healthcare facilities and professionals
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Manage shift coverage, review applicants, streamline worker onboarding,
              and create a faster staffing experience for long-term care facilities
              and healthcare professionals.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
              >
                Go to Login
              </Link>

              <Link
                href="/facilities"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                For Facilities
              </Link>

              <Link
                href="/professionals"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                For Professionals
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-500">
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Fast applicant review
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Compliance-first onboarding
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Payroll routed separately
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                For Facilities
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                Fill shifts faster with better visibility
              </h2>
              <p className="mt-4 text-base leading-7 text-cyan-50/90">
                Post shifts, track staffing coverage, review applicants, manage DNR
                restrictions, and keep operations moving from one central workspace.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    Shift coverage
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    Open • Partial • Filled
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    Request review
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    Approve or reject quickly
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                For Professionals
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Keep onboarding, documents, and requests in one place
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Complete onboarding, upload compliance documents, sign agreements,
                browse shifts, and manage requests through a polished worker portal.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notifications
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    Approvals and updates
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payroll access
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    Redirected to payroll portal
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-[2rem] bg-gradient-to-r from-slate-900 to-cyan-700 p-10 text-white shadow-xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Built for healthcare staffing
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight">
                Designed for the real workflow, not just a static job board
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-cyan-50/90">
                Wezen Staffing combines facility operations, worker onboarding,
                compliance review, shift requests, approvals, and payroll handoff
                into one connected experience.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Compliance
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Document review + eligibility gating
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Operations
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Shift visibility + applicant management
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Worker experience
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Requests, notifications, and onboarding
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Payroll boundary
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Payroll handled separately and cleanly
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
