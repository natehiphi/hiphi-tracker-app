// My bills (tab): every bill this person follows, in the order they can do something about it.
// Soonest hearing first (that is where a five-minute action lives), then the bills racing a committee deadline,
// then the rest. Bills that stopped this session fold away at the bottom with the archive icon: they still belong
// to the person's record, but they are not something to act on. The bill row built here is shared with Find
// (search results, issue pages, HIPHI's lists and the suggestion rows), so a bill looks and follows the same way
// everywhere. On a phone a row is a small stack; from 1100px the same markup lines up as a table with a header row
// (bill, status, next date, stance, follow), so a desktop gets a real list instead of a widened phone.
import { S, D, DEMO, esc, icon, nick, blurb, spaced, billPath, alive, stopOf, plainStatus, dueInfo, dayWord, timeWord, dateLong, hstDay,
  sessionInfo, issueIcon, findBill, posInfo, myStance, countOk, listBillsFor, app } from './core.js';
import { btn, iconBtn, row } from './ui.js';
import { followToggle } from './actions.js';
import { VOICES } from './art.js';

// ---- words for one bill ----
// What the bill does, in a sentence: HIPHI's plain summary, else the cleaned official description. A bill HIPHI has
// not written up only has its official title ("RELATING TO TOBACCO PRODUCTS."), which newcomers read as legal noise,
// so it becomes "About tobacco products" instead. blurb() ends at a sentence when it can; how much of it shows is
// then decided by lines in CSS (two on a phone, more on a wide screen), not by a character count (Nate, 9/19).
export function what(b, n = 170) {
  if (b.hiphi_summary || b.description) return blurb(b, n);
  const t = String(b.title || '').replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '');
  if (!t) return spaced(b.bill_number);
  const about = t.replace(/^relating to\s+/i, '');
  const s = about === t ? t : 'About ' + about.toLowerCase();
  return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s.charAt(0).toUpperCase() + s.slice(1);
}
// How a bill is named in a sentence, a toast or a label: "Disposable vape ban (HB 2121)", else "HB 2121".
export const nameOf = b => nick(b) ? `${nick(b)} (${spaced(b.bill_number)})` : spaced(b.bill_number);
// Still in play: in committee, on the floor, in conference, or on the Governor's desk. (core's alive() also leaves
// out the Governor's desk, but a bill waiting for a signature is not stopped, so it stays with the moving ones.)
export const moving = b => alive(b) || b.stage === 'governor';
export const becameLaw = b => b.stage === 'enacted';
export const stopped = b => !moving(b) && !becameLaw(b);

// The status chip: plainStatus in its short form. The hearing time is on the bill page and in the "Next date"
// column; the chip only needs the day ("Hearing Tue · testimony due today"), so it stays one line on a phone.
// In the wide table the hearing has its own column, so there the chip keeps only the part a person acts on
// ("Testimony due today"): .mb-cm is the phone wording, .mb-cw the table wording, and CSS shows one of them.
// `h` is for a suggested bill nobody here follows yet: its hearing comes from the suggestion pool, not from the
// hearings loaded for followed bills, so the chip is worded from that hearing directly.
const STATUS_ICON = { law: 'circle-check', vetoed: 'archive', dead: 'archive', governor: 'landmark', conference: 'handshake', floor: 'vote' };
const trimTime = s => s.replace(/\s+at\s+\d{1,2}:\d{2}\s*[AP]M/i, '').replace(/tomorrow \(\w+\)/g, 'tomorrow');
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);
export function statusChip(b, h) {
  let short, tone, ic, hearing = false;
  if (h && alive(b)) {
    const d = dueInfo(h), day = `Hearing ${dayWord(h.scheduled_at)}`;
    short = d && !d.late ? `${day} · ${d.text.replace('Testimony ', 'testimony ')}` : day; tone = d?.tone || 'info'; ic = 'calendar'; hearing = true;
  } else {
    const p = plainStatus(b), st = stopOf(b); short = p.short; tone = p.tone; hearing = alive(b) && st.hearingState === 'scheduled';
    ic = STATUS_ICON[st.phase] || (hearing ? 'calendar' : st.hearingState === 'held' ? 'gavel' : 'hourglass');
  }
  short = trimTime(short);
  const parts = hearing ? short.split(' · ') : [short];
  const words = parts.length === 2 ? `<span class="mb-cm">${esc(short)}</span><span class="mb-cw">${esc(capFirst(parts[1]))}</span>` : esc(short);
  return `<span class="chip${tone ? ' ' + tone : ''}">${icon(ic)}${words}</span>`;
}
// The next date that matters: the hearing, else the day the bill must be heard by. Only for a bill that is still
// alive: a stopped bill never shows an upcoming hearing or a deadline (test hearings linger on a few, 9/19).
const dayLabel = iso => { const d = hstDay(iso), md = new Date(iso).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric' });
  return d === hstDay(Date.now()) ? `Today, ${md}` : d === hstDay(Date.now() + 864e5) ? `Tomorrow, ${md}` : dateLong(iso); };
