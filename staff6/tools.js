// Staff v6 (R-336, spec 3.5, D8, V03, V18): More tools (#/tools). Every rare tool on one page, grouped by the job it is for,
// one labelled row and one plain line each, so nothing anyone needs now and then sits behind a "…" menu or a remembered
// address (Nate, 22 Oct: "keep all, show by role"). Each row opens the tool's existing address, which keeps working; search
// finds each one too. Tools a person's role cannot use are left out, and one quiet line at the foot names them (D8).
import { S, DB, DEMO, esc, hooks } from './data.js';
import { icon, menuSheet } from './ui.js';
import { placeRow, placeList, leadKeys, isLead } from './more.js';
import { admitsPartners } from './partnerq.js';
import { HOLDING } from './holding.js';
import { startSelect } from './bulk.js';
import { views, openEditViews } from './filters.js';

// A row: [name, address, icon, one plain line, ext (a new tab), act (a step taken on arrival, TOOL_ACT)].
const row = ([name, href, ic, line, ext, act]) => placeRow('tools', { label: name, href, ic, line, ext, act });
// Bills keeps three of its tools in its own state or its "…" menu, not in its address (bills.js reads no ?select= or
// ?export=). So these rows open Bills and then take that step there, and each keeps its promise (C-6, B-3): Bulk change
// opens Bills with its tick boxes, Saved views opens the saved views (or, with none yet, Bills' menu at Save this view),
// Export opens Bills' menu with Export CSV ready. BILLS can make them addresses (#/bills?select=1, ?views=1, ?export=1).
function billsMenu(at) {
  const more = document.querySelector('main [data-more]'); if (!more) return;
  more.click();
  setTimeout(() => [...document.querySelectorAll('dialog[open] .sv-menu button')].find(b => at.test(b.textContent))?.focus(), 30);
}
const TOOL_ACT = {
  select: () => { S.go('#/bills'); startSelect(); },
  views: () => { S.go('#/bills'); if (views().length) openEditViews(() => hooks.render?.()); else billsMenu(/Save this view/); },
  export: () => { S.go('#/bills'); billsMenu(/Export/); },
};
// Sort new bills says its one number: how many new bills a coalition's words match (the list Sort new bills opens on).
function sortLine() {
  const c = S.triageCounts;
  if (!c) return 'Track or pass each new bill';
  const n = c.suggested || 0;
  return n ? `${n.toLocaleString()} new bill${n === 1 ? '' : 's'} match a coalition` : 'No new bills waiting';
}
function groups() {
  const nv = views().length;
  return [
    ['Getting hearings', [
      HOLDING() ? ['Holding our bills', '#/legislators?view=holding', 'landmark', 'Which chairs hold our bills, and who to ask'] : null,
      ['Session calendar', '#/help/calendar', 'calendar', 'The session’s deadlines, day by day'],
      DEMO ? ['Legislators’ profiles', '#/legislators?view=everyone', 'user-round', 'Everyone at the Capitol, and what each cares about (practice copy)'] : null,
    ]],
    ['Testimony', [
      ['Earlier testimony library', '#/testimony?view=filed', 'book-open', 'Every filed testimony, to borrow from'],
      ['How to file', '#/help/file', 'clipboard-check', 'Filing at the Capitol, step by step'],
    ]],
    ['Rally', [
      ['Lists', '#/outreach/lists', 'list', 'Shared lists of bills for the public page'],
      ['Make a link or QR code', '#/my-issues/all?view=links', 'qr-code', 'A link for a partner or an event, with its QR code'],
      ['First visit numbers', '#/my-issues/all?view=first-visit', 'chart-column', 'How newcomers find and use the public tracker'],
      ['Supporters’ groups', '#/outreach/supporters', 'users-round', 'Saved groups of supporters, to email'],
    ]],
    // Sort new bills is open to everyone (triage.js has no role gate; Bills' "…" offers it to all), so it is listed for all.
    ['Bills', [
      ['Sort new bills', '#/bills/new', 'sparkles', sortLine()],
      ['Muted bills', '#/bills/muted', 'bell-off', 'Bills set aside, out of your lists'],
      ['Saved views', '#/bills', 'bookmark', nv ? `Your ${nv} saved view${nv === 1 ? '' : 's'} of Bills` : 'Save Bills’ filters to come back to them', false, 'views'],
      ['Bulk change', '#/bills', 'list-checks', 'Opens Bills with tick boxes, to change many bills at once', false, 'select'],
      ['Export', '#/bills', 'download', 'Opens Bills’ menu at Export CSV: the list as a spreadsheet', false, 'export'],
    ]],
    ['Learning', [
      ['Getting started', '#/help/new', 'compass', 'The first things to do, for someone new'],
      DEMO ? null : ['Practice copy', 'staff6.html?demo=1', 'play', 'Last March, to practise on; nothing reaches the team', true],
      ['What moved from v5', '#/help/moved', 'route', 'Where each v5 place and button is now'],
      ['Keyboard shortcuts', '#/help/keys', 'keyboard', 'Every key, and how to turn them off'],
    ]],
  ].map(([h, rows]) => [h, rows.filter(Boolean)]);
}
// D8: the tools this person's role leaves out, named once so nobody wonders whether they exist.
function footLine() {
  const a = S.me; if (!a || a.is_admin) return '';
  const miss = [isLead(a) ? null : 'Team', 'People', admitsPartners(a) ? null : 'Partners', 'Session setup'].filter(Boolean);
  const list = miss.length > 1 ? `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}` : miss[0];
  return `Admins also have ${list}. Ask Nate.`;
}
const teammates = () => (S.advocates || []).filter(x => x.is_active !== false && x.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));

