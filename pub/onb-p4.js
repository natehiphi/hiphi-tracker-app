// Plan 4, "How you like to help" (R-164; pub/plans.js has its steps, pub/onb.js the screens the plans share). The doc
// "Onboarding: five plans": the first question is about the person, not the bills, and the answer shapes what comes after
// it (Nate's 9/26 pick, "choose the ways you're willing to help"). Its two own screens:
//   way    the arrival: what this is in one line (C-11), then "Everyone helps differently. Which sounds like you?" with
//          four cards, pick any or none (C-2). Kept in hiphi_wiz as ways: ['posted', 'write', 'speak', 'friends'].
//   first  after the sign-up: one first step sized to the most active way they picked (write > speak > friends > posted;
//          A-3, one primary): kept posted, nothing more to do; a writer starts their letter with one sentence of their
//          own; a speaker gets a one-minute look at a hearing and a reminder for the next one on their issues; a friend-
//          bringer sends one friend a note. "Not now" always moves on (P-5). Each done step gets a small burst (C-7).
// The ending ('wrap', onb.js) says "You help by ..." from S.obWay: what the person does, never a label for who they are
// (the doc's risk: the names must never read like a test result).
import { S, DEMO, app, esc, icon, nick, spaced, sessionInfo, wiz, wizSet, HST, anyBill, issueBills, followedIssues, calendarUrl, issueShareUrl, cmteLabel } from './core.js';
import { shell, topRow, bar1, bar2, sayRow, sureWide, isOff, planOn, goStep, track, pickedIssues, ranker, plural, andList, shortDay, partnerLine } from './start.js';
import { btn } from './ui.js';
import { CAPITOL, VOICES } from './art.js';
import { burst, later, reduced } from './fx.js';
import { logAct } from './visitlog.js';
import { myInterests, saveProfile, storyFor, storyAsk, saveStory, signedIn } from './myprofile.js';
import { PLAN_SURE } from './plans.js';
import { alertStatus } from './alerts.js';

export const STEPS = ['way', 'first'];

// ---------- the four ways ----------
// Each says what it means in practice and roughly how long it takes, so a pick is an honest promise (P-5). The names are
// what the person would say about themselves, in their own voice, so none reads like a box they were sorted into.
// phrase: the ending's "You help by ..." line; also: how the first step names a way it did not lead with.
const WAYS = [
  { k: 'posted', ic: 'bell', name: 'Keep me posted', what: 'Hear when bills on your issues move.', time: 'A quick read', phrase: 'keeping up with your issues' },
  { k: 'write', ic: 'notebook-pen', name: 'I’ll send a note when it counts', what: 'A short note to lawmakers when a bill needs voices. We help you write it.', time: 'A few minutes', phrase: 'writing a note when it counts', also: 'sending a note' },
  { k: 'speak', ic: 'mic', name: 'I’d speak at a hearing', what: 'A minute or two in front of a committee, at the Capitol or on Zoom.', time: 'An hour or so, with the wait', phrase: 'speaking at hearings', also: 'speaking at a hearing' },
  { k: 'friends', ic: 'users', name: 'I’ll bring friends', what: 'Pass a bill or an issue on to people who care.', time: 'About a minute', phrase: 'bringing friends along', also: 'bringing friends' },
];
const WAY = Object.fromEntries(WAYS.map(w => [w.k, w]));
// The first step follows the most active way picked (write > speak > friends > posted). Nothing picked is treated as
// "keep me posted", the gentlest, without saying they picked it.
const ORDER = ['write', 'speak', 'friends', 'posted'];
const ways = () => { const w = wiz().ways; return Array.isArray(w) ? w.filter(k => WAY[k]) : []; };
const leadWay = () => ORDER.find(k => ways().includes(k)) || 'posted';

