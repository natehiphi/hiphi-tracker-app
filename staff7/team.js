// Staff7 Team, view "One at a time" (R-398 piece 6): the left list holds other people's steps that are late or due today, and the bills nobody leads; the right sheet does one thing with the one picked
// (tell the holder, take the step, take the bill, give it to a teammate). Everyone on staff can open it. Practice copy only: nothing is sent; a take or give is a record in memory (team_data.js).
// The page's addresses: #/team (the first row opens), #/team/step/<step id>, #/team/bill/<bill id>, #/team/give/<bill id>, #/team/done/<record id>, #/team/many (the other view, built in a later part).
import { S, advocate, setLeads, undoLeadChanges, leadsLiveOn } from '../staff6/data.js';
import { ic } from './icons7.js';
import { btn, band, plainBand, personMark, esc, toast } from './parts.js';
import { hooks7 } from './sort_data.js';
import { left } from './steps.js';
import { hearTxt } from './issues.js';   // the shared relative-day words ("today 1:10 PM")
import { manyModel } from './team_many.js';
import {
  lateSteps, noLeadBills, lateWords, whatWords, messageWords, billFacts, leadMessages, messageBoxHTML, pn, overseer, sameNick, people, leadsWords, whileSaving, tell, untell, told, clockWords, stepIsLate, stepIsTeamLate, LATE_CAP, LEAD_CAP,
} from './team_data.js';

const enc = encodeURIComponent, UNDO_MS = 10000;
// Live, the database merges a change made again by the same person within 10 seconds into the first (so a quick Undo leaves no record): the toast's Undo ends before that window does
const undoMs = () => leadsLiveOn() ? 8000 : UNDO_MS;
const fail = words => toast(words, { ms: 6000 });   // a refused live call, in the database's plain words
const one = (billId, toId) => setLeads([billId], toId, null, { skipSame: false });
export const ui = { moreLate: false, moreLead: false, give: { bill: '', pick: '' }, done: Object.create(null) };
const billHref = b => `#/bill/${enc(String(b.bill_number).replace(/\s/g, ''))}`;
const draw = o => hooks7.draw && hooks7.draw(o || {});
const go = hash => { if (location.hash === hash) draw({ focus: 'main h1' }); else location.hash = hash; };

// ---------------------------------------------------------------------------------- the left column
const nobodyMark = '<span class="person sm nob" aria-hidden="true"></span>';
function lateRow(r, sel) {
  const s = r.step, h = r.holder, href = `#/team/step/${enc(r.id)}`;
  const tm = r.late ? `<span class="stm soon">${ic('clock')}${esc(lateWords(r))}</span>` : `<span class="stm">${esc(lateWords(r))}</span>`;
  const who = h ? `${personMark(h.initials, { small: true })}` : nobodyMark;
  return `<li><a class="sr3 tr${sel ? ' sel' : ''}"${sel ? ' aria-current="true"' : ''} href="${href}">${who}<span class="sv">${h ? `<span class="sr">${esc(pn(h))} has this. </span>` : '<span class="nobw">Nobody</span> <span class="sep" aria-hidden="true">·</span> '}<b>${esc(s.verb)}</b> <span class="sep" aria-hidden="true">·</span> ${esc(s.name)}&nbsp;<span class="no">${esc(s.no)}</span></span>${tm}</a></li>`;
}
function leadRow(x, sel) {
  const href = `#/team/bill/${enc(x.id)}`, i = x.issue;
  return `<li><a class="sr3 tr${sel ? ' sel' : ''}"${sel ? ' aria-current="true"' : ''} href="${href}"><span class="imark" style="--ic:var(--cat-${esc(i.cat)}, var(--cat-other))" aria-hidden="true">${ic(i.icon)}</span><span class="sv"><b>${esc(x.name)}</b>&nbsp;<span class="no">${esc(x.no)}</span><span class="t2">${sameNick(x.name, i) ? '' : `${esc(i.name)} <span class="sep" aria-hidden="true">·</span> `}${esc(x.next.words)}</span></span></a></li>`;
}
// a group's rows: the first `cap` show, the rest wait behind "N more" (open when the picked row is among them)
function groupRows(list, cap, open, id, rowFn, selId) {
  const lis = list.map((x, k) => rowFn(x, x.id === selId).replace('<li>', k < cap || open ? '<li>' : '<li hidden data-extra>')).join('');
  const n = list.length - cap;
  const more = n > 0 ? `<p class="qline">${`<button class="btn text qt" type="button" id="${id}" aria-expanded="${open}" data-n="${n}">${esc(open ? 'Show fewer' : `${n} more`)}${ic('chevron-down')}</button>`}</p>` : '';
  return `<ul class="srows3" id="${id}L">${lis}</ul>${more}`;
}
function headline(n, m) {
  const a = n ? `${n} ${n === 1 ? 'step is' : 'steps are'} late or due today.` : '', b = m ? `${m} ${m === 1 ? 'bill has' : 'bills have'} no lead.` : '';
  return a || b ? `${a} ${b}`.trim() : 'Nothing needs the team today.';
}
const head = (view, n, m, h1) => `<${h1 ? 'h1' : 'h2'} class="tmt"${h1 ? ' tabindex="-1"' : ''}>Team</${h1 ? 'h1' : 'h2'}>`
  + `<div class="segs3 tmsw" role="group" aria-label="How to look at the team"><a class="seg" href="#/team"${view === 'one' ? ' aria-current="true"' : ''}>One at a time</a><a class="seg" href="#/team/many"${view === 'many' ? ' aria-current="true"' : ''}>Many at once</a></div>`
  + `<p class="tmh">${esc(headline(n, m))}</p>`;

