// The testimony helper (redesign 9/19): a full-screen dialog that walks a first-timer from "who are you" to a letter
// sent on the Capitol website, then a real confirmation page. Three short screens instead of the old one-page form:
// the 9/18 walkthrough found Copy below the fold, name and town flagged as errors before anyone typed, a letter in a
// code font, and no word about the Capitol account, the 60-minute logout or the green box that means it worked.
// Opens over any screen with app.openHelper(billId, hearingId). The phone's Back button, Esc and the close button all
// close it. What the person writes stays in this browser (hiphi_me), so "I'll finish later" really works.
import { S, app, esc, icon, toast, friendly, spaced, posInfo, cmteLabel, cmtesOf, codesOf, dueInfo, dateLong, timeWord, roomLabel,
  hstDay, HST, anyBill, anyHearing, markDone, toggleWatch, streamOf, reduceMotion, MILESTONES, myActions, POS_WORD, didKind,
  billPath } from './core.js';
import { btn, iconBtn, notice } from './ui.js';
import { nudgeCard, wireNudge, shareText } from './actions.js';
import { flower } from './art.js';

const ME_KEY = 'hiphi_me', OPEN_KEY = 'hiphi_helper_open';
// The Legislature's Public Access Room: free help from a real person, by phone or at the Capitol.
const PAR_TEL = 'tel:+18085870478', PAR_SHOW = '(808) 587-0478';
const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode: the letter still works, it just is not remembered */ } };
// Which helper was open in this tab, so a phone that reloads the page while the person is on the Capitol site
// (iOS does this to background tabs) puts them back where they were.
const openMark = {
  get() { try { return JSON.parse(sessionStorage.getItem(OPEN_KEY) || 'null'); } catch { return null; } },
  set(v) { try { if (v) sessionStorage.setItem(OPEN_KEY, JSON.stringify(v)); else sessionStorage.removeItem(OPEN_KEY); } catch { /* ignore */ } },
};

// ---------------- the letter ----------------
// Public Access Room order (lrb.hawaii.gov/par, tips on testimony): address the chair, vice chair and members;
// position first; who you are; what the bill does; your own reason; the ask; mahalo. Short on purpose.
const sentence = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…"”)]$/.test(t) ? t + '.' : t; };
// HIPHI's plain summary; else the first sentence of the official description. Never the "Relating to" title.
function summaryOf(b) {
  if (b.hiphi_summary) return sentence(b.hiphi_summary);
  const d = String(b.description || '').replace(/\s+/g, ' ').replace(/\s*\((HD|SD|CD)\d+\)\s*$/i, '').trim();
  const first = ((d.match(/^.*?[.;](\s|$)/) || [d])[0] || '').trim().replace(/;$/, '.');
  return first && !/^relating to/i.test(first) ? sentence(first) : '';
}
// HIPHI's summaries start with a verb ("Requires free school bus passes…"), so they read on after the bill number.
const startsWithVerb = t => /^(permanently |temporarily |also )?[A-Z][a-z]+s\b/i.test(t) && !/^(this|these|the|a|an)\b/i.test(t);
const lcFirst = t => t.replace(/^([A-Z])(?=[a-z])/, m => m.toLowerCase());
const billSays = (b, n) => { const w = summaryOf(b); return !w ? '' : startsWithVerb(w) ? `${n} ${lcFirst(w)}` : `${n}: ${w}`; };

// "Keohokapu-Lee Loy" from "Sue L. Keohokapu-Lee Loy": the directory's sort_name knows where a two-word surname
// starts (P0.9: member short names come from sort_name.split(',')[0], never "Sen. III").
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ‘’'`.]/g, '')
  .replace(/,?\s+(jr|sr|ii|iii|iv)$/i, '').toLowerCase().replace(/\s+/g, ' ').trim();
