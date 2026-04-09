import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function ContactPage() {
  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Contact
            </div>

            <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Get in touch with Wezen Staffing
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Reach out for facility access, professional onboarding questions,
              partnership conversations, or general platform support.
            </p>

            <div className="mt-10 space-y-4">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Support
                </div>
                <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">
                  support@wezenstaffing.com
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  Use this email for facility access, worker onboarding, platform questions,
                  compliance support, and general support requests.
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  What we can help with
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Facility questions
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Shift operations, applicant review, and account access.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4">
                    <div className="text-sm font-semibold text-slate-950">
                      Professional questions
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Onboarding, documents, agreements, and shift requests.
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-4 sm:col-span-2">
                    <div className="text-sm font-semibold text-slate-950">
                      Platform support
                    </div>
                    <div className="mt-1 text-sm text-slate-600">
                      Compliance, approvals, workflow issues, and general platform help.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
              Reach Out
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight">
              Let’s make staffing operations easier
            </h2>

            <p className="mt-4 text-base leading-7 text-cyan-50/90">
              Whether you’re a healthcare facility looking for coverage support or a
              professional trying to get onboarded, we’ll help you get to the right workflow.
            </p>

            <div className="mt-8 grid gap-4">
              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Facility Access
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  Post shifts and manage applicants
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Professional Access
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  Complete onboarding and browse shifts
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Platform Questions
                </div>
                <div className="mt-2 text-lg font-bold text-white">
                  Compliance, approvals, and workflow support
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
              >
                Go to Login
              </Link>

              <Link
                href="/how-it-works"
                className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
