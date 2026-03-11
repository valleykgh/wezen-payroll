"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const email_1 = require("../../lib/email");
const prisma_1 = require("../../prisma");
const auth_1 = require("../../auth");
const router = express_1.default.Router();
function requireFacilityPin(req) {
    const pin = String(req.headers["x-admin-pin"] || req.body?.pin || "").trim();
    const expected = String(process.env.ADMIN_OVERRIDE_PIN || "").trim();
    if (!expected) {
        const err = new Error("Admin PIN is not configured");
        err.status = 500;
        throw err;
    }
    if (!pin || pin !== expected) {
        const err = new Error("Invalid PIN");
        err.status = 403;
        throw err;
    }
}
// GET /api/admin/employees
// GET /api/admin/employees
router.get("/employees", async (req, res) => {
    try {
        const employees = await prisma_1.prisma.employee.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
                title: true,
                billingRole: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
                createdAt: true,
                updatedAt: true,
                user: {
                    select: {
                        id: true,
                    },
                },
                invites: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        expiresAt: true,
                        usedAt: true,
                        createdAt: true,
                    },
                },
            },
        });
        return res.json({ employees });
    }
    catch (e) {
        console.error("GET /api/admin/employees failed:", e);
        return res.status(500).json({ error: "Failed to load employees" });
    }
});
// POST /api/admin/employees
// POST /api/admin/employees
// POST /api/admin/employees
router.post("/employees", async (req, res) => {
    try {
        const { legalName, preferredName, hourlyRateCents, title, billingRole } = req.body || {};
        const email = String(req.body.email || "").trim().toLowerCase();
        const ssnLast4Raw = req.body.ssnLast4 == null ? "" : String(req.body.ssnLast4);
        const zipRaw = req.body.zip == null ? "" : String(req.body.zip);
        const ssnLast4 = ssnLast4Raw.replace(/\D/g, "");
        const zip = zipRaw.replace(/\D/g, "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: "Invalid email format" });
        }
        if (ssnLast4 && !/^\d{4}$/.test(ssnLast4)) {
            return res.status(400).json({ error: "SSN last 4 must be exactly 4 digits" });
        }
        if (zip && !/^\d{5}$/.test(zip)) {
            return res.status(400).json({ error: "Zip must be exactly 5 digits" });
        }
        const rawTitle = String(title ?? "").trim().toUpperCase();
        if (!legalName || !email || hourlyRateCents == null || !rawTitle) {
            return res.status(400).json({ error: "legalName, email, hourlyRateCents, title required" });
        }
        if (!["CNA", "LVN", "RN"].includes(rawTitle)) {
            return res.status(400).json({ error: "title must be CNA|LVN|RN" });
        }
        const employee = await prisma_1.prisma.employee.create({
            data: {
                legalName,
                preferredName: preferredName ?? null,
                email,
                hourlyRateCents: Number(hourlyRateCents),
                active: true,
                title: rawTitle,
                billingRole: billingRole ? String(billingRole) : rawTitle,
                addressLine1: req.body.addressLine1 || null,
                addressLine2: req.body.addressLine2 || null,
                city: req.body.city || null,
                state: req.body.stateProv || req.body.state || null,
                zip: zip || null,
                ssnLast4: ssnLast4 || null,
            },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
                title: true,
                billingRole: true,
            },
        });
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const invite = await prisma_1.prisma.invite.create({
            data: {
                employeeId: employee.id,
                email: employee.email,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdById: req.user?.id || null,
            },
            select: {
                id: true,
                token: true,
                expiresAt: true,
            },
        });
        const frontendBase = String(process.env.FRONTEND_URL || "https://payroll.wezenstaffing.com").replace(/\/+$/, "");
        const inviteUrl = `${frontendBase}/employee/setup-password?token=${invite.token}`;
        await (0, email_1.sendEmployeeInviteEmail)({
            to: employee.email,
            employeeName: employee.preferredName || employee.legalName,
            inviteUrl,
        });
        return res.json({ employee, inviteUrl });
    }
    catch (e) {
        if (e?.code === "P2002") {
            return res.status(409).json({
                error: "Employee already exists (duplicate email or unique field).",
            });
        }
        console.error("POST /api/admin/employees failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to create employee" });
    }
});
// PATCH /api/admin/employees/:id
router.patch("/employees/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const existing = await prisma_1.prisma.employee.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const data = {};
        if (req.body.legalName !== undefined)
            data.legalName = String(req.body.legalName || "").trim();
        if (req.body.preferredName !== undefined)
            data.preferredName = String(req.body.preferredName || "").trim() || null;
        if (req.body.email !== undefined)
            data.email = String(req.body.email || "").trim().toLowerCase();
        if (req.body.title !== undefined)
            data.title = String(req.body.title || "").trim().toUpperCase();
        if (req.body.billingRole !== undefined)
            data.billingRole = String(req.body.billingRole || "").trim() || null;
        if (req.body.hourlyRateCents !== undefined)
            data.hourlyRateCents = Number(req.body.hourlyRateCents) || 0;
        if (typeof req.body.active === "boolean")
            data.active = req.body.active;
        if (req.body.addressLine1 !== undefined)
            data.addressLine1 = req.body.addressLine1 || null;
        if (req.body.addressLine2 !== undefined)
            data.addressLine2 = req.body.addressLine2 || null;
        if (req.body.city !== undefined)
            data.city = req.body.city || null;
        if (req.body.state !== undefined)
            data.state = req.body.state || null;
        if (req.body.zip !== undefined)
            data.zip = req.body.zip ? String(req.body.zip).replace(/\D/g, "") : null;
        if (req.body.ssnLast4 !== undefined)
            data.ssnLast4 = req.body.ssnLast4 ? String(req.body.ssnLast4).replace(/\D/g, "") : null;
        const employee = await prisma_1.prisma.employee.update({
            where: { id },
            data,
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
                title: true,
                billingRole: true,
                addressLine1: true,
                addressLine2: true,
                city: true,
                state: true,
                zip: true,
                ssnLast4: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.json({ ok: true, employee });
    }
    catch (e) {
        console.error("PATCH /api/admin/employees/:id failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to update employee" });
    }
});
// POST /api/admin/employees/:id/deactivate
router.post("/employees/:id/deactivate", async (req, res) => {
    try {
        requireFacilityPin(req);
        const id = String(req.params.id || "");
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const existing = await prisma_1.prisma.employee.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const employee = await prisma_1.prisma.employee.update({
            where: { id },
            data: { active: false },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
                title: true,
                billingRole: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.json({ ok: true, employee });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/employees/:id/deactivate failed:", e);
        return res.status(status).json({ error: e?.message || "Failed to deactivate employee" });
    }
});
// POST /api/admin/employees/:id/restore
router.post("/employees/:id/restore", async (req, res) => {
    try {
        requireFacilityPin(req);
        const id = String(req.params.id || "");
        if (!id) {
            return res.status(400).json({ error: "id required" });
        }
        const existing = await prisma_1.prisma.employee.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const employee = await prisma_1.prisma.employee.update({
            where: { id },
            data: { active: true },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
                title: true,
                billingRole: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return res.json({ ok: true, employee });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/employees/:id/restore failed:", e);
        return res.status(status).json({ error: e?.message || "Failed to restore employee" });
    }
});
// POST /api/admin/dev/employee-token
router.post("/dev/employee-token", async (req, res) => {
    try {
        const employeeId = String(req.body.employeeId || "");
        if (!employeeId)
            return res.status(400).json({ error: "employeeId required" });
        const user = await prisma_1.prisma.user.findFirst({
            where: { employeeId },
            select: { id: true, role: true, employeeId: true },
        });
        if (!user) {
            return res.status(404).json({
                error: "No user found for this employeeId (invite not accepted / user not created yet)",
            });
        }
        const secret = process.env.JWT_SECRET;
        if (!secret)
            return res.status(500).json({ error: "JWT_SECRET not set" });
        const token = (0, auth_1.signToken)({
            sub: user.id,
            role: user.role,
            employeeId: user.employeeId,
        });
        return res.json({ token });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: "Failed to generate token" });
    }
});
exports.default = router;
