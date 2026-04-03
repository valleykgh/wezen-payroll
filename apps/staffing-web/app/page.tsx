import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="max-w-3xl">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Wezen Staffing
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            Staffing marketplace frontend is now set up locally
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Use the links below to test the first app shell pages for facilities
            and healthcare professionals.
          </p>
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/login"
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm"
          >
            Go to Login
          </Link>
          <Link
            href="/facility/dashboard"
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
          >
            Facility Dashboard
          </Link>
          <Link
            href="/worker/dashboard"
            className="rounded-full border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-900"
          >
            Worker Dashboard
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
