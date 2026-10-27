// Staff v6 · one sitting (#/hearing/<id>; R-022 wave 3 #16, R-336 spec 6, F107, F129, F131, F133). A person comes here to
// get ready for one committee sitting (B-1). The database keeps a hearing per bill; a sitting is every one of those rows
// with the same committee and start time, so the page shows the whole agenda the team tracks, whichever of its bills the
// link came from.
// v6: the page is led by the big hearing card (steps.js hearingCard: time and room large, who is going with I'm going on
// the card, each of our bills with where its testimony stands and the viewer's own step's button), the same card as on
// Hearings and Today, so a sitting reads the same everywhere (V07, V14). Under it, v5's content, restyled and said once:
//   the testimony deadline; a cancelled sitting's where-next and "still going?" (W53); after the sitting, each bill's
//   result; the bills we only monitor, folded (R-022 decision 4); the notice and the video, with "Fix the video link"
//   (F107, F133); for admins, who is going with "Send a teammate…" and "Take X off" (F131); the committee's members and
//   where they stand on these bills; and a door to This week's asks (the hearing's share kit is Outreach's card now).
// Going: a person is marked on ONE of the sitting's rows, and "going" means marked on any of them, which is how every
// screen reads it. One row and not ten, because the database sends a Slack message for every row an admin sends a
// teammate to (migration 064); the row is a bill with a position, so the hearing reaches their calendar invite.
import { S, DB, esc, fmtDT, advocate, capitolUrl, hooks } from './data.js';
import { codesOf, draftFor, attendees, billById, billSay, legsOf, stanceOf, OUTCOME_LABEL, hearingAhead, shareKit, billByRef,
  billRoute, whenAt, lateLine, spanOf, isDecision, sittingDraft, earlierFiled, draftHearing, movedFrom, streamOf, publicResponse } from './model.js';
import { icon, btn, iconBtn, empty, toast, pickerSheet, openSheet, closeSheet, field, showAllBtn, POS_WORD, avatar, timeTone } from './ui.js';
import { teamFirst, filerOf } from './model.js';
import { legName, partyDist, legHref, wireLinks } from './pathway.js';
import { rerender, viewIsNew } from './bill.js';
import { movedGoingHTML, wireMoved, newSitting } from './moved.js';   // R-316 W53: still going to the sitting it moved to?
import { hearingCard, committeeName, itemRow, nameWords, numWords, nw, dayWords, timeWords, wireSteps, billStep, orWords } from './steps.js';

const HR = 36e5, FOLD = 10;
const hearingById = id => (S.hearings || []).find(h => String(h.id) === String(id)) || null;
const isPos = b => !!b.position && b.position !== 'monitor';
const first = a => teamFirst(a);   // R-316 W28: "Lauren (turned off)"

