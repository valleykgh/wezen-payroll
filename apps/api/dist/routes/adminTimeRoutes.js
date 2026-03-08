"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminTimeRoutes = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const authMiddleware_1 = require("../middleware/authMiddleware");
exports.adminTimeRoutes = (0, express_1.Router)();
/**
 * Admin gate middleware (must call next())
 */
function requireAdmin(req, res, next) {
    if (req.user?.role !== "ADMIN") {
        return res.status(403).json({ error: "Admin only" });
    }
    return next();
}
exports.adminTimeRoutes.use(authMiddleware_1.requireAuth, requireAdmin);
// Local enums (avoid Prisma enum export issues)
const TIME_ENTRY_STATUS = {
    DRAFT: "DRAFT",
    APPROVED: "APPROVED",
    LOCKED: "LOCKED",
};
const SHIFT_TYPE = {
    AM: "AM",
    PM: "PM",
    NOC: "NOC",
    AM_PM: "AM+PM",
    PM_NOC: "PM+NOC",
    NOC_AM: "NOC+AM",
};
const MAX_GAP_MINUTES = 120;
/**
 * Helpers
 */
function parseTimeOnDate(workDateISO, timeStr) {
    const s = (timeStr || "").trim();
    if (!s)
        throw new Error("Invalid time");
    // ISO datetime
    if (s.includes("T")) {
        const d = new Date(s);
        if (Number.isNaN(d.getTime()))
            throw new Error(`Invalid datetime: ${s}`);
        return d;
    }
    const base = new Date(`${workDateISO}T00:00:00`);
    if (Number.isNaN(base.getTime()))
        throw new Error("Invalid workDate");
    // 24h "H:MM" or "HH:MM"
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
    // 12h "H:MM AM/PM"
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
function minutesBetween(a, b) {
    return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}
function fmtHHMM(totalMinutes) {
    const m = Math.max(0, Math.floor(totalMinutes));
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    return `${hh}:${String(mm).padStart(2, "0")}`;
}
function minutesToDecimalHours(min) {
    // “0-100” style payroll hours (decimal)
    return Math.round((min / 60) * 100) / 100;
}
/**
 * Daily buckets:
 * First 8h regular, next 4h OT (1.5x), >12h double (2x)
 */
function splitDailyBuckets(payableMinutes) {
    const m = Math.max(0, Math.floor(payableMinutes));
    const regularCap = 8 * 60;
    const otCap = 12 * 60;
    const regularMinutes = Math.min(m, regularCap);
    const overtimeMinutes = Math.max(0, Math.min(m, otCap) - regularCap);
    const doubleMinutes = Math.max(0, m - otCap);
    return { regularMinutes, overtimeMinutes, doubleMinutes };
}
/**
 * Adjacent shift pairs that CAN be combined:
 * AM+PM, PM+NOC, NOC+AM
 * Explicitly NOT combinable: AM+NOC (even if within 120 min)
 */
function isCombinablePair(a, b) {
    if ((a === "AM" && b === "NOC") || (a === "NOC" && b === "AM"))
        return false;
    return ((a === "AM" && b === "PM") ||
        (a === "PM" && b === "NOC") ||
        (a === "NOC" && b === "AM"));
}
/**
 * Compute total worked minutes + range from punches (supports cross-midnight)
 */
function computeWorkedMinutes(workDate, punches) {
    if (!Array.isArray(punches) || punches.length === 0)
        throw new Error("punches required");
    let worked = 0;
    let firstIn = null;
    let lastOut = null;
    for (const p of punches) {
        if (!p?.clockIn || !p?.clockOut)
            throw new Error("Each punch must include clockIn and clockOut");
        const cin = parseTimeOnDate(workDate, String(p.clockIn));
        let cout = parseTimeOnDate(workDate, String(p.clockOut));
        if (cout.getTime() <= cin.getTime()) {
            cout = new Date(cout.getTime() + 24 * 60 * 60 * 1000);
        }
        if (!firstIn || cin.getTime() < firstIn.getTime())
            firstIn = cin;
        if (!lastOut || cout.getTime() > lastOut.getTime())
            lastOut = cout;
        worked += minutesBetween(cin, cout);
    }
    return { workedMinutes: worked, firstIn: firstIn, lastOut: lastOut };
}
function validateTwoSegmentContinuity(a, b) {
    if (!isCombinablePair(a.shift, b.shift)) {
        throw new Error(`Shifts ${a.shift} and ${b.shift} are not continuous. Create separate entries (no OT/DT across).`);
    }
    const gap = minutesBetween(a.lastOut, b.firstIn);
    if (gap > MAX_GAP_MINUTES) {
        throw new Error(`Gap ${gap} minutes > ${MAX_GAP_MINUTES}. Not continuous; create separate entries.`);
    }
    return gap;
}
/**
 * Compute break rows (no auto breaks) from input breaks[]
 * - supports cross-midnight
 * - rejects any break < 30 minutes
 */
function computeBreakRows(workDate, breaks) {
    if (!Array.isArray(breaks))
        return [];
    const rows = [];
    for (const b of breaks) {
        if (!b?.startTime || !b?.endTime)
            throw new Error("Each break must include startTime and endTime");
        const bs = parseTimeOnDate(workDate, String(b.startTime));
        let be = parseTimeOnDate(workDate, String(b.endTime));
        if (be.getTime() <= bs.getTime()) {
            be = new Date(be.getTime() + 24 * 60 * 60 * 1000);
        }
        const mins = minutesBetween(bs, be);
        if (mins < 30)
            throw new Error("Each break must be at least 30 minutes");
        rows.push({ startTime: bs, endTime: be, minutes: mins });
    }
    return rows;
}
async function assertEditableDraft(timeEntryId) {
    const entry = await prisma_1.prisma.timeEntry.findUnique({
        where: { id: timeEntryId },
        select: { id: true, status: true, workDate: true },
    });
    if (!entry)
        return { ok: false, http: 404, msg: "Time entry not found" };
    if (entry.status === "LOCKED") {
        return { ok: false, http: 409, msg: "Time entry is LOCKED and cannot be modified" };
    }
    if (entry.status === "APPROVED") {
        return { ok: false, http: 409, msg: "Time entry is APPROVED and cannot be modified" };
    }
    return { ok: true, entry };
}
async function assertEditable(timeEntryId) {
    const entry = await prisma_1.prisma.timeEntry.findUnique({
        where: { id: timeEntryId },
        select: { id: true, status: true },
    });
    if (!entry) {
        return { ok: false, http: 404, msg: "Time entry not found" };
    }
    if (entry.status === "LOCKED") {
        return {
            ok: false,
            http: 409,
            msg: "Time entry is LOCKED and cannot be modified",
        };
    }
    if (entry.status === "APPROVED") {
        return { ok: false, http: 409, msg: "Time entry is APPROVED and cannot be modified" };
    }
    return { ok: true };
}
/**
 * POST /employees
 * Full path: POST /api/admin/employees
 */
exports.adminTimeRoutes.post("/employees", async (req, res) => {
    try {
        const { legalName, preferredName, email, hourlyRateCents } = req.body || {};
        if (!legalName || !email || hourlyRateCents == null) {
            return res.status(400).json({ error: "legalName, email, hourlyRateCents required" });
        }
        const employee = await prisma_1.prisma.employee.create({
            data: {
                legalName,
                preferredName: preferredName ?? null,
                email,
                hourlyRateCents: Number(hourlyRateCents),
                active: true,
            },
            select: {
                id: true,
                legalName: true,
                preferredName: true,
                email: true,
                hourlyRateCents: true,
                active: true,
            },
        });
        res.json({ employee });
    }
    catch (e) {
        if (e?.code === "P2002")
            return res.status(409).json({ error: "Employee email already exists" });
        console.error("POST /api/admin/employees failed:", e);
        res.status(500).json({ error: "Failed to create employee" });
    }
});
/**
 * GET /employees (list)
 * Full path: GET /api/admin/employees
 */
exports.adminTimeRoutes.get("/employees", async (req, res) => {
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
                createdAt: true,
            },
        });
        res.json({ employees });
    }
    catch (e) {
        console.error("GET /api/admin/employees failed:", e);
        res.status(500).json({ error: "Failed to load employees" });
    }
});
// GET /time-entries (admin list)
exports.adminTimeRoutes.get("/time-entries", async (req, res) => {
    try {
        const { employeeId, from, to, status, q, page = "1", pageSize = "25", } = req.query;
        const take = Math.min(100, Math.max(1, Number(pageSize) || 25));
        const pageNum = Math.max(1, Number(page) || 1);
        const skip = (pageNum - 1) * take;
        const where = {};
        if (employeeId)
            where.employeeId = String(employeeId);
        if (status)
            where.status = String(status);
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = new Date(from);
            if (to)
                where.workDate.lte = new Date(to);
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
                include: {
                    employee: {
                        select: { id: true, legalName: true, preferredName: true, email: true, hourlyRateCents: true },
                    },
                    breaks: { select: { id: true, startTime: true, endTime: true, minutes: true } },
                },
            }),
        ]);
        const entriesWithComputed = entries.map((e) => {
            const breaks = Array.isArray(e.breaks) ? e.breaks : [];
            const computedBreakMinutes = breaks.length > 0
                ? breaks.reduce((sum, b) => sum + (b.minutes ?? 0), 0)
                : (e.breakMinutes ?? 0);
            const workedMinutes = e.minutesWorked ?? 0; // WORKED minutes
            const payableMinutes = Math.max(0, workedMinutes - computedBreakMinutes);
            return {
                ...e,
                computedBreakMinutes,
                payableMinutes,
            };
        });
        res.json({
            page: pageNum,
            pageSize: take,
            total,
            totalPages: Math.ceil(total / take),
            entries: entriesWithComputed,
        });
    }
    catch (e) {
        console.error("GET /api/admin/time-entries failed:", e);
        res.status(500).json({ error: "Failed to list time entries" });
    }
});
// GET /pay-summary (admin)
exports.adminTimeRoutes.get("/pay-summary", async (req, res) => {
    try {
        const { employeeId, from, to, status } = req.query;
        const where = {};
        if (employeeId)
            where.employeeId = String(employeeId);
        if (status)
            where.status = String(status);
        if (from || to) {
            where.workDate = {};
            if (from)
                where.workDate.gte = new Date(from);
            if (to)
                where.workDate.lte = new Date(to);
        }
        const entries = await prisma_1.prisma.timeEntry.findMany({
            where,
            select: {
                employeeId: true,
                minutesWorked: true, // WORKED minutes
                breakMinutes: true, // fallback
                breaks: { select: { minutes: true } },
                employee: { select: { hourlyRateCents: true } },
            },
        });
        const totalWorkedMinutes = entries.reduce((sum, e) => sum + (e.minutesWorked ?? 0), 0);
        const totalBreakMinutes = entries.reduce((sum, e) => {
            const breaks = Array.isArray(e.breaks) ? e.breaks : [];
            const computed = breaks.length > 0
                ? breaks.reduce((s, b) => s + (b.minutes ?? 0), 0)
                : (e.breakMinutes ?? 0);
            return sum + computed;
        }, 0);
        const payableMinutes = Math.max(0, totalWorkedMinutes - totalBreakMinutes);
        // pick hourlyRateCents (single employee if filtered; if not filtered, compute weighted pay per entry below)
        if (!employeeId) {
            // For multi-employee report, compute gross pay per entry using its employee hourly rate.
            const grossPayCents = entries.reduce((sum, e) => {
                const rate = e.employee?.hourlyRateCents ?? 0;
                const breaks = Array.isArray(e.breaks) ? e.breaks : [];
                const computedBreak = breaks.length > 0 ? breaks.reduce((s, b) => s + (b.minutes ?? 0), 0) : (e.breakMinutes ?? 0);
                const payMin = Math.max(0, (e.minutesWorked ?? 0) - computedBreak);
                return sum + Math.round((payMin * rate) / 60);
            }, 0);
            return res.json({
                scope: "all_or_filtered",
                totals: {
                    totalWorkedMinutes,
                    totalBreakMinutes,
                    payableMinutes,
                    payableHours: Math.round((payableMinutes / 60) * 100) / 100,
                    grossPayCents,
                },
            });
        }
        // single employee case
        const rate = entries[0]?.employee?.hourlyRateCents ?? 0;
        const grossPayCents = Math.round((payableMinutes * rate) / 60);
        res.json({
            scope: "employee",
            employeeId,
            totals: {
                totalWorkedMinutes,
                totalBreakMinutes,
                payableMinutes,
                payableHours: Math.round((payableMinutes / 60) * 100) / 100,
                hourlyRateCents: rate,
                grossPayCents,
            },
        });
    }
    catch (e) {
        console.error("GET /api/admin/pay-summary failed:", e);
        res.status(500).json({ error: "Failed to compute admin pay summary" });
    }
});
/**
 * GET /time-entry/calc
 * Preview math without saving
 */
