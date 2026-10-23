// A person comes here to see what one HIPHI partner group works on, in that group's own words (B-1).
// A HIPHI partner's own public page (R-328 batch D, Nate's plan of 10/21): #/from/<slug> shows the group's bills and issues
// in its own words, under its own name, and #/from/<slug>/<issue slug> one of its issues with its bills. Reached from Find's
// "From our partners", the "More from ..." line under a partner's words on a bill page, and the partner's own link: ?via=<slug>
// opens here first for someone past the first visit (app.js boot), with the group's welcome line on top.
// Nothing here may read as HIPHI's (the plan's rule "Partner words read as HIPHI's", answered): the group's side is the
// plain grey chip, never HIPHI's blue one; each bill says where HIPHI stands in its own words ("HIPHI supports it too",
// "HIPHI hasn't taken a position"); and the page says that HIPHI partners write these words and HIPHI looks them over first.
// The data is pub/partners.js's one public copy (public_partners, public_partner_bills, public_partner_issues).
// Batch G (migration 185): a partner's issue has a Follow, as HIPHI's issues do (kit recFollow's pill), for a signed-in person
// (partner_issue_follows, their own rows only): following it brings that partner's asks on its bills in the 4:30 pm email,
// which one quiet line under it says. Signed out, the pill is "Sign in to follow", which keeps this page for the way back
// (mylists.js rememberPlace, as a list started signed out does). The practice copy follows in its sandbox (?partner=1).
import { S, app, esc, icon, toast, nick, blurb, spaced, billPath, plainStatus } from './core.js';
import { btn, skeleton } from './ui.js';
import { recHead, recSec, recEmpty, wireKit, keep, BOX } from './rec/kit.js';
import { backRow } from './rec/act.js';
import { rememberPlace } from './mylists.js';
import { pubNow, loadPublic, welcomeHtml, partnerAsksNow, partnerOf, onBill, hiphiSide, sideVerb, issueChip, fromPath, pIssuePath, billsInfo, billInfoNow, viaPartner,
  canFollowPartner, partnerFollowsNow, followPartnerIssue } from './partners.js';

