// A person comes here to see the one thing to do next and where each of their issues stands (B-1).
// The calm Home (R-222 Direction 1, "one thing, then your issues"; Nate 10/10: "accept all"). Since 11 Oct it is everyone's
// Home: the layout test's first version, 'calm', and its fallback (Nate 10/11: "This becomes the default home, while the
// other home screens become other testable home pages"; backend 169). Today's bill page and tabs stay (app.js). One shape
// for every moment, phone first:
//   1. The greeting: their name and one line, with no count (R-300): what the page is for, or that nothing is new. Between
//      sessions: the break, what HIPHI backed that became law, and one link to their session.
//   2. The slide (R-295, Nate 10/17, version A "The slide"; steadied by R-300, Nate's picks of 17 Oct): the soonest thing to
//      do, drawn like an onboarding screen and not as a card: the issue's drawing, a heading that says the goal, one
//      sentence, one detail line (when, how long, the bill), one full-width button, "More ways to help" (on every slide,
//      opening inline) and the pager: back and next arrows around at most five dots, and a swipe does the same. Every slide
//      of the deck is as tall as its tallest words, so nothing below the words moves. A row below with something to do moves
//      the pager to it (decision 5a). The hearing ask when that is sooner; late testimony when nothing is due on time
//      (R-250); a plan to go on its day. Right after sending, "Mahalo" and the flower, then the next slide or "That's all for
//      this week". Nothing to do: the Capitol, "Nothing needs you this week" and no filled button. Between sessions, the one
//      thing to do then, as a slide. Home reads at onboarding's type size (R-174's step, pub/base.css; C-14).
//   3. Your issues, quieter (R-300): one row each, no box (with ?rec=1 the white box, Nate 18 Oct, R-303; rec.css),
//      the issue's name, one phrase for where it stands and its next
//      date, most important first. Amber only inside 24 hours (A-5). A dot before the name when it changed since the last
//      visit. Over 8 issues: in the order of where they stand, the first 8, then "Show all your issues" (no headings since
//      R-300; Nate 10/11 for the order). A bill followed on its own gets a row of its own (R-250).
//   4. At most two quiet lines: their session, and the profile ask (home.js profileLine).
// The budget it keeps (A-23, tests/home_calm.py): at most four blocks of at most two shapes, one filled button, each bill
// named once, under two phone screens for 3 issues and three for 16. What left Home and where it went: the review
// (backend docs/requests/R-222-assessment.md, section 6).
// Still today's Home: Your session (#/recap) and following nothing. The first visit's ending is the calm Home too (R-248,
// Nate 10/11: "Yes, queue it"): on the page load that finished it the greeting says "Mahalo, <name>!" with the row of what
// they did today and the petals once (R-098's celebration, home.js finDid and finFx); a reload says Aloha. It used to hand
// the whole tab to today's Home, so every new person's first Home was the old one, its wins card included.
import { S, app, esc, icon, nick, headline, billPath, alive, openActions, dayWord, timeWord, dateLong, hstDay, hiT, HST,
  followedIssues, issueBills, outcomeOf, didKind, sessionInfo, followsAnything, wiz, settledOn, plainStatus, testimonyDraft,
  followSummary, winsIn, ensureRecapPool, isResolution, nudge, catOf, issueOf, DEMO, issuesOf, codesOf, agrees, asSentence, chairContacts } from '../core.js';
import { btn, chip, skeleton } from '../ui.js';
import { actionCard, wireActions, wireNudge, goingPlans, goingCard, moreRow, downloadCutoffIcs } from '../actions.js';
import { celebrate, bloom, swap, reduced, fxOn, rooster } from '../fx.js';
import { CAPITOL, issueBand, flower } from '../art.js';
import { GOAL } from './goals.js';
import today, { calmParts as P, wireExtras } from '../home.js';

// Where the pager stands in the deck (R-300), for this visit: the key of the slide the person moved to (null until they
// move, so the soonest leads), and its place, so the one after a slide they sent from takes its place.
S.cmAt ??= null;
S.cmIdx ??= 0;
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const nameOf = b => nick(b) || headline(b, 70);
const time = iso => timeWord(iso);   // as the card writes it ("1:00 PM"), so a row and the card read the same
// "today", "tomorrow", "Wed" within the week; "Mar 30" further out, where a weekday alone would be ambiguous.
function dayShort(iso) {
  const d = dayWord(iso);
  if (/^today/.test(d)) return 'today';
  if (/^tomorrow/.test(d)) return 'tomorrow';
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })
    : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
}
// "today 2:00 PM", "Wed 9:30 AM", "Mar 30 1:00 PM": Home's words for a time, also the calm Find's and My issues' (R-303).
export const when = iso => `${dayShort(iso)} ${time(iso)}`;
// keep(): a date or time never breaks across lines; in the kit since every boxed list uses it (rec/kit.js).
export { keep } from '../rec/kit.js';
const prevVisit = () => S.prevVisit ? Date.parse(S.prevVisit) : 0;
const isNew = t => { const p = prevVisit(); return !!p && !!t && t > p && t <= Date.now(); };
const skipKey = x => x.h.id + '|' + x.b.id;
const byDeadline = (x, y) => x.h.testimony_deadline.localeCompare(y.h.testimony_deadline);

// ---------------- what there is to do ----------------
// Every testimony deadline still open in the next 7 days, soonest first, twins as one (home.js twinCards, R-131).
function dueAll() {
  const week = Date.now() + 7 * 864e5;
  return P.twinCards(openActions(S.bills, S.hearings).filter(x => !x.late && !settledOn(x.b, x.h) && x.h.testimony_deadline
    && Date.parse(x.h.testimony_deadline) < week).sort(byDeadline));
}
// Late testimony (R-250, Nate 10/11): a hearing still ahead whose written deadline has passed still takes testimony, marked
// late. Today's Home led with it ("Send late testimony"); the calm Home first left it out, so on a hearing day a follower read
// "Nothing needs you this week" (the C1 assessment's C1-1 again). Soonest hearing first. Not twinned: twinCards keeps one map
// for the page, and companions heard late on the same day are rare.
function lateAll() {
  return openActions(S.bills, S.hearings).filter(x => x.late && !settledOn(x.b, x.h)).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
}

