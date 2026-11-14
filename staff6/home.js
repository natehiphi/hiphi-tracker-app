// Home (#/), version C (R-397, Nate 13 Nov: "a much simpler staff tracker"). Only three things are obvious here:
//   1. Your steps: the viewer's own hearing-ask and testimony steps, soonest first, one button each (today.js's own items and
//      buttons, so Resubmit, File, Review and Email the chairs do exactly what they do on Today);
//   2. What changed: the last 7 days, newest first: testimony approved or sent back by an approver, and a hearing newly set on a
//      bill in the viewer's issues, so testimony is now due;
//   3. Your issues: one card each for the issues the viewer leads or follows, one line per live bill (where it is, whose move).
// Nothing else: no Getting started, no season cards, no outreach, no waiting-on-others. Drawn only with ?vc=1 (app.js); the
// styles are css/vc.css, all under html.vc. The step's own "Done / Next" banner is Today's (steps.js stepDone returns to #/).
import { S, DEMO, hooks, esc } from './data.js';
import today, { work, t6Groups, t6Fresh, t6ByTime, t6Banner, t6JobOf, t6Words, T6JOB, vbJobButton } from './today.js';
import { billStep, shownStatus, itemRow, numWords, nameWords, dayWords, timeWords, wireSteps, sayWords } from './steps.js';
import { billById, billRoute, diedish, agoWords } from './model.js';
import { icon, btn } from './ui.js';
import { issuesOfBill } from './issues.js';
import { isPos } from './standing.js';
import { issueStatusB, billPhrase, vcStatusPill } from './myviews.js';
import { myIssues } from './myissues.js';
import { ibNoteOf, ibSentNote, ibActorOf, ibFirstPart, ibSandbox } from './inbox.js';
import { issueIcon, icCls, icEdge } from './issuegrid.js';

const DAY = 864e5, HR = 36e5;
const ms = t => t ? new Date(t).getTime() : null;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const lower = t => t ? t[0].toLowerCase() + t.slice(1) : t;
const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
const first = id => String((S.advocates || []).find(a => a.id === id)?.full_name || '').split(' ')[0] || 'Someone';
const HST = { timeZone: 'Pacific/Honolulu' };

// The kinds of step Home shows (testimony and the ask for a hearing); every other kind of item stays on its own page.
const KEEP = new Set(['nodraft', 'write', 'submit', 'revise', 'approve', 'second', 'file', 'missed', 'stale', 'chair', 'followask']);

// ---- the words ----
// What to do, as a short command: the row's name (the bill's number is the small part beside it).
function jobName(it) {
  const k = it.kind, a = it.s?.ask;
  switch (k) {
    case 'nodraft': case 'write': return 'Write testimony';
    case 'submit': return 'Send testimony for approval';
    case 'revise': return 'Resubmit testimony';
    case 'approve': return 'Approve testimony';
    case 'second': return 'Give testimony a second look';
    case 'file': return 'File testimony';
    case 'missed': return 'Say whether testimony was filed';
    case 'stale': return 'Check your testimony';
    case 'chair': return a?.decide ? 'Ask for a vote' : a?.m?.n > 1 ? 'Ask the chairs for a hearing' : 'Ask the chair for a hearing';
    case 'followask': return 'Follow up on a hearing ask';
  }
  return T6JOB[t6JobOf(it)] || 'Next step';
}
// "You: ..." on an issue's bill line.
const youVerb = it => lower(it.kind === 'chair' ? (it.s?.ask?.decide ? 'Ask for a vote' : 'Ask the chair for a hearing') : it.kind === 'followask' ? 'Follow up with the chair' : jobName(it));

