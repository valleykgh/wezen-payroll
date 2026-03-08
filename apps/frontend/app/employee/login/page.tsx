"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";
import { setSession, AuthedUser } from "../../lib/auth";

type LoginResp = { token: string; user: AuthedUser; mustChangePassword?: boolean };

export default function EmployeeLoginPage() {
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
        throw new Error("This login is for EMPLOYEE users only.");
      }

      setSession(data.token, data.user);

      // Optional: if mustChangePassword true, route to change-password UI later
      router.replace(next);
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h2 style={{ margin: "8px 0 12px" }}>Employee Login</h2>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Email</div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", padding: 8 }} />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.8 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: 8 }}
          />
        </label>

        {err && <div style={{ color: "crimson" }}>{err}</div>}

        <button disabled={busy} style={{ padding: 10 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>
          Admin? Go to <a href="/admin/login">Admin Login</a>
        </div>
      </form>
    </div>
  );
}
