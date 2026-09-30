// The bill page tour (R-062 Concept 2, Nate 9/29): three short tips over the real page, the first time anyone opens a
// bill. (1) what this is: the name, what it does, where HIPHI stands; (2) where it is now: the steps card; (3) how you
// can help: the page's real main button, lit and usable. A bill with nothing to do (stopped, became law, between
// sessions) points tip 3 at Follow instead. Shown once, to everyone, never during the first visit (#/start) and never
// over the "New here?" card someone gets on a shared link: they see the tour on their next bill page, or once they
// answer the card. Finished or skipped, it never comes back (hiphi_tour_bill; the sandbox's storage patch in core.js
// keeps its own _demo copy).
// It must never trap anyone: a tip whose part of the page is missing is left out, and with none there is no tour.
// app.js calls after(route) at the end of every render; this module finds the parts by the bill page's own classes
// (read only: bill.js draws them) and lives outside #app, so a redraw of the page underneath leaves it standing.
// The same tips, since 9/29, also show Home once in the version of the first visit that ends there (R-098, ?end=home,
// pub/variant.js): what you can do right now, your issues, and the Home tab to come back to. Each tour is a definition
// below (BILL, HOME): where it runs, when it may start, its tips and its storage name; the drawing is shared.
import { S, esc, icon, reduceMotion, wiz, CONSENT_KEY } from './core.js';
import { endHome } from './variant.js';
import { logVisit } from './visitlog.js';

const seenHere = new Set();   // storage can be blocked (a private window): then once per page load
function seen(d) { if (seenHere.has(d.key)) return true; try { return !!localStorage.getItem(d.key); } catch { return false; } }
function markSeen(d, how) { seenHere.add(d.key); try { localStorage.setItem(d.key, JSON.stringify({ how, at: new Date().toISOString() })); } catch { /* ignore */ } }

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const shown = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'; };
const wide = () => !!$('.bl-page.bl-wide');
const txt = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const spacedNum = () => txt($('.bl-top .bl-num')) || txt($('.bl-sidenum'));
// Nothing may cover the page but its own dialogs: the testimony walkthrough (#hp-dlg), a celebration, the newcomer's card.
// fx.js keeps its celebration element in the page, hidden, once it has played: only a showing one blocks a tour (it
// kept the bill tour from ever starting after the first visit's celebrations, found 9/29 with R-098).
const blocked = () => !!($('.bl-newbie') || $('dialog[open]') || $('.fx-moment:not([hidden])'));
const onBill = () => document.body.dataset.screen === 'bill' && !!$('.bl-page .bl-head');

// ---------------- the three tips, built from what the page shows ----------------
function kindWord(num) {
  const p = (/^[A-Z]+/.exec(num.replace(/\s/g, '')) || [''])[0];
  return { HB: ['a proposed law', 'HB means House Bill: it started in the House.'], SB: ['a proposed law', 'SB means Senate Bill: it started in the Senate.'],
    HR: ['a resolution', 'The House can adopt it to say what it thinks or asks for. It is not a law.'],
    SR: ['a resolution', 'The Senate can adopt it to say what it thinks or asks for. It is not a law.'],
    HCR: ['a resolution', 'The House and Senate can adopt it to say what they think or ask for. It is not a law.'],
    SCR: ['a resolution', 'The House and Senate can adopt it to say what they think or ask for. It is not a law.'] }[p] || ['a proposal at the Legislature', ''];
}
// How the bill's session ended, from the chip under its name (bill.js head()): '' while it can still move.
function ended() {
  const c = txt($('.bl-head .chips'));
  return /Became law|\bAdopted\b/.test(c) ? 'law' : /Goes to the voters/.test(c) ? 'ballot'
    : /Stopped this session|Not adopted this session/.test(c) ? 'stopped' : '';
}
function mainBtn() {
  const inBar = $$('.actionbar .btn.primary').find(shown);
  if (inBar) return inBar;
  return $$('.bl-side .btn.primary').find(shown) || null;
}
function followBtn() {
  const all = $$('[data-bl-followissue], [data-bl-unfollowissue], [data-bl-star], [data-bl-newfollow]').filter(shown);
  // The one by the bill's name first (a phone's issue line), then the top bar's star, the side panel, the bottom bar.
  return all.find(e => e.closest('.bl-head')) || all.find(e => e.closest('.bl-top')) || all.find(e => e.closest('.bl-side')) || all[0] || null;
}