// The bills a page lists may be ones HIPHI does not track (a partner chooses freely there), so their rows come from the
// public bill rows: asked once for what is missing, and the page draws again when they come.
const asked = new Set();
function billsOf(ids) {
  const need = ids.filter(id => !billInfoNow(id) && !asked.has(id));
  if (need.length) { need.forEach(id => asked.add(id)); billsInfo(need).then(() => app.render()).catch(e => console.error(e)); }
  return ids.map(id => billInfoNow(id) || (S.bills || []).find(b => b.id === id)).filter(Boolean);
}
// "HIPHI supports it too" / "HIPHI hasn't taken a position": HIPHI's own side said in its own words, beside the group's.
const hiphiWords = b => { const s = hiphiSide(b); return s === 'support' ? 'HIPHI supports it too' : s === 'oppose' ? 'HIPHI opposes it too' : 'HIPHI hasn’t taken a position'; };
const THEY = { supports: 'They support it', 'strongly supports': 'They strongly support it', opposes: 'They oppose it', 'strongly opposes': 'They strongly oppose it', 'has comments on': 'They have comments on it' };
// One bill: the tracker's own name for it (the name its bill page and Find use, so a tap never lands on a differently named
// page: the fresh-eyes review of 10/22), the number always, where it stands, and the two sides in plain words ("They support
// it · HIPHI supports it too").
function billRow(b, slug) {
  const r = onBill(b).find(x => x.partner_slug === slug);
  const name = nick(b) || blurb(b, 90);
  const they = r ? THEY[sideVerb(r.side, { strong: true })] || '' : '';
  return `<li><a class="rc-row" href="${esc(billPath(b))}"><span class="rc-rtext"><span class="rc-rname">${esc(name)}</span>
    <span class="rc-rstat">${esc(keep(`${spaced(b.bill_number)} · ${plainStatus(b).short}`))}</span>${they ? `<span class="rc-rpart">${esc(`${they} · ${hiphiWords(b)}`)}</span>` : ''}</span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
}
const billList = (bills, slug) => bills.length ? `<ul class="rc-rows ${BOX}" role="list">${bills.map(b => billRow(b, slug)).join('')}</ul>` : '';
// Whose words these are, at the end of each page (the plan: "A HIPHI partner. These are its own words.").
const whose = name => `<p class="pw-whose pp-whose">${icon('handshake')}<span>${esc(name)} is a HIPHI partner. It writes these words itself, and HIPHI looks over each one before it shows here. <a href="#/groups">For advocacy groups</a></span></p>`;
const site = p => /^https?:\/\//i.test(p.website || '') ? btn('Their website', { kind: 'text', sm: true, icon: 'globe', iconEnd: 'external-link', href: p.website, attrs: { target: '_blank', rel: 'noopener' } }) : '';
const welcome = p => viaPartner()?.slug === p.slug && p.welcome ? welcomeHtml(p) : '';
const gone = () => `<div class="rc pp">${backRow('#/find', 'Find')}${recHead({ title: 'Partner' })}${recEmpty('This group isn’t on the tracker right now.', btn('Find bills and issues', { kind: 'secondary', icon: 'search', href: '#/find' }))}</div>`;

function groupView(p) {
  const d = pubNow(), slug = p.slug;
  const ids = [...new Set(d.rows.filter(r => r.partner_slug === slug).map(r => r.bill_id))];
  const bills = billsOf(ids).sort((x, y) => x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true }));
  const issues = d.issues.filter(i => i.partner_slug === slug);
  const iRow = i => `<li><a class="rc-row" href="${esc(pIssuePath(slug, i.slug))}"><span class="rc-rtext"><span class="rc-rname">${esc(i.name)}</span>
    <span class="rc-rstat">${esc(`${i.stance === 'support' ? 'They support it' : i.stance === 'oppose' ? 'They oppose it' : 'They have mixed views'}${(i.bill_ids || []).length ? ` · ${i.bill_ids.length === 1 ? '1 bill' : `${i.bill_ids.length} bills`}` : ''}`)}</span></span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
  return `<div class="rc pp">${backRow('#/find', 'Find')}${welcome(p)}
    ${recHead({ eye: 'A HIPHI partner', title: p.name, lede: p.about || '', extra: site(p) })}
    ${bills.length ? recSec('pp-bills-h', 'Their bills', billList(bills, slug)) : ids.length ? skeleton(3) : ''}
    ${issues.length ? recSec('pp-iss-h', 'Their issues', `<ul class="rc-rows ${BOX}" role="list">${issues.map(iRow).join('')}</ul>`) : ''}
    ${!ids.length && !issues.length ? recEmpty(`${p.name} has no bills on the tracker yet.`) : ''}
    ${whose(p.name)}</div>`;
}

