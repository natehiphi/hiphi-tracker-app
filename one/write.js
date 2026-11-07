// Write (R-360 part 2): #/HB2121/write. One screen: the letter in one box, written from HIPHI's position and talking
// points the way the walkthrough writes it (one/letter.js), then the person's name and town and an optional line of
// their own. Until they type in the letter it is rewritten as their details change; once they have, a changed detail
// swaps only its own words (letter.js syncLetter), so a retyped name never loses their edits.
//
// Their name and town are kept in hiphi_me, as the walkthrough keeps them (pub/helper.js saveMe), so the full tracker
// knows them too. The letter itself is kept for this visit (sessionStorage), so Next and Back keep it as they left it.
import { header, esc } from './bill.js';
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { letterParts, syncLetter, wholeLetter, mailTo } from './letter.js';
import { isMail } from './done.js';
import { HST } from './words.js';
export { isMail };

const ME_KEY = 'hiphi_me', DRAFT_KEY = 'hiphi_act_drafts';
export const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
export const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode: the letter still works, it just is not remembered */ } };

// One draft per bill and step (a hearing's testimony, or the email to the chair).
const keyOf = B => `${B.id}|${B.action === 'testimony' && B.hearing ? B.hearing.id : 'email'}`;
let drafts = null;
const allDrafts = () => { if (!drafts) { try { drafts = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { drafts = {}; } } return drafts; };
export const keepDraft = (B, x) => { allDrafts()[keyOf(B)] = x; try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch { /* kept for this page only */ } };
// The letter waiting while the person confirms their email (R-360 part 8, send.js): the link may open in a new tab, which
// has no sessionStorage, so the draft is kept in hiphi_me.actDrafts too (not hiphi_me.drafts: that is the tracker's
// testimony draft, in its own shape). Signing out clears it with the profile (auth.js PROFILE_KEYS).
export const holdDraft = (B, x) => saveMe({ actDrafts: { ...(loadMe().actDrafts || {}), [keyOf(B)]: x } });
export const dropHeld = B => { const d = { ...(loadMe().actDrafts || {}) }; if (!(keyOf(B) in d)) return; delete d[keyOf(B)]; saveMe({ actDrafts: d }); };
// The draft for this bill, brought up to date with the person's details and the directory (surnames).
export function draftFor(B, people) {
  const me = loadMe(), x = allDrafts()[keyOf(B)] || me.actDrafts?.[keyOf(B)] || { head: '', body: '', letter: '', built: null, edited: false, own: '' };
  syncLetter(x, letterParts(B, { name: me.name, town: me.town, own: x.own, closing: me.closing }, people));
  keepDraft(B, x);
  return x;
}

const field = (id, label, value, { hint = '', opt = false, auto = '' } = {}) => `<div class="fld"><label for="${id}">${esc(label)}${opt ? ` <span class="opt">${esc(t('write.optional'))}</span>` : ''}</label>
  <input id="${id}" type="text" value="${esc(value)}"${hint ? ` placeholder="${esc(hint)}"` : ''}${auto ? ` autocomplete="${auto}"` : ''} enterkeyhint="next"></div>`;

// Who the letter goes to, in one quiet line above the box (the full header goes into what is copied and saved):
// "To the two Senate committees · hearing Fri, Mar 20", "To the Senate Health Committee · hearing Fri, Mar 20", or for an
// email "To Sen. Jarrett Keohokalole". Built from the bill's data, so it says what the letter's header says.
const COUNT = ['', 'one', 'two', 'three', 'four'];
function toLine(B, people) {
  if (isMail(B)) { const to = mailTo(B, people).map(c => c.label); return to.length ? t('write.to', { who: to.join(', ') }) : ''; }
  const h = B.hearing, n = h.count || 1;
  const who = h.joint && n > 1 ? t('write.to.many', { count: COUNT[n] || String(n), chamber: h.chamber || '' }).replace(/\s+/g, ' ') : h.label.replace(/^(?!the |a )/, 'the ');
  const date = new Date(h.at).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
  return t('write.to.hearing', { who, date });
}

export function writeScreen(B, people) {
  const me = loadMe(), x = draftFor(B, people), mail = isMail(B), to = toLine(B, people);
  return `${header(B.issue, { slim: true })}
  <main class="sheet write" id="main">
    <p class="kicker"><a href="#/${esc(B.number)}" class="back" data-hist="#/${esc(B.number)}">${icon('arrow-left', { size: '1em' })}${esc(t('write.back'))}</a></p>
    <h1 tabindex="-1" id="w-h">${esc(t(mail ? 'write.h.email' : 'write.h.testimony'))}</h1>
    ${to ? `<p class="toline" id="w-to">${esc(to)}</p>` : ''}
    <label for="w-letter" class="sr">${esc(t(mail ? 'write.letter.email' : 'write.letter'))}</label>
    <textarea id="w-letter" class="letter grow" spellcheck="true"${to ? ' aria-describedby="w-to"' : ''}>${esc(x.body)}</textarea>
    <div class="two">${field('w-name', t('write.name'), me.name || '', { auto: 'name' })}${field('w-town', t('write.town'), me.town || '', { auto: 'address-level2' })}</div>
    ${field('w-own', t('write.own'), x.own || '', { hint: t('write.own.hint'), opt: true })}
    <p class="note">${esc(t(mail ? 'write.via.email' : 'write.public'))}</p>
    <div class="cta"><button class="primary" type="button" data-next>${esc(t('write.next'))}${icon('arrow-right')}</button></div>
    <p class="more"><button type="button" class="text differ" data-differ><span>${esc(t('write.differ'))}</span><span class="sub">${esc(t('write.differ.sub'))}</span></button></p>
  </main>`;
}

// The box is as tall as the letter, so the whole of it reads without a scroll inside a scroll (no fixed height, no grip).
const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; };
let growing = null;
addEventListener('resize', () => { if (growing?.isConnected) grow(growing); });

