// STUB (R-336 FRAME): the People place for admins, so #/people and #/people/<id> open (spec 3.3, V27, V28). The LEAD
// builder replaces this file. Route: { name: 'people', id } (app.js parseRoute); #/setup/people redirects here. Until it is
// built, the team list and sign-in links stay in Session setup's Team part. Screen module: { render, wire, title, tab, back }.
import { S, esc, advocate } from './data.js';
import { icon, btn, empty } from './ui.js';

const admins = () => (S.advocates || []).filter(a => a.is_admin && a.is_active !== false).map(a => a.full_name).join(' or ') || 'an admin';
export default {
  tab: 'people',
  title: route => route?.id ? (advocate(route.id)?.full_name || 'Person') : 'People',
  back: route => route?.id ? { href: '#/people', label: 'People' } : null,
  render(route) {
    const p = route.id ? advocate(route.id) : null, admin = !!S.me?.is_admin;
    // The same words Session setup says to anyone who is not an admin (setup.js), so the two lead pages agree.
    if (!admin) return `<div class="v6-stub"><h1 class="v6-ptitle sv-h1">People</h1>${empty({ title: 'People is for admins', text: `Ask ${esc(admins())} to change someone’s record. Your own choices are in My settings.`, action: btn('Open My settings', { kind: 'secondary', href: '#/me' }) })}</div>`;
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">${esc(p ? p.full_name : 'People')}</h1>
      <div class="card v6-stubcard">${p
        ? `<h2>${esc(p.full_name)}’s record</h2><p>All their roles together, their sign-in and Slack reach, and Leaving or away?: everything they hold, a suggested cover for each, and one Hand over and turn off with Undo.</p>`
        : `<h2>What will be here</h2><p>Everyone’s record in one list: their roles (Admin, Approver, Second approver, Partner approver), sign-in and Slack reach, and Leaving or away? to hand over their work in one step.</p>`}
        <div class="btnrow">${btn('Open Session setup, Team', { kind: 'secondary', icon: 'users-round', href: '#/setup/team' })}</div></div>
      <p class="v6-stubnote">${icon('info')}<span>This place is being built for Staff v6. Until then, the team list is in Session setup.</span></p>
    </div>`;
  },
  wire() {},
};
