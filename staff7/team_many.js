// Staff7 Team, view "Many at once" (R-398 piece 6, part 2): bills only, a full-width table with filters and tick boxes, and "Give N to…" / "Take N" for the ticked ones. One change is one group:
// each bill gets its own record in S.leadChanges, all with one `group` id, and one Undo puts every bill back. Practice copy: nothing is sent; the done page shows the words (team_message.png).
// Addresses: #/team/many (the table), #/team/many/give (who should lead the ticked bills), #/team/many/done/<group>. The filters and the ticks are kept for the visit, across the tab switch.
import { S, advocate, POSITIONS, setLeads, undoLeadChanges, leadGroupId, leadsLiveOn } from '../staff6/data.js';
import { ic } from './icons7.js';
import { btn, personMark, esc, toast } from './parts.js';
import { hooks7 } from './sort_data.js';
import { posWords } from './steps.js';
import { noLeadBills, ledBills, leadsOf, leadsWords, rowOf, sortRows, people, whileSaving, overseer, sameNick, pn, leadMessages, messageBoxHTML } from './team_data.js';

const enc = encodeURIComponent, UNDO_MS = 10000, CAP = 11;
const undoMs = () => leadsLiveOn() ? 8000 : UNDO_MS;   // live: inside the database's 10-second merge of a change made again by the same person
const fail = words => toast(words, { ms: 6000 });
export const ui = { who: 'nolead', issue: '', pos: '', all: false, ticked: new Set(), pick: '', pickFor: '', done: Object.create(null) };
const draw = o => hooks7.draw && hooks7.draw(o || {});
const go = h => { if (location.hash === h) draw({ focus: 'main h1' }); else location.hash = h; };
const nameOf = pn;

// ---------------------------------------------------------------------------------- the rows
const issueIdsOf = b => (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => String(x.issue_id));
function baseRows() {
  if (ui.who !== 'nolead') { const a = advocate(ui.who); if (a && a.is_active !== false) return sortRows(ledBills(a).map(rowOf)); ui.who = 'nolead'; }
  return noLeadBills();
}
const filtered = base => base.filter(r => (!ui.issue || issueIdsOf(r.b).includes(ui.issue)) && (!ui.pos || r.b.position === ui.pos));
const mine = (r, me) => (S.assignments?.[r.id] || []).length === 1 && S.assignments[r.id][0] === me.id;
const joinNames = names => names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
const namesLine = rows => rows.length <= 3 ? joinNames(rows.map(r => r.name)) : `${rows.slice(0, 3).map(r => r.name).join(', ')} and ${rows.length - 3} more`;
const bills = n => `${n} ${n === 1 ? 'bill' : 'bills'}`;

// ---------------------------------------------------------------------------------- the page
const sw = `<div class="segs3 tmsw" role="group" aria-label="How to look at the team"><a class="seg" href="#/team">One at a time</a><a class="seg" href="#/team/many" aria-current="true">Many at once</a></div>`;
const band = (title, sub, withSwitch, h1 = true) => `<div class="tmband"><div class="tmbt">${h1 ? `<h1 tabindex="-1">${esc(title)}</h1>` : `<p class="tmtl">${esc(title)}</p>`}${sub ? `<p class="tmsub">${esc(sub)}</p>` : ''}</div>${withSwitch ? sw : ''}</div>`;
const bandSub = (n, who) => who === 'nolead' ? `${n} ${n === 1 ? 'bill has' : 'bills have'} no lead.` : `${pn(advocate(who))} leads ${n} ${n === 1 ? 'bill' : 'bills'}.`;

