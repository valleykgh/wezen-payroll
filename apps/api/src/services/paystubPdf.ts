import PDFDocument from "pdfkit";
function money(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function hours(minutes: number) {
  return (Number(minutes || 0) / 60).toFixed(2);
}

function text(doc: any, value: string, x: number, y: number, opts: any = {}) {  
  doc.text(value || "", x, y, opts);
}

export async function generatePaystubPdf(data: any) {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margin: 40,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      const { company, employee, payPeriod, totals, adjustments, loanDeductions } = data;

      const pageWidth = doc.page.width;
      const leftX = 40;
      const rightX = 340;
      let y = 40;

      // Header
      doc.font("Helvetica-Bold").fontSize(18);
      text(doc, company.legalName || "Wezen Staffing", leftX, y);

      doc.font("Helvetica").fontSize(10);
      y += 24;
      if (company.addressLine1) text(doc, company.addressLine1, leftX, y);
      y += 14;
      const companyCityLine = [company.city, company.state, company.zip].filter(Boolean).join(", ").replace(", ", ", ");
      if (companyCityLine) text(doc, companyCityLine, leftX, y);

      let rightY = 40;
      doc.font("Helvetica-Bold").fontSize(11);
      text(doc, "Employee", rightX, rightY);
      rightY += 16;

      doc.font("Helvetica").fontSize(10);
      text(doc, employee.legalName || "", rightX, rightY);
      rightY += 14;
      if (employee.addressLine1) {
        text(doc, employee.addressLine1, rightX, rightY);
        rightY += 14;
      }
      if (employee.addressLine2) {
        text(doc, employee.addressLine2, rightX, rightY);
        rightY += 14;
      }
      const employeeCityLine = [employee.city, employee.state, employee.zip].filter(Boolean).join(", ");
      if (employeeCityLine) {
        text(doc, employeeCityLine, rightX, rightY);
        rightY += 14;
      }
      text(doc, `SSN: XXX-XX-${employee.ssnLast4 || "----"}`, rightX, rightY);

      y = Math.max(y + 30, rightY + 30);

      // Divider
      doc.moveTo(leftX, y).lineTo(pageWidth - 40, y).strokeColor("#cccccc").stroke();
      y += 16;

      // Pay info row
      doc.font("Helvetica-Bold").fontSize(10);
      text(doc, "Pay Period", leftX, y);
      text(doc, "Pay Date", 220, y);
      text(doc, "Payable Hours", 360, y);

      y += 14;
      doc.font("Helvetica").fontSize(10);
      text(doc, `${payPeriod.from} - ${payPeriod.to}`, leftX, y);
      text(doc, payPeriod.payDate || "", 220, y);
      text(doc, String(totals.payableHours ?? ""), 360, y);

      y += 24;

      // Earnings table
      doc.font("Helvetica-Bold").fontSize(11);
      text(doc, "Earnings", leftX, y);
      y += 18;

      const col1 = leftX;
      const col2 = 250;
      const col3 = 340;
      const col4 = 450;

      doc.font("Helvetica-Bold").fontSize(10);
      text(doc, "Type", col1, y);
      text(doc, "Hours", col2, y);
      text(doc, "Rate", col3, y);
      text(doc, "Amount", col4, y, { width: 90, align: "right" });

      y += 14;
      doc.moveTo(leftX, y).lineTo(pageWidth - 40, y).strokeColor("#dddddd").stroke();
      y += 8;

      doc.font("Helvetica").fontSize(10);

      const rows = [
        {
          label: "Regular",
          hrs: hours(totals.regularMinutes || 0),
          rate: money(employee.hourlyRateCents || 0),
          amount: money(totals.regularPayCents || 0),
        },
        {
          label: "Overtime",
          hrs: hours(totals.overtimeMinutes || 0),
          rate: money(Math.round((employee.hourlyRateCents || 0) * 1.5)),
          amount: money(totals.overtimePayCents || 0),
        },
        {
          label: "Doubletime",
          hrs: hours(totals.doubleMinutes || 0),
          rate: money(Math.round((employee.hourlyRateCents || 0) * 2)),
          amount: money(totals.doublePayCents || 0),
        },
      ];

      for (const row of rows) {
        text(doc, row.label, col1, y);
        text(doc, row.hrs, col2, y);
        text(doc, row.rate, col3, y);
        text(doc, row.amount, col4, y, { width: 90, align: "right" });
        y += 18;
      }

      y += 8;

      // Adjustments / deductions
      doc.font("Helvetica-Bold").fontSize(11);
      text(doc, "Adjustments & Deductions", leftX, y);
      y += 18;

      doc.font("Helvetica").fontSize(10);

      text(doc, "Adjustments", col1, y);
      text(doc, money(totals.adjustmentsCents || 0), col4, y, { width: 90, align: "right" });
      y += 18;

      text(doc, "Loan Deductions", col1, y);
      text(doc, `-${money(totals.loanDeductionCents || 0)}`, col4, y, { width: 90, align: "right" });
      y += 24;

      // Totals box
      doc.rect(330, y - 6, 205, 70).strokeColor("#cccccc").stroke();

      doc.font("Helvetica").fontSize(10);
      text(doc, "Gross Pay", 345, y + 6);
      text(doc, money(totals.grossPayCents || 0), 435, y + 6, { width: 85, align: "right" });

      text(doc, "Net Pay", 345, y + 28);
      doc.font("Helvetica-Bold").fontSize(12);
      text(doc, money(totals.netPayCents || 0), 425, y + 26, { width: 95, align: "right" });

      y += 90;

      // Optional notes area
      if ((adjustments?.length || 0) > 0 || (loanDeductions?.length || 0) > 0) {
        doc.font("Helvetica-Bold").fontSize(11);
        text(doc, "Details", leftX, y);
        y += 18;

        doc.font("Helvetica").fontSize(9);

        for (const a of adjustments || []) {
          text(
            doc,
            `Adjustment • ${String(a.createdAt || "").slice(0, 10)} • ${money(a.amountCents || 0)}${a.reason ? ` • ${a.reason}` : ""}`,
            leftX,
            y,
            { width: 500 }
          );
          y += 14;
        }

        for (const d of loanDeductions || []) {
          text(
            doc,
            `Loan deduction • ${money(d.amountCents || 0)}${d.note ? ` • ${d.note}` : ""}`,
            leftX,
            y,
            { width: 500 }
          );
          y += 14;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
