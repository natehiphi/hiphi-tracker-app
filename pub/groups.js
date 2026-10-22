// For advocacy groups, and the partner sign-in link (R-328 batch H; Nate's yes 22 Oct 2026, the plan page's sections
// "Joining and making changes" and "Who can join"). Two pages on the public tracker, one module:
//   #/groups              A person from a Hawaiʻi advocacy group comes here to ask HIPHI to let their group write on the
//                         tracker (B-1). What partners get, who can join, how it works in four steps, and a short request
//                         form that calls partner_request(p) (backend migration 184: anyone may send it, three a day from one
//                         email and fifty in all, and every refusal is a plain sentence, shown as it comes, B-8). Invite
//                         links fill in the group: #/groups?name=<group>&site=<website> (Staff v5 makes them with
//                         URLSearchParams; pub/app.js parseRoute reads them undecoded, so "&" and "+" in a name survive).
//   #/link/<token_hash>   A partner person comes here to sign in with the one-time link HIPHI copied for them (B-1). Opening
//                         it spends nothing, because email scanners and link previews open links too: only Continue calls
//                         auth.verifyOtp({ token_hash, type: 'magiclink' }). Then the page starts again signed in, on
//                         #/partner, as an email link's sign-in does (kernel.js init restarts on a new session; here the
//                         restart waits until the address is #/partner, so it lands there). Used or expired: one plain
//                         line, and sign-in by email instead.
// The practice copy (?demo=1) never calls the database (the sandbox's own rule): the form plays partner_request's checks
// here, in its words, and Continue opens the sample group (?partner=1, pub/partners.js).
// DESIGN.md: A-3 (one filled button: Send to HIPHI, Continue), A-5 (errors carry an icon and words), A-6 (44px targets),
// A-8 (spaces from the scale, the lists in one white card), A-9 (from 1100px the form sits beside the reading), A-13 (the
// form is the focal point), A-14 (each fact said once: "HIPHI approves every word" lives in the steps), A-16 (Send answers
// with the thank-you in its place), B-3 (the thank-you and every error have a way on), B-4 (the back row names the page
// behind; typed words survive leaving and coming back, for this tab), B-7 (Sending..., Signing you in...), B-8, B-12 (six
// fields, the note marked optional, each needed one says why when it is not plain), C-6 (the thank-you says where HIPHI
// will write), C-9 (an error keeps every value and focuses the field), C-10 (grade 8 words), C-15 (sign in, never log in).
import { S, DEMO, app, esc, icon, supa, toast } from './core.js';
import { recHead, recBack, recSec } from './rec/kit.js';
import { plainErr, SANDBOX_MODE, forget, myPartnerNow } from './partners.js';

const EMAIL = 'contact@hiphi.org';
// The database's lengths (partner_requests). The line about the group is capped at 200 here, not the table's 300, so it
// always fits the group's own line on the tracker (partners.about, at most 200) when HIPHI adds the group from it.
const LIM = { group_name: 80, website: 200, about: 200, contact_name: 80, contact_email: 200, note: 600 };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;   // the database's own check on contact_email
const ORDER = ['group_name', 'website', 'about', 'contact_name', 'contact_email', 'note', 'not_campaign'];
const $ = s => document.querySelector(s);

// ---------------- the form's memory ----------------
// What is typed survives leaving the page and coming back in this tab (B-4, B-6), until it is sent. Only on this device.
const FKEY = 'hiphi_groups_form';
const blank = () => ({ group_name: '', website: '', about: '', contact_name: '', contact_email: '', note: '', not_campaign: false });
function kept() { try { const f = JSON.parse(sessionStorage.getItem(FKEY) || 'null'); return f && typeof f === 'object' ? { ...blank(), ...f } : blank(); } catch { return blank(); } }
let kTimer = 0;
const keep = () => { clearTimeout(kTimer); kTimer = setTimeout(() => { try { sessionStorage.setItem(FKEY, JSON.stringify(ST.f)); } catch { /* storage blocked: kept for this page only */ } }, 250); };
const forgetForm = () => { clearTimeout(kTimer); try { sessionStorage.removeItem(FKEY); } catch { /* nothing kept */ } };
const ST = { f: kept(), last: null, errs: {}, formErr: '', sent: null, invited: '', lastHash: '', link: { err: '', msg: '' } };