// "Get its asks": the kit's outlined pill, "✓ Getting its asks" once on (R-061: on looks on), which stops with Undo (B-5).
// Not HIPHI's Follow (the fresh-eyes review of 10/22): a partner issue shows nowhere else, so the control is named for what it
// does, people get the partner's asks on these bills in their 4:30 pm email, and the line under it says when they won't
// (None in Your alerts, or this partner stopped), with the way to change it. While the follows are read, the pill waits.
function followCtl(p, i) {
  if (!canFollowPartner()) return { pill: `<a class="rc-fpill" href="#/signin" data-pp-signin>${icon('log-in')}<span>Sign in to get its asks</span></a>`, on: false };
  const set = partnerFollowsNow(), on = !!set?.has(i.id);
  const attrs = `data-pp-follow="${esc(i.id)}" aria-pressed="${on}"${set ? '' : ' aria-busy="true" disabled'}`;
  return { on, pill: on ? `<button type="button" class="rc-fpill on" ${attrs} aria-label="Getting ${esc(p.name)}’s asks on ${esc(i.name)}. Press to stop." title="Press to stop getting its asks.">${icon('check')}<span>Getting its asks</span></button>`
    : `<button type="button" class="rc-fpill" ${attrs} aria-label="Get ${esc(p.name)}’s asks on ${esc(i.name)}">${icon('mail')}<span>Get its asks</span></button>` };
}
function issueView(p, issueSlug) {
  const i = (pubNow().issues || []).find(x => x.partner_slug === p.slug && x.slug === issueSlug);
  if (!i) return `<div class="rc pp">${backRow(fromPath(p.slug), p.name)}${recHead({ eye: p.name, title: 'Issue' })}${recEmpty('This issue isn’t on the tracker right now.', btn(`More from ${p.name}`, { kind: 'secondary', href: fromPath(p.slug) }))}</div>`;
  const bills = billsOf(i.bill_ids || []).sort((x, y) => x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true }));
  const f = followCtl(p, i), mine = canFollowPartner() ? partnerAsksNow() : null;
  const off = mine?.level === 'none' ? 'You chose no partner asks in Your alerts.' : (mine?.stopped || []).some(s => s.slug === p.slug) ? `You stopped asks from ${p.name}.` : '';
  const line = off && f.on ? off : f.on ? `${p.name}’s asks on these bills come in your 4:30 pm email, as often as Your alerts allows.` : `Get ${p.name}’s asks on these bills in your 4:30 pm email.`;
  const change = off && f.on ? ` <a href="#/alerts">Change it</a>` : '';
  return `<div class="rc pp">${backRow(fromPath(p.slug), p.name)}
    ${recHead({ eye: 'A HIPHI partner’s issue', title: i.name, lede: i.description || '', extra: issueChip(i) + f.pill })}
    <p class="pp-fnote" id="pp-fnote">${esc(line)}${change}</p>
    ${recSec('pp-ibills-h', 'Bills on this issue', bills.length ? billList(bills, p.slug) : (i.bill_ids || []).length ? skeleton(2) : recEmpty('No bills on this issue yet.'))}
    ${whose(p.name)}</div>`;
}

function render(route) {
  const d = pubNow();
  // pubNow redraws only when partners have words to show; this page draws again either way (to say none is here).
  if (!d) { loadPublic().then(() => app.render()).catch(e => console.error(e)); return `<div class="rc pp">${backRow('#/find', 'Find')}${skeleton(4)}</div>`; }
  const p = partnerOf(route.slug);
  if (!p || !p.writes) return gone();
  return route.issue ? issueView(p, route.issue) : groupView(p);
}
function wire(route) {
  const root = document.querySelector('.pp'); if (!root) return;
  wireKit(root);
  root.querySelector('[data-pp-signin]')?.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); rememberPlace(); app.go('#/signin'); });
  root.querySelector('[data-pp-follow]')?.addEventListener('click', async e => {
    const b = e.currentTarget, id = b.dataset.ppFollow, i = (pubNow()?.issues || []).find(x => x.id === id);
    if (!i || b.getAttribute('aria-busy') === 'true') return;
    const on = b.getAttribute('aria-pressed') !== 'true', again = () => document.querySelector('[data-pp-follow]')?.focus({ preventScroll: true });
    b.setAttribute('aria-busy', 'true');
    try {
      await followPartnerIssue(id, on); app.render(); again();
      toast(on ? `You’ll get ${i.partner_name}’s asks on ${i.name}.` : `You won’t get ${i.partner_name}’s asks on ${i.name}.`, { yay: on, undo: async () => { await followPartnerIssue(id, !on); setTimeout(again, 0); } });
    } catch (err) { console.error(err); b.removeAttribute('aria-busy'); toast(err, true); }
  });
}

// It belongs to Find, where its groups are listed (the calm pages light the tab they were reached from).
export default { tab: 'find', title: route => partnerOf(route.slug)?.name || 'Partner', render, wire };
