// Send (R-360 part 8): #/HB2121/send. Nate, 6 Nov: "Sending people to the Capitol is too much. We want people to stay in
// the app." So HIPHI sends the letter for them: the server function send_my_letter (backend migration 194) works out the
// recipients itself from the hearing's committee(s) (testimony: chair, vice chair and members; an email: the chair), keeps
// the letter on the account (my_letters) and, for a letter really going out, the "I did it" mark (public_actions).
// The screen: To (who gets it, in words, from the bill's own data), From (the name and town that sign it, and the email
// replies go to), the letter read-only with Edit, one small line on how it goes, and the one primary (A-3):
//  - signed out: an email box and "Email me a link to confirm it's you" (the RPC needs a confirmed email: it is the
//    Reply-To and the copy). The link comes back to this exact route (auth.js sendLink back), and the letter waits in
//    hiphi_me (write.js holdDraft), so a link opened in a new tab finds it. The practice copy: "Practice: sign in as a tester".
//  - signed in: "Send my testimony" / "Send my email". queued: marked done and counted, then Mahalo "Sent to ...".
//    held (the switch is off, or the function is not applied yet): saved on the account, NOT marked done or counted, and
//    Mahalo says it goes out when sending opens. A refusal: a plain line, the primary still there (never a dead end).
// Legal, one line: the words "HIPHI sends it for you, with a copy to your inbox. Replies come to you." and the consent the
// person gives by tapping Send (that HIPHI relays the letter in their name, to whom, and that it may become a public
// record) are for a lawyer to confirm before the switch goes on (backend docs/requests/R-360/LETTERS.md).
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { draftFor, keepDraft, holdDraft, dropHeld, isMail, loadMe } from './write.js';
import { mailSubject, stanceOf } from './letter.js';
import { countSent } from './counts.js';
import { markDone } from './done.js';
import * as au from './auth.js';
import { setOutcome } from './thanks.js';

const state = new Map();   // per bill, for this visit: { A (the account or null), busy, err, sent (the email a link went to) }
const st = B => { if (!state.has(B.id)) state.set(B.id, {}); return state.get(B.id); };
// A screen opened afresh: the account as app.js loaded it, no error or busy button left from before.
export const freshSend = (B, A) => { const s = st(B); s.A = A || null; s.busy = false; s.err = ''; };

const CH = { S: 'Senate', H: 'House' };
const theOf = l => /^(the|a) /.test(l) ? l : 'the ' + l;
// Who gets it, in words, from the data the page already has. The server decides the actual addresses (194); these words
// say what it does: testimony to the hearing's committee(s), chair, vice chair and members; an email to the chair(s).
function toWords(B) {
  if (!isMail(B)) { const h = B.hearing; return t(h.joint ? 'send.to.many' : 'send.to.one', { who: theOf(h.label) }); }
  const cs = B.committee?.chairs || [];
  if (cs.length) return cs.map(c => t('send.to.chair', { name: `${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${c.name}`,
    cmte: `the ${CH[c.chamber] ? CH[c.chamber] + ' ' : ''}${c.committee} Committee` })).join('; ');
  return t('send.to.nochair', { cmte: theOf(B.committee?.label || 'the committee') });
}

