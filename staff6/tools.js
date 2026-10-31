// Staff v6 (R-336, spec 3.5, D8, V03, V18; R-356 round 1): More (#/more and #/tools, one page, drawn here). First the places
// that are not in the sidebar or the phone's bar, then every rare tool, grouped by the job it is for,
// one labelled row and one plain line each, so nothing anyone needs now and then sits behind a "…" menu or a remembered
// address (Nate, 22 Oct: "keep all, show by role"). Each row opens the tool's existing address, which keeps working; search
// finds each one too. Tools a person's role cannot use are left out, and one quiet line at the foot names them (D8). A tool
// that only repeats a tab or a control on its own place (Sort new bills, Muted, Saved views, Bulk change and Export on Bills;
// the library on Testimony) is not a row here: the place already shows it.
import { S, DEMO, esc } from './data.js';
import { icon, menuSheet, avatar } from './ui.js';
import { placeRow, placeList, leadKeys, isLead, seesTeam, syncWords, syncNote, syncStale, youName } from './more.js';
import { messagesCount } from './inbox.js';   // the Inbox page's own count, so the row's number matches it (A-14)
import { admitsPartners } from './partnerq.js';
import { canSort, showMutedTab } from './billshead.js';
import { BOARD_HREF } from './prep.js';

// A row: [name, address, icon, one plain line, ext (a new tab)]. Every row opens where the tool really is: Bills reads
// ?views=1, ?select=1 and ?export=1 on arrival and takes that step there (bills.js), so these are plain addresses that
// keep their promise and open in a new tab too (C-6, B-3). (They used to open Bills and press its "…" menu, which v6 no
// longer has, so Export and, with nothing saved, Saved views did nothing.)
const row = ([name, href, ic, line, ext]) => placeRow('tools', { label: name, href, ic, line, ext });
// A row that is a button (it opens a picker or the You menu rather than a page): the same look as a link row.
const rowBtn = (attrs, ic, name, line) => `<button type="button" class="v6-more-row" ${attrs}><span class="v6-more-ic">${icon(ic)}</span><span class="v6-more-tx"><span class="v6-more-nm">${esc(name)}</span><span class="v6-more-ln">${esc(line)}</span></span>${icon('chevron-right', { cls: 'chev' })}</button>`;
// R-344 rule 5 (one picture, one meaning): each row's picture is its place's own. Legislators' rows carry the Capitol, the
// session calendar the deadlines' flag (My issues' Deadlines), supporters' groups the supporters' heart-handshake, a
// teammate's list the eye that reads it; the people icons are left to Team (users) and People (user-round).
function groups() {
  const admin = !!S.me?.is_admin;
  return [
    ['Getting hearings', [
      // A-14, A-12: Legislators’ profiles was a second row to Legislators › Everyone, which Places above already opens.
      ['Session calendar', '#/help/calendar', 'flag', 'The session’s deadlines, day by day'],
      // All issues' week calendar lost its tab in round 2 (decision 3); this row is its way in (A-12: one way in).
      ['Issues calendar', '#/issues/all?view=cal', 'calendar', 'Every issue’s week, as a calendar'],
    ]],
    ['Testimony', [
      ['How to file', '#/help/file', 'clipboard-check', 'Filing at the Capitol, step by step'],
    ]],
    ['Rally', [
      ['Lists', '#/outreach/lists', 'list', 'Shared lists of bills for the public page'],
      ['Make a link or QR code', '#/issues/all?view=links', 'qr-code', 'A link for a partner or an event, with its QR code'],
      ['First visit numbers', '#/issues/all?view=first-visit', 'chart-column', 'How newcomers find and use the public tracker'],
      // F177: an admin's Import CSV and Export sit at the foot of Supporters: one row says both, and ?io=1 opens Supporters at
      // that foot (A-14: one row per place; it used to be two rows to the same top of the page, the second a scroll away).
      admin ? ['Supporters’ groups, import and export', '#/outreach/supporters?io=1', 'heart-handshake', 'Saved groups to email; a spreadsheet in or out at the foot']
        : ['Supporters’ groups', '#/outreach/supporters', 'heart-handshake', 'Saved groups of supporters, to email'],
    ]],
    ['Learning', [
      ['Getting started', '#/help/new', 'compass', 'The first things to do, for someone new'],
      // The practice copy: from the live app it opens in a new tab; inside it, the row says so and opens You, where the
      // practice's own steps are (practice as a teammate, start over). One spelling, the word list's: Practice (C-15).
      DEMO ? rowBtn('data-you aria-haspopup="menu"', 'play', 'Practice copy', 'You’re in it now. Practice as a teammate or start it over')
        : ['Practice copy', 'staff6.html?demo=1', 'play', 'Last March, to practice on; nothing reaches the team', true],
      ['What moved', '#/help/moved', 'route', 'Where each v5 place and button is now'],
      ['Keyboard shortcuts', '#/help/keys', 'keyboard', 'Every key, and how to turn them off'],
    ]],
  ].map(([h, rows]) => [h, rows.filter(Boolean)]);
}
// One place about versions, last on the page (A-14): F190's way back to v5 for everyone while v6 settles in (it goes 3 weeks
// after the switch), and for admins the two older apps to compare with.
const versions = admin => [
  ['Back to Staff v5', `staff5.html${location.search}#/`, 'undo-2', 'The version before this one, at Today'],
  admin ? ['Compare with Staff v2', `staff.html${location.search}#/`, 'columns-3', 'The team’s app today, at Today'] : null,
  admin ? ['The old app', `classic.html${DEMO ? '?demo=1' : ''}`, 'external-link', 'The old staff app, to look at only'] : null,
].filter(Boolean).map(row);
// D8: the tools this person's role leaves out, named once so nobody wonders whether they exist.
function footLine() {
  const a = S.me; if (!a) return '';
  const out = [];
  if (!a.is_admin) {
    const miss = [seesTeam(a) ? null : 'Team', 'People', admitsPartners(a) ? null : 'Partners', 'Session setup'].filter(Boolean);
    out.push(`Admins also have ${miss.length > 1 ? `${miss.slice(0, -1).join(', ')} and ${miss[miss.length - 1]}` : miss[0]}. Ask Nate.`);
  }
  const bills = [canSort() ? null : 'New', showMutedTab() ? null : 'Muted'].filter(Boolean);
  if (bills.length) out.push(`Bill and coalition owners also have ${bills.join(' and ')} tabs on Issues › Bills.`);
  return out.join(' ');
}
// C-15: Kris sees Team without being a lead, so the one row Team is not under "Lead tools" (app.js says the same).
export const leadHead = leads => !isLead() && leads.length === 1 && leads[0] === 'team' ? 'Team' : 'Lead tools';
const teammates = () => (S.advocates || []).filter(x => x.is_active !== false && x.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name));

