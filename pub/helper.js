// The testimony helper (redesign 9/19): a full-screen dialog that walks a first-timer from "who are you" to a letter
// sent on the Capitol website, then a real confirmation page. Three short screens instead of the old one-page form:
// the 9/18 walkthrough found Copy below the fold, name and town flagged as errors before anyone typed, a letter in a
// code font, and no word about the Capitol account, the 60-minute logout or the green box that means it worked.
// Opens over any screen with app.openHelper(billId, hearingId). The phone's Back button, Esc and the close button all
// close it. What the person writes stays in this browser (hiphi_me), so "I'll finish later" really works.
// 9/19, after Nate's review: (1) the letter follows the person. Someone whose own stance differs from HIPHI's never
// gets HIPHI's scripted letter; they get the Capitol's steps and write in their own words, and nothing is counted.
// (2) Screen 1 asks for an email the friendly way: an optional field, "we'll email you when your bills have a
// hearing". Typing it IS the consent for hearing alerts; the link goes out in the background and never blocks.
// (3) Screen 3 shows "Open the Capitol page" once, keeps "I'll finish later" in the footer where it cannot hide, and
// adds "I already sent it" for people who filed in a second window. The header says "Part 1 of 3" so it does not
// clash with the guided start's "Step 4 of 4".
import { S, DEMO, app, esc, icon, toast, friendly, spaced, posInfo, cmteLabel, cmtesOf, codesOf, dueInfo, dateLong, timeWord, roomLabel,
  hstDay, HST, anyBill, anyHearing, markDone, toggleWatch, streamOf, reduceMotion, MILESTONES, myActions, POS_WORD, didKind,
  billPath, cleanDesc, nick, agrees, myStance, sendEmailLink, validEmail, issuesOf, issueFollowed, setFollows } from './core.js';
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
// Both go through core's cleanDesc, so a drafting note ("Effective 7/1/3000. (SD1)") can never reach a letter that
// someone sends to the Legislature under their own name.
function summaryOf(b) {
  if (b.hiphi_summary) return sentence(cleanDesc(b.hiphi_summary));
  const d = cleanDesc(b.description);
  const first = ((d.match(/^.*?[.;](\s|$)/) || [d])[0] || '').trim().replace(/;$/, '.');
  return first && !/^relating to/i.test(first) ? sentence(cleanDesc(first)) : '';
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
// The letter says what the PERSON thinks (R-068, 9/27): a "Not sure yet" used to get "I strongly support". stance is
// 'support' | 'oppose' | 'comments'. When it matches HIPHI's position the letter carries HIPHI's wording and ask;
// otherwise it is theirs alone, and their reason is required, because it is the whole letter.
const sameAsHiphi = (b, stance) => (stance === 'support' && /support/.test(b.hiphi_position || '')) || (stance === 'oppose' && /oppose/.test(b.hiphi_position || ''));
function openingLine(b, n, stance) {
  const p = b.hiphi_position;
  if (sameAsHiphi(b, stance) && OPENING[p]) return `${OPENING[p]} ${n}${p === 'support_amend' ? ', with amendments' : ''}.`;
  return stance === 'support' ? `I support ${n}.` : stance === 'oppose' ? `I oppose ${n}.` : `I am writing with comments on ${n}.`;
}
function askLine(b, n, stance) {
  // "Hold" is the Capitol's word for a committee not passing a bill.
  return stance === 'oppose' ? `I respectfully ask the committee to hold ${n}.` : stance === 'support' ? `I respectfully ask the committee to pass ${n}.`
    : 'I respectfully ask the committee to consider these comments.';
}
const STANCE_WORD = { support: 'SUPPORT', oppose: 'OPPOSITION', comments: 'COMMENTS' };
// HIPHI's own position as the person's default when they have said nothing either way.
const hiphiStance = b => /oppose/.test(b.hiphi_position || '') ? 'oppose' : /support/.test(b.hiphi_position || '') ? 'support' : 'comments';
function letterFor(b, h, { name, town, why, stance = hiphiStance(b) }) {
  const n = spaced(b.bill_number), room = roomLabel(h.room), ours = sameAsHiphi(b, stance);
  const when = new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  return [
    [`Testimony in ${ours ? POS_WORD[b.hiphi_position] || 'COMMENTS' : STANCE_WORD[stance]} of ${n}`, cmteLabel(h.committee),
      `Hearing: ${when} at ${timeWord(h.scheduled_at)}${/^Room /.test(room) ? ', ' + room : ''}`].join('\n'),
    greeting(h),
    `${openingLine(b, n, stance)} My name is ${String(name).trim()} and I live in ${String(town).trim()}.`,
    billSays(b, n),
    sentence(why),
    [ours ? sentence(b.hiphi_action) : '', askLine(b, n, stance)].filter(Boolean).join(' '),
    ['Mahalo for the opportunity to testify,', String(name).trim(), String(town).trim()].join('\n'),
  ].filter(Boolean).join('\n\n');
}
const basisOf = x => JSON.stringify([x.name.trim(), x.town.trim(), x.why.trim(), x.stance || '']);

// The bill's own page on the Capitol website, where "Submit Testimony" lives.
function capitolUrl(b, h) {
  if (b.state_url) return b.state_url;
  const m = /^([A-Z]+)\s*(\d+)/.exec(String(b.bill_number || '').toUpperCase());
  const yr = b.session_year || +hstDay(h.scheduled_at).slice(0, 4);
  return m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${yr}` : 'https://capitol.hawaii.gov/';
}
// The words on the Capitol testimony form.
const formWord = stance => ({ support: 'Support', oppose: 'Oppose', comments: 'Comments' })[stance] || 'Comments';
// "Sun" for a deadline earlier this week, "today", else "Mon, Mar 9".
function pastDay(iso) {
  const d = hstDay(iso), today = hstDay(Date.now());
  if (d === today) return 'today';
  const days = Math.round((Date.parse(today + 'T12:00:00Z') - Date.parse(d + 'T12:00:00Z')) / 864e5);
  return days > 0 && days < 7 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : dateLong(iso);
}
// Milestones as [key, label]. The confirmation celebrates acts only: following and taking a stand have their own
// moments elsewhere, and a first action that is a testimony gets one chip ("First testimony"), not two for one act.
const earned = () => MILESTONES.filter(m => { try { return m[3](myActions()); } catch { return false; } }).map(m => [m[0], m[1]]);
function newMilestones(before = []) {
  const had = new Set(before.map(m => m[0])), fresh = earned().filter(([k]) => !had.has(k) && k !== 'follow' && k !== 'stance');
  return fresh.filter(([k]) => !(k === 'first' && fresh.some(([k2]) => k2 === 'testimony'))).map(m => m[1]);
}

// ---------------- the email step (Nate, 9/19) ----------------
// An optional field on screen 1, only for someone who has not added their email. The label says what it is for
// ("we'll email you when your bills have a hearing"), so typing it is the consent for hearing alerts; HIPHI's own
// action alerts stay off. The link is sent in the background when they continue: it never blocks the letter, and a
// failure is one quiet line, never a dialog. One email per address per visit, however many letters they write.
let linkSentTo = '';
const linkAlready = email => linkSentTo === email || (() => { try { return sessionStorage.getItem('hiphi_link_sent') === email; } catch { return false; } })();
function sendLink(x, { again = false } = {}) {
  const email = String(x.email || '').trim();
  if (S.session || !validEmail(email) || x.link === 'sending') return;
  if (!again && linkAlready(email)) { x.link = 'sent'; x.linkTo = email; return; }
  x.link = 'sending'; x.linkTo = email; x.linkErr = '';
  // If a retry fails while focus sits on the "check your inbox" card it replaced, focus moves to the retry button.
  const redraw = () => { if (S.helper === x && (x.screen === 'done' || x.screen === 1)) paint({ focus: x.link === 'failed' && document.activeElement?.id === 'hp-inbox' ? 'hp-relink' : undefined }); };
  Promise.resolve().then(() => sendEmailLink(email, { hearing_alerts: true })).then(r => {
    linkSentTo = email; x.link = 'sent'; x.linkDemo = !!r?.demo;
    S.nudgeSent = email;   // the email ask on other screens now says "check your inbox" instead of asking again
    redraw();
  }).catch(e => { x.link = 'failed'; x.linkErr = friendly(e); redraw(); });
}

// ---------------- state ----------------
// S.helper = { b, h, screen: 1 | 2 | 3 | 'done' | 'own', name, town, email, why, letter, edited, basis, stale, copied,
//   copyChip, copyFail, saved, away, back, busy, resumed, errs, first, before, followedNow, shareChip, scrollTop,
//   focusId, opener, link: '' | 'sending' | 'sent' | 'failed', linkTo, linkErr, linkDemo }
// screen 'own' is the short screen for someone whose stance differs from HIPHI's: the Capitol's steps, no letter.
let dlg = null;          // the live <dialog>; kept across app re-renders so typing, scroll and focus survive
// What the dialog shows from outside the helper (the email ask). When it changes under us, the dialog is re-drawn.
const outside = () => JSON.stringify([S.nudge || '', S.nudgeSent || '', !!S.session]);
let drawnWith = '';
let closing = false, afterClose = null, reopen = null;

// How to find the button that opened the helper again after the page behind has been re-drawn (every element is
// new by then): its id, else its data-* hooks, else its href. Closing gives keyboard focus back to it.
function keyOf(el) {
  if (!el || el === document.body || !el.getAttribute) return '';
  if (el.id) return '#' + CSS.escape(el.id);
  const data = [...el.attributes].filter(a => a.name.startsWith('data-') && a.value !== '');
  if (data.length) return el.tagName.toLowerCase() + data.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('');
  const href = el.getAttribute('href');
  return href ? `a[href="${CSS.escape(href)}"]` : '';
}

function open(billId, hearingId) {
  if (S.helper) return;
  const h = anyHearing(hearingId), b = h && anyBill(billId || h.bill_id);
  if (!b || !h) { toast('We couldn’t open the letter helper. Try again in a moment.', { err: true }); return; }
  const me = loadMe(), d = (me.drafts || {})[h.id];
  const x = { b, h, screen: 1, name: me.name || '', town: me.town || '', email: me.email || '',
    // A reason written for another bill would be out of place, so "why" comes back only for this bill.
    why: d ? d.why || '' : me.whyBill === b.id ? me.why || '' : '',
    letter: '', edited: false, basis: '', errs: {}, scrollTop: 0, focusId: '', link: '', opener: keyOf(document.activeElement) };
  // A link already sent to this address during this visit (from an earlier letter, or before "I'll finish later"):
  // the confirmation says where to finish instead of asking again.
  if (!S.session && validEmail(x.email) && linkAlready(x.email.trim())) { x.link = 'sent'; x.linkTo = x.email.trim(); }
  // The letter's position follows the person. HIPHI's script is for people who agree with HIPHI or have not said;
  // someone who sees the bill differently gets the Capitol's own steps and writes it their way (a saved draft of
  // HIPHI's letter is left alone, in case they change their mind).
  // R-068 (9/27): everyone gets the walkthrough, whatever they think of the bill. The letter follows their own stance;
  // someone who has not said Support or Oppose is asked first. A first-timer gets one step for the Capitol account.
  const mine = myStance(b.id);
  x.stance = mine === 'support' || mine === 'oppose' ? mine : d?.stance || null;
  x.askStance = !x.stance; x.acctStep = !me.capitolAcct;
  x.screen = x.askStance ? 'stand' : 1;
  if (d && x.stance && x.name.trim() && x.town.trim() && !didKind(b, h, 'testimony')) {
    // Pick up where they left off. Someone who left for the Capitol site and came back is ready to confirm.
    x.screen = d.screen === 3 || d.screen === 'acct' ? d.screen : 2; x.resumed = true; x.edited = !!(d.edited && d.letter);
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
    // Focus goes back to the button that opened the helper; if the page no longer has it (the card is done now),
    // to the card's own testimony button or headline, and last to the page itself, never to the top of the document.
    const id = CSS.escape(x.h.id), find = sel => { try { return sel ? document.querySelector(sel) : null; } catch { return null; } };
    const back = [find(x.opener), document.querySelector(`[data-helper="${id}"]`), document.querySelector(`#t-${id} a`), document.getElementById('main')]
      .find(el => el && el.getClientRects().length);
    back?.focus({ preventScroll: true });
    if (x.toast) toast(x.toast);
  }, 80);
}
// Back (phone button, swipe, browser) leaves the helper's history entry.
window.addEventListener('popstate', e => { if (S.helper && !e.state?.hp) closeNow(); });
// Leaving for the Capitol site and coming back is the moment to ask about the green box.
document.addEventListener('visibilitychange', () => {
  const x = S.helper; if (!x) return;
  if (document.visibilityState === 'hidden') { if (x.screen === 3) x.away = true; if (x.screen === 'acct' && x.acctNew) x.acctAway = true; saveDraft(); return; }
  if (x.screen === 'acct' && x.acctAway && !x.acctBack) { x.acctBack = true; paint(); announce('Welcome back. When your account is ready, choose I’m signed up.'); return; }
  // The inline "Open the Capitol page again" appears with the green-box button, so the whole screen is re-drawn.
  if (x.screen === 3 && x.away && !x.back && !x.busy) { x.back = true; saveDraft(); paint(); announce('Welcome back. If you saw the green box, choose I saw the green box.'); }
});
window.addEventListener('pagehide', () => { if (S.helper) { if (S.helper.screen === 3) S.helper.away = true; saveDraft(); } });

