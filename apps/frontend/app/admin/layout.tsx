import React from "react";
import AdminGuard from "../components/AdminGuard";
import AdminLayoutClient from "./AdminLayoutClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminGuard>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AdminGuard>
  );
}