export function nextDate(b, h) {
  if (!alive(b)) return null;
  const st = stopOf(b), hr = h || (st.hearingState === 'scheduled' ? st.hearing : null);
  if (hr) return { day: dayLabel(hr.scheduled_at), sub: `Hearing at ${timeWord(hr.scheduled_at)}` };
  if (st.phase === 'committee' && st.hearingState === 'none' && st.deadline && !st.deadline.missed) return { day: dayLabel(st.deadline.date + 'T12:00:00-10:00'), sub: 'Last day for a hearing' };
  return null;
}
// Why a stopped bill stopped, short enough for one line under its headline.
export function stoppedWhy(b) {
  if (b.stage === 'vetoed') return 'Vetoed by the Governor';
  if (/deferred/i.test(b.last_action || '')) return 'Put on hold by a committee';
  if (/failed to pass/i.test(b.last_action || '')) return 'Did not pass a vote';
  const at = stoppedAt(b);
  if (at) return `Missed the deadline on ${dateLong(at).replace(/^\w+, /, '')}`;
  if (/sine die/i.test(b.died_deadline || '')) return 'The session ended before it passed';
  return 'Stopped this session';
}
// The day a bill missed its deadline ("First Lateral 2/20/26"), as a Hawaiʻi noon; null when the data has no date.
function stoppedAt(b) {
  const m = /(\d+)\/(\d+)\/(\d+)\s*$/.exec(b.died_deadline || '');
  return m ? `20${m[3].slice(-2)}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T12:00:00-10:00` : null;
}
// Where the person stands, said quietly. The stance is chosen on the bill page; a row only shows it.
const STANCE = { support: ['thumbs-up', 'You support'], oppose: ['thumbs-down', 'You oppose'], unsure: ['circle-help', 'Not sure yet'] };
export const stanceInfo = id => { const s = STANCE[myStance(id)]; return s ? { icon: s[0], text: s[1] } : null; };

