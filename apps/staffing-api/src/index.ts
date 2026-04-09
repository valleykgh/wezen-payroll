import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import {
  PrismaClient,
  ClinicianRole,
  ShiftType,
  ShiftStatus,
  UserRole,
} from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  hashPassword,
  verifyPassword,
  signAuthToken,
  setAuthCookie,
  clearAuthCookie,
  requireAuth,
  type AuthedRequest,
} from './auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { requireAuth, requireRole, type AuthedRequest } from './middleware/auth';

const app = express();
const port = Number(process.env.PORT || 4001);

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/wezen_staffing';

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '');
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const upload = multer({ storage });

async function getWorkerEligibility(professionalId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { id: professionalId },
    include: {
      documents: true,
      agreements: true,
    },
  });

  if (!profile) {
    return {
      eligible: false,
      reasons: ['Professional profile not found'],
    };
  }

  const reasons: string[] = [];

  if (!profile.approvedByWezen) {
    reasons.push('Worker has not been approved by Wezen yet');
  }

  const ica = profile.agreements.find((agreement) => agreement.agreementType === 'ICA');
  if (!ica || ica.status !== 'SIGNED') {
    reasons.push('Independent Contractor Agreement has not been signed');
  }

  const requiredCategories = ['LICENSE', 'CPR', 'TB_TEST'];

  for (const category of requiredCategories) {
    const doc = profile.documents.find((item) => item.category === category);

    if (!doc) {
      reasons.push(`Missing required document: ${category}`);
      continue;
    }

    if (doc.status === 'REJECTED') {
      reasons.push(`Rejected required document: ${category}`);
    }

    if (doc.status === 'EXPIRED') {
      reasons.push(`Expired required document: ${category}`);
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
async function createWorkerNotification(params: {
  professionalId: string;
  type: 'SHIFT_APPROVED' | 'SHIFT_REJECTED' | 'DOCUMENT_REJECTED' | 'DNR_BLOCK' | 'GENERAL';
  title: string;
  message: string;
}) {
  await prisma.workerNotification.create({
    data: {
      professionalId: params.professionalId,
      type: params.type,
      title: params.title,
      message: params.message,
    },
  });
}

async function getProfessionalProfileIdForUser(userId: string) {
  const profile = await prisma.professionalProfile.findUnique({
    where: { userId },
    select: { id: true },
  });

  return profile?.id ?? null;
}

async function getFacilityIdForUser(userId: string) {
  const facilityAdmin = await prisma.facilityAdmin.findUnique({
    where: { userId },
    select: { facilityId: true },
  });

  return facilityAdmin?.facilityId ?? null;
}

function generateInviteCode(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function ensureFacilityIsActive(facilityId: string) {
  const facility = await prisma.facility.findUnique({
    where: { id: facilityId },
    select: { id: true, isActive: true, name: true },
  });

  if (!facility) {
    return { ok: false as const, error: 'Facility not found' };
  }

  if (!facility.isActive) {
    return {
      ok: false as const,
      error: 'Facility access has been deactivated. Please contact Wezen Staffing support.',
    };
  }

  return { ok: true as const, facility };
}

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3001',
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));
app.use(cookieParser());

app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', service: 'staffing-api' });
});

const registerProfessionalSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.nativeEnum(ClinicianRole),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
});

const createFacilitySchema = z.object({
  name: z.string().min(1),
  facilityType: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  zipCode: z.string().min(1),
});

const adminShiftOverrideSchema = z.object({
  reason: z.string().min(3),
});

app.post('/api/auth/register-professional', async (req, res) => {
  const parsed = registerProfessionalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email,
        passwordHash,
        role: UserRole.PROFESSIONAL,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        professional: {
          create: {
            role: parsed.data.role,
            city: parsed.data.city,
            state: parsed.data.state,
            zipCode: parsed.data.zipCode,
            onboardingStatus: 'PENDING',
            approvedByWezen: false,
          },
        },
      },
      include: {
        professional: true,
      },
    });

    const token = signAuthToken({
      userId: user.id,
      role: user.role,
    });

    setAuthCookie(res, token);

    res.status(201).json({
      data: {
        userId: user.id,
        role: user.role,
        professionalId: user.professional?.id ?? null,
      },
    });
  } catch (error) {
    console.error('POST /api/auth/register-professional error:', error);
    res.status(500).json({ error: 'Failed to register professional' });
  }
});

const registerFacilitySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  inviteCode: z.string().min(1),
});


app.post('/api/auth/register-facility', async (req, res) => {
  const parsed = registerFacilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const invite = await prisma.facilityInvite.findUnique({
      where: {
        inviteCode: parsed.data.inviteCode,
      },
      include: {
        facility: true,
      },
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid facility invite code' });
    }

    if (invite.isUsed) {
      return res.status(400).json({ error: 'This facility invite code has already been used' });
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return res.status(400).json({ error: 'This facility invite code has expired' });
    }

    if (
      invite.email &&
      invite.email.toLowerCase() !== parsed.data.email.toLowerCase()
    ) {
      return res.status(400).json({
        error: 'This invite code is not valid for the provided email address',
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        role: UserRole.FACILITY_ADMIN,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
      },
    });

    const facilityAdmin = await prisma.facilityAdmin.create({
      data: {
        userId: user.id,
        facilityId: invite.facilityId,
      },
      include: {
        facility: true,
      },
    });

    await prisma.facilityInvite.update({
      where: { id: invite.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    const token = signAuthToken({
      userId: user.id,
      role: UserRole.FACILITY_ADMIN,
    });

    setAuthCookie(res, token);

    res.status(201).json({
      data: {
        userId: user.id,
        role: user.role,
        facilityId: facilityAdmin.facilityId,
      },
    });
  } catch (error) {
    console.error('POST /api/auth/register-facility error:', error);
    res.status(500).json({ error: 'Failed to register facility' });
  }
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: {
        professional: true,
        facilityAdmin: true,
      },
    });

    if (!user?.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = signAuthToken({
      userId: user.id,
      role: user.role,
    });

    setAuthCookie(res, token);

    res.json({
      data: {
        userId: user.id,
        role: user.role,
        professionalId: user.professional?.id ?? null,
        facilityId: user.facilityAdmin?.facilityId ?? null,
      },
    });
  } catch (error) {
    console.error('POST /api/auth/login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.post('/api/auth/logout', async (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = req.authUser.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        professional: true,
        facilityAdmin: {
          include: {
            facility: true,
          },
        },
      },
    });

    if (!user) {
      clearAuthCookie(res);
      return res.status(404).json({ error: 'User not found' });
    }

    if (
      user.role === 'FACILITY_ADMIN' &&
      user.facilityAdmin &&
      user.facilityAdmin.facility &&
      !user.facilityAdmin.facility.isActive
    ) {
      clearAuthCookie(res);
      return res.status(403).json({
        error: 'Facility access has been deactivated. Please contact Wezen Staffing support.',
      });
    }

    res.json({
      data: {
        userId: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        professionalId: user.professional?.id ?? null,
        facilityId: user.facilityAdmin?.facilityId ?? null,
      },
    });
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    res.status(500).json({ error: 'Failed to fetch current user' });
  }
});

