// Version 3 (?v3=1, R-362 Part 1): the "one thing" worth doing now, shared by Home (pub/v3/home.js) and This week (pub/v3/week.js).
// act.html's card (one/home.js card() and whenLine(), one/words.js sendBy) with the words ported and the data access rewritten over
// core.js: the soonest open testimony on a bill the person follows, else the top of the ranking behind Find's "Needs voices this week"
// (core.js recommendations, pub/rank.js). One card, one filled button (A-3), the deadline said once in plain words (C-15), and
// "You don't need to go", since most people never knew testimony is written.
//   oneThing()        -> { b, h, kind: 'testimony' | 'email', at, late } | null
//   nextThings(n)     -> the next n after it, the same shape
//   cardHtml(o, opts) -> the card's markup; o null draws the calm "nothing this week" card. opts.hl: the heading's tag ('h3')
//   wireCard(root)    -> its button opens the letter (app.openLetter2), else today's walkthrough (app.openHelper / app.openMail)
import { S, app, esc, icon, nick, blurb, spaced, billPath, posInfo, issuesOf, issueFollowed, openActions, recommendations, settledOn, didKind, agrees,
  dismissed, anyBill, anyHearing, testimonyDraft, stopOf, cmteLabel, cmtesOf, codesOf, dateLong, timeWord, hstDay, HST, sessionInfo, CHAMBER_NAME } from '../core.js';
import { btn } from '../ui.js';

// ---- which ----
const DAY = 864e5;
const isoOf = (h, kind, st) => kind === 'testimony' ? (h.testimony_deadline || h.scheduled_at) : st?.deadline && !st.deadline.missed ? st.deadline.date + 'T12:00:00-10:00' : null;
// The followed bills' open testimony, soonest first (openActions sorts it), not late, not already done, not against what they said.
function followed() {
  return openActions(S.bills || [], S.hearings || [])
    .filter(x => !x.late && S.watch.has(x.b.id) && !settledOn(x.b, x.h) && agrees(x.b) !== false)
    .map(x => ({ b: x.b, h: x.h, kind: 'testimony', at: isoOf(x.h, 'testimony'), late: false }));
}
// Find's ranking (rank.js): a hearing with testimony still open is a letter; a bill waiting in a committee with no hearing set is the
// chair's email. Anything put aside ("Not for me"), done, or against their own stance is left out.
function ranked() {
  const skip = dismissed(), now = Date.now(), out = [];
  for (const r of recommendations(200)) {
    const b = r.b, st = r.st || stopOf(b), h = r.hearing || (st.hearingState === 'scheduled' ? st.hearing : null);
    if (skip.has(b.id) || agrees(b) === false || !posInfo(b)) continue;
    if (h) {
      if (Date.parse(h.scheduled_at) <= now || (h.testimony_deadline && Date.parse(h.testimony_deadline) <= now) || settledOn(b, h)) continue;
      out.push({ b, h, kind: 'testimony', at: isoOf(h, 'testimony'), late: false });
    } else if (st.phase === 'committee' && st.committee && (!st.hearingState || st.hearingState === 'none') && !(st.deadline && st.deadline.missed)) {
      if (didKind(b, null, 'email')) continue;
      out.push({ b, h: null, kind: 'email', at: isoOf(null, 'email', st), late: false, code: st.committee });
    }
  }
  return out;
}
// Followed first, then the ranking, each bill once. Nothing between sessions: no bill moves then (calm Home's offSession words say so).
function all() {
  if (sessionInfo().phase !== 'in') return [];
  const seen = new Set(), out = [];
  for (const o of [...followed(), ...ranked()]) if (!seen.has(o.b.id)) { seen.add(o.b.id); out.push(o); }
  return out;
}
export const oneThing = () => all()[0] || null;
export const nextThings = (n = 1) => all().slice(1, 1 + n);

