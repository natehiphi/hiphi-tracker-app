// Committee pages (HANDOFF 3.5/3.6, plan wave 5a): browse every committee, and one committee's roster
// and current bills. No migration - public_committees, public_committee_members and
// public_committee_slots already exist and are already loaded into S.committees/S.committeeMembers/
// S.slots by core.js's loadBills(); this is new screens over data the app already has on boot.
import { S, esc, icon, blurb, nick, spaced, billPath, alive, stopOf, codesOf, cmteLabel, legsOf, legTitle, legPhoto, plainStatus, sessionWords } from './core.js';
import { btn, row, empty } from './ui.js';
// The calm redesign (R-303), only with ?rec=1: pub/rec/committees.js lays these pages out; taking it away brings today's back.
import { REC } from './rec/kit.js';
import { recList, recDetail, wireRec } from './rec/committees.js';

const CHAMBER_NAME = { S: 'Senate', H: 'House' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const roleWord = r => ({ chair: 'Chair', vice_chair: 'Vice chair', member: 'Member' })[r] || 'Member';

export const allCommittees = () => Object.values(S.committees || {}).sort((a, b) => a.name.localeCompare(b.name));
// Every weekly slot a committee has: each has two to six (R-303, bug 2: taking only the first said "Meets Monday" for a
// committee that meets Monday, Wednesday and Friday, beside its own bills' "Hearing Wed").
export const slotsOf = code => (S.slots || []).filter(s => s.code === code).sort((a, b) => a.weekday - b.weekday);
const timeOf = t => t ? new Date(`2000-01-01T${t}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
const andList = xs => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// "Mon, Wed and Fri", and a run of three or more days in a row as "Mon to Fri".
function daysWord(ds) {
  const runs = [];
  for (const d of ds) { const r = runs[runs.length - 1]; if (r && d === r[1] + 1) r[1] = d; else runs.push([d, d]); }
  return andList(runs.flatMap(([a, b]) => b - a >= 2 ? [`${WD[a]} to ${WD[b]}`] : b > a ? [WD[a], WD[b]] : [WD[a]]));
}
// "Mon, Wed and Fri · 1:00 PM · Room 229"; slots at different times or rooms are said group by group. One slot keeps its
// whole day name ("Tuesday · 2:00 PM · Room 224"). Only the parts we actually have.
export function slotLine(slots) {
  const list = Array.isArray(slots) ? slots : slots ? [slots] : [];
  if (!list.length) return '';
  if (list.length === 1) { const s = list[0]; return [WEEKDAY[s.weekday] || '', timeOf(s.start_time), s.room ? `Room ${s.room}` : ''].filter(Boolean).join(' · '); }
  const groups = new Map();
  for (const s of list) { const k = `${s.start_time || ''}|${s.room || ''}`; if (!groups.has(k)) groups.set(k, { s, days: [] }); groups.get(k).days.push(s.weekday); }
  return [...groups.values()].map(({ s, days }) => [daysWord(days), timeOf(s.start_time), s.room ? `Room ${s.room}` : ''].filter(Boolean).join(' · ')).join('; ');
}
const slotOf = code => slotsOf(code);

function committeeRow(c) {
  const slot = slotOf(c.code);
  return row({ title: esc(c.name), sub: [CHAMBER_NAME[c.chamber] || '', esc(slotLine(slot))].filter(Boolean).join(' · '), href: `#/committee/${c.code}` });
}
function listPage() {
  const cs = allCommittees(), senate = cs.filter(c => c.chamber === 'S'), house = cs.filter(c => c.chamber === 'H');
  const rest = cs.filter(c => c.chamber !== 'S' && c.chamber !== 'H');
  if (!cs.length) return `<div class="cmt">${empty({ title: 'We couldn’t load the committees', text: 'Check your connection and try again.' })}</div>`;
  return `<div class="cmt">
    <div class="pagehead"><h1 class="hero">Committees</h1><p class="lede">Every Senate and House committee. A bill needs a "yes" from each one it is sent to before the full chamber votes.</p></div>
    ${senate.length ? `<div class="sechead"><h2>Senate</h2></div><div class="rows">${senate.map(committeeRow).join('')}</div>` : ''}
    ${house.length ? `<div class="sechead"><h2>House</h2></div><div class="rows">${house.map(committeeRow).join('')}</div>` : ''}
    ${rest.length ? `<div class="sechead"><h2>Other</h2></div><div class="rows">${rest.map(committeeRow).join('')}</div>` : ''}
  </div>`;
}

// Every live bill currently sitting in this one committee - the same pool-plus-followed source the
// legislator page uses, so a visitor with no follows still sees something real here too.
export function billsAt(code) {
  const all = new Map();
  for (const b of S.bills || []) all.set(b.id, b);
  for (const b of (S.pool && S.pool.bills) || []) if (!all.has(b.id)) all.set(b.id, b);
  return [...all.values()].filter(b => alive(b) && codesOf(stopOf(b).committee).includes(code))
    .sort((a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
}
const billRow = b => row({ title: esc(nick(b) || blurb(b, 160)), sub: `${esc(spaced(b.bill_number))} · ${esc(plainStatus(b).short)}`, href: billPath(b), cls: 'cm-billrow' });
const memberRow = m => row({ leadHtml: legPhoto(m.l, 'cm-photo'), title: `${esc(legTitle(m.l))} ${esc(m.l.name)}`, sub: roleWord(m.role), href: `#/legislator/${m.l.id}` });
const backLink = () => `<a class="btn text cm-back" href="#/committees" data-back>${icon('arrow-left')}<span>All committees</span></a>`;

function detailPage(route) {
  const c = (S.committees || {})[route.code];
  if (!c) return `<div class="cmt">${backLink()}${empty({ h: 'h1', title: 'We couldn’t find that committee', text: 'The link may be old. Every committee is on the Committees page.', action: btn('See all committees', { kind: 'primary', href: '#/committees' }) })}</div>`;
  const members = legsOf(c.code), slot = slotOf(c.code), bills = billsAt(c.code);
  return `<div class="cmt">
    ${backLink()}
    <div class="pagehead"><h1 class="hero">${esc(c.name)}</h1>
      <p class="lede">${esc(CHAMBER_NAME[c.chamber] || '')} committee${slot.length ? ` · Meets ${esc(slotLine(slot))}` : ''}</p></div>
    <div class="sechead"><h2>Members</h2></div>
    <div class="rows">${members.map(memberRow).join('')}</div>
    <div class="sechead"><h2>Bills here now</h2>${bills.length ? `<span class="meta">${bills.length} bill${bills.length === 1 ? '' : 's'} · ${esc(sessionWords(bills))}</span>` : ''}</div>
    ${bills.length ? `<div class="rows">${bills.map(billRow).join('')}</div>` : `<p class="small muted">Nothing right now.</p>`}
  </div>`;
}

export default {
  tab: 'more',
  title: route => route.name === 'committee' ? (S.committees?.[route.code] ? cmteLabel(route.code, { short: true }) : 'Committee not found') : 'Committees',   // not "the ZZZ committee" for a bad link (R-067)
  render(route) { return REC() ? (route.name === 'committee' ? recDetail(route) : recList()) : route.name === 'committee' ? detailPage(route) : listPage(); },
  wire(route) { if (REC()) wireRec(route); },
};
