// Staff v6 · Hearings (R-336 spec 3.3 and 6; V13, V14, V24, R-329, W53, F68, F77-F80, F105, F134-F138). A person comes here
// for two jobs, one page tab each (D12):
//   This week (#/hearings/week): one hearing card per sitting, day by day (steps.js hearingCard: time and room large, who is
//     going with I'm going on the card, each of our bills with where its testimony stands). A sitting that moved says so,
//     and someone still down for the old date is asked "still going?" above the new one (W53). The Capitol's deadlines
//     sit on their day. Under the days, one line says how many bills still need a hearing and opens Get hearings (it
//     replaces v5's deadline box over the grid; the Get hearings tab carries the count), then the fenced "Also worth
//     doing" ideas (F80: at most 5, never counted, never due, each says why, each can be done, put off or refused, with
//     Undo). Hearings on bills we only monitor wait behind "+N on bills you monitor" (F68).
//   Get hearings (#/hearings/ask): the ONE open board (push.js askBoard), under each deadline in words, grouped by chair,
//     soonest notice first: Ask · Ask the chair to schedule a vote · Waiting on a reply (They replied) · Scheduled (Say mahalo).
// Both have the same visible scope switch: Mine · My coalitions · Team (?scope=, remembered per person).
// #/hearings with no tab opens Get hearings when the person has a bill waiting for a hearing and no hearing this week,
// else This week (spec 3.3). Old addresses arrive here: #/?view=week&w=1 is #/hearings?w=1 (app.js).
// What it replaces (A-25, rule 7.8): v5's This week grid (testimony-deadline cards, hearing blocks, Other to-dos: the
// deadlines are on each bill's line in the cards now, and to-dos are Today's), v5's deadline box with its push board, the
// Team switch's week, and the two "who to ask" boards (this one and Holding's: Legislators > Who to ask draws askBoard).
import { S, DB, esc, hooks, SESSION_OVER } from './data.js';
import { billById, suggestions, SUGGEST_CAP, setSugg, suggState, billRoute, codesOf, deadlineCalendar, gateApplies, gateGloss, plainDeadlines } from './model.js';
import { icon, btn, iconBtn, toast, segmented, menuSheet } from './ui.js';
import { hearingCard, nameWords, numWords, sayWords, nw, dayWords, timeWords, wireSteps } from './steps.js';
import { askBoard, askSummary, scopesFor, defaultScope, scopeOk, whoseWords, coalOf, SCOPES, freshScope, toAskWords, decideWords, nwParts } from './push.js';
import { movedAskHTML, wireMoved, oldSitting, seedMoved } from './moved.js';

const HR = 36e5, DAY = 864e5;
const HST = { timeZone: 'Pacific/Honolulu' };
const hst = t => new Date(t).toLocaleDateString('en-CA', HST);
const noon = d => new Date(d + 'T12:00:00-10:00').getTime();
const addDays = (d, n) => hst(noon(d) + n * DAY);
const mondayOf = t => { const d = hst(t); return addDays(d, -((new Date(noon(d)).getUTCDay() + 6) % 7)); };
const fmt = (d, o) => new Date(noon(d)).toLocaleDateString('en-US', { ...HST, ...o });
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const ms = t => new Date(t).getTime();

// ---- whose hearings: the scope, from the address, else the person's last pick, else their usual (V13) ----
// The pick is saved in the person's settings (as the monitored-bills switch is), so a phone and a laptop agree (critic
// B-6); this browser's copy from the first build is still read, once, for anyone who picked before.
const KEY = () => `hiphi6_hscope_${S.me?.id || ''}`;
const remembered = () => { try { return localStorage.getItem(KEY()) || ''; } catch { return ''; } };
async function remember(v) {
  try { localStorage.setItem(KEY(), v); } catch { /* a private window: this visit only */ }
  try { await DB.patchPrefs({ hscope: v }); } catch { /* the address keeps it for this visit */ }
}
function scopeOf(route) {
  const ok = scopesFor().map(x => x[0]), want = [route?.q?.scope, S.me?.prefs?.hscope, remembered()].find(x => x && ok.includes(x));
  return want || defaultScope();
}
const switcher = scope => segmented('hscope', scopesFor(), scope, 'Whose hearings');

