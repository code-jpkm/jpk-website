// The address of a page's screens in SEO (server and browser): /admin/website/seo/links/<AboutUs | custom-… | post-… | global>
export function linksHref(key) {
  if (key === 'global') return '/admin/website/seo/links/global';
  const i = key.indexOf(':');
  const kind = key.slice(0, i);
  const id = key.slice(i + 1);
  return `/admin/website/seo/links/${kind === 'page' ? id : `${kind}-${id}`}`;
}

export function keyFromSlug(slug) {
  const s = String(slug || '');
  if (s === 'global') return 'global';
  if (/^custom-[a-z0-9]{6,30}$/.test(s)) return `custom:${s.slice(7)}`;
  if (/^post-[a-f0-9]{24}$/.test(s)) return `post:${s.slice(5)}`;
  if (/^[A-Za-z0-9]{1,60}$/.test(s)) return `page:${s}`;
  return null;
}
