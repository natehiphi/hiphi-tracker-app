// This week (R-360 part 5, #/week): one job, see what is happening at the Capitol this week and the one thing to do.
// From the top: today's date and the heading; "Your one thing this week", the single bill to act on, with the one primary
// button (the bill screen's own rule: Send testimony, or Email the chair); "Your issues", each followed issue with its bills
// that have something this week (the card's bill left out: it is said once, A-14); then "Hearings on bills we follow",
// this week's by day, then next week's. Every hearing is in the page: after ten rows "Show N more hearings" reveals the rest,
// and the one thing's own hearing is never among the hidden ones (B-3, R-360 fix pass).
// Nate's structure of 6 Nov: issues are the unit people follow, and bills live within issues.
// "This week" is the Capitol's week in Hawaiʻi time: Monday to Friday, from today on. On a Saturday or a Sunday it is the
// week ahead (nothing is heard at the weekend). The practice copy's clock is Mon 16 Mar 2026, 9:00 am (one/data.js).
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { loadBill } from './data.js';
import { esc, header, keepHyphens } from './bill.js';
import { HST, dateLong, capitolWeek, sendBy, hearingWords } from './words.js';
import { isDone } from './done.js';
import { followed, byNum } from './bills.js';
import { tabs } from './tabs.js';
import { codesOf, cmteInfo } from '../pub/capitol.js';
import { CHAMBER_NAME } from '../stops.js';

const ROWS = 10, TRIES = 8;
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const noon = day => new Date(day + 'T12:00:00-10:00').getTime();
const dayLabel = day => new Date(noon(day)).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });

// "House Transportation"; heard together, "Senate Health and Human Services, with Commerce and Consumer Protection".
// The chamber and the names, never a code (C-15): an unknown code gives the time alone.
export function shortCmte(code, cm) {
  const cs = codesOf(code).map(k => cmteInfo(k, cm)).filter(Boolean);
  if (!cs.length) return '';
  return `${CHAMBER_NAME[cs[0].chamber] || ''} ${cs[0].name}`.trim() + (cs.length > 1 ? t('week.with', { names: cs.slice(1).map(c => c.name).join(' and ') }) : '');
}

const nameOf = B => B.nickname || B.summary || B.numberSpaced;
const chev = icon('chevron-right', { size: '18px', cls: 'chev' });
// A row is titled by the bill's everyday name, never by its number alone; the number follows, small (A-14, R-360 fix pass).
// No space before the number: its margin spaces it, and it wraps with the name's last word rather than alone on a line.
const rowA = (b, sub, extra = '') => `<a class="r" href="#/${esc(b.number)}" data-bill="${esc(b.number)}"${extra}><span class="t"><b>${keepHyphens(b.name)}<span class="rn">${esc(b.numberSpaced)}</span></b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${chev}</a>`;