// ---- This week: the sittings, day by day ----
// A sitting is every hearing row with one committee and start time (hearing.js sittingOf); it is in a view when one of
// its bills is, or when the person is going to it (a hearing you said you would attend is always on your week).
const sitKey = h => `${h.committee}|${h.scheduled_at}`;
const goingTo = rows => !!S.me && rows.some(r => (S.attend?.[r.id] || []).includes(S.me.id));
const isMon = b => !b?.position || b.position === 'monitor';
function weekSittings(scope, mon) {
  const ok = scopeOk(scope), t0 = ms(mon + 'T00:00:00-10:00'), t1 = ms(addDays(mon, 6) + 'T23:59:59.999-10:00'), by = new Map();
  for (const h of S.hearings || []) {
    const t = ms(h.scheduled_at); if (!(t >= t0 && t <= t1)) continue;
    const k = sitKey(h); if (!by.has(k)) by.set(k, []); by.get(k).push(h);
  }
  const out = [];
  for (const rows of by.values()) {
    const live = rows.filter(r => r.status !== 'cancelled'), going = goingTo(rows);
    const bills = (live.length ? live : rows).map(r => billById(r.bill_id)).filter(b => b && b.tracked !== false);
    const mine = bills.filter(ok);
    if (!mine.length && !going) continue;
    // A cancelled sitting is shown only to someone still down for it and only while it has no new date (W53 asks them
    // on the new one instead).
    if (!live.length) { if (!going || rows.some(r => (S.hearings || []).some(n => n.status !== 'cancelled' && oldSitting(n)?.id === r.id))) continue; }
    const lead = live.find(r => { const b = billById(r.bill_id); return b && !isMon(b); }) || live[0] || rows[0];
    out.push({ h: lead, rows, t: ms(lead.scheduled_at), day: hst(lead.scheduled_at), mon: !going && mine.every(isMon) });
  }
  return out.sort((x, y) => x.t - y.t || String(x.h.committee).localeCompare(String(y.h.committee)));
}
const monOn = () => !!S.me?.prefs?.showMonitor;
const weekOff = route => Math.max(-26, Math.min(26, parseInt(route?.q?.w, 10) || 0));
const hasWeek = scope => weekSittings(scope, mondayOf(Date.now())).some(x => !x.mon || monOn());

// The day's heading: "Today · Mon 3/16", "Tomorrow · Tue 3/17", "Wed 3/18".
const dayHead = d => { const now = Date.now(); return d === hst(now) ? `Today · ${dayWords(d)}` : d === hst(now + DAY) ? `Tomorrow · ${dayWords(d)}` : dayWords(d); };
// One sitting's card as This week shows it (critic A-24, A-14: the week at a glance). The day's heading already says the
// day, so the card's own "Today" or "Tomorrow" goes, and "Watch it live" joins the going line instead of taking a line of
// its own; from 600px I'm going sits on the committee's line (hearings.css), so the going words need no row of their own
// height. About 75px less on today's cards, 25px on the rest. (Shared change asked of steps.js: a hearingCard option for
// this, so it is not done on the card's HTML here.)
// The bills only monitored are named on the card ("Also heard: SB 3142"), so a sitting with only those says which (Nate's
// walk: Julie's card said "1 bill we monitor" and named nothing).
const monNums = h => [...new Set((S.hearings || []).filter(r => r.committee === h.committee && r.scheduled_at === h.scheduled_at && r.status !== 'cancelled')
  .map(r => billById(r.bill_id)).filter(b => b && b.tracked !== false && isMon(b)).map(b => numWords(b)))];