// The draft lives in hiphi_me.drafts, one per hearing, and goes away once the testimony is sent.
function saveDraft() {
  const x = S.helper; if (!x) return;
  const drafts = { ...(loadMe().drafts || {}) };
  for (const [k, v] of Object.entries(drafts)) if (!v?.at || Date.now() - Date.parse(v.at) > 45 * 864e5) delete drafts[k];
  if (x.screen === 'done') delete drafts[x.h.id];
  else if (x.screen === 2 || x.screen === 3 || x.screen === 'acct') drafts[x.h.id] = { screen: x.screen, stance: x.stance, letter: x.edited ? x.letter : '', edited: x.edited, basis: x.basis, why: x.why,
    away: !!x.away, back: !!x.back, at: new Date().toISOString() };
  saveMe({ drafts });
}

// ---------------- rendering ----------------
// The steps this person walks, in order: "Where do you stand?" only when they had not said, the Capitol account only the
// first time (R-068). "Part 2 of 4" counts these.
const seqOf = x => [x.askStance && 'stand', 1, 2, x.acctStep && 'acct', 3].filter(Boolean);
const stepNo = x => Math.max(1, seqOf(x).indexOf(x.screen) + 1);
function goTo(screen) {
  const x = S.helper; if (!x) return;
  if (screen === 2 && x.screen === 1) {
    const basis = basisOf(x);
    if (!x.edited) { x.letter = letterFor(x.b, x.h, x); x.basis = basis; x.stale = false; }
    else x.stale = basis !== x.basis;
  }
  x.screen = screen; x.resumed = false; x.copyChip = false; x.copied3 = false; x.trouble = false;
  saveDraft();
  paint({ focus: 'hp-sh', top: true });
}
const goNext = () => { const x = S.helper, s = seqOf(x); goTo(s[Math.min(s.length - 1, s.indexOf(x.screen) + 1)]); };
const goBack = () => { const x = S.helper, s = seqOf(x); const i = s.indexOf(x.screen); if (i > 0) goTo(s[i - 1]); };
function inner() {
  const x = S.helper, n = spaced(x.b.bill_number), done = x.screen === 'done', own = false, total = seqOf(x).length, step = done ? total : stepNo(x);
  // "Part 1 of 3", not "Step 1 of 3": people often arrive straight from the guided start's "Step 4 of 4". It is said
  // once for screen readers, in the screen's own heading (the dialog's name stays "Testimony on HB 1523").
  const head = done ? `<p class="hp-title">Testimony on ${esc(n)}</p>`
    : `<h2 class="hp-title" id="hp-title" tabindex="-1">Testimony on ${esc(n)}</h2><span class="hp-count" aria-hidden="true">Part ${step} of ${total}</span>`;
  const body = done ? doneScreen() : x.screen === 'stand' ? standScreen() : x.screen === 1 ? aboutScreen() : x.screen === 2 ? letterScreen() : x.screen === 'acct' ? acctScreen() : sendScreen();
  return `<div class="hp-frame">
    <header class="hp-head">${iconBtn('x', 'Close', { 'data-hp': 'close' }, 'hp-x')}${head}</header>
    <div class="hp-prog${done ? ' done' : ''}" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i + 1 < step || done ? 'on' : i + 1 === step ? 'on now' : ''}"></i>`).join('')}</div>
    <div class="hp-body" id="hp-body"><div class="hp-in">${body}</div></div>
    <div class="hp-foot">${foot()}</div>
    <p class="sr" id="hp-live" role="status" aria-live="polite"></p>
  </div>`;
}
const screenHead = (step, title) => `<h3 class="hp-h" id="hp-sh" tabindex="-1"><span class="sr">Part ${stepNo(S.helper)} of ${seqOf(S.helper).length}: </span>${title}</h3>`;
const welcomeBack = () => S.helper.resumed ? notice('ok', 'circle-check', 'Welcome back. Your letter is saved right where you left it.') : '';

// Where do you stand? Asked only of someone who had not said Support or Oppose on the bill page (R-068: the letter used
// to say "I strongly support" for a "Not sure yet"). The answer is theirs; HIPHI's position is said once, quietly.
function standScreen() {
  const x = S.helper, { b } = x, n = spaced(b.bill_number), p = posInfo(b);
  const opt = (v, label, sub = '') => `<button type="button" class="hp-choice" data-hp="stance" data-v="${v}" aria-pressed="${x.stance === v}"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</button>`;
  return `<div class="hp-top">${screenHead(1, `Where do you stand on ${esc(n)}?`)}
      <p class="hp-sub">Your testimony is yours: say what you think.${p ? ` ${esc(p.text)} it.` : ''}</p></div>
    <div class="hp-choices" role="group" aria-labelledby="hp-sh">${opt('support', 'I support it')}${opt('oppose', 'I oppose it')}${opt('comments', 'I have comments', 'Not for or against, or for it with changes')}</div>`;
}

// Screen 1: who you are. Errors show only after someone leaves a field or chooses See my letter (Guide B).
function aboutScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), p = posInfo(b), due = dueInfo(h), w = summaryOf(b), name = nick(b);
  const ctx = w && startsWithVerb(w) ? `${p ? p.text + ' ' : ''}${n}, which ${lcFirst(w)}` : p ? `${p.text} ${n}.` : '';
  const field = (f, label, ac, extra = '') => {
    const bad = x.errs[f];
    return `<div class="field"><label for="hp-${f}">${label}</label>
      <input id="hp-${f}" name="${f}" type="text" autocomplete="${ac}" autocapitalize="words" enterkeyhint="next" value="${esc(x[f])}"${bad ? ` aria-invalid="true" aria-describedby="hp-${f}-err"` : ''}${extra}>${bad ? errHTML(f) : ''}</div>`;
  };
  // The email step: only for someone who has not added their email yet. A person who is signed in already gets alerts
  // from their settings, so the field would only be noise.
  const bad = x.errs.email;
  const email = S.session ? '' : `<div class="field"><label for="hp-email">Your email <span class="hp-opt">(optional)</span></label>
      <input id="hp-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false" enterkeyhint="next" value="${esc(x.email)}"
        aria-describedby="${bad ? 'hp-email-err ' : ''}hp-email-help"${bad ? ' aria-invalid="true"' : ''}>${bad ? errHTML('email') : ''}
      <span class="help" id="hp-email-help">We’ll email you when a bill on your issues has a hearing. No password. Your email is never part of your letter.</span>
      ${x.link === 'failed' && x.linkTo === x.email.trim() ? `<span class="hp-quiet" role="status">${icon('info')}<span>We couldn’t send your link just now. We’ll try again when you continue.</span></span>` : ''}</div>`;
  return `<div class="hp-top">${screenHead(1, 'About you')}
      ${name ? `<p class="hp-nick">${esc(name)}</p>` : ''}
      ${ctx ? `<p class="hp-ctx">${esc(ctx.length > 150 ? ctx.slice(0, 148).replace(/\s\S*$/, '') + '…' : ctx)}</p>` : ''}
      ${due && !due.late ? `<p class="hp-due ${due.tone}">${icon('clock')}<span>${esc(due.text)}</span></p>` : ''}</div>
    ${due?.late ? lateBanner(h) : ''}
    ${notice('info', 'info', 'Testimony is a short letter to the committee deciding this bill. Anyone in Hawaiʻi can send one. It’s public: your name and letter are posted on the Capitol website. Share only what you’re comfortable with. You don’t have to share health details to be heard.')}
    <form id="hp-form" class="hp-form" novalidate>
      ${field('name', 'Your name', 'name')}
      ${field('town', 'Your town or island', 'address-level2')}
      ${email}
      <div class="field"><label for="hp-why">${own2() ? 'What you think, and why' : `Why it matters to you <span class="hp-opt">(optional)</span>`}</label>
        <textarea id="hp-why" name="why" rows="3" placeholder="${own2() ? 'I think… because…' : 'As a parent of two teenagers…'}" aria-describedby="hp-why-help" autocapitalize="sentences"${x.errs.why ? ' aria-invalid="true"' : ''}>${esc(x.why)}</textarea>${x.errs.why ? errHTML('why') : ''}
        <span class="help" id="hp-why-help">${own2() ? 'This is the heart of your letter. One or two sentences in your own words.' : 'One or two sentences. A personal reason carries the most weight.'}</span></div>
    </form>`;
}
const ERR = { name: 'Enter your name', town: 'Enter your town or island', email: 'Enter an email like name@example.com', why: 'Say what you think in a sentence or two' };
// The letter is the person's own (their stance differs from HIPHI's, or they have comments): their reason is the letter.
const own2 = () => { const x = S.helper; return !!x && !sameAsHiphi(x.b, x.stance || hiphiStance(x.b)); };
const HELP = { email: 'hp-email-help' };   // fields whose help text stays described while an error shows
const errHTML = f => `<span class="err" id="hp-${f}-err">${icon('triangle-alert')}${ERR[f]}</span>`;
function lateBanner(h, { email = true } = {}) {
  const t = h.testimony_deadline;
  return `<div class="notice warn hp-late">${icon('triangle-alert')}<div><p>The deadline for written testimony passed ${esc(pastDay(t))} at ${esc(timeWord(t))}. You can still send it. It will be marked late and may not be read before the vote.${email ? ' A short email to the chair is the quickest way to be heard today.' : ''}</p>
    ${email ? btn('Email the chair instead', { kind: 'text', icon: 'mail', cls: 'hp-inl', attrs: { 'data-hp': 'email' } }) : ''}</div></div>`;
}

// Screen 2: the letter, ready to copy. Lato 16px in a box that grows with the text (no inner scrolling on a phone).
function letterScreen() {
  const x = S.helper, file = `${x.b.bill_number}-testimony.txt`;
  return `<div class="hp-top">${screenHead(2, 'Your letter')}
      <p class="hp-sub" id="hp-lsub">We wrote it from your answers. Read it over and change anything you like.</p></div>
    ${welcomeBack()}
    ${x.stale ? `<div class="notice info">${icon('info')}<div><p>You changed your details after editing this letter.</p>${btn('Use my new details', { kind: 'text', icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'rewrite' } })}</div></div>` : ''}
    <textarea id="hp-letter" class="hp-letter" aria-labelledby="hp-sh" aria-describedby="hp-lsub" spellcheck="true" autocapitalize="sentences" rows="14">${esc(x.letter)}</textarea>
    ${x.copyFail ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>We couldn’t copy it for you. Your letter is selected: choose Copy, or select all of it and copy it yourself.</span></div>` : ''}
    <div class="hp-under">${btn('Copy', { kind: 'text', icon: 'copy', attrs: { 'data-hp': 'copy', id: 'hp-cp' } })}${x.copyChip ? `<span class="okmsg">${icon('check')}Copied</span>` : ''}
      <a class="btn text" href="${esc(selfMail(x))}" data-hp="selfmail">${icon('mail')}<span>Email it to myself</span></a>
      ${btn('Download as a file', { kind: 'text', icon: 'download', attrs: { 'data-hp': 'download', id: 'hp-dl' } })}
      ${x.saved ? `<span class="okmsg">${icon('check')}Saved as ${esc(file)}</span>` : ''}</div>`;
}

