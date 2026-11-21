// Staff7's "New issue" form (R-398 piece 10), ONE component used two ways: as its own page (the Issues door, #/issue-new) and, later, as a panel over Sort new bills (piece 10 part B mounts it
// with mode 'panel'). Name, Topic, Description; "Save as draft" makes a draft the public cannot see until an admin publishes it in public mode. The words typed live in a state object, so a
// redraw, Back or a closed panel never loses them (S-11); the caller may hand the state back in and read it out again.
//   mountIssueForm(el, { mode: 'page' | 'panel', bill, onSaved(issue), onCancel(), onUseExisting(issue), initial, state, who }) -> { state, words(), focus() }
// `initial`: { name, cat, desc } to start from (a panel reopened with kept words). `state` (optional) is the object the words live in; the page keeps its own between redraws.
import { S, DB } from '../staff6/data.js';
import { esc, btn, toast } from './parts.js';
import { first } from './steps.js';
import { norm } from './find.js';
import { ic } from './icons7.js';
import { eCig } from './issues.js';

const $ = id => document.getElementById(id);
export const NAME_MIN = 2, NAME_MAX = 60, DESC_MAX = 240;
const enc = encodeURIComponent;

// The admin who publishes, named by first name from the data (never "an admin"). The first active admin; the words say "the admins" only when there is none.
export const adminFirst = () => { const a = (S.advocates || []).find(x => x.is_admin && x.is_active !== false); return a ? first(a) : 'the admins'; };
const catList = () => (S.categories || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
const blank = () => ({ name: '', cat: '', desc: '', err: { name: '', cat: '', clash: null }, busy: false, kept: false });
export const newState = initial => Object.assign(blank(), initial ? { name: initial.name || '', cat: initial.cat || '', desc: initial.desc || '', kept: !!(initial.name || initial.cat || initial.desc) } : {});
const pageState = newState();   // the page's own words, kept across redraws and across leaving the page; emptied by a save

// ---------------------------------------------------------------------------------- the duplicate check
// Ignores case, accents and the ʻokina (find.js norm), against every issue that is not archived: a draft counts too.
export const findClash = name => { const k = norm(eCig(name)); if (!k) return null; return (S.issues || []).find(i => !i.archived_at && norm(eCig(i.name)) === k) || null; };
export function clashWords(i) {
  const lead = (S.advocates || []).find(a => a.id === i.owner_id), where = i.published_at ? 'on the public site' : 'a draft';
  return `There is already an issue called “${eCig(i.name)}” (${where}${lead ? `, ${first(lead)} leads it` : ', nobody leads it'}). `;
}

// ---------------------------------------------------------------------------------- the markup
const errP = (id, words, extra = '') => `<p class="nierr" id="${id}" role="alert"${words ? '' : ' hidden'}>${words ? ic('circle-alert') : ''}<span>${esc(words)}${extra}</span></p>`;
export function formHTML(st, mode) {
  const cats = catList(), e = st.err, clash = e.clash;
  const nameErr = e.name || (clash ? clashWords(clash) : '');
  const useIt = clash ? `<a class="lk" href="#" id="niUse" data-id="${esc(String(clash.id))}">Use that one</a>` : '';
  return `<form class="nif ${mode}" id="niForm" novalidate>`
    + `${st.kept && mode === 'panel' ? `<p class="hint nikept" id="niKept">${ic('info')}<span>Your words from before are still here.</span></p>` : ''}`
    + `<div class="nif-f"><label class="fl" for="niNameIn">Name <span class="req">required</span></label>`
    + `<input class="field${nameErr ? ' err' : ''}" id="niNameIn" type="text" maxlength="${NAME_MAX}" autocomplete="off" placeholder="Free school meals for every student" value="${esc(st.name)}"${nameErr ? ' aria-invalid="true" aria-describedby="niNameErr"' : ''}>`
    + `<p class="nierr" id="niNameErr" role="alert"${nameErr ? '' : ' hidden'}>${nameErr ? ic('circle-alert') : ''}<span>${esc(nameErr)}${useIt}</span></p>`
    + `<p class="hint">A policy people recognize, in everyday words. The public will follow it by this name.</p></div>`
    + `<fieldset class="nif-f nitopic${e.cat ? ' bad' : ''}" id="niTopic"><legend class="fl">Topic <span class="req">required</span></legend>`
    + `<div class="nitopics">${cats.map(c => `<label class="nitop"><input type="radio" name="niCat" value="${esc(c.key)}"${st.cat === c.key ? ' checked' : ''}><span>${esc(c.name)}</span></label>`).join('')}</div>`
    + `${errP('niCatErr', e.cat)}</fieldset>`
    + `<div class="nif-f"><label class="fl" for="niDescIn">Description <span class="req">can wait</span></label>`
    + `<textarea class="field" id="niDescIn" rows="3" maxlength="${DESC_MAX}">${esc(st.desc)}</textarea>`
    + `<p class="hint">One sentence on what would change. Needed before it goes public; the public sees it then.</p></div>`
    + `<div class="niact">${btn('Save as draft', { kind: 'filled', id: 'niSave', disabled: st.busy, loading: st.busy }).replace('type="button"', 'type="submit"')}`
    + `<p class="hint niwho">You will lead it. Only the team sees a draft until ${esc(adminFirst())} publishes it.</p></div>`
    + `</form>`;
}

// ---------------------------------------------------------------------------------- the behaviour
export function bindForm(root, st, opts = {}) {
  const f = root.querySelector('#niForm') || root; if (!f || !f.querySelector) return;
  const name = f.querySelector('#niNameIn'), desc = f.querySelector('#niDescIn');
  const showName = words => { const p = f.querySelector('#niNameErr'); name.classList.toggle('err', !!words); if (words) { name.setAttribute('aria-invalid', 'true'); name.setAttribute('aria-describedby', 'niNameErr'); } else { name.removeAttribute('aria-invalid'); name.removeAttribute('aria-describedby'); } p.hidden = !words; p.innerHTML = words ? ic('circle-alert') + `<span>${esc(words)}</span>` : ''; };
  name.addEventListener('input', () => { st.name = name.value; if (st.err.name || st.err.clash) { st.err.name = ''; st.err.clash = null; showName(''); } });
  desc.addEventListener('input', () => { st.desc = desc.value; });
  f.addEventListener('change', ev => { if (ev.target.name === 'niCat') { st.cat = ev.target.value; if (st.err.cat) { st.err.cat = ''; const p = f.querySelector('#niCatErr'); p.hidden = true; p.innerHTML = ''; f.querySelector('#niTopic').classList.remove('bad'); } } });
  f.addEventListener('click', ev => {
    const u = ev.target.closest('#niUse'); if (!u) return;
    ev.preventDefault(); const i = (S.issues || []).find(x => String(x.id) === u.dataset.id); if (!i) return;
    if (opts.onUseExisting) opts.onUseExisting(i); else location.hash = `#/issue/${enc(i.id)}`;   // from Issues it opens that issue; in a panel the caller picks it for the bill
  });
  f.addEventListener('submit', async ev => {
    ev.preventDefault(); if (st.busy) return;
    const nm = st.name.trim().replace(/\s+/g, ' '), clash = nm.length >= NAME_MIN ? findClash(nm) : null;
    st.err = { name: nm.length < NAME_MIN ? 'Give the issue a name.' : '', cat: st.cat ? '' : 'Choose a topic.', clash };
    if (st.err.name || st.err.clash || st.err.cat) {
      // drawn again from the state (the words stay), then the focus goes back to the first field with a problem
      f.outerHTML = formHTML(st, opts.mode || 'page'); const nf = root.querySelector('#niForm'); bindForm(root, st, opts);
      (st.err.name || st.err.clash ? nf.querySelector('#niNameIn') : nf.querySelector('input[name="niCat"]')).focus(); return;
    }
    st.busy = true; const sv = f.querySelector('#niSave'); sv.disabled = true; sv.classList.add('is-loading'); sv.setAttribute('aria-busy', 'true');
    let issue;
    try { issue = await DB.createIssue({ name: nm, description: st.desc, category: st.cat }); }
    catch {
      st.busy = false; if (f.isConnected) { sv.disabled = false; sv.classList.remove('is-loading'); sv.removeAttribute('aria-busy'); }
      toast('We could not save the draft. Your words are still here.'); return;   // the form and its words stay
    }
    st.busy = false; Object.assign(st, blank());
    if (opts.onSaved) opts.onSaved(issue);
  });
  if (opts.onCancel) f.addEventListener('keydown', ev => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); opts.onCancel(); } });
}