function weekCard(h) {
  let html = hearingCard(h, { from: 'week' });
  const nums = monNums(h);
  if (nums.length && nums.length <= 3) html = html.replace(/(<a class="v6-hcard-mon"[^>]*><span>[^<]*?)(?:\d+ bills? we monitor)/, `$1${nums.length === 1 ? '1 bill' : `${nums.length} bills`} we monitor: ${esc(nums.join(', '))}`);
  html = html.replace(/(<p class="v6-hcard-day">)[^<]*/, '$1');
  // "Going: Jaylen · Watch it live": the link goes inside the going words, so it never takes a line of its own
  const watch = html.match(/<p class="v6-hcard-watch">([\s\S]*?)<\/p>/);
  if (watch && /<p class="v6-hcard-going">/.test(html)) html = html.replace(watch[0], '').replace(/(<p class="v6-hcard-going">[\s\S]*?)(<\/span>)/, `$1<span class="hw-watch"> · ${watch[1]}</span>$2`);
  return html;
}
// One sitting: the question about a moved sitting first (W53), then its card. A slot of its own around each card: the card
// is a card, not a row of a list (D16 counts rows' buttons; the card carries I'm going and its bills' own buttons).
const slot = x => `<div class="hw-slot">${movedAskHTML(x.h, btn)}${weekCard(x.h)}</div>`;
// The Capitol's deadlines that fall in the week, on their day, in a few plain words (v5's grid marked them; F77). Only the
// ones that apply to this view's bills (a deadline that names its own bills, like the budget's, only for those).
function capDays(scope, mon) {
  const sun = addDays(mon, 6), list = (S.bills || []).filter(scopeOk(scope)), out = new Map();
  for (const d of deadlineCalendar()) if (d.date >= mon && d.date <= sun && gateApplies(d, list)) { if (!out.has(d.date)) out.set(d.date, []); out.get(d.date).push(d); }
  return out;
}
// The deadline's Capitol name only for people who own bills and admins, linked to Help's Capitol words; anyone else reads
// only what it means, "Thu 3/19: bills sent to 3 or more committees must clear their first committee" (C-15; Nate's walk:
// helpers met "Triple filing" with no way to learn it).
const capLine = ds => (ds || []).map(d => { const g = gateGloss(d.label);
  // (the day's heading above says the day, so the gloss stands alone: A-14)
  if (plainDeadlines() && g) return `<p class="hw-cap">${icon('landmark')}<span>${nw(esc(g.charAt(0).toUpperCase() + g.slice(1)))}</span></p>`;
  return `<p class="hw-cap">${icon('landmark')}<span>Capitol deadline: <a class="hw-cap-n" href="#/help/words?w=${encodeURIComponent(d.label)}">${esc(d.label)}</a>${g ? `<span class="hw-cap-g"> · ${esc(g)}</span>` : ''}</span></p>`; }).join('');

// The one line under the days (it replaces v5's deadline box over the grid): how many bills still need a hearing, and
// the day to ask the first chair by, opening Get hearings. Under the days, not over them: who comes to see today's
// hearing sees it first (critic A-1, P-1: the first card was at 460px on a phone); the tab carries the count too.
// It says the tab's own count in the tab's words, push.js toAskWords ("20 to ask · 16 by Mon 3/30", the same on Today
// and Bills: Nate's walk found "49 of your coalitions' bills need a hearing" beside a different tab count); with nothing
// left to ask, no line (the tab has no count then either).
// Bills heard but not voted on are not "to ask" (the board says them on their own line): with none left to ask, the line
// says them in the board's own words, so Get hearings is still one tap away for them.
function askLine(s, scope) {
  const t = SESSION_OVER ? '' : toAskWords(s) || decideWords(s?.decide || 0); if (!t || !tabCounts()) return '';
  const href = `#/hearings/ask${scope !== defaultScope() ? `?scope=${scope}` : ''}`;
  return `<a class="hw-ask" href="${esc(href)}">${icon('flag')}<span class="hw-ask-t"><span class="hw-ask-n">${nwParts(esc(t))}</span></span><span class="hw-ask-go">Get hearings${icon('chevron-right', { cls: 'v6-chev' })}</span></a>`;
}
// Someone who owns no bills has no pile of their own to ask: the tab carries no count for them, and the line is not drawn
// (Nate's walk: Patti's Get hearings showed Lauren's 15 on every visit; D4's door on Today is the way to help).
const tabCounts = () => !!S.me?.is_admin || (S.bills || []).some(b => (S.assignments?.[b.id] || []).includes(S.me?.id));