// A copy that survives any browser: their own mail app, addressed to nobody, the letter as the body (R-068).
const selfMail = x => `mailto:?subject=${encodeURIComponent(`My testimony on ${spaced(x.b.bill_number)}`)}&body=${encodeURIComponent(x.letter)}`;

// The Capitol account, once (R-068): the hardest part for a first-timer was one line in a list they had to remember on
// another website. Asked once per browser; "yes" is remembered (hiphi_me.capitolAcct) and the step never shows again.
function acctScreen() {
  const x = S.helper;
  if (!x.acctNew) return `<div class="hp-top">${screenHead(0, 'Your Capitol account')}
      <p class="hp-sub">Testimony is sent on the Legislature’s website, with a free account there.</p></div>
    <div class="hp-choices" role="group" aria-label="Have you sent testimony on the Capitol website before?">
      <p class="hp-q">Have you sent testimony on the Capitol website before?</p>
      <button type="button" class="hp-choice" data-hp="acct-yes"><b>Yes, I have an account</b></button>
      <button type="button" class="hp-choice" data-hp="acct-no"><b>No, this is my first time</b><span>We’ll help you make one. It takes a few minutes.</span></button></div>`;
  const steps = ['<p>Open the Capitol page. Choose <b>Submit Testimony</b>, then <b>Register</b>.</p>',
    '<p>Enter your name, your email and a new password.</p>',
    '<p>They email you a link. Open it to confirm. Check spam if it doesn’t come.</p>',
    '<p>Come back here. <b>Your letter is saved.</b></p>'];
  return `<div class="hp-top">${screenHead(0, 'Make your free Capitol account')}
      <p class="hp-sub">You need your email and a new password. You only do this once.</p></div>
    ${stepList(steps)}
    ${x.acctHelp ? `<div class="notice info">${icon('info')}<div><p><b>The email hasn’t come?</b> It can take a few minutes. Look in spam or promotions. Still nothing? The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a>.</p></div></div>` : ''}
    ${capitolNotes(true)}`;
}