function surname(full, chamber) {
  const f = norm(full); let best = '';
  for (const l of S.legislators || []) {
    if (chamber && l.chamber !== chamber) continue;
    const sn = (l.sort_name || '').split(',')[0].trim(), n = norm(sn);
    if (n && (f === n || f.endsWith(' ' + n)) && sn.length > best.length) best = sn;
  }
  return best || String(full || '').replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
}
// A joint hearing is one hearing before both committees, so the letter greets every chair and vice chair.
function greeting(h) {
  const cs = cmtesOf(h.committee), joint = codesOf(h.committee).length > 1;
  const who = [...cs.filter(c => c.chair).map(c => `Chair ${surname(c.chair, c.chamber)}`),
    ...cs.filter(c => c.vice_chair).map(c => `Vice Chair ${surname(c.vice_chair, c.chamber)}`)];
  return `Dear ${who.length ? who.join(', ') : 'Chair, Vice Chair'}, and members of the committee${joint ? 's' : ''},`;
}
const OPENING = { strongly_support: 'I strongly support', support: 'I support', support_amend: 'I support', strongly_oppose: 'I strongly oppose', oppose: 'I oppose' };
function openingLine(b, n) {
  const p = b.hiphi_position;
  return OPENING[p] ? `${OPENING[p]} ${n}${p === 'support_amend' ? ', with amendments' : ''}.` : `I am writing with comments on ${n}.`;
}
function askLine(b, n) {
  const p = b.hiphi_position || '';
  // "Hold" is the Capitol's word for a committee not passing a bill.
  return /oppose/.test(p) ? `I respectfully ask the committee to hold ${n}.` : /support/.test(p) ? `I respectfully ask the committee to pass ${n}.`
    : 'I respectfully ask the committee to consider these comments.';
}
function letterFor(b, h, { name, town, why }) {
  const n = spaced(b.bill_number), room = roomLabel(h.room);
  const when = new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return [
    [`Testimony in ${POS_WORD[b.hiphi_position] || 'COMMENTS'} of ${n}`, cmteLabel(h.committee),
      `Hearing: ${when} at ${timeWord(h.scheduled_at)}${/^Room /.test(room) ? ', ' + room : ''}`].join('\n'),
    greeting(h),
    `${openingLine(b, n)} My name is ${String(name).trim()} and I live in ${String(town).trim()}.`,
    billSays(b, n),
    sentence(why),
    [sentence(b.hiphi_action), askLine(b, n)].filter(Boolean).join(' '),
    ['Mahalo for the opportunity to testify,', String(name).trim(), String(town).trim()].join('\n'),
  ].filter(Boolean).join('\n\n');
}
const basisOf = x => JSON.stringify([x.name.trim(), x.town.trim(), x.why.trim()]);

// The bill's own page on the Capitol website, where "Submit Testimony" lives.
function capitolUrl(b, h) {
  if (b.state_url) return b.state_url;
  const m = /^([A-Z]+)\s*(\d+)/.exec(String(b.bill_number || '').toUpperCase());
  const yr = b.session_year || +hstDay(h.scheduled_at).slice(0, 4);
  return m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${yr}` : 'https://capitol.hawaii.gov/';
}
// The words on the Capitol testimony form.
const formWord = b => /oppose/.test(b.hiphi_position || '') ? 'Oppose' : /support/.test(b.hiphi_position || '') ? 'Support' : 'Comments';
// "Sun" for a deadline earlier this week, "today", else "Mon, Mar 9".
function pastDay(iso) {
  const d = hstDay(iso), today = hstDay(Date.now());
  if (d === today) return 'today';
  const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 864e5);
  return days > 0 && days < 7 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : dateLong(iso);
}
const earned = () => MILESTONES.filter(m => { try { return m[3](myActions()); } catch { return false; } }).map(m => m[1]);

// ---------------- state ----------------
// S.helper = { b, h, screen: 1 | 2 | 3 | 'done', name, town, why, letter, edited, basis, stale, copied, copyChip,
//   copyFail, saved, away, back, busy, resumed, errs, first, before, followedNow, shareChip, scrollTop, focusId }
let dlg = null;          // the live <dialog>; kept across app re-renders so typing, scroll and focus survive
// What the dialog shows from outside the helper (the email ask). When it changes under us, the dialog is re-drawn.
const outside = () => JSON.stringify([S.nudge || '', S.nudgeSent || '', !!S.session]);
let drawnWith = '';
let closing = false, afterClose = null, reopen = null;

function open(billId, hearingId) {
  if (S.helper) return;
  const h = anyHearing(hearingId), b = h && anyBill(billId || h.bill_id);
  if (!b || !h) { toast('We couldn’t open the letter helper. Try again in a moment.', { err: true }); return; }
  const me = loadMe(), d = (me.drafts || {})[h.id];
  const x = { b, h, screen: 1, name: me.name || '', town: me.town || '',
    // A reason written for another bill would be out of place, so "why" comes back only for this bill.
    why: d ? d.why || '' : me.whyBill === b.id ? me.why || '' : '',
    letter: '', edited: false, basis: '', errs: {}, scrollTop: 0, focusId: '' };
  if (d && x.name.trim() && x.town.trim() && !didKind(b, h, 'testimony')) {
    // Pick up where they left off. Someone who left for the Capitol site and came back is ready to confirm.
    x.screen = d.screen === 3 ? 3 : 2; x.resumed = true; x.edited = !!(d.edited && d.letter);
    x.letter = x.edited ? d.letter : letterFor(b, h, x); x.basis = x.edited ? d.basis || '' : basisOf(x);
    x.back = x.screen === 3 && !!(d.away || d.back);
  }
  S.helper = x;
  openMark.set({ b: b.id, h: h.id });
  // One history entry for the whole helper, so the phone's Back closes it. The entry under it keeps the scroll spot.
  try {
    history.replaceState({ ...(history.state || {}), y: window.scrollY }, '');
    if (!history.state?.hp) history.pushState({ ...(history.state || {}), hp: 1 }, '');
  } catch { /* ignore */ }
  app.render();
}
app.openHelper = open;

function requestClose() {
  if (!S.helper || closing) return;
  saveDraft();
  if (history.state?.hp) {
    closing = true; history.back();
    setTimeout(() => { if (closing && S.helper) closeNow(); }, 500);   // in case Back never reports
  } else closeNow();
}
function closeNow() {
  const x = S.helper; if (!x) return;
  closing = false; saveDraft(); openMark.set(null);
  S.helper = null; dlg = null; document.body.classList.remove('hp-lock');
  // The email ask was shown on the confirmation: one ask per visit, so Home does not repeat it (unless it was sent).
  if (x.askShown && !S.nudgeSent) S.nudge = false;
  app.render();
  // After app.js has re-rendered and restored the scroll for this history step.
  setTimeout(() => {
    const next = afterClose; afterClose = null;
    if (next) { next(); return; }
    const id = CSS.escape(x.h.id);
    (document.querySelector(`[data-helper="${id}"]`) || document.querySelector(`#t-${id} a`))?.focus({ preventScroll: true });
    if (x.toast) toast(x.toast);
  }, 80);
}
// Back (phone button, swipe, browser) leaves the helper's history entry.
window.addEventListener('popstate', e => { if (S.helper && !e.state?.hp) closeNow(); });
// Leaving for the Capitol site and coming back is the moment to ask about the green box.
document.addEventListener('visibilitychange', () => {
  const x = S.helper; if (!x) return;
  if (document.visibilityState === 'hidden') { if (x.screen === 3) x.away = true; saveDraft(); return; }
  if (x.screen === 3 && x.away && !x.back && !x.busy) { x.back = true; saveDraft(); paintFoot(); announce('Welcome back. If you saw the green box, tap I saw the green box.'); }
});
window.addEventListener('pagehide', () => { if (S.helper) { if (S.helper.screen === 3) S.helper.away = true; saveDraft(); } });