exports.adminTimeRoutes.get("/time-entry/calc", async (req, res) => {
    try {
        const workDate = String(req.query.workDate || "");
        const shiftType = String(req.query.shiftType || "");
        const breaksRaw = String(req.query.breaks || "[]");
        const punchesRaw = String(req.query.punches || "[]");
        if (!workDate || !shiftType)
            return res.status(400).json({ error: "workDate and shiftType required" });
        if (!Object.values(SHIFT_TYPE).includes(shiftType))
            return res.status(400).json({ error: "Invalid shiftType" });
        const punches = JSON.parse(punchesRaw);
        const breaks = JSON.parse(breaksRaw);
        const r = computeWorkedMinutes(workDate, punches);
        const computedBreaks = computeBreakRows(workDate, breaks);
        const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
        const payableMinutes = Math.max(0, r.workedMinutes - breakMinutes);
        const buckets = splitDailyBuckets(payableMinutes);
        res.json({
            input: {
                workDate,
                shiftType,
                workedMinutes: r.workedMinutes,
                breakMinutes,
                payableMinutes,
            },
            range: {
                startTime: r.firstIn,
                endTime: r.lastOut,
            },
            display: {
                totalHours_HHMM: fmtHHMM(payableMinutes),
                calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
            },
            buckets: {
                regular_HHMM: fmtHHMM(buckets.regularMinutes),
                overtime_HHMM: fmtHHMM(buckets.overtimeMinutes),
                double_HHMM: fmtHHMM(buckets.doubleMinutes),
                regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
                overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
                double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
            },
        });
    }
    catch (e) {
        console.error("GET /api/admin/time-entry/calc failed:", e);
        res.status(400).json({ error: e?.message || "Invalid input" });
    }
});
/**
 * POST /time-entry
 * Full path: POST /api/admin/time-entry
 *
 * Supports:
 * A) Single segment:
 * {
 *   employeeId, workDate, shiftType:"AM"|"PM"|"NOC",
 *   punches:[{clockIn,clockOut},...],
 *   breaks?: [{startTime,endTime}, ...],
 *   notes?
 * }
 *
 * B) Two segments (continuous adjacency only):
 * {
 *   employeeId, workDate, shiftType:"AM+PM"|"PM+NOC"|"NOC+AM",
 *   segments:[
 *     {shift:"AM", punches:[...]},
 *     {shift:"PM", punches:[...]}
 *   ],
 *   breaks?: [{startTime,endTime}, ...],
 *   notes?
 * }
 */
