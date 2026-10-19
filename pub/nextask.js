// A later visit's one ask, as a full page (R-237). Nate 10/11: "Instead of cards on the home page, it should be a full page
// similar to what someone would have experienced during onboarding. That should hold for any of the post onboarding asks
// we have of people." His answers the same day: on arrival, at most one per visit, "Not now" an equal choice; never when
// the person arrives from an alert or a shared link, or when testimony on what they follow is due within a day; Home's
// asks to give or join (the ones below); for everyone, no test. Finish your testimony, Meet HIPHI and the after-action
// Mahalo stay where they are.
//
// A person comes here to answer one small question from HIPHI, or wave it away, and go on to Home (B-1).
//
// app.js boot() asks pickAsk() on the first arrival of a new day (the practice copy: its "Next day"), when the address is
// plain Home, and swaps the address for #/next/<kind>; the page draws in the first visit's frame (start.css: the drawing,
// the heading, one line, the choices; pub/next.css repeats its screen-scoped rules for this screen). Done or "Not now" swap
// the address back to #/ (replaceState: Back never returns to an answered ask). "Not now" quiets that ask for 14 days,
// then 60, then for good; the profile ask keeps its own quiet (kernel nudgeOk), as everywhere. These replaced Home's
// cards: the later-visit cards of pub/onb-later.js (R-164, R-232), the "Welcome back" profile ask, "Keep the tracker on
// your phone" and "A new issue in ...".
import { S, DEMO, app, esc, icon, toast, wiz, nudgeOk, followsAnything, myActions, openActions, actedOn, legTitle, legPhoto,
  issueFollowed, setFollows, followedIssues, CONSENT_KEY, firstVisit } from './core.js';
import { btn } from './ui.js';
import { CAPITOL, VOICES, islands } from './art.js';
import { createAddressPicker } from './addresspicker.js';
import { alertFields, wireAlertForm, alertButton, alertDoneHTML, codeStep, profileAsk, PROFILE_H, profileLede, alertsGiven } from './alerts.js';
import { declineNudge, doShare } from './actions.js';
import { newIssues } from './home.js';
import { burst, later, cheer } from './fx.js';
import { abSeen, armOf } from './variant.js';
import { logAsk } from './visitlog.js';

// ---------------- what was answered ----------------
const KEY = 'hiphi_asks';   // { [kind]: { no: n, at: iso } | { done: true } }; the practice copy keeps its own (kernel.js)
const kept = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
const mark = (k, patch) => { const o = kept(); o[k] = { ...(o[k] || {}), ...patch }; try { localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* private mode: asked again next time */ } };
// The cards they answered before R-237 (pub/onb-later.js) stay answered.
const oldCard = k => { try { return !!(JSON.parse(localStorage.getItem('hiphi_later') || '{}') || {})[k]; } catch { return false; } };
const QUIET_DAYS = [0, 14, 60];
// After any "Not now", no page for a while, whichever ask is next, and the while grows: a week, then three weeks, then three
// months (Nate 10/11: "Do a one week rest, then 3 weeks, then 3 months"; the review had found that someone who checks in
// every morning and waves each one away would otherwise meet a page on six mornings running). An ask done starts the
// count again. REST_KEY keeps { n: Not nows in a row, at: the last }; the three days of the first build (a date alone)
// count as one.
const REST_KEY = 'hiphi_asks_rest', REST_DAYS = [7, 21, 90];
function rest() {
  try { const v = localStorage.getItem(REST_KEY) || '';
    if (/^\d{4}-/.test(v)) return { n: 1, at: v };
    const o = JSON.parse(v || 'null'); return o && o.n ? o : { n: 0, at: '' };
  } catch { return { n: 0, at: '' }; }
}
const setRest = o => { try { localStorage.setItem(REST_KEY, JSON.stringify(o)); } catch { /* private mode: no rest kept */ } };
const resting = () => { const r = rest(), t = Date.parse(r.at || ''); return r.n > 0 && !!t && Date.now() - t < REST_DAYS[Math.min(r.n, REST_DAYS.length) - 1] * 864e5; };
// Counted privately (backend 170, Nate 10/11 "Yes keep track"): which ask, shown or done or Not now, and how many Not nows
// came before; nothing else (pub/visitlog.js logAsk). A page shown is counted once a page load.
const count = (k, outcome) => logAsk(k, outcome, Math.min(rest().n, 3));
const shownNow = new Set();
// Done: kept as answered, the rest count starts again, counted.
function did(k) { if (k !== 'alerts') mark(k, { done: true }); count(k, 'done'); setRest({ n: 0, at: '' }); }
function quiet(k) {
  const s = kept()[k];
  if (oldCard(k) || s?.done) return true;
  if (!s?.no) return false;
  return s.no >= QUIET_DAYS.length || Date.now() - Date.parse(s.at) < QUIET_DAYS[s.no] * 864e5;
}

