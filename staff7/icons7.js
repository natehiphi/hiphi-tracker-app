// The few icons staff7 needs that icons.js (Lucide) does not carry, drawn in Lucide's style, and one helper that draws any of them (an unknown name draws a plain circle).
import { ICONS, icon } from '../icons.js';
const EXTRA = {
  'chevrons-up-down': '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
};
Object.assign(ICONS, EXTRA);   // icons.js hands its table out, so icon() finds ours too, without a change to that file
export const ic = (name, cls = '') => icon(typeof name === 'string' && Object.hasOwn(ICONS, name) ? name : 'circle', { size: '20', cls: /^[\w -]*$/.test(cls) ? cls : '' });
