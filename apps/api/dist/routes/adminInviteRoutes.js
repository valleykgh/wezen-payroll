"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const prisma_1 = require("../prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
const requireRole_1 = require("../middleware/requireRole");
const email_1 = require("../lib/email");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.requireAuth, (0, requireRole_1.requireRole)("SUPER_ADMIN", "HR_ADMIN"));
router.post("/employees/:employeeId/invite", async (req, res) => {
    try {
        const employeeId = String(req.params.employeeId);
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const token = crypto_1.default.randomBytes(32).toString("hex");
        const invite = await prisma_1.prisma.invite.create({
            data: {
                employeeId,
                email: employee.email,
                token,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdById: req.user?.id,
            },
        });
        const frontendBase = String(process.env.FRONTEND_URL || "https://payroll.wezenstaffing.com").replace(/\/+$/, "");
        const inviteUrl = `${frontendBase}/employee/setup-password?token=${token}`;
        let emailSent = false;
        let emailError = null;
        try {
            await (0, email_1.sendEmployeeInviteEmail)({
                to: employee.email,
                employeeName: employee.preferredName || employee.legalName,
                inviteUrl,
            });
            emailSent = true;
        }
        catch (e) {
            console.error("Invite email send failed:", e);
            emailError = e?.message || "Email send failed";
        }
        res.json({
            invite,
            inviteUrl,
            emailSent,
            emailError,
        });
    }
    catch (e) {
        console.error("Create invite failed:", e);
        res.status(500).json({ error: "Failed to create invite" });
    }
});
exports.default = router;
