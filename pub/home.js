// Home (redesign 9/19; plan sections 3 "Skip path", 4 and 7). Home has one shape for each moment of the year:
//  - in session, following bills: what you can do this week (two cards, the rest folded), your session so far,
//    what's new, and one suggestion when there is little to do;
//  - in session, following nothing (the person skipped the guided start): "This week at the Capitol", issues, lists;
//  - between sessions (the Legislature meets January to early May; the rest of the year it is on break): the recap.
// The week calendar grid, the three-column board, the 72-hour feed, recent hearings, the full bill list and the
// onboarding strip are gone on purpose: each repeated the same bills (one bill could show up five times), and a
// newcomer needs one clear next step. The full list lives in My bills.
import { S, DEMO, HST, esc, icon, yay, blurb, spaced, billPath, alive, issues, openActions, actedOn, doneKey, KINDS,
  localDone, dismissed, recommendations, wiz, groupNames, sessionInfo, myActions, MILESTONES, RUNGS, COMM_KEY,
  countOk, anyBill, anyHearing, outcomeOf, plainStatus, whyStopped, cmteLabel, codesOf, CHAMBER_NAME, issueIcon,
  dayWord, timeWord, dateLong, hstDay, hiT } from './core.js';
import { btn, chip, row, empty, skeleton } from './ui.js';
import { actionCard, wireActions, nudgeCard, wireNudge } from './actions.js';
import { CAPITOL, ISLANDS, flower } from './art.js';
// A namespace import, so Home still loads while More is being built (a named import of a missing export would
// stop the whole page from loading).
import * as more from './more.js';

// What was already done when this page load began. A card finished on an earlier visit folds into "Done this
// week"; one finished during this visit stays where it was, in its done state, so nothing jumps under a finger.
// (Read from this browser before the data loads; an account's older actions carry a timestamp before VISIT.)
const BEFORE = localDone();
const VISIT = Date.now();
const doneBefore = key => BEFORE.has(key) || (S.doneAt?.[key] ? Date.parse(S.doneAt[key]) < VISIT : false);

const n = x => Number(x || 0).toLocaleString('en-US');
const plural = (k, one, many = one + 's') => `${n(k)} ${k === 1 ? one : many}`;
// "Senate Education": the chamber and the committee's own name, for short sentences. Joint committees are joined
// with "and" (one hearing held by both, so both decide).
function who(code) {
  const c = S.committees[codesOf(code)[0]];
  return c ? `${CHAMBER_NAME[c.chamber] || ''} ${cmteLabel(code, { short: true })}`.trim() : 'The committee';
}
const slugOf = g => (S.coalitions || []).find(c => g.names.includes(c.name))?.slug || g.key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
// Saved by the legislators screen ("Remember on this device"): { senate, house, label }.
const districtsSaved = () => { try { return !!JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate; } catch { return false; } };
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
    const did = `You ${v.length > 1 ? v.slice(0, -1).join(', ') + ' and ' + v[v.length - 1] : v[0]}.`;
    const [tone, text, moved] = resultOf(b, hs, x.kinds.has('testimony'));
    return { b, tone, did, text, moved };
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
const MARKS = { up: 'circle-check', wait: 'hourglass', stop: 'archive' };
const impRow = x => `<a class="hm-imp" href="${billPath(x.b)}"><span class="hm-mark t-${x.tone}">${x.tone === 'law' ? flower(22) : icon(MARKS[x.tone])}</span>
  <span class="hm-impb"><span class="hm-impt">${esc(blurb(x.b, 110))}</span><span class="hm-impr">${esc(x.did)} ${esc(x.text)}</span></span>${icon('chevron-right', { cls: 'hm-chev' })}</a>`;
