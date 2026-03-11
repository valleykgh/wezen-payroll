"use client";

import React, { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

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
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Employees</h1>
      <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 14 }}>
        Edit employee details and deactivate or restore employees. Deactivate and restore are PIN protected.
      </div>

      {ok ? <div style={{ marginBottom: 10, color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
      {err ? <div style={{ marginBottom: 10, color: "#b00020", fontSize: 13 }}>{err}</div> : null}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ padding: 10 }}>Employee</th>
              <th style={{ padding: 10 }}>Email</th>
              <th style={{ padding: 10 }}>Title</th>
              <th style={{ padding: 10 }}>Rate</th>
              <th style={{ padding: 10 }}>Status</th>
              <th style={{ padding: 10 }}>Invite</th>
              <th style={{ padding: 10 }}>Updated</th>
              <th style={{ padding: 10 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 12, opacity: 0.7 }}>
                  No employees found.
                </td>
              </tr>
            ) : (
              employees.map((emp) => {
                const isEditing = editingId === emp.id;

                return (
                  <tr key={emp.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: 10, minWidth: 220 }}>
                      {isEditing ? (
                        <div style={{ display: "grid", gap: 8 }}>
                          <input
                            value={form.legalName}
                            onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))}
                            placeholder="Legal name"
                            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                          />
                          <input
                            value={form.preferredName}
                            onChange={(e) => setForm((p) => ({ ...p, preferredName: e.target.value }))}
                            placeholder="Preferred name"
                            style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                          />
			  <input
  value={form.addressLine1}
  onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))}
  placeholder="Address line 1"
  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
/>

<input
  value={form.addressLine2}
  onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))}
  placeholder="Address line 2"
  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
/>

<input
  value={form.city}
  onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
  placeholder="City"
  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
/>

<input
  value={form.state}
  onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
  placeholder="State"
  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
/>

<input
  value={form.zip}
  onChange={(e) => setForm((p) => ({ ...p, zip: e.target.value }))}
  placeholder="Zip"
  style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
/>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontWeight: 600 }}>{emp.legalName}</div>
                          {emp.preferredName ? (
                            <div style={{ fontSize: 12, opacity: 0.7 }}>Preferred: {emp.preferredName}</div>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td style={{ padding: 10, minWidth: 220 }}>
                      {isEditing ? (
                        <input
                          value={form.email}
                          onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                          placeholder="Email"
                          style={{ width: "100%", padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                        />
                      ) : (
                        emp.email
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {isEditing ? (
                        <select
                          value={form.title}
                          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                          style={{ padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                        >
                          <option value="CNA">CNA</option>
                          <option value="LVN">LVN</option>
                          <option value="RN">RN</option>
                        </select>
                      ) : (
                        emp.title || "—"
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
                      {isEditing ? (
                        <input
                          value={form.hourlyRate}
                          onChange={(e) => setForm((p) => ({ ...p, hourlyRate: e.target.value }))}
                          placeholder="Hourly rate ($)"
			  style={{ width: 120, padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                        />
                      ) : (
                        moneyFromCents(emp.hourlyRateCents)
                      )}
                    </td>

                    <td style={{ padding: 10 }}>
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

		    <td style={{ padding: 10, fontSize: 13 }}>
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

                    <td style={{ padding: 10, fontSize: 13, opacity: 0.8 }}>
                      {emp.updatedAt ? new Date(emp.updatedAt).toLocaleString() : "—"}
                    </td>

                    <td style={{ padding: 10 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => saveEmployee(emp.id)}
                              style={{
                                padding: "8px 12px",
                                borderRadius: 8,
                                border: "1px solid #111",
                                background: "#111",
                                color: "#fff",
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
                                borderRadius: 8,
                                border: "1px solid #ccc",
                                background: "#fff",
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
                              borderRadius: 8,
                              border: "1px solid #ccc",
                              background: "#fff",
                            }}
                          >
                            Edit
                          </button>
                        )}


			{emp.user ? (
  <button
    type="button"
    disabled
    style={{
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid #ccc",
      background: "#f3f4f6",
      color: "#6b7280",
      fontWeight: 700,
      opacity: 0.8,
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
      borderRadius: 8,
      border: "1px solid #2563eb",
      background: "#eff6ff",
      color: "#1d4ed8",
      fontWeight: 700,
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
                              borderRadius: 8,
                              border: "1px solid #b91c1c",
                              background: "#fef2f2",
                              color: "#b91c1c",
                              fontWeight: 700,
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
                              borderRadius: 8,
                              border: "1px solid #047857",
                              background: "#ecfdf5",
                              color: "#047857",
                              fontWeight: 700,
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
