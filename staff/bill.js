// HIPHI Staff v2 · M2 Bill workspace (plan 3.3). The bill is a full page with its own address
// (#/bill/HB1562[/overview|activity|pathway|public]), not a modal: Back works and a link can be shared.
// Phones: the heading (nickname or plain summary, where the bill stands, position / priority / owner chips), the
// "Next up" card with the ONE button that does the testimony step, then the four tabs, which pin under the header.
// Desktop (900px and wider, build 4): two columns. The main column leads with the bill's facts — the heading, the
// stage ribbon, where it stands, then Details — and ends with the empty form (To do, Team note), because an empty
// input is the least important thing on the page. The heading and the tabs pin together under the app header, so a
// long Activity stream never costs you your place or the tab strip. The side panel is Next up and Team only; the key
// facts moved into Details, which is what makes the panel fit on a 1280x800 screen without an inner scrollbar.
// The Activity tab lives in activity.js, the Public tab in public.js, Pathway in pathway.js.
import { S, DB, DEMO, APP_URL, STAGES, STAGE_LABEL, hooks, esc, fmtDT, fmtDate, advocate, capitolUrl, isOwner, isMuted } from './data.js';
import { CHAMBER_NAME } from '../stops.js';
import { FACTS, stopOf, diedish, whyDead, riskOf, hearingAhead, codesOf, cmteName, streamOf, draftFor, draftWho, draftActions, chairMail,
  billNum, blurb, titleCaseTitle, sponsorName, legsOf, legTitle, legById, lastSlotBefore, OUTCOME_LABEL, unreadCount,
  listNames, hiToday, gateName, personName, pubStateCls, PUBLIC_APP, nameOf, dWhen } from './model.js';
import { personById } from './data.js';
import { icon, btn, iconBtn, chip, POS_ICON, POS_WORD, posIcons, ownerOf, countdown, stepBar, stageRibbon, empty, notice, toast, openSheet, closeSheet,
  pickerSheet, menuSheet, confirmSheet, field, keysOn } from './ui.js';
import { renderPathway, wirePathway } from './pathway.js';
import { renderActivity, wireActivity, composerBar, loadTimeline, shortAction } from './activity.js';
import { renderPublic, wirePublic } from './public.js';
import { renderTestimony, wireTestimony, earlierCount, testimonyHref, onNextUp } from './testimony.js';
import { holdBack } from './review.js';
import { sittingOf, goersOf, agendaOf } from './hearing.js';

