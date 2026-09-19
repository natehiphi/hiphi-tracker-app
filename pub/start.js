// placeholder until the start screen is built
import { esc } from './core.js';
export default { tab: 'home', tabs: false, render: route => `<h1>start</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
