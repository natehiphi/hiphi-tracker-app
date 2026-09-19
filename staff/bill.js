// placeholder until the bill screen is built
import { esc } from './data.js';
export default { tab: 'bills', title: r => r.num, back: () => ({ href: '#/bills', label: 'Bills' }), render: route => `<h1>bill</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
