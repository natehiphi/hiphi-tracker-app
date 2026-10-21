// Your letters (R-212 #27): the letters and emails a person sent, listed where they look back on what they did: the
// session page (#/recap, pub/home.js) puts each bill's under its row, and the profile lists them all. The Capitol Regular
// walker could not find a sent letter again once its hearing was past. Each opens in the walkthrough's reader (helper.js
// viewScreen, W1-1): read, copy, email to myself, download. Kept by letters.js, on the device and with the account.
import { app, esc, icon, nick, spaced, dateLong, cmteLabel, anyBill, ensureBill, toast } from './core.js';
import { btn, row } from './ui.js';
import { keptLetters, keepLetter, forgetLetter } from './letters.js';

const slotOf = L => L.kind === 'email' ? 'email:' + L.bill : L.bill;
const STANCE = { support: 'In support', oppose: 'In opposition', comments: 'Comments' };
// An email kept with no words (only the practice copy's sample) cannot be shown as it went: it is listed, not opened.
const opens = L => L.kind !== 'email' || !!String(L.letter || '').trim();
const kindWord = L => L.kind === 'email' ? 'Email' : 'Letter';   // "Your letter" on the session page opens it: one word for it (the critic, 20 Oct)
// To whom, in the words the bill page uses: the hearing's committee, a chair, or their own legislators.
function toWhom(L) {
  const c = L.code ? cmteLabel(L.code) : '';   // "House Health Committee": the short name dropped the chamber
  if (L.kind !== 'email') return c ? `${c} hearing` : '';
  if (L.mode === 'legislators') return 'To your legislators';
  return c ? `To the ${c} chair` : '';
}
// "Thu, Feb 12 · In support · House Health Committee hearing"
export const letterFacts = L => [L.sent ? dateLong(L.sent) : '', STANCE[L.stance] || '', toWhom(L)].filter(Boolean).join(' · ');

// This session's letters for one bill (the session page's row): testimony first, then the email.
export const lettersFor = (billId, yr) => keptLetters().filter(L => L.bill === billId && (!L.yr || !yr || +L.yr === +yr))
  .sort((x, y) => (x.kind === 'email') - (y.kind === 'email'));
// The session page's buttons under a bill's row: "Your letter", "Your email".
export const letterButtons = Ls => Ls.filter(opens).map(L => btn(L.kind === 'email' ? 'Your email' : 'Your letter',
  { kind: 'text', sm: true, icon: L.kind === 'email' ? 'mail' : 'file-text', attrs: { 'data-myl': slotOf(L), 'aria-label': `${L.kind === 'email' ? 'Your email' : 'Your letter'} on ${spaced(L.num)}, sent ${L.sent ? dateLong(L.sent) : ''}` } })).join('');

// The profile's list, newest first. A row opens the letter; the bill's own page is one tap from the reader's bill number.
// Each has its own Delete (R-212 #28): gone at once, here and on the account, with Undo in its place until they leave the
// page (B-5: an Undo, not an "Are you sure?"). gone: this visit's deleted ones, kept in hand for the Undo.
let gone = [];
addEventListener('hashchange', () => { gone = []; });
const what = L => `${L.kind === 'email' ? 'email' : 'letter'} on ${spaced(L.num || '')}`;
// Only the copy kept here goes: sent testimony stays posted, a sent email stays with the people it went to (the critic, 20 Oct:
// "deleted" alone read as if the testimony was withdrawn).
const stays = L => L.kind === 'email' ? 'The people you wrote to still have it.' : 'The Capitol still has the one you sent.';
export function lettersList() {
  const Ls = keptLetters(); if (!Ls.length && !gone.length) return '';
  const undo = gone.map(L => `<div class="notice ok myl-gone" data-myl-gone="${esc(slotOf(L))}">${icon('circle-check')}<div><p>Your copy of the ${esc(what(L))} is deleted. ${esc(stays(L))}</p>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', cls: 'myl-undo', attrs: { 'data-myl-undo': slotOf(L), 'aria-label': `Undo: bring back your copy of the ${what(L)}` } })}</div></div>`).join('');
  const items = Ls.map(L => {
    const name = nick(anyBill(L.bill) || {}) || L.nick || '';
    const title = `${kindWord(L)} on ${esc(spaced(L.num || ''))}${name ? ` <span class="muted">· ${esc(name)}</span>` : ''}`;
    const open = opens(L) ? row({ lead: L.kind === 'email' ? 'mail' : 'file-text', title, sub: esc(letterFacts(L)), attrs: { 'data-myl': slotOf(L) } })
      : `<div class="row myl-flat"><span class="lead">${icon('mail')}</span><span class="body"><span class="title">${title}</span><span class="sub">${esc(letterFacts(L))}</span></span></div>`;
    return `<div class="myl-item">${open}${btn('Delete', { kind: 'text', sm: true, icon: 'trash-2', cls: 'myl-del', attrs: { 'data-myl-del': slotOf(L), 'aria-label': `Delete your copy of the ${what(L)}` } })}</div>`;
  }).join('');
  return `${undo}${items ? `<div class="rows myl-rows">${items}</div>` : ''}`;
}
// Delete and Undo, then the list is drawn again by the page (repaint) and focus lands where the person was.
export function wireDelete(root, repaint) {
  root.querySelectorAll('[data-myl-del]').forEach(b => b.onclick = () => {
    const L = keptLetters().find(x => slotOf(x) === b.dataset.mylDel); if (!L) return;
    forgetLetter(L.bill, L.kind === 'email' ? 'email' : 'testimony');
    gone = [L, ...gone.filter(x => slotOf(x) !== slotOf(L))];
    repaint(`[data-myl-undo="${CSS.escape(slotOf(L))}"]`, `Your copy of the ${what(L)} is deleted. ${stays(L)}`);
  });
  root.querySelectorAll('[data-myl-undo]').forEach(b => b.onclick = () => {
    const L = gone.find(x => slotOf(x) === b.dataset.mylUndo); if (!L) return;
    const { kind, ...rec } = L; keepLetter({ ...rec, ...(kind === 'email' ? { kind } : {}) });
    gone = gone.filter(x => x !== L);
    repaint(`[data-myl="${CSS.escape(slotOf(L))}"], [data-myl-del="${CSS.escape(slotOf(L))}"]`, `Your copy of the ${what(L)} is back.`);
  });
}

// Opens one in the reader. Its bill may not be loaded (a past session's, or one followed no longer): asked for first.
async function openKept(slot) {
  const L = keptLetters().find(x => slotOf(x) === slot); if (!L) return;
  let b = anyBill(L.bill);
  if (!b) { try { b = await ensureBill(L.num, L.yr); } catch { b = null; } }
  if (!b || b.id !== L.bill) { toast('We couldn’t open that letter right now. Try again in a moment.', { err: true }); return; }
  app.openHelper(L.bill, L.h || '', { view: L });
}
export function wireKept(root = document) {
  root.querySelectorAll('[data-myl]').forEach(el => el.onclick = e => { e.preventDefault(); openKept(el.dataset.myl); });
}
// The words for the profile's section, so the page and its test say the same.
// Not "only you can see them": the Capitol posts testimony publicly (Your stories says so just above); only this list is theirs.
export const LETTERS_LEDE = 'The last letter and email you sent on each bill, kept here for you. The Capitol posts testimony publicly; an email went only to the people you wrote to. Open one to read, copy or download it.';
