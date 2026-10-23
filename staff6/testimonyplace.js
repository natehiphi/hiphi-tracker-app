// STUB (R-336 FRAME): the Testimony place, so #/testimony?view=write|approve|sent|file|filed|missed opens (spec 3.3, V12).
// The TESTIMONY builder replaces this file. Route: { name: 'testimony', view } (app.js parseRoute). Review mode stays at
// #/review and #/review/<id> (review.js), opened from To approve. Screen module: { render, wire, title, tab }.
import { S, esc } from './data.js';
import { icon, btn, sectionNav } from './ui.js';

const WHAT = {
  write: ['To write', 'The drafts you write, from the day the hearing notice lands: the bill, who approves it and when it is due.'],
  approve: ['To approve', 'Drafts waiting for you, one decision a screen in Review, with Approve and Send back.'],
  sent: ['Sent back', 'Drafts an approver sent back, with their note and who files once it is fixed.'],
  file: ['Ready to file', 'Approved testimony with its filing card: the PDF, the Capitol page for the hearing, the form’s answers to copy, then Mark filed.'],
  filed: ['Filed', 'Every testimony filed, newest first: the library to borrow from.'],
  missed: ['Missed', 'Hearings that passed with nothing filed, recorded without blame.'],
};
const approves = () => !!(S.me?.is_admin || S.me?.can_approve || S.me?.is_reviewer);
export default {
  tab: 'testimony',
  title: () => 'Testimony',
  render(route) {
    const v = WHAT[route.view] ? route.view : approves() ? 'approve' : 'write', [h, text] = WHAT[v];
    return `<div class="v6-stub">
      <h1 class="v6-ptitle sv-h1">Testimony</h1>
      ${sectionNav('testimony', v, { hide: v === 'missed' ? [] : ['missed'] })}
      <div class="card v6-stubcard"><h2>${esc(h)}</h2><p>${esc(text)}</p>
        ${v === 'approve' ? `<div class="btnrow">${btn('Open Review', { kind: 'secondary', icon: 'user-check', href: '#/review' })}</div>` : ''}</div>
      <p class="v6-stubnote">${icon('info')}<span>This place is being built for Staff v6. Each draft still opens from Today and its bill.</span></p>
    </div>`;
  },
  wire() {},
};
