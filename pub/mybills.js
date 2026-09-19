// My bills (tab): every bill this person follows, in the order they can do something about it.
// Soonest hearing first (that is where a five-minute action lives), then the bills racing a committee deadline,
// then the rest. Bills that stopped this session fold away at the bottom with the archive icon: they still belong
// to the person's record, but they are not something to act on. The bill row built here is shared with Find
// (search results, issue pages and HIPHI's lists), so a bill looks and follows the same way everywhere.
import { S, D, DEMO, app, esc, icon, blurb, spaced, billPath, alive, stopOf, plainStatus, sessionInfo, issueIcon, findBill, dateLong } from './core.js';
import { btn, iconBtn, chip, row } from './ui.js';
import { followToggle } from './actions.js';
import { VOICES } from './art.js';

// ---- words for one bill ----
// The headline is HIPHI's plain summary, else the official description. A bill HIPHI has not written up only has
// its official title ("RELATING TO TOBACCO PRODUCTS."), which newcomers read as legal noise, so it becomes "About
// tobacco products" instead.
export function headline(b, n = 170) {
  if (b.hiphi_summary || b.description) return blurb(b, n);
  const t = String(b.title || '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
  if (!t) return spaced(b.bill_number);
  const about = t.replace(/^relating to\s+/i, '');
  const s = about === t ? t : 'About ' + about.toLowerCase();
  return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s.charAt(0).toUpperCase() + s.slice(1);
}
// Still in play: in committee, on the floor, in conference, or on the Governor's desk. (core's alive() also leaves
// out the Governor's desk, but a bill waiting for a signature is not stopped, so it stays with the moving ones.)
export const moving = b => alive(b) || b.stage === 'governor';
export const becameLaw = b => b.stage === 'enacted';
export const stopped = b => !moving(b) && !becameLaw(b);

// The status chip: plainStatus in its short form. The hearing time is on the bill page; the chip only needs the
// day ("Hearing Tue · testimony due today"), so it stays one line on a phone.
const STATUS_ICON = { law: 'circle-check', vetoed: 'archive', dead: 'archive', governor: 'landmark', conference: 'handshake', floor: 'vote' };
export function statusChip(b) {
  const p = plainStatus(b), st = stopOf(b);
  const short = p.short.replace(/\s+at\s+\d{1,2}:\d{2}\s*[AP]M/i, '').replace(/tomorrow \(\w+\)/g, 'tomorrow');
  const ic = STATUS_ICON[st.phase] || (st.hearingState === 'scheduled' ? 'calendar' : st.hearingState === 'held' ? 'gavel' : 'hourglass');
  return chip(short, p.tone, ic);
}
// Why a stopped bill stopped, short enough for one line under its headline.
export function stoppedWhy(b) {
  if (b.stage === 'vetoed') return 'Vetoed by the Governor';
  if (/deferred/i.test(b.last_action || '')) return 'Put on hold by a committee';
  if (/failed to pass/i.test(b.last_action || '')) return 'Did not pass a vote';
  const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || '');
  if (m) return `Missed the deadline on ${dateLong(`20${m[3].slice(-2)}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T12:00:00-10:00`).replace(/^\w+, /, '')}`;
  if (/sine die/i.test(b.died_deadline || '')) return 'The session ended before it passed';
  return 'Stopped this session';
}
// Anything official in the last 72 hours on this bill (a new hearing, a vote, a referral).
export const isNew = b => (S.activity || []).some(a => a.bill_id === b.id && Date.now() - new Date(a.occurred_at).getTime() < 72 * 3600e3);

