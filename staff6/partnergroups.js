// Partners (#/partners; R-328 batch B, Nate's decisions of 22 Oct 2026; backend migration 184). The admitter comes here
// to let an advocacy group write on the public tracker, and to look after it: add the group, add its people, copy each
// person's sign-in link to send from their own email (until the tracker can email, R-334), approve a group someone else
// added, pause or resume one, copy its link, and handle requests to join (B-1). The database's Slack messages link here.
//
//   - A list and the item picked from it (A-24): requests to join, then the groups that write (waiting for approval
//     first), then the link-only partners (Make a link's, firstvisit.js). On a laptop the picked one is open beside the
//     list; on a phone it is its own page (#/partners/<slug>, #/partners/request/<id>), with Back to the list.
//   - Whoever added a group cannot approve it (the database checks it too), so a group waiting says who can.
//   - Every write is one of 184's functions; a refusal is shown in its own plain words (B-8). Pause, Resume, Remove a person
//     and Decline have Undo (B-5); Approve a group cannot be taken back, so Pause is the way back and the toast says so.
//   - v6 (R-336 F186, spec 6 "Partners", rule 3): no step lives only in a "…" menu. Invite a group and Make a link only are
//     tonal buttons in the page head; Edit details and Pause are text buttons on the open group; a person's sign-in link is
//     the one button on their row, and Take someone off is under the list. Who approves partners is the Partner approver
//     role on each person's record in People (V28: all of a person's roles in one place); the head says who it is.
//   - Rows are a name and one line (spec 7.2): the state is a word in the line, not a chip.
//   - Any staff member may look (the tables are readable by all staff); only an admin or a partner approver sees the
//     buttons, and the page says so.
//   - Partner asks (R-328 batch G, backend 185): an ask Nate or Jess approved goes out in the 4:30 pm email, and it is
//     listed first, under "Going out at 4:30 pm" (or "Held while email is paused"), as HIPHI's own sent emails are on
//     Emails, with Take it back (Undo sends it again at the next 4:30 pm; nobody gets it twice, B-5). Taken back and ended
//     asks wait in a fold. Only a partner approver sees the buttons (the database refuses anyone else).
import { S, DB, esc, hooks, fmtDate, partnerSlug } from './data.js';
import { icon, btn, toast, openSheet, closeSheet, pickerSheet, notice, skeleton, friendly, field } from './ui.js';
import { itemRow, placeHead } from './steps.js';
import { whenAt, billById, billNum, billSay, billRoute } from './model.js';
import { admitsPartners, approvesPartners, firstName, otherApprovers, orList, wantQueue, queueChanged, wantAsks, emailWord } from './partnerq.js';
import { dailyWord, paused } from './composer.js';

const PUB = 'https://natehiphi.github.io/hiphi-tracker-app/track.html';
const linkOf = slug => `${PUB}?via=${encodeURIComponent(slug)}`;
const inviteOf = (name, site) => `${PUB}#/groups?${new URLSearchParams({ name: name || '', ...(site ? { site } : {}) }).toString()}`;
const dayWord = d => d ? fmtDate(d, { weekday: 'short' }).replace(',', '') : '';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const ORDER = { waiting: 0, active: 1, paused: 2, link: 3 };
const wide = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return false; } };
const redraw = () => { if (S.route?.name === 'pgroups') hooks.render(); };
// Back above a page's title from 768px, as People's and the bill page's (B-4; partners.css .pe-back): it says what the
// frame's Back says, the page this one was opened from, else its parent.
const backLink = b => { let from = ''; try { from = history.state?.d > 0 ? history.state?.from || '' : ''; } catch { from = ''; }
  return `<a class="pe-back" href="${esc(b.href)}" data-back>${icon('chevron-left')}<span>${esc(from || b.label)}</span></a>`; };

// ---- loading: the groups once a visit (again after a change, or Refresh), the queue for requests ----
function want({ force = false } = {}) {
  if (S.pgLoading || (!force && S.pg)) return;
  S.pgLoading = true; S.pgErr = '';
  DB.loadPartnerGroups().catch(e => { console.warn('partners:', e?.message || e); S.pgErr = friendly(e); }).finally(() => { S.pgLoading = false; redraw(); });
}
const reload = () => { queueChanged(); wantQueue({ force: true }); want({ force: true }); wantAsks({ force: true }); };   // a paused group's asks end (R-328 G)
const groups = () => (S.pg?.groups || []).slice().sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || a.name.localeCompare(b.name));
const peopleOf = slug => (S.pg?.people || []).filter(p => p.partner_slug === slug && !p.removed_at).sort((a, b) => (a.role === 'lead' ? 0 : 1) - (b.role === 'lead' ? 0 : 1) || String(a.invited_at).localeCompare(String(b.invited_at)));
const requests = () => (S.pq?.requests || []).slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
// Who can turn a waiting group on: an approver who did not add it.
const approversFor = g => S.advocates.filter(a => approvesPartners(a) && a.id !== g.added_by).map(a => a.full_name.split(' ')[0]);
// partnerq.js orList says "a second approver" for nobody, which is testimony's role (C-15); here nobody is "a partner approver".
const pOr = names => names.length ? orList(names) : 'a partner approver who did not add it';
const canApprove = g => g.status === 'waiting' && approvesPartners() && g.added_by !== S.me?.id;