// ---------------------------------------------------------------------------------- the sheets
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const leadOfIssue = s => { const i = s.issue?.id != null ? (S.issues || []).find(x => x.id === s.issue.id) : null; const a = i?.owner_id ? advocate(i.owner_id) : null; return a && a.is_active !== false ? a : null; };
// the Issue row: the issue's name and who leads it; when the issue is named what the bill is, only "Patti leads this issue"
const issueLine = (name, lead, billNm) => sameNick(billNm, { name }) ? (lead ? `${esc(pn(lead))} leads this issue` : '<span class="mute">No one leads this issue</span>') : `${esc(name)}${lead ? ` <span class="mute">· ${esc(pn(lead))} leads this issue</span>` : ''}`;
// the sheet's band, without the issue's small name above the heading when it only repeats the bill's name
const bandNoDup = (issue, title, sub, no, billNm) => band(issue, title, sub, no).replace(sameNick(billNm, issue) ? /<span class="crumb">[^<]*<\/span>/ : /^$/, '');

function stepSheet(r, me) {
  const s = r.step, h = r.holder, t = told.get(r.id), at = r.at;
  const title = h ? `${pn(h)}’s move: ${s.verb}` : s.verb;
  const strong = r.late ? (at != null ? `${left(at)} late` : 'Past due') : at != null ? `Due in ${left(at)}` : 'Due soon';
  const box = `<div class="strip${r.late ? '' : ' calm'}">${r.late ? ic('clock') : ''}<strong>${esc(strong)}</strong><span class="hl">${esc(whatWords(r))}</span></div>`;
  const facts = kv([['HIPHI’s position', `<b>${esc(billFacts(s.bill).pos)}</b>`], s.hearing?.scheduled_at ? ['Hearing', esc(hearTxt(s.hearing.scheduled_at).replace(/^./, c => c.toUpperCase()))] : null, ['Issue', issueLine(s.issue.name, leadOfIssue(s), s.name)]]);
  const msg = !h ? `<p class="lead mid tnob">Nobody has this step yet.</p>`
    : `<div class="tmsg">${personMark(me.initials, { small: true })}<div><b>${esc(pn(me))}</b><p>${esc(messageWords(r))}</p><p class="tsub" id="toldLine">${t ? `${esc(pn(h))} was told ${esc(clockWords(t.at))}.` : `${esc(pn(h))} has not been told yet.`}</p></div></div>`;
  const foot = h ? `<div class="sfoot">${t ? `<span class="toldmark" id="told">${ic('check')}<span>Told ${esc(clockWords(t.at))}</span> <span class="sep" aria-hidden="true">·</span> ${btn('Undo', { kind: 'text', id: 'untellBtn' })}</span>` : btn(`Tell ${pn(h)}`, { kind: 'filled', id: 'tellBtn' })}`
      + `${btn('Take this step', { kind: 'quiet', id: 'takeStep' })}${btn('Open the bill', { kind: 'quiet', href: billHref(s.bill) })}<p class="fnote">${esc(pn(h))} gets this in Slack. If you take the step, ${esc(pn(h))} is told too.</p></div>`
    : `<div class="sfoot">${btn('Take this step', { kind: 'filled', id: 'takeStep' })}${btn('Open the bill', { kind: 'quiet', href: billHref(s.bill) })}<p class="fnote">If you take the step, you lead the bill.</p></div>`;
  return `<div class="pn">${band(s.issue, title, s.name, s.no)}<div class="pbody">${box}${facts}${msg}${foot}</div></div>`;
}

