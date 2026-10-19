// Packs the rooster animations (rooster/animations/*.html, designed with Nate, R-308) into what the tracker loads:
// pub/rooster.js (each animation's markup) and pub/rooster.css (its rules). Run again whenever an animation file changes:
//   node tools/rooster_pack.mjs [rooster folder]
// Each file is a 480x480 stage with the rooster in the middle; the stage keeps its own pixel positions and is scaled to the
// size asked for (fx.js rooster). Class and keyframe names shared between files ("fx-feather", "fx-drift") are given the
// animation's own prefix, so they never meet the app's fx.css or each other. "streak" and "idle" are left out (Nate 18 Oct:
// they break C-7, no streaks, and A-10, nothing moves by itself for more than 5 s).
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname), root = path.join(here, '..');
const src = path.resolve(process.argv[2] || path.join(root, 'rooster'));
const SKIP = new Set(['streak', 'idle']);
const man = JSON.parse(fs.readFileSync(path.join(src, 'manifest.json'), 'utf8'));
const out = {}, css = [], meta = {};
for (const a of man.animations) {
  if (SKIP.has(a.id)) continue;
  let s = fs.readFileSync(path.join(src, 'animations', a.id + '.html'), 'utf8');
  const pre = 'ro' + a.id.replace(/[^a-z]/g, '').slice(0, 6) + '-';
  s = s.replace(/\bfx-/g, pre);
  // Every class and keyframe of the file then gets "ro-" in front ("s-body" -> "ro-s-body"): the files' short names
  // ("p-dot", "a-body") could meet the app's own.
  const fams = new Set([...s.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)).map(c => c.split('-')[0]).filter(Boolean));
  for (const f of fams) s = s.replace(new RegExp(`(?<![\\w-])${f}-(?=[a-z0-9])`, 'g'), `ro-${f}-`);
  const style = s.match(/<style>([\s\S]*?)<\/style>/)[1]
    .replace(/^body\{[^}]*\}\s*/m, '').replace(/\.paused /g, '.ro-paused ').replace(/^a\{[^}]*\}a:hover\{[^}]*\}\s*/m, '');
  css.push(`/* ${a.id}: ${a.title} (${a.plays}, ${a.duration_ms} ms) */\n${style.trim()}`);
  // The stage's own contents: everything inside the 480x480 box, its background left off (the page's shows through).
  const body = s.slice(s.indexOf('<body'));
  const start = body.indexOf('>', body.indexOf('<div', body.indexOf('<body') + 5)) + 1;
  const end = body.lastIndexOf('</div>');
  let inner = body.slice(start, end).trim()
    .replace(/\s(role="img"|role="status")/g, '').replace(/\saria-label="[^"]*"/g, '')
    .replace(/\n\s*/g, '\n');
  out[a.id] = inner;
  meta[a.id] = { ms: a.duration_ms, loop: a.plays === 'loop' };
}
fs.writeFileSync(path.join(root, 'pub', 'rooster.js'), `// The rooster's animations, packed by tools/rooster_pack.mjs from rooster/animations (R-308). Do not edit by hand.
// Loaded only where a moment on trial uses it (fx.js rooster), so the live site never downloads it.
export const META = ${JSON.stringify(meta)};
export const STAGE = ${JSON.stringify(out, null, 0)};
`);
fs.writeFileSync(path.join(root, 'pub', 'rooster.css'), `/* The rooster's animations, packed by tools/rooster_pack.mjs from rooster/animations (R-308). Do not edit by hand:
   change the animation file and pack again. The wrapper (.ro) is in fx.css. */
${css.join('\n\n')}
`);
// The error cards' rooster is everyone's since Nate's Keep (19 Oct, R-308): the live site loads it, and only it, the first
// time an error card is drawn (kernel.js errArt). One small module with its rules inside, so it lands in one piece; its
// <div>s are already <span>s (an error card's art may sit in a <p>), as fx.js does for the others.
const errCss = css.find(c => c.startsWith('/* error:'));
fs.writeFileSync(path.join(root, 'pub', 'rooster-error.js'), `// The error cards' rooster, packed by tools/rooster_pack.mjs from rooster/animations/error.html (R-308, Nate's Keep
// 19 Oct). Do not edit by hand. Loaded by kernel.js errArt the first time an error card is drawn, on the live site too.
export const MS = ${meta.error.ms};
export const CSS = ${JSON.stringify(errCss)};
export const STAGE = ${JSON.stringify(out.error.replace(/<div\b/g, '<span data-rb').replace(/<\/div>/g, '</span>'))};
`);
console.log('packed', Object.keys(out).join(', '), 'from', src);
