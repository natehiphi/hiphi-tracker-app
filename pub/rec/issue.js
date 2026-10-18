// The calm redesign's issue page and category page (R-303, Nate 10/17), behind ?rec=1: pub/app.js sends the 'issue' and
// 'category' routes here only then, and find.js draws today's pages without it.
//
// The issue page is R-302's option A (docs/requests/R-303-assessment/issue-category.md, section 5): the page belongs to the
// issue (its address, name, followers and alerts never change) and changes shape with how many of its bills are moving.
//   1. One bill moving: the bill page's own layout-3 action card (bill.js billParts), "Where HB 1563 is now", one quiet row
//      to the bill's full record, and the bills that did not advance, closed.
//   2. Two or more: one action card, the soonest ask (picked as Home picks it), then "Bills on this issue" as quiet rows.
//   3. None: a "What happened" card (what happened, when the ideas can come back, Follow as the one filled button), or the
//      "It became law" card, then the bills that did not advance.
// The frame is the bill page's: Back naming the place behind, Share and ⋯ in the top row; the name, one sentence, HIPHI's
// stance and one outlined Follow pill under it ("✓ Following" opens the alerts line and Stop following). The issue's name is
// said once; a bill is named by its number, and by its own name only where several different bills move (A-14). On a laptop
// the bill page's two columns, with the card in a side panel that stays in view.
//
// The category page: Back to Find, the name and one sentence, the issues as quiet rows with one status line in Home's words
// and a Follow each, and "Follow all of it, and new ones" at the end. No counts (R-300). An old coalition address
// (#/find/issue/ctfh) opens its category.
import { S, D, DEMO, app, esc, icon, toast, nick, spaced, billPath, issueFollowed, issuePos, posInfo, setFollows, unfollowIssue, sessionInfo, findBill, supa,
  catOf, calendarUrl, dateLong, stopOf, plainStatus, hearingsOf, openActions, hearingWhen, hiT, fmtDate, issueShareUrl, stopFacts, issuesIn, HST } from '../core.js';
import { btn, iconBtn, posChip, skeleton, inlineErr } from '../ui.js';
import { recHead, recBack, recSec, recRows, recFold, recFolds, recEmpty, recFollow, wireKit, BOX } from './kit.js';
import { moving, becameLaw, stopped, numCmp, byUrgency, stoppedWhy, what, billsOfIssue, issueOrder } from '../mybills.js';
import { ensureHearings } from '../find.js';
import { followAsk, profileSaved, levelLine, levelBox, wireLevelLine, getsAlerts } from '../alerts.js';
import { shareIssue } from '../actions.js';
import { billParts, wireBillParts, recDock, situation, recLine } from '../bill.js';
import { logAct } from '../visitlog.js';

