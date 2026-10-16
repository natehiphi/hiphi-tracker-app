// The first name, back in the first visit (R-294, Nate 15 Oct; the name screen left with R-023 on 21 Sep). One optional
// box above the number on the visit's one sign-up, in today's version (start-rest.js stepAlerts) and every plan's (onb.js
// stepJoin) alike: no screen of its own (R-265: every screen fits). It is not part of the alerts sign-up: it is saved on
// this device (and to the account when signed in, myprofile.js saveProfile) whichever button is pressed, and never sent
// with the number. It greets them on the "Mahalo!" page at once (C-13: an answer changes what comes next), then on Home
// and in their letters (myName). The draft lives in S.fvName, so a redraw (email instead, the code step, Back) keeps it.
import { S, esc, wizSet } from './core.js';
import { myName, saveProfile } from './myprofile.js';

S.fvName ??= null;
const draft = () => S.fvName ?? myName();
const clean = n => String(n || '').replace(/\s+/g, ' ').replace(/[<>]/g, '').trim().slice(0, 40);
// The label says why the box is there (B-12; the critic: a name beside a number and the carrier words read like a contact
// record). It promises nothing about sharing: signed in, the name is on the account, and the team sees accounts' names.
// "Leilani" from "Leilani Kahale": the greeting uses the first word, as Home's does.
export const firstName = () => clean(draft()).split(' ')[0] || '';
export const nameField = pfx => `<div class="field fv-namefield"><label for="${pfx}-name">First name <span class="muted">(optional, to greet you)</span></label>
  <input id="${pfx}-name" name="given-name" type="text" autocomplete="given-name" autocapitalize="words" spellcheck="false" enterkeyhint="next" maxlength="40" value="${esc(draft())}"></div>`;
export function wireName(form, pfx) {
  const nm = form && form.querySelector(`#${pfx}-name`); if (!nm) return;
  nm.oninput = () => { S.fvName = nm.value; };
  // Enter goes on to the number, not to sending it: the number is the box's one required answer.
  nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); form.querySelector(`#${pfx}-phone, #${pfx}-email`)?.focus(); } };
}
// On leaving the sign-up, by any button. An account save that fails saves nothing on the device either (saveProfile), so
// the first visit's own copy keeps it, and kernel.js carries wiz().name into the account at the next sign-in.
export function keepName() {
  if (S.fvName === null) return;
  const n = clean(S.fvName); if (n === myName()) return;
  saveProfile({ name: n }).catch(() => wizSet({ name: n }));
}
