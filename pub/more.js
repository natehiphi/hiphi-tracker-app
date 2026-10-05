// More (redesign 9/19; plan 5 "More" and 7 "Help, Settings, Sign in, More"): the fourth tab and the pages under it.
//   #/more      a short page of rows (link cards in a grid on a wide screen): your legislators, every bill HIPHI tracks
//               (#/allbills, pub/allbills.js, R-091), committees, how it works, adding
//               your email (since R-147 the person's profile, first), HIPHI itself, privacy and accessibility
//   #/help      ready-made conversations (R-075: pub/talk.js, loaded on first use; #/help/<slug> opens one)
//   #/signin    "Add your email": one email field, one "keep me updated" box (hearings on your issues and HIPHI's updates,
//               ticked; DESIGN C-4, Nate 9/20), privacy in 3 bullets
//   #/alerts    "Get alerts on your issues" (R-146): the phone-first box (pub/alerts.js); once a number is given, "Text
//               alerts are on" with Change number and Stop texts. Email goes to #/signin, which keeps its own box.
//   #/settings  since R-147 (10/4) the profile, pub/profile.js (#/profile): More's first row is the person
//   #/privacy   what we keep and who sees it, then a short accessibility statement
// ONE vocabulary for the email step (Nate, 9/19; the assessment counted six names for it): a signed-out person is
// offered "Add my email", the page is "Add your email", the button is "Email me a link". "Sign in" is only the
// header's word for returning people, plus one small line on that page. Giving an email to be kept updated IS the
// consent, for hearing alerts and HIPHI's own updates alike, named plainly as one choice (C-4). The profile keeps the two
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
  sendEmailLink, validEmail, textSaved } from './core.js';
import { btn, row, notice, inlineErr, skeleton } from './ui.js';
import { MARK } from './art.js';
import { islandKey } from './people.js';
import { issuesLink } from './core.js';   // the My issues link (R-123)
import { pendingPlace } from './mylists.js';
import { alertFields, alertButton, wireAlertForm, fmtPhone, phoneDigits, saveText, stopText, codeStep } from './alerts.js';
import { codesOn, myEmail, sendCode, verifyCode, codeErr, tooSoon, listenForCode } from './phone.js';   // R-155
import { hasProfile, myName, myTitles, initials, saveProfile } from './myprofile.js';   // More's first row (R-147)
import { titleLabel } from './titles.js';

// hiphi.org pages, from the site's own footer and menus (research 9/18). Donate stays last wherever these appear.
const HIPHI = {
  about: 'https://www.hiphi.org/about/', act: 'https://www.hiphi.org/act/', news: 'https://www.hiphi.org/sign-up/',
  recap: 'https://www.hiphi.org/policy/legrecap/', donate: 'https://www.hiphi.org/donate/',
  privacy: 'https://www.hiphi.org/privacy/', access: 'https://www.hiphi.org/accessibility-statement/',
};
const EMAIL = 'contact@hiphi.org';   // the address on every hiphi.org page
const DISTRICTS_KEY = 'hiphi_districts';   // shared with the people and bill screens: { senate, house, label, island }
// Lucide has an "accessibility" figure; icons.js may not carry it yet, and icon() would draw an empty circle.
const A11Y_ICON = ICONS.accessibility ? 'accessibility' : 'eye';
const $ = s => document.querySelector(s);
const signedIn = () => !!(S.session && S.user);

// The two email choices, worded once, for the card after sign in and the profile (R-147), where each can be turned off on its own.
// Where a person GIVES their email they are one choice, "keep me updated", ticked (DESIGN C-4; Nate, 9/20).
export const CHOICES = [
  ['alerts', 'hearing_alerts', 'Email me when a bill on one of my issues gets a hearing', 'About 2 days’ notice, time to send testimony.'],
  ['action', 'action_alerts', 'Email me when HIPHI has an update or a way to help', 'A few times a session.'],
];
const KEEP = ['Keep me updated', 'Hearings on your issues, and HIPHI’s updates and ways to help. Unsubscribe in one tap, any time.'];
export const INTERESTS = [['testify', 'I’d testify in person'], ['story', 'I have a story to share'], ['quote', 'HIPHI may quote me'],
  ['host', 'I could host or help at an event'], ['volunteer', 'I’d like to volunteer']];
export const check = (id, title, help, on, attrs = '') => `<label class="check mr-check" for="${id}"><input type="checkbox" id="${id}"${on ? ' checked' : ''}${attrs}>
  <span class="mr-ctext"><span class="mr-ctitle">${title}</span>${help ? `<span class="mr-chelp">${help}</span>` : ''}</span></label>`;