exports.adminTimeRoutes.post("/time-entry", async (req, res) => {
    try {
        const { employeeId, workDate, shiftType, punches, segments, breaks, notes } = req.body || {};
        if (!employeeId || !workDate || !shiftType) {
            return res.status(400).json({ error: "employeeId, workDate(YYYY-MM-DD), shiftType required" });
        }
        if (!Object.values(SHIFT_TYPE).includes(shiftType)) {
            return res.status(400).json({ error: "Invalid shiftType (AM|PM|NOC|AM+PM|PM+NOC|NOC+AM)" });
        }
        const emp = await prisma_1.prisma.employee.findUnique({ where: { id: String(employeeId) } });
        if (!emp)
            return res.status(404).json({ error: "Employee not found" });
        const ws = String(workDate);
        let workedMinutes = 0;
        let startTime = null;
        let endTime = null;
        // What we store in DB for enum shiftType (Prisma requires AM/PM/NOC)
        let shiftTypeForDb = "AM";
        if (Array.isArray(segments) && segments.length === 2) {
            const s1 = segments[0];
            const s2 = segments[1];
            if (!s1?.shift || !s2?.shift)
                return res.status(400).json({ error: "segments[].shift required" });
            if (!Array.isArray(s1.punches) || !Array.isArray(s2.punches))
                return res.status(400).json({ error: "segments[].punches required" });
            const combined = `${s1.shift}+${s2.shift}`;
            if (combined !== shiftType) {
                return res.status(400).json({ error: `shiftType must match segments order. Expected ${combined}` });
            }
            const a = computeWorkedMinutes(ws, s1.punches);
            const b = computeWorkedMinutes(ws, s2.punches);
            validateTwoSegmentContinuity({ shift: s1.shift, firstIn: a.firstIn, lastOut: a.lastOut }, { shift: s2.shift, firstIn: b.firstIn, lastOut: b.lastOut });
            workedMinutes = a.workedMinutes + b.workedMinutes;
            startTime = a.firstIn;
            endTime = b.lastOut;
            // store first shift in DB enum
            shiftTypeForDb = s1.shift;
        }
        else {
            // Single shift
            if (!Array.isArray(punches) || punches.length === 0) {
                return res.status(400).json({ error: "punches[] required (or provide segments[] length=2)" });
            }
        }
        const r = computeWorkedMinutes(ws, punches);
        workedMinutes = r.workedMinutes;
        startTime = r.firstIn;
        endTime = r.lastOut;
        if (shiftType === "AM+PM" || shiftType === "PM+NOC" || shiftType === "NOC+AM") {
            const first = shiftType.split("+")[0];
            shiftTypeForDb = first;
        }
        else {
            shiftTypeForDb = shiftType;
        }
        // breaks are stored separately; compute break minutes from breaks[]
        const computedBreaks = computeBreakRows(ws, Array.isArray(breaks) ? breaks : []);
        const breakMinutes = computedBreaks.reduce((s, b) => s + b.minutes, 0);
        const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
        // Enforce: if worked >= 16 hours, require at least 2 breaks
        if (workedMinutes >= 16 * 60) {
            if (computedBreaks.length < 2) {
                return res.status(400).json({ error: "16+ hour shift requires at least 2 breaks (>=30 min each)" });
            }
        }
        const createdById = req.user?.id ?? null;
        const entry = await prisma_1.prisma.timeEntry.create({
            data: {
                employeeId: String(employeeId),
                workDate: new Date(`${ws}T00:00:00`),
                shiftType: shiftTypeForDb,
                minutesWorked: workedMinutes, // WORKED minutes (raw)
                breakMinutes: breakMinutes, // fallback if breaks missing; kept in sync here
                startTime: startTime ?? null,
                endTime: endTime ?? null,
                notes: notes ?? null,
                status: TIME_ENTRY_STATUS.DRAFT,
                createdById,
            },
            select: {
                id: true,
                employeeId: true,
                workDate: true,
                shiftType: true,
                minutesWorked: true,
                breakMinutes: true,
                startTime: true,
                endTime: true,
                notes: true,
                status: true,
                createdById: true,
                createdAt: true,
            },
        });
        // Store breaks (if provided)
        // Store breaks (if provided)
        if (Array.isArray(computedBreaks) && computedBreaks.length > 0) {
            const timeEntryId = String(entry.id);
            const breakRows = computedBreaks.map((b) => ({
                timeEntryId,
                startTime: b.startTime,
                endTime: b.endTime,
                minutes: Number(b.minutes),
            }));
            await prisma_1.prisma.timeEntryBreak.createMany({ data: breakRows });
        }
        const buckets = splitDailyBuckets(payableMinutes);
        return res.json({
            entry,
            breaksStored: computedBreaks.length,
            preview: {
                workedMinutes,
                breakMinutes,
                payableMinutes,
                totalHours_HHMM: fmtHHMM(payableMinutes),
                calculatedHours_decimal: minutesToDecimalHours(payableMinutes),
                buckets: {
                    regularMinutes: buckets.regularMinutes,
                    overtimeMinutes: buckets.overtimeMinutes,
                    doubleMinutes: buckets.doubleMinutes,
                    regular_HHMM: fmtHHMM(buckets.regularMinutes),
                    overtime_HHMM: fmtHHMM(buckets.overtimeMinutes),
                    double_HHMM: fmtHHMM(buckets.doubleMinutes),
                    regular_decimal: minutesToDecimalHours(buckets.regularMinutes),
                    overtime_decimal: minutesToDecimalHours(buckets.overtimeMinutes),
                    double_decimal: minutesToDecimalHours(buckets.doubleMinutes),
                },
            },
        });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry failed:", e);
        return res.status(400).json({ error: e?.message || "Failed to create time entry" });
    }
});
/**
 * POST /time-entry/:id/breaks
 * Full path: POST /api/admin/time-entry/:id/breaks
 *
 * Replaces all breaks for a time entry.
 * Blocks edits if LOCKED.
 *
 * body: { workDate:"YYYY-MM-DD", breaks:[{startTime,endTime}, ...] }
 */