function tips() {
  const num = spacedNum(), out = [];
  // 1. What this is
  const h1 = $('.bl-head h1');
  if (shown(h1)) {
    const [what, why] = kindWord(num), named = h1.classList.contains('bl-nick');
    const stance = /HIPHI/.test(txt($('.bl-head .chips'))), issue = shown($('.bl-head .bl-issue'));
    const parts = [named ? 'what it would do' : '', stance ? 'where <b>HIPHI</b> stands' : '', issue ? 'the issue it is part of' : ''].filter(Boolean);
    const under = parts.length ? `${named ? 'Under its name' : 'Under that'}: ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}.` : '';
    out.push({ key: 'what', els: () => [$('.bl-head h1'), $('.bl-head .bl-lede'), $('.bl-head .chips'), $('.bl-head .bl-issue')], top: true,
      h: 'What this bill is',
      p: `${num ? `<b>${esc(num)}</b> is ${what}.` : ''} ${esc(why)} ${named ? '' : 'The words at the top say what it would do. '}${under}`.replace(/\s+/g, ' ').trim() });
  }
  // 2. Where it is now
  if (shown($('.bl-status'))) {
    const lbl = txt($('.bl-status .bl-nowlbl')), dots = $('.bl-status .bl-dots'), end = ended();
    const res = /adoption/.test(dots?.getAttribute('aria-label') || ''), gov = /Governor/.test(txt(dots));
    const H = /^S/.test(num) ? ['Senate', 'House'] : ['House', 'Senate'];
    const steps = !dots ? '' : res ? 'Each dot is a step to being adopted.'
      : gov ? `Each dot is a step to becoming law: each ${H[0]} committee, then a ${H[0]} vote, the same in the ${H[1]}, then the Governor.` : 'Each dot is a step on its way.';
    const now = lbl.replace(/^Now:\s*/, '');
    const where = !now ? '' : end ? `This session: <b>${esc(now)}</b>.` : `Now: <b>${esc(now)}</b>.${/committee/i.test(now) ? ' Most bills stop in a committee.' : ''}`;
    out.push({ key: 'where', els: () => [$('.bl-status')], h: 'Where it is now', p: `${steps} ${where}`.trim() || 'This card says what happened to it last.' });
  }
  // 3. How you can help: the real main button, or Follow when nothing is moving
  const end = ended(), main = mainBtn(), fol = followBtn();
  const inSide = el => wide() && el.closest('.bl-side');
  // On a laptop the button sits in the side panel's card: light the card, so the deadline shows with it.
  // (with the bill's number above it, which the lit edge would otherwise cut through).
  const around = el => inSide(el) ? [$('.bl-side .bl-sidenum'), el.closest('.bl-side > section') || el.closest('.bl-side .card') || el] : [el];
  if (!end && main) {
    // "Testimony due Thu at 9:30 AM" from the hearing card (actions.js); a late or passed deadline is left out.
    const label = txt(main), dl = txt($('.bl-act .acard .due')), due = /\b(late|was due|passed)\b/i.test(dl) ? '' : (/\bdue (.+)$/i.exec(dl) || [])[1] || '';
    out.push({ key: 'help', live: true, els: () => { const m = mainBtn(); return m ? around(m) : []; }, button: () => mainBtn(),
      h: 'How you can help',
      p: `When there’s a way to help, ${wide() ? 'it shows here' : 'this button says what to do'}. For ${esc(num || 'this bill')}: <b>${esc(label)}</b>${due ? `, due ${esc(due)}` : ''}.`,
      p2: 'It’s a real button. Use it now, or come back to it later.' });
  } else if (fol) {
    const on = fol.getAttribute('aria-pressed') === 'true', issue = /issue/i.test(fol.getAttribute('aria-label') || txt(fol)) || fol.hasAttribute('data-bl-followissue') || fol.hasAttribute('data-bl-unfollowissue');
    const it = issue ? 'the issue' : 'it';
    const lead = end === 'stopped' ? 'This bill stopped for this session, but ideas like it often come back.' : end === 'law' ? 'This bill’s work is done.' : '';
    out.push({ key: 'follow', live: true, els: () => { const f = followBtn(); return f ? [f] : []; }, button: () => followBtn(),
      h: 'Keep up with it',
      // An issue's next bills come to its followers (R-018); a bill on its own only has its own news.
      p: on ? `You follow ${it}. We’ll tell you when there’s news or a way to help${issue ? ', next session too' : ''}.`
        : `${lead} Follow ${it} and we’ll tell you when there’s news or a way to help${issue ? ', next session too' : ''}.`.trim(),
      p2: on ? '' : 'It’s a real button. Tap it now if you like.' });
  } else if (main) {
    out.push({ key: 'next', live: true, els: () => { const m = mainBtn(); return m ? around(m) : []; }, button: () => mainBtn(),
      h: 'What you can do now',
      p: `Nothing is moving on ${esc(num || 'this bill')} right now. This button shows a useful next step: <b>${esc(txt(main))}</b>.`,
      p2: 'It’s a real button. Use it any time.' });
  }
  return out.filter(t => t.els().some(shown));
}

