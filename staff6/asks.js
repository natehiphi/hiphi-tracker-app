// Outreach > This week's asks (#/outreach; R-269, rebuilt for Staff v6 by R-336 V20). Outreach is for rallying people,
// so it opens on the week's asks: one card per bill with testimony closing in the next 7 days, each with
//   - the ask's own words (the Public tab's "The ask"), or a box to write them early, saved to the same field;
//   - the deadline (when testimony closes) and, while there is no ask, who writes it and by when;
//   - how it is landing: the public's numbers for the bill (follows always; actions only from 10 people, D4);
//   - Copy link · Copy message · Copy post · Email followers in one row (the bill's and the hearing's share kits link here).
// At the top, "Copy all for the newsletter" and "Copy all as posts" say which bills they leave out (X23: the old copy
// quietly dropped a bill, and filled a blank ask with "Please speak up on ..."). Ralliers also see the partners' asks
// going out (F187, read-only), and at the foot "How it's landing" adds the week up (D4, from 10 people).
// v6 draws the cards itself: they used to come from today.js (weekAsksHTML), which TODAY is rebuilding (spec 11).
// The rallier, with no migration (spec 6 and addendum 6): Saya on CTFH, else the coalition's owner, else the bill's owner.
// TODAY may import rallierOf() and askDueAt() to put the ask on the rallier's Today two days before it is due.
import { S, DB, esc, fmtDT, advocate, isMine, hooks, DEMO } from './data.js';
import { sharePageUrl, liveAsk, billRoute, whenAt, hstDayOf, publicResponse, billById, spanOf } from './model.js';
import { icon, btn, empty, toast, sectionNav, whoseSeg } from './ui.js';
import { pageHead } from './lists.js';
import { nameWords, numWords, committeeName } from './steps.js';
import { emailDoor } from './composer.js';
import { weekLanding } from './firstvisit.js';

const HR = 36e5, DAY = 864e5;
const plural = (n, one, many = one + 's') => `${Number(n || 0).toLocaleString()} ${n === 1 ? one : many}`;
const first = id => (advocate(id)?.full_name || '').split(' ')[0] || 'someone';
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
const isRallier = (me = S.me) => !!me && (S.campaigns || []).some(c => leadOf(c) === me.id);
// Who may write a bill's ask here: its rallier, its owner, an admin (the Public tab is open to the same people).
const mayWrite = b => !!S.me && (S.me.is_admin || rallierOf(b).includes(S.me.id) || (S.assignments?.[b.id] || []).includes(S.me.id));

