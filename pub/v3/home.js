// A person comes here to see the one thing worth doing now (B-1).
// Version 3's Home (?v3=1, R-362 Part 3; docs/requests/R-362/PLAN.md). One module, two shapes, read each time it is drawn:
//   The door, for someone who follows nothing yet (followsAnything() false). It replaces the welcome (step 0): a newcomer's
//   Home is never redirected into the steps (pub/app.js under v3). Ported from act.html's Home (one/home.js, R-360 part 6):
//   the rainbow-and-people drawing (art.js HELLO, its speech bubble moved beside the middle person's head), what HIPHI does in
//   one heading and one line, "Needs voices this week" with the one thing (pub/v3/pick.js: the page's only filled button,
//   A-3), "Or start with what you care about": four issues, each opening its page, then "Choose your issues" outlined (it
//   starts the steps at the topics, #/start/1) and "See all issues". Nothing is asked before a first action (C-1, C-11).
//   The private counts still record the arrival as the welcome did: 'arrive' / 'view' (visitlog.js, R-023 decision 8).
//   The returner, for someone who follows something: "Aloha, <name>." and one line; the same card; at most two plain lines
//   under it, the next thing ("Also: testimony on <name> closes Thu 9:30 AM") and a later visit's one ask (nextask.js
//   pickAsk, a quiet line rather than a full page under v3); then "See this week". No slider, no pager and no Your issues
//   block: This week (pub/v3/week.js) has those, and Home says each thing once (A-14). The tour does not run (app.js).
// Between sessions nothing moves, so the card is the calm Home's (pub/calm/home.js offSession) in short: the break, what
// HIPHI backed that became law, and the one thing to do then, knowing who represents you.
// Laptop: one 640px reading column; from 1100px the card stands beside the issues, the drawing beside the heading.
import { S, app, esc, icon, nick, billPath, wiz, followsAnything, issueBills, issuesOf, recommendations, sessionInfo, ensureRecapPool,
  winsIn, followedIssues, issueIcon, DEMO, HST } from '../core.js';
import { btn, skeleton } from '../ui.js';
import { HELLO, issueBand } from '../art.js';
import { logVisit } from '../visitlog.js';
import { oneThing, nextThings, cardHtml, wireCard, sendBy, issueOfThing } from './pick.js';

