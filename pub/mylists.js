// People's own bill lists (R-013, Nate 9/30: "Build this now"; his answers: only signed-in people make lists, and whoever
// opens a shared link follows the list itself, so bills the maker adds later reach them too). Backend migration 102.
//   #/mylist/<id>   one of my lists (rename, note, take a bill off, share or stop sharing, remove it), or a list someone
//                   shared that I follow (read it, stop following it)
//   #/l/<token>     a shared list, for anyone with its link: what is on it, and Follow
// A list starts private. Share makes a link nobody can guess; whoever opens it sees the list and can follow it. Only bills
// HIPHI tracks and shows can go on a list (the database checks). The maker follows the bills they put on their list.
// The sandbox has no sign-in, so there the lists live in this browser and the whole flow can be practised.
import { S, D, DEMO, app, esc, icon, toast, spaced, nick, alive, findBill, countOk, recomputeWatch, saveLocal, loadBills, nudge } from './core.js';
import { btn, iconBtn, skeleton, inlineErr, row } from './ui.js';
import { billList, emptyBox, moving, becameLaw, stopped, byUrgency, fold, wireRows } from './mybills.js';

const UL = S.ul ??= { mine: null, loading: false, err: false, shared: {}, editing: null, taking: null, showLink: null, sheetFor: null };   // editing / taking: the id of the list being renamed / having bills taken off
const DEMO_KEY = 'hiphi_ulists';            // the sandbox's lists (the storage shim keeps them apart from the real page's)
const FOLLOW_KEY = 'hiphi_ulist_follows';   // shared lists followed before signing in: their links, joined to the account at sign-in
export const canMake = () => DEMO || !!S.user;
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
const readJSON = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: this visit only */ } };
export const localFollowed = () => new Set(readJSON(FOLLOW_KEY, []));
const saveLocalFollowed = s => writeJSON(FOLLOW_KEY, [...s]);
const writeDemo = () => writeJSON(DEMO_KEY, (UL.mine || []).filter(l => l.mine));
export const shareUrl = token => `${location.origin}${location.pathname.replace(/[^/]*$/, '')}track.html#/l/${token}`;
// Database words into plain ones (B-8): what could not be done, and what to do.
const plainErr = e => { const m = String(e?.message || e || '');
  return /up to 50 lists/.test(m) ? 'You can keep up to 50 lists. Remove one you no longer use, then make the new one.'
    : /up to 200 bills/.test(m) ? 'A list can hold up to 200 bills. Start a second list for the rest.'
    : /tracked, public bills/.test(m) ? 'That bill can’t go on a list: only bills HIPHI tracks can.'
    : /title|check constraint/.test(m) ? 'Give the list a name of 2 to 80 letters.'
    : /turned off sharing/.test(m) ? 'HIPHI turned off sharing for this list. Write to HIPHI if you think that was a mistake.'
    : /link may have been turned off|not found/i.test(m) ? 'This list isn’t available. Its maker may have stopped sharing it.'
    : 'That didn’t save. Check your connection and try again.'; };

// ---- the bills on a list: the tracker may not have loaded them yet (a stranger's list, an old bill) ----
async function ensureBills(ids) {
  const need = [...new Set(ids)].filter(id => !findBill(id) && !S.extra[id]);
  if (!need.length) return;
  if (DEMO) { for (const b of D.bills.filter(b => need.includes(b.id))) S.extra[b.id] = b; return; }
  const { data } = await S.supa.from('public_all_bills').select('*').in('id', need);
  for (const b of data || []) S.extra[b.id] = b;
}
const billOf = id => findBill(id) || S.extra[id] || (DEMO ? D.bills.find(b => b.id === id) : null);
const billsOf = l => (l.bill_ids || []).map(billOf).filter(Boolean);

// ---- loading ----
export async function loadMyLists({ force = false } = {}) {
  if (UL.loading || (UL.mine && !force)) return UL.mine;
  if (DEMO) { UL.mine = readJSON(DEMO_KEY, []).map(l => ({ ...l, mine: true })); await ensureBills(UL.mine.flatMap(l => l.bill_ids)); return UL.mine; }
  if (!S.user) { UL.mine = []; return UL.mine; }
  UL.loading = true;
  try {
    const { data, error } = await S.supa.rpc('my_user_lists'); if (error) throw error;
    UL.mine = data || []; UL.err = false;
    await ensureBills(UL.mine.flatMap(l => l.bill_ids || []));
  } catch (e) { console.error(e); UL.err = true; UL.mine = UL.mine || []; }
  finally { UL.loading = false; }
  return UL.mine;
}
const myList = id => (UL.mine || []).find(l => String(l.id) === String(id));
export const ownLists = () => (UL.mine || []).filter(l => l.mine);
export const followedLists = () => (UL.mine || []).filter(l => !l.mine);
// The lists I made that a bill is on (the bill page's "On your lists").
export const listsWith = billId => ownLists().filter(l => (l.bill_ids || []).includes(billId));
// The bill page's line under its issue: which of my lists the bill is on, each a link, so an add from the sheet shows
// on the page itself (B-7; the review 9/30 found the page gave no sign). Lists load once, on first need.
export function onListsLine(b) {
  if (!canMake()) return '';
  if (UL.mine === null) { if (!UL.loading) loadMyLists().then(() => { if (listsWith(b.id).length && document.body.dataset.screen === 'bill') app.render(); }); return ''; }
  const ls = listsWith(b.id); if (!ls.length) return '';
  return `<p class="bl-issue bl-onlist">${icon('list-checks')}<span>On your list${ls.length > 1 ? 's' : ''}: ${ls.map(l => `<a href="#/mylist/${encodeURIComponent(l.id)}">${esc(l.title)}</a>`).join(', ')}</span></p>`;
}