const errLine = (id, text) => `<span class="err" id="${id}">${icon('triangle-alert')}<span>${esc(text)}</span></span>`;
// Loading state for a button: a spinning loader and "Sending…"; unbusy puts the button back exactly as it was.
const was = new WeakMap();
export const busy = (el, label) => { if (!el) return; was.set(el, el.innerHTML); el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}<span>${esc(label)}</span>`; };
export const unbusy = el => { if (!el) return; el.removeAttribute('aria-busy'); if (was.has(el)) el.innerHTML = was.get(el); };
// ui.js btn() always writes type="button" first (a second type attribute is ignored), so a form's submit button is
// written here with the same classes. A real submit button lets Enter on the keyboard send the form too.
export const submitBtn = (label, ic, id) => `<button type="submit" class="btn primary" id="${id}">${icon(ic)}<span>${label}</span></button>`;
// An inline error under a card's buttons (role=alert), or nothing.
export const say = (id, html) => { const box = document.getElementById(id); if (box) box.innerHTML = html; };
// Focus a field with its label in view (a plain focus() tucks the label under the sticky header).
export const focusField = inp => { inp.focus({ preventScroll: true }); inp.closest('.field')?.scrollIntoView({ block: 'center' }); };
const extRow = (lead, title, sub, href, leadHtml) => row({ lead, leadHtml, title, sub, href, chevron: false,
  end: `${icon('external-link', { cls: 'chev' })}<span class="sr">(opens hiphi.org)</span>`, attrs: { target: '_blank', rel: 'noopener' } });

// ---------------- your legislators, from the districts saved on this device or the account ----------------
export function seat(ch, d) {
  if (!d) return null;
  // After a mid-term appointment the directory can list two people for one seat; the one with a Capitol email serves.
  const ls = (S.legislators || []).filter(l => l.chamber === ch && +l.district === +d && l.active !== false);
  return ls.find(l => l.email) || ls[0] || null;
}
export function myDistricts() {
  try { const d = JSON.parse(localStorage.getItem(DISTRICTS_KEY) || 'null'); if (d && +d.senate && +d.house) return { senate: +d.senate, house: +d.house }; } catch { /* private mode */ }
  const p = S.profile || {};
  return p.senate_district && p.house_district ? { senate: +p.senate_district, house: +p.house_district } : null;
}
export const legName = l => l ? `${legTitle(l)} ${l.name}` : '';
// "Your senator: Sen. Chris Lee" / "Your representative: Rep. Lisa Marten" for an address someone picked.
export function distHTML(sd, hd) {
  if (!sd && !hd) return '';
  const s = seat('S', sd), h = seat('H', hd);
  const line = (word, l, ch, d) => d ? `<span>${word}: <span class="strong">${l ? esc(legName(l)) : `${ch} District ${d}`}</span></span>` : '';
  return `${icon('map-pin')}<span class="mr-distlines">${line('Your senator', s, 'Senate', sd)}${line('Your representative', h, 'House', hd)}</span>`;
}

// ---------------- home address with suggestions (the profile, R-147, and the card after sign in) ----------------
// Suggestions come from our own table of every Hawaiʻi street address, which carries the districts (fetchAddrSuggest,
// as in track.js). A suggestion without districts asks districts_at() for them.
export function splitAddr(label) {
  const [street = '', ...rest] = String(label || '').replace(/\s+/g, ' ').trim().split(/,\s*/);
  let town = rest.join(', ').replace(/\s*\d{5}(-\d{4})?$/, '').trim();
  // A town in capitals ("KANEOHE") reads better as "Kaneohe"; the table's usual mixed case is kept as written.
  if (town && town === town.toUpperCase()) town = town.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { street, town };
}
export function addrField(pfx, st, { label = 'Home address', help } = {}) {
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
export function wireAddr(pfx, st, onChange = () => {}) {
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
export function rememberDistricts(sd, hd, address) {
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
    <p class="small muted">HIPHI staff can see the issues and bills you follow, where you stand on them and what you do here, so they can reach out about them. Change this any time in your profile.</p>
    <div id="mr-cc-msg"></div>
    <div class="btnrow">${btn('Save my choices', { kind: 'secondary', sm: true, attrs: { 'data-mr-cc': 'save' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-mr-cc': 'later' } })}</div>
  </section>`;
  if (S.addrCard) return `<section class="card mr-acct" id="mr-ac" aria-labelledby="mr-ac-t">
    ${acctHead('landmark', 'mr-ac-t', 'Find your legislators')}
    <p class="small">Add your home address, and we’ll point you to your own senator and representative when a bill needs a voice.</p>
    ${addrField('mr-ac', AC, { help: 'Used once to find your districts, then forgotten. Only the districts are saved.' })}
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
      S.user.prefs = prefs; S.consentCard = false; app.render(); yay('Saved. Change it any time in your profile, under More.');
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
      busy(save, 'Saving…'); err('');
      // Only the districts change (R-147's save, backend 125); the old save rewrote name, phone and interests too.
      try { await saveProfile({ house: AC.hd, senate: AC.sd }); } catch (error) { unbusy(save); err(friendly(error)); return; }
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
// More's first row (R-147): initials, name, and what the profile says about them; or the invitation.
function meRow() {
  if (!hasProfile()) return `<a class="card mr-me mr-me-new" href="#/profile"><span class="pf-av" aria-hidden="true">${icon('user-plus')}</span>
    <span class="mr-me-t"><span class="mr-me-n">Make your profile</span><span class="mr-me-s">Get a text or email when your issues have a hearing, and keep your issues and letters saved. Free.</span></span>${icon('chevron-right', { cls: 'chev' })}</a>
    ${signedIn() ? '' : codesOn() ? `<p class="small mr-me-in">Made one before? <a href="#/signin?by=number">Sign in</a></p>`
      // R-155 (Nate 10/5), until codes are on: a number keeps the profile on its phone, so a laptop says how to bring it
      // here (only a wide screen: on a phone the sentence would contradict itself; the review, 10/5).
      : `<p class="small mr-me-in">Made one before? <a href="#/signin">Sign in with your email</a></p>
    ${WIDE?.matches ? '<p class="small mr-me-in mr-me-num">Signed up with your number? Add your email on your phone, then sign in here with it.</p>' : ''}`}`;
  const name = myName(), ini = initials(name), d = myDistricts(), ts = myTitles();
  const about = [ts.slice(0, 2).map(titleLabel).join(', '), d ? `Senate ${d.senate}, House ${d.house}` : ''].filter(Boolean).join(' · ');
  return `<a class="card mr-me" href="#/profile"><span class="pf-av" aria-hidden="true">${ini ? esc(ini) : icon('user')}</span>
    <span class="mr-me-t"><span class="mr-me-n">${name ? esc(name) : 'Your profile'}</span>${about ? `<span class="mr-me-s">${esc(about)}</span>` : ''}<span class="mr-me-l">${name ? 'Your profile' : 'Add your name and titles'}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`;
}
function moreView() {
  const d = myDistricts(), s = d && seat('S', d.senate), h = d && seat('H', d.house);
  const legSub = s && h ? `${esc(legName(s))} and ${esc(legName(h))}` : 'Find your senator and representative';
  // The person comes first (R-147, Nate 10/4: "located where profiles usually sit"): their profile as the page's first row,
  // or, without one, the invitation to make one with a number or an email (the R-146 box, on #/profile). The profile holds
  // what Settings, Sign out, Text alerts and Add my email used to (pub/profile.js).
  const me = meRow();
  const hiphi = `${extRow('megaphone', 'Action Center', 'More ways to speak up for health', HIPHI.act)}
          ${extRow('newspaper', 'Newsletter', 'HIPHI news and events by email', HIPHI.news)}
          ${extRow('scroll-text', 'Legislative Recap', 'What passed for health each year', HIPHI.recap)}
          ${extRow('hand-heart', 'Donate', 'Support HIPHI’s work', HIPHI.donate)}`;
  const about = extRow('', 'About HIPHI', 'Hawaiʻi Public Health Institute', HIPHI.about, `<span class="lead mr-mark">${MARK}</span>`);
  return `<div class="mr mr-more">
    <header class="pagehead"><h1 class="hero">More</h1></header>
    ${me}
    <nav class="rows mr-grid grid3" aria-label="Tracker">
      ${row({ lead: 'sparkles', title: 'Your session', sub: 'What you did and what came of it. Only you see it.', href: '#/recap' })}
      ${row({ lead: 'users', title: 'Your legislators', sub: legSub, href: '#/legislators' })}
      ${row({ lead: 'rows-3', title: 'Every bill HIPHI tracks', sub: 'One list of HIPHI’s bills, grouped by hearing status', href: '#/allbills' })}
      ${row({ lead: 'landmark', title: 'Committees', sub: 'Every Senate and House committee, who sits on it, and what it has now', href: '#/committees' })}
      ${row({ lead: 'circle-help', title: 'Help', sub: 'Plain answers on hearings, testimony, deadlines and this tracker', href: '#/help' })}
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
    ${issuesLink() ? `<h2 class="mr-grouphead" id="mr-g-keep">Your issues, anywhere</h2>
    <div class="rows mr-grid" aria-labelledby="mr-g-keep">${row({ lead: 'link', title: 'My issues link', sub: 'Open it in any browser or phone and your issues come with you. No account needed.', attrs: { 'data-mr-keep': '1', role: 'button', tabindex: '0' } })}</div>` : ''}
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
  // My issues link (R-123): copied, with a text-it-to-myself way beside it in the toast.
  $('[data-mr-keep]')?.addEventListener('click', async () => { const link = issuesLink(); try { await navigator.clipboard.writeText(link); toast('Your issues link is copied. Paste it into a text or a note, and open it on any phone.', { yay: true }); } catch { location.href = `sms:?&body=${encodeURIComponent('My issues on HIPHI’s Bill Tracker: ' + link)}`; } });
}