const WIDE = window.matchMedia('(min-width: 1100px)');
const wide = () => WIDE.matches;
const onIssue = () => document.body.dataset.screen === 'issue';
WIDE.addEventListener?.('change', () => { if (onIssue()) app.render(); });   // the two columns or the phone column, drawn for the one in use
const offSeason = () => sessionInfo().phase !== 'in';
const yearNow = () => { const si = sessionInfo(); return si.phase === 'in' ? si.yr : si.recapYear; };
const originOf = b => b.chamber || (/^S/.test(b.bill_number) ? 'S' : 'H');
const num = b => spaced(b.bill_number);
const plainName = t => String(t || '').normalize('NFD').replace(/[̀-ͯʻ‘’']/g, '').toLowerCase().trim();
// "HB 1085, SB 1404 and SB 1528"; past four, "HB 1085, SB 1404, SB 1528 and 7 more", so a fold's preview stays one line.
const numbers = bills => { const ns = bills.map(b => num(b) + (+b.session_year && +b.session_year !== yearNow() ? ` (${b.session_year})` : ''));
  const shown = ns.length > 4 ? [...ns.slice(0, 3), `${ns.length - 3} more`] : ns;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] || ''; };

// ---------------- the issue's bills ----------------
// Loaded once per visit (most are already on the page; the rest come in one request), with their hearings, so each bill's
// situation is the bill page's own. Kept in S.extra too, so the card's buttons (the walkthroughs, the share sheet) find them.
const L = S.rcIss ??= {};
function loadBills(i) {
  L[i.id] = 'loading';
  const ids = (i.bill_ids || []).filter(id => !findBill(id));
  (async () => {
    if (ids.length && !DEMO) { const { data, error } = await (await supa()).from('public_all_bills').select('*').in('id', ids); if (error) throw error; (data || []).forEach(b => { S.extra[b.id] = b; }); }
    const rows = (i.bill_ids || []).map(id => findBill(id) || (DEMO ? D.bills.find(b => b.id === id) : null)).filter(Boolean);
    rows.forEach(b => { if (!S.bills.some(x => x.id === b.id)) S.extra[b.id] ??= b; });
    await ensureHearings(rows); L[i.id] = rows;
  })().catch(e => { console.error(e); L[i.id] = 'err'; }).finally(() => { if (onIssue()) app.render(); });
}

// The soonest ask among the moving bills, picked as Home picks the thing it shows (calm/home.js deckOf): testimony due and
// the chair asks by when each runs out (an ask at its cut-off day, a tie to testimony), then late testimony and a hearing
// already acted on, then the floor, the final version and the Governor, then the rest. Home and the issue page lead with
// the same ask.
function pickLead(mv) {
  const rank = ({ x }) => x.act ? (x.act.late || x.kind === 'share' ? [1, Date.parse(x.act.h.scheduled_at)] : [0, Date.parse(x.act.h.testimony_deadline || x.act.h.scheduled_at) - 1])
    : ['ask', 'hold', 'remind', 'capitol'].includes(x.kind) && x.st.deadline ? [0, hiT(x.st.deadline.date)]
    : ['floor', 'conference', 'governor'].includes(x.kind) ? [2, 0] : ['ask', 'hold', 'remind', 'capitol'].includes(x.kind) ? [2, 1] : [3, 0];
  return mv.map(b => { const o = { b, x: situation(b) }; o.k = rank(o); return o; })
    .sort((p, q) => p.k[0] - q.k[0] || p.k[1] - q.k[1] || numCmp(p.b, q.b))[0] || null;
}
// HIPHI's side on the issue, from its moving bills (option A: the dead ones once made the header say "strongly supports"
// above a moving bill HIPHI only supports). Bills on both sides, or an issue staff marked mixed: "HIPHI's side depends on
// the bill". Bills on one side at different strengths: the plain word that is true of all of them.
function stanceChip(bills, i) {
  const ps = [...new Set(bills.map(b => b.hiphi_position).filter(p => p && p !== 'monitor'))];
  if (!ps.length) return '';
  const dirs = new Set(ps.map(p => /support/.test(p) ? 'support' : /oppose/.test(p) ? 'oppose' : 'neutral'));
  const p = i?.stance === 'mixed' || dirs.size > 1 ? 'mixed' : ps.length === 1 ? ps[0] : [...dirs][0];
  return posChip({ hiphi_position: p });
}
// House and Senate versions of one bill (the same name, one from each chamber): rows that read alike apart from the number
// say so, and that either one can become law.
const versionsOf = mv => mv.length === 2 && originOf(mv[0]) !== originOf(mv[1]) && (plainName(nick(mv[0])) && plainName(nick(mv[0])) === plainName(nick(mv[1])));
const versionName = b => originOf(b) === 'S' ? 'Senate version' : 'House version';

// Everything the page and its docked bar draw from, worked out once per draw.
function model(i) {
  const data = L[i.id]; if (data === undefined) loadBills(i);
  if (!Array.isArray(data)) return { i, state: data === 'err' ? 'err' : 'loading' };
  const yr = yearNow(), now = data.filter(b => !b.session_year || +b.session_year === yr), earlier = data.filter(b => b.session_year && +b.session_year !== yr);
  const mv = offSeason() ? [] : byUrgency(now.filter(moving)), law = now.filter(becameLaw).sort(numCmp), gone = now.filter(stopped).sort(numCmp);
  const shape = mv.length > 1 ? 2 : mv.length === 1 ? 1 : 3, lead = mv.length ? pickLead(mv) : null;
  const versions = shape === 2 && versionsOf(mv);
  // Names differ: some moving bill's own name is not the others' (or the issue's, with one bill), so names are said.
  const named = shape === 2 && !versions && new Set(mv.map(b => plainName(nick(b) || b.id))).size > 1;
  return { i, state: 'ready', now, earlier, mv, law, gone, shape, lead, versions, named };
}

// ---------------- the frame ----------------
// Back names the place behind (R-238 A4-5, B-4): the page this one was opened from, or the issue's category when the issue
// was the first page opened (a shared link). The frame's data-back makes it real Back when that is where it goes.
function backLink(i) {
  const st = history.state || {}, c = catOf(i.category), root = !st.prev && !st.arrived;
  const href = root ? (c ? `#/find/category/${c.key}` : '#/find') : st.prev, name = root ? (c ? c.name : 'Find') : app.placeName(st.prev) || 'Back';
  return `<a class="btn text bl-back" href="${esc(href)}" data-back aria-label="Back to ${esc(name)}">${icon('arrow-left')}<span>${esc(name)}</span></a>`;
}
// The bill page's top row: Back, then Share (the issue's own share page, R-113) and ⋯ with the rest: the calendar feed (the
// live page only: the practice copy has none), any other category it is part of, and the link itself.
function topRow(i) {
  const also = (i.categories || []).filter(k => k !== i.category).map(catOf).filter(Boolean);
  const items = [DEMO ? '' : `<a class="bl-mi" href="${esc(calendarUrl(i))}" data-calissue="${esc(i.id)}" data-rc-close>${icon('calendar-plus')}<span>Add hearings to my calendar</span></a>`,
    ...also.map(c => `<a class="bl-mi" href="#/find/category/${esc(c.key)}" data-rc-close>${icon('folder-open')}<span>Also part of ${esc(c.name)}</span></a>`),
    `<button type="button" class="bl-mi" data-rc-copy="${esc(i.id)}">${icon('link')}<span>Copy link</span></button>`].filter(Boolean).join('');
  return `<div class="bl-top bl-rtop${wide() ? ' bl-topw' : ''}">${backLink(i)}
    <div class="bl-tools"><button type="button" class="bl-sharebtn" data-rc-ishare="${esc(i.id)}">${icon('share-2')}<span>Share</span></button>
      <div class="bl-menuwrap">${iconBtn('ellipsis', 'More options', { 'data-rc-imenu': '1', 'aria-expanded': 'false', 'aria-controls': 'rc-imenu' })}
        <div class="bl-menu" id="rc-imenu" hidden>${items}</div></div></div></div>`;
}
// Follow: one outlined pill. Once followed it reads "✓ Following" and opens a small menu (A-20): how much this issue sends,
// for someone alerts reach (R-299's line and switch), and Stop following (Undo in its toast, B-5). The menu stays open
// through a redraw (S.rcFmenu), so changing the level keeps it in place.
function followPill(i) {
  if (!issueFollowed(i)) return `<button type="button" class="rc-fpill" data-fdissue="${esc(i.id)}" aria-pressed="false" aria-label="Follow this issue: ${esc(i.name)}">${icon('star')}<span>Follow</span></button>`;
  const open = S.rcFmenu === i.id, via = S.issueFollows.has(i.id) ? null : (i.categories || [i.category]).map(catOf).find(c => c && S.catFollows.has(c.key));
  const lvl = getsAlerts() ? `<div class="rc-flvl">${levelLine(i, { via: 'issue', key: 'fd:' + i.id, id: 'fd-lvl' })}${levelBox(i, { via: 'issue', key: 'fd:' + i.id, id: 'fd-lvl' })}</div>` : '';
  return `<div class="rc-fwrap"><button type="button" class="rc-fpill on" data-rc-fmenu="${esc(i.id)}" aria-expanded="${open}" aria-controls="rc-fmenu" aria-label="Following ${esc(i.name)}: alerts and stop following">${icon('check')}<span>Following</span>${icon('chevron-down', { cls: 'rc-fchev' })}</button>
    <div class="bl-menu rc-fmenu" id="rc-fmenu"${open ? '' : ' hidden'}>${via ? `<p class="rc-fnote">You follow it with all of ${esc(via.name)}.</p>` : ''}${lvl}
      <button type="button" class="bl-mi" data-fdunissue="${esc(i.id)}">${icon('x')}<span>Stop following</span></button></div></div>`;
}
// The name block: the issue's name (the one h1), its one sentence, then a row with HIPHI's side and Follow, laid out as the
// bill page's chip row with "Read the bill". pill: false in the none shape, where Follow is the card's button.
const nameBlock = (i, chip, pill = true) => `<div class="bl-head bl-rhead rc-ihead"><h1 class="hero bl-nick">${esc(i.name)}</h1>
  ${i.description ? `<p class="lede bl-lede">${esc(i.description)}</p>` : ''}${chip || pill ? `<div class="bl-rhrow">${chip}${pill ? followPill(i) : ''}</div>` : ''}</div>`;
// The card's first line (option A: "as on Home"): the bill's number, which opens its full record, and its own name where
// several different bills move, or "House version" where the two moving bills are one bill's two versions.
const leadLine = (b, m) => `<p class="rc-alead"><a href="${esc(billPath(b))}">${esc(num(b))}</a>${m.versions ? ` · ${versionName(b)}` : m.named && nick(b) ? ` · ${esc(nick(b))}` : ''}</p>`;

// ---------------- the three shapes ----------------
// Shape 3: nothing moving. What happened, in one sentence from the stopped bills, and when the ideas can come back (B-3).
function goneWords(gone) {
  const n = gone.length, one = n === 1, off = offSeason(), yr = yearNow();
  if (!n) return `No bills on it ${off ? `in ${yr}` : 'this year'} yet. When HIPHI takes one up, it comes to everyone who follows this issue.`;
  const kinds = new Set(gone.map(b => { try { return stopFacts(b).kind; } catch { return ''; } }));
  const only = k => kinds.size === 1 && kinds.has(k);
  const why = only('noHearing') ? (one ? 'It did not get a hearing in time' : 'None got a hearing in time')
    : only('held') ? (one ? 'A committee put it on hold' : 'Committees put them on hold')
    : only('vetoed') ? (one ? 'The Governor vetoed it' : 'The Governor vetoed them')
    : one ? 'It did not make it through in time' : 'None made it through in time';
  return `${one ? 'One bill' : `${n} bills`} tried ${off ? `in ${yr}` : 'this year'}. ${why}${off ? '' : `, so ${one ? 'it' : 'they'} can’t pass this year`}.`;
}
// Hawaiʻi's two-year term (bill.js stoppedNext): after an even year every bill not passed is gone and its idea needs a new
// bill; after an odd year a bill can be taken up again.
function comeBack() {
  const si = sessionInfo(), when = si.nextOpen ? `on ${new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' })}` : 'in January';
  return yearNow() % 2 === 0 ? `Its ideas can come back as new bills when the Legislature meets ${when}.` : `Its bills can be taken up again when the Legislature meets ${when}.`;
}
function whatCard(m) {
  const { i, gone, law } = m, c = catOf(i.category), on = issueFollowed(i);
  if (law.length) {   // it became law: the bill page's own words and button (bill.js mainButton 'law': "Share the good news")
    const b = law[0], p = billParts(b), more = law.length > 1 ? `, with ${numbers(law.slice(1))}` : '';
    return { b, html: `<section class="card bl-ract rc-what" aria-labelledby="rc-what-h">${leadLine(b, m)}<h2 id="rc-what-h">It became law</h2>
      <p class="bl-rtext">${esc(num(b))}${esc(more)} became law ${offSeason() ? `in ${yearNow()}` : 'this year'}. Mahalo to everyone who spoke up.</p>${p.main}</section>` };
  }
  const outlook = offSeason() && i.outlook ? `<p class="bl-rtext">${esc(i.outlook)}</p>` : '';
  const next = on ? `<p class="rc-wdone">${icon('circle-check')}<span>You follow this issue. New bills on it come to you.</span></p>
      ${c ? `<p class="rc-wmore"><a class="rc-link" href="#/find/category/${esc(c.key)}"><span>Find bills still moving in ${esc(c.name)}</span>${icon('arrow-right')}</a></p>` : ''}`
    : `${btn('Follow this issue', { kind: 'primary', icon: 'star', full: true, attrs: { 'data-fdissue': i.id, 'aria-pressed': 'false', 'aria-label': `Follow this issue: ${i.name}` } })}<p class="bl-rmore">When a new bill on it starts, it comes to you.</p>`;
  return { b: null, html: `<section class="card bl-ract rc-what" aria-labelledby="rc-what-h"><h2 id="rc-what-h">Nothing is moving on this issue ${offSeason() ? 'now' : 'this year'}</h2>
    <p class="bl-rtext">${esc(goneWords(gone))} ${gone.length ? esc(comeBack()) : ''}</p>${outlook}${next}</section>` };
}
// The bills that did not advance, closed with their numbers as the preview (B-6, remembered open per person); the bills that
// became law beside moving ones; earlier sessions' bills. In the none shape on a laptop the first is open: it is the page.
// A bill whose name is the issue's is named by its number alone, so ten rows do not repeat the h1 (A-14).
function folds(m, { goneOpen = false } = {}) {
  const row = (b, why) => { const said = why ? stoppedWhy(b) : plainStatus(b).short, same = !nick(b) ? false : plainName(nick(b)) === plainName(m.i.name);
    return same ? { name: num(b), text: said, href: billPath(b) } : { name: nick(b) || what(b, 90), text: `${num(b)} · ${said}`, href: billPath(b) }; };
  return recFolds([
    m.gone.length ? recFold('issue-gone', 'Bills that did not advance', numbers(m.gone), recRows(m.gone.map(b => row(b, true))), { open: goneOpen }) : '',
    m.law.length && m.shape !== 3 ? recFold('issue-law', 'Bills that became law', numbers(m.law), recRows(m.law.map(b => row(b, false)))) : '',
    m.earlier.length ? recFold('issue-earlier', 'Earlier sessions', numbers(m.earlier), recRows(m.earlier.map(b => row(b, stopped(b))))) : '']);
}
// One quiet row to the bill's full record (option A, shape 1): who decides next, what it says, every draft and vote. Its own
// name only when it differs from the issue's (said once, small, here).
function recordRow(b, i) {
  const own = nick(b) && plainName(nick(b)) !== plainName(i.name) ? `${nick(b)} · w` : 'W';
  return recRows([{ name: `${num(b)}’s full record`, text: `${own}ho decides next, what it says, every draft and vote`, href: billPath(b), lead: 'scroll-text' }], 'rc-record');
}
// Shape 2's rows: each bill once, in the bill page's words; the one in the card says so (as Home's row says "On the slide
// above"), so the card's bill is not described twice.
function billRows(m) {
  const lead = m.lead?.b, here = wide() ? 'In the card at the right' : 'In the card above';
  const rows = m.mv.map(b => { const pre = m.named ? `${num(b)} · ` : '';
    return { name: m.versions ? `${versionName(b)} · ${num(b)}` : m.named ? nick(b) || what(b, 90) : num(b), text: pre + (b === lead ? here : recLine(b)), href: billPath(b) }; });
  const note = m.versions ? 'The House and the Senate each have a version. Either one can become law.' : '';
  return recSec('rc-ibills-h', 'Bills on this issue', recRows(rows), { note });
}
function issuePage(i) {
  const m = model(i), top = topRow(i);
  if (m.state !== 'ready') {
    const body = m.state === 'err' ? `<div class="rc-err">${inlineErr('rc-ierr', 'We couldn’t load its bills. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-rc-retry': i.id } })}</div>` : skeleton(2);
    return `<div class="bl-page bl-rec rc-iss${wide() ? ' bl-wide' : ''}">${top}${nameBlock(i, '')}${body}</div>`;
  }
  let head, side, rest;
  if (m.shape === 3) {
    const w = whatCard(m);
    head = nameBlock(i, stanceChip(m.now, i), issueFollowed(i) || !!w.b);
    side = w.html;
    rest = folds(m, { goneOpen: wide() });
  } else {
    const b = m.lead.b, p = billParts(b, { lead: leadLine(b, m), where: `Where ${num(b)} is now` });
    head = nameBlock(i, stanceChip(m.mv, i));
    side = `<div class="rc-iact">${p.act}</div>`;
    rest = m.shape === 1 ? `${p.where}${recordRow(b, i)}${folds(m)}` : `${billRows(m)}${folds(m)}`;
  }
  if (!wide()) return `<div class="bl-page bl-rec rc-iss" data-shape="${m.shape}">${top}${head}${side}<div class="rc-irest">${rest}</div></div>`;
  return `<div class="bl-page bl-wide bl-rec rc-iss" data-shape="${m.shape}">${top}<div class="cols bl-cols">
    <div class="bl-main">${head}</div>
    <aside class="side bl-side" aria-label="Take part">${side}</aside>
    <div class="bl-main bl-main2 rc-irest">${rest}</div></div></div>`;
}

// ---------------- the category page ----------------
// One status line per issue in Home's words (calm/home.js stateOf, without what this person did): testimony due this week,
// a hearing ahead, a cut-off for a hearing, else where its furthest bill is; "Nothing moving" when none is.
// g and t order the rows as Home orders its own (byImportance): what is due first, soonest first, then hearings, then the
// cut-offs, then the rest; issueOrder breaks a tie.
function issueStatus(i) {
  const bills = billsOfIssue(i), now = Date.now();
  if (offSeason()) { const yr = sessionInfo().recapYear; return bills.some(becameLaw) ? { g: 0, text: `Became law in ${yr}` } : { g: bills.length ? 1 : 2, text: bills.length ? `Did not advance in ${yr}` : `No bills in ${yr}` }; }
  // Home's words for the same facts (calm/home.js stateOf), so an issue reads the same here, in search and on My issues
  // (the wrap-up review, 10/18: "Nothing moving" here was "Did not advance this year" one tap away, "Mon 3/30" was "Mon, Mar 30").
  const live = bills.filter(moving); if (!live.length) return { g: 4, text: bills.length ? 'Did not advance this year' : 'No bills on it yet' };
  const hs = live.flatMap(hearingsOf), due = openActions(live, hs).filter(x => !x.late && x.h.testimony_deadline && Date.parse(x.h.testimony_deadline) - now < 7 * 864e5)[0];
  if (due) { const t = Date.parse(due.h.testimony_deadline); return { g: 0, t, text: `Testimony due ${hearingWhen(due.h.testimony_deadline)}`, warn: t - now < 864e5 }; }
  const h = hs.filter(x => x.status !== 'cancelled' && Date.parse(x.scheduled_at) > now).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) return { g: 1, t: Date.parse(h.scheduled_at), text: `Hearing ${hearingWhen(h.scheduled_at)}` };
  const w = live.map(stopOf).filter(st => st.phase === 'committee' && st.hearingState === 'none' && st.deadline && !st.deadline.missed).sort((x, y) => String(x.deadline.date).localeCompare(String(y.deadline.date)))[0];
  if (w) return { g: 2, t: hiT(w.deadline.date), text: `Needs a hearing by ${dateLong(w.deadline.date + 'T12:00:00-10:00')}`, warn: w.deadline.days < 1 };
  return { g: 3, text: plainStatus(byUrgency(live)[0]).short };
}
// A row: the issue's name and its line (the link), then Follow, outlined, or a quiet "✓ Following" that stops it (Undo).
// HIPHI's side ends the line where it is not simply "supports" (P-4; the fresh-eyes review, 10/18: three of the seventeen
// tobacco issues are ones HIPHI opposes, and the rows looked alike). Said on every row, "HIPHI supports" ran thirteen
// times and wrapped each line to three (A-14), so only the exceptions say it: opposes, has comments, depends on the bill.
// From the moving bills, as on the issue page, else all of this session's.
function issueSide(i) {
  const bills = billsOfIssue(i), live = offSeason() ? [] : bills.filter(moving), p = issuePos(live.length ? live : bills, i);
  return p && !/support/.test(p) ? posInfo({ hiphi_position: p })?.text || '' : '';
}
// The row opens the issue (no chevron: the pill is the row's end, as in search); Follow beside it, outlined, or the issue page's pale "✓ Following", which
// stops following with Undo (R-061: followed looks followed).
function catRow(i, st = issueStatus(i)) {
  const on = issueFollowed(i), side = issueSide(i), follow = recFollow(i, on);
  return `<li class="rc-irow"><a class="rc-row" href="#/issue/${esc(i.slug)}"><span class="rc-rtext"><span class="rc-rname">${esc(i.name)}</span><span class="rc-rstat">${st.warn ? `<b class="rc-warn">${esc(st.text)}</b>` : esc(st.text)}${side ? ` · ${esc(side)}` : ''}</span></span></a>${follow}</li>`;
}
function categoryPage(key) {
  const c = catOf(key);
  if (!c) return `<div class="rc rc-cat">${recHead({ title: 'We couldn’t find that', lede: 'Here is everything HIPHI works on.', back: recBack('#/find', 'Find') })}${btn('See all issues', { kind: 'secondary', href: '#/find' })}</div>`;
  const all = issueOrder(issuesIn(c.key)).map((i, n) => ({ i, n, st: issueStatus(i) }))
    .sort((x, y) => x.st.g - y.st.g || (x.st.t ?? Infinity) - (y.st.t ?? Infinity) || x.n - y.n), whole = S.catFollows.has(c.key);
  const said = whole ? `<p class="rc-catok" id="rc-catok" tabindex="-1">${icon('circle-check')}<span>You follow all of it</span><span aria-hidden="true">·</span>${btn('Stop', { kind: 'text', sm: true, attrs: { 'data-fdunfollowcat': c.key, 'aria-label': `Stop following all of ${c.name}` } })}</p>` : '';
  // The issues with nothing moving this year wait in one closed card with their names as its preview, as the issue page keeps
  // its bills that did not advance (the wrap-up review of 10/18: Tobacco was 1,972px on a phone with 18 equal pills, 9 of its
  // 17 rows saying nothing moved). Each still has its Follow inside; open, it stays open for this person (B-6).
  // The moving ones in one white box (Nate 18 Oct, card 6); the quiet ones are in their closed card, a box already.
  const rows = (xs, box = '') => `<ul class="rc-rows rc-irows${box}" role="list">${xs.map(r => catRow(r.i, r.st)).join('')}</ul>`;
  const live = all.filter(r => r.st.g < 4), quiet = all.filter(r => r.st.g === 4);
  const names = quiet.length > 3 ? `${quiet.slice(0, 2).map(r => r.i.name).join(', ')} and ${quiet.length - 2} more` : quiet.map(r => r.i.name).join(', ').replace(/, ([^,]*)$/, ' and $1');
  const list = !all.length ? recEmpty(`Nothing in ${c.name} yet. Follow it, and new issues come to you as HIPHI takes them up.`)
    : `${live.length ? rows(live, ' ' + BOX) : ''}${quiet.length ? recFolds([recFold('cat-quiet', 'Nothing moving this year', names, rows(quiet), { open: !live.length })]) : ''}`;
  return `<div class="rc rc-cat">${recHead({ title: c.name, lede: c.description || '', back: recBack('#/find', 'Find'), extra: said })}
    ${list}
    ${whole ? '' : `<div class="rc-catall">${btn('Follow all of it, and new ones', { kind: 'secondary', icon: 'star', attrs: { 'data-fdcat': c.key, 'aria-label': `Follow all of ${c.name}, and new issues in it` } })}</div>`}</div>`;
}

