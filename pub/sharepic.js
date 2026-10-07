// The picture a shared link shows, per share (R-183; the test is variant.js 'pic'). A share page is a static file, so the
// version is part of its address: p/<version>/b/2026/HB1573-testify previews with that version's picture. share-fit.json (built
// with the pages, tools/share_pic_pages.mjs) lists, for each page, the versions that have a page, so a share never offers
// one that is not there. The list is small and fetched once, when the test is on; before it arrives (or if it fails) a share
// uses today's picture and counts nothing.
import { armOf, picArm, abSeen } from './variant.js';

const root = () => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}`;
let fit = null, asked = false;
export function loadFit() {
  if (asked) return; asked = true;
  try { fetch(`${root()}share-fit.json`, { cache: 'default' }).then(r => r.ok ? r.json() : null).then(j => { if (j && typeof j === 'object') fit = j; }).catch(() => { /* today's picture */ }); } catch { /* ignore */ }
}
// The first screen does not wait for it; the share buttons are never first.
setTimeout(loadFit, 1500);

// url: a share page's address (core.js billShareUrl, issueShareUrl); ask: what the friend is asked to do; key: what makes this
// share the same share again (the bill, or the issue). Returns { url, pic }: the address to share, and what to count once the
// share is made (pass pic to doShare).
export function picShare(url, ask, key) {
  const none = { url, pic: null };
  try {
    if (!fit || !ask) return none;
    const r = root(); if (!url.startsWith(r)) return none;
    const path = url.slice(r.length).replace(/[?#].*$/, '').replace(/\.html$/, '');
    if (!/^[bi]\//.test(path)) return none;
    const pick = picArm((fit[path] || '').split(',').filter(Boolean));
    if (!pick) return none;
    const q = url.slice(r.length + path.length);
    const out = pick.arm === 'today' ? `${url}${url.includes('?') ? '&' : '?'}pic=today` : `${r}p/${pick.arm}/${path}${q}`;
    return { url: out, pic: { bill: key, ask, arm: pick.arm } };
  } catch { return none; }
}
// Counted when the share is made (actions.js doShare): the version and the ask.
export const picSeen = pic => { if (pic) abSeen('pic', pic); };