app.get('/api/shifts', async (req, res) => {
  try {
    const facilityId = String(req.query.facilityId || '');
    const role = req.query.role as ClinicianRole | undefined;
    const shiftType = req.query.shiftType as ShiftType | undefined;

    const shifts = await prisma.shift.findMany({
    where: {
  ...(facilityId
    ? { facilityId }
    : { status: ShiftStatus.OPEN }),
  ...(role ? { role } : {}),
  ...(shiftType ? { shiftType } : {}),
},
   include: {
    facility: true,
    requests: {
      select: {
        status: true,
      },
    },
    _count: {
      select: { requests: true },
    },
  },
  orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
});

const data = shifts.map((shift) => {
  const totalRequests = shift._count.requests;

  const approvedCount = shift.requests
    ? shift.requests.filter((request) => request.status === 'APPROVED').length
    : 0;

  const pendingCount = shift.requests
    ? shift.requests.filter(
        (request) =>
          request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW'
      ).length
    : 0;

  const workersNeeded = shift.workersNeeded;

  let fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED' = 'OPEN';
  if (approvedCount > 0 && approvedCount < workersNeeded) {
    fillStatus = 'PARTIAL';
  }
  if (approvedCount >= workersNeeded) {
    fillStatus = 'FILLED';
  }

  return {
    id: shift.id,
    role: shift.role,
    facilityId: shift.facilityId,
    facilityName: shift.facility.name,
    city: shift.facility.city,
    state: shift.facility.state,
    distanceMiles: 0,
    shiftType: shift.shiftType,
    date: shift.date,
    time: `${shift.startTimeLabel} - ${shift.endTimeLabel}`,
    payRateLabel: shift.payRateCents
      ? `$${(shift.payRateCents / 100).toFixed(2)}/hr`
      : 'Rate not listed',
    applicants: totalRequests,
    workersNeeded,
    fillCount: approvedCount,
    pendingCount,
    fillStatus,
    fillLabel: `${approvedCount}/${workersNeeded} filled`,
    status: shift.status,
  };
});
    res.json({ data });
  } catch (error) {
    console.error('GET /api/shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch shifts' });
  }
});

const createShiftSchema = z.object({
  facilityId: z.string().min(1),
  role: z.nativeEnum(ClinicianRole),
  shiftType: z.nativeEnum(ShiftType),
  date: z.string().min(1),
  startTimeLabel: z.string().min(1),
  endTimeLabel: z.string().min(1),
  workersNeeded: z.number().int().positive(),
  specialInstructions: z.string().optional(),
  payRateCents: z.number().int().nonnegative().optional(),
});

app.post('/api/shifts', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  const parsed = createShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    const shift = await prisma.shift.create({
      data: {
        facilityId,
        role: parsed.data.role,
        shiftType: parsed.data.shiftType,
        date: new Date(parsed.data.date),
        startTimeLabel: parsed.data.startTimeLabel,
        endTimeLabel: parsed.data.endTimeLabel,
        workersNeeded: parsed.data.workersNeeded,
        specialInstructions: parsed.data.specialInstructions,
        payRateCents: parsed.data.payRateCents,
      },
    });

    res.status(201).json({ data: shift });
  } catch (error) {
    console.error('POST /api/shifts error:', error);
    res.status(500).json({ error: 'Failed to create shift' });
  }
});
const requestShiftSchema = z.object({
  shiftId: z.string().min(1),
});

app.post('/api/shift-requests', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  const parsed = requestShiftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const shift = await prisma.shift.findUnique({
  where: { id: parsed.data.shiftId },
  select: {
    id: true,
    facilityId: true,
    date: true,
    shiftType: true,
  },
});

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

        const facilityStatus = await ensureFacilityIsActive(shift.facilityId);
    if (!facilityStatus.ok) {
      return res.status(403).json({
        error: 'This facility is inactive and is no longer accepting shift requests',
      });
    }

    const dnr = await prisma.facilityDnr.findUnique({
      where: {
        facilityId_professionalId: {
          facilityId: shift.facilityId,
          professionalId,
        },
      },
    });

    if (dnr) {
      await createWorkerNotification({
        professionalId,
        type: 'DNR_BLOCK',
        title: 'Request blocked by facility',
        message: 'You cannot request shifts for this facility because you are on its Do Not Return list.',
      });

      return res.status(400).json({
        error: 'Worker is blocked from this facility',
        reasons: ['This facility has marked the worker as Do Not Return'],
      });
    }

    const eligibility = await getWorkerEligibility(professionalId);

    if (!eligibility.eligible) {
      return res.status(400).json({
        error: 'Worker is not eligible to request shifts',
        reasons: eligibility.reasons,
      });
    }

    const created = await prisma.shiftRequest.create({
      data: {
        shiftId: parsed.data.shiftId,
        professionalId,
      },
    });

    res.status(201).json({ data: created });
  } catch (error) {
    console.error('POST /api/shift-requests error:', error);
    res.status(500).json({ error: 'Failed to create shift request' });
  }
});

app.get('/api/facility/requests', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    const facilityStatus = await ensureFacilityIsActive(facilityId);
if (!facilityStatus.ok) {
  clearAuthCookie(res);
  return res.status(403).json({ error: facilityStatus.error });
}

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility not found for this user' });
    }

    const requests = await prisma.shiftRequest.findMany({
      where: {
        shift: {
          facilityId,
        },
      },
      include: {
        shift: {
          include: {
            facility: true,
          },
        },
        professional: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ requestedAt: 'desc' }],
    });

    res.json({
      data: requests.map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
        shift: {
          id: request.shift.id,
          role: request.shift.role,
          shiftType: request.shift.shiftType,
          date: request.shift.date,
          time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
          facilityName: request.shift.facility.name,
        },
        professional: {
          id: request.professional.id,
          firstName: request.professional.user.firstName,
          lastName: request.professional.user.lastName,
          email: request.professional.user.email,
          role: request.professional.role,
          city: request.professional.city,
          state: request.professional.state,
        },
      })),
    });
  } catch (error) {
    console.error('GET /api/facility/requests error:', error);
    res.status(500).json({ error: 'Failed to fetch facility requests' });
  }
});

app.post('/api/shift-requests/:id/approve', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
        clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const requestRecord = await prisma.shiftRequest.findUnique({
      where: { id },
      include: {
        shift: {
          select: {
            id: true,
            facilityId: true,
          },
        },
      },
    });

    if (!requestRecord) {
      return res.status(404).json({ error: 'Shift request not found' });
    }

    if (requestRecord.shift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.shiftRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
      },
    });

    await createWorkerNotification({
      professionalId: updated.professionalId,
      type: 'SHIFT_APPROVED',
      title: 'Shift approved',
      message: 'Your shift request has been approved by the facility.',
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/shift-requests/:id/approve error:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

app.post('/api/shift-requests/:id/reject', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    const requestRecord = await prisma.shiftRequest.findUnique({
      where: { id },
      include: {
        shift: {
          select: {
            id: true,
            facilityId: true,
          },
        },
      },
    });

    if (!requestRecord) {
      return res.status(404).json({ error: 'Shift request not found' });
    }

    if (requestRecord.shift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.shiftRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
      },
    });

    await createWorkerNotification({
      professionalId: updated.professionalId,
      type: 'SHIFT_REJECTED',
      title: 'Shift rejected',
      message: 'Your shift request has been rejected by the facility.',
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/shift-requests/:id/reject error:', error);
    res.status(500).json({ error: 'Failed to reject request' });
  }
});

