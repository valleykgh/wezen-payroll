import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import ExcelJS from "exceljs";
import { generatePaystubWorkbook, parsePayrollWorkbooks, recordsFor, summarize } from "./paystubGenerator";
import { generateUploadedPaystubPdf } from "./uploadedPaystubPdf";

async function sourceWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Hours");
  sheet.getCell("B1").value = new Date("2026-08-03T00:00:00Z");
  sheet.getCell("B2").value = new Date("2026-08-09T00:00:00Z");
  sheet.getCell("A13").value = "Test Employee";
  sheet.getCell("C13").value = "Facility A";
  sheet.getCell("F13").value = 8;
  sheet.getCell("N13").value = null;
  sheet.getCell("A14").value = "Test Employee";
  sheet.getCell("C14").value = "Facility A";
  sheet.getCell("F14").value = 10;
  sheet.getCell("G14").value = 2;
  sheet.getCell("K14").value = 100;
  sheet.getCell("N14").value = 300;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("ignores rows with blank N and totals K + N", async () => {
  const parsed = await parsePayrollWorkbooks([{ originalname: "week.xlsx", buffer: await sourceWorkbook() }]);
  const records = recordsFor(parsed, "Test Employee", 2026);
  assert.equal(records.length, 1);
  assert.equal(records[0].regularHours, 10);
  assert.equal(records[0].overtimeHours, 2);
  assert.equal(records[0].calculatedEarnings, 390);
  assert.equal(records[0].totalPaid, 400);
  assert.equal(records[0].periodStart.toISOString().slice(0, 10), "2026-08-03");
  assert.equal(records[0].periodEnd.toISOString().slice(0, 10), "2026-08-09");
  assert.equal(records[0].payDate.toISOString().slice(0, 10), "2026-08-14");
  assert.equal(summarize(records).totalPaid, 400);
});

test("parses the representative payroll fixture and creates the template-based output", async () => {
  const fixture = path.resolve(process.cwd(), "../../tools/payroll-toolkit/wezen-payroll-toolkit/tests/fixtures/151 - 6.29.2026 to 7.5.2026   - Copy.xlsx");
  assert.ok(fs.existsSync(fixture));
  const parsed = await parsePayrollWorkbooks([{ originalname: path.basename(fixture), buffer: fs.readFileSync(fixture) }]);
  assert.ok(parsed.employees.length > 0);
  const employee = parsed.employees[0];
  const records = recordsFor(parsed, employee, 2026);
  assert.ok(records.length > 0);
  const output = await generatePaystubWorkbook(employee, 2026, records, {
    addressLine1: "123 Main Street",
    addressLine2: "Oakland, CA 94601",
    ssnLast4: "4321",
    employeeId: "WS1001",
  });
  const generated = new ExcelJS.Workbook();
  await generated.xlsx.load(output as any);
  assert.ok(generated.getWorksheet("Summary"));
  assert.equal(generated.getWorksheet("PAYSTUB"), undefined);
  const paystub = generated.worksheets.find((sheet) => sheet.name.startsWith("PP-"));
  assert.ok(paystub);
  assert.equal(paystub.getCell("D14").value, "123 Main Street");
  assert.equal(paystub.getCell("D15").value, "Oakland, CA 94601");
  assert.equal(paystub.getCell("D17").value, "XXX-XX-4321");
  assert.equal(paystub.getCell("D19").value, "WS1001");

  const pdf = await generateUploadedPaystubPdf(employee, {
    addressLine1: "123 Main Street",
    addressLine2: "Oakland, CA 94601",
    ssnLast4: "4321",
    employeeId: "WS1001",
  }, records);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.equal(pdf.includes(Buffer.from("K + N")), false);
});
