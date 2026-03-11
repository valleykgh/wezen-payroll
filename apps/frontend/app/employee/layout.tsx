import React from "react";
import EmployeeGuard from "../components/EmployeeGuard";

export default function EmployeeLayout({ children }: { children: React.ReactNode }) {
  return <EmployeeGuard>{children}</EmployeeGuard>;
}