// ---- 1. Your steps ----
// Every step of the viewer's, whatever its date (they are the point of the page): Today's own rows, and the chair asks Today keeps
// off its list when more than a few are open (work().asks, a bill's ask without a row) so a card's "You: ask the chair" always
// has its step here. Soonest first.
function ownAll(w) {
  const rows = (w.own || []).filter(it => KEEP.has(it.kind) && it.b), have = new Set(rows.filter(it => it.kind === 'chair').map(it => it.b.id));
  for (const r of w.asks || []) {
    if (!r?.b || !r.s || have.has(r.b.id)) continue; have.add(r.b.id);
    let tone = 'neutral'; try { tone = shownStatus(r.s)?.tone || 'neutral'; } catch { tone = 'neutral'; }
    rows.push({ key: `ca:${r.b.id}`, kind: 'chair', b: r.b, s: r.s, at: r.by, tone });
  }
  return rows;
}
function stepItems() {
  try { return ownAll(work(S.me)).sort(t6ByTime); } catch (e) { console.error(e); return []; }
}
// The menu's count in version C is this list's own count, so the badge and "Your steps N" always agree (app.js badge).
// Many hearing asks at once (a lead can hold 15 near a lateral deadline) would bury the testimony steps: Home lists the first
// ASKS_SHOWN chair asks, soonest first, and folds the rest into one row that opens Bills That Need Hearings, so every ask is
// still one click from Home (Nate's "simple": R-397 review, KR had 18 steps). The count is the rows a person sees.
const ASKS_SHOWN = 3, isAsk = it => it.kind === 'chair' || it.kind === 'followask';
function shownSteps(items) {
  const asks = items.filter(isAsk), rest = asks.slice(ASKS_SHOWN), keep = new Set(asks.slice(0, ASKS_SHOWN));
  return { list: items.filter(it => !isAsk(it) || keep.has(it)), more: rest };
}
export const homeCount = () => { const { list, more } = shownSteps(stepItems()); return list.length + (more.length ? 1 : 0); };
// Every kept step of the viewer's, whatever its date: the issue cards say "You: ..." by it.
const allMine = () => { const m = new Map(); try { for (const it of ownAll(work(S.me))) if (!m.has(it.b.id)) m.set(it.b.id, it); } catch (e) { console.error(e); } return m; };
// The button names what it does (R-397 review): the row's own button where it has one, else a word for the kind of step.
const BTN = { nodraft: 'Write', write: 'Write', submit: 'Send', revise: 'Resubmit', approve: 'Review', second: 'Review', file: 'File', missed: 'Answer', stale: 'Check', chair: 'Email the chair', followask: 'Follow up' };
function stepRow(it, fresh) {
  const b = it.b, y = t6Words(it, S.me), issue = issuesOfBill(b.id)[0];
  // The row's own line (the time and the state, Today's words) and the issue's name: "Due today 2:00 PM · Youth mental health".
  const line = `${fresh ? '<span class="hm-new">New</span> ' : ''}${y.line}${issue ? ` <span class="hm-sep" aria-hidden="true">·</span> <span class="hm-iss">${esc(issue.name)}</span>` : ''}`;
  const button = vbJobButton(it) || btn(BTN[it.kind] || 'Open', { kind: 'secondary', sm: true, href: billRoute(b), attrs: { 'aria-label': `${BTN[it.kind] || 'Open'}: ${sayWords(b)}` } });
  return itemRow({ key: it.key, name: jobName(it), num: numWords(b), line, tone: y.tone, icon: y.icon, bold: y.bold, href: billRoute(b), button, cls: `hm-step t6-k-${it.kind}` });
}
function moreAsksRow(more) {
  const first = more.map(it => it.at).filter(Boolean).sort((a, b) => +new Date(a) - +new Date(b))[0];
  const line = first ? `The first by ${dayWords(first)}` : 'Bills of yours waiting for a hearing';
  return itemRow({ key: 'hm-more-asks', name: `Ask for hearings on ${plural(more.length, 'more bill')}`, num: '', line, href: '#/hearings/ask', button: btn('See them', { kind: 'secondary', sm: true, href: '#/hearings/ask' }), cls: 'hm-step hm-more-asks' });
}
function stepsHTML(items, freshIds) {
  const { list, more } = shownSteps(items), n = list.length + (more.length ? 1 : 0);
  const body = !items.length ? `<p class="hm-empty">Nothing for you to do right now.</p>`
    : `<div class="v6-list hm-list" role="list">${list.map(it => stepRow(it, freshIds.has(it.b.id))).join('')}${more.length ? moreAsksRow(more) : ''}</div>`;
  return `<section class="hm-sec hm-steps" aria-labelledby="hm-h-steps"><h2 class="hm-h" id="hm-h-steps">Your steps <span class="hm-n">${n}</span></h2>${body}</section>`;
}

