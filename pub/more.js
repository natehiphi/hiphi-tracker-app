// More (redesign 9/19; plan 5 "More" and 7 "Help, Settings, Sign in, More"): the fourth tab and the pages under it.
//   #/more      a short page of rows (link cards in a grid on a wide screen): your legislators, how it works, adding
//               your email (or Settings and Sign out), HIPHI itself, privacy and accessibility
//   #/help      how it works in 4 steps, the words a newcomer meets at the Capitol, where to get a hand
//   #/signin    "Add your email": one email field, one "keep me updated" box (hearings on your issues and HIPHI's updates,
//               ticked; DESIGN C-4, Nate 9/20), privacy in 3 bullets
//   #/settings  the two email choices and About you, saved with ONE button; your data; deleting the account
//   #/privacy   what we keep and who sees it, then a short accessibility statement
// ONE vocabulary for the email step (Nate, 9/19; the assessment counted six names for it): a signed-out person is
// offered "Add my email", the page is "Add your email", the button is "Email me a link". "Sign in" is only the
// header's word for returning people, plus one small line on that page. Giving an email to be kept updated IS the
// consent, for hearing alerts and HIPHI's own updates alike, named plainly as one choice (C-4). Settings keeps the two
// apart, so either can be turned off later.
// It also exports the two cards Home shows right after someone signs in (accountCardsHTML / wireAccountCards):
// the email choices (when the person came in through an email ask and has not chosen yet) and their home address
// (after they follow their first bill). Ported from consentCardHTML, addrCardHTML, wireAddrCard, signin,
// profileFormHTML, wireProfile, settings and help in track.js; the Supabase calls and the pending-choices
// behaviour (CONSENT_KEY) are unchanged. What changed: no digest menu (no digest email is sent to the public; the
// only emails are the two opt-ins, migration 045), one Save button, "Your data" now says the same as Privacy,
// deleting the account asks on the page instead of a browser pop-up, and every error is a sentence.
import { S, DEMO, app, esc, icon, ICONS, toast, friendly, yay, supa, fetchAddrSuggest, looksLikeAddress, legTitle,
  CONSENT_KEY, LOCAL_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, STANCE_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, recomputeWatch, fmtDate,
  sendEmailLink, validEmail } from './core.js';
import { btn, row, notice, inlineErr } from './ui.js';
import { MARK } from './art.js';
import { islandKey } from './people.js';

// hiphi.org pages, from the site's own footer and menus (research 9/18). Donate stays last wherever these appear.
const HIPHI = {
  about: 'https://www.hiphi.org/about/', act: 'https://www.hiphi.org/act/', news: 'https://www.hiphi.org/sign-up/',
  recap: 'https://www.hiphi.org/policy/legrecap/', donate: 'https://www.hiphi.org/donate/',
  privacy: 'https://www.hiphi.org/privacy/', access: 'https://www.hiphi.org/accessibility-statement/',
};
const EMAIL = 'contact@hiphi.org';   // the address on every hiphi.org page
// The Legislature's Public Access Room helps anyone testify, for free, by phone or at the Capitol.
const PAR = { tel: 'tel:+18085870478', text: '(808) 587-0478' };
const DISTRICTS_KEY = 'hiphi_districts';   // shared with the people and bill screens: { senate, house, label, island }
// Lucide has an "accessibility" figure; icons.js may not carry it yet, and icon() would draw an empty circle.
const A11Y_ICON = ICONS.accessibility ? 'accessibility' : 'eye';
const $ = s => document.querySelector(s);
const signedIn = () => !!(S.session && S.user);

// The two email choices, worded once, for the card after sign in and Settings, where each can be turned off on its own.
// Where a person GIVES their email they are one choice, "keep me updated", ticked (DESIGN C-4; Nate, 9/20).
const CHOICES = [
  ['alerts', 'hearing_alerts', 'Email me when a bill on one of my issues gets a hearing', 'About 2 days’ notice, time to send testimony.'],
  ['action', 'action_alerts', 'Email me when HIPHI has an update or a way to help', 'A few times a session.'],
];
const KEEP = ['Keep me updated', 'Hearings on your issues, and HIPHI’s updates and ways to help. Unsubscribe in one tap, any time.'];
const INTERESTS = [['testify', 'I’d testify in person'], ['story', 'I have a story to share'], ['quote', 'HIPHI may quote me'],
  ['host', 'I could host or help at an event'], ['volunteer', 'I’d like to volunteer']];
const check = (id, title, help, on, attrs = '') => `<label class="check mr-check" for="${id}"><input type="checkbox" id="${id}"${on ? ' checked' : ''}${attrs}>
  <span class="mr-ctext"><span class="mr-ctitle">${title}</span>${help ? `<span class="mr-chelp">${help}</span>` : ''}</span></label>`;