// ---------------- 2. the slide ----------------
// The issue a bill is followed through (the row below names it), else its first issue.
const issueFor = b => followedIssues().find(i => issueBills(i).includes(b.id)) || issuesOf(b)[0] || null;
// The heading says the goal (decision 4, goals.js). Someone who sees it differently from HIPHI, an issue with no line yet
// and a bill on no issue get the name instead, so the heading never speaks for them.
const goalOf = b => { const i = issueFor(b); return (agrees(b) !== false && i && GOAL[i.slug]) || (i ? i.name : nameOf(b)); };
// A drawing on every slide (decision 3): the issue's own, else its topic's scene (art.js issueBand), else the Capitol.
const artOf = b => `<div class="cm-art">${(b && issueBand(issueFor(b), DEMO)) || CAPITOL}</div>`;
const NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const CH = { S: 'Senate', H: 'House' };
function whoHears(code) {
  const cs = codesOf(code), ch = CH[S.committees?.[cs[0]]?.chamber] || '';
  return cs.length > 1 ? `${NUM[cs.length] || cs.length} ${ch ? ch + ' ' : ''}committees` : `The ${ch ? ch + ' ' : ''}committee`;
}
// "today", "tomorrow", "Friday" within the week, "on Mar 30" further out.
function dayLong(iso) {
  const d = dayShort(iso);
  if (d === 'today' || d === 'tomorrow') return d;
  return Date.parse(iso) - Date.now() < 6 * 864e5 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'on ' + d;
}
// "Send it by Wed 9:30 AM", "Send it by 1:00 PM today" (the words table, section 6).
const byWhen = iso => { const d = dayShort(iso); return d === 'today' ? `${time(iso)} today` : `${d} ${time(iso)}`; };
// The card's own pieces (actions.js actionCard): its main button, its done line and its More ways to help are written once,
// there, and the slide takes them from the card's HTML rather than a second copy (one write surface). What the slide says
// itself (the goal, the sentence, the detail line) it leaves out.
const SAID = '.acband, .acrow, .achead, .acwhat, p.meta, p.ask, p.why, p.due, p.proof, p.note, .suggestbar';
function cardParts(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const a = t.content.querySelector('.acard'), col = a.querySelector('.btncol');
  col.querySelector('[data-moreways]')?.remove();
  const before = [], after = []; let past = false;
  for (const el of a.children) { if (el === col) { past = true; continue; } if (!el.matches(SAID)) (past ? after : before).push(el.outerHTML); }
  return { go: col.innerHTML.trim(), before: before.join(''), after: after.join('') };
}
// The bill's number on the detail line opens its page: the card's linked name went with the card, and the slide is the only
// place on Home that names the bill (its row says "On the slide above"), so reading the bill first is one tap.
const billLink = b => `<a class="cm-bill" href="${esc(billPath(b))}">${esc(spaced(b))}</a>`;
// The one detail line (R-300, Nate's "one detail line"): when it runs out, the time it takes, the bill ("By tomorrow 1:00 PM ·
// about 2 min · HB 1780"). Amber only inside 24 hours, on the time alone (A-5).
const detailLine = (dl, warn, mins, b) => `${warn ? `<b class="warn">${esc(dl)}</b>` : esc(dl)}${mins ? ` · ${mins}` : ''}${b ? ` · ${billLink(b)}` : ''}`;
// A slide's words: the goal, one sentence, the detail line, and what the card adds above its button (a twin, a letter
// started, what they did). ghost: a hidden copy that only holds room (below).
function wordsHtml(p, ghost = false) {
  const h = `<div class="cm-words"><${p.hl} class="cm-goal" id="${p.id}" tabindex="-1">${esc(p.title)}</${p.hl}>
    ${p.say ? `<p class="cm-say">${p.say}</p>` : ''}${p.detail ? `<p class="cm-time">${icon('clock')}<span>${p.detail}</span></p>` : ''}${p.before || ''}</div>`;
  return ghost ? ghostOf(h) : h;
}
// Every slide of the deck is as tall as its tallest words, so the button, More ways to help and the pager never move from
// one slide to the next (R-300; the jump was 199px sideways and up to 87px down). The other slides' words sit hidden in the
// same grid cell, as the first visit keeps the room of its longer answer (lessons.js reserveSaid, R-265). A copy has no ids,
// links, buttons, headings or data, so nothing in it can be found, focused, clicked or read aloud.
function ghostOf(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  for (let el; (el = t.content.querySelector('a, button, h1, h2, h3'));) {
    const s = document.createElement(el.matches('a, button') ? 'span' : 'p'); s.className = el.className; s.innerHTML = el.innerHTML; el.replaceWith(s);
  }
  t.content.querySelectorAll('*').forEach(el => [...el.attributes].forEach(a => { if (/^(id|href|tabindex|role|for|name|title|data-.*|aria-.*)$/.test(a.name)) el.removeAttribute(a.name); }));
  const d = t.content.firstElementChild; d.classList.add('cm-ghost'); d.setAttribute('aria-hidden', 'true'); d.setAttribute('inert', '');
  return d.outerHTML;
}
// One slide (R-295, steadied by R-300): the drawing, then one column: the words (with the deck's hidden copies), the button,
// "More ways to help" (opening inline under it, on every slide that has something to do), what the card adds under its button,
// and the pager. mk: the key More ways opens and closes (S.moreOpen); mw: the id of its rows.
function slideHtml(p, { ghosts = '', pager = '' } = {}) {
  const open = !!p.mk && S.moreOpen.has(p.mk);
  const more = p.mk ? btn(open ? 'Fewer ways to help' : 'More ways to help', { kind: 'text', sm: true, iconEnd: open ? 'chevron-up' : 'chevron-down', attrs: { 'data-moreways': p.mk, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': p.mw } }) : p.more || '';
  return `<section class="cm-slide" aria-labelledby="${p.id}">${p.art}
    <div class="cm-col"><div class="cm-face"><div class="cm-stack">${wordsHtml(p)}${ghosts}</div>${p.go ? `<div class="cm-go">${p.go}</div>` : ''}</div>
    ${more ? `<p class="cm-more">${more}</p>` : ''}${p.after || ''}${pager}</div></section>`;
}
// The pager (R-300, Nate 17 Oct: "combine pager and swipe and for the pager dots, there should only be shown 5 at a time so
// someone doesn't know how many cards are left to view"): back and next arrows (44px, A-6) around at most five dots, a window
// that slides with the current one, the outer dot smaller while more lie beyond it. No "1 of N" anywhere (a count on the slide
// reads like homework, C-7). The dots are pictures only; the heading that takes the focus says where they are.
const DOTS = 5;
function pagerHtml(n, at) {
  if (n < 2) return '';
  const start = n <= DOTS ? 0 : Math.max(0, Math.min(at - 2, n - DOTS)), end = Math.min(n, start + DOTS);
  let dots = '';
  for (let k = start; k < end; k++) dots += `<i class="${k === at ? 'on' : ''}${(k === start && start > 0) || (k === end - 1 && end < n) ? ' sm' : ''}"></i>`;
  const arrow = (d, ic, label, off) => `<button type="button" class="cm-pg" data-cm-step="${d}" aria-label="${label}"${off ? ' disabled' : ''}>${icon(ic)}</button>`;
  return `<nav class="cm-pager" aria-label="Other things you can do">${arrow(-1, 'chevron-left', 'The one before', at <= 0)}<span class="cm-dots" aria-hidden="true">${dots}</span>${arrow(1, 'chevron-right', 'The next one', at >= n - 1)}<span class="sr" aria-live="polite" data-cm-said></span></nav>`;
}

// Testimony due, or late testimony, as a slide. live: the one shown (the others are drawn quietly, only to hold room).
function dueParts(c, e, hl, live) {
  const x = e.x, b = x.b, h = x.h, late = e.kind === 'late', ck = `${b.id}|${h.id}`;
  // Right after a first action from a shared link, nothing is singled out: a bigger ask straight after the one just done
  // backfires (R-150's research; R-190 kept it on today's Home).
  const focus = !(c.welcome && !c.fin);
  const p = cardParts(actionCard(b, h, { focus, why: e.why, twin: S.hmTwins?.get(b.id) || null, heading: 'h2', quiet: !live }));
  const differs = agrees(b) === false, opp = b.position === 'oppose';
  const hears = `${whoHears(h.committee)} ${codesOf(h.committee).length > 1 ? 'hear' : 'hears'} it ${dayLong(h.scheduled_at)}${late ? ` at ${time(h.scheduled_at)}` : ''}.`;
  const why = e.why ? asSentence(e.why).replace(/([^.!?])$/, '$1.') + ' ' : '';
  const ask = late ? 'Late testimony is still taken, marked late.'
    : differs ? 'You see this one differently from HIPHI, and you can still tell them what you think.'
    : b.hiphi_action ? esc(b.hiphi_action) : `A short note from you can help ${opp ? 'stop it' : 'it pass'}.`;
  const dl = late ? h.scheduled_at : h.testimony_deadline, warn = Date.parse(dl) - Date.now() < 864e5;
  const writes = /data-helper|data-mailwalk/.test(p.go);
  return { hl, id: 't-' + h.id, art: artOf(b), title: goalOf(b), say: `${why}${esc(hears)} ${ask}`,
    detail: detailLine(`${late ? 'Late until' : 'By'} ${byWhen(dl)}`, warn, writes ? 'about 2 min' : '', b), before: p.before, go: p.go, after: p.after, mk: ck, mw: 'mw-' + h.id };
}
// The hearing ask (home.js askCard's facts, as a slide): a bill waiting for a hearing before its committee's cut-off. Its More
// ways to help (R-300, Nate's "every slide gets it"): a friend asks too, the cut-off in their calendar, the bill itself.
function askParts(c, e, hl) {
  const { b, st } = e.x, dl = st.deadline, n = codesOf(st.committee).length, chairs = chairContacts(st.committee).length > 1 ? 'chairs' : 'chair';
  const cs = whoHears(st.committee).replace(/^The /, n > 1 ? '' : 'A ');
  const say = `${cs} ${n > 1 ? 'haven’t' : 'hasn’t'} heard it yet. When people ask, the ${chairs} can give it one.`;
  const at = hiT(dl.date) + 12 * 36e5, warn = at - Date.now() < 864e5, day = dateLong(dl.date + 'T12:00:00-10:00');
  const mk = 'ask|' + b.id, mw = 'mw-ask-' + b.id;
  const read = `<a class="mwrow" href="${esc(billPath(b))}"><span class="lead">${icon('file-text')}</span><span class="body"><span class="title">Read what the bill does</span><span class="sub">In plain words, on its page.</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`;
  const rows = S.moreOpen.has(mk) ? `<div class="moreways" id="${esc(mw)}">${moreRow('share-2', 'Ask a friend to ask too', 'More voices carry more weight.', { 'data-cm-askf': b.id })}
    ${moreRow('calendar-plus', `Add ${esc(day.replace(/^\w+, /, ''))} to my calendar`, 'A reminder before the cut-off.', { 'data-cm-cutoff': b.id }, S.chips[mk + 'ics'] && 'Calendar file ready')}${read}</div>` : '';
  return { hl, id: 'cm-ask-' + b.id, art: artOf(b), title: goalOf(b), say: esc(say), detail: detailLine(`By ${day}`, warn, 'about 2 min', b),
    go: btn(`Ask the ${chairs} for a hearing`, { kind: 'primary', icon: 'mail', full: true, href: billPath(b), attrs: { 'data-hm-ask': b.bill_number, 'data-hm-act': '1' } }),
    after: rows, mk, mw };
}
// Nothing to do: the page is allowed to just be calm (no filled button), and "we" keep watch (gap 6).
function quietSlide(c, hl) {
  const nIss = followedIssues().length, quiet = (id, title, say, more = '') => slideHtml({ hl, id, art: artOf(null), title, say, more });
  if (c.thanks) return quiet('cm-quiet', 'That’s all for this week', 'We’ll keep watch. When your next issue has a hearing, it will be right here.');
  // Every bill on their issues is finished for the year: "a hearing will show up here" would be a promise the year cannot keep,
  // so the page says so and offers the one step that fills it (B-3; the critic's review).
  const ids = new Set(followedIssues().flatMap(issueBills)), bs = S.bills.filter(b => ids.has(b.id)), over = bs.length && !bs.some(alive) && !looseBills().some(alive);   // as the rows read it
  if (over) return quiet('cm-quiet', nIss > 1 ? 'Your issues are done for this year' : 'Your issue is done for this year',
    'Bills that did not pass can come back next session. Other bills are still moving and need voices.',
    btn('Find another issue to follow', { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/find' }));
  return quiet('cm-quiet', 'Nothing needs you this week',
    `We’re watching your ${nIss ? plural(nIss, 'issue') : c.noun} every day. When ${nIss === 1 ? 'it has' : 'one has'} a hearing, a simple way to help shows up here.`);
}
function theSlide(c) {
  const hl = c.welcome ? 'h2' : 'h1', k = c.card.kind;
  if (k === 'go') return `<section class="cm-card" aria-label="Your plan">${goingCard(c.card.plans)}</section>`;
  if (!c.entry) return quietSlide(c, hl);
  const parts = e => e.kind === 'ask' ? askParts(c, e, hl) : dueParts(c, e, hl, e === c.entry);
  const ghosts = c.deck.filter(e => e !== c.entry).map(e => wordsHtml(parts(e), true)).join('');
  return slideHtml(parts(c.entry), { ghosts, pager: pagerHtml(c.deck.length, c.at) });
}
// "Mahalo" right after they sent something from the slide (the mockup's "Right after sending"): the flower opens once
// (today's small burst, A-10; orange stays the colour of a real step done, C-7), then the next slide.
function thanksHtml(t, name) {
  const words = didKind(t.b, t.h, 'testimony') ? `Your testimony is in. The committee reads it before it votes ${dayLong(t.h.scheduled_at)}.`
    : didKind(t.b, t.h, 'email') ? 'Your email to the chair is sent. Mahalo for speaking up.' : 'Mahalo for speaking up.';
  const pic = t.fresh ? bloom() : flower(40); t.fresh = false;
  return `<div class="cm-thanks" role="status">${pic}<p><b>${name ? `Mahalo, ${esc(name)}!` : 'Mahalo!'}</b><span>${esc(words)}</span></p></div>`;
}
// The deck the pager moves through (R-300): testimony due and the hearing asks, merged by when each runs out (a hearing ask
// at the start of its cut-off day, and only when strictly sooner, as "Show the next one" took them); late testimony with the
// asks when nothing is due on time (R-250), else after everything, so a row's "Late testimony until" still has its slide. A
// row with something to do moves the pager to its slide (decision 5a). Moving is browsing, not skipping: nothing is put
// aside, so there is no "You've seen everything" ending (and no "Nothing needs you this week" after Malia's asks).
function deckOf(due, late, asks) {
  const on = kind => x => ({ kind, x, b: x.b, key: kind === 'ask' ? 'ask|' + x.b.id : skipKey(x),
    t: kind === 'ask' ? hiT(x.st.deadline.date) : Date.parse(kind === 'late' ? x.h.scheduled_at : x.h.testimony_deadline) });
  const timed = [...due.map(on('due')), ...(due.length ? [] : late.map(on('late'))), ...asks.map(on('ask'))].sort((x, y) => x.t - y.t);   // stable: a tie stays testimony first
  return due.length ? [...timed, ...late.map(on('late'))] : timed;
}
// The slide the pager is on: the one the person moved to, else the soonest; when that one has just been sent (it leaves the
// deck), the one that came after it.
function placeIn(deck) {
  if (!deck.length) return -1;
  let i = S.cmAt ? deck.findIndex(e => e.key === S.cmAt) : 0;
  if (i < 0) { i = Math.min(S.cmIdx || 0, deck.length - 1); S.cmAt = deck[i].key; }
  S.cmIdx = i; return i;
}

// ---------------- 3. your issues ----------------
// Bills followed on their own (R-250, Nate 10/11): an issue page's "Follow these 3", a stance, a list, or a bill on no issue
// at all. They had no row, so apart from the one card nothing about them was on Home, and an "Ask the chair" on one was
// nowhere. One row each, after the issues' rules (the same phrases, the same order); the card's own bill has none, since the
// card names it (A-14), and "Show the next one" brings its row back.
// A bill row names the bill once: its nickname (or its whole summary, not cut at 70) as the heading, its number in the status
// line, since a bill followed on its own was often followed by its number (C-10; the fresh-eyes review of R-250).
const spaced = b => (b.bill_number || '').replace(/^([A-Z]+)(\d+)$/, '$1 $2');
const looseBills = () => S.bills.filter(b => S.direct?.has(b.id) && !S.viaIssues?.has(b.id) && S.watch?.has(b.id));
// One phrase for where an issue stands, from the first of these that is true of any of its bills: testimony open; a
// hearing ahead (with what they did about it); a cut-off for a hearing; a decision in the last two weeks, or one coming;
// became law; where its furthest bill is; did not advance. t: the date that orders the rows (soonest first). g: the group
// the row goes under (GROUPS), when the list is long.
const RESULT = { passed: 'Passed a committee', passed_amended: 'Passed a committee with changes', deferred: 'Put on hold', recommitted: 'Sent back for more work' };
// ids: the issue's bills, or one bill followed on its own (R-250), which gets the same phrases.
function stateOf(ids, c) {
  const bs = S.bills.filter(b => ids.has(b.id)), has = b => ids.has(b.id), now = Date.now();
  // A letter they started, for a hearing still ahead, is said on its issue's row unless the card is that hearing (whose
  // button then says "Finish sending your testimony"), so a saved letter is never left unmentioned (R-189).
  const dr = c.open.find(x => has(x.b) && testimonyDraft(x.h) && Date.parse(x.h.scheduled_at) > now && x.h.id !== c.card.items?.[0]?.h.id);
  if (dr) { const dl = dr.h.testimony_deadline && Date.parse(dr.h.testimony_deadline) > now ? dr.h.testimony_deadline : '', t = Date.parse(dl || dr.h.scheduled_at);
    return { g: t - now < 7 * 864e5 ? 'due' : 'hearing', t, warn: !!dl && t - now < 864e5, text: `Your letter is started · ${dl ? `due ${when(dl)}` : `hearing ${when(dr.h.scheduled_at)}`}` }; }
  const ds = c.due.filter(x => has(x.b)), d = ds[0];
  // A second bill due this week on the same issue is said on the row, so nothing to do is left off the page (B-14).
  if (d) { const t = Date.parse(d.h.testimony_deadline), more = ds.length > 1 ? `, and ${ds.length - 1} more this week` : '';
    return { g: 'due', t, warn: t - now < 864e5, pick: skipKey(d), fresh: ds.some(x => isNew(Date.parse(x.h.notice_posted_at || 0))), text: `${testimonyDraft(d.h) ? 'Your letter is started · due' : 'Testimony due'} ${when(d.h.testimony_deadline)}${more}` }; }
  // Late testimony is still something to do, so its row says so rather than only "Hearing today" (R-250, B-14).
  const lt = c.late.find(x => has(x.b));
  if (lt) { const t = Date.parse(lt.h.scheduled_at); return { g: 'due', t, warn: t - now < 864e5, pick: skipKey(lt), text: `Late testimony until ${when(lt.h.scheduled_at)}` }; }
  const h = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) > now && alive(S.bills.find(b => b.id === x.bill_id) || {}))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) { const b = bs.find(x => x.id === h.bill_id), plan = c.plans.some(p => p.h.id === h.id);
    const did = didKind(b, h, 'testimony') ? 'You testified' : didKind(b, h, 'email') ? 'You emailed the chair' : plan ? 'You plan to go' : '';
    return { g: 'hearing', t: Date.parse(h.scheduled_at), fresh: isNew(Date.parse(h.notice_posted_at || 0)), text: `${did ? `${did} · hearing` : 'Hearing'} ${when(h.scheduled_at)}` }; }
  const a = c.asksAll.find(x => has(x.b));
  if (a) { const t = hiT(a.st.deadline.date) + 12 * 36e5;   // the end of the cut-off day
    return { g: 'needs', t, warn: t - now < 864e5, pick: 'ask|' + a.b.id, text: `Needs a hearing by ${dateLong(a.st.deadline.date + 'T12:00:00-10:00')}` }; }
  // The latest decision in the last 14 days, or a hearing in the last 3 days still waiting for one.
  const past = S.hearings.filter(x => ids.has(x.bill_id) && x.status !== 'cancelled' && Date.parse(x.scheduled_at) <= now && Date.parse(x.scheduled_at) > now - 14 * 864e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  for (const x of past) {
    const o = outcomeOf(x), at = o && Date.parse(o.reported_at || x.scheduled_at);
    if (o?.outcome && RESULT[o.outcome]) return { g: /^passed/.test(o.outcome) ? 'passed' : 'waiting', rank: 1, fresh: isNew(at), text: `${RESULT[o.outcome]} ${dayShort(new Date(at).toISOString())}` };
    if (!o?.outcome && Date.parse(x.scheduled_at) > now - 3 * 864e5) return { g: 'waiting', rank: 1, text: `Heard ${dayShort(x.scheduled_at)} · decision coming` };
  }
  const law = bs.find(b => b.stage === 'enacted' || b.stage === 'governor');
  if (law) return { g: 'law', rank: 2, fresh: isNew(hiT(law.last_action_date || '1970-01-01')), text: plainStatus(law).short };
  const live = bs.filter(alive);
  if (live.length) return { g: 'waiting', rank: 3, text: plainStatus(live[0]).short };
  return { g: bs.length ? 'dead' : 'waiting', rank: 4, text: bs.length ? 'Did not advance this year' : 'No bills on it yet' };
}
// The issue on the slide says so in its row, so nothing is said twice (A-14); a row with something to do this week brings it
// up onto the slide (decision 5a, data-cm-pick), and a row with nothing to do opens the issue's page as before. What changed
// since the last visit is a small dot before the name (R-300, Nate's "quieter list"), with its words for a screen reader
// and on hover; the name stays the row's first text.
// A row's facts: an issue's, or a bill's followed on its own (its number first in the status line).
const issueRow = (i, c) => ({ i, ...stateOf(new Set(issueBills(i)), c), name: i.name, href: `#/issue/${i.slug}` });
const billRow = (b, c) => { const st = stateOf(new Set([b.id]), c); return { b, ...st, name: headline(b), text: `${spaced(b)} · ${st.text}`, href: billPath(b) }; };
// A deadline stays whole on its line: the day and its time in one span ("Testimony due Sun / 3:00 PM" broke in the
// redesign's narrower white box, R-303), held on one line by rec.css with ?rec=1 only; today's Home wraps as before.
const whole = t => t.replace(/\b((?:today|tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun|[A-Z][a-z]{2} \d{1,2}) \d{1,2}:\d{2} [AP]M)/g, '<span class="cm-when">$1</span>');
const rowHtml = r => `<li><a class="cm-row${r.on ? ' on' : ''}" href="${esc(r.href)}"${r.pick && !r.on ? ` data-cm-pick="${esc(r.pick)}"` : ''}><span class="cm-rtext"><span class="cm-rname">${esc(r.name)}${r.fresh ? '<span class="cm-new" title="New since your last visit"><span class="sr"> New since your last visit</span></span>' : ''}</span>
    <span class="cm-rstat${r.warn ? ' warn' : ''}">${whole(esc(r.text))}</span></span>${icon('chevron-right', { cls: 'cm-chev' })}</a></li>`;
// A long list (Nate 10/11, for a follower of dozens like Leilani: "Option number 2, but still grouped by status"): the
// issues ranked by importance, which is the group order below, then the soonest date, then HIPHI's own order of issues; the
// first FOLD show and "Show all your issues" opens the rest in place. No headings over the groups since R-300 (Nate 17 Oct:
// "remove the "due this week xyz" under the "your issues""): each row already says where it stands, and the order keeps
// what is due first. Something to do is folded away only when more than FOLD issues have something due (B-14).
const GROUPS = [['due', 'Due this week'], ['hearing', 'Hearing coming up'], ['needs', 'Needs a hearing'], ['passed', 'Passed recently'],
  ['waiting', 'Waiting'], ['law', 'Became law'], ['dead', 'Did not advance']];
const GORDER = Object.fromEntries(GROUPS.map(([k], n) => [k, n]));
const FOLD = 8;
export const byImportance = (x, y) => (GORDER[x.g] ?? 9) - (GORDER[y.g] ?? 9) || (x.t ?? Infinity) - (y.t ?? Infinity) || (x.rank ?? 0) - (y.rank ?? 0)
  || (x.i?.sort_order ?? 99) - (y.i?.sort_order ?? 99) || x.name.localeCompare(y.name);
// The fold never hides a deadline without saying so (B-14; the fresh-eyes review, 10/11): the button says more is due behind
// it, without a number (R-300: counts left Home's words, "If it's a lot it can be overwhelming").
const dueAfter = rows => rows.slice(FOLD).some(r => r.g === 'due') ? ' · more due this week' : '';
// Bills followed on their own have rows too (R-250), so the heading and the fold name what the list holds; one link under it,
// and while the fold is shut only the fold, so two "all your issues" links never stand one above the other (the critic, R-300).
function issuesBlock(rows) {
  if (!rows.length) return '';
  const long = rows.length > FOLD && rows.every(r => r.g), nIss = rows.filter(r => !r.b).length, nB = rows.length - nIss;
  const head = nB && nIss ? 'Your issues and bills' : nB ? 'Your bills' : 'Your issues', noun = nB && nIss ? 'issues and bills' : nB ? 'bills' : 'issues';
  return `<section class="cm-issues" aria-labelledby="cm-iss-h"><h2 id="cm-iss-h" class="cm-h">${head}</h2>
    <ul class="cm-rows" role="list">${rows.map((r, n) => long && n >= FOLD ? rowHtml(r).replace('<li>', '<li data-cm-more hidden>') : rowHtml(r)).join('')}</ul>
    ${long ? btn(`Show all your ${noun}${dueAfter(rows)}`, { kind: 'text', icon: 'chevron-down', cls: 'hm-link cm-showall', attrs: { 'data-cm-showall': '' } }) : ''}
    ${btn('See them all in My issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link cm-all', attrs: long ? { 'data-cm-more': '', hidden: '' } : {} })}</section>`;
}

// ---------------- 1. the greeting ----------------
function sinceWhen() {
  const d = new Date(prevVisit()), days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(d))) / 864e5);
  return days <= 1 ? 'yesterday' : days < 7 ? d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'long' }) : 'your last visit';
}
// The heading on the page load that finished the first visit (R-248): Mahalo and their name, as the ending on Home said it.
const mahalo = name => name ? `Mahalo, ${esc(name)}!` : 'Mahalo for joining in!';
// One line, as onboarding's screens start ("Aloha, Kai. Here’s how you can help."): the slide's heading is the page's.
function greeting(c) {
  const name = P.myName(), hi = `Aloha${name ? `, ${esc(name)}` : ''}`;
  if (c.welcome) {
    const said = followSummary() || plural(S.bills.length, 'bill'), fin = P.finNow();
    if (fin) return `<header class="cm-head"><h1 class="hero" id="hm-finh">${mahalo(name)}</h1><p class="lede">This is your home page. ${c.card.kind ? 'Here’s the first thing you can do.' : 'We keep watch, and when one has a hearing, a simple way to help shows up here.'}</p>${P.finDid()}</header>`;
    return `<header class="cm-head"><p class="cm-hi"><b>${hi}.</b> <span>You follow ${esc(said)}. ${c.card.kind ? 'Here’s the first thing you can do.' : 'We keep watch.'}</span></p></header>`;
  }
  if (c.thanks) return `<header class="cm-head">${thanksHtml(c.thanks, name)}</header>`;
  // One line and no count (R-300, Nate 17 Oct: "Remove the XYZ things you can do this week. If it's a lot it can be
  // overwhelming"; it reverses R-295's count). What changed is a dot on its row, and a result on a bill with a slide opens
  // that slide's sentence (A-14), so the greeting says hello and what the page is for. Words for Nate's look.
  const line = ['due', 'late', 'ask'].includes(c.card.kind) ? 'Here’s how you can help.'
    : c.freshN ? `There’s news on your ${c.noun} below.` : prevVisit() ? `Nothing new since ${esc(sinceWhen())}.` : '';   // the slide says we keep watch (A-14)
  return `<header class="cm-head"><p class="cm-hi"><b>${hi}.</b>${line ? ` <span>${line}</span>` : ''}</p></header>`;
}

