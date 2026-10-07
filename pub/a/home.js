// Version A's Home (R-071; the design is backend R-070 Layout A, "Today"). It works like a weather app: the same four
// parts in the same order on every visit, and only the first one changes with the moment.
//   1. Now: one ask, the soonest testimony deadline still open this week (Nate 9/28, R-070 decision 7: soonest first,
//      HIPHI's top priorities marked). "1 of 4 today" and the rest of that day's deadlines by time, one tap each.
//      With nothing due it is the news, or "Nothing needs you this week".
//   2. Since …: what committees decided on your bills since your last visit, and what you did. Results only; a new
//      hearing is not news, it gets a New dot in the week.
//   3. This week on your issues: one row per hearing (a committee sitting), not per bill. Every day open, past days gone
//      (R-190, Nate 10/6: nothing to do behind a closed fold; later days were one folded line each).
//   4. Where your issues stand: up to six issues as rows with a progress bar; more than six as one bar with counts,
//      with the full list in My issues.
//   Between 3 and 4, bills that need a hearing: one line each, not cards, right under the week (R-194, Nate 10/6: they sat at
//   the end of part 4, about 6,000px down a phone for someone following many issues; R-190 had opened their fold).
// The email ask sits after the week (R-070 decision 3, tried here), never between two hearings.
// Everything else (the first visit and the rest of that visit, between sessions, following nothing, Your session) is
// today's Home, unchanged.
// Since R-187 (Nate 10/6: "put it on the A/B testing now") this is the live test 'layout' (pub/variant.js), drawn by
// track.html for a browser on version A; it no longer has a page of its own (track-a.html sends its links here). Today's
// Home's other cards come along (home.js extras): the account cards, a saved letter, a plan to go, a new issue, keeping
// the tracker on a phone, Meet HIPHI and a first-visit plan's next small thing, so the test compares the arrangement and
// nothing goes missing.
import { S, app, esc, icon, toast, blurb, nick, headline, spaced, billPath, alive, openActions, dueInfo, dayWord, timeWord, dateLong, cmteLabel,
  roomLabel, hstDay, hiT, HST, followedIssues, issueBills, issuesOf, posInfo, outcomeOf, didKind, myActions, testimonyDraft, sessionInfo,
  followsAnything, waitingBills, chairContacts, askedChair, agrees, plainStatus, stopOf, codesOf, CHAMBER_NAME, wiz, anyHearing, anyBill,
  settledOn, OUTCOME_PLAIN } from '../core.js';
import { testifyLabel } from '../letters.js';
import { btn, chip } from '../ui.js';
import { nudgeCard, wireNudge, wireActions, goingPlans, goingCard } from '../actions.js';
import { laterCard } from '../onb-later.js';
import today, { extras, wireExtras } from '../home.js';

S.aSkip ??= new Set();   // Now items passed over with "Not now", for this visit
const welcomed = () => { try { return sessionStorage.getItem('hiphi_welcome') === '1'; } catch { return false; } };
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const list = parts => parts.filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1');
const lc = s => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const nameOf = b => nick(b) || headline(b, 70);
const top = b => /strongly/.test(b.hiphi_position || '');
// "Senate Education", "House Human Services and Health": the chamber and the committee's own name.
function who(code) {
  const cs = codesOf(code).map(c => S.committees[c]).filter(Boolean);
  if (!cs.length) return 'The committee';
  return `${CHAMBER_NAME[cs[0].chamber] || ''} ${cs.map(c => c.name).join(' and ')}`.trim();
}
const dayStart = t => hiT(hstDay(t)) - 12 * 36e5;   // midnight in Honolulu (hiT is noon)
const time = iso => timeWord(iso).replace(':00', '').replace(' AM', ' am').replace(' PM', ' pm');
// "today", "tomorrow", "Thu"
const dayName = iso => { const d = dayWord(iso); return /^today/.test(d) ? 'today' : /^tomorrow/.test(d) ? 'tomorrow' : d.split(',')[0]; };
const wd = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' });
const dnum = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, day: 'numeric' });

