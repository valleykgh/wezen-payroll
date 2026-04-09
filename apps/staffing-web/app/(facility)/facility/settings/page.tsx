export default function FacilitySettingsPage() {
  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Settings
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Facility settings
        </h1>
        <p className="mt-2 text-slate-600">
          Review account details and basic facility preferences.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Account details
          </h2>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Facility name: Wezen Staffing Demo Facility
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Admin access: Primary facility administrator
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Shift types enabled: AM, PM, NOC
            </div>
          </div>
        </section>

        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold tracking-tight text-slate-950">
            Operational preferences
          </h2>
          <div className="mt-5 space-y-4 text-sm text-slate-600">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Applicant review workflow is active.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Compliance visibility is enabled for request review.
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              Invite-only facility onboarding is enforced by internal admin.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