// ---- small shared helpers (activity.js and public.js use these too) ----
export const firstName = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
export const nameOrYou = a => a ? (a.id === S.me?.id ? 'You' : firstName(a)) : 'No one';
export const andList = arr => arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
// "Wed 3/18": the weekday rides along so nobody has to work it out.
export const dayOf = d => fmtDate(d, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');
// "RELATING TO YOUTH MENTAL HEALTH." -> "Youth mental health": the subject is the bill's name to staff.
export function plainTitle(b) {
  let t = String(b.title || '').trim().replace(/\.$/, '').replace(/^RELATING TO\s+(THE\s+)?/i, '');
  if (!t) return blurb(b, 80);
  if (t === t.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.replace(/\bhawai[ʻ']?i\b/gi, 'Hawaiʻi').replace(/\bhawaiian\b/gi, 'Hawaiian').replace(/\bkupuna\b/gi, 'kūpuna');
}
// The team's plain summary (one sentence a neighbour would understand), when someone has written it.
export const summaryOf = b => String(b?.public_summary || '').trim();
// What a bill is called on its page: the nickname when it has one ("Disposable vape ban"), else the plain summary,
// else the subject of the official title. 574 of 734 bills share an official title with another ("Health", "Waste
// management"), so that title is a detail line in Overview, never the heading.
export const billName = b => String(b?.nickname || '').trim() || summaryOf(b) || plainTitle(b);
// A save re-renders the whole page (hooks.render); keep the reader's place and the focus where it was.
export function rerender(focusSel) {
  const y = window.scrollY, a = document.activeElement, id = a && a.id;
  const sel = a && typeof a.selectionStart === 'number' ? [a.selectionStart, a.selectionEnd] : null;
  hooks.render();
  const n = focusSel ? document.querySelector(focusSel) : id ? document.getElementById(id) : null;
  if (n) { n.focus({ preventScroll: true }); if (!focusSel && sel && n.setSelectionRange) try { n.setSelectionRange(sel[0], sel[1]); } catch { /* not a text field */ } }
  if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
}
// A menu (ui.menuSheet) closes itself with history.back(), which lands a moment later. A sheet opened from a menu item
// before that Back lands gets its history entry undone by it, and closing that sheet then leaves the page. So a menu
// item that opens another sheet waits for the Back first (with a fallback in case none comes).
export function afterBack(fn) {
  let done = false;
  const run = () => { if (done) return; done = true; removeEventListener('popstate', run); fn(); };
  if (!history.state?.sheet) { run(); return; }
  addEventListener('popstate', run); setTimeout(run, 500);
}
// Text typed but not saved yet (a team note, a message, the public copy) outlives the re-render a save elsewhere causes.
export const drafts = new Map();
// A team note typed and not saved lives only in this tab: moving between bills keeps it, but a reload or closing the
// tab would lose it without a word (R-005; DESIGN C-9). The browser asks first.
addEventListener('beforeunload', e => {
  for (const [k, v] of drafts) { if (!k.endsWith(':note')) continue;
    const b = (S.bills || []).find(x => String(x.id) === k.slice(0, -5));
    if (b && v.trim() !== (b.internal_notes || '').trim()) { e.preventDefault(); e.returnValue = ''; return; } }
});

// ---- which bill, which tab ----
const TABS = [['overview', 'Overview'], ['activity', 'Activity'], ['pathway', 'Pathway'], ['public', 'Public'], ['testimony', 'Testimony']];
// Old links (the current app's tab names, Slack's #bill=…&tab=chat) land where the content lives now.
const TAB_ALIAS = { chat: 'activity', timeline: 'activity', notes: 'overview', details: 'overview', team: 'overview' };
const tabOf = r => { const t = TAB_ALIAS[r.tab] || r.tab; return TABS.some(([k]) => k === t) ? t : 'overview'; };
const billOf = r => { const n = String(r.num || '').replace(/\s/g, '').toUpperCase(); return S.bills.find(b => b.bill_number === n) || null; };
const billHref = (b, tab = 'overview') => `#/bill/${b.bill_number}${tab === 'overview' ? '' : '/' + tab}`;

// ---- where the page was opened from: the back link names it ("Today") ----
// The frame sets S.route on every render, so watching that setter tells us the page shown before this one. The origin
// is stored in the history entry (history.state.bwFrom) so it survives coming Back from a legislator page, and it is
// carried across tab switches and Previous / Next, which replace the entry instead of adding one.
let prevRoute = null, prevHash = '', carry = null, lastKey = '', fresh = true;
(() => {
  let cur = S.route, curHash = '';
  Object.defineProperty(S, 'route', { configurable: true, enumerable: true, get: () => cur,
    set(v) {
      const same = cur && v && cur.name === 'bill' && v.name === 'bill' && cur.num === v.num;
      if (cur && !same) { prevRoute = cur; prevHash = curHash; }
      // A render of a different page or tab (not a re-render after a save) is a fresh view.
      const k = v ? `${v.name}|${v.num || v.id || ''}|${v.name === 'bill' ? tabOf(v) : ''}` : '';
      fresh = k !== lastKey; lastKey = k;
      cur = v; curHash = location.hash;
    } });
})();
// True while rendering a page or tab that was just opened, false on a re-render of the same one.
export const viewIsNew = () => fresh;
function labelFor(r) {
  switch (r.name) {
    case 'today': return 'Today';
    case 'review': return 'Review';
    case 'bills': return r.muted ? 'Muted bills' : 'Bills';
    case 'triage': return 'New bills';
    case 'memo': return 'Memo';
    case 'legislators': return 'Legislators';
    case 'legislator': { const l = legById(r.id); return l ? `${legTitle(l)} ${(l.sort_name || l.name || '').split(',')[0]}` : 'Legislator'; }
    case 'search': return 'Search';
    case 'supporters': return 'Supporters';
    case 'person': { const p = personById(r.id); return p ? personName(p) : 'Supporter'; }
    case 'lists': return 'Lists';
    case 'list': return (S.lists || []).find(l => String(l.id) === String(r.id))?.title || 'List';
    case 'emails': return 'Emails';
    case 'composer': return 'Email';
    case 'me': return 'Settings';
    case 'setup': return 'Setup';
    case 'help': return 'Help';
    case 'bill': return r.num;
    default: return 'Back';
  }
}
function origin(route) {
  if (carry) return carry;
  const saved = history.state && history.state.bwFrom;
  if (saved && saved.href) return saved;
  // A list screen may say where it is (S.billNav.label/href); otherwise the page before this one; otherwise Today,
  // which is where a Slack or email link's Back goes.
  if (prevRoute && !(prevRoute.name === 'bill' && prevRoute.num === route.num)) return { href: prevHash || '#/', label: labelFor(prevRoute) };
  const nav = S.billNav && !Array.isArray(S.billNav) ? S.billNav : null;
  if (nav && nav.href) return { href: nav.href, label: nav.label || 'Back' };
  return { href: '#/', label: 'Today' };
}

// ---- Previous / Next through the list the bill was opened from (S.billNav, set by list screens) ----
// S.billNav is an ordered list of bill ids (or numbers), or { ids, label, href }. Without it the buttons hide.
function neighbours(b) {
  const n = S.billNav, ids = Array.isArray(n) ? n : (n && n.ids) || [];
  const i = ids.findIndex(x => x === b.id || x === b.bill_number);
  if (i < 0 || ids.length < 2) return null;
  const at = k => { const v = ids[k]; return v == null ? null : S.bills.find(x => x.id === v || x.bill_number === v) || null; };
  return { i, n: ids.length, prev: i > 0 ? at(i - 1) : null, next: i < ids.length - 1 ? at(i + 1) : null };
}
// True on the two-column desktop layout (the frame redraws the page when the window crosses 900px).
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
let switching = false;                     // true while a tab change or Previous / Next draws the page
function goBill(b, tab) {
  carry = origin(S.route);                 // same origin: Back still returns to the list, not to the bill before
  switching = true;
  try { S.go(billHref(b, tab || tabOf(S.route)), { replace: true }); } finally { switching = false; }
}

// ---- the tab strip: where it pins, and bringing a tab's content into view ----
const stickTop = () => { const h = document.querySelector('.sv-hdr'); return h ? h.getBoundingClientRect().height : 56; };
// Desktop: the top bar and the strip stay pinned, the heading scrolls away (R-042). Where the strip's bottom edge sits
// is measured and published as --bw-under, the line under which a tab's content begins. The Pathway table's header row
// and the Public tab's preview stick to that line.
const stickBlock = () => { const el = document.querySelector('.bw-desk .bw-tabs'); return el && getComputedStyle(el).position === 'sticky' ? el : null; };
function measureStick() {
  const page = document.querySelector('.bw-page'); if (!page) return;
  const el = stickBlock();
  if (!el) { page.style.removeProperty('--bw-under'); return; }
  page.style.setProperty('--bw-under', Math.round((parseFloat(getComputedStyle(el).top) || 0) + el.offsetHeight) + 'px');
}
// How far the page scrolls to put the strip right under the header (where position: sticky holds it from then on).
function pinY() {
  // The strip pins at its own sticky top: under the header on a phone, under the header and the top bar on desktop.
  const sent = document.querySelector('.bw-tabsent'), nav = document.querySelector('.bw-tabs'); if (!sent || !nav) return 0;
  const top = parseFloat(getComputedStyle(nav).top);
  return Math.max(0, Math.round(sent.getBoundingClientRect().top + window.scrollY + parseFloat(getComputedStyle(nav).marginTop || 0) - (Number.isFinite(top) ? top : stickTop())));
}
// Desktop: once the heading has scrolled under the top bar, the top bar names the bill, so the pinned rows still say
// which bill this is.
let topRaf = 0;
function markScrolled() {
  topRaf = 0;
  const bar = document.querySelector('.bw-desk .bw-top'), num = document.querySelector('.bw-desk h1.bw-num'); if (!bar || !num) return;
  bar.classList.toggle('bw-scrolled', num.getBoundingClientRect().bottom <= bar.getBoundingClientRect().bottom);
}
addEventListener('scroll', () => { if (!topRaf && S.route?.name === 'bill') topRaf = requestAnimationFrame(markScrolled); }, { passive: true });
// The bottom edge of the pinned block: a field brought into view (the ask on the Public tab) goes below this line.
export const underTabs = () => { const el = stickBlock();
  return el ? (parseFloat(getComputedStyle(el).top) || 0) + el.offsetHeight : stickTop() + (document.querySelector('.bw-tabs')?.offsetHeight || 0); };
// A window that changes width rewraps the heading, so the line moves. (The frame redraws the page only when the
// window crosses 900 or 1100px; this keeps the measurement honest in between.)
let rz = 0;
addEventListener('resize', () => { if (rz) return; rz = requestAnimationFrame(() => { rz = 0; if (S.route?.name === 'bill') measureStick(); }); });
function switchTab(tab) {
  if (S.route?.name !== 'bill') return;
  const b = billOf(S.route); if (!b) return;
  const same = tabOf(S.route) === tab, pinned = window.scrollY > pinY() + 1;
  if (!same) {
    carry = origin(S.route); switching = true;
    // Replaces this history entry (as before): Back leaves the bill, it does not walk back through its tabs.
    try { S.go(billHref(b, tab), { replace: true, keepScroll: true }); } finally { switching = false; }
  }
  // Phones: on arrival the strip sits at, or below, the bottom of the first screen, so a tap used to move only the
  // underline. The strip now goes to the top, under the header, and the tab's content fills the screen. A reader
  // already inside a tab (strip pinned) starts the new tab at its top. Desktop: the content is on the first screen
  // already, so only a reader who had scrolled down is moved.
  if (tab === 'activity' && !same) { /* the stream scrolls to its newest entry itself (activity.js) */ }
  else if (!DESK() || pinned) { const y = pinY(); window.scrollTo({ top: y, behavior: pinned || calm() ? 'auto' : 'smooth' }); }
  document.querySelector(`.bw-tabs [data-tab="${tab}"]`)?.focus({ preventScroll: true });
}
// Back and Forward restore the reader's place (the frame does it); only a page that was just opened, by a link or a
// reload, brings its tab into view. Registered before the frame's own listener, because app.js imports this file.
let popping = false;
addEventListener('popstate', () => { popping = true; setTimeout(() => { popping = false; }, 0); });

// ---- keyboard (desktop): 1-4 switch tabs, [ and ] move through the list, Esc goes back ----
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'bill' || !keysOn()) return;    // My settings can switch every shortcut off
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const b = billOf(S.route); if (!b) return;
  if (/^[1-5]$/.test(e.key)) { e.preventDefault(); switchTab(TABS[+e.key - 1][0]); return; }
  if (e.key === '[' || e.key === ']') { const nb = neighbours(b), to = nb && (e.key === '[' ? nb.prev : nb.next); if (to) { e.preventDefault(); goBill(to); } return; }
  if (e.key === 'Escape') { const a = document.querySelector('.bw-top [data-back]'); if (a) { e.preventDefault(); a.click(); } }
});

// ---- the header: where it stands, in one sentence ----
const chamberOf = code => { const c = codesOf(code).map(k => S.committees?.[k]).find(Boolean); return c ? CHAMBER_NAME[c.chamber] : ''; };
// "Senate Health and Human Services", "House Health / Human Services & Homelessness" (a joint stop)
export const cmteFull = code => { const ch = chamberOf(code); return `${ch ? ch + ' ' : ''}${cmteName(code)}`; };
const isJoint = code => codesOf(code).length > 1;
const dlText = dl => dl ? `the ${gateName({ phase: dl.key, label: dl.label }).toLowerCase()} deadline, ${dayOf(dl.date + 'T12:00:00-10:00')}` : '';
// Where the bill stands, in one sentence. Review shows it on each card too (R-022), where the draft's own hearing already
// has a line of its own, so { hearing: false } leaves "Next: hearing ..." out there (A-14).
export function statusSentence(b, { hearing = true } = {}) {
  const st = stopOf(b), ch = CHAMBER_NAME[st.chamber] || '';
  if (diedish(b) || st.phase === 'dead') return whyDead(b);           // whyDead escapes what it quotes
  if (st.phase === 'law') return 'Signed into law.';
  if (st.phase === 'vetoed') return 'Vetoed by the Governor.';
  if (st.phase === 'governor') return 'Passed the House and Senate. It is on the Governor’s desk.';
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  if (st.phase === 'conference') return `In conference: House and Senate negotiators are settling one version${dl ? ` before ${esc(dlText(dl))}` : ''}.`;
  if (st.phase === 'floor') return `Through its ${ch} committees. Next: a vote of the full ${ch}${dl ? ` before ${esc(dlText(dl))}` : ''}.`;
  const other = st.chamber === 'H' ? 'Senate' : 'House', passed = st.leg === 'second' ? `Passed the ${other}. ` : '';
  if (!st.committee) return `${passed}Waiting to be sent to a ${ch} committee${dl ? `, before ${esc(dlText(dl))}` : ''}.`;
  const where = `In ${esc(cmteFull(st.committee))}${st.stops > 1 ? `, stop ${st.stop} of ${st.stops} in the ${ch}` : ''}`;
  if (st.hearingState === 'scheduled') return hearing ? `${passed}${where}. Next: ${isJoint(st.committee) ? 'joint hearing' : 'hearing'} ${esc(fmtDT(st.hearing.scheduled_at))}.` : `${passed}${where}.`;
  if (st.hearingState === 'held') return `${passed}${where}. Heard ${esc(dayOf(st.hearing.scheduled_at))}; waiting for the committee’s decision.`;
  if (st.deadline?.missed) return `Needed a hearing in ${esc(st.committee)} before ${esc(dlText(st.deadline))}, and did not get one.`;
  return `${passed}${where}. Needs a hearing before ${esc(dlText(dl))}${dl ? ` (${dl.days} day${dl.days === 1 ? '' : 's'})` : ''}. ${isJoint(st.committee) ? 'The chairs decide.' : 'The chair decides.'}`;
}

// ---- picker chips: position, priority, owner. Each saves on tap and says "Saved", with Undo. ----
const POS_ORDER = ['strongly_support', 'support', 'support_amend', 'neutral', 'oppose', 'strongly_oppose', 'monitor', ''];
const PRI_SUB = { 1: 'Top tier: leads every list and alert', 2: 'Active, behind the P1 bills', 3: 'The lowest tier we still take a position on' };
// Initials on the owner chip (ui.avatar says "You" at this size, and the chip's label already does).
const initials = a => `<span class="sv-av${a.id === S.me?.id ? ' me' : ''}" style="--av:24px" aria-hidden="true">${esc(a.initials || firstName(a)[0] || '?')}</span>`;
const pick = (key, label, lead, aria) => `<button type="button" class="sv-pick" data-bwpick="${key}" aria-haspopup="dialog" aria-label="${esc(aria)}">${lead}<span>${esc(label)}</span>${icon('chevron-down', { cls: 'chev' })}</button>`;
const teamPicks = b => {
  const pos = b.position || '', own = ownerOf(b);
  return [['Position', pick('pos', POS_WORD[pos] || pos, posIcons(pos), `Position: ${POS_WORD[pos] || pos}. Change`)],
    ['Priority', pick('pri', b.priority ? 'P' + b.priority : 'No priority', '', `Priority: ${b.priority ? 'P' + b.priority : 'none'}. Change`)],
    ['Owner', pick('own', own ? nameOrYou(own) : 'No owner', own ? initials(own) : icon('user-round'), `Owner: ${own ? own.full_name : 'none'}. Change`)]];
};
// Who follows the bill (R-022 wave 3), you first. data.js keeps your own follow in S.follows, the team's in S.followersBy.
const followers = b => {
  const ids = new Set(S.followersBy?.[b.id] || []);
  if (S.me) { if (S.follows?.has(b.id)) ids.add(S.me.id); else ids.delete(S.me.id); }
  return [...ids].map(advocate).filter(Boolean).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
};
const followText = b => andList(followers(b).map(a => a.id === S.me?.id ? 'You' : firstName(a)));
// Muted is the one flag left beside the pickers: "Following" is said by the Following line, with everyone else (A-14).
const followFlag = b => isMuted(b) ? chip('Muted', '', 'bell-off') : '';
// Phones: a row of chips under the status sentence.
const teamChips = b => `<div class="bw-chips">${teamPicks(b).map(([, p]) => p).join('')}${followFlag(b)}</div>`;
// Desktop: the same three pickers as labelled lines in the side panel (they open as popovers beside the chip), and who
// follows the bill.
const teamCard = b => { const f = followText(b);
  return `<section class="card bw-side bw-teamc" aria-labelledby="bw-teamc-h">
    <div class="bw-nexthead"><h2 class="bw-eyebrow" id="bw-teamc-h">Team</h2>${followFlag(b)}</div>
    ${teamPicks(b).map(([l, p]) => `<div class="bw-ctl"><span class="bw-ctll" aria-hidden="true">${l}</span>${p}</div>`).join('')}
    ${f ? `<div class="bw-ctl"><span class="bw-ctll">Following</span><span class="bw-ctlv">${esc(f)}</span></div>` : ''}
  </section>`; };
async function saveWithUndo(b, patch, focusSel) {
  const before = {}; for (const k of Object.keys(patch)) before[k] = b[k] ?? null;
  try {
    await DB.updateBill(b.id, patch); FACTS.clear(); rerender(focusSel);
    toast('Saved', { undo: async () => { await DB.updateBill(b.id, before); FACTS.clear(); rerender(focusSel); toast('Put back as it was'); } });
  } catch (e) { toast(e, { err: true }); rerender(focusSel); }
}
function pickPosition(b) {
  pickerSheet({ title: `Position on ${b.bill_number}`, value: b.position || '',
    options: POS_ORDER.map(v => [v, POS_WORD[v], POS_ICON[v] || 'circle-dashed', v === 'monitor' ? 'Watch it; no testimony drafts' : '']),
    onPick: v => saveWithUndo(b, { position: v || null }, '[data-bwpick="pos"]') });
}
function pickPriority(b) {
  pickerSheet({ title: `Priority of ${b.bill_number}`, value: b.priority ? String(b.priority) : '',
    options: [['1', 'P1', 'flag', PRI_SUB[1]], ['2', 'P2', 'flag', PRI_SUB[2]], ['3', 'P3', 'flag', PRI_SUB[3]], ['', 'No priority', 'circle-dashed']],
    onPick: v => saveWithUndo(b, { priority: v ? +v : null }, '[data-bwpick="pri"]') });
}
function pickOwner(b) {
  const cur = (S.assignments[b.id] || [])[0] || '';
  const people = S.advocates.filter(a => a.is_active !== false || a.id === cur).slice().sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: `Who owns ${b.bill_number}?`, value: cur, help: 'The owner writes and files its testimony and gets its alerts.',
    options: [...people.map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name, 'user-round']), ['', 'No owner', 'circle-dashed']],
    onPick: async v => {
      if (v === cur) return;
      try {
        await DB.setOwner(b.id, v || null); FACTS.clear(); rerender('[data-bwpick="own"]');
        toast('Saved', { undo: async () => { await DB.setOwner(b.id, cur || null); FACTS.clear(); rerender('[data-bwpick="own"]'); toast('Put back as it was'); } });
      } catch (e) { toast(e, { err: true }); rerender(); }
    } });
}

