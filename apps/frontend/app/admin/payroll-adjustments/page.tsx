"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type Employee = {
  id: string;
  legalName: string;
  preferredName: string | null;
  email: string;
  hourlyRateCents: number;
  title?: string | null;
  active: boolean;
};

type AdjustmentRow = {
  id: string;
  employeeId: string;
  facilityId?: string | null;
  workDate?: string | null;
  shiftType?: string | null;
  punchesJson?: { clockIn: string; clockOut: string }[] | null;
  breaksJson?: { startTime: string; endTime: string }[] | null;
  payableMinutes?: number | null;
  regularMinutes?: number | null;
  overtimeMinutes?: number | null;
  doubleMinutes?: number | null;
  reason: string;
  amountCents: number;
  createdAt: string;
  paidImmediately?: boolean;
  paidAt?: string | null;
  paidNote?: string | null;
  paidAmountCents?: number | null;
  invoiceNumber?: string | null;
  invoiceType?: string | null;
  facility?: {
    id: string;
    name: string;
  } | null;
  employee?: {
    id: string;
    legalName: string;
    preferredName: string | null;
    email: string;
  } | null;
  payrollRun?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
  } | null;
};

type Facility = {
  id: string;
  name: string;
};

function money(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}
function punchText(punches?: { clockIn: string; clockOut: string }[] | null) {
  if (!Array.isArray(punches) || punches.length === 0) return "—";
  return punches.map((p) => `${p.clockIn} → ${p.clockOut}`).join(" | ");
}

function dateOnlyUTC(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function PayrollAdjustmentsPage({ editId }: { editId?: string }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facilityId, setFacilityId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState("");
  const [hours, setHours] = useState("");
  const [reasonNote, setReasonNote] = useState("");

  async function loadEmployees() {
    const resp = await apiFetch<{ employees: Employee[] }>("/api/admin/employees");
    setEmployees((resp.employees || []).filter((e) => e.active));
  }

  async function loadAdjustments() {
    const resp = await apiFetch<{ adjustments: AdjustmentRow[] }>("/api/admin/payroll-adjustments");
    setAdjustments(resp.adjustments || []);
  }
  
  async function loadFacilities() {
  const resp = await apiFetch<{ facilities: Facility[] }>("/api/admin/facilities");
  setFacilities(resp.facilities || []);
}

  useEffect(() => {
  setLoading(true);
  Promise.all([loadEmployees(), loadFacilities(), loadAdjustments()])
    .catch((e: any) => setErr(e?.message || "Failed to load payroll adjustments"))
    .finally(() => setLoading(false));
}, []);


  useEffect(() => {
  if (!editId) return;

  async function loadAdjustment() {
    try {
      const data = await apiFetch<{ adjustment: any }>(
        `/api/admin/payroll-adjustments/${editId}`
      );

      const a = data?.adjustment;
      if (!a) return;

      setEmployeeId(a.employeeId || "");
      setFacilityId(a.facilityId || "");
      setWorkDate(a.workDate ? new Date(a.workDate).toISOString().slice(0,10) : "");
      setHours(a.payableMinutes ? String(a.payableMinutes / 60) : "");
      setReasonNote(a.reason || "");

      setOk("Loaded adjustment for editing");
    } catch (err) {
      console.error("Failed to load adjustment", err);
    }
  }

  loadAdjustment();
}, [editId]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === employeeId) || null,
    [employees, employeeId]
  );

  const amountPreviewCents = useMemo(() => {
    const hrs = Number(hours || 0);
    if (!selectedEmployee || !Number.isFinite(hrs) || hrs <= 0) return 0;
    return Math.round(hrs * Number(selectedEmployee.hourlyRateCents || 0));
  }, [hours, selectedEmployee]);

  const computedReason = useMemo(() => {
    const base = workDate ? `Missed shift for ${workDate}` : "Missed shift";
    return reasonNote.trim() ? `${base} — ${reasonNote.trim()}` : base;
  }, [workDate, reasonNote]);

  async function createAdjustment() {
    try {
      setErr("");
      setOk("");

      if (!employeeId) {
        setErr("Please select an employee.");
        return;
      }
      if (!facilityId) {
  setErr("Please select a facility.");
  return;
}
      if (!workDate) {
        setErr("Please enter the missed shift date.");
        return;
      }

      const hrs = Number(hours || 0);
      if (!Number.isFinite(hrs) || hrs <= 0) {
        setErr("Hours must be greater than 0.");
        return;
      }

      if (!selectedEmployee) {
        setErr("Employee not found.");
        return;
      }

      const amountCents = Math.round(hrs * selectedEmployee.hourlyRateCents);
      if (!amountCents) {
        setErr("Calculated amount is 0.");
        return;
      }

      setSaving(true);

      await apiFetch("/api/admin/payroll-adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          facilityId,
	  workDate,
  	  hours,
          reason: computedReason,
          amountCents,
        }),
      });

      setOk(`Adjustment created for ${selectedEmployee.legalName}: ${money(amountCents)}.`);
      setEmployeeId("");
      setFacilityId("");
      setWorkDate("");
      setHours("");
      setReasonNote("");

      await loadAdjustments();
    } catch (e: any) {
      setErr(e?.message || "Failed to create payroll adjustment");
    } finally {
      setSaving(false);
    }
  }