// ---------------- following ----------------
// As today's issue page (find.js followIssueNow): the profile sheet after a follow (R-184), then a toast; stopping says so
// with Undo, including what a category follow keeps. The sentence that sat under today's button moved into the toast.
async function followNow(i, on) {
  const before = { i: new Set(S.issueFollows), c: new Set(S.catFollows) };
  const ok = on ? await setFollows({ issuesOn: [i.id] }) : await unfollowIssue(i);
  if (!ok) { app.render(); return; }
  S.rcFmenu = null; app.render();
  const undo = async () => { await setFollows({ issuesOn: [...before.i], catsOn: [...before.c], issuesOff: [...S.issueFollows].filter(x => !before.i.has(x)), catsOff: [...S.catFollows].filter(x => !before.c.has(x)) }); app.render(); };
  const whole = !on && (i.categories || [i.category]).filter(k => before.c.has(k)).map(k => catOf(k)?.name).filter(Boolean);
  const say = r => r ? toast(profileSaved(r), { yay: true }) : toast(on ? `Following ${i.name}. New bills on it come to you too.`
    : whole.length ? `You no longer follow ${i.name}. You still follow the rest of ${whole.join(' and ')}, but not new issues in it.` : `You no longer follow ${i.name}.`, { yay: on, undo });
  if (!on || !followAsk(i.name, say)) say(null);
}
async function followCatNow(key, on) {
  const c = catOf(key); if (!c) return;
  if (!(await setFollows(on ? { catsOn: [key] } : { catsOff: [key] }))) { app.render(); return; }
  S.rcFocus = on ? '#rc-catok' : '[data-fdcat]'; app.render();
  const say = r => r ? toast(profileSaved(r), { yay: true }) : toast(on ? `Following all of ${c.name}, and any new issue in it.` : `You no longer follow all of ${c.name}.`, { yay: on,
    undo: async () => { await setFollows(on ? { catsOff: [key] } : { catsOn: [key] }); app.render(); } });
  if (!on || !followAsk(c.name, say, { many: true, receipt: `You’re following all of ${c.name}.` })) say(null);
}

