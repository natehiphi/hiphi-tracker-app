// Staff v6 (R-336 V27, V28, spec section 6 "People"; admins): People (#/people, #/people/<id>, #/people/<id>?view=leaving).
// Everyone who uses the staff app, each with one record that holds all their roles together (Admin, Approver, Second
// approver, Partner approver), their sign-in and whether Slack reaches them. v5 kept this in Session setup's Team part,
// with the roles in two places (Team's sheet and Partners' "…" menu) and turning someone off in a sheet that left their
// coalition and to-dos behind (X24: 13 clicks, 2 scrolls, 4 screens). Here:
//   - The list and the picked record side by side from 1100px (V17, listDetail); below that the record is its own page.
//   - "Leaving or away?" opens one page with everything the person holds (live bills, as Bills counts them; coalitions;
//     issues; to-dos on others' bills; testimony they sent; hearings they are going to), a suggested cover for each part
//     (the coalition's other people, else Nate) and one "Hand over and turn off" with Undo, which tells each new owner in
//     a bill's messages. Turn off plus hand-over: 4 clicks from anywhere, on one screen (spec 8).
//   - Away until (W30) needs a migration (D13), so the page says it comes later and hands over without a date.
//   - Every change here saves the moment it is made, with Undo (B-5); typed details save from their sheet.
// The data calls are v5's (data.js team*, setOwner, saveCampaign, updateIssue, updateTodo, attend, sendMessage,
// partnerSetApprover): nothing new is asked of the database.
import { S, DB, esc, fmtDate, advocate, APP_URL, hooks } from './data.js';
import { diedish, billRoute, whenAt } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, switchRow, field, notice, empty, avatar, pickerSheet, friendly } from './ui.js';
import { itemRow, listDetail, placeHead, nameWords, numWords } from './steps.js';
import { queueChanged, wantQueue } from './partnerq.js';
import { bl, save as saveBills } from './filters.js';

// ---- the visit's state: who has signed in, who Slack reaches, the covers picked, a hand-over just done ----
const P = () => S.v6people ??= { logins: null, loginsBusy: false, loginsErr: '', reach: null, reachBusy: false, reachErr: '', teamEmail: null, slackBusy: false, offOpen: false, cover: {}, done: {}, busy: '' };
const redraw = () => { if (S.route?.name === 'people') hooks.render(); };
function loadLogins(force) {
  const s = P(); if (s.loginsBusy || (s.logins && !force)) return;
  s.loginsBusy = true; s.loginsErr = '';
  DB.teamLogins().then(r => { s.logins = Object.fromEntries((r || []).map(x => [x.advocate_id, x])); })
    .catch(e => { s.loginsErr = e.message || 'Could not check.'; }).finally(() => { s.loginsBusy = false; redraw(); });
}
function loadReach(force) {
  const s = P(); if (s.reachBusy || (s.reach && !force)) return;
  s.reachBusy = true; s.reachErr = '';
  Promise.all([DB.teamReach(), DB.teamEmail().catch(() => null)])
    .then(([r, te]) => { s.reach = Object.fromEntries((r || []).map(x => [x.advocate_id, x])); s.teamEmail = te; })
    .catch(e => { s.reachErr = e.message || 'Could not check.'; }).finally(() => { s.reachBusy = false; redraw(); });
}

// ---- words ----
const firstOf = a => String(a?.full_name || '').split(/\s+/)[0] || 'Someone';
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const cap = s => String(s).replace(/^./, c => c.toUpperCase());
const live = a => !!a && a.is_active !== false;
const isMe = a => !!a && a.id === S.me?.id;
const wide = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return true; } };
// All of a person's roles in one place (V28): "Admin and partner approver".
const roleList = a => [a.is_admin ? 'Admin' : '', a.can_approve ? 'Approver' : '', a.is_reviewer ? 'Second approver' : '', a.approves_partners ? 'Partner approver' : ''].filter(Boolean);
const rolesWords = a => { const r = roleList(a); return r.length ? andList(r.map((x, i) => i ? x.toLowerCase() : x)) : ''; };
function signWords(a) {
  const s = P(), l = s.logins?.[a.id];
  if (!s.logins) return s.loginsErr ? 'Sign-in not checked' : 'Checking sign-in…';
  if (l?.last_sign_in_at) return `Signed in ${fmtDate(l.last_sign_in_at)}`;
  if (l?.has_login && l.link_made_at) return 'Link made, not signed in yet';
  return 'Not signed in yet';
}
const reachOk = x => x && (x.reach === 'slack' || x.reach === 'email');
const reachWords = x => !x ? '' : x.reach === 'slack' ? 'Slack reaches them' : x.reach === 'email' ? 'They get the tracker’s messages by email'
  : x.reach === 'unknown' ? 'Not looked up in Slack yet' : x.reach === 'off' ? '' : cap(x.why || 'the tracker cannot reach them');