// Everything the screen draws, worked out once per visit: the list (data.js, once a page life) and, for the one thing and
// for an issue with nothing this week, the bill's own shape (loadBill: the bill screen's rule for its action, its done mark
// and the day the chairs have until). Live, that is one request per bill looked at; the practice copy has them all.
export async function weekData(L) {
  const W = capitolWeek(L.now), first = new Map();
  for (const h of L.hearings) if (!first.has(h.billId)) first.set(h.billId, h);
  const thisWeek = h => h && W.days.includes(hstDay(h.at));
  const catOrder = new Map(L.cats.map((c, k) => [c.key, k]));
  const mine = L.issues.filter(followed)
    .sort((x, y) => (catOrder.get(x.category) ?? 99) - (catOrder.get(y.category) ?? 99) || x.sort_order - y.sort_order || x.name.localeCompare(y.name));
  const mineIds = new Set(mine.map(i => i.id)), inMine = b => b.issues.some(id => mineIds.has(id));
  const soon = b => b.due && b.due < W.endIso;

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

  // Your issues: each followed issue, its bills with a hearing this week or testimony due this week, soonest first, the
  // card's bill left out (one quiet line says it is the one thing above); else one line about the first of its bills still
  // waiting for a hearing, or that nothing is on at the Capitol.
  const issues = [];
  for (const i of mine) {
    const bs = L.bills.filter(b => b.issues.includes(i.id)).sort(byNum);
    const all = bs.filter(b => thisWeek(first.get(b.id)) || soon(b)).map(b => ({ b, h: first.get(b.id) || null }));
    const hasPick = !!pick && all.some(x => x.b.id === pick.id);
    const now = all.filter(x => !pick || x.b.id !== pick.id).sort((x, y) => (x.h?.at || x.b.due).localeCompare(y.h?.at || y.b.due) || byNum(x.b, y.b));
    let wait = null;
    if (!now.length && !hasPick) for (const b of bs.filter(b => b.alive).slice(0, 3)) {
      let B = null; try { B = await loadBill(b.number); } catch { /* as above */ }
      if (B?.waitUntil) { wait = { b, until: B.waitUntil }; break; }
    }
    issues.push({ i, now, wait, hasPick });
  }

  // The hearings: this week's by day, then next week's, all of them (hearings() hides the ones after ten behind Show more).
  const byId = new Map(L.bills.map(b => [b.id, b])), group = days => days.map(d => ({ day: d, rows: L.hearings.filter(h => hstDay(h.at) === d && byId.has(h.billId)) })).filter(g => g.rows.length);
  const days = group(W.days), next = group(W.next);
  // soon: a bill whose testimony closes before the week is out (Home counts them per issue, part 6).
  return { W, pick, sent, issues, following: mine.length > 0, days, next, byId, soon };
}

function card(D, L) {
  const lab = `<p class="lab1">${esc(t('week.one'))}</p>`, last = D.sent[0];
  const sentLine = last ? `<p class="okline small1" role="status">${icon('circle-check')}<span>${esc(t('week.sent', { name: nameOf(last) }))}</span></p>` : '';
  if (!D.pick) return `<section class="card pick" aria-labelledby="w1-h"><h2 class="sr" id="w1-h">${esc(t('week.one'))}</h2>${lab}${sentLine}<p class="calm">${esc(t(last ? 'week.none.after' : 'week.none'))}</p></section>`;
  const B = D.pick, testimony = B.action === 'testimony' && B.hearing;
  // The deadline in sendBy's words (as Home, Bills and the bill say it), then the hearing ahead: "The committee hears it
  // Fri, Mar 20." Amber only within 24 hours (A-5).
  const by = testimony ? sendBy(B.hearing.deadline || B.hearing.at, L.now) : null;
  const line = testimony
    ? `<b>${esc(by.text)}.</b> ${esc(t(B.hearing.joint ? 'week.hears.many' : 'week.hears.one', { date: '\u0000' })).replace('\u0000', `<span class="nw">${esc(hstDay(B.hearing.at) === D.W.today ? t('when.today') : dateLong(B.hearing.at, { now: L.now }))}</span>`)}`
    : esc(B.waitUntil ? t('week.wait', { date: dateLong(B.waitUntil + 'T12:00:00-10:00', { now: L.now }) }) : t('week.wait.none'));
  return `<section class="card pick" aria-labelledby="w1-h">${lab}${sentLine}<h2 id="w1-h">${keepHyphens(nameOf(B))}</h2>
    <p class="ln${by?.soon ? ' soon' : ''}">${icon('clock')}<span>${line}</span></p>
    <a class="primary" href="#/${esc(B.number)}/write" data-one="${esc(B.number)}">${icon(testimony ? 'send' : 'mail')}<span>${esc(t(testimony ? 'btn.testimony' : 'btn.email'))}</span></a></section>`;
}