// ---------------- which ask, if any ----------------
const districtsKnown = () => { try { return !!(JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || S.profile?.senate_district); } catch { return false; } };
const welcomed = () => { try { return sessionStorage.getItem('hiphi_welcome') === '1'; } catch { return false; } };
const standalone = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
const gaveEmail = () => { try { return !!(sessionStorage.getItem('hiphi_link_sent') || localStorage.getItem(CONSENT_KEY)); } catch { return false; } };
// Whoever saw "A bill's story" in their first visit has had the three moments (today's full version, Plan 2's journey).
const sawStory = () => { const p = wiz().plan; return p ? p === 'p2' : armOf('fv') !== 'short'; };
// The asks, in order: the first one that applies is the visit's ask.
const ASKS = {
  legs: () => !districtsKnown(),
  alerts: () => !S.session && !alertsGiven() && !gaveEmail() && nudgeOk() && (followsAnything() || S.done.size > 0),
  issues: () => newIssues().some(i => !issueFollowed(i)),
  learn: () => !sawStory(),
  share: () => followsAnything() || myActions().length > 0,
  phone: () => !standalone() && myActions().length > 0 && (window.innerWidth || 0) < 900 && !(() => { try { return localStorage.getItem('hiphi_hs_no') === '1'; } catch { return false; } })(),
};
// Testimony on something they follow due within a day, not yet acted on: Home, with that bill on top, comes first.
function dueSoon() {
  const now = Date.now();
  return openActions(S.bills, S.hearings).some(({ b, h, late }) => S.watch.has(b.id) && !late && h.testimony_deadline
    && new Date(h.testimony_deadline) - now < 864e5 && !actedOn(b, h));
}
export function pickAsk() {
  if (firstVisit() || !wiz().done || welcomed() || resting() || dueSoon()) return '';
  for (const [k, ok] of Object.entries(ASKS)) {
    if (k !== 'alerts' && quiet(k)) continue;
    try { if (ok()) return k; } catch (e) { console.error(e); }
  }
  return '';
}

// ---------------- leaving ----------------
// Back to Home in the same history entry, so Back from Home never lands on an answered ask.
function leave(to = '#/') {
  history.replaceState({ y: 0 }, '', '#/');
  if (to === '#/') { app.render(); window.scrollTo(0, 0); } else app.go(to);
}
function notNow(k) {
  count(k, 'no');
  setRest({ n: rest().n + 1, at: new Date().toISOString() });
  if (k === 'alerts') declineNudge();
  else if (k === 'phone') { try { localStorage.setItem('hiphi_hs_no', '1'); } catch { /* ignore */ } }
  else if (k !== 'issues') { const n = (kept()[k]?.no || 0) + 1; mark(k, { no: n, at: new Date().toISOString() }); }
  leave();
}

// ---------------- the frame: the first visit's ----------------
// "Not now" is an outlined button beside the filled one, as on the first visit's own asks (C-3: an equal choice; the review
// of 10/11). The line over the drawing says why the page is here and where both answers lead (P-4, C-6).
const shell = (k, art, h, lede, main) => `<div class="st st1 nx nx-${k}"><div class="st-intro">
    <p class="nx-eyebrow">${icon('sparkles')}<span>Welcome back · one quick thing, then Home</span></p><div class="st-art">${art}</div>
    <h1 class="hero" id="st-h">${h}</h1>${lede ? `<p class="lede">${lede}</p>` : ''}</div><div class="st-main">${main}</div></div>`;
