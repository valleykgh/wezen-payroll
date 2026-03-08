"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";

type PayrollRunRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: "DRAFT" | "FINALIZED" | "VOIDED";
  notes?: string | null;
  finalizedAt?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    email: string;
    role: string;
  } | null;
  employeeCount: number;
  grossPayCents: number;
  adjustmentsCents: number;
  loanDeductionCents: number;
  netPayCents: number;
};

type PayrollRunsResp = {
  payrollRuns: PayrollRunRow[];
};

function dollars(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dateOnly(v?: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(baseISO?: string) {
  const d = baseISO ? new Date(`${baseISO}T00:00:00`) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(baseISO?: string) {
  return addDaysISO(startOfWeekISO(baseISO), 6);
}
function statusStyle(status: PayrollRunRow["status"]): React.CSSProperties {
  if (status === "FINALIZED") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
      fontSize: 12,
      fontWeight: 700,
    };
  }

  if (status === "VOIDED") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
      fontSize: 12,
      fontWeight: 700,
    };
  }

  return {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 700,
  };
}

export default function AdminPayrollRunsPage() {
  const [items, setItems] = useState<PayrollRunRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [preset, setPreset] = useState("");
 
  function applyPreset(value: string) {
  setPreset(value);

  if (value === "THIS_WEEK") {
    setFrom(startOfWeekISO());
    setTo(endOfWeekISO());
    return;
  }

  if (value === "LAST_WEEK") {
    const thisWeekStart = startOfWeekISO();
    const lastWeekStart = addDaysISO(thisWeekStart, -7);
    setFrom(lastWeekStart);
    setTo(addDaysISO(lastWeekStart, 6));
    return;
  }

  if (value === "LAST_2_WEEKS") {
    const thisWeekStart = startOfWeekISO();
    const start = addDaysISO(thisWeekStart, -14);
    const end = addDaysISO(thisWeekStart, -1);
    setFrom(start);
    setTo(end);
    return;
  }

  if (value === "LAST_7_DAYS") {
    setFrom(addDaysISO(todayISO(), -6));
    setTo(todayISO());
    return;
  }
}

   async function load() {
    setLoading(true);
    setErr("");

    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);

      const data = await apiFetch<PayrollRunsResp>(
        `/api/admin/payroll-runs${qs.toString() ? `?${qs.toString()}` : ""}`
      );

      setItems(data.payrollRuns || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load payroll runs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, r) => {
        acc.employeeCount += Number(r.employeeCount || 0);
        acc.grossPayCents += Number(r.grossPayCents || 0);
        acc.adjustmentsCents += Number(r.adjustmentsCents || 0);
        acc.loanDeductionCents += Number(r.loanDeductionCents || 0);
        acc.netPayCents += Number(r.netPayCents || 0);
        return acc;
      },
      {
        employeeCount: 0,
        grossPayCents: 0,
        adjustmentsCents: 0,
        loanDeductionCents: 0,
        netPayCents: 0,
      }
    );
  }, [items]);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Payroll Runs</h1>
          <div style={{ color: "#666", marginTop: 4 }}>
            Finalized payroll snapshots and totals
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Status</div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="">ALL</option>
            <option value="DRAFT">DRAFT</option>
            <option value="FINALIZED">FINALIZED</option>
            <option value="VOIDED">VOIDED</option>
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>From</div>
          <input
            type="date"
            value={from}
            onChange={(e) => { setPreset(""); setFrom(e.target.value)}}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>To</div>
          <input
            type="date"
            value={to}
            onChange={(e) => { setPreset(""); setTo(e.target.value)}}
            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>
        
        <div>
  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Preset</div>
  <select
    value={preset}
    onChange={(e) => applyPreset(e.target.value)}
    style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
  >
    <option value="">Custom</option>
    <option value="THIS_WEEK">This Week</option>
    <option value="LAST_WEEK">Last Week</option>
    <option value="LAST_2_WEEKS">Last 2 Weeks</option>
    <option value="LAST_7_DAYS">Last 7 Days</option>
  </select>
</div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            height: 40,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Loading..." : "Load"}
        </button>
      </div>

      {err ? <div style={{ marginTop: 12, color: "#b00020" }}>{err}</div> : null}

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          background: "#fafafa",
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          fontSize: 13,
        }}
      >
        <div>
          Runs: <b>{items.length}</b>
        </div>
        <div>
          Employee rows: <b>{totals.employeeCount}</b>
        </div>
        <div>
          Gross: <b>{dollars(totals.grossPayCents)}</b>
        </div>
        <div>
          Adjustments: <b>{dollars(totals.adjustmentsCents)}</b>
        </div>
        <div>
          Loans: <b>{dollars(totals.loanDeductionCents)}</b>
        </div>
        <div>
          Net: <b>{dollars(totals.netPayCents)}</b>
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}>Pay Period</th>
              <th style={th}>Status</th>
              <th style={th}>Employees</th>
              <th style={th}>Gross</th>
              <th style={th}>Adjustments</th>
              <th style={th}>Loans</th>
              <th style={th}>Net</th>
              <th style={th}>Finalized</th>
              <th style={th}>Created By</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  {dateOnly(r.periodStart)} → {dateOnly(r.periodEnd)}
                </td>
                <td style={td}>
                  <span style={statusStyle(r.status)}>{r.status}</span>
                </td>
                <td style={td}>{r.employeeCount}</td>
                <td style={td}>{dollars(r.grossPayCents)}</td>
                <td style={td}>{dollars(r.adjustmentsCents)}</td>
                <td style={td}>{dollars(r.loanDeductionCents)}</td>
                <td style={td}>
                  <b>{dollars(r.netPayCents)}</b>
                </td>
                <td style={td}>{r.finalizedAt ? dateOnly(r.finalizedAt) : "-"}</td>
                <td style={td}>{r.createdBy?.email || "-"}</td>
                <td style={td}>
                  <Link
                    href={`/admin/payroll-runs/${r.id}`}
                    style={{
                      display: "inline-block",
                      padding: "8px 10px",
                      border: "1px solid #ccc",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "#111",
                      background: "#fff",
                    }}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td style={td} colSpan={10}>
                  {loading ? "Loading..." : "No payroll runs found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 13,
  verticalAlign: "top",
};
