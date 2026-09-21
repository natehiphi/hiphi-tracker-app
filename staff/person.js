// A supporter's page (plan 3.7, #/person/:id): who they are, how to reach them, what they may be emailed, what they
// follow, and one activity feed (their timeline and the team's notes together). Same data and calls as the current
// app's person drawer (app.js personDrawerHTML / wirePersonDrawer). Street addresses are private to the person: only
// the districts found from one are stored, and no address is ever shown (nothing here reads p.address).
// Desktop (1100px and wider) is two columns: what they follow and everything that happened in the main column, and a
// side panel that stays in view with how to reach them, where they live (districts only), tags and consent.
import { S, DB, DEMO, hooks, esc, fmtDate, fmtDT, advocate, islandOf, personById } from './data.js';
import { INTERESTS, personName, whereOf, billById, blurb, looksLikeAddress, geoSuggest, geoDistricts, hiToday } from './model.js';
import { icon, btn, iconBtn, chip, billRow, empty, skeleton, toast, openSheet, closeSheet, menuSheet, confirmSheet, switchRow } from './ui.js';
import { followupSheet, afterSheet } from './supporters.js';
import { issueById, catByKey } from './issues.js';

const FEED_STEP = 20, BILLS_FIRST = 5;
const isTwo = () => matchMedia('(min-width: 1100px)').matches;
// A tel: link only helps on a phone. With a mouse the number is shown as text with a Copy button instead.
const hasMouse = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
const tel = p => String(p.phone || '').replace(/[^\d+]/g, '');
function copyText(text, okMsg) {
  const fail = () => toast('Copying did not work in this browser. Select the text and copy it.');
  try { navigator.clipboard.writeText(text).then(() => toast(okMsg, { ok: true }), fail); } catch { fail(); }
}
const firstName = a => (a?.full_name || '').split(' ')[0] || 'Someone';
const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const intLabel = k => INTERESTS.find(x => x[0] === k)?.[1] || k;
const dueAt = f => new Date(f.due + 'T17:00:00-10:00');   // a follow-up is due by the end of the working day, as in Today
const P = () => S.spPerson ??= { feedAll: {}, billsAll: {}, loading: {} };
const FROM = { today: 'Today', search: 'Search', emails: 'Emails', lists: 'Lists', list: 'List' };

// What a timeline entry looks like: an icon that says what kind of thing happened (never colour alone).
const KIND_ICON = { email: 'mail', open: 'mail-check', click: 'link', follow: 'bookmark', action: 'circle-check', signup: 'user-plus', added: 'user-plus', bounce: 'triangle-alert', unsubscribe: 'bell-off' };

// Kick the notes and timeline loads once per person; render shows "Loading" until they land.
function ensureFeed(id) {
  const st = P();
  if (st.loading[id]) return;
  const need = [];
  if (S.peopleNotes?.[id] === undefined) need.push(DB.personNotes(id));
  if (S.personTL?.[id] === undefined) need.push(DB.personTimeline(id));
  if (!need.length) return;
  st.loading[id] = true;
  Promise.allSettled(need).then(r => { if (r.some(x => x.status === 'rejected')) st.loadErr = true; hooks.render(); });
}

