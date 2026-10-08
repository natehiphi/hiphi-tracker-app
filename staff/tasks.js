// Staff v2 · Tasks (#/tasks, R-210, Nate 10/8: "go for all" on a cross-bill list of to-dos). A person comes here to see
// every task they have to do, across all their bills, and tick them off. The tasks live on each bill (its Overview, "To do");
// Today shows the soonest as cards; this is the whole list in one place, oldest trouble first.
//   - Mine: assigned to me, or unassigned on a bill I own (the same test as Today's cards, so the two never disagree).
//   - Everyone: every open task on the team's bills, with who has it; a box narrows it to one teammate or to nobody yet.
// Grouped Overdue, Today, This week, Later, No date. Ticking is the bill page's own (DB.updateTodo) with Undo. Keys (a
// keyboard and mouse; My settings can switch them off): j and k move between tasks, Space or Enter ticks, o opens the bill.
import { S, DB, esc, isOwner, advocate, hooks } from './data.js';
import { billById, billNum, blurb, billRoute, hiToday } from './model.js';
import { icon, empty, toast, keysOn, segmented } from './ui.js';
import { nameOrYou, dayOf } from './bill.js';

const view = () => S.tasksView ??= { who: 'me', person: '' };
const hover = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const plusDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mineTask = (t, b) => t.assignee_id === S.me?.id || (!t.assignee_id && isOwner(b));

// Every open task whose bill is still on the list, with its bill.
function openTasks() {
  const out = [];
  for (const [bid, arr] of Object.entries(S.todos || {})) { const b = billById(bid); if (!b) continue;
    for (const t of arr) if (!t.done) out.push({ t, b }); }
  return out;
}
const byDue = (x, y) => (x.t.due_date || '9999').localeCompare(y.t.due_date || '9999') || billNum(x.b).localeCompare(billNum(y.b), 'en', { numeric: true }) || (x.t.sort_order - y.t.sort_order);

function groups(rows) {
  const today = hiToday(), week = plusDays(today, 7), G = [['over', 'Overdue', []], ['today', 'Today', []], ['week', 'This week', []], ['later', 'Later', []], ['none', 'No date', []]];
  for (const r of rows.sort(byDue)) { const d = r.t.due_date; G[!d ? 4 : d < today ? 0 : d === today ? 1 : d <= week ? 2 : 3][2].push(r); }
  return G.filter(g => g[2].length);
}
function row({ t, b }, v) {
  const today = hiToday(), over = t.due_date && t.due_date < today, soon = t.due_date === today;
  const due = t.due_date ? (over ? `<span class="bw-late">${icon('circle-alert')}Overdue · was due ${esc(dayOf(t.due_date))}</span>` : soon ? `<span class="bw-soon">${icon('clock')}Due today</span>` : `Due ${esc(dayOf(t.due_date))}`) : '';
  const who = v.who === 'all' ? esc(t.assignee_id ? nameOrYou(advocate(t.assignee_id)) : 'Nobody yet') : '';
  return `<li class="tk-row" data-tkrow="${esc(t.id)}">
    <button type="button" class="bw-tick tk-tick" data-tk="${esc(t.id)}" data-tkbill="${esc(b.id)}" role="checkbox" aria-checked="false" aria-label="Done: ${esc(t.title)}">${icon('square')}</button>
    <span class="tk-body"><span class="tk-ttl">${esc(t.title)}</span>
      <span class="tk-meta"><a class="tk-bill" href="${billRoute(b)}"><b>${esc(billNum(b))}</b> ${esc(b.nickname || blurb(b, 60))}</a>${[due, who].filter(Boolean).map(x => `<span>${x}</span>`).join('')}</span></span>
  </li>`;
}

