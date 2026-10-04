// The one alerts ask, phone first (R-146, Nate 10/4: "include a phone number option which should be more prominent"; he
// chose a phone box with email as a link under it). One box everywhere the page asks for alerts: the first visit's alerts
// screen (right after the issues are picked, before the "Mahalo!"), the ask on Home and after a first action
// (actions.js nudgeCard) and More > Get alerts. Each place draws its own frame and button; the fields, the words and the
// saving are here, so the consent words are the same wherever they are given.
//
// Texts: no texting service exists yet (decision 4, 9/30: "We plan to do texts. Will set up later."). A number is kept
// privately with the version of the words agreed (backend 121, text_signup; staff never see it) and nothing is sent
// until texts are set up; the first text then asks for a YES reply. The words describe texts as working, as they do for
// email (R-101). Email: the same "keep me updated" consent as before, both kinds named in one line (C-4).
// Legal, one line: the text consent words and the privacy page's lines on numbers should be confirmed by a lawyer before
// any text goes out; carrier registration (10DLC) also reviews this screen.
import { S, DEMO, app, esc, icon, textSaved, textLists, TEXT_KEY, CONSENT_KEY, supa, sendEmailLink, validEmail, friendly } from './core.js';
import { btn } from './ui.js';
import { abEvent } from './variant.js';

// The version of the text consent words, and the words themselves: text_consent_words 't1' is exactly TEXT_PROMISE, a
// space, then TEXT_FINE (backend 121, its words set to these by 123 before anyone had agreed to them). A new wording gets
// a new version there and here together, so what is recorded as agreed is always what was on the screen.
// The promise names both kinds of alert as real events (C-4; the fresh-eyes review, 10/4: "your moment to speak up" and
// "HIPHI's alerts" named nothing a newcomer could picture), and the small print says the first text asks for a YES, so
// that text is expected when it comes, however long after the sign-up.
export const TEXT_CONSENT = 't1';
export const TEXT_PROMISE = 'We’ll text you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one text a day.';
export const TEXT_FINE = 'Our first text asks you to reply YES. Message and data rates may apply. Reply STOP to stop, HELP for help.';
export const EMAIL_PROMISE = 'We’ll email you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one email a day.';
const EMAIL_FINE = 'No password: we email you a link to confirm. Unsubscribe in one tap.';
// What makes a number feel safe to type sits right under the box, where it is typed (P-5).
const PHONE_HINT = 'Private: we never share your number, and HIPHI staff never see it.';
const EMAIL_HINT = 'We never share your email outside HIPHI. Staff can see which issues you follow.';
const PHONE_ERR = 'Enter a 10-digit mobile number, like (808) 555-0123.';
const EMAIL_ERR = 'Enter an email like name@example.com.';

// A US number in any common spelling, as ten digits, or '' (the function checks it again).
export function phoneDigits(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 11 && d[0] === '1') d = d.slice(1);
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(d) ? d : '';
}
export const fmtPhone = d => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
// An email given on this device, waiting for its link to be opened (or the choices made before it was sent).
export const linkSent = () => { try { return sessionStorage.getItem('hiphi_link_sent') || ''; } catch { return ''; } };
const emailPending = () => { try { return !!(linkSent() || localStorage.getItem(CONSENT_KEY)); } catch { return false; } };
// Has this person already said how to reach them? Signed in, a link sent or pending, or a number given.
export const alertsGiven = () => !!(S.session || textSaved() || emailPending());

// Which box shows, and what was typed in each, kept for this page's life so a redraw (data landing, Back) loses nothing
// (C-9). Phone first, always, until the person picks email.
S.alertMode ??= 'phone';
S.alertDraft ??= { phone: '', email: '' };
const plainErr = text => Object.assign(new Error(text), { plain: true });
const sayErr = e => e?.plain ? e.message : friendly(e);

