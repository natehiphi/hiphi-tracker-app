// The action card: one hearing on one bill, and the ways to help with it. Used by the guided start (step 3),
// Home ("Do this now"), Find (suggestions) and the bill page, so it looks and behaves the same everywhere.
// One primary button (write testimony, or email the chair once the written deadline has passed), one secondary
// ("More ways to help") that opens inside the card, never a sheet. Every action counts (Nate, 9/18).
import { S, DEMO, app, esc, icon, blurb, asSentence, spaced, billPath, issueOf, posInfo, cmteLabel, dueInfo, hearingText, dateLong, dayWord, timeWord, roomLabel, countOk, chairContacts, actedOn, didKind, doneKey, markDone, toggleWatch, dismiss, toast, friendly, KINDS, onb, onbSet, nick, myActions, agrees, anyBill, ensureBill, companionsOf, viaIssue, issuesOf, issueFollowed, setFollows, testimonyDraft, billShareUrl, issueShareUrl, dueWords, isResolution, followedIssues, CHAMBER_NAME, codesOf, suggestEvent } from './core.js';
import { testifyLabel, againLine, mailLabel } from './letters.js';
import { logAct } from './visitlog.js';
import { armOf, abRankMet, abSeen, shareTag } from './variant.js';
import { btn, chip, posChip, iconBtn, issueLine } from './ui.js';
import { hearingRow, mountHome, openKey } from './speakup.js';
import { alertFields, alertButton, wireAlertForm, alertDoneHTML, codeStep } from './alerts.js';

const key = (b, h) => `${b.id}|${h.id}`;
// S.compose and S.sentq are still read by the bill page (pub/bill.js); nothing here sets S.compose any more.
S.moreOpen ??= new Set(); S.compose ??= null; S.sentq ??= {}; S.goOpen ??= new Set(); S.chips ??= {};