export function sendScreen(B, people) {
  const x = draftFor(B, people), s = st(B), mail = isMail(B), me = loadMe(), A = s.A;
  const who = [String(me.name || '').trim(), String(me.town || '').trim()].filter(Boolean).join(', ');
  const err = s.err ? `<p class="err" id="s-err" role="alert" tabindex="-1">${icon('circle-alert', { size: '1em' })}<span>${esc(s.err)}</span></p>` : '';
  let act;
  if (A) {
    act = `${err}<div class="cta"><button type="button" class="primary" data-send${s.busy ? ' aria-busy="true" disabled' : ''}>${icon('send')}<span>${esc(s.busy ? t('send.going') : t(mail ? 'send.go.email' : 'send.go'))}</span></button></div>`;
  } else if (s.sent) {
    act = `${err}<div class="sentbox" role="status" tabindex="-1">${icon('mail', { size: '24px' })}<div><p><b>${esc(t('you.check'))}</b></p><p class="small">${esc(t('send.check.sub', { email: s.sent }))}</p></div></div>
      ${DEMO ? `<p class="info">${icon('info', { size: '1em' })}${esc(t('you.practice.note'))}</p>` : ''}
      <p class="more"><button class="text" type="button" data-other>${esc(t('you.other'))}</button></p>`;
  } else {
    act = `${err}<form data-form="confirm" novalidate><p class="small conf">${esc(t('send.confirm'))}</p>
      <div class="fld"><label for="s-email">${esc(t('send.email'))}</label><input id="s-email" type="email" autocomplete="email" inputmode="email" placeholder="name@example.com" autocapitalize="off" spellcheck="false"></div>
      <div class="cta"><button class="primary" type="submit" data-link>${icon('mail')}<span>${esc(t('send.link'))}</span></button><p class="small">${esc(t('you.nopass'))}</p></div></form>`;
  }
  return `${header(B.issue, { slim: true })}
  <main class="sheet send" id="main">
    <p class="kicker"><a href="#/${esc(B.number)}/write" class="back">${icon('arrow-left', { size: '1em' })}${esc(t('send.back'))}</a></p>
    <h1 tabindex="-1">${esc(t(mail ? 'send.h.email' : 'send.h'))}</h1>
    <dl class="tofrom">
      <div><dt>${esc(t('send.to'))}</dt><dd id="s-to">${esc(toWords(B))}</dd></div>
      <div><dt>${esc(t('send.from'))}</dt><dd id="s-from">${esc(who)}${A?.email ? ` <span class="addr">${esc(A.email)}</span>` : ''}</dd></div>
    </dl>
    <div class="lbox"><div class="lhead"><span>${esc(t(mail ? 'send.letter.email' : 'send.letter'))}</span><a href="#/${esc(B.number)}/write" class="edit" data-edit aria-label="${esc(t('send.edit.label'))}">${icon('pencil', { size: '1em' })}<span>${esc(t('send.edit'))}</span></a></div>
      <div class="letter read" id="s-letter" role="region" tabindex="0" aria-label="${esc(t(mail ? 'send.letter.email' : 'send.letter'))}">${esc(x.letter)}</div></div>
    <p class="note">${esc(t('send.how'))}</p>
    ${act}
    ${DEMO && !A && !s.sent ? `<p class="more"><button class="secondary" type="button" data-practice>${esc(t('you.practice'))}</button></p>` : ''}
  </main>`;
}

// The record the app keeps for a letter (pub/letters.js keepLetter's shape, so the full tracker and You read it), sent as
// the RPC's p.letter: the server adds its own facts (sent, status, via 'app', the hearing) and keeps it in my_letters.
function letterRec(B, x, now) {
  const mail = isMail(B), me = loadMe(), stance = stanceOf(B);
  const rec = { v: 1, bill: B.id, num: B.number, nick: B.nickname || '', yr: B.year, sent: now, draft: B.current || '', stance, ours: stance !== 'comments', pos: B.positionRaw || '',
    name: String(me.name || '').trim(), why: x.own || '', points: B.points || [], pointsText: (B.points || []).join(' '), closing: me.closing || '', letter: x.letter, edited: !!x.edited, via: 'act' };
  return mail ? { ...rec, kind: 'email', mode: 'email', key: `email|${B.committee?.code || ''}`, code: B.committee?.code || '', h: '', at: '', subject: mailSubject(B) }
    : { ...rec, h: B.hearing.id, code: B.hearing.committee, at: B.hearing.at };
}
// The letter kept on this device too (hiphi_me.letters, as letters.js keepLetter keeps it), so You lists it at once.
function keepHere(B, rec) {
  try {
    const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {};
    m.letters = { ...(m.letters || {}), [isMail(B) ? 'email:' + B.id : B.id]: rec };
    localStorage.setItem('hiphi_me', JSON.stringify(m));
  } catch { /* kept on the account all the same */ }
}

// The call's argument, exactly as send_my_letter (194) reads it: bill_id, hearing_id (testimony), committee (an email with
// no hearing: the committee the bill waits in), kind, subject (an email's; testimony's is written by the server), body (the
// whole letter: header, then body), name, town, cc, letter.
export function payload(B, x, rec) {
  const mail = isMail(B), me = loadMe();
  const p = { bill_id: B.id, kind: mail ? 'email' : 'testimony', body: x.letter, name: String(me.name || '').trim(), town: String(me.town || '').trim(), cc: true, letter: rec };
  if (mail) { p.subject = mailSubject(B); if (B.committee?.code) p.committee = B.committee.code; }
  else p.hearing_id = B.hearing.id;
  return p;
}

