// My issues (#/my-issues, R-263, Nate 10/12): staff own issues and work bills. "Should there instead be an issues tab with
// bills falling within the different issues? And staff instead 'own' issues, rather than bills?" His answers: its own
// place in the main menu, for everyone on staff, and helpers get the bills too. So this is each person's issues (the ones
// they own or help on, from the 2027 prep's owners and helpers, 091), soonest work first, each with where it stands and
// every bill on it in one line (the same line as the issue's own page, R-226). The bills on these issues are also in Bills >
// Mine, Today and the inbox (data.js isMine; backend migration 172), so nobody hands them over bill by bill.
// Outreach > Issues stays the catalogue (rename, merge, put bills on issues); the 2027 prep list is prep.js ?view=mine.
import { S, SESSION_YEAR, SESSION_OVER, esc, fmtDT, myIssueIds } from './data.js';
import { billRoute, hearingAhead, diedish } from './model.js';
import { icon, btn, empty, posChip } from './ui.js';
import { plural, billName, isSide } from './lists.js';
import { catByKey, billsOn, standLine, whyNot } from './issues.js';
import { indexLinks, isDraft } from './prep.js';
import { isPos, dayOf, waitingOfBills } from './standing.js';

const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const leftWord = dl => dl.days <= 0 ? 'last day today' : `${dl.days} day${dl.days === 1 ? '' : 's'} left`;

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

// One line under the issue's name, only when it says what the bill rows do not (ui-critic, A-14): the next hearing when
// more than one bill is moving (with one, its row already says it), and how many are at risk. Nothing between sessions.
function nowLine({ hear, w, going }) {
  if (SESSION_OVER || !going.length) return '';
  const parts = [];
  if (hear && going.length > 1) parts.push(`<b>Next hearing</b> <a href="#/hearing/${encodeURIComponent(hear.h.id)}">${esc(fmtDT(hear.h.scheduled_at))}</a>${hear.h.committee ? ` · ${esc(hear.h.committee)}` : ''} · ${esc(hear.b.bill_number)}`);
  if (w.risk.length) { const { st } = w.risk[0]; parts.push(`<b>${w.risk.length} at risk</b>: ${w.risk.length === 1 ? 'needs' : 'the first needs'} a hearing by ${esc(dayOf(st.deadline.date + 'T12:00:00-10:00'))}, ${esc(leftWord(st.deadline))}`); }
  return parts.length ? `<p class="mi-now">${parts.join('<span class="mi-sep" aria-hidden="true"> · </span>')}</p>` : '';
}

// The owner is said only when it is someone else: the issue is yours here, so "Owner: You" and "No owner" say nothing (A-14).
function billRow(b) {
  const why = whyNot(b);
  return `<li class="le-brow"><a class="le-bmain" href="${billRoute(b)}">${billName(b, 140)}
      <span class="is-bstat">${esc(standLine(b, { owner: 'others' }))}</span>
      <span class="is-bmeta">${posChip(b.position || '')}</span>
      ${why ? `<span class="le-warn">${icon('eye-off')}${esc(why)}</span>` : ''}</a></li>`;
}

function issueSec(x, k) {
  const { i, bills, going, gone, own } = x, c = catByKey(i.category), href = `#/issue/${encodeURIComponent(i.id)}?from=mine`;
  const count = !bills.length ? 'No bills yet' : going.length ? plural(going.length, 'bill') + (SESSION_OVER ? '' : ' moving') : 'Nothing moving';
  return `<section class="le-sec mi-iss" aria-labelledby="mi-h${k}">
    <div class="mi-head"><h2 id="mi-h${k}"><a href="${href}"><span class="mi-ic">${icon(c?.icon || 'tag')}</span><span>${esc(i.name)}</span></a></h2>
      <p class="meta">${own ? 'You own it' : 'You help on it'}${isDraft(i) ? ' · Draft' : ''} · ${esc(count)}</p></div>
    ${nowLine(x)}
    ${going.length ? `<ol class="rows le-bills">${going.map(billRow).join('')}</ol>` : ''}
    ${gone.length ? `<details class="mi-gone"><summary>${icon('chevron-down', { cls: 'is-chev' })}<span>${gone.length} did not advance</span></summary><ol class="rows le-bills">${gone.map(billRow).join('')}</ol></details>` : ''}
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
    if (!list.length) return `<div class="le-page le-list is-page mi-page"><div class="le-tools"><h1 class="le-h1">My issues</h1></div>
      <div class="le-empty">${empty({ title: 'No issues are yours yet', text: 'When an admin makes you the owner of an issue, or the owner adds you as a helper, it shows here with all its bills. Those bills are then in your Mine and on Today too.', action: btn('See all issues', { kind: 'secondary', href: '#/outreach/issues' }) })}</div></div>`;
    // In session, issues whose bills have all stopped wait in one quiet fold at the end (B-14: a fold for what is done).
    const live = SESSION_OVER ? list : list.filter(x => rank(x) < 4), still = SESSION_OVER ? [] : list.filter(x => rank(x) === 4);
    return `<div class="le-page le-list is-page mi-page${isSide() ? ' le-side' : ''}">
      <div class="le-tools"><h1 class="le-h1">My issues</h1>
        <p class="le-lede">${who}. Soonest work first.</p></div>
      ${SESSION_OVER ? indexLinks({ mineOnly: true }) : ''}
      ${live.map(issueSec).join('')}
      ${still.length ? `<details class="is-arch mi-still"><summary>${icon('history')}<span>Nothing moving this session (${still.length})</span>${icon('chevron-down', { cls: 'is-chev' })}</summary><div class="mi-stillin">${still.map((x, k) => issueSec(x, 's' + k)).join('')}</div></details>` : ''}
    </div>`;
  },
  wire() {},
};
