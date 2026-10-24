// The Capitol's own lines in plain words (R-212 #45; DESIGN C-15, C-10). The bill page's More details showed the Capitol's
// record word for word: "Referred to HHS/EIG, CPN/JDC.", "The committee on JDC deferred the measure.", a whole roll call.
// Committee codes are for staff screens and the Capitol's own page (C-15), and "deferred" and "measure" are its jargon
// (C-10), so the public page says each line through capitolWords(): "Sent to two Senate committees together (Health and
// Human Services, and Energy and Intergovernmental Affairs), then two more together (Commerce and Consumer Protection, and
// Judiciary).", "The Senate Judiciary Committee put it on hold." The Capitol's wording stays one tap away, on its bill page.
//
// No imports: the committee list is passed in ({ CODE: { name, chamber } }, the shape of S.committees), so
// tests/capitol_words_test.mjs runs every real line in the practice data through it in Node.
//
// cmteName() is the one way a committee step is named on its own (the step line, a step's name, a hearing's title): one
// committee is "Senate Judiciary Committee"; two or more heard together are C-15's joint form, "two Senate committees: Health
// and Human Services, and Commerce and Consumer Protection". core.js cmteWords() is the same with S.committees.

const CH = { H: 'House', S: 'Senate' };
const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
const DRAFT = { HD: 'House draft', SD: 'Senate draft', CD: 'Conference committee draft', FD: 'Floor draft' };   // letters.js draftName's words
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
export const codesOf = code => String(code || '').split('/').map(c => c.trim()).filter(Boolean);

// Names in a list, kept apart when a name has its own "and", "&" or commas: "Health, and Finance" would not need it, so
// two plain names are "Health and Finance"; "Health and Human Services, and Commerce and Consumer Protection"; with a name
// like "Water, Land, Culture and the Arts" the names are kept apart with semicolons.
export function nameList(ns) {
  if (ns.length < 2) return ns[0] || '';
  const comma = ns.some(n => /,/.test(n)), and = ns.some(n => /\s(?:and|&)\s/.test(n));
  const last = comma ? '; and ' : ns.length > 2 || and ? ', and ' : ' and ';
  return ns.slice(0, -1).join(comma ? '; ' : ', ') + last + ns[ns.length - 1];
}
// Three 2025 Senate committees that the 2026 list no longer has (the Senate reorganized: Transportation and Culture and the
// Arts became Transportation, and Water, Land, Culture and the Arts; Higher Education joined Education). Bills from 2025 and
// their Capitol lines still name them, so they are named here rather than shown as codes (R-212 #45, C-15).
export const RETIRED = { TCA: { code: 'TCA', chamber: 'S', name: 'Transportation and Culture and the Arts' }, WTL: { code: 'WTL', chamber: 'S', name: 'Water and Land' },
  HRE: { code: 'HRE', chamber: 'S', name: 'Higher Education' } };
// A committee from the list, else a retired one; any other code is "the XYZ committee" (as cmteLabel says it).
export const cmteInfo = (k, cm) => (cm && cm[k] && cm[k].name ? cm[k] : null) || RETIRED[k] || null;
const known = cmteInfo;
const oneName = (k, cm) => { const c = known(k, cm); return c ? `${CH[c.chamber] ? CH[c.chamber] + ' ' : ''}${c.name} Committee` : `the ${k} committee`; };
const chamberOf = (ks, cm) => CH[(ks.map(k => known(k, cm)).find(Boolean) || {}).chamber] || '';

// One committee step, named on its own (C-15). end: the joint form with its colon ("two Senate committees: A, and B"),
// for a name that ends its line; mid: in brackets ("two Senate committees (A, and B)"), for one inside a sentence. link(code,
// text) wraps each committee's own name (the bill page links each to its committee page; it escapes the text itself).
export function cmteName(code, cm, { mid = false, link = null, together = false } = {}) {
  const ks = codesOf(code), w = (k, t) => link ? link(k, t) : t;
  if (!ks.length) return 'a committee';
  if (ks.length === 1) return w(ks[0], oneName(ks[0], cm));
  const ch = chamberOf(ks, cm), names = nameList(ks.map(k => w(k, known(k, cm) ? known(k, cm).name : `the ${k} committee`)));
  const head = `${NUM[ks.length] || ks.length} ${ch ? ch + ' ' : ''}committees${together ? ' together' : ''}`;
  return mid ? `${head} (${names})` : `${head}: ${names}`;
}
// The same with "the" where one committee is named: "the Senate Judiciary Committee", "two Senate committees: ...".
export const theCmteName = (code, cm, o) => { const s = cmteName(code, cm, o); return /^(the|a|two|three|four|five|six|\d+) /i.test(s) || codesOf(code).length > 1 ? s : `the ${s}`; };

