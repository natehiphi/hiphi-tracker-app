// Your letters (R-212 #27): the letters and emails a person sent, listed where they look back on what they did: the
// session page (#/recap, pub/home.js) puts each bill's under its row, and the profile lists them all. The Capitol Regular
// walker could not find a sent letter again once its hearing was past. Each opens in the walkthrough's reader (helper.js
// viewScreen, W1-1): read, copy, email to myself, download. Kept by letters.js, on the device and with the account.
import { app, esc, icon, nick, spaced, dateLong, cmteLabel, anyBill, ensureBill, toast } from './core.js';
import { btn, row } from './ui.js';
import { keptLetters } from './letters.js';

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
export function lettersList() {
  const Ls = keptLetters(); if (!Ls.length) return '';
  return `<div class="rows myl-rows">${Ls.map(L => {
    const name = nick(anyBill(L.bill) || {}) || L.nick || '';
    const title = `${kindWord(L)} on ${esc(spaced(L.num || ''))}${name ? ` <span class="muted">· ${esc(name)}</span>` : ''}`;
    return opens(L) ? row({ lead: L.kind === 'email' ? 'mail' : 'file-text', title, sub: esc(letterFacts(L)), attrs: { 'data-myl': slotOf(L) } })
      : `<div class="row myl-flat"><span class="lead">${icon('mail')}</span><span class="body"><span class="title">${title}</span><span class="sub">${esc(letterFacts(L))}</span></span></div>`;
  }).join('')}</div>`;
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
