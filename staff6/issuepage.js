// One issue (#/issue/<id>, F154), rebuilt for Staff v6 (R-336 walk 3; Nate, 25 Oct: "might be the most important page in
// the entire website ... going to this page should show everything that a staff member needs to know about what's going
// on with their bills"). A person comes here to see, at a glance, where each of the issue's bills stands, what to do next,
// who is working on it and where legislators stand (B-1). Nate's rule for reading it: the goal is to get one bill through,
// and having at least one bill alive in each chamber is ideal; so the page leads with one plain sentence that says exactly
// that (the health check: "On track: alive in both chambers. Next: HB 1779 needs a hearing by Mon 3/30."), in neutral, no
// colour alarm (A-5 on v6: status by exception), then the bills in two columns, House | Senate, each with a slim stage bar
// (tracker.js trackerModel, the bill page's bar without its labels, so no committee codes in rows: C-15 on v6), the alive
// ones first and the stopped ones quiet with when and why. On a laptop the side column opens with What to do next (the
// steps.js rows Today and the bill use, each with its one button where the app already offers one: D16), so the first
// screen holds all three (Nate: "Being able to understand that along with what to do next in a quick glance is crucial").
//
// Below, or folded with a label: who is working on it (owner, helpers, coalitions, who holds which step); where
// legislators stand (the chairs and members of the committees holding the alive bills, with pathway.js's stances and
// photos); the issue's timeline across all its bills (newest first, folded after five); public interest and where partners
// stand; the goal, talking points and materials; last year's result; related issues; and the 2027 prep card (prep.js; in
// session it is left out until someone starts it, item 7 of walk 3).
//
// Replaced, not added (A-25): the lead mark (issuestand.js) and Hearings this week (coalition.js standWeekHTML) gave way to
// the health check, the chamber columns and What to do next; "On the public page" became Public interest (with partners);
// the separate "Talks with legislators" section became the timeline's talks, with Log a talk on the timeline's head.
//
// Moved here from issues.js (R-336 walk 3): pageRender and its helpers, the bill search to put a bill on the issue,
// related issues, merge, archive, the first-visit switch. issues.js re-exports issuePage, so app.js is unchanged.
import { S, DB, SESSION_YEAR, SESSION_OVER, hooks, esc, advocate, fmtDate, effStage, STAGE_LABEL } from './data.js';
import { billById, plain, PUBLIC_APP, billRef, billRoute, stopOf, riskOf, diedish, hearingAhead, whenAt, gateNeed, legsOf, stanceOf, legById, OUTCOME_LABEL, ownerFirst, codesOf } from './model.js';
import { icon, btn, iconBtn, empty, toast, menuSheet, confirmSheet, switchRow, ownerOf, openSheet, closeSheet } from './ui.js';
import { plural, afterClose, billName } from './lists.js';
import { logConversation, refreshConversations } from './conversation.js';
import { prepCardHTML, wirePrepCard, isDraft, stateOf, prepListHref, BOARD_HREF, prepHoldsOutlook, helpersOf as issueHelpersOf } from './prep.js';
import { testimonyOf, dueOf } from './hearing.js';
import { isPos, dueWhen } from './standing.js';
import { billWords, billLineRow } from './coalition.js';
import { listBox, rememberRow } from './issuestand.js';
import { PROFILES, caresSecHTML, caresLegs } from './profile.js';
import { itemRow, billRow, billStep, nw, dayWords, numWords, nameWords, committeeName, whereWords, firstWords } from './steps.js';
import { trackerModel } from './tracker.js';
import { STANCE_WORD, STANCE_ICON, photo, shortName, legHref, roleWord } from './pathway.js';
import { catByKey, issueById, alsoIn, billsOn, billFrom, whyNot, inFirstVisit, relatedOf, STANCES, againstStance, stanceChip, pickStance, openIssueForm } from './issues.js';

// ---- small helpers (copied from issues.js, which keeps its own for the list) ----
const live = () => (S.issues || []).filter(i => !i.archived_at);
const byName = (a, b) => a.name.localeCompare(b.name);
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
const catIcon = k => catByKey(k)?.icon || 'tag';
const mayPublic = i => !!S.me && (!!S.me.is_admin || i.owner_id === S.me.id);
const mayStance = mayPublic;
const wantPeople = () => { if (!S.peopleLoaded && !S.peopleLoading && !S.isPeopleTried) { S.isPeopleTried = true; DB.loadPeople().then(() => hooks.render()).catch(() => {}); } };
function followers(i) {
  if (!S.peopleLoaded) return null;
  const cats = new Set([i.category, ...alsoIn(i)]); let own = 0, via = 0;
  for (const p of S.people || []) { if ((p.issue_ids || []).includes(i.id)) own++; else if ((p.category_keys || []).some(k => cats.has(k))) via++; }
  return { own, via };
}
const CH = { H: 'House', S: 'Senate' };
const ms = t => t == null || t === '' ? null : new Date(typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t + 'T12:00:00-10:00' : t).getTime();
const yearOf = t => +new Date(ms(t)).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }).slice(0, 4);
// "Mon 3/16" this session's year; "Tue 3/11/25" for an earlier one (the timeline and last year reach back).
const dayAny = t => yearOf(t) === +SESSION_YEAR ? dayWords(t) : new Date(ms(t)).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', year: '2-digit', timeZone: 'Pacific/Honolulu' }).replace(',', '');
const listAnd = a => a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const cw = code => committeeName(code) || code;
// A to-do's title is typed (or made by the database) with the Capitol's codes ("the HHS/CPN hearing 3/20"): rows say
// committees in words (C-15 on v6), so a known code is named.
const unCode = t => String(t || '').replace(/\b[A-Z]{3}(?:\/[A-Z]{3})*\b/g, c => { const w = committeeName(c); return w && w !== c ? w : c; });
const P = () => S.isPage ??= { q: {}, edit: {}, rel: {} };

// Where an issue's Back goes (R-316 W16): to the prep list or the Prep board it was opened from, to My issues, else All issues.
const backTo = route => route.q?.from === 'prep' ? { href: prepListHref(), label: 'Your issues for 2027' } : route.q?.from === 'board' ? { href: BOARD_HREF, label: 'Prep board' }
  : route.q?.from === 'mine' ? { href: '#/my-issues', label: 'My issues' } : { href: '#/my-issues/all', label: 'All issues' };