// ---- the maker's changes ----
export async function createList(title, note = '') {
  title = String(title || '').trim(); note = String(note || '').trim();
  if (title.length < 2 || title.length > 80) throw new Error('Give the list a name of 2 to 80 letters.');
  if (DEMO) {
    if (ownLists().length >= 50) throw new Error('You can keep up to 50 lists. Remove one you no longer use, then make the new one.');
    const l = { id: 'ul' + Date.now().toString(36), title, note: note || null, bill_ids: [], mine: true, share_token: null, created_at: new Date().toISOString() };
    UL.mine = [...(UL.mine || []), l]; writeDemo(); return l;
  }
  const { data, error } = await S.supa.from('user_lists').insert({ title, note: note || null }).select('id, title, note, created_at').single();
  if (error) throw new Error(plainErr(error));
  const l = { ...data, bill_ids: [], mine: true, share_token: null, followers: null };
  UL.mine = [...(UL.mine || []), l]; return l;
}
export async function setOnList(l, billId, on) {
  if (!DEMO) {
    const r = on ? await S.supa.from('user_list_bills').insert({ list_id: l.id, bill_id: billId })
      : await S.supa.from('user_list_bills').delete().eq('list_id', l.id).eq('bill_id', billId);
    if (r.error && !/duplicate/i.test(r.error.message)) throw new Error(plainErr(r.error));
  } else if (on && (l.bill_ids || []).length >= 200) throw new Error('A list can hold up to 200 bills. Start a second list for the rest.');
  l.bill_ids = on ? [...new Set([...(l.bill_ids || []), billId])] : (l.bill_ids || []).filter(x => x !== billId);
  // The maker follows what they put on their own list (the database does the same for the account).
  if (on && l.mine && !S.watch.has(billId)) { S.direct.add(billId); recomputeWatch(); saveLocal(); }
  if (DEMO) writeDemo();
}
async function saveWords(l, title, note) {
  title = String(title || '').trim(); note = String(note || '').trim();
  if (title.length < 2 || title.length > 80) throw new Error('Give the list a name of 2 to 80 letters.');
  if (!DEMO) { const { error } = await S.supa.from('user_lists').update({ title, note: note || null }).eq('id', l.id); if (error) throw new Error(plainErr(error)); }
  l.title = title; l.note = note || null; if (DEMO) writeDemo();
}
async function share(l) {
  if (l.share_token) return l.share_token;
  if (DEMO) l.share_token = Array.from(crypto.getRandomValues(new Uint8Array(20)), x => x.toString(16).padStart(2, '0')).join('');
  else { const { data, error } = await S.supa.rpc('share_user_list', { p_list: l.id }); if (error) throw new Error(plainErr(error)); l.share_token = data; }
  if (DEMO) writeDemo();
  return l.share_token;
}
// Stop sharing keeps the link aside for ten minutes, so Undo brings back the same link (B-5, backend migration 105).
async function unshare(l) {
  if (!DEMO) { const { error } = await S.supa.rpc('unshare_user_list', { p_list: l.id }); if (error) throw new Error(plainErr(error)); }
  l.unshared = l.share_token; l.share_token = null; if (DEMO) writeDemo();
}
async function reshare(l) {
  if (DEMO) l.share_token = l.unshared;
  else { const { data, error } = await S.supa.rpc('reshare_user_list', { p_list: l.id }); if (error) throw new Error(/too late/.test(error.message) ? 'It’s too late to undo. Share the list again for a new link.' : plainErr(error)); l.share_token = data; }
  l.unshared = null; if (DEMO) writeDemo();
}
// Removing a list hides it for everyone; nothing is erased, so Undo brings it back as it was (B-5).
async function remove(l, back = false) {
  if (!DEMO) { const { error } = await S.supa.from('user_lists').update({ archived_at: back ? null : new Date().toISOString() }).eq('id', l.id); if (error) throw new Error(plainErr(error)); }
  UL.mine = back ? [...(UL.mine || []), l] : (UL.mine || []).filter(x => x !== l);
  if (DEMO) writeDemo();
}

// ---- following a shared list ----
async function loadShared(token) {
  UL.shared[token] = 'loading';
  try {
    if (DEMO) { const l = readJSON(DEMO_KEY, []).find(x => x.share_token === token);
      UL.shared[token] = l ? { id: l.id, title: l.title, note: l.note, bill_ids: l.bill_ids, followers: null, mine: true, following: true } : null; }
    else { const { data, error } = await S.supa.rpc('shared_user_list', { p_token: token }); if (error) throw error; UL.shared[token] = data?.[0] || null; }
    if (UL.shared[token]) await ensureBills(UL.shared[token].bill_ids || []);
  } catch (e) { console.error(e); UL.shared[token] = 'err'; }
  app.render();
}
async function follow(token, sl) {
  const live = (sl.bill_ids || []).map(billOf).filter(b => b && (alive(b) || b.stage === 'governor')).map(b => b.id);
  if (S.user && !DEMO) {
    const { error } = await S.supa.rpc('follow_user_list', { p_token: token }); if (error) throw new Error(plainErr(error));
    sl.following = true; await loadMyLists({ force: true });
  } else { const s = localFollowed(); s.add(token); saveLocalFollowed(s); sl.following = true; nudge('follow'); }
  const add = live.filter(id => !S.watch.has(id));
  add.forEach(id => S.direct.add(id)); recomputeWatch(); saveLocal();
  try { await loadBills(); } catch (e) { console.error(e); }
  return add.length;
}
async function unfollow(l, token) {
  if (S.user && !DEMO && l?.id) { const { error } = await S.supa.rpc('unfollow_user_list', { p_list: l.id }); if (error) throw new Error(plainErr(error)); UL.mine = (UL.mine || []).filter(x => x.id !== l.id); }
  if (token) { const s = localFollowed(); s.delete(token); saveLocalFollowed(s); if (UL.shared[token] && typeof UL.shared[token] === 'object') UL.shared[token].following = false; }
}

