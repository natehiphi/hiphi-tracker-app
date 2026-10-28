// R-316 W5 and W14 (live 10/22 at Nate's go, R-329). W5, the hearing push board: the bills with no hearing yet are grouped
// by the chair who must post the notice, with one email per chair that lists all of that chair's bills, and each bill says
// whether anyone has asked yet. On 16 Mar Rep. Kila, Rep. Todd and Sen. Kim would each have had three separate emails
// from Lauren. W14, a helper takes a chair ask: "Give this ask to…" makes a dated to-do on the receiver's Today ("Ask Rep.
// Kila for a hearing on HB1 (TRN)"), with the email button; the owner's row then reads "Kris is asking".
// Staff v6 (R-336 V13, V24, F79, F105, F134-F138): the same board, rebuilt as Hearings > Get hearings, ONE open board
// (askBoard below): under each deadline in words, grouped by chair, soonest notice first, each bill in one plain state:
// Ask (Email the chair, then "Did you send it?"), Ask the chair to schedule a vote (heard, not voted on), Waiting on a reply ("Asked
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
import { icon, btn, iconBtn, avatar, toast, pickerSheet, menuSheet, WHOSE, ASK_TAB, andWords } from './ui.js';

// The way to Bills That Need Hearings, one look wherever it is offered (R-352 E; Bills, Who to ask, Hearings' week line,
// Today's At the Capitol): Nate's words for the tab, teal, with "›" and no underline until hover (A-12: a standalone way
// on), no icon of its own. askTabGo is the link; askTabWords the same words inside a row that is already the link.
export const askTabWords = () => `<span class="v6-asktab">${ASK_TAB}<span aria-hidden="true">&nbsp;›</span></span>`;
export const askTabGo = (href, cls = '') => `<a class="v6-asktab${cls ? ' ' + cls : ''}" href="${esc(href)}">${ASK_TAB}<span aria-hidden="true">&nbsp;›</span></a>`;
export const PUSH_BOARD = () => true;   // live 10/22 at Nate's go, after W3 (R-329)
export const GIVE_ASK = () => true;   // live 10/22 at Nate's go, after W3 (R-329)