// ---- the page's ⋯ menu: Follow or Mute, Copy link, Capitol page, the current app ----
function pageMenu(b) {
  const h = hearingAhead(b), muted = isMuted(b), following = !!S.follows?.has(b.id), num = billNum(b);
  // The server refuses to mute while a hearing is ahead; say its sentence before anyone tries.
  const refuse = h ? `This bill has a ${h.committee} hearing on ${fmtDate(h.scheduled_at)}. It can be muted once that hearing is over.` : '';
  menuSheet({ title: num, items: [
    isOwner(b)
      ? { label: muted ? 'Unmute' : 'Mute', icon: muted ? 'bell' : 'bell-off', sub: muted ? 'Put it back on Today and in your alerts' : 'Off Today and no alerts until it gets a hearing',
          disabled: !muted && !!h, reason: refuse, run: () => afterBack(() => toggleMute(b)) }
      : { label: following ? 'Unfollow' : 'Follow', icon: following ? 'bell-off' : 'bell', sub: following ? 'Stop seeing it in your bills' : 'See it in your bills and get its updates', run: () => toggleFollow(b) },
    { label: 'Copy link', icon: 'link', sub: 'Opens this bill for anyone on the team', run: () => afterBack(() => copyLink(b)) },
    S.me?.is_admin && !b.stage_override ? { label: 'Correct the stage', icon: 'pencil', sub: 'Only when the Capitol’s record is wrong', run: () => afterBack(() => pickStage(b)) } : null,
    { label: 'Capitol page', icon: 'external-link', sub: 'capitol.hawaii.gov', run: () => { window.open(capitolUrl(b), '_blank', 'noopener'); } },
    { label: 'Open in the current app', icon: 'external-link', sub: 'The look you know, same data', run: () => { location.href = `${APP_URL}${DEMO ? '?demo=1' : ''}#bill=${b.bill_number}`; } },
  ] });
}
async function toggleMute(b) {
  const on = !isMuted(b), num = billNum(b);
  if (on) {
    const r = riskOf(b);
    if (r && !(await confirmSheet({ title: `Mute ${num}?`, text: `This bill is at risk: ${r.deadline.days} day${r.deadline.days === 1 ? '' : 's'} to its deadline and no hearing yet. Muted, it leaves Today and sends you no alerts until it gets a hearing.`, ok: 'Mute anyway' }))) return;
  }
  try {
    await DB.mute(b.id, on); FACTS.clear(); rerender();
    if (on) toast(`Muted ${num}: off Today and no alerts until it gets a hearing.`, { undo: async () => { await DB.mute(b.id, false); rerender(); } });
    else toast(`${num} is back on Today.`);
  } catch (e) { toast(e, { err: true }); rerender(); }   // the server's own sentence comes through (ui.friendly)
}
async function toggleFollow(b) {
  const on = !S.follows?.has(b.id), num = billNum(b);
  try {
    await DB.follow(b.id, on); FACTS.clear(); rerender();
    toast(on ? `Following ${num}. It shows in your bills now.` : `Unfollowed ${num}.`, { undo: async () => { await DB.follow(b.id, !on); rerender(); } });
  } catch (e) { toast(e, { err: true }); }
}
// The same link the current app copies (#bill=…): it opens in either app, and Slack already uses it.
async function copyLink(b) {
  const url = `${APP_URL}#bill=${b.bill_number}`;
  try { await navigator.clipboard.writeText(url); toast('Link copied'); }
  catch {
    openSheet({ title: 'Copy this link', size: 'auto', body: field('bw-link', 'Link to this bill', `<input id="bw-link" type="url" readonly value="${esc(url)}">`, 'Select it and copy.'),
      wire: d => { const i = d.querySelector('#bw-link'); i.focus(); i.select(); } });
  }
}

// ---- Next up: the hearing, the testimony step and its one button ----
const roomOf = r => String(r || '').replace(/\s*(&|and|via)\s*videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ').trim();
// Testimony is due at the deadline on the notice, else a day before the hearing (plan 5).
const dueOf = h => h.testimony_deadline || new Date(new Date(h.scheduled_at) - 864e5).toISOString();
const reviewerNames = () => listNames(a => a.is_reviewer, ' or ');
const approverNames = () => listNames(a => a.is_admin, ' or ');
// Would approving this draft send it to a second approval? Only the bill's first testimony gets one (the database's rule).
const firstForBill = d => !Object.values(S.drafts).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && ['approved', 'filed'].includes(x.status));
// Who has the testimony and who is next, in one line. The step bar above it already names the step, so a draft waiting
// for its second approval says so once (the bar's "2nd approval"), not three ways (A-14, R-022): the chip that said
// "Needs 2nd approval" is gone, and this line names the people rather than the step again.
// "waiting for you or Jaylen" when you are one of them, so the person who can act sees that it is theirs.
const waitingFor = pred => { const l = S.advocates.filter(a => pred(a) && a.is_active !== false), me = l.some(a => a.id === S.me?.id);
  return [...(me ? ['you'] : []), ...l.filter(a => a.id !== S.me?.id).map(a => a.full_name)].join(' or ') || 'an admin'; };
