// Staff7 Issues (R-398, rules S-19, S-20): the door where awareness lives. The left is a list of issues (whose: Mine, a teammate's, Everyone's) in three groups, At risk, Moving and
// Stopped this year, under a first row, The session; the right is always the thing picked from it (never an unmarked summary): the session's next deadline and the bills it touches,
// an issue's sheet (its bills, each with one path drawing), or a bill's short sheet. Looking never changes anything: only an issue that is the viewer's own has links to its steps;
// someone else's issue, in a teammate's view or Everyone's, is look-only.
// The words for where an issue or a bill stands come from standing.js (the one place At risk, Moving and Stopped are decided); nothing here restates them.
import { S, advocate, myIssueIds, effStage } from '../staff6/data.js';
import { hearingAhead, plainAction, stopOf, roomName, billByRef, billRef, isCarry, introYear } from '../staff6/model.js';
import { whereWords } from '../staff6/steps.js';
import { CHAMBER_NAME } from '../stops.js';
import { ic } from './icons7.js';
import { esc, btn, plainBand } from './parts.js';
import { billName, billNo, posWords, cmteWords, dayTime, first } from './steps.js';
import { myIssueStandings, billsOfIssue, issueStanding, billStanding, deadlineOf, isAtRisk, isAlive } from './standing.js';
import { withMe, sessionHTML } from './home.js';
import { dateWords, whenWords, sessionDates, touchMap, nextStop, whyWords, daysTo } from './words.js';
import { billPath, pathOf } from './path.js';

const enc = encodeURIComponent;
// What is open in the left column, kept across the minute's redraw in this visit only: the teammate picker.
export const ui = { pick: false, more: '' };   // more: the view (its `who` code) whose "Moved" list was opened, kept across the minute's redraw

// "e-cigarettes", never "vape": the Legislature's own titles stay as written, but an issue's name is HIPHI's (CLAUDE.md R-158)
const eCig = s => String(s || '').replace(/\bvap(?:e|es|ing)\b/gi, m => /^vap(es|ing)$/i.test(m) ? 'e-cigarettes' : 'e-cigarette');
const catOf = i => i && /^[a-z-]+$/.test(i.category || '') ? i.category : 'other';
const iconOf = i => (i && i.icon) || (S.categories || []).find(c => c.key === i?.category)?.icon || 'circle';
const tint = i => `--ic:var(--cat-${catOf(i)}, var(--cat-other))`;
const live = id => !!id && advocate(id)?.is_active !== false;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;

// ---------------------------------------------------------------------------------- whose issues, and the address
// `?who=` is nothing (Mine), `all` (Everyone) or a teammate's initials. A value that is none of these is "bad": the sheet says so calmly.
export function whoOf(raw, me, people) {
  if (raw == null || raw === '') return { kind: 'mine', code: '' };
  const r = String(raw).slice(0, 40);
  if (r.toLowerCase() === 'all') return { kind: 'all', code: 'all' };
  const p = people.find(a => String(a.initials || '').toUpperCase() === r.toUpperCase());
  if (!p) return { bad: true, kind: 'mine', code: '' };
  if (me && p.id === me.id) return { kind: 'mine', code: '' };
  return { kind: 'person', code: p.initials, person: p };
}
const qs = (who, extra = {}) => { const q = new URLSearchParams(); if (who.code) q.set('who', who.code); for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v); const s = q.toString(); return s ? `?${s}` : ''; };
const issuesHref = who => `#/issues${qs(who)}`;
const issueHref = (who, id) => `#/issue/${enc(id)}${qs(who)}`;
const billHref = (who, b, issueId) => `#/bill/${billRef(b).split('/').map(enc).join('/')}${qs(who, { i: issueId })}`;
const whoseWords = (who, me) => who.kind === 'mine' ? 'Your' : who.kind === 'all' ? 'Everyone’s' : `${first(who.person)}’s`;

