// Sign in with a mobile number and a 6-digit code (R-155, Nate 10/5). Asked whether someone who signed up with a number
// could log in on a laptop: they could not (only an email signed anyone in; a number kept the profile on one phone). His
// "Yes" to sign-in by text code, and, asked first, "Code at sign-up": once texts are on, typing a number in the alerts box
// texts a code at once, and typing it confirms the number and signs the person in on that phone (in place of the old
// "reply YES"), so "Sign in with your number" on a laptop brings the whole profile.
//
// The switch is Supabase's own phone sign-in (Authentication > Sign In / Providers > Phone), turned on once the texting
// service is set up (backend docs/TEXT-SIGN-IN.md): the page asks Supabase whether it is on and offers codes only then. Until
// then every box works as before (R-146: the number is kept, nothing is sent). The sandbox shows codes on, as the public will
// see them once texts are set up (R-176, Nate 10/5: "Code everywhere"); &codes=0 shows the page as it is until then.
//
// One number per person: signed out, a code signs in (or makes the account); signed in, a code adds the number to the
// account (Supabase's phone change), so an email account that adds a number is found by either. Signing in is never
// consent to texts: only the alerts box, with its words, is (backend 128, text_link).
// Legal, one line: sign-in codes by text and the code-time consent words should be confirmed by a lawyer (R-149).
import { S, DEMO, app, SUPABASE_URL, SUPABASE_KEY, supa, loadUser, friendly } from './kernel.js';

// Is sign-in by code on? undefined until Supabase answers (a few hundred milliseconds after the page starts); false on
// any doubt, so the page never offers a code that cannot be sent.
let asked = null;
export function loadCodes() {
  if (asked) return asked;
  if (DEMO) { S.codes = new URLSearchParams(location.search).get('codes') !== '0'; return (asked = Promise.resolve(S.codes)); }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 5000);
  asked = fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY }, signal: ctl.signal })
    .then(r => r.ok ? r.json() : null).then(j => !!j?.external?.phone).catch(() => false)
    .then(on => { clearTimeout(t); const was = S.codes; S.codes = on; if (on && !was) app.render(); return on; });
  return asked;
}
export const codesOn = () => S.codes === true;
loadCodes();

const e164 = d => '+1' + d;
const plain = text => Object.assign(new Error(text), { plain: true });
// Supabase's sign-in errors, each as a sentence (C-9). Anything else goes through friendly().
export function codeErr(e, { sending = false } = {}) {
  if (e?.plain) return e.message;
  const c = String(e?.code || ''), m = String(e?.message || '');
  if (!sending && (c === 'otp_expired' || /expired|invalid/i.test(m))) return 'That code didn’t work, or it has expired. Check the text, or send a new code.';
  if (/rate_limit/.test(c) || e?.status === 429 || /rate limit|after \d+ seconds/i.test(m)) return 'Too many codes for now. Wait a minute, then send a new code.';
  if (c === 'phone_exists' || /already been registered|already registered/i.test(m)) return 'That number already signs in to another profile. Sign out, then sign in with that number.';
  if (c === 'phone_provider_disabled' || /provider|disabled|signups not allowed/i.test(m)) return 'Text codes aren’t working right now. Use email instead.';
  if (c === 'sms_send_failed' || /sms|twilio|phone/i.test(m)) return 'We couldn’t text that number. Check it, or use email instead.';
  return friendly(e);
}

// Text a code to a number (ten digits). Signed in: the number is added to the account; otherwise it signs in.
export async function sendCode(d) {
  const add = !!S.session;
  if (!DEMO) {
    const sb = await supa();
    const { error } = add ? await sb.auth.updateUser({ phone: e164(d) }) : await sb.auth.signInWithOtp({ phone: e164(d) });
    if (error) throw error;
  }
  S.codeAt = Date.now();
  return { add, at: S.codeAt };
}
// Asked again too soon: Supabase allows one code a minute to a number. Said, never a disabled button.
export const tooSoon = () => S.codeAt && Date.now() - S.codeAt < 60000;

// Check the code. On success the person is signed in (or the number is on their account), this device's issues, stances,
// letters and profile join the account (loadUser, as after an email link), and the device learns the account's text row.
// The page is not restarted: the sign-in happens in the middle of a flow (the first visit's alerts screen), which goes on.
export async function verifyCode(d, code, { add = !!S.session } = {}) {
  const token = String(code || '').replace(/\D/g, '');
  if (token.length !== 6) throw plain('Enter the 6 digits from the text.');
  if (DEMO) return { demo: true };
  const sb = await supa();
  S.quietAuth = true;   // kernel.js: a sign-in made here does not restart the page
  try {
    const { data, error } = await sb.auth.verifyOtp({ phone: e164(d), token, type: add ? 'phone_change' : 'sms' });
    if (error) throw error;
    if (data?.session) S.session = data.session;
    else { const r = await sb.auth.refreshSession(); if (r.data?.session) S.session = r.data.session; }
    if (!S.session) throw plain('That didn’t sign you in. Try again.');
  } finally { S.quietAuth = false; }
  await loadUser();   // its last step is the account's text row (kernel.js linkText)
  return { signedIn: true };
}

// Email sign-in by code (R-156 D2, the review): the email with the sign-in link also carries a 6-digit code, for work email
// whose scanners use the link up before the person taps it, and for an iPhone whose links open outside the Home Screen
// app. It needs {{ .Token }} in Supabase's Magic Link email (Authentication > Emails), Nate's dashboard step: until then
// EMAIL_CODES stays false and the page offers no code it cannot keep. The sandbox shows it with &ecode.
export const EMAIL_CODES = false;
export const emailCodesOn = () => DEMO ? new URLSearchParams(location.search).has('ecode') : EMAIL_CODES;
export async function verifyEmailCode(email, code) {
  const token = String(code || '').replace(/\D/g, '');
  if (token.length !== 6) throw plain('Enter the 6 digits from the email.');
  if (DEMO) return { demo: true };
  const sb = await supa();
  S.quietAuth = true;   // as verifyCode: the page goes on where it was
  try {
    const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
    if (error) throw (/expired|invalid/i.test(String(error.message || '')) || error.code === 'otp_expired' ? plain('That code didn’t work, or it has expired. Check the newest email, or send a new link.') : error);
    if (data?.session) S.session = data.session;
    if (!S.session) throw plain('That didn’t sign you in. Try again.');
  } finally { S.quietAuth = false; }
  await loadUser();
  return { signedIn: true };
}
// The account's own number, when it signed in with one (Supabase keeps it as 18085550123).
export function myNumber() {
  const p = String(S.session?.user?.phone || '').replace(/\D/g, '');
  return p.length === 11 && p[0] === '1' ? p.slice(1) : p.length === 10 ? p : '';
}
export const myEmail = () => String(S.session?.user?.email || '');

// Android's Chrome can read the code from the text by itself (the WebOTP API; the text ends "@natehiphi.github.io #123456", backend
// docs/TEXT-SIGN-IN.md). iPhones offer it above the keyboard instead (autocomplete="one-time-code"). Stopped when the box goes.
let otpCtl = null;
export function listenForCode(input, then) {
  try { otpCtl?.abort(); } catch { /* ignore */ }
  otpCtl = null;
  if (!input || DEMO || !('OTPCredential' in window)) return;
  const ctl = otpCtl = new AbortController();
  navigator.credentials.get({ otp: { transport: ['sms'] }, signal: ctl.signal })
    .then(o => { if (o?.code && document.body.contains(input)) { input.value = o.code; then(o.code); } }).catch(() => {});
}
