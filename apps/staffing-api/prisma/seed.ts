import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  ClinicianRole,
  ShiftType,
  UserRole,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/wezen_staffing';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const facility = await prisma.facility.upsert({
    where: { id: 'seed-facility-1' },
    update: {},
    create: {
      id: 'seed-facility-1',
      name: 'Mission Ridge Rehab',
      city: 'Bakersfield',
      state: 'CA',
      zipCode: '93301',
    },
  });

  const professionalUser = await prisma.user.upsert({
    where: { email: 'demo.worker@wezenstaffing.com' },
    update: {},
    create: {
      id: 'demo-user-1',
      email: 'demo.worker@wezenstaffing.com',
      role: UserRole.PROFESSIONAL,
      firstName: 'Demo',
      lastName: 'Worker',
    },
  });

  const professionalProfile = await prisma.professionalProfile.upsert({
    where: { userId: professionalUser.id },
    update: {},
    create: {
      id: 'demo-professional-1',
      userId: professionalUser.id,
      role: ClinicianRole.LVN,
      city: 'Bakersfield',
      state: 'CA',
      zipCode: '93301',
      maxDistanceMiles: 25,
      approvedByWezen: true,
      onboardingStatus: 'APPROVED',
    },
  });

  const existingDocs = await prisma.professionalDocument.findMany({
    where: { professionalId: professionalProfile.id },
    select: { id: true },
  });

  if (existingDocs.length === 0) {
    await prisma.professionalDocument.createMany({
      data: [
        {
          professionalId: professionalProfile.id,
          category: 'LICENSE',
          name: 'LVN License',
          fileUrl: 'https://example.com/license.pdf',
          status: 'APPROVED',
        },
        {
          professionalId: professionalProfile.id,
          category: 'CPR',
          name: 'CPR Certification',
          fileUrl: 'https://example.com/cpr.pdf',
          status: 'PENDING',
        },
        {
          professionalId: professionalProfile.id,
          category: 'TB_TEST',
          name: 'TB Test',
          fileUrl: 'https://example.com/tb-test.pdf',
          status: 'REJECTED',
          notes: 'Please upload a more recent TB test.',
        },
      ],
    });
  }

  await prisma.professionalAgreement.upsert({
    where: {
      professionalId_agreementType: {
        professionalId: professionalProfile.id,
        agreementType: 'ICA',
      },
    },
    update: {},
    create: {
      professionalId: professionalProfile.id,
      agreementType: 'ICA',
      status: 'NOT_STARTED',
    },
  });

  const existingShifts = await prisma.shift.findMany({
    where: { facilityId: facility.id },
    select: { id: true },
  });

  if (existingShifts.length === 0) {
    await prisma.shift.createMany({
      data: [
        {
          facilityId: facility.id,
          role: ClinicianRole.CNA,
          shiftType: ShiftType.AM,
          date: new Date('2026-04-08T00:00:00.000Z'),
          startTimeLabel: '7:00 AM',
          endTimeLabel: '3:00 PM',
          workersNeeded: 2,
          payRateCents: 2600,
        },
        {
          facilityId: facility.id,
          role: ClinicianRole.LVN,
          shiftType: ShiftType.PM,
          date: new Date('2026-04-08T00:00:00.000Z'),
          startTimeLabel: '3:00 PM',
          endTimeLabel: '11:00 PM',
          workersNeeded: 1,
          payRateCents: 3800,
        },
      ],
    });
  }

  const adminEmail = 'admin@wezenstaffing.com';
  const adminPasswordHash = await bcrypt.hash('secret123', 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: 'INTERNAL_ADMIN',
      firstName: 'Wezen',
      lastName: 'Admin',
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
