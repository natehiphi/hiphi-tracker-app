// Committee pages (HANDOFF 3.5/3.6, plan wave 5a): browse every committee, and one committee's roster
// and current bills. No migration - public_committees, public_committee_members and
// public_committee_slots already exist and are already loaded into S.committees/S.committeeMembers/
// S.slots by core.js's loadBills(); this is new screens over data the app already has on boot.
import { S, esc, icon, blurb, nick, spaced, billPath, alive, stopOf, codesOf, cmteLabel, legsOf, legTitle, legPhoto, plainStatus } from './core.js';
import { btn, row, empty } from './ui.js';

const CHAMBER_NAME = { S: 'Senate', H: 'House' };
const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const roleWord = r => ({ chair: 'Chair', vice_chair: 'Vice chair', member: 'Member' })[r] || 'Member';

const allCommittees = () => Object.values(S.committees || {}).sort((a, b) => a.name.localeCompare(b.name));
const slotOf = code => (S.slots || []).find(s => s.code === code) || null;
// "Tuesday · 2:00 PM · Room 224" - only the parts we actually have.
function slotLine(slot) {
  if (!slot) return '';
  const day = WEEKDAY[slot.weekday] || '';
  const time = slot.start_time ? new Date(`2000-01-01T${slot.start_time}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  return [day, time, slot.room ? `Room ${slot.room}` : ''].filter(Boolean).join(' · ');
}

function committeeRow(c) {
  const slot = slotOf(c.code);
  return row({ title: esc(c.name), sub: [CHAMBER_NAME[c.chamber] || '', slotLine(slot)].filter(Boolean).join(' · '), href: `#/committee/${c.code}` });
}
function listPage() {
  const cs = allCommittees(), senate = cs.filter(c => c.chamber === 'S'), house = cs.filter(c => c.chamber === 'H');
  const rest = cs.filter(c => c.chamber !== 'S' && c.chamber !== 'H');
  if (!cs.length) return `<div class="cm">${empty({ title: 'We couldn’t load the committees', text: 'Check your connection and try again.' })}</div>`;
  return `<div class="cm">
    <div class="pagehead"><h1 class="hero">Committees</h1><p class="lede">Every Senate and House committee. A bill needs a "yes" from each one it is sent to before the full chamber votes.</p></div>
    ${senate.length ? `<div class="sechead"><h2>Senate</h2></div><div class="rows">${senate.map(committeeRow).join('')}</div>` : ''}
    ${house.length ? `<div class="sechead"><h2>House</h2></div><div class="rows">${house.map(committeeRow).join('')}</div>` : ''}
    ${rest.length ? `<div class="sechead"><h2>Other</h2></div><div class="rows">${rest.map(committeeRow).join('')}</div>` : ''}
  </div>`;
}

// Every live bill currently sitting in this one committee - the same pool-plus-followed source the
// legislator page uses, so a visitor with no follows still sees something real here too.
function billsAt(code) {
  const all = new Map();
  for (const b of S.bills || []) all.set(b.id, b);
  for (const b of (S.pool && S.pool.bills) || []) if (!all.has(b.id)) all.set(b.id, b);
  return [...all.values()].filter(b => alive(b) && codesOf(stopOf(b).committee).includes(code))
    .sort((a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
}
const billRow = b => row({ title: esc(nick(b) || blurb(b, 160)), sub: `${esc(spaced(b.bill_number))} · ${esc(plainStatus(b).short)}`, href: billPath(b), cls: 'cm-billrow' });
const memberRow = m => row({ leadHtml: legPhoto(m.l, 'cm-photo'), title: `${esc(legTitle(m.l))} ${esc(m.l.name)}`, sub: roleWord(m.role), href: `#/legislator/${m.l.id}` });
const backLink = () => `<a class="btn text cm-back" href="#/committees">${icon('arrow-left')}<span>All committees</span></a>`;

function detailPage(route) {
  const c = (S.committees || {})[route.code];
  if (!c) return `<div class="cm">${backLink()}${empty({ title: 'We couldn’t find that committee', text: 'The link may be old. Every committee is on the Committees page.', action: btn('See all committees', { kind: 'primary', href: '#/committees' }) })}</div>`;
  const members = legsOf(c.code), slot = slotOf(c.code), bills = billsAt(c.code);
  return `<div class="cm">
    ${backLink()}
    <div class="pagehead"><h1 class="hero">${esc(c.name)}</h1>
      <p class="lede">${esc(CHAMBER_NAME[c.chamber] || '')} committee${slot ? ` · Meets ${esc(slotLine(slot))}` : ''}</p></div>
    <div class="sechead"><h2>Members</h2></div>
    <div class="rows">${members.map(memberRow).join('')}</div>
    <div class="sechead"><h2>Bills here now</h2></div>
    ${bills.length ? `<div class="rows">${bills.map(billRow).join('')}</div>` : `<p class="small muted">Nothing right now.</p>`}
  </div>`;
}

export default {
  tab: 'more',
  title: route => route.name === 'committee' ? (cmteLabel(route.code, { short: true }) || 'Committee') : 'Committees',
  render(route) { return route.name === 'committee' ? detailPage(route) : listPage(); },
  wire() {},
};
