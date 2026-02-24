"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPayrollBatch = runPayrollBatch;
const client_1 = require("@prisma/client");
const stripe_1 = require("./stripe");
const prisma = new client_1.PrismaClient();
async function runPayrollBatch() {
    const timesheets = await prisma.timesheet.findMany({ where: { approved: true, paid: false } });
    for (const ts of timesheets) {
        const contractor = await prisma.contractor.findUnique({ where: { id: ts.contractorId } });
        if (contractor?.stripeAccountId) {
            await (0, stripe_1.payContractor)(ts.hours * contractor.hourlyRate * 100, "usd", contractor.stripeAccountId);
            await prisma.timesheet.update({ where: { id: ts.id }, data: { paid: true } });
        }
    }
    return { message: `Payroll run complete for ${timesheets.length} entries` };
}