const bar = (label, opt = {}, attrs = { 'data-nxgo': '1' }) => `<div class="st-bar"><div class="st-btns">
  ${btn('Not now', { kind: 'secondary', attrs: { 'data-nxno': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs })}</div></div>`;
const barOne = (label, ic = 'arrow-right', attrs = { 'data-nxdone': '1' }) => `<div class="st-bar st-one">${btn(label, { kind: 'primary', iconEnd: ic, attrs })}</div>`;
const barNo = () => `<div class="st-bar st-one">${btn('Not now', { kind: 'secondary', attrs: { 'data-nxno': '1' } })}</div>`;

// ---------------- legs: who speaks for you (the first visit's address step until R-232) ----------------
// A street address only; it is used to find the districts and never saved, and staff never see it (CLAUDE.md rule 3).
const AP = createAddressPicker();
S.nxAddr ??= { q: '', pick: null, finding: false, err: '' };
const typed = (q, results) => q.length >= 5 && /^\d/.test(q) && !results.some(r => r.exact);
const lastName = l => String(l.sort_name || '').split(',')[0].trim() || String(l.name || '').split(' ').slice(-1)[0];
function sugsHTML() {
  const A = S.nxAddr, q = A.q.trim(), results = AP.results(q);
  return `${A.err ? `<p class="st-info-small">${icon('info')}<span>${esc(A.err)}</span></p>` : ''}
    ${results.length || typed(q, results) ? `<div class="st-sugs" role="group" aria-label="Addresses">${results.map((r, i) => `<button type="button" class="st-sug" data-nxpick="${i}">${icon('map-pin')}<span>${esc(r.label)}</span></button>`).join('')}
      ${typed(q, results) ? `<button type="button" class="st-sug" data-nxtyped="1">${icon('search')}<span>Look up “${esc(q)}” as typed</span></button>` : ''}</div>` : ''}`;
}
function legsPage() {
  const A = S.nxAddr;
  let body;
  if (A.pick) {
    const legs = A.pick.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean).sort((a, b) => (a.chamber === 'H' ? 0 : 1) - (b.chamber === 'H' ? 0 : 1));
    body = `<p class="st-addrline">${icon('map-pin')}<span>${esc(A.pick.label || A.q)}</span></p>
      <ul class="st-legs" id="st-legs" role="list">${legs.map(l => `<li class="st-leg">${legPhoto(l, 'st-legpic')}<span class="st-tbody"><b>${esc(legTitle(l))} ${esc(l.name)}</b><span>Your ${l.chamber === 'S' ? 'senator' : 'representative'} · District ${esc(String(l.district))}</span></span></li>`).join('')}</ul>
      <p class="st-connect">${icon('sparkles')}<span>They vote on your bills when they reach the House and Senate floors, and they listen closest to the people they represent.</span></p>
      ${btn('Use a different address', { kind: 'text', attrs: { 'data-nxclear': '1' } })}`;
  } else if (A.finding) {
    body = `<p class="st-info-small" role="status">${icon('loader-circle', { cls: 'pp-spin' })}<span>Finding your districts…</span></p>`;
  } else {
    body = `<div class="field"><label for="nx-addr">Your street address</label>
        <input id="nx-addr" type="text" autocomplete="street-address" placeholder="Start typing, like 45-600 Keaahala Rd" value="${esc(A.q)}" data-nxaddr="1">
        <span class="help">We use it only to find your districts. It isn’t saved.</span></div>
      <div id="nx-sugs">${sugsHTML()}</div>`;
  }
  return shell('legs', islands(''), A.pick ? 'These two speak for&nbsp;you' : 'Who speaks for you?',
    A.pick ? '' : 'One senator and one representative speak for where you live, and they listen closest to you. Find yours in about 30 seconds.',
    `<div class="st-legwrap">${body}</div>`);
}
function wireLegs() {
  const box = document.querySelector('[data-nxaddr]');
  const paint = () => { const el = document.getElementById('nx-sugs'); if (!el) return; el.innerHTML = sugsHTML(); wireSugs(); };
  if (box) box.oninput = () => { S.nxAddr.q = box.value; S.nxAddr.err = ''; AP.search(box.value.trim(), paint); paint(); };
  const look = async r => {
    S.nxAddr.finding = true; app.render();
    try {
      const res = await AP.resolve(r.label, r.pt);
      if (!res || res.none || !res.ids?.length) { S.nxAddr.finding = false; S.nxAddr.err = 'We couldn’t find that address. Check the street and number, or pick a suggestion.'; app.render(); return; }
      S.nxAddr = { ...S.nxAddr, pick: { ids: res.ids, label: res.matched || r.label }, finding: false };
      // The districts (never the address) stay on this device, so bill pages can say "your senator" (people.js does the same).
      const found = res.ids.map(id => S.legislators.find(l => l.id === id)).filter(Boolean);
      try { localStorage.setItem('hiphi_districts', JSON.stringify({ senate: found.find(l => l.chamber === 'S')?.district || null, house: found.find(l => l.chamber === 'H')?.district || null })); } catch { /* ignore */ }
      did('legs');
      app.render();
      later(() => cheer('found', document.getElementById('st-legs'), 14, 70), 300);   // found: a small celebration (C-7); R-308's rooster with fx=found
    } catch { S.nxAddr.finding = false; S.nxAddr.err = 'We couldn’t look that up just now. Check your connection and try again.'; app.render(); }
  };
  function wireSugs() {
    document.querySelectorAll('[data-nxpick]').forEach(el => el.onclick = () => { const r = AP.results(S.nxAddr.q.trim())[+el.dataset.nxpick]; if (r) look({ label: r.label, pt: r }); });
    document.querySelectorAll('[data-nxtyped]').forEach(el => el.onclick = () => look({ label: S.nxAddr.q.trim(), pt: null }));
  }
  wireSugs();
  if (box) box.onkeydown = e => { if (e.key !== 'Enter') return; e.preventDefault();
    const q = box.value.trim(), r = AP.results(q)[0];
    if (r) look({ label: r.label, pt: r }); else if (typed(q, [])) look({ label: q, pt: null }); };
  const clear = document.querySelector('[data-nxclear]');
  if (clear) clear.onclick = () => { S.nxAddr = { q: '', pick: null, finding: false, err: '' }; app.render(); requestAnimationFrame(() => document.getElementById('nx-addr')?.focus()); };
}

