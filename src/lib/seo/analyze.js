// SEO check of one page, like the WordPress SEO plugins: a list of checks (good / could be better / needs work)
// and an overall result. Works in the browser (live while typing) and on the server (the SEO overview).
//
// page = {
//   keyphrase,                 focus keyphrase (may be empty)
//   title, description,        what Google shows (after the page's own settings)
//   path,                      the page's address, e.g. /products/ductile-iron/
//   h1,                        main heading
//   headings: [text],          other headings (h2–h6)
//   text,                      all text on the page (plain)
//   images: [{ alt }],         pictures that are content (not backgrounds)
//   links: [{ href }],         links in the content
//   noindex,                   kept out of Google
//   otherFocus: [{ name, keyphrase }]   focus keyphrases of the other pages
// }

const norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => norm(s).split(' ').filter(Boolean);
const stem = w => (w.length > 4 ? w.replace(/(ies|es|s)$/, '') : w); // castings ~ casting

// 2: the whole keyphrase; 1: all its words (in any order / other forms); 0: not there
export function matchLevel(text, keyphrase) {
  const t = ` ${norm(text)} `;
  const k = norm(keyphrase);
  if (!k) return 0;
  if (t.includes(` ${k} `)) return 2;
  const tw = new Set(words(text).map(stem));
  const kw = words(keyphrase).map(stem);
  return kw.length && kw.every(w => tw.has(w)) ? 1 : 0;
}

export function countPhrase(text, keyphrase) {
  const k = norm(keyphrase);
  if (!k) return 0;
  const t = ` ${norm(text)} `;
  let n = 0, i = 0;
  for (;;) {
    i = t.indexOf(` ${k} `, i);
    if (i < 0) return n;
    n++; i += k.length + 1;
  }
}

const GOOD = 'good', OK = 'ok', BAD = 'bad';

