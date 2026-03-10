// apps/frontend/app/admin/payroll-runs/[id]/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type PayrollRunEmployeeRow = {
  id: string;
  employeeId: string;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  regularPayCents: number;
  overtimePayCents: number;
  doublePayCents: number;
  grossPayCents: number;
  adjustmentsCents: number;
  loanDeductionCents: number;
  netPayCents: number;
  snapshotVersion: number;
  paidEarly?: boolean;
  paidEarlyAmountCents?: number;
  employee?: {
    id: string;
    legalName: string;
    preferredName?: string | null;
    email?: string | null;
    hourlyRateCents?: number | null;
    payrollAdjustments?: Array<{
    id: string;
    amountCents: number;
    reason?: string | null;
    createdAt: string;
    payrollRunId?: string | null;
  }>;
  } | null;
};

type PayrollRunEntrySnapshotRow = {
  id: string;
  payrollRunId: string;
  employeeId: string;
  timeEntryId?: string | null;
  workDate: string;
  status: string;
  snapshotJson: any;
  employee?: {
    id: string;
    legalName: string;
    preferredName?: string | null;
    email?: string | null;
  } | null;
  corrections?: Array<{
    id: string;
    reason?: string | null;
    adjustmentAmountCents: number;
    createdAt: string;
    createdById?: string | null;
    payrollAdjustmentId?: string | null;
     }>;
};

type PayrollRunDetail = {
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
  employees: PayrollRunEmployeeRow[];
  entrySnapshots: PayrollRunEntrySnapshotRow[];
};

type PayrollRunResp = {
  payrollRun: PayrollRunDetail;
};

