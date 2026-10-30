// This week's asks (#/week; R-212 #36, the Neighborhood Captain and the Partner Staffer of the 8 Oct walks).
// A person comes here to pick this week's asks and pass them on: to a group chat, a church bulletin, a partner's newsletter
// (B-1). Staff have had the same list since R-132 (Staff v2 > Today > "This week's asks", staff/today.js weekAsks); the walks
// found it was a door only staff held, so a captain retyped Home's cards one by one and a partner could not get it at all.
// The same rule as staff's: every public bill HIPHI takes a stand on (not one it only watches: R-101, no ask without a
// position) whose testimony closes in the next seven days, one row a bill (its soonest deadline), soonest first. Nothing
// here is personal: everyone sees the same list, so the page's own link can be passed on too.
// Each row opens the bill, and its Share opens the ask-a-friend sheet for that bill's testimony (askfriend.js). Under the list
// the whole week as one message they can change, with one button to copy it (A-20: the one filled button). Its links are the
// bills' share pages tagged ?via=week, so arrivals from a passed-on list are counted apart from one-to-one shares (R-113).
import { S, app, esc, icon, nick, blurb, spaced, billPath, alive, posInfo, hearingWhen, dueWords, sessionInfo, billShareUrl, loadPool, DEMO, timed } from './core.js';
import { btn, skeleton, loadFail } from './ui.js';
import { recHead, recBack, recSec, recEmpty, recFold, wireKit, keep, BOX } from './rec/kit.js';

const DAY = 864e5;
const W = S.wk ??= { busy: false, err: false, said: '', off: new Set() };   // off: bills left out of the message (ids), for the visit

// The asks: { b, h, due } soonest first.
export function weekAsks(now = Date.now()) {
  const pool = S.pool || { bills: [], hearings: [] }, end = now + 7 * DAY, best = new Map();
  for (const h of pool.hearings) {
    if (h.status === 'cancelled' || !h.testimony_deadline) continue;
    const due = Date.parse(h.testimony_deadline); if (!(due > now) || due > end) continue;
    const b = pool.bills.find(x => x.id === h.bill_id);
    if (!b || !alive(b) || !b.hiphi_position || b.hiphi_position === 'monitor') continue;
    if (!best.has(b.id) || due < best.get(b.id).due) best.set(b.id, { b, h, due });
  }
  return [...best.values()].sort((x, y) => x.due - y.due || x.b.bill_number.localeCompare(y.b.bill_number));
}

const nameOf = b => nick(b) || blurb(b, 80);
const named = b => nick(b) ? `${nick(b)} (${spaced(b.bill_number)})` : spaced(b.bill_number);
// ?via= goes before the address's #/ part (actions.js withVia's rule).
const via = u => { const i = u.indexOf('#'), base = i < 0 ? u : u.slice(0, i); return `${base}${base.includes('?') ? '&' : '?'}via=week${i < 0 ? '' : u.slice(i)}`; };
export const pageUrl = () => `${location.origin}${location.pathname}${DEMO ? location.search : ''}#/week`;

// The message: read later, in a chat or a newsletter, so each deadline keeps its date (as shareFor's do), and the first
// line says what it is. Each bill is its name, HIPHI's side in the public page's words (posInfo), the deadline and the link:
// twelve bills make a long message for a group chat, so a bill's summary is said only when it has no short name.
export function weekText(items) {
  const n = items.length;
  const head = `This week at the Hawaiʻi Legislature, ${n === 1 ? 'one bill HIPHI takes a stand on needs' : `${n} bills HIPHI takes a stand on need`} testimony from people like us:`;
  const rows = items.map(x => { const what = nick(x.b) ? '' : ` ${blurb(x.b, 110).replace(/([^.!?…])$/, '$1.')}`, side = posInfo(x.b)?.text;
    return `${named(x.b)}:${what}${side ? ` ${side}.` : ''} Testimony is due ${dueWords(x.h.testimony_deadline)}.\n${via(billShareUrl(x.b, 'testify'))}`; });
  return `${head}\n\n${rows.join('\n\n')}\n\nThe tracker walks you through it: about 10 min the first time, about 3 after. This week’s list: ${pageUrl()}`;
}

