// My issues (tab; R-018, Nate 9/21: people follow issues, not bills, and the tab is named for them). A person comes
// here to see how the issues they follow are doing. Grouped by category, one row per followed issue saying what is
// happening on it (a hearing soon, how many bills are moving, what is new since the last visit) - not its bills: "the
// user is not interested in bills, but instead about policies", and the bills are one press away on the issue's page.
// Following a whole category of 17 issues used to draw every bill of every one of them (5,500px on a phone). Then
// bills followed on their own, as bill rows, then HIPHI's lists. The bill row and the issue row built here are shared
// with Find (search, issue and category pages, HIPHI's lists, the suggestion rows), so a bill and an issue each look
// and follow the same way everywhere. On a phone a bill row is a small stack; from 1100px the same markup lines up as
// a table with a header row (bill, status, next date, stance, follow).
import { S, D, DEMO, esc, icon, nick, blurb, spaced, billPath, alive, stopOf, plainStatus, dueInfo, dayWord, timeWord, dateLong, hstDay,
  sessionInfo, issueIcon, findBill, posInfo, myStance, countOk, listBillsFor, app, toast, issueBills, issueFollowed, followedIssues, viaIssue,
  issuePos, setFollows, unfollowIssue, catOf, issuesIn, followSummary } from './core.js';
