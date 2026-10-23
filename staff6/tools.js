// Staff v6 (R-336, spec 3.5, D8, V03, V18): More tools (#/tools). Every rare tool on one page, grouped by the job it is for,
// one labelled row and one plain line each, so nothing anyone needs now and then sits behind a "…" menu or a remembered
// address (Nate, 22 Oct: "keep all, show by role"). Each row opens the tool's existing address, which keeps working; search
// finds each one too. Tools a person's role cannot use are left out, and one quiet line at the foot names them (D8).
import { S, DEMO, esc, hooks } from './data.js';
import { icon, menuSheet } from './ui.js';
import { placeRow, placeList, leadKeys, isLead, syncWords } from './more.js';
import { admitsPartners } from './partnerq.js';
import { HOLDING } from './holding.js';
import { views } from './filters.js';
import { canSort, showMutedTab, loadSortCount, sortWords } from './billshead.js';
import { BOARD_HREF } from './prep.js';

// A row: [name, address, icon, one plain line, ext (a new tab)]. Every row opens where the tool really is: Bills reads
// ?views=1, ?select=1 and ?export=1 on arrival and takes that step there (bills.js), so these are plain addresses that
// keep their promise and open in a new tab too (C-6, B-3). (They used to open Bills and press its "…" menu, which v6 no
// longer has, so Export and, with nothing saved, Saved views did nothing.)
const row = ([name, href, ic, line, ext]) => placeRow('tools', { label: name, href, ic, line, ext });
// A row that is a button (it opens a picker or the You menu rather than a page): the same look as a link row.
const rowBtn = (attrs, ic, name, line) => `<button type="button" class="v6-more-row" ${attrs}><span class="v6-more-ic">${icon(ic)}</span><span class="v6-more-tx"><span class="v6-more-nm">${esc(name)}</span><span class="v6-more-ln">${esc(line)}</span></span>${icon('chevron-right', { cls: 'chev' })}</button>`;
// Sort new bills says its one number and what it means (V19, V35): the same count as Bills' tab ("12 new bills match
// CTFH's words"), from billshead.js. Until it is read, what the page is for.
const sortLine = () => sortWords() || 'Track or pass each new bill';
function groups() {
  const nv = views().length, admin = !!S.me?.is_admin, sorts = canSort();
  return [
    ['Getting hearings', [
      HOLDING() ? ['Holding our bills', '#/legislators?view=holding', 'landmark', 'Which chairs hold our bills, and who to ask'] : null,
      ['Session calendar', '#/help/calendar', 'calendar', 'The session’s deadlines, day by day'],
      DEMO ? ['Legislators’ profiles', '#/legislators?view=everyone', 'user-round', 'Everyone at the Capitol, and what each cares about (practice copy)'] : null,
    ]],
    ['Testimony', [
      // F118: the library has its own address (Testimony draws it); Filed links to it too.
      ['Earlier testimony library', '#/testimony?view=library', 'book-open', 'Every filed testimony, to borrow from'],
      ['How to file', '#/help/file', 'clipboard-check', 'Filing at the Capitol, step by step'],
    ]],
    ['Rally', [
      ['Lists', '#/outreach/lists', 'list', 'Shared lists of bills for the public page'],
      ['Make a link or QR code', '#/my-issues/all?view=links', 'qr-code', 'A link for a partner or an event, with its QR code'],
      ['First visit numbers', '#/my-issues/all?view=first-visit', 'chart-column', 'How newcomers find and use the public tracker'],
      ['Supporters’ groups', '#/outreach/supporters', 'users-round', 'Saved groups of supporters, to email'],
      // F177: Import CSV and Export sit in plain sight at the foot of Supporters (admins).
      admin ? ['Import or export supporters', '#/outreach/supporters', 'upload', 'A spreadsheet in or out, at the foot of Supporters'] : null,
    ]],
    // Sort new bills and Muted are for whoever sorts and mutes (admins and owners, F94, F97), as Bills' own tabs are; the
    // foot line names them for everyone else (D8).
    ['Bills', [
      sorts ? ['Sort new bills', '#/bills/new', 'sparkles', sortLine()] : null,
      showMutedTab() ? ['Muted bills', '#/bills/muted', 'bell-off', 'Bills set aside, out of your lists'] : null,
      ['Saved views', '#/bills?views=1', 'bookmark', nv ? `Your ${nv} saved view${nv === 1 ? '' : 's'} of Bills` : 'Save Bills’ filters to come back to them'],
      ['Bulk change', '#/bills?select=1', 'list-checks', 'Opens Bills with tick boxes, to change many bills at once'],
      ['Export', '#/bills?export=1', 'download', 'The bills list as a spreadsheet file'],
    ]],
    ['Learning', [
      ['Getting started', '#/help/new', 'compass', 'The first things to do, for someone new'],
      // The practice copy: from the live app it opens in a new tab; inside it, the row says so and opens You, where the
      // practice's own steps are (practise as a teammate, start over).
      DEMO ? rowBtn('data-you aria-haspopup="menu"', 'play', 'Practice copy', 'You’re in it now. Practise as a teammate or start it over')
        : ['Practice copy', 'staff6.html?demo=1', 'play', 'Last March, to practise on; nothing reaches the team', true],
      ['What moved', '#/help/moved', 'route', 'Where each v5 place and button is now'],
      ['Keyboard shortcuts', '#/help/keys', 'keyboard', 'Every key, and how to turn them off'],
      // F190: the way back while v6 settles in, for everyone (it goes 3 weeks after the switch).
      ['Back to Staff v5', `staff5.html${location.search}#/`, 'undo-2', 'The version before this one, at Today'],
    ]],
  ].map(([h, rows]) => [h, rows.filter(Boolean)]);
}
// D8: the tools this person's role leaves out, named once so nobody wonders whether they exist.
function footLine() {
  const a = S.me; if (!a) return '';
  const out = [];
  if (!a.is_admin) {
    const miss = [isLead(a) ? null : 'Team', 'People', admitsPartners(a) ? null : 'Partners', 'Session setup'].filter(Boolean);
    out.push(`Admins also have ${miss.length > 1 ? `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}` : miss[0]}. Ask Nate.`);
  }
  const bills = [canSort() ? null : 'Sort new bills', showMutedTab() ? null : 'Muted bills'].filter(Boolean);
  if (bills.length) out.push(`Bill and coalition owners also have ${bills.join(' and ')}.`);
  return out.join(' ');
}
const teammates = () => (S.advocates || []).filter(x => x.is_active !== false && x.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));

