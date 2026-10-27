// One issue (#/issue/<id>, F154), rebuilt for Staff v6 (R-336 walk 3; Nate, 25 Oct: "might be the most important page in
// the entire website ... going to this page should show everything that a staff member needs to know about what's going
// on with their bills"). A person comes here to see, at a glance, where each of the issue's bills stands, what to do next,
// who is working on it and where legislators stand (B-1). Nate's rule for reading it: the goal is to get one bill through,
// and having at least one bill alive in each chamber is ideal; so the page leads with one plain sentence that says exactly
// that (the health check: "On track: alive in both chambers. Next: HB 1779 needs a hearing by Mon 3/30."), in neutral, no
// colour alarm (A-5 on v6: status by exception), then the bills in two columns, House | Senate, each with a slim stage bar
// (tracker.js trackerModel, the bill page's bar without its labels, so no committee codes in rows: C-15 on v6), the alive
// ones first and the stopped ones quiet with when and why.
//
// Walk 4 (Nate, 25 Oct: "filling the issue page with content both in the middle and on the right can be too crowded. Also
// the where legislators stand section should not be as prominent"): one reading column at every width, read top to
// bottom. The top four are open: the health check, What to do next (the steps.js rows Today and the bill use, each with its
// one button where the app already offers one: D16), its bills, and who is working on it (with the coalition line).
// Everything after is folded, each with a one-line summary on its closed line, in Nate's order: talking points and
// materials; public interest and where partners stand (issue_partner_positions, migration 189, added and changed here);
// where legislators stand, quiet, last before the timeline; the timeline (newest first, folded again after five); last
// year's result; related issues, quietest. The 2027 prep card (prep.js) ends the page in session (left out until someone
// starts it, item 7 of walk 3) and leads it between sessions.
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
import { plural, afterClose, billName, iconName } from './lists.js';
import { logConversation, refreshConversations } from './conversation.js';
import { prepCardHTML, wirePrepCard, isDraft, stateOf, prepListHref, BOARD_HREF, prepHoldsOutlook, helpersOf as issueHelpersOf } from './prep.js';
import { testimonyOf, dueOf } from './hearing.js';
import { isPos, dueWhen } from './standing.js';
import { billWords, billLineRow } from './coalition.js';
import { listBox, rememberRow, issueLead } from './issuestand.js';
import { issueIcon } from './issuegrid.js';   // R-339: the issue's own icon, else its topic's
import { PROFILES, caresSecHTML, caresLegs } from './profile.js';
import { itemRow, billStep, nw, dayWords, numWords, nameWords, committeeName, firstWords, rowButtonOK, rowButton, shownStatus } from './steps.js';
import { surname } from './pathway.js';
import { trackerModel } from './tracker.js';
import { STANCE_WORD, STANCE_ICON, photo, shortName, legHref, roleWord } from './pathway.js';
import { tintOf } from './issuegrid.js';   // the topic's tint for the bill page's issue frame (R-340)
import { issueLinkHref, catByKey, issueById, alsoIn, billsOn, billFrom, whyNot, inFirstVisit, relatedOf, STANCES, againstStance, stanceChip, pickStance, openIssueForm } from './issues.js';

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
// A joint referral's name, short, for cards and one-line summaries: "Senate Health + Commerce" (the fresh-eyes review: the
// full "Senate Health and Human Services and Senate Commerce" pushed a card's hearing time off its line). One committee
// keeps its whole name; the bill page and About this bill keep the full names.
const SHORT = { HHS: 'Health', AEN: 'Agriculture', EEP: 'Energy', TCA: 'Transportation' };
const cwShort = code => { const cs = codesOf(code); if (cs.length < 2) return cw(code);
  const ch = (cw(cs[0]).match(/^(House|Senate) /) || [])[1] || '';
  return `${ch ? ch + ' ' : ''}${cs.map(c => SHORT[c] || committeeName(c, { chamber: false }) || c).join(' + ')}`; };

// Where an issue's Back goes (R-316 W16): to the prep list or the Prep board it was opened from, to My issues, else All issues.
const backTo = route => route.q?.from === 'prep' ? { href: prepListHref(), label: 'Your issues for 2027' } : route.q?.from === 'board' ? { href: BOARD_HREF, label: 'Prep board' }
  : route.q?.from === 'mine' ? { href: '#/my-issues', label: 'My issues' } : { href: '#/my-issues/all', label: 'All issues' };