// ---- "New": what changed since the person last looked at My bills ----
// It used to mean "anything official in the last 72 hours", which in session is nearly every bill (11 of 14 rows in
// the 9/19 assessment), so it told nobody anything. Now a row is New only when something a person would care about
// happened since their last visit to this screen, and the marker says what ("New: hearing set").
// What "since the last visit" is measured against is kept in this browser under hiphi_bills_seen: the time of the
// visit and, for each bill shown, the newest piece of news it had. A timestamp alone would miss things: official
// actions are dated by day (8:00 on the day they happened) and reach us hours later, so an action dated this morning
// can arrive after tonight's visit. A first visit has nothing stored, so it marks nothing, and so does a bill
// followed since the last visit. Visits within 30 minutes count as one, so opening a bill and coming back does not
// wipe the marks. A bare timestamp in storage also works (everything after it is new). The sandbox clock restarts
// on every load, so with &seed=1 (the returning-visitor preview) the last visit is imagined as four days ago.
const SEEN_KEY = DEMO ? 'hiphi_bills_seen_demo' : 'hiphi_bills_seen';
// Official actions are written in Capitol shorthand; only the ones that change what a person can do or expect are
// turned into words. First and second readings, notices and paperwork are left out on purpose.
const chamberOf = a => /senate/i.test(a.details || '') ? 'Senate' : /house/i.test(a.details || '') ? 'House' : '';
const NEWS = [   // [what the official action says, the words for it, true for a notice posted ahead of time]
  [/intent to veto/i, () => 'the Governor may veto it'],
  [/\bvetoed\b|veto message/i, () => 'vetoed'],
  [/became law|signed into law|\bact \d+/i, () => 'became law'],
  [/(transmitted|enrolled) to (the )?governor/i, () => 'sent to the Governor'],
  [/scheduled (a |for a )?public hearing|scheduled to be heard|rescheduled its public hearing/i, () => 'hearing set', true],
  [/scheduled for decision making/i, () => 'committee vote set', true],
  [/be deferred|deferred until|measure deferred/i, () => 'put on hold'],
  [/recommends? that the measure be passed|recommend\(s\) that the measure be passed|recommending passage|recommendation of passage/i, () => 'passed a committee'],
  [/passed (third|final) reading/i, a => chamberOf(a) ? `passed the ${chamberOf(a)}` : 'passed a vote'],
  [/received from (the )?house/i, () => 'now in the Senate'],
  [/received from (the )?senate/i, () => 'now in the House'],
];
// The newest piece of news on a bill, as { at, label }, looking no later than `upTo`. Same-day actions share one
// timestamp, so the order of NEWS breaks the tie the same way every time. For a bill that has stopped, the news is
// that it stopped (never an older hearing notice), dated by its missed deadline, the end of the session, or its
// last official action.
function newsItem(b, upTo = Infinity) {
  if (stopped(b)) {
    const label = b.stage === 'vetoed' ? 'vetoed' : /deferred/i.test(b.last_action || '') ? 'put on hold' : /failed to pass/i.test(b.last_action || '') ? 'did not pass a vote' : 'stopped';
    const day = label === 'stopped' && (stoppedAt(b) || (/sine die/i.test(b.died_deadline || '') && sessionInfo().end + 'T12:00:00-10:00')) || (b.last_action_date ? String(b.last_action_date).slice(0, 10) + 'T12:00:00-10:00' : '');
    const at = Date.parse(day || '');
    return at <= upTo ? { at, label } : null;
  }
  // The sandbox is frozen at 9:00 on its day, but its data was captured later. Of that day's actions only the
  // notices (posted ahead of time) have happened yet; its committee decisions and votes have not.
  const today = DEMO ? Date.parse(hstDay(Date.now()) + 'T00:00:00-10:00') : Infinity;
  let best = null;
  for (const a of S.activity || []) {
    if (a.bill_id !== b.id) continue;
    const at = Date.parse(a.occurred_at); if (!(at <= upTo)) continue;
    const rank = NEWS.findIndex(([re]) => re.test(a.title || '')); if (rank < 0) continue;
    if (at >= today && !NEWS[rank][2]) continue;
    if (!best || at > best.at || (at === best.at && rank < best.rank)) best = { at, rank, label: NEWS[rank][1](a) };
  }
  return best ? { at: best.at, label: best.label } : null;
}
function readSeen() {
  let raw = null; try { raw = localStorage.getItem(SEEN_KEY); } catch { /* private mode */ }
  if (DEMO && new URLSearchParams(location.search).has('seed')) return { asOf: Date.now() - 4 * 864e5 };
  if (!raw) return null;
  try { const o = JSON.parse(raw); if (o && typeof o === 'object' && o.k) return o; } catch { /* a bare timestamp */ }
  return isNaN(Date.parse(raw)) ? null : { asOf: Date.parse(raw) };
}
function lastSeen(fresh) {
  const now = Date.now();
  if (S.mbSeen === undefined || (fresh && now - S.mbSeenAt > 30 * 60e3)) { S.mbSeen = readSeen(); S.mbSeenAt = now; }
  if (fresh) S.mbStamp = true;   // wire() writes down what this visit showed
  return S.mbSeen;
}
function stampSeen(bills) {
  if (!S.mbStamp) return; S.mbStamp = false;
  const k = Object.fromEntries(bills.map(b => { const n = newsItem(b); return [b.id, n ? `${n.at}|${n.label}` : '']; }));
  try { localStorage.setItem(SEEN_KEY, JSON.stringify({ t: new Date().toISOString(), k })); } catch { /* private mode */ }
}
// '' when nothing is new; else the words for what is.
export function newsOf(b, seen = S.mbSeen) {
  if (!seen) return '';
  const now = newsItem(b); if (!now) return '';
  if (seen.k) {
    if (!(b.id in seen.k)) return '';   // followed since the last visit: nothing to compare with
    const [at, label] = String(seen.k[b.id]).split('|');
    return now.at > (+at || 0) || (now.at === +at && now.label !== label) ? now.label : '';
  }
  return now.at > seen.asOf ? now.label : '';
}

