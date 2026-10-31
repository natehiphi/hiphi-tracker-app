// Version 2's letter in three screens (R-357 Part 2; Nate, 30 Oct 2026: "Make the bold changes but keep the my issues tab. Make this a
// version 2 for the public."), behind ?v2=1 (pub/app.js V2). The evidence is the review's two walks (backend docs/requests/R-357/
// notes-newcomer-walk.md and notes-returner-walk.md): today's walkthrough asks nine things, explains the bill three times and ends in
// a Capitol step with four ways out; the mock is the review page's panel m-letter-bold.
//
// A person comes here to send a short letter about one bill, in as few taps as the Capitol allows (B-1).
//   Screen 1, "Your letter" (the sheet's title names the bill): where they stand as one line ("Your letter supports it · change", HIPHI's
//     side chosen: a recommendation that is on screen, one tap to change, and nothing is sent unseen, B-12), the one-line hint, then the
//     letter, already written from HIPHI's talking points, in today's format. Each point is a line to tap to keep or leave out (a check
//     or a plus in the same slot, so the words never move); "Add a line of your own (optional)" and the name (the profile's, else a box
//     that must be filled) are in the letter itself. One filled button that says what is next: "Next: your Capitol account" when that
//     screen follows, else "Next: send it" ("Next: send your email").
//   Screen 2, the Capitol account, the first time only: the honest words, today's two choices, the Public Access Room's number, and the
//     plain way out, "Email the chair instead · 2 min, no account".
//   Screen 3, send: one button, "Copy and open the Capitol page", then one question, "Did it go through?" (Yes records the act as "I
//     already sent it" did; Not yet keeps the letter, as "I'll finish later" does). An email has two screens: the letter, then today's
//     send step (mail app, Gmail, Outlook, copy each part) and today's "Did you send it?".
// "I'll finish later" and Back are on every screen. What About you used to ask (title, email, why it matters, keep my story, the quote
// question, the sign-off chips) is not asked in the letter (C-5), and each has its place after it (R-357 part A): the profile ask under
// the Mahalo (email), the story card under it with the quote question after a first story (pub/helper.js), a later visit's page for the
// title (pub/nextask.js), and the sign-off here, as a tap on the closing word of the letter (signoff below) and on the profile page.
//
// Everything that writes, keeps or sends the letter is pub/helper.js's (this file reaches it through HP): the same pieces of the
// letter, the same drafts, the same Capitol and mail code, the same Mahalo. helper.js calls V2.open for a new letter when ?v2=1 (so
// every "Help me write testimony" button, Home's "Finish sending your testimony" among them, opens this sheet), and V2.seq, body, foot,
// click and input for the frame. v1's six parts are untouched without the flag.
import { S, DEMO, app, esc, icon, toast, spaced, agrees, myStance, setStance, anyBill, anyHearing, didKind, dueInfo, hearingsOf, openActions, myActions } from '../core.js';
import { btn } from '../ui.js';
import { sentence, closingOf } from '../hello.js';
import { myName, myTitles, storyFor, storyAsk, saveProfile } from '../myprofile.js';
import { readyLetter } from '../letters.js';
import { HP, V2 } from '../helper.js';

const isEmail = x => x.mode === 'email';
const sideOf = x => x.stance || HP.hiphiStance(x.b);
const strongly = b => /^strongly_/.test(b.hiphi_position || '');
// HIPHI's first two points start kept (the review's mock: two of three), so the letter is short and every other point is a plus away.
const firstTwo = x => HP.pointGroups(x).hiphi.slice(0, 2);
const needsOwn = x => HP.own2For(x.b, sideOf(x));   // a stance HIPHI's points cannot argue: their own words are the letter
const dlg = () => HP.dlg;

