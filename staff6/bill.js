// HIPHI Staff v6 · the bill page (R-336, V6-SPEC section 6; V22, V05, V04, V17; R-264's workspace, rebuilt). A person comes
// here to do their step on one bill, or to see whose step it is, and to talk with the team about it (B-1). The page has its
// own address (#/bill/HB1562, /talk, /public): Back works and a link can be shared.
// v5 put the step in a side column 480px down, Follow in a "…" menu, and codes, referrals, sponsors and members on the
// first screen (assessment X28, X27, X4: 26 controls on the first laptop screen). v6, one column, top to bottom:
//   the header: the bill's name (nickname, edited in the header), its number, the position and owner in words, its issue,
//               Follow as a visible button (not for the owner, whose bill it is), and one "…" for the rare changes
//               (position, owner, mute, copy link);
//   the stage tracker (tracker.js, R-336): a bar of the bill's stops with the deadlines still ahead and two short lines
//               of words, on every tab (it took over the header's "where it stands" line);
//   the tabs:   Next step · Team talk · Public (keys 1, 2, 3; #/bill/X, #/bill/X/talk, #/bill/X/public);
//   Next step:  "What's next for you", the ONE step card (steps.js stepCard, where 'bill': the viewer's own step with its
//               filled button, someone else's as a status, a chair ask, Ask the chair to schedule a vote), the bill's to-dos under
//               it (F115), what else is coming (other sittings as hearing cards), then three labelled 44px doors:
//               About this bill (codes, referrals, sponsors, coalitions, the stage), Committees (each stop and its
//               members, pathway.js) and Earlier testimony (testimony.js).
// Team talk is activity.js, Public is public.js. Old links land where the content lives now (TAB_ALIAS, SECTION_OF):
// #/bill/X/overview and /activity redirect in app.js; /pathway and /testimony open their door.
import { S, DB, DEMO, APP_URL, STAGES, STAGE_LABEL, hooks, esc, fmtDT, fmtDate, advocate, capitolUrl, isOwner, isMuted } from './data.js';
import { CHAMBER_NAME } from '../stops.js';
import { FACTS, stopOf, diedish, whyDead, riskOf, hearingAhead, codesOf, cmteName, blurb, titleCaseTitle, sponsorName, legsOf, legTitle, legById,
  unreadCount, hiToday, gateName, gateNeed, personName, pubStateCls, PUBLIC_APP, draftHearing, billRef, streamOf } from './model.js';
import { personById, SESSION_OVER, SESSION_YEAR } from './data.js';
import { icon, btn, iconBtn, chip, POS_ICON, POS_WORD, POS_SUB, ownerOf, empty, toast, openSheet, closeSheet,
  pickerSheet, menuSheet, confirmSheet, field, keysOn, docBtn } from './ui.js';
import { renderCommittees, wireCommittees } from './pathway.js';
import { renderActivity, wireActivity, loadTimeline, shortAction, noteByText } from './activity.js';
import { renderPublic, wirePublic, wireDraftsFocus } from './public.js';
import { renderEarlier, wireTestimony, earlierCount, onNextUp } from './testimony.js';
import { billRoute, billByNum, MEMO_SAYS, plain, companionsOf, wantsHearing, chairAskMail, chairAskOf, ASK_LOG, liveAsk } from './model.js';
import { askConflict } from './conflict.js';
import { untrackedHTML, wireUntracked, untrackedOf } from './untracked.js';
import { issuesOfBill } from './issues.js';
import { issueCardHTML } from './issuepage.js';   // the issue card at the top of the right column (R-346)
import { dayOf } from './standing.js';
import { askedChip } from './chairask.js';
import { teamFirst, teamName, newOwnerTag } from './model.js';
import { logConversation } from './conversation.js';
import { askTodoOf } from './push.js';
import { stepCard, billStep, whereWords, numWords, sayWords, committeeName, hearingCard, nw, timeWords, openCounts, goingRowHTML, dayWords } from './steps.js';
import { roomName, movedFrom } from './model.js';
import { aboutBill } from './billpane.js';
import { trackerHTML, wireTracker } from './tracker.js';
// A share to-do read as Today and Team read it (the rallier's public ask, by its own time), worked out once in today.js.
import { shareTodoWords } from './today.js';