const errLine = (id, text) => `<span class="err" id="${id}">${icon('triangle-alert')}<span>${esc(text)}</span></span>`;
// Loading state for a button: a spinning loader and "Sending…"; unbusy puts the button back exactly as it was.
const was = new WeakMap();
const busy = (el, label) => { if (!el) return; was.set(el, el.innerHTML); el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}<span>${esc(label)}</span>`; };
const unbusy = el => { if (!el) return; el.removeAttribute('aria-busy'); if (was.has(el)) el.innerHTML = was.get(el); };
// ui.js btn() always writes type="button" first (a second type attribute is ignored), so a form's submit button is
// written here with the same classes. A real submit button lets Enter on the keyboard send the form too.
const submitBtn = (label, ic, id) => `<button type="submit" class="btn primary" id="${id}">${icon(ic)}<span>${label}</span></button>`;
// An inline error under a card's buttons (role=alert), or nothing.
const say = (id, html) => { const box = document.getElementById(id); if (box) box.innerHTML = html; };
// Focus a field with its label in view (a plain focus() tucks the label under the sticky header).
const focusField = inp => { inp.focus({ preventScroll: true }); inp.closest('.field')?.scrollIntoView({ block: 'center' }); };
const extRow = (lead, title, sub, href, leadHtml) => row({ lead, leadHtml, title, sub, href, chevron: false,
  end: `${icon('external-link', { cls: 'chev' })}<span class="sr">(opens hiphi.org)</span>`, attrs: { target: '_blank', rel: 'noopener' } });

// ---------------- your legislators, from the districts saved on this device or the account ----------------
function seat(ch, d) {
  if (!d) return null;
  // After a mid-term appointment the directory can list two people for one seat; the one with a Capitol email serves.
  const ls = (S.legislators || []).filter(l => l.chamber === ch && +l.district === +d && l.active !== false);
  return ls.find(l => l.email) || ls[0] || null;
}
function myDistricts() {
  try { const d = JSON.parse(localStorage.getItem(DISTRICTS_KEY) || 'null'); if (d && +d.senate && +d.house) return { senate: +d.senate, house: +d.house }; } catch { /* private mode */ }
  const p = S.profile || {};
  return p.senate_district && p.house_district ? { senate: +p.senate_district, house: +p.house_district } : null;
}
const legName = l => l ? `${legTitle(l)} ${l.name}` : '';
// "Your senator: Sen. Chris Lee" / "Your representative: Rep. Lisa Marten" for an address someone picked.
function distHTML(sd, hd) {
  if (!sd && !hd) return '';
  const s = seat('S', sd), h = seat('H', hd);
  const line = (word, l, ch, d) => d ? `<span>${word}: <span class="strong">${l ? esc(legName(l)) : `${ch} District ${d}`}</span></span>` : '';
  return `${icon('map-pin')}<span class="mr-distlines">${line('Your senator', s, 'Senate', sd)}${line('Your representative', h, 'House', hd)}</span>`;
}

// ---------------- home address with suggestions (Settings and the card after sign in) ----------------
// Suggestions come from our own table of every Hawaiʻi street address, which carries the districts (fetchAddrSuggest,
// as in track.js). A suggestion without districts asks districts_at() for them.
function splitAddr(label) {
  const [street = '', ...rest] = String(label || '').replace(/\s+/g, ' ').trim().split(/,\s*/);
  let town = rest.join(', ').replace(/\s*\d{5}(-\d{4})?$/, '').trim();
  // A town in capitals ("KANEOHE") reads better as "Kaneohe"; the table's usual mixed case is kept as written.
  if (town && town === town.toUpperCase()) town = town.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { street, town };
}
function addrField(pfx, st, { label = 'Home address', help } = {}) {
  return `<div class="field mr-addr">
    <label for="${pfx}-addr">${label}</label>
    <input id="${pfx}-addr" type="text" value="${esc(st.q)}" placeholder="e.g. 415 S Beretania St, Honolulu" autocomplete="street-address"
      autocapitalize="words" spellcheck="false" aria-describedby="${pfx}-addr-h ${pfx}-dist">
    <span class="help" id="${pfx}-addr-h">${help}</span>
    <div class="mr-sugs" id="${pfx}-sugs" role="group" aria-label="Addresses" hidden></div>
    <p class="mr-dist" id="${pfx}-dist" role="status" tabindex="-1">${st.sd || st.hd ? distHTML(st.sd, st.hd) : ''}</p>
  </div>`;
}
function paintSugs(pfx, st, onPick) {
  const box = document.getElementById(`${pfx}-sugs`); if (!box) return;
  const list = st.results || [];
  box.innerHTML = st.loading && !list.length ? `<p class="mr-sugnote">${icon('loader-circle', { cls: 'mr-spin' })}<span>Looking up addresses…</span></p>`
    : st.failed ? `<p class="mr-sugnote">${icon('circle-alert')}<span>We couldn’t look that up. Check your connection and try again.</span></p>`
    : list.map((x, i) => { const a = splitAddr(x.label);
      return `<button type="button" class="mr-sug" data-mr-sug="${i}">${icon('map-pin')}<span class="mr-sugtext"><span class="mr-sugt">${esc(a.street)}</span>${a.town ? `<span class="mr-sugs2">${esc(a.town)}</span>` : ''}</span></button>`; }).join('');
  box.hidden = !box.innerHTML;
  const btns = [...box.querySelectorAll('[data-mr-sug]')], inp = document.getElementById(`${pfx}-addr`);
  btns.forEach((el, i) => {
    el.onclick = () => onPick(list[+el.dataset.mrSug]);
    el.onkeydown = e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || el).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (btns[i - 1] || inp).focus(); }
      else if (e.key === 'Escape') { e.preventDefault(); inp?.focus(); }
    };
  });
}
// st: { q, sd, hd, picked, results, loading, failed }. onChange runs on each keystroke and pick (the card clears its error).
function wireAddr(pfx, st, onChange = () => {}) {
  const inp = document.getElementById(`${pfx}-addr`); if (!inp) return;
  const dist = document.getElementById(`${pfx}-dist`);
  const pick = async x => {
    if (!x) return;
    let sd = x.sd, hd = x.hd;
    if (!sd || !hd) { try { const { data } = await (await supa()).rpc('districts_at', { lat: x.lat, lon: x.lon }); sd = data?.[0]?.sd; hd = data?.[0]?.hd; } catch { /* shown below */ } }
    Object.assign(st, { q: x.label, sd: sd || null, hd: hd || null, picked: true, results: [], loading: false, failed: false });
    inp.value = x.label; paintSugs(pfx, st, pick);
    if (dist) dist.innerHTML = sd ? distHTML(sd, hd) : `${icon('info')}<span>We couldn’t find districts for that address. Try a nearby address.</span>`;
    // Focus moves to the answer, not back to the box: on a phone that would pop the keyboard up over it.
    dist?.focus({ preventScroll: true }); onChange();
  };
  inp.oninput = () => {
    const q = inp.value; Object.assign(st, { q, picked: false, sd: null, hd: null, failed: false });
    if (dist) dist.innerHTML = '';
    onChange();
    clearTimeout(st.timer);
    if (!looksLikeAddress(q.trim())) { st.results = []; st.loading = false; paintSugs(pfx, st, pick); return; }
    st.loading = true; paintSugs(pfx, st, pick);
    // Wait for a pause in typing, then ask once; a reply for an older query is dropped.
    st.timer = setTimeout(async () => {
      try { const r = await fetchAddrSuggest(q.trim()); if (st.q !== q) return; st.results = r; }
      catch { if (st.q !== q) return; st.results = []; st.failed = true; }
      st.loading = false; paintSugs(pfx, st, pick);
    }, 250);
  };
  inp.onkeydown = e => { if (e.key === 'ArrowDown') { const f = document.querySelector(`#${pfx}-sugs [data-mr-sug]`); if (f) { e.preventDefault(); f.focus(); } } };
  paintSugs(pfx, st, pick);
}
// Saved districts also go on this device, so bill pages can say "Your senator" (only the town, never the street).
function rememberDistricts(sd, hd, address) {
  if (!sd || !hd) return;
  const town = splitAddr(address).town;
  try { localStorage.setItem(DISTRICTS_KEY, JSON.stringify({ senate: +sd, house: +hd, label: town, island: islandKey(sd, hd, town) })); } catch { /* private mode */ }
}

