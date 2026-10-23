// "Your alerts" (R-303, behind ?rec=1): #/alerts for someone who has a profile (a text number on this device, or an account).
// It holds every alerts setting in one place, each saving the moment it changes, as the issue page's switch does (B-7, A-15):
// where texts and email go, "How much each issue sends" (R-299's switch, once per followed issue), and a quiet "Stop texts
// to this phone" at the foot, said once. Profile's alerts sections and its Save bar for them moved here (mine-profile-alerts.md
// sections 3-4: alerts started 2,996px down Profile and waited for Save there, while the issue page saved at once).
// The promise is the live consent's (t5/e3, alerts.js TEXT_FINE/EMAIL_FINE), as today's page without ?rec says it too since
// Nate's Change of 18 Oct (it said "At most one text a day").
// Without a profile, or while a number is being added or changed, #/alerts is the sign-up box as before (pub/more.js), with a
// back row and the same live promise.
// A link sent and not yet opened says what comes, in the Text terms page's words, as today's page does (alerts.js GETS_*, Nate's
// "match reality" of 18 Oct).
// "Asks from HIPHI's partners" (R-328 batch G, migration 185, Nate's yes 22 Oct): for an account with an email, the three
// choices of the plan (A few, As they come, None) in this page's own choice style, each saved the moment it is picked, and
// the partners the person stopped from an email's link, each with Start again (B-5: Undo in its toast). Partner asks come
// with HIPHI's own updates by email, so the choices wait while those are off (B-12). No consent words change here (C-4): the
// setting only narrows what the person already said yes to. The practice copy has no sign-in: with the partner switch
// (?demo=1&partner=1) this page draws as the sample person's account (pub/partners.js sandboxAccount), nothing sent or saved.
import { S, DEMO, app, esc, icon, toast, friendly, textSaved, followedIssues, followsAnything, levelOf } from '../core.js';
import { btn, inlineErr } from '../ui.js';
import { CHOICES, check, submitBtn, stopNumberBox, nextStep, A } from '../more.js';
import { alertFields, alertButton, codeStep, confirmWords, almostLine, alertStatus, LEVEL_WORDS, levelSwitch, wireLevels,
  ALERT_PROMISE, TEXT_FINE, EMAIL_FINE, EMAIL_ALERTS, EMAIL_SAME, EMAIL_EVERY, linkSent, GETS_WHAT, GETS_EMAILS, levelsWhere } from '../alerts.js';
import { hasProfile, signedIn } from '../myprofile.js';
import { myEmail } from '../phone.js';
import { recHead, recSec } from './kit.js';
import { backFrom } from './you.js';
import { ASK_LEVELS, ASK_WORDS, askLevel, sandboxAccount, keepSandbox, setPartnerAsks, partnerAsksNow, stopPartnerAsks } from '../partners.js';

const masked = d => `(${d.slice(0, 3)}) ••• ${d.slice(6)}`;
const first = s => (/^(.+?[.!?])(\s|$)/.exec(s) || [, s])[1];   // "A few texts a month." from the consent's fine print
const $ = s => document.querySelector(s);
// The account this page's email choices belong to: the signed-in person's, or the practice copy's sample with its partner switch.
const acct = () => signedIn() ? S.user : sandboxAccount();
const mailOf = () => signedIn() ? myEmail() : sandboxAccount()?.email || '';
export const yoursNow = () => (hasProfile() || !!sandboxAccount()) && !A.edit && !codeStep('mr-al');

