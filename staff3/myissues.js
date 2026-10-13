// My issues (#/my-issues, R-263, Nate 10/12): staff own issues and work bills. "Should there instead be an issues tab with
// bills falling within the different issues? And staff instead 'own' issues, rather than bills?" His answers: its own
// place in the main menu, for everyone on staff, and helpers get the bills too. So this is each person's issues (the ones
// they own or help on, from the 2027 prep's owners and helpers, 091), soonest work first, each with where it stands and
// every bill on it in one line (the same line as the issue's own page, R-226). The bills on these issues are also in Bills >
// Mine, Today and the inbox (data.js isMine; backend migration 172), so nobody hands them over bill by bill.
// All issues stays the catalogue (rename, merge, put bills on issues); the 2027 prep list is prep.js ?view=mine.
// v3 (R-264): the first of three tabs, My issues · All issues · Coalitions (ui.js sectionNav), three ways to group bills,
// laid out by the laptop rules: one line per issue (its name, the soonest thing that needs someone, how many bills move)
// and one line per bill under it. Not a list and a pane: an issue's own page already shows its week one click away, and
// a second column would halve the room these lines need for no new fact.
import { S, SESSION_YEAR, SESSION_OVER, esc, fmtDT, myIssueIds } from './data.js';
import { billRoute, hearingAhead, diedish, billNum, plain } from './model.js';
import { icon, btn, empty, posChip, sectionNav } from './ui.js';
import { plural, isSide, clip } from './lists.js';
import { catByKey, billsOn, whyNot, nextPhrase, testimonyWords, againstStance } from './issues.js';
import { indexLinks, isDraft } from './prep.js';
import { isPos, dayOf, waitingOfBills } from './standing.js';

const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const dayAt = d => dayOf(d + 'T12:00:00-10:00');

// Each of my issues with what decides its place: the soonest hearing on its bills, then its bills at risk, then the ones
// with bills still moving, then those with no bills yet; in session, issues whose bills all stopped go last, in one fold.
const rank = x => x.hear ? 0 : x.w.risk.length ? 1 : x.going.length ? 2 : !x.bills.length ? 3 : 4;
function myIssues() {
  const ids = myIssueIds();
  return (S.issues || []).filter(i => ids.has(String(i.id))).map(i => {
    const bills = billsOn(i).filter(b => thisSession(b) && b.tracked !== false).sort(byNum);
    const going = bills.filter(b => !diedish(b)), gone = bills.filter(diedish);
    const hears = going.filter(isPos).map(b => ({ b, h: hearingAhead(b) })).filter(x => x.h).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
    return { i, bills, going, gone, hear: hears[0] || null, w: waitingOfBills(going), own: i.owner_id === S.me?.id };
  }).sort((x, y) => rank(x) - rank(y) || (x.hear && y.hear ? x.hear.h.scheduled_at.localeCompare(y.hear.h.scheduled_at) : 0) || x.i.name.localeCompare(y.i.name));
}

// The soonest thing on the issue that needs someone, said once on the issue's own line (v3): the next hearing, with its
// bill and testimony; else the bills at risk; else the bills racing the next deadline. Only when two or more bills are
// moving: with one, its row already says it (R-263, A-14). Nothing between sessions.
function soonest({ hear, w, going }) {
  if (SESSION_OVER || going.length < 2) return '';
  if (hear) return `<a href="#/hearing/${encodeURIComponent(hear.h.id)}">Hearing ${esc(fmtDT(hear.h.scheduled_at))}</a> · ${esc(hear.b.bill_number)}${isPos(hear.b) ? ` · ${esc(testimonyWords(hear.h, hear.b))}` : ''}`;
  if (w.risk.length) return `<b>At risk:</b> ${w.risk.length === 1 ? `${esc(w.risk[0].b.bill_number)} needs` : `${w.risk.length} bills need`} a hearing by ${esc(dayAt(w.risk[0].st.deadline.date))}`;
  if (w.race.length) return `Needs a hearing by ${esc(dayAt(w.next))} · ${esc(plural(w.race.length, 'bill'))}`;
  return '';
}

