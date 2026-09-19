// placeholder until the bills screen is built
import { esc } from './data.js';
export default { tab: 'bills', title: () => 'Bills', wide: () => true, render: route => `<h1>bills</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
