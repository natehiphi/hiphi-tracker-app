// The "I'm a..." picker (R-147, Nate 10/4: "A, but provide people an easy way to type like in C"): tap buttons for the
// eight shown first, "More titles" for the rest of the agreed list in its groups, and a box to type in that finds a title
// or adds their own words. Used by the testimony walkthrough's About you step (pub/helper.js) and the profile's About you
// (pub/profile.js). The list and its words are pub/titles.js; styles are pub/profile.css (.tp).
// st (the caller's, kept across redraws): { chosen: [keys], q: '', more: false, student: false, active: -1 }.
// Every change redraws only the picker (#<pfx>-tp) so the page keeps its scroll, and calls onChange(chosen).
import { esc, icon } from './core.js';
import { FIRST, GROUPS, inGroup, titleLabel, findTitles, ownKey, tidyOwn, isOwn, TITLES_MAX, OWN_MAX } from './titles.js';

const chip = (k, on, label = titleLabel(k)) => `<button type="button" class="chip tp-c" data-tp="${esc(k)}" aria-pressed="${on}">${on ? icon('check') : ''}<span>${esc(label)}</span></button>`;
const hasStudent = st => st.chosen.some(k => k === 'student-hs' || k === 'student-college');

// The suggestions under the box: titles whose words start with what was typed, then "Add ... as your own".
function optsOf(st) {
  const q = st.q || '', hits = q.trim() ? findTitles(q, st.chosen) : [], own = tidyOwn(q);
  const ownNew = own && !hits.some(t => t.label.toLowerCase() === own.toLowerCase()) && !st.chosen.some(k => titleLabel(k).toLowerCase() === own.toLowerCase());
  return [...hits.map(t => ({ k: t.k, label: t.label })), ...(ownNew ? [{ k: 'own', label: own }] : [])];
}
function listHTML(pfx, st) {
  const os = st.q && st.q.trim() ? optsOf(st) : []; if (!os.length) return '';
  return `<div class="tp-list" id="${pfx}-tpl" role="listbox" aria-label="Titles">${os.map((o, i) => `<button type="button" class="tp-o${o.k === 'own' ? ' tp-own' : ''}" role="option" id="${pfx}-tpo${i}" data-tpo="${esc(o.k)}" aria-selected="${st.active === i}" tabindex="-1">${icon(o.k === 'own' ? 'plus' : 'user')}<span>${o.k === 'own' ? `Add “${esc(o.label)}” as your own` : esc(o.label)}</span></button>`).join('')}</div>`;
}

// o: { legend, hint, compact }. compact (the walkthrough): someone who already has titles sees only theirs and "Add a
// title", which opens the rest; a long list of other titles in the middle of writing a letter is noise (A-2).
export function pickerHTML(pfx, st, o) {
  const { legend = 'I’m a…', hint = 'Pick any, or none.', compact = false } = st.opts = o || st.opts || {};
  const full = st.chosen.length >= TITLES_MAX, q = st.q || '';
  if (compact && st.chosen.length && !st.adding) return `<fieldset class="tp" id="${pfx}-tp"><legend class="tp-leg">${esc(legend)} <span class="tp-hint">${esc(hint)}</span></legend>
    <div class="chips tp-chips">${st.chosen.map(k => chip(k, true)).join('')}${full ? '' : `<button type="button" class="chip tp-c tp-add" data-tp-add aria-expanded="false">${icon('plus')}<span>Add a title</span></button>`}</div></fieldset>`;
  // Their own titles first, in their order (pressed), then the eight not picked yet.
  const firsts = FIRST.filter(t => !st.chosen.includes(t.k) && !(t.pick && hasStudent(st)))
    .map(t => t.pick ? `<button type="button" class="chip tp-c" data-tp-student aria-expanded="${!!st.student}" aria-controls="${pfx}-tps"><span>${esc(t.label)}</span>${icon(st.student ? 'chevron-up' : 'chevron-down')}</button>` : chip(t.k, false)).join('');
  const student = st.student && !hasStudent(st) ? `<div class="chips tp-sub" id="${pfx}-tps" role="group" aria-label="Which kind of student">${['student-hs', 'student-college'].map(k => chip(k, false)).join('')}</div>` : '';
  const more = st.more ? `<div class="tp-more" id="${pfx}-tpm">${GROUPS.map(([g, name]) => { const ts = inGroup(g).filter(t => !st.chosen.includes(t.k)); return ts.length ? `<div class="tp-g"><p class="tp-gh">${esc(name)}</p><div class="chips">${ts.map(t => chip(t.k, false)).join('')}</div></div>` : ''; }).join('')}</div>` : '';
  return `<fieldset class="tp" id="${pfx}-tp"><legend class="tp-leg">${esc(legend)} <span class="tp-hint">${esc(hint)}</span></legend>
    <div class="chips tp-chips">${st.chosen.map(k => chip(k, true)).join('')}${full ? '' : firsts}</div>${full ? '' : student}
    ${full ? `<p class="small muted">${icon('info')} You can pick up to ${TITLES_MAX}. Tap one to take it off.</p>` : `
    <button type="button" class="explain tp-morebtn" data-tp-more aria-expanded="${!!st.more}" aria-controls="${pfx}-tpm">${icon(st.more ? 'chevron-up' : 'chevron-down')}<span>${st.more ? 'Fewer titles' : 'More titles'}</span></button>${more}
    <div class="field tp-type"><label for="${pfx}-tq">Or type one, in your own words</label>
      <input id="${pfx}-tq" type="text" value="${esc(q)}" maxlength="${OWN_MAX}" autocomplete="off" autocapitalize="none" spellcheck="true" placeholder="like youth soccer coach"
        role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${pfx}-tpl">
      <div class="tp-box" id="${pfx}-tpb">${listHTML(pfx, st)}</div></div>`}
  </fieldset>`;
}