// ---- the bill row ----
// The whole row opens the bill page; the star beside it follows or unfollows (a separate 44px button, because a
// button inside a link is not allowed and would open the bill by accident).
export function billRow(b, { note = '', pos = false, fresh = false, why = false } = {}) {
  const on = S.watch.has(b.id), num = spaced(b.bill_number);
  const posText = pos && b.hiphi_position && b.hiphi_position !== 'monitor' ? ({ strongly_support: 'HIPHI supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes', strongly_oppose: 'HIPHI opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI has comments' })[b.hiphi_position] : '';
  const meta = why
    ? `<span class="mb-num">${esc(num)}</span><span class="mb-why">${esc(stoppedWhy(b))}</span>`
    : `<span class="mb-num">${esc(num)}${posText ? ` · ${esc(posText)}` : ''}</span>${fresh && isNew(b) ? '<span class="mb-new">New<span class="sr">: updated in the last 3 days</span></span>' : ''}${statusChip(b)}`;
  return `<li class="mb-row">
    <a class="mb-main" href="${billPath(b)}"><span class="mb-head">${esc(headline(b))}</span>${note ? `<span class="mb-note">${esc(note)}</span>` : ''}<span class="mb-meta">${meta}</span></a>
    ${iconBtn('star', `Follow ${num}`, { 'data-star': b.id, 'data-num': num, 'aria-pressed': on ? 'true' : 'false' }, 'mb-star' + (on ? ' on' : ''))}
  </li>`;
}
// An empty state with an h2 (ui.js's empty() uses h3, which would skip a level under this page's h1).
export const emptyBox = ({ art = '', title, text = '', action = '' }) => `<div class="empty mb-empty">${art ? `<div class="art">${art}</div>` : ''}<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}${action}</div>`;
export const billList = (bills, opt) => `<ul class="mb-list">${bills.map(b => billRow(b, typeof opt === 'function' ? opt(b) : opt)).join('')}</ul>`;

// A fold that keeps its open state across re-renders (a star tap re-renders the page; the fold must not snap shut).
S.mbOpen ??= {};
export function fold(id, summary, inner, { ic = 'archive', open = false } = {}) {
  const isOpen = S.mbOpen[id] ?? open;
  return `<details class="mb-fold" data-fold="${esc(id)}"${isOpen ? ' open' : ''}><summary><span class="mb-flead">${icon(ic)}</span><span class="mb-ftitle">${summary}</span>${icon('chevron-down', { cls: 'mb-chev' })}</summary>${inner}</details>`;
}

// Stars and folds. Called by this screen and by Find (on a full render and after Find paints results in place).
export function wireRows(root = document) {
  root.querySelectorAll('[data-star]').forEach(el => el.onclick = async () => {
    const id = el.dataset.star;
    el.setAttribute('aria-busy', 'true');
    // Put focus back on this star after the page redraws (or, when unfollowing removed the row, on the next one),
    // not at the top of the page.
    S.mbFocus = { id, idx: [...document.querySelectorAll('main [data-star]')].indexOf(el) };
    await followToggle(id, el.dataset.num);
    // Once followed, the bill's hearings come with the followed bills; drop the copy kept for unfollowed bills so a
    // hearing is not listed twice.
    if (S.watch.has(id) && S.bills.some(x => x.id === id)) delete S.xh[id];
  });
  root.querySelectorAll('details[data-fold]').forEach(d => d.addEventListener('toggle', () => { S.mbOpen[d.dataset.fold] = d.open; }));
  if (S.mbFocus) {
    const f = S.mbFocus, stars = [...document.querySelectorAll('main [data-star]')]; S.mbFocus = null;
    (stars.find(x => x.dataset.star === f.id) || stars[Math.min(f.idx, stars.length - 1)])?.focus({ preventScroll: true });
  }
}

