// Staff v2 · one hearing (#/hearing/:id, R-022 wave 3 #16). A person comes here to get ready for one committee sitting (B-1).
// The database keeps a hearing per bill; a sitting is every one of those rows with the same committee and start time,
// so the page shows the whole agenda the team tracks, whichever of its bills the link came from.
// Phone, one column: the committee, when and where, the testimony deadline, the notice and the video; our bills on the
// agenda (position, owner, testimony state, and after the sitting its result); who from the team is going; the
// committee's members and where they stand on these bills. Desktop (900px and wider) is two columns, like a
// legislator's page: the agenda and the members on the left, and a side panel that stays in view with who is going,
// the notice and the video.
// Going: a person is marked on ONE of the sitting's rows, and "going" means marked on any of them, which is how the Week
// view reads it too. One row and not ten, because the database sends a Slack message for every row an admin sends a
// teammate to (migration 064); the row is a bill with a position, so the hearing reaches their calendar invite.
import { S, DB, esc, fmtDT, advocate, capitolUrl } from './data.js';
import { CHAMBER_NAME } from '../stops.js';
import { codesOf, cmteName, streamOf, draftFor, attendees, billById, billNum, blurb, legsOf, stanceOf, OUTCOME_LABEL, hearingAhead } from './model.js';
import { icon, btn, iconBtn, chip, empty, notice, toast, pickerSheet, avatar, countdown, posIcons, POS_WORD } from './ui.js';
import { photo, legName, partyDist, roleWord, legHref, wireLinks } from './pathway.js';
import { rerender } from './bill.js';

const HR = 36e5, FOLD = 10;
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
const hearingById = id => (S.hearings || []).find(h => String(h.id) === String(id)) || null;
const isPos = b => !!b.position && b.position !== 'monitor';
const first = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
const HST = { timeZone: 'Pacific/Honolulu' };

// ---- the sitting, shared with the coalition page (and anyone else who draws a hearing) ----
export const sittingOf = h => (S.hearings || []).filter(x => x.committee === h.committee && x.scheduled_at === h.scheduled_at);
// Bills with a position first (P1 first), then the ones we only monitor, then by number.
const byAgenda = (x, y) => isPos(y.b) - isPos(x.b) || (x.b.priority || 9) - (y.b.priority || 9) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true });
export const agendaOf = h => sittingOf(h).map(r => ({ h: r, b: billById(r.bill_id) })).filter(x => x.b && x.b.tracked !== false).sort(byAgenda);
// Everyone marked on any bill of the sitting, you first.
export function goersOf(rows) {
  const seen = new Set();
  return rows.flatMap(r => attendees(r)).filter(a => !seen.has(a.id) && seen.add(a.id))
    .sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
}
// "You and Lauren are going", "Lauren is going"; '' when nobody is.
export function goingWords(goers, { past = false } = {}) {
  const names = goers.map(a => a.id === S.me?.id ? 'You' : first(a)); if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const one = names.length === 1 && names[0] !== 'You';
  return `${list} ${past ? (one ? 'was' : 'were') : (one ? 'is' : 'are')} going`;
}

