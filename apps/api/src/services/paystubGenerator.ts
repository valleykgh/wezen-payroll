import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

export const PAY_RATES = {
  regular: 30,
  overtime: 45,
  doubleTime: 60,
  holiday: 45,
} as const;

export type UploadedWorkbook = { originalname: string; buffer: Buffer };

export type CandidateDetails = {
  addressLine1: string;
  addressLine2: string;
  ssnLast4: string;
  employeeId: string;
};

export type PaystubRecord = {
  sourceFile: string;
  employee: string;
  facility: string;
  periodStart: Date;
  periodEnd: Date;
  payDate: Date;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  holidayHours: number;
  previousPayment: number;
  actualPayment: number;
  totalPaid: number;
  calculatedEarnings: number;
};

type ParsedPayroll = {
  employees: string[];
  records: PaystubRecord[];
  warnings: string[];
};

function numericCell(cell: ExcelJS.Cell): number {
  const value: any = cell.value;
  const candidate = value && typeof value === "object" && "result" in value ? value.result : value;
  if (candidate == null || candidate === "") return 0;
  const number = Number(candidate);
  return Number.isFinite(number) ? number : 0;
}

function isBlankCell(cell: ExcelJS.Cell): boolean {
  const value: any = cell.value;
  const candidate = value && typeof value === "object" && "result" in value ? value.result : value;
  return candidate == null || String(candidate).trim() === "";
}