// ---------------- the words ----------------
const GETS = [
  ['list-plus', 'Add the bills your group works on, and say where your group stands on each.'],
  ['pencil', 'Write a plain summary and talking points for each bill.'],
  ['megaphone', 'Ask people to act, like sending testimony, with an end date.'],
  ['users-round', 'Your group’s name shows with your words.'],
  ['link', 'Your own link opens the tracker with your bills first.'],
];
const WHO = [
  ['circle-check', 'Any advocacy group in Hawaiʻi, on any bill.'],
  ['circle-minus', 'No candidates, campaigns or political parties.'],
  ['scale', 'On a bill HIPHI supports or opposes, your group takes the same side, or leaves that bill out. On other bills, the side is yours.'],
];
const STEPS = [
  ['You ask', 'Send the short form on this page.'],
  ['HIPHI adds your group', 'A second person at HIPHI approves it.'],
  ['Your people sign in', 'With a sign-in link from HIPHI. No password.'],
  ['You write, HIPHI approves', 'HIPHI looks over every word before it goes public.'],
];

// A web address as people type it: "keikismiles.org", "www.facebook.com/keikismiles", "HTTPS://Example.org". The database
// takes http(s):// and no spaces, so a bare address gets https:// in front. '' when it is not a web address.
export function siteOf(v) {
  let s = String(v || '').trim();
  if (!s) return '';
  s = /^https?:\/\//i.test(s) ? s.replace(/^(https?):\/\//i, (m, p) => p.toLowerCase() + '://') : 'https://' + s.replace(/^\/+/, '');
  if (/\s/.test(s) || s.length > LIM.website) return '';
  try { const u = new URL(s); return /^https?:$/.test(u.protocol) && /\.[a-z]{2,}$/i.test(u.hostname) ? s : ''; } catch { return ''; }
}
// The form's checks, in plain words next to each field (B-8). The database checks the same again.
function check(f) {
  const e = {}, val = k => String(f[k] || '').trim();
  const name = val('group_name');
  if (!name) e.group_name = 'Write your group’s name.'; else if (name.length < 2) e.group_name = 'Write your group’s full name.';
  if (!val('website')) e.website = 'Add your group’s website, or its Facebook or Instagram page.';
  else if (!siteOf(f.website)) e.website = 'That doesn’t look like a web address. Try one like example.org.';
  if (!val('about')) e.about = 'Write one line about your group.';
  if (!val('contact_name')) e.contact_name = 'Write your name.';
  const m = val('contact_email');
  if (!m) e.contact_email = 'Write your email, so HIPHI can reach you.'; else if (!EMAIL_RE.test(m)) e.contact_email = 'That email doesn’t look right. Try one like name@example.org.';
  if (!f.not_campaign) e.not_campaign = 'Tick this box to send. The tracker is for advocacy groups.';
  return e;
}

// ---------------- the call ----------------
const refuse = m => Object.assign(new Error(m), { sandbox: true });   // shown as it comes, as the database's own sentences are
const SKEY = 'hiphi_groups_sent';   // the practice copy's count of requests per email today (the storage shim adds _demo)
function sandboxRequest(p) {
  if (p?.not_campaign !== true) throw refuse('The tracker is for advocacy groups, not candidates, campaigns or parties');
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), em = String(p.contact_email || '').trim().toLowerCase();
  let n = {}; try { n = JSON.parse(sessionStorage.getItem(SKEY) || '{}') || {}; } catch { /* storage blocked */ }
  if (n.day !== day) n = { day, by: {} };
  if ((n.by[em] || 0) >= 3) throw refuse('Thank you. HIPHI has your request already.');
  n.by[em] = (n.by[em] || 0) + 1;
  try { sessionStorage.setItem(SKEY, JSON.stringify(n)); } catch { /* storage blocked */ }
  return { ok: true };
}
export async function partnerRequest(p) {
  if (DEMO) { await new Promise(r => setTimeout(r, 300)); return sandboxRequest(p); }   // a moment, as the database takes one (B-7)
  const c = await supa(), { data, error } = await c.rpc('partner_request', { p });
  if (error) throw error;
  return data;
}