// ---------------- the bill's six steps (the same scale as the bill page) ----------------
const origin = b => b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H');
export function stepsOf(b) {
  const st = stopOf(b), o = origin(b), t = o === 'H' ? 'S' : 'H', N = CHAMBER_NAME;
  // A constitutional amendment goes to the voters, not the Governor (R-072).
  const conAm = b.stage === 'ballot' || /proposing (?:an )?amendments? to/i.test(b.title || '');
  const names = [`${N[o]} committees`, `${N[o]} vote`, `${N[t]} committees`, `${N[t]} vote`, conAm ? 'The voters' : 'Governor', conAm ? 'Constitution' : 'Law'];
  const ballot = b.stage === 'ballot' || st.phase === 'ballot';
  const law = b.stage === 'enacted' || st.phase === 'law', stopped = !law && !ballot && (b.stage === 'dead' || b.stage === 'vetoed' || (!alive(b) && b.stage !== 'governor'));
  let idx;
  if (law) idx = 5;
  else if (ballot || /governor|vetoed/.test(b.stage) || /governor|vetoed/.test(st.phase)) idx = 4;
  // Where it stopped: the stage it stopped at (R-072 adds the floor votes), else the chamber it was in when a committee
  // held it (a bill held in its second chamber showed "Stopped in: House committees").
  else if (stopped) { const d = b.died_at_stage || ''; idx = /^second_crossover|^conference|^second_floor/.test(d) ? 3 : /^second|^first_crossover/.test(d) ? 2 : d === 'first_floor' ? 1 : !d && st.leg === 'second' ? 2 : 0; }
  else if (st.phase === 'conference') idx = 3;
  else if (st.phase === 'floor') idx = st.leg === 'first' ? 1 : 3;
  else idx = st.leg === 'first' ? 0 : 2;
  if (idx === 3 && st.phase === 'conference') names[3] = 'Final version';
  const ch = idx <= 1 ? N[o] : N[t];
  const where = law ? (/^(HCR|SCR|HR|SR)\d/.test(b.bill_number || '') ? 'Adopted' : 'Became law') : ballot ? 'The voters decide in November' : stopped ? (b.stage === 'vetoed' ? 'Vetoed' : 'Stopped this session') : idx === 4 ? 'On the Governor’s desk'
    : st.phase === 'conference' ? 'Working out one version' : st.phase === 'floor' ? `Waiting for the ${ch} vote` : `In the ${ch}`;
  return { names, idx, law, stopped, where };
}
export function stepBar(b, { big = false, labels = false } = {}) {
  const s = stepsOf(b), cls = i => s.law || i < s.idx ? 'd' : i === s.idx ? (s.stopped ? 'x' : 'n') : '';
  const aria = s.law ? 'Became law: all 6 steps done' : s.stopped ? `Stopped at step ${s.idx + 1} of 6, ${s.names[s.idx]}` : `Step ${s.idx + 1} of 6, ${s.names[s.idx]}`;
  return `<div class="a-steps${big ? ' big' : ''}" role="img" aria-label="${esc(aria)}">${s.names.map((n, i) => `<i class="${cls(i)}"></i>`).join('')}</div>
    ${labels ? `<p class="a-snow">${s.law ? 'All six steps done' : s.stopped ? `<b>Stopped in:</b> ${esc(s.names[s.idx])}` : `<b>Now:</b> ${esc(s.names[s.idx])}${s.names[s.idx + 1] ? ` · <b>Next:</b> ${esc(s.names[s.idx + 1])}` : ''}`}</p>` : ''}`;   // six names don't fit under the bar on a phone
}