// ---- the list ----
function countsLine(g) {
  const c = S.pg?.counts?.[g.slug] || {}, v = S.pg?.visits?.[g.slug];
  return [c.live ? `${plural(c.live, 'bill')} live` : '', c.waiting ? `${c.waiting} waiting to be approved` : '', c.changes ? `${plural(c.changes, 'change')} asked` : '',
    v ? `${v} first visit${v === 1 ? '' : 's'} by its link in 12 weeks${S.pg?.sample ? ' (sample)' : ''}` : ''].filter(Boolean);
}
function groupSub(g) {
  if (g.status === 'waiting') return `Waits for ${pOr(approversFor(g))} to approve`;
  if (g.status === 'paused') return 'Its words are off the tracker';
  if (g.status === 'link') return `Arrival link only: ?via=${g.slug}`;
  const c = S.pg?.counts?.[g.slug] || {}, n = peopleOf(g.slug).length;
  return [plural(n, 'person', 'people'), c.live ? `${c.live} bill${c.live === 1 ? '' : 's'} live` : 'no bills live yet', c.waiting ? `${c.waiting} waiting` : ''].filter(Boolean).join(' · ');
}
// v6 rows (spec 5, 7.2): the name, then one line that starts with the state's word ("Active · 2 people · 3 bills live").
// Active is the usual state and goes unsaid (status by exception, spec 7.7).
// A group waiting on the person reading says so in the second person (C-15: "Yours to approve"); a link-only row says what
// the link does, not its code (spec 7.12), under a heading that already says "Link only" (A-14).
function waitLine(g) {
  const others = approversFor(g).filter(n => n !== firstName(S.me?.id));
  const added = g.added_by ? ` · ${g.added_by === S.me?.id ? 'you added it' : `added by ${firstName(g.added_by)}`} ${whenAt(g.created_at)}` : '';   // who and when, as its panel says
  return (canApprove(g) ? (others.length ? `Yours or ${orList(others)}’s to approve` : 'Yours to approve') : `Waits for ${pOr(approversFor(g))} to approve it`) + added;
}
const rowLine = g => g.status === 'active' ? groupSub(g) : g.status === 'waiting' ? waitLine(g)
  : g.status === 'paused' ? 'Paused · its words are off the tracker' : ['Counts arrivals, does not write', ...countsLine(g).filter(x => /first visit/.test(x))].join(' · ');
const rowA = (key, href, on, title, line) => itemRow({ key, name: title, line: esc(line), href, selected: on });
const rowList = (label, rows) => `<div class="v6-list" role="list" aria-label="${esc(label)}">${rows.join('')}</div>`;
// ---- partner asks going out (R-328 G) ----
const ASK_ON = ['going_out', 'sending'], ASK_OFF = ['taken_back', 'ended'];
const hstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const askBill = a => billById(a.bill_id) || { bill_number: a.bill_number, session_year: a.session_year };
const askOf = id => (S.pAsks || []).find(a => String(a.id) === String(id));
// Where an ask stands, then how it goes and until when. While email is paused nothing goes, so the line says who approved
// it instead of a time (the heading says it is held, A-14).
function askLine(a) {
  const by = a.approved_by ? ` by ${a.approved_by.split(' ')[0]}` : '';
  const when = a.state === 'taken_back' ? `Taken back ${whenAt(a.taken_back_at)}`
    : a.state === 'ended' ? (String(a.ask_until) < hstToday() ? `Ended ${dayWord(a.ask_until)}` : 'Ended: its words are off the tracker')
    : paused() && !a.sent ? `Approved${by} ${whenAt(a.approved_at)}`
    : a.state === 'going_out' ? `Goes out ${dailyWord(a.scheduled_for)} at 4:30 pm`
    : `Going out since ${dayWord(a.scheduled_for)}${a.sent ? `: ${plural(a.sent, 'person', 'people')} so far` : ''}`;
  // "Email only" is the usual case and goes unsaid (spec 7.2: a row is at most four facts); a text as well is said.
  return [when, a.also_text ? 'also by text once texts are on' : '', a.state === 'ended' ? '' : `until ${dayWord(a.ask_until)}`.replace(/ /g, '\u00a0')].filter(Boolean).join(' · ');   // "until Wed 3/25" never splits
}
function askRow(a) {
  const b = askBill(a), can = approvesPartners();
  const act = !can ? '' : ASK_ON.includes(a.state) ? btn('Take it back', { kind: 'secondary', sm: true, icon: 'undo-2', attrs: { 'data-pgtake': a.id } })
    : a.state === 'taken_back' && String(a.ask_until) >= hstToday() ? btn('Send again', { kind: 'text', sm: true, icon: 'send', attrs: { 'data-pgresend': a.id } }) : '';
  return `<div class="pg-ask" role="listitem"><span class="pg-ab"><span class="pg-at"><b>${esc(a.partner_name)}</b> on <a href="${esc(billRoute(b))}">${esc(billSay(b))}</a></span>
    <span class="pg-aq">${esc(a.ask)}</span><span class="pg-rs">${esc(askLine(a))}</span></span>${act ? `<span class="pg-aa">${act}</span>` : ''}</div>`;
}
function asksHTML() {
  if (S.pAsksErr) return `<section class="pg-sec"><p class="pg-none pg-askerr">${icon('circle-alert')}<span>The partner asks did not load.</span>${btn('Try again', { kind: 'text', sm: true, attrs: { 'data-pgaskretry': '1' } })}</p></section>`;
  const all = S.pAsks || [], on = all.filter(a => ASK_ON.includes(a.state)), off = all.filter(a => ASK_OFF.includes(a.state));
  if (!on.length && !off.length) return '';
  return `<section class="pg-sec" aria-labelledby="${on.length ? 'pg-h-ask' : 'pg-h-askoff'}">
    ${on.length ? `<h2 class="pg-h2" id="pg-h-ask">${paused() ? 'Held while email is paused' : 'Going out at 4:30 pm'}<span class="n">${on.length}</span></h2>${rowList('Partner asks', on.map(askRow))}` : ''}
    ${off.length ? `<details class="pg-fold"${S.pgAskFold ? ' open' : ''}><summary id="pg-h-askoff">${icon('chevron-down', { cls: 'chev' })}<span>Asks taken back or ended</span><span class="n">${off.length}</span></summary>${rowList('Asks taken back or ended', off.map(askRow))}</details>` : ''}</section>`;
}