export default {
  tab: 'tools',
  title: () => 'More tools',
  render() {
    const admin = !!S.me?.is_admin, leads = leadKeys(), back = location.search + '#/';
    if (!S.triageCounts && !S.triageCountsLoading) {   // the one number on Sort new bills, read once
      S.triageCountsLoading = true;
      DB.triageCounts().then(c => { S.triageCounts = c; if (S.route?.name === 'tools') hooks.render?.(); }).catch(() => {}).finally(() => { S.triageCountsLoading = false; });
    }
    const sec = (h, rows, id) => `<section class="v6-more-sec" aria-labelledby="tl-${id}"><h2 class="v6-more-h" id="tl-${id}">${esc(h)}</h2>${placeList(rows)}</section>`;
    return `<div class="v6-more v6-tools">
      <h1 class="v6-ptitle sv-h1">More tools</h1>
      ${groups().map(([h, rows], i) => sec(h, rows.map(row), i)).join('')}
      ${sec('Someone else’s list', [`<button type="button" class="v6-more-row" data-tlwho aria-haspopup="dialog"><span class="v6-more-ic">${icon('users-round')}</span><span class="v6-more-tx"><span class="v6-more-nm">See a teammate’s list</span><span class="v6-more-ln">Their Today, to read, when you cover for them</span></span>${icon('chevron-right', { cls: 'chev' })}</button>`], 'who')}
      ${leads.length ? sec('Lead tools', leads.map(k => placeRow(k)), 'lead') : ''}
      ${admin ? sec('Compare versions', [
        row(['Compare with Staff v5', `staff5.html${back}`, 'columns-3', 'The version before this rebuild, at Today']),
        row(['Compare with Staff v2', `staff.html${back}`, 'columns-3', 'The team’s app today, at Today']),
        row(['The old app', `classic.html${DEMO ? '?demo=1' : ''}`, 'external-link', 'The old staff app, to look at only']),
      ], 'cmp') : ''}
      ${footLine() ? `<p class="v6-more-foot">${esc(footLine())}</p>` : ''}
    </div>`;
  },
  wire(route, root) {
    // The rows that take a step on arrival (TOOL_ACT). Registered before the frame's own link handler, which then leaves
    // the click alone; Cmd/Ctrl-click still opens plain Bills in a new tab.
    root.querySelectorAll('[data-act]').forEach(a => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault(); TOOL_ACT[a.dataset.act]?.();
    }));
    // A teammate's Today, read-only (spec 3.5): everyone may look; the Team page around it is for leads (team.js reads ?who=).
    root.querySelector('[data-tlwho]')?.addEventListener('click', () => menuSheet({ title: 'See a teammate’s list', items: teammates().map(a => ({
      label: a.full_name, icon: 'user-round', sub: a.is_admin ? 'Admin' : a.can_approve ? 'Approver' : a.is_reviewer ? 'Second approver' : '',
      run: () => S.go(`#/team?who=${encodeURIComponent(a.id)}`) })) }));
  },
};