// ---- "Also worth doing" (F80): fenced off, at the foot, never counted, never due ----
// Good ways to spend a quiet hour, from each bill's own pathway (model.js suggestions): a plain summary for the public
// page, thanking a chair who moved a bill, telling supporters a hearing is coming, deciding a position. A chair ask is not
// here: it is the bill's Ask on Get hearings (one home, rule 7.5). Each says why; each can be done, put off two weeks or
// refused for that bill, with Undo. Only on your own bills: a teammate's answers are theirs to give (Nate, 9/21).
let SUGS = new Map();
function suggList(scope) {
  SUGS = new Map();
  if (scope !== 'mine' || SESSION_OVER) return [];
  const list = suggestions((S.bills || []).filter(scopeOk('mine')), { cap: Infinity }).filter(s => s.kind !== 'chair').slice(0, SUGGEST_CAP);
  for (const s of list) SUGS.set(s.key, s);
  return list;
}
function suggHTML(list) {
  if (!list.length) return '';
  const card = (s, i) => { const ext = !!s.act.ext, mail = /^mailto:/i.test(s.act.href || '');
    return `<div class="hw-sg" data-sg="${esc(s.key)}">
      <a class="hw-sg-bill" href="${esc(billRoute(s.b))}"><span class="v6-row-name">${esc(nameWords(s.b))}</span><span class="v6-row-num">${esc(numWords(s.b))}</span></a>
      <p class="hw-sg-t" id="hw-sg${i}">${esc(s.title)}</p>
      <p class="hw-sg-why">${esc(s.why)}</p>
      <div class="hw-sg-acts">${btn(esc(s.act.label), { kind: 'secondary', sm: true, href: s.act.href, target: ext && !mail ? '_blank' : undefined, iconEnd: ext && !mail ? 'external-link' : undefined, attrs: { 'aria-describedby': `hw-sg${i}` } })}
        <span class="hw-sg-ans" role="group" aria-label="${esc(`Answer: ${s.title}`)}">${btn('Done', { kind: 'text', sm: true, attrs: { 'data-sgdo': s.key, 'data-sgst': 'done' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-sgdo': s.key, 'data-sgst': 'later' } })}${btn('Not this bill', { kind: 'text', sm: true, attrs: { 'data-sgdo': s.key, 'data-sgst': 'never' } })}</span></div></div>`; };
  return `<section class="hw-sugg" aria-labelledby="hw-sugg-h"><h2 id="hw-sugg-h">Also worth doing</h2><p class="hw-sugg-sub">Ideas for a quiet hour. None of these is due.</p>
    <div class="hw-sglist">${list.map(card).join('')}</div></section>`;
}
// Done writes a line on the bill's timeline, but only once the Undo has lapsed (there is no call that takes an activity
// row back, so the write waits out the toast: v5's rule).
const LOGQ = new Map();
function queueLog(b, log) { if (!log) return; const k = `${b.id}|${log.title}`; clearTimeout(LOGQ.get(k)); LOGQ.set(k, setTimeout(() => { LOGQ.delete(k); DB.addActivity(b.id, log.type, log.title).catch(() => {}); }, 10000)); }
function cancelLog(b, log) { if (!log) return; const k = `${b.id}|${log.title}`; clearTimeout(LOGQ.get(k)); LOGQ.delete(k); }
async function answerSugg(key, state) {
  const s = SUGS.get(key); if (!s) return;
  const before = { ...suggState() };
  try { await setSugg(key, state); } catch (e) { toast(e, { err: true }); return; }
  if (state === 'done') queueLog(s.b, s.log);
  S.hwRefocus = '[data-sgdo]';
  hooks.render();
  toast(state === 'done' ? `Done: ${s.title}.${s.log ? ` Added to ${sayWords(s.b)}’s timeline.` : ''}` : state === 'later' ? 'Not now. It comes back in two weeks.' : `${sayWords(s.b)} will not be suggested for this again.`,
    { ok: state === 'done', undo: async () => { cancelLog(s.b, s.log); await DB.patchPrefs({ sugg: before }); hooks.render(); } });
}

