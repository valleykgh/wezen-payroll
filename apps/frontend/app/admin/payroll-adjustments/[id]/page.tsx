"use client";

import { useParams } from "next/navigation";
import PayrollAdjustmentsPage from "../page";

export default function PayrollAdjustmentByIdPage() {
  const params = useParams();
  const id = String(params?.id || "");

  return <PayrollAdjustmentsPage editId={id} />;
}