// ---- the bill row ----
// The whole row opens the bill page; the star beside it follows or unfollows (a separate 44px button, because a
// button inside a link is not allowed and would open the bill by accident). With a nickname the row leads with it
// (bold) and says what the bill does underneath; without one it keeps the plain summary as its headline. The number
// is always there. Options: note (HIPHI's note on a list), pos (show HIPHI's position: Find, issues, lists),
// fresh (mark what is new: My bills), why (a stopped bill: say why instead of a status), hearing (a suggested
// bill's hearing), ghost (just unfollowed here: the row stays until the person leaves, so the star, and keyboard
// focus on it, stay put and following again is one press).
export function billRow(b, { note = '', pos = false, fresh = false, why = false, hearing = null, ghost = false } = {}) {
  const on = S.watch.has(b.id), num = spaced(b.bill_number), name = nick(b), sentence = what(b, name ? 120 : 170);   // one sentence under a nickname; more when it is the headline
  const p = pos ? posInfo(b) : null, mine = stanceInfo(b.id), news = fresh && !ghost ? newsOf(b) : '', nd = why ? null : nextDate(b, hearing);
  const head = name ? `<span class="mb-nick">${esc(name)}</span><span class="mb-what">${esc(sentence)}</span>` : `<span class="mb-head">${esc(sentence)}</span>`;
  return `<li class="mb-row${why ? ' why' : ''}${ghost ? ' off' : ''}">
    <a class="mb-main" href="${billPath(b)}">
      <span class="mb-bill">${head}${note ? `<span class="mb-note">${esc(note)}</span>` : ''}
        <span class="mb-id"><span class="mb-num">${esc(num)}</span>${news ? `<span class="mb-new">New: ${esc(news)}<span class="sr"> since your last visit</span></span>` : ''}</span></span>
      <span class="mb-who">${p ? `<span class="mb-pos">${icon(p.icon)}<span>${esc(p.text)}</span></span>` : ''}${mine ? `<span class="mb-stance">${icon(mine.icon)}<span>${esc(mine.text)}</span></span>` : pos || ghost || why ? '' : '<span class="mb-stance none">Not said yet</span>'}</span>
      <span class="mb-status">${ghost ? '<span class="mb-why">Unfollowed. Select the star to follow it again.</span>' : why ? `<span class="mb-why">${esc(stoppedWhy(b))}</span>` : statusChip(b, hearing)}</span>
      ${why || ghost ? '' : `<span class="mb-next">${nd ? `<b>${esc(nd.day)}</b><span>${esc(nd.sub)}</span>` : moving(b) ? '<span>No date set</span>' : ''}</span>`}
    </a>
    ${iconBtn('star', `Follow ${name ? `${name}, ${num}` : num}`, { 'data-star': b.id, 'data-label': nameOf(b), 'aria-pressed': on ? 'true' : 'false' }, 'mb-star' + (on ? ' on' : ''))}
  </li>`;
}
// An empty state with an h2 (ui.js's empty() uses h3, which would skip a level under this page's h1).
export const emptyBox = ({ art = '', title, text = '', action = '', h = 'h2' }) => `<div class="empty mb-empty">${art ? `<div class="art">${art}</div>` : ''}<${h}>${title}</${h}>${text ? `<p>${text}</p>` : ''}${action}</div>`;
// A list of bill rows. From 1100px it is a table: the header row names the columns (decorative, every cell already
// says what it is) and the last text column is the person's stance on My bills, HIPHI's position everywhere else.
// A list where no bill has a date coming up (bills that stopped or became law, and every list between sessions)
// drops the "Next date" column and gives its width to the bill. compact: keep the phone-style stack at every
// width (a narrow side column).
export function billList(bills, opt, { compact = false } = {}) {
  if (!bills.length) return '';
  const o = b => (typeof opt === 'function' ? opt(b) : opt) || {}, first = o(bills[0]);
  const dated = !first.why && bills.some(b => !o(b).ghost && nextDate(b, o(b).hearing));
  const cols = [first.why ? ['Bill', 'What happened'] : dated ? ['Bill', 'Status', 'Next date'] : ['Bill', 'Status'], first.pos ? 'HIPHI’s position' : 'Your stance'].flat();
  return `<div class="mb-list${compact ? ' mb-compact' : ''}${dated ? '' : ' mb-c3'}">
    <div class="mb-hdr" aria-hidden="true"><div class="mb-hcells">${cols.map(t => `<span>${t}</span>`).join('')}</div><span class="mb-hstar">Follow</span></div>
    <ul class="mb-rows">${bills.map(b => billRow(b, o(b))).join('')}</ul></div>`;
}

