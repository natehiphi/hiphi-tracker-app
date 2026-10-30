// Committees and one committee's page in the calm redesign (R-303, behind ?rec=1; people-committees.md is the spec).
// pub/committees.js draws these when REC() is on and today's pages otherwise. The list leads with the committees hearing
// HIPHI's bills this week (the reason to come here in session), then the two chambers closed. A committee's page: its name
// and chair, ONE card when a hearing is set (the day, time and room, the testimony deadline, "Help me write testimony" for
// the soonest followed or HIPHI bill), HIPHI's bills here by what is due, and the members closed. Every meeting day is said
// (committees.js slotLine; taking only the first was a live bug).
import { S, app, esc, icon, nextSitting, nick, spaced, billPath, billRef, posInfo, alive, stopOf, legTitle, legsOf, legPhoto, codesOf, hearingWhen, roomLabel, CHAMBER_NAME, sessionInfo, HST } from '../core.js';
import { btn, loadFail } from '../ui.js';
import { testimonyTime } from '../actions.js';   // the one time promise (C-15, R-357 Light fixes e)
import { recHead, recSec, recRows, recMore, recFold, recFolds, recEmpty, wireKit, BOX } from './kit.js';
import { recAct, dueOf, byDue, billRow, billWords, pillFor, backRow, atWords } from './act.js';
import { allCommittees, billsAt, slotsOf, slotLine, cmteFailed, cmteFail } from '../committees.js';

const WEEK = 7 * 864e5;
// HIPHI's side, said at the end of a sentence about the bill.
const STANCE_IT = { strongly_support: 'HIPHI strongly supports it', support: 'HIPHI supports it', support_amend: 'HIPHI supports it with changes',
  strongly_oppose: 'HIPHI strongly opposes it', oppose: 'HIPHI opposes it', neutral: 'HIPHI has comments on it' };
const surname = l => (l.sort_name || l.name).split(',')[0].trim();
const roleWord = r => ({ chair: 'Chair', vice_chair: 'Vice chair', member: 'Member' })[r] || 'Member';
// "Usually": the weekly times are when it may sit; the next real hearing (below them) can differ (the fresh-eyes review).
const meets = code => slotsOf(code).length ? `Usually meets ${slotLine(slotsOf(code))}` : '';
// "Yours" (R-212 #42): the person's own senator or representative, from the districts the lawmaker finder saved on this
// device (the two numbers, never the address), as the bill page says it.
function myDistricts() { try { const d = JSON.parse(localStorage.getItem('hiphi_districts') || 'null'); return d && (d.senate || d.house) ? d : null; } catch { return null; } }
const yoursWord = l => { const d = myDistricts(); return !l || !d ? '' : l.chamber === 'S' && +l.district === +d.senate ? 'Your senator'
  : l.chamber === 'H' && +l.district === +d.house ? 'Your representative' : ''; };
const yoursIn = code => legsOf(code).map(m => ({ m, w: yoursWord(m.l) })).find(x => x.w);
// Every bill the page knows: the person's own, HIPHI's pool and the featured ones (core.js loadBills).
function billMap() {
  const m = new Map();
  for (const b of [...(S.bills || []), ...((S.pool || {}).bills || []), ...((S.featured || {}).bills || [])]) if (!m.has(b.id)) m.set(b.id, b);
  return m;
}
const hearingsAll = () => [...new Map([...(S.hearings || []), ...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || [])].map(h => [h.id, h])).values()];
// A bill worth a row or the card here: one the person follows, or one HIPHI takes a side on.
const ours = b => !!b && (S.watch?.has(b.id) || !!posInfo(b));
// Hearings still ahead in this committee (a joint hearing counts for both), the soonest first, a followed bill first on a tie.
function hearingsAt(code, until = Infinity) {
  const bills = billMap(), now = Date.now();
  return hearingsAll().filter(h => h.status === 'scheduled' && Date.parse(h.scheduled_at) > now && Date.parse(h.scheduled_at) < until && codesOf(h.committee).includes(code))
    // only a bill that is at this committee now (the bill page's stop): the practice copy keeps a hearing "scheduled" after
    // the committee's report is in and the bill has moved on
    .map(h => ({ h, b: bills.get(h.bill_id) })).filter(x => ours(x.b) && alive(x.b) && codesOf(stopOf(x.b).committee).includes(code))
    .sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at) || (S.watch?.has(y.b.id) ? 1 : 0) - (S.watch?.has(x.b.id) ? 1 : 0));
}