// ---- the sitting, shared with the coalition page, the bill page, Today and Issues (keep these exports) ----
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
// "You and Lauren are going", "Lauren is going"; '' when nobody is. (coalition.js; v6 screens say steps.js goingWords.)
export function goingWords(goers, { past = false } = {}) {
  const names = goers.map(a => a.id === S.me?.id ? 'You' : first(a)); if (!names.length) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const one = names.length === 1 && names[0] !== 'You';
  return `${list} ${past ? (one ? 'was' : 'were') : (one ? 'is' : 'are')} going`;
}
// Written testimony is due at the notice's deadline, else 24 hours before the hearing (the Hawaiʻi rule; bill.js dueOf).
export const dueOf = h => h.testimony_deadline || new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString();
const draftOf = x => sittingDraft(x.h, x.b.id);   // R-316 W49: never the earlier hearing's draft on a decision-making sitting
// Where a bill's testimony for one hearing stands (v5's words; coalition.js and issues.js still read them until they move
// to steps.js testimonyState).
export function testimonyOf(h, b) {
  const d = draftOf({ h, b });
  const e = !d && earlierFiled(h, b.id), eh = e && draftHearing(e);
  if (e) return { filed: true, earlier: true, word: 'filed for the hearing', label: `HIPHI filed for the ${eh ? new Date(eh.scheduled_at).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric' }) + ' ' : 'earlier '}hearing`, icon: 'check' };
  if (!d) return { filed: false, word: 'not started', label: 'Writing · not started', icon: 'file-text' };   // spec 12.6: one wording
  if (d.status === 'filed') return { filed: true, word: 'filed', label: 'Testimony filed', icon: 'check' };
  const st = b.current_version && (d.version || null) !== b.current_version ? ['out of date', 'triangle-alert']
    : d.status === 'approved' ? ['ready to file', 'clipboard-check'] : d.status === 'second_review' ? ['waiting for second approval', 'hourglass']
    : d.status === 'review' ? ['waiting for approval', 'hourglass'] : d.review_note ? ['sent back', 'undo-2'] : ['in draft', 'pencil'];
  return { filed: false, word: st[0], label: `Testimony ${st[0]}`, icon: st[1] };
}
// Amber only while late testimony is still taken, red once the hearing has begun (A-5 as amended by R-250, D3).
export const dueTone = (iso, until = null) => { const ms = new Date(iso) - Date.now(); return ms <= 0 ? (until && new Date(until) > Date.now() ? 'soon' : 'late') : ms <= 864e5 ? 'soon' : ''; };
// Undo filed (R-277 fix 12): the same data call as the Undo on "Filed." (DB.transition 'unfile'), with an Undo of its own.
// Today's row menu uses it too.
export async function unfile(b, d, after = () => rerender()) {
  const url = d.filed_url || null;
  try { await DB.transition(b.id, d.id, 'unfile'); after(); toast(`Filing undone. The ${committeeName(d.committee) || d.committee} testimony is approved and ready to file again.`, { undo: async () => { await DB.transition(b.id, d.id, 'file', null, url); after(); } }); }
  catch (e) { toast(e, { err: true }); }
}
// The share kit's copy buttons (R-117), for any screen that still draws them; the sitting's page now opens This week's asks.
export function wireShareKit(root) {
  root.querySelectorAll('[data-kit]').forEach(el => el.onclick = async () => {
    const b = billById(el.dataset.kitb), h = (S.hearings || []).find(x => x.id === el.dataset.kith) || hearingAhead(b); if (!b) return;
    const kit = shareKit(b, h), text = el.dataset.kit === 'link' ? kit.link : kit.message;
    try { await navigator.clipboard.writeText(text); toast(el.dataset.kit === 'link' ? 'Share link copied. Paste it into a text, an email or a post.' : 'Message copied. Paste it into a text, an email or a post, and change anything you like.', { ok: true }); }
    catch { toast('Could not copy. Select the text and copy it yourself: ' + text); }
  });
}

// Everything the page and its buttons need about one sitting, worked out once per render.
function context(h) {
  const rows = sittingOf(h), items = agendaOf(h), now = Date.now(), start = new Date(h.scheduled_at).getTime();
  // Going is recorded on the sitting's first bill with a position (see the header comment); on the link's own row otherwise.
  const lead = items.find(x => isPos(x.b) && x.h.status !== 'cancelled')?.h || h;
  return { h, rows, items, lead, codes: codesOf(h.committee), cancelled: rows.every(r => r.status === 'cancelled'),
    started: now >= start, over: now > start + 2 * HR };   // two hours after the start, a sitting is held
}
const nameOf = h => `${committeeName(h.committee) || h.committee} ${isDecision(h) ? 'decision making' : 'hearing'}`;

// ---- pieces ----
const section = (id, title, inner, { cls = '', extra = '' } = {}) => `<section class="hr-sec${cls ? ' ' + cls : ''}" aria-labelledby="${id}"><div class="hr-sech"><h2 id="${id}">${title}</h2>${extra}</div>${inner}</section>`;

