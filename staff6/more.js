// Staff v6 (R-336, spec 3.2, D2, V02, V03; R-356 round 1): the table of places the frame draws from (app.js sidebar, header
// and tab bar, tools.js), so a place has one name, one icon and one line everywhere (V19). The one More page (#/more and
// #/tools) is drawn by tools.js; it names every place that is not in the sidebar or the bar, so nothing is hidden behind an
// icon (Nate, 22 Oct: "If people are unable to find things because they are hidden or hard to find, that would be the
// worst"). The phone's bar has five tabs (Today, Hearings, Testimony, Bills, More).
import { S, DEMO, DEMO_ASOF, esc } from './data.js';
import { icon, avatar } from './ui.js';
import { admitsPartners } from './partnerq.js';

// key -> [address, icon, name, short name (the collapsed sidebar), one plain line (More, More tools)]
export const PLACES = {
  today: ['#/', 'list-todo', 'Today', 'Today', 'Your next step and what is due'],
  hearings: ['#/hearings', 'calendar-days', 'Hearings', 'Hearings', 'This week’s hearings, and getting bills heard'],
  testimony: ['#/testimony', 'file-text', 'Testimony', 'Testimony', 'Write, approve and file testimony'],
  outreach: ['#/outreach', 'megaphone', 'Outreach', 'Outreach', 'Rally the public and partners'],
  bills: ['#/bills', 'scroll-text', 'Bills', 'Bills', 'Every bill we track and where it stands'],
  legislators: ['#/legislators', 'landmark', 'Legislators', 'Legislators', 'Who to ask, and everyone at the Capitol'],
  myissues: ['#/my-issues', 'tag', 'Issues', 'Issues', 'The issues you own or help on'],
  inbox: ['#/inbox', 'inbox', 'Inbox', 'Inbox', 'Messages and updates for you'],
  help: ['#/help', 'circle-help', 'Help', 'Help', 'Guides, Capitol words and what moved'],
  team: ['#/team', 'users', 'Team', 'Team', 'What is slipping, and who is on what'],
  people: ['#/people', 'user-round', 'People', 'People', 'Everyone’s records; hand over and turn off'],
  partners: ['#/partners', 'handshake', 'Partners', 'Partners', 'Groups that write on the public tracker'],
  setup: ['#/setup', 'sliders-horizontal', 'Session setup', 'Setup', 'The season checklist and five groups of settings'],
  tools: ['#/more', 'ellipsis', 'More', 'More', 'Every other place and tool'],   // the sidebar's foot row; #/tools still opens the same page
  more: ['#/more', 'ellipsis', 'More', 'More', 'Every other place'],
  you: ['#/me', 'circle-user', 'You', 'You', 'My settings and sign out'],
};
// The five places and Bills, in the sidebar's order (R-356 decision 1: Today, Testimony, Hearings, Issues, Outreach; the rest
// is behind More); the phone bar's five (D2). Bills is still here only because round 2 moves it inside Issues, and
// Legislators has already left (it is a row on More, and search still finds it).
export const MAIN = ['today', 'testimony', 'hearings', 'myissues', 'outreach', 'bills'];
export const BAR = ['today', 'hearings', 'testimony', 'bills', 'more'];
// Leads (V18): Team for admins and second approvers; People and Session setup for admins; Partners for admins and partner
// approvers (R-328). Always in the same spot, and absent for everyone else (D8 names them at the foot of More tools).
export const isLead = (a = S.me) => !!a && a.is_active !== false && (!!a.is_admin || !!a.is_reviewer);
// Team also opens for a person an admin has given Sees Team (R-356 decision 4), without making them a lead otherwise.
export const seesTeam = (a = S.me) => isLead(a) || (!!a && a.is_active !== false && !!a.sees_team);
export const leadKeys = (a = S.me) => [seesTeam(a) ? 'team' : null, a?.is_admin ? 'people' : null, admitsPartners(a) ? 'partners' : null, a?.is_admin ? 'setup' : null].filter(Boolean);
// "Nate T." for the sidebar's foot ("You · Nate T."): a first name and an initial, so two Kevins would still differ.
export const youName = (a = S.me) => { const p = String(a?.full_name || '').trim().split(/\s+/).filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] || ''; };

// One labelled row: icon, name, one plain line; a count when the place has one (the Inbox's unread). `you` is a button that
// opens the account menu (app.js wires [data-you] on every page; the sidebar's You uses it).
export function placeRow(k, { line, count = 0, href, label, ic, you = false, ext = false, act = '', cls = '' } = {}) {
  const [h, i, name, , l] = PLACES[k] || ['#/', 'circle', k, k, ''];
  const lead = you ? `<span class="v6-more-ic">${avatar(S.me, 40)}</span>` : `<span class="v6-more-ic">${icon(ic || i)}</span>`;
  const n = count ? `<span class="v6-more-n" aria-label="${count} unread">${count > 99 ? '99+' : count}</span>` : '';
  const inner = `${lead}<span class="v6-more-tx"><span class="v6-more-nm">${esc(label || (you ? `You · ${youName()}` : name))}</span><span class="v6-more-ln">${esc(line ?? l)}</span></span>${n}${icon(ext ? 'external-link' : 'chevron-right', { cls: 'chev' })}`;
  return you ? `<button type="button" class="v6-more-row" data-you aria-haspopup="menu">${inner}</button>`
    : `<a class="v6-more-row${cls ? ' ' + cls : ''}" href="${esc(href || h)}"${ext ? ' target="_blank" rel="noopener"' : ''}${act ? ` data-act="${esc(act)}"` : ''}>${inner}</a>`;
}
export const placeList = rows => `<ul class="v6-more-list">${rows.filter(Boolean).map(r => `<li>${r}</li>`).join('')}</ul>`;

// How fresh the Capitol data is (F9): the line under You's Refresh now (app.js accountItems, so here in You's rows too) and
// the foot of More tools (tools.js). Never in a warning colour (D3).
export function syncWords() {
  if (DEMO) return `Practice data, as of ${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}`;
  const h = syncHours(); if (h == null) return '';
  return `Capitol data synced ${h < 1 ? 'less than an hour ago' : h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.floor(h / 24)} days ago`}`;
}
// Hours since the last good Capitol sync (live only; null when unknown or in the practice copy).
const syncHours = () => { if (DEMO) return null; const last = (S.syncRuns || []).find(r => r.ok)?.finished_at; return last ? Math.floor((Date.now() - new Date(last).getTime()) / 36e5) : null; };
// B-7: once the Capitol data is 12 hours old or more, everyone sees it without opening a menu: one neutral line at the
// sidebar's foot (app.js) and at the top of More on a phone, with Refresh now beside it. It is a line, not a row (12.4), and
// in body colour with a clock, not amber (D3): stale is a fact to know, not an alarm. Ten of the eleven are not admins, and
// only admins see Today's own line (after 36 hours).
export const syncStale = () => { const h = syncHours(); return h != null && h >= 12; };
export const syncNote = (cls = '') => syncStale() ? `<p class="sv-sync${cls ? ' ' + cls : ''}" title="${esc(syncWords())}">${icon('clock')}<span class="sv-synct">${esc(syncWords())}<span aria-hidden="true"> · </span><button type="button" class="sv-syncgo" data-reload>Refresh now</button></span></p>` : '';
