// The action card: one hearing on one bill, and the ways to help with it. Used by the guided start (step 3),
// Home ("Do this now"), Find (suggestions) and the bill page, so it looks and behaves the same everywhere.
// One primary button (write testimony, or email the chair once the written deadline has passed), one secondary
// ("More ways to help") that opens inside the card, never a sheet. Every action counts (Nate, 9/18).
import { S, DEMO, app, esc, icon, blurb, asSentence, spaced, billPath, issueOf, posInfo, cmteLabel, dueInfo, hearingText, dateLong, dayWord, timeWord, roomLabel, countOk, chairContacts, actedOn, didKind, doneKey, markDone, toggleWatch, dismiss, toast, friendly, KINDS, onb, onbSet, nick, myActions, agrees, anyBill, anyHearing, settledOn, goingOn, ensureBill, companionsOf, viaIssue, issuesOf, issueFollowed, setFollows, testimonyDraft, billShareUrl, issueShareUrl, dueWords, isResolution, followedIssues, CHAMBER_NAME, codesOf, suggestEvent } from './core.js';
import { testifyLabel, againLine, mailLabel } from './letters.js';
import { logAct } from './visitlog.js';
import { armOf, abRankMet, abSeen, shareTag } from './variant.js';
import { picShare, picSeen } from './sharepic.js';
import { btn, chip, posChip, iconBtn, issueLine } from './ui.js';
import { hearingRow, mountHome, openKey } from './speakup.js';
import { alertFields, alertButton, wireAlertForm, alertDoneHTML, codeStep, profileAsk, profileLede, PROFILE_H } from './alerts.js';

const key = (b, h) => `${b.id}|${h.id}`;
// S.compose and S.sentq are still read by the bill page (pub/bill.js); nothing here sets S.compose any more.
S.moreOpen ??= new Set(); S.compose ??= null; S.sentq ??= {}; S.goOpen ??= new Set(); S.chips ??= {};

// Done lines, one per kind, in the words a person would use.
function doneLabel(b, h, k) {
  const held = k === 'attend' ? !goingOn(h) : new Date(h.scheduled_at) < Date.now();
  return { testimony: 'Testimony sent', email: 'Emailed the chair', share: 'Shared', attend: held ? 'You went' : 'You plan to go' }[k];
}

