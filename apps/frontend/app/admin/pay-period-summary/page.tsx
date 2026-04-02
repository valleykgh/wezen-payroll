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
function dateOnlyUTC(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

function isHolidayEntry(e: any) {
  return !!(e?.holidayRule?.isHoliday || e?.isHoliday || e?.holidayName);
}

function getHourBreakdown(e: any) {
  const reg = safeNum(e?.buckets?.regular_decimal);
  const ot = safeNum(e?.buckets?.overtime_decimal);
  const dt = safeNum(e?.buckets?.double_decimal);

  const holiday = isHolidayEntry(e) ? reg : 0;
  const regular = isHolidayEntry(e) ? 0 : reg;

  return {
    regular,
    holiday,
    ot,
    dt,
    total: regular + holiday + ot + dt,
  };
}

function getHolidayPremiumPayDollarsForEntry(e: any) {
  const hrs = getHourBreakdown(e);
  if (hrs.holiday <= 0) return 0;

  const hourly = safeNum(e?.employee?.hourlyRateCents) / 100;
  const multiplier = safeNum(e?.holidayRule?.payMultiplier) || 1.5;

  return hrs.holiday * hourly * Math.max(0, multiplier - 1);
}

function getRegularPayDollarsForEntry(e: any) {
  const hrs = getHourBreakdown(e);
  const hourly = safeNum(e?.employee?.hourlyRateCents) / 100;
  return hrs.regular * hourly;
}

function getHolidayForDate(
  workDate: string | Date,
  holidayMap: Record<
    string,
    {
      name: string;
      payMultiplier: number;
      billMultiplier: number;
      appliesToRegularOnly: boolean;
    }
  >
) {
  return holidayMap[dateOnlyUTC(workDate)] || null;
}
export default function PayPeriodSummaryPage() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [facilityId, setFacilityId] = useState<string>("ALL");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [entries, setEntries] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const loadSeqRef = useRef(0);
  const [showSupplementalModal, setShowSupplementalModal] = useState(false);
const [eligibleEmployees, setEligibleEmployees] = useState<any[]>([]);
const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
const [holidayMap, setHolidayMap] = useState<
  Record<
    string,
    {
      name: string;
      payMultiplier: number;
      billMultiplier: number;
      appliesToRegularOnly: boolean;
    }
  >
>({});
const [regularBillingStatus, setRegularBillingStatus] = useState<{
  status: string;
  invoiceNumber?: string | null;
  lockedAt?: string | null;
} | null>(null);

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:4000";
  async function loadFacilities() {
    const resp = await apiFetch<{ facilities: any[] }>("/api/admin/facilities");
    setFacilities(resp.facilities || []);
  }

async function loadBillingStatus() {
  if (!from || !to || !facilityId || facilityId === "ALL") {
    setRegularBillingStatus(null);
    return;
  }

  const resp = await apiFetch<{ regular: any }>(
    `/api/admin/billing-export/status?facilityId=${encodeURIComponent(facilityId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );

  setRegularBillingStatus(resp.regular || null);
}

async function loadHolidays() {
  const resp = await apiFetch<{
    holidays: Array<{
      id: string;
      date: string;
      name: string;
      payMultiplier: number;
      billMultiplier: number;
      appliesToRegularOnly: boolean;
    }>;
  }>("/api/admin/holidays/active");

  const next: Record<
    string,
    {
      name: string;
      payMultiplier: number;
      billMultiplier: number;
      appliesToRegularOnly: boolean;
    }
  > = {};

  for (const h of resp.holidays || []) {
    next[String(h.date).slice(0, 10)] = {
      name: h.name,
      payMultiplier: Number(h.payMultiplier || 1.5),
      billMultiplier: Number(h.billMultiplier || 1.5),
      appliesToRegularOnly: !!h.appliesToRegularOnly,
    };
  }

  setHolidayMap(next);
}

  // Base pay calc from buckets for ONE entry (or pass an array)

function computePayDollarsForEmployee(emp: any, list: any[]) {
  const hourly = safeNum(emp?.hourlyRateCents) / 100;
  let total = 0;

  for (const e of list) {
    const hrs = getHourBreakdown(e);
    const holidayMultiplier = hrs.holiday > 0 ? 1.5 : 1;

    total +=
      hrs.regular * hourly +
      hrs.holiday * hourly * holidayMultiplier +
      hrs.ot * hourly * 1.5 +
      hrs.dt * hourly * 2.0;
  }

  return total;
}
  // For now bill mirrors pay (same as your time-entry page)

function computeBillDollarsForEmployee(emp: any, list: any[]) {
  let total = 0;

  for (const e of list) {
    if (e.isMissedAdjustment || e.sourceType === "PAYROLL_ADJUSTMENT") {
      total += safeNum(e.billAmountCents) / 100;
      continue;
    }

    const hrs = getHourBreakdown(e);

    const regRate = safeNum(e.facilityRate?.regRateCents) / 100;
    const otRate = safeNum(e.facilityRate?.otRateCents) / 100;
    const dtRate = safeNum(e.facilityRate?.dtRateCents) / 100;
    const holidayMultiplier =
      safeNum(e?.holidayRule?.billMultiplier) || (hrs.holiday > 0 ? 1.5 : 1);

    total +=
      hrs.regular * regRate +
      hrs.holiday * regRate * holidayMultiplier +
      hrs.ot * otRate +
      hrs.dt * dtRate;
  }

  return total;
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

if (facilityId !== "ALL") {
  qs.set("facilityId", facilityId);
}

const resp = await apiFetch<{ entries: any[] }>(
  `/api/admin/time-entries?${qs.toString()}`
);

      if (seq !== loadSeqRef.current) return;

      const all = resp.entries || [];

      // Apply facility filter client-side
      const filtered =
        facilityId === "ALL"
          ? all
          : all.filter((e: any) => String(e.facilityId || "") === String(facilityId));

      setEntries(filtered);

      // Load pay summaries for ONLY employees in the filtered set
    } catch (e: any) {
      if (seq !== loadSeqRef.current) return;
      setErr(e?.message || "Failed to load pay period entries");
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  async function downloadBillingExport(mode: "regular" | "supplemental") {
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
    const token = getToken();

    if (!token) {
      setErr("Missing token. Please log in again.");
      return;
    }

    const apiBase =
      process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:4000";

    const invoiceNumber = window.prompt(
      mode === "supplemental"
        ? "Enter supplemental invoice number (example: 2001-A)"
        : "Enter invoice number (example: 2001)",
      mode === "supplemental" ? "2001-A" : "2001"
    );

    if (!invoiceNumber) return;

    const qs = new URLSearchParams({
      facilityId,
      from,
      to,
      mode,
      invoiceNumber,
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
    a.download = `${mode === "supplemental" ? "supplemental" : "regular"}-billing-${facilityId}-${from}-to-${to}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (e: any) {
    setErr(e?.message || "Failed to export billing file");
  }
}  

async function openSupplementalModal() {
  const token = getToken();
  if (!token) {
    setErr("Missing token. Please log in again.");
    return;
  }

  const qs = new URLSearchParams({
    facilityId,
    from,
    to,
  });

  const resp = await fetch(
    `${apiBase}/api/admin/billing-export/eligible-employees?${qs.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!resp.ok) {
    setErr("Failed to load eligible employees");
    return;
  }

  const data = await resp.json();

  setEligibleEmployees(data.employees || []);
  setSelectedEmployeeIds((data.employees || []).map((e: any) => e.id));
  setShowSupplementalModal(true);
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

      const hrs = getHourBreakdown(e);
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
  holiday: 0,
  ot: 0,
  dt: 0,
  total: 0,
  regularPay: 0,
  holidayPay: 0,
  payBase: 0,
  bill: 0,
});
}

const r = g.rowsByEmp.get(empId);
r.reg += hrs.regular;
r.holiday += hrs.holiday;
r.ot += hrs.ot;
r.dt += hrs.dt;
r.total += hrs.total;
r.regularPay += getRegularPayDollarsForEntry(e);
r.holidayPay += getHolidayPremiumPayDollarsForEntry(e);
r.payBase += basePay;
r.bill += baseBill;    
}

        const groups = Array.from(byFac.values()).map((g: any) => {
  const rows = Array.from(g.rowsByEmp.values() as Iterable<any>).map((r: any) => {
      return {
  ...r,
  pay: r.payBase
};
      });

      const reg = rows.reduce((s, x) => s + safeNum(x.reg), 0);
      const holiday = rows.reduce((s, x) => s + safeNum(x.holiday), 0);
      const ot = rows.reduce((s, x) => s + safeNum(x.ot), 0);
      const dt = rows.reduce((s, x) => s + safeNum(x.dt), 0);
      const total = rows.reduce((s, x) => s + safeNum(x.total), 0);
      const regularPay = rows.reduce((s, x) => s + safeNum(x.regularPay), 0);
      const holidayPay = rows.reduce((s, x) => s + safeNum(x.holidayPay), 0);
      const pay = rows.reduce((s, x) => s + safeNum(x.pay), 0);
      const bill = rows.reduce((s, x) => s + safeNum(x.bill), 0);

      return {
        facilityId: g.facilityId,
        facilityName: g.facilityName,
        rows,
        reg,
	holiday,
        ot,
        dt,
        total,
  	regularPay,
        holidayPay,
        pay,
        bill,
      };
    });

    groups.sort((a, b) => String(a.facilityName).localeCompare(String(b.facilityName)));
    for (const g of groups) {
      g.rows.sort((a: any, b: any) => String(a.employeeName).localeCompare(String(b.employeeName)));
    }

    return groups;
  }, [entries]);

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

const controlStyle: React.CSSProperties = {
  height: 44,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 16,
  lineHeight: "44px",
  outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 14,
  fontWeight: 600,
  color: "#4b5563",
};

useEffect(() => {
  loadFacilities().catch((e: any) => setErr(e?.message || "Failed to load facilities"));
  loadHolidays().catch((e: any) => setErr(e?.message || "Failed to load holidays"));
}, []);

  return (
    <div style={{ padding: 16, maxWidth: 1300, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Pay Period Summary (by Facility)</h1>

<div
  style={{
    marginTop: 16,
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    alignItems: "flex-end",
  }}
>  

<div>
    <div style={labelStyle}>From</div>
    <input
      type="date"
      value={from}
      onChange={(e) => setFrom(e.target.value)}
      style={{ ...controlStyle, width: 200 }}
    />
  </div>

  <div>
    <div style={labelStyle}>To</div>
    <input
      type="date"
      value={to}
      onChange={(e) => setTo(e.target.value)}
      style={{ ...controlStyle, width: 200 }}
    />
  </div>

  <div>
    <div style={labelStyle}>Facility</div>
    <select
      value={facilityId}
      onChange={(e) => setFacilityId(e.target.value)}
      style={{ ...controlStyle, width: 260, lineHeight: "normal" }}
    >
      <option value="ALL">All Facilities</option>
      {facilities.map((f) => (
        <option key={f.id} value={f.id}>
          {f.name}
        </option>
      ))}
    </select>
  </div>

  <div>
    <div style={labelStyle}>Invoice #</div>
    <input
      value={invoiceNumber}
      onChange={(e) => setInvoiceNumber(e.target.value)}
      placeholder="e.g. 2001 or 2001-A"
      style={{ ...controlStyle, width: 220 }}
    />
  </div>


</div>
  <div
    style={{
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    }}
  >
    <button
      type="button"
      disabled={loading}
      onClick={loadEntries}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #111",
        background: "#111",
        color: "#fff",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 44,
      }}
    >
      {loading ? "Loading..." : "Load Pay Period Summary"}
    </button>

    <button
      onClick={() => downloadBillingExport("regular")}
      disabled={regularBillingStatus?.status === "LOCKED"}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #1d4ed8",
        background: "#eff6ff",
        color: "#1d4ed8",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 44,
        cursor: regularBillingStatus?.status === "LOCKED" ? "not-allowed" : "pointer",
        opacity: regularBillingStatus?.status === "LOCKED" ? 0.5 : 1,
      }}
    >
      Export Regular Invoice
    </button>

    <button
      type="button"
      onClick={openSupplementalModal}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #1d4ed8",
        background: "#eff6ff",
        color: "#1d4ed8",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 44,
      }}
    >
      Export Supplemental Invoice
    </button>

    <button
      type="button"
      disabled={
        !facilityId ||
        facilityId === "ALL" ||
        !from ||
        !to ||
        loading ||
        regularBillingStatus?.status === "LOCKED"
      }
      onClick={async () => {
        try {
          setErr("");
          const invoiceNo = window.prompt(
            "Enter the regular invoice number to lock",
            invoiceNumber || regularBillingStatus?.invoiceNumber || ""
          );
          if (!invoiceNo) return;

          await apiFetch("/api/admin/billing-export/lock", {
            method: "POST",
            body: JSON.stringify({
              facilityId,
              from,
              to,
              invoiceNumber: invoiceNo,
            }),
          });

          setInvoiceNumber(invoiceNo);
          await loadBillingStatus();
        } catch (e: any) {
          setErr(e?.message || "Failed to lock regular invoice");
        }
      }}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #b45309",
        background: regularBillingStatus?.status === "LOCKED" ? "#fff7ed" : "#ffffff",
        color: "#92400e",
        fontWeight: 700,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 44,
        cursor: regularBillingStatus?.status === "LOCKED" ? "not-allowed" : "pointer",
        opacity: regularBillingStatus?.status === "LOCKED" ? 0.7 : 1,
      }}
    >
      {regularBillingStatus?.status === "LOCKED"
        ? "Regular Invoice Locked"
        : "Lock Regular Invoice"}
    </button>
  </div>
{regularBillingStatus ? (
    <div
  style={{
    marginTop: 12,
    fontSize: 13,
    color: regularBillingStatus.status === "LOCKED" ? "#92400e" : "#065f46",
    background: regularBillingStatus.status === "LOCKED" ? "#fff7ed" : "#ecfdf5",
    border:
      regularBillingStatus.status === "LOCKED"
        ? "1px solid #fcd34d"
        : "1px solid #86efac",
    borderRadius: 8,
    padding: "8px 10px",
    display: "inline-block",
  }}
>
    {regularBillingStatus.status === "LOCKED" ? "🔒" : "🟢"}{" "}
    Regular invoice status: <b>{regularBillingStatus.status}</b>
    {regularBillingStatus.invoiceNumber ? (
      <> · Invoice #: <b>{regularBillingStatus.invoiceNumber}</b></>
    ) : null}
    {regularBillingStatus.lockedAt ? (
      <> · Locked at: <b>{new Date(regularBillingStatus.lockedAt).toLocaleString()}</b></>
    ) : null}
  </div>
) : null}

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
              <th style={{ padding: 8 }}>Holiday</th>
	      <th style={{ padding: 8 }}>OT</th>
              <th style={{ padding: 8 }}>DT</th>
              <th style={{ padding: 8 }}>Total</th>
              <th style={{ padding: 8 }}>Regular Pay ($)</th>
              <th style={{ padding: 8 }}>Holiday Pay ($)</th>
	      <th style={{ padding: 8 }}>Pay ($)</th>
              <th style={{ padding: 8 }}>Bill ($)</th>
            </tr>
          </thead>

          <tbody>
            {payPeriodGrouped.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ padding: 12, opacity: 0.7 }}>
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
 		      <td style={{ padding: 8 }}>{decimalHoursFixed(r.holiday)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.ot)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.dt)}</td>
                      <td style={{ padding: 8 }}>{decimalHoursFixed(r.total)}</td>
                      <td style={{ padding: 8 }}>{money(r.regularPay)}</td>
		      <td style={{ padding: 8 }}>{money(r.holidayPay)}</td>
		      <td style={{ padding: 8 }}>{money(r.pay)}</td>
                      <td style={{ padding: 8 }}>{money(r.bill)}</td>
                    </tr>
                  ))}

                  {/* Facility subtotal */}
                  <tr style={{ background: "#f5f5f5", fontWeight: 800, borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}></td>
                    <td style={{ padding: 8 }}>Facility Total</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.reg)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.holiday)}</td>
		    <td style={{ padding: 8 }}>{decimalHoursFixed(g.ot)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.dt)}</td>
                    <td style={{ padding: 8 }}>{decimalHoursFixed(g.total)}</td>
		    <td style={{ padding: 8 }}>{money(g.regularPay)}</td>
		    <td style={{ padding: 8 }}>{money(g.holidayPay)}</td>
                    <td style={{ padding: 8 }}>{money(g.pay)}</td>
                    <td style={{ padding: 8 }}>{money(g.bill)}</td>
                  </tr>
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
       {showSupplementalModal && (
  <div style={{
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  }}>
    <div style={{ background: "#fff", padding: 20, borderRadius: 8, width: 400 }}>
      <h3>Select Employees for Supplemental Invoice</h3>
          <div style={{ marginBottom: 10 }}>
  <button
    type="button"
    onClick={() => setSelectedEmployeeIds(eligibleEmployees.map((e: any) => e.id))}
  >
    Select All
  </button>

  <button
    type="button"
    onClick={() => setSelectedEmployeeIds([])}
    style={{ marginLeft: 8 }}
  >
    Clear All
  </button>
</div>
      <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
        {eligibleEmployees.map((e: any) => (
          <label key={e.id} style={{ display: "block", marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={selectedEmployeeIds.includes(e.id)}
              onChange={(ev) => {
                if (ev.target.checked) {
                  setSelectedEmployeeIds((prev) => [...prev, e.id]);
                } else {
                  setSelectedEmployeeIds((prev) =>
                    prev.filter((id) => id !== e.id)
                  );
                }
              }}
            />
            {" "} {e.name}
          </label>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => {
            const qs = new URLSearchParams({
              facilityId,
              from,
              to,
              mode: "supplemental",
              invoiceNumber,
              employeeIds: selectedEmployeeIds.join(","),
            });

            (async () => {
  const token = getToken();
  if (!token) {
    setErr("Missing token. Please log in again.");
    return;
  }

  const resp = await fetch(
    `${apiBase}/api/admin/billing-export?${qs.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!resp.ok) {
    setErr("Export failed");
    return;
  }

  const blob = await resp.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `supplemental-${facilityId}-${from}-to-${to}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);

  setShowSupplementalModal(false);
})();
          }}
        >
          Export
        </button>

        <button onClick={() => setShowSupplementalModal(false)}>
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  );
}