// ---------------- pieces ----------------
const errLine = (id, msg) => msg ? `<span class="err" id="${id}">${icon('triangle-alert')}<span>${esc(msg)}</span></span>` : '';
const notice = (tone, ic, html, cls = '') => `<div class="notice ${tone} gp-notice${cls ? ' ' + cls : ''}">${icon(ic)}<div>${html}</div></div>`;
// The back row: the page this one was opened from, by its name; else Find for someone who arrived on a link (B-4), else You.
function backRow() {
  const prev = history.state?.prev, name = prev && !/^#\/(groups|link)\b/.test(prev) ? app.placeName?.(prev) : '';
  if (name) return recBack(prev, name);
  return app.calmPlace?.() === '#/find' ? recBack('#/find', 'Find') : recBack('#/more', 'You');
}
const iconList = rows => `<ul class="gp-list" role="list">${rows.map(([ic, s]) => `<li>${icon(ic)}<span>${esc(s)}</span></li>`).join('')}</ul>`;
// Once the request is sent, its step shows done (B-7).
const stepsList = () => `<ol class="gp-steps">${STEPS.map(([h, s], i) => { const done = !i && !!ST.sent;
  return `<li${done ? ' class="done"' : ''}><span class="gp-n" aria-hidden="true">${done ? icon('check') : i + 1}</span><span><span class="gp-st">${esc(h)}${done ? '<span class="sr"> (done)</span>' : ''}</span><span class="gp-ss">${esc(done ? 'Sent.' : s)}</span></span></li>`; }).join('')}</ol>`;