// Why a bill's followers do not get it, in two words on its row (the issue page says it in full).
const REACH = b => b.tracked === false ? 'Not tracked' : !b.is_public ? 'Not public' : !b.position || b.position === 'monitor' ? 'No position' : '';
// A bill under its issue, on one line (v3): its number and nickname, then where it stands in one short phrase. Its own
// position shows only where it differs from the issue's stance (the issue's stance is the team's), or every one on a
// Mixed issue, where each bill's side is the point.
// A nickname that is the issue's own name is not said again under it (A-14): the number alone names that bill.
function billRow(b, odd, i) {
  const why = whyNot(b), reach = REACH(b), nm = b.nickname && plain(b.nickname) === plain(i.name) ? '' : b.nickname || clip(b, 80);
  return `<li class="mi-brow"><a class="mi-bmain" href="${billRoute(b)}"><b>${esc(billNum(b))}</b>${nm ? ` <span class="mi-bn">${esc(nm)}</span>` : ''}</a>
      <span class="mi-bend"><span class="mi-bph">${esc(nextPhrase(b))}</span>${odd.has(b.id) ? posChip(b.position || '') : ''}${why ? `<span class="mi-reach" title="${esc(why)}">${icon('eye-off')}<span>${esc(reach)}</span></span>` : ''}</span></li>`;
}

// One issue: a card whose first line is the issue (its name, the soonest thing, how many bills move), then its moving
// bills one line each; the ones that did not advance wait in one quiet fold.
function issueSec(x, k) {
  const { i, bills, going, gone, own } = x, c = catByKey(i.category), href = `#/issue/${encodeURIComponent(i.id)}?from=mine`;
  // The rows under the name are its moving bills, each with its own next step, so the line says no count and no hearing
  // of its own (A-14: the soonest hearing was said on the issue's line and again on its bill's row; fresh-eyes review).
  const count = !bills.length ? 'No bills yet' : going.length ? '' : 'Nothing moving';
  const tags = [own ? '' : 'You help', isDraft(i) ? 'Draft' : ''].filter(Boolean);
  const odd = new Set((i.stance === 'mixed' ? going.filter(b => b.position) : againstStance(i, going)).map(b => b.id));
  const soon = '';
  return `<section class="card mi-iss" aria-labelledby="mi-h${k}">
    <div class="mi-ihead"><h2 class="mi-iname" id="mi-h${k}"><a href="${href}"><span class="mi-ic">${icon(c?.icon || 'tag')}</span><span>${esc(i.name)}</span></a></h2>
      ${soon ? `<p class="mi-soon">${soon}</p>` : ''}${tags.length || count ? `<p class="mi-cnt">${tags.map(t => `<span class="mi-tag">${esc(t)}</span>`).join('')}${esc(count)}</p>` : ''}</div>
    ${going.length ? `<ol class="mi-bills">${going.map(b => billRow(b, odd, i)).join('')}</ol>` : ''}
    ${gone.length ? `<details class="mi-gone"><summary>${icon('chevron-down', { cls: 'is-chev' })}<span>${gone.length} did not advance</span></summary><ol class="mi-bills">${gone.map(b => billRow(b, odd, i)).join('')}</ol></details>` : ''}
    ${bills.length ? '' : `<p class="mi-none">No ${esc(SESSION_YEAR)} bills on it yet. <a href="${href}">Put bills on it</a></p>`}
  </section>`;
}

export default {
  tab: 'myissues',
  title: () => 'My issues',
  render() {
    const list = myIssues();
    const owned = list.filter(x => x.own).length, helped = list.length - owned;
    const who = [owned ? `You own ${plural(owned, 'issue')}` : '', helped ? `${owned ? 'help' : 'You help'} on ${helped}` : ''].filter(Boolean).join(' and ');
    if (!list.length) return `<div class="le-page le-list is-page mi-page">${sectionNav('issues', 'mine')}<div class="le-tools"><h1 class="le-h1">My issues</h1></div>
      <div class="le-empty">${empty({ title: 'No issues are yours yet', text: 'When an admin makes you the owner of an issue, or the owner adds you as a helper, it shows here with all its bills. Those bills are then in your Mine and on Today too.', action: btn('See all issues', { kind: 'secondary', href: '#/outreach/issues' }) })}</div></div>`;
    // In session, issues whose bills have all stopped wait in one quiet fold at the end (B-14: a fold for what is done).
    const live = SESSION_OVER ? list : list.filter(x => rank(x) < 4), still = SESSION_OVER ? [] : list.filter(x => rank(x) === 4);
    return `<div class="le-page le-list is-page mi-page${isSide() ? ' le-side' : ''}">
      ${sectionNav('issues', 'mine')}
      <div class="le-tools"><h1 class="le-h1">My issues</h1>
        <p class="le-lede">${who}. Soonest work first.</p></div>
      ${SESSION_OVER ? indexLinks({ mineOnly: true }) : ''}
      ${live.map(issueSec).join('')}
      ${still.length ? `<details class="is-arch mi-still"><summary>${icon('history')}<span>Nothing moving this session (${still.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary><div class="mi-stillin">${still.map((x, k) => issueSec(x, 's' + k)).join('')}</div></details>` : ''}
    </div>`;
  },
  wire() {},
};