// ---------------- the page, in session ----------------
// The slide last drawn, once it is settled (testimony sent, or the rest done; core settledOn), becomes the Mahalo for this
// visit. Found on the next draw, so it follows every way of sending (the letter's walkthrough, the email, an Undo-free mark).
function thanksNow() {
  const was = S.cmShown;
  if (was && settledOn(was.b, was.h)) { S.cmThanks = { ...was, fresh: true }; S.cmShown = null; }
  if (S.cmThanks && !settledOn(S.cmThanks.b, S.cmThanks.h)) S.cmThanks = null;   // an Undo takes it back
  return S.cmThanks;
}
function inSession(si, { welcome, fin }) {
  const due = dueAll(), asksAll = P.oneIdeaAsks(due), plans = goingPlans(), late = lateAll();
  const deck = deckOf(due, late, asksAll), at = placeIn(deck), entry = deck[at] || null;
  // Good news on a bill with a slide opens that slide's sentence (the R-295 rule, now for every slide of the deck); it is seen
  // once the slide is shown. A law they spoke up for still gets its full-screen moment (C-7) wherever its row is.
  const gn = P.goodNews();
  for (const e of deck) { const g = gn.find(x => x.b.id === e.b.id); if (g) { e.g = g; e.why = P.momentText(g); } }
  const law = gn.find(x => x.kind === 'law' && x !== entry?.g), soon = plans.filter(p => p.soon);
  // On the day of a hearing they are going to or speaking at on Zoom (R-212 #32), that plan leads: the deck waits a day.
  const today = soon.filter(p => p.today);
  const card = today.length ? { kind: 'go', plans: today, bill: today[0].b } : entry ? (entry.kind === 'ask' ? { kind: 'ask', ask: entry.x, bill: entry.b } : { kind: entry.kind, items: [entry.x], bill: entry.b })
    : soon.length ? { kind: 'go', plans: soon, bill: soon[0].b } : { kind: '' };
  const c = { si, welcome, fin, due, late, asksAll, plans, card, deck, entry, at, moments: [entry?.g, law].filter(Boolean),
    open: openActions(S.bills, S.hearings).filter(x => !settledOn(x.b, x.h)), thanks: thanksNow() };
  S.cmKeys = deck.map(e => e.key); S.cmMk = entry ? (entry.kind === 'ask' ? entry.key : `${entry.b.id}|${entry.x.h.id}`) : null;
  const iss = followedIssues(), own = looseBills().filter(b => b.id !== card.bill?.id);
  // The slide's own issue: its row says "On the slide above" (and what else on it is due), and stays where it ranks.
  const onSlide = ['due', 'late', 'ask'].includes(card.kind) ? card.bill.id : null;
  const slideRow = (i, st) => { const ids = issueBills(i); if (!onSlide || !ids.includes(onSlide)) return st;
    const more = due.filter(x => ids.includes(x.b.id) && x.b.id !== onSlide).length;
    return { ...st, on: true, warn: false, text: `On the slide above${more ? `, and ${more} more this week` : ''}` }; };
  const rows = [...iss.map(i => slideRow(i, issueRow(i, c))), ...own.map(b => billRow(b, c))].sort(byImportance)
    // Nothing is new seconds after the first visit: everything on the page was just seen there.
    .map(r => ({ ...r, fresh: !welcome && r.fresh }));
  c.freshN = rows.filter(r => r.fresh).length; c.noun = !iss.length && looseBills().length ? 'bills' : 'issues';   // someone who follows only bills has no issues

  const head = greeting(c);
  S.cmMoments = c.moments;
  S.cmShown = card.kind === 'due' || card.kind === 'late' ? { b: card.items[0].b, h: card.items[0].h } : null;
  const lines = [welcome ? '' : P.sessionLink(si.yr), P.profileLine()].filter(Boolean).join('');
  return `<div class="hm cm${welcome ? '' : ' cm-met'}${finCls(welcome)}">
    ${head}
    ${theSlide(c)}
    ${issuesBlock(rows)}
    ${lines ? `<div class="cm-lines">${lines}</div>` : ''}
  </div>`;
}

