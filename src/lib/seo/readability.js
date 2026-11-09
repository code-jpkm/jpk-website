// Readability of a page's text (English), like the readability check of the WordPress SEO plugins: Flesch reading
// ease, long sentences, long paragraphs, text without subheadings, passive voice, transition words and sentences
// that start with the same word. Works in the browser and on the server.
//
// blocks: [{ tag: 'h1'…'h6' | 'p' | 'li', text }] in page order

const GOOD = 'good', OK = 'ok', BAD = 'bad';

const ABBR = new Set(['mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'pvt', 'ltd', 'co', 'inc', 'no', 'nos', 'vs', 'etc', 'approx', 'dept', 'est', 'fig', 'sq', 'ft', 'mt', 'kg', 'mm', 'cm', 'min', 'max', 'e.g', 'i.e', 'viz', 'ref', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec']);

const wordsOf = s => String(s || '').match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu) || [];

// sentences of a text (an item of a list or a short line counts as one)
export function sentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const out = [];
  let start = 0;
  const re = /([.!?…]+)(["'”’)\]]*)\s+(?=["'“‘(]*[\p{Lu}\p{N}])/gu;
  let m;
  while ((m = re.exec(t))) {
    const end = m.index + m[1].length + m[2].length;
    const before = t.slice(start, m.index);
    const lastWord = (before.match(/([\p{L}.]+)$/u) || [])[1] || '';
    // abbreviations ("Pvt. Ltd.", "e.g.") and single letters ("A. K. Sharma") do not end a sentence
    if (m[1] === '.' && (ABBR.has(lastWord.toLowerCase().replace(/\.$/, '')) || /^\p{L}$/u.test(lastWord))) continue;
    out.push(t.slice(start, end).trim());
    start = end;
  }
  if (start < t.length) out.push(t.slice(start).trim());
  return out.filter(s => wordsOf(s).length);
}

// syllables of an English word (a close estimate, as readability formulas use)
export function syllables(word) {
  let w = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

const IRREGULAR = new Set(('arisen awoken been borne beaten become begun bent bet bid bitten blown broken brought built burnt bought cast caught chosen clung come cost crept cut dealt dug done drawn dreamt drunk driven eaten fallen fed felt fought found fled flung flown forbidden forgotten forgiven frozen got gotten given gone ground grown hung had heard hidden hit held hurt kept knelt known laid led leant leapt learnt left lent let lain lit lost made meant met paid put quit read ridden rung risen run said seen sought sold sent set sewn shaken shed shone shot shown shrunk shut sung sunk sat slain slept slid slung slit smelt sown spoken sped spent spilt spun spat split spoilt spread sprung stood stolen stuck stung stunk strewn stridden struck strung striven sworn swept swollen swum swung taken taught torn told thought thrown thrust trodden understood undertaken upheld upset woken worn woven wed wept won wound withdrawn withheld withstood wrung written').split(' '));
const AUX = /\b(am|is|are|was|were|be|been|being|get|gets|got|getting|gotten)\b/i;
const NOT_PARTICIPLE = new Set(['need', 'speed', 'seed', 'feed', 'bed', 'red', 'bred', 'shed', 'led', 'fled', 'indeed', 'hundred', 'tired', 'interested', 'dedicated', 'committed', 'experienced', 'qualified', 'skilled', 'talented', 'advanced', 'automated', 'integrated', 'detailed', 'limited', 'united', 'related', 'varied', 'complicated', 'sophisticated', 'concerned', 'pleased', 'satisfied', 'excited', 'prepared', 'supposed', 'able', 'determined']);
// "is cast", "were tested", "has been made": a form of "be"/"get" followed (within two words) by a past participle
export function isPassive(sentence) {
  const ws = wordsOf(sentence).map(w => w.toLowerCase());
  for (let i = 0; i < ws.length; i++) {
    if (!AUX.test(ws[i])) continue;
    for (let j = i + 1; j <= i + 3 && j < ws.length; j++) {
      const w = ws[j];
      if (/^(not|also|then|being|been|be|always|often|usually|fully|widely|highly|carefully|easily|still|now|only|well|very|being)$/.test(w)) continue;
      if (IRREGULAR.has(w) || (/^[a-z]{3,}ed$/.test(w) && !NOT_PARTICIPLE.has(w))) return true;
      break;
    }
  }
  return false;
}

const TRANSITION_WORDS = new Set(('accordingly additionally afterward afterwards albeit also although altogether another basically because before besides but certainly chiefly comparatively concurrently consequently conversely correspondingly despite during earlier especially eventually evidently explicitly finally firstly following formerly further furthermore generally hence henceforth however identically indeed initially instead lastly later likewise markedly meanwhile moreover nevertheless nonetheless nor notably notwithstanding obviously occasionally otherwise overall particularly presently previously rather regardless secondly shortly significantly similarly simultaneously since so soon specifically still subsequently surely surprisingly then thereafter therefore thereupon thirdly though thus till too undeniably undoubtedly unless unlike unquestionably until whenever whereas while yet').split(' '));
const TRANSITION_PHRASES = ['as a result', 'for example', 'for instance', 'in addition', 'in fact', 'on the other hand', 'in other words', 'as well as', 'in contrast', 'at the same time', 'in conclusion', 'to sum up', 'in short', 'above all', 'as long as', 'so that', 'such as', 'first of all', 'in particular', 'in the same way', 'as soon as', 'due to', 'in order to', 'rather than', 'not only', 'even though', 'even if', 'in general', 'in summary', 'on top of that', 'to begin with', 'after all', 'as a matter of fact', 'in the end', 'that is', 'because of', 'thanks to', 'along with', 'in turn', 'by contrast', 'most importantly'];
function hasTransition(sentence) {
  const lower = ` ${String(sentence).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ')} `;
  if (TRANSITION_PHRASES.some(p => lower.includes(` ${p} `))) return true;
  return wordsOf(sentence).some(w => TRANSITION_WORDS.has(w.toLowerCase()));
}

export function analyzeReadability({ blocks = [], images = 0 } = {}) {
  const checks = [];
  const add = (id, status, text, items) => checks.push({ id, status, text, ...(items && items.length ? { items } : {}) });
  const paras = blocks.filter(b => b && !/^h[1-6]$/.test(b.tag) && b.text);
  const allSentences = paras.flatMap(b => sentences(b.text));
  const prose = allSentences.filter(s => wordsOf(s).length >= 4);
  const wordCount = paras.reduce((n, b) => n + wordsOf(b.text).length, 0);
  if (wordCount < 50 || !prose.length) {
    add('readTooShort', OK, `The page has only ${wordCount} words of running text: too little to judge how easy it is to read.`);
    return { score: OK, flesch: null, checks, stats: { words: wordCount, sentences: allSentences.length, paragraphs: paras.length } };
  }

  // Flesch reading ease (on full sentences)
  const fw = prose.flatMap(wordsOf);
  const syl = fw.reduce((n, w) => n + syllables(w), 0);
  const flesch = Math.round(Math.max(0, Math.min(100, 206.835 - 1.015 * (fw.length / prose.length) - 84.6 * (syl / fw.length))) * 10) / 10;
  const level = flesch >= 70 ? 'easy' : flesch >= 60 ? 'fairly easy' : flesch >= 50 ? 'fairly difficult' : flesch >= 30 ? 'difficult' : 'very difficult';
  add('flesch', flesch >= 60 ? GOOD : flesch >= 45 ? OK : BAD,
    flesch >= 60 ? `Reading ease ${flesch} of 100 (${level}). Good.` : `Reading ease ${flesch} of 100 (${level}). Shorter sentences and simpler words make it easier; for technical pages, 45 to 60 is normal.`);

  // long sentences: more than 20 words
  const long = prose.filter(s => wordsOf(s).length > 20);
  const pLong = Math.round((long.length * 100) / prose.length);
  add('sentenceLength', pLong <= 25 ? GOOD : pLong <= 30 ? OK : BAD,
    pLong <= 25 ? `${pLong}% of the sentences have more than 20 words. Good.` : `${pLong}% of the sentences have more than 20 words (at most 25% is best). Split some of them.`,
    pLong > 25 ? long.slice(0, 8) : null);

  // long paragraphs
  const lengths = paras.map(b => wordsOf(b.text).length);
  const over150 = paras.filter((b, i) => lengths[i] > 150);
  const over120 = paras.filter((b, i) => lengths[i] > 120 && lengths[i] <= 150);
  add('paragraphLength', over150.length ? BAD : over120.length ? OK : GOOD,
    over150.length ? `${over150.length} paragraph${over150.length === 1 ? ' has' : 's have'} more than 150 words. Split long paragraphs.` : over120.length ? `${over120.length} paragraph${over120.length === 1 ? ' has' : 's have'} more than 120 words. Shorter paragraphs are easier to read.` : 'No paragraph is too long. Good.',
    [...over150, ...over120].slice(0, 5).map(b => `${b.text.slice(0, 120)}…`));

  // text without subheadings
  if (wordCount > 300) {
    let run = 0, worst = 0, subs = 0;
    for (const b of blocks) {
      if (/^h[2-6]$/.test(b.tag)) { subs += 1; worst = Math.max(worst, run); run = 0; continue; }
      if (!/^h1$/.test(b.tag)) run += wordsOf(b.text).length;
    }
    worst = Math.max(worst, run);
    add('subheadings', !subs ? BAD : worst > 350 ? BAD : worst > 300 ? OK : GOOD,
      !subs ? 'The text has no subheadings. Break it up with subheadings that say what each part is about.' : worst > 300 ? `One part of the text has ${worst} words without a subheading. Add a subheading about every 300 words.` : 'The text is well divided by subheadings.');
  }

  // passive voice
  const passive = prose.filter(isPassive);
  const pPass = Math.round((passive.length * 100) / prose.length);
  add('passive', pPass <= 10 ? GOOD : pPass <= 15 ? OK : BAD,
    pPass <= 10 ? `${pPass}% of the sentences are passive (“is made”, “were tested”). Good.` : `${pPass}% of the sentences are passive (at most 10% is best). Say who does it: “we cast” instead of “is cast”.`,
    pPass > 10 ? passive.slice(0, 8) : null);

  // transition words
  if (prose.length >= 5) {
    const withT = prose.filter(hasTransition).length;
    const pT = Math.round((withT * 100) / prose.length);
    add('transitions', pT >= 30 ? GOOD : pT >= 20 ? OK : BAD,
      pT >= 30 ? `${pT}% of the sentences have linking words (“because”, “for example”, “also”). Good.` : `${pT ? `Only ${pT}%` : 'None'} of the sentences have linking words such as “because”, “for example”, “however” (30% or more is best). They make the text flow.`);
  }

  // three or more sentences in a row starting with the same word
  let repeats = [];
  for (const b of paras) {
    const ss = sentences(b.text).filter(s => wordsOf(s).length >= 3);
    let runWord = '', runList = [];
    const flush = () => { if (runList.length >= 3) repeats.push(runList.slice(0, 4).join(' ')); };
    for (const s of ss) {
      const w = (wordsOf(s)[0] || '').toLowerCase();
      if (w && w === runWord) runList.push(s); else { flush(); runWord = w; runList = [s]; }
    }
    flush();
  }
  repeats = repeats.slice(0, 5);
  add('repeatedStarts', repeats.length ? OK : GOOD, repeats.length ? `${repeats.length} time${repeats.length === 1 ? '' : 's'} three or more sentences in a row start with the same word. Vary the starts.` : 'The sentences start in varied ways. Good.', repeats);

  // pictures in the text (Rank Math: content has images)
  add('readMedia', images ? GOOD : OK, images ? `The page has ${images} picture${images === 1 ? '' : 's'}: they break up the text.` : 'The page has no pictures. Pictures make long text easier to take in.');

  const pts = checks.reduce((n, c) => n + (c.status === GOOD ? 2 : c.status === OK ? 1 : 0), 0);
  const pct = Math.round((pts * 100) / (checks.length * 2));
  const score = pct >= 80 ? GOOD : pct >= 55 ? OK : BAD;
  const order = { bad: 0, ok: 1, good: 2 };
  checks.sort((a, b) => order[a.status] - order[b.status]);
  return { score, percent: pct, flesch, checks, stats: { words: wordCount, sentences: allSentences.length, paragraphs: paras.length } };
}
