// Cloudinary settings, read from the environment. Two ways to give them:
//
//   1. Three values from the Cloudinary console (https://console.cloudinary.com), recommended:
//        CLOUDINARY_CLOUD_NAME   Dashboard, at the top: "Cloud name"
//        CLOUDINARY_API_KEY      Settings → API Keys: "API Key"
//        CLOUDINARY_API_SECRET   Settings → API Keys: "API Secret"
//   2. All three in one line, Cloudinary's "API environment variable":
//        CLOUDINARY_URL=cloudinary://<API key>:<API secret>@<cloud name>
//
// When the three separate values are complete they are used, whatever CLOUDINARY_URL says. Example values
// (API_KEY, <your_api_key>, your-cloud-name …) count as not filled in. Nothing set at all: pictures are kept
// in MongoDB. Something set but unusable: `problem` says what to fix, and pictures are not stored until then.

const VARS = { cloud_name: 'CLOUDINARY_CLOUD_NAME', api_key: 'CLOUDINARY_API_KEY', api_secret: 'CLOUDINARY_API_SECRET' };
const WHERE = 'In the Cloudinary console the cloud name is on the Dashboard, the API key and API secret under Settings → API Keys.';

// The Cloudinary library reads CLOUDINARY_URL by itself when it loads, and stops the whole server when the value
// does not start with cloudinary://. Keep the value here and give the library only the settings chosen below.
// (globalThis: Next.js may load this module more than once.)
const env = globalThis.__jpkCloudinaryEnv || (globalThis.__jpkCloudinaryEnv = { url: process.env.CLOUDINARY_URL });
delete process.env.CLOUDINARY_URL;

function clean(value) {
  return String(value ?? '').trim().replace(/^["']+|["']+$/g, '').trim();
}

function isExample(value) {
  return (
    /^<.*>$|^\[.*\]$|^\{.*\}$/.test(value) || // <your_api_key>
    /^(?:api[_ -]?key|api[_ -]?secret|cloud[_ -]?name)$/i.test(value) || // the example line of .env.example
    /^your[_ -]/i.test(value) ||
    /\.\.\.|…/.test(value) ||
    /^x{3,}$/i.test(value)
  );
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const list = names => (names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]);

// { creds: { cloud_name, api_key, api_secret } | null, source: 'separate' | 'url' | null, problem: string | null }
export function cloudinarySettings() {
  const separate = {};
  const empty = [];
  const examples = [];
  for (const [key, name] of Object.entries(VARS)) {
    const value = clean(process.env[name]);
    if (!value) empty.push(name);
    else if (isExample(value)) examples.push(name);
    else separate[key] = value;
  }
  if (Object.keys(separate).length === 3) return { creds: separate, source: 'separate', problem: null };

  const url = clean(env.url);
  let urlProblem = null;
  if (url) {
    const m = url.match(/^cloudinary:\/\/([^:@/\s]+):([^@/\s]+)@([^/?#\s]+)\/?$/i);
    if (!m) urlProblem = 'CLOUDINARY_URL is not in the form cloudinary://<API key>:<API secret>@<cloud name>.';
    else {
      const creds = { api_key: decode(m[1]), api_secret: decode(m[2]), cloud_name: m[3] };
      if (!Object.values(creds).some(isExample)) return { creds, source: 'url', problem: null };
      urlProblem = 'CLOUDINARY_URL still has example values in it, not your own API key, API secret and cloud name.';
    }
  }

  if (Object.keys(separate).length || examples.length) {
    const todo = [...empty, ...examples].sort((a, b) => Object.values(VARS).indexOf(a) - Object.values(VARS).indexOf(b));
    const what = examples.length && !empty.length ? 'still the example value' : 'missing';
    const brackets = examples.some(name => /^<.*>$/.test(clean(process.env[name]))) ? ' Replace the whole <…>, brackets included.' : '';
    return { creds: null, source: null, problem: `Cloudinary settings incomplete: ${list(todo)} ${todo.length > 1 ? 'are' : 'is'} ${what}.${brackets} ${WHERE}` };
  }
  if (urlProblem) {
    return {
      creds: null,
      source: null,
      problem: `${urlProblem} Fill in CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET instead, or remove the CLOUDINARY_URL line to keep pictures in MongoDB. ${WHERE}`,
    };
  }
  return { creds: null, source: null, problem: null };
}

export function cloudinaryEnabled() {
  return Boolean(cloudinarySettings().creds);
}

export function cloudinaryProblem() {
  return cloudinarySettings().problem;
}

export function cloudinaryCloudName() {
  const { creds } = cloudinarySettings();
  return creds ? creds.cloud_name : '';
}

// Cloudinary's own error messages, turned into what to fix.
export function explainCloudinaryError(message) {
  const msg = String(message || 'unknown error');
  const { source } = cloudinarySettings();
  const setting = name => (source === 'url' ? `the API ${name} in CLOUDINARY_URL` : `CLOUDINARY_API_${name.toUpperCase()}`);
  if (/(unknown|invalid) api[_ ]?key/i.test(msg)) return `Cloudinary does not know this API key. Check ${setting('key')} (Cloudinary console → Settings → API Keys).`;
  if (/invalid signature/i.test(msg)) return `The API secret does not belong to this API key. Check ${setting('secret')} (Cloudinary console → Settings → API Keys).`;
  if (/cloud[_ ]?name/i.test(msg)) return `Cloudinary does not know this cloud name. Check ${source === 'url' ? 'the cloud name in CLOUDINARY_URL' : 'CLOUDINARY_CLOUD_NAME'} (Cloudinary console → Dashboard).`;
  if (/disabled|deactivated|inactive/i.test(msg)) return `This Cloudinary API key is switched off. Switch it on, or make a new key, under Settings → API Keys.`;
  return `Cloudinary did not accept the picture: ${msg}`;
}
