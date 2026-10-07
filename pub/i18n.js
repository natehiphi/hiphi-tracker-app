// The tracker in other languages (R-166 step 3; backend docs/LANGUAGES-PLAN.md). Small and with no imports of its own
// beyond the list of live languages, so the kernel, the first screen and every other module can use it.
//
//   t('English words', { n: 3 })   the words of a screen, by their English. In English (and for any word with no passed
//                                  translation) it returns the English with {n} filled in, so the English page is the
//                                  same as before by construction; in another language it returns that language's words
//                                  from pub/words/<code>.js, which the checker panel writes. Pass already-escaped values.
//   tn(n, 'issue')                 "1 issue" / "3 issues"; the two forms are two keys ('{n} issue', '{n} issues').
//   trText(kind, ref, english)     HIPHI's own database text (a bill's nickname or summary, an issue's name and outlook, a
//                                  category's name): the passed translation from public_translations (migration 137), whose
//                                  rows the view already limits to ones whose English is still today's; else the English.
//
// Only passed translations are ever shown (Nate 10/5: until a piece is checked, English). The Legislature's own words
// (titles, bill text, notices, names) and the staff app are never translated; the letter to a lawmaker is sent in English.
import { LIVE } from './words/live.js';

// Each language named in itself (so a person can find theirs): [code, its own name, its English name].
export const LANGS = [['en', 'English', 'English'], ['ilo', 'Ilokano', 'Ilocano'], ['tl', 'Tagalog', 'Tagalog'], ['zh-Hant', '繁體中文', 'Chinese, Traditional'],
  ['zh-Hans', '简体中文', 'Chinese, Simplified'], ['ja', '日本語', 'Japanese'], ['ko', '한국어', 'Korean'], ['haw', 'ʻŌlelo Hawaiʻi', 'Hawaiian']];
export const CODES = LANGS.map(l => l[0]);
export const ownName = c => (LANGS.find(l => l[0] === c) || LANGS[0])[1];
const KEY = 'hiphi_lang';

let cur = 'en', words = null, db = new Map();
const subs = new Set();
export const lang = () => cur;
export const isEn = () => cur === 'en';
// The languages a person can pick: the live ones.
export const offered = () => [...LIVE, ...(globalThis.__HIPHI_LIVE__ || [])].filter(c => CODES.includes(c) && c !== 'en');   // __HIPHI_LIVE__: a test's way to show the picker

const fill = (s, vars) => vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
export function t(en, vars) {
  const s = words && Object.prototype.hasOwnProperty.call(words, en) && typeof words[en] === 'string' && words[en] ? words[en] : en;
  return fill(s, vars);
}
// T marks English words that are said later through t() (a constant, a table, a default): it returns them unchanged, and
// tools/words_extract.mjs lists them for the panel with the t() calls.
export const T = s => s;
export const tn = (n, one, many = one + 's') => t(n === 1 ? '{n} ' + one : '{n} ' + many, { n });

export function trText(kind, ref, english) {
  if (cur === 'en' || !english) return english;
  const x = db.get(kind + '|' + ref);
  return x || english;
}
// Rows from public_translations: { kind, ref, text }. The view returns only passed rows whose English is still today's, so a
// summary staff rewrite is back in English at once.
export function setDbTranslations(rows) {
  db = new Map();
  for (const r of rows || []) if (r && r.kind && r.text) db.set(r.kind + '|' + r.ref, r.text);
}
export const dbCount = () => db.size;

async function loadWords(code) {
  if (code === 'en') { words = null; return; }
  const inj = globalThis.__HIPHI_WORDS__ && globalThis.__HIPHI_WORDS__[code];   // a test, or a preview of words not yet in the repo
  if (inj) { words = inj; return; }
  try { words = (await import(`./words/${code}.js`)).default || null; } catch { words = null; }
}
const stamp = () => { try { document.documentElement.lang = cur; } catch { /* no document */ } };

// Which language to start in: ?lang=<code> (a preview, never saved), else the one this device saved (if it is still live).
// Returns the promise of its words; the app waits for it before the first screen only when the language is not English.
export function initLang() {
  let code = 'en';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && CODES.includes(q)) code = q;
    else { const s = localStorage.getItem(KEY); if (s && offered().includes(s)) code = s; }
  } catch { /* storage blocked: English */ }
  cur = code; stamp();
  return loadWords(code);
}
export async function setLang(code, { save = true } = {}) {
  if (!CODES.includes(code) || code === cur) return;
  await loadWords(code);
  cur = code; db = new Map(); stamp();
  if (save) { try { code === 'en' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, code); } catch { /* ignore */ } }
  subs.forEach(f => f(code));
}
export const onLang = f => { subs.add(f); return () => subs.delete(f); };
