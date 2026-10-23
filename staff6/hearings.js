// STUB (R-336 FRAME): the Hearings place, so #/hearings and #/hearings/ask open (spec 3.3, D1). The HEARINGS builder
// replaces this file. Route: { name: 'hearings', view: 'week' | 'ask' | '' } (app.js parseRoute); a sitting stays
// #/hearing/<id> (hearing.js). Screen module: { render, wire, title, tab }.
import { esc } from './data.js';
import { icon, btn, sectionNav } from './ui.js';

const WHAT = {
  week: ['This week', 'One card per sitting, day by day: the time and room, who is going with I’m going on the card, and each of our bills with its testimony. A sitting that moved says so.'],
  ask: ['Get hearings', 'One board grouped by chair, soonest notice first. Each bill is Ask, Waiting on a reply or Scheduled: email the chair, then record the answer, two clicks from Today.'],
};
export default {
  tab: 'hearings',
  title: () => 'Hearings',
  render(route) {
    const v = route.view === 'ask' ? 'ask' : 'week', [h, text] = WHAT[v];
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Hearings</h1>
      ${sectionNav('hearings', v)}
      <div class="card v6-stubcard"><h2>${esc(h)}</h2><p>${esc(text)}</p>
        <div class="btnrow">${btn('Open Today', { kind: 'secondary', href: '#/' })}</div></div>
      <p class="v6-stubnote">${icon('info')}<span>This place is being built for Staff v6. Each sitting still opens from its bill.</span></p>
    </div>`;
  },
  wire() {},
};
