// The share line (R-113): "Know someone who cares about <issue>? Share", shown on the finale and on Home's first-time
// card. Its own module (R-122): Home imported it from start.js, which pulled the whole first visit into every returning
// visit. The keep line ("Keep your issues on any phone or browser", R-123) left both on 10/10 (Nate's (a)): the ending
// and Home lead with email or text, and the My issues link stays only under More.
import { S, esc, icon, followedIssues } from './kernel.js';
import { btn } from './ui.js';

// "Know someone who cares about <issue>? Share" (R-113; the one word since R-205 S3): the first followed issue's own share page, at the moment
// people are proud. One line, a text button; nothing else on the finale asks for anything.
export function shareLine(cls = 'st-share') {
  const i = followedIssues()[0]; if (!i) return '';
  const did = S.chips['share:' + i.id];
  return `<p class="${cls}">${icon('share-2')}<span>Know someone who cares about ${esc(i.name)}? ${btn(did ? 'Copied' : 'Share', { kind: 'text', sm: true, icon: did ? 'check' : 'share-2', attrs: { 'data-stshare': i.id } })}</span></p>`;
}
export function wireShareLine(root) {
  root.querySelectorAll('[data-stshare]').forEach(el => el.onclick = async () => {
    const i = S.issueById.get(el.dataset.stshare); if (!i) return;
    const { shareIssue } = await import('./actions.js');   // with the bill page's helpers, on first use (R-122)
    const how = await shareIssue(i);
    // The sheet (R-205) said what happened; the button keeps it in a word.
    if (how === 'copied') { S.chips['share:' + i.id] = true; el.innerHTML = `${icon('check')}<span>Copied</span>`; }
    else if (how) el.innerHTML = `${icon('check')}<span>Sent. Mahalo!</span>`;
  });
}
