// Staff v2 · Legislators directory (#/legislators, plan 3.6). It answers "who do I work this week?" first: the This
// week chip (the default) lists the members of committees hearing our bills in the next 7 days, most of our bills
// first. House, Senate and All list everyone by district. The search box finds a name, a district, a town, a
// committee or (on the live tracker) a street address, ignoring ʻokina and macrons; while you type, suggestions
// replace the list, so the page never reads "0 of 77" behind them. Kept from the current app's renderLegislators:
// the chamber choice, the committee filter (now a committee suggestion), the address lookup (geoSuggest ->
// geoDistricts) and the text match over name, towns and district.
import { S, esc, DEMO } from './data.js';
import { plain, codesOf, geoSuggest, geoDistricts } from './model.js';
import { icon, btn, iconBtn, empty, toast } from './ui.js';
import { photo, partyDist, legName, legHref, seatsOf, roleWord, RANK, wireLinks, surname } from './pathway.js';

const WEEK = 7 * 864e5;
const PARTY = { D: 'Democrat', R: 'Republican', I: 'Independent' };
const view = () => (S.lgView ??= { chip: 'week', q: '', pick: null, addr: null, focus: false });

// ---- data ----
// Our bills = tracked, with a position (not Monitor), the same set the current app's profile counts.
export const ourBill = b => b.tracked !== false && !!b.position && b.position !== 'monitor';
// Who hears our bills in the next 7 days: legislator id -> { bills: Set(bill id), roles: { code: role } }
export function weekIndex() {
  const now = Date.now(), ours = new Set(S.bills.filter(ourBill).map(b => b.id)), out = new Map();
  for (const h of S.hearings) {
    if (h.status === 'cancelled' || !ours.has(h.bill_id)) continue;
    const t = new Date(h.scheduled_at).getTime(); if (t <= now || t - now > WEEK) continue;
    const cs = codesOf(h.committee);
    for (const m of S.committeeMembers || []) {
      if (!cs.includes(m.committee)) continue;
      const x = out.get(m.legislator_id) || { bills: new Set(), roles: {} };
      x.bills.add(h.bill_id); x.roles[m.committee] = m.role; out.set(m.legislator_id, x);
    }
  }
  return out;
}
const byDistrict = (a, b) => a.chamber.localeCompare(b.chamber) || a.district - b.district;
const districtQ = k => /^(s|sd|sen|senate|h|hd|rep|house)?\s*(?:district)?\s*(\d{1,2})$/.exec(k);
const committeeOf = q => { const c = S.committees?.[String(q || '').trim().toUpperCase()]; return c || null; };
// Everything a legislator can be found by, plain (no ʻokina, no macrons, lower case).
const hayCache = new Map();
const hay = l => { let h = hayCache.get(l.id); if (h) return h;
  h = plain(`${l.name} ${l.sort_name} ${l.places || ''} ${l.chamber === 'S' ? 'senate senator sen' : 'house representative rep'} district ${l.district} ${l.party ? PARTY[l.party] || l.party : ''} ${l.title || ''} ${seatsOf(l).map(m => `${m.committee} ${S.committees?.[m.committee]?.name || ''}`).join(' ')}`);
  hayCache.set(l.id, h); return h; };
// The text search: a district ("HD 20", "sd5", "20"), a committee code (members, chair first), or words in any order.
export function matchLegs(q) {
  const k = plain(q).trim(), legs = S.legislators || []; if (!k) return [];
  const dm = districtQ(k);
  if (dm) { const n = +dm[2], ch = dm[1] ? (dm[1][0] === 's' ? 'S' : 'H') : ''; return legs.filter(l => l.district === n && (!ch || l.chamber === ch)).sort(byDistrict); }
  const c = committeeOf(q); if (c) return committeeLegs(c.code);
  const terms = k.split(/\s+/);
  return legs.filter(l => terms.every(t => hay(l).includes(t))).sort(byDistrict);
}
const committeeLegs = code => (S.committeeMembers || []).filter(m => m.committee === code).sort((a, b) => RANK[a.role] - RANK[b.role])
  .map(m => (S.legislators || []).find(l => l.id === m.legislator_id)).filter(Boolean);