// ---------------------------------------------------------------------------------- the set
// Every issue of the chosen set with its standing and the days left on its soonest at-risk bill: { issue, bills, standing, days }
function setFor(who, me) {
  const rows = who.kind === 'all'
    ? (S.issues || []).filter(i => !i.archived_at).map(i => { const bills = billsOfIssue(i); return { issue: i, bills, standing: issueStanding(bills) }; }).filter(x => x.standing)
    : withMe(who.kind === 'person' ? who.person : me, myIssueStandings);
  return rows.map(x => { const ds = x.bills.filter(isAtRisk).map(b => deadlineOf(b).days); return { ...x, days: ds.length ? Math.min(...ds) : null }; });
}
const byName = (x, y) => eCig(x.issue.name).localeCompare(eCig(y.issue.name), 'en', { numeric: true });
const GROUPS = [['risk', 'At risk'], ['moving', 'Moving'], ['stopped', 'Stopped this year']];
function grouped(set) {
  const g = { risk: [], moving: [], stopped: [] };
  for (const x of set) g[x.standing].push(x);
  g.risk.sort((x, y) => x.days - y.days || byName(x, y)); g.moving.sort(byName); g.stopped.sort(byName);
  return g;
}

// ---------------------------------------------------------------------------------- the session, for a set
// The session's rows, which of them touch the set's bills, and the next one that does
function sessionOf(set) {
  const rows = sessionDates(null), bills = [], seen = new Set();
  for (const x of set) for (const b of x.bills) if (!seen.has(b.id)) { seen.add(b.id); bills.push({ b, issue: x.issue }); }
  const touch = touchMap(bills.map(x => x.b));
  return { rows, bills, touch, next: nextStop(rows, touch) };
}

// ---------------------------------------------------------------------------------- the left column
// Look-only depends on the issue, not the view: the viewer's own issues keep their links to their steps, anyone else's say "Look only".
const ownSet = me => new Set(withMe(me, () => [...myIssueIds()]).map(String));
function row(x, who, openId) {
  const i = x.issue, on = String(i.id) === openId, dead = x.standing === 'stopped', risk = x.standing === 'risk';
  const mark = dead ? '<span class="imark" style="--ic:var(--edge)" aria-hidden="true">' : `<span class="imark" style="${tint(i)}" aria-hidden="true">`;
  const dl = risk ? x.bills.filter(isAtRisk).map(b => deadlineOf(b)).sort((p, q) => p.date.localeCompare(q.date))[0] : null;
  const second = dl ? `<span class="ir2 risk">${ic('triangle-alert')}<span>At risk · ${esc(whenWords(dl.date))}</span></span>` : '';
  const lead = who.kind === 'all' && live(i.owner_id) ? advocate(i.owner_id) : null;   // on Everyone: who leads it, in place of a count
  const right = lead && lead.initials ? `<span class="person sm" role="img" aria-label="Led by ${esc(first(lead))}">${esc(lead.initials)}</span>` : '';
  return `<li><a class="sr3 ir${on ? ' sel' : ''}${dead ? ' dead' : ''}"${on ? ' aria-current="true"' : ''} href="${issueHref(who, i.id)}">${mark}${ic(iconOf(i))}</span><span class="sv"><b>${esc(eCig(i.name))}</b>${second}</span>${right}</a></li>`;
}
function sessionRow(who, ses, on) {
  const nx = ses.next, line = nx ? `${nx.row.label} · ${whenWords(nx.row.date)}` : 'The session has ended';
  return `<ul class="srows3 sessrow"><li><a class="sr3 ir${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} id="sessionRow" href="#/issues/session${qs(who)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('flag')}</span><span class="sv"><b>The session</b><span class="ir2">${esc(line)}</span></span></a></li></ul>`;
}
function column(who, set, people, me, openKey, ses) {
  const g = grouped(set), mate = who.kind === 'person';
  const seg = (id, label, on, href) => `<a class="seg" id="${id}" href="${href}"${on ? ' aria-current="true"' : ''}>${label}</a>`;
  const pick = ui.pick || false;
  const mates = people.filter(a => (!me || a.id !== me.id) && a.is_active !== false).sort((p, q) => String(p.full_name).localeCompare(String(q.full_name), 'en'));
  let h = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">${mate ? `${esc(first(who.person))}’s issues` : who.kind === 'all' ? 'Everyone’s issues' : 'Issues'}</h2>${mate ? '<button class="btn text chg" type="button" id="whoChange" aria-controls="whoPick">Change</button>' : ''}</div>`
    + `<div class="segs3" role="group" aria-label="Whose issues">${seg('whoMine', 'Mine', who.kind === 'mine' && !who.bad, '#/issues')}`
    + `<button class="seg" type="button" id="whoMate" aria-expanded="${pick}" aria-controls="whoPick"${mate ? ' aria-current="true"' : ''}>A teammate</button>${seg('whoAll', 'Everyone', who.kind === 'all', '#/issues?who=all')}</div>`
    + `<ul class="whopick" id="whoPick" aria-label="Which teammate"${pick ? '' : ' hidden'}>${mates.map(a =>
      `<li><a class="pk${mate && who.person.id === a.id ? ' on' : ''}" id="who-${esc(String(a.initials).replace(/[^A-Za-z0-9]/g, ''))}" href="#/issues?who=${enc(a.initials)}"${mate && who.person.id === a.id ? ' aria-current="true"' : ''}>${esc(a.full_name)}</a></li>`).join('')}</ul></header>`;
  h += sessionRow(who, ses, openKey.session);
  if (!set.length) return h + `<p class="calmnote">${who.kind === 'mine' ? 'You are not on an issue yet. Pick Everyone to look around.' : who.kind === 'all' ? 'No issue has a bill this session.' : `${esc(first(who.person))} is not on an issue yet.`}</p>`;
  for (const [k, t] of GROUPS) if (g[k].length) h += `<section aria-labelledby="g-${k}"><h3 class="glab" id="g-${k}">${t} · ${g[k].length}</h3><ul class="srows3">${g[k].map(x => row(x, who, openKey.issue)).join('')}</ul></section>`;
  return h;
}
// The picker opens and closes in place: nothing is drawn again, so focus and scroll stay. A choice is a link, so Back works. Choosing where you already are draws nothing, so each
// of these closes the picker itself.
export function bindIssues() {
  const mo = document.getElementById('sMore');
  if (mo) mo.addEventListener('click', () => { ui.more = mo.dataset.k; mo.closest('p').remove(); document.querySelectorAll('#sMoved li.mx').forEach(l => { l.hidden = false; }); });
  const b = document.getElementById('whoMate'), l = document.getElementById('whoPick'); if (!b || !l) return;
  const set = on => { ui.pick = on; l.hidden = !on; b.setAttribute('aria-expanded', String(on)); };
  b.addEventListener('click', () => set(l.hidden));
  l.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.getElementById('whoMine')?.addEventListener('click', () => set(false));
  document.getElementById('whoAll')?.addEventListener('click', () => set(false));
  document.getElementById('whoChange')?.addEventListener('click', () => { set(true); l.querySelector('a')?.focus(); });
}