// ---------------- the page, between sessions ----------------
// The break, the wins and their session in the greeting; the one thing to do now (a hello to their legislators); their
// issues as rows, each with what became of it.
function offSession(si, { welcome }) {
  const yr = si.recapYear, next = si.nextOpen, nextYr = next ? +next.slice(0, 4) : yr + 1, name = P.myName();
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  ensureRecapPool(yr); const wins = winsIn(yr);
  const lede = `The Legislature is on break${opens ? ` until ${esc(opens)}` : ''}.${wins && wins.length ? ` In ${yr}, ${esc(plural(wins.length, 'bill'))} HIPHI backed became law.` : ''}`;
  const known = P.districtsKnown();
  const ready = known ? [`Say aloha before ${nextYr}`, `Lawmakers are writing their ${nextYr} bills now. A short hello from someone in their district tells them what you care about. It takes about 2 minutes.`]
    : ['Get ready for January', 'Know who represents you before the first hearing. It takes 30 seconds.'];
  const fin = welcome && P.finNow();
  const card = slideHtml({ hl: fin ? 'h2' : 'h1', id: 'cm-rd', art: `<div class="cm-art">${CAPITOL}</div>`, title: ready[0], say: esc(ready[1].replace(/ It takes (about 2 minutes|30 seconds)\.$/, '')),
    detail: known ? 'About 2 minutes' : 'About 30 seconds', go: btn(known ? 'Write to my legislators' : 'Find my legislators', { kind: 'primary', icon: known ? 'mail' : 'landmark', full: true, href: '#/legislators' }) });
  const rows = offRows(yr);
  // The Mahalo says where they are, as in session (the fresh-eyes review of R-248); the ticks below say what they did, so the
  // lede does not count their issues again (A-14).
  const hello = fin ? `<h1 class="hero" id="hm-finh">${mahalo(name)}</h1><p class="lede">This is your home page. ${lede}</p>${P.finDid()}`
    : `<p class="cm-hi"><b>Aloha${name ? `, ${esc(name)}` : ''}.</b> <span>${lede}</span></p>${welcome ? '' : P.sessionLink(yr)}`;
  return `<div class="hm cm cm-off${finCls(welcome)}">
    <header class="cm-head">${hello}</header>
    ${card}
    ${issuesBlock(rows)}
    ${P.meetLine() || P.profileLine() ? `<div class="cm-lines">${P.meetLine()}${P.profileLine()}</div>` : ''}
  </div>`;
}