// The fields of the box, inside a host's own <form>: the box, the consent line, and the way to the other kind.
// emailHref: the other kind as a link to a page (More's alerts page sends email to the sign-in page) instead of a swap.
// swap: false leaves the way to the other kind out (a signed-in person's email alerts are in Settings).
export function alertFields(pfx, { emailHref = '', compact = false, swap: withSwap = true } = {}) {
  const phone = S.alertMode !== 'email', v = S.alertDraft[phone ? 'phone' : 'email'];
  // A sentence, so its Privacy link is a link in running text (WCAG 2.5.8's inline exception, DESIGN A-6).
  const hint = `<p class="help al-hint" id="${pfx}-hint">${phone ? PHONE_HINT : EMAIL_HINT} <a href="#/privacy">Privacy</a></p>`;
  const field = phone
    ? `<div class="field al-field"><label for="${pfx}-phone">Mobile number</label>
        <input id="${pfx}-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel-national" enterkeyhint="send" placeholder="(808) 555-0123" maxlength="20" value="${esc(v)}" aria-describedby="${pfx}-hint">
        <span class="err" id="${pfx}-err" role="alert"></span>${hint}</div>`
    : `<div class="field al-field"><label for="${pfx}-email">Your email</label>
        <input id="${pfx}-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="send" placeholder="name@example.com" value="${esc(v)}" aria-describedby="${pfx}-hint">
        <span class="err" id="${pfx}-err" role="alert"></span>${hint}</div>`;
  const swap = phone
    ? (emailHref ? `<a class="al-swap" href="${emailHref}">Use email instead</a>` : `<button type="button" class="btn text sm al-swap" data-alswap="email">Use email instead</button>`)
    : `<button type="button" class="btn text sm al-swap" data-alswap="phone">Text me instead</button>`;
  // The promise at reading size, then the small print on its own line (the review: one block mixed the two, A-13).
  return `${field}<p class="al-line${compact ? ' small' : ''}">${phone ? TEXT_PROMISE : EMAIL_PROMISE}</p>
    <p class="al-fine">${phone ? TEXT_FINE : EMAIL_FINE}${DEMO ? ' In the sandbox nothing is sent or saved.' : ''}</p>${withSwap ? `<p class="al-swaprow">${swap}</p>` : ''}`;
}
// The host's button words for the box showing now.
export const alertButton = () => S.alertMode === 'email' ? { label: 'Email me', icon: 'mail' } : { label: 'Text me', icon: 'message-square' };

// Keep a number: the row in text_signups (token kept on this device), then this device remembers it.
export async function saveText(input, source) {
  const d = phoneDigits(input);
  if (!d) throw plainErr(PHONE_ERR);
  const t = textSaved(), token = t?.token || crypto.randomUUID();   // the published page is https, where every browser has it
  if (!DEMO) {
    const sb = await supa();
    const { data, error } = await sb.rpc('text_signup', { p: { token, phone: d, consent: TEXT_CONSENT, source, ...textLists() } });
    if (error) throw error;
    if (!data?.ok) throw plainErr(data?.why === 'phone' ? PHONE_ERR : data?.why === 'busy' ? 'That number can’t be added just now. Try again later, or use email instead.' : 'That didn’t save. Try again.');
  }
  try { localStorage.setItem(TEXT_KEY, JSON.stringify({ token, phone: d, at: new Date().toISOString() })); } catch { /* private mode: the row is kept, this device just forgets it */ }
  S.alertDraft.phone = '';
  abEvent('email');   // an alerts sign-up, by text or email, is the email-ask test's measure (R-135)
  return { kind: 'phone', phone: d, demo: DEMO };
}
// Stop texts (More): the row is marked stopped (kept as the record of the stop), and this device forgets the number.
export async function stopText() {
  const t = textSaved(); if (!t) return;
  if (!DEMO) { const sb = await supa(); const { error } = await sb.rpc('text_stop', { p_token: t.token }); if (error) throw error; }
  try { localStorage.removeItem(TEXT_KEY); } catch { /* ignore */ }
}
async function saveEmail(input) {
  const email = String(input || '').trim();
  if (!validEmail(email)) throw plainErr(EMAIL_ERR);
  const r = await sendEmailLink(email, { hearing_alerts: true, action_alerts: true });
  S.alertDraft.email = '';
  return { kind: 'email', email, demo: !!r?.demo };
}