// the places a district covers, one name each ("portion of Hilo" -> "Hilo")
const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(and\s+)?(a\s+)?portions?\s+of\s+/i, '').replace(/^and\s+/i, '').trim()).filter(Boolean);
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Street addresses look like "75-5722 Kuakini Hwy": a number and a word, and not a district.
const addressish = q => { const t = q.trim(); return t.length >= 5 && /\d/.test(t) && /[a-z]/i.test(t) && !districtQ(plain(t)); };

// What the box suggests while you type: people (by name or district) open their page; a town, a committee or a
// street address shows who represents it; the last row shows every text match.
function suggestions(v) {
  const q = v.q.trim(), k = plain(q), legs = S.legislators || [], out = [];
  const dm = districtQ(k);
  const people = dm ? matchLegs(q) : legs.filter(l => plain(l.name).includes(k) || plain(l.sort_name).includes(k))
    .sort((a, b) => (plain(surname(a)).startsWith(k) ? 0 : 1) - (plain(surname(b)).startsWith(k) ? 0 : 1) || byDistrict(a, b));
  for (const l of people.slice(0, 6)) out.push({ kind: 'person', l });
  if (!dm) {
    for (const c of Object.values(S.committees || {}).filter(c => plain(c.code) === k || (k.length >= 3 && plain(c.name).includes(k))).slice(0, 4))
      out.push({ kind: 'committee', c, ids: committeeLegs(c.code).map(l => l.id) });
    const places = new Map();
    for (const l of legs) for (const pl of placesOf(l)) {
      const p = plain(pl);
      // "kih" finds Kīhei; an address that names its town ("… Kailua-Kona") finds it too.
      // A hyphen joins a name ("Kailua-Kona" is not "Kailua").
      if ((k.length >= 2 && p.includes(k)) || (p.length >= 4 && k.length > p.length + 3 && new RegExp(`(^|[^a-z-])${escRe(p)}([^a-z-]|$)`).test(k))) {
        const x = places.get(p) || { kind: 'place', label: pl, ids: [] }; if (!x.ids.includes(l.id)) x.ids.push(l.id); places.set(p, x);
      }
    }
    out.push(...[...places.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 6));
  }
  if (addressish(q)) {
    if (DEMO) { if (!out.some(x => x.kind === 'place')) out.push({ kind: 'note', text: 'The sandbox finds towns in an address, not street numbers. The live tracker looks up the exact address.' }); }
    else if (v.addr && v.addr.q === q) for (const x of v.addr.results.slice(0, 5)) out.push({ kind: 'address', x });
    else out.push({ kind: 'loading' });
  }
  const all = matchLegs(q);
  if (all.length > out.filter(x => x.kind === 'person').length) out.push({ kind: 'all', n: all.length });
  if (!out.length) out.push({ kind: 'note', text: 'No match yet. Try a last name, a town, a district number or a committee code.' });
  return out;
}
function suggestHTML(v) {
  const list = v.sug = suggestions(v), q = v.q.trim();
  const who = ids => { const ls = ids.map(id => (S.legislators || []).find(l => l.id === id)).filter(Boolean); return `${ls.length} ${ls.length === 1 ? 'legislator' : 'legislators'} · ${ls.map(partyDist).join(', ')}`; };
  const rows = list.map((s, i) => {
    if (s.kind === 'person') return `<a class="row lg-sg" href="${legHref(s.l)}" data-lgsg>${photo(s.l, 32)}<span class="body"><span class="title">${esc(legName(s.l))}</span><span class="sub">${esc([partyDist(s.l), s.l.places].filter(Boolean).join(' · '))}</span></span></a>`;
    if (s.kind === 'committee') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('users')}</span><span class="body"><span class="title">${esc(s.c.name)} (${esc(s.c.code)})</span><span class="sub">${s.c.chamber === 'S' ? 'Senate' : 'House'} committee · ${s.ids.length} members</span></span></button>`;
    if (s.kind === 'place') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('map-pin')}</span><span class="body"><span class="title">${esc(s.label)}</span><span class="sub">${esc(who(s.ids))}</span></span></button>`;
    if (s.kind === 'address') return `<button type="button" class="row lg-sg" data-lgsg="${i}"><span class="lead">${icon('house')}</span><span class="body"><span class="title">${esc(s.x.label)}</span><span class="sub">${s.x.exact ? 'Street address' : 'Area'} · find its legislators</span></span></button>`;
    if (s.kind === 'loading') return `<div class="row lg-sgnote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking up the address</span></div>`;
    if (s.kind === 'all') return `<button type="button" class="row lg-sg lg-sgall" data-lgsg="${i}"><span class="lead">${icon('search')}</span><span class="body"><span class="title">Show all ${s.n} matching “${esc(q)}”</span></span></button>`;
    return `<div class="row lg-sgnote">${icon('info')}<span>${esc(s.text)}</span></div>`;
  }).join('');
  return `<div class="rows lg-sug" id="lg-sug" aria-label="Suggestions">${rows}</div>`;
}