// ---------------- the way in ----------------
// kind: 'testimony' | 'email'. o: { bill, hearing, friend, chair, force }. true when this sheet opened (or one is open already), false
// when version 2 does not take it: the flag is off, the bill or hearing is missing, or a draft from the older walkthrough is waiting
// (it finishes there), so helper.js carries on as before.
V2.open = (kind, o = {}) => {
  if (!o.force && !app.v2?.()) return false;
  if (S.helper) return true;
  const email = kind === 'email';
  if (email && ((o.mode && o.mode !== 'email') || !o.hearing || o.remind)) return false;   // asking a chair for a hearing, the reminder, an email to legislators: the older steps
  const h = anyHearing(o.hearing), b = anyBill(o.bill || h?.bill_id);
  if (!b || !h) return false;
  const x = build(kind, b, h, o);
  if (!x) return x === null;   // null: a toast said why (no address for the chair); false: an older draft, left to helper.js
  HP.begin(x, email ? { mode: 'email', b: b.id, h: h.id, o: { mode: 'email', bill: b.id, hearing: h.id, ...(o.chair ? { chair: o.chair } : {}) } } : { mode: 'testimony', b: b.id, h: h.id });
  return true;
};
// app.openLetter2(bill, kind = 'testimony', { hearing, resume, friend }): for a screen that wants this sheet by name. bill is an id or a bill;
// hearing defaults to the bill's open one; resume: open only if an unfinished letter is waiting (false otherwise). Returns true when it
// opened. (pub/app.js has the stand-in that loads this file and answers with a promise until it has.)
app.openLetter2 = (bill, kind = 'testimony', o = {}) => {
  const b = bill && typeof bill === 'object' ? bill : anyBill(bill); if (!b) return false;
  const h = o.hearing ? anyHearing(o.hearing) : openActions([b], hearingsOf(b))[0]?.h; if (!h) return false;
  const email = kind === 'email', me = HP.loadMe(), d = email ? (me.mail || {})[HP.mailKey({ mode: 'email', b, h })] : (me.drafts || {})[h.id];
  if (o.resume && !d) return false;
  return V2.open(email ? 'email' : 'testimony', { bill: b.id, hearing: h.id, friend: o.friend, chair: o.chair, force: true });
};

function build(kind, b, h, o) {
  const me = HP.loadMe(), email = kind === 'email', code = email ? h.committee : null;
  const to = email ? HP.chairsTo(code).filter(t => (!o.chair || t.code === o.chair) && (t.email || t.url)) : [];
  if (email && !to.length) { toast('We couldn’t open the email helper. Try again in a moment.', { err: true }); return null; }
  const d = email ? (me.mail || {})[HP.mailKey({ mode: 'email', b, h, code })] : (me.drafts || {})[h.id];
  if (d && !d.v2) return false;   // started in the older walkthrough: it finishes there
  const mine = myStance(b.id), saved = !d && me.whyBill !== b.id ? storyFor(HP.catsOf(b)) : null;
  const x = { v2: true, mode: email ? 'email' : 'testimony', b, h, code, to, moment: null, screen: 'v2l', name: myName(), email: me.email || '',
    closing: me.closing || 'Mahalo', why: d ? d.why || '' : me.whyBill === b.id ? me.why || '' : saved?.text || '', whyStory: !!saved, offer: null,
    points: [], pointsText: '', tp: { chosen: myTitles(), q: '', more: false, active: -1 }, use: d?.use || null, saveStory: false, noLive: !!d?.noLive,
    letter: '', subject: '', edited: false, built: null, errs: {}, scrollTop: 0, focusId: '', link: '', opener: HP.keyOf(document.activeElement), friend: !!o.friend,
    stanceOpen: false, touched: false, tried: false, acctNew: false };
  // Where they stand: what they marked on the bill page, else a draft's, else HIPHI's side as the starting point (never recorded as theirs
  // until they tap a chip). "Not sure" on the bill page is "Not sure" here.
  x.stance = mine === 'support' || mine === 'oppose' ? mine : mine === 'unsure' ? 'comments' : d?.stance || HP.hiphiStance(b);
  x.fromBill = mine === 'support' || mine === 'oppose' || mine === 'unsure' ? (mine === 'unsure' ? 'comments' : mine) : null;
  x.mild = d ? !!d.mild : strongly(b);   // "I strongly support it" is HIPHI's word; theirs to choose under "change"
  x.acctStep = !email && !me.capitolAcct && !myActions().some(a => a.kind === 'testimony');   // the Capitol account, once per browser
  x.firstTime = x.acctStep;
  x.points = d ? d.points || [] : x.stance === HP.hiphiStance(b) ? firstTwo(x) : [];
  x.pointsText = d?.pointsText ?? HP.pointsLine(x.points);
  if (!d && !email) {   // a letter kept from this bill's earlier hearing starts the words: its points that still stand, its line, its sign-off
    const r = readyLetter(b, h, didKind(b, h, 'testimony')), L = r?.rec;
    if (L) {
      if (L.stance === x.stance && Array.isArray(L.points)) { const ok = HP.pointGroups(x); const all = [...ok.hiphi, ...ok.partners.flatMap(p => p.points)]; x.points = all.filter(p => L.points.includes(p)); x.pointsText = HP.pointsLine(x.points); }
      x.why = L.why || x.why; x.closing = me.closing || L.closing || x.closing;
    }
  }
  x.name0 = x.name.trim();   // the name they came in with: a change on the way saves to the profile
  x.t0 = d?.t0 && Date.now() - d.t0 < 3 * 36e5 ? d.t0 : Date.now();
  HP.syncLetter(x);
  if (email) x.subject = HP.mailSubject(x);
  if (!email && !d && agrees(b) === false) x.screen = 'v2own';   // they see it differently from HIPHI: the Capitol's own form first
  if (d) {
    x.resumed = true; x.touched = true; x.tried = !!d.tried; x.acctNew = !!d.acctNew; x.away = !!d.away; x.back = !!d.back; x.leftAt = d.left || 0;
    const seq = V2.seq(x);
    x.screen = seq.includes(d.screen) || d.screen === 'v2own' ? d.screen : seq[seq.length - 1];
    if (email && x.screen === 'mail') { x.subject = d.subject || x.subject; x.opened = d.opened || ''; x.asked = !!d.opened; }
  }
  return x;
}

