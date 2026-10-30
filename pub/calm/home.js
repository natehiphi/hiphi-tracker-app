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
// Version 2 (?v2=1, R-357 Part 3, Nate's pick of 30 Oct 2026, "keep the my issues tab"): the greeting and the slide are exactly the
// same. The box under the slide becomes "This week" (weekBlock): by day, each thing to do with its day, the bill's everyday name and
// what is due, a tap opening that bill's page (the slide's own bill is the lit row and needs no tap), then "Also due: N HIPHI asks"
// on issues they do not follow, which opens Find's "Needs voices this week", and "Edit my issues" as the box's last line. "See your
// 2026 session" moved to the You tab (more.js) and "See them all in My issues" went: the tab is one tap away. Between sessions the
// box is today's list of issues, with the same words, a title that is not "This week" and the same last line. Without the flag
// nothing of this runs.
// Still today's Home: Your session (#/recap) and following nothing. The first visit's ending is the calm Home too (R-248,
// Nate 10/11: "Yes, queue it"): on the page load that finished it the greeting says "Mahalo, <name>!" with the row of what
// they did today and the petals once (R-098's celebration, home.js finDid and finFx); a reload says Aloha. It used to hand
// the whole tab to today's Home, so every new person's first Home was the old one, its wins card included.
import { S, app, esc, icon, nick, headline, billPath, alive, openActions, dayWord, timeWord, dateLong, hstDay, hiT, HST,
  followedIssues, issueBills, outcomeOf, didKind, sessionInfo, followsAnything, wiz, settledOn, plainStatus, testimonyDraft,
  followSummary, winsIn, ensureRecapPool, isResolution, nudge, catOf, issueOf, DEMO, issuesOf, codesOf, agrees, asSentence, chairContacts, myActions, anyBill, anyHearing,
  issueFollowed, dismissed, suggestionList, recommendations } from '../core.js';
import { btn, chip, skeleton } from '../ui.js';
import { actionCard, wireActions, wireNudge, goingPlans, goingCard, moreRow, downloadCutoffIcs, remindWhen, remindDone, testimonyTime } from '../actions.js';
import { celebrate, bloom, swap, reduced, fxOn, rooster } from '../fx.js';
import { askedThisVisit } from '../alerts.js';
import { CAPITOL, issueBand, flower } from '../art.js';
import { GOAL } from './goals.js';
import today, { calmParts as P, wireExtras, sameIdea } from '../home.js';

