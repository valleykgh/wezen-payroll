"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type Employee = {
  id: string;
  legalName: string;
  preferredName?: string | null;
  email?: string | null;
};

type PayrollAdjustmentRow = {
  id: string;
  employeeId: string;
  payrollRunId?: string | null;
  amountCents: number;
  reason?: string | null;
  createdAt: string;
  employee?: Employee | null;
  payrollRun?: {
    id: string;
    periodStart: string;
    periodEnd: string;
    status: string;
  } | null;
};

type EmployeesResp = {
  employees: Employee[];
};

type PayrollAdjustmentsResp = {
  adjustments: PayrollAdjustmentRow[];
};

function dollars(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dateOnly(v?: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

function employeeLabel(emp?: Employee | null) {
  if (!emp) return "Unknown";
  return emp.preferredName ? `${emp.legalName} (${emp.preferredName})` : emp.legalName;
}

export default function AdminPayrollAdjustmentsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [items, setItems] = useState<PayrollAdjustmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function loadEmployees() {
    const data = await apiFetch<EmployeesResp>("/api/admin/employees");
    setEmployees(data.employees || []);
  }

  async function loadAdjustments() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch<PayrollAdjustmentsResp>("/api/admin/payroll-adjustments");
      setItems(data.adjustments || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load payroll adjustments");
    } finally {
      setLoading(false);
    }
  }

  async function createAdjustment() {
    setErr("");
    setOk("");

    const amountCents = Math.round(Number(amount || 0) * 100);

    if (!employeeId) {
      setErr("Please select an employee.");
      return;
    }

    if (!Number.isFinite(amountCents) || amountCents === 0) {
      setErr("Please enter a non-zero amount.");
      return;
    }

    if (!reason.trim()) {
      setErr("Please enter a reason.");
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/admin/payroll-adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId,
          amountCents,
          reason: reason.trim(),
        }),
      });

      setOk("Payroll adjustment created.");
      setAmount("");
      setReason("");
      await loadAdjustments();
    } catch (e: any) {
      setErr(e?.message || "Failed to create payroll adjustment");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadEmployees().catch((e: any) => setErr(e?.message || "Failed to load employees"));
    loadAdjustments();
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, x) => {
        if (x.payrollRunId) acc.applied += 1;
        else acc.pending += 1;
        acc.amountCents += Number(x.amountCents || 0);
        return acc;
      },
      { pending: 0, applied: 0, amountCents: 0 }
    );
  }, [items]);

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 24 }}>Payroll Adjustments</h1>
        <div style={{ color: "#666", marginTop: 4 }}>
          Create and track pending payroll corrections
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 10,
          display: "grid",
          gridTemplateColumns: "minmax(220px, 1fr) 180px minmax(260px, 2fr) auto",
          gap: 10,
          alignItems: "end",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Employee</div>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {employeeLabel(e)}{e.email ? ` — ${e.email}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Amount ($)</div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 60 or -30"
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Reason</div>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Missed shift correction"
            style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <button
          onClick={createAdjustment}
          disabled={saving}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#111",
            color: "#fff",
            height: 40,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving..." : "Create"}
        </button>
      </div>

      {ok ? <div style={{ marginTop: 12, color: "#0a7a2f" }}>{ok}</div> : null}
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
          Pending: <b>{totals.pending}</b>
        </div>
        <div>
          Applied: <b>{totals.applied}</b>
        </div>
        <div>
          Total Amount: <b>{dollars(totals.amountCents)}</b>
        </div>
      </div>

      <div style={{ marginTop: 16, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ background: "#f9fafb" }}>
              <th style={th}>Created</th>
              <th style={th}>Employee</th>
              <th style={th}>Amount</th>
              <th style={th}>Reason</th>
              <th style={th}>Status</th>
              <th style={th}>Applied Payroll Run</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td style={td}>{dateOnly(x.createdAt)}</td>
                <td style={td}>{employeeLabel(x.employee)}</td>
                <td style={td}>
                  <b>{dollars(x.amountCents)}</b>
                </td>
                <td style={td}>{x.reason || "-"}</td>
                <td style={td}>
                  {x.payrollRunId ? (
                    <span style={appliedBadge}>APPLIED</span>
                  ) : (
                    <span style={pendingBadge}>PENDING</span>
                  )}
                </td>
                <td style={td}>
                  {x.payrollRun ? (
                    `${dateOnly(x.payrollRun.periodStart)} → ${dateOnly(x.payrollRun.periodEnd)}`
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}

            {items.length === 0 ? (
              <tr>
                <td style={td} colSpan={6}>
                  {loading ? "Loading..." : "No payroll adjustments found."}
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

const pendingBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 700,
};

const appliedBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#eff6ff",
  color: "#1d4ed8",
  border: "1px solid #bfdbfe",
  fontSize: 12,
  fontWeight: 700,
};