app.get('/api/worker/requests', async (req, res) => {
  try {
    const professionalId = String(req.query.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const requests = await prisma.shiftRequest.findMany({
      where: { professionalId },
      include: {
        shift: {
          include: {
            facility: true,
          },
        },
      },
      orderBy: [{ requestedAt: 'desc' }],
    });

    const data = requests.map((request) => ({
      id: request.id,
      status: request.status,
      requestedAt: request.requestedAt,
      reviewedAt: request.reviewedAt,
      reviewNotes: request.reviewNotes,
      shift: {
        id: request.shift.id,
        role: request.shift.role,
        shiftType: request.shift.shiftType,
        date: request.shift.date,
        time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
        facilityName: request.shift.facility.name,
        city: request.shift.facility.city,
        state: request.shift.facility.state,
      },
    }));

    res.json({ data });
  } catch (error) {
    console.error('GET /api/worker/requests error:', error);
    res.status(500).json({ error: 'Failed to fetch worker requests' });
  }
});

app.get('/api/worker/profile', async (req, res) => {
  try {
    const professionalId = String(req.query.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const profile = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      include: {
        user: true,
      },
    });

    if (!profile) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    res.json({
      data: {
        id: profile.id,
        role: profile.role,
        city: profile.city,
        state: profile.state,
        zipCode: profile.zipCode,
        maxDistanceMiles: profile.maxDistanceMiles,
        hourlyRateCents: profile.hourlyRateCents,
        bio: profile.bio,
        onboardingStatus: profile.onboardingStatus,
        approvedByWezen: profile.approvedByWezen,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        email: profile.user.email,
        phone: profile.user.phone,
      },
    });
  } catch (error) {
    console.error('GET /api/worker/profile error:', error);
    res.status(500).json({ error: 'Failed to fetch worker profile' });
  }
});

const updateWorkerProfileSchema = z.object({
  professionalId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  maxDistanceMiles: z.number().int().positive().optional(),
  hourlyRateCents: z.number().int().nonnegative().optional(),
  bio: z.string().optional(),
});

app.put('/api/worker/profile', async (req, res) => {
  const parsed = updateWorkerProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const current = await prisma.professionalProfile.findUnique({
      where: { id: parsed.data.professionalId },
      select: { userId: true },
    });

    if (!current) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: parsed.data.professionalId },
      data: {
        city: parsed.data.city,
        state: parsed.data.state,
        zipCode: parsed.data.zipCode,
        maxDistanceMiles: parsed.data.maxDistanceMiles,
        hourlyRateCents: parsed.data.hourlyRateCents,
        bio: parsed.data.bio,
      },
      include: {
        user: true,
      },
    });

    await prisma.user.update({
      where: { id: current.userId },
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        phone: parsed.data.phone,
      },
    });

    res.json({
      data: {
        id: updated.id,
        role: updated.role,
        city: updated.city,
        state: updated.state,
        zipCode: updated.zipCode,
        maxDistanceMiles: updated.maxDistanceMiles,
        hourlyRateCents: updated.hourlyRateCents,
        bio: updated.bio,
        onboardingStatus: updated.onboardingStatus,
        approvedByWezen: updated.approvedByWezen,
      },
    });
  } catch (error) {
    console.error('PUT /api/worker/profile error:', error);
    res.status(500).json({ error: 'Failed to update worker profile' });
  }
});