// ---------------- For advocacy groups ----------------
function field(name, { label, help = '', rows = 0, attrs = '' }) {
  const f = ST.f, v = f[name] || '', err = ST.errs[name], ids = [help ? `gp-${name}-help` : '', rows ? `gp-${name}-count` : '', err ? `gp-${name}-err` : ''].filter(Boolean).join(' ');
  const a = `id="gp-${name}" data-gf="${name}" maxlength="${LIM[name]}"${ids ? ` aria-describedby="${ids}"` : ''}${err ? ' aria-invalid="true"' : ''}${attrs}`;
  const ctl = rows ? `<textarea ${a} rows="${rows}">${esc(v)}</textarea>` : `<input ${a} value="${esc(v)}">`;
  return `<div class="field gp-field"><label for="gp-${name}">${esc(label)}</label>${help ? `<span class="help" id="gp-${name}-help">${esc(help)}</span>` : ''}${ctl}
    ${rows ? `<span class="gp-count" id="gp-${name}-count" data-gcount="${name}">${v.length} of ${LIM[name]}</span>` : ''}${errLine(`gp-${name}-err`, err)}</div>`;
}
function formCard() {
  const f = ST.f, okErr = ST.errs.not_campaign;
  return `<form class="rc-card gp-form" id="gp-form" data-gp-form novalidate aria-labelledby="gp-form-h">
    <h2 class="rc-h2" id="gp-form-h">Ask to join</h2>
    ${field('group_name', { label: 'Your group’s name', attrs: ' autocomplete="organization"' })}
    ${field('website', { label: 'Its website', help: 'So HIPHI can see your group’s work. A Facebook or Instagram page is fine.', attrs: ' type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false" placeholder="example.org"' })}
    ${field('about', { label: 'One line about your group', help: 'What your group works on, in a sentence.', rows: 2 })}
    ${field('contact_name', { label: 'Your name', attrs: ' autocomplete="name"' })}
    ${field('contact_email', { label: 'Your email', help: 'HIPHI writes to you here, and you sign in with it.', attrs: ' type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" placeholder="name@example.org"' })}
    ${field('note', { label: 'A note (optional)', help: 'Anything HIPHI should know, like the bills your group works on.', rows: 3 })}
    <div class="gp-okbox"><label class="check gp-check" for="gp-ok"><input type="checkbox" id="gp-ok" data-gf="not_campaign"${f.not_campaign ? ' checked' : ''}${okErr ? ' aria-invalid="true" aria-describedby="gp-not_campaign-err"' : ''}>
      <span>We are an advocacy group, not a candidate, campaign or party</span></label>${errLine('gp-not_campaign-err', okErr)}</div>
    <div id="gp-ferr" class="gp-ferr" role="alert">${ST.formErr ? notice('bad', 'circle-alert', `<p>${esc(ST.formErr)}</p>`) : ''}</div>
    <div class="gp-send"><button type="submit" class="btn primary" id="gp-send">${icon('send')}<span>Send to HIPHI</span></button></div>
    <p class="small gp-after">${DEMO ? 'This is the practice copy, so nothing is sent.' : 'Only HIPHI’s team sees what you send here.'}</p>
  </form>`;
}
// After Send (A-16, C-6): the thank-you in the form's place, where HIPHI will write, and a way on (B-3).
function doneCard() {
  const s = ST.sent;
  return `<section class="rc-card gp-done" id="gp-form" aria-labelledby="gp-done-h">
    <span class="gp-done-ic" aria-hidden="true">${icon('mail-check')}</span>
    <h2 class="rc-h2" id="gp-done-h" tabindex="-1">Thank you</h2>
    <p>${esc(s.line || 'HIPHI will be in touch by email.')}</p>
    ${s.email && !s.line ? `<p class="small gp-to">Look for it at <span class="gp-em">${esc(s.email)}</span>.</p>` : ''}
    ${DEMO ? '<p class="small gp-to">This is the practice copy, so nothing was sent.</p>' : ''}
    ${s.email && !s.line && ST.last ? `<p class="gp-change"><button type="button" class="btn text sm" data-gp-change>${icon('pencil')}<span>Wrong address? Change it</span></button></p>` : ''}
    <p class="gp-acts"><a class="btn secondary" href="#/find">${icon('search')}<span>See the bills on the tracker</span></a></p>
  </section>`;
}
function groupsView(route) {
  const fresh = ST.lastHash !== location.hash; ST.lastHash = location.hash;
  if (fresh) {
    ST.errs = {}; ST.formErr = '';
    // An invite link fills in what HIPHI knows, in the fields still empty (what someone typed is never overwritten, B-6).
    const inv = route.invite || {}; ST.invited = inv.name || inv.site ? (inv.name || 'your group') : '';
    if (inv.name && !ST.f.group_name.trim()) ST.f.group_name = inv.name.slice(0, LIM.group_name);
    if (inv.site && !ST.f.website.trim()) ST.f.website = inv.site.slice(0, LIM.website);
  }
  const mine = (myPartnerNow()?.groups || [])[0];
  const top = mine ? notice('info', 'handshake', `<p>You’re on ${esc(mine.name)} already. <a href="#/partner">Go to your group’s page</a></p>`)
    : ST.invited && !ST.sent ? notice('info', 'handshake', `<p>HIPHI sent you this link, so ${ST.f.group_name.trim() ? 'your group’s name is' : 'some of it is'} filled in below.</p>`) : '';
  // On a phone the form is far below what it is for: one quiet button goes to it (A-13; hidden from 1100px, where it is in view).
  const jump = ST.sent || mine ? '' : `<p class="gp-jumpline"><button type="button" class="btn secondary sm" data-gp-jump>${icon('move-down')}<span>Ask to join</span></button></p>`;
  return `<div class="rc gp gp-groups">
    ${recHead({ back: backRow(), title: 'For advocacy groups', lede: 'Your group can add the bills it works on to HIPHI’s tracker, in your own words, so more people in Hawaiʻi speak up on them.' })}
    ${top}${jump}
    <div class="gp-cols"><div class="gp-main">
      ${recSec('gp-gets-h', 'What your group gets', `<div class="rc-card">${iconList(GETS)}</div>`)}
      ${recSec('gp-who-h', 'Who can join', `<div class="rc-card">${iconList(WHO)}</div>`)}
      ${recSec('gp-how-h', 'How it works', `<div class="rc-card">${stepsList()}</div>`)}
      <p class="small gp-q">Questions? Email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>
    </div>
    <div class="gp-side">${ST.sent ? doneCard() : formCard()}</div></div>
  </div>`;
}

