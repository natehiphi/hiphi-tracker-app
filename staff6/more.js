// Staff v6 (R-336, spec 3.2, D2, V02, V03): the phone's More page (#/more). The bottom bar has five tabs (Today, Hearings,
// Testimony, Bills, More); More is a labelled page, not a menu, naming every other place with one plain line each, so
// nothing is hidden behind an icon (Nate, 22 Oct: "If people are unable to find things because they are hidden or hard to
// find, that would be the worst"). On a laptop #/more shows the same page; the sidebar already shows every place.
// It also holds the table of places the frame draws from (app.js sidebar and tab bar, tools.js), so a place has one name,
// one icon and one line everywhere (V19).
import { S, DEMO, DEMO_ASOF, esc } from './data.js';
import { icon, avatar } from './ui.js';
import { inboxCount } from './model.js';
import { admitsPartners } from './partnerq.js';

// key -> [address, icon, name, short name (the collapsed sidebar), one plain line (More, More tools)]
export const PLACES = {
  today: ['#/', 'list-todo', 'Today', 'Today', 'Your next step and what is due'],
  hearings: ['#/hearings', 'calendar-days', 'Hearings', 'Hearings', 'This week’s hearings, and getting bills heard'],
  testimony: ['#/testimony', 'file-text', 'Testimony', 'Testimony', 'Write, approve and file testimony'],
  outreach: ['#/outreach', 'megaphone', 'Outreach', 'Outreach', 'Rally the public and partners'],
  bills: ['#/bills', 'scroll-text', 'Bills', 'Bills', 'Every bill we track and where it stands'],
  legislators: ['#/legislators', 'landmark', 'Legislators', 'Legislators', 'Who to ask, and everyone at the Capitol'],
  myissues: ['#/my-issues', 'tag', 'My issues', 'My issues', 'The issues you own or help on'],
  inbox: ['#/inbox', 'inbox', 'Inbox', 'Inbox', 'Messages and updates for you'],
  help: ['#/help', 'circle-help', 'Help', 'Help', 'Guides, Capitol words and what moved'],
  team: ['#/team', 'users', 'Team', 'Team', 'What is slipping, and who is on what'],
  people: ['#/people', 'user-round', 'People', 'People', 'Everyone’s records; hand over and turn off'],
  partners: ['#/partners', 'handshake', 'Partners', 'Partners', 'Groups that write on the public tracker'],
  setup: ['#/setup', 'sliders-horizontal', 'Session setup', 'Setup', 'The season checklist, alerts and connections'],
  tools: ['#/tools', 'list', 'More tools', 'Tools', 'Every other tool, grouped by job'],
  more: ['#/more', 'ellipsis', 'More', 'More', 'Every other place'],
  you: ['#/me', 'circle-user', 'You', 'You', 'My settings and sign out'],
};
// The places, in the sidebar's order (spec 3.1); the phone bar's five (D2).
export const MAIN = ['today', 'hearings', 'testimony', 'outreach', 'bills', 'legislators', 'myissues'];
export const BAR = ['today', 'hearings', 'testimony', 'bills', 'more'];
// Leads (V18): Team for admins and second approvers; People and Session setup for admins; Partners for admins and partner
// approvers (R-328). Always in the same spot, and absent for everyone else (D8 names them at the foot of More tools).
export const isLead = (a = S.me) => !!a && a.is_active !== false && (!!a.is_admin || !!a.is_reviewer);
export const leadKeys = (a = S.me) => [isLead(a) ? 'team' : null, a?.is_admin ? 'people' : null, admitsPartners(a) ? 'partners' : null, a?.is_admin ? 'setup' : null].filter(Boolean);
// "Nate T." for the sidebar's foot ("You · Nate T."): a first name and an initial, so two Kevins would still differ.
export const youName = (a = S.me) => { const p = String(a?.full_name || '').trim().split(/\s+/).filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };

// One labelled row: icon, name, one plain line; a count when the place has one (the Inbox's unread). `you` is a button that
// opens the account menu (app.js wires [data-you] on every page; the sidebar's You uses it).
export function placeRow(k, { line, count = 0, href, label, ic, you = false, ext = false } = {}) {
  const [h, i, name, , l] = PLACES[k] || ['#/', 'circle', k, k, ''];
  const lead = you ? `<span class="v6-more-ic">${avatar(S.me, 40)}</span>` : `<span class="v6-more-ic">${icon(ic || i)}</span>`;
  const n = count ? `<span class="v6-more-n" aria-label="${count} unread">${count > 99 ? '99+' : count}</span>` : '';
  const inner = `${lead}<span class="v6-more-tx"><span class="v6-more-nm">${esc(label || (you ? `You · ${youName()}` : name))}</span><span class="v6-more-ln">${esc(line ?? l)}</span></span>${n}${icon(ext ? 'external-link' : 'chevron-right', { cls: 'chev' })}`;
  return you ? `<button type="button" class="v6-more-row" data-you aria-haspopup="menu">${inner}</button>`
    : `<a class="v6-more-row" href="${esc(href || h)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
}
export const placeList = rows => `<ul class="v6-more-list">${rows.filter(Boolean).map(r => `<li>${r}</li>`).join('')}</ul>`;

// How fresh the Capitol data is (F9): always said here, quietly; the sidebar says it only when it is stale.
function syncWords() {
  if (DEMO) return `Practice data, as of ${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}`;
  const last = (S.syncRuns || []).find(r => r.ok)?.finished_at; if (!last) return '';
  const h = Math.floor((Date.now() - new Date(last).getTime()) / 36e5);
  return `Capitol data synced ${h < 1 ? 'less than an hour ago' : h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.floor(h / 24)} days ago`}`;
}

// You (spec 3.2): the account menu's items as rows (app.js accountItems), so My settings is two labelled taps on a phone.
const acct = () => { try { return S.accountItems?.() || []; } catch { return []; } };

export default {
  tab: 'more',
  title: () => 'More',
  render() {
    let unread = 0; try { unread = inboxCount(); } catch { unread = 0; }
    const leads = leadKeys(), sync = syncWords();
    return `<div class="v6-more">
      <h1 class="v6-ptitle sv-h1">More</h1>
      <section class="v6-more-sec" aria-label="Places">${placeList([placeRow('outreach'), placeRow('legislators'), placeRow('myissues'), placeRow('inbox', { count: unread }), placeRow('help')])}</section>
      ${leads.length ? `<section class="v6-more-sec" aria-labelledby="mo-lead"><h2 class="v6-more-h" id="mo-lead">Lead tools</h2>${placeList(leads.map(k => placeRow(k)))}</section>` : ''}
      <section class="v6-more-sec" aria-label="More tools">${placeList([placeRow('tools')])}</section>
      <section class="v6-more-sec" aria-labelledby="mo-you"><h2 class="v6-more-h mo-you" id="mo-you">${avatar(S.me, 28)}<span>You · ${esc(youName())}</span></h2>${placeList(acct().map((it, i) => `<button type="button" class="v6-more-row" data-acct="${i}"><span class="v6-more-ic">${icon(it.icon)}</span><span class="v6-more-tx"><span class="v6-more-nm">${esc(it.label)}</span>${it.sub ? `<span class="v6-more-ln">${esc(it.sub)}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</button>`))}</section>
      ${sync ? `<p class="v6-more-sync">${icon('refresh-cw')}<span>${esc(sync)}</span></p>` : ''}
    </div>`;
  },
  wire(route, root) { const items = acct(); root.querySelectorAll('[data-acct]').forEach(el => { el.onclick = () => items[+el.dataset.acct]?.run(); }); },
};
