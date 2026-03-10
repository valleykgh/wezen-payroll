"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.get("/time-entries", async (req, res) => {
    try {
        const { employeeId, from, to, status, q, page = "1", pageSize = "25" } = req.query;
        const take = Math.min(100, Math.max(1, Number(pageSize) || 25));
        const pageNum = Math.max(1, Number(page) || 1);
        const skip = (pageNum - 1) * take;
        const where = {};
        if (employeeId)
            where.employeeId = String(employeeId);
        const employeeIds = String(req.query.employeeIds || "").trim();
        if (!employeeId && employeeIds) {
            const ids = employeeIds
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
            if (ids.length)
                where.employeeId = { in: ids };
        }
        if (status)
            where.status = String(status);
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = (0, _shared_1.startOfDayUTC)(from);
            if (to)
                where.workDate.lt = (0, _shared_1.startOfNextDayUTC)(to);
        }
        if (q && q.trim()) {
            const s = q.trim();
            where.employee = {
                OR: [
                    { legalName: { contains: s, mode: "insensitive" } },
                    { preferredName: { contains: s, mode: "insensitive" } },
                    { email: { contains: s, mode: "insensitive" } },
                ],
            };
        }
        const [total, entries] = await Promise.all([
            prisma_1.prisma.timeEntry.count({ where }),
            prisma_1.prisma.timeEntry.findMany({
                where,
                orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
                skip,
                take,
                select: {
                    id: true,
                    employeeId: true,
                    facilityId: true,
                    workDate: true,
                    status: true,
                    shiftType: true,
                    minutesWorked: true,
                    breakMinutes: true,
                    startTime: true,
                    endTime: true,
                    notes: true,
                    punchKey: true,
                    punchesJson: true,
                    breaksJson: true,
                    employee: {
                        select: {
                            id: true,
                            legalName: true,
                            preferredName: true,
                            email: true,
                            hourlyRateCents: true,
                            billingRole: true,
                            title: true,
                        },
                    },
                    facility: { select: { id: true, name: true } },
                    breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
                },
            }),
        ]);
        const entriesWithComputed = entries.map((e) => {
            const breaks = Array.isArray(e.breaks) ? e.breaks : [];
            const computedBreakMinutes = breaks.length > 0
                ? breaks.reduce((sum, b) => sum + Number(b.minutes ?? 0), 0)
                : Number(e.breakMinutes ?? 0);
            const workedMinutes = Number(e.minutesWorked ?? 0);
            const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);
            const b = (0, _shared_1.splitDailyBuckets)(payableMinutes);
            const buckets = {
                regularMinutes: b.regularMinutes,
                overtimeMinutes: b.overtimeMinutes,
                doubleMinutes: b.doubleMinutes,
                regular_HHMM: (0, _shared_1.fmtHHMM)(b.regularMinutes),
                overtime_HHMM: (0, _shared_1.fmtHHMM)(b.overtimeMinutes),
                double_HHMM: (0, _shared_1.fmtHHMM)(b.doubleMinutes),
                regular_decimal: (0, _shared_1.minutesToDecimalHours)(b.regularMinutes),
                overtime_decimal: (0, _shared_1.minutesToDecimalHours)(b.overtimeMinutes),
                double_decimal: (0, _shared_1.minutesToDecimalHours)(b.doubleMinutes),
            };
            return {
                ...e,
                computedBreakMinutes,
                payableMinutes,
                totalHours_HHMM: (0, _shared_1.fmtHHMM)(payableMinutes),
                calculatedHours_decimal: (0, _shared_1.minutesToDecimalHours)(payableMinutes),
                buckets,
            };
        });
        return res.json({
            page: pageNum,
            pageSize: take,
            total,
            totalPages: Math.ceil(total / take),
            entries: entriesWithComputed,
        });
    }
    catch (e) {
        console.error("GET /api/admin/time-entries failed:", e);
        return res.status(500).json({ error: "Failed to list time entries" });
    }
});
router.get("/time-entry/calc", async (req, res) => {
    try {
        const workDate = String(req.query.workDate || "");
        const shiftType = String(req.query.shiftType || "");
        const punchesRaw = String(req.query.punches || "[]");
        const breaksRaw = String(req.query.breaks || "[]");
        if (!workDate || !shiftType) {
            return res.status(400).json({ error: "workDate and shiftType required" });
        }
        const punches = JSON.parse(punchesRaw);
        const breaks = JSON.parse(breaksRaw);
        const r = (0, _shared_1.computeWorkedMinutes)(workDate, punches);
        const computedBreaks = (0, _shared_1.computeBreakRows)(workDate, breaks);
        const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
        const payableMinutes = Math.max(0, r.workedMinutes - breakMinutes);
        const buckets = (0, _shared_1.splitDailyBuckets)(payableMinutes);
        const warnings = [];
        if (breakMinutes > r.workedMinutes)
            warnings.push("Break minutes exceed worked minutes");
        return res.json({
            input: {
                workDate,
                shiftType,
                workedMinutes: r.workedMinutes,
                breakMinutes,
                payableMinutes,
            },
            display: {
                totalHours_HHMM: (0, _shared_1.fmtHHMM)(payableMinutes),
                calculatedHours_decimal: (0, _shared_1.minutesToDecimalHours)(payableMinutes),
            },
            buckets: {
                regular_HHMM: (0, _shared_1.fmtHHMM)(buckets.regularMinutes),
                overtime_HHMM: (0, _shared_1.fmtHHMM)(buckets.overtimeMinutes),
                double_HHMM: (0, _shared_1.fmtHHMM)(buckets.doubleMinutes),
                regular_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.regularMinutes),
                overtime_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.overtimeMinutes),
                double_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.doubleMinutes),
            },
            warnings,
        });
    }
    catch (e) {
        console.error("GET /api/admin/time-entry/calc failed:", e);
        return res.status(400).json({ error: e?.message || "Invalid input" });
    }
});
router.get("/time-entry/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        if (!id)
            return res.status(400).json({ error: "id required" });
        const entry = await prisma_1.prisma.timeEntry.findUnique({
            where: { id },
            include: {
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        hourlyRateCents: true,
                        billingRole: true,
                        title: true,
                    },
                },
                facility: { select: { id: true, name: true } },
                breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
            },
        });
        if (!entry)
            return res.status(404).json({ error: "Time entry not found" });
        if (!entry.punchesJson && entry.startTime && entry.endTime) {
            entry.punchesJson = [
                {
                    clockIn: entry.startTime,
                    clockOut: entry.endTime,
                },
            ];
        }
        if (!entry.breaksJson && entry.breaks && entry.breaks.length > 0) {
            entry.breaksJson = entry.breaks.map((b) => ({
                startTime: b.startTime,
                endTime: b.endTime,
            }));
        }
        return res.json({ entry });
    }
    catch (e) {
        console.error("GET /api/admin/time-entry/:id failed:", e);
        return res.status(500).json({ error: "Failed to load time entry" });
    }
});
router.post("/time-entry", async (req, res) => {
    try {
        const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};
        if (!facilityId)
            return res.status(400).json({ error: "facilityId required" });
        if (!employeeId || !workDate || !shiftType) {
            return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
        }
        if (!Object.values(_shared_1.SHIFT_TYPE).includes(shiftType)) {
            return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
        }
        await (0, _shared_1.assertFacilityRateExists)({
            employeeId: String(employeeId),
            facilityId: String(facilityId),
            workDate: String(workDate),
        });
        const emp = await prisma_1.prisma.employee.findUnique({
            where: { id: String(employeeId) },
        });
        if (!emp)
            return res.status(404).json({ error: "Employee not found" });
        const ws = String(workDate);
        let workedMinutes = 0;
        let startTime = null;
        let endTime = null;
        let shiftTypeForDb = "AM";
        if (Array.isArray(segments) && segments.length === 2) {
            const s1 = segments[0];
            const s2 = segments[1];
            if (!s1?.shift || !s2?.shift) {
                return res.status(400).json({ error: "segments[].shift required" });
            }
            if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
                return res.status(400).json({ error: "segments[].punches required" });
            }
            const combined = `${s1.shift}+${s2.shift}`;
            if (combined !== shiftType) {
                return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
            }
            const a = (0, _shared_1.computeWorkedMinutes)(ws, s1.punches);
            const b = (0, _shared_1.computeWorkedMinutes)(ws, s2.punches);
            (0, _shared_1.validateTwoSegmentContinuity)({ shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut }, { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut });
            workedMinutes = a.workedMinutes + b.workedMinutes;
            startTime = a.firstIn;
            endTime = b.lastOut;
            shiftTypeForDb = s1.shift;
        }
        else {
            if (!Array.isArray(punches) || punches.length === 0) {
                return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
            }
            const r = (0, _shared_1.computeWorkedMinutes)(ws, punches);
            workedMinutes = r.workedMinutes;
            startTime = r.firstIn;
            endTime = r.lastOut;
            if (shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM") {
                shiftTypeForDb = shiftType.split("+")[0];
            }
            else {
                shiftTypeForDb = shiftType;
            }
        }
        const computedBreaks = (0, _shared_1.computeBreakRows)(ws, Array.isArray(breaks) ? breaks : []);
        const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
        if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
            return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
        }
        let createdById = req.user?.id ?? null;
        if (createdById) {
            const u = await prisma_1.prisma.user.findUnique({ where: { id: createdById }, select: { id: true } });
            if (!u)
                createdById = null;
        }
        const effectivePunches = Array.isArray(segments) && segments.length === 2
            ? [].concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
            : punches;
        const punchKey = (0, _shared_1.buildPunchKey)(effectivePunches, computedBreaks.map((b) => ({
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString(),
        })));
        const workDateDb = new Date(`${ws}T00:00:00`);
        const existing = await prisma_1.prisma.timeEntry.findFirst({
            where: {
                employeeId: String(employeeId),
                facilityId: String(facilityId),
                workDate: workDateDb,
                shiftType: shiftTypeForDb,
                punchKey,
            },
            select: { id: true, status: true },
        });
        if (existing) {
            return res.status(409).json({
                error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${existing.id}, status ${existing.status}).`,
            });
        }
        const entry = await prisma_1.prisma.timeEntry.create({
            data: {
                employeeId: String(employeeId),
                workDate: new Date(`${ws}T00:00:00`),
                facilityId: String(facilityId),
                shiftType: shiftTypeForDb,
                punchKey,
                minutesWorked: workedMinutes,
                breakMinutes,
                startTime: startTime ?? null,
                endTime: endTime ?? null,
                punchesJson: effectivePunches,
                breaksJson: (breaks ?? []),
                notes: notes ?? null,
                status: _shared_1.TIME_ENTRY_STATUS.DRAFT,
                createdById,
            },
            select: {
                id: true,
                employeeId: true,
                workDate: true,
                facilityId: true,
                shiftType: true,
                punchKey: true,
                minutesWorked: true,
                breakMinutes: true,
                startTime: true,
                endTime: true,
                punchesJson: true,
                breaksJson: true,
                notes: true,
                status: true,
                facility: { select: { id: true, name: true } },
                employee: {
                    select: {
                        id: true,
                        legalName: true,
                        preferredName: true,
                        email: true,
                        hourlyRateCents: true,
                        title: true,
                    },
                },
                createdById: true,
                createdAt: true,
            },
        });
        if (computedBreaks.length > 0) {
            await prisma_1.prisma.timeEntryBreak.createMany({
                data: computedBreaks.map((b) => ({
                    timeEntryId: String(entry.id),
                    startTime: b.startTime,
                    endTime: b.endTime,
                    minutes: Number(b.minutes),
                })),
            });
        }
        const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
        const buckets = (0, _shared_1.splitDailyBuckets)(payableMinutes);
        return res.json({
            entry,
            breaksStored: computedBreaks.length,
            preview: {
                workedMinutes,
                breakMinutes,
                payableMinutes,
                totalHours_HHMM: (0, _shared_1.fmtHHMM)(payableMinutes),
                calculatedHours_decimal: (0, _shared_1.minutesToDecimalHours)(payableMinutes),
                buckets: {
                    regularMinutes: buckets.regularMinutes,
                    overtimeMinutes: buckets.overtimeMinutes,
                    doubleMinutes: buckets.doubleMinutes,
                    regular_HHMM: (0, _shared_1.fmtHHMM)(buckets.regularMinutes),
                    overtime_HHMM: (0, _shared_1.fmtHHMM)(buckets.overtimeMinutes),
                    double_HHMM: (0, _shared_1.fmtHHMM)(buckets.doubleMinutes),
                    regular_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.regularMinutes),
                    overtime_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.overtimeMinutes),
                    double_decimal: (0, _shared_1.minutesToDecimalHours)(buckets.doubleMinutes),
                },
            },
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry failed:", e);
        if (e?.code === "P2002") {
            return res.status(409).json({
                error: "Duplicate entry: this employee already has the same day/facility/shift with identical punches.",
            });
        }
        return res.status(400).json({
            error: e?.message || "Failed to create time entry",
        });
    }
});
router.patch("/time-entry/:id", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        if (!id)
            return res.status(400).json({ error: "id required" });
        const editable = await (0, _shared_1.assertEditableNotLocked)(id);
        if (!editable.ok)
            return res.status(editable.http).json({ error: editable.msg });
        const { employeeId, workDate, shiftType, punches, segments, breaks, notes, facilityId } = req.body || {};
        if (!facilityId)
            return res.status(400).json({ error: "facilityId required" });
        if (!employeeId || !workDate || !shiftType) {
            return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
        }
        if (!Object.values(_shared_1.SHIFT_TYPE).includes(shiftType)) {
            return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
        }
        await (0, _shared_1.assertFacilityRateExists)({
            employeeId: String(employeeId),
            facilityId: String(facilityId),
            workDate: String(workDate),
        });
        const emp = await prisma_1.prisma.employee.findUnique({
            where: { id: String(employeeId) },
        });
        if (!emp)
            return res.status(404).json({ error: "Employee not found" });
        const ws = String(workDate);
        let workedMinutes = 0;
        let startTime = null;
        let endTime = null;
        let shiftTypeForDb = "AM";
        if (Array.isArray(segments) && segments.length === 2) {
            const s1 = segments[0];
            const s2 = segments[1];
            if (!s1?.shift || !s2?.shift) {
                return res.status(400).json({ error: "segments[].shift required" });
            }
            if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches)) {
                return res.status(400).json({ error: "segments[].punches required" });
            }
            const combined = `${s1.shift}+${s2.shift}`;
            if (combined !== shiftType) {
                return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
            }
            const a = (0, _shared_1.computeWorkedMinutes)(ws, s1.punches);
            const b = (0, _shared_1.computeWorkedMinutes)(ws, s2.punches);
            (0, _shared_1.validateTwoSegmentContinuity)({ shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut }, { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut });
            workedMinutes = a.workedMinutes + b.workedMinutes;
            startTime = a.firstIn;
            endTime = b.lastOut;
            shiftTypeForDb = s1.shift;
        }
        else {
            if (!Array.isArray(punches) || punches.length === 0) {
                return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
            }
            const r = (0, _shared_1.computeWorkedMinutes)(ws, punches);
            workedMinutes = r.workedMinutes;
            startTime = r.firstIn;
            endTime = r.lastOut;
            if (shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM") {
                shiftTypeForDb = shiftType.split("+")[0];
            }
            else {
                shiftTypeForDb = shiftType;
            }
        }
        const computedBreaks = (0, _shared_1.computeBreakRows)(ws, Array.isArray(breaks) ? breaks : []);
        const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
        if (workedMinutes >= 16 * 60 && computedBreaks.length < 2) {
            return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
        }
        const effectivePunches = Array.isArray(segments) && segments.length === 2
            ? [].concat((segments[0]?.punches ?? []), (segments[1]?.punches ?? []))
            : punches;
        const punchKey = (0, _shared_1.buildPunchKey)(effectivePunches, computedBreaks.map((b) => ({
            startTime: b.startTime.toISOString(),
            endTime: b.endTime.toISOString(),
        })));
        const workDateDb = new Date(`${ws}T00:00:00`);
        const dup = await prisma_1.prisma.timeEntry.findFirst({
            where: {
                id: { not: id },
                employeeId: String(employeeId),
                facilityId: String(facilityId),
                workDate: workDateDb,
                shiftType: shiftTypeForDb,
                punchKey,
            },
            select: { id: true, status: true },
        });
        if (dup) {
            return res.status(409).json({
                error: `Duplicate shift: same timings already exist for this employee at this facility on ${ws} (entry ${dup.id}, status ${dup.status}).`,
            });
        }
        const data = {
            employeeId: String(employeeId),
            facilityId: String(facilityId),
            workDate: workDateDb,
            shiftType: shiftTypeForDb,
            punchKey,
            minutesWorked: workedMinutes,
            breakMinutes,
            startTime,
            endTime,
            notes: notes ?? null,
            punchesJson: effectivePunches,
            breaksJson: computedBreaks.map((b) => ({
                startTime: b.startTime.toISOString(),
                endTime: b.endTime.toISOString(),
            })),
        };
        if (req.body.status) {
            data.status = String(req.body.status);
        }
        const updated = await prisma_1.prisma.timeEntry.update({
            where: { id },
            data,
            select: {
                id: true,
                employeeId: true,
                facilityId: true,
                workDate: true,
                shiftType: true,
                status: true,
                minutesWorked: true,
                breakMinutes: true,
                startTime: true,
                endTime: true,
                notes: true,
                punchKey: true,
                punchesJson: true,
                breaksJson: true,
                facility: { select: { id: true, name: true } },
                employee: { select: { id: true, legalName: true, preferredName: true, email: true } },
            },
        });
        await prisma_1.prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });
        if (computedBreaks.length > 0) {
            await prisma_1.prisma.timeEntryBreak.createMany({
                data: computedBreaks.map((b) => ({
                    timeEntryId: id,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    minutes: b.minutes,
                })),
            });
        }
        return res.json({ entry: updated, breaksStored: computedBreaks.length });
    }
    catch (e) {
        console.error("PATCH /api/admin/time-entry/:id failed:", e);
        if (e?.code === "P2002") {
            return res.status(409).json({ error: "Duplicate entry constraint hit." });
        }
        return res.status(e?.status || 400).json({ error: e?.message || "Failed to update time entry" });
    }
});
router.post("/time-entry/:id/breaks", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        if (!id)
            return res.status(400).json({ error: "id required" });
        const editable = await (0, _shared_1.assertEditableNotLocked)(id);
        if (!editable.ok)
            return res.status(editable.http).json({ error: editable.msg });
        const { workDate, breaks } = req.body || {};
        if (!workDate)
            return res.status(400).json({ error: "workDate required" });
        const ws = String(workDate);
        const computed = (0, _shared_1.computeBreakRows)(ws, Array.isArray(breaks) ? breaks : []);
        await prisma_1.prisma.timeEntryBreak.deleteMany({ where: { timeEntryId: id } });
        if (computed.length > 0) {
            await prisma_1.prisma.timeEntryBreak.createMany({
                data: computed.map((b) => ({
                    timeEntryId: id,
                    startTime: b.startTime,
                    endTime: b.endTime,
                    minutes: b.minutes,
                })),
            });
        }
        const breakMinutes = computed.reduce((sum, b) => sum + b.minutes, 0);
        await prisma_1.prisma.timeEntry.update({
            where: { id },
            data: { breakMinutes },
        });
        return res.json({ ok: true, breakMinutes, breaksStored: computed.length });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry/:id/breaks failed:", e);
        return res.status(e?.status || 400).json({ error: e?.message || "Failed to update breaks" });
    }
});
router.post("/time-entry/approve-week", async (req, res) => {
    try {
        const employeeId = String(req.body.employeeId || "").trim();
        const startDate = String(req.body.startDate || "").trim();
        const endDate = String(req.body.endDate || "").trim();
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
        }
        const fromDt = (0, _shared_1.startOfDayUTC)(startDate);
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(endDate);
        const result = await prisma_1.prisma.timeEntry.updateMany({
            where: {
                employeeId,
                workDate: {
                    gte: fromDt,
                    lt: toExclusive,
                },
                status: "DRAFT",
            },
            data: {
                status: "APPROVED",
            },
        });
        return res.json({
            ok: true,
            employeeId,
            startDate,
            endDate,
            approvedCount: result.count,
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry/approve-week failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to approve week" });
    }
});
router.post("/time-entry/lock-week", async (req, res) => {
    try {
        const employeeId = String(req.body.employeeId || "").trim();
        const startDate = String(req.body.startDate || "").trim();
        const endDate = String(req.body.endDate || "").trim();
        if (!employeeId) {
            return res.status(400).json({ error: "employeeId required" });
        }
        if (!startDate || !endDate) {
            return res.status(400).json({ error: "startDate and endDate required (YYYY-MM-DD)" });
        }
        const fromDt = (0, _shared_1.startOfDayUTC)(startDate);
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(endDate);
        const result = await prisma_1.prisma.timeEntry.updateMany({
            where: {
                employeeId,
                workDate: {
                    gte: fromDt,
                    lt: toExclusive,
                },
                status: {
                    in: ["DRAFT", "APPROVED"],
                },
            },
            data: {
                status: "LOCKED",
            },
        });
        return res.json({
            ok: true,
            employeeId,
            startDate,
            endDate,
            lockedCount: result.count,
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry/lock-week failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to lock week" });
    }
});
router.post("/time-entries/approve", async (req, res) => {
    try {
        const { from, to } = req.body || {};
        if (!from || !to)
            return res.status(400).json({ error: "from and to are required" });
        const fromDt = (0, _shared_1.startOfDayUTC)(String(from));
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(String(to));
        const r = await prisma_1.prisma.timeEntry.updateMany({
            where: {
                status: "DRAFT",
                workDate: { gte: fromDt, lt: toExclusive },
            },
            data: { status: "APPROVED" },
        });
        return res.json({ approvedCount: r.count });
    }
    catch (e) {
        console.error("POST /api/admin/time-entries/approve failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to approve entries" });
    }
});
router.post("/time-entries/approve-selected", async (req, res) => {
    try {
        const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];
        if (entryIds.length === 0) {
            return res.status(400).json({ error: "entryIds required" });
        }
        const result = await prisma_1.prisma.timeEntry.updateMany({
            where: {
                id: { in: entryIds },
                status: "DRAFT",
            },
            data: {
                status: "APPROVED",
            },
        });
        return res.json({
            ok: true,
            approvedCount: result.count,
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entries/approve-selected failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to approve selected entries" });
    }
});
router.post("/time-entries/lock-selected", async (req, res) => {
    try {
        const entryIds = Array.isArray(req.body?.entryIds) ? req.body.entryIds.map(String) : [];
        if (entryIds.length === 0) {
            return res.status(400).json({ error: "entryIds required" });
        }
        const result = await prisma_1.prisma.timeEntry.updateMany({
            where: {
                id: { in: entryIds },
                status: { in: ["DRAFT", "APPROVED"] },
            },
            data: {
                status: "LOCKED",
            },
        });
        return res.json({
            ok: true,
            lockedCount: result.count,
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entries/lock-selected failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to lock selected entries" });
    }
});
exports.default = router;
