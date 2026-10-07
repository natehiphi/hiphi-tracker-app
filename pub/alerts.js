// The one alerts ask, phone first (R-146, Nate 10/4: "include a phone number option which should be more prominent"; he
// chose a phone box with email as a link under it). One box everywhere the page asks for alerts: the first visit's alerts
// screen (right after the issues are picked, before the "Mahalo!"), the ask on Home and after a first action
// (actions.js nudgeCard) and More > Get alerts. Each place draws its own frame and button; the fields, the words and the
// saving are here, so the consent words are the same wherever they are given.
//
// Texts: no texting service exists yet (decision 4, 9/30: "We plan to do texts. Will set up later."). A number is kept
// privately with the version of the words agreed (backend 121, text_signup; staff never see it) and nothing is sent
// until texts are set up; the first text then confirms the number. The words describe texts as working, as they do for
// email (R-101). Email: the same "keep me updated" consent as before, both kinds named in one line (C-4).
// Codes (R-155, Nate 10/5, "Code at sign-up"): once Supabase's phone sign-in is switched on (pub/phone.js), "Text me" texts
// a 6-digit code first, and the box becomes a code field. The right code signs the person in on this device (or adds the
// number to their account), then the number is kept under the code-time words (t2) and is already confirmed, so no
// confirming text follows. Before the switch, the box works as above.
// Nate 10/5 (R-176), seeing "reply YES" on a first visit when his decision was the code: "Code everywhere". The page never
// asks for a YES any more. Before the switch it says the number will be confirmed by text (t3), as the code will do.
// Legal, one line: the text consent words and the privacy page's lines on numbers should be confirmed by a lawyer before
// any text goes out; carrier registration (10DLC) also reviews this screen, and should name both uses, alerts and sign-in codes.
import { S, DEMO, app, esc, icon, textSaved, textLists, TEXT_KEY, CONSENT_KEY, supa, sendEmailLink, validEmail, friendly, linkText, nudgeOk, onb, onbSet } from './core.js';
import { codesOn, loadCodes, sendCode, verifyCode, codeErr, tooSoon, listenForCode, myEmail } from './phone.js';
import { btn } from './ui.js';
import { burst } from './fx.js';
import { abEvent, armOf, abSeen } from './variant.js';