// ---------------- 1. Now ----------------
// Every open testimony deadline in the next 7 days, soonest first (skipped or not).
function dueItems() {
  const now = Date.now(), week = now + 7 * 864e5;
  return openActions(S.bills, S.hearings).filter(x => !x.late && !settledOn(x.b, x.h) && x.h.testimony_deadline && Date.parse(x.h.testimony_deadline) < week);
}
const skipKey = x => x.h.id + '|' + x.b.id;
// "Senate Education hears it Wed at 1 pm." Two committees sitting together are named on the bill page, not here:
// "Senate Health and Human Services and Commerce and Consumer Protection hear it" was hard to read (review 9/28).
function hearsIt(h) {
  const cs = codesOf(h.committee).map(c => S.committees[c]).filter(Boolean), when = `${dayName(h.scheduled_at)} at ${time(h.scheduled_at)}`;
  return cs.length > 1 ? `${cs.length === 2 ? 'Two' : cs.length} ${CHAMBER_NAME[cs[0].chamber] || ''} committees hear it together ${when}.` : `${who(h.committee)} hears it ${when}.`;
}
function nowCard(items) {
  const [first] = items, { b, h } = first, due = h.testimony_deadline, day = hstDay(due);
  const sameDay = items.filter(x => hstDay(x.h.testimony_deadline) === day), dn = dayName(due);
  const left = Date.parse(due) - Date.now(), mins = Math.floor(left / 6e4);
  const hurry = mins < 180 ? ` ${mins < 60 ? plural(Math.max(mins, 1), 'minute') : plural(Math.floor(mins / 60), 'hour')} left to send it.` : '';
  const rest = sameDay.filter(x => x !== first), p = posInfo(b);
  const label = testifyLabel(b, h);
  // What the bill does and where HIPHI stands come before the ask: nobody should be asked to write to the Senate about a
  // name alone (review 9/28; the bill-name rule in the frontend CLAUDE.md: nickname, plain summary, always the number).
  const sum = nick(b) ? blurb(b, 140) : '';
  return `<section class="a-now" aria-labelledby="a-now-h">
    <div class="a-nowtop"><p class="a-when">${icon('clock')}<span>Testimony due ${esc(dn)}, ${esc(time(due))}</span></p>${sameDay.length > 1 ? `<p class="a-of">1 of ${sameDay.length} due ${esc(dn === 'today' || dn === 'tomorrow' ? dn : 'on ' + dn)}</p>` : ''}</div>
    ${top(b) ? `<p class="a-prio">${icon('star')}<span>One of HIPHI’s top priorities</span></p>` : ''}
    <h2 id="a-now-h"><a href="${billPath(b)}">${esc(nameOf(b))}</a></h2>
    ${sum ? `<p class="a-nowsum">${esc(sum)}</p>` : ''}
    <p class="a-nowmeta">${p ? `${esc(p.text)} · ` : ''}${esc(spaced(b.bill_number))}</p>
    <p class="a-nowsay">${esc(hearsIt(h))}${esc(hurry)}</p>
    <div class="a-nowbtns">${btn(label, { kind: 'primary', icon: 'notebook-pen', full: true, cls: 'a-inv', attrs: { 'data-helper': h.id, 'data-bill': b.id } })}
      ${items.length > 1 ? btn('Show the next one', { kind: 'text', sm: true, cls: 'a-onDark', attrs: { 'data-a-skip': skipKey(first), 'data-a-name': nameOf(b) } }) : ''}</div>
    ${rest.length ? `<div class="a-then"><p class="a-thenk">Also due ${esc(dn)}</p>
      ${rest.map(x => `<a class="a-thenrow" href="${billPath(x.b)}"><b>${esc(time(x.h.testimony_deadline))}</b><span>${esc(nameOf(x.b))}${top(x.b) ? ` <span class="a-prio sm">${icon('star')}HIPHI priority</span>` : ''}</span>${icon('chevron-right')}</a>`).join('')}</div>` : ''}
  </section>`;
}
// Everything due this week was passed over with "Show the next one": say so, and bring them back, never "Nothing needs you".
const seenCard = n => `<section class="a-calm" aria-labelledby="a-calm-h"><span class="a-calmic">${icon('eye')}</span><div>
    <h2 id="a-calm-h">You’ve seen everything due this week</h2>
    <p>${btn(`Show the ${n === 1 ? 'one' : n} you skipped`, { kind: 'text', sm: true, attrs: { 'data-a-unskip': '1' } })}</p></div></section>`;
