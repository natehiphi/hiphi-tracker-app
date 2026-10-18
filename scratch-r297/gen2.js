// Twelve variations on scene C (the Koʻolau, a rainbow, an ʻohana), none with a raised fist (Nate 10/17).
const { f, person, bubble, heart, ridge, arc, card, waves, SKIN, GRAY } = require('./gen.js');
const LEI = ['#F68B2C', '#F4B223', '#FCD09D'];
const mom = (x = 102, extra = {}) => person(x, 224, 1.08, { skin: SKIN[1], shirt: '#F68B2C', print: '#FCD09D', style: 'long', flower: '#FFFFFF', ...extra });
const tutu = (x = 264, extra = {}) => person(x, 224, 1.04, { skin: SKIN[3], shirt: '#39BFEE', hair: GRAY, lei: LEI, ...extra });
const dad = (x = 190, extra = {}) => person(x, 224, 1.16, { skin: SKIN[0], shirt: '#00698E', print: '#C4E8F6', ...extra });
const keiki = (x = 146, extra = {}) => person(x, 228, 0.74, { skin: SKIN[2], shirt: '#F4B223', ...extra });
const family = (o = {}) => `${mom(o.momX, o.mom)}${tutu(o.tutuX, o.tutu)}${dad(o.dadX, o.dad)}${o.noKeiki ? '' : keiki(o.keikiX, o.keiki)}`;
const sky = (c = '#EDF9FF') => `<rect width="360" height="220" fill="${c}"/>`;
const bow = (op = '.8', r = 150, cy = 170) => `<g opacity="${op}">${[['#F68B2C', 0], ['#F4B223', 10], ['#7BC47F', 20], ['#39BFEE', 30]].map(([c, d]) => `<path d="M${180 - r + d} ${cy}A${r - d} ${r - d} 0 0 1 ${180 + r - d} ${cy}" stroke="${c}" stroke-width="10" fill="none"/>`).join('')}</g>`;
const hills = `${ridge(150, 64, 5, '#7BC47F')}${ridge(172, 36, 4, '#2F8F6B')}<path d="M0 192C90 182 260 184 360 190V220H0Z" fill="#1F6E52"/>`;
const one = id => (body) => card(id, body);
// a taro leaf: a heart turned point-down on a stalk (kalo, the loʻi)
const taro = (x, y, r, col) => `<path d="M${x} ${y + 30}V${y + 4}" stroke="#2F8F6B" stroke-width="3"/>` + `<path d="M${f(x)} ${f(y + r)}C${f(x - r * 1.5)} ${f(y + r * 0.2)} ${f(x - r * 1.1)} ${f(y - r * 1.1)} ${f(x)} ${f(y - r * 0.4)}C${f(x + r * 1.1)} ${f(y - r * 1.1)} ${f(x + r * 1.5)} ${f(y + r * 0.2)} ${f(x)} ${f(y + r)}Z" fill="${col}"/>`;
// an ʻōhiʻa lehua blossom: a pom-pom of fine stamens
const lehua = (x, y, r, col) => Array.from({ length: 14 }, (_, i) => { const a = Math.PI * 2 * i / 14; return `<path d="M${x} ${y}L${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)}" stroke="${col}" stroke-width="2" stroke-linecap="round"/><circle cx="${f(x + Math.cos(a) * r)}" cy="${f(y + Math.sin(a) * r)}" r="1.8" fill="#F4B223"/>`; }).join('') + `<circle cx="${x}" cy="${y}" r="3" fill="#7A4E2D"/>`;
const branch = (pts, col = '#7A4E2D') => `<path d="${pts}" stroke="${col}" stroke-width="4" stroke-linecap="round" fill="none"/>`;
const capitol = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="0" width="120" height="5" fill="#093546"/><g fill="#024F69">${[8, 26, 44, 62, 80, 98].map(c => `<rect x="${c}" y="5" width="6" height="26"/>`).join('')}</g><rect x="-4" y="31" width="128" height="4" fill="#093546"/></g>`;

const V = [
  ['1 · As before, at rest', sky() + bow() + hills + bubble(256, 30, 46, 26, 'l', 'heart') + family()],
  ['2 · A sign with a heart', sky() + bow() + hills + family({ keiki: { sign: 1 } })],
  ['3 · Three voices', sky() + bow() + hills + bubble(62, 44, 44, 26, 'r', 'heart') + bubble(200, 28, 46, 26, 'r', 'dots') + bubble(280, 52, 44, 26, 'l', 'heart') + family()],
  ['4 · The loʻi (taro leaves)', sky() + bow() + hills + bubble(256, 30, 46, 26, 'l', 'heart') + family({ momX: 116, tutuX: 252, dadX: 192, keikiX: 156 }) + taro(26, 168, 24, '#2F8F6B') + taro(62, 186, 20, '#7BC47F') + taro(12, 200, 18, '#7BC47F') + taro(44, 210, 16, '#1F6E52') + taro(334, 168, 24, '#2F8F6B') + taro(300, 188, 19, '#7BC47F') + taro(350, 202, 17, '#7BC47F') + taro(318, 212, 15, '#1F6E52')],
  ['5 · Waterfalls', sky() + bow() + ridge(150, 64, 5, '#7BC47F') + `<path d="M100 100v56M108 106v50M252 98v58M260 104v52" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round"/>` + ridge(172, 36, 4, '#2F8F6B') + '<path d="M0 192C90 182 260 184 360 190V220H0Z" fill="#1F6E52"/>' + bubble(256, 30, 46, 26, 'l', 'heart') + family()],
  ['6 · Late afternoon', sky('#FFF4EE') + '<circle cx="30" cy="40" r="18" fill="#F68B2C"/>' + bow('.6') + hills + bubble(272, 34, 46, 26, 'l', 'heart') + family()],
  ['7 · The windward shore', sky() + bow('.8', 150, 150) + ridge(130, 56, 5, '#7BC47F') + '<rect y="128" width="360" height="40" fill="#6BCDF8"/><path d="M286 140c4-14 10-20 18-20s14 6 18 20z" fill="#2F8F6B"/>' + waves([[30, 146, 2], [150, 154, 3]], '#C4E8F6') + '<path d="M0 170C90 160 260 162 360 168V220H0Z" fill="#1F6E52"/>' + bubble(40, 30, 46, 26, 'r', 'heart') + family()],
  ['8 · ʻŌhiʻa lehua', sky() + bow() + hills + branch('M0 30C30 34 52 46 66 62M30 34C36 20 46 14 56 12') + lehua(66, 62, 14, '#E2574C') + lehua(56, 14, 12, '#E2574C') + `<path d="M40 30q8-12 18-8q-6 10-18 8zM20 32q4 12 14 12q-2-10-14-12z" fill="#2F8F6B"/>` + branch('M360 46C330 46 310 56 298 70') + lehua(298, 70, 14, '#E2574C') + `<path d="M330 48q-6-12-16-10q4 10 16 10z" fill="#2F8F6B"/>` + family()],
  ['9 · A letter and a phone', sky() + bow() + hills + bubble(256, 30, 46, 26, 'l', 'heart') + family({ dad: { phone: 1 }, tutu: { letter: 1 } })],
  ['10 · Double rainbow', sky() + bow('.45', 170, 170) + bow('.85', 140, 170) + hills + family()],
  ['11 · Neighbours too', sky() + bow() + hills + bubble(160, 26, 46, 26, 'r', 'heart') + person(40, 226, 0.98, { skin: SKIN[4], shirt: '#2F8F6B', style: 'bun' }) + person(322, 226, 0.98, { skin: SKIN[2], shirt: '#F4B223', hat: '#E8C38A' }) + family({ momX: 110, tutuX: 258, dadX: 186, keikiX: 148, keiki: { shirt: '#6BCDF8' } })],
  ['12 · The Capitol in the valley', sky() + bow() + ridge(150, 64, 5, '#7BC47F') + capitol(64, 96, 0.55) + ridge(176, 30, 4, '#2F8F6B') + '<path d="M0 192C90 182 260 184 360 190V220H0Z" fill="#1F6E52"/>' + bubble(256, 30, 46, 26, 'l', 'heart') + family()],
];
module.exports = V.map(([label, body], i) => [label, card('hv' + i, body)]);
if (require.main === module) {
  const fs = require('fs');
  fs.writeFileSync(__dirname + '/sheet.html', `<body style="margin:0;background:#F4F7F9;font:600 20px Lato,system-ui;color:#142B35;display:grid;grid-template-columns:repeat(3,440px);gap:24px 28px;padding:28px">${module.exports.map(([l, s]) => `<div><div style="margin:0 0 8px">${l}</div>${s.replace('<svg ', '<svg width="440" height="269" ')}</div>`).join('')}</body>`);
}