// ---------------- the two cards Home shows after sign in ----------------
// One at a time: the email choices first (only for people who signed in from an email ask, since the sign-in page
// asks already), then the home address once they follow a bill (core sets S.addrCard). Both need an account, so
// neither appears in the sandbox.
const AC = { q: '', sd: null, hd: null, picked: false, results: [] };
const acctHead = (ic, id, title) => `<div class="mr-accthead"><span class="mr-acctic">${icon(ic)}</span><p class="strong" id="${id}">${title}</p></div>`;
export function accountCardsHTML() {
  if (!signedIn()) return '';
  if (S.consentCard) return `<section class="card mr-acct" id="mr-cc" aria-labelledby="mr-cc-t">
    ${acctHead('bell', 'mr-cc-t', 'Your email alerts')}
    <p class="small">Mahalo for adding your email. Both are ticked for you. Nothing is sent until you save.</p>
    <div class="mr-checks">${CHOICES.map(([k, , t, h]) => check(`mr-cc-${k}`, t, h, true)).join('')}</div>
    <p class="small muted">HIPHI staff can see the issues and bills you follow, where you stand on them and what you do here, so they can reach out about them. Change this any time in Settings.</p>
    <div id="mr-cc-msg"></div>
    <div class="btnrow">${btn('Save my choices', { kind: 'secondary', sm: true, attrs: { 'data-mr-cc': 'save' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-mr-cc': 'later' } })}</div>
  </section>`;
  if (S.addrCard) return `<section class="card mr-acct" id="mr-ac" aria-labelledby="mr-ac-t">
    ${acctHead('landmark', 'mr-ac-t', 'Find your legislators')}
    <p class="small">Add your home address, and we’ll point you to your own senator and representative when a bill needs a voice.</p>
    ${addrField('mr-ac', AC, { help: 'Only you see your address. HIPHI staff see just your districts.' })}
    <div id="mr-ac-msg"></div>
    <div class="btnrow">${btn('Save', { kind: 'secondary', sm: true, attrs: { 'data-mr-ac': 'save' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-mr-ac': 'later' } })}</div>
  </section>`;
  return '';
}
export function wireAccountCards() {
  const cc = $('#mr-cc');
  if (cc) {
    cc.querySelector('[data-mr-cc="later"]').onclick = () => { S.consentCard = false; app.render(); };
    const save = cc.querySelector('[data-mr-cc="save"]');
    save.onclick = async () => {
      const prefs = { ...(S.user.prefs || {}), consent_at: new Date().toISOString() };
      // Only checkboxes (the old '.ccard input' rule also caught the address field and shrank it to 18px).
      for (const [k, key] of CHOICES) prefs[key] = !!cc.querySelector(`#mr-cc-${k}[type=checkbox]`)?.checked;
      busy(save, 'Saving…'); say('mr-cc-msg', '');
      const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id);
      if (error) { unbusy(save); say('mr-cc-msg', inlineErr('mr-cc-err', friendly(error))); return; }
      S.user.prefs = prefs; S.consentCard = false; app.render(); yay('Saved. Change it any time in Settings.');
    };
  }
  const ac = $('#mr-ac');
  if (ac) {
    const inp = $('#mr-ac-addr');
    // The error sits under the field and clears as soon as an address is picked (no redraw, so the keyboard stays up).
    const err = text => {
      say('mr-ac-msg', text ? inlineErr('mr-ac-err', text) : '');
      if (text) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'mr-ac-addr-h mr-ac-dist mr-ac-err'); }
      else { inp.removeAttribute('aria-invalid'); inp.setAttribute('aria-describedby', 'mr-ac-addr-h mr-ac-dist'); }
    };
    wireAddr('mr-ac', AC, () => err(''));
    ac.querySelector('[data-mr-ac="later"]').onclick = () => { S.addrCard = false; app.render(); };
    const save = ac.querySelector('[data-mr-ac="save"]');
    save.onclick = async () => {
      // The button is never disabled: tapping it without a pick says what to do instead.
      if (!AC.picked || !AC.sd) { err(AC.q.trim() ? 'Pick your address from the list, so we can find your districts.' : 'Type your street address, then pick it from the list.'); focusField(inp); return; }
      const pr = S.profile || {};
      busy(save, 'Saving…'); err('');
      const { error } = await S.supa.rpc('save_my_profile', { p_name: pr.name || '', p_phone: pr.phone || '', p_address: AC.q, p_house: AC.hd, p_senate: AC.sd, p_interests: pr.interests || [] });
      if (error) { unbusy(save); err(friendly(error)); return; }
      S.profile = { ...pr, address: AC.q, senate_district: AC.sd, house_district: AC.hd };
      rememberDistricts(AC.sd, AC.hd, AC.q);
      Object.assign(AC, { q: '', sd: null, hd: null, picked: false, results: [] });
      S.addrCard = false; app.render(); yay('Saved. Find your senator and representative under More.');
    };
  }
}

