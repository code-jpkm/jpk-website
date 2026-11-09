// SEO check of one page, like Rank Math on WordPress: a score from 0 to 100 made of tests in four groups (Basic SEO,
// Additional, Title readability, Content readability), checks for up to 4 more keyphrases, and the readability
// check (readability.js). Works in the browser (live while typing) and on the server (the SEO overview).
//
// page = {
//   keyphrase,                 main focus keyphrase (may be empty)
//   keyphrases: [text],        up to 4 more keyphrases
//   title, description,        what Google shows (after the page's own settings)
//   path,                      the page's address, e.g. /products/ductile-iron/
//   h1,                        main heading
//   headings: [text],          other headings
//   blocks: [{ tag, text }],   the page's text in order (headings, paragraphs, list items); else text
//   text,                      all text on the page (plain)
//   images: [{ alt }],         pictures that are content (not backgrounds, not decorative)
//   links: [{ href, type, nofollow }]   links in the content (type internal / external)
//   noindex,                   kept out of Google
//   otherFocus: [{ name, keyphrase }]   keyphrases of the other pages
// }
import { analyzeReadability } from './readability.js';

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

export const GROUPS = [
  { id: 'basic', title: 'Basic SEO' },
  { id: 'additional', title: 'Additional' },
  { id: 'title', title: 'Title readability' },
  { id: 'content', title: 'Content readability' },
];

// words that make a title stand out (Rank Math: "power words") and that carry a feeling ("sentiment")
const POWER = new Set(('best top leading trusted proven reliable durable premium quality certified expert experts guaranteed official exclusive ultimate complete essential powerful strong robust heavy innovative advanced professional perfect superior unique effective efficient secure safe precision precise custom tailored worldclass world-class award awarded winning genuine original authentic instant fast quick easy simple free new latest modern smart affordable value proven-quality specialist specialists master masters pioneer pioneers biggest largest finest strongest toughest dependable rugged heavy-duty industrial engineered high-performance performance excellence excellent outstanding remarkable incredible amazing essential must-have ultimate definitive comprehensive').split(' '));
const SENTIMENT = new Set(('best great good excellent outstanding trusted reliable strong safe secure durable quality perfect superior proud success successful leading winning ideal amazing remarkable impressive superb happy easy smooth efficient effective worst bad poor avoid mistake mistakes problem problems risk risks danger dangerous fail failure broken weak cheap costly expensive warning never difficult hard tough rugged').split(' '));