function header(p) {
  const state = p.has_account ? `Account since ${fmtDate(p.signed_up_at || p.created_at)}`
    : `Contact, ${p.source === 'import' ? `imported${p.source_note ? ' from ' + p.source_note : ''}` : 'added by hand'} on ${fmtDate(p.created_at)}`;
  return `<header class="sp-phead">
    <div class="sp-pname"><h1>${esc(personName(p))}</h1>${iconBtn('ellipsis', `More actions for ${personName(p)}`, { 'data-pp': 'more', 'aria-haspopup': 'dialog' })}</div>
    ${isTwo() ? '' : `<p class="sp-reach"><a href="mailto:${esc(p.email)}">${esc(p.email)}</a>${p.phone ? ` · ${hasMouse() ? `<span class="sp-num">${esc(p.phone)}</span> <button type="button" class="linkbtn sp-copy" data-pp="copyphone">Copy<span class="sr"> the phone number</span></button>` : `<a href="tel:${esc(tel(p))}">${esc(p.phone)}</a>`}` : ''}</p>`}
    <p class="meta">${esc(state)}</p>
  </header>`;
}
function actions(p) {
  const tile = (ic, label, a) => `<${a.href ? `a href="${esc(a.href)}"` : 'button type="button"'} class="sp-act"${Object.entries(a).filter(([k]) => k !== 'href').map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${icon(ic)}<span>${label}</span></${a.href ? 'a' : 'button'}>`;
  return `<div class="sp-acts4" role="group" aria-label="Contact ${esc(personName(p))}">
    ${tile('mail', 'Email', { href: `mailto:${p.email}` })}
    ${!p.phone ? tile('phone', 'Call', { 'data-pp': 'nophone', 'aria-disabled': 'true' }) : hasMouse() ? tile('copy', 'Copy number', { 'data-pp': 'copyphone' }) : tile('phone', 'Call', { href: `tel:${tel(p)}` })}
    ${tile('calendar-plus', 'Follow up', { 'data-pp': 'fup' })}
    ${tile('notebook-pen', 'Note', { 'data-pp': 'note' })}
  </div>`;
}
// What they can be emailed, in words: "Action alerts on · Hearing alerts off · Still subscribed"
function consent(p) {
  return `<div class="chips sp-consent" aria-label="Email permissions">
    ${chip(p.action_optin ? 'Action alerts on' : 'Action alerts off', '', p.action_optin ? 'bell' : 'bell-off')}
    ${chip(p.hearing_optin ? 'Hearing alerts on' : 'Hearing alerts off', '', p.hearing_optin ? 'bell' : 'bell-off')}
    ${p.bounced_at ? chip(`Email bounced ${fmtDate(p.bounced_at)}`, '', 'triangle-alert') : p.unsubscribed_at ? chip(`Unsubscribed ${fmtDate(p.unsubscribed_at)}`, '', 'circle-x') : chip('Still subscribed', '', 'mail-check')}
  </div>`;
}
function followups(p) {
  const list = (S.followups || []).filter(f => f.person_id === p.id && !f.done_at).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
  if (!list.length) return '';
  return `<section class="sp-sec" aria-labelledby="sp-h-fup"><div class="sechead"><h2 id="sp-h-fup">Follow-ups</h2></div>
    <ul class="rows sp-fups">${list.map(f => {
      const late = f.due && dueAt(f) < Date.now(), today = f.due && String(f.due).slice(0, 10) === hiToday();
      const when = !f.due ? '' : late ? `<span class="sv-count late">${icon('circle-alert')}Overdue, was due ${esc(fmtDate(f.due))}</span>` : today ? `<span class="sv-count soon">${icon('clock')}Due today</span>` : `due ${esc(fmtDT(dueAt(f)).replace(/,.*$/, ''))}`;
      return `<li class="sp-fup"><div class="body"><span class="title">${esc(f.what)}</span><span class="sub">${esc(f.advocate_id === S.me?.id ? 'You' : firstName(advocate(f.advocate_id)))}${when ? ' · ' : ''}${when}</span></div>${btn('Done', { kind: 'secondary', sm: true, icon: 'check', attrs: { 'data-fdone': String(f.id), 'aria-label': `Done: ${f.what}` } })}</li>`;
    }).join('')}</ul></section>`;
}
function about(p) {
  const dd = (k, v) => `<div class="sp-kv"><dt>${k}</dt><dd>${v}</dd></div>`;
  const none = t => `<span class="muted">${t}</span>`;
  return `<section class="sp-sec" aria-labelledby="sp-h-about"><div class="sechead"><h2 id="sp-h-about">About</h2>${btn('Edit', { kind: 'text', sm: true, icon: 'square-pen', attrs: { 'data-pp': 'edit' } })}</div>
    <dl class="card sp-about">
      ${dd('Where', whereOf(p) ? esc(whereOf(p)) : `${none('No districts yet.')} <button type="button" class="linkbtn" data-pp="dist">Find them from an address</button>`)}
      ${dd('Interests', (p.interests || []).map(k => esc(intLabel(k))).join(' · ') || none('None noted'))}
      ${dd('Tags', (p.tags || []).length ? `<span class="chips">${p.tags.map(t => chip(t, '', 'tag')).join('')}</span>` : none('None'))}
      ${dd('Emails', p.emails_sent ? `${plural(p.emails_sent, 'email')} sent · ${p.emails_opened || 0} opened · ${p.emails_clicked || 0} clicked` : none('None sent yet'))}
      ${dd('Actions', p.actions ? `${plural(p.actions, 'action')}${p.testimonies ? `, ${plural(p.testimonies, 'testimony', 'testimonies')}` : ''}` : none('None yet'))}
      ${dd('Engagement', `${p.score || 0} <span class="meta">One point per bill followed, 5 per action, 2 per click, a quarter per open</span>`)}
    </dl></section>`;
}
// Where a supporter said they stand on a bill they follow. Backend migration 056 put it on watchlist.stance; it
// reaches this page only once people_overview carries it (the exact query change is in the handover report), and no
// second Supabase call is made for it. Until it lands every row reads as "followed, nothing said", which is also how
// a real follow with no stance looks, so the section is right either way.
const STANCE = { support: ['thumbs-up', 'Supports'], oppose: ['thumbs-down', 'Opposes'], unsure: ['circle-help', 'Not sure'] };
const ownStance = (p, b) => { const all = p.bill_stances; if (!all || typeof all !== 'object') return null; const k = all[b.id] ?? all[b.bill_number]; return STANCE[k] ? k : null; };
// The icon and the word together, never the colour on its own.
const stanceChip = k => `<span class="sp-st sp-st-${k}">${icon(STANCE[k][0])}<span>${STANCE[k][1]}</span></span>`;

