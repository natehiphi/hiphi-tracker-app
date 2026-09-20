// Staff v2 · Bills: what the list shows (scope, search, filters) and the one Filter sheet (plan 3.4).
// The facet logic is the current app's, unchanged: any value inside a group, every group together, a live count on
// every option, and options that would leave nothing are disabled. passes() from model.js does the shared facets and
// flags; this file adds the two groups the current app handled elsewhere (owner, which was the teammate scope, and
// committee) so every count in the sheet comes from one function, passAll().
import { S, DEMO, esc, advocate, effStage, STAGES, isMine, hooks } from './data.js';
import { factsOf, facets, FACTS, passes, diedish, codesOf, plain } from './model.js';
import { icon, btn, openSheet, closeSheet, POS_ICON, POS_WORD } from './ui.js';

const KEY = 'hiphi2_bills' + (DEMO ? '_demo' : '');
export const wideNow = () => matchMedia('(min-width: 900px)').matches;
// ui.js closes a menu sheet with history.back(), which lands a moment after the item's action starts. A page change or
// a new sheet opened before it lands is undone by it (the URL stays behind, the next sheet loses its Back entry). An
// action run from a menu waits for it first; when nothing is pending it goes straight on.
export const settled = () => !history.state?.sheet ? Promise.resolve() : new Promise(res => {
  const t = setTimeout(res, 400); addEventListener('popstate', () => { clearTimeout(t); setTimeout(res, 0); }, { once: true }); });

// A keyboard and a mouse (never a touch screen): where row keys and their hints belong.
export const hoverNow = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
// Typing in a field is never a shortcut.
export const typingIn = el => !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

// ---- the pages under Bills (Sort new bills, Weekly memo, Muted bills) ----
// On a desktop the frame draws no back arrow, so each of these pages draws this link above its title (the assessment
// found no way back but the browser's button). Opened from the Bills list, it is a real Back, so the list returns
// where it was (the frame does that for data-back); opened from the sidebar or a link, it goes to the list.
// While a page renders, body[data-screen] still names the page before it (the frame sets it after render()).
const SUB = { key: '', fromList: false };
export function deskBack(key) {   // key: 'triage' | 'memo' | 'muted' (muted bills is a page of the 'bills' screen)
  const v = bl(), prev = document.body.dataset.screen || '';
  const again = SUB.key === key && (key === 'muted' ? prev === 'bills' && !!v.lastMuted : prev === key);   // a redraw of the same page
  if (!again) { SUB.key = key; SUB.fromList = prev === 'bills' && !v.lastMuted; }
  return `<a class="bl-deskback" href="#/bills"${SUB.fromList ? ' data-back' : ''}>${icon('chevron-left')}<span>Bills</span></a>`;
}

// Everything the Bills screens remember. The shared facet sets (S.pris, S.poss…) live on S because passes() reads
// them there; the rest lives on S.bl so nothing else in the app is touched.
export function bl() {
  if (!S.bl) {
    S.bl = { scope: 'me', q: '', owners: new Set(), cmtes: new Set(), folds: {}, cols: new Set(), compact: false, selecting: false, sel: new Set(), sort: null, fopen: new Set() };
    load();
  }
  return S.bl;
}
function load() {
  const v = S.bl;
  let f = null; try { f = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* private window: start clean */ }
  S.pris = new Set(); S.poss = new Set(); S.stands = new Set(); S.camps = new Set(); S.lsts = new Set();
  S.hearF = false; S.riskF = false; S.tripleF = false; S.aliveF = false; S.stageF = '';   // "Still alive" is the folded Did not advance group now
  if (!f) return;
  // Ids are checked against what exists today, so a deleted coalition or teammate never leaves a filter nobody can see.
  const ok = (arr, pool) => (arr || []).filter(x => pool.includes(x));
  v.scope = f.scope === 'all' ? 'all' : 'me';
  S.pris = new Set(ok(f.pris, [1, 2, 3]));
  S.poss = new Set(ok(f.poss, ['strongly_support', 'support', 'support_amend', 'strongly_oppose', 'oppose', 'neutral', 'monitor']));
  S.stands = new Set(ok(f.stands, ['a', 'b', 'c', 'done', 'dead']));
  S.camps = new Set(ok(f.camps, S.campaigns.map(c => c.id)));
  S.lsts = new Set(ok(f.lsts, (S.lists || []).map(l => l.id)));
  S.hearF = !!f.hearF; S.riskF = !!f.riskF; S.tripleF = !!f.tripleF;
  S.stageF = STAGES.some(([k]) => k === f.stageF) ? f.stageF : '';
  v.owners = new Set(ok(f.owners, ['none', ...S.advocates.map(a => a.id)]));
  v.cmtes = new Set(f.cmtes || []);
  v.cols = new Set(ok(f.cols, ['cmte', 'coal', 'last', 'pulse']));
  v.compact = !!f.compact;
}
export function save() {
  const v = bl();
  try { localStorage.setItem(KEY, JSON.stringify({ scope: v.scope, pris: [...S.pris], poss: [...S.poss], stands: [...S.stands], camps: [...S.camps], lsts: [...S.lsts], hearF: S.hearF, riskF: S.riskF, tripleF: S.tripleF, stageF: S.stageF, owners: [...v.owners], cmtes: [...v.cmtes], cols: [...v.cols], compact: v.compact })); } catch { /* storage full or blocked: filters just are not remembered */ }
}

