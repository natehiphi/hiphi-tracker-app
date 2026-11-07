// The letter act.html writes (R-360 part 2), ported small from the walkthrough (pub/helper.js letterParts, emailParts,
// mailAsk, mailSubject, sendLinks) and the words every letter shares (pub/hello.js whoLine, standLine). One wording each
// where those have a few (the walkthrough's vary picks one per person; here the first), and no "I'm a parent" titles, no
// partners' points: this page is one bill and one action. The letter is in pieces (PARTS) so a detail the person changes
// (their name, town, own line) swaps only the piece the text still has word for word, never what they typed (syncLetter).
import { spaced, timeWord, HST } from './words.js';

const sentence = s => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t && !/[.!?…"”)]$/.test(t) ? t + '.' : t; };
const closingOf = c => { const t = String(c || '').replace(/\s+/g, ' ').trim(); return t && !/[,.!]$/.test(t) ? t + ',' : t; };
const andList = xs => xs.length <= 1 ? xs.join('') : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// "San Buenaventura" from "Joy A. San Buenaventura": the directory's sort_name knows where a two-word surname starts
// (helper.js surname, P0.9). Without the directory, the last word of the name, its "Jr." or "III" left off.
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’'`.]/g, '')
  .replace(/,?\s+(jr|sr|ii|iii|iv)$/i, '').toLowerCase().replace(/\s+/g, ' ').trim();
export function surname(full, chamber, people = []) {
  const f = norm(full); let best = '';
  for (const l of people) {
    if (chamber && l.chamber !== chamber) continue;
    const sn = (l.sort_name || '').split(',')[0].trim(), n = norm(sn);
    if (n && (f === n || f.endsWith(' ' + n)) && sn.length > best.length) best = sn;
  }
  return best || String(full || '').replace(/,?\s+(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
}
// A chair's address: the directory's, else the Capitol's pattern (core.js chairEmail).
const chairEmail = (c, people) => {
  const sn = surname(c.name, c.chamber, people), l = people.find(p => p.chamber === c.chamber && (p.sort_name || '').split(',')[0].trim() === sn);
  return l?.email || `${c.chamber === 'S' ? 'sen' : 'rep'}${norm(sn).replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
};

// The person's stance is HIPHI's here (one bill, one action); "I see it differently" goes to the Capitol's own page.
export const stanceOf = B => /oppose/.test(B.positionRaw || '') ? 'oppose' : /support/.test(B.positionRaw || '') ? 'support' : 'comments';
const STAND = { strongly_support: n => `I strongly support ${n}.`, support: n => `I support ${n}.`, support_amend: n => `I support ${n}, with a few changes.`,
  strongly_oppose: n => `I strongly oppose ${n}.`, oppose: n => `I oppose ${n}.`, comments: n => `I’d like to share a few thoughts on ${n}.` };
const POS_WORD = { strongly_support: 'SUPPORT', support: 'SUPPORT', support_amend: 'SUPPORT WITH AMENDMENTS', strongly_oppose: 'OPPOSITION', oppose: 'OPPOSITION', neutral: 'COMMENTS' };
const headingFor = (word, n) => word === 'COMMENTS' ? `Comments on ${n}` : word === 'SUPPORT WITH AMENDMENTS' ? `Testimony in SUPPORT of ${n}, with amendments` : `Testimony in ${word} ${/OPPOS/.test(word) ? 'to' : 'of'} ${n}`;
const roomOf = r => { const m = /(?:Conference\s+)?Room\s+(\S+)/i.exec(r || '') || /^Rm\s+(\S+)/.exec(r || ''); return m ? `Room ${m[1]}` : ''; };

// Who they are: "My name is Leilani Kahale, and I live in Hilo." A detail not given yet leaves its words out.
function whoLine(name, town) {
  const n = String(name || '').trim(), t = String(town || '').trim();
  return n && t ? `My name is ${n}, and I live in ${t}.` : n ? `My name is ${n}.` : t ? `I live in ${t}.` : '';
}

export const PARTS = ['head', 'dear', 'open', 'pts', 'why', 'ask', 'close'];
// d: { name, town, own, closing }, people: the directory (data.js loadPeople).
export function letterParts(B, d, people = []) {
  const n = B.numberSpaced, stance = stanceOf(B), p = B.positionRaw, nm = String(d.name || '').trim();
  const open = [whoLine(nm, d.town), STAND[p] ? STAND[p](n) : STAND[stance] ? STAND[stance](n) : STAND.comments(n)].filter(Boolean).join(' ');
  const pts = (B.points || []).map(sentence).join(' ');
  const close = [closingOf(d.closing), nm].filter(Boolean).join('\n');
  if (B.action === 'testimony' && B.hearing) {
    const h = B.hearing, room = roomOf(h.room);
    const when = new Date(h.at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const who = h.members.map(m => `${m.role === 'chair' ? 'Chair' : 'Vice Chair'} ${surname(m.name, m.chamber, people)}`);
    const ask = stance === 'oppose' ? `Please don’t pass ${n}. Thank you for the chance to testify.` : stance === 'support' ? `Please pass ${n}. Thank you for the chance to testify.`
      : 'I hope my thoughts are useful as you decide.';
    return {
      head: [headingFor(POS_WORD[p] || 'COMMENTS', n), h.label, `Hearing: ${when} at ${timeWord(h.at)}${room ? ', ' + room : ''}`].join('\n'),
      dear: `Dear ${who.length ? who.join(', ') : 'Chair, Vice Chair'}, and members of the committee${h.joint ? 's' : ''},`,
      open, pts, why: sentence(d.own), ask, close,
    };
  }
  // An email to the chair of the committee the bill waits in, asking for a hearing (helper.js mailAsk, mode 'email').
  const to = mailTo(B, people);
  const ask = stance === 'oppose' ? `Please don’t schedule ${n} for a hearing.` : stance === 'support' ? `${n} is waiting in your committee. Would you please schedule a hearing for it?`
    : `I hope my thoughts are useful as you decide whether to hear ${n}.`;
  return { dear: `Aloha ${andList(to.map(t => t.greet)) || 'Chair'},`, open, pts, why: sentence(d.own), ask, close };
}
export const joinParts = p => PARTS.map(k => p[k]).filter(Boolean).join('\n\n');

// Who the email goes to: every chair of the committee the bill waits in. An email greets them as people say it,
// "Senator Keohokalole" (helper.js chairsTo, R-259).
export const mailTo = (B, people = []) => (B.committee?.chairs || []).map(c => ({
  greet: `${c.chamber === 'S' ? 'Senator' : 'Representative'} ${surname(c.name, c.chamber, people)}`,
  label: `${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${c.name}`, committee: c.committee, email: chairEmail(c, people) }));
// The subject: what they want, in a few plain words (helper.js mailSubject).
export function mailSubject(B) {
  const n = B.numberSpaced, s = stanceOf(B);
  return s === 'oppose' ? `${n}: please don’t schedule it` : s === 'support' ? `${n}: please schedule a hearing` : `${n}: a few thoughts`;
}

// The letter is kept in two parts (R-360 fix pass): the header (what the testimony is, the committees, the hearing) is
// written from the bill's data and shown as one quiet line above the box, and the body is what the box holds, so the box
// opens on the argument and not on an address block. What is copied, sent and saved is always the whole: header, then body.
export const BODY = PARTS.filter(k => k !== 'head');
export const joinBody = p => BODY.map(k => p[k]).filter(Boolean).join('\n\n');
export const wholeLetter = x => [x.head, x.body].filter(Boolean).join('\n\n');

// Brings the text up to date with the person's details (helper.js syncLetter, small): until they type in the letter it is
// simply the letter as written from their details; once they have, a changed detail swaps only the piece the text still has
// word for word. A piece they rewrote is left as they wrote it. The header always follows the data. x: { head, body, letter,
// built, edited }; x.letter is the whole letter.
export function syncLetter(x, now) {
  x.head = now.head || '';
  if (typeof x.body !== 'string') { x.body = ''; x.edited = false; }   // a draft kept before the header and body were apart
  if (!x.edited) { x.body = joinBody(now); x.built = now; x.letter = wholeLetter(x); return; }
  const old = x.built || now, built = { ...old }; let text = x.body;
  for (const k of BODY) {
    const a = old[k] || '', b = now[k] || '';
    if (a === b) continue;
    if (a) { if (text.includes(a)) { text = swap(text, a, b); built[k] = b; } continue; }
    // A piece the letter did not have (their own line, now written) goes in before the next piece the text still has.
    const later = BODY.slice(BODY.indexOf(k) + 1).map(j => old[j]).filter(s => s && text.includes(s));
    if (later.length) { const i = text.indexOf(later[0]); text = `${text.slice(0, i)}${b}\n\n${text.slice(i)}`; }
    else text = text.trim() ? `${text.replace(/\s+$/, '')}\n\n${b}` : b;
    built[k] = b;
  }
  x.body = text; x.built = built; x.letter = wholeLetter(x);
}
function swap(text, a, b) {
  const i = text.indexOf(a); let s = i, e = i + a.length;
  if (!b) { if (text.slice(e, e + 2) === '\n\n') e += 2; else if (s >= 2 && text.slice(s - 2, s) === '\n\n') s -= 2; return text.slice(0, s) + text.slice(e); }
  return text.slice(0, i) + b + text.slice(e);
}

// The three ways to open a new email that is already filled in (helper.js sendLinks). Links have a length limit (a mail app
// on Windows cuts a mailto near 2,000 characters; Gmail's and Outlook's addresses near 8,000), so a longer message leaves
// its body out and the screen says to paste it in: the message is copied in the same tap.
const MAILTO_MAX = 1900, WEB_MAX = 7500;
export function sendLinks(to, subj, letter) {
  const e = encodeURIComponent, body = letter.replace(/\r?\n/g, '\r\n'), addr = to.map(t => t.email).filter(Boolean);
  const mk = (base, max) => { const full = base(body); return full.length <= max ? { href: full, cut: false } : { href: base(''), cut: true }; };
  return {
    app: mk(bd => `mailto:${addr.join(',')}?subject=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, MAILTO_MAX),
    gmail: mk(bd => `https://mail.google.com/mail/?view=cm&fs=1&to=${e(addr.join(','))}&su=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, WEB_MAX),
    outlook: mk(bd => `https://outlook.live.com/mail/0/deeplink/compose?to=${e(addr.join(','))}&subject=${e(subj)}${bd ? `&body=${e(bd)}` : ''}`, WEB_MAX),
  };
}