// Done lines, one per kind, in the words a person would use.
function doneLabel(b, h, k) {
  const held = new Date(h.scheduled_at) < Date.now();
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
  if (due && done) due.tone = '';   // acted: the deadline is no longer a warning
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
  const followBtn = btn('Follow this bill', { kind: 'primary', icon: 'star', full: true, attrs: { 'data-follow': b.id, 'aria-pressed': 'false' } });
  // A suggested bill they have not followed yet: the ask is step 2 of the ladder (follow), not
  // step 4 (email a committee chair about a bill they met four seconds ago).
  const asking = !!suggest && !S.watch.has(b.id);
  // The rank test is met where its versions differ: testimony sent on this hearing and another step still open (R-135).
  const after = !asking && !compact && didKind(b, h, 'testimony') && !!nextStep(b, h), R = after && ranked();
  if (after) abRankMet(h.id);
  const step = R ? nextStep(b, h) : null;
  const inPerson = !asking && !compact && !late && !didKind(b, h, 'attend') && new Date(h.scheduled_at) > Date.now() && !(R && step === 'attend') && wantsInPerson();
  if (inPerson && !SHOWN.has(h.id)) { SHOWN.add(h.id); logAct('ask_shown'); }
  const askBtn = inPerson ? btn('Testify in person', { kind: 'secondary', icon: 'map-pin', full: true, attrs: { 'data-go': k, 'data-asked': '1', 'aria-expanded': S.goOpen.has(k) } }) + (S.goOpen.has(k) ? goPanel(b, h, k) : '') : '';
  const rankedBtn = { testimony: testimonyBtn, email: emailBtn,
    attend: btn('Go to the hearing', { kind: 'primary', icon: 'map-pin', full: true, attrs: { 'data-go': k, 'aria-expanded': S.goOpen.has(k) } }),
    share: btn('Share with a friend · 1 min', { kind: 'primary', icon: 'share-2', full: true, attrs: { 'data-share': k } }) };
  const primary = asking ? followBtn
    : R ? (step ? rankedBtn[step] + (step === 'attend' && S.goOpen.has(k) ? goPanel(b, h, k) : '') : '')
    : emailFirst ? (didKind(b, h, 'email') ? '' : emailBtn) : (didKind(b, h, 'testimony') ? '' : testimonyBtn);
  const rowFor = x => ({
    testimony: differs ? '' : moreRow('notebook-pen', late ? 'Send late testimony' : 'Write testimony · 5 min', late ? 'It will be marked late and may not be read before the vote.' : 'The strongest way to be heard. First time, the Capitol site asks for a free account.', { 'data-helper': h.id, 'data-bill': b.id }, didKind(b, h, 'testimony') && 'Sent'),
    email: differs ? '' : moreRow('mail', mailWords, `A short note to ${esc(chairName)}, who runs this hearing.`, { 'data-mailwalk': k }, didKind(b, h, 'email') && 'Emailed'),
    attend: inPerson ? '' : moreRow('map-pin', 'Go to the hearing', `${esc(roomLabel(h.room))}, State Capitol. Anyone can attend.`, { 'data-go': k, 'aria-expanded': S.goOpen.has(k) }, didKind(b, h, 'attend') && doneLabel(b, h, 'attend')) + (S.goOpen.has(k) ? goPanel(b, h, k) : ''),
    share: moreRow('share-2', 'Share with a friend · 1 min', 'More voices carry more weight.', { 'data-share': k }, didKind(b, h, 'share') && 'Shared'),
  })[x];
  // Their own senator or representative on this committee (R-080): a row, never the main button, since testimony and the
  // chair decide a hearing first.
  const legRow = hearingRow(b, h, moreRow);
  const rankedRows = () => [...WEIGHT.filter(x => x !== step).map(rowFor), legRow,
    moreRow('calendar-plus', 'Add to my calendar', late ? 'The hearing time and place.' : 'A reminder before testimony is due.', { 'data-ics': k }, S.chips[k + 'ics'] && 'Calendar file ready')].join('');
  const rows = R ? rankedRows() : [
    // Testimony is listed here only when it is not already the main button (a suggested bill leads with Follow).
    asking ? moreRow('notebook-pen', late ? 'Send late testimony' : 'Write my testimony', late ? 'It will be marked late and may not be read before the vote.' : 'The strongest way to be heard. About 10 minutes the first time.', { 'data-helper': h.id, 'data-bill': b.id }, didKind(b, h, 'testimony') && 'Sent') : '',
    differs ? '' : moreRow('mail', mailWords, `A short note to ${esc(chairName)}, who runs this hearing.`, { 'data-mailwalk': k }, didKind(b, h, 'email') && 'Emailed'),
    legRow,
    moreRow('share-2', 'Share with a friend · 1 min', 'More voices carry more weight.', { 'data-share': k }, didKind(b, h, 'share') && 'Shared'),
    inPerson ? '' : moreRow('map-pin', 'Go to the hearing', `${esc(roomLabel(h.room))}, State Capitol. Anyone can attend.`, { 'data-go': k, 'aria-expanded': S.goOpen.has(k) }, didKind(b, h, 'attend') && doneLabel(b, h, 'attend')),
    !inPerson && S.goOpen.has(k) ? goPanel(b, h, k) : '',
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
    ${inPerson ? `<p class="why">${icon('user')}<span>You said you’d testify in person. Here’s how for this hearing.</span></p>` : ''}
    <div class="btncol">${compact ? '' : primary}${askBtn}
      ${btn(more ? 'Fewer ways to help' : 'More ways to help', { kind: 'secondary', iconEnd: more ? 'chevron-up' : 'chevron-down', full: true, attrs: { 'data-moreways': k, 'aria-expanded': more ? 'true' : 'false', 'aria-controls': 'mw-' + h.id } })}</div>
    ${more ? `<div class="moreways" id="mw-${esc(h.id)}">${rows}</div>` : ''}
    ${suggest && S.watch.has(b.id) ? `<div class="suggestbar">${btn('Following', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-follow': b.id, 'aria-pressed': 'true', title: 'Following. Press to stop following.' }, cls: 'on' })}</div>` : ''}
  </article>`;
}
const moreRow = (ic, title, sub, a, doneText) => `<button type="button" class="mwrow"${Object.entries(a).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}><span class="lead">${icon(ic)}</span><span class="body"><span class="title">${title}</span><span class="sub">${sub}</span></span>${doneText ? chip(doneText, 'ok', 'check') : icon('chevron-right', { cls: 'chev' })}</button>`;

function goPanel(b, h, k) {
  const going = didKind(b, h, 'attend'), held = new Date(h.scheduled_at) < Date.now();
  const map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Hawaii State Capitol, 415 S Beretania St, Honolulu, HI 96813');
  return `<div class="gopanel">
    <p>Hawaiʻi State Capitol, 415 S Beretania St, ${esc(roomLabel(h.room))}. ${esc(dateLong(h.scheduled_at))} at ${esc(timeWord(h.scheduled_at))}. Arrive 15 minutes early. Anyone can sit in. To speak, choose <b>In person</b> on the Capitol testimony form.</p>
    <div class="btnrow"><button type="button" class="chip" data-attend="${esc(k)}" aria-pressed="${going}">${icon(going ? 'check' : 'map-pin')}${going ? (held ? 'You went' : 'You plan to go') : 'I plan to go'}</button>
      <a class="btn text sm" href="${map}" target="_blank" rel="noopener">${icon('map')}Map</a></div></div>`;
}

// ---- email the chair ----
// The inline composer that lived here (a draft in the card, "Open in my mail app", "Yes, I sent it") became the email
// walkthrough in pub/helper.js on 9/29 (R-079): the same steps as testimony, then sending by mail app, Gmail or Outlook.
// ---- calendar: a real .ics file (a Blob), two events: the testimony deadline (2-hour alarm) and the hearing ----
function icsFor(b, h) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const esc2 = t => String(t).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const url = `${location.origin}${location.pathname}${billPath(b)}`, short = nick(b) || blurb(b, 60);
  const ev = (uid, start, mins, title, desc, alarm) => ['BEGIN:VEVENT', `UID:${uid}@bills.hiphi.org`, `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start).getTime() + mins * 6e4)}`,
    `SUMMARY:${esc2(title)}`, `DESCRIPTION:${esc2(desc)}`, `LOCATION:${esc2('Hawaiʻi State Capitol, 415 S Beretania St, Honolulu, HI 96813, ' + roomLabel(h.room))}`, `URL:${url}`,
    ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc2(title)}`, 'TRIGGER:-PT2H', 'END:VALARM'] : []), 'END:VEVENT'];
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI//Bill Tracker//EN', 'CALSCALE:GREGORIAN',
    ...(h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? ev(h.id + '-due', h.testimony_deadline, 15, `Testimony due: ${spaced(b.bill_number)} (${short})`, `Send testimony in 5 minutes: ${url}`, true) : []),
    ...ev(h.id + '-hearing', h.scheduled_at, 60, `Hearing: ${spaced(b.bill_number)} (${short})`, `${cmteLabel(h.committee)}. Anyone can attend. ${url}`, false), 'END:VCALENDAR'];
  return new Blob([lines.join('\r\n')], { type: 'text/calendar' });
}
// Written like a friend talking, not a notice (Nate 9/29: "too professional and not encouraging"). acted: sent by someone who
// has just spoken up, so it starts from what they did.
// One share everywhere (R-113, the assessment's P3): the bill's own share page when it has one (billShareUrl: a text or
// a post previews with the bill's name, and the friend's visit counts as a share), the deadline in the words while
// testimony is still open, and the link passed once: the share sheet gets it as the url, the clipboard copy at the end.
export function shareFor(b, h, { acted = false, law = false, differs = false } = {}) {
  const sp = spaced(b.bill_number), name = nick(b), named = name ? `${name} (${sp})` : sp;
  const due = h && h.testimony_deadline && new Date(h.testimony_deadline) > Date.now() ? dueWords(h.testimony_deadline) : '';
  const heard = !due && h && new Date(h.scheduled_at) > Date.now() ? dayWord(h.scheduled_at) : '';
  const when = due ? ` Testimony is due ${due}.` : heard ? ` The committee hears it ${heard}.` : '';
  // The share test (R-135, variant.js 'share'): the 'deadline' version leads with the deadline. Only where there is one to
  // lead with, and then the link says which message it was (?via=share-deadline), so a friend's arrival is credited to it.
  const testing = !law && !!(due || heard), lead = testing && armOf('share') === 'deadline', tag = testing ? shareTag() : '';
  const head = due ? `Testimony on ${named} closes ${due}.` : `The committee hears ${named} ${heard}.`;
  const text = law ? `${differs ? '' : 'Good news: '}${named} ${isResolution(b) ? 'was adopted' : 'is now law in Hawaiʻi'}. ${blurb(b, 110)}`
    : lead && acted ? `${head} I just spoke up, and it took a few minutes. Will you add your voice too? Lawmakers really do notice when lots of us write in.`
    : lead ? `${head} ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')} It takes a few minutes to tell them what you think, and every voice helps.`
    : acted ? `I just spoke up at the Legislature on a bill I care about: ${named}. It only took a few minutes!${when} Will you add your voice too? Lawmakers really do notice when lots of us write in.`
    : `Have you seen this? ${named}: ${blurb(b, 110).replace(/([^.!?…])$/, '$1.')}${when} It only takes a few minutes to speak up, and every voice helps.`;
  const url = tag ? withVia(billShareUrl(b), tag) : billShareUrl(b);
  return { title: name || sp, text, url, copy: `${text} ${url}`, ab: tag ? b.id : '' };
}
// ?via= goes before the address's #/ part (a bill with no share page links straight to the tracker).
const withVia = (u, v) => { const i = u.indexOf('#'), base = i < 0 ? u : u.slice(0, i); return `${base}${base.includes('?') ? '&' : '?'}via=${v}${i < 0 ? '' : u.slice(i)}`; };
// The share itself: the device's share sheet, else the clipboard. 'shared' | 'copied' | '' (closed, or nothing works).
export async function doShare({ title, text, url, copy, ab }) {
  const done = how => { if (how && ab) abSeen('share', { bill: ab }); return how; };   // a share made under the share test (R-135)
  try { if (navigator.share) { await navigator.share({ title, text, url }); return done('shared'); } } catch (e) { if (e?.name === 'AbortError') return ''; }
  try { await navigator.clipboard.writeText(copy || `${text} ${url}`); return done('copied'); } catch { return ''; }
}
// An issue's page shared (R-113: Share on the issue page, "Know someone who cares about <issue>? Send it" at the finale).
// Counted as a share (visit_counts), with no bill to mark. Resolves 'shared' | 'copied' | ''.
export async function shareIssue(i) {
  const n = (i.bill_ids || []).length;
  const text = `${i.name} at the Hawaiʻi Legislature: ${(i.description || '').replace(/([^.!?…])$/, '$1.')} ${n ? `HIPHI is working on ${n} ${n === 1 ? 'bill' : 'bills'} on it. ` : ''}Follow it and we’ll tell you when your voice can count.`.replace(/\s+/g, ' ').trim();
  const how = await doShare({ title: i.name, text, url: issueShareUrl(i), copy: `${text} ${issueShareUrl(i)}` });
  if (how) logAct('share');
  return how;
}
   // the old shape, for anything still asking
