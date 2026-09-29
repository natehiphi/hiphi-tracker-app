// Help as ready-made conversations (R-075, Nate 9/29; the approved "Concept 3" style from R-062).
//   #/help         the questions, grouped under plain headings, with a search over every question and answer; then the
//                  three short lessons, where to get a hand, and (with a mouse) the keyboard shortcuts
//   #/help/<slug>  one conversation: the question as a grey bubble, HIPHI's answer beside the HIPHI mark (with a small
//                  drawing where it helps), and the NEXT question as the one button. At the end: "You might also ask".
// No typing box, on purpose: this is not a chatbot and must not look like one. The words live in pub/talk-data.js so
// staff can edit them without touching this file. Asking the next question adds to the page instead of changing the
// address, so Back always returns to the list (B-4) and a link to #/help/<slug> always opens at its first answer.
// more.js loads this module the first time Help is opened, so the rest of the tracker never waits for it.
import { S, app, esc, icon, sessionInfo, HST } from './core.js';
import { btn, row } from './ui.js';
import { MARK } from './art.js';
import { GROUPS, TALKS } from './talk-data.js';

const BY = new Map(TALKS.map(t => [t.slug, t]));
const GROUP = new Map(GROUPS.map(g => [g.key, g]));
const PAR = { tel: 'tel:+18085870478', text: '(808) 587-0478' };
const EMAIL = 'contact@hiphi.org';
// This visit's state: which conversation, how many of its questions have been asked, and what was typed in the search.
const T = { slug: '', n: 1, q: '' };
const $ = s => document.querySelector(s);
const reduce = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---- the words: **bold**, [label](href), {nextOpen} ----
function nextOpen() {
  const n = sessionInfo().nextOpen;
  if (!n) return 'the third Wednesday in January';
  return new Date(n + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmt(s) {
  return esc(String(s).replace(/\{nextOpen\}/g, nextOpen()))
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => /^https?:/.test(href)
      ? `<a href="${href}" target="_blank" rel="noopener">${label}</a>` : `<a href="${href}">${label}</a>`);
}
const paras = a => (Array.isArray(a) ? a : [a]);
const plain = s => String(s).replace(/\{nextOpen\}/g, 'January').replace(/\*\*|\[|\]\([^)]*\)/g, '');
const haystack = t => [t.title, ...t.turns.flatMap(x => [x.q, ...paras(x.a)])].map(plain).join(' ').toLowerCase();
const HAY = new Map(TALKS.map(t => [t.slug, haystack(t)]));

