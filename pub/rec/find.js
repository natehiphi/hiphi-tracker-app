// Find under ?rec=1 (R-303, Nate's "make best choices" 10/17; backend docs/requests/R-303-assessment/find-search-lists.md).
// A person comes here to look something up, or to see what HIPHI works on (B-1). Today's Find was 3,284px on Kai's phone, 59%
// of it a second to-do list after Home's (a full action card and seven bill cards), with counts nobody could read ("10
// moving") and four kinds of follow control. Here it is the search box, the six topics as quiet rows, at most three issues
// that need voices this week (Home's rows and words, each to its issue page, which owns the action under option A), and at
// the foot the power layer: every bill HIPHI tracks, and the committees (moved from More). This week's asks to pass on (R-212
// #36) is a link under "Needs voices this week", or a foot row in the session when that list is empty (one way in, not two).
// Search results say each thing once (A-14): the issues, then people and committees (names without codes, C-15), then only
// the bills on no issue shown above, then "Did not advance" folded; a few words ("testify", "my senator") also offer the page
// they mean. A bill number lists the bill with the issue it is part of. No governor's messages on a word search (the
// header's suggestions already leave them out), and no headings with counts (R-300).
// The search itself is find.js's (its matching rules, its state S.fd, its live queries); this file draws what it finds and
// puts its painter in findHooks. An issue's, a category's and a list's pages are still find.js's (another builder takes the
// issue and category pages under rec).
import { S, app, esc, icon, nick, plain, spaced, billPath, sessionInfo, issuesOf, issueFollowed, stopOf, alive, plainStatus, dateLong,
  dismissed, suggestionList, recommendations, noteShown, reasonOf, issueIcon } from '../core.js';
import { btn, skeleton, inlineErr } from '../ui.js';
import F0, { parse, startSearch, searchNote, capNote, issueMatches, peopleMatches, findHooks, wireSearch, wireIssues, offSeason, byDue,
  hiphis, shows } from '../find.js';
import { moving, becameLaw, stopped, billsOfIssue, what, stoppedWhy } from '../mybills.js';
import { recSec, recRow, recFold, recEmpty, recFollow, wireKit, BOX, laterRow, showAll } from './kit.js';
import { when, keep } from '../calm/home.js';
export { headerSuggest } from '../find.js';   // the header's suggestions (app.js asks the find screen's module for them)

const F = S.fd;   // find.js's search state: the query, its results, the cache, which lists are open
const DAY = 864e5;
// "Waiting for a hearing · 12 days left": a row says the one phrase; the bill page has the days (R-303, one word each).
const LEFT = / · \d+ days? left$/;
const at = iso => keep(when(iso)), on = d => keep(dateLong(d + 'T12:00:00-10:00'));

// ---------------- one line for where a thing stands, in Home's words ----------------
// An issue: testimony due (amber inside a day, A-5), else its next hearing, else the day it needs a hearing by, else where
// its furthest bill is, else what became of it. The same phrases as Home's rows (calm/home.js stateOf), for issues nobody
// here follows, from the bills and hearings the page already holds.
export function issueLine(i) {
  const bills = billsOfIssue(i), now = Date.now();
  if (offSeason()) { const yr = sessionInfo().recapYear; return { text: bills.some(becameLaw) ? `Became law in ${yr}` : bills.length ? `Did not advance in ${yr}` : `No bills in ${yr}` }; }
  const live = bills.filter(moving), sts = live.map(stopOf);
  const hs = sts.filter(st => st.hearingState === 'scheduled' && st.hearing && Date.parse(st.hearing.scheduled_at) > now).map(st => st.hearing);
  const due = hs.filter(h => h.testimony_deadline && Date.parse(h.testimony_deadline) > now).sort((x, y) => x.testimony_deadline.localeCompare(y.testimony_deadline))[0];
  if (due) return { text: `Testimony due ${at(due.testimony_deadline)}`, warn: Date.parse(due.testimony_deadline) - now < DAY };
  const h = hs.sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) return { text: `Hearing ${at(h.scheduled_at)}` };
  const dl = sts.filter(st => st.phase === 'committee' && st.hearingState === 'none' && st.deadline && !st.deadline.missed).map(st => st.deadline.date).sort()[0];
  if (dl) return { text: `Needs a hearing by ${on(dl)}`, warn: Date.parse(dl + 'T12:00:00-10:00') - now < DAY };
  if (live.length) return { text: plainStatus(live[0]).short.replace(LEFT, '') };
  if (bills.some(becameLaw)) return { text: 'Became law' };
  return { text: bills.length ? 'Did not advance this year' : 'No bills on it yet' };   // Home's words (calm/home.js stateOf, C-15)
}
// A bill: its number, then the same phrases ("HB 1563 · Waiting for a hearing"). One that did not advance says why, in the
// few words the issue page's fold uses ("HB 2256 · Passed 1 committee; no hearing in House Finance by Mar 6"; stoppedWhy):
// "Did not advance" alone told nobody what happened (Nate, 19 Oct).
export function billLine(b) {
  const now = Date.now(), num = spaced(b.bill_number);
  if (stopped(b)) { let why = ''; try { why = stoppedWhy(b); } catch { /* a bill without its record: the plain status */ }
    return { text: `${num} · ${why || plainStatus(b).short}` }; }
  const st = stopOf(b), h = alive(b) && st.hearingState === 'scheduled' && st.hearing && Date.parse(st.hearing.scheduled_at) > now ? st.hearing : null;
  if (h) { const dl = h.testimony_deadline && Date.parse(h.testimony_deadline) > now ? h.testimony_deadline : '';
    return dl ? { text: `${num} · Testimony due ${at(dl)}`, warn: Date.parse(dl) - now < DAY } : { text: `${num} · Hearing ${at(h.scheduled_at)}` }; }
  return { text: `${num} · ${plainStatus(b).short.replace(LEFT, '')}` };
}
// "HB 1085, SB 1404 and SB 1528", past four "HB 1085, SB 1404, SB 1528 and 7 more": the issue page's preview of its own fold
// of bills that did not advance, so the two folds say the same (C-15: "did not advance", never "stopped").
const numbers = bs => { const ns = bs.map(b => spaced(b.bill_number)), shown = ns.length > 4 ? [...ns.slice(0, 3), `${ns.length - 3} more`] : ns;
  return shown.length > 1 ? `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}` : shown[0] || ''; };