// ---------------------------------------------------------------------------------- small parts
const hband = (i, title, sub, crumb, grey) => `<div class="hband" style="${grey ? '--ic:var(--edge)' : tint(i)}"><span class="imark big" aria-hidden="true">${ic(iconOf(i))}</span><div class="ht">${crumb || ''}<h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${sub}</p>` : ''}</div></div>`;
const notFound = (what, back) => `<div class="pn" data-notfound="1">${plainBand(`We could not find ${what}.`, 'It may have been renamed, or it is not on the practice copy.')}<div class="pbody"><p class="lead"><a class="btn text" href="${back}">Back to Issues</a></p></div></div>`;
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
// Said on an issue (or a bill) that is not the viewer's, and nowhere else
const lookLine = who => who.kind === 'all' ? 'Everyone’s issues. Look only.' : who.kind === 'person' ? `${first(who.person)}’s issues. Look only.` : 'Look only.';

// HIPHI's position and who leads a bill: "Support w/ amendments · Kris leads", "No position yet · You lead"
function leadWords(b, issue, me) {
  let ids = [...new Set((S.assignments?.[b.id] || []).filter(live))];
  if (!ids.length && live(issue?.owner_id)) ids = [issue.owner_id];
  if (!ids.length) return 'No lead yet';
  const names = ids.map(id => me && id === me.id ? 'You' : first(advocate(id)));
  const j = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1 ? (names[0] === 'You' ? 'You lead' : `${names[0]} leads`) : `${j} lead`;
}
const posLine = (b, issue, me) => `${posWords(b)} · ${leadWords(b, issue, me)}`;
// the step of the person's own that holds this bill, if any (a group ask holds several)
const stepOn = (open, b) => (open || []).find(s => (s.members ? s.members.some(x => x.bill.id === b.id) : s.bill?.id === b.id)) || null;
// which chamber's bill it is: HB, HR and HCR are the House's, SB, SR and SCR the Senate's
const chamberWord = b => /^S/i.test(String(b.bill_number || '').trim()) ? 'Senate' : 'House';
// where an alive bill is, a few words: "in House Water & Land", "waiting for the floor vote"
function whereShort(b) {
  if (!isAlive(b)) return 'did not advance';
  const st = stopOf(b);
  if (st.phase === 'committee') return st.committee ? `in ${cmteWords(String(st.committee).split('/')[0])}` : 'waiting for its committees';
  if (st.phase === 'floor') return 'waiting for the floor vote';
  if (st.phase === 'conference') return 'in conference';
  if (st.phase === 'governor') return 'with the Governor';
  if (st.phase === 'law') return 'signed into law';
  if (st.phase === 'ballot') return 'going to the voters';
  return whereWords(b, { deadline: false });
}
const sameName = (b, issue) => billName(b).trim().toLowerCase() === eCig(issue.name).trim().toLowerCase();

// ---------------------------------------------------------------------------------- an issue's sheet
const num = b => String(b.bill_number).replace(/\s/g, '');
const ordered = bills => bills.slice().sort((x, y) => (billStanding(x) === 'risk' ? 0 : 1) - (billStanding(y) === 'risk' ? 0 : 1) || num(x).localeCompare(num(y), 'en', { numeric: true }));
// `quiet`: the issue's banner already says where this bill stands (an issue with one bill, at risk), so the row does not say it again
function billRow(b, issue, who, me, open, shown, own, quiet) {
  const alive = isAlive(b), risk = isAtRisk(b), dl = deadlineOf(b), st = own ? stepOn(open, b) : null, same = sameName(b, issue);
  const status = !alive || quiet ? '' : risk ? `<p class="bst riskt">${ic('triangle-alert')}<span>At risk · no hearing yet</span></p>`
    : dl ? `<p class="bst">${esc(`Needs a hearing by ${whenWords(dl.date)}`)}</p>` : same ? '' : `<p class="bst">${esc(whereWords(b, { deadline: false }))}</p>`;
  const move = st && !shown.has(st.id) ? `<a class="btn quiet ymove" href="#/do/${enc(st.id)}">Your move · ${esc(st.verb)}</a>` : '';
  const title = same ? esc(`${billNo(b)} · ${whereShort(b)}`) : `${esc(billName(b))}<span class="bno">${esc(billNo(b))}</span>`;   // a bill named like its issue is named by its number and where it is
  return `<li class="brow${alive ? '' : ' dead'}" style="${tint(issue)}"><div class="bmain"><a class="bn2" href="${billHref(who, b, issue.id)}">${title}</a>`
    + `<p class="bmeta">${esc(posLine(b, issue, me))}</p>${status}${move}</div><div class="bpath">${billPath(b)}</div></li>`;
}
function issueSheet(x, who, me, open, own) {
  const i = x.issue, bills = ordered(x.bills), alive = bills.filter(isAlive), dead = bills.filter(b => !isAlive(b)), risky = alive.filter(isAtRisk), lo = !own;
  const sub = !x.bills.length ? 'No bill on it this session.' : !alive.length ? 'Stopped for this year' : alive.length === bills.length ? esc(n(bills.length, 'bill', 'bills')) : esc(`${alive.length} of ${bills.length} bills still alive`);
  const crumb = lo ? `<span class="crumb">${esc(lookLine(who))}</span>` : '';
  let h = `<div class="pn">${hband(i, eCig(i.name), sub, crumb, !alive.length)}<div class="pbody">`;
  const shown = new Set(), banner = new Set();
  for (const b of risky) {
    const dl = deadlineOf(b), st = own ? stepOn(open, b) : null, ask = st && st.kind === 'ask' && !shown.has(st.id) ? st : null;
    if (ask) shown.add(ask.id);
    banner.add(b.id);
    h += `<div class="strip risk">${ic('triangle-alert')}<div class="stx"><strong>${bills.length > 1 ? `${esc(billName(b))} needs` : 'Needs'} a hearing by ${esc(whenWords(dl.date))}</strong>`
      + `<span class="hl">${alive.length === 1 && bills.length > 1 ? 'It is the last bill alive for this issue. ' : ''}Without a hearing it stops for the year.</span></div>${ask ? `<a class="btn filled stbtn" href="#/do/${enc(ask.id)}">${esc(ask.verb)}</a>` : ''}</div>`;
  }
  const row1 = b => billRow(b, i, who, me, open, shown, own, bills.length === 1 && banner.has(b.id));
  if (alive.length) h += `<ul class="brows">${alive.map(row1).join('')}</ul>`;
  if (dead.length) h += `<h2 class="dh">Did not advance</h2><ul class="brows">${dead.map(row1).join('')}</ul>`;
  return h + `</div></div>`;
}

// ---------------------------------------------------------------------------------- a bill's sheet (short, read-only)
const clean = t => String(t).replace(/\b[A-Z]{2,4}(?:\/[A-Z]{2,4})*\b/g, m => /^(HB|SB|HR|SR|HCR|SCR|PM|AM)$/.test(m) ? m : cmteWords(m));   // the Capitol's codes in words
// The bill's last action in plain words, without the date
function lastWords(b) {
  const t = String(b.last_action || '').trim();
  if (isCarry(b) && /^Carried over to/i.test(t)) return `Still alive from ${introYear(b)}`;
  return t ? clean(plainAction(t)[0]) : 'Introduced';
}
function justHappened(b) {
  const d = b.last_action_date ? dateWords(b.last_action_date) : '';
  return `${esc(lastWords(b))}${d ? ` · ${esc(d)}` : ''}`;
}
// The committee after the one a bill is in, from the referral list the way stops.js reads it (the first chamber's committees first, then the second's)
function nextCmte(b, st) {
  const refs = Array.isArray(b.referrals) ? b.referrals : [], stage = effStage(b);
  const originN = Math.min(b.origin_stops || 0, refs.length) || (/^second_(triple|lateral|decking)$|^first_crossover$/.test(stage) ? 0 : refs.length);
  const list = st.leg === 'first' ? refs.slice(0, originN || refs.length) : refs.slice(originN || refs.length);
  return list.length === st.stops && st.committee && list[st.stop - 1] === st.committee ? list[st.stop] || '' : '';
}
function afterThat(b) {
  const p = pathOf(b); if (p.dead) return '';
  const st = stopOf(b), ch = CHAMBER_NAME[st.chamber] || 'chamber';
  if (st.phase === 'committee') {
    if (st.isFinal || !st.stops || st.stops < 2) return `The floor vote in the ${ch}`;
    const nx = nextCmte(b, st);
    return nx ? `${cmteWords(nx)}, then the floor vote` : 'Its next committee, then the floor vote';
  }
  if (st.phase === 'floor') return st.leg === 'first' ? 'It crosses to the other chamber' : 'Back to the first chamber to agree, or to the Governor';
  if (st.phase === 'conference') return 'A final vote in each chamber, then the Governor';
  if (st.phase === 'governor') return 'The Governor signs it, vetoes it, or lets it become law';
  return '';
}
// when testimony is due for a hearing: the stated deadline, else a day before it starts
const testimonyDue = h => h.testimony_deadline ? new Date(h.testimony_deadline).getTime() : new Date(h.scheduled_at).getTime() - 864e5;
function billSheet(b, issue, who, me, open, others, own) {
  const alive = isAlive(b), dl = deadlineOf(b), h = hearingAhead(b), lo = !own, st = own ? stepOn(open, b) : null;
  const crumb = `<a class="crumb back2" href="${issueHref(who, issue.id)}">${ic('chevron-left')}Back to ${sameName(b, issue) ? 'the issue' : esc(eCig(issue.name))}</a>`;
  let out = `<div class="pn"><div class="hband" style="${alive ? tint(issue) : '--ic:var(--edge)'}"><span class="imark big" aria-hidden="true">${ic(iconOf(issue))}</span><div class="ht">${crumb}<h1 tabindex="-1">${esc(billName(b))}</h1><p class="bsub">${esc(billNo(b))}</p></div></div><div class="pbody">`;
  out += `<p class="lead${st && alive ? ' tight' : ''}">${esc(posLine(b, issue, me))}</p>`;
  if (st && alive) out += `<p class="lead mv"><a class="btn quiet ymove" href="#/do/${enc(st.id)}">Your move · ${esc(st.verb)}</a></p>`;   // the same quiet button as on the issue's rows
  if (lo) out += `<p class="hint lk0">${esc(lookLine(who))}</p>`;
  if (alive) {
    const next = h ? `Hearing ${esc(dayTime(h.scheduled_at))}` : dl ? `A hearing by ${esc(whenWords(dl.date))}` : esc(whereWords(b, { deadline: false }));
    out += `<h2 class="sh">Where it stands</h2>` + kv([['Just happened', justHappened(b)], ['Next', next], afterThat(b) ? ['After that', esc(afterThat(b))] : null]);
    out += `<div class="bigpath">${billPath(b, { wide: true })}</div>`;
    if (h) out += `<h2 class="sh">The hearing</h2>` + kv([['When', esc(dayTime(h.scheduled_at))], ['Where', esc(roomName(h.room) || 'No room is listed yet')], ['Committee', esc(cmteWords(h.committee))],
      ['Testimony due', esc(dayTime(testimonyDue(h)))]]);
  } else {
    out += `<h2 class="sh">Did not advance</h2>` + kv([['Stopped at', esc(pathOf(b).label)], ['Why', esc(clean(whyWords(b)))],
      ['Still alive', others.length ? others.map(o => `<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version · ${whereShort(o)}`)}</a>`).join('<br>') : 'Nothing else is alive for this issue this year.']]);
    out += `<div class="bigpath">${billPath(b, { wide: true })}</div>`;
  }
  return out + `</div></div>`;
}

