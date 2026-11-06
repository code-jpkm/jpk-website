# JPK Admin

The admin software for **jpkm.in**: a website editor (every text, picture, link and section of every page, new pages, the menu, colours and fonts), JPK Updates (blog), products and product photos, job openings, job applications with CVs, website enquiries, and users with per-section rights.

- Next.js 16, JavaScript only (no TypeScript), MongoDB (Mongoose), Cloudinary for pictures
- Address: **https://jpk-webupdation.onrender.com** (Render)
- The website (React + Vite) reads from it through the public API described at the end

## First sign-in

| | |
|---|---|
| Address | https://jpk-webupdation.onrender.com/login |
| Email | `sales@jpkm.in` |
| Password | `admin@123` |

This administrator is created automatically the first time the server starts with an empty database. **Change the password right after signing in** (top right → *My account & password*). The dashboard shows a warning until you do.

On the same first start the admin also adds:
- the product categories of jpkm.in (Sanitary Components › Ductile Iron › Solid Top, …, Engineering Casting, Pipe Fitting, Agricultural Components)
- the 6 JPK Updates posts that were on WordPress, so you can edit or delete them here

Nothing is ever added twice, and nothing you change is overwritten.

## Put it on Render (step by step)

### 1. MongoDB Atlas (database, free)
1. Sign in at https://cloud.mongodb.com → **Create** a free **M0** cluster (region: Mumbai or Singapore).
2. **Database Access** → add a database user with a password (letters and numbers are easiest).
3. **Network Access** → **Add IP Address** → **Allow access from anywhere** (`0.0.0.0/0`). Render's free plan has no fixed address, so this is needed.
4. **Connect** → **Drivers** → copy the connection string and put your password in it. Add a database name before the `?`, for example:
   `mongodb+srv://jpk:YOURPASSWORD@cluster0.abcde.mongodb.net/jpk?retryWrites=true&w=majority`

### 2. Cloudinary (pictures, free)
1. Sign in at https://console.cloudinary.com.
2. **Dashboard**: copy the **Cloud name** (at the top of the page) → `CLOUDINARY_CLOUD_NAME`.
3. **Go to API Keys** (or **Settings → API Keys**): copy the **API Key** → `CLOUDINARY_API_KEY` and the **API Secret** → `CLOUDINARY_API_SECRET`. Click the eye icon to see the secret; Cloudinary may ask for your password.

Instead of the three values you can give Cloudinary's **API environment variable** in one setting, `CLOUDINARY_URL`, with your real key and secret in place of `<your_api_key>` and `<your_api_secret>`. When both are given, the three values are used.

Without Cloudinary the admin still works: pictures are then kept in MongoDB and served from `/api/files/…`. Cloudinary is faster and resizes pictures automatically, so it is recommended. If the Cloudinary settings are filled in but wrong or incomplete, the admin doesn't fall back to MongoDB: it refuses pictures and says what to fix (on the dashboard, in `npm run seed` and in the server log).

### 3. Render
Put this folder in a (private) GitHub repository, then either:

**A. Blueprint (easiest):** Render → **New** → **Blueprint** → choose the repository. Render reads `render.yaml`, asks for `MONGODB_URI`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, and creates a random `JWT_SECRET`.

**B. By hand:** Render → **New** → **Web Service** → choose the repository, then:

| Setting | Value |
|---|---|
| Name | `jpk-webupdation` (gives the address above) |
| Runtime | Node |
| Build command | `npm ci && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |

and under **Environment** add at least `MONGODB_URI`, `JWT_SECRET` (any long random text), `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.

### 4. Check
Open https://jpk-webupdation.onrender.com/api/health. It should show `"db":"connected"` and `"storage":"cloudinary"`. Then sign in. (`"storage":"cloudinary-settings-problem"` means a Cloudinary value is missing or still an example; the dashboard says which.)

## Settings (environment variables)