// ---------------- alerts: save your profile (the "Welcome back" ask on Home until R-237) ----------------
// The same box as the first visit's and More's (pub/alerts.js): its words are the consent, unchanged (C-4).
function alertsPage() {
  const done = S.nxAlert;
  if (!done) abSeen('save');
  const prof = profileAsk(), ni = followedIssues().length, nb = S.watch.size, na = myActions().length;
  const things = `${ni ? `${ni} issue${ni === 1 ? '' : 's'}` : `${nb} bill${nb === 1 ? '' : 's'}`}${na ? ` and ${na} action${na === 1 ? '' : 's'}` : ''}`;
  const lede = done ? '' : codeStep('nx-a') ? (prof ? 'Type the code to save your profile.' : 'Type the 6-digit code from the text to turn on alerts.')
    : prof ? profileLede('back', { things, many: ni > 1 }) : `Your ${things} live in this browser only, and phones clear it after a while. Get a text when a hearing is set, so you don’t miss it.`;
  const body = done
    ? `<section class="card st-sent st-alertdone"><span class="st-ilead">${icon(done.kind === 'phone' ? 'message-square' : 'mail-check')}</span>
        <div class="st-sentbody">${alertDoneHTML(done.kind === 'phone' ? { kind: 'phone', phone: done.phone, demo: DEMO } : { kind: 'email', email: done.email, demo: DEMO })}</div></section>`
    : `<form class="card st-form st-askcard st-alertform" id="nx-aform" novalidate>${alertFields('nx-a')}</form>`;
  return shell('alerts', VOICES, done ? 'Mahalo!' : codeStep('nx-a') ? 'Check your texts' : prof ? PROFILE_H : 'Get alerts on your issues', esc(lede), body);
}
function wireAlerts() {
  // The visit's one profile ask (C-3): nothing else asks again this visit.
  S.nudge = null; S.nudgedThisVisit = true;
  const f = document.getElementById('nx-aform');
  if (f) wireAlertForm(f, { pfx: 'nx-a', source: 'home', onSwap: () => app.render(), onDone: r => { S.nxAlert = r; did('alerts'); app.render(); later(() => cheer('alerts', document.getElementById('st-h'), 14, 70), 200); } });
}