// No testimony due: bills that stop unless a committee chair gives them a hearing come first (review 9/28: a quiet week
// said "Nothing needs you" while three bills were running out of time). The soonest cut-off leads; the email itself is
// the bill page's main button.
function askCard(asks) {
  const date = asks[0].st.deadline.date, same = asks.filter(x => x.st.deadline.date === date), [{ b, st }] = same, rest = asks.filter(x => x !== same[0]);
  const on = dateLong(date + 'T12:00:00-10:00'), many = same.length > 1;
  return `<section class="a-now" aria-labelledby="a-now-h">
    <div class="a-nowtop"><p class="a-when">${icon('hourglass')}<span>${esc(plural(st.deadline.days, 'day'))} left</span></p></div>
    <h2 id="a-now-h">${many ? `${same.length} of your bills stop ${esc(on)} unless they get a hearing` : `<a href="${billPath(b)}">${esc(nameOf(b))}</a> stops ${esc(on)} unless it gets a hearing`}</h2>
    <p class="a-nowsay">The committee chair decides which bills get a hearing. A short, polite email asking for one helps.</p>
    <div class="a-nowbtns">${btn(chairContacts(st.committee).length > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing', { kind: 'primary', icon: 'mail', full: true, cls: 'a-inv', href: billPath(b) })}</div>
    ${many || rest.length ? `<div class="a-then"><p class="a-thenk">${many ? 'The bills' : 'Also waiting'}</p>
      ${(many ? same : rest).map(x => `<a class="a-thenrow" href="${billPath(x.b)}"><b>${esc(spaced(x.b.bill_number))}</b><span>${esc(nameOf(x.b))}</span>${icon('chevron-right')}</a>`).join('')}</div>` : ''}
  </section>`;
}

// ---------------- 2. Since your last visit ----------------
function sinceWhen() {
  const d = new Date(S.prevVisit), days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(d))) / 864e5);
  return days <= 1 ? 'yesterday' : days < 7 ? d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'your last visit';
}
function sinceItems() {
  const prev = S.prevVisit ? Date.parse(S.prevVisit) : 0, now = Date.now();
  if (!prev || now - prev < 3 * 36e5) return null;
  const since = Math.max(prev, now - 30 * 864e5), per = new Map();
  for (const h of S.hearings) {
    const b = S.bills.find(x => x.id === h.bill_id); if (!b || Date.parse(h.scheduled_at) > now) continue;
    const o = outcomeOf(h), t = o && Date.parse(o.reported_at || h.scheduled_at);
    if (!o?.outcome || !(t > since && t <= now)) continue;
    const said = { passed: 'passed it', passed_amended: 'passed it with changes', deferred: 'put it on hold', recommitted: 'sent it back for more work' }[o.outcome];
    if (said && (!per.has(b.id) || per.get(b.id).t < t)) per.set(b.id, { b, t, good: /passed/.test(o.outcome), text: `${who(h.committee)} ${said}.` });
  }
  for (const b of S.bills) if ((b.stage === 'enacted' || b.stage === 'governor') && b.last_action_date && hiT(b.last_action_date) > since && hiT(b.last_action_date) <= now)
    per.set(b.id, { b, t: hiT(b.last_action_date), good: true, text: b.stage === 'enacted' ? 'It became law.' : 'It passed the House and Senate. It is on the Governor’s desk.' });
  const results = [...per.values()].sort((p, q) => q.t - p.t);
  // What they did since then, once, in one line.
  const mine = myActions().filter(a => a.at && Date.parse(a.at) > since && Date.parse(a.at) <= now);
  const tb = [...new Set(mine.filter(a => a.kind === 'testimony').map(a => a.bill_id))].map(anyBill).filter(Boolean);
  const eb = [...new Set(mine.filter(a => a.kind === 'email').map(a => a.bill_id))].map(anyBill).filter(Boolean).filter(b => !tb.includes(b));
  const did = [tb.length ? `testified on ${tb.length === 1 ? lc(nameOf(tb[0])) : `${tb.length} bills: ${list(tb.map(b => lc(nameOf(b))))}`}` : '',
    eb.length ? `emailed the chair about ${eb.length === 1 ? lc(nameOf(eb[0])) : `${eb.length} bills`}` : ''].filter(Boolean);
  return { results, did: did.length ? `You ${list(did)}.` : '' };
}
function sinceCard(si, { lead = false } = {}) {
  if (!si || (!si.results.length && !si.did)) return '';
  const shown = si.results.slice(0, 3), more = si.results.length - shown.length;
  return `<section class="a-news${lead ? ' lead' : ''}" aria-labelledby="a-news-h"><h2 class="a-eyebrow" id="a-news-h">Since ${esc(sinceWhen())}</h2>
    ${shown.map(x => `<a class="a-newsrow" href="${billPath(x.b)}">${icon(x.good ? 'circle-check' : 'archive', { cls: x.good ? 'g' : 'h' })}<span><b>${esc(nameOf(x.b))}</b>. ${esc(x.text)}</span>${icon('chevron-right', { cls: 'chev' })}</a>`).join('')}
    ${more ? `<a class="a-newsmore" href="#/bills">${esc(plural(more, 'more result'))} in My issues${icon('chevron-right')}</a>` : ''}
    ${si.did ? `<p class="a-newsrow a-did">${icon('circle-check', { cls: 'g' })}<span>${esc(si.did)}</span></p>` : ''}
  </section>`;
}

