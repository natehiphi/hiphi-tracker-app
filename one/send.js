// Send (R-360 part 2): #/HB2121/send. Nothing is sent by HIPHI: testimony goes in on the Legislature's own page, an email
// from the person's own email (pub/helper.js sendScreen and mailScreen, small).
// Testimony: "Copy my testimony", the Capitol's three steps in the words its form uses, and Open the Capitol page (which
// copies the letter again in the same tap, so the clipboard is fresh when they paste). Email: who it goes to, and the
// three ways to open a new email with everything filled in. Then "Did it go through?": Yes, I sent it records it the way
// the walkthrough does (core.js markDone, letters.js keepLetter), so the full tracker shows it as done; Not yet stays.
// Exactly one primary button at a time (A-3): the way to send until it is used, then Yes, I sent it.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { DEMO } from './data.js';
import { HST } from './words.js';
import { draftFor, keepDraft, isMail, loadMe } from './write.js';
import { mailTo, mailSubject, sendLinks, stanceOf } from './letter.js';
import { countSent } from './counts.js';
import { markDone, doneKeys } from './done.js';
import { sentToAccount } from './auth.js';
import { later } from './later.js';

const FORM_WORD = { support: 'Support', oppose: 'Oppose', comments: 'Comments' };
// A phone has its own mail app; a laptop more often reads email in a browser (helper.js onPhone). Never asked.
const onPhone = () => { try { return matchMedia('(pointer: coarse)').matches || innerWidth < 720; } catch { return false; } };
const state = new Map();   // per bill, for this visit: { away, copied, later, fail }
const st = B => { if (!state.has(B.id)) state.set(B.id, {}); return state.get(B.id); };
// A screen opened afresh (not redrawn in place) starts without a "Copied" left over from a timer the route change cancelled.
export const freshSend = B => { const s = st(B); s.copied = false; };

// Each button sits inside the step it belongs to (R-360 fix pass): testimony's step 1 holds Open the Capitol page, step 3
// starts with Copy my testimony; the email's step 1 holds the three ways to open it, step 2 the copy.
export function sendScreen(B, people) {
  const x = draftFor(B, people), s = st(B), mail = isMail(B);
  const did = `<section class="did" aria-labelledby="s-did"><h2 id="s-did" tabindex="-1">${esc(t('send.did'))}</h2>
      <p class="small">${esc(t(mail ? 'send.did.p.email' : 'send.did.p'))}</p>
      <div class="row2"><button type="button" class="${s.away ? 'primary' : 'secondary'}" data-sent>${icon('check')}<span>${esc(t('send.yes'))}</span></button>
        <button type="button" class="text" data-notyet>${esc(t('send.notyet'))}</button></div>
      ${s.later ? `<p class="okmsg" role="status">${esc(t('send.later'))}</p>` : ''}</section>`;
  const copy = `<button type="button" class="secondary" data-copy>${icon(s.copied ? 'check' : 'copy')}<span>${esc(s.copied ? t('send.copied') : t(mail ? 'send.copy.email' : 'send.copy'))}</span></button>
    ${s.fail ? `<p class="err" role="alert">${icon('circle-alert', { size: '1em' })}${esc(t('send.copyfail'))}</p><textarea class="letter sel" readonly aria-label="${esc(t('write.letter'))}">${esc(x.letter)}</textarea>` : ''}`;
  const steps = list => `<ol class="steps" role="list">${list.map((h, i) => `<li><span class="n" aria-hidden="true">${i + 1}</span><div class="sbody">${h}</div></li>`).join('')}</ol>`;
  let body;
  if (!mail) {
    const date = new Date(B.hearing.at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
    const open = `<a class="${s.away ? 'secondary' : 'primary'}" href="${esc(B.capitolUrl)}" target="_blank" rel="noopener" data-capitol><span>${esc(t('send.open'))}</span>${icon('external-link')}</a>
      ${DEMO && s.away ? `<p class="info" role="status">${icon('info', { size: '1em' })}${esc(t('send.practice'))}</p>` : ''}`;
    const s3 = x.differ ? t('send.s3.own') : t('send.s3', { word: esc(FORM_WORD[stanceOf(B)]) });
    body = `<h1 tabindex="-1">${esc(t('send.h'))}</h1>
    <p class="note">${esc(t('send.first'))}</p>
    ${steps([`<p>${t('send.s1', { date: esc(date) })}</p>${open}`, `<p>${esc(t('send.s2'))}</p>`,
      `${copy}<p class="sub">${esc(t('send.again'))}</p><p>${s3}</p>`])}`;
  } else {
    const to = mailTo(B, people), L = sendLinks(to, mailSubject(B), x.letter), order = onPhone() ? ['app', 'gmail', 'outlook'] : ['gmail', 'outlook', 'app'];
    const btn = (via, i) => { const l = L[via], main = i === 0 && !s.away;
      return `<li><a class="${main ? 'primary' : 'secondary'}" href="${esc(l.href)}" data-via="${via}"${via === 'app' ? '' : ' target="_blank" rel="noopener"'}>${icon(via === 'app' ? 'mail' : 'at-sign')}<span>${esc(t('send.' + via))}</span>${via === 'app' ? '' : icon('external-link')}</a>
        ${via === 'outlook' || l.cut ? `<p class="sub">${esc([via === 'outlook' ? t('send.outlook.sub') : '', l.cut ? t('send.long') : ''].filter(Boolean).join('. '))}</p>` : ''}</li>`; };
    body = `<h1 tabindex="-1">${esc(t('send.h.email'))}</h1>
    <p class="to"><b>${esc(t('send.to'))}:</b> ${to.map(c => `${esc(c.label)} <span class="addr">${esc(c.email)}</span>`).join(', ')}</p>
    ${steps([`<p>${esc(t('send.mail.p'))}</p><ul class="sends" role="list">${order.map(btn).join('')}</ul>`, `<p>${esc(t('send.mail.s2'))}</p>${copy}`])}`;
  }
  return `${header(B.issue, { slim: true })}
  <main class="sheet send" id="main">
    <p class="kicker"><a href="#/${esc(B.number)}/write" class="back">${icon('arrow-left', { size: '1em' })}${esc(t('send.back'))}</a></p>
    ${body}
    ${did}
  </main>`;
}

// The copy that also works on an older phone (helper.js copyText): the clipboard, else the old way with a hidden box.
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission or an older phone */ }
  const was = document.activeElement;
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'offscreen';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); was?.focus?.({ preventScroll: true }); return ok;
  } catch { return false; }
}

