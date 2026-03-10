"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  mustChangePassword: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState("PAYROLL_ADMIN");
  const [createPassword, setCreatePassword] = useState("");

  async function loadUsers() {
    setLoading(true);
    try {
      const data = await apiFetch<{ users: User[] }>("/api/admin/users");
      setUsers(data.users);
    } catch (e) {
      console.error(e);
      alert("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser() {
    try {
      await apiFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          name: createName,
          email: createEmail,
          role: createRole,
          temporaryPassword: createPassword,
          active: true,
          mustChangePassword: true,
        }),
      });

      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");

      loadUsers();
    } catch (e) {
      console.error(e);
      alert("Failed to create user");
    }
  }

  async function toggleActive(user: User) {
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        active: !user.active,
      }),
    });

    loadUsers();
  }

  async function resetPassword(user: User) {
    const tempPassword = prompt("Enter temporary password");
    if (!tempPassword) return;

    await apiFetch(`/api/admin/users/${user.id}/reset-password`, {
      method: "POST",
      body: JSON.stringify({
        temporaryPassword: tempPassword,
      }),
    });

    alert("Password reset");
  }

  return (
    <div style={{ padding: 20, maxWidth: 900 }}>
      <h1>Admin Users</h1>

      <h3>Create Admin User</h3>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input
          placeholder="Name"
          value={createName}
          onChange={(e) => setCreateName(e.target.value)}
        />

        <input
          placeholder="Email"
          value={createEmail}
          onChange={(e) => setCreateEmail(e.target.value)}
        />

        <select
          value={createRole}
          onChange={(e) => setCreateRole(e.target.value)}
        >
          <option value="PAYROLL_ADMIN">PAYROLL_ADMIN</option>
          <option value="HR_ADMIN">HR_ADMIN</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN</option>
        </select>

        <input
          placeholder="Temp Password"
          value={createPassword}
          onChange={(e) => setCreatePassword(e.target.value)}
        />

        <button onClick={createUser}>Create</button>
      </div>

      <h3>Users</h3>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Email</th>
              <th align="left">Role</th>
              <th align="left">Active</th>
              <th />
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name || "-"}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{u.active ? "Yes" : "No"}</td>

                <td style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => toggleActive(u)}>
                    {u.active ? "Deactivate" : "Activate"}
                  </button>

                  <button onClick={() => resetPassword(u)}>
                    Reset Password
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