function dollars(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function dateOnly(v?: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.floor(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function employeeLabel(emp?: PayrollRunEmployeeRow["employee"] | PayrollRunEntrySnapshotRow["employee"] | null) {
  if (!emp) return "Unknown";
  return emp.preferredName ? `${emp.legalName} (${emp.preferredName})` : emp.legalName;
}

function statusStyle(status: PayrollRunDetail["status"]): React.CSSProperties {
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

export default function PayrollRunDetailPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "");
  const router = useRouter();
  const [run, setRun] = useState<PayrollRunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
    const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [creatingAdjustment, setCreatingAdjustment] = useState(false);
  const [adjustmentOk, setAdjustmentOk] = useState("");
  const [adjustmentErr, setAdjustmentErr] = useState("");
    const [selectedSnapshotForCorrection, setSelectedSnapshotForCorrection] =
    useState<PayrollRunEntrySnapshotRow | null>(null);
  async function load() {
    if (!id) {
      setErr("Missing payroll run id");
      return;
    }

    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch<PayrollRunResp>(`/api/admin/payroll-runs/${id}`);
      const payrollRun = data.payrollRun;
      setRun(payrollRun);

      if (payrollRun.employees.length > 0) {
        setSelectedEmployeeId((prev) => prev || payrollRun.employees[0].employeeId);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load payroll run");
    } finally {
      setLoading(false);
    }
  }
      function pendingAdjustmentCount(emp?: PayrollRunEmployeeRow | null) {
    const adjustments = emp?.employee?.payrollAdjustments || [];
    return adjustments.filter((a) => !a.payrollRunId).length;
  }
      function startCorrectionFromSnapshot(snapshot: PayrollRunEntrySnapshotRow) {
    const snap = snapshot.snapshotJson || {};
    const reasonParts = [
      "Correction from payroll snapshot",
      dateOnly(snapshot.workDate),
      snap.shiftType ? `shift ${snap.shiftType}` : "",
      snap.facilityName ? `at ${snap.facilityName}` : "",
    ].filter(Boolean);

    setSelectedSnapshotForCorrection(snapshot);
    setAdjustmentReason(reasonParts.join(" • "));
    setAdjustmentErr("");
    setAdjustmentOk("");
  }
    async function createAdjustmentForSelectedEmployee() {
    setAdjustmentOk("");
    setAdjustmentErr("");
    if (!selectedEmployee) {
      setAdjustmentErr("Select an employee first.");
      return;
    }

    const amountCents = Math.round(Number(adjustmentAmount || 0) * 100);

    if (!Number.isFinite(amountCents) || amountCents === 0) {
      setAdjustmentErr("Enter a non-zero adjustment amount.");
      return;
    }

    if (!adjustmentReason.trim()) {
      setAdjustmentErr("Enter a reason for the adjustment.");
      return;
    }

    const confirmCreate = window.confirm(
      `Create ${amountCents > 0 ? "positive" : "negative"} adjustment for ${
        employeeLabel(selectedEmployee.employee)
      }?`
    );
    if (!confirmCreate) return;

    setCreatingAdjustment(true);
    try {
      await apiFetch("/api/admin/payroll-adjustments", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployee.employeeId,
          amountCents,
          reason: adjustmentReason.trim(),
        }),
      });

      setAdjustmentOk("Payroll adjustment created.");
      setAdjustmentAmount("");
      setAdjustmentReason("");
      setSelectedSnapshotForCorrection(null);
      await load();
    } catch (e: any) {
      setAdjustmentErr(e?.message || "Failed to create payroll adjustment");
    } finally {
      setCreatingAdjustment(false);
    }
  }

  useEffect(() => {
    if (!id) return;
    load();
  }, [id]);
  
  const selectedEmployee = useMemo(() => {
    if (!run || !selectedEmployeeId) return null;
    return run.employees.find((e) => e.employeeId === selectedEmployeeId) || null;
  }, [run, selectedEmployeeId]);

  const selectedSnapshots = useMemo(() => {
    if (!run || !selectedEmployeeId) return [];
    return run.entrySnapshots.filter((s) => s.employeeId === selectedEmployeeId);
  }, [run, selectedEmployeeId]);

  const headerTotals = useMemo(() => {
    if (!run) {
      return {
        employeeCount: 0,
        grossPayCents: 0,
        adjustmentsCents: 0,
        loanDeductionCents: 0,
        netPayCents: 0,
      };
    }

    return run.employees.reduce(
      (acc, e) => {
        acc.employeeCount += 1;
        acc.grossPayCents += Number(e.grossPayCents || 0);
        acc.adjustmentsCents += Number(e.adjustmentsCents || 0);
        acc.loanDeductionCents += Number(e.loanDeductionCents || 0);
        acc.netPayCents += Number(e.netPayCents || 0);
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
  }, [run]);

    const selectedEmployeeAdjustmentTotals = useMemo(() => {
    const adjustments = selectedEmployee?.employee?.payrollAdjustments || [];

    let pendingCents = 0;
    let appliedCents = 0;

    for (const adj of adjustments) {
      if (adj.payrollRunId) appliedCents += Number(adj.amountCents || 0);
      else pendingCents += Number(adj.amountCents || 0);
    }

    return {
      pendingCents,
      appliedCents,
      totalCents: pendingCents + appliedCents,
    };
  }, [selectedEmployee]);

  return (
    <div style={{ padding: 16, maxWidth: 1280, margin: "0 auto" }}>
      <div style={{ marginBottom: 12 }}>
        <Link
          href="/admin/payroll-runs"
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
          ← Back to Payroll Runs
        </Link>
      </div>

      {loading && !run ? <div>Loading payroll run...</div> : null}
      {err ? <div style={{ color: "#b00020" }}>{err}</div> : null}

      {run ? (
        <>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: 24 }}>
                  Payroll Run: {dateOnly(run.periodStart)} → {dateOnly(run.periodEnd)}
                </h1>
                <div style={{ marginTop: 8 }}>
                  <span style={statusStyle(run.status)}>{run.status}</span>
                </div>
                <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
                  Finalized: {run.finalizedAt ? dateOnly(run.finalizedAt) : "-"} • Created by:{" "}
                  {run.createdBy?.email || "-"}
                </div>
                {run.notes ? (
                  <div style={{ marginTop: 8, fontSize: 13 }}>
                    Notes: <span style={{ color: "#444" }}>{run.notes}</span>
                  </div>
                ) : null}
              </div>

              <div
                style={{
                  border: "1px solid #eee",
                  borderRadius: 10,
                  padding: 12,
                  background: "#fafafa",
                  minWidth: 320,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Run Totals</div>
                <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                  <div>
                    Employees: <b>{headerTotals.employeeCount}</b>
                  </div>
                  <div>
                    Gross: <b>{dollars(headerTotals.grossPayCents)}</b>
                  </div>
                  <div>
                    Adjustments: <b>{dollars(headerTotals.adjustmentsCents)}</b>
                  </div>
                  <div>
                    Loans: <b>{dollars(headerTotals.loanDeductionCents)}</b>
                  </div>
                  <div>
                    Net: <b>{dollars(headerTotals.netPayCents)}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "360px 1fr",
              gap: 16,
              alignItems: "start",
            }}
          >
            {/* Left panel */}
            <aside
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Employees in this run</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {run.employees.map((e) => {
                  const active = e.employeeId === selectedEmployeeId;

                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setSelectedEmployeeId(e.employeeId)}
                      style={{
                        textAlign: "left",
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #ddd",
                        background: active ? "#f5f5f5" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
  <div style={{ fontWeight: 700 }}>{employeeLabel(e.employee)}</div>

  {pendingAdjustmentCount(e) > 0 ? (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: "#fff7ed",
        color: "#c2410c",
        border: "1px solid #fdba74",
        fontSize: 11,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {pendingAdjustmentCount(e)} pending
    </span>
  ) : null}
</div>

<div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
  {e.employee?.email || "-"}
</div>

	<div style={{ fontSize: 12, marginTop: 6 }}>
  Gross: <b>{dollars(e.grossPayCents)}</b> • Net: <b>{dollars(e.netPayCents)}</b>
</div>

{e.paidEarly ? (
  <div style={{ marginTop: 6 }}>
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 999,
        background: "#ecfdf5",
        color: "#065f46",
        border: "1px solid #a7f3d0",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      PAID EARLY {dollars(Number(e.paidEarlyAmountCents || 0))}
    </span>
  </div>
) : null}	    
              </button>
                  );
                })}
              </div>
            </aside>

            {/* Main panel */}
            <main
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
                background: "#fff",
              }}
            >
              {!selectedEmployee ? (
                <div style={{ color: "#666" }}>Select an employee to inspect frozen totals and snapshots.</div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>
                        {employeeLabel(selectedEmployee.employee)}
                      </div>
                      <div style={{ color: "#666", fontSize: 13 }}>
                        {selectedEmployee.employee?.email || "-"}
                      </div>
                    </div>

                    <div
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 10,
                        padding: 12,
                        background: "#fafafa",
                        minWidth: 320,
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Frozen Totals</div>
                      <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                        <div>
                          Regular: <b>{minutesToHHMM(selectedEmployee.regularMinutes)}</b>
                        </div>
                        <div>
                          OT: <b>{minutesToHHMM(selectedEmployee.overtimeMinutes)}</b>
                        </div>
                        <div>
                          DT: <b>{minutesToHHMM(selectedEmployee.doubleMinutes)}</b>
                        </div>
                        <div>
                          Break: <b>{minutesToHHMM(selectedEmployee.breakMinutes)}</b>
                        </div>
                        <div>
                          Payable: <b>{minutesToHHMM(selectedEmployee.payableMinutes)}</b>
                        </div>
                        <div>
                          Gross: <b>{dollars(selectedEmployee.grossPayCents)}</b>
                        </div>
                        <div>
                          Adjustments: <b>{dollars(selectedEmployee.adjustmentsCents)}</b>
                        </div>
                        <div>
                          Loans: <b>{dollars(selectedEmployee.loanDeductionCents)}</b>
                        </div>
			  <div>
         		 Paid Early: <b>{selectedEmployee.paidEarly ? "YES" : "NO"}</b>
  			</div>
  			<div>
   			 Early Amount: <b>{dollars(Number(selectedEmployee.paidEarlyAmountCents || 0))}</b>
                        </div>
			<div>
                          Net: <b>{dollars(selectedEmployee.netPayCents)}</b>
                        </div>
                        <div>
                          Pending Adjustments: <b>{dollars(selectedEmployeeAdjustmentTotals.pendingCents)}</b>
                        </div>
                        <div>
                          Applied Adjustments: <b>{dollars(selectedEmployeeAdjustmentTotals.appliedCents)}</b>
                        </div>
                        <div>
                          All Adjustments: <b>{dollars(selectedEmployeeAdjustmentTotals.totalCents)}</b>
                        </div>			
                      </div>
                    </div>
                  </div>
                                        <div
                    style={{
                      marginTop: 16,
                      border: "1px solid #ddd",
                      borderRadius: 10,
                      padding: 12,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 10 }}>
                      Create Payroll Adjustment
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "180px 1fr auto",
                        gap: 10,
                        alignItems: "end",
                      }}
                    >
                                          {selectedSnapshotForCorrection ? (
                      <div
                        style={{
                          marginBottom: 10,
                          padding: 10,
                          border: "1px solid #fde68a",
                          borderRadius: 8,
                          background: "#fffbeb",
                          fontSize: 12,
                          color: "#92400e",
                        }}
                      >
                        Creating correction from snapshot:
                        <div style={{ marginTop: 4, fontWeight: 700 }}>
                          {dateOnly(selectedSnapshotForCorrection.workDate)}
                          {" • "}
                          {selectedSnapshotForCorrection.snapshotJson?.shiftType || "-"}
                          {" • "}
                          {selectedSnapshotForCorrection.snapshotJson?.facilityName || "-"}
                        </div>
                      </div>
                    ) : null}
                      <div>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                          Amount ($)
                        </div>
                        <input
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(e.target.value)}
                          placeholder="e.g. 60 or -30"
                          style={{
                            width: "100%",
                            padding: 8,
                            border: "1px solid #ccc",
                            borderRadius: 8,
                          }}
                        />
                      </div>

                      <div>
                        <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                          Reason
                        </div>
                        <input
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="Missed shift correction"
                          style={{
                            width: "100%",
                            padding: 8,
                            border: "1px solid #ccc",
                            borderRadius: 8,
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={createAdjustmentForSelectedEmployee}
                        disabled={creatingAdjustment}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "1px solid #111",
                          background: "#111",
                          color: "#fff",
                          height: 40,
                          cursor: creatingAdjustment ? "not-allowed" : "pointer",
                        }}
                      >
                        {creatingAdjustment ? "Creating..." : "Create Adjustment"}
                      </button>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                      This creates a pending payroll correction for{" "}
                      <b>{employeeLabel(selectedEmployee.employee)}</b>. It will be applied in a later payroll run.
                    </div>

                    {adjustmentOk ? (
                      <div style={{ marginTop: 10, color: "#0a7a2f", fontSize: 13 }}>
                        {adjustmentOk}
                      </div>
                    ) : null}

                    {adjustmentErr ? (
                      <div style={{ marginTop: 10, color: "#b00020", fontSize: 13 }}>
                        {adjustmentErr}
                      </div>
                    ) : null}
                  </div>
             