// ---------------- Sign in to the tracker (#/link/<token_hash>) ----------------
// A token_hash is Supabase's hashed one-time token (hex); anything else is a link cut short in a copy or a paste.
const tokenOk = t => /^[A-Za-z0-9_-]{6,200}$/.test(t || '');
function linkErr() {
  const L = ST.link, way = `<p class="gp-act"><a class="btn secondary" href="#/signin">${icon('mail')}<span>Sign in with your email</span></a></p>`;
  if (L.err === 'used') return notice('bad', 'circle-alert', `<p><b>This sign-in link has been used or has expired.</b> Sign in with your email instead, or ask HIPHI for a new link at <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>`) + way;
  if (L.err === 'incomplete') return notice('bad', 'circle-alert', `<p><b>This sign-in link isn’t complete.</b> Open the whole link HIPHI sent you again, or sign in with your email.</p>`) + way;
  if (L.err) return notice('bad', 'circle-alert', `<p>${esc(L.msg)}</p>`);
  return '';
}
function linkView(route) {
  const fresh = ST.lastHash !== location.hash; ST.lastHash = location.hash;
  if (fresh) ST.link = { err: tokenOk(route.token) ? '' : 'incomplete', msg: '' };
  const L = ST.link, dead = L.err === 'used' || L.err === 'incomplete', who = S.session?.user?.email || '';
  return `<div class="rc gp gp-link">
    ${recHead({ title: 'Sign in to the tracker', lede: dead ? 'Links from HIPHI sign you in to your group’s page.' : 'This link from HIPHI signs you in to your group’s page. Press Continue to finish.' })}
    ${DEMO && !dead ? notice('info', 'info', '<p>This is the practice copy, so Continue opens the sample group’s page, with no sign-in.</p>') : ''}
    ${who && !DEMO && !dead ? `<p class="gp-who">You’re signed in now as <span class="gp-em">${esc(who)}</span>. Continue signs you in with this link instead.</p>` : ''}
    <div id="gp-lerr" class="gp-lerr" role="alert" tabindex="-1">${linkErr()}</div>
    ${dead ? '' : `<p class="gp-act"><button type="button" class="btn primary" id="gp-go" data-gp-go>${icon('log-in')}<span>Continue</span></button></p>
      <p class="small gp-q">The link works once, and only for you. Questions? Email <a href="mailto:${EMAIL}">${EMAIL}</a>.</p>`}
  </div>`;
}

// ---------------- the module ----------------
export default {
  tab: 'more',
  title: route => route.name === 'link' ? 'Sign in to the tracker' : 'For advocacy groups',
  render: route => route.name === 'link' ? linkView(route) : groupsView(route),
  wire: route => route.name === 'link' ? wireLink(route) : wireGroups(),
};