// The component's mount API (the page uses formHTML and bindForm through issueNewPage; a panel calls this).
export function mountIssueForm(el, opts = {}) {
  const st = opts.state || newState(opts.initial), mode = opts.mode || 'page';
  el.innerHTML = formHTML(st, mode); bindForm(el, st, { ...opts, mode }); st.kept = false;   // the note shows once, on the opening draw (a later redraw after an error does not repeat it)
  return { state: st, words: () => ({ name: st.name, cat: st.cat, desc: st.desc }), focus: () => el.querySelector('#niNameIn')?.focus() };
}

// ---------------------------------------------------------------------------------- the page (door one: Issues)
// After saving: the draft's own page, and the toast that says the admin has been told. The toast is said after the page is drawn (the frame clears a toast when the page changes).
export function issueNewPage() {
  const html = `<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">New issue</h1><p class="bsub">Start the draft here. Add the goal and talking points on its page.</p></div></div><div class="pbody"><div class="nipage" id="niRoot">${formHTML(pageState, 'page')}</div></div></div>`;
  return { html, bind: () => bindForm($('niRoot'), pageState, { mode: 'page', onSaved: issue => {
    addEventListener('hashchange', () => toast(`Saved as a draft. ${adminFirst()} has been told.`), { once: true });
    location.hash = `#/issue/${enc(issue.id)}`;
  } }) };
}