// ---- where each bill stands: the chamber it is in now, or where it stopped ----
// A bill counts in the chamber it sits in now (an HB the House passed is working in the Senate): that is where its chairs
// are and where the team works on it. Past both chambers (conference, the Governor, law) is its own row over the columns.
const PAST = new Set(['conference', 'governor', 'ballot', 'law']);
function placeOfBill(b) {
  const st = stopOf(b), stage = effStage(b);
  if (stage === 'enacted' || st.phase === 'law') return { b, st, side: 'past', alive: true, law: true };
  if (!diedish(b)) return { b, st, side: PAST.has(st.phase) ? 'past' : st.chamber, alive: true };
  // Stopped: in the chamber of the stop it stopped at (the tracker's own reading of died_at_stage), else its own chamber.
  let side = b.chamber || (String(b.bill_number).startsWith('S') ? 'S' : 'H');
  try { const m = trackerModel(b); const s = m.stops[m.place.at]; if (s && (s.group === 'H' || s.group === 'S')) side = s.group; } catch { /* the bar is optional */ }
  return { b, st, side, alive: false, vetoed: stage === 'vetoed' };
}
// Why and when a bill stopped, in a few words: "Stopped 2/20: did not reach its last committee", "Stopped 2/10: deferred
// by House Health", "Vetoed by the Governor". Neutral, never red (A-5 on v6: a stopped bill cannot be acted on).
function stoppedWords(b) {
  if (effStage(b) === 'vetoed') return 'Vetoed by the Governor';
  const def = Object.values(S.outcomes || {}).filter(o => o.bill_id === b.id && o.outcome === 'deferred').sort((x, y) => String(y.scheduled_at).localeCompare(String(x.scheduled_at)))[0];
  const m = /^(.*?)\s+(\d+)\/(\d+)\/(\d+)$/.exec(b.died_deadline || '');
  if (m && /sine die/i.test(m[1])) return `Stopped ${+m[2]}/${+m[3]}: the session ended before it passed`;
  if (m && /_floor$/.test(b.died_at_stage || '')) return `Stopped ${+m[2]}/${+m[3]}: through committee, but no floor vote`;
  if (def && (!m || effStage(b) !== 'dead')) return `Stopped ${dayAny(def.scheduled_at).replace(/^\w+ /, '')}: deferred by ${cw(def.committee)}`;
  if (m) return `Stopped ${+m[2]}/${+m[3]}: did not ${gateNeed(m[1], 1)}`;
  if (def) return `Stopped ${dayAny(def.scheduled_at).replace(/^\w+ /, '')}: deferred by ${cw(def.committee)}`;
  if (/failed to pass/i.test(b.last_action || '') || b.status_text === 'Failed a vote') return 'Stopped: failed a floor vote';
  return SESSION_OVER ? 'Stopped when the session ended' : 'Stopped: did not advance';
}
// The slim stage bar (tracker.js's stops and states, drawn without labels: the row's line says where in words, and the
// bill page holds the full bar). For the eye only; the row's words carry it for a screen reader.
function barHTML(b) {
  let m; try { m = trackerModel(b); } catch { return ''; }
  if (!m.stops.length) return '';
  return `<span class="ip6-bar" aria-hidden="true" style="grid-template-columns: repeat(${m.stops.length}, minmax(0, 1fr))">${m.stops.map(s => `<i class="is-${s.state}"></i>`).join('')}</span>`;
}
const stepOfWords = b => { try { const m = trackerModel(b); return m.place.state === 'live' && m.cur >= 0 ? `Step ${m.cur + 1} of ${m.n}. ` : ''; } catch { return ''; } };
// One bill in a chamber column: its name, its number small, the bar, and one line (where it is, or why it stopped).
function billCard(x) {
  const b = x.b, line = x.law ? 'Signed into law' : x.alive ? whereWords(b) : stoppedWords(b);
  return `<div class="v6-row ip6-brow${x.alive ? '' : ' is-stop'}" role="listitem" data-v6row="${esc(b.id)}" data-bill="${esc(b.id)}">
    <a class="v6-row-main" href="${esc(billRoute(b))}"><span class="v6-row-top"><span class="v6-row-name">${esc(nameWords(b))}</span> <span class="v6-row-num">${esc(numWords(b))}</span></span>
      ${x.alive ? barHTML(b) : ''}<span class="v6-row-line">${x.alive ? '' : icon('circle-minus')}<span><span class="sr">${esc(stepOfWords(b))}</span>${nw(esc(line))}</span></span></a></div>`;
}
const STOP_SHOWN = 2;   // stopped bills past this many fold under one line (what is done may fold: rule 3)
function columnHTML(side, xs) {
  const alive = xs.filter(x => x.alive), gone = xs.filter(x => !x.alive), word = CH[side];
  const count = alive.length ? `${alive.length} alive` : '';
  const shown = gone.slice(0, alive.length ? 0 : STOP_SHOWN), more = gone.slice(shown.length);
  const fold = more.length ? `<details class="ip6-fold" data-fold="stop-${side}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${alive.length || shown.length ? `${plural(more.length, 'more')} stopped` : `${plural(more.length, 'bill')} stopped`}</span></summary>${listBox(more.map(billCard).join(''))}</details>` : '';
  return `<section class="ip6-col" aria-labelledby="ip-c${side}" data-ip-col="${side}">
    <h3 class="ip6-colh" id="ip-c${side}">${word}${count ? ` <span class="ip6-coln">${count}</span>` : ''}</h3>
    ${alive.length ? listBox(alive.map(billCard).join('')) : `<p class="ip6-none" data-ip-none="${side}">${icon('circle-minus')}<span>No ${word} bill alive</span></p>`}
    ${shown.length ? listBox(shown.map(billCard).join('')) : ''}${fold}
  </section>`;
}

// ---- what to do next: each alive bill's step (steps.js billStep, the row Today and the bill draw), its hearing ahead
// when it has no step, and its open to-dos; in date order ----
function nextSteps(bills) {
  const out = [], v = S.me;
  for (const b of bills) {
    if (b.tracked === false || diedish(b)) continue;
    const s = billStep(b, { viewer: v }), h = hearingAhead(b), st = stopOf(b);
    if (s && !['none', 'filed'].includes(s.kind)) {
      const at = s.act?.at ?? s.due ?? (s.kind === 'chair' && st.deadline ? ms(st.deadline.date) : null);
      const say = s.kind === 'chair' && s.ask?.key === 'ask' && st.deadline ? `${numWords(b)} needs a hearing by ${dayWords(st.deadline.date)}` : `${numWords(b)} · ${String(s.line || '')}`;
      out.push({ at, b, html: billRow(b, { viewer: v, step: s }), say, who: s.nobody ? [] : (s.whose?.ids || []), verb: s.kind, nobody: !!s.nobody });
    } else if (h) {
      out.push({ at: ms(h.scheduled_at), b, html: billRow(b, { viewer: v, line: nw(esc(`Hearing ${whenAt(h.scheduled_at)} · ${cw(h.committee)}`)), button: false }),
        say: `${numWords(b)} has a hearing ${whenAt(h.scheduled_at)}`, who: [], verb: 'hearing' });
    }
    for (const t of (S.todos?.[b.id] || []).filter(t => !t.done)) {
      const due = t.due_date ? ms(String(t.due_date).length === 10 ? t.due_date + 'T17:00:00-10:00' : t.due_date) : null;
      const who = t.assignee_id ? cap(firstWords(t.assignee_id, v)) : 'No owner yet';
      out.push({ at: due, b, html: itemRow({ key: 'td' + t.id, name: unCode(t.title), num: numWords(b), line: nw(esc([who, due != null ? `due ${dayWords(due)}` : ''].filter(Boolean).join(' · '))), href: billRoute(b), cls: 'ip6-todo' }),
        say: `${numWords(b)}: ${unCode(t.title)}`, who: t.assignee_id ? [t.assignee_id] : [], verb: 'todo' });
    }
  }
  return out.sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));
}
function nextHTML(steps, anyBills) {
  return `<section class="ip6-sec ip6-next" aria-labelledby="ip-nh"><h2 class="ip6-h" id="ip-nh">What to do next</h2>
    ${steps.length ? `<div class="v6-list i6-list" role="list">${steps.map(x => x.html).join('')}</div>`
      : `<p class="ip6-quiet">${anyBills ? 'Nothing to do on its bills right now.' : 'Nothing yet: put a bill on it first.'}</p>`}
  </section>`;
}

// ---- the health check: one plain sentence, Nate's words (25 Oct) ----
function health(xs, steps, earlier) {
  const now = xs.filter(x => thisSession(x.b)), alive = now.filter(x => x.alive), law = alive.filter(x => x.law);
  const H = alive.filter(x => x.side === 'H'), Sn = alive.filter(x => x.side === 'S'), past = alive.filter(x => x.side === 'past' && !x.law);
  let k, text;
  if (!now.length) { k = 'none'; text = earlier.length ? `No ${SESSION_YEAR} bills yet: put this session’s bills on it to follow them here.` : 'No bills yet: put a bill on this issue to follow it here.'; }
  else if (law.length) { k = 'won'; text = `${listAnd(law.map(x => numWords(x.b)))} became law.`; }
  else if (!alive.length) { k = 'stopped'; text = now.length === 1 ? 'its only bill stopped this session.' : 'every bill on this issue stopped this session.'; }
  else if (past.length) { k = 'ontrack'; const x = past[0]; text = `${numWords(x.b)} is through both chambers, ${x.st.phase === 'conference' ? 'in conference' : x.st.phase === 'governor' ? 'on the Governor’s desk' : 'with the voters'}.`; }
  else if (H.length && Sn.length) { k = 'ontrack'; text = 'alive in both chambers.'; }
  else { k = 'risk'; const one = H.length ? 'House' : 'Senate', n = alive.length; text = n === 1 ? `only one bill alive, in the ${one}.` : `${n} bills alive, all in the ${one}.`; }
  const LEAD = { ontrack: ['On track', 'circle-check'], risk: ['At risk', 'circle-alert'], stopped: ['Stopped', 'circle-minus'], won: ['Won', 'circle-check'], none: ['', 'circle-dashed'] }[k];
  const nx = steps[0] && k !== 'stopped' && k !== 'none' ? ` <span class="ip6-hn">Next: ${esc(steps[0].say.replace(/\.$/, ''))}.</span>` : '';
  return { k, html: `<section class="ip6-health" data-health="${k}" aria-labelledby="ip-hh"><h2 class="sr" id="ip-hh">How it stands</h2>
    <p class="ip6-hs">${icon(LEAD[1])}<span>${LEAD[0] ? `<b>${LEAD[0]}:</b> ` : ''}${nw(esc(cap(text) === text || LEAD[0] ? text : cap(text)))}${nx ? nw(nx) : ''}</span></p></section>` };
}

