"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";

function SetupPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    try {
      setBusy(true);
      setErr(null);

        await apiFetch("/api/auth/accept-invite", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          token,
          password,
        }),
      });

      alert("Account created. You can now login.");
      router.push("/employee/login");
    } catch (e: any) {
      console.error(e);
      setErr(e?.message || "Failed to set password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h2 style={{ marginTop: 0 }}>Create Password</h2>

      <div style={{ display: "grid", gap: 10 }}>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
        />

        {err ? (
          <div style={{ color: "crimson", fontSize: 13 }}>
            {err}
          </div>
        ) : null}

        <button
          type="button"
          onClick={submit}
          disabled={busy || !token || !password}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#fff",
            fontWeight: 700,
          }}
        >
          {busy ? "Saving..." : "Set Password"}
        </button>
      </div>
    </div>
  );
}

export default function SetupPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading...</div>}>
      <SetupPasswordInner />
    </Suspense>
  );
}