// ---------------- 3. This week on your issues ----------------
function weekSittings() {
  const now = Date.now(), from = dayStart(now), to = from + 8 * 864e5, by = new Map();
  for (const h of S.hearings) {
    const t = Date.parse(h.scheduled_at), b = S.bills.find(x => x.id === h.bill_id);
    if (!b || h.status === 'cancelled' || t < from || t >= to || (t > now && !alive(b))) continue;
    const k = h.committee + '|' + h.scheduled_at, s = by.get(k) || { k, h, t, items: [] };
    s.items.push({ b, h }); by.set(k, s);
  }
  return [...by.values()].sort((x, y) => x.t - y.t);
}
function sittingTag(s) {
  const now = Date.now(), held = s.t <= now, n = s.items.length;
  const acted = s.items.filter(x => didKind(x.b, x.h, 'testimony') || didKind(x.b, x.h, 'email'));
  const wrote = s.items.filter(x => didKind(x.b, x.h, 'testimony')).length;
  const youDid = acted.length ? `${wrote === acted.length ? 'You testified' : 'You spoke up'}${n > 1 && acted.length < n ? ` on ${acted.length} of ${n}` : ''}` : '';
  if (held) {
    const os = s.items.map(x => outcomeOf(x.h)?.outcome).filter(Boolean);
    const said = !os.length ? 'Heard · decision coming' : os.length === n && os.every(o => o === os[0]) ? OUTCOME_PLAIN[os[0]] || 'Decided' : `${os.filter(o => /passed/.test(o)).length} of ${n} passed`;
    const good = os.length && os.every(o => /passed/.test(o));
    return `${youDid ? chip(youDid, 'ok', 'check') : ''}${chip(said, good ? 'ok' : '', good ? 'circle-check' : 'hourglass')}`;
  }
  if (youDid) return chip(youDid, 'ok', 'check');
  const due = s.h.testimony_deadline, d = dueInfo(s.h);
  // The day's heading says "written deadlines passed" once when they all have (review 9/28: four identical chips).
  if (d?.late) return s.quietLate ? '' : chip('Late testimony is still accepted', '', 'clock');
  // Amber is "due within 24 hours" and nothing else (A-5).
  return chip(`Due ${dayName(due)} ${time(due)}`, Date.parse(due) - now < 864e5 ? 'warn' : '', 'clock');
}
const openDue = s => s.t > Date.now() && s.items.some(x => !dueInfo(x.h)?.late && !settledOn(x.b, x.h));
function sittingRow(s) {
  const isNew = s.items.some(x => { const p = x.h.notice_posted_at && Date.parse(x.h.notice_posted_at); return p && S.prevVisit && p > Date.parse(S.prevVisit) && p <= Date.now(); });
  return `<li class="a-hr"><p class="a-hrt">${esc(time(s.h.scheduled_at))}</p><div class="a-hrc">
    <p class="a-hrw">${isNew ? '<span class="a-new" aria-label="New">New</span>' : ''}${esc(who(s.h.committee))}<span class="a-room"> · ${esc(roomLabel(s.h.room))}</span></p>
    <ul class="a-hrbills">${s.items.map(x => `<li><a href="${billPath(x.b)}">${esc(nameOf(x.b))}${top(x.b) ? `<span class="a-prio sm">${icon('star')}<span class="sr">HIPHI priority</span></span>` : ''}</a></li>`).join('')}</ul>
    <div class="a-hrtag">${sittingTag(s)}</div></div></li>`;
}
function weekBlock() {
  const all = weekSittings(), now = Date.now();
  if (!all.length) return `<section class="a-sec" aria-labelledby="a-wk-h"><div class="a-sech"><h2 id="a-wk-h">This week on your issues</h2></div>
    <p class="a-empty"><b>No hearings on your issues this week.</b> Committees post hearings about two days ahead. They’ll show here, with what you can do.</p></section>`;
  const days = new Map(); for (const s of all) { const d = hstDay(s.t); (days.get(d) || days.set(d, []).get(d)).push(s); }
  const bills = new Set(all.flatMap(s => s.items.map(x => x.b.id))).size;
  const tdy = hstDay(now), tmr = hstDay(now + 864e5);
  const out = [...days.entries()].map(([d, ss]) => {
    const iso = ss[0].h.scheduled_at, urgent = d === tdy && ss.some(openDue);
    const head = `${d === tdy ? 'Today' : d === tmr ? 'Tomorrow' : wd(iso)} <span>${esc(d === tdy || d === tmr ? `${wd(iso)} ${dnum(iso)}` : dnum(iso))}</span>`;
    // Today with every written deadline gone says so once under its heading, not as a chip on each hearing (review 9/28:
    // four identical chips), and is not marked urgent. It used to fold to one line so the hearings people can still act on
    // came first; late testimony and watching live are things to do too, so it stays open (R-190).
    let note = '';
    if (d === tdy && !ss.some(openDue)) {
      ss.forEach(s => { s.quietLate = true; });
      const late = ss.some(s => s.t > now && s.items.some(x => dueInfo(x.h)?.late && !settledOn(x.b, x.h)));
      note = `<p class="a-dnote">${late ? 'Written deadlines passed · late testimony is still accepted · watch live' : ss.every(s => s.t <= now) ? 'Heard today' : 'You’ve spoken up on these · watch live'}</p>`;
    }
    return `<div class="a-day${urgent ? ' today' : ''}"><h3 class="a-dh">${head}</h3>${note}<ul class="a-hrs">${ss.map(sittingRow).join('')}</ul></div>`;
  }).join('');
  return `<section class="a-sec" aria-labelledby="a-wk-h"><div class="a-sech"><h2 id="a-wk-h">This week on your issues</h2><p>${esc(plural(all.length, 'hearing'))} · ${esc(plural(bills, 'bill'))}</p></div>
    <div class="a-week">${out}</div></section>`;
}