function dateCell(cell: ExcelJS.Cell): Date | null {
  const value: any = cell.value;
  const candidate = value && typeof value === "object" && "result" in value ? value.result : value;
  const parsed = candidate instanceof Date ? candidate : new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function safeDate(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number): Date {
  const result = safeDate(value);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function parsePayrollWorkbooks(files: UploadedWorkbook[]): Promise<ParsedPayroll> {
  const records: PaystubRecord[] = [];
  const employeeNames = new Map<string, string>();
  const warnings: string[] = [];

  for (const file of files) {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(file.buffer as any);
    } catch {
      warnings.push(`${file.originalname}: could not read workbook`);
      continue;
    }

    const sheet = workbook.getWorksheet("Hours");
    if (!sheet) {
      warnings.push(`${file.originalname}: Hours sheet not found`);
      continue;
    }

    const periodStart = dateCell(sheet.getCell("B1"));
    const periodEnd = dateCell(sheet.getCell("B2"));
    if (!periodStart || !periodEnd) {
      warnings.push(`${file.originalname}: invalid pay-period dates in Hours!B1:B2`);
      continue;
    }

    const byEmployee = new Map<string, PaystubRecord>();
    for (let rowNumber = 13; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const employee = String(row.getCell(1).text || "").trim();
      if (!employee || employee.toUpperCase() === "NAME" || isBlankCell(row.getCell(14))) continue;

      const key = employee.toLocaleLowerCase();
      employeeNames.set(key, employee);
      let record = byEmployee.get(key);
      if (!record) {
        record = {
          sourceFile: file.originalname,
          employee,
          facility: String(row.getCell(3).text || "").trim(),
          periodStart: safeDate(periodStart),
          periodEnd: safeDate(periodEnd),
          payDate: addDays(periodEnd, 5),
          regularHours: 0,
          overtimeHours: 0,
          doubleTimeHours: 0,
          holidayHours: 0,
          previousPayment: 0,
          actualPayment: 0,
          totalPaid: 0,
          calculatedEarnings: 0,
        };
        byEmployee.set(key, record);
      }

      record.regularHours += numericCell(row.getCell(6));
      record.overtimeHours += numericCell(row.getCell(7));
      record.doubleTimeHours += numericCell(row.getCell(8));
      record.holidayHours += numericCell(row.getCell(9));
      record.previousPayment += numericCell(row.getCell(11));
      record.actualPayment += numericCell(row.getCell(14));
      if (!record.facility) record.facility = String(row.getCell(3).text || "").trim();
    }

    for (const record of byEmployee.values()) {
      record.previousPayment = money(record.previousPayment);
      record.actualPayment = money(record.actualPayment);
      record.totalPaid = money(record.previousPayment + record.actualPayment);
      record.calculatedEarnings = money(
        record.regularHours * PAY_RATES.regular +
          record.overtimeHours * PAY_RATES.overtime +
          record.doubleTimeHours * PAY_RATES.doubleTime +
          record.holidayHours * PAY_RATES.holiday,
      );
      records.push(record);
    }
  }

  records.sort((a, b) => a.periodEnd.getTime() - b.periodEnd.getTime() || a.sourceFile.localeCompare(b.sourceFile));
  return {
    employees: [...employeeNames.values()].sort((a, b) => a.localeCompare(b)),
    records,
    warnings,
  };
}

export function recordsFor(parsed: ParsedPayroll, employee: string, year: number): PaystubRecord[] {
  const normalized = employee.trim().toLocaleLowerCase();
  return parsed.records.filter(
    (record) => record.employee.toLocaleLowerCase() === normalized && record.periodEnd.getUTCFullYear() === year,
  );
}

export function summarize(records: PaystubRecord[]) {
  return records.reduce(
    (total, record) => ({
      payPeriods: total.payPeriods + 1,
      regularHours: total.regularHours + record.regularHours,
      overtimeHours: total.overtimeHours + record.overtimeHours,
      doubleTimeHours: total.doubleTimeHours + record.doubleTimeHours,
      holidayHours: total.holidayHours + record.holidayHours,
      calculatedEarnings: money(total.calculatedEarnings + record.calculatedEarnings),
      previousPayments: money(total.previousPayments + record.previousPayment),
      actualPayments: money(total.actualPayments + record.actualPayment),
      totalPaid: money(total.totalPaid + record.totalPaid),
    }),
    {
      payPeriods: 0,
      regularHours: 0,
      overtimeHours: 0,
      doubleTimeHours: 0,
      holidayHours: 0,
      calculatedEarnings: 0,
      previousPayments: 0,
      actualPayments: 0,
      totalPaid: 0,
    },
  );
}

function templatePath(): string {
  const candidates = [
    process.env.PAYSTUB_TEMPLATE_PATH,
    path.resolve(process.cwd(), "assets/Wezen_Payroll_Toolkit_Starter.xlsm"),
    path.resolve(process.cwd(), "../../tools/payroll-toolkit/wezen-payroll-toolkit/templates/Wezen_Payroll_Toolkit_Starter.xlsm"),
    path.resolve(process.cwd(), "tools/payroll-toolkit/wezen-payroll-toolkit/templates/Wezen_Payroll_Toolkit_Starter.xlsm"),
  ].filter(Boolean) as string[];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("Paystub template is not available on the server");
  return found;
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "2-digit", year: "numeric" }).format(value);
}

function cloneTemplate(workbook: ExcelJS.Workbook, template: ExcelJS.Worksheet, name: string): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(name, {
    properties: { ...template.properties },
    pageSetup: { ...template.pageSetup },
    views: template.views.map((view) => ({ ...view })),
  });
  template.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
    sheet.getColumn(index + 1).hidden = column.hidden;
  });
  template.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const target = sheet.getRow(rowNumber);
    target.height = row.height;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      const output = target.getCell(columnNumber);
      output.value = cell.value as any;
      output.style = { ...cell.style };
      output.numFmt = cell.numFmt;
      output.alignment = cell.alignment ? { ...cell.alignment } : undefined;
      output.border = cell.border ? { ...cell.border } : undefined;
      output.fill = cell.fill ? { ...cell.fill } : undefined;
      output.font = cell.font ? { ...cell.font } : undefined;
      output.protection = cell.protection ? { ...cell.protection } : undefined;
    });
  });
  for (const range of Object.keys((template as any)._merges || {})) sheet.mergeCells(range);
  return sheet;
}