// ---------------- old coalition addresses ----------------
// #/find/issue/ctfh was a coalition's page (R-018 answer 5 took coalition names off the public pages): it opens the category
// that holds that coalition's issues now, in place, so Back does not return to it. Anything else unknown opens Find.
const COALITION_CAT = { ctfh: 'tobacco', hiapa: 'tobacco', heal: 'food', 'farm-to-school': 'food', 'climate-health': 'climate', hic: 'care', 'oral-health': 'care', chw: 'care' };
function redirect(slug) {
  const k = COALITION_CAT[String(slug || '').toLowerCase()], to = k && catOf(k) ? `#/find/category/${k}` : '#/find';
  try { history.replaceState(history.state, '', to); } catch { /* ignore */ }
  setTimeout(() => app.render(), 0);
  return `<div class="skelpage">${skeleton(2)}</div>`;
}

// ---------------- wiring ----------------
// The ⋯ menu and the Following menu are small popovers: Escape and a click outside close them (added once).
const closeMenus = (focus = false) => {
  const m = document.getElementById('rc-imenu'); if (m && !m.hidden) { m.hidden = true; const t = document.querySelector('[data-rc-imenu]'); t?.setAttribute('aria-expanded', 'false'); if (focus) t?.focus(); }
  const f = document.getElementById('rc-fmenu'); if (f && !f.hidden) { f.hidden = true; S.rcFmenu = null; const t = document.querySelector('[data-rc-fmenu]'); t?.setAttribute('aria-expanded', 'false'); if (focus) t?.focus(); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && onIssue() && document.querySelector('#rc-imenu:not([hidden]), #rc-fmenu:not([hidden])')) { e.preventDefault(); closeMenus(true); } });