// ---- the list ----
export const cmtesOf = b => [...new Set([...(b.referrals || []), b.committee].flatMap(codesOf))];
const matchQ = (b, q) => { const n = q.replace(/\s/g, '').toLowerCase();
  return b.bill_number.toLowerCase().includes(n) || [b.nickname, b.title, b.description, b.public_summary].some(t => plain(t).includes(q)); };
// Whose bills: Mine = owned or followed and not muted (the current app's isMine); Everyone = every tracked bill.
// Monitor bills that died stay out (234 of Nate's 289 monitor bills are dead clerical noise); a search finds them.
export function baseBills(scope = bl().scope) {
  const q = plain(bl().q.trim());
  return (scope === 'me' ? S.bills.filter(isMine) : S.bills).filter(b => (!q || matchQ(b, q)) && (q || b.position !== 'monitor' || !diedish(b)));
}
const ownerHas = (b, o) => o === 'none' ? !(S.assignments[b.id] || []).length : (S.assignments[b.id] || []).includes(o);
export function passAll(b, skip) {
  const v = bl();
  if (!passes(b, skip)) return false;
  if (skip !== 'owners' && v.owners.size && ![...v.owners].some(o => ownerHas(b, o))) return false;
  if (skip !== 'cmtes' && v.cmtes.size && !cmtesOf(b).some(c => v.cmtes.has(c))) return false;
  return true;
}
export const shownBills = (scope) => baseBills(scope).filter(b => passAll(b));
export const liveCount = list => list.filter(b => b.position !== 'monitor' && factsOf(b).stand !== 'dead').length;
// passes() has no "skip" for the one-value stage filter, so its own count lifts it for a moment (picking another
// stage replaces the current one, so each stage shows what it would give on its own).
const cnt = (list, skip, test) => {
  const st = S.stageF; if (skip === 'stageF') S.stageF = '';
  try { return list.filter(b => passAll(b, skip) && test(factsOf(b), b)).length; } finally { S.stageF = st; }
};
export const quickCount = (spec, test) => cnt(baseBills(), spec.split(':')[0], test);
export const freshFacts = () => FACTS.clear();   // positions, coalitions and lists change under the list; facts are cheap to rebuild

// ---- what is switched on ----
// The quick chips are three of the same filters, one tap away. Muted is a place, not a filter, so it is a link.
export const QUICK = [['riskF', 'At risk', f => f.risk], ['hearF', 'Hearing this week', f => f.hear], ['poss:monitor', 'No position yet', f => f.posx === 'monitor']];
const STAND_WORD = { a: 'Waiting for a hearing', b: 'Hearing scheduled', c: 'Through its committees', done: 'At the governor or law', dead: 'Did not advance' };
const FLAG_WORD = { riskF: 'At risk', hearF: 'Hearing this week', tripleF: 'Three or more committees' };
export const isOn = spec => { const i = spec.indexOf(':'), k = i < 0 ? spec : spec.slice(0, i), raw = i < 0 ? '' : spec.slice(i + 1);
  if (i < 0) return !!S[k];
  if (k === 'stageF') return S.stageF === raw;
  const set = k === 'owners' || k === 'cmtes' ? bl()[k] : S[k];
  return set.has(k === 'pris' ? Number(raw) : raw); };