// ---------------- drawing ----------------
let T = null, pending = 0, raf = 0;
function union(els) {
  const r = els.filter(shown).map(e => e.getBoundingClientRect()); if (!r.length) return null;
  return { top: Math.min(...r.map(x => x.top)), left: Math.min(...r.map(x => x.left)), bottom: Math.max(...r.map(x => x.bottom)), right: Math.max(...r.map(x => x.right)) };
}
// The bars that stay on screen: the header (and on a bill, its top bar) above, the action bar (and on Home, the tab
// bar) below.
function safeArea(target) {
  const stuck = n => n && /sticky|fixed/.test(getComputedStyle(n).position) ? n.getBoundingClientRect().bottom : 0;
  const top = Math.max(0, ...T.def.above.map(q => stuck($(q))));
  const bar = T.def.below.map(q => $(q)).find(b => b && shown(b) && !(target && b.contains(target)));
  const bottom = bar ? bar.getBoundingClientRect().top : window.innerHeight;
  return { top, bottom };
}
const inFixed = el => !!el.closest('.actionbar, .bl-top, .hdr, .bl-side, nav.tabs');
function scrollFor(t) {
  const els = t.els().filter(shown); if (!els.length) return;
  if (t.top) { window.scrollTo(0, 0); return; }
  if (els.every(inFixed)) return;
  const r = union(els), s = safeArea(els[0]);
  const fits = r.top >= s.top + 8 && r.bottom + 180 <= s.bottom;
  if (!fits) window.scrollTo(0, Math.max(0, r.top + window.scrollY - s.top - 16));
}