// ---------------- the steps ----------------
V2.seq = x => isEmail(x) ? ['v2l', 'mail'] : ['v2l', x.acctStep && 'v2a', 'v2s'].filter(Boolean);
V2.body = x => x.screen === 'v2l' ? letterScreen(x) : x.screen === 'v2a' ? acctScreen(x) : x.screen === 'v2s' ? sendScreen(x) : x.screen === 'v2own' ? ownScreen(x) : null;

// ---------------- screen 1: your letter ----------------
// "Your letter supports it", not "You support it": HIPHI's side is only the starting point until they choose (B-12), so the line claims less.
const SAYS = { support: 'supports it', oppose: 'opposes it', comments: 'shares your thoughts' };
const CHIPS = [['support', 'Support'], ['oppose', 'Oppose'], ['comments', 'Not sure']];
function stanceLine(x, hint = '') {
  const s = sideOf(x), w = SAYS[s] || SAYS.comments, hs = HP.hiphiStance(x.b), open = !!x.stanceOpen, word = isEmail(x) ? 'email' : 'letter';
  const verb = s === 'oppose' ? 'oppose' : 'support';
  // HIPHI holds it strongly: the letter says "strongly" only if they choose to (R-212 #11), one tap under the chips.
  const strong = open && s === hs && strongly(x.b) ? btn(x.mild ? `I strongly ${verb} it, as HIPHI does` : `I ${verb} it, but not strongly`, { kind: 'text', sm: true, cls: 'hp-inl v2-strong', attrs: { 'data-hp': 'v2-strong' } }) : '';
  const from = x.fromBill && s === x.fromBill ? `<p class="hp-quiet v2-frombill">You marked ${s === 'oppose' ? 'Oppose' : s === 'support' ? 'Support' : 'Not sure'} on the bill page.</p>` : '';
  return `<div class="v2-stancebox"><p class="v2-stance" id="v2-stance-l">Your ${word} <b>${w}</b> · ${btn('change', { kind: 'text', sm: true, cls: 'v2-change', attrs: { 'data-hp': 'v2-change', id: 'v2-change', 'aria-expanded': String(open), 'aria-label': 'Change where you stand' } })}</p>
    ${open ? `<div class="hp-sugs v2-chips" role="group" aria-labelledby="v2-stance-l">${CHIPS.map(([v, l]) => `<button type="button" class="chip hp-sug" data-hp="v2-stance" data-v="${v}" aria-pressed="${s === v}">${l}</button>`).join('')}</div>${strong}` : ''}${from}${hint}</div>`;
}
// One talking point: a line in the letter that is a button. Kept it is the letter's own text with a check; left out it is grey with a plus,
// in the same 18px slot, so the words never move or wrap again when it is tapped (A-12, A-8).
const lineInner = (s, on, word) => `${icon(on ? 'check' : 'plus')}<span class="v2-ptt"><span class="sr">${on ? `Kept in your ${word}: ` : `Left out of your ${word}: `}</span>${esc(sentence(s))}</span>`;
function lines(x) {
  const g = HP.pointGroups(x), word = isEmail(x) ? 'email' : 'letter', pt = (s, i) => `<li><button type="button" class="v2-pt${x.points.includes(s) ? '' : ' out'}" id="hp-v2pt-${i}" data-hp="v2-pt" data-i="${i}" aria-pressed="${x.points.includes(s)}">${lineInner(s, x.points.includes(s), word)}</button></li>`;
  let at = g.hiphi.length;
  const out = g.hiphi.map((s, i) => pt(s, i)).join('') + g.partners.map(q => { const i0 = at; at += q.points.length;
    return `<li class="v2-from" role="presentation">${icon('handshake')}<span>From ${esc(q.name)}</span></li>${q.points.map((s, j) => pt(s, i0 + j)).join('')}`; }).join('');
  return out ? `<ul class="v2-lines" role="list" aria-describedby="v2-hint">${out}</ul>` : '';
}
function signed(x) {
  const bad = x.errs.name, nm = x.name.trim();
  if (nm && !x.nameEdit) return `<p class="v2-name"><span>${esc(nm)}</span>${btn('change', { kind: 'text', sm: true, cls: 'v2-rename', attrs: { 'data-hp': 'v2-rename', 'aria-label': 'Change the name on your letter' } })}</p>`;
  return `<div class="field v2-signed"><label for="hp-name">Signed by</label>
    <input id="hp-name" name="name" type="text" autocomplete="name" autocapitalize="words" enterkeyhint="done" placeholder="Your full name" value="${esc(x.name)}"${bad ? ' aria-invalid="true" aria-describedby="hp-name-err"' : ''}>${bad ? HP.errHTML('name') : ''}</div>`;
}
function ownBox(x) {
  const need = needsOwn(x), saved = x.whyStory && storyFor(HP.catsOf(x.b)), bad = x.errs.why;
  return `<div class="field v2-own"><label for="hp-why">${need ? 'What you think, and why' : 'Add a line of your own (optional)'}</label>
    <textarea id="hp-why" name="why" rows="2" placeholder="${need ? 'I think… because…' : esc(storyAsk(true))}" autocapitalize="sentences"${bad ? ' aria-invalid="true" aria-describedby="hp-why-err"' : ''}>${esc(x.why)}</textarea>${bad ? HP.errHTML('why') : ''}
    ${saved && x.why.trim() === saved.text ? `<span class="help" id="hp-why-help">${HP.whyHelp(x)}</span>` : ''}</div>`;
}
// The sign-off (R-357 part A; Nate 28 Oct: the sign-off moves out of the letter). The closing word is where the letter ends, so the choice
// is there: a tap, styled as "change" is on the stance line, opens in place the ideas (v1's chips) and a small box for their own words.
// A pick or a typed word is theirs from then on: written into the letter, kept on this device (the profile page's "How you sign off" reads
// the same place). The default "Mahalo" is not kept as if they had written it. Empty words fall back to it.
function signoff(x) {
  const open = !!x.closeOpen, word = closingOf(x.closing) || 'Mahalo,';
  const tap = btn(esc(word), { kind: 'text', sm: true, cls: 'v2-change v2-signoff', attrs: { 'data-hp': 'v2-closing', id: 'v2-closing', 'aria-expanded': String(open), 'aria-label': `${word} Change how you sign off` } });
  if (!open) return `<p class="v2-closing">${tap}</p>`;
  const own = HP.CLOSINGS.includes(x.closing) ? '' : x.closing;
  return `<p class="v2-closing">${tap}</p><div class="v2-closeopt" id="v2-closeopt" role="group" aria-label="How you sign off">
    <div class="hp-sugs v2-chips">${HP.CLOSINGS.map(c => `<button type="button" class="chip hp-sug" data-hp="v2-closing-pick" data-v="${esc(c)}" aria-pressed="${x.closing === c}">${esc(c)}</button>`).join('')}</div>
    <div class="field v2-closeown"><label for="v2-closing-own">Your own words</label>
      <input id="v2-closing-own" type="text" maxlength="40" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" placeholder="Like Warmly" value="${esc(own)}"></div></div>`;
}
function letterScreen(x) {
  const { h } = x, mail = isEmail(x), parts = HP.partsOf(x), due = mail ? null : dueInfo(h);
  const to = mail ? `<p class="v2-to"><b>To</b> ${esc(x.to.map(t => t.label).join(', '))}<br><b>Subject</b> ${esc(x.subject)}</p>` : `<p class="v2-head">${parts.head.split('\n').map(esc).join('<br>')}</p>`;
  const ls = lines(x), says = HP.saysBox(x, ['why']);
  return `<div class="hp-top">${HP.screenHead(1, `Your ${mail ? 'email' : 'letter'}`)}</div>
    ${HP.friendLine(x)}${due?.late ? HP.lateBanner(h) : ''}${HP.welcomeBack()}
    ${stanceLine(x, ls ? '<p class="v2-hint" id="v2-hint">Tap a line to keep it or leave it out.</p>' : '')}
    <article class="v2-paper" aria-label="Your ${mail ? 'email' : 'letter'}">
      ${to}
      <p>${esc(parts.dear)}</p>
      <p data-v2-part="open">${esc(parts.open)}</p>
      ${ls}
      ${ownBox(x)}
      ${parts.ask ? `<p>${esc(parts.ask)}</p>` : ''}
      <div class="v2-sign">${signoff(x)}${signed(x)}</div>
    </article>
    ${says}${HP.aboutNote(x)}`;
}

