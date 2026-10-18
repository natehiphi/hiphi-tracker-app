// Committees and one committee's page in the calm redesign (R-303, behind ?rec=1; people-committees.md is the spec).
// pub/committees.js draws these when REC() is on and today's pages otherwise. The list leads with the committees hearing
// HIPHI's bills this week (the reason to come here in session), then the two chambers closed. A committee's page: its name
// and chair, ONE card when a hearing is set (the day, time and room, the testimony deadline, "Help me write testimony" for
// the soonest followed or HIPHI bill), HIPHI's bills here by what is due, and the members closed. Every meeting day is said
// (committees.js slotLine; taking only the first was a live bug).
import { S, esc, icon, nick, spaced, billPath, billRef, posInfo, alive, stopOf, legTitle, legsOf, legPhoto, codesOf, hearingWhen, roomLabel, CHAMBER_NAME } from '../core.js';
import { btn } from '../ui.js';
import { recHead, recSec, recRows, recMore, recFold, recFolds, recWay, recEmpty, wireKit } from './kit.js';
import { recAct, dueOf, byDue, billRow, billWords, pillFor, backRow, atWords } from './act.js';
import { allCommittees, billsAt, slotsOf, slotLine } from '../committees.js';

const WEEK = 7 * 864e5;
// HIPHI's side, said at the end of a sentence about the bill.
const STANCE_IT = { strongly_support: 'HIPHI strongly supports it', support: 'HIPHI supports it', support_amend: 'HIPHI supports it with changes',
  strongly_oppose: 'HIPHI strongly opposes it', oppose: 'HIPHI opposes it', neutral: 'HIPHI has comments on it' };
const surname = l => (l.sort_name || l.name).split(',')[0].trim();
const roleWord = r => ({ chair: 'Chair', vice_chair: 'Vice chair', member: 'Member' })[r] || 'Member';
const meets = code => slotsOf(code).length ? `Meets ${slotLine(slotsOf(code))}` : '';
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
  if (!cs.length) return `<div class="cmt rc cmt-rec">${back}${recHead({ title: 'Committees' })}${recEmpty('We couldn’t load the committees. Check your connection and try again.')}</div>`;
  // This week's hearings on followed and HIPHI bills, one row per committee sitting (a joint hearing once), naming the bill
  // (the fresh-eyes review: six committee names said nothing about which hearing matters), the person's own bills first.
  const until = Date.now() + WEEK, sit = new Map();
  for (const c of cs) for (const x of hearingsAt(c.code, until)) {
    const key = codesOf(x.h.committee).sort().join('/') + '|' + x.h.scheduled_at, g = sit.get(key) || { h: x.h, codes: codesOf(x.h.committee).filter(k => S.committees[k]), bills: new Map() };
    g.bills.set(x.b.id, x.b); sit.set(key, g);
  }
  const mineFirst = b => S.watch?.has(b.id) ? 0 : 1;
  const week = [...sit.values()].map(g => ({ ...g, bills: [...g.bills.values()].sort((a, b) => mineFirst(a) - mineFirst(b)) }))
    .sort((a, b) => mineFirst(a.bills[0]) - mineFirst(b.bills[0]) || a.h.scheduled_at.localeCompare(b.h.scheduled_at));
  const weekRow = g => { const c0 = S.committees[g.codes[0]] || {}, n = g.bills.length;
    return { name: `${CHAMBER_NAME[c0.chamber] || ''} ${g.codes.map(k => S.committees[k].name).join(' and ')}`.trim(), href: `#/committee/${g.codes[0]}`,
      text: [`${billWords(g.bills[0])}${n > 1 ? `, and ${n - 1} more` : ''}`, hearingWhen(g.h.scheduled_at), g.h.room ? roomLabel(g.h.room) : ''].filter(Boolean).join(' · ') }; };
  const fold = (ch, title) => { const list = cs.filter(c => c.chamber === ch); if (!list.length) return '';
    return recFold('cmt-' + ch, title, `${list.slice(0, 2).map(c => c.name).join(', ')}, and more`, recRows(list.map(c => ({ name: c.name, text: meets(c.code), href: `#/committee/${c.code}` })))); };
  return `<div class="cmt rc cmt-rec">${back}
    ${recHead({ title: 'Committees', lede: 'A bill needs a yes from each committee it is sent to before the full Senate or House votes on it.' })}
    ${recSec('cmt-wk', 'Hearing HIPHI’s bills this week', week.length ? recMore(week.map(weekRow), 6, 'cmt-wk')
      : `<p class="rc-note cmt-none">No hearings on HIPHI’s bills are set for the next seven days.</p>`)}
    ${recFolds([fold('S', 'Senate committees'), fold('H', 'House committees')])}</div>`;
}