export function analyzePage(page) {
  const p = page || {};
  const kp = String(p.keyphrase || '').trim();
  const checks = [];
  const add = (id, status, text) => checks.push({ id, status, text });
  const title = String(p.title || '').trim();
  const desc = String(p.description || '').trim();
  const text = String(p.text || '');
  const wordCount = words(text).length;

  if (p.noindex) add('index', BAD, 'Google is told not to list this page (“Hide from Google” is on).');

  // ---- the focus keyphrase ----
  if (!kp) add('keyphrase', OK, 'Add a focus keyphrase: the words people type in Google to find this page (e.g. “ductile iron manhole covers”). The checks below get more precise with one.');
  else {
    const kw = words(kp).length;
    if (kw > 4) add('keyphraseLength', OK, `The focus keyphrase has ${kw} words. 2 to 4 words usually work best.`);
    const inTitle = matchLevel(title, kp);
    const atStart = norm(title).startsWith(norm(kp));
    add('kpTitle', inTitle === 2 ? GOOD : inTitle ? OK : BAD,
      inTitle === 2 ? (atStart ? 'The keyphrase is at the start of the search title. Great.' : 'The search title has the keyphrase. Putting it near the start helps a little more.')
        : inTitle ? 'The search title has the words of the keyphrase, but not together. Use the exact keyphrase.' : 'The search title does not have the keyphrase. Add it, ideally near the start.');
    const inDesc = matchLevel(desc, kp);
    add('kpDescription', inDesc === 2 ? GOOD : inDesc ? OK : BAD,
      inDesc === 2 ? 'The search description has the keyphrase.' : inDesc ? 'The search description has the words of the keyphrase, but not together.' : 'The search description does not have the keyphrase. Add it once, naturally.');
    const inUrl = matchLevel(String(p.path || '').replace(/[/-]+/g, ' '), kp);
    add('kpUrl', inUrl === 2 ? GOOD : inUrl ? OK : OK,
      inUrl === 2 ? 'The page address has the keyphrase.' : inUrl ? 'The page address has some words of the keyphrase.' : 'The page address does not have the keyphrase (fine for existing pages: changing addresses loses Google ranking).');
    const inH1 = matchLevel(p.h1, kp);
    add('kpH1', inH1 === 2 ? GOOD : inH1 ? OK : BAD,
      inH1 === 2 ? 'The main heading has the keyphrase.' : inH1 ? 'The main heading has the words of the keyphrase, but not together.' : 'The main heading (H1) does not have the keyphrase. Add it to the main heading.');
    const subs = (p.headings || []).map(h => matchLevel(h, kp));
    if ((p.headings || []).length) add('kpSubheadings', subs.includes(2) ? GOOD : subs.includes(1) ? OK : OK,
      subs.includes(2) ? 'A subheading has the keyphrase.' : subs.includes(1) ? 'A subheading has the words of the keyphrase.' : 'No subheading has the keyphrase. Use it (or similar words) in one subheading.');
    const first = words(text).slice(0, 120).join(' ');
    const inFirst = matchLevel(first, kp);
    add('kpIntro', inFirst === 2 ? GOOD : inFirst ? OK : BAD,
      inFirst === 2 ? 'The keyphrase is near the top of the page text.' : inFirst ? 'The words of the keyphrase are near the top of the page text, but not together.' : 'The keyphrase is not near the top of the page. Mention it in the first paragraph.');
    const n = countPhrase(text, kp);
    const density = wordCount ? (n * words(kp).length * 100) / wordCount : 0;
    const d = density.toFixed(1);
    add('kpDensity', n === 0 ? BAD : density > 3.5 ? BAD : density < 0.4 ? OK : GOOD,
      n === 0 ? 'The page text does not use the keyphrase. Use it a few times where it fits.'
        : density > 3.5 ? `The keyphrase is used ${n} times (${d}% of the text): too often, it reads like spam. Use other words in some places.`
          : density < 0.4 ? `The keyphrase is used ${n} time${n === 1 ? '' : 's'} (${d}% of the text). A few more uses would help.`
            : `The keyphrase is used ${n} time${n === 1 ? '' : 's'} (${d}% of the text). Good.`);
    const imgs = (p.images || []).filter(i => i && String(i.alt || '').trim());
    if ((p.images || []).length) {
      const any = imgs.map(i => matchLevel(i.alt, kp));
      add('kpAlt', any.includes(2) ? GOOD : any.includes(1) ? OK : OK,
        any.includes(2) ? 'A picture description (alt text) has the keyphrase.' : any.includes(1) ? 'A picture description has the words of the keyphrase.' : 'No picture description (alt text) has the keyphrase. Describe one picture with it.');
    }
    const same = (p.otherFocus || []).filter(o => norm(o.keyphrase) === norm(kp));
    if (same.length) add('kpUnique', BAD, `“${kp}” is also the focus keyphrase of ${same.map(o => o.name).join(', ')}. Give each page its own keyphrase, so they don't compete in Google.`);
  }

  // ---- title and description ----
  const tl = title.length;
  if (!tl) add('titleLength', BAD, 'The page has no search title.');
  else add('titleLength', tl > 65 ? OK : tl < 30 ? OK : GOOD,
    tl > 65 ? `The search title has ${tl} characters: Google cuts it after about 60. Make it shorter.` : tl < 30 ? `The search title has ${tl} characters. Use the space (up to about 60) to say more.` : `The search title has a good length (${tl} characters).`);
  const dl = desc.length;
  if (!dl) add('descriptionLength', BAD, 'The page has no search description. Write one or two sentences (120–160 characters) that make people click.');
  else add('descriptionLength', dl > 165 ? OK : dl < 110 ? OK : GOOD,
    dl > 165 ? `The search description has ${dl} characters: Google shows about 160. Shorten it.` : dl < 110 ? `The search description has ${dl} characters. Aim for 120 to 160.` : `The search description has a good length (${dl} characters).`);

  // ---- content ----
  add('textLength', wordCount >= 300 ? GOOD : wordCount >= 150 ? OK : BAD,
    wordCount >= 300 ? `The page has ${wordCount} words of text. Good.` : wordCount >= 150 ? `The page has ${wordCount} words. Pages with 300 words or more usually rank better.` : `The page has only ${wordCount} words. Add more useful text (300 words or more is best).`);
  if (!String(p.h1 || '').trim()) add('h1', BAD, 'The page has no main heading.');
  const images = p.images || [];
  if (images.length) {
    const missing = images.filter(i => !String((i && i.alt) || '').trim()).length;
    add('alts', missing === 0 ? GOOD : missing <= images.length / 4 ? OK : BAD,
      missing === 0 ? `All ${images.length} pictures have a description (alt text).` : `${missing} of ${images.length} pictures have no description (alt text). Add one: Google uses it and it helps people who can't see the picture.`);
  } else add('alts', OK, 'The page has no pictures. A picture or two makes the page more attractive (and can show up in Google Images).');
  const links = (p.links || []).map(l => String((l && l.href) || ''));
  const internal = links.filter(h => h.startsWith('/') || /^https?:\/\/(www\.)?jpkm\.in/i.test(h)).length;
  const outbound = links.filter(h => /^https?:\/\//i.test(h) && !/^https?:\/\/(www\.)?jpkm\.in/i.test(h)).length;
  add('internalLinks', internal ? GOOD : OK, internal ? `The page links to ${internal} other page${internal === 1 ? '' : 's'} of the website.` : 'The page does not link to other pages of the website. Link to related pages.');
  add('outboundLinks', outbound ? GOOD : OK, outbound ? `The page links to ${outbound} other website${outbound === 1 ? '' : 's'}.` : 'The page has no links to other websites (fine for most company pages).');

  const pts = checks.reduce((n, c) => n + (c.status === GOOD ? 2 : c.status === OK ? 1 : 0), 0);
  const pct = checks.length ? Math.round((pts * 100) / (checks.length * 2)) : 0;
  let score = pct >= 75 ? GOOD : pct >= 50 ? OK : BAD;
  if (!kp && score === GOOD) score = OK;
  if (p.noindex) score = BAD;
  const order = { bad: 0, ok: 1, good: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status]);
  return { score, percent: pct, checks, wordCount };
}

export const SCORE_LABEL = { good: 'Good', ok: 'Could be better', bad: 'Needs work' };
