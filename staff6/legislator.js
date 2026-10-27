// Staff v6 · one legislator (#/legislator/:id, ?from=HB1562 | ask | holding | everyone; R-336 spec 6, V23; F145-F149).
// The page leads with the ask (V23, A-1): the name and district, then Email · Call · Log a talk. The one filled button is
// the step the person came to take: on a chair they have open asks with, the approved chair email for those bills, to this
// chair alone and named by bill ("Email about HB 1563 and HB 756"); otherwise Log a talk (A-3, spec 4). Then Asks and
// talks, newest first (v5 had them about 1,600px down; a stance's note shows there too, so what a legislator said is in one
// list). Then, for a chair, "Waiting on them for a hearing": our bills in their committee with no hearing yet, the viewer's
// own first and never folded (spec 7.3; other people's asks past the fifth wait behind Show all), each in the same words
// as Who to ask (holding.js chairLine). Then Our bills in their
// committees, each with where it stands and "Mark where they stand" (pathway.js's stance sheet: stance, note, who on our team
// knows them). Opened from a bill (?from=HB1562) that bill comes first, marked. Then, behind R-335's practice gate
// (profile.js PROFILES), the Profile: the sections someone has written in, and one "Add what we know" card for the empty
// ones. Then the reference: bills they introduced, their committees, and how to reach the office. One column at every
// width, so the order is the same on a phone and a laptop.
// The phone number: on a touch screen "Call" dials; with a mouse the number shows with Copy (a laptop cannot dial, and a
// Call link hides the number). Senators have no number in the directory, so no button that cannot work is drawn.
// Asks and talks are conversation.js's list and sheet (filed by issue, so a talk logged here also shows on the issue and on
// its bills); a chair ask recorded anywhere is one of them. Log a talk from a chair's page offers "This was an ask for a
// hearing" with their bills to tick (V24), and, on the practice copy, "Add a note instead" (R-335), so there is one door
// for writing down what happened.
import { S, DB, esc, hooks } from './data.js';
import { stopOf, stanceOf, legById, legsForSponsors, codesOf, diedish, hearingAhead, billByRef, billRoute, chairIdsOf, hstDayOf } from './model.js';
import { icon, btn, iconBtn, empty, toast } from './ui.js';
import { showAllBtn } from './ui.js';
import { photo, legName, shortName, seatsOf, roleWord, legMail, openStance, wireLinks, STANCE_WORD, STANCE_ICON } from './pathway.js';
import { ourBill, islandFor } from './legislators.js';
import { logConversation, convListHTML, wireConvList, withOthers, fetchOthers, convCount } from './conversation.js';
import { PROFILES, profileHTML, profileTipHTML, wireProfile } from './profile.js';   // R-335 (practice copy)
import { billRow, whereWords, numWords, nw, sayWords as billSay } from './steps.js';
import { committeeName } from './steps.js';
import { chairLine, chairMailFor, chairEmail, replyBtn, byChairOrder } from './holding.js';

const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const FROM_TAB = { ask: ['#/legislators?view=ask', 'Who to ask'], holding: ['#/legislators?view=holding', 'Holding our bills'], everyone: ['#/legislators?view=everyone', 'Everyone'] };
const fromBill = route => route.from && !FROM_TAB[route.from] ? billByRef(route.from) : null;
const FOLD = 5;   // a long list shows 5 rows, the rest behind one "Show all N" (U-4); the heading's count is the full count