// A fold that keeps its open state across re-renders (a star press re-renders the page; the fold must not snap shut).
S.mbOpen ??= {};
export function fold(id, summary, inner, { ic = 'archive', open = false } = {}) {
  const isOpen = S.mbOpen[id] ?? open;
  return `<details class="mb-fold" data-fold="${esc(id)}"${isOpen ? ' open' : ''}><summary><span class="mb-flead">${icon(ic)}</span><span class="mb-ftitle">${summary}</span>${icon('chevron-down', { cls: 'mb-chev' })}</summary>${inner}</details>`;
}

// ---- HIPHI's lists, as rows on a phone and as cards side by side on a wide screen ----
// Between sessions every bill on a list has finished, so following one adds nothing today. The row says what will
// happen instead of celebrating "Following 0 bills" (assessment, 9/19).
export const nextYear = (si = sessionInfo()) => si.nextOpen ? +String(si.nextOpen).slice(0, 4) : si.yr + 1;
const movingOn = l => { const rows = S.listBills[l.slug]; return rows ? rows.filter(r => moving(r.b)).length : null; };   // null: not loaded yet
// { lead: "You follow Keiki health.", rest: "When HIPHI adds its 2027 bills, they will appear in My bills." } or null.
export function listPromise(l, { where = 'in My bills' } = {}) {
  const si = sessionInfo(), lead = `You follow ${l.title}.`;
  if (si.phase !== 'in') return { lead, rest: `When HIPHI adds its ${nextYear(si)} bills, they will appear ${where}.` };
  if (movingOn(l) === 0) return { lead, rest: `Nothing on it is moving right now. When HIPHI adds bills to it, they will appear ${where}.` };
  return null;
}
export function listCards(lists, { where = 'in My bills', mine = false } = {}) {
  const card = l => {
    const on = S.listFollows.has(l.id), fans = countOk(l.followers), n = Number(l.bills) || 0;   // followers are people: only from 10
    const meta = [n ? `${n} bill${n === 1 ? '' : 's'}` : '', fans ? `${fans} people follow it` : ''].filter(Boolean).join(' · ');
    const pr = on && listPromise(l, { where });
    // On My bills every list shown is followed, so only a list that has gone quiet in session needs a word.
    const say = mine ? (pr && sessionInfo().phase === 'in' ? 'Nothing on it is moving right now' : '') : on ? `You follow this list${pr ? `. ${pr.rest}` : ''}` : '';
    const state = say ? `<span class="mb-on${mine ? ' quiet' : ''}">${mine ? '' : icon('check')}<span>${esc(say)}</span></span>` : '';
    return row({ leadHtml: `<span class="lead">${icon(issueIcon(l.icon, 'list'))}</span>`, title: esc(l.title),
      sub: `${l.description ? `<span class="mb-clamp">${esc(l.description)}</span>` : ''}${meta ? `<span class="mb-tmeta">${esc(meta)}</span>` : ''}${state}`, href: `#/list/${encodeURIComponent(l.slug)}` });
  };
  return `<div class="rows mb-tiles ${lists.length > 2 ? 'grid3' : 'grid2'}">${lists.map(card).join('')}</div>`;
}

