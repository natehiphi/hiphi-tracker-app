// You (R-360 part 7, #/you): the fourth tab, where a person manages their profile (Nate, 6 Nov: "people must be able to
// manage their profile").
// Signed out: one line, the email box and the one primary, "Email me a sign-in link" (C-6: then which address, that it can
// take a minute, what to do if it does not come). The practice copy sends no email; "Practice: sign in as a tester" signs in
// a fake account kept in this tab (auth.js), so the signed-in screen can be tried.
// Signed in: About you, Email, Alerts, Your issues, Your letters, Phone, then a quiet Sign out and Delete my data. Each part
// is edited where it stands, with its own quiet Save (no modal, no Save bar), and only that part is drawn again, so what is
// typed in another part is never lost (C-9). Nothing is required: no field asks for anything but the email to sign in (C-5).
// There is no primary button once signed in, on purpose (A-3 allows a screen with none): each part's Save is outlined.
//
// Legal, one line: the consent words (the email choices, the per-issue levels, the text box's t5 words) and the delete
// wording were approved for track.html (R-101 and the privacy page) and are reused here unchanged; a lawyer should confirm
// them with the rest of the list (R-149, L-03) before email or texts reach the public.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO, loadList } from './data.js';
import { tabs } from './tabs.js';
import { HST } from './words.js';
import { followed, setFollow } from './bills.js';
import * as au from './auth.js';