// ---------------- The profile ask (R-184) ----------------
// Nate, 10/6: "if people get a link to take action or to follow a bill ... Are they then immediately prompted to sign-up?
// It's crucially important that we encourage them to build a profile for future engagement opportunities." Walking each
// shared link as a newcomer found the ask missing after an issue page's Follow (every live share card opens one until
// January), under the first screen after a letter, and always named for alerts, never for the profile that a number or
// an email is what makes (R-147). Nate's answers: "Save your profile" (with a brainstorm of other words for his picks), no
// second line on Home after a skip (one ask per visit stays, C-3), and replace the old ask but keep it as a backup to test
// later. So the box is the same everywhere; the heading says "Save your profile", the line over the box says what the
// profile keeps (why now), and the consent words under the box still say what arrives and how often (C-4: unchanged, so
// what people agree to is the stored version; A-14: the line over the box never repeats them).
// The old "Get alerts" ask is the test 'save''s second version (variant.js; backend 148 holds its switch, off).
export const profileAsk = () => armOf('save') === 'profile';
export const PROFILE_H = 'Save your profile';
// The line under the heading, by what just happened (kind: 'first' the first visit's own screen, 'follow', 'action' a
// letter or an email about a bill, 'intro' the hello letter, 'back'). It says what the profile keeps of what they just did
// and one concrete reason that helps next time; never what arrives (the box says it), never that few people act (C-10),
// one or two short sentences (C-14). The follow and letter lines are the brainstorm's recommended picks (A1, B1; R-184's
// page of options, for Nate's picks). "Any phone or computer": an email signs in by its link today, a number by a texted
// code once codes are on (R-155); the page describes texts as working (R-146, R-101).
// Before text codes are on (R-155) a number keeps the profile on this phone only, so "on any phone or computer" is left
// out until codesOn() (the fresh-eyes review, 10/6); the practice copy shows codes on, as the public will see them.
export function profileLede(kind, { off = false, things = '', many = false, n = 0 } = {}) {
  const anywhere = codesOn() ? ' on any phone or computer' : '';
  if (kind === 'action') return 'Bills often get more than one hearing. Your profile keeps what you wrote, so you can send it again next time.';
  if (kind === 'intro') return 'Your profile keeps your name and what you wrote, ready for the next time you write.';
  if (kind === 'back') return `Welcome back. ${things ? `Your ${things} live` : 'What you follow lives'} only in this browser for now. Save ${things ? 'them' : 'it'} to your profile to keep ${things ? 'them' : 'it'}${anywhere || ' safe'}.`;
  // The first visit's screen (n: the issues just followed). Nate 10/6 (R-188): its words "need to significantly improve".
  // They were two facts that didn't meet ("keeps your issues with you on any phone or computer", then what a hearing is),
  // so the reason to save was left for the reader to put together with the box's words. Now one sentence: what a profile
  // is in plain words (the issues just picked, named by count, and a way to reach you; Baymard: name what is kept), and
  // why it matters, the one fact only this line gives: a bill can get a hearing with about two days' notice. It leaves
  // to the box what arrives and "speak up" (the fresh-eyes review, 10/6: a first draft said "speak up at hearings" over a
  // box that says "speak up" and "hearing" again, A-14, and read as going to talk in a hearing room). Three lines on a
  // phone in both seasons, so the box starts 305px down (A-1; a 30-word January line pushed it to 332px). C-14.
  if (kind === 'first') {
    const yours = n === 1 ? 'your issue' : n ? `your ${n}\u00a0issues` : 'your issues';
    return `Your profile keeps ${yours} and a way to reach you in time: ${off ? 'from January, ' : ''}bills can get a hearing with about two days’ notice.`;
  }
  return `Nice start. Your profile keeps ${many ? 'these issues' : 'this issue'} with you${anywhere}, so you’re ready when ${many ? 'they need' : 'it needs'} you.`;
}
// After a yes, in the profile's words (the follow's toast once the sheet closes).
export function profileSaved(r) {
  if (r?.kind === 'email') return `Almost there: tap the link we sent to ${r.email} to finish your profile.`;
  if (r?.kind === 'phone') return r.confirmed || textSaved()?.confirmed ? 'Your profile is saved, and text alerts are on.' : `Your profile is saved. ${confirmWords(fmtPhone(r.phone))}`;
  return '';
}
// After a follow outside the first visit (an issue page, a bill page's "Follow the issue", a category): the profile ask in
// the sheet, the first thing seen after the follow, for someone with no way to be reached yet, once a visit, never after a
// recent "Not now" (nudgeOk: 14 days, then 60). name: what was followed, said at the top of the sheet. after(r): called once
// the sheet closes (r: what was given, or null), so the follow's own toast, with its Undo, comes after the sheet instead of
// under it. Returns false, without calling after, when it does not ask (the old version, or nothing to ask).
// The source recorded with a number is 'home' (backend 121 knows four): outside the first visit, not after an action.
export function followAsk(name, after, { many = false, receipt = '' } = {}) {
  if (S.session || alertsGiven() || !nudgeOk()) return false;
  abSeen('save');   // where the two versions differ: the old one asked nothing here
  if (!profileAsk()) return false;
  S.nudgedThisVisit = true; S.nudge = null;
  let got = null;
  openAlertsSheet({ source: 'home', profile: 'follow', lede: profileLede('follow', { many }), receipt: receipt || (name ? `You’re following “${name}”.` : 'You’re following it.'),
    onNo: () => { const n = (onb().nudgeNo || 0) + 1; onbSet({ nudgeNo: n, nudgeNoAt: new Date().toISOString() }); },
    onDone: r => { got = r; }, onClose: () => after && after(got) });
  return true;
}