// Stars and folds. Called by this screen and by Find (on a full render and after Find paints results in place).
export function wireRows(root = document) {
  root.querySelectorAll('[data-star]').forEach(el => el.onclick = async () => {
    const id = el.dataset.star, was = S.watch.has(id);
    el.setAttribute('aria-busy', 'true');
    // Unfollowing on My bills: the row stays (dimmed) until the person leaves the screen, with its hearings kept
    // so it does not jump to another place in the order. The star they pressed is still there to press again.
    if (was && document.body.dataset.screen === 'bills') { const b = findBill(id) || (DEMO ? D.index.find(x => x.id === id) : null); if (b) { (S.mbGhost ??= new Map()).set(id, b); S.xh[id] = S.hearings.filter(h => h.bill_id === id); } }
    // A safety net for focus (the page frame restores it by data-star; this covers a row that did go away).
    S.mbFocus = { id, idx: [...document.querySelectorAll('main [data-star]')].indexOf(el) };
    await followToggle(id, el.dataset.label);
    // Once followed, the bill's hearings come with the followed bills; drop the copy kept for unfollowed bills.
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
    if (alive(b) && st.hearingState === 'scheduled' && st.hearing) return [0, new Date(st.hearing.scheduled_at).getTime()];
    if (alive(b) && st.phase === 'committee' && st.deadline && !st.deadline.missed) return [1, new Date(st.deadline.date + 'T23:59:59-10:00').getTime()];
    return [2, PHASE_RANK[st.phase] ?? 0];
  };
  return bills.map(b => ({ b, k: key(b) })).sort((x, y) => x.k[0] - y.k[0] || x.k[1] - y.k[1] || numCmp(x.b, y.b)).map(x => x.b);
}
// HB before SB, then by number (HB 9 before HB 10).
export const numCmp = (a, b) => { const pa = /^(\D+)(\d+)/.exec(a.bill_number) || [], pb = /^(\D+)(\d+)/.exec(b.bill_number) || [];
  return String(pa[1]).localeCompare(String(pb[1])) || (+pa[2] || 0) - (+pb[2] || 0); };

// In session, whether a followed list still has anything moving is only known once its bills are loaded.
function loadFollowedLists(lists) {
  const need = lists.filter(l => S.listBills[l.slug] === undefined && !(S.mbListTried ??= new Set()).has(l.slug));
  if (!need.length) return;
  need.forEach(l => S.mbListTried.add(l.slug));
  Promise.all(need.map(l => listBillsFor(l.slug).catch(() => null))).then(() => { if (document.body.dataset.screen === 'bills') app.render(); });
}
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const andList = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;

function render() {
  // Coming to this screen afresh (not a redraw after a star press): bills unfollowed last time are gone for good.
  const fresh = !document.querySelector('.mb[data-mbroot]');
  if (fresh) S.mbGhost = new Map();
  lastSeen(fresh);
  const ghosts = [...(S.mbGhost || new Map()).values()].filter(b => !S.watch.has(b.id)), ghostIds = new Set(ghosts.map(b => b.id));
  const followed = mine(), all = [...followed, ...ghosts];
  const live = byUrgency(all.filter(b => !stopped(b))), gone = all.filter(stopped).sort(numCmp);
  const lists = (S.lists || []).filter(l => S.listFollows.has(l.id));
  const si = sessionInfo(), off = si.phase !== 'in';
  if (lists.length && !off) loadFollowedLists(lists);
  const head = `<div class="mb-top"><h1 class="hero">My bills</h1>${followed.length ? `<span class="mb-count">${plural(followed.length, 'bill')}</span>` : ''}</div>`;
  // Lists followed with nothing on them yet (between sessions, or a list that has gone quiet): say what will happen.
  const waiting = lists.filter(l => off || movingOn(l) === 0);
  const listLine = waiting.length ? `You follow ${esc(andList(waiting.map(l => l.title)))}. When HIPHI adds ${waiting.length === 1 ? 'its' : 'their'}${off ? ` ${nextYear(si)}` : ''} bills, they will appear here.` : '';
  let body;
  if (!all.length) {
    body = lists.length && listLine
      ? emptyBox({ art: VOICES, title: off ? `You’re set for the ${nextYear(si)} session` : 'No bills here yet', text: listLine,
          action: `<div class="btncol mb-emptybtns">${btn(off ? 'Browse bills by issue' : 'Find bills', { kind: 'primary', icon: 'search', href: '#/find' })}</div>` })
      : emptyBox({ art: VOICES, title: 'You’re not following any bills yet.',
          text: 'Follow a bill and it shows up here, with the next hearing and what you can do about it.',
          action: `<div class="btncol mb-emptybtns">${btn('Find bills', { kind: 'primary', icon: 'search', href: '#/find' })}${off ? '' : btn('Take the 1-minute start', { kind: 'text', href: '#/start/1' })}</div>` });
  } else if (!live.length) {
    // Only stopped bills: say so kindly, keep their record, and point to what is still moving.
    body = emptyBox({ title: off ? `The ${si.recapYear} session is over` : 'All your bills have finished for this session.',
      text: off ? `All your bills have finished, and their record stays here. The next session opens ${esc(nextOpenWords(si))}.` : 'Their record stays here.',
      action: btn(off ? 'Browse bills by issue' : 'Find bills still moving', { kind: 'primary', icon: 'search', href: '#/find' }) });
  } else {
    body = billList(live, b => ({ fresh: true, ghost: ghostIds.has(b.id) }));
  }
  // (the empty state above has already said it when there are no bills at all)
  const listSec = lists.length ? `<section aria-labelledby="mb-lists-h"><div class="sechead"><h2 id="mb-lists-h">Lists you follow</h2></div>
    ${!all.length && listLine ? '' : `<p class="small muted mb-sub">${off ? `When HIPHI adds its ${nextYear(si)} bills to one of these lists, they show up here.` : 'When HIPHI adds a bill to one of these lists, it shows up here.'}</p>`}
    ${listCards(lists, { where: 'here', mine: true })}</section>` : '';
  // A followed bill that stopped since the last visit is news worth a mark on the closed fold too.
  const goneNew = gone.filter(b => !ghostIds.has(b.id) && newsOf(b)).length;
  const goneSec = gone.length ? fold('mb-stopped', `Stopped this session (${gone.length})${goneNew ? `<span class="mb-new">${goneNew} new<span class="sr"> since your last visit</span></span>` : ''}`,
    billList(gone, b => ({ why: true, fresh: true, ghost: ghostIds.has(b.id) })), { open: !live.length }) : '';
  return `<div class="mb" data-mbroot>${head}${body}${listSec}${goneSec}</div>`;
}
const nextOpenWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';

export default {
  tab: 'bills',
  title: () => 'My bills',
  render,
  wire() { stampSeen(mine()); const root = document.querySelector('.mb'); if (root) wireRows(root); },
};
