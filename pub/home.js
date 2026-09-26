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
import { S, DEMO, HST, esc, icon, nick, headline, blurb, spaced, billPath, alive, issues, issueOf, openActions, waitingBills, askedChair,
  actedOn, settledOn, didKind, agrees, doneKey, KINDS, dismissed, recommendations, wiz, groupNames, sessionInfo, myActions, MILESTONES,
  nudge, CONSENT_KEY, countOk, anyBill, anyHearing, outcomeOf, plainStatus, whyStopped, cmteLabel, codesOf, CHAMBER_NAME,
  issueIcon, chairContacts, dueInfo, hearingText, dayWord, timeWord, dateLong, hstDay, hiT, pickedTopic, followSummary, followedIssues,
  issueFollowed, issueBills, catOf, setFollows, app, toast, roomLabel } from './core.js';
import { btn, chip, posChip, row, empty, skeleton } from './ui.js';
import { actionCard, wireActions, nudgeCard, wireNudge } from './actions.js';
import { CAPITOL, islands, flower } from './art.js';
// A namespace import, so Home still loads while More is being built (a named import of a missing export would
// stop the whole page from loading).
import * as more from './more.js';

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
// An email was already given (the guided start's email step, or the sign-in page) and is waiting for its link to be
// opened. Home does not ask again.
const emailGiven = () => { try { return !!(sessionStorage.getItem('hiphi_link_sent') || localStorage.getItem(CONSENT_KEY)); } catch { return false; } };
const accountCards = () => { try { return more.accountCardsHTML ? more.accountCardsHTML() || '' : ''; } catch (e) { console.error(e); return ''; } };

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
  const now = Date.now();
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
    const [tone, text, moved] = resultOf(b, hs, x.kinds.has('testimony'));
    return { b, tone, did: `You ${list(v)}.`, text, moved };
  }).filter(Boolean);
}
function resultOf(b, hs, testified) {
  const kept = testified ? ' Your testimony stays on the record.' : '';
  if (b.stage === 'enacted') return ['law', 'It became law. Mahalo for your part in it.'];
  if (b.stage === 'vetoed') return ['stop', `The Governor vetoed it.${kept}`];
  if (b.stage === 'governor') return ['up', 'It passed the House and Senate and is on the Governor’s desk.', true];
  const now = Date.now(), h = hs.find(x => new Date(x.scheduled_at) <= now) || hs[0], o = h && new Date(h.scheduled_at) <= now ? outcomeOf(h) : null;
  const passed = o && /passed/.test(o.outcome || '');
  if (!alive(b)) {
    const held = /deferred/i.test(b.last_action || '');
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
function followedRows(yr, skip) {
  return S.bills.filter(b => !skip.has(b.id) && S.direct.has(b.id) && (!b.session_year || b.session_year === yr)).map(b => {
    const did = 'You followed it.';
    if (b.stage === 'enacted') return { b, tone: 'law', did, text: 'It became law.' };
    if (b.stage === 'governor') return { b, tone: 'up', did, text: 'It passed the House and Senate and is on the Governor’s desk.' };
    if (b.stage === 'vetoed') return { b, tone: 'stop', did, text: 'The Governor vetoed it.' };
    return alive(b) ? { b, tone: 'wait', did, text: plainStatus(b).text } : { b, tone: 'stop', did, text: whyStopped(b) };
  });
}
const MARKS = { up: 'circle-check', wait: 'hourglass', stop: 'archive' };
// A result row opens the bill. It leads with the bill's everyday name when staff have written one; the number
// always shows.
const impRow = x => `<a class="hm-imp" href="${billPath(x.b)}"><span class="hm-mark t-${x.tone}">${x.tone === 'law' ? flower(22) : icon(MARKS[x.tone])}</span>
  <span class="hm-impb"><span class="hm-impt">${esc(nick(x.b) || blurb(x.b, 200))}</span><span class="hm-impr"><b>${esc(spaced(x.b.bill_number))}</b> · ${esc(x.did)} ${esc(x.text)}</span></span>${icon('chevron-right', { cls: 'hm-chev' })}</a>`;
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
  const todo = MILESTONES.filter(m => m[0] !== 'law' && !has(m));
  const next = todo.find(m => COUNT[m[0]] && COUNT[m[0]][0] / COUNT[m[0]][1] >= 0.3) || todo[0] || null;
  return { got: MILESTONES.filter(has), next, count: next ? COUNT[next[0]] || null : null };
}
const chipsHtml = got => got.length ? `<ul class="chips hm-chips" aria-label="Milestones you have reached">${got.map(([, t, d]) => `<li class="chip yay" title="${esc(cap(d))}">${flower(16)}${esc(t)}</li>`).join('')}</ul>` : '';
function nextHtml(ms) {
  if (!ms.next) return '';
  const [, t, d] = ms.next, c = ms.count;
  return `<div class="hm-next"><p class="hm-nexthead"><span>Next: <b>${esc(t)}</b></span>${c ? `<span class="hm-nextn">${c[0]} of ${c[1]}</span>` : ''}</p>
    ${c ? `<div class="hm-bar" aria-hidden="true"><i style="width:${Math.max(4, Math.round(c[0] / c[1] * 100))}%"></i></div>` : ''}
    <p class="meta">${esc(cap(d))}.</p></div>`;
}

// One dot per week of the session, filled when you acted that week. Empty weeks simply stay empty: hearings come
// in bursts and nobody owes the Legislature a streak. Weeks run Monday to Sunday, Hawaiʻi time.
// Fix (walkthrough 9/18): the old dots compared against Monday noon, so an action on Monday morning left the
// current week "ahead" and grey. A week is ahead only when it is not the current week and starts after now.
function weeks(si, mine) {
  const monday = t => { const d = hstDay(t), dow = new Date(d + 'T12:00:00-10:00').getUTCDay(); return hiT(d) - ((dow + 6) % 7) * 864e5; };
  const now = Date.now(), H12 = 12 * 36e5, W = 7 * 864e5, dots = [];
  let k = 0;
  for (let w = monday(hiT(si.open)); w <= hiT(si.end); w += W) {
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
function sessionPanel(si, { welcome = false } = {}) {
  const all = myActions(), mine = all.filter(a => !a.year || a.year === si.yr);
  const thisYear = b => !b || !b.session_year || b.session_year === si.yr;
  // Issues first (R-018): what the person follows is issues; a follower of single bills only still sees their bills.
  const nIss = followedIssues().length, follows = nIss || S.bills.filter(thisYear).length;
  const stands = Object.entries(S.stances || {}).filter(([id, v]) => (v === 'support' || v === 'oppose') && thisYear(anyBill(id))).length;
  const ms = milestoneState(all), rows = impacts(mine);
  const stat = (k, label, href) => !k ? '' : href ? `<li><a class="hm-stat" href="${href}" data-hm-stat="bills"><b>${n(k)}</b><span>${label}${icon('chevron-right')}</span></a></li>` : `<li><span class="hm-stat"><b>${n(k)}</b><span>${label}</span></span></li>`;
  const calmNext = ms.next && ['follow', 'stance'].includes(ms.next[0]);
  return `<section class="card hm-panel" aria-labelledby="hm-ys"><h2 id="hm-ys" class="hm-ptitle">${flower(24)}<span>Your ${si.yr} session</span></h2>
    <ul class="hm-stats">${stat(follows, nIss ? (follows === 1 ? 'issue followed' : 'issues followed') : (follows === 1 ? 'bill followed' : 'bills followed'), '#/bills')}${stat(stands, stands === 1 ? 'stand taken' : 'stands taken')}${stat(mine.length, mine.length === 1 ? 'action' : 'actions')}</ul>
    ${mine.length ? weeks(si, mine) : `<p class="muted small">${welcome ? 'Your progress adds up here through the session.' : 'Your first action will show up here, with what happened after it.'}</p>`}
    ${welcome ? '' : chipsHtml(ms.got)}
    ${!welcome || calmNext ? nextHtml(ms) : ''}
    ${!welcome && S.nudge === 'action' ? nudgeCard('action') : ''}
    ${rows.length ? `<h3 class="hm-label">What happened after you acted</h3>${impList(rows, 2)}` : ''}
    ${DEMO && S.demoSeeded ? '<p class="meta">Sandbox: three sample actions are filled in so this panel has something to show.</p>' : ''}
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
    <div class="btncol">${btn(`Ask the ${chairs} for a hearing`, { kind: primary ? 'primary' : 'secondary', icon: 'mail', full: true, href: billPath(b), attrs: { 'data-hm-ask': b.bill_number } })}</div>
  </article>`;
}
// Past the first two, things to do are one line each and open the bill page, where the same action lives. Fourteen
// full cards made Home a 7,000px wall on a phone and 5,600px on a laptop (assessment 9/19).
const actRow = x => { const d = dueInfo(x.h);
  return row({ lead: issueOf(x.b)?.icon || 'landmark', title: esc(headline(x.b, 200)), href: billPath(x.b),
    sub: `${esc(spaced(x.b.bill_number))} · <span class="hm-due${d?.tone ? ' ' + d.tone : ''}">${esc(d ? d.text : hearingText(x.h))}</span>` }); };
const askRow = ({ b, st }) => row({ lead: 'hourglass', title: esc(headline(b, 200)), href: billPath(b),
  sub: `${esc(spaced(b.bill_number))} · <span class="hm-due${st.deadline.days <= 7 ? ' warn' : ''}">${esc(daysLeft(st.deadline.days))}</span>` });
const moreRows = (id, rows) => `${toggle(id, 'hm-' + id, `Show ${rows.length} more`)}<div id="hm-${id}" class="rows hm-more"${S.hmOpen[id] ? '' : ' hidden'}>${rows.join('')}</div>`;
// Open actions first (two cards, then one line each), then up to two "ask the chair" cards. calm: inside the first
// visit's "Ready now?" fold, where no card is singled out.
function todoBlock(cards, asks, { nudgeHtml = '', calm = false } = {}) {
  const first = calm ? null : cards.find(x => !settledOn(x.b, x.h)), rest = cards.slice(2), arest = asks.slice(2);
  const card = x => actionCard(x.b, x.h, { focus: x === first });
  return `${cards.length ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Do this now</h2>
      ${cards.slice(0, 1).map(card).join('')}${nudgeHtml}${cards.slice(1, 2).map(card).join('')}
      ${rest.length ? moreRows('rest', rest.map(actRow)) : ''}</section>` : nudgeHtml}
    ${asks.length ? `<section class="hm-sec hm-asks" aria-labelledby="hm-asks-t"><h2 id="hm-asks-t">${asks.length === 1 ? 'A bill that needs a hearing' : 'Bills that need a hearing'}</h2>
      <p class="small hm-asksub">The committee chair decides which bills get a hearing. A short, polite note helps.</p>
      ${asks.slice(0, 2).map((x, i) => askCard(x, !cards.length && !i)).join('')}
      ${arest.length ? moreRows('asks', arest.map(askRow)) : ''}</section>` : ''}`;
}

// Why a suggestion is shown, in words (replaces the old "you follow X", which was wrong right after Step 1).
function reasonFor(b) {
  const picked = new Set((wiz().issues || []).flatMap(groupNames)), mine = new Set(S.bills.filter(x => x.id !== b.id).flatMap(x => x.coalitions || []));
  if (pickedTopic(b) || (b.coalitions || []).some(c => picked.has(c))) return 'Matches an issue you picked';
  if ((b.coalitions || []).some(c => mine.has(c))) return 'Similar to bills you follow';
  return /strongly/.test(b.hiphi_position || '') ? 'One of HIPHI’s top priorities' : '';
}
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
function pickSuggestion(skip) {
  const r = recommendations(12).find(x => x.kind === 'testify' && x.st?.hearing && !skip.has(x.b.id));
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
  const folded = all.filter(x => settledOn(x.b, x.h) && wasDone(x)), cards = all.filter(x => !folded.includes(x));
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
  // The suggestion sits in the side column, unless the main column would otherwise be empty (nothing to do): then it
  // is the one thing on offer and goes where things to do go. Decided by what is drawn, not by the count, so it does
  // not move when the person finishes their last card in place.
  const sugInMain = !cards.length && !asks.length;
  const sugHtml = sug ? `<section class="hm-sec" aria-labelledby="hm-sug"><h2 id="hm-sug">${sugInMain ? 'A bill that still needs voices' : 'Another bill that needs voices'}</h2>
      ${sugCard(sug.b, sug.h)}
      ${btn('More bills that need voices', { kind: 'text', iconEnd: 'chevron-right', href: '#/find', cls: 'hm-link' })}</section>` : '';
  return `<div class="hm hm-follow">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      <header class="hm-head"><p class="eyebrow">${esc(today)}</p><h1 class="hero">${esc(h1)}</h1>${quiet}</header>
      ${todoBlock(cards, asks, { nudgeHtml })}
      ${folded.length ? `<details class="hm-fold"${S.hmOpen.fold ? ' open' : ''}><summary><h2 class="hm-foldt">${icon('circle-check')}Done this week (${folded.length})</h2>${icon('chevron-down', { cls: 'hm-foldc' })}</summary>
        <div class="hm-foldb">${folded.map(x => actionCard(x.b, x.h)).join('')}</div></details>` : ''}
      ${sugInMain ? sugHtml : ''}
    </div><div class="side hm-side">
      ${newIssuesCard()}
      ${sessionPanel(si)}
      ${whatsNew(inCards)}
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
    return `<li><span class="hm-yname"><b>${esc(i.name)}</b><span>${live.length ? plural(live.length, 'bill') + ' moving' : 'Nothing moving yet'}</span></span>${day ? chip(new Date(day).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }), 'info', 'calendar') : ''}</li>`; }).join('');
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
  const ask = S.session || (emailGiven() && !S.nudgeSent) || !S.nudge ? '' : nudgeCard(S.nudge);
  const step = (ic, title, text) => `<li><span class="hm-stepic">${icon(ic)}</span><span><b>${title}</b> ${text}</span></li>`;
  // After the new first visit's last screen (R-023: "You're all set" and "What happens next" were just said there), Home
  // says aloha instead of repeating them (A-14), and the week's first hearing on their issues gets a quiet way in to
  // help (B-3: the lessons need somewhere to go). Nothing is pushed: the rest still waits behind one line.
  const fin = !!wiz().finale, name = (wiz().name || '').trim();
  const week = fin ? cards.filter(x => x.h && new Date(x.h.scheduled_at) > Date.now()).sort((a, b) => a.h.scheduled_at.localeCompare(b.h.scheduled_at))[0] : null;
  const due = week ? dueInfo(week.h) : null;
  const weekCard = week ? `<section class="card hm-week" aria-labelledby="hm-wk"><p class="hm-eyebrow">This week</p>
      <h2 id="hm-wk">${esc(spaced(week.b.bill_number))} has a hearing ${esc(dayWord(week.h.scheduled_at))}</h2>
      <p>${esc(nick(week.b) || blurb(week.b, 80))} · ${esc(timeWord(week.h.scheduled_at))} · ${esc(roomLabel(week.h.room))}.${due && !due.late ? ` ${esc(due.text)}${S.session ? '; we’ll remind you' : ''}.` : ''}</p>
      ${btn('See how to help', { kind: 'text', iconEnd: 'arrow-right', href: billPath(week.b), cls: 'hm-link' })}</section>` : '';
  const heading = fin ? `Aloha${name ? `, ${esc(name)}` : ''}` : name ? `You’re all set, ${esc(name)}` : 'You’re all set';
  const lede = fin ? `You follow ${esc(said)}${stood}. Here’s what’s happening on them this week.` : `You follow ${esc(said)}${stood}. That’s all you need to do today.`;
  return `<div class="hm hm-follow hm-welcome${fin ? ' hm-fin' : ''}">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      <header class="hm-head hm-hello">${flower(32)}<h1 class="hero">${heading}</h1>
        <p class="lede">${lede}</p>
        ${fin ? '' : chipsHtml(ms.got)}
        ${fin ? '' : btn('See my issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link' })}</header>
      ${weekCard}${fin ? yourIssues() : ''}
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
      ${sessionPanel(si, { welcome: true })}
      ${whatsNew(new Set())}
    </div>`}</div>
  </div>`;
}

// ---------------- in session, following nothing: explore (plan 3, "Skip path") ----------------
// On the first visit these are bills to follow, one line each, not cards with a "send an email" button: nothing is
// pushed on a first visit. After that the cards are the same as everywhere else.
const pickRow = x => { const on = S.watch.has(x.b.id), num = spaced(x.b.bill_number);
  return `<div class="hm-pick"><a class="hm-pickmain" href="${billPath(x.b)}"><span class="lead">${icon(issueOf(x.b)?.icon || 'landmark')}</span>
    <span class="body"><span class="title">${esc(headline(x.b, 200))}</span><span class="sub">${esc(num)} · Hearing ${esc(dayWord(x.h.scheduled_at))}</span></span></a>
    ${btn(on ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: 'star', cls: 'hm-star' + (on ? ' on' : ''), attrs: { 'data-follow': x.b.id, 'aria-pressed': on ? 'true' : 'false', 'aria-label': `${on ? 'Following' : 'Follow'} ${num}` } })}</div>`; };
function exploreView() {
  const f = S.featured || { bills: [], hearings: [] }, seen = new Set(), skip = dismissed(), calm = welcomed();
  const cards = openActions(f.bills, f.hearings).filter(x => !x.late && !skip.has(x.b.id) && !seen.has(x.b.id) && seen.add(x.b.id)).slice(0, calm ? 5 : 3);
  const nudgeHtml = S.nudge ? nudgeCard(S.nudge) : '';
  const cats = S.cats, lists = (S.lists || []).filter(l => l.is_published !== false);
  const lede = !cards.length ? 'No hearings are set on HIPHI’s bills yet this week. New ones usually post by Friday. Meanwhile, look around by issue.'
    : calm ? 'These bills have hearings soon. Follow one to keep an eye on it. When it needs a voice, we’ll show a simple way to help.'
    : 'These bills have hearings soon. Add your voice in a few minutes, or follow a bill to keep an eye on it.';
  return `<div class="hm hm-explore">
    ${accountCards()}
    <div class="cols"><div class="hm-main">
      <header class="hm-head"><h1 class="hero">This week at the Capitol</h1><p class="lede">${lede}</p></header>
      ${!cards.length ? nudgeHtml : calm ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Bills with hearings soon</h2><div class="rows hm-picks">${cards.map(pickRow).join('')}</div>${nudgeHtml}</section>`
        : `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Bills with hearings soon</h2>
        ${cards.slice(0, 1).map(x => sugCard(x.b, x.h)).join('')}${nudgeHtml}${cards.slice(1).map(x => sugCard(x.b, x.h)).join('')}</section>`}
    </div><div class="side hm-side">
      ${cats.length ? `<section class="hm-sec" aria-labelledby="hm-iss"><h2 id="hm-iss">Browse issues</h2>
        <div class="rows hm-issues">${cats.map(c => row({ lead: c.icon, title: esc(c.name), sub: esc(c.description || ''), href: `#/find/category/${encodeURIComponent(c.key)}` })).join('')}</div></section>` : ''}
      ${lists.length ? `<section class="hm-sec" aria-labelledby="hm-lists"><h2 id="hm-lists">Lists from HIPHI</h2>
        <div class="rows">${lists.map(l => row({ lead: issueIcon(l.icon, 'list'), title: esc(l.title), sub: esc(l.description || ''), end: countOk(l.followers) ? `<span class="hm-day">${n(l.followers)} following</span>` : '', href: `#/list/${encodeURIComponent(l.slug)}` })).join('')}</div></section>` : ''}
      <p class="hm-start">Want suggestions? ${btn('Take the 1-minute start', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' })}</p>
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
    const nb = issueBills(i).length;
    rows.push({ lead: catOf(i.category)?.icon || 'heart-pulse', title: i.name, sub: nb ? `${plural(nb, 'bill')} in ${yr}` : '', href: `#/issue/${i.slug}` });
  }
  if (!rows.length) for (const k of wiz().issues || []) { const c = catOf(k); if (c) rows.push({ lead: c.icon, title: c.name, sub: 'Pick the issues to follow', href: `#/find/category/${c.key}` }); }
  return rows;
}
const issueRow = r => row({ lead: r.lead, title: esc(r.title), sub: esc(r.sub), href: r.href });
function offView(si) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1, welcome = welcomed();
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  const days = next ? Math.max(0, Math.round((hiT(next) - hiT(hstDay(Date.now()))) / 864e5)) : 0;
  const acts = myActions().filter(a => a.year === yr || (!a.year && anyBill(a.bill_id)?.session_year === yr));
  // The recap leads with the wins: became law, then moved forward, then the rest. Bills acted on come before bills
  // only followed (the sort is stable).
  const RANK = { law: 0, up: 1, wait: 2, stop: 3 };
  const acted = impacts(acts), followed = followedRows(yr, new Set(acted.map(x => x.b.id)));
  const rows = [...acted, ...followed].sort((p, q) => RANK[p.tone] - RANK[q.tone] || !!q.moved - !!p.moved);
  const count = (a, f) => a.filter(f).length;
  // "Moved forward" is only said of a bill that got somewhere. One that passed a committee and then stopped reads
  // "passed the committee you spoke to" (the old "2 moved forward" sat above two rows that said "stopped").
  const aLaw = count(acted, x => x.tone === 'law'), aGov = count(acted, x => x.tone === 'up'), aPassed = count(acted, x => x.moved && x.tone === 'stop');
  const fLaw = count(followed, x => x.tone === 'law'), fGov = count(followed, x => x.tone === 'up');
  const wins = (law, gov, passed) => list([law && `${n(law)} became law`, gov && `${n(gov)} reached the Governor’s desk`, passed && `${n(passed)} passed the committee you spoke to`]);
  const said = acts.length
    ? `You took ${plural(acts.length, 'action')} on ${plural(acted.length, 'bill')}.${aLaw || aGov || aPassed ? ` ${cap(wins(aLaw, aGov, aPassed))}.` : ''} Mahalo for speaking up.${fLaw ? ` ${plural(fLaw, 'more bill')} you followed became law.` : ''}`
    : fLaw || fGov ? `${list([fLaw && `${plural(fLaw, 'bill')} you followed became law`, fGov && `${n(fGov)} ${fLaw ? '' : fGov === 1 ? 'bill you followed ' : 'bills you followed '}reached the Governor’s desk`])}.`
    : `You followed ${plural(followed.length, 'bill')} in ${yr}. ${followed.length === 1 ? 'It' : 'They'} stopped for this session. Many bills come back the next year.`;
  const mine = myIssues(yr), lists = (S.lists || []).filter(l => S.listFollows?.has(l.id)), known = districtsKnown();
  const nothingYet = !rows.length && !mine.length && !lists.length;
  const nudgeHtml = S.nudge ? nudgeCard(S.nudge) : '';
  const askBtn = !S.session && !S.nudge && !S.nudgedThisVisit && !emailGiven();
  const lede = `${welcome ? `The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}. When it opens,` : `${opens ? `The ${nextYr} session opens ${esc(opens)}. ` : ''}When hearings start,`} HIPHI’s ${nextYr} bills${mine.length ? ' for your issues' : ''} will show up here, with simple ways to help.`;
  const ready = known && !askBtn ? ['You’re ready for January', 'Your legislators are saved, so you’ll know who to talk to from the first hearing.']
    : ['Get ready for January', known ? 'Get an email when a bill on your issues has a hearing. It also keeps your issues on any device.'
      : askBtn ? 'Know who represents you, and get an email when a bill on your issues has a hearing. Each takes under a minute.' : 'Know who represents you before the first hearing. It takes 30 seconds.'];
  // The saved issues and followed lists, named, with a way to change them. They sit under the recap's neighbour when
  // there is a recap (so the two columns stay even), else they lead the page: they are what the person just set up.
  const setup = `${mine.length ? `<section class="hm-sec" aria-labelledby="hm-mi"><div class="hm-sechead"><h2 id="hm-mi">Your issues</h2>${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', href: '#/start/1', attrs: { 'aria-label': 'Edit your issues' } })}</div>
      <div class="rows">${mine.map(issueRow).join('')}</div></section>` : ''}
    ${lists.length ? `<section class="hm-sec" aria-labelledby="hm-ml"><h2 id="hm-ml">Lists you follow</h2>
      <div class="rows">${lists.map(l => row({ lead: issueIcon(l.icon, 'list'), title: esc(l.title), sub: `HIPHI’s ${nextYr} bills will show up here as they are added.`, href: `#/list/${encodeURIComponent(l.slug)}` })).join('')}</div></section>` : ''}`;
  return `<div class="hm hm-off">
    ${accountCards()}
    <header class="hm-head hm-break"><div class="hm-art">${CAPITOL}</div>
      <div class="hm-breakt"><h1 class="hero">${welcome ? `${wiz().finale ? 'Aloha' : `You’re all set for ${nextYr}`}${(wiz().name || '').trim() ? `, ${esc(wiz().name.trim())}` : ''}` : 'The Legislature is on break'}</h1>
        <p class="lede">${lede}</p>
        ${next ? `<div class="chips">${chip(days === 0 ? 'Opens today' : `${plural(days, 'day')} to go`, 'info', 'calendar-days')}</div>` : ''}</div></header>
    <div class="cols even"><div class="hm-col">
      ${rows.length ? `<section class="card hm-recap" aria-labelledby="hm-rc"><div class="hm-recaphead"><h2 id="hm-rc">Your ${yr} session</h2><div class="hm-isl">${islands(myIsland())}</div></div>
        <p>${esc(said)}</p>
        ${chipsHtml(milestoneState(acts).got)}
        <h3 class="hm-label">What happened</h3>${impList(rows, 3)}</section>` : setup}
      ${nothingYet ? `<section class="card hm-ready" aria-labelledby="hm-st"><h2 id="hm-st">Start with what you care about</h2>
        <p class="muted">Pick a few health issues now. When the session opens, HIPHI’s bills for them will be waiting here.</p>
        <div class="btncol">${btn('Pick the issues I care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}</div></section>` : ''}
    </div><div class="hm-col">
      <section class="card hm-ready" aria-labelledby="hm-rd"><h2 id="hm-rd">${ready[0]}</h2>
        <p class="muted">${ready[1]}</p>
        <div class="btncol">${btn(known ? 'See my legislators' : 'Find my legislators', { kind: nothingYet || (known && askBtn) ? 'secondary' : 'primary', icon: 'landmark', href: '#/legislators' })}
          ${askBtn ? btn('Get hearing alerts by email', { kind: known && !nothingYet ? 'primary' : 'secondary', icon: 'mail', href: '#/signin' }) : ''}
          ${!nothingYet && !mine.length ? btn('Pick the issues I care about', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' }) : ''}</div></section>
      ${newIssuesCard()}
      ${nudgeHtml}
      ${rows.length ? setup : ''}
      ${btn(`Read HIPHI’s ${yr} Legislative Recap`, { kind: 'text', iconEnd: 'external-link', href: 'https://www.hiphi.org/policy/legrecap', cls: 'hm-link', attrs: { target: '_blank', rel: 'noopener' } })}
    </div></div>
  </div>`;
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
  title: () => 'Home',
  render() {
    if (!S.featured || !S.pool) return skeleton(4);
    // A fresh arrival on Home (not a re-render after a tap) decides which Home to show and notes what was already
    // done. Re-renders keep the same shape, so following the first bill from "explore" does not swap the page under
    // the person's finger.
    const fresh = !document.querySelector('#main .hm');
    const si = sessionInfo();
    if (fresh) {
      S.hmSug = null; S.hmArrived = new Set(S.done || []);
      S.hmMode = si.phase !== 'in' ? 'off' : S.watch.size ? 'follow' : 'explore';
      // First visit, email step skipped: Home asks once, inline (nudge() keeps core's one-per-visit and "Not now" rules).
      if (S.hmMode === 'follow' && welcomed() && !S.nudge && !S.session && !emailGiven()) nudge('follow');
    }
    const mode = si.phase !== 'in' ? 'off' : S.hmMode === 'explore' || !S.watch.size ? 'explore' : 'follow';
    return mode === 'off' ? offView(si) : mode === 'explore' ? exploreView() : followView(si);
  },
  wire() {
    const root = document.querySelector('#main .hm'); if (!root) return;
    wireActions(root); wireNudge(root);
    try { more.wireAccountCards?.(); } catch (e) { console.error(e); }
    // Lists open in place without a redraw, so keyboard focus stays on the button that opened them.
    root.querySelectorAll('[data-hm-toggle]').forEach(el => el.onclick = () => {
      const box = document.getElementById(el.getAttribute('aria-controls')); if (!box) return;
      const on = S.hmOpen[el.dataset.hmToggle] = !S.hmOpen[el.dataset.hmToggle];
      box.hidden = !on; el.setAttribute('aria-expanded', on ? 'true' : 'false');
      el.innerHTML = `<span>${esc(on ? el.dataset.less : el.dataset.more)}</span>${icon(on ? 'chevron-up' : 'chevron-down')}`;
      fitSide();
    });
    const fold = root.querySelector('.hm-fold'); if (fold) fold.ontoggle = () => { S.hmOpen.fold = fold.open; };
    root.querySelectorAll('[data-hm-newfollow]').forEach(el => el.onclick = async () => {
      const i = S.issueById.get(el.dataset.hmNewfollow); if (!i) return;
      if (await setFollows({ issuesOn: [i.id] })) { toast(`Following ${i.name}`, { yay: true, undo: async () => { await setFollows({ issuesOff: [i.id] }); app.render(); } }); app.render(); }
    });
    root.querySelectorAll('[data-hm-newdone]').forEach(el => el.onclick = () => { S.hmNew = []; app.render(); });
    fitSide();
    const side = root.querySelector('.cols > .hm-side');
    if (side && window.ResizeObserver) { sideWatch?.disconnect(); sideWatch = new ResizeObserver(fitSide); sideWatch.observe(side); }
  },
};