// ---------------- every committee ----------------
export function recList() {
  const cs = allCommittees(), back = backRow('#/legislators', 'Your lawmakers');
  // They did not load (R-212 #49): said under the page's name, with Try again (committees.js cmteFail).
  if (!cs.length || cmteFailed()) return `<div class="cmt rc cmt-rec">${back}${recHead({ title: 'Committees' })}${cmteFail('the committees', 'h2')}</div>`;
  // This week's hearings on followed and HIPHI bills, one row per committee sitting (a joint hearing once), naming the bill
  // (the fresh-eyes review: six committee names said nothing about which hearing matters), the person's own bills first.
  const until = Date.now() + WEEK, sit = new Map();
  for (const c of cs) for (const x of hearingsAt(c.code, until)) {
    const key = codesOf(x.h.committee).sort().join('/') + '|' + x.h.scheduled_at, g = sit.get(key) || { h: x.h, codes: codesOf(x.h.committee).filter(k => S.committees[k]), bills: new Map() };
    g.bills.set(x.b.id, x.b); sit.set(key, g);
  }
  // By date; a row with a bill the person follows names that bill first and says "On your issues" (the critic: followed rows
  // first looked like a broken order). A joint hearing in the word list's form (C-15).
  const mineFirst = b => S.watch?.has(b.id) ? 0 : 1;
  const week = [...sit.values()].map(g => ({ ...g, bills: [...g.bills.values()].sort((a, b) => mineFirst(a) - mineFirst(b)) }))
    .sort((a, b) => a.h.scheduled_at.localeCompare(b.h.scheduled_at));
  const NUM = ['', 'one', 'two', 'three', 'four'];
  const weekRow = g => { const c0 = S.committees[g.codes[0]] || {}, n = g.bills.length, ch = CHAMBER_NAME[c0.chamber] || '', names = g.codes.map(k => S.committees[k].name);
    return { name: names.length > 1 ? `${NUM[names.length] || names.length} ${ch} committees: ${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`.replace(/^\w/, c => c.toUpperCase()) : `${ch} ${names[0]}`.trim(),
      href: `#/committee/${g.codes[0]}`,
      text: [S.watch?.has(g.bills[0].id) ? 'On your issues' : '', `${billWords(g.bills[0])}${n > 1 ? `, and ${n - 1} more` : ''}`, hearingWhen(g.h.scheduled_at), g.h.room ? roomLabel(g.h.room) : ''].filter(Boolean).join(' · ') }; };
  const fold = (ch, title) => { const list = cs.filter(c => c.chamber === ch); if (!list.length) return '';
    return recFold('cmt-' + ch, title, `${list.slice(0, 2).map(c => c.name).join(', ')}, and more`, recRows(list.map(c => { const y = yoursIn(c.code); return { name: c.name, text: [y ? `${y.w} is a member` : '', meets(c.code)].filter(Boolean).join(' · '), href: `#/committee/${c.code}` }; }))); };
  return `<div class="cmt rc cmt-rec">${back}
    ${recHead({ title: 'Committees', lede: 'A bill needs a yes from each committee it is sent to before the full Senate or House votes on it.' })}
    ${recSec('cmt-wk', 'Hearing HIPHI’s bills this week', week.length ? recMore(week.map(weekRow), 6, 'cmt-wk', BOX)
      : `<p class="rc-note cmt-none">No hearings on HIPHI’s bills are set for the next seven days.</p>`)}
    ${recFolds([fold('S', 'Senate committees'), fold('H', 'House committees')])}</div>`;
}