// ---------------- the drawings ----------------
// Flat colour from the tokens, one silhouette per person (a head and a body in one colour, no outline per part), words
// on 13/14/16 only (the public type sizes). Each is decoration beside words that already say it (aria-hidden, A-10).
const svg = (h, inner, cls = '') => `<svg class="tk-d${cls ? ' ' + cls : ''}" viewBox="0 0 300 ${h}" aria-hidden="true" focusable="false">${inner}</svg>`;
const txt = (x, y, s, { size = 13, fill = 'var(--n700)', anchor = 'middle', w = 700 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${w !== 700 ? ` font-weight="${w}"` : ''}>${s}</text>`;
const person = (cx, base, r, fill) => `<g fill="${fill}"><circle cx="${cx}" cy="${base - r * 3.3}" r="${r}"/><path d="M${cx - r * 1.9} ${base} C${cx - r * 1.9} ${base - r * 2.5} ${cx + r * 1.9} ${base - r * 2.5} ${cx + r * 1.9} ${base} Z"/></g>`;
const doc = (x, y, w, h, fill = 'var(--n100)', lines = 'var(--n300)') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}"/>`
  + [0.34, 0.52, 0.7].map((f, i) => `<rect x="${x + 8}" y="${y + h * f}" width="${w - 16 - (i === 2 ? 10 : 0)}" height="3" rx="1.5" fill="${lines}"/>`).join('');
const table = (x, y, w) => `<rect x="${x}" y="${y}" width="${w}" height="10" rx="3" fill="var(--p800)"/>`;

// The bill's path: committees and a vote on each side, then the Governor. A mark names one deadline on the first side.
// Three committees on the first side (pieces 0-24, 27-50, 53-76): Triple filing = through the first, Lateral = through all
// but the last, Decking = through all three.
const MARKS = { triple: [25.5, 'Triple filing'], lateral: [51.5, 'Lateral'], decking: [78, 'Decking'], crossover: [117, 'Crossover'] };
function path(mark) {
  const seg = (x, w, c) => `<rect x="${x}" y="24" width="${w}" height="8" rx="4" fill="${c}"/>`;
  const m = MARKS[mark];
  const lit = x => !m ? 'var(--p700)' : x < m[0] ? 'var(--p700)' : 'var(--n200)';
  const parts = [seg(0, 76, lit(0)), seg(80, 30, lit(80)), seg(124, 76, lit(124)), seg(204, 30, lit(204)), seg(248, 52, lit(248))];
  // With three committees on the first side, the first leg is drawn as three short pieces, so the mark can point at one.
  const cuts = m && mark !== 'crossover' ? `<rect x="24" y="22" width="3" height="12" fill="var(--n0)"/><rect x="50" y="22" width="3" height="12" fill="var(--n0)"/>` : '';
  const pin = m ? `<circle cx="${m[0]}" cy="28" r="9" fill="var(--n0)" stroke="var(--p700)" stroke-width="3"/><circle cx="${m[0]}" cy="28" r="3.5" fill="var(--p700)"/>
    ${txt(Math.min(Math.max(m[0], 44), 256), 58, m[1], { size: 14, fill: 'var(--p800)' })}` : '';
  // Without a mark there is nothing under the line, so the House and Senate brackets move up.
  const y = m ? 68 : 44;
  return svg(y + 28, `${txt(38, 14, 'Committees')}${txt(95, 14, 'Vote')}${txt(162, 14, 'Committees')}${txt(219, 14, 'Vote')}${txt(300, 14, 'Governor', { anchor: 'end' })}
    ${parts.join('')}${cuts}${pin}
    <path d="M2 ${y}v4h108v-4" fill="none" stroke="var(--n300)" stroke-width="1.5"/>${txt(56, y + 22, 'House', { fill: 'var(--n500)' })}
    <path d="M124 ${y}v4h110v-4" fill="none" stroke="var(--n300)" stroke-width="1.5"/>${txt(179, y + 22, 'Senate', { fill: 'var(--n500)' })}`);
}

const ART = {
  path: () => path(''),
  chambers: () => {
    const dots = (x0, n, cols, fill) => Array.from({ length: n }, (_, i) => `<circle cx="${x0 + (i % cols) * 11}" cy="${14 + Math.floor(i / cols) * 11}" r="4" fill="${fill}"/>`).join('');
    return svg(92, `${dots(6, 51, 13, 'var(--p700)')}${dots(196, 25, 5, 'var(--p900)')}
      ${txt(72, 84, 'House: 51', { size: 14, fill: 'var(--n900)' })}${txt(218, 84, 'Senate: 25', { size: 14, fill: 'var(--n900)' })}`);
  },
  session: () => {
    // 2026's real pattern: opening day, each deadline, sine die (session_deadlines), on a January-to-May line.
    const X = d => 10 + (d - 1) / 151 * 280;
    const days = [42, 51, 65, 71, 78, 89, 100, 106, 119];
    return svg(78, `<rect x="${X(21)}" y="30" width="${X(128) - X(21)}" height="8" rx="4" fill="var(--p100)"/>
      ${days.map(d => `<circle cx="${X(d)}" cy="34" r="4" fill="var(--p700)"/>`).join('')}
      <circle cx="${X(21)}" cy="34" r="6" fill="var(--p900)"/><circle cx="${X(128)}" cy="34" r="6" fill="var(--p900)"/>
      ${txt(X(21), 18, 'Opens')}${txt(X(71), 18, 'Crossover', { fill: 'var(--p800)' })}${txt(X(128), 18, 'Ends')}
      ${[[38, 'Jan'], [93, 'Feb'], [148, 'Mar'], [205, 'Apr'], [261, 'May']].map(([x, m]) => txt(x, 66, m, { fill: 'var(--n500)', w: 400 })).join('')}
      ${[10, 67, 119, 178, 233, 290].map(x => `<rect x="${x - .75}" y="46" width="1.5" height="6" fill="var(--n300)"/>`).join('')}`);
  },
  funnel: () => svg(72, `${Array.from({ length: 10 }, (_, i) => { const x = 8 + i * 29; const on = i === 6;
      return `<rect x="${x}" y="6" width="22" height="30" rx="3" fill="${on ? 'var(--p700)' : 'var(--n200)'}"/><rect x="${x + 5}" y="16" width="12" height="2.5" rx="1" fill="var(--n0)"/><rect x="${x + 5}" y="23" width="9" height="2.5" rx="1" fill="var(--n0)"/>`; }).join('')}
    ${txt(150, 62, 'About 1 in 10 becomes law', { size: 14, fill: 'var(--n900)' })}`),
  committee: () => svg(96, `${person(78, 58, 8, 'var(--p400)')}${person(114, 58, 8, 'var(--p700)')}${person(150, 58, 9, 'var(--p900)')}${person(186, 58, 8, 'var(--p700)')}${person(222, 58, 8, 'var(--p400)')}
    ${table(56, 54, 188)}${txt(150, 86, 'The chair leads', { fill: 'var(--p800)' })}<path d="M150 66v6" stroke="var(--p800)" stroke-width="1.5"/>`),
  hearing: () => svg(100, `${person(186, 50, 7, 'var(--p700)')}${person(220, 50, 8, 'var(--p900)')}${person(254, 50, 7, 'var(--p700)')}${table(168, 46, 104)}
    ${person(78, 70, 8, 'var(--p500)')}<rect x="64" y="58" width="28" height="18" rx="3" fill="var(--p800)"/>
    ${person(16, 76, 5, 'var(--n300)')}${person(34, 76, 5, 'var(--n300)')}
    ${txt(78, 94, 'You')}${txt(220, 94, 'Committee')}`),
  letter: () => svg(84, `<g transform="translate(24 12)">${doc(0, 0, 44, 54, 'var(--p50)', 'var(--p300)')}</g>
    <path d="M84 40h70" stroke="var(--p400)" stroke-width="2.5" stroke-dasharray="2 7" stroke-linecap="round"/>
    ${person(196, 46, 7, 'var(--p700)')}${person(228, 46, 8, 'var(--p900)')}${person(260, 46, 7, 'var(--p700)')}${table(178, 42, 100)}
    ${txt(46, 80, 'Testimony')}${txt(228, 80, 'Committee')}`),
  deadline: () => svg(84, `<rect x="10" y="38" width="280" height="3" rx="1.5" fill="var(--n200)"/>
    <rect x="170" y="36" width="100" height="7" rx="3.5" fill="var(--p100)"/>
    <circle cx="40" cy="39.5" r="6" fill="var(--n300)"/><circle cx="170" cy="39.5" r="7" fill="var(--p700)"/><circle cx="270" cy="39.5" r="7" fill="var(--p900)"/>
    ${txt(8, 22, 'Notice posted', { anchor: 'start', fill: 'var(--n500)' })}${txt(170, 22, 'Testimony due', { fill: 'var(--p800)' })}${txt(292, 22, 'Hearing', { anchor: 'end', fill: 'var(--n900)' })}
    <path d="M170 52v4h100v-4" fill="none" stroke="var(--n300)" stroke-width="1.5"/>${txt(220, 74, '24 or 48 hours', { fill: 'var(--n700)' })}`),
  greenbox: () => svg(92, `<rect x="40" y="4" width="220" height="84" rx="8" fill="var(--n100)"/><rect x="40" y="4" width="220" height="16" rx="8" fill="var(--n200)"/><rect x="40" y="14" width="220" height="6" fill="var(--n200)"/>
    <rect x="58" y="32" width="184" height="40" rx="6" fill="var(--ok-wash)"/><rect x="58" y="32" width="6" height="40" rx="3" fill="var(--ok-text)"/>
    <circle cx="86" cy="52" r="10" fill="var(--ok-text)"/><path d="M81 52.5l3.5 3.5 6.5-7" fill="none" stroke="var(--n0)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="104" y="45" width="110" height="4" rx="2" fill="var(--ok-text)" opacity=".55"/><rect x="104" y="55" width="80" height="4" rx="2" fill="var(--ok-text)" opacity=".35"/>`),
  conference: () => svg(96, `${person(40, 56, 7, 'var(--p700)')}${person(70, 56, 7, 'var(--p700)')}${person(230, 56, 7, 'var(--p900)')}${person(260, 56, 7, 'var(--p900)')}
    ${table(20, 52, 260)}<g transform="translate(132 16)">${doc(0, 0, 36, 44, 'var(--p50)', 'var(--p300)')}</g>
    ${txt(55, 84, 'House')}${txt(150, 84, 'One version', { fill: 'var(--p800)' })}${txt(245, 84, 'Senate')}`),
  governor: () => svg(92, `<g transform="translate(34 10)">${doc(0, 0, 44, 54)}</g><circle cx="74" cy="60" r="12" fill="var(--ok-text)"/><path d="M68 60.5l4 4 7-8" fill="none" stroke="var(--n0)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${person(150, 62, 10, 'var(--p900)')}
    <g transform="translate(222 10)">${doc(0, 0, 44, 54)}</g><circle cx="262" cy="60" r="12" fill="var(--n500)"/><path d="M257 55l10 10M267 55l-10 10" stroke="var(--n0)" stroke-width="2.5" stroke-linecap="round"/>
    ${txt(56, 88, 'Sign', { size: 14, fill: 'var(--n900)' })}${txt(150, 88, 'Governor', { fill: 'var(--n500)' })}${txt(244, 88, 'Veto', { size: 14, fill: 'var(--n900)' })}`),
  deferred: () => svg(88, `<g transform="translate(112 4)">${doc(0, 0, 48, 58)}</g><circle cx="170" cy="50" r="14" fill="var(--n500)"/>
    <rect x="164" y="43" width="4" height="14" rx="1.5" fill="var(--n0)"/><rect x="172" y="43" width="4" height="14" rx="1.5" fill="var(--n0)"/>
    ${txt(150, 84, 'On hold', { size: 14, fill: 'var(--n900)' })}`),
  hbsb: () => svg(88, `<g transform="translate(62 4)"><rect width="56" height="62" rx="4" fill="var(--n100)"/><rect width="56" height="22" rx="4" fill="var(--p700)"/><rect y="14" width="56" height="8" fill="var(--p700)"/>${txt(28, 17, 'HB', { size: 14, fill: 'var(--n0)' })}
      <rect x="9" y="32" width="38" height="3" rx="1.5" fill="var(--n300)"/><rect x="9" y="41" width="30" height="3" rx="1.5" fill="var(--n300)"/></g>
    <g transform="translate(182 4)"><rect width="56" height="62" rx="4" fill="var(--n100)"/><rect width="56" height="22" rx="4" fill="var(--p900)"/><rect y="14" width="56" height="8" fill="var(--p900)"/>${txt(28, 17, 'SB', { size: 14, fill: 'var(--n0)' })}
      <rect x="9" y="32" width="38" height="3" rx="1.5" fill="var(--n300)"/><rect x="9" y="41" width="30" height="3" rx="1.5" fill="var(--n300)"/></g>
    ${txt(90, 84, 'House Bill')}${txt(210, 84, 'Senate Bill')}`),
  twins: () => svg(88, `<g transform="translate(62 4)"><rect width="56" height="62" rx="4" fill="var(--n100)"/><rect width="56" height="22" rx="4" fill="var(--p700)"/><rect y="14" width="56" height="8" fill="var(--p700)"/>${txt(28, 17, 'HB', { size: 14, fill: 'var(--n0)' })}
      <rect x="9" y="32" width="38" height="3" rx="1.5" fill="var(--p300)"/><rect x="9" y="41" width="30" height="3" rx="1.5" fill="var(--p300)"/><rect x="9" y="50" width="34" height="3" rx="1.5" fill="var(--p300)"/></g>
    <g transform="translate(182 4)"><rect width="56" height="62" rx="4" fill="var(--n100)"/><rect width="56" height="22" rx="4" fill="var(--p900)"/><rect y="14" width="56" height="8" fill="var(--p900)"/>${txt(28, 17, 'SB', { size: 14, fill: 'var(--n0)' })}
      <rect x="9" y="32" width="38" height="3" rx="1.5" fill="var(--p300)"/><rect x="9" y="41" width="30" height="3" rx="1.5" fill="var(--p300)"/><rect x="9" y="50" width="34" height="3" rx="1.5" fill="var(--p300)"/></g>
    <rect x="132" y="30" width="36" height="3" rx="1.5" fill="var(--p400)"/><rect x="132" y="38" width="36" height="3" rx="1.5" fill="var(--p400)"/>
    ${txt(150, 84, 'Same idea, both sides', { fill: 'var(--n700)' })}`),
  drafts: () => {
    const D = [['HB', 'var(--n100)', 'var(--n900)'], ['HD1', 'var(--p100)', 'var(--p900)'], ['HD2', 'var(--p100)', 'var(--p900)'], ['SD1', 'var(--p300)', 'var(--p900)'], ['CD1', 'var(--p700)', 'var(--n0)']];
    return svg(80, `${D.map(([l, f, c], i) => `<rect x="${6 + i * 59}" y="6" width="50" height="44" rx="4" fill="${f}"/>${txt(31 + i * 59, 33, l, { size: 14, fill: c })}`).join('')}
      <path d="M6 58v4h109v-4" fill="none" stroke="var(--n300)" stroke-width="1.5"/>${txt(60, 76, 'House', { fill: 'var(--n500)' })}
      ${txt(208, 76, 'Senate', { fill: 'var(--n500)' })}${txt(266, 76, 'Both', { fill: 'var(--n500)' })}`);
  },
  follow: () => svg(96, `<rect x="10" y="18" width="110" height="46" rx="10" fill="var(--p50)"/>
    <path d="M34 28l3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1z" fill="var(--p700)"/>
    <rect x="52" y="34" width="54" height="4" rx="2" fill="var(--p300)"/><rect x="52" y="44" width="40" height="4" rx="2" fill="var(--p300)"/>
    ${[6, 30, 54].map(y => `<path d="M122 41 C150 41 150 ${y + 11} 176 ${y + 11}" fill="none" stroke="var(--p300)" stroke-width="2"/><g transform="translate(180 ${y})">${doc(0, 0, 40, 22)}</g>`).join('')}
    ${txt(65, 90, 'An issue')}${txt(200, 92, 'Its bills')}`),
  districts: () => svg(96, `<path d="M150 22l24 20v26h-48V42z" fill="var(--p700)"/><rect x="144" y="52" width="12" height="16" fill="var(--n0)"/>
    ${person(52, 64, 9, 'var(--p900)')}${person(248, 64, 9, 'var(--p500)')}
    <path d="M70 48h48M182 48h48" stroke="var(--p300)" stroke-width="2.5" stroke-dasharray="2 6" stroke-linecap="round"/>
    ${txt(52, 88, 'Senator')}${txt(150, 88, 'Your home', { fill: 'var(--p800)' })}${txt(248, 88, 'Representative')}`),
  zoom: () => svg(96, `${person(70, 56, 9, 'var(--p700)')}<rect x="52" y="46" width="36" height="24" rx="3" fill="var(--p800)"/>
    <rect x="178" y="14" width="84" height="54" rx="5" fill="var(--p900)"/><rect x="184" y="20" width="72" height="42" rx="2" fill="var(--p100)"/>${person(220, 62, 7, 'var(--p700)')}
    <rect x="168" y="68" width="104" height="6" rx="3" fill="var(--p800)"/>
    ${txt(70, 90, 'In person')}${txt(220, 90, 'Zoom')}`),
};
function art(key) {
  if (!key) return '';
  const [k, mark] = String(key).split(':');
  if (k === 'path') return path(mark || '');
  return ART[k] ? ART[k]() : '';
}

// ---------------- the list ----------------
function listView() {
  const keys = !!window.matchMedia?.('(pointer: fine)').matches;
  return `<div class="tk tk-list">
    <header class="pagehead"><h1 class="hero">Help</h1>
      <p class="lede">Questions people ask about the Legislature, testimony and this tracker. Tap one for a short answer in plain words.</p></header>
    <div class="tk-search">
      <label class="sr" for="tk-q">Search the questions</label>
      ${icon('search', { cls: 'tk-sic' })}<input id="tk-q" class="input" type="search" placeholder="Search: deadline, Zoom, deferred" autocomplete="off" enterkeyhint="search" value="${esc(T.q)}">
    </div>
    <p class="sr" role="status" id="tk-count"></p>
    <div class="tk-groups">
      ${GROUPS.map(g => { const list = TALKS.filter(t => t.group === g.key); if (!list.length) return '';
        return `<section class="tk-group" data-tkgroup="${g.key}" aria-labelledby="tk-g-${g.key}">
          <h2 id="tk-g-${g.key}"><span class="tk-gic">${icon(g.icon)}</span>${esc(g.title)}</h2>
          <nav class="rows" aria-labelledby="tk-g-${g.key}">${list.map(t => row({ title: esc(t.title), href: '#/help/' + t.slug, attrs: { 'data-tkrow': t.slug } })).join('')}</nav>
        </section>`; }).join('')}
    </div>
    <div class="tk-none" hidden><p class="strong">No questions match that.</p><p>Try one word, like hearing or deadline. Or ask a person below.</p></div>
    <section class="tk-more" aria-labelledby="tk-lx-t">
      <h2 id="tk-lx-t">Short lessons, with pictures</h2>
      <nav class="rows" aria-labelledby="tk-lx-t">
        ${row({ lead: 'route', title: 'How a bill becomes law, drawn', sub: 'The story of one bill, about a minute', href: '#/learn/story' })}
        ${row({ lead: 'file-text', title: 'Reading a bill', sub: 'About a minute', href: '#/learn/bill' })}
        ${row({ lead: 'calendar-days', title: 'The session, January to May', sub: 'About a minute', href: '#/learn/session' })}
        ${row({ lead: 'gavel', title: 'What a hearing is', sub: 'About a minute', href: '#/learn/hearing' })}
      </nav>
    </section>
    <section class="tk-more" aria-labelledby="tk-hand-t">
      <h2 id="tk-hand-t">Need a hand?</h2>
      <div class="rows">
        ${row({ lead: 'phone', title: 'Call the Public Access Room', sub: `${PAR.text} · Free help with testifying, from the Legislature’s own staff`, href: PAR.tel, chevron: false })}
        ${row({ lead: 'mail', title: 'Email HIPHI', sub: EMAIL, href: `mailto:${EMAIL}`, chevron: false })}
      </div>
    </section>
    ${keys ? `<section class="tk-more" aria-labelledby="tk-keys-t">
      <h2 id="tk-keys-t">Keyboard shortcuts</h2>
      <div class="card tk-keys">
        <div><kbd>/</kbd><span>Search issues and bills</span></div>
        <div><kbd>?</kbd><span>Open this page</span></div>
        <div><kbd>Esc</kbd><span>Close the testimony helper</span></div>
      </div>
      <p class="small muted tk-after">Shortcuts are off while you type in a box.</p>
    </section>` : ''}
  </div>`;
}
// Every word typed must appear somewhere in the conversation (its questions and its answers).
function filter(q) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  let shown = 0;
  document.querySelectorAll('[data-tkrow]').forEach(a => { const hit = words.every(w => HAY.get(a.dataset.tkrow).includes(w)); a.hidden = !hit; if (hit) shown++; });
  document.querySelectorAll('[data-tkgroup]').forEach(s => { s.hidden = !s.querySelector('[data-tkrow]:not([hidden])'); });
  const none = $('.tk-none'); if (none) none.hidden = shown > 0;
  const c = $('#tk-count'); if (c) c.textContent = words.length ? (shown ? `${shown} question${shown === 1 ? '' : 's'} found` : 'No questions match') : '';
}
function wireList() {
  const inp = $('#tk-q');
  if (!inp) return;
  if (T.q) filter(T.q);
  inp.oninput = () => { T.q = inp.value; filter(T.q); };
  inp.onkeydown = e => { if (e.key === 'Escape' && inp.value) { e.stopPropagation(); inp.value = ''; T.q = ''; filter(''); } };
}

// ---------------- one conversation ----------------
const turnHTML = (t, i, fresh = false) => { const x = t.turns[i], p = paras(x.a), H = i === 0 ? 'h1' : 'h2';
  return `<div class="tk-turn${fresh ? ' tk-new' : ''}" data-tkturn="${i}">
    <${H} class="tk-q" tabindex="-1">${fmt(x.q)}</${H}>
    <div class="tk-a"><span class="tk-av" aria-hidden="true">${MARK}</span><div class="tk-b">
      <p>${fmt(p[0])}</p>${art(x.art)}${p.slice(1).map(s => `<p>${fmt(s)}</p>`).join('')}
    </div></div>
  </div>`; };
function nextHTML(t) {
  const more = T.n < t.turns.length;
  const back = `<a class="btn text tk-else" href="#/help" data-back>${icon('arrow-left')}<span>Ask something else</span></a>`;
  if (more) return `<div class="tk-reply">
      <button type="button" class="btn primary tk-ask" data-tknext>${fmt(t.turns[T.n].q)}</button>
      ${back}
    </div>`;
  const rel = (t.related || []).map(s => BY.get(s)).filter(Boolean).slice(0, 3);
  return `<div class="tk-end">
      ${t.act ? `<div class="tk-act">${btn(t.act.label, { kind: 'primary', icon: t.act.icon, href: t.act.href })}</div>` : ''}
      ${rel.length ? `<h2 class="tk-endh" id="tk-rel">You might also ask</h2>
        <nav class="rows" aria-labelledby="tk-rel">${rel.map(r => row({ title: esc(r.title), href: '#/help/' + r.slug })).join('')}</nav>` : ''}
      ${back}
    </div>`;
}
function convView(t) {
  const g = GROUP.get(t.group);
  return `<div class="tk tk-conv" data-tkslug="${esc(t.slug)}">
    <a class="btn text tk-back" href="#/help" data-back>${icon('arrow-left')}<span>All questions</span></a>
    ${g ? `<p class="tk-eyebrow">${esc(g.title)}</p>` : ''}
    <div class="tk-thread">${Array.from({ length: T.n }, (_, i) => turnHTML(t, i)).join('')}</div>
    <div class="tk-next">${nextHTML(t)}</div>
  </div>`;
}
function wireConv(t) {
  const b = $('[data-tknext]');
  if (!b) return;
  b.onclick = () => {
    if (T.n >= t.turns.length) return;
    const i = T.n++;
    $('.tk-thread').insertAdjacentHTML('beforeend', turnHTML(t, i, !reduce()));
    const nx = $('.tk-next'); nx.innerHTML = nextHTML(t);
    // The new links ("Ask something else", the related rows) need the frame's in-app click handling; a redraw of the
    // same page would give it to them, but also redraw every drawing, so hand the links to the router directly.
    nx.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      const to = a.getAttribute('href'), prev = history.state?.prev;
      if (a.hasAttribute('data-back') && prev && prev.split('?')[0] === to) history.back();
      else app.go(to, a.hasAttribute('data-back') ? { replace: true } : {});
    }));
    wireConv(t);
    // Screen readers land on the question just asked and read on into its answer; eyes follow it to the top.
    const turn = document.querySelector(`[data-tkturn="${i}"]`), h = turn?.querySelector('.tk-q');
    h?.focus({ preventScroll: true });
    turn?.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
  };
}

// ---------------- the screen (more.js hands #/help here) ----------------
export function view(route) {
  const t = BY.get(route.slug || '');
  if (!t) return listView();
  // Opened from somewhere else: start at the first answer. A redraw of the same conversation keeps what was asked.
  if (T.slug !== t.slug || !document.querySelector(`#main .tk-conv[data-tkslug="${CSS.escape(t.slug)}"]`)) { T.slug = t.slug; T.n = 1; }
  return convView(t);
}
export function wire(route) {
  const t = BY.get(route.slug || '');
  if (route.slug && !t) { history.replaceState(history.state, '', '#/help'); return wireList(); }   // an old or mistyped question: the list
  if (!t) { T.slug = ''; return wireList(); }
  wireConv(t);
}
export const title = route => BY.get(route.slug || '')?.title || 'Help';
export { TALKS, GROUPS };
