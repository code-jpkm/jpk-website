import { connectDB } from '@/lib/db';
import { json } from '@/lib/http';
import { HttpError } from '@/lib/errors';
import { preflight, originAllowed } from '@/lib/cors';
import { text, line, email, bool, isObjectId } from '@/lib/validate';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { publicRoute } from '@/lib/publicApi';
import { publicOrigin } from '@/lib/present';
import { storeResume, gridDelete, RESUME_BUCKET, MAX_RESUME } from '@/lib/storage';
import { notifyApplication } from '@/lib/notify';
import { Application } from '@/models/Application';
import { Job } from '@/models/Job';

export const dynamic = 'force-dynamic';

// POST /api/public/applications (multipart form from the Careers page, with the CV in "resume").
export const POST = publicRoute(async req => {
  if (!originAllowed(req)) throw new HttpError(403, 'Applications from this website are not accepted.');
  const ip = clientIp(req);
  const rl = rateLimit(`application:${ip}`, { limit: 6, windowMs: 30 * 60 * 1000 });
  if (!rl.ok) throw new HttpError(429, 'Too many applications were sent from your connection. Please try again later.', { retryAfter: rl.retryAfter });
  const size = Number(req.headers.get('content-length') || 0);
  if (size > MAX_RESUME + 1024 * 1024) throw new HttpError(413, 'Your CV is larger than 5 MB. Please attach a smaller file.');

  let form;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, 'The application form could not be read. Please try again.');
  }
  const get = k => (typeof form.get(k) === 'string' ? form.get(k) : '');
  if (get('company_website')) return json({ ok: true }, { status: 201 }); // spam trap

  const data = {
    name: line(get('name'), { max: 120, required: true, label: 'Full name' }),
    email: email(get('email')),
    phone: line(get('phone'), { max: 40, label: 'Phone' }),
    location: line(get('location'), { max: 120, label: 'Location' }),
    experience: line(get('experience'), { max: 60, label: 'Experience' }),
    currentCompany: line(get('currentCompany'), { max: 160, label: 'Current company' }),
    linkedin: line(get('linkedin'), { max: 300, label: 'LinkedIn profile' }),
    coverLetter: text(get('coverLetter'), { max: 6000, label: 'Cover letter' }),
    consent: bool(get('consent')),
  };
  if (!data.consent) throw new HttpError(400, 'Please agree to JPK Metallics keeping your details for recruitment.');
  if (data.linkedin && !/^https?:\/\//i.test(data.linkedin)) data.linkedin = `https://${data.linkedin}`;

  const file = form.get('resume');
  if (!file || typeof file === 'string' || !file.size) throw new HttpError(400, 'Please attach your CV (PDF or Word, up to 5 MB).');
  if (file.size > MAX_RESUME) throw new HttpError(413, 'Your CV is larger than 5 MB. Please attach a smaller file.');

  await connectDB();
  // the job is looked up so the title cannot be changed by the sender
  let job = null;
  const jobId = get('jobId');
  if (isObjectId(jobId)) job = await Job.findById(jobId).select('title').lean();
  const jobTitle = job ? job.title : line(get('jobTitle'), { max: 160 }) || 'General application';

  const buffer = Buffer.from(await file.arrayBuffer());
  const resume = await storeResume(buffer, file.name || 'cv.pdf');
  let doc;
  try {
    doc = await Application.create({ ...data, job: job ? job._id : null, jobTitle, resume, ip, userAgent: String(req.headers.get('user-agent') || '').slice(0, 300) });
  } catch (err) {
    await gridDelete(RESUME_BUCKET, resume.fileId).catch(() => {});
    throw err;
  }
  notifyApplication(doc, publicOrigin(req), { filename: resume.filename, buffer, mimeType: resume.mimeType });
  return json({ ok: true, id: String(doc._id) }, { status: 201 });
}, { methods: 'POST, OPTIONS' });

export function OPTIONS(req) {
  return preflight(req, 'POST, OPTIONS');
}
