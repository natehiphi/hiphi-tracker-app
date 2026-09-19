// placeholder until the search screen is built
import { esc } from './data.js';
export default { tab: '', title: () => 'Search', render: route => `<h1>search</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
