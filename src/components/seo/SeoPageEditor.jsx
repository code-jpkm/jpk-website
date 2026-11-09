'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { useToast } from '@/components/Toast';
import { useConfirm } from '@/components/Confirm';
import { Card, Field, PageHeader, Notice } from '@/components/ui';
import { ImageControl } from '@/components/website/controls';
import { analyzePage, keyphraseIdeas, GROUPS } from '@/lib/seo/analyze';
import SeoNav, { ScoreDot, LengthMeter, ScoreBadge, linksHref } from './SeoNav';
import PageRankings from './PageRankings';

const FIELDS = ['focus', 'keyphrases', 'title', 'description', 'h1', 'ogTitle', 'ogDescription', 'image', 'noindex', 'nofollow', 'canonical'];
const pick = s => Object.fromEntries(FIELDS.map(k => [k, s && s[k] !== undefined ? s[k] : k === 'noindex' || k === 'nofollow' ? false : k === 'image' ? null : k === 'keyphrases' ? [] : '']));
const clean = s => {
  const out = {};
  for (const k of FIELDS) {
    const v = s[k];
    if (k === 'noindex' || k === 'nofollow') { if (v) out[k] = true; } else if (k === 'image') { if (v && v.url) out[k] = v; } else if (k === 'keyphrases') { const l = (v || []).map(x => String(x).trim()).filter(Boolean); if (l.length) out[k] = l; } else if (String(v || '').trim()) out[k] = String(v).trim();
  }
  return out;
};
const MARK = { 2: '✓', 1: '~', 0: '✗' };

