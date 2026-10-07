// "A teammate changed this since you opened it" (R-152 B). Shown when DB.saveBillFields finds that someone else saved one of
// the fields the person is saving. Nothing has been written yet. The sheet shows theirs beside the person's own and asks:
// keep theirs (the person's other changes are still saved) or replace with theirs-for-mine. One primary button (A-3).
import { esc } from './data.js';
import { btn, openSheet, closeSheet } from './ui.js';

// fields: [{ label, theirs, mine }] already as text. keepTheirs / replace: async, called after the sheet closes.
export function askConflict({ title = 'A teammate changed this', fields, keepTheirs, replace }) {
  const show = v => String(v ?? '').trim() ? `<span class="cf-t">${esc(v)}</span>` : '<span class="cf-t muted">(empty)</span>';
  openSheet({ title: esc(title), size: 'auto',
    body: `<p class="small">Someone saved ${fields.length === 1 ? 'this' : 'these'} after you opened the page. Nothing of yours is lost yet: pick which one stays.</p>
      ${fields.map(f => `<section class="cf-f" aria-label="${esc(f.label)}"><h3 class="cf-h">${esc(f.label)}</h3>
        <div class="cf-c"><b>Theirs, saved just now</b>${show(f.theirs)}</div><div class="cf-c"><b>Yours</b>${show(f.mine)}</div></section>`).join('')}`,
    foot: `${btn('Keep theirs', { kind: 'secondary', attrs: { 'data-cfkeep': '1' } })}${btn('Replace with mine', { kind: 'primary', attrs: { 'data-cfmine': '1' } })}`,
    wire: dlg => {
      const run = fn => async () => { await closeSheet({ silent: true }); await fn(); };
      dlg.querySelector('[data-cfkeep]').onclick = run(keepTheirs);
      dlg.querySelector('[data-cfmine]').onclick = run(replace);
    } });
}