// The version of the text consent words, and the words themselves: text_consent_words 't3' is exactly TEXT_PROMISE, a
// space, then TEXT_FINE (backend 141, R-176; 't1', backend 121 and 123, said "Our first text asks you to reply YES" and
// no one agreed to it). A new wording gets a new version there and here together, so what is recorded as agreed is
// always what was on the screen.
// The promise names both kinds of alert as real events (C-4; the fresh-eyes review, 10/4: "your moment to speak up" and
// "HIPHI's alerts" named nothing a newcomer could picture), and the small print says the first text confirms the number,
// so that text is expected when it comes, however long after the sign-up.
export const TEXT_CONSENT = 't3';
export const TEXT_PROMISE = 'We’ll text you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one text a day.';
export const TEXT_FINE = 'We’ll text you to confirm it’s your number. Message and data rates may apply. Reply STOP to stop, HELP for help.';
// Once codes are on (R-155): the first text is the code, and the words agreed are version t2 (backend 128), the same
// promise and this small print.
export const TEXT_CONSENT_CODE = 't2';
export const TEXT_FINE_CODE = 'We’ll text you a 6-digit code to confirm it’s your number. Message and data rates may apply. Reply STOP to stop, HELP for help.';
const textConsent = () => codesOn() ? TEXT_CONSENT_CODE : TEXT_CONSENT;
const textFine = () => codesOn() ? TEXT_FINE_CODE : TEXT_FINE;
export const EMAIL_PROMISE = 'We’ll email you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one email a day.';
const EMAIL_FINE = 'No password: we email you a link to confirm. Unsubscribe in one tap.';
// What makes a number feel safe to type sits right under the box, where it is typed (P-5).
const PHONE_HINT = 'Private: HIPHI staff never see your number, and it is used only for these texts.';
const EMAIL_HINT = 'We never sell your email or give it to other groups. Staff can see which issues you follow.';
// In the profile ask (R-188) the phone's line first answers what "Save your profile" makes someone wonder (R-184 left it
// open, the brainstorm's A11): is this an account to set up? No password. It no longer says "these texts" before any
// text is mentioned (the consent words come under it); its promises are the same: staff never see the number, and it is
// used only to text you. Not for someone already signed in, who has a profile (More > Get alerts adds a number to it).
// The email's small print already says "No password", so its line stays as it was.
const PROFILE_PHONE_HINT = 'No password needed. HIPHI staff never see your number, and it’s used only to text you.';
const hintFor = phone => !phone ? EMAIL_HINT : profileAsk() && !S.session ? PROFILE_PHONE_HINT : PHONE_HINT;
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

