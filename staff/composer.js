// placeholder until the composer screen is built
import { esc } from './data.js';
// placeholder: M7 replaces this with the rendered email (subject, ask, body, button, footer)
export const emailPreview = a => `<div class="card"><b>${esc(a.subject || '')}</b><p>${esc(a.body || '')}</p></div>`;
export default { tab: 'outreach', tabs: false, title: () => 'Email', back: () => ({ href: '#/outreach/emails', label: 'Emails' }), render: route => `<h1>composer</h1><p>${esc(JSON.stringify(route))}</p>`, wire() {} };