// ---------------- Help ----------------
// Since R-075 (Nate, 9/29) Help is a page of ready-made conversations: pub/talk.js draws it, pub/talk-data.js holds the
// words. It replaced the four steps and the "Words you'll see" list, which the conversations now cover one question at a
// time (the three lessons, the Public Access Room, Email HIPHI and the shortcuts moved with it). The module loads the
// first time Help is opened, so no other page waits for it; until then Help shows the loading shape for a moment.
let TALK = null, talkLoad = null;
function helpView(route) {
  if (TALK) return TALK.view(route);
  talkLoad ??= import('./talk.js').then(m => { TALK = m; if (document.body.dataset.screen === 'help') app.render(); })
    .catch(e => { console.error(e); talkLoad = null; });
  return `<div class="mr mr-help">${skeleton(4)}</div>`;
}
const wireHelp = route => { if (TALK) TALK.wire(route); };

// ---------------- Add your email (the page behind "Add my email", and the header's "Sign in") ----------------
// M: this visit's page. The typed email and the tick survive a re-render; a fresh arrival starts clean. One box, ticked:
// the page says what the email is for, so giving it is the consent, for hearing alerts and HIPHI's updates alike (C-4).
// The box starts empty (Nate 10/1, R-101 rule 1; B-12): ticking it is the consent, never a box someone has to notice.
const M = { email: '', choices: { alerts: false, action: false }, sent: '', demo: false, err: '', sendErr: '' };
const PRIVACY_BULLETS = [
  'HIPHI staff can see the issues and bills you follow, where you stand on them, the actions you mark and which of our emails you open, so they can reach out about them.',
  'Your home address is used only to find your districts and is never kept. Staff see just your districts.',
  'We never sell your information or give it to other groups. You can delete your account any time.',
];
// Sign in with your number (R-155): #/signin?by=number once codes are on (the header's and More's "Sign in"). One box, then
// the code; the right code signs in (or makes the profile), and this device's issues, stances and letters join it.
const PI = { phone: '', at: null, code: '', done: false };
const byNumber = () => codesOn() && !S.session && /[?&]by=number\b/.test(location.hash);
function phoneInView() {
  const code = !!PI.at, t = textSaved();
  if (PI.done) return `<div class="mr mr-signin mr-phonein">
    <header class="pagehead"><h1 class="hero" id="mr-pi-h" tabindex="-1">Code accepted</h1>
      <p class="lede">This is the sandbox, so you stay signed out. On the real tracker you’re now signed in with ${esc(fmtPhone(PI.phone))}, and your profile is here.</p></header>
    <div class="btnrow">${btn('Back to More', { kind: 'secondary', href: '#/more' })}</div></div>`;
  return `<div class="mr mr-signin mr-phonein">
    <header class="pagehead"><h1 class="hero" id="mr-pi-h" tabindex="-1">Sign in</h1>
      <p class="lede">${code ? 'Enter the code we just texted you.' : 'With the mobile number you gave us. We’ll text you a 6-digit code. No password.'}</p></header>
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox, so no code is sent and nothing is saved. Type any 6 digits.') : ''}
    <form class="card mr-form mr-panel" id="mr-pi" novalidate>
      ${code ? `<div class="field al-field al-codefield"><label for="mr-pi-code">6-digit code</label>
          <p class="help al-codeto" id="mr-pi-codeto">We texted a code to <span class="strong al-nowrap">${esc(fmtPhone(PI.phone))}</span>. It can take a minute.</p>
          <input id="mr-pi-code" class="al-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" enterkeyhint="done" aria-describedby="mr-pi-codeto" value="${esc(PI.code)}">
          <span class="err" id="mr-pi-err" role="alert"></span></div>
        <p class="al-swaprow al-coderow"><button type="button" class="btn text sm" data-pi-again>Send a new code</button><button type="button" class="btn text sm" data-pi-other>Use a different number</button></p>
        <p class="small al-status" id="mr-pi-status" role="status"></p>
        <div class="mr-send">${submitBtn('Sign in', 'log-in', 'mr-pi-send')}</div>`
      : `<div class="field al-field"><label for="mr-pi-phone">Mobile number</label>
          <input id="mr-pi-phone" type="tel" inputmode="tel" autocomplete="tel-national" enterkeyhint="send" placeholder="(808) 555-0123" maxlength="20" value="${esc(PI.phone ? fmtPhone(PI.phone) : t ? fmtPhone(t.phone) : '')}">
          <span class="err" id="mr-pi-err" role="alert"></span></div>
        <p class="al-fine">New here? The same code makes your profile. Message and data rates may apply.</p>
        <div class="mr-send">${submitBtn('Text me a code', 'message-square', 'mr-pi-send')}</div>`}
    </form>
    <p class="small mr-returning">Gave us your email instead? <a href="#/signin">Sign in with your email</a></p>
  </div>`;
}
function wirePhoneIn() {
  const form = $('#mr-pi'); if (!form) return;
  const inp = $('#mr-pi-code') || $('#mr-pi-phone'), err = $('#mr-pi-err'), b = $('#mr-pi-send');
  const desc = PI.at ? 'mr-pi-codeto' : '';
  const show = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', `mr-pi-err ${desc}`.trim()); err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; inp.focus(); };
  const clear = () => { err.innerHTML = ''; inp.removeAttribute('aria-invalid'); if (desc) inp.setAttribute('aria-describedby', desc); else inp.removeAttribute('aria-describedby'); };
  const status = text => say('mr-pi-status', esc(text));
  let going = false;
  if (!PI.at) {
    inp.oninput = () => { if (err.innerHTML) clear(); };
    form.onsubmit = async e => {
      e.preventDefault(); if (going) return;
      const d = phoneDigits(inp.value);
      if (!d) { show(inp.value.trim() ? 'Enter a 10-digit mobile number, like (808) 555-0123.' : 'Add your mobile number.'); return; }
      going = true; busy(b, 'Sending…');
      try { await sendCode(d); } catch (error) { going = false; unbusy(b); show(codeErr(error, { sending: true })); return; }
      Object.assign(PI, { phone: d, at: Date.now(), code: '' }); app.render(); requestAnimationFrame(() => $('#mr-pi-code')?.focus());
    };
    return;
  }
  inp.oninput = () => { const v = inp.value.replace(/\D/g, '').slice(0, 6); if (v !== inp.value) inp.value = v; PI.code = v; if (err.innerHTML) clear(); if (v.length === 6) form.requestSubmit?.(); };
  listenForCode(inp, () => { PI.code = inp.value; form.requestSubmit?.(); });
  $('[data-pi-again]').onclick = async () => {
    if (tooSoon()) { status('Wait a minute before asking for a new code.'); return; }
    status('Sending a new code…');
    try { await sendCode(PI.phone); status(`We sent a new code to ${fmtPhone(PI.phone)}.`); } catch (e) { status(''); show(codeErr(e, { sending: true })); }
  };
  $('[data-pi-other]').onclick = () => { PI.at = null; PI.code = ''; app.render(); requestAnimationFrame(() => { const i = $('#mr-pi-phone'); if (i) { i.focus(); i.select(); } }); };
  form.onsubmit = async e => {
    e.preventDefault(); if (going) return;
    const v = inp.value.replace(/\D/g, '');
    if (v.length !== 6) { show(v ? 'Enter all 6 digits from the text.' : 'Enter the 6-digit code from the text.'); return; }
    going = true; busy(b, 'Signing in…'); inp.readOnly = true;
    let r;
    try { r = await verifyCode(PI.phone, v, { add: false }); } catch (error) { going = false; unbusy(b); inp.readOnly = false; show(codeErr(error)); return; }
    if (r.demo) { PI.done = true; app.render(); requestAnimationFrame(() => $('#mr-pi-h')?.focus()); return; }
    Object.assign(PI, { phone: '', at: null, code: '' });
    app.go('#/profile', { replace: true });
    yay('You’re signed in.');
  };
}
// The email box, on the page for a newcomer and for a profile made with a number (which adds its email to the same account).
function emailForm(returning) {
  return `<form class="card mr-form mr-panel" id="mr-si" novalidate>
      <div class="field"><label for="mr-email">Your email</label>
        <input id="mr-email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.com"
          value="${esc(M.email)}"${M.err ? ' aria-invalid="true" aria-describedby="mr-email-err"' : ''}>
        ${M.err ? errLine('mr-email-err', M.err) : ''}</div>
      <fieldset class="mr-set"><legend>What we’ll email you</legend>
        ${check('mr-si-keep', KEEP[0], KEEP[1], !!(M.choices.alerts && M.choices.action))}
        <p class="small muted">Without it, your email only keeps your issues on any device.</p>
      </fieldset>
      <div id="mr-si-msg">${M.sendErr ? inlineErr('mr-si-err', M.sendErr) : ''}</div>
      <div class="mr-send">${submitBtn('Email me a link', 'mail', 'mr-si-send')}</div>
      <p class="small muted mr-returning">${returning}</p>
    </form>`;
}
function signinView() {
  if (byNumber()) return phoneInView();
  // A profile made with a number (R-155): the email joins that same account once its link is opened.
  if (S.session && !myEmail() && !M.sent) return `<div class="mr mr-signin">
    <header class="pagehead"><h1 class="hero">Add your email</h1>
      <p class="lede">Get alerts by email too, and sign in with either. No password: we email you a link to confirm it.</p></header>
    ${DEMO ? '' : emailForm('Gave this email on another phone or computer before? Sign out first, then sign in with it.')}
  </div>`;
  if (S.session && !M.sent) return `<div class="mr mr-signin">
    <header class="pagehead"><h1 class="hero">You’re signed in</h1>
      <p class="lede">Your email is <span class="strong mr-break">${esc(myEmail())}</span>. Your issues, stances and actions are saved to your account.</p></header>
    <div class="btnrow">${btn('Go to your profile', { kind: 'primary', icon: 'user', href: '#/profile' })}${btn('Back to Home', { kind: 'text', href: '#/' })}</div>
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
      <p class="lede">Get hearing alerts and keep your issues on any device. No password: we email you a link.</p>
      ${(pp => pp ? `<p class="mr-back">${icon(pp.then?.addto ? 'list-checks' : 'arrow-left')}<span>${pp.then?.addto ? 'With your email you can make lists of bills. When you open the link, you come back to the bill to finish.' : 'When you open the link, you come back to where you were.'}</span></p>` : '')(pendingPlace())}</header>
    ${DEMO ? notice('info', 'info', 'You’re in the sandbox, so no email is sent and nothing is saved. You can still try the page.') : ''}
    ${emailForm('Already added your email? Enter it again to sign in on this device.')}
    ${codesOn() ? `<p class="small mr-returning">Gave us your mobile number instead? <a href="#/signin?by=number">Sign in with your number</a></p>` : ''}
    <section class="mr-priv mr-panel" aria-labelledby="mr-priv-t">
      <h2 id="mr-priv-t">Your privacy</h2>
      <ul class="mr-bullets">${PRIVACY_BULLETS.map(t => `<li>${icon('check')}<span>${t}</span></li>`).join('')}</ul>
      <details class="mr-disc"><summary><span>More about privacy</span>${icon('chevron-down', { cls: 'mr-discc' })}</summary>
        <div class="mr-discb">
          <p>We keep your email, the issues, bills and lists you follow, where you stand on the bills you follow, the actions you mark, your email choices, which of our emails you open, and anything you add in your profile: your name, your titles (“I’m a…”), your story, your districts and how you’d like to help.</p>
          <p>When you open the link, the issues, bills, stances and actions saved on this device join your account.</p>
          <p>Every email has a one-click unsubscribe.</p>
          <p><a href="#/privacy">Read the full privacy page</a></p>
        </div></details>
    </section>
  </div>`;
}
// A profile made with a number adds its email to its own account (Supabase's email change: the link confirms it), never a
// second account beside it. The choices wait on this device until the email is confirmed, as for a new email (loadUser).
async function addEmail(email, choices) {
  if (DEMO) return { demo: true };
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify(choices)); } catch { /* ignore */ }
  const { error } = await S.supa.auth.updateUser({ email }, { emailRedirectTo: location.origin + location.pathname });
  if (error) {
    if (error.code === 'email_exists' || /already been registered|already registered/i.test(error.message || '')) throw Object.assign(new Error('That email already has a profile. Sign out, then sign in with that email.'), { plain: true });
    throw error;
  }
  return { sent: true };
}
const sendFor = (email, choices) => S.session && !myEmail() ? addEmail(email, choices) : sendEmailLink(email, choices);
function wireSignin() {
  if (byNumber()) { wirePhoneIn(); return; }
  $('[data-mr-other]') && ($('[data-mr-other]').onclick = () => { M.sent = ''; app.render(); requestAnimationFrame(() => $('#mr-email')?.focus()); });
  const again = $('[data-mr-again]');
  if (again) again.onclick = async () => {
    busy(again, 'Sending…');
    let error = null;
    try { await sendFor(M.sent, { hearing_alerts: !!M.choices.alerts, action_alerts: !!M.choices.action }); } catch (e) { error = e; }
    unbusy(again);
    say('mr-again-msg', error ? inlineErr('mr-again-err', error.plain ? error.message : friendly(error)) : `<p class="okmsg" role="status">${icon('check')}<span>We sent a new link.</span></p>`);
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
    try { r = await sendFor(email, { hearing_alerts: keep, action_alerts: keep }); } catch (err) { error = err; }
    inp.readOnly = false;
    if (error) { unbusy(b); M.sendErr = error.plain ? error.message : friendly(error); say('mr-si-msg', inlineErr('mr-si-err', M.sendErr)); return; }
    M.sent = email; M.demo = !!r?.demo;
    S.nudgeSent = email;   // the email ask on Home and in the helper now says "check your inbox" instead of asking again
    app.render(); requestAnimationFrame(() => $('#mr-sent-t')?.focus());
  };
}

