// The legislator page (R-398 piece 12, part 3): what both styles share. leg_page_a.js lays the sections out as one column, leg_page_b.js as tabs; both get the section drawers below.
//   pageSheet(l, ctx) -> the page (strip, contact bar, the body);  bindPage(l, ctx) wires it (call after the page is in the document)
// Practice copy: every write is kept in memory for the tab with a 10-second Undo (nothing is sent). Live, the four staff-entered extras (staffer, contact person, what they care about)
// and the follow-up date are hidden because their table (migration 206) is not applied; Log a talk and the stance save for real (legislator_notes, legislator_stances).
import { S, DB, DEMO } from '../staff6/data.js';
import { esc, toast } from './parts.js';
import { ic } from './icons7.js';
import { dateWords } from './words.js';
import * as D from './leg_data.js';
import { talkHTML, bindTalk, TALK_DRAFTS } from './leg_talk.js';
import { renderA } from './leg_page_a.js';
import { renderB, bindTabs } from './leg_page_b.js';

const store = (k, v) => { try { if (v === undefined) return sessionStorage.getItem('lp.' + k); sessionStorage.setItem('lp.' + k, v); } catch { /* storage may be blocked */ } return null; };
// kept for the tab, between legislators
const U = { view: store('view') === 'team' ? 'team' : 'yours', style: DEMO && store('style') === 'B' ? 'B' : 'A', leg: null, tab: 'now', notes: false, open: {}, all: false, stance: '', form: '', pop: false };
const X = { staff: { 130: { name: 'Alana Perreira', phone: '808-586-6341', email: 'aperreira@capitol.example' } }, contact: {}, cares: { 130: { tags: ['Tobacco and e-cigarettes', 'Keiki health', 'Rural clinics'], text: 'Has said public health funding belongs in the base budget, not one-time money.' } } };   // PRACTICE ONLY, in memory
const extras = () => DEMO;
const fmt = iso => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Pacific/Honolulu' });
const dayOf = n => n.met_on ? String(n.met_on).slice(0, 10) : new Date(n.created_at).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const noteDay = n => fmt(dayOf(n) + 'T12:00:00-10:00');
const bLink = b => { const t = D.billLabel(b); return `<a class="lk" href="${esc(t.href)}">${esc(t.no)}</a> ${esc(t.name)}`; };
const bNo = b => { const t = D.billLabel(b); return `<a class="lk" href="${esc(t.href)}">${esc(t.no)}</a>`; };
const who = n => `<span class="lpwho">${esc(n)}</span> `;
const me0 = () => S.me;
let offPop = null;   // removes the last page's outside-click listener

// ------------------------------------------------------------------ the view switch
export function viewState(l) {
  const ob = D.ourBills(l, me0()), none = ob.yours === 0, view = none ? 'team' : U.view;
  return { ob, none, view };
}
function switchHTML(l) {
  const { ob, none, view } = viewState(l);
  return `<div class="lpsw"><span class="lpmut" id="lpShow">Showing</span><div class="segs3 lpsegs" role="group" aria-labelledby="lpShow">`
    + `<button class="seg" type="button" data-view="yours" aria-pressed="${view === 'yours'}"${view === 'yours' ? ' aria-current="true"' : ''}${none ? ' disabled' : ''}>Yours · ${ob.yours}</button>`
    + `<button class="seg" type="button" data-view="team" aria-pressed="${view === 'team'}"${view === 'team' ? ' aria-current="true"' : ''}>Whole team · ${ob.team}</button></div></div>`
    + (none ? `<p class="hint lpnone">You lead none of the bills with them.</p>` : '');
}

// ------------------------------------------------------------------ Now with them
function nowHTML(l) {
  const { view } = viewState(l), items = D.nowItems(l, view, me0()), team = view === 'team';
  const li = it => {
    const w = team ? who(it.who) : '';
    if (it.kind === 'followup') return `<li>${w}<a class="lk" href="${it.b ? esc(D.billLabel(it.b).href) : '#'}">Follow up${it.b ? ' on ' + esc(D.billLabel(it.b).no) : ''} by ${esc(dateWords(it.on))}</a></li>`;
    if (it.kind === 'ask') return `<li>${w}${bNo(it.b)} · no answer yet to our ask for a hearing</li>`;
    return `<li>${w}${bNo(it.b)} · we support · needs a hearing in ${esc(D.cfull(D.seatsOf(l.id).find(s => s.role === 'chair')?.committee || ''))} by ${esc(dateWords(it.by))} · <a class="lk" href="#/ask/${encodeURIComponent(it.askKey)}">Ask for a hearing</a></li>`;
  };
  return `<section class="lpsec" aria-labelledby="lpNowH"><h2 class="lph" id="lpNowH">Now with ${esc(D.surnameOf(l))}</h2>${items.length ? `<ul class="lpl">${items.map(li).join('')}</ul>` : `<p class="hint">Nothing needs ${team ? 'the team' : 'you'} with them now.</p>`}</section>`;
}

