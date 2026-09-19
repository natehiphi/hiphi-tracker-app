// #/dev/ui: every shared part in every state, to check the building blocks at 390 and 1440 before screens use them.
import { S, esc } from './data.js';
import { icon, btn, iconBtn, chip, pickerChip, posChip, avatar, countdown, row, billRow, groupHead, segmented, switchRow, field, stepBar, empty, skeleton, notice, inlineErr, toast, pickerSheet, menuSheet, confirmSheet } from './ui.js';
export default {
  tab: '', title: () => 'Parts',
  render() {
    const b = S.bills.find(x => x.priority === 1) || S.bills[0], soon = new Date(Date.now() + 5 * 36e5).toISOString(), later = new Date(Date.now() + 3 * 864e5).toISOString(), late = new Date(Date.now() - 36e5).toISOString();
    return `<div class="stack16">
      <h2>Buttons</h2><div class="btnrow">${btn('Approve')}${btn('Request changes', { kind: 'secondary' })}${btn('Open Doc', { kind: 'text', icon: 'file-text' })}${btn('Delete', { kind: 'danger' })}${btn('Saving', { attrs: { 'aria-busy': 'true' }, icon: 'loader-circle' })}${btn('Disabled', { attrs: { disabled: true } })}${iconBtn('ellipsis', 'More')}</div>
      <h2>Chips</h2><div class="chips">${chip('Neutral')}${chip('Info', 'info', 'info')}${chip('Due soon', 'warn', 'clock')}${chip('Overdue', 'danger', 'circle-alert')}${chip('Filed', 'ok', 'check')}${posChip('strongly_support')}${posChip('oppose')}${posChip('')}${pickerChip('Strong support', { 'data-x': 1 }, 'thumbs-up')}${pickerChip('P1')}</div>
      <h2>People and time</h2><div class="btnrow">${avatar(S.me)}${avatar(S.advocates[1])}${avatar(S.me, 32)}${countdown(later)}${countdown(soon)}${countdown(late)}</div>
      <h2>Rows</h2><div class="rows">${groupHead('Hearing scheduled', 7)}${groupHead('Did not advance', 12, { fold: 'x', open: false })}${billRow(b, { sub: 'Hearing Wed 3/18 · HHS', href: '#/bill/' + b.bill_number })}${billRow(S.bills[3], { sub: 'Selected in select mode', selectable: true, selected: true })}${row({ lead: 'users', title: 'Leilani Kahale', sub: 'Oʻahu · SD 17 · active 3/16', end: '8 actions' })}</div>
      <h2>Controls</h2>${segmented('scope', [['mine', 'Mine'], ['team', 'Team']], 'mine', 'Whose tasks')}
      <div class="card">${switchRow('sw1', 'Slack DM when someone mentions me', true, 'Off means only the in-app list')}${switchRow('sw2', 'Hearing reminders', false)}</div>
      ${field('f1', 'Capitol confirmation link (optional)', '<input id="f1" type="url" placeholder="https://">', 'Paste the link from the green box.')}
      <div class="field"><label for="f2">What should change?</label><textarea id="f2" aria-invalid="true" aria-describedby="f2e"></textarea><span class="err" id="f2e">${icon('circle-alert')}Write a note for Kevin first</span></div>
      <h2>Testimony steps</h2>${stepBar('draft')}${stepBar('review')}${stepBar('second_review', { second: true })}${stepBar('approved')}${stepBar('filed')}
      <h2>Notices</h2>${notice('info', 'info', 'Email is paused. You can write and approve; nothing sends.')}${notice('warn', 'triangle-alert', 'The sync is 9 hours old.', btn('Check', { kind: 'text', sm: true }))}${inlineErr('e1', 'Replace the text in brackets first')}
      <h2>Sheets and toasts</h2><div class="btnrow">${btn('Picker', { kind: 'secondary', attrs: { 'data-dv': 'pick' } })}${btn('Menu', { kind: 'secondary', attrs: { 'data-dv': 'menu' } })}${btn('Confirm', { kind: 'secondary', attrs: { 'data-dv': 'confirm' } })}${btn('Toast with Undo', { kind: 'secondary', attrs: { 'data-dv': 'toast' } })}</div>
      <h2>Empty and loading</h2>${empty({ title: 'All clear for today.', text: 'Next hearing: Wed 3/18, 2:00 PM (HB1870, HHS).', action: btn('See your bills', { href: '#/bills' }) })}${skeleton(2)}
    </div>`;
  },
  wire(route, root) {
    root.querySelector('[data-dv="pick"]').onclick = () => pickerSheet({ title: 'Position', value: 'support', options: [['strongly_support', 'Strong support', 'thumbs-up'], ['support', 'Support', 'thumbs-up'], ['oppose', 'Oppose', 'thumbs-down'], ['monitor', 'Monitor', 'eye']], onPick: v => toast('Saved: ' + v, { ok: true }) });
    root.querySelector('[data-dv="menu"]').onclick = () => menuSheet({ items: [{ label: 'Open bill', icon: 'scroll-text', run: () => {} }, { label: 'Mute this bill', icon: 'bell-off', disabled: true, reason: 'This bill has a hearing on 3/18. It can be muted once that hearing is over.' }, { label: 'Delete', icon: 'trash-2', danger: true, run: () => {} }] });
    root.querySelector('[data-dv="confirm"]').onclick = async () => toast((await confirmSheet({ title: 'Delete this segment?', text: 'People stay; only the saved filter goes.', ok: 'Delete', danger: true })) ? 'Deleted' : 'Kept');
    root.querySelector('[data-dv="toast"]').onclick = () => toast('Filed. HB1562 is done for HHS.', { ok: true, undo: () => toast('Undone') });
  },
};