// ---- what a person holds (V27). Live bills are counted as Bills counts them (tracked, not died), so the numbers agree. ----
function holdings(a) {
  const mine = b => (S.assignments[b.id] || []).includes(a.id);
  const all = S.bills.filter(mine), bills = all.filter(b => b.tracked !== false && !diedish(b)), now = Date.now();
  return {
    bills, dead: all.length - bills.length,
    coalitions: (S.campaigns || []).filter(c => c.owner_id === a.id),
    issues: (S.issues || []).filter(i => i.owner_id === a.id && !i.archived_at),
    todos: Object.values(S.todos || {}).flat().filter(t => t.assignee_id === a.id && !t.done),
    // Testimony they sent and nobody has filed: it follows its bill's owner once they are off (model.js filerOf, steps.js writersOf).
    drafts: Object.values(S.drafts || {}).flat().filter(d => d.submitted_by === a.id && ['draft', 'review', 'second_review', 'approved'].includes(d.status)),
    going: (S.hearings || []).filter(h => (S.attend?.[h.id] || []).includes(a.id) && new Date(h.scheduled_at).getTime() > now),
    helpsCoal: (S.campaigns || []).filter(c => Array.isArray(a.prefs?.coalitions) && a.prefs.coalitions.includes(c.id)),
    helpsIssues: (S.issueHelpers || []).filter(h => h.advocate_id === a.id).map(h => (S.issues || []).find(i => i.id === h.issue_id)).filter(i => i && !i.archived_at),
  };
}
function holdsWords(h) {
  return andList([h.bills.length ? plural(h.bills.length, 'live bill') : '', h.coalitions.length ? plural(h.coalitions.length, 'coalition') : '',
    h.issues.length ? plural(h.issues.length, 'issue') : '', h.todos.length ? plural(h.todos.length, 'to-do') : '',
    h.drafts.length ? `${plural(h.drafts.length, 'testimony', 'testimonies')} they sent` : ''].filter(Boolean));
}

// ---- the suggested cover (V27): the coalition's other owner, else Nate. A coalition's other owner is its owner when that is
// someone else, else whoever owns most of its other live bills; a helper (who writes or rallies) is not offered bills. ----
const fallback = a => S.advocates.find(x => x.id !== a.id && live(x) && x.is_admin && x.initials === 'NT')
  || (S.me && S.me.id !== a.id ? S.me : S.advocates.find(x => x.id !== a.id && live(x) && x.is_admin)) || null;
function otherOwner(c, a) {
  const n = new Map();
  for (const b of S.bills) { if (b.tracked === false || !(S.billCampaigns?.[b.id] || []).includes(c.id) || diedish(b)) continue;
    for (const id of S.assignments[b.id] || []) if (id !== a.id && live(advocate(id))) n.set(id, (n.get(id) || 0) + 1); }
  const [id, k] = [...n.entries()].sort((x, y) => y[1] - x[1])[0] || [];
  return id ? [advocate(id), `owns ${plural(k, `other ${c.name} bill`)}`] : null;
}
function coalCover(c, a) {
  const own = advocate(c?.owner_id);
  if (own && own.id !== a.id && live(own)) return [own, `owns ${c.name}`];
  return (c && otherOwner(c, a)) || [fallback(a), c ? `no one else owns ${c.name} bills` : 'no coalition'];
}
const coalOf = b => (S.campaigns || []).find(c => (S.billCampaigns?.[b.id] || []).includes(c.id)) || null;
// The parts of the hand-over, each with its suggested cover and the person picked (one part's own pick, or "everything to
// one person").
function planOf(a) {
  const h = holdings(a), pick = P().cover[a.id] || {}, parts = [];
  const chosen = (key, sug) => advocate(pick[key]) || advocate(pick.all) || sug;
  // Live bills, one part per coalition: its bills go to the coalition's other people. A bill someone else also owns stays with them.
  const byCoal = new Map();
  for (const b of h.bills) { const c = coalOf(b), k = c?.id || 'none'; (byCoal.get(k) || byCoal.set(k, { c, bills: [] }).get(k)).bills.push(b); }
  for (const [k, { c, bills }] of byCoal) { const [sug, why] = coalCover(c, a);
    parts.push({ key: 'b:' + k, kind: 'bills', name: plural(bills.length, 'live bill'), num: c ? c.name : 'no coalition', items: bills, sug, why, to: chosen('b:' + k, sug) }); }
  for (const c of h.coalitions) { const [sug, why] = coalCover(c, a);
    parts.push({ key: 'c:' + c.id, kind: 'coalition', name: c.name, num: 'coalition', items: [c], sug, why, to: chosen('c:' + c.id, sug) }); }
  // Issues, grouped by their suggested cover: an issue's helper, else Nate.
  const byIss = new Map();
  for (const i of h.issues) { const hl = (S.issueHelpers || []).map(x => x.issue_id === i.id && advocate(x.advocate_id)).find(x => x && x.id !== a.id && live(x));
    const sug = hl || fallback(a), k = sug?.id || 'none'; (byIss.get(k) || byIss.set(k, { sug, hl: !!hl, items: [] }).get(k)).items.push(i); }
  for (const [k, g] of byIss) { const one = g.items.length === 1;
    parts.push({ key: 'i:' + k, kind: 'issues', name: one ? g.items[0].name : plural(g.items.length, 'issue'), num: one ? 'issue' : '', items: g.items, sug: g.sug,
      why: g.hl ? `helps on ${one ? 'it' : 'them'}` : `no helper on ${one ? 'it' : 'them'}`, to: chosen('i:' + k, g.sug) }); }
  // To-dos: one on a bill they hand over goes with the bill; one on someone else's bill goes to that bill's owner.
  for (const t of h.todos) { const b = S.bills.find(x => x.id === t.bill_id), own = advocate((S.assignments[t.bill_id] || []).find(id => id !== a.id && live(advocate(id))));
    const withBill = parts.find(p => p.kind === 'bills' && p.items.some(x => x.id === t.bill_id));
    const [sug, why] = own ? [own, 'owns the bill'] : withBill ? [withBill.to, 'with its bill'] : coalCover(b && coalOf(b), a);
    parts.push({ key: 't:' + t.id, kind: 'todo', name: t.title, num: b ? `to-do on ${numWords(b)}` : 'to-do', items: [t], bill: b, sug, why, to: chosen('t:' + t.id, sug) }); }
  return { h, parts };
}
const coverWho = x => !x ? 'no one' : isMe(x) ? 'you' : firstOf(x);

