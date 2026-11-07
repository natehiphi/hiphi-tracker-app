// The tab bar of the new public app (R-360 part 4): Home · Bills · This week, each a labelled icon (DESIGN A-6: words with
// every icon, 44px and more to tap). Shown on Home, Bills, This week and the Bill screen; never on Write, Send or Mahalo,
// where the one task has the whole screen (A-3). It is drawn with each screen, after a spacer as tall as the bar, so the
// last lines of a screen are never hidden under it.
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { esc } from './bill.js';

const TABS = [['home', '#/', 'house'], ['bills', '#/bills', 'list'], ['week', '#/week', 'calendar']];
export const tabs = cur => `<div class="tabspace" aria-hidden="true"></div><nav class="tabs" aria-label="${esc(t('tabs.label'))}">${TABS.map(([k, href, ic]) =>
  `<a href="${href}" data-tab="${k}"${k === cur ? ' aria-current="page"' : ''}><span class="pill">${icon(ic, { size: '24px' })}</span><span>${esc(t('tabs.' + k))}</span></a>`).join('')}</nav>`;
