// My issues (#/my-issues, R-263, Nate 10/12): staff own issues and work bills. "Should there instead be an issues tab with
// bills falling within the different issues? And staff instead 'own' issues, rather than bills?" His answers: its own
// place in the main menu, for everyone on staff, and helpers get the bills too. So this is each person's issues (the ones
// they own or help on, from the 2027 prep's owners and helpers, 091), soonest work first, each with where it stands and
// every bill on it in one line (the same line as the issue's own page, R-226). The bills on these issues are also in Bills >
// Mine, Today and the inbox (data.js isMine; backend migration 172), so nobody hands them over bill by bill.
// All issues stays the catalogue (rename, merge, put bills on issues); the 2027 prep list is prep.js ?view=mine.
// v3 (R-264): the first of three tabs, My issues · All issues · Coalitions (ui.js sectionNav), three ways to group bills,
// laid out by the laptop rules: one line per issue (its name, the soonest thing that needs someone, how many bills move)
// and one line per bill under it. Not a list and a pane: an issue's own page already shows its week one click away, and
// a second column would halve the room these lines need for no new fact.
// v5 (R-272, Nate 10/13: "I shouldn't have to scroll alphabetically ... Rethink this"): 34 tall cards became one line per
// issue, sorted by deadline (This week, Next deadlines, Safe for now), with a By topic switch and a search box as extras;
// each line says whether the issue is at risk of dying, safe with a bill dying, or safe (issuestand.js, shared with All
// issues). The bills under each issue are on its own page, one click away, as v3 already chose for All issues.
import { S, SESSION_OVER, esc, myIssueIds } from './data.js';
import { icon, btn, empty, sectionNav, row, switchRow } from './ui.js';
import { plural, isSide, pageHead } from './lists.js';
import { indexLinks, isDraft } from './prep.js';
import { supports, setSupport, coalFactsLine } from './coalition.js';
import { iconName } from './setup.js';
import { standOf, bodyHTML, toolsHTML, wireTools } from './issuestand.js';

// Each of my issues, as issuestand.js judges it (R-272), with whether it is yours or one you help on.
function myIssues() {
  const ids = myIssueIds();
  return (S.issues || []).filter(i => ids.has(String(i.id)) && !i.archived_at).map(i => ({ ...standOf(i), own: i.owner_id === S.me?.id }));
}
const Q = () => S.miSearch ??= { q: '' };
const opts = () => ({ q: Q().q, from: 'mine', tagsOf: x => [x.own ? '' : 'You help', isDraft(x.i) ? 'Draft' : ''].filter(Boolean) });

// v4 (R-269 P7): for someone who owns and helps on no issue (Patti, Julie, Saya, Kris, Jess), My issues said "No issues are
// yours yet" and their coalition was three clicks away (My issues › Coalitions › HEAL). In its place, their coalitions:
// the ones they support (or own) as links to each page, where the week's testimony and deadlines are (Patti: HEAL in one
// click), then the others, each with the coalition page's "I support" switch. No sentence about how issues are given out
// (P-4): the page is the way in.
const coalOrder = (a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99) || a.name.localeCompare(b.name);
const ownsCoal = c => !!S.me && c.owner_id === S.me.id;
function coalitionsHTML() {
  const all = (S.campaigns || []).slice().sort(coalOrder), mine = all.filter(c => supports(c) || ownsCoal(c)), rest = all.filter(c => !mine.includes(c));
  const lead = c => `<span class="lead">${icon(iconName(c.icon))}</span>`;
  return `${mine.length ? `<section class="mi-coal" aria-labelledby="mi-co-h"><h2 class="mi-coh" id="mi-co-h">${mine.length === 1 ? 'Your coalition' : 'Your coalitions'}</h2>
      <div class="rows">${mine.map(c => row({ leadHtml: lead(c), title: esc(c.name), sub: esc(coalFactsLine(c)), href: `#/coalition/${encodeURIComponent(c.id)}`, cls: 'mi-corow' })).join('')}</div></section>` : ''}
    ${rest.length ? `<section class="mi-coal" aria-labelledby="mi-cr-h"><h2 class="mi-coh" id="mi-cr-h">${mine.length ? 'Other coalitions' : 'Coalitions'}</h2>
      <div class="card mi-cosw">${rest.map(c => switchRow(`mi-sup-${c.id}`, `I help on ${esc(c.name)}`, false, esc(coalFactsLine(c)), { 'data-misup': c.id })).join('')}</div></section>` : ''}`;
}

export default {
  tab: 'myissues',
  title: () => 'My issues',
  render() {
    const list = myIssues();
    const owned = list.filter(x => x.own).length, helped = list.length - owned;
    const who = [owned ? `You own ${plural(owned, 'issue')}` : '', helped ? `${owned ? 'help' : 'You help'} on ${helped}` : ''].filter(Boolean).join(' and ');
    if (!list.length && (S.campaigns || []).length) return `<div class="le-page le-list is-page mi-page">${pageHead(sectionNav('issues', 'mine'), 'My issues', 'No issue is yours yet.', '')}
      ${coalitionsHTML()}</div>`;
    if (!list.length) return `<div class="le-page le-list is-page mi-page">${pageHead(sectionNav('issues', 'mine'), 'My issues', '', '')}
      <div class="le-empty">${empty({ title: 'No issues are yours yet', text: 'When an admin makes you the owner of an issue, or the owner adds you as a helper, it shows here with all its bills. Those bills are then in your Mine and on Today too.', action: btn('See all issues', { kind: 'secondary', href: '#/outreach/issues' }) })}</div></div>`;
    // R-272: one line per issue, sorted by deadline (or by topic, the switch), each with its mark; search is an extra.
    return `<div class="le-page le-list is-page mi-page ist-page${isSide() ? ' le-side' : ''}">
      ${pageHead(sectionNav('issues', 'mine'), 'My issues', SESSION_OVER && indexLinks({ mineOnly: true }) ? '' : `${who}.`, '')}
      ${SESSION_OVER ? indexLinks({ mineOnly: true }) : ''}
      ${toolsHTML(Q().q, 'mi-q')}
      <div id="mi-q-body">${bodyHTML(list, opts())}</div>
    </div>`;
  },
  // The switches act as the coalition page's does (saved to your settings, with Undo); once on, the coalition moves up to
  // yours, and focus follows it there.
  wire(route, app) {
    wireTools(app, 'mi-q', { get: () => Q().q, set: v => { Q().q = v; }, paint: () => { const b = app.querySelector('#mi-q-body'); if (b) b.innerHTML = bodyHTML(myIssues(), opts()); } });
    app.querySelectorAll('[data-misup]').forEach(el => el.onchange = () => {
      const c = (S.campaigns || []).find(x => String(x.id) === el.dataset.misup); if (!c) return;
      const id = CSS.escape(String(c.id));
      setSupport(c, el.checked, `.mi-corow[href="#/coalition/${id}"], [data-misup="${id}"]`);
    });
  },
};
