// STUB (R-336 FRAME): the Team place for leads (admins and second approvers), so #/team opens (spec 3.3, V15). The TODAY
// builder replaces this file. Route: { name: 'team', who, q } (app.js parseRoute). #/team?who=<advocate id> is "See a
// teammate's list", open to everyone from More tools (spec 3.5); the rest of the page is for leads. v5's #/?scope=team
// redirects here for leads (Today for everyone else). Screen module: { render, wire, title, tab, wide }.
// Until TEAM lands, the page IS v5's Team view (today.js with scope=team: Slipping, the team's list, one teammate's list),
// under the Team title, so nothing v5 had is out of reach while the place is rebuilt (rule 7.9, B-3).
import { S, esc, advocate } from './data.js';
import { btn } from './ui.js';
import today from './today.js';
import { isLead } from './more.js';

// The Team title is the page's one h1 (spec 3.1), so v5's own heading ("Team: today") becomes the section's h2.
const demote = html => String(html || '').replace(/<h1\b/, '<h2').replace('</h1>', '</h2>');
const first = a => String(a?.full_name || 'Teammate').split(' ')[0];
// today.js reads Team and whose list from S.route (#/?scope=team) and S.tdWho; `place` keeps the right place lit (app.js
// placeOf: Team for leads, More tools for anyone else reading a teammate's list).
function asTeam(route) {
  if (route.who) S.tdWho = route.who;
  return (S.route = { ...route, name: 'today', place: isLead() ? 'team' : 'tools', q: { ...route.q, scope: 'team' } });
}
const shows = route => !!(route.who ? advocate(route.who) : isLead());

export default {
  tab: 'team',
  title: route => route?.who && advocate(route.who) ? `${first(advocate(route.who))}’s list` : 'Team',
  back: route => route?.who && !isLead() ? { href: '#/tools', label: 'More tools' } : null,
  wide: route => shows(route) && !!today.wide?.(),
  render(route) {
    const who = route.who ? advocate(route.who) : null;
    if (shows(route)) {
      let body; try { body = demote(today.render(asTeam(route))); } catch (e) { console.error(e); body = ''; }
      return `<div class="v6-stubwk"><h1 class="v6-ptitle sv-h1">${esc(who ? `${first(who)}’s list` : 'Team')}</h1>${body}</div>`;
    }
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Team</h1>
      <div class="card v6-stubcard"><h2>Team is a lead tool</h2><p>Admins and second approvers see what is slipping and who is on what here. You can still read a teammate’s list from More tools.</p>
        <div class="btnrow">${btn('See a teammate’s list', { kind: 'secondary', href: '#/tools' })}</div></div></div>`;
  },
  wire(route, root) { if (shows(route)) { try { today.wire(S.route, root); } catch (e) { console.error(e); } } },
};
