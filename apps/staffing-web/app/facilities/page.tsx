import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function FacilitiesPage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              For Facilities
            </div>

            <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Manage staffing operations with better speed, control, and visibility
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Post shifts, review applicants, approve qualified professionals,
              monitor fill status, and manage staffing workflows from one clean facility dashboard.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login?next=/facility/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
              >
                Facility Login
              </Link>

              <Link
                href="/signup/facility"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Create Facility Account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Facility Operations
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Built for real staffing coordination
            </h2>
            <p className="mt-4 text-base leading-7 text-cyan-50/90">
              Move from open shift to approved worker with better workflow control,
              document visibility, and applicant review.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Shift posting
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Post AM, PM, and NOC coverage
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Applicant review
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Approve, reject, and manage DNR
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Fill visibility
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Open • Partial • Filled
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Shift control
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Close, reopen, cancel, duplicate
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Faster staffing decisions
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Review incoming requests quickly and make decisions with better visibility into worker readiness.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Better workflow control
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Keep your staffing schedule organized with status tracking, per-shift review, and operational controls.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Cleaner compliance visibility
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Focus on the compliance documents and worker readiness that matter before approving requests.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
