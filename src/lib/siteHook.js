// Optional: ask the website host (Vercel, Netlify, Render…) to rebuild jpkm.in after content changes,
// so new posts get their own pre-rendered page for search engines. Set SITE_REBUILD_HOOK_URL to the
// host's "deploy hook" address. Several changes within a minute cause one rebuild.

const state = globalThis.__jpkSiteHook || (globalThis.__jpkSiteHook = { timer: null, reasons: new Set() });
const DELAY_MS = 60 * 1000;

export function siteHookEnabled() {
  return Boolean(process.env.SITE_REBUILD_HOOK_URL);
}

export function scheduleSiteRebuild(reason) {
  const url = String(process.env.SITE_REBUILD_HOOK_URL || '').trim();
  if (!url) return;
  state.reasons.add(reason);
  if (state.timer) clearTimeout(state.timer);
  state.timer = setTimeout(async () => {
    const why = [...state.reasons].join(', ');
    state.timer = null;
    state.reasons.clear();
    try {
      const res = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(20000) });
      console.log(`[jpk-admin] website rebuild requested (${why}): ${res.status}`);
    } catch (err) {
      console.error('[jpk-admin] website rebuild hook failed:', err && err.message);
    }
  }, DELAY_MS);
  if (state.timer.unref) state.timer.unref();
}