// One way it reaches the person: an icon, what and where, its state in one line, and the one thing to change it.
const way = (ic, what, state, act) => `<div class="ya-way"><span class="rc-wic">${icon(ic)}</span><div class="ya-wt"><p class="ya-wn">${what}</p>${state ? `<p class="ya-ws">${state}</p>` : ''}</div>${act}</div>`;
function texts() {
  const t = textSaved();
  if (!t) return way('message-square', 'Texts: not added', esc(ALERT_PROMISE), btn('Add texts', { kind: 'text', sm: true, attrs: { 'data-mr-alchange': '' } }));
  const ph = masked(t.phone);
  return way('message-square', `Texts to <span class="al-nowrap">${esc(ph)}</span>`,
    t.confirmed ? `On. ${esc(first(TEXT_FINE))}` : `<b>Almost set.</b> ${esc(confirmWords(ph))}`,
    btn('Change', { kind: 'text', sm: true, attrs: { 'data-mr-alchange': '', 'aria-label': 'Change your number' } }));
}
// Signed in with an email: the two email choices, each saved when it is ticked (consent, stamped as given, C-4), and which
// hearings email brings, shown while hearing emails are on (B-12). Without one: the way to add it.
function email() {
  const mail = mailOf();
  if (!mail) return way('mail', 'Email: not added', 'Get alerts by email too, and keep your profile on any phone.', `<a class="btn text sm" href="#/signin">Add your email</a>`);
  const p = acct()?.prefs || {}, on = p.hearing_alerts === true || p.action_alerts === true, iss = followedIssues().length;
  return `${way('mail', `Email to <span class="mr-break">${esc(mail)}</span>`, on ? `On. ${esc(first(EMAIL_FINE))}` : 'Off', '')}
    <fieldset class="mr-set ya-em"><legend class="sr">Emails to ${esc(mail)}</legend>
      ${CHOICES.map(([k, key, t2, h]) => check(`ya-em-${k}`, key === 'hearing_alerts' && iss ? EMAIL_ALERTS : t2, h, p[key] === true, ` data-ya-em="${key}"`)).join('')}
      ${iss ? `<fieldset class="mr-set ya-elv" id="ya-elv"${p.hearing_alerts === true ? '' : ' hidden'}><legend>Hearing emails</legend>
        ${[['same', EMAIL_SAME], ['every', EMAIL_EVERY]].map(([v, l]) => `<label class="check mr-check" for="ya-elv-${v}"><input type="radio" name="ya-elv" id="ya-elv-${v}" value="${v}"${(p.email_level === 'every') === (v === 'every') ? ' checked' : ''}><span class="mr-ctext"><span class="mr-ctitle">${esc(l)}</span></span></label>`).join('')}</fieldset>` : ''}
      <p class="small muted">Every email has a one-click unsubscribe.</p><p class="small ya-emst" id="ya-emst" role="status"></p></fieldset>`;
}
// How much each followed issue sends (R-299): the issue page's switch, once per issue, saved as it moves (alerts.js
// wireLevels says "Saved." on the issue it changed, under that switch only, so the list stays short).
function levels() {
  const iss = followedIssues();
  if (!iss.length) return recSec('ya-lv-t', 'How much each issue sends', `<p class="ya-none">You don’t follow any issues yet, so there is nothing to send. <a href="#/find">Find issues to follow</a></p>`);
  return recSec('ya-lv-t', 'How much each issue sends', `<ul class="ya-lvs" role="list">${iss.map((i, n) => `<li class="ya-lv" data-lvl-issue="${esc(i.id)}" data-lvl-via="profile">
      <p class="ya-lvn" id="ya-lv-${n}-n">${esc(i.name)}</p>${levelSwitch(levelOf(i.id), { name: `ya-lv-${n}`, a: `aria-labelledby="ya-lv-${n}-n" aria-describedby="ya-lv-h"` })}
      <p class="lvl-hint ya-lvx"></p><span class="sr" role="status"></span></li>`).join('')}</ul>`,
    { note: `${LEVEL_WORDS.every}: never more than one a day. ${LEVEL_WORDS.big}: usually a few a month. ${LEVEL_WORDS.app}: no texts or emails.` })
    .replace('<p class="rc-note">', '<p class="rc-note" id="ya-lv-h">');
}
// "Asks from HIPHI's partners" (R-328 batch G): only for an account with an email, as partner asks come only by email. The
// choices are this page's radios (the hearing emails' style), each with its one line; the partners stopped from an email's
// link follow, once my_partner_asks answers (a moment after the page). Left out of the moment right after a number is saved
// (R-229: no extra boxes then), and for everyone without an account (B-12).
function partnerAsks() {
  const u = acct(); if (!u || !mailOf() || A.justOn) return '';
  const p = u.prefs || {}, lvl = askLevel(p), on = p.action_alerts === true, stopped = partnerAsksNow()?.stopped || [];
  const choices = `<fieldset class="mr-set ya-pa" id="ya-pa"${on ? '' : ' hidden'}><legend class="sr">How many asks from HIPHI’s partners</legend>
      ${ASK_LEVELS.map(v => `<label class="check mr-check" for="ya-pa-${v}"><input type="radio" name="ya-pa" id="ya-pa-${v}" value="${v}"${lvl === v ? ' checked' : ''}><span class="mr-ctext"><span class="mr-ctitle">${esc(ASK_WORDS[v][0])}</span><span class="mr-chelp">${esc(ASK_WORDS[v][1])}</span></span></label>`).join('')}</fieldset>
    <p class="ya-none ya-paoff" id="ya-paoff"${on ? ' hidden' : ''}>Partner asks come with HIPHI’s updates by email, and those are off for you now.</p>
    <p class="small ya-emst" id="ya-past" role="status"></p>`;
  const stops = stopped.length ? `<div class="ya-pastop"><p>You stopped asks from:</p><ul class="ya-pastops" role="list">${stopped.map(s => `<li><span class="ya-paname">${esc(s.name)}</span>
      ${btn('Start again', { kind: 'text', sm: true, attrs: { 'data-ya-pastart': s.slug, 'data-name': s.name, 'aria-label': `Start asks from ${s.name} again` } })}</li>`).join('')}</ul></div>` : '';
  return recSec('ya-pa-t', 'Asks from HIPHI’s partners', choices + stops, { note: 'Groups HIPHI works with may ask you to speak up on bills you follow. HIPHI’s own asks come first.' });
}
// Stop texts to any number, from any browser (D1-3): the fold today's page has under a saved number, back at the foot of Your
// alerts (R-303: it was drawn only without a profile, so a person with one could not stop another number). Closed and quiet; its
// button is outlined, as Your alerts has no filled button (the page's one action is each switch), and it is left out of the
// moment right after saving (R-229: no extra boxes then).
// Its words here (fresh-eyes review, 19 Oct): with a number saved, the summary says it is for another phone, so it cannot be
// mistaken for "Stop texts to this phone" above it, and the one explanation (said once, here) reads "on every device". Each
// swap is a plain string replace on more.js's markup; one that no longer matches leaves today's words, never a broken box.
const stopNum = (t = textSaved()) => {
  let h = stopNumberBox().replace('class="btn primary" id="mr-sn-go"', 'class="btn secondary" id="mr-sn-go"')
    .replace('Texts to this number end for good, from every browser.', 'Texts to the number you type here end for good, on every device.');
  if (t) h = h.replace('<span>Stop texts to a number</span>', '<span>Not your phone? Stop texts to another number</span>');
  return h;
};
export function yoursView() {
  const t = textSaved(), st = alertStatus({ fmt: masked });
  // Right after a number is saved (R-229): one way on first, then the settings it can change.
  const just = A.justOn ? `<div class="ya-just"><p class="okmsg" role="status">${icon('circle-check')}<span>${esc(st.text === 'on' ? `Text alerts are on for ${masked(t.phone)}.` : t ? almostLine(masked(t.phone)) : st.line)}</span></p>
      ${followsAnything() ? '' : '<p>You don’t follow any issues yet, so there is nothing to text you about. Pick a few and we’ll text you when your voice matters most on them.</p>'}
      <div class="btnrow">${btn(nextStep().label, { icon: nextStep().icon, href: nextStep().href, attrs: { 'data-mr-alnext': '' } })}</div></div>` : '';
  return `<div class="mr mr-alerts rc yu ya">
    ${backFrom('#/more', 'You')}
    <header class="rc-head"><h1 class="rc-h1" id="mr-al-t" tabindex="-1">Your alerts</h1><p class="rc-lede">${esc(ALERT_PROMISE)}</p></header>
    ${just}
    <section class="rc-card ya-ways" aria-label="Where alerts go">${texts()}${email()}</section>
    ${levels()}
    ${partnerAsks()}
    ${t || !A.justOn ? `<div class="ya-end">
      ${t ? `<div class="ya-foot"><p class="small">Reply STOP to any text to end them.${DEMO ? ' This is the sandbox, so nothing is sent.' : ''}</p>${btn('Stop texts to this phone', { kind: 'text', sm: true, attrs: { 'data-mr-alstop': '' } })}</div>` : ''}
      ${A.justOn ? '' : stopNum()}</div>` : ''}
  </div>`;
}
// The sign-up box, with a back row and the live promise (t5/e3): no profile yet, a number being added or changed, the code.
export function signupView() {
  const t = textSaved();
  if (t || myEmail()) S.alertMode = 'phone';
  const sent = !S.session && S.alertMode === 'email' && linkSent();
  if (sent) return `<div class="mr mr-alerts rc yu">
    ${backFrom('#/more', 'You')}
    <header class="rc-head"><h1 class="rc-h1" id="mr-al-t" tabindex="-1">Alerts almost set</h1></header>
    <section class="card mr-panel mr-alon" aria-labelledby="mr-al-t">
      <p class="strong">We sent a link to ${esc(sent)}. Tap it to turn on alerts.</p>
      <p>Then we’ll email you ${esc(GETS_WHAT)} ${esc(GETS_EMAILS)}</p>
      <p class="small">${levelsWhere(false)}</p>
      <p class="small">Can’t find it in a minute? Check your spam or promotions folder.${DEMO ? ' This is the sandbox, so nothing was sent.' : ''}</p>
      <div class="btnrow">${btn('Use a different email', { kind: 'secondary', sm: true, icon: 'pencil', attrs: { 'data-mr-alotheremail': '' } })}</div>
    </section></div>`;
  const b = alertButton('mr-al'), code = codeStep('mr-al'), editing = A.edit && hasProfile();
  const h = code ? 'Check your texts' : t ? 'Change your number' : editing ? 'Add text alerts' : 'Get alerts on your issues';
  const lede = code ? 'Type the 6-digit code from the text to turn on alerts.' : editing ? 'Your other alerts stay as they are.' : 'Hearings are posted about two days ahead. We’ll tell you in time to speak up.';
  return `<div class="mr mr-alerts rc yu">
    ${editing ? '' : backFrom('#/more', 'You')}
    ${recHead({ title: h, lede })}
    <form class="card mr-form mr-panel" id="mr-alform" novalidate>${alertFields('mr-al', { swap: !myEmail() })}
      <div class="mr-send">${submitBtn(b.label, b.icon, 'mr-al-send')}${editing ? btn('Cancel', { kind: 'text', attrs: { 'data-mr-alcancel': '' } }) : ''}</div>
    </form>
    ${hasProfile() ? '' : stopNumberBox()}
  </div>`;
}
export const recAlertsView = () => yoursNow() ? yoursView() : signupView();

