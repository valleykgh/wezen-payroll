import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { z } from 'zod';
import { PrismaClient, ClinicianRole, ShiftType, ShiftStatus, UserRole, } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { hashPassword, verifyPassword, signAuthToken, setAuthCookie, clearAuthCookie, } from './auth.js';
import { requireAuth, requireRole } from './middleware/auth.js';
import { sendEmail } from './services/email.js';
import { createHash, randomBytes } from 'crypto';
import archiver from 'archiver';
import { getOneDriveInfo, listOneDriveRootChildren, downloadOneDriveFileBuffer } from './services/onedrive.js';
import { uploadFileToCandidateFolder } from './services/onedrive.js';
const app = express();
const port = Number(process.env.PORT || 4001);
const connectionString = process.env.DATABASE_URL ||
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
const ADMIN_ALERT_EMAIL = process.env.ADMIN_ALERT_EMAIL || '';
async function getFacilityNotificationRecipients(facilityId) {
    const admins = await prisma.facilityAdmin.findMany({
        where: { facilityId },
        include: {
            user: {
                select: {
                    email: true,
                    notificationEmail: true,
                    isActive: true,
                },
            },
        },
    });
    const recipients = admins
        .filter((admin) => admin.user?.isActive)
        .map((admin) => admin.user.notificationEmail || admin.user.email)
        .filter((email) => Boolean(email));
    return [...new Set(recipients)];
}
async function sendFacilityShiftRequestEmail(requestId) {
    try {
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
                    },
                },
            },
        });
        if (!request) {
            console.warn('sendFacilityShiftRequestEmail: request not found', requestId);
            return;
        }
        const recipients = await getFacilityNotificationRecipients(request.shift.facilityId);
        if (!recipients.length) {
            console.warn('sendFacilityShiftRequestEmail: no facility notification recipients found', request.shift.facilityId);
            return;
        }
        const workerName = `${request.professional.user.firstName || ''} ${request.professional.user.lastName || ''}`.trim() ||
            request.professional.user.email ||
            'Unknown Worker';
        const shiftDate = new Date(request.shift.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        await sendEmail({
            to: recipients.join(','),
            subject: `New shift request from ${workerName}`,
            html: `
        <h2>New shift request</h2>
        <p><strong>Facility:</strong> ${request.shift.facility.name}</p>
        <p><strong>Worker:</strong> ${workerName}</p>
        <p><strong>Worker Email:</strong> ${request.professional.user.email || 'Not available'}</p>
        <p><strong>Role:</strong> ${request.shift.role}</p>
        <p><strong>Shift Type:</strong> ${request.shift.shiftType}</p>
        <p><strong>Date:</strong> ${shiftDate}</p>
        <p><strong>Time:</strong> ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}</p>
        <p><strong>Requested At:</strong> ${request.requestedAt.toISOString()}</p>
        <p>Please log in to review this applicant.</p>
      `,
            text: [
                'New shift request',
                `Facility: ${request.shift.facility.name}`,
                `Worker: ${workerName}`,
                `Worker Email: ${request.professional.user.email || 'Not available'}`,
                `Role: ${request.shift.role}`,
                `Shift Type: ${request.shift.shiftType}`,
                `Date: ${shiftDate}`,
                `Time: ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
                `Requested At: ${request.requestedAt.toISOString()}`,
                'Please log in to review this applicant.',
            ].join('\n'),
        });
    }
    catch (error) {
        console.error('sendFacilityShiftRequestEmail error:', error);
    }
}
async function sendWorkerShiftApprovedEmail(requestId) {
    try {
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
                    },
                },
            },
        });
        if (!request) {
            console.warn('sendWorkerShiftApprovedEmail: request not found', requestId);
            return;
        }
        const workerEmail = request.professional.user.email;
        if (!workerEmail) {
            console.warn('sendWorkerShiftApprovedEmail: worker email missing', request.professionalId);
            return;
        }
        const workerName = `${request.professional.user.firstName || ''} ${request.professional.user.lastName || ''}`.trim() ||
            request.professional.user.email ||
            'Professional';
        const shiftDate = new Date(request.shift.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
        await sendEmail({
            to: workerEmail,
            subject: `Shift approved: ${request.shift.facility.name}`,
            html: `
        <h2>Your shift request was approved</h2>
        <p>Hello ${workerName},</p>
        <p>Your shift request has been approved and you are scheduled.</p>
        <p><strong>Facility:</strong> ${request.shift.facility.name}</p>
        <p><strong>Role:</strong> ${request.shift.role}</p>
        <p><strong>Shift Type:</strong> ${request.shift.shiftType}</p>
        <p><strong>Date:</strong> ${shiftDate}</p>
        <p><strong>Time:</strong> ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}</p>
        <p><strong>Status:</strong> ${request.status}</p>
        <p>Please log in to review the details.</p>
      `,
            text: [
                `Hello ${workerName},`,
                'Your shift request has been approved and you are scheduled.',
                `Facility: ${request.shift.facility.name}`,
                `Role: ${request.shift.role}`,
                `Shift Type: ${request.shift.shiftType}`,
                `Date: ${shiftDate}`,
                `Time: ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
                `Status: ${request.status}`,
                'Please log in to review the details.',
            ].join('\n'),
        });
    }
    catch (error) {
        console.error('sendWorkerShiftApprovedEmail error:', error);
    }
}
async function sendFacilityShiftCancelledEmail(shiftId) {
    try {
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                facility: {
                    include: {
                        admins: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!shift) {
            console.warn('sendFacilityShiftCancelledEmail: shift not found', shiftId);
            return;
        }
        const recipients = await getFacilityNotificationRecipients(shift.facilityId);
        if (!recipients.length) {
            console.warn('sendFacilityShiftCancelledEmail: no facility notification recipients found', shift.facilityId);
            return;
        }
        const address = [
            shift.facility.addressLine1,
            shift.facility.addressLine2,
            shift.facility.city,
            shift.facility.state,
            shift.facility.zipCode,
        ]
            .filter(Boolean)
            .join(', ');
        const dateLabel = new Date(shift.date).toLocaleDateString();
        await sendEmail({
            to: recipients.join(','),
            subject: `Shift cancelled: ${shift.role} ${shift.shiftType} on ${dateLabel}`,
            html: `
        <h2>Shift cancelled</h2>
        <p><strong>Facility:</strong> ${shift.facility.name}</p>
        <p><strong>Role:</strong> ${shift.role}</p>
        <p><strong>Shift type:</strong> ${shift.shiftType}</p>
        <p><strong>Date:</strong> ${dateLabel}</p>
        <p><strong>Time:</strong> ${shift.startTimeLabel} - ${shift.endTimeLabel}</p>
        ${address ? `<p><strong>Location:</strong> ${address}</p>` : ''}
        ${shift.specialInstructions
                ? `<p><strong>Special instructions:</strong> ${shift.specialInstructions}</p>`
                : ''}
        <p>This shift has been cancelled in the Wezen Staffing portal.</p>
      `,
            text: [
                'Shift cancelled',
                `Facility: ${shift.facility.name}`,
                `Role: ${shift.role}`,
                `Shift type: ${shift.shiftType}`,
                `Date: ${dateLabel}`,
                `Time: ${shift.startTimeLabel} - ${shift.endTimeLabel}`,
                address ? `Location: ${address}` : '',
                shift.specialInstructions
                    ? `Special instructions: ${shift.specialInstructions}`
                    : '',
                'This shift has been cancelled in the Wezen Staffing portal.',
            ]
                .filter(Boolean)
                .join('\n'),
        });
    }
    catch (error) {
        console.error('sendFacilityShiftCancelledEmail error:', error);
    }
}
async function sendWorkerShiftReminderEmail(requestId) {
    try {
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
                    },
                },
            },
        });
        if (!request) {
            console.warn('sendWorkerShiftReminderEmail: request not found', requestId);
            return;
        }
        const workerEmail = request.professional.user.email;
        if (!workerEmail) {
            console.warn('sendWorkerShiftReminderEmail: worker email missing', request.professionalId);
            return;
        }
        const workerName = `${request.professional.user.firstName || ''} ${request.professional.user.lastName || ''}`.trim() ||
            request.professional.user.email ||
            'Professional';
        const address = [
            request.shift.facility.addressLine1,
            request.shift.facility.addressLine2,
            request.shift.facility.city,
            request.shift.facility.state,
            request.shift.facility.zipCode,
        ]
            .filter(Boolean)
            .join(', ');
        const dateLabel = new Date(request.shift.date).toLocaleDateString();
        await sendEmail({
            to: workerEmail,
            subject: `Reminder: upcoming shift at ${request.shift.facility.name}`,
            html: `
        <h2>Upcoming shift reminder</h2>
        <p>Hello ${workerName},</p>
        <p>This is a reminder for your upcoming approved shift.</p>
        <p><strong>Facility:</strong> ${request.shift.facility.name}</p>
        <p><strong>Role:</strong> ${request.shift.role}</p>
        <p><strong>Shift type:</strong> ${request.shift.shiftType}</p>
        <p><strong>Date:</strong> ${dateLabel}</p>
        <p><strong>Time:</strong> ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}</p>
        ${address ? `<p><strong>Location:</strong> ${address}</p>` : ''}
        ${request.shift.specialInstructions
                ? `<p><strong>Special instructions:</strong> ${request.shift.specialInstructions}</p>`
                : ''}
        <p>Please arrive on time and contact Wezen Staffing if you have any issue.</p>
      `,
            text: [
                `Hello ${workerName},`,
                'This is a reminder for your upcoming approved shift.',
                `Facility: ${request.shift.facility.name}`,
                `Role: ${request.shift.role}`,
                `Shift type: ${request.shift.shiftType}`,
                `Date: ${dateLabel}`,
                `Time: ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
                address ? `Location: ${address}` : '',
                request.shift.specialInstructions
                    ? `Special instructions: ${request.shift.specialInstructions}`
                    : '',
                'Please arrive on time and contact Wezen Staffing if you have any issue.',
            ]
                .filter(Boolean)
                .join('\n'),
        });
    }
    catch (error) {
        console.error('sendWorkerShiftReminderEmail error:', error);
    }
}
async function sendWorkersShiftCancelledEmail(shiftId) {
    try {
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: {
                facility: true,
                requests: {
                    where: {
                        status: 'APPROVED',
                    },
                    include: {
                        professional: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
        });
        if (!shift) {
            console.warn('sendWorkersShiftCancelledEmail: shift not found', shiftId);
            return;
        }
        if (!shift.requests.length) {
            console.warn('sendWorkersShiftCancelledEmail: no approved workers for shift', shiftId);
            return;
        }
        const facilityAddress = [
            shift.facility.addressLine1,
            shift.facility.addressLine2,
            shift.facility.city,
            shift.facility.state,
            shift.facility.zipCode,
        ]
            .filter(Boolean)
            .join(', ');
        const dateLabel = new Date(shift.date).toLocaleDateString();
        for (const request of shift.requests) {
            const email = request.professional.user.email;
            if (!email)
                continue;
            const workerName = `${request.professional.user.firstName || ''} ${request.professional.user.lastName || ''}`.trim() ||
                request.professional.user.email ||
                'Professional';
            await sendEmail({
                to: email,
                subject: `Shift cancelled: ${shift.facility.name}`,
                html: `
          <h2>Shift cancelled</h2>
          <p>Hello ${workerName},</p>
          <p>Your approved shift has been cancelled.</p>
          <p><strong>Facility:</strong> ${shift.facility.name}</p>
          <p><strong>Role:</strong> ${shift.role}</p>
          <p><strong>Shift Type:</strong> ${shift.shiftType}</p>
          <p><strong>Date:</strong> ${dateLabel}</p>
          <p><strong>Time:</strong> ${shift.startTimeLabel} - ${shift.endTimeLabel}</p>
          ${facilityAddress ? `<p><strong>Location:</strong> ${facilityAddress}</p>` : ''}
          ${shift.specialInstructions
                    ? `<p><strong>Special Instructions:</strong> ${shift.specialInstructions}</p>`
                    : ''}
          <p>Please contact Wezen Staffing if you need assistance.</p>
        `,
                text: [
                    `Hello ${workerName},`,
                    'Your approved shift has been cancelled.',
                    `Facility: ${shift.facility.name}`,
                    `Role: ${shift.role}`,
                    `Shift Type: ${shift.shiftType}`,
                    `Date: ${dateLabel}`,
                    `Time: ${shift.startTimeLabel} - ${shift.endTimeLabel}`,
                    facilityAddress ? `Location: ${facilityAddress}` : '',
                    shift.specialInstructions ? `Special Instructions: ${shift.specialInstructions}` : '',
                    'Please contact Wezen Staffing if you need assistance.',
                ]
                    .filter(Boolean)
                    .join('\n'),
            });
        }
    }
    catch (error) {
        console.error('sendWorkersShiftCancelledEmail error:', error);
    }
}
async function sendFacilityShiftCancellationRequestEmail(requestId) {
    try {
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
                    },
                },
            },
        });
        if (!request) {
            console.warn('sendFacilityShiftCancellationRequestEmail: request not found', requestId);
            return;
        }
        const recipients = await getFacilityNotificationRecipients(request.shift.facilityId);
        if (!recipients.length) {
            console.warn('sendFacilityShiftCancellationRequestEmail: no facility recipients found', request.shift.facilityId);
            return;
        }
        const workerName = `${request.professional.user.firstName || ''} ${request.professional.user.lastName || ''}`.trim() ||
            request.professional.user.email ||
            'Unknown Worker';
        const dateLabel = new Date(request.shift.date).toLocaleDateString();
        await sendEmail({
            to: recipients.join(','),
            subject: `Cancellation request: ${workerName} for ${request.shift.facility.name}`,
            html: `
        <h2>Worker requested cancellation</h2>
        <p><strong>Worker:</strong> ${workerName}</p>
        <p><strong>Email:</strong> ${request.professional.user.email || 'Not available'}</p>
        <p><strong>Facility:</strong> ${request.shift.facility.name}</p>
        <p><strong>Role:</strong> ${request.shift.role}</p>
        <p><strong>Shift Type:</strong> ${request.shift.shiftType}</p>
        <p><strong>Date:</strong> ${dateLabel}</p>
        <p><strong>Time:</strong> ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}</p>
        <p>The worker has requested cancellation of this approved shift.</p>
      `,
            text: [
                'Worker requested cancellation',
                `Worker: ${workerName}`,
                `Email: ${request.professional.user.email || 'Not available'}`,
                `Facility: ${request.shift.facility.name}`,
                `Role: ${request.shift.role}`,
                `Shift Type: ${request.shift.shiftType}`,
                `Date: ${dateLabel}`,
                `Time: ${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
                'The worker has requested cancellation of this approved shift.',
            ].join('\n'),
        });
    }
    catch (error) {
        console.error('sendFacilityShiftCancellationRequestEmail error:', error);
    }
}
async function getWorkerEligibility(professionalId) {
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
    const reasons = [];
    if (!profile.approvedByWezen) {
        reasons.push('Worker has not been approved by Wezen yet');
    }
    const ica = profile.agreements.find((agreement) => agreement.agreementType === 'ICA');
    if (!ica || ica.status !== 'SIGNED') {
        reasons.push('Independent Contractor Agreement must be signed before requesting shifts');
    }
    const documentsByCategory = new Map(profile.documents.map((doc) => [String(doc.category), doc]));
    const requiredDocumentGroups = [
        { label: 'LICENSE', categories: ['LICENSE'] },
        { label: 'CPR', categories: ['CPR'] },
        { label: 'PHYSICAL', categories: ['PHYSICAL'] },
        { label: 'TB_REPORT', categories: ['TB_REPORT', 'TB_TEST'] },
        { label: 'ID', categories: ['ID', 'STATE_ID'] },
    ];
    for (const group of requiredDocumentGroups) {
        const doc = group.categories
            .map((category) => documentsByCategory.get(category))
            .find(Boolean);
        if (!doc) {
            reasons.push(`Missing required document: ${group.label}`);
            continue;
        }
        if (doc.status === 'REJECTED') {
            reasons.push(`Rejected required document: ${group.label}`);
            continue;
        }
        if (doc.status === 'EXPIRED' || (doc.expiresAt && doc.expiresAt < new Date())) {
            reasons.push(`Expired required document: ${group.label}`);
            continue;
        }
        if (doc.status !== 'APPROVED') {
            reasons.push(`Required document pending approval: ${group.label}`);
        }
    }
    return {
        eligible: reasons.length === 0,
        reasons,
    };
}
function calculateDistanceMiles(lat1, lon1, lat2, lon2) {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 3958.8; // miles
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
            Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}
