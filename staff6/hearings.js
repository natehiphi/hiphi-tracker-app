// Staff v6 · Hearings (R-336 spec 3.3 and 6; V13, V14, V24, R-329, W53, F68, F77-F80, F105, F134-F138). A person comes here
// for two jobs, one page tab each (D12):
//   This week (#/hearings/week): one hearing card per sitting, day by day (steps.js hearingCard: time and room large, who is
//     going with I'm going on the card, each of our bills with where its testimony stands). A sitting that moved says so,
//     and someone still down for the old date is asked "still going?" above the new one (W53). Above the days, one line
//     says how many bills still need a hearing and opens Get hearings (it replaces v5's deadline box over the grid); below
//     them, the fenced "Also worth doing" ideas (F80: at most 5, never counted, never due, each says why, each can be done,
//     put off or refused, with Undo). Hearings on bills we only monitor wait behind "+N on bills you monitor" (F68).
//   Get hearings (#/hearings/ask): the ONE open board (push.js askBoard), under each deadline in words, grouped by chair,
//     soonest notice first: Ask · Ask for decision making · Waiting on a reply (They replied) · Scheduled (Say mahalo).
// Both have the same visible scope switch: My bills · My coalitions · Team (?scope=, remembered per person).
// #/hearings with no tab opens Get hearings when the person has a bill waiting for a hearing and no hearing this week,
// else This week (spec 3.3). Old addresses arrive here: #/?view=week&w=1 is #/hearings?w=1 (app.js).
// What it replaces (A-25, rule 7.8): v5's This week grid (testimony-deadline cards, hearing blocks, Other to-dos: the
// deadlines are on each bill's line in the cards now, and to-dos are Today's), v5's deadline box with its push board, the
// Team switch's week, and the two "who to ask" boards (this one and Holding's: Legislators > Who to ask draws askBoard).
import { S, DB, esc, hooks, SESSION_OVER } from './data.js';
import { billById, suggestions, SUGGEST_CAP, setSugg, suggState, billRoute, codesOf } from './model.js';
import { icon, btn, iconBtn, toast, segmented, menuSheet } from './ui.js';
import { hearingCard, nameWords, numWords, sayWords, nw, dayWords, wireSteps } from './steps.js';
import { askBoard, askSummary, scopesFor, defaultScope, scopeOk, whoseWords, coalOf, SCOPES } from './push.js';
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
const KEY = () => `hiphi6_hscope_${S.me?.id || ''}`;
const remembered = () => { try { return localStorage.getItem(KEY()) || ''; } catch { return ''; } };
const remember = v => { try { localStorage.setItem(KEY(), v); } catch { /* a private window: this visit only */ } };
function scopeOf(route) {
  const ok = scopesFor().map(x => x[0]), want = [route?.q?.scope, remembered()].find(x => x && ok.includes(x));
  return want || defaultScope();
}
const switcher = scope => `<div class="hw-scope">${segmented('hscope', scopesFor(), scope, 'Whose hearings')}</div>`;

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
// One sitting: the question about a moved sitting first (W53), then its card. A slot of its own around each card: the card
// is a card, not a row of a list (D16 counts rows' buttons; the card carries I'm going and its bills' own buttons).
const slot = x => `<div class="hw-slot">${movedAskHTML(x.h, btn)}${hearingCard(x.h, { from: 'week' })}</div>`;

// The one line over the days (it replaces v5's deadline box): how many bills still need a hearing, and when the first
// notice must post, opening Get hearings. Only this week, and only when there is something to ask.
function askLine(scope) {
  if (SESSION_OVER) return '';
  const s = askSummary({ scope }); if (!s) return '';
  const href = `#/hearings/ask${scope !== defaultScope() ? `?scope=${scope}` : ''}`;
  return `<a class="hw-ask" href="${esc(href)}">${icon('flag')}<span class="hw-ask-t"><span class="hw-ask-n">${esc(s.words)}</span>${s.firstWords ? `<span class="hw-ask-s">${nw(esc(s.firstWords))}</span>` : ''}</span><span class="hw-ask-go">Get hearings${icon('chevron-right', { cls: 'v6-chev' })}</span></a>`;
}

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