// ---------------- 4. Where your issues stand ----------------
const ASK_DAYS = 21;
const askList = () => waitingBills(S.bills).filter(({ b, st }) => st.deadline.days <= ASK_DAYS && !/oppose/.test(b.hiphi_position || '')
  && agrees(b) !== false && chairContacts(st.committee).length && !askedChair(b, st.committee));
function issueState(i) {
  const now = Date.now(), from = dayStart(now), to = from + 8 * 864e5;
  const bs = issueBills(i).map(id => S.bills.find(b => b.id === id)).filter(Boolean);
  const live = bs.filter(alive), hs = bs.flatMap(b => S.hearings.filter(h => h.bill_id === b.id && h.status !== 'cancelled').map(h => ({ b, h })));
  const soon = hs.filter(x => { const t = Date.parse(x.h.scheduled_at); return t >= from && t < to && (t <= now || alive(x.b)); }).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  const ahead = soon.find(x => Date.parse(x.h.scheduled_at) > now);
  const passed = hs.filter(x => { const o = outcomeOf(x.h); return o && /passed/.test(o.outcome || '') && Date.parse(o.reported_at || x.h.scheduled_at) > now - 7 * 864e5 && Date.parse(o.reported_at || x.h.scheduled_at) <= now; });
  const law = bs.find(b => b.stage === 'enacted' || b.stage === 'governor');
  const lead = ahead?.b || passed[0]?.b || law || live.sort((x, y) => stepsOf(y).idx - stepsOf(x).idx)[0] || bs[0];
  const state = law ? 'law' : ahead ? 'hearing' : passed.length ? 'moved' : live.length ? 'waiting' : bs.length ? 'stopped' : 'none';
  return { i, bs, lead, state, ahead };
}
const STATE = { hearing: ['Hearing this week', 'info'], moved: ['Passed a committee', 'ok'], law: ['Became law', 'ok'], waiting: ['Waiting', ''], stopped: ['Stopped this session', ''], none: ['Nothing yet', ''] };
// "stops Mon, Mar 30 without a hearing" (review 9/28: "14 days left" did not say left for what).
const stopsBy = st => st?.deadline && !st.deadline.missed ? `stops ${dateLong(st.deadline.date + 'T12:00:00-10:00')} without a hearing` : '';
function issueRow(r) {
  const [t, tone] = STATE[r.state], tag = r.state === 'hearing' ? `Hearing ${dayName(r.ahead.h.scheduled_at)}` : t;
  // The bill's own name starts the line, so the issue at the top and the bill in the week are seen to be the same
  // thing (review 9/28). Dates belong to the week section; here only a waiting bill's cut-off.
  const st = r.lead && r.state === 'waiting' ? stopOf(r.lead) : null;
  const line = r.lead ? [nameOf(r.lead) === r.i.name ? '' : nameOf(r.lead), stepsOf(r.lead).where, stopsBy(st)].filter(Boolean).join(' · ') : '';
  return `<li><a class="a-irow" href="#/issue/${esc(r.i.slug)}"><span class="a-itop"><b>${esc(r.i.name)}</b>${chip(tag, tone)}</span>
    ${r.lead ? stepBar(r.lead) : ''}${line ? `<span class="a-iline">${esc(line)}</span>` : ''}</a></li>`;
}
function standBlock() {
  const iss = followedIssues(); if (!iss.length) return '';
  const rows = iss.map(issueState);
  let body;
  if (rows.length <= 6) body = `<ul class="a-irows">${rows.map(issueRow).join('')}</ul>`;
  else {
    // Many issues: the ones with a hearing this week are already in the week above, so list only the rest (review 9/28:
    // a mostly amber bar repeated the week).
    const inWeek = rows.filter(r => r.state === 'hearing').length, others = rows.filter(r => r.state !== 'hearing');
    body = `${inWeek ? `<p class="a-inweek">${icon('calendar')}<span>${esc(plural(inWeek, 'issue has', 'issues have'))} a hearing this week, listed above.</span></p>` : ''}
      ${others.length ? `<ul class="a-irows">${others.map(issueRow).join('')}</ul>` : ''}`;
  }
  return `<section class="a-sec" aria-labelledby="a-st-h"><div class="a-sech"><h2 id="a-st-h">Where your ${esc(plural(iss.length, 'issue'))} ${iss.length === 1 ? 'stands' : 'stand'}</h2></div>
    <div class="a-stand">${body}<a class="a-all" href="#/bills">See all ${iss.length} in My issues${icon('chevron-right')}</a></div></section>`;
}
// Bills that need a hearing, right under the week (R-194): things to do come before where the issues stand. Left out when
// the Now card above already offers them (nothing due this week, R-071).
function asksBlock(asks) {
  if (!asks.length) return '';
  return `<section class="a-sec" aria-labelledby="a-ask-h"><div class="a-sech"><h2 id="a-ask-h">${asks.length === 1 ? 'A bill that needs a hearing' : 'Bills that need a hearing'}</h2><p>${esc(plural(asks.length, 'bill'))}</p></div>
    <div class="a-asks"><p class="a-askh">${icon('hourglass')}<span>The committee chair decides which bills get a hearing. A short, polite note helps.</span></p>
      <ul>${asks.map(({ b, st }) => `<li><a href="${billPath(b)}"><span><b>${esc(nameOf(b))}</b><small>${esc(spaced(b.bill_number))} · ${esc(stopsBy(st))}</small></span>${icon('chevron-right')}</a></li>`).join('')}</ul></div></section>`;
}