// ---------------- One status rule for every screen that reports alerts (D1-4, R-180) ----------------
// The assessment found "Text alerts are on" over a number nobody had confirmed, and "Alerts are on" or "Email reminders
// on" for anyone signed in, even with both email choices off. The rule now (DESIGN B-7: nothing looks finished before it
// is): ON only when alerts can really reach the person, that is a number proven by its code, or a signed-in account with
// an email and at least one email choice ticked. ALMOST SET when a number is kept but not yet confirmed (before codes are
// on, R-176: "We'll text you to confirm it's your number"), when a code was texted and not yet typed, or when an email
// link that turns alerts on waits to be opened. OFF otherwise, which includes a link sent from the sign-in page with
// "Keep me updated" left empty (opening it signs in, nothing more). The words are the alerts box's own (alertDoneHTML,
// the code step's lede, More's toast), so the alerts step, both endings, Home, the profile and More > Get alerts all say
// the same thing. Texts are described as working (R-146): nothing here says they are not set up yet.
// fmt: how a number is shown (the profile masks it). Returns { key: 'on' | 'almost' | 'code' | 'off', text and email (each
// channel's own state), phone, mail, icon, title, sub, line (one sentence, for a toast or a moment), short (Home's chip,
// or ''), action (the endings' button on their alerts row: 'Turn on alerts', 'Enter the code', or '') }.
// A title names what is almost set (the fresh-eyes review, 10/5: "Almost set" alone, in a list of things done, named
// nothing); a sentence, after the words that say what it is about, keeps the short "Almost set.".
const ALMOST = 'Almost set', ALMOST_T = 'Alerts almost set';
const CODE_SAY = 'Type the 6-digit code from the text to turn on alerts.';   // the code step's own lede
export const confirmWords = ph => `We’ll text ${ph} to confirm it’s your number.`;
export const almostLine = ph => `${ALMOST}. ${confirmWords(ph)}`;   // a toast's or a moment's one sentence
const consentPending = () => { try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); } catch { return null; } };
export function alertStatus({ fmt = fmtPhone } = {}) {
  const t = textSaved(), prefs = S.user?.prefs || {}, mail = myEmail(), sent = linkSent(), c = consentPending();
  const text = t?.confirmed ? 'on' : t ? 'almost' : S.alertCode ? 'code' : 'off';
  const email = S.session ? (mail && (prefs.hearing_alerts === true || prefs.action_alerts === true) ? 'on' : 'off')
    : (sent || c) && (!c || c.hearing_alerts || c.action_alerts) ? 'almost' : 'off';
  const ph = t ? fmt(t.phone) : S.alertCode ? fmt(S.alertCode.phone) : '';
  const out = (key, icon, title, sub, line, short = '', action = '') => ({ key, text, email, phone: ph, mail: email === 'almost' ? sent : mail, icon, title, sub, line, short, action });
  if (text === 'on' && email === 'on') return out('on', 'bell', 'Alerts are on', `We’ll text ${ph} and email ${mail}`, `Alerts are on for ${ph} and ${mail}.`, 'Alerts on');
  if (text === 'on') return out('on', 'message-square', 'Text alerts are on', `We’ll text ${ph}`, `Text alerts are on for ${ph}.`, 'Text alerts on');
  if (email === 'on') return out('on', 'mail', 'Email alerts are on', `We’ll email ${mail}`, `Email alerts are on for ${mail}.`, 'Email alerts on');
  if (text === 'almost') return out('almost', 'message-square', ALMOST_T, confirmWords(ph), almostLine(ph), ALMOST_T);
  if (email === 'almost') { const s = sent ? `Tap the link we sent to ${sent} to turn on alerts.` : 'Tap the link in the email to turn on alerts.';
    return out('almost', 'mail', ALMOST_T, s, `${ALMOST}. ${s}`, ALMOST_T); }
  // A row that carries its own button says what the button cannot: which phone the code went to; and, off, why alerts
  // help (it said "Turn them on any time in More" right above "Turn on alerts", and More had no row named alerts).
  if (text === 'code') return out('code', 'message-square', ALMOST_T, `We texted a code to ${ph}.`, `${ALMOST}. ${CODE_SAY}`, '', 'Enter the code');
  return out('off', 'bell', 'Alerts are off', 'Hearings are set only about two days ahead.', 'Alerts are off.', '', 'Turn on alerts');
}
// The lede over the number box for someone signed in with an email (More > Get alerts and the sheet): their email alerts
// are the two choices in the profile. It said "Add your mobile number to get texts too" even with both choices off.
export function emailLede() {
  return alertStatus().email === 'on' ? 'Your email alerts are in your profile. Add your mobile number to get texts too.'
    : 'Your email alerts are off. <a href="#/profile">Turn them on in your profile</a>, or add your mobile number to get texts.';
}

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
  if (S.alertCode?.pfx === pfx) return codeFields(pfx, { emailHref, withSwap });
  const phone = S.alertMode !== 'email', v = S.alertDraft[phone ? 'phone' : 'email'];
  // A sentence, so its Privacy link is a link in running text (WCAG 2.5.8's inline exception, DESIGN A-6). For texts, the
  // terms page sits beside it: carriers ask for links to privacy AND terms at the sign-up (R-180, D1-2). It stays out of
  // the small print below, whose words must match the stored consent version exactly.
  const hint = `<p class="help al-hint" id="${pfx}-hint">${hintFor(phone)} <a href="#/privacy">Privacy</a>${phone ? ' · <a href="text-terms.html">Text terms</a>' : ''}</p>`;
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
    <p class="al-fine">${phone ? textFine() : EMAIL_FINE}${DEMO ? ' In the sandbox nothing is sent or saved.' : ''}</p>${withSwap ? `<p class="al-swaprow">${swap}</p>` : ''}`;
}
// The code step (R-155): where the number was, the code we just texted to it, with a new code, a different number and email
// one tap away (a code that never comes has a way out, B-3). One field, filled in by the phone itself where it can (iPhone:
// above the keyboard; Android: by itself). The host's heading says "Check your texts" meanwhile (codeStep).
export const codeStep = pfx => S.alertCode?.pfx === pfx;
function codeFields(pfx, { emailHref = '', withSwap = true } = {}) {
  const c = S.alertCode;
  const email = !withSwap ? '' : emailHref ? `<a class="al-swap" href="${emailHref}">Use email instead</a>` : `<button type="button" class="btn text sm al-swap" data-alswap="email">Use email instead</button>`;
  return `<div class="field al-field al-codefield"><label for="${pfx}-code">6-digit code</label>
      <p class="help al-codeto" id="${pfx}-codeto">We texted a code to <span class="strong al-nowrap">${esc(fmtPhone(c.phone))}</span>. It can take a minute.</p>
      <input id="${pfx}-code" name="code" class="al-code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*" maxlength="6" enterkeyhint="done" aria-describedby="${pfx}-codeto" value="${esc(c.code || '')}">
      <span class="err" id="${pfx}-err" role="alert"></span></div>
    ${c.add || DEMO ? `<p class="al-fine">${c.add ? 'This number is added to your profile, so it signs you in too.' : ''}${DEMO ? `${c.add ? ' ' : ''}In the sandbox no code is sent: type any 6 digits.` : ''}</p>` : ''}
    <p class="al-swaprow al-coderow"><button type="button" class="btn text sm" data-alresend>Send a new code</button><button type="button" class="btn text sm" data-alnumber>Use a different number</button>${email}</p>
    <p class="small al-status" id="${pfx}-status" role="status"></p>`;
}
// The host's button words for the box showing now (pfx: that host's box, which may be at its code step).
// With codes on, the number's button names what it sends: a code (the review, 10/5: "Text me" read as "send me alerts").
export const alertButton = pfx => S.alertCode && (!pfx || S.alertCode.pfx === pfx) ? { label: 'Confirm', icon: 'check' }
  : S.alertMode === 'email' ? { label: 'Email me', icon: 'mail' } : { label: codesOn() ? 'Text me a code' : 'Text me', icon: 'message-square' };

// Keep a number: the row in text_signups (token kept on this device), then this device remembers it.
export async function saveText(input, source) {
  const d = phoneDigits(input);
  if (!d) throw plainErr(PHONE_ERR);
  const t = textSaved(), token = t?.token || crypto.randomUUID();   // the published page is https, where every browser has it
  if (!DEMO) {
    const sb = await supa();
    const { data, error } = await sb.rpc('text_signup', { p: { token, phone: d, consent: textConsent(), source, ...textLists() } });
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
// "Stop texts to my number" (D1-3, backend 156): a stop asked for by number, from any browser, without the old one. The answer is the
// same whether or not the number was on file (so it cannot be used to find who signed up). A stop for this device's own number also
// makes this device forget it.
export async function stopNumber(input) {
  const d = phoneDigits(input);
  if (!d) throw plainErr(PHONE_ERR);
  if (!DEMO) {
    const sb = await supa(); const { data, error } = await sb.rpc('text_stop_number', { p: { phone: d } });
    if (error) throw error;
    if (!data?.ok) throw plainErr(data?.why === 'busy' ? 'Too many stops are being asked for just now. Try again in a minute, or email contact@hiphi.org.' : PHONE_ERR);
  }
  const t = textSaved();
  if (t && t.phone === d) { try { localStorage.removeItem(TEXT_KEY); } catch { /* ignore */ } }
  return { phone: d, demo: DEMO };
}
async function saveEmail(input, source = '') {
  const email = String(input || '').trim();
  if (!validEmail(email)) throw plainErr(EMAIL_ERR);
  const r = await sendEmailLink(email, { hearing_alerts: true, action_alerts: true, source: source || 'alerts_box', version: 'e1' });   // e1: this box's promise and small print (backend 157)
  S.alertDraft.email = '';
  return { kind: 'email', email, demo: !!r?.demo };
}

// Wire a host's form: the swap between the two kinds, errors only on submit (C-9), and saving. onDone(result) gets
// { kind: 'phone', phone } or { kind: 'email', email }, with demo in the sandbox. The submit button may sit outside the
// form (the first visit's bar: <button form="...">).
export function wireAlertForm(form, { pfx, source, onDone, onSwap }) {
  if (!form) return;
  const redraw = onSwap || (() => app.render());
  const btnOf = () => form.querySelector('button[type=submit]') || (form.id && document.querySelector(`button[form="${form.id}"]`));
  form.querySelectorAll('[data-alswap]').forEach(b => b.onclick = () => {
    S.alertMode = b.dataset.alswap;
    if (S.alertCode?.pfx === pfx) S.alertCode = null;   // email instead, from the code step
    redraw();
    requestAnimationFrame(() => document.getElementById(`${pfx}-${S.alertMode}`)?.focus());
  });
  const code = form.querySelector(`#${pfx}-code`);
  if (code) { wireCode(form, code, { pfx, source, onDone, redraw, btnOf }); return; }
  const inp = form.querySelector(`#${pfx}-phone, #${pfx}-email`), err = form.querySelector(`#${pfx}-err`);
  if (!inp) return;
  const clear = () => { if (err) err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.setAttribute('aria-describedby', `${pfx}-hint`); };
  const show = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', `${pfx}-err ${pfx}-hint`); if (err) err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; inp.focus(); };
  inp.oninput = () => { S.alertDraft[S.alertMode === 'email' ? 'email' : 'phone'] = inp.value; if (err?.innerHTML) clear(); };
  form.onsubmit = async e => {
    e.preventDefault();
    const b = btnOf();
    if (b?.getAttribute('aria-busy') === 'true') return;
    const was = b ? b.innerHTML : '';
    const email = S.alertMode === 'email', v = inp.value.trim();
    if (!v) { show(email ? 'Add your email, or skip this for now.' : 'Add your mobile number, or skip this for now.'); return; }
    // Checked only now, never while typing (C-9), and before anything is sent.
    if (email ? !validEmail(v) : !phoneDigits(v)) { show(email ? EMAIL_ERR : PHONE_ERR); return; }
    if (b) { b.setAttribute('aria-busy', 'true'); b.innerHTML = `${icon('loader-circle')}<span>${email ? 'Saving…' : 'Sending…'}</span>`; }
    const codes = !email && await loadCodes();
    try {
      // Codes on (R-155): text a code first; the box turns into the code field, and the number is kept once it is proven.
      if (codes) {
        const d = phoneDigits(v), r = await sendCode(d);
        S.alertCode = { pfx, phone: d, add: r.add, code: '' }; S.alertDraft.phone = '';
        redraw();
        requestAnimationFrame(() => document.getElementById(`${pfx}-code`)?.focus());
        return;
      }
      const r = email ? await saveEmail(inp.value, source) : await saveText(inp.value, source);
      onDone && onDone(r);
    } catch (error) { if (!error?.plain && !error?.code) console.error(error); if (b) { b.removeAttribute('aria-busy'); b.innerHTML = was; } show(codes ? codeErr(error, { sending: true }) : sayErr(error)); }
  };
}
// The code step's wiring (R-155). Six digits send it by themselves (typed, pasted or filled in by the phone). The right
// code signs in (or adds the number to the account), then the number is kept with the account under the code-time words
// and confirmed (backend 128, text_link). A code that worked is never asked for again if keeping the number then fails.
function wireCode(form, inp, { pfx, source, onDone, redraw, btnOf }) {
  const c = S.alertCode, err = form.querySelector(`#${pfx}-err`), status = form.querySelector(`#${pfx}-status`);
  const clear = () => { if (err) err.innerHTML = ''; inp.removeAttribute('aria-invalid'); inp.setAttribute('aria-describedby', `${pfx}-codeto`); };
  const show = text => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', `${pfx}-err ${pfx}-codeto`); if (err) err.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`; inp.focus(); };
  const say = text => { if (status) status.textContent = text; };
  let busy = false;
  inp.oninput = () => { const v = inp.value.replace(/\D/g, '').slice(0, 6); if (v !== inp.value) inp.value = v; c.code = v; if (err?.innerHTML) clear(); if (v.length === 6) form.requestSubmit?.(); };
  listenForCode(inp, () => { c.code = inp.value; form.requestSubmit?.(); });
  const again = form.querySelector('[data-alresend]');
  if (again) again.onclick = async () => {
    if (tooSoon()) { say('Wait a minute before asking for a new code.'); return; }
    say('Sending a new code…');
    try { await sendCode(c.phone); say(`We sent a new code to ${fmtPhone(c.phone)}.`); } catch (e) { say(''); show(codeErr(e, { sending: true })); }
  };
  const other = form.querySelector('[data-alnumber]');
  if (other) other.onclick = () => {
    S.alertDraft.phone = fmtPhone(c.phone); S.alertCode = null; S.alertMode = 'phone'; redraw();
    requestAnimationFrame(() => { const i = document.getElementById(`${pfx}-phone`); if (i) { i.focus(); i.select(); } });
  };
  form.onsubmit = async e => {
    e.preventDefault();
    if (busy) return;
    const b = btnOf(), was = b ? b.innerHTML : '', v = inp.value.replace(/\D/g, '');
    if (v.length !== 6) { show(v ? 'Enter all 6 digits from the text.' : 'Enter the 6-digit code from the text.'); return; }
    busy = true; inp.readOnly = true; say('');
    if (b) { b.setAttribute('aria-busy', 'true'); b.innerHTML = `${icon('loader-circle')}<span>Checking…</span>`; }
    try {
      if (!c.ok) { await verifyCode(c.phone, v, { add: c.add }); c.ok = true; }
      await saveText(c.phone, source);
      if (DEMO) { try { localStorage.setItem(TEXT_KEY, JSON.stringify({ ...textSaved(), confirmed: true })); } catch { /* ignore */ } }
      else await linkText();
      S.alertCode = null;
      onDone && onDone({ kind: 'phone', phone: c.phone, confirmed: true, demo: DEMO });
    } catch (error) {
      busy = false; inp.readOnly = false;
      if (b) { b.removeAttribute('aria-busy'); b.innerHTML = was; }
      if (!error?.plain && !error?.code) console.error(error);
      show(c.ok ? `You’re signed in, but your number didn’t save. Tap ${b?.textContent?.trim() || 'Confirm'} to try again.` : codeErr(error));
    }
  };
}
// The line that says it worked, for a host to show where the box was. In the profile ask (R-184) a number's line starts by
// saying the profile is saved (a number makes one on this phone, myprofile.js hasProfile), and an email's says its link
// finishes the profile: the ask said "Save your profile", so the answer says what became of it.
export function alertDoneHTML(r, { change = '' } = {}) {
  const prof = profileAsk() && r.kind === 'phone' ? '<p class="al-saved">Your profile is saved.</p>' : '';
  // Confirmed by a code (R-155): done, and signed in with the number.
  if (r.kind === 'phone' && (r.confirmed || textSaved()?.confirmed)) return `${prof}<p class="strong">Text alerts are on for <span class="al-nowrap">${esc(fmtPhone(r.phone))}</span>.</p>
    <p class="small">${S.session ? 'You’re signed in with your number. Use it to sign in on any phone or computer, and your profile is there.' : 'Use your number to sign in on any phone or computer.'} Reply STOP to any text to end them.</p>
    ${r.demo ? '<p class="small muted">This is the sandbox: no code was sent, nothing was saved, and you stay signed out.</p>' : ''}${change}`;
  // Almost, not done: the first text confirms the number, and only then do alerts start (B-7: nothing looks finished
  // before it is). The same words as alertStatus()'s "Almost set", which every other screen shows (D1-4).
  if (r.kind === 'phone') return `${prof}<p class="strong">${confirmWords(`<span class="al-nowrap">${esc(fmtPhone(r.phone))}</span>`)}</p>
    <p class="small">Then we’ll text you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up. Reply STOP any time.</p>
    ${r.demo && !prof ? '<p class="small muted">This is the sandbox, so the number was not saved.</p>' : ''}${change}`;
  // r.later: inside the first visit, where leaving for the inbox would cut it short (R-098), so: finish here first.
  const turnOn = profileAsk() ? 'to finish your profile and turn on alerts' : 'to turn on alerts';
  return `<p class="strong">${r.later ? 'Link sent to' : 'Check your inbox at'} <span class="al-break">${esc(r.email)}</span></p>
    <p class="small">${r.later ? `Tap it when you finish here ${turnOn}.` : `Tap the link in the email ${turnOn}.`} It can take a minute; check spam if you don’t see it.</p>
    ${r.demo ? '<p class="small muted">This is the sandbox, so no email was sent.</p>' : ''}${change}`;
}
export const changeBtn = (attr, label) => btn(label, { kind: 'text', sm: true, attrs: { [attr]: '1' } });

