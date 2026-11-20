// The admin's step: "Look over N lead changes" (R-398 piece 6, part 3), page #/do/leads. Every take or give already counts; an admin looks at each one and approves it, or puts it back
// (the earlier lead returns, both people are told). A group (many bills at once) is one row. Rows: a bill taken from, or given away from, an existing lead first; within a group, newest first.
// Practice copy: nothing is sent; the words are shown (team_message.png). Admins only.
import { S, advocate, leadsLiveOn } from '../staff6/data.js';
import { ic } from './icons7.js';
import { btn, plainBand, personMark, esc, toast } from './parts.js';
import { hooks7 } from './sort_data.js';
import { billName, billNo, dayTime } from './steps.js';
import { pendingUnits, approveRecs, unapproveRecs, putBackRecs, unputBackRecs, putBackMessages, messageBoxHTML, whileSaving, pn } from './team_data.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST), clock = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
const DAY = 864e5;
export const ui = { open: new Set(), note: '' };
const draw = o => hooks7.draw && hooks7.draw(o || {});
const bill = id => (S.bills || []).find(b => b.id === id);

// "today 9:40 AM" / "yesterday 4:32 PM" / "Fri 11:05 AM"
export const whenWords = t => { const d = ymd(t), now = Date.now(); return d === ymd(now) ? `today ${clock(t)}` : d === ymd(now - DAY) ? `yesterday ${clock(t)}` : dayTime(t); };
const joinNames = ns => ns.length <= 1 ? ns.join('') : ns.length === 2 ? ns.join(' and ') : `${ns[0]} and ${ns.length - 1} others`;
// "nobody led them" / "Patrick led it" / "Kevin and 2 others led them"
function ledWords(recs) {
  const ids = [...new Set(recs.flatMap(r => (r.from || []).filter(id => id !== r.to)))].map(advocate).filter(Boolean), many = recs.length > 1;
  return !ids.length ? `nobody led ${many ? 'them' : 'it'}` : `${joinNames(ids.map(pn))} led ${many ? 'them' : 'it'}`;
}
export const units = () => pendingUnits().sort((x, y) => (y.unusual - x.unusual) || y.at - x.at);
export const stepCount = () => pendingUnits().length;   // a group counts once

function rowHTML(u) {
  const r0 = u.recs[0], by = advocate(r0.by), to = advocate(r0.to), took = by && to && by.id === to.id, many = u.recs.length > 1, open = ui.open.has(u.key);
  const what = many ? `${u.recs.length} bills` : (b => b ? `<b>${esc(billName(b))}</b> ${esc(billNo(b))}` : 'a bill')(bill(r0.bill_id));
  const verb = took ? `${esc(pn(by))} took ${what}` : `${esc(pn(by))} gave ${what} to ${esc(pn(to))}`;
  const meta = `${esc(whenWords(u.at))} <span class="sep" aria-hidden="true">·</span> ${esc(ledWords(u.recs))}${many ? ` <span class="sep" aria-hidden="true">·</span> <button type="button" class="btn text" data-see="${esc(u.key)}" aria-expanded="${open}">${open ? `Hide the ${u.recs.length}` : `See the ${u.recs.length}`}</button>` : ''}`;
  const list = many && open ? `<ul class="lcl">${u.recs.map(r => { const b = bill(r.bill_id); return `<li>${b ? `${esc(billName(b))} <span class="no">${esc(billNo(b))}</span>` : 'A bill'}</li>`; }).join('')}</ul>` : '';
  return `<li class="lcr">${personMark(by?.initials || '', { small: true })}<div class="lct"><p class="lc1">${verb}</p><p class="lc2">${meta}</p>${list}</div><div class="lca">${btn('Approve', { kind: 'quiet', attrs: `data-ok="${esc(u.key)}"` })}${btn('Put back', { kind: 'quiet', attrs: `data-back="${esc(u.key)}"` })}</div></li>`;
}

export function leadsPage(me) {
  if (!me?.is_admin) return { html: `<div class="pn">${plainBand('That step is done or no longer yours.', '')}</div>`, bind: null };
  const us = units(), note = ui.note;
  if (!us.length) return { html: `<div class="pn"><div class="done enter tdone"><div class="dtile">${ic('check')}</div><h1 tabindex="-1">All lead changes are looked over.</h1><p class="sub">Nothing else needs you here.</p>${note}</div></div>`, bind: bindAll(me) };
  return { html: `<div class="pn lcn">${plainBand('Lead changes', '')}<div class="pbody"><p class="lead mid">These already count. Approve them, or put one back.</p>${note}<ul class="lcs">${us.map(rowHTML).join('')}</ul>`
    + `<div class="sfoot lcfoot">${btn(`Approve all ${us.length}`, { kind: 'filled', id: 'lcAll' })}</div></div></div>`, bind: bindAll(me) };
}

function bindAll(me) {
  return () => {
    const find = k => pendingUnits().find(u => u.key === k);
    // Live, the database has no un-approve, so an approval offers no Undo there; the practice copy keeps its Undo
    const fail = words => toast(words, { ms: 6000 });
    const approve = async (us, words, el, busyWords) => {
      const recs = us.flatMap(u => u.recs), r = await whileSaving(el, busyWords, approveRecs(recs, me));
      if (r.refused) return fail(r.refused);
      ui.note = ''; toast(words, { undo: leadsLiveOn() ? null : () => { unapproveRecs(recs); draw({ focus: 'main h1' }); }, ms: 10000 }); draw({ focus: 'main h1' });
    };
    document.querySelectorAll('[data-see]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.see; ui.open.has(k) ? ui.open.delete(k) : ui.open.add(k); draw({ focus: `[data-see="${k}"]` }); }));
    document.querySelectorAll('[data-ok]').forEach(b => b.addEventListener('click', () => { const u = find(b.dataset.ok); if (u) approve([u], u.recs.length > 1 ? `Approved ${u.recs.length} bills.` : 'Approved.', b, 'Approving'); }));
    document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', async () => {
      const u = find(b.dataset.back); if (!u) return; const recs = u.recs, msgs = putBackMessages(recs, me);
      const r = await whileSaving(b, 'Putting back', putBackRecs(recs, me));   // live: all of them or none (one transaction); "The lead changed again since..." is shown as the database says it
      if (r.refused) return fail(r.refused);
      ui.note = messageBoxHTML(msgs);
      toast(recs.length > 1 ? `Put back ${recs.length} bills.` : 'Put back.', { undo: leadsLiveOn() ? null : () => { unputBackRecs(recs); ui.note = ''; draw({ focus: 'main h1' }); }, ms: 10000 });
      draw({ focus: 'main h1' });
    }));
    document.getElementById('lcAll')?.addEventListener('click', () => { const us = units(); if (us.length) approve(us, `Approved ${us.length} lead ${us.length === 1 ? 'change' : 'changes'}.`, document.getElementById('lcAll'), 'Approving'); });
  };
}
