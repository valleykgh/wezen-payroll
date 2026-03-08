"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../../lib/api";
import { getToken } from "../../lib/auth";
function safeNum(x: any) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  return `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function decimalHoursFixed(n: number) {
  return safeNum(n).toFixed(2);
}

export default function PayPeriodSummaryPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState<string>("ALL");

  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [entries, setEntries] = useState<any[]>([]);
  const [paySummaries, setPaySummaries] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const loadSeqRef = useRef(0);

  async function loadFacilities() {
    const resp = await apiFetch<{ facilities: any[] }>("/api/admin/facilities");
    setFacilities(resp.facilities || []);
  }

  // Base pay calc from buckets for ONE entry (or pass an array)
  function computePayDollarsForEmployee(emp: any, list: any[]) {
    const hourly = safeNum(emp?.hourlyRateCents) / 100;
    let total = 0;

    for (const e of list) {
      const reg = safeNum(e.buckets?.regular_decimal);
      const ot = safeNum(e.buckets?.overtime_decimal);
      const dt = safeNum(e.buckets?.double_decimal);
      total += reg * hourly + ot * hourly * 1.5 + dt * hourly * 2.0;
    }
    return total;
  }

  // For now bill mirrors pay (same as your time-entry page)
  function computeBillDollarsForEmployee(emp: any, list: any[]) {
    return computePayDollarsForEmployee(emp, list);
  }

  async function loadPaySummariesForEmployeeIds(employeeIds: string[], qs: URLSearchParams, seq: number) {
    const uniqueIds = Array.from(new Set(employeeIds)).filter(Boolean);
    if (uniqueIds.length === 0) {
      setPaySummaries({});
      return;
    }

    const pairs = await Promise.all(
      uniqueIds.map(async (empId) => {
        const ps = await apiFetch<any>(
          `/api/admin/pay-summary?employeeId=${encodeURIComponent(empId)}&${qs.toString()}`
        );
        return [empId, ps] as const;
      })
    );

    if (seq !== loadSeqRef.current) return;

    const summaries: Record<string, any> = {};
    for (const [empId, ps] of pairs) summaries[empId] = ps;
    setPaySummaries(summaries);
  }

  async function loadEntries() {
    setErr("");
    if (!from || !to) {
      setErr("Select From and To dates first.");
      return;
    }

    setLoading(true);
    const seq = ++loadSeqRef.current;

    try {
      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);

      // Load entries for date range (all facilities)
      const resp = await apiFetch<{ entries: any[] }>(`/api/admin/time-entries?${qs.toString()}`);
      if (seq !== loadSeqRef.current) return;

      const all = resp.entries || [];

      // Apply facility filter client-side
      const filtered =
        facilityId === "ALL"
          ? all
          : all.filter((e: any) => String(e.facilityId || "") === String(facilityId));

      setEntries(filtered);

      // Load pay summaries for ONLY employees in the filtered set
      const employeeIds = filtered.map((e: any) => String(e.employeeId || ""));
      await loadPaySummariesForEmployeeIds(employeeIds, qs, seq);
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setErr(e?.message || "Failed to load pay period entries");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

    async function downloadBillingExport() {
  setErr("");

  if (!from || !to) {
    setErr("Select From/To first.");
    return;
  }

  if (!facilityId || facilityId === "ALL") {
    setErr("Select ONE facility to export billing file.");
    return;
  }

  try {
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token")
        : null;

    if (!token) {
      setErr("Missing token. Please log in again.");
      return;
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:4000";

    const qs = new URLSearchParams({
      facilityId,
      from,
      to,
    });

    const resp = await fetch(`${apiBase}/api/admin/billing-export?${qs.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!resp.ok) {
      let msg = `Export failed (${resp.status})`;
      try {
        const body = await resp.json();
        msg = body?.error || msg;
      } catch {}
      setErr(msg);
      return;
    }

    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `billing-${facilityId}-${from}-to-${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    setErr(e?.message || "Failed to export billing file");
  }
}

  // ---------- GROUPING LOGIC (your code, adapted) ----------
  const payPeriodGrouped = useMemo(() => {
    const byFac = new Map<string, any>();

    for (const e of entries) {
      const facId = String(e.facilityId || "");
      const facName = e.facility?.name || "Unknown Facility";

      const empId = String(e.employeeId || "");
      const emp = e.employee;

      if (!facId || !empId || !emp) continue;

      const reg = safeNum(e.buckets?.regular_decimal);
      const ot = safeNum(e.buckets?.overtime_decimal);
      const dt = safeNum(e.buckets?.double_decimal);
      const total = reg + ot + dt;

      const basePay = computePayDollarsForEmployee(emp, [e]);
      const baseBill = computeBillDollarsForEmployee(emp, [e]);

      if (!byFac.has(facId)) {
        byFac.set(facId, {
          facilityId: facId,
          facilityName: facName,
          rowsByEmp: new Map<string, any>(),
        });
      }

      const g = byFac.get(facId);
      if (!g.rowsByEmp.has(empId)) {
        g.rowsByEmp.set(empId, {
          facilityId: facId,
          employeeId: empId,
          employeeName: `${emp.legalName}${emp.preferredName ? ` (${emp.preferredName})` : ""}`,
          reg: 0,
          ot: 0,
          dt: 0,
          total: 0,
          payBase: 0,
          bill: 0,
        });
      }

      const r = g.rowsByEmp.get(empId);
      r.reg += reg;
      r.ot += ot;
      r.dt += dt;
      r.total += total;
      r.payBase += basePay;
      r.bill += baseBill;
    }

    const groups = Array.from(byFac.values()).map((g) => {
      const rows = Array.from(g.rowsByEmp.values()).map((r) => {
        const ps = paySummaries?.[r.employeeId];

        const grossCents = ps?.totals?.grossPayCents;
        const adjCents = ps?.totals?.adjustmentsCents;
        const netCents = ps?.totals?.netPayCents;

        const pay =
          typeof netCents === "number"
            ? netCents / 100
            : r.payBase;

        return {
          ...r,
          pay,
          grossPay: typeof grossCents === "number" ? grossCents / 100 : null,
          adjustments: typeof adjCents === "number" ? adjCents / 100 : null,
          netPay: typeof netCents === "number" ? netCents / 100 : null,
        };
      });

      const reg = rows.reduce((s, x) => s + safeNum(x.reg), 0);
      const ot = rows.reduce((s, x) => s + safeNum(x.ot), 0);
      const dt = rows.reduce((s, x) => s + safeNum(x.dt), 0);
      const total = rows.reduce((s, x) => s + safeNum(x.total), 0);
      const pay = rows.reduce((s, x) => s + safeNum(x.pay), 0);
      const bill = rows.reduce((s, x) => s + safeNum(x.bill), 0);

      return {
        facilityId: g.facilityId,
        facilityName: g.facilityName,
        rows,
        reg,
        ot,
        dt,
        total,
        pay,
        bill,
      };
    });

    groups.sort((a, b) => String(a.facilityName).localeCompare(String(b.facilityName)));
    for (const g of groups) {
      g.rows.sort((a: any, b: any) => String(a.employeeName).localeCompare(String(b.employeeName)));
    }

    return groups;
  }, [entries, paySummaries]);

  const payPeriodGrand = useMemo(() => {
    let reg = 0, ot = 0, dt = 0, total = 0, pay = 0, bill = 0;
    for (const g of payPeriodGrouped as any[]) {
      reg += safeNum(g.reg);
      ot += safeNum(g.ot);
      dt += safeNum(g.dt);
      total += safeNum(g.total);
      pay += safeNum(g.pay);
      bill += safeNum(g.bill);
    }
    return { reg, ot, dt, total, pay, bill };
  }, [payPeriodGrouped]);

  useEffect(() => {
    loadFacilities().catch(console.error);
  }, []);

  return (
    <div style={{ padding: 16, maxWidth: 1300, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Pay Period Summary (by Facility)</h1>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>From</div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>To</div>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>

        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Facility</div>
          <select value={facilityId} onChange={(e) => setFacilityId(e.target.value)} style={{ padding: 8 }}>
            <option value="ALL">All Facilities</option>
            {facilities.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          disabled={loading}
          onClick={loadEntries}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff" }}
        >
          {loading ? "Loading..." : "Load Pay Period Summary"}
        </button>

        <button
          type="button"
          onClick={downloadBillingExport}
          style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#fff", fontWeight: 700 }}
        >
          Export Billing (Excel)
        </button>
      </div>

      {err ? <div style={{ marginTop: 10, color: "#b00020", fontSize: 13 }}>{err}</div> : null}

      {/* Grand totals */}
      <div style={{ marginTop: 14, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Total Pay</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(payPeriodGrand.pay)}</div>
        </div>
        <div style={{ flex: "1 1 260px", border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Total Bill</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{money(payPeriodGrand.bill)}</div>
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #eee" }}>
              <th style={{ padding: 8 }}>Facility</th>
              <th style={{ padding: 8 }}>Employee</th>
              <th style={{ padding: 8 }}>Reg</th>
              <th style={{ padding: 8 }}>OT</th>
              <th style={{ padding: 8 }}>DT</th>
              <th style={{ padding: 8 }}>Total</th>
              <th style={{ padding: 8 }}>Pay ($)</th>
              <th style={{ padding: 8 }}>Bill ($)</th>
            </tr>
          </thead>

          <tbody>
            {payPeriodGrouped.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  No entries in this pay period (or not loaded yet).
                </td>
              </tr>
            ) : (
              payPeriodGrouped.map((g) => (
                <React.Fragment key={g.facilityId}>
                  <tr>
                    <td
                      colSpan={8}
                      style={{
                        padding: "10px 8px",
                        fontWeight: 900,
                        background: "#fafafa",
                        borderTop: "1px solid #eee",
                      }}
                    >
                      {g.facilityName}
                    </td>
                  </tr>

                  {g.rows.map((r: any) => (
                    <tr key={`${r.facilityId}-${r.employeeId}`} style={{ borderBottom: "1px solid #f2f2f2" }}>
                      <td style={{ padding: 8 }}></td>
                      <td style={{ padding: 8, whiteSpace: "nowrap" }}>{r.employeeName}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.reg)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.ot)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.dt)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.total)}</td>
                      <td style={{ padding: 8 }}>{money(r.pay)}</td>
                      <td style={{ padding: 8 }}>{money(r.bill)}</td>
                    </tr>
                  ))}

                  {/* Facility subtotal */}
                  <tr style={{ background: "#f5f5f5", fontWeight: 800, borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}></td>
                    <td style={{ padding: 8 }}>Facility Total</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.reg)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.ot)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.dt)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.total)}</td>
                    <td style={{ padding: 8 }}>{money(g.pay)}</td>
                    <td style={{ padding: 8 }}>{money(g.bill)}</td>
                  </tr>
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