export async function generatePaystubWorkbook(
  employee: string,
  year: number,
  records: PaystubRecord[],
  candidate: CandidateDetails,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath());
  const template = workbook.getWorksheet("PAYSTUB");
  if (!template) throw new Error("PAYSTUB sheet is missing from the template");

  for (const sheet of [...workbook.worksheets]) {
    if (sheet.name !== "PAYSTUB") workbook.removeWorksheet(sheet.id);
  }
  template.state = "hidden";

  const summary = workbook.addWorksheet("Summary");
  summary.columns = [
    { header: "Pay Period Start", key: "periodStart", width: 18 },
    { header: "Pay Period End", key: "periodEnd", width: 18 },
    { header: "Pay Date", key: "payDate", width: 18 },
    { header: "Facility", key: "facility", width: 34 },
    { header: "Regular Hours", key: "regularHours", width: 15 },
    { header: "OT Hours", key: "overtimeHours", width: 12 },
    { header: "Double Hours", key: "doubleTimeHours", width: 14 },
    { header: "Holiday Hours", key: "holidayHours", width: 15 },
    { header: "Calculated Earnings", key: "calculatedEarnings", width: 20 },
    { header: "Column K", key: "previousPayment", width: 14 },
    { header: "Column N", key: "actualPayment", width: 14 },
    { header: "Total Paid (K+N)", key: "totalPaid", width: 18 },
    { header: "Source File", key: "sourceFile", width: 42 },
  ];
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF123A5A" } };
  summary.views = [{ state: "frozen", ySplit: 1 }];
  records.forEach((record) => summary.addRow(record));
  summary.getColumn("periodStart").numFmt = "mmmm d, yyyy";
  summary.getColumn("periodEnd").numFmt = "mmmm d, yyyy";
  summary.getColumn("payDate").numFmt = "mmmm d, yyyy";
  for (const key of ["calculatedEarnings", "previousPayment", "actualPayment", "totalPaid"]) summary.getColumn(key).numFmt = "$#,##0.00";
  summary.autoFilter = { from: "A1", to: "M1" };

  records.forEach((record, index) => {
    const name = `PP-${record.periodEnd.toISOString().slice(0, 10)}${index ? `-${index + 1}` : ""}`.slice(0, 31);
    const sheet = cloneTemplate(workbook, template, name);
    sheet.getCell("D12").value = employee;
    sheet.getCell("D14").value = candidate.addressLine1;
    sheet.getCell("D15").value = candidate.addressLine2;
    sheet.getCell("D17").value = `XXX-XX-${candidate.ssnLast4}`;
    sheet.getCell("D19").value = candidate.employeeId;
    sheet.getCell("H14").value = `${formatDate(record.periodStart)} to ${formatDate(record.periodEnd)}`;
    sheet.getCell("H16").value = record.payDate;
    sheet.getCell("H16").numFmt = "mmmm d, yyyy";
    const entries = [
      [23, PAY_RATES.regular, record.regularHours],
      [24, PAY_RATES.overtime, record.overtimeHours],
      [25, PAY_RATES.doubleTime, record.doubleTimeHours],
      [26, PAY_RATES.holiday, record.holidayHours],
    ];
    entries.forEach(([row, rate, hours]) => {
      sheet.getCell(`E${row}`).value = rate;
      sheet.getCell(`F${row}`).value = hours;
      sheet.getCell(`G${row}`).value = { formula: `E${row}*F${row}`, result: money(rate * hours) };
    });
    for (let row = 29; row <= 33; row += 1) sheet.getCell(`G${row}`).value = 0;
    sheet.getCell("G37").value = { formula: "SUM(F23:F26)", result: record.regularHours + record.overtimeHours + record.doubleTimeHours + record.holidayHours };
    sheet.getCell("G38").value = { formula: "SUM(G23:G26)", result: record.calculatedEarnings };
    sheet.getCell("G39").value = { formula: "SUM(G29:G33)", result: 0 };
    sheet.getCell("G40").value = record.totalPaid;
    sheet.getCell("G40").note = "Actual total paid from the source payroll workbook: Column K + Column N.";
    sheet.pageSetup.printArea = "A1:H40";
  });

  workbook.removeWorksheet(template.id);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}