exports.adminTimeRoutes.post("/time-entry/:id/breaks", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        if (!id)
            return res.status(400).json({ error: "id required" });
        const editable = await assertEditable(id);
        if (!editable.ok)
            return res.status(editable.http).json({ error: editable.msg });
        const { workDate, breaks } = req.body || {};
        if (!workDate)
            return res.status(400).json({ error: "workDate required" });
        const ws = String(workDate);
        const computed = computeBreakRows(ws, Array.isArray(breaks) ? breaks : []);
        // Replace breaks
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
        const breakRows = computed.map((b) => ({
            timeEntryId: id,
            startTime: b.startTime,
            endTime: b.endTime,
            minutes: Number(b.minutes),
        }));
        if (breakRows.length > 0) {
        }
        // Keep TimeEntry.breakMinutes in sync (fallback field)
        const breakMinutes = computed.reduce((sum, b) => sum + b.minutes, 0);
        await prisma_1.prisma.timeEntry.update({
            where: { id },
            data: { breakMinutes },
        });
        res.json({ ok: true, breakMinutes, breaksStored: breakRows.length });
    }
    catch (e) {
        console.error("POST /api/admin/time-entry/:id/breaks failed:", e);
        res.status(e?.status || 400).json({ error: e?.message || "Failed to update breaks" });
    }
});
/**
 * PATCH /time-entry/:id/status
 * Full path: PATCH /api/admin/time-entry/:id/status
 */