// Recorded as the walkthrough records it, so the full tracker knows: the done mark (core.js markDone: hiphi_done, and when
// in hiphi_done_at; the practice copy's own keys), the chair's ask mark for an email (core.js askMark), and the letter kept
// for the bill's next step (letters.js keepLetter: hiphi_me.letters, the bill's id for testimony, "email:<id>" for an email).
// A signed-in person's account learns of it at once (auth.js sentToAccount); signed out, at their next sign-in.
export function recordSent(B, x) {
  const mail = isMail(B), now = new Date().toISOString();
  markDone(B, now);
  const me = loadMe(), stance = stanceOf(B), ours = stance !== 'comments';
  const rec = { v: 1, bill: B.id, num: B.number, nick: B.nickname || '', yr: B.year, sent: now, draft: B.current || '', stance, ours, pos: B.positionRaw || '',
    name: String(me.name || '').trim(), why: x.own || '', points: B.points || [], pointsText: (B.points || []).join(' '), closing: me.closing || '', letter: x.letter, edited: !!x.edited, via: 'act' };
  const keep = mail ? { ...rec, kind: 'email', mode: 'email', key: `email|${B.committee?.code || ''}`, code: B.committee?.code || '', h: '', at: '', subject: mailSubject(B) }
    : { ...rec, h: B.hearing.id, code: B.hearing.committee, at: B.hearing.at };
  try {
    const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {};
    m.letters = { ...(m.letters || {}), [mail ? 'email:' + B.id : B.id]: keep };
    localStorage.setItem('hiphi_me', JSON.stringify(m));
  } catch { /* kept for this visit only */ }
  // Signed in (R-360 part 7): the account learns of it at once too, as the tracker records it (public_actions, my_letters).
  sentToAccount(keep, doneKeys(B), now);
}

// Every timer here goes through later() (one/later.js): it redraws only while this send screen is still the one showing,
// and app.js cancels it when the route changes (B-4, B-7).
export function wireSend(root, B, people, go, redraw) {
  const x = draftFor(B, people), s = st(B);
  root.querySelector('[data-copy]')?.addEventListener('click', async () => {
    const at = location.hash, ok = await copyText(x.letter);
    if (location.hash !== at) return;   // they went elsewhere while the copy ran
    s.copied = ok; s.fail = !ok; redraw({ keepFocus: '[data-copy]' });
    if (!ok) { const sel = root.querySelector('textarea.sel'); sel?.focus(); sel?.select(); return; }
    later(() => { if (s.copied) { s.copied = false; redraw({ keepFocus: '[data-copy]' }); } }, 2000);
  });
  // Open the Capitol page: the copy is started, not awaited, so the tab opens inside the tap. The practice copy never opens
  // the real Capitol (R-212 #1): testers would land on the real testimony form.
  root.querySelector('[data-capitol]')?.addEventListener('click', e => {
    try { navigator.clipboard?.writeText(x.letter).catch(() => {}); } catch { /* Copy my testimony is on the screen */ }
    if (DEMO) e.preventDefault();
    // Redrawn a moment later, never inside the tap, so the link still opens. The step is remembered at once, so a person
    // who comes back to this screen later still finds Yes, I sent it as the one primary.
    s.away = true;
    later(() => redraw({ keepFocus: '#s-did' }), DEMO ? 0 : 800);
  });
  root.querySelectorAll('[data-via]').forEach(a => a.addEventListener('click', () => {
    copyText(x.letter);   // the tap allows it; if the mail app opens empty or cut short, it can be pasted in
    s.away = true;
    later(() => redraw({ keepFocus: '#s-did' }), 800);
  }));
  // The count goes first: it reads whether this was the first testimony on the device, before the done mark is written.
  // Thanks replaces send in the history, so Back from Mahalo returns to the letter, never to a send screen with Yes armed (B-4).
  root.querySelector('[data-sent]')?.addEventListener('click', () => {
    countSent(B, isMail(B) ? 'email' : 'testimony'); recordSent(B, x); keepDraft(B, x); state.delete(B.id);
    location.replace(location.hash.replace(/\/send\/?$/, '') + '/thanks');
  });
  root.querySelector('[data-notyet]')?.addEventListener('click', () => { s.later = true; redraw({ keepFocus: '[data-notyet]' }); });
}
