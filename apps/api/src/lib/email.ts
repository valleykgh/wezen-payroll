import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const region = process.env.AWS_REGION || "us-west-1";
const fromEmail = process.env.SES_FROM_EMAIL || "";

const ses = new SESv2Client({ region });

export async function sendEmployeeInviteEmail(args: {
  to: string;
  employeeName: string;
  inviteUrl: string;
}) {
  if (!fromEmail) {
    throw new Error("SES_FROM_EMAIL is not configured");
  }

  const subject = "Set up your Wezen Payroll account";

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin-bottom: 12px;">Welcome to Wezen Payroll</h2>
      <p>Hello ${escapeHtml(args.employeeName || "there")},</p>
      <p>Your employee account has been created. Please click the button below to set your password and activate your account.</p>
      <p style="margin: 20px 0;">
        <a
          href="${args.inviteUrl}"
          style="display: inline-block; padding: 12px 18px; background: #111; color: #fff; text-decoration: none; border-radius: 8px;"
        >
          Set up your account
        </a>
      </p>
      <p>If the button does not work, copy and paste this link into your browser:</p>
      <p><a href="${args.inviteUrl}">${args.inviteUrl}</a></p>
      <p>This link will expire in 7 days.</p>
    </div>
  `;

  const text = [
    `Hello ${args.employeeName || "there"},`,
    "",
    "Your employee account has been created.",
    "Please open the link below to set your password and activate your account:",
    "",
    args.inviteUrl,
    "",
    "This link will expire in 7 days.",
  ].join("\n");

  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: {
        ToAddresses: [args.to],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
          },
          Body: {
            Text: {
              Data: text,
            },
            Html: {
              Data: html,
            },
          },
        },
      },
    })
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function encodeHeader(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join("\r\n") || value;
}

export async function sendPaystubEmail(args: {
  to: string;
  employeeName: string;
  year: number;
  fileName: string;
  pdf: Buffer;
}) {
  if (!fromEmail) throw new Error("SES_FROM_EMAIL is not configured");

  const boundary = `wezen-paystub-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const alternativeBoundary = `${boundary}-alternative`;
  const subject = `Your ${args.year} Wezen Staffing paystubs`;
  const safeName = escapeHtml(args.employeeName || "there");
  const text = [
    `Hello ${args.employeeName || "there"},`,
    "",
    `Attached are your ${args.year} Wezen Staffing paystubs.`,
    "",
    "This document contains private payroll information. Please keep it secure.",
  ].join("\r\n");
  const html = [
    '<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">',
    `<p>Hello ${safeName},</p>`,
    `<p>Attached are your ${args.year} Wezen Staffing paystubs.</p>`,
    '<p style="color:#475569">This document contains private payroll information. Please keep it secure.</p>',
    "</div>",
  ].join("");

  const raw = [
    `From: ${fromEmail}`,
    `To: ${args.to}`,
    `Subject: =?UTF-8?B?${encodeHeader(subject)}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
    "",
    `--${alternativeBoundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    `--${alternativeBoundary}--`,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${args.fileName}"`,
    `Content-Disposition: attachment; filename="${args.fileName}"`,
    "Content-Transfer-Encoding: base64",
    "",
    wrapBase64(args.pdf.toString("base64")),
    "",
    `--${boundary}--`,
    "",
  ].join("\r\n");

  return ses.send(
    new SendEmailCommand({
      FromEmailAddress: fromEmail,
      Destination: { ToAddresses: [args.to] },
      Content: { Raw: { Data: Buffer.from(raw) } },
    }),
  );
}
