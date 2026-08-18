"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiBase, apiFetch } from "../../lib/api";

type Period = { id: string; periodStart: string; periodEnd: string; payDate: string };
function iso(date: Date) { return date.toISOString().slice(0, 10); }

export default function EmployeePaystubsPage() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(iso(now));
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await apiFetch<{ periods: Period[] }>(`/api/employee/imported-paystubs?from=${from}&to=${to}`);
      setPeriods(result.periods || []);
    } catch (e: any) { setError(e?.message || "Could not load paystubs"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function setThisMonth() {
    setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
    setTo(iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  }

  async function download() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`${apiBase()}/api/employee/imported-paystubs/pdf?from=${from}&to=${to}`, { credentials: "include" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || "Download failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url; link.download = `wezen-paystubs-${from}-${to}.pdf`; link.click(); URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.message || "Download failed"); }
    finally { setLoading(false); }
  }

  async function email() {
    setLoading(true); setError(""); setMessage("");
    try {
      const result = await apiFetch<{ email: string; payPeriods: number }>("/api/employee/imported-paystubs/email", { method: "POST", body: JSON.stringify({ from, to }) });
      setMessage(`${result.payPeriods} paystub(s) emailed to ${result.email}.`);
    } catch (e: any) { setError(e?.message || "Email failed"); }
    finally { setLoading(false); }
  }

  return <main style={{ maxWidth: 920, margin: "0 auto", padding: 24 }}>
    <Link href="/employee" style={{ color: "#0891b2" }}>← Employee dashboard</Link>
    <h1 style={{ fontSize: 30, marginBottom: 6 }}>Generate Paystubs</h1>
    <p style={{ color: "#64748b" }}>Only payroll assigned to your verified employee account is available.</p>
    <section style={{ padding: 20, border: "1px solid #e2e8f0", borderRadius: 16, background: "white" }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
        <label>From<br/><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ padding: 10 }}/></label>
        <label>To<br/><input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ padding: 10 }}/></label>
        <button onClick={setThisMonth} style={{ padding: 11 }}>This month</button>
        <button onClick={load} disabled={loading} style={{ padding: 11 }}>Show pay periods</button>
      </div>
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {message && <p style={{ color: "#166534" }}>{message}</p>}
      <h2 style={{ marginTop: 24 }}>{periods.length} pay period(s)</h2>
      <div style={{ display: "grid", gap: 8 }}>
        {periods.map((period) => <div key={period.id} style={{ padding: 12, borderRadius: 10, background: "#f8fafc" }}>
          {iso(new Date(period.periodStart))} to {iso(new Date(period.periodEnd))} · Pay date {iso(new Date(period.payDate))}
        </div>)}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button onClick={download} disabled={loading || !periods.length} style={{ padding: "11px 16px", background: "#0f172a", color: "white", borderRadius: 10 }}>Download PDF</button>
        <button onClick={email} disabled={loading || !periods.length} style={{ padding: "11px 16px", background: "#0891b2", color: "white", borderRadius: 10 }}>Email to me</button>
      </div>
    </section>
  </main>;
}
