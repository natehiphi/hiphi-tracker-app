// HIPHI Staff v5: Capitol words explained where they appear (R-316 W40, L-6; DESIGN B-9, A-14, C-15).
// A committee code ("TRN", the joint "HHS/CPN"), "Legislative day 27 of 58", a version ("HD1", "SD2") and a deadline's name
// ("Second lateral", "Fiscal") are drawn as a small button that reads as dotted-underlined text. A click, a tap, or Enter
// or Space once it has keyboard focus opens one line saying what it means, from Help's own glossary (WORDS, below) and the
// committee list (S.committees), with a link to the whole list in Help. On a laptop it opens beside the word (ui.js
// openSheet's pop), on a phone as a short sheet; Esc, a tap outside or the X closes it and focus goes back to the word.
// It replaces the hover-only hints (title=) on Bills and Legislators, which a phone never showed (B-9).
// One listener on the document (capture, so a term inside a clickable table row opens its meaning, not the row) means a
// screen only has to draw termBtn(); nothing to wire.
// Show me lane: on the practice copy until Nate's yes makes the gates `() => true`. With them off nothing here is drawn
// and Help keeps its words as they are.
// Staff v6 (R-336, V05, D15): rows and sentences carry plain words, not codes: committeeName ("House Transportation"),
// versionWords ("House draft 1") and deadlineWords (steps.js, the one source). plainCodes() turns the codes in a line of
// text into those words; a code still shown (About this bill, the filing card) sits small beside its words and taps open
// what it means, on phones too, and inside a sheet it opens in place under the word (a second sheet would close the first).
import { S, DEMO, esc } from './data.js';
import { openSheet, closeSheet } from './ui.js';
import { gateGloss } from './model.js';
import { committeeName, versionWords, COMMITTEES } from './steps.js';

export const TERMS_TAP = () => true;   // W40: the words become tappable (live at Nate's go 10/22, R-331)
export const HOW_TO = () => true;       // W37: Help's how-to guides and the session calendar (help.js)

// ---- the Capitol's words, in plain language (Help's glossary; it lived in help.js) ----
export const WORDS = [
  ['Legislative day', 'A day the chambers meet. Weekends, recess days and holidays do not count, so "Legislative day 42 of 60" is not a calendar count.'],
  ['Referral', 'The committees a bill must pass in each chamber, in order. Three or more in one chamber is a triple referral.'],
  ['Hearing', 'A committee meeting where the bill is heard and anyone can testify. Written testimony is usually due 24 hours before; a few committees ask for 48 (CPN). The tracker shows each hearing’s own deadline.'],
  ['48-hour notice', 'A committee must post a hearing at least 48 hours ahead. A bill’s first Senate committee must post 72 hours ahead. If its last regular meeting before a deadline is closer than that, only the chair can help.'],
  ['Decision making', 'A later meeting where a committee votes on bills it already heard. Testimony is still taken, and the tracker treats it like a hearing, with its own deadline: HIPHI filed at eight of them in 2026.'],
  ['Deferred', 'The committee held the bill. For the year, that almost always ends it.'],
  ['Triple filing', 'The last day a triple-referred bill can clear its first committee.'],
  // R-277 W-2: one definition each, the same words as the bill page's stage note (model.js STAGE_GLOSS, GATE_WORDS).
  ['Lateral', 'The last day a bill can reach its last committee in the chamber it is in. Its last committee is usually the money committee (FIN in the House, WAM in the Senate).'],
  ['Decking', 'The last day a bill can clear its last committee and be filed for its floor vote in that chamber.'],
  ['Crossover', 'The last day a bill can pass its first chamber and move to the other. The second chamber repeats the same deadlines.'],
  ['Cross back', 'A bill the second chamber changed goes back to where it started, to agree or disagree.'],
  ['Conference', 'House and Senate negotiators settle one version. Final decking is the last day they can agree.'],
  ['Sine die', 'The last day of the session.'],
  ['HD1, SD1, CD1', 'Versions. HD1 is the first House draft, SD1 the first Senate draft, CD1 the conference draft. Testimony written for an older version needs a second look.'],
  ['Companion', 'The same bill introduced in the other chamber, an HB and an SB with the same text. If one stalls, the other may still move.'],
  ['GM', 'A message from the Governor, such as a nomination or a report. Not a bill.'],
];
// W40 (L-6): the two words the review found explained nowhere. Added to Capitol words with the gate on.
export const WORDS_NEW = [
  ['Joint referral', 'Two committees named together, such as HHS/CPN. They hear the bill together, at one hearing, and vote on it together, so the pair counts as one stop.'],
  ['Fiscal', 'A bill that spends money. Fiscal bills also go to the money committee (FIN in the House, WAM in the Senate). Fiscal is also the name of their last deadline: the day conference drafts of bills that spend money must be settled, a little after Final decking.'],
];
export const allWords = () => TERMS_TAP() ? [...WORDS, ...WORDS_NEW] : WORDS;
const word = k => allWords().find(([t]) => t.toLowerCase() === String(k).toLowerCase())?.[1] || '';