// The refusals the server raises, in plain words (194's codes). Anything else: try again, the button still there.
const ERR = { already_sent: 'send.err.already', too_many_today: 'send.err.today', email_not_confirmed: 'send.err.confirm' };

export function wireSend(root, B, people, go, redraw) {
  const s = st(B), main = root.querySelector('#main'); if (!main) return;
  const at = location.hash, still = () => location.hash === at;
  const errOut = text => { s.err = text; if (still()) redraw({ keepFocus: '#s-err' }); };
  main.querySelector('[data-send]')?.addEventListener('click', async () => {
    if (s.busy) return;
    const x = draftFor(B, people), body = x.letter.trim();
    // The server's own limits (letter_sends.body, 50 to 8000 characters), said before the call.
    if (body.length < 50) return errOut(t('send.err.short'));
    if (body.length > 8000) return errOut(t('send.err.long'));
    const now = new Date().toISOString(), rec = letterRec(B, x, now), mail = isMail(B);
    s.busy = true; s.err = ''; redraw({ keepFocus: '[data-send]' });
    let r;
    try { r = await au.sendLetter(payload(B, x, rec)); }
    catch (e) {
      s.busy = false;
      const code = String(e?.code || '');
      if (code === 'not_signed_in') { s.A = null; return errOut(t('send.err.signin')); }
      if (!ERR[code]) console.warn('send:', e?.message || e);
      return errOut(t(ERR[code] || 'send.err.other'));
    }
    s.busy = false;
    const status = r?.status === 'queued' ? 'queued' : 'held';
    // The count goes first: it reads whether this was the first testimony on the device, before the done mark is written.
    // A held letter has reached no one: no done mark, no count (the public counts stay honest, 053).
    if (status === 'queued') { countSent(B, mail ? 'email' : 'testimony'); markDone(B, now); }
    keepHere(B, { ...rec, via: 'app', status });
    keepDraft(B, x); dropHeld(B); setOutcome(B, status);
    // Mahalo replaces send in the history, so Back from Mahalo returns to the letter, never to a send screen (B-4).
    if (still()) location.replace(location.hash.replace(/\/send\/?$/, '') + '/thanks');
  });
  // Signed out: the link to confirm it's them, back to this route; the letter waits here meanwhile.
  const inp = main.querySelector('#s-email');
  const bad = msg => { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', 's-email-err'); inp.parentElement.querySelector('.err')?.remove();
    inp.insertAdjacentHTML('afterend', `<p class="err" id="s-email-err">${icon('circle-alert', { size: '1em' })}${esc(msg)}</p>`); inp.focus(); };
  inp?.addEventListener('input', () => { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); inp.parentElement.querySelector('.err')?.remove(); });
  main.querySelector('form[data-form="confirm"]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const b = main.querySelector('[data-link]'), v = inp.value.trim();
    if (b.disabled) return;
    if (!au.validEmail(v)) return bad(t('you.bademail'));
    const was = b.innerHTML; b.disabled = true; b.setAttribute('aria-busy', 'true'); b.textContent = t('you.sending');
    holdDraft(B, draftFor(B, people));   // the letter waits on this device (hiphi_me), for a link opened in another tab
    try { await au.sendLink(v, { back: at }); }
    catch (err) { console.warn(err); b.innerHTML = was; b.disabled = false; b.removeAttribute('aria-busy'); return bad(err?.plain ? err.message : t('you.err')); }
    s.sent = v; s.err = ''; if (still()) redraw({ keepFocus: '.sentbox' });
  });
  main.querySelector('[data-other]')?.addEventListener('click', () => { s.sent = ''; s.err = ''; redraw({ keepFocus: '#s-email' }); });
  main.querySelector('[data-practice]')?.addEventListener('click', async e => {
    e.currentTarget.disabled = true;
    try { s.A = await au.practiceSignIn(); } catch { s.A = null; }
    s.err = ''; if (still()) redraw({ keepFocus: '[data-send]' });
  });
}
