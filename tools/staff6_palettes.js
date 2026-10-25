#!/usr/bin/env node
// Staff v6's colour palettes (R-336, Nate 10/25: "Let's go with number 2 for now, but the other palette choices should be
// able to be made by staff within their own settings"). One list here makes three things, so they never disagree:
//   staff6/css/tokens.css   the default palette (HIPHI Family), between the "palette:start" and "palette:end" marks
//   staff6/css/palettes.css every other palette, as :root[data-palette="id"] body.staff6 { ... } (wins over the default)
//   staff6/palettes.js      the list My settings shows (names, notes, a few swatches) and the default's id
// Each palette is given by 11 colours; the rest (hovers, washes, the old v5 names) are worked out from them, and every text
// colour is darkened until it reads at WCAG AA on the page, the cards and the wells (body text 7:1, small grey text and
// buttons 4.5:1, field edges 3:1, A-7). Run: node tools/staff6_palettes.js  (--check: fail if the files are out of date)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');

const hx = h => { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
const mix = (a, b, t) => toHex(hx(a).map((v, i) => v + (hx(b)[i] - v) * t));
const lum = h => { const c = hx(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const fit = (c, grounds, need) => { let x = c, k = 0; while (grounds.some(g => cr(x, g) < need) && k < 80) { x = mix(x, '#000000', .04); k++; } return x; };
const rgb = h => hx(h).join(', ');

const DEFAULT = 'hiphi-family';
// id, name, family, note, page, card, wash, ink, body, muted, action, leaf, accent (celebrations only)
const LIST = [
  ['hiphi-family', 'HIPHI Family', 'Clean and bright', 'The usual: the same colors as the public site', '#F4F7F9', '#FFFFFF', '#E9EFF2', '#142B35', '#344852', '#5F6F76', '#00698E', '#2E7650', '#F28C28'],
  ['lagoon-clear', 'Lagoon Clear', 'Clean and bright', 'White cards on a cool mist, coral for celebrations', '#F4F7F8', '#FFFFFF', '#E8EFF1', '#13262E', '#2C3F47', '#566870', '#00698E', '#2E7650', '#F07A55'],
  ['seafoam', 'Seafoam', 'Clean and bright', 'A breath of green in the white, sunny yellow accent', '#F2F7F5', '#FFFFFF', '#E3EFEA', '#13261F', '#2B3F38', '#55685F', '#0B6E73', '#2F7A3E', '#F5B841'],
  ['trade-wind', 'Trade Wind', 'Clean and bright', 'Airy blue-white with a true ocean blue', '#F5F7FB', '#FFFFFF', '#E8EDF5', '#141E2E', '#2E3A4D', '#586477', '#1F5FA6', '#2E7650', '#F07A55'],
  ['paper-white', 'Paper White', 'Clean and bright', 'Plain white and neutral grey, teal buttons', '#F6F6F6', '#FFFFFF', '#ECECEC', '#1C1C1E', '#38383B', '#5F5F64', '#0B6E73', '#2E7650', '#EE7B4F'],
  ['kona-sky', 'Kona Sky', 'Clean and bright', 'Pale sky ground, deep sky-blue buttons', '#F0F5FA', '#FFFFFF', '#E2ECF5', '#122435', '#2B3D50', '#55677A', '#1A5C96', '#2E7650', '#F2A541'],
  ['hibiscus', 'Hibiscus', 'Island color', 'Soft blush white, deep teal, hibiscus pink', '#FBF7F8', '#FFFFFF', '#F3EAEE', '#2A1C22', '#45333B', '#6C5961', '#0E6B78', '#2E7650', '#E0457B'],
  ['plumeria', 'Plumeria', 'Island color', 'Clean white, deep lagoon, plumeria yellow', '#F7F8F6', '#FFFFFF', '#ECEEEA', '#1B2321', '#333D3A', '#5C6662', '#00687A', '#3A7533', '#F6C445'],
  ['lilikoi', 'Lilikoʻi', 'Island color', 'Passion-fruit purple with a golden accent', '#F7F6FA', '#FFFFFF', '#ECEAF3', '#1F1A2B', '#383146', '#5F586E', '#5E3F99', '#2E7650', '#F2B33D'],
  ['ube', 'Ube', 'Island color', 'Lavender mist and a soft violet', '#F6F5FB', '#FFFFFF', '#EBE9F6', '#1E1B30', '#36324C', '#5C5874', '#4F48A0', '#2E7650', '#F09A6B'],
  ['lehua', 'Lehua', 'Island color', 'Navy buttons, lehua red-coral to celebrate', '#F5F6F9', '#FFFFFF', '#E9ECF2', '#151B2C', '#2E3548', '#585F72', '#22407A', '#2E7650', '#E5533F'],
  ['teal-pop', 'Teal Pop', 'Island color', 'Brighter teal and a lively coral', '#F2F8F8', '#FFFFFF', '#E1F0F0', '#0F2627', '#273F40', '#506869', '#007A7A', '#2F7A3E', '#FF7A59'],
  ['sunrise', 'Sunrise', 'Island color', 'Peach-tinged white, indigo, apricot', '#FBF8F7', '#FFFFFF', '#F3ECE9', '#221C28', '#3B3442', '#625A68', '#3A4D91', '#2E7650', '#F59E6B'],
  ['deep-reef', 'Deep Reef', 'Deep and grounded', 'Deep navy with a bright reef teal', '#F3F6F8', '#FFFFFF', '#E6ECF0', '#0E1E2C', '#273746', '#516170', '#0F4C81', '#2E7650', '#2BB3A3'],
  ['ocean-blue', 'Ocean Blue', 'Deep and grounded', 'Classic clear blue, very readable', '#F4F7FA', '#FFFFFF', '#E7EDF3', '#111C28', '#2A3644', '#54606E', '#005B96', '#2E7650', '#F07A55'],
  ['indigo-aloha', 'Indigo Aloha', 'Deep and grounded', 'Calm indigo on cool grey', '#F5F6FA', '#FFFFFF', '#E9EBF3', '#171A2C', '#303446', '#595D70', '#3B4BA0', '#2E7650', '#F2A541'],
  ['black-sand', 'Black Sand', 'Deep and grounded', 'Strongest contrast: near-black type on white', '#F7F7F7', '#FFFFFF', '#EDEDED', '#0F0F10', '#262628', '#525256', '#0A5F63', '#2E7650', '#EE7B4F'],
  ['fern', 'Fern', 'Garden green', 'Faint green ground, forest-teal buttons', '#F4F7F3', '#FFFFFF', '#E7EEE5', '#18231A', '#303D32', '#59665B', '#2F6A4A', '#3A7533', '#E8A13A'],
  ['monstera', 'Monstera', 'Garden green', 'Deeper leaf green, mango accent', '#F2F6F2', '#FFFFFF', '#E3EDE4', '#132117', '#2B3B2F', '#546658', '#1F5E3B', '#2F7A3E', '#F0A33A'],
  ['palm', 'Palm', 'Garden green', 'Green-teal with clear white', '#F5F8F7', '#FFFFFF', '#E7EFEC', '#132320', '#2C3C38', '#566662', '#1E6B5A', '#3A7533', '#F07A55'],
  ['sea-glass', 'Sea Glass', 'Soft and muted', 'Frosted sea-glass ground, gentle teal', '#F1F7F7', '#FFFFFF', '#E0EEEE', '#122627', '#2A3F40', '#536869', '#2A7478', '#2F7A3E', '#7CC6BB'],
  ['slate-sea', 'Slate and Sea', 'Soft and muted', 'Quiet cool grey, muted slate-teal', '#F3F5F6', '#FFFFFF', '#E7EBED', '#182227', '#313C42', '#5A656B', '#335F70', '#2E7650', '#E9906A'],
  ['manoa-mist', 'Mānoa Mist', 'Soft and muted', 'Misty blue-grey, soft periwinkle', '#F3F6F8', '#FFFFFF', '#E6ECF1', '#172230', '#303C4A', '#596574', '#3F649C', '#2E7650', '#F2A541'],
  ['cloud', 'Cloud', 'Soft and muted', 'Pure white page, soft grey wells, ocean teal', '#FFFFFF', '#FFFFFF', '#F1F3F4', '#1A1D1F', '#33373A', '#5C6166', '#00697A', '#2E7650', '#F07A55'],
  ['morning-reef', 'Morning Reef', 'Warm sand', 'Warm sand, ocean teal and leaf green', '#F7F3EA', '#FFFEFA', '#EEE7DA', '#25221E', '#433B33', '#685D52', '#0B6E73', '#3A7533', '#EE7B4F'],
];
// Morning Reef keeps its exact first values (spec 4 of V6-SPEC), not worked-out ones.
const EXACT = { 'morning-reef': {
  hair: '#E3DACB', field: '#8C7F70', press: '#095A5E', awash: '#E2EFEE', leafw: '#E5F0E1', late: '#955A00', latew: '#FBEFD9', bad: '#AF3328', badw: '#FBE9E5', band: '#3B332B',
  hover: '#FBF8F1', washHover: '#E6DDCD', shimmer: '#F3EEE3', tabHover: '#F1EBDF', actHover: '#D3E7E5', shadow: '#4A341E',
  n300: '#D2C6B4', p100: '#C6E0DE', p200: '#8FD3CF', p300: '#6AB5B3', p400: '#3B9A9B', p500: '#1C8388', p600: '#12787D', p900: '#073F42',
  o50: '#FDEEE6', o200: '#F8C6AE', o600: '#A84A22', o700: '#8C3C19', badPress: '#8E281F' } };

function build([id, name, family, note, page, card, wash, ink0, body0, muted0, action0, leaf0, coral]) {
  const G = [page, card, wash];
  const t = { page, card, wash, coral };
  t.ink = fit(ink0, G, 7); t.body = fit(body0, G, 7); t.muted = fit(muted0, G, 4.6);
  t.hair = mix(card, t.ink, .1); t.field = fit(mix(page, t.ink, .42), [page, card], 3.1);
  t.action = fit(fit(action0, G, 4.6), ['#FFFFFF'], 4.6);
  t.awash = mix(t.action, '#FFFFFF', .88); t.action = fit(t.action, [t.awash], 4.6); t.press = mix(t.action, '#000000', .18);
  t.leaf = fit(leaf0, [...G, mix(leaf0, '#FFFFFF', .88)], 4.6); t.leafw = mix(t.leaf, '#FFFFFF', .88);
  t.latew = '#FBEFD9'; t.late = fit('#955A00', [...G, t.latew], 4.6); t.badw = '#FBE9E5'; t.bad = fit('#AF3328', [...G, t.badw], 4.6);
  t.band = mix(t.ink, '#000000', .05);
  t.hover = mix(card, page, .5); t.washHover = mix(wash, t.ink, .05); t.shimmer = mix(page, wash, .5); t.tabHover = mix(page, wash, .7);
  t.actHover = mix(t.action, '#FFFFFF', .82); t.shadow = mix(t.ink, t.action, .3);
  Object.assign(t, { n300: mix(page, t.ink, .2), p100: mix(t.action, '#FFFFFF', .78), p200: mix(t.action, '#FFFFFF', .55), p300: mix(t.action, '#FFFFFF', .4),
    p400: mix(t.action, '#FFFFFF', .25), p500: mix(t.action, '#FFFFFF', .12), p600: mix(t.action, '#FFFFFF', .06), p900: mix(t.action, '#000000', .45),
    o50: mix(coral, '#FFFFFF', .85), o200: mix(coral, '#FFFFFF', .55), o600: fit(mix(coral, '#000000', .3), G, 4.6), o700: mix(coral, '#000000', .45), badPress: mix(t.bad, '#000000', .2) });
  if (EXACT[id]) Object.assign(t, { ink: ink0, body: body0, muted: muted0, action: action0, leaf: leaf0 }, EXACT[id]);
  // the checks, said in the file so a reader can see each palette passes (A-7)
  const checks = { body: Math.min(...G.map(g => cr(t.body, g))), muted: Math.min(...G.map(g => cr(t.muted, g))), button: cr('#FFFFFF', t.action),
    link: Math.min(...G.map(g => cr(t.action, g))), field: Math.min(cr(t.field, page), cr(t.field, card)) };
  return { id, name, family, note, t, checks };
}

const vars = t => [
  ['page', t.page], ['card', t.card], ['wash', t.wash], ['hair', t.hair], ['ink', t.ink], ['body', t.body], ['muted', t.muted], ['field', t.field],
  ['action', t.action], ['action-press', t.press], ['action-wash', t.awash], ['action-hover', t.actHover], ['leaf', t.leaf], ['leaf-wash', t.leafw],
  ['late', t.late], ['late-wash', t.latew], ['bad', t.bad], ['bad-wash', t.badw], ['coral', t.coral], ['band', t.band],
  ['hover', t.hover], ['wash-hover', t.washHover], ['shimmer', t.shimmer], ['tab-hover', t.tabHover],
].map(([k, v]) => `--v6-${k}: ${v};`).concat([
  `--v6-shadow: ${rgb(t.shadow)}; --v6-ink-rgb: ${rgb(t.ink)}; --v6-page-rgb: ${rgb(t.page)}; --v6-card-rgb: ${rgb(t.card)}; --v6-band-rgb: ${rgb(t.band)};`,
  `--n300: ${t.n300}; --p100: ${t.p100}; --p200: ${t.p200}; --p300: ${t.p300}; --p400: ${t.p400}; --p500: ${t.p500}; --p600: ${t.p600}; --p900: ${t.p900};`,
  `--o50: ${t.o50}; --o200: ${t.o200}; --o600: ${t.o600}; --o700: ${t.o700}; --bad-press: ${t.badPress};`,
]);
const said = c => `body ${c.body.toFixed(1)}, small grey ${c.muted.toFixed(1)}, button ${c.button.toFixed(1)}, links ${c.link.toFixed(1)}, field edges ${c.field.toFixed(1)}`;

const P = LIST.map(build);
const bad = P.filter(p => p.checks.body < 7 || p.checks.muted < 4.5 || p.checks.button < 4.5 || p.checks.link < 4.5 || p.checks.field < 3);
if (bad.length) { console.error('Below WCAG AA:', bad.map(p => p.name + ' (' + said(p.checks) + ')').join('; ')); process.exit(1); }
const def = P.find(p => p.id === DEFAULT);

const HEAD = '/* palette:start (written by tools/staff6_palettes.js: change the list there and run it, never by hand) */';
const END = '/* palette:end */';
const tokBlock = `${HEAD}\n  /* ${def.name}, the default (Nate 10/25). Contrast, least of page / card / wells: ${said(def.checks)}. */\n  ${vars(def.t).join('\n  ')}\n  ${END}`;
const css = `/* Staff v6 (R-336): the palettes a person can pick in My settings, Colors (Nate 10/25). Written by
   tools/staff6_palettes.js; never edit by hand. The default, ${def.name}, is in tokens.css. app.js puts the person's pick on
   <html data-palette="..."> (staff6.html does it before the first paint from this browser's copy). Each rule wins over
   tokens.css's body.staff6 because it is more specific; layout tokens are not touched. */
${P.filter(p => p.id !== DEFAULT).map(p => `/* ${p.name}: ${p.note}. ${said(p.checks)} */
:root[data-palette="${p.id}"] body.staff6 {
  ${vars(p.t).join('\n  ')}
}`).join('\n')}
`;
const js = `// Staff v6 (R-336): the palettes My settings offers (Nate 10/25). Written by tools/staff6_palettes.js; never edit by hand.
// sw: page, card, action, action-wash, leaf, coral, ink (the swatch strip and the sample in each choice).
export const DEFAULT_PALETTE = '${DEFAULT}';
export const FAMILIES = ${JSON.stringify([...new Set(P.map(p => p.family))])};
export const PALETTES = [
${P.map(p => `  ${JSON.stringify({ id: p.id, name: p.name, family: p.family, note: p.note, sw: [p.t.page, p.t.card, p.t.action, p.t.awash, p.t.leaf, p.t.coral, p.t.ink] })},`).join('\n')}
];
`;

const out = [];
const tokPath = path.join(ROOT, 'staff6/css/tokens.css');
const tok = fs.readFileSync(tokPath, 'utf8');
const a = tok.indexOf(HEAD), b = tok.indexOf(END);
if (a < 0 || b < 0) { console.error('tokens.css has no palette:start / palette:end marks'); process.exit(1); }
out.push([tokPath, tok.slice(0, a) + tokBlock + tok.slice(b + END.length)]);
out.push([path.join(ROOT, 'staff6/css/palettes.css'), css]);
out.push([path.join(ROOT, 'staff6/palettes.js'), js]);
if (process.argv.includes('--check')) {
  const stale = out.filter(([f, s]) => !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== s).map(([f]) => path.relative(ROOT, f));
  if (stale.length) { console.error('Out of date, run node tools/staff6_palettes.js:', stale.join(', ')); process.exit(1); }
  console.log(`Palettes current: ${P.length}, every one at WCAG AA.`);
} else {
  for (const [f, s] of out) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, s); fs.renameSync(tmp, f); }
  for (const p of P) console.log(p.id.padEnd(14), said(p.checks));
}
