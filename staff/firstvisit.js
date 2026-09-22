// Outreach > Issues > First visit, and Make a link (R-023; backend migrations 066-068, docs/FIRST-VISIT-PLAN.md
// "Measurement"). Two screens, one job each (B-1):
//   First visit  (#/outreach/issues?view=first-visit)  A person comes here to see how far newcomers get through their
//                first visit, by where they came from.
//   Make a link  (#/outreach/issues?view=links)        A person comes here to make a link, with a QR code, for a partner
//                or an event.
// The numbers are first_visit_funnel(weeks): per week (Monday, Hawaiʻi time), where people came from and path. Counted
// with no way back to a person (pub/visitlog.js, the browser half): a random id per visit, never an account, an email
// or an address, and nothing at all from a browser that asks not to be tracked. Staff read only this roll-up.
// A link is track.html?via=<partner>&utm_campaign=<word>: people arriving by it are counted under the partner and see
// its welcome line (public_partners). The sandbox has no visits, so it shows made-up numbers, labelled as samples.
// Both are views of the Issues screen (issues.js hands over), so the frame and its router stay as they are.
import { S, DB, DEMO, hooks, esc } from './data.js';
import { icon, btn, iconBtn, empty, toast, openSheet, closeSheet, notice, pickerSheet, pickerChip, segmented, skeleton } from './ui.js';
import { plural, afterClose } from './lists.js';

export const FV_HREF = '#/outreach/issues?view=first-visit';
export const LINKS_HREF = '#/outreach/issues?view=links';
// Which of the two an Issues route is: 'numbers', 'links', or null for the Issues index itself.
export const fvView = route => ({ 'first-visit': 'numbers', links: 'links' })[route?.q?.view] || null;
export const fvTitle = route => ({ numbers: 'First visit', links: 'Make a link' })[fvView(route)] || '';
export const fvBack = route => fvView(route) === 'links' ? { href: FV_HREF, label: 'First visit' } : fvView(route) ? { href: '#/outreach/issues', label: 'Issues' } : null;
const LINK_BASE = 'https://natehiphi.github.io/hiphi-tracker-app/track.html';
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm';

// The screens of the first visit, in the order a person meets them (pub/start.js FLOW_IN, FLOW_OFF, FLOW_LINK). Someone
// who arrives on a shared bill starts with the bill's card, its quick email and "Follow this issue" instead of the first
// three screens, so those visits get a list of their own, and every percentage is of the visits that could reach that
// screen. In session and between sessions never share a week (the path follows the calendar), so they are one list, in
// which "Where do you stand?" counts against in-session visits only: between sessions it is left out, nothing is moving.
const NAMES = { arrive: 'A shared bill', act: 'The quick email', followask: 'Follow this issue', topics: 'What you care about', issues: 'Your issues',
  stand: 'Where do you stand?', bill: 'Reading a bill', session: 'The session, January to May', hearing: 'What a hearing is',
  you: 'Who speaks for you', soon: 'Coming up on your issues', done: 'You’re all set', home: 'Home' };
const FLOWS = {
  in: ['topics', 'issues', 'stand', 'bill', 'session', 'hearing', 'you', 'soon', 'done'],
  off: ['topics', 'issues', 'bill', 'session', 'hearing', 'you', 'soon', 'done'],
  link: ['arrive', 'act', 'followask', 'bill', 'session', 'hearing', 'you', 'soon', 'done'],
};
const PERIODS = [['4', '4 weeks'], ['12', '12 weeks'], ['52', 'A year']];