// ---- the pages ----
const back = (href, label) => `<a class="fd-back" href="${href}" data-back>${icon('arrow-left')}<span>${label}</span></a>`;
const sechead = (id, title, meta = '') => `<div class="sechead"><h2 id="${id}">${title}</h2>${meta ? `<span class="meta">${meta}</span>` : ''}</div>`;
// What is on a list, as HIPHI's own lists show it: what can still be acted on first, then laws, then what stopped (folded).
// take: the maker is taking bills off, so each row's star becomes a Take off button (one list, not a second copy, A-14).
function billsBlock(l, key, { take = false } = {}) {
  const bills = billsOf(l);
  if (!bills.length) return '';
  const mv = byUrgency(bills.filter(moving)), law = bills.filter(becameLaw), gone = bills.filter(stopped);
  return `${mv.length ? `<section aria-labelledby="ul-mv-h">${sechead('ul-mv-h', 'Still moving', plural(mv.length, 'bill'))}${billList(mv, { pos: true, take })}</section>` : ''}
    ${law.length ? `<section aria-labelledby="ul-law-h">${sechead('ul-law-h', 'Became law', plural(law.length, 'bill'))}${billList(law, { pos: true, take })}</section>` : ''}
    ${gone.length ? fold('ul-g-' + key, `Did not advance (${gone.length})`, billList(gone, { why: true, take }), { open: take || (!mv.length && !law.length) }) : ''}`;
}
// The list's own small menu, as the bill page's ⋯ (same popover): what is done once in a while stays out of the way, so
// the bills start high on a phone (A-1). It sits right beside the main button (A-8); the two that take something away
// come last, apart from the rest.
const menu = items => `<div class="ul-menuwrap">${iconBtn('ellipsis', 'More for this list', { 'data-ulmenu': '1', 'aria-expanded': 'false', 'aria-controls': 'ul-menu' })}
  <div class="ul-menu" id="ul-menu" hidden>${items.map(([attr, ic, label]) => `<button type="button" class="ul-mi${/remove|unshare/.test(attr) ? ' bad' : ''}" ${attr}>${icon(ic)}<span>${label}</span></button>`).join('')}</div></div>`;