const CHAMBER = { H: 'House', S: 'Senate' };
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];
const TIMES = ['', 'once', 'twice', 'three times', 'four times', 'five times'];
const cmteOf = c => S.committees?.[c] || null;
const cmteWords = c => { const k = cmteOf(c); return k ? `the ${CHAMBER[k.chamber] || ''} ${k.name} committee`.replace(/\s+/g, ' ') : `committee ${c}`; };
const listWords = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// What a key means: { title, text, href, link }. Keys: cmte:TRN, cmte:HHS/CPN, word:Legislative day, ver:HD2,
// gate:Second lateral. `more` is a sentence the screen adds ("1st of 2 committees in the House...").
export function meaning(key, more = '') {
  const i = key.indexOf(':'), kind = key.slice(0, i), v = key.slice(i + 1);
  let out = null;
  if (kind === 'cmte') {
    // v6: the title is the committee in words with its code ("Senate Health and Human Services, and Commerce (HHS/CPN)").
    const cs = v.split('/').map(c => c.trim()).filter(Boolean), title = `${committeeName(v)} (${v})`;
    if (cs.length > 1) { const ks = cs.map(cmteOf), ch = [...new Set(ks.filter(Boolean).map(k => CHAMBER[k.chamber]))];
      const num = ['', 'one', 'two', 'three', 'four'][cs.length] || cs.length;
      out = { title, text: `A joint referral: ${num} ${ch.length === 1 ? ch[0] + ' ' : ''}committees, ${listWords(cs.map((c, i) => ks[i] ? `${ks[i].name} (${c})` : c))}, hear the bill together, at one hearing, and vote on it together.`, href: '#/help/committees', link: 'Committee codes in Help' }; }
    else { const k = cmteOf(cs[0]);
      out = { title: k || COMMITTEES[cs[0]] ? title : v, text: k ? `${cmteWords(cs[0]).replace(/^the/, 'The')}.${k.chair ? ` Chair ${k.chair}${k.vice_chair ? `, vice chair ${k.vice_chair}` : ''}.` : ''}` : COMMITTEES[cs[0]] ? `The ${committeeName(cs[0])} committee.` : `A committee code. This one is not in the tracker’s committee list yet.`, href: '#/help/committees', link: 'Committee codes in Help' }; }
  } else if (kind === 'ver') {
    const m = /^([HSC])D(\d+)$/i.exec(v), n = m ? +m[2] : 0, who = m ? { H: 'House', S: 'Senate', C: 'conference' }[m[1].toUpperCase()] : '';
    out = { title: m ? `${versionWords(v)} (${v})` : v, text: m ? `The ${ORD[n] || n + 'th'} ${who} draft${m[1].toUpperCase() === 'C' ? ': the version House and Senate negotiators agreed on' : `: the ${who} has changed the bill ${TIMES[n] || n + ' times'}`}. Testimony written for an older version needs a second look.` : word('HD1, SD1, CD1'), href: '#/help/words', link: 'Capitol words in Help' };
  } else if (kind === 'gate') {
    const m = /^(First|Second)\s+(.+)$/i.exec(v), base = m ? m[2] : v, where = m ? (/^first/i.test(m[1]) ? ' This one is in the chamber where the bill started.' : ' This one is in the second chamber, after crossover.') : '';
    const w = word(base[0].toUpperCase() + base.slice(1)) || (gateGloss(v) ? gateGloss(v)[0].toUpperCase() + gateGloss(v).slice(1) + '.' : '');
    out = { title: v, text: `${w}${where}`.trim() || 'A deadline in the session’s calendar.', href: HOW_TO() ? '#/help/calendar' : '#/help/stages', link: HOW_TO() ? 'Session calendar in Help' : 'Stages and deadlines in Help' };
  } else {
    out = { title: v, text: word(v) || v, href: '#/help/words', link: 'Capitol words in Help' };
  }
  if (more) out.text += ` ${more}`;
  return out;
}

// The control. `text` is the words shown (escaped here); `key` as above. The button's name says what it opens, and
// aria-expanded says whether it is open (ui.js returns focus to it when the sheet closes).
export const termBtn = (text, key, { more = '', cls = '' } = {}) =>
  `<button type="button" class="tm-term${cls ? ' ' + cls : ''}" data-term="${esc(key)}"${more ? ` data-tmore="${esc(more)}"` : ''} aria-haspopup="dialog" aria-expanded="false" aria-label="${esc(`${text}: what it means`)}">${esc(text)}</button>`;
