"use client";

import React, { useEffect, useMemo, useState } from "react";
import { getToken } from "../lib/auth";

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

async function apiFetch(path: string, token: string, init?: RequestInit) {
    
  const safeToken = cleanJwt(token);
const res = await fetch(`${API}${path}`, {
  ...init,
  headers: {
    ...(init?.headers || {}),
    Authorization: `Bearer ${safeToken}`,
    "Content-Type": "application/json",
  },

  cache: "no-store",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.error || text || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
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
  const [empToken, setEmpToken] = useState("");

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
  const saved = getToken() || "";
  if (saved) {
    setEmpToken(saved);
  }
}, []);

  const canCallApi = useMemo(() => empToken.trim().length > 0, [empToken]);


  async function savePaystubInfo() {
  if (!empToken) return;
  setErr("");
  setLoading(true);
  try {
    await apiFetch(
      "/api/employee/profile",
      empToken,
      {
        method: "PATCH",
        body: JSON.stringify({
          addressLine1,
          addressLine2,
          city,
          state,
          zip,
          ssnLast4,
        }),
      }
    );
  } catch (e: any) {
    setErr(e?.message || "Failed to save paystub info");
  } finally {
    setLoading(false);
  }
}

async function loadProfile() {
  if (!empToken) return;

  try {
    const profile = await apiFetch("/api/employee/profile", empToken, {
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

async function viewPaystub() {
  if (!empToken || !from || !to) return;

  try {
    setErr("");

    const qs = new URLSearchParams({ from, to });
    const data = await apiFetch(`/api/employee/paystub?${qs.toString()}`, empToken);

    const paystub = data as PaystubData;

    const employeeAddress = [
      paystub.employee.addressLine1,
      paystub.employee.addressLine2,
      [paystub.employee.city, paystub.employee.state, paystub.employee.zip].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("<br/>");

    const companyAddress = [
      paystub.company.addressLine1,
      paystub.company.addressLine2,
      [paystub.company.city, paystub.company.state, paystub.company.zip].filter(Boolean).join(", "),
    ]
      .filter(Boolean)
      .join("<br/>");

    const adjustmentsHtml = paystub.adjustments.length
      ? `<ul>${paystub.adjustments
          .map(
            (a) =>
              `<li>${new Date(a.createdAt).toLocaleDateString()} — ${fmtCents(a.amountCents)}${a.reason ? ` (${a.reason})` : ""}</li>`
          )
          .join("")}</ul>`
      : `<div>None</div>`;

    const deductionsHtml = paystub.loanDeductions.length
      ? `<ul>${paystub.loanDeductions
          .map(
            (d) =>
              `<li>${fmtCents(d.amountCents)}${d.note ? ` (${d.note})` : ""}</li>`
          )
          .join("")}</ul>`
      : `<div>None</div>`;

    const html = `
      <html>
        <head>
          <title>Paystub</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
            .row { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
            .box { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 16px; }
            h1, h2, h3 { margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; }
            th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .right { text-align: right; }
          </style>
        </head>
        <body>
          <h1>${paystub.company.legalName}</h1>

          <div class="row">
            <div class="box">
              <h3>Company</h3>
              <div>${companyAddress}</div>
              ${paystub.company.phone ? `<div style="margin-top:8px;">${paystub.company.phone}</div>` : ""}
            </div>

            <div class="box">
              <h3>Employee</h3>
              <div><b>${paystub.employee.legalName}</b></div>
              <div>${employeeAddress || "Address not provided"}</div>
              <div style="margin-top:8px;">SSN Last 4: ${paystub.employee.ssnLast4 || "—"}</div>
            </div>
          </div>

          <div class="row">
            <div class="box">
              <h3>Pay Period</h3>
              <div>From: ${paystub.payPeriod.from}</div>
              <div>To: ${paystub.payPeriod.to}</div>
              <div>Pay Date: ${paystub.payPeriod.payDate}</div>
            </div>

            <div class="box">
              <h3>Summary</h3>
              <div>Worked Minutes: ${paystub.totals.totalWorkedMinutes}</div>
              <div>Break Minutes: ${paystub.totals.totalBreakMinutes}</div>
              <div>Payable Minutes: ${paystub.totals.totalPayableMinutes}</div>
              <div>Payable Hours: ${paystub.totals.payableHours}</div>
            </div>
          </div>

          <table>
            <tr>
              <th>Description</th>
              <th class="right">Amount</th>
            </tr>
            <tr>
              <td>Gross Pay</td>
              <td class="right">${fmtCents(paystub.totals.grossPayCents)}</td>
            </tr>
            <tr>
              <td>Adjustments</td>
              <td class="right">${fmtCents(paystub.totals.adjustmentsCents)}</td>
            </tr>
            <tr>
              <td>Loan Deductions</td>
              <td class="right">-${fmtCents(paystub.totals.loanDeductionCents)}</td>
            </tr>
            <tr>
              <td><b>Net Pay</b></td>
              <td class="right"><b>${fmtCents(paystub.totals.netPayCents)}</b></td>
            </tr>
          </table>

          <div class="row" style="margin-top: 24px;">
            <div class="box">
              <h3>Adjustments</h3>
              ${adjustmentsHtml}
            </div>
            <div class="box">
              <h3>Deductions</h3>
              ${deductionsHtml}
            </div>
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      throw new Error("Popup blocked. Please allow popups to view paystub.");
    }

    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
  } catch (e: any) {
    console.error(e);
    setErr(e?.message || "Failed to load paystub");
  }
}

  async function loadAll() {
    if (!empToken) return;
    setErr("");
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const te = await apiFetch(`/api/employee/time-entries?${qs.toString()}`, empToken);
      setEntries(te?.entries || []);

      const ps = await apiFetch(`/api/employee/pay-summary?${qs.toString()}`, empToken);
      setSummary(ps || null);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
  if (!empToken) return;

  loadAll();
  loadProfile();

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [empToken]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Employee — Time & Pay</h1>

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
  disabled={!canCallApi || loading}
  onClick={viewPaystub}
  style={{
    padding: "10px 14px",
    borderRadius: 10,
    border: "1px solid #111",
    background: "#111",
    color: "#fff",
    fontWeight: 700,
  }}
>
  View Paystub
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
              <div style={{ fontSize: 13 }}>Worked minutes: <b>{summary.totals.totalMinutes}</b></div>
              <div style={{ fontSize: 13 }}>Break minutes: <b>{summary.totals.totalBreakMinutes}</b></div>
              <div style={{ fontSize: 13 }}>Payable minutes: <b>{summary.totals.payableMinutes}</b></div>
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
                <th style={{ padding: 8 }}>Worked (min)</th>
                <th style={{ padding: 8 }}>Break (min)</th>
                <th style={{ padding: 8 }}>Payable (min)</th>
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
                    <td style={{ padding: 8 }}>{e.minutesWorked}</td>
                    <td style={{ padding: 8 }}>{breakMin}</td>
                    <td style={{ padding: 8 }}>{payable}</td>
                    <td style={{ padding: 8, minWidth: 240 }}>{e.notes || ""}</td>
                  </tr>
                );
              })}

              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 12, opacity: 0.7 }}>
                    No approved entries found in this date range.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
          Payable minutes = worked minutes − stored breaks (preferred) (fallback: entry.breakMinutes).
        </div>
      </div>

    </div>
  );
}
