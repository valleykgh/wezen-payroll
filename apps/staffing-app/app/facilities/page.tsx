export default function FacilitiesPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-slate-950">
      <section className="mx-auto max-w-md">
        <a href="/index.html" className="text-sm font-semibold text-cyan-700">
          ← Home
        </a>

        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-cyan-700">
          For Facilities
        </p>

        <h1 className="mt-5 text-4xl font-bold leading-tight">
          Manage staffing operations with better speed, control, and visibility
        </h1>

        <p className="mt-5 text-base leading-7 text-slate-600">
          Post shifts, review applicants, approve qualified professionals,
          monitor fill status, and manage staffing workflows from one clean
          facility dashboard.
        </p>

        <div className="mt-8 grid gap-3">
          <a
            href="/login/index.html"
            className="rounded-2xl bg-cyan-600 px-5 py-4 text-center font-bold text-white shadow-sm"
          >
            Facility Login
          </a>

          <a
            href="/signup/facility/index.html"
            className="rounded-2xl border border-slate-300 bg-white px-5 py-4 text-center font-bold text-slate-950 shadow-sm"
          >
            Create Facility Account
          </a>
        </div>

        <div className="mt-8 grid gap-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Faster staffing decisions</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Review incoming requests quickly and make decisions with better
              visibility into worker readiness.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Better workflow control</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Post AM, PM, and NOC coverage, approve or reject applicants,
              and manage shift activity.
            </p>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h2 className="text-xl font-bold">Cleaner compliance visibility</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Focus on the compliance documents and worker readiness that matter
              before approving requests.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
