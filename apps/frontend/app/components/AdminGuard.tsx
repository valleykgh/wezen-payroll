"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken, getUser, setUser, type AuthedUser } from "../lib/auth";

function decodeJwt(token: string): any | null {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

function isExpired(token: string): boolean {
  const p = decodeJwt(token);
  const exp = Number(p?.exp || 0);
  if (!exp) return false; // if no exp, don't force logout
  return Date.now() >= exp * 1000;
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // never guard login
    if (pathname === "/admin/login") {
      setReady(true);
      return;
    }

    const token = getToken();
    if (!token) {
      router.replace("/admin/login");
      return;
    }

    if (isExpired(token)) {
      // clear storage so it doesn't keep looping
      localStorage.removeItem("payroll_token");
      localStorage.removeItem("payroll_user");
      router.replace("/admin/login");
      return;
    }

    const payload = decodeJwt(token);
    const user = getUser();

    // Determine role from user OR token payload (single source of truth)
    const role = String(user?.role ?? payload?.role ?? "");

    // If localStorage user missing but token has info, rebuild it
    if (!user && payload?.sub && payload?.role) {
      const rebuilt: AuthedUser = {
        id: String(payload.sub),
        email: String(payload.email ?? ""), // may be empty
        role: payload.role,
        employeeId: payload.employeeId ?? null,
        mustChangePassword: payload.mustChangePassword ?? undefined,
      };
      setUser(rebuilt);
    }

    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      router.replace("/admin/login");
      return;
    }

    setReady(true);
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