function minePage(l) {
  const n = (l.bill_ids || []).length, fans = countOk(l.followers), taking = n > 0 && String(UL.taking) === String(l.id);
  // The bill count is left to the group headings below (A-14); the line says who can see the list.
  const meta = [l.share_token ? 'Shared by link' : 'Private: only you can see it', fans ? `${fans} people follow it` : ''].filter(Boolean).join(' · ');
  const editing = String(UL.editing) === String(l.id);
  if (editing) return `<div class="fd ul" data-page="mylist" data-list="${esc(l.id)}">${back('#/bills', 'My issues')}<form class="ul-edit card" data-ulsave="${esc(l.id)}">
      <div class="field"><label for="ul-t">Name</label><input id="ul-t" class="input" maxlength="80" value="${esc(l.title)}" required></div>
      <div class="field"><label for="ul-n">A note for whoever sees the list <span class="muted">(optional)</span></label><textarea id="ul-n" maxlength="300" rows="2">${esc(l.note || '')}</textarea></div>
      <div class="btnrow">${btn('Save', { kind: 'primary', attrs: { type: 'submit' } })}${btn('Cancel', { kind: 'text', attrs: { 'data-ulcancel': '1' } })}</div></form></div>`;
  const head = `<header class="fd-ihead ul-head"><span class="fd-icon">${icon('list-checks')}</span><h1 class="hero">${esc(l.title)}</h1>
      ${l.note ? `<p class="lede">${esc(l.note)}</p>` : ''}<p class="meta">${esc(meta)}</p></header>`;
  // One row of what the maker does: an empty list's job is to get bills (Share waits until there is something to
  // share, B-3); a list with bills shares, or copies its link once shared. The rest is in ⋯.
  const items = [...(l.share_token && navigator.share ? [['data-ulshare="' + esc(l.share_token) + '"', 'share-2', 'Share…']] : []),
    ['data-uledit="1"', 'pencil', 'Edit name and note'], ...(n ? [['data-ultaking="1"', 'list-minus', taking ? 'Done taking bills off' : 'Take bills off']] : []),
    ...(l.share_token ? [['data-ulunshare="1"', 'link-2-off', 'Stop sharing']] : []),
    ['data-ulremove="1"', 'trash-2', 'Remove list']];
  const main = !n ? btn('Find bills to add', { kind: 'primary', icon: 'search', href: '#/find', attrs: { 'data-ulfind': '1' } })
    : l.share_token ? btn('Copy link', { kind: 'secondary', icon: 'link', attrs: { 'data-ulcopy': l.share_token } })
    : btn('Share this list', { kind: 'secondary', icon: 'share-2', attrs: { 'data-ulsharemake': l.id } });
  const say = n ? '' : `<p class="small muted ul-say">Nothing on it yet. Add bills from any bill’s page.</p>`;
  const takeBar = taking ? `<div class="ul-taking"><p>${icon('list-minus')}<span>Press <span class="ul-minus">${icon('circle-minus', { label: 'the minus button' })}</span> beside a bill to take it off this list. You still follow it.</span></p>${btn('Done', { kind: 'secondary', sm: true, attrs: { 'data-ultaking': '1' } })}</div>` : '';
  // Copying can fail after the wait for a new link (some browsers): then the link is shown, to copy by hand.
  const showLink = l.share_token && UL.showLink === l.share_token ? `<div class="ul-link"><label for="ul-url" class="small">Select the link and copy it</label><input id="ul-url" class="input" readonly value="${esc(shareUrl(l.share_token))}"></div>` : '';
  // From 1100px the actions sit beside the title, so the bills start higher (A-1).
  return `<div class="fd ul" data-page="mylist" data-list="${esc(l.id)}">${back('#/bills', 'My issues')}<div class="ul-top">${head}
    <div class="ul-actions">${main}${menu(items)}</div></div>${say}${showLink}${takeBar}
    ${billsBlock(l, l.id, { take: taking })}${n ? `<p class="ul-add">${btn('Find more bills to add', { kind: 'text', icon: 'search', href: '#/find' })}</p>` : ''}</div>`;
}
// Someone else's list sits on HIPHI's site, so it says plainly, above its name, that HIPHI did not make it (P-5). Its
// icon is a list in grey, not HIPHI's blue, and the line carries the one person icon.
const notFromHipHi = () => `<p class="ul-notus">${icon('user')}<span>Made by a tracker user, not by HIPHI.</span></p>`;
const theirHead = l => { const fans = countOk(l.followers);
  return `<header class="fd-ihead ul-head"><span class="fd-icon ul-theirs">${icon('list-checks')}</span><h1 class="hero">${esc(l.title)}</h1>
    ${l.note ? `<p class="lede ul-note"><span class="ul-notelab">Their note:</span> ${esc(l.note)}</p>` : ''}${fans ? `<p class="meta">${fans} people follow it</p>` : ''}</header>`; };
function followedPage(l) {
  const n = (l.bill_ids || []).length;
  return `<div class="fd ul" data-page="mylist">${back('#/bills', 'My issues')}${notFromHipHi()}${theirHead(l)}
    <div class="card fd-follow on"><p class="okmsg">${icon('circle-check')}<span>You follow this list</span></p><p class="small">When its maker adds a bill, it shows up in My issues.</p>
    <div>${btn('Stop following this list', { kind: 'text', sm: true, attrs: { 'data-ulunfollow': l.id } })}</div></div>${billsBlock(l, l.id)}
    ${n ? '' : '<p class="fd-none">Nothing on this list yet.</p>'}</div>`;
}
function myListPage(id) {
  if (UL.mine === null) { loadMyLists().then(() => app.render()); return `<div class="fd ul">${back('#/bills', 'My issues')}${skeleton(3)}</div>`; }
  const l = myList(id);
  if (!l) return `<div class="fd ul">${back('#/bills', 'My issues')}${emptyBox({ h: 'h1', title: 'We couldn’t find that list', text: canMake() ? 'It may have been removed. Your lists are in My issues.' : 'Sign in to see your lists.',
    action: btn(canMake() ? 'Go to My issues' : 'Sign in', { kind: 'primary', href: canMake() ? '#/bills' : '#/signin', attrs: canMake() ? {} : { 'data-ulsignin-page': '1' } }) })}</div>`;
  return l.mine ? minePage(l) : followedPage(l);
}
function sharedPage(token) {
  const sl = UL.shared[token];
  if (sl === undefined) loadShared(token);
  if (sl === undefined || sl === 'loading') return `<div class="fd ul" data-page="shared">${back('#/', 'Home')}${skeleton(3)}</div>`;
  if (sl === 'err') return `<div class="fd ul">${back('#/', 'Home')}<div class="fd-err">${inlineErr('ul-err', 'We couldn’t load this list. Check your connection and try again.')}${btn('Try again', { kind: 'secondary', icon: 'rotate-ccw', attrs: { 'data-ulretry': token } })}</div></div>`;
  if (!sl) return `<div class="fd ul">${back('#/', 'Home')}${emptyBox({ h: 'h1', title: 'This list isn’t available', text: 'The person who made it may have stopped sharing it, or the link was cut short.', action: btn('Browse issues', { kind: 'primary', icon: 'search', href: '#/find' }) })}</div>`;
  if (sl.mine) return myList(sl.id) ? minePage(myList(sl.id)) : myListPage(sl.id);   // the maker opening their own link sees their own page
  const n = (sl.bill_ids || []).length, following = sl.following || localFollowed().has(token);
  const live = billsOf(sl).filter(moving).length, account = !!S.user || DEMO;
  // "too" only when something on it is moving now: between sessions nothing comes at once (A-14 honesty, the review 9/30).
  const cta = following ? `<div class="card fd-follow on"><p class="okmsg" id="ul-ok" tabindex="-1">${icon('circle-check')}<span>You follow this list</span></p>
        <p class="small">${account ? 'When its maker adds a bill, it shows up in My issues.' : 'Bills its maker adds later come to you once you add your email.'}</p>
        <div class="btnrow">${account ? '' : btn('Add my email', { kind: 'text', sm: true, icon: 'mail', attrs: { 'data-ulsigninfrom': token } })}${btn('Stop following this list', { kind: 'text', sm: true, attrs: { 'data-ulunfollowtok': token } })}</div></div>`
    : `<div class="fd-cta fd-follow">${btn('Follow this list', { kind: 'primary', icon: 'star', full: true, attrs: { 'data-ulfollow': token } })}
        <p class="small muted">${esc(live ? `Its ${plural(live, 'bill')} still moving join My issues, and so will bills added later.` : 'Bills its maker adds later will come to you.')}</p></div>`;
  return `<div class="fd ul" data-page="shared">${back('#/', 'Home')}${notFromHipHi()}<div class="fd-lhead">${theirHead(sl)}${cta}</div>
    ${billsBlock(sl, 'tok')}${n ? '' : '<p class="fd-none">Nothing on this list yet.</p>'}</div>`;
}

