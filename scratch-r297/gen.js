// Generates the three welcome scenes as SVG strings (scratch: the chosen one is pasted into pub/art.js).
const f = n => +n.toFixed(1);
const SKIN = ['#8A5A3C', '#C68B5E', '#A8714A', '#6B4428', '#B97E55'];
const INK = '#23170F', GRAY = '#D7DDE1';
// One neighbour, shoulders up, standing on y=b. Flat fills, no outlines (one silhouette).
function person(x, b, s, o) {
  const P = (dx, dy) => `${f(x + dx * s)} ${f(b - dy * s)}`;
  let g = '';
  const hair = o.hair || INK;
  if (o.style === 'long') g += `<path d="M${P(-15, 74)}C${P(-17, 96)} ${P(17, 96)} ${P(15, 74)}L${P(18, 46)}C${P(8, 44)} ${P(-8, 44)} ${P(-18, 46)}Z" fill="${hair}"/>`;
  // the arm goes up behind the body, so the shoulder hides its root
  if (o.arm) g += `<path d="M${P(18, 34)}L${P(36, 92)}" stroke="${o.shirt}" stroke-width="${f(13 * s)}" stroke-linecap="round"/><circle cx="${f(x + 37 * s)}" cy="${f(b - 99 * s)}" r="${f(7.5 * s)}" fill="${o.skin}"/>`;
  if (o.armL) g += `<path d="M${P(-18, 34)}L${P(-36, 92)}" stroke="${o.shirt}" stroke-width="${f(13 * s)}" stroke-linecap="round"/><circle cx="${f(x - 37 * s)}" cy="${f(b - 99 * s)}" r="${f(7.5 * s)}" fill="${o.skin}"/>`;
  g += `<rect x="${f(x - 6 * s)}" y="${f(b - 64 * s)}" width="${f(12 * s)}" height="${f(16 * s)}" rx="${f(4 * s)}" fill="${o.skin}"/>`;
  g += `<path d="M${P(-31, 0)}C${P(-31, 36)} ${P(-23, 52)} ${P(0, 52)}C${P(23, 52)} ${P(31, 36)} ${P(31, 0)}Z" fill="${o.shirt}"/>`;
  if (o.print) for (const [dx, dy] of [[-18, 20], [-6, 34], [10, 14], [20, 32], [-14, 6], [4, 4]]) g += `<circle cx="${f(x + dx * s)}" cy="${f(b - dy * s)}" r="${f(3 * s)}" fill="${o.print}"/>`;
  if (o.lei) { const cols = o.lei; for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.08 + 0.84 * i / 10); g += `<circle cx="${f(x - Math.cos(a) * 17 * s)}" cy="${f(b - 50 * s + Math.sin(a) * 15 * s)}" r="${f(4.2 * s)}" fill="${cols[i % cols.length]}"/>`; } }
  g += `<ellipse cx="${f(x)}" cy="${f(b - 76 * s)}" rx="${f(13.5 * s)}" ry="${f(15.5 * s)}" fill="${o.skin}"/>`;
  // hair cap over the top of the head, parted to one side
  if (o.style !== 'none') g += `<path d="M${P(-14.5, 74)}C${P(-16, 97)} ${P(16, 97)} ${P(14.5, 74)}C${P(10, 84)} ${P(-2, 87)} ${P(-14.5, 74)}Z" fill="${hair}"/>`;
  if (o.style === 'bun') g += `<circle cx="${f(x + 3 * s)}" cy="${f(b - 95 * s)}" r="${f(8 * s)}" fill="${hair}"/>`;
  if (o.flower) g += flower(x + 12 * s, b - 86 * s, 4.2 * s, o.flower);
  if (o.hat) g += `<ellipse cx="${f(x)}" cy="${f(b - 86 * s)}" rx="${f(25 * s)}" ry="${f(5 * s)}" fill="${o.hat}"/><path d="M${P(-13, 86)}C${P(-13, 102)} ${P(13, 102)} ${P(13, 86)}Z" fill="${o.hat}"/><rect x="${f(x - 13 * s)}" y="${f(b - 90 * s)}" width="${f(26 * s)}" height="${f(3.5 * s)}" fill="${o.band || '#F68B2C'}"/>`;
  if (o.phone) g += `<rect x="${f(x + 8 * s)}" y="${f(b - 30 * s)}" width="${f(13 * s)}" height="${f(22 * s)}" rx="${f(3 * s)}" fill="#093546"/><rect x="${f(x + 10 * s)}" y="${f(b - 27.5 * s)}" width="${f(9 * s)}" height="${f(15 * s)}" rx="1" fill="#95DCFE"/><circle cx="${f(x + 8 * s)}" cy="${f(b - 16 * s)}" r="${f(5.5 * s)}" fill="${o.skin}"/>`;
  if (o.letter) g += `<rect x="${f(x + 2 * s)}" y="${f(b - 36 * s)}" width="${f(24 * s)}" height="${f(17 * s)}" rx="${f(2 * s)}" fill="#FFFFFF"/><path d="M${P(2, 36)}L${P(14, 27)}L${P(26, 36)}" fill="#C4E8F6"/><circle cx="${f(x + 3 * s)}" cy="${f(b - 22 * s)}" r="${f(5.5 * s)}" fill="${o.skin}"/>`;
  if (o.sign) g += `<rect x="${f(x - 2 * s)}" y="${f(b - 60 * s)}" width="${f(4 * s)}" height="${f(60 * s)}" fill="#7A4E2D"/><rect x="${f(x - 22 * s)}" y="${f(b - 92 * s)}" width="${f(44 * s)}" height="${f(32 * s)}" rx="${f(5 * s)}" fill="#FFFFFF"/>${heart(x, b - 77 * s, 9 * s, '#F68B2C')}`;
  return g;
}
const flower = (x, y, r, col) => [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return `<circle cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" r="${f(r * 0.78)}" fill="${col}"/>`; }).join('') + `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.5)}" fill="#F4B223"/>`;
const heart = (x, y, r, col) => `<path d="M${f(x)} ${f(y + r * 0.9)}C${f(x - r * 1.3)} ${f(y)} ${f(x - r * 0.9)} ${f(y - r * 0.9)} ${f(x)} ${f(y - r * 0.35)}C${f(x + r * 0.9)} ${f(y - r * 0.9)} ${f(x + r * 1.3)} ${f(y)} ${f(x)} ${f(y + r * 0.9)}Z" fill="${col}"/>`;
// a speech bubble with its tail pointing down-left or down-right, holding a heart or three dots
function bubble(x, y, w, h, side, inner) {
  const tail = side === 'l' ? `M${f(x + 10)} ${f(y + h - 2)}l-6 12l16 -12z` : `M${f(x + w - 10)} ${f(y + h - 2)}l6 12l-16 -12z`;
  let c = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#FFFFFF"/><path d="${tail}" fill="#FFFFFF"/>`;
  if (inner === 'dots') c += [0, 1, 2].map(i => `<circle cx="${f(x + w / 2 + (i - 1) * 9)}" cy="${f(y + h / 2)}" r="3" fill="#00698E"/>`).join('');
  else c += heart(x + w / 2, y + h / 2, h * 0.26, '#F68B2C');
  return c;
}
const palm = (x, b, s, lean = 1) => {
  const tx = x + 26 * s * lean, ty = b - 128 * s;
  let g = `<path d="M${f(x - 6 * s)} ${b}C${f(x - 2 * s)} ${f(b - 60 * s)} ${f(tx - 10 * s * lean)} ${f(ty + 30 * s)} ${f(tx - 3)} ${f(ty)}L${f(tx + 3)} ${f(ty + 2)}C${f(tx - 2 * s * lean)} ${f(ty + 36 * s)} ${f(x + 10 * s)} ${f(b - 60 * s)} ${f(x + 6 * s)} ${b}Z" fill="#7A4E2D"/>`;
  const leaves = [[-160, 52], [-125, 58], [-80, 46], [-40, 56], [-5, 50], [175, 40]];
  for (const [deg, len] of leaves) {
    const a = deg * Math.PI / 180, L = len * s, ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L + L * 0.35;
    const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.5 - 10 * s;
    const nx = -Math.sin(a) * 9 * s, ny = Math.cos(a) * 9 * s;
    g += `<path d="M${f(tx)} ${f(ty)}Q${f(mx + nx)} ${f(my + ny)} ${f(ex)} ${f(ey)}Q${f(mx - nx)} ${f(my - ny)} ${f(tx)} ${f(ty)}Z" fill="${deg % 2 ? '#2F8F6B' : '#1F6E52'}"/>`;
  }
  return g;
};
const waves = (pts, col) => `<path d="${pts.map(([x, y, n]) => `M${x} ${y}` + 'q6 -4 12 0t12 0'.repeat(n)).join('')}" stroke="${col}" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
const card = (id, body) => `<svg class="art art-hello" viewBox="0 0 360 220" aria-hidden="true" focusable="false"><defs><clipPath id="${id}"><rect width="360" height="220" rx="28"/></clipPath></defs><g clip-path="url(#${id})">${body}</g></svg>`;

// A: dawn at Lēʻahi (Diamond Head), the sea, a palm, four neighbours speaking up
const A = card('hA', `<rect width="360" height="220" fill="#FFF4EE"/>
<circle cx="150" cy="62" r="34" fill="#FCD09D"/><circle cx="150" cy="62" r="22" fill="#F68B2C"/>
<path d="M0 134C50 130 96 120 140 106C170 96 196 90 222 88C236 87 246 84 256 76L264 70C270 72 276 80 282 92C292 110 312 126 360 134V220H0Z" fill="#6BCDF8"/>
<path d="M0 134C60 128 100 124 140 116C164 112 176 118 196 118C240 120 300 134 360 132V220H0Z" fill="#39BFEE" opacity=".55"/>
<rect y="140" width="360" height="80" fill="#129DCB"/>
${waves([[210, 156, 3], [290, 168, 2], [30, 160, 2]], '#6BCDF8')}
<path d="M0 178C80 168 170 172 250 170C300 169 340 172 360 176V220H0Z" fill="#F7DDB8"/>
${palm(36, 184, 1.05, 1)}
${bubble(196, 26, 44, 26, 'l', 'heart')}
${bubble(298, 22, 46, 26, 'l', 'dots')}
${person(104, 222, 1.08, { skin: SKIN[0], shirt: '#00698E', print: '#C4E8F6', phone: 1 })}
${person(242, 222, 1.12, { skin: SKIN[3], shirt: '#39BFEE', hair: GRAY, lei: ['#F68B2C', '#F4B223', '#FCD09D'] })}
${person(174, 222, 1.2, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'long', flower: '#FFFFFF', arm: 1 })}
${person(306, 222, 0.82, { skin: SKIN[2], shirt: '#2F8F6B', style: 'short' })}
`);

// B: the Capitol behind, neighbours in front with signs: the place where the laws are made
const cols = Array.from({ length: 10 }, (_, i) => 52 + i * 28.4);
const B = card('hB', `<rect width="360" height="220" fill="#EDF9FF"/>
<circle cx="312" cy="20" r="14" fill="#F68B2C"/>
<path d="M0 96C60 80 110 88 150 80C200 70 260 82 360 72V220H0Z" fill="#7BC47F" opacity=".5"/>
<rect x="36" y="30" width="288" height="6" rx="2" fill="#093546"/><rect x="40" y="36" width="280" height="9" fill="#024F69"/>
<path d="M110 104c10-16 18-30 28-34h16c10 4 18 18 28 34z" fill="#6BCDF8"/><path d="M180 104c10-16 18-30 28-34h16c10 4 18 18 28 34z" fill="#6BCDF8"/>
<g fill="#00698E">${cols.map(x => `<path d="M${f(x)} 104V54L${f(x - 6)} 45h16L${f(x + 4)} 54V104z"/>`).join('')}</g>
<rect x="30" y="104" width="300" height="6" rx="2" fill="#024F69"/>
<rect y="112" width="360" height="108" fill="#C4E8F6"/>
${waves([[20, 124, 2], [300, 122, 2]], '#EDF9FF')}
${bubble(16, 58, 44, 26, 'r', 'heart')}
${person(66, 222, 0.98, { skin: SKIN[2], shirt: '#2F8F6B', sign: 1 })}
${person(118, 222, 1.06, { skin: SKIN[0], shirt: '#00698E', print: '#C4E8F6', hat: '#E8C38A' })}
${person(232, 222, 1.04, { skin: SKIN[3], shirt: '#39BFEE', hair: GRAY, lei: ['#F68B2C', '#F4B223', '#FCD09D'] })}
${person(176, 222, 1.16, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'bun', flower: '#FFFFFF', arm: 1 })}
${person(292, 222, 0.96, { skin: SKIN[4], shirt: '#00698E', style: 'long', phone: 1 })}
${bubble(300, 58, 46, 26, 'l', 'dots')}
`);

// C: the Koʻolau ridges after rain, a rainbow, an ʻohana; the keiki on a shoulder raises a hand
const ridge = (y0, h, n, col) => { const w = 360 / n, v = y0 - h * 0.3; let d = `M0 ${f(v)}`; for (let i = 0; i < n; i++) { const x = i * w, pk = y0 - h * (0.85 + ((i * 7) % 3) * 0.1); d += `C${f(x + w * 0.22)} ${f(v)} ${f(x + w * 0.34)} ${f(pk)} ${f(x + w * 0.5)} ${f(pk)}C${f(x + w * 0.66)} ${f(pk)} ${f(x + w * 0.78)} ${f(v)} ${f(x + w)} ${f(v)}`; } return `<path d="${d}V220H0Z" fill="${col}"/>`; };
const arc = (r, col) => `<path d="M${180 - r} 170A${r} ${r} 0 0 1 ${180 + r} 170" stroke="${col}" stroke-width="10" fill="none"/>`;
const C = card('hC', `<rect width="360" height="220" fill="#EDF9FF"/>
<g opacity=".8">${arc(150, '#F68B2C')}${arc(140, '#F4B223')}${arc(130, '#7BC47F')}${arc(120, '#39BFEE')}</g>
${ridge(150, 64, 5, '#7BC47F')}
${ridge(172, 36, 4, '#2F8F6B')}
<path d="M0 192C90 182 260 184 360 190V220H0Z" fill="#1F6E52"/>
${bubble(256, 30, 46, 26, 'l', 'heart')}
${person(102, 224, 1.08, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'long', flower: '#FFFFFF' })}
${person(264, 224, 1.04, { skin: SKIN[3], shirt: '#39BFEE', hair: GRAY, lei: ['#F68B2C', '#F4B223', '#FCD09D'] })}
${person(190, 224, 1.16, { skin: SKIN[0], shirt: '#00698E', print: '#C4E8F6' })}
${person(146, 228, 0.74, { skin: SKIN[2], shirt: '#F4B223', arm: 1 })}
`);
module.exports = { A, B, C };
if (require.main === module) {
  const fs = require('fs');
  fs.writeFileSync(__dirname + '/view.html', `<body style="margin:0;background:#ddd;display:grid;gap:16px;padding:16px">${[A, B, C].map(s => `<div style="width:720px">${s.replace('<svg ', '<svg width="720" height="440" ')}</div>`).join('')}</body>`);
}
Object.assign(module.exports, { f, person, bubble, heart, flower, ridge, arc, card, waves, palm, SKIN, GRAY, INK });
