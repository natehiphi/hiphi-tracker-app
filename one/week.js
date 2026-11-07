// This week (R-360 part 5, #/week): one job, see what is happening at the Capitol this week and the one thing to do.
// From the top: today's date and the heading; "Your one thing this week", the single bill to act on, with the one primary
// button (the bill screen's own rule: Send testimony, or Email the chair); "Your issues", each followed issue with its bills
// that have something this week; then "Hearings on HIPHI's bills", this week's by day, then next week's, ten rows in all.
// Nate's structure of 6 Nov: issues are the unit people follow, and bills live within issues.
// "This week" is the Capitol's week in Hawaiʻi time: Monday to Friday, from today on. On a Saturday or a Sunday it is the
// week ahead (nothing is heard at the weekend). The practice copy's clock is Mon 16 Mar 2026, 9:00 am (one/data.js).
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { loadBill } from './data.js';
import { esc, header, keepHyphens } from './bill.js';
import { HST, dateLong } from './words.js';
import { isDone } from './done.js';
import { followed, rowName, byNum } from './bills.js';
import { tabs } from './tabs.js';
import { codesOf, cmteInfo } from '../pub/capitol.js';
import { CHAMBER_NAME } from '../stops.js';

const ROWS = 10, TRIES = 8;
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const noon = day => new Date(day + 'T12:00:00-10:00').getTime();
const plus = (day, n) => hstDay(noon(day) + n * 864e5);
const dayLabel = day => new Date(noon(day)).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });

// The week's days, Hawaiʻi time: this week's weekdays from today on, and next week's five.
function weekOf(now) {
  const today = hstDay(now), dow = new Date(noon(today)).getUTCDay();   // noon in Hawaiʻi is the same date in UTC
  const mon = dow === 6 ? plus(today, 2) : dow === 0 ? plus(today, 1) : plus(today, 1 - dow);
  const days = [0, 1, 2, 3, 4].map(n => plus(mon, n)).filter(d => d >= today), next = [7, 8, 9, 10, 11].map(n => plus(mon, n));
  return { today, days, next, end: plus(mon, 7) };   // end: the Monday after, the edge of "this week" for a deadline
}

// "House Transportation"; heard together, "Senate Health and Human Services, with Commerce and Consumer Protection".
// The chamber and the names, never a code (C-15): an unknown code gives the time alone.
export function shortCmte(code, cm) {
  const cs = codesOf(code).map(k => cmteInfo(k, cm)).filter(Boolean);
  if (!cs.length) return '';
  return `${CHAMBER_NAME[cs[0].chamber] || ''} ${cs[0].name}`.trim() + (cs.length > 1 ? t('week.with', { names: cs.slice(1).map(c => c.name).join(' and ') }) : '');
}

// "today", "tomorrow", "Wed" within the week, else "Mon, Mar 30": as Bills' "Testimony due" says it.
function when(iso, now) {
  const d = hstDay(iso), days = Math.round((noon(d) - noon(hstDay(now))) / 864e5);
  return days === 0 ? t('bills.today') : days === 1 ? t('bills.tomorrow') : days > 0 && days < 7
    ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : dayLabel(d);
}
const nameOf = B => B.nickname || B.summary || B.numberSpaced;
const chev = icon('chevron-right', { size: '18px', cls: 'chev' });
const rowA = (num, name, sub, extra = '') => `<a class="r" href="#/${esc(num)}" data-bill="${esc(num)}"${extra}><span class="t"><b>${keepHyphens(name)}</b><span>${esc(sub)}</span></span>${chev}</a>`;