// ---------------------------------------------------------------------------------- the session's sheet: the answer first (what is at risk, what is coming), then the dates and the next deadline
const HST_TZ = { timeZone: 'Pacific/Honolulu' };
const ymdOf = t => new Date(t).toLocaleDateString('en-CA', HST_TZ);
// a time that never wraps inside ("Mon 9:30 AM")
const tm = t => dayTime(t).replace(/[  ]/g, ' ');
const clockOf = t => new Date(t).toLocaleTimeString('en-US', { ...HST_TZ, hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ');
const SHOW_MOVED = 5;
// Hearing and hearing-notice actions are in "Next 7 days" already, so "Moved" leaves them out
const HEARING_ACT = /^(?:Hearing|Decision making) (?:set|moved|cancelled)|^Taken off|^Hearing notice/i;
const HEARING_RAW = /has scheduled a public hearing|to be heard by|will hold a public decision making|has rescheduled|deleted from the meeting|^Meeting scheduled on|hours? notice|day notice/i;
// "Referred to JDC, WAM, FIN" in words: "Sent to 3 Senate committees" (the full list stays on the bill page)
function movedWords(b) {
  const t = String(b.last_action || '').trim(), pl = t ? plainAction(t)[0] : '', m = /^Referred to (.+)$/.exec(pl);
  if (!m) return lastWords(b);
  const codes = m[1].split(/\s*[,/]\s*/).filter(Boolean), ch = CHAMBER_NAME[stopOf(b).chamber];
  return codes.length === 1 ? `Sent to ${cmteWords(codes[0])}` : `Sent to ${codes.length} ${ch ? ch + ' ' : ''}committees`;
}
// What the session holds for a set: the hearings of the next 7 days (Honolulu days 0 to 6, one per bill and time, alive bills only), the alive at-risk bills, and what moved in the last 7 days
function weekOf(ses) {
  const byId = new Map(ses.bills.filter(x => isAlive(x.b)).map(x => [x.b.id, x.b])), seen = new Set(), bills = ses.bills.map(x => x.b);
  const hearings = (S.hearings || []).filter(h => h.status === 'scheduled' && byId.has(h.bill_id) && daysTo(ymdOf(h.scheduled_at)) >= 0 && daysTo(ymdOf(h.scheduled_at)) <= 6 && !seen.has(h.bill_id + '|' + h.scheduled_at) && seen.add(h.bill_id + '|' + h.scheduled_at))
    .map(h => ({ h, b: byId.get(h.bill_id) })).sort((x, y) => new Date(x.h.scheduled_at) - new Date(y.h.scheduled_at) || num(x.b).localeCompare(num(y.b), 'en', { numeric: true }));
  const risk = bills.filter(b => isAlive(b) && isAtRisk(b)).sort((x, y) => deadlineOf(x).date.localeCompare(deadlineOf(y).date) || num(x).localeCompare(num(y), 'en', { numeric: true }));
  const moved = bills.filter(b => b.last_action_date && daysTo(b.last_action_date) >= -6 && daysTo(b.last_action_date) <= 0 && !HEARING_ACT.test(plainAction(String(b.last_action || ''))[0]) && !HEARING_RAW.test(String(b.last_action || '')))
    .sort((x, y) => String(y.last_action_date).localeCompare(String(x.last_action_date)) || num(x).localeCompare(num(y), 'en', { numeric: true }));
  return { hearings, risk, moved, alive: bills.filter(isAlive).length, total: bills.length };
}
function sessionSheet(who, set, me, ses) {
  const nx = ses.next, wk = weekOf(ses), mate = who.kind === 'person' ? who.person : null;
  const whose = who.kind === 'mine' ? 'your bills' : who.kind === 'all' ? 'everyone’s bills' : `${first(who.person)}’s bills`;
  const issueOfBill = b => (set.find(x => x.bills.some(y => y.id === b.id)) || {}).issue;
  // the lead's face: after the row's words, on Everyone; on a teammate's view only when the lead is someone else; none on Mine
  const face = b => {
    if (who.kind === 'mine') return '';
    const i = issueOfBill(b), id = [...(S.assignments?.[b.id] || []).filter(live), ...(live(i?.owner_id) ? [i.owner_id] : [])][0], a = id ? advocate(id) : null;
    return a?.initials && !(mate && a.id === mate.id) ? ` <span class="person sm" role="img" aria-label="Led by ${esc(first(a))}">${esc(a.initials)}</span>` : '';
  };
  // one bill, drawn like the left column's rows: its issue's mark, the name in ink with the number after it, then its lines of words (already escaped)
  const brow = (b, lines, extra = '') => { const i = issueOfBill(b) || {}; return `<li${extra}><a class="sr3 ir bl" href="${billHref(who, b, i.id)}"><span class="imark" style="${tint(i)}" aria-hidden="true">${ic(iconOf(i))}</span><span class="sv"><b>${esc(billName(b))}</b> <span class="no">${esc(billNo(b))}</span>${face(b)}${lines}</span></a></li>`; };
  const line = (t, cls = '', icon = '') => `<span class="ir2${cls ? ' ' + cls : ''}">${icon ? ic(icon) : ''}<span>${t}</span></span>`;
  const byNo = (x, y) => num(x).localeCompare(num(y), 'en', { numeric: true });

  // 1. the answer
  const hn = wk.hearings.length, riskN = wk.risk.length;
  const answer = `${riskN ? `${n(riskN, 'bill', 'bills')} at risk` : 'Nothing at risk'} · ${hn ? n(hn, 'hearing', 'hearings') : 'no hearings'} in the next 7 days`;
  const label = who.kind === 'mine' ? 'The session' : `The session · ${whose}`;
  const top = `<p class="ovdate">${esc(label)}</p><h1 tabindex="-1">${esc(answer)}</h1><p class="ovsub">${wk.total ? esc(`${wk.alive} of ${wk.total} bills still alive`) : 'No bills on these issues yet.'}</p>`;

  // 3. the next deadline and the bills it touches, each once, with their state for it
  let next = '';
  const touched = nx ? nx.touched.slice().sort((p, q) => (isAtRisk(q) - isAtRisk(p)) || byNo(p, q)) : [];
  if (nx) {
    const state = b => isAtRisk(b) ? line('At risk · needs a hearing', 'risk', 'triangle-alert') : hearingAhead(b) ? line(`Hearing ${esc(tm(hearingAhead(b).scheduled_at))}`) : line(esc(whereShort(b)));
    next = `<h2 class="sh" id="sNext">Next deadline: ${esc(nx.row.label)} · ${esc(whenWords(nx.row.date))}</h2><p class="lead tight">${esc(nx.row.says)}</p>`
      + (touched.length ? `<ul class="srows3 brs" id="sTouch">${touched.map(b => brow(b, state(b))).join('')}</ul>` : `<p class="hint">It touches none of ${esc(whose)}.</p>`);
  }
  const inTouch = new Set(touched.map(b => b.id)), also = wk.risk.filter(b => !inTouch.has(b.id));
  if (also.length) next += `<h2 class="sh" id="sAlso">Also at risk</h2><ul class="srows3 brs" id="sRisk">${also.map(b => brow(b, line(`Needs a hearing by ${esc(whenWords(deadlineOf(b).date))}`, 'risk', 'triangle-alert'))).join('')}</ul>`;

  // 4. the hearings, under their days
  let hear = `<h2 class="sh" id="sHearH">Next 7 days</h2>`;
  if (!hn) hear += `<p class="hint" id="sNoHear">No hearings for ${esc(whose)} in the next 7 days.</p>`;
  else {
    const days = []; for (const x of wk.hearings) { const d = ymdOf(x.h.scheduled_at), g = days[days.length - 1]; if (g && g.d === d) g.rows.push(x); else days.push({ d, rows: [x] }); }
    const now = Date.now();
    hear += `<div id="sHear">${days.map(g => `<h3 class="glab">${esc(dateWords(g.d))}</h3><ul class="srows3 brs">${g.rows.map(({ h, b }) => { const due = testimonyDue(h), late = due <= now;
      return brow(b, line(`<b class="when">${esc(clockOf(h.scheduled_at))}</b> · ${esc(cmteWords(h.committee))}`) + (late ? line(`Testimony was due ${esc(tm(due))}`, 'late', 'circle-alert') : line(`Testimony due ${esc(tm(due))}`)), ` data-h="1"`); }).join('')}</ul>`).join('')}</div>`;
  }

  // 5. what moved, five rows and a button for the rest
  let moved = '';
  if (wk.moved.length) {
    const key = who.code || 'mine', open = ui.more === key, rest = wk.moved.length - SHOW_MOVED;
    const row = (b, k) => brow(b, line(`${esc(movedWords(b))} · ${esc(dateWords(b.last_action_date))}`), k >= SHOW_MOVED ? ` class="mx"${open ? '' : ' hidden'}` : '');
    moved = `<h2 class="sh" id="sMovedH">Moved in the last 7 days</h2><ul class="srows3 brs" id="sMoved">${wk.moved.map(row).join('')}</ul>${rest > 0 && !open ? `<p class="more">${btn(`Show ${rest} more`, { kind: 'quiet', id: 'sMore', attrs: `data-k="${esc(key)}"` })}</p>` : ''}`;
  }
  return `<div class="pn"><div class="ov"><div class="ovtop">${top}</div><div class="ovrest">${sessionHTML(null, ses.touch).replace('<h2 class="fl" id="sesh">', '<h2 class="fl vh" id="sesh">')}${next}${hear}${moved}</div></div></div>`;
}

// ---------------------------------------------------------------------------------- put together
// rt: { r: 'issues' | 'issue' | 'bill', id, q: URLSearchParams }. Returns what the frame draws.
export function issuesModel({ me, open, rt, people }) {
  const who = whoOf(rt.q.get('who'), me, people), set = who.bad ? setFor({ kind: 'mine', code: '' }, me) : setFor(who, me), back = issuesHref(who.bad ? { code: '' } : who), own = ownSet(me), ses = sessionOf(set);
  let sheet, label = 'Issues', picked = true, openKey = { session: false, issue: '' }, bk = back;
  const showSession = () => { openKey = { session: true, issue: '' }; sheet = sessionSheet(who, set, me, ses); label = 'The session'; };
  const showIssue = x => { openKey = { session: false, issue: String(x.issue.id) }; sheet = issueSheet(x, who, me, open, own.has(String(x.issue.id))); label = 'Issue'; };
  const gone = what => { sheet = notFound(what, back); label = 'Not found'; };
  if (who.bad) gone('that list of issues');
  else if (rt.r === 'issues') {
    if (rt.id === 'session') showSession();
    else if (rt.id) gone('that part of Issues');
    else {   // the first row opens: an own at-risk issue when there is one, else the session. The address stays #/issues, and on a phone the list shows first
      picked = false;
      const risk = who.kind === 'mine' ? grouped(set).risk[0] : null;
      if (risk) showIssue(risk); else showSession();
    }
  } else if (rt.r === 'issue') {
    const i = rt.id ? (S.issues || []).find(x => String(x.id) === rt.id && !x.archived_at) : null;
    if (!i) gone('that issue');
    else showIssue(set.find(y => String(y.issue.id) === String(i.id)) || { issue: i, bills: billsOfIssue(i), standing: issueStanding(billsOfIssue(i)) });
  } else {
    const b = rt.id && rt.id.length < 40 ? billByRef(rt.id) : null;
    if (!b || b.tracked === false) gone('that bill');
    else {
      const ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => String(x.issue_id)), want = rt.q.get('i') || '';
      const cand = (S.issues || []).filter(i => !i.archived_at && ids.includes(String(i.id)));
      const issue = cand.find(i => String(i.id) === want) || cand.find(i => set.some(y => String(y.issue.id) === String(i.id))) || cand[0];
      if (!issue) gone('that bill’s issue');
      else { openKey = { session: false, issue: String(issue.id) }; sheet = billSheet(b, issue, who, me, open, billsOfIssue(issue).filter(o => o.id !== b.id && isAlive(o)), own.has(String(issue.id))); label = 'Bill'; bk = ''; }   // its own back link, in the band, says where it goes
    }
  }
  return { who, set, col: column(who, set, people, me, openKey, ses), sheet, picked, label, back: bk, bind: bindIssues, notFound: /data-notfound/.test(sheet) };
}
