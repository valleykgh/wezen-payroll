"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "../lib/auth";

export default function EmployeeGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const user = getUser();

    if (!user) {
      router.replace("/employee/login");
    } else if (user.role !== "EMPLOYEE") {
      router.replace("/admin/time-entry");
    }

    setChecked(true);
  }, [router]);

  if (!checked) return <div style={{ padding: 16 }}>Loading…</div>;

  return <>{children}</>;
}