app.get('/api/worker/documents', async (req, res) => {
  try {
    const professionalId = String(req.query.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const documents = await prisma.professionalDocument.findMany({
      where: { professionalId },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json({
      data: documents.map((doc) => ({
        id: doc.id,
        name: doc.name,
        category: doc.category,
        status: doc.status,
        expiresAt: doc.expiresAt,
        notes: doc.notes,
        fileUrl: doc.fileUrl,
        createdAt: doc.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/worker/documents error:', error);
    res.status(500).json({ error: 'Failed to fetch worker documents' });
  }
});

app.get('/api/worker/agreements', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    let agreements = await prisma.professionalAgreement.findMany({
      where: { professionalId },
      orderBy: [{ createdAt: 'desc' }],
    });

    if (agreements.length === 0) {
      await prisma.professionalAgreement.create({
        data: {
          professionalId,
          agreementType: 'ICA',
          status: 'NOT_STARTED',
        },
      });

      agreements = await prisma.professionalAgreement.findMany({
        where: { professionalId },
        orderBy: [{ createdAt: 'desc' }],
      });
    }

    res.json({
      data: agreements.map((agreement) => ({
        id: agreement.id,
        agreementType: agreement.agreementType,
        status: agreement.status,
        signedAt: agreement.signedAt,
        signerName: agreement.signerName,
        signerEmail: agreement.signerEmail,
        createdAt: agreement.createdAt,
      })),
    });
  } catch (error) {
    console.error('GET /api/worker/agreements error:', error);
    res.status(500).json({ error: 'Failed to fetch worker agreements' });
  }
});

const signAgreementSchema = z.object({
  agreementType: z.enum(['ICA']),
  signerName: z.string().min(1),
  signerEmail: z.email(),
});

app.post('/api/worker/agreements/sign', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  const parsed = signAgreementSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const agreement = await prisma.professionalAgreement.upsert({
      where: {
        professionalId_agreementType: {
          professionalId,
          agreementType: parsed.data.agreementType,
        },
      },
      update: {
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: parsed.data.signerName,
        signerEmail: parsed.data.signerEmail,
      },
      create: {
        professionalId,
        agreementType: parsed.data.agreementType,
        status: 'SIGNED',
        signedAt: new Date(),
        signerName: parsed.data.signerName,
        signerEmail: parsed.data.signerEmail,
      },
    });

    await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        onboardingStatus: 'AGREEMENT_SIGNED',
      },
    });

    res.json({
      data: {
        id: agreement.id,
        agreementType: agreement.agreementType,
        status: agreement.status,
        signedAt: agreement.signedAt,
        signerName: agreement.signerName,
        signerEmail: agreement.signerEmail,
      },
    });
  } catch (error) {
    console.error('POST /api/worker/agreements/sign error:', error);
    res.status(500).json({ error: 'Failed to sign agreement' });
  }
});

app.post('/api/worker/documents/upload', upload.single('file'), requireRole('PROFESSIONAL'), async (req, res) => {
  try {
    const professionalId = String(req.body.professionalId || '');
    const category = String(req.body.category || '');
    const name = String(req.body.name || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    if (!category) {
      return res.status(400).json({ error: 'category is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'file is required' });
    }

    const document = await prisma.professionalDocument.create({
      data: {
        professionalId,
        category: category as any,
        name: name || req.file.originalname,
        fileUrl: `http://localhost:4001/uploads/${req.file.filename}`,
        status: 'PENDING',
      },
    });

    res.status(201).json({
      data: {
        id: document.id,
        name: document.name,
        category: document.category,
        status: document.status,
        fileUrl: document.fileUrl,
        createdAt: document.createdAt,
      },
    });
  } catch (error) {
    console.error('POST /api/worker/documents/upload error:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

app.get('/api/facility/applicants/:requestId', requireRole('FACILITY_ADMIN'),  async (req, res) => {
  try {
    const requestId = String(req.params.requestId || '');

    if (!requestId) {
      return res.status(400).json({ error: 'requestId is required' });
    }

    const request = await prisma.shiftRequest.findUnique({
      where: { id: requestId },
      include: {
        shift: {
          include: {
            facility: true,
          },
        },
        professional: {
          include: {
            user: true,
            documents: true,
            facilityDnrs: true,
          },
        },
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Applicant request not found' });
    }

    res.json({
      data: {
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
        shift: {
          id: request.shift.id,
          role: request.shift.role,
          shiftType: request.shift.shiftType,
          date: request.shift.date,
          time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
          facilityName: request.shift.facility.name,
          city: request.shift.facility.city,
          state: request.shift.facility.state,
        },
        professional: {
          id: request.professional.id,
          role: request.professional.role,
          city: request.professional.city,
          state: request.professional.state,
          firstName: request.professional.user.firstName,
          lastName: request.professional.user.lastName,
          email: request.professional.user.email,
          phone: request.professional.user.phone,
          isDnr:
	  request.professional.facilityDnrs.some(
	    (item) => item.facilityId === request.shift.facilityId
	  ),
    	dnrReason:
	  request.professional.facilityDnrs.find(
	    (item) => item.facilityId === request.shift.facilityId
	  )?.reason ?? null,
          documents: request.professional.documents.map((doc) => ({
            id: doc.id,
            name: doc.name,
            category: doc.category,
            status: doc.status,
            expiresAt: doc.expiresAt,
            notes: doc.notes,
            fileUrl: doc.fileUrl,
            createdAt: doc.createdAt,
          })),
        },
      },
    });
  } catch (error) {
    console.error('GET /api/facility/applicants/:requestId error:', error);
    res.status(500).json({ error: 'Failed to fetch applicant detail' });
  }
});

app.get('/api/worker/eligibility', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const result = await getWorkerEligibility(professionalId);

    res.json({
      data: result,
    });
  } catch (error) {
    console.error('GET /api/worker/eligibility error:', error);
    res.status(500).json({ error: 'Failed to fetch worker eligibility' });
  }
});

app.get('/api/admin/workers', requireRole('INTERNAL_ADMIN'), async (_req, res) => {
  try {
    const workers = await prisma.professionalProfile.findMany({
      include: {
        user: true,
        documents: true,
        agreements: true,
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    res.json({
      data: workers.map((worker) => {
        const approvedDocs = worker.documents.filter((doc) => doc.status === 'APPROVED').length;
        const pendingDocs = worker.documents.filter((doc) => doc.status === 'PENDING').length;
        const rejectedDocs = worker.documents.filter((doc) => doc.status === 'REJECTED').length;
        const expiredDocs = worker.documents.filter((doc) => doc.status === 'EXPIRED').length;
        const ica = worker.agreements.find((agreement) => agreement.agreementType === 'ICA');

        return {
          id: worker.id,
          role: worker.role,
          firstName: worker.user.firstName,
          lastName: worker.user.lastName,
          email: worker.user.email,
          city: worker.city,
          state: worker.state,
          onboardingStatus: worker.onboardingStatus,
          approvedByWezen: worker.approvedByWezen,
          icaStatus: ica?.status || 'NOT_STARTED',
          counts: {
            approvedDocs,
            pendingDocs,
            rejectedDocs,
            expiredDocs,
            totalDocs: worker.documents.length,
          },
        };
      }),
    });
  } catch (error) {
    console.error('GET /api/admin/workers error:', error);
    res.status(500).json({ error: 'Failed to fetch admin workers list' });
  }
});

app.get('/api/admin/workers/:professionalId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
  try {
    const professionalId = String(req.params.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const worker = await prisma.professionalProfile.findUnique({
      where: { id: professionalId },
      include: {
        user: true,
        documents: true,
        agreements: true,
        requests: {
          include: {
            shift: {
              include: {
                facility: true,
              },
            },
          },
          orderBy: [{ requestedAt: 'desc' }],
        },
      },
    });

    if (!worker) {
      return res.status(404).json({ error: 'Worker not found' });
    }

    res.json({
      data: {
        id: worker.id,
        role: worker.role,
        city: worker.city,
        state: worker.state,
        zipCode: worker.zipCode,
        maxDistanceMiles: worker.maxDistanceMiles,
        hourlyRateCents: worker.hourlyRateCents,
        bio: worker.bio,
        onboardingStatus: worker.onboardingStatus,
        approvedByWezen: worker.approvedByWezen,
        firstName: worker.user.firstName,
        lastName: worker.user.lastName,
        email: worker.user.email,
        phone: worker.user.phone,
        documents: worker.documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          category: doc.category,
          status: doc.status,
          expiresAt: doc.expiresAt,
          notes: doc.notes,
          fileUrl: doc.fileUrl,
          createdAt: doc.createdAt,
        })),
        agreements: worker.agreements.map((agreement) => ({
          id: agreement.id,
          agreementType: agreement.agreementType,
          status: agreement.status,
          signedAt: agreement.signedAt,
          signerName: agreement.signerName,
          signerEmail: agreement.signerEmail,
        })),
        requests: worker.requests.map((request) => ({
          id: request.id,
          status: request.status,
          requestedAt: request.requestedAt,
          shift: {
            id: request.shift.id,
            role: request.shift.role,
            shiftType: request.shift.shiftType,
            date: request.shift.date,
            time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
            facilityName: request.shift.facility.name,
          },
        })),
      },
    });
  } catch (error) {
    console.error('GET /api/admin/workers/:professionalId error:', error);
    res.status(500).json({ error: 'Failed to fetch admin worker detail' });
  }
});

const adminRejectDocumentSchema = z.object({
  notes: z.string().min(1),
});

app.post('/api/admin/documents/:documentId/approve', requireRole('INTERNAL_ADMIN'), async (req, res) => {
  try {
    const documentId = String(req.params.documentId || '');

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const updated = await prisma.professionalDocument.update({
      where: { id: documentId },
      data: {
        status: 'APPROVED',
        notes: null,
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/admin/documents/:documentId/approve error:', error);
    res.status(500).json({ error: 'Failed to approve document' });
  }
});

app.post('/api/admin/documents/:documentId/reject', requireRole('INTERNAL_ADMIN'), async (req, res) => {
  const parsed = adminRejectDocumentSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const documentId = String(req.params.documentId || '');

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    const updated = await prisma.professionalDocument.update({
      where: { id: documentId },
      data: {
        status: 'REJECTED',
        notes: parsed.data.notes,
      },
    });

    await createWorkerNotification({
  professionalId: updated.professionalId,
  type: 'DOCUMENT_REJECTED',
  title: 'Document rejected',
  message: `Your document "${updated.name}" was rejected. Please review the rejection reason and upload an updated file.`,
});

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/admin/documents/:documentId/reject error:', error);
    res.status(500).json({ error: 'Failed to reject document' });
  }
});

app.post('/api/admin/workers/:professionalId/approve', requireRole('INTERNAL_ADMIN'), async (req, res) => {
  try {
    const professionalId = String(req.params.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        approvedByWezen: true,
        onboardingStatus: 'APPROVED',
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/admin/workers/:professionalId/approve error:', error);
    res.status(500).json({ error: 'Failed to approve worker' });
  }
});

app.post('/api/admin/workers/:professionalId/unapprove', requireRole('INTERNAL_ADMIN'), async (req, res) => {
  try {
    const professionalId = String(req.params.professionalId || '');

    if (!professionalId) {
      return res.status(400).json({ error: 'professionalId is required' });
    }

    const updated = await prisma.professionalProfile.update({
      where: { id: professionalId },
      data: {
        approvedByWezen: false,
        onboardingStatus: 'UNDER_REVIEW',
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/admin/workers/:professionalId/unapprove error:', error);
    res.status(500).json({ error: 'Failed to unapprove worker' });
  }
});

app.post('/api/shifts/:id/duplicate', async (req, res) => {
  try {
    const id = String(req.params.id || '');

    if (!id) {
      return res.status(400).json({ error: 'Shift id is required' });
    }

    const existing = await prisma.shift.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    const duplicated = await prisma.shift.create({
      data: {
        facilityId: existing.facilityId,
        role: existing.role,
        shiftType: existing.shiftType,
        date: existing.date,
        startTimeLabel: existing.startTimeLabel,
        endTimeLabel: existing.endTimeLabel,
        workersNeeded: existing.workersNeeded,
        specialInstructions: existing.specialInstructions,
        payRateCents: existing.payRateCents,
        status: 'OPEN',
      },
    });

    res.status(201).json({ data: duplicated });
  } catch (error) {
    console.error('POST /api/shifts/:id/duplicate error:', error);
    res.status(500).json({ error: 'Failed to duplicate shift' });
  }
});

app.get('/api/facility/shifts/:shiftId', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const shiftId = String(req.params.shiftId || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        facility: true,
        requests: {
          include: {
            professional: {
              include: {
                user: true,
                documents: true,
              },
            },
          },
          orderBy: [{ requestedAt: 'desc' }],
        },
      },
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (shift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const approvedCount = shift.requests.filter(
      (request) => request.status === 'APPROVED'
    ).length;

    const pendingCount = shift.requests.filter(
      (request) =>
        request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW'
    ).length;

    const rejectedCount = shift.requests.filter(
      (request) => request.status === 'REJECTED'
    ).length;

    const workersNeeded = shift.workersNeeded;
    let fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED' = 'OPEN';

    if (approvedCount > 0 && approvedCount < workersNeeded) {
      fillStatus = 'PARTIAL';
    }

    if (approvedCount >= workersNeeded) {
      fillStatus = 'FILLED';
    }

    res.json({
      data: {
        id: shift.id,
        facilityId: shift.facilityId,
        facilityName: shift.facility.name,
        role: shift.role,
        shiftType: shift.shiftType,
        date: shift.date,
        time: `${shift.startTimeLabel} - ${shift.endTimeLabel}`,
        workersNeeded,
        fillCount: approvedCount,
        pendingCount,
        rejectedCount,
        fillStatus,
        fillLabel: `${approvedCount}/${workersNeeded} filled`,
        status: shift.status,
        payRateLabel: shift.payRateCents
          ? `$${(shift.payRateCents / 100).toFixed(2)}/hr`
          : 'Rate not listed',
        specialInstructions: shift.specialInstructions,
        applicants: shift.requests.map((request) => ({
          id: request.id,
          status: request.status,
          requestedAt: request.requestedAt,
          reviewedAt: request.reviewedAt,
          professional: {
            id: request.professional.id,
            firstName: request.professional.user.firstName,
            lastName: request.professional.user.lastName,
            email: request.professional.user.email,
            role: request.professional.role,
            city: request.professional.city,
            state: request.professional.state,
            approvedDocCount: request.professional.documents.filter(
              (doc) => doc.status === 'APPROVED'
            ).length,
            pendingDocCount: request.professional.documents.filter(
              (doc) => doc.status === 'PENDING'
            ).length,
            rejectedDocCount: request.professional.documents.filter(
              (doc) => doc.status === 'REJECTED'
            ).length,
            expiredDocCount: request.professional.documents.filter(
              (doc) => doc.status === 'EXPIRED'
            ).length,
          },
        })),
      },
    });
  } catch (error) {
    console.error('GET /api/facility/shifts/:shiftId error:', error);
    res.status(500).json({ error: 'Failed to fetch shift detail' });
  }
});

const facilityDnrSchema = z.object({
  professionalId: z.string().min(1),
  reason: z.string().optional(),
});

app.post('/api/facility/dnr', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  const parsed = facilityDnrSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
       clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const created = await prisma.facilityDnr.upsert({
      where: {
        facilityId_professionalId: {
          facilityId,
          professionalId: parsed.data.professionalId,
        },
      },
      update: {
        reason: parsed.data.reason,
      },
      create: {
        facilityId,
        professionalId: parsed.data.professionalId,
        reason: parsed.data.reason,
      },
    });

    res.status(201).json({ data: created });
  } catch (error) {
    console.error('POST /api/facility/dnr error:', error);
    res.status(500).json({ error: 'Failed to add worker to DNR list' });
  }
});

app.delete('/api/facility/dnr', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  const professionalId = String(req.query.professionalId || '');

  if (!professionalId) {
    return res.status(400).json({ error: 'professionalId is required' });
  }

  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    await prisma.facilityDnr.delete({
      where: {
        facilityId_professionalId: {
          facilityId,
          professionalId,
        },
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/facility/dnr error:', error);
    res.status(500).json({ error: 'Failed to remove worker from DNR list' });
  }
});

app.get('/api/worker/shifts', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);
    const role = req.query.role as ClinicianRole | undefined;
    const shiftType = req.query.shiftType as ShiftType | undefined;

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const shifts = await prisma.shift.findMany({
      where: {
        status: ShiftStatus.OPEN,
        facility: { isActive: true, },
        ...(role ? { role } : {}),
        ...(shiftType ? { shiftType } : {}),
      },
      include: {
        facility: true,
        requests: {
          select: {
            status: true,
          },
        },
        _count: {
          select: { requests: true },
        },
      },
      orderBy: [{ date: 'asc' }, { createdAt: 'desc' }],
    });

    const dnrs = await prisma.facilityDnr.findMany({
      where: {
        professionalId,
      },
      select: {
        facilityId: true,
        reason: true,
      },
    });

    const dnrMap = new Map(dnrs.map((item) => [item.facilityId, item.reason || null]));

    const data = shifts.map((shift) => {
      const totalRequests = shift._count.requests;
      const approvedCount = shift.requests.filter(
        (request) => request.status === 'APPROVED'
      ).length;
      const pendingCount = shift.requests.filter(
        (request) =>
          request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW'
      ).length;

      const workersNeeded = shift.workersNeeded;

      let fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED' = 'OPEN';
      if (approvedCount > 0 && approvedCount < workersNeeded) {
        fillStatus = 'PARTIAL';
      }
      if (approvedCount >= workersNeeded) {
        fillStatus = 'FILLED';
      }

      const isBlockedByFacilityDnr = dnrMap.has(shift.facilityId);

      return {
        id: shift.id,
        role: shift.role,
        facilityId: shift.facilityId,
        facilityName: shift.facility.name,
        city: shift.facility.city,
        state: shift.facility.state,
        distanceMiles: 0,
        shiftType: shift.shiftType,
        date: shift.date,
        time: `${shift.startTimeLabel} - ${shift.endTimeLabel}`,
        payRateLabel: shift.payRateCents
          ? `$${(shift.payRateCents / 100).toFixed(2)}/hr`
          : 'Rate not listed',
        applicants: totalRequests,
        workersNeeded,
        fillCount: approvedCount,
        pendingCount,
        fillStatus,
        fillLabel: `${approvedCount}/${workersNeeded} filled`,
        status: shift.status,
        isBlockedByFacilityDnr,
        blockReason: isBlockedByFacilityDnr
          ? dnrMap.get(shift.facilityId) || 'This facility has restricted future requests.'
          : null,
      };
    });

    res.json({ data });
  } catch (error) {
    console.error('GET /api/worker/shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch worker shifts' });
  }
});

app.get('/api/worker/notifications', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const notifications = await prisma.workerNotification.findMany({
      where: { professionalId },
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json({
      data: notifications,
    });
  } catch (error) {
    console.error('GET /api/worker/notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch worker notifications' });
  }
});

app.post('/api/worker/notifications/:id/read', requireRole('PROFESSIONAL'), async (req, res) => {
  try {
    const id = String(req.params.id || '');

    if (!id) {
      return res.status(400).json({ error: 'Notification id is required' });
    }

    const updated = await prisma.workerNotification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/worker/notifications/:id/read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

app.post('/api/shifts/:id/close', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!id) {
      return res.status(400).json({ error: 'Shift id is required' });
    }

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
       clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        facilityId: true,
      },
    });

    if (!existingShift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (existingShift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'COMPLETED',
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/shifts/:id/close error:', error);
    res.status(500).json({ error: 'Failed to close shift' });
  }
});

app.post('/api/shifts/:id/reopen', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!id) {
      return res.status(400).json({ error: 'Shift id is required' });
    }

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
       clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        facilityId: true,
      },
    });

    if (!existingShift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (existingShift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'OPEN',
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/shifts/:id/reopen error:', error);
    res.status(500).json({ error: 'Failed to reopen shift' });
  }
});

app.post('/api/shifts/:id/cancel', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const id = String(req.params.id || '');
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!id) {
      return res.status(400).json({ error: 'Shift id is required' });
    }

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
       clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id },
      select: {
        id: true,
        facilityId: true,
      },
    });

    if (!existingShift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (existingShift.facilityId !== facilityId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('POST /api/shifts/:id/cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel shift' });
  }
});

