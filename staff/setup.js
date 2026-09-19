// placeholder until the setup screen is built
import { esc } from './data.js';
export default { tab: '', title: () => 'Session setup', render: route => `<h1>setup</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