function render() {
  const v = view(), all = openTasks(), me = S.me?.id;
  const mine = all.filter(r => mineTask(r.t, r.b));
  // The person box: only teammates who have an open task are listed, so there is no empty choice.
  const have = [...new Set(all.map(r => r.t.assignee_id).filter(Boolean))].map(advocate).filter(Boolean).sort((a, b) => (b.id === me) - (a.id === me) || a.full_name.localeCompare(b.full_name));
  if (v.person && v.person !== 'none' && !have.some(a => a.id === v.person)) v.person = '';
  const pool = v.who === 'me' ? mine : all.filter(r => !v.person || (v.person === 'none' ? !r.t.assignee_id : r.t.assignee_id === v.person));
  const G = groups(pool.slice());
  const seg = segmented('tk-who', [['me', `Mine ${mine.length}`], ['all', `Everyone ${all.length}`]], v.who, 'Whose tasks');
  const picker = v.who === 'all' && all.length ? `<label class="sr" for="tk-person">Show tasks for</label><select id="tk-person" class="input tk-person"><option value="">Everyone</option>
      ${have.map(a => `<option value="${esc(a.id)}" ${v.person === a.id ? 'selected' : ''}>${esc(a.id === me ? 'You' : a.full_name)}</option>`).join('')}
      ${all.some(r => !r.t.assignee_id) ? `<option value="none" ${v.person === 'none' ? 'selected' : ''}>Nobody yet</option>` : ''}</select>` : '';
  const none = v.who === 'me'
    ? empty({ title: 'No tasks for you', text: 'A task you or a teammate adds under To do on a bill’s Overview shows here.', action: `<a class="btn secondary" href="#/bills">Go to Bills</a>` })
    : empty({ title: 'No open tasks', text: 'Every task on the team’s bills is done.' });
  return `<div class="tk-page">
    <div class="tk-bar">${seg}${picker}</div>
    <p class="tk-count" aria-live="polite">${pool.length} open ${pool.length === 1 ? 'task' : 'tasks'}${G.length && G[0][0] === 'over' ? `, ${G[0][2].length} overdue` : ''}</p>
    ${G.length ? G.map(([k, l, list]) => `<section class="tk-group" aria-labelledby="tk-h-${k}"><h2 id="tk-h-${k}" class="tk-gh${k === 'over' ? ' late' : ''}">${l} <span class="tk-n">${list.length}</span></h2><ul class="rows tk-rows">${list.map(r => row(r, v)).join('')}</ul></section>`).join('') : none}
    ${hover() && keysOn() && pool.length ? `<p class="tk-keys">${icon('keyboard')}<span>Keys: <kbd>j</kbd> and <kbd>k</kbd> move, <kbd>Space</kbd> ticks a task, <kbd>o</kbd> opens its bill.</span></p>` : ''}
    <p class="tk-note">Add a task on any bill’s Overview, under To do. Ticking one here ticks it there.</p>
  </div>`;
}

async function tick(id, billId, el) {
  const t = (S.todos[billId] || []).find(x => String(x.id) === String(id)); if (!t) return;
  const rows = [...document.querySelectorAll('.tk-tick')], at = rows.indexOf(el);
  el.disabled = true;
  try {
    await DB.updateTodo(billId, t.id, { done: true }); hooks.render();
    // The row has gone: focus lands on the one that took its place, so a keyboard run of ticks does not start over.
    const left = [...document.querySelectorAll('.tk-tick')]; left[Math.min(at, left.length - 1)]?.focus();
    toast('Done.', { undo: async () => { await DB.updateTodo(billId, t.id, { done: false }); hooks.render(); } });
  } catch (e) { el.disabled = false; toast(e, { err: true }); }
}

function wire(route, root) {
  const v = view();
  root.querySelectorAll('[data-tk]').forEach(el => el.onclick = () => tick(el.dataset.tk, el.dataset.tkbill, el));
  root.querySelectorAll('[data-seg="tk-who"]').forEach(el => el.onclick = () => { v.who = el.dataset.val; hooks.render(); document.querySelector(`[data-seg="tk-who"][data-val="${v.who}"]`)?.focus(); });
  const p = root.querySelector('#tk-person'); if (p) p.onchange = () => { v.person = p.value; hooks.render(); document.getElementById('tk-person')?.focus(); };
}

// ---- keys (a keyboard and mouse; never while typing, in a sheet, or with shortcuts switched off) ----
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (S.route?.name !== 'tasks' || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  const ticks = [...document.querySelectorAll('.tk-tick')], at = ticks.findIndex(x => x === document.activeElement);
  if (e.key === 'j' || e.key === 'k') {
    if (!ticks.length) return; e.preventDefault();
    const n = at < 0 ? 0 : Math.max(0, Math.min(ticks.length - 1, at + (e.key === 'j' ? 1 : -1)));
    ticks[n].focus(); ticks[n].scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'o' && at >= 0) {
    e.preventDefault(); ticks[at].closest('.tk-row')?.querySelector('.tk-bill')?.click();
  }
});

export default {
  tab: 'today', narrow: true,
  back: () => ({ href: '#/', label: 'Today' }),
  title: () => 'Tasks',
  render, wire,
};
