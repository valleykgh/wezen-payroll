import { ProfessionalSignupForm } from "@/components/shared/professional-signup-form";

export default function WorkerSignupPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+3rem)] text-white">
      <section className="mx-auto max-w-md">
        <a href="/index.html" className="text-sm font-semibold text-cyan-300">
          ← Back
        </a>

        <h1 className="mt-6 text-3xl font-bold">Create worker account</h1>
        <p className="mt-2 text-sm text-slate-300">
          Create your profile, then upload required credentials for Wezen review.
        </p>

        <div className="mt-6">
          <ProfessionalSignupForm />
        </div>
      </section>
    </main>
  );
}