function whoLine(d) {
  if (d.status === 'review') return `Sent by ${nameOf(d.submitted_by)} ${dWhen(d.submitted_at)} · waiting for ${waitingFor(a => a.is_admin)}`;
  if (d.status === 'second_review') return `Approved by ${nameOf(d.approved_by)} ${dWhen(d.approved_at)} · waiting for ${waitingFor(a => a.is_reviewer)}`;
  return draftWho(d).replace(/ \u00b7 file it at the Capitol, then mark it filed$/, '');
}
function testimonyBlock(b, d, { primary = true, title = '' } = {}) {
  const me = S.me || {}, acts = d.status === 'cancelled' ? [] : draftActions(d).map(a => a[0]);
  const own = d.submitted_by && d.submitted_by === me.id;
  const second = d.status === 'second_review' || !!d.second_approved_by || (['draft', 'review'].includes(d.status) && firstForBill(d));
  const kind = primary ? 'primary' : 'secondary';
  let main = '', alt = '';
  if (d.status === 'draft') main = btn(d.review_note ? 'Resubmit for review' : 'Submit for review', { kind, icon: 'send', attrs: { 'data-dact': 'submit', 'data-draft': d.id } });
  else if (acts.includes('approve')) { main = btn('Approve', { kind, icon: 'check', attrs: { 'data-dact': 'approve', 'data-draft': d.id } }); alt = btn('Request changes', { kind: 'secondary', attrs: { 'data-dact': 'changes', 'data-draft': d.id } }); }
  else if (d.status === 'approved') { main = btn('File at the Capitol', { kind, icon: 'external-link', href: capitolUrl(b), target: '_blank' });
    alt = btn('Mark filed', { kind: 'secondary', icon: 'clipboard-check', attrs: { 'data-dact': 'file', 'data-draft': d.id } }); }
  else if (d.status === 'filed') main = chip('Filed', 'ok', 'check');
  else if (d.status === 'cancelled') main = chip('Hearing cancelled', '', 'circle-x');
  const stale = b.current_version && (d.version || null) !== b.current_version && !['filed', 'cancelled'].includes(d.status);
  const earlier = d.status === 'draft' && tabOf(S.route || {}) !== 'testimony' ? earlierCount(b) : 0;
  const links = [
    d.doc_url ? btn('Open Doc', { kind: 'text', icon: 'file-text', href: d.doc_url, target: '_blank' }) : '',
    d.filed_url ? btn('Confirmation', { kind: 'text', icon: 'external-link', href: d.filed_url, target: '_blank' }) : '',
    // R-027: earlier testimony on this bill, its companion and its issue, one tap away while this one is being written
    // (only then: in review nobody is writing). An open book: a clock would read as this Doc's version history, a scroll as the Bills tab.
    // A plain link, not a button (A-3), and not shown while the Testimony tab is open beside this card (A-14).
    earlier ? btn(`Earlier testimony (${earlier})`, { kind: 'text', icon: 'book-open', href: testimonyHref(b), attrs: { 'data-earlier': '1' } }) : '',
  ].join('');
  return `<div class="bw-tb" data-tb="${esc(d.id)}">
    ${title ? `<p class="bw-tbt">${title}</p>` : ''}
    ${['cancelled', 'filed'].includes(d.status) ? '' : stepBar(d.status, { second })}
    <p class="bw-who">${esc(whoLine(d))}${own && acts.includes('approve') ? ` ${chip('Your own draft')}` : ''}</p>
    ${d.status === 'draft' && d.review_note ? `<blockquote class="bw-quote"><span class="meta">Changes asked for</span>${esc(d.review_note)}</blockquote>` : ''}
    ${stale ? notice('warn', 'triangle-alert', `The bill is now ${esc(b.current_version)}. This draft was written for ${esc(d.version || 'the introduced bill')}; check it before it goes out.`) : ''}
    ${main || alt ? `<div class="bw-acts">${main}${alt}</div>` : ''}
    ${links ? `<div class="bw-links">${links}</div>` : ''}
  </div>`;
}
// Who from the team is going (R-022 wave 3 #16), you first, or plainly nobody yet. "I'm going" stays; an admin can also
// put one teammate down, who is told by Slack (migration 064 does the telling).
// Going is to a SITTING (one committee at one time), not to one bill's row: it is read from every row of the sitting and
// written on one (the sitting's lead row, as the hearing page writes it), so ten bills in one sitting never send ten
// Slack messages (hearing.js).
const leadOf = h => agendaOf(h).find(x => x.b.position && x.b.position !== 'monitor' && x.h.status !== 'cancelled')?.h || h;
const markedOn = (h, id) => sittingOf(h).filter(r => (S.attend?.[r.id] || []).includes(id));
function attendRow(h) {
  const att = goersOf(sittingOf(h));
  const meIn = att.some(a => a.id === S.me?.id);
  const say = att.length ? `Going: ${andList(att.map(a => a.id === S.me?.id ? 'You' : firstName(a)))}` : 'Nobody from the team yet';
  return `<div class="bw-going"><p class="bw-gwho${att.length ? '' : ' none'}">${icon(att.length ? 'users-round' : 'user-round')}<span>${esc(say)}</span></p>
    <div class="bw-gacts"><button type="button" class="chip" data-attend="${esc(h.id)}" aria-pressed="${meIn}">${icon(meIn ? 'user-check' : 'user-plus')}I’m going</button>${S.me?.is_admin ? `<button type="button" class="chip" data-putdown="${esc(h.id)}" aria-haspopup="dialog">${icon('user-round-plus')}Send a teammate…</button>` : ''}</div></div>`;
}
function watchLink(h) {
  const v = streamOf(h); if (!v) return '';
  const label = v.state === 'live' ? 'Watch live now' : v.state === 'after' ? 'Watch the recording' : 'Watch the hearing';
  return `<a class="btn text bw-watch" data-watch="${esc(h.id)}" href="${esc(v.url)}" target="_blank" rel="noopener"${v.hint ? ` title="${esc(v.hint)}"` : ''}>${icon('video')}<span>${label}</span></a>`;
}
function hearingCard(b, h, i) {
  const d = draftFor(b.id, h.committee), due = dueOf(h), filed = d && d.status === 'filed';
  const meta = [fmtDT(h.scheduled_at), roomOf(h.room), h.committee].filter(Boolean).map(esc).join(' · ');
  const dueLine = d && !filed && d.status !== 'cancelled'
    ? `<p class="bw-due"><span>Testimony due ${esc(fmtDT(due))}</span>${countdown(due)}</p>`
    : `<p class="bw-due"><span>Hearing starts</span>${countdown(h.scheduled_at).replace('left', 'from now')}</p>`;
  const noDraft = !d ? `<p class="small muted bw-nodraft">${b.position && b.position !== 'monitor' ? 'No testimony draft yet. The tracker makes one from the hearing notice.' : 'Monitor bills get no testimony draft.'}</p>` : '';
  return `<section class="card bw-next" aria-labelledby="bw-nx-${i}">
    <div class="bw-nexthead"><h2 class="bw-eyebrow" id="bw-nx-${i}">${i === 0 ? 'Next up' : 'Also coming up'}</h2><span class="bw-nhacts">${btn('Hearing page', { kind: 'text', sm: true, iconEnd: 'chevron-right', href: `#/hearing/${encodeURIComponent(h.id)}?from=${encodeURIComponent(b.bill_number)}`, cls: 'bw-hpage', attrs: { 'aria-label': `The ${h.committee} hearing's page` } })}${iconBtn('ellipsis', 'More for this hearing', { 'data-hmenu': h.id })}</span></div>
    <p class="bw-hear">${esc(cmteFull(h.committee))} ${isJoint(h.committee) ? 'joint hearing' : 'hearing'}</p>
    <p class="bw-meta">${meta}</p>
    ${dueLine}
    ${d ? testimonyBlock(b, d, { primary: true }) : noDraft}
    <div class="bw-hfoot">${attendRow(h)}${watchLink(h)}</div>
  </section>`;
}
// No hearing yet, still in committee: who decides, the deadline, the last regular slot, and a prefilled note to the chair.
function chairLinks(b, code) {
  const legs = legsOf(code);
  const one = c => { const l = legs.find(m => m.roles[c] === 'chair')?.l;
    if (l) return `<a href="#/legislator/${l.id}?from=${esc(b.bill_number)}">${esc(legTitle(l))} ${esc((l.sort_name || '').split(',')[0] || l.name.split(' ').pop())}</a>`;
    const m = chairMail(c); return m ? `<a href="mailto:${esc(m.email)}">${esc(m.who)}</a>` : ''; };
  const found = codesOf(code).map(c => [c, one(c)]).filter(([, x]) => x);
  if (!found.length) return '';
  // One phrase: a line break belongs before "Chair", not between the word and the name.
  return found.length === 1 ? `<span class="bw-chair">Chair ${found[0][1]}</span>` : `Chairs ${found.map(([c, x]) => `<span class="bw-chair">${x} (${esc(c)})</span>`).join(' and ')}`;
}
function chairAskHref(b, code, dl) {
  const m = chairMail(code); if (!m) return '';
  const body = `Aloha ${m.n > 1 ? m.who : 'Chair ' + m.last},\n\nOn behalf of the Hawaiʻi Public Health Institute, I respectfully ask that you schedule ${b.bill_number} (${plainTitle(b)}) for a hearing${dl ? ` before ${dlText(dl)}` : ''}.\n\nMahalo,\n${S.me?.full_name || ''}`;
  return `mailto:${m.email}?subject=${encodeURIComponent(`Hearing request: ${b.bill_number}`)}&body=${encodeURIComponent(body)}`;
}
function needsHearingCard(b) {
  const st = stopOf(b), now = Date.now();
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  const sl = dl && st.committee ? lastSlotBefore(st.committee, dl.date, S.slots) : null;
  const risk = !!riskOf(b), ask = st.committee && b.position && b.position !== 'monitor' ? chairAskHref(b, st.committee, dl) : '';
  const chairs = st.committee ? chairLinks(b, st.committee) : '';
  return `<section class="card bw-next" aria-labelledby="bw-nx-0">
    <div class="bw-nexthead"><h2 class="bw-eyebrow" id="bw-nx-0">Next up</h2></div>
    <p class="bw-hear">${st.committee ? `Needs a hearing in ${esc(cmteFull(st.committee))}` : `Waiting to be sent to a ${CHAMBER_NAME[st.chamber] || ''} committee`}</p>
    ${chairs ? `<p class="bw-meta">${chairs}${st.stops > 1 ? ` · stop ${st.stop} of ${st.stops}` : ''}</p>` : ''}
    ${dl ? `<p class="bw-due"><span>${esc(cap(dlText(dl)))}</span>${daysLeft(dl)}</p>` : ''}
    ${sl ? `<p class="small ${now > sl.noticeBy ? 'bw-late' : 'muted'}">${now > sl.noticeBy ? `${icon('circle-alert')}The notice window for the last regular slot has closed. Call the chair.` : `Last regular slot ${esc(fmtDT(sl.at))}. The notice has to post by ${esc(fmtDT(sl.noticeBy))}.`}</p>` : ''}
    ${ask ? `<div class="bw-acts">${btn('Email the chair', { kind: risk ? 'primary' : 'secondary', icon: 'mail', href: ask })}</div>` : ''}
  </section>`;
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Whole days to a deadline, counted the way the status sentence counts them (stops.js), so the two never disagree.
const daysLeft = dl => dl.days === 0 ? `<span class="sv-count soon">${icon('clock')}Last day today</span>` : `<span class="sv-count">${icon('clock')}${dl.days} day${dl.days === 1 ? '' : 's'} left</span>`;
function recentHearings(b) {
  const now = Date.now();
  const past = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) <= now && new Date(x.scheduled_at) > now - 14 * 864e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  if (!past.length) return '';
  const tone = o => ({ passed: ['ok', 'check'], passed_amended: ['ok', 'check'], deferred: ['', 'circle-x'], recommitted: ['', 'rotate-ccw'] }[o] || ['', 'hourglass']);
  return `<div class="bw-recent"><p class="bw-eyebrow">Recent hearings</p>${past.map(h => {
    const o = S.outcomes?.[h.id], v = streamOf(h), [t, ic] = tone(o?.outcome);
    return `<div class="bw-rh"><p><b>${esc(h.committee)}</b> heard ${esc(fmtDT(h.scheduled_at))} ${chip(o?.outcome ? (OUTCOME_LABEL[o.outcome] || o.outcome) : 'No report yet', t, ic)}</p>
      ${o?.report ? `<p class="small muted bw-clamp">${esc(o.report)}</p>` : ''}
      ${v ? `<a class="bw-inline" href="${esc(v.url)}" target="_blank" rel="noopener">Recording${icon('external-link')}</a>` : ''}</div>`; }).join('')}</div>`;
}
function nextCards(b) {
  const now = Date.now(), dead = diedish(b), st = stopOf(b);
  const ups = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > now).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  const seen = new Set(ups.map(h => draftFor(b.id, h.committee)?.id).filter(Boolean));
  const cards = ups.map((h, i) => hearingCard(b, h, i));
  if (!ups.length && !dead && st.phase === 'committee') cards.push(needsHearingCard(b));
  // Testimony not tied to a hearing still ahead (in review after the hearing moved, approved but not filed…)
  // Unfinished only: once its hearing has passed, a filed draft lives on the Testimony tab (R-027), so this card
  // does not grow all session and nothing is said twice (A-14).
  const other = (S.drafts[b.id] || []).filter(d => !seen.has(d.id) && onNextUp(d))
    .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  if (other.length) cards.push(`<section class="card bw-next" aria-labelledby="bw-nx-t"><div class="bw-nexthead"><h2 class="bw-eyebrow" id="bw-nx-t">${cards.length ? 'Other testimony' : 'Testimony'}</h2>${other.some(d => draftActions(d).some(a => ['withdraw', 'unfile'].includes(a[0]))) ? iconBtn('ellipsis', 'More for this testimony', { 'data-tmenu': other[0].id }) : ''}</div>
    ${other.map((d, i) => testimonyBlock(b, d, { primary: i === 0 && !ups.length, title: `For ${esc(cmteFull(d.committee))}` })).join('')}</section>`);
  const rec = recentHearings(b);
  if (rec) { if (cards.length) cards[cards.length - 1] = cards[cards.length - 1].replace(/<\/section>$/, rec + '</section>'); else cards.push(`<section class="card bw-next">${rec}</section>`); }
  return cards.join('');
}

// ---- testimony transitions: the database checks who may do what; the toast is written from the state that came back ----
const draftById = (b, id) => (S.drafts[b.id] || []).find(x => String(x.id) === String(id));
async function transition(b, d, action, note, url) {
  await DB.transition(b.id, d.id, action, note, url);
  if (S.bwTL) delete S.bwTL[b.id];         // the timeline may have a new entry
  FACTS.clear();
  return draftById(b, d.id) || d;
}
let approvedAt = -1e4;                     // when this page last approved something (see runDraft)
async function runDraft(b, d, act, el) {
  if (act === 'changes') return requestChanges(b, d);
  if (act === 'file') return markFiled(b, d);
  if (el) el.setAttribute('aria-busy', 'true');
  try {
    if (act === 'submit') {
      await transition(b, d, 'submit'); rerender(`[data-tb="${d.id}"] .bw-acts > *`);
      toast(`Sent to ${approverNames()} for review.`, { undo: async () => { await transition(b, d, 'withdraw'); rerender(); toast('Withdrawn. It is a draft again.'); } });
    } else if (act === 'approve') {
      // The same safety as review mode (build 3): a leftover second tap never approves the next step (someone who is
      // both admin and reviewer would find Approve in the same spot), and every approval has Undo, which the server
      // backs with its un-approve (migration 058).
      if (performance.now() - approvedAt < 1000) { if (el?.isConnected) el.removeAttribute('aria-busy'); return; }
      const nd = await transition(b, d, 'approve'); approvedAt = performance.now(); rerender();
      const owner = ownerOf(b), filer = owner || advocate(nd.submitted_by);
      toast(nd.status === 'second_review' ? `Approved. Now needs ${reviewerNames()}.`
        : filer && filer.id === S.me?.id ? 'Approved. File it at the Capitol next.' : `Approved. ${filer ? firstName(filer) : 'The owner'} will file it.`,
        { ok: true, undo: async () => { await transition(b, nd, 'unapprove'); rerender(); toast('Approval undone. It is waiting for you again.'); } });
    } else if (act === 'withdraw') {
      await transition(b, d, 'withdraw'); rerender(); toast('Withdrawn. It is a draft again.');
    } else if (act === 'unfile') {
      await transition(b, d, 'unfile'); rerender(); toast('Unmarked. It is approved and ready to file again.');
    }
  } catch (e) { if (el?.isConnected) el.removeAttribute('aria-busy'); toast(e, { err: true }); }
}
function requestChanges(b, d) {
  const who = advocate(d.submitted_by), to = who && who.id !== S.me?.id ? firstName(who) : '';
  openSheet({ title: 'What should change?', size: 'auto',
    body: `<div class="field"><label for="bw-rc">${to ? `Your note for ${esc(to)}` : 'Your note'}</label><textarea id="bw-rc" rows="4" required aria-describedby="bw-rc-e" placeholder="Say what to fix, so the next version is the last one."></textarea><span class="err" id="bw-rc-e" hidden>${icon('circle-alert')}Write what should change first.</span></div>`,
    foot: btn(to ? `Send back to ${esc(to)}` : 'Send it back', { kind: 'primary', icon: 'undo-2', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const ta = dlg.querySelector('#bw-rc'), er = dlg.querySelector('#bw-rc-e'); ta.focus();
      ta.oninput = () => { er.hidden = true; ta.removeAttribute('aria-invalid'); };
      dlg.querySelector('[data-go]').onclick = async e => {
        const note = ta.value.trim();
        if (!note) { er.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
        // Held ten seconds so the Undo can cancel it before the writer is told (review.js holdBack; B-5): the database has
        // no step that takes a send-back back.
        const undo = holdBack({ key: d.id, target: d, patch: { status: 'draft', review_note: note },
          send: () => transition(b, d, 'request_changes', note),
          onFail: () => { FACTS.clear(); if (S.route?.name === 'bill') rerender(); toast(`${b.bill_number} was not sent back. It is still waiting for you; try again.`, { err: true }); } });
        FACTS.clear(); closeSheet({ silent: true }); rerender();
        toast(to ? `Sent back to ${to} with your note.` : 'Sent back with your note.', { undo: async () => { if (await undo()) { FACTS.clear(); rerender(); toast('Not sent back. It is waiting for you again.'); } } });
      };
    } });
}
function markFiled(b, d) {
  openSheet({ title: `Filed ${esc(b.bill_number)} testimony for ${esc(d.committee)}?`, size: 'auto',
    body: `${field('bw-furl', 'Capitol confirmation link (optional)', '<input id="bw-furl" type="url" inputmode="url" autocomplete="off" placeholder="https://">', 'Paste the link from the Capitol’s confirmation, if you have it.')}
      <p class="bw-shlink">${btn('File at the Capitol', { kind: 'text', icon: 'external-link', href: capitolUrl(b), target: '_blank' })}</p>`,
    foot: btn('Mark filed', { kind: 'primary', icon: 'clipboard-check', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      dlg.querySelector('[data-go]').onclick = async e => {
        const url = dlg.querySelector('#bw-furl').value.trim();
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
        try {
          await transition(b, d, 'file', null, url); closeSheet({ silent: true }); rerender();
          toast(`Filed. ${b.bill_number} is done for ${d.committee}.`, { ok: true, undo: async () => { await transition(b, d, 'unfile'); rerender(); toast('Unmarked. It is approved and ready to file again.'); } });
        } catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
      };
    } });
}
function hearingMenu(b, h) {
  const d = draftFor(b.id, h.committee), acts = d ? draftActions(d).map(a => a[0]) : [];
  menuSheet({ title: `${h.committee} hearing`, items: [
    { label: 'Fix the video link', icon: 'video', sub: h.stream_url ? 'A link is set by staff' : 'Paste the YouTube address for this hearing', run: () => afterBack(() => fixVideo(b, h)) },
    acts.includes('withdraw') ? { label: 'Withdraw from review', icon: 'undo-2', sub: 'It goes back to a draft', run: () => runDraft(b, d, 'withdraw') } : null,
    acts.includes('unfile') ? { label: 'Unmark filed', icon: 'undo-2', sub: 'If it was marked filed by mistake', run: () => runDraft(b, d, 'unfile') } : null,
    h.notice_url ? { label: 'Hearing notice', icon: 'file-text', sub: 'The Capitol’s PDF', run: () => { window.open(h.notice_url, '_blank', 'noopener'); } } : null,
  ] });
}
function testimonyMenu(b, d) {
  const list = (S.drafts[b.id] || []).filter(x => draftActions(x).some(a => ['withdraw', 'unfile'].includes(a[0])));
  menuSheet({ title: 'Testimony', items: list.map(x => { const a = draftActions(x).find(y => ['withdraw', 'unfile'].includes(y[0]))[0];
    return { label: `${a === 'withdraw' ? 'Withdraw from review' : 'Unmark filed'}: ${x.committee}`, icon: 'undo-2', run: () => runDraft(b, x, a) }; }) });
}
function fixVideo(b, h) {
  openSheet({ title: 'Fix the video link', size: 'auto',
    body: `${field('bw-vurl', 'YouTube address for this hearing', `<input id="bw-vurl" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" value="${esc(h.stream_url || '')}">`, 'Leave it blank to go back to the channel link.')}<div id="bw-verr" role="alert"></div>`,
    foot: btn('Save link', { kind: 'primary', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const inp = dlg.querySelector('#bw-vurl'); inp.focus();
      dlg.querySelector('[data-go]').onclick = async e => {
        const url = inp.value.trim();
        if (url && !/^https?:\/\/\S+$/i.test(url)) { dlg.querySelector('#bw-verr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Paste a full address that starts with https://</p>`; inp.setAttribute('aria-invalid', 'true'); return; }
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
        try { await DB.setHearingStream(h.id, url); closeSheet({ silent: true }); rerender(); toast(url ? 'Video link saved.' : 'Back to the channel link.'); }
        catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
      };
    } });
}
// The toast names the one person and says they are told (064 sends it: a Slack message whenever someone else gives
// them a to-do or puts them down for a hearing), unless they turned that kind of message off in My settings.
// told(a, 'todo', 'has it now') -> "Kris has it now and gets a Slack message."
export const told = (a, kind, what) => a?.prefs?.workflow?.[kind] === false
  ? `${firstName(a)} ${what}. They have these messages turned off, so tell them yourself.` : `${firstName(a)} ${what} and gets a Slack message.`;
