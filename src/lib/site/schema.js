import fs from 'node:fs/promises';
import path from 'node:path';
import { websiteUrl } from '../present.js';

// What the website editor can change: the website writes this list at every build (https://jpkm.in/site-schema.json):
// every page with its sections and their texts, text blocks, links, pictures, numbers and backgrounds, the header
// and footer, the menu, the design settings and the section builder's section types. A copy comes with the admin
// (seed-data/site-schema.json) for when the website cannot be reached or is still the version without the editor.

const state = globalThis.__jpkSiteSchema || (globalThis.__jpkSiteSchema = { value: null, at: 0, source: null, pending: null });
const TTL = 5 * 60 * 1000;

async function bundled() {
  const file = path.join(process.cwd(), 'seed-data', 'site-schema.json');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function usable(s) {
  return s && Array.isArray(s.pages) && s.pages.length && s.global && Array.isArray(s.sectionTypes);
}

async function load() {
  const url = `${await websiteUrl()}/site-schema.json`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store' });
    if (res.ok) {
      const s = await res.json();
      if (usable(s)) return { value: s, source: 'website' };
    }
  } catch {
    /* the website is not reachable from here: use the copy */
  }
  return { value: await bundled(), source: 'bundled' };
}

function refresh() {
  if (!state.pending) {
    state.pending = load()
      .then(r => { state.value = r.value; state.source = r.source; state.at = Date.now(); return r; })
      .finally(() => { state.pending = null; });
  }
  return state.pending;
}

// after the website address changed: read the list from the new address next time
export function resetSchema() {
  state.value = null;
  state.at = 0;
}

// { schema, source: "website" | "bundled" }
// quick: never wait for the website (the public website feed): an older copy, else the bundled one, while the
// current list is fetched in the background
export async function getSchema({ fresh = false, quick = false } = {}) {
  if (!fresh && state.value && Date.now() - state.at < TTL) return { schema: state.value, source: state.source };
  if (quick) {
    const p = refresh();
    p.catch(() => {});
    if (state.value) return { schema: state.value, source: state.source };
    return { schema: await bundled(), source: 'bundled' };
  }
  const r = await refresh();
  return { schema: r.value, source: r.source };
}

export function schemaPage(schema, page) {
  return schema.pages.find(p => p.page === page) || null;
}

export function sectionTypes(schema) {
  return Object.fromEntries((schema.sectionTypes || []).map(t => [t.type, t]));
}