const HST = { timeZone: 'Pacific/Honolulu' };
const dayAt = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const timeAt = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const firstOf = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const isMeId = id => !!id && id === S.me?.id;
const live = id => { const a = id && advocate(id); return !!a && a.is_active !== false; };
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
  if (t && t.assignee_id) return { k: 'giving', words: isMeId(t.assignee_id) ? 'You ask the chair' : `${firstOf(t.assignee_id)} is asking`, t };
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
  // Taken by the viewer, the to-do is due the ask's own day, the one the card showed, so the date never moves (Nate's walk:
  // Rep. Kila's "ask by Tue 3/24" became "you ask by Fri 3/20", then went back once sent); the two-working-day lead is
  // only for an ask given to someone else.
  const due = aw && !aw.a.passed ? (isMeId(id) ? hday(aw.a.at) : handDue(aw.a.at)) : null, who = m ? m.who : 'the chair', made = [];
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
  // The bills' own coalition people first (its helpers and owners), then everyone else A to Z (Nate's walk: on a CTFH bill
  // Saya was last, below a phone's fold).
  const near = new Set(rows.flatMap(x => [...helpersOf(x.b), ...(S.assignments?.[x.b.id] || [])]));
  const people = (S.advocates || []).filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || near.has(y.id) - near.has(x.id) || x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: `Who should ask ${esc(m ? m.who : 'the chair')}?`, value: '', help: esc(`${rows.length === 1 ? sayWords(rows[0].b) : plural(rows.length, 'bill')}${aw && !aw.a.passed ? ` · ask by ${aw.day}` : ''}`),
    options: people.map(a => [a.id, a.id === S.me?.id ? 'You' : a.full_name, a.id === S.me?.id ? 'user-check' : 'user-round', a.id === S.me?.id ? 'I’ll ask' : near.has(a.id) ? 'Works on this bill' : '']),
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
// The switch's words are ui.js WHOSE, the one constant (C-15: Mine · My coalitions · Team on every list that has it).
export const SCOPES = WHOSE;
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
  if (scope === 'coal') { const co = coalOf(v); return co && !co.all ? `${andWords(co.names)} bills` : 'your coalitions’ bills'; }
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
// The state a bill is in on the board. k: ask · decide (heard, not voted on: ask the chair to schedule a vote, F105) · giving (handed to
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
// "46 of your coalitions' bills to ask · ask the first chair by Tue 3/17": the one-line summary under This week. Its number is
// the Get hearings tab's, the bills still to ask (the critic: the tab said 46 and this line "49 need a hearing", two numbers
// for one pile, A-14); with none left to ask, how many wait on a reply. `n` still counts every open one (to ask or waiting).
// The ask-by day is the board's own word for it ("ask by Tue 3/24"), not the Capitol's "first notice" (C-10, one name per fact).
// A bill heard and not voted on is never "to ask" (it needs a vote, not a hearing): `decide` counts them apart, as the
// board's own line does (dlCounts), so the tab, This week's line and the board's first line give one number (KV's tab said
// 3 to ask beside the board's "2 to ask" and its one bill heard but not voted on).
export function askSummary({ scope = defaultScope(), viewer = S.me } = {}) {
  const open = boardItems({ scope, viewer }).filter(x => x.k !== 'scheduled' && x.k !== 'later');
  if (!open.length) return null;
  const fx = open.filter(x => x.k === 'ask' && x.a.aw?.a.at && !x.a.aw.a.passed).sort((p, q) => p.a.aw.a.at - q.a.aw.a.at)[0] || null;
  const first = fx ? fx.a.aw.a.notice || fx.a.aw.a.at : null;
  const dl = open.map(x => x.dl).sort((p, q) => p.date.localeCompare(q.date))[0];
  const n = open.length, asks = open.filter(x => x.k === 'ask'), toAsk = asks.length, decide = open.filter(x => x.k === 'decide').length;
  return { n, toAsk, decide, first, firstDay: fx ? fx.a.aw.day : '', dl, words: toAsk ? `${countWords(toAsk, scope, viewer)} to ask` : `${countWords(n, scope, viewer)} asked, waiting for a hearing`, firstWords: fx ? `ask the first chair by ${fx.a.aw.day}` : '' };
}
// One count and one wording for the bills still to ask for a hearing, on Today, Bills and Hearings alike (rule 6, A-14;
// Nate's walk: "20 of your bills to ask", "16 of your bills with no hearing yet", "No hearing yet 20" and "Get hearings 20"
// for one pile): "20 to ask · first by Mon 3/23", the day being the first chair's ask-by day (never a Capitol deadline's:
// the critic read "16 by Mon 3/30" as "ask 16 by Mon 3/30", a week late). '' when nothing is left to ask.
export function toAskWords(sum) {
  const n = sum?.toAsk || 0; if (!n) return '';
  return `${n} to ask${sum.firstDay ? ` · first by ${sum.firstDay}` : ''}`;
}

// One set of counts per deadline, the board's own: the line under each deadline here (Get hearings, Legislators' Who to ask)
// and the one line on Today and Bills (deadlineLine) are worked out by this, so no two screens give two numbers for one
// pile (P-4, C-10; the fresh-eyes check: Kris's Bills said "54 to ask; 36 face the Mon 3/30 deadline" beside Legislators'
// "45 need a hearing · 42 to ask"). A bill heard and not voted on does not need a hearing: it is counted apart (decide)
// and said on its own line (decideWords), never inside the first count. `need` is every bill still waiting for its
// hearing (to ask, being asked, waiting, will schedule, said no or out of time), so the parts after it add up to it.
function dlCounts(items) {
  const c = k => items.filter(x => k.includes(x.k)).length;
  return { toAsk: c(['ask']), decide: c(['decide']), being: c(['giving']), wait: c(['waiting', 'follow']), yes: c(['will']), later: c(['later']), no: c(['said_no', 'passed']),
    sch: c(['scheduled']), total: items.length, need: items.filter(x => !['scheduled', 'later', 'decide'].includes(x.k)).length };
}
// Get hearings' own breakdown after "N need a hearing · M to ask", in the rows' own words ("will schedule": the chair
// replied, so not "waiting on a reply", B-7; spec 5). Only Get hearings says these; every other screen stops at "to ask".
const dlParts = c => [c.being ? `${c.being} being asked` : '', c.wait ? `${c.wait} waiting on a reply` : '', c.yes ? `${c.yes} will schedule` : '',
  c.later ? `${c.later} put off` : '', c.no ? `${c.no} said no or out of time` : '', c.sch ? `${c.sch} scheduled` : ''].filter(Boolean);
