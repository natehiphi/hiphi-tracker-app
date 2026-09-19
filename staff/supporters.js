// placeholder until the supporters screen is built
import { esc } from './data.js';
export default { tab: 'outreach', title: () => 'Outreach', wide: () => true, render: route => `<h1>supporters</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
