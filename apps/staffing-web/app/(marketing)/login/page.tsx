'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { LoginForm } from '@/components/shared/login-form';

function LoginPageInner() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '';

  const isFacilityFlow = next.startsWith('/facility');
  const isWorkerFlow = next.startsWith('/worker');
  const isAdminFlow = next.startsWith('/admin');

  return (
    <div className="bg-slate-50">
      <Navbar />

      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Access
            </div>

            <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950">
              Sign in to Wezen Staffing
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              {isAdminFlow
                ? 'Internal administrators can manage worker approvals, facility invite codes, and operational controls.'
                : isFacilityFlow
                  ? 'Facilities can manage shift coverage, applicants, and approvals.'
                  : isWorkerFlow
                    ? 'Professionals can browse shifts, manage onboarding, and track requests.'
                    : 'Facilities can manage shift coverage and applicants. Professionals can browse shifts and manage onboarding.'}
            </p>

            <div className="mt-10 grid gap-4 sm:max-w-2xl">
              {isAdminFlow ? (
                <div className="rounded-[1.75rem] border border-cyan-200 bg-cyan-50 px-6 py-6 shadow-sm">
                  <div className="text-2xl font-bold tracking-tight text-slate-950">
                    Internal admin access
                  </div>
                  <div className="mt-3 text-slate-600">
                    Sign in with your Wezen internal admin account to manage invite codes and platform operations.
                  </div>
                </div>
              ) : null}

              {isFacilityFlow ? (
                <Link
                  href="/signup/facility"
                  className="block rounded-[1.75rem] border border-cyan-200 bg-cyan-50 px-6 py-6 shadow-sm transition hover:bg-cyan-100"
                >
                  <div className="text-2xl font-bold tracking-tight text-slate-950">
                    Facility access
                  </div>
                  <div className="mt-3 text-slate-600">
                    Post shifts, manage applicants, and approve workers.
                  </div>
                  <div className="mt-6 inline-flex rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white">
                    Activate Facility Account
                  </div>
                </Link>
              ) : null}

              {isWorkerFlow ? (
                <Link
                  href="/signup/professional"
                  className="block rounded-[1.75rem] border border-cyan-200 bg-cyan-50 px-6 py-6 shadow-sm transition hover:bg-cyan-100"
                >
                  <div className="text-2xl font-bold tracking-tight text-slate-950">
                    Professional access
                  </div>
                  <div className="mt-3 text-slate-600">
                    Search shifts, manage requests, and keep documents current.
                  </div>
                  <div className="mt-6 inline-flex rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white">
                    Create Professional Account
                  </div>
                </Link>
              ) : null}

              {!isFacilityFlow && !isWorkerFlow && !isAdminFlow ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Link
                    href="/signup/facility"
                    className="block rounded-[1.75rem] border border-slate-200 bg-white px-6 py-6 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                  >
                    <div className="text-2xl font-bold tracking-tight text-slate-950">
                      Facility access
                    </div>
                    <div className="mt-3 text-slate-600">
                      Post shifts, manage applicants, and approve workers.
                    </div>
                    <div className="mt-6 inline-flex rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white">
                      Activate Facility Account
                    </div>
                  </Link>

                  <Link
                    href="/signup/professional"
                    className="block rounded-[1.75rem] border border-slate-200 bg-white px-6 py-6 shadow-sm transition hover:border-cyan-200 hover:bg-cyan-50"
                  >
                    <div className="text-2xl font-bold tracking-tight text-slate-950">
                      Professional access
                    </div>
                    <div className="mt-3 text-slate-600">
                      Search shifts, manage requests, and keep documents current.
                    </div>
                    <div className="mt-6 inline-flex rounded-full bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white">
                      Create Professional Account
                    </div>
                  </Link>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <LoginForm next={next} />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginPageInner />
    </Suspense>
  );
}