// ---- the list ----
function rowOf(a, sel) {
  const n = holdings(a).bills.length, line = !live(a) ? 'Turned off' : [rolesWords(a), n ? plural(n, 'live bill') : '', signWords(a)].filter(Boolean).join(' · ');
  return itemRow({ key: a.id, name: a.full_name + (isMe(a) ? ' (you)' : ''), line: esc(line), href: `#/people/${encodeURIComponent(a.id)}`, selected: sel === a.id });
}
function reachCard() {
  const s = P();
  if (s.reachErr || !s.reach) return '';   // the database part (backend 154) may not be there: the readiness check names it then
  const act = S.advocates.filter(live), R = s.reach, out = act.filter(a => !reachOk(R[a.id]));
  const missed = act.reduce((n, a) => n + (R[a.id]?.not_reached || 0), 0);
  return `<section class="pe-reach" aria-labelledby="pe-reach-h"><h2 class="pe-h2" id="pe-reach-h">Who the tracker can reach</h2>
    <p class="pe-p">${act.length - out.length} of ${act.length} get the tracker’s messages.${out.length ? ` The other ${out.length === 1 ? 'one’s go' : `${out.length}’s go`} to the next person who can be reached: an owner of the bill’s coalition, then an admin.` : ''}${missed ? ` ${plural(missed, 'message')} did not reach someone in the last 30 days.` : ''}
      Email to the team is ${s.teamEmail ? 'on' : 'off'}: <a href="#/setup/alerts?part=email">change it in Session setup</a>.</p>
    <div class="pe-acts">${btn('Check who Slack can reach', { kind: 'secondary', icon: 'search', attrs: { 'data-pereach': '1', ...(s.slackBusy ? { 'aria-busy': 'true' } : {}) } })}<span class="pe-note">Looks each person up by their email. Nobody is messaged.</span></div>
  </section>`;
}
function listPage(route) {
  const s = P(), sel = route.id || '', a = sel && advocate(sel), act = S.advocates.filter(live), off = S.advocates.filter(x => !live(x));
  const head = placeHead('People', { sub: 'Everyone who uses the staff app: their roles, sign-in and Slack, and handing over their work.',
    actions: btn('Add a person', { icon: 'user-plus', attrs: { 'data-peadd': '1', 'aria-haspopup': 'dialog' } }) });
  const offRows = off.length ? `<details class="pe-off"${s.offOpen || (a && !live(a)) ? ' open' : ''}><summary>${icon('chevron-down', { cls: 'chev' })}<span>${plural(off.length, 'person', 'people')} turned off</span></summary>
    <div class="v6-list" role="list" aria-label="Turned off">${off.map(x => rowOf(x, sel)).join('')}</div></details>` : '';
  const err = s.loginsErr ? notice('warn', 'info', `Could not check who has signed in. ${esc(s.loginsErr)}`) : '';
  const gone = sel && !a ? notice('info', 'info', 'That person is not on the team list.', btn('See everyone', { kind: 'text', href: '#/people' })) : '';
  return `<div class="pe-page">${head}${err}${gone}
    ${listDetail({ id: 'people', label: 'The team', rows: act.map(x => rowOf(x, sel)).join(''), picked: a ? a.id : null, detail: a ? record(a) : '', empty: 'Pick a person to see their record' })}
    ${offRows}${reachCard()}</div>`;
}

// ---- one person's record ----
function roleSwitches(a) {
  const me = isMe(a), dis = a.email ? {} : { disabled: true };
  const others = S.advocates.filter(x => x.is_admin && live(x) && x.id !== S.me?.id);
  const adminHelp = me ? (others.length ? `You cannot take away your own admin. Ask ${esc(andList(others.map(firstOf)))}.` : 'You are the only admin: give Admin to someone you trust, so the team is not stuck if you are away.')
    : 'Approves testimony, and opens Session setup and People.';
  return `<div class="pe-sec pe-roles" role="group" aria-labelledby="pe-roles-h"><h3 class="pe-h3" id="pe-roles-h">Roles</h3>
    ${a.email ? '' : `<p class="pe-p">Add ${esc(firstOf(a))}’s email first: roles go with a sign-in.</p>`}
    ${switchRow('pe-r-admin', 'Admin', !!a.is_admin, adminHelp, { 'data-perole': 'is_admin', ...(me ? { disabled: true } : dis) })}
    ${switchRow('pe-r-appr', 'Approver', !!a.can_approve, 'Approves testimony and supporter emails.', { 'data-perole': 'can_approve', ...dis })}
    ${switchRow('pe-r-rev', 'Second approver', !!a.is_reviewer, 'Gives a bill’s first testimony its second look.', { 'data-perole': 'is_reviewer', ...dis })}
    ${switchRow('pe-r-part', 'Partner approver', !!a.approves_partners, 'Approves partner groups and every word they write.', { 'data-perole': 'approves_partners' })}</div>`;
}
function record(a, { head = true } = {}) {
  const s = P(), me = isMe(a), l = s.logins?.[a.id], held = holdsWords(holdings(a)), rx = s.reach?.[a.id], signed = !!l?.last_sign_in_at;
  const leave = me ? '' : live(a)
    ? `<div class="pe-sec pe-leave"><p class="pe-p">${held ? `${esc(firstOf(a))} holds ${esc(held)}.` : `${esc(firstOf(a))} holds nothing that needs a new owner.`}</p>
      ${btn('Leaving or away?', { kind: 'secondary', icon: 'log-out', href: `#/people/${encodeURIComponent(a.id)}?view=leaving` })}</div>`
    : `<div class="pe-sec pe-leave">${notice('warn', 'eye-off', `<b>Turned off.</b> ${esc(firstOf(a))} cannot sign in. Their notes and approvals keep their name.`)}${btn('Turn back on', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-peon': a.id } })}</div>`;
  const sign = !live(a) ? '' : `<div class="pe-sec"><h3 class="pe-h3">Sign-in</h3><p class="pe-p">${esc(signWords(a))}.${a.email ? '' : ' Add their email first: it is how they sign in, and how Slack finds them.'}</p>
    ${me || !a.email || !s.logins ? '' : btn(signed ? 'New sign-in link' : l?.link_made_at ? 'Make a new link' : 'Make a sign-in link', { kind: signed ? 'text' : 'secondary', icon: 'link', attrs: { 'data-pelink': a.id } })}</div>`;
  const slack = !live(a) || !rx || rx.reach === 'off' ? '' : `<div class="pe-sec"><h3 class="pe-h3">Slack</h3><p class="pe-p">${esc(reachWords(rx))}.${reachOk(rx) ? '' : ' Their messages go to the next person who can be reached.'}${rx.not_reached ? ` ${plural(rx.not_reached, 'message')} did not reach them in 30 days.` : ''}</p></div>`;
  return `<article class="pe-rec" aria-labelledby="pe-rec-h">
    ${head ? `<div class="pe-top">${avatar(a, 48)}<div class="pe-who"><h2 class="pe-name" id="pe-rec-h">${esc(a.full_name)}${me ? ' <span class="pe-you">(you)</span>' : ''}</h2><p class="pe-mail">${esc(a.email || 'No email yet')}</p></div></div>`
      : `<div class="pe-top">${avatar(a, 48)}<p class="pe-mail" id="pe-rec-h">${esc(a.email || 'No email yet')}</p></div>`}
    ${leave}${sign}${live(a) ? roleSwitches(a) : ''}${slack}
    <p class="pe-edit">${btn('Change name, email or initials', { kind: 'text', icon: 'pencil', attrs: { 'data-peedit': a.id, 'aria-haspopup': 'dialog' } })}</p>
  </article>`;
}
// Below 1100px the record is its own page, named in its h1 (the phone's top bar shows it), with the frame's Back to People.
const recordPage = a => `<div class="pe-page pe-one"><h1 class="v6-ptitle sv-h1 pe-oneh">${esc(a.full_name)}${isMe(a) ? ' (you)' : ''}</h1>${record(a, { head: false })}</div>`;