// ------------------------------------------------------------------ talks
const noteLi = n => `<li><p class="lpmeta">${who(D.advName(n.advocate_id))}· ${esc(noteDay(n))}${n.bill_id && S.bills.find(b => b.id === n.bill_id) ? ' · About ' + bNo(S.bills.find(b => b.id === n.bill_id)) : ''}</p><p class="lpbody">${esc(D.eCig(n.body))}</p></li>`;
function latestHTML(l, { allOpen = false } = {}) {
  const t = D.latestTalk(l), all = D.notesOf(l), b = t && S.bills.find(x => x.id === t.bill_id);
  const one = t ? `<p class="lpmeta"><b>${esc(D.advName(t.advocate_id))}</b> · ${esc(noteDay(t))}${b ? ' · About ' + bNo(b) : ''}</p><p class="lpbody">${esc(D.eCig(t.body))}</p>` : (all.length ? '' : `<p class="hint">No talk logged yet.</p>`);
  const open = allOpen || U.notes;
  const only = !t && all.length ? `<p class="hint">No talk logged yet${allOpen ? '' : ` · <button class="btn text lpbtn lpinl" type="button" data-act="notes" aria-expanded="${U.notes}">${U.notes ? 'Hide notes' : all.length === 1 ? '1 other note' : `${all.length} other notes`}</button>`}</p>` : '';
  return `<section class="lpsec" aria-labelledby="lpLatH"><h2 class="lph" id="lpLatH">Latest talk</h2>${one}${only}`
    + (all.length > 1 && t ? (allOpen ? '' : `<button class="btn text lpbtn" type="button" data-act="notes" aria-expanded="${U.notes}">${U.notes ? 'Hide notes' : `All notes (${all.length})`}</button>`) : '')
    + (open && all.length ? `<ul class="lpl lpnotes">${all.map(noteLi).join('')}</ul>` : '') + `</section>`;
}

// ------------------------------------------------------------------ our bills with them
function stanceCell(l, b) {
  if (U.stance === b.id) return `<label class="vh" for="lpSt">Where ${esc(l.name)} stands on ${esc(D.billLabel(b).no)}</label><select id="lpSt" data-stance-sel="${esc(b.id)}">${D.STANCE_OPTS.map(([v, t]) => `<option value="${v}"${D.stanceValue(l, b) === v ? ' selected' : ''}>${t}</option>`).join('')}</select> <button class="btn text" type="button" data-act="stance-x">Cancel</button>`;
  const v = D.stanceOf(l, b);
  return `<span class="lpsl">Where they stand:</span> <span class="lpsv">${esc(v)}</span> <button class="btn text" type="button" data-stance="${esc(b.id)}" aria-label="${v === 'Not known' ? 'Set' : 'Change'} where they stand on ${esc(D.billLabel(b).no)}">${v === 'Not known' ? 'Set' : 'Change'}</button>`;
}
function billsHTML(l) {
  const { ob, view } = viewState(l), team = view === 'team', keys = ['chair', 'vice', 'intro', 'sit'];
  const groups = keys.map(k => [k, ob[k].filter(b => team || D.isYours(b, me0()))]).filter(g => g[1].length);
  const n = groups.reduce((a, g) => a + g[1].length, 0), first = groups[0]?.[0];
  const rows = bs => bs.map(b => `<li class="lpbr"><div class="lpbm">${team ? who(D.leadName(b)) : ''}${bLink(b)}<p class="lpwh">${esc(D.whereWords(b))}</p></div><div class="lpst">${stanceCell(l, b)}</div></li>`).join('');
  const g = ([k, bs]) => {
    const on = U.open[k] ?? k === first;
    return `<div class="lpg"><h3 class="lpgh">${esc(D.GROUP_NAMES[k])} <span class="lpmut">(${bs.length})</span>${on ? '' : ` <button class="btn text lpbtn" type="button" data-fold="${k}" aria-expanded="false">Show ${bs.length}</button>`}</h3>${on ? `<div class="lpbrh" aria-hidden="true"><span>Bill</span><span>Where they stand</span></div><ul class="lpl lpbills">${rows(bs)}</ul>` : ''}</div>`;
  };
  return `<section class="lpsec" aria-labelledby="lpBillsH"><h2 class="lph" id="lpBillsH">Our bills with them <span class="lpmut">· ${n}</span></h2>${n ? groups.map(g).join('') : `<p class="hint">${team ? 'No bills we track are with them right now.' : 'You lead none of the bills with them.'}</p>`}</section>`;
}