const V = () => S.fv ??= { weeks: '4', cache: {}, loading: '', err: '', partner: '', word: '', ptried: false };
const pct = (n, d) => d ? `${Math.round(100 * n / d)}%` : '–';
const nf = n => Number(n || 0).toLocaleString();
const secs = s => s == null ? '–' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min${Math.round(s % 60) ? ` ${Math.round(s % 60)} s` : ''}`;
const weekOf = w => new Date(String(w).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
const partnerBy = slug => (S.partners || []).find(p => p.slug === slug) || null;
const slugOf = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f\u02bb\u2018\u2019']/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
const wordOf = t => String(t || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40);
export const linkFor = (slug, word = '') => `${LINK_BASE}?via=${encodeURIComponent(slug)}${word ? `&utm_campaign=${encodeURIComponent(word)}` : ''}`;
const redraw = sel => { const y = scrollY; hooks.render(); if (sel) document.querySelector(sel)?.focus({ preventScroll: true }); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };

// ---- the numbers ----
// Made-up rows shaped like first_visit_funnel's, for the sandbox only: every week, a few sources, the three paths.
function sampleRows(weeks) {
  const srcs = [['direct', 9], ['instagram.com', 7], ['keiki-health-fair', 5], ['facebook.com', 3], ['newsletter', 2]];
  const mon = new Date(); mon.setHours(12, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const reach = { topics: 1, issues: .9, stand: .78, bill: .72, session: .68, hearing: .64, you: .58, soon: .54, done: .5 };
  const time = { topics: 21, issues: 58, stand: 24, bill: 46, session: 64, hearing: 52, you: 37, soon: 31, done: 14, followask: 12, arrive: 40, act: 95 };
  const rows = [];
  for (let w = 0; w < weeks; w++) {
    const wk = new Date(mon.getTime() - w * 7 * 864e5).toISOString().slice(0, 10);
    for (const [k, [src, base]] of srcs.entries()) {
      const n = Math.max(1, Math.round(base * (1 + ((w * 7 + k * 3) % 5) / 6)));
      const off = src === 'newsletter' && w % 2 === 1, path = off ? 'off' : 'in', flow = FLOWS[path];
      const reached = Object.fromEntries(flow.map(s => [s, Math.max(0, Math.round(n * reach[s]))]));
      const skips = { stand: Math.round(n * .18), you: Math.round(n * .12), soon: Math.round(n * .2) };
      rows.push({ week: wk, source: src, path, visits: n, reached, finished: reached.done, gave_email: Math.round(n * .28),
        median_seconds: Object.fromEntries(flow.map(s => [s, time[s] + ((w + k) % 7)])), skips: Object.fromEntries(Object.entries(skips).filter(([s, v]) => v && flow.includes(s))),
        quiz_right: Math.round(n * .45), quiz_answered: Math.round(n * .6), quiz_shown: Math.round(n * .05) });
      if (src === 'facebook.com') {   // a shared bill now and then
        const m = 1 + (w % 3), fl = FLOWS.link, rr = { arrive: 1, act: .6, followask: .55, bill: .45, session: .42, hearing: .4, you: .36, soon: .33, done: .3 };
        const re = Object.fromEntries(fl.map(s => [s, Math.round(m * rr[s])]));
        rows.push({ week: wk, source: src, path: 'link', visits: m, reached: re, finished: re.done, gave_email: Math.round(m * .3),
          median_seconds: Object.fromEntries(fl.map(s => [s, time[s]])), skips: {}, quiz_right: 0, quiz_answered: Math.round(m * .3), quiz_shown: 0 });
      }
    }
  }
  return rows;
}
// The sandbox's sources, from its sample rows, shaped like first_visit_sources: the sample partner's visits split between
// a flyer's campaign word and its plain link, so both kinds of row can be seen.
function sampleSources(rows) {
  const out = [];
  for (const [src, t] of by(rows, 'source')) {
    if (src !== 'keiki-health-fair') { out.push({ source: src, campaign: null, visits: t.visits, finished: t.finished, gave_email: t.email }); continue; }
    const cut = x => Math.round(x * .6);
    out.push({ source: src, campaign: 'spring-flyer', visits: cut(t.visits), finished: cut(t.finished), gave_email: cut(t.email) },
      { source: src, campaign: null, visits: t.visits - cut(t.visits), finished: t.finished - cut(t.finished), gave_email: t.email - cut(t.email) });
  }
  return out;
}
// Called while the page is being drawn: the sandbox's samples are there at once; the live numbers redraw the page when
// they arrive (never from inside the draw that asked for them). Kept five minutes per period.
async function load(weeks, { force = false } = {}) {
  const v = V(), have = v.cache[weeks];
  if (v.loading === weeks || (!force && have && Date.now() - have.at < 5 * 60e3)) return;
  if (DEMO) { const rows = sampleRows(+weeks); v.cache[weeks] = { rows, srcs: sampleSources(rows), at: Date.now() }; return; }
  v.loading = weeks; v.err = '';
  try { const [rows, srcs] = await Promise.all([DB.firstVisitFunnel(+weeks), DB.firstVisitSources(+weeks)]); v.cache[weeks] = { rows: rows || [], srcs: srcs || [], at: Date.now() }; }
  catch (e) { v.err = String(e?.message || e); }
  v.loading = '';
  if (S.route?.name === 'issues' && fvView(S.route) === 'numbers') redraw();
}
// Partners: asked once per visit to the app; a failure says so on the Links page, with Try again (B-8).
function wantPartners({ force = false } = {}) {
  const v = V(); if (v.ptried && !force) return; v.ptried = true; v.perr = false;
  DB.loadPartners().catch(() => { v.perr = true; }).then(() => { if (S.route?.name === 'issues' && fvView(S.route)) redraw(); });
}
// Adds up the rows the page shows. A typical time is the medians weighted by how many reached the screen: the roll-up
// has a median per week, source and path, and a median of medians would be further off.
function total(rows) {
  const t = { visits: 0, finished: 0, email: 0, qr: 0, qa: 0, qs: 0, reached: {}, skips: {}, tw: {}, tn: {} };
  for (const r of rows) {
    t.visits += r.visits || 0; t.finished += r.finished || 0; t.email += r.gave_email || 0;
    t.qr += r.quiz_right || 0; t.qa += r.quiz_answered || 0; t.qs += r.quiz_shown || 0;
    for (const [k, n] of Object.entries(r.reached || {})) t.reached[k] = (t.reached[k] || 0) + n;
    for (const [k, n] of Object.entries(r.skips || {})) t.skips[k] = (t.skips[k] || 0) + n;
    for (const [k, s] of Object.entries(r.median_seconds || {})) { const w = r.reached?.[k] || 1; t.tw[k] = (t.tw[k] || 0) + s * w; t.tn[k] = (t.tn[k] || 0) + w; }
  }
  return t;
}
const by = (rows, key) => { const m = new Map(); for (const r of rows) { const k = r[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return [...m.entries()].map(([k, rs]) => [k, total(rs)]); };
function sourceName(src) {
  const p = partnerBy(src);
  if (p) return [p.name, 'Partner link'];
  if (src === 'direct') return ['Direct', 'Typed in, a bookmark, or an app that does not say'];
  if (src.includes('.')) return [src, 'A link on another site'];
  return [src, 'Named in the link, not one of your partners'];
}

// `shared`: how many of the visits began on a bill someone shared (they skip the first screens), said here so the
// screen-by-screen count below it does not look like a mistake (A-14).
function tilesHTML(t, shared) {
  const tile = (n, label, sub = '') => `<div class="fv-tile"><span class="fv-n">${n}</span><span class="fv-l">${label}</span>${sub ? `<span class="fv-s">${sub}</span>` : ''}</div>`;
  return `<div class="fv-tiles">
    ${tile(nf(t.visits), 'started the first visit', shared ? `${nf(shared)} of them on a bill someone shared` : '')}
    ${tile(nf(t.finished), 'finished it', `${pct(t.finished, t.visits)} of those who started`)}
    ${tile(nf(t.email), 'gave an email', `${pct(t.email, t.visits)} of those who started`)}
    ${t.qa ? tile(`${nf(t.qr)} of ${nf(t.qa)}`, 'got the hearing question right', `the first time they answered${t.qs ? `; ${nf(t.qs)} more asked to see the answer` : ''}`) : tile('–', 'nobody has answered the hearing question yet')}
  </div>`;
}
// One list of screens. `of(s)` is how many visits could reach screen s: the percentage and the bar are of those.
function screensHTML(id, title, meta, t, list, of) {
  const rows = list.filter(s => of(s) > 0 && (s !== 'home' || t.reached[s]));
  if (!rows.length) return '';
  const row = s => {
    const n = t.reached[s] || 0, d = of(s), w = Math.min(100, Math.round(100 * n / d)), sk = t.skips[s] || 0, tm = t.tn[s] ? t.tw[s] / t.tn[s] : null;
    return `<li class="fv-srow"><span class="fv-sname">${esc(NAMES[s] || s)}</span>
      <span class="fv-reach"><span class="fv-bar" aria-hidden="true"><i style="width:${w}%"></i></span><span class="fv-rn"><b>${nf(n)}</b><span class="fv-w"> reached</span> · ${pct(n, d)}</span></span>
      <span class="fv-skip">${sk ? `${nf(sk)}<span class="fv-w"> skipped</span>` : '<span class="fv-none" aria-hidden="true">–</span>'}</span>
      <span class="fv-time">${tm == null ? '<span class="fv-none" aria-hidden="true">–</span>' : `<span class="fv-w">typically </span>${secs(tm)}`}</span></li>`;
  };
  return `<section class="fv-sec" aria-labelledby="${id}">
    <div class="le-sechead"><h2 id="${id}">${title}</h2><span class="meta">${meta}</span></div>
    <ol class="fv-screens"><li class="fv-srow fv-shead" aria-hidden="true"><span>Screen</span><span>Reached</span><span>Skipped</span><span>Typical time</span></li>${rows.map(row).join('')}</ol>
  </section>`;
}
// The first visit itself (in session and between sessions), then the visits that began on a shared bill.
function funnelsHTML(rows) {
  const plain = rows.filter(r => r.path !== 'link'), linked = rows.filter(r => r.path === 'link');
  const inV = plain.filter(r => r.path !== 'off').reduce((n, r) => n + (r.visits || 0), 0), offV = plain.filter(r => r.path === 'off').reduce((n, r) => n + (r.visits || 0), 0);
  const tp = total(plain), tl = total(linked);
  const ofPlain = s => s === 'home' ? inV + offV : (FLOWS.in.includes(s) ? inV : 0) + (FLOWS.off.includes(s) ? offV : 0);
  return screensHTML('fv-sh', 'Screen by screen', `of ${plural(tp.visits, 'visit')} that began on the first screen`, tp, [...FLOWS.in, 'home'], ofPlain)
    + screensHTML('fv-lsh', 'From a shared bill', `of ${plural(tl.visits, 'visit')} that began on a bill someone shared`, tl, [...FLOWS.link, 'home'], () => tl.visits);
}
function tableHTML(id, title, meta, head, rows) {
  return `<section class="fv-sec" aria-labelledby="${id}">
    <div class="le-sechead"><h2 id="${id}">${title}</h2>${meta ? `<span class="meta">${meta}</span>` : ''}</div>
    <div class="fv-tablewrap"><table class="fv-table"><thead><tr>${head.map((h, k) => `<th scope="col"${k ? ' class="num"' : ''}>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody></table></div></section>`;
}
// A source's own row, then, when its links carried campaign words, one row per word (and one for the plain link), so
// two flyers for one partner can be told apart.
function sourcesHTML(srcs) {
  const groups = new Map();
  for (const r of srcs) { const g = groups.get(r.source) || { visits: 0, finished: 0, email: 0, words: [] }; g.visits += r.visits; g.finished += r.finished; g.email += r.gave_email; g.words.push(r); groups.set(r.source, g); }
  const nums = (v, f, e) => `<td class="num">${nf(v)}</td><td class="num">${nf(f)} <span class="fv-pc">${pct(f, v)}</span></td><td class="num">${nf(e)} <span class="fv-pc">${pct(e, v)}</span></td>`;
  const rows = [...groups.entries()].sort((a, b) => b[1].visits - a[1].visits || String(a[0]).localeCompare(String(b[0]))).flatMap(([k, g]) => {
    const [name, kind] = sourceName(String(k)), words = g.words.some(w => w.campaign) ? g.words.slice().sort((a, b) => (a.campaign ? 0 : 1) - (b.campaign ? 0 : 1) || b.visits - a.visits) : [];
    return [`<tr><th scope="row"><span class="fv-src">${esc(name)}</span><span class="fv-kind">${esc(kind)}</span></th>${nums(g.visits, g.finished, g.email)}</tr>`,
      ...words.map(w => `<tr class="fv-sub"><th scope="row"><span class="sr">${esc(name)}, </span>${w.campaign ? `<span class="fv-word">${esc(w.campaign)}</span>` : '<span class="fv-word none">no campaign word</span>'}</th>${nums(w.visits, w.finished, w.gave_email)}</tr>`)];
  });
  return tableHTML('fv-ch', 'Where they came from', '', ['Came from', 'Started', 'Finished', 'Gave an email'], rows);
}
function weeksHTML(rows) {
  const wk = by(rows, 'week').sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  if (wk.length < 2) return '';
  return tableHTML('fv-wh', 'By week', 'Monday to Sunday', ['Week of', 'Started', 'Finished', 'Gave an email'], wk.map(([k, t]) =>
    `<tr><th scope="row">${esc(weekOf(k))}</th><td class="num">${nf(t.visits)}</td><td class="num">${nf(t.finished)} <span class="fv-pc">${pct(t.finished, t.visits)}</span></td><td class="num">${nf(t.email)}</td></tr>`));
}
function numbersHTML() {
  const v = V(), have = v.cache[v.weeks];
  if (!have) {
    if (v.err) return notice('bad', 'circle-alert', 'The numbers did not load. Check your connection and try again.', btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-fv': 'retry' } }));
    return `<div class="fv-loading" aria-busy="true" aria-label="Loading the numbers">${skeleton(3)}</div>`;
  }
  const rows = have.rows, shared = rows.filter(r => r.path === 'link').reduce((n, r) => n + (r.visits || 0), 0);
  const sample = DEMO ? notice('info', 'info', '<b>Sample numbers.</b> The sandbox has no real visits.') : '';
  if (!rows.length) return `${sample}<div class="le-empty">${empty({ h: 'h2', title: 'No first visits counted yet', text: `Numbers appear here as newcomers walk through the first visit on the public page. Nothing is counted from the sandbox, or from a browser that asks not to be tracked.` })}</div>`;
  // Where they came from comes second: it is half of what this screen is for (B-1), and Make a link sends people here.
  return `${sample}${tilesHTML(total(rows), shared)}${sourcesHTML(have.srcs || [])}${funnelsHTML(rows)}${weeksHTML(rows)}
    <p class="meta fv-how">${icon('lock', { size: 16 })}<span>Counted without names: a random number for each visit, never an account, an email, a name or an address, and nothing from a browser that asks not to be tracked.</span></p>`;
}

// ---- make a link ----
function linkHTML() {
  const v = V(), ps = (S.partners || []).slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!S.partnersLoaded) return v.perr ? notice('bad', 'circle-alert', 'The partners did not load. Check your connection and try again.', btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-fv': 'pretry' } }))
    : `<div class="fv-loading" aria-busy="true" aria-label="Loading the partners">${skeleton(1)}</div>`;
  const p = partnerBy(v.partner) || (ps.length === 1 ? ps[0] : null);
  if (p && v.partner !== p.slug) v.partner = p.slug;
  if (!ps.length) return `<section class="card fv-card fv-none" aria-label="Partners"><p>No partners yet. Add the first one, and its link and QR code appear here.</p>
    ${btn('New partner', { icon: 'plus', attrs: { 'data-fv': 'pnew', 'aria-haspopup': 'dialog' } })}</section>`;
  const url = p ? linkFor(p.slug, v.word) : '';
  return `<div class="fv-linkgrid"><section class="card fv-card">
    <div class="field"><span class="label" id="fv-pl">Partner or event</span>
      <div class="fv-prow">${pickerChip(p ? p.name : 'Choose one', { 'data-fv': 'pick', 'aria-haspopup': 'dialog', 'aria-labelledby': 'fv-pl fv-pickt' }, 'handshake').replace('<span>', '<span id="fv-pickt">')}
        ${p ? iconBtn('pencil', `Edit ${p.name}`, { 'data-fv': 'pedit', 'aria-haspopup': 'dialog' }) : ''}</div>
      ${p ? `<p class="fv-welcome">${p.welcome ? `<span class="sr">Welcome line: </span>“${esc(p.welcome)}”` : '<span class="muted">No welcome line. People arriving by the link see the usual first screen.</span>'}</p>` : ''}</div>
    <div class="field"><label for="fv-word">Campaign word <span class="is-opt">(optional)</span></label>
      <input id="fv-word" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="fall-flyer" value="${esc(v.word)}" aria-describedby="fv-word-h">
      <span class="help" id="fv-word-h">One word for this use of the link, like fall-flyer or health-fair, so two flyers can be told apart. Letters, numbers and dashes.</span></div>
    ${p ? `<div class="fv-urlbox"><span class="label" id="fv-ul">The link</span><p class="fv-url" id="fv-url" aria-labelledby="fv-ul">${esc(url)}</p>
      ${btn('Copy link', { icon: 'copy', attrs: { 'data-fv': 'copy' } })}</div>` : ''}
  </section>
  ${p ? `<section class="card fv-card fv-qrcard" aria-labelledby="fv-qh"><h2 id="fv-qh">QR code</h2>
    <p class="small muted">The same link, for a flyer or a poster. Test it with a phone before printing many.</p>
    <div class="fv-qrbox" id="fv-qrbox" role="img" aria-label="QR code for ${esc(url)}"><span class="meta">Drawing the code…</span></div>
    <div class="fv-qracts">${btn('Download', { kind: 'secondary', sm: true, icon: 'download', attrs: { 'data-fv': 'png' } })}${btn('Print', { kind: 'secondary', sm: true, attrs: { 'data-fv': 'print' } })}</div>
  </section>` : ''}</div>`;
}

// The QR code: drawn in the browser by qrcode-generator (MIT, from jsDelivr, loaded on first use), as SVG on the page and
// as a PNG to download. Medium error correction, with the four-module quiet zone scanners expect.
let qrLib = null;
const qrMatrix = async text => {
  qrLib ??= import(QR_LIB).then(m => m.default || m).catch(e => { qrLib = null; throw e; });
  const make = await qrLib, qr = make(0, 'M'); qr.addData(text, 'Byte'); qr.make();
  const n = qr.getModuleCount(); return { n, dark: (r, c) => qr.isDark(r, c) };
};
const qrSvg = ({ n, dark }, px) => {
  const q = 4, size = n + 2 * q; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (dark(r, c)) d += `M${c + q},${r + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
};
async function drawQr(root) {
  const box = root.querySelector('#fv-qrbox'), url = root.querySelector('#fv-url')?.textContent; if (!box || !url) return;
  box.dataset.for = url;
  try { const m = await qrMatrix(url); if (box.dataset.for !== url) return; box.innerHTML = qrSvg(m, 192); box.classList.add('drawn'); }
  catch { if (box.dataset.for === url) box.innerHTML = `<span class="small fv-qrerr">${icon('circle-alert')}The QR code could not be drawn. Copy the link instead, or reload the page to try again.</span>`; }
}
const fileBase = () => { const v = V(); return `hiphi-link-${v.partner}${v.word ? '-' + v.word : ''}`; };
async function downloadPng(url) {
  try {
    const m = await qrMatrix(url), q = 4, scale = Math.max(8, Math.floor(1200 / (m.n + 2 * q))), size = (m.n + 2 * q) * scale;
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, size, size); g.fillStyle = '#000';
    for (let r = 0; r < m.n; r++) for (let c = 0; c < m.n; c++) if (m.dark(r, c)) g.fillRect((c + q) * scale, (r + q) * scale, scale, scale);
    const blob = await new Promise(res => cv.toBlob(res, 'image/png')); if (!blob) throw new Error('no image');
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileBase() + '.png'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    toast('QR code downloaded.', { ok: true });
  } catch { toast('The QR code could not be made. Copy the link instead.', { err: true }); }
}
// Print: the code at 7cm with the link under it, in a frame of its own, so the rest of the page never prints.
async function printQr(url, p) {
  try {
    const m = await qrMatrix(url);
    const f = document.createElement('iframe'); f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'; document.body.appendChild(f);
    const doc = f.contentDocument;
    doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p?.name || 'HIPHI Bill Tracker')}</title><style>
      @page { margin: 18mm; } body { font: 14px/1.4 system-ui, sans-serif; color: #142B35; text-align: center; margin: 0; padding-top: 10mm; }
      svg { width: 70mm; height: 70mm; } .w { font-size: 18px; font-weight: 700; margin: 6mm 0 2mm; } .u { font-size: 11px; color: #344852; word-break: break-all; margin: 2mm auto 0; max-width: 150mm; }
      .b { margin-top: 8mm; font-size: 12px; color: #5F6F76; }</style></head><body>
      ${qrSvg(m, 265)}${p?.welcome ? `<p class="w">${esc(p.welcome)}</p>` : ''}<p class="u">${esc(url)}</p><p class="b">HIPHI Bill Tracker · Hawaiʻi Public Health Institute</p></body></html>`);
    doc.close();
    setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch { toast('Printing did not start. Download the code and print it instead.', { err: true }); } setTimeout(() => f.remove(), 60e3); }, 150);
  } catch { toast('The QR code could not be made. Copy the link instead.', { err: true }); }
}
// Copy at once (the tap is what lets the browser write the clipboard); if the browser refuses, the link in a sheet to
// copy by hand. Never window.prompt.
function copyLink(url) {
  const fallback = async () => {
    await afterClose();
    openSheet({ title: 'Copy the link', size: 'auto', body: `<div class="le-sheet"><p class="small">Select it all and copy it.</p><textarea class="le-copybox" readonly rows="3" aria-label="The link">${esc(url)}</textarea></div>`,
      wire: d => { const ta = d.querySelector('textarea'); ta.focus(); ta.select(); } });
  };
  try { navigator.clipboard.writeText(url).then(() => toast('Link copied.', { ok: true }), fallback); } catch { fallback(); }
}

