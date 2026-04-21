import { Router } from "express";
import { sendEmail } from "../services/email";

const router = Router();

router.get("/test-email", async (_req, res) => {
  try {
    await sendEmail({
      to: "valleyk@wezenstaffing.com",
      subject: "SES test from Wezen Staffing",
      html: "<h1>SES is working</h1><p>This is a test email from staffing-api.</p>",
      text: "SES is working. This is a test email from staffing-api.",
    });

    return res.json({
      ok: true,
      message: "Test email sent",
    });
  } catch (error) {
    console.error("SES test-email failed:", error);

    return res.status(500).json({
      ok: false,
      error: "Failed to send test email",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