function follows(p) {
  const st = P(), bills = (p.bill_ids || []).map(billById).filter(Boolean).sort((a, b) => (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number));
  const lists = (p.list_ids || []).map(id => (S.lists || []).find(l => l.id === id)).filter(Boolean);
  // What they follow first (R-018): whole categories and issues; the bills below are the ones they followed on their own.
  const cats = (p.category_keys || []).map(catByKey).filter(Boolean), iss = (p.issue_ids || []).map(issueById).filter(i => i && !i.archived_at);
  const firstN = isTwo() ? 8 : BILLS_FIRST;
  const said = k => bills.filter(b => ownStance(p, b) === k).length;
  const stanceHead = [said('support') && `${said('support')} for`, said('oppose') && `${said('oppose')} against`, said('unsure') && `${said('unsure')} unsure`].filter(Boolean).join(', ');
  const showAll = st.billsAll[p.id] || bills.length <= firstN + 1, head = [cats.length && plural(cats.length, 'whole category', 'whole categories'), iss.length && plural(iss.length, 'issue'), bills.length && plural(bills.length, 'bill'), lists.length && plural(lists.length, 'list'), stanceHead].filter(Boolean).join(' · ');
  // A bill with a nickname leads with it (billRow); its plain summary is the second line, so the bill is still
  // explained. Their own stance goes in front of it: on this page that is the thing a staffer came to read.
  const sum = b => { const k = ownStance(p, b); return `${k ? stanceChip(k) : ''}${b.nickname ? esc(blurb(b, 140)) : ''}`; };
  return `<section class="sp-sec" aria-labelledby="sp-h-fol"><div class="sechead"><h2 id="sp-h-fol">Follows</h2><span class="meta">${head || 'Nothing yet'}</span></div>
    ${cats.length || iss.length ? `<div class="chips sp-lists sp-issues">${cats.map(c => `<a class="chip sp-listchip" href="#/outreach/issues">${icon(c.icon || 'tag')}All of ${esc(c.name)}</a>`).join('')}${iss.map(i => `<a class="chip sp-listchip" href="#/issue/${encodeURIComponent(i.id)}">${icon('tag')}${esc(i.name)}</a>`).join('')}</div>` : ''}
    ${lists.length ? `<div class="chips sp-lists">${lists.map(l => `<a class="chip sp-listchip" href="#/list/${encodeURIComponent(l.id)}">${icon('list')}${esc(l.title)}</a>`).join('')}</div>` : ''}
    ${bills.length ? `<div class="rows sp-fbills">${(showAll ? bills : bills.slice(0, firstN)).map(b => billRow(b, { href: `#/bill/${b.bill_number}`, sub: sum(b), cls: b.nickname ? 'sp-nick' : '' })).join('')}
      ${showAll ? '' : `<button type="button" class="row sp-showall" data-pp="billsall">${icon('chevron-down')}<span>Show all ${bills.length} bills</span></button>`}</div>`
      : `<p class="muted sp-none">${lists.length || iss.length || cats.length ? 'No bills followed on their own.' : 'Not following any issue, bill or list yet.'}</p>`}
  </section>`;
}
function feed(p) {
  const st = P(), notes = S.peopleNotes?.[p.id], tl = S.personTL?.[p.id];
  const loading = notes === undefined || tl === undefined;
  const items = [...(tl || []).map(e => ({ t: e.at, e })), ...(notes || []).map(n => ({ t: n.created_at, n }))].sort((a, b) => new Date(b.t) - new Date(a.t));
  // Desktop: the feed can be narrowed to one kind of thing ("what did they do?" is the usual question).
  const kindOf = x => x.n ? 'notes' : x.e.kind === 'action' ? 'actions' : ['email', 'open', 'click', 'bounce', 'unsubscribe'].includes(x.e.kind) ? 'emails' : x.e.kind === 'follow' ? 'follows' : 'other';
  const counts = items.reduce((m, x) => { const k = kindOf(x); m[k] = (m[k] || 0) + 1; return m; }, {});
  const tabs = [['all', 'All', items.length], ['actions', 'Actions', counts.actions || 0], ['emails', 'Emails', counts.emails || 0], ['follows', 'Follows', counts.follows || 0], ['notes', 'Notes', counts.notes || 0]];
  let fk = isTwo() ? st.feedKind?.[p.id] || 'all' : 'all'; if (fk !== 'all' && !counts[fk]) fk = 'all';
  const filtered = fk === 'all' ? items : items.filter(x => kindOf(x) === fk);
  const filterRow = isTwo() && items.length > 3 ? `<div class="chips sp-fkinds" role="group" aria-label="Show">${tabs.filter(([k, , n]) => k === 'all' || n).map(([k, l, n]) => `<button type="button" class="chip" data-fkind="${k}" aria-pressed="${fk === k}">${fk === k ? icon('check') : ''}${l}<span class="sp-cn">${n}</span></button>`).join('')}</div>` : '';
  const all = st.feedAll[p.id], list = all ? filtered : filtered.slice(0, FEED_STEP);
  const li = x => {
    if (x.n) {
      const mine = x.n.advocate_id === S.me?.id;
      return `<li class="sp-fi note"><span class="sp-fic" aria-hidden="true">${icon('notebook-pen')}</span><div class="sp-fb"><p class="meta">Team note · ${esc(mine ? 'You' : advocate(x.n.advocate_id)?.full_name || 'Someone')} · ${esc(fmtDate(x.n.created_at))}</p><p class="sp-nbody">${esc(x.n.body)}</p></div>
        ${mine || S.me?.is_admin ? btn('Delete', { kind: 'text', sm: true, attrs: { 'data-ndel': String(x.n.id), 'aria-label': 'Delete this note' } }) : ''}</li>`;
    }
    const b = x.e.bill_id && billById(x.e.bill_id);
    return `<li class="sp-fi"><span class="sp-fic" aria-hidden="true">${icon(KIND_ICON[x.e.kind] || 'circle-dot')}</span><div class="sp-fb"><p>${b ? `<a href="#/bill/${esc(b.bill_number)}">${esc(x.e.label)}</a>` : esc(x.e.label)}</p><p class="meta">${esc(fmtDate(x.e.at))}</p></div></li>`;
  };
  return `<section class="sp-sec" aria-labelledby="sp-h-feed"><div class="sechead"><h2 id="sp-h-feed">Activity</h2><span class="meta">Notes are for the team only</span></div>
    ${loading ? skeleton(2).replace('skelpage', 'skelpage sp-feedload') : st.loadErr && !items.length ? `<p class="muted sp-none">The activity did not load. Try again later.</p>`
      : items.length ? `${filterRow}<ol class="card sp-feed">${list.map(li).join('')}</ol>${!all && filtered.length > FEED_STEP ? btn(`Show all ${filtered.length}`, { kind: 'text', icon: 'chevron-down', attrs: { 'data-pp': 'feedall' } }) : ''}`
      : `<p class="muted sp-none">Nothing yet. Add a note to start.</p>`}
  </section>`;
}

