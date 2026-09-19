// placeholder until the home screen is built
import { esc } from './core.js';
export default { tab: 'home', render: route => `<h1>home</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
