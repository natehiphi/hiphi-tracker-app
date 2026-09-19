// placeholder until the list screen is built
import { esc } from './data.js';
export default { tab: 'outreach', title: () => 'List', back: () => ({ href: '#/outreach/lists', label: 'Lists' }), render: route => `<h1>list</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
