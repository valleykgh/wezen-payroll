import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const ICA_TEMPLATE_VERSION = '2026-08-native-v1';
export const ICA_CONSENT_TEXT =
  'I have reviewed the Independent Contractor Agreement and compensation summary, consent to use electronic records and signatures, and agree that my electronic signature is legally binding.';

export type IcaSnapshot = {
  agreementId: string;
  role: 'CNA' | 'LVN' | 'RN';
  workerName: string;
  workerEmail: string;
  address: string;
  regularPayRateCents: number;
  overtimePayRateCents: number;
  doublePayRateCents: number;
  sentAt: Date;
};

const here = path.dirname(fileURLToPath(import.meta.url));

function templatePath(role: IcaSnapshot['role']) {
  const fileName = `${role.toLowerCase()}-ica.pdf`;
  const candidates = [
    path.resolve(process.cwd(), 'assets/agreements', fileName),
    path.resolve(process.cwd(), '../staffing-web/public/agreements', fileName),
    path.resolve(here, '../../../staffing-web/public/agreements', fileName),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error(`ICA template is unavailable for ${role}`);
  return found;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}/hour`;
export const sha256 = (buffer: Uint8Array) => createHash('sha256').update(buffer).digest('hex');

function drawLabel(page: any, font: any, bold: any, label: string, value: string, y: number) {
  page.drawText(label, { x: 54, y, size: 10, font: bold, color: rgb(0.28, 0.34, 0.43) });
  page.drawText(value || '-', { x: 190, y, size: 11, font, color: rgb(0.06, 0.09, 0.16), maxWidth: 360 });
}

export async function createUnsignedIca(snapshot: IcaSnapshot) {
  const original = fs.readFileSync(templatePath(snapshot.role));
  const document = await PDFDocument.load(original, { ignoreEncryption: true });
  document.setTitle(`Wezen Staffing ${snapshot.role} Independent Contractor Agreement`);
  document.setAuthor('Wezen Staffing');
  document.setCreator('Wezen Staffing ICA Portal');
  document.setProducer('Wezen Staffing ICA Portal');
  document.setCreationDate(snapshot.sentAt);
  document.setModificationDate(snapshot.sentAt);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 708, width: 612, height: 84, color: rgb(0.05, 0.09, 0.17) });
  page.drawText('WEZEN STAFFING', { x: 48, y: 754, size: 12, font: bold, color: rgb(0.25, 0.82, 0.91) });
  page.drawText('PERSONALIZED ICA DETAILS', { x: 48, y: 724, size: 23, font: bold, color: rgb(1, 1, 1) });
  page.drawText('This page is part of the Independent Contractor Agreement.', { x: 48, y: 680, size: 11, font, color: rgb(0.28, 0.34, 0.43) });
  drawLabel(page, font, bold, 'Contractor', snapshot.workerName, 635);
  drawLabel(page, font, bold, 'Email', snapshot.workerEmail, 606);
  drawLabel(page, font, bold, 'Address', snapshot.address, 577);
  drawLabel(page, font, bold, 'Clinical role', snapshot.role, 548);
  drawLabel(page, font, bold, 'Regular rate', money(snapshot.regularPayRateCents), 500);
  drawLabel(page, font, bold, 'Overtime rate', money(snapshot.overtimePayRateCents), 471);
  drawLabel(page, font, bold, 'Double-time rate', money(snapshot.doublePayRateCents), 442);
  drawLabel(page, font, bold, 'Agreement ID', snapshot.agreementId, 394);
  drawLabel(page, font, bold, 'Template version', ICA_TEMPLATE_VERSION, 365);
  drawLabel(page, font, bold, 'Issued at (UTC)', snapshot.sentAt.toISOString(), 336);
  page.drawText('Electronic signature', { x: 48, y: 270, size: 16, font: bold, color: rgb(0.06, 0.09, 0.16) });
  page.drawText('After reviewing every page, the contractor signs through the authenticated Wezen portal.', {
    x: 48, y: 244, size: 10, font, color: rgb(0.28, 0.34, 0.43), maxWidth: 510,
  });
  return Buffer.from(await document.save());
}

export async function createSignedIca(params: {
  unsignedPdf: Buffer;
  snapshot: IcaSnapshot;
  signerName: string;
  signerEmail: string;
  signatureDataUrl: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
}) {
  const document = await PDFDocument.load(params.unsignedPdf);
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 708, width: 612, height: 84, color: rgb(0.05, 0.09, 0.17) });
  page.drawText('ELECTRONIC SIGNATURE CERTIFICATE', { x: 46, y: 738, size: 21, font: bold, color: rgb(1, 1, 1) });
  page.drawText(ICA_CONSENT_TEXT, { x: 48, y: 660, size: 10, lineHeight: 15, font, color: rgb(0.15, 0.19, 0.25), maxWidth: 510 });
  drawLabel(page, font, bold, 'Signer', params.signerName, 584);
  drawLabel(page, font, bold, 'Verified email', params.signerEmail, 555);
  drawLabel(page, font, bold, 'Signed at (UTC)', params.signedAt.toISOString(), 526);
  drawLabel(page, font, bold, 'Agreement ID', params.snapshot.agreementId, 497);
  drawLabel(page, font, bold, 'IP address', params.ipAddress || 'Unavailable', 468);
  page.drawText('Signature', { x: 54, y: 414, size: 10, font: bold, color: rgb(0.28, 0.34, 0.43) });
  const encoded = params.signatureDataUrl.split(',')[1];
  const image = await document.embedPng(Buffer.from(encoded, 'base64'));
  const scale = Math.min(260 / image.width, 90 / image.height, 1);
  page.drawImage(image, { x: 190, y: 356, width: image.width * scale, height: image.height * scale });
  page.drawLine({ start: { x: 190, y: 350 }, end: { x: 475, y: 350 }, thickness: 0.8, color: rgb(0.35, 0.4, 0.48) });
  page.drawText(params.signerName, { x: 190, y: 330, size: 10, font, color: rgb(0.15, 0.19, 0.25) });
  page.drawText(`Unsigned document SHA-256: ${sha256(params.unsignedPdf)}`, { x: 48, y: 245, size: 8, font, color: rgb(0.35, 0.4, 0.48), maxWidth: 510 });
  page.drawText(`Browser: ${params.userAgent || 'Unavailable'}`, { x: 48, y: 217, size: 8, font, color: rgb(0.35, 0.4, 0.48), maxWidth: 510 });
  page.drawRectangle({ x: 48, y: 92, width: 516, height: 78, color: rgb(0.94, 0.98, 0.99) });
  page.drawText('Audit note', { x: 66, y: 143, size: 11, font: bold, color: rgb(0.04, 0.45, 0.58) });
  page.drawText('The signer was authenticated to the Wezen professional portal. The server recorded the event and stored this completed PDF in private company storage.', {
    x: 66, y: 116, size: 9, lineHeight: 13, font, color: rgb(0.15, 0.19, 0.25), maxWidth: 475,
  });
  return Buffer.from(await document.save());
}
