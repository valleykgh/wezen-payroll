import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs"; // ✅ use bcryptjs (pure JS)
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ✅ Pick a role that exists in your enum.
  // If you're not sure, run:
  // grep -n "enum UserRole" -n prisma/schema.prisma -A20
  const ADMIN_ROLE = "ADMIN" as any;
  const passwordHash = await bcrypt.hash("Admin123!", 10);
  // Admin user
  const admin = await prisma.user.upsert({
    where: { email: "admin@wezenstaffing.com" },
    update: {},
    create: {
      email: "admin@wezenstaffing.com",
      role: ADMIN_ROLE,
      passwordHash,
    } as any,
  });
  // Facility (no organizationId)
  const facility = await prisma.facility.upsert({
    where: { name: "Vale Healthcare Center" } as any, // if name isn't unique, change to create() and use id
    update: {},
    create: {
      name: "Vale Healthcare Center",
    } as any,
  });

  // Employees (no organizationId)
  const cna = await prisma.employee.upsert({
    where: { email: "jane.cna@wezenstaffing.com" } as any,
    update: {},
    create: {
      legalName: "Jane CNA",
      preferredName: "Jane",
      email: "jane.cna@wezenstaffing.com",
      hourlyRateCents: 2500,
      billingRole: "CNA",
    } as any,
  });

  const lvn = await prisma.employee.upsert({
    where: { email: "john.lvn@wezenstaffing.com" } as any,
    update: {},
    create: {
      legalName: "John LVN",
      preferredName: "John",
      email: "john.lvn@wezenstaffing.com",
      hourlyRateCents: 3500,
      billingRole: "LVN",
    } as any,
  });

  // Contract + rates (your new tables)
  const contract = await prisma.facilityBillingContract.create({
    data: {
      facilityId: facility.id,
      title: "Default 2026 Contract",
      effectiveFrom: new Date("2026-01-01"),
      isLocked: false,
      lockedById: null,
    },
  });

  await prisma.facilityBillingRate.createMany({
    data: [
      {
        contractId: contract.id,
        role: "CNA",
        regRateCents: 4500,
        otRateCents: 6750,
        dtRateCents: 9000,
        holidayRateCents: 9000,
      },
      {
        contractId: contract.id,
        role: "LVN",
        regRateCents: 6500,
        otRateCents: 9750,
        dtRateCents: 13000,
        holidayRateCents: 13000,
      },
    ],
  });

  console.log("✅ Seed complete");
  console.log({ adminId: admin.id, facilityId: facility.id, cnaId: cna.id, lvnId: lvn.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
