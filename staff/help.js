// placeholder until the help screen is built
import { esc } from './data.js';
export default { tab: '', title: () => 'Help', render: route => `<h1>help</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
