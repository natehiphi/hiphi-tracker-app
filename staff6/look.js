// HIPHI Staff v6 · the quick look (R-336 F57, V07, V17): a bill's next step and its facts without leaving the screen you are
// on, opened by Today's "o" key and by a row of Bills' table between 900 and 1099px (from 1100px the bill opens beside the
// list instead). v5's look had its own hearing card and its own word for where testimony stands (assessment X8: seven word
// lists); v6's draws the one open item (billpane.js openItem), so the step is said in steps.js words and its buttons are the
// same ones everywhere. j / k (and Previous and Next) walk the list it was opened from; "Open the bill" is one click.
// lookFacts() stays for today.js, which shows the same facts under its open item.
import { S } from './data.js';
import { openSheet, closeSheet, iconBtn, keysOn, keysUsed } from './ui.js';
import { billByRef, billRoute, hearingAhead } from './model.js';
import { openItem, aboutBill } from './billpane.js';

// openLook(bill, { list, index, from }): `list` is the bills of the screen it came from, so j/k can walk it; `from` is
// where a hearing opened from the card returns ('today', 'bills').
export function openLook(b, { list = null, index = 0, from = 'today' } = {}) {
  if (!b) return null;
  const n = list ? list.length : 0, i = list ? Math.max(0, Math.min(n - 1, index)) : 0;
  const foot = n > 1 ? `<div class="lk-nav"><span class="pos">${i + 1} of ${n}</span>
      ${iconBtn('chevron-left', 'Previous bill', { 'data-lk': 'prev', ...(i === 0 ? { 'aria-disabled': 'true' } : {}) })}${iconBtn('chevron-right', 'Next bill', { 'data-lk': 'next', ...(i >= n - 1 ? { 'aria-disabled': 'true' } : {}) })}
      ${keysUsed() ? '<span class="lk-keys"><kbd>J</kbd> <kbd>K</kbd> next and previous · <kbd>Esc</kbd> closes</span>' : ''}</div>` : '';
  return openSheet({
    title: 'Quick look', size: 'look', body: `<div class="lk-v6">${openItem(b, { viewer: S.me, where: 'pane', from, headId: 'lk-item-h' })}</div>`, foot,
    wire: d => {
      const move = k => { const to = list?.[i + k]; if (to) openLook(to, { list, index: i + k, from }); };
      // Links inside the sheet (Open the bill, the hearing) close it first, so Back from that page returns to the list.
      d.querySelectorAll('.lk-v6 a[href^="#/"]').forEach(a => a.addEventListener('click', async e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
        e.preventDefault(); const href = a.getAttribute('href'); await closeSheet({ silent: true }); S.go ? S.go(href) : (location.hash = href);
      }));
      d.querySelector('[data-lk="prev"]')?.addEventListener('click', () => move(-1));
      d.querySelector('[data-lk="next"]')?.addEventListener('click', () => move(1));
      d.addEventListener('keydown', e => {
        if (e.metaKey || e.ctrlKey || e.altKey || !keysOn()) return;
        if (/^(input|textarea|select)$/i.test(e.target?.tagName || '') || e.target?.isContentEditable) return;
        if (e.key === 'j') { e.preventDefault(); move(1); }
        else if (e.key === 'k') { e.preventDefault(); move(-1); }
        else if (e.key === 'Enter' && !e.target?.closest?.('button, a, summary')) { e.preventDefault(); closeSheet({ silent: true }).then(() => S.go(billRoute(b))); }
      });
    },
  });
}

// The facts under an open item (today.js): billpane.js's About this bill, in plain words with the codes small beside them.
// The hearing ahead is left out when the step card above already says it.
export function lookFacts(b) {
  if (!b) return '';
  return aboutBill(b, { hearing: !hearingAhead(b) });
}

// For a screen that only has a bill number to hand.
export const lookAt = (num, opts) => { const b = billByRef(num); return b ? openLook(b, opts) : null; };

export default openLook;
