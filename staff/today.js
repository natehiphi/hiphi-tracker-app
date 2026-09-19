// placeholder until the today screen is built
import { esc } from './data.js';
export default { tab: 'today', title: () => 'Today', badge: () => ({ n: 0, late: false }), render: route => `<h1>today</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
