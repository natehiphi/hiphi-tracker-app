// Outreach > This week's asks (#/outreach; R-269, rebuilt for Staff v6 by R-336 V20). Outreach is for rallying people,
// so it opens on the week's asks: one short card per bill with testimony closing in the next 7 days (the first 8, then
// "Show all N", C-15), each with
//   - the deadline (when testimony closes), the position and the committee;
//   - the ask's own words (the Public tab's "The ask"), or one line that says it is not written yet, whose it is and by
//     when, with "Write the public ask", which opens the box in place (saved to the same field);
//   - once an ask exists, Copy link · Copy message · Copy post · Email followers in one row (the bill's and the hearing's
//     share kits link here);
//   - how it is landing: the bill's followers (and what people did, from 10 people, D4).
// At the top, "Copy all for the newsletter" and "Copy all as posts" say which bills they leave out (X23: the old copy
// quietly dropped a bill, and filled a blank ask with "Please speak up on ..."). Ralliers also see the partners' asks
// going out (F187, read-only), and at the foot "How it's landing" adds the week up (D4, from 10 people).
// v6 draws the cards itself: they used to come from today.js (weekAsksHTML), which TODAY is rebuilding (spec 11).
// The rallier, with no migration (spec 6 and addendum 6): Saya on CTFH, else the coalition's owner, else the bill's owner.
// TODAY may import rallierOf() and askDueAt() to put the ask on the rallier's Today two days before it is due.
import { S, DB, esc, fmtDT, advocate, isMine, hooks, DEMO, seesTeam } from './data.js';
import { sharePageUrl, liveAsk, billRoute, whenAt, timeFirst, hstDayOf, publicResponse, billById, spanOf } from './model.js';
import { icon, btn, empty, toast, sectionNav, whoseSeg } from './ui.js';
import { pageHead } from './lists.js';
import { nameWords, numWords, committeeName, statusTile, nw } from './steps.js';
import { emailDoor, paused, dailyWord, HELD_HEAD } from './composer.js';
import { weekLanding } from './firstvisit.js';
import { ACTS } from './verbs.js';   // R-344: one icon per action (Write the public ask: the megaphone, the job's own picture)
import { markNewStep } from './help.js';   // Getting started's rallier steps tick from here (Write a public ask, Copy this week's newsletter)

const HR = 36e5, DAY = 864e5;
const plural = (n, one, many = one + 's') => `${Number(n || 0).toLocaleString()} ${n === 1 ? one : many}`;
const first = id => (advocate(id)?.full_name || '').split(' ')[0] || 'someone';
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const live = id => !!id && advocate(id)?.is_active !== false;
// When the public's written testimony closes (the hearing's deadline, else a day before it), as Today counts it.
const testDue = h => h && h.status !== 'cancelled' ? new Date(h.testimony_deadline || new Date(h.scheduled_at).getTime() - DAY).getTime() : null;
const hst = t => hstDayOf(t);
const dayAdd = (day, n) => new Date(new Date(day + 'T12:00:00-10:00').getTime() + n * DAY).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });

// The public ask is due at 4:00 PM Hawaiʻi time two calendar days before the hearing (Nate, R-025 answer 4), and never
// later than the last 4:00 PM at least 12 hours before written testimony closes (R-116). The same rule as today.js.
export function askDueAt(h) {
  const two = new Date(dayAdd(hst(new Date(h.scheduled_at).getTime()), -2) + 'T16:00:00-10:00').getTime();
  if (!h.testimony_deadline) return two;
  const cut = new Date(h.testimony_deadline).getTime() - 12 * HR, four = new Date(hst(cut) + 'T16:00:00-10:00').getTime();
  return Math.min(two, four <= cut ? four : four - DAY);
}

// ---- whose ask it is (spec 6, addendum 6: no rally-lead setting exists, and adding one is a migration, D13) ----
// Saya rallies for CTFH; any other coalition's rallier is its owner; a bill in no coalition is its owner's to rally.
const RALLY_LEADS = { CTFH: 'SY' };   // campaign name -> the rally lead's initials, until a setting exists
const leadOf = c => { const ini = RALLY_LEADS[c.name]; const a = ini && S.advocates.find(x => x.initials === ini && x.is_active !== false); return a ? a.id : live(c.owner_id) ? c.owner_id : null; };
export function rallierOf(b) {
  const ids = (S.billCampaigns?.[b?.id] || []).map(id => (S.campaigns || []).find(c => c.id === id)).filter(Boolean).map(leadOf).filter(Boolean);
  const own = (S.assignments?.[b?.id] || []).filter(live);
  return [...new Set(ids.length ? ids : own.slice(0, 1))];
}
// Someone who rallies for a coalition (Saya, a coalition's owner): they see the partners' asks going out (F187).
export const isRallier = (me = S.me) => !!me && (S.campaigns || []).some(c => leadOf(c) === me.id);
// Whether the viewer is the one who writes this bill's ask: its rallier, or its owner when it has none (askDue's `mine`).
// R-358: this is the one rule for who writes a bill's public ask (rallierOf's first names, else the owner). Today's rows, the
// Public tab's link and the cards' button all read it, so nobody is sent to a card that has no button for them.
export const writesAsk = b => { const me = S.me?.id, r = rallierOf(b); return !!me && (r.length ? r.includes(me) : (S.assignments?.[b?.id] || []).includes(me)); };
// Who may write a bill's ask here: its rallier, its owner, an admin (the Public tab is open to the same people).
const mayWrite = b => !!S.me && (S.me.is_admin || rallierOf(b).includes(S.me.id) || (S.assignments?.[b.id] || []).includes(S.me.id));