function options(base) {
  const iss = new Map(), pos = new Map();
  for (const r of base) { for (const id of issueIdsOf(r.b)) { const i = (S.issues || []).find(x => String(x.id) === id); if (i && !i.archived_at) iss.set(id, i.name); } if (r.b.position) pos.set(r.b.position, posWords(r.b)); }
  if (ui.issue && !iss.has(ui.issue)) ui.issue = ''; if (ui.pos && !pos.has(ui.pos)) ui.pos = '';
  const posOrder = POSITIONS.map(p => p[0]);
  return { iss: [...iss].sort((a, b) => a[1].localeCompare(b[1], 'en')), pos: [...pos].sort((a, b) => posOrder.indexOf(a[0]) - posOrder.indexOf(b[0])) };
}
function filtersHTML(base, rows, o) {
  const who = [['nolead', 'No lead yet']].concat(people().map(a => [a.id, `${nameOf(a)} · ${leadsOf(a)}`]).filter(([id]) => leadsOf(advocate(id)) > 0 || id === ui.who));
  const sel = (id, label, opts, cur) => `<label class="mf" for="${id}"><span>${label}</span><select class="field" id="${id}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
  const all = rows.length > 0 && rows.every(r => ui.ticked.has(r.id));
  return `<div class="mtool">${sel('mWho', 'Whose bills:', who, ui.who)}${sel('mIssue', 'Issue:', [['', 'all'], ...o.iss], ui.issue)}${sel('mPos', 'Position:', [['', 'all'], ...o.pos], ui.pos)}`
    + `<label class="mall"><input type="checkbox" id="mAll"${all ? ' checked' : ''}${rows.length ? '' : ' disabled'}><span>Select all ${rows.length}</span></label></div>`;
}
const rowHTML = (r, on) => {
  const ld = r.issue.lead;
  return `<tr class="${on ? 'on' : ''}" data-id="${esc(r.id)}"><td class="mt"><label class="mtick"><input type="checkbox" class="mchk" data-id="${esc(r.id)}"${on ? ' checked' : ''} aria-label="Tick ${esc(r.name)} ${esc(r.no)}"></label></td>`
    + `<td class="mb"><b>${esc(r.name)}</b>&nbsp;<span class="no">${esc(r.no)}</span></td><td class="mi">${sameNick(r.name, r.issue) ? (ld ? `${esc(pn(ld))} leads the issue` : '') : `${esc(r.issue.name)}${ld ? ` <span class="sep" aria-hidden="true">·</span> ${esc(pn(ld))}` : ''}`}</td><td class="mp">${esc(posWords(r.b))}</td><td class="mw">${esc(r.next.words)}</td></tr>`;
};
function footHTML(n, take) {
  return n ? `<span class="mpick" id="mPick">${bills(n)} picked</span>${btn(`Give ${n} to…`, { kind: 'filled', id: 'mGive' })}${btn(take ? `Take ${take}` : 'Take', { kind: 'quiet', id: 'mTake', disabled: !take })}${btn('Clear', { kind: 'text', id: 'mClear' })}`
    : `<span class="mpick" id="mPick">Tick the bills first.</span>${btn('Give to…', { kind: 'quiet', id: 'mGive', disabled: true })}${btn('Take', { kind: 'quiet', id: 'mTake', disabled: true })}`;
}
function listSheet(me, base, rows) {
  const o = options(base), head = ui.who === 'nolead' ? 'No lead yet' : `${pn(advocate(ui.who))} leads`, shown = ui.all ? rows : rows.slice(0, CAP);
  const t = rows.filter(r => ui.ticked.has(r.id)), take = t.filter(r => !mine(r, me)).length;
  const more = rows.length > CAP ? `<p class="mmore">${ui.all ? `Showing all ${rows.length}` : `Showing ${CAP} of ${rows.length}`} <span class="sep" aria-hidden="true">·</span> ${btn(ui.all ? 'Show fewer' : 'Show all', { kind: 'text', id: 'mShowAll' })}</p>` : '';
  const table = rows.length ? `<table class="mtab"><thead><tr><th class="mt"><span class="sr">Tick</span></th><th>Bill</th><th>Issue · who leads it</th><th>HIPHI’s position</th><th>When</th></tr></thead><tbody id="mBody">${shown.map(r => rowHTML(r, ui.ticked.has(r.id))).join('')}</tbody></table>${more}`
    : `<p class="calmnote">${ui.who === 'nolead' && !ui.issue && !ui.pos ? 'Every bill has a lead.' : 'No bills match.'}</p>`;
  return `<div class="pn mn">${band('Team', bandSub(base.length, ui.who), true)}<div class="pbody mbody">${filtersHTML(base, rows, o)}<h2 class="mh" id="mH">${esc(head)} · ${rows.length}</h2>${table}`
    + `<div class="sfoot mfoot" id="mFoot">${footHTML(t.length, take)}</div></div></div>`;
}

// ---------------------------------------------------------------------------------- give
// people who lead the issue for some of the ticked bills come first, most first; the viewer has Take
function givePeople(rows, me) {
  const n = new Map(); for (const r of rows) { const l = r.issue.lead; if (l) n.set(l.id, (n.get(l.id) || 0) + 1); }
  const all = people().filter(a => a.id !== me.id).sort((p, q) => (n.get(q.id) || 0) - (n.get(p.id) || 0) || leadsOf(p) - leadsOf(q) || nameOf(p).localeCompare(nameOf(q), 'en'));
  return { all, n };
}
function giveSheet(me, rows) {
  const { all, n } = givePeople(rows, me), key = rows.map(r => r.id).join(',');
  if (ui.pickFor !== key || !all.some(a => a.id === ui.pick)) { ui.pickFor = key; ui.pick = all[0] && n.get(all[0].id) ? all[0].id : ''; }
  const lis = all.map(a => { const on = a.id === ui.pick, c = n.get(a.id) || 0;
    return `<li><button class="grow${on ? ' on' : ''}" type="button" role="radio" aria-checked="${on}" data-id="${esc(a.id)}" data-name="${esc(nameOf(a))}">${personMark(a.initials, { small: true })}<span class="gn"><b>${esc(pn(a))}</b> <span class="gl">${esc(leadsWords(a))}</span>${c ? `<span class="gflag">${ic('flag')}leads the issue for ${c} of these</span>` : ''}</span><span class="gtick">${ic(on ? 'check' : 'chevron-right')}</span></button></li>`; }).join('');
  const p = all.find(a => a.id === ui.pick), N = rows.length;
  return `<div class="pn mn">${band(`Who should lead ${N === 1 ? 'this bill' : `these ${N} bills`}?`, namesLine(rows), false)}<div class="pbody mbody"><ul class="gpick mgive" role="radiogroup" aria-label="Who should lead these bills">${lis}</ul>`
    + `<div class="sfoot mfoot">${btn(p ? `Give ${N} to ${nameOf(p)}` : `Give ${N} to…`, { kind: 'filled', id: 'mGiveGo', disabled: !p })}</div></div></div>`;
}

// ---------------------------------------------------------------------------------- done
function doneSheet(me, base, d) {
  const look = (() => { const w = overseer(me); return w ? `${pn(w)} will look over the change.` : 'An admin will look over the change.'; })();
  const give = d.kind === 'give', title = give ? `${pn(d.to)} leads ${d.n} more ${d.n === 1 ? 'bill' : 'bills'} now.` : `You lead ${d.n} more ${d.n === 1 ? 'bill' : 'bills'} now.`;
  const sub = give ? `${pn(d.to)} gets one message listing ${d.n === 1 ? 'it' : 'them'}. ${look}` : `${look} Nothing else needs you.`;
  const box = messageBoxHTML(leadMessages(d.recs));   // team_data.js: the same words everywhere
  return `<div class="pn mn">${band('Team', bandSub(base.length, ui.who), true, false)}<div class="done enter tdone"><div class="dtile">${ic('check')}</div><h1 class="dh" tabindex="-1">${esc(title)}</h1><p class="sub">${esc(sub)}</p>${box}</div></div>`;
}
const missing = `<div class="pn mn"><div class="done"><h1 tabindex="-1">That change is not on this page any more.</h1></div></div>`;

// ---------------------------------------------------------------------------------- the model (frame.js: a page with no list beside it, `solo`)
export function manyModel({ me, rt }) {
  const [sub, ...rest] = String(rt.id || '').split('/').slice(1), key = rest.join('/');
  const base = baseRows(), rows = filtered(base), ids = new Set(rows.map(r => r.id));
  for (const id of [...ui.ticked]) if (!ids.has(id)) ui.ticked.delete(id);
  let sheet, label = 'Many at once';
  if (sub === 'give') {
    const t = rows.filter(r => ui.ticked.has(r.id));
    if (!t.length) sheet = listSheet(me, base, rows); else { sheet = giveSheet(me, t); label = 'Give bills'; }
  } else if (sub === 'done') { const d = ui.done[key]; sheet = d ? doneSheet(me, base, d) : missing; label = 'Done'; }
  else sheet = listSheet(me, base, rows);
  return { col: '', sheet, label, picked: true, solo: true, back: sub === 'give' || sub === 'done' ? '#/team/many' : '#/team', backLabel: sub === 'give' || sub === 'done' ? 'the list' : 'Team', bind: () => bind({ me, rows, sub }) };
}

// ---------------------------------------------------------------------------------- what the controls do
async function apply(me, rows, to, btnEl) {   // to: an advocate (give) or me (take); returns after drawing the done page
  const picked = rows.filter(r => ui.ticked.has(r.id)), chosen = to.id === me.id ? picked.filter(r => !mine(r, me)) : picked;
  const old = new Map(); for (const r of chosen) for (const id of S.assignments?.[r.id] || []) if (id !== to.id && id !== me.id) (old.get(id) || old.set(id, []).get(id)).push(r);
  const res = await whileSaving(btnEl, to.id === me.id ? 'Taking' : 'Giving', setLeads(chosen.map(r => r.id), to.id, leadGroupId()));
  const { group, recs } = res;
  if (res.refused) { fail(res.refused); if (recs.length) draw({}); return; }   // some of the bills may have changed before the one that failed: the page shows them as they are now
  if (!recs.length) return;
  const d = { kind: to.id === me.id ? 'take' : 'give', to, n: recs.length, rows: chosen, recs, old };
  ui.done[group] = d; ui.ticked.clear();
  const title = d.kind === 'give' ? `${bills(d.n).replace(/^1 bill$/, '1 bill')} given to ${pn(to)}.` : `You lead ${d.n} more ${d.n === 1 ? 'bill' : 'bills'} now.`;
  location.hash = `#/team/many/done/${enc(group)}`;
  addEventListener('hashchange', () => toast(title, { undo: () => undo(group), ms: undoMs() }), { once: true });   // after the page is drawn, which clears the old toast
}
async function undo(group) {
  const d = ui.done[group]; if (!d) return;
  const r = await undoLeadChanges(d.recs);
  if (r.refused) return fail(r.refused);
  delete ui.done[group];
  addEventListener('hashchange', () => toast('Put back. Nothing was changed.', { ms: 5000 }), { once: true });
  go('#/team/many');
}
function bind({ me, rows, sub }) {
  const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
  const set = (id, k, extra) => document.getElementById(id)?.addEventListener('change', e => { ui[k] = e.target.value; ui.all = false; if (extra) extra(); draw({ focus: '#' + id }); });
  set('mWho', 'who', () => { ui.issue = ''; ui.pos = ''; ui.ticked.clear(); }); set('mIssue', 'issue'); set('mPos', 'pos');
  on('mShowAll', () => { ui.all = !ui.all; draw({ focus: '#mShowAll' }); });
  // ticks change the tint, the "Select all" box and the foot in place: nothing is drawn again, so the focus stays on the box
  const sync = () => {
    const t = rows.filter(r => ui.ticked.has(r.id)), take = t.filter(r => !mine(r, me)).length;
    document.querySelectorAll('.mchk').forEach(c => { const o = ui.ticked.has(c.dataset.id); c.checked = o; c.closest('tr').classList.toggle('on', o); });
    const all = document.getElementById('mAll'); if (all) { all.checked = rows.length > 0 && t.length === rows.length; all.indeterminate = t.length > 0 && t.length < rows.length; }
    const f = document.getElementById('mFoot'); if (f) { f.innerHTML = footHTML(t.length, take); wireFoot(); }
  };
  const wireFoot = () => {
    on('mGive', () => go('#/team/many/give'));
    on('mTake', () => apply(me, rows, me, document.getElementById('mTake')));
    on('mClear', () => { ui.ticked.clear(); sync(); document.getElementById('mAll')?.focus(); });
  };
  document.querySelectorAll('.mchk').forEach(c => c.addEventListener('change', () => { if (c.checked) ui.ticked.add(c.dataset.id); else ui.ticked.delete(c.dataset.id); sync(); }));
  document.getElementById('mAll')?.addEventListener('change', e => { if (e.target.checked) rows.forEach(r => ui.ticked.add(r.id)); else rows.forEach(r => ui.ticked.delete(r.id)); sync(); });
  wireFoot();
  document.querySelectorAll('.grow').forEach(g => g.addEventListener('click', () => {
    ui.pick = g.dataset.id;
    document.querySelectorAll('.grow').forEach(o => { const act = o === g; o.classList.toggle('on', act); o.setAttribute('aria-checked', String(act)); o.querySelector('.gtick').innerHTML = ic(act ? 'check' : 'chevron-right'); });
    const gb = document.getElementById('mGiveGo'); gb.disabled = false; gb.textContent = `Give ${rows.filter(r => ui.ticked.has(r.id)).length} to ${g.dataset.name}`;
  }));
  on('mGiveGo', () => { const to = advocate(ui.pick); if (to) apply(me, rows, to, document.getElementById('mGiveGo')); });
}
