// Staff v2 · Bills: select mode and the bulk changes (plan 3.4). The current app wrote to every selected bill the
// moment an option was picked, with no Undo, and warned about hidden selections in a bar that scrolled away. Here a
// change is picked, then applied with one button that names the count, the warning sits right above that button, and
// the toast's Undo puts each bill's own previous value back. The writes are the current app's calls: DB.bulkUpdate for
// position and priority, DB.setOwner per bill (in parallel), DB.addToCampaign, DB.addListBills.
import { S, DB, esc, advocate, hooks } from './data.js';
import { billNum } from './model.js';
import { icon, btn, iconBtn, toast, openSheet, closeSheet, menuSheet, POS_ICON, POS_WORD } from './ui.js';
import { bl, shownBills, wideNow, settled } from './filters.js';

export const selIds = () => { const v = bl(); for (const id of v.sel) if (!S.bills.some(b => b.id === id)) v.sel.delete(id); return [...v.sel]; };
const billsN = n => `${n} bill${n === 1 ? '' : 's'}`;
const hiddenOf = ids => { const vis = new Set(shownBills().map(b => b.id)); return ids.filter(id => !vis.has(id)); };
export function startSelect(firstId) { const v = bl(); v.selecting = true; if (firstId) v.sel.add(firstId); hooks.render(); }
export function stopSelect() { const v = bl(); v.selecting = false; v.sel.clear(); hooks.render(); }

// ---- the bar: replaces the tab bar on phones, fixed to the bottom of the window on desktop ----
export function bulkBar() {
  const ids = selIds(), n = ids.length, hid = hiddenOf(ids).length;
  if (wideNow()) {
    if (!n) return '';
    const b = (label, act, ic) => btn(label, { kind: 'secondary', sm: true, icon: ic, attrs: { 'data-bulk': act } });
    return `<div class="bl-bar bl-barw" role="toolbar" aria-label="Change the selected bills">
      <span class="bl-bar-n"><b>${n}</b> selected${hid ? `<span class="bl-bar-h">${hid} hidden by your filters</span>` : ''}</span>
      ${b('Set position', 'pos', 'thumbs-up')}${b('Set priority', 'pri', 'flag')}${b('Set owner', 'own', 'user-round')}${b('Add to coalition', 'camp', 'users')}${(S.lists || []).length ? b('Add to list', 'list', 'list-plus') : ''}
      ${btn('Clear', { kind: 'text', attrs: { 'data-bulk': 'clear' } })}</div>`;
  }
  return `<div class="bl-bar" role="toolbar" aria-label="Change the selected bills">
    <span class="bl-bar-n" aria-live="polite">${n ? `<b>${n}</b> selected` : 'Tap bills to select'}</span>
    ${btn('Set…', { kind: 'secondary', attrs: { 'data-bulk': 'set', disabled: !n } })}${btn('Add to…', { kind: 'secondary', attrs: { 'data-bulk': 'add', disabled: !n } })}
    ${iconBtn('x', 'Stop selecting', { 'data-bulk': 'exit' })}</div>`;
}
export function wireBulkBar(root) {
  const bar = root.querySelector('.bl-bar'); if (!bar) return;
  bar.querySelectorAll('[data-bulk]').forEach(el => el.onclick = () => {
    const a = el.dataset.bulk;
    if (a === 'exit') return stopSelect();
    if (a === 'clear') { bl().sel.clear(); return hooks.render(); }
    if (a === 'set') return openSet();
    if (a === 'add') return openAddTo();
    if (a === 'camp' || a === 'list') return openAddTo(a);
    openValue(a);
  });
}