// ---- partners: a name for the team, a name in the link, and the welcome line the public sees ----
function partnerForm(p = null) {
  let slugTouched = !!p;
  const body = `<div class="le-sheet fv-pform">
    <div class="field"><label for="fv-pname">Name</label><input id="fv-pname" maxlength="80" autocomplete="off" value="${esc(p?.name || '')}" placeholder="Keiki health fair" aria-describedby="fv-pname-h fv-pname-err">
      <span class="help" id="fv-pname-h">Who the link is for. Only the team sees it.</span><div id="fv-pname-err" role="alert"></div></div>
    <div class="field"><label for="fv-pslug">Name in the link</label>
      <input id="fv-pslug" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(p?.slug || '')}" ${p ? 'readonly aria-readonly="true"' : ''} aria-describedby="fv-pslug-h fv-pslug-err">
      <span class="help" id="fv-pslug-h">${p ? 'It cannot change: links already given out would stop counting under this partner.' : 'Goes in the link as ?via=… and is public. Letters, numbers and dashes. It cannot change later.'}</span><div id="fv-pslug-err" role="alert"></div></div>
    <div class="field"><label for="fv-pwel">Welcome line <span class="is-opt">(optional)</span></label><textarea id="fv-pwel" rows="2" maxlength="140" aria-describedby="fv-pwel-h" placeholder="Welcome, friends of the keiki health fair!">${esc(p?.welcome || '')}</textarea>
      <span class="help" id="fv-pwel-h">The first words people arriving by the link see. Public. <span id="fv-pwel-n">${(p?.welcome || '').length}</span> of 140.</span></div>
  </div>`;
  openSheet({ title: p ? `Edit ${esc(p.name)}` : 'New partner', size: 'auto', body,
    foot: btn(p ? 'Save changes' : 'Add partner', { icon: p ? 'check' : 'plus', attrs: { 'data-fvsave': '1' } }),
    wire: d => {
      const name = d.querySelector('#fv-pname'), slug = d.querySelector('#fv-pslug'), wel = d.querySelector('#fv-pwel'), go = d.querySelector('[data-fvsave]');
      if (!p) name.focus();
      const bad = (el, msg) => { const err = d.querySelector(`#${el.id}-err`); el.setAttribute('aria-invalid', 'true'); err.innerHTML = `<span class="err">${icon('circle-alert')}${esc(msg)}</span>`; el.focus(); };
      const clear = el => { el.removeAttribute('aria-invalid'); const err = d.querySelector(`#${el.id}-err`); if (err) err.innerHTML = ''; };
      name.oninput = () => { clear(name); if (!slugTouched) { slug.value = slugOf(name.value); clear(slug); } };
      if (!p) slug.oninput = () => { slugTouched = true; const v = slug.value, w = slugOf(v); if (w !== v && !/-$/.test(v)) slug.value = w; clear(slug); };
      wel.oninput = () => { d.querySelector('#fv-pwel-n').textContent = wel.value.length; };
      const save = async () => {
        const nm = name.value.trim().replace(/\s+/g, ' '), sl = p ? p.slug : slugOf(slug.value), w = wel.value.trim().replace(/\s+/g, ' ');
        if (nm.length < 2) return bad(name, 'Give the partner a name.');
        if (!p) {
          if (!/^[a-z0-9-]{2,40}$/.test(sl)) return bad(slug, 'Use at least two letters or numbers.');
          if (partnerBy(sl)) return bad(slug, `“${sl}” is already in the link of ${partnerBy(sl).name}. Pick another.`);
        }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          if (p) {
            const before = { name: p.name, welcome: p.welcome };
            await DB.updatePartner(p.slug, { name: nm, welcome: w || null });
            await closeSheet({ silent: true }); redraw('[data-fv="pedit"]');
            toast(`Saved ${nm}.`, { ok: true, undo: async () => { await DB.updatePartner(p.slug, before); redraw('[data-fv="pedit"]'); } });
          } else {
            await DB.addPartner({ slug: sl, name: nm, welcome: w || null });
            V().partner = sl;
            await closeSheet({ silent: true }); redraw('#fv-word');
            toast(`Added ${nm}. Its link is ready.`, { ok: true });
          }
        } catch (e) {
          go.removeAttribute('aria-busy'); go.disabled = false;
          if (/duplicate|23505|already exists/i.test(String(e?.message || e?.code || e))) bad(slug, `“${sl}” is already taken. Pick another.`); else toast(e, { err: true });
        }
      };
      go.onclick = save;
      [name, slug].forEach(el => el.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); save(); } });
    } });
}