// ---- My issues: the lists I made and the ones shared with me ----
export function myListsSection() {
  if (UL.mine === null && canMake()) { loadMyLists().then(() => { if (document.body.dataset.screen === 'bills') app.render(); }); return ''; }
  const own = ownLists(), theirs = followedLists();
  const localTok = !S.user && !DEMO ? [...localFollowed()] : [];
  localTok.forEach(t => { if (UL.shared[t] === undefined) loadShared(t); });
  const localRows = localTok.map(t => [t, UL.shared[t]]).filter(([, x]) => x && typeof x === 'object').map(([t, sl]) => ({ ...sl, href: `#/l/${t}` }));
  const rowOf = (l, href) => row({ leadHtml: `<span class="lead">${icon(l.mine ? 'list-checks' : 'user')}</span>`, title: esc(l.title), href,
    sub: `<span class="mb-tmeta">${esc([plural((l.bill_ids || []).length, 'bill'), l.mine ? (l.share_token ? 'Shared by link' : 'Private') : 'Shared with you'].join(' · '))}</span>` });
  const mine = own.length ? `<section aria-labelledby="ul-mine-h"><div class="sechead"><h2 id="ul-mine-h">Your lists</h2>${btn('New list', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-ulnew': '1' } })}</div>
      <div class="rows">${own.map(l => rowOf(l, `#/mylist/${encodeURIComponent(l.id)}`)).join('')}</div></section>` : '';
  const shared = theirs.length || localRows.length ? `<section aria-labelledby="ul-shared-h"><div class="sechead"><h2 id="ul-shared-h">Lists shared with you</h2></div>
      <div class="rows">${[...theirs.map(l => rowOf(l, `#/mylist/${encodeURIComponent(l.id)}`)), ...localRows.map(l => rowOf(l, l.href))].join('')}</div></section>` : '';
  // Nobody is asked for anything here (C-1): a signed-in person with no lists gets one quiet line, a signed-out person none.
  const hint = !own.length && canMake() ? `<div class="ul-hint"><p class="small muted">${icon('list-checks')}<span>Keep bills together, or share them with others: open a bill and choose <b>Add to a list</b>.</span></p>
      ${btn('Make a list', { kind: 'text', sm: true, icon: 'plus', attrs: { 'data-ulnew': '1' } })}</div>` : '';
  return mine + shared + hint;
}

// ---- "Add to a list": a sheet from the bill page ----
// What just happened is said in a status line inside the sheet (a toast would sit behind it), right under the lists it
// is about; a failure is red with its icon (B-8). The line stays put while the parts around it are repainted, so a
// screen reader hears each change once.
let dlg = null;
const part = id => dlg.querySelector('#' + id);
const shSay = (t, err = false) => { const el = dlg?.querySelector('#ul-shstat'); if (!el) return; el.className = 'ul-status' + (err ? ' bad' : '');
  el.innerHTML = t ? `${icon(err ? 'circle-alert' : 'circle-check')}<span>${esc(t)}</span>` : ''; };
