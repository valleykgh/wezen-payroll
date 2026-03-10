"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const router = express_1.default.Router();
function minutesBetween(a, b) {
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
function parseTimeOnDate(workDateISO, timeStr) {
    const s = (timeStr || "").trim();
    if (!s)
        throw new Error("Invalid time");
    if (s.includes("T")) {
        const d = new Date(s);
        if (Number.isNaN(d.getTime()))
            throw new Error(`Invalid datetime: ${s}`);
        return d;
    }
    const base = new Date(`${workDateISO}T00:00:00`);
    if (Number.isNaN(base.getTime()))
        throw new Error("Invalid workDate");
    const m24 = s.match(/^(\d{1,2}):(\d{2})$/);
    if (m24) {
        const hh = Number(m24[1]);
        const mm = Number(m24[2]);
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59)
            throw new Error("Invalid time");
        const d = new Date(base);
        d.setHours(hh, mm, 0, 0);
        return d;
    }
    const m12 = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (m12) {
        let hh = Number(m12[1]);
        const mm = Number(m12[2]);
        const ap = m12[3].toUpperCase();
        if (hh < 1 || hh > 12 || mm < 0 || mm > 59)
            throw new Error("Invalid time");
        if (ap === "AM") {
            if (hh === 12)
                hh = 0;
        }
        else {
            if (hh !== 12)
                hh += 12;
        }
        const d = new Date(base);
        d.setHours(hh, mm, 0, 0);
        return d;
    }
    throw new Error(`Unsupported time format: ${timeStr}`);
}
function splitDailyBuckets(payableMinutes) {
    const m = Math.max(0, Math.floor(payableMinutes));
    const regularCap = 8 * 60;
    const otCap = 12 * 60;
    const regularMinutes = Math.min(m, regularCap);
    const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
    const doubleMinutes = Math.max(0, m - otCap);
    return { regularMinutes, overtimeMinutes, doubleMinutes };
}
function fmtHHMM(totalMinutes) {
    const m = Math.max(0, Math.floor(totalMinutes));
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${hh}:${String(mm).padStart(2, "0")}`;
}
function calculateTimeEntryTotals(args) {
    const { workDate, punches, breaks, hourlyRateCents } = args;
    let workedMinutes = 0;
    for (const p of punches || []) {
        if (!p?.clockIn || !p?.clockOut)
            continue;
        const inAt = parseTimeOnDate(workDate, String(p.clockIn));
        let outAt = parseTimeOnDate(workDate, String(p.clockOut));
        if (outAt.getTime() <= inAt.getTime()) {
            outAt = new Date(outAt.getTime() + 24 * 60 * 60 * 1000);
        }
        workedMinutes += minutesBetween(inAt, outAt);
    }
    let breakMinutes = 0;
    for (const b of breaks || []) {
        if (!b?.startTime || !b?.endTime)
            continue;
        const startAt = parseTimeOnDate(workDate, String(b.startTime));
        let endAt = parseTimeOnDate(workDate, String(b.endTime));
        if (endAt.getTime() <= startAt.getTime()) {
            endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
        }
        breakMinutes += minutesBetween(startAt, endAt);
    }
    const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
    const buckets = splitDailyBuckets(payableMinutes);
    const rateCents = Number(hourlyRateCents || 0);
    const regularPayCents = Math.round((buckets.regularMinutes * rateCents) / 60);
    const overtimePayCents = Math.round((buckets.overtimeMinutes * rateCents * 1.5) / 60);
    const doublePayCents = Math.round((buckets.doubleMinutes * rateCents * 2) / 60);
    const grossPayCents = regularPayCents + overtimePayCents + doublePayCents;
    return {
        workedMinutes,
        breakMinutes,
        payableMinutes,
        regularMinutes: buckets.regularMinutes,
        overtimeMinutes: buckets.overtimeMinutes,
        doubleMinutes: buckets.doubleMinutes,
        regularPayCents,
        overtimePayCents,
        doublePayCents,
        grossPayCents,
    };
}
// GET /api/admin/payroll-correction/calc
router.get("/payroll-correction/calc", async (req, res) => {
    try {
        const employeeId = String(req.query.employeeId || "").trim();
        const workDate = String(req.query.workDate || "").trim();
        const shiftType = String(req.query.shiftType || "AM").trim();
        const punchesRaw = String(req.query.punches || "[]");
        const breaksRaw = String(req.query.breaks || "[]");
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!workDate) {
            return res.status(400).json({ error: "workDate required" });
        }
        const punches = JSON.parse(punchesRaw);
        const breaks = JSON.parse(breaksRaw);
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: employeeId },
            select: {
                id: true,
                hourlyRateCents: true,
            },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const calc = calculateTimeEntryTotals({
            workDate,
            shiftType,
            punches,
            breaks,
            hourlyRateCents: employee.hourlyRateCents,
        });
        return res.json({
            input: {
                workDate,
                shiftType,
                workedMinutes: calc.workedMinutes,
                breakMinutes: calc.breakMinutes,
                payableMinutes: calc.payableMinutes,
            },
            buckets: {
                regularMinutes: calc.regularMinutes,
                overtimeMinutes: calc.overtimeMinutes,
                doubleMinutes: calc.doubleMinutes,
                regular_HHMM: fmtHHMM(calc.regularMinutes),
                overtime_HHMM: fmtHHMM(calc.overtimeMinutes),
                double_HHMM: fmtHHMM(calc.doubleMinutes),
            },
            pay: {
                hourlyRateCents: employee.hourlyRateCents,
                regularPayCents: calc.regularPayCents,
                overtimePayCents: calc.overtimePayCents,
                doublePayCents: calc.doublePayCents,
                grossPayCents: calc.grossPayCents,
            },
            display: {
                payableHours_HHMM: fmtHHMM(calc.payableMinutes),
            },
        });
    }
    catch (e) {
        console.error("GET /api/admin/payroll-correction/calc failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to calculate payroll correction" });
    }
});
// POST /api/admin/payroll-corrections
router.post("/payroll-corrections", async (req, res) => {
    try {
        const { payrollRunId, payrollRunSnapshotId, employeeId, workDate, reason, originalSnapshotJson, correctedInputJson, correctedResultJson, adjustmentAmountCents, } = req.body || {};
        const runId = String(payrollRunId || "").trim();
        const snapshotId = String(payrollRunSnapshotId || "").trim();
        const empId = String(employeeId || "").trim();
        const workDateStr = String(workDate || "").trim();
        const reasonStr = String(reason || "").trim();
        const deltaCents = Number(adjustmentAmountCents);
        if (!runId)
            return res.status(400).json({ error: "payrollRunId required" });
        if (!snapshotId)
            return res.status(400).json({ error: "payrollRunSnapshotId required" });
        if (!empId)
            return res.status(400).json({ error: "employeeId required" });
        if (!workDateStr)
            return res.status(400).json({ error: "workDate required" });
        if (!reasonStr)
            return res.status(400).json({ error: "reason required" });
        if (!Number.isFinite(deltaCents) || deltaCents === 0) {
            return res.status(400).json({ error: "adjustmentAmountCents must be a non-zero number" });
        }
        const snapshot = await prisma_1.prisma.payrollRunEntrySnapshot.findFirst({
            where: {
                id: snapshotId,
                payrollRunId: runId,
                employeeId: empId,
            },
            select: {
                id: true,
                payrollRunId: true,
                employeeId: true,
            },
        });
        if (!snapshot) {
            return res.status(404).json({ error: "Payroll snapshot not found" });
        }
        const existingCorrection = await prisma_1.prisma.payrollCorrection.findFirst({
            where: {
                payrollRunSnapshotId: snapshotId,
            },
            select: {
                id: true,
                createdAt: true,
                adjustmentAmountCents: true,
            },
        });
        if (existingCorrection) {
            return res.status(409).json({
                error: "A correction already exists for this frozen snapshot.",
            });
        }
        const employee = await prisma_1.prisma.employee.findUnique({
            where: { id: empId },
            select: { id: true },
        });
        if (!employee) {
            return res.status(404).json({ error: "Employee not found" });
        }
        const createdById = req?.user?.sub
            ? String(req.user.sub)
            : (req?.user?.id ? String(req.user.id) : null);
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const adjustment = await tx.payrollAdjustment.create({
                data: {
                    employeeId: empId,
                    amountCents: Math.round(deltaCents),
                    reason: reasonStr,
                    payrollRunId: null,
                },
            });
            const correction = await tx.payrollCorrection.create({
                data: {
                    payrollRunId: runId,
                    payrollRunSnapshotId: snapshotId,
                    employeeId: empId,
                    workDate: new Date(`${workDateStr}T00:00:00.000Z`),
                    reason: reasonStr,
                    originalSnapshotJson,
                    correctedInputJson,
                    correctedResultJson,
                    adjustmentAmountCents: Math.round(deltaCents),
                    payrollAdjustmentId: adjustment.id,
                    createdById,
                },
            });
            return { adjustment, correction };
        });
        return res.json({
            ok: true,
            adjustment: result.adjustment,
            correction: result.correction,
        });
    }
    catch (e) {
        console.error("POST /api/admin/payroll-corrections failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to create payroll correction" });
    }
});
router.get("/payroll-runs/:runId/snapshots/:snapshotId/calc", async (req, res) => {
    try {
        const snapshotId = String(req.params.snapshotId || "");
        const snapshot = await prisma_1.prisma.payrollRunEntrySnapshot.findUnique({
            where: { id: snapshotId },
            include: {
                employee: {
                    select: {
                        hourlyRateCents: true,
                    },
                },
            },
        });
        if (!snapshot) {
            return res.status(404).json({ error: "Snapshot not found" });
        }
        const data = snapshot.snapshotJson || {};
        return res.json({
            snapshot,
            preview: {
                workedMinutes: data.workedMinutes,
                breakMinutes: data.breakMinutes,
                payableMinutes: data.payableMinutes,
                regularMinutes: data.regularMinutes,
                overtimeMinutes: data.overtimeMinutes,
                doubleMinutes: data.doubleMinutes,
                grossPayCents: data.grossPayCents,
            },
        });
    }
    catch (e) {
        console.error("snapshot calc failed:", e);
        res.status(500).json({ error: e.message });
    }
});
router.post("/payroll-runs/:runId/snapshots/:snapshotId/correct", async (req, res) => {
    try {
        const runId = String(req.params.runId);
        const snapshotId = String(req.params.snapshotId);
        const { reason, adjustmentAmountCents, correctedInputJson, correctedResultJson, } = req.body;
        const snapshot = await prisma_1.prisma.payrollRunEntrySnapshot.findUnique({
            where: { id: snapshotId },
        });
        if (!snapshot) {
            return res.status(404).json({ error: "Snapshot not found" });
        }
        const employeeId = snapshot.employeeId;
        const result = await prisma_1.prisma.$transaction(async (tx) => {
            const adjustment = await tx.payrollAdjustment.create({
                data: {
                    employeeId,
                    amountCents: adjustmentAmountCents,
                    reason,
                },
            });
            const correction = await tx.payrollCorrection.create({
                data: {
                    payrollRunId: runId,
                    payrollRunSnapshotId: snapshotId,
                    employeeId,
                    workDate: snapshot.workDate,
                    reason,
                    originalSnapshotJson: snapshot.snapshotJson,
                    correctedInputJson,
                    correctedResultJson,
                    adjustmentAmountCents,
                    payrollAdjustmentId: adjustment.id,
                },
            });
            return { adjustment, correction };
        });
        res.json(result);
    }
    catch (e) {
        console.error("snapshot correction failed:", e);
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