// ---------------- screen 2: the Capitol account, first time only ----------------
function acctScreen(x) {
  const chairs = HP.chairsTo(x.h.committee).some(t => t.email || t.url);
  return `<div class="hp-top">${HP.screenHead(2, 'Your Capitol account')}
      <p class="hp-sub">About 10 minutes: the Capitol asks you to make an account. We’ll walk you through it.</p></div>
    ${HP.welcomeBack()}
    <div class="hp-choices" role="group" aria-label="Have you sent testimony on the Capitol website before?">
      <p class="hp-q">Have you sent testimony on the Capitol website before?</p>
      <button type="button" class="hp-choice" data-hp="v2-acct-yes"><b>Yes, I have an account</b></button>
      <button type="button" class="hp-choice" data-hp="v2-acct-no"><b>No, this is my first time</b><span>We’ll help you make one on the next screen.</span></button></div>
    <p class="note v2-par">${icon('phone')}<span>Stuck? The Public Access Room helps for free: <a class="hp-tel" href="${HP.PAR_TEL}">${HP.PAR_SHOW}</a></span></p>
    ${chairs ? `<div class="v2-escape">${btn('Email the chair instead · 2 min, no account', { kind: 'text', icon: 'mail', attrs: { 'data-hp': 'v2-email' } })}</div>` : ''}`;
}

