// QR codes for links the team hands out: Make a link (firstvisit.js, R-023) and the tester sheet (setup.js, R-185).
// Drawn in the browser by qrcode-generator (MIT, from jsDelivr, loaded on first use), as SVG on the page and in print,
// and as a PNG to download. Medium error correction, with the four-module quiet zone scanners expect.
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';
let qrLib = null;
export const qrMatrix = async text => {
  qrLib ??= import(QR_LIB).then(m => m.default || m).catch(e => { qrLib = null; throw e; });
  const make = await qrLib, qr = make(0, 'M'); qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount(); return { n, dark: (r, c) => qr.isDark(r, c) };
};
export const qrSvg = ({ n, dark }, px) => {
  const q = 4, size = n + 2 * q; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + q},${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
};
// The code as a PNG file, about 1200px square, saved under the given name.
export async function qrPng(url, name) {
  const m = await qrMatrix(url), q = 4, scale = Math.max(8, Math.floor(1200 / (m.n + 2 * q))), size = (m.n + 2 * q) * scale;
  const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
  for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) g.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
  const blob = await new Promise(res => cv.toBlob(res, 'image/png')); if (!blob) throw new Error('no image');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.png'; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// Print a page of its own in a hidden frame, so the rest of the app never prints. Resolves false when printing could
// not start.
export function printHtml(html) {
  const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'; document.body.appendChild(f);
  const doc = f.contentDocument; doc.open(); doc.write(html); doc.close();
  return new Promise(res => setTimeout(() => {
    try { f.contentWindow.focus(); f.contentWindow.print(); res(true); } catch { res(false); }
    setTimeout(() => f.remove(), 60e3);
  }, 150));
}
