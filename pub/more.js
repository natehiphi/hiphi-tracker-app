// placeholder until the more screen is built
import { esc } from './core.js';
export default { tab: 'more', render: route => `<h1>more</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
