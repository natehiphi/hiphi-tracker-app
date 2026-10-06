// Reading the bill before deciding (R-178, Nate 10/5: "allow users to review bill from the capitol website or on the public
// webpage if they want when deciding whether they support it or not. Currently the brief description is insufficient.").
// Wherever someone picks a side (the bill page, under the bill's summary; a letter's first step, "Where do you stand on
// HB 1573?"), "Read more about the bill" opens what we have beyond the one sentence: the Legislature's own summary of the
// latest draft, why HIPHI supports or opposes it, and the bill itself, one tap away on the Capitol website.
// The Capitol refuses automated readers and can't be shown inside this page, so the whole text is a link, not a copy.
// The latest draft is bills.current_version, which backend migration 142 fixed (House drafts were never read) and the
// sync now refreshes every run.
import { esc, cleanDesc, sessionInfo } from './core.js';
import { btn } from './ui.js';
import { draftName } from './letters.js';
import { logAct } from './visitlog.js';

const parts = b => /^([A-Z]+)(\d+)$/.exec(String(b?.bill_number || '').toUpperCase().replace(/\s/g, ''));
const yearOf = b => b?.session_year || sessionInfo().yr;

// The bill's own page on the Capitol website: where it is, its hearings, committee reports and the testimony others sent.
export function capitolUrl(b) {
  if (b?.state_url) return b.state_url;
  const m = parts(b);
  return m ? `https://capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${yearOf(b)}` : 'https://capitol.hawaii.gov/';
}
// The whole bill as it is now. The Capitol keeps each draft as its own page, named for the latest draft only ("HB1573 HD3
// SD1" is HB1573_SD1_.HTM; as introduced, HB1573_.HTM), in the session's folder even for a bill carried over from the year
// before (checked 10/5 on the Capitol's own pages for HB1573, HB1116, SB227 and SR12).
export function billTextUrl(b) {
  const m = parts(b); if (!m) return capitolUrl(b);
  const v = /^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? `${b.current_version}_` : '';
  return `https://www.capitol.hawaii.gov/sessions/session${yearOf(b)}/bills/${m[1]}${m[2]}_${v}.HTM`;
}

// HIPHI's talking points, said as its reasons (they are written as reasons: "Only e-cigarettes with federal marketing
// approval would be sold, which helps keep untested products away from young people.").
const WHY = { strongly_support: 'Why HIPHI strongly supports it', support: 'Why HIPHI supports it', support_amend: 'Why HIPHI supports it, with changes',
  oppose: 'Why HIPHI opposes it', strongly_oppose: 'Why HIPHI strongly opposes it', neutral: 'What HIPHI says about it' };
const words = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// What "Read more about the bill" opens. shown: the words already on screen above it, so the Legislature's summary is
// left out when it is the very same words (A-14). reasons: false where the next step lists HIPHI's points anyway. h: the
// heading level under the screen's own. pfx keeps ids apart when the bill page and a letter show it at once. quiet: the
// whole bill as a text link, where outlined buttons are the answers to pick (a letter's first step, A-13).
export function aboutBill(b, { shown = '', reasons = true, h = 'h3', pfx = 'ab', quiet = false } = {}) {
  const d = cleanDesc(b.description), official = d && !words(shown).includes(words(d)) ? d : '';
  const why = reasons && WHY[b.hiphi_position], pts = why && Array.isArray(b.hiphi_points) ? b.hiphi_points.filter(Boolean) : [];
  // Hawaiʻi bills mark what they repeal "bracketed and stricken", so the words are crossed out as well as in brackets.
  const draft = /^(HD|SD|CD|FD)\d{1,2}$/.test(b.current_version || '') ? `Opens ${draftName(b.current_version)}, the newest version,` : 'Opens the bill as it was introduced,';
  const ext = { target: '_blank', rel: 'noopener' };
  return `<div class="ab">
    ${official ? `<div class="ab-part"><${h} class="ab-h">In the Legislature’s words</${h}><p>${esc(official)}</p></div>` : ''}
    ${pts.length ? `<div class="ab-part"><${h} class="ab-h">${esc(why)}</${h}><ul class="ab-pts" role="list">${pts.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>` : ''}
    <div class="ab-part ab-read">
      ${btn('Read the whole bill', { kind: quiet ? 'text' : 'secondary', sm: quiet, icon: 'file-text', iconEnd: 'external-link', cls: quiet ? 'ab-cap' : '', href: billTextUrl(b), attrs: { ...ext, 'data-ab-go': 'text', 'aria-describedby': `${pfx}-tip` } })}
      <p class="ab-tip" id="${pfx}-tip">${esc(draft)} on the Capitol website. Crossed-out words in [brackets] are being taken out of the law. Underlined words are being added.</p>
      ${btn('The bill’s page at the Capitol', { kind: 'text', sm: true, icon: 'landmark', iconEnd: 'external-link', cls: 'ab-cap', href: capitolUrl(b), attrs: { ...ext, 'data-ab-go': 'capitol' } })}
    </div></div>`;
}

// Kind-only counts (backend 142): "Read more" opened once per bill per visit, and each way out to the Capitol taken.
// 'toggle' does not bubble, so it is caught on the way down.
const opened = new Set();
document.addEventListener('toggle', e => {
  const d = e.target; if (!d?.matches?.('details[data-ab-more]') || !d.open) return;
  if (!opened.has(d.dataset.abMore)) { opened.add(d.dataset.abMore); logAct('bill_more'); }
}, true);
document.addEventListener('click', e => {
  const a = e.target.closest?.('[data-ab-go]'); if (!a) return;
  logAct(a.dataset.abGo === 'text' ? 'bill_text' : 'bill_capitol');
});