// ---------------- More ----------------
// One set of links, two looks: 56px rows in three short groups on a phone; on a wide screen the same links are cards
// in a grid (wide.css .grid3, two across in the reading column), each with a line that says what is behind it. The
// rest of hiphi.org stays folded away on a phone; with room to spare it is simply shown.
const WIDE = window.matchMedia?.('(min-width: 900px)');
WIDE?.addEventListener?.('change', () => { if (document.querySelector('#main .mr-more')) app.render(); });
function moreView() {
  const d = myDistricts(), s = d && seat('S', d.senate), h = d && seat('H', d.house);
  const legSub = s && h ? `${esc(legName(s))} and ${esc(legName(h))}` : 'Find your senator and representative';
  const account = signedIn()
    ? row({ lead: 'settings', title: 'Settings', sub: esc(S.session.user.email || ''), href: '#/settings' })
      + row({ lead: 'log-out', title: 'Sign out', sub: 'Your bills stay on this device', chevron: false, attrs: { 'data-mr-signout': '' } })
    : row({ lead: 'mail-check', title: 'Add my email', sub: 'Get hearing alerts and keep your issues on any device. No password.', href: '#/signin' });
  const hiphi = `${extRow('megaphone', 'Action Center', 'More ways to speak up for health', HIPHI.act)}
          ${extRow('newspaper', 'Newsletter', 'HIPHI news and events by email', HIPHI.news)}
          ${extRow('scroll-text', 'Legislative Recap', 'What passed for health each year', HIPHI.recap)}
          ${extRow('hand-heart', 'Donate', 'Support HIPHI’s work', HIPHI.donate)}`;
  const about = extRow('', 'About HIPHI', 'Hawaiʻi Public Health Institute', HIPHI.about, `<span class="lead mr-mark">${MARK}</span>`);
  return `<div class="mr mr-more">
    <header class="pagehead"><h1 class="hero">More</h1></header>
    <nav class="rows mr-grid grid3" aria-label="Tracker">
      ${row({ lead: 'users', title: 'Your legislators', sub: legSub, href: '#/legislators' })}
      ${row({ lead: 'landmark', title: 'Committees', sub: 'Every Senate and House committee, who sits on it, and what it has now', href: '#/committees' })}
      ${row({ lead: 'circle-help', title: 'How it works', sub: 'Follow bills, say where you stand, speak up when it counts', href: '#/help' })}
      ${account}
    </nav>
    <h2 class="mr-grouphead" id="mr-g-hiphi">From HIPHI</h2>
    <nav class="rows mr-grid grid3" aria-labelledby="mr-g-hiphi">
      ${about}
      ${WIDE?.matches ? hiphi : `<details class="mr-fold"${S.mrFold ? ' open' : ''}>
        <summary class="row"><span class="lead">${icon('ellipsis')}</span><span class="body"><span class="title">More from HIPHI</span></span><span class="end">${icon('chevron-down', { cls: 'chev mr-foldc' })}</span></summary>
        <div class="mr-foldb">
          ${hiphi}
        </div>
      </details>`}
    </nav>
    <h2 class="mr-grouphead" id="mr-g-about">About this tracker</h2>
    <nav class="rows mr-grid grid3" aria-labelledby="mr-g-about">
      ${row({ lead: 'lock', title: 'Privacy', sub: 'What we keep and who sees it', href: '#/privacy' })}
      ${row({ lead: A11Y_ICON, title: 'Accessibility', sub: 'Built to work for everyone', href: '#/privacy?part=access' })}
    </nav>
    <p class="mr-foot">Bill details come from the Hawaiʻi State Legislature and update several times a day. Positions marked HIPHI are HIPHI’s own.</p>
  </div>`;
}
function wireMore() {
  const f = $('.mr-fold'); if (f) f.ontoggle = () => { S.mrFold = f.open; };
  const out = $('[data-mr-signout]');
  if (out) out.onclick = async () => {
    if (out.getAttribute('aria-busy')) return;
    const t = out.querySelector('.title'); out.setAttribute('aria-busy', 'true'); t.textContent = 'Signing out…';
    try { const { error } = await S.supa.auth.signOut(); if (error) throw error; }
    catch (e) { out.removeAttribute('aria-busy'); t.textContent = 'Sign out'; toast(e, true); return; }
    // Signing out reloads the page's data (core's onAuthStateChange). What was saved on this device stays here.
    S.session = null; S.user = null; app.render();
    toast('You’re signed out. Your bills stay on this device.');
  };
}