/**
 * PATCH /time-entry/:id/status
 * Full path: PATCH /api/admin/time-entry/:id/status
 */
/**
 * PATCH /time-entry/:id/status
 * Full path: PATCH /api/admin/time-entry/:id/status
 */
exports.adminTimeRoutes.patch("/time-entry/:id/status", async (req, res) => {
    try {
        const id = String(req.params.id || "");
        const { status } = req.body;
        if (!id)
            return res.status(400).json({ error: "id required" });
        if (!status)
            return res.status(400).json({ error: "status required" });
        if (!Object.values(TIME_ENTRY_STATUS).includes(status)) {
            return res.status(400).json({ error: "Invalid status" });
        }
        // 1) read current
        const current = await prisma_1.prisma.timeEntry.findUnique({
            where: { id },
            select: { id: true, status: true },
        });
        if (!current)
            return res.status(404).json({ error: "Time entry not found" });
        const from = String(current.status);
        const to = String(status);
        // 2) enforce transitions
        const allowed = {
            DRAFT: ["APPROVED"],
            // If you want to allow "unapprove", keep DRAFT here. Otherwise remove it.
            APPROVED: ["LOCKED", "DRAFT"],
            // keep empty to prevent unlocking
            LOCKED: [],
        };
        if (!(allowed[from] || []).includes(to)) {
            return res.status(409).json({ error: `Invalid status transition: ${from} -> ${to}` });
        }
        // Optional safety: prevent jumping to LOCKED unless already APPROVED
        // (your allowed map already enforces this)
        // 3) update
        const entry = await prisma_1.prisma.timeEntry.update({
            where: { id },
            data: { status: status },
            select: { id: true, status: true },
        });
        return res.json({ entry });
    }
    catch (e) {
        console.error("PATCH /api/admin/time-entry/:id/status failed:", e);
        return res.status(500).json({ error: "Failed to update status" });
    }
});
