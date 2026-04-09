import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function ProfessionalsPage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              For Professionals
            </div>

            <h1 className="mt-4 max-w-4xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Manage onboarding, compliance, and shift requests in one worker portal
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Complete onboarding, upload compliance documents, sign agreements,
              browse open shifts, and track request activity through a streamlined professional experience.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login?next=/worker/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
              >
                Professional Login
              </Link>

              <Link
                href="/signup/professional"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Create Professional Account
              </Link>
            </div>
          </div>

          <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Worker Experience
            </div>
            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Built for real healthcare staffing workflows
            </h2>
            <p className="mt-4 text-base leading-7 text-cyan-50/90">
              Stay on top of onboarding, document review, shift requests,
              approvals, and staffing updates from one place.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Onboarding
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Agreements + compliance documents
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Shift search
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Browse and request open shifts
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Notifications
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Approvals, rejections, DNR blocks
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                  Payroll boundary
                </div>
                <div className="mt-1 text-lg font-bold text-white">
                  Payroll routed separately
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Clear onboarding flow
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Complete agreements and keep required compliance documents organized in one portal.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Better shift visibility
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Search open shifts, manage requests, and understand your staffing activity more easily.
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold tracking-tight text-slate-950">
              Cleaner communication
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Get notified when requests are approved or rejected and when document updates need attention.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