// suggest: show the Follow / Not for me bar; why: the reason line (defaults to suggest when that is a sentence);
// compact: the bill page already shows the headline, chips and its own main button.
// The ladder (Nate, 9/19): a first visit never pushes an action. After that the easiest real step leads: until
// someone has taken any action the main button is the two-minute email to the chair, and testimony (the strongest
// step, but it needs a letter and a one-time Capitol account) is the first row under "More ways to help". Once they
// have acted, testimony leads. HIPHI's scripted email and letter are offered only when the person's own stance
// matches HIPHI's or they have not said; someone who disagrees is pointed to the Capitol's own form instead.
export const newToActing = () => myActions().length === 0;
// Ranking by weight with the committee (R-005, Nate 9/26), now the rank test (R-135, variant.js 'rank'): once testimony is
// sent, the 'ranked' version offers the strongest step still open as the main button - an email to the chair, then going
// in person, then sharing - and "More ways to help" lists the rest in that order; today's version has no main button
// then. Until testimony is sent both versions are the same: testimony leads for everyone, late testimony too (R-068, Nate
// 9/27 and 9/28, which came after this was first built with the quick email first for a newcomer). Someone who sees the
// bill differently is offered going and sharing (the scripted email is HIPHI's words). The testers' ?rank=1 still forces it.
const ranked = () => armOf('rank') === 'ranked';
const WEIGHT = ['testimony', 'email', 'attend', 'share'];
export function nextStep(b, h) {
  return (agrees(b) === false ? WEIGHT.filter(k => k !== 'email') : WEIGHT).find(k => !didKind(b, h, k)) || null;
}
// "How you'll help" chooses the next ask (R-156 C1, Nate 10/5 "Do it"): someone who said "I'd testify in person" (their
// profile, pub/profile.js) sees going to the hearing right under the main button, open to the steps, instead of fourth in
// "More ways to help". Counted by kind only: the ask shown (once a hearing a visit) and taken (backend 130).
const SHOWN = new Set();
function wantsInPerson() {
  let ints = S.session && S.profile ? S.profile.interests : null;
  if (!ints) try { ints = JSON.parse(localStorage.getItem('hiphi_me') || '{}').interests; } catch { /* private mode */ }
  return Array.isArray(ints) && ints.includes('testify');
}
// noTopic: the card sits under its topic's heading (Home by topic, R-135), so its own topic line would say it twice.
export function actionCard(b, h, { focus = false, suggest = null, why, heading = 'h3', compact = false, ofN = '', twin = null, noTopic = false } = {}) {
  if (why === undefined && typeof suggest === 'string') why = suggest;
  const k = key(b, h), iss = issueOf(b), due = dueInfo(h), late = !!due?.late, done = actedOn(b, h), more = S.moreOpen.has(k);
  if (due && settledOn(b, h)) due.tone = '';   // settled: the deadline is no longer a warning (going or sharing alone keeps it, R-142)
  const voices = countOk((S.voices || {})[h.id]);
  const chairs = chairContacts(h.committee), chairName = chairs.length ? chairs.map(c => `${c.title} ${c.last}`).join(' and ') : 'the chair';
  const doneKinds = KINDS.filter(x => didKind(b, h, x)), lastDone = doneKinds.slice().sort((x, y) => String((S.doneAt || {})[doneKey(b.id, h.id, y)] || '').localeCompare(String((S.doneAt || {})[doneKey(b.id, h.id, x)] || '')))[0];
  // Testimony leads wherever there is a hearing, for everyone (Nate 9/27, R-068): the walkthrough writes the letter from
  // the person's own stance, so someone who disagrees with HIPHI is helped too. The quick email is one of the other ways.
  // The quick email is the email walkthrough now (R-079, 9/29): data-mailwalk opens it in pub/helper.js, like testimony.
  const differs = agrees(b) === false, emailFirst = false;
  const testimonyBtn = btn(testifyLabel(b, h, late), { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-helper': h.id, 'data-bill': b.id } });
  const mailWords = mailLabel(b, 'email|' + h.id, 'Send a quick email · 2 min');   // "Send my email again" when one is ready (R-153)
  const emailBtn = btn(mailWords, { kind: 'primary', icon: 'mail', full: true, attrs: { 'data-mailwalk': k } });
  // A bill on an issue is followed through its issue (R-067), so the button says so, as the bill page's does (C1-7, R-199).
  const fi = issuesOf(b)[0];
  const followBtn = btn(fi ? 'Follow this issue' : 'Follow this bill', { kind: 'primary', icon: 'star', full: true, attrs: { 'data-follow': b.id, 'aria-pressed': 'false', 'aria-label': fi ? `Follow this issue: ${fi.name}` : null } });
  // A suggested bill they have not followed yet: the ask is step 2 of the ladder (follow), not
  // step 4 (email a committee chair about a bill they met four seconds ago).
  const asking = !!suggest && !S.watch.has(b.id);
  // The rank test is met where its versions differ: testimony sent on this hearing and another step still open (R-135).
  const after = !asking && !compact && didKind(b, h, 'testimony') && !!nextStep(b, h), R = after && ranked();
  if (after) abRankMet(h.id);
  const step = R ? nextStep(b, h) : null;
  const inPerson = !asking && !late && !didKind(b, h, 'attend') && new Date(h.scheduled_at) > Date.now() && !(R && step === 'attend') && wantsInPerson();
  if (inPerson && !SHOWN.has(h.id)) { SHOWN.add(h.id); logAct('ask_shown'); }
  // Said "I plan to go" and the hearing is still ahead (R-142): the card carries "How to get there" under its done line,
  // and "Go to the hearing" leaves More ways to help, since that sign-up is done (Undo is beside the done line).
  const planned = didKind(b, h, 'attend') && goingOn(h);
  // Speaking in person goes through the same Capitol testimony form (In person chosen there), so this is about getting
  // there, never a second way to testify (the review of R-156).
  const askBtn = inPerson ? btn('When and where to go', { kind: 'secondary', icon: 'map-pin', full: true, attrs: { 'data-go': k, 'data-asked': '1', 'aria-expanded': S.goOpen.has(k) } }) + (S.goOpen.has(k) ? goPanel(b, h, k) : '') : '';
  const rankedBtn = { testimony: testimonyBtn, email: emailBtn,
    attend: btn('Go to the hearing', { kind: 'primary', icon: 'map-pin', full: true, attrs: { 'data-go': k, 'aria-expanded': S.goOpen.has(k) } }),
    share: btn('Ask a friend to speak up', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-share': k } }) };
  const primary = asking ? followBtn
    : R ? (step ? rankedBtn[step] + (step === 'attend' && S.goOpen.has(k) ? goPanel(b, h, k) : '') : '')
    : emailFirst ? (didKind(b, h, 'email') ? '' : emailBtn) : (didKind(b, h, 'testimony') ? '' : testimonyBtn);
  const rowFor = x => ({
    testimony: differs ? '' : moreRow('notebook-pen', late ? 'Send late testimony' : 'Write testimony', late ? 'It will be marked late and may not be read before the vote.' : 'The strongest way to be heard. It takes a few minutes; the first time, the Capitol site asks for a free account.', { 'data-helper': h.id, 'data-bill': b.id }, didKind(b, h, 'testimony') && 'Sent'),
    email: differs ? '' : moreRow('mail', mailWords, `A short note to ${esc(chairName)}, who runs this hearing.`, { 'data-mailwalk': k }, didKind(b, h, 'email') && 'Emailed'),
    attend: inPerson || planned ? '' : moreRow('map-pin', 'Go to the hearing', `${esc(roomLabel(h.room))}, State Capitol. Anyone can attend.`, { 'data-go': k, 'aria-expanded': S.goOpen.has(k) }, didKind(b, h, 'attend') && doneLabel(b, h, 'attend')) + (S.goOpen.has(k) ? goPanel(b, h, k) : ''),
    share: moreRow('share-2', 'Ask a friend to speak up', 'More voices carry more weight.', { 'data-share': k }, didKind(b, h, 'share') && 'Shared'),
  })[x];
  // Their own senator or representative on this committee (R-080): a row, never the main button, since testimony and the
  // chair decide a hearing first.
  const legRow = hearingRow(b, h, moreRow);
  const rankedRows = () => [...WEIGHT.filter(x => x !== step).map(rowFor), legRow,
    moreRow('calendar-plus', 'Add to my calendar', late ? 'The hearing time and place.' : 'A reminder before testimony is due.', { 'data-ics': k }, S.chips[k + 'ics'] && 'Calendar file ready')].join('');
  const rows = R ? rankedRows() : [
    // Testimony is listed here only when it is not already the main button (a suggested bill leads with Follow).
    asking ? moreRow('notebook-pen', late ? 'Send late testimony' : 'Write my testimony', late ? 'It will be marked late and may not be read before the vote.' : 'The strongest way to be heard. It takes a few minutes.', { 'data-helper': h.id, 'data-bill': b.id }, didKind(b, h, 'testimony') && 'Sent') : '',
    differs ? '' : moreRow('mail', mailWords, `A short note to ${esc(chairName)}, who runs this hearing.`, { 'data-mailwalk': k }, didKind(b, h, 'email') && 'Emailed'),
    legRow,
    moreRow('share-2', 'Ask a friend to speak up', 'More voices carry more weight.', { 'data-share': k }, didKind(b, h, 'share') && 'Shared'),
    inPerson || planned ? '' : moreRow('map-pin', 'Go to the hearing', `${esc(roomLabel(h.room))}, State Capitol. Anyone can attend.`, { 'data-go': k, 'aria-expanded': S.goOpen.has(k) }, didKind(b, h, 'attend') && doneLabel(b, h, 'attend')),
    !inPerson && !planned && S.goOpen.has(k) ? goPanel(b, h, k) : '',
    moreRow('calendar-plus', 'Add to my calendar', late ? 'The hearing time and place.' : 'A reminder before testimony is due.', { 'data-ics': k }, S.chips[k + 'ics'] && 'Calendar file ready'),
  ].join('');
  const name = nick(b);
  return `<article class="card acard${done ? ' done' : ''}${focus ? ' focus' : ''}${S.justDone === b.id + '|' + h.id ? ' justdone' : ''}" data-card="${esc(k)}" aria-labelledby="t-${esc(h.id)}">
    ${compact ? '' : `<div class="acrow">${noTopic ? '' : issueLine(iss)}${posChip(b)}${suggest && !S.watch.has(b.id) ? `<button type="button" class="acdismiss" data-notforme="${esc(b.id)}" aria-label="Not for me: stop suggesting ${esc(spaced(b.bill_number))}">Not for me</button>` : ''}</div>
    <${heading} class="achead" id="t-${esc(h.id)}"><a href="${billPath(b)}">${esc(name || blurb(b, 120))}</a></${heading}>
    ${name ? `<p class="acwhat">${esc(blurb(b, 160))}</p>` : ''}`}
    <p class="meta"${compact ? ` id="t-${esc(h.id)}"` : ''}>${esc(spaced(b.bill_number))} · ${esc(cmteLabel(h.committee))}</p>
    ${b.hiphi_action && !differs ? `<p class="ask">${esc(b.hiphi_action)}</p>` : ''}
    ${why ? `<p class="why">${icon('sparkles')}${esc(why)}</p>` : ''}
    ${due ? `<p class="due ${due.tone}">${icon('clock')}<span>${due.html}${ofN ? ` <span class="ofn">· ${esc(ofN)}</span>` : ''}</span></p>` : ''}
    <p class="meta hearing">${esc(hearingText(h))}</p>
    ${done ? '' : againLine(b, h)}
    ${twin ? `<p class="twin">${icon('copy')}<span>Its twin in the ${esc(CHAMBER_NAME[twin.h.committee && codesOf(twin.h.committee)[0] && S.committees[codesOf(twin.h.committee)[0]]?.chamber] || 'other chamber')}, <a href="${billPath(twin.b)}">${esc(spaced(twin.b.bill_number))}</a>: ${esc([twin.h.testimony_deadline ? (dueInfo(twin.h)?.text || '').replace(/\.$/, '') : '', hearingText(twin.h).replace(/ · Room.*$/, '').replace(/^Hearing/, 'hearing')].filter(Boolean).join(' · '))}.</span></p>` : ''}
    ${differs ? `<p class="note">${icon('info')}<span>You see this one differently from HIPHI. You can still tell the committee what you think, in your own words.</span></p>` : ''}
    ${done ? `<div class="donebox" role="status">${icon('circle-check')}<span>${doneKinds.includes('testimony') ? 'You sent testimony. Mahalo!' : doneKinds.map(x => doneLabel(b, h, x)).join(' · ') + '. Mahalo!'}</span>${lastDone ? `<button type="button" class="btn text sm" data-undo="${esc(k)}|${lastDone}" aria-label="Undo: ${esc(doneLabel(b, h, lastDone))}">Undo</button>` : ''}</div>` : ''}

    ${voices ? `<p class="proof">${icon('users')}${voices} people have acted on this hearing through HIPHI</p>` : ''}
    <div class="btncol">${compact ? '' : primary}${askBtn}
      ${btn(more ? 'Fewer ways to help' : 'More ways to help', { kind: 'secondary', iconEnd: more ? 'chevron-up' : 'chevron-down', full: true, attrs: { 'data-moreways': k, 'aria-expanded': more ? 'true' : 'false', 'aria-controls': 'mw-' + h.id } })}</div>
    ${planned ? planBlock(b, h, k, lastDone !== 'attend') : ''}
    ${more ? `<div class="moreways" id="mw-${esc(h.id)}">${rows}</div>` : ''}
    ${suggest && S.watch.has(b.id) ? `<div class="suggestbar">${btn('Following', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-follow': b.id, 'aria-pressed': 'true', title: 'Following. Press to stop following.' }, cls: 'on' })}</div>` : ''}
  </article>`;
}
const moreRow = (ic, title, sub, a, doneText) => `<button type="button" class="mwrow"${Object.entries(a).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}><span class="lead">${icon(ic)}</span><span class="body"><span class="title">${title}</span><span class="sub">${sub}</span></span>${doneText ? chip(doneText, 'ok', 'check') : icon('chevron-right', { cls: 'chev' })}</button>`;

// ---- going in person (R-142, Nate 10/4: "People should be provided directions to in-person hearings if they sign up for
// them") ----
// The sign-up is "I plan to go". Before it, the panel says where and when and what the sign-up brings; after it, the card
// carries "How to get there" (planBlock), Home carries the plan until the hearing starts (goingCard), the walkthrough's
// last page offers it to someone speaking in person (pub/helper.js), and the calendar file carries the directions.
// The facts, checked 10/4: the Public Access Room's "At the Capitol" page (parking under the building from Miller Street,
// the state lots), the Capitol's Maps and Directories page (which rooms are on which floor: the 0s on the chamber level
// below the open-air center, the 200s the Senate's floor, the 300s the House's, the 400s with the Public Access Room in
// Room 401), a 2026 hearing notice (photo ID required; the building open 7 am to 5 pm on weekdays) and the
// Star-Advertiser on the security check (2024, 2025). Change a fact here and every place that shows it follows.
const CAPITOL = 'Hawaiʻi State Capitol, 415 S Beretania St, Honolulu, HI 96813';
const DIRECTIONS = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent('Hawaii State Capitol, 415 S Beretania St, Honolulu, HI 96813');
const MAP = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Hawaii State Capitol, 415 S Beretania St, Honolulu, HI 96813');
const PAR_TEL = 'tel:+18085870478', PAR_SHOW = '(808) 587-0478';
const GO = {
  bus: 'Many buses stop on Beretania Street, in front of the Capitol.',
  car: 'Driving? There’s paid parking under the Capitol (enter from Miller Street) and in the state lots nearby.',
  id: 'Bring a photo ID. Security checks it and your bag, so bring as little as you can.',
  help: 'The Public Access Room, Room 401, helps for free',
};
const ORD = { 2: '2nd', 3: '3rd', 4: '4th', 5: '5th' };
// "Room 229, 2nd floor": the room and where it is in the building, from its number's first digit.
const floorDigit = h => (/(\d)\d\d\b/.exec(h?.room || '') || [])[1] ?? null;
export function roomFloor(h) {
  const r = roomLabel(h.room), f = floorDigit(h);
  return !/^Room /.test(r) || f === null ? r : f === '0' ? `${r}, chamber level` : f === '1' ? `${r}, main floor` : ORD[f] ? `${r}, ${ORD[f]} floor` : r;
}
function findRoom(h) {
  const r = roomLabel(h.room), f = floorDigit(h);
  if (!/^Room /.test(r) || f === null) return 'The room isn’t posted yet. It shows here as soon as it is.';
  if (f === '0') return `${r} is on the chamber level, one floor below the open-air center. Take an elevator down.`;
  if (f === '1') return `${r} is on the main floor, around the open-air center.`;
  return ORD[f] ? `${r} is on the ${ORD[f]} floor. Take an elevator up.` : `Look for ${r}.`;
}
const arriveBy = h => timeWord(new Date(new Date(h.scheduled_at).getTime() - 20 * 6e4).toISOString());

// What the hearing said when they signed up, so a later change of room or time is pointed out (this browser only).
const GOING_KEY = 'hiphi_going';
const goingSaved = () => { try { return JSON.parse(localStorage.getItem(GOING_KEY) || '{}') || {}; } catch { return {}; } };
export function noteGoing(h, on) {
  if (!h) return;
  try { const m = goingSaved(); if (on) m[h.id] = { room: h.room || '', at: h.scheduled_at }; else delete m[h.id]; localStorage.setItem(GOING_KEY, JSON.stringify(m)); } catch { /* private mode */ }
}
function goChange(h) {
  const was = goingSaved()[h.id]; if (!was) return '';
  const bits = [];
  if (was.at && +new Date(was.at) !== +new Date(h.scheduled_at)) bits.push(`The time changed: it’s now ${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)}.`);
  if (h.room && (was.room || '') !== h.room) bits.push(`The room changed: it’s now ${roomFloor(h)}.`);
  return bits.join(' ');
}

// Before the sign-up (and after the hearing): where and when, and what saying "I plan to go" brings (C-6).
function goPanel(b, h, k) {
  const going = didKind(b, h, 'attend'), held = !goingOn(h);
  return `<div class="gopanel">
    <p>Hawaiʻi State Capitol, 415 S Beretania St, ${esc(roomFloor(h))}. ${esc(dateLong(h.scheduled_at))} at ${esc(timeWord(h.scheduled_at))}. Anyone can sit in and listen, with no sign-up.${held ? '' : ' Tap <b>I plan to go</b>, and you get directions, parking and how to find the room.'}</p>
    <div class="btnrow"><button type="button" class="chip" data-attend="${esc(k)}" aria-pressed="${going}">${icon(going ? 'check' : 'map-pin')}${going ? (held ? 'You went' : 'You plan to go') : 'I plan to go'}</button>
      <a class="btn text sm" href="${MAP}" target="_blank" rel="noopener">${icon('map')}Map</a></div></div>`;
}
// The card after the sign-up: what changed since, and "How to get there" opening the directions in place.
// cant: "I can't go" beside it, when the done line's Undo would take back a later step instead (testimony, say).
function planBlock(b, h, k, cant) {
  const open = S.goOpen.has(k), ch = goChange(h);
  return `${ch ? `<p class="note gochange">${icon('triangle-alert')}<span>${esc(ch)}</span></p>` : ''}
    <div class="goline">${btn('How to get there', { kind: 'secondary', sm: true, icon: 'map-pin', iconEnd: open ? 'chevron-up' : 'chevron-down', attrs: { id: 'go-' + h.id, 'data-go': k, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'gd-' + h.id } })}
      ${cant ? btn('I can’t go', { kind: 'text', sm: true, attrs: { 'data-undo': `${k}|attend` } }) : ''}</div>
    ${open ? goDirections(b, h) : ''}`;
}
// The directions themselves: one list, the same on the card, Home and the walkthrough's last page. hp: drawn inside the
// walkthrough, whose buttons are wired by data-hp (pub/helper.js).
export function goDirections(b, h, { hp = false } = {}) {
  const k = key(b, h), late = !!dueInfo(h)?.late, sent = didKind(b, h, 'testimony'), ics = S.chips[k + 'ics'];
  // To speak in person: chosen on the Capitol's testimony form, then the list at the room (the Public Access Room: "sign up
  // to speak when you first get to the meeting room").
  const speak = late ? '<b>Listening.</b> Testimony is closed for this hearing, but anyone can sit in and listen.'
    : sent ? '<b>To speak.</b> If you chose <b>In person</b> on the Capitol form, put your name on the list to speak when you get to the room. Speakers often get a minute or two.'
    : '<b>To speak.</b> Choose <b>In person</b> when you send testimony on the Capitol form. When you get to the room, put your name on the list to speak. Speakers often get a minute or two.';
  const li = (ic, html) => `<li>${icon(ic)}<span>${html}</span></li>`;
  return `<section class="godir" id="gd-${esc(h.id)}" ${hp ? `aria-labelledby="gdt-${esc(h.id)}"` : 'aria-label="How to get there"'}>
    ${hp ? `<p class="godir-t" id="gdt-${esc(h.id)}" tabindex="-1">How to get there</p>` : ''}
    <ul class="godir-list" role="list">
      ${li('clock', `<b>Arrive by ${esc(arriveBy(h))}.</b> The security check at the door can take a few minutes.`)}
      ${li('route', `<b>Getting there.</b> ${esc(GO.bus)} ${esc(GO.car)}`)}
      ${li('shield-check', `<b>Getting in.</b> ${esc(GO.id)}`)}
      ${li('building', `<b>Finding the room.</b> ${esc(findRoom(h))}`)}
      ${li('mic', speak)}
      ${li('phone', `<b>Questions on the day?</b> ${esc(GO.help)}: <a href="${PAR_TEL}">${PAR_SHOW}</a>.`)}
    </ul>
    <div class="btnrow">${btn('Directions', { kind: 'secondary', sm: true, icon: 'map', iconEnd: 'external-link', href: DIRECTIONS, attrs: { target: '_blank', rel: 'noopener', 'data-godir': '1' } })}
      ${btn('Add to my calendar', { kind: 'text', sm: true, icon: 'calendar-plus', attrs: hp ? { 'data-hp': 'goics' } : { 'data-ics': k } })}</div>
    ${ics ? `<p class="okmsg" role="status">${icon('circle-check')}<span>Saved. Open the file to add it to your calendar.</span></p>` : ''}
    <p class="small muted">Hearings sometimes move or run late. Check here before you leave.</p>
  </section>`;
}
// Home (R-142): every hearing they plan to go to that is still ahead, within a week, and not already drawn as a card on the
// page (drawn: those hearings' ids). A cancelled one stays, saying so, with the hearing set in its place if there is one.
export function goingPlans(drawn = new Set()) {
  const now = Date.now(), seen = new Set(), out = [];
  for (const a of myActions()) {
    if (a.kind !== 'attend' || !a.hearing_id || seen.has(a.hearing_id) || drawn.has(a.hearing_id)) continue;
    seen.add(a.hearing_id);
    // Found where Home's other cards look (draftsCard): the bills they follow, and any opened this visit.
    const h = anyHearing(a.hearing_id), b = anyBill(a.bill_id);
    if (!h || !b) continue;
    const t = new Date(h.scheduled_at).getTime();
    if (!goingOn(h) || t > now + 8 * 864e5) continue;
    const next = h.status === 'cancelled' ? S.hearings.filter(x => x.bill_id === b.id && x.id !== h.id && x.status === 'scheduled' && x.committee === h.committee && new Date(x.scheduled_at) > now)
      .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0] || null : null;
    out.push({ b, h, next, soon: t - now < 2 * 864e5 && /^(today|tomorrow)/.test(dayWord(h.scheduled_at)) });
  }
  return out.sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
}
const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);
export function goingCard(plans) {
  if (!plans.length) return '';
  const item = ({ b, h, next }) => {
    const k = 'hm:' + key(b, h), open = S.goOpen.has(k), ch = goChange(h), name = nick(b) || blurb(b, 80);
    const head = `<p class="goitem-t"><a href="${billPath(b)}">${esc(name)}</a></p>`;
    if (h.status === 'cancelled') return `<div class="goitem">${head}
      <p class="note gochange">${icon('triangle-alert')}<span>The hearing on ${esc(dateLong(h.scheduled_at))} was cancelled.${next ? ` It’s now ${esc(dateLong(next.scheduled_at))} at ${esc(timeWord(next.scheduled_at))}, ${esc(roomFloor(next))}.` : ' If it’s set again, it shows on the bill’s page.'}</span></p>
      <div class="btnrow">${next ? btn('I’ll go to the new one', { kind: 'secondary', sm: true, icon: 'map-pin', attrs: { 'data-goswitch': `${b.id}|${h.id}|${next.id}` } }) : ''}
        ${btn('Take it off my plans', { kind: 'text', sm: true, attrs: { 'data-undo': `${b.id}|${h.id}|attend` } })}</div></div>`;
    return `<div class="goitem">
      <p class="goitem-when">${esc(cap1(dayWord(h.scheduled_at)))} at ${esc(timeWord(h.scheduled_at))}</p>${head}
      <p class="meta">${esc(spaced(b.bill_number))} · ${esc(roomFloor(h))}, State Capitol</p>
      ${ch ? `<p class="note gochange">${icon('triangle-alert')}<span>${esc(ch)}</span></p>` : ''}
      <div class="goline">${btn('How to get there', { kind: 'secondary', sm: true, icon: 'map-pin', iconEnd: open ? 'chevron-up' : 'chevron-down', attrs: { 'data-go': k, 'aria-expanded': open ? 'true' : 'false', 'aria-controls': 'gd-' + h.id } })}
        ${btn('I can’t go', { kind: 'text', sm: true, attrs: { 'data-undo': `${key(b, h)}|attend` } })}</div>
      ${open ? goDirections(b, h) : ''}</div>`;
  };
  return `<section class="card gocard" aria-labelledby="gocard-t">
    <h2 class="gocard-t" id="gocard-t">${icon('map-pin')}<span>${plans.length === 1 ? 'You plan to go' : `You plan to go to ${plans.length} hearings`}</span></h2>
    ${plans.map(item).join('')}</section>`;
}
// The calendar file's words for someone going: the same facts as the list, as plain text.
const goText = (b, h) => [`You plan to go. Arrive by ${arriveBy(h)} with a photo ID.`, findRoom(h), `${GO.bus} ${GO.car}`, `Questions on the day? ${GO.help}: ${PAR_SHOW}.`].join(' ');

// ---- email the chair ----
// The inline composer that lived here (a draft in the card, "Open in my mail app", "Yes, I sent it") became the email
// walkthrough in pub/helper.js on 9/29 (R-079): the same steps as testimony, then sending by mail app, Gmail or Outlook.
// ---- calendar: a real .ics file (a Blob), two events: the testimony deadline (2-hour alarm) and the hearing ----
function icsFor(b, h) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc2 = t => String(t).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const url = `${location.origin}${location.pathname}${billPath(b)}`, short = nick(b) || blurb(b, 60);
  // Someone who plans to go (R-142) gets the directions in the hearing's event, its floor in the place, and a reminder to
  // leave an hour and a half before; everyone else, the hearing as it was.
  const going = didKind(b, h, 'attend');
  const ev = (uid, start, mins, title, desc, alarm) => ['BEGIN:VEVENT', `UID:${uid}@bills.hiphi.org`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start).getTime() + mins * 6e4)}`,
    `SUMMARY:${esc2(title)}`, `DESCRIPTION:${esc2(desc)}`, `LOCATION:${esc2(CAPITOL + ', ' + (going ? roomFloor(h) : roomLabel(h.room)))}`, `URL:${url}`,
    ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(title)}`, `TRIGGER:${alarm}`, 'END:VALARM'] : []), 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI//Bill Tracker//EN', 'CALSCALE:GREGORIAN',
    ...(h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? ev(h.id + '-due', h.testimony_deadline, 15, `Testimony due: ${spaced(b.bill_number)} (${short})`, `Send testimony in 5 minutes: ${url}`, '-PT2H') : []),
    ...ev(h.id + '-hearing', h.scheduled_at, 60, `Hearing: ${spaced(b.bill_number)} (${short})`,
      going ? `${cmteLabel(h.committee)}. ${goText(b, h)} ${url}` : `${cmteLabel(h.committee)}. Anyone can attend. ${url}`, going ? '-PT90M' : ''), 'END:VCALENDAR'];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}
// The calendar file, saved; the walkthrough's directions use it too (R-142).
export function downloadIcs(b, h) {
  const url = URL.createObjectURL(icsFor(b, h)), a = document.createElement('a'); a.href = url; a.download = `${b.bill_number}-hearing.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  S.chips[key(b, h) + 'ics'] = true;
}
// Written like a friend talking, not a notice (Nate 9/29: "too professional and not encouraging"). acted: sent by someone who
// has just spoken up, so it starts from what they did.
// One share everywhere (R-113, the assessment's P3): the bill's own share page when it has one (billShareUrl: a text or
// a post previews with the bill's name, and the friend's visit counts as a share), the deadline in the words while
// testimony is still open, and the link passed once: the share sheet gets it as the url, the clipboard copy at the end.
// ask (R-169): what the friend is asked to do, which picks the share page (its card leads with the ask, its link opens
// it; core.js billShareUrl): 'testify' | 'ask' | 'floor' | 'conference' | 'governor' | 'follow'. The bill page passes
// the bill's ask of the moment (bill.js shareAsk); without one, a hearing ahead is testimony and a law is following.
// Where the share test runs (a deadline or a hearing ahead), its two messages stay exactly as tested (R-135); the other
// messages say the same ask as the card.
export function shareFor(b, h, { acted = false, law = false, differs = false, ask = '', chamber = '' } = {}) {
  const sp = spaced(b.bill_number), name = nick(b), named = name ? `${name} (${sp})` : sp;
  const due = h && h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? dueWords(h.testimony_deadline) : '';
  const heard = !due && h && new Date(h.scheduled_at) > Date.now() ? dayWord(h.scheduled_at) : '';
  const a = law ? 'follow' : ask || (due || heard ? 'testify' : '');
  const when = due ? ` Testimony is due ${due}.` : heard ? ` The committee hears it ${heard}.` : '';
  // The share test (R-135, variant.js 'share'): the 'deadline' version leads with the deadline. Only where there is one to
  // lead with, and then the link says which message it was (?via=share-deadline), so a friend's arrival is credited to it.
  // Testimony only: the committee email and the hearing (R-205) have their own words, the same in both versions.
  const testing = !law && !!(due || heard) && a === 'testify', lead = testing && armOf('share') === 'deadline', tag = testing ? shareTag() : '';
  const head = due ? `Testimony on ${named} closes ${due}.` : `The committee hears ${named} ${heard}.`;
  // The two other ways to help before a hearing (R-205): a short email to the committee, and going in person.
  const hwhen = h && new Date(h.scheduled_at) > Date.now() ? dayWord(h.scheduled_at) : '';
  const hline = a === 'email' ? `${hwhen ? `The committee hears it ${hwhen}. ` : ''}A short email to the committee before then takes about 2 minutes, and the tracker helps you write it.`
    : a === 'attend' ? `${hwhen ? `The committee hears it ${hwhen} at ${timeWord(h.scheduled_at)}, ${roomLabel(h.room)}, at the State Capitol. ` : ''}Anyone can come and listen, and the tracker says where to go.` : '';
  const text = hline ? (acted ? `I just spoke up on a bill I care about: ${named}. ${hline} ${a === 'attend' ? 'Want to come?' : 'Will you add your voice too?'}`
      : `Have you seen this? ${named}: ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')} ${hline}`)
    : law ? `${differs ? '' : 'Good news: '}${named} ${isResolution(b) ? 'was adopted' : 'is now law in Hawaiʻi'}. ${blurb(b, 110)}`
    : lead && acted ? `${head} I just spoke up, and it took a few minutes. Will you add your voice too? Lawmakers really do notice when lots of us write in.`
    : lead ? `${head} ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')} It takes a few minutes to tell them what you think, and every voice helps.`
    : !when && askLine(b, a, chamber) ? (acted ? `I just spoke up on a bill I care about: ${named}. ${askLine(b, a, chamber)} Will you add your voice too?`
      : `Have you seen this? ${named}: ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')} ${askLine(b, a, chamber)}`)
    : acted ? `I just spoke up at the Legislature on a bill I care about: ${named}. It only took a few minutes!${when} Will you add your voice too? Lawmakers really do notice when lots of us write in.`
    : `Have you seen this? ${named}: ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')}${when} It only takes a few minutes to speak up, and every voice helps.`;
  // The share picture test (R-183): the address of the version this share shows, when the bill has one for this ask.
  const ps = picShare(billShareUrl(b, a), a, b.id), page = ps.url, url = tag ? withVia(page, tag) : page;
  return { title: name || sp, text, url, copy: `${text} ${url}`, ab: tag ? b.id : '', pic: ps.pic };
}
// The message's ask when there is no hearing to name (R-169), the same ask as the card. '' keeps the general words.
function askLine(b, a, chamber) {
  const no = /oppose/.test(b.hiphi_position || ''), house = CHAMBER_NAME[chamber] || '';
  if (a === 'ask') return no ? 'It is waiting for a hearing, and a short email can ask the chair not to hear it. It takes about 2 minutes.'
    : 'It needs a hearing or it can’t pass this year. A short email can ask the chair for one, and it takes about 2 minutes.';
  if (a === 'floor') return `It goes to a vote of the full ${house || 'House or Senate'} soon. A short email can ask your legislator to vote ${no ? 'no' : 'yes'}, and it takes about 2 minutes.`;
  if (a === 'conference') return 'The House and Senate are working out one final version. A short email can make a difference, and it takes about 2 minutes.';
  if (a === 'governor') return `It is on the Governor’s desk. A short message can ask the Governor to ${no ? 'veto' : 'sign'} it, and it takes about 2 minutes.`;
  if (a === 'follow') return `${/dead|vetoed/.test(b.stage || '') ? 'It did not advance this year, but ideas like this often come back. ' : ''}Follow it with HIPHI and you’ll hear when your voice can count.`;
  return '';
}
// ?via= goes before the address's #/ part (a bill with no share page links straight to the tracker).
const withVia = (u, v) => { const i = u.indexOf('#'), base = i < 0 ? u : u.slice(0, i); return `${base}${base.includes('?') ? '&' : '?'}via=${v}${i < 0 ? '' : u.slice(i)}`; };
// The share itself: the device's share sheet, else the clipboard. 'shared' | 'copied' | '' (closed, or nothing works).
export async function doShare({ title, text, url, copy, ab, pic }) {
  const done = how => { if (how && ab) abSeen('share', { bill: ab }); if (how) picSeen(pic); return how; };   // a share made under the share test (R-135) and the picture test (R-183)
  try { if (navigator.share) { await navigator.share({ title, text, url }); return done('shared'); } } catch (e) { if (e?.name === 'AbortError') return ''; }
  try { await navigator.clipboard.writeText(copy || `${text} ${url}`); return done('copied'); } catch { return ''; }
}
// An issue's page shared (R-113: Share on the issue page, "Know someone who cares about <issue>? Send it" at the finale).
// Counted as a share (visit_counts), with no bill to mark. Resolves 'shared' | 'copied' | ''.
export function shareIssueText(i) {
  const n = (i.bill_ids || []).length;
  return `${i.name} at the Hawaiʻi Legislature: ${(i.description || '').replace(/([^.!?…])$/, '$1.')} ${n ? `HIPHI is working on ${n} ${n === 1 ? 'bill' : 'bills'} on it. ` : ''}Follow it and we’ll tell you when your voice can count.`.replace(/\s+/g, ' ').trim();
}
// Since R-205 it opens the same sheet as a bill's share (pub/askfriend.js), so a laptop gets Email it and Copy message
// instead of a silent copy. Resolves 'shared' | 'email' | 'copied' | ''; the sheet counts it.
export async function shareIssue(i) {
  return (await import('./askfriend.js')).askFriend({ issue: i });
}
   // the old shape, for anything still asking
const findBH = k => { const [bid, hid] = k.split('|'); const b = [...S.bills, ...Object.values(S.extra), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])].find(x => x.id === bid);
  const h = [...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat()].find(x => x.id === hid); return { b: b || anyBill(bid), h: h || anyHearing(hid) }; };
// Follow or unfollow with feedback, and Undo on unfollow. Following a bill with one companion (its
// twin filed in the other chamber) offers to follow that too, right here rather than silently -
// "never auto-follow silently" (HANDOFF 3.5 plan, wave 5c). Only ever offered, never done for them.
export async function followToggle(id, label) {
  const was = S.watch.has(id), via = was ? viaIssue(id) : null;
  // Follow means the issue (R-067): a bill that belongs to an issue brings its issue, which covers the bill, its twin in
  // the other chamber and next session's bills. Only a bill with no issue (HIPHI only watches it) is followed alone.
  const iss = was ? null : issuesOf(id).find(i => !issueFollowed(i));
  if (iss) {
    if (await setFollows({ issuesOn: [iss.id] })) { suggestEvent(id, 'followed'); toast(`Following ${iss.name}. Its bills come to you, this one included.`, { yay: true, undo: async () => { await setFollows({ issuesOff: [iss.id] }); app.render(); } }); }
    return;
  }
  await toggleWatch(id);
  if (!was) suggestEvent(id, 'followed');   // a suggested bill followed (R-094); counted only if it was suggested
  // A bill that came with an issue: its star is "Not for me", and the issue stays followed (R-018).
  if (was) { toast(via ? `You won’t hear about ${label || 'this bill'}. You still follow ${via.name}.` : `Unfollowed ${label || ''}`.trim(), { undo: async () => { await toggleWatch(id); } }); return; }
  // A bill with no issue, followed on its own, still offers its twin in the other chamber (R-021).
  const b = anyBill(id), cnums = b ? companionsOf(b) : [];
  if (cnums.length === 1) {
    try {
      const comp = await ensureBill(cnums[0], b.session_year);   // its twin is in the same session
      if (comp && !S.watch.has(comp.id)) {
        toast(`Following ${label || 'this bill'}`.trim(), { yay: true, also: { label: `Follow ${spaced(cnums[0])} too?`,
          action: async () => { await toggleWatch(comp.id); toast(`Following ${spaced(cnums[0])} too`, { yay: true }); } } });
        return;
      }
    } catch { /* decoration only; fall through to the plain toast */ }
  }
  toast(`Following ${label || 'this bill'}`.trim(), { yay: true });
}

// ---- wiring (called by every screen that shows action cards) ----
export function wireActions(root = document) {
  const $$ = s => root.querySelectorAll(s);
  $$('[data-helper]').forEach(el => el.onclick = () => app.openHelper(el.dataset.bill, el.dataset.helper));
  $$('[data-moreways]').forEach(el => el.onclick = () => { const k = el.dataset.moreways; S.moreOpen.has(k) ? S.moreOpen.delete(k) : S.moreOpen.add(k); app.render(); });
  // The email to the chair: the walkthrough (helper.js), on this hearing.
  $$('[data-mailwalk]').forEach(el => el.onclick = () => { const [bid, hid] = el.dataset.mailwalk.split('|'); app.openMail?.({ mode: 'email', bill: bid, hearing: hid }); });
  // Their own legislator on this committee (R-080), and Home's cards for the other moments and the introduction.
  $$('[data-speak]').forEach(el => el.onclick = () => openKey(el.dataset.speak));
  mountHome(root);
  // "Ask a friend to speak up" (R-205): the sheet picks the ask with them, the one they did first, and marks the share.
  $$('[data-share]').forEach(el => el.onclick = async () => { const k = el.dataset.share, { b, h } = findBH(k); if (!b) return;
    const did = ['testimony', 'email', 'attend'].find(x => didKind(b, h, x)) || '';
    const how = await (await import('./askfriend.js')).askFriend({ b, h, did, acted: !!did }); if (how === 'copied') S.chips[k + 'share'] = true;
    if (how) app.render(); });
  $$('[data-go]').forEach(el => el.onclick = () => { const k = el.dataset.go; S.goOpen.has(k) ? S.goOpen.delete(k) : S.goOpen.add(k); app.render(); });
  // "I plan to go" under the ask their profile chose (C1) is that ask taken.
  $$('[data-attend]').forEach(el => el.onclick = async () => { const [bid, hid] = el.dataset.attend.split('|'), on = !S.done.has(doneKey(bid, hid, 'attend'));
    if (on && el.closest('.acard')?.querySelector('[data-asked]')) logAct('ask_acted');
    // Signed up (R-142): the directions open where they tapped, and the room and time are kept to point out a change later.
    noteGoing(findBH(el.dataset.attend).h, on); if (on) S.goOpen.add(`${bid}|${hid}`);
    await markDone(bid, hid, 'attend', on, { quiet: true }); app.render();
    if (on) requestAnimationFrame(() => document.getElementById('go-' + hid)?.focus()); });
  $$('[data-godir]').forEach(el => el.addEventListener('click', () => logAct('directions')));   // the map's directions opened (backend 134)
  // A cancelled hearing they planned to go to, set again on another day (Home's plan card): the plan moves to the new one.
  $$('[data-goswitch]').forEach(el => el.onclick = async () => { const [bid, was, now] = el.dataset.goswitch.split('|');
    noteGoing(findBH(`${bid}|${was}`).h, false); await markDone(bid, was, 'attend', false, { quiet: true });
    noteGoing(findBH(`${bid}|${now}`).h, true); await markDone(bid, now, 'attend', true, { quiet: true });
    toast('Your plan moved to the new hearing.'); app.render(); });
  $$('[data-ics]').forEach(el => el.onclick = () => { const k = el.dataset.ics, { b, h } = findBH(k); if (!b || !h) return; downloadIcs(b, h); app.render(); });
  $$('[data-undo]').forEach(el => el.onclick = async () => { const [bid, hid, kind] = el.dataset.undo.split('|');
    if (kind === 'attend') noteGoing(findBH(`${bid}|${hid}`).h, false);
    await markDone(bid, hid, kind, false); app.render(); });
  $$('[data-follow]').forEach(el => el.onclick = async e => { e.stopPropagation(); const id = el.dataset.follow, b = [...S.bills, ...Object.values(S.extra), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])].find(x => x.id === id);
    await followToggle(id, b ? spaced(b.bill_number) : ''); });
  $$('[data-notforme]').forEach(el => el.onclick = () => { suggestEvent(el.dataset.notforme, 'dismissed'); dismiss(el.dataset.notforme); toast('Okay, we won’t suggest that one again'); app.render(); });
}

