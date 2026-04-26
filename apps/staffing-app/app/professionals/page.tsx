export default function ProfessionalsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-slate-950">
      <section className="mx-auto max-w-md">
        <a href="/index.html" className="text-sm font-semibold text-cyan-700">
          ← Home
        </a>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
          For Professionals
        </p>

        <h1 className="mt-5 text-4xl font-bold leading-tight">
          Keep onboarding, compliance, and shift requests in one worker portal
        </h1>

        <p className="mt-5 text-base leading-7 text-slate-600">
          Complete onboarding, upload compliance documents, sign agreements,
          browse open shifts, and track request activity through a streamlined
          professional experience.
        </p>

        <div className="mt-8 grid gap-3">
          <a
            href="/login/index.html"
            className="rounded-2xl bg-cyan-600 px-5 py-4 text-center font-bold text-white shadow-sm"
          >
            Professional Login
          </a>

          <a
            href="/signup/worker/index.html"
            className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-center font-bold text-slate-950 shadow-sm"
          >
            Create Professional Account
          </a>
        </div>

        <div className="mt-8 grid gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Clear onboarding flow</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Complete agreements and keep required compliance documents organized
              in one portal.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Better shift visibility</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Search open shifts, manage requests, and understand your staffing
              activity more easily.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Cleaner communication</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Get notified when requests are approved or rejected and when document
              updates need attention.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