// Bills heard but not voted on (F105), on a short plain line of their own, only where they matter (Get hearings, Who to ask,
// and Today when they are not already rows there): "9 bills were heard but not voted on · ask the chair to schedule a vote".
export const decideWords = k => k ? `${k} ${k === 1 ? 'bill was' : 'bills were'} heard but not voted on · ask the chair to schedule a vote` : '';
// A count line's " · " parts each kept on one line (the phone walk: "33 to / ask" broke at a line's end): a short part goes in
// the no-wrap span (steps.css .v6-nw); a long one ("36 of your coalitions’ bills need a hearing") still wraps, or it would
// run off a 320px phone, with its day kept whole (steps.js nw). `h` is escaped HTML, its parts joined by " · ".
const NW_PART = 24;
export const nwParts = h => String(h ?? '').split(' · ').map(p => p.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, 'x').length <= NW_PART && !/class="v6-nw/.test(p) ? `<span class="v6-nw">${p}</span>` : nw(p)).join(' · ');
// THE deadline line, one function for Today, Bills and Legislators (Nate's 23 Oct walk: "36 of your coalitions' bills need
// a hearing by Mon 3/30 · 33 to ask · 9 to ask for decision making · 1 being asked · 1 waiting on a reply · 1 will schedule"
// was long, in Capitol words, and its parts did not add up: the 9 were outside the 36). One deadline's items ->
// { c (the counts), only (the one teammate who owns every bill here, else ''), head ("36 of your bills need a hearing by
// Mon 3/30"; `day: false` where a heading above already gives the day), rest ("33 to ask"), words (head · rest), decide }.
// Every bill here one teammate's is said once, "12 of Lauren's bills", so no row repeats "Lauren's bill" (A-14).
export function needWords(items, { scope = defaultScope(), viewer = S.me, date = '', day = true } = {}) {
  const c = dlCounts(items), v = viewer;
  const owners = new Set(items.map(x => (S.assignments?.[x.b.id] || [])[0] || '')), one = owners.size === 1 ? [...owners][0] : '';
  const only = one && one !== v?.id && advocate(one) ? one : '';
  const whose = n => only ? `${n} of ${advocate(only).full_name.split(' ')[0]}’s bills` : countWords(n, scope, v);
  const head = c.need ? `${whose(c.need)} ${c.need === 1 ? 'needs' : 'need'} a hearing${day && date ? ` by ${dayWords(date)}` : ''}` : '';
  const rest = c.need && c.toAsk ? `${c.toAsk} to ask` : '';
  return { c, only, head, rest, words: [head, rest].filter(Boolean).join(' · '), decide: decideWords(c.decide) };
}
// deadlineLine({ scope, viewer }) -> { date, day, need, toAsk, decide, ..., only, head, rest, words, decideLine } for the first
// deadline that still has bills needing a hearing: "16 of your bills need a hearing by Mon 3/30 · 14 to ask" (each screen
// adds its "Get hearings" door; `head` is the part Bills links to exactly those bills). null when none needs one.
export function deadlineLine({ scope = defaultScope(), viewer = S.me } = {}) {
  const by = new Map();
  for (const x of boardItems({ scope, viewer })) { if (!by.has(x.dl.date)) by.set(x.dl.date, []); by.get(x.dl.date).push(x); }
  const hit = [...by].sort((p, q) => p[0].localeCompare(q[0])).map(([date, xs]) => ({ date, xs, c: dlCounts(xs) })).find(d => d.c.need);
  if (!hit) return null;
  const w = needWords(hit.xs, { scope, viewer, date: hit.date });
  return { date: hit.date, day: dayWords(hit.date), ...w.c, only: w.only, head: w.head, rest: w.rest, words: w.words, decideLine: w.decide };
}

