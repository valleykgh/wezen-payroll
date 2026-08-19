import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { CandidateDetails, PAY_RATES, PaystubRecord } from "./paystubGenerator";

export type PaystubRates = {
  regular: number;
  overtime: number;
  doubleTime: number;
  holiday: number;
};

const INK = "#111827";
const MUTED = "#475569";
const BAND = "#F1F0EA";
const LINE = "#D9D7CF";

function dollars(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hours(value: number) {
  return Number(value || 0).toFixed(2);
}

function date(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(value);
}

function logoPath() {
  const candidates = [
    process.env.WEZEN_LOGO_PATH,
    path.resolve(process.cwd(), "assets/wezen-logo.png"),
    path.resolve(process.cwd(), "../../apps/staffing-web/public/icons/icon-512.png"),
    path.resolve(process.cwd(), "apps/staffing-web/public/icons/icon-512.png"),
  ].filter(Boolean) as string[];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function sectionBand(doc: PDFKit.PDFDocument, title: string, y: number) {
  doc.save().fillColor(BAND).rect(40, y, 532, 26).fill().restore();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(13).text(title, 40, y + 6, { width: 532, align: "center" });
}

function labelValue(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, labelWidth = 120, valueWidth = 145) {
  doc.save().fillColor(BAND).rect(x, y, labelWidth, 20).fill().restore();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(9).text(label, x + 6, y + 5, { width: labelWidth - 12 });
  doc.font("Helvetica").fontSize(9).text(value, x + labelWidth + 8, y + 5, { width: valueWidth });
}

function drawPaystub(doc: PDFKit.PDFDocument, employee: string, candidate: CandidateDetails, record: PaystubRecord, rates: PaystubRates) {
  const logo = logoPath();
  if (logo) doc.image(logo, 482, 24, { fit: [82, 82], align: "center", valign: "center" });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(12).text("Wezen Staffing", 40, 36);
  doc.font("Helvetica").fontSize(9).text("2498 Livorno Ct", 40, 54).text("Livermore, CA 94550", 40, 68);
  doc.font("Helvetica-Bold").fontSize(22).text("EARNINGS STATEMENT", 40, 112);

  sectionBand(doc, "EMPLOYEE DETAILS", 152);
  labelValue(doc, "NAME", employee, 52, 194, 112, 150);
  labelValue(doc, "PAY SCHEDULE", "Weekly", 315, 194, 105, 144);
  labelValue(doc, "ADDRESS", candidate.addressLine1, 52, 228, 112, 150);
  doc.font("Helvetica").fontSize(9).text(candidate.addressLine2, 172, 247, { width: 145 });
  labelValue(doc, "PAY PERIOD", `${date(record.periodStart)} to ${date(record.periodEnd)}`, 315, 228, 105, 144);
  labelValue(doc, "PAY DATE", date(record.payDate), 315, 262, 105, 144);
  labelValue(doc, "SOCIAL SECURITY", `XXX-XX-${candidate.ssnLast4}`, 52, 276, 112, 150);
  labelValue(doc, "EMPLOYEE ID", candidate.employeeId, 52, 310, 112, 150);

  sectionBand(doc, "EARNINGS", 350);
  const columns = { label: 105, rate: 286, hours: 374, amount: 466 };
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED);
  doc.text("RATE", columns.rate, 382, { width: 60, align: "right" });
  doc.text("HOURS", columns.hours, 382, { width: 60, align: "right" });
  doc.text("CURRENT", columns.amount, 382, { width: 74, align: "right" });
  const earnings = [
    ["REGULAR", rates.regular, record.regularHours],
    ["OVERTIME", rates.overtime, record.overtimeHours],
    ["DOUBLE", rates.doubleTime, record.doubleTimeHours],
    ["HOLIDAY", rates.holiday, record.holidayHours],
  ] as const;
  doc.font("Helvetica").fontSize(9).fillColor(INK);
  earnings.forEach(([label, rate, worked], index) => {
    const y = 402 + index * 18;
    doc.text(label, columns.label, y, { width: 130 });
    doc.text(dollars(rate), columns.rate, y, { width: 60, align: "right" });
    doc.text(hours(worked), columns.hours, y, { width: 60, align: "right" });
    doc.text(dollars(rate * worked), columns.amount, y, { width: 74, align: "right" });
  });

  sectionBand(doc, "PAYMENT RECONCILIATION", 484);
  doc.font("Helvetica").fontSize(9).fillColor(INK);
  doc.text("Calculated earnings", 285, 522, { width: 150 });
  doc.text(dollars(record.calculatedEarnings), 466, 522, { width: 74, align: "right" });
  doc.text("Previous / partial payment", 285, 542, { width: 170 });
  doc.text(dollars(record.previousPayment), 466, 542, { width: 74, align: "right" });
  doc.text("Actual / additional payment", 285, 562, { width: 170 });
  doc.text(dollars(record.actualPayment), 466, 562, { width: 74, align: "right" });

  sectionBand(doc, "TOTAL", 602);
  const totalHours = record.regularHours + record.overtimeHours + record.doubleTimeHours + record.holidayHours;
  doc.font("Helvetica").fontSize(10).fillColor(INK);
  doc.text("HOURS", 285, 640).text(hours(totalHours), 466, 640, { width: 74, align: "right" });
  doc.text("EARNINGS", 285, 661).text(dollars(record.calculatedEarnings), 466, 661, { width: 74, align: "right" });
  doc.font("Helvetica-Bold").fontSize(11).text("NET PAY", 285, 685).text(dollars(record.totalPaid), 456, 685, { width: 84, align: "right" });

  doc.save().strokeColor(LINE).lineWidth(0.75).moveTo(40, 726).lineTo(572, 726).stroke().restore();
  doc.font("Helvetica").fontSize(7.5).fillColor(MUTED).text(`Source: ${record.sourceFile}`, 40, 736, { width: 390 });
  doc.text(`Pay period ${date(record.periodStart)} - ${date(record.periodEnd)}`, 382, 736, { width: 190, align: "right" });
}

export function generateUploadedPaystubPdf(employee: string, candidate: CandidateDetails, records: PaystubRecord[], rates: PaystubRates = PAY_RATES) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: false, info: { Title: `${employee} Paystubs` } });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    records.forEach((sourceRecord) => {
      const record = {
        ...sourceRecord,
        calculatedEarnings: Math.round((
          sourceRecord.regularHours * rates.regular +
          sourceRecord.overtimeHours * rates.overtime +
          sourceRecord.doubleTimeHours * rates.doubleTime +
          sourceRecord.holidayHours * rates.holiday +
          Number.EPSILON
        ) * 100) / 100,
      };
      doc.addPage();
      drawPaystub(doc, employee, candidate, record, rates);
    });
    doc.end();
  });
}