// ---- the alerts ask (one component everywhere): after follows, after an action, welcome back.
// Nate, 9/19: the process should ask naturally and warmly, and the ask is about the person (their alerts, their record on
// any device), never about making their actions "count". Since R-146 (Nate 10/4) it is the phone-first box of
// pub/alerts.js: a mobile number for texts, email as a link under it; both name the same two kinds of alert (C-4), so
// giving either IS the consent for them. One ask per visit; "Not now" quiets it for 14 days, then 60 (nudgeOk in core).
// pfx: the ids' prefix ('ng'; the letter helper's dialog draws its own copy as 'hp-ng', so the two never share an id).
// bar: the host's bar holds the box's submit button (<button form="<pfx>-form">, the letter's Mahalo, R-184) and, since
// R-205, its "Not now" (declineNudge), so the card holds only the box.
export function nudgeCard(kind = S.nudge, pfx = 'ng', { bar = false } = {}) {
  if (!kind) return '';
  // Before the signed-in check: a code (R-155) signs the person in as it turns texts on, and the card says so.
  if (S.nudgeText || S.nudgeSent) return `<div class="card tint nudgecard" role="status">${icon(S.nudgeText ? 'message-square' : 'mail-check')}<div>${alertDoneHTML(S.nudgeText ? { kind: 'phone', phone: S.nudgeText, demo: DEMO } : { kind: 'email', email: S.nudgeSent, demo: DEMO })}</div></div>`;
  if (S.session) return '';
  const nb = S.watch.size, na = myActions().length, ni = followedIssues().length;   // every issue followed, by itself or with its whole category (R-120, Bug 9); issues, not their bills (R-067)
  const email = S.alertMode === 'email', keep = email ? ' Your email also keeps your issues on any device.' : '';
  const things = `${ni ? `${ni} issue${ni === 1 ? '' : 's'}` : `${nb} bill${nb === 1 ? '' : 's'}`}${na ? ` and ${na} action${na === 1 ? '' : 's'}` : ''}`;
  // "Save your profile" (R-184, alerts.js profileAsk): the line says what the profile keeps; the old "Get alerts" words are
  // the test 'save''s second version. Either way the box under it says what arrives (pub/alerts.js), so these lines only
  // say why now, once (A-14). The heading is where the two versions differ on screen: met there.
  abSeen('save');
  const prof = profileAsk();
  const text = prof ? profileLede(['action', 'intro', 'back'].includes(kind) ? kind : 'follow', { things, many: ni > 1 })
    : kind === 'action' || kind === 'intro' ? `Mahalo for speaking up. Get a heads-up the next time one of your issues needs you.${keep}`
    : kind === 'back' ? `Welcome back. Your ${things} live in this browser only, and phones clear it after a while.${email ? ' Add your email so they’re still here in January, and to hear when a hearing is set.' : ' Get a text when a hearing is set, so you don’t miss it.'}`
    : `Hearings are set only about two days ahead, so a heads-up matters.${keep}`;
  const b = alertButton(pfx);
  // The sandbox used to show the heading with no box to type in (Nate 9/29: "nowhere to enter an email address"). The form
  // is the same there; nothing is sent or saved in the sandbox.
  return `<section class="card tint nudgecard" aria-labelledby="${pfx}-t">${icon(prof ? 'user-round-plus' : email ? 'mail-check' : 'message-square')}<div class="ngbody">
    <p class="strong" id="${pfx}-t">${codeStep(pfx) ? 'Check your texts' : prof ? PROFILE_H : 'Get alerts on your issues'}</p><p class="small">${codeStep(pfx) ? 'Type the 6-digit code from the text to turn on alerts.' : esc(text)}</p>
    <form class="ngform" id="${pfx}-form" novalidate>${alertFields(pfx, { compact: true })}
      ${bar ? '' : `<div class="btnrow">${btn(b.label, { kind: 'primary', sm: true, icon: b.icon, attrs: { type: 'submit' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-nudgeno': '1' } })}</div>`}</form></div></section>`;
}
// "Not now" to the profile ask: quiet for 14 days, then 60 (kernel nudgeOk). With bar, the host's bar holds both answers,
// "Not now" and the box's own button (the letter's Mahalo, R-205 C4: "Done" there closed the Mahalo before the share ask).
export function declineNudge() { const n = (onb().nudgeNo || 0) + 1; onbSet({ nudgeNo: n, nudgeNoAt: new Date().toISOString() }); S.nudge = false; }
// The letter helper passes its own prefix and redraw: its box once looked up 'ng-' ids its copy no longer had, so Text me
// there was never wired (found 10/5 building R-155).
export function wireNudge(root = document, { pfx = 'ng', redraw } = {}) {
  const again = redraw || (() => app.render());
  // Not now redraws its host: the letter's Mahalo is a dialog that app.render() does not draw, so its card stayed (R-184).
  root.querySelectorAll('[data-nudgeno]').forEach(el => el.onclick = e => { e.preventDefault(); declineNudge(); again(); if (redraw) app.render(); });
  const f = root.querySelector('.ngform'); if (!f) return;
  wireAlertForm(f, { pfx, source: S.nudge === 'action' ? 'action' : 'home', onSwap: again, onDone: r => { if (r.kind === 'phone') S.nudgeText = r.phone; else S.nudgeSent = r.email; again(); } });
}