const TEXT_CONSENT = 't5';   // pub/alerts.js TEXT_CONSENT: the version of the words shown beside the box
// What the screen remembers for this page life: a link sent, a line to say once, the delete confirm, the letter open, the
// letters deleted (for Undo), the issues shown under Your issues (one stopped stays, so it can be followed again).
const ui = { sent: '', msg: '', err: '', del: false, open: '', gone: [], mail: false, mailMsg: '', seen: new Set(), st: {} };
addEventListener('hashchange', () => { if (!/^#\/you\/?$/.test(location.hash)) { ui.err = ''; ui.msg = ''; ui.gone = []; ui.open = ''; ui.del = false; ui.mail = false; ui.mailMsg = ''; ui.st = {}; } });

const sec = (id, h, body, cls = '') => `<section class="ysec${cls ? ' ' + cls : ''}" id="y-${id}" aria-labelledby="y-${id}-h"><h2 id="y-${id}-h" tabindex="-1">${h}</h2>${body}</section>`;
const status = id => `<p class="okmsg" id="y-${id}-st" role="status">${ui.st[id] ? esc(ui.st[id]) : ''}</p>`;
const field = (id, label, value, { type = 'text', auto = '', mode = '', ph = '', opt = false } = {}) => `<div class="fld"><label for="${id}">${esc(label)}${opt ? ` <span class="opt">${esc(t('you.optional'))}</span>` : ''}</label>
  <input id="${id}" type="${type}" value="${esc(value)}"${auto ? ` autocomplete="${auto}"` : ''}${mode ? ` inputmode="${mode}"` : ''}${ph ? ` placeholder="${esc(ph)}"` : ''} autocapitalize="${type === 'text' ? 'words' : 'off'}" spellcheck="false"></div>`;
const saveBtn = (form, label = t('you.save')) => `<button class="secondary sm" type="submit" data-save="${form}">${esc(label)}</button>`;

export const youLoading = () => `${header(null, { slim: true })}<main class="sheet you" id="main" aria-busy="true"><h1 tabindex="-1">${esc(t('you.h'))}</h1><p class="sr">${esc(t('you.loading'))}</p>
  <div class="bar h w60"></div><div class="bar w100"></div><div class="bar w80"></div><div class="bar w90"></div></main>${tabs('you')}`;
const failScreen = () => `${header(null, { slim: true })}<main class="sheet you" id="main"><h1 tabindex="-1">${esc(t('you.h'))}</h1>
  <p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(t('you.fail'))}</p><div class="cta"><button class="primary" type="button" data-act="retry">${esc(t('you.retry'))}</button></div></main>${tabs('you')}`;

// ---------------- signed out ----------------
function outScreen() {
  const msg = ui.msg ? `<p class="okmsg big" role="status">${icon('circle-check', { size: '1em' })}<span>${esc(ui.msg)}</span></p>` : '';
  const err = ui.err ? `<p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(ui.err)}</p>` : '';
  const body = ui.sent ? `<div class="sentbox" role="status">${icon('mail', { size: '24px' })}<div><p><b>${esc(t('you.check'))}</b></p><p class="small">${esc(t('you.check.sub', { email: ui.sent }))}</p></div></div>
      ${DEMO ? `<p class="info">${icon('info', { size: '1em' })}${esc(t('you.practice.note'))}</p>` : ''}
      <p class="yrow"><button class="text" type="button" data-act="again">${esc(t('you.again'))}</button><button class="text" type="button" data-act="other">${esc(t('you.other'))}</button></p>
      <p class="okmsg" id="y-again-st" role="status"></p>`
    : `<form data-form="signin" novalidate>${field('y-email', t('you.email'), '', { type: 'email', auto: 'email', mode: 'email', ph: 'name@example.com' })}
      <div class="cta"><button class="primary" type="submit" data-save="signin">${icon('mail')}<span>${esc(t('you.send'))}</span></button><p class="small">${esc(t('you.nopass'))}</p></div></form>`;
  return `${header(null, { slim: true })}<main class="sheet you" id="main">
    <h1 tabindex="-1">${esc(t('you.h'))}</h1>${msg}
    <p class="lede">${esc(t('you.lede'))}</p>${err}
    ${body}
    ${DEMO ? `<p class="more"><button class="secondary" type="button" data-act="practice">${esc(t('you.practice'))}</button></p>` : ''}
  </main>${tabs('you')}`;
}

// ---------------- signed in ----------------
const myIssues = L => L ? L.issues.filter(i => followed(i) || ui.seen.has(i.id)).sort((x, y) => x.name.localeCompare(y.name)) : [];
const followingNow = L => L ? L.issues.filter(followed) : [];

function about(A) {
  const me = au.loadMe();
  return sec('about', esc(t('you.about')), `<p class="small">${esc(t('you.about.p'))}</p>
    <form data-form="about" novalidate><div class="two">${field('y-name', t('write.name'), me.name || A.name || '', { auto: 'name' })}${field('y-town', t('write.town'), me.town || A.prefs.town || '', { auto: 'address-level2' })}</div>
    <div class="saverow">${saveBtn('about')}${status('about')}</div></form>`);
}
function email(A) {
  const change = ui.mail ? `<form data-form="mail" novalidate>${field('y-newmail', t('you.mail.new'), '', { type: 'email', auto: 'email', mode: 'email' })}
      <div class="saverow">${saveBtn('mail', t('you.mail.send'))}<button class="text" type="button" data-act="mail-cancel">${esc(t('you.mail.cancel'))}</button></div></form>` : '';
  return sec('mail', esc(t('you.mail.h')), `<p class="cur"><span class="addr">${esc(A.email)}</span>${ui.mail ? '' : `<button class="text sm" type="button" data-act="mail" aria-label="${esc(t('you.mail.change.label'))}">${esc(t('you.mail.change'))}</button>`}</p>
    ${change}${ui.mailMsg ? `<p class="okmsg" role="status">${esc(ui.mailMsg)}</p>` : `<p class="okmsg" id="y-mail-st" role="status"></p>`}`);
}
const check = (id, title, sub, on) => `<label class="chk" for="${id}"><input type="checkbox" id="${id}"${on ? ' checked' : ''}><span><b>${esc(title)}</b><span class="sub">${esc(sub)}</span></span></label>`;
function alerts(A, L) {
  const p = A.prefs || {}, any = followingNow(L).length > 0;
  return sec('alerts', esc(t('you.alerts')), `<form data-form="emails" novalidate><fieldset class="plain"><legend class="small">${esc(t('you.alerts.to', { email: A.email }))}</legend>
      ${check('y-hear', t(any ? 'choice.hearing.issues' : 'choice.hearing'), t('choice.hearing.sub'), p.hearing_alerts === true)}
      ${check('y-act', t('choice.action'), t('choice.action.sub'), p.action_alerts === true)}</fieldset>
      <p class="small">${esc(t('you.unsub'))}</p>
      <div class="saverow">${saveBtn('emails')}${status('emails')}</div></form>
    <div id="y-levels">${levels(L)}</div>`);
}
const LV = ['every', 'big', 'app'];
function levels(L) {
  const iss = followingNow(L).sort((x, y) => x.name.localeCompare(y.name)); if (!iss.length) return '';
  return `<fieldset class="plain lv"><legend>${esc(t('lv.legend'))}</legend>
    <p class="small" id="y-lv-h">${esc(t('lv.help', { every: t('lv.every'), big: t('lv.big'), app: t('lv.app') }))}</p>
    <ul class="lvl" role="list">${iss.map(i => { const v = au.levelOf(i.id);
      return `<li><label for="y-lv-${esc(i.id)}">${esc(i.name)}</label><select id="y-lv-${esc(i.id)}" data-level="${esc(i.id)}" aria-describedby="y-lv-h">${LV.map(k => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(t('lv.' + k))}</option>`).join('')}</select></li>`; }).join('')}</ul>
    ${status('lv')}</fieldset>`;
}
function issues(L) {
  if (!L) return sec('issues', esc(t('you.issues')), `<p class="small">${esc(t('you.issues.fail'))}</p>`);
  const iss = myIssues(L);
  if (!iss.length) return sec('issues', esc(t('you.issues')), `<p>${esc(t('you.issues.none'))} <a href="#/bills">${esc(t('you.issues.find'))}</a></p>`);
  return sec('issues', esc(t('you.issues')), `<div class="rows">${iss.map(i => { const on = followed(i);
    return `<div class="r yi"><span class="t"><b>${esc(i.name)}</b></span><button class="follow" type="button" data-follow="${esc(i.id)}" aria-pressed="${on}" aria-label="${esc(t(on ? 'bills.following.label' : 'bills.follow.label', { name: i.name }))}">${on ? `<span>${esc(t('bills.following'))}</span>${icon('check', { size: '16px' })}` : esc(t('bills.follow'))}</button></div>`; }).join('')}</div>
    <p class="allis"><a href="#/bills">${esc(t('you.issues.find'))}</a></p>`);
}

// The letters kept on this device (hiphi_me.letters), which the sign-in brought together with the account's (my_letters).
const slot = L => L.kind === 'email' ? 'email:' + L.bill : L.bill;
const kept = () => Object.values(au.lettersHere()).filter(L => L && L.v === 1 && typeof L.bill === 'string').map(L => ({ ...L, kind: L.kind === 'email' ? 'email' : 'testimony' }))
  .sort((x, y) => String(y.sent).localeCompare(String(x.sent)));
const spaced = n => String(n || '').replace(/^([A-Z]+)(\d+)$/, '$1 $2');
const what = L => t(L.kind === 'email' ? 'you.email.what' : 'you.letter.what');
const day = iso => { try { return new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' }); } catch { return ''; } };
const facts = L => [L.sent ? day(L.sent) : '', L.stance ? t('stance.' + L.stance) : ''].filter(x => x && !x.startsWith('stance.')).join(' · ');
function letters() {
  const Ls = kept();
  const gone = ui.gone.map(L => `<div class="gone" role="status"><p>${esc(t('you.letter.gone', { what: what(L), num: spaced(L.num) }))} ${esc(t(L.kind === 'email' ? 'you.email.stays' : 'you.letter.stays'))}</p>
    <button class="text sm" type="button" data-undo="${esc(slot(L))}">${esc(t('you.undo'))}</button></div>`).join('');
  if (!Ls.length) return sec('letters', esc(t('you.letters')), `${gone}<p class="small">${esc(t('you.letters.none'))}</p>`);
  return sec('letters', esc(t('you.letters')), `<p class="small">${esc(t('you.letters.p'))}</p>${gone}<div class="rows">${Ls.map(L => {
    const s = slot(L), open = ui.open === s, title = t(L.kind === 'email' ? 'you.email.on' : 'you.letter.on', { num: spaced(L.num) });
    return `<div class="lt"><button class="r" type="button" data-letter="${esc(s)}" aria-expanded="${open}"><span class="t"><b>${esc(title)}${L.nick ? ` <span class="rn">· ${esc(L.nick)}</span>` : ''}</b><span>${esc(facts(L))}</span></span>${icon(open ? 'chevron-down' : 'chevron-right', { size: '18px', cls: 'chev' })}</button>
      ${open ? `<div class="lread"><label class="sr" for="y-l-${esc(s)}">${esc(t('you.letter.read', { what: what(L), num: spaced(L.num) }))}</label><textarea id="y-l-${esc(s)}" class="letter" readonly>${esc(L.letter || '')}</textarea>
        <p class="yrow"><button class="text bad sm" type="button" data-del="${esc(s)}" aria-label="${esc(t('you.letter.del.label', { what: what(L), num: spaced(L.num) }))}">${icon('trash-2', { size: '1em' })}<span>${esc(t('you.letter.del'))}</span></button></p></div>` : ''}</div>`;
  }).join('')}</div>`);
}

function phone() {
  const ts = au.textSaved();
  if (ts) return sec('phone', `${esc(t('you.phone'))} <span class="opt">${esc(t('you.optional'))}</span>`, `<p>${icon('message-square', { size: '1em', cls: 'inl' })} ${esc(t('you.phone.almost', { phone: au.fmtPhone(ts.phone) }))}</p>${DEMO ? `<p class="small">${esc(t('you.phone.practice'))}</p>` : ''}${status('phone')}`);
  return sec('phone', `${esc(t('you.phone'))} <span class="opt">${esc(t('you.optional'))}</span>`, `<form data-form="phone" novalidate>${field('y-tel', t('you.phone.label'), '', { type: 'tel', auto: 'tel-national', mode: 'tel', ph: t('you.phone.ph') })}
    <p class="promise">${esc(t('you.phone.promise'))}</p><p class="small">${esc(t('you.phone.fine'))}</p>
    <div class="saverow">${saveBtn('phone', t('you.phone.save'))}${status('phone')}</div></form>`);
}
function end() {
  const confirm = ui.del ? `<div class="confirm" role="group" aria-labelledby="y-del-h"><p class="strong" id="y-del-h" tabindex="-1">${icon('triangle-alert', { size: '1em' })}<span>${esc(t('you.del.h'))}</span></p>
      <p>${esc(t('you.del.p'))}</p><p class="err" id="y-del-err" role="alert"></p>
      <div class="yrow"><button class="danger" type="button" data-act="del-yes">${icon('trash-2', { size: '18px' })}<span>${esc(t('you.del.yes'))}</span></button><button class="text" type="button" data-act="del-no">${esc(t('you.del.no'))}</button></div></div>` : '';
  return `<div class="yend" id="y-end"><p class="yrow"><button class="text" type="button" data-act="signout">${icon('log-out', { size: '1em' })}<span>${esc(t('you.signout'))}</span></button>
    ${ui.del ? '' : `<button class="text bad" type="button" data-act="del">${esc(t('you.del'))}</button>`}</p><p class="err" id="y-out-err" role="alert"></p>${confirm}</div>`;
}
function inScreen(A, L) {
  return `${header(null, { slim: true })}<main class="sheet you in" id="main">
    <h1 tabindex="-1">${esc(t('you.h'))}</h1>
    ${about(A)}${email(A)}${alerts(A, L)}${issues(L)}${letters()}${phone()}${end()}
  </main>${tabs('you')}`;
}

// ---------------- the route and its taps ----------------
// show: app.js's show(). A signed-in person's account loads first (and merges this device in, once a page life); the
// issues' names come from the Bills list, which data.js keeps.
export async function you(root, show) {
  const at = location.hash, still = () => location.hash === at;
  if (au.linkError()) ui.err = t('you.linkerr');
  let A = null, L = null;
  if (au.signedInHint()) {
    if (!au.acct()) show(youLoading());
    try { A = await au.loadAccount(); }
    catch (e) {
      if (!still()) return;
      if (e?.plain) { ui.err = e.message; A = null; }
      else { console.error(e); show(failScreen()); root.querySelector('[data-act="retry"]')?.addEventListener('click', () => you(root, show)); return; }
    }
  }
  if (A) { try { L = await loadList(); } catch { L = null; } }
  if (!still()) return;
  const draw = () => {
    show(A ? inScreen(A, L) : outScreen());
    ui.msg = ''; if (A) ui.err = '';
    wire(root, A, L, () => you(root, show));
  };
  draw();
}

const busy = (b, words) => { b.dataset.was = b.innerHTML; b.setAttribute('aria-busy', 'true'); b.disabled = true; b.textContent = words; };
const unbusy = b => { if (b.dataset.was != null) b.innerHTML = b.dataset.was; b.removeAttribute('aria-busy'); b.disabled = false; };
const sentence = e => e?.plain ? e.message : t('you.savefail');
function inlineErr(inp, msg) {
  inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', inp.id + '-err');
  inp.parentElement.querySelector('.err')?.remove();
  inp.insertAdjacentHTML('afterend', `<p class="err" id="${inp.id}-err">${icon('circle-alert', { size: '1em' })}${esc(msg)}</p>`);
  inp.focus();
}
const clearErr = inp => { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); inp.parentElement.querySelector('.err')?.remove(); };
// Say it in the part's status line (a screen reader hears it), and let "Saved." fade after a while.
function say(main, id, text) { ui.st[id] = text; const el = main.querySelector(`#y-${id}-st`); if (el) el.textContent = text;
  setTimeout(() => { if (ui.st[id] === text) { ui.st[id] = ''; const e2 = document.querySelector(`#y-${id}-st`); if (e2 && e2.textContent === text) e2.textContent = ''; } }, 4000); }

function wire(root, A, L, again) {
  const main = root.querySelector('#main'); if (!main) return;
  // One part drawn again in place, the focus put back where the person was.
  const part = (id, html, focus = '') => { const el = main.querySelector(`#y-${id}`); if (!el) return; el.outerHTML = html; if (focus) main.querySelector(focus)?.focus({ preventScroll: true }); };
  main.addEventListener('input', e => { if (e.target.matches('input[aria-invalid]')) clearErr(e.target); });
  main.addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target.dataset.form, b = e.target.querySelector('[data-save]');
    if (!f || b?.getAttribute('aria-busy')) return;
    if (f === 'signin') {
      const inp = main.querySelector('#y-email'), v = inp.value.trim();
      if (!au.validEmail(v)) { inlineErr(inp, t('you.bademail')); return; }
      busy(b, t('you.sending'));
      try { await au.sendLink(v); } catch (err) { unbusy(b); console.warn(err); inlineErr(inp, sentence(err) === t('you.savefail') ? t('you.err') : sentence(err)); return; }
      ui.sent = v; ui.err = ''; again();
      return;
    }
    if (f === 'about') {
      busy(b, t('you.saving'));
      try { await au.saveAbout({ name: main.querySelector('#y-name').value, town: main.querySelector('#y-town').value }); unbusy(b); say(main, 'about', t('you.saved')); }
      catch (err) { unbusy(b); say(main, 'about', sentence(err)); }
      return;
    }
    if (f === 'mail') {
      const inp = main.querySelector('#y-newmail'), v = inp.value.trim();
      if (!au.validEmail(v)) { inlineErr(inp, t('you.bademail')); return; }
      busy(b, t('you.sending'));
      try { const r = await au.changeEmail(v); ui.mail = false; ui.mailMsg = r.demo ? t('you.mail.practice', { email: A.email }) : t('you.mail.sent', { email: v }); part('mail', email(A), '#y-mail-h'); }
      catch (err) { unbusy(b); inlineErr(inp, sentence(err)); }
      return;
    }
    if (f === 'emails') {
      busy(b, t('you.saving'));
      try { await au.saveEmails({ hearing_alerts: main.querySelector('#y-hear').checked, action_alerts: main.querySelector('#y-act').checked }); unbusy(b); say(main, 'emails', t('you.saved')); }
      catch (err) { unbusy(b); say(main, 'emails', sentence(err)); }
      return;
    }
    if (f === 'phone') {
      const inp = main.querySelector('#y-tel');
      busy(b, t('you.saving'));
      try { await au.saveText(inp.value, TEXT_CONSENT); part('phone', phone(), '#y-phone-h'); }
      catch (err) { unbusy(b); inlineErr(inp, sentence(err)); }
    }
  });
  main.addEventListener('change', async e => {
    const s = e.target.closest('[data-level]'); if (!s) return;
    const id = s.dataset.level, was = au.levelOf(id);
    try { await au.setLevel(id, s.value); say(main, 'lv', t('you.saved')); }
    catch (err) { s.value = was; say(main, 'lv', sentence(err)); }
  });
  main.addEventListener('click', async e => {
    const el = e.target.closest('[data-act], [data-follow], [data-letter], [data-del], [data-undo]'); if (!el) return;
    const act = el.dataset.act;
    if (act === 'practice') { busy(el, t('you.saving')); await au.practiceSignIn(); ui.sent = ''; ui.err = ''; again(); return; }
    if (act === 'again') { try { await au.sendLink(ui.sent); main.querySelector('#y-again-st').textContent = t('you.sent.again'); } catch (err) { console.warn(err); main.querySelector('#y-again-st').textContent = t('you.err'); } return; }
    if (act === 'other') { ui.sent = ''; again(); requestAnimationFrame(() => document.querySelector('#y-email')?.focus()); return; }
    if (act === 'mail') { ui.mail = true; ui.mailMsg = ''; part('mail', email(A), '#y-newmail'); return; }
    if (act === 'mail-cancel') { ui.mail = false; part('mail', email(A), '[data-act="mail"]'); return; }
    if (act === 'signout') {
      busy(el, t('you.signingout'));
      try { await au.signOut(); } catch (err) { unbusy(el); main.querySelector('#y-out-err').textContent = sentence(err); return; }
      ui.msg = t('you.signedout'); ui.sent = ''; again(); return;
    }
    if (act === 'del') { ui.del = true; part('end', end(), '#y-del-h'); main.querySelector('.confirm')?.scrollIntoView({ block: 'center' }); return; }
    if (act === 'del-no') { ui.del = false; part('end', end(), '[data-act="del"]'); return; }
    if (act === 'del-yes') {
      busy(el, t('you.deleting'));
      try { await au.deleteAll(); } catch (err) { unbusy(el); main.querySelector('#y-del-err').textContent = sentence(err); return; }
      ui.del = false; ui.msg = t('you.deleted'); ui.sent = ''; ui.seen.clear(); again(); return;
    }
    if (el.dataset.follow && L) {
      const i = L.issues.find(x => x.id === el.dataset.follow); if (!i) return;
      ui.seen.add(i.id); setFollow(i, !followed(i), L);
      part('issues', issues(L), `[data-follow="${CSS.escape(i.id)}"]`);
      const lv = main.querySelector('#y-levels'); if (lv) lv.innerHTML = levels(L);
      return;
    }
    if (el.dataset.letter) { const s = el.dataset.letter; ui.open = ui.open === s ? '' : s; part('letters', letters(), `[data-letter="${CSS.escape(s)}"]`); return; }
    if (el.dataset.del) {
      const L0 = kept().find(x => slot(x) === el.dataset.del); if (!L0) return;
      await au.forgetLetter(L0.bill, L0.kind);
      ui.gone = [L0, ...ui.gone.filter(x => slot(x) !== slot(L0))]; ui.open = '';
      part('letters', letters(), `[data-undo="${CSS.escape(slot(L0))}"]`); return;
    }
    if (el.dataset.undo) {
      const L0 = ui.gone.find(x => slot(x) === el.dataset.undo); if (!L0) return;
      await au.keepLetterAgain(L0); ui.gone = ui.gone.filter(x => x !== L0);
      part('letters', letters(), `[data-letter="${CSS.escape(slot(L0))}"]`); return;
    }
  });
}