// ---------------- screen 3: send ----------------
function sendScreen(x) {
  const { h } = x, date = new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric' });
  const first = x.acctNew ? `<p>First, make your free account on the Capitol page: choose <b>Submit Testimony</b>, then <b>Register</b>. They email you a link to confirm it.</p>` : '';
  const ask = x.tried ? `<section class="card v2-ask" aria-labelledby="v2-ask-t"><h4 id="v2-ask-t">Did it go through?</h4>
      <p>The green box on the Capitol page means it did.</p>
      <div class="v2-answers">${btn('Yes', { kind: 'primary', icon: 'check', attrs: { 'data-hp': 'confirm', ...(x.busy ? { 'aria-busy': 'true', disabled: true } : {}) } })}${btn('Not yet', { kind: 'secondary', attrs: { 'data-hp': 'v2-notyet' } })}</div></section>` : '';
  return `<div class="hp-top">${HP.screenHead(3, 'Send it at the Capitol')}
      <p class="hp-sub">One tap copies your letter and opens the Capitol page. It goes to lawmakers under your name, and the Capitol posts it publicly.</p></div>
    ${HP.welcomeBack()}
    ${DEMO ? notice('Practice: this copies your letter and opens nothing. On the real tracker it takes you to the Capitol website.') : ''}
    <div class="v2-do">${first}<p>Sign in, pick the hearing on <b class="hp-nw">${esc(date)}</b>, paste your letter, submit. Look for the <b>green box</b>.</p>
      <p>On the form, choose <b>${HP.formWord(sideOf(x))}</b> and <b>Individual</b>.</p></div>
    ${ask}
    ${HP.capitolNotes(true)}
    ${x.failMsg ? `<div class="inlinemsg" role="alert">${icon('circle-alert')}<span>${esc(x.failMsg)}</span></div>` : ''}`;
}
const notice = text => `<div class="notice info">${icon('info')}<div><p>${esc(text)}</p></div></div>`;

