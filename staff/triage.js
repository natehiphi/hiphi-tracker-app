// placeholder until the triage screen is built
import { esc } from './data.js';
export default { tab: 'bills', tabs: false, title: () => 'Sort new bills', back: () => ({ href: '#/bills', label: 'Bills' }), render: route => `<h1>triage</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