// ---- where each bill stands: by the chamber it STARTED in (coordinator, 25 Oct, from Nate's goal) ----
// Nate: "having at least one per chamber is ideal". That is two vehicles, a House bill and a Senate bill still alive, so a
// bill counts in its own chamber (HB, HCR, HR: House; SB, SCR, SR: Senate) wherever it is now; its line says where it is
// now ("Now in Senate Health and Human Services · hearing Fri 3/20, 9:30 AM"). My issues uses the same rule.
const PAST = new Set(['conference', 'governor', 'ballot', 'law']);
const originOf = b => b.chamber === 'S' || b.chamber === 'H' ? b.chamber : String(b.bill_number || '').startsWith('S') ? 'S' : 'H';
function placeOfBill(b) {
  const st = stopOf(b), stage = effStage(b), side = originOf(b);
  if (stage === 'enacted' || st.phase === 'law') return { b, st, side, alive: true, law: true };
  if (!diedish(b)) return { b, st, side, alive: true };
  return { b, st, side, alive: false, vetoed: stage === 'vetoed' };
}
// Where an alive bill is now, in words: "Now in Senate Health and Human Services · hearing Fri 3/20, 9:30 AM", "Now waiting
// for a vote of the full Senate", "Now in conference · House and Senate must agree by Fri 5/1".
function nowWords(b, st) {
  const h = hearingAhead(b), dl = st.deadline && !st.deadline.missed ? st.deadline : null, ch = CH[st.chamber] || '';
  if (st.phase === 'conference') return `Now in conference${dl ? ` · House and Senate must agree by ${dayWords(dl.date)}` : ''}`;
  if (st.phase === 'governor') return 'Now on the Governor’s desk';
  if (st.phase === 'ballot') return 'Passed the Legislature · the voters decide';
  if (st.phase === 'floor') return `Now waiting for a vote of the full ${ch}`;
  const code = h?.committee || st.committee;
  const where = code ? `Now in ${cwShort(code)}` : `Now waiting for a ${ch} committee`;
  if (h) return `${where} · hearing ${whenAt(h.scheduled_at)}`;
  if (st.hearingState === 'held') return `${where} · heard, waiting for its vote`;
  return dl ? `${where} · needs a hearing by ${dayWords(dl.date)}` : where;
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
// The halves are split at the crossover with a small gap, and labelled under each ("House", "Senate", in the bill's own
// order; the final steps unlabelled), so a glance tells which chamber the bill is working through (fresh-eyes review).
function barHTML(b) {
  let m; try { m = trackerModel(b); } catch { return ''; }
  if (!m.stops.length) return '';
  const groups = m.stops.reduce((g, s, i) => { const last = g[g.length - 1]; if (last && last[0] === s.group) last[2]++; else g.push([s.group, i, 1]); return g; }, []);
  const segs = m.stops.map((s, i) => `<i class="is-${s.state}${i && s.group !== m.stops[i - 1].group ? ' ip6-split' : ''}"></i>`).join('');
  const labels = groups.filter(([g]) => g === 'H' || g === 'S').map(([g, i, k]) => `<span style="grid-column: ${i + 1} / span ${k}">${CH[g]}</span>`).join('');
  const col = `grid-template-columns: repeat(${m.stops.length}, minmax(0, 1fr))`;
  return `<span class="ip6-barw" aria-hidden="true"><span class="ip6-bar" style="${col}">${segs}</span><span class="ip6-barl" style="${col}">${labels}</span></span>`;
}
const stepOfWords = b => { try { const m = trackerModel(b); return m.place.state === 'live' && m.cur >= 0 ? `Step ${m.cur + 1} of ${m.n}. ` : ''; } catch { return ''; } };
// One bill in a chamber column: its name, its number small, the bar, and one line (where it is, or why it stopped).
// When two of its bills share a name (HB 2121 and SB 2175 are both "Disposable e-cigarette ban"), the number leads and the
// name comes second, so the two cards can be told apart.
function billCard(x, { me = false } = {}) {
  const b = x.b, line = x.law ? 'Signed into law' : x.alive ? nowWords(b, x.st) : stoppedWords(b);
  const top = x.twin ? `<span class="v6-row-name ip6-num">${esc(numWords(b))}</span> <span class="v6-row-num ip6-twin">${esc(nameWords(b))}</span>`
    : `<span class="v6-row-name">${esc(nameWords(b))}</span> <span class="v6-row-num">${esc(numWords(b))}</span>`;
  return `<div class="v6-row ip6-brow${x.alive ? '' : ' is-stop'}${me ? ' is-this' : ''}" role="listitem" data-v6row="${esc(b.id)}" data-bill="${esc(b.id)}">
    <a class="v6-row-main" href="${esc(billRoute(b))}"${me ? ' aria-current="page"' : ''}><span class="v6-row-top">${top}${me ? '<span class="bw-if-you">This bill</span>' : ''}</span>
      ${x.alive ? barHTML(b) : ''}<span class="v6-row-line">${x.alive ? '' : icon('circle-minus')}<span><span class="sr">${esc(stepOfWords(b))}</span>${nw(esc(line))}</span></span></a></div>`;
}
const STOP_SHOWN = 2;   // stopped bills past this many fold under one line (what is done may fold: rule 3)
function columnHTML(side, xs) {
  const alive = xs.filter(x => x.alive), gone = xs.filter(x => !x.alive), word = CH[side];
  const count = alive.length ? `${alive.length} alive` : gone.length ? 'none alive' : '';
  const shown = gone.slice(0, alive.length ? 0 : STOP_SHOWN), more = gone.slice(shown.length);
  const fold = more.length ? `<details class="ip6-fold" data-fold="stop-${side}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${alive.length || shown.length ? `${plural(more.length, 'more')} stopped` : `${plural(more.length, 'bill')} stopped`}</span></summary>${listBox(more.map(billCard).join(''))}</details>` : '';
  // The empty line only when nothing follows it (the fresh-eyes review: a "none alive" box over stopped cards said it twice).
  const none = !alive.length && !gone.length ? `<p class="ip6-none" data-ip-none="${side}">${icon('circle-minus')}<span>No bill that started in the ${word} is still alive</span></p>` : '';
  return `<section class="ip6-col" aria-labelledby="ip-c${side}" data-ip-col="${side}">
    <h3 class="ip6-colh" id="ip-c${side}">Started in the ${word}${count ? ` <span class="ip6-coln">${count}</span>` : ''}</h3>
    ${alive.length ? listBox(alive.map(billCard).join('')) : none}
    ${shown.length ? listBox(shown.map(billCard).join('')) : ''}${fold}
  </section>`;
}

// Each step in words a person says: who, the verb, the thing ("Kevin files testimony", "You write the draft", "Kevin asks
// the Senate chair for a hearing"). The row leads with it, and the health check's "Next:" is the same words as a whole
// sentence with the bill and the day ("Next: Kevin files testimony on HB 2121, by Wed 3/18."), never cut (fresh-eyes review).
const lc1 = t => /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
const isToday = at => dayWords(at) === dayWords(Date.now());
const whenSay = at => at == null ? '' : isToday(at) ? 'today' : `by ${dayWords(at)}`;
const STEPV = { nodraft: ['write the draft', 'writes the draft'], write: ['write the draft', 'writes the draft'], submit: ['send testimony for approval', 'sends testimony for approval'],
  revise: ['resubmit testimony', 'resubmits testimony'], approve: ['approve testimony', 'approves testimony'], second: ['give testimony a second look', 'gives testimony a second look'],
  file: ['file testimony', 'files testimony'], missed: ['check whether testimony went in', 'checks whether testimony went in'] };
// "Send the ask ..." -> "sends the ask ..." for someone else (the first word of a to-do is its verb).
const third = t => t.replace(/^(\w+)/, w => /(s|sh|ch|x|z)$/i.test(w) ? w + 'es' : /[^aeiou]y$/i.test(w) ? w.slice(0, -1) + 'ies' : w + 's');
function stepWords(s, b) {
  const st = stopOf(b), ch = CH[st.chamber] || '', you = !!s.you, who = s.nobody ? '' : you ? 'You' : cap(s.whose?.words || '');
  let v;
  if (s.kind === 'chair') {
    const chair = /chairs/.test(String(s.ask?.chair || '')) ? `${ch} chairs` : `${ch} chair`;
    v = s.ask?.key === 'ask' || s.ask?.key === 'giving' ? [`ask the ${chair} for a hearing`, `asks the ${chair} for a hearing`]
      : s.ask?.key === 'waiting' && s.ask.followUp ? [`follow up with the ${chair}`, `follows up with the ${chair}`] : null;
  } else v = STEPV[s.kind];
  if (!v) return cap(String(s.line || ''));
  return s.nobody ? `${cap(v[0])} (no owner yet)` : `${who} ${you ? v[0] : v[1]}`;
}
// ---- what to do next: each alive bill's step (steps.js billStep, the row Today and the bill draw), its hearing ahead
// when it has no step, and its open to-dos; in date order ----
function nextSteps(bills) {
  const out = [], v = S.me;
  for (const b of bills) {
    if (b.tracked === false || diedish(b)) continue;
    const s = billStep(b, { viewer: v }), h = hearingAhead(b), st = stopOf(b), num = numWords(b);
    if (s && !['none', 'filed'].includes(s.kind)) {
      const at = s.act?.at ?? s.due ?? (s.kind === 'chair' && st.deadline ? ms(st.deadline.date) : null);
      const phrase = stepWords(s, b), sh = shownStatus(s) || {};
      // The row's one button where the app already offers one (D16; steps.js rowButtonFor's rule).
      const button = rowButtonOK(s) ? rowButton(s) : s.nobody && s.takeFor ? btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': b.id } }) : '';
      const tone = sh.tone && sh.tone !== 'neutral' ? sh.tone : '';
      const line = [num, at != null ? (s.kind === 'chair' ? `by ${dayWords(at)}` : `due ${whenAt(at)}`) : ''].filter(Boolean).join(' · ');
      out.push({ at, b, html: itemRow({ key: 'st' + b.id, name: phrase, line: nw(esc(line)), tone, icon: tone ? sh.icon : '', href: billRoute(b), button, cls: 'ip6-step', bill: b.id }),
        say: `${phrase} on ${num}${at != null ? `, ${whenSay(at)}` : ''}.`, who: s.nobody ? [] : (s.whose?.ids || []), verb: s.kind, nobody: !!s.nobody });
    } else if (h) {
      out.push({ at: ms(h.scheduled_at), b, html: itemRow({ key: 'hr' + b.id, name: `Hearing in ${cwShort(h.committee)}`, line: nw(esc(`${num} · ${whenAt(h.scheduled_at)}`)), href: billRoute(b), cls: 'ip6-step' }),
        say: `${num} has its hearing in ${cwShort(h.committee)}, ${isToday(ms(h.scheduled_at)) ? 'today' : dayWords(h.scheduled_at)}.`, who: [], verb: 'hearing' });
    }
    for (const t of (S.todos?.[b.id] || []).filter(t => !t.done)) {
      const due = t.due_date ? ms(String(t.due_date).length === 10 ? t.due_date + 'T17:00:00-10:00' : t.due_date) : null;
      const you = !!t.assignee_id && t.assignee_id === v?.id, who = t.assignee_id ? cap(firstWords(t.assignee_id, v)) : '';
      const title = unCode(t.title);
      // The database's email-blast to-do ("Send the ask to HIPHI's list and partners for the HHS/CPN hearing 3/20") said
      // shortly; any other to-do in its own words when they are short, else "has a to-do on HB 2121".
      const blast = /^(Send the ask to HIPHI|Send an email blast)/.test(t.title) ? /hearing (\d+\/\d+)$/.exec(t.title) : null;
      const hear = blast ? (S.hearings || []).find(x => 'eb' + x.id === t.id) : null, hch = hear ? CH[S.committees?.[codesOf(hear.committee)[0]]?.chamber] || (/^Senate/.test(cw(hear.committee)) ? 'Senate' : /^House/.test(cw(hear.committee)) ? 'House' : '') : '';
      const short = blast ? `${you ? 'send' : 'sends'} the action alert for the ${blast[1]}${hch ? ' ' + hch : ''} hearing`
        : title.length <= 48 ? (you || !who ? lc1(title) : lc1(third(title))) : '';
      const phrase = !short ? `${who || 'Nobody yet'} ${you ? 'have' : 'has'} a to-do on ${numWords(b)}` : who ? `${who} ${short}` : `${cap(short)} (no owner yet)`;
      out.push({ at: due, b, html: itemRow({ key: 'td' + t.id, name: title, line: nw(esc([numWords(b), who || 'No owner yet', due != null ? `due ${dayWords(due)}` : ''].filter(Boolean).join(' · '))), href: billRoute(b), cls: 'ip6-todo' }),
        say: `${phrase}${due != null ? `, ${whenSay(due)}` : ''}.`, who: t.assignee_id ? [t.assignee_id] : [], verb: 'todo' });
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
function health(xs, steps, earlier, { prepNext = false } = {}) {
  const now = xs.filter(x => thisSession(x.b)), alive = now.filter(x => x.alive), law = alive.filter(x => x.law);
  const H = alive.filter(x => x.side === 'H'), Sn = alive.filter(x => x.side === 'S'), past = alive.filter(x => PAST.has(x.st.phase) && !x.law);
  let k, text;
  if (!now.length) { k = 'none'; text = earlier.length ? `No ${SESSION_YEAR} bills yet: put this session’s bills on it to follow them here.` : 'No bills yet: put a bill on this issue to follow it here.'; }
  else if (law.length) { k = 'won'; text = `${listAnd(law.map(x => numWords(x.b)))} became law.`; }
  else if (!alive.length) { k = 'stopped'; text = now.length === 1 ? 'its only bill stopped this session.' : 'every bill on this issue stopped this session.'; }
  else if (H.length && Sn.length) { k = 'ontrack'; text = 'bills that started in each chamber are still alive.'; }
  else if (past.length) { k = 'ontrack'; const x = past[0]; text = `${numWords(x.b)} is ${x.st.phase === 'conference' ? 'in conference' : x.st.phase === 'governor' ? 'on the Governor’s desk' : 'with the voters'}.`; }
  else {
    // What is at stake (the fresh-eyes review): every alive bill started in one chamber, so if they stop where they are
    // now, the issue ends this year.
    k = 'risk'; const one = H.length ? 'House' : 'Senate', n = alive.length, chs = [...new Set(alive.map(x => x.st.chamber))], at = chs.length === 1 ? ` in the ${CH[chs[0]]}` : '';
    text = n === 1 ? `only one bill is still alive, and it started in the ${one}. If it stops${at}, the issue ends this year.`
      : `all ${n} alive bills started in the ${one}. If they stop${at}, the issue ends this year.`;
  }
  const LEAD = { ontrack: ['On track', 'circle-check'], risk: ['At risk', 'circle-alert'], stopped: ['Stopped', 'circle-minus'], won: ['Won', 'circle-check'], none: ['', 'circle-dashed'] }[k];
  const nx = k === 'stopped' ? (prepNext ? `<span class="ip6-hn">Next: ${btn('get it ready for 2027', { kind: 'text', cls: 'ip6-hlink', attrs: { 'data-ip': 'prep' } })}.</span>` : '')
    : steps[0] && k !== 'none' ? `<span class="ip6-hn">${nw(esc(`Next: ${steps[0].say}`))}</span>` : '';
  return { k, lead: LEAD[0], text: LEAD[0] ? cap(text) : cap(text), html: `<section class="ip6-health" data-health="${k}" aria-labelledby="ip-hh"><h2 class="sr" id="ip-hh">How it stands</h2>
    <p class="ip6-hs">${icon(LEAD[1])}<span>${LEAD[0] ? `<b>${LEAD[0]}:</b> ` : ''}${nw(esc(LEAD[0] ? text : cap(text)))}${nx}</span></p></section>` };
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
    ${coal.length ? `<p class="ip6-pl">${icon('users')}<span>${coal.length === 1 ? 'Coalition' : 'Coalitions'}: ${coal.map(c => `<a class="ip6-coal" href="#/coalition/${encodeURIComponent(c.id)}">${icon(iconName(c.icon))}<span>${esc(c.public_name || c.name)}</span></a>`).join(', ')}</span></p>` : ''}
  </section>`;
}

// ---- where legislators stand: the committees holding the alive bills now, chairs first, with what we know ----
function legsHTML(i, xs) {
  const by = new Map(), floor = [];
  for (const x of xs) {
    if (!x.alive || !thisSession(x.b) || PAST.has(x.st.phase) || x.law) continue;
    if (x.st.phase === 'floor') { floor.push(x); continue; }
    const code = hearingAhead(x.b)?.committee || x.st.committee; if (!code) continue;
    const key = codesOf(code).sort().join('/'); (by.get(key) || by.set(key, { code, bills: [] }).get(key)).bills.push(x.b);
  }
  const stanceFor = (l, bills) => { const known = bills.map(b => [b, stanceOf(b.id, l.id).stance]).filter(([, s]) => s !== 'unknown');
    if (!known.length) return { word: 'Stance unknown', ic: STANCE_ICON.unknown, s: 'unknown' };
    const [b, s] = known[0]; return { word: `${STANCE_WORD[s]}${bills.length > 1 ? ` on ${numWords(b)}` : ''}`, ic: STANCE_ICON[s], s }; };
  // A photo, or the surname's first letter (the critic: "J" for Sen. San Buenaventura read as someone else).
  const face = l => l.photo_url ? photo(l, 40) : `<span class="lg-ph s40 none ip6-face">${esc((surname(l) || l.name || '?')[0])}</span>`;
  const legRow = (m, bills) => { const l = m.l, st = stanceFor(l, bills);
    return `<div class="v6-row ip6-lrow" role="listitem"><a class="v6-row-main" href="${esc(legHref(l, bills[0]))}">${face(l)}<span class="ip6-lbody"><span class="v6-row-name">${esc(shortName(l))}</span>
      <span class="v6-row-line">${icon(st.ic)}<span>${esc(m.role === 'member' ? st.word : `${roleWord(m.role)} · ${st.word}`)}</span></span></span></a></div>`; };
  const groups = [...by.values()].map(g => {
    const all = legsOf(g.code), known = all.filter(m => stanceFor(m.l, g.bills).s !== 'unknown');
    const chairs = all.filter(m => m.role === 'chair'), h = g.bills.map(hearingAhead).find(Boolean);
    const holds = `holds ${listAnd(g.bills.map(numWords))}${h ? `, hearing ${whenAt(h.scheduled_at)}` : ''}`;
    const chairWords = chairs.length ? `${chairs.length > 1 ? 'chairs' : 'chair'} ${listAnd(chairs.map(m => surname(m.l)))}` : '';
    // Nothing known yet: one line per committee (rows only once a stance exists; the fresh-eyes review).
    if (!known.length) return `<p class="ip6-pl ip6-lline">${icon('landmark')}<span><span class="ip6-lname">${esc(cwShort(g.code))}</span> ${esc(`${holds} · ${[chairWords, 'no stances known yet'].filter(Boolean).join(' · ')}`)}</span></p>`;
    const unk = all.length - known.length;
    return `<div class="ip6-lg"><h3 class="ip6-lgh">${esc(cwShort(g.code))}</h3>
      <p class="ip6-lgs">${esc(cap(`${holds}${chairWords ? ` · ${chairWords}` : ''}`))}</p>
      ${listBox(known.map(m => legRow(m, g.bills)).join(''))}
      ${unk ? `<p class="ip6-quiet">${esc(`${plural(unk, 'other member')}: no stance known yet`)}</p>` : ''}
    </div>`;
  }).join('');
  const fl = floor.length ? `<p class="ip6-pl">${icon('landmark')}<span>${esc(floor.map(x => `${numWords(x.b)} waits for a vote of the full ${CH[x.st.chamber] || 'chamber'}`).join('; '))}</span></p>` : '';
  const cares = !PROFILES() || i.archived_at ? '' : caresLegs(i.id).length ? caresSecHTML(i) : `<p class="ip6-pl">${icon('landmark')}<span>Legislators who care about this: none yet</span></p>`;
  // The closed line's summary (walk 4): how many committees hold its bills, and whether any stance is known.
  const known = [...by.values()].reduce((n, g) => n + legsOf(g.code).filter(m => stanceFor(m.l, g.bills).s !== 'unknown').length, 0);
  const sum = !by.size && !floor.length ? 'No committee holds its bills now'
    : [by.size ? plural(by.size, 'committee') : '', floor.length ? `${plural(floor.length, 'bill')} at a floor vote` : '', known ? plural(known, 'stance') + ' known' : 'no stances known yet'].filter(Boolean).join(' · ');
  const body = !groups && !fl ? `<p class="ip6-quiet">No committee holds one of its bills right now.</p>${cares}` : `${groups}${fl}${cares}`;
  return { sum, body: `<div class="ip6-legs">${body}</div>` };
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
// The closed line: how many events, and the newest one's day.
function tlSum(i, bills) {
  const box = TL()[i.id];
  if (!box || box.state === 'loading') return 'Loading…';
  const ev = events(i, bills); return ev.length ? `${plural(ev.length, 'event')} · newest ${dayAny(ev[0].at)}` : 'Nothing has happened on its bills yet';
}
function tlHTML(i, bills) {
  return { sum: tlSum(i, bills), body: `<p class="ip6-sfa">${btn('Log a talk', { kind: 'text', sm: true, icon: 'message-square', attrs: { 'data-ip': 'cvlog', 'aria-haspopup': 'dialog', 'aria-label': 'Log a talk with a legislator about this issue' } })}</p>
    <div data-ip-late="tl">${tlBody(i, bills)}</div>` };
}

// ---- last year's result: what happened to its bills in the session before this one ----
function lastYearRows(i, bills, earlier) {
  const prev = +SESSION_YEAR - 1, box = TL()[i.id], rows = [];
  for (const b of earlier) { const w = effStage(b) === 'enacted' ? 'became law' : diedish(b) ? stoppedWords(b).replace(/^Stopped/, 'stopped') : 'still moving'; rows.push({ b, text: w, rank: w === 'became law' ? 99 : 0, short: w }); }
  for (const b of bills) {
    const outs = Object.values(S.outcomes || {}).filter(o => o.bill_id === b.id && yearOf(o.scheduled_at) === prev).sort((x, y) => String(x.scheduled_at).localeCompare(String(y.scheduled_at)));
    const acts = (box?.acts?.[b.id] || []).filter(a => yearOf(a.occurred_at) === prev);
    const passed = outs.filter(o => /^passed/.test(o.outcome)).map(o => cw(o.committee)), def = outs.find(o => o.outcome === 'deferred');
    const floor = acts.find(a => /^Passed Third Reading/i.test(a.title || '')), carried = acts.some(a => /^Carried over/i.test(a.title || ''));
    const intro = acts.some(a => /introduc|prefiled|first reading/i.test(a.title || ''));
    if (!outs.length && !floor && !intro) continue;
    const fch = floor ? (/senate/i.test(floor.details || '') ? 'Senate' : 'House') : '';
    const parts = [passed.length ? `passed ${listAnd(passed)}` : outs.length ? '' : 'was not heard', floor ? `passed the full ${fch}` : '', def ? `deferred by ${cw(def.committee)}` : '', carried ? `carried over to ${SESSION_YEAR}` : ''].filter(Boolean);
    rows.push({ b, text: parts.join(', then '), rank: (floor ? 10 : 0) + passed.length, short: floor ? `passed the ${fch}` : def ? `stopped in ${cw(def.committee)}` : passed.length ? `passed ${listAnd(passed)}` : 'was not heard' });
  }
  return rows;
}
// The fold's summary says the result (the fresh-eyes review): the bill that went farthest ("2025: HB 244 passed the House").
function lastYearSum(i, bills, earlier) {
  const prev = +SESSION_YEAR - 1, rows = lastYearRows(i, bills, earlier), box = TL()[i.id];
  if (!rows.length) return box?.state === 'loading' ? `${prev}: loading…` : `${prev}: nothing on record`;
  const best = [...rows].sort((x, y) => y.rank - x.rank)[0];
  return `${prev}: ${numWords(best.b)} ${best.short}${rows.length > 1 ? `; ${plural(rows.length - 1, 'more bill')} inside` : ''}`;
}
function lastYearBody(i, bills, earlier) {
  const prev = +SESSION_YEAR - 1, box = TL()[i.id], rows = lastYearRows(i, bills, earlier);
  if (!rows.length) return box?.state === 'loading' ? '<p class="ip6-quiet" aria-busy="true">Loading…</p>' : `<p class="ip6-quiet">Nothing on record for its bills in ${prev}.</p>`;
  return `<ul class="ip6-ly" role="list">${rows.map(r => `<li><a href="${esc(billRoute(r.b))}">${esc(numWords(r.b))}</a> <span>${esc(r.text)}</span></li>`).join('')}</ul>`;
}
const lastYearHTML = (i, bills, earlier) => ({ sum: lastYearSum(i, bills, earlier), body: `<div data-ip-late="ly">${lastYearBody(i, bills, earlier)}</div>` });
// The parts that wait for the activity paint in place when it arrives, so nothing moves under the reader (no full redraw).
function paintLate(i) {
  if (S.route?.name !== 'issue' || String(S.route.id) !== String(i.id)) return;
  const { now, earlier } = billsSplit(i);
  const tl = document.querySelector('[data-ip-late="tl"]'); if (tl) tl.innerHTML = tlBody(i, now.concat(earlier));
  const ly = document.querySelector('[data-ip-late="ly"]'); if (ly) ly.innerHTML = lastYearBody(i, now, earlier);
  const ls = document.querySelector('[data-ip-late="lastyearsum"]'); if (ls) ls.textContent = lastYearSum(i, now, earlier);
  const ts = document.querySelector('[data-ip-late="tlsum"]'); if (ts) ts.textContent = tlSum(i, now.concat(earlier));
}

// ---- public interest, and where partners stand ----
// Where partners stand (issue_partner_positions, migration 189, Nate's yes on walk 4): staff record each partner group's
// position on the issue, or on one of its bills, for a session. Read once per visit; a failed read shows the older lines
// (the partner groups writing on its bills) and no editor, so nothing is claimed that could not be read.
const PP = () => S.ipPP ??= {};
const PP_WORD = { support: 'Supports', oppose: 'Opposes', amend: 'Wants changes', comments: 'Comments', unknown: 'Not known' };
const PP_ORDER = ['support', 'amend', 'comments', 'oppose', 'unknown'];
// Anyone who can edit the issue (the header's Edit is there for every signed-in advocate; the table lets active staff write).
const mayPP = i => !!S.me && !i.archived_at;
function wantPP(i) {
  const had = PP()[i.id]; if (had) return had;
  const box = PP()[i.id] = { state: 'loading', rows: [] };
  DB.partnerPositions(i.id).then(r => { box.rows = r; box.state = 'done'; })
    .catch(e => { console.warn('issue_partner_positions:', e?.message || e); box.state = 'err'; })
    .finally(() => paintPP(i));
  return box;
}
const ppRows = i => [...(PP()[i.id]?.rows || [])].sort((x, y) => (y.session_year - x.session_year) || (PP_ORDER.indexOf(x.stance) - PP_ORDER.indexOf(y.stance)) || x.partner_name.localeCompare(y.partner_name));
const setByWords = r => { const a = r.set_by && advocate(r.set_by), who = !a ? '' : a.id === S.me?.id ? 'you' : a.full_name.split(' ')[0];
  return [who ? `Set by ${who}` : '', r.set_at ? dayAny(r.set_at) : '', r.source === 'testimony' ? 'from their testimony' : ''].filter(Boolean).join(' · '); };
function ppRow(i, r, edit) {
  const b = r.bill_id ? billById(r.bill_id) : null;
  const line = [PP_WORD[r.stance] || PP_WORD.unknown, b ? `on ${numWords(b)}` : 'the whole issue', String(r.session_year)].join(' · ');
  const inner = `<span class="v6-row-top"><span class="v6-row-name">${esc(r.partner_name)}</span></span><span class="v6-row-line"><span>${esc(line)}</span></span>
    ${r.note ? `<span class="ip6-ppn">${esc(r.note)}</span>` : ''}<span class="ip6-ppby">${esc(setByWords(r))}</span>`;
  return `<div class="v6-row ip6-pp" role="listitem" data-pp="${esc(r.id)}">${edit
    ? `<button type="button" class="v6-row-main" data-ipp="edit" data-ppid="${esc(r.id)}" aria-label="${esc(`${r.partner_name}: ${line}. Change or remove`)}">${inner}</button>`
    : `<span class="v6-row-main">${inner}</span>`}</div>`;
}
// The partner groups writing on its bills (partner_queue, read for partner approvers): a quiet line under the positions.
function writingLines(now) {
  const ids = new Set(now.map(b => b.id)), side = { support: 'supports', oppose: 'opposes', amend: 'asks to amend', comments: 'comments on' };
  return [...new Set((S.pq?.bills || []).filter(x => ids.has(x.bill_id)).map(x => `${x.partner_name} ${side[(x.words || x.live)?.side] || 'writes about'} ${numWords(billById(x.bill_id))}${x.live ? '' : ' (words waiting for approval)'}`))];
}
function ppBody(i, now) {
  const box = PP()[i.id], pw = writingLines(now);
  const writing = pw.length ? `<p class="ip6-pl">${icon('handshake')}<span>Writing on its bills: ${esc(pw.join('; '))}</span></p>` : '';
  if (!box || box.state === 'loading') return `<p class="ip6-quiet" aria-busy="true">Loading partners’ positions…</p>${writing}`;
  if (box.state === 'err') return `${writing || `<p class="ip6-pl">${icon('handshake')}<span>Partners’ positions: none on record yet</span></p>`}`;
  const edit = mayPP(i), rows = ppRows(i);
  return `${rows.length ? listBox(rows.map(r => ppRow(i, r, edit)).join('')) : `<p class="ip6-quiet">No partner’s position recorded yet.</p>`}
    ${edit ? `<p class="ip6-sfa">${btn('Add a partner', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-ipp': 'add', 'aria-haspopup': 'dialog', 'aria-label': `Add a partner’s position on ${i.name}` } })}</p>` : ''}
    ${writing}`;
}
const ppCount = i => { const box = PP()[i.id]; return !box || box.state === 'loading' ? null : box.state === 'err' ? -1 : box.rows.length; };
function publicSum(i, now) {
  const n = ppCount(i), f = sumPub(now).followers;
  const pp = n == null ? '' : n < 0 ? '' : n ? plural(n, 'partner position') : 'no partner positions yet';
  return [isDraft(i) ? '' : `${f.toLocaleString()} following its bills`, pp].filter(Boolean).join(' · ') || 'loading…';
}
function sumPub(now) {
  const sum = { followers: 0, testimonies: 0, emails: 0, attending: 0 };
  for (const b of now) { const c = S.pubCounts?.[b.id]; if (!c) continue; sum.followers += c.followers || 0; if ((c.people || 0) >= 10) { sum.testimonies += c.testimonies || 0; sum.emails += c.emails || 0; sum.attending += c.attending || 0; } }
  return sum;
}
function publicHTML(i, now) {
  wantPP(i);
  const pp = `<h3 class="ip6-h3">Where partners stand</h3><div data-ip-late="pp">${ppBody(i, now)}</div>`;
  // A draft has no public page yet: only where partners stand.
  if (isDraft(i)) return { title: 'Where partners stand', sum: publicSum(i, now), body: `<div data-ip-late="pp">${ppBody(i, now)}</div>` };
  const f = followers(i), sum = sumPub(now);
  const acts = [sum.testimonies ? `${sum.testimonies} testified` : '', sum.emails ? `${sum.emails} emailed a legislator` : '', sum.attending ? `${sum.attending} plan to attend` : ''].filter(Boolean);
  // The first-visit switch is a setting, so it moved to the issue's "…" (the fresh-eyes review); here its state, in words.
  const fv = i.archived_at ? '' : `<p class="ip6-pl">${icon(inFirstVisit(i) ? 'eye' : 'eye-off')}<span>${inFirstVisit(i) ? 'Shown in the first visit' : 'Left out of the first visit'}</span></p>`;
  return { title: 'Public interest and where partners stand', sum: publicSum(i, now), body: `<div class="ip6-pub">
    <p class="ip6-pl">${icon('users')}<span>${esc(f ? `Following this issue: ${f.own}${f.via ? ` (${f.via} more with its whole topic)` : ''} · following its bills: ${sum.followers}` : 'Counting followers…')}</span></p>
    ${acts.length ? `<p class="ip6-pl">${icon('megaphone')}<span>${esc(cap(acts.join(' · ')))}</span></p>` : ''}
    ${fv}</div>${pp}` };
}
// The positions arrive after the first draw: painted in place (no full redraw under the reader), then wired.
function paintPP(i) {
  if (S.route?.name !== 'issue' || String(S.route.id) !== String(i.id)) return;
  const { now } = billsSplit(i);
  document.querySelectorAll('[data-ip-late="pp"]').forEach(el => { el.innerHTML = ppBody(i, now); wirePP(i, el); });
  const s = document.querySelector('[data-ip-late="publicsum"]'); if (s) s.textContent = publicSum(i, now);
}
function ppRedraw(i, focus) {
  const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y);
  (focus && document.querySelector(focus) || document.querySelector('[data-ipp="add"]'))?.focus({ preventScroll: true });
}
const ppSay = r => { const b = r.bill_id ? billById(r.bill_id) : null; return `${r.partner_name}: ${(PP_WORD[r.stance] || PP_WORD.unknown).toLowerCase()}${b ? ` on ${numWords(b)}` : ''}`; };
// The names to suggest: the partner groups the app knows (Partners, partner_queue, partner links) and names already used on
// any issue this visit. Free text is fine: many partners (the Heart Association, a retailers' group) have no login here.
function ppNames(i, r) {
  // A partner already set on this issue is changed from its row, so it is not offered again (ui-critic).
  const here = new Set((PP()[i.id]?.rows || []).filter(x => x.id !== r?.id).map(x => x.partner_name.toLowerCase())), out = new Set();
  for (const g of S.pg?.groups || []) out.add(g.name);
  for (const p of S.partners || []) out.add(p.name);
  for (const x of S.pq?.bills || []) out.add(x.partner_name);
  for (const box of Object.values(PP())) for (const r of box.rows || []) out.add(r.partner_name);
  return [...out].filter(n => n && !/\(sample\)$/.test(n) && !here.has(n.toLowerCase())).sort((a, b) => a.localeCompare(b));
}
function ppSheet(i, r = null) {
  const { now, earlier } = billsSplit(i), bills = [...now, ...earlier];
  if (!S.pg && !S.pgLoading) DB.loadPartnerGroups().then(() => { const dl = document.getElementById('ip-ppnames'); if (dl) dl.innerHTML = ppNames(i, r).map(n => `<option value="${esc(n)}"></option>`).join(''); }).catch(() => {});
  const body = `<div class="le-sheet is-form ip6-ppform">
    <div class="field"><label for="ip-ppname">Partner</label><input id="ip-ppname" maxlength="120" autocomplete="off" list="ip-ppnames" value="${esc(r?.partner_name || '')}" placeholder="Type or pick a group" aria-describedby="ip-ppname-h ip-ppname-err">
      <datalist id="ip-ppnames">${ppNames(i, r).map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      <span class="help" id="ip-ppname-h">A partner group’s name. Pick one the app knows, or type any group.</span><div id="ip-ppname-err" role="alert"></div></div>
    <fieldset class="is-cats"><legend>Where they stand</legend>
      ${PP_ORDER.map(k => `<label class="check is-cat"><input type="radio" name="ip-ppst" value="${k}" ${r?.stance === k ? 'checked' : ''}><span>${PP_WORD[k]}</span></label>`).join('')}</fieldset>
    <div class="field"><label for="ip-ppbill">On</label><select id="ip-ppbill"><option value="">The whole issue</option>${bills.map(b => `<option value="${esc(b.id)}" ${r?.bill_id === b.id ? 'selected' : ''}>${esc(`${numWords(b)}${thisSession(b) ? '' : ` (${b.session_year})`} · ${nameWords(b)}`)}</option>`).join('')}</select></div>
    <div class="field"><label for="ip-ppnote">Note <span class="is-opt">(optional)</span></label><textarea id="ip-ppnote" rows="3" maxlength="2000" aria-describedby="ip-ppnote-h">${esc(r?.note || '')}</textarea>
      <span class="help" id="ip-ppnote-h">What they said or asked for. Staff only. For the ${esc(r?.session_year || SESSION_YEAR)} session.</span></div>
  </div>`;
  openSheet({ title: r ? `${esc(r.partner_name)}’s position` : 'Add a partner’s position', size: 'auto', body,
    foot: `${r ? btn('Remove', { kind: 'text', icon: 'trash-2', attrs: { 'data-ppx': '1' } }) : ''}${btn(r ? 'Save changes' : 'Add', { icon: r ? 'check' : 'plus', attrs: { 'data-ppsave': '1' } })}`,
    wire: d => {
      const name = d.querySelector('#ip-ppname'), err = d.querySelector('#ip-ppname-err'), go = d.querySelector('[data-ppsave]');
      if (!r) name.focus();
      const bad = t => { name.setAttribute('aria-invalid', 'true'); err.innerHTML = `<span class="err">${icon('circle-alert')}${esc(t)}</span>`; name.focus(); };
      name.oninput = () => { name.removeAttribute('aria-invalid'); err.innerHTML = ''; };
      go.onclick = async () => {
        const p = { id: r?.id, issue_id: i.id, partner_name: name.value.trim().replace(/\s+/g, ' '), stance: d.querySelector('input[name="ip-ppst"]:checked')?.value || 'unknown',
          bill_id: d.querySelector('#ip-ppbill').value || null, note: d.querySelector('#ip-ppnote').value, source: r?.source || 'staff', session_year: r?.session_year || +SESSION_YEAR };
        if (p.partner_name.length < 2) return bad('Give the partner’s name.');
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          const saved = await DB.savePartnerPosition(p), box = PP()[i.id], before = r ? { ...r } : null;
          box.rows = [...box.rows.filter(x => x.id !== saved.id), saved];
          await closeSheet({ silent: true }); await afterClose();
          ppRedraw(i, `[data-ppid="${saved.id}"]`);
          toast(r ? `Saved. ${ppSay(saved)}.` : `Added. ${ppSay(saved)}.`, { ok: true, undo: async () => {
            if (before) { const back = await DB.savePartnerPosition(before); box.rows = [...box.rows.filter(x => x.id !== back.id), back]; }
            else { await DB.removePartnerPosition(saved.id); box.rows = box.rows.filter(x => x.id !== saved.id); }
            ppRedraw(i); } });
        } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; if (e?.code === '23505') bad(e.message); else toast(e, { err: true }); }
      };
      d.querySelector('[data-ppx]')?.addEventListener('click', async () => {
        try {
          await DB.removePartnerPosition(r.id); const box = PP()[i.id]; box.rows = box.rows.filter(x => x.id !== r.id);
          await closeSheet({ silent: true }); await afterClose(); ppRedraw(i);
          toast(`Removed ${r.partner_name}’s position.`, { undo: async () => { const back = await DB.savePartnerPosition({ ...r }, { insert: true }); box.rows = [...box.rows, back]; ppRedraw(i, `[data-ppid="${back.id}"]`); } });
        } catch (e) { toast(e, { err: true }); }
      });
    } });
}
function wirePP(i, root) {
  root.querySelectorAll('[data-ipp="add"]').forEach(el => el.onclick = () => ppSheet(i));
  root.querySelectorAll('[data-ipp="edit"]').forEach(el => el.onclick = () => { const r = PP()[i.id]?.rows.find(x => x.id === el.dataset.ppid); if (r) ppSheet(i, r); });
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
  // The closed line (walk 4): "3 points, 6 documents".
  const np = shown.length + more.length, sum = [np ? plural(np, 'point') : 'no talking points yet', docList.length ? plural(docList.length, 'document') : ''].filter(Boolean).join(', ');
  return { sum: cap(sum), body: `${goal}
    ${shown.length ? `${src}<ul class="ip6-pts" role="list">${shown.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : `<p class="ip6-quiet">No talking points yet.</p>`}
    ${more.length ? `<details class="ip6-fold" data-fold="pts"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${plural(more.length, 'more point')} from its bills</span></summary><ul class="ip6-pts" role="list">${more.map(([b, t]) => `<li>${esc(t)}${b ? ` <span class="ip6-evd">${esc(numWords(b))}</span>` : ''}</li>`).join('')}</ul></details>` : ''}
    ${docList.length ? `<h3 class="ip6-h3">Testimony to borrow from</h3><ul class="ip6-docs" role="list">${docList.slice(0, DOCS_SHOWN).join('')}</ul>
      ${docList.length > DOCS_SHOWN ? `<details class="ip6-fold" data-fold="docs"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${plural(docList.length - DOCS_SHOWN, 'more document')}</span></summary><ul class="ip6-docs" role="list">${docList.slice(DOCS_SHOWN).join('')}</ul></details>` : ''}` : ''}
    <p class="ip6-pl">${icon('book-open')}<span><a href="#/testimony?view=library">Earlier testimony library</a></span></p>` };
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
  const row = (o, line, button = '') => itemRow({ key: o.id, name: o.name, line: line ? esc(line) : '', href: `#/issue/${encodeURIComponent(o.id)}`, button, cls: 'i6-row', lead: issueLead(o) });
  return { sum: on.length ? plural(on.length, 'linked issue') : 'none yet', body: `<div class="is6-rel">
    <div class="i6-hrow ip6-sfa"><p class="ip6-quiet">Followers of either one see the other’s bills first.</p>${btn(edit ? 'Done' : 'Edit', { kind: 'text', sm: true, attrs: { 'data-is': 'reledit', 'aria-expanded': String(edit), 'aria-label': edit ? 'Done editing related issues' : 'Edit related issues' } })}</div>
    ${on.length ? listBox(on.map(({ o, staff }) => row(o, about(o, staff), edit ? iconBtn('x', `Unlink ${o.name} from ${i.name}`, { 'data-isunlink': o.id }) : '')).join('')) : '<p class="ip6-quiet">None yet.</p>'}
    ${edit ? `<p class="i6-acts">${btn('Link another issue', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-is': 'link', 'aria-haspopup': 'dialog' } })}</p>
    ${off.length ? `<details class="i6-fold" data-fold="unlinked"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Unlinked by staff (${off.length})</span></summary>
      ${listBox(off.map(({ o, c }) => row(o, cap([about(o), who(c)].filter(Boolean).join(', ')), btn('Link again', { kind: 'text', sm: true, attrs: { 'data-isrelink': o.id } }))).join(''))}</details>` : ''}` : ''}
  </div>` };
}
async function setLink(i, o, on) {
  const redraw = () => { const y = scrollY; hooks.render(); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); document.querySelector('.is6-rel')?.querySelector('[data-is="link"], [data-is="reledit"]')?.focus({ preventScroll: true }); };
  try {
    await DB.setIssueLink(i.id, o.id, on); redraw();
    toast(on ? `Linked ${o.name} and ${i.name}.` : `Unlinked ${o.name} and ${i.name}.`, { ok: on, undo: async () => { await DB.setIssueLink(i.id, o.id, !on); redraw(); } });
  } catch (e) { toast(e, { err: true }); }
}
function pickSheet({ title, intro, find, attr, list, onPick }) {
  let q = '';
  const draw = () => { const l = list(plain(q.trim()));
    return l.length ? `<div class="sv-pickl">${l.map(x => `<button type="button" ${attr}="${esc(x.id)}">${icon(issueIcon(x))}<span class="body"><span class="title">${esc(x.name)}</span><span class="sub">${esc(catByKey(x.category)?.name || '')} · ${plural(billsOn(x).length, 'bill')}</span></span></button>`).join('')}</div>` : '<p class="le-none">No other issue matches.</p>'; };
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
  const redraw = () => { const y = scrollY; hooks.render(); document.querySelector('[data-is="more"]')?.focus({ preventScroll: true }); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };
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

// ---- stories from supporters (R-341, Nate 10/26) ----
// The stories supporters told about this issue, for its owner, its helpers and admins: first name and island only (the
// rest of a supporter's details are an admin's). Read once per visit; reference, so it sits in a fold.
const STO = () => S.ipStories ??= {};
const mayStories = i => !!S.me && (!!S.me.is_admin || i.owner_id === S.me.id || issueHelpersOf(i).some(h => h.id === S.me.id));
const STORY_QUOTE = { none: 'Not for quoting: they did not say HIPHI may quote it.', first: 'HIPHI may quote it with their first name and island, after asking again.',
  name: 'HIPHI may quote it with their full name, after asking again. An admin has their details.', media: 'HIPHI may quote it with their full name and share it with reporters, after asking again. An admin has their details.' };
function wantStories(i) {
  const st = STO(); if (st[i.id] !== undefined) return;
  st[i.id] = null;
  DB.issueStories(i.id).then(r => { st[i.id] = r; }).catch(() => { st[i.id] = false; }).finally(() => { if (S.route?.name === 'issue' && String(S.route.id) === String(i.id)) hooks.render(); });
}
function storiesHTML(i) {
  const r = STO()[i.id];
  if (r === null || r === undefined) return { sum: 'Loading', body: '<p class="meta">Loading the stories.</p>' };
  if (r === false) return { sum: 'Did not load', body: '<p class="meta">The stories did not load. Open the page again to retry.</p>' };
  if (!r.length) return { sum: 'None yet', body: '<p class="meta">No supporter has told a story about this issue yet. Supporters add one from their profile on the tracker.</p>' };
  return { sum: plural(r.length, 'story', 'stories'), body: `<ul class="ip6-stories">${r.map(x => `<li><q>${esc(x.story)}</q><span class="meta">${esc(x.first_name)}${x.island ? `, ${esc(x.island)}` : ''}${x.about_issue ? '' : ' · a story for any issue; they follow this one'} · ${esc(STORY_QUOTE[x.quote] || STORY_QUOTE.none)}</span></li>`).join('')}</ul>` };
}

// ---- the page ----
const billsSplit = i => { const bills = billsOn(i).sort(byNum); return { now: bills.filter(thisSession), earlier: bills.filter(b => !thisSession(b)) }; };
// A folded section (Nate, walk 4: "filling the issue page with content both in the middle and on the right can be too
// crowded"): its heading and a one-line summary on the closed line ("Talking points and materials · 3 points, 6
// documents"), opened with a tap; the fold remembers being open for the visit (wire). Folds hold reference, never a step
// to take (B-14 on v6: What to do next stays open above).
const foldSec = (key, hid, title, { sum = '', body = '' }, { late = key + 'sum', quiet = false } = {}) => `<details class="ip6-sf${quiet ? ' is-quiet' : ''}" data-fold="${key}">
  <summary>${icon('chevron-down', { cls: 'i6-chev' })}<span class="ip6-sft"><h2 class="ip6-sfh" id="${hid}">${esc(title)}</h2>${sum ? `<span class="ip6-sfs"> · <span data-ip-late="${late}">${esc(sum)}</span></span>` : ''}</span></summary>
  <div class="ip6-sfb">${body}</div></details>`;
function pageRender(route) {
  const i = issueById(route.id);
  if (!i) return `<div class="le-page i6-page">${empty({ h: 'h1', title: 'This issue is not here', text: 'It may have been merged into another, or the link is old.', action: btn('See all issues', { kind: 'secondary', href: '#/my-issues/all' }) })}</div>`;
  wantPeople();
  const c = catByKey(i.category), also = alsoIn(i).map(catByKey).filter(Boolean), { now, earlier } = billsSplit(i);
  const from = billFrom(route), bk = backTo(route);
  wantTl(i, now.concat(earlier));
  const xs = now.map(placeOfBill), names = new Map(); for (const x of xs) { const n = plain(nameWords(x.b)); names.set(n, (names.get(n) || 0) + 1); }
  for (const x of xs) x.twin = names.get(plain(nameWords(x.b))) > 1;
  const steps = nextSteps(now), hc = health(xs, steps, earlier, { prepNext: !i.archived_at && !isDraft(i) && stateOf(i) !== 'approved' });
  const outlook = i.outlook ? `<p class="is6-desc"><span class="is6-dl">Between sessions, the public reads:</span> ${esc(i.outlook)}</p>` : '';
  const head = `<header class="is6-head ip6-head">
      <span class="is6-icon mi-c-${esc(i.category || 'none')}" aria-hidden="true">${icon(issueIcon(i))}</span>
      <div class="is6-hbody"><h1 class="is6-h1">${esc(i.name)}</h1>
        ${i.description ? `<p class="is6-desc">${esc(i.description)}</p>` : ''}
        ${SESSION_OVER && !prepHoldsOutlook(i) ? outlook : ''}
        <p class="is6-meta"><span class="is6-stl">HIPHI’s stance</span>${mayStance(i) ? stanceChip(i, { 'data-is': 'stance' }) : stanceWords(i)}<span class="is6-cat">${esc([c?.name || i.category, also.length ? `also in ${also.map(x => x.name).join(' and ')}` : '', i.recommended ? 'pre-ticked for new visitors' : ''].filter(Boolean).join(' · '))}</span></p>
        ${stanceNote(i, now)}
      </div>
      <div class="is6-hacts">${btn('Edit', { kind: 'text', sm: true, icon: 'pencil', cls: 'is6-edit', attrs: { 'data-is': 'edit', 'aria-haspopup': 'dialog', 'aria-label': `Edit ${i.name}` } })}${iconBtn('ellipsis', `More for ${i.name}: merge, public page, archive`, { 'data-is': 'more', 'aria-haspopup': 'dialog' })}</div>
    </header>
    ${i.archived_at ? `<p class="i6-line">${icon('archive')}<span><b>Archived.</b> The public does not see it, and its followers do not get its bills.</span>${btn('Restore', { kind: 'secondary', sm: true, attrs: { 'data-is': 'restore' } })}</p>` : ''}`;
  // The bills, House bills | Senate bills, by the chamber each started in.
  const edit = !!P().edit[i.id] || !(now.length + earlier.length);
  const cols = now.length ? `<div class="ip6-cols">${columnHTML('H', xs.filter(x => x.side === 'H'))}${columnHTML('S', xs.filter(x => x.side === 'S'))}</div>` : '';
  const editBtn = now.length + earlier.length ? btn(edit ? 'Done' : 'Edit bills', { kind: 'text', sm: true, icon: edit ? 'check' : 'pencil', attrs: { 'data-is': 'editbills', 'aria-expanded': String(edit) } }) : '';
  const billsSec = `<section class="ip6-sec ip6-bills" aria-labelledby="is-bh"><div class="i6-hrow"><h2 class="ip6-h" id="is-bh">Its bills</h2>${editBtn}</div>
    ${cols}${edit ? editHTML(i, now, earlier) : ''}</section>`;
  // R-316 W16: between sessions the 2027 prep is the work, so its card comes first; in session it waits at the end (and is
  // left out until someone starts it: prep.js, walk 3 item 7).
  const prep = prepCardHTML(i, { outlook: SESSION_OVER ? '' : outlook, always: hc.k === 'stopped' }), prepFirst = (SESSION_OVER && !isDraft(i) && !i.archived_at && stateOf(i) !== 'approved') || isDraft(i);
  const next = nextHTML(steps, now.length > 0), who = whoHTML(i, xs, steps), pub = publicHTML(i, now);
  const back = `<a class="co6-back" href="${from ? billRoute(from) : bk.href}" data-back${from ? ` aria-label="Back to ${esc(from.bill_number)}"` : ''}>${icon('chevron-left')}<span>${from ? `Back to ${esc(from.bill_number)}` : esc(bk.label)}</span></a>`;
  // One reading column at every width (Nate, walk 4: "one column on a laptop", read top to bottom; the screen is a 760px
  // column, `narrow`). The top four stay open: how it stands, what to do next, its bills, who is working on it. Everything
  // after is folded with a one-line summary, in Nate's order; where legislators stand sits quiet, last before the timeline
  // ("the where legislators stand section should not be as prominent"). Related issues end it, quiet too.
  const folds = [
    foldSec('points', 'ip-mh', 'Talking points and materials', pointsHTML(i, now, earlier)),
    foldSec('public', 'ip-ph', pub.title, pub),
    mayStories(i) ? (wantStories(i), foldSec('stories', 'ip-sh', 'Stories from supporters', storiesHTML(i))) : '',
    foldSec('legs', 'ip-lh', 'Where legislators stand', legsHTML(i, xs), { quiet: true }),
    foldSec('timeline', 'ip-th', 'Timeline', tlHTML(i, now.concat(earlier)), { late: 'tlsum' }),
    foldSec('lastyear', 'ip-yh', 'Last year’s result', lastYearHTML(i, now, earlier), { late: 'lastyearsum' }),
    i.archived_at ? '' : foldSec('related', 'is-rh', 'Related issues', relatedHTML(i), { quiet: true }),
  ].join('');
  return `<div class="le-page is6-page ip6-page">${back}${head}${prepFirst ? prep : ''}${hc.html}${next}${billsSec}${who}<div class="ip6-folds">${folds}</div>${prepFirst ? '' : prep}</div>`;
}

export const issuePage = {
  tab: 'myissues',   // issues are under My issues
  // "Back to SB2175" fits on a phone too (R-226), so it keeps its words there: full. From My issues (R-263), Back returns there.
  title: route => issueById(route.id)?.name || 'Issue',
  back: route => { const from = billFrom(route); return from ? { href: billRoute(from), label: `Back to ${from.bill_number}`, full: true } : backTo(route); },
  narrow: true,   // one reading column, about 760px, at every width (walk 4)
  render: pageRender,
  wire(route, root) {
    const i = issueById(route.id); if (!i) return;
    rememberRow(i.id);
    wirePrepCard(i, root);
    root.querySelectorAll('[data-ip-late="pp"]').forEach(el => wirePP(i, el));
    const st = P();
    root.querySelector('[data-ip="prep"]')?.addEventListener('click', () => { const c = root.querySelector('.pr6-card'); if (!c) return;
      if (c.tagName === 'DETAILS') c.open = true; c.scrollIntoView({ block: 'start', behavior: 'smooth' }); c.querySelector('summary, h2, [data-prfocus]')?.focus({ preventScroll: true }); });
    root.querySelector('[data-ip="cvlog"]')?.addEventListener('click', () => logConversation({ issueId: i.id, onDone: () => { refreshConversations(); delete TL()[i.id]; hooks.render(); } }));
    // The "…" holds the rare actions (F155); Edit is also a visible text button beside it.
    root.querySelector('[data-is="edit"]')?.addEventListener('click', () => openIssueForm(i));
    root.querySelector('[data-is="more"]')?.addEventListener('click', () => menuSheet({ title: esc(i.name), items: [
      { label: 'Edit the issue', icon: 'pencil', sub: 'Name, description, stance, between sessions, category, pre-tick', run: async () => { await afterClose(); openIssueForm(i); } },
      { label: 'Merge into another issue', icon: 'arrow-right', disabled: !!i.archived_at, reason: 'Restore it first.', sub: 'When two issues are really one', run: async () => { await afterClose(); mergeSheet(i); } },
      ...(mayPublic(i) && !i.archived_at && !isDraft(i) ? [{ label: inFirstVisit(i) ? 'Leave out of the first visit' : 'Show in the first visit', icon: inFirstVisit(i) ? 'eye-off' : 'eye',
        sub: inFirstVisit(i) ? 'Newcomers can follow it on their first visit now. People can still find it either way.' : 'Left out of a newcomer’s first visit now. People can still find and follow it.',
        run: async () => { await afterClose(); setFirstVisit(i, !inFirstVisit(i)); } }] : []),
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

// The issue frame on a staff bill page (R-340, Nate's pick D from the mockups, 26 Oct, in the topic's colour): where the
// bill sits. The issue's name (its page's link), how it stands in this page's own words (health above: On track, At risk,
// Stopped, Won), and its bills still alive as this page's cards, the page's own bill ringed as "This bill", then how many
// stopped. It replaced the bill header's "Its issue ›" link (R-226), so the bill page adds nothing (V6 density rule).
// An issue with the bill's own name says "Part of the issue of the same name" rather than the name twice (A-14).
export function issueFrameHTML(i, b) {
  const { now, earlier } = billsSplit(i), xs = now.map(placeOfBill), names = new Map();
  for (const x of xs) { const n = plain(nameWords(x.b)); names.set(n, (names.get(n) || 0) + 1); }
  for (const x of xs) x.twin = names.get(plain(nameWords(x.b))) > 1;
  const hc = health(xs, [], earlier), alive = xs.filter(x => x.alive), gone = xs.length - alive.length;
  const same = plain(i.name) === plain(b.nickname || ''), href = issueLinkHref(i, b);
  const tint = tintOf(Math.max((S.categories || []).findIndex(c => c.key === i.category), 0));
  const LEAD_IC = { ontrack: 'circle-check', risk: 'circle-alert', stopped: 'circle-minus', won: 'circle-check' };
  const pill = hc.lead ? `<span class="bw-if-pill is-${hc.k}">${icon(LEAD_IC[hc.k] || 'circle')}<span>${esc(hc.lead)}</span></span> ` : '';
  return `<section class="bw-iframe ${tint}" aria-label="Part of an issue">
    <div class="bw-if-top"><span class="bw-if-ic" aria-hidden="true">${icon(issueIcon(i))}</span>
      <div class="bw-if-m"><a class="bw-if-l" href="${esc(href)}">${same ? 'Part of the issue of the same name' : 'Part of the issue'}</a>
        ${same ? '' : `<a class="bw-if-n" href="${esc(href)}">${esc(i.name)}</a>`}
        <p class="bw-if-s">${pill}<span>${esc(hc.text)}</span></p></div>
      <a class="bw-if-go" href="${esc(href)}">Open the issue${icon('chevron-right')}</a></div>
    ${alive.length ? `<div class="bw-if-bills" role="list">${alive.map(x => billCard(x, { me: x.b.id === b.id })).join('')}</div>` : ''}
    ${gone ? `<p class="bw-if-more">${esc(plural(gone, alive.length ? 'more bill' : 'bill'))} on it stopped</p>` : ''}
  </section>`;
}
