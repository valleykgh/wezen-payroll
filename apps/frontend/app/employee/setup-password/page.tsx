"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "../../lib/api";

function SetupPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [password, setPassword] = useState("");
  const [legalName, setLegalName] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setErr("Activation link is missing or invalid."); setLoading(false); return; }
    apiFetch(`/api/auth/invite?token=${encodeURIComponent(token)}`, { auth: false })
      .then((result: any) => {
        const employee = result.employee || {};
        setLegalName(employee.legalName || ""); setEmail(employee.email || "");
        setAddressLine1(employee.addressLine1 || ""); setAddressLine2(employee.addressLine2 || "");
        setCity(employee.city || ""); setState(employee.state || ""); setZip(employee.zip || "");
      })
      .catch((e: any) => setErr(e?.message || "Activation link is invalid or expired."))
      .finally(() => setLoading(false));
  }, [token]);

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
          addressLine1, addressLine2, city, state, zip, ssnLast4,
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
    <div style={{ maxWidth: 560, margin: "40px auto", padding: 24, border: "1px solid #e2e8f0", borderRadius: 16 }}>
      <h2 style={{ marginTop: 0 }}>Activate Your Payroll Account</h2>
      <p style={{ color: "#475569" }}>Confirm your payroll information. Your SSN is displayed on paystubs only as the last four digits.</p>

      <div style={{ display: "grid", gap: 10 }}>
        <label>Legal name<input value={legalName} readOnly style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, background: "#f8fafc" }} /></label>
        <label>Email<input value={email} readOnly style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8, background: "#f8fafc" }} /></label>
        <label>Address line 1<input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
        <label>Address line 2 (optional)<input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <label>City<input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
          <label>State<input value={state} maxLength={2} onChange={(e) => setState(e.target.value.toUpperCase())} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
          <label>ZIP<input value={zip} maxLength={10} onChange={(e) => setZip(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
        </div>
        <label>Last 4 digits of SSN<input inputMode="numeric" maxLength={4} value={ssnLast4} onChange={(e) => setSsnLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} /></label>
        <input
          type="password"
          placeholder="Create payroll password (minimum 8 characters)"
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
          disabled={busy || loading || !token || password.length < 8 || !addressLine1 || !city || !state || !zip || ssnLast4.length !== 4}
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid #111",
            background: "#fff",
            fontWeight: 700,
          }}
        >
          {busy ? "Activating..." : loading ? "Loading..." : "Activate Payroll Account"}
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
