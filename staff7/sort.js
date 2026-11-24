// Staff7 Sort new bills (R-398): "New bills" on Issues. The list in the middle column (one row per bill, grouped by the coalition it will go under), the picked bill on the right
// (what it does and the four fields: Position, Issue, Coalition, Lead), and three ways to decide: Track, Not for us, Skip for now. Every decision shows a toast with Undo for 10 seconds, and
// "Just sorted" keeps this visit's decisions with an Undo each. The data side (queue, groups, defaults, the calls) is sort_data.js; the practice copy does it all in memory.
// State is kept in sort_data.js (U), never in the page, because render() replaces #app on every render and on a timed tick: what was chosen on each bill, the list's scroll, what is open.
import { S, DB, capitolUrl } from '../staff6/data.js';
import { keysOn } from '../staff6/ui.js';
import { ic } from './icons7.js';
import { esc, btn, toast, clearToast } from './parts.js';
import { billName, billNo, posWords } from './steps.js';
import { cmteLabel, codesOf } from './bill_words.js';
import { sponsorsHTML } from './bill.js';
import { bui } from './bill.js';
import { billTextUrl } from './bill_more.js';
import { eCig, billHref } from './issues.js';
import * as D from './sort_data.js';
import { mountIssueForm, newState, adminFirst } from './issue_new.js';   // R-398 piece 10: the New issue form, mounted here as a panel

const $ = id => document.getElementById(id), enc = encodeURIComponent;
const n = (k, one, many) => `${k.toLocaleString('en-US')} ${k === 1 ? one : many}`;
const ROUTE = /^#\/issues\/new(\/|\?|$)/;
const MINE = { kind: 'mine', code: '' };
const POS_PAST = { strongly_support: 'strongly supported', support: 'supported', support_amend: 'supported with amendments', strongly_oppose: 'strongly opposed', oppose: 'opposed', neutral: 'commented on', monitor: 'monitored' };
let cur = null;   // what is on the screen now: { me, mode, list, m (the open bill) }, for the keys and the buttons

export const hashFor = (no, mode) => `#/issues/new${no ? '/' + enc(no) : ''}${mode === 'all' ? '?show=all' : ''}`;

// ---------------------------------------------------------------------------------- Issues: the row under "The session"
export function entryRow(me) {
  const e = D.entryLine(me); if (!e) return '';
  return `<li><a class="sr3 ir" id="newBillsRow" href="#/issues/new"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('list-checks')}</span><span class="sv"><b>New bills</b><span class="ir2"><span id="newBillsN">${esc(e.text)}</span></span></span></a></li>`;
}

