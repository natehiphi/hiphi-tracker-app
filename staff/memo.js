// placeholder until the memo screen is built
import { esc } from './data.js';
export default { tab: 'bills', title: () => 'Weekly memo', back: () => ({ href: '#/bills', label: 'Bills' }), render: route => `<h1>memo</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
