// Home (redesign 9/19, reworked the same day after Nate read the assessment). Home has one shape per moment:
//  - the first visit, right after the guided start: calm. "You're all set", what you follow, where you stand, the
//    milestones just earned and what happens next. Nothing is pushed: the things to do wait behind one quiet line
//    (Nate, 9/19: a first visit is "follow a few bills and maybe say where you stand"; asks to act come later);
//  - later visits in session, following bills: what you can do this week, easiest first (actionCard has the ladder),
//    then a lighter "ask the chair for a hearing" for bills that are running out of time, then your own session;
//  - in session, following nothing (the person skipped the guided start): "This week at the Capitol", issues, lists;
//  - between sessions (the Legislature meets January to early May; the rest of the year it is on break): the recap,
//    or a welcome for someone with no history yet.
// Progress here is about the person (their follows, stances, actions, weeks and milestones). Community-wide totals
// are gone (Nate, 9/19); numbers about other people appear only inside one bill or one hearing.
// On wide screens Home is two columns (wide.css .cols): things to do on the left, your session, what's new and the
// suggestion on the right. The full bill list lives in My bills.
import { S, DEMO, HST, esc, icon, nick, headline, blurb, spaced, billPath, alive, issues, issueOf, openActions, waitingBills, askedChair, nextWords, issuesLink, companionsOf,
  actedOn, settledOn, didKind, agrees, doneKey, KINDS, dismissed, suggestionList, reasonOf, noteShown, wiz, groupNames, sessionInfo, myActions, MILESTONES,
  nudge, CONSENT_KEY, textSaved, countOk, anyBill, anyHearing, outcomeOf, plainStatus, whyStopped, cmteLabel, codesOf, CHAMBER_NAME,
  issueIcon, chairContacts, dueInfo, hearingText, dayWord, timeWord, dateLong, hstDay, hiT, pickedTopic, followSummary, followedIssues,
  issueFollowed, issueBills, catOf, setFollows, app, toast, roomLabel, viaIssue, followsAnything, ensureRecapPool, winsIn, EARLIER_WINS, supa, HELD_RE,
  results, RESULT_MILESTONES, isResolution, sideOf, streamOf, wizSet } from './core.js';
import { burst, celebrate, petals } from './fx.js';
import { alertStatus } from './alerts.js';   // the one status rule for alerts (D1-4)
import { btn, chip, posChip, row, empty, skeleton } from './ui.js';
import { actionCard, wireActions, nudgeCard, wireNudge, goingPlans, goingCard } from './actions.js';
import { shareLine, wireShareLine, keepLine, wireKeepLine } from './keep.js';
import { CAPITOL, islands, flower } from './art.js';
// More's account cards (the follow-ups after a sign-in) load with More itself, on first use: only a signed-in person
// sees them, and Home must not carry More, People and the address picker for everyone (R-122).
let more = null; const moreLoad = () => import('./more.js').then(m => { more = m; app.render(); });
import { endHome, armOf, abSeen } from './variant.js';
import { logVisit, logAct } from './visitlog.js';
import { laterCard, wireLater } from './onb-later.js';

S.hmOpen ??= {};   // which in-place lists are open ("Show 12 more", "See all"); kept for the visit so Back returns to the same page

const n = x => Number(x || 0).toLocaleString('en-US');
const plural = (k, one, many = one + 's') => `${n(k)} ${k === 1 ? one : many}`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const list = parts => parts.filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');
// "Senate Education": the chamber and the committee's own name, for short sentences. Joint committees are joined
// with "and" (one hearing held by both, so both decide).
function who(code) {
  const c = S.committees[codesOf(code)[0]];
  return c ? `${CHAMBER_NAME[c.chamber] || ''} ${cmteLabel(code, { short: true })}`.trim() : 'The committee';
}
// Saved by the legislators screen ("Remember on this device"): { senate, house, label }.
const districts = () => { try { return JSON.parse(localStorage.getItem('hiphi_districts') || 'null') || {}; } catch { return {}; } };
const districtsKnown = () => !!(districts().senate || (S.profile || {}).senate_district);
// The person's island, when their districts are known, so the islands drawing can pick it out in brand blue.
// Senate districts 1-4 are Hawaiʻi Island, 5-7 Maui County, 8 Kauaʻi and Niʻihau, 9-25 Oʻahu. Senate 7 with House 13
// takes in Molokaʻi, Lānaʻi and East Maui, so nothing is picked out there rather than the wrong island.
function myIsland() {
  const d = districts(), p = S.profile || {}, sd = +(d.senate || p.senate_district || 0), hd = +(d.house || p.house_district || 0);
  return !sd ? '' : sd <= 4 ? 'hawaii' : sd <= 6 ? 'maui' : sd === 7 ? (hd === 13 ? '' : 'maui') : sd === 8 ? 'kauai' : sd <= 25 ? 'oahu' : '';
}
// The guided start sets this when someone finishes it. sessionStorage, so it lasts for this visit only.
const welcomed = () => { try { return sessionStorage.getItem('hiphi_welcome') === '1'; } catch { return false; } };
// An email was already given (the guided start's alerts step, or the sign-in page) and is waiting for its link to be
// opened, or a number was given for text alerts (R-146). Home does not ask again.
const emailGiven = () => { try { return !!(sessionStorage.getItem('hiphi_link_sent') || localStorage.getItem(CONSENT_KEY)); } catch { return false; } };
const alertsGiven = () => emailGiven() || !!textSaved();
const accountCards = () => { try { if (!S.user) return ''; if (!more) { moreLoad().catch(e => console.error(e)); return ''; } return more.accountCardsHTML ? more.accountCardsHTML() || '' : ''; } catch (e) { console.error(e); return ''; } };

// ---------------- what you did, and what it led to (the result is the reward) ----------------
// Grouped by bill, newest first. The bill's final state is checked before any committee vote, so a bill that later
// stopped never shows a green "passed".
function impacts(acts) {
  const by = new Map();
  for (const a of acts) {
    const x = by.get(a.bill_id) || { id: a.bill_id, kinds: new Set(), hs: new Set(), attend: [], at: '' };
    x.kinds.add(a.kind); if (a.hearing_id) x.hs.add(a.hearing_id); if (a.kind === 'attend') x.attend.push(a.hearing_id);
    if ((a.at || '') > x.at) x.at = a.at || '';
    by.set(a.bill_id, x);
  }
  const now = Date.now(), heard = new Map(results().filter(r => r.kind === 'heard').map(r => [r.b.id, r]));
  return [...by.values()].sort((p, q) => q.at.localeCompare(p.at)).map(x => {
    const b = anyBill(x.id); if (!b) return null;
    const hs = [...x.hs].map(anyHearing).filter(Boolean).sort((p, q) => q.scheduled_at.localeCompare(p.scheduled_at));
    // "I plan to go" reads "You planned to go" until the hearing starts, "You went" after (plan 2.12).
    const went = x.attend.some(id => { const h = anyHearing(id); return h && new Date(h.scheduled_at) <= now; });
    const v = [];
    if (x.kinds.has('testimony')) v.push('testified');
    if (x.kinds.has('email')) v.push('emailed the chair');
    if (x.kinds.has('attend')) v.push(went ? 'went to the hearing' : 'planned to go');
    if (x.kinds.has('share')) v.push('shared it');
    let [tone, text, moved] = resultOf(b, hs, x.kinds.has('testimony'));
    // They asked for a hearing and it got one (R-046): said as the good news it is, not as a bill still waiting (the
    // review 9/30 found these as hourglass rows at the bottom of the session page).
    const hd = heard.get(b.id);
    if (hd && tone === 'wait' && !hs.length) { const h = hd.h, ahead = new Date(h.scheduled_at) > now;
      tone = 'up'; moved = false; text = `It got a hearing${ahead ? `: ${who(h.committee)} hears it ${dayWord(h.scheduled_at)} at ${timeWord(h.scheduled_at)}` : ` on ${dateLong(h.scheduled_at)}`}.`; }
    return { b, tone, did: `You ${list(v)}.`, text, moved };
  }).filter(Boolean);
}
// The marks follow the person's side (sideOf): for someone against a bill, its moving on is not their win and its
// stopping is (the review 9/30); the words stay the same plain facts, without a thank-you for a law they opposed.
const forSide = (b, r) => {
  if (sideOf(b) !== 'against') return r;
  const [tone, text] = r, flip = { law: 'on', up: 'on', stop: 'up' };   // 'on': it moved on, against their side (an arrow, as in the strip)
  return [flip[tone] || tone, text.replace(' Mahalo for speaking up.', ''), false];
};
function resultOf(b, hs, testified) { return forSide(b, resultFacts(b, hs, testified)); }
function resultFacts(b, hs, testified) {
  const kept = testified ? ' Your testimony stays on the record.' : '';
  if (b.stage === 'enacted') return ['law', 'It became law. Mahalo for speaking up.'];
  if (b.stage === 'vetoed') return ['stop', `The Governor vetoed it.${kept}`];
  if (b.stage === 'governor') return ['up', 'It passed the House and Senate and is on the Governor’s desk.', true];
  if (b.stage === 'ballot') return ['up', 'It passed the House and Senate. The voters decide in November.', true];
  const now = Date.now(), h = hs.find(x => new Date(x.scheduled_at) <= now) || hs[0], o = h && new Date(h.scheduled_at) <= now ? outcomeOf(h) : null;
  const passed = o && /passed/.test(o.outcome || '');
  if (!alive(b)) {
    const held = HELD_RE.test(b.last_action || '') && !/failed to pass/i.test(b.last_action || '');
    if (passed) return ['stop', `Passed ${cmteLabel(h.committee, { short: true })}, then ${held ? 'a later committee put it on hold' : 'stopped at the deadline'}.${kept}`, true];
    if (o?.outcome === 'deferred') return ['stop', `${who(h.committee)} put it on hold, which usually stops a bill for the year.${kept}`];
    // The hearing you acted on happened, so "it never got a hearing" would be wrong; say only that it stopped.
    if (h && new Date(h.scheduled_at) <= now) return ['stop', `It stopped for this session.${kept}`];
    return ['stop', `${whyStopped(b)}${kept}`];
  }
  if (passed) return ['up', `${who(h.committee)} passed it${o.outcome === 'passed_amended' ? ' with changes' : ''}.`, true];
  if (o?.outcome === 'deferred') return ['stop', `${who(h.committee)} put it on hold.${kept}`];
  if (o?.outcome === 'recommitted') return ['wait', `${who(h.committee)} sent it back for more work.`];
  const next = hs.find(x => new Date(x.scheduled_at) > now);
  if (next && next === hs[0]) return ['wait', `${who(next.committee)} hears it ${dayWord(next.scheduled_at)} at ${timeWord(next.scheduled_at)}.`];
  if (h) return ['wait', `${who(h.committee)} heard it ${dateLong(h.scheduled_at)}. Waiting for the decision.`];
  return ['wait', plainStatus(b).text];
}
// Bills the person followed without acting on them, for the recap: a follower whose bills became law should hear
// about it (the win is the reward, even without an action; assessment 9/19).
// Only bills the person followed on their own: a bill that came with an issue followed after the session ended was
// never "followed in 2026", and saying so to someone who arrived today is untrue (R-018). Their issues are listed
// under "Your issues" instead, with what became of each.
// R-067: a win on an issue they follow is theirs to hear about too, however they came to follow it ("On Free school
// meals for every student." is true either way). Only wins: a stopped bill they never chose one by one is not listed.
function followedRows(yr, skip) {
  const win = b => (b.stage === 'enacted' || b.stage === 'governor') && sideOf(b) !== 'against';   // a bill HIPHI opposes becoming law is no win on its issue
  return S.bills.filter(b => !skip.has(b.id) && (S.direct.has(b.id) || (S.viaIssues.has(b.id) && win(b))) && (!b.session_year || b.session_year === yr)).map(b => {
    const via = !S.direct.has(b.id) && viaIssue(b.id), did = via ? `On ${via.name}.` : 'You followed it.';
    const [tone, text] = forSide(b, b.stage === 'enacted' ? ['law', 'It became law.'] : b.stage === 'governor' ? ['up', 'It passed the House and Senate and is on the Governor’s desk.']
      : b.stage === 'vetoed' ? ['stop', 'The Governor vetoed it.'] : alive(b) ? ['wait', plainStatus(b).text] : ['stop', whyStopped(b)]);
    return { b, tone, did, text };
  });
}
const MARKS = { up: 'circle-check', wait: 'hourglass', stop: 'archive', on: 'arrow-right' };
// A result row opens the bill. It leads with the bill's everyday name when staff have written one; the number
// always shows.
const impRow = x => `<a class="hm-imp" href="${billPath(x.b)}"><span class="hm-mark t-${x.tone}">${x.tone === 'law' ? flower(22) : icon(MARKS[x.tone])}</span>
  <span class="hm-impb"><span class="hm-impt">${esc(nick(x.b) || blurb(x.b, 200))}</span><span class="hm-impr"><b>${esc(spaced(x.b.bill_number))}</b> · ${esc(x.did)} ${esc(x.text)}</span>${x.tone === 'up' || x.tone === 'wait' ? (n => n ? `<span class="hm-impnext">${esc(n)}</span>` : '')(nextWords(x.b)) : ''}</span>${icon('chevron-right', { cls: 'hm-chev' })}</a>`;   // "What's next" (R-126)