// Someone goes on the sitting's lead row (one Slack message); off, they come off every row they were marked on.
async function setGoing(h, id, on) {
  const rows = on ? [leadOf(h)] : markedOn(h, id);
  for (const r of rows) await DB.attend(r.id, on, id);
  return rows;
}
const putBack = async (rows, id, on) => { for (const r of rows) await DB.attend(r.id, on, id); };
// An admin sends one teammate to a hearing ("Send a teammate…": "put someone down" reads as belittling in American
// English, R-022 review); someone already going is taken off the same way. Each has Undo, and an undone send within two
// minutes messages nobody (migration 065) unless the Slack tick already ran.
function putDown(b, h) {
  const going = new Set(goersOf(sittingOf(h)).map(a => a.id));
  const people = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: `Send a teammate to the ${esc(h.committee)} hearing`, value: '', help: 'Pick one person. They get a Slack message. Pick someone already going to take them off.',
    options: people.map(a => [a.id, a.full_name, going.has(a.id) ? 'user-check' : 'user-round', going.has(a.id) ? 'Going' : '']),
    onPick: async id => {
      const a = advocate(id), on = !going.has(id), sel = `[data-putdown="${h.id}"]`; if (!a) return;
      try {
        const rows = await setGoing(h, id, on); rerender(sel);
        toast(on ? told(a, 'hearing', `is going to the ${h.committee} hearing`) : `${firstName(a)} is off the ${h.committee} hearing.`,
          { undo: async () => { await putBack(rows, id, !on); rerender(sel); toast(on ? `${firstName(a)} is off it again. The Slack message is stopped if it has not gone yet.` : 'Put back as it was.'); } });
      } catch (e) { rerender(sel); toast(e, { err: true }); }
    } });
}
async function toggleAttend(b, hid) {
  const h = S.hearings.find(x => x.id === hid); if (!h || !S.me) return;
  const on = !markedOn(h, S.me.id).length, sel = `[data-attend="${hid}"]`;
  try {
    const rows = await setGoing(h, S.me.id, on); rerender(sel);
    toast(on ? `You’re going to the ${h.committee} hearing.` : 'You’re not going.', { undo: async () => { await putBack(rows, S.me.id, !on); rerender(sel); } });
  } catch (e) { rerender(sel); toast(e, { err: true }); }
}

