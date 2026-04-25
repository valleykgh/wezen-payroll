import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: "us-west-1",
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'Wezen Staffing <noreply@wezenstaffing.com>';

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  try {
    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: html },
          Text: { Data: text || "" },
        },
      },
    });

    const response = await ses.send(command);
    console.log("SES email sent:", response);
    return response;
  } catch (err) {
    console.error("SES email error:", err);
    throw err;
  }
}
