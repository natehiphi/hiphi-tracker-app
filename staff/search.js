// Staff v2 · Search (#/search?q=, plan 3.12). One box for everything, results grouped Bills · Legislators ·
// Supporters. Bills come first: the tracked ones (matched the way the current app's search does: number, title,
// summary, description, committee, referrals, owner, coalition, sponsor, position, stage), then every other bill of
// the session from DB.searchUntracked, each with a Track button (DB.track) that acts at once. On a phone the page has
// its own box; on a desktop the header's box drives this page as you type ("/" focuses it, handled by the frame).
import { S, DB, esc, hooks, fmtDate, owners, effStage, STAGE_LABEL, POSITIONS, capitolUrl, SESSION_YEAR } from './data.js';
import { plain, diedish, personName, whereOf, titleCaseSmart, exactBill } from './model.js';
// Build 3, desktop: the groups sit side by side (bills on the left, legislators and supporters on the right), each
// with its count; the arrow keys move through the results from the search box (Down enters the list, Up and Down
// move, Left and Right change column, Home and End jump, Enter opens, Esc returns to the box). Bills are named the
// way the Bills list names them: number, nickname in bold, then the plain summary (five bills share the nickname
// "Let counties regulate tobacco sales", and the summary and status are what tell them apart).
import { icon, btn, empty, toast } from './ui.js';
import { billSub, wireLinks } from './pathway.js';
import { matchLegs, legRow, weekIndex } from './legislators.js';
import { blRow } from './bills.js';

const SHOW = { bills: 8, legs: 5, people: 5 };
const st = () => (S.lgSearch ??= { q: '', more: new Set(), un: null });
const qOf = route => String(route?.q?.q ?? '').trim();
// Repaints only the results of the page on screen (set by wire), so data that arrives while someone types never
// re-renders the page and takes the typing focus away.
let repaint = null;
const refresh = () => { if (repaint && document.getElementById('lg-sres')) repaint(); else hooks.render(); };