export default {
  tab: 'tools',
  title: () => 'More tools',
  render() {
    const admin = !!S.me?.is_admin, leads = leadKeys(), back = location.search + '#/', sync = syncWords(), foot = footLine();
    loadSortCount(() => { if (S.route?.name === 'tools') hooks.render?.(); });   // the one number on Sort new bills, read once
    const sec = (h, rows, id) => `<section class="v6-more-sec" aria-labelledby="tl-${id}"><h2 class="v6-more-h" id="tl-${id}">${esc(h)}</h2>${placeList(rows)}</section>`;
    const asRow = r => typeof r === 'string' ? r : row(r);
    return `<div class="v6-more v6-tools">
      <h1 class="v6-ptitle sv-h1">More tools</h1>
      ${groups().map(([h, rows], i) => sec(h, rows.map(asRow), i)).join('')}
      ${sec('Someone else’s list', [rowBtn('data-tlwho aria-haspopup="dialog"', 'users-round', 'See a teammate’s list', 'Their Today, to read, when you cover for them')], 'who')}
      ${leads.length ? sec('Lead tools', [...leads.map(k => placeRow(k)),
        // F165: the admins' Prep board, a view on All issues (issues.js, prep.js)
        admin ? row(['Prep board', BOARD_HREF, 'clipboard-check', 'Every issue’s 2027 prep, to review and approve']) : null], 'lead') : ''}
      ${admin ? sec('Compare versions', [
        row(['Compare with Staff v2', `staff.html${back}`, 'columns-3', 'The team’s app today, at Today']),
        row(['The old app', `classic.html${DEMO ? '?demo=1' : ''}`, 'external-link', 'The old staff app, to look at only']),
      ], 'cmp') : ''}
      ${foot || sync ? `<div class="v6-more-foot">${foot ? `<p>${esc(foot)}</p>` : ''}${sync ? `<p class="v6-more-sync">${icon('refresh-cw')}<span>${esc(sync)}</span></p>` : ''}</div>` : ''}
    </div>`;
  },
  wire(route, root) {
    // A teammate's Today, read-only (spec 3.5): everyone may look; the Team page around it is for leads (team.js reads ?who=).
    // No owner lists the bills nobody holds (F74, F76), as Team's own picker does.
    root.querySelector('[data-tlwho]')?.addEventListener('click', () => menuSheet({ title: 'See a teammate’s list', items: [...teammates().map(a => ({
      label: a.full_name, icon: 'user-round', sub: a.is_admin ? 'Admin' : a.can_approve ? 'Approver' : a.is_reviewer ? 'Second approver' : '',
      run: () => S.go(`#/team?who=${encodeURIComponent(a.id)}`) })), { label: 'No owner', icon: 'user-round', sub: 'Bills with no owner', run: () => S.go('#/team?who=none') }] }));
  },
};