| Name | Needed | What it is |
|---|---|---|
| `MONGODB_URI` | **yes** | MongoDB connection string |
| `JWT_SECRET` | **yes** (production) | Long random text that protects sign-ins. Changing it signs everyone out |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | recommended | Cloudinary cloud name, API key and API secret (see step 2) |
| `CLOUDINARY_URL` | no | The same three in one line, `cloudinary://<API key>:<API secret>@<cloud name>`, instead of the three settings |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | no | First administrator (default `sales@jpkm.in` / `admin@123`) |
| `WEBSITE_URL` | no | The public website, default `https://jpkm.in`. The website editor shows this site in its preview and reads its list of pages from it |
| `SITE_REBUILD_HOOK_URL` | no | Deploy hook of the website host; see *Connect the website* |
| `ALLOWED_ORIGINS` | no | Websites allowed to send forms, e.g. `https://jpkm.in,https://www.jpkm.in`. Default: any |
| `RESEND_API_KEY`, `MAIL_FROM`, `NOTIFY_EMAIL`, `CAREERS_NOTIFY_EMAIL` | no | Email alerts (see below) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | no | Email alerts by SMTP instead of Resend |
| `MONGODB_DB` | no | Database name when the connection string has none (default `jpk_admin`) |

## Email alerts (optional)
New enquiries and applications always appear in the admin. To also get an email:

- **Resend** (works on Render's free plan): create a free account at https://resend.com, verify the domain `jpkm.in`, create an API key and set `RESEND_API_KEY`, `MAIL_FROM` (for example `JPK Website <alerts@jpkm.in>`) and `NOTIFY_EMAIL` (who receives enquiries). `CAREERS_NOTIFY_EMAIL` receives job applications (defaults to `NOTIFY_EMAIL`); the CV is attached.
- **SMTP**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `NOTIFY_EMAIL`. Render's **free** plan blocks SMTP ports, so this only works on a paid Render instance or another host.

## Website editor
**Website → Pages & sections** lists every page of jpkm.in. Open one and the page appears on the right, live:

- **Click anything on the page** (a heading, a text, a button, a picture, a number, a slider) and its box opens on the left. Type, and the page changes as you type. **Save** (or Ctrl+S) puts it live on the website; until then nobody else sees it. *Undo* on a box brings back the original, *Undo unsaved changes* throws away everything not yet saved.
- **Pictures:** *Replace…* opens the picture library: upload a new picture or pick one uploaded before. Section backgrounds and banners are pictures too. The original pictures stay on the website and come back with *Use the original picture*.
- **Sections:** move them up and down, hide them (the eye) and **add sections** between them: page banner, heading and text, text with a picture, cards, product grid, products from the *Products* list, picture gallery, numbers that count up, questions and answers, call to action, latest JPK Updates, job openings, enquiry form, video, logos, map, space or line, custom HTML. Added sections can be duplicated and deleted.
- **Page settings:** Google title and description, and switching a page off.
- **Find a text on this page** finds any wording on the page.
- **History:** every save keeps the version before it (the last 30), and *Bring back* restores one.
- **Add a page** makes a new page from sections, at an address you choose (for example `/quality-policy/`). It stays a draft until *Published* is ticked in its Page settings; add it to the menu under *Menu*.
- **Header & footer** (same on every page), **Menu** (rename, re-link, reorder, sub-menus up to three levels, hide, add pages) and **Design** (the brand colours, the heading and text fonts, extra CSS) work the same way, with the website beside them.
- *Computer / Tablet / Phone* above the preview shows the page at that screen size.

Who may do what: *Users & access* → **Website editor**: *View* (look only), *Edit* (change and save pages, header/footer, menu, design), *Create* (add pages), *Delete* (delete added pages).

How it reaches the website: the website asks `GET /api/public/site` on every page load and shows the saved changes, so they are live at once. Its pre-built pages (what Google reads first) get them at the next website build: set `SITE_REBUILD_HOOK_URL` (see *Connect the website*) and the admin starts a build about a minute after each save. The editor's preview needs the website version that has the editor (any build from November 2026 on); with an older website the editor can still save, and the preview says it cannot connect.

The list of what can be changed comes from the website (`WEBSITE_URL/site-schema.json`, written by every website build); `seed-data/site-schema.json` is the copy used when the website cannot be reached.

## Connect the website
The website already uses this admin (`VITE_API_URL`, default `https://jpk-webupdation.onrender.com`):

- **Enquiry / Contact forms** → *Enquiries*
- **Careers page** → shows published job openings; applications and CVs → *Applications*
- **JPK Updates** → posts published here appear on the website at once. When the website is built (`npm run build`), it downloads all posts so each post gets its own page for Google.

For Google to see a new post immediately as a normal page, let the admin rebuild the website after changes:
1. In the website host create a **deploy hook** (Vercel: Project → Settings → Git → Deploy Hooks; Netlify: Site configuration → Build hooks; Render static site: Settings → Deploy Hook).
2. Put the hook address into `SITE_REBUILD_HOOK_URL` here. One minute after posts or jobs change, the admin asks the host to rebuild.

Products and categories are available through the API (`/api/public/products`, `/api/public/categories`). To show the products of a category on a page, add the section *Products from the product list* in the website editor: products added or changed under *Products* then appear there by themselves.

### Render free plan: sleeping
A free Render service sleeps after 15 minutes without visitors; the first visit afterwards takes up to about a minute. The website keeps working meanwhile (it shows its built-in posts and waits for job openings). To avoid the wait, either use Render's **Starter** instance, or have a free monitor (for example cron-job.org or UptimeRobot) open `https://jpk-webupdation.onrender.com/api/health` every 10 minutes.

## Users and access
*Users & access* (administrators only):
- **Administrator**: everything, including users.
- **Staff**: only the ticked rights per section: JPK Updates, Products (with categories), Job openings and the Website editor: view / create / edit / delete; Job applications and Enquiries: view / update (status, notes) / delete.

Rights apply immediately. Switching an account off or setting a new password signs that person out everywhere. There is always at least one active administrator, and nobody can remove their own administrator access.

## Pictures
- Upload by clicking or dragging. Very large photos (over about 9.5 MB or 5000 px) are resized automatically; up to 25 MB can be uploaded.
- JPG, PNG, WebP, GIF and AVIF. iPhone HEIC photos: export as JPG first. SVG is not accepted (safety).
- The website gets sharp, automatically sized versions from Cloudinary (`f_auto,q_auto`, several widths).
- Every upload is also in the **picture library** of the website editor, to be used again anywhere on the website.
- Pictures that are no longer used by any post, product, category, job or the website editor are deleted from storage. Pictures uploaded in the website editor stay in its library until they are deleted there (the library refuses while a page still uses them).

## On your computer
```bash
npm install
cp .env.example .env.local     # then fill in MONGODB_URI (and the rest you need)
npm run dev                    # http://localhost:3000
```
`npm run seed` creates the first admin and the starter content in the database from `.env.local` or `.env` (the server also does this by itself). It first says where pictures will go (Cloudinary or MongoDB), and stops before changing anything if the Cloudinary settings are incomplete. It is safe to run again: it finishes what is missing and never adds anything twice.

**Forgot the administrator password?** With `MONGODB_URI` in `.env.local`, run `npm run seed:reset-password`. It puts the seed account (`sales@jpkm.in`) back to the seed password and makes it an active administrator.

## Public API (used by the website)
All answers are JSON; reading is open to any website (CORS `*`).

| Method and address | What |
|---|---|
| `GET /api/public/blogs?limit=60&page=1&q=&fields=summary` | Published posts, newest first (`items`, `total`, `pages`, `imported`) |
| `GET /api/public/blogs/<slug>` | One post |
| `GET /api/public/jobs` | Open job openings (published and not past the closing date) |
| `GET /api/public/jobs/<slug>` | One job |
| `GET /api/public/products?category=<slug>&featured=1&q=` | Published products; a category includes its sub-categories |
| `GET /api/public/products/<slug>` | One product with photos, specifications, size table |
| `GET /api/public/categories` | Product categories in menu order with product counts |
| `GET /api/public/site` | The website editor's saved changes: `pages`, `global` (header/footer), `custom` (published new pages), `menus`, `settings` (design), `version` |
| `POST /api/public/enquiries` | JSON `{ name, email, subject, message, phone?, company?, formId, page }` |
| `POST /api/public/applications` | Form data: `name, email, phone, location, experience, currentCompany, linkedin, coverLetter, consent, jobId, jobTitle, resume` (PDF/DOC/DOCX/RTF up to 5 MB) |
| `GET /api/health` | Server, database and storage status |

Forms are protected by a hidden spam-trap field and a limit per visitor (8 enquiries per 10 minutes, 6 applications per 30 minutes).

## Security notes
- Passwords are stored as bcrypt hashes; sign-in sessions are signed cookies (HTTP-only, 7 days).
- Every request checks the user in the database, so switched-off users and changed rights take effect at once.
- Changes are only accepted from the admin's own pages (cross-site requests are refused). Sign-in attempts are limited.
- Text from the editor is cleaned before saving (no scripts or unsafe links).
- CVs are stored privately in the database and can only be downloaded by signed-in users with access to applications.
