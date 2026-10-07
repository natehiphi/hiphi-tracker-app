// The share picture versions' pages (R-183): for each bill and ask page tools/share_pages.mjs writes, one more page per
// version that fits, at p/<version>/<the same path> (p/letter/b/2026/HB1573-testify.html). A page differs from the main one
// only in its picture and in the version its link carries (&pic=letter), so the friend who taps it is counted for that
// version (pub/variant.js 'pic'). Static pages cannot pick a picture per visitor, so the sharer's browser picks the version
// and shares that version's address.
//
// share-fit.json lists, for each page path, the versions that have a page (and a drawn picture): the tracker reads it when
// someone shares, so it only ever offers a version whose page exists. A version with no picture drawn yet gets no page and
// no entry until the job has drawn it (tools/og_images.py reads tools/og_wanted_pics.json, written here).
//
// Which versions get pages: the live site's, those switched on in the 'pic' test now (public_ab_tests) and drawn from
// words staff have checked; the practice copy's (b/demo/), every version for its few featured bills, from every draft.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARMS, specsFor, picPath, loadLooks } from './share_pics.mjs';

export function picBuilder({ ROOT, want, page, armsOn }) {
  loadLooks(JSON.parse(readFileSync(join(ROOT, 'tools', 'og_looks.json'), 'utf8')));
  const fit = {}, wantedPics = new Map(), skipped = { undrawn: 0 };
  const have = p => existsSync(join(ROOT, 'pub', p));
  // add one page's versions. pagePath: 'b/2026/HB1573-testify' (no .html); toFor(depth): the tracker address from a page that
  // many folders down; input: share_pics.readIt's input; arms: the versions to build for this page (a Set).
  function add(pagePath, card, toFor, input, arms, noindex = false) {
    const specs = specsFor(input), got = [];
    for (const [arm, spec] of Object.entries(specs)) {
      if (!arms.has(arm)) continue;
      const img = picPath(spec);
      if (!have(img)) { wantedPics.set(img, spec); skipped.undrawn++; continue; }
      const folders = pagePath.split('/').length + 1;   // p/<arm>/ adds two folders to the path's own
      const to = toFor(folders).replace('#', `&pic=${arm}#`);
      want.set(`p/${arm}/${pagePath}.html`, page({ ...card, image: img, to, noindex }));
      got.push(arm);
    }
    if (got.length) fit[pagePath] = got.join(',');
    return got;
  }
  return { add, fit, wantedPics, skipped, armsOn };
}