// ---------------- issues: new issues HIPHI took up, in a topic they follow (R-018; a Home card until R-237) ----------------
function issuesPage() {
  const list = newIssues().slice(0, 3);
  const cat = S.cats.find(c => list[0]?.categories?.includes(c.key) && S.issues.some(x => S.issueFollows.has(x.id) && x.categories.includes(c.key)));
  const one = list.length === 1;
  return shell('issues', CAPITOL, `${one ? 'A new issue' : 'New issues'} in ${esc(cat?.name || 'your topics')}`,
    `HIPHI just took ${one ? 'it' : 'them'} up. Follow ${one ? 'it' : 'any'} if you like.`,
    `<ul class="nx-iss" role="list">${list.map(i => { const on = issueFollowed(i);
      return `<li class="st-pcard${on ? ' on' : ''}"><button type="button" class="st-pick" data-nxiss="${esc(i.id)}" aria-pressed="${on}">
        <span class="st-tick" aria-hidden="true">${icon('check')}</span><span class="st-pbody"><span class="st-phead">${esc(i.name)}</span>
        ${i.description ? `<span class="st-pwhat">${esc(i.description)}</span>` : ''}</span></button></li>`; }).join('')}</ul>`);
}
function wireIssues() {
  document.querySelectorAll('[data-nxiss]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.nxiss); if (!i) return;
    const on = issueFollowed(i);
    if (await setFollows(on ? { issuesOff: [i.id] } : { issuesOn: [i.id] })) { if (!on) burst(el.querySelector('.st-tick'), 10, 34); app.render(); }
  });
}

// ---------------- learn: the three moments (a later-visit card for the plans until R-237) ----------------
const MOMENTS = [['mail', 'Before a hearing', 'A short email to the committee chair'], ['notebook-pen', 'At the hearing', 'Written testimony, or speaking up in person'], ['message-square', 'Before the full vote', 'A note to your own legislators']];
const learnPage = () => shell('learn', CAPITOL, 'The three moments when you can help', 'One minute, on a real bill: when a short note helps most, and why.',
  `<ol class="nx-moments" role="list">${MOMENTS.map(([ic, t, s], k) => `<li style="--k:${k}"><span class="nx-mic" aria-hidden="true">${icon(ic)}</span><span><b>${esc(t)}</b><span>${esc(s)}</span></span></li>`).join('')}</ol>`);

// ---------------- share: bring a friend along ----------------
const SHARE_TEXT = 'I’m following Hawaiʻi’s health bills with HIPHI’s tracker. It tells you when a short note can help.';
const sharePage = () => shell('share', VOICES, 'Bring a friend along', 'Bills move when more neighbors speak up. Send the tracker to one person who cares about what you do.',
  `<p class="nx-quotel">What we’ll send</p><blockquote class="card nx-quote">${esc(SHARE_TEXT)}</blockquote>`);