// Wire a host's form: the swap between the two kinds, errors only on submit (C-9), and saving. onDone(result) gets
// { kind: 'phone', phone } or { kind: 'email', email }, with demo in the sandbox. The submit button may sit outside the
// form (the first visit's bar: <button form="...">).
export function wireAlertForm(form, { pfx, source, onDone, onSwap }) {
  if (!form) return;
  form.querySelectorAll('[data-alswap]').forEach(b => b.onclick = () => {
    S.alertMode = b.dataset.alswap;
    (onSwap || (() => app.render()))();
    requestAnimationFrame(() => document.getElementById(`${pfx}-${S.alertMode}`)?.focus());
  });
  const inp = form.querySelector(`#${pfx}-phone, #${pfx}-email`), err = form.querySelector(`#${pfx}-err`);
  if (!inp) return;
  const clear = () => { if (err) err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.setAttribute('aria-describedby', `${pfx}-hint`); };
  const show = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', `${pfx}-err ${pfx}-hint`); if (err) err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; inp.focus(); };
  inp.oninput = () => { S.alertDraft[S.alertMode === 'email' ? 'email' : 'phone'] = inp.value; if (err?.innerHTML) clear(); };
  form.onsubmit = async e => {
    e.preventDefault();
    const b = form.querySelector('button[type=submit]') || (form.id && document.querySelector(`button[form="${form.id}"]`));
    if (b?.getAttribute('aria-busy') === 'true') return;
    const was = b ? b.innerHTML : '';
    const email = S.alertMode === 'email', v = inp.value.trim();
    if (!v) { show(email ? 'Add your email, or skip this for now.' : 'Add your mobile number, or skip this for now.'); return; }
    // Checked only now, never while typing (C-9), and before anything is sent.
    if (email ? !validEmail(v) : !phoneDigits(v)) { show(email ? EMAIL_ERR : PHONE_ERR); return; }
    if (b) { b.setAttribute('aria-busy', 'true'); b.innerHTML = `${icon('loader-circle')}<span>Saving…</span>`; }
    try {
      const r = S.alertMode === 'email' ? await saveEmail(inp.value) : await saveText(inp.value, source);
      onDone && onDone(r);
    } catch (error) { if (!error?.plain) console.error(error); if (b) { b.removeAttribute('aria-busy'); b.innerHTML = was; } show(sayErr(error)); }
  };
}
// The line that says it worked, for a host to show where the box was.
export function alertDoneHTML(r, { change = '' } = {}) {
  // Almost, not done: the first text asks for a YES, and only then do alerts start (B-7: nothing looks finished before it is).
  if (r.kind === 'phone') return `<p class="strong">Our first text to <span class="al-nowrap">${esc(fmtPhone(r.phone))}</span> asks you to reply YES.</p>
    <p class="small">Then we’ll text you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up. Reply STOP any time.</p>
    ${r.demo ? '<p class="small muted">This is the sandbox, so the number was not saved.</p>' : ''}${change}`;
  // r.later: inside the first visit, where leaving for the inbox would cut it short (R-098), so: finish here first.
  return `<p class="strong">${r.later ? 'Link sent to' : 'Check your inbox at'} <span class="al-break">${esc(r.email)}</span></p>
    <p class="small">${r.later ? 'Tap it when you finish here to turn on alerts.' : 'Tap the link in the email to turn on alerts.'} It can take a minute; check spam if you don’t see it.</p>
    ${r.demo ? '<p class="small muted">This is the sandbox, so no email was sent.</p>' : ''}${change}`;
}
export const changeBtn = (attr, label) => btn(label, { kind: 'text', sm: true, attrs: { [attr]: '1' } });