// ---- Overview: summary, to do, team note, team, details ----
function todoSection(b) {
  const today = hiToday();
  const list = (S.todos[b.id] || []).slice().sort((x, y) => (x.done - y.done) || (x.sort_order - y.sort_order) || String(x.created_at).localeCompare(String(y.created_at)));
  const open = list.filter(t => !t.done).length;
  const rows = list.map(t => {
    const over = !t.done && t.due_date && t.due_date < today, dueToday = !t.done && t.due_date === today;
    const who = t.assignee_id ? nameOrYou(advocate(t.assignee_id)) : 'Anyone';
    const due = t.due_date ? (over ? `<span class="bw-late">${icon('circle-alert')}Overdue · was due ${esc(dayOf(t.due_date))}</span>` : dueToday ? `<span class="bw-soon">${icon('clock')}Due today</span>` : `Due ${esc(dayOf(t.due_date))}`) : '';
    return `<li class="bw-todo${t.done ? ' done' : ''}" data-todo="${esc(t.id)}">
      <button type="button" class="bw-tick" data-tick="${esc(t.id)}" role="checkbox" aria-checked="${!!t.done}" aria-label="${esc(t.title)}">${icon(t.done ? 'square-check-big' : 'square')}</button>
      <span class="bw-tbody"><span class="bw-ttl">${esc(t.title)}</span><span class="bw-tmeta">${[due, esc(who)].filter(Boolean).join(' · ')}</span></span>
      ${iconBtn('ellipsis', `More for “${t.title}”`, { 'data-tmore': t.id })}
    </li>`;
  }).join('');
  const d = drafts.get(b.id + ':todo') || '';
  return `<section class="bw-sec" aria-labelledby="bw-todo-h">
    <h2 id="bw-todo-h">To do${open ? ` <span class="bw-n">${open}</span>` : ''}</h2>
    ${rows ? `<ul class="rows bw-todos">${rows}</ul>` : ''}
    <form class="bw-addrow" data-todoadd novalidate><label class="sr" for="bw-tdnew">Add a task</label><input id="bw-tdnew" class="input" maxlength="200" placeholder="Add a task" autocomplete="off" value="${esc(d)}">${btn('Add', { kind: 'secondary', icon: 'plus', attrs: { type: 'submit' } })}</form>
  </section>`;
}
function noteSection(b) {
  const d = drafts.get(b.id + ':note'), val = d ?? (b.internal_notes || '');
  return `<section class="bw-sec" aria-labelledby="bw-note-h">
    <h2 id="bw-note-h">Team note <span class="bw-sub">${icon('lock')}never public</span></h2>
    <div class="field"><label class="sr" for="bw-note">Team note</label><textarea id="bw-note" rows="3" placeholder="Context the team should keep: who we talked to, what the chair said, what to watch for.">${esc(val)}</textarea></div>
    <div class="bw-acts">${btn('Save note', { kind: 'secondary', attrs: { 'data-savenote': '1' } })}${d != null && d !== (b.internal_notes || '') ? '<span class="small muted">Not saved yet</span>' : ''}</div>
  </section>`;
}
function teamSection(b, desk) {
  // Each coalition opens its own page (R-022 wave 3: this week's hearings, at-risk bills, the partner memo).
  const coal = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)).filter(Boolean);
  const f = desk ? '' : followText(b);
  // On desktop "Team" is the side panel's card (position, priority, owner, who follows), so this section is named for
  // what it holds. The stage is not here any more: the ribbon at the top says it, once (A-14).
  return `<section class="bw-sec" aria-labelledby="bw-team-h"><h2 id="bw-team-h">${desk ? 'Coalitions' : 'Team'}</h2>
    <div class="rows">
      <div class="row bw-line"><span class="body"><span class="sub">Coalitions</span><span class="title">${coal.length ? coal.map(c => `<a class="bw-coal" href="#/coalition/${esc(c.id)}">${esc(c.name)}</a>`).join(', ') : '<span class="muted">None</span>'}</span></span>${btn('Edit', { kind: 'text', attrs: { 'data-coal': '1', 'aria-label': 'Edit coalitions' } })}</div>
      ${f ? `<div class="row bw-line"><span class="body"><span class="sub">Following</span><span class="title">${esc(f)}</span></span></div>` : ''}
    </div></section>`;
}
function referralsHTML(b) {
  const refs = b.referrals || []; if (!refs.length) return '<span class="muted">None yet</span>';
  const n = Math.min(b.origin_stops || refs.length, refs.length), st = stopOf(b);
  const origin = b.chamber || (b.bill_number.startsWith('S') ? 'S' : 'H'), other = origin === 'H' ? 'S' : 'H';
  const stateOf = (leg, i) => {
    if (st.phase === 'dead' || diedish(b)) return '';
    if (st.leg !== leg) return leg === 'first' ? 'past' : '';
    if (st.phase !== 'committee') return 'past';
    return st.stop === i + 1 ? 'here' : st.stop > i + 1 ? 'past' : '';
  };
  const line = (ch, list, leg) => list.length ? `<span class="bw-refl"><span class="bw-refch">${CHAMBER_NAME[ch]}</span>${list.map((c, i) => { const s = stateOf(leg, i);
    return `<span class="bw-ref ${s}" title="${esc(cmteFull(c))}">${s === 'past' ? icon('check') : s === 'here' ? icon('circle-dot') : ''}${esc(c)}${s === 'here' ? '<span class="sr"> (now)</span>' : s === 'past' ? '<span class="sr"> (passed)</span>' : ''}</span>`; }).join(icon('chevron-right', { cls: 'bw-arr' }))}</span>` : '';
  const second = refs.slice(n);
  return line(origin, refs.slice(0, n), 'first') + (second.length ? line(other, second, 'second') : st.leg === 'second' && st.phase === 'committee' ? `<span class="bw-refl"><span class="bw-refch">${CHAMBER_NAME[other]}</span><span class="muted">Waiting for its referral</span></span>` : '');
}
// The Capitol lists "LEE, M." as two sponsors; put the initial back on its name.
function sponsorList(b) {
  const out = [];
  for (const s of b.sponsors || []) { const n = String(s.n || s.name || s).trim(); if (/^[A-Z]\.$/.test(n) && out.length) out[out.length - 1] += ', ' + n; else if (n) out.push(n); }
  return out.map(sponsorName);
}
// The lines that say where the bill is. Phones list them in Overview > Details; the desktop side panel shows them
// beside every tab, so there they leave Details (one place per fact on a screen).
// There is no Stage line here any more (R-022, A-14): the ribbon above every tab names the stage, and the status sentence
// says where the bill is and what comes next. Three places said it before.
function whereLines(b) {
  const st = stopOf(b);
  const chairs = st.committee ? chairLinks(b, st.committee) : '';
  const cm = st.committee ? `${esc(cmteFull(st.committee))} <span class="muted">(${esc(st.committee)})</span>${chairs ? ` · ${chairs}` : ''}` : st.phase === 'committee' ? `<span class="muted">Waiting for a ${CHAMBER_NAME[st.chamber]} referral</span>` : '';
  return { cm: cm ? `<div class="bw-dt"><dt>Committee</dt><dd>${cm}</dd></div>` : '',
    comp: (b.companions || []).length ? `<div class="bw-dt"><dt>Companion</dt><dd id="bw-comp">${compHTML(b)}</dd></div>` : '' };
}
const capitolLink = b => `<a class="bw-inline" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">Capitol page${icon('external-link')}</a>`;
const copyLinkBtn = '<button type="button" class="linkbtn bw-inline" data-copylink="1">Copy link</button>';
// Details: every fact about the bill in one place, on a phone and on a desktop alike. The side panel used to keep a
// second copy of some of them ("Key facts"), which made the panel taller than the window; one place per fact instead.
function detailsSection(b) {
  const sp = sponsorList(b), all = !!S.bwSponsAll?.[b.id], st = stopOf(b);
  const dead = diedish(b) || st.phase === 'dead';
  const dl = st.deadline && !dead ? st.deadline : null;
  const w = whereLines(b);
  // Which of the chamber's committee stops this is: the referral row marks it, this says it in words.
  const stops = st.phase === 'committee' && st.stops > 1 && !dead
    ? `<span class="bw-gloss">Stop ${st.stop} of ${st.stops} in the ${esc(CHAMBER_NAME[st.chamber] || '')}</span>` : '';
  const live = pubStateCls(b).includes('live');
  const pub = live ? `<a class="bw-inline" href="${esc(PUBLIC_APP() + (DEMO ? '?demo=1' : '') + '#/bill/' + b.bill_number)}" target="_blank" rel="noopener">Public page${icon('external-link')}</a>` : '';
  // The official title names hundreds of bills the same way ("Relating to health"), so it is a detail, not the heading.
  return `<section class="bw-sec" aria-labelledby="bw-det-h"><h2 id="bw-det-h">Details</h2>
    <dl class="bw-dl">
      ${w.cm}
      <div class="bw-dt"><dt>Referrals</dt><dd>${referralsHTML(b)}${stops}</dd></div>
      ${dl ? `<div class="bw-dt"><dt>Next deadline</dt><dd>${esc(gateName({ phase: dl.key, label: dl.label }))}, ${esc(dayOf(dl.date + 'T12:00:00-10:00'))} ${dl.missed ? '<span class="bw-late">' + icon('circle-alert') + 'missed</span>' : daysLeft(dl)}</dd></div>` : ''}
      ${b.last_action ? `<div class="bw-dt"><dt>Last action</dt><dd>${b.last_action_date ? `<span class="muted">${esc(fmtDate(b.last_action_date, { year: '2-digit' }))}</span> ` : ''}<span title="${esc(b.last_action)}">${esc(shortAction(b.last_action))}</span></dd></div>` : ''}
      ${sp.length ? `<div class="bw-dt"><dt>Sponsors</dt><dd><b>${esc(sp[0])}</b> <span class="muted">(lead)</span>${sp.length > 1 ? ', ' + esc(sp.slice(1, all ? sp.length : 5).join(', ')) : ''}${sp.length > 5 && !all ? ` <button type="button" class="linkbtn bw-more" data-sponsall="1">Show all ${sp.length}</button>` : ''}</dd></div>` : ''}
      ${w.comp}
      ${b.title ? `<div class="bw-dt"><dt>Official title</dt><dd>${esc(titleCaseTitle(b.title))}</dd></div>` : ''}
      <div class="bw-dt"><dt>Links</dt><dd><span class="bw-linkrow">${capitolLink(b)}${pub}${copyLinkBtn}</span>${live ? '' : '<span class="bw-gloss">Not on the public page.</span>'}</dd></div>
    </dl>
    ${b.description && summaryOf(b) ? `<details class="bw-fold"><summary>${icon('chevron-down', { cls: 'chev' })}Official description</summary><p class="small">${esc(b.description)}</p></details>` : ''}
  </section>`;
}
// Companions: the other chamber's twin and where it stands. Tracked ones open here; the rest go to the Capitol.
function compHTML(b) {
  const rows = S.bwComp?.[b.id];
  if (!rows) return esc((b.companions || []).join(', '));
  return (b.companions || []).map(num => {
    const r = rows.find(x => x.bill_number === num);
    if (!r) return `<span class="bw-comp">${esc(num)}</span>`;
    const st = r.stage_override || r.stage || 'introduced', inApp = S.bills.some(x => x.id === r.id);
    const link = inApp ? `<a class="bw-inline" href="#/bill/${esc(num)}">${esc(num)}</a>` : `<a class="bw-inline" href="${esc(capitolUrl(r))}" target="_blank" rel="noopener">${esc(num)}${icon('external-link')}</a>`;
    return `<span class="bw-comp">${link} ${chip(STAGE_LABEL[st] || st, st === 'enacted' ? 'ok' : '', st === 'enacted' ? 'check' : st === 'dead' || st === 'vetoed' ? 'circle-x' : '')}${r.tracked ? '' : ' ' + chip('Not tracked')}</span>`;
  }).join('');
}
function loadCompanions(b) {
  if (!(b.companions || []).length) return;
  S.bwComp ??= {}; S.bwCompBusy ??= {};
  if (S.bwComp[b.id] || S.bwCompBusy[b.id]) return;
  S.bwCompBusy[b.id] = true;
  DB.companionInfo(b.companions).then(rows => {
    S.bwComp[b.id] = rows || [];
    const el = document.getElementById('bw-comp'); if (el && billOf(S.route || {})?.id === b.id) el.innerHTML = compHTML(b);
  }).catch(() => { S.bwComp[b.id] = []; }).finally(() => { S.bwCompBusy[b.id] = false; });
}
// The bill's facts come first and the empty form comes last: Details, then what the team has decided, then the two
// boxes that are blank until somebody types in them. An empty input should not own the first screen (assessment 9/19).
function overview(b) {
  const desk = DESK(), desc = (b.description || '').trim();
  // The plain summary is part of the page heading now. Without one, the Capitol's description stands in here.
  const sum = summaryOf(b) ? '' : `<section class="bw-sec bw-sum" aria-labelledby="bw-sum-h"><h2 id="bw-sum-h" class="sr">Summary</h2>
      <p>${desc ? esc(desc) : '<span class="muted">No summary yet. Write one on the Public tab.</span>'}</p>
      ${desc ? '<p class="meta">The official description. A plain summary can be written on the Public tab.</p>' : ''}</section>`;
  return `${sum}${detailsSection(b)}${teamSection(b, desk)}${todoSection(b)}${noteSection(b)}`;
}

