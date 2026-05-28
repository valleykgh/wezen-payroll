import { LoginForm } from "@/components/shared/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <section className="mx-auto max-w-md">
        <a href="/index.html" className="mb-6 inline-block text-sm font-semibold text-cyan-300">← Back to Welcome</a>
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            Wezen Staffing App
          </p>
          <h1 className="mt-4 text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-slate-300">
            Sign in with your Wezen Staffing account.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-5 text-slate-950 shadow-xl">
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
