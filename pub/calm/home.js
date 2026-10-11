// The calm Home (R-222 Direction 1, "one thing, then your issues"; Nate 10/10: "accept all"). Since 10/10 it is the layout
// test's version A ('layout', backend 149, off on the live site): it replaced R-071's Layout A inside the same test, and the
// test now compares Home only, so today's bill page and tabs stay (app.js). One shape for every moment, phone first:
//   1. The greeting: their name and one line, the one result worth saying or that nothing is new. Between sessions: the
//      break, what HIPHI backed that became law, and one link to their session.
//   2. One card: the soonest thing to do, today's white action card ("1 of 4 due today"; "Show the next one" brings up the
//      next, as version A's did); the hearing ask when that is sooner; a plan to go on its day. Between sessions, the one
//      thing to do then. Nothing at all when nothing is due: the greeting says so.
//   3. Your issues: one row each, the issue's name, one phrase for where it stands and its next date, soonest first. Amber
//      only inside 24 hours (A-5). "New" when it changed since the last visit (Nate's answer 2: the one thing, then where
//      the issues stand, with what changed as a word on the row).
//   4. At most two quiet lines: their session, and the profile ask (home.js profileLine).
// The budget it keeps (A-23, tests/home_calm.py): at most four blocks of at most two shapes, one filled button, each bill
// named once, under two phone screens for 3 issues and three for 16. What left Home and where it went: the review
// (backend docs/requests/R-222-assessment.md, section 6).
// Still today's Home: Your session (#/recap), following nothing, and the first visit's ending on Home (R-098: its
// celebration happens there).
import { S, app, esc, icon, toast, nick, headline, billPath, alive, openActions, dayWord, timeWord, dateLong, hstDay, hiT, HST,
  followedIssues, issueBills, outcomeOf, didKind, sessionInfo, followsAnything, wiz, settledOn, plainStatus, testimonyDraft,
  followSummary, winsIn, ensureRecapPool, isResolution, nudge } from '../core.js';
import { btn, chip, skeleton } from '../ui.js';
import { actionCard, wireActions, wireNudge, goingPlans, goingCard } from '../actions.js';
import { celebrate } from '../fx.js';
import today, { calmParts as P, wireExtras } from '../home.js';

S.aSkip ??= new Set();   // cards passed over with "Show the next one", for this visit
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const nameOf = b => nick(b) || headline(b, 70);
const time = iso => timeWord(iso).replace(':00', '').replace(' AM', ' am').replace(' PM', ' pm');
// "today", "tomorrow", "Wed" within the week; "Mar 30" further out, where a weekday alone would be ambiguous.
function dayShort(iso) {
  const d = dayWord(iso);
  if (/^today/.test(d)) return 'today';
  if (/^tomorrow/.test(d)) return 'tomorrow';
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })
    : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
}
const when = iso => `${dayShort(iso)} ${time(iso)}`;
const prevVisit = () => S.prevVisit ? Date.parse(S.prevVisit) : 0;
const isNew = t => { const p = prevVisit(); return !!p && !!t && t > p && t <= Date.now(); };
const skipKey = x => x.h.id + '|' + x.b.id;
const byDeadline = (x, y) => x.h.testimony_deadline.localeCompare(y.h.testimony_deadline);

// ---------------- what there is to do ----------------
// Every testimony deadline still open in the next 7 days, soonest first, twins as one (home.js twinCards, R-131).
function dueAll() {
  const week = Date.now() + 7 * 864e5;
  return P.twinCards(openActions(S.bills, S.hearings).filter(x => !x.late && !settledOn(x.b, x.h) && x.h.testimony_deadline
    && Date.parse(x.h.testimony_deadline) < week).sort(byDeadline));
}

