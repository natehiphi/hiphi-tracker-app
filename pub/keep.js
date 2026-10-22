// The share line (R-113): "Know someone who cares about <issue>? Share", shown on the finale and on Home's first-time
// card. Its own module (R-122): Home imported it from start.js, which pulled the whole first visit into every returning
// visit. The keep line ("Keep your issues on any phone or browser", R-123) left both on 10/10 (Nate's (a)): the ending
// and Home lead with email or text. Since R-212 #37 (Nate 10/22, "Build #37 as listed") someone who follows two issues or
// more is offered all of them at once here, "Send my issues to a friend": the same My issues link, put to a friend's use.
import { S, esc, icon, followedIssues, followNames } from './kernel.js';
import { btn } from './ui.js';

// "Know someone who cares about <issue>? Share" (R-113; the one word since R-205 S3): the first followed issue's own share page, at the moment
// people are proud. One line, a text button; nothing else on the finale asks for anything.
export function shareLine(cls = 'st-share') {
  const i = followedIssues()[0]; if (!i) return '';
  if (followedIssues().length > 1 || S.catFollows?.size) { const did = S.chips['share:mine'];
    return `<p class="${cls}">${icon('share-2')}<span>Know someone who’d follow ${esc(followNames().names)} with you? ${btn(did ? 'Copied' : 'Send my issues to a friend', { kind: 'text', sm: true, icon: did ? 'check' : 'share-2', attrs: { 'data-stshare': 'mine' } })}</span></p>`; }
  const did = S.chips['share:' + i.id];
  return `<p class="${cls}">${icon('share-2')}<span>Know someone who cares about ${esc(i.name)}? ${btn(did ? 'Copied' : 'Share', { kind: 'text', sm: true, icon: did ? 'check' : 'share-2', attrs: { 'data-stshare': i.id } })}</span></p>`;
}
export function wireShareLine(root) {
  root.querySelectorAll('[data-stshare]').forEach(el => el.onclick = async () => {
    const mine = el.dataset.stshare === 'mine', i = mine ? null : S.issueById.get(el.dataset.stshare); if (!mine && !i) return;
    // with the bill page's helpers, on first use (R-122)
    const how = mine ? await (await import('./askfriend.js')).askFriend({ mine: true }) : await (await import('./actions.js')).shareIssue(i);
    // The sheet (R-205) said what happened; the button keeps it in a word.
    if (how === 'copied') { S.chips['share:' + (mine ? 'mine' : i.id)] = true; el.innerHTML = `${icon('check')}<span>Copied</span>`; }
    else if (how) el.innerHTML = `${icon('check')}<span>Sent. Mahalo!</span>`;
  });
}