// ---- desktop side panel: how to reach them, where they are (districts only), what we know about them, what they
// may be sent, and their numbers. It stays in view while the feed scrolls (.sv-cols > .sv-aside in staff.css). ----
function sidePanel(p) {
  const none = t => `<span class="muted">${t}</span>`;
  const line = (ic, html) => `<div class="sp-sl">${icon(ic)}<div class="sp-slb">${html}</div></div>`;
  const copyBtn = (what, label) => btn('Copy', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-pp': what, 'aria-label': label } });
  const phone = p.phone
    ? (hasMouse() ? `<span class="sp-num">${esc(p.phone)}</span>${copyBtn('copyphone', `Copy the phone number ${p.phone}`)}` : `<a href="tel:${esc(tel(p))}">${esc(p.phone)}</a>`)
    : `${none('No phone number yet.')} <button type="button" class="linkbtn" data-pp="edit">Add one</button>`;
  const can = (on, yes, no) => `<li>${icon(on ? 'bell' : 'bell-off')}<span>${on ? yes : no}</span></li>`;
  const kv = (k, v) => `<div class="sp-skv"><dt>${k}</dt><dd>${v}</dd></div>`;
  return `<aside class="sv-aside sp-aside" aria-label="About ${esc(personName(p))}">
    <section class="card sp-sc" aria-labelledby="sp-h-contact"><h2 id="sp-h-contact">Contact</h2>
      ${line('mail', `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>${copyBtn('copyemail', `Copy the email address ${p.email}`)}`)}
      ${line('phone', phone)}
      <div class="sp-sbtns">${btn('Add a note', { sm: true, icon: 'notebook-pen', attrs: { 'data-pp': 'note', 'aria-haspopup': 'dialog' } })}${btn('Follow up', { kind: 'secondary', sm: true, icon: 'calendar-plus', attrs: { 'data-pp': 'fup', 'aria-haspopup': 'dialog' } })}</div>
    </section>
    <section class="card sp-sc" aria-labelledby="sp-h-where"><div class="sp-sch"><h2 id="sp-h-where">Where</h2>${btn(whereOf(p) ? 'Change' : 'Find districts', { kind: 'text', sm: true, icon: 'map-pin', attrs: { 'data-pp': 'dist', 'aria-haspopup': 'dialog' } })}</div>
      ${whereOf(p) ? `<dl class="sp-sdl">${kv('Island', p.island ? esc(p.island) : none('Not known'))}${kv('Senate', p.senate_district ? `District ${esc(p.senate_district)}` : none('Not known'))}${kv('House', p.house_district ? `District ${esc(p.house_district)}` : none('Not known'))}</dl>` : `<p class="muted sp-snone">No districts yet.</p>`}
      <p class="meta sp-lock">${icon('lock')}<span>Only districts are kept, never a street address.</span></p>
    </section>
    <section class="card sp-sc" aria-labelledby="sp-h-about"><div class="sp-sch"><h2 id="sp-h-about">About</h2>${btn('Edit', { kind: 'text', sm: true, icon: 'square-pen', attrs: { 'data-pp': 'edit', 'aria-haspopup': 'dialog' } })}</div>
      <dl class="sp-sdl">${kv('Tags', (p.tags || []).length ? `<span class="chips">${p.tags.map(t => chip(t, '', 'tag')).join('')}</span>` : none('None'))}
        ${kv('Interests', (p.interests || []).map(k => esc(intLabel(k))).join(' · ') || none('None noted'))}</dl>
    </section>
    <section class="card sp-sc" aria-labelledby="sp-h-consent"><h2 id="sp-h-consent">What they can be sent</h2>
      <ul class="sp-can">${can(p.action_optin, 'Action alerts: yes', 'Action alerts: no')}${can(p.hearing_optin, 'Hearing alerts: yes', 'Hearing alerts: no')}
        <li>${p.bounced_at ? `${icon('triangle-alert')}<span><b>Email bounced</b> ${esc(fmtDate(p.bounced_at))}</span>` : p.unsubscribed_at ? `${icon('circle-x')}<span><b>Unsubscribed</b> ${esc(fmtDate(p.unsubscribed_at))}</span>` : `${icon('mail-check')}<span>Still subscribed</span>`}</li></ul>
    </section>
    <section class="card sp-sc" aria-labelledby="sp-h-num"><h2 id="sp-h-num">So far</h2>
      <dl class="sp-sdl">${kv('Emails', p.emails_sent ? `${plural(p.emails_sent, 'email')} sent · ${p.emails_opened || 0} opened · ${p.emails_clicked || 0} clicked` : none('None sent yet'))}
        ${kv('Actions', p.actions ? `${plural(p.actions, 'action')}${p.testimonies ? `, ${plural(p.testimonies, 'testimony', 'testimonies')}` : ''}` : none('None yet'))}
        ${kv('Score', `${Math.round(p.score || 0)} <span class="meta">1 per bill followed, 5 per action, 2 per click, a quarter per open</span>`)}</dl>
    </section>
  </aside>`;
}

export default {
  tab: 'outreach',
  title: route => { const p = personById(route.id); return p ? personName(p) : 'Supporter'; },
  back: route => ({ href: '#/outreach', label: FROM[route.q?.from] || 'Supporters' }),
  render(route) {
    const id = route.id, p = personById(id), st = P();
    if (!p) {
      // Live: fetch just this person first (fast), not the whole list of up to 5,000.
      if (!DEMO && !st.tried?.[id]) {
        (st.tried ??= {})[id] = true;
        DB.ensurePerson(id).then(() => hooks.render()).catch(() => hooks.render());
        return `<div class="sp-person">${skeleton(4)}</div>`;
      }
      return `<div class="sp-person">${empty({ title: 'This person is not in Supporters', text: 'They may have been merged into someone else or deleted.', action: btn('Back to Supporters', { href: '#/outreach' }) })}</div>`;
    }
    ensureFeed(p.id);
    const back = this.back(route), backLink = `<a class="sp-deskback" href="${esc(back.href)}" data-back>${icon('chevron-left')}<span>${esc(back.label)}</span></a>`;
    if (isTwo()) return `<div class="sp-person sp-two">${backLink}${header(p)}
      <div class="sv-cols"><div class="sp-main">${followups(p)}${follows(p)}${feed(p)}</div>${sidePanel(p)}</div>
    </div>`;
    return `<div class="sp-person">
      ${backLink}
      ${header(p)}${actions(p)}${consent(p)}${followups(p)}${about(p)}${follows(p)}${feed(p)}
    </div>`;
  },
  wire(route, root) {
    const p = personById(route.id), page = root.querySelector('.sp-person');
    if (!p || !page) return;
    const st = P();
    const on = (sel, fn) => page.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });
    on('[data-pp="more"]', () => moreMenu(p));
    on('[data-pp="nophone"]', () => toast(`No phone number for ${personName(p)} yet. Add one with Edit.`));
    on('[data-pp="copyphone"]', () => copyText(p.phone, `Copied ${p.phone}.`));
    on('[data-pp="copyemail"]', () => copyText(p.email, `Copied ${p.email}.`));
    on('[data-fkind]', el => { (st.feedKind ??= {})[p.id] = el.dataset.fkind; st.feedAll[p.id] = false; const y = scrollY; hooks.render(); scrollTo(0, y); document.querySelector(`.sp-person [data-fkind="${el.dataset.fkind}"]`)?.focus({ preventScroll: true }); });
    on('[data-pp="fup"]', () => followupSheet([p.id]));
    on('[data-pp="note"]', () => noteSheet(p));
    on('[data-pp="edit"]', () => editSheet(p));
    on('[data-pp="dist"]', () => districtSheet(p));
    on('[data-pp="billsall"]', () => { st.billsAll[p.id] = true; hooks.render(); });
    on('[data-pp="feedall"]', () => { st.feedAll[p.id] = true; hooks.render(); });
    on('[data-fdone]', async el => {
      const f = (S.followups || []).find(x => String(x.id) === el.dataset.fdone); if (!f) return;
      el.disabled = true;
      try {
        await DB.doneFollowup(f.id); hooks.render();
        toast('Done.', { ok: true, undo: async () => { await DB.addFollowup(f.person_id, f.advocate_id, f.what, f.due); hooks.render(); toast('The follow-up is back.'); } });
      } catch (e) { el.disabled = false; toast(e, { err: true }); }
    });
    on('[data-ndel]', async el => {
      const ok = await confirmSheet({ title: 'Delete this note?', text: 'The team will not see it again. This cannot be undone.', ok: 'Delete note', danger: true });
      if (!ok) return;
      try { await DB.delPersonNote(el.dataset.ndel, p.id); hooks.render(); toast('Note deleted.'); } catch (e) { toast(e, { err: true }); }
    });
  },
};

