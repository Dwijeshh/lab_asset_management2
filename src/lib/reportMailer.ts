import nodemailer from 'nodemailer';

export function createMailer() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_FROM) throw new Error('SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured');
  const port = Number(SMTP_PORT);
  if (!Number.isInteger(port) || port <= 0) throw new Error('SMTP_PORT must be a positive port number');
  const transporter = nodemailer.createTransport({ host: SMTP_HOST, port, secure: process.env.SMTP_SECURE === 'true', auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS || '' } : undefined });
  return { transporter, from: SMTP_FROM };
}

export async function sendReportEmail(params: { to: string; name: string; period: string; summary: string; buffer: Buffer; test?: boolean }) {
  const { transporter, from } = createMailer();
  await transporter.sendMail({
    from, to: params.to,
    subject: `${params.test ? '[Test] ' : ''}Lab asset report — ${params.period}`,
    text: `Hello ${params.name},\n\n${params.summary}\n\nThe Excel workbook is attached.`,
    attachments: [{ filename: `monthly-assets-${params.period}.xlsx`, content: params.buffer, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
  });
}