// A text button that opens a list in place. The box is only shown or hidden (no redraw), so keyboard focus stays on
// the button; the button sits above the box so it does not move when the box opens. data-hm-toggle is its first
// data attribute: app.js uses that to give focus back after a redraw.
function toggle(id, box, more, less = 'Show fewer') {
  const on = !!S.hmOpen[id];
  return btn(on ? less : more, { kind: 'text', iconEnd: on ? 'chevron-up' : 'chevron-down', cls: 'hm-toggle',
    attrs: { 'data-hm-toggle': id, 'aria-expanded': on ? 'true' : 'false', 'aria-controls': box, 'data-more': more, 'data-less': less } });
}
// The first few rows, then "See all (n)" opens the rest in place.
function impList(rows, first) {
  if (!rows.length) return '';
  const rest = rows.slice(first);
  return `<div class="hm-imps">${rows.slice(0, first).map(impRow).join('')}
    ${rest.length ? `${toggle('imps', 'hm-imprest', `See all (${rows.length})`)}<div id="hm-imprest" class="hm-imprest"${S.hmOpen.imps ? '' : ' hidden'}>${rest.map(impRow).join('')}</div>` : ''}</div>`;
}

// ---------------- milestones ----------------
// They mark real acts and never expire. "I plan to go" counts as an action straight away, but "Showed up" waits
// until the hearing has started (Nate, 9/18). The next one to aim for: a countable one the person is already part
// way through ("Three hearings: 1 of 3") beats the next one in the list, because a bar that is filling up says more
// than a name. "Made it law" is never offered as a goal: nobody can earn it by trying harder.
function milestoneState(acts) {
  const now = Date.now();
  const held = acts.filter(a => a.kind !== 'attend' || (h => h && new Date(h.scheduled_at) <= now)(anyHearing(a.hearing_id)));
  const has = m => m[3](m[0] === 'attend' ? held : acts);
  const COUNT = { three: [new Set(acts.filter(x => x.hearing_id).map(x => x.hearing_id)).size, 3], ten: [acts.length, 10] };
  const todo = MILESTONES.filter(m => !RESULT_MILESTONES.has(m[0]) && !has(m));
  const next = todo.find(m => COUNT[m[0]] && COUNT[m[0]][0] / COUNT[m[0]][1] >= 0.3) || todo[0] || null;
  return { got: MILESTONES.filter(has), next, count: next ? COUNT[next[0]] || null : null };
}
const chipsHtml = got => got.length ? `<ul class="chips hm-chips" aria-label="Milestones you have reached">${got.map(([, t, d]) => `<li class="chip yay" title="${esc(cap(d))}">${flower(16)}${esc(t)}</li>`).join('')}</ul>` : '';

// One dot per week of the session, filled when you acted that week. Empty weeks simply stay empty: hearings come
// in bursts and nobody owes the Legislature a streak. Weeks run Monday to Sunday, Hawaiʻi time.
// Fix (walkthrough 9/18): the old dots compared against Monday noon, so an action on Monday morning left the
// current week "ahead" and grey. A week is ahead only when it is not the current week and starts after now.
function weeks(si, mine) {
  const monday = t => { const d = hstDay(t), dow = new Date(d + 'T12:00:00-10:00').getUTCDay(); return hiT(d) - ((dow + 6) % 7) * 864e5; };
  const now = Date.now(), H12 = 12 * 36e5, W = 7 * 864e5, dots = [];
  let k = 0;
  // From the week of their first action, not the session's first week: someone who joined in March saw nine empty
  // dots, which read as "missed" (R-067).
  const first = mine.map(a => a.at).filter(Boolean).sort()[0], start = Math.max(monday(hiT(si.open)), first ? monday(+new Date(first)) : 0);
  for (let w = start; w <= hiT(si.end); w += W) {
    const from = w - H12, to = w + W - H12;   // Monday 00:00 to the next Monday 00:00 in Honolulu
    const acted = mine.some(a => a.at && +new Date(a.at) >= from && +new Date(a.at) < to), cur = now >= from && now < to, ahead = !cur && from > now;
    if (acted) k++;
    dots.push(`<i class="${[ahead && 'ahead', cur && 'now', acted && 'on'].filter(Boolean).join(' ')}"></i>`);
  }
  return `<div class="hm-weekbox"><div class="hm-weeks" role="img" aria-label="You took action in ${plural(k, 'week')} of the session so far">${dots.join('')}</div>
    <p class="meta">Each dot is a week. Filled means you took action.</p></div>`;
}

// ---------------- Your session: the person's own progress ----------------
// Counts of what they have done (zeros are left out: nobody needs "0 actions" read back to them), the weeks, the
// milestones earned, how far the next one is, and what happened after they acted. On the first visit the chips sit
// in the page heading instead (they were just earned), and no action milestone is dangled as "next".
// skip: bills already in the "Since you were here" strip above, so a result is not said twice on one Home (A-14).
function sessionPanel(si, { welcome = false, skip = new Set() } = {}) {
  const all = myActions(), mine = all.filter(a => !a.year || a.year === si.yr);
  const thisYear = b => !b || !b.session_year || b.session_year === si.yr;
  // Issues first (R-018): what the person follows is issues; a follower of single bills only still sees their bills.
  const nIss = followedIssues().length, follows = nIss || S.bills.filter(thisYear).length;
  const stands = Object.entries(S.stances || {}).filter(([id, v]) => (v === 'support' || v === 'oppose') && thisYear(anyBill(id))).length;
  const ms = milestoneState(all), rows = impacts(mine).filter(x => !skip.has(x.b.id));
  const stat = (k, label, href) => !k ? '' : href ? `<li><a class="hm-stat" href="${href}" data-hm-stat="bills"><b>${n(k)}</b><span>${label}${icon('chevron-right')}</span></a></li>` : `<li><span class="hm-stat"><b>${n(k)}</b><span>${label}</span></span></li>`;
  return `<section class="card hm-panel" aria-labelledby="hm-ys"><h2 id="hm-ys" class="hm-ptitle">${flower(24)}<span>Your ${si.yr} session</span></h2>
    <ul class="hm-stats">${stat(follows, nIss ? (follows === 1 ? 'issue followed' : 'issues followed') : (follows === 1 ? 'bill followed' : 'bills followed'), '#/bills')}${stat(stands, stands === 1 ? 'stand taken' : 'stands taken')}${stat(mine.length, mine.length === 1 ? 'action' : 'actions')}</ul>
    ${mine.length ? weeks(si, mine) : `<p class="muted small">${welcome ? 'Your progress adds up here through the session.' : 'Your first action will show up here, with what happened after it.'}</p>`}
    ${welcome ? '' : chipsHtml(ms.got)}${''/* no "Next:" goal since 9/27: a quiet record, not a badge ladder (C-7; R-067 decision 8b) */}
    ${!welcome && S.nudge === 'action' ? nudgeCard('action') : ''}
    ${rows.length ? `<h3 class="hm-label">What happened after you acted</h3>${impList(rows.slice(0, 2), 2)}` : ''}${''/* the rest are on the session page, below */}
    ${DEMO && S.demoSeeded ? '<p class="meta">Sandbox: three sample actions are filled in so this panel has something to show.</p>' : ''}
    ${!welcome && (mine.length || follows) ? btn('See your whole session', { kind: 'text', iconEnd: 'chevron-right', href: '#/recap', cls: 'hm-link' }) : ''}
  </section>`;
}

