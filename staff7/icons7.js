// The few icons staff7 needs that icons.js (Lucide) does not carry, drawn in Lucide's style, and one helper that draws any of them.
import { ICONS, icon } from '../icons.js';
const EXTRA = {
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  'layout-grid': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
};
Object.assign(ICONS, EXTRA);   // icons.js hands its table out, so icon() finds ours too, without a change to that file
export const ic = (name, cls = '') => icon(name, { size: '20', cls });