// The first few rows, then "See all (n)" opens the rest in place.
function impList(rows, first, id) {
  if (!rows.length) return '';
  const rest = rows.slice(first), open = S.hmImpAll;
  return `<div class="hm-imps">${rows.slice(0, first).map(impRow).join('')}
    ${rest.length ? `<div id="${id}" class="hm-imprest"${open ? '' : ' hidden'}>${rest.map(impRow).join('')}</div>
      ${btn(open ? 'Show fewer' : `See all (${rows.length})`, { kind: 'text', iconEnd: open ? 'chevron-up' : 'chevron-down', cls: 'hm-toggle', attrs: { 'data-hm-impall': id, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id, 'data-n': rows.length } })}` : ''}</div>`;
}

// Milestones mark real acts and never expire. "I plan to go" counts as an action straight away, but "Showed up"
// waits until the hearing has started (Nate, 9/18).
function milestones(acts) {
  const now = Date.now();
  const held = acts.filter(a => a.kind !== 'attend' || (h => h && new Date(h.scheduled_at) <= now)(anyHearing(a.hearing_id)));
  const has = m => m[3](m[0] === 'attend' ? held : acts);
  const got = MILESTONES.filter(has), next = MILESTONES.find(m => m[0] !== 'law' && !has(m));
  if (!got.length) return '';
  return `<div class="hm-miles"><ul class="chips" aria-label="Milestones you have reached">${got.map(([, t, d]) => `<li class="chip yay" title="${esc(d)}">${flower(16)}${esc(t)}</li>`).join('')}</ul>
    ${next ? `<p class="small hm-next">Next: <b>${esc(next[1])}</b>, ${esc(next[2])}</p>` : ''}</div>`;
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
  return `<div class="hm-weeks" role="img" aria-label="You took action in ${plural(k, 'week')} of the session so far">${dots.join('')}</div>
    <p class="meta">Each dot is a week. Filled means you took action.</p>`;
}

// The community this session, only from 10 people (plan 2.14). The bar fills toward the next round number.
function community(yr) {
  const t = (S.totals || {})[yr]; if (!t || !countOk(t.people)) return '';
  const next = RUNGS.find(r => r > t.actions) || t.actions, pct = Math.max(2, Math.min(100, Math.round(t.actions / next * 100)));
  return `<div class="hm-comm"><p class="hm-commt">${icon('users')}<span>Together, <b>${n(t.people)}</b> people have taken <b>${n(t.actions)}</b> actions with HIPHI this session.</span></p>
    <div class="hm-bar" role="img" aria-label="${n(t.actions)} of ${n(next)} actions"><i style="width:${pct}%"></i></div>
    <p class="meta">Next goal: ${n(next)} actions.${S.session || S.nudge === 'action' ? '' : ' Yours join the count once you add your email.'}</p></div>`;
}

function sessionPanel(si) {
  const mine = myActions().filter(a => !a.year || a.year === si.yr);
  const head = `<h2 id="hm-ys" class="hm-ptitle">${flower(24)}<span>Your ${si.yr} session</span></h2>`;
  if (!mine.length) return `<section class="card hm-panel" aria-labelledby="hm-ys">${head}<p class="muted">Your first action will show up here, with what happened after it.</p></section>`;
  const bills = new Set(mine.map(a => a.bill_id)).size, rows = impacts(mine);
  return `<section class="card hm-panel" aria-labelledby="hm-ys">${head}
    <p class="hm-counts"><b>${plural(mine.length, 'action')}</b> · <b>${plural(bills, 'bill')}</b></p>
    ${weeks(si, mine)}
    ${milestones(myActions())}
    ${S.nudge === 'action' ? nudgeCard('action') : ''}
    ${rows.length ? `<h3 class="hm-label">What happened after you acted</h3>${impList(rows, 2, 'hm-imprest')}` : ''}
    ${community(si.yr)}
    ${DEMO && S.demoSeeded ? '<p class="meta">Sandbox: three sample actions are filled in so this panel has something to show.</p>' : ''}
  </section>`;
}

