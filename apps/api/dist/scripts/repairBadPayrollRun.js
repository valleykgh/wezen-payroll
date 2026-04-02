"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../prisma");
async function main() {
    const periodStart = process.env.PERIOD_START?.trim();
    const periodEnd = process.env.PERIOD_END?.trim();
    const employeeEmail = process.env.EMPLOYEE_EMAIL?.trim().toLowerCase();
    if (!periodStart || !periodEnd || !employeeEmail) {
        throw new Error("PERIOD_START, PERIOD_END, and EMPLOYEE_EMAIL are required");
    }
    const run = await prisma_1.prisma.payrollRun.findFirst({
        where: {
            periodStart: new Date(`${periodStart}T00:00:00.000Z`),
            periodEnd: new Date(`${periodEnd}T00:00:00.000Z`),
            status: "FINALIZED",
        },
        include: {
            employees: {
                include: {
                    employee: {
                        select: {
                            id: true,
                            email: true,
                            legalName: true,
                        },
                    },
                },
            },
        },
    });
    if (!run) {
        throw new Error(`No finalized payroll run found for ${periodStart} -> ${periodEnd}`);
    }
    const runEmp = run.employees.find((r) => String(r.employee?.email || "").toLowerCase() === employeeEmail);
    if (!runEmp) {
        throw new Error(`No employee ${employeeEmail} found in payroll run ${run.id}`);
    }
    const employeeId = runEmp.employeeId;
    const badAdjustments = await prisma_1.prisma.payrollAdjustment.findMany({
        where: {
            employeeId,
            payrollRunId: run.id,
            paidImmediately: true,
            reason: {
                contains: "TIME_ENTRY_PAY_NOW",
                mode: "insensitive",
            },
            workDate: {
                gte: new Date(`${periodStart}T00:00:00.000Z`),
                lt: new Date(new Date(`${periodEnd}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000),
            },
        },
        select: {
            id: true,
            amountCents: true,
            reason: true,
            payrollRunId: true,
        },
    });
    const duplicateAdjustmentCents = badAdjustments.reduce((sum, a) => sum + Number(a.amountCents || 0), 0);
    console.log("Run:", run.id);
    console.log("Employee:", runEmp.employee?.legalName, runEmp.employee?.email);
    console.log("Before:", {
        grossPayCents: runEmp.grossPayCents,
        adjustmentsCents: runEmp.adjustmentsCents,
        netPayCents: runEmp.netPayCents,
        paidEarlyAmountCents: runEmp.paidEarlyAmountCents,
    });
    console.log("Bad adjustments:", badAdjustments);
    console.log("Duplicate adjustment cents to remove:", duplicateAdjustmentCents);
    if (duplicateAdjustmentCents <= 0) {
        console.log("Nothing to repair.");
        return;
    }
    const newAdjustmentsCents = Number(runEmp.adjustmentsCents || 0) - duplicateAdjustmentCents;
    const newNetPayCents = Number(runEmp.netPayCents || 0) - duplicateAdjustmentCents;
    if (newAdjustmentsCents < 0) {
        throw new Error(`Repair would make adjustmentsCents negative. Current=${runEmp.adjustmentsCents}, remove=${duplicateAdjustmentCents}`);
    }
    await prisma_1.prisma.$transaction(async (tx) => {
        await tx.payrollRunEmployee.update({
            where: { id: runEmp.id },
            data: {
                adjustmentsCents: newAdjustmentsCents,
                netPayCents: newNetPayCents,
            },
        });
        await tx.payrollAdjustment.updateMany({
            where: {
                id: { in: badAdjustments.map((a) => a.id) },
            },
            data: {
                payrollRunId: null,
            },
        });
    });
    const repaired = await prisma_1.prisma.payrollRunEmployee.findUnique({
        where: { id: runEmp.id },
        select: {
            grossPayCents: true,
            adjustmentsCents: true,
            netPayCents: true,
            paidEarlyAmountCents: true,
        },
    });
    console.log("After:", repaired);
    console.log("Repair completed.");
}
main()
    .catch((err) => {
    console.error("Repair failed:", err);
    process.exit(1);
})
    .finally(async () => {
    await prisma_1.prisma.$disconnect();
});
