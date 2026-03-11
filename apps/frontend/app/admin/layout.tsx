"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AdminGuard from "../components/AdminGuard";
import AdminLayoutClient from "./AdminLayoutClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Allow login page without admin layout or guard
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <AdminGuard>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AdminGuard>
  );
}