function listHTML(sel) {
  const rq = requests(), gs = groups(), writing = gs.filter(g => g.status !== 'link'), links = gs.filter(g => g.status === 'link');
  const sec = (id, title, n, rows, more = '') => rows.length || more ? `<section class="pg-sec" aria-labelledby="pg-h-${id}"><h2 class="pg-h2" id="pg-h-${id}">${title}${n ? `<span class="n">${n}</span>` : ''}</h2>${rows.length ? rowList(title, rows) : ''}${more}</section>` : '';
  const gHref = g => `#/partners/${encodeURIComponent(g.slug)}`;
  return asksHTML() + sec('rq', 'Asking to join', rq.length, rq.map(r => rowA('r:' + r.id, `#/partners/request/${r.id}`, sel === 'r:' + r.id, r.group_name, `From ${r.contact_name} · ${whenAt(r.created_at)}`)))
    + sec('gr', 'Groups that write', writing.length, writing.map(g => rowA('g:' + g.slug, gHref(g), sel === 'g:' + g.slug, g.name, rowLine(g))),
      writing.length ? '' : `<p class="pg-none">${admitsPartners() ? 'No groups yet. Add the first one, then its people.' : 'No groups yet.'}</p>`)
    + sec('ln', 'Link only', links.length, links.map(g => rowA('g:' + g.slug, gHref(g), sel === 'g:' + g.slug, g.name, rowLine(g))));
}