// ---- 2. What changed ----
const SEEN = () => `hiphi_home_seen_${S.me?.id || ''}${DEMO ? '_demo' : ''}`;
function lastSeen() {   // when this person last opened Home; kept in this browser only, for the dots
  const now = Date.now();
  if (S.hmPrev == null || now - (S.hmLast || 0) > 10 * 60 * 1000) {
    let v = null; try { v = +localStorage.getItem(SEEN()) || null; } catch { v = null; }
    S.hmPrev = v ?? now - DAY;   // a first visit: what came in the last day is new
  }
  S.hmLast = now;
  try { localStorage.setItem(SEEN(), String(now)); } catch { /* private window: the dots stay for this visit */ }
  return S.hmPrev;
}
// What a change is about, in a name first: the bill's nickname, else its issue, else its short description; the number follows.
const nameOf = b => String(b.nickname || '').trim() || issuesOfBill(b.id)[0]?.name || nameWords(b);
const headOf = (b, num, what) => b ? `${nameOf(b)} ${what} · ${num}` : `${num} ${what}`;
function changes(billIds, prev) {
  const now = Date.now(), rows = [];
  // (i) testimony on the viewer's bills approved, or sent back with a note (the Inbox's own notes and words)
  for (const i of S.inbox || []) {
    const n = ibNoteOf(i)?.[0]; if (n !== 'approved' && n !== 'sentback') continue;
    const t = ms(i.at); if (t == null || t > now + HR || now - t > 7 * DAY) continue;
    const b = i.bill_id ? billById(i.bill_id) : null, num = b ? numWords(b) : String(i.bill_number || 'Testimony');
    const who = ibActorOf(i), note = n === 'sentback' ? ibSentNote(i) : '', when = agoWords(i.at, { short: true });
    const sub = n === 'sentback' ? [note ? `${who ? who + ': ' : ''}“${ibFirstPart(note)}”` : who ? `Sent back by ${who}` : '', when].filter(Boolean).join(' · ')
      : [who ? `Approved by ${who}` : 'Ready to file', when].filter(Boolean).join(' · ');
    rows.push({ t, key: i.key, href: b ? billRoute(b) : '#/inbox', bid: b?.id, head: headOf(b, num, n === 'sentback' ? 'sent back' : 'approved'), sub, fresh: !!i.unread || t > prev, ic: n === 'sentback' ? 'undo-2' : 'circle-check' });
  }
  // (ii) a hearing newly set on a bill in the viewer's issues, so testimony is due (Today's own notice rule, seven days wide)
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || !billIds.has(h.bill_id)) continue;
    const t = ms(h.notice_posted_at), at = ms(h.scheduled_at); if (t == null || t > now || now - t > 7 * DAY || at == null || at <= now) continue;
    const b = billById(h.bill_id); if (!b || b.tracked === false || !isPos(b) || diedish(b)) continue;
    let due = null; try { due = billStep(b, { viewer: S.me, h })?.due ?? null; } catch { due = null; }
    const day = d => `${dayWords(d)}, ${timeWords(d)}`;
    rows.push({ t, key: `h:${h.id}`, href: billRoute(b), bid: b.id, head: headOf(b, numWords(b), 'has a hearing'), sub: `${day(h.scheduled_at)}${due ? ` · testimony due ${day(due)}` : ''}`, fresh: t > prev, ic: 'calendar-days' });
  }
  return rows.sort((x, y) => y.t - x.t);
}
const SHOW_CHG = 5;
function changedHTML(rows) {
  const row = r => `<li><a class="hm-chg${r.fresh ? ' fresh' : ''}" href="${esc(r.href)}"><span class="hm-dot" aria-hidden="true"></span>${r.fresh ? '<span class="sr">New. </span>' : ''}<span class="hm-ctx"><b>${esc(r.head)}</b><span class="hm-sub">${esc(r.sub)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a></li>`;
  const body = rows.length ? `<ul class="hm-chgs">${rows.slice(0, SHOW_CHG).map(row).join('')}</ul>` : `<p class="hm-empty">Nothing new this week.</p>`;
  const key = rows.slice(0, SHOW_CHG).some(r => r.fresh) ? `<p class="hm-key"><span class="hm-dot on" aria-hidden="true"></span>new since you last looked</p>` : '';
  return `<section class="hm-sec hm-changed" aria-labelledby="hm-h-chg"><h2 class="hm-h" id="hm-h-chg">What changed <span class="hm-sub2">last 7 days</span></h2>${key}${body}<p class="hm-all"><a href="#/inbox">Open the Inbox<span aria-hidden="true">&nbsp;›</span></a></p></section>`;
}