const findBH = k => { const [bid, hid] = k.split('|'); const b = [...S.bills, ...Object.values(S.extra), ...((S.featured || {}).bills || []), ...((S.pool || {}).bills || [])].find(x => x.id === bid);
  const h = [...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat()].find(x => x.id === hid); return { b, h }; };
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
  $$('[data-share]').forEach(el => el.onclick = async () => { const k = el.dataset.share, [bid, hid] = k.split('|'), { b, h } = findBH(k); if (!b) return;
    const how = await doShare(shareFor(b, h)); if (how === 'copied') S.chips[k + 'share'] = true;
    if (how && !didKind(b, h, 'share')) await markDone(bid, hid, 'share'); app.render(); });
  $$('[data-go]').forEach(el => el.onclick = () => { const k = el.dataset.go; S.goOpen.has(k) ? S.goOpen.delete(k) : S.goOpen.add(k); app.render(); });
  // "I plan to go" under the ask their profile chose (C1) is that ask taken.
  $$('[data-attend]').forEach(el => el.onclick = async () => { const [bid, hid] = el.dataset.attend.split('|'), on = !S.done.has(doneKey(bid, hid, 'attend'));
    if (on && el.closest('.acard')?.querySelector('[data-asked]')) logAct('ask_acted');
    await markDone(bid, hid, 'attend', on); app.render(); });
  $$('[data-ics]').forEach(el => el.onclick = () => { const k = el.dataset.ics, { b, h } = findBH(k); if (!b || !h) return;
    const url = URL.createObjectURL(icsFor(b, h)), a = document.createElement('a'); a.href = url; a.download = `${b.bill_number}-hearing.ics`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    S.chips[k + 'ics'] = true; app.render(); });
  $$('[data-undo]').forEach(el => el.onclick = async () => { const [bid, hid, kind] = el.dataset.undo.split('|'); await markDone(bid, hid, kind, false); app.render(); });
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
export function nudgeCard(kind = S.nudge, pfx = 'ng') {
  if (!kind) return '';
  // Before the signed-in check: a code (R-155) signs the person in as it turns texts on, and the card says so.
  if (S.nudgeText || S.nudgeSent) return `<div class="card tint nudgecard" role="status">${icon(S.nudgeText ? 'message-square' : 'mail-check')}<div>${alertDoneHTML(S.nudgeText ? { kind: 'phone', phone: S.nudgeText, demo: DEMO } : { kind: 'email', email: S.nudgeSent, demo: DEMO })}</div></div>`;
  if (S.session) return '';
  const nb = S.watch.size, na = myActions().length, ni = followedIssues().length;   // every issue followed, by itself or with its whole category (R-120, Bug 9); issues, not their bills (R-067)
  const email = S.alertMode === 'email', keep = email ? ' Your email also keeps your issues on any device.' : '';
  // The box under it says what arrives (pub/alerts.js), so these lines only say why now, once (A-14).
  const text = kind === 'action' ? `Mahalo for speaking up. Get a heads-up the next time one of your issues needs you.${keep}`
    : kind === 'back' ? `Welcome back. ${ni ? `Your ${ni} issue${ni === 1 ? '' : 's'}` : `Your ${nb} bill${nb === 1 ? '' : 's'}`}${na ? ` and ${na} action${na === 1 ? '' : 's'}` : ''} live in this browser only, and phones clear it after a while.${email ? ' Add your email so they’re still here in January, and to hear when a hearing is set.' : ' Get a text when a hearing is set, so you don’t miss it.'}`
    : `Hearings are set only about two days ahead, so a heads-up matters.${keep}`;
  const b = alertButton(pfx);
  // The sandbox used to show the heading with no box to type in (Nate 9/29: "nowhere to enter an email address"). The form
  // is the same there; nothing is sent or saved in the sandbox.
  return `<section class="card tint nudgecard" aria-labelledby="${pfx}-t">${icon(email ? 'mail-check' : 'message-square')}<div class="ngbody">
    <p class="strong" id="${pfx}-t">${codeStep(pfx) ? 'Check your texts' : 'Get alerts on your issues'}</p><p class="small">${codeStep(pfx) ? 'Type the 6-digit code from the text to turn on alerts.' : text}</p>
    <form class="ngform" id="${pfx}-form" novalidate>${alertFields(pfx, { compact: true })}
      <div class="btnrow">${btn(b.label, { kind: 'primary', sm: true, icon: b.icon, attrs: { type: 'submit' } })}${btn('Not now', { kind: 'text', sm: true, attrs: { 'data-nudgeno': '1' } })}</div></form></div></section>`;
}
// The letter helper passes its own prefix and redraw: its box once looked up 'ng-' ids its copy no longer had, so Text me
// there was never wired (found 10/5 building R-155).
export function wireNudge(root = document, { pfx = 'ng', redraw } = {}) {
  root.querySelectorAll('[data-nudgeno]').forEach(el => el.onclick = e => { e.preventDefault(); const n = (onb().nudgeNo || 0) + 1; onbSet({ nudgeNo: n, nudgeNoAt: new Date().toISOString() }); S.nudge = false; app.render(); });
  const f = root.querySelector('.ngform'); if (!f) return;
  const again = redraw || (() => app.render());
  wireAlertForm(f, { pfx, source: S.nudge === 'action' ? 'action' : 'home', onSwap: again, onDone: r => { if (r.kind === 'phone') S.nudgeText = r.phone; else S.nudgeSent = r.email; again(); } });
}