// ---------------- 2. the one card ----------------
function theCard(c) {
  const k = c.card;
  // Right after a first action from a shared link, nothing is singled out: a bigger ask straight after the one just done
  // backfires (R-150's research; R-190 kept it on today's Home).
  const focus = !(c.welcome && !c.fin);
  if (k.kind === 'due') {
    const x = k.items[0], day = hstDay(x.h.testimony_deadline), same = k.items.filter(y => hstDay(y.h.testimony_deadline) === day).length;
    const ofN = same > 1 ? `1 of ${same} that day` : '';   // the line already says the day ("Testimony due tomorrow (Tue) at 1:00 PM · 1 of 2 that day")
    const next = k.items.length > 1 ? `<p class="cm-next">${btn('Show the next one', { kind: 'text', sm: true, iconEnd: 'arrow-right', attrs: { 'data-cm-skip': skipKey(x), 'data-cm-name': nameOf(x.b) } })}</p>` : '';
    return `${actionCard(x.b, x.h, { focus, why: c.why, ofN, twin: S.hmTwins?.get(x.b.id) || null, heading: 'h2' })}${next}`;
  }
  if (k.kind === 'seen') return `<p class="cm-seen">${icon('eye')}<span>You’ve seen everything due this week.</span>${btn(`Show the ${k.n === 1 ? 'one' : k.n} you skipped`, { kind: 'text', sm: true, attrs: { 'data-cm-unskip': '1' } })}</p>`;
  if (k.kind === 'ask') return P.askCard(k.ask, focus);
  if (k.kind === 'go') return goingCard(k.plans);
  return '';
}
// The card's kind, in order: testimony due (unless the soonest hearing ask runs out first), everything due passed over, the
// hearing ask, a plan to go today or tomorrow. A hearing ask runs out at the end of its cut-off day.
function pickCard(due, asks, plans) {
  const items = due.filter(x => !S.aSkip.has(skipKey(x))), ask = asks[0];
  const askFirst = ask && (!items.length || hiT(ask.st.deadline.date) < Date.parse(items[0].h.testimony_deadline));
  if (items.length && !askFirst) return { kind: 'due', items, bill: items[0].b };
  if (ask) return { kind: 'ask', ask, bill: ask.b };
  if (due.length) return { kind: 'seen', n: due.length };
  const soon = plans.filter(p => p.soon);
  if (soon.length) return { kind: 'go', plans: soon, bill: soon[0].b };
  return { kind: '' };
}

// ---------------- 3. your issues ----------------
// One phrase for where an issue stands, from the first of these that is true of any of its bills: testimony open; a
// hearing ahead (with what they did about it); a cut-off for a hearing; a decision in the last two weeks, or one coming;
// became law; where its furthest bill is; did not advance. t: the date that orders the rows (soonest first).
const RESULT = { passed: 'Passed a committee', passed_amended: 'Passed a committee with changes', deferred: 'Put on hold', recommitted: 'Sent back for more work' };
function issueState(i, c) {
  const ids = new Set(issueBills(i)), bs = S.bills.filter(b => ids.has(b.id)), has = b => ids.has(b.id), now = Date.now();
  const d = c.due.find(x => has(x.b));
  if (d) { const t = Date.parse(d.h.testimony_deadline);
    return { t, warn: t - now < 864e5, fresh: isNew(Date.parse(d.h.notice_posted_at || 0)), text: `${testimonyDraft(d.h) ? 'Your letter is started · due' : 'Testimony due'} ${when(d.h.testimony_deadline)}` }; }
  const h = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) > now && alive(S.bills.find(b => b.id === x.bill_id) || {}))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) { const b = bs.find(x => x.id === h.bill_id), plan = c.plans.some(p => p.h.id === h.id);
    const did = didKind(b, h, 'testimony') ? 'You testified' : didKind(b, h, 'email') ? 'You emailed the chair' : plan ? 'You plan to go' : '';
    return { t: Date.parse(h.scheduled_at), fresh: isNew(Date.parse(h.notice_posted_at || 0)), text: `${did ? `${did} · hearing` : 'Hearing'} ${when(h.scheduled_at)}` }; }
  const a = c.asksAll.find(x => has(x.b));
  if (a) { const t = hiT(a.st.deadline.date) + 12 * 36e5;   // the end of the cut-off day
    return { t, warn: t - now < 864e5, text: `Needs a hearing by ${dateLong(a.st.deadline.date + 'T12:00:00-10:00')}` }; }
  // The latest decision in the last 14 days, or a hearing in the last 3 days still waiting for one.
  const past = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) <= now && Date.parse(x.scheduled_at) > now - 14 * 864e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  for (const x of past) {
    const o = outcomeOf(x), at = o && Date.parse(o.reported_at || x.scheduled_at);
    if (o?.outcome && RESULT[o.outcome]) return { rank: 1, fresh: isNew(at), text: `${RESULT[o.outcome]} ${dayShort(new Date(at).toISOString())}` };
    if (!o?.outcome && Date.parse(x.scheduled_at) > now - 3 * 864e5) return { rank: 1, text: `Heard ${dayShort(x.scheduled_at)} · decision coming` };
  }
  const law = bs.find(b => b.stage === 'enacted' || b.stage === 'governor');
  if (law) return { rank: 2, fresh: isNew(hiT(law.last_action_date || '1970-01-01')), text: plainStatus(law).short };
  const live = bs.filter(alive);
  if (live.length) return { rank: 3, text: plainStatus(live[0]).short };
  return { rank: 4, text: bs.length ? 'Did not advance this year' : 'No bills on it yet' };
}
const rowHtml = r => `<li><a class="cm-row" href="${esc(r.href)}"><span class="cm-rtext"><span class="cm-rname">${esc(r.name)}</span>
    <span class="cm-rstat${r.warn ? ' warn' : ''}">${r.fresh ? '<b class="cm-new">New</b> ' : ''}${esc(r.text)}</span></span>${icon('chevron-right', { cls: 'cm-chev' })}</a></li>`;