export function toggle(spec) {
  const i = spec.indexOf(':'), k = i < 0 ? spec : spec.slice(0, i), raw = i < 0 ? '' : spec.slice(i + 1);
  if (i < 0) S[k] = !S[k];
  else if (k === 'stageF') S.stageF = S.stageF === raw ? '' : raw;
  else { const set = k === 'owners' || k === 'cmtes' ? bl()[k] : S[k], v = k === 'pris' ? Number(raw) : raw; set.has(v) ? set.delete(v) : set.add(v); }
  changed();
}
export function clearAll() {
  const v = bl();
  S.pris = new Set(); S.poss = new Set(); S.stands = new Set(); S.camps = new Set(); S.lsts = new Set();
  S.hearF = false; S.riskF = false; S.tripleF = false; S.stageF = ''; v.owners = new Set(); v.cmtes = new Set();
  changed();
}
// Each new filter state starts with sensible folds again (a group opens when it is all there is to see).
export function changed() { bl().folds = {}; save(); }
const ownerWord = id => id === 'none' ? 'No owner' : id === S.me?.id ? 'You' : (advocate(id)?.full_name || 'Someone');
const cmteName = c => S.committees?.[c]?.name || '';
// [spec, label] for every filter that is on, in the sheet's order
export function activeFilters() {
  const v = bl(), out = [];
  for (const o of v.owners) out.push([`owners:${o}`, ownerWord(o)]);
  for (const p of S.poss) out.push([`poss:${p}`, p === 'monitor' ? 'No position yet' : POS_WORD[p] || p]);
  for (const p of [...S.pris].sort()) out.push([`pris:${p}`, `P${p}`]);
  for (const s of S.stands) out.push([`stands:${s}`, STAND_WORD[s] || s]);
  if (S.stageF) out.push([`stageF:${S.stageF}`, `Stage: ${STAGES.find(([k]) => k === S.stageF)?.[1] || S.stageF}`]);
  for (const k of ['hearF', 'riskF', 'tripleF']) if (S[k]) out.push([k, FLAG_WORD[k]]);
  for (const c of S.camps) out.push([`camps:${c}`, S.campaigns.find(x => x.id === c)?.name || 'Coalition']);
  for (const l of S.lsts) out.push([`lsts:${l}`, (S.lists || []).find(x => x.id === l)?.title || 'List']);
  for (const c of v.cmtes) out.push([`cmtes:${c}`, c]);
  return out;
}
export const filterCount = () => activeFilters().length;

// ---- the Filter sheet: half height on phones (drag up for more), a 400px popover under the button on desktop ----
const opt = (spec, label, n, { ic, title } = {}) => { const on = isOn(spec);
  // A chip that is on carries a tick (never colour alone), the same as the quick chips and the Supporters filter.
  return `<button type="button" class="chip bl-opt" data-ft="${esc(spec)}" aria-pressed="${on}" ${!on && !n ? 'disabled' : ''}${title ? ` title="${esc(title)}"` : ''}>${on ? icon('check') : ic ? icon(ic) : ''}<span>${esc(label)}</span><span class="bl-n">${n}</span></button>`; };
