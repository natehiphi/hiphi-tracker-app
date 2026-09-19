// placeholder until the legislators screen is built
import { esc } from './data.js';
export default { tab: 'legislators', title: () => 'Legislators', wide: () => true, render: route => `<h1>legislators</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
