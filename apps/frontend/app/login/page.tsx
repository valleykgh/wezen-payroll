"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function normalizeApiBase(raw?: string) {
  const v = (raw || "").trim();
  if (!v) return "http://localhost:4000";
  // If user set "http://localhost" with no port, default to 4000 for dev.
  if (v === "http://localhost" || v === "https://localhost") return "http://localhost:4000";
  return v.replace(/\/+$/, "");
}

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const mode = (sp.get("mode") || "employee").toLowerCase() === "admin" ? "admin" : "employee";
  const API_BASE = useMemo(() => normalizeApiBase(process.env.NEXT_PUBLIC_API_URL), []);

  const [email, setEmail] = useState(mode === "admin" ? "admin@wezenstaffing.com" : "");
  const [password, setPassword] = useState(mode === "admin" ? "ChangeMe123!" : "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    try {
      const r = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || `Login failed (${r.status})`);
      if (!j?.token || !j?.user) throw new Error("Login response missing token/user");

      const role = String(j.user.role || "").toUpperCase();

      if (mode === "admin") {
        if (role !== "ADMIN") throw new Error("This is the ADMIN login page. Please use an Admin account.");
        localStorage.setItem("admin_token", j.token);
        // optional: clear employee token so roles don’t mix
        localStorage.removeItem("emp_token");
        router.push("/admin/time-entry");
        return;
      }

      // employee mode
      if (role !== "EMPLOYEE") throw new Error("This is the EMPLOYEE login page. Please use an Employee account.");
      localStorage.setItem("emp_token", j.token);
      localStorage.removeItem("admin_token");
      router.push("/employee");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>
          {mode === "admin" ? "Admin Login" : "Employee Login"}
        </h1>
        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
          API: <code>{API_BASE}</code>
        </div>
      </div>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        {err ? (
          <div style={{ color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{err}</div>
        ) : null}

        <button
          disabled={loading}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div style={{ marginTop: 16, fontSize: 13 }}>
        {mode === "admin" ? (
          <a href="/employee/login">Go to Employee Login</a>
        ) : (
          <a href="/admin/login">Go to Admin Login</a>
        )}
      </div>
    </div>
  );
}
