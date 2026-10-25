// "A new draft" on My issues and the issue page (R-212 Tier 2 #50, Nate's yes of 25 Oct). The Legislature renames a bill
// each time a committee amends it (bills.current_version: "HD2"), and HIPHI says in plain words what each draft changed
// (R-060, the bill page's "What each draft changed"). Only the bill page's last folds said so: a follower learned that a bill
// they care about had changed at its next hearing's walkthrough, sometimes holding a letter written for the old draft
// (R-148). In the walks the Capitol Regular and the Clinician wanted to know before they write or speak again. So a row
// whose bill has a new draft gets one quiet line, its own link to the bill's drafts (#/bill/<year>/<NUM>/changes, bill.js
// openAsk), in the same words on both pages.
import { S, HST, hstDay, hiT, spaced, billPath, sessionInfo, issueBills, esc, icon, alive } from './core.js';
import { draftName, draftRank, letterOn } from './letters.js';
import { keep } from './rec/kit.js';

const DAY = 864e5;
const VER = /^(HD|SD|CD|FD)(\d+)$/;
// A draft as the record writes it: "HD 2", "HD2", "(SD 1)", "in amended form (SD 2)", "as amended in (CD 1)"; never HD 21
// for HD2.
const nameRe = v => { const m = VER.exec(v || ''); return m ? new RegExp(`\\b${m[1]} ?${m[2]}(?!\\d)`) : null; };
// Only a committee's report makes a draft: "Reported from CPC (Stand. Com. Rep. No. 1058-26) as amended in HD 2, ...",
// "Reported from Conference Committee ... as amended in (CD 1)". The lines after it name the same draft again (the floor
// votes, "Received from Senate ... in amended form (SD 1)", "48 Hrs. Notice (as amended CD 1)"), so a draft first named on
// one of those was made before the lines in hand, and its day is not one we could stand behind. In the 2026 record every
// bill's current draft was named by exactly one day's report line (2,514 bills; 15 of 2,529 by none, which simply never
// count as new).
const MADE = /^\s*Reported from\b/i;
// A rank for a letter's draft: "As introduced" ('') comes before every draft (letters.js rankOf).
const rank = (b, v) => v ? draftRank(b, v) + 100 : 0;

// The official lines in hand per bill. S.activity (core.js loadBills) is the public_activity view: the official lines of
// the last 30 days for the bills followed, newest first, 300 at most in all; the practice copy has all of its frozen lines.
let byBill = null, from = null;
const linesOf = id => {
  if (from !== S.activity) { byBill = new Map(); from = S.activity; for (const a of S.activity || []) { const l = byBill.get(a.bill_id); if (l) l.push(a); else byBill.set(a.bill_id, [a]); } }
  return byBill.get(id) || [];
};

// When the official record first names the bill's draft v, as an ISO time, or null when we did not see it change. The
// honesty rule (a number a careful person would quote, R-212 finding 2): the draft has a day only if we saw the change,
// that is, its report line is in hand and so is a line from before it. A bill whose earliest line in hand already names
// the draft (made before our 30 days, or the 300 cap cut the lines before it) has no day, and is not new. A false "new" is
// worse than a missed one.
export function draftSeen(b, v = b?.current_version) {
  const re = nameRe(v); if (!b || !re) return null;
  const now = Date.now(), lines = linesOf(b.id).filter(a => Date.parse(a.occurred_at) <= now);
  const named = lines.filter(a => re.test(a.title || '') || re.test(a.details || '')); if (!named.length) return null;
  const first = Math.min(...named.map(a => Date.parse(a.occurred_at)));
  if (!lines.some(a => Date.parse(a.occurred_at) < first)) return null;   // the change itself is not in what we have
  if (!named.some(a => Date.parse(a.occurred_at) === first && MADE.test(a.title || ''))) return null;   // a repeat, not the report
  return new Date(first).toISOString();
}

// How far back "new" reaches: the last 7 days, or back to the person's last visit when that was longer ago (S.prevVisit, as
// Home's dot for "new since your last visit"), never more than 30 days (what the record in hand covers). Date.now() is the
// practice copy's frozen clock there (kernel.js), as everywhere on Home.
export function sinceWhen() {
  const now = Date.now(), week = now - 7 * DAY, p = S.prevVisit ? Date.parse(S.prevVisit) : 0;
  return p && p < week ? Math.max(p, now - 30 * DAY) : week;
}

// A followed bill's new draft, or null. { b, v: 'HD2', name: 'House draft 2', at: ISO time or null, letter }. letter: the
// person's kept testimony letter on this bill (R-148) was written for an earlier draft; then the bill counts whatever the
// day (their words were written for a draft that no longer exists, until they send a letter on this one), and at may be
// null. A twin's letter does not count: it never named this bill's drafts. Nor does a letter on a bill that can no longer
// move (law, at the Governor, held, did not advance): no letter can be sent on it again, and the line would stay all session.
// In session only: between sessions no bill moves.
export function newDraft(b) {
  if (!b || !S.watch?.has(b.id) || sessionInfo().phase !== 'in') return null;
  const v = b.current_version || ''; if (!VER.test(v)) return null;
  const at = draftSeen(b, v), t = at ? Date.parse(at) : 0;
  const L = letterOn(b, 'testimony'), letter = !!L && L.bill === b.id && alive(b) && rank(b, L.draft || '') < rank(b, v);
  if (!letter && !(t && t >= sinceWhen() && t <= Date.now())) return null;
  return { b, v, name: draftName(v), at, letter };
}

