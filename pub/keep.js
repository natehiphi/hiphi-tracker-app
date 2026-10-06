// The share line and the keep line (R-113, R-123, R-125): "Know someone who cares about <issue>? Send it" and "Keep your
// issues on any phone or browser", shown on the finale and on Home's first-time card. Their own module (R-122): Home
// imported them from start.js, which pulled the whole first visit and its lessons into every returning visit.
import { S, esc, icon, toast, issuesLink, calendarUrl, followedIssues } from './kernel.js';
import { btn } from './ui.js';
import { logAct } from './visitlog.js';

// "Know someone who cares about <issue>? Send it" (R-113): the first followed issue's own share page, at the moment
// people are proud. One line, a text button; nothing else on the finale asks for anything.
export function shareLine(cls = 'st-share') {
  const i = followedIssues()[0]; if (!i) return '';
  const did = S.chips['share:' + i.id];
  return `<p class="${cls}">${icon('share-2')}<span>Know someone who cares about ${esc(i.name)}? ${btn(did ? 'Link copied' : 'Send it', { kind: 'text', sm: true, icon: did ? 'check' : '', attrs: { 'data-stshare': i.id } })}</span></p>`;
}
// "Keep your issues on any phone": the My issues link (R-123) and, for a followed issue, its calendar feed (R-125).
// Copy, or text it to yourself (an sms: link with the body filled in; the phone's own app sends it).
export function keepLine(cls = 'st-keep') {
  const link = issuesLink(); if (!link) return '';
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(navigator.userAgent);
  const i = followedIssues()[0], cal = i ? calendarUrl(i) : '';
  // Short button labels: a label that names the issue ran past a phone's edge and the finale's own button missed its tap.
  return `<p class="${cls}">${icon('link')}<span>${inApp ? 'You’re in an app’s own browser, which forgets. ' : ''}Keep your issues on any phone or browser: ${btn(S.chips['keep'] ? 'Link copied' : 'Copy my issues link', { kind: 'text', sm: true, icon: S.chips['keep'] ? 'check' : '', attrs: { 'data-stkeep': 'copy' } })}<span class="kp-dot" aria-hidden="true"> · </span>${btn('Text it to myself', { kind: 'text', sm: true, href: `sms:?&body=${encodeURIComponent('My issues on HIPHI’s Bill Tracker: ' + link)}`, attrs: { 'data-stkeep': 'sms' } })}${cal ? `<br>Hearings on ${esc(i.name)}: ${btn('Add to my calendar', { kind: 'text', sm: true, icon: 'calendar-plus', href: cal, attrs: { 'data-stkeep': 'cal' } })}` : ''}</span></p>`;
}
export function wireKeepLine(root) {
  root.querySelectorAll('[data-stkeep]').forEach(el => el.onclick = async e => {
    const k = el.dataset.stkeep;
    if (k === 'copy') { e.preventDefault(); try { await navigator.clipboard.writeText(issuesLink()); S.chips['keep'] = true; el.innerHTML = `${icon('check')}<span>Link copied</span>`; } catch { toast('Could not copy. Use "Text it to myself" instead.'); } }
    else if (k === 'cal') logAct('calendar');
  });
}
export function wireShareLine(root) {
  root.querySelectorAll('[data-stshare]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.stshare); if (!i) return;
    const { shareIssue } = await import('./actions.js');   // with the bill page's helpers, on first use (R-122)
    const how = await shareIssue(i);
    if (how === 'copied') { S.chips['share:' + i.id] = true; el.innerHTML = `${icon('check')}<span>Link copied</span>`; }
    else if (how === 'shared') el.innerHTML = `${icon('check')}<span>Sent. Mahalo!</span>`;
  });
}
