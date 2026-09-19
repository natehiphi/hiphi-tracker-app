// placeholder until the me screen is built
import { esc } from './data.js';
export default { tab: '', title: () => 'My settings', render: route => `<h1>me</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
