// placeholder until the legislator screen is built
import { esc } from './data.js';
export default { tab: 'legislators', title: () => 'Legislator', back: () => ({ href: '#/legislators', label: 'Legislators' }), render: route => `<h1>legislator</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