// root: an element that contains the picker (its children are replaced on each change).
export function wirePicker(root, pfx, st, onChange = () => {}) {
  const host = () => root.querySelector(`#${pfx}-tp`);
  const redraw = focusSel => {
    const el = host(); if (!el) return;
    el.outerHTML = pickerHTML(pfx, st);
    wirePicker(root, pfx, st, onChange);
    if (focusSel) { const f = root.querySelector(focusSel); if (f) { f.focus({ preventScroll: true }); if (f.tagName === 'INPUT') f.setSelectionRange(f.value.length, f.value.length); } }
  };
  const add = k => { if (!k || st.chosen.includes(k) || st.chosen.length >= TITLES_MAX) return; st.chosen = [...st.chosen, k]; st.student = false; onChange(st.chosen); };
  const el = host(); if (!el) return;
  el.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => {
    const k = b.dataset.tp, on = st.chosen.includes(k);
    if (on) { st.chosen = st.chosen.filter(x => x !== k); onChange(st.chosen); } else add(k);
    redraw(`[data-tp="${CSS.escape(k)}"]`);
  });
  const ad = el.querySelector('[data-tp-add]'); if (ad) ad.onclick = () => { st.adding = true; redraw(`#${pfx}-tp .tp-chips [data-tp]:not([aria-pressed="true"]), #${pfx}-tq`); };
  const sb = el.querySelector('[data-tp-student]'); if (sb) sb.onclick = () => { st.student = !st.student; redraw(st.student ? `#${pfx}-tps [data-tp]` : '[data-tp-student]'); };
  const mb = el.querySelector('[data-tp-more]'); if (mb) mb.onclick = () => { st.more = !st.more; redraw('[data-tp-more]'); };
  const inp = el.querySelector(`#${pfx}-tq`); if (!inp) return;
  const box = el.querySelector(`#${pfx}-tpb`);
  const opts = () => [...el.querySelectorAll('[data-tpo]')];
  const choose = k => { if (k === 'own') add(ownKey(st.q)); else add(k); st.q = ''; st.active = -1; redraw(`#${pfx}-tq`); };
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
    else if (e.key === 'Enter') { e.preventDefault(); const o = os[st.active] || (os.length === 1 ? os[0] : os.find(x => x.dataset.tpo !== 'own' && x.textContent.trim().toLowerCase() === st.q.trim().toLowerCase()) || os.find(x => x.dataset.tpo === 'own')); if (o) choose(o.dataset.tpo); }
    else if (e.key === 'Escape' && st.q) { e.preventDefault(); e.stopPropagation(); st.q = ''; st.active = -1; inp.value = ''; paintList(); }
  };
  paintList();
}
// A person's own title is shown as typed; a key that left the list never reaches here (titles.js cleanTitles).
export const titleChips = keys => keys.length ? `<div class="chips tp-show">${keys.map(k => `<span class="chip info">${isOwn(k) ? icon('pencil') : ''}${esc(titleLabel(k))}</span>`).join('')}</div>` : '';