// ---------- pieces of a Capitol line ----------
const CODE = '[A-Z]{2,4}', STOP = `${CODE}(?:\\s*/\\s*${CODE})*`, STOPS = `${STOP}(?:\\s*,\\s*${STOP})*`;
// "03-16-26 3:01PM" -> "Mon, Mar 16 at 3:01 PM"; the weekday from the date itself (the Capitol's "Tuesday," is sometimes missing).
const DT = '(\\d{1,2})-(\\d{1,2})-(\\d{2,4})(?:\\s+(?:at\\s+)?(\\d{1,2}:\\d{2})\\s*([AP]\\.?M\\.?))?';
function dayOf(mm, dd, yy) {
  const y = +yy < 100 ? 2000 + +yy : +yy, d = new Date(Date.UTC(y, +mm - 1, +dd));
  return isNaN(d) ? '' : `${DAYS[d.getUTCDay()]}, ${MONTHS[+mm - 1]} ${+dd}`;
}
const whenOf = m => { const day = dayOf(m[0], m[1], m[2]); return day + (m[3] ? ` at ${m[3]} ${m[4].replace(/\./g, '').toUpperCase()}` : ''); };
const findWhen = s => { const m = new RegExp(DT, 'i').exec(s); return m ? whenOf(m.slice(1)) : ''; };
// "Conference Room 016 & Videoconference", "CR 229", "House conference room 329 VIA VIDEOCONFERENCE" -> " in Room 016 and online"
function roomOf(s) {
  const m = /(?:conference room|\bCR|\broom)\s+([0-9A-Z]{1,4})\b/i.exec(s), online = /videoconference/i.test(s);
  return m ? ` in Room ${m[1]}${online ? ' and online' : ''}` : online ? ' online' : '';
}
// A draft the line names: "(SD 1)", "as amended in HD 2" -> "House draft 2"
const draftOf = s => { const m = /\b(HD|SD|CD|FD)\s*(\d+)\b/.exec(s); return m ? `${DRAFT[m[1]]} ${m[2]}` : ''; };
const changes = s => /amended|amendments/i.test(s) ? (draftOf(s) ? ` with changes (${draftOf(s)})` : ' with changes') : '';
// Which chamber acted, from the line itself: who voted, where it was sent, the draft it made; else the caller's hint
// (an activity row's "Official action - Senate").
function actedIn(s, cm, hint) {
  if (/Transmitted to Senate/i.test(s)) return 'H';
  if (/Transmitted to House/i.test(s)) return 'S';
  if (/Representative\(s\)/.test(s)) return 'H';
  if (/Senator\(s\)/.test(s)) return 'S';
  const d = /\b(HD|SD)\s*\d/.exec(s); if (d) return d[1][0];
  const r = new RegExp(`(?:referred|recommitted|referral) to (?:the committee\\(s\\) on\\s+)?(${CODE})`, 'i').exec(s);
  if (r && known(r[1], cm)) return known(r[1], cm).chamber;
  return hint || '';
}
const full = ch => CH[ch] ? `the full ${CH[ch]}` : 'the full House or Senate';
// A floor vote's numbers, as a sentence of its own (the names in the roll call are left to the Capitol's page): the
// Senate gives "Ayes, 22; ... Noes, 0 (none)"; the House only the noes, "none voting no (0)", "... voting no (3)".
function floorVotes(s) {
  const y = /Ayes,\s*(\d+)/i.exec(s), n = /Noes,\s*(\d+)/i.exec(s);
  if (y && n) return ` The vote: ${y[1]} yes, ${n[1]} no.`;
  if (/none voting no/i.test(s)) return ' No one voted no.';
  const h = /voting no \((\d+)\)/i.exec(s);
  return !h ? '' : +h[1] === 1 ? ' One member voted no.' : ` ${h[1]} members voted no.`;
}
// A committee's vote ("The votes were as follows: 11 Ayes: ...; Noes: none" / "5 Aye(s): ...; 0 No(es): none"): "(11 yes, 0 no)".
function cmteVotes(s) {
  const y = /(\d+)\s+Aye(?:s|\(s\))?\s*:/i.exec(s); if (!y) return '';
  const n = /(\d+)\s+No(?:es|\(es\))\s*:/i.exec(s), none = /No(?:es|\(es\))\s*:\s*none/i.test(s);
  return ` (${y[1]} yes${n ? `, ${n[1]} no` : none ? ', 0 no' : ''})`;
}
// "The Senate Judiciary Committee put it on hold." and, for committees heard together, "Two Senate committees (Health and
// Human Services, and Commerce and Consumer Protection) put it on hold." The verb may use {its}, said "their" for two.
function says(code, cm, verb) {
  const two = codesOf(code).length > 1, v = verb.replace(/\{its\}/g, two ? 'their' : 'its');
  return `${cap(theCmteName(code, cm, { mid: true }))} ${v}.`;
}
// Where it was sent, stop by stop ("Referred to HHS/EIG, CPN/JDC"): committees one after another, or heard together.
function sentTo(lead, stops, cm) {
  const list = stops.split(',').map(x => x.trim()).filter(Boolean);
  if (!list.length) return '';
  const joint = list.some(x => codesOf(x).length > 1), ch = chamberOf(list.flatMap(codesOf), cm);
  // one after another, none heard together: "Sent to three House committees, one after another: Health, Consumer
  // Protection & Commerce, and Finance."
  if (!joint) {
    if (list.length === 1) return `${lead} ${theCmteName(list[0], cm)}.`;
    if (list.every(k => known(k, cm))) return `${lead} ${NUM[list.length] || list.length} ${ch ? ch + ' ' : ''}committees, one after another: ${nameList(list.map(k => known(k, cm).name))}.`;
    return `${lead} ${list.map(k => theCmteName(k, cm)).join(', then ')}.`;
  }
  if (list.length === 1) return `${lead} ${cmteName(list[0], cm, { together: true })}.`;
  // two or more stops, at least one heard together: "Sent to two Senate committees together (A, and B), then two more
  // together (C, and D)." Later stops leave out the chamber the first one named.
  const later = x => { const ks = codesOf(x);
    if (ks.length === 1) return known(ks[0], cm) ? `the ${known(ks[0], cm).name} Committee` : `the ${ks[0]} committee`;
    return `${NUM[ks.length] || ks.length} more together (${nameList(ks.map(k => known(k, cm) ? known(k, cm).name : `the ${k} committee`))})`; };
  return `${lead} ${theCmteName(list[0], cm, { mid: true, together: true })}${list.slice(1).map(x => `, then ${later(x)}`).join('')}.`;
}