// ---- Leaving or away? (V27): everything they hold, a cover for each part, one button ----
function partRow(p, a, done) {
  const who = coverWho(p.to), many = p.kind === 'bills' || (p.kind === 'issues' && p.items.length > 1);
  const line = done ? `${cap(who)} now · was ${firstOf(a)}’s` : `${many ? 'Go' : 'Goes'} to ${who} · ${p.to === p.sug ? p.why : 'your pick'}`;
  const button = done ? '' : btn(`${esc(p.to ? firstOf(p.to) : 'Pick')}${p.to && isMe(p.to) ? ' (you)' : ''}`, { kind: 'secondary', sm: true, iconEnd: 'chevron-down',
    attrs: { 'data-pecover': p.key, 'aria-haspopup': 'dialog', 'aria-label': `Who covers ${p.name}${p.num ? ` (${p.num})` : ''}: ${p.to ? p.to.full_name : 'no one yet'}. Change` } });
  return itemRow({ key: p.key, name: p.name, num: p.num, line: esc(line), button });
}
function leavingPage(a) {
  const s = P(), first = firstOf(a), done = s.done[a.id];
  const { h, parts } = done || planOf(a);
  const head = placeHead(`Hand over ${first}’s work`, { id: 'pe-leave-h',
    sub: done ? '' : `Everything ${esc(first)} holds, and who covers each part. One press moves it all, tells each new owner and turns ${esc(first)} off. Undo puts it all back.` });
  if (!done && !live(a)) return `<div class="pe-page pe-leaving">${head}${notice('warn', 'eye-off', `${esc(first)} is turned off already. Anything still in their name shows as No owner until someone takes it.`, btn('Open their record', { kind: 'text', href: `#/people/${encodeURIComponent(a.id)}` }))}</div>`;
  const ownerAfter = b => parts.find(p => p.kind === 'bills' && p.items.includes(b))?.to || advocate((S.assignments[b.id] || []).find(id => id !== a.id));
  const drafts = h.drafts.map(d => { const b = S.bills.find(x => x.id === d.bill_id); if (!b) return ''; const o = ownerAfter(b);
    return itemRow({ key: 'd:' + d.id, name: `Testimony on ${nameWords(b)}`, num: numWords(b), line: esc(`${cap(coverWho(o))} file${o && isMe(o) ? '' : 's'} it once approved · it follows the bill`), href: billRoute(b) }); }).join('');
  const going = h.going.map(x => itemRow({ key: 'h:' + x.id, name: `${x.committee} hearing`, num: whenAt(x.scheduled_at), line: esc(`${first}’s “I’m going” comes off`) })).join('');
  const rows = parts.map(p => partRow(p, a, !!done)).join('') + (done ? '' : drafts + going);
  const also = [h.helpsCoal.length ? `${first} helps on ${andList(h.helpsCoal.map(c => c.name))}` : '', h.helpsIssues.length ? `helps on ${plural(h.helpsIssues.length, 'issue')}` : ''].filter(Boolean);
  const quiet = done ? '' : [also.length ? `${cap(andList(also))}: that ends when ${first} is turned off.` : '', h.dead ? `${plural(h.dead, 'bill')} that died ${h.dead === 1 ? 'stays' : 'stay'} in ${first}’s name.` : ''].filter(Boolean).join(' ');
  const billParts = parts.filter(p => p.kind === 'bills');
  // v5's "See their live bills" (R-316 W28): Bills, filtered to them, to give the bills out one by one with bulk change.
  const which = billParts.length ? `<details class="pe-which"><summary>${icon('chevron-down', { cls: 'chev' })}<span>Which bills</span></summary><ul class="pe-wlist">${billParts.flatMap(p => p.items).map(b => `<li><a href="${esc(billRoute(b))}">${esc(nameWords(b))}</a> <span class="pe-num">${esc(numWords(b))}</span></li>`).join('')}</ul>
    ${done ? '' : `<p class="pe-wopen">${btn('Open them in Bills, to give them out one by one', { kind: 'text', icon: 'list-checks', attrs: { 'data-pebills': a.id } })}</p>`}</details>` : '';
  const away = done ? '' : notice('info', 'calendar-clock', `Away for a while? <b>Away until comes with a later update.</b> For now, hand the work over without a date, and turn ${esc(first)} back on from their record when they are back.`);
  const top = done ? notice('ok', 'circle-check', `<b>${done.parts.length ? 'Handed over' : 'Turned off'} ${esc(whenAt(new Date(done.at).toISOString()))}.</b> ${esc(first)} is turned off and cannot sign in. ${esc(done.toldWords)}`, btn('Undo', { kind: 'secondary', icon: 'undo-2', attrs: { 'data-peundo': a.id } })) : '';
  const nothing = !parts.length && !h.drafts.length && !h.going.length;
  const all = done || !parts.length ? '' : `<div class="pe-all">${btn('Give it all to one person', { kind: 'text', icon: 'users', attrs: { 'data-pecover': 'all', 'aria-haspopup': 'dialog' } })}</div>`;
  const go = done ? `<div class="pe-go">${btn(`Back to ${esc(first)}’s record`, { kind: 'text', icon: 'arrow-left', href: `#/people/${encodeURIComponent(a.id)}` })}</div>`
    : `<div class="pe-go">${btn(nothing ? 'Turn off' : 'Hand over and turn off', { icon: 'handshake', attrs: { 'data-pego': a.id, ...(s.busy === a.id ? { 'aria-busy': 'true' } : {}) } })}<span class="pe-note">${nothing ? `${esc(first)} holds nothing that needs a new owner.` : 'Each new owner is told in a bill’s messages.'}</span></div>`;
  return `<div class="pe-page pe-leaving">${head}${top}${away}
    ${rows ? `<div class="v6-list pe-parts" role="list" aria-label="What ${esc(first)} holds">${rows}</div>` : ''}
    ${all}${which}${quiet ? `<p class="pe-quiet">${esc(quiet)}</p>` : ''}${go}</div>`;
}

