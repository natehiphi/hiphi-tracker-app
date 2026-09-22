// Suggestions under a search box as you type (R-032, Nate 9/21: "the search function should autopopulate options to
// select from"). A combobox and its listbox, written once for both apps' header search boxes: the app says what
// matches the words so far (source) and how to open a link (open); this file owns the behaviour. The list opens from
// the second character, the arrow keys move through it, Enter opens the highlighted row (with none highlighted the
// form submits as before, to the full results), Esc closes it, and a click or tap opens a row.
//
// Both frames rebuild the header on every render, so data arriving mid-word used to empty the box. What was typed is
// kept per box and put back when the same page redraws (restore at the end), with the focus and the list.
//
// A source returns { groups: [{ label, items: [{ href, title, sub?, icon?, inline? }] }], more? }. `more` is a promise
// of the complete groups, for results that come from the database. While it runs, a list already on screen stays
// where it is, dimmed and still, and is swapped once the answer lands (B-7: a list that emptied and refilled on every
// keystroke jumped by 230px on the live site); the first time, placeholder rows hold its height. `inline` puts an
// item's second line beside its first (a bill: its name, then its number), so more rows fit.
// `min` is how many characters open the list: 2 by default; the public box waits for 3, because two letters such as
// "hb" say too little to search on. `wait` is the pause after a keystroke before looking (120ms; the public box's
// bills come from the database, so it waits 200ms and a fast typist sends one search, not one per letter).
// `seeAll(q, hits)` gives the last row, and `empty(q)` the words when nothing matches.
import { icon } from '../icons.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MIN = 2, WAIT = 120;
const kept = new Map();   // box id -> { q, hash }: what was typed, on which page, while the box is in use

