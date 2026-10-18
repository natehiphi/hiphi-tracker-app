// Twelve brand-new welcome scenes (Nate 10/17: not based on C; warm, Hawaiʻi, people speaking up).
const fs = require('fs');
const { f, person, bubble, heart, flower, card, waves, palm, SKIN, GRAY, INK } = require('./gen.js');
const LEI = ['#F68B2C', '#F4B223', '#FCD09D'];
const G1 = '#7BC47F', G2 = '#2F8F6B', G3 = '#1F6E52', WOOD = '#7A4E2D', SAND = '#F7DDB8';
// someone seen from behind: the back of the head and the shoulders
const back = (x, b, s, hair, shirt) => `<path d="M${f(x - 31 * s)} ${b}C${f(x - 31 * s)} ${f(b - 36 * s)} ${f(x - 23 * s)} ${f(b - 52 * s)} ${f(x)} ${f(b - 52 * s)}C${f(x + 23 * s)} ${f(b - 52 * s)} ${f(x + 31 * s)} ${f(b - 36 * s)} ${f(x + 31 * s)} ${b}Z" fill="${shirt}"/><ellipse cx="${x}" cy="${f(b - 72 * s)}" rx="${f(14 * s)}" ry="${f(16 * s)}" fill="${hair}"/>`;
const leaf = (x, y, len, deg, w, col) => { const a = deg * Math.PI / 180, ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len, mx = (x + ex) / 2, my = (y + ey) / 2, nx = -Math.sin(a) * w, ny = Math.cos(a) * w; return `<path d="M${f(x)} ${f(y)}Q${f(mx + nx)} ${f(my + ny)} ${f(ex)} ${f(ey)}Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)}Z" fill="${col}"/>`; };
const plumeria = (x, y, r) => [0, 1, 2, 3, 4].map(i => leaf(x, y, r, -90 + i * 72 + 12, r * 0.42, '#FFFFFF')).join('') + `<circle cx="${x}" cy="${y}" r="${f(r * 0.28)}" fill="#F4B223"/>`;
const hibiscus = (x, y, r, col = '#F68B2C') => [0, 1, 2, 3, 4].map(i => { const a = (-90 + i * 72) * Math.PI / 180; return `<circle cx="${f(x + Math.cos(a) * r * 0.55)}" cy="${f(y + Math.sin(a) * r * 0.55)}" r="${f(r * 0.55)}" fill="${col}"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="${f(r * 0.22)}" fill="#984B0B"/>`;
const envelope = (x, y, s, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-6 -2L-20 -12L-14 2z" fill="#C4E8F6"/><path d="M6 -2L20 -12L14 2z" fill="#C4E8F6"/><rect x="-12" y="-8" width="24" height="16" rx="2" fill="#FFFFFF"/><path d="M-12 -8L0 1L12 -8" fill="#C4E8F6"/></g>`;
const sunHalo = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${f(r * 1.5)}" fill="#FCD09D"/><circle cx="${x}" cy="${y}" r="${r}" fill="#F68B2C"/>`;
// the island chain, from art.js
const src = fs.readFileSync('/Users/natehix/hiphi/wt-build-R-297-frontend/pub/art.js', 'utf8');
const ISL = [...src.matchAll(/\['(\w+)', '(M[^']+)'\]/g)].map(m => [m[1], m[2]]);

const S = [];
// 1 · Talk story on the lanai
S.push(['Talk story on the lanai', `<rect width="360" height="220" fill="#FFF4EE"/>
<rect x="112" y="18" width="136" height="104" rx="10" fill="#FFFFFF"/><rect x="120" y="26" width="120" height="88" rx="6" fill="#C4E8F6"/>
<path d="M120 92C150 70 172 60 196 66C214 70 226 78 240 74V114H120Z" fill="${G1}"/><path d="M120 104C160 94 200 98 240 92V114H120Z" fill="${G2}"/><path d="M180 26V114M120 70H240" stroke="#FFFFFF" stroke-width="5"/>
<path d="M30 150h34l-5 40h-24z" fill="#AD560F"/>${leaf(47, 150, 46, -120, 13, G2)}${leaf(47, 150, 50, -80, 14, G1)}${leaf(47, 150, 40, -40, 12, G2)}${leaf(47, 150, 34, -160, 10, G1)}
<rect y="186" width="360" height="34" fill="#E8C38A"/>
${person(116, 222, 1.02, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'bun', flower: '#FFFFFF' })}
${person(250, 222, 1.02, { skin: SKIN[3], shirt: '#00698E', print: '#C4E8F6', hair: GRAY })}
<rect x="160" y="176" width="44" height="8" rx="3" fill="${WOOD}"/><rect x="178" y="184" width="8" height="40" fill="${WOOD}"/><path d="M168 164h12l-1 12h-10zM186 166h12l-1 10h-10z" fill="#FFFFFF"/>
${bubble(54, 30, 46, 26, 'r', 'dots')}${bubble(272, 36, 46, 26, 'l', 'heart')}`]);
// 2 · Under the banyan
S.push(['Under the banyan tree', `<rect width="360" height="220" fill="#EDF9FF"/>
<path d="M168 200C172 150 166 110 150 92H212C194 110 188 150 192 200Z" fill="${WOOD}"/><path d="M140 96v84M124 100v70M228 96v80M244 102v64" stroke="${WOOD}" stroke-width="3" opacity=".7"/>
${[[60, 70, 50], [120, 44, 54], [190, 34, 58], [260, 46, 54], [312, 74, 46], [92, 96, 40], [180, 86, 50], [270, 94, 40]].map(([x, y, r], i) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${i % 3 === 1 ? G2 : i % 3 === 2 ? G1 : '#4FA36F'}"/>`).join('')}
${[[100, 50], [210, 40], [290, 70], [150, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#B9E3BC"/>`).join('')}
<path d="M0 188C100 180 260 182 360 186V220H0Z" fill="${G1}"/>
${person(64, 224, 0.98, { skin: SKIN[4], shirt: '#39BFEE', style: 'long' })}
${person(296, 224, 0.98, { skin: SKIN[0], shirt: '#F4B223', hat: '#E8C38A' })}
${person(132, 224, 1.06, { skin: SKIN[3], shirt: '#F68B2C', print: '#FCD09D', hair: GRAY, lei: LEI })}
${person(226, 224, 1.06, { skin: SKIN[1], shirt: '#00698E', print: '#C4E8F6', style: 'bun', flower: '#FFFFFF' })}
${person(180, 228, 0.7, { skin: SKIN[2], shirt: '#2F8F6B' })}
${bubble(158, 130, 44, 24, 'l', 'heart')}`]);
// 3 · Paddling together
const paddler = (x, i) => `${person(x, 168, 0.5, { skin: SKIN[i % 5], shirt: ['#F68B2C', '#00698E', '#F4B223', '#39BFEE', '#2F8F6B'][i], style: i === 1 ? 'long' : i === 3 ? 'bun' : 'short' })}<path d="M${x + 12} 140L${x - 20} 196" stroke="${WOOD}" stroke-width="3" stroke-linecap="round"/><ellipse cx="${x - 22}" cy="${200}" rx="4" ry="9" transform="rotate(30 ${x - 22} 200)" fill="${WOOD}"/>`;
S.push(['Paddling together', `<rect width="360" height="220" fill="#FFF4EE"/>${sunHalo(250, 120, 34)}
<rect y="120" width="360" height="100" fill="#39BFEE"/>${waves([[20, 140, 3], [250, 136, 3], [120, 206, 3], [280, 200, 2]], '#C4E8F6')}
${[96, 140, 184, 228, 272].map((x, i) => paddler(x, i)).join('')}
<path d="M40 160C80 176 280 176 330 158L322 186C260 196 100 196 52 186Z" fill="#093546"/><path d="M52 170C110 182 260 182 322 168" stroke="#F68B2C" stroke-width="3" fill="none"/>
${bubble(150, 40, 46, 26, 'l', 'heart')}`]);
// 4 · Voices from every island
const lit = { kauai: [48, 16], oahu: [134, 48], molokai: [190, 70], maui: [226, 88], hawaii: [276, 150] };
S.push(['Voices from every island', `<rect width="360" height="220" fill="#C4E8F6"/>${waves([[20, 180, 2], [90, 120, 2], [300, 60, 2], [170, 196, 2]], '#EDF9FF')}
<g transform="translate(12 6) scale(1.02)">${ISL.map(([n, p]) => `<path d="${p}" fill="${G2}"/>`).join('')}</g>
${Object.entries(lit).map(([n, [x, y]], i) => bubble(x + 12, y - 12, 34, 20, 'l', i % 2 ? 'dots' : 'heart').replace(/r="3"/g, 'r="2.4"')).join('')}`]);
// 5 · Letters take flight
S.push(['Letters take flight', `<rect width="360" height="220" fill="#EDF9FF"/><circle cx="314" cy="36" r="16" fill="#F68B2C"/>
<path d="M0 176C90 168 200 168 360 160V220H0Z" fill="${G1}"/>
<g transform="translate(236 118) scale(.36)"><rect x="0" y="0" width="300" height="8" fill="#093546"/><rect x="4" y="8" width="292" height="12" fill="#024F69"/>${[14, 50, 86, 122, 158, 194, 230, 266].map(c => `<rect x="${c}" y="20" width="14" height="80" fill="#00698E"/>`).join('')}<rect x="-6" y="100" width="312" height="10" fill="#024F69"/></g>
<path d="M60 150C110 60 200 40 300 96" stroke="#95DCFE" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round" fill="none"/>
${envelope(112, 92, 1.1, -24)}${envelope(168, 62, 1.0, -10)}${envelope(222, 58, 0.9, 6)}${envelope(268, 76, 0.8, 18)}
${person(70, 224, 1.12, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'long', flower: '#FFFFFF', letter: 1 })}
${person(140, 228, 0.82, { skin: SKIN[2], shirt: '#39BFEE' })}`]);
// 6 · Sunrise above the clouds
S.push(['Sunrise above the clouds', `<rect width="360" height="220" fill="#FFF4EE"/>${sunHalo(180, 112, 34)}
<path d="M0 120C60 110 120 124 180 116C240 108 300 122 360 112V220H0Z" fill="#FCD09D" opacity=".6"/>
${[[30, 140, 50], [110, 146, 54], [200, 142, 60], [290, 146, 56], [350, 140, 40]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="16" fill="#FFFFFF"/>`).join('')}
<path d="M0 168C70 150 120 160 170 172C220 184 300 160 360 166V220H0Z" fill="#AD560F"/><path d="M0 190C100 178 240 186 360 182V220H0Z" fill="#984B0B"/>
${person(254, 224, 1.06, { skin: SKIN[3], shirt: '#00698E', hair: GRAY, lei: LEI })}
${person(298, 226, 0.74, { skin: SKIN[2], shirt: '#F4B223', style: 'bun' })}
${bubble(196, 40, 46, 26, 'r', 'heart')}`]);
// 7 · The community garden
const bed = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="18" rx="3" fill="${WOOD}"/>` + Array.from({ length: Math.floor(w / 20) }, (_, i) => `<circle cx="${x + 12 + i * 20}" cy="${y - 4}" r="9" fill="${i % 2 ? G1 : G2}"/>`).join('');
S.push(['The community garden', `<rect width="360" height="220" fill="#EDF9FF"/><circle cx="60" cy="40" r="18" fill="#F68B2C"/>
<path d="M0 120C80 110 280 112 360 118V220H0Z" fill="${G1}"/>${bed(20, 140, 120)}${bed(220, 136, 120)}
${person(110, 224, 1.06, { skin: SKIN[0], shirt: '#F4B223', hat: '#E8C38A' })}
<path d="M140 178h30l6 -14h8l-6 18h-38z" fill="#39BFEE"/>
${person(230, 224, 1.04, { skin: SKIN[1], shirt: '#2F8F6B', style: 'long', flower: '#FFFFFF' })}
${person(176, 228, 0.72, { skin: SKIN[2], shirt: '#F68B2C' })}<path d="M166 214h20l-3 14h-14z" fill="#AD560F"/>${leaf(176, 212, 16, -60, 5, G2)}${leaf(176, 212, 14, -120, 5, G1)}
${bubble(270, 40, 46, 26, 'l', 'heart')}`]);
// 8 · Speaking at a hearing
S.push(['Speaking at a hearing', `<rect width="360" height="220" fill="#FFF4EE"/>
${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${i * 60}" y="0" width="56" height="150" fill="${i % 2 ? '#E8C38A' : '#DDB57A'}"/>`).join('')}
<rect y="146" width="360" height="74" fill="#C4E8F6"/>
${person(180, 150, 1.0, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'long', flower: '#FFFFFF' })}
<path d="M144 112h72l-6 44h-60z" fill="#024F69"/><path d="M180 112V86" stroke="#093546" stroke-width="3"/><ellipse cx="180" cy="82" rx="6" ry="8" fill="#093546"/>
${bubble(214, 30, 46, 26, 'l', 'heart')}
${back(70, 230, 1.0, INK, '#00698E')}${back(150, 236, 1.0, GRAY, '#39BFEE')}${back(230, 232, 1.0, '#3B2414', '#2F8F6B')}${back(306, 236, 0.96, INK, '#F4B223')}`]);
// 9 · Potluck at the beach
S.push(['A potluck at the beach', `<rect width="360" height="220" fill="#EDF9FF"/><rect y="88" width="360" height="40" fill="#39BFEE"/>${waves([[40, 104, 3], [220, 110, 3]], '#C4E8F6')}
<rect y="126" width="360" height="94" fill="${SAND}"/>${palm(326, 140, 0.9, -1)}
${person(90, 196, 0.96, { skin: SKIN[3], shirt: '#00698E', print: '#C4E8F6', hair: GRAY, lei: LEI })}
${person(180, 192, 1.0, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'bun', flower: '#FFFFFF' })}
${person(268, 196, 0.96, { skin: SKIN[0], shirt: '#F4B223' })}
<path d="M20 180H340L356 220H4Z" fill="#E8C38A"/><path d="M14 192H346M8 206H352" stroke="#DDB57A" stroke-width="4"/>
<ellipse cx="110" cy="196" rx="20" ry="7" fill="#FFFFFF"/><ellipse cx="110" cy="193" rx="14" ry="4" fill="#E2574C" opacity=".8"/>
<ellipse cx="180" cy="200" rx="22" ry="8" fill="#FFFFFF"/><ellipse cx="180" cy="197" rx="15" ry="4" fill="#F4B223"/>
<ellipse cx="250" cy="196" rx="20" ry="7" fill="#FFFFFF"/><ellipse cx="250" cy="193" rx="14" ry="4" fill="${G1}"/>
${bubble(40, 30, 46, 26, 'r', 'dots')}${bubble(200, 36, 46, 26, 'l', 'heart')}`]);
// 10 · A plumeria and a voice
S.push(['A plumeria and a voice', `<rect width="360" height="220" fill="#FFF4EE"/>
${leaf(70, 190, 70, -60, 18, G2)}${leaf(60, 200, 60, -100, 16, G1)}${leaf(300, 190, 70, -120, 18, G2)}${leaf(310, 200, 56, -80, 15, G1)}
<rect x="96" y="34" width="168" height="120" rx="60" fill="#C4E8F6"/><path d="M130 146L118 186L166 150Z" fill="#C4E8F6"/>
${plumeria(158, 92, 30)}${plumeria(206, 100, 22)}${heart(240, 66, 9, '#F68B2C')}
${hibiscus(48, 52, 16)}${hibiscus(318, 44, 13, '#F4B223')}`]);
// 11 · A gentle nudge on your phone
S.push(['A gentle nudge on your phone', `<rect width="360" height="220" fill="#EDF9FF"/>
${leaf(40, 220, 110, -70, 26, G2)}${leaf(20, 220, 90, -40, 22, G1)}${leaf(330, 220, 110, -110, 26, G2)}${leaf(350, 220, 90, -140, 22, G1)}
<rect x="130" y="20" width="100" height="196" rx="16" fill="#093546"/><rect x="138" y="30" width="84" height="180" rx="10" fill="#FFFFFF"/>
<rect x="146" y="44" width="68" height="44" rx="8" fill="#FFF4EE"/>${heart(162, 60, 7, '#F68B2C')}<path d="M174 58h32M174 68h24M154 78h40" stroke="#FCD09D" stroke-width="4" stroke-linecap="round"/>
<rect x="146" y="96" width="68" height="16" rx="8" fill="#00698E"/><path d="M146 124h60M146 136h48M146 148h56" stroke="#C4E8F6" stroke-width="4" stroke-linecap="round"/>
<path d="M118 220C118 180 124 160 140 150C150 146 156 160 150 172L140 196L176 160C184 154 192 164 186 172L160 220Z" fill="${SKIN[1]}"/>
${hibiscus(290, 50, 18)}${hibiscus(72, 70, 14, '#F4B223')}`]);
// 12 · Tutu and keiki on the bench
S.push(['Tutu and keiki on the bench', `<rect width="360" height="220" fill="#FFF4EE"/>${sunHalo(96, 104, 26)}
<rect y="110" width="360" height="56" fill="#39BFEE"/>${waves([[30, 132, 3], [200, 126, 3], [260, 150, 2]], '#C4E8F6')}
<rect y="164" width="360" height="56" fill="${G1}"/>${palm(320, 172, 0.9, -1)}
${person(160, 196, 1.06, { skin: SKIN[3], shirt: '#39BFEE', hair: GRAY, lei: LEI })}
${person(214, 198, 0.78, { skin: SKIN[2], shirt: '#F4B223', style: 'bun', flower: '#FFFFFF' })}
<rect x="104" y="178" width="152" height="10" rx="4" fill="${WOOD}"/><rect x="100" y="194" width="160" height="10" rx="4" fill="${WOOD}"/><rect x="112" y="204" width="8" height="20" fill="${WOOD}"/><rect x="240" y="204" width="8" height="20" fill="${WOOD}"/>
<rect x="176" y="160" width="14" height="22" rx="3" fill="#093546"/><rect x="178" y="162" width="10" height="16" rx="1" fill="#95DCFE"/>
${bubble(206, 52, 46, 26, 'l', 'heart')}`]);

module.exports = S.map(([l, b], i) => [`${i + 1} · ${l}`, card('hn' + i, b)]);
if (require.main === module) fs.writeFileSync(__dirname + '/sheet3.html', `<body style="margin:0;background:#F4F7F9;font:600 20px Lato,system-ui;color:#142B35;display:grid;grid-template-columns:repeat(3,440px);gap:24px 28px;padding:28px">${module.exports.map(([l, s]) => `<div><div style="margin:0 0 8px">${l}</div>${s.replace('<svg ', '<svg width="440" height="269" ')}</div>`).join('')}</body>`);