// ---- actions ----
async function busy(el, fn) { if (el?.getAttribute('aria-busy')) return; el?.setAttribute('aria-busy', 'true'); try { await fn(); } catch (e) { toast(e, { err: true }); } finally { if (el?.isConnected) el.removeAttribute('aria-busy'); } }
// team_save takes the whole record; every caller changes one thing and passes the rest as it is.
const saveP = (a, patch) => DB.teamSave(a.id, { full_name: a.full_name, initials: a.initials || '', email: a.email || '', is_admin: !!a.is_admin, is_reviewer: !!a.is_reviewer, can_approve: !!a.can_approve, is_active: a.is_active !== false, ...patch });
const ROLE_SAY = { is_admin: 'an admin', can_approve: 'an approver', is_reviewer: 'a second approver', approves_partners: 'a partner approver' };
async function setRole(a, key, on, el) {
  const set = v => key === 'approves_partners' ? DB.partnerSetApprover(a.id, v).then(() => { queueChanged(); wantQueue({ force: true }); }) : saveP(a, { [key]: v });
  try { await set(on); } catch (e) { if (el) el.checked = !on; toast(e, { err: true }); return; }
  redraw(); document.querySelector(`[data-perole="${key}"]`)?.focus({ preventScroll: true });
  toast(`${firstOf(a)} ${on ? 'is now' : 'is no longer'} ${ROLE_SAY[key]}.`, { ok: on, undo: async () => { await set(!on); redraw(); toast('Undone.'); } });
}
async function setActive(a, on) {
  try { await saveP(a, { is_active: on }); } catch (e) { toast(e, { err: true }); return; }
  redraw();
  toast(on ? `${a.full_name} is back on and can sign in.` : `${a.full_name} is turned off and can no longer sign in.`, { ok: on, undo: async () => { await saveP(a, { is_active: !on }); redraw(); toast('Undone.'); } });
}
// The hand-over: every part moves, then the person is turned off, then each new owner is told. If anything fails part way,
// what was done is put back, so nothing is left half handed over (B-5).
async function handOver(a, el) {
  const s = P(); if (s.busy) return;
  const { h, parts } = planOf(a), first = firstOf(a), undo = [], gave = new Map();   // cover id -> { who, bills, words }
  const give = (to, what, b) => { if (!to) return; const g = gave.get(to.id) || gave.set(to.id, { who: to, bills: [], words: [] }).get(to.id); if (b) g.bills.push(b); if (what) g.words.push(what); };
  s.busy = a.id; el?.setAttribute('aria-busy', 'true');
  try {
    for (const p of parts) {
      if (p.kind === 'bills') {
        for (const b of p.items) { const was = [...(S.assignments[b.id] || [])], keep = advocate(was.find(id => id !== a.id && live(advocate(id)))), to = keep || p.to;
          await DB.setOwner(b.id, to?.id || null); undo.push(() => DB.setOwner(b.id, was[0] || null)); give(to, '', b); }
        give(p.to, `${plural(p.items.length, 'bill')}${p.num && p.num !== 'no coalition' ? ` (${p.num})` : ''}`);
      } else if (p.kind === 'coalition') { const c = p.items[0], was = c.owner_id;
        await DB.saveCampaign(c.id, { owner_id: p.to?.id || null }); undo.push(() => DB.saveCampaign(c.id, { owner_id: was })); give(p.to, `the ${c.name} coalition`);
      } else if (p.kind === 'issues') {
        for (const i of p.items) { const was = i.owner_id; await DB.updateIssue(i.id, { owner_id: p.to?.id || null }); undo.push(() => DB.updateIssue(i.id, { owner_id: was })); }
        // A bill on one of the issues carries the message to someone who got only issues.
        const ids = new Set(p.items.map(i => i.id)), onIt = (S.billIssues || []).map(x => ids.has(x.issue_id) && S.bills.find(b => b.id === x.bill_id && b.tracked !== false)).find(Boolean);
        give(p.to, p.items.length === 1 ? `the issue “${p.items[0].name}”` : plural(p.items.length, 'issue'), onIt || null);
      } else if (p.kind === 'todo') { const t = p.items[0];
        await DB.updateTodo(t.bill_id, t.id, { assignee_id: p.to?.id || null }); undo.push(() => DB.updateTodo(t.bill_id, t.id, { assignee_id: a.id })); give(p.to, `a to-do (“${t.title}”)`, p.bill);
      }
    }
    for (const x of h.going) { await DB.attend(x.id, false, a.id); undo.push(() => DB.attend(x.id, true, a.id)); }
    await saveP(a, { is_active: false }); undo.push(() => saveP(a, { is_active: true }));
  } catch (e) {
    for (const u of undo.reverse()) { try { await u(); } catch { /* best effort; the toast says to try again */ } }
    s.busy = ''; redraw(); toast(`Nothing was handed over: ${friendly(e)}. Try again.`, { err: true }); return;
  }
  // Tell each new owner, once, in the messages on one of the bills they now hold (a bill's owners get its messages, in Slack
  // too where it reaches them). Nobody is told about what they did themselves; the words say truthfully who was told, where.
  const told = [], untold = [];
  for (const g of gave.values()) {
    if (isMe(g.who)) continue;
    const coal = parts.find(p => p.kind === 'coalition' && p.to?.id === g.who.id)?.items[0];
    const b = g.bills[0] || (coal && S.bills.find(x => x.tracked !== false && (S.billCampaigns?.[x.id] || []).includes(coal.id)));
    if (!b) { untold.push(firstOf(g.who)); continue; }
    try { const m = await DB.sendMessage(b.id, `@${firstOf(g.who)} From People: ${first} is turned off, so you now hold ${andList(g.words)}. They are on your Today and in Bills.`);
      undo.push(() => DB.deleteMessage(m)); told.push([firstOf(g.who), b]); }
    catch { untold.push(firstOf(g.who)); }
  }
  const toldWords = !gave.size ? '' : [told.length ? `${andList(told.map(([n]) => n))} ${told.length === 1 ? 'was' : 'were'} told in the messages on ${andList([...new Set(told.map(([, b]) => numWords(b)))])}.` : '',
    untold.length ? `${andList(untold)} ${untold.length === 1 ? 'was' : 'were'} not told yet: tell them in Slack.` : ''].filter(Boolean).join(' ') || 'It all came to you, so nobody else needed telling.';
  s.done[a.id] = { h, parts, at: Date.now(), undo, toldWords };
  s.busy = ''; delete s.cover[a.id]; redraw();
  document.getElementById('pe-leave-h')?.focus({ preventScroll: true });
  toast(gave.size ? `${first} is turned off and the work is handed over. ${toldWords}` : `${first} is turned off and can no longer sign in.`, { ok: true, undo: () => undoHandOver(a) });
}
async function undoHandOver(a) {
  const s = P(), d = a && s.done[a.id]; if (!d) return;
  const fails = [];
  for (const u of [...d.undo].reverse()) { try { await u(); } catch (e) { fails.push(e); } }
  delete s.done[a.id]; redraw();
  if (fails.length) toast(`Mostly undone, but ${plural(fails.length, 'part')} could not be put back: ${friendly(fails[0])}`, { err: true });
  else toast(`Undone. ${firstOf(a)} is back on and holds the work again.`);
}
function coverSheet(a, key) {
  const { parts } = planOf(a), p = key === 'all' ? null : parts.find(x => x.key === key); if (key !== 'all' && !p) return;
  const people = S.advocates.filter(x => x.id !== a.id && live(x)).sort((x, y) => x.full_name.localeCompare(y.full_name));
  const pick = P().cover[a.id] ??= {};
  const opts = [...(key === 'all' ? [['', 'The suggested person for each part', null, 'The coalition’s other people, else Nate']] : []),
    ...people.map(x => [x.id, x.full_name + (isMe(x) ? ' (you)' : ''), null, p && p.sug?.id === x.id ? `Suggested: ${p.why}` : rolesWords(x)])];
  pickerSheet({ title: key === 'all' ? `Who covers everything ${esc(firstOf(a))} holds?` : `Who covers ${esc(p.name)}${p.num ? ` (${esc(p.num)})` : ''}?`,
    value: key === 'all' ? (pick.all || '') : p.to?.id || '', options: opts,
    onPick: v => { if (key === 'all') P().cover[a.id] = v ? { all: v } : {}; else pick[key] = v; redraw();
      document.querySelector(`[data-pecover="${CSS.escape(key)}"]`)?.focus({ preventScroll: true }); } });
}