// ---- who is working on it ----
const VERB = { nodraft: 'writes the testimony for', write: 'writes the testimony for', submit: 'sends the testimony for', revise: 'revises the testimony for',
  approve: 'approves the testimony for', second: 'gives a second look to', file: 'files the testimony for', missed: 'checks the testimony for', chair: 'asks the chair about', todo: 'has a to-do on' };
function whoHTML(i, xs, steps) {
  const ppl = new Map(), add = (id, k, v) => { if (!id || !advocate(id)) return; const p = ppl.get(id) || ppl.set(id, { own: false, help: false, bills: [], steps: [] }).get(id); if (k === 'own' || k === 'help') p[k] = true; else p[k].push(v); };
  add(i.owner_id, 'own');
  for (const h of issueHelpersOf(i)) add(h.id, 'help');
  for (const x of xs) if (x.alive && thisSession(x.b)) { const o = ownerOf(x.b); if (o) add(o.id, 'bills', x.b); }
  for (const s of steps) for (const id of s.who) add(id, 'steps', s);
  const nobody = steps.filter(s => s.nobody).length;
  const name = id => id === S.me?.id ? 'You' : advocate(id).full_name;
  const lineOf = p => [p.own ? 'Owns the issue' : p.help ? 'Helps on it' : '',
    p.bills.length ? `owns ${p.bills.length > 2 ? `${p.bills.length} of its bills` : listAnd(p.bills.map(numWords))}` : '',
    p.steps.length === 1 ? `${VERB[p.steps[0].verb] || 'has a step on'} ${numWords(p.steps[0].b)}` : p.steps.length ? `${p.steps.length} steps now` : ''].filter(Boolean).join(' · ');
  const rows = [...ppl.entries()].sort((a, b) => (b[1].own - a[1].own) || (b[1].steps.length - a[1].steps.length) || name(a[0]).localeCompare(name(b[0])))
    .map(([id, p]) => `<div class="v6-row ip6-prow" role="listitem"><span class="ip6-pmain"><span class="v6-row-name">${esc(name(id))}</span><span class="v6-row-line"><span>${nw(esc(cap(lineOf(p))))}</span></span></span></div>`).join('');
  const coal = [...new Set(xs.filter(x => thisSession(x.b)).flatMap(x => S.billCampaigns?.[x.b.id] || []))].map(id => (S.campaigns || []).find(c => c.id === id)).filter(Boolean);
  return `<section class="ip6-sec" aria-labelledby="ip-wh"><h2 class="ip6-h" id="ip-wh">Who is working on it</h2>
    ${rows ? `<div class="v6-list i6-list" role="list">${rows}</div>` : `<p class="ip6-quiet">Nobody yet.</p>`}
    ${nobody ? `<p class="ip6-pl">${icon('user-plus')}<span>${plural(nobody, 'step')} above ${nobody === 1 ? 'has' : 'have'} no owner yet</span></p>` : ''}
    ${coal.length ? `<p class="ip6-pl">${icon('users')}<span>${coal.length === 1 ? 'Coalition' : 'Coalitions'}: ${coal.map(c => `<a href="#/coalition/${encodeURIComponent(c.id)}">${esc(c.public_name || c.name)}</a>`).join(', ')}</span></p>` : ''}
  </section>`;
}