// ---------------------------------------------------------------------------------- the list
const posHint = pos => pos === 'monitor' ? 'Watching, no stance yet.' : '';
function rowHTML(m, on, mode) {
  const r = m.r, no = D.spaced(m.no), full = D.lineOne(r);
  // line 2: the number, then the Capitol's title (left out when line 1 already is the title); in a followed row, who follows it
  const l2 = m.group === 'followed' && m.followers ? `${esc(no)} · ${m.followers} ${m.followers === 1 ? 'person follows it' : 'people follow it'}` : r.description && String(r.description).trim() ? `${esc(no)} · ${esc(D.capTitle(r.title))}` : esc(no);
  const l3 = [];
  if (m.comp.length) l3.push(`Companion ${esc(m.comp.map(D.spaced).join(', '))}`);
  if (m.also.length) l3.push(`Also matches ${esc(m.also.map(D.cname).join(' and '))}’s words`);
  // line 1 is cut by fit() to two full lines at a word; without it (or before it runs) the style clamps it to two lines. The whole text stays for a screen reader.
  return `<li><a class="sr3 ir sortrow${m.group === 'weak' ? ' dead' : ''}${on ? ' sel' : ''}" href="${hashFor(m.no, mode)}"${on ? ' aria-current="true"' : ''} data-no="${esc(m.no)}"><span class="sv"><b><span class="nbt" data-full="${esc(full)}" aria-hidden="true">${esc(full)}</span><span class="vh">${esc(full)}</span></b>`
    + `<span class="ir2"><span class="l2c">${l2}</span></span>${l3.length ? `<span class="ir2"><span>${l3.join(' · ')}</span></span>` : ''}</span></a></li>`;
}
function justSorted(open) {
  const ds = D.U.decisions; if (!ds.length) return '';
  const rows = ds.map(d => `<li><div class="sr3 lt jr"><span class="sv"><b>${esc(D.spaced(d.no))}</b> <span class="stm">${esc(d.text)}</span></span>${btn('Undo', { kind: 'text', attrs: `data-undo="${esc(d.id)}" aria-label="${esc(`Undo ${D.spaced(d.no)}: ${d.text}`)}"` })}</div></li>`).join('');
  return `<section class="jgrp" aria-label="Just sorted"><button class="btn text qt" type="button" id="jsBtn" aria-expanded="${open}" aria-controls="jsList">Just sorted · ${ds.length}${ic('chevron-down')}</button><ul class="srows3" id="jsList"${open ? '' : ' hidden'}>${rows}</ul></section>`;
}
function emptyWords(me, mode) {
  const admin = D.isAdmin(me), done = D.U.decisions.length, other = admin ? D.otherN(0) : 0;
  if (done) return { h: `All sorted. You decided ${n(done, 'bill', 'bills')}.`, sub: admin && mode === 'matching' && other ? `New bills arrive each night. ${n(other, 'other new bill is', 'other new bills are')} under All new bills.` : 'New bills arrive each night.' };
  if (admin && mode === 'matching' && other) return { h: 'Nothing matches a coalition’s words.', sub: `${n(other, 'other new bill is', 'other new bills are')} under All new bills.` };
  if (!admin) return { h: 'Nothing matches your coalition’s words.', sub: 'New bills arrive each night.' };
  return { h: 'All sorted.', sub: 'New bills arrive each night.' };
}
function emptyActions(me, mode) {
  const other = D.isAdmin(me) && mode === 'matching' && D.otherN(0) > 0;
  return `<div class="actions">${other ? `<a class="btn quiet" id="showAllNew" href="${hashFor('', 'all')}">Show all new bills</a>` : ''}<a class="btn quiet" id="searchEvery" href="#/search">Search every bill</a></div>`;
}
function listHTML(me, mode, list, open) {
  const admin = D.isAdmin(me), rows = list.rows, N = rows.length;
  let h = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">New bills</h2></div>`;
  if (admin) h += `<div class="segs3" role="group" aria-label="Which new bills"><a class="seg" id="modeMatch" href="${hashFor('', 'matching')}"${mode === 'matching' ? ' aria-current="true"' : ''}>Matching words</a><a class="seg" id="modeAll" href="${hashFor('', 'all')}"${mode === 'all' ? ' aria-current="true"' : ''}>All new bills</a></div>`;
  h += '</header>';
  const tot = D.totalAll(), qn = rows.filter(m => m.q).length, c = D.countOf(me);
  const sum = mode === 'all' ? `${qn.toLocaleString('en-US')}${tot != null ? ` of ${tot.toLocaleString('en-US')}` : ''} · bills that match words come first · <a class="sl nw" id="searchLink" href="#/search">Search every bill</a>`
    : D.countText(c);
  h += `<p class="summ" id="sortSum" role="status">${sum}</p>`;
  if (!N) { const w = emptyWords(me, mode); h += `<div class="sortempty"><p class="sortmsg">${esc(w.h)}</p><p class="hint">${esc(w.sub)}</p>${emptyActions(me, mode)}</div>`; }
  for (const g of list.groups) h += `<section aria-labelledby="g-${esc(g.k.replace(/[^a-z0-9]/gi, '_'))}"><h3 class="glab" id="g-${esc(g.k.replace(/[^a-z0-9]/gi, '_'))}">${esc(g.label)} · ${g.rows.length}</h3><ul class="srows3">${g.rows.map(m => rowHTML(m, open && m.id === open.id, mode)).join('')}</ul></section>`;
  return h + justSorted(D.U.justOpen || !N);
}