// ---- words (one/words.js sendBy, on Date.now and core's Hawaiʻi day) ----
const noon = day => new Date(day + 'T12:00:00-10:00').getTime();
const daysFrom = iso => Math.round((noon(hstDay(iso)) - noon(hstDay(Date.now()))) / DAY);
const dayShort = iso => new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
const whenWord = iso => { const d = daysFrom(iso); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : d > 1 && d < 7 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' }) : dayShort(iso); };
// "Send testimony by today 9:30 AM", "by tomorrow 1:00 PM", "by Wed 9:30 AM" within six days, "by Wed, Mar 25, 9:30 AM" beyond. Amber
// only inside 24 hours (A-5).
export function sendBy(iso) {
  const d = daysFrom(iso), time = timeWord(iso), left = Date.parse(iso) - Date.now();
  return { text: d >= 0 && d < 7 ? `Send testimony by ${whenWord(iso)} ${time}` : `Send testimony by ${dayShort(iso)}, ${time}`, soon: left > 0 && left < DAY };
}
const COUNT = ['', 'One', 'Two', 'Three', 'Four'];
// Who meets on it and when, by name (C-15: "Committee" in a sentence, no codes), and that no one has to go.
function meets(h) {
  const date = dateLong(h.scheduled_at), cs = cmtesOf(h.committee), n = codesOf(h.committee).length;
  const who = n > 1 && cs.length ? `${COUNT[n] || n} ${CHAMBER_NAME[cs[0].chamber] || ''} committees meet`.replace(/\s+/g, ' ')
    : cs.length ? `The ${cmteLabel(h.committee)} meets` : 'The committee meets';
  return `${who} on it ${date}. You don’t need to go.`;
}
function whenLine(o) {
  if (o.kind === 'testimony' && o.h) { const by = sendBy(o.at); return { soon: by.soon, html: `<b>${esc(by.text)}.</b> ${esc(meets(o.h))}` }; }
  return { soon: false, html: esc(o.at ? `No hearing yet. The chairs have until ${dateLong(o.at)}.` : 'No hearing yet. Ask the chair for one.') };
}
// The summary's first sentence: the card says what the bill does in one line; the bill page has the rest.
const firstSentence = s => (String(s || '').match(/^.*?[.!?](?=\s|$)/) || [String(s || '')])[0].trim();

// ---- the card ----
export function cardHtml(o, { hl = 'h3' } = {}) {
  const H = /^h[2-4]$/.test(hl) ? hl : 'h3';
  if (!o) return `<section class="card v3-card v3-empty"><p class="v3c-calm">Nothing needs your voice this week. We’ll say when something does.</p>
    <a class="v3c-link" href="#/find">See the bills${icon('arrow-right', { size: '1em' })}</a></section>`;
  const { b } = o, testimony = o.kind === 'testimony' && !!o.h, w = whenLine(o), p = posInfo(b), name = nick(b), id = `v3c-${String(b.id).replace(/[^\w-]/g, '')}`;
  const sum = name ? firstSentence(blurb(b, 400)) : '';
  return `<section class="card v3-card" aria-labelledby="${id}">
    <p class="v3c-meta"><span class="v3c-num">${esc(spaced(b.bill_number))}</span>${p ? `<span class="v3c-pos">${icon(p.icon, { size: '1em' })}${esc(p.text)}</span>` : ''}</p>
    <${H} class="v3c-h" id="${id}"><a href="${esc(billPath(b))}">${esc(name || blurb(b) || spaced(b.bill_number))}</a></${H}>
    ${sum ? `<p class="v3c-sum">${esc(sum)}</p>` : ''}
    <p class="v3c-when${w.soon ? ' soon' : ''}">${icon('clock')}<span>${w.html}</span></p>
    ${btn(testimony ? 'Send testimony' : 'Email the chair', { kind: 'primary', icon: testimony ? 'notebook-pen' : 'mail', full: true, cls: 'v3c-go', attrs: { 'data-v3go': `${b.id}|${o.h?.id || ''}|${testimony ? 'testimony' : 'email'}|${o.code || ''}` } })}
    <p class="v3c-time small">${testimony ? 'About 10 minutes. We help you write it.' : 'About 2 minutes. We help you write it.'}</p>
  </section>`;
}

// The button: the letter in three screens (pub/v2/letter.js, which v3 borrows) when it opens; until then, or when it cannot (an
// email to a chair with no hearing has none to hang on), today's walkthroughs, as calm Home's wireWeek falls back to them.
export function wireCard(root) {
  (root || document).querySelectorAll('[data-v3go]').forEach(el => { el.onclick = () => {
    const [bid, hid, kind, code] = el.dataset.v3go.split('|'), b = anyBill(bid); if (!b) return;
    if (kind === 'testimony') {
      const h = anyHearing(hid), o = { hearing: hid, ...(testimonyDraft(h) ? { resume: true } : {}) };
      Promise.resolve(app.openLetter2 ? app.openLetter2(b, 'testimony', o) : false).then(ok => { if (!ok && !S.helper) app.openHelper(bid, hid); }).catch(e => { console.error(e); app.openHelper(bid, hid); });
    } else app.openMail?.({ mode: 'email', bill: bid, code: code || stopOf(b).committee });
  }; });
}
// (issuesOf and issueFollowed are here for Home and This week, which group the one thing with its issue.)
export const issueOfThing = o => o ? issuesOf(o.b).find(issueFollowed) || issuesOf(o.b)[0] || null : null;