// ---------------- Get alerts (R-146) ----------------
// The phone-first box on its own page, for More's alerts row and Home's "Get hearing alerts" between sessions. Email goes
// to the sign-in page ("Prefer email?"), which keeps its own consent box and the returning person's way in.
const A = { edit: false };
function alertsView() {
  const t = textSaved();
  if (t && !A.edit) return `<div class="mr mr-alerts">
    <header class="pagehead"><h1 class="hero" id="mr-al-t" tabindex="-1">Text alerts are on</h1></header>
    <section class="card mr-panel mr-alon" aria-labelledby="mr-al-t">
      <p>We’ll text <span class="strong">${esc(fmtPhone(t.phone))}</span> when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one text a day.</p>
      <p class="small">${t.confirmed ? '' : 'Our first text asks you to reply YES. '}Reply STOP to any text to end them.${DEMO ? ' This is the sandbox, so the number was not saved.' : ''}</p>
      <div class="btnrow">${btn('Change number', { kind: 'secondary', sm: true, icon: 'pencil', attrs: { 'data-mr-alchange': '' } })}${btn('Stop texts', { kind: 'text', sm: true, attrs: { 'data-mr-alstop': '' } })}</div>
    </section>
    ${myEmail() ? '' : `<p class="small mr-alemail">${icon('mail')}<span>Want email too? ${S.session ? 'Add it to your profile.' : 'It also keeps your issues on any device.'} <a href="#/signin">Add your email</a></span></p>`}
  </div>`;
  S.alertMode = 'phone';   // this page is the phone box; email has its own page
  const b = alertButton('mr-al');
  return `<div class="mr mr-alerts">
    <header class="pagehead"><h1 class="hero">${codeStep('mr-al') ? 'Check your texts' : t ? 'Change your number' : 'Get alerts on your issues'}</h1>
      <p class="lede">${codeStep('mr-al') ? 'Type the 6-digit code from the text to turn on alerts.' : myEmail() ? 'Your email alerts are in your profile. Add your mobile number to get texts too.' : 'Hearings are posted about two days ahead. We’ll tell you in time to speak up.'}</p></header>
    <form class="card mr-form mr-panel" id="mr-alform" novalidate>${alertFields('mr-al', { emailHref: '#/signin', swap: !myEmail() })}
      <div class="mr-send">${submitBtn(b.label, b.icon, 'mr-al-send')}${t ? btn('Cancel', { kind: 'text', attrs: { 'data-mr-alcancel': '' } }) : ''}</div>
    </form>
  </div>`;
}
function wireAlerts() {
  wireAlertForm($('#mr-alform'), { pfx: 'mr-al', source: 'more', onDone: r => {
    A.edit = false; app.render();
    toast(r.confirmed ? `Text alerts are on for ${fmtPhone(r.phone)}.` : `Almost set: our first text to ${fmtPhone(r.phone)} asks you to reply YES.`, { yay: true });
    requestAnimationFrame(() => $('#mr-al-t')?.focus());
  } });
  const ch = $('[data-mr-alchange]');
  if (ch) ch.onclick = () => { const t = textSaved(); A.edit = true; S.alertDraft.phone = t ? fmtPhone(t.phone) : ''; app.render(); requestAnimationFrame(() => { const i = $('#mr-al-phone'); if (i) { i.focus(); i.select(); } }); };
  const cancel = $('[data-mr-alcancel]'); if (cancel) cancel.onclick = () => { A.edit = false; S.alertDraft.phone = ''; if (S.alertCode?.pfx === 'mr-al') S.alertCode = null; app.render(); };
  const stop = $('[data-mr-alstop]');
  if (stop) stop.onclick = async () => {
    if (stop.getAttribute('aria-busy')) return;
    const phone = textSaved()?.phone; busy(stop, 'Stopping…');
    try { await stopText(); } catch (e) { unbusy(stop); toast(e, true); return; }
    app.render();
    // Undo within the toast's ten seconds signs the same number up again, under the same words.
    toast('Texts stopped. We won’t text you.', { undo: async () => { try { await saveText(phone, 'more'); } catch (e) { toast(e, true); } app.render(); } });
  };
}