// ---- small shared helpers (activity.js, public.js, testimony.js, hearing.js, coalition.js, review.js use these) ----
export const firstName = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
// R-316 W28 (G3-8): an owner or a to-do's person who is turned off says so; firstName stays plain for chat bylines.
export const nameOrYou = a => a ? (a.id === S.me?.id ? 'You' : teamFirst(a)) : 'No one';
export const andList = arr => arr.length <= 1 ? (arr[0] || '') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`;
// "Wed 3/18" (standing.js, shared with the issue and coalition pages): re-exported for public.js.
export { dayOf };
// "RELATING TO YOUTH MENTAL HEALTH." -> "Youth mental health": the subject is the bill's name to staff.
export function plainTitle(b) {
  let t = String(b.title || '').trim().replace(/\.$/, '').replace(/^RELATING TO\s+(THE\s+)?/i, '');
  if (!t) return blurb(b, 80);
  if (t === t.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t.replace(/\bhawai[ʻ']?i\b/gi, 'Hawaiʻi').replace(/\bhawaiian\b/gi, 'Hawaiian').replace(/\bkupuna\b/gi, 'kūpuna');
}
// The team's plain summary (one sentence a neighbour would understand), when someone has written it.
export const summaryOf = b => String(b?.public_summary || '').trim();
// What a bill is called on its page: the nickname when it has one ("Disposable e-cigarette ban"), else the plain summary,
// else the subject of the official title. 574 of 734 bills share an official title with another ("Health", "Waste
// management"), so that title is a detail in About this bill, never the heading (R-271).
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
// Text typed but not saved yet (a team note, a message, the public copy, the nickname) outlives the re-render a save
// elsewhere causes.
export const drafts = new Map();
// A team note typed and not saved lives only in this tab: moving between bills keeps it, but a reload or closing the
// tab would lose it without a word (R-005; DESIGN C-9). The browser asks first.
addEventListener('beforeunload', e => {
  for (const [k, v] of drafts) { if (!k.endsWith(':note')) continue;
    const b = (S.bills || []).find(x => String(x.id) === k.slice(0, -5));
    if (b && v.trim() !== (b.internal_notes || '').trim()) { e.preventDefault(); e.returnValue = ''; return; } }
});

// ---- which bill, which tab ----
// The internal keys stay v5's (route.tab 'overview' | 'activity' | 'public', as app.js parses them); the words and the
// addresses are v6's: Next step (#/bill/X), Team talk (#/bill/X/talk), Public (#/bill/X/public).
const TABS = [['overview', 'Next step'], ['activity', 'Team talk'], ['public', 'Public']];
// Old links (the current app's tab names, Slack's #bill=…&tab=chat, v2's Pathway and Testimony tabs) land where the
// content lives now. The team note is on Team talk, so "notes" goes there.
const TAB_ALIAS = { chat: 'activity', timeline: 'activity', notes: 'activity', talk: 'activity', details: 'overview', team: 'overview', pathway: 'overview', committees: 'overview', testimony: 'overview', next: 'overview', about: 'overview' };
// The door of Next step an old tab's link opens: Committees (Pathway), Earlier testimony (Testimony), About (Details).
const SECTION_OF = { pathway: 'cmt', committees: 'cmt', testimony: 'earlier', details: 'about', about: 'about' };
const tabOf = r => { const t = TAB_ALIAS[r.tab] || r.tab; return TABS.some(([k]) => k === t) ? t : 'overview'; };
const billOf = r => billByNum(r.num, r.year);
const billHref = (b, tab = 'overview') => tab === 'overview' ? billRoute(b) : billRoute(b, tab === 'activity' ? 'talk' : tab);

// ---- where the page was opened from: the back link names it ("Today") ----
// The frame sets S.route on every render, so watching that setter tells us the page shown before this one. The origin
// is stored in the history entry (history.state.bwFrom) so it survives coming Back from a legislator page, and it is
// carried across tab switches and Previous / Next, which replace the entry instead of adding one.
let prevRoute = null, prevHash = '', carry = null, lastKey = '', fresh = true;
(() => {
  let cur = S.route, curHash = '';
  Object.defineProperty(S, 'route', { configurable: true, enumerable: true, get: () => cur,
    set(v) {
      const same = cur && v && cur.name === 'bill' && v.name === 'bill' && cur.num === v.num && cur.year === v.year;
      if (cur && !same) { prevRoute = cur; prevHash = curHash; }
      // A render of a different page or tab (not a re-render after a save) is a fresh view; an old Pathway or Testimony
      // link is Next step with a door open, a view of its own.
      const k = v ? `${v.name}|${v.year || ''}${v.num || v.id || ''}|${v.name === 'bill' ? tabOf(v) + (SECTION_OF[v.tab] || '') : ''}` : '';
      fresh = k !== lastKey; lastKey = k;
      cur = v; curHash = location.hash;
    } });
})();
// True while rendering a page or tab that was just opened, false on a re-render of the same one.
export const viewIsNew = () => fresh;
const LABEL = { today: 'Today', hearings: 'Hearings', hearing: 'Hearing', testimony: 'Testimony', review: 'Review', triage: 'Sort new bills', memo: 'Partner update',
  partners: 'Partner update', asks: 'Outreach', outreach: 'Outreach', legislators: 'Legislators', search: 'Search', supporters: 'Supporters', lists: 'Lists',
  emails: 'Emails', composer: 'Email', me: 'My settings', setup: 'Session setup', help: 'Help', inbox: 'Inbox', myissues: 'My issues', issues: 'All issues',
  team: 'Team', people: 'People', tools: 'More tools', more: 'More', pgroups: 'Partners' };
function labelFor(r) {
  if (r.name === 'bills') return r.muted ? 'Muted bills' : 'Bills';
  if (r.name === 'legislator') { const l = legById(r.id); return l ? `${legTitle(l)} ${(l.sort_name || l.name || '').split(',')[0]}` : 'Legislator'; }
  if (r.name === 'person') { const p = personById(r.id); return p ? personName(p) : 'Supporter'; }
  if (r.name === 'list') return (S.lists || []).find(l => String(l.id) === String(r.id))?.title || 'List';
  if (r.name === 'bill') return String(r.num || 'Bill').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
  return LABEL[r.name] || 'Back';
}
function origin(route) {
  if (carry) return carry;
  const saved = history.state && history.state.bwFrom;
  if (saved && saved.href) return saved;
  // The frame names the page this one was opened from (history.state.from, the title it showed), as the phone's top bar
  // does; otherwise a list screen may say where it is (S.billNav); otherwise Today, where a Slack link's Back goes.
  if (prevRoute && !(prevRoute.name === 'bill' && prevRoute.num === route.num && prevRoute.year === route.year)) return { href: prevHash || '#/', label: history.state?.from || labelFor(prevRoute) };
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
const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const PHONE = () => { try { return !matchMedia('(min-width: 768px)').matches; } catch { return false; } };
let switching = false;                     // true while a tab change or Previous / Next draws the page
function goBill(b, tab) {
  carry = origin(S.route);                 // same origin: Back still returns to the list, not to the bill before
  switching = true;
  try { S.go(billHref(b, tab || tabOf(S.route)), { replace: true }); } finally { switching = false; }
}
// The bottom edge of what pins at the top (the frame's header): a field brought into view (the ask on the Public tab)
// goes below this line. public.js imports it.
export const underTabs = () => { const h = document.querySelector('.sv-hdr'); return h ? Math.max(0, h.getBoundingClientRect().bottom) : 0; };
function switchTab(tab) {
  if (S.route?.name !== 'bill') return;
  const b = billOf(S.route); if (!b) return;
  if (tabOf(S.route) !== tab) {
    carry = origin(S.route); switching = true;
    // Replaces this history entry: Back leaves the bill, it does not walk back through its tabs. The page keeps its
    // place when the tabs are already at the top of the window; a reader further down starts the new tab at the tabs.
    const nav = document.querySelector('.bw-tabs'), y = nav ? Math.max(0, Math.round(nav.getBoundingClientRect().top + window.scrollY - underTabs() - 8)) : 0;
    try { S.go(billHref(b, tab), { replace: true, keepScroll: true }); } finally { switching = false; }
    if (window.scrollY > y) window.scrollTo({ top: y, behavior: calm() ? 'auto' : 'smooth' });
  }
  document.querySelector(`.bw-tabs [data-tab="${tab}"]`)?.focus({ preventScroll: true });
}
// Back and Forward restore the reader's place (the frame does it); only a page that was just opened, by a link or a
// reload, opens a door an old link asked for. Registered before the frame's own listener, because app.js imports this.
let popping = false;
addEventListener('popstate', () => { popping = true; setTimeout(() => { popping = false; }, 0); });

// ---- keyboard (F128): 1-3 switch tabs, [ and ] move through the list, Esc goes back ----
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'bill' || !keysOn()) return;    // My settings can switch every shortcut off
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const b = billOf(S.route); if (!b) return;
  if (/^[1-3]$/.test(e.key)) { e.preventDefault(); switchTab(TABS[+e.key - 1][0]); return; }
  if (e.key === '[' || e.key === ']') { const nb = neighbours(b), to = nb && (e.key === '[' ? nb.prev : nb.next); if (to) { e.preventDefault(); goBill(to); } return; }
  if (e.key === 'Escape') { const a = document.querySelector('.bw-back[data-back]'); if (a && a.offsetParent) { e.preventDefault(); a.click(); } }
});

// ---- where it stands, in one sentence ----
const chamberOf = code => { const c = codesOf(code).map(k => S.committees?.[k]).find(Boolean); return c ? CHAMBER_NAME[c.chamber] : ''; };
// "Senate Health and Human Services", "House Health / Human Services & Homelessness" (a joint stop). testimony.js uses it.
export const cmteFull = code => committeeName(code) || `${chamberOf(code) ? chamberOf(code) + ' ' : ''}${cmteName(code)}`;
const isJoint = code => codesOf(code).length > 1;
const dlText = dl => dl ? `the ${gateName({ phase: dl.key, label: dl.label }).toLowerCase()} deadline, ${dayOf(dl.date + 'T12:00:00-10:00')}` : '';
// v5's sentence, kept for Review's cards (review.js imports it; TESTIMONY may move to whereWords). { hearing: false }
// leaves "Next: hearing ..." out; { chair: true } names the chair as a link.
export function statusSentence(b, { hearing = true, chair = false } = {}) {
  const st = stopOf(b), ch = CHAMBER_NAME[st.chamber] || '';
  if (diedish(b) || st.phase === 'dead') return whyDead(b);           // whyDead escapes what it quotes
  if (st.phase === 'law') return 'Signed into law.';
  if (st.phase === 'vetoed') return 'Vetoed by the Governor.';
  if (st.phase === 'governor') return 'Passed the House and Senate. It is on the Governor’s desk.';
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  if (st.phase === 'conference' && /^Passed the \w+ with changes/.test(st.says || '')) return esc(st.says);
  if (st.phase === 'conference') return `In conference: House and Senate negotiators are settling one version${dl ? ` before ${esc(dlText(dl))}` : ''}.`;
  if (st.phase === 'floor') return `Through its ${ch} committees. Next: a vote of the full ${ch}${dl ? ` before ${esc(dlText(dl))}` : ''}.`;
  const other = st.chamber === 'H' ? 'Senate' : 'House', passed = st.leg === 'second' ? `Passed the ${other}. ` : '';
  if (!st.committee) return `${passed}Waiting to be sent to a ${ch} committee${dl ? `, before ${esc(dlText(dl))}` : ''}.`;
  const where = `In ${esc(cmteFull(st.committee))}${st.stops > 1 ? `, committee ${st.stop} of ${st.stops} in the ${ch}` : ''}`;
  if (st.hearingState === 'scheduled') return hearing ? `${passed}${where}. Next: ${isJoint(st.committee) ? 'joint hearing' : 'hearing'} ${esc(fmtDT(st.hearing.scheduled_at))}.` : `${passed}${where}.`;
  if (st.hearingState === 'held') return `${passed}${where}. Heard ${esc(dayOf(st.hearing.scheduled_at))}; waiting for the committee’s decision.`;
  if (st.deadline?.missed) return `Needed a hearing in ${esc(cmteFull(st.committee))} before ${esc(dlText(st.deadline))}, and did not get one.`;
  const who = chair ? chairLinks(b, st.committee) : '';
  return `${passed}${where}. Needs a hearing before ${esc(dlText(dl))}${dl ? ` (${dl.days} day${dl.days === 1 ? '' : 's'}), when it must ${esc(gateNeed(dl.label))}` : ''}. ${who ? `${who} ${/^Chairs /.test(who) ? 'decide' : 'decides'}.` : isJoint(st.committee) ? 'The chairs decide.' : 'The chair decides.'}`;
}
function chairLinks(b, code) {
  const legs = legsOf(code);
  const one = c => { const l = legs.find(m => m.roles[c] === 'chair')?.l;
    return l ? `<a href="#/legislator/${l.id}?from=${esc(billRef(b))}">${esc(legTitle(l))} ${esc((l.sort_name || '').split(',')[0] || l.name.split(' ').pop())}</a>` : ''; };
  const found = codesOf(code).map(c => [c, one(c)]).filter(([, x]) => x);
  if (!found.length) return '';
  return found.length === 1 ? `<span class="bw-chair">Chair ${found[0][1]}</span>` : `Chairs ${found.map(([, x]) => `<span class="bw-chair">${x}</span>`).join(' and ')}`;
}
// A sitting of this bill that started within the last three hours and has no result yet: it is being heard now.
function sittingNow(b) {
  const t = Date.now();
  return (S.hearings || []).filter(h => h.bill_id === b.id && h.status !== 'cancelled' && !S.outcomes?.[h.id]
    && new Date(h.scheduled_at).getTime() <= t && t - new Date(h.scheduled_at).getTime() < 3 * 36e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at))[0] || null;
}
// A bill that stopped, in what the deadline asked rather than its Capitol name, with a day: "Did not reach its last
// committee by Fri 2/20 (it was waiting in House Transportation)" (C-15, C-10; it read "Missed the Lateral deadline on
// 2/20/26 while waiting in House Transportation").
function deadWords(b) {
  const w = whyDead(b), cm = c => esc(committeeName(c) || c);
  const day = (mo, d, y) => dayOf(`${y.length === 2 ? '20' + y : y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00-10:00`);
  let m = /^Missed the (.+?) deadline on (\d+)\/(\d+)\/(\d+)(?: while waiting in (.+?))?\.$/.exec(w);
  if (m) {
    const where = m[5] ? ` (it was waiting in ${cm(m[5])})` : '';
    if (/^sine die$/i.test(m[1])) return `The session ended before it passed${where}`;
    return `Did not ${esc(gateNeed(m[1], 1))} by ${esc(day(m[2], m[3], m[4]))}${where}`;
  }
  if ((m = /^Through committee, but no floor vote before the (.+?) deadline on (\d+)\/(\d+)\/(\d+)\.$/.exec(w))) return `Through committee, but no floor vote by ${esc(day(m[2], m[3], m[4]))}`;
  return w.replace(/\.$/, '');
}

// ---- position, owner, follow, mute: each saves at once and says so, with Undo ----
// Priority is not picked: it follows the position (R-175, Nate 10/5; strong support is the top tier), so the position
// picker says so.
const POS_ORDER = ['strongly_support', 'support', 'support_amend', 'neutral', 'oppose', 'strongly_oppose', 'monitor', ''];
// Who follows the bill (R-022 wave 3), you first. data.js keeps your own follow in S.follows, the team's in S.followersBy.
const followers = b => {
  const ids = new Set(S.followersBy?.[b.id] || []);
  if (S.me) { if (S.follows?.has(b.id)) ids.add(S.me.id); else ids.delete(S.me.id); }
  return [...ids].map(advocate).filter(Boolean).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
};
const followText = b => andList(followers(b).map(a => a.id === S.me?.id ? 'You' : teamFirst(a)));
// A position change says what it did (X10-6, R-180 wave 3): "Saved. The public page now says HIPHI opposes. 1 approved
// testimony says support: open it." Testimony already approved or waiting for approval was written for the old position
// and is the one thing the change does not touch; the Doc is not read, so this names the old side and says to look.
const SIDE = { strongly_support: 'support', support: 'support', support_amend: 'support', strongly_oppose: 'oppose', oppose: 'oppose' };
function positionSaid(b, was, now) {
  const says = MEMO_SAYS[now], listed = b.is_public && b.tracked !== false;
  const page = says ? (listed ? `The public page now says ${says}.` : 'It is not on the public page, so nothing changed there.') : (listed ? 'The public page no longer shows a HIPHI position.' : '');
  const old = SIDE[was], fresh0 = SIDE[now], ds = (S.drafts?.[b.id] || []);
  const ready = ds.filter(d => d.status === 'approved').length, waiting = ds.filter(d => d.status === 'review' || d.status === 'second_review').length;
  const parts = old && old !== fresh0 ? [ready ? `${ready} approved testimony says ${old}` : '', waiting ? `${waiting} testimony waiting for approval says ${old}` : ''].filter(Boolean) : [];
  const warn = parts.length ? ` ${parts.join(' and ').replace(/^(\d+) approved testimony says/, (m, n) => +n > 1 ? `${n} approved testimonies say` : m)}: open it.` : '';
  const doc = parts.length ? ds.find(d => ['approved', 'review', 'second_review'].includes(d.status) && d.doc_url)?.doc_url || '' : '';
  return { msg: `Saved. ${page}${warn}`.replace(/\s+/g, ' ').trim(), act: parts.length, doc };
}
async function saveWithUndo(b, patch, focusSel, say) {
  const before = {}; for (const k of Object.keys(patch)) before[k] = b[k] ?? null;
  try {
    await DB.updateBill(b.id, patch); FACTS.clear(); rerender(focusSel);
    const said = say ? say(before) : null;
    toast(said ? said.msg : 'Saved', { undo: async () => { await DB.updateBill(b.id, before); FACTS.clear(); rerender(focusSel); toast('Put back as it was'); },
      ...(said?.act ? { action: { label: said.doc ? 'Open Doc' : 'Show me', run: () => { if (said.doc) window.open(said.doc, '_blank', 'noopener'); else document.querySelector('.bw-page .v6-step')?.scrollIntoView({ block: 'start' }); } } } : {}) });
  } catch (e) { toast(e, { err: true }); rerender(focusSel); }
}
function pickPosition(b) {
  pickerSheet({ title: `Position on ${esc(sayWords(b))}`, value: b.position || '',
    options: POS_ORDER.map(v => [v, POS_WORD[v], POS_ICON[v] || 'circle-dashed', POS_SUB[v] || '']),
    onPick: v => saveWithUndo(b, { position: v || null }, '[data-bwpos]', before => positionSaid(b, before.position, v || null)) });
}
// F60, F102: "Give HB 2121 to…" names who owns it now; a turned-off owner says so (R-316 W28).
// Each person's row says their load, the open steps on their own Today ("6 open", steps.js openCounts, as Change owner and
// Team count them), so a bill goes to someone with room (B-6). Read when the menu opens; a load not worked out says nothing.
async function pickOwner(b) {
  const cur = (S.assignments[b.id] || [])[0] || '';
  const people = S.advocates.filter(a => a.is_active !== false || a.id === cur).slice().sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
  const n = await openCounts(), sub = a => [a.id === cur ? 'Owns it now' : '', n[a.id] == null ? '' : `${n[a.id]} open`].filter(Boolean).join(' · ');
  pickerSheet({ title: `Give ${esc(numWords(b))} to…`, value: cur, help: 'The owner gets its drafts and alerts. Whoever sends the testimony for approval files it.',
    options: [...people.map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : teamName(a), 'user-round', sub(a)]), ['', 'No owner', 'circle-dashed']],
    onPick: async v => {
      if (v === cur) return;
      try {
        await DB.setOwner(b.id, v || null); FACTS.clear(); rerender('[data-bwowner]');
        toast(!v ? `${numWords(b)} has no owner now.` : v === S.me?.id ? `You own ${sayWords(b)} now.` : `${teamFirst(v)} owns ${sayWords(b)} now.`,
          { undo: async () => { await DB.setOwner(b.id, cur || null); FACTS.clear(); rerender('[data-bwowner]'); toast('Put back as it was'); } });
      } catch (e) { toast(e, { err: true }); rerender(); }
    } });
}
// V24: muting a bill that waits for a hearing is "Not pushing this bill" (it leaves the Get hearings board and Today).
const waitsForHearing = b => { const st = stopOf(b); return !diedish(b) && st.phase === 'committee' && !hearingAhead(b) && wantsHearing(b); };
function pageMenu(b) {
  const h = hearingAhead(b), muted = isMuted(b), num = numWords(b), own = isOwner(b), noPush = waitsForHearing(b);
  const refuse = h ? `This bill has a ${committeeName(h.committee) || h.committee} hearing on ${dayOf(h.scheduled_at)}. It can be muted once that hearing is over.` : '';
  // The position and the owner are not here: they are the header's own words, each a quiet button (2 clicks, as in v5).
  menuSheet({ title: `More for ${sayWords(b)}`, items: [
    { label: b.nickname ? 'Edit the nickname' : 'Give it a nickname', icon: 'pencil', sub: 'The short name the team and the public page use', run: () => afterBack(() => openNick(b)) },
    own ? { label: muted ? 'Unmute' : noPush ? 'Not pushing this bill' : 'Mute', icon: muted ? 'bell' : 'bell-off', sub: muted ? 'Put it back on Today and in your alerts' : 'Off Today and no alerts until it gets a hearing',
      disabled: !muted && !!h, reason: refuse, run: () => afterBack(() => toggleMute(b)) } : null,
    { label: 'Copy link', icon: 'link', sub: 'Opens this bill for anyone on the team', run: () => afterBack(() => copyLink(b)) },
  ] });
}
async function toggleMute(b) {
  const on = !isMuted(b), num = numWords(b);
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
  const on = !S.follows?.has(b.id), num = numWords(b);
  try {
    await DB.follow(b.id, on); FACTS.clear(); rerender('[data-bwfollow]');
    toast(on ? `Following ${num}. It shows in your bills now, with its updates.` : `Unfollowed ${num}.`, { undo: async () => { await DB.follow(b.id, !on); rerender('[data-bwfollow]'); } });
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

// ---- the nickname, edited in the header (V22, R-271) ----
// The heading turns into the box, with Save and Cancel under it. Only the nickname is written, compared with what it was
// when editing began, so a teammate's newer save on the Public tab is shown before it is replaced (R-152 B).
S.bwNick ??= new Set();
function openNick(b) { S.bwNick.add(b.id); rerender('#bw-nickin'); const i = document.getElementById('bw-nickin'); if (i) try { i.setSelectionRange(i.value.length, i.value.length); } catch { /* ignore */ } }
const nickBase = new Map();
function nickForm(b) {
  const v = drafts.get(b.id + ':nick') ?? (b.nickname || '');
  return `<form class="bw-nickform" data-nickform novalidate>
    <label class="bw-nicklab" for="bw-nickin">Nickname</label>
    <input id="bw-nickin" class="input" maxlength="40" autocomplete="off" value="${esc(v)}" placeholder="Disposable e-cigarette ban" aria-describedby="bw-nick-help bw-nick-err">
    <span class="help" id="bw-nick-help">A few words the team says. It shows on the public page too. Leave it empty to use the bill’s description.</span>
    <span class="err" id="bw-nick-err" role="alert" hidden>${icon('circle-alert')}A nickname needs at least 3 characters.</span>
    <div class="bw-nickacts">${btn('Save nickname', { kind: 'secondary', icon: 'check', attrs: { type: 'submit' } })}${btn('Cancel', { kind: 'text', attrs: { 'data-nickno': '1' } })}</div>
  </form>`;
}
function wireNick(page, b) {
  const form = page.querySelector('[data-nickform]'); if (!form) return;
  const inp = form.querySelector('#bw-nickin'), err = form.querySelector('#bw-nick-err'), key = b.id + ':nick';
  const close = () => { drafts.delete(key); nickBase.delete(b.id); S.bwNick.delete(b.id); rerender('[data-bwmore]'); };
  inp.oninput = () => { if (!nickBase.has(b.id)) nickBase.set(b.id, b.nickname || null); drafts.set(key, inp.value); err.hidden = true; inp.removeAttribute('aria-invalid'); };
  inp.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
  form.querySelector('[data-nickno]').onclick = close;
  form.onsubmit = async e => {
    e.preventDefault();
    const v = inp.value.trim().replace(/\s+/g, ' ');
    if (v && v.length < 3) { err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
    const base = nickBase.has(b.id) ? nickBase.get(b.id) : (b.nickname || null), was = b.nickname || null;
    const sub = form.querySelector('[type="submit"]'); sub.setAttribute('aria-busy', 'true');
    const done = res => {
      drafts.delete(key); nickBase.delete(b.id); S.bwNick.delete(b.id); FACTS.clear(); rerender('[data-bwmore]');
      if (!res.changed.length) { toast('Nothing to save: the nickname already says this.'); return; }
      toast(v ? `Saved. The team and the public page call it “${v}”.` : 'Saved. It goes by its description now.', { ok: true,
        undo: async () => { await DB.updateBill(b.id, { nickname: was }); FACTS.clear(); rerender('[data-bwmore]'); toast('Put back as it was'); } });
    };
    try {
      const res = await DB.saveBillFields(b.id, { nickname: v || null }, { nickname: base });
      if (!res.conflicts.length) { done(res); return; }
      sub.removeAttribute('aria-busy');
      askConflict({ title: 'A teammate changed the nickname', fields: res.conflicts.map(c => ({ label: 'Nickname', theirs: c.theirs, mine: c.mine })),
        keepTheirs: async () => { drafts.delete(key); nickBase.delete(b.id); S.bwNick.delete(b.id); FACTS.clear(); rerender('[data-bwmore]'); toast('Kept your teammate’s nickname.'); },
        replace: async () => { try { done(await DB.saveBillFields(b.id, { nickname: v || null }, { nickname: base }, { force: true })); } catch (x) { toast(x, { err: true }); } } });
    } catch (x) { sub.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
}

// ---- the header ----
// "You own it", "Kevin owns it", "Lauren (turned off) owns it, needs a new owner", "No owner yet" (a live bill with a
// position: the step card offers Take it).
function ownerWords(b) {
  const a = ownerOf(b);
  if (a) return a.id === S.me?.id ? 'You own it' : `${teamFirst(a)} owns it${newOwnerTag(a)}`;
  return b.position && b.position !== 'monitor' && !diedish(b) ? 'No owner yet' : 'No owner';
}
function headHTML(b, route) {
  const o = origin(route), nb = neighbours(b), tab = tabOf(route), own = isOwner(b), following = !!S.follows?.has(b.id);
  const editing = S.bwNick.has(b.id) || drafts.has(b.id + ':nick');
  // Follow is a visible button (V22: one click). The owner has the bill already; for everyone else it says what is true
  // ("Following") and pressing again unfollows (A-12).
  const follow = own ? '' : btn(following ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: following ? 'check' : 'bell', cls: 'bw-follow', attrs: { 'data-bwfollow': '1', 'aria-pressed': String(following) } });
  const more = iconBtn('ellipsis', `More for ${sayWords(b)}`, { 'data-bwmore': '1', 'aria-haspopup': 'dialog' }, 'bw-more');
  const pos = POS_WORD[b.position || ''] || b.position || 'No position', ow = ownerWords(b);
  // The position and the owner are the facts' own words, each a quiet button with a chevron that opens its picker: 2
  // clicks, as in v5, and plain to see (fresh-eyes review: in "…" they took 3 and nothing said where; A-12, P-4).
  const pick = (attr, words, label) => `<button type="button" class="bw-fbtn" ${attr} aria-haspopup="dialog" aria-label="${esc(label)}"><span>${esc(words)}</span>${icon('chevron-down', { cls: 'bw-fchev' })}</button>`;
  // Each fact keeps its separator with it (".bw-f + .bw-f::before"), so a wrapped line never ends on a lone dot. On a
  // phone the number is left out: the top bar shows it (A-14).
  const facts = [`<span class="bw-f bw-num">${esc(numWords(b))}</span>`,
    `<span class="bw-f">${pick('data-bwpos="1"', pos, `Position: ${pos}. Change it`)}</span>`,
    `<span class="bw-f">${pick('data-bwowner="1"', ow, `${ow}. Give ${numWords(b)} to someone`)}</span>`,
    isMuted(b) ? `<span class="bw-f bw-muted">${icon('bell-off')}<span>Muted</span></span>` : ''].filter(Boolean).join('');
  // The bill's issue is the right column's first card (R-346, issueCardHTML), no longer a frame over the name (R-340).
  // Grid areas (bill.css): from 481px the name, then Follow and "…" beside it; on a phone "…" stays beside the name and
  // Follow rides on the issue's line, so neither takes a row of its own (A-1).
  return `<header class="bw-head${follow ? ' bw-hasfollow' : ''}">
    <div class="bw-top">
      <a class="bw-back" href="${esc(o.href)}" data-back>${icon('chevron-left')}<span>${esc(o.label)}</span></a>
      ${nb ? `<div class="bw-nav" role="group" aria-label="Move through ${esc(o.label)}">
        ${nb.prev ? `<a class="bw-pn" href="${billHref(nb.prev, tab)}" data-nav="prev" aria-label="Previous bill: ${esc(sayWords(nb.prev))}" title="${esc(sayWords(nb.prev))} ([)">${icon('chevron-left')}<span>Previous</span></a>` : ''}
        <span class="bw-pos">${nb.i + 1} of ${nb.n}</span>
        ${nb.next ? `<a class="bw-pn" href="${billHref(nb.next, tab)}" data-nav="next" aria-label="Next bill: ${esc(sayWords(nb.next))}" title="${esc(sayWords(nb.next))} (])"><span>Next</span>${icon('chevron-right')}</a>` : ''}
      </div>` : ''}
    </div>
    <div class="bw-titlerow">${editing ? nickForm(b) : `<h1 class="bw-h1${b.nickname ? '' : ' bw-long'}" id="bw-h1" tabindex="-1">${esc(billName(b))}</h1>`}</div>
    ${follow ? `<div class="bw-hfollow">${follow}</div>` : ''}
    <div class="bw-hmore">${more}</div>
    <div class="bw-fline"><p class="bw-facts">${facts}</p></div>
  </header>`;
}

// ---- the tabs (F128): Next step · Team talk · Public, keys 1 to 3, an unread count on Team talk ----
// From Team talk or Public, a dot on Next step says the step there is yours (B-7: v5's Next up card showed on every tab;
// someone who came from an @mention to reply could leave without seeing that filing is theirs).
function tabsNav(b, tab, s) {
  const n = unreadCount(b), keys = keysOn(), mine = tab !== 'overview' && !!s?.you;
  return `<nav class="v6-tabs bw-tabs" aria-label="${esc(sayWords(b))}: pages">${TABS.map(([k, l], i) =>
    `<a href="${billHref(b, k)}" data-tab="${k}"${k === tab ? ' aria-current="page"' : ''}${keys ? ` aria-keyshortcuts="${i + 1}" title="${l} (${i + 1})"` : ''}><span>${l}</span>${k === 'overview' && mine ? '<span class="bw-tdot" aria-hidden="true"></span><span class="sr">, your step</span>' : ''}${k === 'activity' && n ? `<span class="v6-tab-n">${n}<span class="sr"> new</span></span>` : ''}</a>`).join('')}</nav>`;
}

// ---- Next step: what's next for you, the to-dos, what else is coming, the three doors ----
// The step's hearing (if any): the header leaves it to the step card's hearing line (A-14).
const stepOf = b => { try { return billStep(b); } catch (e) { console.error(e); return null; } };
// Minutes into a sitting the Capitol has no result yet, but steps.js counts the bill heard and asks the chair for decision
// making (fresh-eyes review, HB 1562 at 1:12 PM). Until the sitting has a result or three hours have passed, the page
// says it is being heard instead (shared_changes asks STEPS to do the same everywhere).
const pageStep = b => { const s = stepOf(b), now = s?.kind === 'chair' && s.ask?.decide ? sittingNow(b) : null;
  return now ? { kind: 'none', b, d: null, h: now, you: false, heardNow: now } : s; };
// A bill heard and not voted on, with no deadline in the record (askWords then has no ask to draw): the second email Nate
// approved, asking the chair to schedule a vote (R-316 W3, W33; F105). With a deadline the step card says it.
// It is the owner's to send: the owner gets the filled button (the step is theirs, D16); anyone else reads whose it is,
// with no button (spec 7.1).
function decideCard(b) {
  const st = stopOf(b);
  if (!ASK_LOG() || diedish(b) || st.phase !== 'committee' || st.hearingState !== 'held' || !st.committee || !wantsHearing(b) || !b.position) return '';
  const asked = chairAskOf(b, st.committee), heard = st.hearing?.scheduled_at, own = isOwner(b), ow = ownerOf(b);
  const dm = asked || !own ? null : chairAskMail(st.committee, [b], { dl: null, heardAt: heard || new Date().toISOString() });
  const what = asked ? 'Waiting for the chair to schedule a vote' : own ? 'Ask the chair to schedule a vote' : ow ? `${teamFirst(ow)} asks the chair to schedule a vote` : 'No one is asking the chair to schedule a vote yet';
  return `<section class="v6-step ${own && !asked ? 'own' : 'others'} k-chair w-bill" aria-labelledby="bw-dm-h">
    <p class="v6-step-eyebrow">Getting a vote · ${esc(committeeName(st.committee))}</p>
    <h3 class="v6-step-what" id="bw-dm-h">${esc(what)}</h3>
    ${heard ? `<p class="v6-step-when">Heard ${nw(esc(dayOf(heard)))}, no vote yet.</p>` : ''}
    ${asked || dm ? `<div class="v6-step-acts">${asked ? askedChip(b, st.committee, asked) : btn(dm.m?.n > 1 ? 'Email the chairs' : 'Email the chair', { kind: 'primary', icon: 'mail', href: dm.href, attrs: { 'aria-label': `Email ${dm.m?.who || 'the chair'} to schedule a vote on ${numWords(b)}` } })}</div>` : ''}
  </section>`;
}
// A bill with nothing to do on it now says so calmly; a live bill with a position and no owner offers Take it (R-330 W42).
function noneCard(b) {
  const st = stopOf(b), stopped = diedish(b) || ['dead', 'law', 'vetoed'].includes(st.phase);
  const own = !stopped && !ownerOf(b) && b.position && b.position !== 'monitor' && b.tracked !== false && S.me;
  // Said once (A-14): the header says why it stopped or where it waits; this says only that nothing is asked of anyone.
  const say = stopped ? 'Nothing more to do on it this session.' : b.position === 'monitor' ? 'We are watching this one. Nothing to do on it right now.' : 'Nothing for the team to do on it right now.';
  return `<div class="bw-calm">${icon(stopped ? 'circle-minus' : 'circle-check')}<p>${esc(say)}</p></div>${own ? `<p class="bw-noown">${icon('user-round')}<span>No owner yet</span>${btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': b.id } })}</p>` : ''}`;
}
// The hearing's video while any sitting of this bill is live (F106), whoever's step it is: an owner watching their bill
// heard is not always the one filing (fresh-eyes review: Watch went with the filing step at 1:12 PM).
function liveVideo(b, s) {
  const hs = [s?.h, ...(S.hearings || []).filter(h => h.bill_id === b.id)].filter(h => h && h.status !== 'cancelled');
  for (const h of hs) { const v = streamOf(h); if (v && v.state === 'live') return v; }
  return null;
}
// Under the step: borrow from what HIPHI wrote before (the writer, R-027, F118); the Doc when the card has no Open Doc of
// its own (someone else's step, a filed or missed one: v5's Next up card showed it to everyone, and a writer rereads her
// draft while an approver has it, F104); Log a talk beside any chair ask (R-316 W3: anyone helping may have talked to the
// office); the committee report when the bill changed since the draft (F104); the video while the hearing is live.
function stepExtras(b, s, card = '') {
  if (!s) return '';
  const out = [], own = !!s.you;
  if (own && ['nodraft', 'write', 'submit', 'revise'].includes(s.kind) && earlierCount(b) > 0) out.push(btn('Borrow from earlier testimony', { kind: 'text', icon: 'book-open', attrs: { 'data-borrow': '1' } }));
  if (s.d?.doc_url && !/\bsv-doc\b/.test(card)) out.push(docBtn(s.d.doc_url, { kind: 'text' }));
  if (s.kind === 'chair' && ASK_LOG()) out.push(btn('Log a talk with a legislator', { kind: 'text', icon: 'message-square-plus', attrs: { 'data-logtalk': '1', 'aria-haspopup': 'dialog' } }));
  if (own && s.state?.stale && s.state.key === 'write') out.push(btn('Committee report', { kind: 'text', iconEnd: 'external-link', href: capitolUrl(b), target: '_blank' }));
  const v = liveVideo(b, s);
  if (v) out.push(btn('Watch live now', { kind: 'text', icon: 'video', href: v.url, target: '_blank' }));
  return out.length ? `<div class="bw-stepx">${out.join('')}</div>` : '';
}
// "Your step" leads the card's top line when the step is the viewer's: the tab above already says Next step, so the
// section's heading is for screen readers only (A-14, A-1: the h2 pushed the card past 400px on a phone). A workaround in
// this file until stepCard takes a lead of its own (shared_changes).
function yourStep(card) {
  const lead = '<span class="bw-yours">Your step</span>';
  if (card.includes('<p class="v6-step-eyebrow">')) return card.replace('<p class="v6-step-eyebrow">', `<p class="v6-step-eyebrow">${lead} · `);
  return card.replace(/(<section class="v6-step[^"]*"[^>]*>)/, `$1<p class="v6-step-eyebrow">${lead}</p>`);
}
// R-316 W18: on a chair ask the chair's name opens their page (v5's did: one click to the office's phone and the team's
// history with them; fresh-eyes review: it took Committees › members › the name). Only inside the card's sentence.
function chairLinked(b, card, code) {
  if (!code) return card;
  let out = card;
  for (const k of codesOf(code)) {
    const c = S.committees?.[k], m = (S.committeeMembers || []).find(x => x.committee === k && x.role === 'chair');
    const l = m && (S.legislators || []).find(x => x.id === m.legislator_id); if (!c || !l) continue;
    // the same words chairAskMail writes ("Sen. San Buenaventura"), so the name in the sentence is found
    const sur = l.sort_name ? l.sort_name.split(',')[0] : String(c.chair || '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
    const name = esc(`${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${sur}`);
    out = out.replace(/(<h3 class="v6-step-what"[^>]*>)([\s\S]*?)(<\/h3>)/, (all, a, mid, z) => a + mid.replace(name, `<a class="bw-chairl" href="#/legislator/${esc(l.id)}?from=${esc(billRef(b))}">${name}</a>`) + z);
  }
  return out;
}
function whatsNext(b, s) {
  const dm = !s?.heardNow && (!s || s.kind === 'none') ? decideCard(b) : '';
  const mine = dm ? dm.includes('"v6-step own') : !!s?.you;
  let card = s?.heardNow ? `<div class="bw-calm">${icon('gavel')}<p>If the committee does not vote at this hearing, asking the chair to schedule a vote comes next.</p></div>`
    : dm || (!s || s.kind === 'none' ? noneCard(b) : stepCard(b, { where: 'bill', from: b.bill_number, hear: !sideHearing(b, s) }));
  if (s?.kind === 'chair') card = chairLinked(b, card, s.ask?.code);
  if (mine) card = yourStep(card);
  return `<section class="bw-sec bw-next" aria-labelledby="bw-next-h">
    <h2 class="sr" id="bw-next-h">${mine ? 'What’s next for you' : 'What’s next'}</h2>
    ${card}${stepExtras(b, s, card)}
  </section>`;
}
// What the step card says, so the tracker's caption does not say it again (tracker.js `says`): the committee, the deadline it races
// (a chair ask's notice line) and that it was heard (a decision-making ask). Null when the card names no committee.
function cardSays(b, s) {
  const st = stopOf(b);
  if (s?.heardNow) return null;
  if (!s || s.kind === 'none') return decideCard(b) ? { heard: true, deadline: false } : null;
  if (s.kind === 'chair') return s.ask?.code ? { heard: !!s.ask.decide, deadline: ['ask', 'giving', 'passed'].includes(s.ask.key) } : null;
  // A testimony step's hearing line names the committee; with the hearing set, the race to the deadline is the hearing's
  // (About this bill keeps the deadline).
  return s.h && s.h.committee === st.committee ? { heard: false, deadline: true, started: new Date(s.h.scheduled_at).getTime() <= Date.now() } : null;
}
// What else is coming on this bill: another sitting ahead (a hearing card each, as on Hearings), and testimony not tied to
// a sitting ahead that is still unfinished (moved or cancelled; its own step card, never the screen's filled button).
function alsoComing(b, s) {
  const now = Date.now(), mainH = s?.h, mainD = s?.d;
  const sameSit = (x, y) => !!x && !!y && x.committee === y.committee && x.scheduled_at === y.scheduled_at;
  const seenSit = [];
  const sits = (S.hearings || []).filter(h => h.bill_id === b.id && h.status !== 'cancelled' && new Date(h.scheduled_at) > now && !sameSit(h, mainH))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at)).filter(h => !seenSit.some(x => sameSit(x, h)) && seenSit.push(h));
  const ahead = new Set(seenSit.map(h => h.committee));
  const other = (S.drafts?.[b.id] || []).filter(d => onNextUp(d) && d.id !== mainD?.id && !ahead.has(d.committee) && !(mainH && d.committee === mainH.committee))
    .sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  if (!seenSit.length && !other.length) return '';
  return `<section class="bw-sec bw-also" aria-labelledby="bw-also-h"><h2 class="bw-h2" id="bw-also-h">Also coming up</h2>
    <div class="bw-stack">${seenSit.map(h => hearingCard(h, { from: b.bill_number })).join('')}${other.map(d => stepCard(b, { where: 'bill', d, h: draftHearing(d) || null, primary: false, from: b.bill_number })).join('')}</div></section>`;
}

// ---- to-dos on this bill (F115, F59): under what's next, each its own row ----
// A to-do is due at the end of its day. Late and overdue are coloured only for the person it is for (or, for "Anyone",
// the bill's owner): someone else's overdue to-do is said in neutral words with its clock (D3, steps.js shownStatus).
S.bwTodoOpen ??= new Set();
const TODO_FOR = () => true;   // Nate's go 10/22 (R-332): For and Due on the same line as the to-do
function todoTone(b, t) {
  if (t.done) return { tone: 'done', icon: 'circle-check', words: 'Done' };
  if (!t.due_date) return null;
  const today = hiToday(), mine = t.assignee_id ? t.assignee_id === S.me?.id : isOwner(b);
  if (t.due_date < today) return mine ? { tone: 'overdue', icon: 'circle-alert', words: `Overdue · was due ${dayOf(t.due_date)}` } : { tone: 'neutral', icon: 'clock', words: `Was due ${dayOf(t.due_date)}` };
  if (t.due_date === today) return { tone: 'neutral', icon: 'clock', words: 'Due today', soon: mine };
  return { tone: 'neutral', icon: '', words: `Due ${dayOf(t.due_date)}` };
}
const todoForm = d => { const ppl = (S.advocates || []).filter(a => a.is_active !== false && a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));
  // Three labelled fields on one baseline (A-8: the To-do box had no label and For sat 6px below Due).
  return `<form class="bw-addrow bw-addfor" data-todoadd novalidate><label class="bw-tdf bw-tdw"><span>To-do</span><input id="bw-tdnew" class="input" maxlength="200" placeholder="What needs doing?" autocomplete="off" value="${esc(d)}"></label>
    <label class="bw-tdf"><span>For</span><select id="bw-tdfor" class="input"><option value="">Anyone</option>${S.me ? `<option value="${esc(S.me.id)}">You</option>` : ''}${ppl.map(a => `<option value="${esc(a.id)}">${esc(a.full_name)}</option>`).join('')}</select></label>
    <label class="bw-tdf"><span>Due</span><input id="bw-tddue" class="input" type="date" min="${esc(hiToday())}"></label>${btn('Add', { kind: 'secondary', icon: 'plus', attrs: { type: 'submit' } })}</form>`; };
// The database's share to-do ("Send the ask to HIPHI's list and partners…", migration 112) is the rallier's public ask when
// the rallier has that row (today.js shareAsk): it reads as Today and Team say it, one person and one time for one job,
// "Saya writes the public ask · by tomorrow 4:00 PM (Kevin's to-do)", and keeps its Mark done (the tick). Otherwise it is
// its owner's own to-do, as written (R-274, A-14).
function shareTone(sw, t) {
  if (t.done || sw.due == null) return null;
  const now = Date.now(), mine = sw.mine || t.assignee_id === S.me?.id;
  if (sw.due <= now) return mine ? { tone: 'overdue', icon: 'circle-alert', words: `Overdue · was ${sw.when.replace(/^by /, 'due ')}` } : { tone: 'neutral', icon: 'clock', words: cap1(sw.when) };
  return { tone: 'neutral', icon: sw.due - now <= 864e5 ? 'clock' : '', words: cap1(sw.when), soon: mine && sw.due - now <= 864e5 };
}
const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;
function todoRow(b, t) {
  const sw = shareTodoWords(b, t);
  const st = sw ? shareTone(sw, t) : todoTone(b, t), who = sw ? (sw.by ? `(${sw.by})` : '') : t.assignee_id ? nameOrYou(advocate(t.assignee_id)) : 'Anyone';
  const tone = st && st.tone !== 'neutral' && !t.done ? ' t-' + st.tone : st?.soon ? ' soon' : '';
  return `<li class="bw-todo${t.done ? ' done' : ''}" data-todo="${esc(t.id)}">
    <button type="button" class="bw-tick" data-tick="${esc(t.id)}" role="checkbox" aria-checked="${!!t.done}" aria-label="${esc(sw ? `Mark done: ${sw.title}` : t.title)}">${icon(t.done ? 'square-check-big' : 'square')}</button>
    <span class="bw-tbody"><span class="bw-ttl">${esc(sw ? sw.title : t.title)}</span><span class="bw-tmeta${tone}">${st && !t.done && st.icon ? icon(st.icon) : ''}<span>${nw(esc([st && !t.done ? st.words : '', who].filter(Boolean).join(sw ? ' ' : ' · ')))}</span></span></span>
    ${iconBtn('ellipsis', `More for “${t.title}”`, { 'data-tmore': t.id, 'aria-haspopup': 'dialog' })}
  </li>`;
}
// The to-do "Ask Sen. X for a hearing on HB1991" (Give this ask to…, R-329) is the step card's when it is the bill's step
// ("Kris is asking", with Done, I asked): it is said there, once (A-14).
const todosOf = b => { const s = stepOf(b), ask = s?.kind === 'chair' && s.ask?.key === 'giving' ? askTodoOf(b) : null;
  return (S.todos[b.id] || []).filter(t => !ask || t.id !== ask.id); };
function todoSection(b) {
  const list = todosOf(b).slice().sort((x, y) => (x.done - y.done) || String(x.due_date || '9').localeCompare(String(y.due_date || '9')) || (x.sort_order - y.sort_order) || String(x.created_at).localeCompare(String(y.created_at)));
  const open = list.filter(t => !t.done), done = list.filter(t => t.done);
  const d = drafts.get(b.id + ':todo') || '';
  const add = (S.bwTodoOpen.has(b.id) || d) ? todoForm(d)
    : btn('Add a to-do', { kind: 'text', icon: 'plus', cls: 'bw-todoadd', attrs: { 'data-todoopen': '1' } });
  // No to-dos yet: the section waits as a door among the others ("To-dos on this bill · none yet"), so an empty list takes
  // no room under the step (doors(): todoDoor).
  if (!list.length) return '';
  return `<section class="bw-sec bw-todosec" aria-labelledby="bw-todo-h">
    <h2 class="bw-h2" id="bw-todo-h">To-dos on this bill</h2>
    ${open.length ? `<ul class="bw-todos" role="list">${open.map(t => todoRow(b, t)).join('')}</ul>` : ''}
    ${done.length ? `<details class="bw-done"${S.bwDoneOpen?.[b.id] ? ' open' : ''} data-bwdone><summary>${icon('chevron-down', { cls: 'bw-chev' })}<span>Done · ${done.length}</span></summary><ul class="bw-todos" role="list">${done.map(t => todoRow(b, t)).join('')}</ul></details>` : ''}
    ${add}
  </section>`;
}

// ---- the doors: About this bill, Committees, Earlier testimony (V22: each a labelled 44px door) ----
// Each opens in place and stays open or closed for the visit, per bill (B-6), so a save that redraws the page never
// folds it shut under the person reading it.
S.bwDoor ??= {};
const doorOpen = (b, k) => !!S.bwDoor[b.id]?.[k];
// The Capitol lists "LEE, M." as two sponsors; put the initial back on its name.
function sponsorList(b) {
  const out = [];
  for (const s of b.sponsors || []) { const n = String(s.n || s.name || s).trim(); if (/^[A-Z]\.$/.test(n) && out.length) out[out.length - 1] += ', ' + n; else if (n) out.push(n); }
  return out.map(sponsorName);
}
// R-316 W18: each introducer links to their page, the natural allies for leaning on a chair. Matched in the bill's own
// chamber by surname, and by first initial when two share one.
const surnameKey = s => plain(s).replace(/[^a-z ]/g, '').trim();
function sponsorLeg(b, name) {
  const [last, ini = ''] = String(name).split(',').map(surnameKey), ch = /^H/i.test(b.bill_number) ? 'H' : 'S';
  let l = (S.legislators || []).filter(x => x.chamber === ch && surnameKey((x.sort_name || '').split(',')[0]) === last);
  if (l.length > 1 && ini) l = l.filter(x => surnameKey((x.sort_name || '').split(',')[1] || '').startsWith(ini[0]));
  return l.length === 1 ? l[0] : null;
}
function sponsorHTML(b, name, onCmte) {
  const l = sponsorLeg(b, name); if (!l) return esc(name);
  return `<a class="bw-inline" href="#/legislator/${l.id}?from=${esc(billRef(b))}">${esc(name)}</a>${onCmte.has(l.id) ? ` <span class="bw-quiet">(on ${esc(onCmte.get(l.id))})</span>` : ''}`;
}
// Companions: the other chamber's twin and where it stands. Tracked ones open here; the rest go to the Capitol.
const spaced = num => String(num).replace(/^([A-Z]+)\s*(\d)/, '$1 $2');   // "SB 3044", as staff say it (D15)
function compHTML(b) {
  const rows = S.bwComp?.[b.id];
  if (!rows) return esc(companionsOf(b).map(spaced).join(', '));
  return companionsOf(b).map(num => {
    const r = rows.find(x => x.bill_number === num);
    if (!r) return `<span class="bw-comp">${esc(spaced(num))}</span>`;
    const st = r.stage_override || r.stage || 'introduced', tb = S.bills.find(x => x.id === r.id);
    const link = tb ? `<a class="bw-inline" href="${billRoute(tb)}">${tb.nickname ? `${esc(tb.nickname)} <span class="bw-quiet">${esc(numWords(tb))}</span>` : esc(spaced(num))}</a>` : `<a class="bw-inline" href="${esc(capitolUrl(r))}" target="_blank" rel="noopener">${esc(spaced(num))}${icon('external-link')}</a>`;
    return `<span class="bw-comp">${link} <span class="bw-quiet">· ${esc(STAGE_LABEL[st] || st)}${r.tracked ? '' : ' · not tracked'}</span></span>`;
  }).join('');
}
function loadCompanions(b) {
  if (!companionsOf(b).length) return;
  S.bwComp ??= {}; S.bwCompBusy ??= {};
  if (S.bwComp[b.id] || S.bwCompBusy[b.id]) return;
  S.bwCompBusy[b.id] = true;
  DB.companionInfo(companionsOf(b), b.session_year).then(rows => {
    S.bwComp[b.id] = rows || [];
    const el = document.getElementById('bw-comp'); if (el && billOf(S.route || {})?.id === b.id) el.innerHTML = compHTML(b);
  }).catch(() => { S.bwComp[b.id] = []; }).finally(() => { S.bwCompBusy[b.id] = false; });
}
// Every hearing the bill has had (R-033): Staff loads 60 days of hearings, so a bill page asks once for the rest of its
// own history (DB.billHearings). Committees (pathway.js) reads S.billHist and falls back to S.hearings while this loads.
S.billHist ??= {};
function loadHist(b) {
  if (S.billHist[b.id]) return;
  S.billHist[b.id] = 'loading';
  DB.billHearings(b.id).then(r => { S.billHist[b.id] = r; for (const o of r.outcomes) if (!S.outcomes[o.hearing_id]) S.outcomes[o.hearing_id] = o; if (S.route?.name === 'bill' && billOf(S.route)?.id === b.id) rerender(); })
    .catch(e => { console.warn('bill hearings', e); S.billHist[b.id] = 'error'; });
}
// R-316 W50: in session, the goal set for the issue in the autumn prep is one staff-only line, so it does not vanish
// into the folded prep card. Between sessions the issue's prep card shows it.
const goalOf = b => { if (SESSION_OVER) return null; return issuesOfBill(b.id).find(x => (x.goal || '').trim()) || null; };
// A stage set by hand (only when the Capitol's record is wrong): what the Capitol says, and Change for admins (F112).
function stageRow(b) {
  const auto = STAGE_LABEL[b.stage || 'introduced'] || b.stage;
  const set = b.stage_override ? `<p class="bw-stset">${icon('pencil')}<span>Set by hand; the Capitol’s record says ${esc(auto)}.</span></p>` : '';
  const act = S.me?.is_admin ? btn(b.stage_override ? 'Change the stage' : 'Correct the stage', { kind: 'text', sm: true, attrs: { 'data-stage': '1', 'aria-haspopup': 'dialog' } }) : '';
  // The bar of stops is the tracker at the top of the page, on every tab (tracker.js); About keeps only the correction.
  return set || act ? `<div class="bw-rib">${set}${act}</div>` : '';
}
function aboutBody(b) {
  const sp = sponsorList(b), all = !!S.bwSponsAll?.[b.id], st0 = stopOf(b);
  const onCmte = new Map(st0.committee && !diedish(b) ? legsOf(st0.committee).map(m => [m.l.id, committeeName(codesOf(st0.committee)[0]) || codesOf(st0.committee)[0]]) : []);
  const g = goalOf(b), sum = summaryOf(b), desc = String(b.description || '').trim(), pub = publicUrl(b);
  const rows = [
    sum && b.nickname ? ['What it does', esc(sum)] : !sum && desc ? ['What it does', `${esc(desc)} <span class="bw-quiet">(the Capitol’s words)</span>`] : null,
    g ? [`Our ${esc(SESSION_YEAR)} goal`, `${esc(g.goal)} <span class="bw-quiet">(${esc(g.name)}, staff only)</span>`] : null,
    sp.length ? ['Introduced by', `<b>${sponsorHTML(b, sp[0], onCmte)}</b> <span class="bw-quiet">(lead)</span>${sp.length > 1 ? ', ' + sp.slice(1, all ? sp.length : 5).map(n => sponsorHTML(b, n, onCmte)).join(', ') : ''}${sp.length > 5 && !all ? ` ${btn(`Show all ${sp.length}`, { kind: 'text', sm: true, attrs: { 'data-sponsall': '1' } })}` : ''}`] : null,
    companionsOf(b).length ? ['Companion', `<span id="bw-comp">${compHTML(b)}</span>`] : null,
    b.last_action ? ['Last action', `${b.last_action_date ? `<span class="bw-quiet">${esc(fmtDate(b.last_action_date, { year: '2-digit' }))}</span> ` : ''}${esc(shortAction(b.last_action))}`] : null,
    b.title ? ['Official title', esc(titleCaseTitle(b.title))] : null,
    sum && desc ? ['The Capitol’s description', esc(desc)] : null,
  ].filter(Boolean);
  const links = [btn('Capitol page', { kind: 'text', sm: true, iconEnd: 'external-link', href: capitolUrl(b), target: '_blank' }),
    pub ? btn('Public page', { kind: 'text', sm: true, iconEnd: 'external-link', href: pub, target: '_blank' }) : ''].join('');
  return `${stageRow(b)}${aboutBill(b, { hearing: false })}<dl class="v6-facts bw-facts2">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl><p class="bw-links">${links}</p>`;
}
// The bill's page on the public tracker, when it is live there (#/bill/2026/HB2121 carries the year, R-110, R-212 #18).
const publicUrl = b => { const yr = b.session_year ? `${b.session_year}/` : '';
  return pubStateCls(b).includes('live') ? `${PUBLIC_APP()}${DEMO ? '?demo=1' : ''}#/bill/${yr}${b.bill_number}` : ''; };
// The Committees door's line says where the bill is among its stops: "Now: 1 of 2 in the Senate", unless the header's
// short line already says it (A-14). On a phone under 360px the short line gives way so the viewer's own button is on
// the first screen (a 320x640 phone showed File at 652px), and this line says it instead (bill.css .bw-ifnarrow).
function cmteHint(b) { const st = stopOf(b); return st.phase === 'committee' && st.stops ? `${st.committee ? 'Now: ' : ''}committee ${st.stop} of ${st.stops} in the ${CHAMBER_NAME[st.chamber] || 'chamber'}` : ''; }
function doors(b, says) {
  loadHist(b); loadCompanions(b);
  let cm = ''; try { cm = renderCommittees(b, { bare: true }); } catch (e) { console.error(e); cm = '<p class="bw-quiet">The committees could not be drawn. Try again in a moment.</p>'; }
  const door = (k, id, ic, label, hint, body, hcls = '') => `<details class="bw-door" id="${id}" data-bwdoor="${k}"${doorOpen(b, k) ? ' open' : ''}>
    <summary class="bw-doorsum">${icon(ic)}<span class="bw-doorl">${label}</span>${hint ? `<span class="bw-doorh${hcls}">${esc(hint)}</span>` : ''}${icon('chevron-down', { cls: 'bw-chev' })}</summary>
    <div class="bw-doorbody">${body}</div></details>`;
  // The ask a teammate was given is a to-do, said on the step card above (todosOf leaves it out); the door says so rather
  // than "None yet", which would not be true (B-7, A-12).
  const noTodos = !todosOf(b).length, onStep = noTodos && (S.todos[b.id] || []).some(t => !t.done);
  return `<section class="bw-sec bw-doors" aria-label="More about this bill">
    ${noTodos ? door('todo', 'bw-todos0', 'list-todo', 'To-dos on this bill', onStep ? 'Only the ask above' : 'None yet', todoForm(drafts.get(b.id + ':todo') || '')) : ''}
    ${door('about', 'bw-about', 'info', 'About this bill', '', aboutBody(b))}
    ${door('cmt', 'bw-cmt', 'gavel', 'Committees', cmteHint(b), cm, says ? ' bw-ifnarrow' : '')}
    ${renderEarlier(b, { open: doorOpen(b, 'earlier') })}
  </section>`;
}
function overview(b) {
  const s = pageStep(b);
  return `${whatsNext(b, s)}${todoSection(b)}${alsoComing(b, s)}${doors(b, cardSays(b, s))}`;
}

// ---- to-dos, coalitions, stage: wiring ----
// Giving a to-do goes to ONE person (Nate, 9/21): they have it from then on and are told by Slack. No "anyone" list.
function todoMenu(b, t) {
  const mineNow = t.assignee_id === S.me?.id, who = t.assignee_id && !mineNow ? advocate(t.assignee_id) : null;
  menuSheet({ title: t.title, items: [
    t.done ? null : { label: 'Give to…', icon: 'user-round-plus', sub: who ? `${teamFirst(who)} has it now` : 'One teammate, who gets a Slack message', run: () => afterBack(() => todoAsk(b, t)) },
    t.done || mineNow ? null : { label: 'Take it yourself', icon: 'user-check', sub: who ? `Instead of ${teamFirst(who)}` : '', run: () => setTodoPerson(b, t, S.me?.id || null) },
    { label: t.due_date ? 'Change the due date' : 'Add a due date', icon: 'calendar-days', sub: t.due_date ? `Due ${dayOf(t.due_date)}` : '', run: () => afterBack(() => todoDue(b, t)) },
    { label: 'Delete to-do', icon: 'trash-2', danger: true, run: () => todoDelete(b, t) },
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
// The toast names the one person and says they are told (064 sends a Slack message whenever someone else gives them a
// to-do or puts them down for a hearing), unless they turned that kind of message off in My settings.
// told(a, 'todo', 'has it now') -> "Kris has it now and gets a Slack message."
export const told = (a, kind, what) => a?.prefs?.workflow?.[kind] === false
  ? `${firstName(a)} ${what}. They have these messages turned off, so tell them yourself.` : `${firstName(a)} ${what} and gets a Slack message.`;
// Undo puts the to-do back with whoever had it.
async function setTodoPerson(b, t, v) {
  const before = t.assignee_id || null; if (v === before) return;
  const sel = `[data-tmore="${CSS.escape(String(t.id))}"]`;
  try {
    await DB.updateTodo(b.id, t.id, { assignee_id: v }); rerender(sel);
    const a = advocate(v), was = advocate(before);
    toast(v === S.me?.id ? 'It is yours now.' : told(a, 'todo', 'has it now'), { undo: async () => {
      await DB.updateTodo(b.id, t.id, { assignee_id: before }); rerender(sel);
      toast(!before ? 'Put back as it was.' : before === S.me?.id ? 'It is yours again.' : `Back with ${teamFirst(was)}.`);
    } });
  } catch (e) { toast(e, { err: true }); }
}
async function todoDelete(b, t) {
  const keep = { ...t };
  try {
    await DB.deleteTodo(b.id, t.id); rerender();
    toast('To-do deleted.', { undo: async () => {
      await DB.addTodo(b.id, keep.title);
      const n = (S.todos[b.id] || []).slice(-1)[0];
      if (n) await DB.updateTodo(b.id, n.id, { due_date: keep.due_date || null, assignee_id: keep.assignee_id || null, done: !!keep.done });
      rerender();
    } });
  } catch (e) { toast(e, { err: true }); }
}
// A coalition by its name in words ("Tobacco-Free Hawaiʻi"), as the issue page says it (issuepage.js), never its code
// ("CTFH", the coalition's short name, which the search still finds it by). R-344 D1.
const coalName = c => c ? c.public_name || c.name : '';
function editCoalitions(b) {
  const body = () => S.campaigns.length ? `<p class="small muted bw-shhelp">Tap to add or remove. Each change saves.</p><div class="sv-pickl">${S.campaigns.map(c => { const on = (S.billCampaigns[b.id] || []).includes(c.id);
    return `<button type="button" role="checkbox" aria-checked="${on}" data-camp="${esc(c.id)}">${icon(on ? 'square-check-big' : 'square', { cls: on ? 'on' : '' })}<span class="body"><span class="title">${esc(coalName(c))}</span></span></button>`; }).join('')}</div>`
    : '<p class="muted">No coalitions yet. An admin adds them under Session setup.</p>';
  openSheet({ title: `Coalitions for ${esc(sayWords(b))}`, body: body(),
    onClose: () => rerender('[data-coal]'),
    wire: dlg => {
      const wireBtns = () => dlg.querySelectorAll('[data-camp]').forEach(el => el.onclick = async () => {
        const id = el.dataset.camp, on = el.getAttribute('aria-checked') !== 'true', nm = coalName(S.campaigns.find(c => c.id === id)) || 'the coalition';
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

// ---- the pinned note for the team: at the top of Team talk ----
// Saved, it reads as a pinned message with Edit; empty, it is one line, "Add a pinned note". Typing opens it as a box, and
// a box with unsaved words stays a box until it is saved, whatever else redraws the page. One name for it (C-15): Team
// talk's box also adds notes to the bill's record ("Log what happened"), so this one is the pinned note.
const noteBase = new Map();
S.bwNoteEdit ??= new Set();
export function noteSection(b) {
  const d = drafts.get(b.id + ':note'), saved = b.internal_notes || '', unsaved = d != null && d !== saved;
  const head = `<h2 class="bw-h3" id="bw-note-h">${icon('lock')}<span>Pinned note for the team</span> <span class="bw-sub">never public</span></h2>`;
  if (!unsaved && !S.bwNoteEdit.has(b.id)) {
    if (!saved.trim()) return `<section class="bw-sec bw-note0" aria-label="Pinned note for the team">${btn('Add a pinned note', { kind: 'text', icon: 'lock', attrs: { 'data-noteedit': '1' } })}</section>`;
    return `<section class="bw-sec bw-tnote" aria-labelledby="bw-note-h"><div class="bw-sech">${head}${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-noteedit': '1', 'aria-label': 'Edit the pinned note' } })}</div>
      <p class="bw-notetx">${esc(saved)}</p><p class="bw-noteby" id="bw-noteby">${esc(noteByText(b))}</p></section>`;
  }
  return `<section class="bw-sec bw-tnote editing" aria-labelledby="bw-note-h">${head}
    <div class="field"><label class="sr" for="bw-note">Pinned note for the team</label><textarea id="bw-note" rows="3" placeholder="Context the team should keep: who we talked to, what the chair said, what to watch for.">${esc(d ?? saved)}</textarea></div>
    <div class="bw-acts">${btn('Save pinned note', { kind: 'secondary', attrs: { 'data-savenote': '1' } })}${unsaved ? '<span class="bw-quiet">Not saved yet</span>' : ''}</div>
  </section>`;
}
// The team note (Team talk, pinned): never public; typed text survives other saves until it is saved. Save writes only
// what changed and shows a teammate's newer note before replacing it (R-152 B); Undo puts back the note it replaced.
export function wireNote(pnl, b) {
  pnl.querySelector('[data-noteedit]')?.addEventListener('click', () => {
    S.bwNoteEdit.add(b.id); rerender('#bw-note');
    const t = document.getElementById('bw-note'); if (t) try { t.setSelectionRange(t.value.length, t.value.length); } catch { /* not a text field */ }
  });
  const note = pnl.querySelector('#bw-note'); if (!note) return;
  note.oninput = () => { if (!noteBase.has(b.id)) noteBase.set(b.id, b.internal_notes ?? null); drafts.set(b.id + ':note', note.value); };
  pnl.querySelector('[data-savenote]').onclick = async e => {
    const v = note.value.trim(), base = noteBase.has(b.id) ? noteBase.get(b.id) : (b.internal_notes ?? null); const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
    const finish = res => {
      if (res.changed.length) S.bwTL?.[b.id]?.unshift({ bill_id: b.id, advocate_id: S.me.id, type: 'field_change', title: 'Internal notes edited', occurred_at: new Date().toISOString(), source: 'team' });
      drafts.delete(b.id + ':note'); noteBase.delete(b.id); S.bwNoteEdit.delete(b.id); rerender('[data-noteedit]');
      if (!res.changed.length) { toast('Nothing to save: the note already says this.'); return; }
      toast('Pinned note saved.', { undo: async () => { try { await DB.updateBill(b.id, { internal_notes: res.prev.internal_notes ?? null }); drafts.delete(b.id + ':note'); noteBase.delete(b.id); S.bwNoteEdit.delete(b.id); rerender('[data-noteedit]'); toast('Note put back as it was.'); } catch (x) { toast(x, { err: true }); } } });
    };
    try {
      const res = await DB.saveBillFields(b.id, { internal_notes: v || null }, { internal_notes: (base ?? '').trim() || null });
      if (!res.conflicts.length) { finish(res); return; }
      go.removeAttribute('aria-busy');
      askConflict({ title: 'A teammate changed the pinned note', fields: res.conflicts.map(c => ({ label: 'Pinned note', theirs: c.theirs, mine: c.mine })),
        keepTheirs: async () => { drafts.delete(b.id + ':note'); noteBase.delete(b.id); S.bwNoteEdit.delete(b.id); rerender('[data-noteedit]'); toast('Kept your teammate’s note.'); },
        replace: async () => { try { finish(await DB.saveBillFields(b.id, { internal_notes: v || null }, { internal_notes: (base ?? '').trim() || null }, { force: true })); } catch (x) { toast(x, { err: true }); } } });
    }
    catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
  };
}

// ---- the right column (R-346, Nate's pick "bold" 27 Oct): the issue, the hearing, who is on it ----
// On a laptop (900px and up) it stands beside the bill, so the page uses the width (G); below 900px it drops under the
// step card on Next step, and under the tab's own content on Team talk and Public (bill.css .bw-two).
// The hearing the card shows: the step's own sitting (what the step card's hearing line used to say), else the next one.
function sideHearing(b, s) {
  if (s?.kind === 'chair') return hearingAhead(b) || null;
  return s?.h || hearingAhead(b) || null;
}
// "Hearing today", the time and room large, the committee as the door to the sitting's page, who is going and I'm going
// (the step card's going row, steps.js goingRowHTML). A cancelled sitting says only that.
function hearingSide(b, s) {
  const h = sideHearing(b, s); if (!h) return '';
  const href = `#/hearing/${encodeURIComponent(h.id)}?from=${encodeURIComponent(b.bill_number)}`, name = committeeName(h.committee) || h.committee;
  const at = new Date(h.scheduled_at).getTime(), day = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const word = day(at) === day(Date.now()) ? 'today' : day(at) === day(Date.now() + 864e5) ? 'tomorrow' : dayWords(h.scheduled_at);
  const moved = movedFrom(h), cancelled = h.status === 'cancelled';
  return `<section class="bw-scard bw-hside" aria-labelledby="bw-hs-h">
    <h2 class="bw-sh" id="bw-hs-h">${icon('gavel')}<span>${cancelled ? 'Hearing cancelled' : `Hearing ${esc(word)}`}</span></h2>
    ${cancelled ? '<p class="bw-hs-note">No new date yet.</p>' : `<p class="bw-hs-when">${nw(esc(timeWords(at)))}${h.room ? ` · ${nw(esc(roomName(h.room)))}` : ''}</p>`}
    <p class="bw-hs-cn"><a href="${esc(href)}">${esc(name)}</a></p>
    ${moved && !cancelled ? `<p class="bw-hs-note">${icon('clock')}<span>Moved from ${nw(esc(moved))}</span></p>` : ''}
    ${cancelled ? '' : goingRowHTML(h)}
  </section>`;
}
// Who is on it: who follows the bill and its coalitions (moved here from About this bill, said once: A-14). The owner is
// the header's own line, with its picker.
function whoSide(b) {
  const coal = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)).filter(Boolean), f = followText(b);
  return `<section class="bw-scard bw-wside" aria-labelledby="bw-ws-h">
    <h2 class="bw-sh" id="bw-ws-h">${icon('users')}<span>Who is on it</span></h2>
    <p><span class="bw-ws-k">Teammates following:</span> ${f ? esc(f) : '<span class="bw-quiet">no one yet</span>'}</p>
    <p class="bw-ws-coal"><span><span class="bw-ws-k">${coal.length === 1 ? 'Coalition' : 'Coalitions'}:</span> ${coal.length ? coal.map(c => `<a class="bw-ws-a" href="#/coalition/${esc(c.id)}">${icon(c.icon || 'users')}<span>${esc(coalName(c))}</span></a>`).join(', ') : '<span class="bw-quiet">none</span>'}</span>${btn('Edit', { kind: 'text', sm: true, attrs: { 'data-coal': '1', 'aria-label': 'Edit coalitions', 'aria-haspopup': 'dialog' } })}</p>
  </section>`;
}
function sideHTML(b, s) {
  const isx = issuesOfBill(b.id);
  // A hearing today or tomorrow comes first, so its time and room are on the first screen (B-2, A-1: the critic found them
  // below the fold under a long issue card).
  const h = sideHearing(b, s), soon = h && h.status !== 'cancelled' && new Date(h.scheduled_at).getTime() - Date.now() < 2 * 864e5;
  const iss = isx.length ? issueCardHTML(isx[0], b) : '', hs = hearingSide(b, s);
  return `<aside class="bw-side" aria-label="Its issue, hearing and team">${soon ? hs + iss : iss + hs}${whoSide(b)}</aside>`;
}

// ---- the page ----
// On Team talk and Public, one quiet line when the bill's step is the viewer's, "Your step: File by Wed 3/18, 7:30 AM ›",
// that opens Next step (B-7; v5 kept its Next up card beside every tab). A link to the tab, not a second copy of the button.
function yourStepLine(b, s) {
  if (!s?.you || !s.line) return '';
  return `<p class="bw-yourstep"><a class="bw-ysl" href="${billHref(b)}" data-tab="overview" aria-label="Your step: ${esc(s.line)}. Open Next step">${icon('circle-dot')}<span><b>Your step:</b> ${nw(esc(s.line))}</span>${icon('chevron-right', { cls: 'bw-yschev' })}</a></p>`;
}
function panel(b, tab) {
  if (tab === 'activity') { loadTimeline(b); return noteSection(b) + renderActivity(b); }
  if (tab === 'public') return renderPublic(b);
  return overview(b);
}
// Opening a door: an old Pathway or Testimony link, "Borrow from earlier testimony", or a key. It opens, comes into view
// under the header, and takes the focus (its summary), so a screen reader hears where it landed.
function openDoor(b, k) {
  (S.bwDoor[b.id] ??= {})[k] = true;
  if (tabOf(S.route || {}) !== 'overview') { goDoor = k; switchTab('overview'); return; }
  toDoor(k);
}
let goDoor = null;
function toDoor(k) {
  const el = document.getElementById({ about: 'bw-about', cmt: 'bw-cmt', earlier: 'bw-earlier' }[k]); if (!el) return;
  el.open = true;
  const y = Math.max(0, Math.round(el.getBoundingClientRect().top + window.scrollY - underTabs() - 12));
  window.scrollTo({ top: y, behavior: calm() ? 'auto' : 'smooth' });
  el.querySelector('summary')?.focus({ preventScroll: true });
}
function notFound(route, failed = false) {
  const num = String(route.num || '').toUpperCase();
  if (failed) return `<div class="bw-page"><h1 class="bw-h1">${esc(num)}</h1>${empty({ h: 'h2', title: 'We could not look that bill up', text: 'Check your connection and try again.', action: btn('Try again', { icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } }) })}</div>`;
  return `<div class="bw-page"><h1 class="bw-h1">${esc(num || 'Bill')}</h1>${empty({ h: 'h2', title: num ? `${esc(num)} is not on our list` : 'Which bill?', text: num ? 'It may not be tracked yet. Search for it to track it.' : 'Find it by number or words.',
    action: btn(num ? `Search for ${esc(num)}` : 'Search bills', { href: '#/search' + (num ? '?q=' + encodeURIComponent(num) : ''), icon: 'search' }) })}</div>`;
}
// Phones: the frame's top bar holds Back and the bill's number. A long back label that would push the number off becomes
// "Back" (the frame does this past 14 characters too); its screen-reader name still says where it goes.
function fitBack(o) { return o.label.length > 12 && PHONE() ? { ...o, label: 'Back', full: false } : o; }

export default {
  tab: 'bills',
  // The frame's title (the phone's top bar, the window's name): the number as staff say it, no draft code (D15, V05).
  title: r => { const b = billOf(r); return b ? numWords(b) : (untrackedOf(r)?.bill_number || r.num || 'Bill'); },
  back: r => fitBack(origin(r)),
  render(route) {
    const b = billOf(route); if (!b) return route.num ? untrackedHTML(route, notFound) : notFound(route);
    const tab = tabOf(route), s = pageStep(b), next = tab === 'overview';
    // Where it is, on every tab (R-336): the stage tracker under the name (tracker.js), whose caption took over the header's
    // line. On Next step, when the step card names the committee and its hearing (cardSays), the caption keeps only where it
    // is among the chamber's committees (A-14); the other tabs have no step card, so it names them.
    // Two columns from 900px (R-346): the bill, its stage bar, the tabs and the step on the left; the right column
    // (sideHTML) holds the issue, the hearing and who is on it.
    return `<div class="bw-page bw-two${next ? ' bw-onnext' : ''}" data-bw="${esc(b.id)}">
      <div class="bw-main">
      ${headHTML(b, route)}
      ${trackerHTML(b, { says: next ? cardSays(b, s) : null, cardDeadline: next && s?.kind === 'chair' && !!cardSays(b, s)?.deadline, heardNow: sittingNow(b), dead: diedish(b) ? deadWords(b) : '' })}
      ${tabsNav(b, tab, s)}
      <div class="bw-panel${fresh ? ' bw-in' : ''}" id="bw-panel" data-panel="${tab}">${next ? '' : yourStepLine(b, s)}${panel(b, tab)}</div>
      </div>
      ${sideHTML(b, s)}
    </div>`;
  },
  // Team talk's one box sits at the top of the stream at every width (activity.js): no bar over the phone's tab bar.
  wire(route, root) {
    const b = billOf(route);
    if (!b) { wireUntracked(route, root); return; }
    const tab = tabOf(route), page = root.querySelector('.bw-page');
    // Opened by a link or a reload (not a tab tap, not Previous / Next, not Back, not a re-render after a save)?
    const arrival = fresh && !switching && !popping;
    const inApp = !!prevRoute && !(prevRoute.name === 'bill' && prevRoute.num === route.num && prevRoute.year === route.year);
    // Remember the origin in this history entry, so coming Back to the bill still names the right page.
    const o = origin(route); carry = null;
    try { if (!history.state?.bwFrom || history.state.bwFrom.href !== o.href) history.replaceState({ ...(history.state || {}), bwFrom: o }, ''); } catch { /* ignore */ }
    page.querySelectorAll('[data-bwmore]').forEach(el => el.onclick = () => pageMenu(b));
    page.querySelector('[data-bwpos]')?.addEventListener('click', () => pickPosition(b));
    page.querySelector('[data-bwowner]')?.addEventListener('click', () => pickOwner(b));
    page.querySelector('[data-bwfollow]')?.addEventListener('click', () => toggleFollow(b));
    wireNick(page, b);
    wireTracker(page, b);
    page.querySelector('.bw-side [data-coal]')?.addEventListener('click', () => editCoalitions(b));
    // Previous / Next replace this entry, so Back still goes to the list.
    page.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); e.stopImmediatePropagation(); const nb = neighbours(b), to = nb && (a.dataset.nav === 'prev' ? nb.prev : nb.next); if (to) goBill(to); }));
    // Tabs replace the entry too (Back leaves the bill).
    page.querySelectorAll('[data-tab]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); e.stopImmediatePropagation(); switchTab(a.dataset.tab); }));
    const pnl = page.querySelector('#bw-panel');
    // "Write it" on Today (and ?ask=1) opens the Public tab at the ask, with the cursor in it, the way ?reply=1 opens Team
    // talk at the message box. A tab tap never does: it would raise the keyboard uninvited. ?focus=drafts (R-148, Today's
    // "Say what HD2 changed") opens it at the notes on each version instead.
    const toDrafts = tab === 'public' && arrival && route.q?.focus === 'drafts';
    const focusAsk = !toDrafts && tab === 'public' && arrival && (!!(route.q?.ask || route.q?.focus === 'ask') || (inApp && !liveAsk(b)));   // an expired ask is no ask (Z1-3)
    if (tab === 'overview') wireOverview(pnl, b);
    else if (tab === 'activity') { wireNote(pnl, b); wireActivity(pnl, b, route, root); }
    else if (tab === 'public') wirePublic(pnl, b, { focusAsk });
    // An old Pathway, Testimony or Details link (#/bill/HB1562/pathway, a legislator page's way back) opens its door, after
    // the frame's own scroll to the top, hence the next paint.
    const door = goDoor || (arrival && tab === 'overview' ? SECTION_OF[route.tab] : null); goDoor = null;
    if (door) { (S.bwDoor[b.id] ??= {})[door] = true; requestAnimationFrame(() => toDoor(door)); }
    else if (toDrafts) { S.focusDrafts = b.id; wireDraftsFocus(pnl, b); }
  },
};

function wireOverview(pnl, b) {
  // the doors remember being open (B-6)
  pnl.querySelectorAll('[data-bwdoor]').forEach(d => d.addEventListener('toggle', () => { (S.bwDoor[b.id] ??= {})[d.dataset.bwdoor] = d.open;
    if (d.open && d.dataset.bwdoor === 'todo') { S.bwTodoOpen.add(b.id); d.querySelector('#bw-tdnew')?.focus(); } }));
  pnl.querySelector('[data-bwdone]')?.addEventListener('toggle', e => { (S.bwDoneOpen ??= {})[b.id] = e.currentTarget.open; });
  try { wireCommittees(pnl, b); } catch (e) { console.error(e); }
  wireTestimony(pnl, b);
  pnl.querySelectorAll('[data-borrow]').forEach(el => el.onclick = () => openDoor(b, 'earlier'));
  pnl.querySelectorAll('[data-logtalk]').forEach(el => el.onclick = () => logConversation({ bill: b, onDone: () => hooks.render() }));
  pnl.querySelectorAll('[data-stage]').forEach(el => el.onclick = () => pickStage(b));
  pnl.querySelector('[data-sponsall]')?.addEventListener('click', () => { (S.bwSponsAll ??= {})[b.id] = true; rerender(); });
  // to-dos
  pnl.querySelectorAll('[data-tick]').forEach(el => el.onclick = async () => {
    const t = (S.todos[b.id] || []).find(x => String(x.id) === el.dataset.tick); if (!t) return;
    const done = !t.done; el.disabled = true;
    try { await DB.updateTodo(b.id, t.id, { done }); rerender(done ? '[data-todoopen], #bw-tdnew' : `[data-tick="${CSS.escape(String(t.id))}"]`);
      if (done) toast('Done.', { ok: true, undo: async () => { await DB.updateTodo(b.id, t.id, { done: false }); rerender(); } }); }
    catch (e) { el.disabled = false; toast(e, { err: true }); }
  });
  pnl.querySelectorAll('[data-tmore]').forEach(el => el.onclick = () => { const t = (S.todos[b.id] || []).find(x => String(x.id) === el.dataset.tmore); if (t) todoMenu(b, t); });
  // "Add a to-do" opens the box, with the cursor in it; Esc in an empty box folds it back to the one line.
  pnl.querySelector('[data-todoopen]')?.addEventListener('click', () => { S.bwTodoOpen.add(b.id); rerender('#bw-tdnew'); });
  const form = pnl.querySelector('[data-todoadd]'), inp = pnl.querySelector('#bw-tdnew');
  if (form && inp) {
    inp.oninput = () => drafts.set(b.id + ':todo', inp.value);
    inp.onkeydown = e => { if (e.key === 'Escape' && !inp.value.trim()) { e.preventDefault(); e.stopPropagation(); drafts.delete(b.id + ':todo'); S.bwTodoOpen.delete(b.id); rerender('[data-todoopen]'); } };
    form.onsubmit = async e => {
      e.preventDefault();
      const title = inp.value.trim();
      if (!title) { toast('Type the to-do first.'); inp.focus(); return; }
      const forId = pnl.querySelector('#bw-tdfor')?.value ?? null, due = pnl.querySelector('#bw-tddue')?.value || null;
      try { await DB.addTodo(b.id, title);
        if (TODO_FOR()) { const t = (S.todos[b.id] || []).at(-1); if (t) await DB.updateTodo(b.id, t.id, { assignee_id: forId || null, due_date: due }); }   // W58
        drafts.delete(b.id + ':todo'); rerender('#bw-tdnew');
        const whom = forId && forId !== S.me?.id ? advocate(forId) : null;
        toast(whom ? `${told(whom, 'todo', 'has it now')}${due ? ` Due ${dayOf(due)}.` : ''}` : `To-do added${forId ? ' for you' : ''}${due ? `, due ${dayOf(due)}` : ''}.`, { ok: true }); }
      catch (x) { toast(x, { err: true }); }
    };
  }
}