// ---- the week's asks ----
// Bills with a position on the public page whose testimony closes in the next 7 days, soonest first; each bill once, at
// its soonest deadline. `mine`: the asks the viewer writes (they are the bill's rallier: Saya writes everyone's public
// asks, R-356 decision 2, so her list is those and needs no Team), plus the bills on the viewer's coalitions, or their
// own bills when they help on none. The rule for "writes" is askDue's `mine` below, so the list and the card agree.
// Closing within 3 hours keeps the card (a post can still help) but leaves the newsletter (`soon`).
const myCoals = () => { const c = S.me?.prefs?.coalitions, ids = (S.campaigns || []).map(x => x.id); return new Set(c === 'all' ? ids : Array.isArray(c) ? c.filter(id => ids.includes(id)) : []); };
export function weekAskItems({ mine = false } = {}) {
  const now = Date.now(), end = now + 7 * DAY, seen = new Map(), co = mine ? myCoals() : null;
  const own = co?.size ? b => (S.billCampaigns?.[b.id] || []).some(id => co.has(id)) : b => isMine(b);
  const keep = !mine ? () => true : b => writesAsk(b) || own(b);
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled') continue;
    const due = testDue(h), b = billById(h.bill_id);
    if (!b || b.position === 'monitor' || !b.position || !b.is_public || b.tracked === false || !(due > now) || due >= end || !keep(b)) continue;
    if (!seen.has(b.id) || due < seen.get(b.id).due) seen.set(b.id, { b, h, due, soon: due - now < 3 * HR });
  }
  return [...seen.values()].sort((x, y) => x.due - y.due || (x.b.priority || 9) - (y.b.priority || 9));
}
// Where a bill's card is (the bill's Public tab and the hearing page link here instead of keeping their own share kits):
// '' when the bill has no card this week, so the caller keeps its own Copy share link.
export const askCardHref = b => b && weekAskItems().some(x => x.b.id === b.id) ? `#/outreach?bill=${encodeURIComponent(String(b.bill_number).replace(/\s/g, ''))}` : '';

// R-358: the address that lands IN the open box (Today's row, no second click); '' without a card, callers use the Public tab.
export const askWriteHref = b => { const c = askCardHref(b); return c ? `${c}&write=1` : ''; };
// Whose ask a bill's card is, for a screen that is not the card (the Public tab): the writer's first name, when it is due.
export function askWhose(b) {
  const x = b && weekAskItems().find(i => i.b.id === b.id); if (!x) return null;
  const r = rallierOf(b), own = (S.assignments?.[b.id] || []).filter(live)[0];
  return { who: r.length ? first(r[0]) : own ? first(own) : '', due: askDueAt(x.h), mine: writesAsk(b) };
}

// ---- the words that go out (to the public: no codes, the number spaced, the name once; C-15) ----
const ASK_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes',
  strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting' };   // the public page's words (pub/core.js POS_SAYS)