// ---- words and chips ----
const chamberOf = code => { const c = codesOf(code).map(k => S.committees?.[k]).find(Boolean); return c ? CHAMBER_NAME[c.chamber] : ''; };
const longDay = iso => new Date(iso).toLocaleDateString('en-US', { ...HST, weekday: 'long', month: 'long', day: 'numeric' });
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
// "Room 229": the Capitol's "Conference Room" is every room there, and the short form keeps the line to one on a phone.
const roomOf = r => String(r || '').replace(/\s*(&|and|via)\s*videoconference/i, '').replace(/^Conference Room\s+/i, 'Room ').trim();
// Written testimony is due at the notice's deadline, else 24 hours before the hearing (the Hawaiʻi rule; bill.js dueOf).
export const dueOf = h => h.testimony_deadline || new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString();
const draftOf = x => (S.drafts?.[x.b.id] || []).find(d => d.hearing_id && d.hearing_id === x.h.id && d.status !== 'cancelled') || draftFor(x.b.id, x.h.committee) || null;
// Where a bill's testimony for one hearing stands, in words and an icon, never colour alone (A-5). The coalition page
// uses the same words for a sitting's testimony that is not filed yet.
export function testimonyOf(h, b) {
  const d = draftOf({ h, b });
  if (!d) return { filed: false, word: 'not started', label: 'No testimony yet', icon: 'file-text' };
  if (d.status === 'filed') return { filed: true, word: 'filed', label: 'Testimony filed', icon: 'check' };
  const st = b.current_version && (d.version || null) !== b.current_version ? ['out of date', 'triangle-alert']
    : d.status === 'approved' ? ['ready to file', 'clipboard-check'] : d.status === 'second_review' ? ['at 2nd approval', 'hourglass']
    : d.status === 'review' ? ['in review', 'hourglass'] : d.review_note ? ['sent back', 'undo-2'] : ['in draft', 'pencil'];
  return { filed: false, word: st[0], label: `Testimony ${st[0]}`, icon: st[1] };
}
// Amber once the deadline is inside 24 hours, red once it has passed: the countdown's own two tones, which staff.css keeps
// for exactly those (A-5).
export const dueTone = iso => { const ms = new Date(iso) - Date.now(); return ms <= 0 ? 'late' : ms <= 864e5 ? 'soon' : ''; };
const OUT_ICON = { passed: 'circle-check', passed_amended: 'circle-check', deferred: 'circle-x', recommitted: 'undo-2' };
// The Capitol posts a decision a while after the sitting, so "no result yet" is a normal state, not an error.
function outcomeChip(h) {
  const o = S.outcomes?.[h.id]?.outcome;
  return o ? chip(OUTCOME_LABEL[o] || o, /^passed/.test(o) ? 'ok' : '', OUT_ICON[o] || 'gavel') : chip('No result yet', '', 'hourglass');
}

// Everything the page and its buttons need about one sitting, worked out once per render.
function context(h) {
  const rows = sittingOf(h), items = agendaOf(h), now = Date.now(), start = new Date(h.scheduled_at).getTime();
  // Going is recorded on the sitting's first bill with a position (see the header comment); on the link's own row otherwise.
  const lead = items.find(x => isPos(x.b) && x.h.status !== 'cancelled')?.h || h;
  return { h, rows, items, lead, codes: codesOf(h.committee), cancelled: rows.every(r => r.status === 'cancelled'),
    over: now > start + 2 * HR };   // the Week view's rule: two hours after the start, a sitting is held
}

// ---- pieces ----
const section = (id, title, n, inner, extra = '') => `<section class="hr-sec" aria-labelledby="${id}"><div class="hr-sech"><h2 id="${id}">${title}${n != null ? ` <span class="hr-n">${n}</span>` : ''}</h2>${extra}</div>${inner}</section>`;
// Long member lists show the first rows; "Show all" opens the rest in place (remembered for this visit).
function folded(key, rows) {
  if (rows.length <= FOLD + 2 || S.hrMore?.has(key)) return rows.join('');
  return rows.slice(0, FOLD).join('') + `<button type="button" class="row hr-more" data-hrmore="${esc(key)}">${icon('chevron-down')}<span>Show all ${rows.length}</span></button>`;
}

function headHTML(c) {
  const { h, codes, over, cancelled, items } = c, ch = chamberOf(h.committee), joint = codes.length > 1, room = roomOf(h.room);
  // The deadline that still matters: the earliest one for a bill with a position whose testimony is not filed yet.
  const open = over || cancelled ? [] : items.filter(x => isPos(x.b) && x.h.status !== 'cancelled' && draftOf(x)?.status !== 'filed');
  const due = open.map(x => dueOf(x.h)).sort()[0];
  return `<header class="hr-head">
    <span class="hr-hicon" aria-hidden="true">${icon('landmark')}</span>
    <div class="hr-hbody">
      <p class="hr-kind">${esc(`${ch ? ch + ' ' : ''}${joint ? 'joint hearing' : 'hearing'}`)} · <span class="hr-code">${esc(h.committee)}</span></p>
      <h1>${esc(cmteName(h.committee))}</h1>
      <p class="hr-line">${icon('calendar-clock')}<span>${over && !cancelled ? 'Held ' : ''}${esc(longDay(h.scheduled_at))} at ${esc(timeOf(h.scheduled_at))} · ${room ? esc(room) : 'room not posted yet'}</span></p>
      ${due ? `<p class="hr-line hr-due">${icon('file-text')}<span>Testimony due ${esc(fmtDT(due))}</span>${countdown(due)}</p>` : ''}
    </div>
  </header>`;
}