// The week's dates and Previous / Next, on the scope switch's line (critic A-1: one line, not two, over the first card).
// This week's own dates say only "Mar 16 to 22" (the tab says "This week", A-14); on a phone they go, since each day's
// heading has its date. Another week says which ("Next week · Mar 23 to 29") everywhere.
function weekNav(route) {
  const off = weekOff(route), mon = addDays(mondayOf(Date.now()), off * 7), sun = addDays(mon, 6);
  const range = `${fmt(mon, { month: 'short', day: 'numeric' })} to ${fmt(sun, fmt(mon, { month: 'short' }) === fmt(sun, { month: 'short' }) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  const words = off === 0 ? range : off === 1 ? `Next week · ${range}` : off === -1 ? `Last week · ${range}` : range;
  return `<div class="hw-nav${off === 0 ? ' now' : ''}"><p class="hw-range">${esc(words)}</p>
    <div class="hw-wbtns">${iconBtn('chevron-left', 'Previous week', { 'data-hweek': off - 1 })}${off ? btn('This week', { kind: 'text', sm: true, attrs: { 'data-hweek': 0 } }) : ''}${iconBtn('chevron-right', 'Next week', { 'data-hweek': off + 1 })}</div></div>`;
}
// On a phone, this week's Previous and Next sit under the days instead (the first hearing comes first, critic A-1; a
// three-way switch and the arrows do not fit one phone line). Another week keeps them at the top, where its dates are.
// (a phone keeps the week row with its arrows under the scope switch, as every width does: Nate's walk, Patti could not
// look at next week; the foot copy is gone)
const footNav = () => '';
function weekHTML(route, scope, sum) {
  const now = Date.now(), off = weekOff(route), mon = addDays(mondayOf(now), off * 7), today = hst(now);
  const all = weekSittings(scope, mon), monN = all.filter(x => x.mon).length, shown = all.filter(x => !x.mon || monOn()), caps = capDays(scope, mon);
  // Sittings on bills only monitored, while hidden, are one quiet line under their own day naming the bill and the time
  // ("+1 hearing on a bill you monitor: SB 3142, 2:00 PM"), never a line after the last day, where it read as that day's.
  const monHid = monOn() ? [] : all.filter(x => x.mon), monDay = d => monHid.filter(x => x.day === d);
  // Days already over this week fold into one line ("Earlier this week: 2 hearings held"): what is done may fold (7.3).
  const days = [...new Set([...shown.map(x => x.day), ...caps.keys(), ...monHid.map(x => x.day)])].sort();
  const past = off === 0 ? days.filter(d => d < today) : [], ahead = days.filter(d => !past.includes(d));
  const who = scope === 'team' ? 'the team monitors' : 'you monitor';
  const monLine = d => { const xs = monDay(d); if (!xs.length) return '';
    const said = xs.map(x => `${monNums(x.h).join(', ')}, ${timeWords(x.h.scheduled_at)}`).join('; ');
    return `<p class="hw-mon">${btn(`+${plural(xs.length, 'hearing')} on ${xs.length === 1 ? 'a bill' : 'bills'} ${who}: ${said}`, { kind: 'text', sm: true, icon: 'eye', attrs: { 'data-hwmon': '1', 'aria-pressed': 'false' } })}</p>`; };
  const dayHTML = d => `<section class="hw-day${d === today ? ' today' : ''}" aria-labelledby="hw-d-${d}"><h2 class="hw-dh" id="hw-d-${d}">${esc(dayHead(d))}</h2>${capLine(caps.get(d))}${shown.filter(x => x.day === d).map(slot).join('')}${monLine(d)}</section>`;
  const n = d => shown.filter(x => x.day === d).length, np = past.reduce((k, d) => k + n(d), 0);
  const earlier = past.length ? `<details class="hw-earlier"${S.hwEarlier ? ' open' : ''}><summary>${icon('history')}<span>${esc(np ? `Earlier this week: ${plural(np, 'hearing')} held` : 'Earlier this week')}</span>${icon('chevron-down', { cls: 'hw-chev' })}</summary>${past.map(dayHTML).join('')}</details>` : '';
  const whose = scope === 'team' ? 'the team’s bills' : whoseWords(scope);
  const when = off === 0 ? 'this week' : off === 1 ? 'next week' : off === -1 ? 'last week' : 'that week';
  const anyAhead = ahead.some(d => n(d)), monAhead = ahead.some(d => monDay(d).length);
  // Between sessions, said so, with what to do meanwhile (Nate's walk: "No hearings on HEAL bills this week" in November).
  const none = SESSION_OVER && !anyAhead ? `<p class="hw-none">${icon('calendar')}<span>The Legislature is between sessions. Hearings start after opening day, ${esc(dayWords(openingDay()))}. Until then: <a href="#/my-issues">get your issues ready</a>.</span></p>`
    : !anyAhead ? `<p class="hw-none">${icon('calendar')}<span>${esc(`${np ? 'No more hearings' : 'No hearings'} on ${whose}${monAhead ? ' we support or oppose' : ''} ${when}.`)}</span></p>` : '';
  const monBtn = monN && monOn() ? `<p class="hw-mon">${btn(`Hide the ${plural(monN, 'hearing')} on bills ${who}`, { kind: 'text', sm: true, icon: 'eye-off', attrs: { 'data-hwmon': '1', 'aria-pressed': 'true' } })}</p>` : '';
  return `${earlier}${none}${ahead.map(dayHTML).join('')}${monBtn}${footNav(route)}${off === 0 ? askLine(sum, scope) : ''}${off === 0 ? suggHTML(suggList(scope)) : ''}`;
}

// The next session's opening day: the calendar's, else the third Wednesday in January (the Hawaiʻi Constitution's day).
function openingDay() {
  const today = hst(Date.now()), cal = (S.sessionCal || []).map(c => c.opening_day).filter(d => d && String(d).slice(0, 10) > today).sort()[0];
  if (cal) return String(cal).slice(0, 10);
  const y = +today.slice(0, 4) + (+today.slice(5, 7) >= 2 ? 1 : 0), d1 = new Date(`${y}-01-01T12:00:00-10:00`).getUTCDay();
  return `${y}-01-${String(1 + ((3 - d1 + 7) % 7) + 14).padStart(2, '0')}`;
}

// ---- Get hearings ----
function askHTML(scope, auto = false) {
  // Opened here by the rule (spec 3.3: a bill waiting and no hearing this week), it says why, once, in a quiet line.
  const why = auto ? `<p class="hg-auto">${icon('calendar')}<span>${esc(`No hearings on ${scope === 'team' ? 'the team’s bills' : whoseWords(scope)} this week, so here is what still needs one.`)}</span></p>` : '';
  const how = `<p class="hg-how"><a href="#/help/hearing">How to ask for a hearing</a> · <a href="#/help/calendar">Session calendar</a> · <a href="#/legislators?view=holding">Holding our bills</a></p>`;
  if (SESSION_OVER) return `<p class="hg-empty">${icon('calendar')}<span>The session is over, so no bill is waiting for a hearing. The next session’s calendar is loaded in December.</span></p>${how}`;
  return why + askBoard({ scope }) + how;
}

// ---- the page ----
const viewOf = (route, scope) => route.view === 'week' || route.view === 'ask' ? route.view
  : route.q?.w ? 'week'   // v5's #/?view=week&w=1 (another week) is always the week
  : boardHas(scope) && !hasWeek(scope) ? 'ask' : 'week';
const boardHas = scope => !!askSummary({ scope });
// The page tabs (ui.js sectionNav's words and look; its This week address is #/hearings, which may open Get hearings by the
// rule above, so the tabs name their views). Get hearings carries how many bills are still to ask (sectionNav's count), so
// the number is in view without a card over the week (critic A-1).
function tabs(view, sum) {
  const n = tabCounts() ? sum?.toAsk || 0 : 0;
  return `<nav class="sv-tabrow sv-secnav" aria-label="Hearings"><a href="#/hearings/week"${view === 'week' ? ' aria-current="page"' : ''}>This week</a><a href="#/hearings/ask"${view === 'ask' ? ' aria-current="page"' : ''}>Get hearings${n ? ` <span class="sv-tn" aria-hidden="true">${n}</span><span class="sr">, ${esc(plural(n, 'bill'))} to ask</span>` : ''}</a></nav>`;
}

export default {
  tab: 'hearings',
  title: () => 'Hearings',
  render(route) {
    if (!S.me) return `<h1 class="v6-ptitle sv-h1">Hearings</h1><p class="hw-none">${icon('info')}<span>You are signed in, but the tracker does not know who you are yet. Ask your admin to add you.</span></p>`;
    seedMoved();   // the practice copy's moved sittings have someone down for the old date (W53), as Today's
    freshScope();   // who has a step on which bill is worked out again for this draw (push.js scopeOk)
    const scope = scopeOf(route), view = viewOf(route, scope), sum = SESSION_OVER ? null : askSummary({ scope });
    return `<div class="hw-page v-${view}">
      <h1 class="v6-ptitle sv-h1">Hearings</h1>
      ${tabs(view, sum)}
      <div class="hw-bar">${switcher(scope)}${view === 'week' ? weekNav(route) : ''}</div>
      ${view === 'ask' ? askHTML(scope, route.view !== 'ask') : weekHTML(route, scope, sum)}
    </div>`;
  },
  wire(route, root) {
    const page = root.querySelector('.hw-page'); if (!page) return;
    wireSteps(page, { after: () => hooks.render() });
    wireMoved(page, { toast, redraw: () => hooks.render() });
    const here = () => { const v = route.view === 'ask' || route.view === 'week' ? route.view : page.classList.contains('v-ask') ? 'ask' : 'week'; return `#/hearings/${v}`; };
    page.querySelectorAll('[data-seg="hscope"]').forEach(el => el.onclick = async () => {
      const v = el.dataset.val; await remember(v); S.hwRefocus = `[data-seg="hscope"][data-val="${v}"]`;
      const w = weekOff(route); S.go(`${here()}?scope=${v}${w ? `&w=${w}` : ''}`, { replace: true, keepScroll: true });
    });
    page.querySelectorAll('[data-hweek]').forEach(el => el.onclick = () => {
      const w = +el.dataset.hweek || 0, sc = route.q?.scope ? `scope=${route.q.scope}` : '';
      S.hwRefocus = `[aria-label="${el.getAttribute('aria-label') || 'Next week'}"]`;
      S.go(`#/hearings/week${w || sc ? `?${[w ? `w=${w}` : '', sc].filter(Boolean).join('&')}` : ''}`, { replace: true, keepScroll: true });
    });
    page.querySelector('[data-hwmon]')?.addEventListener('click', async () => {
      const on = !monOn();
      try { await DB.patchPrefs({ showMonitor: on }); } catch (e) { toast(e, { err: true }); return; }
      S.hwRefocus = '[data-hwmon]'; hooks.render();
    });
    page.querySelector('.hw-earlier')?.addEventListener('toggle', e => { S.hwEarlier = e.currentTarget.open; });
    page.querySelectorAll('[data-sgdo]').forEach(el => el.onclick = () => answerSugg(el.dataset.sgdo, el.dataset.sgst));
    // A redraw after an answer keeps the focus near where it was (B-4).
    if (S.hwRefocus) { const f = page.querySelector(S.hwRefocus); S.hwRefocus = null; f?.focus({ preventScroll: true }); }
  },
};