// Each email choice saves when it changes: the two boxes are consent, stamped as given here (C-4), with Profile's source,
// as they were given there before; which hearings email brings is a setting inside it (R-299).
async function savePrefs(patch, consent) {
  const u = acct();
  const prefs = { ...(u.prefs || {}), ...patch, ...(consent ? { consent_at: new Date().toISOString(), consent_source: 'profile', consent_version: null } : {}) };
  if (!DEMO) { const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', u.id); if (error) throw error; }
  u.prefs = prefs; if (consent) S.consentCard = false;
  if (u !== S.user) keepSandbox();   // the practice copy's sample account: kept in the sandbox, as the partner switch's corner is
}
export function wireRecAlerts() {
  const root = $('#main .ya'); if (!root) return;
  wireLevels(root);
  // "Stop texts to a number" is wired by more.js wireAlerts (the live RPC, text_stop_number). When the number stopped was this
  // device's own, the device forgets it, so Your alerts is redrawn (or, with no other way left, the sign-up box) with the
  // fold still open and its answer kept, as today's page does with its own box.
  const sn = $('#mr-snform'), go = sn?.onsubmit;
  if (sn && go) sn.onsubmit = async e => {
    const had = textSaved(); await go(e);
    if (!had || textSaved()) return;
    const said = $('#mr-sn-msg')?.innerHTML || ''; app.render();
    const f = $('.mr-stopnum'), m = $('#mr-sn-msg'); if (f) f.open = true; if (m) m.innerHTML = said;
    $('#mr-sn-msg')?.closest('.mr-stopnum')?.querySelector('summary')?.focus();
  };
  const said = (text, bad = false) => { const el = $('#ya-emst'); if (el) el.innerHTML = bad ? inlineErr('ya-em-err', text) : text ? `${icon('circle-check')}<span>${esc(text)}</span>` : ''; };
  root.querySelectorAll('[data-ya-em]').forEach(c => c.onchange = async () => {
    const key = c.dataset.yaEm, on = c.checked; c.disabled = true; said('');
    try { await savePrefs({ [key]: on }, true); said('Saved.'); }
    catch (e) { c.checked = !on; said(e?.plain ? e.message : friendly(e), true); }
    c.disabled = false;
    if (key === 'hearing_alerts') { const f = $('#ya-elv'); if (f) f.hidden = !c.checked; }
    // Partner asks come with HIPHI's updates (R-328 G): their choices show while those are on, as hearing emails' do (B-12).
    if (key === 'action_alerts') { const f = $('#ya-pa'), off = $('#ya-paoff'), st = $('#ya-past'); if (f) f.hidden = !c.checked; if (off) off.hidden = c.checked; if (st) st.innerHTML = ''; }   // one "Saved." on the page, the box's (A-14)
  });
  root.querySelectorAll('input[name="ya-elv"]').forEach(r => r.onchange = async () => {
    if (!r.checked) return; const was = S.user?.prefs?.email_level === 'every' ? 'every' : 'same'; said('');
    try { await savePrefs({ email_level: r.value }, false); said('Saved.'); }
    catch (e) { const back = $(`#ya-elv-${was}`); if (back) back.checked = true; said(e?.plain ? e.message : friendly(e), true); }
  });
  wirePartnerAsks(root);
}
// "Asks from HIPHI's partners" (R-328 G): a choice saves the moment it is picked (set_partner_asks, the person's own account),
// says "Saved." under the choices and goes back to what it was if the database refuses; Start again with Undo (B-5).
function wirePartnerAsks(root) {
  const said = (text, bad = false) => { const el = $('#ya-past'); if (el) el.innerHTML = bad ? inlineErr('ya-pa-err', text) : text ? `${icon('circle-check')}<span>${esc(text)}</span>` : ''; };
  root.querySelectorAll('input[name="ya-pa"]').forEach(r => r.onchange = async () => {
    if (!r.checked) return; const u = acct(); if (!u) return;
    const was = askLevel(u.prefs); said('');
    try {
      const got = await setPartnerAsks(r.value);
      if (got !== r.value) throw Object.assign(new Error('That didn’t save. Sign in again, then pick it once more.'), { plain: true });
      u.prefs = { ...(u.prefs || {}), partner_asks: got }; if (u !== S.user) keepSandbox();
      said('Saved.');
    } catch (e) { const back = $(`#ya-pa-${was}`); if (back) back.checked = true; said(e?.plain ? e.message : friendly(e), true); }
  });
  root.querySelectorAll('[data-ya-pastart]').forEach(b => b.onclick = async () => {
    if (b.getAttribute('aria-busy') === 'true') return;
    const slug = b.dataset.yaPastart, name = b.dataset.name || 'this partner'; b.setAttribute('aria-busy', 'true'); said('');
    try {
      const r = await stopPartnerAsks(slug, false);
      if (!r?.ok) throw Object.assign(new Error(r?.why === 'partner' ? `${name} isn’t on the tracker now, so its asks can’t come.` : 'That didn’t go through. Sign in again and try once more.'), { plain: true });
      app.render(); const h = $('#ya-pa-t'); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }   // its button is gone: the section keeps the place
      toast(`Asks from ${name} can come again.`, { yay: true, undo: async () => { await stopPartnerAsks(slug, true); } });
    } catch (e) { b.removeAttribute('aria-busy'); said(e?.plain ? e.message : friendly(e), true); }
  });
}