function CheckList({ checks, testid }) {
  return (
    <ul className="seo-checks" data-testid={testid}>
      {checks.map(c => (
        <li key={c.id} className={`seo-checks__item seo-checks__item--${c.status}`} data-check={c.id} data-status={c.status}>
          <span className="seo-score__dot" aria-hidden="true" />
          <span>{c.text}{c.weight ? <span className="seo-pts"> {c.points ? `+${c.points}` : '0'}/{c.weight}</span> : null}
            {c.items ? (
              <details className="seo-items"><summary>Show {c.items.length === 1 ? 'it' : `the ${c.items.length}`}</summary><ul>{c.items.map((t, i) => <li key={i}>{t}</li>)}</ul></details>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The SEO of one page: keyphrases, Google title and description with a preview, social media sharing, advanced
// settings; on the side the 0–100 SEO score (Rank Math's tests), readability, links and Google rankings.
export default function SeoPageEditor({ page: initial, websiteUrl, canEdit, gscConnected }) {
  const toast = useToast();
  const [confirm, confirmDialog] = useConfirm();
  const [page, setPage] = useState(initial);
  const [seo, setSeo] = useState(() => pick(initial.seo));
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState('');
  const [open, setOpen] = useState(() => new Set(['basic']));
  const saved = useMemo(() => JSON.stringify(clean(pick(page.seo))), [page]);
  const dirty = JSON.stringify(clean(seo)) !== saved;
  const set = (k, v) => setSeo(s => ({ ...s, [k]: v }));
  const d = page.defaults || {};
  const title = seo.title || d.title || '';
  const description = seo.description || d.description || '';
  const domain = websiteUrl.replace(/^https?:\/\//, '');

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const result = useMemo(() => analyzePage({
    keyphrase: seo.focus, keyphrases: seo.keyphrases, title, description, path: page.path, h1: seo.h1 || d.h1, headings: page.input.headings,
    blocks: page.input.blocks, text: page.input.text, images: page.input.images, links: page.input.links, noindex: seo.noindex, otherFocus: page.otherFocus,
  }), [seo, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const ideas = useMemo(() => keyphraseIdeas(page.input.blocks || page.input.text, { exclude: [seo.focus, ...(seo.keyphrases || [])] }), [page.input, seo.focus, seo.keyphrases]);

  const addMore = phrase => {
    const t = String(phrase || '').trim();
    if (!t) return;
    const list = seo.keyphrases || [];
    if (list.length >= 4 || [seo.focus, ...list].some(k => String(k).toLowerCase() === t.toLowerCase())) return;
    set('keyphrases', [...list, t]);
    setMore('');
  };
  const takeIdea = phrase => (!String(seo.focus || '').trim() ? set('focus', phrase) : addMore(phrase));
  const toggle = id => setOpen(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const save = async (force = false) => {
    setSaving(true);
    try {
      const base = page.part.data || { content: {} };
      const data = { ...base, seo: { ...(base.seo || {}), ...clean(seo) } };
      for (const k of FIELDS) if (!(k in clean(seo))) delete data.seo[k];
      const r = await api(`/api/admin/site/part?key=${encodeURIComponent(page.key)}`, { method: 'PUT', body: { data, updatedAt: page.part.updatedAt, force } });
      setPage(p => ({ ...p, seo: (r.data && r.data.seo) || {}, part: { data: r.data, updatedAt: r.updatedAt } }));
      setSeo(pick((r.data && r.data.seo) || {}));
      toast.success('Saved. Google sees the change the next time it visits the page.');
    } catch (err) {
      if (err.status === 409 && (await confirm({ title: 'Someone else saved this page', message: err.message, confirmLabel: 'Save mine anyway', tone: 'primary' }))) { setSaving(false); return save(true); }
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const editHref = page.kind === 'custom' ? `/admin/website/custom-${page.key.slice(7)}` : `/admin/website/${page.key.slice(5)}`;
  const shareTitle = seo.ogTitle || title;
  const shareDesc = seo.ogDescription || description;
  const shareImg = (seo.image && seo.image.url) || '';
  const advice = result.checks.filter(c => !c.weight);
  const rd = result.readability;
  return (
    <>
      <PageHeader back={{ href: '/admin/website/seo', label: 'SEO' }} title={`SEO: ${page.name}`}
        description={<>The page <a href={`${websiteUrl}${page.path}`} target="_blank" rel="noopener noreferrer">{page.path} ↗</a> · its texts and pictures are changed in <Link href={editHref}>Pages &amp; sections</Link>.</>}
        actions={canEdit ? (
          <>
            {dirty ? <button type="button" className="btn btn--ghost" onClick={() => setSeo(pick(page.seo))}>Undo changes</button> : null}
            <button type="button" className="btn btn--accent" disabled={!dirty || saving} onClick={() => save()}>{saving ? 'Saving…' : 'Save'}</button>
          </>
        ) : null}
      />
      <SeoNav />
      {page.hidden ? <Notice tone="warn" title="This page is switched off">Visitors and Google don't see it. Switch it on in Pages &amp; sections.</Notice> : null}
      <fieldset className="plain" disabled={!canEdit || saving}>
        <div className="editor-grid">
          <div>
            <Card title="Keyphrases">
              <Field label="Focus keyphrase" htmlFor="seo-focus" hint="The words people type in Google to find this page, e.g. “ductile iron manhole covers”. Each page should have its own. Used for the SEO score, not shown on the website.">
                <input id="seo-focus" className="input input--lg" value={seo.focus} onChange={e => set('focus', e.target.value)} maxLength={100} placeholder="e.g. sanitary castings" />
              </Field>
              <Field label={`More keyphrases (${(seo.keyphrases || []).length} of 4)`} hint="Other searches this page should be found for: other names, other words for the same thing.">
                <div className="kp-chips" data-testid="kp-more">
                  {(seo.keyphrases || []).map((k, i) => (
                    <span key={k} className="kp-chip">{k}<button type="button" aria-label={`Remove ${k}`} onClick={() => set('keyphrases', seo.keyphrases.filter((_, j) => j !== i))}>×</button></span>
                  ))}
                  {(seo.keyphrases || []).length < 4 ? (
                    <input className="input kp-chips__input" value={more} onChange={e => setMore(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addMore(more); } }} onBlur={() => addMore(more)} maxLength={100} placeholder="Type and press Enter" aria-label="Add a keyphrase" />
                  ) : null}
                </div>
              </Field>
              {result.keyphrases.length ? (
                <table className="table table--compact kp-table" data-testid="kp-table">
                  <thead><tr><th>Keyphrase</th><th className="num">Uses</th><th className="num">Density</th><th title="In the search title">Title</th><th title="In the search description">Descr.</th><th title="In a heading">Heading</th></tr></thead>
                  <tbody>
                    {result.keyphrases.map(k => (
                      <tr key={k.keyphrase}>
                        <td>{k.keyphrase}{k.usedElsewhere.length ? <span className="kp-warn" title={`Also a keyphrase of ${k.usedElsewhere.join(', ')}`}> · also on {k.usedElsewhere.join(', ')}</span> : null}</td>
                        <td className="num">{k.uses}</td>
                        <td className="num">{k.density}%</td>
                        {['title', 'description', 'headings'].map(f => <td key={f} className={`kp-mark kp-mark--${k[f]}`}>{MARK[k[f]]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {ideas.length && canEdit ? (
                <div className="kp-ideas">
                  <span className="small muted">Ideas from this page's text (used most):</span>
                  <div className="kp-ideas__list" data-testid="kp-ideas">{ideas.map(i => <button key={i.phrase} type="button" className="kp-idea" onClick={() => takeIdea(i.phrase)} title={`Used ${i.uses} times on the page`}>{i.phrase} <span className="muted">{i.uses}×</span></button>)}</div>
                </div>
              ) : null}
            </Card>
            <Card title="Google">
              <div className="seo__preview seo-google" aria-label="Google preview">
                <span className="seo__url">{domain}{page.path === '/' ? '' : ` › ${page.path.split('/').filter(Boolean).join(' › ')}`}</span>
                <span className="seo__title">{title.length > 62 ? `${title.slice(0, 60)}…` : title || 'Page title'}</span>
                <span className="seo__desc">{description.length > 160 ? `${description.slice(0, 158)}…` : description || 'Write a search description: Google shows it under the title.'}</span>
              </div>
              <Field label="Search title" htmlFor="seo-title" hint={<><LengthMeter length={title.length} good={[30, 60]} max={70} /> {title.length} characters: 30–60 is best. {seo.title ? '' : 'Now the page’s normal title.'}</>}>
                <input id="seo-title" className="input" value={seo.title} onChange={e => set('title', e.target.value)} maxLength={140} placeholder={d.title} />
              </Field>
              <Field label="Search description" htmlFor="seo-desc" hint={<><LengthMeter length={description.length} good={[110, 165]} max={180} /> {description.length} characters: 120–160 is best.</>}>
                <textarea id="seo-desc" className="textarea" rows={3} value={seo.description} onChange={e => set('description', e.target.value)} maxLength={320} placeholder={d.description} />
              </Field>
              <Field label="Main heading (H1)" htmlFor="seo-h1" hint="The page’s main heading for Google and screen readers. Leave empty to keep the current one.">
                <input id="seo-h1" className="input" value={seo.h1} onChange={e => set('h1', e.target.value)} maxLength={200} placeholder={d.h1} />
              </Field>
            </Card>
            <Card title="Social media (LinkedIn, Facebook, WhatsApp)">
              <div className="seo-share" aria-label="Sharing preview">
                {shareImg ? <img src={shareImg} alt="" /> : <span className="seo-share__noimg">The website’s sharing picture (SEO › Settings)</span>}
                <span className="seo-share__domain">{domain.toUpperCase()}</span>
                <span className="seo-share__title">{shareTitle || 'Page title'}</span>
                <span className="seo-share__desc">{shareDesc}</span>
              </div>
              <Field label="Title when shared" htmlFor="seo-ogt" hint="Leave empty to use the search title.">
                <input id="seo-ogt" className="input" value={seo.ogTitle} onChange={e => set('ogTitle', e.target.value)} maxLength={140} placeholder={title} />
              </Field>
              <Field label="Description when shared" htmlFor="seo-ogd" hint="Leave empty to use the search description.">
                <textarea id="seo-ogd" className="textarea" rows={2} value={seo.ogDescription} onChange={e => set('ogDescription', e.target.value)} maxLength={320} placeholder={description} />
              </Field>
              <Field label="Picture when shared" hint="1200 × 630 pixels works best.">
                <ImageControl value={seo.image || undefined} onChange={v => set('image', v || null)} websiteUrl={websiteUrl} allowRemove aspect="1200 / 630" />
              </Field>
            </Card>
            <Card title="Advanced">
              <label className="check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={Boolean(seo.noindex)} onChange={e => set('noindex', e.target.checked)} />
                <span><strong>Hide from Google</strong><br /><span className="muted small">Search engines are asked not to list this page, and it leaves the sitemap.</span></span>
              </label>
              <label className="check" style={{ marginBottom: 16 }}>
                <input type="checkbox" checked={Boolean(seo.nofollow)} onChange={e => set('nofollow', e.target.checked)} />
                <span><strong>Don’t follow this page’s links</strong><br /><span className="muted small">Rarely needed.</span></span>
              </label>
              <Field label="Canonical address" htmlFor="seo-canonical" hint={`Only if the same content is on another address that Google should list instead, e.g. /products/ or https://… Leave empty normally (${domain}${page.path}).`}>
                <input id="seo-canonical" className="input" value={seo.canonical} onChange={e => set('canonical', e.target.value)} maxLength={300} placeholder={page.path} />
              </Field>
            </Card>
          </div>
          <div className="editor-grid__side">
            <Card title="SEO score" className="seo-check">
              <div className="seo-scorehead" data-testid="seo-score">
                <ScoreBadge points={result.points} score={result.score} />
                <div><ScoreDot score={result.score} /><span className="muted small" style={{ display: 'block', marginTop: 4 }}>{result.wordCount} words on the page{!String(seo.focus || '').trim() ? ' · add a focus keyphrase for a full score' : ''}</span></div>
              </div>
              {advice.length ? <CheckList checks={advice} testid="seo-advice" /> : null}
              {GROUPS.map(g => {
                const list = result.checks.filter(c => c.group === g.id && c.weight);
                const errors = list.filter(c => c.status !== 'good').length;
                const isOpen = open.has(g.id);
                return (
                  <div key={g.id} className="seo-group" data-group={g.id}>
                    <button type="button" className="seo-group__head" aria-expanded={isOpen} onClick={() => toggle(g.id)}>
                      <span>{g.title}</span>
                      <span className={`seo-group__count${errors ? ' seo-group__count--bad' : ''}`}>{errors ? `${errors} to fix` : 'All good'}</span>
                      <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
                    </button>
                    <div hidden={!isOpen}><CheckList checks={list} /></div>
                  </div>
                );
              })}
            </Card>
            <Card title="Readability" className="seo-check">
              <p className="seo-check__score" data-testid="read-score"><ScoreDot score={rd.score} />{rd.flesch !== null ? <span className="muted small">Reading ease {rd.flesch} of 100</span> : null}</p>
              <CheckList checks={rd.checks} testid="read-checks" />
              <p className="small muted" style={{ margin: '12px 0 0' }}>Change the texts in <Link href={editHref}>Pages &amp; sections</Link>.</p>
            </Card>
            {page.links ? (
              <Card title="Links">
                <p className="small" style={{ margin: 0 }} data-testid="seo-links"><strong>{page.links.internal}</strong> internal · <strong>{page.links.external}</strong> external{page.links.problems ? <> · <span className="lk-problem">{page.links.problems} to check</span></> : null}</p>
                <Link href={linksHref(page.key)} className="btn btn--ghost btn--sm" style={{ marginTop: 10 }}>See, change and add links</Link>
              </Card>
            ) : null}
            <PageRankings path={page.path} keyphrases={[seo.focus, ...(seo.keyphrases || [])].filter(Boolean)} connected={gscConnected} />
          </div>
        </div>
      </fieldset>
      {confirmDialog}
    </>
  );
}