// The draft lives in hiphi_me.drafts, one per hearing, and goes away once the testimony is sent.
function saveDraft() {
  const x = S.helper; if (!x) return;
  const drafts = { ...(loadMe().drafts || {}) };
  for (const [k, v] of Object.entries(drafts)) if (!v?.at || Date.now() - Date.parse(v.at) > 45 * 864e5) delete drafts[k];
  if (x.screen === 'done') delete drafts[x.h.id];
  else if (x.screen >= 2) drafts[x.h.id] = { screen: x.screen, letter: x.edited ? x.letter : '', edited: x.edited, basis: x.basis, why: x.why,
    away: !!x.away, back: !!x.back, at: new Date().toISOString() };
  saveMe({ drafts });
}

// ---------------- rendering ----------------
function inner() {
  const x = S.helper, n = spaced(x.b.bill_number), done = x.screen === 'done', step = done ? 3 : x.screen;
  const head = done ? `<p class="hp-title">Testimony on ${esc(n)}</p>`
    : `<h2 class="hp-title" id="hp-title" tabindex="-1">Testimony on ${esc(n)}<span class="sr">, step ${step} of 3</span></h2><span class="hp-count" aria-hidden="true">${step} of 3</span>`;
  const body = done ? doneScreen() : x.screen === 1 ? aboutScreen() : x.screen === 2 ? letterScreen() : sendScreen();
  return `<div class="hp-frame">
    <header class="hp-head">${iconBtn('x', 'Close', { 'data-hp': 'close' }, 'hp-x')}${head}</header>
    <div class="hp-prog${done ? ' done' : ''}" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="hp-body" id="hp-body"><div class="hp-in">${body}</div></div>
    <div class="hp-foot"><div class="hp-footin">${foot()}</div></div>
    <p class="sr" id="hp-live" role="status" aria-live="polite"></p>
  </div>`;
}
const screenHead = (step, title) => `<h3 class="hp-h" id="hp-sh" tabindex="-1"><span class="sr">Step ${step} of 3: </span>${title}</h3>`;
const welcomeBack = () => S.helper.resumed ? notice('ok', 'circle-check', 'Welcome back. Your letter is saved right where you left it.') : '';

