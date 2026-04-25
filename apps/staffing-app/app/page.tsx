import Link from "next/link";

export default function AppHomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <section className="mx-auto flex min-h-[85vh] max-w-md flex-col justify-between">
        <div>
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Wezen Staffing
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight">
              Staffing app for shifts, approvals, and notifications.
            </h1>
            <p className="mt-4 text-base text-slate-300">
              A focused app experience for facilities, workers, and internal admins.
            </p>
          </div>

          <div className="grid gap-3">
            <Link
              href="/login"
              className="rounded-2xl bg-cyan-400 px-5 py-4 text-center font-bold text-slate-950 shadow-lg"
            >
              Sign in
            </Link>

            <Link
              href="/app"
              className="rounded-2xl border border-white/15 px-5 py-4 text-center font-semibold text-white"
            >
              Continue to app
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="font-semibold text-white">App focus</p>
          <p className="mt-2">
            Shift posting, worker booking, approval notifications, onboarding,
            documents, and admin operations.
          </p>
        </div>
      </section>
    </main>
  );
}