// ---- rows ----
const pdHTML = l => `<span class="lg-pd"><span aria-hidden="true">${esc(partyDist(l))}</span><span class="sr">${esc(`${PARTY[l.party] || ''} ${l.chamber === 'S' ? 'Senate' : 'House'} District ${l.district}`.trim())}</span></span>`;
// "Chair, HHS · Member, CPN"; plain seats are grouped ("Member, HHS and CPN")
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// Leadership seats are named; plain seats only when there is no leadership seat ("Member, HHS and LBT").
const rolesText = roles => { const by = r => Object.entries(roles).filter(([, x]) => x === r).map(([c]) => c);
  const lead = ['chair', 'vice_chair'].filter(r => by(r).length).map(r => `${roleWord(r)}, ${andList(by(r))}`);
  return lead.length ? lead.join(' · ') : by('member').length ? `Member, ${andList(by('member'))}` : ''; };
// For and against on our bills (only stances someone recorded), as icons with numbers; the words are for screen readers.
export function stanceSummary(l, only) {
  let yes = 0, no = 0;
  for (const x of S.stances || []) { if (x.legislator_id !== l.id || (only && !only.has(x.bill_id))) continue; if (x.stance === 'yes' || x.stance === 'leaning_yes') yes++; else if (x.stance === 'no' || x.stance === 'leaning_no') no++; }
  if (!yes && !no) return '';
  const words = [yes ? `For ${yes} of our bills` : '', no ? `${yes ? 'against' : 'Against'} ${no}` : ''].filter(Boolean).join(', ');
  return `<span class="lg-ss" title="${words}"><span class="sr">${words}</span>${yes ? `<span aria-hidden="true">${icon('thumbs-up')}${yes}</span>` : ''}${no ? `<span aria-hidden="true">${icon('thumbs-down')}${no}</span>` : ''}</span>`;
}
// A 64px row: 40px photo, name and party-district, a second line, the stance summary at the right.
export function legRow(l, { week, weekMode = false } = {}) {
  const w = week && week.get(l.id), n = w ? w.bills.size : 0;
  // The count comes first so a narrow screen cuts the committee list, not the number that matters this week.
  const sub = weekMode && w ? [`${n} of our bills`, rolesText(w.roles)]
    : [n ? `${n} of our bills this week` : '', l.title, seatsOf(l).map(m => m.role === 'member' ? m.committee : `${roleWord(m.role)}, ${m.committee}`).join(' · ') || l.places];
  return `<a class="row lg-row" href="${legHref(l)}">${photo(l, 40)}<span class="body"><span class="title"><span class="lg-nm">${esc(l.name)}</span>${pdHTML(l)}</span><span class="sub">${esc(sub.filter(Boolean).join(' · '))}</span></span><span class="end">${stanceSummary(l, weekMode && w ? w.bills : null)}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
}

// ---- the page ----
const CHIPS = [['week', 'This week'], ['H', 'House'], ['S', 'Senate'], ['all', 'All']];
function bodyHTML(v) {
  const legs = S.legislators || [], q = v.q.trim(), week = weekIndex();
  if (v.focus && (q.length >= 2 || /\d/.test(q))) return suggestHTML(v);
  const list = rows => `<div class="rows lg-list">${rows.map(l => legRow(l, { week, weekMode: !q && !v.pick && v.chip === 'week' })).join('')}</div>`;
  const clear = `<button type="button" class="btn text sm lg-clear" data-lgclear>${icon('x')}<span>Clear</span></button>`;
  if (v.pick) {
    if (v.pick.loading) return `<div class="lg-cap"><p>${icon('map-pin')}<span>Finding the districts for ${esc(v.pick.label)}</span></p></div>${`<div class="skel lg-skel"></div>`.repeat(2)}`;
    const ls = v.pick.ids.map(id => legs.find(l => l.id === id)).filter(Boolean);
    const cap = `<div class="lg-cap"><p>${icon(v.pick.kind === 'committee' ? 'users' : 'map-pin')}<span><b>${esc(v.pick.label)}</b> · ${v.pick.note ? esc(v.pick.note) : `${ls.length} ${ls.length === 1 ? 'legislator' : 'legislators'}`}</span></p>${clear}</div>`;
    return cap + (ls.length ? list(ls) : empty({ title: 'No legislator found for that address', text: 'Check the street number and town, or try the town name alone.' }));
  }
  if (q) {
    const ls = matchLegs(q);
    if (!ls.length) return empty({ title: `No one matches “${esc(q)}”`, text: 'Try a last name, a town, a district number or a committee code such as HLT.', action: btn('Clear the search', { kind: 'secondary', attrs: { 'data-lgclear': '1' } }) });
    const c = committeeOf(q);
    return `<div class="lg-cap"><p>${icon(c ? 'users' : 'search')}<span>${c ? `<b>${esc(c.name)} (${esc(c.code)})</b> · ${ls.length} members, chair first` : `${ls.length} ${ls.length === 1 ? 'legislator matches' : 'legislators match'} “${esc(q)}”`}</span></p>${clear}</div>${list(ls)}`;
  }
  if (v.chip === 'week') {
    const ls = legs.filter(l => week.has(l.id)).sort((a, b) => week.get(b.id).bills.size - week.get(a.id).bills.size
      || Math.min(...Object.values(week.get(a.id).roles).map(r => RANK[r])) - Math.min(...Object.values(week.get(b.id).roles).map(r => RANK[r])) || a.sort_name.localeCompare(b.sort_name));
    if (!ls.length) return empty({ title: 'No hearings on our bills this week', text: 'Nothing is scheduled in the next 7 days. Everyone is under All.', action: btn('See everyone', { kind: 'secondary', attrs: { 'data-lgchip': 'all' } }) });
    return `<p class="lg-caption">${ls.length} legislators hear our bills in the next 7 days.</p>${list(ls)}`;
  }
  const ls = legs.filter(l => v.chip === 'all' || l.chamber === v.chip).sort(byDistrict);
  const cap = v.chip === 'H' ? `${ls.length} representatives, by district.` : v.chip === 'S' ? `${ls.length} senators, by district.` : `All ${ls.length} legislators: House, then Senate, by district.`;
  return `<p class="lg-caption">${cap}</p>${list(ls)}`;
}
const chipsHTML = v => { const on = !v.q.trim() && !v.pick; return CHIPS.map(([k, l]) => `<button type="button" class="chip" data-lgchip="${k}" aria-pressed="${on && v.chip === k}">${l}</button>`).join(''); };

export default {
  tab: 'legislators', title: () => 'Legislators', wide: () => true,
  render() {
    const v = view(); v.focus = false;
    return `<div class="lg-dir">
      <h1 class="lg-dtitle">Legislators</h1>
      <div class="lg-tools">
        <form class="searchbox lg-sbox" role="search" data-lgform novalidate>
          <label class="sr" for="lg-q">Find a legislator by name, district, town or street address</label>
          ${icon('search')}
          <input id="lg-q" class="input" type="search" enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Name, district, town or street address" value="${esc(v.q)}" aria-controls="lg-body">
          ${iconBtn('x', 'Clear the search', { 'data-lgclear': '1', hidden: !v.q }, 'clear')}
        </form>
        <div class="chips lg-chips" role="group" aria-label="Who to list" id="lg-chips">${chipsHTML(v)}</div>
      </div>
      <p class="sr" role="status" id="lg-status"></p>
      <div id="lg-body">${bodyHTML(v)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.lg-dir'); if (!root) return;
    const v = view(), inp = root.querySelector('#lg-q'), form = root.querySelector('[data-lgform]'), body = root.querySelector('#lg-body');
    const x = form.querySelector('[data-lgclear]');
    // Repaint the list only: the box keeps its focus and caret, and the chips keep their elements (a tap that blurs
    // the box and repaints must still land on the chip it started on).
    const paint = () => {
      const on = !v.q.trim() && !v.pick;
      root.querySelectorAll('[data-lgchip]').forEach(c => c.closest('#lg-chips') && c.setAttribute('aria-pressed', String(on && v.chip === c.dataset.lgchip)));
      body.innerHTML = bodyHTML(v); x.hidden = !inp.value;
      const n = body.querySelectorAll('.lg-sg').length, r = body.querySelectorAll('.lg-row').length;
      root.querySelector('#lg-status').textContent = body.querySelector('#lg-sug') ? `${n} suggestion${n === 1 ? '' : 's'}` : `${r} legislator${r === 1 ? '' : 's'}`;
    };
    wireLinks(root);
    // Address suggestions come from the live tracker's table of every Hawaiʻi street address. The sandbox never
    // makes that request (nothing may reach Supabase there), so it matches the town named in the address instead.
    const lookup = () => {
      clearTimeout(v.t); const q = v.q.trim();
      if (DEMO || !addressish(q) || (v.addr && v.addr.q === q)) return;
      v.t = setTimeout(async () => {
        let results = []; try { results = await geoSuggest(q); } catch { /* shown as no address rows */ }
        if (v.q.trim() === q) { v.addr = { q, results }; if (v.focus) paint(); }
      }, 250);
    };
    inp.addEventListener('input', () => { v.q = inp.value; v.pick = null; v.focus = true; paint(); lookup(); });
    inp.addEventListener('focus', () => { if (v.focus) return; v.focus = true; if (v.q.trim()) paint(); });
    inp.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { const f = body.querySelector('.lg-sg'); if (f) { e.preventDefault(); f.focus(); } }
      if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; v.q = ''; paint(); }
    });
    body.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const all = [...body.querySelectorAll('.lg-sg')], i = all.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); if (e.key === 'ArrowUp' && i === 0) inp.focus(); else all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
    });
    // Leaving the box (and its suggestions) shows the list for what was typed.
    root.addEventListener('focusout', e => {
      const to = e.relatedTarget; if (!v.focus || (to && (form.contains(to) || body.querySelector('#lg-sug')?.contains(to)))) return;
      v.focus = false; paint();
    });
    // Keep the typing focus in the box while a suggestion is pressed, so the tap lands on it.
    body.addEventListener('mousedown', e => { if (e.target.closest('.lg-sg')) e.preventDefault(); });
    form.onsubmit = e => { e.preventDefault(); inp.blur(); if (v.focus) { v.focus = false; paint(); } };
    root.addEventListener('click', async e => {
      const chipEl = e.target.closest('[data-lgchip]');
      if (chipEl) { v.chip = chipEl.dataset.lgchip; v.q = ''; v.pick = null; inp.value = ''; paint(); return; }
      if (e.target.closest('[data-lgclear]')) { v.q = ''; v.pick = null; inp.value = ''; paint(); if (e.target.closest('form')) inp.focus(); return; }
      const sg = e.target.closest('button[data-lgsg]'); if (!sg) return;
      const s = (v.sug || [])[+sg.dataset.lgsg]; if (!s) return;
      if (s.kind === 'all') { v.focus = false; inp.blur(); paint(); return; }
      v.focus = false; inp.blur();
      if (s.kind === 'place') v.pick = { kind: 'place', label: s.label, ids: s.ids };
      else if (s.kind === 'committee') v.pick = { kind: 'committee', label: `${s.c.name} (${s.c.code})`, ids: s.ids, note: `${s.ids.length} members, chair first` };
      else if (s.kind === 'address') {
        v.pick = { kind: 'address', label: s.x.label, loading: true };
        v.q = ''; inp.value = ''; paint();
        try {
          const d = await geoDistricts(s.x);
          const ids = d.found ? (S.legislators || []).filter(l => (l.chamber === 'S' && l.district === d.senate) || (l.chamber === 'H' && l.district === d.house)).map(l => l.id) : [];
          v.pick = { kind: 'address', label: s.x.label, ids, note: d.found ? `Senate District ${d.senate}, House District ${d.house}` : 'no districts found' };
        } catch { v.pick = null; toast('Could not look up that address. Try again.', { err: true }); }
        paint(); return;
      }
      v.q = ''; inp.value = ''; paint();
    });
  },
};
