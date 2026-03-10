"use client";

import React, { useEffect, useMemo, useState } from "react";

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
    totalMinutes: number;       // sum minutesWorked (worked)
    totalBreakMinutes: number;  // sum breaks
    payableMinutes: number;     // worked - breaks
    totalHours: number;         // payableHours decimal (2 dp)
    grossPayCents: number;
    adjustmentsCents?: number;
    loanDeductionCents?: number;
    netPayCents?: number;
  };
    adjustments?: Array<{
    amountCents: number;
    reason?: string | null;
  }>;
  loanDeductions?: Array<{
    amountCents: number;
  }>;
};

async function apiFetch(path: string, token: string, init?: RequestInit) {
  const safeToken = cleanJwt(token);
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
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
  const [tokenInput, setTokenInput] = useState("");

  const [from, setFrom] = useState<string>(() => toISODate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState<string>(() => toISODate(new Date()));

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
    const saved = localStorage.getItem("emp_token") || "";
    if (saved) {
      setEmpToken(saved);
      setTokenInput(saved);
    }
  }, []);

  const canCallApi = useMemo(() => empToken.trim().length > 0, [empToken]);
function cleanJwt(raw: string) {
  return String(raw || "")
    .replace(/^Bearer\s+/i, "")
    .replace(/[^\w.\-]/g, "")
    .trim();
}

  async function onSaveToken() {
    const t = cleanJwt(tokenInput)
    setEmpToken(t);
    localStorage.setItem("emp_token", t);
    setErr("");
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empToken]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Employee — Time & Pay</h1>

      <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 420px" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Employee JWT (paste once)</div>
            <input
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Bearer token (JWT)"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>
          <button
            onClick={onSaveToken}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
          >
            Save Token
          </button>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div>
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
          {String(a.workDate).slice(0,10)} — {fmtCents(a.amountCents)} {a.reason ? `(${a.reason})` : ""}
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

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        API base: <code>{API}</code>
      </div>
    </div>
  );
}