async function sendPushToUser(userId, title, body) {
    try {
        const tokens = await prisma.userDeviceToken.findMany({
            where: {
                userId,
                isActive: true,
            },
            select: {
                token: true,
                platform: true,
            },
        });
        if (tokens.length === 0)
            return;
        // APNs send will be implemented here after Apple push credentials are configured.
        console.log('Push notification queued', {
            userId,
            title,
            tokenCount: tokens.length,
        });
    }
    catch (error) {
        console.error('sendPushToUser error:', error);
    }
}
async function sendPushToFacilityAdmins(facilityId, title, body) {
    const admins = await prisma.facilityAdmin.findMany({
        where: { facilityId },
        select: { userId: true },
    });
    await Promise.all(admins.map((admin) => sendPushToUser(admin.userId, title, body)));
}
async function createWorkerNotification(params) {
    await prisma.workerNotification.create({
        data: {
            professionalId: params.professionalId,
            type: params.type,
            title: params.title,
            message: params.message,
        },
    });
    const professional = await prisma.professionalProfile.findUnique({
        where: { id: params.professionalId },
        select: { userId: true },
    });
    if (professional?.userId) {
        await sendPushToUser(professional.userId, params.title, params.message);
    }
}
async function createFacilityNotification(params) {
    await prisma.facilityNotification.create({
        data: {
            facilityId: params.facilityId,
            type: params.type,
            title: params.title,
            message: params.message,
        },
    });
    await sendPushToFacilityAdmins(params.facilityId, params.title, params.message);
}
async function createAdminNotification(params) {
    await prisma.adminNotification.create({
        data: {
            userId: params.userId,
            type: params.type,
            title: params.title,
            message: params.message,
        },
    });
    await sendPushToUser(params.userId, params.title, params.message);
}
async function getWorkerDashboardData(userId) {
    const professional = await prisma.professionalProfile.findUnique({
        where: { userId },
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
    if (!professional) {
        return null;
    }
    const approvedDocs = professional.documents.filter((doc) => doc.status === 'APPROVED').length;
    const pendingDocs = professional.documents.filter((doc) => doc.status === 'PENDING').length;
    const rejectedDocs = professional.documents.filter((doc) => doc.status === 'REJECTED').length;
    const expiredDocs = professional.documents.filter((doc) => doc.status === 'EXPIRED').length;
    const ica = professional.agreements.find((agreement) => agreement.agreementType === 'ICA');
    const eligibility = await getWorkerEligibility(professional.id);
    const requestedCount = professional.requests.length;
    const approvedRequestCount = professional.requests.filter((request) => request.status === 'APPROVED').length;
    const pendingRequestCount = professional.requests.filter((request) => request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW').length;
    const rejectedRequestCount = professional.requests.filter((request) => request.status === 'REJECTED').length;
    const upcomingShifts = professional.requests
        .filter((request) => request.status === 'APPROVED')
        .filter((request) => new Date(request.shift.date) >= new Date(new Date().toDateString()))
        .sort((a, b) => +new Date(a.shift.date) - +new Date(b.shift.date))
        .slice(0, 5)
        .map((request) => ({
        id: request.shift.id,
        facilityName: request.shift.facility.name,
        role: request.shift.role,
        shiftType: request.shift.shiftType,
        date: request.shift.date,
        time: `${request.shift.startTimeLabel} - ${request.shift.endTimeLabel}`,
        startTimeLabel: request.shift.startTimeLabel,
        endTimeLabel: request.shift.endTimeLabel,
        city: request.shift.facility.city,
        state: request.shift.facility.state,
        address: [
            request.shift.facility.city,
            request.shift.facility.state,
            request.shift.facility.zipCode,
        ]
            .filter(Boolean)
            .join(', '),
        specialInstructions: request.shift.specialInstructions ?? null,
        status: request.status,
    }));
    return {
        profile: {
            professionalId: professional.id,
            firstName: professional.user.firstName,
            lastName: professional.user.lastName,
            email: professional.user.email,
            role: professional.role,
            onboardingStatus: professional.onboardingStatus,
            approvedByWezen: professional.approvedByWezen,
        },
        stats: {
            profileStatus: professional.approvedByWezen ? 'APPROVED' : 'UNDER_REVIEW',
            documents: {
                approved: approvedDocs,
                pending: pendingDocs,
                rejected: rejectedDocs,
                expired: expiredDocs,
                total: professional.documents.length,
            },
            agreementStatus: ica?.status ?? 'NOT_STARTED',
            requests: {
                total: requestedCount,
                approved: approvedRequestCount,
                pending: pendingRequestCount,
                rejected: rejectedRequestCount,
            },
            upcomingShiftCount: upcomingShifts.length,
            eligibleForShifts: eligibility.eligible,
            eligibilityReasons: eligibility.reasons,
        },
        upcomingShifts,
    };
}
async function getProfessionalProfileIdForUser(userId) {
    const profile = await prisma.professionalProfile.findUnique({
        where: { userId },
        select: { id: true },
    });
    return profile?.id ?? null;
}
async function getFacilityIdForUser(userId) {
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
async function ensureFacilityIsActive(facilityId) {
    const facility = await prisma.facility.findUnique({
        where: { id: facilityId },
        select: { id: true, isActive: true, name: true },
    });
    if (!facility) {
        return { ok: false, error: 'Facility not found' };
    }
    if (!facility.isActive) {
        return {
            ok: false,
            error: 'Facility access has been deactivated. Please contact Wezen Staffing support.',
        };
    }
    return { ok: true, facility };
}
function getUploadsFilePathFromUrl(fileUrl) {
    try {
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            const url = new URL(fileUrl);
            const pathname = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
            return path.join(process.cwd(), pathname);
        }
        const cleaned = decodeURIComponent(fileUrl.replace(/^\/+/, ''));
        return path.join(process.cwd(), cleaned);
    }
    catch {
        const cleaned = decodeURIComponent(fileUrl.replace(/^\/+/, ''));
        return path.join(process.cwd(), cleaned);
    }
}
function getExtensionFromMimeType(mimeType) {
    if (!mimeType)
        return '';
    if (mimeType === 'application/pdf')
        return '.pdf';
    if (mimeType === 'image/jpeg')
        return '.jpg';
    if (mimeType === 'image/png')
        return '.png';
    if (mimeType === 'image/gif')
        return '.gif';
    if (mimeType === 'image/webp')
        return '.webp';
    if (mimeType === 'application/msword')
        return '.doc';
    if (mimeType ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        return '.docx';
    return '';
}
function safeDownloadName(doc) {
    const cleaned = doc.name.replace(/[\/\\:*?"<>|]/g, '_').trim();
    const hasExtension = /\.[A-Za-z0-9]+$/.test(cleaned);
    const extension = hasExtension ? '' : getExtensionFromMimeType(doc.mimeType);
    return `${doc.category}-${doc.id}-${cleaned}${extension}`;
}
async function canUserAccessDocument(userId, role, documentId) {
    const document = await prisma.professionalDocument.findUnique({
        where: { id: documentId },
        include: {
            professional: {
                include: {
                    requests: {
                        include: {
                            shift: {
                                select: {
                                    facilityId: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });
    if (!document) {
        return { ok: false, error: 'Document not found', document: null };
    }
    if (role === 'INTERNAL_ADMIN') {
        return { ok: true, document };
    }
    if (role === 'FACILITY_ADMIN') {
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return { ok: false, error: 'Facility admin not found', document: null };
        }
        const belongsToFacility = document.professional.requests.some((request) => request.shift.facilityId === facilityId);
        if (!belongsToFacility) {
            return { ok: false, error: 'Forbidden', document: null };
        }
        return { ok: true, document };
    }
    return { ok: false, error: 'Forbidden', document: null };
}
function buildShiftStartDate(shiftDate, startTimeLabel) {
    const base = new Date(shiftDate);
    const match = startTimeLabel.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) {
        return base;
    }
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3].toUpperCase();
    if (meridiem === 'AM' && hours === 12) {
        hours = 0;
    }
    else if (meridiem === 'PM' && hours !== 12) {
        hours += 12;
    }
    const start = new Date(base);
    start.setHours(hours, minutes, 0, 0);
    return start;
}
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    process.env.FRONTEND_URL_WWW || '',
    process.env.FRONTEND_URL_APP || '',
    'http://localhost:3005',
    'http://localhost:3010',
    'capacitor://localhost',
    'ionic://localhost',
    'https://wezenstaffing.com',
    'https://www.wezenstaffing.com',
].filter(Boolean);
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`CORS blocked for origin: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
}));
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
    phone: z.string().trim().optional(),
    addressLine1: z.string().trim().optional(),
    addressLine2: z.string().trim().optional(),
    openShiftAlertsEnabled: z.boolean().optional(),
    openShiftAlertRadiusMiles: z.number().int().positive().optional(),
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
    defaultCnaRateCents: z.number().int().nonnegative().optional(),
    defaultLvnRateCents: z.number().int().nonnegative().optional(),
    defaultRnRateCents: z.number().int().nonnegative().optional(),
    allowRateOverride: z.boolean().optional(),
});
const updateFacilitySchema = z.object({
    name: z.string().min(1),
    facilityType: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1),
    defaultCnaRateCents: z.number().int().nonnegative().nullable().optional(),
    defaultLvnRateCents: z.number().int().nonnegative().nullable().optional(),
    defaultRnRateCents: z.number().int().nonnegative().nullable().optional(),
    allowRateOverride: z.boolean().optional(),
});
const updateFacilitySettingsSchema = z.object({
    name: z.string().min(1),
    facilityType: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    firstName: z.string().trim().optional().nullable(),
    lastName: z.string().trim().optional().nullable(),
    phone: z.string().trim().optional().nullable(),
    notificationEmail: z.string().trim().email().optional().nullable(),
    contactEmail: z.string().trim().email().optional().nullable(),
    contactPhone: z.string().trim().optional().nullable(),
    defaultCnaRateCents: z.number().int().nonnegative().nullable().optional(),
    defaultLvnRateCents: z.number().int().nonnegative().nullable().optional(),
    defaultRnRateCents: z.number().int().nonnegative().nullable().optional(),
    allowRateOverride: z.boolean().optional(),
});
const adminShiftOverrideSchema = z.object({
    reason: z.string().min(3),
});
const adminSettingsSchema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    notificationEmail: z.string().email().optional().or(z.literal('')),
    notifyNewWorkerSignup: z.boolean(),
    notifyDocumentUploads: z.boolean(),
    notifyAgreementSigned: z.boolean(),
    notifyWorkerReadyForReview: z.boolean(),
});
const adminChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
});
const updateWorkerPayRatesSchema = z.object({
    regularPayRateCents: z.number().int().nonnegative().nullable().optional(),
    overtimePayRateCents: z.number().int().nonnegative().nullable().optional(),
    doublePayRateCents: z.number().int().nonnegative().nullable().optional(),
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
                phone: parsed.data.phone || null,
                professional: {
                    create: {
                        role: parsed.data.role,
                        addressLine1: parsed.data.addressLine1 || null,
                        addressLine2: parsed.data.addressLine2 || null,
                        city: parsed.data.city,
                        state: parsed.data.state,
                        zipCode: parsed.data.zipCode,
                        onboardingStatus: 'PENDING',
                        approvedByWezen: false,
                        openShiftAlertsEnabled: parsed.data.openShiftAlertsEnabled ?? false,
                        openShiftAlertRadiusMiles: parsed.data.openShiftAlertRadiusMiles ?? 50,
                    },
                },
            },
        });
        const professional = await prisma.professionalProfile.findUnique({
            where: { userId: user.id },
            select: { id: true },
        });
        const token = signAuthToken({
            userId: user.id,
            role: user.role,
        });
        setAuthCookie(res, token);
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: 'INTERNAL_ADMIN',
                    isActive: true,
                    notifyNewWorkerSignup: true,
                },
                select: { id: true },
            });
            await Promise.all(admins.map((admin) => createAdminNotification({
                userId: admin.id,
                type: 'GENERAL',
                title: 'New worker signup',
                message: `${parsed.data.firstName} ${parsed.data.lastName} created a professional profile and needs review.`,
            })));
        }
        catch (notificationError) {
            console.error('New worker signup admin notification failed:', notificationError);
        }
        res.status(201).json({
            data: {
                userId: user.id,
                role: user.role,
                professionalId: professional?.id ?? null,
                token,
            },
        });
    }
    catch (error) {
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
        if (invite.email &&
            invite.email.toLowerCase() !== parsed.data.email.toLowerCase()) {
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
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: 'INTERNAL_ADMIN',
                    isActive: true,
                    notifyNewWorkerSignup: true,
                },
                select: { id: true },
            });
            await Promise.all(admins.map((admin) => createAdminNotification({
                userId: admin.id,
                type: 'GENERAL',
                title: 'New worker signup',
                message: `${parsed.data.firstName} ${parsed.data.lastName} created a professional profile and needs review.`,
            })));
        }
        catch (notificationError) {
            console.error('New worker signup admin notification failed:', notificationError);
        }
        res.status(201).json({
            data: {
                userId: user.id,
                role: user.role,
                facilityId: facilityAdmin.facilityId,
                token,
            },
        });
    }
    catch (error) {
        console.error('POST /api/auth/register-facility error:', error);
        res.status(500).json({ error: 'Failed to register facility' });
    }
});
const loginSchema = z.object({
    email: z.email(),
    password: z.string().min(6),
});
const passwordResetRequestSchema = z.object({
    email: z.email(),
});
const passwordResetConfirmSchema = z.object({
    token: z.string().min(20),
    newPassword: z.string().min(8),
});
function hashResetToken(token) {
    return createHash('sha256').update(token).digest('hex');
}
function getPasswordResetBaseUrl() {
    return (process.env.STAFFING_WEB_BASE_URL ||
        process.env.FRONTEND_BASE_URL ||
        'https://wezenstaffing.com').replace(/\/$/, '');
}
app.post('/api/auth/forgot-password', async (req, res) => {
    const parsed = passwordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const email = parsed.data.email.toLowerCase().trim();
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                email: true,
                firstName: true,
                isActive: true,
                isSystemUser: true,
            },
        });
        if (!user || !user.isActive || user.isSystemUser) {
            return res.json({ ok: true });
        }
        await prisma.passwordResetToken.updateMany({
            where: {
                userId: user.id,
                usedAt: null,
                expiresAt: { gt: new Date() },
            },
            data: { usedAt: new Date() },
        });
        const token = randomBytes(32).toString('hex');
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await prisma.passwordResetToken.create({
            data: {
                userId: user.id,
                tokenHash,
                expiresAt,
            },
        });
        const resetUrl = `${getPasswordResetBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
        const appResetUrl = `${getPasswordResetBaseUrl()}/app/reset-password/index.html?token=${encodeURIComponent(token)}`;
        await sendEmail({
            to: user.email,
            subject: 'Reset your Wezen Staffing password',
            html: `
        <h2>Reset your password</h2>
        <p>Hello ${user.firstName || 'there'},</p>
        <p>Use the link below to reset your Wezen Staffing password. This link expires in 30 minutes.</p>
        <p><a href="${resetUrl}">Reset Password</a></p>
        <p>If you are using the iPhone app, open this link from your phone: <a href="${appResetUrl}">Reset in App</a></p>
        <p>If you did not request this, you can ignore this email.</p>
      `,
            text: [
                'Reset your Wezen Staffing password',
                `Use this link to reset your password. It expires in 30 minutes: ${resetUrl}`,
                `iPhone app reset link: ${appResetUrl}`,
                'If you did not request this, you can ignore this email.',
            ].join('\n'),
        });
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/auth/forgot-password error:', error);
        return res.status(500).json({ error: 'Failed to request password reset' });
    }
});
app.post('/api/auth/reset-password', async (req, res) => {
    const parsed = passwordResetConfirmSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const tokenHash = hashResetToken(parsed.data.token);
        const reset = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
            include: { user: true },
        });
        if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Reset link is invalid or expired.' });
        }
        if (!reset.user.isActive || reset.user.isSystemUser) {
            return res.status(403).json({ error: 'Password cannot be reset for this account.' });
        }
        const passwordHash = await hashPassword(parsed.data.newPassword);
        await prisma.$transaction([
            prisma.user.update({
                where: { id: reset.userId },
                data: { passwordHash },
            }),
            prisma.passwordResetToken.update({
                where: { id: reset.id },
                data: { usedAt: new Date() },
            }),
        ]);
        return res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/auth/reset-password error:', error);
        return res.status(500).json({ error: 'Failed to reset password' });
    }
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
                token,
            },
        });
    }
    catch (error) {
        console.error('POST /api/auth/login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});
app.post('/api/auth/logout', async (_req, res) => {
    clearAuthCookie(res);
    res.json({ ok: true });
});
app.get('/api/auth/me', requireAuth, async (req, res) => {
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
        if (user.role === 'FACILITY_ADMIN' &&
            user.facilityAdmin &&
            user.facilityAdmin.facility &&
            !user.facilityAdmin.facility.isActive) {
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
                notificationEmail: user.notificationEmail,
                professionalId: user.professional?.id ?? null,
                facilityId: user.facilityAdmin?.facilityId ?? null,
            },
        });
    }
    catch (error) {
        console.error('GET /api/auth/me error:', error);
        res.status(500).json({ error: 'Failed to fetch current user' });
    }
});
app.get('/api/worker/dashboard', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const data = await getWorkerDashboardData(userId);
        if (!data) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        res.json({ data });
    }
    catch (error) {
        console.error('GET /api/worker/dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch worker dashboard' });
    }
});
app.get('/api/shifts', async (req, res) => {
    try {
        const facilityId = String(req.query.facilityId || '');
        const role = req.query.role;
        const shiftType = req.query.shiftType;
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
                ? shift.requests.filter((request) => request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW').length
                : 0;
            const workersNeeded = shift.workersNeeded;
            let fillStatus = 'OPEN';
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
    }
    catch (error) {
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
app.post('/api/shifts', requireRole('FACILITY_ADMIN'), async (req, res) => {
    const parsed = createShiftSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facilityStatus = await ensureFacilityIsActive(facilityId);
        if (!facilityStatus.ok) {
            clearAuthCookie(res);
            return res.status(403).json({ error: facilityStatus.error });
        }
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
                id: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        let resolvedPayRateCents = undefined;
        if (parsed.data.role === 'CNA') {
            resolvedPayRateCents = facility.defaultCnaRateCents ?? undefined;
        }
        else if (parsed.data.role === 'LVN') {
            resolvedPayRateCents = facility.defaultLvnRateCents ?? undefined;
        }
        else if (parsed.data.role === 'RN') {
            resolvedPayRateCents = facility.defaultRnRateCents ?? undefined;
        }
        if (facility.allowRateOverride && parsed.data.payRateCents != null) {
            resolvedPayRateCents = parsed.data.payRateCents;
        }
        const shift = await prisma.shift.create({
            data: {
                facilityId,
                role: parsed.data.role,
                shiftType: parsed.data.shiftType,
                date: new Date(`${parsed.data.date}T12:00:00.000Z`),
                startTimeLabel: parsed.data.startTimeLabel,
                endTimeLabel: parsed.data.endTimeLabel,
                workersNeeded: parsed.data.workersNeeded,
                specialInstructions: parsed.data.specialInstructions,
                payRateCents: resolvedPayRateCents,
            },
        });
        try {
            const facilityForAlerts = await prisma.facility.findUnique({
                where: { id: facilityId },
                select: {
                    name: true,
                    city: true,
                    state: true,
                    latitude: true,
                    longitude: true,
                },
            });
            if (facilityForAlerts?.latitude != null && facilityForAlerts?.longitude != null) {
                const workers = await prisma.professionalProfile.findMany({
                    where: {
                        approvedByWezen: true,
                        role: parsed.data.role,
                        openShiftAlertsEnabled: true,
                        latitude: { not: null },
                        longitude: { not: null },
                    },
                    select: {
                        id: true,
                        latitude: true,
                        longitude: true,
                        openShiftAlertRadiusMiles: true,
                    },
                });
                const matchingWorkers = workers.filter((worker) => {
                    if (worker.latitude == null || worker.longitude == null)
                        return false;
                    const radius = worker.openShiftAlertRadiusMiles ?? 50;
                    const distance = calculateDistanceMiles(worker.latitude, worker.longitude, facilityForAlerts.latitude, facilityForAlerts.longitude);
                    return distance <= radius;
                });
                await Promise.all(matchingWorkers.map((worker) => createWorkerNotification({
                    professionalId: worker.id,
                    type: 'GENERAL',
                    title: 'New shift opened near you',
                    message: `${facilityForAlerts.name} posted a ${parsed.data.role} ${parsed.data.shiftType} shift on ${parsed.data.date} from ${parsed.data.startTimeLabel} to ${parsed.data.endTimeLabel}.`,
                })));
            }
        }
        catch (notificationError) {
            console.error('Open shift worker notification failed:', notificationError);
        }
        res.status(201).json({ data: shift });
    }
    catch (error) {
        console.error('POST /api/shifts error:', error);
        res.status(500).json({ error: 'Failed to create shift' });
    }
});
const requestShiftSchema = z.object({
    shiftId: z.string().min(1),
});
app.post('/api/shift-requests', requireRole('PROFESSIONAL'), async (req, res) => {
    const parsed = requestShiftSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
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
                startTimeLabel: true,
                endTimeLabel: true,
                workersNeeded: true,
                status: true,
            },
        });
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        const shiftStart = buildShiftStartDate(shift.date, shift.startTimeLabel);
        if (shiftStart.getTime() <= Date.now()) {
            await prisma.shift.update({
                where: { id: shift.id },
                data: { status: 'UNFILLED' },
            });
            return res.status(400).json({
                error: 'This shift has already started and can no longer be requested.',
            });
        }
        if (shift.status !== 'OPEN') {
            return res.status(400).json({
                error: 'This shift is no longer open for requests.',
            });
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
        const existingRequestForShift = await prisma.shiftRequest.findFirst({
            where: {
                shiftId: shift.id,
                professionalId,
            },
            select: {
                id: true,
                status: true,
            },
        });
        if (existingRequestForShift) {
            return res.status(409).json({
                error: 'You already requested this shift before. You cannot request the same shift again, even if it is reopened.',
                existingRequestId: existingRequestForShift.id,
                existingStatus: existingRequestForShift.status,
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
        try {
            await sendFacilityShiftRequestEmail(created.id);
        }
        catch (emailError) {
            console.error('Facility shift request email failed:', emailError);
        }
        await createFacilityNotification({
            facilityId: shift.facilityId,
            type: 'GENERAL',
            title: 'New shift request',
            message: 'A worker requested one of your open shifts. Please review the applicant.',
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        console.error('POST /api/shift-requests error:', error);
        res.status(500).json({ error: 'Failed to create shift request' });
    }
});
app.get('/api/facility/requests', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(403).json({ error: 'Facility account not found' });
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
                    startTimeLabel: request.shift.startTimeLabel,
                    endTimeLabel: request.shift.endTimeLabel,
                    facilityName: request.shift.facility.name,
                    city: request.shift.facility.city,
                    state: request.shift.facility.state,
                    address: [
                        request.shift.facility.addressLine1,
                        request.shift.facility.addressLine2,
                        request.shift.facility.city,
                        request.shift.facility.state,
                        request.shift.facility.zipCode,
                    ]
                        .filter(Boolean)
                        .join(', '),
                    specialInstructions: request.shift.specialInstructions ?? null,
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
    }
    catch (error) {
        console.error('GET /api/facility/requests error:', error);
        res.status(500).json({ error: 'Failed to fetch facility requests' });
    }
});
app.put('/api/shift-requests/:id/notes', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        const notes = String(req.body?.notes || '').trim();
        if (!id) {
            return res.status(400).json({ error: 'Request id is required' });
        }
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const requestRecord = await prisma.shiftRequest.findUnique({
            where: { id },
            include: {
                shift: {
                    select: {
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
                reviewNotes: notes || null,
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/shift-requests/:id/notes error:', error);
        res.status(500).json({ error: 'Failed to update facility notes' });
    }
});
app.post('/api/shift-requests/:id/approve', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
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
                        workersNeeded: true,
                        status: true,
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
        if (requestRecord.shift.status !== 'OPEN') {
            return res.status(400).json({ error: 'This shift is not open for approvals' });
        }
        if (requestRecord.status === 'APPROVED') {
            return res.json({ data: requestRecord });
        }
        if (req.body?.facilityDocumentReviewConfirmed !== true) {
            return res.status(400).json({
                error: 'Facility document review confirmation is required before approving this applicant.',
            });
        }
        const approvedCount = await prisma.shiftRequest.count({
            where: {
                shiftId: requestRecord.shift.id,
                status: 'APPROVED',
            },
        });
        if (approvedCount >= requestRecord.shift.workersNeeded) {
            return res.status(400).json({ error: 'This shift is already fully assigned' });
        }
        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
            },
        });
        try {
            await sendWorkerShiftApprovedEmail(updated.id);
        }
        catch (emailError) {
            console.error('Worker approved shift email failed:', emailError);
        }
        const newApprovedCount = approvedCount + 1;
        if (newApprovedCount >= requestRecord.shift.workersNeeded) {
            await prisma.shift.update({
                where: { id: requestRecord.shift.id },
                data: {
                    status: 'FILLED',
                },
            });
        }
        await createWorkerNotification({
            professionalId: updated.professionalId,
            type: 'SHIFT_APPROVED',
            title: 'Shift approved',
            message: 'Your shift request has been approved by the facility.',
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/approve error:', error);
        res.status(500).json({ error: 'Failed to approve request' });
    }
});
app.post('/api/shift-requests/:id/reject', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        const rejectionReason = String(req.body?.reason || '').trim();
        if (!rejectionReason) {
            return res.status(400).json({ error: 'Rejection reason is required.' });
        }
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
                reviewNotes: rejectionReason,
            },
        });
        await createWorkerNotification({
            professionalId: updated.professionalId,
            type: 'SHIFT_REJECTED',
            title: 'Shift rejected',
            message: `Your shift request was rejected by the facility. Reason: ${rejectionReason}`,
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/reject error:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
});
app.post('/api/shift-requests/:id/no-show', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!id) {
            return res.status(400).json({ error: 'Request id is required' });
        }
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const existing = await prisma.shiftRequest.findUnique({
            where: { id },
            include: {
                shift: true,
                professional: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Shift request not found' });
        }
        if (existing.shift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (existing.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Only approved workers can be marked as no-show.' });
        }
        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'NO_SHOW',
                reviewedAt: new Date(),
                reviewNotes: 'Marked no-show by facility',
            },
        });
        await createWorkerNotification({
            professionalId: updated.professionalId,
            type: 'GENERAL',
            title: 'Shift marked no-show',
            message: 'A facility marked you as no-show for an approved shift. Please contact Wezen Staffing if this is incorrect.',
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/no-show error:', error);
        res.status(500).json({ error: 'Failed to mark no-show' });
    }
});
app.post('/api/shift-requests/:id/request-cancellation', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const professionalId = await getProfessionalProfileIdForUser(userId);
        const cancellationReason = String(req.body?.reason || '').trim();
        if (!cancellationReason) {
            return res.status(400).json({ error: 'Cancellation reason is required.' });
        }
        if (!id) {
            return res.status(400).json({ error: 'Request id is required' });
        }
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const existing = await prisma.shiftRequest.findUnique({
            where: { id },
            include: {
                shift: true,
            },
        });
        if (!existing) {
            return res.status(404).json({ error: 'Shift request not found' });
        }
        if (existing.professionalId !== professionalId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (existing.status !== 'APPROVED') {
            return res.status(400).json({ error: 'Only approved shifts can have a cancellation request.' });
        }
        const shiftStart = buildShiftStartDate(existing.shift.date, existing.shift.startTimeLabel);
        const now = new Date();
        const fourHoursMs = 4 * 60 * 60 * 1000;
        if (shiftStart.getTime() - now.getTime() < fourHoursMs) {
            return res.status(400).json({
                error: 'Cancellation requests are not allowed within 4 hours of shift start time. Please contact Wezen Staffing support.',
            });
        }
        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'CANCELLATION_REQUESTED',
                reviewedAt: null,
                reviewNotes: cancellationReason,
            },
        });
        await createWorkerNotification({
            professionalId,
            type: 'GENERAL',
            title: 'Cancellation request submitted',
            message: 'Your cancellation request has been sent to the facility for review.',
        });
        await createFacilityNotification({
            facilityId: existing.shift.facilityId,
            type: 'GENERAL',
            title: 'Cancellation requested',
            message: 'A worker requested cancellation for an approved shift. Please review urgently.',
        });
        try {
            await sendFacilityShiftCancellationRequestEmail(updated.id);
        }
        catch (emailError) {
            console.error('Facility cancellation request email failed:', emailError);
        }
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/request-cancellation error:', error);
        res.status(500).json({ error: 'Failed to request cancellation' });
    }
});
app.post('/api/shift-requests/:id/approve-cancellation', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facilityStatus = await ensureFacilityIsActive(facilityId);
        if (!facilityStatus.ok) {
            clearAuthCookie(res);
            return res.status(403).json({ error: facilityStatus.error });
        }
        const existing = await prisma.shiftRequest.findUnique({
            where: { id },
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
        });
        if (!existing) {
            return res.status(404).json({ error: 'Shift request not found' });
        }
        if (existing.shift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (existing.status !== 'CANCELLATION_REQUESTED') {
            return res.status(400).json({ error: 'This request is not awaiting cancellation approval.' });
        }
        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                reviewedAt: new Date(),
                reviewNotes: 'Cancellation approved by facility. Worker released from this shift.',
            },
        });
        const remainingApprovedCount = await prisma.shiftRequest.count({
            where: {
                shiftId: existing.shiftId,
                status: 'APPROVED',
            },
        });
        if (existing.shift.status === 'FILLED' &&
            remainingApprovedCount < existing.shift.workersNeeded) {
            await prisma.shift.update({
                where: { id: existing.shiftId },
                data: { status: 'OPEN' },
            });
        }
        await createWorkerNotification({
            professionalId: updated.professionalId,
            type: 'GENERAL',
            title: 'Cancellation approved',
            message: 'Your cancellation request was approved by the facility. You have been released from this shift.',
        });
        if (existing.professional.user.email) {
            try {
                await sendEmail({
                    to: existing.professional.user.email,
                    subject: `Cancellation approved: ${existing.shift.facility.name}`,
                    html: `
            <h2>Cancellation approved</h2>
            <p>Your cancellation request has been approved. You have been released from this shift.</p>
            <p><strong>Facility:</strong> ${existing.shift.facility.name}</p>
            <p><strong>Role:</strong> ${existing.shift.role}</p>
            <p><strong>Shift Type:</strong> ${existing.shift.shiftType}</p>
            <p><strong>Date:</strong> ${new Date(existing.shift.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${existing.shift.startTimeLabel} - ${existing.shift.endTimeLabel}</p>
          `,
                    text: [
                        'Cancellation approved',
                        `Facility: ${existing.shift.facility.name}`,
                        `Role: ${existing.shift.role}`,
                        `Shift Type: ${existing.shift.shiftType}`,
                        `Date: ${new Date(existing.shift.date).toLocaleDateString()}`,
                        `Time: ${existing.shift.startTimeLabel} - ${existing.shift.endTimeLabel}`,
                    ].join('\n'),
                });
            }
            catch (emailError) {
                console.error('Worker cancellation approved email failed:', emailError);
            }
        }
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/approve-cancellation error:', error);
        res.status(500).json({ error: 'Failed to approve cancellation request' });
    }
});
app.post('/api/shift-requests/:id/deny-cancellation', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        const denialReason = String(req.body?.reason || '').trim();
        if (!denialReason) {
            return res.status(400).json({ error: 'Cancellation denial reason is required.' });
        }
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facilityStatus = await ensureFacilityIsActive(facilityId);
        if (!facilityStatus.ok) {
            clearAuthCookie(res);
            return res.status(403).json({ error: facilityStatus.error });
        }
        const existing = await prisma.shiftRequest.findUnique({
            where: { id },
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
        });
        if (!existing) {
            return res.status(404).json({ error: 'Shift request not found' });
        }
        if (existing.shift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (existing.status !== 'CANCELLATION_REQUESTED') {
            return res.status(400).json({ error: 'This request is not awaiting cancellation review.' });
        }
        const updated = await prisma.shiftRequest.update({
            where: { id },
            data: {
                status: 'APPROVED',
                reviewedAt: new Date(),
                reviewNotes: `Cancellation denied by facility: ${denialReason}`,
            },
        });
        await createWorkerNotification({
            professionalId: updated.professionalId,
            type: 'GENERAL',
            title: 'Cancellation denied',
            message: `Your cancellation request was denied. You are still scheduled for this shift. Reason: ${denialReason}`,
        });
        if (existing.professional.user.email) {
            try {
                await sendEmail({
                    to: existing.professional.user.email,
                    subject: `Cancellation denied: ${existing.shift.facility.name}`,
                    html: `
            <h2>Cancellation denied</h2>
            <p>Your cancellation request was denied. You remain scheduled for this shift.</p>
            <p><strong>Facility:</strong> ${existing.shift.facility.name}</p>
            <p><strong>Role:</strong> ${existing.shift.role}</p>
            <p><strong>Shift Type:</strong> ${existing.shift.shiftType}</p>
            <p><strong>Date:</strong> ${new Date(existing.shift.date).toLocaleDateString()}</p>
            <p><strong>Time:</strong> ${existing.shift.startTimeLabel} - ${existing.shift.endTimeLabel}</p>
          `,
                    text: [
                        'Cancellation denied',
                        'You remain scheduled for this shift.',
                        `Facility: ${existing.shift.facility.name}`,
                        `Role: ${existing.shift.role}`,
                        `Shift Type: ${existing.shift.shiftType}`,
                        `Date: ${new Date(existing.shift.date).toLocaleDateString()}`,
                        `Time: ${existing.shift.startTimeLabel} - ${existing.shift.endTimeLabel}`,
                    ].join('\n'),
                });
            }
            catch (emailError) {
                console.error('Worker cancellation denied email failed:', emailError);
            }
        }
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shift-requests/:id/deny-cancellation error:', error);
        res.status(500).json({ error: 'Failed to deny cancellation request' });
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
                startTimeLabel: request.shift.startTimeLabel,
                endTimeLabel: request.shift.endTimeLabel,
                facilityName: request.shift.facility.name,
                city: request.shift.facility.city,
                state: request.shift.facility.state,
                address: [
                    request.shift.facility.addressLine1,
                    request.shift.facility.addressLine2,
                    request.shift.facility.city,
                    request.shift.facility.state,
                    request.shift.facility.zipCode,
                ]
                    .filter(Boolean)
                    .join(', '),
                specialInstructions: request.shift.specialInstructions ?? null,
            },
        }));
        res.json({ data });
    }
    catch (error) {
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
                addressLine1: profile.addressLine1,
                addressLine2: profile.addressLine2,
                city: profile.city,
                state: profile.state,
                zipCode: profile.zipCode,
                maxDistanceMiles: profile.maxDistanceMiles,
                openShiftAlertsEnabled: profile.openShiftAlertsEnabled,
                openShiftAlertRadiusMiles: profile.openShiftAlertRadiusMiles,
                hourlyRateCents: profile.hourlyRateCents,
                regularPayRateCents: profile.regularPayRateCents,
                overtimePayRateCents: profile.overtimePayRateCents,
                doublePayRateCents: profile.doublePayRateCents,
                bio: profile.bio,
                onboardingStatus: profile.onboardingStatus,
                approvedByWezen: profile.approvedByWezen,
                firstName: profile.user.firstName,
                lastName: profile.user.lastName,
                email: profile.user.email,
                phone: profile.user.phone,
            },
        });
    }
    catch (error) {
        console.error('GET /api/worker/profile error:', error);
        res.status(500).json({ error: 'Failed to fetch worker profile' });
    }
});
const updateWorkerProfileSchema = z.object({
    professionalId: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    phone: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zipCode: z.string().optional(),
    maxDistanceMiles: z.number().int().positive().optional(),
    openShiftAlertsEnabled: z.boolean().optional(),
    openShiftAlertRadiusMiles: z.number().int().positive().optional(),
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
                addressLine1: parsed.data.addressLine1,
                addressLine2: parsed.data.addressLine2,
                city: parsed.data.city,
                state: parsed.data.state,
                zipCode: parsed.data.zipCode,
                maxDistanceMiles: parsed.data.maxDistanceMiles,
                openShiftAlertsEnabled: parsed.data.openShiftAlertsEnabled,
                openShiftAlertRadiusMiles: parsed.data.openShiftAlertRadiusMiles,
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
                addressLine1: updated.addressLine1,
                addressLine2: updated.addressLine2,
                city: updated.city,
                state: updated.state,
                zipCode: updated.zipCode,
                maxDistanceMiles: updated.maxDistanceMiles,
                openShiftAlertsEnabled: updated.openShiftAlertsEnabled,
                openShiftAlertRadiusMiles: updated.openShiftAlertRadiusMiles,
                hourlyRateCents: updated.hourlyRateCents,
                bio: updated.bio,
                onboardingStatus: updated.onboardingStatus,
                approvedByWezen: updated.approvedByWezen,
            },
        });
    }
    catch (error) {
        console.error('PUT /api/worker/profile error:', error);
        res.status(500).json({ error: 'Failed to update worker profile' });
    }
});
app.put('/api/worker/notification-settings', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const professionalId = await getProfessionalProfileIdForUser(userId);
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const enabled = Boolean(req.body?.openShiftAlertsEnabled);
        const radius = Number(req.body?.openShiftAlertRadiusMiles || 50);
        const updated = await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                openShiftAlertsEnabled: enabled,
                openShiftAlertRadiusMiles: Number.isFinite(radius) && radius > 0 ? radius : 50,
            },
            select: {
                id: true,
                openShiftAlertsEnabled: true,
                openShiftAlertRadiusMiles: true,
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/worker/notification-settings error:', error);
        res.status(500).json({ error: 'Failed to update notification settings' });
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
    }
    catch (error) {
        console.error('GET /api/worker/documents error:', error);
        res.status(500).json({ error: 'Failed to fetch worker documents' });
    }
});
app.get('/api/worker/agreements', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('GET /api/worker/agreements error:', error);
        res.status(500).json({ error: 'Failed to fetch worker agreements' });
    }
});
const signAgreementSchema = z.object({
    agreementType: z.enum(['ICA']),
    signerName: z.string().min(1),
    signerEmail: z.email(),
});
app.post('/api/worker/agreements/sign', requireRole('PROFESSIONAL'), async (req, res) => {
    const parsed = signAgreementSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const professionalId = await getProfessionalProfileIdForUser(userId);
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                firstName: true,
                lastName: true,
                email: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const signerName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || parsed.data.signerName;
        const signerEmail = user.email || parsed.data.signerEmail;
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
                signerName,
                signerEmail,
            },
            create: {
                professionalId,
                agreementType: parsed.data.agreementType,
                status: 'SIGNED',
                signedAt: new Date(),
                signerName,
                signerEmail,
            },
        });
        await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                onboardingStatus: 'AGREEMENT_SIGNED',
            },
        });
        await prisma.workerNotification.updateMany({
            where: {
                professionalId,
                title: 'Agreement ready to sign',
                isRead: false,
            },
            data: {
                isRead: true,
            },
        });
        // Check if worker is ready for admin review
        const documents = await prisma.professionalDocument.findMany({
            where: { professionalId },
        });
        const hasDocuments = documents.length > 0;
        if (hasDocuments) {
            await prisma.professionalProfile.update({
                where: { id: professionalId },
                data: {
                    onboardingStatus: 'READY_FOR_REVIEW',
                },
            });
            console.log(`Worker ${professionalId} is READY_FOR_REVIEW`);
        }
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
    }
    catch (error) {
        console.error('POST /api/worker/agreements/sign error:', error);
        res.status(500).json({ error: 'Failed to sign agreement' });
    }
});
app.post('/api/worker/documents/upload', upload.single('file'), requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const bodyProfessionalId = String(req.body.professionalId || '');
        const category = String(req.body.category || '');
        const name = String(req.body.name || '');
        const expiresAtRaw = String(req.body.expiresAt || '').trim();
        const professionalId = await getProfessionalProfileIdForUser(userId);
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        if (bodyProfessionalId && bodyProfessionalId !== professionalId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!category) {
            return res.status(400).json({ error: 'category is required' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'file is required' });
        }
        let expiresAt = null;
        if (expiresAtRaw) {
            const parsedDate = new Date(expiresAtRaw);
            if (Number.isNaN(parsedDate.getTime())) {
                return res.status(400).json({ error: 'expiresAt must be a valid date' });
            }
            expiresAt = parsedDate;
        }
        const professional = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
            },
        });
        if (!professional) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const uploadedName = name || req.file.originalname;
        const uploaded = await uploadFileToCandidateFolder({
            firstName: professional.user.firstName,
            lastName: professional.user.lastName,
            professionalId,
            originalFileName: uploadedName,
            localFilePath: req.file.path,
            mimeType: req.file.mimetype,
        });
        const document = await prisma.professionalDocument.create({
            data: {
                professionalId,
                uploadedByUserId: userId,
                category: category,
                name: uploadedName,
                fileUrl: uploaded.webUrl,
                storageProvider: 'ONEDRIVE',
                oneDriveItemId: uploaded.itemId,
                oneDriveWebUrl: uploaded.webUrl,
                oneDrivePath: `${uploaded.folderPath}/${uploaded.name}`,
                oneDriveFolder: uploaded.folderPath,
                mimeType: req.file.mimetype || null,
                status: 'PENDING',
                expiresAt,
            },
        });
        try {
            await fs.promises.unlink(req.file.path);
        }
        catch (cleanupError) {
            console.warn('Failed to remove temp upload file:', cleanupError);
        }
        const professionalName = `${professional.user.firstName || ''} ${professional.user.lastName || ''}`.trim() ||
            professional.user.email ||
            'Unknown Professional';
        const professionalEmail = professional.user.email || 'Not available';
        try {
            const admins = await prisma.user.findMany({
                where: {
                    role: 'INTERNAL_ADMIN',
                    isActive: true,
                    notifyDocumentUploads: true,
                },
                select: { id: true },
            });
            await Promise.all(admins.map((admin) => createAdminNotification({
                userId: admin.id,
                type: 'GENERAL',
                title: 'Document uploaded',
                message: `${professionalName} uploaded ${document.category} for review.`,
            })));
        }
        catch (notificationError) {
            console.error('Document upload admin notification failed:', notificationError);
        }
        try {
            if (!ADMIN_ALERT_EMAIL) {
                console.error('Document upload email skipped: ADMIN_ALERT_EMAIL is not configured');
            }
            else {
                console.log('Sending document upload admin email', {
                    to: ADMIN_ALERT_EMAIL,
                    professionalId,
                    documentId: document.id,
                    category: document.category,
                    storageProvider: document.storageProvider,
                });
                await sendEmail({
                    to: ADMIN_ALERT_EMAIL,
                    subject: `Document uploaded for review: ${document.category}`,
                    html: `
        <h2>Candidate document uploaded</h2>
        <p><strong>Professional:</strong> ${professionalName}</p>
        <p><strong>Email:</strong> ${professionalEmail}</p>
        <p><strong>Document Name:</strong> ${document.name}</p>
        <p><strong>Category:</strong> ${document.category}</p>
        <p><strong>Status:</strong> ${document.status}</p>
        <p><strong>Uploaded At:</strong> ${document.createdAt.toISOString()}</p>
        <p><strong>Storage Provider:</strong> ${document.storageProvider}</p>
        <p><strong>OneDrive Folder:</strong> ${document.oneDriveFolder || 'Not available'}</p>
        <p><strong>OneDrive File:</strong> <a href="${document.oneDriveWebUrl || document.fileUrl}">${document.oneDriveWebUrl || document.fileUrl}</a></p>
        ${document.expiresAt
                        ? `<p><strong>Expires At:</strong> ${document.expiresAt.toISOString()}</p>`
                        : ''}
      `,
                    text: [
                        'Candidate document uploaded',
                        `Professional: ${professionalName}`,
                        `Email: ${professionalEmail}`,
                        `Document Name: ${document.name}`,
                        `Category: ${document.category}`,
                        `Status: ${document.status}`,
                        `Uploaded At: ${document.createdAt.toISOString()}`,
                        `Storage Provider: ${document.storageProvider}`,
                        `OneDrive Folder: ${document.oneDriveFolder || 'Not available'}`,
                        `OneDrive File: ${document.oneDriveWebUrl || document.fileUrl}`,
                        document.expiresAt ? `Expires At: ${document.expiresAt.toISOString()}` : '',
                    ]
                        .filter(Boolean)
                        .join('\n'),
                });
                console.log('Document upload admin email sent', {
                    to: ADMIN_ALERT_EMAIL,
                    documentId: document.id,
                });
            }
        }
        catch (emailError) {
            console.error('Document upload email notification failed:', emailError);
        }
        try {
            const requiredCategories = ['LICENSE', 'CPR', 'PHYSICAL', 'TB_REPORT', 'ID'];
            const allDocs = await prisma.professionalDocument.findMany({
                where: { professionalId },
                select: {
                    category: true,
                    status: true,
                },
            });
            const uploadedRequiredCategories = new Set(allDocs
                .filter((doc) => requiredCategories.includes(String(doc.category)))
                .map((doc) => String(doc.category)));
            const hasAllRequiredDocsUploaded = requiredCategories.every((category) => uploadedRequiredCategories.has(category));
            if (hasAllRequiredDocsUploaded) {
                const admins = await prisma.user.findMany({
                    where: {
                        role: 'INTERNAL_ADMIN',
                        isActive: true,
                        notifyWorkerReadyForReview: true,
                    },
                    select: { id: true },
                });
                await Promise.all(admins.map((admin) => createAdminNotification({
                    userId: admin.id,
                    type: 'GENERAL',
                    title: 'Worker ready for review',
                    message: `${professionalName} uploaded all required documents and is ready for admin review.`,
                })));
            }
            if (hasAllRequiredDocsUploaded && ADMIN_ALERT_EMAIL) {
                await sendEmail({
                    to: ADMIN_ALERT_EMAIL,
                    subject: `Worker ready for document review: ${professionalName}`,
                    html: `
            <h2>Worker uploaded all required documents</h2>
            <p><strong>Professional:</strong> ${professionalName}</p>
            <p><strong>Email:</strong> ${professionalEmail}</p>
            <p>The worker has uploaded all required documents and is ready for admin review.</p>
            <ul>
              <li>License</li>
              <li>CPR / BLS</li>
              <li>Physical Report</li>
              <li>TB Report</li>
                            <li>State ID</li>
            </ul>
          `,
                    text: [
                        'Worker uploaded all required documents',
                        `Professional: ${professionalName}`,
                        `Email: ${professionalEmail}`,
                        'Required documents uploaded:',
                        'License',
                        'CPR / BLS',
                        'Physical Report',
                        'TB Report',
                        'State ID',
                    ].join('\n'),
                });
            }
        }
        catch (readyEmailError) {
            console.error('All required documents uploaded email failed:', readyEmailError);
        }
        return res.status(201).json({
            data: {
                id: document.id,
                name: document.name,
                category: document.category,
                status: document.status,
                expiresAt: document.expiresAt,
                fileUrl: document.fileUrl,
                storageProvider: document.storageProvider,
                oneDriveItemId: document.oneDriveItemId,
                oneDriveWebUrl: document.oneDriveWebUrl,
                oneDriveFolder: document.oneDriveFolder,
                createdAt: document.createdAt,
            },
        });
    }
    catch (error) {
        console.error('POST /api/worker/documents/upload error:', error);
        return res.status(500).json({ error: 'Failed to upload document' });
    }
});
app.post('/api/worker/change-password', requireRole('PROFESSIONAL'), async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                passwordHash: true,
                role: true,
            },
        });
        if (!user || user.role !== 'PROFESSIONAL') {
            return res.status(404).json({ error: 'Worker user not found' });
        }
        if (!user.passwordHash) {
            return res.status(400).json({ error: 'Password is not set for this account' });
        }
        const matches = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
        if (!matches) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        const newPasswordHash = await hashPassword(parsed.data.newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
            },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/worker/change-password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
