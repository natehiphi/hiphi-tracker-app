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
// The calendar has one home, here (B-13 on v6, R-352): This week shows as a list or as a calendar (#/hearings/week?view=cal),
// with an issue filter (?issue=<id>, the job All issues' calendar did). Today's old week addresses (#/?view=cal&who=team&w=1
// &day=2026-03-18) and All issues' (#/my-issues/all?view=cal) are sent here by app.js; this page reads `who` as `scope`
// and `day` as the phone's day, so those links keep whose week, which week and which day.
// What it replaces (A-25, rule 7.8): v5's This week grid (testimony-deadline cards, hearing blocks, Other to-dos: the
// deadlines are on each bill's line in the cards now, and to-dos are Today's), v5's deadline box with its push board, the
// Team switch's week, and the two other "who to ask" screens (Legislators > Who to ask and Holding our bills went away in R-356 round 2, decision 4: asking chairs for a hearing lives only here, in Bills That Need Hearings).
import { S, DB, esc, hooks, SESSION_OVER, seesTeam } from './data.js';
import { billById, suggestions, SUGGEST_CAP, setSugg, suggState, billRoute, codesOf, deadlineCalendar, gateApplies, gateGloss, plainDeadlines, sittingDraft, roomName, teamFirst } from './model.js';
import { icon, btn, iconBtn, toast, segmented, pickerChip, pickerSheet, ASK_TAB } from './ui.js';
import { hearingCard, nameWords, numWords, sayWords, nw, dayWords, timeWords, wireSteps, billStep, shownStatus, committeeName } from './steps.js';
import { dueOf } from './hearing.js';   // a testimony's due time: the notice's, else 24 hours before the hearing
import { todayItems } from './today5.js';   // the person's own to-dos and follow-ups, as Today reads them
import { askBoard, askSummary, scopesFor, defaultScope, scopeOk, whoseWords, coalOf, SCOPES, freshScope, toAskWords, decideWords, nwParts, askTabWords } from './push.js';
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
// R-356 decision 2: Team is a choice only for people who see Team (data.js seesTeam); push.js scopesFor, which this page
// does not own, still lists it, so it is taken out here. Someone with nothing of their own and no coalitions keeps Mine
// (an empty week that says so) rather than a page with no scope. A remembered or linked team scope for someone who no
// longer sees Team falls back to the first choice left, never an empty page.
const scopes = () => { const l = scopesFor().filter(x => x[0] !== 'team' || seesTeam()); return l.length ? l : [['mine', SCOPES.mine]]; };
const safeScope = v => scopes().some(x => x[0] === v) ? v : scopes()[0][0];
function scopeOf(route) {
  const ok = scopes().map(x => x[0]), want = [route?.q?.scope, route?.q?.who, S.me?.prefs?.hscope, remembered()].find(x => x && ok.includes(x));
  return want || safeScope(defaultScope());
}
// With one choice left there is nothing to switch: no switch is drawn.
const switcher = scope => scopes().length > 1 ? segmented('hscope', scopes(), scope, 'Whose hearings') : '';
// B-13 on v6, P-4, C-15: with no switch the page says in words whose week this is, and, quietly, that the team has more (no
// link: Team is not theirs to open). Only on This week's list, for the week in view; the count is the team's sittings that
// week which are not already in this person's list.
function scopeWords(route, scope) {
  const off = weekOff(route), mon = addDays(mondayOf(Date.now()), off * 7), keep = x => !x.mon || monOn();
  const mine = new Set(weekSittings(scope, mon).filter(keep).map(x => sitKey(x.h)));
  const rest = weekSittings('team', mon).filter(keep).filter(x => !mine.has(sitKey(x.h))).length;
  const w = scope === 'coal' ? 'Your coalitions’ hearings' : 'Your hearings';
  const when = off === 0 ? ' this week' : off === 1 ? ' next week' : off === -1 ? ' last week' : '';
  return `<p class="hw-scope">${esc(w + when)}</p>${rest ? `<p class="hw-scope-more">The team has ${rest} more${when || ' that week'}</p>` : ''}`;
}

// ---- one issue's hearings (R-352: the job All issues' calendar did, now here) ----
// The address holds the pick (?issue=<id>), nothing else does: a filter kept out of sight would hide hearings from someone
// who forgot it was on, so a link or Back opens the same week and a fresh visit opens on All issues. The picker is the
// app's plain picker chip ("All issues ▾", A-12: it opens a list of choices, so it looks like one), never a second switch.
let ISS = '';   // the issue this draw is filtered to ('' is every issue); set by render, cleared for the other screens' calls
const issBills = id => new Set((S.billIssues || []).filter(x => String(x.issue_id) === id).map(x => x.bill_id));
const issueOf = route => { const id = route?.q?.issue || ''; return id && (S.issues || []).some(i => String(i.id) === id) ? id : ''; };
// The scope's bills, narrowed to the issue when one is picked.
function okFor(scope) {
  const ok = scopeOk(scope); if (!ISS) return ok;
  const ids = issBills(ISS); return b => ok(b) && ids.has(b.id);
}
// The issues that hold at least one of the scope's bills, by name (an issue with none of them would only show an empty week).
function issueOpts(scope) {
  const ok = scopeOk(scope), have = new Set((S.bills || []).filter(ok).map(b => b.id));
  const ids = new Set((S.billIssues || []).filter(x => have.has(x.bill_id)).map(x => x.issue_id));
  return (S.issues || []).filter(i => ids.has(i.id) || String(i.id) === ISS).sort((x, y) => String(x.name).localeCompare(String(y.name)));
}
// "No hearings on your bills on Tobacco this week": the empty words name the picked issue, so an empty week says why.
const issWords = w => { const i = ISS && (S.issues || []).find(x => String(x.id) === ISS); return i ? `${w} on ${i.name}` : w; };
function issuePick(scope) {
  const opts = issueOpts(scope); if (!opts.length && !ISS) return '';
  const on = (S.issues || []).find(i => String(i.id) === ISS);
  return pickerChip(on ? on.name : 'All issues', { 'data-hwiss': '1', 'aria-haspopup': 'dialog', 'aria-label': `Issue: ${on ? on.name : 'all issues'}. Change` });
}

