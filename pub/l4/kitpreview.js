// The kit preview (R-412): every part of kit.js drawn once, on the practice copy only (?demo=1&look4=1&kit=1). For the foundation build's own
// checking against the mockups (Mix-Home, K1 to K4); not a screen anyone is sent to, and it draws nothing the app does not already load.
import { hero, heroTop, roundButton, actions, deadline, mainButton, secondButton, quietLink, sectionHead, row, billRow, lei } from './kit.js';
import { findBill } from '../core.js';

const HST = (d, h, m = 0) => Date.parse(`2026-03-${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00-10:00`);
const DUE = '2026-03-18T09:30:00-10:00', HEAR = '2026-03-20T09:30:00-10:00';
const states = [
  ['A. two days out', { due: DUE, hearing: HEAR, now: HST(16, 8) }], ['B. the day before', { due: DUE, hearing: HEAR, now: HST(17, 8) }],
  ['C. the last day', { due: DUE, hearing: HEAR, now: HST(18, 7) }], ['D. passed, hearing ahead', { due: DUE, hearing: HEAR, now: HST(18, 11) }],
  ['E. waiting for a hearing', { needsBy: '2026-03-30', now: HST(16, 8) }],
];
export default {
  tab: 'home', tabs: true, ownTop: true, title: () => 'Look 4 kit',
  render() {
    const b = findBill?.('HB2121');
    const top = heroTop({ greeting: 'Aloha, Keoni', right: roundButton('share', 'Share this bill') });
    const body = `${deadline(states[0][1])}<div><div class="l4-kicker">HB 2121</div><h1 class="l4-h1">Help ban disposable <span style="white-space:nowrap">e-cigarettes</span></h1><p class="l4-lede">Two Senate committees hear it Friday. A short note from you can help it pass.</p></div>`;
    return `${hero({ top, body })}
      ${actions(`<div>${mainButton('Help me write testimony', { 'data-kit': 'main' })}<span class="l4-note">About 10 minutes the first time</span></div>${secondButton('Send a quick email · 2 min')}`, 'Speak up')}
      <div style="padding:36px 20px 24px">
        <section class="l4-section">${sectionHead('Also this week')}
          <div class="l4-list">${row({ title: 'Protect preventive care and vaccines', sub: 'Testimony due Wed 9:30 AM · 2 days left', tone: 'amber', href: '#/' })}</div></section>
        <section class="l4-section">${sectionHead('Waiting for a hearing', 'Open one to ask the chair for a hearing.')}
          <div class="l4-list">${row({ title: 'Higher liquor taxes', sub: 'Needs a hearing by Mon, Mar 30', href: '#/' })}${b ? billRow(b, { count: true }) : ''}</div></section>
        <section class="l4-section">${sectionHead('Your lei')}${lei(1)}<p style="margin:12px 0 0"><b>1 flower so far.</b> Each time you speak up, one more opens.</p>
          <p style="margin:12px 0 0">${quietLink('A quiet link', { href: '#/' })}</p></section>
        ${states.slice(1).map(([name, a]) => `<section class="l4-section">${hero({ ridge: false, body: `<p class="l4-kicker">${name}</p>${deadline(a)}` })}</section>`).join('')}
      </div>`;
  },
  wire() {},
};