// ---------------- what's new on my bills (last 7 days) ----------------
// Only facts a newcomer can read at a glance: a hearing was set, or a committee decided. Bills already shown in a
// card are left out, so a bill appears on Home at most twice.
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
    // A new hearing reads "HB 1975 has a hearing on Thu": the committee's full name (often two joined) is on the bill page.
    if (!held && h.status === 'scheduled' && h.notice_posted_at) { const d = dayWord(h.scheduled_at);
      add(b, h.notice_posted_at, 'calendar', `${num} has a hearing ${/^(today|tomorrow)/.test(d) ? d : 'on ' + d}`); }
  }
  const items = [...per.values()].sort((p, q) => q.t - p.t).slice(0, 3);
  if (!items.length) return '';
  const day = at => hstDay(at) === hstDay(now) ? 'Today' : new Date(at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
  return `<section class="hm-sec" aria-labelledby="hm-new"><h2 id="hm-new">What’s new</h2>
    <div class="rows">${items.map(x => row({ lead: x.lead, title: esc(x.text), sub: esc(blurb(x.b, 70)), end: `<span class="hm-day">${day(x.at)}</span>`, href: billPath(x.b) })).join('')}</div>
    ${btn('See all my bills', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link' })}</section>`;
}

// ---------------- the in-session Home for someone following bills ----------------
// Why a suggestion is shown, in words (replaces the old "you follow X", which was wrong right after Step 1).
function reasonFor(b) {
  const picked = new Set((wiz().issues || []).flatMap(groupNames)), mine = new Set(S.bills.filter(x => x.id !== b.id).flatMap(x => x.coalitions || []));
  if ((b.coalitions || []).some(c => picked.has(c))) return 'Matches an issue you picked';
  if ((b.coalitions || []).some(c => mine.has(c))) return 'Like bills you follow';
  return /strongly/.test(b.hiphi_position || '') ? 'One of HIPHI’s top priorities' : '';
}
// A suggestion card: Follow and "Not for me" always; the reason line only when it says something the card does
// not already say (a bare "needs voices this week" just repeats the heading and the deadline).
function sugCard(b, h) {
  const why = reasonFor(b), html = actionCard(b, h, { suggest: why || '-' });
  return why ? html : html.replace(/<p class="why">[\s\S]*?<\/p>/, '');
}
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

