// The gallery of every share picture version on real bills (R-183, Nate 10/6: "one place where I can see every template on real
// bills: support and oppose, each ask"): share-pics.html. Real bills from the practice copy, at its day (Mon 16 Mar 2026), each
// shown with every version that fits it. The practice day has no bill at the Governor's desk, on the floor or turned into
// law, so those asks are shown as "what it would look like": a real bill with its stage set by hand, said so on the page.
// Words staff have not checked yet are drawn from the drafts and marked. The pictures are the same files the practice copy's
// share pages use (pub/og/t/<version>/<hash>.jpg), so what is here is what a text message shows.
//
//   node tools/share_gallery.mjs            writes share-pics.html and tools/og_wanted_gallery.json
//   python3 tools/og_images.py --versions   draws the pictures it lists that are missing
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billState, cardFor } from './share_cards.mjs';
import { demoSets, wordsMap } from './share_pic_data.mjs';
import { ARMS, ARM_NAMES, specsFor, picPath, loadLooks } from './share_pics.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const looks = JSON.parse(readFileSync(join(ROOT, 'tools', 'og_looks.json'), 'utf8')); loadLooks(looks);
const snap = JSON.parse(readFileSync(join(ROOT, 'demo', 'snapshot.json'), 'utf8')), D = demoSets(snap);
const words = wordsMap(existsSync(join(ROOT, 'demo', 'share_words.json')) ? JSON.parse(readFileSync(join(ROOT, 'demo', 'share_words.json'), 'utf8')) : [], { onlyChecked: false });
const issueById = new Map(D.issues.map(i => [i.id, i]));
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// [bill, ask, what changes on the bill to show a stage the practice day does not have, a line saying so]
const SCENES = [
  ['Bills HIPHI supports', [
    ['HB1573', 'testify', null],
    ['HB1518', 'ask', null],
    ['HB1573', 'floor', { stage: 'first_floor' }, 'A vote of the full House is coming (the bill’s stage set by hand: on the practice day it is not there yet).'],
    ['HB244', 'conference', null],
    ['HB1573', 'governor', { stage: 'governor' }, 'On the Governor’s desk (the bill’s stage set by hand).'],
    ['HB1573', 'follow', { stage: 'enacted' }, 'It became law (the bill’s stage set by hand).'],
    ['HB1573', 'follow', null],
  ]],
  ['Bills HIPHI opposes (every ask turns around)', [
    ['HB108', 'testify', { hearing: 3 }, 'A hearing three days after the practice day (a made-up hearing, so the testimony pictures can be seen for a bill HIPHI opposes).'],
    ['HB108', 'ask', null],
    ['HB108', 'floor', { stage: 'second_floor' }, 'A vote of the full Senate is coming (the bill’s stage set by hand).'],
    ['HB939', 'conference', null],
    ['HB108', 'governor', { stage: 'governor' }, 'On the Governor’s desk (the bill’s stage set by hand).'],
    ['HB10', 'follow', null],
  ]],
];
const picOf = (look, issue) => issue && existsSync(join(ROOT, 'pub', 'og', look, `${issue.slug}.jpg`)) ? `pub/og/${look}/${issue.slug}.jpg` : `pub/og/${look}.jpg`;