function billSheet(x) {
  const b = x.b, f = billFacts(b), i = f.issue;
  const facts = kv([['HIPHI’s position', `<b>${esc(f.pos)}</b>`], ['Issue', issueLine(i.name, i.lead, x.name)], ['Where it stands', esc(f.stands)], f.next ? ['Next', esc(f.next)] : null]);
  return `<div class="pn">${bandNoDup(i, x.name, x.no, '', x.name)}<div class="pbody">${facts}<h2 class="tnl">Nobody leads this bill.</h2><p class="lead mid">Take it to lead it yourself, or give it to a teammate.</p>`
    + `<div class="sfoot">${btn('Take it', { kind: 'filled', id: 'takeIt' })}${btn('Give to…', { kind: 'quiet', href: `#/team/give/${enc(x.id)}` })}</div></div></div>`;
}
// who can be picked: every active teammate but the viewer (who has Take it), the issue's lead first
function givePeople(x, me) {
  const ld = x.issue.lead, all = people().filter(a => a.id !== me.id).sort((p, q) => String(p.full_name).localeCompare(String(q.full_name), 'en'));
  return ld && ld.id !== me.id ? [ld, ...all.filter(a => a.id !== ld.id)] : all;
}
const giveName = pn;
function giveSheet(x, me) {
  const i = x.issue, list = givePeople(x, me);
  if (ui.give.bill !== x.id) ui.give = { bill: x.id, pick: i.lead && i.lead.id !== me.id ? i.lead.id : '' };
  if (!list.some(a => a.id === ui.give.pick)) ui.give.pick = '';
  const rows = list.map(a => { const on = a.id === ui.give.pick, lead = i.lead && i.lead.id === a.id;
    return `<li><button class="grow${on ? ' on' : ''}" type="button" role="radio" aria-checked="${on}" data-id="${esc(a.id)}" data-name="${esc(giveName(a))}">${personMark(a.initials, { small: true })}<span class="gn"><b>${esc(giveName(a))}</b> <span class="gl">${esc(leadsWords(a))}</span>${lead ? `<span class="gflag">${ic('flag')}leads this issue</span>` : ''}</span><span class="gtick">${ic(on ? 'check' : 'chevron-right')}</span></button></li>`; }).join('');
  const p = list.find(a => a.id === ui.give.pick);
  return `<div class="pn">${bandNoDup(i, x.name, x.no, '', x.name)}<div class="pbody"><h2 class="gq" id="gq">Who should lead ${esc(x.name)}?</h2><ul class="gpick" role="radiogroup" aria-labelledby="gq">${rows}</ul>`
    + `<div class="sfoot">${btn(p ? `Give to ${giveName(p)}` : 'Give to…', { kind: 'filled', id: 'giveBtn', disabled: !p })}</div></div></div>`;
}

function doneSheet(d, nextHref) {
  const b = d.bill, who = overseer(S.me), look = who ? `${pn(who)} will look over the change.` : 'An admin will look over the change.';
  const title = d.kind === 'give' ? `${pn(d.to)} leads ${b.name} now.` : d.kind === 'step' ? `You have ${d.verb} on ${b.name} now.` : `You lead ${b.name} now.`;
  const sub = d.kind === 'give' ? `${look} ${pn(d.to)} is told.` : d.kind === 'step' ? `${look} ${d.holder ? `${pn(d.holder)} is told.` : 'Nothing else needs you.'}` : `${look} Nothing else needs you.`;
  const slack = messageBoxHTML(leadMessages([d.rec]));   // team_data.js: the same words everywhere
  return `<div class="pn"><div class="done enter tdone"><div class="dtile">${ic('check')}</div><h1 tabindex="-1">${esc(title)}</h1><p class="sub">${esc(sub)}</p>${slack}`
    + `${nextHref ? `<div class="actions">${btn('Next bill with no lead', { kind: 'quiet', href: nextHref })}</div>` : ''}</div></div>`;
}
const missing = (words, sub) => `<div class="pn">${plainBand(words, sub)}</div>`;

