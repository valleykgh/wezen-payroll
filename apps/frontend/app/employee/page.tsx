"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4001";
type BreakRow = { startTime: string; endTime: string; minutes: number };

type EmpTimeEntry = {
  id: string;
  workDate: string;
  shiftType: string;
  startTime: string | null;
  endTime: string | null;
  minutesWorked: number; // WORKED minutes (raw)
  breakMinutes: number;  // fallback
  computedBreakMinutes?: number; // preferred (sum of breaks)
  notes: string | null;
  status: string;
  breaks?: BreakRow[];
};

type PaySummary = {
  employee: {
    id: string;
    legalName: string;
    preferredName: string | null;
    email: string;
    hourlyRateCents: number;
  };
    totals: {
  totalMinutes: number;
  totalBreakMinutes: number;
  payableMinutes: number;
  totalHours: number;

  regularMinutes?: number;
  overtimeMinutes?: number;
  doubleMinutes?: number;

  regularPayCents?: number;
  overtimePayCents?: number;
  doublePayCents?: number;

  grossPayCents: number;
  adjustmentsCents: number;
  loanDeductionCents: number;
  netPayCents: number;
};
    adjustments?: Array<{
    amountCents: number;
    reason?: string | null;
  }>;
  loanDeductions?: Array<{
    amountCents: number;
  }>;
};

type PaystubData = {
  company: {
    legalName: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  };
  employee: {
    id: string;
    legalName: string;
    preferredName: string | null;
    email: string;
    hourlyRateCents: number;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    ssnLast4?: string | null;
  };
  payPeriod: {
    from: string;
    to: string;
    payDate: string;
  };
  totals: {
    totalWorkedMinutes: number;
    totalBreakMinutes: number;
    totalPayableMinutes: number;
    payableHours: number;
    grossPayCents: number;
    adjustmentsCents: number;
    loanDeductionCents: number;
    netPayCents: number;
  };
  adjustments: Array<{
    id: string;
    createdAt: string;
    amountCents: number;
    reason?: string | null;
  }>;
  loanDeductions: Array<{
    id: string;
    amountCents: number;
    note?: string | null;
    periodStart: string;
    periodEnd: string;
  }>;
};

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers || {}),
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || "Request failed");
    }
    const text = await res.text().catch(() => "");
    throw new Error(text || "Request failed");
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }

  return res;
}