// ------------------------------------------------------------------ asks, testimony, about
function asksHTML(l) {
  const asks = D.asksOf(l);
  return `<section class="lpsec" aria-labelledby="lpAskH"><h2 class="lph" id="lpAskH">What they said to our asks</h2>${asks.length ? `<ul class="lpl">${asks.map(a => `<li><p>${bLink(a.b)}</p><p class="lpmeta">Asked on ${esc(noteDay(a.first))} · <b>${esc(D.answerWords(a.last.answer))}</b></p></li>`).join('')}</ul>` : `<p class="hint">We have not asked them for a hearing yet.</p>`}</section>`;
}
function testimonyHTML(l) {
  const t = D.testimonyOf(l), shown = U.all ? t : t.slice(0, 3);
  return `<section class="lpsec" aria-labelledby="lpTesH"><h2 class="lph" id="lpTesH">Testimony we sent them <span class="lpmut">· ${t.length}</span></h2>${t.length ? `<ul class="lpl">${shown.map(({ b, d }) => `<li><p>${bLink(b)}</p><p class="lpmeta">Sent to ${esc(D.plain(String(d.committee || '').split(/[\/ ]+/).filter(Boolean).map(D.cname).join(' with ')))} on ${esc(fmt(String(d.filed_at)))}</p></li>`).join('')}</ul>` : `<p class="hint">No testimony has gone to their committees yet.</p>`}`
    + (t.length > 3 ? `<button class="btn text lpbtn" type="button" data-act="all" aria-expanded="${U.all}">${U.all ? 'Show 3' : `Show all ${t.length}`}</button>` : '') + `</section>`;
}
const contactOf = l => X.contact[l.id] || D.contactName(l, me0());
function aboutHTML(l) {
  if (!extras()) return '';
  const c = contactOf(l), cares = X.cares[l.id] || { tags: [], text: '' }, f = U.form;
  const contact = f === 'contact' ? `<form class="lpin" data-form="contact"><label class="vh" for="lpCt">Our contact person</label><select id="lpCt"><option value="">No one yet</option>${(S.advocates || []).filter(a => a.is_active !== false).map(a => `<option value="${esc(a.full_name)}"${a.full_name === c ? ' selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select> <button class="btn quiet" type="submit">Save</button> <button class="btn text" type="button" data-act="form-x">Cancel</button></form>`
    : `<p>${c ? `${esc(c)} is our contact here` : 'No one is our contact here yet'} · <button class="btn text lpbtn" type="button" data-act="form-contact">Change</button></p>`;
  const care = f === 'cares' ? `<form class="lpin" data-form="cares"><label for="lpCareT"><b>Topics</b> <span class="lpmut">separate with commas</span></label><input id="lpCareT" type="text" value="${esc(cares.tags.join(', '))}"><label for="lpCareN"><b>In their words</b></label><textarea id="lpCareN" rows="3">${esc(cares.text)}</textarea><div class="lpbtns"><button class="btn filled" type="submit">Save</button><button class="btn text" type="button" data-act="form-x">Cancel</button></div></form>`
    : `<h3 class="lpgh">What they care about <button class="btn text lpbtn" type="button" data-act="form-cares">Edit</button></h3>${cares.tags.length ? `<ul class="lptags">${cares.tags.map(t => `<li>${esc(D.eCig(t))}</li>`).join('')}</ul>` : ''}${cares.text ? `<p>${esc(D.eCig(cares.text))}</p>` : ''}${!cares.tags.length && !cares.text ? '<p class="hint">Nothing written yet.</p>' : ''}`;
  return `<section class="lpsec" aria-labelledby="lpAboutH"><h2 class="lph" id="lpAboutH">About them</h2>${contact}${care}</section>`;
}

// ------------------------------------------------------------------ the sections, handed to A and B
const sec = l => ({
  sw: () => switchHTML(l), now: () => nowHTML(l), latest: o => latestHTML(l, o), bills: () => billsHTML(l), asks: () => asksHTML(l), testimony: () => testimonyHTML(l), about: () => aboutHTML(l),
  notesAll: () => `<section class="lpsec" aria-labelledby="lpAllH"><h2 class="lph" id="lpAllH">All notes <span class="lpmut">· ${D.notesOf(l).length}</span></h2>${D.notesOf(l).length ? `<ul class="lpl lpnotes">${D.notesOf(l).map(noteLi).join('')}</ul>` : '<p class="hint">No notes yet.</p>'}</section>`,
  counts: { bills: (() => { const v = viewState(l); return v.view === 'yours' ? v.ob.yours : v.ob.team; })(), talks: D.notesOf(l).length }, tab: U.tab, extras: extras(),
});
function bodyHTML(l) { const s = sec(l); return U.style === 'B' ? renderB(s) : renderA(s); }

// ------------------------------------------------------------------ the strip and the contact bar
const stafferOf = l => X.staff[l.id] || null;
function barHTML(l) {
  const st = stafferOf(l), tel = l.phone ? `<a class="lpa lpdesk" href="${esc(D.phoneHref(l))}">${ic('phone')}<span>Call ${esc(l.phone)}</span></a>` : '', mail = l.email ? `<a class="lpa lpdesk" href="mailto:${esc(l.email)}">${ic('mail')}<span>Email</span></a>` : '';
  const staffer = extras() ? `<span class="lpstw"><button class="lpa" type="button" id="lpStaffBtn" aria-expanded="${U.pop}" aria-controls="lpStaffPop"><span>${st ? 'Staffer: ' + esc(st.name) : 'Staffer: add'}</span>${ic('chevron-down')}</button><div class="lppop" id="lpStaffPop"${U.pop ? '' : ' hidden'}>${staffPop(l)}</div></span>` : '';
  return `<div class="lpbar">${tel}${mail}${l.room ? `<span class="lpa lproom">${ic('map-pin')}<span>Room ${esc(l.room)}</span></span>` : ''}${staffer}</div><p class="lpsrc">Phone, email and room are from the Capitol’s records.</p>`;
}
function staffPop(l) {
  const st = stafferOf(l) || {};
  if (U.form === 'staff' || !stafferOf(l)) return `<form class="lpin" data-form="staff"><label for="lpSN"><b>Name</b></label><input id="lpSN" type="text" value="${esc(st.name || '')}"><label for="lpSP"><b>Phone</b></label><input id="lpSP" type="tel" value="${esc(st.phone || '')}"><label for="lpSE"><b>Email</b></label><input id="lpSE" type="email" value="${esc(st.email || '')}"><div class="lpbtns"><button class="btn filled" type="submit">Save</button><button class="btn text" type="button" data-act="staff-x">Cancel</button></div></form>`;
  return `<p><b>${esc(st.name)}</b></p>${st.phone ? `<p><a class="lk" href="tel:${esc(st.phone.replace(/[^\d+]/g, ''))}">${esc(st.phone)}</a></p>` : ''}${st.email ? `<p><a class="lk" href="mailto:${esc(st.email)}">${esc(st.email)}</a></p>` : ''}<button class="btn text lpbtn" type="button" data-act="staff-edit">Edit</button>`;
}
export function pageSheet(l) {
  const h = D.holds(l.id), mem = D.seatsOf(l.id).filter(s => s.role === 'member');
  const seat = [h.map(s => D.seatText(s)).join(' · '), mem.length ? 'Member: ' + mem.map(s => D.cname(s.committee)).join('; ') : ''].filter(Boolean).join(' · ');
  const strip = `<div class="hband neutral lgstrip lpstrip"><div class="lgin">${l.photo_url ? `<img class="lgph" src="${esc(l.photo_url)}" alt="" width="64" height="64">` : ''}<div class="ht"><h1 tabindex="-1">${esc(l.name)}</h1><p class="bsub">${esc(D.metaLine({ ...l, places: '' }))}${D.towns(l) ? `<span class="lptown"> · ${esc(D.towns(l))}</span>` : ''}</p>${seat ? `<p class="lgseat">${esc(seat)}</p>` : ''}</div><button class="btn filled lpact lpdeskbtn" type="button" id="lpTalkBtn" aria-controls="lpFormBox">Log a talk</button></div>`
    + `<div class="lpmob"><button class="btn filled" type="button" id="lpTalkBtnM" aria-controls="lpFormBox">Log a talk</button><div class="lpmrow">${l.phone ? `<a class="lpa" href="${esc(D.phoneHref(l))}">${ic('phone')}<span>Call</span></a>` : ''}${l.email ? `<a class="lpa" href="mailto:${esc(l.email)}">${ic('mail')}<span>Email</span></a>` : ''}</div></div>${barHTML(l)}</div>`;
  const foot = DEMO ? `<p class="lpfoot lpmut" id="lpFoot">Page style: <button class="btn text" type="button" data-style="A" aria-pressed="${U.style === 'A'}">A</button> · <button class="btn text" type="button" data-style="B" aria-pressed="${U.style === 'B'}">B</button></p>` : '';
  return `<div class="pn" data-sheet="legislator" data-leg="${l.id}">${strip}<div class="pbody mpage lgpage lpage" id="lgPageBody"><div id="lpFormBox"></div><div id="lpMain" class="lpstyle${U.style}">${''}</div>${foot}</div></div>`;
}

// ------------------------------------------------------------------ wiring
export function bindPage(l, ctx = {}) {
  const $ = id => document.getElementById(id), root = $('lgPageBody'); if (!root) return;
  if (U.leg !== l.id) { U.leg = l.id; U.tab = 'now'; U.notes = false; U.open = {}; U.all = false; U.stance = ''; U.form = ''; U.pop = false; }
  const keepFocus = sel => { const e = sel && document.querySelector(sel); e && e.focus && e.focus(); };
  const draw = focus => { $('lpMain').className = 'lpstyle' + U.style; $('lpMain').innerHTML = bodyHTML(l); wireMain(); keepFocus(focus); const pop = $('lpStaffPop'); if (pop) { pop.innerHTML = staffPop(l); pop.hidden = !U.pop; $('lpStaffBtn').setAttribute('aria-expanded', String(U.pop)); $('lpStaffBtn').firstElementChild.textContent = stafferOf(l) ? 'Staffer: ' + stafferOf(l).name : 'Staffer: add'; } document.querySelectorAll('#lpFoot [data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === U.style))); };
  // a write with a 10-second Undo
  const saved = (msg, undo, focus) => { toast(msg, { undo: () => { undo(); draw(focus); }, ms: 10000 }); draw(focus); };

  function wireMain() {
    const m = $('lpMain');
    m.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { U.view = b.dataset.view; store('view', U.view); draw(`#lpMain [data-view="${U.view}"]`); }));
    m.querySelectorAll('[data-act="notes"]').forEach(b => b.addEventListener('click', () => { U.notes = !U.notes; draw('#lpMain [data-act="notes"]'); }));
    m.querySelectorAll('[data-act="all"]').forEach(b => b.addEventListener('click', () => { U.all = !U.all; draw('#lpMain [data-act="all"]'); }));
    m.querySelectorAll('[data-fold]').forEach(b => b.addEventListener('click', () => { U.open[b.dataset.fold] = true; draw(); }));
    m.querySelectorAll('[data-stance]').forEach(b => b.addEventListener('click', () => { U.stance = b.dataset.stance; draw('#lpSt'); }));
    m.querySelector('[data-act="stance-x"]')?.addEventListener('click', () => { const id = U.stance; U.stance = ''; draw(`#lpMain [data-stance="${id}"]`); });
    const st = $('lpSt'); if (st) { st.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); const id = U.stance; U.stance = ''; draw(`#lpMain [data-stance="${id}"]`); } });
      st.addEventListener('change', async () => {
        const b = S.bills.find(x => x.id === st.dataset.stanceSel), prev = D.stanceValue(l, b), v = st.value; U.stance = '';
        try { await DB.setStance(b.id, l.id, { stance: v }); } catch { toast('It did not save. Try again.'); draw(); return; }
        saved(`Saved: ${D.STANCE_OPTS.find(x => x[0] === v)[1]} on ${D.billLabel(b).no}`, () => { DB.setStance(b.id, l.id, { stance: prev }); }, `#lpMain [data-stance="${b.id}"]`);
      }); }
    m.querySelectorAll('[data-act="form-contact"]').forEach(b => b.addEventListener('click', () => { U.form = 'contact'; draw('#lpCt'); }));
    m.querySelectorAll('[data-act="form-cares"]').forEach(b => b.addEventListener('click', () => { U.form = 'cares'; draw('#lpCareT'); }));
    m.querySelectorAll('[data-act="form-x"]').forEach(b => b.addEventListener('click', () => { U.form = ''; draw(); }));
    m.querySelector('form[data-form="contact"]')?.addEventListener('submit', e => { e.preventDefault(); const was = X.contact[l.id], v = $('lpCt').value; U.form = ''; X.contact[l.id] = v; saved('Saved the contact person', () => { was === undefined ? delete X.contact[l.id] : X.contact[l.id] = was; }); });
    m.querySelector('form[data-form="cares"]')?.addEventListener('submit', e => { e.preventDefault(); const was = X.cares[l.id]; U.form = ''; X.cares[l.id] = { tags: $('lpCareT').value.split(',').map(x => x.trim()).filter(Boolean), text: $('lpCareN').value.trim() }; saved('Saved what they care about', () => { was ? X.cares[l.id] = was : delete X.cares[l.id]; }); });
    if (U.style === 'B') bindTabs(m, t => { U.tab = t; U.pop = false; U.form = ''; draw(`#lpTab-${t}`); });
    if (U.style === 'A') void 0;
  }

  // Log a talk
  const openTalk = (focus = true) => {
    const box = $('lpFormBox'); box.innerHTML = talkHTML(l, TALK_DRAFTS[l.id]); $('lpTalkBtn')?.setAttribute('aria-expanded', 'true');
    bindTalk(l, { close: () => { box.innerHTML = ''; $('lpTalkBtn')?.setAttribute('aria-expanded', 'false'); ($('lpTalkBtn')?.offsetParent ? $('lpTalkBtn') : $('lpTalkBtnM'))?.focus(); },
      done: (row, undo) => { box.innerHTML = ''; $('lpTalkBtn')?.setAttribute('aria-expanded', 'false'); toast('Saved the talk', { undo: DEMO ? () => { undo(); draw(); } : null, ms: 10000 }); draw(); } });
    if (focus) { box.scrollIntoView?.({ block: 'nearest' }); $('lpTalkBody').focus(); }
  };
  $('lpTalkBtn')?.addEventListener('click', () => openTalk()); $('lpTalkBtnM')?.addEventListener('click', () => openTalk());
  if (TALK_DRAFTS[l.id]?.body?.trim()) openTalk(false);   // words typed before they left are still there (S-11)

  // staffer
  $('lpStaffBtn')?.addEventListener('click', () => { U.pop = !U.pop; U.form = ''; draw(U.pop ? '#lpStaffPop input, #lpStaffPop button' : '#lpStaffBtn'); });
  $('lpStaffPop')?.addEventListener('click', e => { const a = e.target.closest('[data-act]')?.dataset.act; if (a === 'staff-edit') { U.form = 'staff'; draw('#lpSN'); } if (a === 'staff-x') { U.form = ''; U.pop = false; draw('#lpStaffBtn'); } });
  $('lpStaffPop')?.addEventListener('submit', e => {
    e.preventDefault(); const was = X.staff[l.id], v = { name: $('lpSN').value.trim(), phone: $('lpSP').value.trim(), email: $('lpSE').value.trim() }; if (!v.name) { $('lpSN').focus(); return; }
    U.form = ''; X.staff[l.id] = v; saved('Saved the staffer', () => { was ? X.staff[l.id] = was : delete X.staff[l.id]; }, '#lpStaffBtn');
  });
  $('lpStaffPop')?.addEventListener('keydown', e => { if (e.key === 'Escape') { U.pop = false; U.form = ''; draw('#lpStaffBtn'); } });
  // the staffer popover closes on a click outside it, on a route change and when the tab or style changes
  const closePop = () => { if (!U.pop) return; U.pop = false; U.form = ''; if ($('lpMain')) draw(); };
  const away = e => { if (!document.getElementById('lgPageBody')) { U.pop = false; return; } if (U.pop && !e.composedPath().some(n => n.classList?.contains('lpstw'))) closePop(); };
  offPop?.(); document.addEventListener('click', away); window.addEventListener('hashchange', closePop);
  offPop = () => { document.removeEventListener('click', away); window.removeEventListener('hashchange', closePop); };
  // Page style (practice only)
  $('lpFoot')?.addEventListener('click', e => { const s = e.target.closest('[data-style]')?.dataset.style; if (s) { U.style = s; U.pop = false; U.form = ''; store('style', s); draw(`#lpFoot [data-style="${s}"]`); } });
  void ctx; draw();
}