document.addEventListener('click', e => { if (onIssue() && !e.target.closest('.bl-menuwrap, .rc-fwrap')) closeMenus(); });
function wireFollows(root) {
  root.querySelectorAll('[data-fdissue]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.fdissue); if (!i || el.getAttribute('aria-busy') === 'true') return;
    el.setAttribute('aria-busy', 'true'); const on = !issueFollowed(i);
    S.rcFocus = el.closest('.rc-irow') ? `[data-fdissue="${i.id}"]` : on ? `[data-rc-fmenu="${i.id}"]` : `[data-fdissue="${i.id}"]`;
    await followNow(i, on);
  });
  root.querySelectorAll('[data-fdunissue]').forEach(el => el.onclick = async () => { const i = S.issueById.get(el.dataset.fdunissue); if (!i) return; S.rcFocus = `[data-fdissue="${i.id}"]`; await followNow(i, false); });
  root.querySelectorAll('[data-fdcat]').forEach(el => el.onclick = () => followCatNow(el.dataset.fdcat, true));
  root.querySelectorAll('[data-fdunfollowcat]').forEach(el => el.onclick = () => followCatNow(el.dataset.fdunfollowcat, false));
}
function wireIssue(root, i) {
  const m = model(i);
  if (m.state === 'ready') {
    const b = m.shape === 3 ? whatCard(m).b : m.lead.b;
    if (b) wireBillParts(root, b, { bar: document.querySelector('.actionbar') });   // the card's buttons, walkthroughs and folds (bill.js)
  }
  recDock();
  wireFollows(root); wireKit(root);
  root.querySelectorAll('[data-rc-retry]').forEach(el => el.onclick = () => { delete L[el.dataset.rcRetry]; app.render(); });
  const fm = root.querySelector('[data-rc-fmenu]');
  if (fm) fm.onclick = e => { e.stopPropagation(); const open = S.rcFmenu !== i.id; closeMenus(); S.rcFmenu = open ? i.id : null;
    const menu = document.getElementById('rc-fmenu'); if (menu) menu.hidden = !open; fm.setAttribute('aria-expanded', String(open));
    if (open) menu?.querySelector('button, a, input')?.focus(); };
  if (root.querySelector('[data-lvl-toggle]')) wireLevelLine(root.querySelector('.rc-fmenu') || root);   // the alerts level (R-299): Change opens the switch
  const im = root.querySelector('[data-rc-imenu]');
  if (im) im.onclick = e => { e.stopPropagation(); const menu = document.getElementById('rc-imenu'), open = menu.hidden; closeMenus(); menu.hidden = !open; im.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('a, button')?.focus(); };
  root.querySelectorAll('[data-rc-close]').forEach(el => el.addEventListener('click', () => closeMenus()));
  root.querySelectorAll('[data-calissue]').forEach(el => el.addEventListener('click', () => logAct('calendar')));   // the calendar feed (R-125), counted
  root.querySelectorAll('[data-rc-copy]').forEach(el => el.onclick = async () => { closeMenus();
    try { await navigator.clipboard.writeText(issueShareUrl(i)); toast('Link copied.'); } catch { toast('Copy didn’t work here. Use Share instead.'); } });
  // Share (R-113; the sheet since R-205): the issue's own share page, counted as a share; the sheet says what happened.
  root.querySelectorAll('[data-rc-ishare]').forEach(el => el.onclick = () => { closeMenus(); shareIssue(i); });
}