// ---- sheets: add a person, change their details, their sign-in link ----
const initialsOf = name => { const w = name.trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || '').slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, ''); };
const takenBy = (ini, self) => S.advocates.find(x => x.id !== self && String(x.initials || '').toUpperCase() === ini);
// Initials nobody else has (R-267): "JM" is James's, so Julie Mejia is offered JMM.
function freeInitials(name, self) {
  const w = name.trim().toUpperCase().replace(/[^A-Z\s]/g, '').split(/\s+/).filter(Boolean), base = initialsOf(name);
  if (!base || !takenBy(base, self)) return base;
  const f = w[0] || '', l = w[w.length - 1] || '';
  const tries = [base + l[0], f[0] + l.slice(0, 2), f.slice(0, 2) + (w.length > 1 ? l[0] : ''), ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => base.slice(0, 2) + c)];
  return tries.find(t => t.length >= 2 && t.length <= 3 && !takenBy(t, self)) || base;
}
const fieldErr = (root, id, msg) => { const el = root.querySelector('#' + id); if (!el) return toast(msg, { err: true }); el.setAttribute('aria-invalid', 'true'); el.closest('.field')?.querySelector('.err')?.remove(); el.insertAdjacentHTML('afterend', `<span class="err" id="${id}-err">${icon('circle-alert')}${esc(msg)}</span>`); el.setAttribute('aria-describedby', id + '-err'); el.focus(); };
function personSheet(a) {
  const locked = !!(a && P().logins?.[a.id]?.has_login);
  openSheet({ title: a ? `${esc(a.full_name)}’s details` : 'Add a person', size: 'auto',
    body: `<form class="pe-form" novalidate data-peform>
      ${field('pe-name', 'Name', `<input id="pe-name" type="text" value="${esc(a?.full_name || '')}" autocomplete="off"${a ? '' : ' autofocus'}>`)}
      ${field('pe-email', 'Email', `<input id="pe-email" type="email" value="${esc(a?.email || '')}" placeholder="name@hiphi.org" autocomplete="off" inputmode="email"${locked ? ' readonly' : ''} aria-describedby="pe-email-help">`, locked ? 'They sign in with this email. Ask Claude to change it.' : 'Their hiphi.org address: how they sign in, and how Slack finds them.')}
      ${field('pe-ini', 'Initials', `<input id="pe-ini" type="text" value="${esc(a?.initials || '')}" maxlength="3" autocomplete="off" autocapitalize="characters" aria-describedby="pe-ini-help">`, 'Shown in the small circle beside their bills.')}
      ${a ? '' : '<p class="pe-p">Their roles are on their record, once they are added.</p>'}
      <button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-pecancel': '1' } })}${btn(a ? 'Save' : 'Add', { attrs: { 'data-pesave': '1' } })}`,
    wire: d => {
      const v = id => d.querySelector('#' + id); let own = !!a;
      v('pe-ini').addEventListener('input', () => { own = true; });
      if (!a) v('pe-name').addEventListener('input', () => { if (!own) v('pe-ini').value = freeInitials(v('pe-name').value).slice(0, 3); });
      d.querySelector('[data-pecancel]').onclick = () => closeSheet();
      const save = async () => {
        const b = d.querySelector('[data-pesave]'); if (b.getAttribute('aria-busy')) return;
        d.querySelectorAll('.err').forEach(e => e.remove()); d.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
        const p = { full_name: v('pe-name').value, email: v('pe-email').value, initials: v('pe-ini').value };
        if (!p.full_name.trim()) return fieldErr(d, 'pe-name', 'Enter a name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) return fieldErr(d, 'pe-email', 'Enter an email address, like name@hiphi.org.');
        if (!/^[A-Za-z]{1,3}$/.test(p.initials.trim())) return fieldErr(d, 'pe-ini', 'Initials are one to three letters, like KV.');
        { const t = takenBy(p.initials.trim().toUpperCase(), a?.id), alt = t && freeInitials(p.full_name, a?.id);
          if (t) return fieldErr(d, 'pe-ini', `${p.initials.trim().toUpperCase()} is ${firstOf(t)}’s.${alt && !takenBy(alt, a?.id) ? ` Try ${alt}.` : ''}`); }
        b.setAttribute('aria-busy', 'true');
        try {
          const id = a ? (await saveP(a, p), a.id) : await DB.teamSave(null, { ...p, is_admin: false, is_reviewer: false, can_approve: false, is_active: true });
          await closeSheet({ silent: true }); loadLogins(true);
          const who = advocate(id) || { id, full_name: p.full_name.trim() };
          if (a) { redraw(); toast('Saved.', { ok: true }); return; }
          S.go(`#/people/${encodeURIComponent(id)}`);
          toast(`${who.full_name} added. Next, make their sign-in link and give them their roles.`, { ok: true, action: { label: 'Make the link', run: () => makeLink(who) } });
        } catch (e) {
          const m = e.message || '';
          if (/email/i.test(m)) fieldErr(d, 'pe-email', m); else if (/initials/i.test(m)) fieldErr(d, 'pe-ini', m); else if (/name/i.test(m) && !/admin/i.test(m)) fieldErr(d, 'pe-name', m); else toast(e, { err: true });
        } finally { d.querySelector('[data-pesave]')?.removeAttribute('aria-busy'); }
      };
      d.querySelector('[data-pesave]').onclick = save; d.querySelector('[data-peform]').onsubmit = e => { e.preventDefault(); save(); };
    } });
}
// A one-time sign-in link for the admin to email them (nothing is emailed from here; a Slack preview can spend the link).
async function makeLink(a) {
  const b = document.querySelector(`[data-pelink="${CSS.escape(a.id)}"]`); if (b?.getAttribute('aria-busy')) return;
  b?.setAttribute('aria-busy', 'true');
  let r; try { r = await DB.teamLink(a.id); } catch (e) { b?.removeAttribute('aria-busy'); toast(e.message || String(e), { err: true }); return; }
  b?.removeAttribute('aria-busy'); loadLogins(true);
  const first = firstOf(a), email = r.email || a.email, link = r.continue_link || r.link;
  const msg = `Aloha ${first},\n\nHere is your link to the HIPHI Bill Tracker, the team's staff app:\n${link}\n\nOpen it${r.continue_link ? ', press Continue,' : ''} and choose a password, and you are in. The link works once, and only for about an hour. From then on, sign in at ${APP_URL} with ${email} and your password.\n\n${S.me ? firstOf(S.me) : ''}`.trim();
  const mail = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your sign-in for the HIPHI Bill Tracker')}&body=${encodeURIComponent(msg)}`;
  openSheet({ title: `Sign-in link for ${esc(first)}`, size: 'auto',
    body: `<p class="pe-p">${r.created ? `${esc(first)} now has a login. ` : ''}Email ${esc(first)} this message yourself, not by Slack: a Slack link preview can open the link and use it up. It works once and only for about an hour.</p>
      ${field('pe-msg', 'The message', `<textarea id="pe-msg" rows="9" readonly>${esc(msg)}</textarea>`)}
      ${notice('info', 'shield-check', `Anyone who opens this link is signed in as ${esc(first)}, so send it only to them.`)}`,
    foot: `${btn('Copy link', { kind: 'text', icon: 'link', attrs: { 'data-cp': 'link' } })}${btn('Copy message', { kind: 'secondary', icon: 'copy', attrs: { 'data-cp': 'msg' } })}${btn('Email it', { icon: 'mail', href: mail })}`,
    wire: d => d.querySelectorAll('[data-cp]').forEach(x => x.onclick = async () => {
      try { await navigator.clipboard.writeText(x.dataset.cp === 'link' ? link : msg); toast(x.dataset.cp === 'link' ? 'Link copied. Send it by email.' : 'Message copied. Paste it into an email.', { ok: true }); }
      catch { const t = d.querySelector('#pe-msg'); t.focus(); t.select(); toast('Select the message and copy it.'); }
    }) });
}

// ---- the screen ----
const admins = () => S.advocates.filter(a => a.is_admin && live(a)).map(a => a.full_name).join(' or ') || 'an admin';
let wasWide = null;   // crossing 1100px redraws: the list with the record beside it, or the record as its own page
addEventListener('resize', () => { const w = wide(); if (wasWide !== null && w !== wasWide && S.route?.name === 'people') hooks.render(); wasWide = w; });
export default {
  tab: 'people',
  title: route => { const a = route?.id && advocate(route.id); return !a ? 'People' : route.q?.view === 'leaving' ? `Hand over ${firstOf(a)}’s work` : a.full_name; },
  back: route => { const a = route?.id && advocate(route.id); return !a ? null : route.q?.view === 'leaving' ? { href: `#/people/${encodeURIComponent(a.id)}`, label: firstOf(a) } : { href: '#/people', label: 'People' }; },
  render(route) {
    if (!S.me?.is_admin) return `<div class="pe-page"><h1 class="v6-ptitle sv-h1">People</h1>${empty({ title: 'People is for admins', text: `Ask ${esc(admins())} to change someone’s record. Your own choices are in My settings.`, action: btn('Open My settings', { kind: 'secondary', href: '#/me' }) })}</div>`;
    loadLogins(); loadReach(); wasWide = wide();
    const a = route.id && advocate(route.id);
    if (a && route.q?.view === 'leaving') return leavingPage(a);
    if (a && !wide()) return recordPage(a);
    return listPage(route);
  },
  wire(route, root) {
    const main = root.querySelector('.pe-page'); if (!main) return;
    const on = (sel, fn) => main.querySelectorAll(sel).forEach(el => el.onclick = e => fn(el, e));
    const who = id => advocate(id);
    on('[data-peadd]', () => personSheet(null));
    on('[data-peedit]', el => personSheet(who(el.dataset.peedit)));
    on('[data-pelink]', el => makeLink(who(el.dataset.pelink)));
    on('[data-peon]', el => busy(el, () => setActive(who(el.dataset.peon), true)));
    main.querySelectorAll('[data-perole]').forEach(el => el.onchange = () => { const a = who(route.id); if (a) setRole(a, el.dataset.perole, el.checked, el); });
    on('[data-pecover]', el => { const a = who(route.id); if (a) coverSheet(a, el.dataset.pecover); });
    on('[data-pego]', el => { const a = who(el.dataset.pego); if (a) handOver(a, el); });
    on('[data-peundo]', el => busy(el, () => undoHandOver(who(el.dataset.peundo))));
    on('[data-pebills]', el => { try { const v = bl(); v.scope = 'all'; v.owners = new Set([el.dataset.pebills]); saveBills(); } catch { /* Bills opens unfiltered */ } S.go('#/bills'); });
    main.querySelector('.pe-off')?.addEventListener('toggle', e => { P().offOpen = e.target.open; });
    // listDetail's own Back to the list (drawn below 1100px only, where this page shows the record alone instead).
    main.querySelectorAll('[data-v6ldback]').forEach(b => b.onclick = () => S.go('#/people'));
    const r = main.querySelector('[data-pereach]');
    if (r) r.onclick = async () => { const s = P(); if (s.slackBusy) return; s.slackBusy = true; redraw();
      try { const p = await DB.slackReach(), found = p.filter(x => x.matched), lost = p.filter(x => !x.matched).map(x => advocate(x.advocate_id)).filter(Boolean);
        toast(`Slack found ${found.length} of ${p.length}.${lost.length ? ` Not found: ${andList(lost.map(firstOf))}. Their Slack profile needs their hiphi.org email.` : ''}`, { ok: !lost.length }); loadReach(true); }
      catch (e) { toast(e.message || String(e), { err: true }); }
      finally { s.slackBusy = false; redraw(); } };
  },
};
