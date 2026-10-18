// My issues under ?rec=1 (R-303, Nate's "make best choices" 10/17; backend docs/requests/R-303-assessment/mine-profile-alerts.md
// section 1). A person comes here to see everything they follow and to tidy it (B-1). Today's page repeated Home in a heavier
// form: 210px cards under a topic heading each, a filled "Following" on every row (16 for Leilani, 4,146px on her phone), counts,
// and status words of its own that disagreed with Home's. Here every followed issue and every bill followed on its own is
// Home's quiet row, in Home's words and order (pub/calm/home.js myRows, so the two pages never disagree), with no topic headings,
// blurbs, chips, counts or buttons; then "Your lists" when there are any; then two quiet links. "Edit" at the top right is the
// tidying: each row gets "Stop following" (Undo in the toast, as today), and a topic followed whole says so, with "Stop
// following all".
import { S, DEMO, app, esc, icon, unfollowIssue, setFollows, catOf, sessionInfo } from '../core.js';
import { btn } from '../ui.js';
import { recSec, recRow, recEmpty, wireKit } from './kit.js';
import { myRows, keep } from '../calm/home.js';
import { followToggle } from '../actions.js';
import { nameOf, letGo } from '../mybills.js';
import { ownLists, followedLists, localFollowed, myListsSection } from '../mylists.js';

// What a row lets go of in Edit: the issue, the bill followed on its own, or (between sessions, when Home's rows name it) a
// whole topic.
function targetOf(r) {
  if (r.b) return { kind: 'bill', id: r.b.id, label: nameOf(r.b) };
  if (r.i) return { kind: 'issue', id: r.i.id, label: r.i.name };
  let m = /^#\/issue\/(.+)$/.exec(r.href || '');
  if (m) { const i = S.issueBySlug?.get(m[1]); if (i) return { kind: 'issue', id: i.id, label: i.name }; }
  m = /^#\/find\/category\/(.+)$/.exec(r.href || '');
  if (m && S.catFollows.has(m[1])) { const c = catOf(m[1]); if (c) return { kind: 'cat', id: c.key, label: c.name }; }
  return null;
}
// Home's row (calm/home.js rowHtml, in the shared rc- classes so it is styled on this page from its first draw): the name, a
// small dot before it when something changed since the last visit, one status line, amber only inside a day (A-5).
function rowHtml(r, edit) {
  const t = edit ? targetOf(r) : null;
  const a = `<a class="rc-row" href="${esc(r.href)}"><span class="rc-rtext"><span class="rc-rname">${r.fresh ? '<span class="rc-new" title="New since your last visit"><span class="sr">New since your last visit: </span></span>' : ''}${esc(r.name)}</span>
    ${r.text ? `<span class="rc-rstat${r.warn ? ' warn' : ''}">${esc(keep(r.text))}</span>` : ''}</span>${t ? '' : icon('chevron-right', { cls: 'rc-chev' })}</a>`;
  return `<li${t ? ' class="rc-frow"' : ''}>${a}${t ? btn('Stop following', { kind: 'text', sm: true, cls: 'rc-stop', attrs: { 'data-rc-stop': `${t.kind}:${t.id}`, 'aria-label': `Stop following ${t.label}` } }) : ''}</li>`;
}
// The person's own lists, the lists shared with them and HIPHI's lists they follow, as quiet rows. myListsSection is called
// for what it starts (loading their lists, and the shared ones this browser follows, then redrawing this page); its own
// drawing is today's page's.
function listRows() {
  myListsSection();
  const own = ownLists().map(l => ({ name: l.title, text: l.share_token ? 'Your list · shared by link' : 'Your list · private', href: `#/mylist/${encodeURIComponent(l.id)}`, lead: 'list-checks' }));
  const theirs = followedLists().map(l => ({ name: l.title, text: 'Shared with you', href: `#/mylist/${encodeURIComponent(l.id)}`, lead: 'user' }));
  const local = (!S.user && !DEMO ? [...localFollowed()] : []).map(t => [t, S.ul?.shared?.[t]]).filter(([, x]) => x && typeof x === 'object')
    .map(([t, l]) => ({ name: l.title, text: 'Shared with you', href: `#/l/${t}`, lead: 'user' }));
  const hiphi = (S.lists || []).filter(l => S.listFollows.has(l.id)).map(l => ({ name: l.title, text: 'From HIPHI', href: `#/list/${encodeURIComponent(l.slug)}`, lead: 'list' }));
  return [...own, ...theirs, ...local, ...hiphi];
}

