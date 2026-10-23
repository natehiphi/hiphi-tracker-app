// R-316 W5 and W14 (live 10/22 at Nate's go, R-329). W5, the hearing push board: the bills with no hearing yet are grouped
// by the chair who must post the notice, with one email per chair that lists all of that chair's bills, and each bill says
// whether anyone has asked yet. On 16 Mar Rep. Kila, Rep. Todd and Sen. Kim would each have had three separate emails
// from Lauren. W14, a helper takes a chair ask: "Give this ask to…" makes a dated to-do on the receiver's Today ("Ask Rep.
// Kila for a hearing on HB1 (TRN)"), with the email button; the owner's row then reads "Kris is asking".
// Staff v6 (R-336 V13, V24, F79, F105, F134-F138): the same board, rebuilt as Hearings > Get hearings, ONE open board
// (askBoard below): under each deadline in words, grouped by chair, soonest notice first, each bill in one plain state:
// Ask (Email the chair, then "Did you send it?"), Ask for decision making (heard, not voted on), Waiting on a reply ("Asked
// by Kevin Mon 3/16 · no reply yet", with They replied; Follow up after 3 working days with no reply), Scheduled (a calm
// check and Say mahalo). Legislators > Who to ask draws the same board (askBoard({ scope })), so there is one board, not two
// that list different bills (X7). The v5 board's exports (chairGroupHTML, chairBoardHTML, wirePush) stay for the screens
// that still call them until each moves to askBoard.
import { S, DB, DEMO, esc, advocate } from './data.js';
import { chairMail, codesOf, askWords, billTag, billSay, billRoute, blurb, ASK_LOG, chairAskOf, chairAskMail, chairIdsOf } from './model.js';
import { askLine, askedChip, answerSheet, ASK_TODO, askTodoOf, chairsOf, chairWho, askAnotherWay, saidNoSheet, askDay, followSheet, notPushing, afterMail } from './chairask.js';   // R-316 W3
import { askWords as stepAsk, committeeName, deadlineWords, nameWords, numWords, sayWords, itemRow, nw, helpersOf, timeWords, dayWords, billStep } from './steps.js';   // v6 words (spec 5)
import { isMine, isMuted, hooks } from './data.js';
import { stopOf, whenAt, suggState, setSugg } from './model.js';
import { icon, btn, iconBtn, avatar, toast, pickerSheet, menuSheet } from './ui.js';

export const PUSH_BOARD = () => true;   // live 10/22 at Nate's go, after W3 (R-329)
export const GIVE_ASK = () => true;   // live 10/22 at Nate's go, after W3 (R-329)

const HST = { timeZone: 'Pacific/Honolulu' };
const dayAt = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const timeAt = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const firstOf = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const isMeId = id => !!id && id === S.me?.id;
// "today", "yesterday", "Mon", then "Mon 3/9": when an ask was made, said the short way.
function whenWord(t) {
  const d = hday(t), now = Date.now();
  if (d === hday(now)) return 'today';
  if (d === hday(now - 864e5)) return 'yesterday';
  return now - t < 6 * 864e5 ? new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' }) : dayAt(t);
}
export const noticeWhen = t => `${dayAt(t)}, ${timeAt(t)}`;

// The chairs' legislator ids for a committee ("HHS/CPN": both chairs).
export const chairIds = chairIdsOf;
// R-316 W3: the record is model.js chairAskOf (a conversation with the chair on the bill, with its answer once 183 is in).
export const askedOf = (b, code) => chairAskOf(b, code);
// W14: an ask handed to someone is a to-do with this title, so it shows on their Today with its due day (chairask.js now
// keeps both, since "Yes, I sent it" closes it; they are re-exported here for every screen that imported them from here).
export { ASK_TODO, askTodoOf };
// Where a bill's chair ask stands: asked, being asked by someone, or not yet.
export function askState(b, code) {
  const a = askedOf(b, code);
  if (a) return { k: 'asked', words: ASK_LOG() ? askLine(a) : `Asked by ${isMeId(a.by) ? 'you' : firstOf(a.by)} ${whenWord(a.at)}`, a, b, code };
  const t = askTodoOf(b);
  if (t && t.assignee_id) return { k: 'giving', words: isMeId(t.assignee_id) ? 'You are asking' : `${firstOf(t.assignee_id)} is asking`, t };
  return { k: 'none', words: 'Not asked yet' };
}
export const askChip = s => s.k === 'asked' && ASK_LOG() && s.b ? askedChip(s.b, s.code, s.a) : `<span class="pb-st pb-${s.k}">${icon(s.k === 'asked' ? 'check' : s.k === 'giving' ? 'user-round' : 'circle-dashed')}<span>${esc(s.words)}</span></span>`;