app.get('/api/worker/notifications/unread-count', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    const count = await prisma.workerNotification.count({
      where: {
        professionalId,
        isRead: false,
      },
    });

    res.json({
      data: {
        unreadCount: count,
      },
    });
  } catch (error) {
    console.error('GET /api/worker/notifications/unread-count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread notification count' });
  }
});

app.post('/api/worker/notifications/mark-all-read', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const professionalId = await getProfessionalProfileIdForUser(userId);

    if (!professionalId) {
      return res.status(404).json({ error: 'Professional profile not found' });
    }

    await prisma.workerNotification.updateMany({
      where: {
        professionalId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('POST /api/worker/notifications/mark-all-read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});


app.get('/api/admin/facilities', requireRole('INTERNAL_ADMIN'), async (_req: AuthedRequest, res) => {
  try {
    const facilities = await prisma.facility.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        facilityType: true,
        city: true,
        state: true,
        zipCode: true,
        isActive: true,
      },
    });

    res.json({ data: facilities });
  } catch (error) {
    console.error('GET /api/admin/facilities error:', error);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

app.post('/api/admin/facility-invites', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const { facilityId, email, expiresAt } = req.body || {};

    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const facility = await prisma.facility.findUnique({
      where: { id: String(facilityId) },
      select: {
        id: true,
        name: true,
      },
    });

    if (!facility) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const invite = await prisma.facilityInvite.create({
      data: {
        facilityId: facility.id,
        inviteCode: generateInviteCode(),
        email: email ? String(email).toLowerCase() : null,
        expiresAt: expiresAt ? new Date(String(expiresAt)) : null,
      },
    });

    res.status(201).json({
      data: {
        id: invite.id,
        facilityId: invite.facilityId,
        facilityName: facility.name,
        inviteCode: invite.inviteCode,
        email: invite.email,
        isUsed: invite.isUsed,
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/facility-invites error:', error);
    res.status(500).json({ error: 'Failed to create facility invite' });
  }
});

app.post('/api/admin/facilities', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  const parsed = createFacilitySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const facility = await prisma.facility.create({
      data: {
        name: parsed.data.name,
        facilityType: parsed.data.facilityType,
        city: parsed.data.city,
        state: parsed.data.state,
        zipCode: parsed.data.zipCode,
      },
      select: {
        id: true,
        name: true,
        facilityType: true,
        city: true,
        state: true,
        zipCode: true,
      },
    });

    res.status(201).json({ data: facility });
  } catch (error) {
    console.error('POST /api/admin/facilities error:', error);
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

app.post('/api/admin/facilities/:facilityId/deactivate', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const facilityId = String(req.params.facilityId || '');

    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const facility = await tx.facility.update({
        where: { id: facilityId },
        data: { isActive: false },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      });

      await tx.shift.updateMany({
        where: {
          facilityId,
          status: ShiftStatus.OPEN,
        },
        data: {
          status: ShiftStatus.CANCELLED,
          adminOverrideReason: 'Facility deactivated by internal admin',
          adminOverrideByUserId: req.authUser!.userId,
          adminOverrideAt: new Date(),
        },
      });

      return facility;
    });

    res.json({ data: result });
  } catch (error) {
    console.error('POST /api/admin/facilities/:facilityId/deactivate error:', error);
    res.status(500).json({ error: 'Failed to deactivate facility' });
  }
});

app.post('/api/admin/facilities/:facilityId/reactivate', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const facilityId = String(req.params.facilityId || '');

    if (!facilityId) {
      return res.status(400).json({ error: 'facilityId is required' });
    }

    const facility = await prisma.facility.update({
      where: { id: facilityId },
      data: { isActive: true },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    res.json({ data: facility });
  } catch (error) {
    console.error('POST /api/admin/facilities/:facilityId/reactivate error:', error);
    res.status(500).json({ error: 'Failed to reactivate facility' });
  }
});

app.post('/api/admin/shifts/:shiftId/cancel', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  const parsed = adminShiftOverrideSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const shiftId = String(req.params.shiftId || '');
    const adminUserId = req.authUser!.userId;

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    const shift = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        status: 'CANCELLED',
        adminOverrideReason: parsed.data.reason,
        adminOverrideByUserId: adminUserId,
        adminOverrideAt: new Date(),
      },
      include: {
        facility: true,
      },
    });

    res.json({
      data: {
        id: shift.id,
        status: shift.status,
        facilityId: shift.facilityId,
        facilityName: shift.facility.name,
        date: shift.date,
        shiftType: shift.shiftType,
        adminOverrideReason: shift.adminOverrideReason,
        adminOverrideAt: shift.adminOverrideAt,
      },
    });
  } catch (error) {
    console.error('POST /api/admin/shifts/:shiftId/cancel error:', error);
    res.status(500).json({ error: 'Failed to cancel shift' });
  }
});