// ---- matching ----
function billHits(q) {
  const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''), terms = ql.split(/\s+/).filter(Boolean);
  const hay = b => [b.bill_number, b.nickname, b.title, b.public_summary, b.description, b.committee, (b.referrals || []).join(' '),
    owners(b).map(a => a.full_name + ' ' + a.initials).join(' '), (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).join(' '),
    (b.sponsors || []).map(x => typeof x === 'string' ? x : x.n || x.name || '').join(' '), POSITIONS.find(p => p[0] === b.position)?.[1], STAGE_LABEL[effStage(b)]].join(' | ').toLowerCase();
  return S.bills.filter(b => b.bill_number.toLowerCase().includes(qn) || terms.every(t => hay(b).includes(t)))
    .sort((a, b) => (diedish(a) - diedish(b)) || (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
}
function peopleHits(q) {
  const terms = plain(q).split(/\s+/).filter(Boolean);
  return (S.people || []).filter(p => { const h = plain([p.name, p.email, p.phone, p.island, (p.tags || []).join(' '), p.senate_district ? `sd ${p.senate_district}` : '', p.house_district ? `hd ${p.house_district}` : ''].join(' ')); return terms.every(t => h.includes(t)); })
    .sort((a, b) => String(b.last_active || '').localeCompare(String(a.last_active || '')));
}

// ---- rows ----
const untrackedRow = r => `<div class="row lg-urow" data-lgurow="${esc(r.id)}">
  <span class="body"><span class="title"><b>${esc(r.bill_number)}</b> <span class="lg-bt">${esc(r.description || titleCaseSmart(r.title || ''))}</span></span>${r.last_action ? `<span class="sub">${esc(`${r.last_action}${r.last_action_date ? ' · ' + fmtDate(r.last_action_date) : ''}`)}</span>` : ''}</span>
  <span class="lg-uacts">${btn('Track', { kind: 'secondary', sm: true, icon: 'plus', attrs: { 'data-lgtrack': r.id, 'aria-label': `Track ${r.bill_number}` } })}<a class="iconbtn" href="${esc(capitolUrl(r))}" target="_blank" rel="noopener" aria-label="${esc(r.bill_number)} on the Capitol site" title="Capitol page">${icon('external-link')}</a></span>
</div>`;
const personRow = p => {
  const act = p.last_active ? `active ${fmtDate(p.last_active)}` : '';
  return `<a class="row lg-prow" href="#/person/${encodeURIComponent(p.id)}"><span class="lead">${icon('user-round')}</span><span class="body"><span class="title">${esc(personName(p))}</span><span class="sub">${esc([whereOf(p), act].filter(Boolean).join(' · ') || p.email || '')}</span></span><span class="end">${p.actions ? `${p.actions} action${p.actions === 1 ? '' : 's'}` : ''}${icon('chevron-right', { cls: 'chev' })}</span></a>`;
};
const more = (key, n, shown, label) => n > shown ? `<button type="button" class="row lg-more" data-lgsmore="${key}">${icon('chevron-down')}<span>Show all ${n} ${label}</span></button>` : '';
const group = (id, title, n, inner) => `<section class="rows lg-grp" aria-labelledby="${id}"><h2 class="sv-group" id="${id}"><span>${title}</span><span class="n">${n}</span></h2>${inner}</section>`;

const nOf = (n, one, many) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
function resultsHTML(q) {
  const s = st();
  if (!q) return empty({ title: 'Search everything', text: 'Find bills by number or words, legislators by name, town or district, and supporters by name or email.' });
  // untracked bills: only when the query is long enough to mean something (the current app's rule, 3 characters)
  const tracked = billHits(q), ids = new Set(S.bills.map(b => b.id)), nums = new Set(S.bills.map(b => b.bill_number));
  const un = s.un && s.un.q === q ? (s.un.rows || []).filter(r => !ids.has(r.id) && !nums.has(r.bill_number)) : null;
  const legs = matchLegs(q), week = weekIndex();
  const peopleReady = S.peopleLoaded || (S.people || []).length, people = peopleReady ? peopleHits(q) : [];
  const nb = s.more.has('b') ? tracked.length : SHOW.bills, nl = s.more.has('l') ? legs.length : SHOW.legs, np = s.more.has('p') ? people.length : SHOW.people;
  const unBlock = q.length < 3 ? '' : un === null ? `<div class="row lg-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Looking through every bill of the session</span></div>`
    : un.length ? `<h3 class="lg-subh">Not tracked yet <span class="lg-n">${un.length}</span></h3>${un.map(untrackedRow).join('')}` : '';
  const main = [], side = [];
  const nBills = tracked.length + (un ? un.length : 0);
  if (tracked.length || (un && un.length) || un === null && q.length >= 3)
    main.push(group('lg-gb', 'Bills', nBills, tracked.slice(0, nb).map(b => blRow(b, { sub: esc(billSub(b)), href: `#/bill/${encodeURIComponent(b.bill_number)}` })).join('') + more('b', tracked.length, nb, 'tracked bills') + unBlock));
  if (legs.length) side.push(group('lg-gl', 'Legislators', legs.length, legs.slice(0, nl).map(l => legRow(l, { week })).join('') + more('l', legs.length, nl, 'legislators')));
  if (!peopleReady) side.push(group('lg-gp', 'Supporters', '', `<div class="row lg-snote" role="status">${icon('loader-circle', { cls: 'lg-spin' })}<span>Loading supporters</span></div>`));
  else if (people.length) side.push(group('lg-gp', 'Supporters', people.length, people.slice(0, np).map(personRow).join('') + more('p', people.length, np, 'supporters')));
  if (!main.length && !side.length) return empty({ title: `Nothing matches “${esc(q)}”`, text: 'Try a bill number such as HB1562, a word from its title, a last name or a town.' });
  // What was found, in words, above the groups (each group's header repeats its own count).
  const parts = [nBills ? nOf(nBills, 'bill', 'bills') : '', legs.length ? nOf(legs.length, 'legislator', 'legislators') : '', people.length ? nOf(people.length, 'supporter', 'supporters') : ''].filter(Boolean);
  const sum = parts.length ? `<p class="st-ssum">${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]} for “${esc(q)}”<span class="st-skeys"> · The arrow keys move through the results, Enter opens one</span></p>` : '';
  const two = main.length && side.length;
  return `${sum}<div class="st-sgrid${two ? ' st-two' : ''}">${main.length ? `<div class="st-scol" data-scol="0">${main.join('')}</div>` : ''}${side.length ? `<div class="st-scol${two ? ' st-sside' : ''}" data-scol="1">${side.join('')}</div>` : ''}</div>`;
}

// ---- arrow keys through the results (they are the list's own keys, like a menu's, not shortcuts: they only act
// inside the search box and the results, so they never fire on a stray letter) ----
const ITEMS = '#lg-sres a.row, #lg-sres .lg-urow [data-lgtrack], #lg-sres .lg-more';
const items = () => [...document.querySelectorAll(ITEMS)].filter(el => el.offsetParent);
function moveResult(e, box) {
  const list = items(), cur = document.activeElement, i = list.indexOf(cur);
  const go = el => { if (!el) return; e.preventDefault(); el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); };
  if (i < 0) { if (e.key === 'ArrowDown' && list.length) go(list[0]); return; }      // from the search box
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); box()?.focus(); return; }
  if (e.key === 'ArrowDown') return go(list[Math.min(list.length - 1, i + 1)]);
  if (e.key === 'ArrowUp') { if (i === 0) { e.preventDefault(); box()?.focus(); } else go(list[i - 1]); return; }
  if (e.key === 'Home') return go(list[0]);
  if (e.key === 'End') return go(list[list.length - 1]);
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    // the other column, at about the same height
    const col = cur.closest('[data-scol]'), to = document.querySelector(`#lg-sres [data-scol="${e.key === 'ArrowRight' ? 1 : 0}"]`);
    if (!col || !to || to === col || getComputedStyle(to.parentElement).display !== 'grid') return;
    const y = cur.getBoundingClientRect().top, cand = list.filter(el => to.contains(el));
    go(cand.sort((a, b) => Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y))[0]);
  }
}