// The notice and the video. Almost no hearing carries a notice link (the House's come from the bill history, which has
// none), so the first bill's own Capitol page stands in, named for what it is.
function links(c) {
  const { h, items, cancelled } = c, out = [], v = cancelled ? null : streamOf(h), lead = items[0]?.b;
  const newTab = '<span class="sr"> (opens in a new tab)</span>';
  if (h.notice_url) out.push({ href: h.notice_url, ic: 'newspaper', label: 'Hearing notice', short: 'Notice', sub: '' });
  else if (lead) out.push({ href: capitolUrl(lead), ic: 'landmark', label: `${lead.bill_number} at the Capitol`, short: 'Capitol page', sub: '' });
  if (v) out.push({ href: v.url, ic: 'video', label: v.label, short: v.label, sub: v.hint || '' });
  return { list: out, newTab };
}
const linksRow = c => { const { list, newTab } = links(c); return list.length ? `<div class="hr-links">${list.map(x => btn(`${esc(x.short)}${x.sub ? `<span class="sr">. ${esc(x.sub)}</span>` : ''}${newTab}`, { kind: 'text', sm: true, icon: x.ic, href: x.href, target: '_blank' })).join('')}</div>` : ''; };
const linksCard = c => { const { list, newTab } = links(c); return list.length ? `<section class="card hr-card" aria-labelledby="hr-h-links"><h2 id="hr-h-links">Notice and video</h2>
  ${list.map(x => `<a class="hr-link" href="${esc(x.href)}" target="_blank" rel="noopener">${icon(x.ic)}<span class="hr-lb"><span class="hr-lt">${esc(x.label)}${newTab}</span>${x.sub ? `<span class="hr-ls">${esc(x.sub)}</span>` : ''}</span>${icon('external-link', { cls: 'hr-ext' })}</a>`).join('')}</section>` : ''; };

// A bill on the agenda: its name (the nickname leads, the number always shows), our position, P1, the owner, and the one
// state that matters now: the testimony before the sitting, the result after it.
function billRow(x, c) {
  const { h, b } = x, own = advocate((S.assignments[b.id] || [])[0]);
  // The number first, as everywhere in Outreach and on Today: a two-line clamp on a narrow phone may cut the name, never the number.
  const name = `<b class="hr-num">${esc(billNum(b))}</b> ${b.nickname ? `<b>${esc(b.nickname)}</b>` : `<span class="hr-t">${esc(blurb(b, 110))}</span>`}`;
  const facts = `<span class="hr-fact">${posIcons(b.position || '')}<span>${esc(POS_WORD[b.position || ''] || 'No position')}</span></span>${b.priority === 1 ? '<span class="sv-p1">P1</span>' : ''}<span class="hr-fact"><span aria-hidden="true">${avatar(own, 20)}</span><span>${own ? esc(own.id === S.me?.id ? 'You' : first(own)) : 'No owner'}</span></span>`;
  let end = '';
  if (c.cancelled) end = '';   // the notice above says it once for the whole sitting (A-14)
  else if (h.status === 'cancelled') end = chip('Taken off the agenda', '', 'circle-x');
  else if (c.over) end = `<span class="sr">Result: </span>${outcomeChip(h)}`;
  else if (isPos(b)) { const t = testimonyOf(h, b), tone = t.filed ? 'ok' : { soon: 'warn', late: 'danger' }[dueTone(dueOf(h))] || '';
    end = chip(t.label, tone, tone === 'danger' ? 'circle-alert' : t.icon); }
  // A grid, not the usual body/end pair: on a phone the name has the whole first line and the state sits at the end of
  // the facts; on a desktop the state moves up beside the name (hearing.css).
  return `<a class="row hr-bill" href="#/bill/${encodeURIComponent(b.bill_number)}"><span class="hr-bt">${name}</span><span class="hr-bs">${end}</span><span class="hr-bf">${facts}</span>${icon('chevron-right', { cls: 'chev' })}</a>`;
}
// Bills we only monitor are folded away when bills with a position share the sitting (R-022 decision 4, as on Today and
// the Week); a sitting of monitored bills alone shows them, or the page would be empty.
function agendaHTML(c) {
  const { items } = c, pos = items.filter(x => isPos(x.b)), mon = items.filter(x => !isPos(x.b));
  const rows = list => `<div class="rows hr-rows">${list.map(x => billRow(x, c)).join('')}</div>`;
  let inner;
  if (!items.length) inner = `<p class="hr-empty">None of the bills heard here is on the tracker any more.</p>`;
  else if (!pos.length) inner = rows(mon);
  else inner = rows(pos) + (mon.length ? `<details class="hr-fold"${S.hrMon ? ' open' : ''}><summary>${icon('eye')}<span>${mon.length === 1 ? '1 more bill we monitor' : `${mon.length} more bills we monitor`}</span>${icon('chevron-down', { cls: 'chev' })}</summary>${rows(mon)}</details>` : '');
  return section('hr-s1', 'Our bills on the agenda', items.length, inner);
}

