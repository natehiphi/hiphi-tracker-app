// R-316 W5 and W14 (Show me: on the practice copy until Nate's yes makes the gates `() => true`).
// W5, the hearing push board: under each deadline on This week, the bills with no hearing yet are grouped by the chair
// who must post the notice, with one email per chair that lists all of that chair's bills ("Rep. Kila · TRN · 3 bills ·
// ask by Tue 3/24"), and each bill says whether anyone has asked yet. On 16 Mar Rep. Kila, Rep. Todd and Sen. Kim would
// each have had three separate emails from Lauren.
// W14, a helper takes a chair ask: "Give this ask to…" makes a dated to-do on the receiver's Today ("Ask Rep. Kila for
// a hearing on HB1 (TRN)"), with the email button; the owner's row then reads "Kris is asking". Kris works with
// legislators but owns no bills, so she was never offered one.
// Until W3 records every ask (a database change, Nate's call), "asked" is a conversation logged with that chair about
// that bill, the record the Legislators page already keeps; "Mark asked" logs one. W3's "Did you send it?" replaces it.
import { S, DB, DEMO, esc, advocate } from './data.js';
import { chairMail, codesOf, askWords, billTag, billSay, billRoute, blurb } from './model.js';
import { icon, btn, iconBtn, avatar, toast, pickerSheet, menuSheet } from './ui.js';

export const PUSH_BOARD = () => DEMO;
export const GIVE_ASK = () => DEMO;

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
export const chairIds = code => codesOf(code).map(k => (S.committeeMembers || []).find(m => m.committee === k && m.role === 'chair')?.legislator_id).filter(Boolean);
const notesAll = () => { const seen = new Set(), out = [];
  for (const n of [...(S.demoNotes || []), ...Object.values(S.legNotes || {}).flat()]) if (n && !seen.has(String(n.id))) { seen.add(String(n.id)); out.push(n); }
  return out; };