const wanted = [], blocks = [];
const numLabel = n => n.replace(/^([A-Z]+)(\d)/, '$1 $2');
for (const [title, scenes] of SCENES) {
  let html = `<section><h2>${esc(title)}</h2>`;
  for (const [num, ask, patch, note] of scenes) {
    const base = D.bills.find(b => b.bill_number.replace(/\s/g, '') === num); if (!base) continue;
    const b = { ...base, ...(patch?.stage ? { stage: patch.stage, last_action: '' } : {}) };
    const hearings = patch?.stage ? [] : (D.hearingsBy.get(b.id) || []).slice();   // a stage set by hand has no hearing ahead
    if (patch?.hearing) {
      const at = new Date(D.now + patch.hearing * 864e5 + 6 * 36e5);
      hearings.push({ id: 'gallery', bill_id: b.id, bill_number: b.bill_number, committee: (b.referrals || [])[0] || 'HLT', scheduled_at: at.toISOString(), status: 'scheduled', testimony_deadline: new Date(at.getTime() - 24 * 36e5).toISOString() });
    }
    const state = billState(b, { hearings, outcomes: D.outcomes, deadlineFor: D.deadlineFor(b), now: D.now });
    const issue = (b.hiphi_issues || []).map(id => issueById.get(id)).find(Boolean) || null, ctx = { committees: D.committees, issue };
    const card = cardFor(b, ask, state, ctx);
    const specs = specsFor({ b, ask, state, card, ctx, words: issue ? words.get(issue.id) : null, counts: { testimonies: 212, emails: 87, followers: 140 }, practice: true });
    html += `<article class="scene"><h3>${esc(card.title)}</h3><p class="note">${esc(numLabel(num))} · ${esc(looks[card.image].big)}${note ? ` · ${esc(note)}` : ''}</p><div class="grid">`;
    html += `<figure><img src="${picOf(card.image, issue)}" width="1200" height="630" loading="lazy" alt="Today’s picture for this share: ${esc(looks[card.image].big)}"><figcaption><b>Today’s picture</b></figcaption></figure>`;
    for (const arm of ARMS) {
      const sp = specs[arm]; if (!sp) continue;
      const f = picPath(sp); wanted.push({ file: f, spec: sp });
      html += `<figure><img src="pub/${f}" width="1200" height="630" loading="lazy" alt="${esc(ARM_NAMES[arm])}"><figcaption><b>${esc(ARM_NAMES[arm])}</b>${sp.tag ? ` <span class="tag">${esc(sp.tag)}</span>` : ''}</figcaption></figure>`;
    }
    const missing = ARMS.filter(a => a !== 'today' && !specs[a]);
    html += `</div><p class="note">Not drawn for this share: ${missing.map(a => esc(ARM_NAMES[a].replace(/^\d+ · /, ''))).join(', ') || 'nothing'}. A picture is drawn only where it is true (a date, a hearing, 10 or more people, the issue’s checked words).</p></article>`;
  }
  blocks.push(html + '</section>');
}
writeFileSync(join(ROOT, 'tools', 'og_wanted_gallery.json'), JSON.stringify(wanted) + '\n');
writeFileSync(join(ROOT, 'share-pics.html'), `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Share pictures on real bills</title>
<style>
:root { --bg:#F4F7F9; --surface:#fff; --ink:#142B35; --body:#344852; --muted:#5F6F76; --line:#DBE3E7; --accent:#00698E; --warm:#984B0B; --warm-wash:#FFF4EE; }
@media (prefers-color-scheme: dark) { :root { --bg:#0E1B21; --surface:#15262E; --ink:#EAF2F5; --body:#C9D6DC; --muted:#93A6AF; --line:#2A3E48; --accent:#6BCDF8; --warm:#FCB27A; --warm-wash:#3A2414; } }
* { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--body); font:400 16px/1.55 Lato, system-ui, -apple-system, sans-serif; }
.wrap { max-width:1120px; margin:0 auto; padding:28px 16px 64px; display:flex; flex-direction:column; gap:32px; }
h1,h2,h3 { color:var(--ink); font-family:Poppins, Lato, system-ui, sans-serif; letter-spacing:-.02em; line-height:1.2; margin:0; }
h1 { font-size:clamp(1.6rem,4vw,2.2rem); } h2 { font-size:1.4rem; } h3 { font-size:1.05rem; letter-spacing:-.01em; }
a { color:var(--accent); } p { margin:0; } .note { font-size:.9rem; color:var(--muted); }
.scene { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:10px; margin-top:16px; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:16px; }
figure { margin:0; display:flex; flex-direction:column; gap:6px; min-width:0; } figure img { width:100%; height:auto; aspect-ratio:1200/630; border-radius:10px; border:1px solid var(--line); background:var(--bg); }
figcaption { font-size:.9rem; color:var(--ink); } .tag { font-size:.75rem; font-weight:700; color:var(--warm); background:var(--warm-wash); border-radius:999px; padding:2px 8px; }
</style></head><body><div class="wrap">
<header><p class="note">R-183 · the practice copy, Monday 16 March 2026</p><h1>Share pictures on real bills</h1>
<p>Every picture a shared link can show, on real bills, for bills HIPHI supports and opposes and for each ask. The first picture of each row is today’s. A picture is drawn only where it is true, so a row shows only the versions that fit. Words marked “Draft words” are Claude’s drafts and have not been checked by staff. The crowd count shows a practice number.</p>
<p class="note"><a href="staff.html#/setup/tests">The switches: Staff v2 · Session setup · Tests</a></p></header>
${blocks.join('\n')}
</div></body></html>
`);
console.log(`${wanted.length} pictures in the gallery, ${wanted.filter(w => !existsSync(join(ROOT, 'pub', w.file))).length} still to draw`);