// Screen 3: the Capitol's own steps, in the words its form uses (PAR "How to Submit Testimony", 2026).
// The Capitol form's first two steps are the same for everyone; the rest depends on whose words go in the box.
const CAPITOL_LOGIN = '<p>Log in, or make a free account. They email you a link to confirm. Do that first, then come back to the bill.</p>';
const pickHearing = h => `<p>Choose <b>Submit Testimony</b> and pick the hearing on <b class="hp-nw">${esc(dateLong(h.scheduled_at))}</b>.</p>`;
const formChoices = word => `<p>Choose: <b>${word}</b> · <b>Individual</b> · <b>Written testimony only</b>. Want to speak? Pick <b>In person</b> or <b>Zoom</b> instead.</p>`;
const stepList = steps => `<ol class="card hp-steps" role="list">${steps.map((s, i) => `<li><span class="hp-n">${i + 1}</span><div class="hp-stxt">${s}</div></li>`).join('')}</ol>`;
const capitolNotes = saved => `<div class="hp-notes">
    <p class="note">${icon('clock')}<span>The Capitol site logs you out after 60 minutes.${saved ? ' Your letter stays saved here.' : ''}</span></p>
    <p class="note">${icon('phone')}<span>Stuck? The Public Access Room helps for free: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a></span></p>
  </div>`;