// ---- the two screens ----
// First visit: the numbers, with the way to Make a link under its top line. Make a link: a focused form (narrow on a
// desktop), the link and its QR code side by side from 900px. Both remember the period, the partner and the campaign word
// for the rest of the visit to the app (B-6).
export function renderFirstVisit(route) {
  const v = V();
  wantPartners();   // the numbers name a partner's visits by its name, and the link needs them
  if (fvView(route) === 'links') return `<div class="le-page fv-page fv-links">
    <a class="le-deskback" href="${FV_HREF}" data-back>${icon('chevron-left')}<span>First visit</span></a>
    <header class="fv-head"><h1>Make a link</h1>
      <p class="le-lede">For a partner, an event or a flyer. People who arrive by it see its welcome line first, and the first visit’s numbers count them under its name.</p></header>
    ${linkHTML()}
  </div>`;
  load(v.weeks);
  return `<div class="le-page fv-page">
    <a class="le-deskback" href="#/outreach/issues" data-back>${icon('chevron-left')}<span>Issues</span></a>
    <header class="fv-head fv-nhead"><div class="fv-hmain"><h1>First visit</h1>
      <p class="le-lede">How far newcomers get through their first visit on the public page, by where they came from.</p>
      <a class="fv-golink" href="${LINKS_HREF}">${icon('link')}<span>Make a link for a partner or an event</span></a></div>
      <div class="fv-controls">${segmented('fvw', PERIODS, v.weeks, 'How far back')}</div></header>
    ${numbersHTML()}
  </div>`;
}
export function wireFirstVisit(route, root) {
  const v = V();
  root.querySelectorAll('[data-seg="fvw"]').forEach(el => el.onclick = () => { v.weeks = el.dataset.val; load(v.weeks); redraw(`[data-seg="fvw"][data-val="${v.weeks}"]`); });
  root.querySelector('[data-fv="retry"]')?.addEventListener('click', () => { v.err = ''; load(v.weeks, { force: true }); redraw(); });
  root.querySelector('[data-fv="pretry"]')?.addEventListener('click', () => { wantPartners({ force: true }); redraw(); });
  root.querySelectorAll('[data-fv="pnew"]').forEach(el => el.onclick = () => partnerForm());
  root.querySelector('[data-fv="pedit"]')?.addEventListener('click', () => { const p = partnerBy(v.partner); if (p) partnerForm(p); });
  root.querySelector('[data-fv="pick"]')?.addEventListener('click', () => pickerSheet({ title: 'Partner or event', value: v.partner,
    options: [...(S.partners || []).slice().sort((a, b) => a.name.localeCompare(b.name)).map(p => [p.slug, p.name, 'handshake', `?via=${p.slug}`]), ['__new', 'New partner…', 'plus']],
    onPick: async val => { if (val === '__new') { await afterClose(); partnerForm(); return; } v.partner = val; redraw('[data-fv="pick"]'); } }));
  const word = root.querySelector('#fv-word');
  if (word) word.oninput = () => {
    const w = wordOf(word.value); if (w !== word.value) { word.value = w; }
    v.word = w.replace(/^-+|-+$/g, '');
    const p = partnerBy(v.partner), out = root.querySelector('#fv-url'); if (!p || !out) return;
    const url = linkFor(p.slug, v.word); out.textContent = url;
    root.querySelector('#fv-qrbox')?.setAttribute('aria-label', `QR code for ${url}`);
    clearTimeout(wireFirstVisit.t); wireFirstVisit.t = setTimeout(() => drawQr(root), 250);
  };
  const url = () => root.querySelector('#fv-url')?.textContent || '';
  root.querySelector('[data-fv="copy"]')?.addEventListener('click', () => copyLink(url()));
  root.querySelector('[data-fv="png"]')?.addEventListener('click', () => downloadPng(url()));
  root.querySelector('[data-fv="print"]')?.addEventListener('click', () => printQr(url(), partnerBy(v.partner)));
  drawQr(root);
}
