import { FacilitySignupForm } from "@/components/shared/facility-signup-form";

export default function FacilitySignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-white">
      <section className="mx-auto max-w-md">
        <a href="/index.html" className="text-sm font-semibold text-cyan-300">
          ← Back
        </a>

        <h1 className="mt-6 text-3xl font-bold">Create facility account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Facility accounts require a Wezen invite code before activation.
        </p>

        <div className="mt-6">
          <FacilitySignupForm />
        </div>
      </section>
    </main>
  );
}