// The big card (V14), as steps.js draws it on a sitting's own page (self: the committee's name alone, no door to this page,
// no monitored-bills line since they are listed below, and no "Watch it live" beside the page's own Watch on YouTube:
// one link to one video, A-14), each bill with where we stand and whose it is (facts, F129).
function cardHTML(c) {
  let html = hearingCard(c.h, { big: true, id: 'hr-cardname', self: true, facts: factsOf });
  // An admin's "Send a teammate…" sits on the card's going line beside I'm going (F131): who is going is read and changed
  // in one place, not under a second "Who is going" heading lower down (the critic: A-14, A-20).
  if (S.me?.is_admin && !c.over && !c.cancelled) html = html.replace(/(<p class="v6-hcard-going">[\s\S]*?)(<\/p>)/, `$1${sendBtn()}$2`);
  // A cancelled sitting that the Capitol moved: say where it went, not "no new date yet" (W53).
  if (c.cancelled) { const n = newSitting(c.rows[0]); if (n) html = html.replace('Cancelled, no new date yet', `Cancelled · moved to ${esc(`${dayWords(n.scheduled_at)}, ${timeWords(n.scheduled_at)}`)}`); }
  // On a hearing day the person on each of our bills' steps is one quiet link away, "Message Kevin", beside the bill: the
  // bill's Team talk with @Kevin typed in (A-16, B-3; Kris at the Capitol could not reach the filer from here).
  for (const x of c.items) { if (!isPos(x.b)) continue;
    const s = billStep(x.b, { viewer: S.me, d: sittingDraft(x.h, x.b.id) || null, h: x.h });
    const to = (s?.whose?.ids || []).filter(id => id && id !== S.me?.id && advocate(id)?.is_active !== false); if (!to.length || s.you || !s.state || ['filed', 'missed'].includes(s.state.key)) continue;
    const at = `<a class="v6-hcard-bl" href="${esc(billRoute(x.b))}">`, i = html.indexOf(at); if (i < 0) continue;
    const j = html.indexOf('</a>', i); if (j < 0) continue;
    const link = `<a class="hr-msg" href="${esc(`${billRoute(x.b, 'talk')}?mention=${to.map(id => advocate(id)?.initials).filter(Boolean).join(',')}`)}">${icon('message-square')}<span>Message ${esc(orWords(to, null, { and: true }))}</span></a>`;
    html = html.slice(0, j + 4) + link + html.slice(j + 4);
  }
  return facesIn(html, c);
}
// R-344 rule 4 (faces): the card is steps.js's (another build's file), so its words come as they are and the faces are put
// in beside them here. Who is going: their faces in place of the generic people icon, before "Going: Kris" (the words stay).
// Each bill: its owner's face before "Kevin's bill" on the quiet facts line. All hidden from reading: the words say it.
function facesIn(html, c) {
  const goers = c.cancelled ? [] : goersOf(c.rows);
  if (goers.length) html = html.replace(/(<p class="v6-hcard-going">)<svg[\s\S]*?<\/svg>/, `$1<span class="hr-goface" aria-hidden="true">${goers.slice(0, 3).map(a => avatar(a, 28, { deco: true })).join('')}</span>`);
  for (const x of c.items) { if (!isPos(x.b)) continue;
    const own = advocate((S.assignments?.[x.b.id] || [])[0]); if (!own) continue;
    const at = `<a class="v6-hcard-bl" href="${esc(billRoute(x.b))}">`, i = html.indexOf(at); if (i < 0) continue;
    const j = html.indexOf('<span class="v6-hcard-facts">', i), k = html.indexOf('</a>', i); if (j < 0 || j > k) continue;
    // right before "Kevin's bill" (else at the line's start), so the face sits beside the words it pictures
    const tag = '<span class="v6-hcard-facts">', w = html.indexOf(esc(whoseWords(x.b)), j), at2 = w > j && w < k ? w : j + tag.length;
    html = html.slice(0, at2) + `<span class="hr-ownface" aria-hidden="true">${avatar(own, 20, { deco: true })}</span>` + html.slice(at2);
  }
  return html;
}
// "Strong support · Kevin's bill · Public: 43 follow, 12 emailed": the position, whose bill, and the public's numbers,
// each only from 10 people (the team's rule for group counts, spec 2), so no one person can be picked out.
const whoseWords = b => { const own = (S.assignments?.[b.id] || [])[0], a = own && advocate(own);
  return !own ? 'No owner yet' : own === S.me?.id ? 'Your bill' : a ? `${first(a)}’s bill` : ''; };
