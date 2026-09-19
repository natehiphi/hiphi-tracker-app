// placeholder until the review screen is built
import { esc } from './data.js';
export default { tab: 'today', tabs: false, title: () => 'Review', render: route => `<h1>review</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