// A committee "passed it with changes" (Home's RESULT, core.js's "passed it with changes"); never HIPHI's "supports with
// changes", which is a position, not an amendment.
const AMENDED = /\bpassed\b[^·]*\bwith changes\b/i;
// The draft is the one that decision made: a passed-with-changes decision on this bill in Home's 14 days, on or before the
// draft's day (the report comes days after the vote). A decision after the draft is a newer change still to come.
const madeBy = (b, at) => { if (!at) return false; const day = hstDay(at), now = Date.now();
  return Object.values(S.outcomes || {}).some(o => o.bill_id === b.id && o.outcome === 'passed_amended'
    && (t => t > now - 14 * DAY && hstDay(t) <= day)(Date.parse(o.reported_at || o.scheduled_at || 0))); };

// A row's new drafts: a bill row's bill, or each followed bill of an issue row (Home's rows, calm/home.js myRows), the ones
// written after a letter first, then the newest.
export function rowDrafts(r) {
  const bills = r?.b ? [r.b] : r?.i ? (ids => S.bills.filter(b => ids.has(b.id)))(new Set(issueBills(r.i))) : [];
  return bills.map(newDraft).filter(Boolean)
    .sort((x, y) => (y.letter - x.letter) || String(y.at || '').localeCompare(String(x.at || '')) || x.b.bill_number.localeCompare(y.b.bill_number));
}

// "today", "yesterday", "Thu" within the week, "Mar 6" before it: Home's short words for a day (calm/home.js dayShort),
// looking back.
export function dayAgo(iso) {
  const days = Math.round((hiT(hstDay(Date.now())) - hiT(hstDay(iso))) / DAY);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days < 7 ? new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short' })
    : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
}

// The words, one place for both pages. own: the row is the bill's own, which already names it (A-14: "New draft · Thu");
// an issue's row names it ("New draft of HB 2121 · Thu"), or, with two or more, names them and opens the issue's page,
// where each one is marked. A letter written for an older draft says so, with no day ("Your letter is for an older draft of
// HB 2121"): "HB 2121 changed after your letter · Mar 6" could be read as the letter changing the bill, or as the letter's
// day (the critic, 25 Oct; C-10). { text, label, href }; label is the link's accessible name: the words shown, then where it
// goes. stat: the row's own status line. When it already says the committee changed the bill ("Passed a committee with
// changes Tue", Home's RESULT) and this draft is what that decision made, a second day for the same amendment reads as a
// second change (A-14, the critic's second look, 25 Oct): the line only offers the changes, "See what changed".
export function draftWords(items, { own = false, issue = null, stat = '' } = {}) {
  if (!items?.length) return null;
  if (items.length === 1 || own) {
    const d = items[0], num = spaced(d.b.bill_number), day = d.at && !d.letter ? ` · ${dayAgo(d.at)}` : '';
    if (!d.letter && AMENDED.test(stat || '') && madeBy(d.b, d.at)) {
      return { text: own ? 'See what changed' : `See what changed in ${num}`, label: `See what changed in ${num}`, href: `${billPath(d.b)}/changes` };
    }
    const text = (d.letter ? `Your letter is for an older draft${own ? '' : ` of ${num}`}` : own ? 'New draft' : `New draft of ${num}`) + day;
    return { text, label: `${text.replace(' · ', ', ')}: see what changed${own ? ` in ${num}` : ''}`, href: `${billPath(d.b)}/changes` };
  }
  const nums = items.map(d => spaced(d.b.bill_number));
  const text = `New drafts of ${nums[0]} and ${items.length === 2 ? nums[1] : `${items.length - 1} more bills`}`;
  // The issue's page at its bills (#/issue/<slug>/drafts, rec/issue.js), where each one is marked, not at its top (B-3).
  return { text, label: `${text}: see them on ${issue ? `the page for ${issue.name}` : 'the issue’s page'}`, href: issue ? `#/issue/${issue.slug}/drafts` : '#/bills' };
}
// The line itself: its own link, a sibling of the row's link inside the same <li> (never inside it), styled in rec.css
// (.rc-draft: the status line's size, link blue, 44px of target).
export function draftLink(items, opts = {}) {
  const w = draftWords(items, opts); if (!w) return '';
  // A bill's number and a day never break across lines ("HB / 2121", "Mar / 6").
  return `<a class="rc-draft" href="${esc(w.href)}" aria-label="${esc(w.label)}" data-newdraft>${icon('file-text')}<span>${esc(keep(w.text).replace(/\b([A-Z]{2,3}) (\d)/g, '$1\u00a0$2'))}</span></a>`;
}
