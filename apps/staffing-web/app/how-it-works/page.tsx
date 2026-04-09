import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function HowItWorksPage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
            How It Works
          </div>

          <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            A staffing workflow built for facilities and professionals
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">
            Wezen Staffing connects healthcare facilities and professionals through
            a workflow that supports onboarding, compliance, shift requests,
            approvals, and payroll handoff without mixing responsibilities.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Facility Workflow
            </div>
            <div className="mt-6 space-y-5">
              {[
                {
                  step: '1',
                  title: 'Create a facility account',
                  text: 'Facility administrators sign in and access the facility operations dashboard.',
                },
                {
                  step: '2',
                  title: 'Post open shifts',
                  text: 'Create AM, PM, and NOC shifts based on coverage needs.',
                },
                {
                  step: '3',
                  title: 'Review applicants',
                  text: 'Evaluate incoming requests and review relevant worker compliance visibility.',
                },
                {
                  step: '4',
                  title: 'Approve or reject workers',
                  text: 'Make staffing decisions and keep operations moving from the facility console.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl bg-white/10 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950">
                      {item.step}
                    </div>
                    <div className="text-lg font-bold tracking-tight">{item.title}</div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-cyan-50/90">{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Professional Workflow
            </div>
            <div className="mt-6 space-y-5">
              {[
                {
                  step: '1',
                  title: 'Create a professional account',
                  text: 'Workers create an account and enter their profile details.',
                },
                {
                  step: '2',
                  title: 'Complete onboarding',
                  text: 'Sign agreements and upload required compliance documents.',
                },
                {
                  step: '3',
                  title: 'Browse and request shifts',
                  text: 'Search available shifts and request assignments when eligible.',
                },
                {
                  step: '4',
                  title: 'Track updates',
                  text: 'See notifications for approvals, rejections, compliance updates, and staffing activity.',
                },
              ].map((item) => (
                <div key={item.step} className="rounded-2xl bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-600 text-sm font-bold text-white">
                      {item.step}
                    </div>
                    <div className="text-lg font-bold tracking-tight text-slate-950">
                      {item.title}
                    </div>
                  </div>
                  <div className="mt-3 text-sm leading-7 text-slate-600">{item.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Payroll Boundary
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-slate-950">
                Staffing and payroll stay cleanly separated
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
                Wezen Staffing manages onboarding, compliance, shifts, and approvals.
                Payroll is handled separately through the payroll portal, which keeps
                the marketplace clean and avoids duplicating payroll logic.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Staffing Platform
                </div>
                <div className="mt-2 text-xl font-bold text-slate-950">
                  Onboarding, shifts, approvals
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Payroll Platform
                </div>
                <div className="mt-2 text-xl font-bold text-slate-950">
                  Pay cycles, payments, ledger
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-wrap gap-4">
          <Link
            href="/facilities"
            className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
          >
            Explore Facility Workflow
          </Link>

          <Link
            href="/professionals"
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
          >
            Explore Professional Workflow
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