// ---------------- Help ----------------
// The first visit is small on purpose (Nate, 9/19): pick what you care about, follow the issues inside it (R-018, 9/21),
// say where you stand. Ways to help come on later visits, easiest first. Nothing here promises community totals.
const STEPS = [
  ['Pick what you care about', 'Choose a category or two, like Food & Nutrition or Tobacco, Vaping & Alcohol.'],
  ['Follow the issues inside it', 'Free school meals, the disposable vape ban, free bus rides for kids. HIPHI ticks the ones it recommends. Their bills come to you, this session’s and next session’s, and show up in My issues.'],
  ['Say where you stand', 'Support, oppose or not sure yet. It’s your view, and it doesn’t have to match HIPHI’s. That’s a whole first visit.'],
  ['Speak up when it counts', 'When a bill on one of your issues gets a hearing, Home shows ways to help, easiest first: a two-minute email to the chair, then testimony, a short letter we help you write.'],
];
// One line each, for the words on the bill pages and action cards (the stage names the Capitol uses are not shown).
const WORDS = [
  ['Hearing', 'A public meeting where a committee hears from people, then decides if a bill moves on.'],
  ['Committee', 'A small group of lawmakers who study bills on one subject, like health or schools.'],
  ['Chair', 'The lawmaker who leads a committee and decides which bills get a hearing.'],
  ['Testimony', 'A short letter to a committee saying what you think of a bill and why. Anyone can send one.'],
  ['Stance', 'Where you stand on a bill: support, oppose or not sure yet. It’s yours, and it can differ from HIPHI’s.'],
  ['Deadline', 'The last time to send testimony, usually a day before the hearing. Bills also have dates to clear each step.'],
  ['Passed the House', 'The full House voted yes, so the bill moves to the Senate. It works the same the other way.'],
  ['On hold', 'The committee set the bill aside. This usually stops it for the year.'],
  ['Conference', 'House and Senate members meet to agree on one version of the bill.'],
  ['Stopped', 'The bill missed a deadline or was voted down, so it won’t become law this year.'],
];
function helpView() {
  // Shortcuts only for people with a mouse or trackpad: on a phone they are noise.
  const keys = !!window.matchMedia?.('(pointer: fine)').matches;
  return `<div class="mr mr-help">
    <header class="pagehead"><h1 class="hero">How it works</h1>
      <p class="lede">You don’t need to be an expert. People who speak up help shape Hawaiʻi’s health laws, and it starts with one bill.</p></header>
    <section class="mr-panel" aria-label="How it works in ${STEPS.length} steps">
      <ol class="mr-steps">${STEPS.map(([t, p], i) => `<li><span class="mr-num" aria-hidden="true">${i + 1}</span><div><p class="strong"><span class="sr">Step ${i + 1}: </span>${t}</p><p>${p}</p></div></li>`).join('')}</ol>
      <div class="mr-cta">${btn('Find a bill to follow', { kind: 'primary', icon: 'search', href: '#/find' })}</div>
    </section>
    <section aria-labelledby="mr-words-t">
      <h2 id="mr-words-t">Words you’ll see</h2>
      <dl class="card mr-words">${WORDS.map(([w, d]) => `<div><dt>${w}</dt><dd>${d}</dd></div>`).join('')}</dl>
    </section>
    <section aria-labelledby="mr-hand-t">
      <h2 id="mr-hand-t">Need a hand?</h2>
      <div class="rows">
        ${row({ lead: 'phone', title: 'Call the Public Access Room', sub: `${PAR.text} · Free help with testifying, from the Legislature’s own staff`, href: PAR.tel, chevron: false })}
        ${row({ lead: 'mail', title: 'Email HIPHI', sub: EMAIL, href: `mailto:${EMAIL}`, chevron: false })}
      </div>
    </section>
    ${keys ? `<section aria-labelledby="mr-keys-t">
      <h2 id="mr-keys-t">Keyboard shortcuts</h2>
      <div class="card mr-keys">
        <div><kbd>/</kbd><span>Search issues and bills</span></div>
        <div><kbd>?</kbd><span>Open this page</span></div>
        <div><kbd>Esc</kbd><span>Close the testimony helper</span></div>
      </div>
      <p class="small muted mr-after">Shortcuts are off while you type in a box.</p>
    </section>` : ''}
  </div>`;
}