app.post(
  '/api/admin/shift-requests/:id/cancel',
  requireRole('INTERNAL_ADMIN'),
  async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id || '');

      if (!id) {
        return res.status(400).json({ error: 'Request id is required' });
      }

      const existing = await prisma.shiftRequest.findUnique({
        where: { id },
        include: {
          shift: {
            include: {
              facility: true,
            },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Shift request not found' });
      }

      const updated = await prisma.shiftRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          reviewedAt: new Date(),
          reviewNotes: 'Cancelled by internal admin',
        },
      });

      await createWorkerNotification({
        professionalId: updated.professionalId,
        type: 'SHIFT_CANCELLED',
        title: 'Shift request cancelled',
        message:
          'Your shift request was cancelled by Wezen Staffing. Please contact support if needed.',
      });

      res.json({
        data: {
          id: updated.id,
          status: updated.status,
          professionalId: updated.professionalId,
          shiftId: updated.shiftId,
          facilityName: existing.shift.facility.name,
          reviewedAt: updated.reviewedAt,
          reviewNotes: updated.reviewNotes,
        },
      });
    } catch (error) {
      console.error('POST /api/admin/shift-requests/:id/cancel error:', error);
      res.status(500).json({ error: 'Failed to cancel shift request' });
    }
  }
);

