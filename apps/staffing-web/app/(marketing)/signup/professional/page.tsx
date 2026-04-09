import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { ProfessionalSignupForm } from '@/components/shared/professional-signup-form';

export default function ProfessionalSignupPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.95fr] lg:items-start">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Professionals
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              Join Wezen Staffing as a healthcare professional
            </h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Create your account to manage your profile, complete onboarding,
              search nearby shifts, and track facility approvals.
            </p>

            <div className="mt-8 text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-semibold text-cyan-700 underline underline-offset-4"
              >
                Sign in
              </Link>
            </div>
          </div>

          <ProfessionalSignupForm />
        </div>
      </main>
      <Footer />
    </div>
  );
}