// The drawing as act.html's Home draws it: the speech bubble moves from the top right of the sky to beside the middle person's
// head, so it stays inside the band that shows (home.css crops the sky) and clear of the practice copy's chip.
const ART = HELLO.replace('<rect x="256" y="30"', '<g class="bubble" transform="translate(-56 56)"><rect x="256" y="30"')
  .replace(/(<path d="M279 49\.1C[^>]*\/>)/, '$1</g>');
const ISSUES = 4;
const plural = (k, one, many = one + 's') => `${k} ${k === 1 ? one : many}`;
const myName = () => { try { return (wiz().name || JSON.parse(localStorage.getItem('hiphi_me') || '{}').name || '').trim().split(/\s+/)[0]; } catch { return ''; } };
const districtsKnown = () => { try { return !!(JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || S.profile?.senate_district); } catch { return false; } };
const arrow = () => icon('arrow-right', { size: '1em' });

// ---- the door's four issues (act.html's fourIssues over S.issues): the ones with the most bills needing voices this week,
// then by name; only issues with bills this year, so the issue's page always has something to show.
function soonCounts() {
  const n = new Map(), now = Date.now();
  for (const r of recommendations(200)) {
    const h = r.hearing; if (!h || Date.parse(h.testimony_deadline || h.scheduled_at) <= now) continue;
    for (const i of issuesOf(r.b)) n.set(i.id, (n.get(i.id) || 0) + 1);
  }
  return n;
}
// The card's own issue is left out: it is already on the screen, just above (A-14).
function fourIssues(skip) {
  const n = soonCounts();
  return (S.issues || []).filter(i => i.slug && issueBills(i).length && i.id !== skip?.id)
    .map(i => ({ i, n: n.get(i.id) || 0 }))
    .sort((x, y) => y.n - x.n || x.i.name.localeCompare(y.i.name))
    .slice(0, ISSUES);
}
function issueRows(skip) {
  return `<ul class="v3h-rows" role="list">${fourIssues(skip).map(({ i, n }) => {
    const band = issueBand(i, DEMO), th = String(band || '').startsWith('<img') ? band : `<span class="v3h-ic">${icon(issueIcon(i.icon))}</span>`;
    const cat = (S.cats || []).find(c => c.key === i.category)?.name || '';
    const sub = n ? `${plural(n, 'bill')} need${n === 1 ? 's' : ''} voices this week` : cat;
    return `<li><a class="v3h-row" href="#/issue/${esc(i.slug)}" data-v3h-issue="${esc(i.slug)}"><span class="v3h-th">${th}</span>
      <span class="v3h-t"><b>${esc(i.name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</a></li>`;
  }).join('')}</ul>`;
}

// ---- between sessions (calm Home's offSession, in short) ----
function offWords(si) {
  const yr = si.recapYear, next = si.nextOpen;
  const opens = next ? new Date(next + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST }) : '';
  ensureRecapPool(yr); const wins = winsIn(yr);
  return `The Legislature is on break${opens ? ` until ${opens}` : ''}.${wins && wins.length ? ` In ${yr}, ${plural(wins.length, 'bill')} HIPHI backed became law.` : ''}`;
}
function offCard(si, hl) {
  const known = districtsKnown(), nextYr = si.nextOpen ? +si.nextOpen.slice(0, 4) : si.recapYear + 1;
  const [title, say] = known ? [`Say aloha before ${nextYr}`, `Lawmakers are writing their ${nextYr} bills now. A short hello from someone in their district tells them what you care about.`]
    : ['Get ready for January', 'Know who represents you before the first hearing.'];
  return `<section class="card v3-card v3h-off" aria-labelledby="v3h-off-h"><${hl} class="v3c-h" id="v3h-off-h">${esc(title)}</${hl}>
    <p class="v3c-sum">${esc(say)}</p>
    ${btn(known ? 'Write to my legislators' : 'Find my legislators', { kind: 'primary', icon: known ? 'mail' : 'landmark', full: true, href: '#/legislators', cls: 'v3c-go' })}
    <p class="v3c-time small">${known ? 'About 2 minutes' : 'About 30 seconds'}</p></section>`;
}

// ---- the returner's quiet lines ----
// A later visit's one ask (pub/nextask.js, R-237): a full page on other versions; here one line to that same page (plan
// collision 2, C-16). nextask.js is fetched after Home is drawn, then Home is drawn again with its line.
const ASK_WORDS = { legs: 'Find your lawmakers', alerts: 'Save your profile', title: 'Add a title to your letters', issues: 'See the new issues',
  learn: 'How a bill becomes law, in three moments', share: 'Bring a friend along', phone: 'Keep the tracker on your phone' };
let askMod = null, askAsked = false;
function askLine() {
  if (!askMod) {
    if (!askAsked) { askAsked = true; import('../nextask.js').then(m => { askMod = m; if (document.querySelector('#main .v3h-back')) app.render(); }).catch(e => console.error(e)); }
    return '';
  }
  let k = ''; try { k = askMod.pickAsk(); } catch (e) { console.error(e); }
  return k && ASK_WORDS[k] ? `<p class="v3h-line"><a href="#/next/${esc(k)}" data-v3h-ask="${esc(k)}">${esc(ASK_WORDS[k])}${arrow()}</a></p>` : '';
}
// The next thing after the card's, one plain line: "Also: testimony on Safe routes to school closes Thu 9:30 AM".
function alsoLine() {
  const o = nextThings(1)[0]; if (!o) return '';
  const name = nick(o.b) || o.b.bill_number;
  const words = o.kind === 'testimony' && o.at ? `Also: testimony on ${name} closes ${sendBy(o.at).text.replace(/^Send testimony by /, '')}` : `Also: ${name} needs a hearing`;
  return `<p class="v3h-line"><a href="${esc(billPath(o.b))}">${esc(words)}${arrow()}</a></p>`;
}

// ---- the two shapes ----
function door(si) {
  const on = si.phase === 'in', o = on ? oneThing() : null;
  return `<div class="v3h v3h-door">
    <header class="v3h-top"><div class="v3h-art">${ART}</div>
      <div class="v3h-words"><h1 class="v3h-h1" id="v3h-h">Speak up for a healthier Hawaiʻi</h1>
      <p class="lede">We follow the health bills at the Capitol and tell you when your voice counts.</p></div></header>
    <div class="v3h-cols">
      <section class="v3h-now" aria-labelledby="v3h-now-h"><h2 class="v3h-h2" id="v3h-now-h">${on ? 'Needs voices this week' : 'Between sessions'}</h2>
        ${on ? '' : `<p class="v3h-note">${esc(offWords(si))}</p>`}
        ${on ? cardHtml(o, { hl: 'h3' }) : offCard(si, 'h3')}</section>
      <section class="v3h-care" aria-labelledby="v3h-care-h"><h2 class="v3h-h2" id="v3h-care-h">Or start with what you care about</h2>
        ${issueRows(issueOfThing(o))}
        <div class="v3h-pick">${btn('Choose your issues', { kind: 'secondary', icon: 'list-checks', href: '#/start/1', attrs: { 'data-v3h-choose': '' } })}<span class="small">About 2 minutes</span></div>
        <p class="v3h-all"><a href="#/find">See all issues${arrow()}</a></p></section>
    </div></div>`;
}
function returner(si) {
  const name = myName(), hi = `Aloha${name ? `, ${esc(name)}` : ''}.`, on = si.phase === 'in';
  if (!on) return `<div class="v3h v3h-back"><header class="v3h-hello"><h1 class="v3h-hi" id="v3h-h"><b>${hi}</b> <span>${esc(offWords(si))}</span></h1></header>
    ${offCard(si, 'h2')}<div class="v3h-lines">${askLine()}</div><p class="v3h-week"><a href="#/bills">See your issues${arrow()}</a></p></div>`;
  const o = oneThing(), n = followedIssues().length;
  const line = o ? 'Here’s how you can help.' : `We keep watch on ${n ? plural(n, 'issue') : 'what'} you follow.`;
  const lines = o ? alsoLine() + askLine() : askLine();
  return `<div class="v3h v3h-back"><header class="v3h-hello"><h1 class="v3h-hi" id="v3h-h"><b>${hi}</b> <span>${line}</span></h1></header>
    ${cardHtml(o, { hl: 'h2' })}
    ${lines ? `<div class="v3h-lines">${lines}</div>` : ''}
    <p class="v3h-week"><a href="#/bills">See this week${arrow()}</a></p></div>`;
}

// The arrival on the door, counted once a page load (the welcome's 'arrive' / 'view', start.js track: path 'in', 'off' or 'link').
let counted = false;
const path = () => wiz().via ? 'link' : sessionInfo().phase !== 'in' ? 'off' : 'in';
const count = ev => { try { logVisit('arrive', ev, { path: path() }); } catch { /* never in the way */ } };

export default {
  tab: 'home',
  title: () => 'Home',
  render() {
    if (!S.featured || !S.pool) return skeleton(4);
    const si = sessionInfo();
    return followsAnything() ? returner(si) : door(si);
  },
  wire() {
    const root = document.querySelector('#main .v3h'); if (!root) return;
    wireCard(root);
    if (root.classList.contains('v3h-door')) {
      if (!counted) { counted = true; count('view'); }
      root.querySelector('[data-v3h-choose]')?.addEventListener('click', () => count('next'));
    }
  },
};