export default {
  tab: '', title: () => 'Search',
  wide: () => true,   // the frame's 720px column (900 to 1099px) cannot hold two groups side by side; the CSS caps the page at 1120px
  render(route) {
    const q = qOf(route), s = st();
    if (s.q !== q) { s.q = q; s.more = new Set(); }
    // Supporters load on first use on the live tracker (the sandbox has them already).
    if (!S.peopleLoaded && !S.peopleLoading && !S.lgPeopleTried) { S.lgPeopleTried = true; DB.loadPeople().then(refresh).catch(() => { S.peopleLoaded = true; S.people ??= []; refresh(); }); }
    return `<div class="lg-search st-srch">
      <h1 class="lg-dtitle">Search</h1>
      <form class="searchbox lg-sbox lg-sphone" role="search" data-lgsform novalidate>
        <label class="sr" for="lg-sq">Search bills, legislators and supporters</label>
        ${icon('search')}
        <input id="lg-sq" class="input" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" placeholder="Bills, legislators, supporters" value="${esc(q)}">
      </form>
      <p class="sr" role="status" id="lg-sstatus"></p>
      <div id="lg-sres">${resultsHTML(q)}</div>
    </div>`;
  },
  wire(route, app) {
    const root = app.querySelector('.lg-search'); if (!root) return;
    const s = st(), res = root.querySelector('#lg-sres'), own = root.querySelector('#lg-sq'), hdr = app.querySelector('#hq');
    const boxes = [own, hdr].filter(Boolean);
    wireLinks(root);
    const paint = () => {
      res.innerHTML = resultsHTML(s.q);
      const n = res.querySelectorAll('.row[href], .lg-urow').length;
      root.querySelector('#lg-sstatus').textContent = s.q ? `${n} result${n === 1 ? '' : 's'} shown` : '';
    };
    repaint = paint;
    // The untracked half comes from the database, debounced, and repaints when it lands.
    const untracked = () => {
      clearTimeout(s.t); const q = s.q;
      if (q.length < 3 || (s.un && s.un.q === q && s.un.rows)) return;
      s.un = { q, rows: null };
      s.t = setTimeout(async () => {
        try { const rows = await DB.searchUntracked(q); if (s.q === q) { s.un = { q, rows }; paint(); } }
        catch (e) { if (s.q === q) { s.un = { q, rows: [] }; paint(); } toast(e, { err: true }); }
      }, 350);
    };
    // Typing updates the results and the address (replaceState: one Back leaves the search, not one per letter).
    let t;
    const onType = el => { clearTimeout(t); t = setTimeout(() => {
      const q = el.value.trim(); boxes.forEach(b => { if (b !== el) b.value = el.value; });
      if (q === s.q) return; s.q = q; s.more = new Set();
      try { history.replaceState(history.state, '', '#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); } catch { /* ignore */ }
      paint(); untracked();
    }, 120); };
    boxes.forEach(b => { b.value = s.q; b.addEventListener('input', () => onType(b)); });
    // Down from the box goes into the results; inside them the arrow keys move, and Esc comes back to the box.
    const boxNow = () => boxes.find(b => b.offsetParent);
    const keys = e => { if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) moveResult(e, boxNow); };
    res.addEventListener('keydown', keys);
    boxes.forEach(b => b.addEventListener('keydown', e => { if (e.key === 'ArrowDown') keys(e); }));
    // Enter in either box: a bill number that names exactly one tracked bill opens that bill (B-2: a number in hand is
    // two steps from its page, and a results page in between made it four; R-022). The header box does the same on
    // every other page. Anything else keeps this page (the header's own submit would push another history entry).
    const openExact = q => { const b = exactBill(q); if (!b) return false; S.go(`#/bill/${b.bill_number.replace(/\s/g, '')}`); return true; };
    root.querySelector('[data-lgsform]').onsubmit = e => { e.preventDefault(); if (!openExact(own.value)) own.blur(); };
    const hf = hdr?.closest('form');
    if (hf) hf.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); if (!openExact(hdr.value)) onType(hdr); }, { capture: true });
    // Focus the box that is on screen (the page's on a phone, the header's on a desktop).
    // With a keyboard and a mouse the box takes the focus on arrival even with words in it (type on, or press Down for
    // the results); a phone only when it is empty, so its keyboard does not cover the results.
    const fine = (() => { try { return matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)').matches; } catch { return false; } })();
    requestAnimationFrame(() => { const f = boxes.find(b => b.offsetParent), at = document.activeElement;
      if (f && at !== f && (!s.q || fine && (!at || at === document.body || at.id === 'main'))) { f.focus({ preventScroll: true }); try { f.setSelectionRange(f.value.length, f.value.length); } catch { /* not a text box */ } } });
    root.addEventListener('click', async e => {
      const m = e.target.closest('[data-lgsmore]'); if (m) { s.more.add({ b: 'b', l: 'l', p: 'p' }[m.dataset.lgsmore]); paint(); return; }
      const tr = e.target.closest('[data-lgtrack]'); if (!tr) return;
      const r = (s.un?.rows || []).find(x => String(x.id) === tr.dataset.lgtrack); if (!r) return;
      tr.setAttribute('aria-busy', 'true'); tr.disabled = true;
      // DB.track adds the row to the tracked list as it is; give it the empty fields a tracked bill always has so every
      // screen can show it before the next load fills them in.
      const bill = Object.assign(r, { referrals: r.referrals || [], sponsors: r.sponsors || [], companions: r.companions || [], session_year: r.session_year || SESSION_YEAR, position: r.position ?? null, priority: r.priority ?? null });
      try {
        await DB.track(bill);
        s.un.rows = s.un.rows.filter(x => x.id !== r.id); paint();
        toast(`${r.bill_number} is now tracked. Set its position and owner.`, { ok: true, action: { label: 'Open', run: () => S.go(`#/bill/${encodeURIComponent(r.bill_number)}`) } });
      } catch (x) { tr.removeAttribute('aria-busy'); tr.disabled = false; toast(x, { err: true }); }
    });
    untracked();
  },
};
