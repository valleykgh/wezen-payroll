"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.adminRoutes = (0, express_1.Router)();
exports.adminRoutes.use(authMiddleware_1.requireAuth, authMiddleware_1.requireAdmin);
exports.adminRoutes.post("/admin/employees", async (req, res) => {
    const { fullName, email, hourlyRateCents } = req.body || {};
    if (!fullName || !email)
        return res.status(400).json({ error: "fullName and email required" });
    const employee = await prisma_1.prisma.employee.create({
        data: {
            fullName,
            email,
            hourlyRateCents: Number(hourlyRateCents || 0),
        },
    });
    res.json({ employee });
});
exports.adminRoutes.post("/admin/time-entries", async (req, res) => {
    const { employeeId, workDate, minutesWorked, breakMinutes } = req.body || {};
    if (!employeeId || !workDate || minutesWorked == null) {
        return res.status(400).json({ error: "employeeId, workDate, minutesWorked required" });
    }
    const entry = await prisma_1.prisma.timeEntry.create({
        data: {
            employeeId,
            workDate: new Date(workDate),
            minutesWorked: Number(minutesWorked),
            breakMinutes: Number(breakMinutes || 0),
            createdById: req.user.sub,
        },
    });
    res.json({ entry });
});
exports.adminRoutes.get("/admin/time-entries", async (req, res) => {
    const { employeeId, from, to } = req.query;
    const where = {};
    if (employeeId)
        where.employeeId = employeeId;
    if (from || to) {
        where.workDate = {};
        if (from)
            where.workDate.gte = new Date(from);
        if (to)
            where.workDate.lte = new Date(to);
    }
    const entries = await prisma_1.prisma.timeEntry.findMany({
        where,
        orderBy: { workDate: "desc" },
    });
    res.json({ entries });
});