// ---------------- The alerts box in a sheet (X10-4, R-180) ----------------
// The first visit's endings said "Alerts are off · Turn them on any time in More", and More had no row that said alerts.
// Now that row carries its own button: "Turn on alerts" (or "Enter the code", when a code was texted and not typed) opens
// this sheet over the ending, so the peak stays where it is. The same fields, consent words and saving as every other box
// (alertFields, wireAlertForm), the same heading and lede as More > Get alerts; email swaps in place, as in the first
// visit, so an email given here turns alerts on. A code texted from the alerts step carries over and can be typed here.
// On a phone it rises from the bottom; on a laptop it sits in the middle (base.css .al-sheet). Not now and Esc close it;
// what was typed is kept for the page's life (S.alertDraft, C-9). onDone(r) after a yes; onClose() whenever it closes.
// profile: the profile ask's words for that kind (R-184, followAsk), with receipt, the line saying what just worked, over
// the heading (C-3: the ask follows a success, and says so). onNo: "Not now" was pressed (it closes the sheet as before).
let sheet = null;
const SH = 'al-sh';
export function openAlertsSheet({ source = 'more', onDone, onClose, onNo, profile = '', lede = '', receipt = '' } = {}) {
  if (S.alertCode && S.alertCode.pfx !== SH) S.alertCode.pfx = SH;
  if (!sheet) {
    sheet = document.createElement('dialog'); sheet.className = 'sheet al-sheet'; sheet.setAttribute('aria-labelledby', `${SH}-h`);
    document.body.appendChild(sheet);
  }
  sheet.onclose = () => { onClose && onClose(); };
  const paint = () => {
    const code = codeStep(SH), mail = !!(S.session && myEmail());
    if (mail) S.alertMode = 'phone';   // a signed-in email's alerts are its two choices in the profile (as on More > Get alerts)
    const b = alertButton(SH);
    sheet.innerHTML = `<form class="al-shin" id="${SH}-form" novalidate>
      ${receipt && !code ? `<p class="al-shrcpt">${icon('circle-check')}<span>${esc(receipt)}</span></p>` : ''}
      <h2 id="${SH}-h" tabindex="-1">${code ? 'Check your texts' : profile ? PROFILE_H : 'Get alerts on your issues'}</h2>
      <p class="al-shlede">${code ? CODE_SAY : mail ? emailLede() : profile ? esc(lede || profileLede(profile)) : 'Hearings are posted about two days ahead. We’ll tell you in time to speak up.'}</p>
      <div class="al-shbox">${alertFields(SH, { swap: !mail })}</div>
      <div class="al-shbtns">${btn(b.label, { kind: 'primary', icon: b.icon, attrs: { type: 'submit', id: `${SH}-send` } })}${btn('Not now', { kind: 'text', attrs: { 'data-alshno': '1' } })}</div>
    </form>`;
    sheet.querySelector('[data-alshno]').onclick = () => { onNo && onNo(); sheet.close(); };
    sheet.querySelectorAll('.al-shlede a').forEach(a => a.addEventListener('click', () => sheet.close()));
    wireAlertForm(sheet.querySelector('form'), { pfx: SH, source, onSwap: paint, onDone: r => { sheet.close(); onDone && onDone(r); } });
  };
  paint();
  try { sheet.showModal(); } catch { sheet.setAttribute('open', ''); }
  // The profile ask opens on its heading on a touch screen: focusing the box there raised the keyboard over "Not now"
  // before the ask was read (the fresh-eyes review, 10/6). A laptop still starts in the box.
  const touch = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } })();
  requestAnimationFrame(() => (profile && touch && !codeStep(SH) ? sheet.querySelector(`#${SH}-h`) : sheet.querySelector(`#${SH}-code, #${SH}-phone, #${SH}-email`))?.focus());
}