// ---- This week: the sittings, day by day ----
// A sitting is every hearing row with one committee and start time (hearing.js sittingOf); it is in a view when one of
// its bills is, or when the person is going to it (a hearing you said you would attend is always on your week).
const sitKey = h => `${h.committee}|${h.scheduled_at}`;
const goingTo = rows => !!S.me && rows.some(r => (S.attend?.[r.id] || []).includes(S.me.id));
const isMon = b => !b?.position || b.position === 'monitor';
function weekSittings(scope, mon) {
  const ok = okFor(scope), t0 = ms(mon + 'T00:00:00-10:00'), t1 = ms(addDays(mon, 6) + 'T23:59:59.999-10:00'), by = new Map();
  for (const h of S.hearings || []) {
    const t = ms(h.scheduled_at); if (!(t >= t0 && t <= t1)) continue;
    const k = sitKey(h); if (!by.has(k)) by.set(k, []); by.get(k).push(h);
  }
  const out = [];
  for (const rows of by.values()) {
    const live = rows.filter(r => r.status !== 'cancelled'), going = goingTo(rows);
    const bills = (live.length ? live : rows).map(r => billById(r.bill_id)).filter(b => b && b.tracked !== false);
    const mine = bills.filter(ok);
    // (one issue picked: only sittings that hear its bills, even one the person is going to)
    if (!mine.length && (!going || ISS)) continue;
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
  let html = hearingCard(h, { from: 'week', buttons: false });   // R-356 decision 5 (A-14): testimony status as words here; its button is on Today and Testimony
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
  const sun = addDays(mon, 6), list = (S.bills || []).filter(okFor(scope)), out = new Map();
  for (const d of deadlineCalendar()) if (d.date >= mon && d.date <= sun && gateApplies(d, list)) { if (!out.has(d.date)) out.set(d.date, []); out.get(d.date).push(d); }
  return out;
}
// The deadline's Capitol name only for people who own bills and admins, linked to Help's Capitol words; anyone else reads
// only what it means, "Thu 3/19: bills sent to 3 or more committees must clear their first committee" (C-15; Nate's walk:
// helpers met "Triple filing" with no way to learn it).
const capLine = ds => (ds || []).map(d => { const g = gateGloss(d.label);
  // (the day's heading above says the day, so the gloss stands alone: A-14)
  if (plainDeadlines() && g) return `<p class="hw-cap">${icon('flag')}<span>${nw(esc(g.charAt(0).toUpperCase() + g.slice(1)))}</span></p>`;
  return `<p class="hw-cap">${icon('flag')}<span>Capitol deadline: <a class="hw-cap-n" href="#/help/words?w=${encodeURIComponent(d.label)}">${esc(d.label)}</a>${g ? `<span class="hw-cap-g"> · ${esc(g)}</span>` : ''}</span></p>`; }).join('');

// The one line under the days (it replaces v5's deadline box over the grid): how many bills still need a hearing, and
// the day to ask the first chair by, opening Get hearings. Under the days, not over them: who comes to see today's
// hearing sees it first (critic A-1, P-1: the first card was at 460px on a phone); the tab carries the count too.
// It says the tab's own count in the tab's words, push.js toAskWords ("20 to ask · first by Mon 3/23", the same on Today
// and Bills: Nate's walk found "49 of your coalitions' bills need a hearing" beside a different tab count); with nothing
// left to ask, no line (the tab has no count then either).
// Bills heard but not voted on are not "to ask" (the board says them on their own line): with none left to ask, the line
// says them in the board's own words, so Get hearings is still one tap away for them.
function askLine(s, scope) {
  const t = SESSION_OVER ? '' : toAskWords(s) || decideWords(s?.decide || 0); if (!t || !tabCounts()) return '';
  const href = `#/hearings/ask${scope !== safeScope(defaultScope()) ? `?scope=${scope}` : ''}`;
  return `<a class="hw-ask" href="${esc(href)}">${icon('flag')}<span class="hw-ask-t"><span class="hw-ask-n">${nwParts(esc(t))}</span></span><span class="hw-ask-go">${askTabWords()}</span></a>`;
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
  const list = suggestions((S.bills || []).filter(okFor('mine')), { cap: Infinity }).filter(s => s.kind !== 'chair').slice(0, SUGGEST_CAP);
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
// This week's own dates say only "Mar 16 to 22" (the tab says "This week", A-14). Another week says which ("Next week ·
// Mar 23 to 29") everywhere.
// The way to see the same week the other way is one plain link after the dates, "See as calendar" / "See as list" (R-352,
// A-12 on v6: the List | Calendar pill beside Mine | Team looked the same as it and meant something else; a link that goes
// to the other view looks like what it does). `mode` is '' on the other screens' calendars, which draw no link.
function weekNav(route, mode = '') {
  const off = weekOff(route), mon = addDays(mondayOf(Date.now()), off * 7), sun = addDays(mon, 6);
  const range = `${fmt(mon, { month: 'short', day: 'numeric' })} to ${fmt(sun, fmt(mon, { month: 'short' }) === fmt(sun, { month: 'short' }) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  const words = off === 0 ? range : off === 1 ? `Next week · ${range}` : off === -1 ? `Last week · ${range}` : range;
  const other = mode === 'cal' ? 'list' : 'cal', q = viewQuery(route, { view: other });
  const swap = mode ? `<a class="hw-view" href="#/hearings/week?${esc(q)}" data-hwview="${other}">${other === 'cal' ? 'See as calendar' : 'See as list'}${icon('chevron-right', { cls: 'v6-chev' })}</a>` : '';
  return `<div class="hw-nav${off === 0 ? ' now' : ''}"><p class="hw-range">${esc(words)}</p>${swap}
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
  const whose = issWords(scope === 'team' ? 'the team’s bills' : whoseWords(scope));
  const when = off === 0 ? 'this week' : off === 1 ? 'next week' : off === -1 ? 'last week' : 'that week';
  const anyAhead = ahead.some(d => n(d)), monAhead = ahead.some(d => monDay(d).length);
  // Between sessions, said so, with what to do meanwhile (Nate's walk: "No hearings on HEAL bills this week" in November).
  const none = SESSION_OVER && !anyAhead ? `<p class="hw-none">${icon('calendar')}<span>The Legislature is between sessions. Hearings start after opening day, ${esc(dayWords(openingDay()))}. Until then: <a href="#/my-issues">get your issues ready</a>.</span></p>`
    : !anyAhead ? `<p class="hw-none">${icon('calendar')}<span>${esc(`${np ? 'No more hearings' : 'No hearings'} on ${whose}${monAhead ? ' we support or oppose' : ''} ${when}.`)}</span></p>` : '';
  const monBtn = monN && monOn() ? `<p class="hw-mon">${btn(`Hide the ${plural(monN, 'hearing')} on bills ${who}`, { kind: 'text', sm: true, icon: 'eye-off', attrs: { 'data-hwmon': '1', 'aria-pressed': 'true' } })}</p>` : '';
  return `${earlier}${none}${ahead.map(dayHTML).join('')}${monBtn}${footNav(route)}${off === 0 ? askLine(sum, scope) : ''}${off === 0 ? suggHTML(suggList(scope)) : ''}`;
}

// ---- This week as a calendar (Nate 25 Oct walk 1: "There still needs to be a calendar view that's easily apparent and
// accessible") ----
// "See as calendar" on This week's date line, remembered per person as the scope is (prefs.hview, and this browser's copy),
// and an address of its own (#/hearings/week?view=cal). List stays everyone's default until they pick.
// The calendar is the same week as the list: the same sittings (weekSittings, monitor-only ones hidden unless shown), the
// same Capitol deadlines (capDays) and the same empty and between-sessions words, laid out Monday to Friday as columns,
// Saturday and Sunday in one Weekend strip below (only when it has something), in time order inside each day. To that it
// adds what the cards say inside each sitting: each bill's testimony due time on its own day, and the person's own dated
// to-dos and follow-ups (Today's rows, today5.js todayItems), so the week's whole shape is on one screen.
// It replaces nothing on a daily screen (A-25): it is the list shown another way, and the list is one tap back.
// v5's grid (today5.js weekView) was the model; this one is calm (A-8, A-24): one quiet line per entry, only the hearing a
// soft card, tokens only.
// (R-352: the view is picked by the date line's "See as calendar" link, no longer by a second pill switch)
const VKEY = () => `hiphi6_hview_${S.me?.id || ''}`;
const viewSaved = () => { try { return localStorage.getItem(VKEY()) || ''; } catch { return ''; } };
async function rememberView(v) {
  try { localStorage.setItem(VKEY(), v); } catch { /* a private window: this visit only */ }
  try { await DB.patchPrefs({ hview: v }); } catch { /* the address keeps it for this visit */ }
}
const modeOf = route => [route?.q?.view, S.me?.prefs?.hview, viewSaved()].find(x => x === 'cal' || x === 'list') || 'list';
// This week's address with the page's own picks (whose, which week, the issue, the view), changed by `o`.
function viewQuery(route, o = {}) {
  const q = { scope: route?.q?.scope || route?.q?.who || '', w: weekOff(route) ? String(weekOff(route)) : '', issue: ISS, view: route?.q?.view || '', ...o };
  return new URLSearchParams(Object.entries(q).filter(([, x]) => x && x !== '0')).toString();
}
const isPosB = b => !!b && b.tracked !== false && !isMon(b);
const weekdayLong = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'long' });
// Whether Today's steps hold the person's own step on this bill for this sitting (sitKey `k`; a step with no sitting, any).
const ownStep = (steps, b, k) => !!b && (steps || []).some(x => x.b?.id === b.id && x.testimony && (!x.h || sitKey(x.h) === k));
// One bill's testimony as the hearing card says it (steps.js billStep: the state word, late only for the step's own person
// or the bill's owner, D3 / A-5 on v6).
function stepOfB(h, b) {
  let s = null; try { s = billStep(b, { viewer: S.me, d: sittingDraft(h, b.id) || null, h }); } catch { s = null; }
  const st = s?.state, tone = shownStatus(s)?.tone || 'neutral';
  return { s, st, tone, word: st ? st.label : '' };
}
// Everything the calendar draws for one week: { day: [entries in time order] } and each day's Capitol deadlines.
function calWeek(scope, mon, { tasks = 'mine', steps = null } = {}) {
  const sun = addDays(mon, 6), t0 = ms(mon + 'T00:00:00-10:00'), t1 = ms(sun + 'T23:59:59.999-10:00'), ok = okFor(scope), now = Date.now();
  const days = new Map([0, 1, 2, 3, 4, 5, 6].map(i => [addDays(mon, i), []]));
  const put = (t, e) => { const d = days.get(hst(t)); if (d) d.push({ t, ...e }); };
  const all = weekSittings(scope, mon), shown = all.filter(x => !x.mon || monOn());
  for (const x of shown) {
    const live = x.rows.filter(r => r.status !== 'cancelled'), bills = live.map(r => ({ r, b: billById(r.bill_id) })).filter(y => isPosB(y.b) || (monOn() && y.b && y.b.tracked !== false));
    put(x.t, { k: 'h', x, bills, cancelled: !live.length });
  }
  // Testimony due in this week, for this week's sittings and next week's (a Monday hearing's testimony is often due the
  // Friday or Sunday before: v5's R-025). Only the bills in this view's scope, and only while not filed.
  const seen = new Set();
  for (const x of [...all, ...weekSittings(scope, addDays(mon, 7))]) {
    const rows = x.rows.filter(r => r.status !== 'cancelled'); if (!rows.length) continue;
    const due = ms(dueOf(rows[0])); if (!(due >= t0 && due <= t1)) continue;
    const k = sitKey(rows[0]); if (seen.has(k)) continue; seen.add(k);
    // One entry per job (R-346 finding C): a bill whose testimony is the person's own step on this sitting is said once, as
    // that step (Today hands its steps in), never again as "testimony due" beside it.
    const bills = rows.map(r => ({ r, b: billById(r.bill_id) })).filter(y => isPosB(y.b) && ok(y.b) && !ownStep(steps, y.b, k))
      .map(y => ({ ...y, ...stepOfB(y.r, y.b) })).filter(y => y.st && y.st.key !== 'filed');
    if (bills.length) put(due, { k: 'due', h: x.h, bills, late: due <= now });
  }
  // The person's own dated to-dos and follow-ups, as Today has them (the same rows, the same links).
  let mine = []; try { mine = todayItems('mine').tasks || []; } catch (e) { console.error(e); }
  // Today's Team calendar (R-342): every dated to-do on the scope's bills, each with whose it is; follow-ups stay the
  // person's own (a supporter's name is not the team's business, R-341).
  if (tasks === 'team') for (const [bid, arr] of Object.entries(S.todos || {})) for (const t of arr) {
    const b = billById(bid); if (t.done || !t.due_date || !b || !ok(b)) continue;
    const due = ms(String(t.due_date).slice(0, 10) + 'T17:00:00-10:00'); if (!(due >= t0 && due <= t1)) continue;
    put(due, { k: 'todo', words: t.title || 'To-do', b, href: billRoute(b), who: t.assignee_id ? (t.assignee_id === S.me?.id ? 'You' : teamFirst(t.assignee_id)) : 'No one yet' });
  }
  for (const t of mine) {
    if (t.due == null || !(t.due >= t0 && t.due <= t1)) continue;
    // The person's own step on a bill (approve, resubmit, file, fix an email) at its own time, in Today's words, so the
    // calendar and Today's list never give two times for one job (critic, R-342). Mine only: Team is the Capitol's times.
    // (the person's own steps come only from Today, which hands its rows in: `steps` below; Hearings and All issues have none)
    if (t.kind === 'todo' && t.who === 'yours') { if (tasks !== 'team') put(t.due, { k: 'todo', words: t.t?.title || 'To-do', b: t.b, href: t.b ? billRoute(t.b) : '#/' }); }
    else if (t.kind === 'followup') { const p = t.p || {}, name = p.name || p.email || 'a supporter';
      put(t.due, { k: 'fu', words: `Follow up with ${name}`, sub: t.f?.what || '', who: tasks === 'team' ? 'You' : '', href: t.f?.person_id ? `#/person/${encodeURIComponent(t.f.person_id)}` : '#/' }); }
  }
  // Today hands its own rows (today.js work: the times its list says), so the two never disagree. A step due when its
  // sitting starts (a late filing, accepted until the hearing) is said on that hearing's entry, beside its bill, so the
  // hour holds one entry, not two for one job (R-346 finding C; the bold mock's 1:10 PM).
  for (const x of steps || []) {
    if (!(x.t >= t0 && x.t <= t1)) continue;
    const he = x.h && (days.get(hst(x.t)) || []).find(e => e.k === 'h' && e.t === x.t && sitKey(e.x.h) === sitKey(x.h) && e.bills.some(y => y.b?.id === x.b.id));
    if (he) { (he.mine ??= new Map()).set(x.b.id, x.short || x.words); continue; }
    put(x.t, { k: 'step', words: x.words, b: x.b, href: billRoute(x.b) });
  }
  // At the same minute: the testimony due first, then the hearing, then the to-dos (v5's order).
  const rank = { step: 0, due: 1, h: 2, todo: 3, fu: 3 };
  for (const list of days.values()) list.sort((p, q) => p.t - q.t || rank[p.k] - rank[q.k]);
  return { days, caps: capDays(scope, mon), monN: all.filter(x => x.mon).length };
}
// The Capitol's deadline on its day's head, in the list's plain-words rule (capLine): the gloss for helpers, the Capitol's
// name linked to Help's words for owners and admins, with what it means on a quiet line under it.
const capCal = ds => (ds || []).map(d => { const g = gateGloss(d.label);
  if (plainDeadlines() && g) return `<p class="hc-cap">${icon('flag')}<span>${esc(g.charAt(0).toUpperCase() + g.slice(1))}</span></p>`;
  return `<p class="hc-cap">${icon('flag')}<span><a href="#/help/words?w=${encodeURIComponent(d.label)}" aria-label="${esc(`Capitol deadline: ${d.label}`)}">${esc(d.label)}</a>${g ? `<span class="hc-capg">${esc(g)}</span>` : ''}</span></p>`; }).join('');