// ---- where legislators stand: the committees holding the alive bills now, chairs first, with what we know ----
function legsHTML(i, xs) {
  const by = new Map(), floor = [];
  for (const x of xs) {
    if (!x.alive || !thisSession(x.b) || x.side === 'past') continue;
    if (x.st.phase === 'floor') { floor.push(x); continue; }
    const code = hearingAhead(x.b)?.committee || x.st.committee; if (!code) continue;
    const key = codesOf(code).sort().join('/'); (by.get(key) || by.set(key, { code, bills: [] }).get(key)).bills.push(x.b);
  }
  const stanceFor = (l, bills) => { const known = bills.map(b => [b, stanceOf(b.id, l.id).stance]).filter(([, s]) => s !== 'unknown');
    if (!known.length) return { word: 'Stance unknown', ic: STANCE_ICON.unknown, s: 'unknown' };
    const [b, s] = known[0]; return { word: `${STANCE_WORD[s]}${bills.length > 1 ? ` on ${numWords(b)}` : ''}`, ic: STANCE_ICON[s], s }; };
  const legRow = (m, bills) => { const l = m.l, st = stanceFor(l, bills);
    return `<div class="v6-row ip6-lrow" role="listitem"><a class="v6-row-main" href="${esc(legHref(l, bills[0]))}">${photo(l, 40)}<span class="ip6-lbody"><span class="v6-row-name">${esc(shortName(l))}</span>
      <span class="v6-row-line">${icon(st.ic)}<span>${esc(m.role === 'member' ? st.word : `${roleWord(m.role)} · ${st.word}`)}</span></span></span></a></div>`; };
  const groups = [...by.values()].map(g => {
    const ms_ = legsOf(g.code), lead = ms_.filter(m => m.role !== 'member'), rest = ms_.filter(m => m.role === 'member');
    const c = { yes: 0, leaning_yes: 0, leaning_no: 0, no: 0, unknown: 0 }; for (const m of rest) c[stanceFor(m.l, g.bills).s]++;
    const said = [['yes', 'yes'], ['leaning_yes', 'leaning yes'], ['leaning_no', 'leaning no'], ['no', 'no'], ['unknown', 'unknown']].filter(([k]) => c[k]).map(([k, w]) => `${c[k]} ${w}`).join(', ');
    const h = g.bills.map(hearingAhead).find(Boolean);
    return `<div class="ip6-lg"><h3 class="ip6-lgh">${esc(cw(g.code))}</h3>
      <p class="ip6-lgs">${esc(`Holds ${listAnd(g.bills.map(numWords))}${h ? ` · hearing ${whenAt(h.scheduled_at)}` : ''}`)}</p>
      ${lead.length ? listBox(lead.map(m => legRow(m, g.bills)).join('')) : ''}
      ${rest.length ? `<details class="ip6-fold" data-fold="mem-${esc(g.code)}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${plural(rest.length, 'member')}${said ? `: ${said}` : ''}</span></summary>${listBox(rest.map(m => legRow(m, g.bills)).join(''))}</details>` : ''}
    </div>`;
  }).join('');
  const fl = floor.length ? `<p class="ip6-pl">${icon('landmark')}<span>${esc(floor.map(x => `${numWords(x.b)} waits for a vote of the full ${CH[x.st.chamber] || 'chamber'}`).join('; '))}</span></p>` : '';
  const cares = !PROFILES() || i.archived_at ? '' : caresLegs(i.id).length ? caresSecHTML(i) : `<p class="ip6-pl">${icon('landmark')}<span>Legislators who care about this: none yet</span></p>`;
  if (!groups && !fl) return `<section class="ip6-sec" aria-labelledby="ip-lh"><h2 class="ip6-h" id="ip-lh">Where legislators stand</h2><p class="ip6-quiet">No committee holds one of its bills right now.</p>${cares}</section>`;
  return `<section class="ip6-sec ip6-legs" aria-labelledby="ip-lh"><h2 class="ip6-h" id="ip-lh">Where legislators stand</h2>${groups}${fl}${cares}</section>`;
}

// ---- the timeline: hearings and their results, testimony filed, talks logged, floor votes and the team's notes, across
// all its bills, newest first. The bills' activity and talks load once per visit (DB.timeline, DB.conversations). ----
const TL = () => S.ipTl ??= {};
function wantTl(i, bills) {
  const t = TL()[i.id]; if (t) return t;
  const box = TL()[i.id] = { state: 'loading', acts: {}, talks: [] };
  const ids = bills.map(b => b.id);
  Promise.all([
    ...bills.map(b => DB.timeline(b.id).then(r => { box.acts[b.id] = r || []; }).catch(() => { box.acts[b.id] = []; })),
    ...[null, ...ids].map(id => DB.conversations({ billId: id, issueIds: [i.id] }).then(r => { for (const x of r || []) if (!box.talks.some(y => y.id === x.id)) box.talks.push(x); }).catch(() => {})),
  ]).then(() => { box.state = 'done'; paintLate(i); });
  return box;
}
const votesOf = o => { const t = String(o?.report || ''), ay = /(\d+)\s+Ayes?\b/i.exec(t), no = /(\d+)\s+No(?:es|e)?s?\b/i.exec(t); return ay ? `${ay[1]} yes${no ? `, ${no[1]} no` : ''}` : ''; };
const OUT = { passed: 'passed', passed_amended: 'passed with changes', deferred: 'deferred', recommitted: 'recommitted' };
function events(i, bills) {
  const ids = new Set(bills.map(b => b.id)), out = [], now = Date.now(), box = TL()[i.id];
  const push = (at, b, text, href, ic) => { if (at != null && !Number.isNaN(at)) out.push({ at, b, text, href: href || (b ? billRoute(b) : ''), ic }); };
  for (const o of Object.values(S.outcomes || {})) { if (!ids.has(o.bill_id)) continue; const b = billById(o.bill_id), v = votesOf(o);
    push(ms(o.reported_at || o.scheduled_at), b, `${cw(o.committee)} ${OUT[o.outcome] || OUTCOME_LABEL[o.outcome] || 'decided on'} ${numWords(b)}${v ? `, ${v}` : ''}`, '', o.outcome === 'deferred' ? 'circle-minus' : 'gavel'); }
  for (const h of S.hearings || []) { if (!ids.has(h.bill_id) || h.status === 'cancelled' || ms(h.scheduled_at) > now || S.outcomes?.[h.id]) continue;
    const b = billById(h.bill_id); push(ms(h.scheduled_at), b, `${cw(h.committee)} heard ${numWords(b)}, no result yet`, '', 'gavel'); }
  for (const d of Object.values(S.drafts || {}).flat()) { if (!ids.has(d.bill_id) || d.status !== 'filed') continue; const b = billById(d.bill_id);
    push(ms(d.filed_at || d.updated_at), b, `Filed testimony on ${numWords(b)} for ${cw(d.committee)}${d.filed_by ? ` · ${cap(firstWords(d.filed_by, S.me))}` : ''}`, '', 'file-text'); }
  for (const [bid, rows] of Object.entries(box?.acts || {})) { const b = billById(bid); if (!b) continue;
    for (const a of rows) { const t = String(a.title || ''), at = ms(a.occurred_at);
      if (a.source === 'auto' || a.type === 'status_auto') {
        const ch = /senate/i.test(a.details || '') ? 'Senate' : /house/i.test(a.details || '') ? 'House' : '';
        if (/^Passed Third Reading/i.test(t)) push(at, b, `${numWords(b)} passed the full ${ch || 'chamber'}`, '', 'landmark');
        else if (/^Act \d+|became law|signed into law/i.test(t)) push(at, b, `${numWords(b)} became law`, '', 'circle-check');
        else if (/veto/i.test(t)) push(at, b, `${numWords(b)} was vetoed`, '', 'circle-minus');
        else if (/^Carried over to (\d{4})/i.test(t)) push(at, b, `${numWords(b)} carried over to ${/(\d{4})/.exec(t)[1]}`, '', 'history');
      } else if (a.type !== 'testimony') push(at, b, `${t}${a.advocate_id ? ` · ${cap(firstWords(a.advocate_id, S.me))}` : ''}`, '', 'message-square');
    } }
  const seenConv = new Set();
  for (const n of box?.talks || []) { if (n.kind === 'note') continue; const key = n.conversation_id || n.id; if (seenConv.has(key)) continue; seenConv.add(key);
    const l = legById(n.legislator_id), b = n.bill_id ? billById(n.bill_id) : null, who = n.advocate_id ? cap(firstWords(n.advocate_id, S.me)) : 'Someone';
    const leg = l ? shortName(l) : 'a legislator', about = b ? ` about ${numWords(b)}` : '';
    const text = n.answer === 'asked' ? `${who} asked ${leg} for a hearing${b ? ` on ${numWords(b)}` : ''}` : n.answer ? `${leg} answered a hearing ask${about}` : `${who} talked with ${leg}${about}`;
    push(ms(n.met_on || n.created_at), b, text, l ? legHref(l, b) : '', 'message-square'); if (l && out.length) out[out.length - 1].lt = leg; }
  return out.sort((x, y) => y.at - x.at);
}
const TL_SHOWN = 5;
function tlBody(i, bills) {
  const box = TL()[i.id];
  if (!box || box.state === 'loading') return `<p class="ip6-quiet" aria-busy="true">Loading its timeline…</p>`;
  const ev = events(i, bills); if (!ev.length) return `<p class="ip6-quiet">Nothing has happened on its bills yet.</p>`;
  // Only the bill's number is a link (a whole sentence in link colour on every line read as a list of buttons).
  const linked = e => { const n = e.lt || (e.b ? numWords(e.b) : ''), k = n ? e.text.indexOf(n) : -1;
    return k < 0 || !e.href ? esc(e.text) : `${esc(e.text.slice(0, k))}<a href="${esc(e.href)}">${esc(n)}</a>${esc(e.text.slice(k + n.length))}`; };
  const li = e => `<li class="ip6-ev"><span class="ip6-evd">${esc(dayAny(e.at))}</span><span class="ip6-evt">${linked(e)}</span></li>`;
  const first = ev.slice(0, TL_SHOWN), rest = ev.slice(TL_SHOWN);
  return `<ol class="ip6-tl" role="list">${first.map(li).join('')}</ol>${rest.length ? `<details class="ip6-fold" data-fold="tl"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Earlier: ${plural(rest.length, 'more event')}</span></summary><ol class="ip6-tl" role="list">${rest.map(li).join('')}</ol></details>` : ''}`;
}
function tlHTML(i, bills) {
  return `<section class="ip6-sec" aria-labelledby="ip-th"><div class="i6-hrow"><h2 class="ip6-h" id="ip-th">Timeline</h2>${btn('Log a talk', { kind: 'text', sm: true, icon: 'message-square', attrs: { 'data-ip': 'cvlog', 'aria-haspopup': 'dialog', 'aria-label': 'Log a talk with a legislator about this issue' } })}</div>
    <div data-ip-late="tl">${tlBody(i, bills)}</div></section>`;
}

// ---- last year's result: what happened to its bills in the session before this one ----
function lastYearBody(i, bills, earlier) {
  const prev = +SESSION_YEAR - 1, box = TL()[i.id], rows = [];
  for (const b of earlier) rows.push([b, effStage(b) === 'enacted' ? 'became law' : diedish(b) ? stoppedWords(b).replace(/^Stopped/, 'stopped') : 'still moving']);
  for (const b of bills) {
    const outs = Object.values(S.outcomes || {}).filter(o => o.bill_id === b.id && yearOf(o.scheduled_at) === prev).sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)));
    const acts = (box?.acts?.[b.id] || []).filter(a => yearOf(a.occurred_at) === prev);
    const passed = outs.filter(o => /^passed/.test(o.outcome)).map(o => cw(o.committee)), def = outs.find(o => o.outcome === 'deferred');
    const floor = acts.find(a => /^Passed Third Reading/i.test(a.title || '')), carried = acts.some(a => /^Carried over/i.test(a.title || ''));
    const intro = acts.some(a => /introduc|prefiled|first reading/i.test(a.title || ''));
    if (!outs.length && !floor && !intro) continue;
    const parts = [passed.length ? `passed ${listAnd(passed)}` : outs.length ? '' : 'was not heard', floor ? `passed the full ${/senate/i.test(floor.details || '') ? 'Senate' : 'House'}` : '', def ? `deferred by ${cw(def.committee)}` : '', carried ? `carried over to ${SESSION_YEAR}` : ''].filter(Boolean);
    rows.push([b, parts.join(', then ')]);
  }
  if (!rows.length) return box?.state === 'loading' ? '<p class="ip6-quiet" aria-busy="true">Loading…</p>' : `<p class="ip6-quiet">Nothing on record for its bills in ${prev}.</p>`;
  return `<ul class="ip6-ly" role="list">${rows.map(([b, t]) => `<li><a href="${esc(billRoute(b))}">${esc(numWords(b))}</a> <span>${esc(t)}</span></li>`).join('')}</ul>`;
}
function lastYearHTML(i, bills, earlier) {
  const prev = +SESSION_YEAR - 1;
  return `<details class="ip6-sec ip6-fold ip6-lyf" data-fold="lastyear"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<h2 class="ip6-h ip6-hin" id="ip-yh">Last year’s result (${prev})</h2></summary>
    <div data-ip-late="ly">${lastYearBody(i, bills, earlier)}</div></details>`;
}
// The parts that wait for the activity paint in place when it arrives, so nothing moves under the reader (no full redraw).
function paintLate(i) {
  if (S.route?.name !== 'issue' || String(S.route.id) !== String(i.id)) return;
  const { now, earlier } = billsSplit(i);
  const tl = document.querySelector('[data-ip-late="tl"]'); if (tl) tl.innerHTML = tlBody(i, now.concat(earlier));
  const ly = document.querySelector('[data-ip-late="ly"]'); if (ly) ly.innerHTML = lastYearBody(i, now, earlier);
}

// ---- public interest, and where partners stand ----
function publicHTML(i, now) {
  if (isDraft(i)) return '';
  const f = followers(i);
  const fol = !f ? 'Counting followers…' : `${f.own ? plural(f.own, 'person follows', 'people follow') + ' it' : 'Nobody follows it on its own yet'}${f.via ? `; ${plural(f.via, 'more person gets', 'more people get')} it with a whole category` : ''}`;
  const sum = { followers: 0, testimonies: 0, emails: 0, attending: 0 };
  for (const b of now) { const c = S.pubCounts?.[b.id]; if (!c) continue; sum.followers += c.followers || 0; if ((c.people || 0) >= 10) { sum.testimonies += c.testimonies || 0; sum.emails += c.emails || 0; sum.attending += c.attending || 0; } }
  const acts = [sum.followers ? `${sum.followers} follow its bills` : '', sum.testimonies ? `${sum.testimonies} testified` : '', sum.emails ? `${sum.emails} emailed a legislator` : '', sum.attending ? `${sum.attending} plan to attend` : ''].filter(Boolean);
  const fv = i.archived_at ? '' : mayPublic(i) ? switchRow('is-fv', 'Show in the first visit', inFirstVisit(i), inFirstVisit(i) ? 'Newcomers can follow it on their first visit.' : 'Left out of a newcomer’s first visit. People can still find and follow it.')
    : `<p class="ip6-pl">${icon(inFirstVisit(i) ? 'eye' : 'eye-off')}<span>${inFirstVisit(i) ? 'In the first visit' : 'Left out of the first visit'}</span></p>`;
  // Partners: the partner groups writing on its bills (partner_queue, read for partner approvers); positions from earlier
  // testimony and staff notes have no table yet (the report proposes one), so nothing more is claimed.
  const ids = new Set(now.map(b => b.id)), side = { support: 'support', oppose: 'oppose', amend: 'ask to amend', comments: 'comment on' };
  const pw = (S.pq?.bills || []).filter(x => ids.has(x.bill_id)).map(x => `${x.partner_name} ${side[(x.words || x.live)?.side] || 'write about'} ${numWords(billById(x.bill_id))}${x.live ? '' : ' (words waiting for approval)'}`);
  const partners = pw.length ? `<ul class="ip6-ly" role="list">${[...new Set(pw)].map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="ip6-pl">${icon('handshake')}<span>Partners’ positions: none on record yet</span></p>`;
  return `<section class="ip6-sec ip6-card" aria-labelledby="ip-ph"><h2 class="ip6-h" id="ip-ph">Public interest</h2>
    <p class="ip6-pl">${icon('users')}<span>${esc(fol)}</span></p>
    ${acts.length ? `<p class="ip6-pl">${icon('megaphone')}<span>${esc(cap(acts.join(' · ')))}</span></p>` : ''}
    ${fv}
    <h3 class="ip6-h3">Where partners stand</h3>${partners}
  </section>`;
}

// ---- the goal, talking points and materials ----
const POINTS_SHOWN = 3, DOCS_SHOWN = 4;
function pointsHTML(i, now, earlier) {
  const own = (i.talking_points || []).filter(Boolean);
  const fromBills = now.concat(earlier).filter(b => (b.talking_points || []).length);
  const shown = own.length ? own.slice(0, POINTS_SHOWN) : (fromBills[0]?.talking_points || []).slice(0, POINTS_SHOWN);
  const src = own.length ? '' : fromBills[0] ? `<p class="ip6-src">From ${esc(numWords(fromBills[0]))}</p>` : '';
  const more = [...(own.length ? own.slice(POINTS_SHOWN).map(t => [null, t]) : (fromBills[0]?.talking_points || []).slice(POINTS_SHOWN).map(t => [fromBills[0], t])),
    ...fromBills.slice(own.length ? 0 : 1).flatMap(b => b.talking_points.map(t => [b, t]))];
  const goal = (i.goal || '').trim() ? `<p class="ip6-pl">${icon('flag')}<span><span class="ip6-dl">Our ${esc(SESSION_YEAR)} goal, staff only:</span> ${esc(i.goal)}</span></p>` : '';
  // Materials: the newest testimony Doc on each bill (this session's and earlier, to borrow from), the Drive folders, and
  // the library of every filed testimony.
  const ids = new Set(now.concat(earlier).map(b => b.id)), docs = [];
  const drafts = Object.values(S.drafts || {}).flat().filter(d => ids.has(d.bill_id) && (d.doc_url || d.filed_url) && d.status !== 'cancelled').sort((x, y) => String(y.filed_at || y.updated_at || '').localeCompare(String(x.filed_at || x.updated_at || '')));
  for (const d of drafts) { const b = billById(d.bill_id), at = d.filed_at || d.updated_at || d.created_at;
    docs.push(`<li><a href="${esc(d.doc_url || d.filed_url)}" target="_blank" rel="noopener">${esc(`${numWords(b)} testimony for ${cw(d.committee)}`)}${icon('external-link')}</a> <span class="ip6-evd">${esc(at ? (d.status === 'filed' ? 'filed ' : '') + dayAny(at) : '')}</span></li>`); }
  const folders = [...new Set(drafts.map(d => d.folder_id).filter(Boolean))].map(f => `<li><a href="https://drive.google.com/drive/folders/${encodeURIComponent(f)}" target="_blank" rel="noopener">Drive folder${icon('external-link')}</a></li>`);
  const docList = [...folders, ...docs];
  return `<section class="ip6-sec" aria-labelledby="ip-mh"><h2 class="ip6-h" id="ip-mh">Talking points and materials</h2>
    ${goal}
    ${shown.length ? `${src}<ul class="ip6-pts" role="list">${shown.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="ip6-quiet">No talking points yet.</p>`}
    ${more.length ? `<details class="ip6-fold" data-fold="pts"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${plural(more.length, 'more point')} from its bills</span></summary><ul class="ip6-pts" role="list">${more.map(([b, t]) => `<li>${esc(t)}${b ? ` <span class="ip6-evd">${esc(numWords(b))}</span>` : ''}</li>`).join('')}</ul></details>` : ''}
    ${docList.length ? `<h3 class="ip6-h3">Testimony to borrow from</h3><ul class="ip6-docs" role="list">${docList.slice(0, DOCS_SHOWN).join('')}</ul>
      ${docList.length > DOCS_SHOWN ? `<details class="ip6-fold" data-fold="docs"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${plural(docList.length - DOCS_SHOWN, 'more Doc')}</span></summary><ul class="ip6-docs" role="list">${docList.slice(DOCS_SHOWN).join('')}</ul></details>` : ''}` : ''}
    <p class="ip6-pl">${icon('book-open')}<span><a href="#/testimony?view=library">Earlier testimony library</a></span></p>
  </section>`;
}

// ---- the header: name, description, stance, topic; Edit and "…" ----
const stanceOfI = i => STANCES.find(x => x[0] === i?.stance) || null;
const stanceWords = i => { const s = stanceOfI(i); return `<span class="is6-stw">${icon(s ? s[2] : 'circle-dashed')}<span>${esc(s ? s[1] : 'No stance yet')}</span></span>`; };
const FOR = new Set(['strongly_support', 'support', 'support_amend']);
function stanceNote(i, now) {
  const odd = againstStance(i, now); if (!odd.length || i.archived_at) return '';
  const word = i.stance === 'support' ? 'supports' : 'opposes', say = b => FOR.has(b.position) ? 'supports' : 'opposes';
  const list = odd.slice(0, 3).map(b => `<a href="${billRoute(b)}">${esc(billWords(b))}</a> (HIPHI ${say(b)} it)`).join(', ') + (odd.length > 3 ? ` and ${odd.length - 3} more` : '');
  return `<p class="i6-line is6-stnote" role="note">${icon('info')}<span>${odd.length === 1 ? 'One bill on this issue goes' : `${odd.length} bills on this issue go`} against its stance, which says HIPHI ${word} it: ${list}. Each bill keeps its own position. If this is no longer the whole story, set the stance to Mixed.</span></p>`;
}

// ---- putting a bill on the issue, and taking one off (Edit bills) ----
function hits(i, q) {
  const t = plain(q.trim()), tn = t.replace(/\s+/g, ''); if (t.length < 2) return [];
  const on = new Set(billsOn(i).map(b => b.id)), pool = S.bills.filter(b => b.tracked !== false && !on.has(b.id));
  const num = pool.filter(b => b.bill_number.toLowerCase().includes(tn)), words = pool.filter(b => !num.includes(b) && [b.nickname, b.title, b.public_summary, b.description].some(x => plain(x).includes(t)));
  const rank = b => (b.position && b.position !== 'monitor' ? 0 : 2) + (thisSession(b) ? 0 : 1);
  return [...num, ...words].sort((a, b) => rank(a) - rank(b)).slice(0, 8);
}
function hitsHTML(i, q) {
  if (q.trim().length < 2) return '';
  const rows = hits(i, q);
  if (!rows.length) return `<p class="le-none">No tracked bill matches “${esc(q.trim())}”.</p>`;
  return `<div class="rows le-hits" role="listbox" id="is-hitlist" aria-label="Tracked bills that match">${rows.map((b, k) => `<div class="row le-hit" role="option" id="is-hit-${k}" aria-selected="false" data-add="${esc(b.id)}"><span class="le-plus">${icon('plus')}</span><span class="body">${billName(b, 90)}</span></div>`).join('')}</div>`;
}
function editHTML(i, now, earlier) {
  const q = P().q[i.id] || '';
  const row = b => billLineRow(b, { line: !thisSession(b) ? `${b.session_year} session` : diedish(b) ? 'Stopped' : (whyNot(b) || undefined), button: iconBtn('x', `Take ${billWords(b)} off ${i.name}`, { 'data-isrm': b.id }) });
  return `<div class="ip6-edit">
    ${now.length + earlier.length ? listBox([...now, ...earlier].map(row).join('')) : ''}
    <div class="le-add is-add">
      <label class="sr" for="is-bq">Put a bill on this issue: number or words</label>
      <div class="le-search">${icon('search')}<input id="is-bq" type="search" role="combobox" aria-expanded="false" aria-autocomplete="list" placeholder="Put a bill on it: number or words" value="${esc(q)}" autocomplete="off" enterkeyhint="search" aria-controls="is-hits">${iconBtn('x', 'Clear the search', { 'data-is': 'bqclear', hidden: !q })}</div>
      <div id="is-hits">${hitsHTML(i, q)}</div>
      <p class="sr" id="is-hitn" role="status"></p>
    </div></div>`;
}

// ---- related issues ----
function relatedHTML(i) {
  const { on, off } = relatedOf(i), edit = !!P().rel[i.id];
  const about = (o, staff) => cap([o.category === i.category ? '' : catByKey(o.category)?.name || o.category, staff ? 'linked by staff' : ''].filter(Boolean).join(', '));
  const who = c => { const a = c.set_by && advocate(c.set_by); return `unlinked${a ? ` by ${a.full_name.split(' ')[0]}` : ''}${c.set_at ? ` ${fmtDate(c.set_at)}` : ''}`; };
  const row = (o, line, button = '') => itemRow({ key: o.id, name: o.name, line: line ? esc(line) : '', href: `#/issue/${encodeURIComponent(o.id)}`, button, cls: 'i6-row' });
  return `<section class="ip6-sec is6-rel" aria-labelledby="is-rh">
    <div class="i6-hrow"><h2 class="ip6-h" id="is-rh">Related issues</h2>${btn(edit ? 'Done' : 'Edit', { kind: 'text', sm: true, attrs: { 'data-is': 'reledit', 'aria-expanded': String(edit), 'aria-label': edit ? 'Done editing related issues' : 'Edit related issues' } })}</div>
    <p class="ip6-quiet">Followers of either one see the other’s bills first.</p>
    ${on.length ? listBox(on.map(({ o, staff }) => row(o, about(o, staff), edit ? iconBtn('x', `Unlink ${o.name} from ${i.name}`, { 'data-isunlink': o.id }) : '')).join('')) : '<p class="ip6-quiet">None yet.</p>'}
    ${edit ? `<p class="i6-acts">${btn('Link another issue', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-is': 'link', 'aria-haspopup': 'dialog' } })}</p>
    ${off.length ? `<details class="i6-fold" data-fold="unlinked"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Unlinked by staff (${off.length})</span></summary>
      ${listBox(off.map(({ o, c }) => row(o, cap([about(o), who(c)].filter(Boolean).join(', ')), btn('Link again', { kind: 'text', sm: true, attrs: { 'data-isrelink': o.id } }))).join(''))}</details>` : ''}` : ''}
  </section>`;
}
async function setLink(i, o, on) {
  const redraw = () => { const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.getElementById('is-rh')?.closest('section')?.querySelector('[data-is="link"], [data-is="reledit"]')?.focus({ preventScroll: true }); };
  try {
    await DB.setIssueLink(i.id, o.id, on); redraw();
    toast(on ? `Linked ${o.name} and ${i.name}.` : `Unlinked ${o.name} and ${i.name}.`, { ok: on, undo: async () => { await DB.setIssueLink(i.id, o.id, !on); redraw(); } });
  } catch (e) { toast(e, { err: true }); }
}
function pickSheet({ title, intro, find, attr, list, onPick }) {
  let q = '';
  const draw = () => { const l = list(plain(q.trim()));
    return l.length ? `<div class="sv-pickl">${l.map(x => `<button type="button" ${attr}="${esc(x.id)}">${icon(catIcon(x.category))}<span class="body"><span class="title">${esc(x.name)}</span><span class="sub">${esc(catByKey(x.category)?.name || '')} · ${plural(billsOn(x).length, 'bill')}</span></span></button>`).join('')}</div>` : '<p class="le-none">No other issue matches.</p>'; };
  openSheet({ title, pop: true,
    body: `<p class="small muted is-for">${intro}</p><div class="le-search is-psearch">${icon('search')}<input id="is-pkq" type="search" placeholder="${esc(find)}" autocomplete="off" aria-label="${esc(find)}"></div><div id="is-pkl">${draw()}</div>`,
    wire: d => {
      const box = d.querySelector('#is-pkl');
      const wireList = () => box.querySelectorAll(`[${attr}]`).forEach(el => el.onclick = async () => { const o = issueById(el.getAttribute(attr)); if (!o) return; await closeSheet({ silent: true }); await afterClose(); onPick(o); });
      wireList();
      d.querySelector('#is-pkq').oninput = e => { q = e.target.value; box.innerHTML = draw(); wireList(); };
    } });
}
const sortNear = i => (a, b) => (a.category === i.category ? 0 : 1) - (b.category === i.category ? 0 : 1) || byName(a, b);
function linkSheet(i) {
  const have = new Set(relatedOf(i).on.map(x => x.o.id));
  pickSheet({ title: `Link to ${esc(i.name)}`, find: 'Find the issue to link', attr: 'data-linkto',
    intro: 'Pick an issue whose bills are about the same thing. When we ask people to act, anyone following either one is shown the other’s bills first.',
    list: t => live().filter(x => x.id !== i.id && !have.has(x.id) && (!t || plain(x.name).includes(t))).sort(sortNear(i)).slice(0, 30),
    onPick: o => setLink(i, o, true) });
}
function mergeSheet(i) {
  pickSheet({ title: `Merge ${esc(i.name)} into…`, find: 'Find the issue to keep', attr: 'data-into',
    intro: `Pick the issue to keep. ${esc(i.name)}’s bills and followers move to it, and ${esc(i.name)} is archived. Nobody loses a bill.`,
    list: t => live().filter(x => x.id !== i.id && (!t || plain(x.name).includes(t))).sort(sortNear(i)).slice(0, 30),
    onPick: async into => {
      const n = billsOn(i).length, f = followers(i);
      const ok = await confirmSheet({ title: `Merge into ${esc(into.name)}?`, ok: 'Merge', danger: true,
        text: `${esc(i.name)}’s ${plural(n, 'bill')}${f && f.own ? ` and ${plural(f.own, 'follower')}` : ''} move to ${esc(into.name)}, and ${esc(i.name)} is archived. A merge cannot be undone from here.` });
      if (!ok) return;
      try { await DB.mergeIssues(i.id, into.id); S.go('#/issue/' + encodeURIComponent(into.id), { replace: true }); toast(`Merged into ${into.name}.`, { ok: true }); }
      catch (e) { toast(e, { err: true }); }
    } });
}
// "Show in the first visit" (066, R-023): off leaves the issue out of a newcomer's first visit only.
async function setFirstVisit(i, on) {
  const redraw = () => { const y = scrollY; hooks.render(); document.getElementById('is-fv')?.focus({ preventScroll: true }); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };
  try {
    await DB.updateIssue(i.id, { first_visit: on }); redraw();
    toast(on ? `${i.name} is back in the first visit.` : `Left out of the first visit.${i.recommended ? ' Its pre-tick does nothing while it is left out.' : ''}`,
      { ok: on, undo: async () => { await DB.updateIssue(i.id, { first_visit: !on }); redraw(); } });
  } catch (e) { redraw(); toast(e, { err: true }); }
}
async function archive(i, on) {
  if (on) {
    const f = followers(i);
    const ok = await confirmSheet({ title: `Archive ${esc(i.name)}?`, ok: 'Archive', danger: true,
      text: `The public stops seeing it${f && f.own ? `, and the ${plural(f.own, 'person', 'people')} following it stop getting its bills` : ''}. You can restore it from All issues, under Archived. If it is really the same as another issue, merge it instead: its followers move over.` });
    if (!ok) return;
  }
  try {
    await DB.updateIssue(i.id, { archived_at: on ? new Date().toISOString() : null }); hooks.render();
    toast(on ? `Archived ${i.name}.` : `Restored ${i.name}.`, { undo: async () => { await DB.updateIssue(i.id, { archived_at: on ? null : new Date().toISOString() }); hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
async function takeOff(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, false); delete TL()[i.id]; hooks.render();
    toast(`Took ${billWords(b)} off ${i.name}.`, { undo: async () => { await DB.setBillIssue(b.id, i.id, true); delete TL()[i.id]; hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}
async function putOn(i, b) {
  try {
    await DB.setBillIssue(b.id, i.id, true); P().q[i.id] = ''; delete TL()[i.id]; hooks.render();
    document.getElementById('is-bq')?.focus();
    const why = whyNot(b);
    toast(`Put ${billWords(b)} on ${i.name}.${why ? ` ${why.split(',')[0]}, so followers get it once that changes.` : ''}`, { ok: !why, undo: async () => { await DB.setBillIssue(b.id, i.id, false); delete TL()[i.id]; hooks.render(); } });
  } catch (e) { toast(e, { err: true }); }
}

// ---- the page ----
const billsSplit = i => { const bills = billsOn(i).sort(byNum); return { now: bills.filter(thisSession), earlier: bills.filter(b => !thisSession(b)) }; };
const wideNow = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } };
function pageRender(route) {
  const i = issueById(route.id);
  if (!i) return `<div class="le-page i6-page">${empty({ h: 'h1', title: 'This issue is not here', text: 'It may have been merged into another, or the link is old.', action: btn('See all issues', { kind: 'secondary', href: '#/my-issues/all' }) })}</div>`;
  wantPeople();
  const c = catByKey(i.category), also = alsoIn(i).map(catByKey).filter(Boolean), { now, earlier } = billsSplit(i);
  const from = billFrom(route), bk = backTo(route), wide = wideNow();
  wantTl(i, now.concat(earlier));
  const xs = now.map(placeOfBill), steps = nextSteps(now), hc = health(xs, steps, earlier);
  const outlook = i.outlook ? `<p class="is6-desc"><span class="is6-dl">Between sessions, the public reads:</span> ${esc(i.outlook)}</p>` : '';
  const head = `<header class="is6-head ip6-head">
      <span class="is6-icon" aria-hidden="true">${icon(c?.icon || 'tag')}</span>
      <div class="is6-hbody"><h1 class="is6-h1">${esc(i.name)}</h1>
        ${i.description ? `<p class="is6-desc">${esc(i.description)}</p>` : ''}
        ${SESSION_OVER && !prepHoldsOutlook(i) ? outlook : ''}
        <p class="is6-meta"><span class="is6-stl">HIPHI’s stance</span>${mayStance(i) ? stanceChip(i, { 'data-is': 'stance' }) : stanceWords(i)}<span class="is6-cat">${esc([c?.name || i.category, also.length ? `also in ${also.map(x => x.name).join(' and ')}` : '', i.recommended ? 'pre-ticked for new visitors' : ''].filter(Boolean).join(' · '))}</span></p>
        ${stanceNote(i, now)}
      </div>
      <div class="is6-hacts">${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', cls: 'is6-edit', attrs: { 'data-is': 'edit', 'aria-haspopup': 'dialog', 'aria-label': `Edit ${i.name}` } })}${iconBtn('ellipsis', `More for ${i.name}: merge, public page, archive`, { 'data-is': 'more', 'aria-haspopup': 'dialog' })}</div>
    </header>
    ${i.archived_at ? `<p class="i6-line">${icon('archive')}<span><b>Archived.</b> The public does not see it, and its followers do not get its bills.</span>${btn('Restore', { kind: 'secondary', sm: true, attrs: { 'data-is': 'restore' } })}</p>` : ''}`;
  // The bills, House | Senate (a bill past both chambers sits over the two columns).
  const edit = !!P().edit[i.id] || !(now.length + earlier.length);
  const past = xs.filter(x => x.side === 'past');
  const cols = now.length ? `${past.length ? listBox(past.map(billCard).join('')) : ''}<div class="ip6-cols">${columnHTML('H', xs.filter(x => x.side === 'H'))}${columnHTML('S', xs.filter(x => x.side === 'S'))}</div>` : '';
  const editBtn = now.length + earlier.length ? btn(edit ? 'Done' : 'Edit bills', { kind: 'text', sm: true, icon: edit ? 'check' : 'pencil', attrs: { 'data-is': 'editbills', 'aria-expanded': String(edit) } }) : '';
  const billsSec = `<section class="ip6-sec ip6-bills" aria-labelledby="is-bh"><div class="i6-hrow"><h2 class="ip6-h" id="is-bh">Its bills</h2>${editBtn}</div>
    ${cols}${edit ? editHTML(i, now, earlier) : ''}</section>`;
  // R-316 W16: between sessions the 2027 prep is the work, so its card comes first; in session it waits at the end (and is
  // left out until someone starts it: prep.js, walk 3 item 7).
  const prep = prepCardHTML(i, { outlook: SESSION_OVER ? '' : outlook }), prepFirst = (SESSION_OVER && !isDraft(i) && !i.archived_at && stateOf(i) !== 'approved') || isDraft(i);
  const next = nextHTML(steps, now.length > 0), who = whoHTML(i, xs, steps), legs = legsHTML(i, xs), tl = tlHTML(i, now.concat(earlier));
  const pub = publicHTML(i, now), pts = pointsHTML(i, now, earlier), ly = lastYearHTML(i, now, earlier), rel = i.archived_at ? '' : relatedHTML(i);
  const back = `<a class="co6-back" href="${from ? billRoute(from) : bk.href}" data-back${from ? ` aria-label="Back to ${esc(from.bill_number)}"` : ''}>${icon('chevron-left')}<span>${from ? `Back to ${esc(from.bill_number)}` : esc(bk.label)}</span></a>`;
  const lead = `${prepFirst ? prep : ''}${hc.html}${billsSec}`;
  // A laptop: the issue, its bills and the people around them on the left; What to do next opens the side column, so the
  // first screen holds the health check, both chambers and the first steps. A phone reads one column, in Nate's order.
  if (wide) return `<div class="le-page is6-page ip6-page">${back}<div class="is6-cols ip6-wide">
      <div class="is6-main">${head}${lead}${legs}${tl}${ly}${prepFirst ? '' : prep}</div>
      <aside class="is6-side ip6-side" aria-label="What to do next, who is working on it, public interest, talking points and related issues">${next}${who}${pub}${pts}${rel}</aside></div></div>`;
  return `<div class="le-page is6-page ip6-page">${back}${head}${lead}${next}${who}${legs}${tl}${pub}${pts}${ly}${rel}${prepFirst ? '' : prep}</div>`;
}

export const issuePage = {
  tab: 'myissues',   // issues are under My issues
  // "Back to SB2175" fits on a phone too (R-226), so it keeps its words there: full. From My issues (R-263), Back returns there.
  title: route => issueById(route.id)?.name || 'Issue',
  back: route => { const from = billFrom(route); return from ? { href: billRoute(from), label: `Back to ${from.bill_number}`, full: true } : backTo(route); },
  wide: wideNow,
  render: pageRender,
  wire(route, root) {
    const i = issueById(route.id); if (!i) return;
    rememberRow(i.id);
    wirePrepCard(i, root);
    const st = P();
    root.querySelector('[data-ip="cvlog"]')?.addEventListener('click', () => logConversation({ issueId: i.id, onDone: () => { refreshConversations(); delete TL()[i.id]; hooks.render(); } }));
    // The "…" holds the rare actions (F155); Edit is also a visible text button beside it.
    root.querySelector('[data-is="edit"]')?.addEventListener('click', () => openIssueForm(i));
    root.querySelector('[data-is="more"]')?.addEventListener('click', () => menuSheet({ title: esc(i.name), items: [
      { label: 'Edit the issue', icon: 'pencil', sub: 'Name, description, stance, between sessions, category, pre-tick', run: async () => { await afterClose(); openIssueForm(i); } },
      { label: 'Merge into another issue', icon: 'arrow-right', disabled: !!i.archived_at, reason: 'Restore it first.', sub: 'When two issues are really one', run: async () => { await afterClose(); mergeSheet(i); } },
      { label: 'Open the public page', icon: 'external-link', disabled: !!i.archived_at || isDraft(i), reason: isDraft(i) ? 'An issue that is not public yet has no public page.' : 'An archived issue has no public page.', run: () => { window.open(`${PUBLIC_APP()}#/issue/${i.slug}`, '_blank', 'noopener'); } },
      i.archived_at ? { label: 'Restore', icon: 'rotate-ccw', run: () => archive(i, false) } : { label: 'Archive', icon: 'archive', danger: true, run: async () => { await afterClose(); archive(i, true); } },
    ] }));
    root.querySelector('[data-is="restore"]')?.addEventListener('click', () => archive(i, false));
    // Edit bills and Related's Edit: each opens its own tools in place, and focus goes where the next step is.
    const toggle = (k, focus) => { st[k][i.id] = !st[k][i.id]; const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.querySelector(focus(st[k][i.id]))?.focus({ preventScroll: true }); };
    root.querySelector('[data-is="editbills"]')?.addEventListener('click', () => toggle('edit', on => on ? '#is-bq' : '[data-is="editbills"]'));
    root.querySelector('[data-is="reledit"]')?.addEventListener('click', () => toggle('rel', on => on ? '[data-is="link"]' : '[data-is="reledit"]'));
    root.querySelector('[data-is="link"]')?.addEventListener('click', () => linkSheet(i));
    root.querySelectorAll('[data-isunlink]').forEach(el => el.onclick = () => { const o = issueById(el.dataset.isunlink); if (o) setLink(i, o, false); });
    root.querySelectorAll('[data-isrelink]').forEach(el => el.onclick = () => { const o = issueById(el.dataset.isrelink); if (o) setLink(i, o, true); });
    root.querySelectorAll('[data-is="stance"]').forEach(el => el.addEventListener('click', () => pickStance(i, { after: () => { hooks.render(); document.querySelector('[data-is="stance"]')?.focus(); } })));
    const fv = root.querySelector('#is-fv'); if (fv) fv.onchange = () => setFirstVisit(i, fv.checked);
    root.querySelectorAll('[data-isrm]').forEach(el => el.onclick = () => { const b = billById(el.dataset.isrm); if (b) takeOff(i, b); });
    // Folds remember being open for the visit (a redraw after a step keeps them as they were).
    const open = S.ipOpen ??= new Set();
    root.querySelectorAll('details[data-fold]').forEach(d => { const k = `${i.id}|${d.dataset.fold}`; if (open.has(k)) d.open = true; d.addEventListener('toggle', () => { d.open ? open.add(k) : open.delete(k); }); });
    // The add search: a combobox like a list's (arrow keys move the highlight, Enter adds, Esc clears).
    const q = root.querySelector('#is-bq'), clear = root.querySelector('[data-is="bqclear"]'), box = root.querySelector('#is-hits'), said = root.querySelector('#is-hitn');
    if (!q) return;
    let hi = -1;
    const opts = () => [...box.querySelectorAll('[data-add]')];
    const mark = k => { opts().forEach((o, n) => { o.classList.toggle('hi', n === k); o.setAttribute('aria-selected', String(n === k)); }); hi = k; if (k >= 0) q.setAttribute('aria-activedescendant', `is-hit-${k}`); else q.removeAttribute('aria-activedescendant'); };
    const paint = () => { box.innerHTML = hitsHTML(i, q.value); const n = opts().length; q.setAttribute('aria-expanded', String(n > 0)); hi = -1; q.removeAttribute('aria-activedescendant');
      said.textContent = q.value.trim().length < 2 ? '' : n ? plural(n, 'bill') + ' found' : 'No bill found'; box.querySelectorAll('[data-add]').forEach(el => el.onclick = () => { const b = billById(el.dataset.add); if (b) putOn(i, b); }); };
    q.oninput = () => { st.q[i.id] = q.value; clear.hidden = !q.value; paint(); };
    q.onkeydown = e => {
      const n = opts().length;
      if (e.key === 'ArrowDown' && n) { e.preventDefault(); mark((hi + 1) % n); }
      else if (e.key === 'ArrowUp' && n) { e.preventDefault(); mark(hi <= 0 ? n - 1 : hi - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); const el = opts()[hi >= 0 ? hi : 0]; if (el) el.click(); }
      else if (e.key === 'Escape' && q.value) { e.preventDefault(); q.value = ''; st.q[i.id] = ''; clear.hidden = true; paint(); }
    };
    clear.onclick = () => { q.value = ''; st.q[i.id] = ''; clear.hidden = true; paint(); q.focus(); };
    paint();
  },
};

// v5's lines for a bill on an issue, kept for any caller (issues.js re-exports them).
const leftWord = dl => dl.days <= 0 ? 'last day today' : `${dl.days} day${dl.days === 1 ? '' : 's'} left`;
export function standLine(b, { owner = 'all' } = {}) {
  if (diedish(b)) return 'Did not advance';
  const st = stopOf(b), h = hearingAhead(b), parts = [STAGE_LABEL[effStage(b)] || ''];
  if (h) {
    parts.push(`Hearing ${whenAt(h.scheduled_at)}${h.committee ? ` · ${h.committee}` : ''}`);
    if (isPos(b)) { const t = testimonyOf(h, b); parts.push(t.filed ? 'Testimony filed' : t.word === 'not started' ? `Testimony due ${dueWhen(dueOf(h))}` : 'Testimony drafted'); }
  } else if (st.deadline?.missed) parts.push(`Missed the ${st.deadline.label} deadline`);
  else if (st.phase === 'committee' && st.deadline) parts.push(`${riskOf(b) ? 'At risk: needs' : 'Needs'} a hearing${st.committee ? ` in ${st.committee}` : ''} by ${dayWords(st.deadline.date)}, ${leftWord(st.deadline)}`);
  else if (st.deadline) parts.push(`${st.deadline.label} ${dayWords(st.deadline.date)}, ${leftWord(st.deadline)}`);
  else if (st.committee) parts.push(`In ${st.committee}`);
  const who = ownerOf(b);
  if (owner === 'others') { if (who && who.id !== S.me?.id) parts.push(`Owner: ${ownerFirst(who)}`); }
  else parts.push(who ? `Owner: ${who.id === S.me?.id ? 'You' : ownerFirst(who)}` : 'No owner');
  return parts.filter(Boolean).join(' · ');
}
export const testimonyWords = (h, b) => { const t = testimonyOf(h, b); return t.filed ? 'testimony filed' : t.word === 'not started' ? `testimony due ${dueWhen(dueOf(h))}` : `testimony ${t.word}`; };
export function nextPhrase(b) {
  let say;
  if (diedish(b)) say = 'Did not advance';
  else { const st = stopOf(b), h = hearingAhead(b);
    say = h ? `Hearing ${whenAt(h.scheduled_at)}` : st.deadline?.missed ? `Missed the ${st.deadline.label} deadline` : st.phase === 'committee' && st.deadline ? `Needs a hearing by ${dayWords(st.deadline.date)}` : st.deadline ? `${st.deadline.label} ${dayWords(st.deadline.date)}` : STAGE_LABEL[effStage(b)] || ''; }
  const who = ownerOf(b);
  return who && who.id !== S.me?.id ? `${say} · Owner: ${ownerFirst(who)}` : say;
}