// A cancelled sitting points to where each bill is heard next, so the page is never a dead end (B-3).
function cancelledHTML(c) {
  if (!c.cancelled) return '';
  const next = c.items.map(x => ({ b: x.b, n: hearingAhead(x.b) })).filter(x => x.n);
  return `<div class="hr-note">${notice('info', 'circle-x', `<b>This hearing was cancelled.</b>${next.length ? ` Where these bills are heard next:` : ' None of these bills has a new hearing yet.'}${next.length ? `<ul class="hr-next">${next.map(({ b, n }) => `<li><a href="#/hearing/${encodeURIComponent(n.id)}">${esc(b.nickname || b.bill_number)} ${b.nickname ? esc(b.bill_number) + ' ' : ''}· ${esc(n.committee)} ${esc(fmtDT(n.scheduled_at))}</a></li>`).join('')}</ul>` : ''}`)}</div>`;
}

// Who is going: the people, "I'm going" for you, and for admins "Send a teammate…" (064 lets an admin set anyone's
// attendance). After the sitting it is a record, with no buttons.
function goingHTML(c) {
  const { rows, over, cancelled } = c, me = S.me, goers = goersOf(rows), meIn = goers.some(a => a.id === me?.id), admin = !!me?.is_admin, live = !over && !cancelled;
  const list = goers.length ? `<ul class="hr-goers">${goers.map(a => `<li><span aria-hidden="true">${avatar(a, 28)}</span><span class="hr-gname">${esc(a.id === me?.id ? 'You' : a.full_name)}</span>${admin && live && a.id !== me?.id ? iconBtn('x', `Take ${first(a)} off this hearing`, { 'data-hroff': a.id }) : ''}</li>`).join('')}</ul>`
    : `<p class="hr-none">${icon(over ? 'user-round' : 'user-plus')}<span>${over ? 'Nobody from the team was going.' : cancelled ? 'Nobody needs to go.' : 'Nobody from the team yet.'}</span></p>`;
  const acts = live && me ? `<div class="hr-gacts"><button type="button" class="chip hr-gobtn" data-hrgo aria-pressed="${meIn}">${icon(meIn ? 'user-check' : 'user-plus')}I’m going</button>${admin ? btn('Send a teammate…', { kind: 'text', sm: true, icon: 'user-round-plus', attrs: { 'data-hrput': '1', 'aria-haspopup': 'dialog' } }) : ''}</div>` : '';
  return { title: over && !cancelled ? 'Who was going' : 'Who’s going', body: list + acts };
}

