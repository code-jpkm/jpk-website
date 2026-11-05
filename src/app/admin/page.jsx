import Link from 'next/link';
import { requirePageUser } from '@/lib/auth';
import { connectDB } from '@/lib/db';
import { can } from '@/lib/permissions';
import { cloudinaryEnabled, cloudinaryProblem } from '@/lib/cloudinarySettings';
import { mailEnabled } from '@/lib/mail';
import { openJobsFilter } from '@/lib/publicApi';
import { formatDate } from '@/lib/format';
import { Badge, Card, Notice, Icon } from '@/components/ui';
import { Blog } from '@/models/Blog';
import { Product } from '@/models/Product';
import { Job } from '@/models/Job';
import { Application } from '@/models/Application';
import { Enquiry } from '@/models/Enquiry';

export const metadata = { title: 'Dashboard' };

function greeting() {
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Dashboard() {
  const { user } = await requirePageUser();
  await connectDB();
  const see = m => can(user, m, 'view');
  const zero = Promise.resolve(0);
  const none = Promise.resolve([]);
  const [posts, drafts, products, productsLive, jobs, appsNew, appsAll, enqNew, enqAll, recentApps, recentEnq] = await Promise.all([
    see('blogs') ? Blog.countDocuments({ status: 'published' }) : zero,
    see('blogs') ? Blog.countDocuments({ status: 'draft' }) : zero,
    see('products') ? Product.countDocuments({}) : zero,
    see('products') ? Product.countDocuments({ status: 'published' }) : zero,
    see('jobs') ? Job.countDocuments(openJobsFilter()) : zero,
    see('applications') ? Application.countDocuments({ status: 'new' }) : zero,
    see('applications') ? Application.countDocuments({}) : zero,
    see('enquiries') ? Enquiry.countDocuments({ status: 'new' }) : zero,
    see('enquiries') ? Enquiry.countDocuments({}) : zero,
    see('applications') ? Application.find({}).select('name jobTitle status createdAt').sort({ createdAt: -1 }).limit(5).lean() : none,
    see('enquiries') ? Enquiry.find({}).select('name subject message status createdAt formName').sort({ createdAt: -1 }).limit(5).lean() : none,
  ]);
  const firstName = user.name.split(/\s+/)[0];
  const usingSeedPassword = user.isSeed && !user.passwordChangedAt;
  const isAdmin = user.role === 'admin';

  return (
    <>
      <section className="welcome">
        <div>
          <h1>{greeting()}, {firstName}</h1>
          <p>Here is what is happening on jpkm.in today.</p>
        </div>
        <div className="actions-row">
          {can(user, 'blogs', 'create') ? <Link href="/admin/blogs/new" className="btn btn--accent"><Icon name="plus" size={16} />New post</Link> : null}
          {can(user, 'products', 'create') ? <Link href="/admin/products/new" className="btn btn--ghost"><Icon name="plus" size={16} />New product</Link> : null}
          {can(user, 'jobs', 'create') ? <Link href="/admin/jobs/new" className="btn btn--ghost"><Icon name="plus" size={16} />New job</Link> : null}
        </div>
      </section>

      {usingSeedPassword ? (
        <Notice tone="warn" title="You are still using the starting password." action={<Link href="/admin/account" className="btn btn--primary btn--sm">Change password</Link>}>
          For safety, choose your own password now. Everyone who knows the starting password could sign in.
        </Notice>
      ) : null}
      {isAdmin && cloudinaryProblem() ? (
        <Notice tone="warn" title="The Cloudinary settings need fixing.">
          {cloudinaryProblem()} Pictures can&apos;t be uploaded until then. Change the server settings (on Render: the service&apos;s Environment tab) and restart.
        </Notice>
      ) : isAdmin && !cloudinaryEnabled() ? (
        <Notice tone="info" title="Pictures are being saved in the database.">
          Cloudinary is not set up yet, so uploads are stored in MongoDB. Add <strong>CLOUDINARY_CLOUD_NAME</strong>, <strong>CLOUDINARY_API_KEY</strong> and <strong>CLOUDINARY_API_SECRET</strong> in the server settings to store pictures on Cloudinary (faster, resized automatically).
        </Notice>
      ) : null}
      {isAdmin && !mailEnabled() ? (
        <Notice tone="info" title="Email alerts are off.">
          New enquiries and applications appear here, but nobody is emailed. See the README to switch on email alerts (Resend or SMTP).
        </Notice>
      ) : null}

      <div className="stats">
        {see('blogs') ? <Link href="/admin/blogs" className="stat"><span className="stat__label">JPK Updates</span><span className="stat__value">{posts}</span><span className="stat__note">published{drafts ? ` · ${drafts} draft${drafts === 1 ? '' : 's'}` : ''}</span></Link> : null}
        {see('products') ? <Link href="/admin/products" className="stat"><span className="stat__label">Products</span><span className="stat__value">{productsLive}</span><span className="stat__note">published · {products} in total</span></Link> : null}
        {see('jobs') ? <Link href="/admin/jobs" className="stat"><span className="stat__label">Open jobs</span><span className="stat__value">{jobs}</span><span className="stat__note">shown on the Careers page</span></Link> : null}
        {see('applications') ? <Link href="/admin/applications?status=new" className="stat"><span className="stat__label">Applications</span><span className="stat__value">{appsAll}</span><span className="stat__note">{appsNew ? <><strong>{appsNew} new</strong> to review</> : 'none waiting'}</span></Link> : null}
        {see('enquiries') ? <Link href="/admin/enquiries?status=new" className="stat"><span className="stat__label">Enquiries</span><span className="stat__value">{enqAll}</span><span className="stat__note">{enqNew ? <><strong>{enqNew} new</strong> to answer</> : 'none waiting'}</span></Link> : null}
      </div>

      <div className="grid-2">
        {see('enquiries') ? (
          <Card title="Latest enquiries" actions={<Link href="/admin/enquiries" className="btn btn--ghost btn--sm">See all</Link>} pad={false}>
            {recentEnq.length ? (
              <ul className="mini-list">
                {recentEnq.map(e => (
                  <li key={String(e._id)}>
                    <div className="mini-list__main">
                      <Link href={`/admin/enquiries/${e._id}`} className="mini-list__title">{e.name}{e.subject ? ` – ${e.subject}` : ''}</Link>
                      <span className="mini-list__sub">{formatDate(e.createdAt, true)} · {e.formName || 'Website form'}</span>
                    </div>
                    <Badge status={e.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="list-state">No enquiries yet. Messages from the website forms will appear here.</p>}
          </Card>
        ) : null}
        {see('applications') ? (
          <Card title="Latest job applications" actions={<Link href="/admin/applications" className="btn btn--ghost btn--sm">See all</Link>} pad={false}>
            {recentApps.length ? (
              <ul className="mini-list">
                {recentApps.map(a => (
                  <li key={String(a._id)}>
                    <div className="mini-list__main">
                      <Link href={`/admin/applications/${a._id}`} className="mini-list__title">{a.name}</Link>
                      <span className="mini-list__sub">{a.jobTitle} · {formatDate(a.createdAt, true)}</span>
                    </div>
                    <Badge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="list-state">No applications yet. CVs sent from the Careers page will appear here.</p>}
          </Card>
        ) : null}
      </div>
    </>
  );
}
