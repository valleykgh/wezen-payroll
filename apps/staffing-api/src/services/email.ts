import {
  SESClient,
  SendEmailCommand,
  SendRawEmailCommand,
} from '@aws-sdk/client-ses';

const ses = new SESClient({
  region: 'us-west-1',
});

const FROM_EMAIL =
  process.env.SES_FROM_EMAIL ||
  'Wezen Staffing <noreply@wezenstaffing.com>';

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
          Text: { Data: text || '' },
        },
      },
    });

    const response = await ses.send(command);
    console.log('SES email sent:', response);
    return response;
  } catch (err) {
    console.error('SES email error:', err);
    throw err;
  }
}

function encodeHeader(value: string) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') || value;
}

export async function sendEmailWithAttachment({
  to,
  subject,
  html,
  text,
  attachment,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachment: {
    fileName: string;
    contentType: string;
    buffer: Buffer;
  };
}) {
  const boundary = `wezen-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;

  const alternativeBoundary = `${boundary}-alt`;

  const raw = [
    `From: ${FROM_EMAIL}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodeHeader(subject)}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    text || '',
    '',
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${alternativeBoundary}--`,
    '',
    `--${boundary}`,
    `Content-Type: ${attachment.contentType}; name="${attachment.fileName}"`,
    `Content-Disposition: attachment; filename="${attachment.fileName}"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrapBase64(attachment.buffer.toString('base64')),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');

  try {
    const response = await ses.send(
      new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(raw),
        },
      })
    );

    console.log('SES attachment email sent:', response);
    return response;
  } catch (err) {
    console.error('SES attachment email error:', err);
    throw err;
  }
}
