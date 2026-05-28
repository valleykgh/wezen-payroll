import Link from 'next/link';

export default function AppLandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-white">
      <section className="mx-auto max-w-md">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Wezen Staffing
          </p>

          <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
            Welcome
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Choose how you want to use Wezen Staffing.
          </p>
        </div>

        <div className="grid gap-4">
          <Link
            href="/professionals/index.html"
            className="rounded-3xl bg-cyan-600 p-5 text-center shadow-xl"
          >
            <div className="text-xl font-extrabold">I am a Professional</div>
            <div className="mt-2 text-sm font-semibold text-cyan-50">
              Create an account, upload documents, set availability, and find shifts.
            </div>
          </Link>

          <Link
            href="/facilities/index.html"
            className="rounded-3xl border border-white/15 bg-slate-900 p-5 text-center text-white shadow-xl"
          >
            <div className="text-xl font-extrabold">I am a Facility</div>
            <div className="mt-2 text-sm font-semibold text-slate-300">
              Post shifts, review applicants, and manage staffing coverage.
            </div>
          </Link>

          <Link
            href="/login/index.html"
            className="rounded-3xl border border-white/15 bg-white/10 p-5 text-center shadow-xl"
          >
            <div className="text-lg font-extrabold">Already have an account?</div>
            <div className="mt-2 text-sm font-semibold text-slate-300">
              Sign in securely.
            </div>
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Facility signup requires a Wezen invite code.
        </p>
      </section>
    </main>
  );
}