// Everything the screen draws, worked out once per visit: the list (data.js, once a page life) and, for the one thing and
// for an issue with nothing this week, the bill's own shape (loadBill: the bill screen's rule for its action, its done mark
// and the day the chairs have until). Live, that is one request per bill looked at; the practice copy has them all.
export async function weekData(L) {
  const W = weekOf(L.now), first = new Map();
  for (const h of L.hearings) if (!first.has(h.billId)) first.set(h.billId, h);
  const thisWeek = h => h && W.days.includes(hstDay(h.at));
  const catOrder = new Map(L.cats.map((c, k) => [c.key, k]));
  const mine = L.issues.filter(followed)
    .sort((x, y) => (catOrder.get(x.category) ?? 99) - (catOrder.get(y.category) ?? 99) || x.sort_order - y.sort_order || x.name.localeCompare(y.name));
  const mineIds = new Set(mine.map(i => i.id)), inMine = b => b.issues.some(id => mineIds.has(id));
  const soon = b => b.due && b.due < new Date(W.end + 'T00:00:00-10:00').toISOString();

  // The one thing: testimony due this week, the followed issues' bills first, soonest first. A bill already sent is
  // said ("You sent it") and the next one offered.
  const cands = L.bills.filter(soon).sort((x, y) => (inMine(y) - inMine(x)) || x.due.localeCompare(y.due) || byNum(x, y));
  let pick = null; const sent = [];
  for (const b of cands.slice(0, TRIES)) {
    let B = null; try { B = await loadBill(b.number); } catch { /* one bill that will not load is passed over */ }
    if (!B || !B.action) continue;
    if (isDone(B)) { sent.push(B); continue; }
    pick = B; break;
  }

  // Your issues: each followed issue, its bills with a hearing this week or testimony due this week; else one line about
  // the first of its bills still waiting for a hearing, or that nothing is on at the Capitol.
  const issues = [];
  for (const i of mine) {
    const bs = L.bills.filter(b => b.issues.includes(i.id)).sort(byNum);
    const now = bs.filter(b => thisWeek(first.get(b.id)) || soon(b)).map(b => ({ b, h: first.get(b.id) || null }));
    let wait = null;
    if (!now.length) for (const b of bs.filter(b => b.alive).slice(0, 3)) {
      let B = null; try { B = await loadBill(b.number); } catch { /* as above */ }
      if (B?.waitUntil) { wait = { b, until: B.waitUntil }; break; }
    }
    issues.push({ i, now, wait });
  }

  // The hearings: this week's by day, then next week's, ten rows in all.
  const byId = new Map(L.bills.map(b => [b.id, b])), group = days => days.map(d => ({ day: d, rows: L.hearings.filter(h => hstDay(h.at) === d && byId.has(h.billId)) })).filter(g => g.rows.length);
  let left = ROWS; const cut = gs => gs.map(g => { const rows = g.rows.slice(0, Math.max(0, left)); left -= rows.length; return { ...g, rows }; }).filter(g => g.rows.length);
  const days = cut(group(W.days)), next = cut(group(W.next));
  return { W, pick, sent, issues, following: mine.length > 0, days, next, byId };
}

function card(D, L) {
  const lab = `<p class="lab1">${esc(t('week.one'))}</p>`, last = D.sent[0];
  const sentLine = last ? `<p class="okline small1" role="status">${icon('circle-check')}<span>${esc(t('week.sent', { name: nameOf(last) }))}</span></p>` : '';
  if (!D.pick) return `<section class="card pick" aria-labelledby="w1-h"><h2 class="sr" id="w1-h">${esc(t('week.one'))}</h2>${lab}${sentLine}<p class="calm">${esc(t(last ? 'week.none.after' : 'week.none'))}</p></section>`;
  const B = D.pick, testimony = B.action === 'testimony' && B.hearing;
  const line = testimony
    ? `<b>${esc(t('week.by', { when: when(B.hearing.deadline || B.hearing.at, L.now), time: timeOf(B.hearing.deadline || B.hearing.at) }))}</b> ${esc(t('week.heard', { date: '\u0000' })).replace('\u0000', `<span class="nw">${esc(hstDay(B.hearing.at) === D.W.today ? t('bills.today') : dateLong(B.hearing.at, { now: L.now }))}</span>`)}`
    : esc(B.waitUntil ? t('week.wait', { date: dateLong(B.waitUntil + 'T12:00:00-10:00', { now: L.now }) }) : t('week.wait.none'));
  return `<section class="card pick" aria-labelledby="w1-h">${lab}${sentLine}<h2 id="w1-h">${keepHyphens(nameOf(B))}</h2>
    <p class="ln soon">${icon('clock')}<span>${line}</span></p>
    <a class="primary" href="#/${esc(B.number)}/write" data-one="${esc(B.number)}">${icon(testimony ? 'send' : 'mail')}<span>${esc(t(testimony ? 'btn.testimony' : 'btn.email'))}</span></a></section>`;
}