// ---------------- Settings ----------------
// Settings became the profile (R-147, 10/4): pub/profile.js, at #/profile and Settings' old address #/settings. The email
// choices, About you, Your data, signing out and deleting the account moved there with it.

// ---------------- Privacy (and the accessibility statement) ----------------
// Every sentence here has to be true of the code (assessment, 9/19: "HIPHI gets nothing about you" was too strong,
// because looking up legislators sends the typed address to our lookup). Stances (9/19): kept in this browser until
// someone adds their email; after that they ride on the follow (watchlist.stance) and staff can see them, exactly
// like follows and actions. Numbers about other people are totals inside one bill or hearing, from 10 people.
const PRIVACY = [
  ['lock', 'If you don’t add your email', 'We don’t know who you are. The issues and bills you follow, where you stand on them and the actions you mark stay in this browser, on this device. Clearing your browser data erases them.'],
  ['message-square', 'If you add your mobile number', 'We keep your number, the issues and bills you follow, when you agreed to texts and the words you agreed to, and use them only to send you those texts. HIPHI staff never see your text-alert number: the tracker never shows it to them, and it is left out of HIPHI’s backup copies. We never sell it or use it for anything else; once texts begin, the service that sends them for us will hold it to do that. The first text asks you to reply YES, to be sure the number is yours. Reply STOP to any text, or use Alerts in your profile, under More, to end them. With only a number, your profile (your name, your titles and your story) stays on this phone and is not sent to us.'],
  ['user', 'If you add your email', 'We keep your email, the issues, bills and lists you follow, where you stand on each bill you follow (support, oppose or not sure), the actions you mark, your email choices, and anything you add in your profile, such as your name, the titles you give yourself (“I’m a…”), your stories (one for any issue, or one for an issue you choose) and whether HIPHI may quote them (HIPHI asks you again before any public use). When we email you, we also see whether you opened each email and which links in it you clicked. HIPHI staff can see all of this, so they can reach out about your issues and learn which asks work. What you saved on this device joins your account; signing out takes your profile off this device.'],
  ['list-checks', 'Lists you make', 'A list of bills you make is private: HIPHI staff can’t see it, and it is left out of HIPHI’s backup copies. If you share it, anyone with the link can see its name, your note and its bills, but not who made it. HIPHI can turn off a shared list that is used to harm someone. Deleting your account erases your lists.'],
  ['users', 'Numbers about other people', 'A bill or a hearing may show how many people have acted on it, or how many support or oppose it. These are totals of people who added their email. They never show a name, and they appear only once 10 people are in them.'],
  ['map-pin', 'Your home address', 'We never store it. In your profile it is used once to find your districts, and only the district numbers are saved on your account; HIPHI staff see just those. When you look up your legislators, the address you type goes to our address lookup, and to the U.S. Census Bureau’s if ours can’t place it, only to find your districts. It isn’t saved. The district numbers stay on this device, so we can point you to your own senator and representative.'],
  ['notebook-pen', 'Your testimony and emails', 'Your name and letter stay on this device until you send the letter on the Capitol website. Testimony is public there: the Capitol posts your name and letter online. Once you send it, we keep that letter, the last one on each bill, so it’s ready for the bill’s next hearing. An email to a lawmaker goes from your own email account; we never send it for you. Once you say you sent it, we keep a copy of it too, the last one on each bill, so it’s ready for the bill’s next step. Both are kept on this device, and with your account if you added your email, where only you can see them, not HIPHI staff, and they are left out of HIPHI’s backup copies. The letter helper can delete each one, and deleting your account deletes them all. A letter or email you haven’t sent stays on this device. If you type your email in the letter helper, we use it for your link and your hearing alerts. It is never added to your letter.'],
  ['chart-column', 'What we count', 'To make the tracker better, we count which screens of the first visit people reach, how long they stay and which issues they pick, whether they came from a partner’s link, a campaign or another website (its name only), and whether it was a phone or a laptop. Each first visit gets a random number that ends when you close the tab. Once a day we also count that the tracker was opened, how long since this browser last opened it (in ranges, like “2 to 7 days”), the month it was first opened, and whether it follows anything; and when you mark an action done, only which kind it was (an email, testimony, going in person, a share); in the same way, that your session page was opened or a good-news moment was shown, or that a saved letter was offered again and whether it was sent, updated or replaced, and the same for a saved email, or a follow-up sent to a committee chair; and that profile titles or a story were saved, that a letter or email went out with your titles or your story in it, that an ask chosen from “How you’ll help” was shown or taken, or that the Add to Home Screen steps were opened, only that it happened, never the words. Sometimes we try two versions of a screen to learn which helps more people: this browser is given one at random and keeps it, and we count which version it saw, whether that screen’s step was done, and whether this browser came back, acted or gave an email in the next 14 days; the version is also noted with the other counts on this page. When we suggest a bill, we count that a suggestion was shown, followed, set aside or acted on, never which bill or who. This browser remembers the month and the last day itself; they are never sent more exactly than that. In these counts we never record your email, your name, your address, which stance you took, which bill, or anything else that could tell who you are. If your browser asks sites not to track you, we record none of them. (Which of our emails you open is not one of these counts: see “If you add your email”.)'],
  ['circle-alert', 'If the page breaks', 'The tracker tells us which screen broke (for example, which bill’s page) and what the error said, so we can fix it. The report is built to leave out who you are, what you typed and your address: it strips anything that looks like an email address or a long number. Nothing is sent if your browser asks sites not to track you.'],
  ['archive', 'Backups', 'Every night we save a copy of the tracker’s information, so it can be restored if something goes wrong. Each copy is encrypted before it is stored, and only a key HIPHI keeps separately can open it. Text-alert numbers, the lists you make and your saved letters and emails are left out of these copies. A copy is deleted within about 45 days. Our database service also keeps its own backups of everything for 7 days.'],
  ['building', 'Services that run the tracker', 'The tracker runs on services HIPHI uses: GitHub hosts the pages, Supabase holds the database, Postmark sends our email, Google Drive keeps the encrypted backups, and the pages load fonts from Google Fonts and code from jsDelivr. Once texts begin, a texting service will send them. Like any website, these services see your device’s internet address, and from it a rough location, and keep it in their own logs.'],
  ['shield-check', 'Selling and sharing', 'We never sell your information or give it to other groups. We share it only with the services above, so they can run the tracker for us, and if the law requires it. Every email has a one-click unsubscribe. You can delete your account from your profile, under More, at any time: your account, the issues and bills you follow, your stances, actions, lists and saved letters are erased from the tracker at once, and from our backup copies within about 45 days. We keep a record of the emails we sent you. Text alerts are separate: reply STOP or use Alerts in your profile.'],
];
const PRIVACY_UPDATED = '4 October 2026';   // change it with any sentence above (R-151)
// Once sign-in by text code is on (R-155), a number signs people in and their profile is kept with the account, so three
// sections say so. Change the date to the day codes were switched on (backend docs/TEXT-SIGN-IN.md, step 6).
const PRIVACY_CODES_UPDATED = '5 October 2026';
const PRIVACY_CODES = {
  lock: ['If you don’t add your email or number', 'We don’t know who you are. The issues and bills you follow, where you stand on them and the actions you mark stay in this browser, on this device. Clearing your browser data erases them.'],
  'message-square': ['If you add your mobile number', 'We text you a 6-digit code to be sure the number is yours, and from then on the number signs you in, the way an email does. We keep your number, when you agreed to texts and the words you agreed to, and use the number only to sign you in and to send the texts you asked for. Your profile and what you follow, where you stand and the actions you mark are kept with your account, as described under “If you add your email”, and HIPHI staff can see them, but never your number: the tracker never shows it to them, and it is left out of HIPHI’s backup copies. We never sell it or use it for anything else; the services that sign you in and send our texts hold it to do that. Reply STOP to any text, or use Alerts in your profile, under More, to end texts.'],
  users: ['Numbers about other people', 'A bill or a hearing may show how many people have acted on it, or how many support or oppose it. These are totals of people who added their email or signed in with their number. They never show a name, and they appear only once 10 people are in them.'],
};
function privacyView() {
  const rows = codesOn() ? PRIVACY.map(([ic, t, p]) => PRIVACY_CODES[ic] ? [ic, ...PRIVACY_CODES[ic]] : [ic, t, p]) : PRIVACY;
  return `<div class="mr mr-privacy">
    <header class="pagehead"><h1 class="hero">Privacy</h1><p class="lede">What we keep, who sees it, and how to remove it.</p></header>
    <div class="card mr-facts">${rows.map(([ic, t, p], i) => `<section aria-labelledby="mr-pv-${i}"><span class="mr-factic">${icon(ic)}</span><div><h2 id="mr-pv-${i}">${t}</h2><p>${p}</p></div></section>`).join('')}</div>
    <p class="small muted">Updated ${codesOn() ? PRIVACY_CODES_UPDATED : PRIVACY_UPDATED}.</p>
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
const VIEWS = { more: moreView, help: helpView, signin: signinView, privacy: privacyView, alerts: alertsView };
const WIRES = { more: wireMore, help: wireHelp, signin: wireSignin, privacy: wirePrivacy, alerts: wireAlerts };
const TITLES = { more: 'More', help: 'Help', signin: 'Add your email', privacy: 'Privacy', alerts: 'Get alerts' };
export default {
  tab: 'more',
  title: route => (route.name === 'help' && TALK ? TALK.title(route) : route.name === 'signin' && byNumber() ? 'Sign in' : TITLES[route.name]) || 'More',
  render(route) {
    // A fresh arrival (from another screen) starts the page clean; a re-render of the same page keeps what was typed.
    const fresh = !document.querySelector(`#main .mr-${route.name}`);
    if (fresh && route.name === 'signin') { Object.assign(M, { sent: '', err: '', sendErr: '' }); Object.assign(PI, { phone: '', at: null, code: '', done: false }); }
    if (fresh && route.name === 'alerts') A.edit = false;
    return (VIEWS[route.name] || moreView)(route);
  },
  wire(route) { (WIRES[route.name] || (() => {}))(route); },
};