async function markPaidNow(adjustment: AdjustmentRow) {
  try {
    setErr("");
    setOk("");

    const paidNote = window.prompt("Optional payment note", adjustment.paidNote || "");
    if (paidNote === null) return;

    setPayingId(adjustment.id);

    await apiFetch(`/api/admin/payroll-adjustments/${encodeURIComponent(adjustment.id)}/pay-now`, {
      method: "POST",
      body: JSON.stringify({
        paidNote,
      }),
    });

    setOk(`Adjustment marked paid immediately: ${money(adjustment.amountCents)}.`);
    await loadAdjustments();
  } catch (e: any) {
    setErr(e?.message || "Failed to mark adjustment as paid");
  } finally {
    setPayingId("");
  }
}

  return (
     <div style={{ padding: 0, maxWidth: 1200, margin: "0 auto" }}> 
       <h1
  style={{
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  }}
>
  Payroll Adjustments
</h1>
        <div style={{ color: "#64748b", marginTop: 8, fontSize: 15 }}>
	Use this for missed shifts or retro pay after a payroll week has already been locked.
      </div>

	<div
  style={{
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>        

        <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", marginBottom: 14 }}>
  Add Missed Shift / Retro Pay
</div>

        <div
           style={{
  display: "grid",
  gridTemplateColumns: "1.2fr 1.2fr 180px 140px 1fr",
  gap: 12,
  alignItems: "end",
}}
	>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Employee</div>
	    <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}  
	  >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.legalName} ({emp.email}){emp.title ? ` — ${emp.title}` : ""}
                </option>
              ))}
            </select>
          </div>
           <div>
  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Facility</div>
  <select
    value={facilityId}
    onChange={(e) => setFacilityId(e.target.value)}
    style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
  >
    <option value="">Select facility</option>
    {facilities.map((f) => (
      <option key={f.id} value={f.id}>
        {f.name}
      </option>
    ))}
  </select>
</div>

          <div>
           <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Missed Shift Date</div> 
	   <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	    />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Payable Hours</div>  
	  <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}} 
	   />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Optional Note</div>
	    <input
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="e.g. entered after payroll lock"
              style={{
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	    />
          </div>
        </div>

        <div
        style={{
  marginTop: 14,
  padding: 14,
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#f8fafc",
  fontSize: 13,
  lineHeight: 1.6,
  color: "#334155",
}}
	>
          <div>
            Hourly Rate: <b>{selectedEmployee ? money(selectedEmployee.hourlyRateCents) : "—"}</b>
          </div>
          <div>
            Reason: <b>{computedReason}</b>
          </div>
          <div>
            Adjustment Amount: <b>{money(amountPreviewCents)}</b>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            disabled={saving}
            onClick={createAdjustment}
            style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  opacity: saving ? 0.6 : 1,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.10)",
}}
	  >
            {saving ? "Saving..." : "Create Adjustment"}
          </button>
        </div>

        {ok ? (
  <div
    style={{
      marginTop: 12,
      color: "#166534",
      fontSize: 13,
      background: "#f0fdf4",
      border: "1px solid #86efac",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {ok}
  </div>
) : null}

      {err ? (
  <div
    style={{
      marginTop: 12,
      color: "#b91c1c",
      fontSize: 13,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {err}
  </div>
) : null}
	</div>

          <div
  style={{
    marginTop: 18,
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>

	<div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a", marginBottom: 14 }}>
  Recent Adjustments
</div>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 20, background: "#ffffff" }}>  
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 900 }}>  
	    <thead>
              <tr style={{ background: "#f8fafc" }}>  
	        <th style={th}>Created</th>
                <th style={th}>Employee</th>
                <th style={th}>Reason</th>
                <th style={th}>Amount</th>
                <th style={th}>Status</th>
		<th style={th}>Action</th>
	     </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id}>
                  <td style={td}>{new Date(a.createdAt).toLocaleString()}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 600 }}>
                      {a.employee?.preferredName
                        ? `${a.employee.legalName} (${a.employee.preferredName})`
                        : a.employee?.legalName || a.employeeId}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.7 }}>{a.employee?.email || ""}</div>
                  </td>
                  <td style={td}>{a.reason}</td>
                  <td style={td}>{money(a.amountCents)}</td>
                  <td style={td}>
  {a.paidImmediately ? (
    <div>
      <div style={{ fontWeight: 700, color: "#166534" }}>Paid Immediately</div>
	<div style={{ fontSize: 12, opacity: 0.75 }}>
        {a.paidAt ? new Date(a.paidAt).toLocaleString() : ""}
      </div>
      {a.paidNote ? (
        <div style={{ fontSize: 12, opacity: 0.75 }}>{a.paidNote}</div>
      ) : null}
    </div>
  ) : a.payrollRun ? (
    <span>
      {dateOnlyUTC(a.payrollRun.periodStart)} → {dateOnlyUTC(a.payrollRun.periodEnd)}
       {String(a.payrollRun.periodEnd).slice(0, 10)} ({a.payrollRun.status})
    </span>
  ) : (
     <span style={{ color: "#64748b" }}>Pending next payroll</span>
  )}
</td>

	      <td style={td}>
  {!a.paidImmediately && !a.payrollRun ? (
    Number(a.amountCents || 0) > 0 ? (
      <button
        type="button"
        disabled={payingId === a.id}
        onClick={() => markPaidNow(a)}
      style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 700,
  opacity: payingId === a.id ? 0.6 : 1,
}}
	>
        {payingId === a.id ? "Saving..." : "Pay Now"}
      </button>
    ) : (
      <span style={{ opacity: 0.75, color: "#92400e", fontWeight: 600 }}>
        Recover next payroll
      </span>
    )
  ) : (
    <span style={{ opacity: 0.5 }}>—</span>
  )}
</td>
		</tr>
              ))}

              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} style={td}>
                    {loading ? "Loading..." : "No adjustments found."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};
const td: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  verticalAlign: "top",
  color: "#0f172a",
};