function build() {
  const root = document.createElement('div'); root.className = 'tr'; root.setAttribute('data-tour', '');
  root.innerHTML = `<div class="tr-block" data-b="t"></div><div class="tr-block" data-b="r"></div><div class="tr-block" data-b="b"></div><div class="tr-block" data-b="l"></div>
    <div class="tr-block" data-b="c"></div><div class="tr-hole" aria-hidden="true"></div>
    <div class="tr-tip" role="dialog" aria-labelledby="tr-h" aria-describedby="tr-p" tabindex="-1"></div>`;
  document.body.appendChild(root);
  return root;
}
function draw() {
  const t = T.list[T.i], n = T.list.length, last = T.i === n - 1, tip = T.root.querySelector('.tr-tip');
  const dots = T.list.map((_, k) => `<i class="${k === T.i ? 'on' : ''}"></i>`).join('');
  tip.setAttribute('aria-modal', t.live ? 'false' : 'true');
  tip.innerHTML = `<p class="tr-k">${icon('lightbulb')}<span>Tip ${T.i + 1} of ${n} · ${esc(T.def.label)}</span></p>
    <h2 id="tr-h">${esc(t.h)}</h2><div id="tr-p"><p>${t.p}</p>${t.p2 ? `<p>${esc(t.p2)}</p>` : ''}</div>
    <div class="tr-foot">${last ? `<span class="tr-dots" aria-hidden="true">${dots}</span>` : `<button type="button" class="tr-btn tr-ghost" data-tr-skip>Skip tips</button><span class="tr-dots" aria-hidden="true">${dots}</span>`}
      <button type="button" class="tr-btn tr-go" data-tr-next>${last ? 'Done' : `Next${icon('arrow-right')}`}</button></div>`;
  tip.querySelector('[data-tr-skip]')?.addEventListener('click', () => finish('skip'));
  tip.querySelector('[data-tr-next]').addEventListener('click', next);
  T.root.classList.toggle('tr-live', !!t.live);
  // The page underneath is out of reach (taps, Tab, a screen reader) except on the last tip, whose button is the point.
  const app = document.getElementById('app'); if (app) app.inert = !t.live;
  scrollFor(t);
  T.root.classList.add('tr-moving'); clearTimeout(T.moveT); T.moveT = setTimeout(() => T && T.root.classList.remove('tr-moving'), 320);
  tip.classList.remove('tr-in'); void tip.offsetWidth; tip.classList.add('tr-in');
  place();
  tip.focus({ preventScroll: true });
}
function place() {
  if (!T) return;
  const t = T.list[T.i], els = t.els().filter(shown);
  if (!els.length) { skipMissing(); return; }
  const r0 = union(els), pad = t.live && els.length === 1 && els[0].matches('.btn, .iconbtn, button') ? 6 : 10;
  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const r = { top: r0.top - pad, left: Math.max(4, r0.left - pad), bottom: r0.bottom + pad, right: Math.min(vw - 4, r0.right + pad) };
  const hole = T.root.querySelector('.tr-hole'), round = els.length === 1 && els[0].matches('.btn, .iconbtn');
  Object.assign(hole.style, { top: r.top + 'px', left: r.left + 'px', width: (r.right - r.left) + 'px', height: (r.bottom - r.top) + 'px', borderRadius: round ? '999px' : '16px' });
  const set = (k, s) => Object.assign(T.root.querySelector(`[data-b="${k}"]`).style, s);
  set('t', { top: 0, left: 0, width: '100%', height: Math.max(0, r.top) + 'px' });
  set('b', { top: r.bottom + 'px', left: 0, width: '100%', bottom: 0 });
  set('l', { top: r.top + 'px', left: 0, width: Math.max(0, r.left) + 'px', height: (r.bottom - r.top) + 'px' });
  set('r', { top: r.top + 'px', left: r.right + 'px', right: 0, height: (r.bottom - r.top) + 'px' });
  set('c', { top: r.top + 'px', left: r.left + 'px', width: (r.right - r.left) + 'px', height: (r.bottom - r.top) + 'px' });
  // The tip: below the part it is about, else above, else (a laptop) beside it, else over the bottom of the window.
  const tip = T.root.querySelector('.tr-tip'), gap = 14, s = safeArea(els[0]);
  const wd = T.def.wide(), tw = Math.min(vw - 32, wd ? 380 : 560);
  tip.style.width = tw + 'px'; const th = tip.offsetHeight;
  const cx = (r.left + r.right) / 2, left = Math.min(Math.max(16, cx - tw / 2), vw - tw - 16);
  let where, top, lft = left;
  if (r.bottom + gap + th <= s.bottom - 8) { where = 'below'; top = r.bottom + gap; }
  else if (r.top - gap - th >= s.top + 8) { where = 'above'; top = r.top - gap - th; }
  else if (wd && r.left - gap - tw >= 16) { where = 'left'; lft = r.left - gap - tw; top = Math.min(Math.max(s.top + 8, r.top), vh - th - 8); }
  else if (wd && r.right + gap + tw <= vw - 16) { where = 'right'; lft = r.right + gap; top = Math.min(Math.max(s.top + 8, r.top), vh - th - 8); }
  else { where = 'over'; top = t.overTop ? s.top + 8 : Math.max(s.top + 8, s.bottom - th - 12); }
  tip.className = tip.className.replace(/\btr-(below|above|left|right|over)\b/g, '').trim() + ' tr-' + where;
  Object.assign(tip.style, { top: top + 'px', left: lft + 'px' });
  if (where === 'left' || where === 'right') tip.style.setProperty('--ay', Math.min(Math.max(20, (r.top + r.bottom) / 2 - top), th - 20) + 'px');
  else tip.style.setProperty('--ax', Math.min(Math.max(24, cx - lft), tw - 24) + 'px');
}
const replace = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(place); };
function skipMissing() {
  // The part this tip is about has gone (the page redrew into another shape): on to the next one there is, or stop.
  const k = T.list.findIndex((t, j) => j > T.i && t.els().some(shown));
  if (k < 0) { close(); return; }
  T.i = k; draw();
}
function next() { if (T.i >= T.list.length - 1) { finish('done'); return; } T.i++; draw(); }