// An issue's rows: each its hearing ("Hearing Fri, Mar 20, 9:30 AM") or its deadline; a committee is named on the first row
// that has it and not again under the same issue (a long name said once, A-14).
function issueRows(now, L) {
  let said = '';
  return now.map(({ b, h }) => {
    if (!h) return rowA(b, sendBy(b.due, L.now).text);
    const c = shortCmte(h.committee, L.committees), say = c && c !== said;
    if (c) said = c;
    return rowA(b, `${hearingWords(h.at, L.now)}${say ? ' · ' + c : ''}`);
  }).join('');
}
function yourIssues(D, L) {
  const head = `<h2 class="sec">${esc(t('week.issues'))}</h2>`;
  // Only "Bills" is the link: the rest of the line says what following does.
  if (!D.following) return `<section class="wk-issues">${head}<p class="calm">${esc(t('week.follow', { bills: '\u0000' })).replace('\u0000', `<a class="inl" href="#/bills">${esc(t('week.follow.link'))}</a>`)}</p></section>`;
  return `<section class="wk-issues">${head}${D.issues.map(({ i, now, wait, hasPick }) => `<h3 class="ih">${keepHyphens(i.name)}</h3>`
    + (hasPick ? `<p class="calm quiet">${esc(t('week.pickline'))}</p>` : '')
    + (now.length ? `<div class="rows">${issueRows(now, L)}</div>`
      : wait ? `<div class="rows">${rowA(wait.b, t('week.wait', { date: dateLong(wait.until + 'T12:00:00-10:00', { now: L.now }) }))}</div>`
      : hasPick ? '' : `<p class="calm">${esc(t('week.quiet'))}</p>`)).join('')}</section>`;
}

// The hearings, never cut silently (B-3): the first ten rows show, the rest wait behind "Show N more hearings", and the one
// thing's own hearing always shows. A day whose rows are all hidden is hidden with them, as is Next week's heading.
function hearings(D, L) {
  const pick = D.pick?.id;
  let shown = 0, hidden = 0;
  const mark = gs => gs.map(g => ({ ...g, rows: g.rows.map(h => { const hide = h.billId !== pick && shown >= ROWS; if (hide) hidden++; else shown++; return { h, hide }; }) }));
  const days = mark(D.days), next = mark(D.next), off = g => g.rows.every(r => r.hide);
  const grp = gs => gs.map(g => `<div class="dgrp"${off(g) ? ' hidden' : ''}><h3 class="day">${esc(dayLabel(g.day))}</h3><div class="rows">${g.rows.map(({ h, hide }) => {
    const b = D.byId.get(h.billId), c = shortCmte(h.committee, L.committees);
    return rowA(b, c ? `${timeOf(h.at)} · ${c}` : timeOf(h.at), ` data-at="${esc(h.at)}"${hide ? ' hidden' : ''}`); }).join('')}</div></div>`).join('');
  const more = hidden ? `<div class="rows morehear"><button class="r more" type="button" data-morehear><span class="t"><span>${esc(hidden === 1 ? t('week.morehear.one') : t('week.morehear', { n: hidden }))}</span></span>${icon('chevron-down', { size: '18px', cls: 'chev' })}</button></div>` : '';
  const body = days.length || next.length ? grp(days) + (next.length ? `<h3 class="nextwk"${next.every(off) ? ' hidden' : ''}>${esc(t('week.next'))}</h3>${grp(next)}` : '') + more
    : `<p class="calm">${esc(t('week.nohear'))}</p>`;
  return `<section class="wk-hear" aria-labelledby="wh-h"><h2 class="sec" id="wh-h">${esc(t('week.hearings'))}</h2>${body}
    <p class="more"><a href="#/bills">${esc(t('week.all'))}${icon('arrow-right', { size: '1em' })}</a></p></section>`;
}
// Show N more hearings: the hidden days and rows appear, and the focus goes to the first row just shown.
export function wireWeek(root) {
  const btn = root.querySelector('[data-morehear]');
  btn?.addEventListener('click', () => {
    const first = root.querySelector('.wk-hear a.r[hidden]');
    root.querySelectorAll('.wk-hear [hidden]').forEach(x => { x.hidden = false; });
    btn.closest('.morehear').remove(); first?.focus();
  });
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
