"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: "SUPER_ADMIN" | "PAYROLL_ADMIN" | "HR_ADMIN" | "EMPLOYEE";
  active: boolean;
  mustChangePassword: boolean;
  passwordUpdatedAt?: string | null;
  lastLoginAt?: string | null;
  employeeId?: string | null;
};

const ROLE_OPTIONS = ["SUPER_ADMIN", "PAYROLL_ADMIN", "HR_ADMIN", "EMPLOYEE"] as const;

function fmtDate(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createRole, setCreateRole] = useState<User["role"]>("PAYROLL_ADMIN");
  const [createPassword, setCreatePassword] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.email || "").toLowerCase().includes(q);

      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && u.active) ||
        (statusFilter === "INACTIVE" && !u.active);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [users, query, roleFilter, statusFilter]);

  async function createUser() {
    if (!createEmail.trim() || !createRole || !createPassword.trim()) {
      alert("Email, role, and temporary password are required.");
      return;
    }

    setCreateBusy(true);
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: createName.trim() || null,
          email: createEmail.trim(),
          role: createRole,
          temporaryPassword: createPassword,
          active: true,
          mustChangePassword: true,
        }),
      });

      setCreateName("");
      setCreateEmail("");
      setCreatePassword("");
      setCreateRole("PAYROLL_ADMIN");

      await loadUsers();
      alert("User created");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to create user");
    } finally {
      setCreateBusy(false);
    }
  }

  async function saveUser(user: User) {
    setSavingId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: user.name,
          role: user.role,
          active: user.active,
          mustChangePassword: user.mustChangePassword,
        }),
      });

      await loadUsers();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to save user");
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(user: User) {
    if (user.role === "SUPER_ADMIN") return;

    setSavingId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          active: !user.active,
        }),
      });

      await loadUsers();
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to update user");
    } finally {
      setSavingId(null);
    }
  }

  async function resetPassword(user: User) {
    const temporaryPassword = prompt(`Enter temporary password for ${user.email}`);
    if (!temporaryPassword) return;

    setSavingId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        body: JSON.stringify({
          temporaryPassword,
        }),
      });

      await loadUsers();
      alert("Password reset");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to reset password");
    } finally {
      setSavingId(null);
    }
  }

    async function deleteUser(user: User) {
    if (user.role === "SUPER_ADMIN") {
      alert("SUPER_ADMIN users cannot be deleted.");
      return;
    }

    const ok = confirm(
      `Delete ${user.email} permanently?\n\nThis only works for users that have no system references.`
    );
    if (!ok) return;

    setSavingId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });

      await loadUsers();
      alert("User deleted");
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to delete user");
    } finally {
      setSavingId(null);
    }
  }

  function patchLocalUser(id: string, patch: Partial<User>) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }

  return (
    <div style={{ padding: 20, maxWidth: 1200 }}>
      <h1 style={{ marginTop: 0 }}>Admin Users</h1>

      <div
        style={{
          marginTop: 12,
          marginBottom: 20,
          padding: 14,
          border: "1px solid #d1d5db",
          borderRadius: 12,
          background: "#f9fafb",
          maxWidth: 1000,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Role Permissions</div>

        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
          <div>
            <strong>SUPER_ADMIN</strong>: Full system access, including admin user
            management, payroll, employees, facilities, loans, and password resets.
          </div>
          <div>
            <strong>PAYROLL_ADMIN</strong>: Payroll operations, payroll runs,
            adjustments, pay summaries, time entries, and loans.
          </div>
          <div>
            <strong>HR_ADMIN</strong>: Employee management, hiring-related admin work,
            and employee records.
          </div>
          <div>
            <strong>EMPLOYEE</strong>: Access only to their own employee portal and
            personal data.
          </div>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Create User</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
          }}
        >
          <input
            placeholder="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <input
            placeholder="Email"
            value={createEmail}
            onChange={(e) => setCreateEmail(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <select
            value={createRole}
            onChange={(e) => setCreateRole(e.target.value as User["role"])}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <input
            placeholder="Temporary password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </div>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={createUser}
            disabled={createBusy}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #111",
              background: "#fff",
              fontWeight: 700,
            }}
          >
            {createBusy ? "Creating..." : "Create User"}
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          background: "#fff",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Search & Filter</h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr",
            gap: 10,
          }}
        >
          <input
            placeholder="Search by name or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="ALL">All Roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <div style={{ padding: 16, fontWeight: 700 }}>
          Users ({filteredUsers.length})
        </div>

        {loading ? (
          <div style={{ padding: 16 }}>Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: 16 }}>No users found.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Name
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Email
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Role
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Active
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Must Change Password
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Last Login
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Password Updated
                  </th>
                  <th align="left" style={{ padding: 12, borderTop: "1px solid #eee" }}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 180 }}>
                      <input
                        value={u.name || ""}
                        onChange={(e) =>
                          patchLocalUser(u.id, { name: e.target.value || null })
                        }
                        style={{
                          width: "100%",
                          padding: 8,
                          border: "1px solid #ccc",
                          borderRadius: 8,
                        }}
                      />
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 220 }}>
                      {u.email}
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 180 }}>
                      <select
                        value={u.role}
                        onChange={(e) =>
                          patchLocalUser(u.id, { role: e.target.value as User["role"] })
                        }
                        style={{
                          width: "100%",
                          padding: 8,
                          border: "1px solid #ccc",
                          borderRadius: 8,
                        }}
                      >
                        {ROLE_OPTIONS.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee" }}>
                      {u.active ? "Yes" : "No"}
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={u.mustChangePassword}
                          onChange={(e) =>
                            patchLocalUser(u.id, {
                              mustChangePassword: e.target.checked,
                            })
                          }
                        />
                        {u.mustChangePassword ? "Yes" : "No"}
                      </label>
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 170 }}>
                      {fmtDate(u.lastLoginAt)}
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 170 }}>
                      {fmtDate(u.passwordUpdatedAt)}
                    </td>

                    <td style={{ padding: 12, borderTop: "1px solid #eee", minWidth: 260 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveUser(u)}
                          disabled={savingId === u.id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #111",
                            background: "#fff",
                          }}
                        >
                          Save
                        </button>

                        {u.role === "SUPER_ADMIN" ? (
                          <button
                            disabled
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #ccc",
                              background: "#f3f4f6",
                              opacity: 0.6,
                              cursor: "not-allowed",
                            }}
                          >
                            Protected
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleActive(u)}
                            disabled={savingId === u.id}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #111",
                              background: "#fff",
                            }}
                          >
                            {u.active ? "Deactivate" : "Activate"}
                          </button>
                        )}

                        <button
                          onClick={() => resetPassword(u)}
                          disabled={savingId === u.id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid #111",
                            background: "#fff",
                          }}
                        >
                          Reset Password
                        </button>
			                        {u.role === "SUPER_ADMIN" ? null : (
                          <button
                            onClick={() => deleteUser(u)}
                            disabled={savingId === u.id}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 8,
                              border: "1px solid #b91c1c",
                              background: "#fff",
                              color: "#b91c1c",
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