const capitolLink = (b, h, label, o = {}) => btn(label, { iconEnd: 'external-link', href: capitolUrl(b, h), ...o, attrs: { target: '_blank', rel: 'noopener', 'data-hp': 'capitol' } });
function sendScreen() {
  const x = S.helper, { b, h } = x;
  // "Open the Capitol page" is the footer's main button, so the checklist does not repeat it (assessment, 9/19).
  // Once the footer has turned into "I saw the green box", step 1 offers the way back for a tab closed by mistake.
  const steps = [
    `<p>Log in to the Capitol website${x.acctStep ? ' with the account you just made' : ''}.</p>${x.back ? capitolLink(b, h, 'Open the Capitol page again', { kind: 'text', sm: true, cls: 'hp-inl' }) : ''}`,
    pickHearing(h), formChoices(formWord(x.stance || hiphiStance(b))),
    `<p>Paste your letter${x.saved ? ' (or upload the file)' : ''} and submit. Look for the <b>green box</b>. That means it worked.</p>
      ${x.copied3 ? `<span class="chip ok" id="hp-copy3" tabindex="-1">${icon('check')}Copied</span>` : btn('Copy my letter again', { kind: 'text', sm: true, icon: 'copy', cls: 'hp-inl', attrs: { 'data-hp': 'copy', id: 'hp-copy3' } })}`,
  ];
  const trouble = x.trouble ? `<div class="notice warn hp-trouble">${icon('life-buoy')}<div>
      <p><b>Logged out?</b> Log in again. Your letter is still here: choose Copy my letter again.</p>
      <p><b>Can’t find the hearing?</b> The Public Access Room can help: <a class="hp-tel" href="${PAR_TEL}">${PAR_SHOW}</a>.</p>
      <p><b>Past the deadline?</b> You can still send it. It will be marked late.</p></div></div>` : '';
  return `<div class="hp-top">${screenHead(3, x.back ? 'Did you see the green box?' : 'Send it at the Capitol')}
      <p class="hp-sub">${x.back ? 'The green box on the Capitol page means your testimony went through.' : 'One tap copies your letter and opens the Capitol page. Follow these steps there. We’ll be right here when you come back.'}</p></div>
    ${trouble}
    ${welcomeBack()}
    ${stepList(steps)}
    ${capitolNotes(true)}
    ${x.failMsg ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(x.failMsg)}</span></div>` : ''}`;
}

// Confirmation: the reward is what happens next, not points (plan section 1).
function doneScreen() {
  const x = S.helper, { b, h } = x, n = spaced(b.bill_number), first = x.name.trim().split(/\s+/)[0];
  const held = new Date(h.scheduled_at) < Date.now(), plural = codesOf(h.committee).length > 1;
  const when = `${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)}`;
  const next = held ? `The ${cmteLabel(h.committee)} heard it ${when}.` : `The ${cmteLabel(h.committee)} ${plural ? 'hear' : 'hears'} it ${when}.`;
  const v = streamOf(h), miles = newMilestones(x.before);
  const watch = v ? `<a class="btn text hp-watch" href="${esc(v.url)}" target="_blank" rel="noopener">${icon('play')}<span>${v.state === 'live' ? 'Watch live now' : v.state === 'after' ? 'Watch the recording' : 'Watch it live on YouTube'}</span>${icon('external-link')}</a>` : '';
  // Someone who gave their email on screen 1 has been asked already: they see where to finish, never a second ask.
  // Everyone else who is signed out gets the one email ask (plan 2.9), with its ids renamed so they never clash
  // with a copy on the page behind. A link that could not be sent is one quiet line with a way to try again.
  const gave = !S.session && x.link && x.linkTo;
  const ask = gave && x.link !== 'failed' ? `<div class="card tint hp-inbox" id="hp-inbox" tabindex="-1" role="status">${icon('mail-check')}<div>
        <p class="strong">Check your inbox at <span class="hp-break">${esc(x.linkTo)}</span> to finish</p>
        <p class="small">Open the link on this device and your issues come with you. Hearing alerts start once you do.</p>
        ${x.linkDemo || DEMO ? '<p class="small muted">This is the sandbox, so no email was sent.</p>' : ''}</div></div>`
    : gave ? `<div class="hp-linkfail"><p class="hp-quiet" role="status">${icon('info')}<span>We couldn’t send your link to <span class="hp-break">${esc(x.linkTo)}</span> just now. Your testimony is not affected.</span></p>
        ${btn('Try sending it again', { kind: 'text', sm: true, icon: 'rotate-ccw', cls: 'hp-inl', attrs: { 'data-hp': 'relink', id: 'hp-relink' } })}</div>`
    : S.nudge ? nudgeCard('action').replace(/(id|for|aria-labelledby|aria-describedby)="ng-/g, '$1="hp-ng-') : '';
  return `<div class="hp-hero">
      <div class="hp-badge" aria-hidden="true">${flower(56)}</div>
      <h2 class="hp-mahalo" id="hp-done-t" tabindex="-1">${first ? `Mahalo, ${esc(first)}!` : 'Mahalo!'}</h2>
      <p class="hp-lede">You sent testimony on ${esc(n)}. The committee reads it before they vote, and it becomes part of the public record.</p>
      ${miles.length ? `<div class="chips hp-miles" aria-label="Milestones you just earned">${miles.map(m => `<span class="chip yay">${flower(16)}${esc(m)}</span>`).join('')}</div>` : ''}
    </div>
    <section class="card hp-next" aria-labelledby="hp-next-t"><h3 id="hp-next-t">What happens next</h3>
      <p>${esc(next)} ${x.followedIssue ? `We now follow ${esc(x.followedIssue.name)} for you, so you’ll see what they decide.` : x.followedNow ? `We added ${esc(n)} to My issues, so you’ll see what they decide.` : 'We’ll show what they decide in My issues.'}</p>
      ${x.followedIssue ? btn('Don’t follow it', { kind: 'text', sm: true, cls: 'hp-inl', attrs: { 'data-hp': 'unfollow' } }) : ''}
      ${watch}</section>
    ${ask}`;
}

// The sticky footer holds the one main button of each screen. On screen 3 a second, quiet row holds the two ways out
// that used to hide below the fold or did not exist: "I already sent it" (for someone who filed in another window,
// where we never see them leave and come back) and "I'll finish later".
function foot() {
  const x = S.helper, row = (html, more = '') => `<div class="hp-footin">${html}</div>${more ? `<div class="hp-footmore">${more}</div>` : ''}`;
  const back = `<button type="button" class="btn text hp-back" data-hp="back">${icon('chevron-left')}<span>Back</span></button>`;
  const later = btn('I’ll finish later', { kind: 'text', sm: true, attrs: { 'data-hp': 'later' } });
  if (x.screen === 'stand') return row(btn('Close', { kind: 'text', cls: 'hp-back', attrs: { 'data-hp': 'close' } }));   // the three answers are the buttons
  if (x.screen === 1) return row((x.askStance ? back : '') + `<button type="submit" form="hp-form" class="btn primary full hp-main"><span>See my letter</span>${icon('arrow-right')}</button>`);
  if (x.screen === 2) return row(back + btn('Next', { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } }), later);
  if (x.screen === 'acct') return row(back + (!x.acctNew ? '' : x.acctBack ? btn('I’m signed up', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'acct-done' } })
    : capitolLink(x.b, x.h, 'Open the Capitol page', { kind: 'primary', cls: 'hp-main' })),
    (x.acctNew && x.acctBack ? btn('The email hasn’t come', { kind: 'text', sm: true, attrs: { 'data-hp': 'acct-help' } }) : '') + later);
  if (x.screen === 3) return row(back + (x.busy ? `<button type="button" class="btn primary hp-main" aria-busy="true">${icon('loader-circle')}<span>Saving…</span></button>`
    : x.back ? btn('Yes, I saw it', { kind: 'primary', icon: 'check', cls: 'hp-main', attrs: { 'data-hp': 'confirm' } })
    : btn('Copy my letter and open the Capitol page', { kind: 'primary', icon: 'copy', cls: 'hp-main', attrs: { 'data-hp': 'copyopen' } })),
    x.busy ? '' : (x.back ? btn('Something went wrong', { kind: 'text', sm: true, attrs: { 'data-hp': 'trouble' } }) : btn('I already sent it', { kind: 'text', sm: true, attrs: { 'data-hp': 'sent' } })) + later);
  return row((x.shareChip ? `<span class="chip ok hp-chip" tabindex="-1">${icon('check')}${esc(x.shareChip)}</span>` : btn('Tell a friend', { kind: 'secondary', icon: 'share-2', attrs: { 'data-hp': 'share' } }))
    + btn('Done', { kind: 'primary', cls: 'hp-main', attrs: { 'data-hp': 'done' } }));
}

// Re-draw the dialog's content in place (the dialog itself stays open, so no flash of the page behind).
function paint({ focus, top = false } = {}) {
  if (!dlg || !S.helper) return;
  const a = document.activeElement, inDlg = !!a && dlg.contains(a), act = inDlg ? a.id : '', inFoot = inDlg && !!a.closest('.hp-foot');
  const keep = dlg.querySelector('.hp-body')?.scrollTop || 0;
  dlg.setAttribute('aria-labelledby', S.helper.screen === 'done' ? 'hp-done-t' : 'hp-title');
  dlg.innerHTML = inner(); drawnWith = outside();
  const body = dlg.querySelector('.hp-body'); body.scrollTop = top ? 0 : keep; S.helper.scrollTop = body.scrollTop;
  afterPaint();
  // Focus stays where it was: the same control by id, or the footer's main button when it was in the footer.
  const f = (focus && dlg.querySelector('#' + focus)) || (act && dlg.querySelector('#' + CSS.escape(act))) || (inFoot && dlg.querySelector('.hp-foot .hp-main'));
  if (f) f.focus({ preventScroll: true });
}
function paintFoot() {
  const f = dlg?.querySelector('.hp-foot'); if (!f || !S.helper) return;
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
function toLetter() {
  const x = S.helper; if (!x || !dlg) return;
  for (const f of ['name', 'town', 'email', 'why']) { const el = dlg.querySelector('#hp-' + f); if (el) x[f] = el.value; }
  const hasEmail = !!dlg.querySelector('#hp-email'), email = x.email.trim();
  // The email is optional, so empty is fine; something typed that is not an address is worth a word, because the
  // person expects alerts that would never come.
  const bad = [...['name', 'town'].filter(f => !x[f].trim()), ...(hasEmail && email && !validEmail(email) ? ['email'] : []), ...(own2() && !x.why.trim() ? ['why'] : [])];
  ['name', 'town', ...(hasEmail ? ['email'] : []), 'why'].forEach(f => setErr(f, bad.includes(f)));
  if (bad.length) { dlg.querySelector('#hp-' + bad[0])?.focus(); return; }
  saveMe({ name: x.name.trim(), town: x.town.trim(), why: x.why, whyBill: x.b.id, ...(hasEmail ? { email } : {}) });
  if (hasEmail && email) sendLink(x);   // in the background: the letter never waits for it
  goTo(2);
}
function setErr(f, on) {
  const x = S.helper; x.errs[f] = on;
  const inp = dlg?.querySelector('#hp-' + f); if (!inp) return;
  dlg.querySelector(`#hp-${f}-err`)?.remove();
  if (on) { inp.setAttribute('aria-invalid', 'true'); inp.insertAdjacentHTML('afterend', errHTML(f)); } else inp.removeAttribute('aria-invalid');
  const desc = [on ? `hp-${f}-err` : '', HELP[f] || ''].filter(Boolean).join(' ');
  if (desc) inp.setAttribute('aria-describedby', desc); else inp.removeAttribute('aria-describedby');
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
    if (!ok) { x.failMsg = 'We couldn’t copy it for you. Go back to your letter, select all of it, then choose Copy.'; paint(); return; }
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
// One tap: copy the letter, then open the Capitol page (R-068). Both in the same tap, so the clipboard is fresh when they
// paste and the phone does not block the new tab. The copy is started, not awaited, so the tab opens inside the tap.
function copyAndOpen() {
  const x = S.helper; if (!x) return;
  const ta = dlg?.querySelector('#hp-letter'); if (ta) x.letter = ta.value;
  try { navigator.clipboard?.writeText(x.letter).catch(() => {}); } catch { /* the steps offer Copy again */ }
  window.open(capitolUrl(x.b, x.h), '_blank', 'noopener');
  x.away = true; x.copied3 = true; saveDraft(); paint();
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
  x.before = earned();   // [key, label] pairs; newMilestones() compares by key
  try { x.first = !!(await markDone(x.b.id, x.h.id, 'testimony', true, { quiet: true }))?.firstTestimony; }
  catch (e) { x.busy = false; x.failMsg = friendly(e); paint(); return; }
  // Following is how they see what the committee decides: the bill's issue, as everywhere else (R-067), with "Don't
  // follow it" on the confirmation; a bill with no issue is followed on its own. A failure must not undo the testimony.
  const iss = issuesOf(x.b)[0];
  try {
    if (iss && !issueFollowed(iss)) { if (await setFollows({ issuesOn: [iss.id] }) !== false) x.followedIssue = iss; }
    else if (!iss && !S.watch.has(x.b.id)) { await toggleWatch(x.b.id); x.followedNow = S.watch.has(x.b.id); }
  } catch { /* following is a bonus */ }
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
  if (a === 'done') { const b = S.helper.b; afterClose = () => { app.newcomerNext?.(b); }; requestClose(); }
  else if (a === 'close') requestClose();
  else if (a === 'copy') copyLetter();
  else if (a === 'next') goNext();
  else if (a === 'back') goBack();
  else if (a === 'stance') { S.helper.stance = t.dataset.v; saveDraft(); goNext(); }
  else if (a === 'acct-yes' || a === 'acct-done') { saveMe({ capitolAcct: true }); goNext(); }
  else if (a === 'acct-no') { S.helper.acctNew = true; saveDraft(); paint({ focus: 'hp-sh' }); }
  else if (a === 'acct-help') { S.helper.acctHelp = true; paint(); }
  else if (a === 'copyopen') copyAndOpen();
  else if (a === 'trouble') { S.helper.trouble = !S.helper.trouble; paint(); }
  else if (a === 'unfollow') { const x = S.helper, i = x.followedIssue; if (i) setFollows({ issuesOff: [i.id] }).then(() => { x.followedIssue = null; paint(); announce(`You no longer follow ${i.name}.`); }); }
  else if (a === 'download') download();
  // "I already sent it" counts exactly like the green-box button: same honest question, asked without the round trip.
  else if (a === 'confirm' || a === 'sent') confirmSent();
  else if (a === 'relink') { sendLink(S.helper, { again: true }); paint({ focus: 'hp-inbox' }); }
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
  } else if (t.id === 'hp-email') {
    // Remembered like the name and town, so a phone that reloads the tab brings it back. The error (shown only after
    // leaving the field or choosing See my letter) clears as soon as the address looks right, or the box is empty.
    const v = t.value.trim(); x.email = t.value; saveMe({ email: v });
    if (x.errs.email && (!v || validEmail(v))) setErr('email', false);
  } else if (t.id === 'hp-letter') {
    x.letter = t.value; x.edited = true; grow(t);
    const sm = dlg.querySelector('[data-hp="selfmail"]'); if (sm) sm.href = selfMail(x);   // the copy to themselves carries their edits
    if (x.copied || x.saved || x.copyFail) { x.copied = x.saved = x.copyFail = false; paintFoot(); dlg.querySelector('.hp-under .okmsg')?.remove(); }
  }
}
function onBlur(e) {
  const x = S.helper, id = e.target.id;
  // Not when the whole page loses focus (switching apps), only when the person moves on from the field.
  if (!x || !['hp-name', 'hp-town', 'hp-email'].includes(id) || !document.hasFocus() || !dlg?.contains(e.relatedTarget || dlg)) return;
  const v = e.target.value.trim();
  if (id === 'hp-email') { if (v && !validEmail(v)) setErr('email', true); }   // optional: empty is never an error
  else if (!v) setErr(id.slice(3), true);
}
function onKey(e) {
  if (e.key !== 'Enter' || e.isComposing) return;
  // Enter moves on to the next field instead of skipping "why".
  if (e.target.id === 'hp-name') { e.preventDefault(); dlg.querySelector('#hp-town')?.focus(); }
  else if (e.target.id === 'hp-town') { e.preventDefault(); dlg.querySelector('#hp-email, #hp-why')?.focus(); }
  else if (e.target.id === 'hp-email') { e.preventDefault(); dlg.querySelector('#hp-why')?.focus(); }
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
