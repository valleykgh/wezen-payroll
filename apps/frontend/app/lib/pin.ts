import { apiFetch } from "./api";

export async function verifyAdminPinWithPrompt(message = "Enter admin PIN") {
  const pin = window.prompt(message);

  if (!pin) {
    throw new Error("PIN required");
  }

  await apiFetch("/api/admin/verify-pin", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });

  localStorage.setItem("admin_override_pin", pin);

  return true;
}