function row(x) {
  const now = Date.now(), warn = x.due - now < DAY, p = posInfo(x.b);
  return `<li class="rc-frow rc-irow wk-row"><a class="rc-row" href="${esc(billPath(x.b))}"><span class="rc-rtext"><span class="rc-rname">${esc(nameOf(x.b))}</span>
      <span class="rc-rstat${warn ? ' warn' : ''}">${esc(keep(`Testimony due ${hearingWhen(x.h.testimony_deadline)}`))}</span>
      <span class="rc-rpart">${esc(spaced(x.b.bill_number))}${p && x.b.hiphi_position !== 'support' ? ` · ${esc(p.text)}` : ''}</span></span></a>
    <button type="button" class="rc-fpill wk-share" data-wk-share="${esc(x.b.id)}" aria-label="Share ${esc(spaced(x.b.bill_number))} with a friend">${icon('share-2')}<span>Share</span></button></li>`;
}

// The fold says how many are in only once some are left out (A-14: the count is said above it already).
const leftOut = (n, all) => n === all ? '' : `${n} of ${all} in the message`;
const openWords = si => si.nextOpen ? new Date(si.nextOpen + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'long', month: 'long', day: 'numeric' }) : 'January';
function backRow() {
  const prev = history.state?.prev, name = prev && !/^#\/week/.test(prev) ? app.placeName?.(prev) : '';
  return recBack(name ? prev : '#/find', name || 'Find');
}
function load() {
  if (S.pool || W.busy || W.err) return;   // after a failure only Try again asks again (each redraw would otherwise ask)
  W.busy = true; W.err = false;
  // A failed or silent answer is said, with Try again (R-212 #49): the pool used to come back empty and read "No testimony is due".
  timed(loadPool()).catch(e => { console.error(e); W.err = true; }).finally(() => { W.busy = false; app.render(); });
}

function render() {
  load();
  const head = recHead({ title: 'This week’s asks', lede: 'Testimony due in the next 7 days on bills HIPHI takes a stand on.' });
  if (!S.pool) return `<div class="rc wk">${backRow()}${head}${W.err ? loadFail({ what: 'this week’s asks', h: 'h2', align: 'start', retry: { 'data-wk-retry': '' } }) : skeleton(4)}</div>`;
  const si = sessionInfo(), items = si.phase === 'in' ? weekAsks() : [];
  // A group that passes the week on may want the bills on its own site too (R-212 #38, the Partner Staffer).
  const every = `<p class="rc-every">${btn('See every bill HIPHI tracks', { kind: 'text', iconEnd: 'chevron-right', href: '#/allbills' })}</p>
    <p class="rc-every">${btn('Put bills on your website', { kind: 'text', icon: 'code', href: '#/embed' })}</p>`;
  if (!items.length) {
    const why = si.phase !== 'in' ? `The Legislature is on break until ${openWords(si)}. Once hearings start, this page lists each week’s asks.`
      : 'No testimony is due in the next 7 days on the bills HIPHI takes a stand on. New hearings are posted most weekdays, so check back soon.';
    return `<div class="rc wk">${backRow()}${head}${recEmpty(why)}${every}</div>`;
  }
  W.items = items;
  const picked = items.filter(x => !W.off.has(x.b.id)), text = weekText(picked);
  // Which bills go in the message (the Captain's "pick the ones to push"): all of them unless they choose, folded so the
  // page stays one list and one message.
  const pick = recFold('wk-pick', 'Choose the bills', leftOut(picked.length, items.length),
    `<fieldset class="wk-pick"><legend class="sr">Bills in the message</legend>${items.map(x => `<label class="wk-pickrow"><input type="checkbox" data-wk-pick="${esc(x.b.id)}"${W.off.has(x.b.id) ? '' : ' checked'}><span><b>${esc(spaced(x.b.bill_number))}</b> ${esc(nameOf(x.b))}</span></label>`).join('')}</fieldset>`);
  // The page's main act is one tap from arriving (the critic, 21 Oct: under twelve rows the copy was 2,238px down a phone):
  // the filled button copies the message as it stands; the box under the list is for changing it first.
  const top = `<div class="wk-top">${btn(items.length === 1 ? 'Copy it as a message' : `Copy all ${items.length} as one message`, { kind: 'primary', icon: 'copy', attrs: { 'data-wk-copy': '' } })}
    <p class="wk-said" role="status" aria-live="polite">${esc(W.said)}</p></div>`;
  return `<div class="rc wk">${backRow()}${head}${top}
    ${recSec('wk-list-h', items.length === 1 ? 'One bill this week' : `${items.length} bills this week`, `<ul class="rc-rows ${BOX}" role="list">${items.map(row).join('')}</ul>`)}
    ${recSec('wk-copy-h', 'Change the message first', `${pick}<label class="sr" for="wk-text">The message</label><textarea id="wk-text" class="input wk-text" rows="9" spellcheck="true">${esc(text)}</textarea>
      <div class="wk-btns">${btn('Copy the message', { kind: 'secondary', icon: 'copy', attrs: { 'data-wk-copy': '' } })}${btn('Copy this page’s link', { kind: 'text', icon: 'link', attrs: { 'data-wk-link': '' } })}</div>
      <p class="wk-said" role="status" aria-live="polite"></p>`,
      { note: 'Leave bills out, or change the words for your group chat or newsletter.' })}
    ${every}</div>`;
}