// Screen 1: who you are. Errors show only after someone leaves a field or taps See my letter (Guide B).
function aboutScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), p = posInfo(b), due = dueInfo(h), w = summaryOf(b);
  const ctx = w && startsWithVerb(w) ? `${p ? p.text + ' ' : ''}${n}, which ${lcFirst(w)}` : p ? `${p.text} ${n}.` : '';
  const field = (f, label, ac, extra = '') => {
    const bad = x.errs[f];
    return `<div class="field"><label for="hp-${f}">${label}</label>
      <input id="hp-${f}" name="${f}" type="text" autocomplete="${ac}" autocapitalize="words" enterkeyhint="next" value="${esc(x[f])}"${bad ? ` aria-invalid="true" aria-describedby="hp-${f}-err"` : ''}${extra}>${bad ? errHTML(f) : ''}</div>`;
  };
  return `<div class="hp-top">${screenHead(1, 'About you')}
      ${ctx ? `<p class="hp-ctx">${esc(ctx.length > 150 ? ctx.slice(0, 148).replace(/\s\S*$/, '') + '…' : ctx)}</p>` : ''}
      ${due && !due.late ? `<p class="hp-due ${due.tone}">${icon('clock')}<span>${esc(due.text)}</span></p>` : ''}</div>
    ${due?.late ? lateBanner(h) : ''}
    ${notice('info', 'info', 'Testimony is a short letter to the committee deciding this bill. Anyone in Hawaiʻi can send one. It’s public: your name and letter are posted on the Capitol website. Share only what you’re comfortable with. You don’t have to share health details to be heard.')}
    <form id="hp-form" class="hp-form" novalidate>
      ${field('name', 'Your name', 'name')}
      ${field('town', 'Your town or island', 'address-level2')}
      <div class="field"><label for="hp-why">Why it matters to you <span class="hp-opt">(optional)</span></label>
        <textarea id="hp-why" name="why" rows="3" placeholder="As a parent of two teenagers…" aria-describedby="hp-why-help" autocapitalize="sentences">${esc(x.why)}</textarea>
        <span class="help" id="hp-why-help">One or two sentences. A personal reason carries the most weight.</span></div>
    </form>`;
}
const ERR = { name: 'Enter your name', town: 'Enter your town or island' };
const errHTML = f => `<span class="err" id="hp-${f}-err">${icon('triangle-alert')}${ERR[f]}</span>`;
function lateBanner(h) {
  const t = h.testimony_deadline;
  return `<div class="notice warn hp-late">${icon('triangle-alert')}<div><p>The deadline for written testimony passed ${esc(pastDay(t))} at ${esc(timeWord(t))}. You can still send it. It will be marked late and may not be read before the vote. A short email to the chair is the quickest way to be heard today.</p>
    ${btn('Email the chair instead', { kind: 'text', icon: 'mail', cls: 'hp-inl', attrs: { 'data-hp': 'email' } })}</div></div>`;
}

// Screen 2: the letter, ready to copy. Lato 16px in a box that grows with the text (no inner scrolling on a phone).
function letterScreen() {
  const x = S.helper, file = `${x.b.bill_number}-testimony.txt`;
  return `<div class="hp-top">${screenHead(2, 'Your letter')}
      <p class="hp-sub" id="hp-lsub">We wrote it from your answers. Read it over and change anything you like.</p></div>
    ${welcomeBack()}
    ${x.stale ? `<div class="notice info">${icon('info')}<div><p>You changed your details after editing this letter.</p>${btn('Use my new details', { kind: 'text', icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'rewrite' } })}</div></div>` : ''}
    <textarea id="hp-letter" class="hp-letter" aria-labelledby="hp-sh" aria-describedby="hp-lsub" spellcheck="true" autocapitalize="sentences" rows="14">${esc(x.letter)}</textarea>
    ${x.copyFail ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>Your phone didn’t let us copy. Press and hold the letter, tap Select All, then Copy.</span></div>` : ''}
    <div class="hp-under">${btn('Download as a file', { kind: 'text', icon: 'download', attrs: { 'data-hp': 'download', id: 'hp-dl' } })}
      ${x.saved ? `<span class="okmsg">${icon('check')}Saved as ${esc(file)}</span>` : ''}</div>`;
}

// Screen 3: the Capitol's own steps, in the words its form uses (PAR "How to Submit Testimony", 2026).
function sendScreen() {
  const x = S.helper, { b, h } = x, url = capitolUrl(b, h);
  const steps = [
    `<p>Open the bill on the Capitol website.</p>${btn('Open the Capitol page', { kind: 'secondary', sm: true, iconEnd: 'external-link', href: url, attrs: { target: '_blank', rel: 'noopener', 'data-hp': 'capitol' } })}`,
    '<p>Log in, or make a free account. They email you a link to confirm. Do that first, then come back to the bill.</p>',
    `<p>Tap <b>Submit Testimony</b> and pick the hearing on <b>${esc(dateLong(h.scheduled_at))}</b>.</p>`,
    `<p>Choose: <b>${formWord(b)}</b> · <b>Individual</b> · <b>Written testimony only</b>. Want to speak? Pick <b>In person</b> or <b>Zoom</b> instead.</p>`,
    `<p>Paste your letter${x.saved ? ' (or upload the file)' : ''} and submit. Look for the <b>green box</b>. That means it worked.</p>
      ${x.copied3 ? `<span class="chip ok" id="hp-copy3" tabindex="-1">${icon('check')}Copied</span>` : btn('Copy my letter', { kind: 'text', sm: true, icon: 'copy', cls: 'hp-inl', attrs: { 'data-hp': 'copy', id: 'hp-copy3' } })}`,
  ];
  return `<div class="hp-top">${screenHead(3, 'Send it at the Capitol')}
      <p class="hp-sub">Testimony is sent on the Legislature’s website. Follow these steps there. We’ll be right here when you come back.</p></div>
    ${welcomeBack()}
    <ol class="card hp-steps" role="list">${steps.map((s, i) => `<li><span class="hp-n">${i + 1}</span><div class="hp-stxt">${s}</div></li>`).join('')}</ol>
    <div class="hp-notes">
      <p class="note">${icon('clock')}<span>The Capitol site logs you out after 60 minutes. Your letter stays saved here.</span></p>
      <p class="note">${icon('phone')}<span>Stuck? The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a></span></p>
    </div>
    ${x.failMsg ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(x.failMsg)}</span></div>` : ''}
    ${btn('I’ll finish later', { kind: 'secondary', full: true, attrs: { 'data-hp': 'later' } })}`;
}