function render() {
  if (!document.querySelector('.rc-mine')) S.rcEdit = false;   // arriving afresh: not editing
  const si = sessionInfo(), off = si.phase !== 'in', rows = myRows(), lists = listRows();
  const edit = !!S.rcEdit && rows.length > 0;
  const head = `<header class="rc-head rc-mhead"><h1 class="rc-h1">My issues</h1>${rows.length ? `<button type="button" class="btn text rc-edit" data-rc-edit aria-label="${edit ? 'Done editing' : 'Edit what you follow'}">${edit ? 'Done' : 'Edit'}</button>` : ''}</header>`;
  const links = `<div class="rc-links">${btn(off ? `What you did in ${si.recapYear}` : 'What you’ve done this session', { kind: 'text', iconEnd: 'chevron-right', href: '#/recap' })}
    ${btn('Follow more issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/find' })}</div>`;
  if (!rows.length && !lists.length) return `<div class="rc rc-mine" data-mbroot>${head}${recEmpty('You’re not following any issues yet. Follow one and it shows up here, with where it stands and what you can do.',
    `<div class="rc-ebtns">${btn('Pick what you care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}${btn('Browse issues', { kind: 'text', href: '#/find' })}</div>`)}</div>`;
  // A topic followed whole brings new issues too; in Edit it says so once, with its own Stop (in session its issues are rows;
  // between sessions Home's rows already name the topic, and its row has the Stop).
  const wholes = edit && !off ? (S.cats || []).filter(c => S.catFollows.has(c.key)) : [];
  const whole = wholes.map(c => `<p class="rc-whole"><span>Following all of ${esc(c.name)}, and new ones</span>${btn('Stop following all', { kind: 'text', sm: true, attrs: { 'data-rc-stopcat': c.key, 'aria-label': `Stop following all of ${c.name}` } })}</p>`).join('');
  return `<div class="rc rc-mine${edit ? ' editing' : ''}" data-mbroot>${head}
    ${whole ? `<div class="rc-wholes">${whole}</div>` : ''}
    ${rows.length ? `<ul class="rc-rows rc-mrows" role="list" aria-label="What you follow">${rows.map(r => rowHtml(r, edit)).join('')}</ul>` : `<p class="rc-note rc-none">You’re not following any issues yet.</p>`}
    ${lists.length ? recSec('ul-mine-h', 'Your lists', `<ul class="rc-rows" role="list">${lists.map(recRow).join('')}</ul>`) : ''}
    ${links}</div>`;
}

// Letting go, with Undo (B-5): the same words and the same Undo as today's page (mybills.js letGo puts back exactly what was
// followed before).
async function stop(kind, id) {
  if (kind === 'issue') {
    const i = S.issueById.get(id); if (!i) return;
    const whole = (i.categories || [i.category]).filter(c => S.catFollows.has(c)).map(c => catOf(c)?.name).filter(Boolean);
    return letGo(() => unfollowIssue(i), whole.length ? `You no longer follow ${i.name}. You still follow the rest of ${whole.join(' and ')}, but not new issues in it.` : `You no longer follow ${i.name}.`);
  }
  if (kind === 'cat') { const c = catOf(id); if (c) return letGo(() => setFollows({ catsOff: [c.key] }), `You no longer follow all of ${c.name}.`); return; }
  if (kind === 'bill') { const r = myRows().find(x => x.b?.id === id); await followToggle(id, r ? nameOf(r.b) : ''); app.render(); }
}

export default {
  tab: 'bills',
  title: () => 'My issues',
  render,
  wire() {
    const root = document.querySelector('.rc-mine'); if (!root) return;
    wireKit(root);
    const ed = root.querySelector('[data-rc-edit]');
    if (ed) ed.onclick = () => { S.rcEdit = !S.rcEdit; S.rcFocus = '[data-rc-edit]'; app.render(); };
    // After a row goes, the focus moves to the next row's Stop (or the one before, or Done), never to the top of the page.
    root.querySelectorAll('[data-rc-stop]').forEach((el, n) => el.onclick = () => { const [kind, ...id] = el.dataset.rcStop.split(':'); S.rcFocus = { n }; stop(kind, id.join(':')); });
    root.querySelectorAll('[data-rc-stopcat]').forEach(el => el.onclick = () => { S.rcFocus = '[data-rc-edit]'; stop('cat', el.dataset.rcStopcat); });
    const f = S.rcFocus; S.rcFocus = null;
    if (f) { const stops = [...root.querySelectorAll('[data-rc-stop]')];
      (typeof f === 'string' ? root.querySelector(f) : stops[f.n] || stops[f.n - 1] || ed || document.getElementById('main'))?.focus({ preventScroll: true }); }
  },
};