// Between sessions, one row per issue (or whole topic) followed and per bill followed on its own. Each issue's outlook (staff
// write it in Staff v2) to its first sentence: one phrase a row, as in session; the whole outlook is on the issue's page
// (Leilani's sixteen ran to 2,600px whole).
const first = t => (String(t || '').match(/^.*?[.!?](?=\s|$)/) || [String(t || '')])[0];
// "Disposable e-cigarette ban (SB 2175) became law in 2026." under the heading "Disposable e-cigarette ban" says the name
// twice (the review of R-222): "Became law in 2026 (SB 2175)."
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const unname = (name, t) => { if (!t.startsWith(name + ' ')) return t; const rest = t.slice(name.length + 1), m = /^\(([A-Z]+ ?\d+)\) (.*?)\.?$/.exec(rest);
  return m ? `${cap(m[2])} (${m[1]}).` : cap(rest); };
const offRows = yr => [...P.myIssues(yr).map(r => ({ name: r.title, text: unname(r.title, first(r.sub)), href: r.href })),
  ...looseBills().map(b => ({ b, name: headline(b), text: `${spaced(b)} · ${plainStatus(b).short}`, href: billPath(b) }))];

// My issues under ?rec=1 (R-303, pub/rec/mybills.js): every issue and bill followed as Home's rows, in Home's words and
// order, without the slide (so no row says "On the slide above"), so the two pages never disagree about where one stands.
// Between sessions, the rows Home shows then.
export function myRows() {
  const si = sessionInfo();
  if (si.phase !== 'in') return offRows(si.recapYear);
  const due = dueAll(), c = { due, late: lateAll(), asksAll: P.oneIdeaAsks(due), plans: goingPlans(), card: {}, open: openActions(S.bills, S.hearings).filter(x => !settledOn(x.b, x.h)) };
  const welcome = P.welcomed();
  return [...followedIssues().map(i => issueRow(i, c)), ...looseBills().map(b => billRow(b, c))].sort(byImportance).map(r => ({ ...r, fresh: !welcome && r.fresh }));
}