app.delete('/api/admin/shifts/:shiftId', requireRole('INTERNAL_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const shiftId = String(req.params.shiftId || '');

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    const existingShift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        facility: true,
      },
    });

    if (!existingShift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    await prisma.shift.delete({
      where: { id: shiftId },
    });

    res.json({
      data: {
        id: existingShift.id,
        facilityId: existingShift.facilityId,
        facilityName: existingShift.facility.name,
        role: existingShift.role,
        shiftType: existingShift.shiftType,
        date: existingShift.date,
        status: 'DELETED',
      },
    });
  } catch (error) {
    console.error('DELETE /api/admin/shifts/:shiftId error:', error);
    res.status(500).json({ error: 'Failed to delete shift' });
  }
});

app.get('/api/admin/shifts', requireRole('INTERNAL_ADMIN'), async (_req: AuthedRequest, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        facility: true,
        _count: {
          select: {
            requests: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({
      data: shifts.map((shift) => ({
        id: shift.id,
        facilityId: shift.facilityId,
        facilityName: shift.facility.name,
        facilityCity: shift.facility.city,
        facilityState: shift.facility.state,
        role: shift.role,
        shiftType: shift.shiftType,
        date: shift.date,
        startTimeLabel: shift.startTimeLabel,
        endTimeLabel: shift.endTimeLabel,
        workersNeeded: shift.workersNeeded,
        status: shift.status,
        requestCount: shift._count.requests,
        payRateLabel: shift.payRateCents
          ? `$${(shift.payRateCents / 100).toFixed(2)}/hr`
          : 'Rate not listed',
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/shifts error:', error);
    res.status(500).json({ error: 'Failed to fetch admin shifts' });
  }
});

app.get('/api/admin/shift-requests', requireRole('INTERNAL_ADMIN'), async (_req: AuthedRequest, res) => {
  try {
    const requests = await prisma.shiftRequest.findMany({
      include: {
        shift: {
          include: {
            facility: true,
          },
        },
        professional: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ requestedAt: 'desc' }],
    });

    res.json({
      data: requests.map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt,
        reviewNotes: request.reviewNotes,
        shift: {
          id: request.shift.id,
          role: request.shift.role,
          shiftType: request.shift.shiftType,
          date: request.shift.date,
          time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
          facilityName: request.shift.facility.name,
          facilityCity: request.shift.facility.city,
          facilityState: request.shift.facility.state,
        },
        professional: {
          id: request.professional.id,
          firstName: request.professional.user.firstName,
          lastName: request.professional.user.lastName,
          email: request.professional.user.email,
          role: request.professional.role,
          city: request.professional.city,
          state: request.professional.state,
        },
      })),
    });
  } catch (error) {
    console.error('GET /api/admin/shift-requests error:', error);
    res.status(500).json({ error: 'Failed to fetch admin shift requests' });
  }
});

app.get('/api/facility/dashboard', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
        clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const [shifts, requests, workers, complianceDocs] = await Promise.all([
      prisma.shift.findMany({
        where: {
          facilityId,
        },
        include: {
          requests: {
            select: {
              status: true,
            },
          },
        },
      }),
      prisma.shiftRequest.findMany({
        where: {
          shift: {
            facilityId,
          },
        },
        include: {
          professional: {
            include: {
              user: true,
              documents: true,
            },
          },
          shift: true,
        },
      }),
      prisma.professionalProfile.findMany({
        where: {
          requests: {
            some: {
              shift: {
                facilityId,
              },
            },
          },
        },
        include: {
          user: true,
        },
      }),
      prisma.professionalDocument.findMany({
        where: {
          professional: {
            requests: {
              some: {
                shift: {
                  facilityId,
                },
              },
            },
          },
          status: {
            in: ['PENDING', 'REJECTED', 'EXPIRED'],
          },
        },
      }),
    ]);

        const openShifts = shifts.filter((shift) => shift.status === 'OPEN').length;

    const pendingRequests = requests.filter(
      (request) =>
        request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW'
    ).length;

    const approvedRequests = requests.filter(
      (request) => request.status === 'APPROVED'
    ).length;

    const complianceAlerts = complianceDocs.length;

    const activeWorkerIds = new Set(
      requests
        .filter(
          (request) =>
            request.status === 'APPROVED' &&
            request.shift.status === 'OPEN'
        )
        .map((request) => request.professionalId)
    );

    const activeWorkers = activeWorkerIds.size;

    const recentShifts = shifts
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 6)
      .map((shift) => {
        const approvedCount = shift.requests.filter((r) => r.status === 'APPROVED').length;
        return {
          id: shift.id,
          role: shift.role,
          shiftType: shift.shiftType,
          date: shift.date,
          applicants: shift.requests.length,
          approvedCount,
          status: shift.status,
        };
      });

    res.json({
      data: {
        stats: {
          openShifts,
          pendingRequests,
          approvedRequests,
          activeWorkers: workers.length,
          complianceAlerts,
        },
        recentShifts,
      },
    });
  } catch (error) {
    console.error('GET /api/facility/dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch facility dashboard' });
  }
});