// ---------------------------------------------------------------------------------- the page for the picked bill
const ext = (href, t) => `<a class="lk" target="_blank" rel="noopener" href="${esc(href)}">${esc(t)}${ic('external-link')}</a>`;
const keyHint = k => keysOn() ? ` <kbd class="fkey" aria-hidden="true">${k}</kbd>` : '';
// the Capitol's words, with the real word matches marked (a word counts only when it starts a word)
function mark(text, terms) {
  if (!terms.length) return esc(text);
  let out = '', i = 0; for (const x of text.matchAll(D.wordRe(terms, 'giu'))) { out += esc(text.slice(i, x.index)) + `<mark>${esc(x[0])}</mark>`; i = x.index + x[0].length; }
  return out + esc(text.slice(i));
}
const tracked = no => (S.bills || []).find(b => String(b.bill_number).replace(/\s/g, '') === no && b.tracked !== false) || null;
function factsHTML(m, list, mode) {
  const r = { ...m.r, ...D.extra(m.r) }, rows = [];   // extra: in real data, the introducers and committees read for this one bill
  rows.push(['What it does', mark(r.description ? D.tidy(r.description) : D.capTitle(r.title) + '.', m.terms)]);
  const l = r.lookalike;
  if (l && l.bill_number) {
    const t = tracked(String(l.bill_number).replace(/\s/g, '')), ln = D.spaced(l.bill_number), nm = t && String(t.id) === String(l.id) ? `<a class="lk" href="${billHref(MINE, t, '')}">${esc(ln)}</a>` : esc(ln);
    const c = l.coalition ? (S.campaigns || []).find(x => x.name === l.coalition) : null;
    rows.push(['Last session', `Looks like ${nm}${l.session_year ? ` (${esc(l.session_year)})` : ''}, which we ${esc(POS_PAST[l.position] || 'tracked')}${c || l.coalition ? `, under ${esc(D.cname(c) === 'No coalition' ? l.coalition : D.cname(c))}` : ''}`]);
  }
  if (m.comp.length) {
    const here = new Set(list.rows.map(x => x.no)), idx = S.snapshot?.index || [];
    rows.push(['Companion bills', m.comp.map(c => { const t = D.spaced(c), tr = tracked(c);
      return here.has(c) ? `<a class="lk" href="${hashFor(c, mode)}">${esc(t)}</a>` : tr ? `<a class="lk" href="${billHref(MINE, tr, '')}">${esc(t)}</a>` : idx.some(x => String(x.bill_number).replace(/\s/g, '') === c) ? `<a class="lk" href="#/search/other/${enc(c)}">${esc(t)}</a>` : esc(t); }).join(', ')]);
  }
  const sp = (r.sponsors || []).length ? sponsorsHTML({ id: r.id, bill_number: r.bill_number, sponsors: r.sponsors }) : '';
  if (sp) rows.push(['Introduced by', sp]);
  const refs = (r.referrals || []).map(String).filter(Boolean);
  if (refs.length) rows.push(['Referred to', refs.map(x => codesOf(x).map(c => `${esc(cmteLabel(c, r))} (${esc(c)})`).join(' with ')).join(', ')]);
  const sim = r.similar && r.similar.id ? (S.bills || []).find(b => b.id === r.similar.id && b.tracked !== false) : null;
  if (sim) rows.push(['Similar bill we track', `<a class="lk" href="${billHref(MINE, sim, '')}">${esc(eCig(billName(sim)))}</a> · ${esc(billNo(sim))} · ${esc(posWords(sim))}`]);
  if (r.followers) rows.push(['Followed by', `${esc(n(r.followers, 'person', 'people'))} on the public site`]);
  return `<dl class="kv bfacts" id="sFacts">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}
// the Issue field's choices: Suggested (or the placeholder), No issue yet, Same topic (the suggestion's topic), All issues
function issueOpts(f) {
  const sg = f.sg, L = D.liveIssues().slice().sort((a, b) => eCig(a.name).localeCompare(eCig(b.name), 'en')), near = sg ? L.filter(i => i !== sg && i.category === sg.category) : [], rest = L.filter(i => i !== sg && !near.includes(i));
  const o = i => `<option value="${esc(i.id)}"${f.issueId === i.id ? ' selected' : ''}>${esc(eCig(i.name))}${i.published_at ? '' : ' (draft)'}</option>`;   // a draft says so wherever it is listed (R-398 piece 10)
  // R-409: "No issue yet" sits straight after the first entry, above the long All issues list (it was last, under 90 issues)
  return (sg ? `<optgroup label="Suggested">${o(sg)}</optgroup>` : `<option value=""${f.issueId === '' ? ' selected' : ''} disabled>Choose an issue</option>`)
    + `<option value="none"${f.issueId === 'none' ? ' selected' : ''}>No issue yet</option>`
    + (near.length ? `<optgroup label="Same topic">${near.map(o).join('')}</optgroup>` : '') + `<optgroup label="All issues">${rest.map(o).join('')}</optgroup>`;
}
const sel = (id, lab, opts, after = '') => `<div class="df"><label class="fl" for="${id}">${lab}</label><select class="field bsel" id="${id}">${opts}</select>${after}</div>`;
const trackNote = (f, me) => f.canTrack ? (f.issue && !f.issue.published_at ? `${eCig(f.issue.name)} is a draft: only the team sees it until ${me?.is_admin ? 'you publish' : adminFirst() + ' publishes'} it.` : 'Only the team sees it. It is not on the public site until someone publishes it.') : 'Choose an issue, or No issue yet, to track it.';
function decideHTML(m, me) {
  const f = D.fieldsOf(m, me);
  const pos = D.POS_OPTS.map(([v, l]) => `<option value="${esc(v)}"${f.pos === v ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const camps = (S.campaigns || []).map(c => `<option value="${esc(c.id)}"${f.campId === c.id ? ' selected' : ''}>${esc(D.cname(c))}</option>`).join('') + `<option value=""${f.campId === '' ? ' selected' : ''}>No coalition</option>`;
  const lead = D.people(me).map(p => `<option value="${esc(p.id)}"${f.leadId === p.id ? ' selected' : ''}>${esc(p.label)}</option>`).join('');
  const other = m.also.length ? `Off everyone’s list, including ${m.also.map(D.cname).join(' and ')}’s.` : '';
  return `<div class="decide" id="decide"><div class="dfields">${sel('dPos', 'Position', pos)}${sel('dIss', 'Issue', issueOpts(f), '<button class="btn text dnew" type="button" id="dNewIssue" aria-haspopup="dialog">No issue fits? New issue</button>')}${sel('dCamp', 'Coalition', camps)}${sel('dLead', 'Lead', lead)}</div>`
    + `<div class="dhints"><p class="hint dpos" id="dPosHint">${esc(posHint(f.pos))}</p><p class="hint dwhy" id="dLeadWhy"${f.why ? '' : ' hidden'}>${esc(f.why ? f.why + '.' : '')}</p></div>`
    + `<div class="dacts"><div class="dcol"><button class="btn filled" type="button" id="sTrack" aria-keyshortcuts="T"${f.canTrack ? '' : ' disabled aria-describedby="dTrackNote"'}>Track${keyHint('T')}</button></div>`
    + `<div class="dcol"><button class="btn quiet" type="button" id="sNot" aria-keyshortcuts="N">Not for us${keyHint('N')}</button></div>`
    + `<div class="dcol"><button class="btn text" type="button" id="sSkip" aria-keyshortcuts="S">Skip for now${keyHint('S')}</button></div>`
    + `<p class="hint dnote" id="dTrackNote">${esc(trackNote(f, me))}</p><p class="hint dnote" id="dNotNote"${other ? '' : ' hidden'}>${esc(other)}</p></div></div>`;
}
function pageHTML(m, me, list, mode) {
  const r = m.r, no = D.spaced(m.no), back = hashFor('', mode);
  return `<div class="pn"><div class="hband bb fromissue" style="--ic:var(--edge)"><span class="imark big out" aria-hidden="true">${ic('file-text')}</span><div class="ht">`
    + `<p class="bline"><span class="bno">${esc(no)}</span><span class="bsep" aria-hidden="true">·</span>${ext(capitolUrl(r), 'The Capitol’s page')}<span class="bsep" aria-hidden="true">·</span>${ext(billTextUrl(r), 'Read the bill')}</p>`
    + `<h1 tabindex="-1">${esc(D.capTitle(r.title))}</h1></div></div><div class="pbody bill">${factsHTML(m, list, mode)}${decideHTML(m, me)}</div></div>`;
}
function emptyPage(me, mode) {
  const w = emptyWords(me, mode);
  return `<div class="pn"><div class="done"><div class="dtile">${ic('check')}</div><h1 tabindex="-1">${esc(w.h)}</h1><p class="sub">${esc(w.sub)}</p>${emptyActions(me, mode)}</div></div>`;
}
const waitPage = (title, sub, extra = '') => `<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">${esc(title)}</h1><p class="bsub">${esc(sub)}</p></div></div><div class="pbody">${extra}</div></div>`;

// ---------------------------------------------------------------------------------- the model Issues hands to the frame
export function sortModel({ me, rt }) {
  if (!D.sorts(me)) return null;
  const mode = rt.q.get('show') === 'all' && D.isAdmin(me) ? 'all' : 'matching', want = (rt.id || '').replace(/^new\/?/, '');
  D.ensure(me, mode);
  const base = { who: { ...MINE, show: '', topic: '' }, set: [], ses: null, label: 'New bills', back: '#/issues', backLabel: 'Issues', notFound: false, pageIssue: null };
  if (!D.ready(me, mode)) {
    cur = null; const bad = D.failed(me, mode);
    const col = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">New bills</h2></div></header>${bad ? '<p class="calmnote" role="alert">We could not load the new bills.</p><p><button class="btn quiet" type="button" id="sortRetry">Try again</button></p>' : '<p class="summ" id="sortSum" aria-busy="true">Loading the new bills…</p>'}`;
    return { ...base, col, sheet: waitPage(bad ? 'We could not load the new bills' : 'Loading the new bills', bad ? 'Nothing was changed. Try again.' : 'One moment.'), picked: false, bind: () => bindWait(me, mode) };
  }
  const list = D.listFor(me, mode), rows = list.rows;
  if (list.capped && rows.length < D.LOW) D.refill(me, mode);   // the server's list stopped at 400 and the rows are running low: read the next ones
  if (!rows.length && D.more(me, mode)) {
    cur = null;
    const col = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">New bills</h2></div></header><p class="summ" id="sortSum" aria-busy="true">Loading more new bills…</p>${justSorted(true)}`;
    return { ...base, col, sheet: waitPage('Loading more new bills', 'One moment.'), picked: false, bind: () => bindSort() };
  }
  const found = rows.find(x => x.no === want), m = found || (want ? rows[0] : rows.find(x => x.id === D.U.sel) || rows[0]) || null;
  if (want && !found) history.replaceState(history.state, '', hashFor(m ? m.no : '', mode));   // an unknown or already sorted number: the first bill opens and the address says so
  if (m) D.U.sel = m.id;
  cur = { me, mode, list, m };
  return { ...base, col: listHTML(me, mode, list, m), sheet: m ? pageHTML(m, me, list, mode) : emptyPage(me, mode), picked: !!want && !!m, back: hashFor('', mode), backLabel: 'New bills', bind: () => bindSort() };
}
const leave = () => { closePanel(false); cur = null; D.U.wlY = 0; };
addEventListener('hashchange', () => { if (!ROUTE.test(location.hash)) leave(); });

// ---------------------------------------------------------------------------------- two lines at a word
// Line 1 of a row runs to two full lines of the column and is cut at a word with "…". The lines are worked out with the font's own measure (no layout is read per row), from the column's width as it is now.
function cutTwo(text, w, ctx) {
  const words = text.split(' '), wid = s => ctx.measureText(s).width, lines = [''];
  let i = 0;
  for (; i < words.length; i++) {
    const t = lines[lines.length - 1] ? lines[lines.length - 1] + ' ' + words[i] : words[i];
    if (!lines[lines.length - 1] || wid(t) <= w) lines[lines.length - 1] = t; else if (lines.length < 2) lines.push(words[i]); else break;
  }
  if (i >= words.length) return text;
  const l2 = (lines[1] || '').split(' ');
  while (l2.length > 1 && wid(l2.join(' ') + '…') > w) l2.pop();
  return (lines[0] + ' ' + l2.join(' ')).replace(/[ ,;:]+$/, '') + '…';
}
let canvas = null, ro = null;
export function fit() {
  const els = [...document.querySelectorAll('.wl .nbt[data-full]')]; if (!els.length) return;
  canvas ||= document.createElement('canvas').getContext('2d');
  const w = els[0].getBoundingClientRect().width - 4; if (w <= 0) return;
  const fonts = new Map();   // a quieter row (Weak match) is set in a lighter weight: its own measure
  for (const el of els) {
    const k = el.closest('a').classList.contains('dead') ? 'dead' : 'std';
    if (!fonts.has(k)) { const cs = getComputedStyle(el); fonts.set(k, `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`); }
    canvas.font = fonts.get(k);
    const t = cutTwo(el.dataset.full, w, canvas); if (el.textContent !== t) el.textContent = t;
  }
}

// ---------------------------------------------------------------------------------- deciding
const hashNow = () => location.hash.split('?')[0];
// open a bill (or none) without adding a history entry: a decision is not a place to go back to
function show(no, opts = {}) {
  const mode = cur?.mode || 'matching', h = hashFor(no, mode);
  if (location.hash !== h) history.replaceState(history.state, '', h);
  window.__staff7Render({ focus: opts.focus || 'main h1' });
}
const after = (rows, id) => { const i = rows.findIndex(x => x.id === id); const rest = rows.filter(x => x.id !== id); return rest[i] || rest[i - 1] || null; };
function lock(on) { document.querySelectorAll('#decide .btn, #decide select').forEach(e => { if (on) { e.dataset.was = e.disabled ? '1' : ''; e.disabled = true; } else if (e.dataset.was !== undefined) { e.disabled = e.dataset.was === '1'; delete e.dataset.was; } }); }
async function decide(kind) {
  const c = cur; if (!c || !c.m || D.U.busy) return;
  const { me, m, list } = c;
  if (kind === 'track' && !D.fieldsOf(m, me).canTrack) return;
  D.U.busy = true; lock(true);
  const next = after(list.rows, m.id);
  try {
    const d = kind === 'track' ? await D.track(m, me) : await D.notForUs(m);
    show(next ? next.no : '');
    toast(d.toast, { undo: () => undoOne(d), ms: 10000, key: 'U' });
  } catch (e) {
    lock(false);
    toast(D.plainError(e, `${D.spaced(m.no)} was not ${kind === 'track' ? 'tracked' : 'set aside'}.`), { ms: 8000 });
  } finally { D.U.busy = false; }
}
async function undoOne(d) {
  if (D.U.busy) return;
  D.U.busy = true;
  try {
    const r = await D.undo(d);
    if (!r.gone) D.U.sel = d.id;
    show(r.gone ? '' : d.no); toast(r.said, { ms: 6000 });
  } catch (e) { toast(D.plainError(e, `${D.spaced(d.no)} was not put back.`), { ms: 10000 }); }
  finally { D.U.busy = false; }
}
function skipIt() {
  const c = cur; if (!c || !c.m || D.U.busy) return;
  const rows = c.list.rows, i = rows.findIndex(x => x.id === c.m.id), next = rows[i + 1] || rows.find(x => x.id !== c.m.id) || null;
  D.skip(c.m.id); show(next ? next.no : c.m.no);
}
function move(step) {
  const c = cur; if (!c || !c.m) return; const rows = c.list.rows, i = rows.findIndex(x => x.id === c.m.id), t = rows[i + step]; if (!t) return;
  D.U.sel = t.id; show(t.no);   // no new history entry per press
}

// ---------------------------------------------------------------------------------- the four fields change in place (nothing is drawn again, so the focus stays)
function patch() {
  const c = cur; if (!c || !c.m) return; const f = D.fieldsOf(c.m, c.me);
  const set = (id, fn) => { const e = $(id); if (e) fn(e); };
  set('dLead', e => { if (e.value !== f.leadId) e.value = f.leadId; });
  set('dLeadWhy', e => { e.textContent = f.why ? f.why + '.' : ''; e.hidden = !f.why; });
  set('dPosHint', e => { e.textContent = posHint(f.pos); });
  set('sTrack', e => { if (!D.U.busy) e.disabled = !f.canTrack; if (f.canTrack) e.removeAttribute('aria-describedby'); else e.setAttribute('aria-describedby', 'dTrackNote'); });
  set('dTrackNote', e => { e.textContent = trackNote(f, c.me); });
}
function bindSort() {
  const c = cur, wl = document.querySelector('.wl');
  if (wl) {
    wl.scrollTop = D.U.wlY; wl.addEventListener('scroll', () => { D.U.wlY = wl.scrollTop; }, { passive: true });
    const on = wl.querySelector('a.sel'); if (on) { const a = on.getBoundingClientRect(), b = wl.getBoundingClientRect(); if (a.top < b.top || a.bottom > b.bottom) { on.scrollIntoView({ block: 'nearest' }); D.U.wlY = wl.scrollTop; } }
    fit(); ro?.disconnect(); ro = new ResizeObserver(() => fit()); ro.observe(wl);
  }
  const js = $('jsBtn'); if (js) js.addEventListener('click', () => { D.U.justOpen = js.getAttribute('aria-expanded') !== 'true'; js.setAttribute('aria-expanded', String(D.U.justOpen)); $('jsList').hidden = !D.U.justOpen; });
  document.querySelectorAll('button[data-undo]').forEach(b => b.addEventListener('click', () => { const d = D.U.decisions.find(x => String(x.id) === b.dataset.undo); if (d) undoOne(d); }));
  document.querySelectorAll('button[data-bshow]').forEach(bt => bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true', id = bt.dataset.bshow, dd = bt.closest('dd');
    if (on) bui.all.add(id); else bui.all.delete(id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : 'Show all'; bt.setAttribute('aria-label', `${on ? 'Show fewer' : 'Show all'} introducers`);
    dd?.querySelector('[data-bs="short"]')?.toggleAttribute('hidden', on); dd?.querySelector('[data-bs="long"]')?.toggleAttribute('hidden', !on);
  }));
  if (!c || !c.m) return;
  const id = c.m.id, put = (k, v) => { (D.U.pick[id] ||= {})[k] = v; patch(); };
  $('dPos')?.addEventListener('change', e => put('pos', e.target.value));
  $('dIss')?.addEventListener('change', e => put('issue', e.target.value));
  $('dCamp')?.addEventListener('change', e => put('camp', e.target.value));
  $('dLead')?.addEventListener('change', e => put('lead', e.target.value));
  $('dNewIssue')?.addEventListener('click', openPanel);
  $('sTrack')?.addEventListener('click', () => decide('track'));
  $('sNot')?.addEventListener('click', () => decide('skip'));
  $('sSkip')?.addEventListener('click', skipIt);
}
// ---------------------------------------------------------------------------------- the New issue panel (R-398 piece 10, door two)
// "No issue fits? New issue" opens issue_new.js's form as a panel over the dimmed sort page. The panel lives on the body, outside #app, so a redraw of the page (a tick, a pick) never closes it or
// loses a word; the words themselves live in D.U.words per bill. Saving picks the new draft for this bill and the sort stays exactly where it was (list scroll, open bill, every other pick).
let pan = null;   // { el, id, opener } while the panel is open
const shortTitle = r => String(r.nickname || '').trim() || D.capTitle(r.title);   // the same name as the sort page's heading for the bill (or its nickname), not the long line-1 text
function closePanel(focus = true) {
  if (!pan) return;
  const { el, opener } = pan; pan = null;
  document.removeEventListener('keydown', panKey, true); el.remove();
  $('app')?.removeAttribute('inert'); $('bar-slot')?.removeAttribute('inert'); document.body.classList.remove('nipopen');
  if (focus) ($('dNewIssue') || opener)?.focus?.({ preventScroll: true });
}
function panKey(e) {
  if (!pan || e.isComposing) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePanel(); return; }
  if (e.key !== 'Tab') return;
  const fs = [...pan.el.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea, select')].filter(x => x.getClientRects().length), a = fs[0], z = fs[fs.length - 1];
  if (!fs.length) return;
  if (e.shiftKey && (document.activeElement === a || !pan.el.contains(document.activeElement))) { e.preventDefault(); z.focus(); }
  else if (!e.shiftKey && (document.activeElement === z || !pan.el.contains(document.activeElement))) { e.preventDefault(); a.focus(); }
}
function pickIssue(id, issue) { (D.U.pick[id] ||= {}).issue = issue; }
function afterPanel(then) {   // the page is drawn again from the data (nothing else changes), then the words are said
  closePanel(false); window.__staff7Render({ tick: true }); $('dNewIssue')?.focus({ preventScroll: true }); then();
}
function openPanel() {
  const c = cur; if (!c || !c.m || pan) return;
  clearToast();   // a toast from an earlier save must not cover the panel or its Save button
  const { m } = c, id = m.id, st = D.U.words[id] ||= newState();
  st.kept = !!(st.name || st.cat || st.desc); st.err = { name: '', cat: '', clash: null };
  const el = document.createElement('div'); el.className = 'nipwrap'; el.id = 'niPanel';
  el.innerHTML = `<div class="nipscrim" id="niScrim"></div><aside class="nipanel" role="dialog" aria-modal="true" aria-labelledby="niPanelH"><div class="niphead"><h2 id="niPanelH" tabindex="-1">New issue</h2><button class="xbtn" id="niPanelX" type="button" aria-label="Close">${ic('x')}</button></div>`
    + `<p class="nipfor">For <b>${esc(shortTitle(m.r))}</b> <span class="nipno">${esc(D.spaced(m.no))}</span>. It goes on the new issue once you track it.</p><div id="niPanelForm"></div></aside>`;
  document.body.appendChild(el); document.body.classList.add('nipopen');
  $('app')?.setAttribute('inert', ''); $('bar-slot')?.setAttribute('inert', '');
  pan = { el, id, opener: document.activeElement };
  document.addEventListener('keydown', panKey, true);
  el.querySelector('#niPanelX').addEventListener('click', () => closePanel());
  el.querySelector('#niScrim').addEventListener('click', () => closePanel());
  const f = mountIssueForm(el.querySelector('#niPanelForm'), { mode: 'panel', bill: m.r, state: st, who: c.me, onCancel: () => closePanel(),
    onUseExisting: i => { delete D.U.words[id]; pickIssue(id, i.id); afterPanel(() => toast(`${eCig(i.name)} is picked for this bill.`, { ms: 6000 })); },
    onSaved: i => {
      const prev = D.U.pick[id]?.issue, was = D.fieldsOf(m, c.me); pickIssue(id, i.id);   // `was`: what the Issue field showed before, so Undo can name it
      const back = was.issue ? `${eCig(was.issue.name)} is picked for this bill again.` : was.issueId === 'none' ? 'No issue yet is picked for this bill again.' : 'No issue is picked for this bill.';
      afterPanel(() => toast(`Saved ${eCig(i.name)} as a draft. It is picked for this bill.`, { undo: () => undoNew(id, i, prev, back), ms: 10000 }));
    } });
  f.focus();
}
// Undo: the draft is taken away again (archived: the record is hidden, never erased) and the pick goes back to what it was. A draft that already has a bill on it stays: its page removes it.
async function undoNew(id, i, prev, back) {
  const nm = eCig(i.name);
  if ((S.billIssues || []).some(x => x.issue_id === i.id)) { toast(`${nm} already has a bill on it, so it was kept. Remove it from its own page.`, { ms: 8000 }); return; }
  try { await DB.updateIssue(i.id, { archived_at: new Date().toISOString() }); }
  catch { toast(`The draft ${nm} was not taken away. Nothing was changed. Try again.`, { ms: 8000 }); return; }
  const p = D.U.pick[id]; if (p && p.issue === i.id) { if (prev === undefined) delete p.issue; else p.issue = prev; }
  window.__staff7Render({ tick: true }); toast(`Took the draft ${nm} away. ${back}`, { ms: 6000 });
}

function bindWait(me, mode) { $('sortRetry')?.addEventListener('click', () => { D.retry(me, mode); window.__staff7Render({}); }); }

// Keys: T track, N not for us, S skip for now, U undo the latest, the arrow keys move in the list. Only from the page itself (never in a field), and only when shortcuts are on in My settings.
document.addEventListener('keydown', e => {
  if (pan || !cur || !ROUTE.test(location.hash) || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || !keysOn()) return;
  const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 't') { e.preventDefault(); decide('track'); }
  else if (k === 'n') { e.preventDefault(); decide('skip'); }
  else if (k === 's') { e.preventDefault(); skipIt(); }
  else if (k === 'u') { const d = D.U.decisions[0]; if (d) { e.preventDefault(); undoOne(d); } }
  else if (k === 'ArrowDown' && !e.shiftKey) { e.preventDefault(); move(1); }
  else if (k === 'ArrowUp' && !e.shiftKey) { e.preventDefault(); move(-1); }
});