// ---------------- Add your email (the page behind "Add my email", and the header's "Sign in") ----------------
// M: this visit's page. The typed email and the tick survive a re-render; a fresh arrival starts clean. One box, ticked:
// the page says what the email is for, so giving it is the consent, for hearing alerts and HIPHI's updates alike (C-4).
const M = { email: '', choices: { alerts: true, action: true }, sent: '', demo: false, err: '', sendErr: '' };
const PRIVACY_BULLETS = [
  'HIPHI staff can see the issues and bills you follow, where you stand on them and the actions you mark, so they can reach out about them.',
  'If you add your home address, only you see it. Staff see just your districts.',
  'We never sell your information or share it outside HIPHI. You can delete your account any time.',
];
function signinView() {
  if (S.session) return `<div class="mr mr-signin">
    <header class="pagehead"><h1 class="hero">You’re signed in</h1>
      <p class="lede">Your email is <span class="strong mr-break">${esc(S.session.user.email || '')}</span>. Your issues, stances and actions are saved to your account.</p></header>
    <div class="btnrow">${btn('Go to Settings', { kind: 'primary', icon: 'settings', href: '#/settings' })}${btn('Back to Home', { kind: 'text', href: '#/' })}</div>
  </div>`;
  if (M.sent) return `<div class="mr mr-signin">
    <header class="pagehead"><h1 class="hero">Add your email</h1></header>
    <section class="card mr-sent mr-panel" aria-labelledby="mr-sent-t">
      <span class="mr-sent-ic">${icon('mail-check')}</span>
      <h2 id="mr-sent-t" tabindex="-1">Check your inbox</h2>
      ${M.demo ? `<p>This is the sandbox, so no email was sent. On the real tracker, a link goes to <span class="strong mr-break">${esc(M.sent)}</span>.</p>`
        : `<p>We sent a link to <span class="strong mr-break">${esc(M.sent)}</span>. Open it on this device to finish.</p>
      <p class="small muted">It can take a minute. If you don’t see it, check your spam folder.</p>`}
      <div id="mr-again-msg"></div>
      <div class="btnrow">${M.demo ? '' : btn('Send it again', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-mr-again': '' } })}${btn('Use a different email', { kind: 'text', sm: true, attrs: { 'data-mr-other': '' } })}</div>
    </section>
  </div>`;
  return `<div class="mr mr-signin">
    <header class="pagehead"><h1 class="hero">Add your email</h1>
      <p class="lede">Get hearing alerts and keep your issues on any device. No password: we email you a link.</p></header>
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox, so no email is sent and nothing is saved. You can still try the page.') : ''}
    <form class="card mr-form mr-panel" id="mr-si" novalidate>
      <div class="field"><label for="mr-email">Your email</label>
        <input id="mr-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com"
          value="${esc(M.email)}"${M.err ? ' aria-invalid="true" aria-describedby="mr-email-err"' : ''}>
        ${M.err ? errLine('mr-email-err', M.err) : ''}</div>
      <fieldset class="mr-set"><legend>What we’ll email you</legend>
        ${check('mr-si-keep', KEEP[0], KEEP[1], !!(M.choices.alerts && M.choices.action))}
        <p class="small muted">Untick it if you only want to keep your issues on any device.</p>
      </fieldset>
      <div id="mr-si-msg">${M.sendErr ? inlineErr('mr-si-err', M.sendErr) : ''}</div>
      <div class="mr-send">${submitBtn('Email me a link', 'mail', 'mr-si-send')}</div>
      <p class="small muted mr-returning">Already added your email? Enter it again to sign in on this device.</p>
    </form>
    <section class="mr-priv mr-panel" aria-labelledby="mr-priv-t">
      <h2 id="mr-priv-t">Your privacy</h2>
      <ul class="mr-bullets">${PRIVACY_BULLETS.map(t => `<li>${icon('check')}<span>${t}</span></li>`).join('')}</ul>
      <details class="mr-disc"><summary><span>More about privacy</span>${icon('chevron-down', { cls: 'mr-discc' })}</summary>
        <div class="mr-discb">
          <p>We keep your email, the issues, bills and lists you follow, where you stand on the bills you follow, the actions you mark, your email choices, and anything you add in Settings: your name, phone, address and how you’d like to help.</p>
          <p>When you open the link, the issues, bills, stances and actions saved on this device join your account.</p>
          <p>Every email has a one-click unsubscribe.</p>
          <p><a href="#/privacy">Read the full privacy page</a></p>
        </div></details>
    </section>
  </div>`;
}
function wireSignin() {
  $('[data-mr-other]') && ($('[data-mr-other]').onclick = () => { M.sent = ''; app.render(); requestAnimationFrame(() => $('#mr-email')?.focus()); });
  const again = $('[data-mr-again]');
  if (again) again.onclick = async () => {
    busy(again, 'Sending…');
    let error = null;
    try { await sendEmailLink(M.sent, { hearing_alerts: !!M.choices.alerts, action_alerts: !!M.choices.action }); } catch (e) { error = e; }
    unbusy(again);
    say('mr-again-msg', error ? inlineErr('mr-again-err', friendly(error)) : `<p class="okmsg" role="status">${icon('check')}<span>We sent a new link.</span></p>`);
  };
  const form = $('#mr-si'); if (!form) return;
  const inp = $('#mr-email');
  // An error shows only after the person leaves the box or submits, and clears as soon as the address looks right.
  const setErr = text => {
    M.err = text; inp.closest('.field').querySelector('.err')?.remove();
    if (text) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 'mr-email-err'); inp.insertAdjacentHTML('afterend', errLine('mr-email-err', text)); }
    else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
  };
  const ERR = 'Enter an email like name@example.com';
  inp.oninput = () => { M.email = inp.value; if (M.err && validEmail(inp.value)) setErr(''); };
  inp.onblur = () => { const v = inp.value.trim(); if (v && !validEmail(v)) setErr(ERR); };
  { const c = $('#mr-si-keep'); if (c) c.onchange = () => { M.choices.alerts = M.choices.action = c.checked; }; }
  form.onsubmit = async e => {
    e.preventDefault();
    const email = inp.value.trim(); M.email = email; M.sendErr = ''; say('mr-si-msg', '');
    if (!validEmail(email)) { setErr(ERR); focusField(inp); return; }
    setErr('');
    // core's sendEmailLink is the one way a link goes out (this page, the email ask, the testimony helper). The
    // account does not exist until the link is opened, so it keeps the two choices on this device and loadUser saves
    // them to the account at the first sign-in. In the sandbox it sends nothing and says so ({ demo: true }).
    const b = $('#mr-si-send'); busy(b, 'Sending…'); inp.readOnly = true;
    let r = null, error = null;
    const keep = !!$('#mr-si-keep')?.checked;
    try { r = await sendEmailLink(email, { hearing_alerts: keep, action_alerts: keep }); } catch (err) { error = err; }
    inp.readOnly = false;
    if (error) { unbusy(b); M.sendErr = friendly(error); say('mr-si-msg', inlineErr('mr-si-err', M.sendErr)); return; }
    M.sent = email; M.demo = !!r?.demo;
    S.nudgeSent = email;   // the email ask on Home and in the helper now says "check your inbox" instead of asking again
    app.render(); requestAnimationFrame(() => $('#mr-sent-t')?.focus());
  };
}

