// apps/frontend/app/admin/loans/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type Employee = {
  id: string;
  legalName: string;
  preferredName?: string | null;
  email: string;
  active: boolean;
};

type Loan = {
  id: string;
  employeeId: string;
  principalCents: number;
  outstandingCents: number;
  weeklyDeductionCents: number;
  weeklyDeductionLocked: boolean;
  note?: string | null;
  createdAt?: string;
  updatedAt?: string;
  employee?: Employee;
};

function moneyFromCents(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export default function AdminLoansPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [createEmployeeId, setCreateEmployeeId] = useState("");
  const [createPrincipal, setCreatePrincipal] = useState("");
  const [createWeeklyDeduction, setCreateWeeklyDeduction] = useState("");
  const [createNote, setCreateNote] = useState("");

  const [editingLoanId, setEditingLoanId] = useState("");
  const [editingWeeklyDeduction, setEditingWeeklyDeduction] = useState("");
  const [editingLocked, setEditingLocked] = useState(false);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) =>
      (a.legalName || "").localeCompare(b.legalName || "")
    );
  }, [employees]);

  async function loadEmployees() {
    const resp = await apiFetch<{ employees: Employee[] }>("/api/admin/employees");
    setEmployees((resp.employees || []).filter((e) => e.active));
  }

  async function loadLoans() {
    const resp = await apiFetch<{ loans: Loan[] }>("/api/admin/loans");
    setLoans(resp.loans || []);
  }

  async function refreshAll() {
    await Promise.all([loadEmployees(), loadLoans()]);
  }

  async function createLoan() {
    try {
      setErr("");
      setOk("");

      if (!createEmployeeId) {
        setErr("Select an employee.");
        return;
      }

      const principalCents = Number(createPrincipal || 0);
      const weeklyDeductionCents = Number(createWeeklyDeduction || 0);

      if (!Number.isFinite(principalCents) || principalCents <= 0) {
        setErr("Principal must be greater than 0.");
        return;
      }

      if (!Number.isFinite(weeklyDeductionCents) || weeklyDeductionCents < 0) {
        setErr("Weekly deduction must be 0 or greater.");
        return;
      }

      setLoading(true);

      await apiFetch("/api/admin/loans", {
        method: "POST",
        body: JSON.stringify({
          employeeId: createEmployeeId,
          amountCents: principalCents,
          weeklyDeductionCents,
          note: createNote.trim() || undefined,
        }),
      });

      setOk("Loan created.");
      setCreateEmployeeId("");
      setCreatePrincipal("");
      setCreateWeeklyDeduction("");
      setCreateNote("");

      await loadLoans();
    } catch (e: any) {
      setErr(e?.message || "Failed to create loan");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(loan: Loan) {
    setEditingLoanId(loan.id);
    setEditingWeeklyDeduction(String(loan.weeklyDeductionCents ?? 0));
    setEditingLocked(!!loan.weeklyDeductionLocked);
  }

  function cancelEdit() {
    setEditingLoanId("");
    setEditingWeeklyDeduction("");
    setEditingLocked(false);
  }

  async function saveWeeklyDeduction(loan: Loan) {
    try {
      setErr("");
      setOk("");

      const pin = window.prompt(`Enter PIN to update weekly deduction for ${loan.employee?.legalName || "this employee"}`);
      if (!pin) return;

      const weeklyDeductionCents = Number(editingWeeklyDeduction || 0);
      if (!Number.isFinite(weeklyDeductionCents) || weeklyDeductionCents < 0) {
        setErr("Weekly deduction must be 0 or greater.");
        return;
      }

      setLoading(true);

      await apiFetch(`/api/admin/loans/${encodeURIComponent(loan.id)}/weekly-deduction`, {
        method: "PATCH",
        body: JSON.stringify({
          pin,
          weeklyDeductionCents,
          lock: editingLocked,
        }),
      });

      setOk("Weekly deduction updated.");
      cancelEdit();
      await loadLoans();
    } catch (e: any) {
      setErr(e?.message || "Failed to update weekly deduction");
    } finally {
      setLoading(false);
    }
  }

  async function manualDeduct(loan: Loan) {
    try {
      setErr("");
      setOk("");

      const pin = window.prompt(`Enter PIN to deduct manually for ${loan.employee?.legalName || "this employee"}`);
      if (!pin) return;

      const amountRaw = window.prompt("Enter deduction amount in cents");
      if (!amountRaw) return;

      const amountCents = Number(amountRaw || 0);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setErr("Deduction amount must be greater than 0.");
        return;
      }

      setLoading(true);

      await apiFetch("/api/admin/loans/deduct", {
        method: "POST",
        body: JSON.stringify({
          pin,
          employeeId: loan.employeeId,
          amountCents,
        }),
      });

      setOk("Manual deduction created.");
      await loadLoans();
    } catch (e: any) {
      setErr(e?.message || "Failed to deduct loan amount");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll().catch((e: any) => setErr(e?.message || "Failed to load loans"));
  }, []);

  return (
     <div style={{ padding: 0, maxWidth: 1250, margin: "0 auto" }}>
  <h1
    style={{
      fontSize: 30,
      fontWeight: 800,
      marginBottom: 8,
      color: "#0f172a",
      letterSpacing: "-0.02em",
    }}
  >
    Loans
  </h1>
  <div style={{ fontSize: 15, color: "#64748b", marginBottom: 18 }}>   
	Create employee loans, set default payroll deduction, and make manual deductions.
      </div>

      <div
      style={{
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 20,
  marginBottom: 16,
  background: "#ffffff",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	>

	<div style={{ fontWeight: 800, marginBottom: 12, color: "#0f172a" }}>Create Loan</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 2fr auto", gap: 10, alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8, fontWeight: 700 }}>Employee</div>
	    <select
              value={createEmployeeId}
              onChange={(e) => setCreateEmployeeId(e.target.value)}
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
              {sortedEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.legalName} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Principal (cents)</div>
            <input
              value={createPrincipal}
              onChange={(e) => setCreatePrincipal(e.target.value)}
              placeholder="e.g. 250000"
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
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Weekly Deduction (cents)</div>
            <input
              value={createWeeklyDeduction}
              onChange={(e) => setCreateWeeklyDeduction(e.target.value)}
              placeholder="e.g. 2500"
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
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Note</div>
            <input
              value={createNote}
              onChange={(e) => setCreateNote(e.target.value)}
              placeholder="Optional note"
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

          <button
            type="button"
            onClick={createLoan}
            disabled={loading}
            style={{
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  height: 44,
  opacity: loading ? 0.6 : 1,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.10)",
}}
	  >
            Create Loan
          </button>
        </div>
      </div>

      {ok ? (
  <div
    style={{
      marginBottom: 12,
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
      marginBottom: 12,
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

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>  
              <th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Employee
</th>
              
<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Principal
</th>
              
<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Outstanding
</th>
        
<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Weekly Deduction
</th>      

<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Locked
</th>              
        
<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Note
</th>      
        
<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Created
</th>      

<th
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  }}
>
  Actions
</th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr>
              <td colSpan={8} style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>
  No loans found.
</td>
	      </tr>
            ) : (
              loans.map((loan) => {
                const isEditing = editingLoanId === loan.id;
                const fullyPaid = Number(loan.outstandingCents || 0) <= 0;

                return (
                 <tr key={loan.id} style={{ background: "#ffffff" }}>   
                    <td
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    color: "#0f172a",
  }}
>  
          <div style={{ fontWeight: 700, color: "#0f172a" }}>
  {loan.employee?.legalName || loan.employeeId}
</div>            
		    {loan.employee?.email ? (
            <div style={{ fontSize: 12, color: "#64748b" }}>{loan.employee.email}</div>          
		) : null}
                    </td>

		<td
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    color: "#0f172a",
  }}
>
  {moneyFromCents(loan.principalCents)}
</td>
		<td
  style={{
    padding: "12px 14px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
  }}
>
                  <span style={{ fontWeight: 700, color: fullyPaid ? "#166534" : "#0f172a" }}>      
			{moneyFromCents(loan.outstandingCents)}
                      </span>
                    </td>

                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        color: "#0f172a",
                      }}
                    >
                      {isEditing ? (
                        <input
                          value={editingWeeklyDeduction}
                          onChange={(e) => setEditingWeeklyDeduction(e.target.value)}
                          style={{
                            width: 120,
                            padding: "10px 12px",
                            border: "1px solid #cbd5e1",
                            borderRadius: 14,
                            background: "#ffffff",
                            color: "#0f172a",
                            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                          }}
                        />
                      ) : (
                        moneyFromCents(loan.weeklyDeductionCents)
                      )}
                    </td>

                    <td
                      style={{
                        padding: "12px 14px",
                        borderBottom: "1px solid #f1f5f9",
                        verticalAlign: "top",
                        color: "#0f172a",
                      }}
                    >
                      {isEditing ? (
                        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="checkbox"
                            checked={editingLocked}
                            onChange={(e) => setEditingLocked(e.target.checked)}
                          />
                          Locked
                        </label>
                      ) : loan.weeklyDeductionLocked ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          LOCKED
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#f3f4f6",
                            color: "#374151",
                            border: "1px solid #e5e7eb",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          OPEN
                        </span>
                      )}
                    </td>


                    <td style={{
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#0f172a",
}}>{loan.note || "—"}</td>

                    <td style={{
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#64748b",
  fontSize: 13,
}}>
                      {loan.createdAt ? new Date(loan.createdAt).toLocaleString() : "—"}
                    </td>

                    <td style={{
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "top",
  color: "#0f172a",
}}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => saveWeeklyDeduction(loan)}
                              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #0f172a",
  background: "#0f172a",
  color: "#ffffff",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}
			    >
                              Save Deduction
                            </button>

                            <button
                              type="button"
                              disabled={loading}
                              onClick={cancelEdit}
                              style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
}}
			    >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={loading || fullyPaid}
                            onClick={() => startEdit(loan)}
                            style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
}}  
			>
                            Edit Deduction
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={loading || fullyPaid}
                          onClick={() => manualDeduct(loan)}
                          style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}
			>
                          Manual Deduct
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
