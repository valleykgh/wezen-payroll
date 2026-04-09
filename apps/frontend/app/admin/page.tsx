import Link from "next/link";

const cards = [
  {
    href: "/admin/time-entry",
    title: "Time Entry",
    description: "Create and edit employee time entries, manage hours, and prepare payroll-ready data.",
  },
  {
    href: "/admin/time-entries-week",
    title: "Weekly Entries",
    description: "Review time entries across the week and verify payroll readiness before processing.",
  },
  {
    href: "/admin/missed-time",
    title: "Exceptions",
    description: "Review missed time, supplemental billing issues, and payroll exceptions that need attention.",
  },
  {
    href: "/admin/pay-period-summary",
    title: "Pay Period Summary",
    description: "View payroll summaries, billing exports, and supporting payroll details by period.",
  },
  {
    href: "/admin/payroll-runs",
    title: "Payroll Runs",
    description: "Track payroll runs, status, and finalized payroll processing activity.",
  },
  {
    href: "/admin/users",
    title: "Admin Users",
    description: "Create admin accounts, assign roles, and manage payroll administration access.",
  },
  {
    href: "/admin/employees",
    title: "Employees",
    description: "Review employees, payroll-linked records, and contractor setup data.",
  },
  {
    href: "/admin/employees/new",
    title: "Create Employee",
    description: "Add a new employee or contractor record and prepare them for payroll operations.",
  },
];

export default function AdminHomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
            Admin Dashboard
          </div>
          <h2 className="mt-3 text-4xl font-bold tracking-tight">
            Payroll operations at a glance
          </h2>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-cyan-50/90">
            Use this dashboard to manage payroll data, employee records, time entry, payroll exceptions, and administrative controls.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Operations</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">Payroll</div>
          <div className="mt-2 text-sm text-slate-600">
            Centralized admin workspace
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Review Area</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">Entries</div>
          <div className="mt-2 text-sm text-slate-600">
            Weekly and exception workflows
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Access</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">Admins</div>
          <div className="mt-2 text-sm text-slate-600">
            Role-managed payroll access
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-medium text-slate-500">Coverage</div>
          <div className="mt-2 text-3xl font-bold text-slate-950">Employees</div>
          <div className="mt-2 text-sm text-slate-600">
            Contractor and payroll record management
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
              Quick access
            </div>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Start from the tools you use most
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Choose a payroll admin workflow below to continue.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5 transition hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-md"
            >
              <div className="text-lg font-bold tracking-tight text-slate-950">
                {card.title}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {card.description}
              </div>
              <div className="mt-4 text-sm font-semibold text-cyan-700">
                Open section →
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-xl font-bold tracking-tight text-slate-950">
          Recommended workflow
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step 1
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950">
              Review time entry
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Validate employee hours and confirm payroll inputs are complete.
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step 2
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950">
              Resolve exceptions
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Clear missed time, supplemental items, and billing issues before final processing.
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-5 py-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Step 3
            </div>
            <div className="mt-2 text-lg font-bold text-slate-950">
              Finalize payroll
            </div>
            <div className="mt-2 text-sm text-slate-600">
              Complete payroll processing and move forward with payment execution.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