// Where it goes next, at the end of a sentence: "the Senate Ways and Means Committee", "two Senate committees together: A, and B".
const next = (stop, cm) => theCmteName(stop, cm, { together: codesOf(stop).length > 1 });

// ---------- the lines ----------
// Each is [pattern, (match, line, committees, chamber hint) => plain words]. The first that matches says the line.
const RULES = [
  // A committee's decision, with or without its vote: "The committee(s) on HHS/CPN recommend(s) that the measure be PASSED,
  // WITH AMENDMENTS. The votes in HHS were as follows: ...". "HELD" and "deferred" are a hold (C-15: put on hold).
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+recommend(?:s|\\(s\\))? that the measure be\\s+(.*)$`, 'i'), (m, s, cm) => {
    const what = m[2], v = codesOf(m[1]).length > 1 ? '' : cmteVotes(s);
    if (/^PASSED, WITH AMENDMENTS/i.test(what)) return says(m[1], cm, `voted to pass it with changes${v}`);
    if (/^PASSED/i.test(what)) return says(m[1], cm, `voted to pass it without changes${v}`);
    if (/^(HELD|deferred)/i.test(what)) { const w = findWhen(what); return says(m[1], cm, `voted to put it on hold${w ? ` until ${w}` : ''}${v}`); }
    return null;
  }],
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+deferred the measure(.*)$`, 'i'), (m, s, cm) => { const w = /until/i.test(m[2]) ? findWhen(m[2]) : '';
    return says(m[1], cm, `put it on hold${w ? ` until ${w}` : ''}`); }],
  // Hearings and votes set, moved, or taken off ("decision making" is a committee's vote without new testimony).
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+(?:has scheduled|will hold) a public hearing on\\s+(.*)$`, 'i'), (m, s, cm) => says(m[1], cm, `set a hearing for ${findWhen(m[2])}${roomOf(m[2])}`)],
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+will hold a public decision making on\\s+(.*)$`, 'i'), (m, s, cm) => says(m[1], cm, `set a vote on it for ${findWhen(m[2])}${roomOf(m[2])}`)],
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+has rescheduled its (public hearing|decision making) to\\s+(.*)$`, 'i'), (m, s, cm) =>
    says(m[1], cm, `moved {its} ${/hearing/i.test(m[2]) ? 'hearing' : 'vote on it'} to ${findWhen(m[3])}${roomOf(m[3])}`)],
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+(?:has )?deleted the measure from (?:the )?(public hearing|decision making)(?: scheduled)?(?: on)?\\s*(.*)$`, 'i'), (m, s, cm) => {
    const w = findWhen(m[3]); return says(m[1], cm, `took it off the list for {its} ${/hearing/i.test(m[2]) ? 'hearing' : 'vote'}${w ? ` on ${w}` : ''}`); }],
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+(?:has )?added the measure to (?:the )?(public hearing|decision making)(?: scheduled)?(?: on)?\\s*(.*)$`, 'i'), (m, s, cm) => {
    const w = findWhen(m[3]); return says(m[1], cm, `added it to {its} ${/hearing/i.test(m[2]) ? 'hearing' : 'vote'}${w ? ` on ${w}` : ''}${roomOf(m[3])}`); }],
  // "will reconsider its previous decision on 01-28-26 and will hold a public decision making on 02-02-26 1:10PM; ..."
  [new RegExp(`^The committee(?:\\(s\\))? on\\s+(${STOP})\\s+will reconsider its previous decision(?: on\\s+(\\S+))?.*?decision making on\\s+(.*)$`, 'i'), (m, s, cm) => {
    const was = m[2] ? findWhen(m[2]) : ''; return says(m[1], cm, `will look again at {its} decision${was ? ` of ${was}` : ''} and vote on it ${findWhen(m[3])}${roomOf(m[3])}`); }],
  [/^Meeting Scheduled on\s+(.*?)\s+has been cancell?ed/i, m => `The meeting set for ${findWhen(m[1]) || 'that day'} was cancelled.`],
  [/^This measure has been deleted from the meeting scheduled on\s+(.*)$/i, m => `Taken off the meeting set for ${findWhen(m[1]) || 'that day'}.`],
  [new RegExp(`^Bill scheduled to be heard by\\s+(${STOP})\\s+on\\s+(.*)$`, 'i'), (m, s, cm) => says(m[1], cm, `set a hearing for ${findWhen(m[2])}${roomOf(m[2])}`)],
  [/^Bill scheduled for decision making on\s+(.*)$/i, m => `A committee vote on it is set for ${findWhen(m[1])}${roomOf(m[1])}.`],
  [/^Bill re-?scheduled for decision making on\s+(.*)$/i, m => `A committee vote on it was moved to ${findWhen(m[1])}${roomOf(m[1])}.`],
  [/^Bill scheduled for Conference Committee Meeting on\s+(.*)$/i, m => `The House and Senate members working out one version set a meeting for ${findWhen(m[1])}${roomOf(m[1])}.`],
  [/^(48 Hrs\.?|Forty-eight \(48\) hours)\s+notice\b(.*)$/i, m => `Notice of a hearing on ${findWhen(m[2]) || 'a later day'}, given 48 hours ahead.`],
  [/^One Day Notice\b(.*)$/i, m => `Notice of a hearing on ${findWhen(m[1]) || 'a later day'}, given one day ahead.`],
  [/^Public notice requirement waived/i, () => 'The Senate set a hearing on shorter notice than usual, as its rules allow.'],
  // Where it was sent: "Referred to HLT, CPC, FIN, referral sheet 2", "Re-Referred to HHS, CPN/JDC.", "Recommitted to JHA/AGR with ...".
  [/^Recommitted to Conference committee(.*)$/i, m => `Sent back to the House and Senate members working out one version${changes(m[1])}.`],
  [new RegExp(`^(Re-?referred|Referred|Recommitted) to\\s+(${STOPS})(?:\\s*,\\s*referral sheet \\d+)?\\b`, 'i'), (m, s, cm) =>
    sentTo(/^re-?ref/i.test(m[1]) ? 'Sent instead to' : /^recom/i.test(m[1]) ? 'Sent back to' : 'Sent to', m[2], cm)],
  // A committee's written report to the full chamber ("Reported from LAB (Stand. Com. Rep. No. 10) as amended in HD 1,
  // recommending passage on Second Reading and referral to CPC."): it passed the committee, and where it goes next.
  [new RegExp(`^Reported from\\s+(${STOP})\\s*(.*)$`, 'i'), (m, s, cm) => {
    const rest = m[2], ref = new RegExp(`referral to\\s+(${STOP})`, 'i').exec(rest), c = known(codesOf(m[1])[0], cm);
    if (ref) return `${says(m[1], cm, `passed it${changes(rest)}`)} Then it goes to ${next(ref[1], cm)}.`;
    return says(m[1], cm, `passed it${changes(rest)} and sent {its} report to ${full(c && c.chamber)}${/Third Reading/i.test(rest) ? ' for its final vote' : ''}`);
  }],
  // The full chamber's votes. Second reading is a vote of the full chamber; third reading is the vote that passes it.
  // "Report adopted;" before one of them says nothing more than the vote does.
  [/^Report (?:and Resolution )?Adopted\.?$/i, (m, s, cm, hint) => `${cap(full(hint))} accepted the committee’s report.`],
  [/^Report adopted\s*[;,]\s*(Passed (?:Second|Third) Reading.*)$/i, (m, s, cm, hint) => plainLine(m[1], cm, actedIn(s, cm, hint))],
  [/^Report adopted\s*[;,]\s*(.*)$/i, (m, s, cm, hint) => {
    const rest = m[1], ch = actedIn(s, cm, hint), ref = new RegExp(`(?:referred|recommitted) to\\s+(?:the committee\\(s\\) on\\s+)?(${STOP})`, 'i').exec(rest);
    const back = /recommitted/i.test(rest);
    return `${cap(full(ch))} voted to accept the committee’s report${changes(rest)}.${floorVotes(s)}${ref ? ` ${back ? 'It goes back' : 'Then it goes'} to ${next(ref[1], cm)}.` : ''}`;
  }],
  [/^Passed Second Reading(.*)$/i, (m, s, cm, hint) => {
    const ref = new RegExp(`referred to\\s+(?:the committee\\(s\\) on\\s+)?(${STOP})`, 'i').exec(m[1]);
    return `Passed a vote of ${full(actedIn(s, cm, hint))}${changes(m[1])}.${floorVotes(s)}`
      + (ref ? ` Then it goes to ${next(ref[1], cm)}.` : /calendar for Third Reading/i.test(m[1]) ? ' Its final vote comes next.' : '');
  }],
  [/^Passed Third Reading(.*)$/i, (m, s, cm, hint) => { const ch = actedIn(s, cm, hint), to = /Transmitted to (House|Senate)/i.exec(s);
    return `Passed the ${CH[ch] || 'House or Senate'}${changes(m[1])}.${floorVotes(s)}${to ? ` Sent to the ${cap(to[1].toLowerCase())}.` : ''}`; }],
  [/^Failed to pass Third Reading(.*)$/i, (m, s, cm, hint) => `Did not pass ${full(actedIn(s, cm, hint))}.${floorVotes(s)}`],
  [/^Passed Final Reading(.*)$/i, (m, s, cm, hint) => `${cap(full(actedIn(s, cm, hint)))} passed the final version${changes(m[1]).replace(' with changes', '')}.${floorVotes(s)}`],
  [/^Received notice of passage on Final Reading in (House|Senate)/i, m => `The ${cap(m[1].toLowerCase())} passed the final version.`],
  [/^(?:Introduced and )?Pass(?:ed)? First Reading\.?$/i, (m, s) => /^Introduced/i.test(s) ? 'Introduced and read for the first time.' : 'Read for the first time.'],
  [/^Introduced\.?$/i, () => 'Introduced.'],
  [/^Pending introduction\.?$/i, () => 'Waiting to be introduced.'],
  [/^Pre-?filed\.?$/i, () => 'Filed before the session began.'],
  [/^Filed\.?$/i, () => 'Filed.'],
  [/^Received\.?$/i, () => 'Received.'],
  [/^Report filed\.?$/i, () => 'The committee filed its report.'],
  [/^Separated Committee Report/i, () => 'The committee’s report was taken up on its own, not with the others.'],
  [/^Floor Amendment No\.?\s*\d+ offered/i, () => 'A member offered a change to it during the vote of the full chamber.'],
  [/^Floor amendment adopted(.*)$/i, (m, s, cm, hint) => `${cap(full(actedIn(s, cm, hint)))} made a change to it during its vote${changes(m[1]).replace(' with changes', '')}.`],
  [/^The recommendation was not adopted/i, (m, s, cm, hint) => `${cap(full(hint))} voted not to accept the committee’s report.`],
  // From one chamber to the other.
  [/^Received from (House|Senate)\b(.*)$/i, (m) => { const to = /^house$/i.test(m[1]) ? 'Senate' : 'House', d = draftOf(m[2]);
    return `Arrived in the ${to} from the ${cap(m[1].toLowerCase())}${d && /amended/i.test(m[2]) ? `, as ${d}` : ''}.`; }],
  [/^Returned from (House|Senate)\b(.*)$/i, m => `Came back from the ${cap(m[1].toLowerCase())}${changes(m[2])}.`],
  [/^(House|Senate) disagrees with (House|Senate) amendment/i, m => `The ${cap(m[1].toLowerCase())} did not agree to the ${cap(m[2].toLowerCase())}’s changes.`],
  [/^(House|Senate) agrees with (House|Senate) amendment/i, m => `The ${cap(m[1].toLowerCase())} agreed to the ${cap(m[2].toLowerCase())}’s changes.`],
  [/^Received notice of disagreement \((Hse|Sen)\./i, m => `The ${m[1] === 'Hse' ? 'House' : 'Senate'} did not agree to the changes.`],
  // Working out one version: the conference committee ("conferees" are its members, the negotiators).
  [/^(House|Senate) Conferees Appointed\b/i, m => `The ${cap(m[1].toLowerCase())} picked its members to work out one version with the ${/^house/i.test(m[1]) ? 'Senate' : 'House'}.`],
  [/^Received notice of (?:appointment of )?(House|Senate) conferees/i, m => `The ${cap(m[1].toLowerCase())} picked its members to work out one version with the ${/^house/i.test(m[1]) ? 'Senate' : 'House'}.`],
  [/^(House|Senate) Conferees Changed/i, m => `The ${cap(m[1].toLowerCase())} changed its members working out one version.`],
  [/^Received notice of change in (?:(House|Senate) )?conferees \((Hse|Sen)\./i, m => `The ${m[1] ? cap(m[1].toLowerCase()) : m[2] === 'Hse' ? 'House' : 'Senate'} changed its members working out one version.`],
  [/^Received notice of (?:the discharge of all (House|Senate) Conferees|all (House|Senate) conferees being discharged)/i, m => `The ${cap((m[1] || m[2]).toLowerCase())} ended its members’ work on one version.`],
  [/^Conference committee meeting (?:will reconvene|to reconvene|scheduled)(?: on| for)?\s+(.*)$/i, (m, s) =>
    `The House and Senate members working out one version set ${/reconvene/i.test(s) ? 'another meeting' : 'a meeting'} for ${findWhen(m[1].replace(/^[A-Za-z]+,?\s+(?=\d)/, ''))}${roomOf(m[1])}.`],
  // The Governor, and the law.
  [/^(?:Enrolled|Transmitted|Presented) to (?:the )?Governor/i, () => 'Sent to the Governor.'],
  [/intent to veto/i, () => 'The Governor gave notice of a plan to veto it.'],
  [/^Veto overridden|override/i, () => 'The Legislature voted to make it law over the Governor’s veto.'],
  [/^Vetoed\b/i, () => 'Vetoed by the Governor.'],
  [/^Became law without the Governor'?’?s signature,?\s*Act\s+(\d+)/i, m => `Became law without the Governor’s signature, as Act ${m[1]}.`],
  [/^Act\s+(\d+),?\s+on\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i, m => `Became law as Act ${m[1]} on ${MONTHS[+m[2] - 1]} ${+m[3]}, ${m[4]}.`],
  [/^Act\s+(\d+)\b/i, m => `Became law as Act ${m[1]}.`],
  [/^Received from Governor re:\s*Recommended for Immediate Passage/i, () => 'The Governor asked the Legislature to pass it right away.'],
  [/^Received from Governor re:\s*emergency appropriation/i, () => 'The Governor sent a message about the emergency funding in it.'],
  [/^Carried over to (\d{4}) Regular Session/i, m => `Carried over to the ${m[1]} session.`],
  // Resolutions.
  [/^Resolution adopted in final form/i, () => 'Adopted in its final form.'],
  [/^Adopted\.?$/i, () => 'Adopted.'],
  [/^Received notice of Adoption(?: in (House|Senate))?(?: \((Hse|Sen)\.)?/i, m => m[1] || m[2] ? `The ${m[1] ? cap(m[1].toLowerCase()) : m[2] === 'Hse' ? 'House' : 'Senate'} adopted it.` : 'The other chamber adopted it.'],
  [/^Certified copies of resolutions sent/i, () => 'Copies of the resolution were sent out.'],
  // The Senate's votes on the Governor's picks (these are not bills, but the same record carries them).
  [/^Confirmed\b/i, () => 'Confirmed by the Senate.'],
  [/^Nominee\(s\).*withdrawn by Governor/i, () => 'The Governor took back the nomination.'],
  [/^Nominee\(s\) failed to be confirmed/i, () => 'The Senate did not confirm the nominee.'],
];

// A line no rule knows keeps its own words, said without codes or capitals: every committee code becomes its name, the
// Capitol's message numbers are dropped, "PASSED, WITH AMENDMENTS" is "passed, with amendments", and its jargon gives way.
function fallback(s, cm) {
  let t = s.replace(/\s*\((?:Stand\. Com\. Rep\.|Hse\. Com\.|Sen\. Com\.|Gov\. Msg\.|Conf\. Com\. Rep\.)[^)]*\)/gi, '')
    .replace(/,?\s*referral sheet \d+/gi, '')
    .replace(new RegExp(`\\bthe committee(?:\\(s\\))? on\\s+(${STOP})`, 'gi'), (x, c) => codesOf(c).every(k => known(k, cm)) ? theCmteName(c, cm, { mid: true }) : x)
    .replace(new RegExp(`\\b(${STOP})\\b`, 'g'), (x, c) => codesOf(c).every(k => known(k, cm)) ? theCmteName(c, cm, { mid: true }) : x)
    .replace(/\b(HD|SD|CD|FD)\s*(\d+)\b/g, (x, d, n) => `${DRAFT[d]} ${n}`)
    .replace(/\b[A-Z]{2,}(?:[ ,]+[A-Z]{2,})*\b/g, w => /^(HD|SD|CD|FD)$/.test(w) || codesOf(w).every(k => known(k, cm)) && !/\s/.test(w) ? w : w.toLowerCase())
    .replace(/\bthe measure\b/gi, 'the bill').replace(/\bmeasure\b/gi, 'bill').replace(/\bdeferred\b/gi, 'put on hold')
    .replace(/\brecommend(?:s|\(s\)|ed|ing|ation)?\b/gi, 'asked').replace(/\((?:s|es)\)/g, 's').replace(/\s+/g, ' ').trim();
  return cap(t);
}

function plainLine(text, cm, hint, o = {}) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  for (const [re, say] of RULES) {
    const m = re.exec(s);
    if (m) { const out = say(m, s, cm || {}, hint || '', o); if (out) return out.replace(/\s+/g, ' ').trim(); }
  }
  return fallback(s, cm || {});
}
// One Capitol action line in plain words. committees: { CODE: { name, chamber } } (S.committees); chamber: 'H' or 'S' when
// the caller knows where the action was recorded (an activity row's details), for lines like "Passed Third Reading."
export function capitolWords(text, committees = {}, { chamber = '' } = {}) {
  return plainLine(text, committees, chamber);
}