// Confirmation: the reward is what happens next, not points (plan section 1).
function doneScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), first = x.name.trim().split(/\s+/)[0];
  const held = new Date(h.scheduled_at) < Date.now(), plural = codesOf(h.committee).length > 1;
  const when = `${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)}`;
  const next = held ? `The ${cmteLabel(h.committee)} heard it ${when}.` : `The ${cmteLabel(h.committee)} ${plural ? 'hear' : 'hears'} it ${when}.`;
  const v = streamOf(h), miles = earned().filter(m => !(x.before || []).includes(m));
  const watch = v ? `<a class="btn text hp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('play')}<span>${v.state === 'live' ? 'Watch live now' : v.state === 'after' ? 'Watch the recording' : 'Watch it live on YouTube'}</span>${icon('external-link')}</a>` : '';
  // The email ask lives here after an action (plan 2.9). Its ids are renamed so they never clash with a copy on the page behind.
  const ask = S.nudge ? nudgeCard('action').replace(/(id|for|aria-labelledby|aria-describedby)="ng-/g, '$1="hp-ng-') : '';
  return `<div class="hp-hero">
      <div class="hp-badge" aria-hidden="true">${flower(56)}</div>
      <h2 class="hp-mahalo" id="hp-done-t" tabindex="-1">${first ? `Mahalo, ${esc(first)}!` : 'Mahalo!'}</h2>
      <p class="hp-lede">Your testimony on ${esc(n)} is in. It’s now part of the public record.</p>
      ${miles.length ? `<div class="chips hp-miles" aria-label="Milestones you just earned">${miles.map(m => `<span class="chip yay">${flower(16)}${esc(m)}</span>`).join('')}</div>` : ''}
    </div>
    <section class="card hp-next" aria-labelledby="hp-next-t"><h3 id="hp-next-t">What happens next</h3>
      <p>${esc(next)} ${x.followedNow ? `We added ${esc(n)} to My bills, so you’ll see what they decide.` : 'We’ll show what they decide in My bills.'}</p>
      ${watch}</section>
    ${ask}`;
}

// The sticky footer holds the one main button of each screen.
function foot() {
  const x = S.helper;
  const back = `<button type="button" class="btn text hp-back" data-hp="back">${icon('chevron-left')}<span>Back</span></button>`;
  if (x.screen === 1) return `<button type="submit" form="hp-form" class="btn primary full hp-main"><span>See my letter</span>${icon('arrow-right')}</button>`;
  if (x.screen === 2) return back + (x.copyChip ? `<span class="chip ok hp-chip hp-main" tabindex="-1">${icon('check')}Copied</span>`
    : x.copied || x.saved || x.copyFail ? btn('Next: send it', { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } })
    : btn('Copy my letter', { kind: 'primary', icon: 'copy', cls: 'hp-main', attrs: { 'data-hp': 'copy' } }));
  if (x.screen === 3) return back + (x.busy ? `<button type="button" class="btn primary hp-main" aria-busy="true">${icon('loader-circle')}<span>Saving…</span></button>`
    : x.back ? btn('I saw the green box', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'confirm' } })
    : btn('Open the Capitol page', { kind: 'primary', iconEnd: 'external-link', cls: 'hp-main', href: capitolUrl(x.b, x.h), attrs: { target: '_blank', rel: 'noopener', 'data-hp': 'capitol' } }));
  return (x.shareChip ? `<span class="chip ok hp-chip" tabindex="-1">${icon('check')}${esc(x.shareChip)}</span>` : btn('Tell a friend', { kind: 'secondary', icon: 'share-2', attrs: { 'data-hp': 'share' } }))
    + btn('Done', { kind: 'primary', cls: 'hp-main', attrs: { 'data-hp': 'done' } });
}

