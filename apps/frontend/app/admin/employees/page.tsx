"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import Link from "next/link";

type Employee = {
  id: string;
  legalName: string;
  preferredName: string | null;
  email: string;
  hourlyRateCents: number;
  active: boolean;

  title?: string | null;

  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;

  createdAt?: string;
  updatedAt?: string;

  user?: {
    id: string;
  } | null;

  invites?: Array<{
    id: string;
    expiresAt: string;
    usedAt: string | null;
    createdAt: string;
  }>;
};

function moneyFromCents(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export default function AdminEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [editingId, setEditingId] = useState<string>("");
  const [form, setForm] = useState({
  legalName: "",
  preferredName: "",
  email: "",
  title: "CNA",
  hourlyRate: "0",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
});

  async function loadEmployees() {
    setErr("");
    const resp = await apiFetch<{ employees: Employee[] }>("/api/admin/employees");
    setEmployees(resp.employees || []);
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id);
    setForm({
      legalName: emp.legalName || "",
      preferredName: emp.preferredName || "",
      email: emp.email || "",
      title: emp.title || "CNA",
      hourlyRate: String((emp.hourlyRateCents || 0) / 100),
addressLine1: emp.addressLine1 || "",
addressLine2: emp.addressLine2 || "",
city: emp.city || "",
state: emp.state || "",
zip: emp.zip || "",
    });
  }

  function cancelEdit() {
    setEditingId("");
    setForm({
  legalName: "",
  preferredName: "",
  email: "",
  title: "CNA",
  hourlyRate: "0",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zip: "",
});  
}

  async function saveEmployee(id: string) {
    try {
      setErr("");
      setOk("");
      setLoading(true);

      await apiFetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          legalName: form.legalName,
          preferredName: form.preferredName,
          email: form.email,
          title: form.title,
          hourlyRateCents: Math.round(Number(form.hourlyRate || 0) * 100),
          addressLine1: form.addressLine1,
	  addressLine2: form.addressLine2,
	  city: form.city,
	  state: form.state,
	  zip: form.zip, 
       }),
      });

      setOk("Employee updated.");
      cancelEdit();
      await loadEmployees();
    } catch (e: any) {
      setErr(e?.message || "Failed to update employee");
    } finally {
      setLoading(false);
    }
  }

  async function deactivateEmployee(emp: Employee) {
    try {
      setErr("");
      setOk("");

      const pin = window.prompt(`Enter PIN to deactivate employee "${emp.legalName}"`);
      if (!pin) return;

      setLoading(true);
      await apiFetch(`/api/admin/employees/${encodeURIComponent(emp.id)}/deactivate`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      setOk(`Employee "${emp.legalName}" deactivated.`);
      await loadEmployees();
    } catch (e: any) {
      setErr(e?.message || "Failed to deactivate employee");
    } finally {
      setLoading(false);
    }
  }

  async function restoreEmployee(emp: Employee) {
    try {
      setErr("");
      setOk("");

      const pin = window.prompt(`Enter PIN to restore employee "${emp.legalName}"`);
      if (!pin) return;

      setLoading(true);
      await apiFetch(`/api/admin/employees/${encodeURIComponent(emp.id)}/restore`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });

      setOk(`Employee "${emp.legalName}" restored.`);
      await loadEmployees();
    } catch (e: any) {
      setErr(e?.message || "Failed to restore employee");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees().catch((e: any) => setErr(e?.message || "Failed to load employees"));
  }, []);

async function sendInvite(employeeId: string) {
  try {
    const res = await apiFetch<{ inviteUrl: string }>(
      `/api/admin/employees/${employeeId}/invite`,
      {
        method: "POST",
      }
    );

    alert(`Invite link:\n\n${res.inviteUrl}`);
  } catch (e: any) {
    console.error(e);
    alert(e?.message || "Failed to create invite");
  }
}
  return (
   <div style={{ padding: 0, maxWidth: 1200, margin: "0 auto" }}>   
    <h1
  style={{
    fontSize: 30,
    fontWeight: 800,
    margin: 0,
    marginBottom: 8,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  }}
>
  Employees
</h1>  
     <div style={{ fontSize: 15, color: "#64748b", marginBottom: 16 }}>   
	Edit employee details and deactivate or restore employees. Deactivate and restore are PIN protected.
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
 
	<div
  style={{
    overflowX: "auto",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 980 }}>
          <thead>
            <tr style={{ textAlign: "left", background: "#f8fafc" }}>  
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
  Email
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
  Title
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
  Rate
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
  Status
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
  Invite
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
  Updated
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
            {employees.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: "14px 16px", color: "#64748b", fontSize: 13 }}>  
		  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isEditing = editingId === emp.id;

                return (
                 <tr key={emp.id} style={{ background: "#ffffff" }}>   
                   <td style={{ padding: "12px 14px", minWidth: 220, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}>   
		     {isEditing ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <input
                            value={form.legalName}
                            onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
                            placeholder="Legal name"
                            style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			  />
                          <input
                            value={form.preferredName}
                            onChange={(e) => setForm((p) => ({ ...p, preferredName: e.target.value }))}
                            placeholder="Preferred name"
                            style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}  
			/>
			  <input
  value={form.addressLine1}
  onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))}
  placeholder="Address line 1"
  style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