// ---- 3. Your issues ----
// Whose move it is on one bill: "You: resubmit testimony", "Lauren is approving the draft", "Waiting on the Legislature".
function moveOf(b, mine) {
  const it = mine.get(b.id);
  if (it) return { you: true, text: `You: ${youVerb(it)}` };
  let s = null; try { s = billStep(b, { viewer: S.me }); } catch { s = null; }
  const wait = { text: 'Waiting on the Legislature' };
  if (!s || s.kind === 'none') return wait;
  if (s.kind === 'filed') return { text: `Testimony filed${s.h ? `, hearing ${dayWords(s.h.scheduled_at)}` : ''} · waiting on the Legislature` };
  if (s.nobody) return { text: s.kind === 'chair' ? 'No one has asked for a hearing yet' : 'No one has the testimony yet' };
  if (s.you) return { you: true, text: `You: ${s.kind === 'chair' ? 'ask the chair for a hearing' : youVerb({ kind: s.kind, s })}` };
  const ids = s.whose?.ids || [], who = ids.length ? ids.map(first).join(' and ') : cap(s.whose?.words || 'Someone'), is = ids.length > 1 ? 'are' : 'is';
  if (s.kind === 'chair') return s.ask?.key === 'waiting' ? { text: 'Waiting on the chair’s reply' } : s.ask?.key === 'ask' || s.ask?.key === 'giving' ? { text: `${who} ${is} asking the chair for a hearing` } : wait;
  const v = { nodraft: 'writing the draft', write: 'writing the draft', submit: 'finishing the draft', revise: 'revising the draft', approve: 'approving the draft', second: 'giving the draft a second look', file: 'filing the testimony', missed: 'checking whether it was filed' }[s.kind];
  return v ? { text: `${who} ${is} ${v}` } : wait;
}
const isAlive = x => !['stopped', 'none', 'off'].includes(x.state) && (x.going || []).length > 0;
const SHOW_CARDS = 4;   // the busiest four; the rest are one tap away (Home stays about a screen)
const RK = { due: -1, risk: 0, hearing: 1, track: 2, done: 3 };
function card(x, mine) {
  const i = x.i, st = issueStatusB(x), tag = x.own ? '' : 'You follow';
  const bills = (x.going || []).map(b => { const m = moveOf(b, mine);
    return `<li class="hm-bill${m.you ? ' you' : ''}"><span class="hm-bn">${esc(numWords(b))}</span><span class="hm-where">${esc(billPhrase(b).replace(/^alive in /, 'in '))}</span><span class="hm-move">${esc(m.text)}</span></li>`; }).join('');
  const gone = (x.gone || []).length ? `<p class="hm-stopped">${esc(`${plural(x.gone.length, 'bill')} stopped: ${x.gone.map(numWords).join(', ')}`)}</p>` : '';
  return `<article class="hm-card hm-s-${st.key}${icEdge(i)}" role="listitem">
    <div class="hm-ctop"><a class="hm-cname" href="#/issue/${encodeURIComponent(i.id)}?from=mine"><span class="hm-cic${icCls(i)}" aria-hidden="true">${icon(issueIcon(i))}</span><span>${esc(i.name)}</span></a>${vcStatusPill(st)}</div>
    ${tag ? `<p class="hm-tag">${tag}</p>` : ''}<ul class="hm-bills">${bills}</ul>${gone}
  </article>`;
}
function issuesHTML(list, mine) {
  const alive = list.filter(isAlive), idle = list.filter(x => !isAlive(x));
  const rank = x => RK[issueStatusB(x).key] ?? 4;
  const order = l => [...l.filter(x => x.own), ...l.filter(x => !x.own)].sort((a, b) => (a.own === b.own ? 0 : a.own ? -1 : 1) || rank(a) - rank(b) || a.i.name.localeCompare(b.i.name));
  const ord = order(alive);
  const idleLine = idle.length ? `<details class="hm-idle"><summary>${icon('chevron-down')}<span>${plural(idle.length, 'issue')} not moving</span></summary><ul class="hm-idlel">${order(idle).map(x => `<li><a href="#/issue/${encodeURIComponent(x.i.id)}?from=mine">${esc(x.i.name)}</a></li>`).join('')}</ul></details>` : '';
  const body = !list.length ? `<p class="hm-empty">No issues are yours yet. <a href="#/issues/all">Find an issue to follow</a> and it shows here.</p>` : `<div class="hm-cards" role="list">${ord.slice(0, SHOW_CARDS).map(x => card(x, mine)).join('')}</div>${ord.length > SHOW_CARDS ? `<details class="hm-more"><summary>${icon('chevron-down')}<span>Show the other ${plural(ord.length - SHOW_CARDS, 'issue')}</span></summary><div class="hm-cards" role="list">${ord.slice(SHOW_CARDS).map(x => card(x, mine)).join('')}</div></details>` : ''}${idleLine}`;
  return `<section class="hm-sec hm-issues" aria-labelledby="hm-h-iss"><h2 class="hm-h" id="hm-h-iss">Your issues <span class="hm-n">${list.length}</span></h2>${body}</section>`;
}

