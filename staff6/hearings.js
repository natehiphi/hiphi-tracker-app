// STUB (R-336 FRAME): the Hearings place, so #/hearings and #/hearings/ask open (spec 3.3, D1). The HEARINGS builder
// replaces this file. Route: { name: 'hearings', view: 'week' | 'ask' | '', q } (app.js parseRoute; v5's #/?view=week&w=1
// arrives here as #/hearings?w=1, and &scope=team as ?scope=team). A sitting stays #/hearing/<id> (hearing.js).
// Screen module: { render, wire, title, tab, wide }.
// Until HEARINGS lands, This week IS v5's This week (today.js's week view under the Hearings title and tabs), so nothing v5
// had is out of reach while the place is rebuilt (rule 7.9, B-3: no placeholder whose only button leads back to Today).
import { S } from './data.js';
import { icon, btn, sectionNav } from './ui.js';
import today from './today.js';

// today.js reads its view and scope from S.route (#/?view=week[&w=][&scope=team]); `place` keeps Hearings lit (app.js placeOf).
const asWeek = route => (S.route = { ...route, name: 'today', place: 'hearings', q: { ...route.q, view: 'week' } });
// The place's title is the page's one h1 (spec 3.1), so v5's own heading ("This week") becomes the section's h2.
const demote = html => String(html || '').replace(/<h1\b/, '<h2').replace('</h1>', '</h2>');
const isWeek = route => route.view !== 'ask';

export default {
  tab: 'hearings',
  title: () => 'Hearings',
  wide: route => isWeek(route) && !!today.wide?.(),
  render(route) {
    if (isWeek(route)) {
      let body; try { body = demote(today.render(asWeek(route))); } catch (e) { console.error(e); body = ''; }
      return `<div class="v6-stubwk">
        <h1 class="v6-ptitle sv-h1">Hearings</h1>
        ${sectionNav('hearings', 'week')}
        ${body}
      </div>`;
    }
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Hearings</h1>
      ${sectionNav('hearings', 'ask')}
      <div class="card v6-stubcard"><h2>Get hearings</h2>
        <p>One board grouped by chair, soonest notice first. Each bill is Ask, Waiting on a reply or Scheduled: email the chair, then record the answer, two clicks from Today.</p>
        <p>Until this board is built, each coalition’s page has its Get hearings board, and your own chair asks are on Today.</p>
        <div class="btnrow">${btn('Open Coalitions', { kind: 'secondary', icon: 'users-round', href: '#/my-issues/coalitions' })}</div></div>
      <p class="v6-stubnote">${icon('info')}<span>This tab is being built for Staff v6.</span></p>
    </div>`;
  },
  wire(route, root) { if (isWeek(route)) { try { today.wire(S.route, root); } catch (e) { console.error(e); } } },
};