const group = (title, inner, key) => `<section class="bl-fg" aria-labelledby="bl-fg-${key}"><h3 id="bl-fg-${key}">${title}</h3><div class="chips">${inner}</div></section>`;
function sheetBody() {
  const v = bl(), base = baseBills(), f = Object.fromEntries(facets().map(g => [g.key, g]));
  const ads = S.advocates.filter(a => a.is_active !== false).sort((a, b) => (b.id === S.me?.id) - (a.id === S.me?.id) || a.full_name.localeCompare(b.full_name));
  // Owners, coalitions and lists show only when they have a bill in this scope (or are switched on): under Mine,
  // ten teammates at zero would push every useful group below the fold.
  const inBase = test => v => v.on || base.some(b => test(b, v.id));
  const owners = [...ads.map(a => ({ id: a.id, l: a.id === S.me?.id ? 'You' : a.full_name })), { id: 'none', l: 'No owner' }].map(o => ({ ...o, on: v.owners.has(o.id) }))
    .filter(inBase(ownerHas)).map(({ id, l }) => opt(`owners:${id}`, l, cnt(base, 'owners', (x, b) => ownerHas(b, id)))).join('');
  const poss = f.poss.opts.map(([k]) => opt(`poss:${k}`, k === 'monitor' ? 'No position yet' : POS_WORD[k] || k, cnt(base, 'poss', x => x.posx === k), { ic: POS_ICON[k === 'monitor' ? '' : k] })).join('');
  const pris = [1, 2, 3].map(p => opt(`pris:${p}`, `P${p}`, cnt(base, 'pris', x => x.pri === p))).join('');
  const stands = ['b', 'a', 'c', 'done', 'dead'].map(k => opt(`stands:${k}`, STAND_WORD[k], cnt(base, 'stands', x => x.stand === k))).join('');
  const stages = STAGES.map(([k, l]) => [k, l, cnt(base, 'stageF', (x, b) => effStage(b) === k)]).filter(([k, , n]) => n || S.stageF === k).map(([k, l, n]) => opt(`stageF:${k}`, l, n)).join('');
  const hear = opt('hearF', 'This week', cnt(base, 'hearF', x => x.hear), { title: 'A hearing in the next 7 days' }) + opt('riskF', 'At risk: no hearing yet', cnt(base, 'riskF', x => x.risk), { title: 'No hearing, and the deadline is a week away or less' });
  const camps = S.campaigns.map(c => ({ id: c.id, l: c.name, on: S.camps.has(c.id) })).filter(inBase((b, id) => factsOf(b).camps.includes(id)))
    .map(({ id, l }) => opt(`camps:${id}`, l, cnt(base, 'camps', x => x.camps.includes(id)))).join('');
  const lists = (S.lists || []).map(l => ({ id: l.id, l: l.title, on: S.lsts.has(l.id) })).filter(inBase((b, id) => factsOf(b).lsts.includes(id)))
    .map(({ id, l }) => opt(`lsts:${id}`, l, cnt(base, 'lsts', x => x.lsts.includes(id)))).join('');
  // Committees: every one these bills are referred to, busiest first, with its name beside the code.
  const seen = new Map(); for (const b of base) for (const c of cmtesOf(b)) seen.set(c, 0);
  for (const c of v.cmtes) seen.set(c, 0);
  const cms = [...seen.keys()].map(c => [c, cnt(base, 'cmtes', (x, b) => cmtesOf(b).includes(c))]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const cmRows = cms.map(([c, n]) => { const on = v.cmtes.has(c);
    return `<button type="button" class="bl-crow" data-ft="cmtes:${esc(c)}" aria-pressed="${on}" ${!on && !n ? 'disabled' : ''}>${icon(on ? 'square-check-big' : 'square')}<b>${esc(c)}</b><span class="bl-cname">${esc(cmteName(c))}</span><span class="bl-n">${n}</span></button>`; }).join('');
  const fold = (key, title, sub, inner) => { const open = v.fopen.has(key);
    return `<details class="bl-fold" data-fkey="${key}" ${open ? 'open' : ''}><summary><h3>${title}</h3>${sub ? `<span class="bl-fsub">${esc(sub)}</span>` : ''}${icon('chevron-down', { cls: 'chev' })}</summary><div class="bl-fin">${inner}</div></details>`; };
  const cmOn = [...v.cmtes], stOn = S.stageF ? STAGES.find(([k]) => k === S.stageF)?.[1] : '';
  return `<div class="bl-fs">
    ${group('Owner', owners, 'own')}
    ${group('Position', poss, 'pos')}
    ${group('Priority', pris, 'pri')}
    ${group('Where it stands', stands, 'st')}
    ${fold('stage', 'Exact stage', stOn || '', `<div class="chips">${stages}</div>`)}
    ${group('Hearing', hear, 'hear')}
    ${camps ? group('Coalition', camps, 'camp') : ''}
    ${lists ? group('List', lists, 'list') : ''}
    ${fold('cmte', 'Committee', cmOn.length ? cmOn.join(', ') : S.tripleF ? 'Three or more' : 'Referred to', `<div class="chips bl-trip">${opt('tripleF', 'Three or more committees', cnt(base, 'tripleF', x => x.triple), { title: 'Triple-referred in one chamber: it must clear its first committee by the triple filing deadline' })}</div><div class="bl-crows">${cmRows}</div>`)}
    <p class="bl-fhow">Inside a group, a bill needs any one choice. Across groups, it needs all of them.</p>
  </div>`;
}
const footHTML = () => { const n = shownBills().length, any = filterCount();
  return `${btn('Clear all', { kind: 'text', cls: 'bl-fclear', attrs: { 'data-fclear': '1', disabled: !any } })}${btn(`Show ${n} bill${n === 1 ? '' : 's'}`, { attrs: { 'data-fdone': '1' } })}`; };

export function openFilters(anchor) {
  const wide = wideNow();
  let d = null;
  const paint = keepSpec => {
    freshFacts();
    const body = d.querySelector('.sv-sh-body'), y = body.scrollTop;
    body.innerHTML = sheetBody(); body.scrollTop = y;
    d.querySelector('.sv-sh-foot').innerHTML = footHTML();
    wireSheet();
    if (keepSpec) d.querySelector(`[data-ft="${CSS.escape(keepSpec)}"]`)?.focus({ preventScroll: true });
  };
  const wireSheet = () => {
    d.querySelectorAll('[data-ft]').forEach(el => el.onclick = () => { toggle(el.dataset.ft); hooks.render(); paint(el.dataset.ft); });
    d.querySelectorAll('details[data-fkey]').forEach(el => el.ontoggle = () => { const s = bl().fopen; el.open ? s.add(el.dataset.fkey) : s.delete(el.dataset.fkey); });
    d.querySelector('[data-fclear]').onclick = () => { clearAll(); hooks.render(); paint(); };
    d.querySelector('[data-fdone]').onclick = () => closeSheet();
  };
  freshFacts();
  d = openSheet({ title: 'Filter bills', size: wide ? 'auto bl-pop' : 'half bl-fsheet', body: sheetBody(), foot: footHTML(),
    wire: dlg => { d = dlg; wireSheet(); if (wide) placePop(dlg, anchor); else dragToGrow(dlg); } });
  return d;
}
// Desktop: the sheet sits under the button that opened it, like a popover, and keeps the page visible beside it.
export function placePop(d, anchor) {
  if (!anchor || !anchor.isConnected) return;
  const r = anchor.getBoundingClientRect(), w = Math.min(400, innerWidth - 32);
  const left = Math.max(16, Math.min(r.right - w, innerWidth - w - 16)), top = Math.round(r.bottom + 8);
  Object.assign(d.style, { left: left + 'px', top: top + 'px', width: w + 'px', maxHeight: `calc(100vh - ${top + 16}px)` });
}
// Phone: the sheet opens at about two thirds of the screen; drag the handle up for the full height, down to close.
export function dragToGrow(d) {
  const head = d.querySelector('.sv-sh-head'), grab = d.querySelector('.sv-sh-grab');
  let y0 = null, dragged = false;
  const down = e => { if (e.target.closest('button')) return; y0 = e.clientY; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* old browser: the lift still counts where it lands */ } };
  const up = e => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; dragged = Math.abs(dy) > 10;
    if (dy < -24) d.classList.add('bl-tall'); else if (dy > 80) { if (d.classList.contains('bl-tall')) d.classList.remove('bl-tall'); else closeSheet(); } };
  // A drag that ends off the sheet makes a click on the backdrop, which would close it: that click is not a tap.
  d.addEventListener('click', e => { if (dragged) { dragged = false; e.stopImmediatePropagation(); } }, true);
  [head, grab].forEach(el => { if (!el) return; el.addEventListener('pointerdown', down); el.addEventListener('pointerup', up); el.style.touchAction = 'none'; });
  grab?.addEventListener('click', () => d.classList.toggle('bl-tall'));
}