// Where the pager stands in the deck (R-300), for this visit: the key of the slide the person moved to (null until they
// move, so the soonest leads), and its place, so the one after a slide they sent from takes its place.
S.cmAt ??= null;
S.cmIdx ??= 0;
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const V2 = () => !!app.v2?.();   // version 2 (R-357, ?v2=1; pub/app.js): read when a page is drawn, so v1 never touches any of it
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
// The reminder (R-212 #35, the Neighborhood Captain's Tuesday): a hearing they shared whose testimony closes today or
// tomorrow (actions.js remindWhen). Read from this browser's share marks, so a bill shared but not followed counts too. While
// their own testimony on it is still due, its slide leads and the reminder waits until they have sent theirs.
function remindAll(due) {
  const mine = new Set(due.map(x => x.h.id)), seen = new Set(), out = [];
  for (const a of myActions()) {
    if (a.kind !== 'share' || !a.hearing_id || mine.has(a.hearing_id) || seen.has(a.hearing_id)) continue;
    const h = anyHearing(a.hearing_id), b = h && anyBill(a.bill_id), w = b && remindWhen(b, h);
    if (w) { seen.add(h.id); out.push({ b, h, w }); }
  }
  return out;
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
// place on Home that names the bill (its row is lit, and says nothing of it), so reading the bill first is one tap.
const billLink = b => `<a class="cm-bill" href="${esc(billPath(b))}">${esc(spaced(b))}</a>`;
// The one detail line (R-300, Nate's "one detail line"): when it runs out, the time it takes, the bill ("By tomorrow 1:00 PM ·
// about 10 min the first time · HB 1780"). Amber only inside 24 hours, on the time alone (A-5).
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
  // HIPHI's side is hiphi_position (the public view has no "position"), either strength (R-333: an opposed bill's card
  // said "help it pass").
  const differs = agrees(b) === false, opp = /oppose/.test(b.hiphi_position || '');
  const hears = `${whoHears(h.committee)} ${codesOf(h.committee).length > 1 ? 'hear' : 'hears'} it ${dayLong(h.scheduled_at)}${late ? ` at ${time(h.scheduled_at)}` : ''}.`;
  const why = e.why ? asSentence(e.why).replace(/([^.!?])$/, '$1.') + ' ' : '';
  const ask = late ? 'Late testimony is still taken, marked late.'
    : differs ? 'You see this one differently from HIPHI, and you can still tell them what you think.'
    : b.hiphi_action ? esc(b.hiphi_action) : `A short note from you can help ${opp ? 'stop it' : 'it pass'}.`;
  const dl = late ? h.scheduled_at : h.testimony_deadline, warn = Date.parse(dl) - Date.now() < 864e5;
  // The time is the button's: testimony says its one promise (actions.js testimonyTime), the quick email keeps "about 2 min".
  const writes = /data-helper/.test(p.go) ? testimonyTime() : /data-mailwalk/.test(p.go) ? 'about 2 min' : '';
  return { hl, id: 't-' + h.id, art: artOf(b), title: goalOf(b), say: `${why}${esc(hears)} ${ask}`,
    detail: detailLine(`${late ? 'Late until' : 'By'} ${byWhen(dl)}`, warn, writes, b), before: p.before, go: p.go, after: p.after, mk: ck, mw: 'mw-' + h.id };
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
// The reminder as a slide: one question for a heading (Nate's words, R-212 #35), the friends they asked in the sentence, the
// deadline on the detail line, "Remind your friends" (the sheet, its words a reminder: askfriend.js; share-2, not the alerts'
// bell, since it goes to them) and "Not now" under it, which brings it back once on the closing day.
function remindParts(c, e, hl) {
  const { b, h, w } = e.x, dl = h.testimony_deadline, ck = `${b.id}|${h.id}`;
  return { hl, id: 'cm-rm-' + h.id, art: artOf(b), title: `Closes ${w}. Send a reminder?`,
    say: esc(`You asked friends to send testimony on ${nameOf(b)}. A short reminder before it closes helps the ones who meant to write.`),
    detail: detailLine(`By ${byWhen(dl)}`, Date.parse(dl) - Date.now() < 864e5, '', b),
    go: btn('Remind your friends', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-cm-remind': ck } }),
    more: btn('Not now', { kind: 'text', sm: true, attrs: { 'data-cm-remno': `${h.id}|${w}` } }) };
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
  const parts = e => e.kind === 'ask' ? askParts(c, e, hl) : e.kind === 'remind' ? remindParts(c, e, hl) : dueParts(c, e, hl, e === c.entry);
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
// A reminder to friends (R-212 #35) takes its place by its deadline, after their own testimony due at the same moment.
function deckOf(due, late, asks, reminds = []) {
  const on = kind => x => ({ kind, x, b: x.b, key: kind === 'ask' ? 'ask|' + x.b.id : kind === 'remind' ? 'remind|' + x.h.id : skipKey(x),
    t: kind === 'ask' ? hiT(x.st.deadline.date) : Date.parse(kind === 'late' ? x.h.scheduled_at : x.h.testimony_deadline) });
  const timed = [...due.map(on('due')), ...(due.length ? [] : late.map(on('late'))), ...asks.map(on('ask')), ...reminds.map(on('remind'))].sort((x, y) => x.t - y.t);   // stable: a tie stays testimony first
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
    return { g: t - now < 7 * 864e5 ? 'due' : 'hearing', t, warn: !!dl && t - now < 864e5, text: `Your letter is started · ${dl ? `due ${when(dl)}` : `hearing ${when(dr.h.scheduled_at)}`}`,
      week: { b: dr.b, iso: dl || dr.h.scheduled_at, line: `Your letter is started · ${dl ? 'due' : 'hearing'} ${time(dl || dr.h.scheduled_at)}` } }; }
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
    return { g: 'hearing', t: Date.parse(h.scheduled_at), fresh: isNew(Date.parse(h.notice_posted_at || 0)), text: `${did ? `${did} · hearing` : 'Hearing'} ${when(h.scheduled_at)}`,
      week: { b, iso: h.scheduled_at, line: `${did ? `${did} · Hearing` : 'Hearing'} ${time(h.scheduled_at)}` } }; }
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
// What a tap does is written on the row (A-12; R-357 Light fixes f, Nate's yes 30 Oct): a row with something due moves the slide to it
// (decision 5a), so it ends in the word "Show" in link blue; a chevron promises a new page, so only the rows that open the issue's
// page keep one. The slide's own row opens its issue too, and the lit background marks it, so it has no line saying so.
const rowHtml = r => { const pick = r.pick && !r.on;
  return `<li><a class="cm-row${r.on ? ' on' : ''}" href="${esc(r.href)}"${pick ? ` data-cm-pick="${esc(r.pick)}"` : ''}><span class="cm-rtext"><span class="cm-rname">${esc(r.name)}${r.fresh ? '<span class="cm-new" title="New since your last visit"><span class="sr"> New since your last visit</span></span>' : ''}</span>
    ${r.text ? `<span class="cm-rstat${r.warn ? ' warn' : ''}">${whole(esc(r.text))}</span>` : ''}</span>${pick ? '<span class="cm-show">Show<span class="sr"> on the slide</span></span>' : icon('chevron-right', { cls: 'cm-chev' })}</a></li>`; };
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
    <ul class="cm-rows" role="list">${rows.map((r, n) => long && n >= FOLD ? rowHtml(r).replace('<li>', '<li data-cm-more hidden>') : rowHtml(r)).join('')}${V2() ? editRow : ''}</ul>
    ${long ? btn(`Show all your ${noun}${dueAfter(rows)}`, { kind: 'text', icon: 'chevron-down', cls: 'hm-link cm-showall', attrs: { 'data-cm-showall': '' } }) : ''}
    ${V2() ? '' : btn('See them all in My issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/bills', cls: 'hm-link cm-all', attrs: long ? { 'data-cm-more': '', hidden: '' } : {} })}</section>`;
}

// ---------------- 3b. this week (version 2, R-357 Part 3) ----------------
// The box under the slide as the week, by day (Nate's pick of 30 Oct 2026, the mock's "Moderate"; the walk of 28 Oct found Your issues
// said what the My issues tab says, so two doors led to one room). A row is one thing: a day, the bill's everyday name, what is due. A
// tap opens that bill's page, not the slide (v1 keeps decision 5a, a tap moves the slide); the slide's own bill is the lit row, with
// no chevron, since it is the slide above. An issue with nothing to do keeps its row, with where it stands (as v1's), after the days,
// so the box still holds one row for every issue (A-23). Then one row for HIPHI's asks on issues they do not follow, and the link to
// edit what they follow: the last line of the box.
// "Edit my issues" opens My issues in its edit state. That screen draws its Edit button and keeps the state in S.rcEdit, which it
// clears whenever it opens from another screen, so Home cannot set it first: it asks for the page and presses the button once it is
// there (wireWeek).
const editRow = `<li class="cm-editrow">${btn('Edit my issues', { kind: 'text', href: '#/bills', cls: 'hm-link cm-edit', attrs: { 'data-hm-edit': '' } })}</li>`;
// "Tue" within the week, "Today", "Mar 30" further out (the mock's labels); the box sets them in small capitals.
const dayTag = iso => { const d = dayShort(iso); return d === 'today' ? 'Today' : d === 'tomorrow' ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : d; };
// A time never breaks across lines in a row ("1:00 / PM"), as whole() keeps a day and its time.
const keepTime = t => t.replace(/\b(\d{1,2}:\d{2} [AP]M)/g, '<span class="cm-when">$1</span>');
const NEWDOT = '<span class="cm-new" title="New since your last visit"><span class="sr"> New since your last visit</span></span>';
function weekRowHtml(r) {
  const inner = `<span class="cm-day"${r.day ? '' : ' aria-hidden="true"'}>${esc(r.day || '')}</span><span class="cm-rtext"><span class="cm-rname">${esc(r.name)}${r.fresh ? NEWDOT : ''}</span>
    ${r.text ? `<span class="cm-rstat${r.warn ? ' warn' : ''}">${keepTime(esc(r.text))}</span>` : ''}</span>`;
  return r.on ? `<li><div class="cm-row cm-wk on" aria-current="true">${inner}</div></li>`
    : `<li><a class="cm-row cm-wk" href="${esc(r.href)}">${inner}${icon('chevron-right', { cls: 'cm-chev' })}</a></li>`;
}
// How many HIPHI asks on issues the person does not follow have a hearing this week: the rows Find's "Needs voices this week" draws
// (pub/rec/find.js voices(), written there for that page: the same short list and ranking from core.js, the same rule that the
// hearing is within 7 days, a bill the person put aside is left out, an issue followed leaves out its bills, one row an issue or a bill
// on no issue). It never records a showing (noteShown), since nothing here is shown as a suggestion, and nothing between sessions.
// The count is the page it opens: if the two ever disagreed Find's would win, so the row is drawn only when the count is above 0.
function alsoDue() {
  if (sessionInfo().phase !== 'in') return 0;
  const skip = dismissed(), now = Date.now(), week = now + 7 * 864e5, seen = new Set();
  const ok = r => { const h = r.st?.hearing; return !!h && !skip.has(r.b.id) && Date.parse(h.scheduled_at) > now && Date.parse(h.scheduled_at) < week; };
  const add = r => { const on = issuesOf(r.b); if (on.some(issueFollowed)) return; seen.add(on[0] ? on[0].id : 'b:' + r.b.id); };
  suggestionList(4).filter(ok).forEach(add);
  recommendations(200).filter(ok).forEach(add);
  return seen.size;
}
// The week's rows. todo: what the deck's slides are made of (testimony due, late testimony, a hearing ask), one row each for the bill,
// twins as one (the deck's own list), so nothing due is left off the page (B-14). Every other issue, and every bill followed on its
// own, keeps one row: a hearing ahead (or a letter started for one) goes by its day with the bill named; where it stands otherwise
// has no day and comes after, in v1's order. The slide's own bill is the lit row.
function weekRows(c, iss, own, entry) {
  const now = Date.now(), out = [], row = (kind, key, t, iso, b, text, warn, extra = {}) => out.push({ kind, key, t, day: dayTag(iso), name: nameOf(b), text, warn, href: billPath(b), b, ...extra });
  for (const x of c.due) { const dl = x.h.testimony_deadline, t = Date.parse(dl);
    row('due', skipKey(x), t, dl, x.b, `${testimonyDraft(x.h) ? 'Your letter is started · due' : 'Testimony due'} ${time(dl)}`, t - now < 864e5, { g: 'due', fresh: isNew(Date.parse(x.h.notice_posted_at || 0)) }); }
  for (const x of c.late) { const dl = x.h.scheduled_at, t = Date.parse(dl);
    row('late', skipKey(x), t, dl, x.b, `Late testimony until ${time(dl)}`, t - now < 864e5, { g: 'due' }); }
  // A hearing ask for the twin of a bill whose late testimony is a row above says the same name again (oneIdeaAsks takes out only the twins of
  // testimony still due), so it has no row (its slide is still in the deck, and no row is lit while the pager is on it): each bill named once (A-14).
  for (const x of c.asksAll) { if (c.late.some(l => sameIdea(l.b, x.b))) continue;
    const at = hiT(x.st.deadline.date) + 12 * 36e5, chairs = chairContacts(x.st.committee).length > 1 ? 'chairs' : 'chair';
    row('ask', 'ask|' + x.b.id, at, x.st.deadline.date + 'T12:00:00-10:00', x.b, `Ask the ${chairs} for a hearing`, at - now < 864e5, { g: 'needs' }); }
  const has = new Set(out.map(r => r.b.id));
  for (const u of [...iss.map(i => ({ i, ids: new Set(issueBills(i)) })), ...own.map(b => ({ b, ids: new Set([b.id]) }))]) {
    if ([...u.ids].some(id => has.has(id))) continue;   // the unit's bill is already a row above
    const st = stateOf(u.ids, c);
    if (st.week) row('hearing', 'hearing|' + st.week.b.id, st.t, st.week.iso, st.week.b, st.week.line, false, { g: st.g, fresh: st.fresh });
    else out.push({ kind: 'issue', g: st.g, rank: st.rank, i: u.i, name: u.i ? u.i.name : headline(u.b), text: u.b ? `${spaced(u.b)} · ${st.text}` : st.text, fresh: st.fresh,
      href: u.i ? `#/issue/${u.i.slug}` : billPath(u.b), b: u.b });
  }
  // By day. A long list puts what is to do first, so the fold hides a hearing before it hides something due (B-14).
  const dated = out.filter(r => r.t != null).sort((x, y) => x.t - y.t), quiet = out.filter(r => r.t == null).sort(byImportance);
  const todo = r => r.g === 'due' || r.g === 'needs', long = out.length > FOLD;
  const rows = [...(long ? [...dated.filter(todo), ...dated.filter(r => !todo(r))] : dated), ...quiet];
  for (const r of rows) r.on = !!entry && r.key === entry.key;
  return rows;
}
function weekBlock(rows, also) {
  if (!rows.length) return '';
  const long = rows.length > FOLD;
  const more = long ? `<li class="cm-showrow">${btn(`Show all your issues${dueAfter(rows)}`, { kind: 'text', icon: 'chevron-down', cls: 'hm-link cm-showall', attrs: { 'data-cm-showall': '' } })}</li>` : '';
  const li = (r, n) => { const h = weekRowHtml(r); return long && n >= FOLD ? h.replace('<li>', '<li data-cm-more hidden>') : h; };
  const alsoRow = also ? `<li><a class="cm-row cm-wk cm-also" href="#/find" data-hm-voices><span class="cm-day">Today</span><span class="cm-rtext"><span class="cm-rname">Also due: ${plural(also, 'HIPHI ask')}</span>
    <span class="cm-rstat">On issues you don’t follow</span></span>${icon('chevron-right', { cls: 'cm-chev' })}</a></li>` : '';
  return `<section class="cm-issues cm-week" aria-labelledby="cm-iss-h"><h2 id="cm-iss-h" class="cm-h">This week</h2>
    <ul class="cm-rows" role="list">${rows.map((r, n) => (long && n === FOLD ? more : '') + li(r, n)).join('')}${alsoRow}${editRow}</ul></section>`;
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
  const line = ['due', 'late', 'ask', 'remind'].includes(c.card.kind) ? 'Here’s how you can help.'
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
  const deck = deckOf(due, late, asksAll, remindAll(due)), at = placeIn(deck), entry = deck[at] || null;
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
  S.cmKeys = deck.map(e => e.key); S.cmMk = entry ? (entry.kind === 'ask' || entry.kind === 'remind' ? entry.key : `${entry.b.id}|${entry.x.h.id}`) : null;
  const iss = followedIssues(), own = looseBills().filter(b => b.id !== card.bill?.id);
  // The slide's own issue: its row is lit and stays where it ranks; it says only what else on it is due (nothing due is left off
  // the page, B-14), not that it is the slide's (R-357 Light fixes f: the lit background says so).
  const onSlide = ['due', 'late', 'ask'].includes(card.kind) ? card.bill.id : null;
  const slideRow = (i, st) => { const ids = issueBills(i); if (!onSlide || !ids.includes(onSlide)) return st;
    const more = due.filter(x => ids.includes(x.b.id) && x.b.id !== onSlide).length;
    return { ...st, on: true, warn: false, text: more ? `${more} more due this week` : '' }; };
  // Version 2: the week by day (weekRows), the slide's own bill the lit row. Without the flag, one row an issue as ever.
  const v2 = V2(), lit = onSlide ? entry : null;
  const rows = (v2 ? weekRows(c, iss, own, lit) : [...iss.map(i => slideRow(i, issueRow(i, c))), ...own.map(b => billRow(b, c))].sort(byImportance))
    // Nothing is new seconds after the first visit: everything on the page was just seen there.
    .map(r => ({ ...r, fresh: !welcome && r.fresh }));
  c.freshN = rows.filter(r => r.fresh).length; c.noun = !iss.length && looseBills().length ? 'bills' : 'issues';   // someone who follows only bills has no issues

  const head = greeting(c);
  S.cmMoments = c.moments;
  S.cmShown = card.kind === 'due' || card.kind === 'late' ? { b: card.items[0].b, h: card.items[0].h } : null;
  // Version 2: "See your 2026 session" is a row on the You tab (more.js), not a line here.
  const lines = [welcome || v2 ? '' : P.sessionLink(si.yr), P.profileLine()].filter(Boolean).join('');
  return `<div class="hm cm${welcome ? '' : ' cm-met'}${finCls(welcome)}${v2 ? ' hm-v2' : ''}">
    ${head}
    ${theSlide(c)}
    ${v2 ? weekBlock(rows, alsoDue()) : issuesBlock(rows)}
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
    : `<p class="cm-hi"><b>Aloha${name ? `, ${esc(name)}` : ''}.</b> <span>${lede}</span></p>${welcome || V2() ? '' : P.sessionLink(yr)}`;   // version 2: the session is a row on You (more.js)
  return `<div class="hm cm cm-off${finCls(welcome)}${V2() ? ' hm-v2' : ''}">
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
// order, without the slide (so no row is the slide's), so the two pages never disagree about where one stands.
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
// Version 2's controls (R-357 Part 3), wired after the slide's own (wireActions). Home draws these under ?v2=1 only.
// Something a person opened from Home has to be waited for: the next screen's module and data come lazily, so each wait looks for the
// thing on the page asked for until it is there, and stops when the person has gone somewhere else or after six seconds.
function whenThere(find, then, here) {
  const t0 = performance.now(), tick = () => { const el = find(); if (el) return then(el); if (performance.now() - t0 < 6000 && here()) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
function wireWeek(root) {
  // The slide's letter buttons (its testimony button, "Finish sending your testimony" when a letter is started, the quick email, and the same
  // two inside More ways to help): the new three-screen letter, app.openLetter2(bill, kind, opts) (R-357 Part 2; opts { resume: true } for a
  // letter already started), the moment that sheet exists; until then today's walkthroughs, which wireActions put on them. Looked for when
  // the button is pressed, since another module may add it after Home was drawn.
  root.querySelectorAll('.cm-slide [data-helper], .cm-slide [data-mailwalk]').forEach(el => {
    const was = el.onclick, email = el.hasAttribute('data-mailwalk'), [bid, hid] = email ? el.dataset.mailwalk.split('|') : [el.dataset.bill, el.dataset.helper];
    el.onclick = e => {
      const b = anyBill(bid);
      if (!(V2() && app.openLetter2 && b)) return was?.call(el, e);
      app.openLetter2(b, email ? 'email' : 'testimony', !email && testimonyDraft(anyHearing(hid)) ? { resume: true } : undefined);
    };
  });
  // "Edit my issues": My issues, then its Edit button once it is drawn (see editRow).
  root.querySelectorAll('[data-hm-edit]').forEach(el => el.addEventListener('click', () => whenThere(() => document.querySelector('#main [data-rc-edit]'),
    b => { if (b.getAttribute('aria-label') !== 'Done editing') b.click(); }, () => /^#\/bills/.test(location.hash))));
  // "Also due": Find, then down to its "Needs voices this week" (the heading has an id; the page's scroll padding clears the header).
  root.querySelectorAll('[data-hm-voices]').forEach(el => el.addEventListener('click', () => whenThere(() => document.getElementById('fd-voices-h'),
    h => { h.setAttribute('tabindex', '-1'); h.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); h.focus({ preventScroll: true }); }, () => /^#\/find/.test(location.hash))));
}
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
    // Not after the one ask of the visit was shown and skipped, even across a reload (alerts.js askedThisVisit; C-3, R-357 Light fixes h).
    if (!document.querySelector('#main .cm') && welcome && !S.nudge && !S.session && !P.alertsGiven() && !askedThisVisit()) nudge('follow');
    return si.phase === 'in' ? inSession(si, { welcome, fin }) : offSession(si, { welcome });
  },
  wire(route) {
    if (delegated) { today.wire && today.wire(route); return; }
    const root = document.querySelector('#main .cm'); if (!root) return;
    wireActions(root); wireNudge(root); wireExtras(root); P.finFx();
    if (V2()) wireWeek(root);
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
    // The reminder (R-212 #35): the sheet with the reminder's words; sent it leaves the deck; "Not now" the day before brings it back on the day.
    root.querySelectorAll('[data-cm-remind]').forEach(el => el.onclick = async () => {
      const [bid, hid] = el.dataset.cmRemind.split('|'), b = anyBill(bid), h = anyHearing(hid); if (!b || !h) return;
      const how = await (await import('../askfriend.js')).askFriend({ b, h, remind: true }); if (how) app.render(); });
    root.querySelectorAll('[data-cm-remno]').forEach(el => el.onclick = () => { const [hid, w] = el.dataset.cmRemno.split('|'); remindDone(hid, w); app.render();
      requestAnimationFrame(() => goal()?.focus({ preventScroll: true })); });
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