// Sponsors are matched to legislators by surname on every bill, so the index is built once per load, not per page.
let sponsorIdx = null, sponsorKey = '';
function introducedBy(l) {
  const key = S.bills.length + '|' + (S.legislators || []).length;
  if (!sponsorIdx || sponsorKey !== key) {
    sponsorIdx = new Map(); sponsorKey = key;
    for (const b of S.bills) { if (b.tracked === false) continue; for (const x of legsForSponsors(b)) (sponsorIdx.get(x.id) || sponsorIdx.set(x.id, []).get(x.id)).push(b); }
  }
  return sponsorIdx.get(l.id) || [];
}
// Our live bills sitting in one of their committees right now, soonest hearing first.
function inTheirCommittees(l) {
  const mine = seatsOf(l).map(m => m.committee);
  return S.bills.filter(b => ourBill(b) && !diedish(b)).filter(b => { const st = stopOf(b); return st.phase === 'committee' && st.committee && codesOf(st.committee).some(c => mine.includes(c)); });
}
const hearingT = b => { const h = hearingAhead(b); return h ? new Date(h.scheduled_at).getTime() : Infinity; };
const byUrgency = (x, y) => hearingT(x) - hearingT(y) || (x.priority || 9) - (y.priority || 9) || x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true });
// The bills waiting on this legislator for a hearing: in a committee they chair, with no hearing yet. Each in the words
// Who to ask uses for this chair (holding.js chairLine), the viewer's own first, then by the day to ask.
function waitingOn(l, from) {
  const pool = [...inTheirCommittees(l), ...(from && !inTheirCommittees(l).some(b => b.id === from.id) ? [from] : [])];
  return pool.map(b => ({ b, ...chairLine(b, l) })).filter(x => x.s && x.s.key !== 'scheduled' && chairIdsOf(x.s.code).includes(l.id)).sort(byChairOrder);
}

// The stance button: "Mark where they stand" until someone sets it, then the stance itself ("Leaning yes"); it opens BILL's
// stance sheet (pathway.js openStance: stance, note, who on our team knows them).
const unknownStance = (b, l) => { const x = stanceOf(b.id, l.id); return !x.stance || x.stance === 'unknown'; };
function stanceBtn(b, l) {
  const x = stanceOf(b.id, l.id), word = STANCE_WORD[x.stance] || 'Unknown', none = !x.stance || x.stance === 'unknown';
  // Unknown, a small thumbs-up whose name says the act and the bill: eight identical "Mark where they stand" buttons ran down
  // Kevin's page, one per row (A-3, A-14); the section's line says once what it does. Known, the stance itself, a text
  // button that changes it (A-12: never a status tag that acts). R-344 rule 5: the thumbs-up, as the hearing page's "Mark
  // where they stand" and the stances themselves use; the pencil meant "edit" everywhere else.
  if (none) return iconBtn('thumbs-up', `Mark where ${shortName(l)} stands on ${billSay(b)}`, { 'data-lgstance': `${b.id}|${l.id}`, 'aria-haspopup': 'dialog' }, 'lg6-standb');
  return btn(word, { kind: 'text', sm: true, icon: STANCE_ICON[x.stance] || 'thumbs-up',
    attrs: { 'data-lgstance': `${b.id}|${l.id}`, 'aria-haspopup': 'dialog', 'aria-label': `Where ${shortName(l)} stands on ${billSay(b)}: ${word}. Change it` } });
}
// One of our bills with this legislator: the shared row (name, number, one line) and its one button. In "Waiting on them"
// the line is the ask in Who to ask's words, and the viewer's own ask that waits for a reply carries "They replied" (that
// chair's answer only); every other row carries the stance. Elsewhere the line is where the bill stands ("Hearing
// tomorrow 9:30 AM · House Health", "Waiting in Senate Commerce").
function standRow(b, l, { from = false, ask = null } = {}) {
  const line = ask ? ask.line : whereWords(b, { deadline: false });
  const button = ask?.waitingMine ? replyBtn(b, l, ask.s.code) : stanceBtn(b, l);
  return billRow(b, { line: nw(esc(line)), button, cls: `lg6-stand lg6-wrap${from ? ' lg6-from' : ''}` });
}
const listOf = (rows, label) => `<div class="v6-list lg6-list" role="list" aria-label="${esc(label)}">${rows.join('')}</div>`;
// keep: rows that never fold (the viewer's own asks come first in the list, so they are always among the shown).
function folded(key, rows, label, { keep = 0 } = {}) {
  const open = S.lgMore?.has(key), n = Math.max(FOLD, keep);
  if (rows.length <= n + 1 || open) return listOf(rows, label);
  return listOf(rows.slice(0, n), label) + `<div class="lg6-more">${showAllBtn(rows.length, { 'data-lgmore': key, 'aria-label': `Show all ${rows.length}: ${label}` })}</div>`;
}
const section = (id, title, n, inner, { act = '', sub = '' } = {}) => `<section class="lg6-sec" aria-labelledby="${id}"><div class="lg6-sech"><h2 id="${id}">${esc(title)}${n ? ` <span class="lg6-n">${n}</span>` : ''}</h2>${act}</div>${sub ? `<p class="lg6-secsub">${esc(sub)}</p>` : ''}${inner}</section>`;