// ---- the week's asks ----
// Bills with a position on the public page whose testimony closes in the next 7 days, soonest first; each bill once, at
// its soonest deadline. `mine`: the bills on the viewer's coalitions, or their own bills when they help on none.
// Closing within 3 hours keeps the card (a post can still help) but leaves the newsletter (`soon`).
const myCoals = () => { const c = S.me?.prefs?.coalitions, ids = (S.campaigns || []).map(x => x.id); return new Set(c === 'all' ? ids : Array.isArray(c) ? c.filter(id => ids.includes(id)) : []); };
export function weekAskItems({ mine = false } = {}) {
  const now = Date.now(), end = now + 7 * DAY, seen = new Map(), co = mine ? myCoals() : null;
  const keep = !mine ? () => true : co.size ? b => (S.billCampaigns?.[b.id] || []).some(id => co.has(id)) : b => isMine(b);
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

// ---- the words that go out (to the public: no codes, the number spaced, the name once; C-15) ----
const ASK_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes',
  strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting' };   // the public page's words (pub/core.js POS_SAYS)
const pubNum = b => String(b.bill_number || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const askName = b => b.nickname ? `${b.nickname} (${pubNum(b)})` : pubNum(b);
const askOf = b => liveAsk(b).replace(/([^.!?])$/, '$1.');
const link = (b, via = '') => `${sharePageUrl(b, 'testify')}${via ? `?via=${via}` : ''}`;
const messageOf = x => { const a = askOf(x.b);
  return `${a ? `${a} ` : `${askName(x.b)}: `}Testimony is due ${fmtDT(x.due)}. It takes a few minutes: ${link(x.b)}`; };
function postOf(x) {
  const due = `Testimony due ${fmtDT(x.due)}.`, url = link(x.b, 'social'), name = askName(x.b);
  let a = askOf(x.b) || 'Your voice counts.'; const room = 280 - (name.length + due.length + url.length + 4);
  if (a.length > room) a = a.slice(0, Math.max(room - 1, 20)).replace(/\s+\S*$/, '') + '…';
  return `${name}: ${a} ${due} ${url}`;
}
// Copy all: only bills with an ask written (a blank one is never filled with stock words, X23), and for the newsletter
// none closing within 3 hours. leftOut() names what each leaves out and why.
function copyAll(items, kind) {
  const use = items.filter(x => askOf(x.b) && (kind === 'social' || !x.soon));
  if (kind === 'social') return { use, text: use.map(postOf).join('\n\n') };
  const head = `This week at the Legislature: ${use.length === 1 ? 'one bill on HIPHI’s issues needs' : `${use.length} bills on HIPHI’s issues need`} your voice. Each takes a few minutes.`;
  return { use, text: head + '\n\n' + use.map(x => `${askName(x.b)} · ${ASK_SAYS[x.b.position] || 'HIPHI’s position'}\n${askOf(x.b)} Testimony is due ${fmtDT(x.due)}.\n${link(x.b, 'newsletter')}`).join('\n\n') };
}
const listNums = xs => { const n = xs.map(x => pubNum(x.b)); return n.length <= 2 ? n.join(' and ') : `${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`; };
function leftOut(items) {
  const blank = items.filter(x => !askOf(x.b)), late = items.filter(x => askOf(x.b) && x.soon), one = blank.length === 1;
  if (!blank.length && !late.length) return `Both cover all ${plural(items.length, 'bill')}.`;
  const parts = [];
  if (blank.length) parts.push(`Both leave out ${listNums(blank)}: no ask written yet. Write ${one ? 'it' : 'them'} on ${one ? 'its card' : 'the cards'} below.`);
  if (late.length) parts.push(`The newsletter also leaves out ${listNums(late)}: testimony closes within 3 hours, too soon for a newsletter.`);
  return parts.join(' ');
}

// ---- how it is landing (D4: the public's counts for a bill; a bill's actions only from 10 people, as the database counts
// them, so the week's sums below add up exactly what the cards show) ----
function landLine(b) {
  const c = publicResponse(b) || {}, acts = (c.people || 0) >= 10;
  const bits = [c.followers ? `${c.followers.toLocaleString()} follow` : 'Nobody follows it yet'];
  if (acts) { if (c.testimonies) bits.push(`${c.testimonies} testified`); if (c.emails) bits.push(`${c.emails} emailed a legislator`); }
  else bits.push('actions show from 10 people');
  return bits.join(' · ');
}
function landingHTML(items) {
  const sum = { followers: 0, emails: 0, testimonies: 0 };
  for (const x of items) { const c = publicResponse(x.b) || {}; sum.followers += c.followers || 0; if ((c.people || 0) >= 10) { sum.emails += c.emails || 0; sum.testimonies += c.testimonies || 0; } }
  const fv = weekLanding();
  const tile = (n, label) => `<div class="ot-tile"><span class="ot-tn">${Number(n).toLocaleString()}</span><span class="ot-tl">${label}</span></div>`;
  const tiles = [tile(sum.followers, 'follow these bills'), sum.testimonies ? tile(sum.testimonies, 'testified on them') : '', sum.emails ? tile(sum.emails, 'emailed a legislator about them') : '',
    fv ? tile(fv.ours, `of ${plural(fv.visits, 'first visit')} this week came from the newsletter or a post`) : ''].filter(Boolean).join('');
  return `<section class="ot-land" aria-labelledby="ot-land-h"><h2 class="ot-h2" id="ot-land-h">How it’s landing</h2>
    <div class="ot-tiles">${tiles}</div>
    <p class="ot-note">Counts only, never names. A bill’s actions show once 10 people have acted.${DEMO ? ' The practice copy shows sample numbers.' : ''} <a href="#/my-issues/all?view=first-visit">First visit numbers</a></p></section>`;
}

// ---- the partners' asks going out (F187, R-328 G): read-only for ralliers; the partner approvers act on the Partners screen ----
const ASK_ON = ['going_out', 'sending'];
function wantPartnerAsks() {
  if (S.pAsks !== undefined || S.pAsksLoading) return;
  S.pAsksLoading = true; S.pAsksErr = false;
  DB.partnerAsks().then(a => { S.pAsks = a || []; }).catch(() => { S.pAsks = null; S.pAsksErr = true; })
    .finally(() => { S.pAsksLoading = false; if (S.route?.name === 'asks') hooks.render(); });
}
function partnersHTML() {
  if (!isRallier()) return '';
  wantPartnerAsks();
  const on = (S.pAsks || []).filter(a => ASK_ON.includes(a.state)); if (!on.length) return '';
  const when = a => a.state === 'going_out' ? `goes out ${String(whenAt(a.scheduled_for)).replace(/ \d.*$/, '')} at 4:30 pm` : 'going out now';
  return `<section class="ot-pasks" aria-labelledby="ot-pasks-h"><h2 class="ot-h2" id="ot-pasks-h">Partners’ asks going out</h2>
    <ul class="ot-plist">${on.slice(0, 5).map(a => { const b = billById(a.bill_id); return `<li><b>${esc(a.partner_name)}</b> on ${b ? `<a href="${esc(billRoute(b))}">${esc(nameWords(b, 48))}</a>` : esc(a.bill_number || 'a bill')}, ${esc(when(a))}</li>`; }).join('')}</ul>
    ${on.length > 5 ? `<p class="ot-note">and ${on.length - 5} more.</p>` : ''}</section>`;
}

// ---- one card ----
const cardId = b => 'ot-ask-' + String(b.bill_number).replace(/\s/g, '');
const BASE = new Map();   // the ask as it was when its box was drawn (DB.saveBillFields compares against it)
function writeBox(x, { changing = false } = {}) {
  const b = x.b, id = cardId(b) + '-w', due = askDueAt(x.h), r = rallierOf(b), mine = r.includes(S.me?.id);
  BASE.set(b.id, { public_action: b.public_action || null, public_action_until: b.public_action_until || null });
  const by = `${due > Date.now() ? 'Due' : 'It was due'} ${whenAt(due)}${mine || !r.length ? '' : `, ${first(r[0])}’s to write`}.`;
  return `<div class="ot-write"><label for="${id}">${changing ? 'Change the ask' : 'Write the ask'}</label>
    <p class="ot-help" id="${id}-h">One sentence: what to do, and by when. ${esc(by)} It shows on the public page and in the hearing alert.</p>
    <textarea id="${id}" rows="2" maxlength="280" aria-describedby="${id}-h ${id}-e" data-askbox="${esc(b.id)}" placeholder="Send testimony by ${esc(fmtDT(x.due))}: two sentences in your own words are enough.">${changing ? esc(b.public_action || '') : ''}</textarea>
    <div id="${id}-e" role="alert"></div>
    <div class="ot-wacts">${btn('Save the ask', { kind: 'secondary', icon: 'check', attrs: { 'data-asksave': b.id } })}${changing ? btn('Cancel', { kind: 'text', attrs: { 'data-askcancel': b.id } }) : ''}</div></div>`;
}
function askPart(x) {
  const b = x.b, a = liveAsk(b);
  if (S.otChanging === b.id && mayWrite(b)) return writeBox(x, { changing: true });
  if (a) return `<blockquote class="ot-words"><p>${esc(a)}</p>${mayWrite(b) ? btn('Change', { kind: 'text', sm: true, attrs: { 'data-askchange': b.id, 'aria-label': `Change the ask for ${nameWords(b, 60)}` } }) : ''}</blockquote>`;
  if (mayWrite(b)) return writeBox(x);
  const r = rallierOf(b), due = askDueAt(x.h);
  return `<p class="ot-noask">${icon('pencil')}<span>No ask yet. ${r.length ? `${esc(first(r[0]))} writes it` : 'Its owner writes it'} by ${esc(whenAt(due))}.</span></p>`;
}
function cardHTML(x, hl) {
  const b = x.b, id = cardId(b), h = x.h;
  const closes = x.soon ? `Testimony closes ${whenAt(x.due)}, in ${spanOf(x.due)}` : `Testimony closes ${whenAt(x.due)}`;
  const copyB = (label, act, ic) => btn(label, { kind: 'secondary', sm: true, icon: ic, attrs: { 'data-askcopy': act, 'data-bill': b.id } });
  return `<section class="ot-card${hl ? ' hl' : ''}" id="${id}" aria-labelledby="${id}-h" tabindex="-1">
    <div class="ot-ctop"><h2 class="ot-name" id="${id}-h"><a href="${esc(billRoute(b, 'public'))}">${esc(nameWords(b, 80))}</a></h2><span class="ot-num">${esc(numWords(b))}</span></div>
    <p class="ot-when">${icon('clock')}<span><b>${esc(closes)}</b> · ${esc(ASK_SAYS[b.position] || 'HIPHI has a position')} · ${esc(committeeName(h.committee))}</span></p>
    ${askPart(x)}
    <p class="ot-landl">${icon('users')}<span>${esc(landLine(b))}</span></p>
    <div class="ot-acts" role="group" aria-label="Share ${esc(nameWords(b, 60))}">${copyB('Copy link', 'link', 'link')}${copyB('Copy message', 'message', 'copy')}${copyB('Copy post', 'post', 'message-square')}${emailDoor({ bill: b }, { sm: true })}</div>
  </section>`;
}

// B-3: an empty week says why and offers the way on. Nothing on the viewer's coalitions: the switch's job, as a button.
function emptyHTML(all, n) {
  if (!all && n) return `<div class="ot-empty">${empty({ title: 'No asks this week on your coalitions’ bills', text: `The team has ${plural(n, 'ask')} this week.`, action: btn('Show the team’s asks', { kind: 'secondary', attrs: { 'data-otall': '1' } }) })}</div>`;
  const next = (S.hearings || []).filter(h => h.status !== 'cancelled' && testDue(h) > Date.now() + 7 * DAY).map(h => ({ h, b: billById(h.bill_id) }))
    .filter(x => x.b && x.b.position && x.b.position !== 'monitor' && x.b.is_public).sort((p, q) => testDue(p.h) - testDue(q.h))[0];
  return `<div class="ot-empty">${empty({ title: 'No asks this week', text: `No bill on the public page with a position has testimony closing in the next 7 days, so there is nothing to send yet.${next ? ` The next: ${esc(nameWords(next.b, 60))}, testimony closes ${esc(whenAt(testDue(next.h)))}.` : ''} Meanwhile, the partner update and supporters are a tab away.`,
    action: btn('Write a partner update', { kind: 'secondary', href: '#/outreach/partners' }) })}</div>`;
}

const everyOn = route => route?.q?.all === '1';
// ?bill=HB2121 (a bill's Public tab, Today) or ?hearing=<id> (the hearing page): those cards, highlighted, in view.
function wanted(route) {
  const q = route?.q || {}, key = s => String(s || '').toUpperCase().replace(/\s/g, '');
  if (q.bill) return new Set(S.bills.filter(b => key(b.bill_number) === key(q.bill) || b.id === q.bill).map(b => b.id));
  if (q.hearing) { const h = (S.hearings || []).find(x => String(x.id) === String(q.hearing)); if (!h) return new Set();
    return new Set((S.hearings || []).filter(x => x.scheduled_at === h.scheduled_at && x.committee === h.committee).map(x => x.bill_id)); }
  return null;
}
// A link to a card that is not on the viewer's coalitions opens the team's list, where it is.
const showAll = (route, want) => everyOn(route) || (!!want && want.size > 0 && !weekAskItems({ mine: true }).some(x => want.has(x.b.id)));

export default {
  tab: 'outreach',
  title: () => 'This week’s asks',
  // Wide like Emails and Supporters, so Outreach's tab row stays in one place from tab to tab; the cards keep a reading
  // width (supporters.css .ot-page).
  wide: () => true,
  render(route) {
    const want = wanted(route), team = weekAskItems(), all = showAll(route, want);
    const items = all ? team : weekAskItems({ mine: true });
    const sw = whoseSeg('otwho', myCoals().size ? { coal: 'mine', team: 'all' } : { mine: 'mine', team: 'all' }, all ? 'all' : 'mine', { label: 'Whose asks' });
    const head = pageHead(sectionNav('outreach', 'asks'), 'Outreach', '', sw);
    if (!items.length) return `<div class="le-page ot-page">${head}${emptyHTML(all, team.length)}${partnersHTML()}</div>`;
    const nl = copyAll(items, 'newsletter').use.length, po = copyAll(items, 'social').use.length;
    // With nothing to copy (no ask written yet), the two buttons wait and the line says why (no dead buttons, B-3).
    const bar = `<div class="ot-copyall" role="group" aria-label="Copy every ask">
      ${nl + po ? `<div class="ot-cabtns">${btn('Copy all for the newsletter', { kind: 'secondary', icon: 'copy', attrs: { 'data-askall': 'newsletter', ...(nl ? {} : { disabled: true }) } })}${btn('Copy all as posts', { kind: 'secondary', icon: 'copy', attrs: { 'data-askall': 'social', ...(po ? {} : { disabled: true }) } })}</div>` : ''}
      <p class="ot-left">${nl + po ? esc(leftOut(items)) : `${icon('copy')}<span>Copy all for the newsletter or as posts appears here once a bill below has its ask written.</span>`}</p></div>`;
    return `<div class="le-page ot-page">${head}${bar}
      <div class="ot-cards">${items.map(x => cardHTML(x, !!want && want.has(x.b.id))).join('')}</div>
      ${partnersHTML()}${landingHTML(items)}</div>`;
  },
  wire(route, root) {
    const items = () => showAll(S.route, wanted(S.route)) ? weekAskItems() : weekAskItems({ mine: true });
    root.querySelectorAll('[data-seg="otwho"]').forEach(b => b.onclick = () => setAll(b.dataset.val === 'all'));
    root.querySelector('[data-otall]')?.addEventListener('click', () => setAll(true));
    const copy = async (text, ok) => { try { await navigator.clipboard.writeText(text); toast(ok, { ok: true }); } catch { toast('Could not copy. Select the words on the card and copy them yourself.', { err: true }); } };
    root.querySelectorAll('[data-askall]').forEach(el => el.onclick = () => {
      const list = items(), { use, text } = copyAll(list, el.dataset.askall);
      if (!use.length) return;
      const skip = list.length - use.length, left = skip ? `, ${skip} left out as the line under the buttons says` : '';
      copy(text, el.dataset.askall === 'social' ? `Copied ${plural(use.length, 'post')}, each under a post’s length${left}. Paste, and change anything you like.` : `Copied ${plural(use.length, 'ask')} for the newsletter${left}. Paste, and change anything you like.`);
    });
    root.querySelectorAll('[data-askcopy]').forEach(el => el.onclick = () => {
      const x = weekAskItems().find(i => i.b.id === el.dataset.bill); if (!x) return;
      const k = el.dataset.askcopy;
      if (k === 'link') copy(link(x.b), 'Link copied: the bill’s page for testifying.');
      else if (k === 'message') copy(messageOf(x), 'Message copied: the ask, the deadline and the link.');
      else copy(postOf(x), 'Post copied, under a post’s length.');
    });
    root.querySelectorAll('[data-askchange]').forEach(el => el.onclick = () => { S.otChanging = el.dataset.askchange; redraw(`[data-askbox="${el.dataset.askchange}"]`); });
    root.querySelectorAll('[data-askcancel]').forEach(el => el.onclick = () => { S.otChanging = null; redraw(`[data-askchange="${el.dataset.askcancel}"]`); });
    root.querySelectorAll('[data-asksave]').forEach(el => el.onclick = () => saveAsk(root, el.dataset.asksave, el));
    root.querySelectorAll('[data-askbox]').forEach(ta => ta.addEventListener('input', () => { ta.removeAttribute('aria-invalid'); const e = document.getElementById(ta.id + '-e'); if (e) e.innerHTML = ''; }));
    // Arrived for a card (?bill=, ?hearing=): bring it into view once.
    const hl = root.querySelector('.ot-card.hl');
    if (hl && S.otSeen !== location.hash) { S.otSeen = location.hash; requestAnimationFrame(() => { hl.scrollIntoView({ block: 'start' }); hl.focus({ preventScroll: true }); }); }
  },
};

// The switch redraws in place: the address changes (replace, so Back still leaves Outreach) and focus stays on it.
function setAll(on) {
  S.go(on ? '#/outreach?all=1' : '#/outreach', { replace: true, keepScroll: true });
  document.querySelector(`[data-seg="otwho"][data-val="${on ? 'all' : 'mine'}"]`)?.focus();
}
const redraw = sel => { const y = scrollY; hooks.render(); scrollTo(0, y); if (sel) document.querySelector(sel)?.focus({ preventScroll: true }); };

// Save the ask to the bill's own field (the Public tab's "The ask"), shown through the hearing's day, with Undo. A
// teammate's newer ask is never overwritten without a word (DB.saveBillFields, R-152 B).
async function saveAsk(root, billId, el) {
  const b = billById(billId), ta = root.querySelector(`[data-askbox="${CSS.escape(billId)}"]`); if (!b || !ta) return;
  const text = ta.value.trim().replace(/\s+/g, ' '), err = document.getElementById(ta.id + '-e');
  const say = m => { err.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}<span>${esc(m)}</span></p>`; ta.setAttribute('aria-invalid', 'true'); ta.focus(); };
  if (text.length < 10) return say('Write the ask first: one sentence, what to do and by when.');
  const x = weekAskItems().find(i => i.b.id === billId), until = x ? hst(new Date(x.h.scheduled_at).getTime()) : null;
  if (!until) return say('This bill has no hearing this week, so the ask would not show. Write it on the bill’s Public tab.');
  el.setAttribute('aria-busy', 'true'); el.disabled = true;
  try {
    const res = await DB.saveBillFields(b.id, { public_action: text, public_action_until: until }, BASE.get(b.id) || { public_action: b.public_action || null, public_action_until: b.public_action_until || null });
    S.otChanging = null; redraw(`#${cardId(b)}`);
    if (res.conflicts.length) { toast('A teammate saved a different ask a moment ago. It shows on the card now; change it if you need to.', { err: true }); return; }
    toast(`Saved. The ask shows on the public page through ${fmtDT(until + 'T12:00:00-10:00').replace(/,.*$/, '')}.`, { ok: true, undo: async () => { await DB.updateBill(b.id, res.prev); redraw(`#${cardId(b)}`); toast('The ask is back as it was.'); } });
  } catch (e) { el.removeAttribute('aria-busy'); el.disabled = false; toast(e, { err: true }); }
}
