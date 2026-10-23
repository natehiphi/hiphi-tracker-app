// STUB (R-336 FRAME): the Team place for leads (admins and second approvers), so #/team opens (spec 3.3, V15). The TODAY
// builder replaces this file. Route: { name: 'team', who } (app.js parseRoute). #/team?who=<advocate id> is "See a
// teammate's list", read-only, open to everyone from More tools (spec 3.5); the rest of the page is for leads.
// v5's #/?scope=team redirects here for leads (Today for everyone else). Screen module: { render, wire, title, tab }.
import { S, esc, advocate } from './data.js';
import { icon, btn } from './ui.js';

const lead = () => !!(S.me?.is_admin || S.me?.is_reviewer);
export default {
  tab: 'team',
  title: route => route?.who ? `${(advocate(route.who)?.full_name || 'Teammate').split(' ')[0]}’s list` : 'Team',
  render(route) {
    const who = route.who ? advocate(route.who) : null;
    if (who) return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">${esc(who.full_name.split(' ')[0])}’s list</h1>
      <div class="card v6-stubcard"><h2>${esc(who.full_name)}’s Today, read-only</h2><p>Their steps in their own words, with no buttons and no colour, so you can cover for them.</p>
        <div class="btnrow">${btn('Back to More tools', { kind: 'secondary', href: '#/tools' })}</div></div>
      <p class="v6-stubnote">${icon('info')}<span>This page is being built for Staff v6.</span></p></div>`;
    if (!lead()) return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Team</h1>
      <div class="card v6-stubcard"><h2>Team is a lead tool</h2><p>Admins and second approvers see what is slipping and who is on what here. You can still read a teammate’s list from More tools.</p>
        <div class="btnrow">${btn('See a teammate’s list', { kind: 'secondary', href: '#/tools' })}</div></div></div>`;
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Team</h1>
      <div class="card v6-stubcard"><h2>What will be here</h2><ul>
        <li>Slipping: the team’s late steps, one button each, with Undo.</li>
        <li>Hearings at risk: a working day or less from the notice and no ask yet; bills with no owner first.</li>
        <li>Today’s and tomorrow’s hearings: time, room and who is going.</li>
        <li>Who is on what, support work included.</li>
        <li>See as a teammate, read-only.</li></ul></div>
      <p class="v6-stubnote">${icon('info')}<span>This place is being built for Staff v6. Today’s Team view still works in Staff v5.</span></p>
    </div>`;
  },
  wire() {},
};