// b: the bill to add; null for a new, empty list (My issues' "New list").
export function openAddTo(b) {
  UL.sheetFor = b ? b.id : 'new';
  if (!dlg) { dlg = document.createElement('dialog'); dlg.className = 'sheet ul-sheet'; dlg.setAttribute('aria-labelledby', 'ul-sh-h'); document.body.appendChild(dlg);
    dlg.innerHTML = '<div class="ul-shin"><div id="ul-shbody" class="ul-shpart"></div><p class="ul-status" id="ul-shstat" role="status" aria-live="polite"></p><div id="ul-shrest" class="ul-shpart"></div></div>';
    dlg.addEventListener('close', () => { UL.sheetFor = null; app.render(); }); }
  shSay(''); paintSheet();
  try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
  (dlg.querySelector('input[type=checkbox], #ul-newt, [data-ulsignin]') || dlg.querySelector('button'))?.focus();
  if (canMake() && UL.mine === null) loadMyLists().then(() => { if (dlg?.open) { paintSheet(); dlg.querySelector('input[type=checkbox], #ul-newt')?.focus(); } });
}
const NAME_HINT = 'For example: School bills';
function paintSheet() {
  if (!dlg) return;
  if (UL.sheetFor === 'new') return paintNew();
  const b = billOf(UL.sheetFor) || findBill(UL.sheetFor); if (!b) return;
  const sp = spaced(b.bill_number), name = nick(b), h2 = `<h2 id="ul-sh-h">Add ${esc(name ? `${name} (${sp})` : sp)} to a list</h2>`;
  let top, rest = '';
  if (!canMake()) top = `${h2}<p>Make your own lists of bills to keep them together, and share a list with anyone by a link. Lists are kept with your email, so they follow you to every device.</p>
      <p class="small muted">After you open the link we email you, you come back to this bill to finish.</p>
      <div class="btncol">${btn('Add my email', { kind: 'primary', full: true, icon: 'mail', attrs: { 'data-ulsignin': '1' } })}${btn('Not now', { kind: 'text', attrs: { 'data-ulclose': '1' } })}</div>`;
  else if (UL.mine === null || UL.loading) top = h2 + skeleton(2);
  else {
    const own = ownLists();
    top = `${h2}${own.length ? `<fieldset class="ul-pick"><legend class="sr">Your lists</legend>${own.map(l => { const on = (l.bill_ids || []).includes(b.id);
        return `<label class="check ul-row"><input type="checkbox" data-ulpick="${esc(l.id)}" ${on ? 'checked' : ''}><span><b>${esc(l.title)}</b><span class="small muted"> · ${plural((l.bill_ids || []).length, 'bill')}</span></span></label>`; }).join('')}</fieldset>`
      : '<p class="small muted">You have no lists yet. Name your first one:</p>'}`;
    rest = `<form class="ul-new" data-ulnewform><label for="ul-newt">${own.length ? 'Or a new list' : 'List name'}</label><div class="ul-newrow"><input id="ul-newt" class="input" maxlength="80" placeholder="${NAME_HINT}" autocomplete="off">
        ${own.length ? btn('Make list and add', { kind: 'secondary', sm: true, attrs: { type: 'submit' } }) : ''}</div><div id="ul-newerr"></div>
        ${own.length ? '' : btn(`Make the list and add ${esc(sp)}`, { kind: 'primary', full: true, attrs: { type: 'submit' } })}</form>
      <p class="small muted ul-fine">You follow the bills on your lists, so their hearings come to you. New lists are private until you share them.</p>
      ${own.length ? btn('Done', { kind: 'primary', full: true, attrs: { 'data-uldone': '1' } }) : btn('Cancel', { kind: 'text', attrs: { 'data-ulclose': '1' } })}`;   // one loud button: making the list when there is none (A-13)
  }
  part('ul-shbody').innerHTML = top; part('ul-shrest').innerHTML = rest;
  wireSheet(b);
}
function wireSheet(b) {
  dlg.querySelectorAll('[data-ulclose]').forEach(el => el.onclick = () => dlg.close());
  dlg.querySelector('[data-ulsignin]')?.addEventListener('click', () => { rememberPlace({ addto: b.id }); dlg.close(); app.go('#/signin'); });
  const followNote = was => !was && S.watch.has(b.id) ? ` You follow ${spaced(b.bill_number)} now.` : '';
  dlg.querySelectorAll('[data-ulpick]').forEach(el => el.onchange = async () => {
    const l = myList(el.dataset.ulpick); if (!l) return; el.disabled = true; const was = S.watch.has(b.id), on = el.checked;
    let said = '', bad = false;
    try { await setOnList(l, b.id, on); said = on ? `Added to ${l.title}.${followNote(was)}` : `Taken off ${l.title}.`; }
    catch (e) { said = e.message; bad = true; }
    const typed = dlg.querySelector('#ul-newt')?.value || '';
    paintSheet(); shSay(said, bad);
    const t = dlg.querySelector('#ul-newt'); if (t && typed) t.value = typed;   // a name being typed survives the repaint (C-9)
    dlg.querySelector(`[data-ulpick="${CSS.escape(String(l.id))}"]`)?.focus();
  });
  // Make a list from the typed name and add the bill; true when it worked.
  const make = async () => {
    const t = dlg.querySelector('#ul-newt'), v = t.value.trim(), was = S.watch.has(b.id);
    try { const l = await createList(v); await setOnList(l, b.id, true); paintSheet(); shSay(`Made ${l.title} and added ${spaced(b.bill_number)}.${followNote(was)}`);
      dlg.querySelector(`[data-ulpick="${CSS.escape(String(l.id))}"]`)?.focus(); return true; }
    catch (er) { const box = dlg.querySelector('#ul-newerr'); if (box) box.innerHTML = inlineErr('ul-newmsg', er.message); t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', 'ul-newmsg'); t.focus(); return false; }
  };
  const f = dlg.querySelector('[data-ulnewform]');
  if (f) f.onsubmit = e => { e.preventDefault(); make(); };
  // Done with a name typed in the box makes that list first: closing would lose it (C-9; the review 9/30 lost one so).
  dlg.querySelector('[data-uldone]')?.addEventListener('click', async () => {
    const v = (dlg.querySelector('#ul-newt')?.value || '').trim();
    if (!v) return dlg.close();
    if (await make()) dlg.close();
  });
}
// A new list from My issues: the same sheet, without a bill. Name it (the note is optional), then add bills from their pages.
function paintNew() {
  part('ul-shbody').innerHTML = `<h2 id="ul-sh-h">A new list</h2>
    <form class="ul-new" data-ulmake><div class="field"><label for="ul-newt">Name</label><input id="ul-newt" class="input" maxlength="80" placeholder="${NAME_HINT}" autocomplete="off" required></div>
      <div class="field"><label for="ul-newn">A note for whoever sees it <span class="muted">(optional)</span></label><textarea id="ul-newn" maxlength="300" rows="2"></textarea></div>
      <div id="ul-newerr"></div><div class="btncol">${btn('Make the list', { kind: 'primary', full: true, attrs: { type: 'submit' } })}${btn('Cancel', { kind: 'text', attrs: { 'data-ulclose': '1', type: 'button' } })}</div></form>
    <p class="small muted ul-fine">New lists are private until you share them.</p>`;
  part('ul-shrest').innerHTML = '';
  dlg.querySelectorAll('[data-ulclose]').forEach(el => el.onclick = () => dlg.close());
  dlg.querySelector('[data-ulmake]').onsubmit = async e => {
    e.preventDefault(); const t = dlg.querySelector('#ul-newt');
    try { const l = await createList(t.value, dlg.querySelector('#ul-newn').value); dlg.close(); app.go(`#/mylist/${encodeURIComponent(l.id)}`);
      toast(`Made ${l.title}.`, { yay: true }); document.querySelector('.ul [data-ulfind]')?.focus(); }
    catch (er) { dlg.querySelector('#ul-newerr').innerHTML = inlineErr('ul-newmsg', er.message); t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', 'ul-newmsg'); t.focus(); }
  };
}
function newListFromMyIssues() {
  if (!canMake()) { rememberPlace(); app.go('#/signin'); return; }
  openAddTo(null);
}

// ---- coming back after adding an email ----
// The emailed link opens the tracker's plain address, often in a new tab, so where the person was (and the list task
// they started) is kept in this browser for an hour and picked up once they are signed in.
const AFTER_KEY = 'hiphi_after_signin';
export function rememberPlace(then = null) { writeJSON(AFTER_KEY, { hash: location.hash || '#/', then, at: Date.now() }); }
// The sign-in page's line: a place waiting, or null.
export function pendingPlace() { const a = readJSON(AFTER_KEY, null); return a && Date.now() - (a.at || 0) < 3600e3 ? a : null; }
// The page's start, once signed in: the place to return to (taken, so it happens once), or null.
export function takePlace() {
  const a = pendingPlace(); if (!S.user || !a) return null;
  try { localStorage.removeItem(AFTER_KEY); } catch { /* private mode */ }
  return /^#\/[\w/.~%-]*$/.test(a.hash) && a.hash !== '#/signin' ? a : null;
}
export function finishPlace(a) {
  if (!a?.then?.addto) return;
  loadMyLists().then(() => { const b = billOf(a.then.addto); if (b) openAddTo(b); });
}

// ---- wiring ----
// Copy the link. Some browsers refuse to copy after a wait (making the link is a trip to the server), so when copying
// fails the link is shown, selected, to copy by hand.
async function copy(token, { quiet = false } = {}) {
  try { await navigator.clipboard.writeText(shareUrl(token)); if (!quiet) toast('Link copied. Paste it into a text or an email.', { yay: true }); return true; }
  catch { if (!quiet) { UL.showLink = token; app.render(); const el = document.getElementById('ul-url'); el?.focus(); el?.select(); } return false; }
}
export function wireMyLists(root) {
  root.querySelectorAll('[data-ulnew]').forEach(el => el.onclick = () => newListFromMyIssues());
}
// The list's ⋯ menu opens and closes without a re-render, so focus stays put; Escape and a click outside close it.
function setMenu(open, focusToggle) {
  const m = document.getElementById('ul-menu'), tog = document.querySelector('[data-ulmenu]'); if (!m || !tog) return;
  m.hidden = !open; tog.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) m.querySelector('button')?.focus(); else if (focusToggle) tog.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.getElementById('ul-menu')?.hidden === false) { e.preventDefault(); setMenu(false, true); } });