// ---- ⋯ menu ----
function moreMenu(p) {
  const admin = !!S.me?.is_admin;
  menuSheet({ title: personName(p), items: [
    { label: 'Edit details', icon: 'square-pen', sub: 'Name, phone, interests, tags', run: () => afterSheet(() => editSheet(p)) },
    { label: 'Find districts from an address', icon: 'map-pin', sub: 'Only the districts are saved, never the address', run: () => afterSheet(() => districtSheet(p)) },
    admin ? { label: 'Merge a duplicate into this person', icon: 'users', sub: 'Their notes, follow-ups, tags and account move here', run: () => afterSheet(() => mergeSheet(p)) } : null,
    admin ? { label: 'Delete this person', icon: 'trash-2', danger: true, run: () => afterSheet(() => deletePerson(p)) } : null,
  ] });
}

// ---- note and edit ----
function noteSheet(p) {
  openSheet({ title: `Note on ${esc(personName(p))}`, size: 'auto',
    body: `<div class="sp-sheet"><div class="field"><label for="sp-nt">Note, for the team only</label><textarea id="sp-nt" rows="4" maxlength="4000" placeholder="e.g. Spoke 3/2. Will testify in person on HB1563." aria-describedby="sp-nterr"></textarea></div><div id="sp-nterr" role="alert"></div></div>`,
    foot: btn('Add note', { icon: 'notebook-pen', attrs: { 'data-go': '1' } }),
    wire: dlg => {
      const t = dlg.querySelector('#sp-nt'), go = dlg.querySelector('[data-go]'); t.focus();
      go.onclick = async () => {
        const body = t.value.trim();
        if (!body) { dlg.querySelector('#sp-nterr').innerHTML = `<p class="inlinemsg">${icon('circle-alert')}Write the note first.</p>`; t.setAttribute('aria-invalid', 'true'); t.focus(); return; }
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { await DB.addPersonNote(p.id, body); closeSheet({ silent: true }); hooks.render(); toast('Note added.', { ok: true }); }
        catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}
function editSheet(p) {
  const known = [...new Set([...(S.people || []).flatMap(x => x.tags || []), ...(p.tags || [])])].sort((a, b) => a.localeCompare(b));
  const mine = new Set(p.tags || []);
  openSheet({ title: 'Edit details', size: 'full',
    body: `<div class="sp-sheet sp-edit">
      <div class="field"><label for="sp-en">Name</label><input id="sp-en" value="${esc(p.name || '')}" maxlength="120" autocomplete="off"></div>
      <div class="field"><label for="sp-ep">Phone</label><input id="sp-ep" type="tel" value="${esc(p.phone || '')}" maxlength="40" placeholder="808-555-0100" autocomplete="off"></div>
      <fieldset><legend>Interests</legend>${INTERESTS.map(([k, l]) => `<label class="check"><input type="checkbox" data-eint="${k}" ${(p.interests || []).includes(k) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</fieldset>
      <fieldset><legend>Tags</legend>${known.length ? `<div class="chips">${known.map(t => `<button type="button" class="chip" data-etag="${esc(t)}" aria-pressed="${mine.has(t)}">${mine.has(t) ? icon('check') : ''}${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="field"><label for="sp-et">Add new tags</label><input id="sp-et" maxlength="200" autocomplete="off" placeholder="e.g. donor, media"><span class="help">Separate tags with commas.</span></div></fieldset>
      ${p.has_account ? `<p class="meta">${esc(personName(p))} has an account and chooses their own alerts.</p>` : switchRow('sp-eopt', 'Opted in to action alerts', !!p.action_alerts, 'For contacts from an older list. People with an account choose this themselves.')}
    </div>`,
    foot: btn('Save', { attrs: { 'data-go': '1' } }),
    wire: dlg => {
      dlg.querySelectorAll('[data-etag]').forEach(b => b.onclick = () => {
        const t = b.dataset.etag; mine.has(t) ? mine.delete(t) : mine.add(t);
        b.setAttribute('aria-pressed', String(mine.has(t))); b.innerHTML = `${mine.has(t) ? icon('check') : ''}${esc(t)}`;
      });
      const go = dlg.querySelector('[data-go]');
      go.onclick = async () => {
        const extra = dlg.querySelector('#sp-et').value.split(/[,;]/).map(x => x.trim()).filter(Boolean);
        const patch = { name: dlg.querySelector('#sp-en').value.trim() || null, phone: dlg.querySelector('#sp-ep').value.trim() || null,
          interests: [...dlg.querySelectorAll('[data-eint]')].filter(el => el.checked).map(el => el.dataset.eint), tags: [...new Set([...mine, ...extra])] };
        const opt = dlg.querySelector('#sp-eopt'); if (opt) patch.action_alerts = opt.checked;
        go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try { await DB.savePerson(p.id, patch); closeSheet({ silent: true }); hooks.render(); toast('Saved.', { ok: true }); }
        catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
    } });
}

// ---- districts from an address: the address is typed, looked up and dropped; only the two districts are saved.
// The sandbox never calls the address service (no network), so there the districts are picked by hand. ----
function districtSheet(p) {
  let sd = p.senate_district || '', hd = p.house_district || '', timer = 0, lastQ = '', results = [];
  const opts = (n, cur, pre) => `<option value="">Not known</option>${Array.from({ length: n }, (_, i) => i + 1).map(x => `<option value="${x}"${+cur === x ? ' selected' : ''}>${pre} ${x}</option>`).join('')}`;
  openSheet({ title: 'Find districts', size: DEMO ? 'auto' : 'full',
    body: `<div class="sp-sheet sp-dist">
      <p class="sp-private">${icon('lock')}<span>Only the districts are saved. The address is not kept or shown.</span></p>
      ${DEMO ? `<p class="notice info sp-demo">${icon('info')}<span>The sandbox does not look up addresses. Pick the districts below.</span></p>`
        : `<div class="field"><label for="sp-da">Street address</label><input id="sp-da" type="search" autocomplete="off" placeholder="e.g. 415 S Beretania St" aria-describedby="sp-dahelp"><span class="help" id="sp-dahelp">Type the street number and name, then pick the match.</span></div>
          <div class="sp-sugs" id="sp-dsugs" aria-live="polite"></div>`}
      <div id="sp-dfound" aria-live="polite"></div>
      <div class="sp-two">
        <div class="field"><label for="sp-dsd">Senate district</label><select id="sp-dsd">${opts(25, sd, 'SD')}</select></div>
        <div class="field"><label for="sp-dhd">House district</label><select id="sp-dhd">${opts(51, hd, 'HD')}</select></div>
      </div>
      <p class="meta" id="sp-disl">${sd ? `Island: ${esc(islandOf(+sd) || 'unknown')}` : ''}</p>
    </div>`,
    foot: `${p.senate_district || p.house_district ? btn('Clear districts', { kind: 'text', attrs: { 'data-dclear': '1' } }) : ''}${btn('Save districts', { attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      const sSel = dlg.querySelector('#sp-dsd'), hSel = dlg.querySelector('#sp-dhd'), isl = dlg.querySelector('#sp-disl'), fnd = dlg.querySelector('#sp-dfound');
      const syncIsland = () => { isl.textContent = sSel.value ? `Island: ${islandOf(+sSel.value) || 'unknown'}` : ''; };
      sSel.onchange = syncIsland;
      const addr = dlg.querySelector('#sp-da'), box = dlg.querySelector('#sp-dsugs');
      if (addr) {
        addr.focus();
        const draw = () => { box.innerHTML = results.map((x, i) => `<button type="button" class="sp-sug" data-dpick="${i}">${icon('map-pin')}<span>${esc(x.label)}</span></button>`).join(''); };
        addr.oninput = () => {
          const q = addr.value; clearTimeout(timer);
          if (!looksLikeAddress(q)) { results = []; box.innerHTML = ''; return; }
          timer = setTimeout(async () => {
            lastQ = q;
            try { const r = await geoSuggest(q); if (lastQ !== q) return; results = r; draw(); if (!r.length) box.innerHTML = '<p class="meta sp-sugnone">No match yet. Keep typing, or pick the districts below.</p>'; }
            catch { box.innerHTML = '<p class="meta sp-sugnone">The lookup did not answer. Pick the districts below.</p>'; }
          }, 250);
        };
        box.addEventListener('click', async e => {
          const b = e.target.closest('[data-dpick]'); if (!b) return;
          const x = results[+b.dataset.dpick]; if (!x) return;
          try {
            const d = await geoDistricts(x);
            // Drop the address as soon as it has done its job.
            addr.value = ''; results = []; box.innerHTML = '';
            if (d.found) { sSel.value = d.senate || ''; hSel.value = d.house || ''; fnd.innerHTML = `<p class="okmsg">${icon('circle-check')}Found Senate ${esc(d.senate ?? '?')} and House ${esc(d.house ?? '?')}.</p>`; }
            else fnd.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}No districts found there. Pick them below.</p>`;
            syncIsland();
          } catch { fnd.innerHTML = `<p class="inlinemsg">${icon('circle-alert')}The lookup did not answer. Pick the districts below.</p>`; }
        });
      }
      const save = async (s, h) => {
        const go = dlg.querySelector('[data-go]'); go.setAttribute('aria-busy', 'true'); go.disabled = true;
        try {
          await DB.savePerson(p.id, { senate_district: s, house_district: h });
          closeSheet({ silent: true }); hooks.render();
          toast(s || h ? `Saved. ${[islandOf(s), s && `SD ${s}`, h && `HD ${h}`].filter(Boolean).join(' · ')}.` : 'Districts cleared.', { ok: true });
        } catch (e) { go.removeAttribute('aria-busy'); go.disabled = false; toast(e, { err: true }); }
      };
      dlg.querySelector('[data-go]').onclick = () => save(sSel.value ? +sSel.value : null, hSel.value ? +hSel.value : null);
      dlg.querySelector('[data-dclear]')?.addEventListener('click', () => save(null, null));
    } });
}

// ---- merge and delete (admins; confirmed in the app) ----
function mergeSheet(p) {
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9@.]/g, '');
  const digits = s => String(s || '').replace(/\D/g, '').slice(-7);
  // Likely duplicates first: the same name, the same phone, or the same email name at another address.
  const likely = () => (S.people || []).filter(x => x.id !== p.id && ((p.name && norm(x.name) === norm(p.name)) || (p.phone && digits(x.phone) && digits(x.phone) === digits(p.phone)) || x.email.split('@')[0].toLowerCase() === p.email.split('@')[0].toLowerCase())).slice(0, 5);
  const likelyHTML = () => { const l = likely(); return l.length ? `<p class="meta sp-mhead">Possible duplicates</p>${rowsFor(l)}` : ''; };
  const rowsFor = list => list.map(x => `<button type="button" class="sp-sug sp-mrow" data-mpick="${esc(x.id)}">${icon('user-round')}<span><b>${esc(personName(x))}</b><span class="meta">${esc(x.email)}${x.has_account ? ' · has an account' : ''}</span></span></button>`).join('');
  openSheet({ title: `Merge into ${esc(personName(p))}`, size: 'full',
    body: `<div class="sp-sheet sp-merge"><p>Pick the duplicate. Its notes, follow-ups, tags and any account move to ${esc(personName(p))}, then the duplicate is deleted.</p>
      <div class="field"><label for="sp-mq">Find the duplicate</label><input id="sp-mq" type="search" autocomplete="off" placeholder="Name or email"></div>
      <div id="sp-mres">${likelyHTML()}</div></div>`,
    wire: dlg => {
      const q = dlg.querySelector('#sp-mq'), res = dlg.querySelector('#sp-mres'); q.focus();
      // Opened straight from a link, only this person may be loaded yet: fetch everyone so the duplicate can be found.
      if (!S.peopleLoaded && !DEMO) { res.innerHTML = '<p class="meta sp-sugnone">Loading everyone…</p>'; DB.loadPeople().then(() => q.oninput()).catch(() => { res.innerHTML = '<p class="meta sp-sugnone">Supporters did not load. Close this and try again.</p>'; }); }
      q.oninput = () => {
        const t = q.value.trim().toLowerCase();
        if (t.length < 2) { res.innerHTML = likelyHTML(); return; }
        const hits = (S.people || []).filter(x => x.id !== p.id && `${x.name || ''} ${x.email}`.toLowerCase().includes(t)).slice(0, 8);
        res.innerHTML = hits.length ? rowsFor(hits) : `<p class="meta sp-sugnone">Nobody else matches “${esc(q.value.trim())}”.</p>`;
      };
      res.addEventListener('click', async e => {
        const b = e.target.closest('[data-mpick]'); if (!b) return;
        const d = personById(b.dataset.mpick); if (!d) return;
        closeSheet({ silent: true }); await new Promise(r => afterSheet(r));
        const ok = await confirmSheet({ title: `Merge ${esc(personName(d))} into ${esc(personName(p))}?`, text: `Everything on ${esc(personName(d))} (${esc(d.email)}) moves to ${esc(personName(p))}, then ${esc(personName(d))} is deleted. This cannot be undone.`, ok: 'Merge', danger: true });
        if (!ok) return;
        try {
          await DB.mergePeople(p.id, d.id);
          // The duplicate's notes and history now belong here: fetch them again (the sandbox keeps its own copy).
          if (!DEMO) { delete S.peopleNotes[p.id]; delete S.personTL[p.id]; P().loading[p.id] = false; }
          hooks.render(); toast(`Merged ${personName(d)} into ${personName(p)}.`, { ok: true });
        }
        catch (x) { toast(x, { err: true }); }
      });
    } });
}
async function deletePerson(p) {
  const ok = await confirmSheet({ title: `Delete ${esc(personName(p))}?`, text: `This removes ${esc(personName(p))} (${esc(p.email)}) from Supporters. Their tracker account, if they have one, is not touched. This cannot be undone.`, ok: 'Delete person', danger: true });
  if (!ok) return;
  try { await DB.deletePerson(p.id); afterSheet(() => { S.go('#/outreach', { replace: true }); toast(`Deleted ${personName(p)}.`); }); }
  catch (e) { toast(e, { err: true }); }
}