function factsOf(b) {
  const whose = whoseWords(b);
  const c = publicResponse(b) || {}, ten = n => (n || 0) >= 10;
  // "followers", in Outreach's order of counts (followers, testified, emailed), one word for one fact (C-15, A-14).
  const pub = [ten(c.followers) ? `${c.followers} followers` : '', ten(c.testimonies) ? `${c.testimonies} testified` : '', ten(c.emails) ? `${c.emails} emailed` : '', ten(c.attending) ? `${c.attending} plan to attend` : ''].filter(Boolean).join(', ');
  return [POS_WORD[b.position] || '', whose, pub ? `Public: ${pub}` : ''].filter(Boolean).join(' · ');
}
// When written testimony is due for the bills still to file: "Written testimony due Tue 3/17, 1:00 PM". Past the deadline
// and before the sitting starts, the Capitol still takes it: "Written testimony: late, still accepted until 9:30 AM" (said,
// not coloured here: each bill's own line carries its colour for the person whose step it is, D3).
// Said once (A-14): when the card's bill lines already give that time ("Resubmit · due today 9:30 AM"), this line goes.
function dueHTML(c, card = '') {
  const { over, cancelled, started, items } = c; if (over || cancelled || started) return '';
  const open = items.filter(x => isPos(x.b) && x.h.status !== 'cancelled' && draftOf(x)?.status !== 'filed' && !earlierFiled(x.h, x.b.id));
  const due = open.map(x => dueOf(x.h)).sort()[0]; if (!due) return '';
  const past = new Date(due) <= Date.now();
  const lines = (card.match(/<ul class="v6-hcard-bills">[\s\S]*?<\/ul>/)?.[0] || '').replace(/<[^>]+>/g, '');
  if (lines.includes(timeWords(past ? c.h.scheduled_at : due))) return '';
  // R-344 rule 3: the Capitol's deadline with how long is left in words beside it ("· in 2 days"), amber once it is today.
  // It names whose deadline it is (the Capitol's), so it never reads as a second time for a teammate's hand-on step.
  const tone = past ? '' : timeTone(due);
  return `<p class="hr-due${tone ? ' ' + tone : ''}">${icon('clock')}<span>${nw(esc(past ? `Written testimony: ${lateLine(c.h.scheduled_at, { lower: true })}` : `The Capitol takes written testimony until ${whenAt(due)} · in ${spanOf(due)}`))}</span></p>`;
}
// A cancelled sitting points to where each bill is heard next, so the page is never a dead end (B-3), and asks whoever was
// going whether they still are (W53).
function cancelledHTML(c) {
  if (!c.cancelled) return '';
  const next = c.items.map(x => ({ b: x.b, n: hearingAhead(x.b) })).filter(x => x.n);
  const list = next.length ? `<div class="v6-list" role="list" aria-label="Where these bills are heard next">${next.map(({ b, n }) => itemRow({ key: b.id, name: nameWords(b), num: numWords(b), line: nw(esc(`${committeeName(n.committee) || n.committee} · ${whenAt(n.scheduled_at)}`)), icon: 'gavel', href: `#/hearing/${encodeURIComponent(n.id)}` })).join('')}</div>` : '';
  const moved = !c.over ? movedGoingHTML(c.rows[0], btn) : '';
  return section('hr-s-next', 'This hearing was cancelled', `${moved ? `<div class="hr-moved">${moved}</div>` : ''}${next.length ? `<p class="hr-p">Where these bills are heard next:</p>${list}` : '<p class="hr-p">None of these bills has a new hearing yet.</p>'}`);
}
// After the sitting: each bill's result, in words (the Capitol posts a decision a while after, so "No result yet" is normal).
const OUT_ICON = { passed: 'circle-check', passed_amended: 'circle-check', deferred: 'circle-x', recommitted: 'undo-2' };
function resultsHTML(c) {
  if (!c.over || c.cancelled) return '';
  const pos = c.items.filter(x => isPos(x.b) && x.h.status !== 'cancelled'); if (!pos.length) return '';
  const rows = pos.map(x => { const o = S.outcomes?.[x.h.id]?.outcome;
    return itemRow({ key: x.b.id, name: nameWords(x.b), num: numWords(x.b), line: esc(o ? OUTCOME_LABEL[o] || o : 'No result yet'), icon: o ? OUT_ICON[o] || 'gavel' : 'hourglass', href: billRoute(x.b) }); }).join('');
  return section('hr-s-res', 'What happened', `<div class="v6-list" role="list" aria-label="Results">${rows}</div>`);
}
// Bills we only monitor, folded away when bills with a position share the sitting (R-022 decision 4); a sitting of
// monitored bills alone shows them open, or the page would be empty.
function monitoredHTML(c) {
  const mon = c.items.filter(x => !isPos(x.b) && x.h.status !== 'cancelled'); if (!mon.length) return '';
  const rows = `<div class="v6-list" role="list" aria-label="Bills we monitor">${mon.map(x => itemRow({ key: x.b.id, name: nameWords(x.b), num: numWords(x.b), line: 'We monitor it', icon: 'eye', href: billRoute(x.b) })).join('')}</div>`;
  const label = mon.length === 1 ? '1 bill we monitor' : `${mon.length} bills we monitor`;
  if (!c.items.some(x => isPos(x.b))) return section('hr-s-mon', 'On the agenda', rows);
  return `<details class="hr-fold"${S.hrMon ? ' open' : ''}><summary>${icon('eye')}<span>Also heard: ${esc(label)}</span>${icon('chevron-down', { cls: 'hr-chev' })}</summary>${rows}</details>`;
}
// The notice and the video (F133), as labelled doors (B-9). Almost no hearing carries a notice link (the House's come from
// the bill history, which has none), so the first bill's own Capitol page stands in, named for what it is. The video is
// the exact one once staff paste it, else the chamber's channel; "Fix the video link" is how (F107).
function linksHTML(c) {
  const { h, items, cancelled } = c, out = [], v = cancelled ? null : streamOf(h), lead = items[0]?.b;
  const door = (href, ic, label, sub) => `<a class="hr-door" href="${esc(href)}" target="_blank" rel="noopener">${icon(ic)}<span class="hr-door-t"><span class="hr-door-l">${esc(label)}<span class="sr"> (opens in a new tab)</span></span>${sub ? `<span class="hr-door-s">${esc(sub)}</span>` : ''}</span>${icon('external-link', { cls: 'hr-ext' })}</a>`;
  if (h.notice_url) out.push(door(h.notice_url, 'newspaper', 'Hearing notice', 'The Capitol’s notice'));
  // R-344 rule 5: the Capitol building is Legislators' picture only; the notice is the newspaper, a bill's page a web page.
  else if (lead) out.push(door(capitolUrl(lead), items.length > 1 ? 'newspaper' : 'globe', items.length > 1 ? 'Hearing notice' : 'Capitol page', items.length > 1 ? `On ${numWords(lead)}’s Capitol page` : numWords(lead)));
  // On the sitting's day the card above has "Watch it live" (the same video): one link, the card's (A-14).
  const cardHasIt = !!v && new Date(h.scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) === new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  if (v && !cardHasIt) out.push(door(v.url, 'video', v.label, v.hint || ''));
  const fix = cancelled ? '' : `<p class="hr-fix">${btn('Fix the video link', { kind: 'text', sm: true, icon: 'pencil', attrs: { 'data-hrvideo': '1', 'aria-haspopup': 'dialog' } })}</p>`;
  if (!out.length && !fix) return '';
  return section('hr-s-links', out.length ? 'Notice and video' : 'Video', `${out.length ? `<div class="hr-doors">${out.join('')}</div>` : ''}${fix}`);
}
// Who is going, for admins (F131): "Send a teammate…" is on the card's going line (cardHTML; 064 lets an admin set anyone's
// attendance, and the teammate gets a Slack message); this list appears only when a teammate is going, to take them off.
// Everyone else has the card's going line and I'm going.
const sendBtn = () => btn('Send a teammate…', { kind: 'text', sm: true, icon: 'user-round-plus', attrs: { 'data-hrput': '1', 'aria-haspopup': 'dialog' } });
function goingHTML(c) {
  const me = S.me; if (!me?.is_admin || c.over || c.cancelled) return '';
  const goers = goersOf(c.rows).filter(a => a.id !== me.id); if (!goers.length) return '';
  const list = `<ul class="hr-goers">${goers.map(a => `<li><span class="hr-gname">${esc(a.full_name)}</span>${btn(`Take ${esc(first(a))} off`, { kind: 'text', sm: true, attrs: { 'data-hroff': a.id, 'aria-label': `Take ${first(a)} off this hearing` } })}</li>`).join('')}</ul>`;
  return section('hr-s-go', 'Teammates going', list);
}
// This week's asks (Outreach) is the one home of the public ask for this sitting's bills (spec 6 Outreach: the hearing's
// share kit becomes a link to that card). Shown only while there is a public bill with a position still to be heard.
function shareHTML(c) {
  if (c.over || c.cancelled || !c.items.some(x => isPos(x.b) && x.b.is_public && x.h.status !== 'cancelled')) return '';
  // OUTREACH (F132, V20): one link, to this sitting's cards (#/outreach?hearing=<id> picks them out).
  return `<a class="hr-share" id="hr-kit" href="#/outreach?hearing=${encodeURIComponent(c.h.id)}">${icon('megaphone')}<span class="hr-door-t"><span class="hr-door-l">Share these bills</span><span class="hr-door-s">The ask, its link and a ready message are on This week’s asks</span></span>${icon('chevron-right', { cls: 'v6-chev' })}</a>`;
}
// "Democrat, House district 44": the party and the seat in words, not "D-HD 44" (rule 7.12, C-10: no codes in rows).
const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent', G: 'Green', L: 'Libertarian' };
const seatWords = l => { const p = PARTY[String(l.party || '').trim().toUpperCase()] || l.party || '';
  return [p, l.district != null && l.district !== '' ? `${l.chamber === 'S' ? 'Senate' : 'House'} district ${l.district}` : ''].filter(Boolean).join(', '); };
