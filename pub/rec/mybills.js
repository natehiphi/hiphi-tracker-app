// My issues under ?rec=1 (R-303, Nate's "make best choices" 10/17; backend docs/requests/R-303-assessment/mine-profile-alerts.md
// section 1). A person comes here to see everything they follow and to tidy it (B-1). Today's page repeated Home in a heavier
// form: 210px cards under a topic heading each, a filled "Following" on every row (16 for Leilani, 4,146px on her phone), counts,
// and status words of its own that disagreed with Home's. Here every followed issue and every bill followed on its own is
// Home's quiet row, in Home's words and order (pub/calm/home.js myRows, so the two pages never disagree), with no topic headings,
// blurbs, chips, counts or buttons; then "Your lists" when there are any; then two quiet links. "Edit" at the top right is the
// tidying: each row gets "Stop following" (Undo in the toast, as today), and a topic followed whole says so, with "Stop
// following all".
import { S, DEMO, app, esc, icon, unfollowIssue, setFollows, catOf, sessionInfo, issuesLink, followsAnything, loadCatalog, recomputeWatch, timeWord } from '../core.js';
import { btn, chip, skeleton, loadFail } from '../ui.js';
import { recRow, recEmpty, wireKit, BOX } from './kit.js';
import { myRows, keep, when } from '../calm/home.js';
import { followToggle, weekHearings, downloadWeekIcs, weekStart } from '../actions.js';
import { logAct } from '../visitlog.js';
import { nameOf, letGo } from '../mybills.js';
import { ownLists, followedLists, localFollowed, myListsSection, wireMyLists, canMake } from '../mylists.js';
import { EMPTY_ART } from '../art.js';
import { rowLine } from '../partners.js';
import { rowDrafts, draftLink } from '../newdraft.js';

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
// small dot before it when something changed since the last visit, one status line, amber only inside a day (A-5). A bill
// followed on its own that a HIPHI partner writes on has one more line naming the partner, as on Find (R-328 batch D,
// partners.js rowLine: "Keiki Smiles Alliance supports it too", or "From a partner: ..." where HIPHI has no side).
// A bill on the row with a new draft (R-212 #50, pub/newdraft.js) adds one quiet line under all that, in session and not
// while editing: its own link, beside the row's in the same <li> (never inside it), to that bill's drafts ("New draft of HB
// 2121 · Fri"), or to the issue's page when two or more changed, where each is marked. The row itself is Home's, unchanged;
// its status is passed along so a row that already says "Passed a committee with changes" is not given a second day.
function rowHtml(r, edit) {
  const t = edit ? targetOf(r) : null, pl = r.b ? rowLine(r.b) : '', nd = edit ? '' : draftLink(rowDrafts(r), { own: !!r.b, issue: r.i, stat: r.text });
  const a = `<a class="rc-row" href="${esc(r.href)}"><span class="rc-rtext"><span class="rc-rname">${r.fresh ? '<span class="rc-new" title="New since your last visit"><span class="sr">New since your last visit: </span></span>' : ''}${esc(r.name)}</span>
    ${r.text ? `<span class="rc-rstat${r.warn ? ' warn' : ''}">${esc(keep(r.text))}</span>` : ''}${pl ? `<span class="rc-rpart">${esc(pl)}</span>` : ''}</span>${t ? '' : icon('chevron-right', { cls: 'rc-chev' })}</a>`;
  return `<li${t ? ' class="rc-frow"' : ''}>${a}${nd}${t ? btn('Stop following', { kind: 'text', sm: true, cls: 'rc-stop', attrs: { 'data-rc-stop': `${t.kind}:${t.id}`, 'aria-label': `Stop following ${t.label}` } }) : ''}</li>`;
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

// Your lists, with a quiet "New list" beside the heading (today's page's, mylists.js myListsSection: [data-ulnew] opens the
// same sheet, or the sign-in page for someone who cannot make one yet). With no lists, one quiet line that lists exist and how
// a list is made; nobody is asked for anything (C-1), so a signed-out person, who could not make one, gets no line.
function listsPart(lists) {
  const make = label => btn(label, { kind: 'text', sm: true, icon: 'plus', cls: 'rc-ulnew', attrs: { 'data-ulnew': '1' } });
  if (lists.length) return `<section class="rc-sec" aria-labelledby="ul-mine-h"><div class="rc-shead"><h2 class="rc-h2" id="ul-mine-h">Your lists</h2>${canMake() ? make('New list') : ''}</div>
    <ul class="rc-rows ${BOX}" role="list">${lists.map(recRow).join('')}</ul></section>`;
  return canMake() ? `<div class="rc-ulhint"><p>${icon('list-checks')}<span>Keep bills together in a list, and share it by a link if you like. Open a bill and choose <b>Add to a list</b>.</span></p>${make('New list')}</div>` : '';
}

// "Add this week’s hearings to my calendar" (R-212 Tier 2 #51; actions.js weekHearings, downloadWeekIcs): one quiet line
// between the header and the rows, in session, not while editing, and only when a hearing on a bill they follow (or one they
// plan to go to), or its testimony deadline, falls inside the next seven days. Here and not on Home, which has a budget
// (A-23: a new thing goes elsewhere, My issues among them). A text button (A-3: no new filled button), with no count in
// it (Nate, on Home's greeting: "If it's a lot it can be overwhelming"). Pressed, it saves one calendar file and says what it
// did (A-16): the done chip the bill page's "Add to calendar" turns into (bill.js), and what the file held, "3 hearings,
// Wed to Fri", in Home's words for a day (calm/home.js when, without the time: "today", "tomorrow", "Wed", "Mar 23"). The
// chip stays for the visit, as the bill page's does; it is offered again the next day (a new week: S.chips is keyed by the
// week's first day) or when a hearing joins the week that the file did not hold (a bill followed since). One that has
// started since is no reason.
const dayOf = iso => when(iso).slice(0, -(timeWord(iso).length + 1));
const idsOf = list => list.map(x => x.h.id);
const weekKey = () => `week|${weekStart()}ics`;
export function weekWords(list) {
  const a = dayOf(list[0].h.scheduled_at), z = dayOf(list[list.length - 1].h.scheduled_at);
  return `${list.length} ${list.length === 1 ? 'hearing' : 'hearings'}, ${a === z ? a : `${a} to ${z}`}`;
}
function weekLine() {
  const list = weekHearings(); if (!list.length) return '';
  const done = S.chips[weekKey()];
  if (done && list.every(x => done.ids.includes(x.h.id))) return `<p class="rc-wkcal" role="status" tabindex="-1" data-rc-wkdone>${chip('Calendar file ready', 'ok', 'check')}<span class="rc-wkwhat">${esc(keep(done.text))}</span></p>`;
  return `<p class="rc-wkcal">${btn('Add this week’s hearings to my calendar', { kind: 'text', sm: true, icon: 'calendar-plus', cls: 'rc-wkbtn', attrs: { 'data-rc-wkcal': '1' } })}</p>`;
}

function render() {
  if (!document.querySelector('.rc-mine')) S.rcEdit = false;   // arriving afresh: not editing
  const si = sessionInfo(), off = si.phase !== 'in', rows = myRows(), lists = listRows();
  const edit = !!S.rcEdit && rows.length > 0;
  // "Send to a friend" (R-212 #37): all of them at once, where a person looks for "my issues" (the critic, 10/22); not while editing.
  const send = rows.length && !edit && issuesLink() ? `<button type="button" class="btn text rc-edit rc-send" data-rc-mine aria-label="Send my issues to a friend">${icon('share-2')}<span>Send<span class="rc-sendx"> to a friend</span></span></button>` : '';
  const head = `<header class="rc-head rc-mhead"><h1 class="rc-h1">My issues</h1>${send}${rows.length ? `<button type="button" class="btn text rc-edit" data-rc-edit aria-label="${edit ? 'Done editing' : 'Edit what you follow'}">${edit ? 'Done' : 'Edit'}</button>` : ''}</header>`;
  const links = `<div class="rc-links">${btn(off ? `What you did in ${si.recapYear}` : 'What you’ve done this session', { kind: 'text', iconEnd: 'chevron-right', href: '#/recap' })}
    ${btn('Follow more issues', { kind: 'text', iconEnd: 'chevron-right', href: '#/find' })}</div>`;
  // Something is followed on this device but the issues could not be loaded this visit (kernel.js S.catalogErr: the copy
  // kept from the last visit is in use, and lacks them): said, with Try again, never "You're not following any issues yet"
  // (R-212 #49).
  if (!rows.length && !lists.length && (S.catalogErr || S.rcCatBusy) && followsAnything()) return `<div class="rc rc-mine" data-mbroot>${head}${S.rcCatBusy ? skeleton(3) : loadFail({ what: 'your issues', h: 'h2', align: 'start', note: 'What you follow is still saved.', retry: { 'data-rc-recat': '1' } })}</div>`;
  // Nothing followed: the lanai drawing, the line, the buttons (A-13; R-311, Nate 10/20), as the old page's empty box.
  if (!rows.length && !lists.length) return `<div class="rc rc-mine" data-mbroot>${head}<div class="art rc-eart">${EMPTY_ART}</div>${recEmpty('You’re not following any issues yet. Follow one and it shows up here, with where it stands and what you can do.',
    `<div class="rc-ebtns">${btn('Pick what you care about', { kind: 'primary', icon: 'list-checks', href: '#/start/1' })}${btn('Browse issues', { kind: 'text', href: '#/find' })}</div>`)}</div>`;
  // A topic followed whole brings new issues too; in Edit it says so once, with its own Stop (in session its issues are rows;
  // between sessions Home's rows already name the topic, and its row has the Stop).
  const wholes = edit && !off ? (S.cats || []).filter(c => S.catFollows.has(c.key)) : [];
  const whole = wholes.map(c => `<p class="rc-whole"><span>Following all of ${esc(c.name)}, and new ones</span>${btn('Stop following all', { kind: 'text', sm: true, attrs: { 'data-rc-stopcat': c.key, 'aria-label': `Stop following all of ${c.name}` } })}</p>`).join('');
  return `<div class="rc rc-mine${edit ? ' editing' : ''}" data-mbroot>${head}
    ${!edit && !off ? weekLine() : ''}
    ${whole ? `<div class="rc-wholes">${whole}</div>` : ''}
    ${rows.length ? `<ul class="rc-rows rc-mrows ${BOX}" role="list" aria-label="What you follow">${rows.map(r => rowHtml(r, edit)).join('')}</ul>` : `<p class="rc-note rc-none">You’re not following any issues yet.</p>`}
    ${listsPart(lists)}
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
    wireKit(root); wireMyLists(root);
    root.querySelector('[data-rc-recat]')?.addEventListener('click', () => { S.rcCatBusy = true; app.render();
      loadCatalog().then(() => recomputeWatch()).catch(e => console.error(e)).finally(() => { S.rcCatBusy = false; app.render(); }); });
    root.querySelector('[data-rc-mine]')?.addEventListener('click', async () => { (await import('../askfriend.js')).askFriend({ mine: true }); });
    // The week's calendar file (R-212 #51). Counted as the plans' calendar step is (onb-p4.js logAct('calendar')): the kind
    // only, with no bill and no new kind, so the database takes it as it is (078, 114, 124). The focus goes to the done line.
    root.querySelector('[data-rc-wkcal]')?.addEventListener('click', () => {
      const list = weekHearings(); if (!list.length) return;
      try { downloadWeekIcs(list); } catch (e) { console.error(e); return; }
      S.chips[weekKey()] = { ids: idsOf(list), text: weekWords(list) };
      logAct('calendar'); S.rcFocus = '[data-rc-wkdone]'; app.render();
    });
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
