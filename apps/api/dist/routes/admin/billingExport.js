"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const exceljs_1 = __importDefault(require("exceljs"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.get("/billing-export", async (req, res) => {
    try {
        const { facilityId, from, to, mode, invoiceNumber, employeeIds } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        if (!from || !to) {
            return res.status(400).json({ error: "from and to are required" });
        }
        const exportMode = String(mode || "regular").toLowerCase();
        if (!["regular", "supplemental"].includes(exportMode)) {
            return res.status(400).json({ error: "mode must be regular or supplemental" });
        }
        const invoiceNo = String(invoiceNumber || "").trim();
        if (!invoiceNo) {
            return res.status(400).json({ error: "invoiceNumber required" });
        }
        const fromDate = (0, _shared_1.startOfDayUTC)(from);
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(to);
        const periodStart = fromDate;
        const periodEnd = (0, _shared_1.startOfDayUTC)(to);
        const invoiceType = exportMode === "regular" ? "REGULAR" : "SUPPLEMENTAL";
        const billingRun = await (0, _shared_1.getOrCreateBillingRun)({
            facilityId: String(facilityId),
            periodStart,
            periodEnd,
            invoiceType: invoiceType,
            invoiceNumber: invoiceNo,
        });
        const facility = await prisma_1.prisma.facility.findUnique({
            where: { id: String(facilityId) },
            select: {
                id: true,
                name: true,
            },
        });
        if (!facility) {
            return res.status(404).json({ error: "Facility not found" });
        }
        const allRows = await (0, _shared_1.getBillableWorkRows)({
            prisma: prisma_1.prisma,
            facilityId: String(facilityId),
            from: fromDate,
            toExclusive,
        });
        const lock = await prisma_1.prisma.billingRun.findFirst({
            where: {
                facilityId: String(facilityId),
                periodStart: fromDate,
                periodEnd: (0, _shared_1.startOfDayUTC)(to),
                invoiceType: "REGULAR",
            },
        });
        if (lock?.status === "LOCKED" && exportMode === "regular") {
            return res.status(400).json({
                error: "Regular invoice is locked. Use supplemental export.",
            });
        }
        const exportRows = allRows.filter((r) => {
            if (exportMode === "regular") {
                if (r.sourceType !== "TIME_ENTRY")
                    return false;
                const addedAfterLock = billingRun?.status === "LOCKED" &&
                    r.createdAt &&
                    billingRun.lockedAt &&
                    new Date(r.createdAt).getTime() > new Date(billingRun.lockedAt).getTime();
                return !addedAfterLock;
            }
            if (exportMode === "supplemental") {
                const isAllowedSource = r.sourceType === "PAYROLL_ADJUSTMENT" ||
                    r.sourceType === "TIME_ENTRY";
                if (!isAllowedSource)
                    return false;
                if (!billingRun?.lockedAt) {
                    return r.sourceType === "PAYROLL_ADJUSTMENT";
                }
                return (!!r.createdAt &&
                    new Date(r.createdAt).getTime() > new Date(billingRun.lockedAt).getTime());
            }
            return false;
        });
        const selectedEmployeeIds = String(employeeIds || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
        const filteredExportRows = selectedEmployeeIds.length > 0
            ? exportRows.filter((r) => selectedEmployeeIds.includes(String(r.employeeId)))
            : exportRows;
        if (filteredExportRows.length === 0) {
            return res.status(400).json({
                error: exportMode === "supplemental"
                    ? "No Supplemental entries found for the selected employee(s), facility, and pay period."
                    : "No entries found for the selected employee(s), facility, and pay period.",
            });
        }
        const facilityRates = await prisma_1.prisma.facilityRate.findMany({
            where: {
                facilityId: String(facilityId),
            },
            orderBy: [{ title: "asc" }, { effectiveFrom: "desc" }],
        });
        for (const e of filteredExportRows) {
            const title = String(e.employee?.title || "").trim();
            if (!title) {
                return res.status(400).json({
                    error: `Employee "${e.employee?.legalName || e.employeeId}" has no title/designation. Billing export requires CNA/LVN/RN.`,
                });
            }
            const effectiveRate = (0, _shared_1.findEffectiveFacilityRate)(facilityRates, title, new Date(e.workDate));
            if (!effectiveRate) {
                return res.status(400).json({
                    error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${(0, _shared_1.fmtISODateOnly)(e.workDate)}. Please add the rate in Admin > Facilities.`,
                });
            }
        }
        const workbook = new exceljs_1.default.Workbook();
        workbook.creator = "Wezen Payroll";
        workbook.created = new Date();
        workbook.modified = new Date();
        const totalSheet = workbook.addWorksheet("Total Hours");
        const summarySheet = workbook.addWorksheet("Summary Flex");
        const dates = (0, _shared_1.listDatesInclusive)(from, to);
        const billingTitleOrder = ["CNA", "LVN", "RN"];
        const employeeMap = new Map();
        for (const e of filteredExportRows) {
            const employeeId = String(e.employeeId);
            const name = e.employee?.preferredName
                ? `${e.employee.legalName} (${e.employee.preferredName})`
                : e.employee?.legalName || "Unknown";
            const title = String(e.employee?.title || "");
            const effectiveRate = (0, _shared_1.findEffectiveFacilityRate)(facilityRates, title, new Date(e.workDate));
            if (!effectiveRate) {
                return res.status(400).json({
                    error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${(0, _shared_1.fmtISODateOnly)(e.workDate)}. Please add a facility billing rate before exporting.`,
                });
            }
            const regRateCents = Number(effectiveRate?.regRateCents ?? 0);
            const otRateCents = Number(effectiveRate?.otRateCents ?? 0);
            const dtRateCents = Number(effectiveRate?.dtRateCents ?? 0);
            const workedMinutes = Number(e.minutesWorked || 0);
            const breakMinutes = (0, _shared_1.sumBreakMinutesFromEntry)(e);
            const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
            const buckets = (0, _shared_1.splitDailyBuckets)(payableMinutes);
            const dateISO = (0, _shared_1.fmtISODateOnly)(e.workDate);
            const holidayRule = await (0, _shared_1.getHolidayRule)(e.workDate);
            const holidayRegularMinutes = holidayRule.isHoliday ? Number(buckets.regularMinutes || 0) : 0;
            const nonHolidayRegularMinutes = Number(buckets.regularMinutes || 0) - holidayRegularMinutes;
            const entryBillAmount = e.sourceType === "PAYROLL_ADJUSTMENT"
                ? Number(e.billAmountCents || 0) / 100
                : Number((0, _shared_1.calculateBillCentsWithRule)({
                    regularMinutes: buckets.regularMinutes,
                    overtimeMinutes: buckets.overtimeMinutes,
                    doubleMinutes: buckets.doubleMinutes,
                    regRateCents,
                    otRateCents,
                    dtRateCents,
                    holidayRule,
                }) / 100);
            const existing = employeeMap.get(employeeId) || {
                employeeId,
                name,
                title,
                rateToBill: regRateCents / 100,
                entries: [],
                byDate: new Map(),
                totals: {
                    holidayHours: 0,
                    totalHours: 0,
                    regularHours: 0,
                    overtimeHours: 0,
                    doubleHours: 0,
                    holidayPay: 0,
                    amountToBill: 0,
                },
            };
            existing.entries.push(e);
            const currentDay = existing.byDate.get(dateISO) || {
                date: dateISO,
                entries: [],
                workedMinutes: 0,
                breakMinutes: 0,
                payableMinutes: 0,
                regularMinutes: 0,
                holidayMinutes: 0,
                overtimeMinutes: 0,
                doubleMinutes: 0,
                billAmount: 0,
            };
            currentDay.entries.push(e);
            currentDay.workedMinutes += workedMinutes;
            currentDay.breakMinutes += breakMinutes;
            currentDay.payableMinutes += payableMinutes;
            currentDay.regularMinutes += nonHolidayRegularMinutes;
            currentDay.overtimeMinutes += buckets.overtimeMinutes;
            currentDay.doubleMinutes += buckets.doubleMinutes;
            currentDay.holidayMinutes = Number(currentDay.holidayMinutes || 0) + holidayRegularMinutes;
            currentDay.billAmount += entryBillAmount;
            existing.totals.holidayHours += holidayRegularMinutes / 60;
            existing.totals.totalHours += payableMinutes / 60;
            existing.totals.regularHours += nonHolidayRegularMinutes / 60;
            existing.totals.overtimeHours += buckets.overtimeMinutes / 60;
            existing.totals.doubleHours += buckets.doubleMinutes / 60;
            existing.totals.amountToBill += entryBillAmount;
            if (holidayRule.isHoliday) {
                const holidayBillOnly = Number((0, _shared_1.calculateBillCentsWithRule)({
                    regularMinutes: buckets.regularMinutes,
                    overtimeMinutes: 0,
                    doubleMinutes: 0,
                    regRateCents,
                    otRateCents,
                    dtRateCents,
                    holidayRule,
                }) / 100) -
                    Number((buckets.regularMinutes / 60) * (regRateCents / 100));
                existing.totals.holidayPay += Math.max(0, holidayBillOnly);
            }
            existing.byDate.set(dateISO, currentDay);
            employeeMap.set(employeeId, existing);
        }
        const employees = Array.from(employeeMap.values()).sort((a, b) => {
            const at = String(a.title || "").toUpperCase();
            const bt = String(b.title || "").toUpperCase();
            const ai = billingTitleOrder.indexOf(at);
            const bi = billingTitleOrder.indexOf(bt);
            if (ai !== bi) {
                if (ai === -1)
                    return 1;
                if (bi === -1)
                    return -1;
                return ai - bi;
            }
            return a.name.localeCompare(b.name);
        });
        for (const emp of employees) {
            let regularHours = 0;
            let holidayHours = 0;
            let overtimeHours = 0;
            let doubleHours = 0;
            let amountToBill = 0;
            for (const [, day] of emp.byDate) {
                regularHours += Number(day.regularMinutes || 0) / 60;
                holidayHours += Number(day.holidayMinutes || 0) / 60;
                overtimeHours += Number(day.overtimeMinutes || 0) / 60;
                doubleHours += Number(day.doubleMinutes || 0) / 60;
                amountToBill += Number(day.billAmount || 0);
            }
            const totalHours = regularHours + holidayHours + overtimeHours + doubleHours;
            emp.totals = {
                holidayHours: (0, _shared_1.currencyExcel)(holidayHours),
                totalHours: (0, _shared_1.currencyExcel)(totalHours),
                regularHours: (0, _shared_1.currencyExcel)(regularHours),
                overtimeHours: (0, _shared_1.currencyExcel)(overtimeHours),
                doubleHours: (0, _shared_1.currencyExcel)(doubleHours),
                holidayPay: (0, _shared_1.currencyExcel)(Number(emp.totals.holidayPay || 0)),
                amountToBill: (0, _shared_1.currencyExcel)(amountToBill),
            };
        }
        totalSheet.columns = [
            { header: "Names", key: "name", width: 28 },
            { header: "Title", key: "title", width: 18 },
            { header: "Rate to be Billed", key: "rate", width: 18 },
            { header: "Holiday Hour", key: "holidayHours", width: 14 },
            { header: "Total hours", key: "totalHours", width: 14 },
            { header: "Regular", key: "regularHours", width: 12 },
            { header: "Overtime (9 to 12 hr)", key: "overtimeHours", width: 20 },
            { header: "Double Time", key: "doubleHours", width: 14 },
            { header: "Holiday Pay", key: "holidayPay", width: 14 },
            { header: "Amount to be billed", key: "amount", width: 18 },
        ];
        const exportLabel = exportMode === "supplemental" ? "Supplemental Billing Summary" : "Billing Summary";
        const totalHeaderRow = (0, _shared_1.addSheetTitle)(totalSheet, `${facility.name} - ${exportLabel}`, `Invoice: ${invoiceNo}   |   Pay Period: ${from} to ${to}`, 10);
        (0, _shared_1.styleHeaderRow)(totalSheet, totalHeaderRow);
        totalSheet.views = [{ state: "frozen", ySplit: totalHeaderRow }];
        const employeesByTitle = new Map();
        for (const emp of employees) {
            const title = String(emp.title || "UNASSIGNED").toUpperCase();
            const list = employeesByTitle.get(title) || [];
            list.push(emp);
            employeesByTitle.set(title, list);
        }
        const sortedTitles = Array.from(employeesByTitle.keys()).sort((a, b) => {
            const ai = billingTitleOrder.indexOf(a);
            const bi = billingTitleOrder.indexOf(b);
            if (ai === -1 && bi === -1)
                return a.localeCompare(b);
            if (ai === -1)
                return 1;
            if (bi === -1)
                return -1;
            return ai - bi;
        });
        let groupGrandHolidayHours = 0;
        let groupGrandTotalHours = 0;
        let groupGrandRegularHours = 0;
        let groupGrandOvertimeHours = 0;
        let groupGrandDoubleHours = 0;
        let groupGrandHolidayPay = 0;
        let groupGrandAmount = 0;
        for (const title of sortedTitles) {
            const group = (employeesByTitle.get(title) || []);
            group.sort((a, b) => a.name.localeCompare(b.name));
            const titleRow = totalSheet.addRow({
                name: title,
            });
            titleRow.font = { bold: true };
            titleRow.eachCell((cell) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF3F4F6" },
                };
            });
            let subHolidayHours = 0;
            let subTotalHours = 0;
            let subRegularHours = 0;
            let subOvertimeHours = 0;
            let subDoubleHours = 0;
            let subHolidayPay = 0;
            let subAmount = 0;
            for (const emp of group) {
                totalSheet.addRow({
                    name: emp.name,
                    title: emp.title,
                    rate: emp.rateToBill,
                    holidayHours: emp.totals.holidayHours,
                    totalHours: emp.totals.totalHours,
                    regularHours: emp.totals.regularHours,
                    overtimeHours: emp.totals.overtimeHours,
                    doubleHours: emp.totals.doubleHours,
                    holidayPay: emp.totals.holidayPay,
                    amount: emp.totals.amountToBill,
                });
                subHolidayHours += Number(emp.totals.holidayHours || 0);
                subTotalHours += Number(emp.totals.totalHours || 0);
                subRegularHours += Number(emp.totals.regularHours || 0);
                subOvertimeHours += Number(emp.totals.overtimeHours || 0);
                subDoubleHours += Number(emp.totals.doubleHours || 0);
                subHolidayPay += Number(emp.totals.holidayPay || 0);
                subAmount += Number(emp.totals.amountToBill || 0);
            }
            const subtotalRow = totalSheet.addRow({
                name: `${title} Total`,
                holidayHours: (0, _shared_1.currencyExcel)(subHolidayHours),
                totalHours: (0, _shared_1.currencyExcel)(subTotalHours),
                regularHours: (0, _shared_1.currencyExcel)(subRegularHours),
                overtimeHours: (0, _shared_1.currencyExcel)(subOvertimeHours),
                doubleHours: (0, _shared_1.currencyExcel)(subDoubleHours),
                holidayPay: (0, _shared_1.currencyExcel)(subHolidayPay),
                amount: (0, _shared_1.currencyExcel)(subAmount),
            });
            subtotalRow.font = { bold: true };
            subtotalRow.eachCell((cell) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF9FAFB" },
                };
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE5E7EB" } },
                    left: { style: "thin", color: { argb: "FFE5E7EB" } },
                    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                    right: { style: "thin", color: { argb: "FFE5E7EB" } },
                };
            });
            totalSheet.addRow({});
            groupGrandHolidayHours += subHolidayHours;
            groupGrandTotalHours += subTotalHours;
            groupGrandRegularHours += subRegularHours;
            groupGrandOvertimeHours += subOvertimeHours;
            groupGrandDoubleHours += subDoubleHours;
            groupGrandHolidayPay += subHolidayPay;
            groupGrandAmount += subAmount;
        }
        const totalRow = totalSheet.addRow({
            name: "Grand Total",
            holidayHours: (0, _shared_1.currencyExcel)(groupGrandHolidayHours),
            totalHours: (0, _shared_1.currencyExcel)(groupGrandTotalHours),
            regularHours: (0, _shared_1.currencyExcel)(groupGrandRegularHours),
            overtimeHours: (0, _shared_1.currencyExcel)(groupGrandOvertimeHours),
            doubleHours: (0, _shared_1.currencyExcel)(groupGrandDoubleHours),
            holidayPay: (0, _shared_1.currencyExcel)(groupGrandHolidayPay),
            amount: (0, _shared_1.currencyExcel)(groupGrandAmount),
        });
        totalRow.font = { bold: true };
        totalRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFEFF6FF" },
            };
            cell.border = {
                top: { style: "medium", color: { argb: "FFCBD5E1" } },
                left: { style: "thin", color: { argb: "FFE5E7EB" } },
                bottom: { style: "medium", color: { argb: "FFCBD5E1" } },
                right: { style: "thin", color: { argb: "FFE5E7EB" } },
            };
        });
        ["C", "I", "J"].forEach((col) => {
            totalSheet.getColumn(col).numFmt = "$#,##0.00";
        });
        ["D", "E", "F", "G", "H"].forEach((col) => {
            totalSheet.getColumn(col).numFmt = "0.00";
        });
        summarySheet.columns = [
            { header: "Names", key: "name", width: 28 },
            ...dates.map((d) => ({
                header: `${(0, _shared_1.fmtWeekdayShort)(d)} ${d.slice(5)}`,
                key: d,
                width: 12,
            })),
            { header: "Total", key: "total", width: 12 },
        ];
        const summaryHeaderRow = (0, _shared_1.addSheetTitle)(summarySheet, `${facility.name} - Daily Hours Grid`, `Invoice: ${invoiceNo}   |   Pay Period: ${from} to ${to}`, dates.length + 2);
        (0, _shared_1.styleHeaderRow)(summarySheet, summaryHeaderRow);
        summarySheet.views = [{ state: "frozen", ySplit: summaryHeaderRow, xSplit: 1 }];
        for (const emp of employees) {
            const row = { name: emp.name };
            let total = 0;
            for (const d of dates) {
                const day = emp.byDate.get(d);
                const hours = day ? (0, _shared_1.currencyExcel)(day.payableMinutes / 60) : 0;
                row[d] = hours || "";
                total += hours;
            }
            row.total = (0, _shared_1.currencyExcel)(total);
            summarySheet.addRow(row);
        }
        const totalSummaryRow = { name: "Grand Total" };
        let grandTotalHours = 0;
        for (const d of dates) {
            const dayTotal = (0, _shared_1.currencyExcel)(employees.reduce((sum, emp) => {
                const day = emp.byDate.get(d);
                return sum + (day ? day.payableMinutes / 60 : 0);
            }, 0));
            totalSummaryRow[d] = dayTotal || "";
            grandTotalHours += dayTotal;
        }
        totalSummaryRow.total = (0, _shared_1.currencyExcel)(grandTotalHours);
        const summaryGrandRow = summarySheet.addRow(totalSummaryRow);
        summaryGrandRow.font = { bold: true };
        summaryGrandRow.eachCell((cell) => {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF3F4F6" },
            };
        });
        for (let i = summaryHeaderRow + 1; i <= summarySheet.rowCount; i++) {
            const row = summarySheet.getRow(i);
            for (let col = 2; col <= summarySheet.columnCount; col++) {
                row.getCell(col).numFmt = "0.00";
            }
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: "thin", color: { argb: "FFE5E7EB" } },
                    left: { style: "thin", color: { argb: "FFE5E7EB" } },
                    bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                    right: { style: "thin", color: { argb: "FFE5E7EB" } },
                };
            });
        }
        for (const emp of employees) {
            const ws = workbook.addWorksheet((0, _shared_1.safeSheetName)(`${emp.title || "STAFF"} - ${emp.name}`));
            ws.addRow([`Employee: ${emp.name}   |   Facility: ${facility.name}   |   Invoice: ${invoiceNo}   |   Period: ${from} to ${to}`]);
            ws.getRow(1).font = { bold: true, size: 14 };
            ws.mergeCells(1, 1, 1, 14);
            ws.addRow([]);
            ws.columns = [
                { key: "date", width: 12 },
                { key: "day", width: 10 },
                { key: "cin1", width: 12 },
                { key: "cout1", width: 12 },
                { key: "cin2", width: 12 },
                { key: "cout2", width: 12 },
                { key: "cin3", width: 12 },
                { key: "cout3", width: 12 },
                { key: "cin4", width: 12 },
                { key: "cout4", width: 12 },
                { key: "totalHours", width: 12 },
                { key: "regular", width: 12 },
                { key: "holiday", width: 12 },
                { key: "ot", width: 12 },
                { key: "dt", width: 12 },
            ];
            ws.addRow([
                "Date",
                "Day",
                "Clock In",
                "Meal Out",
                "Meal In",
                "Clock Out",
                "Clock In",
                "Meal Out",
                "Meal In",
                "Clock Out",
                "Total",
                "Regular",
                "Holiday",
                "OT",
                "DT",
            ]);
            (0, _shared_1.styleHeaderRow)(ws, 3);
            ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];
            for (const d of dates) {
                const day = emp.byDate.get(d);
                const punches = (day?.entries || []).flatMap((entry) => (0, _shared_1.buildExportPunchPairs)(entry));
                const pair = (idx, field) => punches[idx] ? (0, _shared_1.isoToDisplayTime)(punches[idx][field]) : "";
                const totalHours = day ? (0, _shared_1.currencyExcel)(day.payableMinutes / 60) : 0;
                const regular = day ? (0, _shared_1.currencyExcel)(Number(day.regularMinutes || 0) / 60) : 0;
                const holiday = day ? (0, _shared_1.currencyExcel)(Number(day.holidayMinutes || 0) / 60) : 0;
                const ot = day ? (0, _shared_1.currencyExcel)(Number(day.overtimeMinutes || 0) / 60) : 0;
                const dt = day ? (0, _shared_1.currencyExcel)(Number(day.doubleMinutes || 0) / 60) : 0;
                ws.addRow({
                    date: d,
                    day: (0, _shared_1.fmtWeekdayShort)(d),
                    cin1: pair(0, "clockIn"),
                    cout1: pair(0, "clockOut"),
                    cin2: pair(1, "clockIn"),
                    cout2: pair(1, "clockOut"),
                    cin3: pair(2, "clockIn"),
                    cout3: pair(2, "clockOut"),
                    cin4: pair(3, "clockIn"),
                    cout4: pair(3, "clockOut"),
                    totalHours: totalHours || "",
                    regular: regular || "",
                    holiday: holiday || "",
                    ot: ot || "",
                    dt: dt || "",
                });
            }
            const totalRegular = (0, _shared_1.currencyExcel)(Array.from(emp.byDate.values()).reduce((s, day) => s + Number(day.regularMinutes || 0) / 60, 0));
            const totalHoliday = (0, _shared_1.currencyExcel)(Array.from(emp.byDate.values()).reduce((s, day) => s + Number(day.holidayMinutes || 0) / 60, 0));
            const totalOt = (0, _shared_1.currencyExcel)(Array.from(emp.byDate.values()).reduce((s, day) => s + Number(day.overtimeMinutes || 0) / 60, 0));
            const totalDt = (0, _shared_1.currencyExcel)(Array.from(emp.byDate.values()).reduce((s, day) => s + Number(day.doubleMinutes || 0) / 60, 0));
            const totalAll = (0, _shared_1.currencyExcel)(totalRegular + totalHoliday + totalOt + totalDt);
            const totalsRow = ws.addRow({
                date: "",
                day: "TOTAL",
                totalHours: totalAll,
                regular: totalRegular,
                holiday: totalHoliday,
                ot: totalOt,
                dt: totalDt,
            });
            totalsRow.font = { bold: true };
            totalsRow.eachCell((cell) => {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFF9FAFB" },
                };
            });
            for (let i = 3; i <= ws.rowCount; i++) {
                ["K", "L", "M", "N"].forEach((col) => {
                    ws.getRow(i).getCell(col).numFmt = "0.00";
                });
                ws.getRow(i).eachCell((cell) => {
                    cell.border = {
                        top: { style: "thin", color: { argb: "FFE5E7EB" } },
                        left: { style: "thin", color: { argb: "FFE5E7EB" } },
                        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
                        right: { style: "thin", color: { argb: "FFE5E7EB" } },
                    };
                });
            }
            (0, _shared_1.autoSizeColumns)(ws, 10, 18);
        }
        (0, _shared_1.autoSizeColumns)(totalSheet, 10, 28);
        (0, _shared_1.autoSizeColumns)(summarySheet, 10, 18);
        const timeEntryIds = filteredExportRows
            .filter((r) => r.sourceType === "TIME_ENTRY")
            .map((r) => r.sourceId);
        const adjustmentIds = filteredExportRows
            .filter((r) => r.sourceType === "PAYROLL_ADJUSTMENT")
            .map((r) => r.sourceId);
        if (timeEntryIds.length > 0 && exportMode === "regular") {
            const unbilledTimeEntryIds = filteredExportRows
                .filter((r) => r.sourceType === "TIME_ENTRY" && !r.billedAt)
                .map((r) => r.sourceId);
            if (unbilledTimeEntryIds.length > 0) {
                await prisma_1.prisma.timeEntry.updateMany({
                    where: {
                        id: { in: timeEntryIds },
                    },
                    data: {
                        billedAt: new Date(),
                        invoiceNumber: invoiceNo,
                        invoiceType: exportMode,
                    },
                });
            }
        }
        if (adjustmentIds.length > 0) {
            await prisma_1.prisma.payrollAdjustment.updateMany({
                where: {
                    id: { in: adjustmentIds },
                },
                data: {
                    billedAt: new Date(),
                    invoiceNumber: invoiceNo,
                    invoiceType: exportMode,
                },
            });
        }
        const filename = `${facility.name} ${exportMode === "supplemental" ? "Supplemental " : ""}Billing ${invoiceNo}.xlsx`;
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        await workbook.xlsx.write(res);
        return res.end();
    }
    catch (e) {
        console.error("GET /api/admin/billing-export failed:", e);
        return res.status(400).json({ error: e?.message || "Failed to export billing file" });
    }
});
// GET /billing-export/eligible-employees
router.get("/billing-export/eligible-employees", async (req, res) => {
    try {
        const { facilityId, from, to } = req.query;
        if (!facilityId || !from || !to) {
            return res.status(400).json({ error: "facilityId, from, to required" });
        }
        const fromDate = (0, _shared_1.startOfDayUTC)(from);
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(to);
        const rows = await (0, _shared_1.getBillableWorkRows)({
            prisma: prisma_1.prisma,
            facilityId: String(facilityId),
            from: fromDate,
            toExclusive,
        });
        const eligible = rows.filter((r) => !r.billedAt &&
            (r.sourceType === "PAYROLL_ADJUSTMENT" || r.sourceType === "TIME_ENTRY"));
        const map = new Map();
        for (const r of eligible) {
            if (!map.has(r.employeeId)) {
                map.set(r.employeeId, {
                    id: r.employeeId,
                    name: r.employee?.legalName,
                });
            }
        }
        return res.json({
            employees: Array.from(map.values()),
        });
    }
    catch (e) {
        return res.status(500).json({ error: e.message || "Failed" });
    }
});
router.post("/billing-export/lock", async (req, res) => {
    try {
        const facilityId = String(req.body?.facilityId || "").trim();
        const from = String(req.body?.from || "").trim();
        const to = String(req.body?.to || "").trim();
        const invoiceNumber = String(req.body?.invoiceNumber || "").trim();
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        if (!from || !to) {
            return res.status(400).json({ error: "from and to required" });
        }
        const periodStart = (0, _shared_1.startOfDayUTC)(from);
        const periodEnd = (0, _shared_1.startOfDayUTC)(to);
        const run = await (0, _shared_1.getOrCreateBillingRun)({
            facilityId,
            periodStart,
            periodEnd,
            invoiceType: "REGULAR",
            invoiceNumber: invoiceNumber || null,
        });
        if (run.status === "LOCKED") {
            return res.json({ ok: true, billingRun: run });
        }
        const updated = await prisma_1.prisma.billingRun.update({
            where: { id: run.id },
            data: {
                status: "LOCKED",
                lockedAt: new Date(),
                invoiceNumber: invoiceNumber || run.invoiceNumber || null,
            },
        });
        return res.json({ ok: true, billingRun: updated });
    }
    catch (e) {
        console.error("POST /api/admin/billing-export/lock failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to lock billing run" });
    }
});
router.get("/billing-export/status", async (req, res) => {
    try {
        const facilityId = String(req.query.facilityId || "").trim();
        const from = String(req.query.from || "").trim();
        const to = String(req.query.to || "").trim();
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId required" });
        }
        if (!from || !to) {
            return res.status(400).json({ error: "from and to required" });
        }
        const periodStart = (0, _shared_1.startOfDayUTC)(from);
        const periodEnd = (0, _shared_1.startOfDayUTC)(to);
        const regularRun = await (0, _shared_1.getBillingRun)({
            facilityId,
            periodStart,
            periodEnd,
            invoiceType: "REGULAR",
        });
        return res.json({
            regular: regularRun
                ? {
                    id: regularRun.id,
                    status: regularRun.status,
                    invoiceNumber: regularRun.invoiceNumber,
                    lockedAt: regularRun.lockedAt,
                }
                : null,
        });
    }
    catch (e) {
        console.error("GET /api/admin/billing-export/status failed:", e);
        return res.status(500).json({ error: e?.message || "Failed to load billing export status" });
    }
});
exports.default = router;
