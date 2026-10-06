// What a plan's later visits bring on Home (R-164; the doc "Onboarding: five plans", "After the first visit"): one card
// at the top of Home per visit, each the next small thing the plan left for later, never more than one, each easy to
// wave away for good (P-5: no guilt, no streaks; C-8: the first visit never runs again). Plan 5 is built on these
// ("a light start, then one small thing each time you come back"); the other plans use the same cards for what their
// first visit did not cover. Only for a browser whose first visit was a plan (wiz().plan, set by start.js finish()), and
// not during that first visit's own Home (the welcome there is the finale's).
// Each card disappears once it is done (legislators found) or opened, or when "Not now" is pressed; the next visit
// shows the next one.
import { S, DEMO, esc, icon, wiz } from './core.js';
import { btn } from './ui.js';
import { doShare } from './actions.js';

const KEY = 'hiphi_later';   // { [card]: 'done' | 'no' }, and the day the current card was first shown
const kept = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const keep = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode: the card comes back next visit */ } };
const welcomed = () => { try { return sessionStorage.getItem('hiphi_welcome') === '1'; } catch { return false; } };
const legsKnown = () => { try { return !!(JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || S.profile?.senate_district); } catch { return false; } };

const CARDS = {
  legs: { icon: 'landmark', title: 'Who speaks for you?', sub: 'Find your two legislators in about 30 seconds. Lawmakers listen closest to the people they represent.',
    label: 'Find my legislators', href: '#/legislators', done: legsKnown },
  learn: { icon: 'route', title: 'The three moments when you can help', sub: 'One minute, on a real bill: when a short note helps most, and why.',
    label: 'Show me', href: '#/learn/bill' },
  share: { icon: 'share-2', title: 'Bring a friend along', sub: 'Bills move when more neighbors speak up. Send the tracker to one person who cares about what you do.',
    label: 'Share the tracker', act: 'share' },
};
// Each plan's order: what its first visit left out comes first.
const ORDER = { p1: ['legs', 'learn', 'share'], p2: ['legs', 'share'], p3: ['learn', 'share'], p4: ['legs', 'learn'], p5: ['legs', 'learn', 'share'] };

export function laterKey() {
  const p = wiz().plan; if (!p || !ORDER[p] || !wiz().done || welcomed()) return '';
  const k = kept();
  return ORDER[p].find(c => !k[c] && !(CARDS[c].done && CARDS[c].done())) || '';
}
export function laterCard() {
  const c = laterKey(); if (!c) return '';
  const C = CARDS[c];
  // An outline button, so it never competes with a bill card's filled one (A-3); the icon sits in the title's line; "No
  // thanks" because it does not come back (the review, 10/5).
  return `<section class="card hm-later" aria-labelledby="hm-later-t" data-later="${c}">
    <h2 class="hm-latert" id="hm-later-t"><span class="hm-laterlead" aria-hidden="true">${icon(C.icon)}</span><span>${esc(C.title)}</span></h2><p class="small">${esc(C.sub)}</p>
    <div class="btnrow">${btn(C.label, { kind: 'secondary', sm: true, href: C.href, attrs: { 'data-latergo': c } })}${btn('No thanks', { kind: 'text', sm: true, attrs: { 'data-laterno': c } })}</div>
  </section>`;
}
export function wireLater(root, redraw) {
  const mark = (c, v) => { const k = kept(); k[c] = v; keep(k); };
  root.querySelectorAll('[data-latergo]').forEach(el => el.onclick = e => {
    const c = el.dataset.latergo; mark(c, 'done');
    if (CARDS[c].act === 'share') { e.preventDefault(); doShare({ title: 'HIPHI Bill Tracker', text: 'I’m following Hawaiʻi’s health bills with HIPHI’s tracker. It tells you when a short note can help.',
      url: `${location.origin}${location.pathname}${DEMO ? '?demo=1' : ''}` }).finally(redraw); }
  });
  root.querySelectorAll('[data-laterno]').forEach(el => el.onclick = () => { mark(el.dataset.laterno, 'no'); redraw(); });
}
