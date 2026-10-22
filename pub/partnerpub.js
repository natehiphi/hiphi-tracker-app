// A HIPHI partner's own public page (R-328 batch D, Nate's plan of 10/21): #/from/<slug> shows the group's bills and issues
// in its own words, under its own name, and #/from/<slug>/<issue slug> one of its issues with its bills. Reached from Find's
// "From our partners", the "More from ..." line under a partner's words on a bill page, and the partner's own link: ?via=<slug>
// opens here first for someone past the first visit (app.js boot), with the group's welcome line on top.
// Nothing here may read as HIPHI's (the plan's rule "Partner words read as HIPHI's", answered): the group's side is the
// plain grey chip, never HIPHI's blue one; each bill says where HIPHI stands in its own words ("HIPHI supports it too",
// "HIPHI hasn't taken a position"); and the page says that HIPHI partners write these words and HIPHI looks them over first.
// The data is pub/partners.js's one public copy (public_partners, public_partner_bills, public_partner_issues).
import { S, app, esc, icon, nick, blurb, spaced, billPath, plainStatus } from './core.js';
import { btn, skeleton } from './ui.js';
import { recHead, recSec, recEmpty, wireKit, keep, BOX } from './rec/kit.js';
import { backRow } from './rec/act.js';
import { pubNow, loadPublic, partnerOf, onBill, hiphiSide, sideVerb, issueChip, fromPath, pIssuePath, billsInfo, billInfoNow, viaPartner } from './partners.js';

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
// One bill: the group's own name for it first (its nickname; the page is the group's), the number always, where it stands,
// and the two sides in plain words ("They support it · HIPHI supports it too").
function billRow(b, slug) {
  const r = onBill(b).find(x => x.partner_slug === slug);
  const name = r?.nickname || nick(b) || blurb(b, 90);
  const they = r ? THEY[sideVerb(r.side, { strong: true })] || '' : '';
  return `<li><a class="rc-row" href="${esc(billPath(b))}"><span class="rc-rtext"><span class="rc-rname">${esc(name)}</span>
    <span class="rc-rstat">${esc(keep(`${spaced(b.bill_number)} · ${plainStatus(b).short}`))}</span>${they ? `<span class="rc-rpart">${esc(`${they} · ${hiphiWords(b)}`)}</span>` : ''}</span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
}
const billList = (bills, slug) => bills.length ? `<ul class="rc-rows ${BOX}" role="list">${bills.map(b => billRow(b, slug)).join('')}</ul>` : '';
// Whose words these are, at the end of each page (the plan: "A HIPHI partner. These are its own words.").
const whose = name => `<p class="pw-whose pp-whose">${icon('handshake')}<span>${esc(name)} is a HIPHI partner. It writes these words itself, and HIPHI looks over each one before it shows here. <a href="#/groups">For advocacy groups</a></span></p>`;
const site = p => /^https?:\/\//i.test(p.website || '') ? btn('Their website', { kind: 'text', sm: true, icon: 'globe', iconEnd: 'external-link', href: p.website, attrs: { target: '_blank', rel: 'noopener' } }) : '';
const welcome = p => viaPartner()?.slug === p.slug && p.welcome ? `<p class="pw-welcome">${icon('sparkles')}<span>${esc(p.welcome)}</span></p>` : '';
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

function issueView(p, issueSlug) {
  const i = (pubNow().issues || []).find(x => x.partner_slug === p.slug && x.slug === issueSlug);
  if (!i) return `<div class="rc pp">${backRow(fromPath(p.slug), p.name)}${recHead({ eye: p.name, title: 'Issue' })}${recEmpty('This issue isn’t on the tracker right now.', btn(`More from ${p.name}`, { kind: 'secondary', href: fromPath(p.slug) }))}</div>`;
  const bills = billsOf(i.bill_ids || []).sort((x, y) => x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true }));
  return `<div class="rc pp">${backRow(fromPath(p.slug), p.name)}
    ${recHead({ eye: `${p.name}’s issue`, title: i.name, lede: i.description || '', extra: issueChip(i) })}
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
function wire() { const root = document.querySelector('.pp'); if (root) wireKit(root); }

// It belongs to Find, where its groups are listed (the calm pages light the tab they were reached from).
export default { tab: 'find', title: route => partnerOf(route.slug)?.name || 'Partner', render, wire };
