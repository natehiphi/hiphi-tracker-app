// The organisation's name, street address and website, small at the end of every page's content (R-402). Drawn once, by the frame
// (app.js render), never by a screen, so every layout (today's, v2, v3, rec) gets exactly one. Proper nouns and an address are not
// translated, so these words do not go through t(). Left off the first visit (R-265: its steps fit the window with nothing to scroll).
import { icon } from './kernel.js';   // R-406: the app's leaving-the-app arrow after the site name (kernel.js is already on the first load)
export const ORG_NAME = 'Hawaiʻi Public Health Institute';
export const ORG_ADDRESS = '707 Richards Street, Suite 300, Honolulu, HI 96813';
export const ORG_SITE = 'https://www.hiphi.org/';
// R-406: the arrow is aria-hidden (icon() draws it so) and the new-tab warning is a screen-reader-only span, so the words stay "hiphi.org".
export const orgFoot = () => `<footer class="orgfoot"><span class="of-name">${ORG_NAME}</span> <address class="of-addr">${ORG_ADDRESS}</address> <a class="of-site" href="${ORG_SITE}" target="_blank" rel="noopener">hiphi.org${icon('external-link')}<span class="sr"> (opens in a new tab)</span></a></footer>`;