// ---------------- what's new on my bills (last 7 days) ----------------
// Only facts a newcomer can read at a glance: a hearing was set, or a committee decided. Bills already shown in a
// card are left out, so a bill appears on Home at most twice. A row leads with the bill's everyday name when it has
// one (the fact, with the number, goes under it); without one the fact leads and the plain summary goes under it.
function whatsNew(skip) {
  const now = Date.now(), since = now - 7 * 864e5, per = new Map();
  const add = (b, at, lead, text) => { const t = at ? +new Date(at) : NaN; if (!(t >= since && t <= now)) return; const x = per.get(b.id); if (!x || x.t < t) per.set(b.id, { b, t, at, lead, text }); };
  for (const h of S.hearings) {
    const b = S.bills.find(x => x.id === h.bill_id); if (!b || skip.has(b.id)) continue;
    const num = spaced(b.bill_number), held = new Date(h.scheduled_at) <= now, o = held ? outcomeOf(h) : null;
    if (o?.outcome) {
      const said = { passed: `passed ${num}`, passed_amended: `passed ${num} with changes`, deferred: `put ${num} on hold`, recommitted: `sent ${num} back for more work` }[o.outcome];
      if (said) add(b, o.reported_at || h.scheduled_at, /passed/.test(o.outcome) ? 'circle-check' : 'archive', `${who(h.committee)} ${said}`);
    }
    // A new hearing reads "HB 1975 has a hearing on Thu": the committee's full name (often two joined) is on the bill
    // page. Never for a bill that has stopped (a hearing left on the calendar for a dead bill is not news).
    if (!held && h.status === 'scheduled' && h.notice_posted_at && alive(b)) { const d = dayWord(h.scheduled_at);
      add(b, h.notice_posted_at, 'calendar', `${num} has a hearing ${/^(today|tomorrow)/.test(d) ? d : 'on ' + d}`); }
  }
  const items = [...per.values()].sort((p, q) => q.t - p.t).slice(0, 3);
  if (!items.length) return '';
  const day = at => hstDay(at) === hstDay(now) ? 'Today' : new Date(at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
  return `<section class="hm-sec" aria-labelledby="hm-new"><h2 id="hm-new">What’s new</h2>
    <div class="rows">${items.map(x => row({ lead: x.lead, title: esc(nick(x.b) || x.text), sub: esc(nick(x.b) ? x.text : blurb(x.b, 160)), end: `<span class="hm-day">${day(x.at)}</span>`, href: billPath(x.b) })).join('')}</div>
    ${btn('See all my bills', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link' })}</section>`;
}

// ---------------- since you were here (R-067: Nate's first goal is that people come back) ----------------
// The first thing on Home when someone comes back: what happened on their issues since their last visit (S.prevVisit,
// kept by app.js before it notes this one), greeted by name. A committee's decision on a hearing they acted on leads,
// and the first time they see it, it gets the small burst the address uses (C-7: a result, in proportion). With
// nothing new it says what comes next. Rows open the bill. At most three, one per bill; up to 30 days back.
const RSEEN_KEY = 'hiphi_results_seen';
const resultsSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(RSEEN_KEY) || '[]')); } catch { return new Set(); } };
const myName = () => { try { return (wiz().name || JSON.parse(localStorage.getItem('hiphi_me') || '{}').name || '').trim().split(/\s+/)[0]; } catch { return ''; } };
// Moments (R-046, Nate 9/30: "You helped a bill get a hearing. You helped a bill pass a hearing."): a result on a bill the
// person spoke up for, shown on Home once, the first time Home sees it (a month back at most), whatever their last
// visit was. Sized to what happened (C-7): a hearing set or a committee's yes is a row with the small burst; a law is
// the full-screen moment. Seen ones stay for the rest of the visit, so no row vanishes under a finger, and then live in
// "What happened after you acted" and on the session page (#/recap). Counted privately, kind only ('moment', 106).
const MSEEN_KEY = 'hiphi_moments_seen';
const momentsSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(MSEEN_KEY) || '[]')); } catch { return new Set(); } };
S.hmShown ??= new Set();
const MOMENT_ICON = { heard: 'calendar-check', passed: 'circle-check', held: 'circle-check', law: 'party-popper' };
function momentText(r) {
  const h = r.h, ahead = h && new Date(h.scheduled_at) > Date.now();
  if (r.kind === 'heard') return `${r.did === 'You asked for a hearing' ? 'You asked for a hearing, and it got one' : 'You wrote to your legislators about it, and it got a hearing'}${ahead ? `: ${who(h.committee)} hears it ${dayWord(h.scheduled_at)} at ${timeWord(h.scheduled_at)}` : ` on ${dateLong(h.scheduled_at)}`}.`;
  if (r.kind === 'passed') return `${r.did}, and ${who(h.committee)} passed it${r.amended ? ' with changes' : ''}.`;
  if (r.kind === 'held') return `${r.did}, and ${who(h.committee)} put it on hold.`;
  return `You spoke up for it, and it ${isResolution(r.b) ? 'was adopted' : 'became law'}.`;
}
function sinceItems() {
  const prev = S.prevVisit ? +new Date(S.prevVisit) : 0, now = Date.now(), month = now - 30 * 864e5;
  const news = !!prev && now - prev >= 3 * 36e5;   // a visit a few hours ago is the same visit, for this
  const mseen = momentsSeen(), rseen = resultsSeen();
  const moments = results().filter(r => r.at && +new Date(r.at) > month
    && (S.hmShown.has(r.key) || (!mseen.has(r.key) && !(r.kind === 'passed' && rseen.has(r.h.id)))));   // a committee's yes already burst before 9/30
  if (!news && !moments.length) return null;
  const since = news ? Math.max(prev, month) : now, acted = new Map(myActions().filter(a => a.hearing_id).map(a => [a.hearing_id, a.kind]));
  const DID = { email: 'you emailed the chair', testimony: 'you testified', attend: 'you went', share: 'you shared it' }, per = new Map();
  const add = x => { const o = per.get(x.b.id); if (!o || (x.moment && !o.moment) || (!o.moment && x.you && !o.you) || (!!x.moment === !!o.moment && x.you === o.you && x.t > o.t)) per.set(x.b.id, x); };
  for (const r of moments) add({ b: r.b, t: +new Date(r.at), h: r.h, good: true, you: true, moment: r.key, law: r.kind === 'law', lead: MOMENT_ICON[r.kind], text: momentText(r) });
  for (const h of S.hearings) {
    const b = S.bills.find(x => x.id === h.bill_id); if (!b) continue;
    const num = spaced(b.bill_number), held = new Date(h.scheduled_at) <= now, o = held ? outcomeOf(h) : null, t = o && +new Date(o.reported_at || h.scheduled_at);
    if (o?.outcome && t > since) {
      const said = { passed: 'passed it', passed_amended: 'passed it with changes', deferred: 'put it on hold', recommitted: 'sent it back for more work' }[o.outcome];
      const k = acted.get(h.id);
      const good = sideOf(b) === 'against' ? o.outcome === 'deferred' : /passed/.test(o.outcome);   // good news goes the person's way
      if (said) add({ b, t, h, good, you: !!k, lead: good ? 'circle-check' : /passed/.test(o.outcome) ? 'arrow-right' : 'archive', text: `${who(h.committee)} ${said}${k ? ` (${DID[k] || 'you acted'})` : ''}.${/passed/.test(o.outcome) ? ' ' + nextWords(b) : ''}`.trim() });   // the result, and what comes next (R-126)
    } else if (!held && h.status === 'scheduled' && h.notice_posted_at && +new Date(h.notice_posted_at) > since && alive(b)) {
      const d = dayWord(h.scheduled_at); add({ b, t: +new Date(h.notice_posted_at), lead: 'calendar', text: `${num} has a hearing ${/^(today|tomorrow)/.test(d) ? d : 'on ' + d}.` });
    }
  }
  for (const b of S.bills) if ((b.stage === 'enacted' || b.stage === 'governor') && b.last_action_date && hiT(b.last_action_date) > since)
    add({ b, t: hiT(b.last_action_date), good: sideOf(b) !== 'against', you: myActions().some(a => a.bill_id === b.id), lead: sideOf(b) !== 'against' ? 'circle-check' : 'arrow-right', text: b.stage === 'enacted' ? 'It became law.' : 'It passed the House and Senate and is on the Governor’s desk.' });
  return [...per.values()].sort((p, q) => (!!q.moment - !!p.moment) || (q.you - p.you) || (q.t - p.t)).slice(0, 3);
}
// fullCards: the bills drawn as full action cards below (the first two), whose reason line can carry a moment.
function sinceStrip(inCards = new Set(), fullCards = new Set()) {
  // A hearing set on a bill the person already acted on is the row at the top that says so (loopCard): not again here.
  const loopB = S.hmLoopB || new Set(), all = sinceItems()?.filter(x => !(x.lead === 'calendar' && loopB.has(x.b.id))); if (!all) return '';
  // A hearing already drawn as a card below is counted in one line, not repeated as a row.
  let items = all.filter(x => !(x.lead === 'calendar' && inCards.has(x.b.id)));
  const carded = all.length - items.length;
  const news = !!S.prevVisit && Date.now() - +new Date(S.prevVisit) >= 3 * 36e5;   // else only moments are listed
  const d = new Date(S.prevVisit || Date.now()), days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(d))) / 864e5);
  const when = days <= 1 ? 'yesterday' : days < 7 ? d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : `your last visit`;
  const name = myName(), seen = resultsSeen(), mseen = momentsSeen();
  // The small burst goes to the first moment Home has not shown before; else, as before, a committee's yes on a hearing
  // they acted on. wire() marks the new moments seen, counts them and gives a law its full-screen moment.
  // A moment on a bill that also has an action card below is said once, as that card's reason line (A-14, the review
  // 9/30: HB 1870's "House Finance passed it" sat right above its own Senate card).
  S.hmCardMoments = new Map(items.filter(x => x.moment && fullCards.has(x.b.id)).map(x => [x.b.id, x]));
  S.hmMoments = items.filter(x => x.moment && !mseen.has(x.moment));
  items = items.filter(x => !(x.moment && fullCards.has(x.b.id)));
  S.hmBurst = items.find(x => x.moment && !mseen.has(x.moment))?.moment || (items.some(x => x.moment) ? null : items.find(x => x.you && x.good && x.h && !seen.has(x.h.id))?.h.id) || null;
  // The row that burst keeps its mark for the rest of the visit (a redraw must not drop it, nor burst it again).
  const bursts = x => x.moment ? x.moment === S.hmBurst || x.moment === S.hmBursted : !!x.h && x.h.id === S.hmBurst;
  if (!items.length && carded) return `<section class="hm-since quiet" aria-label="Since your last visit"><p><b>Aloha${name ? `, ${esc(name)}` : ''}.</b> Since ${esc(when)}, ${carded === 1 ? 'a hearing was' : `${carded} hearings were`} set on your issues. ${carded === 1 ? 'It’s' : 'They’re'} below.</p></section>`;
  if (!items.length) {
    const next = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now() && S.bills.some(b => b.id === h.bill_id) && !loopB.has(h.bill_id)).sort((p, q) => p.scheduled_at.localeCompare(q.scheduled_at))[0];
    const nb = next && S.bills.find(b => b.id === next.bill_id);
    return `<section class="hm-since quiet" aria-label="Since your last visit"><p><b>Aloha${name ? `, ${esc(name)}` : ''}.</b> Nothing new on your issues since ${esc(when)}.${nb ? ` Next: ${esc(nick(nb) || spaced(nb.bill_number))}, hearing ${esc(dayWord(next.scheduled_at))}.` : ''}</p></section>`;
  }
  // On a phone one row, so the day's actions stay near the top (A-1; three moments put the first card at 588px). The other
  // moments are on the session page, which the link beside the heading opens (so they count as shown); other news left out
  // here still shows in What's new (S.hmSinceShown is what this strip said).
  const narrow = (() => { try { return matchMedia('(max-width: 719px)').matches; } catch { return false; } })();
  const shown = narrow ? items.slice(0, 1) : items, more = items.slice(shown.length).filter(x => x.moment).length;
  S.hmSinceShown = new Set([...shown.map(x => x.b.id), ...S.hmCardMoments.keys()]);
  if (!shown.length) return '';
  return `<section class="hm-since" aria-labelledby="hm-since-h"><div class="hm-sincehead"><h2 id="hm-since-h"><span>Aloha${name ? `, ${esc(name)}` : ''}.</span> ${news ? `Since ${esc(when)}:` : 'Good news:'}</h2>
      ${more ? btn(`${more} more on your session page`, { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/recap', cls: 'hm-sincemore' }) : ''}</div>
    <div class="rows">${shown.map(x => row({ lead: x.lead, title: esc(nick(x.b) || spaced(x.b.bill_number)), sub: esc(x.text), href: billPath(x.b), cls: x.you && x.good ? 'hm-you' + (bursts(x) ? ' hm-youburst' : '') : '' })).join('')}</div>
    ${carded ? `<p class="meta">${carded === 1 ? 'A new hearing is' : `${carded} new hearings are`} in your list below.</p>` : ''}</section>`;
}

// ---------------- an unfinished testimony (R-068) ----------------
// "I'll finish later" used to leave no trace: the letter was saved, but nothing said so. Home names it first, while its
// hearing is still ahead, and one tap reopens the walkthrough where they left it.
// skip: hearings another card on the page already offers to finish (version A's Now card, R-187: A-14, A-3).
function draftsCard(skip = new Set()) {
  let drafts = {}; try { drafts = JSON.parse(localStorage.getItem('hiphi_me') || '{}')?.drafts || {}; } catch { /* private mode */ }
  const rows = Object.keys(drafts).filter(id => !skip.has(id)).map(anyHearing).filter(h => h && new Date(h.scheduled_at) > Date.now()).map(h => ({ h, b: anyBill(h.bill_id) })).filter(x => x.b && !didKind(x.b, x.h, 'testimony'));
  if (!rows.length) return '';
  return `<section class="card hm-draft" aria-labelledby="hm-draft-h"><h2 id="hm-draft-h">${icon('notebook-pen')}<span>Finish your testimony</span></h2>
    ${rows.slice(0, 2).map(({ b, h }) => `<p class="small">${esc(nick(b) || spaced(b.bill_number))} · hearing ${esc(dayWord(h.scheduled_at))}. Your letter is saved.</p>
      ${btn('Finish sending it', { kind: 'primary', sm: true, icon: 'arrow-right', attrs: { 'data-helper': h.id, 'data-bill': b.id } })}`).join('')}</section>`;
}

// ---------------- what you did, until the committee decides (X10-2, R-180) ----------------
// After testimony or an email to the chair about a hearing, Home leads with it until the committee's decision is in: what
// they did, when the committee hears it ("today" on the day itself, never "Fri"), and its video. The decision then shows
// where results always do ("Since you were here", "What happened after you acted"), so nothing is said twice. It reads
// only this browser's own marks (myActions): nothing new is asked of the server. A hearing that already has a card on the
// page (an action card done while here, a plan to go) is left to that card (A-14). GOV.UK's confirmation pattern: end on
// the success and say what happens next (C-6). Three days after a hearing with no decision yet, the row steps down to
// "What happened after you acted", which keeps waiting for it, so the top of Home stays for what is coming.
const LOOP_DID = { testimony: 'You sent testimony on', email: 'You emailed the chair about' };
function loopItems(skip) {
  const now = Date.now(), by = new Map();
  for (const a of myActions()) {
    if (!LOOP_DID[a.kind] || !a.hearing_id || skip.has(a.hearing_id)) continue;
    const h = anyHearing(a.hearing_id), b = h && anyBill(a.bill_id);
    if (!b || outcomeOf(h) || !alive(b) || new Date(h.scheduled_at).getTime() < now - 3 * 864e5) continue;
    if (!by.has(h.id) || a.kind === 'testimony') by.set(h.id, { b, h, kind: a.kind });
  }
  return [...by.values()].sort((p, q) => p.h.scheduled_at.localeCompare(q.h.scheduled_at)).slice(0, 2);
}
function loopRow({ b, h, kind }) {
  const now = Date.now(), at = new Date(h.scheduled_at).getTime(), today = hstDay(at) === hstDay(now), off = h.status === 'cancelled', v = off ? null : streamOf(h);
  const name = nick(b), num = spaced(b.bill_number);
  const when = off ? `The hearing on ${dateLong(h.scheduled_at)} was cancelled. If it’s set again, it shows here.`
    : at > now ? `The committee hears it ${today ? 'today' : dayWord(h.scheduled_at)} at ${timeWord(h.scheduled_at)}.`
    : `The committee heard it ${today ? 'today' : dateLong(h.scheduled_at)}. We’ll show what they decide here.`;
  // The video: live on the day, the recording after it, and before the day the channel it will stream on (as the
  // walkthrough's Mahalo offers it).
  const label = !v ? '' : v.state === 'live' ? 'Watch live now' : v.state === 'after' ? v.label : today ? 'Watch it live' : 'Watch it live on YouTube';
  return `${row({ lead: 'circle-check', title: esc(`${LOOP_DID[kind]} ${name || num}`), sub: esc(name ? `${num} · ${when}` : when), href: billPath(b), cls: 'hm-you' })}
    ${v ? `<div class="hm-loopx">${btn(label, { kind: 'text', sm: true, icon: 'play', iconEnd: 'external-link', href: v.url, attrs: { target: '_blank', rel: 'noopener' } })}</div>` : ''}`;
}
// skip: the hearings already drawn as their own card on this page. Sets S.hmLoopB, the bills it names, so the rest of Home
// leaves them out ("Since you were here", "What's new", "What happened after you acted").
// Someone who acted from a shared link and came straight here (bill.js homeAfterAct) skipped the story of the bill: it is
// offered in one quiet line, until they open it.
function loopCard(skip = new Set()) {
  const items = loopItems(skip);
  S.hmLoopB = new Set(items.map(x => x.b.id));
  if (!items.length) return '';
  const w = wiz(), learn = w.viaHome && !w.viaLearned && items.find(x => x.b.id === w.viaId);
  return `<section class="hm-loop" aria-labelledby="hm-loop-h"><h2 id="hm-loop-h" class="sr">What you did</h2>
    <div class="rows">${items.map(loopRow).join('')}</div>
    ${learn ? `<p class="hm-looplearn">${icon('sparkles')}<span>New to this? <a href="#/learn/story/${esc(learn.b.id)}" data-hm-learn="1">See how a bill becomes law</a>, about a minute.</span></p>` : ''}</section>`;
}