// "You help by writing a note when it counts and speaking at hearings": every way picked, in the first step's order;
// "keeping up with your issues" only when it is the only one (everyone who follows an issue is kept posted). Nothing
// picked: no line at all.
function wayPhrase() {
  const w = ORDER.filter(k => ways().includes(k)), act = w.filter(k => k !== 'posted');
  return andList((act.length ? act : w).map(k => WAY[k].phrase)) || null;
}
// The ending reads S.obWay; it is kept with the first visit too, so a reload on the ending still says it.
function setWay() { S.obWay = planOn() === 'p4' ? wayPhrase() : null; wizSet({ obWay: S.obWay }); }
if (planOn() === 'p4' && S.obWay == null && wiz().obWay) S.obWay = wiz().obWay;

// "I'd speak at a hearing" is the profile's "I'd testify in person" (R-156 C1): saying it here sets that, so bill pages
// offer "When and where to go" and the testimony walkthrough says to pick In person (C-13: the answer visibly changes
// what comes next), and the ending's "Change it any time on your profile" is true. Only what this screen added is taken
// back when the pick is undone. It stays on this device unless the person is signed in (myprofile.js saveProfile).
function syncSpeak() {
  const want = ways().includes('speak'), has = myInterests().includes('testify');
  if (want && !has) { wizSet({ ob4Testify: true }); saveProfile({ interests: [...myInterests(), 'testify'] }).catch(e => console.error(e)); }
  else if (!want && has && wiz().ob4Testify) { wizSet({ ob4Testify: false }); saveProfile({ interests: myInterests().filter(k => k !== 'testify') }).catch(e => console.error(e)); }
}