// One entry, one shape (R-346 finding D, Nate 27 Oct): every entry on every calendar (Today, Hearings > This week, All
// issues) is the same four parts, top to bottom: the time and what kind of entry it is ("1:10 PM · Hearing"), the job (the
// committee and room, "For Friday's Senate Health and Human Services hearing", the person's own step in Today's words, the
// to-do), the bill or bills (name first, number small) with where each stands, and the issue by name. Names are said
// whole, never cut (the mock's "Senate HHS" and "Let people cross…" read as different things). The job is the entry's link
// (the hearing, the bill, the person); each bill and each issue is a link of its own, so no link sits in another.
// A hearing is the one soft card in a day; testimony due carries a thin action rule (critic, R-342).
function issuesOfB(b) {
  const ids = new Set((S.billIssues || []).filter(x => x.bill_id === b?.id).map(x => x.issue_id));
  return (S.issues || []).filter(i => ids.has(i.id));
}
// The issues of an entry's bills, each once, as one quiet line: the first issue's whole name in the muted text colour (no
// pastel fill: the fresh-eyes review, A-5's five text colours; no icon, A-18 on v6), "+1" when there are more. An issue
// named as its only bill is left out: the bill line above already says that name (A-14).
function issueTags(bills) {
  const seen = new Map();
  for (const b of bills || []) for (const i of issuesOfB(b)) if (!seen.has(i.id)) seen.set(i.id, i);
  const iss = [...seen.values()].sort((x, y) => String(x.name).localeCompare(String(y.name)));
  if (!iss.length) return '';
  const i = iss[0], nm = String(i.name || '').trim().toLowerCase();
  const same = !!nm && (bills || []).some(b => String(b?.nickname || '').trim().toLowerCase() === nm);
  // R-352 (A-18 on v6): words only, no icon; the cell's bill line now leads with the bill's name, so an issue named as its
  // only bill is not said again
  if (same && iss.length === 1) return '';
  return `<p class="hc-isl"><a class="hc-iss" href="#/issue/${encodeURIComponent(i.id)}" aria-label="${esc(`Issue: ${i.name}`)}"><span>${esc(i.name)}</span></a>${iss.length > 1 ? `<span class="hc-issn">+${iss.length - 1}</span>` : ''}</p>`;
}
// The colour of time (A-5 on v6, R-352; steps.js status): late but still accepted leads with "Late" and the alarm clock, in
// amber; due today is plain, with the clock and "due today" in words; a step still to do whose deadline passed is red with
// the alert icon and "overdue". Someone else's step stays neutral (steps.js shownStatus).
// R-352 (C-15): the state first, then the time's word, as on Hearings' list ("Ready to file · late"), not bold.
const ST_TIME = { late: ['alarm-clock', w => `${w} · late`], today: ['clock', w => `${w} · due today`], overdue: ['circle-alert', w => `${w} · overdue`] };
const stWords = st => { if (!st.word) return ''; const t = ST_TIME[st.tone];
  return `<span class="hc-st${t ? ' ' + st.tone : ''}">${t ? icon(t[0]) : ''}${esc(t ? t[1](st.word) : st.word)}</span>`; };