import { btn, iconBtn, row, posChip, chip } from './ui.js';
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
      <span class="mb-who">${p ? `<span class="mb-pos">${icon(p.icon)}<span>${esc(p.text)}</span></span>` : ''}${mine ? `<span class="mb-stance">${icon(mine.icon)}<span>${esc(mine.text)}</span></span>` : pos || ghost ? '' : '<span class="mb-stance none">Not said yet</span>'}</span>
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
// { lead: "You follow Keiki health.", rest: "When HIPHI adds its 2027 bills, they will appear in My issues." } or null.
export function listPromise(l, { where = 'in My issues' } = {}) {
  const si = sessionInfo(), lead = `You follow ${l.title}.`;
  if (si.phase !== 'in') return { lead, rest: `When HIPHI adds its ${nextYear(si)} bills, they will appear ${where}.` };
  if (movingOn(l) === 0) return { lead, rest: `Nothing on it is moving right now. When HIPHI adds bills to it, they will appear ${where}.` };
  return null;
}
export function listCards(lists, { where = 'in My issues', mine = false } = {}) {
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

// ---- the issue row (063, R-018): an issue looks the same wherever it is listed (My issues, a category's page, search) ----
// The row opens the issue's page; the button beside it follows it or lets it go (a button cannot sit inside a link).
// It says what is happening on the issue rather than listing its bills. `news`: what is new since the last visit
// (My issues). `key`: the attribute the button carries, which decides what pressing it does on that screen.
export const billsOfIssue = i => issueBills(i).map(id => findBill(id) || (DEMO ? D.bills.find(b => b.id === id) : null)).filter(Boolean);
export function issueItem(i, { news = '', key = 'data-fdissue' } = {}) {
  const on = issueFollowed(i), off = sessionInfo().phase !== 'in', bills = billsOfIssue(i), live = bills.filter(moving), law = bills.filter(becameLaw).length;
  const pos = issuePos(off ? bills : live.length ? live : bills), soon = !off && live.map(b => stopOf(b)).find(st => st.hearingState === 'scheduled' && st.hearing);
  const meta = off ? [plural(bills.length || issueBills(i).length, 'bill') + ` in ${sessionInfo().recapYear}`, law ? `${law} became law` : ''].filter(Boolean).join(' · ')
    : live.length ? `${plural(live.length, 'bill')} moving` : 'Nothing moving right now';
  return `<li class="fd-irow${on ? ' on' : ''}">
    <a class="fd-imain" href="#/issue/${esc(i.slug)}"><span class="fd-iname">${esc(i.name)}</span>
      ${i.description ? `<span class="fd-idesc mb-clamp">${esc(i.description)}</span>` : ''}
      <span class="fd-imeta">${news ? `<span class="mb-new">New: ${esc(news)}<span class="sr"> since your last visit</span></span>` : ''}${soon ? chip(`Hearing ${dayWord(soon.hearing.scheduled_at)}`, 'info', 'calendar') : ''}<span>${esc(meta)}</span>${pos ? posChip({ hiphi_position: pos }) : ''}</span></a>
    ${btn(on ? 'Following' : 'Follow', { kind: 'secondary', sm: true, icon: 'star', cls: 'fd-ifollow' + (on ? ' on' : ''), attrs: { [key]: i.id, 'aria-pressed': String(on), 'aria-label': `${on ? 'Following' : 'Follow'} ${i.name}` } })}
  </li>`;
}
export const issueList = (list, opt = {}) => list.length ? `<ul class="fd-ilist" role="list">${list.map(i => issueItem(i, typeof opt === 'function' ? opt(i) : opt)).join('')}</ul>` : '';
// Issues with something happening first: a hearing soon, then bills moving, then HIPHI's strongest, then by name.
export function issueOrder(list) {
  const off = sessionInfo().phase !== 'in', score = i => { const bills = billsOfIssue(i), live = bills.filter(moving);
    return off ? [bills.some(b => b.hiphi_position === 'strongly_support') ? 0 : 1, 0]
      : [live.some(b => stopOf(b).hearingState === 'scheduled') ? 0 : live.length ? 1 : 2, i.recommended || live.some(b => b.hiphi_position === 'strongly_support') ? 0 : 1]; };
  return list.map(i => ({ i, k: score(i) })).sort((x, y) => x.k[0] - y.k[0] || x.k[1] - y.k[1] || x.i.name.localeCompare(y.i.name)).map(x => x.i);
}
// What is new on an issue since the last visit: the news on the most urgent of its followed bills that has any.
const issueNews = i => { for (const b of byUrgency(billsOfIssue(i).filter(b => S.watch.has(b.id)))) { const n = newsOf(b); if (n) return n; } return ''; };
function render() {
  // Coming to this screen afresh (not a redraw after a star press): bills unfollowed last time are gone for good.
  const fresh = !document.querySelector('.mb[data-mbroot]');
  if (fresh) S.mbGhost = new Map();
  lastSeen(fresh);
  const ghosts = [...(S.mbGhost || new Map()).values()].filter(b => !S.watch.has(b.id)), ghostIds = new Set(ghosts.map(b => b.id));
  const si = sessionInfo(), off = si.phase !== 'in';
  const lists = (S.lists || []).filter(l => S.listFollows.has(l.id));
  if (lists.length && !off) loadFollowedLists(lists);
  // Issues, by category, each once: under its own category, or under the followed category that brought it (the DUI
  // limit lives in Tobacco, Vaping & Alcohol but also comes with all of Getting Around Safely). In each, the issues
  // with bills moving (between sessions: with bills last session) come first; the rest fold away, as on a category's
  // page, unless there is nothing else to show.
  const iss = followedIssues(), homeOf = i => S.catFollows.has(i.category) ? i.category : (i.categories || []).find(k => S.catFollows.has(k)) || i.category;
  const cats = S.cats.filter(c => S.catFollows.has(c.key) || iss.some(i => homeOf(i) === c.key));
  const busy = i => off ? issueBills(i).length > 0 : billsOfIssue(i).some(moving), opt = i => ({ news: issueNews(i), key: 'data-unfollowissue' });
  const catSec = c => {
    const whole = S.catFollows.has(c.key), mineHere = issueOrder(iss.filter(i => homeOf(i) === c.key));
    const act = mineHere.filter(busy), quiet = mineHere.filter(i => !busy(i));
    return `<section class="mb-cat" aria-labelledby="mb-c-${esc(c.key)}">
      <div class="mb-cathead"><span class="mb-catic">${icon(c.icon)}</span><h2 id="mb-c-${esc(c.key)}">${esc(c.name)}</h2>
        ${whole ? `<span class="mb-catall">${icon('check')}<span>Following all, and new ones</span></span>${btn('Stop following all', { kind: 'text', sm: true, attrs: { 'data-unfollowcat': c.key } })}` : ''}</div>
      ${act.length ? issueList(act, opt) : quiet.length ? issueList(quiet, opt) : `<p class="mb-quiet">Nothing in it yet. New issues come to you as HIPHI takes them up.</p>`}
      ${act.length && quiet.length ? fold('mb-cq-' + c.key, `Nothing moving ${off ? `in ${si.recapYear}` : 'right now'} (${quiet.length})`, issueList(quiet, opt), { ic: 'hourglass' }) : ''}
    </section>`;
  };
  // Bills followed on their own: not carried by an issue they follow.
  const own = [...mine(), ...ghosts].filter(b => !viaIssue(b) && (S.direct.has(b.id) || ghostIds.has(b.id)));
  const ownLive = byUrgency(own.filter(b => !stopped(b))), ownGone = own.filter(stopped).sort(numCmp);
  const n = iss.length, head = `<div class="mb-top"><h1 class="hero">My issues</h1>${n ? `<span class="mb-count">${plural(n, 'issue')}</span>` : ''}</div>`;
  const waiting = lists.filter(l => off || movingOn(l) === 0);
  const listLine = waiting.length ? `You follow ${esc(andList(waiting.map(l => l.title)))}. When HIPHI adds ${waiting.length === 1 ? 'its' : 'their'}${off ? ` ${nextYear(si)}` : ''} bills, they will appear here.` : '';
  const anything = cats.length || own.length;
  const body = anything ? `${off ? `<p class="mb-note">The ${esc(String(si.recapYear))} session is over. The next one opens ${esc(nextOpenWords(si))}, and the bills on your issues come here as HIPHI takes them up.</p>` : ''}
      ${cats.map(catSec).join('')}` : lists.length && listLine
    ? emptyBox({ art: VOICES, title: off ? `You’re set for the ${nextYear(si)} session` : 'No issues here yet', text: listLine,
        action: `<div class="btncol mb-emptybtns">${btn('Browse issues', { kind: 'primary', icon: 'search', href: '#/find' })}</div>` })
    : emptyBox({ art: VOICES, title: 'You’re not following any issues yet.',
        text: 'Follow an issue and its bills show up here, with the next hearing and what you can do about it.',
        action: `<div class="btncol mb-emptybtns">${btn('Pick what you care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}${btn('Browse issues', { kind: 'text', href: '#/find' })}</div>` });
  const ownSec = own.length ? `<section class="mb-own" aria-labelledby="mb-own-h"><div class="sechead"><h2 id="mb-own-h">${cats.length ? 'Other bills you follow' : 'Bills you follow'}</h2></div>
      ${ownLive.length ? billList(ownLive, b => ({ fresh: true, ghost: ghostIds.has(b.id) })) : ''}
      ${ownGone.length ? fold('mb-stopped', `Stopped this session (${ownGone.length})`, billList(ownGone, b => ({ why: true, fresh: true, ghost: ghostIds.has(b.id) })), { open: !ownLive.length }) : ''}</section>` : '';
  const listSec = lists.length ? `<section aria-labelledby="mb-lists-h"><div class="sechead"><h2 id="mb-lists-h">Lists you follow</h2></div>
    ${!anything && listLine ? '' : `<p class="small muted mb-sub">${off ? `When HIPHI adds its ${nextYear(si)} bills to one of these lists, they show up here.` : 'When HIPHI adds a bill to one of these lists, it shows up here.'}</p>`}
    ${listCards(lists, { where: 'here', mine: true })}</section>` : '';
  const onward = anything ? `<p class="mb-onward">${btn('Browse more issues', { kind: 'secondary', icon: 'search', href: '#/find' })}</p>` : '';
  return `<div class="mb" data-mbroot>${head}${body}${ownSec}${listSec}${onward}</div>`;
}
// Letting go of an issue or a whole category, with Undo (B-5): Undo puts back exactly what was followed before.
async function letGo(change, said) {
  const before = { i: new Set(S.issueFollows), c: new Set(S.catFollows) };
  if (!(await change())) return;
  app.render();
  toast(said, { undo: async () => {
    await setFollows({ issuesOn: [...before.i], catsOn: [...before.c],
      issuesOff: [...S.issueFollows].filter(x => !before.i.has(x)), catsOff: [...S.catFollows].filter(x => !before.c.has(x)) });
    app.render(); } });
}
const nextOpenWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';

export default {
  tab: 'bills',
  title: () => 'My issues',
  render,
  wire() {
    stampSeen(mine()); const root = document.querySelector('.mb'); if (!root) return;
    wireRows(root);
    root.querySelectorAll('[data-unfollowissue]').forEach(el => el.onclick = () => {
      const i = S.issueById.get(el.dataset.unfollowissue); if (!i) return;
      const whole = (i.categories || [i.category]).filter(c => S.catFollows.has(c)).map(c => catOf(c)?.name).filter(Boolean);
      letGo(() => unfollowIssue(i), whole.length ? `You no longer follow ${i.name}. You still follow the rest of ${whole.join(' and ')}, but not new issues in it.` : `You no longer follow ${i.name}.`);
    });
    root.querySelectorAll('[data-unfollowcat]').forEach(el => el.onclick = () => {
      const c = catOf(el.dataset.unfollowcat); if (!c) return;
      letGo(() => setFollows({ catsOff: [c.key] }), `You no longer follow all of ${c.name}.`);
    });
  },
};