// ---- one group ----
function peopleHTML(g) {
  const ps = peopleOf(g.slug), can = admitsPartners() && g.status !== 'link';
  // One button a person (D16): their sign-in link. Taking someone off is under the list (rare, and never only in a menu).
  const row = p => `<li class="pg-person"><span class="pg-pt"><b>${esc(p.name || p.email)}</b>${p.role === 'lead' ? '<span class="pg-lead">· leads the group</span>' : ''}</span>
      <span class="pg-ps">${esc(p.email)} · ${p.joined_at ? `Signed in ${esc(dayWord(p.joined_at))}` : 'Not signed in yet'}</span>
      ${can ? `<span class="pg-pa">${btn('Sign-in link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-pglink': p.id, 'aria-label': `Copy ${p.name || p.email}’s sign-in link` } })}</span>` : ''}</li>`;
  return `<section class="pg-dsec" aria-labelledby="pg-ph"><h3 class="pg-h3" id="pg-ph">People${ps.length ? `<span class="n">${ps.length}</span>` : ''}</h3>
    ${ps.length ? `<ul class="pg-people">${ps.map(row).join('')}</ul>` : `<p class="pg-p">${can ? 'No one yet. The first person you add leads the group: they can invite their teammates.' : 'No one yet.'}</p>`}
    ${can ? `<p class="pg-addp">${btn('Add a person', { kind: 'text', icon: 'user-plus', attrs: { 'data-pgaddp': g.slug, 'aria-haspopup': 'dialog' } })}${ps.length ? btn('Take someone off', { kind: 'text', icon: 'x', attrs: { 'data-pgrmpick': g.slug, 'aria-haspopup': 'dialog' } }) : ''}</p>` : ''}</section>`;
}
function groupHTML(g) {
  const adm = admitsPartners(), cl = countsLine(g);
  // Every step on the group in sight (rule 3): Edit details, and Pause for a group that writes; Resume is on a paused one's notice.
  const acts = adm ? `<p class="pg-gacts">${btn('Edit details', { kind: 'text', icon: 'pencil', attrs: { 'data-pgedit': g.slug, 'aria-haspopup': 'dialog' } })}${g.status === 'active' ? btn('Pause the group', { kind: 'text', icon: 'eye-off', attrs: { 'data-pgset': 'pause', 'data-slug': g.slug } }) : ''}</p>` : '';
  let state = '';
  if (g.status === 'waiting') {
    const by = g.added_by ? firstName(g.added_by) : '', who = approversFor(g);
    state = canApprove(g)
      ? `<div class="pg-state"><p>${esc(`Added by ${by || 'a teammate'} ${whenAt(g.created_at)}. Approve it to let its people sign in and write; every word they write still comes to you${otherApprovers().length ? ' or ' + pOr(otherApprovers()) : ''} first.`)}</p>${btn('Approve the group', { icon: 'check', attrs: { 'data-pgok': g.slug } })}</div>`
      : `<p class="pg-state pg-quiet">${icon('hourglass')}<span>${esc(`${g.added_by === S.me?.id ? 'You added it' : `Added by ${by || 'a teammate'}`} ${whenAt(g.created_at)}. It waits for ${pOr(who)} to approve: whoever adds a group cannot approve it.`)}</span></p>`;
  } else if (g.status === 'paused') state = `<div class="pg-state">${notice('warn', 'eye-off', `<b>Paused ${esc(dayWord(g.paused_at))}.</b> Its words are off the tracker until it is resumed.`, adm ? btn('Resume', { kind: 'secondary', icon: 'play', attrs: { 'data-pgset': 'resume', 'data-slug': g.slug } }) : '')}</div>`;
  else if (g.status === 'active') state = `<p class="pg-state pg-quiet">${icon('circle-check')}<span>${esc(`Approved${g.approved_by ? ` by ${firstName(g.approved_by)}` : ''} ${dayWord(g.approved_at)}. Its people can sign in and write; you or ${pOr(otherApprovers())} approve every word.`)}</span></p>`;
  else state = `<div class="pg-state"><p>Its link counts arrivals and shows its welcome line. It does not write on the tracker.</p>${adm ? btn('Let it write on the tracker', { kind: 'secondary', icon: 'square-pen', attrs: { 'data-pgwrite': g.slug } }) : ''}</div>`;
  const about = [g.about ? esc(g.about) : '', g.website ? `<a href="${esc(g.website)}" target="_blank" rel="noopener">${esc(g.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}${icon('external-link')}</a>` : ''].filter(Boolean).join(' · ');
  return `<article class="pg-detail" aria-labelledby="pg-dh">
    <div class="pg-dtop"><h2 class="pg-dname" id="pg-dh">${esc(g.name)}</h2></div>
    ${about ? `<p class="pg-about">${about}</p>` : ''}
    ${state}
    <section class="pg-dsec" aria-labelledby="pg-lh"><h3 class="pg-h3" id="pg-lh">Its link</h3>
      <div class="pg-link"><code>${esc(linkOf(g.slug))}</code>${btn('Copy link', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-pgcopy': linkOf(g.slug) } })}</div>
      <p class="pg-p">${g.status === 'active' ? 'Opens the tracker with its bills first.' : 'Opens the tracker.'}${g.welcome ? ` People who arrive by it see its welcome line: “${esc(g.welcome)}”` : ''}</p>
      ${cl.length ? `<p class="pg-counts">${esc(cl.join(' · '))}</p>` : ''}</section>
    ${g.status === 'link' ? '' : peopleHTML(g)}${acts}</article>`;
}
function requestHTML(r) {
  const adm = admitsPartners();
  return `<article class="pg-detail" aria-labelledby="pg-dh">
    <div class="pg-dtop"><h2 class="pg-dname" id="pg-dh">${esc(r.group_name)}</h2></div>
    <p class="pg-about">${esc(`${wide() ? 'Sent' : 'Asks to join: sent'} ${whenAt(r.created_at)} by ${r.contact_name}`)} · <a href="mailto:${esc(r.contact_email)}">${esc(r.contact_email)}</a></p>
    <dl class="pg-dl">${r.about ? `<dt>About the group</dt><dd>${esc(r.about)}</dd>` : ''}${r.website ? `<dt>Website</dt><dd><a href="${esc(r.website)}" target="_blank" rel="noopener">${esc(r.website)}${icon('external-link')}</a></dd>` : ''}
      ${r.note ? `<dt>Their note</dt><dd>${esc(r.note)}</dd>` : ''}<dt>Not a campaign</dt><dd>They said the group is not a candidate, a campaign or a party.</dd></dl>
    ${adm ? `<div class="pg-acts">${btn('Add as a group', { icon: 'plus', attrs: { 'data-pgfromrq': r.id, 'aria-haspopup': 'dialog' } })}${btn('Decline', { kind: 'text', attrs: { 'data-pgdecline': r.id } })}</div>
      <p class="pg-p">Talk with them first if you need to: their email is above. Adding them makes a group that waits for ${esc(pOr(otherApprovers()))} to approve.</p>` : ''}</article>`;
}