// ---- the screen ----
// Everything followed, including a bill found in search that HIPHI does not track (the sandbox keeps those in its
// index, not in S.bills).
function mine() {
  const have = new Set(S.bills.map(b => b.id));
  const extra = [...S.watch].filter(id => !have.has(id)).map(id => findBill(id) || (DEMO ? D.index.find(x => x.id === id) : null)).filter(Boolean);
  return [...S.bills, ...extra];
}
// Soonest hearing, then soonest committee deadline, then the rest (furthest along last, so "Became law" ends it).
const PHASE_RANK = { committee: 0, floor: 1, conference: 2, governor: 3, law: 4 };
export function byUrgency(bills) {
  const key = b => {
    const st = stopOf(b);
    if (st.hearingState === 'scheduled' && st.hearing) return [0, new Date(st.hearing.scheduled_at).getTime()];
    if (st.phase === 'committee' && st.deadline && !st.deadline.missed) return [1, new Date(st.deadline.date + 'T23:59:59-10:00').getTime()];
    return [2, PHASE_RANK[st.phase] ?? 0];
  };
  return bills.map(b => ({ b, k: key(b) })).sort((x, y) => x.k[0] - y.k[0] || x.k[1] - y.k[1] || numCmp(x.b, y.b)).map(x => x.b);
}
// HB before SB, then by number (HB 9 before HB 10).
export const numCmp = (a, b) => { const pa = /^(\D+)(\d+)/.exec(a.bill_number) || [], pb = /^(\D+)(\d+)/.exec(b.bill_number) || [];
  return String(pa[1]).localeCompare(String(pb[1])) || (+pa[2] || 0) - (+pb[2] || 0); };

const listRow = l => row({ leadHtml: `<span class="lead">${icon(issueIcon(l.icon, 'list'))}</span>`, title: esc(l.title), sub: l.description ? `<span class="mb-clamp">${esc(l.description)}</span>` : '', href: `#/list/${encodeURIComponent(l.slug)}` });

function render() {
  const all = mine(), live = byUrgency(all.filter(b => !stopped(b))), gone = all.filter(stopped).sort(numCmp);
  const lists = (S.lists || []).filter(l => S.listFollows.has(l.id));
  const si = sessionInfo(), off = si.phase !== 'in';
  const head = `<div class="mb-top"><h1>My bills</h1>${all.length ? `<span class="mb-count">${all.length} bill${all.length === 1 ? '' : 's'}</span>` : ''}</div>`;
  let body;
  if (!all.length) {
    body = emptyBox({ art: VOICES, title: 'You’re not following any bills yet.',
      text: 'Follow a bill and it shows up here, with the next hearing and what you can do about it.',
      action: `<div class="btncol mb-emptybtns">${btn('Find bills', { kind: 'primary', icon: 'search', href: '#/find' })}${off ? '' : btn('Take the 1-minute start', { kind: 'text', href: '#/start/1' })}</div>` });
  } else if (!live.length) {
    // Only stopped bills: say so kindly, keep their record, and point to what is still moving.
    body = emptyBox({ title: off ? `The ${si.recapYear} session is over` : 'All your bills have finished for this session.',
      text: off ? `All your bills have finished, and their record stays here. The next session opens ${esc(nextOpenWords(si))}.` : 'Their record stays here.',
      action: btn(off ? 'Browse bills by issue' : 'Find bills still moving', { kind: 'primary', icon: 'search', href: '#/find' }) });
  } else {
    body = billList(live, { fresh: true });
  }
  const listSec = lists.length ? `<section aria-labelledby="mb-lists-h"><div class="sechead"><h2 id="mb-lists-h">Lists you follow</h2></div>
    <p class="small muted mb-sub">When HIPHI adds a bill to one of these lists, it shows up here.</p>
    <div class="rows">${lists.map(listRow).join('')}</div></section>` : '';
  const goneSec = gone.length ? fold('mb-stopped', `Stopped this session (${gone.length})`, billList(gone, { why: true }), { open: !live.length }) : '';
  return `<div class="mb">${head}${body}${listSec}${goneSec}</div>`;
}
const nextOpenWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';

export default {
  tab: 'bills',
  title: () => 'My bills',
  render,
  wire() { const root = document.querySelector('.mb'); if (root) wireRows(root); },
};