// The page that finished the first visit: .cm-fin (home.js finFx plays the petals once), and .hm-anim on its first draw only,
// so the ticks rise once and a redraw as data lands does not replay them (home.css).
const afterSwap = (moved, fn) => moved && typeof moved.then === 'function' ? moved.then(fn, fn) : requestAnimationFrame(fn);
const finCls = welcome => welcome && P.finNow() ? ` cm-fin${S.hmFinDrawn ? '' : ' hm-anim'}` : '';
let delegated = false;
export default {
  tab: 'home',
  title: route => today.title(route),
  render(route) {
    if (!S.featured || !S.pool) return skeleton(4);
    const welcome = P.welcomed(), fin = !!wiz().finale;
    delegated = route?.name === 'recap' || !followsAnything();
    if (delegated) return today.render(route);
    const si = sessionInfo();
    // A fresh arrival on the first visit's own Home, the email step skipped: one ask, as a line (core's nudge rules).
    if (!document.querySelector('#main .cm') && welcome && !S.nudge && !S.session && !P.alertsGiven()) nudge('follow');
    return si.phase === 'in' ? inSession(si, { welcome, fin }) : offSession(si, { welcome });
  },
  wire(route) {
    if (delegated) { today.wire && today.wire(route); return; }
    const root = document.querySelector('#main .cm'); if (!root) return;
    wireActions(root); wireNudge(root); wireExtras(root); P.finFx();
    // Moving through the deck (R-300): the pager's arrows, a swipe across the slide and a row with something to do all move the
    // one position. The slide changes in place with onboarding's short slide, the way the person is going (fx.js swap, A-10);
    // the button, More ways and the pager stay where they are. After an arrow the focus stays on it (so it can be pressed
    // again) and the new heading is read out; after a swipe or a row, the heading takes the focus.
    const goal = () => document.querySelector('#main .cm-goal');
    const go = (i, how) => {
      const keys = S.cmKeys || []; if (i < 0 || i >= keys.length || i === S.cmIdx) return false;
      const dir = i > S.cmIdx ? 'fwd' : 'back';
      if (S.cmMk) S.moreOpen.delete(S.cmMk);   // its More ways closes as it leaves
      S.cmAt = keys[i]; S.cmIdx = i; S.cmThanks = null;
      afterSwap(swap(() => app.render(), dir), () => {
        const g = goal(), arrow = how === 'pager' && document.querySelector(`#main [data-cm-step="${dir === 'fwd' ? 1 : -1}"]:not([disabled])`);
        if (arrow) { arrow.focus(); const said = document.querySelector('#main [data-cm-said]'); if (said && g) said.textContent = g.innerText; }
        else g?.focus({ preventScroll: true });
      });
      return true;
    };
    root.querySelectorAll('[data-cm-step]').forEach(el => el.onclick = () => go(S.cmIdx + Number(el.dataset.cmStep), 'pager'));
    // The swipe (Nate 17 Oct: "combine pager and swipe"): on a touch screen the drawing and the words follow the finger and,
    // past 60px, the next or the one before slides in; short of that, or past either end, they settle back. Up and down stay
    // the page's scroll (touch-action: pan-y). A mouse has the arrows. Under Reduce Motion nothing follows the finger.
    const sl = root.querySelector('.cm-slide');
    if (sl && (S.cmKeys || []).length > 1) {
      let x0 = null, dx = 0, id = null;
      const settle = () => { sl.classList.add('cm-settle'); sl.style.removeProperty('--cm-dx'); setTimeout(() => sl.classList.remove('cm-settle'), 220); };
      sl.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' || e.target.closest('a, button, input, select, textarea')) return; x0 = e.clientX; dx = 0; id = e.pointerId; });
      sl.addEventListener('pointermove', e => { if (x0 == null || e.pointerId !== id) return; dx = e.clientX - x0;
        if (Math.abs(dx) > 8 && !sl.hasPointerCapture(id)) try { sl.setPointerCapture(id); } catch { /* the pointer already ended */ }
        if (!reduced()) sl.style.setProperty('--cm-dx', `${Math.round(dx * .6)}px`); });
      const up = e => { if (x0 == null || e.pointerId !== id) return; x0 = null;
        if (!(Math.abs(dx) > 60 && go(S.cmIdx + (dx < 0 ? 1 : -1), 'swipe'))) settle(); };
      sl.addEventListener('pointerup', up);
      sl.addEventListener('pointercancel', e => { dx = 0; up(e); });
    }
    // A row with something to do this week brings it up onto the slide (decision 5a): the top of Home, the pager moved to it.
    // wire() runs before app.js wireFrame, so this handler is first on the row and stops wireFrame's, which opens every "#/"
    // link whether or not the click was cancelled (the href stays, for a new tab).
    root.querySelectorAll('[data-cm-pick]').forEach(el => el.onclick = e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      const i = (S.cmKeys || []).indexOf(el.dataset.cmPick); if (i < 0) return;
      e.preventDefault(); e.stopImmediatePropagation();
      window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      if (!go(i, 'pick')) goal()?.focus({ preventScroll: true }); });
    // The hearing ask's More ways (R-300): a friend asks too (the share sheet, its ask "Ask the chair for a hearing"), and the
    // cut-off in their calendar.
    const askOf = id => (P.oneIdeaAsks(dueAll()).find(x => x.b.id === id) || {});
    root.querySelectorAll('[data-cm-askf]').forEach(el => el.onclick = async () => { const { b } = askOf(el.dataset.cmAskf); if (!b) return;
      const how = await (await import('../askfriend.js')).askFriend({ b, ask: 'ask' }); if (how) app.render(); });
    root.querySelectorAll('[data-cm-cutoff]').forEach(el => el.onclick = () => { const { b, st } = askOf(el.dataset.cmCutoff); if (!b) return;
      downloadCutoffIcs(b, st.deadline.date); S.chips['ask|' + b.id + 'ics'] = true; app.render(); });
    // "Show all N" opens the rest of a long list where it is, and the first row it opened takes the focus (A-16).
    const all = root.querySelector('[data-cm-showall]');
    if (all) all.onclick = () => { const more = [...root.querySelectorAll('[data-cm-more]')]; more.forEach(el => el.hidden = false); all.remove();
      const first = more.map(el => el.matches('li') ? el : el.querySelector('li')).find(Boolean)?.querySelector('a'); first?.focus(); };
    // The greeting's good news is seen once, as a good news card was (home.js seeMoment); a law they spoke up for gets its
    // full-screen moment the first time it is said (C-7, the biggest there is).
    const ms = S.cmMoments || []; S.cmMoments = null;
    const m = ms.filter(x => P.seeMoment(x)).find(x => x.kind === 'law');
    if (m) setTimeout(() => celebrate({ title: `A bill you spoke up for ${isResolution(m.b) ? 'was adopted' : 'became law'}`, sub: `${nameOf(m.b)}. Mahalo for speaking up.`, go: 'Continue',
      art: fxOn('law') ? rooster('bill-passed', { size: 132, cls: 'fx-mro', at: 1250 }) : '' }), 400);   // R-308 on trial: the lei blooming on the rooster
  },
};