function fmtCents(cents: number) {
  const v = (cents || 0) / 100;
  return v.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPreviousPayrollWeek() {
  const today = new Date();

  // JS: Sunday=0, Monday=1, ... Saturday=6
  const day = today.getDay();

  // how many days since this week's Monday
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  // this week's Monday
  const thisWeekMonday = new Date(today);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(today.getDate() - daysSinceMonday);

  // previous week's Monday
  const prevMonday = new Date(thisWeekMonday);
  prevMonday.setDate(thisWeekMonday.getDate() - 7);

  // previous week's Sunday
  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  return {
    from: toISODate(prevMonday),
    to: toISODate(prevSunday),
  };
}

function cleanJwt(raw: string) {
  // Accept either:
  // 1) a raw JWT: "aaa.bbb.ccc"
  // 2) a header form: "Bearer aaa.bbb.ccc"
  return String(raw || "")
    .trim()
    .replace(/^Bearer\s+/i, "");
}

export default function EmployeePage() {
const [sessionReady, setSessionReady] = useState(false);
  const [from, setFrom] = useState<string>(() => getPreviousPayrollWeek().from);
const [to, setTo] = useState<string>(() => getPreviousPayrollWeek().to);

  const [entries, setEntries] = useState<EmpTimeEntry[]>([]);
  const [summary, setSummary] = useState<PaySummary | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
 
  const [addressLine1, setAddressLine1] = useState("");
const [addressLine2, setAddressLine2] = useState("");
const [city, setCity] = useState("");
const [state, setState] = useState("");
const [zip, setZip] = useState("");
const [ssnLast4, setSsnLast4] = useState("");


useEffect(() => {
  async function checkSession() {
    try {
      await apiFetch("/api/auth/me", { method: "GET" });
      setSessionReady(true);
    } catch {
      setSessionReady(false);
      setErr("You are not logged in.");
    }
  }

  checkSession();
}, []);

const canCallApi = useMemo(() => sessionReady, [sessionReady]);

  async function savePaystubInfo() {
    if (!sessionReady) return;
  setErr("");
  setLoading(true);
  try {
        await apiFetch("/api/employee/profile", {
      method: "PATCH",
      body: JSON.stringify({
        addressLine1,
        addressLine2,
        city,
        state,
        zip,
        ssnLast4,
      }),
    });
  } catch (e: any) {
    setErr(e?.message || "Failed to save paystub info");
  } finally {
    setLoading(false);
  }
}

async function loadProfile() {
  if (!sessionReady) return;
  try {
    const profile = await apiFetch("/api/employee/profile", {
      method: "GET",
    });

    setAddressLine1(profile?.employee?.addressLine1 || "");
    setAddressLine2(profile?.employee?.addressLine2 || "");
    setCity(profile?.employee?.city || "");
    setState(profile?.employee?.state || "");
    setZip(profile?.employee?.zip || "");
    setSsnLast4(profile?.employee?.ssnLast4 || "");
  } catch (e: any) {
    console.error(e);
  }
}



function resetToLastPayrollWeek() {
  const range = getPreviousPayrollWeek();
  setFrom(range.from);
  setTo(range.to);
}
  
async function downloadPaystubPdf() {
  try {
    if (!from || !to) {
      setErr("Please select a pay period first.");
      return;
    }
    if (!sessionReady) {
      setErr("You are not logged in.");
      return;
    }
    const qs = new URLSearchParams({ from, to });
    const url = `${API}/api/employee/paystub/pdf?${qs.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      credentials: "include",    
});

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || "Failed to download paystub PDF");
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `paystub-${from}-${to}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(blobUrl);
  } catch (e: any) {
    console.error(e);
    setErr(e?.message || "Failed to download paystub PDF");
  }
}


   async function loadAll() {
        if (!sessionReady) return;
    setErr("");
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const te = await apiFetch(`/api/employee/time-entries?${qs.toString()}`, { method: "GET" });
      setEntries(te?.entries || []);

      const ps = await apiFetch(`/api/employee/pay-summary?${qs.toString()}`,{ method: "GET" });
      setSummary(ps || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
if (!sessionReady) return;
  loadAll();
  loadProfile();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionReady, from, to]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Employee — Time & Pay</h1>

      <div style={{ marginTop: 12, padding: 16, border: "1px solid #a5f3fc", borderRadius: 12, background: "#ecfeff" }}>
        <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>Paystubs from Excel payroll</h2>
        <p style={{ margin: "0 0 12px", color: "#475569" }}>Choose a week, month, or custom range, then download or email your paystubs.</p>
        <Link href="/employee/paystubs" style={{ display: "inline-block", padding: "10px 16px", borderRadius: 10, background: "#0891b2", color: "white", fontWeight: 700, textDecoration: "none" }}>
          Generate Paystub
        </Link>
      </div>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <button
  type="button"
  onClick={resetToLastPayrollWeek}
  style={{
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #2563eb",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontWeight: 700,
  }}
>
  Last Payroll Week
</button>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>From</div>
            <input value={from} onChange={(e) => setFrom(e.target.value)} type="date" style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }} />
          </div>
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>To</div>
            <input value={to} onChange={(e) => setTo(e.target.value)} type="date" style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }} />
          </div>

          <button
            disabled={!canCallApi || loading}
            onClick={loadAll}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#fff" }}
          >
            Load
          </button>
          <button
  type="button"
  disabled={!canCallApi || loading}
  onClick={downloadPaystubPdf}
  style={{
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
  }}
>
  Download Paystub PDF
</button>
        </div>

        {err ? <div style={{ marginTop: 10, color: "#b00020", fontSize: 13 }}>{err}</div> : null}
      </div>

      {/* Summary */}
      <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Pay Summary (Approved entries)</h2>
        {summary ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ fontWeight: 700 }}>{summary.employee.legalName}{summary.employee.preferredName ? ` (${summary.employee.preferredName})` : ""}</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>{summary.employee.email}</div>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                Hourly rate: <b>{fmtCents(summary.employee.hourlyRateCents)}</b>
              </div>
            </div>

            <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 10 }}>
              <div style={{ fontSize: 13 }}>Payable hours: <b>{summary.totals.totalHours}</b></div>
            <div style={{ marginTop: 10, fontWeight: 600 }}>Hours Breakdown</div>

<div style={{ fontSize: 13 }}>
  Regular Hours: <b>{((summary.totals.regularMinutes || 0) / 60).toFixed(2)}</b>
</div>

