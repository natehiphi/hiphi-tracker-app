// The "I'm a..." picker (R-147, Nate 10/4: "A, but provide people an easy way to type like in C"): tap buttons for the
// eight shown first, "More titles" for the rest of the agreed list in its groups, and a box to type in that finds a title
// or adds their own words. Used by the testimony walkthrough's About you step (pub/helper.js) and the profile's About you
// (pub/profile.js). The list and its words are pub/titles.js; styles are pub/profile.css (.tp).
// st (the caller's, kept across redraws): { chosen: [keys], q: '', more: false, active: -1 }. The two kinds of student are
// plain titles shown first since R-165 (the "student" choice that opened two more was clunky).
// Every change redraws only the picker (#<pfx>-tp) so the page keeps its scroll, and calls onChange(chosen).
// R-156 (the review, 10/5): Enter picks the list title that was typed ("teacher" is "teacher (kumu)", not their own
// words); focus stays on a chip, and each change is said aloud; `addOnly` (the letter step's "Add a title") shows only
// titles to add, so a tap there never takes a title off the profile; `pendingTitle(st)` lets a host keep words typed but
// not added when the person saves.
import { esc, icon } from './core.js';
import { FIRST, GROUPS, inGroup, titleLabel, findTitles, ownKey, tidyOwn, listKeyFor, TITLES_MAX, OWN_MAX } from './titles.js';

const chip = (k, on, label = titleLabel(k)) => `<button type="button" class="chip tp-c" data-tp="${esc(k)}" aria-pressed="${on}">${on ? icon('check') : ''}<span>${esc(label)}</span></button>`;

// The suggestions under the box: titles whose words start with what was typed, then "Add ... as your own".
function optsOf(st) {
  const q = st.q || '', hits = q.trim() ? findTitles(q, st.chosen) : [], own = tidyOwn(q), same = listKeyFor(own);
  const ownNew = own && !same && !st.chosen.some(k => titleLabel(k).toLowerCase() === own.toLowerCase());
  return [...hits.map(t => ({ k: t.k, label: t.label })), ...(ownNew ? [{ k: 'own', label: own }] : [])];
}
// The listbox is always in the page (empty and hidden when there is nothing to suggest), so the box's aria-controls
// always names something real.
function listHTML(pfx, st) {
  const os = st.q && st.q.trim() ? optsOf(st) : [];
  return `<div class="tp-list" id="${pfx}-tpl" role="listbox" aria-label="Titles"${os.length ? '' : ' hidden'}>${os.map((o, i) => `<button type="button" class="tp-o${o.k === 'own' ? ' tp-own' : ''}" role="option" id="${pfx}-tpo${i}" data-tpo="${esc(o.k)}" aria-selected="${st.active === i}" tabindex="-1">${icon(o.k === 'own' ? 'plus' : 'user')}<span>${o.k === 'own' ? `Add “${esc(o.label)}” as your own` : esc(o.label)}</span></button>`).join('')}</div>`;
}
// What Enter (or a host's Save) takes from the box: the list title the words name, else the first suggestion the words
// start, else their own words. '' when the box is empty.
export function pendingTitle(st) {
  const q = tidyOwn(st.q); if (!q) return '';
  const same = listKeyFor(q); if (same) return same;
  const hits = findTitles(q, st.chosen), lo = q.toLowerCase();
  const pre = hits.find(t => t.label.toLowerCase().startsWith(lo) || t.say.toLowerCase().startsWith(lo));
  return pre ? pre.k : ownKey(q);
}

// o: { legend, hint, addOnly }.
export function pickerHTML(pfx, st, o) {
  const { legend = 'I’m a…', hint = 'Pick any, or none.', addOnly = false } = st.opts = o || st.opts || {};
  const full = st.chosen.length >= TITLES_MAX, q = st.q || '';
  // Every title stays where it is, ticked when picked, so a tap never makes a chip jump out of sight (the review of R-165:
  // a title tapped in "More titles" vanished to the top). After the first ones: titles shown nowhere else, their own words and,
  // with More titles closed, the ones picked from it. Adding only (the letter's "Add a title"): just the ones to add.
  const on = k => st.chosen.includes(k), show = t => addOnly ? !on(t.k) : !full || on(t.k);
  const inMore = new Set(GROUPS.flatMap(([g]) => inGroup(g).map(t => t.k))), isFirst = new Set(FIRST.map(t => t.k));
  const mine = addOnly ? '' : st.chosen.filter(k => !isFirst.has(k) && !(st.more && !full && inMore.has(k))).map(k => chip(k, true)).join('');
  const firsts = FIRST.filter(show).map(t => chip(t.k, on(t.k))).join('');
  const more = st.more ? `<div class="tp-more" id="${pfx}-tpm">${GROUPS.map(([g, name]) => { const ts = inGroup(g).filter(show); return ts.length ? `<div class="tp-g"><p class="tp-gh">${esc(name)}</p><div class="chips">${ts.map(t => chip(t.k, on(t.k))).join('')}</div></div>` : ''; }).join('')}</div>` : '';
  return `<fieldset class="tp${addOnly ? ' tp-addonly' : ''}" id="${pfx}-tp"><legend class="tp-leg">${esc(legend)} <span class="tp-hint">${esc(hint)}</span></legend>
    <div class="chips tp-chips">${firsts}${mine}</div>
    ${full ? `<p class="small muted">${icon('info')} You can pick up to ${TITLES_MAX}.${addOnly ? '' : ' Tap one to take it off.'}</p>` : `
    <button type="button" class="explain tp-morebtn" data-tp-more aria-expanded="${!!st.more}" aria-controls="${pfx}-tpm">${icon(st.more ? 'chevron-up' : 'chevron-down')}<span>${st.more ? 'Fewer titles' : 'More titles'}</span></button>${more}
    <div class="field tp-type"><label for="${pfx}-tq">Or type one, in your own words</label>
      <input id="${pfx}-tq" type="text" value="${esc(q)}" maxlength="${OWN_MAX}" autocomplete="off" autocapitalize="none" spellcheck="true" placeholder="like youth soccer coach"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${pfx}-tpl">
      <div class="tp-box" id="${pfx}-tpb">${listHTML(pfx, st)}</div></div>`}
    ${addOnly ? `<div class="btnrow tp-done"><button type="button" class="btn secondary sm" data-tp-done>${icon('check')}<span>Done adding</span></button></div>` : ''}
  </fieldset>`;
}