// ---------------- wiring ----------------
const was = new WeakMap();
const busy = (b, label) => { if (!b) return; was.set(b, b.innerHTML); b.disabled = true; b.setAttribute('aria-busy', 'true'); b.innerHTML = `${icon('loader-circle', { cls: 'gp-spin' })}<span>${esc(label)}</span>`; };
const unbusy = b => { if (!b || !was.has(b)) return; b.disabled = false; b.removeAttribute('aria-busy'); b.innerHTML = was.get(b); };
function wireGroups() {
  const root = $('#main .gp-groups'); if (!root) return;
  root.querySelector('[data-gp-jump]')?.addEventListener('click', () => {
    const form = $('#gp-form'); form?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    const first = ORDER.map(k => k === 'not_campaign' ? null : $(`#gp-${k}`)).find(el => el && !el.value.trim()) || $('#gp-group_name'); first?.focus({ preventScroll: true });
  });
  // A mistyped email (the thank-you names it): the form comes back as it was sent, on the email, to send again.
  root.querySelector('[data-gp-change]')?.addEventListener('click', () => {
    ST.f = { ...ST.last }; ST.sent = null; ST.last = null; keep(); app.render();
    const el = document.getElementById('gp-contact_email'); el?.focus({ preventScroll: true }); el?.select(); el?.closest('.field')?.scrollIntoView({ block: 'center' });
  });
  const form = root.querySelector('[data-gp-form]'); if (!form) return;
  // Typing updates the field's own count and clears its error; nothing redraws while typing (a redraw would close a phone's keyboard).
  form.addEventListener('input', e => {
    const el = e.target, k = el.dataset?.gf; if (!k || k === 'not_campaign') return;
    ST.f[k] = el.value; keep();
    const c = form.querySelector(`[data-gcount="${k}"]`); if (c) c.textContent = `${el.value.length} of ${LIM[k]}`;
    if (ST.errs[k]) { delete ST.errs[k]; el.removeAttribute('aria-invalid'); document.getElementById(`gp-${k}-err`)?.remove();
      el.setAttribute('aria-describedby', (el.getAttribute('aria-describedby') || '').split(' ').filter(x => x && x !== `gp-${k}-err`).join(' ')); }
  });
  form.addEventListener('change', e => {
    const el = e.target; if (el.dataset?.gf !== 'not_campaign') return;
    ST.f.not_campaign = el.checked; keep();
    if (el.checked && ST.errs.not_campaign) { delete ST.errs.not_campaign; el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); document.getElementById('gp-not_campaign-err')?.remove(); }
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    ST.errs = check(ST.f); ST.formErr = '';
    const bad = ORDER.find(k => ST.errs[k]);
    if (bad) { app.render(); const el = document.getElementById(bad === 'not_campaign' ? 'gp-ok' : `gp-${bad}`); el?.focus({ preventScroll: true }); el?.closest('.field, .gp-okbox')?.scrollIntoView({ block: 'center' }); return; }
    const f = ST.f, b = form.querySelector('#gp-send'); busy(b, 'Sending…');
    const p = { group_name: f.group_name.trim(), website: siteOf(f.website), about: f.about.replace(/\s+/g, ' ').trim(), contact_name: f.contact_name.trim(),
      contact_email: f.contact_email.trim(), note: f.note.trim(), not_campaign: true };
    try {
      await partnerRequest(p);
      ST.sent = { email: p.contact_email }; ST.last = { ...f };
    } catch (x) {
      const m = plainErr(x);
      // The day's cap answers "Thank you. HIPHI has your request already.": a thank-you, said as the database says it.
      if (/^Thank you\b/i.test(m) && (x?.code === 'P0001' || x?.sandbox)) { ST.last = null; ST.sent = { email: p.contact_email, line: m.replace(/^Thank you[.!]?\s*/i, '') || 'HIPHI has your request already.' }; }
      else { console.error(x); ST.formErr = m; unbusy(b); app.render(); document.getElementById('gp-ferr')?.scrollIntoView({ block: 'center' }); return; }
    }
    ST.f = blank(); ST.errs = {}; forgetForm(); app.render();
    const h = document.getElementById('gp-done-h'); h?.focus({ preventScroll: true }); h?.closest('.gp-done')?.scrollIntoView({ block: 'center' });
  });
}
function wireLink(route) {
  const b = $('#main [data-gp-go]'); if (!b) return;
  b.addEventListener('click', async () => {
    // The practice copy: the sample group's page, with no sign-in (?partner=1 is read as the page loads, so it is added here).
    if (DEMO) {
      if (SANDBOX_MODE && SANDBOX_MODE !== '0') { app.go('#/partner', { replace: true }); return; }
      const u = new URL(location.href); u.searchParams.set('partner', '1'); u.hash = '#/partner'; location.replace(u.href); return;
    }
    busy(b, 'Signing you in…'); ST.link = { err: '', msg: '' };
    const before = S.session?.user?.id || null;
    let sess = null, err = null;
    const c = await supa();
    // kernel.js restarts the page on a new session unless S.quietAuth; here the restart comes after the address is #/partner.
    S.quietAuth = true;
    try { const { data, error } = await c.auth.verifyOtp({ token_hash: route.token, type: 'magiclink' }); if (error) err = error; else sess = data?.session || null; }
    catch (x) { err = x; }
    finally { S.quietAuth = false; }
    if (!sess) {
      if (err) console.error(err);
      const used = !!err && (err.code === 'otp_expired' || err.status === 403 || /expired|invalid|not found/i.test(String(err.message || '')));
      ST.link = used ? { err: 'used', msg: '' } : { err: 'other', msg: err ? plainErr(err) : 'That didn’t sign you in. Try again.' };
      unbusy(b); app.render(); document.getElementById('gp-lerr')?.focus({ preventScroll: true }); return;
    }
    S.session = sess; forget();   // the partner corner asks my_partner afresh, as this person
    // Someone else was signed in on this browser: start clean, so nothing of theirs stays on the page.
    if (before && before !== sess.user?.id) { location.replace(`${location.pathname}${location.search}#/partner`); return; }
    history.replaceState({ y: 0, prev: history.state?.prev, from: history.state?.from }, '', '#/partner');   // the used link leaves the history
    await app.boot();   // as after an email link: the account, the bills and the page, drawn on #/partner (boot says itself if it fails)
    if (S.session) toast(sess.user?.email ? `You’re signed in as ${sess.user.email}.` : 'You’re signed in.');   // A-16
  });
}