// ---------------- keep it on your phone (R-067) ----------------
// Offered once someone has acted, on a phone, when the tracker is not already on their home screen; "No thanks" hides
// it for good in this browser. Android's own install prompt when the browser offers one (app.js keeps it); on an
// iPhone the two taps it takes, and the honest catch: the home-screen app keeps its own copy, so they add their email
// there to bring their issues along. A home-screen app is also what keeps an iPhone from clearing their issues after a
// week away.
function homeScreenCard() {
  let no = false; try { no = localStorage.getItem('hiphi_hs_no') === '1'; } catch { /* private mode */ }
  const standalone = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } })();
  if (no || standalone || !myActions().length || (window.innerWidth || 0) >= 900) return '';
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent || '');
  const how = S.installPrompt ? btn('Add to home screen', { kind: 'primary', sm: true, icon: 'smartphone', attrs: { 'data-hm-hsgo': '1' } })
    : ios ? `<p class="small">In Safari, tap ${icon('share')} <b>Share</b>, then <b>Add to Home Screen</b>. The app there starts fresh: add your email in it to bring your issues along.</p>`
    : `<p class="small">In your browser’s menu, choose <b>Add to Home screen</b> or <b>Install app</b>.</p>`;
  return `<section class="card hm-hs" aria-labelledby="hm-hs-t"><h2 id="hm-hs-t">${icon('smartphone')}Keep the tracker on your phone</h2>
    <p class="small muted">One tap to your issues next time, like any app.</p>${how}
    <div class="btnrow">${btn('No thanks', { kind: 'text', sm: true, attrs: { 'data-hm-hsno': '1' } })}</div></section>`;
}

// ---------------- things to do ----------------
// Bills the person follows that are waiting for a hearing and running out of time (three weeks or less). The ask
// itself lives on the bill page, so the rules match that page: only where HIPHI wants the bill heard (for a bill
// HIPHI opposes, no hearing is the good outcome), only while a chair is known, and not once the person has asked.
// Someone who sees the bill differently from HIPHI is not handed HIPHI's ask.
const ASK_DAYS = 21;
const askList = () => waitingBills(S.bills).filter(({ b, st }) => st.deadline.days <= ASK_DAYS && !/oppose/.test(b.hiphi_position || '')
  && agrees(b) !== false && chairContacts(st.committee).length && !askedChair(b, st.committee));
const daysLeft = d => d <= 0 ? 'Last day' : `${plural(d, 'day')} left`;
function askCard({ b, st }, primary) {
  const dl = st.deadline, where = cmteLabel(st.committee), chairs = chairContacts(st.committee).length > 1 ? 'chairs' : 'chair';
  return `<article class="card hm-ask" aria-labelledby="hm-ask-${esc(b.id)}">
    <div class="hm-askrow">${chip(daysLeft(dl.days), dl.days <= 7 ? 'warn' : '', 'hourglass')}${posChip(b)}</div>
    <h3 class="hm-askt" id="hm-ask-${esc(b.id)}">${esc(headline(b, 200))}</h3>
    <p class="meta">${esc(spaced(b.bill_number))}</p>
    <p class="small hm-askwhy">Waiting for a hearing in ${esc(/^the /.test(where) ? where : 'the ' + where)}. If it is not heard by ${esc(dateLong(dl.date + 'T12:00:00-10:00'))}, it stops for this year.</p>
    <div class="btncol">${btn(`Ask the ${chairs} for a hearing`, { kind: primary ? 'primary' : 'secondary', icon: 'mail', full: true, href: billPath(b), attrs: { 'data-hm-ask': b.bill_number, 'data-hm-act': '1' } })}</div>
  </article>`;
}
// Past the first two, things to do are one line each and open the bill page, where the same action lives. Fourteen
// full cards made Home a 7,000px wall on a phone and 5,600px on a laptop (assessment 9/19).
const actRow = x => { const d = dueInfo(x.h);
  return row({ lead: issueOf(x.b)?.icon || 'landmark', title: esc(headline(x.b, 200)), href: billPath(x.b), attrs: { 'data-hm-act': '1' },
    sub: `${esc(spaced(x.b.bill_number))} · <span class="hm-due${d?.tone ? ' ' + d.tone : ''}">${esc(d ? d.text : hearingText(x.h))}</span>` }); };
const askRow = ({ b, st }) => row({ lead: 'hourglass', title: esc(headline(b, 200)), href: billPath(b), attrs: { 'data-hm-act': '1' },
  sub: `${esc(spaced(b.bill_number))} · <span class="hm-due${st.deadline.days <= 7 ? ' warn' : ''}">${esc(daysLeft(st.deadline.days))}</span>` });
