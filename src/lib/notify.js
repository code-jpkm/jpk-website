import { sendNotification, notificationHtml } from './mail.js';

// Email alerts to the JPK team (only when email is set up; see README).

function adminBase(origin) {
  return String(process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || origin || '').replace(/\/+$/, '');
}

export function notifyEnquiry(doc, origin) {
  const link = `${adminBase(origin)}/admin/enquiries/${doc._id}`;
  const rows = [
    ['Name', doc.name], ['Email', doc.email], ['Phone', doc.phone], ['Company', doc.company], ['Country', doc.country],
    ['Product', doc.product], ['Quantity', doc.quantity],
    ['Subject', doc.subject], ['Form', doc.formName], ['Page', doc.page], ['Received', new Date(doc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
  ];
  return sendNotification({
    to: process.env.NOTIFY_EMAIL,
    replyTo: doc.email,
    subject: `New enquiry from ${doc.name}${doc.subject ? `: ${doc.subject}` : ''}`,
    text: `${rows.filter(r => r[1]).map(r => `${r[0]}: ${r[1]}`).join('\n')}\n\n${doc.message}\n\nOpen in JPK Admin: ${link}`,
    html: notificationHtml({ heading: 'New website enquiry', rows, message: doc.message, link, linkLabel: 'Open the enquiry' }),
  });
}

export function notifyApplication(doc, origin, cv) {
  const link = `${adminBase(origin)}/admin/applications/${doc._id}`;
  const rows = [
    ['Position', doc.jobTitle], ['Name', doc.name], ['Email', doc.email], ['Phone', doc.phone], ['Location', doc.location],
    ['Experience', doc.experience], ['Current company', doc.currentCompany], ['LinkedIn', doc.linkedin],
    ['Received', new Date(doc.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })],
  ];
  return sendNotification({
    to: process.env.CAREERS_NOTIFY_EMAIL || process.env.NOTIFY_EMAIL,
    replyTo: doc.email,
    subject: `New job application: ${doc.jobTitle} – ${doc.name}`,
    text: `${rows.filter(r => r[1]).map(r => `${r[0]}: ${r[1]}`).join('\n')}\n\n${doc.coverLetter || ''}\n\nOpen in JPK Admin: ${link}`,
    html: notificationHtml({ heading: `New application: ${doc.jobTitle}`, rows, message: doc.coverLetter, link, linkLabel: 'Open the application' }),
    attachments: cv ? [{ filename: cv.filename, content: cv.buffer, contentType: cv.mimeType }] : undefined,
  });
}