// ================= way: how do you like to help? =================
// The arrival screen, so it says what this is first (C-11), then the one question (C-2). The cards are real toggles with
// a square tick (multi-select, A-12), the topic tiles' own parts; Skip and Next both move on, and there is no "pick at
// least one": any answer is a good answer, none included.
function stepWay(step) {
  const on = new Set(ways()), sure = PLAN_SURE.p4 || 'About 2 minutes. Free.';
  return shell('ob4-way', `${topRow('way', step)}${partnerLine()}<div class="st-art">${VOICES}</div>
    <p class="ob4-kick">HIPHI follows the health bills at the Hawaiʻi Legislature.</p>
    <h1 class="hero" id="st-h">Everyone helps differently. Which sounds like you?</h1>
    <p class="lede">Pick any, or none. We’ll fit your first step to how you like to help.</p>${sureWide('clock', sure)}`,
    `${sayRow('clock', sure)}<div class="st-tiles ob4-ways" role="group" aria-labelledby="st-h">${WAYS.map(w => `<button type="button" class="st-issue st-tile ob4-tile" data-ob4way="${w.k}" aria-pressed="${on.has(w.k)}">
      <span class="st-ilead">${icon(w.ic)}</span><span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="ob4-tbody"><span class="st-iname">${esc(w.name)}</span><span class="ob4-what">${esc(w.what)}</span>
      <span class="ob4-time">${icon('clock')}<span>${esc(w.time)}</span></span></span></button>`).join('')}</div>
    <p class="sr" aria-live="polite" id="ob4-said"></p>`);
}
function wireWay({ step, $, $$ }) {
  $$('[data-ob4way]').forEach(el => el.onclick = () => {
    const on = el.getAttribute('aria-pressed') !== 'true', set = new Set(ways());
    el.setAttribute('aria-pressed', String(on));
    if (on) set.add(el.dataset.ob4way); else set.delete(el.dataset.ob4way);
    wizSet({ ways: WAYS.map(w => w.k).filter(k => set.has(k)) });
    const t = el.querySelector('.st-tick'); if (t && on && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
    const said = $('#ob4-said'); if (said) said.textContent = set.size ? `${plural(set.size, 'way')} picked` : 'None picked';
  });
  const go = () => { setWay(); syncSpeak(); goStep(step, step + 1); };
  // Skip goes on with no ways, whatever was ticked (Skip means "not this"); Next keeps what is ticked, even nothing (C-2).
  // Both are assigned after the frame's handlers, so they replace them.
  const sk = $('[data-stskip]'); if (sk) sk.onclick = () => { track('way', 'skip'); wizSet({ ways: [] }); go(); };
  const nb = $('[data-stnext]'); if (nb) nb.onclick = () => { track('way', 'next'); go(); };
}

// ================= first: a first step sized to their way =================
// What was done here in this page's life, by way, so Back and a redraw show it done (B-4); the writer's typing is kept the
// same way, so Back never loses it (C-9).
S.ob4 ??= { done: {}, draft: null };
// "We'll tell you" only once alerts are on or almost set by the one rule (alerts.js alertStatus, D1-4).
const told = () => ['on', 'almost'].includes(alertStatus().key);
const dayLong = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
const catName = k => (S.cats || []).find(c => c.key === k)?.name || '';
// An issue's hearings as a calendar feed (R-125). The sandbox's calendarUrl opens the issue page instead, which would
// leave the first visit, so there it is the feed's own file in this folder (the one the live site serves).
const feedUrl = i => DEMO ? `cal/${i.slug}.ics` : calendarUrl(i);
// The bill-level helpers (the calendar file, the share sheet) are in actions.js, loaded as the step is drawn: the share
// sheet has to open inside the tap, with no download in between.
let ACT = null;
const actLoad = () => ACT ? Promise.resolve(ACT) : import('./actions.js').then(m => (ACT = m));

// The soonest hearing ahead on a bill of an issue they follow (the first visit's own ranker: the next two weeks).
function nextHearing() {
  if (isOff()) return null;
  const R = ranker(); let best = null;
  for (const i of followedIssues()) for (const id of issueBills(i)) {
    const h = R.soon.get(id); if (!h || (best && h.scheduled_at >= best.h.scheduled_at)) continue;
    const b = anyBill(id); if (b) best = { i, b, h };
  }
  return best;
}
// The topic a writer's sentence is kept for: that of the first issue they follow, else the first topic they picked. A
// story is kept per topic (R-156 B3), so it opens a letter on that topic and never one on another.
function storyTopic() {
  const f = followedIssues()[0], c = f ? (f.categories || [f.category]).find(k => catName(k)) : '';
  return c || pickedIssues().map(x => x.topicKey).find(k => catName(k)) || '';
}
// The other ways they picked, named once and quietly (A-3: the first step has one primary).
function alsoLine(k) {
  const o = ORDER.filter(x => x !== k && x !== 'posted' && ways().includes(x));
  return o.length ? `<p class="ob4-also">${icon('heart-handshake')}<span>You also picked ${esc(andList(o.map(x => WAY[x].also)))}. Each bill’s page shows how, when a bill needs it.</span></p>` : '';
}
// What a done step says, a green tick and the words (A-16): a card of its own, or a line inside the card it belongs to.
// sub is HTML (escaped by the caller).
const doneLine = (title, sub = '', cls = 'ob4-doneline') => `<div class="${cls}" role="status"><span class="ob4-doneic" aria-hidden="true">${icon('check')}</span>
  <div><p class="strong">${esc(title)}</p>${sub ? `<p class="small">${sub}</p>` : ''}</div></div>`;
const doneCard = (title, sub = '') => doneLine(title, sub, 'card ob4-done');
// After a step is done: the screen is drawn again with it done, brought into view above the bar if it is under it, and
// the small burst lands on its tick (C-7).
function showDone() {
  app.render();
  later(() => {
    const ic = document.querySelector('.ob4-doneic'), box = ic?.parentElement; if (!box) return;
    const r = box.getBoundingClientRect();
    if (r.bottom > window.innerHeight - 96 || r.top < 64) box.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
    later(() => burst(ic, 14, 52), r.bottom > window.innerHeight - 96 ? 320 : 0);
  }, 60);
}

// ---- kept posted: following is the whole step ----
function firstPosted(step) {
  const f = followedIssues(), i = f[0];
  const when = told() ? 'When a bill on your issues gets a hearing, we’ll tell you.' : 'When a bill on your issues moves, your home page shows it.';
  return shell('ob4-first', `${topRow('first', step)}<div class="st-art">${CAPITOL}</div>
    <h1 class="hero" id="st-h">We’ll keep you posted</h1>
    <p class="lede">${f.length ? when : 'Follow an issue any time from Find, and your home page will show when its bills move.'}</p>`,
    f.length ? `<section class="card ob4-follows" aria-labelledby="ob4-fh"><h2 class="ob4-h2" id="ob4-fh">You follow ${esc(plural(f.length, 'issue'))}</h2>
      <ul class="ob4-list" role="list">${f.slice(0, 6).map(x => `<li>${icon('star')}<span>${esc(x.name)}</span></li>`).join('')}</ul>
      ${f.length > 6 ? `<p class="small muted">And ${f.length - 6} more, in My issues.</p>` : ''}</section>
      <p class="ob4-light">${icon('calendar-plus')}<span>Like a calendar? Hearings on “${esc(i.name)}” can go straight into yours. ${btn('Add to my calendar', { kind: 'text', sm: true, href: feedUrl(i), attrs: { 'data-ob4feed': '1' } })}</span></p>` : '');
}

// ---- a writer: the first sentence of their first letter ----
// The story's own question for the topic (myprofile.js STORY_ASK: a moment from their life, not an argument), kept with
// the profile's story, which every letter's "why" starts from (helper.js storyFor).
function firstWrite(step) {
  const t = storyTopic(), name = catName(t), done = S.ob4.done.write;
  const text = S.ob4.draft ?? storyFor(t ? [t] : [])?.text ?? '';
  const where = `${signedIn() ? 'It’s kept in your profile' : 'It stays on this device'}, only for your own letters. You can change it in any letter.`;
  return shell('ob4-first', `${topRow('first', step)}<div class="st-art">${CAPITOL}</div>
    <h1 class="hero" id="st-h">${done ? 'Your letter has a start' : 'Start your letter'}</h1>
    <p class="lede">${done ? `When a bill ${name ? `on ${esc(name)} ` : ''}needs voices, your letter will open with your own words.`
      : `When a bill ${name ? `on ${esc(name)} ` : ''}needs voices, your letter will start with your own words. A personal reason carries the most weight with lawmakers.`}</p>`,
    done ? `${doneCard('Saved for your first letter', `“${esc(done)}”`)}<p class="ob4-keep">${icon('lock')}<span>${esc(where)}</span></p>${alsoLine('write')}`
      : `<form class="card ob4-card" id="ob4-story" novalidate><div class="field">
        <label for="ob4-why">${esc(storyAsk(t))}</label>
        <textarea id="ob4-why" rows="3" maxlength="600" aria-describedby="ob4-why-h ob4-why-k" autocapitalize="sentences">${esc(text)}</textarea>
        <span class="help" id="ob4-why-h">One sentence is plenty. You don’t have to share health details to be heard.</span></div>
        <p class="ob4-keep" id="ob4-why-k">${icon('lock')}<span>${esc(where)}</span></p></form>${alsoLine('write')}`);
}
async function saveWrite(step) {
  const v = (document.getElementById('ob4-why')?.value || '').trim();
  if (!v) { track('first', 'skip'); goStep(step, step + 1); return; }   // nothing written: the same as Not now (C-2)
  try { await saveStory(storyTopic(), v); } catch (e) { console.error(e); }
  S.ob4.done.write = v.slice(0, 600); S.ob4.draft = null;
  showDone();
}

// ---- a speaker: what a hearing is like, and a reminder for the next one ----
// Three lines, the same facts the app says elsewhere (actions.js "To speak", talk-data.js, the hearing lesson), and the
// drawn lesson one tap away for the whole minute (#/learn/hearing comes back here when it is done).
const LOOK = [
  ['landmark', 'A committee, a few lawmakers, hears from the public before it votes on a bill.'],
  ['notebook-pen', 'To speak, pick In person or Zoom when you send your testimony on the Capitol’s form.'],
  ['mic', 'When your name is called, you get a minute or two. Say who you are and why it matters to you.'],
];
function firstSpeak(step) {
  const n = nextHearing(), done = S.ob4.done.speak, i = followedIssues()[0], open = sessionInfo().nextOpen;
  const look = `<ol class="ob4-look" role="list">${LOOK.map(([ic, s]) => `<li><span class="ob4-lookic" aria-hidden="true">${icon(ic)}</span><span>${esc(s)}</span></li>`).join('')}</ol>
    <p class="ob4-learn">${btn('See a hearing, step by step', { kind: 'text', sm: true, icon: 'play', href: '#/learn/hearing' })}</p>`;
  let when;
  if (n) {
    const name = nick(n.b) || spaced(n.b.bill_number);
    // The issue is named above the bill unless they are the same words (A-14: say it once).
    const same = n.i.name.trim().toLowerCase() === name.trim().toLowerCase();
    when = `<article class="card ob4-hear" aria-labelledby="ob4-hh"><p class="ob4-kick2">${icon('calendar')}<span>${same ? 'The next hearing on your issues' : `Next hearing on ${esc(n.i.name)}`}</span></p>
      <h2 class="ob4-h2" id="ob4-hh">${esc(name)}</h2>
      <p class="small">${esc(spaced(n.b.bill_number))} · ${esc(cmteLabel(n.h.committee) || 'A committee')} hears it ${esc(dayLong(n.h.scheduled_at))} at ${esc(timeOf(n.h.scheduled_at))}.</p>
      ${done ? doneLine('Reminder ready', 'Open the calendar file to add it. It also says when testimony is due.') : ''}</article>`;
  } else {
    // Between sessions, or a quiet fortnight: when hearings come, and the issue's own calendar feed as the reminder.
    const say = isOff() && open ? `Hearings start after the session opens on ${esc(shortDay(open))}.` : 'No hearing is set on your issues in the next two weeks.';
    const next = i ? `${told() ? 'We’ll tell you' : 'Your home page will show you'} when one on “${esc(i.name)}” is set, usually a few days ahead.` : 'Follow an issue, and your home page will show its hearings, usually a few days ahead.';
    when = `<section class="card ob4-hear" aria-labelledby="ob4-hh"><h2 class="ob4-kick2" id="ob4-hh">${icon('calendar')}<span>When you can go</span></h2><p class="small">${say} ${next}</p>
      ${i ? `<p class="ob4-light">${icon('calendar-plus')}<span>Want them in your calendar as they’re set? ${btn('Add to my calendar', { kind: 'text', sm: true, href: feedUrl(i), attrs: { 'data-ob4feed': '1' } })}</span></p>` : ''}</section>`;
  }
  return shell('ob4-first', `${topRow('first', step)}<div class="st-art">${CAPITOL}</div>
    <h1 class="hero" id="st-h">What a hearing is like</h1>
    <p class="lede">A one-minute look, so your first time feels familiar.</p>`,
    `${look}${when}${alsoLine('speak')}`);
}
function addReminder() {
  const n = nextHearing(); if (!n || !ACT) return;
  try { ACT.downloadIcs(n.b, n.h); logAct('calendar'); } catch (e) { console.error(e); return; }
  S.ob4.done.speak = true; showDone();
}

// ---- a friend-bringer: one note, to one person ----
// Shown before it goes (nothing is sent unseen, P-5), sent by the phone's own share sheet or copied (actions.js doShare),
// and counted as a share like every other (visitlog 'share'). The link is the issue's share page, which previews with the
// issue's name; with no issue followed, the tracker itself.
function shareMsg() {
  const i = followedIssues()[0];
  const url = i ? issueShareUrl(i) : DEMO ? `${location.origin}${location.pathname}?demo=1` : `${location.origin}${location.pathname}?via=share`;
  const text = `I just started following ${i ? `“${i.name}”` : 'health bills'} at the Hawaiʻi Legislature with HIPHI’s free bill tracker. It tells you when a bill gets a hearing and helps you speak up in a few minutes. Want to join me?`;
  return { i, url, text, title: i ? i.name : 'HIPHI Bill Tracker' };
}
function firstFriends(step) {
  const m = shareMsg(), done = S.ob4.done.friends;
  return shell('ob4-first', `${topRow('first', step)}<div class="st-art">${VOICES}</div>
    <h1 class="hero" id="st-h">Bring one friend along</h1>
    <p class="lede">Think of one person who’d want to know. We wrote a short note you can send them.</p>`,
    `<figure class="ob4-msg"><figcaption class="ob-samplecap">${icon('message-square')}<span>Your note</span></figcaption>
      <p class="ob-bubble">${esc(m.text)} <span class="ob-link">${esc(m.url.replace(/^https?:\/\//, '').replace(/\?[^#]*/, ''))}</span></p></figure>
    ${done === 'shared' ? doneCard('Sent. Mahalo for bringing a friend!') : done === 'copied' ? doneCard('Copied', 'Paste it into a text or an email to one friend.') : ''}${alsoLine('friends')}`);
}
async function sendFriend() {
  const m = shareMsg(); if (!ACT) { await actLoad().catch(() => null); if (!ACT) return; }
  const how = await ACT.doShare({ title: m.title, text: m.text, url: m.url, copy: `${m.text} ${m.url}` });
  if (!how) return;   // the share sheet was closed: nothing changes, and they can try again
  logAct('share');
  S.ob4.done.friends = how; showDone();
}

// ---- the step, by way ----
const FIRST = { posted: firstPosted, write: firstWrite, speak: firstSpeak, friends: firstFriends };
function wireFirst({ step, fresh, next, $, $$ }) {
  if (fresh) setWay();   // also covers a reload straight onto this step
  const k = leadWay();
  if (k === 'speak' || k === 'friends') actLoad().catch(e => console.error(e));
  const nb = $('[data-stnext]'); if (nb) nb.onclick = next;   // the frame wires Skip and Back; Next is each step's own
  const go = $('[data-ob4go]');
  if (go) go.onclick = () => { if (k === 'write') saveWrite(step); else if (k === 'speak') addReminder(); else if (k === 'friends') sendFriend(); };
  const ta = $('#ob4-why');
  if (ta) { ta.oninput = () => { S.ob4.draft = ta.value; }; $('#ob4-story').onsubmit = e => { e.preventDefault(); saveWrite(step); }; }
  $$('[data-ob4feed]').forEach(a => a.addEventListener('click', () => logAct('calendar')));
}
// "Not now" is a full button the size of the main one (P-5: no pressure to take the first step today; the frame's Skip
// handler moves on). Once the step is done, or when there is nothing to do, one Next.
const barTwo = (label, ic) => `<div class="st-bar"><div class="st-btns ob4-btns">${btn('Not now', { kind: 'secondary', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', icon: ic, attrs: { 'data-ob4go': '1' } })}</div></div>`;
function barFirst() {
  const k = leadWay();
  if (k === 'write' && !S.ob4.done.write) return barTwo('Save my words', 'check');
  if (k === 'speak' && !S.ob4.done.speak && nextHearing()) return barTwo('Add a reminder', 'calendar-plus');
  if (k === 'friends' && !S.ob4.done.friends) return barTwo('Send my note', 'send');
  return bar1('Next', 'arrow-right');
}

// ---------- the dispatch onb.js calls ----------
export function renderStep(name, step) { return name === 'way' ? stepWay(step) : FIRST[leadWay()](step); }
export function wireStep(name, ctx) { if (name === 'way') wireWay(ctx); else wireFirst(ctx); }
export function barStep(name) { return name === 'way' ? bar2('Next', { iconEnd: 'arrow-right' }) : barFirst(); }
