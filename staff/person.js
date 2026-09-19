// placeholder until the person screen is built
import { esc } from './data.js';
export default { tab: 'outreach', title: () => 'Person', back: () => ({ href: '#/outreach', label: 'Supporters' }), render: route => `<h1>person</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