// ---------------- Settings ----------------
// F: the form as the person is editing it. Filled from the account on arrival; kept across re-renders so nothing
// typed is lost if the page redraws (a sign-in refresh, a toast's Undo).
let F = null;
function freshForm() {
  const pr = S.profile || {}, p = S.user?.prefs || {};
  F = { name: pr.name || '', phone: pr.phone || '', ints: new Set(pr.interests || []),
    choices: { alerts: p.hearing_alerts === true, action: p.action_alerts === true },
    addr: { q: pr.address || '', sd: pr.senate_district || null, hd: pr.house_district || null, picked: !!pr.senate_district, results: [] },
    del: false };
}
function settingsView() {
  if (!S.session) return `<div class="mr mr-settings">
    <header class="pagehead"><h1 class="hero">Settings</h1>
      <p class="lede">${DEMO ? 'Settings appear here once someone has added their email. No email is sent in the sandbox, so there is nothing to set yet.' : 'Add your email to choose your alerts and add your details.'}</p></header>
    ${btn('Add my email', { kind: 'primary', icon: 'mail-check', href: '#/signin' })}
  </div>`;
  if (!S.user) return `<div class="mr mr-settings"><header class="pagehead"><h1 class="hero">Settings</h1></header><div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:160px"></div><div class="skel" style="height:280px"></div></div></div>`;
  if (!F) freshForm();
  const p = S.user.prefs || {};
  return `<div class="mr mr-settings">
    <header class="pagehead"><h1 class="hero">Settings</h1><p class="meta mr-break">Your email: ${esc(S.session.user.email || '')}</p></header>
    <form id="mr-st" novalidate>
      <section aria-labelledby="mr-em-t">
        <h2 id="mr-em-t">Emails from HIPHI</h2>
        <div class="card mr-checks">${CHOICES.map(([k, , t, h]) => check(`mr-st-${k}`, t, h, F.choices[k])).join('')}
          <p class="small muted">${p.consent_at ? `You chose these on ${esc(fmtDate(p.consent_at, { month: 'short', year: 'numeric' }))}. ` : ''}Every email has a one-click unsubscribe.</p></div>
      </section>
      <section aria-labelledby="mr-you-t">
        <h2 id="mr-you-t">About you</h2>
        <p class="small muted mr-under">Optional. It helps HIPHI connect you with your own lawmakers.</p>
        <div class="card">
          <div class="field"><label for="mr-name">Your name</label><input id="mr-name" type="text" value="${esc(F.name)}" maxlength="120" autocomplete="name" autocapitalize="words"></div>
          <div class="field"><label for="mr-phone">Phone <span class="mr-opt">(optional)</span></label><input id="mr-phone" type="tel" value="${esc(F.phone)}" maxlength="40" autocomplete="tel" inputmode="tel"></div>
          ${addrField('mr-st', F.addr, { help: 'Only you see your address. HIPHI staff see just your districts.' })}
          <fieldset class="mr-set"><legend>How would you like to help?</legend>
            ${INTERESTS.map(([k, l]) => check(`mr-int-${k}`, l, '', F.ints.has(k), ` data-mr-int="${k}"`)).join('')}
          </fieldset>
        </div>
      </section>
      <div class="mr-save">${submitBtn('Save', 'check', 'mr-st-save')}
        <div id="mr-st-msg" role="status"></div></div>
    </form>
    <section class="mr-data mr-panel" aria-labelledby="mr-data-t">
      <h2 id="mr-data-t">Your data</h2>
      <p>We keep your email, the issues you picked, the bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark, your email choices and what you add above. HIPHI staff can see all of it, except your street address: they see just your districts. We never sell it or share it outside HIPHI. <a href="#/privacy">Read about privacy</a></p>
      ${F.del ? `<div class="mr-confirm" role="group" aria-labelledby="mr-del-t">
          ${notice('bad', 'triangle-alert', `<p class="strong" id="mr-del-t" tabindex="-1">Delete your account for good?</p><p>This deletes your account, the issues and bills you follow, where you stand on them and the actions you marked, here and on our side. It can’t be undone.</p>`)}
          <div id="mr-del-msg"></div>
          <div class="btnrow">${btn('Yes, delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'yes' } })}${btn('Keep my account', { kind: 'text', attrs: { 'data-mr-del': 'no' } })}</div>
        </div>`
      : `<div class="mr-delrow">${btn('Delete my account', { kind: 'danger', icon: 'trash-2', attrs: { 'data-mr-del': 'ask' } })}</div>`}
    </section>
  </div>`;
}
function wireSettings() {
  const form = $('#mr-st'); if (!form || !F) return;
  $('#mr-name').oninput = e => { F.name = e.target.value; };
  $('#mr-phone').oninput = e => { F.phone = e.target.value; };
  CHOICES.forEach(([k]) => { const c = $(`#mr-st-${k}`); c.onchange = () => { F.choices[k] = c.checked; }; });
  form.querySelectorAll('[data-mr-int]').forEach(c => c.onchange = () => { if (c.checked) F.ints.add(c.dataset.mrInt); else F.ints.delete(c.dataset.mrInt); });
  wireAddr('mr-st', F.addr);
  const msg = $('#mr-st-msg');
  form.onsubmit = async e => {
    e.preventDefault();
    const b = $('#mr-st-save'); if (b.getAttribute('aria-busy')) return;
    msg.innerHTML = ''; busy(b, 'Saving…');
    const a = F.addr, addr = a.q.trim(), pr = S.profile || {};
    // Districts come from a picked address; an address kept as it was keeps its districts; anything else has none.
    const same = addr && addr === (pr.address || '');
    const sd = a.picked ? a.sd : same ? pr.senate_district : null, hd = a.picked ? a.hd : same ? pr.house_district : null;
    const prefs = { ...(S.user.prefs || {}), hearing_alerts: F.choices.alerts, action_alerts: F.choices.action, consent_at: new Date().toISOString() };
    const interests = INTERESTS.map(([k]) => k).filter(k => F.ints.has(k));
    const [r1, r2] = await Promise.all([
      S.supa.from('public_users').update({ prefs }).eq('id', S.user.id),
      S.supa.rpc('save_my_profile', { p_name: F.name.trim(), p_phone: F.phone.trim(), p_address: addr, p_house: hd || null, p_senate: sd || null, p_interests: interests }),
    ]);
    unbusy(b);
    if (!r1.error) { S.user.prefs = prefs; S.consentCard = false; }
    if (!r2.error) { S.profile = { ...pr, name: F.name.trim() || null, phone: F.phone.trim() || null, address: addr || null, senate_district: sd || null, house_district: hd || null, interests };
      if (sd && hd && a.picked) rememberDistricts(sd, hd, addr); }
    const err = r1.error || r2.error;
    if (err) { msg.innerHTML = inlineErr('mr-st-err', friendly(err)); return; }
    // One confirmation, next to the button (the status region announces it); a toast here would cover Your data.
    msg.innerHTML = `<p class="okmsg">${icon('circle-check')}<span>${addr && !sd ? 'Saved. Pick your address from the list to find your legislators.' : 'Saved. Mahalo!'}</span></p>`;
  };
  // The question and both answers come into view together (above the tab bar); focus goes to the question.
  const ask = $('[data-mr-del="ask"]'); if (ask) ask.onclick = () => { F.del = true; app.render();
    requestAnimationFrame(() => { $('#mr-del-t')?.focus({ preventScroll: true }); $('.mr-confirm')?.scrollIntoView({ block: 'center' }); }); };
  const no = $('[data-mr-del="no"]'); if (no) no.onclick = () => { F.del = false; app.render(); requestAnimationFrame(() => $('[data-mr-del="ask"]')?.focus()); };
  const yes = $('[data-mr-del="yes"]');
  if (yes) yes.onclick = async () => {
    busy(yes, 'Deleting…');
    const { error } = await S.supa.rpc('delete_my_account');
    if (error) { unbusy(yes); say('mr-del-msg', inlineErr('mr-del-err', friendly(error))); return; }
    // The account is gone; the copies of it on this device go too (issues, bills, stances, actions, list follows, districts,
    // and the email the testimony helper remembered; the name, town and letters typed there were never on the account).
    try { [LOCAL_KEY, ISSUES_KEY, CATS_KEY, SKIPS_KEY, STANCE_KEY, DONE_KEY, DONE_AT_KEY, LISTS_KEY, CONSENT_KEY, DISTRICTS_KEY].forEach(k => localStorage.removeItem(k));
      const me = JSON.parse(localStorage.getItem('hiphi_me') || 'null'); if (me && me.email) { delete me.email; localStorage.setItem('hiphi_me', JSON.stringify(me)); }
      // the picked issues were on the account too; the guided start stays finished, so the person is not sent through it again
      const w = JSON.parse(localStorage.getItem('hiphi_wiz') || 'null'); if (w && w.issues?.length) { w.issues = []; localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } } catch { /* private mode */ }
    S.direct = new Set(); S.issueFollows = new Set(); S.catFollows = new Set(); S.skips = new Set(); recomputeWatch();
    S.stances = {}; S.done = new Set(); S.doneAt = {}; S.listFollows = new Set(); S.profile = {}; F = null;
    try { await S.supa.auth.signOut(); } catch { /* the account is already deleted */ }
    S.session = null; S.user = null;
    app.go('#/', { replace: true });
    toast('Your account is deleted. Mahalo for speaking up.');
  };
}

// ---------------- Privacy (and the accessibility statement) ----------------
// Every sentence here has to be true of the code (assessment, 9/19: "HIPHI gets nothing about you" was too strong,
// because looking up legislators sends the typed address to our lookup). Stances (9/19): kept in this browser until
// someone adds their email; after that they ride on the follow (watchlist.stance) and staff can see them, exactly
// like follows and actions. Numbers about other people are totals inside one bill or hearing, from 10 people.
const PRIVACY = [
  ['lock', 'If you don’t add your email', 'We don’t know who you are. The issues and bills you follow, where you stand on them and the actions you mark stay in this browser, on this device. Clearing your browser data erases them.'],
  ['user', 'If you add your email', 'We keep your email, the issues, bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark, your email choices, and anything you add in Settings. HIPHI staff can see this, so they can reach out about your issues. What you saved on this device joins your account.'],
  ['users', 'Numbers about other people', 'A bill or a hearing may show how many people have acted on it, or how many support or oppose it. These are totals of people who added their email. They never show a name, and they appear only once 10 people are in them.'],
  ['map-pin', 'Your home address', 'If you add it in Settings, only you see it. HIPHI staff see just the districts it falls in. When you look up your legislators, the address you type goes to our address lookup, and to the U.S. Census Bureau’s if ours can’t place it, only to find your districts. It isn’t saved.'],
  ['notebook-pen', 'Your testimony', 'Your name, town and letter stay on this device until you send the letter on the Capitol website. Testimony is public there: the Capitol posts your name and letter online. If you type your email in the letter helper, we use it for your link and your hearing alerts. It is never added to your letter.'],
  ['shield-check', 'What we never do', 'We never sell your information or share it outside HIPHI. Every email has a one-click unsubscribe. You can delete your account, and everything in it, from Settings at any time.'],
];
function privacyView() {
  return `<div class="mr mr-privacy">
    <header class="pagehead"><h1 class="hero">Privacy</h1><p class="lede">What we keep, who sees it, and how to remove it.</p></header>
    <div class="card mr-facts">${PRIVACY.map(([ic, t, p], i) => `<section aria-labelledby="mr-pv-${i}"><span class="mr-factic">${icon(ic)}</span><div><h2 id="mr-pv-${i}">${t}</h2><p>${p}</p></div></section>`).join('')}</div>
    <p class="mr-ext">${btn('HIPHI’s website privacy policy', { kind: 'text', icon: 'external-link', href: HIPHI.privacy, attrs: { target: '_blank', rel: 'noopener' } })}</p>
    <section class="mr-access mr-panel" id="mr-access" aria-labelledby="mr-access-t">
      <h2 id="mr-access-t" tabindex="-1">Accessibility</h2>
      <p>We want everyone in Hawaiʻi to be able to use this tracker. It is built to work with screen readers, a keyboard and zoom. Buttons are large enough for a thumb, and motion turns off when your device asks for less of it.</p>
      <p>If something gets in your way, email <a href="mailto:${EMAIL}">${EMAIL}</a> and we’ll fix it.</p>
      <p class="mr-ext">${btn('HIPHI’s accessibility statement', { kind: 'text', icon: 'external-link', href: HIPHI.access, attrs: { target: '_blank', rel: 'noopener' } })}</p>
    </section>
  </div>`;
}
function wirePrivacy() {
  // "Accessibility" on More opens this page at its statement. (The router scrolls to the top after wiring, so wait a frame.)
  if (!/[?&]part=access\b/.test(location.hash)) return;
  requestAnimationFrame(() => { const h = $('#mr-access-t'); if (!h) return; h.focus({ preventScroll: true }); h.closest('section').scrollIntoView({ block: 'start' }); });
}

// ---------------- the module ----------------
const VIEWS = { more: moreView, help: helpView, signin: signinView, settings: settingsView, privacy: privacyView };
const WIRES = { more: wireMore, signin: wireSignin, settings: wireSettings, privacy: wirePrivacy };
const TITLES = { more: 'More', help: 'How it works', signin: 'Add your email', settings: 'Settings', privacy: 'Privacy' };
export default {
  tab: 'more',
  title: route => TITLES[route.name] || 'More',
  render(route) {
    // A fresh arrival (from another screen) starts the page clean; a re-render of the same page keeps what was typed.
    const fresh = !document.querySelector(`#main .mr-${route.name}`);
    if (fresh && route.name === 'signin') Object.assign(M, { sent: '', err: '', sendErr: '' });
    if (fresh && route.name === 'settings') F = null;
    return (VIEWS[route.name] || moreView)();
  },
  wire(route) { (WIRES[route.name] || (() => {}))(route); },
};