// Re-draw the dialog's content in place (the dialog itself stays open, so no flash of the page behind).
function paint({ focus, top = false } = {}) {
  if (!dlg || !S.helper) return;
  const keep = dlg.querySelector('.hp-body')?.scrollTop || 0, act = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement.id : '';
  dlg.setAttribute('aria-labelledby', S.helper.screen === 'done' ? 'hp-done-t' : 'hp-title');
  dlg.innerHTML = inner(); drawnWith = outside();
  const body = dlg.querySelector('.hp-body'); body.scrollTop = top ? 0 : keep; S.helper.scrollTop = body.scrollTop;
  afterPaint();
  const f = (focus && dlg.querySelector('#' + focus)) || (act && dlg.querySelector('#' + CSS.escape(act)));
  if (f) f.focus({ preventScroll: true });
}
function paintFoot() {
  const f = dlg?.querySelector('.hp-footin'); if (!f || !S.helper) return;
  const had = f.contains(document.activeElement);
  f.innerHTML = foot();
  if (had) f.querySelector('.hp-main')?.focus({ preventScroll: true });
}
function afterPaint() {
  grow(dlg.querySelector('#hp-letter'));
  if (dlg.querySelector('.nudgecard')) wireNudge(dlg);
}
function grow(t) { if (!t) return; t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }
function announce(text) { const live = dlg?.querySelector('#hp-live'); if (!live) return; live.textContent = ''; setTimeout(() => { live.textContent = text; }, 40); }