/>

<input
  value={form.addressLine2}
  onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))}
  placeholder="Address line 2"
  style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
/>

<input
  value={form.city}
  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
  placeholder="City"
  style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
/>

<input
  value={form.state}
  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
  placeholder="State"
  style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
/>

<input
  value={form.zip}
  onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
  placeholder="Zip"
  style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
/>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{emp.legalName}</div>
			  {emp.preferredName ? (
                          <div style={{ fontSize: 12, color: "#64748b" }}>Preferred: {emp.preferredName}</div>
			  ) : null}
                        </div>
                      )}
                    </td>

		    <td style={{ padding: "12px 14px", minWidth: 220, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}>
                      {isEditing ? (
                        <input
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="Email"
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
                      ) : (
                        emp.email
                      )}
                    </td>

		<td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}>
                      {isEditing ? (
                        <select
                          value={form.title}
                          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                          style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
			>
                          <option value="CNA">CNA</option>
                          <option value="LVN">LVN</option>
                          <option value="RN">RN</option>
                        </select>
                      ) : (
                        emp.title || "—"
                      )}
                    </td>

                      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}> 
		     {isEditing ? (
                        <input
                          value={form.hourlyRate}
                          onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                          placeholder="Hourly rate ($)"
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
                        moneyFromCents(emp.hourlyRateCents)
                      )}
                    </td>

                     <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}> 
		     {emp.active ? (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          ACTIVE
                        </span>
                      ) : (
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "#fef2f2",
                            color: "#b91c1c",
                            border: "1px solid #fecaca",
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                        >
                          INACTIVE
                        </span>
                      )}
                    </td>

		<td style={{ padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#0f172a" }}>  
{emp.user ? (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
        fontWeight: 700,
      }}
    >
      ACCEPTED
    </span>
  ) : emp.invites?.[0]?.usedAt ? (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 999,
        background: "#ecfdf5",
        color: "#047857",
        border: "1px solid #a7f3d0",
        fontWeight: 700,
      }}
    >
      ACCEPTED
    </span>
  ) : emp.invites?.[0] ? (
    new Date(emp.invites[0].expiresAt).getTime() < Date.now() ? (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 999,
          background: "#fff7ed",
          color: "#c2410c",
          border: "1px solid #fdba74",
          fontWeight: 700,
        }}
      >
        EXPIRED
      </span>
    ) : (
      <span
        style={{
          display: "inline-block",
          padding: "4px 10px",
          borderRadius: 999,
          background: "#eff6ff",
          color: "#1d4ed8",
          border: "1px solid #93c5fd",
          fontWeight: 700,
        }}
      >
        PENDING
      </span>
    )
  ) : (
    <span style={{ opacity: 0.6 }}>—</span>
  )}
</td>

		    <td style={{ padding: "12px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9", verticalAlign: "top", color: "#64748b" }}>
                      {emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : "—"}
                    </td>
		      <td style={{ padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => saveEmployee(emp.id)}
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
                              Save
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
  color: "#334155",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}
			    >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => startEdit(emp)}
                            style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#334155",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}  
			>
                            Edit
                          </button>
                        )}

			<Link
  href={`/admin/employees/${emp.id}/ledger`}
  style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #c4b5fd",
  background: "#f5f3ff",
  color: "#6d28d9",
  fontWeight: 700,
  textDecoration: "none",
  display: "inline-block",
}}
>
  Ledger
</Link>			

			{emp.user ? (
  <button
    type="button"
    disabled
    style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
  color: "#64748b",
  fontWeight: 700,
  opacity: 0.85,
}}
  >
    User Exists
  </button>
) : (
  <button
    type="button"
    disabled={loading}
    onClick={() => sendInvite(emp.id)}
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
    Send Invite
  </button>
)}			

			 {emp.active ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => deactivateEmployee(emp)}
                            style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}
			  >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => restoreEmployee(emp)}
                            style={{
  padding: "8px 12px",
  borderRadius: 999,
  border: "1px solid #a7f3d0",
  background: "#ecfdf5",
  color: "#047857",
  fontWeight: 700,
  opacity: loading ? 0.6 : 1,
}}
			  >
                            Restore
                          </button>
                        )}
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
