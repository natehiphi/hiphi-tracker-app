// The tab bar of the new public app (R-360 part 4): Home · Bills · This week, each a labelled icon (DESIGN A-6: words with
// every icon, 44px and more to tap). Shown on Home, Bills, This week and the Bill screen; never on Write, Send or Mahalo,
// where the one task has the whole screen (A-3). It is drawn with each screen, after a spacer as tall as the bar, so the
// last lines of a screen are never hidden under it.
import { icon } from '../icons.js';
import { t } from './i18n.js';
import { esc, header } from './bill.js';

const TABS = [['home', '#/', 'house'], ['bills', '#/bills', 'list'], ['week', '#/week', 'calendar']];
export const tabs = cur => `<div class="tabspace" aria-hidden="true"></div><nav class="tabs" aria-label="${esc(t('tabs.label'))}">${TABS.map(([k, href, ic]) =>
  `<a href="${href}" data-tab="${k}"${k === cur ? ' aria-current="page"' : ''}><span class="pill">${icon(ic, { size: '24px' })}</span><span>${esc(t('tabs.' + k))}</span></a>`).join('')}</nav>`;

// Home is built in the next part. Until then it says so and points to Bills (This week is one/week.js since part 5).
export const soonScreen = k => `${header(null, { slim: true })}<main class="sheet soon" id="main">
  <h1 tabindex="-1">${esc(t(k + '.soon'))}</h1><p class="sum">${esc(t('soon.p'))}</p>
  <p class="more"><a href="#/bills">${esc(t('soon.go'))}${icon('arrow-right', { size: '1em' })}</a></p></main>${tabs(k)}`;