function issuesBlock(rows, n) {
  if (!rows.length) return '';
  return `<section class="cm-issues" aria-labelledby="cm-iss-h"><h2 id="cm-iss-h" class="cm-h">Your issues</h2>
    <ul class="cm-rows" role="list">${rows.map(rowHtml).join('')}</ul>
    ${btn(n > rows.length ? `See all ${n} in My issues` : 'See all my issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link cm-all' })}</section>`;
}

// ---------------- 1. the greeting ----------------
function sinceWhen() {
  const d = new Date(prevVisit()), days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(d))) / 864e5);
  return days <= 1 ? 'yesterday' : days < 7 ? d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'your last visit';
}
// One line: their own good news first (a law they spoke up for, a committee's yes after they acted), then the newest
// result on their issues, then that nothing is new. A result about the card's own bill goes on the card as its reason line,
// so the bill is named once (A-14). c.moments: the good news said here, seen once in wire().
function resultLine(c) {
  const gn = P.goodNews();
  const onCard = gn.find(x => c.card.bill && x.b.id === c.card.bill.id);
  if (onCard) { c.why = P.momentText(onCard); c.moments.push(onCard); }
  const g = gn.find(x => x !== onCard);
  if (g) { c.moments.push(g); return `<b>${esc(nameOf(g.b))}:</b> ${esc(P.momentText(g))}`; }
  const rs = (P.sinceItems() || []).filter(x => x.lead !== 'calendar' && !(c.card.bill && x.b.id === c.card.bill.id));
  if (rs.length) { const x = rs[0], first = x.text.replace(/^([^.]*\.).*$/, '$1');
    return `<b>${esc(nameOf(x.b))}:</b> ${esc(first)}${rs.length > 1 ? ` ${esc(plural(rs.length - 1, 'more result'))} on your issues below.` : ''}`; }
  // New hearings are not results: the rows mark them New, and the greeting counts them rather than saying "nothing new".
  if (c.freshN) return `News on ${c.freshN === 1 ? 'one of your issues' : `${c.freshN} of your issues`} since ${esc(sinceWhen())}.`;
  return prevVisit() ? `Nothing new on your issues since ${esc(sinceWhen())}.` : '';
}
function greeting(c) {
  const name = P.myName(), hi = `Aloha${name ? `, ${esc(name)}` : ''}`;
  if (c.welcome) {
    const said = followSummary() || plural(S.bills.length, 'bill');
    return `<header class="cm-head"><h1 class="hero">${hi}</h1><p class="lede">You follow ${esc(said)}. ${c.card.kind ? 'Here’s the first thing you can do.' : 'We keep watch, and when one has a hearing, a simple way to help shows up here.'}</p></header>`;
  }
  const line = resultLine(c), quiet = !c.card.kind ? 'Nothing needs you this week. When there’s something you can do, it shows up here.' : '';
  return `<header class="cm-head"><p class="eyebrow">${esc(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }))}</p>
    <h1 class="hero">${hi}</h1>${line || quiet ? `<p class="lede">${line}${line && quiet ? ' ' : ''}${quiet}</p>` : ''}</header>`;
}

// ---------------- the page, in session ----------------
function inSession(si, { welcome, fin }) {
  const due = dueAll(), asksAll = P.oneIdeaAsks(due), plans = goingPlans();
  const card = pickCard(due, asksAll, plans);
  const c = { si, welcome, fin, due, asksAll, plans, card, why: undefined, moments: [] };
  const iss = followedIssues();
  const rows = iss.map(i => ({ i, ...issueState(i, c) })).sort((x, y) => (x.t ?? Infinity) - (y.t ?? Infinity) || (x.rank ?? 0) - (y.rank ?? 0) || x.i.name.localeCompare(y.i.name))
    // Nothing is new seconds after the first visit: everything on the page was just seen there.
    .map(r => ({ ...r, fresh: !welcome && r.fresh, name: r.i.name, href: `#/issue/${r.i.slug}` }));
  c.freshN = rows.filter(r => r.fresh).length;
  const head = greeting(c);   // before the card: it decides the card's reason line (c.why)
  S.cmMoments = c.moments;
  const later = P.laterCard();
  const lines = [welcome ? '' : P.sessionLink(si.yr), P.profileLine()].filter(Boolean).join('');
  return `<div class="hm cm${welcome ? '' : ' cm-met'}">
    ${head}
    ${card.kind ? `<section class="cm-card" aria-label="${card.kind === 'go' ? 'Your plan' : 'The next thing you can do'}">${theCard(c)}</section>` : ''}
    ${later}
    ${issuesBlock(rows, iss.length)}
    ${lines ? `<div class="cm-lines">${lines}</div>` : ''}
  </div>`;
}