// ---- To do, note, coalitions, stage: wiring ----
// Asking for help goes to ONE person (Nate, 9/21: "it shouldn't be a message to all, it should be focused to a specific
// person"): "Ask someone to take this" picks one teammate, who has it from then on and is told by Slack. There is no
// "anyone" and no list everyone sees.
function todoMenu(b, t) {
  const mineNow = t.assignee_id === S.me?.id, who = t.assignee_id && !mineNow ? advocate(t.assignee_id) : null;
  menuSheet({ title: t.title, items: [
    t.done ? null : { label: 'Ask someone to take this', icon: 'user-round-plus', sub: who ? `${firstName(who)} has it now` : 'One teammate, who gets a Slack message', run: () => afterBack(() => todoAsk(b, t)) },
    t.done || mineNow ? null : { label: 'Take it yourself', icon: 'user-check', sub: who ? `Instead of ${firstName(who)}` : '', run: () => setTodoPerson(b, t, S.me?.id || null) },
    { label: t.due_date ? 'Change the due date' : 'Add a due date', icon: 'calendar-days', sub: t.due_date ? `Due ${dayOf(t.due_date)}` : '', run: () => afterBack(() => todoDue(b, t)) },
    { label: 'Delete task', icon: 'trash-2', danger: true, run: () => todoDelete(b, t) },
  ] });
}
function todoDue(b, t) {
  openSheet({ title: 'Due date', size: 'auto', body: field('bw-tdd', `Due date for “${esc(t.title)}”`, `<input id="bw-tdd" type="date" value="${esc(t.due_date || '')}">`),
    foot: `${t.due_date ? btn('Remove the date', { kind: 'text', attrs: { 'data-clear': '1' } }) : ''}${btn('Save date', { kind: 'primary', attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      const save = async v => {
        const before = t.due_date || null, now = v || null; if (now === before) { closeSheet({ silent: true }); return; }
        try {
          await DB.updateTodo(b.id, t.id, { due_date: now }); closeSheet({ silent: true }); rerender();
          toast(now ? `Due ${dayOf(now)}.` : 'No due date now.', { undo: async () => { await DB.updateTodo(b.id, t.id, { due_date: before }); rerender(); toast('Put back as it was.'); } });
        } catch (e) { toast(e, { err: true }); }
      };
      dlg.querySelector('[data-go]').onclick = () => save(dlg.querySelector('#bw-tdd').value);
      dlg.querySelector('[data-clear]')?.addEventListener('click', () => save(''));
    } });
}
function todoAsk(b, t) {
  const people = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: 'Who should take it?', value: t.assignee_id || '', help: `“${esc(t.title)}”. Only the person you pick is asked, and they get a Slack message.`,
    options: people.map(a => [a.id, a.full_name, 'user-round']), onPick: v => setTodoPerson(b, t, v || null) });
}
// Undo puts the to-do back with whoever had it. (Handing it back to someone else tells them again: the database sends a
// message on every change of person to someone other than you.)
async function setTodoPerson(b, t, v) {
  const before = t.assignee_id || null; if (v === before) return;
  const sel = `[data-tmore="${CSS.escape(String(t.id))}"]`;
  try {
    await DB.updateTodo(b.id, t.id, { assignee_id: v }); rerender(sel);
    const a = advocate(v), was = advocate(before);
    toast(v === S.me?.id ? 'It is yours now.' : told(a, 'todo', 'has it now'), { undo: async () => {
      await DB.updateTodo(b.id, t.id, { assignee_id: before }); rerender(sel);
      toast(!before ? 'Put back as it was.' : before === S.me?.id ? 'It is yours again.' : `Back with ${firstName(was)}.`);
    } });
  } catch (e) { toast(e, { err: true }); }
}
async function todoDelete(b, t) {
  const keep = { ...t };
  try {
    await DB.deleteTodo(b.id, t.id); rerender();
    toast('Task deleted.', { undo: async () => {
      await DB.addTodo(b.id, keep.title);
      const n = (S.todos[b.id] || []).slice(-1)[0];
      if (n) await DB.updateTodo(b.id, n.id, { due_date: keep.due_date || null, assignee_id: keep.assignee_id || null, done: !!keep.done });
      rerender();
    } });
  } catch (e) { toast(e, { err: true }); }
}
function editCoalitions(b) {
  const body = () => S.campaigns.length ? `<p class="small muted bw-shhelp">Tap to add or remove. Each change saves.</p><div class="sv-pickl">${S.campaigns.map(c => { const on = (S.billCampaigns[b.id] || []).includes(c.id);
    return `<button type="button" role="checkbox" aria-checked="${on}" data-camp="${esc(c.id)}">${icon(on ? 'square-check-big' : 'square', { cls: on ? 'on' : '' })}<span class="body"><span class="title">${esc(c.name)}</span></span></button>`; }).join('')}</div>`
    : '<p class="muted">No coalitions yet. An admin adds them under Session setup.</p>';
  openSheet({ title: `Coalitions for ${esc(b.bill_number)}`, body: body(),
    onClose: () => rerender('[data-coal]'),
    wire: dlg => {
      const wireBtns = () => dlg.querySelectorAll('[data-camp]').forEach(el => el.onclick = async () => {
        const id = el.dataset.camp, on = el.getAttribute('aria-checked') !== 'true', nm = S.campaigns.find(c => c.id === id)?.name || 'the coalition';
        el.disabled = true;
        try { await DB.toggleCampaign(b.id, id, on); FACTS.clear(); dlg.querySelector('.sv-sh-body').innerHTML = body(); wireBtns(); dlg.querySelector(`[data-camp="${CSS.escape(id)}"]`)?.focus(); toast(on ? `Added to ${nm}.` : `Removed from ${nm}.`); }
        catch (e) { el.disabled = false; toast(e, { err: true }); }
      });
      wireBtns();
    } });
}
function pickStage(b) {
  pickerSheet({ title: 'Stage', value: b.stage_override || '', help: 'Set it by hand only when the Capitol’s record is wrong. Automatic follows the sync.',
    options: [['', `Automatic (${STAGE_LABEL[b.stage || 'introduced'] || b.stage})`, 'rotate-ccw'], ...STAGES.map(([v, l]) => [v, l, ''])],
    onPick: v => saveWithUndo(b, { stage_override: v || null }, '[data-stage]') });
}

// ---- the page ----
function topBar(b, route) {
  const o = origin(route), nb = neighbours(b);
  return `<div class="bw-top">
    <a class="bw-back" href="${esc(o.href)}" data-back>${icon('chevron-left')}<span>${esc(o.label)}</span></a>
    <span class="bw-topnum" aria-hidden="true"><b>${esc(b.bill_number)}</b>${b.nickname ? ` · ${esc(b.nickname)}` : ''}</span>
    ${nb ? `<div class="bw-nav" role="group" aria-label="Move through ${esc(o.label)}">
      ${nb.prev ? `<a class="btn text bw-pn" href="${billHref(nb.prev, tabOf(route))}" data-nav="prev" aria-label="Previous bill: ${esc(nb.prev.bill_number)}" title="${esc(nb.prev.bill_number)} ([)">${icon('chevron-left')}<span>Previous</span></a>` : `<span class="btn text bw-pn" aria-disabled="true">${icon('chevron-left')}<span>Previous</span></span>`}
      <span class="meta">${nb.i + 1} of ${nb.n}</span>
      ${nb.next ? `<a class="btn text bw-pn" href="${billHref(nb.next, tabOf(route))}" data-nav="next" aria-label="Next bill: ${esc(nb.next.bill_number)}" title="${esc(nb.next.bill_number)} (])"><span>Next</span>${icon('chevron-right')}</a>` : `<span class="btn text bw-pn" aria-disabled="true"><span>Next</span>${icon('chevron-right')}</span>`}
    </div>` : ''}
    ${iconBtn('ellipsis', `More for ${b.bill_number}`, { 'data-bwmore': '1' })}
  </div>`;
}
function tabsNav(b, tab) {
  const n = unreadCount(b), keys = keysOn();
  // The number keys are named on each tab (title, aria-keyshortcuts) and once at the end of the strip on desktop.
  return `<div class="bw-tabsent" aria-hidden="true"></div><nav class="bw-tabs" aria-label="${esc(b.bill_number)} sections">${TABS.map(([k, l], i) =>
    `<a href="${billHref(b, k)}" data-tab="${k}" ${k === tab ? 'aria-current="page"' : ''} title="${l}${keys ? ` (${i + 1})` : ''}"${keys ? ` aria-keyshortcuts="${i + 1}"` : ''}>${l}${k === 'activity' && n ? `<span class="bw-badge" aria-label="${n} new">${n}</span>` : ''}</a>`).join('')}${keys ? `<span class="bw-khint" aria-hidden="true">${icon('keyboard')}1 to 5</span>` : ''}</nav>`;
}
function panel(b, tab) {
  if (tab === 'activity') { loadTimeline(b); return renderActivity(b, { inline: DESK() }); }
  if (tab === 'pathway') { try { return renderPathway(b); } catch (e) { console.error(e); return empty({ title: 'The pathway could not be drawn', text: 'Try again in a moment.' }); } }
  if (tab === 'public') return renderPublic(b);
  if (tab === 'testimony') return renderTestimony(b);
  loadCompanions(b);
  return overview(b);
}
function notFound(route) {
  const num = String(route.num || '').toUpperCase();
  return `<div class="bw-page"><h1 class="bw-num">${esc(num || 'Bill')}</h1>${empty({ h: 'h2', title: num ? `${esc(num)} is not on our list` : 'Which bill?', text: num ? 'It may not be tracked yet. Search for it to track it.' : 'Find it by number or words.',
    action: btn(num ? `Search for ${esc(num)}` : 'Search bills', { href: '#/search' + (num ? '?q=' + encodeURIComponent(num) : ''), icon: 'search' }) })}</div>`;
}

// The heading: number (on phones it is in the frame's header), what the bill is called, how far it has walked
// towards becoming law, and where it stands in one sentence. The ribbon is the one graphic worth keeping from the
// current app, and the heading is shared by all four tabs, so it stands above every one of them: the Pathway tab is
// then somewhere to go for the detail, not the only place the information exists.
// A stage set by hand (only when the Capitol's record is wrong): what the Capitol says, and Change for admins, on the one
// place the stage is shown. Without an override an admin finds "Correct the stage" in the page's ⋯ menu.
function stageSet(b) {
  if (!b.stage_override) return '';
  const auto = STAGE_LABEL[b.stage || 'introduced'] || b.stage;
  return `<p class="bw-stset">${icon('pencil')}<span>Set by hand; the Capitol’s record says ${esc(auto)}.</span>${S.me?.is_admin ? btn('Change', { kind: 'text', sm: true, attrs: { 'data-stage': '1', 'aria-label': 'Change the stage, set by hand' } }) : ''}</p>`;
}
function headHTML(b, { chips }) {
  const nick = String(b.nickname || '').trim(), sum = summaryOf(b);
  return `<header class="bw-head">
    <h1 class="bw-num">${esc(b.bill_number)}${b.current_version ? ` <span class="bw-ver">${esc(b.current_version)}</span>` : ''}</h1>
    <p class="bw-title${nick || !sum ? '' : ' bw-long'}">${esc(billName(b))}</p>
    ${nick && sum ? `<p class="bw-lede">${esc(sum)}</p>` : ''}
    <div class="bw-ribwrap${b.stage_override ? ' bw-ribset' : ''}">${stageRibbon(b)}${stageSet(b)}</div>
    <p class="bw-status">${icon('route')}<span>${statusSentence(b)}</span></p>
    ${chips ? teamChips(b) : ''}
  </header>`;
}
// Phones: the frame's header holds the back label, the number, ⋯, search and your menu in 320 to 390px. The number
// must never be cut ("Muted bills HB1…"), so a label that would not fit beside it becomes "Back" (the frame already
// does this for labels over 12 characters). Widths are measured, not guessed from a character count.
let mctx = null;
const textW = (t, font) => { try { mctx ??= document.createElement('canvas').getContext('2d'); mctx.font = font; return mctx.measureText(t).width; } catch { return String(t).length * 10; } };
function fitBack(o, b) {
  if (DESK() || !b || o.label.length > 12 || o.label === 'Back') return o;
  const ver = b.current_version && innerWidth >= 360 ? ' ' + b.current_version : '';   // bill.css hides the version below 360px
  const room = innerWidth - 164;           // less the header's padding and gaps and its three 44px buttons
  // 36px is the back link's chevron and padding; 4px of slack covers a fallback font before Lato and Roboto arrive.
  const need = 36 + textW(o.label, '700 16px Lato, sans-serif') + textW(b.bill_number + ver, '700 18px Roboto, sans-serif') + 4;
  return need > room ? { ...o, label: 'Back' } : o;
}

export default {
  tab: 'bills',
  title: r => { const b = billOf(r); return b ? billNum(b) : (r.num || 'Bill'); },
  back: r => fitBack(origin(r), billOf(r)),
  // On Activity the message box takes the tab bar's place at the bottom (like select mode on Bills).
  noTabs: r => tabOf(r) === 'activity' && !!billOf(r),
  // The page takes the width the frame offers and caps itself (bill.css: 1056px, the frame's standard page), so
  // between 900 and 1100px, where a standard page is a 720px column, the two columns still have room.
  wide: () => true,
  render(route) {
    const b = billOf(route); if (!b) return notFound(route);
    const tab = tabOf(route), desk = DESK();
    // A tab that was just opened fades in, so a key press (1 to 4) is seen to do something. Not on a re-render.
    const pnl = `<div class="bw-panel${fresh ? ' bw-in' : ''}" id="bw-panel" data-panel="${tab}">${panel(b, tab)}</div>`;
    if (!desk) return `<div class="bw-page" data-bw="${esc(b.id)}">${topBar(b, route)}${headHTML(b, { chips: true })}${nextCards(b)}${tabsNav(b, tab)}${pnl}</div>`;
    // The side panel is Next up and Team; its first card stays in view (.sv-stick) while the rest scrolls with the page.
    const cards = (nextCards(b) + teamCard(b)).replace('<section class="card ', '<section class="card sv-stick ');
    return `<div class="bw-page bw-desk" data-bw="${esc(b.id)}">
      ${topBar(b, route)}
      <div class="sv-cols bw-cols">
        <div class="bw-main">
          <div class="bw-stick">${headHTML(b, { chips: false })}${tabsNav(b, tab)}</div>
          ${pnl}
        </div>
        <aside class="sv-aside bw-aside" aria-label="${esc(b.bill_number)} at a glance">${cards}</aside>
      </div>
    </div>`;
  },
  // Phones: the message box is the page's bottom bar on Activity. Desktop: it sits at the end of the stream, in the column.
  bar(route) { const b = billOf(route); return b && tabOf(route) === 'activity' && !DESK() ? composerBar(b) : ''; },
  wire(route, root) {
    const b = billOf(route);
    if (!b) { const h1 = root.querySelector('.sv-hdr .sv-title'); if (h1) h1.textContent = String(route.num || 'Bill').toUpperCase(); return; }
    const tab = tabOf(route), page = root.querySelector('.bw-page');
    // Opened by a link or a reload (not a tab tap, not Previous / Next, not Back, not a re-render after a save)?
    const arrival = fresh && !switching && !popping;
    const inApp = !!prevRoute && !(prevRoute.name === 'bill' && prevRoute.num === route.num);
    // Remember the origin in this history entry, so coming Back to the bill still names the right page.
    const o = origin(route); carry = null;
    try { if (!history.state?.bwFrom || history.state.bwFrom.href !== o.href) history.replaceState({ ...(history.state || {}), bwFrom: o }, ''); } catch { /* ignore */ }
    // Phones: the frame's header is this page's top bar. Put the number (the page's h1) and the ⋯ menu in it.
    const hdr = root.querySelector('.sv-hdr');
    if (hdr) {
      const h1 = hdr.querySelector('.sv-title');
      if (h1) h1.innerHTML = `${esc(b.bill_number)}${b.current_version ? ` <span class="bw-ver bw-hv">${esc(b.current_version)}</span>` : ''}`;
      if (!hdr.querySelector('.bw-hdrmore')) (hdr.querySelector('.sv-srchbtn') || hdr.querySelector('.sv-avbtn'))?.insertAdjacentHTML('beforebegin', iconBtn('ellipsis', `More for ${b.bill_number}`, { 'data-bwmore': '1' }, 'bw-hdrmore'));
      // A label shortened to "Back" so the number fits (fitBack) still says where it goes to a screen reader.
      const bk = hdr.querySelector('.sv-back');
      if (bk && !bk.hasAttribute('aria-label') && o.label !== 'Back' && bk.textContent.trim() === 'Back') bk.setAttribute('aria-label', `Back to ${o.label}`);
    }
    root.querySelectorAll('[data-bwmore]').forEach(el => el.onclick = () => pageMenu(b));
    // Previous / Next replace this entry, so Back still goes to the list.
    page.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); const nb = neighbours(b), to = nb && (a.dataset.nav === 'prev' ? nb.prev : nb.next); if (to) goBill(to); }));
    // Tabs (and any other link to a tab of this bill) replace the entry too, and bring the tab into view.
    page.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); switchTab(a.dataset.tab); }));
    page.querySelectorAll('[data-copylink]').forEach(el => el.onclick = () => copyLink(b));
    page.querySelectorAll('[data-stage]').forEach(el => el.onclick = () => pickStage(b));
    // header chips
    page.querySelector('[data-bwpick="pos"]').onclick = () => pickPosition(b);
    page.querySelector('[data-bwpick="pri"]').onclick = () => pickPriority(b);
    page.querySelector('[data-bwpick="own"]').onclick = () => pickOwner(b);
    // Next up
    page.querySelectorAll('[data-dact]').forEach(el => el.onclick = () => { const d = draftById(b, el.dataset.draft); if (d) runDraft(b, d, el.dataset.dact, el); });
    page.querySelectorAll('[data-attend]').forEach(el => el.onclick = () => toggleAttend(b, el.dataset.attend));
    page.querySelectorAll('[data-putdown]').forEach(el => el.onclick = () => { const h = S.hearings.find(x => x.id === el.dataset.putdown); if (h) putDown(b, h); });
    page.querySelectorAll('[data-hmenu]').forEach(el => el.onclick = () => { const h = S.hearings.find(x => x.id === el.dataset.hmenu); if (h) hearingMenu(b, h); });
    // "Earlier testimony" moves to the tab the way a tab does: this history entry is replaced, so Back leaves the bill.
    page.querySelectorAll('[data-earlier]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); switchTab('testimony'); }));
    page.querySelectorAll('[data-tmenu]').forEach(el => el.onclick = () => testimonyMenu(b));
    // panels
    const pnl = page.querySelector('#bw-panel');
    // "Write it" on Today (and ?ask=1) opens the Public tab at the ask, with the cursor in it, the way ?reply=1
    // opens Activity at the message box. A tab tap never does: it would raise the keyboard uninvited.
    const focusAsk = tab === 'public' && arrival && (!!(route.q?.ask || route.q?.focus === 'ask') || (inApp && !String(b.public_action || '').trim()));
    measureStick();                        // publishes --bw-under before the tab's own sticky pieces are placed
    markScrolled();
    if (tab === 'overview') wireOverview(pnl, b);
    else if (tab === 'activity') wireActivity(pnl, b, route, root);
    else if (tab === 'pathway') { try { wirePathway(pnl, b); } catch (e) { console.error(e); } }
    else if (tab === 'public') wirePublic(pnl, b, { focusAsk });
    else if (tab === 'testimony') wireTestimony(pnl, b);
    // A deep link to a tab (#/bill/HB1562/pathway) on a phone: the strip goes under the header so the tab's content
    // is what shows, as a tap on the tab does. After the frame's own scroll to the top, hence the frame's next paint.
    // Activity and the ask bring themselves into view; on desktop the content is on the first screen already.
    if (arrival && !DESK() && (tab === 'pathway' || tab === 'testimony' || (tab === 'public' && !focusAsk))) requestAnimationFrame(() => window.scrollTo(0, pinY()));
  },
};

function wireOverview(pnl, b) {
  // to do
  pnl.querySelectorAll('[data-tick]').forEach(el => el.onclick = async () => {
    const t = (S.todos[b.id] || []).find(x => String(x.id) === el.dataset.tick); if (!t) return;
    const done = !t.done; el.disabled = true;
    try { await DB.updateTodo(b.id, t.id, { done }); rerender(`[data-tick="${CSS.escape(String(t.id))}"]`);
      if (done) toast('Done.', { undo: async () => { await DB.updateTodo(b.id, t.id, { done: false }); rerender(); } }); }
    catch (e) { el.disabled = false; toast(e, { err: true }); }
  });
  pnl.querySelectorAll('[data-tmore]').forEach(el => el.onclick = () => { const t = (S.todos[b.id] || []).find(x => String(x.id) === el.dataset.tmore); if (t) todoMenu(b, t); });
  const form = pnl.querySelector('[data-todoadd]'), inp = pnl.querySelector('#bw-tdnew');
  inp.oninput = () => drafts.set(b.id + ':todo', inp.value);
  form.onsubmit = async e => {
    e.preventDefault();
    const title = inp.value.trim();
    if (!title) { toast('Type the task first.'); inp.focus(); return; }
    try { await DB.addTodo(b.id, title); drafts.delete(b.id + ':todo'); rerender('#bw-tdnew'); toast('Task added.'); }
    catch (x) { toast(x, { err: true }); }
  };
  // team note: never public; typed text survives other saves until it is saved
  const note = pnl.querySelector('#bw-note');
  note.oninput = () => drafts.set(b.id + ':note', note.value);
  pnl.querySelector('[data-savenote]').onclick = async e => {
    const v = note.value.trim(), before = b.internal_notes ?? null; const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
    // Saving replaces the note, so the note it replaced comes back with Undo (R-005; DESIGN B-5).
    try { await DB.updateBill(b.id, { internal_notes: v || null }); drafts.delete(b.id + ':note'); rerender('[data-savenote]');
      toast('Note saved.', { undo: async () => { try { await DB.updateBill(b.id, { internal_notes: before }); drafts.delete(b.id + ':note'); rerender('#bw-note'); toast('Note put back as it was.'); } catch (x) { toast(x, { err: true }); } } }); }
    catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
  pnl.querySelector('[data-coal]').onclick = () => editCoalitions(b);
  pnl.querySelector('[data-sponsall]')?.addEventListener('click', () => { (S.bwSponsAll ??= {})[b.id] = true; rerender(); });
}