function yourIssues(D, L) {
  const head = `<h2 class="sec">${esc(t('week.issues'))}</h2>`;
  if (!D.following) return `<section class="wk-issues">${head}<p class="calm"><a href="#/bills">${esc(t('week.follow'))}</a></p></section>`;
  return `<section class="wk-issues">${head}${D.issues.map(({ i, now, wait }) => `<h3 class="ih">${keepHyphens(i.name)}</h3>`
    + (now.length ? `<div class="rows">${now.map(({ b, h }) => rowA(b.number, rowName(b, i),
        h ? `${t('week.heard.at', { date: dayLabel(hstDay(h.at)), time: timeOf(h.at) })}${shortCmte(h.committee, L.committees) ? ' · ' + shortCmte(h.committee, L.committees) : ''}`
          : t('bills.due', { when: when(b.due, L.now), time: timeOf(b.due) }))).join('')}</div>`
      : wait ? `<div class="rows">${rowA(wait.b.number, rowName(wait.b, i), t('week.wait', { date: dateLong(wait.until + 'T12:00:00-10:00', { now: L.now }) }))}</div>`
      : `<p class="calm">${esc(t('week.quiet'))}</p>`)).join('')}</section>`;
}

function hearings(D, L) {
  const grp = gs => gs.map(g => `<h3 class="day">${esc(dayLabel(g.day))}</h3><div class="rows">${g.rows.map(h => { const b = D.byId.get(h.billId), c = shortCmte(h.committee, L.committees);
    return rowA(b.number, b.name, c ? `${timeOf(h.at)} · ${c}` : timeOf(h.at), ` data-at="${esc(h.at)}"`); }).join('')}</div>`).join('');
  const body = D.days.length || D.next.length ? grp(D.days) + (D.next.length ? `<h3 class="nextwk">${esc(t('week.next'))}</h3>${grp(D.next)}` : '')
    : `<p class="calm">${esc(t('week.nohear'))}</p>`;
  return `<section class="wk-hear" aria-labelledby="wh-h"><h2 class="sec" id="wh-h">${esc(t('week.hearings'))}</h2>${body}
    <p class="more"><a href="#/bills">${esc(t('week.all'))}${icon('arrow-right', { size: '1em' })}</a></p></section>`;
}

// returning: the kicker greets a person who has followed or sent something before as one who is back.
export function weekScreen(D, L, { returning = false } = {}) {
  return `${header(null, { slim: true })}<main class="sheet week" id="main">
    <p class="kicker">${esc(t(returning ? 'week.kicker' : 'week.kicker.new', { date: dayLabel(D.W.today) }))}</p>
    <h1 tabindex="-1">${esc(t('week.h'))}</h1>
    ${card(D, L)}${yourIssues(D, L)}${hearings(D, L)}
  </main>${tabs('week')}`;
}
export const weekLoading = () => `${header(null, { slim: true })}<main class="sheet week" id="main" aria-busy="true"><h1 tabindex="-1">${esc(t('week.h'))}</h1><p class="sr">${esc(t('week.loading'))}</p>
  <div class="bar h w100"></div><div class="bar w60"></div><div class="bar w100"></div><div class="bar w90"></div><div class="bar w80"></div></main>${tabs('week')}`;
