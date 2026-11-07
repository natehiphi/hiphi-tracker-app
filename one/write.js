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
import { letterParts, syncLetter } from './letter.js';

const ME_KEY = 'hiphi_me', DRAFT_KEY = 'hiphi_act_drafts';
export const loadMe = () => { try { return JSON.parse(localStorage.getItem(ME_KEY) || '{}') || {}; } catch { return {}; } };
export const saveMe = patch => { try { localStorage.setItem(ME_KEY, JSON.stringify({ ...loadMe(), ...patch })); } catch { /* private mode: the letter still works, it just is not remembered */ } };

// One draft per bill and step (a hearing's testimony, or the email to the chair).
const keyOf = B => `${B.id}|${B.action === 'testimony' && B.hearing ? B.hearing.id : 'email'}`;
let drafts = null;
const allDrafts = () => { if (!drafts) { try { drafts = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') || {}; } catch { drafts = {}; } } return drafts; };
export const keepDraft = (B, x) => { allDrafts()[keyOf(B)] = x; try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(drafts)); } catch { /* kept for this page only */ } };
// The draft for this bill, brought up to date with the person's details and the directory (surnames).
export function draftFor(B, people) {
  const me = loadMe(), x = allDrafts()[keyOf(B)] || { letter: '', built: null, edited: false, own: '' };
  syncLetter(x, letterParts(B, { name: me.name, town: me.town, own: x.own, closing: me.closing }, people));
  keepDraft(B, x);
  return x;
}
export const isMail = B => B.action !== 'testimony' || !B.hearing;

const field = (id, label, value, { hint = '', opt = false, auto = '' } = {}) => `<div class="fld"><label for="${id}">${esc(label)}${opt ? ` <span class="opt">${esc(t('write.optional'))}</span>` : ''}</label>
  <input id="${id}" type="text" value="${esc(value)}"${hint ? ` placeholder="${esc(hint)}"` : ''}${auto ? ` autocomplete="${auto}"` : ''} enterkeyhint="next"></div>`;

export function writeScreen(B, people) {
  const me = loadMe(), x = draftFor(B, people), mail = isMail(B);
  return `${header(B.issue, { slim: true })}
  <main class="sheet write" id="main">
    <p class="kicker"><a href="#/${esc(B.number)}" class="back">${icon('arrow-left', { size: '1em' })}${esc(t('write.back'))}</a></p>
    <h1 tabindex="-1" id="w-h">${esc(mail ? t('write.h.email') : t('write.h.testimony', { name: B.nickname || B.numberSpaced }))}</h1>
    <label for="w-letter" class="sr">${esc(t(mail ? 'write.letter.email' : 'write.letter'))}</label>
    <textarea id="w-letter" class="letter" spellcheck="true">${esc(x.letter)}</textarea>
    <div class="two">${field('w-name', t('write.name'), me.name || '', { auto: 'name' })}${field('w-town', t('write.town'), me.town || '', { auto: 'address-level2' })}</div>
    ${field('w-own', t('write.own'), x.own || '', { hint: t('write.own.hint'), opt: true })}
    <p class="note">${esc(t(mail ? 'write.via.email' : 'write.via'))}${mail ? '' : ' ' + esc(t('write.public'))}</p>
    <div class="cta"><button class="primary" type="button" data-next>${esc(t('write.next'))}${icon('arrow-right')}</button></div>
    ${mail ? '' : `<p class="more"><a href="${esc(B.capitolUrl)}" target="_blank" rel="noopener">${esc(t('write.differ'))}${icon('external-link', { size: '1em' })}</a></p>`}
  </main>`;
}

// The screen's inputs: each detail is kept as it is typed, and the letter follows it.
export function wireWrite(root, B, people, go) {
  const ta = root.querySelector('#w-letter'), name = root.querySelector('#w-name'), town = root.querySelector('#w-town'), own = root.querySelector('#w-own');
  if (!ta) return;
  const x = draftFor(B, people);
  const refresh = () => {
    const me = loadMe();
    syncLetter(x, letterParts(B, { name: me.name, town: me.town, own: x.own, closing: me.closing }, people));
    if (ta.value !== x.letter) ta.value = x.letter;
    keepDraft(B, x);
  };
  ta.addEventListener('input', () => { x.letter = ta.value; x.edited = true; keepDraft(B, x); });
  name.addEventListener('input', () => { saveMe({ name: name.value.trim() }); clearErr(name); refresh(); });
  town.addEventListener('input', () => { saveMe({ town: town.value.trim() }); refresh(); });
  own.addEventListener('input', () => { x.own = own.value; refresh(); });
  root.querySelector('[data-next]').addEventListener('click', () => {
    if (!name.value.trim()) { showErr(name, t('write.noname')); name.focus(); return; }
    x.letter = ta.value; keepDraft(B, x); go('send');
  });
}
function showErr(inp, msg) {
  clearErr(inp);
  inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', inp.id + '-err');
  inp.insertAdjacentHTML('afterend', `<p class="err" id="${inp.id}-err">${icon('circle-alert', { size: '1em' })}${esc(msg)}</p>`);
}
function clearErr(inp) { inp.removeAttribute('aria-invalid'); inp.removeAttribute('aria-describedby'); inp.parentElement.querySelector('.err')?.remove(); }
