import { connectDB } from '@/lib/db';
import { json, readJson } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { preflight, originAllowed } from '@/lib/cors';
import { text, line, email } from '@/lib/validate';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { publicRoute } from '@/lib/publicApi';
import { publicOrigin } from '@/lib/present';
import { notifyEnquiry } from '@/lib/notify';
import { Enquiry } from '@/models/Enquiry';

export const dynamic = 'force-dynamic';

// Website forms: 187 = enquiry form on product and JPK Updates pages, 588 = Contact Us page.
const FORM_NAMES = { 187: 'Product enquiry', 588: 'Contact us' };

async function readBody(req) {
  const type = req.headers.get('content-type') || '';
  if (type.includes('application/json')) return readJson(req, { maxBytes: 100_000 });
  if (type.includes('form')) {
    try {
      return Object.fromEntries(await req.formData());
    } catch {
      throw new HttpError(400, 'The form could not be read.');
    }
  }
  return readJson(req, { maxBytes: 100_000 });
}

// POST /api/public/enquiries  { name, email, message, subject?, phone?, company?, country?, product?, quantity?, formId, page }
export const POST = publicRoute(async req => {
  if (!originAllowed(req)) throw new HttpError(403, 'Forms from this website are not accepted.');
  const ip = clientIp(req);
  const rl = rateLimit(`enquiry:${ip}`, { limit: 8, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) throw new HttpError(429, 'Too many messages were sent from your connection. Please try again a little later.', { retryAfter: rl.retryAfter });
  const body = await readBody(req);
  // spam trap: a hidden field that people never fill in
  if (body.company_website) return json({ ok: true }, { status: 201 });
  const formId = line(body.formId, { max: 40 });
  const data = {
    name: line(body.name, { max: 120, required: true, label: 'Name' }),
    email: email(body.email),
    phone: line(body.phone, { max: 40, label: 'Phone' }),
    company: line(body.company, { max: 160, label: 'Company' }),
    country: line(body.country, { max: 80, label: 'Country' }),
    product: line(body.product, { max: 120, label: 'Product' }),
    quantity: line(body.quantity, { max: 120, label: 'Quantity' }),
    subject: line(body.subject, { max: 250, label: 'Subject' }),
    message: text(body.message, { max: 10000, required: true, label: 'Message' }),
    formId,
    formName: FORM_NAMES[formId] || (formId ? `Website form ${formId}` : 'Website form'),
    page: line(body.page, { max: 300 }),
    ip,
    userAgent: String(req.headers.get('user-agent') || '').slice(0, 300),
  };
  // the product enquiry form has no subject: the product (and quantity) say what it is about
  if (!data.subject && data.product) data.subject = `${data.product}${data.quantity ? ` – ${data.quantity}` : ''}`.slice(0, 250);
  await connectDB();
  const doc = await Enquiry.create(data);
  notifyEnquiry(doc, publicOrigin(req));
  return json({ ok: true, id: String(doc._id) }, { status: 201 });
}, { methods: 'POST, OPTIONS' });

export function OPTIONS(req) {
  return preflight(req, 'POST, OPTIONS');
}
