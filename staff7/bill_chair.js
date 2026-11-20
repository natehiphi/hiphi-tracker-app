// The bill page's line for an ask to the chair (R-398 piece 5): where it stands, and the quiet button The chair replied (anyone on staff can record a reply). Read from ask_data.js; the button only
// opens the reply sheet (do_reply.js), so looking at a bill never changes it. Nothing is drawn when nobody has asked, or when the ask ended by itself.
import { esc, btn } from './parts.js';
import { askForBill, billLine } from './ask_data.js';

export function chairLineHTML(b) {
  const a = askForBill(b); if (!a) return '';
  return `<div class="chln" id="bChair"><p class="bln chl"><span class="blt">${esc(billLine(a))}</span></p>${btn('The chair replied', { kind: 'quiet', id: 'bReply', attrs: `data-ask="${esc(a.key)}"` })}</div>`;
}
export function bindChairLine() {
  document.getElementById('bReply')?.addEventListener('click', e => { location.hash = '#/ask/' + encodeURIComponent(e.currentTarget.dataset.ask); });
}
