"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { setSession, AuthedUser } from "../../lib/auth";

type LoginResp = { token: string; user: AuthedUser; mustChangePassword?: boolean };

function AdminLoginInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/admin";

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

      const role = String(data.user.role || "").toUpperCase();
      const isAdminRole =
        role === "SUPER_ADMIN" ||
        role === "PAYROLL_ADMIN" ||
        role === "HR_ADMIN";

      if (!isAdminRole) {
        throw new Error("This login is for ADMIN users only.");
      }

      setSession(data.token, data.user);
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h2 style={{ margin: "8px 0 12px" }}>Admin Login</h2>

      <form onSubmit={onSubmit} autoComplete="off" style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ padding: 10 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Employee? Go to <a href="/employee/login">Employee Login</a>
        </div>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
      <AdminLoginInner />
    </Suspense>
  );
}