// ---------------- someone who sees the bill differently from HIPHI: the Capitol's own form ----------------
function ownScreen(x) {
  const word = HP.formWord(sideOf(x));
  return `<div class="hp-top">${HP.screenHead(1, 'Say it in your own words')}
      <p class="hp-sub">You see this one differently from HIPHI. Lawmakers still want to hear it, and the Capitol’s own form is the place to say it your way.</p></div>
    ${HP.practiceNote()}
    <div class="v2-do"><p>Sign in, pick the hearing, choose <b>${word}</b> and <b>Individual</b>, write what you think, submit. Look for the <b>green box</b>.</p></div>
    <div class="v2-escape">${btn('Write a letter here in my own words', { kind: 'text', icon: 'pencil', attrs: { 'data-hp': 'v2-write' } })}</div>
    ${HP.capitolNotes(false)}`;
}

// ---------------- the footer ----------------
// What the one button says: where it goes (C-6). The Capitol account when that screen follows, else the send.
const nextWords = x => isEmail(x) ? 'Next: send your email' : V2.seq(x)[V2.seq(x).indexOf('v2l') + 1] === 'v2a' ? 'Next: your Capitol account' : 'Next: send it';
V2.foot = (x, { row, back, later }) => {
  const busy = `<button type="button" class="btn primary hp-main" aria-busy="true">${icon('loader-circle')}<span>Saving…</span></button>`;
  switch (x.screen) {
    case 'v2l': return row(`<button type="button" class="btn text hp-back" data-hp="close">${icon('chevron-left')}<span>Back</span></button>`
      + btn(nextWords(x), { kind: 'primary', iconEnd: 'arrow-right', cls: 'hp-main', attrs: { 'data-hp': 'next' } }), later);
    case 'v2a': return row(back, later);
    case 'v2s': return row(back + (x.busy ? busy : btn('Copy and open the Capitol page', { kind: x.tried ? 'secondary' : 'primary', icon: 'copy', cls: 'hp-main', attrs: { 'data-hp': 'copyopen', id: 'v2-copyopen' } })), x.busy ? '' : later);
    case 'v2own': return row(back + HP.capitolLink(x.b, x.h, 'Testify at the Capitol site', { kind: 'primary', cls: 'hp-main' }), later);
    default: return null;   // the email send step and every Mahalo are helper.js's own
  }
};