// ---------------- behaviour ----------------
function go(n) {
  const x = S.helper; if (!x || n < 1 || n > 3) return;
  if (n === 2 && x.screen === 1) {
    const basis = basisOf(x);
    if (!x.edited) { x.letter = letterFor(x.b, x.h, x); x.basis = basis; x.stale = false; }
    else x.stale = basis !== x.basis;
  }
  x.screen = n; x.resumed = false; x.copyChip = false; x.copied3 = false;
  saveDraft();
  paint({ focus: 'hp-sh', top: true });
}
function toLetter() {
  const x = S.helper; if (!x || !dlg) return;
  for (const f of ['name', 'town', 'why']) { const el = dlg.querySelector('#hp-' + f); if (el) x[f] = el.value; }
  const miss = ['name', 'town'].filter(f => !x[f].trim());
  ['name', 'town'].forEach(f => setErr(f, miss.includes(f)));
  if (miss.length) { dlg.querySelector('#hp-' + miss[0])?.focus(); return; }
  saveMe({ name: x.name.trim(), town: x.town.trim(), why: x.why, whyBill: x.b.id });
  go(2);
}
function setErr(f, on) {
  const x = S.helper; x.errs[f] = on;
  const inp = dlg?.querySelector('#hp-' + f); if (!inp) return;
  dlg.querySelector(`#hp-${f}-err`)?.remove();
  if (on) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', `hp-${f}-err`); inp.insertAdjacentHTML('afterend', errHTML(f)); }
  else { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* older phones, or no permission: try the old way */ }
  const was = document.activeElement;
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'hp-offscreen';
    (dlg || document.body).appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); was?.focus?.({ preventScroll: true }); return ok;
  } catch { return false; }
}
async function copyLetter() {
  const x = S.helper; if (!x) return;
  const ta = dlg?.querySelector('#hp-letter'); if (ta) x.letter = ta.value;
  const ok = await copyText(x.letter);
  if (S.helper !== x) return;
  if (x.screen === 3) {
    if (!ok) { x.failMsg = 'Your phone didn’t let us copy. Go back to your letter, press and hold it, tap Select All, then Copy.'; paint(); return; }
    x.copied3 = true; x.failMsg = ''; paint(); announce('Copied');
    setTimeout(() => { if (S.helper === x && x.screen === 3) { x.copied3 = false; paint(); } }, 2000);
    return;
  }
  if (!ok) { x.copyFail = true; x.copied = false; paint(); const t = dlg.querySelector('#hp-letter'); t?.focus(); t?.select(); return; }
  x.copied = true; x.copyFail = false; x.copyChip = true;
  paint(); announce('Copied');
  // "Copied" for two seconds, then the way forward.
  setTimeout(() => { if (S.helper === x && x.copyChip) { x.copyChip = false; paintFoot(); } }, 2000);
}
function download() {
  const x = S.helper, file = `${x.b.bill_number}-testimony.txt`;
  const url = URL.createObjectURL(new Blob([x.letter.replace(/\r?\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = file; (dlg || document.body).appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  x.saved = true; paint(); announce(`Saved as ${file}`);
}
async function confirmSent() {
  const x = S.helper; if (!x || x.busy) return;
  x.busy = true; x.failMsg = ''; paintFoot();
  x.before = earned();
  try { x.first = !!(await markDone(x.b.id, x.h.id, 'testimony', true, { quiet: true }))?.firstTestimony; }
  catch (e) { x.busy = false; x.failMsg = friendly(e); paint(); return; }
  // Following the bill is how they see what the committee decides. A failure here must not undo the testimony.
  if (!S.watch.has(x.b.id)) { try { await toggleWatch(x.b.id); x.followedNow = S.watch.has(x.b.id); } catch { /* following is a bonus */ } }
  if (S.helper !== x) return;
  x.busy = false; x.screen = 'done'; saveDraft();
  paint({ focus: 'hp-done-t', top: true });
  x.askShown = !!S.nudge;
  if (x.first) requestAnimationFrame(burst);
}
// First testimony ever: 16 hibiscus burst from behind the title over 900 ms, once, never with reduce-motion.
// Inside the dialog, because a modal dialog sits above everything else on the page.
function burst() {
  if (reduceMotion() || !dlg) return;
  const t = dlg.querySelector('#hp-done-t'); if (!t) return;
  const r = t.getBoundingClientRect(), box = document.createElement('div');
  box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  box.style.left = `${Math.round(r.left + r.width / 2)}px`; box.style.top = `${Math.round(r.top + r.height / 2)}px`;
  box.innerHTML = Array.from({ length: 16 }, (_, i) => {
    const a = i / 16 * Math.PI * 2 + (i % 2) * 0.2, d = 96 + (i % 4) * 30, size = 28 + (i * 5) % 13, delay = (i % 4) * 30, off = 16 - size / 2;
    return `<span class="fl" style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d * 0.8)}px;--r:${(i % 2 ? 1 : -1) * (90 + i * 12)}deg;margin:${off}px 0 0 ${off}px;animation-delay:${delay}ms;animation-duration:${900 - delay}ms">${flower(size, i % 2 ? '#F28CA0' : 'var(--o400)')}</span>`;
  }).join('');
  dlg.appendChild(box);
  setTimeout(() => box.remove(), 1100);
}
async function tellFriend() {
  const x = S.helper, t = shareText(x.b, x.h); let how = '';
  try {
    if (navigator.share) { await navigator.share({ title: spaced(x.b.bill_number), text: t.text.replace(t.url, '').trim(), url: t.url }); how = 'Shared. Mahalo!'; }
    else { await navigator.clipboard.writeText(t.text); how = 'Link copied'; }
  } catch (e) {
    if (e?.name === 'AbortError') return;   // they closed the share sheet
    if (await copyText(t.text)) how = 'Link copied';
  }
  if (!how || S.helper !== x) return;
  // A share counts as an action (plan 7, "every action counts").
  if (!didKind(x.b, x.h, 'share')) await markDone(x.b.id, x.h.id, 'share', true, { quiet: true });
  x.shareChip = how; paint(); dlg?.querySelector('.hp-foot .hp-chip')?.focus({ preventScroll: true }); announce(how);
  setTimeout(() => { if (S.helper === x) { x.shareChip = ''; paintFoot(); } }, 2500);
}
function finishLater() { const x = S.helper; x.toast = 'Saved. Your letter will be here when you come back.'; requestClose(); }
// Late: the email composer lives in the action card, so close and open it there (or on the bill page).
function emailInstead() {
  const x = S.helper, k = `${x.b.id}|${x.h.id}`;
  afterClose = () => {
    S.compose = k; app.render();
    const el = document.getElementById('cmp-' + x.h.id);
    if (el) { el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); el.querySelector('textarea')?.focus({ preventScroll: true }); }
    else app.go(billPath(x.b));
  };
  requestClose();
}

function onClick(e) {
  const t = e.target.closest('[data-hp]'); if (!t || !S.helper) return;
  const a = t.dataset.hp;
  if (a === 'close' || a === 'done') requestClose();
  else if (a === 'copy') copyLetter();
  else if (a === 'next') go(3);
  else if (a === 'back') go(S.helper.screen - 1);
  else if (a === 'download') download();
  else if (a === 'confirm') confirmSent();
  else if (a === 'later') finishLater();
  else if (a === 'share') tellFriend();
  else if (a === 'email') emailInstead();
  else if (a === 'rewrite') { const x = S.helper; x.letter = letterFor(x.b, x.h, x); x.basis = basisOf(x); x.edited = false; x.stale = false; x.copied = x.saved = false; paint({ focus: 'hp-letter' }); }
  // 'capitol' is a plain link to the Capitol site in a new tab.
}
function onInput(e) {
  const x = S.helper, t = e.target; if (!x) return;
  if (t.id === 'hp-name' || t.id === 'hp-town' || t.id === 'hp-why') {
    const f = t.id.slice(3); x[f] = t.value;
    saveMe(f === 'why' ? { why: t.value, whyBill: x.b.id } : { [f]: t.value.trim() });
    if (x.errs[f] && t.value.trim()) setErr(f, false);
  } else if (t.id === 'hp-letter') {
    x.letter = t.value; x.edited = true; grow(t);
    if (x.copied || x.saved || x.copyFail) { x.copied = x.saved = x.copyFail = false; paintFoot(); dlg.querySelector('.hp-under .okmsg')?.remove(); }
  }
}
function onBlur(e) {
  const x = S.helper, id = e.target.id;
  // Not when the whole page loses focus (switching apps), only when the person moves on from the field.
  if (!x || (id !== 'hp-name' && id !== 'hp-town') || !document.hasFocus() || !dlg?.contains(e.relatedTarget || dlg)) return;
  if (!e.target.value.trim()) setErr(id.slice(3), true);
}
function onKey(e) {
  if (e.key !== 'Enter' || e.isComposing) return;
  // Enter moves on to the next field instead of skipping "why".
  if (e.target.id === 'hp-name') { e.preventDefault(); dlg.querySelector('#hp-town')?.focus(); }
  else if (e.target.id === 'hp-town') { e.preventDefault(); dlg.querySelector('#hp-why')?.focus(); }
}
function listen(d) {
  d.addEventListener('cancel', e => { e.preventDefault(); requestClose(); });   // Esc, and Android's Back on a modal
  d.addEventListener('close', () => { if (S.helper && d === dlg && d.isConnected && !d.open) requestClose(); });
  d.addEventListener('click', onClick);
  d.addEventListener('input', onInput);
  d.addEventListener('focusout', onBlur);
  d.addEventListener('keydown', onKey);
  d.addEventListener('submit', e => { if (e.target.id === 'hp-form') { e.preventDefault(); toLetter(); } });
  d.addEventListener('focusin', e => { if (S.helper && e.target.id) S.helper.focusId = e.target.id; });
  d.addEventListener('scroll', e => { if (S.helper && e.target.classList?.contains('hp-body')) S.helper.scrollTop = e.target.scrollTop; }, true);
}
// After a reload with the helper open, open it again once its hearing is known (the bill page may still be loading).
function tryReopen() {
  if (reopen === null) { const o = openMark.get(); reopen = o ? { ...o, until: Date.now() + 10000 } : false; }
  if (!reopen) return;
  if (Date.now() > reopen.until) { reopen = false; openMark.set(null); return; }
  if (!anyHearing(reopen.h)) return;
  const o = reopen; reopen = false;
  setTimeout(() => { if (!S.helper) open(o.b, o.h); }, 0);
}

export default {
  render() {
    const x = S.helper; if (!x) return '';
    return `<dialog class="sheet hp-dlg" id="hp-dlg" data-key="${esc(x.b.id + '|' + x.h.id)}" aria-labelledby="${x.screen === 'done' ? 'hp-done-t' : 'hp-title'}">${inner()}</dialog>`;
  },
  wire() {
    const x = S.helper;
    if (!x) { dlg = null; document.body.classList.remove('hp-lock'); tryReopen(); return; }
    const fresh = document.getElementById('hp-dlg'); if (!fresh) return;
    document.body.classList.add('hp-lock');
    if (dlg && dlg !== fresh && dlg.dataset.key === fresh.dataset.key) {
      // The page behind re-rendered: put the live dialog back so typing, scroll and focus are not lost.
      fresh.replaceWith(dlg); dlg.removeAttribute('open');
      try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
      const body = dlg.querySelector('.hp-body'); if (body) body.scrollTop = x.scrollTop || 0;
      ((x.focusId && dlg.querySelector('#' + CSS.escape(x.focusId))) || dlg.querySelector('#hp-title, #hp-done-t'))?.focus({ preventScroll: true });
      if (drawnWith !== outside()) paint();   // e.g. "Not now" on the email ask, or its "Check your inbox"
      return;
    }
    dlg = fresh; listen(dlg); drawnWith = outside();
    try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
    afterPaint();
    const first = x.resumed ? dlg.querySelector('#hp-sh') : dlg.querySelector('#hp-title');
    (first || dlg.querySelector('#hp-done-t'))?.focus({ preventScroll: true });
  },
};