// R-344 rule 4: each member's photo leads their row, drawn as Legislators › Everyone draws it (legislators.js face): the
// photo over its initial, so a missing or broken photo shows the initial, never a broken image.
const legFace = l => `<span class="v6-row-lead sv-face hr-lgface" aria-hidden="true"><span class="lg6-rph" data-i="${esc((l.name || '?')[0])}">${l.photo_url ? `<img class="lg-ph" src="${esc(l.photo_url)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">` : ''}</span></span>`;
// The members, chair first, each with where they stand on this sitting's bills with a position (only stances someone
// recorded). Long lists show the first rows; "Show all" opens the rest in place (remembered for this visit).
function membersHTML(c) {
  const { h, codes, items } = c, members = legsOf(h.committee), pos = items.filter(x => isPos(x.b)), joint = codes.length > 1;
  if (!members.length) return section('hr-s-mem', 'Committee members', `<p class="hr-p">The tracker has no member list for this committee.</p>`);
  let any = false;
  const role = r => r === 'chair' ? 'Chair' : r === 'vice_chair' ? 'Vice chair' : 'Member';
  const rows = members.map(m => {
    let yes = 0, no = 0;
    for (const x of pos) { const s = stanceOf(x.b.id, m.l.id).stance; if (s === 'yes' || s === 'leaning_yes') yes++; else if (s === 'no' || s === 'leaning_no') no++; }
    if (yes || no) any = true;
    // A joint referral names the committee in words, never its code (D15): "Chair of Commerce".
    const r = joint ? codes.filter(k => m.roles[k]).map(k => m.roles[k] === 'member' ? '' : `${role(m.roles[k])} of ${committeeName(k, { chamber: false })}`).filter(Boolean).join(', ') || 'Member' : role(m.role);
    const st = [yes ? `for ${yes}` : '', no ? `against ${no}` : ''].filter(Boolean).join(', ');
    return itemRow({ key: String(m.l.id), name: legName(m.l), line: esc([r, seatWords(m.l), st ? `on these bills: ${st}` : ''].filter(Boolean).join(' · ')), href: legHref(m.l), cls: 'hr-mrow v6-face-row', lead: legFace(m.l) });
  });
  const lead = pos[0]?.b;
  // v3: the stance pickers are in Committees on the bill's page; the door lands there (a button, not a link inside a
  // sentence: 44px links inside text break the line on a phone).
  const hint = lead && !any ? `<p class="hr-p">No one has recorded where they stand on these bills yet.</p><p class="hr-more">${btn('Mark where they stand', { kind: 'text', sm: true, icon: 'thumbs-up', href: billRoute(lead, 'committees') })}</p>` : '';
  const key = h.id + '|m', open = rows.length <= FOLD + 2 || S.hrMore?.has(key);
  return section('hr-s-mem', 'Committee members', `${hint}<div class="v6-list" role="list" aria-label="Committee members">${(open ? rows : rows.slice(0, FOLD)).join('')}</div>${open ? '' : `<p class="hr-more">${showAllBtn(rows.length, { 'data-hrmore': key }, { what: 'members' })}</p>`}`);
}