// Each row's one line (V19: the same words as the step card and Today) and its icon.
// `shared`: every bill under this deadline is one teammate's, and the deadline's line says so once, so no row repeats
// "Lauren's bill" (A-14). `hdrDay`: the day the chair's line already gives ("ask by Mon 3/23", "you ask by Mon 3/23"); a row
// whose own day is that same day does not say it again (Nate's walk: "· ask by Mon 3/23" over "Kris asks the chairs for Rick
// · by Mon 3/23" on one card). A row whose day differs keeps it: it is another fact.
function rowLine(it, v, scope, { shared = false, hdrDay = '' } = {}) {
  const { b, a, k } = it, own = (S.assignments?.[b.id] || [])[0], whose = own && own !== v?.id && !shared ? ` · ${advocate(own)?.full_name.split(' ')[0] || 'someone'}’s bill` : '';
  const asked = c => `asked ${c.who} ${askDay(c.asked.at)}`;
  const same = d => !!d && !!hdrDay && d === hdrDay;
  const noDay = s => same(a.day) ? String(s || '').replace(` · by ${a.day}`, '').replace(` by ${a.day}`, '') : s;
  switch (k) {
    case 'ask': return it.left?.length ? [`${cap(it.chairs.filter(c => c.asked).map(asked).join(', '))} · ${andWords(it.left.map(c => c.who))} not asked yet`, 'circle-dashed']
      // someone else's: whose first ("Nate's bill · not asked yet"; "No owner yet · not asked yet"), beside Take this ask
      : !own || !live(own) ? [`No owner yet · not asked yet`, 'circle-dashed'] : whose ? [`${advocate(own)?.full_name.split(' ')[0] || 'Someone'}’s bill · not asked yet`, 'circle-dashed'] : [`Not asked yet`, 'circle-dashed'];
    case 'later': return [`Not now · back on your list ${askDay(it.until)}${whose}`, 'clock'];
    case 'decide': return [`Heard, not voted on · ask the chair to schedule a vote${a.day && !same(a.day) ? ` by ${a.day}` : ''}${whose}`, 'gavel'];
    // The handed-off ask's own day (2 working days before the notice, V24), said as the asker's ("Kris asks by Fri 3/20"),
    // so it never reads as a second deadline beside the chair's "ask by Tue 3/24" (A-14, one word per fact).
    case 'giving': { const due = a.todo?.due_date, me = a.todo?.assignee_id === v?.id, who = me ? 'You' : advocate(a.todo?.assignee_id)?.full_name.split(' ')[0] || 'Someone';
      // The viewer's own: "Ask the chair by Fri 3/20", the words every chair-ask row uses (C-15: one name per act; the critic:
      // "You are asking" here beside "Ask the chair by" on Today). That it was given to them is said in its open item.
      // (askWords' own words, with who and when: "Ask the chair for Lauren · by Tue 3/24"; it read "Ask the chair" alone)
      const dd = due ? askDay(due + 'T12:00:00-10:00') : '';
      if (me) return [a.words ? noDay(a.words) : dd && !same(dd) ? `Ask the chair by ${dd}` : 'Ask the chair', 'user-round'];
      // Someone else's: askWords' own line, as Bills says it ("Kris asks the chairs for Rick · by Mon 3/23"; the fresh-eyes
      // check found "Kris asks by Mon 3/23" here beside Bills' longer words for the same ask, C-15).
      return [a.words ? noDay(a.words) : dd && !same(dd) ? `${who} asks by ${dd}` : `${who} asks`, 'user-round']; }
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
    return r ? mailBtn(r.m.n > 1 ? 'Email the chairs' : 'Email the chair', r.href, 'secondary', `Email ${r.m.who} to schedule a vote on ${name}`) : ''; }
  // The asker's Follow up holds both ways on (spec 8, F136: the reply in 2 clicks): the mail again, or the chair's reply.
  if (k === 'follow' && a.asker === v.id) return btn('Follow up', { kind: 'secondary', sm: true, icon: 'clock', attrs: { 'data-hgact': 'follow', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog', 'aria-label': `Follow up: ${name}` } });
  if (['waiting', 'follow'].includes(k)) return btn('They replied', { kind: 'secondary', sm: true, icon: 'message-square', attrs: { 'data-v6act': 'replied', 'data-v6b': b.id, 'data-v6code': code, 'aria-haspopup': 'dialog', 'aria-label': `They replied: ${name}` } });
  if ((k === 'ask' && !it.left?.length || k === 'later') && ownsBill(b, v)) return iconBtn('ellipsis', `More for ${name}`, { 'data-hgact': 'row', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog' }, 'hg-more');
  // Someone else's bill still to ask: the take-over is on its own row (the chair's line keeps Email the chair and Give this
  // ask to…): "Take this ask" (it becomes the viewer's, due the ask's own day), or for a bill with no owner, "Take it" (the
  // bill itself, R-330), after which Email the chair is theirs. Two people never ask one chair unannounced (R-329).
  if (k === 'ask' && !ownsBill(b, v)) return !(S.assignments?.[b.id] || []).some(id => advocate(id)?.is_active !== false)
    ? btn('Take it', { kind: 'secondary', sm: true, icon: 'user-round', attrs: { 'data-v6act': 'take', 'data-v6b': b.id, 'aria-label': `Take ${name}: it has no owner` } })
    : btn('Take this ask', { kind: 'secondary', sm: true, icon: 'user-check', attrs: { 'data-hgact': 'mine1', 'data-hgb': b.id, 'data-hgcode': code, 'aria-label': `Take the ask for ${name}` } });
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
  // The chair's line holds Email the chair and Give this ask to… only, on every card; a take-over is on the bill's own row
  // (rowButton: Take this ask, or Take it). A helper gets "Message Lauren" here, the bill's Team talk with @Lauren typed in
  // (v5's Message Rick on a coalition's chair ask; D4).
  const owners = [...new Set(R.claim.map(x => (S.assignments?.[x.b.id] || []).find(id => live(id) && id !== v?.id)).filter(Boolean))];
  const msg = owners.slice(0, 2).map(id => { const x = R.claim.find(r => (S.assignments?.[r.b.id] || []).includes(id));
    return btn(`Message ${firstOf(id)}`, { kind: 'text', sm: true, icon: 'message-square', href: `${billRoute(x.b, 'talk')}?mention=${advocate(id)?.initials || ''}` }); }).join('');
  const acts = `${mails}${R.give.length ? btn('Give this ask to…', { kind: 'text', sm: true, attrs: { 'data-hgact': 'give', 'data-hgk': g.key, 'aria-haspopup': 'dialog' } }) : ''}${msg}`;
  const who = m ? m.who : 'No chair listed yet', cn = committeeName(g.code) || g.code;
  const foot = '';   // "Asked another way? Log a talk" is said once, at the top of the board (askBoard)
  const hdrDay = mineDue ? askDay(mineDue + 'T12:00:00-10:00') : day || '';   // the day the chair's line says (`when` below)
  const rows = g.rows.map(x => { const [line, ic] = rowLine(x, v, scope, { shared, hdrDay }), mine = ['follow', 'giving'].includes(x.k) && (x.a.asker === v?.id || x.a.todo?.assignee_id === v?.id);
    return itemRow({ key: x.b.id, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(line)), icon: ic, tone: x.k === 'scheduled' ? 'done' : '', bold: mine, href: billRoute(x.b), button: rowButton(x, v, scope), cls: `hg-r k-${x.k}` }); }).join('');
  const when = mineDue ? `you ask by ${hdrDay}` : day ? `ask by ${day}` : g.rows.every(x => x.k === 'scheduled') ? 'scheduled' : '';
  // R-352 (A-18 on v6: no letter bubbles): the card starts with the chair's name, and each name is the link to that
  // legislator's page (R-344's B4: people tapped the photo to get there; the photo was mostly a letter). Teal, no underline
  // on a standalone link (one link style); a joint referral names each chair, each its own link.
  const chairs = m ? chairIdsOf(g.code).map(id => (S.legislators || []).find(l => l.id === id)).filter(Boolean) : [];
  const whoHTML = chairs.length ? andWords(chairs.map(l => `<a class="hg-cnl" href="#/legislator/${encodeURIComponent(l.id)}">${esc(chairWho(l.id))}</a>`)) : esc(who);
  return `<section class="hg-chair" aria-labelledby="hg-c-${esc(g.id)}">
    <div class="hg-chead"><div class="hg-cwho"><h3 class="hg-cname" id="hg-c-${esc(g.id)}">${whoHTML}</h3><p class="hg-csub">${nw(esc([cn, when].filter(Boolean).join(' · ')))}</p></div>${acts ? `<div class="hg-cacts">${acts}</div>` : ''}</div>
    <div class="v6-list hg-list" role="list" aria-label="${esc(`Bills for ${who}`)}">${rows}</div>${foot}</section>`;
}
// askBoard({ scope, bills, viewer, primary, id, empty }) -> the board's HTML: under each deadline (soonest first) in words,
// "Must reach their last committee by Mon 3/30", with how many are to ask, being asked, waiting and scheduled, then each
// chair's group, soonest notice first. Nothing is folded (V13: one open board). LEGISLATORS' Who to ask calls this with
// `primary: false` when another filled button owns its screen; buttons need no wiring (one document listener, below, and
// steps.js's).
// `fold` (Legislators' Who to ask): the first deadline in full, each later one a single line that opens it in place
// ("Must clear their last committee by Fri 4/10 · 12 bills · 4 chairs"): other people's asks are not the viewer's to-dos, and Kris's
// coalitions put 42 asks on 15 phone screens (the fresh-eyes check, A-1, A-2). In a later deadline the chairs holding a
// step of the viewer's own stay open and only the others fold ("12 more chairs · 30 bills"), so nothing they must do is
// behind a fold (rule 7.3); no step moves into "…". Get hearings stays one open board (V13).
// Inside the first deadline too (Nate's walk: Kris's Friday Who to ask ran 10,662px on a phone, its first deadline alone 42
// asks, mostly other people's): the chairs holding a step of the viewer's own stay open, and when more than FOLD_MIN other
// chairs remain they fold to one line under them that opens in place ("18 more chairs · 30 bills"). Fewer stay open.
const FOLD_MIN = 8;
const ownStep = (x, v) => mineGiven(x, v) || (x.k === 'follow' && x.a.asker === v?.id) || (['ask', 'decide', 'follow', 'later'].includes(x.k) && (S.assignments?.[x.b.id] || []).includes(v?.id));
const FOLD_OPEN = new Set();   // the later deadlines opened this visit (id|date), kept across redraws
export function askBoard({ scope = defaultScope(), bills = null, viewer = S.me, primary = true, id = 'hg', empty = null, fold = false } = {}) {
  BOARD = new Map();
  const v = viewer, items = boardItems({ scope, bills, viewer: v });
  if (!items.length) return empty ?? `<p class="hg-empty">${icon('circle-check')}<span>${esc(scope === 'team' ? 'No bill of the team’s is waiting for a hearing right now.' : `None of ${whoseWords(scope, v)} is waiting for a hearing right now.`)}</span></p>`;
  const dls = new Map();
  for (const x of items) { const k = x.dl.date; if (!dls.has(k)) dls.set(k, { dl: x.dl, groups: new Map(), items: [] }); const d = dls.get(k); d.items.push(x);
    if (!d.groups.has(x.code)) d.groups.set(x.code, []); d.groups.get(x.code).push(x); }
  let n = 0;
  const secs = [...dls.values()].sort((p, q) => p.dl.date.localeCompare(q.dl.date)).map((d, di) => {
    const hid = `${id}-d${n++}`, fk = `${id}|${d.dl.date}`;
    const sorted = [...d.groups].map(([code, rows]) => ({ code, rows: rows.sort((p, q) => ORDER[p.k] - ORDER[q.k] || p.b.bill_number.localeCompare(q.b.bill_number, 'en', { numeric: true })),
      at: Math.min(...rows.map(x => ['scheduled', 'later'].includes(x.k) ? Infinity : x.at)) }))
      .sort((p, q) => p.at - q.at || p.code.localeCompare(q.code));
    // A later deadline folds every chair with no step of the viewer's; the first folds them only when more than FOLD_MIN remain.
    const others = sorted.filter(g => !g.rows.some(x => ownStep(x, v))).length;
    const shutOthers = fold && (di > 0 || others > FOLD_MIN);
    const groups = sorted.map((g, i) => { const key = `${d.dl.date}|${g.code}`, gid = `${hid}-${i}`; const gg = { ...g, key, id: gid, dl: d.dl, scope, folded: shutOthers && !g.rows.some(x => ownStep(x, v)) }; BOARD.set(key, gg); return gg; });
    // The first deadline itself never folds away: its heading and line stay in sight, with its chairs' one line under them.
    return { d, hid, groups, folded: di > 0 && groups.every(g => g.folded), fk };
  });
  // The screen's one filled button (rule 7.1, A-3): the email for an ask handed to this person first (what they just took
  // on keeps the focus: critic A-13), else the first chair this person emails about their own bills. A helper with nothing
  // taken on yet has none: "I'll ask" is tonal, and the filled button would invite asking a teammate's chair unannounced.
  const all = secs.flatMap(s => s.groups), seen = all.filter(g => !g.folded);   // never the filled button inside a fold
  const pkey = !primary ? null : (seen.find(g => g.rows.some(x => mineGiven(x, v))) || seen.find(g => groupRoles(g, v, scope).mail.length))?.key || null;
  const out = secs.map(({ d, hid, groups, folded, fk }, di) => {
    // The deadline line's own words (needWords: the same function as Today's and Bills'), without the day the heading gives.
    // Legislators' Who to ask (fold) stops at "to ask" with the door to Get hearings, as Today and Bills do; Get hearings
    // itself adds who is being asked, waiting and will schedule. Bills heard but not voted on: their own line under it.
    const nwd = needWords(d.items, { scope, viewer: v, day: false }), cn = nwd.c, total = cn.total, nw0 = cn.need;
    const shared = !!nwd.only;   // every bill here one teammate's: said once on this line, not on every row (A-14)
    const head = cap(deadlineWords(d.dl.label, d.dl.date, { n: total }));
    const door = fold && di === 0 ? ` ·&nbsp;${askTabGo(`#/hearings/ask?scope=${scope}`, 'hg-dlgo')}` : '';
    // The ask part never repeats the count before it (Nate's walk 3: "16 of your bills need a hearing · 16 to ask"): when
    // every bill here is still to ask it says "none asked yet"; otherwise how many are still to ask, "12 still to ask". Only
    // this deadline's bills, never a share of the tab's total ("12 of the 20" mixed two totals: the critic, walk 3, A-14).
    const askT = !nwd.rest ? '' : cn.toAsk >= cn.need ? 'none asked yet' : `${cn.toAsk} still to ask`;
    const subT = [nwd.head, askT, ...(fold ? [] : dlParts(cn))].filter(Boolean).join(' · ');
    const sub = `${subT ? `<p class="hg-dls">${nwParts(esc(subT))}${door}</p>` : ''}${nwd.decide ? `<p class="hg-dls hg-dld">${nwParts(esc(nwd.decide))}</p>` : ''}`;
    const gh = g => groupHTML(g, v, scope, { primary: g.key === pkey, shared }), open = groups.filter(g => !g.folded), shut = groups.filter(g => g.folded);
    const body = open.map(gh).join('');
    // A fold's bills are counted as the line above counts them (needWords): the bills still needing a hearing, with the ones
    // heard but not voted on said apart (KR's "24 more chairs · 44 bills" sat under "36 ... need a hearing": the 9 heard
    // were inside the 44). Every fold says its chairs first, then its bills ("4 chairs · 12 bills").
    const shutRows = shut.flatMap(g => g.rows), shutC = { need: shutRows.filter(x => !['scheduled', 'later', 'decide'].includes(x.k)).length, decide: shutRows.filter(x => x.k === 'decide').length };
    const foldWords = (chairs, c) => [chairs, c.need ? plural(c.need, 'bill') : '', c.decide ? `${c.decide} heard but not voted on` : ''].filter(Boolean).join(' · ');
    // The viewer's own chairs here open, the rest one line under them that opens in place.
    const rest = !shut.length || folded ? '' : `<details class="hg-fold hg-foldrest" data-hgfold="${esc(fk)}"${FOLD_OPEN.has(fk) ? ' open' : ''}><summary class="hg-foldsum"><span class="hg-foldt">${nwParts(esc(foldWords(plural(shut.length, open.length ? 'more chair' : 'chair'), shutC)))}</span>${icon('chevron-down', { cls: 'hg-foldchev' })}</summary>
      <div class="hg-foldin">${shut.map(gh).join('')}</div></details>`;
    if (folded) return `<details class="hg-dl hg-fold" data-hgfold="${esc(fk)}"${FOLD_OPEN.has(fk) ? ' open' : ''}><summary class="hg-foldsum"><h2 id="${hid}">${esc(head)}</h2><span class="hg-foldn">${nwParts(esc(foldWords(plural(groups.length, 'chair'), { need: nw0, decide: cn.decide })))}</span>${icon('chevron-down', { cls: 'hg-foldchev' })}</summary>
      <div class="hg-foldin">${sub}${shut.map(gh).join('')}</div></details>`;
    return `<section class="hg-dl" aria-labelledby="${hid}"><div class="hg-dlh"><h2 id="${hid}">${esc(head)}</h2>${sub}</div>${body}${rest}</section>`;
  }).join('');
  // One "Asked another way? Log a talk" for the whole board, not under every chair (Nate's walk: 11 times on Lauren's My
  // bills; C-15, one name per act). It opens the chair to pick when more than one ask is the viewer's to log.
  const logs = all.filter(g => groupRoles(g, v, scope).log.length);
  const top = logs.length ? `<p class="hg-log hg-logtop"><span>Asked another way?</span>${btn('Log a talk', { kind: 'text', sm: true, icon: 'message-square', attrs: { 'data-hgact': 'anotherall', 'data-hgboard': id, 'aria-haspopup': 'dialog', 'aria-label': 'Log a talk: an ask made by phone, in person or another way' } })}</p>` : '';
  return `<div class="hg-board" data-hgboard="${esc(id)}">${top}${out}</div>`;
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
// A later deadline opened in place stays open when the page redraws (a Take this ask, a switch), until the visit ends.
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('toggle', e => {
  const el = e.target; if (!el?.matches?.('details[data-hgfold]')) return;
  if (el.open) FOLD_OPEN.add(el.dataset.hgfold); else FOLD_OPEN.delete(el.dataset.hgfold);
}, true);
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const el = e.target?.closest?.('[data-hgact]'); if (!el) return;
  e.preventDefault();
  const act = el.dataset.hgact, g = el.dataset.hgk ? BOARD.get(el.dataset.hgk) : null, v = S.me;
  const bill = () => (S.bills || []).find(x => x.id === el.dataset.hgb);
  if (act === 'next') { const b = bill(); if (b) saidNoSheet([b], el.dataset.hgcode); return; }
  if (act === 'follow') { const b = bill(); if (!b) return; const dl = stopOf(b).deadline;
    return followSheet(b, el.dataset.hgcode, { mail: chairAskMail(el.dataset.hgcode, [b], { dl, followUp: true }) }); }
  if (act === 'row') { const b = bill(); if (b) rowMenu(b, el.dataset.hgcode); return; }
  // Take this ask (a teammate's bill's row): it becomes the viewer's, due the ask's own day.
  if (act === 'mine1') { const b = bill(), x = b && [...BOARD.values()].flatMap(gg => gg.rows).find(r => r.b.id === b.id); if (x) assignAsk([{ b: x.b, st: x.a.st }], x.code, v.id, after); return; }
  // The board's one Log a talk: the chair first when more than one has an ask to log.
  if (act === 'anotherall') {
    const gs = [...BOARD.values()].filter(gg => groupRoles(gg, v, gg.scope).log.length);
    const open = gg => { const L = groupRoles(gg, v, gg.scope).log; askAnotherWay(L.map(x => x.b), gg.code, { decide: L.every(x => x.k === 'decide') }); };
    if (gs.length === 1) return open(gs[0]);
    return pickerSheet({ title: 'Which chair did you ask?', value: '', options: gs.map(gg => [gg.key, chairMail(gg.code)?.who || 'The chair', 'user-round', `${committeeName(gg.code) || gg.code} · ${plural(groupRoles(gg, v, gg.scope).log.length, 'bill')}`]),
      onPick: k => { const gg = BOARD.get(k); if (gg) setTimeout(() => open(gg), 300); } });
  }
  if (!g) return;
  const R = groupRoles(g, v, g.scope);
  if (act === 'another') return askAnotherWay(R.log.map(x => x.b), g.code, { decide: !!R.log.length && R.log.every(x => x.k === 'decide') });
  if (act === 'give') return giveAsk(R.give.map(x => ({ b: x.b, st: x.a.st })), g.code, after);
  if (act === 'mine') return assignAsk(R.claim.map(x => ({ b: x.b, st: x.a.st })), g.code, v.id, after);
});