// ---- the page ----
// The Hearings stub (#/?place=hearings, v5's This week) still belongs to Today.
const stub = route => route?.place === 'hearings' || route?.q?.view === 'week' || route?.q?.view === 'ahead';
function render(route) {
  if (stub(route)) return today.render(route);
  const v = S.me;
  if (!v) return `<div class="hm-root"><h1 class="v6-ptitle sv-h1">Home</h1><p class="hm-empty">You are signed in, but the tracker does not know who you are. Ask your admin to add you.</p></div>`;
  t6Fresh();
  if (DEMO) { try { ibSandbox(); } catch { /* the practice inbox is optional */ } }
  let list = []; try { list = myIssues(); } catch (e) { console.error(e); }
  const steps = stepItems(), mine = allMine(), prev = lastSeen();
  const open = new Set(steps.map(it => it.b.id));
  const ids = new Set(list.flatMap(x => (x.going || []).map(b => b.id)));
  const chg = changes(ids, prev);
  let banner = ''; try { banner = t6Banner(v, steps[0] || null); } catch (e) { console.error(e); }
  return `<div class="hm-root">
    <h1 class="v6-ptitle sv-h1">Home</h1>
    ${banner ? `<div class="t6-root hm-banner">${banner}</div>` : ''}
    <div class="hm-top">${stepsHTML(steps, new Set(chg.filter(r => r.bid && open.has(r.bid) && r.fresh).map(r => r.bid)))}${changedHTML(chg.filter(r => !(r.bid && open.has(r.bid))))}</div>
    ${issuesHTML(list, mine)}
  </div>`;
}
function wire(route, root) {
  if (stub(route)) return today.wire(route, root);
  const main = root.querySelector('.hm-root'); if (!main) return;
  wireSteps(main, { after: () => hooks.render() });
}

export default {
  tab: 'today',
  title: route => stub(route) ? today.title(route) : 'Home',
  wide: route => stub(route) ? !!today.wide?.() : false,
  badge: () => today.badge(),   // the count on the sidebar's Home is still what needs the person today
  render, wire,
};