app.get('/api/facility/workers', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
       clearAuthCookie(res);
       return res.status(403).json({ error: facilityStatus.error });
    }

    const requests = await prisma.shiftRequest.findMany({
      where: {
        shift: {
          facilityId,
        },
      },
      include: {
        professional: {
          include: {
            user: true,
          },
        },
      },
      orderBy: [{ requestedAt: 'desc' }],
    });

    const grouped = new Map<string, {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      role: string;
      city: string | null;
      state: string | null;
      totalRequests: number;
      approvedCount: number;
      lastRequestedAt: Date | null;
    }>();

    for (const request of requests) {
      const p = request.professional;
      const existing = grouped.get(p.id);

      if (!existing) {
        grouped.set(p.id, {
          id: p.id,
          firstName: p.user.firstName ?? null,
          lastName: p.user.lastName ?? null,
          email: p.user.email,
          role: p.role,
          city: p.city ?? null,
          state: p.state ?? null,
          totalRequests: 1,
          approvedCount: request.status === 'APPROVED' ? 1 : 0,
          lastRequestedAt: request.requestedAt,
        });
      } else {
        existing.totalRequests += 1;
        if (request.status === 'APPROVED') {
          existing.approvedCount += 1;
        }
        if (!existing.lastRequestedAt || request.requestedAt > existing.lastRequestedAt) {
          existing.lastRequestedAt = request.requestedAt;
        }
      }
    }

    const workers = Array.from(grouped.values()).sort((a, b) => {
      const aTime = a.lastRequestedAt ? +new Date(a.lastRequestedAt) : 0;
      const bTime = b.lastRequestedAt ? +new Date(b.lastRequestedAt) : 0;
      return bTime - aTime;
    });

    res.json({ data: workers });
  } catch (error) {
    console.error('GET /api/facility/workers error:', error);
    res.status(500).json({ error: 'Failed to fetch facility workers' });
  }
});

app.get('/api/facility/compliance', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    const workers = await prisma.professionalProfile.findMany({
      where: {
        requests: {
          some: {
            shift: {
              facilityId,
            },
          },
        },
      },
      include: {
        user: true,
        documents: true,
      },
    });

    const alerts = workers.flatMap((worker) => {
      const items: Array<{
        workerId: string;
        workerName: string;
        role: string;
        issue: string;
        severity: 'HIGH' | 'MEDIUM';
      }> = [];

      const pendingDocs = worker.documents.filter((d) => d.status === 'PENDING');
      const rejectedDocs = worker.documents.filter((d) => d.status === 'REJECTED');
      const expiredDocs = worker.documents.filter((d) => d.status === 'EXPIRED');

      if (pendingDocs.length > 0) {
        items.push({
          workerId: worker.id,
          workerName: `${worker.user.firstName ?? ''} ${worker.user.lastName ?? ''}`.trim(),
          role: worker.role,
          issue: `${pendingDocs.length} document(s) pending review`,
          severity: 'MEDIUM',
        });
      }

      if (rejectedDocs.length > 0) {
        items.push({
          workerId: worker.id,
          workerName: `${worker.user.firstName ?? ''} ${worker.user.lastName ?? ''}`.trim(),
          role: worker.role,
          issue: `${rejectedDocs.length} document(s) rejected`,
          severity: 'HIGH',
        });
      }

      if (expiredDocs.length > 0) {
        items.push({
          workerId: worker.id,
          workerName: `${worker.user.firstName ?? ''} ${worker.user.lastName ?? ''}`.trim(),
          role: worker.role,
          issue: `${expiredDocs.length} document(s) expired`,
          severity: 'HIGH',
        });
      }

      return items;
    });

    res.json({
      data: {
        summary: {
          highPriority: alerts.filter((a) => a.severity === 'HIGH').length,
          mediumPriority: alerts.filter((a) => a.severity === 'MEDIUM').length,
          totalAlerts: alerts.length,
        },
        alerts,
      },
    });
  } catch (error) {
    console.error('GET /api/facility/compliance error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance alerts' });
  }
});

app.get('/api/facility/favorites', requireRole('FACILITY_ADMIN'), async (req: AuthedRequest, res) => {
  try {
    const userId = req.authUser!.userId;
    const facilityId = await getFacilityIdForUser(userId);

    if (!facilityId) {
      return res.status(404).json({ error: 'Facility admin not found' });
    }

    const facilityStatus = await ensureFacilityIsActive(facilityId);
    if (!facilityStatus.ok) {
      clearAuthCookie(res);
      return res.status(403).json({ error: facilityStatus.error });
    }

    const approvedRequests = await prisma.shiftRequest.findMany({
      where: {
        status: 'APPROVED',
        shift: {
          facilityId,
        },
      },
      include: {
        professional: {
          include: {
            user: true,
          },
        },
      },
    });

    const grouped = new Map<string, {
      id: string;
      firstName: string | null;
      lastName: string | null;
      email: string;
      role: string;
      city: string | null;
      state: string | null;
      approvedCount: number;
    }>();

    for (const request of approvedRequests) {
      const p = request.professional;
      const existing = grouped.get(p.id);

      if (!existing) {
        grouped.set(p.id, {
          id: p.id,
          firstName: p.user.firstName ?? null,
          lastName: p.user.lastName ?? null,
          email: p.user.email,
          role: p.role,
          city: p.city ?? null,
          state: p.state ?? null,
          approvedCount: 1,
        });
      } else {
        existing.approvedCount += 1;
      }
    }

    const favorites = Array.from(grouped.values())
      .filter((worker) => worker.approvedCount >= 2)
      .sort((a, b) => b.approvedCount - a.approvedCount);

    res.json({ data: favorites });
  } catch (error) {
    console.error('GET /api/facility/favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorite workers' });
  }
});

app.get('/api/worker/shifts/:shiftId', requireRole('PROFESSIONAL'), async (req: AuthedRequest, res) => {
  try {
    const shiftId = String(req.params.shiftId || '');

    if (!shiftId) {
      return res.status(400).json({ error: 'shiftId is required' });
    }

    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        facility: true,
        requests: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!shift) {
      return res.status(404).json({ error: 'Shift not found' });
    }

    if (shift.status !== 'OPEN') {
      return res.status(400).json({ error: 'This shift is no longer open' });
    }

    if (!shift.facility.isActive) {
      return res.status(403).json({
        error: 'This facility is inactive and is no longer accepting shift requests',
      });
    }

    const approvedCount = shift.requests.filter((r) => r.status === 'APPROVED').length;
    const pendingCount = shift.requests.filter(
      (r) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW'
    ).length;

    const workersNeeded = shift.workersNeeded;
    let fillStatus: 'OPEN' | 'PARTIAL' | 'FILLED' = 'OPEN';

    if (approvedCount > 0 && approvedCount < workersNeeded) {
      fillStatus = 'PARTIAL';
    }

    if (approvedCount >= workersNeeded) {
      fillStatus = 'FILLED';
    }

    res.json({
      data: {
        id: shift.id,
        facilityId: shift.facilityId,
        facilityName: shift.facility.name,
        city: shift.facility.city,
        state: shift.facility.state,
        role: shift.role,
        shiftType: shift.shiftType,
        date: shift.date,
        time: `${shift.startTimeLabel} - ${shift.endTimeLabel}`,
        startTimeLabel: shift.startTimeLabel,
        endTimeLabel: shift.endTimeLabel,
        workersNeeded: shift.workersNeeded,
        fillCount: approvedCount,
        pendingCount,
        fillStatus,
        fillLabel: `${approvedCount}/${workersNeeded} filled`,
        status: shift.status,
        payRateLabel: shift.payRateCents
          ? `$${(shift.payRateCents / 100).toFixed(2)}/hr`
          : 'Rate not listed',
        specialInstructions: shift.specialInstructions || '',
      },
    });
  } catch (error) {
    console.error('GET /api/worker/shifts/:shiftId error:', error);
    res.status(500).json({ error: 'Failed to fetch shift detail' });
  }
});

app.listen(port, () => {
  console.log(`staffing-api listening on http://localhost:${port}`);
});
