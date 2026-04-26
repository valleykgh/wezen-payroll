export default function AppHomePage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-slate-950">
      <section className="mx-auto max-w-md">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
          Wezen Staffing
        </p>

        <h1 className="mt-5 text-4xl font-bold leading-tight">
          A modern staffing marketplace for healthcare facilities and professionals
        </h1>

        <p className="mt-5 text-base leading-7 text-slate-600">
          Manage shift coverage, review applicants, streamline worker onboarding,
          and create a faster staffing experience.
        </p>

        <div className="mt-8 grid gap-3">
          <a
            href="/login/index.html"
            className="rounded-2xl bg-cyan-600 px-5 py-4 text-center font-bold text-white shadow-sm"
          >
            Go to Login
          </a>

          <a
            href="/facilities/index.html"
            className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-center font-bold text-slate-950 shadow-sm"
          >
            For Facilities
          </a>

          <a
            href="/professionals/index.html"
            className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-center font-bold text-slate-950 shadow-sm"
          >
            For Professionals
          </a>
        </div>

        <div className="mt-8 rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300">
            For Facilities
          </p>
          <h2 className="mt-3 text-2xl font-bold">
            Fill shifts faster with better visibility
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Post shifts, track coverage, review applicants, manage DNR restrictions,
            and keep operations moving from one central workspace.
          </p>
        </div>

        <div className="mt-4 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-700">
            For Professionals
          </p>
          <h2 className="mt-3 text-2xl font-bold">
            Keep onboarding, documents, and requests in one place
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Complete onboarding, upload compliance documents, browse shifts,
            and manage requests through a polished worker portal.
          </p>
        </div>
      </section>
    </main>
  );
}