function followView(si) {
  let sug = keptSuggestion();
  const all = openActions(S.bills, S.hearings).filter(x => !(sug && x.b.id === sug.b.id));
  const wasDone = x => KINDS.some(k => { const key = doneKey(x.b.id, x.h.id, k); return S.done.has(key) && doneBefore(key); });
  const folded = all.filter(x => actedOn(x.b, x.h) && wasDone(x)), list = all.filter(x => !folded.includes(x));
  const open = list.filter(x => !actedOn(x.b, x.h)), inCards = new Set(all.map(x => x.b.id));
  if (!sug && open.length < 2) sug = pickSuggestion(inCards);
  S.hmSug = sug ? { b: sug.b.id, h: sug.h.id } : null;
  if (sug) inCards.add(sug.b.id);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST });
  const live = S.bills.filter(alive).length, finished = !open.length && !list.length && !folded.length && !live;
  const h1 = open.length ? `${plural(open.length, 'thing')} you can do this week` : finished ? 'Your bills have finished for this session' : 'You’re all caught up';
  const focusId = open[0] && `${open[0].b.id}|${open[0].h.id}`;
  const card = x => actionCard(x.b, x.h, { focus: `${x.b.id}|${x.h.id}` === focusId });
  const followNudge = S.nudge === 'follow' ? nudgeCard('follow') : '';

  // When nothing is open: all done (islands), all waiting, or every bill finished for the session.
  let quiet = '';
  if (!open.length) {
    quiet = list.length || folded.length
      ? empty({ art: ISLANDS, text: 'You’ve done everything on your list this week. Mahalo! New hearings usually post by Friday.' })
      : live ? `<p class="lede">Your ${plural(live, 'bill')} ${live === 1 ? 'is waiting for a hearing' : 'are waiting for hearings'}. When one is scheduled, your five-minute action shows up here.</p>`
      : `<div class="hm-quiet"><p class="lede">Their record stays in My bills. Other bills are still moving and need voices.</p>${btn('Find bills still moving', { kind: sug ? 'secondary' : 'primary', icon: 'search', href: '#/find' })}</div>`;
  }
  const rest = list.slice(2), more = S.hmMore;
  return `<div class="hm hm-follow">
    ${accountCards()}${S.nudge === 'back' ? nudgeCard('back') : ''}
    <header class="hm-head"><p class="eyebrow">${esc(today)}</p><h1>${esc(h1)}</h1>${quiet}</header>
    ${list.length ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Do this now</h2>
      ${list.slice(0, 1).map(card).join('')}${followNudge}${list.slice(1, 2).map(card).join('')}
      ${rest.length ? `<div id="hm-rest" class="hm-rest"${more ? '' : ' hidden'}>${rest.map(card).join('')}</div>
        ${btn(more ? 'Show fewer' : `Show ${rest.length} more`, { kind: 'text', iconEnd: more ? 'chevron-up' : 'chevron-down', cls: 'hm-toggle', attrs: { 'data-hm-more': rest.length, 'aria-expanded': more ? 'true' : 'false', 'aria-controls': 'hm-rest' } })}` : ''}
    </section>` : followNudge}
    ${folded.length ? `<details class="hm-fold"${S.hmFold ? ' open' : ''}><summary><span class="hm-foldt">${icon('circle-check')}Done this week (${folded.length})</span>${icon('chevron-down', { cls: 'hm-foldc' })}</summary>
      <div class="hm-foldb">${folded.map(x => actionCard(x.b, x.h)).join('')}</div></details>` : ''}
    ${sessionPanel(si)}
    ${whatsNew(inCards)}
    ${sug ? `<section class="hm-sec" aria-labelledby="hm-sug"><h2 id="hm-sug">Another bill that needs voices</h2>
      ${sugCard(sug.b, sug.h)}
      ${btn('More bills that need voices', { kind: 'text', iconEnd: 'chevron-right', href: '#/find', cls: 'hm-link' })}</section>` : ''}
  </div>`;
}

// ---------------- in session, following nothing: explore (plan 3, "Skip path") ----------------
function exploreView() {
  const f = S.featured || { bills: [], hearings: [] }, seen = new Set(), skip = dismissed();
  const cards = openActions(f.bills, f.hearings).filter(x => !x.late && !skip.has(x.b.id) && !seen.has(x.b.id) && seen.add(x.b.id)).slice(0, 3);
  const nudge = S.nudge && S.nudge !== 'back' ? nudgeCard(S.nudge) : '';
  const iss = issues(), lists = (S.lists || []).filter(l => l.is_published !== false);
  return `<div class="hm hm-explore">
    ${accountCards()}${S.nudge === 'back' ? nudgeCard('back') : ''}
    <header class="hm-head"><h1>This week at the Capitol</h1>
      <p class="lede">${cards.length ? 'These bills have hearings soon. Add your voice in about five minutes, or follow a bill to keep an eye on it.' : 'No hearings are set on HIPHI’s bills yet this week. New ones usually post by Friday. Meanwhile, look around by issue.'}</p></header>
    ${cards.length ? `<section class="hm-now" aria-labelledby="hm-now-t"><h2 id="hm-now-t" class="sr">Bills with hearings soon</h2>
      ${cards.slice(0, 1).map(x => sugCard(x.b, x.h)).join('')}${nudge}${cards.slice(1).map(x => sugCard(x.b, x.h)).join('')}</section>` : nudge}
    ${iss.length ? `<section class="hm-sec" aria-labelledby="hm-iss"><h2 id="hm-iss">Browse by issue</h2>
      <div class="rows hm-issues">${iss.map(g => row({ lead: g.icon, title: esc(g.key), sub: esc(g.description || ''), href: `#/find/issue/${encodeURIComponent(slugOf(g))}` })).join('')}</div></section>` : ''}
    ${lists.length ? `<section class="hm-sec" aria-labelledby="hm-lists"><h2 id="hm-lists">Lists from HIPHI</h2>
      <div class="rows">${lists.map(l => row({ lead: issueIcon(l.icon, 'list'), title: esc(l.title), sub: esc(l.description || ''), end: countOk(l.followers) ? `<span class="hm-day">${n(l.followers)} following</span>` : '', href: `#/list/${encodeURIComponent(l.slug)}` })).join('')}</div></section>` : ''}
    <p class="hm-start">Want suggestions? ${btn('Take the 1-minute start', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' })}</p>
  </div>`;
}

// ---------------- between sessions: the recap (plan 4, "Between sessions") ----------------
function offView(si) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1;
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  const days = next ? Math.max(0, Math.round((hiT(next) - hiT(hstDay(Date.now()))) / 864e5)) : 0;
  const following = S.watch.size > 0;
  const acts = myActions().filter(a => a.year === yr || (!a.year && anyBill(a.bill_id)?.session_year === yr));
  // The recap leads with the wins: became law, then moved forward, then the rest (newest first within each).
  const RANK = { law: 0, up: 1, wait: 2, stop: 3 };
  const rows = impacts(acts).sort((p, q) => RANK[p.tone] - RANK[q.tone] || !!q.moved - !!p.moved), bills = rows.map(x => x.b);
  const law = bills.filter(b => b.stage === 'enacted').length;
  // "Moved forward": the committee you spoke to passed it, or it reached the Governor (law is counted on its own).
  const moved = rows.filter(x => x.moved).length;
  const said = acts.length
    ? `You took ${plural(acts.length, 'action')} on ${plural(bills.length, 'bill')}.${moved || law ? ` ${[moved && `${n(moved)} moved forward`, law && `${n(law)} became law`].filter(Boolean).join(' and ')}.` : ''} Mahalo for speaking up.`
    : `You didn’t act on a bill in ${yr}. That’s okay. Here’s how to be ready for ${nextYr}.`;
  const t = (S.totals || {})[yr], together = t && countOk(t.people)
    ? `<p class="hm-together">${icon('users')}<span>Together, <b>${n(t.people)}</b> people took <b>${n(t.actions)}</b> actions on <b>${n(t.bills)}</b> bills with HIPHI in ${yr}.</span></p>` : '';
  const nudge = S.nudge && S.nudge !== 'back' ? nudgeCard(S.nudge) : '';
  const known = districtsSaved() || !!(S.profile || {}).senate_district;
  const noIssues = !following && !(wiz().issues || []).length;
  return `<div class="hm hm-off">
    ${accountCards()}${S.nudge === 'back' ? nudgeCard('back') : ''}
    <header class="hm-head hm-break"><div class="hm-art">${CAPITOL}</div>
      <h1>The Legislature is on break</h1>
      <p class="lede">${opens ? `The ${nextYr} session opens ${esc(opens)}. ` : ''}${following ? 'Your bills and lists will be ready.' : (wiz().issues || []).length ? 'We saved your issues. HIPHI’s bills for them will be ready when hearings start.' : 'Pick your issues now, and HIPHI’s bills will be ready when hearings start.'}</p>
      ${next ? `<div class="chips">${chip(days === 0 ? 'Opens today' : `${plural(days, 'day')} to go`, 'info', 'calendar-days')}</div>` : ''}</header>
    <section class="card hm-recap" aria-labelledby="hm-rc"><div class="hm-isl">${ISLANDS}</div>
      <h2 id="hm-rc">Your ${yr} session</h2>
      <p>${esc(said)}</p>
      ${acts.length ? milestones(acts) : ''}
      ${rows.length ? `<h3 class="hm-label">What happened</h3>${impList(rows, 3, 'hm-recaprest')}` : ''}
    </section>
    ${nudge}
    <section class="card hm-ready" aria-labelledby="hm-rd"><h2 id="hm-rd">Get ready for January</h2>
      <p class="muted">${S.session ? 'Know who represents you before the first hearing. It takes 30 seconds.' : 'Know who represents you, and keep your bills on any phone. Each takes under a minute.'}</p>
      <div class="btncol">${btn(known ? 'See my legislators' : 'Find my legislators', { kind: 'primary', icon: 'landmark', href: '#/legislators' })}
        ${S.session ? '' : btn('Save my bills with my email', { kind: 'secondary', icon: 'mail', href: '#/signin' })}
        ${noIssues ? btn('Pick the issues I care about', { kind: 'text', iconEnd: 'chevron-right', href: '#/start/1' }) : ''}</div></section>
    ${together}
    ${btn(`Read HIPHI’s ${yr} Legislative Recap`, { kind: 'text', iconEnd: 'external-link', href: 'https://www.hiphi.org/policy/legrecap', cls: 'hm-link', attrs: { target: '_blank', rel: 'noopener' } })}
  </div>`;
}

// ---------------- the screen ----------------
export default {
  tab: 'home',
  title: () => 'Home',
  render() {
    if (!S.featured || !S.pool) return skeleton(4);
    // A fresh arrival on Home (not a re-render after a tap) resets the page's own view state and decides which
    // Home to show. Re-renders keep the same shape, so following the first bill from "explore" does not swap the
    // page under the person's finger.
    const fresh = !document.querySelector('#main .hm');
    const si = sessionInfo();
    if (fresh) { S.hmMore = false; S.hmImpAll = false; S.hmFold = false; S.hmSug = null; S.hmMode = si.phase !== 'in' ? 'off' : S.watch.size ? 'follow' : 'explore'; }
    const mode = si.phase !== 'in' ? 'off' : S.hmMode === 'explore' || !S.watch.size ? 'explore' : 'follow';
    return mode === 'off' ? offView(si) : mode === 'explore' ? exploreView() : followView(si);
  },
  wire() {
    const root = document.querySelector('#main .hm'); if (!root) return;
    wireActions(root); wireNudge(root);
    try { more.wireAccountCards?.(); } catch (e) { console.error(e); }
    // "Show 2 more" and "See all (5)" open in place without a re-render, so keyboard focus stays on the button.
    const toggle = (btnEl, box, on, label) => {
      box.hidden = !on; btnEl.setAttribute('aria-expanded', on ? 'true' : 'false');
      btnEl.innerHTML = `<span>${label}</span>${icon(on ? 'chevron-up' : 'chevron-down')}`;
    };
    root.querySelectorAll('[data-hm-more]').forEach(el => el.onclick = () => { S.hmMore = !S.hmMore; const box = root.querySelector('#hm-rest');
      if (box) toggle(el, box, S.hmMore, S.hmMore ? 'Show fewer' : `Show ${el.dataset.hmMore} more`); });
    root.querySelectorAll('[data-hm-impall]').forEach(el => el.onclick = () => { S.hmImpAll = !S.hmImpAll; const box = root.querySelector('#' + el.dataset.hmImpall);
      if (box) toggle(el, box, S.hmImpAll, S.hmImpAll ? 'Show fewer' : `See all (${el.dataset.n})`); });
    const fold = root.querySelector('.hm-fold'); if (fold) fold.ontoggle = () => { S.hmFold = fold.open; };
    // Passing a community milestone since this device last looked gets one line of thanks (once per visit).
    const t = (S.totals || {})[sessionInfo().yr];
    if (!S.hmCommSeen && t && countOk(t.people) && sessionInfo().phase === 'in') {
      S.hmCommSeen = true;
      const prev = [...RUNGS].reverse().find(r => r <= t.actions) || 0;
      let seen = 0; try { seen = +localStorage.getItem(COMM_KEY) || 0; localStorage.setItem(COMM_KEY, String(prev)); } catch { /* private mode */ }
      if (seen > 0 && prev > seen) setTimeout(() => yay(`Our community just passed ${n(prev)} actions this session. Imua!`), 500);
    }
  },
};