// ---- Set…: position, priority or owner, then a value, then "Apply to N bills" ----
export function openSet() {
  const n = selIds().length; if (!n) return;
  menuSheet({ title: `Change ${billsN(n)}`, items: [
    { label: 'Position', icon: 'thumbs-up', sub: 'Support, oppose, comments or monitor', run: async () => { await settled(); openValue('pos'); } },
    { label: 'Priority', icon: 'flag', sub: 'P1, P2 or P3', run: async () => { await settled(); openValue('pri'); } },
    { label: 'Owner', icon: 'user-round', sub: 'Who looks after them', run: async () => { await settled(); openValue('own'); } },
  ] });
}
const FIELD = {
  pos: { word: 'position', opts: () => ['strongly_support', 'support', 'support_amend', 'strongly_oppose', 'oppose', 'neutral', 'monitor'].map(k => [k, POS_WORD[k], POS_ICON[k]]), cur: b => b.position || '' },
  pri: { word: 'priority', opts: () => [['1', 'P1', 'flag', 'Top priority'], ['2', 'P2', 'flag'], ['3', 'P3', 'flag']], cur: b => String(b.priority || '') },
  own: { word: 'owner', opts: () => [...S.advocates.filter(a => a.is_active !== false).sort((a, b) => (b.id === S.me?.id) - (a.id === S.me?.id) || a.full_name.localeCompare(b.full_name)).map(a => [a.id, a.id === S.me?.id ? `You (${a.full_name})` : a.full_name, 'user-round']), ['none', 'No owner', 'circle-dashed']], cur: b => (S.assignments[b.id] || [])[0] || 'none' },
};
// Selections survive filter changes, so a change can reach bills that are no longer on screen. Say so right above the
// button, and offer the one-tap way to leave them out.
const hiddenNote = (ids, hid, trim = true) => hid.length ? `<div class="notice warn sv-notice bl-hid">${icon('triangle-alert')}<div>${hid.length === ids.length ? `${ids.length === 1 ? 'It is' : `All ${ids.length} are`} hidden by your filters.` : `${hid.length} of them ${hid.length === 1 ? 'is' : 'are'} hidden by your filters.`}</div>${trim && hid.length < ids.length ? btn(hid.length === 1 ? 'Leave it out' : 'Leave them out', { kind: 'text', sm: true, attrs: { 'data-trim': '1' } }) : ''}</div>` : '';
export function openValue(field) {
  const F = FIELD[field]; let pick = null, d = null;
  const bodyHTML = () => { const ids = selIds(), hid = hiddenOf(ids), bills = ids.map(id => S.bills.find(b => b.id === id));
    return `${hiddenNote(ids, hid)}<div class="sv-pickl" role="radiogroup" aria-label="New ${F.word}">${F.opts().map(([v, l, ic, sub]) => { const have = bills.filter(b => F.cur(b) === v).length;
      return `<button type="button" role="radio" aria-checked="${pick === v}" data-pv="${esc(v)}">${ic ? icon(ic) : ''}<span class="body"><span class="title">${esc(l)}</span>${sub || have ? `<span class="sub">${esc([sub, have ? (have === ids.length ? (ids.length === 1 ? 'It has this now' : `All ${ids.length} have this now`) : `${have} already ${have === 1 ? 'has' : 'have'} this`) : ''].filter(Boolean).join(' · '))}</span>` : ''}</span>${pick === v ? icon('check', { cls: 'on' }) : ''}</button>`; }).join('')}</div>`; };
  const footHTML = () => { const n = selIds().length; return btn(`Apply to ${billsN(n)}`, { full: true, attrs: { 'data-apply': '1', disabled: pick === null || !n } }); };
  const paint = () => { const body = d.querySelector('.sv-sh-body'), y = body.scrollTop; body.innerHTML = bodyHTML(); body.scrollTop = y; d.querySelector('.sv-sh-foot').innerHTML = footHTML(); wire(); };
  const wire = () => {
    d.querySelectorAll('[data-pv]').forEach(el => el.onclick = () => { pick = el.dataset.pv; paint(); d.querySelector(`[data-pv="${CSS.escape(pick)}"]`)?.focus(); });
    const t = d.querySelector('[data-trim]'); if (t) t.onclick = () => { const hid = new Set(hiddenOf(selIds())); for (const id of hid) bl().sel.delete(id); hooks.render(); paint(); };
    d.querySelector('[data-apply]').onclick = () => apply(field, pick);
  };
  d = openSheet({ title: `Set ${F.word} for ${billsN(selIds().length)}`, body: bodyHTML(), foot: footHTML(), wire: dlg => { d = dlg; wire(); } });
}
async function apply(field, v) {
  const ids = selIds(); if (!ids.length || v == null) return;
  const bills = ids.map(id => S.bills.find(b => b.id === id));
  closeSheet({ silent: true });
  try {
    if (field === 'own') {
      const prev = new Map(ids.map(id => [id, (S.assignments[id] || [])[0] || null])), to = v === 'none' ? null : v;
      await Promise.all(ids.map(id => DB.setOwner(id, to)));
      hooks.render();
      const who = to ? (to === S.me?.id ? 'You' : advocate(to)?.full_name || 'They') : '';
      toast(to ? `${who} now ${to === S.me?.id ? 'own' : 'owns'} ${billsN(ids.length)}.` : `${billsN(ids.length)} ${ids.length === 1 ? 'has' : 'have'} no owner now.`, { undo: async () => {
        await Promise.all(ids.map(id => DB.setOwner(id, prev.get(id))));
        hooks.render(); toast('Undone. Each bill has its old owner back.');
      } });
      return;
    }
    const key = field === 'pos' ? 'position' : 'priority', val = field === 'pos' ? v : Number(v);
    const prev = new Map(bills.map(b => [b.id, b[key] ?? null]));
    await DB.bulkUpdate(ids, { [key]: val });
    hooks.render();
    toast(`${field === 'pos' ? `Position set to ${POS_WORD[v]}` : `Priority set to P${v}`} on ${billsN(ids.length)}.`, { undo: async () => {
      // one write per distinct old value, so every bill gets back exactly what it had
      const by = new Map(); for (const [id, old] of prev) (by.get(old) || by.set(old, []).get(old)).push(id);
      await Promise.all([...by].map(([old, group]) => DB.bulkUpdate(group, { [key]: old })));
      hooks.render(); toast(`Undone. Each bill has its old ${FIELD[field].word} back.`);
    } });
  } catch (e) { hooks.render(); toast(e, { err: true }); }
}