// Asks and talks: everything logged with them, newest first; a meeting with others names the others ("Also with Rep.
// Takayama"). A note left on a stance ("What they said, what they want") is one of them too, so what a legislator said is
// in one list, not three. The first three show; Show all opens the rest.
function stanceNotes(l) {
  return (S.stances || []).filter(x => x.legislator_id === l.id && x.note && String(x.note).trim()).map(x => ({ id: `st-${x.bill_id}-${l.id}`, kind: 'stance',
    stance: x.stance, bill_id: x.bill_id, legislator_id: l.id, advocate_id: x.updated_by || null, body: x.note,
    created_at: x.updated_at || new Date(0).toISOString(), met_on: x.updated_at ? hstDayOf(x.updated_at) : null }));
}
const convRows = l => [...withOthers(S.legNotes?.[l.id] || []), ...stanceNotes(l)];
function talksHTML(l) {
  if (!S.legNotes?.[l.id]) return `<div class="skel lg-skel" aria-busy="true" aria-label="Loading the asks and talks"></div>`;
  const none = 'Nothing logged yet. After a meeting, a call or an email, use Log a talk.';
  return `<div class="cv-box lg6-talks" id="lg-cvbox">${convListHTML(convRows(l), { legId: l.id }, { limit: 3, key: 'lg' + l.id, none })}</div>`;
}
// Hawaiʻi-specific: the Speaker and the Senate President hold no committee seats. They preside over their chamber and refer
// each bill to its committees, so "no bills in their committees" is how the job works, not a gap in our data.
function noSeats(l) {
  const t = String(l.title || ''), chamber = l.chamber === 'S' ? 'Senate' : 'House';
  return /^(speaker|president)$/i.test(t) ? `The ${esc(t)} presides over the ${chamber} and refers each bill to its committees, so none of our bills waits on a committee of theirs. A word with this office can matter on any bill.`
    : `${esc(shortName(l))} has no committee seats this session, so none of our bills waits on their committee vote. Floor votes still count.`;
}
const copyBtn = (what, value) => btn('Copy', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-lgcopy': value, 'data-lgwhat': what, 'aria-label': `Copy the ${what}` } });

// The first actions: Email · Call · Log a talk. The filled one is the step the person came for (A-3, spec 4): with open
// asks of their own with this chair (new ones, or a follow-up that is due), the approved chair email for those bills, to
// this chair alone ("Email the chair"; "Did you send it?" records it, X21); otherwise Log a talk. Opened
// from a bill this chair holds, the approved email about that bill; else their own address.
function actionsHTML(l, from, asks) {
  const own = chairEmail(l, asks, { kind: 'primary', sm: false });
  let mail = own;
  if (!mail) {
    const fx = from ? asks.find(x => x.b.id === from.id && ['ask', 'giving'].includes(x.s?.key)) : null, m = fx ? chairMailFor(l, [from]) : null;
    // One name per act (spec 8): the approved ask is "Email the chair" everywhere; the bill is in the label for screen readers.
    mail = m ? btn('Email the chair', { kind: 'secondary', icon: 'mail', href: m.href, attrs: { 'aria-label': `Email the chair, ${shortName(l)}, about ${numWords(from)}` } })
      : l.email ? btn('Email', { kind: 'secondary', icon: 'mail', href: legMail(l, from), attrs: from ? { 'aria-label': `Email ${shortName(l)} about ${numWords(from)}` } : {} }) : '';
  }
  const call = !l.phone ? '' : HOVER() ? `<span class="lg6-tel">${icon('phone')}<span>${esc(l.phone)}</span>${copyBtn('phone number', l.phone)}</span>` : btn('Call', { kind: 'secondary', icon: 'phone', href: `tel:${String(l.phone).replace(/[^\d+]/g, '')}` });
  const log = btn('Log a talk', { kind: own ? 'secondary' : 'primary', icon: 'message-square-plus', attrs: { 'data-lglog': '1', 'aria-haspopup': 'dialog' } });
  return `<div class="lg6-acts${own ? ' lg6-acts-ask' : ''}">${mail}${call}${log}</div>`;
}

function pageHTML(route, l, back) {
  const from = fromBill(route), seats = seatsOf(l), island = islandFor(l), intro = introducedBy(l).slice().sort((a, b) => diedish(a) - diedish(b) || byUrgency(a, b));
  // Waiting on them for a hearing (a chair's), then our other bills in their committees (the bill this page was opened from
  // first), then any other bill they have a stance on.
  const asks = waitingOn(l, from).sort((p, q) => (q.b.id === from?.id) - (p.b.id === from?.id)), askIds = new Set(asks.map(x => x.b.id));   // the bill opened from first
  const inCm = inTheirCommittees(l).filter(b => !askIds.has(b.id) && (!from || b.id !== from.id)).sort(byUrgency);
  const known = (S.stances || []).filter(x => x.legislator_id === l.id && x.stance && x.stance !== 'unknown').map(x => S.bills.find(b => b.id === x.bill_id))
    .filter(b => b && (!from || b.id !== from.id) && !inCm.includes(b) && !askIds.has(b.id)).sort(byUrgency);
  const fromRest = from && !askIds.has(from.id) ? from : null;
  const stand = [...(fromRest ? [standRow(fromRest, l, { from: true })] : []), ...inCm.map(b => standRow(b, l))];
  const n = S.legNotes?.[l.id] ? convCount(convRows(l)) : 0;
  const sub = [PARTY[l.party] || l.party, `${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`, island === 'Hawaiʻi' ? 'Hawaiʻi Island' : island].filter(Boolean).join(' · ');
  const ours = intro.filter(b => ourBill(b)).length;
  const billsTitle = asks.length ? 'Our other bills in their committees' : 'Our bills in their committees';
  // The button's hint is said once, over the first list that has one (R-336 walk 2: it was printed over both).
  const PENCIL = 'The thumbs-up on a bill marks where they stand on it.';   // on a phone it sits under the bill, not beside it
  const waitPencil = asks.length > 0 && asks.some(x => !x.waitingMine && unknownStance(x.b, l));
  const cmPencil = !waitPencil && [...(fromRest ? [fromRest] : []), ...inCm].some(b => unknownStance(b, l));
  // A bill they introduced with no nickname shows its summary, which ran to two bold lines (R-336 walk 2). It is cut at a
  // word near 70 characters, which keeps the words that tell the bill apart ("Funds studies, monitoring and independent
  // testing of water affected…"; the Capitol's short title says only "Red Hill"), the whole of it in the name's title. A
  // word cut rather than a CSS ellipsis, so nothing is hidden by a box at 200% zoom (tests/staff6_journeys.py).
  const cutName = t => t.length <= 76 ? t : t.slice(0, 71).replace(/[\s,;:.(-]+\S*$/, '').replace(/([\s,;:.(-]+(and|or|of|the|a|an|to|for|with|in|on|by))+$/i, '').replace(/[\s,;:.(-]+$/, '') + '…';   // never ends on "and…"
  const unesc = t => t.replace(/&(amp|lt|gt|quot|#39);/g, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[k]));
  const introRow = b => { const row = billRow(b, { line: nw(esc(whereWords(b, { deadline: false }))), button: false, cls: b.nickname ? 'lg6-wrap' : 'lg6-wrap lg6-intro' });
    return b.nickname ? row : row.replace(/<span class="v6-row-name">([^<]*)<\/span>/, (m, t) => { const full = unesc(t), cut = cutName(full);
      return cut === full ? m : `<span class="v6-row-name" title="${esc(full)}">${esc(cut)}</span>`; }); };
  return `<div class="lg6-page">
    <a class="lg6-back" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>
    <header class="lg6-phead"><span class="lg6-pph" aria-hidden="true">${photo(l, 64)}</span><div class="lg6-pt"><h1>${esc(legName(l))}</h1><p class="lg6-psub">${esc(sub)}</p>${l.title ? `<p class="lg6-psub">${esc(l.title)}</p>` : ''}</div></header>
    ${actionsHTML(l, from, asks)}
    ${PROFILES() ? profileTipHTML(l) : ''}
    ${section('lg6-s-talks', 'Asks and talks', n || null, talksHTML(l))}
    ${asks.length ? section('lg6-s-wait', 'Waiting on them for a hearing', asks.length, folded(`${l.id}|wait`, asks.map(x => standRow(x.b, l, { from: from?.id === x.b.id, ask: x })), `Our bills waiting on ${shortName(l)} for a hearing`,
      { keep: asks.filter(x => x.own || x.follow || x.waitingMine || x.b.id === from?.id).length }), { sub: waitPencil ? PENCIL : '' }) : ''}
    ${seats.length ? section('lg6-s-bills', billsTitle, inCm.length + (fromRest ? 1 : 0) || null,
      stand.length ? folded(`${l.id}|cm`, stand, `${billsTitle}, ${shortName(l)}`) : `<p class="lg6-none">${asks.length ? 'None besides the bills waiting on them.' : 'None of our live bills is in their committees right now.'}</p>`,
      { sub: cmPencil ? PENCIL : '' })
      : section('lg6-s-bills', 'Our bills in their committees', null, `<p class="lg6-none">${noSeats(l)}</p>${fromRest ? listOf([standRow(fromRest, l, { from: true })], 'The bill you came from') : ''}`)}
    ${known.length ? section('lg6-s-known', 'Other bills they have a stance on', known.length, folded(`${l.id}|kn`, known.map(b => standRow(b, l)), 'Other bills they have a stance on')) : ''}
    ${PROFILES() ? profileHTML(l, { intro, tip: false }) : ''}
    ${section('lg6-s-intro', 'Bills they introduced', intro.length || null, intro.length ? folded(`${l.id}|in`, intro.map(introRow), `Bills ${shortName(l)} introduced`) : `<p class="lg6-none">None of the bills on the tracker.</p>`,
      { sub: intro.length ? (ours ? `${ours} of them ${ours === 1 ? 'has' : 'have'} our position` : 'None of them has our position') : '' })}
    ${seats.length ? section('lg6-s-cm', 'Committees', null, `<ul class="lg6-facts">${seats.map(m => `<li><span>${esc(committeeName(m.committee))}</span>${m.role !== 'member' ? `<span class="lg6-role">${esc(roleWord(m.role))}</span>` : ''}</li>`).join('')}</ul>`) : ''}
    ${section('lg6-s-office', 'Contact', null, `<ul class="lg6-facts lg6-contact">
      ${l.room ? `<li><span>${icon('map-pin')}Room ${esc(l.room)}, State Capitol</span></li>` : ''}
      ${l.phone ? `<li><span>${icon('phone')}${esc(l.phone)}</span>${copyBtn('phone number', l.phone)}</li>` : ''}
      ${l.email ? `<li><span>${icon('mail')}<a href="mailto:${esc(l.email)}">${esc(l.email).replace('@', '@<wbr>')}</a></span>${copyBtn('email address', l.email)}</li>` : ''}
      ${l.places ? `<li><span>${icon('house')}Represents ${esc(l.places)}</span></li>` : ''}
      ${l.capitol_url ? `<li><span>${icon('globe')}<a href="${esc(l.capitol_url)}" target="_blank" rel="noopener">Their page at capitol.hawaii.gov${icon('external-link')}<span class="sr"> (opens in a new tab)</span></a></span></li>` : ''}
    </ul>`)}
  </div>`;
}

export default {
  tab: 'legislators',
  title: route => { const l = legById(route.id); return l ? shortName(l) : 'Legislator'; },
  back: route => { const b = fromBill(route), t = FROM_TAB[route.from];
    return b ? { href: billRoute(b), label: b.bill_number } : t ? { href: t[0], label: t[1] } : { href: '#/legislators', label: 'Legislators' }; },
  render(route) {
    const l = legById(route.id);
    if (!l) return empty({ title: 'We could not find that legislator', text: 'The link may be from an earlier session.', action: btn('See everyone', { href: '#/legislators?view=everyone' }), h: 'h1' });
    // Asks and talks load once per legislator; the page shows a placeholder until they arrive.
    if (!S.legNotes?.[l.id] && !(S.lgNotesLoading ??= new Set()).has(l.id)) {
      S.lgNotesLoading.add(l.id);
      DB.legNotes(l.id).then(() => hooks.render()).catch(() => { S.legNotes[l.id] = []; toast('Could not load the asks and talks.', { err: true }); hooks.render(); }).finally(() => S.lgNotesLoading.delete(l.id));
    }
    return pageHTML(route, l, this.back(route));
  },
  wire(route, app) {
    const root = app.querySelector('.lg6-page'), l = legById(route.id); if (!root || !l) return;
    wireLinks(root);
    const keepY = sel => { const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.querySelector(sel)?.focus({ preventScroll: true }); };
    root.querySelectorAll('[data-lgstance]').forEach(el => el.onclick = () => { const [bid] = el.dataset.lgstance.split('|'), b = S.bills.find(x => String(x.id) === bid), k = el.dataset.lgstance;
      if (b) openStance(b, l, { redraw: () => keepY(`[data-lgstance="${k}"]`) }); });
    root.querySelectorAll('[data-lgcopy]').forEach(el => el.onclick = async () => {
      const what = el.dataset.lgwhat || 'text';
      try { await navigator.clipboard.writeText(el.dataset.lgcopy); toast(`${what[0].toUpperCase()}${what.slice(1)} copied.`, { ok: true }); }
      catch { toast(`Could not copy. Select the ${what} and copy it.`); }
    });
    // Opened from a bill (?from=HB1562), the talk starts on that bill and its issue; from a chair's page it offers their
    // bills to count as the ask (V24) and, on the practice copy, a note instead (R-335).
    root.querySelectorAll('[data-lglog]').forEach(el => el.onclick = () => logConversation({ bill: fromBill(route), legislatorIds: [l.id], onDone: () => hooks.render() }));
    if (PROFILES()) wireProfile(root, l);
    root.querySelectorAll('[data-lgmore]').forEach(el => el.onclick = () => { (S.lgMore ??= new Set()).add(el.dataset.lgmore); keepY(`[data-lgmore]`); });
    // Correct or delete (your own; an admin may delete any): conversation.js, which offers Undo.
    wireConvList(root.querySelector('#lg-cvbox'), { rows: () => convRows(l), redraw: () => hooks.render() });
    fetchOthers(S.legNotes?.[l.id] || [], () => hooks.render());
  },
};