// ---------------- one committee ----------------
export function recDetail(route) {
  const c = (S.committees || {})[route.code], back = backRow('#/committees', 'Committees');
  if (!c && cmteFailed()) return `<div class="cmt rc cmt-rec">${back}${cmteFail('this committee')}</div>`;   // never "the link may be old" (R-212 #49)
  if (!c) return `<div class="cmt rc cmt-rec">${back}${recHead({ title: 'We couldn’t find that committee' })}${recEmpty('The link may be old. Every committee is on the Committees page.', btn('Committees', { kind: 'secondary', href: '#/committees' }))}</div>`;
  const members = legsOf(c.code), chair = members.find(m => m.role === 'chair'), next = hearingsAt(c.code)[0];
  // The card: the soonest hearing here for a followed or HIPHI bill.
  let card = '';
  if (next) {
    const { h, b } = next, dl = h.testimony_deadline && Date.parse(h.testimony_deadline) > Date.now() ? h.testimony_deadline : '';
    const stance = STANCE_IT[b.hiphi_position] ? `, and ${STANCE_IT[b.hiphi_position]}` : '';
    const where = h.room ? ` in ${roomLabel(h.room)}` : '';
    card = recAct({ id: 'cmt-act-h', when: dl ? `Testimony due ${hearingWhen(dl)}` : `Hearing ${hearingWhen(h.scheduled_at)}`, left: pillFor(dl || h.scheduled_at),
      warn: Date.parse(dl || h.scheduled_at) - Date.now() < 864e5, title: `Speak up for ${nick(b) || spaced(b.bill_number)}`,
      text: `${c.name} hears ${spaced(b.bill_number)} ${atWords(h.scheduled_at)}${where}${stance}.${dl ? '' : ' The written deadline has passed, but late testimony is still read.'}`,
      button: btn('Help me write testimony', { kind: 'primary', icon: 'notebook-pen', full: true, href: billPath(b) + '/testify' }),
      // "Email the chair" is in the head, for every committee (R-212 #42), so the card no longer repeats it (A-14).
      more: `${testimonyTime().replace(/^a/, 'A')}.` });
  }
  // HIPHI's bills here, by what is due; the card's own bill says so rather than repeating it (A-14).
  const bills = billsAt(c.code).filter(ours).map(b => ({ b, due: dueOf(b, c.code) })).sort(byDue);
  const list = bills.length ? recMore(bills.map(x => billRow(x.b, x.due, { href: billPath(x.b), note: next && x.b.id === next.b.id ? (matchMedia('(min-width: 1100px)').matches ? 'In the card at the right' : 'In the card above') : '' })), 6, 'cmt-bills', BOX)
    : recEmpty('None of HIPHI’s bills are here now.', `<a class="rc-tlink cmt-all" href="#/allbills">Every bill HIPHI tracks</a>`);
  // The preview leaves out the chair, named in the head (A-14): "Sen. Kidani (vice chair) and 3 more".
  // Your own lawmaker leads it when they sit here (R-212 #42), unless they are the chair, who the head names.
  const mine = members.filter(m => m.role !== 'chair' && yoursWord(m.l)).map(m => `${legTitle(m.l)} ${surname(m.l)} (${yoursWord(m.l).toLowerCase()})`);
  const lead = [...mine, ...members.filter(m => m.role === 'vice_chair' && !yoursWord(m.l)).map(m => `${legTitle(m.l)} ${surname(m.l)} (vice chair)`)];
  const others = members.length - lead.length;   // the chair counts in "more", so the preview adds up to the list (the critic)
  const prev = [...lead, others > 0 ? `${others} more` : ''].filter(Boolean);
  const mem = members.length ? recFold('cmt-members', 'Members', prev.length > 1 ? `${prev.slice(0, -1).join(', ')} and ${prev[prev.length - 1]}` : prev.join(''),
    recRows(members.map(m => ({ name: `${legTitle(m.l)} ${m.l.name}`, text: [roleWord(m.role), yoursWord(m.l)].filter(Boolean).join(' · '), href: `#/legislator/${m.l.id}`, leadHtml: legPhoto(m.l, 'cm-photo') })))) : '';
  // The chair, and "Email the chair" (R-212 #42): their page with an email ready about the bill here that is due soonest (the
  // card's, else HIPHI's first here), or a short hello when none of HIPHI's bills are here. A-12: the link says where it goes.
  const yc = chair?.l ? yoursWord(chair.l) : '', about = next?.b || bills[0]?.b;
  const chairLink = chair?.l ? `<a class="rc-link" href="#/legislator/${chair.l.id}">${icon('user')}<span>Chair: ${esc(legTitle(chair.l))} ${esc(chair.l.name)}${yc ? ` (${esc(yc.toLowerCase())})` : ''}</span></a>`
    + (chair.l.email ? `<a class="rc-link cmt-mail" href="#/legislator/${chair.l.id}${about ? `?from=${encodeURIComponent(billRef(about))}` : ''}" aria-label="Email the chair, on ${esc(legTitle(chair.l))} ${esc(surname(chair.l))}’s page${about ? `, about ${esc(spaced(about.bill_number))}` : ''}">${icon('mail')}<span>Email the chair</span></a>` : '') : '';
  const head = recHead({ eye: `${CHAMBER_NAME[c.chamber] || ''} committee`.trim(), title: c.name, lede: meets(c.code), extra: nextLine(c.code, next?.h.scheduled_at) + chairLink });
  const rest = `${recSec('cmt-bills', 'HIPHI’s bills here', list)}${recFolds([agendaFold(c.code), mem])}`;
  // With a card, a laptop puts it at the side, as the bill page and a lawmaker's page do (rc-cols).
  return card ? `<div class="cmt rc rc-wide cmt-rec">${back}<div class="rc-cols"><div class="cmt-rmain">${head}</div><aside class="rc-side" aria-label="Take part">${card}</aside><div class="cmt-rmain">${rest}</div></div></div>`
    : `<div class="cmt rc cmt-rec">${back}${head}${rest}</div>`;
}

