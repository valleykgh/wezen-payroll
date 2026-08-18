import express from "express";
import multer from "multer";
import { requireAuth, requireRole } from "../../middleware/authMiddleware";
import {
  generatePaystubWorkbook,
  parsePayrollWorkbooks,
  recordsFor,
  summarize,
} from "../../services/paystubGenerator";
import { generateUploadedPaystubPdf } from "../../services/uploadedPaystubPdf";
import { sendPaystubEmail } from "../../lib/email";
import { queueOneDrivePayrollSync } from "../../services/oneDrivePayrollSync";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 60, fileSize: 20 * 1024 * 1024, fieldSize: 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, /\.xlsx$/i.test(file.originalname));
  },
});

router.use(requireAuth, requireRole("SUPER_ADMIN", "PAYROLL_ADMIN", "HR_ADMIN"));

router.post("/paystub-generator/sync-onedrive", async (_req, res) => {
  try {
    const started = queueOneDrivePayrollSync();
    res.setHeader("Cache-Control", "no-store, private");
    return res.status(202).json({ started, message: started ? "OneDrive payroll synchronization started" : "A OneDrive payroll synchronization is already running" });
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/sync-onedrive failed", error);
    return res.status(500).json({ error: error?.message || "Failed to synchronize OneDrive payroll" });
  }
});

function uploadedFiles(req: express.Request) {
  return ((req.files as Express.Multer.File[]) || []).map((file) => ({
    originalname: file.originalname,
    buffer: file.buffer,
  }));
}

function selection(req: express.Request) {
  const employee = String(req.body.employee || "").trim();
  const year = Number(req.body.year);
  if (!employee || !Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { employee, year };
}

function candidateDetails(req: express.Request) {
  const addressLine1 = String(req.body.addressLine1 || "").trim();
  const addressLine2 = String(req.body.addressLine2 || "").trim();
  const ssnLast4 = String(req.body.ssnLast4 || "").trim();
  const employeeId = String(req.body.employeeId || "").trim();
  if (!addressLine1 || !addressLine2 || !/^\d{4}$/.test(ssnLast4) || !employeeId) return null;
  return { addressLine1, addressLine2, ssnLast4, employeeId };
}

router.post("/paystub-generator/scan", upload.array("files", 60), async (req, res) => {
  try {
    const files = uploadedFiles(req);
    if (!files.length) return res.status(400).json({ error: "Select at least one .xlsx payroll file" });
    const parsed = await parsePayrollWorkbooks(files);
    return res.json({ employees: parsed.employees, warnings: parsed.warnings });
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/scan failed", error);
    return res.status(500).json({ error: error?.message || "Failed to scan payroll files" });
  }
});

router.post("/paystub-generator/preview", upload.array("files", 60), async (req, res) => {
  try {
    const files = uploadedFiles(req);
    const selected = selection(req);
    if (!files.length) return res.status(400).json({ error: "Select at least one .xlsx payroll file" });
    if (!selected) return res.status(400).json({ error: "Employee and valid payroll year are required" });
    const parsed = await parsePayrollWorkbooks(files);
    const records = recordsFor(parsed, selected.employee, selected.year);
    if (!records.length) return res.status(404).json({ error: "No paid rows found for that employee and year" });
    return res.json({ records, summary: summarize(records), warnings: parsed.warnings });
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/preview failed", error);
    return res.status(500).json({ error: error?.message || "Failed to preview paystubs" });
  }
});

router.post("/paystub-generator/workbook", upload.array("files", 60), async (req, res) => {
  try {
    const files = uploadedFiles(req);
    const selected = selection(req);
    const candidate = candidateDetails(req);
    if (!files.length) return res.status(400).json({ error: "Select at least one .xlsx payroll file" });
    if (!selected) return res.status(400).json({ error: "Employee and valid payroll year are required" });
    if (!candidate) return res.status(400).json({ error: "Candidate address, 4-digit SSN ending, and employee ID are required" });
    const parsed = await parsePayrollWorkbooks(files);
    const records = recordsFor(parsed, selected.employee, selected.year);
    if (!records.length) return res.status(404).json({ error: "No paid rows found for that employee and year" });
    const output = await generatePaystubWorkbook(selected.employee, selected.year, records, candidate);
    const safeName = selected.employee.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "employee";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-${selected.year}-paystubs.xlsx"`);
    res.setHeader("Cache-Control", "no-store, private");
    return res.send(output);
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/workbook failed", error);
    return res.status(500).json({ error: error?.message || "Failed to generate paystub workbook" });
  }
});

router.post("/paystub-generator/pdf", upload.array("files", 60), async (req, res) => {
  try {
    const files = uploadedFiles(req);
    const selected = selection(req);
    const candidate = candidateDetails(req);
    if (!files.length) return res.status(400).json({ error: "Select at least one .xlsx payroll file" });
    if (!selected) return res.status(400).json({ error: "Employee and valid payroll year are required" });
    if (!candidate) return res.status(400).json({ error: "Candidate address, 4-digit SSN ending, and employee ID are required" });
    const parsed = await parsePayrollWorkbooks(files);
    const records = recordsFor(parsed, selected.employee, selected.year);
    if (!records.length) return res.status(404).json({ error: "No paid rows found for that employee and year" });
    const output = await generateUploadedPaystubPdf(selected.employee, candidate, records);
    const safeName = selected.employee.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "employee";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}-${selected.year}-paystubs.pdf"`);
    res.setHeader("Content-Length", output.length);
    res.setHeader("Cache-Control", "no-store, private");
    return res.send(output);
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/pdf failed", error);
    return res.status(500).json({ error: error?.message || "Failed to generate paystub PDF" });
  }
});

router.post("/paystub-generator/email", upload.array("files", 60), async (req, res) => {
  try {
    const files = uploadedFiles(req);
    const selected = selection(req);
    const candidate = candidateDetails(req);
    const candidateEmail = String(req.body.candidateEmail || "").trim().toLowerCase();
    if (!files.length) return res.status(400).json({ error: "Select at least one .xlsx payroll file" });
    if (!selected) return res.status(400).json({ error: "Employee and valid payroll year are required" });
    if (!candidate) return res.status(400).json({ error: "Candidate address, 4-digit SSN ending, and employee ID are required" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail)) return res.status(400).json({ error: "A valid candidate email address is required" });

    const parsed = await parsePayrollWorkbooks(files);
    const records = recordsFor(parsed, selected.employee, selected.year);
    if (!records.length) return res.status(404).json({ error: "No paid rows found for that employee and year" });
    const pdf = await generateUploadedPaystubPdf(selected.employee, candidate, records);
    const safeName = selected.employee.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "employee";
    const fileName = `${safeName}-${selected.year}-paystubs.pdf`;
    await sendPaystubEmail({
      to: candidateEmail,
      employeeName: selected.employee,
      year: selected.year,
      fileName,
      pdf,
    });
    res.setHeader("Cache-Control", "no-store, private");
    return res.json({ ok: true, email: candidateEmail, fileName, payPeriods: records.length });
  } catch (error: any) {
    console.error("POST /api/admin/paystub-generator/email failed", error);
    return res.status(500).json({ error: error?.message || "Failed to email paystub PDF" });
  }
});

export default router;
