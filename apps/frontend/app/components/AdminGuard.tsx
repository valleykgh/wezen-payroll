"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { setSession, type AuthedUser } from "../lib/auth";

type MeResp = {
  user: AuthedUser;
  mustChangePassword?: boolean;
};

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    async function check() {
      if (pathname === "/admin/login") {
        setReady(true);
        return;
      }

      try {
        const data = await apiFetch<MeResp>("/api/auth/me");
        const role = String(data.user.role || "").toUpperCase();

        const isAdminRole =
          role === "SUPER_ADMIN" ||
          role === "PAYROLL_ADMIN" ||
          role === "HR_ADMIN";

        if (!isAdminRole) {
          router.replace("/admin/login");
          return;
        }

        setSession(data.user);
        setReady(true);
      } catch {
        router.replace("/admin/login");
      }
    }

    check();
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