export function suggest(input, { source, open, seeAll = null, when = () => true, min = MIN, wait = WAIT, label = 'Suggestions',
  busy = 'Looking', failed = 'Could not look just now', empty = q => `Nothing matches “${q}”.` }) {
  const form = input.form || input.parentElement, id = `${input.id || 'q'}-sg`;
  form.classList.add('sg-host');
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-expanded', 'false');
  const status = document.createElement('span'); status.className = 'sr'; status.setAttribute('role', 'status'); form.appendChild(status);
  let box = null, opts = [], at = -1, timer = 0, seq = 0, done = false;   // done: the list holds a finished answer, not placeholders
  const keep = v => { if (v.trim()) kept.set(input.id, { q: v, hash: location.hash }); else kept.delete(input.id); };   // as typed, trailing space and all
  const waiting = () => !!box && box.classList.contains('sg-busy');

  function close() {
    seq++; box?.remove(); box = null; opts = []; at = -1; done = false;
    input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); input.removeAttribute('aria-controls');
  }
  // One highlighted row at a time, whether the keys or the pointer put it there.
  function mark(i, scroll = true) {
    at = i;
    opts.forEach((el, n) => el.setAttribute('aria-selected', n === i ? 'true' : 'false'));
    if (i < 0) { input.removeAttribute('aria-activedescendant'); return; }
    input.setAttribute('aria-activedescendant', opts[i].id);
    if (scroll) opts[i].scrollIntoView({ block: 'nearest' });
  }
  function pick(i) {
    const href = opts[i]?.getAttribute('href'); if (!href) return;
    close(); keep(''); input.value = ''; input.blur(); open(href);
  }
  const row = it => `<a class="sg-o${it.inline ? ' sg-o1' : ''}${it.all ? ' sg-all' : ''}" role="option" href="${esc(it.href)}" aria-selected="false" tabindex="-1">${icon(it.icon || 'search')}<span class="sg-t"><span class="sg-l">${esc(it.title)}</span>${it.sub ? `<span class="sg-s">${esc(it.sub)}</span>` : ''}</span></a>`;
  function makeBox() {
    box = document.createElement('div'); box.className = 'sg'; box.id = id; box.setAttribute('role', 'listbox'); box.setAttribute('aria-label', label);
    form.appendChild(box);
    box.addEventListener('mousedown', e => e.preventDefault());   // a press picks a row; it must not take the focus from the box first
    box.addEventListener('click', e => {
      const a = e.target.closest('[role="option"]'); if (!a || waiting()) { e.preventDefault(); return; }
      if (e.metaKey || e.ctrlKey || e.shiftKey) { close(); return; }   // a new tab or window: the browser opens the link
      e.preventDefault(); pick(+a.dataset.i);
    });
    box.addEventListener('mousemove', e => { const a = e.target.closest('[role="option"]'); if (a && !waiting() && +a.dataset.i !== at) mark(+a.dataset.i, false); });
  }
  // Only as many rows as the window has room for: a list that scrolls inside itself can look finished when it is not.
  function fit() {
    const rows = () => [...box.querySelectorAll('.sg-g [role="option"]')];
    for (let r = rows(); box.scrollHeight > box.clientHeight + 1 && r.length > 1; r = rows()) {
      const last = r[r.length - 1], g = last.closest('.sg-g');
      last.remove(); if (!g.querySelector('[role="option"]')) g.remove();
    }
  }
  function draw(q, groups, state) {
    if (!box) makeBox();
    const was = done ? opts[at]?.getAttribute('href') : null;
    const hits = groups.reduce((n, g) => n + g.items.length, 0);
    const note = state === 'err' ? failed : state !== 'busy' && !hits ? empty(q) : '';
    const all = seeAll && seeAll(q, state === 'busy' ? 1 : hits);
    box.innerHTML = `<span class="sg-bspin" aria-hidden="true">${icon('loader-circle', { cls: 'sg-spin' })}</span>`
      + groups.filter(g => g.items.length).map((g, k) => `<div class="sg-g" role="group" aria-labelledby="${id}-g${k}"><div class="sg-h" id="${id}-g${k}" aria-hidden="true">${esc(g.label)}</div>${g.items.map(row).join('')}</div>`).join('')
      + (state === 'busy' ? `<div class="sg-skel" aria-hidden="true">${'<span class="skel"></span>'.repeat(3)}</div>` : '')
      // The note is for the eye; a screen reader hears the same words from the status line.
      + (note ? `<div class="sg-note" aria-hidden="true"><span>${esc(note)}</span></div>` : '')
      + (all ? row({ href: all.href, title: all.label, icon: all.icon, all: true }) : '');
    box.classList.remove('sg-busy'); box.removeAttribute('aria-busy');
    fit();
    opts = [...box.querySelectorAll('[role="option"]')];
    opts.forEach((el, n) => { el.id = `${id}-${n}`; el.dataset.i = n; });
    done = state !== 'busy';
    input.setAttribute('aria-expanded', 'true'); input.setAttribute('aria-controls', id);
    mark(was ? opts.findIndex(el => el.getAttribute('href') === was) : -1);   // a row highlighted before the answer landed stays highlighted
    const n = box.querySelectorAll('.sg-g [role="option"]').length;
    status.textContent = state === 'busy' ? `${busy}…` : note || `${n} suggestion${n === 1 ? '' : 's'}`;
  }
  function run() {
    const q = input.value.trim();
    if (q.length < min || !when()) { close(); return; }
    const my = ++seq, r = source(q) || { groups: [] };
    if (!r.more) { draw(q, r.groups || [], ''); return; }
    if (box && done) { box.classList.add('sg-busy'); box.setAttribute('aria-busy', 'true'); mark(-1); status.textContent = `${busy}…`; }
    else draw(q, r.groups || [], 'busy');
    r.more.then(g => { if (my === seq && input.value.trim() === q) draw(q, g, ''); },
      e => { console.error(e); if (my === seq) draw(q, r.groups || [], 'err'); });
  }

  input.addEventListener('input', () => { if (when()) keep(input.value); clearTimeout(timer); timer = setTimeout(run, wait); });
  input.addEventListener('focus', () => { if (!box) run(); });
  // Leaving the box closes the list. A redraw also removes the box, and then what was typed is kept for the new one.
  input.addEventListener('blur', () => setTimeout(() => { if (!input.isConnected || document.activeElement === input) return; close(); keep(''); }, 150));
  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && waiting()) { e.preventDefault(); return; }   // rows being replaced cannot be chosen
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!box) { run(); if (box && done) mark(0); } else mark(Math.min(opts.length - 1, at + 1)); }
    else if (e.key === 'ArrowUp') { if (box) { e.preventDefault(); mark(Math.max(-1, at - 1)); } }
    else if (e.key === 'Enter') { if (box && at >= 0 && !waiting()) { e.preventDefault(); pick(at); } else { clearTimeout(timer); close(); keep(''); } }
    else if (e.key === 'Escape') { if (box) { e.preventDefault(); e.stopPropagation(); close(); } }
    else if (e.key === 'Tab') close();
  });

  // A redraw of the same page: put back what was typed, with the focus when the redraw took it, and the list.
  const k = kept.get(input.id);
  if (k && k.hash === location.hash && !input.value && when()) {
    input.value = k.q;
    const a = document.activeElement;
    if (!a || a === document.body || !a.isConnected) { input.focus({ preventScroll: true }); try { input.setSelectionRange(k.q.length, k.q.length); } catch { /* not a text box */ } }
    else if (a === input) run();
  }
}
