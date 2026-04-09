"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import { setSession, type AuthedUser } from "../lib/auth";

type MeResp = {
  user: AuthedUser;
  mustChangePassword?: boolean;
};

export default function EmployeeGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function check() {
      if (pathname === "/employee/login") {
        setChecked(true);
        return;
      }

      try {
        const data = await apiFetch<MeResp>("/api/auth/me");

        if (data.user.role !== "EMPLOYEE") {
          router.replace("/admin/login");
          return;
        }

        setSession(data.user);
        setChecked(true);
      } catch {
        router.replace("/employee/login");
      }
    }

    check();
  }, [pathname, router]);

  if (!checked) return <div style={{ padding: 16 }}>Loading…</div>;

  return <>{children}</>;
}