function weekHTML(route, scope) {
  const now = Date.now(), off = weekOff(route), mon = addDays(mondayOf(now), off * 7), sun = addDays(mon, 6), today = hst(now);
  const all = weekSittings(scope, mon), monN = all.filter(x => x.mon).length, shown = all.filter(x => !x.mon || monOn());
  const range = `${fmt(mon, { month: 'short', day: 'numeric' })} to ${fmt(sun, fmt(mon, { month: 'short' }) === fmt(sun, { month: 'short' }) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  const nav = `<div class="hw-nav"><p class="hw-range">${esc(off === 0 ? `This week · ${range}` : off === 1 ? `Next week · ${range}` : off === -1 ? `Last week · ${range}` : range)}</p>
    <div class="hw-wbtns">${iconBtn('chevron-left', 'Previous week', { 'data-hweek': off - 1 })}${off ? btn('This week', { kind: 'text', sm: true, attrs: { 'data-hweek': 0 } }) : ''}${iconBtn('chevron-right', 'Next week', { 'data-hweek': off + 1 })}</div></div>`;
  // Days already over this week fold into one line ("Earlier this week: 2 hearings held"): what is done may fold (7.3).
  const days = [...new Set(shown.map(x => x.day))].sort();
  const past = off === 0 ? days.filter(d => d < today) : [], ahead = days.filter(d => !past.includes(d));
  const dayHTML = d => `<section class="hw-day${d === today ? ' today' : ''}" aria-labelledby="hw-d-${d}"><h2 class="hw-dh" id="hw-d-${d}">${esc(dayHead(d))}</h2>${shown.filter(x => x.day === d).map(slot).join('')}</section>`;
  const n = d => shown.filter(x => x.day === d).length, np = past.reduce((k, d) => k + n(d), 0);
  const earlier = past.length ? `<details class="hw-earlier"${S.hwEarlier ? ' open' : ''}><summary>${icon('history')}<span>Earlier this week: ${esc(plural(np, 'hearing'))} held</span>${icon('chevron-down', { cls: 'hw-chev' })}</summary>${past.map(dayHTML).join('')}</details>` : '';
  const whose = scope === 'team' ? 'the team’s bills' : whoseWords(scope);
  const when = off === 0 ? 'this week' : off === 1 ? 'next week' : off === -1 ? 'last week' : 'that week';
  const none = !ahead.length ? `<p class="hw-none">${icon('calendar')}<span>${esc(past.length ? `No more hearings on ${whose} ${when}.` : `No hearings on ${whose} ${when}.`)}</span></p>` : '';
  const monBtn = monN ? `<p class="hw-mon">${btn(monOn() ? `Hide the ${plural(monN, 'hearing')} on bills ${scope === 'team' ? 'the team monitors' : 'you monitor'}` : `+${plural(monN, 'hearing')} on bills ${scope === 'team' ? 'the team monitors' : 'you monitor'}`, { kind: 'text', sm: true, icon: monOn() ? 'eye-off' : 'eye', attrs: { 'data-hwmon': '1', 'aria-pressed': String(monOn()) } })}</p>` : '';
  return `${off === 0 ? askLine(scope) : ''}${nav}${earlier}${none}${ahead.map(dayHTML).join('')}${monBtn}${off === 0 ? suggHTML(suggList(scope)) : ''}`;
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
function tabs(view) {
  return `<nav class="sv-tabrow sv-secnav" aria-label="Hearings"><a href="#/hearings/week"${view === 'week' ? ' aria-current="page"' : ''}>This week</a><a href="#/hearings/ask"${view === 'ask' ? ' aria-current="page"' : ''}>Get hearings</a></nav>`;
}

export default {
  tab: 'hearings',
  title: () => 'Hearings',
  render(route) {
    if (!S.me) return `<h1 class="v6-ptitle sv-h1">Hearings</h1><p class="hw-none">${icon('info')}<span>You are signed in, but the tracker does not know who you are yet. Ask your admin to add you.</span></p>`;
    seedMoved();   // the practice copy's moved sittings have someone down for the old date (W53), as Today's
    const scope = scopeOf(route), view = viewOf(route, scope);
    return `<div class="hw-page v-${view}">
      <h1 class="v6-ptitle sv-h1">Hearings</h1>
      ${tabs(view)}
      ${switcher(scope)}
      ${view === 'ask' ? askHTML(scope, route.view !== 'ask') : weekHTML(route, scope)}
    </div>`;
  },
  wire(route, root) {
    const page = root.querySelector('.hw-page'); if (!page) return;
    wireSteps(page, { after: () => hooks.render() });
    wireMoved(page, { toast, redraw: () => hooks.render() });
    const here = () => { const v = route.view === 'ask' || route.view === 'week' ? route.view : page.classList.contains('v-ask') ? 'ask' : 'week'; return `#/hearings/${v}`; };
    page.querySelectorAll('[data-seg="hscope"]').forEach(el => el.onclick = () => {
      const v = el.dataset.val; remember(v); S.hwRefocus = `[data-seg="hscope"][data-val="${v}"]`;
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