// The screen's inputs: each detail is kept as it is typed, and the letter follows it.
export function wireWrite(root, B, people, go) {
  const ta = root.querySelector('#w-letter'), name = root.querySelector('#w-name'), town = root.querySelector('#w-town'), own = root.querySelector('#w-own');
  if (!ta) return;
  const x = draftFor(B, people);
  const refresh = () => {
    const me = loadMe();
    syncLetter(x, letterParts(B, { name: me.name, town: me.town, own: x.own, closing: me.closing }, people));
    if (ta.value !== x.body) { ta.value = x.body; grow(ta); }
    keepDraft(B, x);
  };
  grow(ta);
  // The fonts arrive after the first paint and change the letter's height; and a turned phone changes its width.
  document.fonts?.ready.then(() => grow(ta)).catch(() => {});
  growing = ta;
  const typed = () => { x.body = ta.value; x.letter = wholeLetter(x); x.edited = true; keepDraft(B, x); };
  ta.addEventListener('input', () => { typed(); grow(ta); });
  // I see it differently (B-12): the letter's words are HIPHI's view; this empties the box (the header stays, it says what
  // the testimony is for) and puts the cursor there, for the person's own words. x.differ tells the send screen not to name
  // HIPHI's position on the Capitol's form.
  root.querySelector('[data-differ]')?.addEventListener('click', () => { ta.value = ''; typed(); x.differ = true; keepDraft(B, x); grow(ta); ta.focus(); });
  name.addEventListener('input', () => { saveMe({ name: name.value.trim() }); clearErr(name); refresh(); });
  town.addEventListener('input', () => { saveMe({ town: town.value.trim() }); refresh(); });
  own.addEventListener('input', () => { x.own = own.value; refresh(); });
  root.querySelector('[data-next]').addEventListener('click', () => {
    if (!name.value.trim()) { showErr(name, t('write.noname')); name.focus(); return; }
    x.body = ta.value; x.letter = wholeLetter(x); keepDraft(B, x); go('send');
  });
}
function showErr(inp, msg) {
  clearErr(inp);
  inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', inp.id + '-err');
  inp.insertAdjacentHTML('afterend', `<p class="err" id="${inp.id}-err">${icon('circle-alert', { size: '1em' })}${esc(msg)}</p>`);
}
function clearErr(inp) { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); inp.parentElement.querySelector('.err')?.remove(); }