// ---- the page ----
const titleOf = route => (route.req && requests().find(x => x.id === route.req)?.group_name) || (route.id && (S.pg?.groups || []).find(x => x.slug === route.id)?.name) || 'Partners';
function selected(route) {
  if (route.req) { const r = requests().find(x => x.id === route.req); return r ? { k: 'r:' + r.id, html: requestHTML(r) } : null; }
  if (route.id) { const g = (S.pg?.groups || []).find(x => x.slug === route.id); return g ? { k: 'g:' + g.slug, html: groupHTML(g) } : null; }
  return null;
}
function render(route) {
  want(); wantQueue(); wantAsks();
  const adm = admitsPartners();
  // F186: Invite a group and Make a link only in sight beside Add a group. Who approves partners is said once, from the
  // Partner approver role on each person's record (A-14: the names were typed into one sentence and worked out in the next,
  // and disagreed once the role moved), and changed in People. "you" for the reader (C-15).
  const ap = S.advocates.filter(a => approvesPartners(a)), names = [...ap.filter(a => a.id === S.me?.id).map(() => 'you'), ...ap.filter(a => a.id !== S.me?.id).map(a => a.full_name.split(' ')[0])];
  const goLive = pOr(otherApprovers());
  const lede = !adm ? 'Advocacy groups that write on the public tracker. Only an admin or a partner approver adds and changes them.'
    : `Advocacy groups that write on the public tracker. A group you add goes live when ${goLive} approves it, and every word its people write comes to ${names.length ? orList(names) : 'a partner approver'} first.`;
  const sub = `${esc(lede)}${S.me?.is_admin ? ` <span class="v6-nw"><a href="#/people">Change who in People</a>.</span>` : ''}`;
  const head = (quiet = false) => placeHead('Partners', { sub, actions: adm ? `${btn('Add a group', { kind: quiet ? 'secondary' : 'primary', icon: 'plus', attrs: { 'data-pgadd': '1', 'aria-haspopup': 'dialog' } })}${btn('Invite a group', { kind: 'secondary', icon: 'mail-plus', attrs: { 'data-pginvite': '1', 'aria-haspopup': 'dialog' } })}${btn('Make a link only', { kind: 'secondary', icon: 'qr-code', href: '#/my-issues/all?view=links' })}` : '' });
  if (!S.pg) return `<div class="pg-page">${head()}${S.pgErr ? notice('bad', 'circle-alert', 'The partner groups did not load. Check your connection and try again.', btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-pgretry': '1' } })) : skeleton(3)}</div>`;
  const qerr = S.pqErr ? notice('warn', 'circle-alert', 'The requests to join did not load.', btn('Try again', { kind: 'text', sm: true, attrs: { 'data-pgretry': '1' } })) : '';
  // A laptop opens the first one (a request, else a group waiting, else the first group) so the panel is never empty; a
  // phone shows the list, and the picked one as its own page.
  let sel = selected(route);
  if (!sel && !route.id && !route.req && wide()) { const r0 = requests()[0], g0 = groups()[0]; sel = r0 ? selected({ req: r0.id }) : g0 ? selected({ id: g0.slug }) : null; }
  const gone = (route.id || route.req) && !sel ? notice('info', 'info', route.req ? 'That request has been handled.' : 'That group is not on the list.', btn('See all partners', { kind: 'text', sm: true, href: '#/partners' })) : '';
  // Its own page names the group in its h1, under Back (the card's own name shows only on a phone, where the h1 is the top bar).
  if (!wide() && sel && (route.id || route.req)) return `<div class="pg-page pg-one">${backLink({ href: '#/partners', label: 'Partners' })}<h1 class="v6-ptitle sv-h1 pg-oneh">${esc(titleOf(route))}</h1>${sel.html}</div>`;
  const list = `<div class="pg-list">${listHTML(sel?.k)}</div>`;
  // One filled button in view (A-3): the open item's Approve or Add as a group, else Add a group.
  const quiet = !!sel && wide() && /data-pgok|data-pgfromrq/.test(sel.html);
  return `<div class="pg-page">${head(quiet)}${qerr}${gone}${sel && wide() ? `<div class="pg-cols">${list}<div class="pg-side">${sel.html}</div></div>` : list}</div>`;
}

// ---- actions ----
async function busy(el, fn) { if (el?.getAttribute('aria-busy')) return; el?.setAttribute('aria-busy', 'true'); try { await fn(); } catch (e) { toast(e, { err: true }); } finally { if (el?.isConnected) el.removeAttribute('aria-busy'); } }
// Copy on the tap (that is what lets the browser write the clipboard); if it refuses, show the text to copy by hand.
function copyText(text, okMsg, what = 'link') {
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg, { ok: true }), () => showCopy(text, what)); } catch { showCopy(text, what); }
}
const showCopy = (text, what) => openSheet({ title: `Copy the ${what}`, size: 'auto', body: `<p class="small">Select it all and copy it.</p><textarea class="pg-copybox" readonly rows="3" aria-label="The ${esc(what)}">${esc(text)}</textarea>`,
  wire: d => { const t = d.querySelector('textarea'); t.focus(); t.select(); } });