// root: an element that contains the picker (its children are replaced on each change). onChange(chosen, { done }).
export function wirePicker(root, pfx, st, onChange = () => {}) {
  const host = () => root.querySelector(`#${pfx}-tp`);
  // One live region beside the picker, made once, so "Added teacher" is read even though the picker is redrawn.
  let live = root.querySelector(`#${pfx}-tplive`);
  if (!live) { live = document.createElement('p'); live.className = 'sr'; live.id = `${pfx}-tplive`; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); root.appendChild(live); }
  const say = t => { live.textContent = ''; setTimeout(() => { live.textContent = t; }, 40); };
  const redraw = focusSels => {
    const el = host(); if (!el) return;
    el.outerHTML = pickerHTML(pfx, st);
    wirePicker(root, pfx, st, onChange);
    // The first of the given places that exists: the chip just tapped, else its neighbour, else the box, else the legend.
    for (const sel of [].concat(focusSels || [])) { const f = sel && root.querySelector(sel); if (f) { f.focus({ preventScroll: true }); if (f.tagName === 'INPUT') f.setSelectionRange(f.value.length, f.value.length); return; } }
  };
  const add = k => { if (!k || st.chosen.includes(k) || st.chosen.length >= TITLES_MAX) return false; st.chosen = [...st.chosen, k]; onChange(st.chosen); say(`Added ${titleLabel(k)}.`); return true; };
  const el = host(); if (!el) return;
  el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
    const k = b.dataset.tp, on = st.chosen.includes(k);
    const chips = [...el.querySelectorAll('.tp-chips [data-tp]')], i = chips.indexOf(b);
    const next = chips[i + 1] || chips[i - 1];
    const nextSel = next ? `#${pfx}-tp [data-tp="${CSS.escape(next.dataset.tp)}"]` : '';
    if (on) { st.chosen = st.chosen.filter(x => x !== k); onChange(st.chosen); say(`Removed ${titleLabel(k)}.`); } else add(k);
    redraw([`#${pfx}-tp [data-tp="${CSS.escape(k)}"]`, nextSel, `#${pfx}-tq`, `#${pfx}-tp [data-tp-more]`]);
  });
  const mb = el.querySelector('[data-tp-more]'); if (mb) mb.onclick = () => { st.more = !st.more; redraw('[data-tp-more]'); };
  const dn = el.querySelector('[data-tp-done]'); if (dn) dn.onclick = () => { const p = pendingTitle(st); if (p) { add(p); st.q = ''; } onChange(st.chosen, { done: true }); };
  const inp = el.querySelector(`#${pfx}-tq`); if (!inp) return;
  const box = el.querySelector(`#${pfx}-tpb`);
  const opts = () => [...el.querySelectorAll('[data-tpo]')];
  const choose = k => { add(k === 'own' ? ownKey(st.q) : k); st.q = ''; st.active = -1; redraw(`#${pfx}-tq`); };
  // Typing redraws only the list, never the box, so a phone's keyboard stays put.
  const paintList = () => {
    box.innerHTML = listHTML(pfx, st);
    const os = opts(), open = os.length > 0;
    inp.setAttribute('aria-expanded', String(open));
    if (open && st.active >= 0) inp.setAttribute('aria-activedescendant', `${pfx}-tpo${st.active}`); else inp.removeAttribute('aria-activedescendant');
    os.forEach(o => { o.onmousedown = e => e.preventDefault(); o.onclick = () => choose(o.dataset.tpo); });
  };
  inp.oninput = () => { st.q = inp.value; st.active = -1; paintList(); };
  inp.onkeydown = e => {
    const os = opts();
    if (e.key === 'ArrowDown' && os.length) { e.preventDefault(); st.active = Math.min(os.length - 1, st.active + 1); paintList(); }
    else if (e.key === 'ArrowUp' && os.length) { e.preventDefault(); st.active = Math.max(-1, st.active - 1); paintList(); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = os[st.active]; if (o) choose(o.dataset.tpo); else { const p = pendingTitle(st); if (p) { add(p); st.q = ''; st.active = -1; redraw(`#${pfx}-tq`); } } }
    else if (e.key === 'Escape' && st.q) { e.preventDefault(); e.stopPropagation(); st.q = ''; st.active = -1; inp.value = ''; paintList(); }
  };
  paintList();
}
// A person's own title is shown as typed; a key that left the list never reaches here (titles.js cleanTitles).
// No pencil on their own words (the review: a pencil in a chip that can't be pressed looked like an edit button).
export const titleChips = keys => keys.length ? `<div class="chips tp-show">${keys.map(k => `<span class="chip info">${esc(titleLabel(k))}</span>`).join('')}</div>` : '';
