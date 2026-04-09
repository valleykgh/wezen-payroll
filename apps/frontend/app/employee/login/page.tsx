"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { setSession, AuthedUser } from "../../lib/auth";

type LoginResp = {
  user: AuthedUser;
  mustChangePassword?: boolean;
};

function EmployeeLoginPageInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/employee";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);

    try {
      const data = await apiFetch<LoginResp>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });

      if (data.user.role !== "EMPLOYEE") {
        throw new Error("This login is for employee users only.");
      }

      localStorage.removeItem("payroll_user");
      setSession(data.user);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[1fr_0.95fr] lg:items-center">
        <div>
          <a
            href="/"
            className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Back to payroll home
          </a>

          <div className="mt-8 text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
            Employee Portal
          </div>

          <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            Access your payroll records securely
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Sign in to review pay history, payment details, payroll summaries,
            and other employee payroll activity in one place.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Payment History
              </div>
              <div className="mt-2 text-lg font-bold text-slate-950">
                Review your payroll activity
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                Secure Portal
              </div>
              <div className="mt-2 text-lg font-bold text-slate-950">
                Protected employee access
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
          <div className="text-2xl font-bold tracking-tight text-slate-950">
            Employee Login
          </div>
          <p className="mt-3 text-slate-600">
            Sign in to access your employee payroll portal.
          </p>

          {err ? (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {err}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center justify-center rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Signing in..." : "Sign In"}
            </button>

            <div className="text-sm text-slate-500">
              Admin?{" "}
              <a
                href="/admin/login"
                className="font-semibold text-cyan-700 underline underline-offset-4"
              >
                Go to Admin Login
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeLoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-slate-600">Loading...</div>}>
      <EmployeeLoginPageInner />
    </Suspense>
  );
}