export function askedOf(b, code) {
  const ids = new Set(chairIds(code)); if (!ids.size) return null;
  const n = notesAll().filter(x => x.bill_id === b.id && ids.has(x.legislator_id)).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))[0];
  return n ? { by: n.advocate_id, at: new Date(n.created_at).getTime(), n } : null;
}
// W14: an ask handed to someone is a to-do with this title, so it shows on their Today with its due day.
export const ASK_TODO = /^Ask (?:the chairs?|(?:Rep|Sen)\. .+?) for a hearing on (\S+)/;
export const askTodoOf = b => (S.todos?.[b.id] || []).find(t => !t.done && ASK_TODO.test(t.title || '')) || null;
// Where a bill's chair ask stands: asked, being asked by someone, or not yet.
export function askState(b, code) {
  const a = askedOf(b, code);
  if (a) return { k: 'asked', words: `Asked by ${isMeId(a.by) ? 'you' : firstOf(a.by)} ${whenWord(a.at)}`, a };
  const t = askTodoOf(b);
  if (t && t.assignee_id) return { k: 'giving', words: isMeId(t.assignee_id) ? 'You are asking' : `${firstOf(t.assignee_id)} is asking`, t };
  return { k: 'none', words: 'Not asked yet' };
}
export const askChip = s => `<span class="pb-st pb-${s.k}">${icon(s.k === 'asked' ? 'check' : s.k === 'giving' ? 'user-round' : 'circle-dashed')}<span>${esc(s.words)}</span></span>`;

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
  const acts = g.m ? `${btn(g.m.n > 1 ? "Email the chairs" : g.rows.length > 1 ? `Email ${g.m.who}` : "Email the chair", { kind: 'secondary', sm: true, icon: 'mail', href: chairEmailHref(g.m, g.rows, g.rows[0].st.deadline) })}${open ? btn('Mark asked', { kind: 'text', sm: true, icon: 'check', attrs: { 'data-pbasked': k } }) : ''}${GIVE_ASK() && open ? iconBtn('ellipsis', `More for the ask to ${g.m.who}`, { 'data-pbmore': k, 'aria-haspopup': 'dialog' }, 'td-more') : ''}` : '';
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
    for (const x of todo) for (const id of ids) made.push([await DB.addLegNote(id, x.b.id, `Asked for a hearing on ${x.b.bill_number} (${g.code}).`), id]);   // one wording with logAsk
    for (const x of todo) { const t = askTodoOf(x.b); if (t && isMeId(t.assignee_id)) await DB.updateTodo(x.b.id, t.id, { done: true }); }
    toast(`Marked asked: ${todo.length === 1 ? billSay(todo[0].b) : plural(todo.length, 'bill')} with ${g.m?.who || 'the chair'}. The team sees it on ${todo.length === 1 ? 'the bill' : 'each bill'}.`,
      { ok: true, undo: async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); after(); } });
    after();
  } catch (e) { toast(e, { err: true }); } finally { el?.removeAttribute('aria-busy'); }
}
// W14: hand the ask to a teammate (or take it): a dated to-do on each of the group's bills not asked yet, due the day the
// first notice must post. Someone given a to-do gets a Slack message from the database (064), as Give to… on any to-do.
export async function assignAsk(rows, code, id, after) {
  const m = chairMail(code), aw = rows.map(x => askWords(x.st)).filter(Boolean).sort((p, q) => p.a.at - q.a.at)[0];
  const due = aw && !aw.a.passed ? hday(aw.a.at) : null, who = m ? m.who : 'the chair', made = [];
  try {
    for (const x of rows) {
      const was = askTodoOf(x.b);
      if (was) { made.push({ b: x.b, t: was, prev: { assignee_id: was.assignee_id, due_date: was.due_date } }); await DB.updateTodo(x.b.id, was.id, { assignee_id: id, due_date: due }); continue; }
      await DB.addTodo(x.b.id, `Ask ${who} for a hearing on ${x.b.bill_number} (${code})`);
      const t = (S.todos[x.b.id] || []).at(-1); await DB.updateTodo(x.b.id, t.id, { assignee_id: id, due_date: due }); made.push({ b: x.b, t, prev: null });
    }
    const undo = async () => { for (const z of made) await DB.updateTodo(z.b.id, z.t.id, z.prev || { done: true }); after(); };
    toast(isMeId(id) ? `It is yours: ask ${who}${due ? ` by ${aw.day}` : ''}. It is on your Today.` : `${firstOf(id)} has it now and gets a Slack message. The ask is on ${firstOf(id)}’s Today${due ? ` for ${aw.day}` : ''}.`, { ok: true, undo });
    after();
  } catch (e) { toast(e, { err: true }); }
}
export function giveAsk(rows, code, after) {
  const m = chairMail(code), aw = rows.map(x => askWords(x.st)).filter(Boolean).sort((p, q) => p.a.at - q.a.at)[0];
  const people = (S.advocates || []).filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id) || x.full_name.localeCompare(y.full_name));
  pickerSheet({ title: `Give the ask to ${esc(m ? m.who : 'the chair')} to`, value: '', help: esc(`${rows.length === 1 ? billSay(rows[0].b) : plural(rows.length, 'bill')}${aw && !aw.a.passed ? ` · ask by ${aw.day}` : ''}`),
    options: people.map(a => [a.id, a.id === S.me?.id ? 'You' : a.full_name, a.id === S.me?.id ? 'user-check' : 'user-round', a.id === S.me?.id ? 'I’ll ask' : '']),
    onPick: id => assignAsk(rows, code, id, after) });
}
// The asker's Done on an ask to-do is the ask made: it is logged with the chair, so everyone's row says "Asked by Kris".
export async function logAsk(b, code) {
  const made = []; for (const id of chairIds(code)) made.push([await DB.addLegNote(id, b.id, `Asked for a hearing on ${b.bill_number} (${code}).`), id]);
  return async () => { for (const [n, id] of made) await DB.delLegNote(n.id, id); };
}
export function wirePush(root, after) {
  root.querySelectorAll('[data-pbasked]').forEach(el => el.onclick = () => markAsked(el.dataset.pbasked, el, after));
  // Two actions on the chair's line (A-20): the email and Mark asked; handing the ask on is in its "…".
  root.querySelectorAll('[data-pbmore]').forEach(el => el.onclick = () => { const g = GROUPS.get(el.dataset.pbmore); if (!g) return;
    menuSheet({ title: esc(`The ask to ${g.m?.who || 'the chair'}`), items: [{ label: 'Give this ask to…', icon: 'user-round', sub: 'It lands on their Today with the email button', run: () => giveAsk(g.rows.filter(x => askState(x.b, g.code).k === 'none'), g.code, after) }] }); });
}
// A new draw: forget the last one's groups.
export const resetPush = () => { GROUPS = new Map(); };
