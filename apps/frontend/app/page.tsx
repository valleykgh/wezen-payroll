export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <div className="text-lg font-bold text-slate-950">Wezen Payroll</div>
            <div className="text-sm text-slate-500">
              Secure payroll portal for Wezen Staffing
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Payroll Portal
            </div>

            <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Fast, transparent payroll for your weekly work
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Access pay history, weekly payroll activity, ledger visibility,
              and contractor payment records in one secure portal built for
              Wezen Staffing.
            </p>

            <div className="mt-10 grid gap-4 sm:max-w-xl sm:grid-cols-2">
              <a
                href="/employee/login"
                className="flex min-h-[120px] flex-col justify-center rounded-[1.75rem] bg-cyan-600 px-6 py-6 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
              >
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Employee Portal
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight">
                  Employee Login
                </div>
                <div className="mt-2 text-sm text-cyan-50/90">
                  View payroll, payments, and weekly history.
                </div>
              </a>

              <a
                href="/admin/login"
                className="flex min-h-[120px] flex-col justify-center rounded-[1.75rem] border border-slate-200 bg-white px-6 py-6 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-50"
              >
                <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                  Admin Portal
                </div>
                <div className="mt-2 text-2xl font-bold tracking-tight">
                  Admin Login
                </div>
                <div className="mt-2 text-sm text-slate-600">
                  Manage payroll operations, time entry, and payment flow.
                </div>
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-4 text-sm text-slate-500">
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Weekly payroll
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Early payment tracking
              </div>
              <div className="rounded-full bg-white px-4 py-2 shadow-sm ring-1 ring-slate-200">
                Ledger transparency
              </div>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Employee Access
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight">
                Know exactly what you earned and when you were paid
              </h2>
              <p className="mt-4 text-base leading-7 text-cyan-50/90">
                Review payment history, current payroll activity, and ledger
                details without needing to contact payroll for every update.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    Payments
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    Weekly visibility
                  </div>
                </div>

                <div className="rounded-2xl bg-white/10 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-cyan-100">
                    Ledger
                  </div>
                  <div className="mt-1 text-lg font-bold text-white">
                    Transparent records
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
                Admin Operations
              </div>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
                Run payroll with control and accuracy
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-600">
                Manage time entry, payroll cycles, adjustments, and operational
                review from one dedicated admin environment.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Time entry
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    Faster weekly processing
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Payroll admin
                  </div>
                  <div className="mt-1 text-lg font-bold text-slate-950">
                    Centralized controls
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-16 rounded-[2rem] bg-gradient-to-r from-slate-900 to-cyan-700 p-10 text-white shadow-xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Secure payroll access
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight">
                Built for payroll clarity and contractor visibility
              </h2>
              <p className="mt-4 max-w-3xl text-lg leading-8 text-cyan-50/90">
                Wezen Payroll keeps employee and administrator access clean,
                secure, and separate while giving both sides the visibility they
                need.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Employees
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Payroll records + payment history
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-wide text-cyan-100">
                  Admins
                </div>
                <div className="mt-2 text-xl font-bold text-white">
                  Time entry + payroll execution
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