async function copy(text, box) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* no permission: select it to copy by hand */ }
  if (box) { box.focus(); box.select(); }
  return false;
}
// The status line beside the button that was pressed (top or bottom), the other one cleared.
function say(words, near) { const all = [...document.querySelectorAll('.wk-said')], el = near?.closest('.wk-top, .rc-sec')?.querySelector('.wk-said') || all[0];
  all.forEach(x => { if (x !== el) x.replaceChildren(); }); if (el) el.textContent = words; }

// The fold's preview line, made when the first bill is left out (kit.js recFold draws none while it is empty).
function foldLine(root) {
  let fp = root.querySelector('[data-rc-fold="wk-pick"] .rc-fp'); if (fp) return fp;
  fp = document.createElement('span'); fp.className = 'rc-fp'; root.querySelector('[data-rc-fold="wk-pick"] .rc-ft')?.after(fp); return fp;
}
function wire() {
  const root = document.querySelector('.wk'); if (!root) return;
  W.said = '';
  root.querySelector('[data-wk-retry]')?.addEventListener('click', () => { W.err = false; app.render(); });
  root.querySelectorAll('[data-wk-share]').forEach(el => el.addEventListener('click', async () => {
    const x = (W.items || []).find(i => i.b.id === el.dataset.wkShare); if (!x) return;
    (await import('./askfriend.js')).askFriend({ b: x.b, h: x.h, ask: 'testify' });
  }));
  wireKit(root);
  // A bill ticked in or out rewrites the message in place. Words the person changed are not lost without a word (B-5):
  // the line under the box says so, with Undo, which puts their words back and the ticks as they were.
  root.querySelectorAll('[data-wk-pick]').forEach(el => el.addEventListener('change', () => {
    const t = root.querySelector('#wk-text'), was = t ? t.value : '', wasOff = new Set(W.off), edited = t && was !== t.dataset.made;
    if (el.checked) W.off.delete(el.dataset.wkPick); else W.off.add(el.dataset.wkPick);
    const items = W.items || [], picked = items.filter(x => !W.off.has(x.b.id));
    if (t) { t.value = picked.length ? weekText(picked) : ''; t.dataset.made = t.value; }
    const fp = foldLine(root); fp.textContent = leftOut(picked.length, items.length);
    say('', t);
    if (edited) { const line = t.closest('.rc-sec').querySelector('.wk-said'); line.textContent = 'Your changes to the words were replaced. ';
      const u = document.createElement('button'); u.type = 'button'; u.className = 'btn text wk-undo'; u.textContent = 'Undo';
      u.onclick = () => { W.off = wasOff; root.querySelectorAll('[data-wk-pick]').forEach(c => { c.checked = !W.off.has(c.dataset.wkPick); });
        const p2 = items.filter(x => !W.off.has(x.b.id)); t.value = was; t.dataset.made = weekText(p2); fp.textContent = leftOut(p2.length, items.length); line.textContent = 'Your words are back.'; t.focus(); };
      line.append(u); }
  }));
  const box = root.querySelector('#wk-text');
  if (box) box.dataset.made = box.value;
  root.querySelectorAll('[data-wk-copy]').forEach(b => b.addEventListener('click', async () => {
    const t = box ? box.value.trim() : ''; if (!t) { say('Tick at least one bill first.', b); return; }
    say(await copy(t, box) ? 'Copied. Paste it into your group chat or newsletter.' : 'Select the message and copy it.', b);
  }));
  root.querySelector('[data-wk-link]')?.addEventListener('click', async e => {
    say(await copy(pageUrl()) ? 'Link copied. Anyone who opens it sees this week’s list.' : `Copy this link: ${pageUrl()}`, e.currentTarget);
  });
}

// It belongs to Find, where it is reached from (R-303's calm pages: the page below a tab lights that tab).
export default { tab: 'find', title: () => 'This week’s asks', render, wire };