document.addEventListener('click', e => { const m = document.getElementById('ul-menu'); if (m && !m.hidden && !e.target.closest('.ul-menuwrap')) setMenu(false); });
function wire(r) {
  const root = document.querySelector('.ul'); if (!root) return;
  wireRows(root);
  const lid = root.dataset.list, here = () => myList(lid);
  const busy = el => { el.setAttribute('aria-busy', 'true'); };
  const run = async (el, fn) => { busy(el); try { await fn(); } catch (e) { toast(e.message || e, true); } app.render(); };
  const item = (sel, fn) => root.querySelectorAll(sel).forEach(el => el.onclick = e => { setMenu(false); fn(el, e); });
  root.querySelector('[data-ulmenu]')?.addEventListener('click', e => { e.stopPropagation(); setMenu(document.getElementById('ul-menu').hidden); });
  root.querySelectorAll('[data-ulretry]').forEach(el => el.onclick = () => { delete UL.shared[el.dataset.ulretry]; app.render(); });
  root.querySelectorAll('[data-ulcopy]').forEach(el => el.onclick = () => copy(el.dataset.ulcopy));
  item('[data-ulshare]', async el => { const l = here(); try { await navigator.share({ title: l?.title || 'A list of bills', url: shareUrl(el.dataset.ulshare) }); } catch { /* closed */ } });
  item('[data-uledit]', () => { UL.editing = lid; UL.taking = null; app.render(); document.getElementById('ul-t')?.focus(); });
  root.querySelectorAll('[data-ulcancel]').forEach(el => el.onclick = () => { UL.editing = null; app.render(); document.querySelector('[data-ulmenu]')?.focus(); });
  root.querySelectorAll('[data-ulsave]').forEach(f => f.onsubmit = async e => { e.preventDefault(); const l = myList(f.dataset.ulsave); if (!l) return;
    try { await saveWords(l, document.getElementById('ul-t').value, document.getElementById('ul-n').value); UL.editing = null; app.render(); toast('Saved.'); document.querySelector('.ul h1')?.focus(); }
    catch (er) { toast(er.message, true); } });
  // Share: make the link and copy it in one press; the page then offers Copy link.
  root.querySelectorAll('[data-ulsharemake]').forEach(el => el.onclick = async () => { busy(el);
    try { const t = await share(here()); const ok = await copy(t, { quiet: true }); app.render();
      toast(ok ? 'Shared, and the link is copied. Anyone with it can see the list and follow it.' : 'Shared. Press Copy link to copy it. Anyone with the link can see the list and follow it.', { yay: true });
      document.querySelector('.ul [data-ulcopy]')?.focus(); }
    catch (e) { el.removeAttribute('aria-busy'); toast(e.message || e, true); } });
  item('[data-ulunshare]', el => run(el, async () => { const l = here(); await unshare(l); UL.showLink = null;
    toast('The link is off: anyone who opens it now sees nothing. People who follow the list keep it.', { undo: async () => {
      try { await reshare(l); app.render(); toast('The same link works again.'); } catch (e) { toast(e.message, true); } } }); }));
  item('[data-ulremove]', el => run(el, async () => { const l = here(); await remove(l);
    app.go('#/bills', { replace: true }); toast(`Removed ${l.title}. Its bills stay in My issues.`, { undo: async () => { await remove(l, true); app.go(`#/mylist/${encodeURIComponent(l.id)}`); } }); }));
  item('[data-ultaking]', () => { const on = String(UL.taking) !== String(lid); UL.taking = on ? lid : null; app.render();
    (on ? document.querySelector('.ul [data-ultake]') : document.querySelector('[data-ulmenu]'))?.focus(); });
  // Taking a bill off: the row goes, focus moves to the next row's Take off (or back to the menu when the list is empty).
  root.querySelectorAll('[data-ultake]').forEach(el => el.onclick = () => { const all = [...root.querySelectorAll('[data-ultake]')], i = all.indexOf(el);
    run(el, async () => { const l = here(), id = el.dataset.ultake, b = billOf(id); await setOnList(l, id, false);
      if (!(l.bill_ids || []).length) UL.taking = null;
      toast(`Took ${spaced(b?.bill_number || '')} off ${l.title}. You still follow it.`, { undo: async () => { await setOnList(l, id, true); app.render(); } }); })
      .then(() => { const left = [...document.querySelectorAll('.ul [data-ultake]')]; (left[Math.min(i, left.length - 1)] || document.querySelector('[data-ulmenu]'))?.focus(); }); });
  root.querySelectorAll('[data-ulunfollow]').forEach(el => el.onclick = () => run(el, async () => { const l = myList(el.dataset.ulunfollow); await unfollow(l); app.go('#/bills', { replace: true });
    toast(`You stopped following ${l.title}. Its bills stay in My issues.`); }));
  // Following is confirmed once, by the card that replaces the button (A-14); focus goes to its words.
  root.querySelectorAll('[data-ulfollow]').forEach(el => el.onclick = () => run(el, async () => { const tok = el.dataset.ulfollow, sl = UL.shared[tok];
    await follow(tok, sl); setTimeout(() => document.getElementById('ul-ok')?.focus(), 0); }));
  root.querySelectorAll('[data-ulunfollowtok]').forEach(el => el.onclick = () => run(el, async () => { const tok = el.dataset.ulunfollowtok, sl = UL.shared[tok];
    await unfollow(S.user && !DEMO ? (UL.mine || []).find(x => x.id === sl.id) || { id: sl.id } : null, tok); toast(`You stopped following ${sl.title}. Its bills stay in My issues.`); }));
  root.querySelectorAll('[data-ulsigninfrom], [data-ulsignin-page]').forEach(el => el.onclick = e => { e.preventDefault(); rememberPlace(); app.go('#/signin'); });
}

// The tab bar: a list of one's own, or one followed, is part of My issues; a stranger's list opened from a link is
// neither My issues nor Find, so no tab claims it (the review 9/30).
let tabNow = 'bills';
export default {
  get tab() { return tabNow; },
  title: r => r.name === 'shared' ? (UL.shared[r.token]?.title || 'A shared list') : (myList(r.id)?.title || 'Your list'),
  render(r) {
    const sl = r.name === 'shared' ? UL.shared[r.token] : null;
    tabNow = r.name !== 'shared' || (sl && typeof sl === 'object' && (sl.mine || sl.following || localFollowed().has(r.token))) ? 'bills' : '';
    const lid = r.name === 'shared' ? UL.shared[r.token]?.id : r.id;
    if (String(UL.editing) !== String(lid)) UL.editing = null;
    if (String(UL.taking) !== String(lid)) UL.taking = null;
    return r.name === 'shared' ? sharedPage(r.token) : myListPage(r.id);
  },
  wire,
};