const pubNum = b => String(b.bill_number || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const askName = b => b.nickname ? `${b.nickname} (${pubNum(b)})` : pubNum(b);
const askOf = b => liveAsk(b).replace(/([^.!?])$/, '$1.');
const link = (b, via = '') => `${sharePageUrl(b, 'testify')}${via ? `?via=${via}` : ''}`;
// With no ask written, the message and the post say only the bill, its deadline and the link: never stock words in
// place of the ask (X23), and the toast says so (A-16: a confirmation must be true).
// An ask that already names the deadline's day ("Send testimony by Wed 3/18, 9:30 AM") is not followed by the same date
// again (the message said it twice).
const namesDue = (a, due) => { const md = /\d{1,2}\/\d{1,2}/.exec(fmtDT(due))?.[0]; return !!md && new RegExp(`(^|\\D)${md.replace('/', '\\/')}(\\D|$)`).test(a); };
const dueLine = (a, due, word = 'Testimony is due') => namesDue(a, due) ? '' : ` ${word} ${fmtDT(due)}.`;
const messageOf = x => { const a = askOf(x.b);
  return a ? `${a}${dueLine(a, x.due)} It takes a few minutes: ${link(x.b)}` : `${askName(x.b)}: testimony is due ${fmtDT(x.due)}. It takes a few minutes: ${link(x.b)}`; };
function postOf(x) {
  const url = link(x.b, 'social'), name = askName(x.b), a0 = askOf(x.b);
  if (!a0) return `${name}: testimony due ${fmtDT(x.due)}. ${url}`;
  const due = dueLine(a0, x.due, 'Testimony due').trim(), room = 280 - (name.length + due.length + url.length + 4);
  let a = a0; if (a.length > room) a = a.slice(0, Math.max(room - 1, 20)).replace(/\s+\S*$/, '') + '…';
  return `${name}: ${a}${due ? ' ' + due : ''} ${url}`;
}
// Copy all: only bills with an ask written (a blank one is never filled with stock words, X23), and for the newsletter
// none closing within 3 hours. leftOut() names what each leaves out and why.
function copyAll(items, kind) {
  const use = items.filter(x => askOf(x.b) && (kind === 'social' || !x.soon));
  if (kind === 'social') return { use, text: use.map(postOf).join('\n\n') };
  const head = `This week at the Legislature: ${use.length === 1 ? 'one bill on HIPHI’s issues needs' : `${use.length} bills on HIPHI’s issues need`} your voice. Each takes a few minutes.`;
  return { use, text: head + '\n\n' + use.map(x => `${askName(x.b)} · ${ASK_SAYS[x.b.position] || 'HIPHI’s position'}\n${askOf(x.b)}${dueLine(askOf(x.b), x.due)}\n${link(x.b, 'newsletter')}`).join('\n\n') };
}
const listNums = xs => { const n = xs.map(x => pubNum(x.b)); return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`; };
// What a Copy all left out, for its toast: "SB 3076 and HB 1573 have no ask yet."
function leftWords(items, kind) {
  const blank = items.filter(x => !askOf(x.b)), late = kind === 'social' ? [] : items.filter(x => askOf(x.b) && x.soon);
  return [blank.length ? `${listNums(blank)} ${blank.length === 1 ? 'has' : 'have'} no ask yet.` : '', late.length ? `${listNums(late)} ${late.length === 1 ? 'closes' : 'close'} within 3 hours, too soon for a newsletter.` : ''].filter(Boolean).join(' ');
}
function leftOut(items) {
  const blank = items.filter(x => !askOf(x.b)), late = items.filter(x => askOf(x.b) && x.soon), one = blank.length === 1;
  if (!blank.length && !late.length) return `Both cover all ${plural(items.length, 'bill')}.`;
  const parts = [];
  if (blank.length) parts.push(`Both leave out ${listNums(blank)}: no ask written yet. Write ${one ? 'it' : 'them'} on ${one ? 'its card' : 'the cards'} below.`);
  if (late.length) parts.push(`The newsletter also leaves out ${listNums(late)}: testimony closes within 3 hours, too soon for a newsletter.`);
  return parts.join(' ');
}

// ---- how it is landing (D4: the public's counts for a bill; a bill's actions only from 10 people, as the database counts
// them, so the week's sums below add up exactly what the cards show). In words a newcomer reads without the rule: below 10
// people only the followers show, and the 10-person rule is said once, in the note at the foot (C-10, A-14). ----
const followers = b => (publicResponse(b) || {}).followers || 0;
function landLine(b) {
  // The total who acted comes first, so the 10-person rule in the note under the cards is visibly met ("5 testified · 4
  // emailed" read as 9, short of 10: the rest shared or said they would attend).
  const c = publicResponse(b) || {}, bits = [c.followers ? plural(c.followers, 'follower') : 'No followers yet'];
  if ((c.people || 0) >= 10) { const did = [c.testimonies ? `${c.testimonies.toLocaleString()} testified` : '', c.emails ? `${c.emails.toLocaleString()} emailed a legislator` : ''].filter(Boolean);
    bits.push(`${c.people.toLocaleString()} acted${did.length ? ` (${did.join(', ')})` : ''}`); }
  return bits.join(' · ');
}
function landingHTML(items) {
  const sum = { followers: 0, emails: 0, testimonies: 0 };
  for (const x of items) { const c = publicResponse(x.b) || {}; sum.followers += c.followers || 0; if ((c.people || 0) >= 10) { sum.emails += c.emails || 0; sum.testimonies += c.testimonies || 0; } }
  const fv = weekLanding();
  const tile = (n, label) => `<div class="ot-tile"><span class="ot-tn">${Number(n).toLocaleString()}</span><span class="ot-tl">${label}</span></div>`;
  const tiles = [tile(sum.followers, 'follow these bills'), sum.testimonies ? tile(sum.testimonies, 'testified on them') : '', sum.emails ? tile(sum.emails, 'emailed a legislator about them') : '',
    fv ? tile(fv.ours, `of ${plural(fv.visits, 'first visit')} came from the newsletter or a post`) : ''].filter(Boolean).join('');
  return `<section class="ot-land" aria-labelledby="ot-land-h"><h2 class="ot-h2" id="ot-land-h">How it’s landing</h2>
    <div class="ot-tiles">${tiles}</div>
    <p class="ot-note">Counts only, never names. What people did on a bill shows once 10 people have acted on it; until then a card shows its followers.${DEMO ? ' The practice copy shows sample numbers.' : ''} <a href="#/issues/all?view=first-visit&amp;from=outreach">First visit numbers</a></p></section>`;
}

// ---- the partners' asks going out (F187, R-328 G): read-only for ralliers; the partner approvers act on the Partners screen ----
const ASK_ON = ['going_out', 'sending'];
function wantPartnerAsks() {
  if (S.pAsks !== undefined || S.pAsksLoading) return;
  S.pAsksLoading = true; S.pAsksErr = false;
  DB.partnerAsks().then(a => { S.pAsks = a || []; }).catch(() => { S.pAsks = null; S.pAsksErr = true; })
    .finally(() => { S.pAsksLoading = false; if (S.route?.name === 'asks') redraw(); });
}
function partnersHTML() {
  if (!isRallier()) return '';
  wantPartnerAsks();
  const on = (S.pAsks || []).filter(a => ASK_ON.includes(a.state)); if (!on.length) return '';
  // The Partners screen's words for the same ask (partnergroups.js): "goes out today at 4:30 PM", and while email is paused
  // nothing goes, so the heading says it is held (composer.js HELD_HEAD) and a line never promises a time.
  const held = paused(), when = a => held && !a.sent ? '' : a.state === 'going_out' ? `goes out ${dailyWord(a.scheduled_for)} at 4:30 PM` : 'going out now';
  return `<section class="ot-pasks" aria-labelledby="ot-pasks-h"><h2 class="ot-h2" id="ot-pasks-h">${held ? `Partners’ asks · ${HELD_HEAD.toLowerCase()}` : 'Partners’ asks going out'}</h2>
    <ul class="ot-plist">${on.slice(0, 5).map(a => { const b = billById(a.bill_id); return `<li><span class="ot-ptop"><b>${esc(a.partner_name)}</b> on ${b ? `<a href="${esc(billRoute(b))}">${esc(nameWords(b, 1e4))}</a>` : esc(a.bill_number || 'a bill')}${when(a) ? `, ${esc(when(a))}` : ''}</span>${a.ask ? `<span class="ot-pask">${esc(a.ask)}</span>` : ''}</li>`; }).join('')}</ul>
    ${on.length > 5 ? `<p class="ot-note">and ${on.length - 5} more.</p>` : ''}</section>`;
}

// ---- one card: short (Nate: less on every screen). The bill, when testimony closes, then either the ask with its share
// row, or one line that says the ask is not written yet with a "Write the public ask" button that opens the box in place, then
// the followers. The share row shows only once an ask exists (with none, there is nothing true to share yet). ----
const cardId = b => 'ot-ask-' + String(b.bill_number).replace(/\s/g, '');
const BASE = new Map();   // the ask as it was when its box was opened (DB.saveBillFields compares against it)
const boxOpen = b => S.otOpen === b.id && writesAsk(b);
// Whose ask it is to write and by when, for this viewer. "Mine": the viewer is its rallier (or, with no rallier, its owner).
// `step`: the ask is a step on the viewer's Today, as today.js makes it (spec 13: the public ask row is for a strong position's
// bill only). Only a step may be red when late, carry the overdue tile or the page's filled button (spec 11.4); the rallier's
// other asks are optional and said in neutral words.
const STRONG = ['strongly_support', 'strongly_oppose'];
function askDue(x) {
  const b = x.b, due = askDueAt(x.h), r = rallierOf(b), me = S.me?.id;
  const mine = writesAsk(b);
  const strong = STRONG.includes(b.position);
  return { due, past: due <= Date.now(), today: hst(due) === hst(Date.now()), mine, strong, step: mine && strong, who: r.length ? first(r[0]) : '' };
}
// The viewer's optional ask (not a step on Today): no red, no tile, a reason a post still helps. No time: the card's first
// line already says when testimony closes (the fresh-eyes check: two times three lines apart read as two deadlines, A-14).
const optionalWords = () => 'No ask yet · a post still helps';
// The viewer's own ask: red as a status tile with its icon and word once it is overdue (D3, addendum 4: the viewer's own
// step); otherwise plain words with a clock, the time bold when it is due today (D3). Not a pill: beside "Write the public ask"
// a pencil pill read as a second button (A-12, spec 4: status never looks like a button), so the pencil is the button's.
function ownTile(d) {
  if (d.past) return statusTile({ tone: 'overdue', icon: 'circle-alert', words: `Ask overdue · was due ${whenAt(d.due)}` });
  return `<span class="ot-nw">${icon('clock')}<span>Ask due ${d.today ? `<b class="v6-nw">${esc(whenAt(d.due))}</b>` : nw(esc(whenAt(d.due)))}</span></span>`;
}
// Someone else's ask, said one way everywhere (R-336 walk 2: "No ask yet" was said three ways), one neutral line per state:
// a strong position's ask ahead with a writer named, "No ask yet · Saya writes it by Tue 9:00 AM"; with nobody named,
// "No ask yet · due Tue 9:00 AM"; once past, "No ask yet · was due Tue 9:00 AM" (no name and no red: only the writer's own
// Today step is red, P-5; the fresh-eyes check's SB 3076). An optional ask (not a strong position) reads as the viewer's own.
function otherWords(d) {
  // R-358: an optional ask read by someone who is not its writer says who can write it, not the writer's own "a post still helps"
  if (!d.strong) return d.who ? `No ask yet · ${d.who} can write one` : optionalWords();
  if (d.past) return `No ask yet · was due ${whenAt(d.due)}`;
  return d.who ? `No ask yet · ${d.who} writes it by ${timeFirst(d.due)}` : `No ask yet · due ${whenAt(d.due)}`;
}
// The clock goes with a time (A-18); "a post still helps" and "Saya can write one" have none, so they stand alone.
const noAskLine = w => !/\d/.test(w) ? `<span>${nw(esc(w))}</span>` : `${icon('clock')}<span>${nw(esc(w))}</span>`;
function writeBox(x, d, lead) {
  const b = x.b, id = cardId(b) + '-w', a = liveAsk(b), changing = !!a;
  if (!BASE.has(b.id)) BASE.set(b.id, { public_action: b.public_action || null, public_action_until: b.public_action_until || null });
  const text = (S.otDraft || {})[b.id] ?? (changing ? b.public_action || '' : '');
  const when = changing ? '' : d.step ? ownTile(d) : d.mine ? `<span class="ot-wdue">${nw(esc(cap(optionalWords(x).replace(/^No ask yet · /, ''))))}</span>` : `<span class="ot-wdue">${esc(cap(otherWords(d).replace(/^No ask yet · /, '')))}</span>`;
  return `<div class="ot-write"><div class="ot-wtop"><label for="${id}">${changing ? 'Change the public ask' : 'Write the public ask'}</label>${when}</div>
    <p class="ot-help" id="${id}-h">What should people do, and by when? A sentence or two. It shows on the public page and in the hearing alert.</p>
    <textarea id="${id}" rows="3" maxlength="280" aria-describedby="${id}-h ${id}-x ${id}-e" data-askbox="${esc(b.id)}">${esc(text)}</textarea>
    <p class="ot-ex" id="${id}-x">For example: “Send testimony by ${esc(fmtDT(x.due))}. Two sentences in your own words are enough.”</p>
    <div id="${id}-e" role="alert"></div>
    <div class="ot-wacts">${btn('Save the public ask', { kind: lead ? 'primary' : 'secondary', icon: 'check', attrs: { 'data-asksave': b.id } })}${btn('Cancel', { kind: 'text', attrs: { 'data-askcancel': b.id } })}</div></div>`;
}
// Copy link · Copy message · Copy post, then the email door. On a phone the three read "Copy: Link Message Post" in one
// row of compact buttons (the word "Copy" said once); each button's name still says it whole.
function shareHTML(x) {
  const b = x.b, nm = nameWords(b, 60), deadline = fmtDT(x.due);
  const cb = (k, word, ic) => btn(`<span class="ot-cw">Copy </span>${word}`, { kind: 'secondary', sm: true, icon: ic, cls: 'ot-cp', attrs: { 'data-askcopy': k, 'data-bill': b.id, 'aria-label': `Copy ${word} for ${nm}` } });
  // Nobody follows it yet: no email door at all (the line under the card says why), never "ask Kevin to email nobody".
  const door = followers(b) ? emailDoor({ bill: b }, { sm: true, say: `could you email ${pubNum(b)}’s followers about the ${deadline} testimony deadline? The ask is on Outreach.` }) : '';
  return `<div class="ot-acts" role="group" aria-label="Share ${esc(nm)}"><span class="ot-cpl" aria-hidden="true">Copy</span>${cb('link', 'link', 'link')}${cb('message', 'message', 'copy')}${cb('post', 'post', 'message-square')}${door ? `<span class="ot-door">${door}</span>` : ''}</div>`;
}
function cardHTML(x, { hl = false, lead = false } = {}) {
  const b = x.b, id = cardId(b), h = x.h, a = liveAsk(b), d = askDue(x), open = boxOpen(b);
  // D3: a deadline today is said with its time in bold (and how long is left once it is under 3 hours); any other day plain.
  const today = hst(x.due) === hst(Date.now()), at = esc(whenAt(x.due));
  const closes = `Testimony closes ${today ? `<b class="v6-nw">${at}</b>` : nw(at)} (Capitol)${x.soon ? `, in ${esc(spanOf(x.due))}` : ''}`;
  // The card's foot is one row: on the left what to do (share, or write the ask), on the right how it is landing; on a
  // narrow card the followers drop under it, at the left (supporters.css .ot-foot).
  let body = '', left = '';
  if (open) body = writeBox(x, d, true);
  else if (a) { body = `<blockquote class="ot-words"><p>${esc(a)}</p>${d.mine ? btn('Change', { kind: 'text', sm: true, attrs: { 'data-askopen': b.id, 'aria-label': `Change the ask for ${nameWords(b, 60)}` } }) : ''}</blockquote>`; left = shareHTML(x); }
  // R-356 round 3, decision 6: the button is the writer's alone (writes: the rallier, else the owner); everyone else reads the plain line
  else if (d.mine) left = `<div class="ot-noask">${d.step ? ownTile(d) : `<span class="ot-nw">${noAskLine(d.mine ? optionalWords(x) : otherWords(d))}</span>`}${btn('Write the public ask', { kind: lead ? 'primary' : 'secondary', sm: true, icon: ACTS.ask.icon, attrs: { 'data-askopen': b.id, 'aria-label': `Write the public ask for ${nameWords(b, 60)}` } })}</div>`;
  else left = `<p class="ot-nw">${noAskLine(otherWords(d))}</p>`;
  return `<section class="ot-card${hl ? ' hl' : ''}" id="${id}" aria-labelledby="${id}-h" tabindex="-1">
    <div class="ot-ctop"><h2 class="ot-name" id="${id}-h"><a href="${esc(billRoute(b, 'public'))}">${esc(nameWords(b, 1e4))}</a></h2><span class="ot-num">${esc(numWords(b))}</span></div>
    <p class="ot-when">${icon('clock')}<span>${closes} · ${esc(ASK_SAYS[b.position] || 'HIPHI has a position')} · ${esc(committeeName(h.committee))}</span></p>
    ${body}
    <div class="ot-foot">${left}<p class="ot-landl">${icon('users')}<span>${esc(landLine(b))}</span></p></div>
  </section>`;
}
// The page's one filled button (A-3, spec 4): Save in an open box; else "Write the public ask" on the card asked for, or on
// the soonest card that is a step on the viewer's Today; else none (copying is never the one thing to do now).
// Arriving for one card (?bill=, Today's "Write the public ask"), that card holds it; otherwise the step Today named (the soonest
// strong-position ask that is the viewer's own), never an optional one above it.
function leadId(items, want = null) {
  const o = items.find(x => boxOpen(x.b)); if (o) return o.b.id;
  const open = x => !liveAsk(x.b) && writesAsk(x.b);
  const picked = want && items.find(x => want.has(x.b.id) && open(x)); if (picked) return picked.b.id;
  const w = items.find(x => open(x) && askDue(x).step);
  return w ? w.b.id : null;
}

// B-3: an empty week says why and offers the way on. Nothing on the viewer's coalitions: the switch's job, as a button.
function emptyHTML(all, n) {
  // Someone who does not see Team (R-356) is not offered the team's list; the words say whose list is empty.
  if (!all && n && !seesTeam()) return `<div class="ot-empty">${empty({ title: 'No asks this week on your list', text: 'The asks you write, and those on your coalitions’ bills, show here when their testimony closes within a week.' })}</div>`;
  if (!all && n) return `<div class="ot-empty">${empty({ title: 'No asks this week on your coalitions’ bills', text: `The team has ${plural(n, 'ask')} this week.`, action: btn('Show the team’s asks', { kind: 'secondary', attrs: { 'data-otall': '1' } }) })}</div>`;
  const next = (S.hearings || []).filter(h => h.status !== 'cancelled' && testDue(h) > Date.now() + 7 * DAY).map(h => ({ h, b: billById(h.bill_id) }))
    .filter(x => x.b && x.b.position && x.b.position !== 'monitor' && x.b.is_public).sort((p, q) => testDue(p.h) - testDue(q.h))[0];
  return `<div class="ot-empty">${empty({ title: 'No asks this week', text: `No bill on the public page with a position has testimony closing in the next 7 days, so there is nothing to send yet.${next ? ` The next: ${esc(nameWords(next.b, 60))}, testimony closes ${esc(whenAt(testDue(next.h)))}.` : ''} ${seesTeam() ? ' Meanwhile, the partner update and supporters are a tab away.' : ''}`,
    action: seesTeam() ? btn('Write a partner update', { kind: 'secondary', href: '#/outreach/partners' }) : '' })}</div>`;
}

const everyOn = route => seesTeam() && route?.q?.all === '1';   // R-356: a linked ?all=1 for someone without Sees Team stays on their own list
// ?bill=HB2121 (a bill's Public tab, Today) or ?hearing=<id> (the hearing page): those cards, highlighted, in view.
function wanted(route) {
  const q = route?.q || {}, key = s => String(s || '').toUpperCase().replace(/\s/g, '');
  if (q.bill) return new Set(S.bills.filter(b => key(b.bill_number) === key(q.bill) || b.id === q.bill).map(b => b.id));
  if (q.hearing) { const h = (S.hearings || []).find(x => String(x.id) === String(q.hearing)); if (!h) return new Set();
    return new Set((S.hearings || []).filter(x => x.scheduled_at === h.scheduled_at && x.committee === h.committee).map(x => x.bill_id)); }
  return null;
}
// A link to a card that is not on the viewer's coalitions opens the team's list, where it is.
const showAll = (route, want) => seesTeam() && (everyOn(route) || (!!want && want.size > 0 && !weekAskItems({ mine: true }).some(x => want.has(x.b.id))));
// C-15: the first 8 cards, then "Show all 11 asks". A link to a card further down shows them all, so it is on the page.
const SHOW = 8;
const cut = (items, want) => items.length > SHOW && !S.otEvery && !(want && items.slice(SHOW).some(x => want.has(x.b.id)));

// The week's asks as cards under a Copy all bar: Outreach draws it with its head, Team's Public asks tab (R-356) without.
function listHTML(items, want) {
  const nl = copyAll(items, 'newsletter').use.length, po = copyAll(items, 'social').use.length;
  // Copy all shows once there is something to copy, and says what it leaves out; with no ask written yet it is not
  // drawn at all (each card says its ask is not written), rather than a line that looks like a dead button.
  const bar = nl + po ? `<div class="ot-copyall" role="group" aria-label="Copy every ask">
    <div class="ot-cabtns">${btn('Copy all for the newsletter', { kind: 'secondary', icon: 'copy', attrs: { 'data-askall': 'newsletter', ...(nl ? {} : { disabled: true }) } })}${btn('Copy all as posts', { kind: 'secondary', icon: 'copy', attrs: { 'data-askall': 'social', ...(po ? {} : { disabled: true }) } })}</div>
    <p class="ot-left">${esc(leftOut(items))}</p></div>` : '';
  const lead = leadId(items, want), short = cut(items, want), shown = short ? items.slice(0, SHOW) : items;
  const more = short ? `<p class="ot-more">${btn(`Show all ${items.length} asks`, { kind: 'text', icon: 'chevron-down', attrs: { 'data-otmore': '1' } })}</p>` : '';
  return `${bar}
    <div class="ot-cards">${shown.map(x => cardHTML(x, { hl: !!want && want.has(x.b.id), lead: x.b.id === lead })).join('')}</div>${more}`;
}
// R-356 decision 2: the team's public asks left Outreach's Team switch for Team's "Public asks" tab (team.js).
export function teamAsksHTML() {
  const items = weekAskItems();
  return `<div class="ot-page">${items.length ? listHTML(items, null) : emptyHTML(true, 0)}</div>`;
}
export function wireTeamAsks(root) { wireAsks(root, () => weekAskItems()); }

export default {
  tab: 'outreach',
  title: () => 'This week’s asks',
  // Wide like Emails and Supporters, so Outreach's tab row stays in one place from tab to tab; the cards keep a reading
  // width (supporters.css .ot-page).
  wide: () => true,
  render(route) {
    const want = wanted(route), team = weekAskItems(), all = showAll(route, want);
    // R-358: ?write=1 opens the writer's box once per address (S.otWrote, like S.otSeen: a redraw or Back does not reopen it).
    if (route?.q?.write === '1' && want?.size === 1 && S.otWrote !== location.hash) { const b = billById([...want][0]); S.otWrote = location.hash; if (b && writesAsk(b) && !liveAsk(b)) S.otOpen = b.id; }
    const items = all ? team : weekAskItems({ mine: true });
    // Team only for people who see it (R-356); with one choice left there is no switch.
    const sw = seesTeam() ? whoseSeg('otwho', myCoals().size ? { coal: 'mine', team: 'all' } : { mine: 'mine', team: 'all' }, all ? 'all' : 'mine', { label: 'Whose asks' }) : '';
    const head = pageHead(sectionNav('outreach', 'asks'), 'Outreach', '', sw);
    if (!items.length) return `<div class="le-page ot-page">${head}${emptyHTML(all, team.length)}${partnersHTML()}</div>`;
    // Decision 6: staff see the asks alone; How it's landing is the leads' (Partner update, Emails, Supporters and Lists too)
    return `<div class="le-page ot-page">${head}${listHTML(items, want)}
      ${partnersHTML()}${seesTeam() ? landingHTML(items) : ''}</div>`;
  },
  wire(route, root) {
    root.querySelectorAll('[data-seg="otwho"]').forEach(b => b.onclick = () => setAll(b.dataset.val === 'all'));
    root.querySelector('[data-otall]')?.addEventListener('click', () => setAll(true));
    wireAsks(root, () => showAll(S.route, wanted(S.route)) ? weekAskItems() : weekAskItems({ mine: true }));
  },
};

// The cards' buttons: copy, write, save. `items` says which list the page shows (Outreach's pick, or Team's whole list).
function wireAsks(root, items) {
    root.querySelector('[data-otmore]')?.addEventListener('click', () => { const n = SHOW; S.otEvery = true; redraw(); root.querySelectorAll('.ot-card')[n]?.querySelector('.ot-name a')?.focus({ preventScroll: true }); });
    const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok, { ok: true }); } catch { toast('Could not copy. Select the words on the card and copy them yourself.', { err: true }); } };
    root.querySelectorAll('[data-askall]').forEach(el => el.onclick = () => {
      const list = items(), { use, text } = copyAll(list, el.dataset.askall);
      if (!use.length) return;
      const left = leftWords(list, el.dataset.askall);
      if (el.dataset.askall !== 'social') markNewStep({ newsletter: 1 });   // Getting started: Copy this week's newsletter
      copy(text, el.dataset.askall === 'social' ? `Copied ${plural(use.length, 'post')}.${left ? ' ' + left : ''}` : `Copied ${plural(use.length, 'ask')} for the newsletter.${left ? ' ' + left : ''}`);
    });
    root.querySelectorAll('[data-askcopy]').forEach(el => el.onclick = () => {
      const x = weekAskItems().find(i => i.b.id === el.dataset.bill); if (!x) return;
      const k = el.dataset.askcopy, has = !!askOf(x.b), bare = 'Copied: the bill, its deadline and the link. No ask is written yet.';
      if (k === 'link') copy(link(x.b), 'Link copied: the bill’s page for testifying.');
      else if (k === 'message') copy(messageOf(x), has ? 'Message copied: the ask, the deadline and the link.' : bare);
      else copy(postOf(x), has ? 'Post copied. It fits in one post.' : bare);
    });
    // Write the ask / Change: the box opens in place, the cursor in it. Cancel closes it and puts focus back.
    root.querySelectorAll('[data-askopen]').forEach(el => el.onclick = () => { const id = el.dataset.askopen; S.otOpen = id; BASE.delete(id); redraw(`[data-askbox="${CSS.escape(id)}"]`); });
    root.querySelectorAll('[data-askcancel]').forEach(el => el.onclick = () => { const id = el.dataset.askcancel; S.otOpen = null; if (S.otDraft) delete S.otDraft[id]; BASE.delete(id); redraw(`[data-askopen="${CSS.escape(id)}"]`); });
    root.querySelectorAll('[data-asksave]').forEach(el => el.onclick = () => saveAsk(root, el.dataset.asksave, el));
    root.querySelectorAll('[data-askbox]').forEach(ta => ta.addEventListener('input', () => {
      (S.otDraft ??= {})[ta.dataset.askbox] = ta.value;   // a redraw meanwhile (the partners' asks arriving) keeps the words
      ta.removeAttribute('aria-invalid'); const e = document.getElementById(ta.id + '-e'); if (e) e.innerHTML = '';
    }));
    // Arrived for a card (?bill=, ?hearing=): bring it into view once. The frame restores the scroll after a render (Back,
    // a cold arrival), so the page claims the scroll first (app.js S.scrollClaimed), or the card ends screens down.
    const hl = root.querySelector('.ot-card.hl');
    if (hl && S.otSeen !== location.hash) { S.otSeen = location.hash; S.scrollClaimed = true;
      const box = document.querySelector('.ot-card.hl [data-askbox]');
      // The card is found again when the frame comes: a redraw meanwhile (the partners' asks arriving) replaced it.
      requestAnimationFrame(() => { const c = document.querySelector('.ot-card.hl') || hl; c.scrollIntoView({ block: 'start' });
        // R-358: Today's row lands in the open box, the cursor in it, no second click
        const t = box && document.querySelector('.ot-card.hl [data-askbox]'); if (t) t.focus(); else c.focus({ preventScroll: true }); }); }
}

// The switch redraws in place: the address changes (replace, so Back still leaves Outreach) and focus stays on it.
function setAll(on) {
  S.otEvery = false;
  S.go(on ? '#/outreach?all=1' : '#/outreach', { replace: true, keepScroll: true });
  document.querySelector(`[data-seg="otwho"][data-val="${on ? 'all' : 'mine'}"]`)?.focus();
}
// A redraw keeps the scroll, and the cursor where it was when someone is typing an ask (the words are kept in S.otDraft).
const redraw = sel => {
  const y = scrollY, a = document.activeElement, box = a?.dataset?.askbox, at = box ? [a.selectionStart, a.selectionEnd] : null;
  hooks.render(); scrollTo(0, y);
  if (sel) document.querySelector(sel)?.focus({ preventScroll: true });
  else if (box) { const t = document.querySelector(`[data-askbox="${CSS.escape(box)}"]`); if (t) { t.focus({ preventScroll: true }); try { t.setSelectionRange(...at); } catch { /* ignore */ } } }
};

// Save the ask to the bill's own field (the Public tab's "The ask"), shown through the hearing's day, with Undo. A
// teammate's newer ask is never overwritten without a word (DB.saveBillFields, R-152 B).
async function saveAsk(root, billId, el) {
  const b = billById(billId), ta = root.querySelector(`[data-askbox="${CSS.escape(billId)}"]`); if (!b || !ta) return;
  const text = ta.value.trim().replace(/\s+/g, ' '), err = document.getElementById(ta.id + '-e');
  const say = m => { err.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}<span>${esc(m)}</span></p>`; ta.setAttribute('aria-invalid', 'true'); ta.focus(); };
  if (text.length < 10) return say('Write the public ask first: what to do, and by when.');
  const x = weekAskItems().find(i => i.b.id === billId), until = x ? hst(new Date(x.h.scheduled_at).getTime()) : null;
  if (!until) return say('This bill has no hearing this week, so the ask would not show. Write it on the bill’s Public tab.');
  el.setAttribute('aria-busy', 'true'); el.disabled = true;
  try {
    const res = await DB.saveBillFields(b.id, { public_action: text, public_action_until: until }, BASE.get(b.id) || { public_action: b.public_action || null, public_action_until: b.public_action_until || null });
    S.otOpen = null; if (S.otDraft) delete S.otDraft[b.id]; BASE.delete(b.id); markNewStep({ publicask: 1 }); redraw(`#${cardId(b)}`);
    if (res.conflicts.length) { toast('A teammate saved a different ask a moment ago. It shows on the card now; change it if you need to.', { err: true }); return; }
    toast(`Saved. The ask shows on the public page through ${fmtDT(until + 'T12:00:00-10:00').replace(/,.*$/, '')}.`, { ok: true, undo: async () => { await DB.updateBill(b.id, res.prev); redraw(`#${cardId(b)}`); toast('The ask is back as it was.'); } });
  } catch (e) { el.removeAttribute('aria-busy'); el.disabled = false; toast(e, { err: true }); }
}