{/* Existing Payroll Adjustments */}
<div
  style={{
    marginTop: 16,
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 12,
    background: "#fff",
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 10 }}>
    Existing Payroll Adjustments
  </div>

    {(selectedEmployee.employee?.payrollAdjustments?.length ?? 0) > 0 ? (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            <th style={th}>Created</th>
            <th style={th}>Amount</th>
            <th style={th}>Reason</th>
            <th style={th}>Status</th>
          </tr>
        </thead>

        <tbody>
            {(selectedEmployee.employee?.payrollAdjustments ?? []).map((adj) => (
	    <tr key={adj.id}>
              <td style={td}>{dateOnly(adj.createdAt)}</td>
              <td style={td}><b>{dollars(adj.amountCents)}</b></td>
              <td style={td}>{adj.reason || "-"}</td>
              <td style={td}>
                {adj.payrollRunId ? (
                  <span style={appliedBadge}>APPLIED</span>
                ) : (
                  <span style={pendingBadge}>PENDING</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div style={{ color: "#666", fontSize: 13 }}>
      No payroll adjustments for this employee.
    </div>
  )}
</div>
                  <div style={{ marginTop: 16, fontWeight: 700 }}>Frozen Entry Snapshots</div>

                  <div style={{ marginTop: 10, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                      <thead>
                        <tr style={{ background: "#f9fafb" }}>
                          <th style={th}>Work Date</th>
                          <th style={th}>Shift</th>
                          <th style={th}>Facility</th>
                          <th style={th}>Worked</th>
                          <th style={th}>Break</th>
                          <th style={th}>Payable</th>
                          <th style={th}>Reg</th>
                          <th style={th}>OT</th>
                          <th style={th}>DT</th>
                          <th style={th}>Gross</th>
                          <th style={th}>Status</th>
		          <th style={th}>Correction</th>
			  <th style={th}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSnapshots.map((s) => {
                          const snap = s.snapshotJson || {};

                          return (
                            <tr key={s.id}>
                              <td style={td}>{dateOnly(s.workDate)}</td>
                              <td style={td}>{snap.shiftType || "-"}</td>
                              <td style={td}>{snap.facilityName || "-"}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.workedMinutes || 0))}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.breakMinutes || 0))}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.payableMinutes || 0))}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.regularMinutes || 0))}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.overtimeMinutes || 0))}</td>
                              <td style={td}>{minutesToHHMM(Number(snap.doubleMinutes || 0))}</td>
                              <td style={td}>{dollars(Number(snap.grossPayCents || 0))}</td>
                              <td style={td}>{s.status}</td>
                              <td style={td}>
  {Array.isArray(s.corrections) && s.corrections.length > 0 ? (
    <div style={{ display: "grid", gap: 4 }}>
      <span
        style={{
          display: "inline-block",
          padding: "3px 8px",
          borderRadius: 999,
          background: "#ecfeff",
          color: "#155e75",
          border: "1px solid #a5f3fc",
          fontSize: 11,
          fontWeight: 700,
          width: "fit-content",
        }}
      >
        CORRECTED
      </span>

      <div style={{ fontSize: 12 }}>
        <b>{dollars(s.corrections[0].adjustmentAmountCents)}</b>
      </div>

      <div style={{ fontSize: 11, color: "#666" }}>
        {dateOnly(s.corrections[0].createdAt)}
      </div>
    </div>
  ) : (
    <span
      style={{
        display: "inline-block",
        padding: "3px 8px",
        borderRadius: 999,
        background: "#f9fafb",
        color: "#6b7280",
        border: "1px solid #e5e7eb",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      NONE
    </span>
  )}
</td>

<td style={td}>
  {Array.isArray(s.corrections) && s.corrections.length > 0 ? (
    <button
      type="button"
      disabled
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #d1d5db",
        background: "#f3f4f6",
        color: "#9ca3af",
        cursor: "not-allowed",
        fontWeight: 700,
      }}
      title="This snapshot already has a correction"
    >
      Already Corrected
    </button>
  ) : (
    <button
      type="button"
      onClick={() => router.push(`/admin/payroll-runs/${run.id}/correction/${s.id}`)}
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: "1px solid #2563eb",
        background: "#eff6ff",
        color: "#1d4ed8",
        cursor: "pointer",
        fontWeight: 700,
      }}
      title="Create correction from this frozen snapshot"
    >
      Correct
    </button>
  )}
</td>

   				</tr>
                         	 );
                       		 })}

                        {selectedSnapshots.length === 0 ? (
                          <tr>
                            <td style={td} colSpan={13}>
                              No entry snapshots found for this employee in the run.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </main>
          </div>
        </>
      ) : null}
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