const billName = b => nick(b) || what(b, 90);
// A bill says which issue it is part of (the issue is what people follow, R-018), and that they follow it when they do, unless
// the issue has the bill's own name (said once, A-14).
const partOf = b => { const iss = issuesOf(b), name = plain(billName(b)), mine = iss.some(issueFollowed); if (!iss.length) return '';
  if (iss.length === 1 && plain(iss[0].name) === name) return mine ? 'You follow this issue' : '';
  return `Part of: ${iss.map(i => i.name).join(' and ')}${mine ? ', which you follow' : ''}`; };
const billRow = b => { const l = billLine(b), part = partOf(b);
  return `<li><a class="rc-row" href="${esc(billPath(b))}"><span class="rc-rtext"><span class="rc-rname">${esc(billName(b))}</span><span class="rc-rstat${l.warn ? ' warn' : ''}">${esc(keep(l.text))}</span>${part ? `<span class="rc-rpart">${esc(part)}</span>` : ''}</span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`; };
// An issue in search: the category page's row, drawn the same (the wrap-up review of 10/18): the name and Home's line (the
// link), then the one follow control, the outlined "☆ Follow" pill or the pale "✓ Following" (kit recFollow;
// pressing Following lets it go, with Undo: find.js followIssueNow).
const issueRow = i => { const on = issueFollowed(i), l = issueLine(i);
  return `<li class="rc-frow rc-irow"><a class="rc-row" href="#/issue/${esc(i.slug)}"><span class="rc-rtext"><span class="rc-rname">${esc(i.name)}</span><span class="rc-rstat${l.warn ? ' warn' : ''}">${esc(l.text)}</span></span></a>
    ${recFollow(i, on, 'rc-follow')}</li>`; };
// A list that shows its first n and opens the rest in place (kit.js recMore's shape, with words of its own); kept open for
// the visit once opened (F.more), so a follow pressed in the rest does not shut it. In one white box (kit.js BOX, Nate 18
// Oct), except inside a closed card, which is a box already (box false).
function moreList(items, n, key, label = '', box = true) {
  const ul = (xs, id = '') => `<ul class="rc-rows${box ? ' ' + BOX : ''}" role="list"${id ? ` id="rc-more-${esc(id)}"` : ''}>${xs.join('')}</ul>`;
  if (items.length <= n || F.more['rc:' + key]) return ul(items);
  return `${ul(items.map((x, i) => i < n ? x : laterRow(x)), key)}${showAll(key, label || `Show all ${items.length}`)}`;
}