const moreRows = (id, rows) => `${toggle(id, 'hm-' + id, `Show ${rows.length} more`)}<div id="hm-${id}" class="rows hm-more"${S.hmOpen[id] ? '' : ' hidden'}>${rows.join('')}</div>`;
// Open actions first (two cards, then one line each), then up to two "ask the chair" cards. calm: inside the first
// visit's "Ready now?" fold, where no card is singled out.
function todoBlock(cards, asks, { nudgeHtml = '', calm = false } = {}) {
  const first = calm ? null : cards.find(x => !settledOn(x.b, x.h)), rest = cards.slice(2), arest = asks.slice(2);
  // The first card says how many are due the same day (Layout A's Now card, R-131): "1 of 3 due today".
  const dayOf = x => x.h.testimony_deadline ? hstDay(x.h.testimony_deadline) : '';
  const ofN = x => { if (x !== first || !dayOf(x)) return ''; const n = cards.filter(y => !settledOn(y.b, y.h) && dayOf(y) === dayOf(x)).length; return n > 1 ? `1 of ${n} due ${dayWord(x.h.testimony_deadline).replace(/ at .*$/, '')}` : ''; };
  const card = x => actionCard(x.b, x.h, { focus: x === first, why: S.hmCardMoments?.get(x.b.id)?.text, ofN: ofN(x), twin: S.hmTwins?.get(x.b.id) || null });
  return `${cards.length ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Do this now</h2>
      ${cards.slice(0, 1).map(card).join('')}${nudgeHtml}${cards.slice(1, 2).map(card).join('')}
      ${rest.length ? moreRows('rest', rest.map(actRow)) : ''}</section>` : nudgeHtml}
    ${asksSec(cards, asks, arest)}`;
}
const asksSec = (cards, asks, arest = asks.slice(2)) => asks.length ? `<section class="hm-sec hm-asks" aria-labelledby="hm-asks-t"><h2 id="hm-asks-t">${asks.length === 1 ? 'A bill that needs a hearing' : 'Bills that need a hearing'}</h2>
      <p class="small hm-asksub">The committee chair decides which bills get a hearing. A short, polite note helps.</p>
      ${asks.slice(0, 2).map((x, i) => askCard(x, !cards.length && !i)).join('')}
      ${arest.length ? moreRows('asks', arest.map(askRow)) : ''}</section>` : '';
// Home's top grouped by topic: the home test's second version (R-135, variant.js 'home'). By topic, the six the first
// visit's first screen offers, not by issue: 55 of the 91 issues share their name with one of their bills, so an issue
// heading would repeat the card title under it most of the time (A-14). Each topic with something to do is a section, the
// one with the soonest deadline first (the cards come in deadline order). As in today's version, only the two soonest
// things are full cards and everything else is one line (the review 10/3: one full card per topic made a later bill a
// card and a sooner one a line, and three main buttons against two), so the test measures the grouping and nothing else.
// Three topics show; the rest fold under "Show N more topics". The cards under a topic heading leave out their own topic
// line. The asks for a hearing stay as they are.
function issueBlock(cards, asks, { nudgeHtml = '' } = {}) {
  const groups = new Map();
  for (const x of cards) { const t = issueOf(x.b), k = t ? t.key : ''; if (!groups.has(k)) groups.set(k, { t, xs: [] }); groups.get(k).xs.push(x); }
  const list = [...groups.values()].sort((a, b) => (a.t ? 0 : 1) - (b.t ? 0 : 1)), first = cards.find(x => !settledOn(x.b, x.h)), full = new Set(cards.slice(0, 2));
  const sec = (g, n) => { const id = `hm-iss-${n}`, big = g.xs.filter(x => full.has(x)), small = g.xs.filter(x => !full.has(x));
    return `<section class="hm-iss" aria-labelledby="${id}"><h2 class="hm-isst" id="${id}">${icon(g.t ? issueIcon(g.t.icon) : 'landmark')}<span>${esc(g.t ? g.t.key : 'Other bills you follow')}</span></h2>
      ${big.map(x => actionCard(x.b, x.h, { focus: x === first, why: S.hmCardMoments?.get(x.b.id)?.text, twin: S.hmTwins?.get(x.b.id) || null, noTopic: !!g.t })).join('')}
      ${small.length ? `<div class="rows">${small.map(actRow).join('')}</div>` : ''}</section>${n === 0 ? nudgeHtml : ''}`; };
  const more = list.slice(3);
  return `${cards.length ? `<div class="hm-now hm-byissue">${list.slice(0, 3).map(sec).join('')}
      ${more.length ? `${toggle('iss', 'hm-issmore', `Show ${more.length} more ${more.length === 1 ? 'topic' : 'topics'}`)}<div id="hm-issmore" class="hm-now hm-more"${S.hmOpen.iss ? '' : ' hidden'}>${more.map((g, k) => sec(g, k + 3)).join('')}</div>` : ''}</div>` : nudgeHtml}
    ${asksSec(cards, asks)}`;
}

// Why a suggestion is shown, in words: the biggest part of its score (rank.js). Empty when only the deadline would
// be left to say, which the card already shows.
const reasonFor = b => reasonOf(b);
// A suggestion card: Follow and "Not for me" always; the reason line only when it says something the card does
// not already say (a bare "needs voices this week" just repeats the heading and the deadline).
const sugCard = (b, h) => actionCard(b, h, { suggest: true, why: reasonFor(b) });
// The suggestion stays put for the rest of the visit once shown, even after Follow (so it does not leap into
// "Do this now" under the person's finger); a fresh visit to Home places it with the other cards.
function keptSuggestion() {
  if (!S.hmSug) return null;
  const b = anyBill(S.hmSug.b), h = anyHearing(S.hmSug.h);
  return b && h && !dismissed().has(b.id) && new Date(h.scheduled_at) > Date.now() ? { b, h } : null;
}
// Home's one suggestion is Find's first (the same short list), unless it is already on Home some other way.
function pickSuggestion(skip) {
  const r = suggestionList(4).find(x => x.st?.hearing && !skip.has(x.b.id));
  if (r) noteShown([r], 'home');
  return r ? { b: r.b, h: r.st.hearing } : null;
}

// ---------------- in session, following bills ----------------
function followView(si) {
  const welcome = welcomed();
  let sug = welcome ? null : keptSuggestion();
  const all = openActions(S.bills, S.hearings).filter(x => !(sug && x.b.id === sug.b.id));
  // Anything already done when the person arrived on Home folds into "Done this week", so the page opens on what is
  // still open. A card finished while they are here stays where it was, in its done state: nothing jumps under a finger.
  const arrived = S.hmArrived || new Set(), wasDone = x => KINDS.some(k => arrived.has(doneKey(x.b.id, x.h.id, k)));
  const folded = all.filter(x => settledOn(x.b, x.h) && wasDone(x));
  let cards = all.filter(x => !folded.includes(x));
  // Twin bills as one card (R-131, the assessment's P7): a House bill and its Senate twin both open are one card, the
  // sooner deadline leading and the twin named on it (the review 9/28: the two "Disposable e-cigarette ban" bills got two cards
  // with opposite asks on one Home). actionCard reads the twin from S.hmTwins.
  S.hmTwins = new Map();
  for (const x of cards) {
    if ([...S.hmTwins.values()].includes(x) || S.hmTwins.has(x.b.id)) continue;
    // Twins by the companion link, or by the same nickname in the other chamber (the links are often not set yet).
    const nums = companionsOf(x.b), ch = b => (b.bill_number || '')[0];
    const t = cards.find(y => y !== x && !S.hmTwins.has(y.b.id) && (nums.includes(y.b.bill_number) || (nick(x.b) && nick(x.b) === nick(y.b) && ch(x.b) !== ch(y.b))));
    if (t) S.hmTwins.set(x.b.id, t);
  }
  const folded2 = new Set([...S.hmTwins.values()]); cards = cards.filter(x => !folded2.has(x));
  const open = cards.filter(x => !settledOn(x.b, x.h)), asks = askList(), total = open.length + asks.length;
  const inCards = new Set(all.map(x => x.b.id));
  if (!welcome) {
    if (!sug && total < 2) sug = pickSuggestion(new Set([...inCards, ...asks.map(x => x.b.id)]));
    S.hmSug = sug ? { b: sug.b.id, h: sug.h.id } : null;
    if (sug) inCards.add(sug.b.id);
  }
  return welcome ? welcomeView(si, { cards, asks, total }) : returnView(si, { cards, asks, open, total, folded, sug, inCards });
}

// Later visits: the heading counts what can really be done, asks for a hearing included, so a follower is never told
// "all caught up" while a bill of theirs is running out of time.
function returnView(si, { cards, asks, open, total, folded, sug, inCards }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST });
  const live = S.bills.filter(alive).length;
  const h1 = total ? `${plural(total, 'thing')} you can do this week` : live || cards.length || folded.length ? 'You’re all caught up' : 'The bills on your issues have finished for this session';
  // Nothing open: everything done (the islands), nothing needs a voice yet, or every bill has finished.
  let quiet = '';
  if (!total) {
    quiet = cards.length || folded.length
      ? empty({ art: islands(myIsland()), text: 'You’ve done everything on your list this week. Mahalo! New hearings usually post by Friday.' })
      : live ? `<p class="lede">Nothing needs you right now. When one of the ${live === 1 ? 'bill' : `${n(live)} bills`} on your issues has a hearing, a simple way to help shows up here.</p>`
      : `<div class="hm-quiet"><p class="lede">Their record stays in My issues. Other bills are still moving and need voices.</p>${btn('Find bills still moving', { kind: sug ? 'secondary' : 'primary', icon: 'search', href: '#/find' })}</div>`;
  }
  // One email ask, under the first card, never above the page's heading (the "welcome back" one used to push it down).
  const nudgeHtml = S.nudge && S.nudge !== 'action' ? nudgeCard(S.nudge) : '';
  S.hmSinceShown = new Set(); S.hmCardMoments = new Map();
  // Hearings they plan to go to (R-142): today's or tomorrow's at the top, where the day's plan belongs; later ones in the
  // side column. A card already drawn on this page carries its own "How to get there", so it is not said twice (A-14).
  const plans = goingPlans(new Set(cards.map(x => x.h.id))), goSoon = goingCard(plans.filter(p => p.soon)), goLater = goingCard(plans.filter(p => !p.soon));
  // What they did and when the committee hears it (X10-2), but not for a card still drawn in place below (one done while
  // they were here) or a plan to go, each of which says it already.
  const loop = loopCard(new Set([...cards.map(x => x.h.id), ...plans.map(p => p.h.id)])), inLoop = S.hmLoopB;
  const since = sinceStrip(inCards, new Set(cards.slice(0, 2).map(x => x.b.id))), inSince = new Set([...S.hmSinceShown, ...inLoop]);
  // The suggestion sits in the side column, unless the main column would otherwise be empty (nothing to do): then it
  // is the one thing on offer and goes where things to do go. Decided by what is drawn, not by the count, so it does
  // not move when the person finishes their last card in place.
  const sugInMain = !cards.length && !asks.length;   // (the strip, above, also decided which moments are a card's reason line)
  // The home test (R-135): met where its versions differ, two or more things to do.
  if (cards.length >= 2) abSeen('home');
  const byIssue = armOf('home') === 'by-issue';
  const sugHtml = sug ? `<section class="hm-sec" aria-labelledby="hm-sug"><h2 id="hm-sug">${sugInMain ? 'A bill that still needs voices' : 'Another bill that needs voices'}</h2>
      ${sugCard(sug.b, sug.h)}
      ${btn('More bills that need voices', { kind: 'text', iconEnd: 'chevron-right', href: '#/find', cls: 'hm-link' })}</section>` : '';
  return `<div class="hm hm-follow">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      ${draftsCard()}${goSoon}${since}${loop}<header class="hm-head"><p class="eyebrow">${esc(today)}</p><h1 class="hero">${esc(h1)}</h1>${quiet}</header>
      ${byIssue ? issueBlock(cards, asks, { nudgeHtml }) : todoBlock(cards, asks, { nudgeHtml })}
      ${folded.length ? `<details class="hm-fold"${S.hmOpen.fold ? ' open' : ''}><summary><h2 class="hm-foldt">${icon('circle-check')}Done this week (${folded.length})</h2>${icon('chevron-down', { cls: 'hm-foldc' })}</summary>
        <div class="hm-foldb">${folded.map(x => actionCard(x.b, x.h)).join('')}</div></details>` : ''}
      ${sugInMain ? sugHtml : ''}
    </div><div class="side hm-side">
      ${goLater}${newIssuesCard()}
      ${sessionPanel(si, { skip: inSince })}
      ${whatsNew(new Set([...inCards, ...inSince]))}
      ${homeScreenCard()}
      ${meetCard()}
      ${sugInMain ? '' : sugHtml}
    </div></div>
  </div>`;
}

// The first visit (Nate, 9/19): they followed a few bills and maybe said where they stand, and that is enough for
// today. No deadline shouts here. Anything they could do this week waits behind one quiet line.
// Right after the first visit's last screen (R-023): the issues just followed, one line each, with a hearing day when
// there is one. The finale has just celebrated; badges, a stats panel and "What's new" here would say it all again, and
// counted differently (the review, 9/21: "said where you stand on one of them" beside "2 stands taken").
function yourIssues() {
  const iss = followedIssues(); if (!iss.length) return '';
  const soon = new Map(); for (const h of S.hearings) if (h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now() && new Date(h.scheduled_at) - Date.now() < 7 * 864e5) {
    const c = soon.get(h.bill_id); if (!c || h.scheduled_at < c) soon.set(h.bill_id, h.scheduled_at); }
  const rows = iss.slice(0, 6).map(i => { const ids = issueBills(i), live = ids.map(id => S.bills.find(b => b.id === id)).filter(b => b && alive(b));
    const day = ids.map(id => soon.get(id)).filter(Boolean).sort()[0];
    // On the hearing's own day the chip says "Today" (X10-2: on Friday it said "Fri", like a day still to come).
    const dayChip = day ? chip(hstDay(day) === hstDay(Date.now()) ? 'Today' : new Date(day).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }), 'info', 'calendar') : '';
    // Each row opens its issue (R-098: the rows looked tappable and did nothing, so Home seemed not to work).
    return `<li><a class="hm-yrow" href="#/issue/${esc(i.slug)}"><span class="hm-yname"><b>${esc(i.name)}</b><span>${live.length ? plural(live.length, 'bill') + ' moving' : 'Nothing moving yet'}</span></span>${dayChip}${icon('chevron-right', { cls: 'hm-ychev' })}</a></li>`; }).join('');
  return `<section class="card hm-yours" aria-labelledby="hm-yi"><h2 id="hm-yi" class="hm-eyebrow">Your issues</h2><ul class="hm-ylist">${rows}</ul>
    ${btn(iss.length > 6 ? `See all ${iss.length}` : 'See my issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link' })}</section>`;
}
function welcomeView(si, { cards, asks, total }) {
  // What they follow, in words ("all of Food & Nutrition and 3 more issues", "7 issues"); a stand counts once per issue.
  const said = followSummary() || plural(S.bills.length, 'bill'), stances = S.stances || {}, took = id => ['support', 'oppose'].includes(stances[id]);
  const iss = followedIssues(), stands = iss.length ? iss.filter(i => issueBills(i).some(took)).length : S.bills.filter(b => took(b.id)).length;
  const ms = milestoneState(myActions());
  const stood = !stands ? '' : ` and said where you stand on ${stands === 1 ? 'one of them' : n(stands)}`;
  const soon = cards.filter(x => !settledOn(x.b, x.h)).length;
  // The guided start's email step was skipped: one ask here, in the flow of the page (core's nudge rules still apply).
  // Not in the email-ask test's second version, which first asks after an action (R-135, variant.js 'email').
  const ask = (S.session && !S.nudgeText) || (alertsGiven() && !S.nudgeSent && !S.nudgeText) || !S.nudge || armOf('email') === 'after' ? '' : nudgeCard(S.nudge);
  const step = (ic, title, text) => `<li><span class="hm-stepic">${icon(ic)}</span><span><b>${title}</b> ${text}</span></li>`;
  // After the new first visit's last screen (R-023: "You're all set" and "What happens next" were just said there), Home
  // says aloha instead of repeating them (A-14), and the week's first hearing on their issues gets a quiet way in to
  // help (B-3: the lessons need somewhere to go). Nothing is pushed: the rest still waits behind one line.
  const fin = !!wiz().finale, name = (wiz().name || '').trim();
  // What they did since, and when the committee hears it (X10-2): a plan to go has its own card, so it is left to it.
  const loop = loopCard(new Set(goingPlans().map(p => p.h.id)));
  if (fin && endHome()) return homeFirst({ cards, asks, ask, loop });
  // The week's first hearing they have not acted on yet: once they have, the row above says so (X10-2).
  const week = fin ? cards.filter(x => x.h && new Date(x.h.scheduled_at) > Date.now() && !settledOn(x.b, x.h) && !S.hmLoopB.has(x.b.id)).sort((a, b) => a.h.scheduled_at.localeCompare(b.h.scheduled_at))[0] : null;
  const due = week ? dueInfo(week.h) : null;
  const weekCard = week ? `<section class="card hm-week" aria-labelledby="hm-wk"><p class="hm-eyebrow">This week</p>
      <h2 id="hm-wk">${esc(spaced(week.b.bill_number))} has a hearing ${esc(dayWord(week.h.scheduled_at))}</h2>
      <p>${esc(nick(week.b) || blurb(week.b, 80))} · ${esc(timeWord(week.h.scheduled_at))} · ${esc(roomLabel(week.h.room))}.${due && !due.late ? ` ${due.html}${S.session && S.user?.prefs?.hearing_alerts ? '; we’ll remind you' : ''}.` : ''}</p>
      ${btn('See how to help', { kind: 'text', iconEnd: 'arrow-right', href: billPath(week.b), cls: 'hm-link', attrs: { 'data-hm-act': '1' } })}</section>` : '';
  const heading = fin ? `Aloha${name ? `, ${esc(name)}` : ''}` : name ? `You’re all set, ${esc(name)}` : 'You’re all set';
  const lede = fin ? `You follow ${esc(said)}${stood}. Here’s what’s happening on them this week.` : `You follow ${esc(said)}${stood}. That’s all you need to do today.`;
  return `<div class="hm hm-follow hm-welcome${fin ? ' hm-fin' : ''}">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      <header class="hm-head hm-hello">${flower(32)}<h1 class="hero">${heading}</h1>
        <p class="lede">${lede}</p>
        ${fin ? '' : chipsHtml(ms.got)}
        ${fin ? '' : btn('See my issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link' })}</header>
      ${loop}${weekCard}${fin ? yourIssues() : ''}
      ${fin ? '' : `<section class="card hm-nextup" aria-labelledby="hm-nu"><h2 id="hm-nu">What happens next</h2>
        <ul class="hm-steps">
          ${step('eye', 'We keep watch.', 'We check every bill on your issues each day, so you don’t have to.')}
          ${step('calendar-clock', 'When a bill has a hearing, you can help.', `${soon ? `${soon === 1 ? 'One bill on your issues has' : `${n(soon)} bills on your issues have`} one coming up. ` : ''}We’ll show one simple way to help, right here. Most take a couple of minutes.`)}
          ${step('circle-check', 'You see what happened.', 'When a committee decides, the result shows up here and in My issues.')}
        </ul></section>`}
      ${ask}
      ${total ? `<section class="hm-later">${toggle('ready', 'hm-readybox', `Ready now? ${plural(total, 'thing')} you can do this week`, 'Hide these for now')}
        <div id="hm-readybox" class="hm-readybox"${S.hmOpen.ready ? '' : ' hidden'}>${todoBlock(cards, asks, { calm: true })}</div></section>` : ''}
    </div>${fin ? '' : `<div class="side hm-side">
      ${sessionPanel(si, { welcome: true, skip: S.hmLoopB })}
      ${whatsNew(new Set(S.hmLoopB))}
    </div>`}</div>
  </div>`;
}

// ---------------- the version that ends on Home (R-098, ?end=home, pub/variant.js) ----------------
// Testers took the email as the end of the first visit and found Home doing nothing. Here the first visit's last moment
// happens ON Home: "Mahalo! This is your home page", what the person did as a row of ticks, petals and blooms once (the
// finale's celebration, C-7's peak, now where they will come back to), "What you can do right now" open with the one
// thing due first (Nate 9/29), and their issues, each opening its page. Three tips then show the page (pub/tour.js).
// For the rest of this visit Home keeps this shape; after a reload it says Aloha and leaves out the ticks.
const finNow = () => !!S.hmFinale;   // this page load finished the first visit (start.js finish())
function finRecap() {
  const f = S.hmFinale || {}, iss = followedIssues();
  return [
    // Short, so they sit two to a line on a phone and "What you can do right now" stays in view.
    iss.length ? ['check', `Following ${plural(iss.length, 'issue')}`] : S.watch.size ? ['check', `Following ${plural(S.watch.size, 'bill')}`] : null,
    f.learned ? ['check', 'Know how bills become law'] : null,
    f.legs || districtsKnown() ? ['check', 'Know who speaks for you'] : null,
    // Alerts by the one rule every screen uses (alerts.js alertStatus, D1-4): "on" only for a confirmed number or an email
    // choice that is on; a number not yet confirmed or a link not yet opened is "almost set". It said "Email reminders on"
    // for anyone signed in, and "Text alerts on" for any number.
    (a => a.key === 'on' ? ['check', a.short] : a.key === 'almost' ? [a.icon, a.short] : null)(alertStatus()),
  ].filter(Boolean);
}
function finHead({ off = false, lede = '' } = {}) {
  const name = (wiz().name || '').trim(), now = finNow(), rows = now ? finRecap() : [];
  const h1 = now ? (name ? `Mahalo, ${esc(name)}!` : 'Mahalo for joining in!') : `Aloha${name ? `, ${esc(name)}` : ''}`;
  return `${off ? '' : `<div class="hm-blooms" aria-hidden="true">${[0, 1, 2, 3, 4].map(i => `<span style="--k:${i}">${flower(20 + (i % 2) * 8)}</span>`).join('')}</div>`}
    <h1 class="hero" id="hm-finh">${h1}</h1><p class="lede">${lede}</p>
    ${rows.length ? `<ul class="hm-did" role="list" aria-label="What you did today">${rows.map(([ic, t], k) => `<li style="--k:${k}"><span class="hm-didic${ic === 'check' ? ' ok' : ''}">${icon(ic)}</span>${esc(t)}</li>`).join('')}</ul>` : ''}`;
}
// "What you can do right now" (Nate 9/29, R-098 decision 3): the one thing due first, open, as the full card with its
// main button; anything else this week folds under it. Nothing due: the section says what will come here.
function rightNow(cards, asks) {
  const first = cards.find(x => !settledOn(x.b, x.h)) || null, rest = cards.filter(x => x !== first), more = rest.length + asks.length;
  S.hmTip = first ? { num: spaced(first.b.bill_number) } : null;   // the tips' words (pub/tour.js)
  return `<section class="hm-rightnow" aria-labelledby="hm-rn"><h2 id="hm-rn" class="hm-rnh">What you can do right now</h2>
    ${first ? actionCard(first.b, first.h, { focus: true }) : `<p class="hm-rnnone">Nothing needs you this week. When a bill on your issues has a hearing, what you can do shows up here, and by when.</p>`}
    ${more ? `<div class="hm-later">${toggle('ready', 'hm-readybox', `More you can do this week (${more})`)}
      <div id="hm-readybox" class="hm-readybox"${S.hmOpen.ready ? '' : ' hidden'}>${todoBlock(rest, asks, { calm: true })}</div></div>` : ''}
  </section>`;
}
function homeFirst({ cards, asks, ask, loop = '' }) {
  const iss = followedIssues();
  return `<div class="hm hm-follow hm-welcome hm-fin hm-fin2${finNow() && !S.hmFinDrawn ? ' hm-anim' : ''}">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      <header class="hm-head hm-hello hm-finhead">${finHead({ lede: `This is your home page. When a bill on ${iss.length === 1 ? 'your issue' : 'your issues'} needs you, it shows up here, and we help you speak up in a few minutes.` })}</header>
      ${loop}${rightNow(cards, asks)}
      ${yourIssues()}
      ${shareLine('hm-share')}
      ${keepLine('hm-share')}
      ${ask}
    </div></div>
  </div>`;
}
// Once per page load, after the first visit ends here: petals fall over the page (outside #app, so a redraw as data
// lands does not restart them), a burst on the heading, and the private count of this ending.
function finFx() {
  if (!S.hmFinale || S.hmFinDrawn || !document.querySelector('#main .hm-fin2')) return;
  S.hmFinDrawn = true;
  const si = sessionInfo();
  logVisit('home', 'view', { path: wiz().via ? 'link' : si.phase !== 'in' ? 'off' : 'in' });
  burst(document.getElementById('hm-finh'), 16, 90);
  const fx = document.createElement('div'); fx.className = 'hm-petalfx'; fx.setAttribute('aria-hidden', 'true');
  // The finale's own petals (fx.js), down within 2 s (X11-2, R-180); the layer goes once the last has fallen.
  fx.innerHTML = `<div class="st-petals">${petals()}</div>`;
  document.body.appendChild(fx); setTimeout(() => fx.remove(), 2200);
}

// ---------------- in session, following nothing: explore (plan 3, "Skip path") ----------------
// On the first visit these are bills to follow, one line each, not cards with a "send an email" button: nothing is
// pushed on a first visit. After that the cards are the same as everywhere else.
const pickRow = x => { const on = S.watch.has(x.b.id), num = spaced(x.b.bill_number);
  return `<div class="hm-pick"><a class="hm-pickmain" href="${billPath(x.b)}"><span class="lead">${icon(issueOf(x.b)?.icon || 'landmark')}</span>
    <span class="body"><span class="title">${esc(headline(x.b, 200))}</span><span class="sub">${esc(num)} · Hearing ${esc(dayWord(x.h.scheduled_at))}</span></span></a>
    ${btn(on ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: on ? 'check' : 'star', cls: 'hm-star' + (on ? ' on' : ''), attrs: { 'data-follow': x.b.id, 'aria-pressed': on ? 'true' : 'false', 'aria-label': `${on ? 'Following' : 'Follow'} ${num}`, title: on ? 'Following. Press to stop following.' : null } })}</div>`; };
function exploreView() {
  const f = S.featured || { bills: [], hearings: [] }, seen = new Set(), skip = dismissed(), calm = welcomed();
  const cards = openActions(f.bills, f.hearings).filter(x => !x.late && !skip.has(x.b.id) && !seen.has(x.b.id) && seen.add(x.b.id)).slice(0, calm ? 5 : 3);
  const nudgeHtml = S.nudge ? nudgeCard(S.nudge) : '';
  const cats = S.cats, lists = (S.lists || []).filter(l => l.is_published !== false);
  // A hearing they plan to go to, from one of these cards on an earlier visit (R-142): the same plan card as a follower's Home.
  const plans = goingPlans(new Set(calm ? [] : cards.map(x => x.h.id))), goSoon = goingCard(plans.filter(p => p.soon)), goLater = goingCard(plans.filter(p => !p.soon));
  // Someone who acted and then stopped following: what they did still leads (X10-2), unless its card is below.
  const loop = loopCard(new Set([...(calm ? [] : cards.map(x => x.h.id)), ...plans.map(p => p.h.id)]));
  const lede = !cards.length ? 'No hearings are set on HIPHI’s bills yet this week. New ones usually post by Friday. Meanwhile, look around by issue.'
    : calm ? 'These bills have hearings soon. Follow one to keep an eye on it. When it needs a voice, we’ll show a simple way to help.'
    : 'These bills have hearings soon. Add your voice in a few minutes, or follow one’s issue to hear what happens.';
  return `<div class="hm hm-explore">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      ${goSoon}${loop}<header class="hm-head"><h1 class="hero">This week at the Capitol</h1><p class="lede">${lede}</p></header>
      ${!cards.length ? nudgeHtml : calm ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Bills with hearings soon</h2><div class="rows hm-picks">${cards.map(pickRow).join('')}</div>${nudgeHtml}</section>`
        : `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Bills with hearings soon</h2>
        ${cards.slice(0, 1).map(x => sugCard(x.b, x.h)).join('')}${nudgeHtml}${cards.slice(1).map(x => sugCard(x.b, x.h)).join('')}</section>`}
    </div><div class="side hm-side">
      ${goLater}${cats.length ? `<section class="hm-sec" aria-labelledby="hm-iss"><h2 id="hm-iss">Browse issues</h2>
        <div class="rows hm-issues">${cats.map(c => row({ lead: c.icon, title: esc(c.name), sub: esc(c.description || ''), href: `#/find/category/${encodeURIComponent(c.key)}` })).join('')}</div></section>` : ''}
      ${lists.length ? `<section class="hm-sec" aria-labelledby="hm-lists"><h2 id="hm-lists">Lists from HIPHI</h2>
        <div class="rows">${lists.map(l => row({ lead: issueIcon(l.icon, 'list'), title: esc(l.title), sub: esc(l.description || ''), end: countOk(l.followers) ? `<span class="hm-day">${n(l.followers)} following</span>` : '', href: `#/list/${encodeURIComponent(l.slug)}` })).join('')}</div></section>` : ''}
      <p class="hm-start">Want suggestions? ${btn('Pick your issues, about 4 minutes', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' })}</p>
    </div></div>
  </div>`;
}