<div style={{ fontSize: 13 }}>
  OT Hours: <b>{((summary.totals.overtimeMinutes || 0) / 60).toFixed(2)}</b>
</div>

<div style={{ fontSize: 13 }}>
  Doubletime Hours: <b>{((summary.totals.doubleMinutes || 0) / 60).toFixed(2)}</b>
</div>


<div style={{ marginTop: 10, fontWeight: 600 }}>Pay Breakdown</div>

<div style={{ fontSize: 13 }}>
  Regular Pay: <b>{fmtCents(summary.totals.regularPayCents || 0)}</b>
</div>

<div style={{ fontSize: 13 }}>
  OT Pay: <b>{fmtCents(summary.totals.overtimePayCents || 0)}</b>
</div>

<div style={{ fontSize: 13 }}>
  Doubletime Pay: <b>{fmtCents(summary.totals.doublePayCents || 0)}</b>
</div>
	    <div style={{ marginTop: 6, fontSize: 13 }}>
  	    Gross pay: <b>{fmtCents(summary.totals.grossPayCents)}</b>
	    </div>

{typeof summary.totals.adjustmentsCents === "number" ? (
  <div style={{ fontSize: 13 }}>
    Adjustments: <b>{fmtCents(summary.totals.adjustmentsCents)}</b>
  </div>
) : null}

{typeof summary.totals.netPayCents === "number" ? (
  <div style={{ marginTop: 6, fontSize: 14 }}>
    Amount to be paid: <b>{fmtCents(summary.totals.netPayCents)}</b>
  </div>
) : (
  <div style={{ marginTop: 6, fontSize: 14 }}>
    Amount to be paid: <b>{fmtCents(summary.totals.grossPayCents)}</b>
  </div>
)}
{summary?.adjustments?.length ? (
  <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
    <div style={{ fontWeight: 700, marginBottom: 6 }}>Adjustments</div>
    <ul style={{ margin: 0, paddingLeft: 18 }}>
      {summary.adjustments.map((a: any) => (
        <li key={a.id}>
        {String(a.createdAt).slice(0,10)} — {fmtCents(a.amountCents)} {a.reason ? `(${a.reason})` : ""}
	</li>
      ))}
    </ul>
  </div>
) : null}
		</div>
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>No summary loaded yet.</div>
        )}
      </div>

{/* Paystub Info */}
<div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
  <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Paystub Info</h2>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
    <div style={{ minWidth: 320 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Address Line 1</div>
      <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>

    <div style={{ minWidth: 320 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Address Line 2</div>
      <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>

    <div style={{ minWidth: 200 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>City</div>
      <input value={city} onChange={(e) => setCity(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>

    <div style={{ minWidth: 120 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>State</div>
      <input value={state} onChange={(e) => setState(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>

    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Zip</div>
      <input value={zip} onChange={(e) => setZip(e.target.value)} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>

    <div style={{ minWidth: 140 }}>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>SSN (Last 4)</div>
      <input value={ssnLast4} onChange={(e) => setSsnLast4(e.target.value)} maxLength={4} style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }} />
    </div>
  </div>

  <div style={{ marginTop: 10 }}>
    <button
      disabled={!canCallApi || loading}
      onClick={savePaystubInfo}
      style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
    >
      Save Paystub Info
    </button>
  </div>
</div>


      {/* Entries */}
      <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 0 }}>Approved Time Entries</h2>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
                <th style={{ padding: 8 }}>Date</th>
                <th style={{ padding: 8 }}>Shift</th>
                <th style={{ padding: 8 }}>Payable Hours</th>
		<th style={{ padding: 8 }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const breakMin = typeof e.computedBreakMinutes === "number" ? e.computedBreakMinutes : (e.breakMinutes ?? 0);
                const payable = Math.max(0, (e.minutesWorked ?? 0) - breakMin);

                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                    <td style={{ padding: 8, whiteSpace: "nowrap" }}>{String(e.workDate).slice(0, 10)}</td>
                    <td style={{ padding: 8 }}>{e.shiftType}</td>
                    <td style={{ padding: 8 }}>{(payable / 60).toFixed(2)}</td>
	            <td style={{ padding: 8, minWidth: 240 }}>{e.notes || ""}</td>
                  </tr>
                );
              })}

              {entries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, opacity: 0.7 }}>
                    No approved entries found in this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        Displayed hours are payable hours for approved payroll.
	</div>
      </div>

    </div>
  );
}