// ---------------- the page ----------------
function calmCard(si) {
  const live = S.bills.filter(alive).length;
  return `<section class="a-calm" aria-labelledby="a-calm-h"><span class="a-calmic">${icon('check')}</span><div>
    <h2 id="a-calm-h">Nothing needs you this week</h2>
    <p>${live ? 'Your bills are waiting for their next step. We’ll show you here the day there’s something you can do.' : 'The bills on your issues have finished for this session.'}</p></div></section>`;
}
let delegated = false;
function view() {
  const name = (wiz().name || '').trim().split(/\s+/)[0];
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST });
  // The top card, in order: testimony due this week; everything due passed over; a bill that stops without a hearing;
  // the news; and only when there is truly nothing, "Nothing needs you this week".
  const due = dueItems(), items = due.filter(x => !S.aSkip.has(skipKey(x))), asks = askList(), si = sinceItems();
  let first, calm = false;
  if (items.length) first = nowCard(items) + sinceCard(si);
  else if (due.length) first = seenCard(due.length) + sinceCard(si);
  else if (asks.length) first = askCard(asks) + sinceCard(si);
  else { const news = sinceCard(si, { lead: true }); calm = !news; first = news || calmCard(si); }
  const hasWeek = weekSittings().length;
  const ask = S.nudge && S.nudge !== 'action' ? `<div class="a-nudge">${nudgeCard(S.nudge)}</div>` : '';
  // A plan to go today or tomorrow is the day's plan, so it leads, as on today's Home (R-142); later ones go to the end.
  const plans = goingPlans(), goSoon = goingCard(plans.filter(p => p.soon)), goLater = goingCard(plans.filter(p => !p.soon));
  const tail = [goLater, extras.newIssues(), extras.phone(), extras.meet(), laterCard()].filter(Boolean).join('');
  // A saved letter is left to the Now card only when it is the Now card's hearing, whose button then says "Finish sending
  // your testimony" (R-187); one for another hearing due this week, a row under "Also due" or in the week, keeps its own
  // card, or nothing on the page would mention it (R-189).
  return `<div class="ah">
    ${extras.account()}
    <header class="a-top"><p class="a-date">${esc(date)}</p><h1>Aloha${name ? `, ${esc(name)}` : ''}</h1></header>
    ${extras.draft(new Set(items.slice(0, 1).map(x => x.h.id)))}${goSoon}
    ${first}
    ${calm && !hasWeek ? '' : weekBlock()}
    ${!items.length && !due.length && asks.length > 0 ? '' : asksBlock(asks)}
    ${ask}
    ${standBlock()}
    ${tail ? `<div class="a-extras">${tail}</div>` : ''}
  </div>`;
}
export default {
  tab: 'home',
  title: route => today.title(route),
  render(route) {
    // The first visit's own Home, between sessions, following nothing and Your session (#/recap) stay today's Home (the
    // test is about this one).
    delegated = route?.name === 'recap' || sessionInfo().phase !== 'in' || !followsAnything() || welcomed();
    return delegated ? today.render(route) : view();
  },
  wire(route) {
    if (delegated) { today.wire && today.wire(route); return; }
    const root = document.querySelector('.ah'); if (!root) return;
    wireActions(root); wireNudge(root); wireExtras(root);
    // "Show the next one" says what it did, with Undo (B-5, A-16).
    root.querySelectorAll('[data-a-skip]').forEach(el => el.onclick = () => { const k = el.dataset.aSkip; S.aSkip.add(k); app.render();
      toast(`${el.dataset.aName} moved out of the way. It’s still due, in the week below.`, { undo: () => { S.aSkip.delete(k); app.render(); } }); });
    root.querySelectorAll('[data-a-unskip]').forEach(el => el.onclick = () => { S.aSkip.clear(); app.render(); });
  },
};