// ---------------- the page, between sessions ----------------
// The break, the wins and their session in the greeting; the one thing to do now (a hello to their legislators); their
// issues as rows, each with what became of it.
function offSession(si, { welcome }) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1, name = P.myName();
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  ensureRecapPool(yr); const wins = winsIn(yr);
  const lede = `The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}.${wins && wins.length ? ` In ${yr}, ${esc(plural(wins.length, 'bill'))} HIPHI backed became law.` : ''}`;
  const known = P.districtsKnown();
  const ready = known ? [`Say aloha before ${nextYr}`, `Lawmakers are writing their ${nextYr} bills now. A short hello from someone in their district tells them what you care about. It takes about 2 minutes.`]
    : ['Get ready for January', 'Know who represents you before the first hearing. It takes 30 seconds.'];
  const card = `<section class="card hm-ready" aria-labelledby="cm-rd"><h2 id="cm-rd">${ready[0]}</h2><p class="muted">${ready[1]}</p>
    <div class="btncol">${btn(known ? 'Write to my legislators' : 'Find my legislators', { kind: 'primary', icon: known ? 'mail' : 'landmark', href: '#/legislators' })}</div></section>`;
  // Each issue's outlook (staff write it in Staff v2) to its first sentence: one phrase a row, as in session; the whole
  // outlook is on the issue's page (Leilani's sixteen ran to 2,600px whole).
  const first = t => (String(t || '').match(/^.*?[.!?](?=\s|$)/) || [String(t || '')])[0];
  const rows = P.myIssues(yr).map(r => ({ name: r.title, text: first(r.sub), href: r.href }));
  return `<div class="hm cm cm-off">
    <header class="cm-head"><h1 class="hero">Aloha${name ? `, ${esc(name)}` : ''}</h1><p class="lede">${lede}</p>
      ${welcome ? '' : P.sessionLink(yr)}${P.meetLine()}</header>
    <section class="cm-card" aria-label="The thing you can do now">${card}</section>
    ${P.laterCard()}
    ${issuesBlock(rows, followedIssues().length)}
    ${P.profileLine() ? `<div class="cm-lines">${P.profileLine()}</div>` : ''}
  </div>`;
}

let delegated = false;
export default {
  tab: 'home',
  title: route => today.title(route),
  render(route) {
    if (!S.featured || !S.pool) return skeleton(4);
    const welcome = P.welcomed(), fin = !!wiz().finale;
    delegated = route?.name === 'recap' || !followsAnything() || (welcome && fin && P.endHome());
    if (delegated) return today.render(route);
    const si = sessionInfo();
    // A fresh arrival on the first visit's own Home, the email step skipped: one ask, as a line (core's nudge rules).
    if (!document.querySelector('#main .cm') && welcome && !S.nudge && !S.session && !P.alertsGiven()) nudge('follow');
    return si.phase === 'in' ? inSession(si, { welcome, fin }) : offSession(si, { welcome });
  },
  wire(route) {
    if (delegated) { today.wire && today.wire(route); return; }
    const root = document.querySelector('#main .cm'); if (!root) return;
    wireActions(root); wireNudge(root); wireExtras(root);
    // "Show the next one" says what it did, with Undo (B-5, A-16): the card it moved is still on its issue's row.
    root.querySelectorAll('[data-cm-skip]').forEach(el => el.onclick = () => { const k = el.dataset.cmSkip; S.aSkip.add(k); app.render();
      toast(`${el.dataset.cmName} moved out of the way. It’s still due: its issue below says when.`, { undo: () => { S.aSkip.delete(k); app.render(); } }); });
    root.querySelectorAll('[data-cm-unskip]').forEach(el => el.onclick = () => { S.aSkip.clear(); app.render(); });
    // The greeting's good news is seen once, as a good news card was (home.js seeMoment); a law they spoke up for gets its
    // full-screen moment the first time it is said (C-7, the biggest there is).
    const ms = S.cmMoments || []; S.cmMoments = null;
    const m = ms.filter(x => P.seeMoment(x)).find(x => x.kind === 'law');
    if (m) setTimeout(() => celebrate({ title: `A bill you spoke up for ${isResolution(m.b) ? 'was adopted' : 'became law'}`, sub: `${nameOf(m.b)}. Mahalo for speaking up.`, go: 'Continue' }), 400);
  },
};