// The bills with no hearing under one deadline, grouped by committee (its chair or chairs), soonest ask-by first.
export function chairGroups(need) {
  const by = new Map();
  for (const x of need) { const code = x.st.committee || ''; if (!by.has(code)) by.set(code, []); by.get(code).push(x); }
  return [...by].map(([code, rows]) => {
    const aw = rows.map(x => askWords(x.st)).filter(Boolean).sort((p, q) => p.a.at - q.a.at)[0] || null;
    return { code, m: code ? chairMail(code) : null, rows, aw };
  }).sort((p, q) => (p.aw?.a.at ?? Infinity) - (q.aw?.a.at ?? Infinity) || p.code.localeCompare(q.code));
}
// The one email to a chair, listing every bill the chair holds for this deadline.
export function chairEmailHref(m, rows, dl) {
  if (ASK_LOG()) { const code = rows[0]?.st?.committee, to = m.legId ? { who: m.who, email: m.email, legId: m.legId } : null;
    const r = code && chairAskMail(code, rows.map(x => x.b), { dl, to, codes: rows.map(x => x.st.committee) }); if (r) return r.href; }
  const bs = rows.map(x => x.b), one = bs.length === 1, me = (S.me?.full_name || '').split(' ')[0];
  const line = b => `${b.bill_number}${blurb(b, 100) ? ` (${blurb(b, 100)})` : ''}`;
  const when = dl ? ` before the ${dl.label} deadline on ${new Date(dl.date + 'T12:00:00-10:00').toLocaleDateString('en-US', { ...HST, weekday: 'long', month: 'long', day: 'numeric' })}` : '';
  const body = one ? `Aloha ${m.who},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${line(bs[0])}${when}.\n\nMahalo,\n${me}`
    : `Aloha ${m.who},\n\nThe Hawaiʻi Public Health Institute asks you to schedule hearings${when} on these bills:\n\n${bs.map(b => '- ' + line(b)).join('\n')}\n\nMahalo,\n${me}`;
  const subject = one ? `Request for a hearing on ${bs[0].bill_number}` : `Request for hearings on ${bs.map(b => b.bill_number).join(', ')}`;
  return `mailto:${m.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

// The group's rows. `more(x)`: the row's "…" (its suggestion answers), `owners`: show whose bill it is (Team).
let GROUPS = new Map();   // key -> group, for the buttons
export function chairGroupHTML(g, { owners = false, more = () => '', key = '' } = {}) {
  const k = `${key}|${g.code}`; GROUPS.set(k, g);
  const st = g.rows.map(x => askState(x.b, g.code)), open = st.filter(s => s.k === 'none').length;
  const by = g.aw ? (g.aw.a.passed ? 'notice time passed' : `ask by ${g.aw.day}`) : '';
  const head = [g.m ? `<b>${esc(g.m.who)}</b>` : '<b>No chair listed</b>', esc(g.code || 'no committee yet'), esc(plural(g.rows.length, 'bill')), esc(by)].filter(Boolean).join(' · ');
  // R-316 W3: once asked, a bill leaves the email; with every bill asked the chair's line has no button (the rows say who).
  const mailRows = ASK_LOG() ? g.rows.filter((x, i) => st[i].k !== 'asked') : g.rows;
  const acts = g.m && !mailRows.length ? '' : g.m ? `${btn(g.m.n > 1 ? "Email the chairs" : g.rows.length > 1 ? `Email ${g.m.who}` : "Email the chair", { kind: 'secondary', sm: true, icon: 'mail', href: chairEmailHref(g.m, mailRows, g.rows[0].st.deadline) })}${open ? btn('Mark asked', { kind: 'text', sm: true, icon: 'check', attrs: { 'data-pbasked': k } }) : ''}${GIVE_ASK() && open ? iconBtn('ellipsis', `More for the ask to ${g.m.who}`, { 'data-pbmore': k, 'aria-haspopup': 'dialog' }, 'td-more') : ''}` : '';
  const mores = g.rows.map(x => more(x)), gap = mores.some(Boolean) ? '<span class="pb-nomore" aria-hidden="true"></span>' : '';
  const rows = g.rows.map((x, i) => { const own = owners ? avatar(advocate((S.assignments[x.b.id] || [])[0]), 20) : '';
    const nb = askWords(x.st);
    return `<li class="pb-row"><a class="pb-bill" href="${billRoute(x.b)}">${billTag(x.b, 60)}</a>${own}<span class="pb-end">${askChip(st[i])}${g.rows.length > 1 && nb && nb.day !== g.aw?.day ? `<span class="pb-by muted">by ${esc(nb.day)}</span>` : ''}${mores[i] || gap}</span></li>`; }).join('');
  return `<li class="pb-chair"><div class="pb-head"><p class="pb-who">${head}</p><div class="pb-acts">${acts}</div></div><ul class="pb-rows">${rows}</ul></li>`;
}
export const chairBoardHTML = (need, o = {}) => { const gs = chairGroups(need); return gs.length ? `<ul class="pb-board">${gs.map(g => chairGroupHTML(g, o)).join('')}</ul>` : ''; };

// Log the ask on every bill in the group not asked yet: a conversation with the chair (or both chairs), with Undo.
async function markAsked(k, el, after) {
  const g = GROUPS.get(k); if (!g) return;
  const ids = chairIds(g.code), todo = g.rows.filter(x => askState(x.b, g.code).k !== 'asked'); if (!ids.length || !todo.length) return;
  el?.setAttribute('aria-busy', 'true');
  try {
    const made = [];
    for (const x of todo) for (const id of ids) made.push([await DB.addLegNote(id, x.b.id, `Asked for a hearing on ${x.b.bill_number} (${g.code}).`, ASK_LOG() ? { answer: 'asked', committee: g.code } : {}), id]);   // one wording with logAsk
    for (const x of todo) { const t = askTodoOf(x.b); if (t && isMeId(t.assignee_id)) await DB.updateTodo(x.b.id, t.id, { done: true }); }
    toast(`Marked asked: ${todo.length === 1 ? sayWords(todo[0].b) : plural(todo.length, 'bill')} with ${g.m?.who || 'the chair'}. The team sees it on ${todo.length === 1 ? 'the bill' : 'each bill'}.`,
      { ok: true, undo: async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); after(); } });
    after();
  } catch (e) { toast(e, { err: true }); } finally { el?.removeAttribute('aria-busy'); }
}
// Two working days before a moment, as a day ("2026-03-23"), and never before today.
function handDue(t) {
  let d = new Date(hday(t) + 'T12:00:00-10:00').getTime(), k = 0;
  while (k < 2) { d -= 864e5; const dow = new Date(d).getUTCDay(); if (dow !== 0 && dow !== 6) k++; }
  return hday(Math.max(d, Date.now()));
}
// W14: hand the ask to a teammate (or take it): a dated to-do on each of the group's bills not asked yet, due 2 working days
// before the first notice must post (V24). Someone given a to-do gets a Slack message from the database (064), as Give to… on any to-do.
export async function assignAsk(rows, code, id, after) {
  const m = chairMail(code), aw = rows.map(x => askWords(x.st)).filter(Boolean).sort((p, q) => p.a.at - q.a.at)[0];
  // V24: a handed-off ask is due 2 working days before the notice must post (it was due the notice day, 8.5 hours after
  // the notice time on 16 Mar), never before today.
  const due = aw && !aw.a.passed ? handDue(aw.a.at) : null, who = m ? m.who : 'the chair', made = [];
  try {
    for (const x of rows) {
      const was = askTodoOf(x.b);
      if (was) { made.push({ b: x.b, t: was, prev: { assignee_id: was.assignee_id, due_date: was.due_date } }); await DB.updateTodo(x.b.id, was.id, { assignee_id: id, due_date: due }); continue; }
      await DB.addTodo(x.b.id, `Ask ${who} for a hearing on ${x.b.bill_number} (${code})`);
      const t = (S.todos[x.b.id] || []).at(-1); await DB.updateTodo(x.b.id, t.id, { assignee_id: id, due_date: due }); made.push({ b: x.b, t, prev: null });
    }
    const undo = async () => { for (const z of made) await DB.updateTodo(z.b.id, z.t.id, z.prev || { done: true }); after(); };
    const by = due ? askDay(due + 'T12:00:00-10:00') : '';
    toast(isMeId(id) ? `It is yours: ask ${who}${by ? ` by ${by}` : ''}. It is on your Today.` : `${firstOf(id)} has it now and gets a Slack message. The ask is on ${firstOf(id)}’s Today${by ? ` for ${by}` : ''}.`, { ok: true, undo });
    after();
  } catch (e) { toast(e, { err: true }); }
}
export function giveAsk(rows, code, after) {
  const m = chairMail(code), aw = rows.map(x => askWords(x.st)).filter(Boolean).sort((p, q) => p.a.at - q.a.at)[0];
  const people = (S.advocates || []).filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: `Who should ask ${esc(m ? m.who : 'the chair')}?`, value: '', help: esc(`${rows.length === 1 ? sayWords(rows[0].b) : plural(rows.length, 'bill')}${aw && !aw.a.passed ? ` · ask by ${aw.day}` : ''}`),
    options: people.map(a => [a.id, a.id === S.me?.id ? 'You' : a.full_name, a.id === S.me?.id ? 'user-check' : 'user-round', a.id === S.me?.id ? 'I’ll ask' : '']),
    onPick: id => assignAsk(rows, code, id, after) });
}
// The asker's Done on an ask to-do is the ask made: it is logged with the chair, so everyone's row says "Asked by Kris".
export async function logAsk(b, code) {
  const made = []; for (const id of chairIds(code)) made.push([await DB.addLegNote(id, b.id, `Asked for a hearing on ${b.bill_number} (${code}).`, ASK_LOG() ? { answer: 'asked', committee: code } : {}), id]);
  return async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); };
}
export function wirePush(root, after) {
  // R-316 W3: Mark asked opens the same one-tap answers as "Did you send it?" (one way to say it, ui-critic M3).
  root.querySelectorAll('[data-pbasked]').forEach(el => el.onclick = () => { const g = GROUPS.get(el.dataset.pbasked);
    if (ASK_LOG() && g) return answerSheet(g.rows.filter(x => askState(x.b, g.code).k === 'none').map(x => x.b.id), g.code);
    markAsked(el.dataset.pbasked, el, after); });
  // Two actions on the chair's line (A-20): the email and Mark asked; handing the ask on is in its "…".
  root.querySelectorAll('[data-pbmore]').forEach(el => el.onclick = () => { const g = GROUPS.get(el.dataset.pbmore); if (!g) return;
    menuSheet({ title: esc(`The ask to ${g.m?.who || 'the chair'}`), items: [{ label: 'Give this ask to…', icon: 'user-round', sub: 'It lands on their Today with the email button', run: () => giveAsk(g.rows.filter(x => askState(x.b, g.code).k === 'none'), g.code, after) }] }); });
}
// A new draw: forget the last one's groups.
export const resetPush = () => { GROUPS = new Map(); };

// ==== Staff v6: Hearings > Get hearings, the one board (R-336 V13, V24, R-329) ====
// Whose bills a view covers (the visible scope switch, spec 6): mine (owned, followed or on my issue, not muted), my
// coalitions' (helpers: Patti on HEAL, Kris on all of them), or the team's (leads, and anyone who wants the whole picture).
export function coalOf(a = S.me) {
  const c = a?.prefs?.coalitions;
  if (c === 'all') return { all: true, ids: new Set((S.campaigns || []).map(x => x.id)), names: [] };
  const ids = Array.isArray(c) ? c.filter(id => (S.campaigns || []).some(x => x.id === id)) : [];
  return ids.length ? { all: false, ids: new Set(ids), names: ids.map(id => S.campaigns.find(x => x.id === id).name) } : null;
}
const inCoal = (b, co) => !!co && (S.billCampaigns?.[b.id] || []).some(id => co.ids.has(id));
export const SCOPES = { mine: 'My bills', coal: 'My coalitions', team: 'Team' };
// My bills holds every bill the person has a step on, not only the ones they own or follow (critic, B-6): Patti writes
// SB 3234 for Lauren, so its hearing and its ask are hers under My bills, where they were missing ("No hearings on your
// bills this week" while her Resubmit was due that morning). A step: she writes, approves or files its testimony, was
// handed its chair ask or asked the chair, or is going to its hearing. Worked out once per draw (billStep is not free):
// the page clears it when it draws, and it lapses after a moment for a screen that does not (Legislators' Who to ask).
let INV = null;
export const freshScope = () => { INV = null; };
function involved(b, v) {
  if (!v || !b || b.tracked === false || isMuted(b)) return false;
  if (!INV || INV.v !== v.id || Date.now() - INV.at > 1500) INV = { v: v.id, at: Date.now(), m: new Map() };
  if (INV.m.has(b.id)) return INV.m.get(b.id);
  let r = false;
  try { r = !!billStep(b, { viewer: v })?.you; } catch { r = false; }
  if (!r) { const now = Date.now(); r = (S.hearings || []).some(h => h.bill_id === b.id && h.status !== 'cancelled' && new Date(h.scheduled_at).getTime() > now - 2 * 36e5 && (S.attend?.[h.id] || []).includes(v.id)); }
  INV.m.set(b.id, r); return r;
}
const owns = v => !!v && (S.bills || []).some(b => (S.assignments?.[b.id] || []).includes(v.id));
// The switch's choices for this person: My bills only for someone with bills or steps, My coalitions only for a helper.
export function scopesFor(v = S.me) {
  const out = [];
  if ((S.bills || []).some(b => isMine(b) || involved(b, v))) out.push(['mine', SCOPES.mine]);
  if (coalOf(v)) out.push(['coal', SCOPES.coal]);
  out.push(['team', SCOPES.team]);
  return out;
}
// The view a person opens on (spec 6): an owner's own bills; a helper who owns none (Patti, Kris, Julie, Saya), their
// coalitions'; else whatever they follow; else the team's.
export function defaultScope(v = S.me) {
  const ok = scopesFor(v).map(x => x[0]), owns = !!v && (S.bills || []).some(b => (S.assignments?.[b.id] || []).includes(v.id));
  return owns && ok.includes('mine') ? 'mine' : ok.includes('coal') ? 'coal' : ok[0];
}
// My coalitions keeps the helper's own bills too (a bill on their issue, one they follow), so nothing of theirs leaves.
export function scopeOk(scope, v = S.me) {
  const co = coalOf(v);
  return scope === 'team' ? b => b.tracked !== false : scope === 'coal' ? b => b.tracked !== false && (inCoal(b, co) || isMine(b)) : b => isMine(b) || involved(b, v);
}
// "3 of your bills", "3 HEAL bills", "49 of your coalitions' bills", "36 of the team's bills", "2 of the bills you follow
// or work on" (someone who owns none: My bills is then not "theirs", A-14)
export const countWords = (n, scope, v = S.me) => { const w = whoseWords(scope, v); return `${n} ${/^(your|the) /.test(w) ? 'of ' : ''}${w}`; };
export function whoseWords(scope, v = S.me) {
  if (scope === 'team') return 'the team’s bills';
  if (scope === 'coal') { const co = coalOf(v); return co && !co.all ? `${co.names.join(' and ')} bills` : 'your coalitions’ bills'; }
  return owns(v) ? 'your bills' : 'the bills you follow or work on';
}

// Who may act on a bill's ask (its buttons): its owner, a helper on its coalition, whoever was handed it, whoever asked,
// and admins. Anyone else reads where it stands and opens the bill (spec 7.5: every action has one home).
function actsOn(b, it, v, scope = 'mine') {
  if (!v) return false;
  if (scope !== 'team') return true;   // My bills and My coalitions are the person's own board
  if (v.is_admin || (S.assignments?.[b.id] || []).includes(v.id) || helpersOf(b).includes(v.id)) return true;
  if (v.prefs?.coalitions === 'all') return true;   // Kris helps every coalition
  return it.a?.todo?.assignee_id === v.id || it.a?.asker === v.id;
}
const ms = t => t == null ? null : typeof t === 'number' ? t : new Date(t).getTime();
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// The state a bill is in on the board. k: ask · decide (heard, waiting for decision making: F105) · giving (handed to
// someone) · follow (no reply in 3 working days, or 2 before the notice) · waiting · will (will schedule) · said_no ·
// passed (the notice time is gone) · scheduled (asked, and the hearing posted: Say mahalo) · later (put off by this person
// for two weeks, from the row's "…": it stays on the board, quiet and last, out of the email and the counts, never hidden).
const ORDER = { ask: 0, decide: 1, giving: 2, follow: 3, waiting: 4, said_no: 5, will: 6, later: 7, passed: 8, scheduled: 9 };
// "Not now" on a bill's ask keeps v5's record (the chair suggestion's key in the person's settings, two weeks), so a bill
// put off in either app stays put off in both.
const LATER = 14 * 864e5;
const laterKey = (b, dl) => `sg:chair:${b.id}:${dl.date}`;
function laterUntil(b, dl) { const s = suggState()[laterKey(b, dl)]; return s?.state === 'later' && Date.now() - (s.at || 0) < LATER ? (s.at || 0) + LATER : null; }
export function boardItem(b, v = S.me) {
  const a = stepAsk(b, { viewer: v }); if (!a) return null;
  if (a.key === 'scheduled') {
    const asked = chairAskOf(b, a.code); if (!asked) return null;   // only the asks that worked: the "it worked" moment
    const st = stopOf(b); if (!st.deadline) return null;
    return { b, a, k: 'scheduled', code: a.code, dl: st.deadline, at: ms(a.h.scheduled_at), asked, chairs: [] };
  }
  const st = a.st, chairs = chairsOf(b, a.code), joint = chairs.length > 1;
  let k = a.key === 'ask' ? (a.decide ? 'decide' : 'ask') : a.key === 'waiting' ? (a.answer === 'will_schedule' ? 'will' : a.followUp ? 'follow' : 'waiting') : a.key;
  // V24: one chair of a joint committee asked, the other not: the other is still to ask (and only the other is emailed).
  const left = joint && ['waiting', 'follow'].includes(k) ? chairs.filter(c => !c.asked) : [];
  if (left.length) k = a.decide ? 'decide' : 'ask';
  const until = k === 'ask' && !left.length ? laterUntil(b, st.deadline) : null; if (until) k = 'later';
  return { b, a, k, code: a.code, dl: st.deadline, at: a.aw?.a.at ?? ms(st.deadline.date + 'T23:59:59-10:00'), chairs, left, decide: !!a.decide, until };
}
// The board's bills for a scope (or a given list), as items.
export function boardItems({ scope = defaultScope(), bills = null, viewer = S.me } = {}) {
  const ok = scopeOk(scope, viewer);
  return (bills || (S.bills || []).filter(ok)).map(b => boardItem(b, viewer)).filter(Boolean);
}
// "3 of your bills need a hearing · ask the first chair by Wed 3/25": the one-line summary This week and Today's D1 row say
// (TODAY may call it). Counts the bills still to ask or waiting (not the scheduled ones, nor the ones put off for now).
// The ask-by day is the board's own word for it ("ask by Tue 3/24"), not the Capitol's "first notice" (C-10, one name per fact).
export function askSummary({ scope = defaultScope(), viewer = S.me } = {}) {
  const open = boardItems({ scope, viewer }).filter(x => x.k !== 'scheduled' && x.k !== 'later');
  if (!open.length) return null;
  const fx = open.filter(x => ['ask', 'decide', 'giving'].includes(x.k) && x.a.aw?.a.at && !x.a.aw.a.passed).sort((p, q) => p.a.aw.a.at - q.a.aw.a.at)[0] || null;
  const first = fx ? fx.a.aw.a.notice || fx.a.aw.a.at : null;
  const dl = open.map(x => x.dl).sort((p, q) => p.date.localeCompare(q.date))[0];
  const n = open.length, toAsk = open.filter(x => ['ask', 'decide'].includes(x.k)).length;
  return { n, toAsk, first, dl, words: `${countWords(n, scope, viewer)} ${n === 1 ? 'needs' : 'need'} a hearing`, firstWords: fx ? `ask the first chair by ${fx.a.aw.day}` : '' };
}

// Each row's one line (V19: the same words as the step card and Today) and its icon.
// `shared`: every bill under this deadline is one teammate's, and the deadline's line says so once, so no row repeats
// "Lauren's bill" (A-14). `hdrMine`: the chair's line already gives the viewer's own ask-by day, so the row does not.
function rowLine(it, v, scope, { shared = false, hdrMine = false } = {}) {
  const { b, a, k } = it, own = (S.assignments?.[b.id] || [])[0], whose = own && own !== v?.id && !shared ? ` · ${advocate(own)?.full_name.split(' ')[0] || 'someone'}’s bill` : '';
  const asked = c => `asked ${c.who} ${askDay(c.asked.at)}`;
  switch (k) {
    case 'ask': return it.left?.length ? [`${cap(it.chairs.filter(c => c.asked).map(asked).join(', '))} · ${it.left.map(c => c.who).join(' and ')} not asked yet`, 'circle-dashed']
      : [`Not asked yet${whose}`, 'circle-dashed'];
    case 'later': return [`Not now · back on your list ${askDay(it.until)}${whose}`, 'clock'];
    case 'decide': return [`Heard, not voted on · ask for decision making${a.day ? ` by ${a.day}` : ''}${whose}`, 'gavel'];
    // The handed-off ask's own day (2 working days before the notice, V24), said as the asker's ("Kris asks by Fri 3/20"),
    // so it never reads as a second deadline beside the chair's "ask by Tue 3/24" (A-14, one word per fact).
    case 'giving': { const due = a.todo?.due_date, me = a.todo?.assignee_id === v?.id, who = me ? 'You' : advocate(a.todo?.assignee_id)?.full_name.split(' ')[0] || 'Someone';
      if (me && hdrMine) return ['You are asking', 'user-round'];
      return [due ? `${who} ${me ? 'ask' : 'asks'} by ${askDay(due + 'T12:00:00-10:00')}` : a.words, 'user-round']; }
    case 'follow': return [`${a.words} · time to follow up`, 'clock'];
    case 'waiting': return [a.words, 'hourglass'];
    case 'will': return [a.words, 'calendar-check'];
    case 'said_no': return [a.words, 'circle-x'];
    case 'passed': return [a.words, 'circle-alert'];
    case 'scheduled': return [`Scheduled · ${committeeName(a.code) || a.code} ${whenAt(a.h.scheduled_at)}`, 'circle-check'];
  }
  return [a.words || '', ''];
}
const mailBtn = (label, href, kind = 'secondary', aria = '') => btn(esc(label), { kind, sm: true, icon: 'mail', href, attrs: aria ? { 'aria-label': aria } : undefined });
// The bill's own people: its owner, or an admin. They email the chair straight away; a helper says "I'll ask" first, so two
// people never ask one chair about one bill (R-329, V24, critic P-4).
const ownsBill = (b, v) => !!v && (!!v.is_admin || (S.assignments?.[b.id] || []).includes(v.id));
// A row's one button (D16): only where this row has a step of its own that the group's buttons do not cover. A bill still to
// ask has a "…" instead, for its owner: this bill alone in the email, Not now, Not pushing this bill (rule 7.3: rare, and
// each also on the bill page).
function rowButton(it, v, scope) {
  const { b, a, k, code } = it; if (!actsOn(b, it, v, scope)) return '';
  const name = numWords(b);
  if (k === 'decide') { if (!ownsBill(b, v)) return '';
    const r = chairAskMail(code, [b], { dl: a.st.deadline, heardAt: a.st.hearing?.scheduled_at || new Date().toISOString() });
    return r ? mailBtn(r.m.n > 1 ? 'Email the chairs' : 'Email the chair', r.href, 'secondary', `Email ${r.m.who} for decision making on ${name}`) : ''; }
  // The asker's Follow up holds both ways on (spec 8, F136: the reply in 2 clicks): the mail again, or the chair's reply.
  if (k === 'follow' && a.asker === v.id) return btn('Follow up', { kind: 'secondary', sm: true, icon: 'clock', attrs: { 'data-hgact': 'follow', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog', 'aria-label': `Follow up: ${name}` } });
  if (['waiting', 'follow'].includes(k)) return btn('They replied', { kind: 'secondary', sm: true, icon: 'message-square', attrs: { 'data-v6act': 'replied', 'data-v6b': b.id, 'data-v6code': code, 'aria-haspopup': 'dialog', 'aria-label': `They replied: ${name}` } });
  if ((k === 'ask' && !it.left?.length || k === 'later') && ownsBill(b, v)) return iconBtn('ellipsis', `More for ${name}`, { 'data-hgact': 'row', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog' }, 'hg-more');
  if (k === 'said_no') return btn('Next steps', { kind: 'secondary', sm: true, icon: 'arrow-right', attrs: { 'data-hgact': 'next', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog', 'aria-label': `Next steps: ${name}` } });
  // "Say mahalo" once the hearing posts (spec 6): your own mail, a subject only, the words yours (no new wording to approve).
  if (k === 'scheduled' && (it.asked.by === v.id || (S.assignments?.[b.id] || []).includes(v.id))) {
    const m = chairMail(code); if (m) return btn('Say mahalo', { kind: 'text', sm: true, icon: 'heart-handshake', href: `mailto:${m.email}?subject=${encodeURIComponent(`Mahalo for scheduling ${b.bill_number}`)}`, attrs: { 'aria-label': `Say mahalo to ${m.who} for scheduling ${name}` } });
  }
  return '';
}

let BOARD = new Map();   // group key -> group, for the delegated buttons below
// An ask handed to this person: theirs to make (their Email, then "Did you send it?", closes it).
const mineGiven = (x, v) => x.k === 'giving' && x.a.todo?.assignee_id === v?.id;
// What this person can do on one chair's group (critic P-4, A-20: two actions at most on the chair's line):
//   mail  - the bills they email the chair about: their own (owner or admin) still to ask, and any ask handed to them;
//   give  - their own bills still to ask, which they may hand on ("Give this ask to…");
//   claim - someone else's bills still to ask, which a helper takes first ("I'll ask"), so two people never ask one chair;
//   log   - every ask that is theirs to make (their own bills, or one handed to them), for "Asked by phone or in person?
//           Log it" at the group's foot (F138). A helper sees it once "I'll ask" has made the ask hers (critic P-4: one
//           action on a teammate's group), so Kris's 25 groups are not 25 feet.
// A bill put off ("Not now") is in none of them: it is out of the email until it comes back.
function groupRoles(g, v, scope) {
  const can = x => actsOn(x.b, x, v, scope);
  return {
    mail: g.rows.filter(x => (x.k === 'ask' && ownsBill(x.b, v) && can(x)) || mineGiven(x, v)),
    give: g.rows.filter(x => x.k === 'ask' && ownsBill(x.b, v) && can(x)),
    claim: g.rows.filter(x => x.k === 'ask' && !ownsBill(x.b, v) && can(x)),
    log: g.rows.filter(x => ((['ask', 'decide'].includes(x.k) && ownsBill(x.b, v)) || mineGiven(x, v)) && can(x)),
  };
}
// One chair's group: the chair (or both chairs of a joint referral) and the committee in words, the day to ask by, its
// buttons (an owner: Email the chair and Give this ask to…; a helper: I'll ask, then Email the chair once it is theirs),
// its bills, one row each, and a quiet "Asked by phone or in person? Log it" at its foot.
function groupHTML(g, v, scope, { primary, shared }) {
  const R = groupRoles(g, v, scope);
  const m = chairMail(g.code), day = g.rows.find(x => x.a.aw && !x.a.aw.a.passed)?.a.aw.day;
  // When every ask still open here is one handed to this person, the chair's line gives their own day (two working days
  // before the notice, V24), and the rows do not repeat it (A-14: one deadline per ask).
  const open = g.rows.filter(x => ['ask', 'decide', 'giving'].includes(x.k));
  const mineDue = open.length && open.every(x => mineGiven(x, v)) ? open.map(x => x.a.todo?.due_date).filter(Boolean).sort()[0] || null : null;
  // One email per set of chairs still to ask (V24): both chairs of a joint referral normally; the one left when the other was asked.
  const parts = new Map();
  for (const x of R.mail) { const left = x.left?.length ? x.left : null, key = left ? left.map(c => c.id).join(',') : '*'; if (!parts.has(key)) parts.set(key, { left, rows: [] }); parts.get(key).rows.push(x); }
  let first = primary;
  const mails = [...parts.values()].map(p => {
    const to = p.left?.length === 1 ? { who: p.left[0].who, email: p.left[0].email, legId: p.left[0].id } : null;
    const r = chairAskMail(g.code, p.rows.map(x => x.b), { dl: p.rows[0].dl, to, codes: p.rows.map(x => x.code) }); if (!r) return '';
    const label = to ? `Email ${to.who}` : r.m.n > 1 ? 'Email the chairs' : 'Email the chair', kind = first ? 'primary' : 'secondary'; first = false;
    return mailBtn(label, r.href, kind, `${label}${to ? '' : ` (${r.m.who})`} about ${p.rows.length === 1 ? numWords(p.rows[0].b) : `${p.rows.length} bills`}`);
  }).join('');
  const acts = `${mails}${R.give.length ? btn('Give this ask to…', { kind: 'text', sm: true, attrs: { 'data-hgact': 'give', 'data-hgk': g.key, 'aria-haspopup': 'dialog' } }) : ''}${R.claim.length
    ? btn('I’ll ask', { kind: 'secondary', sm: true, icon: 'user-check', attrs: { 'data-hgact': 'mine', 'data-hgk': g.key, 'aria-label': `I’ll ask ${m ? m.who : 'the chair'} about ${R.claim.length === 1 ? numWords(R.claim[0].b) : `${R.claim.length} bills`}` } }) : ''}`;
  const who = m ? m.who : 'No chair listed yet', cn = committeeName(g.code) || g.code;
  const foot = R.log.length ? `<p class="hg-log"><span>Asked by phone or in person?</span>${btn('Log it', { kind: 'text', sm: true, attrs: { 'data-hgact': 'another', 'data-hgk': g.key, 'aria-haspopup': 'dialog', 'aria-label': `Log an ask to ${who} made by phone, in person or another way` } })}</p>` : '';
  const rows = g.rows.map(x => { const [line, ic] = rowLine(x, v, scope, { shared, hdrMine: !!mineDue }), mine = ['follow', 'giving'].includes(x.k) && (x.a.asker === v?.id || x.a.todo?.assignee_id === v?.id);
    return itemRow({ key: x.b.id, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(line)), icon: ic, tone: x.k === 'scheduled' ? 'done' : '', bold: mine, href: billRoute(x.b), button: rowButton(x, v, scope), cls: `hg-r k-${x.k}` }); }).join('');
  const when = mineDue ? `you ask by ${askDay(mineDue + 'T12:00:00-10:00')}` : day ? `ask by ${day}` : g.rows.every(x => x.k === 'scheduled') ? 'scheduled' : '';
  return `<section class="hg-chair" aria-labelledby="hg-c-${esc(g.id)}">
    <div class="hg-chead"><div class="hg-cwho"><h3 class="hg-cname" id="hg-c-${esc(g.id)}">${esc(who)}</h3><p class="hg-csub">${nw(esc([cn, when].filter(Boolean).join(' · ')))}</p></div>${acts ? `<div class="hg-cacts">${acts}</div>` : ''}</div>
    <div class="v6-list hg-list" role="list" aria-label="${esc(`Bills for ${who}`)}">${rows}</div>${foot}</section>`;
}
// askBoard({ scope, bills, viewer, primary, id, empty }) -> the board's HTML: under each deadline (soonest first) in words,
// "Must reach their last committee by Mon 3/30", with how many are to ask, being asked, waiting and scheduled, then each
// chair's group, soonest notice first. Nothing is folded (V13: one open board). LEGISLATORS' Who to ask calls this with
// `primary: false` when another filled button owns its screen; buttons need no wiring (one document listener, below, and
// steps.js's).
export function askBoard({ scope = defaultScope(), bills = null, viewer = S.me, primary = true, id = 'hg', empty = null } = {}) {
  BOARD = new Map();
  const v = viewer, items = boardItems({ scope, bills, viewer: v });
  if (!items.length) return empty ?? `<p class="hg-empty">${icon('circle-check')}<span>${esc(scope === 'team' ? 'No bill of the team’s is waiting for a hearing right now.' : `None of ${whoseWords(scope, v)} is waiting for a hearing right now.`)}</span></p>`;
  const dls = new Map();
  for (const x of items) { const k = x.dl.date; if (!dls.has(k)) dls.set(k, { dl: x.dl, groups: new Map(), items: [] }); const d = dls.get(k); d.items.push(x);
    if (!d.groups.has(x.code)) d.groups.set(x.code, []); d.groups.get(x.code).push(x); }
  let n = 0;
  const secs = [...dls.values()].sort((p, q) => p.dl.date.localeCompare(q.dl.date)).map(d => {
    const hid = `${id}-d${n++}`;
    const groups = [...d.groups].map(([code, rows]) => ({ code, rows: rows.sort((p, q) => ORDER[p.k] - ORDER[q.k] || p.b.bill_number.localeCompare(q.b.bill_number, 'en', { numeric: true })),
      at: Math.min(...rows.map(x => ['scheduled', 'later'].includes(x.k) ? Infinity : x.at)) }))
      .sort((p, q) => p.at - q.at || p.code.localeCompare(q.code))
      .map((g, i) => { const key = `${d.dl.date}|${g.code}`, gid = `${hid}-${i}`; const gg = { ...g, key, id: gid, dl: d.dl, scope }; BOARD.set(key, gg); return gg; });
    return { d, hid, groups };
  });
  // The screen's one filled button (rule 7.1, A-3): the email for an ask handed to this person first (what they just took
  // on keeps the focus: critic A-13), else the first chair this person emails about their own bills. A helper with nothing
  // taken on yet has none: "I'll ask" is tonal, and the filled button would invite asking a teammate's chair unannounced.
  const all = secs.flatMap(s => s.groups);
  const pkey = !primary ? null : (all.find(g => g.rows.some(x => mineGiven(x, v))) || all.find(g => groupRoles(g, v, scope).mail.length))?.key || null;
  const out = secs.map(({ d, hid, groups }) => {
    const c = k => d.items.filter(x => k.includes(x.k)).length, toAsk = c(['ask', 'decide']), being = c(['giving']), wait = c(['waiting', 'follow']), yes = c(['will']), later = c(['later']), no = c(['said_no', 'passed']), sch = c(['scheduled']);
    const total = d.items.length, nw0 = d.items.filter(x => !['scheduled', 'later'].includes(x.k)).length;
    // Every bill here one teammate's: said once on this line ("16 of Lauren's bills"), not on every row (A-14).
    const owners = new Set(d.items.map(x => (S.assignments?.[x.b.id] || [])[0] || '')), only = owners.size === 1 ? [...owners][0] : '';
    const shared = !!only && only !== v?.id && !!advocate(only);
    const whose = shared ? `${nw0} of ${advocate(only).full_name.split(' ')[0]}’s bills` : countWords(nw0, scope, v);
    const head = cap(deadlineWords(d.dl.label, d.dl.date, { n: total }));
    const sub = [nw0 ? `${whose} ${nw0 === 1 ? 'needs' : 'need'} a hearing` : '',
      // "will schedule": the chair replied (so not "waiting on a reply", B-7), in the rows' own words (spec 5)
      toAsk ? `${toAsk} to ask` : '', being ? `${being} being asked` : '', wait ? `${wait} waiting on a reply` : '', yes ? `${yes} will schedule` : '', later ? `${later} put off` : '', no ? `${no} said no or out of time` : '', sch ? `${sch} scheduled` : ''].filter(Boolean).join(' · ');
    const body = groups.map(g => groupHTML(g, v, scope, { primary: g.key === pkey, shared })).join('');
    return `<section class="hg-dl" aria-labelledby="${hid}"><div class="hg-dlh"><h2 id="${hid}">${esc(head)}</h2>${sub ? `<p class="hg-dls">${nw(esc(sub))}</p>` : ''}</div>${body}</section>`;
  }).join('');
  return `<div class="hg-board" data-hgboard="${esc(id)}">${out}</div>`;
}
// A row's "…" (an owner's bill still to ask, or one put off): this bill alone in the email, when the chair's email names
// others; Not now (back in two weeks, with Undo); Ask now (for one put off); Not pushing this bill (its owner: the bill
// page's Mute, said for a bill waiting for a hearing, V24). Every one of these also lives on the bill page (rule 7.3).
function rowMenu(b, code) {
  const g = [...BOARD.values()].find(x => x.code === code && x.rows.some(r => r.b.id === b.id)), it = g?.rows.find(r => r.b.id === b.id); if (!it) return;
  const v = S.me, R = groupRoles(g, v, g.scope), name = sayWords(b), key = laterKey(b, it.dl), m = chairMail(code);
  const back = askDay(Date.now() + LATER), owner = (S.assignments?.[b.id] || []).includes(v?.id);
  const alone = it.k === 'ask' && R.mail.length > 1 ? chairAskMail(code, [b], { dl: it.dl }) : null;
  const before = { ...suggState() };
  const putBack = async () => { await DB.patchPrefs({ sugg: before }); after(); };
  menuSheet({ title: esc(name), items: [
    alone ? { label: `Email ${alone.m.n > 1 ? 'the chairs' : 'the chair'} about this bill only`, icon: 'mail', sub: `Your mail to ${alone.m.who}, already written, for ${numWords(b)} alone`, run: () => { location.href = alone.href; afterMail(alone.href); } } : null,
    // Two weeks may run past the day to ask by: said, so "Not now" is never a quiet way to miss it (B-7).
    it.k === 'ask' ? { label: 'Not now', icon: 'clock', sub: `Out of the email and the counts until ${back}${it.a.aw && !it.a.aw.a.passed && Date.now() + LATER > it.a.aw.a.at ? `, after its ask-by day, ${it.a.aw.day}` : ''}. It stays here, at the end.`, run: async () => {
      try { await setSugg(key, 'later'); } catch (e) { toast(e, { err: true }); return; }
      after(); toast(`Not now: ${name} is back on your list ${back}.`, { undo: putBack }); } } : null,
    it.k === 'later' ? { label: 'Ask now', icon: 'rotate-ccw', sub: `Back with the bills to ask ${m ? m.who : 'the chair'} about`, run: async () => {
      const rest = { ...suggState() }; delete rest[key];
      try { await DB.patchPrefs({ sugg: rest }); } catch (e) { toast(e, { err: true }); return; }
      after(); toast(`${name} is back with the bills to ask.`, { ok: true, undo: putBack }); } } : null,
    owner ? { label: 'Not pushing this bill', icon: 'bell-off', sub: 'Off your lists and alerts until it gets a hearing', run: () => notPushing(b) } : null,
  ] });
}
// The board's own buttons, delegated once for the whole app (as steps.js and chairask.js do), so a screen that draws the
// board wires nothing. After an action the page redraws (hooks.render), with the action's Undo in its toast.
const after = () => hooks.render();
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const el = e.target?.closest?.('[data-hgact]'); if (!el) return;
  e.preventDefault();
  const act = el.dataset.hgact, g = el.dataset.hgk ? BOARD.get(el.dataset.hgk) : null, v = S.me;
  const bill = () => (S.bills || []).find(x => x.id === el.dataset.hgb);
  if (act === 'next') { const b = bill(); if (b) saidNoSheet([b], el.dataset.hgcode); return; }
  if (act === 'follow') { const b = bill(); if (!b) return; const dl = stopOf(b).deadline;
    return followSheet(b, el.dataset.hgcode, { mail: chairAskMail(el.dataset.hgcode, [b], { dl, followUp: true }) }); }
  if (act === 'row') { const b = bill(); if (b) rowMenu(b, el.dataset.hgcode); return; }
  if (!g) return;
  const R = groupRoles(g, v, g.scope);
  if (act === 'another') return askAnotherWay(R.log.map(x => x.b), g.code, { decide: !!R.log.length && R.log.every(x => x.k === 'decide') });
  if (act === 'give') return giveAsk(R.give.map(x => ({ b: x.b, st: x.a.st })), g.code, after);
  if (act === 'mine') return assignAsk(R.claim.map(x => ({ b: x.b, st: x.a.st })), g.code, v.id, after);
});