function onKey(e) {
  if (!T) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish('esc'); return; }
  if (e.key === 'Tab') {
    const t = T.list[T.i], tip = T.root.querySelector('.tr-tip'), b = t.live && t.button && t.button();
    const ring = [...tip.querySelectorAll('button'), ...(b ? [b] : [])];
    const at = ring.indexOf(document.activeElement);
    e.preventDefault();
    ring[at < 0 ? (e.shiftKey ? ring.length - 1 : 0) : (at + (e.shiftKey ? -1 : 1) + ring.length) % ring.length]?.focus();
    return;
  }
  // The page's own shortcuts ("/" for search, "?" for help) wait until the tips are closed.
  if ((e.key === '/' || e.key === '?') && T.root.contains(document.activeElement)) e.stopPropagation();
}
// On the last tip the lit part is the real thing: using it ends the tour and does what it says.
function onClick(e) {
  if (!T) return;
  const t = T.list[T.i]; if (!t.live) return;
  if (t.els().some(el => el && el.contains(e.target))) finish('used', { keepFocus: true });
}

function start(def) {
  pending = 0;
  if (T || seen(def) || !def.on() || blocked()) return;
  const list = def.tips(); if (!list.length) return;
  T = { def, list, i: 0, back: document.activeElement, root: build() };
  if (reduceMotion()) T.root.classList.add('tr-still');
  window.addEventListener('keydown', onKey, true);
  document.addEventListener('click', onClick, true);
  window.addEventListener('scroll', replace, { passive: true });
  window.addEventListener('resize', replace);
  draw();
}
function close({ keepFocus = false } = {}) {
  if (!T) return;
  const back = T.back;
  window.removeEventListener('keydown', onKey, true);
  document.removeEventListener('click', onClick, true);
  window.removeEventListener('scroll', replace);
  window.removeEventListener('resize', replace);
  clearTimeout(T.moveT); T.root.remove(); T = null;
  const app = document.getElementById('app'); if (app) app.inert = false;
  if (!keepFocus) { const to = back && back.isConnected && back !== document.body ? back : document.getElementById('main'); to?.focus({ preventScroll: true }); }
}
function finish(how, o) { const d = T?.def; if (d) { markSeen(d, how); try { d.done?.(how); } catch { /* counting never gets in the way */ } } close(o); }

// ---------------- the tours ----------------
const BILL = { key: 'hiphi_tour_bill', label: 'Reading a bill', route: 'bill', on: onBill, wide, tips,
  above: ['.hdr', '.bl-page .bl-top'], below: ['.actionbar'], wants: () => true, delay: () => 450 };