// The same, or the plain escaped words while the gate is off (the screen then keeps whatever it had).
export const term = (text, key, o) => TERMS_TAP() ? termBtn(text, key, o) : esc(text);
// Every known committee code in a line of already-escaped text becomes a term ("Chair, HHS · Member, CPN";
// "HLT, CPC/JHA, FIN"): a joint pair is one term, as the Capitol writes it.
export function termCodes(html) {
  if (!TERMS_TAP()) return html;
  return String(html).replace(/\b[A-Z]{2,4}(?:\/[A-Z]{2,4})*\b/g, m => m.split('/').every(c => cmteOf(c)) ? termBtn(m, 'cmte:' + m) : m);
}

// v6: a line of escaped text with its Capitol codes said in words, for rows and sentences (D15: no codes in rows). A known
// committee code, a joint pair as the Capitol writes it, becomes committeeName ("in HHS/CPN" -> "in Senate Health and
// Human Services, and Commerce"); a draft code ("HD1", "SD2", "CD1") becomes versionWords. Anything else stays as it was.
const isCmte = c => !!(cmteOf(c) || COMMITTEES[c]);
// A code in brackets right after its own words ("House draft 2 (HD2)", as data.js names a draft in What changed and Started
// from) is dropped rather than said twice ("House draft 2 (House draft 2)", Kris's #/review/dd1).
const SAID = /\b((?:House|Senate|Conference(?: committee)?|Floor) draft (\d{1,2})) \(([HSCF])D\2\)/g;
export function plainCodes(html) {
  return String(html ?? '')
    .replace(SAID, (m, words, n, c) => (words[0] === c || (c === 'C' && /^Conference/.test(words)) ? words : m))
    .replace(/\b([HSCF]D\d{1,2})\b/g, m => versionWords(m))
    .replace(/\b[A-Z]{2,4}(?:\/[A-Z]{2,4})*\b/g, m => m.split('/').every(isCmte) ? esc(committeeName(m)) : m);
}
// A code that stays in view (About this bill, the filing card), small beside its words and tap-to-explain:
// "House Health (HLT)", "House draft 1 (HD1)".
export const cmteTerm = code => `${esc(committeeName(code))} <span class="v6-code">(${term(code, 'cmte:' + code)})</span>`;
export const verTerm = v => v ? `${esc(versionWords(v))} <span class="v6-code">(${term(v, 'ver:' + v)})</span>` : esc(versionWords(v));

// Inside a sheet the meaning opens in place, under the word: another sheet would replace the one it is in (ui.js keeps one
// sheet at a time), so a code in the quick look or a filing sheet explained nothing.
function inlineTerm(b) {
  const next = b.nextElementSibling;
  if (next?.classList.contains('tm-inline')) { next.remove(); b.setAttribute('aria-expanded', 'false'); return; }
  const m = meaning(b.dataset.term || '', b.dataset.tmore || '');
  b.insertAdjacentHTML('afterend', `<span class="tm-inline" role="note"><b>${esc(m.title)}</b> ${esc(m.text)}</span>`);
  b.setAttribute('aria-expanded', 'true');
}
function openTerm(b) {
  const m = meaning(b.dataset.term || '', b.dataset.tmore || '');
  b.setAttribute('aria-expanded', 'true');
  openSheet({ title: esc(m.title), size: 'auto tm-pop', pop: true,
    body: `<p class="tm-def">${esc(m.text)}</p>${m.href ? `<p class="tm-more"><a href="${esc(m.href)}" data-tmgo>${esc(m.link)}</a></p>` : ''}`,
    onClose: () => b.setAttribute('aria-expanded', 'false'),
    wire: d => { const a = d.querySelector('[data-tmgo]'); if (a) a.onclick = async e => { e.preventDefault(); b.setAttribute('aria-expanded', 'false'); await closeSheet({ silent: true }); S.go?.(a.getAttribute('href')); }; } });
}
// Capture: before a row's own click handler (a Bills or Legislators row opens its bill or legislator).
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const b = e.target?.closest?.('button[data-term]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (b.closest('dialog')) inlineTerm(b); else openTerm(b);
}, true);
// A list's own keys (Enter opens the bill, x ticks the row) must not fire while a term has focus.
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('keydown', e => { if (e.target?.matches?.('button[data-term]') && (e.key === 'Enter' || e.key === ' ' || e.key.length === 1)) e.stopPropagation(); }, true);