// ---------------------------------------------------------------------------------- the model (frame.js reads: col, sheet, picked, back, backLabel, label, bind, listOnly)
export function teamModel({ me, rt, open, phone }) {
  if (String(rt.id || '').split('/')[0] === 'many') return manyModel({ me, rt });   // the other view: team_many.js
  const rows = lateSteps(me), leads = noLeadBills();
  const [kind, ...rest] = String(rt.id || '').split('/'), key = rest.join('/');
  let sheet, label = 'Team', selId = '', picked = !!rt.id, showRows = true;
  if (kind === 'step') {
    const r = rows.find(x => x.id === key); selId = key;
    sheet = r ? stepSheet(r, me) : missing('That step is not late any more.', 'It may have been done, or someone took it.'); label = r ? 'A late step' : 'Not found';
  } else if (kind === 'bill' || kind === 'give') {
    const x = leads.find(y => y.id === key); selId = key;
    sheet = !x ? missing('That bill has a lead now.', 'Someone took it, or it has stopped.') : kind === 'give' ? giveSheet(x, me) : billSheet(x); label = x ? (kind === 'give' ? 'Give a bill' : 'A bill with no lead') : 'Not found';
  } else if (kind === 'done') {
    const d = ui.done[key]; picked = true;
    sheet = d ? doneSheet(d, (leads[0] && `#/team/bill/${enc(leads[0].id)}`) || '') : missing('That change is not on this page any more.', ''); label = 'Done';
  } else if (!rt.id || kind === '') {   // the first row opens (not on a phone, where the list shows first)
    const f = rows[0] ? { k: 'step', r: rows[0] } : leads[0] ? { k: 'bill', x: leads[0] } : null;
    if (f) { selId = f.k === 'step' ? f.r.id : f.x.id; sheet = f.k === 'step' ? stepSheet(f.r, me) : billSheet(f.x); label = f.k === 'step' ? 'A late step' : 'A bill with no lead'; }
    else sheet = `<div class="pn">${plainBand('Nothing needs the team today.', 'Every step is on time, and every bill has a lead.')}<div class="pbody"><p class="lead mid">New late steps and bills with no lead show here as they come.</p></div></div>`;
  } else { sheet = missing('That is not a page of Team.', ''); picked = true; }
  const inLate = rows.findIndex(r => r.id === selId) >= LATE_CAP && kind !== 'bill' && kind !== 'give', inLead = leads.findIndex(x => x.id === selId) >= LEAD_CAP && (kind === 'bill' || kind === 'give' || (!rt.id && !rows[0]));
  if (inLate) ui.moreLate = true; if (inLead) ui.moreLead = true;
  const ownLate = (open || []).filter(s => stepIsTeamLate(s, Date.now()) && stepIsLate(s, Date.now())).length;
  const lateSel = kind === 'step' || (!rt.id && rows[0]) ? selId : '', leadSel = kind === 'bill' || kind === 'give' || (!rt.id && !rows[0]) ? selId : '';
  const phoneList = phone && !picked;
  let col = head('one', rows.length, leads.length, phoneList);
  if (showRows) {
    col += `<section aria-labelledby="tlh"><h2 class="lh" id="tlh">Late or due today · ${rows.length}</h2>${rows.length ? groupRows(rows, LATE_CAP, ui.moreLate, 'moreLate', lateRow, lateSel) : '<p class="calmnote">Nothing is late.</p>'}</section>`;
    col += `<section aria-labelledby="tnh"><h2 class="lh" id="tnh">No lead yet · ${leads.length}</h2>${leads.length ? groupRows(leads, LEAD_CAP, ui.moreLead, 'moreLead', leadRow, leadSel) : '<p class="calmnote">Every bill has a lead.</p>'}</section>`;
    if (ownLate) col += `<p class="tfoot">${ownLate === 1 ? 'Your own late step is on' : `Your own ${ownLate} late steps are on`} <a class="btn text" href="#/">Home</a></p>`;
  }
  return { col, sheet, label, picked, fixedList: true, listOnly: !picked, back: picked ? '#/team' : '', backLabel: 'Team', bind: () => bind({ me, rows, leads, kind, key, rtId: rt.id }) };
}