export default {
  tab: 'find',
  title: r => r.name === 'issue' ? (S.issueBySlug.get(r.slug)?.name || 'Issue') : catOf(r.key)?.name || 'Issues',
  render(r) {
    if (r.name === 'category') return categoryPage(r.key);
    const i = S.issueBySlug.get(r.slug);
    return i ? issuePage(i) : redirect(r.slug);
  },
  // The phone's docked bar (R-302): the card's own main button, shown once the card has scrolled away (bill.js recDock).
  // It names its bill and its moment (the fresh-eyes review, 10/18: docked under the list of other bills, or under the bills
  // that did not advance, "Ask the chairs for a hearing" read as being about the row above it).
  bar(r) {
    if (r.name !== 'issue' || wide()) return '';
    const i = S.issueBySlug.get(r.slug), m = i && model(i); if (m?.state !== 'ready' || !m.lead) return '';
    const { b, x } = m.lead, main = billParts(b).main, when = recLine(b, x, { when: true });
    return main ? `<p class="rc-dfor"><b>${esc(num(b))}</b>${when ? ` · ${esc(when)}` : ''}</p>${main}` : '';
  },
  wire(r) {
    const root = document.querySelector('#main .rc-iss, #main .rc-cat'); if (!root) return;
    if (r.name === 'issue') { const i = S.issueBySlug.get(r.slug); if (i) wireIssue(root, i); }
    else { wireFollows(root); wireKit(root); }
    if (S.rcFocus) { const t = root.querySelector(S.rcFocus); S.rcFocus = null; t?.focus({ preventScroll: true }); }
  },
};