app.get('/api/facility/applicants/:requestId', requireRole('FACILITY_ADMIN'), async (req, res) => {
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
                    isDnr: request.professional.facilityDnrs.some((item) => item.facilityId === request.shift.facilityId),
                    dnrReason: request.professional.facilityDnrs.find((item) => item.facilityId === request.shift.facilityId)?.reason ?? null,
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
    }
    catch (error) {
        console.error('GET /api/facility/applicants/:requestId error:', error);
        res.status(500).json({ error: 'Failed to fetch applicant detail' });
    }
});
app.get('/api/facility/applicants/:requestId/documents', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const requestId = String(req.params.requestId || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!requestId) {
            return res.status(400).json({ error: 'requestId is required' });
        }
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const requestRecord = await prisma.shiftRequest.findUnique({
            where: { id: requestId },
            include: {
                shift: {
                    select: {
                        facilityId: true,
                    },
                },
                professional: {
                    include: {
                        documents: {
                            orderBy: [{ createdAt: 'desc' }],
                        },
                    },
                },
            },
        });
        if (!requestRecord) {
            return res.status(404).json({ error: 'Applicant request not found' });
        }
        if (requestRecord.shift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json({
            data: requestRecord.professional.documents.map((doc) => ({
                id: doc.id,
                name: doc.name,
                category: doc.category,
                status: doc.status,
                createdAt: doc.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('GET /api/facility/applicants/:requestId/documents error:', error);
        res.status(500).json({ error: 'Failed to fetch applicant documents' });
    }
});
app.get('/api/worker/eligibility', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const professionalId = await getProfessionalProfileIdForUser(userId);
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const result = await getWorkerEligibility(professionalId);
        res.json({
            data: result,
        });
    }
    catch (error) {
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
                    regularPayRateCents: worker.regularPayRateCents,
                    overtimePayRateCents: worker.overtimePayRateCents,
                    doublePayRateCents: worker.doublePayRateCents,
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
    }
    catch (error) {
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
        if (worker.user.isSystemUser) {
            return res.status(403).json({
                error: 'System users cannot be deleted.',
            });
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
                isSystemUser: worker.user.isSystemUser,
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
    }
    catch (error) {
        console.error('GET /api/admin/workers/:professionalId error:', error);
        res.status(500).json({ error: 'Failed to fetch admin worker detail' });
    }
});
const adminRejectDocumentSchema = z.object({
    notes: z.string().min(1),
});
const adminResetWorkerPasswordSchema = z.object({
    newPassword: z.string().min(8),
});
app.post('/api/admin/workers/:professionalId/reset-password', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = adminResetWorkerPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (worker.user.isSystemUser) {
            return res.status(403).json({ error: 'System user password cannot be reset here.' });
        }
        const passwordHash = await hashPassword(parsed.data.newPassword);
        await prisma.user.update({
            where: { id: worker.userId },
            data: { passwordHash },
        });
        return res.json({
            data: {
                ok: true,
                workerId: worker.id,
                email: worker.user.email,
            },
        });
    }
    catch (error) {
        console.error('POST /api/admin/workers/:professionalId/reset-password error:', error);
        return res.status(500).json({ error: 'Failed to reset worker password' });
    }
});
app.put('/api/admin/workers/:professionalId/pay-rates', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = updateWorkerPayRatesSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        const updated = await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                regularPayRateCents: parsed.data.regularPayRateCents ?? null,
                overtimePayRateCents: parsed.data.overtimePayRateCents ?? null,
                doublePayRateCents: parsed.data.doublePayRateCents ?? null,
            },
            select: {
                id: true,
                regularPayRateCents: true,
                overtimePayRateCents: true,
                doublePayRateCents: true,
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/admin/workers/:professionalId/pay-rates error:', error);
        res.status(500).json({ error: 'Failed to update worker pay rates' });
    }
});
app.post('/api/admin/workers/:professionalId/ica-signed', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        const agreement = await prisma.professionalAgreement.findFirst({
            where: {
                professionalId,
                agreementType: 'ICA',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        if (!agreement) {
            return res.status(404).json({ error: 'ICA agreement not found' });
        }
        const updated = await prisma.professionalAgreement.update({
            where: { id: agreement.id },
            data: {
                status: 'SIGNED',
                signedAt: new Date(),
            },
        });
        await createWorkerNotification({
            professionalId,
            type: 'GENERAL',
            title: 'ICA signed and approved',
            message: 'Your Independent Contractor Agreement has been completed. You can now begin requesting shifts.',
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/admin/workers/:professionalId/ica-signed error:', error);
        res.status(500).json({ error: 'Failed to mark ICA as signed' });
    }
});
app.post('/api/admin/workers/:professionalId/ica-sent', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        let agreement = await prisma.professionalAgreement.findFirst({
            where: {
                professionalId,
                agreementType: 'ICA',
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        if (!agreement) {
            agreement = await prisma.professionalAgreement.create({
                data: {
                    professionalId,
                    agreementType: 'ICA',
                    status: 'SENT',
                },
            });
        }
        else if (agreement.status === 'NOT_STARTED') {
            agreement = await prisma.professionalAgreement.update({
                where: { id: agreement.id },
                data: {
                    status: 'SENT',
                },
            });
        }
        await createWorkerNotification({
            professionalId,
            type: 'GENERAL',
            title: 'ICA sent for signature',
            message: 'Your Independent Contractor Agreement has been sent by Wezen Staffing via Adobe eSign. Please complete it from your email before requesting shifts.',
        });
        res.json({ data: agreement });
    }
    catch (error) {
        console.error('POST /api/admin/workers/:professionalId/ica-sent error:', error);
        res.status(500).json({ error: 'Failed to mark ICA as sent' });
    }
});
app.get('/api/admin/workers/:professionalId/documents', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        const documents = await prisma.professionalDocument.findMany({
            where: { professionalId },
            orderBy: [{ createdAt: 'desc' }],
            select: {
                id: true,
                name: true,
                category: true,
                status: true,
                fileUrl: true,
                createdAt: true,
            },
        });
        res.json({ data: documents });
    }
    catch (error) {
        console.error('GET /api/admin/workers/:professionalId/documents error:', error);
        res.status(500).json({ error: 'Failed to fetch worker documents' });
    }
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
            include: {
                professional: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        const profile = await prisma.professionalProfile.findUnique({
            where: { id: updated.professionalId },
            include: {
                documents: true,
                agreements: true,
            },
        });
        try {
            const workerEmail = updated.professional.user.email;
            const workerName = `${updated.professional.user.firstName || ''} ${updated.professional.user.lastName || ''}`.trim() ||
                workerEmail ||
                'Professional';
            if (workerEmail) {
                await sendEmail({
                    to: workerEmail,
                    subject: `Document approved: ${updated.name}`,
                    html: `
            <h2>Document approved</h2>
            <p>Hello ${workerName},</p>
            <p>Your document has been approved by Wezen Staffing.</p>
            <p><strong>Document:</strong> ${updated.name}</p>
            <p><strong>Category:</strong> ${updated.category}</p>
            <p><strong>Status:</strong> ${updated.status}</p>
          `,
                    text: [
                        `Hello ${workerName},`,
                        'Your document has been approved by Wezen Staffing.',
                        `Document: ${updated.name}`,
                        `Category: ${updated.category}`,
                        `Status: ${updated.status}`,
                    ].join('\n'),
                });
            }
        }
        catch (workerEmailError) {
            console.error('Worker document approved email failed:', workerEmailError);
        }
        if (profile) {
            const ica = profile.agreements.find((agreement) => agreement.agreementType === 'ICA');
            const requiredCategories = ['LICENSE', 'CPR', 'PHYSICAL', 'TB_REPORT', 'ID'];
            const hasAllRequiredDocs = requiredCategories.every((category) => {
                const doc = profile.documents.find((item) => item.category === category);
                return !!doc && doc.status === 'APPROVED';
            });
            if (hasAllRequiredDocs && (!ica || ica.status !== 'SIGNED')) {
                const existingAgreementReadyNotification = await prisma.workerNotification.findFirst({
                    where: {
                        professionalId: updated.professionalId,
                        title: 'Agreement ready to sign',
                        isRead: false,
                    },
                    orderBy: {
                        createdAt: 'desc',
                    },
                });
                if (!existingAgreementReadyNotification) {
                    await createWorkerNotification({
                        professionalId: updated.professionalId,
                        type: 'GENERAL',
                        title: 'Agreement ready to sign',
                        message: 'Your required documents are approved. Please review and sign your Independent Contractor Agreement.',
                    });
                }
            }
        }
        res.json({ data: updated });
    }
    catch (error) {
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
    }
    catch (error) {
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
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (worker.user.isSystemUser) {
            return res.status(403).json({
                error: 'System users cannot be modified through worker approval actions.',
            });
        }
        const updated = await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                approvedByWezen: true,
                onboardingStatus: 'APPROVED',
            },
        });
        await createWorkerNotification({
            professionalId,
            type: 'SHIFT_APPROVED',
            title: 'Profile approved by Wezen',
            message: 'Your profile has been approved by Wezen. You can now request available shifts.',
        });
        res.json({ data: updated });
    }
    catch (error) {
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
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (worker.user.isSystemUser) {
            return res.status(403).json({
                error: 'System users cannot be moved under review.',
            });
        }
        const updated = await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                approvedByWezen: false,
                onboardingStatus: 'UNDER_REVIEW',
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/admin/workers/:professionalId/unapprove error:', error);
        res.status(500).json({ error: 'Failed to unapprove worker' });
    }
});
const adminRejectWorkerSchema = z.object({
    reason: z.string().min(1),
});
app.post('/api/admin/workers/:professionalId/reject', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = adminRejectWorkerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const professionalId = String(req.params.professionalId || '');
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (worker.user.isSystemUser) {
            return res.status(403).json({
                error: 'System users cannot be rejected.',
            });
        }
        const updated = await prisma.professionalProfile.update({
            where: { id: professionalId },
            data: {
                approvedByWezen: false,
                onboardingStatus: 'REJECTED',
            },
        });
        await createWorkerNotification({
            professionalId,
            type: 'GENERAL',
            title: 'Profile rejected',
            message: `Your profile was rejected by Wezen Staffing. Reason: ${parsed.data.reason}`,
        });
        res.json({
            data: {
                id: updated.id,
                approvedByWezen: updated.approvedByWezen,
                onboardingStatus: updated.onboardingStatus,
            },
        });
    }
    catch (error) {
        console.error('POST /api/admin/workers/:professionalId/reject error:', error);
        res.status(500).json({ error: 'Failed to reject worker' });
    }
});
app.delete('/api/admin/workers/:professionalId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
                requests: true,
                notifications: true,
                facilityDnrs: true,
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (worker.user.role === 'INTERNAL_ADMIN' && worker.user.isSystemUser) {
            return res.status(403).json({
                error: 'Core internal admin account cannot be deleted',
            });
        }
        if (worker.requests.length > 0) {
            return res.status(400).json({
                error: 'Cannot delete a worker that has shift request history. Remove only test/empty accounts.',
            });
        }
        await prisma.professionalDocument.deleteMany({
            where: { professionalId },
        });
        await prisma.professionalAgreement.deleteMany({
            where: { professionalId },
        });
        await prisma.workerNotification.deleteMany({
            where: { professionalId },
        });
        await prisma.facilityDnr.deleteMany({
            where: { professionalId },
        });
        await prisma.professionalProfile.delete({
            where: { id: professionalId },
        });
        await prisma.user.delete({
            where: { id: worker.userId },
        });
        res.json({
            data: {
                deletedProfessionalId: professionalId,
                deletedUserId: worker.userId,
                email: worker.user.email,
            },
        });
    }
    catch (error) {
        console.error('DELETE /api/admin/workers/:professionalId error:', error);
        res.status(500).json({ error: 'Failed to delete worker' });
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
    }
    catch (error) {
        console.error('POST /api/shifts/:id/duplicate error:', error);
        res.status(500).json({ error: 'Failed to duplicate shift' });
    }
});
app.get('/api/facility/shifts/:shiftId', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const shiftId = String(req.params.shiftId || '');
        const userId = req.authUser.userId;
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
        const approvedCount = shift.requests.filter((request) => request.status === 'APPROVED').length;
        const pendingCount = shift.requests.filter((request) => request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW').length;
        const rejectedCount = shift.requests.filter((request) => request.status === 'REJECTED').length;
        const workersNeeded = shift.workersNeeded;
        let fillStatus = 'OPEN';
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
                        approvedDocCount: request.professional.documents.filter((doc) => doc.status === 'APPROVED').length,
                        pendingDocCount: request.professional.documents.filter((doc) => doc.status === 'PENDING').length,
                        rejectedDocCount: request.professional.documents.filter((doc) => doc.status === 'REJECTED').length,
                        expiredDocCount: request.professional.documents.filter((doc) => doc.status === 'EXPIRED').length,
                    },
                })),
            },
        });
    }
    catch (error) {
        console.error('GET /api/facility/shifts/:shiftId error:', error);
        res.status(500).json({ error: 'Failed to fetch shift detail' });
    }
});
const facilityDnrSchema = z.object({
    professionalId: z.string().min(1),
    reason: z.string().optional(),
});
app.put('/api/facility/shifts/:id', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const shiftId = String(req.params.id);
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const shift = await prisma.shift.findUnique({
            where: { id: shiftId },
            include: { requests: true },
        });
        if (!shift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        if (shift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        // 🚫 Do NOT allow edits if already assigned
        const hasApproved = shift.requests.some(r => r.status === 'APPROVED');
        if (shift.status !== 'OPEN' || hasApproved) {
            return res.status(400).json({
                error: 'Cannot edit shift after approvals. Cancel and recreate instead.',
            });
        }
        const { date, shiftType, startTimeLabel, endTimeLabel, workersNeeded, payRateCents, specialInstructions, } = req.body;
        const updated = await prisma.shift.update({
            where: { id: shiftId },
            data: {
                date: date ? new Date(`${String(date)}T12:00:00.000Z`) : undefined,
                shiftType,
                startTimeLabel,
                endTimeLabel,
                workersNeeded,
                payRateCents,
                specialInstructions,
            },
        });
        return res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/facility/shifts/:id error:', error);
        res.status(500).json({ error: 'Failed to update shift' });
    }
});
app.post('/api/facility/dnr', requireRole('FACILITY_ADMIN'), async (req, res) => {
    const parsed = facilityDnrSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
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
        await createWorkerNotification({
            professionalId: parsed.data.professionalId,
            type: 'DNR_BLOCK',
            title: 'Facility restriction added',
            message: parsed.data.reason
                ? `A facility has restricted future shift requests. Reason: ${parsed.data.reason}`
                : 'A facility has restricted future shift requests.',
        });
        res.status(201).json({ data: created });
    }
    catch (error) {
        console.error('POST /api/facility/dnr error:', error);
        res.status(500).json({ error: 'Failed to add worker to DNR list' });
    }
});
app.post('/api/facility/change-password', requireRole('FACILITY_ADMIN'), async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                passwordHash: true,
                role: true,
            },
        });
        if (!user || user.role !== 'FACILITY_ADMIN') {
            return res.status(404).json({ error: 'Facility user not found' });
        }
        if (!user.passwordHash) {
            return res.status(400).json({ error: 'Password is not set for this account' });
        }
        const matches = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
        if (!matches) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        const newPasswordHash = await hashPassword(parsed.data.newPassword);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newPasswordHash,
            },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/facility/change-password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
