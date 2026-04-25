import { meRequest } from "@/lib/auth-client";
import { redirect } from "next/navigation";

export default async function AppLandingPage() {
  try {
    const res = await meRequest();
    const role = res.data.role;

    if (role === "PROFESSIONAL") {
      redirect("/app/worker");
    }

    if (role === "FACILITY_ADMIN") {
      redirect("/app/facility");
    }

    if (role === "INTERNAL_ADMIN") {
      redirect("/app/admin");
    }

    return (
      <div className="p-5">
        <p>Unknown role</p>
      </div>
    );
  } catch (err) {
    // Not logged in OR API failed
    return (
      <div className="p-5">
        <p>Not authenticated — redirecting to login...</p>
        {redirect("/login")}
      </div>
    );
  }
}