// ---- where the person came from (Back) and which place is lit ----
// ?from=today | week | bills | testimony | team | legislators, a bill (its number) or a coalition id: the back link names
// it (B-4) and that place stays lit (D12). Opened from inside the app, Back is real Back anyway (app.js). Unsaid, a sitting
// belongs to Hearings.
const FROM = { today: ['#/', 'Today', 'today'], week: ['#/hearings', 'Hearings', 'hearings'], hearings: ['#/hearings', 'Hearings', 'hearings'],
  bills: ['#/bills', 'Bills', 'bills'], testimony: ['#/testimony', 'Testimony', 'testimony'], team: ['#/team', 'Team', 'team'], legislators: ['#/legislators', 'Legislators', 'legislators'] };
function backOf(route) {
  const from = String(route.q?.from || '');
  if (FROM[from]) return { href: FROM[from][0], label: FROM[from][1], place: FROM[from][2] };
  const b = from && billByRef(from);
  if (b) return { href: billRoute(b), label: numWords(b), place: S.billFrom || 'bills' };
  const co = from && (S.campaigns || []).find(x => String(x.id) === from);
  if (co) return { href: `#/coalition/${encodeURIComponent(co.id)}`, label: co.name, place: 'myissues' };
  return { href: '#/hearings', label: 'Hearings', place: 'hearings' };
}