const errBox = (d, m) => { d.querySelector('[data-err]').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}<span>${esc(m)}</span></p>` : ''; };
const okSite = u => !u || /^https?:\/\/\S+\.\S+$/.test(u);

// Add a group (from nothing, or from a request: its details filled in, its contact offered as the lead), or edit one.
function groupForm({ g = null, rq = null } = {}) {
  const v = g || (rq ? { name: rq.group_name, website: rq.website, about: rq.about } : {});
  const slugNow = () => g ? g.slug : partnerSlug(document.getElementById('pg-name')?.value || v.name || '');
  const body = `${field('pg-name', 'Group name', `<input id="pg-name" type="text" maxlength="80" autocomplete="organization" value="${esc(v.name || '')}" ${g ? '' : 'autofocus'}>`)}
    <p class="pg-slug" id="pg-slug" aria-live="polite"></p>
    ${field('pg-site', 'Website <span class="opt">(optional)</span>', `<input id="pg-site" type="url" inputmode="url" maxlength="200" placeholder="https://" value="${esc(v.website || '')}">`)}
    ${field('pg-about', 'One line about it <span class="opt">(optional)</span>', `<input id="pg-about" type="text" maxlength="200" value="${esc(v.about || '')}">`, 'The public sees it with the group’s name.')}
    ${field('pg-wel', 'Welcome line <span class="opt">(optional)</span>', `<input id="pg-wel" type="text" maxlength="160" value="${esc(v.welcome || '')}">`, 'What people who arrive by its link see first.')}
    ${rq ? `<label class="pg-check"><input type="checkbox" id="pg-lead" checked><span>${esc(`Add ${rq.contact_name} (${rq.contact_email}) as its lead`)}</span></label>` : ''}
    <div data-err role="alert"></div>`;
  openSheet({ title: g ? `Edit ${esc(g.name)}` : rq ? `Add ${esc(rq.group_name)}` : 'Add a group', size: 'auto', body,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn(g ? 'Save changes' : 'Add the group', { icon: g ? 'check' : 'plus', attrs: { 'data-go': '1' } })}`,
    wire: d => {
      const $ = id => d.querySelector('#' + id), go = d.querySelector('[data-go]');
      const showSlug = () => { const s = slugNow(), was = (S.pg?.groups || []).find(x => x.slug === s && (!g || x.slug !== g.slug));
        $('pg-slug').innerHTML = s ? `Its link: <code>…/track.html?via=${esc(s)}</code>${g ? ' (it cannot change: links already given out would stop counting)' : was ? (was.status === 'link' ? `. ${esc(was.name)} already has this link as a link-only partner: adding turns it into a group that writes.` : `. <b>${esc(was.name)} already uses this link.</b> Pick another name, or open that group.`) : ''}` : ''; };
      showSlug(); $('pg-name').addEventListener('input', showSlug);
      d.querySelector('[data-no]').onclick = () => closeSheet();
      go.onclick = () => busy(go, async () => {
        errBox(d, '');
        const name = $('pg-name').value.trim(), site = $('pg-site').value.trim(), about = $('pg-about').value.trim(), welcome = $('pg-wel').value.trim(), slug = slugNow();
        if (name.length < 2) { errBox(d, 'Give the group its name.'); $('pg-name').focus(); return; }
        if (!slug) { errBox(d, 'The name needs a letter or a number for its link.'); $('pg-name').focus(); return; }
        if (!okSite(site)) { errBox(d, 'A website starts with https:// (or leave it empty).'); $('pg-site').focus(); return; }
        const was = !g && (S.pg?.groups || []).find(x => x.slug === slug);
        if (was && was.status !== 'link') { errBox(d, `${was.name} already uses this link. Pick another name.`); $('pg-name').focus(); return; }
        let out;
        try { out = await DB.partnerGroupSave({ slug: g ? g.slug : was ? was.slug : null, name, website: site, about, welcome, write: !g }); }
        catch (e) { errBox(d, friendly(e)); return; }
        let lead = '';
        if (rq) {
          try { await DB.partnerRequestHandle(rq.id, 'added', out.slug); } catch (e) { toast(`${out.name} is added, but the request still shows: ${friendly(e)}`, { err: true }); }
          if ($('pg-lead')?.checked) { try { await DB.partnerPersonSave({ slug: out.slug, email: rq.contact_email, name: rq.contact_name }); lead = rq.contact_name; } catch (e) { toast(`${out.name} is added, but not ${rq.contact_name}: ${friendly(e)}`, { err: true }); } }
        }
        await closeSheet({ silent: true }); reload();
        if (g) { toast(`Saved ${out.name}.`, { ok: true }); return; }
        S.go(`#/partners/${encodeURIComponent(out.slug)}`, { replace: !!rq });
        const who = pOr(otherApprovers());
        toast(`Added ${out.name}${lead ? ` with ${lead} as its lead` : ''}. It goes live when ${who} approves it.`, { ok: true, ...(lead ? {} : { action: { label: 'Add its lead', run: () => personForm(out.slug) } }) });
      });
    } });
}
function personForm(slug) {
  const g = (S.pg?.groups || []).find(x => x.slug === slug) || { slug, name: 'the group' }, lead = peopleOf(slug).some(p => p.role === 'lead');
  openSheet({ title: `Add a person to ${esc(g.name)}`, size: 'auto',
    body: `${field('pp-name', 'Name', '<input id="pp-name" type="text" maxlength="80" autocomplete="off" autofocus>')}
      ${field('pp-email', 'Email', '<input id="pp-email" type="email" inputmode="email" maxlength="200" autocomplete="off">', lead ? 'They join as a teammate. They sign in on the public tracker with this email.' : 'The first person leads the group: they can invite their teammates. They sign in on the public tracker with this email.')}
      <div data-err role="alert"></div>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-no': '1' } })}${btn('Add the person', { icon: 'user-plus', attrs: { 'data-go': '1' } })}`,
    wire: d => {
      const go = d.querySelector('[data-go]'), nm = d.querySelector('#pp-name'), em = d.querySelector('#pp-email');
      d.querySelector('[data-no]').onclick = () => closeSheet();
      [nm, em].forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } }));
      go.onclick = () => busy(go, async () => {
        errBox(d, ''); const name = nm.value.trim(), email = em.value.trim().toLowerCase();
        if (!name) { errBox(d, 'Give their name, as the group knows them.'); nm.focus(); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errBox(d, 'That email does not look right. Check it and try again.'); em.focus(); return; }
        let p; try { p = await DB.partnerPersonSave({ slug, email, name }); } catch (e) { errBox(d, friendly(e)); return; }
        await closeSheet({ silent: true }); reload();
        toast(`Added ${name}${p?.role === 'lead' ? ' as the group’s lead' : ''}. Copy their sign-in link and send it from your email.`, { ok: true, action: { label: 'Copy sign-in link', run: () => signInLink(p) } });
      });
    } });
}
async function removePerson(p) {
  const g = (S.pg?.groups || []).find(x => x.slug === p.partner_slug);
  try { await DB.partnerPersonRemove(p.id); } catch (e) { toast(e, { err: true }); return; }
  reload();
  toast(`${p.name || p.email} is off ${g?.name || 'the group'} and can no longer sign in to write for it.`, { undo: async () => { await DB.partnerPersonSave({ slug: p.partner_slug, email: p.email, name: p.name, role: p.role }); reload(); toast('Undone. They are back on the group.'); } });
}
// The sign-in link: made by the team-admin function, copied and sent by the admitter from their own email (no email
// leaves the tracker). Until Nate deploys that function, a plain line says what to do instead.
async function signInLink(p, el = null) {
  if (!p) return;
  const g = (S.pg?.groups || []).find(x => x.slug === p.partner_slug), first = (p.name || '').split(' ')[0] || 'there';
  let r;
  el?.setAttribute('aria-busy', 'true');
  try { r = await DB.partnerLink(p.id); }
  catch (e) {
    el?.removeAttribute('aria-busy');
    if (e.practice) { toast(e.message); return; }
    if (e.setup) { openSheet({ title: `Sign-in link for ${esc(p.name || p.email)}`, size: 'auto', body: notice('info', 'info', esc(e.message)) + `<p class="pg-p">Their email: <b>${esc(p.email)}</b></p>`,
      foot: btn('Copy their email', { kind: 'secondary', icon: 'copy', attrs: { 'data-cp': '1' } }), wire: d => { d.querySelector('[data-cp]').onclick = () => copyText(p.email, 'Email copied.', 'email'); } }); return; }
    toast(e, { err: true }); return;
  }
  el?.removeAttribute('aria-busy');
  const link = r.continue_link || r.link;
  const msg = `Aloha ${first},\n\nHere is your link to write on the HIPHI Bill Tracker for ${g?.name || 'your group'}:\n${link}\n\nOpen it${r.continue_link ? ' and press Continue' : ''}, and you are signed in. The first time, you agree to the partner terms. The link works once and only for about an hour, so open it when you have a few minutes. If it runs out, ask me for a new one.\n\n${S.me ? S.me.full_name.split(' ')[0] : ''}`.trim();
  const mail = `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent('Your sign-in for the HIPHI Bill Tracker')}&body=${encodeURIComponent(msg)}`;
  openSheet({ title: `Sign-in link for ${esc(first)}`, size: 'auto',
    body: `<p class="pg-p">${r.created ? `${esc(first)} now has a sign-in. ` : ''}Email ${esc(first)} this message yourself, not by Slack: a Slack link preview can open the link and use it up. It works once and only for about an hour.</p>
      ${field('pg-msg', 'The message', `<textarea id="pg-msg" rows="9" readonly>${esc(msg)}</textarea>`)}
      ${notice('info', 'shield-check', `Anyone who opens this link is signed in as ${esc(first)}, so send it only to them.`)}`,
    foot: `${btn('Copy link', { kind: 'text', icon: 'link', attrs: { 'data-cp': 'link' } })}${btn('Copy message', { kind: 'secondary', icon: 'copy', attrs: { 'data-cp': 'msg' } })}${btn('Email it', { icon: 'mail', href: mail })}`,
    wire: d => d.querySelectorAll('[data-cp]').forEach(x => x.onclick = () => copyText(x.dataset.cp === 'link' ? link : msg, x.dataset.cp === 'link' ? 'Link copied. Send it by email.' : 'Message copied. Paste it into an email.', x.dataset.cp === 'link' ? 'link' : 'message')) });
}
async function setGroup(slug, act, el) {
  const g = (S.pg?.groups || []).find(x => x.slug === slug); if (!g) return;
  await busy(el, async () => {
    await DB.partnerGroupSet(slug, act); reload();
    if (act === 'approve') toast(`${g.name} is approved. Its people can sign in and write; every word still comes to you first. To take it back, pause it.`, { ok: true });
    else if (act === 'pause') toast(`${g.name} is paused: its words are off the tracker.`, { undo: async () => { await DB.partnerGroupSet(slug, 'resume'); reload(); toast('Undone. Its words are back on the tracker.'); } });
    else toast(`${g.name} is back: its approved words show on the tracker again.`, { ok: true, undo: async () => { await DB.partnerGroupSet(slug, 'pause'); reload(); toast('Undone. It is paused again.'); } });
  });
}
async function letWrite(slug, el) {
  const g = (S.pg?.groups || []).find(x => x.slug === slug); if (!g) return;
  await busy(el, async () => { await DB.partnerGroupSave({ slug, name: g.name, website: g.website, about: g.about, welcome: g.welcome, write: true }); reload();
    toast(`${g.name} can write once ${pOr(otherApprovers())} approves it. Add its people now.`, { ok: true }); });
}
async function decline(id, el) {
  const r = requests().find(x => x.id === id); if (!r) return;
  await busy(el, async () => { await DB.partnerRequestHandle(id, 'declined'); reload(); S.go('#/partners', { replace: true });
    toast(`Declined ${r.group_name}. The tracker does not tell them: if you want to, email ${r.contact_name}.`, { undo: async () => { await DB.partnerRequestHandle(id, 'new'); reload(); toast('Undone. The request is back.'); } }); });
}
// Take it back, or Send again (a taken-back ask, at the next 4:30 pm): each with Undo (B-5), as HIPHI's own Send and
// Take it back on an email. Who already got an ask never gets it twice.
const asksReload = () => wantAsks({ force: true });   // the list stays drawn until the new one comes
async function askStep(id, act, el) {
  const a = askOf(id); if (!a) return;
  const who = `${a.partner_name}’s ask on ${billNum(askBill(a))}`;
  await busy(el, async () => {
    const r = await DB.partnerAskStep({ id: a.id, do: act }); asksReload();
    if (act === 'take_back') toast(`Taken back: ${who} will not go out${a.sent ? ' to anyone else' : ''}.`, { undo: async () => {
      const r2 = await DB.partnerAskStep({ id: a.id, do: 'send' }); asksReload(); toast(`Undone. It goes out in ${emailWord(r2?.scheduled_for)}.`); } });
    else toast(`${who} goes out in ${emailWord(r?.scheduled_for)}. Nobody who already got it gets it twice.`, { ok: true, undo: async () => {
      await DB.partnerAskStep({ id: a.id, do: 'take_back' }); asksReload(); toast('Undone. It stays taken back.'); } });
  });
}
function inviteSheet() {
  openSheet({ title: 'Invite a group', size: 'auto',
    body: `<p class="pg-p">A link to send a group you would like to have on the tracker. It opens the request form with their name and website filled in; their request then shows here.</p>
      ${field('iv-name', 'Group name', '<input id="iv-name" type="text" maxlength="80" autocomplete="off" autofocus>')}
      ${field('iv-site', 'Website <span class="opt">(optional)</span>', '<input id="iv-site" type="url" inputmode="url" maxlength="200" placeholder="https://">')}
      <p class="pg-slug" id="iv-out" aria-live="polite"></p>
      ${notice('info', 'info', 'Until the For advocacy groups page is on the tracker, this link opens the tracker’s home page.')}<div data-err role="alert"></div>`,
    foot: btn('Copy invite link', { icon: 'copy', attrs: { 'data-go': '1' } }),
    wire: d => {
      const nm = d.querySelector('#iv-name'), st = d.querySelector('#iv-site'), out = d.querySelector('#iv-out');
      const url = () => inviteOf(nm.value.trim(), st.value.trim());
      const show = () => { out.innerHTML = nm.value.trim() ? `<code>${esc(url())}</code>` : ''; };
      nm.addEventListener('input', show); st.addEventListener('input', show);
      d.querySelector('[data-go]').onclick = () => { errBox(d, '');
        if (nm.value.trim().length < 2) { errBox(d, 'Give the group’s name first.'); nm.focus(); return; }
        if (!okSite(st.value.trim())) { errBox(d, 'A website starts with https:// (or leave it empty).'); st.focus(); return; }
        copyText(url(), 'Invite link copied. Send it from your email.'); };
    } });
}
// Take someone off the group (rare): pick who, then it happens at once with Undo (B-5), as v5's x did.
function removePick(slug) {
  const g = (S.pg?.groups || []).find(x => x.slug === slug), ps = peopleOf(slug); if (!g || !ps.length) return;
  pickerSheet({ title: `Take someone off ${esc(g.name)}`, value: '', help: 'They can no longer sign in to write for it. Undo puts them back.',
    options: ps.map(p => [p.id, p.name || p.email, null, p.email]), onPick: id => { const p = ps.find(x => x.id === id); if (p) removePerson(p); } });
}
function wire(route, root) {
  const main = root.querySelector('.pg-page'); if (!main) return;
  const on = (sel, fn) => main.querySelectorAll(sel).forEach(el => el.onclick = e => fn(el, e));
  on('[data-pgretry]', () => { S.pgErr = ''; reload(); redraw(); });
  on('[data-pgadd]', () => groupForm());
  on('[data-pginvite]', () => inviteSheet());
  on('[data-pgedit]', el => { const g = (S.pg?.groups || []).find(x => x.slug === el.dataset.pgedit); if (g) groupForm({ g }); });
  on('[data-pgrmpick]', el => removePick(el.dataset.pgrmpick));
  on('[data-pgok]', el => setGroup(el.dataset.pgok, 'approve', el));
  on('[data-pgset]', el => setGroup(el.dataset.slug, el.dataset.pgset, el));
  on('[data-pgwrite]', el => letWrite(el.dataset.pgwrite, el));
  on('[data-pgaddp]', el => personForm(el.dataset.pgaddp));
  on('[data-pglink]', el => signInLink((S.pg?.people || []).find(p => p.id === el.dataset.pglink), el));
  on('[data-pgrm]', el => { const p = (S.pg?.people || []).find(x => x.id === el.dataset.pgrm); if (p) removePerson(p); });
  on('[data-pgcopy]', el => copyText(el.dataset.pgcopy, 'Link copied. Paste it into an email, a post or a newsletter.'));
  on('[data-pgfromrq]', el => { const r = requests().find(x => x.id === el.dataset.pgfromrq); if (r) groupForm({ rq: r }); });
  on('[data-pgdecline]', el => decline(el.dataset.pgdecline, el));
  on('[data-pgtake]', el => askStep(el.dataset.pgtake, 'take_back', el));
  on('[data-pgresend]', el => askStep(el.dataset.pgresend, 'send', el));
  on('[data-pgaskretry]', () => { asksReload(); redraw(); });
  // The fold of taken-back and ended asks stays as it was left when the page redraws (B-6).
  main.querySelectorAll('.pg-fold').forEach(d => d.addEventListener('toggle', () => { S.pgAskFold = d.open; }));
}
// Redraw at the laptop width line: the list with its panel, or the list alone.
let wasWide = null;
addEventListener('resize', () => { const w = wide(); if (wasWide !== null && w !== wasWide && S.route?.name === 'pgroups') hooks.render(); wasWide = w; });

export default {
  tab: '',
  // A group or a request open on its own (a phone) is named in the header, under Back to Partners.
  title: route => titleOf(route),
  back: route => route.id || route.req ? { href: '#/partners', label: 'Partners' } : null,
  render, wire,
};