export function analyzePage(page) {
  const p = page || {};
  const kp = String(p.keyphrase || '').trim();
  const checks = [];
  // weight: points when good (half when "could be better"); 0 = advice only, not in the score
  const add = (group, id, weight, status, text) => checks.push({ group, id, weight, status, text, points: status === GOOD ? weight : status === OK ? weight / 2 : 0 });
  const title = String(p.title || '').trim();
  const desc = String(p.description || '').trim();
  const blocks = Array.isArray(p.blocks) && p.blocks.length ? p.blocks : String(p.text || '').trim() ? [{ tag: 'p', text: String(p.text) }] : [];
  const text = String(p.text || blocks.map(b => b.text).join(' '));
  const wordCount = words(text).length;
  const headings = (p.headings || []).filter(Boolean);
  const images = p.images || [];
  const links = (p.links || []).map(l => ({ href: String((l && l.href) || ''), type: l && l.type, nofollow: Boolean(l && l.nofollow) }));
  const typeOf = l => l.type || (/^https?:\/\/(www\.)?jpkm\.in/i.test(l.href) || l.href.startsWith('/') ? 'internal' : /^https?:\/\//i.test(l.href) ? 'external' : 'other');
  const internal = links.filter(l => typeOf(l) === 'internal').length;
  const external = links.filter(l => typeOf(l) === 'external');
  const path = String(p.path || '');

  if (p.noindex) add('basic', 'index', 0, BAD, 'Google is told not to list this page (“Hide from Google” is on).');

  // ---- Basic SEO ----
  if (!kp) {
    add('basic', 'keyphrase', 0, BAD, 'Add a focus keyphrase: the words people type in Google to find this page (e.g. “ductile iron manhole covers”). Most tests need one.');
  } else if (words(kp).length > 4) add('basic', 'keyphraseLength', 0, OK, `The focus keyphrase has ${words(kp).length} words. 2 to 4 words usually work best.`);
  const inTitle = kp ? matchLevel(title, kp) : 0;
  add('basic', 'kpTitle', 10, inTitle === 2 ? GOOD : inTitle ? OK : BAD,
    !kp ? 'Keyphrase in the search title: add a focus keyphrase first.' : inTitle === 2 ? 'The search title has the keyphrase.' : inTitle ? 'The search title has the words of the keyphrase, but not together. Use the exact keyphrase.' : 'The search title does not have the keyphrase. Add it, ideally near the start.');
  const inDesc = kp ? matchLevel(desc, kp) : 0;
  add('basic', 'kpDescription', 6, inDesc === 2 ? GOOD : inDesc ? OK : BAD,
    !kp ? 'Keyphrase in the search description: add a focus keyphrase first.' : inDesc === 2 ? 'The search description has the keyphrase.' : inDesc ? 'The search description has the words of the keyphrase, but not together.' : 'The search description does not have the keyphrase. Add it once, naturally.');
  const inUrl = kp ? matchLevel(path.replace(/[/-]+/g, ' '), kp) : 0;
  add('basic', 'kpUrl', 3, inUrl === 2 ? GOOD : kp ? OK : BAD,
    !kp ? 'Keyphrase in the page address: add a focus keyphrase first.' : inUrl === 2 ? 'The page address has the keyphrase.' : inUrl ? 'The page address has some words of the keyphrase.' : 'The page address does not have the keyphrase (fine for existing pages: changing an address loses its Google ranking).');
  const introWords = Math.min(200, Math.max(60, Math.round(wordCount / 10)));
  const inFirst = kp ? matchLevel(words(text).slice(0, introWords).join(' '), kp) : 0;
  add('basic', 'kpIntro', 6, inFirst === 2 ? GOOD : inFirst ? OK : BAD,
    !kp ? 'Keyphrase at the beginning of the text: add a focus keyphrase first.' : inFirst === 2 ? 'The keyphrase is at the beginning of the page text.' : inFirst ? 'The words of the keyphrase are at the beginning of the text, but not together.' : 'The keyphrase is not at the beginning of the page. Use it in the first paragraph.');
  const n = kp ? countPhrase(text, kp) : 0;
  const inContent = kp ? (n ? 2 : matchLevel(text, kp)) : 0;
  add('basic', 'kpContent', 7, inContent === 2 ? GOOD : inContent ? OK : BAD,
    !kp ? 'Keyphrase in the text: add a focus keyphrase first.' : inContent === 2 ? 'The page text uses the keyphrase.' : inContent ? 'The page text has the words of the keyphrase, but never together.' : 'The page text does not use the keyphrase. Use it where it fits.');
  add('basic', 'textLength', 8, wordCount >= 600 ? GOOD : wordCount >= 300 ? OK : BAD,
    wordCount >= 600 ? `The page has ${wordCount} words of text. Good.` : wordCount >= 300 ? `The page has ${wordCount} words. Pages with 600 words or more usually rank better.` : `The page has only ${wordCount} words. Add more useful text (600 words or more is best).`);
  if (!String(p.h1 || '').trim()) add('basic', 'h1', 6, BAD, 'The page has no main heading (H1).');
  else {
    const inH1 = kp ? matchLevel(p.h1, kp) : 0;
    add('basic', 'kpH1', 6, inH1 === 2 ? GOOD : inH1 ? OK : BAD,
      !kp ? 'Keyphrase in the main heading: add a focus keyphrase first.' : inH1 === 2 ? 'The main heading has the keyphrase.' : inH1 ? 'The main heading has the words of the keyphrase, but not together.' : 'The main heading (H1) does not have the keyphrase. Add it to the main heading.');
  }

  // ---- Additional ----
  const subs = headings.map(h => (kp ? matchLevel(h, kp) : 0));
  add('additional', 'kpSubheadings', 5, subs.includes(2) ? GOOD : subs.includes(1) ? OK : BAD,
    !kp ? 'Keyphrase in subheadings: add a focus keyphrase first.' : !headings.length ? 'The page has no subheadings. Add some, one with the keyphrase.' : subs.includes(2) ? 'A subheading has the keyphrase.' : subs.includes(1) ? 'A subheading has the words of the keyphrase.' : 'No subheading has the keyphrase. Use it in one subheading (H2 or H3).');
  const alts = images.filter(i => i && String(i.alt || '').trim()).map(i => (kp ? matchLevel(i.alt, kp) : 0));
  add('additional', 'kpAlt', 4, alts.includes(2) ? GOOD : alts.includes(1) ? OK : BAD,
    !kp ? 'Keyphrase in a picture description: add a focus keyphrase first.' : !images.length ? 'The page has no pictures. Add one and describe it with the keyphrase.' : alts.includes(2) ? 'A picture description (alt text) has the keyphrase.' : alts.includes(1) ? 'A picture description has the words of the keyphrase.' : 'No picture description (alt text) has the keyphrase. Describe one picture with it.');
  const density = wordCount && n ? (n * words(kp).length * 100) / wordCount : 0;
  const d = density.toFixed(1);
  const times = `${n} time${n === 1 ? '' : 's'}`;
  add('additional', 'kpDensity', 5, !kp || !n ? BAD : wordCount < 100 ? OK : density >= 0.5 && density <= 2.5 ? GOOD : density < 3.5 && density > 0.3 ? OK : BAD,
    !kp ? 'Keyphrase density: add a focus keyphrase first.' : !n ? 'Keyphrase density 0%: the exact keyphrase is not in the text.'
      : wordCount < 100 ? `The keyphrase is used ${times}, but the page has only ${wordCount} words: too little text to judge the density. Add more text.`
      : density > 2.5 ? `Keyphrase density ${d}% (${times}): too often, it reads like spam. Use other words in some places (0.5–2.5% is best).`
        : density < 0.5 ? `Keyphrase density ${d}% (${times}). A few more uses would help (0.5–2.5% is best).` : `Keyphrase density ${d}% (${times}). Good.`);
  add('additional', 'urlLength', 2, path.length <= 75 ? GOOD : OK, path.length <= 75 ? `The page address is short (${path.length} characters).` : `The page address has ${path.length} characters. Shorter addresses (up to 75) are better.`);
  add('additional', 'internalLinks', 6, internal ? GOOD : BAD, internal ? `The page links to other pages of the website ${internal} time${internal === 1 ? '' : 's'}.` : 'The page does not link to other pages of the website. Link to related pages (SEO › Links).');
  add('additional', 'externalLinks', 2, external.length ? GOOD : BAD, external.length ? `The page links to ${external.length} other website${external.length === 1 ? '' : 's'}.` : 'The page has no links to other websites. A link to a useful source (a standard, an association) helps a little.');
  add('additional', 'dofollowLink', 2, external.some(l => !l.nofollow) ? GOOD : BAD, external.some(l => !l.nofollow) ? 'At least one link to another website is followed by Google (not nofollow).' : 'No followed (dofollow) link to another website.');
  const same = kp ? (p.otherFocus || []).filter(o => norm(o.keyphrase) === norm(kp)) : [];
  add('additional', 'kpUnique', 6, !kp ? BAD : same.length ? BAD : GOOD, !kp ? 'Keyphrase used only here: add a focus keyphrase first.' : same.length ? `“${kp}” is also a keyphrase of ${[...new Set(same.map(o => o.name))].join(', ')}. Give each page its own keyphrase, so they don't compete in Google.` : 'No other page uses this keyphrase. Good.');

  // ---- Title readability ----
  const tNorm = norm(title);
  const kpAt = kp ? tNorm.indexOf(norm(kp)) : -1;
  add('title', 'kpTitleStart', 3, kpAt >= 0 && kpAt <= tNorm.length / 2 ? GOOD : kpAt >= 0 ? OK : BAD,
    !kp ? 'Keyphrase at the start of the title: add a focus keyphrase first.' : kpAt >= 0 && kpAt <= tNorm.length / 2 ? 'The keyphrase is in the first half of the search title.' : kpAt >= 0 ? 'The keyphrase is at the end of the search title. Move it to the start.' : 'The search title does not start with the keyphrase.');
  const tl = title.length;
  add('title', 'titleLength', 3, !tl ? BAD : tl >= 30 && tl <= 65 ? GOOD : OK,
    !tl ? 'The page has no search title.' : tl > 65 ? `The search title has ${tl} characters: Google cuts it after about 60. Make it shorter.` : tl < 30 ? `The search title has ${tl} characters. Use the space (up to about 60) to say more.` : `The search title has a good length (${tl} characters).`);
  add('title', 'titleNumber', 2, /\d/.test(title) ? GOOD : BAD, /\d/.test(title) ? 'The search title has a number.' : 'The search title has no number. Numbers (“since 1976”, “50 years”) catch the eye.');
  const tw = words(title);
  const power = tw.find(w => POWER.has(w));
  add('title', 'titlePower', 2, power ? GOOD : BAD, power ? `The search title has a strong word (“${power}”).` : 'The search title has no strong word such as “trusted”, “leading”, “certified”, “durable”.');
  const feel = tw.find(w => SENTIMENT.has(w));
  add('title', 'titleSentiment', 2, feel ? GOOD : BAD, feel ? `The search title carries a feeling (“${feel}”).` : 'The search title is neutral. A positive word (“reliable”, “strong”, “safe”) makes people more likely to click.');

  // ---- Content readability ----
  const dl = desc.length;
  add('content', 'descriptionLength', 3, !dl ? BAD : dl >= 110 && dl <= 165 ? GOOD : OK,
    !dl ? 'The page has no search description. Write one or two sentences (120–160 characters) that make people click.' : dl > 165 ? `The search description has ${dl} characters: Google shows about 160. Shorten it.` : dl < 110 ? `The search description has ${dl} characters. Aim for 120 to 160.` : `The search description has a good length (${dl} characters).`);
  const paraWords = blocks.filter(b => !/^h[1-6]$/.test(b.tag)).map(b => words(b.text).length);
  const longest = paraWords.length ? Math.max(...paraWords) : 0;
  add('content', 'shortParagraphs', 3, longest > 150 ? BAD : longest > 120 ? OK : GOOD, longest > 120 ? `The longest paragraph has ${longest} words. Keep paragraphs under 120 words.` : 'The paragraphs are short. Good.');
  add('content', 'media', 4, images.length ? GOOD : BAD, images.length ? `The page has ${images.length} picture${images.length === 1 ? '' : 's'} with a description.` : 'The page has no pictures with a description. Add pictures (with alt text).');
  const missingAlt = images.filter(i => !String((i && i.alt) || '').trim()).length;
  if (missingAlt) add('content', 'alts', 0, BAD, `${missingAlt} of ${images.length} pictures have no description (alt text). Add one: Google uses it and it helps people who can't see the picture.`);

  // ---- the score ----
  const max = checks.reduce((t, c) => t + c.weight, 0);
  const got = checks.reduce((t, c) => t + c.points, 0);
  const points = max ? Math.round((got * 100) / max) : 0;
  let score = points >= 80 ? GOOD : points >= 50 ? OK : BAD;
  if (p.noindex) score = BAD;
  const order = { bad: 0, ok: 1, good: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);

  // ---- the other keyphrases ----
  const others = (p.keyphrases || []).map(k => String(k || '').trim()).filter(Boolean).slice(0, 4).map(k => {
    const uses = countPhrase(text, k);
    const dens = wordCount && uses ? (uses * words(k).length * 100) / wordCount : 0;
    const usedElsewhere = (p.otherFocus || []).filter(o => norm(o.keyphrase) === norm(k)).map(o => o.name);
    return {
      keyphrase: k, uses, density: Math.round(dens * 10) / 10,
      title: matchLevel(title, k), description: matchLevel(desc, k), headings: Math.max(0, ...headings.map(h => matchLevel(h, k)), matchLevel(p.h1, k)),
      usedElsewhere: [...new Set(usedElsewhere)],
    };
  });

  const readability = analyzeReadability({ blocks, images: images.length });
  return { score, points, percent: points, checks, wordCount, keyphrases: others, readability, groups: GROUPS };
}

export const SCORE_LABEL = { good: 'Good', ok: 'Could be better', bad: 'Needs work' };

// keyphrase ideas from the page's own text: the 2–3 word phrases it uses most (common little words left out)
const STOP = new Set(('a an and are as at be but by for from has have in into is it its of on or our that the their them they this to was we were which will with your you all also any can more most other such than then there these those up out over per not no very just one two three'.split(' ')));
// (source: the page's blocks, so phrases never run from one paragraph or list item into the next; or a text)
export function keyphraseIdeas(source, { limit = 8, exclude = [] } = {}) {
  const pieces = Array.isArray(source) ? source.map(b => b && b.text) : [source];
  const counts = new Map();
  for (const piece of pieces) {
    // sentences and "Label: value" parts are separate too
    for (const part of String(piece || '').split(/[.!?:;,()–—|]+/)) {
      const ws = words(part);
      for (const size of [2, 3]) {
        for (let i = 0; i + size <= ws.length; i++) {
          const g = ws.slice(i, i + size);
          if (STOP.has(g[0]) || STOP.has(g[g.length - 1]) || g.some(w => /^\d+$/.test(w) || w.length < 2)) continue;
          const k = g.join(' ');
          counts.set(k, (counts.get(k) || 0) + 1);
        }
      }
    }
  }
  const skip = new Set(exclude.map(norm));
  return [...counts.entries()].filter(([k, c]) => c >= 2 && !skip.has(k)).sort((a, b) => b[1] * b[0].split(' ').length - a[1] * a[0].split(' ').length)
    .filter(([k, c], i, arr) => !arr.slice(0, i).some(([o, oc]) => o.includes(k) && oc >= c)).slice(0, limit).map(([phrase, uses]) => ({ phrase, uses }));
}
