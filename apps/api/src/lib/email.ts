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