// You (spec 3.2): the account menu's items as rows (app.js accountItems), so My settings is two labelled taps on a phone.
const acct = () => { try { return S.accountItems?.() || []; } catch { return []; } };

export default {
  tab: 'more',
  title: () => 'More',
  render() {
    const admin = !!S.me?.is_admin, leads = leadKeys(), sync = syncWords(), foot = footLine(), stale = syncStale();
    let unread = 0; try { unread = messagesCount(); } catch { unread = 0; }
    // Outreach is in the laptop's sidebar, so its row shows on a phone only (staff.css v6-phone-only; Issues is in the phone bar too); Legislators,
    // Inbox and Help are here for everyone, one click from More (Nate, 22 Oct), and search finds each by its name.
    const places = [placeRow('outreach', { cls: 'v6-phone-only' }), placeRow('legislators'), placeRow('inbox', { count: unread }), placeRow('help')];
    const sec = (h, rows, id) => `<section class="v6-more-sec" aria-labelledby="tl-${id}"><h2 class="v6-more-h" id="tl-${id}">${esc(h)}</h2>${placeList(rows)}</section>`;
    const asRow = r => typeof r === 'string' ? r : row(r);
    return `<div class="v6-more v6-tools">
      <h1 class="v6-ptitle sv-h1">More</h1>
      ${stale ? syncNote('v6-more-syncn') : ''}
      <section class="v6-more-sec" aria-labelledby="tl-places"><h2 class="v6-more-h" id="tl-places">Places</h2>${placeList(places)}</section>
      ${groups().map(([h, rows], i) => sec(h, rows.map(asRow), i)).join('')}
      ${sec('Someone else’s list', [rowBtn('data-tlwho aria-haspopup="dialog"', 'scan-eye', 'See a teammate’s list', 'Their Today, to read, when you cover for them')], 'who')}
      ${leads.length ? sec(leadHead(leads), [...leads.map(k => placeRow(k)),
        // F165: the admins' Prep board, a view on All issues (issues.js, prep.js)
        admin ? row(['Prep board', BOARD_HREF, 'clipboard-check', 'Every issue’s 2027 prep, to review and approve']) : null], 'lead') : ''}
      ${sec('Other versions', versions(admin), 'ver')}
      <section class="v6-more-sec" aria-labelledby="mo-you"><h2 class="v6-more-h mo-you" id="mo-you">${avatar(S.me, 28)}<span>You · ${esc(youName())}</span></h2>${placeList(acct().map((it, i) => `<button type="button" class="v6-more-row" data-acct="${i}"><span class="v6-more-ic">${icon(it.icon)}</span><span class="v6-more-tx"><span class="v6-more-nm">${esc(it.label)}</span>${(stale && it.plainSub) || it.sub ? `<span class="v6-more-ln">${esc((stale && it.plainSub) || it.sub)}</span>` : ''}</span>${it.nav ? icon('chevron-right', { cls: 'chev' }) : ''}</button>`))}</section>
      ${foot || sync ? `<div class="v6-more-foot">${foot ? `<p>${esc(foot)}</p>` : ''}${sync ? `<p class="v6-more-sync">${icon('refresh-cw')}<span>${esc(sync)}</span></p>` : ''}</div>` : ''}
    </div>`;
  },
  wire(route, root) {
    const items = acct(); root.querySelectorAll('[data-acct]').forEach(el => { el.onclick = () => items[+el.dataset.acct]?.run(); });
    // A teammate's Today, read-only (spec 3.5): everyone may look; the Team page around it is for leads (team.js reads ?who=).
    // No owner lists the bills nobody holds (F74, F76), as Team's own picker does.
    root.querySelector('[data-tlwho]')?.addEventListener('click', () => menuSheet({ title: 'See a teammate’s list', items: [...teammates().map(a => ({
      label: a.full_name, icon: 'user-round', sub: a.is_admin ? 'Admin' : a.can_approve ? 'Approver' : a.is_reviewer ? 'Second approver' : '',
      run: () => S.go(`#/team?who=${encodeURIComponent(a.id)}`) })), { label: 'No owner', icon: 'user-round', sub: 'Bills with no owner', run: () => S.go('#/team?who=none') }] }));
  },
};