// ---------------- browsing ----------------
// Needs voices this week: the issues of the bills Find would suggest (rank.js: the person's short list, then every other
// hearing this week), one row an issue, a bill on no issue as itself. The best pick leads with its one reason (rank.js's
// biggest part of its score, "One of HIPHI's top priorities"; Nate 19 Oct, today's Find's first card in a quiet row), then
// the rest soonest deadline first; three show, the rest open in place. Only the three are counted as shown (R-094), and none
// an issue the person already follows (Home has those).
const dueAt = h => h.testimony_deadline && Date.parse(h.testimony_deadline) > Date.now() ? Date.parse(h.testimony_deadline) : Date.parse(h.scheduled_at);
function voices() {
  if (offSeason()) return [];
  const skip = dismissed(), now = Date.now(), ok = r => { const h = r.st?.hearing; return !!h && !skip.has(r.b.id) && Date.parse(h.scheduled_at) > now && Date.parse(h.scheduled_at) < now + 7 * DAY; };
  const out = [], seen = new Set();
  const add = r => { const on = issuesOf(r.b); if (on.some(issueFollowed)) return;
    const i = on[0] || null, key = i ? i.id : 'b:' + r.b.id; if (seen.has(key)) return; seen.add(key); out.push({ r, i, b: r.b, h: r.st.hearing }); };
  suggestionList(4).filter(ok).forEach(add);
  const top = out[0] || null; if (top) top.why = reasonOf(top.b);
  byDue(recommendations(200)).filter(ok).forEach(add);
  // After the pick, one order, soonest first, so "See more" never opens on something due before the rows above it (B-14).
  const rest = out.slice(1).sort((x, y) => dueAt(x.h) - dueAt(y.h)); out.length = 0; out.push(...(top ? [top] : []), ...rest);
  noteShown(out.slice(0, 3).map(e => e.r), 'find');
  return out;
}
function voiceRow(e) {
  const h = e.h, now = Date.now(), dl = h.testimony_deadline && Date.parse(h.testimony_deadline) > now ? h.testimony_deadline : '';
  const st = dl ? `Testimony due ${at(dl)}` : `Hearing ${at(h.scheduled_at)}`, warn = !!dl && Date.parse(dl) - now < DAY;
  const r = e.i ? { name: e.i.name, text: st, warn, href: `#/issue/${e.i.slug}` } : { name: billName(e.b), text: `${spaced(e.b.bill_number)} · ${st}`, warn, href: billPath(e.b) };
  if (!e.why) return recRow(r);
  // The pick: the same row with a label above its name saying why it leads a list otherwise soonest first (fresh-eyes review,
  // 19 Oct: without it the list looked mis-sorted), and its reason as a last line, both grey (the row is still the one link;
  // no card, no button, A-20).
  return `<li class="rc-pick"><a class="rc-row" href="${esc(r.href)}"><span class="rc-rtext"><span class="rc-pickby">${icon('sparkles')}<span>HIPHI’s pick for you</span></span><span class="rc-rname">${esc(r.name)}</span><span class="rc-rstat${warn ? ' warn' : ''}">${esc(keep(r.text))}</span><span class="rc-why">${esc(e.why)}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
}
// Lists from HIPHI (Keiki health, Tobacco-free Hawaiʻi): quiet rows in a white box near the foot (A-8), each to the list's page,
// whose one button follows it (one filled button a screen, A-20). A followed list says so in place of what it covers.
const listRows = () => { const ls = S.lists || []; if (!ls.length) return '';
  return recSec('fd-lists-h', 'Lists from HIPHI', `<ul class="rc-rows rc-lists ${BOX}" role="list">${ls.map(l => recRow({ name: l.title,
    text: S.listFollows?.has(l.id) ? 'You follow this list' : l.description || '', href: `#/list/${encodeURIComponent(l.slug)}`, lead: issueIcon(l.icon, 'list') })).join('')}</ul>`,
    { note: offSeason() ? 'Follow a list now and its bills come to you as HIPHI adds them.' : 'Follow a list to follow its bills, plus any HIPHI adds later.' }); };
const topicRows = () => `<ul class="rc-rows rc-topics ${BOX}" role="list">${(S.cats || []).map(c => recRow({ name: c.name, text: c.description || '', href: `#/find/category/${c.key}`, lead: c.icon })).join('')}</ul>`;
const topics = () => recSec('fd-iss-h', 'Browse by topic', topicRows());
const openWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'in January';
function browse() {
  const si = sessionInfo(), off = si.phase !== 'in', vs = voices();
  // Someone on their first visit who came by a shared link lands here (R-238); one quiet line offers the start, and only
  // to them (a guess: the first visit's own steps are unchanged).
  const newcomer = app.calmPlace?.() === '#/find' ? `<a class="rc-newhere" href="#/start/0"><span>New here? Pick what you care about</span>${icon('chevron-right')}</a>` : '';
  return `${newcomer}${off ? `<p class="rc-note rc-off">The Legislature is on break until ${esc(openWords(si))}. You can still look up any ${si.recapYear} bill and see what happened to it.</p>` : ''}
    ${topics()}
    ${vs.length ? recSec('fd-voices-h', 'Needs voices this week', moreList(vs.map(voiceRow), 3, 'voices', 'See more with a hearing this week')
      + `<p class="rc-every">${btn('Pass this week’s asks on to a group', { kind: 'text', iconEnd: 'chevron-right', href: '#/week' })}</p>`) : ''}
    ${listRows()}
    <nav class="rc-foot" aria-label="More to look up"><ul class="rc-rows ${BOX}" role="list">
      ${off || vs.length ? '' : recRow({ name: 'This week’s asks', text: 'To pass on in a group chat or newsletter', href: '#/week', lead: 'megaphone' })}${recRow({ name: 'Every bill HIPHI tracks', href: '#/allbills', lead: 'list' })}${recRow({ name: 'Committees', href: '#/committees', lead: 'landmark' })}</ul></nav>`;
}

// ---------------- search results ----------------
// Words that mean a page rather than a bill (staff search has the same idea): how to testify, and who represents you.
const HELP_RE = /\b(testify\w*|testimony|hearings?|how)\b/, LAW_RE = /\b(senators?|representatives?|represents?|legislators?|lawmakers?|my rep)\b/;
function places(q) {
  const t = plain(q), out = [];
  if (LAW_RE.test(t)) out.push({ name: 'Your lawmakers', text: 'Find who represents you', href: '#/legislators', lead: 'landmark' });
  if (HELP_RE.test(t)) out.push({ name: 'How to testify', text: 'Help with hearings and testimony', href: '#/help', lead: 'circle-help' });
  return out;
}
// People and committees by name: a committee without its code (C-15: codes never appear on a public screen).
const whoRows = q => peopleMatches(q).map(p => { const code = /^#\/committee\/(.+)$/.exec(p.href)?.[1];
  return { name: code ? (S.committees?.[code]?.name || p.title.replace(/\s*\([A-Z0-9]+\)$/, '')) : p.title, text: p.sub, href: p.href, lead: p.icon }; });
const everyLink = () => `<p class="rc-every">${btn('See every bill HIPHI tracks', { kind: 'text', iconEnd: 'chevron-right', href: '#/allbills' })}</p>`;
function resultsBody(q, res) {
  const P = parse(q);
  if (P.num) {
    if (!res.length) return `${recEmpty(`No bill has the number “${q}”.`)}${everyLink()}`;
    return `${moreList(res.map(billRow), 10, 'n-' + P.key)}${capNote(res)}${everyLink()}`;
  }
  const bills = res.filter(b => !/^GM/i.test(b.bill_number));   // governor's messages come up for their number only
  // The issues: those whose own words match, then those of the matching HIPHI bills still moving whose nickname or summary
  // has the words (the header's suggestions' rule), so a bill and its twin are said once, through the issue people follow.
  const direct = issueMatches(q), seen = new Set(direct.map(i => i.id)), iss = [...direct];
  for (const b of bills) if (!stopped(b) && hiphis(b) && shows(b, P)) for (const i of issuesOf(b)) if (!seen.has(i.id)) { seen.add(i.id); iss.push(i); }
  const onShown = b => issuesOf(b).some(i => seen.has(i.id));
  const other = bills.filter(b => !stopped(b) && !onShown(b)), gone = bills.filter(b => stopped(b) && !onShown(b));
  const pl = places(q), who = whoRows(q);
  // Words that name a page ("how to testify", "my senator") and that no bill has all of: the page is the answer, and bills
  // with one of the words ("how") would only be noise under it.
  if (pl.length && res.fewer) { other.length = 0; gone.length = 0; }
  const placesNav = pl.length ? `<nav class="rc-places" aria-label="Places"><ul class="rc-rows ${BOX}" role="list">${pl.map(recRow).join('')}</ul></nav>` : '';
  if (!iss.length && !who.length && !other.length && !gone.length) return pl.length ? placesNav
    : `${recEmpty(`Nothing matches “${q}”. Try one word, like e-cigarettes, a bill number like HB 1563, or a lawmaker’s name.`)}${topics()}`;
  const quiet = !iss.length && !other.length && gone.length ? `<p class="rc-note rc-none">${offSeason() ? `The ${sessionInfo().recapYear} session is over. Here’s where these bills ended up.` : `Nothing that matches “${esc(q)}” is moving right now.`}</p>` : '';
  return `${other.length || gone.length ? searchNote(res, P) : ''}
    ${placesNav}
    ${iss.length ? recSec('fd-qi-h', 'Issues', moreList(iss.map(issueRow), 6, 'qi-' + P.key)) : ''}
    ${who.length ? recSec('fd-who-h', 'People and committees', `<ul class="rc-rows ${BOX}" role="list">${who.map(recRow).join('')}</ul>`) : ''}
    ${other.length ? recSec('fd-ob-h', iss.length ? 'Other bills' : 'Bills', moreList(other.map(billRow), 10, 'ob-' + P.key)) : quiet}
    ${gone.length ? `<div class="rc-folds">${recFold('find-gone', 'Bills that did not advance', numbers(gone), moreList(gone.map(billRow), 10, 'g-' + P.key, '', false),
      { open: !iss.length && !other.length && !who.length })}</div>` : ''}
    ${capNote(res)}${everyLink()}`;
}
function results(q) {
  const P = parse(q), ready = F.key === P.key && !F.busy;
  if (ready && F.err) return `<div class="fd-err">${inlineErr('fd-err', 'Search didn’t work just now. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-retry': '1' } })}</div>`;
  if (!ready || !F.res) return F.shown ? `<div class="fd-stale" inert>${resultsBody(F.shown.q, F.shown.res)}</div>` : skeleton(3);
  F.shown = { q, res: F.res };
  return resultsBody(q, F.res);
}

// ---------------- the page ----------------
function page(q) {
  q = (q || '').trim();
  if (q !== F.cur) F.cur = q;
  if (q) startSearch(q);
  const busy = !!(q && F.busy);
  // The h1 and the box as today's (find.css): the label is the heading, so the box is named by it.
  return `<div class="fd rc rc-find" data-page="find">
    <form class="fd-search" role="search" action="#" novalidate>
      <h1 class="fd-h1 hero"><label for="q">Find issues and bills</label></h1>
      <div class="searchbox fd-box${busy ? ' busy' : ''}">${icon('search')}<span class="fd-spin" aria-hidden="true">${icon('loader-circle')}</span>
        <input id="q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false"
          placeholder="${matchMedia('(max-width: 359px)').matches ? 'e-cigarettes or HB 1563' : 'Try e-cigarettes, HB 1563 or a name'}" value="${esc(q)}">
        <button type="button" class="iconbtn clear fd-clear" aria-label="Clear search"${q ? '' : ' hidden'}>${icon('x')}</button></div>
    </form>
    <p class="sr" role="status" id="fd-status"></p>
    <div id="fd-results">${q ? results(q) : browse()}</div>
  </div>`;
}
const said = () => !F.cur ? '' : F.busy ? 'Searching' : F.err ? 'Search did not work' : F.res ? `Results for “${F.cur}”` : '';
// Typing redraws only the results (find.js runQuery and its search call this), so the box keeps its keyboard.
function paint() {
  if (document.body.dataset.screen !== 'find') return;
  const box = document.getElementById('fd-results'); if (!box) { app.render(); return; }
  box.innerHTML = F.cur ? results(F.cur) : browse();
  wireResults(box, true);
  document.querySelector('.fd-box')?.classList.toggle('busy', !!(F.cur && F.busy) || F.pending);
  const st = document.getElementById('fd-status'); if (st) st.textContent = said();
}
findHooks.paint = paint;
function wireResults(box, links) {
  if (!box) return;
  wireKit(box); wireIssues(box);
  box.querySelectorAll('[data-rc-showall]').forEach(b => b.addEventListener('click', () => { F.more['rc:' + b.dataset.rcShowall] = true; }));
  box.querySelectorAll('[data-retry]').forEach(el => el.onclick = () => { F.cache.delete(F.key); F.key = null; if (F.cur) startSearch(F.cur); paint(); });
  // Results painted in place were not there when app.js wired the page's links: keep them in the app.
  if (links) box.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); app.go(a.getAttribute('href')); }));
}

export default {
  tab: 'find',
  title: r => F0.title(r),
  // A HIPHI list's page is find.js's; its back link names the place it goes (B-4): Find, where its row is.
  render(r) { return r.name === 'find' ? page(r.q) : r.name === 'list' ? F0.render(r).replace(/<span>All lists<\/span>/g, '<span>Find</span>') : F0.render(r); },
  wire(r) {
    if (r.name !== 'find') { F0.wire(r); return; }
    const root = document.querySelector('.fd'); if (!root) return;
    wireSearch(); wireResults(document.getElementById('fd-results'), false);
    const st = document.getElementById('fd-status'); if (st) st.textContent = said();
    if (S.fdFocus) { root.querySelector(S.fdFocus)?.focus({ preventScroll: true }); S.fdFocus = null; }
  },
};