// ---------------- between sessions (plan 4, "Between sessions"; reworked 9/19) ----------------
// What every real visitor sees from May to January. The recap is for people with a history: what they did, and what
// became of the bills they followed, acted on or not. Someone new is welcomed, never told what they "didn't do".
// The issues they saved are named, with Edit. One email ask on the screen: the nudge card when core has one pending,
// else the button in "Get ready for January", and neither right after a "Not now".
// What they follow, one row each: a whole category, or an issue (R-018). Someone who picked categories at the start
// but skipped the issues sees those categories instead, each opening its page.
function myIssues(yr) {
  const rows = [];
  for (const c of S.cats.filter(c => S.catFollows.has(c.key))) rows.push({ lead: c.icon, title: `All of ${c.name}`, sub: 'Every issue in it, and new ones', href: `#/find/category/${c.key}` });
  for (const i of followedIssues().filter(i => S.issueFollows.has(i.id) && !i.categories.some(k => S.catFollows.has(k)))) {
    const ids = issueBills(i), nb = ids.length, law = ids.filter(id => anyBill(id)?.stage === 'enacted').length;   // a win shows on the row (R-067)
    // The outlook says whether the issue is alive (R-067: "7 bills in 2026" did not); staff edit it in Staff v2.
    rows.push({ lead: catOf(i.category)?.icon || 'heart-pulse', title: i.name, sub: i.outlook || (nb ? `${plural(nb, 'bill')} in ${yr}${law ? ` · ${law} became law` : ''}` : ''), href: `#/issue/${i.slug}` });
  }
  if (!rows.length) for (const k of wiz().issues || []) { const c = catOf(k); if (c) rows.push({ lead: c.icon, title: c.name, sub: 'Pick the issues to follow', href: `#/find/category/${c.key}` }); }
  return rows;
}
const issueRow = r => row({ lead: r.lead, title: esc(r.title), sub: esc(r.sub), href: r.href });
// The session in one sentence, for the recap on Home between sessions and the session page (R-046): what they did and
// what came of it, wins first. "Moved forward" is only said of a bill that got somewhere. One that passed a committee and
// then stopped reads "passed the committee you spoke to" (the old "2 moved forward" sat above two rows that said "stopped").
const RMOM_KEY = 'hiphi_recap_moment';
const recapMomentSeen = yr => { try { return localStorage.getItem(RMOM_KEY) === String(yr); } catch { return true; } };   // private mode: never, rather than every visit
function recapSaid(acts, acted, followed, yr) {
  const count = (a, f) => a.filter(f).length;
  // The Governor's desk is a stage, not a tone: in session a committee's yes is 'up' too (R-046's session page said "3
  // reached the Governor's desk" of three committee votes), so those count as "passed the committee you spoke to".
  const gov = x => (x.b.stage === 'governor' || x.b.stage === 'ballot') && sideOf(x.b) !== 'against';
  const aLaw = count(acted, x => x.tone === 'law'), aGov = count(acted, gov), aPassed = count(acted, x => x.moved && !gov(x) && (x.tone === 'stop' || x.tone === 'up'));
  const fLaw = count(followed, x => x.tone === 'law'), fGov = count(followed, gov);
  const wins = (law, gov, passed) => list([law && `${n(law)} became law`, gov && `${n(gov)} reached the Governor’s desk`, passed && `${n(passed)} passed the committee you spoke to`]);
  return acts.length
    ? `You took ${plural(acts.length, 'action')} on ${plural(acted.length, 'bill')}.${aLaw || aGov || aPassed ? ` ${cap(wins(aLaw, aGov, aPassed))}.` : ''} Mahalo for speaking up.${fLaw ? ` ${plural(fLaw, 'more bill')} on your issues became law.` : ''}`
    : fLaw || fGov ? `${list([fLaw && `${plural(fLaw, 'bill')} on your issues became law`, fGov && `${n(fGov)} ${fLaw ? '' : fGov === 1 ? 'bill on your issues ' : 'bills on your issues '}reached the Governor’s desk`])}.`
    : `You followed ${plural(followed.length, 'bill')} in ${yr}. ${followed.length === 1 ? 'It' : 'They'} stopped for this session. Many bills come back the next year.`;
}
function offView(si) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1, welcome = welcomed();
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  const days = next ? Math.max(0, Math.round((hiT(next) - hiT(hstDay(Date.now()))) / 864e5)) : 0;
  const acts = myActions().filter(a => a.year === yr || (!a.year && anyBill(a.bill_id)?.session_year === yr));
  // The recap leads with the wins: became law, then moved forward, then the rest. Bills acted on come before bills
  // only followed (the sort is stable).
  const RANK = { law: 0, up: 1, wait: 2, on: 2, stop: 3 };
  const acted = impacts(acts), followed = followedRows(yr, new Set(acted.map(x => x.b.id)));
  const rows = [...acted, ...followed].sort((p, q) => RANK[p.tone] - RANK[q.tone] || !!q.moved - !!p.moved);
  const said = recapSaid(acts, acted, followed, yr);
  // The session's end, once (R-046): someone who acted on bills that session gets the full-screen moment, their session in a
  // sentence, the peak at the end (C-7), the first time Home shows them the session as over. wire() shows it.
  S.hmRecapMoment = acted.length && !welcome && !recapMomentSeen(yr) ? { yr, said } : null;
  const mine = myIssues(yr), lists = (S.lists || []).filter(l => S.listFollows?.has(l.id)), known = districtsKnown();
  const nothingYet = !rows.length && !mine.length && !lists.length;
  const nudgeHtml = S.nudge ? nudgeCard(S.nudge) : '';
  const askBtn = !S.session && !S.nudge && !S.nudgedThisVisit && !alertsGiven();
  const lede = `${welcome ? `The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}. When it opens,` : `${opens ? `The ${nextYr} session opens ${esc(opens)}. ` : ''}When hearings start,`} HIPHI’s ${nextYr} bills${mine.length ? ' for your issues' : ''} will show up here, with simple ways to help.`;
  // One real thing to do between sessions (R-067): lawmakers shape next session's bills now, and a hello from their
  // own district is what they notice. The legislators page already writes it ("I am writing to introduce myself").
  const ready = known ? [`Say aloha before ${nextYr}`, `Lawmakers are writing their ${nextYr} bills now. A short hello from someone in their district tells them what you care about. It takes about 2 minutes.`]
    : ['Get ready for January', known ? 'Get a text or email when a bill on your issues has a hearing.'
      : askBtn ? 'Know who represents you, and get a text or email when a bill on your issues has a hearing. Each takes under a minute.' : 'Know who represents you before the first hearing. It takes 30 seconds.'];
  // The saved issues and followed lists, named, with a way to change them. They sit under the recap's neighbour when
  // there is a recap (so the two columns stay even), else they lead the page: they are what the person just set up.
  const setup = `${mine.length ? `<section class="hm-sec" aria-labelledby="hm-mi"><div class="hm-sechead"><h2 id="hm-mi">Your issues</h2>${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', href: '#/start/1', attrs: { 'aria-label': 'Edit your issues' } })}</div>
      <div class="rows">${mine.map(issueRow).join('')}</div></section>` : ''}
    ${lists.length ? `<section class="hm-sec" aria-labelledby="hm-ml"><h2 id="hm-ml">Lists you follow</h2>
      <div class="rows">${lists.map(l => row({ lead: issueIcon(l.icon, 'list'), title: esc(l.title), sub: `HIPHI’s ${nextYr} bills will show up here as they are added.`, href: `#/list/${encodeURIComponent(l.slug)}` })).join('')}</div></section>` : ''}`;
  // The version that ends on Home (R-098): the first visit's last moment happens here, "What you can do right now" is the
  // top of the page (between sessions, the one useful thing: a hello to their legislators), and the tips follow.
  const v2 = welcome && !!wiz().finale && endHome(), anim = v2 && finNow() && !S.hmFinDrawn;
  const readyCard = `<section class="card hm-ready" aria-labelledby="hm-rd"><${v2 ? 'h3' : 'h2'} id="hm-rd">${ready[0]}</${v2 ? 'h3' : 'h2'}>
        <p class="muted">${ready[1]}</p>
        <div class="btncol">${btn(known ? 'Write to my legislators' : 'Find my legislators', { kind: nothingYet ? 'secondary' : 'primary', icon: known ? 'mail' : 'landmark', href: '#/legislators' })}
          ${askBtn ? btn('Get hearing alerts', { kind: 'secondary', icon: 'bell', href: '#/alerts' }) : ''}
          ${!nothingYet && !mine.length ? btn('Pick the issues I care about', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' }) : ''}</div></section>`;
  const daysChip = next ? `<div class="chips">${chip(days === 0 ? 'Opens today' : `${plural(days, 'day')} to go`, 'info', 'calendar-days')}</div>` : '';
  const v2lede = `This is your home page. The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}; then what you can do on your issues shows up here, with what to do and by when.`;
  return `<div class="hm hm-off${v2 ? ' hm-fin2' : ''}${anim ? ' hm-anim' : ''}">
    ${accountCards()}${welcome ? '' : sinceStrip()}
    ${v2 ? `<header class="hm-head hm-break hm-finhead"><div class="hm-art">${anim ? CAPITOL.replace(/<circle ([^>]*fill="var\(--o400\)"[^>]*)\/>/, '<circle class="st-sun" $1/>') : CAPITOL}</div>
      <div class="hm-breakt">${finHead({ off: true, lede: v2lede })}${daysChip}</div></header>`
    : `<header class="hm-head hm-break"><div class="hm-art">${CAPITOL}</div>
      <div class="hm-breakt"><h1 class="hero">${welcome ? `${wiz().finale ? 'Aloha' : `You’re all set for ${nextYr}`}${(wiz().name || '').trim() ? `, ${esc(wiz().name.trim())}` : ''}` : 'The Legislature is on break'}</h1>
        <p class="lede">${lede}</p>
        ${daysChip}</div></header>`}
    <div class="cols even"><div class="hm-col">
      ${v2 ? `<section class="hm-rightnow" aria-labelledby="hm-rn"><h2 id="hm-rn" class="hm-rnh">What you can do right now</h2>${readyCard}</section>` : ''}
      ${rows.length ? `<section class="card hm-recap" aria-labelledby="hm-rc"><div class="hm-recaphead"><h2 id="hm-rc">Your ${yr} session</h2><div class="hm-isl">${islands(myIsland())}</div></div>
        <p>${esc(said)}</p>
        ${chipsHtml(milestoneState(acts).got)}
        <h3 class="hm-label">What happened</h3>${impList(rows, 3)}
        ${btn(`See your whole ${yr} session`, { kind: 'text', iconEnd: 'chevron-right', href: '#/recap', cls: 'hm-link' })}</section>` : setup}
      ${nothingYet ? `<section class="card hm-ready" aria-labelledby="hm-st"><h2 id="hm-st">Start with what you care about</h2>
        <p class="muted">Pick a few health issues now. When the session opens, HIPHI’s bills for them will be waiting here.</p>
        <div class="btncol">${btn('Pick the issues I care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}</div></section>` : ''}
    </div><div class="hm-col">
      ${v2 ? '' : readyCard}
      ${winsCard(yr)}
      ${meetCard()}
      ${newIssuesCard()}
      ${nudgeHtml}
      ${rows.length ? setup : ''}
      ${btn(`Read HIPHI’s ${yr} Legislative Recap`, { kind: 'text', iconEnd: 'external-link', href: 'https://www.hiphi.org/policy/legrecap', cls: 'hm-link', attrs: { target: '_blank', rel: 'noopener' } })}
    </div></div>
  </div>`;
}

// ---------------- the session page, #/recap (R-046, Nate 9/30: "Personal session recap") ----------------
// One page for the person's session: what they did, what came of it, their moments, the bills they followed and their
// issues. In session it reads "so far"; between sessions it is the session that ended. Private: it reads only this
// device's marks and the person's own account. Reached from "Your session" on Home and from More. Opening it is counted
// privately, kind only ('recap', migration 106), once a visit.
const KIND_LABEL = { testimony: ['testimony sent', 'testimonies sent'], email: ['email to a committee chair', 'emails to committee chairs'],
  legislators: ['email to your legislators', 'emails to your legislators'], attend: ['hearing you went to', 'hearings you went to'], share: ['bill you shared', 'bills you shared'] };
function recapView() {
  const si = sessionInfo(), so = si.phase === 'in', yr = so ? si.yr : si.recapYear;
  const acts = myActions().filter(a => a.year === yr || (!a.year && anyBill(a.bill_id)?.session_year === yr));
  // "I plan to go" counts as going once the hearing has started (as the milestones do).
  const real = acts.filter(a => a.kind !== 'attend' || (h => h && new Date(h.scheduled_at) <= Date.now())(anyHearing(a.hearing_id)));
  const RANK = { law: 0, up: 1, wait: 2, on: 2, stop: 3 };
  // One list of what happened, wins first (the review 9/30: a separate "Good news" list said the same results twice, A-14).
  const acted = impacts(acts).sort((p, q) => RANK[p.tone] - RANK[q.tone]), followed = followedRows(yr, new Set(acted.map(x => x.b.id))).sort((p, q) => RANK[p.tone] - RANK[q.tone]);
  const mine = myIssues(yr), stands = Object.entries(S.stances || {}).filter(([id, v]) => (v === 'support' || v === 'oppose') && (b => !b || !b.session_year || b.session_year === yr)(anyBill(id))).length;
  const said = acts.length || !so ? recapSaid(acts, acted, followed, yr)
    : followed.length ? `You follow ${plural(followed.length, 'bill')} this session. When one has a hearing, a simple way to help shows up on Home.` : '';
  const stat = (k, [one, many]) => k ? `<li><span class="hm-stat"><b>${n(k)}</b><span>${k === 1 ? one : many}</span></span></li>` : '';
  // What they follow, counted as Home counts it: issues first, else bills (the review 9/30 found "14 bills" here and "2
  // issues" on Home for the same person).
  const nIss = followedIssues().length, nFol = nIss || S.bills.filter(b => !b.session_year || b.session_year === yr).length;
  const stats = [...KINDS.map(k => stat(real.filter(a => a.kind === k).length, KIND_LABEL[k])), stat(stands, ['stand taken', 'stands taken']),
    stat(nFol, nIss ? ['issue followed', 'issues followed'] : ['bill followed', 'bills followed'])].join('');
  const ms = milestoneState(acts);
  const nothing = !acts.length && !followed.length && !mine.length;
  if (!S.recapLogged) { S.recapLogged = true; logAct('recap'); }
  return `<div class="hm hm-rcp">
    <a class="fd-back" href="#/" data-back>${icon('arrow-left')}<span>Home</span></a>
    <header class="hm-head hm-rcphead"><h1 class="hero hm-rcph">${flower(28)}<span>Your ${yr} session${so ? ' so far' : ''}</span></h1>${said ? `<p class="lede">${esc(said)}</p>` : ''}</header>
    ${nothing ? `<section class="card hm-ready"><h2>Your session adds up here</h2><p class="muted">Follow the issues you care about. When their bills have hearings, what you do and what comes of it is kept here, for you only.</p>
      <div class="btncol">${btn('Pick the issues I care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}</div></section>` : `
    ${stats ? `<ul class="hm-stats hm-rcpstats">${stats}</ul>` : ''}
    ${ms.got.length ? `<section class="hm-sec" aria-labelledby="hm-rcp-ms"><h2 id="hm-rcp-ms">Milestones</h2>${chipsHtml(ms.got)}</section>` : ''}
    ${acted.length ? `<section class="card hm-sec" aria-labelledby="hm-rcp-imp"><h2 id="hm-rcp-imp">What happened after you acted</h2>${impList(acted, 6)}</section>` : ''}
    ${followed.length ? `<section class="card hm-sec" aria-labelledby="hm-rcp-fol"><h2 id="hm-rcp-fol">Bills you followed</h2><div class="hm-imps">${followed.map(impRow).join('')}</div></section>` : ''}
    ${mine.length ? `<section class="hm-sec" aria-labelledby="hm-rcp-iss"><h2 id="hm-rcp-iss">Your issues</h2><div class="rows">${mine.map(issueRow).join('')}</div></section>` : ''}`}
    ${so ? '' : btn(`Read HIPHI’s ${yr} Legislative Recap`, { kind: 'text', iconEnd: 'external-link', href: 'https://www.hiphi.org/policy/legrecap', cls: 'hm-link', attrs: { target: '_blank', rel: 'noopener' } })}
  </div>`;
}

// ---------------- what HIPHI helped pass (R-067: between sessions, lead with the wins) ----------------
// The proof that speaking up works, for the months when nothing is moving: last session's laws HIPHI backed, a few by
// name, and the earlier wins Nate listed (core.js EARLIER_WINS).
function winsCard(yr) {
  const w = winsIn(yr); if (!w) { ensureRecapPool(yr); return ''; }
  if (!w.length && !EARLIER_WINS.length) return '';
  const named = w.filter(b => nick(b)).slice(0, 3), rest = w.length - named.length;
  const byYear = [...new Set(EARLIER_WINS.map(x => x.year))].sort((a, b) => b - a);
  return `<section class="card hm-wins" aria-labelledby="hm-wins-h"><h2 id="hm-wins-h">${flower(22)}<span>What HIPHI helped pass</span></h2>
    ${w.length ? `<p class="hm-winsn"><b>${n(w.length)} ${w.length === 1 ? 'bill' : 'bills'}</b> HIPHI backed became law in ${yr}.</p>
      <ul class="hm-winsl">${named.map(b => `<li><a href="${billPath(b)}">${esc(nick(b))}</a></li>`).join('')}${rest > 0 ? `<li class="muted">and ${n(rest)} more</li>` : ''}</ul>` : ''}
    ${byYear.map(y => `<p class="hm-winsy">In ${y}</p><ul class="hm-winsl">${EARLIER_WINS.filter(x => x.year === y).map(x => `<li>${esc(x.text)}${x.bill ? ` <span class="muted">(${esc(x.bill)})</span>` : ''}</li>`).join('')}</ul>`).join('')}
    <p class="small muted">People who spoke up helped make these happen.</p></section>`;
}

// ---------------- Meet HIPHI (R-067; staff post it in Staff v2, Make a link) ----------------
// The next HIPHI event or training, when staff have posted one: people who meet the team come back. Asked once per
// visit; nothing shows when there is none or the request fails. The sandbox shows a sample, labelled.
function meetCard() {
  if (S.meetCard === undefined) {
    S.meetCard = null;
    (DEMO ? Promise.resolve([{ kind: 'meet', title: 'Meet HIPHI at the Keiki Health Fair (sample)', body: 'Saturday, Oct 18, 9 to 1, at Kapiʻolani Park. Come say aloha and learn how to speak up in January.', link_url: 'https://www.hiphi.org', link_label: 'See the event' }])
      : supa().then(sb => sb.from('public_site_cards').select('*')).then(r => r.data || []))
      .then(rows => { S.meetCard = rows.find(r => r.kind === 'meet') || false; if (S.meetCard) app.render(); }).catch(() => { S.meetCard = false; });
    return '';
  }
  const c = S.meetCard; if (!c) return '';
  return `<section class="card hm-meet" aria-labelledby="hm-meet-h"><h2 id="hm-meet-h">${icon('calendar-days')}<span>${esc(c.title)}</span></h2>
    ${c.body ? `<p class="small">${esc(c.body)}</p>` : ''}
    ${c.link_url ? btn(esc(c.link_label || 'Learn more'), { kind: 'text', sm: true, iconEnd: 'external-link', href: c.link_url, attrs: { target: '_blank', rel: 'noopener' } }) : ''}</section>`;
}

// ---------------- a new issue in a category they partly follow (R-018, Nate's answer 3, 9/21) ----------------
// Shown once, on Home, with a one-tap Follow; never followed for them. "Seen" is what this browser knew last time:
// the first visit knows everything, so only issues HIPHI takes up later ever count as new.
const SEEN_KEY = DEMO ? 'hiphi_seen_issues_demo' : 'hiphi_seen_issues';
function newIssues() {
  if (S.hmNew) return S.hmNew;   // worked out once per visit, so the note stays until they act on it or leave
  let seen = null; try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { /* private mode */ }
  const known = new Set(seen || S.issues.map(i => i.id));
  const partly = new Set(S.issues.filter(i => S.issueFollows.has(i.id)).flatMap(i => i.categories));
  S.hmNew = seen ? S.issues.filter(i => !known.has(i.id) && !issueFollowed(i) && i.categories.some(c => partly.has(c) && !S.catFollows.has(c))) : [];
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(S.issues.map(i => i.id))); } catch { /* private mode */ }
  return S.hmNew;
}
function newIssuesCard() {
  const list = newIssues().filter(i => !issueFollowed(i)).slice(0, 3); if (!list.length || !S.cats.length) return '';
  const cat = catOf(list[0].categories.find(c => S.issues.some(x => S.issueFollows.has(x.id) && x.categories.includes(c))) || list[0].category);
  return `<section class="card hm-newiss" aria-labelledby="hm-ni"><h2 id="hm-ni">${list.length === 1 ? 'A new issue' : 'New issues'} in ${esc(cat?.name || 'your issues')}</h2>
    <p class="muted small">HIPHI just took ${list.length === 1 ? 'it' : 'them'} up. Follow ${list.length === 1 ? 'it' : 'any'} if you like.</p>
    <ul class="hm-newlist" role="list">${list.map(i => `<li><a class="hm-newname" href="#/issue/${esc(i.slug)}">${esc(i.name)}</a>
      ${btn('Follow', { kind: 'secondary', sm: true, icon: 'star', attrs: { 'data-hm-newfollow': i.id, 'aria-label': `Follow ${i.name}` } })}</li>`).join('')}</ul>
    ${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-hm-newdone': '1' } })}</section>`;
}

// ---------------- for version A's Home (the layout test, R-187) ----------------
// The test compares how Home is arranged, not what it offers: version A (pub/a/home.js) draws these cards from today's
// Home too, so a person on it still gets the account cards after a sign-in (the email choices, the address), a saved
// letter, a new issue in a category they follow, keeping the tracker on their phone and Meet HIPHI. wireExtras wires them
// and a first-visit plan's next small thing (onb-later.js), on either Home.
export const extras = { account: () => accountCards(), draft: skip => draftsCard(skip), newIssues: () => newIssuesCard(), phone: () => homeScreenCard(), meet: () => meetCard() };
export function wireExtras(root) {
  wireLater(root, () => app.render());
  try { more?.wireAccountCards?.(); } catch (e) { console.error(e); }
  root.querySelector('[data-hm-hsno]')?.addEventListener('click', () => { try { localStorage.setItem('hiphi_hs_no', '1'); } catch { /* ignore */ } app.render(); });
  root.querySelector('[data-hm-hsgo]')?.addEventListener('click', async () => { const p = S.installPrompt; if (!p) return; S.installPrompt = null; try { p.prompt(); await p.userChoice; } catch { /* ignore */ } app.render(); });
  root.querySelectorAll('[data-hm-newfollow]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.hmNewfollow); if (!i) return;
    if (await setFollows({ issuesOn: [i.id] })) { toast(`Following ${i.name}`, { yay: true, undo: async () => { await setFollows({ issuesOff: [i.id] }); app.render(); } }); app.render(); }
  });
  root.querySelectorAll('[data-hm-newdone]').forEach(el => el.onclick = () => { S.hmNew = []; app.render(); });
}

// wide.css keeps the side column in view under the header. When the column is taller than the window, a sticky top
// would leave its lower part (What's new, the suggestion) out of reach until the main column ends, so it sticks by
// its bottom edge instead.
function fitSide() {
  const side = document.querySelector('#main .hm .cols > .hm-side'); if (!side) return;
  const hdr = document.querySelector('.hdr')?.offsetHeight || 64, h = side.offsetHeight;
  side.style.top = window.matchMedia('(min-width: 1100px)').matches && h > window.innerHeight - hdr - 48 ? `${window.innerHeight - h - 24}px` : '';
}
let sideWatch = null;
window.addEventListener('resize', fitSide);

// ---------------- the screen ----------------
export default {
  tab: 'home',
  title: route => route?.name === 'recap' ? 'Your session' : 'Home',
  render(route) {
    if (!S.featured || !S.pool) return skeleton(4);
    if (route?.name === 'recap') return recapView();
    // A fresh arrival on Home (not a re-render after a tap) decides which Home to show and notes what was already
    // done. Re-renders keep the same shape, so following the first bill from "explore" does not swap the page under
    // the person's finger.
    const fresh = !document.querySelector('#main .hm');
    const si = sessionInfo();
    if (fresh) {
      S.hmSug = null; S.hmArrived = new Set(S.done || []);
      S.hmMode = si.phase !== 'in' ? 'off' : S.watch.size ? 'follow' : 'explore';
      // First visit, email step skipped: Home asks once, inline (nudge() keeps core's one-per-visit and "Not now" rules).
      if (S.hmMode === 'follow' && welcomed() && !S.nudge && !S.session && !alertsGiven()) nudge('follow');
    }
    const mode = si.phase !== 'in' ? 'off' : S.hmMode === 'explore' || !S.watch.size ? 'explore' : 'follow';
    S.hmLoopB = new Set();   // the bills "What you did" names on this drawing (loopCard); none until it is drawn
    const html = mode === 'off' ? offView(si) : mode === 'explore' ? exploreView() : followView(si);
    // A first-visit plan's next small thing, one per visit (R-164, pub/onb-later.js): at the top between sessions, when
    // nothing is due; in session under Home's own content, so it never pushes a live deadline down (A-1, A-13).
    const later = laterCard();
    if (!later) return html;
    return si.phase !== 'in' ? html.replace(/^(\s*<div class="hm[^"]*">)/, `$1${later}`) : html.replace(/<\/div>\s*$/, `${later}</div>`);
  },
  wire() {
    const root = document.querySelector('#main .hm'); if (!root) return;
    wireActions(root); wireNudge(root); wireShareLine(root); wireKeepLine(root); wireExtras(root);
    // Lists open in place without a redraw, so keyboard focus stays on the button that opened them.
    root.querySelectorAll('[data-hm-toggle]').forEach(el => el.onclick = () => {
      const box = document.getElementById(el.getAttribute('aria-controls')); if (!box) return;
      const on = S.hmOpen[el.dataset.hmToggle] = !S.hmOpen[el.dataset.hmToggle];
      box.hidden = !on; el.setAttribute('aria-expanded', on ? 'true' : 'false');
      el.innerHTML = `<span>${esc(on ? el.dataset.less : el.dataset.more)}</span>${icon(on ? 'chevron-up' : 'chevron-down')}`;
      fitSide();
    });
    const fold = root.querySelector('.hm-fold'); if (fold) fold.ontoggle = () => { S.hmOpen.fold = fold.open; };
    // A bill opened from here to act on it ("See how to help", a row of things to do): its page's tour waits for them to
    // ask for it, so it never covers the button they came for (X10-4; core.js billTourHeld).
    root.querySelectorAll('[data-hm-act]').forEach(el => el.addEventListener('click', () => { S.toAct = true; }));
    // The story of the bill, offered once to someone who acted from a link and came straight here (X10-2): opened, it goes.
    root.querySelector('[data-hm-learn]')?.addEventListener('click', () => wizSet({ viaLearned: true }));
    finFx();
    // A result on a hearing they acted on, seen for the first time: the small burst, once (sinceStrip).
    const yb = S.hmBurst && root.querySelector('.hm-youburst .lead');
    if (yb) { burst(yb); const seen = resultsSeen(); seen.add(S.hmBurst); try { localStorage.setItem(RSEEN_KEY, JSON.stringify([...seen].slice(-300))); } catch { /* private mode */ }
      if (String(S.hmBurst).includes(':')) S.hmBursted = S.hmBurst; S.hmBurst = null; }
    // New moments (R-046): seen from now on (they stay on Home for this visit), counted privately by kind only, and a law
    // gets the full-screen moment, the biggest there is (C-7).
    const ms = S.hmMoments || []; S.hmMoments = null;
    const law = ms.find(x => x.law);
    if (ms.length) {
      const m = momentsSeen(); ms.forEach(x => { m.add(x.moment); S.hmShown.add(x.moment); logAct('moment'); });
      try { localStorage.setItem(MSEEN_KEY, JSON.stringify([...m].slice(-500))); } catch { /* private mode: shown again next visit */ }
      if (law) setTimeout(() => celebrate({ title: `A bill you spoke up for ${isResolution(law.b) ? 'was adopted' : 'became law'}`, sub: `${nick(law.b) || spaced(law.b.bill_number)}. Mahalo for speaking up.`, go: 'Continue' }), 400);
    }
    // One full-screen moment a visit: a law first; the session's end waits for the next visit then.
    const rm = S.hmRecapMoment; S.hmRecapMoment = null;
    // Only its main button opens the session page; Not now, Escape and a tap outside stay on Home (B-4, the review 9/30).
    if (rm && !law) { try { localStorage.setItem(RMOM_KEY, String(rm.yr)); } catch { /* private mode */ }
      let go = false;
      setTimeout(() => { celebrate({ title: `The Legislature’s ${rm.yr} session is over`, sub: rm.said, go: 'See your session', alt: { label: 'Not now', act: () => {} } },
        () => { if (go) app.go('#/recap'); });
        document.getElementById('fx-mgo')?.addEventListener('click', () => { go = true; }, { capture: true }); }, 400); }
    fitSide();
    const side = root.querySelector('.cols > .hm-side');
    if (side && window.ResizeObserver) { sideWatch?.disconnect(); sideWatch = new ResizeObserver(fitSide); sideWatch.observe(side); }
  },
};