// ---------------------------------------------------------------------------------- what the buttons do
function afterDone(rec, d) {
  ui.done[rec.id] = d;
  const title = d.kind === 'give' ? `${pn(d.to)} leads ${d.bill.name} now.` : d.kind === 'step' ? `You have ${d.verb} on ${d.bill.name} now.` : `You lead ${d.bill.name} now.`;
  location.hash = `#/team/done/${enc(rec.id)}`;
  addEventListener('hashchange', () => toast(title, { undo: () => undoMove(rec), ms: undoMs() }), { once: true });   // after the page is drawn, which clears the old toast
}
async function undoMove(rec) {
  const d = ui.done[rec.id]; if (!d) return;
  const r = await undoLeadChanges([rec]);
  if (r.refused) return fail(r.refused);
  if (d.msgId) S.messages[d.bill.b.id] = (S.messages[d.bill.b.id] || []).filter(m => m.id !== d.msgId);
  delete ui.done[rec.id];
  addEventListener('hashchange', () => toast('Put back. Nothing was changed.', { ms: 5000 }), { once: true });
  go(d.kind === 'step' ? `#/team/step/${enc(d.stepId)}` : `#/team/bill/${enc(d.bill.id)}`);
}
function bind({ me, rows, leads, kind, key, rtId }) {
  for (const [id, k] of [['moreLate', 'moreLate'], ['moreLead', 'moreLead']]) {
    const b = document.getElementById(id); if (!b) continue;
    b.addEventListener('click', () => { ui[k] = !ui[k]; const list = document.getElementById(id + 'L'); list.querySelectorAll('[data-extra]').forEach(li => { li.hidden = !ui[k]; }); b.setAttribute('aria-expanded', String(ui[k]));
      b.firstChild.textContent = ui[k] ? 'Show fewer' : `${b.dataset.n} more`; });
  }
  const stepR = kind === 'step' ? rows.find(x => x.id === key) : !rtId && rows[0] ? rows[0] : null;
  const billX = kind === 'bill' || kind === 'give' ? leads.find(x => x.id === key) : !rtId && !rows[0] ? leads[0] : null;
  const on = (id, fn) => document.getElementById(id)?.addEventListener('click', fn);
  if (stepR) {
    on('tellBtn', () => { if (told.has(stepR.id)) return; tell(stepR, me); draw({ focus: '#untellBtn' }); });   // once per step: a second click finds it told already
    on('untellBtn', () => { untell(stepR.id); draw({ focus: '#tellBtn' }); });
    on('takeStep', async () => {
      const s = stepR.step, bill = { b: s.bill, id: s.bill.id, name: s.name }, from = [...(S.assignments?.[s.bill.id] || [])].map(advocate).filter(Boolean);
      const r = await whileSaving(document.getElementById('takeStep'), 'Taking', one(s.bill.id, me.id));
      if (r.refused) return fail(r.refused);
      const rec = r.recs[0];
      let msgId = null;
      // live, the database tells the old lead itself (Slack); this in-memory note is the practice copy's
      if (stepR.holder && !leadsLiveOn()) { const m = { id: 'tm-' + Date.now().toString(36), bill_id: s.bill.id, advocate_id: me.id, body: `@${pn(stepR.holder)} ${pn(me)} took ${s.verb} for ${s.name}.`, created_at: new Date().toISOString(), to: stepR.holder.id };
        (S.messages ??= {})[m.bill_id] ??= []; S.messages[m.bill_id].push(m); msgId = m.id; }
      afterDone(rec, { kind: 'step', rec, bill, from, to: me, verb: s.verb, holder: stepR.holder, stepId: stepR.id, msgId });
    });
  }
  if (billX) {
    on('takeIt', async () => {
      const r = await whileSaving(document.getElementById('takeIt'), 'Taking', one(billX.id, me.id));
      if (r.refused) return fail(r.refused);
      const rec = r.recs[0]; afterDone(rec, { kind: 'take', rec, bill: billX, from: [], to: me });
    });
    document.querySelectorAll('.grow').forEach(g => g.addEventListener('click', () => {
      ui.give.pick = g.dataset.id;
      document.querySelectorAll('.grow').forEach(o => { const act = o === g; o.classList.toggle('on', act); o.setAttribute('aria-checked', String(act)); o.querySelector('.gtick').innerHTML = ic(act ? 'check' : 'chevron-right'); });
      const gb = document.getElementById('giveBtn'); gb.disabled = false; gb.textContent = `Give to ${g.dataset.name}`;
    }));
    on('giveBtn', async () => {
      const to = advocate(ui.give.pick); if (!to) return;
      const from = [...(S.assignments?.[billX.id] || [])].map(advocate).filter(a => a && a.id !== to.id);
      const r = await whileSaving(document.getElementById('giveBtn'), 'Giving', one(billX.id, to.id));
      if (r.refused) return fail(r.refused);
      const rec = r.recs[0]; afterDone(rec, { kind: 'give', rec, bill: billX, from, to });
    });
  }
}