// ---------------- the next hearing (R-212 #42) ----------------
// The real next sitting, any bill (core.js nextSitting), under the weekly times: "Meets" is when it may sit, this is when it
// does. Asked once a visit; the page is drawn again when it answers.
function sitting(code) {
  const n = S.cmteNext?.[code];
  if (n === undefined) nextSitting(code).then(() => { if (location.hash.split('?')[0] === `#/committee/${code}`) app.render(); });
  return n;
}
const nBills = n => `${n} bill${n === 1 ? '' : 's'}`;
// Between sessions there is nothing to wait for until opening day; in session a hearing is posted a few days before it sits.
function noneWords() {
  const si = sessionInfo();
  return si.phase === 'in' || !si.nextOpen ? 'No hearing is set yet. Committees post each hearing a few days before it.'
    : `No hearings until the session opens on ${new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric', year: 'numeric' })}.`;
}
// When the card is that same sitting the card says it, and the head says nothing more (A-14); its agenda is the fold below.
function nextLine(code, cardAt = '') {
  const n = sitting(code);
  if (n && typeof n === 'object' && n.at === cardAt) return '';
  // It did not load, or did not answer in time (core.js nextSitting): one line and Try again, in its place (R-212 #49).
  if (n === 'error') return loadFail({ inline: true, what: 'the next hearing', id: 'cmt-nexterr', cls: 'cmt-next', retry: { 'data-cmt-next': code } });
  const text = n === undefined || n === 'loading' ? 'Looking up the next hearing…'
    : !n ? noneWords()
    : `Next hearing ${hearingWhen(n.at)}${n.room ? ` · ${roomLabel(n.room)}` : ''}`;   // how many bills: the fold below (A-14)
  return `<p class="cmt-next${n && typeof n === 'object' ? '' : ' muted'}">${icon('calendar')}<span>${esc(text)}</span></p>`;
}
// Every bill on that agenda, closed like the cards beside it (B-6): HIPHI's first, a bill the person follows says so.
function agendaFold(code) {
  const n = S.cmteNext?.[code];
  if (!n || typeof n !== 'object' || !n.bills.length) return '';
  const ours = n.bills.filter(b => posInfo(b)).length, joint = codesOf(n.committee).filter(k => k !== code && S.committees?.[k]).map(k => S.committees[k].name);
  const dl = n.deadline && Date.parse(n.deadline) > Date.now() ? `Testimony is due ${hearingWhen(n.deadline)}.` : '';
  const note = [joint.length ? `A joint hearing with ${joint.join(' and ')}.` : '', dl].filter(Boolean).join(' ');
  return recFold('cmt-agenda', 'Bills at the next hearing', `${nBills(n.bills.length)}${ours === n.bills.length ? (ours === 1 ? ', HIPHI’s' : ', all HIPHI’s') : ours ? `, ${ours} of them HIPHI’s` : ''}`,
    (note ? `<p class="rc-note cmt-anote">${esc(note)}</p>` : '')
    // The row's own due line would only repeat the hearing above it (A-14): its number, HIPHI's side, and whether you follow it.
    + recMore(n.bills.map(b => ({ ...billRow(b, dueOf(b, code), { href: billPath(b) }), warn: false,
      text: [spaced(b.bill_number), posInfo(b)?.text || '', S.watch?.has(b.id) ? 'You follow it' : ''].filter(Boolean).join(' · ') })), 8, 'cmt-agenda'));
}

export function wireRec() {
  const root = document.querySelector('.cmt-rec'); if (!root) return;
  wireKit(root);
  root.querySelectorAll('[data-cmt-next]').forEach(el => el.onclick = () => { delete S.cmteNext[el.dataset.cmtNext]; app.render(); });
}