function pageHTML(c, back) {
  const deskback = `<a class="hr-deskback" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>`;
  const card = cardHTML(c);
  return `<div class="hr-page">
    ${deskback}
    <h1 class="v6-ptitle hr-h1">${esc(nameOf(c.h))}</h1>
    ${card}
    ${dueHTML(c, card)}
    ${cancelledHTML(c)}
    ${resultsHTML(c)}
    ${monitoredHTML(c)}
    ${shareHTML(c)}
    ${goingHTML(c)}
    ${linksHTML(c)}
    ${membersHTML(c)}
  </div>`;
}


// ---- actions ----
// An admin sends a teammate. The people who own these bills come first; the database tells the person by Slack (064),
// so the toast says so, and Undo cannot call that message back.
function putDown(c) {
  const going = new Set(goersOf(c.rows).map(a => a.id)), owns = new Map();
  for (const x of c.items) for (const id of S.assignments[x.b.id] || []) owns.set(id, [...(owns.get(id) || []), x.b]);
  const team = S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id && !going.has(a.id))
    .sort((a, b) => owns.has(b.id) - owns.has(a.id) || a.full_name.localeCompare(b.full_name));
  if (!team.length) { toast('Everyone on the team is already going to this hearing.'); return; }
  const name = committeeName(c.h.committee) || c.h.committee;
  pickerSheet({ title: `Send a teammate to the ${esc(name)} hearing`, value: '', help: 'They get a Slack message saying you sent them.',
    options: team.map(a => { const bs = owns.get(a.id) || []; return [a.id, a.full_name, 'user-round', bs.length ? `Owns ${bs.length === 1 ? billSay(bs[0]) : `${bs.length} of these bills`}` : '']; }),
    onPick: async id => {
      const a = advocate(id); if (!a) return;
      try { await DB.attend(c.lead.id, true, id); } catch (e) { toast(e, { err: true }); return; }
      rerender('[data-hrput]');
      toast(`${first(a)} is going to the ${name} hearing. ${first(a)} gets a Slack message.`, { ok: true,
        undo: async () => { await DB.attend(c.lead.id, false, id); rerender('[data-hrput]'); toast(`${first(a)} is off it again. The Slack message may already have gone.`); } });
    } });
}
// An admin takes someone off (from every bill of the sitting they were marked on). Undo puts them back, which the
// database tells them about again.
async function takeOff(c, id) {
  const a = advocate(id), rows = c.rows.filter(r => (S.attend?.[r.id] || []).includes(id)); if (!a || !rows.length) return;
  const name = committeeName(c.h.committee) || c.h.committee;
  try { for (const r of rows) await DB.attend(r.id, false, id); } catch (e) { rerender(); toast(e, { err: true }); return; }
  rerender('[data-hrput]');
  toast(`${first(a)} is off the ${name} hearing.`, { undo: async () => { for (const r of rows) await DB.attend(r.id, true, id); rerender('[data-hrput]'); toast(`${first(a)} is back on it and gets a Slack message.`); } });
}
// F107: the exact video for this sitting (a YouTube address), or blank to go back to the chamber's channel. The same call
// as the bill page's (DB.setHearingStream).
function fixVideo(c) {
  const h = c.lead;
  openSheet({ title: 'Fix the video link', size: 'auto',
    body: `${field('hr-vurl', 'YouTube address for this hearing', `<input id="hr-vurl" type="url" inputmode="url" autocomplete="off" placeholder="https://www.youtube.com/watch?v=…" value="${esc(h.stream_url || '')}" aria-describedby="hr-vurl-help hr-verr">`, 'Leave it blank to go back to the channel link.')}<p class="err" id="hr-verr" role="alert" hidden>${icon('circle-alert')}Paste a full address that starts with https://</p>`,
    foot: btn('Save link', { kind: 'primary', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const inp = dlg.querySelector('#hr-vurl'), er = dlg.querySelector('#hr-verr'); inp.focus();
      inp.oninput = () => { er.hidden = true; inp.removeAttribute('aria-invalid'); };
      dlg.querySelector('[data-go]').onclick = async e => {
        const url = inp.value.trim();
        if (url && !/^https?:\/\/\S+$/i.test(url)) { er.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        const go = e.currentTarget; go.setAttribute('aria-busy', 'true');
        const was = h.stream_url || '';
        try {
          for (const r of c.rows) await DB.setHearingStream(r.id, url);
          closeSheet({ silent: true }); rerender('[data-hrvideo]');
          toast(url ? 'Video link saved.' : 'Back to the channel link.', { ok: true, undo: async () => { for (const r of c.rows) await DB.setHearingStream(r.id, was); rerender('[data-hrvideo]'); } });
        } catch (x) { go.removeAttribute('aria-busy'); toast(x, { err: true }); }
      };
    } });
}

export default {
  // The place lit is where the person came from (D12); app.js reads route.place, which render sets (backOf).
  get tab() { return 'hearings'; },
  title: route => { const h = hearingById(route.id); return h ? nameOf(h) : 'Hearing'; },
  back: route => backOf(route),
  render(route) {
    const back = backOf(route); route.place = back.place;
    const h = hearingById(route.id);
    // Never a dead end (B-3): the hearing may have been moved and removed, or the link may be from another session.
    if (!h) return `<div class="hr-page">${empty({ h: 'h1', title: 'We could not find that hearing', text: 'It may have been moved to a new time, or the link is from an earlier session. This week’s hearings are on Hearings.',
      action: btn('See this week’s hearings', { href: '#/hearings/week' }) })}</div>`;
    return pageHTML(context(h), back);
  },
  wire(route, app) {
    const root = app.querySelector('.hr-page'), h = hearingById(route.id); if (!root || !h) return;
    wireSteps(root, { after: () => rerender() });
    wireLinks(root); wireMoved(root, { toast, redraw: () => hooks.render() });   // W53
    // An old ?kit=1 link (v4's "Send the ask") goes on to the share tools' one home, this sitting's cards (OUTREACH, F132).
    if (route.q?.kit && viewIsNew()) { S.go(`#/outreach?hearing=${encodeURIComponent(h.id)}`, { replace: true }); return; }
    const c = context(h);
    root.querySelector('[data-hrput]')?.addEventListener('click', () => putDown(c));
    root.querySelector('[data-hrvideo]')?.addEventListener('click', () => fixVideo(c));
    root.querySelectorAll('[data-hroff]').forEach(el => el.onclick = () => takeOff(c, el.dataset.hroff));
    root.querySelector('.hr-fold')?.addEventListener('toggle', e => { S.hrMon = e.currentTarget.open; });
    root.querySelectorAll('[data-hrmore]').forEach(el => el.onclick = () => { (S.hrMore ??= new Set()).add(el.dataset.hrmore); rerender(); });
  },
};