// ---------------- taps ----------------
V2.click = (a, t) => {
  const x = S.helper;
  switch (a) {
    case 'v2-change': x.stanceOpen = !x.stanceOpen; HP.paint({ focus: 'v2-change' }); return true;
    case 'v2-stance': pickStance(x, t.dataset.v); return true;
    case 'v2-strong': x.mild = !x.mild; x.touched = true; rewrite(x); HP.paint({ focus: 'v2-change' }); return true;
    case 'v2-pt': togglePoint(x, +t.dataset.i, t); return true;
    case 'v2-closing': x.closeOpen = !x.closeOpen; HP.paint({ focus: 'v2-closing' }); if (x.closeOpen) dlg()?.querySelector('#v2-closeopt')?.scrollIntoView({ block: 'center' }); return true;   // the box is below the word: bring it into view above the bar
    case 'v2-closing-pick': setClosing(x, t.dataset.v); x.closeOpen = false; HP.paint({ focus: 'v2-closing' }); HP.announce(`You’ll sign off with ${x.closing}.`); return true;
    case 'v2-rename': x.nameEdit = true; HP.paint({ focus: 'hp-name' }); return true;
    case 'next': if (x.screen !== 'v2l') return false; toNext(x); return true;
    case 'back': if (x.screen !== 'v2own') return false; HP.goTo('v2l'); return true;
    case 'v2-write': HP.goTo('v2l'); return true;
    case 'v2-acct-yes': HP.saveMe({ capitolAcct: true }); HP.goNext(); return true;
    case 'v2-acct-no': x.acctNew = true; HP.goNext(); return true;
    case 'v2-email': toEmail(x); return true;
    case 'copyopen': x.tried = true; return false;   // the pressed button is helper.js's (copy, then open, inside the tap); the question follows it
    case 'later': x.touched = true; return false;   // "I'll finish later" keeps the letter, even if nothing was changed, and leaves the sheet
    // Not yet: the question folds away; the button and the steps stay, for someone back from the Capitol tab mid-way. The letter is kept as unfinished.
    case 'v2-notyet': x.tried = false; x.touched = true; HP.saveDraft(); HP.paint({ focus: 'v2-copyopen' }); HP.announce('Okay. Your letter is saved here. Open the Capitol page again when you are ready.'); return true;
    case 'says': x.touched = true; return false;   // a part about them left out or put back (helper.js writes the letter again)
    default: return false;
  }
};
// A word of their own for the sign-off: the letter says it, the device keeps it. Empty is the default, which is not kept.
function setClosing(x, word) {
  const w = String(word || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  x.closing = w || 'Mahalo'; x.touched = true;
  saveProfile({ closing: w }).catch(e => console.warn('profile:', e?.message || e));
  rewrite(x);
}
// Written again from the answers after a change of side or of "strongly".
function rewrite(x) { HP.syncLetter(x); if (isEmail(x)) x.subject = HP.mailSubject(x); }
function pickStance(x, v) {
  const b = x.b, hs = HP.hiphiStance(b), was = sideOf(x);
  x.stanceOpen = false;
  if (v === was) { HP.paint({ focus: 'v2-change' }); return; }
  x.touched = true;
  if (was === hs) x.hold = x.points;   // HIPHI's points come back as they were left if they return to HIPHI's side
  x.stance = v; x.fromBill = null; x.mild = v === hs && strongly(b);
  x.points = v === hs ? (x.hold ?? firstTwo(x)) : [];
  x.pointsText = HP.pointsLine(x.points);
  // Saved on the bill too, as the older "Where do you stand?" did (R-120): their own answer, so it is theirs from here on.
  setStance(b.id, v === 'comments' ? 'unsure' : v).catch(() => {});
  rewrite(x);
  if (!isEmail(x) && agrees(b) === false) { x.screen = 'v2own'; HP.saveDraft(); HP.paint({ focus: 'hp-sh', top: true }); return; }
  HP.paint({ focus: 'v2-change' }); HP.announce(`Your ${isEmail(x) ? 'email' : 'letter'} now ${SAYS[v]}.`);
}
// A line kept or left out: the button changes in place (no redraw, so the screen stays where it is), the letter is written again.
function togglePoint(x, i, el) {
  const all = HP.pointsOf(x), s = all[i]; if (!s) return;
  const on = !x.points.includes(s), set = new Set(on ? [...x.points, s] : x.points.filter(p => p !== s));
  x.points = all.filter(p => set.has(p)); x.pointsText = HP.pointsLine(x.points); x.touched = true;
  HP.syncLetter(x);
  el.setAttribute('aria-pressed', String(on)); el.classList.toggle('out', !on); el.innerHTML = lineInner(s, on, isEmail(x) ? 'email' : 'letter');
  HP.announce(`${on ? 'Kept in' : 'Left out of'} your ${isEmail(x) ? 'email' : 'letter'}.`);
}
// Next: the name is needed to sign it (and the reason when the letter is theirs alone); then the profile keeps the name, and on.
function toNext(x) {
  const d = dlg(); if (!d) return;
  for (const f of ['name', 'why']) { const el = d.querySelector('#hp-' + f); if (el) x[f] = el.value; }
  const bad = [...(!x.name.trim() ? ['name'] : []), ...(needsOwn(x) && !x.why.trim() ? ['why'] : [])];
  ['name', 'why'].forEach(f => { if (d.querySelector('#hp-' + f)) HP.setErr(f, bad.includes(f)); });
  if (bad.length) {
    // A name shown as plain text is never empty; the box that must be filled gets the focus and the plain message.
    d.querySelector('#hp-' + bad[0])?.focus(); d.querySelector('#hp-' + bad[0])?.scrollIntoView({ block: 'center' }); return;
  }
  HP.saveMe({ why: x.why, whyBill: x.b.id });   // (the sign-off is kept only when they choose one, setClosing)
  if (x.name.trim() && (x.name.trim() !== x.name0 || x.name.trim() !== myName())) { saveProfile({ name: x.name.trim() }).catch(e => console.warn('profile:', e?.message || e)); x.name0 = x.name.trim(); }
  rewrite(x);
  HP.goNext();
}
// The way out of the Capitol account: the same words as an email to the chair, no account. The letter's answers carry over.
function toEmail(x) {
  const code = x.h.committee, to = HP.chairsTo(code).filter(t => t.email || t.url);
  if (!to.length) { toast('We couldn’t open the email helper. Try again in a moment.', { err: true }); return; }
  const me = HP.loadMe(), drafts = { ...(me.drafts || {}) }; delete drafts[x.h.id]; HP.saveMe({ drafts });   // the testimony draft: they chose the email
  Object.assign(x, { mode: 'email', code, to, moment: null, subject: '', subjectEdited: false, edited: false, built: null, touched: true, acctNew: false });
  rewrite(x);
  HP.openMark.set({ mode: 'email', b: x.b.id, h: x.h.id, o: { mode: 'email', bill: x.b.id, hearing: x.h.id } });
  const d = dlg(); if (d) { d.dataset.key = [x.mode, x.b.id, x.h.id, x.code].join('|'); d.classList.add('hp-mail'); }
  HP.goTo('mail');
}

// ---------------- typing ----------------
V2.input = (e, t) => {
  const x = S.helper;
  if (t.id === 'hp-name') {
    x.name = t.value; HP.saveMe({ name: t.value.trim() });
    if (x.errs.name && t.value.trim()) HP.setErr('name', false);
    HP.syncLetter(x);
    const o = dlg()?.querySelector('[data-v2-part="open"]'); if (o) o.textContent = HP.partsOf(x).open;   // "My name is ..." follows the box
    return true;
  }
  if (t.id === 'v2-closing-own') {   // typed as they go, like the name: the word on the letter follows the box
    setClosing(x, t.value);
    const tap = dlg()?.querySelector('#v2-closing span'); if (tap) tap.textContent = closingOf(x.closing);
    dlg()?.querySelectorAll('[data-hp="v2-closing-pick"]').forEach(c => c.setAttribute('aria-pressed', String(c.dataset.v === x.closing)));
    return true;
  }
  if (t.id === 'hp-why') {
    x.why = t.value; x.touched = true; HP.saveMe({ why: t.value, whyBill: x.b.id });
    if (x.errs.why && t.value.trim()) HP.setErr('why', false);
    HP.grow(t); HP.syncLetter(x);
    return true;
  }
  return false;
};

// Enter in the sign-off box is "done": the options fold away, the focus goes back to the word.
V2.key = e => {
  if (e.target.id !== 'v2-closing-own') return false;
  e.preventDefault(); const x = S.helper; x.closeOpen = false; HP.paint({ focus: 'v2-closing' }); return true;
};

export default { open: V2.open };