// ---------------- phone: keep the tracker on your phone (a Home card until R-237) ----------------
// Android's own install prompt when the browser offers one (app.js keeps it); on an iPhone the two taps it takes, and the
// honest catch: the home-screen app keeps its own copy, so they add their email there to bring their issues along.
const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent || '');
const phonePage = () => shell('phone', CAPITOL, 'Keep the tracker on your phone', 'One tap to your issues next time, like any app.',
  S.installPrompt ? '' : ios()
    ? `<ol class="nx-moments" role="list"><li><span class="nx-mic" aria-hidden="true">${icon('share')}</span><span><b>In Safari, tap Share</b><span>The square with an arrow, at the bottom</span></span></li>
        <li><span class="nx-mic" aria-hidden="true">${icon('square-plus')}</span><span><b>Then Add to Home Screen</b><span>The app there starts fresh: save your profile in it to bring your issues along.</span></span></li></ol>`
    : `<ol class="nx-moments" role="list"><li><span class="nx-mic" aria-hidden="true">${icon('menu')}</span><span><b>Open your browser’s menu</b><span>Then choose Add to Home screen, or Install app</span></span></li></ol>`);

const PAGES = { legs: legsPage, alerts: alertsPage, issues: issuesPage, learn: learnPage, share: sharePage, phone: phonePage };
const TITLES = { legs: 'Who speaks for you', alerts: 'Save your profile', issues: 'New issues', learn: 'The three moments', share: 'Bring a friend along', phone: 'Keep it on your phone' };

export default {
  tabs: false,
  title: route => TITLES[route?.kind] || 'Welcome back',
  render(route) {
    const page = PAGES[route.kind];
    if (!page) { setTimeout(() => leave(), 0); return ''; }
    S.nudgedThisVisit = true;   // one ask a visit (C-3): this page is it
    if (!shownNow.has(route.kind)) { shownNow.add(route.kind); count(route.kind, 'shown'); }
    return page();
  },
  bar(route) {
    switch (route.kind) {
      case 'legs': return S.nxAddr.pick ? barOne('Done') : barNo();
      case 'alerts': { if (S.nxAlert) return barOne('Done');
        const b = alertButton('nx-a'); return bar(b.label, { icon: b.icon }, { type: 'submit', form: 'nx-aform', id: 'nx-send' }); }
      case 'issues': return newIssues().some(issueFollowed) ? barOne('Done') : barNo();
      case 'learn': return bar('Show Me', { iconEnd: 'arrow-right' });
      case 'share': return bar('Share', { icon: 'share-2' });
      case 'phone': return S.installPrompt ? bar('Add to Home Screen', { icon: 'smartphone' }) : bar('Done', { iconEnd: 'check' }, { 'data-nxdone': '1' });
      default: return '';
    }
  },
  wire(route) {
    const k = route.kind;
    document.querySelectorAll('[data-nxno]').forEach(el => el.onclick = () => notNow(k));
    // Done after the page's own action: legs and alerts were counted when it happened; new issues followed and the phone's steps here.
    document.querySelectorAll('[data-nxdone]').forEach(el => el.onclick = () => { if (k === 'phone' || k === 'issues') did(k); leave(); });
    if (k === 'legs') wireLegs();
    if (k === 'alerts') wireAlerts();
    if (k === 'issues') wireIssues();
    const go = document.querySelector('[data-nxgo]');
    if (!go) return;
    if (k === 'learn') go.onclick = () => { did('learn'); leave('#/learn/bill'); };
    if (k === 'share') go.onclick = async () => {
      const how = await doShare({ title: 'HIPHI Bill Tracker', text: SHARE_TEXT, url: `${location.origin}${location.pathname}${DEMO ? '?demo=1' : ''}` }).catch(() => null);
      if (!how) return;
      did('share');
      toast(how === 'copied' ? 'Copied. Paste it in a text or email.' : 'Mahalo for bringing a friend along', { yay: how !== 'copied' });
      leave();
    };
    if (k === 'phone') go.onclick = async () => { const p = S.installPrompt; S.installPrompt = null; did('phone'); try { p?.prompt(); await p?.userChoice; } catch { /* ignore */ } leave(); };
  },
};
