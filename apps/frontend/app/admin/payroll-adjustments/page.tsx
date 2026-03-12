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
  reason: string;
  amountCents: number;
  createdAt: string;
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

function money(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export default function AdminPayrollAdjustmentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
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

  useEffect(() => {
    setLoading(true);
    Promise.all([loadEmployees(), loadAdjustments()])
      .catch((e: any) => setErr(e?.message || "Failed to load payroll adjustments"))
      .finally(() => setLoading(false));
  }, []);

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
          reason: computedReason,
          amountCents,
        }),
      });

      setOk(`Adjustment created for ${selectedEmployee.legalName}: ${money(amountCents)}.`);
      setEmployeeId("");
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

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, margin: 0 }}>Payroll Adjustments</h1>
      <div style={{ color: "#666", marginTop: 6 }}>
        Use this for missed shifts or retro pay after a payroll week has already been locked.
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Add Missed Shift / Retro Pay</div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 180px 140px 1fr",
            gap: 12,
            alignItems: "end",
          }}
        >
          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Employee</div>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
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
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Missed Shift Date</div>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Payable Hours</div>
            <input
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Optional Note</div>
            <input
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="e.g. entered after payroll lock"
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: "1px solid #eee",
            borderRadius: 10,
            background: "#fafafa",
            fontSize: 13,
            lineHeight: 1.5,
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
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            {saving ? "Saving..." : "Create Adjustment"}
          </button>
        </div>

        {ok ? <div style={{ marginTop: 12, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
        {err ? <div style={{ marginTop: 12, color: "#b00020", fontSize: 13 }}>{err}</div> : null}
      </div>

      <div
        style={{
          marginTop: 18,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Recent Adjustments</div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
            <thead>
              <tr style={{ background: "#f9fafb" }}>
                <th style={th}>Created</th>
                <th style={th}>Employee</th>
                <th style={th}>Reason</th>
                <th style={th}>Amount</th>
                <th style={th}>Payroll Run</th>
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
                    {a.payrollRun ? (
                      <span>
                        {String(a.payrollRun.periodStart).slice(0, 10)} →{" "}
                        {String(a.payrollRun.periodEnd).slice(0, 10)} ({a.payrollRun.status})
                      </span>
                    ) : (
                      <span style={{ opacity: 0.7 }}>Pending next payroll</span>
                    )}
                  </td>
                </tr>
              ))}

              {adjustments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={td}>
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