app.delete('/api/facility/dnr', requireRole('FACILITY_ADMIN'), async (req, res) => {
    const professionalId = String(req.query.professionalId || '');
    if (!professionalId) {
        return res.status(400).json({ error: 'professionalId is required' });
    }
    try {
        const userId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('DELETE /api/facility/dnr error:', error);
        res.status(500).json({ error: 'Failed to remove worker from DNR list' });
    }
});
app.get('/api/worker/shifts', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const professionalId = await getProfessionalProfileIdForUser(userId);
        const role = req.query.role;
        const shiftType = req.query.shiftType;
        const radiusParam = String(req.query.radius || '');
        const location = String(req.query.location || '').trim();
        let radiusMiles = null;
        if (radiusParam) {
            const parsedRadius = Number(radiusParam.replace(/[^\d]/g, ''));
            radiusMiles = Number.isFinite(parsedRadius) && parsedRadius > 0 ? parsedRadius : null;
        }
        if (!professionalId) {
            return res.status(404).json({ error: 'Professional profile not found' });
        }
        const profile = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            select: {
                city: true,
                state: true,
                zipCode: true,
                latitude: true,
                longitude: true,
                maxDistanceMiles: true,
            },
        });
        const shifts = await prisma.shift.findMany({
            where: {
                status: ShiftStatus.OPEN,
                facility: {
                    isActive: true,
                    ...(location
                        ? {
                            OR: [
                                { city: { contains: location, mode: 'insensitive' } },
                                { state: { contains: location, mode: 'insensitive' } },
                                { zipCode: { contains: location, mode: 'insensitive' } },
                                { name: { contains: location, mode: 'insensitive' } },
                            ],
                        }
                        : {}),
                },
                ...(role ? { role } : {}),
                ...(shiftType ? { shiftType } : {}),
                date: {
                    gte: new Date(new Date().toDateString()),
                },
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
            const approvedCount = shift.requests.filter((request) => request.status === 'APPROVED').length;
            const pendingCount = shift.requests.filter((request) => request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW').length;
            const workersNeeded = shift.workersNeeded;
            let fillStatus = 'OPEN';
            if (approvedCount > 0 && approvedCount < workersNeeded) {
                fillStatus = 'PARTIAL';
            }
            if (approvedCount >= workersNeeded) {
                fillStatus = 'FILLED';
            }
            const isBlockedByFacilityDnr = dnrMap.has(shift.facilityId);
            let distanceMiles = null;
            if (profile?.latitude != null &&
                profile?.longitude != null &&
                shift.facility.latitude != null &&
                shift.facility.longitude != null) {
                distanceMiles = calculateDistanceMiles(profile.latitude, profile.longitude, shift.facility.latitude, shift.facility.longitude);
                distanceMiles = Math.round(distanceMiles * 10) / 10;
            }
            return {
                id: shift.id,
                role: shift.role,
                facilityId: shift.facilityId,
                facilityName: shift.facility.name,
                city: shift.facility.city,
                state: shift.facility.state,
                distanceMiles,
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
        let filtered = data;
        const effectiveRadius = radiusMiles ?? (profile?.maxDistanceMiles != null ? profile.maxDistanceMiles : null);
        if (effectiveRadius != null) {
            filtered = filtered.filter((shift) => shift.distanceMiles == null || shift.distanceMiles <= effectiveRadius);
        }
        filtered.sort((a, b) => {
            if (a.distanceMiles == null && b.distanceMiles == null) {
                return new Date(a.date).getTime() - new Date(b.date).getTime();
            }
            if (a.distanceMiles == null)
                return 1;
            if (b.distanceMiles == null)
                return -1;
            return a.distanceMiles - b.distanceMiles;
        });
        res.json({ data: filtered });
    }
    catch (error) {
        console.error('GET /api/worker/shifts error:', error);
        res.status(500).json({ error: 'Failed to fetch worker shifts' });
    }
});
app.get('/api/worker/notifications', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('POST /api/worker/notifications/:id/read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
app.post('/api/shifts/:id/close', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('POST /api/shifts/:id/close error:', error);
        res.status(500).json({ error: 'Failed to close shift' });
    }
});
app.post('/api/shifts/:id/reopen', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
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
        const result = await prisma.$transaction(async (tx) => {
            const deletedRequests = await tx.shiftRequest.deleteMany({
                where: { shiftId: id },
            });
            const updated = await tx.shift.update({
                where: { id },
                data: {
                    status: 'OPEN',
                },
            });
            return {
                updated,
                deletedRequestCount: deletedRequests.count,
            };
        });
        res.json({ data: result.updated, deletedRequestCount: result.deletedRequestCount });
    }
    catch (error) {
        console.error('POST /api/shifts/:id/reopen error:', error);
        res.status(500).json({ error: 'Failed to reopen shift' });
    }
});
app.post('/api/shifts/:id/cancel', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
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
                date: true,
                startTimeLabel: true,
                status: true,
            },
        });
        if (!existingShift) {
            return res.status(404).json({ error: 'Shift not found' });
        }
        if (existingShift.facilityId !== facilityId) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (existingShift.status === 'CANCELLED') {
            return res.json({
                data: existingShift,
            });
        }
        const shiftStart = buildShiftStartDate(existingShift.date, existingShift.startTimeLabel);
        const now = new Date();
        const diffMs = shiftStart.getTime() - now.getTime();
        const fourHoursMs = 4 * 60 * 60 * 1000;
        if (diffMs < fourHoursMs) {
            return res.status(400).json({
                error: 'Shifts cannot be cancelled within 4 hours of the start time. Please contact Wezen Staffing for assistance.',
            });
        }
        const updated = await prisma.shift.update({
            where: { id },
            data: {
                status: 'CANCELLED',
            },
        });
        try {
            await sendFacilityShiftCancelledEmail(updated.id);
        }
        catch (emailError) {
            console.error('Facility shift cancelled email failed:', emailError);
        }
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/shifts/:id/cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel shift' });
    }
});
app.get('/api/worker/notifications/unread-count', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('GET /api/worker/notifications/unread-count error:', error);
        res.status(500).json({ error: 'Failed to fetch unread notification count' });
    }
});
app.post('/api/worker/notifications/mark-all-read', requireRole('PROFESSIONAL'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('POST /api/worker/notifications/mark-all-read error:', error);
        res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
});
app.post('/api/users/device-tokens', requireAuth, async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const token = String(req.body?.token || '').trim();
        const platform = String(req.body?.platform || '').trim() || null;
        if (!token) {
            return res.status(400).json({ error: 'Device token is required' });
        }
        const saved = await prisma.userDeviceToken.upsert({
            where: { token },
            update: {
                userId,
                platform,
                isActive: true,
            },
            create: {
                userId,
                token,
                platform,
            },
        });
        res.json({ data: saved });
    }
    catch (error) {
        console.error('POST /api/users/device-tokens error:', error);
        res.status(500).json({ error: 'Failed to save device token' });
    }
});
app.get('/api/facility/notifications', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const facilityId = await getFacilityIdForUser(req.authUser.userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const notifications = await prisma.facilityNotification.findMany({
            where: { facilityId },
            orderBy: [{ createdAt: 'desc' }],
            take: 100,
        });
        res.json({ data: notifications });
    }
    catch (error) {
        console.error('GET /api/facility/notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch facility notifications' });
    }
});
app.get('/api/facility/notifications/unread-count', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const facilityId = await getFacilityIdForUser(req.authUser.userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const count = await prisma.facilityNotification.count({
            where: {
                facilityId,
                isRead: false,
            },
        });
        res.json({ data: { unreadCount: count, count } });
    }
    catch (error) {
        console.error('GET /api/facility/notifications/unread-count error:', error);
        res.status(500).json({ error: 'Failed to fetch facility unread count' });
    }
});
app.post('/api/facility/notifications/:id/read', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const facilityId = await getFacilityIdForUser(req.authUser.userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const updated = await prisma.facilityNotification.updateMany({
            where: { id, facilityId },
            data: { isRead: true },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/facility/notifications/:id/read error:', error);
        res.status(500).json({ error: 'Failed to mark facility notification read' });
    }
});
app.post('/api/facility/notifications/mark-all-read', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const facilityId = await getFacilityIdForUser(req.authUser.userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        await prisma.facilityNotification.updateMany({
            where: { facilityId, isRead: false },
            data: { isRead: true },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/facility/notifications/mark-all-read error:', error);
        res.status(500).json({ error: 'Failed to mark facility notifications read' });
    }
});
app.get('/api/admin/notifications', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const notifications = await prisma.adminNotification.findMany({
            where: { userId },
            orderBy: [{ createdAt: 'desc' }],
            take: 100,
        });
        res.json({ data: notifications });
    }
    catch (error) {
        console.error('GET /api/admin/notifications error:', error);
        res.status(500).json({ error: 'Failed to fetch admin notifications' });
    }
});
app.get('/api/admin/notifications/unread-count', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const count = await prisma.adminNotification.count({
            where: { userId, isRead: false },
        });
        res.json({ data: { unreadCount: count, count } });
    }
    catch (error) {
        console.error('GET /api/admin/notifications/unread-count error:', error);
        res.status(500).json({ error: 'Failed to fetch admin unread count' });
    }
});
app.post('/api/admin/notifications/:id/read', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const updated = await prisma.adminNotification.updateMany({
            where: { id, userId },
            data: { isRead: true },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('POST /api/admin/notifications/:id/read error:', error);
        res.status(500).json({ error: 'Failed to mark admin notification read' });
    }
});
app.post('/api/admin/notifications/mark-all-read', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        await prisma.adminNotification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/admin/notifications/mark-all-read error:', error);
        res.status(500).json({ error: 'Failed to mark admin notifications read' });
    }
});
app.get('/api/admin/facilities', requireRole('INTERNAL_ADMIN'), async (_req, res) => {
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
    }
    catch (error) {
        console.error('GET /api/admin/facilities error:', error);
        res.status(500).json({ error: 'Failed to fetch facilities' });
    }
});
app.delete('/api/admin/facilities/:facilityId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const facilityId = String(req.params.facilityId || '');
        if (!facilityId) {
            return res.status(400).json({ error: 'facilityId is required' });
        }
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: { id: true, name: true },
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        const adminUsers = await prisma.facilityAdmin.findMany({
            where: { facilityId },
            select: { userId: true },
        });
        const shifts = await prisma.shift.findMany({
            where: { facilityId },
            select: { id: true },
        });
        const shiftIds = shifts.map((shift) => shift.id);
        const adminUserIds = adminUsers.map((admin) => admin.userId);
        await prisma.$transaction(async (tx) => {
            if (shiftIds.length > 0) {
                await tx.shiftRequest.deleteMany({
                    where: { shiftId: { in: shiftIds } },
                });
            }
            await tx.facilityDnr.deleteMany({
                where: { facilityId },
            });
            await tx.facilityRequirement.deleteMany({
                where: { facilityId },
            });
            await tx.facilityInvite.deleteMany({
                where: { facilityId },
            });
            await tx.shift.deleteMany({
                where: { facilityId },
            });
            await tx.facilityAdmin.deleteMany({
                where: { facilityId },
            });
            if (adminUserIds.length > 0) {
                await tx.user.deleteMany({
                    where: { id: { in: adminUserIds } },
                });
            }
            await tx.facility.delete({
                where: { id: facilityId },
            });
        });
        return res.json({
            ok: true,
            deletedFacilityId: facility.id,
            deletedFacilityName: facility.name,
        });
    }
    catch (error) {
        console.error('DELETE /api/admin/facilities/:facilityId error:', error);
        return res.status(500).json({ error: 'Failed to delete facility' });
    }
});
app.post('/api/admin/facility-invites', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
        const activationLink = `https://wezenstaffing.com/signup/facility?invite=${invite.inviteCode}`;
        if (invite.email) {
            try {
                await sendEmail({
                    to: invite.email,
                    subject: `Wezen Staffing facility activation invite: ${facility.name}`,
                    html: `
        <h2>Facility activation invite</h2>
        <p>You have been invited to activate your facility admin account for <strong>${facility.name}</strong>.</p>
        <p><strong>Invite Code:</strong> ${invite.inviteCode}</p>
        <p><a href="${activationLink}">Activate Facility Account</a></p>
        ${invite.expiresAt
                        ? `<p><strong>Expires:</strong> ${invite.expiresAt.toLocaleString()}</p>`
                        : '<p>This invite does not currently have an expiration date.</p>'}
      `,
                    text: [
                        `Facility activation invite for ${facility.name}`,
                        `Invite Code: ${invite.inviteCode}`,
                        `Activation Link: ${activationLink}`,
                        invite.expiresAt ? `Expires: ${invite.expiresAt.toLocaleString()}` : 'No expiration date',
                    ].join('\n'),
                });
                console.log('Facility invite email sent:', {
                    facilityId: facility.id,
                    inviteId: invite.id,
                    to: invite.email,
                });
            }
            catch (emailError) {
                console.error('Facility invite email failed:', {
                    facilityId: facility.id,
                    inviteId: invite.id,
                    to: invite.email,
                    error: emailError,
                });
            }
        }
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
    }
    catch (error) {
        console.error('POST /api/admin/facility-invites error:', error);
        res.status(500).json({ error: 'Failed to create facility invite' });
    }
});
app.post('/api/admin/facilities', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
                defaultCnaRateCents: parsed.data.defaultCnaRateCents,
                defaultLvnRateCents: parsed.data.defaultLvnRateCents,
                defaultRnRateCents: parsed.data.defaultRnRateCents,
                allowRateOverride: parsed.data.allowRateOverride ?? false,
            },
            select: {
                id: true,
                name: true,
                facilityType: true,
                city: true,
                state: true,
                zipCode: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
        res.status(201).json({ data: facility });
    }
    catch (error) {
        console.error('POST /api/admin/facilities error:', error);
        res.status(500).json({ error: 'Failed to create facility' });
    }
});
app.post('/api/admin/facilities/:facilityId/deactivate', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
                    adminOverrideByUserId: req.authUser.userId,
                    adminOverrideAt: new Date(),
                },
            });
            return facility;
        });
        res.json({ data: result });
    }
    catch (error) {
        console.error('POST /api/admin/facilities/:facilityId/deactivate error:', error);
        res.status(500).json({ error: 'Failed to deactivate facility' });
    }
});
app.post('/api/admin/facilities/:facilityId/reactivate', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
    }
    catch (error) {
        console.error('POST /api/admin/facilities/:facilityId/reactivate error:', error);
        res.status(500).json({ error: 'Failed to reactivate facility' });
    }
});
app.get('/api/admin/facilities/:facilityId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const facilityId = String(req.params.facilityId || '');
        if (!facilityId) {
            return res.status(400).json({ error: 'facilityId is required' });
        }
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
                id: true,
                name: true,
                facilityType: true,
                city: true,
                state: true,
                zipCode: true,
                isActive: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        res.json({ data: facility });
    }
    catch (error) {
        console.error('GET /api/admin/facilities/:facilityId error:', error);
        res.status(500).json({ error: 'Failed to fetch facility detail' });
    }
});
app.put('/api/admin/facilities/:facilityId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const facilityId = String(req.params.facilityId || '');
        const { name, facilityType, city, state, zipCode, defaultCnaRateCents, defaultLvnRateCents, defaultRnRateCents, allowRateOverride, } = req.body || {};
        if (!facilityId) {
            return res.status(400).json({ error: 'facilityId is required' });
        }
        const updated = await prisma.facility.update({
            where: { id: facilityId },
            data: {
                name: String(name || '').trim(),
                facilityType: String(facilityType || '').trim(),
                city: String(city || '').trim(),
                state: String(state || '').trim(),
                zipCode: String(zipCode || '').trim(),
                defaultCnaRateCents: defaultCnaRateCents === null || defaultCnaRateCents === undefined
                    ? null
                    : Number(defaultCnaRateCents),
                defaultLvnRateCents: defaultLvnRateCents === null || defaultLvnRateCents === undefined
                    ? null
                    : Number(defaultLvnRateCents),
                defaultRnRateCents: defaultRnRateCents === null || defaultRnRateCents === undefined
                    ? null
                    : Number(defaultRnRateCents),
                allowRateOverride: Boolean(allowRateOverride),
            },
            select: {
                id: true,
                name: true,
                facilityType: true,
                city: true,
                state: true,
                zipCode: true,
                isActive: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/admin/facilities/:facilityId error:', error);
        res.status(500).json({ error: 'Failed to update facility' });
    }
});
app.post('/api/admin/shifts/:shiftId/cancel', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = adminShiftOverrideSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const shiftId = String(req.params.shiftId || '');
        const adminUserId = req.authUser.userId;
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
    }
    catch (error) {
        console.error('POST /api/admin/shifts/:shiftId/cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel shift' });
    }
});
app.post('/api/admin/shift-requests/:id/cancel', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
            type: 'GENERAL',
            title: 'Shift request cancelled',
            message: 'Your shift request was cancelled by Wezen Staffing. Please contact support if needed.',
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
    }
    catch (error) {
        console.error('POST /api/admin/shift-requests/:id/cancel error:', error);
        res.status(500).json({ error: 'Failed to cancel shift request' });
    }
});
app.delete('/api/admin/shifts/:shiftId', requireRole('INTERNAL_ADMIN'), async (req, res) => {
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
    }
    catch (error) {
        console.error('DELETE /api/admin/shifts/:shiftId error:', error);
        res.status(500).json({ error: 'Failed to delete shift' });
    }
});
app.get('/api/admin/shifts', requireRole('INTERNAL_ADMIN'), async (_req, res) => {
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
    }
    catch (error) {
        console.error('GET /api/admin/shifts error:', error);
        res.status(500).json({ error: 'Failed to fetch admin shifts' });
    }
});
app.get('/api/admin/shift-requests', requireRole('INTERNAL_ADMIN'), async (_req, res) => {
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
    }
    catch (error) {
        console.error('GET /api/admin/shift-requests error:', error);
        res.status(500).json({ error: 'Failed to fetch admin shift requests' });
    }
});
app.get('/api/facility/reports/shifts', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const startDateRaw = String(req.query.startDate || '');
        const endDateRaw = String(req.query.endDate || '');
        if (!startDateRaw || !endDateRaw) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const startDate = new Date(startDateRaw);
        const endDate = new Date(endDateRaw);
        endDate.setHours(23, 59, 59, 999);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date range' });
        }
        const shifts = await prisma.shift.findMany({
            where: {
                facilityId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                facility: true,
                requests: {
                    include: {
                        professional: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ date: 'asc' }],
        });
        const rows = [];
        for (const shift of shifts) {
            const approvedRequests = shift.requests.filter((r) => r.status === 'APPROVED');
            if (approvedRequests.length === 0) {
                rows.push({
                    shiftId: shift.id,
                    date: shift.date,
                    role: shift.role,
                    shiftType: shift.shiftType,
                    startTime: shift.startTimeLabel,
                    endTime: shift.endTimeLabel,
                    facilityName: shift.facility.name,
                    shiftStatus: shift.status,
                    requestStatus: 'NONE',
                    workerName: null,
                    workerEmail: null,
                    workerPhone: null,
                    completed: shift.status === 'COMPLETED',
                    payRateCents: shift.payRateCents,
                    specialInstructions: shift.specialInstructions,
                });
                continue;
            }
            for (const request of approvedRequests) {
                rows.push({
                    shiftId: shift.id,
                    date: shift.date,
                    role: shift.role,
                    shiftType: shift.shiftType,
                    startTime: shift.startTimeLabel,
                    endTime: shift.endTimeLabel,
                    facilityName: shift.facility.name,
                    shiftStatus: shift.status,
                    requestStatus: request.status,
                    workerName: [request.professional.user.firstName, request.professional.user.lastName]
                        .filter(Boolean)
                        .join(' ') || null,
                    workerEmail: request.professional.user.email,
                    workerPhone: request.professional.user.phone,
                    completed: shift.status === 'COMPLETED',
                    payRateCents: shift.payRateCents,
                    specialInstructions: shift.specialInstructions,
                });
            }
        }
        const totalShifts = shifts.length;
        const filledShifts = shifts.filter((s) => s.status === 'FILLED' || s.status === 'COMPLETED').length;
        const completedShifts = shifts.filter((s) => s.status === 'COMPLETED').length;
        const cancelledShifts = shifts.filter((s) => s.status === 'CANCELLED').length;
        const unfilledShifts = shifts.filter((s) => s.status === 'UNFILLED').length;
        return res.json({
            data: {
                summary: {
                    totalShifts,
                    filledShifts,
                    completedShifts,
                    cancelledShifts,
                    unfilledShifts,
                    fillRate: totalShifts > 0
                        ? Math.round((filledShifts / totalShifts) * 10000) / 100
                        : 0,
                },
                rows,
            },
        });
    }
    catch (error) {
        console.error('GET /api/facility/reports/shifts error:', error);
        return res.status(500).json({ error: 'Failed to build facility shift report' });
    }
});
app.get('/api/facility/reports/shifts/export', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const startDateRaw = String(req.query.startDate || '');
        const endDateRaw = String(req.query.endDate || '');
        if (!startDateRaw || !endDateRaw) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }
        const startDate = new Date(startDateRaw);
        const endDate = new Date(endDateRaw);
        endDate.setHours(23, 59, 59, 999);
        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
            return res.status(400).json({ error: 'Invalid date range' });
        }
        const shifts = await prisma.shift.findMany({
            where: {
                facilityId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: {
                facility: true,
                requests: {
                    include: {
                        professional: {
                            include: {
                                user: true,
                            },
                        },
                    },
                },
            },
            orderBy: [{ date: 'asc' }],
        });
        const rows = [];
        for (const shift of shifts) {
            const approvedRequests = shift.requests.filter((r) => r.status === 'APPROVED');
            if (approvedRequests.length === 0) {
                rows.push({
                    shiftId: shift.id,
                    date: shift.date,
                    role: shift.role,
                    shiftType: shift.shiftType,
                    startTime: shift.startTimeLabel,
                    endTime: shift.endTimeLabel,
                    facilityName: shift.facility.name,
                    shiftStatus: shift.status,
                    requestStatus: 'NONE',
                    workerName: null,
                    workerEmail: null,
                    workerPhone: null,
                    completed: shift.status === 'COMPLETED',
                    payRateCents: shift.payRateCents,
                    specialInstructions: shift.specialInstructions,
                });
                continue;
            }
            for (const request of approvedRequests) {
                rows.push({
                    shiftId: shift.id,
                    date: shift.date,
                    role: shift.role,
                    shiftType: shift.shiftType,
                    startTime: shift.startTimeLabel,
                    endTime: shift.endTimeLabel,
                    facilityName: shift.facility.name,
                    shiftStatus: shift.status,
                    requestStatus: request.status,
                    workerName: [request.professional.user.firstName, request.professional.user.lastName]
                        .filter(Boolean)
                        .join(' ') || null,
                    workerEmail: request.professional.user.email,
                    workerPhone: request.professional.user.phone,
                    completed: shift.status === 'COMPLETED',
                    payRateCents: shift.payRateCents,
                    specialInstructions: shift.specialInstructions,
                });
            }
        }
        const csvHeader = [
            'Date',
            'Role',
            'Shift Type',
            'Start Time',
            'End Time',
            'Worker Name',
            'Worker Email',
            'Status',
            'Completed',
            'Pay Rate',
        ];
        const csvRows = rows.map((r) => [
            new Date(r.date).toLocaleDateString(),
            r.role,
            r.shiftType,
            r.startTime,
            r.endTime,
            r.workerName || '',
            r.workerEmail || '',
            r.shiftStatus,
            r.completed ? 'YES' : 'NO',
            r.payRateCents ? (r.payRateCents / 100).toFixed(2) : '',
        ]);
        const csv = [
            csvHeader.join(','),
            ...csvRows.map((row) => row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(',')),
        ].join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="facility-shift-report.csv"`);
        return res.send(csv);
    }
    catch (error) {
        console.error('GET /api/facility/reports/shifts/export error:', error);
        return res.status(500).json({ error: 'Failed to export facility shift report' });
    }
});
app.get('/api/facility/dashboard', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
                id: true,
                name: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
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
        const pendingRequests = requests.filter((request) => request.status === 'REQUESTED' || request.status === 'UNDER_REVIEW').length;
        const approvedRequests = requests.filter((request) => request.status === 'APPROVED').length;
        const complianceAlerts = complianceDocs.length;
        const activeWorkerIds = new Set(requests
            .filter((request) => request.status === 'APPROVED' &&
            request.shift.status === 'OPEN')
            .map((request) => request.professionalId));
        const activeWorkers = activeWorkerIds.size;
        const recentShifts = shifts
            .sort((a, b) => +new Date(b.date) - +new Date(a.date))
            .slice(0, 6)
            .map((shift) => {
            const approvedCount = shift.requests.filter((r) => r.status === 'APPROVED').length;
            const activeApplicantCount = shift.requests.filter((r) => [
                'REQUESTED',
                'UNDER_REVIEW',
                'APPROVED',
                'CANCELLATION_REQUESTED',
            ].includes(r.status)).length;
            return {
                id: shift.id,
                role: shift.role,
                shiftType: shift.shiftType,
                date: shift.date,
                applicants: activeApplicantCount,
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
                facility: {
                    id: facility?.id,
                    name: facility?.name,
                    defaultCnaRateCents: facility?.defaultCnaRateCents ?? null,
                    defaultLvnRateCents: facility?.defaultLvnRateCents ?? null,
                    defaultRnRateCents: facility?.defaultRnRateCents ?? null,
                    allowRateOverride: facility?.allowRateOverride ?? false,
                },
                recentShifts,
            },
        });
    }
    catch (error) {
        console.error('GET /api/facility/dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch facility dashboard' });
    }
});
app.get('/api/facility/workers', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
        const grouped = new Map();
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
            }
            else {
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
    }
    catch (error) {
        console.error('GET /api/facility/workers error:', error);
        res.status(500).json({ error: 'Failed to fetch facility workers' });
    }
});
app.get('/api/facility/workers/:professionalId', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const professionalId = String(req.params.professionalId || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!professionalId) {
            return res.status(400).json({ error: 'professionalId is required' });
        }
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
                documents: true,
                requests: {
                    include: {
                        shift: true,
                    },
                    orderBy: [{ requestedAt: 'desc' }],
                },
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        const hasFacilityRelationship = worker.requests.some((request) => request.shift.facilityId === facilityId);
        if (!hasFacilityRelationship) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        res.json({
            data: {
                id: worker.id,
                firstName: worker.user.firstName,
                lastName: worker.user.lastName,
                email: worker.user.email,
                phone: worker.user.phone,
                role: worker.role,
                city: worker.city,
                state: worker.state,
                documents: worker.documents.map((doc) => ({
                    id: doc.id,
                    name: doc.name,
                    category: doc.category,
                    status: doc.status,
                    expiresAt: doc.expiresAt,
                    notes: doc.notes,
                    createdAt: doc.createdAt,
                })),
            },
        });
    }
    catch (error) {
        console.error('GET /api/facility/workers/:professionalId error:', error);
        res.status(500).json({ error: 'Failed to fetch facility worker detail' });
    }
});
app.get('/api/facility/compliance', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
            const items = [];
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
    }
    catch (error) {
        console.error('GET /api/facility/compliance error:', error);
        res.status(500).json({ error: 'Failed to fetch compliance alerts' });
    }
});
app.get('/api/facility/settings', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facilityStatus = await ensureFacilityIsActive(facilityId);
        if (!facilityStatus.ok) {
            clearAuthCookie(res);
            return res.status(403).json({ error: facilityStatus.error });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                notificationEmail: true,
            },
        });
        const facility = await prisma.facility.findUnique({
            where: { id: facilityId },
            select: {
                id: true,
                name: true,
                facilityType: true,
                city: true,
                state: true,
                zipCode: true,
                contactEmail: true,
                contactPhone: true,
                defaultCnaRateCents: true,
                defaultLvnRateCents: true,
                defaultRnRateCents: true,
                allowRateOverride: true,
            },
        });
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }
        res.json({
            data: {
                ...facility,
                firstName: user?.firstName || null,
                lastName: user?.lastName || null,
                email: user?.email || null,
                phone: user?.phone || null,
                notificationEmail: user?.notificationEmail || null,
            },
        });
    }
    catch (error) {
        console.error('GET /api/facility/settings error:', error);
        res.status(500).json({ error: 'Failed to fetch facility settings' });
    }
});
app.put('/api/facility/settings', requireRole('FACILITY_ADMIN'), async (req, res) => {
    const parsed = updateFacilitySettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const facilityStatus = await ensureFacilityIsActive(facilityId);
        if (!facilityStatus.ok) {
            clearAuthCookie(res);
            return res.status(403).json({ error: facilityStatus.error });
        }
        const facility = await prisma.facility.update({
            where: { id: facilityId },
            data: {
                name: parsed.data.name,
                facilityType: parsed.data.facilityType,
                city: parsed.data.city,
                state: parsed.data.state,
                zipCode: parsed.data.zipCode,
                contactEmail: parsed.data.contactEmail,
                contactPhone: parsed.data.contactPhone,
                defaultCnaRateCents: parsed.data.defaultCnaRateCents ?? null,
                defaultLvnRateCents: parsed.data.defaultLvnRateCents ?? null,
                defaultRnRateCents: parsed.data.defaultRnRateCents ?? null,
                allowRateOverride: parsed.data.allowRateOverride ?? false,
            },
        });
        const user = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: parsed.data.firstName ?? null,
                lastName: parsed.data.lastName ?? null,
                phone: parsed.data.phone ?? null,
                notificationEmail: parsed.data.notificationEmail ?? null,
            },
        });
        res.json({
            data: {
                id: facility.id,
                name: facility.name,
                facilityType: facility.facilityType,
                city: facility.city,
                state: facility.state,
                zipCode: facility.zipCode,
                contactEmail: facility.contactEmail,
                contactPhone: facility.contactPhone,
                defaultCnaRateCents: facility.defaultCnaRateCents,
                defaultLvnRateCents: facility.defaultLvnRateCents,
                defaultRnRateCents: facility.defaultRnRateCents,
                allowRateOverride: facility.allowRateOverride,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                phone: user.phone,
                notificationEmail: user.notificationEmail,
            },
        });
    }
    catch (error) {
        console.error('PUT /api/facility/settings error:', error);
        res.status(500).json({ error: 'Failed to update facility settings' });
    }
});
app.get('/api/facility/favorites', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
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
        const grouped = new Map();
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
            }
            else {
                existing.approvedCount += 1;
            }
        }
        const favorites = Array.from(grouped.values())
            .filter((worker) => worker.approvedCount >= 2)
            .sort((a, b) => b.approvedCount - a.approvedCount);
        res.json({ data: favorites });
    }
    catch (error) {
        console.error('GET /api/facility/favorites error:', error);
        res.status(500).json({ error: 'Failed to fetch favorite workers' });
    }
});
app.get('/api/worker/shifts/:shiftId', requireRole('PROFESSIONAL'), async (req, res) => {
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
        const pendingCount = shift.requests.filter((r) => r.status === 'REQUESTED' || r.status === 'UNDER_REVIEW').length;
        const workersNeeded = shift.workersNeeded;
        let fillStatus = 'OPEN';
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
    }
    catch (error) {
        console.error('GET /api/worker/shifts/:shiftId error:', error);
        res.status(500).json({ error: 'Failed to fetch shift detail' });
    }
});
app.get('/api/admin/settings', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const userId = req.authUser.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                notificationEmail: true,
                notifyNewWorkerSignup: true,
                notifyDocumentUploads: true,
                notifyAgreementSigned: true,
                notifyWorkerReadyForReview: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'Admin user not found' });
        }
        res.json({
            data: {
                userId: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                notificationEmail: user.notificationEmail,
                notifyNewWorkerSignup: user.notifyNewWorkerSignup,
                notifyDocumentUploads: user.notifyDocumentUploads,
                notifyAgreementSigned: user.notifyAgreementSigned,
                notifyWorkerReadyForReview: user.notifyWorkerReadyForReview,
            },
        });
    }
    catch (error) {
        console.error('GET /api/admin/settings error:', error);
        res.status(500).json({ error: 'Failed to fetch admin settings' });
    }
});
app.put('/api/admin/settings', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = adminSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const updated = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName: parsed.data.firstName || null,
                lastName: parsed.data.lastName || null,
                notificationEmail: parsed.data.notificationEmail || null,
                notifyNewWorkerSignup: parsed.data.notifyNewWorkerSignup,
                notifyDocumentUploads: parsed.data.notifyDocumentUploads,
                notifyAgreementSigned: parsed.data.notifyAgreementSigned,
                notifyWorkerReadyForReview: parsed.data.notifyWorkerReadyForReview,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                notificationEmail: true,
                notifyNewWorkerSignup: true,
                notifyDocumentUploads: true,
                notifyAgreementSigned: true,
                notifyWorkerReadyForReview: true,
            },
        });
        res.json({ data: updated });
    }
    catch (error) {
        console.error('PUT /api/admin/settings error:', error);
        res.status(500).json({ error: 'Failed to update admin settings' });
    }
});
app.post('/api/admin/change-password', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    const parsed = adminChangePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() });
    }
    try {
        const userId = req.authUser.userId;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                passwordHash: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'Admin user not found' });
        }
        if (!user.passwordHash) {
            return res.status(400).json({ error: 'Password is not configured for this account' });
        }
        const valid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
        if (!valid) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }
        const newPasswordHash = await hashPassword(parsed.data.newPassword);
        await prisma.user.update({
            where: { id: userId },
            data: {
                passwordHash: newPasswordHash,
            },
        });
        res.json({ ok: true });
    }
    catch (error) {
        console.error('POST /api/admin/change-password error:', error);
        res.status(500).json({ error: 'Failed to change password' });
    }
});
app.get('/api/documents/:id/view', requireAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const role = req.authUser.role;
        const access = await canUserAccessDocument(userId, role, id);
        if (!access.ok || !access.document) {
            return res
                .status(access.error === 'Document not found' ? 404 : 403)
                .json({ error: access.error });
        }
        const doc = access.document;
        if (doc.storageProvider === 'ONEDRIVE' && doc.oneDriveItemId) {
            const fileBuffer = await downloadOneDriveFileBuffer(doc.oneDriveItemId);
            if (doc.mimeType) {
                res.setHeader('Content-Type', doc.mimeType);
            }
            else {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            res.setHeader('Content-Disposition', `inline; filename="${doc.name}"`);
            return res.send(fileBuffer);
        }
        const filePath = getUploadsFilePathFromUrl(doc.fileUrl);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        return res.sendFile(filePath);
    }
    catch (error) {
        console.error('GET /api/documents/:id/view error:', error);
        return res.status(500).json({ error: 'Failed to view document' });
    }
});
app.get('/api/documents/:id/download', requireAuth, async (req, res) => {
    try {
        const id = String(req.params.id || '');
        const userId = req.authUser.userId;
        const role = req.authUser.role;
        const access = await canUserAccessDocument(userId, role, id);
        if (!access.ok || !access.document) {
            return res
                .status(access.error === 'Document not found' ? 404 : 403)
                .json({ error: access.error });
        }
        const doc = access.document;
        if (doc.storageProvider === 'ONEDRIVE' && doc.oneDriveItemId) {
            const fileBuffer = await downloadOneDriveFileBuffer(doc.oneDriveItemId);
            if (doc.mimeType) {
                res.setHeader('Content-Type', doc.mimeType);
            }
            else {
                res.setHeader('Content-Type', 'application/octet-stream');
            }
            res.setHeader('Content-Disposition', `attachment; filename="${safeDownloadName({
                category: doc.category,
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
            })}"`);
            return res.send(fileBuffer);
        }
        const filePath = getUploadsFilePathFromUrl(doc.fileUrl);
        console.log('Document download debug', {
            documentId: doc.id,
            fileUrl: doc.fileUrl,
            filePath,
            exists: fs.existsSync(filePath),
            storageProvider: doc.storageProvider,
            oneDriveItemId: doc.oneDriveItemId,
        });
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found on disk' });
        }
        return res.download(filePath, doc.name);
    }
    catch (error) {
        console.error('GET /api/documents/:id/download error:', error);
        return res.status(500).json({ error: 'Failed to download document' });
    }
});
app.get('/api/facility/workers/:workerId/documents/download-all', requireRole('FACILITY_ADMIN'), async (req, res) => {
    try {
        const workerId = String(req.params.workerId || '');
        const userId = req.authUser.userId;
        const facilityId = await getFacilityIdForUser(userId);
        if (!facilityId) {
            return res.status(404).json({ error: 'Facility admin not found' });
        }
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: workerId },
            include: {
                user: true,
                requests: {
                    include: {
                        shift: {
                            select: {
                                facilityId: true,
                            },
                        },
                    },
                },
                documents: {
                    orderBy: [{ createdAt: 'desc' }],
                },
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        const belongsToFacility = worker.requests.some((request) => request.shift.facilityId === facilityId);
        if (!belongsToFacility) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        if (!worker.documents.length) {
            return res.status(404).json({ error: 'No documents found' });
        }
        const fullName = [worker.user.firstName, worker.user.lastName].filter(Boolean).join('_') ||
            worker.user.email ||
            'worker';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fullName}_documents.zip"`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            throw err;
        });
        archive.pipe(res);
        for (const doc of worker.documents) {
            try {
                if (doc.storageProvider === 'ONEDRIVE' && doc.oneDriveItemId) {
                    const fileBuffer = await downloadOneDriveFileBuffer(doc.oneDriveItemId);
                    archive.append(fileBuffer, { name: safeDownloadName(doc) });
                    continue;
                }
                const filePath = getUploadsFilePathFromUrl(doc.fileUrl);
                console.log('ZIP document debug', {
                    docId: doc.id,
                    name: doc.name,
                    fileUrl: doc.fileUrl,
                    filePath,
                    exists: fs.existsSync(filePath),
                    storageProvider: doc.storageProvider,
                    oneDriveItemId: doc.oneDriveItemId,
                });
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: safeDownloadName(doc) });
                }
            }
            catch (docError) {
                console.error('Facility ZIP document failed:', {
                    docId: doc.id,
                    name: doc.name,
                    error: docError,
                });
            }
        }
        await archive.finalize();
    }
    catch (error) {
        console.error('GET /api/facility/workers/:workerId/documents/download-all error:', error);
        return res.status(500).json({ error: 'Failed to download all documents' });
    }
});
app.get('/api/admin/workers/:professionalId/documents/download-all', requireRole('INTERNAL_ADMIN'), async (req, res) => {
    try {
        const professionalId = String(req.params.professionalId || '');
        const worker = await prisma.professionalProfile.findUnique({
            where: { id: professionalId },
            include: {
                user: true,
                documents: {
                    orderBy: [{ createdAt: 'desc' }],
                },
            },
        });
        if (!worker) {
            return res.status(404).json({ error: 'Worker not found' });
        }
        if (!worker.documents.length) {
            return res.status(404).json({ error: 'No documents found' });
        }
        const fullName = [worker.user.firstName, worker.user.lastName].filter(Boolean).join('_') ||
            worker.user.email ||
            'worker';
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${fullName}_documents.zip"`);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.on('error', (err) => {
            throw err;
        });
        archive.pipe(res);
        for (const doc of worker.documents) {
            try {
                if (doc.storageProvider === 'ONEDRIVE' && doc.oneDriveItemId) {
                    const fileBuffer = await downloadOneDriveFileBuffer(doc.oneDriveItemId);
                    archive.append(fileBuffer, { name: safeDownloadName(doc) });
                    continue;
                }
                const filePath = getUploadsFilePathFromUrl(doc.fileUrl);
                console.log('ZIP document debug', {
                    docId: doc.id,
                    name: doc.name,
                    fileUrl: doc.fileUrl,
                    filePath,
                    exists: fs.existsSync(filePath),
                    storageProvider: doc.storageProvider,
                    oneDriveItemId: doc.oneDriveItemId,
                });
                if (fs.existsSync(filePath)) {
                    archive.file(filePath, { name: safeDownloadName(doc) });
                }
            }
            catch (docError) {
                console.error('Admin ZIP document failed:', {
                    docId: doc.id,
                    name: doc.name,
                    error: docError,
                });
            }
        }
        await archive.finalize();
    }
    catch (error) {
        console.error('GET /api/admin/workers/:professionalId/documents/download-all error:', error);
        return res.status(500).json({ error: 'Failed to download all documents' });
    }
});
app.get('/api/admin/test-onedrive', requireRole('INTERNAL_ADMIN'), async (_req, res) => {
    try {
        const drive = await getOneDriveInfo();
        const rootChildren = await listOneDriveRootChildren();
        return res.json({
            ok: true,
            drive: {
                id: drive.id,
                driveType: drive.driveType,
                owner: drive.owner,
                webUrl: drive.webUrl,
            },
            rootChildrenCount: Array.isArray(rootChildren?.value) ? rootChildren.value.length : 0,
            rootChildren: Array.isArray(rootChildren?.value)
                ? rootChildren.value.map((item) => ({
                    id: item.id,
                    name: item.name,
                    folder: Boolean(item.folder),
                    file: Boolean(item.file),
                }))
                : [],
        });
    }
    catch (error) {
        console.error('GET /api/admin/test-onedrive error:', error);
        const message = error instanceof Error ? error.message : 'Failed to connect to OneDrive';
        return res.status(500).json({
            ok: false,
            error: message,
        });
    }
});
app.post('/api/internal/jobs/send-shift-reminders', async (req, res) => {
    try {
        const authHeader = String(req.headers.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!process.env.REMINDER_JOB_TOKEN || token !== process.env.REMINDER_JOB_TOKEN) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const now = new Date();
        const tomorrowStart = new Date(now);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        tomorrowStart.setHours(0, 0, 0, 0);
        const tomorrowEnd = new Date(tomorrowStart);
        tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);
        const approvedRequests = await prisma.shiftRequest.findMany({
            where: {
                status: 'APPROVED',
                shift: {
                    status: {
                        in: ['OPEN', 'FILLED']
                    },
                    date: {
                        gte: tomorrowStart,
                        lt: tomorrowEnd,
                    },
                },
            },
            select: {
                id: true,
            },
        });
        let sent = 0;
        for (const request of approvedRequests) {
            try {
                await sendWorkerShiftReminderEmail(request.id);
                sent += 1;
            }
            catch (error) {
                console.error('Reminder send failed for request', request.id, error);
            }
        }
        return res.json({
            ok: true,
            reminderCount: approvedRequests.length,
            sent,
        });
    }
    catch (error) {
        console.error('POST /api/internal/jobs/send-shift-reminders error:', error);
        return res.status(500).json({ error: 'Failed to send shift reminders' });
    }
});
async function autoCompleteShifts() {
    const now = new Date();
    const shifts = await prisma.shift.findMany({
        where: {
            status: 'FILLED',
            date: {
                lt: now,
            },
        },
    });
    for (const shift of shifts) {
        await prisma.shift.update({
            where: { id: shift.id },
            data: { status: 'COMPLETED' },
        });
    }
    console.log(`Auto-completed ${shifts.length} shifts`);
}
async function autoMarkUnfilledShifts() {
    const now = new Date();
    const shifts = await prisma.shift.findMany({
        where: {
            status: 'OPEN',
            date: {
                lt: now,
            },
        },
    });
    for (const shift of shifts) {
        await prisma.shift.update({
            where: { id: shift.id },
            data: { status: 'UNFILLED' },
        });
    }
    console.log(`Auto-marked ${shifts.length} shifts as UNFILLED`);
}
setInterval(() => {
    autoCompleteShifts().catch((error) => {
        console.error('autoCompleteShifts interval error:', error);
    });
    autoMarkUnfilledShifts().catch((error) => {
        console.error('autoMarkUnfilledShifts interval error:', error);
    });
}, 10 * 60 * 1000);
async function sendDocumentExpirationAlerts() {
    const now = new Date();
    const alertDays = [30, 14, 7];
    const windows = alertDays.map((days) => {
        const start = new Date(now);
        start.setDate(start.getDate() + days);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        return { days, start, end };
    });
    let checked = 0;
    let sent = 0;
    for (const window of windows) {
        const expiringDocs = await prisma.professionalDocument.findMany({
            where: {
                expiresAt: {
                    gte: window.start,
                    lt: window.end,
                },
                status: {
                    in: ['PENDING', 'APPROVED'],
                },
            },
            include: {
                professional: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: [{ expiresAt: 'asc' }],
        });
        checked += expiringDocs.length;
        for (const doc of expiringDocs) {
            if (!doc.expiresAt)
                continue;
            const workerEmail = doc.professional.user.email;
            const workerName = `${doc.professional.user.firstName || ''} ${doc.professional.user.lastName || ''}`.trim() ||
                workerEmail ||
                'Professional';
            const recipients = [workerEmail, ADMIN_ALERT_EMAIL].filter(Boolean).join(',');
            if (!recipients)
                continue;
            try {
                await sendEmail({
                    to: recipients,
                    subject: `Document expires in ${window.days} days: ${doc.category}`,
                    html: `
            <h2>Document expiration alert</h2>
            <p><strong>Alert:</strong> ${window.days} days before expiration</p>
            <p><strong>Professional:</strong> ${workerName}</p>
            <p><strong>Email:</strong> ${workerEmail || 'Not available'}</p>
            <p><strong>Document:</strong> ${doc.name}</p>
            <p><strong>Category:</strong> ${doc.category}</p>
            <p><strong>Status:</strong> ${doc.status}</p>
            <p><strong>Expiration Date:</strong> ${doc.expiresAt.toLocaleDateString()}</p>
            <p>Please upload and review an updated document before expiration.</p>
          `,
                    text: [
                        'Document expiration alert',
                        `Alert: ${window.days} days before expiration`,
                        `Professional: ${workerName}`,
                        `Email: ${workerEmail || 'Not available'}`,
                        `Document: ${doc.name}`,
                        `Category: ${doc.category}`,
                        `Status: ${doc.status}`,
                        `Expiration Date: ${doc.expiresAt.toLocaleDateString()}`,
                        'Please upload and review an updated document before expiration.',
                    ].join('\n'),
                });
                sent += 1;
            }
            catch (error) {
                console.error('Document expiration email failed:', {
                    documentId: doc.id,
                    professionalId: doc.professionalId,
                    alertDays: window.days,
                    error,
                });
            }
        }
    }
    return {
        checked,
        sent,
        alertDays,
    };
}
app.post('/api/internal/jobs/send-document-expiration-alerts', async (req, res) => {
    try {
        const authHeader = String(req.headers.authorization || '');
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
        if (!process.env.REMINDER_JOB_TOKEN || token !== process.env.REMINDER_JOB_TOKEN) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const result = await sendDocumentExpirationAlerts();
        return res.json({
            ok: true,
            ...result,
        });
    }
    catch (error) {
        console.error('POST /api/internal/jobs/send-document-expiration-alerts error:', error);
        return res.status(500).json({ error: 'Failed to send document expiration alerts' });
    }
});
app.listen(port, () => {
    console.log(`staffing-api listening on http://localhost:${port}`);
});
