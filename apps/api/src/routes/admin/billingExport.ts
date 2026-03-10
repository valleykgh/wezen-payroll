import express from "express";
import ExcelJS from "exceljs";
import { prisma } from "../../prisma";
import {
  addSheetTitle,
  autoSizeColumns,
  buildExportPunchPairs,
  currencyExcel,
  findEffectiveFacilityRate,
  fmtISODateOnly,
  fmtWeekdayShort,
  isoToDisplayTime,
  listDatesInclusive,
  safeSheetName,
  splitDailyBuckets,
  startOfDayUTC,
  startOfNextDayUTC,
  styleHeaderRow,
  sumBreakMinutesFromEntry,
} from "./_shared";

const router = express.Router();

router.get("/billing-export", async (req, res) => {
  try {
    const { facilityId, from, to } = req.query as {
      facilityId?: string;
      from?: string;
      to?: string;
    };

    if (!facilityId) {
      return res.status(400).json({ error: "facilityId required" });
    }
    if (!from || !to) {
      return res.status(400).json({ error: "from and to are required" });
    }

    const fromDate = startOfDayUTC(from);
    const toExclusive = startOfNextDayUTC(to);

    const facility = await prisma.facility.findUnique({
      where: { id: String(facilityId) },
      select: {
        id: true,
        name: true,
      },
    });

    if (!facility) {
      return res.status(404).json({ error: "Facility not found" });
    }

    const entries = await prisma.timeEntry.findMany({
      where: {
        facilityId: String(facilityId),
        workDate: {
          gte: fromDate,
          lt: toExclusive,
        },
        status: {
          in: ["APPROVED", "LOCKED"],
        },
      },
      orderBy: [{ employeeId: "asc" }, { workDate: "asc" }, { createdAt: "asc" }],
      include: {
    employee: {
      select: {
        id: true,
        legalName: true,
        preferredName: true,
        email: true,
        title: true,
        hourlyRateCents: true,
      },
    },
    breaks: {
      select: {
        id: true,
        timeEntryId: true,
        startTime: true,
        endTime: true,
        minutes: true,
        createdAt: true,
      },
    },
  },
});
      
      const facilityRates = await prisma.facilityRate.findMany({
      where: {
        facilityId: String(facilityId),
      },
      orderBy: [{ title: "asc" }, { effectiveFrom: "desc" }],
    });

    for (const e of entries) {
      const title = String((e.employee as any)?.title || "").trim();

      if (!title) {
        return res.status(400).json({
          error: `Employee "${e.employee?.legalName || e.employeeId}" has no title/designation. Billing export requires CNA/LVN/RN.`,
        });
      }

      const effectiveRate = findEffectiveFacilityRate(
        facilityRates as any[],
        title,
        new Date(e.workDate)
      );

      if (!effectiveRate) {
        return res.status(400).json({
          error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${fmtISODateOnly(e.workDate)}. Please add the rate in Admin > Facilities.`,
        });
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Wezen Payroll";
    workbook.created = new Date();
    workbook.modified = new Date();

    const totalSheet = workbook.addWorksheet("Total Hours");
    const summarySheet = workbook.addWorksheet("Summary Flex");

    const dates = listDatesInclusive(from, to);
    const billingTitleOrder = ["CNA", "LVN", "RN"];

    type BillingEmployee = {
  employeeId: string;
  name: string;
  title: string;
  rateToBill: number;
  entries: any[];
  byDate: Map<
    string,
    {
      date: string;
      entries: any[];
      workedMinutes: number;
      breakMinutes: number;
      payableMinutes: number;
      regularMinutes: number;
      overtimeMinutes: number;
      doubleMinutes: number;
      billAmount: number;
    }
  >;
  totals: {
    holidayHours: number;
    totalHours: number;
    regularHours: number;
    overtimeHours: number;
    doubleHours: number;
    holidayPay: number;
    amountToBill: number;
  };
};

    const employeeMap = new Map<string, BillingEmployee>();

    for (const e of entries) {
      const employeeId = String(e.employeeId);
      const name = e.employee?.preferredName
        ? `${e.employee.legalName} (${e.employee.preferredName})`
        : e.employee?.legalName || "Unknown";
      const title = String((e.employee as any)?.title || "");

      const effectiveRate = findEffectiveFacilityRate(
        facilityRates as any[],
        title,
        new Date(e.workDate)
      );

      if (!effectiveRate) {
        return res.status(400).json({
          error: `Missing billing rate for facility "${facility.name}", title "${title}", work date ${fmtISODateOnly(e.workDate)}. Please add a facility billing rate before exporting.`,
        });
      }

      const regRateCents = Number(effectiveRate?.regRateCents ?? 0);
      const otRateCents = Number(effectiveRate?.otRateCents ?? 0);
      const dtRateCents = Number(effectiveRate?.dtRateCents ?? 0);

      const workedMinutes = Number(e.minutesWorked || 0);
      const breakMinutes = sumBreakMinutesFromEntry(e);
      const payableMinutes = Math.max(0, workedMinutes - breakMinutes);
      const buckets = splitDailyBuckets(payableMinutes);
      const dateISO = fmtISODateOnly(e.workDate);

      const entryBillAmount =
        (buckets.regularMinutes / 60) * (regRateCents / 100) +
        (buckets.overtimeMinutes / 60) * (otRateCents / 100) +
        (buckets.doubleMinutes / 60) * (dtRateCents / 100);

      const existing =
        employeeMap.get(employeeId) || {
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

      const currentDay =
        existing.byDate.get(dateISO) || {
          date: dateISO,
          entries: [],
          workedMinutes: 0,
          breakMinutes: 0,
          payableMinutes: 0,
          regularMinutes: 0,
          overtimeMinutes: 0,
          doubleMinutes: 0,
          billAmount: 0,
        };

      currentDay.entries.push(e);
      currentDay.workedMinutes += workedMinutes;
      currentDay.breakMinutes += breakMinutes;
      currentDay.payableMinutes += payableMinutes;
      currentDay.regularMinutes += buckets.regularMinutes;
      currentDay.overtimeMinutes += buckets.overtimeMinutes;
      currentDay.doubleMinutes += buckets.doubleMinutes;
      currentDay.billAmount += entryBillAmount;

      existing.byDate.set(dateISO, currentDay);
      employeeMap.set(employeeId, existing);
    }

    const employees = Array.from(employeeMap.values()).sort((a, b) => {
      const at = String(a.title || "").toUpperCase();
      const bt = String(b.title || "").toUpperCase();

      const ai = billingTitleOrder.indexOf(at);
      const bi = billingTitleOrder.indexOf(bt);

      if (ai !== bi) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        return ai - bi;
      }

      return a.name.localeCompare(b.name);
    });

    for (const emp of employees) {
      let regularHours = 0;
      let overtimeHours = 0;
      let doubleHours = 0;
      let amountToBill = 0;

      for (const [, day] of emp.byDate) {
        regularHours += day.regularMinutes / 60;
        overtimeHours += day.overtimeMinutes / 60;
        doubleHours += day.doubleMinutes / 60;
        amountToBill += Number(day.billAmount || 0);
      }

      const totalHours = regularHours + overtimeHours + doubleHours;

      emp.totals = {
        holidayHours: 0,
        totalHours: currencyExcel(totalHours),
        regularHours: currencyExcel(regularHours),
        overtimeHours: currencyExcel(overtimeHours),
        doubleHours: currencyExcel(doubleHours),
        holidayPay: 0,
        amountToBill: currencyExcel(amountToBill),
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

    const totalHeaderRow = addSheetTitle(
      totalSheet,
      `${facility.name} - Billing Summary`,
      `Pay Period: ${from} to ${to}`,
      10
    );

    styleHeaderRow(totalSheet, totalHeaderRow);
    totalSheet.views = [{ state: "frozen", ySplit: totalHeaderRow }];

    const employeesByTitle = new Map<string, typeof employees[number][]>();

    for (const emp of employees) {
      const title = String(emp.title || "UNASSIGNED").toUpperCase();
      const list = employeesByTitle.get(title) || [];
      list.push(emp);
      employeesByTitle.set(title, list);
    }

    const sortedTitles = Array.from(employeesByTitle.keys()).sort((a, b) => {
      const ai = billingTitleOrder.indexOf(a);
      const bi = billingTitleOrder.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
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
      const group = (employeesByTitle.get(title) || []) as typeof employees[number][];
	group.sort((a, b) => a.name.localeCompare(b.name));
      const titleRow = totalSheet.addRow({
        name: title,
      });
      titleRow.font = { bold: true };
      titleRow.eachCell((cell: any) => {
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
        holidayHours: currencyExcel(subHolidayHours),
        totalHours: currencyExcel(subTotalHours),
        regularHours: currencyExcel(subRegularHours),
        overtimeHours: currencyExcel(subOvertimeHours),
        doubleHours: currencyExcel(subDoubleHours),
        holidayPay: currencyExcel(subHolidayPay),
        amount: currencyExcel(subAmount),
      });

      subtotalRow.font = { bold: true };
      subtotalRow.eachCell((cell: any) => {
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
      holidayHours: currencyExcel(groupGrandHolidayHours),
      totalHours: currencyExcel(groupGrandTotalHours),
      regularHours: currencyExcel(groupGrandRegularHours),
      overtimeHours: currencyExcel(groupGrandOvertimeHours),
      doubleHours: currencyExcel(groupGrandDoubleHours),
      holidayPay: currencyExcel(groupGrandHolidayPay),
      amount: currencyExcel(groupGrandAmount),
    });

    totalRow.font = { bold: true };
    totalRow.eachCell((cell: any) => {
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
        header: `${fmtWeekdayShort(d)} ${d.slice(5)}`,
        key: d,
        width: 12,
      })),
      { header: "Total", key: "total", width: 12 },
    ];

    const summaryHeaderRow = addSheetTitle(
      summarySheet,
      `${facility.name} - Daily Hours Grid`,
      `Pay Period: ${from} to ${to}`,
      dates.length + 2
    );
    styleHeaderRow(summarySheet, summaryHeaderRow);
    summarySheet.views = [{ state: "frozen", ySplit: summaryHeaderRow, xSplit: 1 }];

    for (const emp of employees) {
      const row: Record<string, any> = { name: emp.name };

      let total = 0;
      for (const d of dates) {
        const day = emp.byDate.get(d);
        const hours = day ? currencyExcel(day.payableMinutes / 60) : 0;
        row[d] = hours || "";
        total += hours;
      }
      row.total = currencyExcel(total);
      summarySheet.addRow(row);
    }

    const totalSummaryRow: Record<string, any> = { name: "Grand Total" };

    let grandTotalHours = 0;
    for (const d of dates) {
      const dayTotal = currencyExcel(
        employees.reduce((sum, emp) => {
          const day = emp.byDate.get(d);
          return sum + (day ? day.payableMinutes / 60 : 0);
        }, 0)
      );
      totalSummaryRow[d] = dayTotal || "";
      grandTotalHours += dayTotal;
    }
    totalSummaryRow.total = currencyExcel(grandTotalHours);

    const summaryGrandRow = summarySheet.addRow(totalSummaryRow);
    summaryGrandRow.font = { bold: true };
    summaryGrandRow.eachCell((cell: any) => {
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

      row.eachCell((cell: any) => {
        cell.border = {
          top: { style: "thin", color: { argb: "FFE5E7EB" } },
          left: { style: "thin", color: { argb: "FFE5E7EB" } },
          bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
          right: { style: "thin", color: { argb: "FFE5E7EB" } },
        };
      });
    }

    for (const emp of employees) {
      const ws = workbook.addWorksheet(
        safeSheetName(`${emp.title || "STAFF"} - ${emp.name}`)
      );

      ws.addRow([`Employee: ${emp.name}   |   Facility: ${facility.name}   |   Period: ${from} to ${to}`]);
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
        "OT",
        "DT",
      ]);

      styleHeaderRow(ws, 3);
      ws.views = [{ state: "frozen", ySplit: 3, xSplit: 2 }];

      for (const d of dates) {
        const day = emp.byDate.get(d);

        const punches = (day?.entries || []).flatMap((entry: any) =>
          buildExportPunchPairs(entry)
        );

        const pair = (idx: number, field: "clockIn" | "clockOut") =>
          punches[idx] ? isoToDisplayTime(punches[idx][field]) : "";

        const totalHours = day ? currencyExcel(day.payableMinutes / 60) : 0;
        const regular = day ? currencyExcel(day.regularMinutes / 60) : 0;
        const ot = day ? currencyExcel(day.overtimeMinutes / 60) : 0;
        const dt = day ? currencyExcel(day.doubleMinutes / 60) : 0;

        ws.addRow({
          date: d,
          day: fmtWeekdayShort(d),
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
          ot: ot || "",
          dt: dt || "",
        });
      }

      const totalRegular = currencyExcel(
        Array.from(emp.byDate.values()).reduce(
          (s: number, day: any) => s + day.regularMinutes / 60,
          0
        )
      );

      const totalOt = currencyExcel(
        Array.from(emp.byDate.values()).reduce(
          (s: number, day: any) => s + day.overtimeMinutes / 60,
          0
        )
      );

      const totalDt = currencyExcel(
        Array.from(emp.byDate.values()).reduce(
          (s: number, day: any) => s + day.doubleMinutes / 60,
          0
        )
      );

      const totalAll = currencyExcel(totalRegular + totalOt + totalDt);

      const totalsRow = ws.addRow({
        date: "",
        day: "TOTAL",
        totalHours: totalAll,
        regular: totalRegular,
        ot: totalOt,
        dt: totalDt,
      });

      totalsRow.font = { bold: true };
      totalsRow.eachCell((cell: any) => {
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

        ws.getRow(i).eachCell((cell: any) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };
        });
      }

      autoSizeColumns(ws, 10, 18);
    }

    autoSizeColumns(totalSheet, 10, 28);
    autoSizeColumns(summarySheet, 10, 18);

    const filename = `${facility.name} Billing ${from} to ${to}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    return res.end();
  } catch (e: any) {
    console.error("GET /api/admin/billing-export failed:", e);
    return res.status(400).json({ error: e?.message || "Failed to export billing file" });
  }
});

export default router;