// ---- Add to…: a coalition or a public list. Acts on tap; bills that are not public are left off lists, and said so. ----
export function openAddTo(kind) {
  const ids = selIds(); if (!ids.length) return;
  const bills = ids.map(id => S.bills.find(b => b.id === id)), pub = bills.filter(b => b.tracked !== false && b.is_public), hid = hiddenOf(ids);
  const camps = kind === 'list' ? [] : S.campaigns, lists = kind === 'camp' ? [] : (S.lists || []);
  const campRow = c => { const have = bills.filter(b => (S.billCampaigns[b.id] || []).includes(c.id)).length, all = have === ids.length;
    return `<button type="button" data-addc="${esc(c.id)}" ${all ? 'aria-disabled="true"' : ''}>${icon('users')}<span class="body"><span class="title">${esc(c.name)}</span>${have ? `<span class="sub">${all ? (ids.length === 1 ? 'Already in it' : `All ${ids.length} are already in it`) : `${have} already in it`}</span>` : ''}</span></button>`; };
  const listRow = l => { const on = new Set(S.listBills.filter(x => x.list_id === l.id).map(x => x.bill_id)), add = pub.filter(b => !on.has(b.id)).length, priv = ids.length - pub.length;
    const sub = !pub.length ? (ids.length === 1 ? 'This bill is not public, so it cannot go on a list' : 'None of these bills are public, so none can go on a list')
      : !add ? 'Every public one is already on it' : priv ? `${add} can go on it. ${priv} ${priv === 1 ? 'is' : 'are'} not public and will be left off.` : `Adds ${billsN(add)}`;
    return `<button type="button" data-addl="${esc(l.id)}" ${!add ? 'aria-disabled="true"' : ''}>${icon('list-checks')}<span class="body"><span class="title">${esc(l.title)}</span><span class="sub">${esc(sub)}</span></span></button>`; };
  openSheet({ title: kind === 'camp' ? `Add ${billsN(ids.length)} to a coalition` : kind === 'list' ? `Add ${billsN(ids.length)} to a list` : `Add ${billsN(ids.length)} to…`,
    body: `${hiddenNote(ids, hid, false)}
      ${camps.length ? `${kind ? '' : '<h3 class="bl-sh3">Coalition</h3>'}<div class="sv-menu">${camps.map(campRow).join('')}</div>` : ''}
      ${lists.length ? `${kind ? '' : '<h3 class="bl-sh3">List on the public page</h3>'}<div class="sv-menu">${lists.map(listRow).join('')}</div>` : ''}`,
    wire: d => {
      d.querySelectorAll('[data-addc]').forEach(el => el.onclick = () => { if (el.getAttribute('aria-disabled') !== 'true') addCamp(el.dataset.addc); });
      d.querySelectorAll('[data-addl]').forEach(el => el.onclick = () => { if (el.getAttribute('aria-disabled') !== 'true') addList(el.dataset.addl); });
    } });
}
async function addCamp(cid) {
  const ids = selIds(), c = S.campaigns.find(x => x.id === cid); closeSheet({ silent: true });
  const fresh = ids.filter(id => !(S.billCampaigns[id] || []).includes(cid)), had = ids.length - fresh.length;
  try {
    await DB.addToCampaign(ids, cid);
    hooks.render();
    toast(`Added ${billsN(fresh.length)} to ${c?.name || 'the coalition'}.${had ? ` ${had} ${had === 1 ? 'was' : 'were'} already in it.` : ''}`, { undo: async () => {
      await Promise.all(fresh.map(id => DB.toggleCampaign(id, cid, false)));
      hooks.render(); toast(`Undone. ${billsN(fresh.length)} left ${c?.name || 'the coalition'}.`);
    } });
  } catch (e) { hooks.render(); toast(e, { err: true }); }
}
async function addList(lid) {
  const ids = selIds(), l = (S.lists || []).find(x => x.id === lid); closeSheet({ silent: true });
  const before = new Set(S.listBills.filter(x => x.list_id === lid).map(x => x.bill_id));
  const priv = ids.filter(id => { const b = S.bills.find(x => x.id === id); return !(b && b.tracked !== false && b.is_public); }).length;
  try {
    const n = await DB.addListBills(lid, ids);
    const added = S.listBills.filter(x => x.list_id === lid && !before.has(x.bill_id)).map(x => x.bill_id);
    hooks.render();
    toast(`Added ${billsN(n)} to ${l?.title || 'the list'}.${priv ? ` ${priv} ${priv === 1 ? 'is' : 'are'} not public, so ${priv === 1 ? 'it was' : 'they were'} left off.` : ''}`, { undo: async () => {
      await Promise.all(added.map(id => DB.removeListBill(lid, id)));
      hooks.render(); toast(`Undone. ${billsN(added.length)} came off ${l?.title || 'the list'}.`);
    } });
  } catch (e) { hooks.render(); toast(e, { err: true }); }
}
// The desktop table's single-cell edits use the same choices, one bill at a time.
export { FIELD };