// ---------------- one committee ----------------
export function recDetail(route) {
  const c = (S.committees || {})[route.code], back = backRow('#/committees', 'Committees');
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
      more: 'About 15 minutes the first time, a few after that.',
      // The chair is named in the head; this row opens her page with an email about the bill ready (A-12: says where it goes).
      ways: chair?.l ? recWay('user', 'Write to the chair', `On ${legTitle(chair.l)} ${surname(chair.l)}’s page, an email about ${spaced(b.bill_number)} is ready`, { href: `#/legislator/${chair.l.id}?from=${encodeURIComponent(billRef(b))}` }) : '' });
  }
  // HIPHI's bills here, by what is due; the card's own bill says so rather than repeating it (A-14).
  const bills = billsAt(c.code).filter(ours).map(b => ({ b, due: dueOf(b, c.code) })).sort(byDue);
  const list = bills.length ? recMore(bills.map(x => billRow(x.b, x.due, { href: billPath(x.b), note: next && x.b.id === next.b.id ? 'In the card above' : '' })), 6, 'cmt-bills')
    : recEmpty('None of HIPHI’s bills are here now.', `<a class="rc-tlink cmt-all" href="#/allbills">Every bill HIPHI tracks</a>`);
  // The preview leaves out the chair, named in the head (A-14): "Sen. Kidani (vice chair) and 3 more".
  const lead = members.filter(m => m.role === 'vice_chair').map(m => `${legTitle(m.l)} ${surname(m.l)} (vice chair)`);
  const others = members.length - lead.length - (chair ? 1 : 0);
  const prev = [...lead, others > 0 ? `${others} more` : ''].filter(Boolean);
  const mem = members.length ? recFold('cmt-members', 'Members', prev.length > 1 ? `${prev.slice(0, -1).join(', ')} and ${prev[prev.length - 1]}` : prev.join(''),
    recRows(members.map(m => ({ name: `${legTitle(m.l)} ${m.l.name}`, text: roleWord(m.role), href: `#/legislator/${m.l.id}`, leadHtml: legPhoto(m.l, 'cm-photo') })))) : '';
  const chairLink = chair?.l ? `<a class="rc-link" href="#/legislator/${chair.l.id}">${icon('user')}<span>Chair: ${esc(legTitle(chair.l))} ${esc(chair.l.name)}</span></a>` : '';
  const head = recHead({ eye: `${CHAMBER_NAME[c.chamber] || ''} committee`.trim(), title: c.name, lede: meets(c.code), extra: chairLink }), rest = `${recSec('cmt-bills', 'HIPHI’s bills here', list)}${recFolds([mem])}`;
  // With a card, a laptop puts it at the side, as the bill page and a lawmaker's page do (rc-cols).
  return card ? `<div class="cmt rc rc-wide cmt-rec">${back}<div class="rc-cols"><div class="cmt-rmain">${head}</div><aside class="rc-side" aria-label="Take part">${card}</aside><div class="cmt-rmain">${rest}</div></div></div>`
    : `<div class="cmt rc cmt-rec">${back}${head}${rest}</div>`;
}

export function wireRec() { const root = document.querySelector('.cmt-rec'); if (root) wireKit(root); }
