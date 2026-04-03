import Link from 'next/link';
import { Footer } from '@/components/shared/footer';
import { Navbar } from '@/components/shared/navbar';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Access
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Choose your login
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Access the right dashboard for your role inside the Wezen Staffing platform.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-2xl font-bold tracking-tight text-slate-950">
              Facility Login
            </div>
            <p className="mt-3 text-slate-600">
              Post shifts, review applicants, manage compliance, and fill coverage fast.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              <li>• Post AM / PM / NOC shifts</li>
              <li>• Review clinician documents</li>
              <li>• Approve or reject applicants</li>
            </ul>
            <Link
              href="/facility/dashboard"
              className="mt-8 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Continue as Facility
            </Link>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="text-2xl font-bold tracking-tight text-slate-950">
              Professional Login
            </div>
            <p className="mt-3 text-slate-600">
              Manage your profile, complete documents, search nearby shifts, and track requests.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-slate-600">
              <li>• Complete onboarding and agreements</li>
              <li>• Search shifts by miles and location</li>
              <li>• Track approvals and schedule</li>
            </ul>
            <Link
              href="/worker/dashboard"
              className="mt-8 inline-flex rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm"
            >
              Continue as Professional
            </Link>
            <a
              href="https://payroll.wezenstaffing.com"
              className="mt-5 block text-sm font-medium text-slate-700 underline underline-offset-4"
            >
              Need payroll access?
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
