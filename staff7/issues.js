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
import { dateWords, whenWords, sessionDates, touchMap, nextStop, whyWords } from './words.js';
import { billPath, pathOf } from './path.js';

const enc = encodeURIComponent;
// What is open in the left column, kept across the minute's redraw in this visit only: the teammate picker.
export const ui = { pick: false };

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
function justHappened(b) {
  const t = String(b.last_action || '').trim(), d = b.last_action_date ? dateWords(b.last_action_date) : '';
  if (isCarry(b) && /^Carried over to/i.test(t)) return `Still alive from ${introYear(b)}${d ? ` · ${esc(d)}` : ''}`;
  const w = t ? clean(plainAction(t)[0]) : 'Introduced';
  return `${esc(w)}${d ? ` · ${esc(d)}` : ''}`;
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
      ['Testimony due', esc(dayTime(h.testimony_deadline ? new Date(h.testimony_deadline).getTime() : new Date(h.scheduled_at).getTime() - 864e5))]]);
  } else {
    out += `<h2 class="sh">Did not advance</h2>` + kv([['Stopped at', esc(pathOf(b).label)], ['Why', esc(clean(whyWords(b)))],
      ['Still alive', others.length ? others.map(o => `<a class="lk" href="${billHref(who, o, issue.id)}">${esc(`${billNo(o)}, the ${chamberWord(o)} version · ${whereShort(o)}`)}</a>`).join('<br>') : 'Nothing else is alive for this issue this year.']]);
    out += `<div class="bigpath">${billPath(b, { wide: true })}</div>`;
  }
  return out + `</div></div>`;
}

// ---------------------------------------------------------------------------------- the session's sheet: its next deadline, and which of the set's bills it touches
function sessionSheet(who, set, me, ses) {
  const nx = ses.next, whose = who.kind === 'mine' ? 'your bills' : who.kind === 'all' ? 'the bills on every issue' : `${first(who.person)}’s bills`;
  const issueOfBill = b => (set.find(x => x.bills.some(y => y.id === b.id)) || {}).issue;
  const hit = nx ? nx.touched.slice().sort((p, q) => num(p).localeCompare(num(q), 'en', { numeric: true })) : [], shownBills = hit.slice(0, 12);
  const list = !shownBills.length ? '' : `<ul class="tlist">${shownBills.map(b => `<li><a class="lk" href="${billHref(who, b, issueOfBill(b)?.id)}">${esc(billName(b))}</a><span class="no"> ${esc(billNo(b))}</span> <span class="tw">· ${esc(whereShort(b))}</span></li>`).join('')}</ul>${hit.length > 12 ? `<p class="hint">and ${hit.length - 12} more</p>` : ''}`;
  const top = nx ? `<p class="ovdate">Next deadline</p><h1 tabindex="-1">${esc(nx.row.label)}</h1><p class="ovsub">${esc(whenWords(nx.row.date))}</p>` : `<h1 tabindex="-1">The session has ended</h1>`;
  const touch = !nx ? '' : `<h2 class="sh">${hit.length ? `It touches ${hit.length} of ${whose}` : `It touches none of ${whose}`}</h2>`;
  return `<div class="pn"><div class="ov"><div class="ovtop">${top}</div><div class="ovrest">${nx ? `<p class="lead tight">${esc(nx.row.says)}</p>${touch}${list}` : ''}${sessionHTML(null, ses.touch)}</div></div></div>`;
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