// The endings' alerts row (today's "You're all set" and the plans' ending draw the same .st-did list, start.css): the
// status by the one rule above, and, when alerts are off or a code waits to be typed, the button that opens the sheet
// (X10-4). A secondary button under the words, so the ending keeps one primary, "See How I Can Help" (A-3, R-190).
export function alertRowHTML(k = 0) {
  const a = alertStatus(), kind = a.key === 'on' ? 'ok' : a.key === 'off' ? 'off' : 'wait';
  return `<li class="st-alrow" style="--k:${k}" data-alrow tabindex="-1"><span class="st-rc st-rc-${kind}">${icon(kind === 'ok' ? 'check' : a.icon)}</span><div><b>${esc(a.title)}</b><span>${esc(a.sub)}</span>
    ${a.action ? btn(a.action, { kind: 'secondary', sm: true, icon: a.key === 'code' ? 'message-square' : 'bell', cls: 'st-alon', attrs: { 'data-alsheet': '1' } }) : ''}</div></li>`;
}
// Wire that button. When the sheet closes having changed something, the ending is drawn again standing still (S.stCalm:
// its words, the next steps and the petals' rule all follow the new status, and nothing that already played plays again),
// focus goes to the row, which says the new status, and a yes gets the small burst (C-7: a small win, a small burst).
export function wireAlertRow(root = document, { source = 'first_visit' } = {}) {
  const b = root.querySelector('[data-alsheet]'); if (!b) return;
  b.onclick = () => {
    const said = a => `${a.title}|${a.sub}`, was = said(alertStatus());
    openAlertsSheet({ source, onClose: () => {
      const now = alertStatus(); if (said(now) === was) return;
      S.stCalm = true; try { app.render(); } finally { S.stCalm = false; }
      const row = document.querySelector('[data-alrow]'); if (!row) return;
      row.focus({ preventScroll: true });   // the page is the same length, so the row is where the button was
      if (now.key === 'on' || now.key === 'almost') burst(row.querySelector('.st-rc'), 12, 44);
    } });
  };
}