// Home's tips (R-098) never start over a dialog or the testimony walkthrough.
const onHome = () => document.body.dataset.screen === 'home' && !!$('#main .hm-fin2');
const told = () => { if (S.session) return true; try { return !!(sessionStorage.getItem('hiphi_link_sent') || localStorage.getItem(CONSENT_KEY)); } catch { return false; } };
function homeTips() {
  const out = [], off = !!$('#main .hm-off'), rn = $('#main .hm-rightnow'), wd = shown($('.hnav'));
  // 1. What you can do right now, lit and usable (the fresh-eyes review, 9/29: a lit button that did nothing looked
  // broken at the person's keenest moment). Using it ends the tips and does what it says, like the bill tour's last tip.
  // Only when there is a real thing to do: "nothing needs you this week" is already said by the section itself.
  const card = rn && (rn.querySelector('.acard') || rn.querySelector('.hm-ready'));
  const mainBtnHere = () => { const c = $('#main .hm-rightnow .acard') || $('#main .hm-rightnow .hm-ready'); return c ? [...c.querySelectorAll('.btn.primary')].find(shown) || null : null; };
  if (shown(card) && mainBtnHere()) {
    // The card is taller than the space a phone leaves for a tip, so this tip sits over the top of it and leaves the
    // card's button in view. The deadline and the bill are on the card, so they are not said again (A-14).
    out.push({ key: 'now', overTop: true, live: true, button: mainBtnHere,
      els: () => [$('#main .hm-rightnow .hm-rnh'), $('#main .hm-rightnow .acard') || $('#main .hm-rightnow .hm-ready')],
      h: 'What you can do right now',
      p: `${off ? 'Between sessions, this is the one useful thing to do.' : 'This is the one thing due first.'} <b>${esc(txt(mainBtnHere()))}</b> is a real button: use it now, or come back to it.` });
  }
  // 2. Coming back: Home, the tab at the bottom of a phone or the link at the top of a laptop. Someone who gave no email
  // is told how to find the page again (the review: the Home tab only helps while this tab is open).
  const homeTab = () => [...document.querySelectorAll('nav.tabs a[href="#/"], .hnav a[href="#/"]')].find(shown) || null;
  if (homeTab()) out.push({ key: 'back', els: () => [homeTab()],
    h: 'Come back any time',
    p: `${off ? 'When the session opens, this page shows what you can do on your issues each week.' : 'This page changes as your bills move: new things you can do, and what happened after each hearing.'} ${wd ? 'The <b>Home</b> link at the top' : 'The <b>Home</b> tab at the bottom'} brings you back here.`,
    p2: told() ? 'Your reminder emails bring you back here too.' : wd ? 'To find it again later, bookmark this page.' : 'To find it again later, add this page to your home screen, or bookmark it.' });
  return out.filter(t => t.els().some(shown));
}
// Home, once, in the version of the first visit that ends there. It waits for the celebration to be seen: "Mahalo", the
// ticks rising in and the petals (the review: at 2.6 seconds the tips cut the high point short).
const HOME = { key: 'hiphi_tour_home', label: 'Your home page', route: 'home', on: onHome, wide: () => shown($('.hnav')), tips: homeTips,
  above: ['.hdr'], below: ['nav.tabs', '.actionbar'], wants: () => endHome() && !!wiz().finale, delay: () => reduceMotion() ? 1500 : 4500,
  // Counted privately with the first visit (visitlog.js): the tips finished, or skipped.
  done: how => logVisit('home', how === 'skip' || how === 'esc' ? 'skip' : 'done', { path: wiz().via ? 'link' : $('#main .hm-off') ? 'off' : 'in' }) };
const TOURS = [BILL, HOME];

// Called by app.js after every render. A tour waits a moment for its page to settle (a bill page redraws once its
// hearings and follower counts arrive; Home plays its celebration first) and checks again before starting.
export function after(route) {
  if (T) {
    if (route?.name !== T.def.route || !T.def.on()) close();
    else if (blocked()) close();
    else replace();
    return;
  }
  const def = TOURS.find(d => route?.name === d.route && !seen(d) && d.wants());
  if (!def) return;
  clearTimeout(pending); pending = setTimeout(() => start(def), def.delay());
}
export default { after };