// One bill on an entry: its name first, the link to the bill (R-352: as every row; the teal number first read as a code),
// then its number small and plain and where it stands on one line, or the person's own step on it when Today folded that step
// into this entry (one entry per job, finding C).
const billLi = (b, st, mine = '') => `<li><a class="hc-bl" href="${esc(billRoute(b))}" aria-label="${esc(sayWords(b))}">${esc(nameWords(b))}</a><span class="hc-bnum">${esc(numWords(b))}</span>${mine ? `<span class="hc-st hc-mine">${icon('circle-check')}${esc(`Your step: ${mine}`)}</span>` : stWords(st)}</li>`;
function calEntry(e, { wkend = false } = {}) {
  const when = `${wkend ? `${new Date(e.t).toLocaleDateString('en-US', { ...HST, weekday: 'short' })} ` : ''}${timeWords(e.t)}`;
  const head = (ic, kind, more = '') => `<p class="hc-eh"><span class="hc-t">${esc(when)}</span><span class="hc-ek">${icon(ic)}${esc(kind)}</span>${more}</p>`;
  const job = (href, words, label = '') => `<a class="hc-job" href="${esc(href)}"${label ? ` aria-label="${esc(label)}"` : ''}>${esc(words)}</a>`;
  const list = items => items ? `<ul class="hc-bills">${items}</ul>` : '';
  if (e.k === 'h') {
    const h = e.x.h, cn = committeeName(h.committee) || h.committee, room = h.room ? roomName(h.room) : '';
    const going = goingTo(e.x.rows), label = `Hearing ${when}, ${cn}${room ? `, ${room}` : ''}${e.cancelled ? ', cancelled' : ''}. Open the hearing`;
    const bills = e.bills.map(y => billLi(y.b, stepOfB(y.r, y.b), e.mine?.get(y.b.id) || '')).join('');
    return `<li class="hc-e hc-h${e.cancelled ? ' off' : ''}">${head('gavel', 'Hearing', going ? `<span class="hc-going">${icon('user-check')}<span>You’re going</span></span>` : '')}
      ${job(`#/hearing/${encodeURIComponent(h.id)}?from=week`, `${cn}${room ? ` · ${room}` : ''}`, label)}${e.cancelled ? '<p class="hc-es">Cancelled, no new date yet</p>' : ''}
      ${list(bills)}${issueTags(e.bills.map(y => y.b))}</li>`;
  }
  if (e.k === 'due') {
    const h = e.h, cn = committeeName(h.committee) || h.committee, what = `For ${weekdayLong(h.scheduled_at)}’s ${cn} hearing`;
    const bills = e.bills.map(y => billLi(y.b, y)).join('');
    return `<li class="hc-e hc-due${e.late ? ' past' : ''}">${head('file-text', 'Testimony due')}${job(`#/hearing/${encodeURIComponent(h.id)}?from=week`, what)}${list(bills)}${issueTags(e.bills.map(y => y.b))}</li>`;
  }
  if (e.k === 'step') return `<li class="hc-e hc-todo hc-step">${head('circle-check', 'Your step')}${job(e.href, e.words)}${list(billLi(e.b, {}))}${issueTags([e.b])}</li>`;
  if (e.k === 'fu') return `<li class="hc-e hc-todo hc-fu">${head('phone', 'Follow-up')}${job(e.href, e.words)}${e.sub || e.who ? `<p class="hc-es">${esc([e.sub, e.who ? `For ${e.who === 'You' ? 'you' : e.who}` : ''].filter(Boolean).join(' · '))}</p>` : ''}</li>`;
  return `<li class="hc-e hc-todo">${head('list-todo', 'To-do')}${job(e.href, e.words)}${e.who ? `<p class="hc-es">${esc(`For ${e.who === 'You' ? 'you' : e.who}`)}</p>` : ''}${e.b ? list(billLi(e.b, {})) + issueTags([e.b]) : ''}</li>`;
}
const dayShort = d => fmt(d, { weekday: 'short' }), dateShort = d => fmt(d, { month: 'numeric', day: 'numeric' });
function calHTML(route, scope, sum, { ask = true, tag = false, tasks = 'mine', steps = null } = {}) {
  const now = Date.now(), today = hst(now), off = weekOff(route), mon = addDays(mondayOf(now), off * 7), cw = calWeek(scope, mon, { tasks, steps });
  const askL = () => ask && off === 0 ? askLine(sum, scope) : '', ent = (e, o = {}) => calEntry(e, { ...o, tag });
  const wd = [0, 1, 2, 3, 4].map(i => addDays(mon, i)), we = [addDays(mon, 5), addDays(mon, 6)];
  const has = d => (cw.days.get(d) || []).length > 0 || (cw.caps.get(d) || []).length > 0;
  const any = [...wd, ...we].some(has), anyH = [...cw.days.values()].some(l => l.some(e => e.k === 'h'));
  const whose = issWords(scope === 'team' ? 'the team’s bills' : whoseWords(scope)), when = off === 0 ? 'this week' : off === 1 ? 'next week' : off === -1 ? 'last week' : 'that week';
  const who = scope === 'team' ? 'the team monitors' : 'you monitor';
  // the list's own empty words (weekHTML), and between sessions its line
  if (SESSION_OVER && !anyH) return `<p class="hw-none">${icon('calendar')}<span>The Legislature is between sessions. Hearings start after opening day, ${esc(dayWords(openingDay()))}. Until then: <a href="#/my-issues">get your issues ready</a>.</span></p>`;
  const monLine = cw.monN ? `<p class="hw-mon">${btn(monOn() ? `Hide the ${plural(cw.monN, 'hearing')} on bills ${who}` : `+${plural(cw.monN, 'hearing')} on bills ${who}`, { kind: 'text', sm: true, icon: monOn() ? 'eye-off' : 'eye', attrs: { 'data-hwmon': '1', 'aria-pressed': String(monOn()) } })}</p>` : '';
  if (!any) return `<p class="hw-none">${icon('calendar')}<span>${esc(`No hearings on ${whose}${cw.monN ? ' we support or oppose' : ''} ${when}.`)}</span></p>${monLine}${askL()}`;
  // The phone shows one day at a time: today when it is in this week on a weekday, else the first day with something.
  const pick = S.hcDay && wd.includes(S.hcDay) ? S.hcDay : wd.includes(today) ? today : wd.find(has) || wd[0];
  const dayCol = d => { const list = cw.days.get(d) || [], isT = d === today, id = `hc-d-${d}`;
    return `<section class="hc-day${isT ? ' today' : ''}${d < today ? ' past' : ''}${d === pick ? ' on' : ''}" data-hcday="${d}" aria-labelledby="${id}"${isT ? ' aria-current="date"' : ''}>
      <h2 class="hc-dh" id="${id}"><span class="hc-dw">${esc(dayShort(d))}</span> <span class="hc-dd">${esc(dateShort(d))}</span>${isT ? ' <span class="hc-today">Today</span>' : ''}<span class="sr">${esc(`, ${plural(list.length, 'entry', 'entries')}`)}</span></h2>
      ${capCal(cw.caps.get(d))}
      ${list.length ? `<ul class="hc-list" aria-labelledby="${id}">${list.map(e => ent(e)).join('')}</ul>` : `<p class="hc-nothing">Nothing scheduled</p>`}</section>`; };
  const wkList = we.flatMap(d => cw.days.get(d) || []), wkCaps = we.flatMap(d => cw.caps.get(d) || []);
  const weekend = wkList.length || wkCaps.length ? `<section class="hc-wkend" aria-labelledby="hc-d-wkend"><h2 class="hc-dh" id="hc-d-wkend"><span class="hc-dw">Weekend</span> <span class="hc-dd">${esc(`${dateShort(we[0])} and ${dateShort(we[1])}`)}</span></h2>
      ${capCal(wkCaps)}${wkList.length ? `<ul class="hc-list">${wkList.map(e => ent(e, { wkend: true })).join('')}</ul>` : ''}</section>` : '';
  const btns = `<div class="hc-pick" role="group" aria-label="Pick a day">${wd.map(d => `<button type="button" data-hcpick="${d}" aria-pressed="${d === pick}" aria-label="${esc(`${fmt(d, { weekday: 'long', month: 'long', day: 'numeric' })}${d === today ? ', today' : ''}${has(d) ? '' : ', nothing scheduled'}`)}">
      <span class="hc-pw">${esc(dayShort(d))}</span><span class="hc-pd">${esc(dateShort(d))}</span><span class="hc-dot${has(d) ? ' on' : ''}" aria-hidden="true"></span></button>`).join('')}</div>`;
  return `<div class="hc-cal">${btns}<div class="hc-grid">${wd.map(dayCol).join('')}</div>${weekend}</div>${monLine}${askL()}`;
}

// ---- The same week calendar on All issues (R-342, Nate 26 Oct; R-352 FIX-3, Nate 28 Oct: "keep the calendar view") ----
// One calendar, drawn here (calHTML), so Hearings and All issues never drift: the same entries, the same colour of time and
// the same words for each state. All issues shows the team's week (All issues is everyone's), each entry with its issue's
// name; its one way in is the Calendar tab (ui.js SECTIONS, A-12 on v6). The week arrows and the phone's day buttons work
// as on Hearings; `href(w)` is the page's own address for week w, so Back and a shared link keep the week. Today's week
// (weekGlance) stays gone: Today's Coming up ends with "See the week on Hearings".
export const calWeekBar = route => weekNav(route);
export function weekCalHTML(route, { scope = 'team' } = {}) {
  seedMoved(); freshScope(); ISS = '';   // Hearings' issue pick is its own
  return calHTML(route, scope, null, { ask: false });
}
export function wireWeekCal(root, { href, redraw = () => hooks.render() }) {
  root.querySelectorAll('[data-hweek]').forEach(el => el.onclick = () => {
    S.hcRefocus = `[aria-label="${el.getAttribute('aria-label') || 'Next week'}"]`; S.hcDay = null;
    S.go(href(+el.dataset.hweek || 0), { replace: true, keepScroll: true });
  });
  root.querySelectorAll('[data-hcpick]').forEach(el => el.onclick = () => {
    const d = el.dataset.hcpick; S.hcDay = d;
    root.querySelectorAll('[data-hcpick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hcpick === d)));
    root.querySelectorAll('[data-hcday]').forEach(x => x.classList.toggle('on', x.dataset.hcday === d));
  });
  root.querySelector('[data-hwmon]')?.addEventListener('click', async () => {
    try { await DB.patchPrefs({ showMonitor: !monOn() }); } catch (e) { toast(e, { err: true }); return; }
    S.hcRefocus = '[data-hwmon]'; redraw();
  });
  if (S.hcRefocus) { const f = root.querySelector(S.hcRefocus); S.hcRefocus = null; f?.focus({ preventScroll: true }); }
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
  const how = `<p class="hg-how"><a href="#/help/hearing">How to ask for a hearing</a> · <a href="#/help/calendar">Session calendar</a></p>`;
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
  // Each label keeps room for its bold self (staff.css .sv-tl, as sectionNav's), so the row never shifts when a tab is picked.
  const tl = l => `<span class="sv-tl" data-label="${esc(l)}">${esc(l)}</span>`;
  return `<nav class="sv-tabrow sv-secnav" aria-label="Hearings"><a href="#/hearings/week"${view === 'week' ? ' aria-current="page"' : ''}>${tl('This week')}</a><a href="#/hearings/ask"${view === 'ask' ? ' aria-current="page"' : ''}>${tl(ASK_TAB)}${n ? ` <span class="sv-tn" aria-hidden="true">${n}</span><span class="sr">, ${esc(plural(n, 'bill'))} to ask</span>` : ''}</a></nav>`;
}

// The buttons a week's cards carry besides the cards' own (wireSteps): shared by this page and Team's "The team's hearings" tab.
function wireWeek(page) {
  // A phone's day buttons show one day at a time; no redraw, so the focus stays on the button pressed
  page.querySelectorAll('[data-hcpick]').forEach(el => el.onclick = () => {
    const d = el.dataset.hcpick; S.hcDay = d;
    page.querySelectorAll('[data-hcpick]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hcpick === d)));
    page.querySelectorAll('[data-hcday]').forEach(s => s.classList.toggle('on', s.dataset.hcday === d));
  });
  page.querySelector('[data-hwmon]')?.addEventListener('click', async () => {
    const on = !monOn();
    try { await DB.patchPrefs({ showMonitor: on }); } catch (e) { toast(e, { err: true }); return; }
    S.hwRefocus = '[data-hwmon]'; hooks.render();
  });
  page.querySelector('.hw-earlier')?.addEventListener('toggle', e => { S.hwEarlier = e.currentTarget.open; });
  page.querySelectorAll('[data-sgdo]').forEach(el => el.onclick = () => answerSugg(el.dataset.sgdo, el.dataset.sgst));
}
// R-356 decision 2: the team's week left Hearings' Team switch for Team's "The team's hearings" tab (team.js). This week only
// (other weeks are on Hearings); the same cards as This week draws at team scope, with the same buttons.
export function teamHearingsHTML() {
  seedMoved(); freshScope(); ISS = '';
  const sum = SESSION_OVER ? null : askSummary({ scope: 'team' });
  return `<div class="hw-page v-week">${weekHTML({ q: {} }, 'team', sum)}</div>`;
}
export function wireTeamHearings(root) {
  const page = root.querySelector('.hw-page'); if (!page) return;
  wireSteps(page, { after: () => hooks.render() });
  wireMoved(page, { toast, redraw: () => hooks.render() });
  wireWeek(page);
}

export default {
  tab: 'hearings',
  title: () => 'Hearings',
  render(route) {
    if (!S.me) return `<h1 class="v6-ptitle sv-h1">Hearings</h1><p class="hw-none">${icon('info')}<span>You are signed in, but the tracker does not know who you are yet. Ask your admin to add you.</span></p>`;
    seedMoved();   // the practice copy's moved sittings have someone down for the old date (W53), as Today's
    freshScope();   // who has a step on which bill is worked out again for this draw (push.js scopeOk)
    ISS = issueOf(route);
    const scope = scopeOf(route), view = viewOf(route, scope), sum = SESSION_OVER ? null : askSummary({ scope }), mode = modeOf(route);
    // An old Today link to one day of its week (#/?view=cal&day=2026-03-18, sent here by app.js) opens on that day, once.
    if (route.q?.day && S.hcDayAt !== location.hash) { S.hcDayAt = location.hash; S.hcDay = route.q.day; }
    return `<div class="hw-page v-${view}${view === 'week' && mode === 'cal' ? ' m-cal' : ''}">
      <h1 class="v6-ptitle sv-h1">Hearings</h1>
      ${tabs(view, sum)}
      <div class="hw-bar"><div class="hw-picks">${switcher(scope) || (view === 'week' ? scopeWords(route, scope) : '')}${view === 'week' ? issuePick(scope) : ''}</div>${view === 'week' ? weekNav(route, mode) : ''}</div>
      ${view === 'ask' ? askHTML(scope, route.view !== 'ask') : mode === 'cal' ? calHTML(route, scope, sum) : weekHTML(route, scope, sum)}
    </div>`;
  },
  wire(route, root) {
    const page = root.querySelector('.hw-page'); if (!page) return;
    wireSteps(page, { after: () => hooks.render() });
    wireMoved(page, { toast, redraw: () => hooks.render() });
    const here = () => { const v = route.view === 'ask' || route.view === 'week' ? route.view : page.classList.contains('v-ask') ? 'ask' : 'week'; return `#/hearings/${v}`; };
    page.querySelectorAll('[data-seg="hscope"]').forEach(el => el.onclick = async () => {
      const v = el.dataset.val; await remember(v); S.hwRefocus = `[data-seg="hscope"][data-val="${v}"]`;
      S.go(`${here()}?${here() === '#/hearings/ask' ? `scope=${v}` : viewQuery(route, { scope: v })}`, { replace: true, keepScroll: true });
    });
    page.querySelectorAll('[data-hweek]').forEach(el => el.onclick = () => {
      const w = +el.dataset.hweek || 0;
      S.hwRefocus = `[aria-label="${el.getAttribute('aria-label') || 'Next week'}"]`; S.hcDay = null;   // another week opens on its own first day
      const q = viewQuery(route, { w: String(w) });
      S.go(`#/hearings/week${q ? `?${q}` : ''}`, { replace: true, keepScroll: true });
    });
    // See as calendar / See as list: remembered for the person, and said in the address so a link or Back opens the same
    // view (a modified click opens the link as it is)
    page.querySelector('[data-hwview]')?.addEventListener('click', async e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault();
      const v = e.currentTarget.dataset.hwview, href = e.currentTarget.getAttribute('href'); await rememberView(v); S.hwRefocus = '[data-hwview]';
      S.go(href, { replace: true, keepScroll: true });
    });
    // One issue's hearings: the plain picker; the pick lives in the address only (see issueOf)
    page.querySelector('[data-hwiss]')?.addEventListener('click', () => {
      const scope = scopeOf(route);
      pickerSheet({ title: 'Show hearings on', value: ISS || 'all', options: [['all', 'All issues'], ...issueOpts(scope).map(i => [String(i.id), i.name])],
        onPick: v => { S.hwRefocus = '[data-hwiss]'; S.hcDay = null; S.go(`#/hearings/week?${viewQuery(route, { issue: v === 'all' ? '' : v })}`, { replace: true, keepScroll: true }); } });
    });
    wireWeek(page);
    // A redraw after an answer keeps the focus near where it was (B-4).
    if (S.hwRefocus) { const f = page.querySelector(S.hwRefocus); S.hwRefocus = null; f?.focus({ preventScroll: true }); }
  },
};
