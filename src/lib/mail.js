import nodemailer from 'nodemailer';

// Optional email alerts for new enquiries and job applications.
// Either SMTP (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) or Resend (RESEND_API_KEY) is used.

let transport = null;

export function mailEnabled() {
  return Boolean(process.env.RESEND_API_KEY || process.env.SMTP_HOST);
}

function fromAddress() {
  return process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER || 'JPK Admin <no-reply@jpkm.in>';
}

function smtp() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 587);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '' } : undefined,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
    });
  }
  return transport;
}

async function sendWithResend({ to, subject, text, html, replyTo, attachments }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromAddress(),
      to: to.split(',').map(s => s.trim()).filter(Boolean),
      subject, text, html,
      reply_to: replyTo || undefined,
      attachments: (attachments || []).map(a => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64') })),
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Sends in the background; never throws (a failed email must not lose the enquiry).
export async function sendNotification({ to, subject, text, html, replyTo, attachments }) {
  const recipients = to || process.env.NOTIFY_EMAIL;
  if (!mailEnabled() || !recipients) return false;
  try {
    if (process.env.RESEND_API_KEY) await sendWithResend({ to: recipients, subject, text, html, replyTo, attachments });
    else await smtp().sendMail({ from: fromAddress(), to: recipients, subject, text, html, replyTo, attachments });
    return true;
  } catch (err) {
    console.error('[jpk-admin] email could not be sent:', err && err.message);
    return false;
  }
}

export function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A simple branded email with a table of fields and a button to open the item in the admin.
export function notificationHtml({ heading, rows, message, link, linkLabel }) {
  const tr = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="padding:6px 12px 6px 0;color:#5b6b78;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;color:#203444">${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#203444;max-width:640px">
<div style="border-top:4px solid #F5831E;padding:16px 0 4px"><strong style="font-size:18px">${escapeHtml(heading)}</strong></div>
<table style="border-collapse:collapse;margin:8px 0 12px">${tr}</table>
${message ? `<div style="white-space:pre-wrap;background:#F3F5F6;padding:12px 14px;border-radius:6px">${escapeHtml(message)}</div>` : ''}
${link ? `<p style="margin:18px 0"><a href="${escapeHtml(link)}" style="background:#203444;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;display:inline-block">${escapeHtml(linkLabel || 'Open in JPK Admin')}</a></p>` : ''}
<p style="color:#8a97a3;font-size:12px">JPK Metallics admin · this message was sent automatically.</p></div>`;
}