// The members, chair first, each with where they stand on this sitting's bills with a position (only stances someone
// recorded; the words are for screen readers, the title lists the bills).
function membersHTML(c) {
  const { h, codes, items } = c, members = legsOf(h.committee), pos = items.filter(x => isPos(x.b)), joint = codes.length > 1;
  if (!members.length) return section('hr-s3', 'Committee members', null, `<p class="hr-empty">The tracker has no member list for ${esc(h.committee)}.</p>`);
  let any = false;
  const rows = members.map(m => {
    const yes = [], no = [];
    for (const x of pos) { const s = stanceOf(x.b.id, m.l.id).stance; if (s === 'yes' || s === 'leaning_yes') yes.push(x.b.bill_number); else if (s === 'no' || s === 'leaning_no') no.push(x.b.bill_number); }
    if (yes.length || no.length) any = true;
    const role = joint ? codes.filter(k => m.roles[k]).map(k => `${roleWord(m.roles[k])}, ${k}`).join(' · ') : roleWord(m.role);
    const words = [yes.length ? `for ${yes.length}` : '', no.length ? `against ${no.length}` : ''].filter(Boolean).join(', ');
    const tip = [yes.length ? `For: ${yes.join(', ')}` : '', no.length ? `Against: ${no.join(', ')}` : ''].filter(Boolean).join(' · ');
    const st = words ? `<span class="hr-st" title="${esc(tip)}"><span class="sr">On these bills: ${words}</span>${yes.length ? `<span aria-hidden="true">${icon('thumbs-up')}${yes.length}</span>` : ''}${no.length ? `<span aria-hidden="true">${icon('thumbs-down')}${no.length}</span>` : ''}</span>` : '';
    return `<a class="row hr-mem" href="${legHref(m.l)}">${photo(m.l, 40)}<span class="body"><span class="title">${esc(legName(m.l))}</span><span class="sub">${esc(`${role} · ${partyDist(m.l)}`)}</span></span><span class="end">${st}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
  });
  const lead = pos[0]?.b;
  const hint = lead && !any ? `<p class="hr-hint">No one has recorded where they stand on these bills yet. Set it on ${esc(lead.bill_number)}’s <a href="#/bill/${encodeURIComponent(lead.bill_number)}/pathway">Pathway</a>.</p>` : '';
  return section('hr-s3', 'Committee members', members.length, `${hint}<div class="rows hr-rows">${folded(h.id + '|m', rows)}</div>`);
}

function pageHTML(route, c, back) {
  const g = goingHTML(c);
  const deskback = `<a class="hr-deskback" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>`;
  if (!DESK()) return `<div class="hr-page">${deskback}${headHTML(c)}${linksRow(c)}${cancelledHTML(c)}${agendaHTML(c)}
    ${section('hr-s2', g.title, null, `<div class="card hr-gcard">${g.body}</div>`)}${membersHTML(c)}</div>`;
  return `<div class="hr-page hr-desk"><div class="sv-cols hr-cols">
    <div class="hr-main">${deskback}${headHTML(c)}${cancelledHTML(c)}${agendaHTML(c)}${membersHTML(c)}</div>
    <aside class="sv-aside hr-side" aria-label="Who is going, the notice and the video">
      <section class="card hr-card sv-stick" aria-labelledby="hr-h-go"><h2 id="hr-h-go">${g.title}</h2>${g.body}</section>
      ${linksCard(c)}
    </aside></div></div>`;
}

// ---- actions ----
const refocus = '[data-hrgo], [data-hrput], .hr-gcard, .hr-side .hr-card';
async function toggleGoing(c) {
  const me = S.me; if (!me) return;
  const mine = c.rows.filter(r => (S.attend?.[r.id] || []).includes(me.id)), code = c.h.committee;
  try {
    if (mine.length) {   // not going after all: off every bill of the sitting, whichever one it was recorded on
      for (const r of mine) await DB.attend(r.id, false);
      rerender('[data-hrgo]');
      toast(`You’re not going to the ${code} hearing.`, { undo: async () => { for (const r of mine) await DB.attend(r.id, true); rerender('[data-hrgo]'); } });
    } else {
      await DB.attend(c.lead.id, true);
      rerender('[data-hrgo]');
      toast(`You’re going to the ${code} hearing, ${fmtDT(c.h.scheduled_at)}.`, { ok: true, undo: async () => { await DB.attend(c.lead.id, false); rerender('[data-hrgo]'); } });
    }
  } catch (e) { rerender('[data-hrgo]'); toast(e, { err: true }); }
}
// An admin sends a teammate. The people who own these bills come first; the database tells the person by Slack (064),
// so the toast says so, and Undo cannot call that message back.
function putDown(c) {
  const going = new Set(goersOf(c.rows).map(a => a.id)), owns = new Map();
  for (const x of c.items) for (const id of S.assignments[x.b.id] || []) owns.set(id, [...(owns.get(id) || []), x.b]);
  const team = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id && !going.has(a.id))
    .sort((a, b) => owns.has(b.id) - owns.has(a.id) || a.full_name.localeCompare(b.full_name));
  if (!team.length) { toast('Everyone on the team is already going to this hearing.'); return; }
  pickerSheet({ title: `Send a teammate to the ${esc(c.h.committee)} hearing`, value: '', help: 'They get a Slack message saying you sent them.',
    options: team.map(a => { const bs = owns.get(a.id) || []; return [a.id, a.full_name, 'user-round', bs.length ? `Owns ${bs.length === 1 ? bs[0].bill_number : `${bs.length} of these bills`}` : '']; }),
    onPick: async id => {
      const a = advocate(id); if (!a) return;
      try { await DB.attend(c.lead.id, true, id); } catch (e) { toast(e, { err: true }); return; }
      rerender('[data-hrput]');
      toast(`${first(a)} is going to the ${c.h.committee} hearing. ${first(a)} gets a Slack message.`, { ok: true,
        undo: async () => { await DB.attend(c.lead.id, false, id); rerender('[data-hrput]'); toast(`${first(a)} is off it again. The Slack message may already have gone.`); } });
    } });
}
// An admin takes someone off (from every bill of the sitting they were marked on). Undo puts them back, which the
// database tells them about again.
async function takeOff(c, id) {
  const a = advocate(id), rows = c.rows.filter(r => (S.attend?.[r.id] || []).includes(id)); if (!a || !rows.length) return;
  try { for (const r of rows) await DB.attend(r.id, false, id); } catch (e) { rerender(); toast(e, { err: true }); return; }
  rerender(refocus);
  toast(`${first(a)} is off the ${c.h.committee} hearing.`, { undo: async () => { for (const r of rows) await DB.attend(r.id, true, id); rerender(refocus); toast(`${first(a)} is back on it and gets a Slack message.`); } });
}

// ?from=HB1780 (a bill) or ?from=<coalition id>: the back link names where the person came from, as a legislator's page
// does for a bill. Opened from inside the app, the back link is real Back anyway (app.js).
function backOf(route) {
  const from = String(route.q?.from || '');
  const b = from && S.bills.find(x => x.bill_number === from.replace(/\s/g, '').toUpperCase());
  if (b) return { href: `#/bill/${encodeURIComponent(b.bill_number)}`, label: b.bill_number };
  const co = from && (S.campaigns || []).find(x => String(x.id) === from);
  if (co) return { href: `#/coalition/${encodeURIComponent(co.id)}`, label: co.name };
  return { href: '#/legislators', label: 'Legislators' };
}

export default {
  tab: 'legislators',
  // The two columns need more than the 720px column the frame gives a plain page between 900 and 1099px.
  wide: () => DESK(),
  title: route => { const h = hearingById(route.id); return h ? `${h.committee} hearing` : 'Hearing'; },
  back: route => backOf(route),
  render(route) {
    const h = hearingById(route.id);
    // Never a dead end (B-3): the hearing may have been moved and removed, or the link may be from another session.
    if (!h) return `<div class="hr-page">${empty({ h: 'h1', title: 'We could not find that hearing', text: 'It may have been moved to a new time, or the link is from an earlier session. The week’s hearings are on Today.',
      action: btn('See this week’s hearings', { href: matchMedia('(min-width: 1100px)').matches ? '#/?view=week' : '#/' }) })}</div>`;
    return pageHTML(route, context(h), backOf(route));
  },
  wire(route, app) {
    const root = app.querySelector('.hr-page'), h = hearingById(route.id); if (!root || !h) return;
    wireLinks(root);
    const c = context(h);
    root.querySelector('[data-hrgo]')?.addEventListener('click', () => toggleGoing(c));
    root.querySelector('[data-hrput]')?.addEventListener('click', () => putDown(c));
    root.querySelectorAll('[data-hroff]').forEach(el => el.onclick = () => takeOff(c, el.dataset.hroff));
    root.querySelector('.hr-fold')?.addEventListener('toggle', e => { S.hrMon = e.currentTarget.open; });
    root.querySelectorAll('[data-hrmore]').forEach(el => el.onclick = () => { (S.hrMore ??= new Set()).add(el.dataset.hrmore); rerender(); });
  },
};
