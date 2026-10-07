// The language picker (R-166 step 3). Drawn only when at least one language is live (pub/words/live.js): until a language
// has passed the checker panel, a fluent person's grading and a walk of the first-visit script, nobody is offered it. Each
// language is named in itself. It is a plain fold (details) so it needs no sheet and works with a keyboard and a screen reader.
import { t, lang, offered, setLang, LANGS, ownName } from './i18n.js';
import { esc, icon } from './kernel.js';

export const pickerOn = () => offered().length > 0;
export function langPicker(cls = '') {
  if (!pickerOn()) return '';
  const codes = ['en', ...offered()], cur = lang();
  return `<details class="lang-pick ${cls}"><summary aria-label="${esc(t('Language'))}: ${esc(ownName(cur))}">${icon('globe')}<span>${esc(ownName(cur))}</span>${icon('chevron-down', { cls: 'lp-chev' })}</summary>
    <ul class="lp-list" role="list">${codes.map(c => `<li><button type="button" class="lp-opt" lang="${c}" data-lang="${c}" aria-pressed="${c === cur}">${c === cur ? icon('check') : '<span class="lp-gap"></span>'}<span>${esc(ownName(c))}</span></button></li>`).join('')}</ul></details>`;
}
export function wireLangPicker(root = document) {
  root.querySelectorAll('.lang-pick [data-lang]').forEach(b => b.onclick = async () => { await setLang(b.dataset.lang); });
}
