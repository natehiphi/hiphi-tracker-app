// Share pages: one tiny page per bill HIPHI has a position on (b/HB2121.html) and per issue (i/<slug>.html), so a link
// (and, since R-125, one calendar feed per issue, cal/<slug>.ics, for phones to subscribe to)
// pasted into a text or a post previews with the bill's own name and what it does, instead of the tracker's general
// card (R-067). The tracker's bill pages are addresses after a # (#/bill/HB2121), which no link preview can read. Each
// page sends a person straight on to the tracker (?via=share, so arrivals by shared link are counted as such) and gives
// a preview robot the title, description and picture. Bill numbers start again every session (R-110): b/HB2121 is the
// latest session's bill of that number, b/2026/HB2121 that session's, and every page sends people to the exact bill it
// describes (#/bill/2026/HB2121), so a link shared in 2026 still opens the 2026 bill in 2027.
// Since R-169 (10/5) a bill has one page per ask, its card leading with the ask and its link opening it (b/HB1573-testify
// opens the testimony walkthrough): the words and the choice of pages are tools/share_cards.mjs. The pages carry no
// instant redirect (<meta http-equiv="refresh">) and no og:url: Facebook's link robot follows the one to the tracker's
// general card, and links to the other without the partner's or the test's ?via= tag. Their script sends people on.
//
//   node tools/share_pages.mjs              writes b/, i/ and cal/ from the live public views (read-only, the public key)
//   node tools/share_pages.mjs --check      says what would change, writes nothing
//   node tools/share_pages.mjs --out DIR    writes into DIR instead (the tests)
//
// Run by .github/workflows/share-pages.yml (hourly January to June, daily otherwise), which commits the pages when they
// changed. Only public views are read, with the publishable key the public page already carries.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { billState, asksFor, cardFor, committeeWords } from './share_cards.mjs';
import { picBuilder } from './share_pic_pages.mjs';
import { demoSets, wordsMap } from './share_pic_data.mjs';
import { ARMS } from './share_pics.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// The public page's address and key live in the kernel since the split (R-122, 10/2); reading them from core.js, as
// before, failed this job on 10/3 and 10/4, until R-158 (10/5).
const kernel = readFileSync(join(ROOT, 'pub/kernel.js'), 'utf8');
const URL_ = /SUPABASE_URL\s*=\s*'([^']+)'/.exec(kernel)[1], KEY = /SUPABASE_KEY\s*=\s*'([^']+)'/.exec(kernel)[1];
const SITE = 'https://natehiphi.github.io/hiphi-tracker-app/';
// Renamed issues, old address -> new (pub/kernel.js FORMER_SLUGS, R-158): the page and feed under the old name stay, so
// a link or a calendar subscription made before the rename keeps working.
const FORMER = JSON.parse(/export const FORMER_SLUGS = (\{[^\n]*\});/.exec(kernel)[1]);
// Every ask a bill's page can name (pub/core.js SHARE_ASKS, read from there so the two never differ).
const SHARE_ASKS = JSON.parse(/export const SHARE_ASKS = (\[[^\]]*\]);/.exec(readFileSync(join(ROOT, 'pub/core.js'), 'utf8'))[1].replace(/'/g, '"'));
const CHECK = process.argv.includes('--check');
const OUT = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : ROOT;

const want = new Map();   // file -> html
const DEMO_FEATURED = ['HB1573', 'HB1518', 'HB1780', 'HB1839', 'HB108', 'HB10', 'HB244', 'HB939'];   // the practice copy's bills with every picture version (R-183)
async function rows(path) {
  const out = [];
  for (let from = 0; ; from += 1000) {   // the 1,000-row cap: ask in pages
    const r = await fetch(`${URL_}/rest/v1/${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
    if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
    const page = await r.json(); out.push(...page); if (page.length < 1000) return out;
  }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const spaced = n => String(n).replace(/^([A-Z]+)\s*(\d)/, '$1 $2');
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

// No og:url and no <meta http-equiv="refresh"> (R-169): see the top. Someone whose browser runs no script gets the link.
// image: the picture's path under pub/ ('og/testify/<issue>.jpg', 'og/testify.jpg', 'og.png'; tools/og_images.py).
// noindex: the practice copy's pages stay out of search.
function page({ title, desc, to, image = 'og.png', noindex = false }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Hawaiʻi Public Health Institute">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:image" content="${SITE}pub/${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script>
/* A partner's word or a campaign's utm_ words on this link go on to the tracker in place of ?via=share, so the arrival
   is counted under them (R-113, W1). */
(function () { var t = ${JSON.stringify(to)};
  try { var p = new URLSearchParams(location.search), u = new URL(t, location.href);
    if (/^[a-z0-9-]{2,40}$/i.test(p.get('via') || '')) u.searchParams.set('via', p.get('via'));
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (p.get(k)) u.searchParams.set(k, p.get(k).slice(0, 60)); });
    /* the picture version a sharer's link carried (R-183), so the friend's arrival is counted for it */
    if (/^[a-z0-9-]{2,20}$/.test(p.get('pic') || '')) u.searchParams.set('pic', p.get('pic'));
    t = u.href; } catch (e) { /* the plain address */ }
  location.replace(t); })();
</script>
</head><body style="font-family:system-ui,sans-serif;padding:24px"><p><a href="${esc(to)}">${esc(title)}</a></p><p><a href="${esc(to)}">Open HIPHI’s Bill Tracker</a></p></body></html>
`;
}

// What the cards need besides the bill (R-169): its hearings of the last 30 days (public_all_hearings keeps those) and
// their outcomes, the session's deadlines and the committees' names, so a card can say "the House Health committee" and
// "by Fri, Feb 20", the way the bill page does (stops.js billStop reads them the same way).
const bills = (await rows('public_all_bills?select=id,bill_number,session_year,chamber,stage,committee,referrals,origin_stops,last_action,died_deadline,hiphi_nickname,hiphi_summary,description,hiphi_position,hiphi_issues&hiphi_position=not.is.null&order=session_year.asc'));
const allHearings = await rows('public_all_hearings?select=id,bill_id,bill_number,committee,scheduled_at,room,status,testimony_deadline&order=scheduled_at.asc');
const hearings = allHearings.filter(h => h.status === 'scheduled');
const outcomes = Object.fromEntries((await rows('public_hearing_outcomes?select=hearing_id,outcome')).map(o => [o.hearing_id, o]));
const deadlines = await rows('public_deadlines?select=session_year,key,label,deadline_date,bills,replaces&order=sort_order.asc');
const committees = Object.fromEntries((await rows('public_committees?select=code,name,chamber')).map(c => [c.code, c]));
// The issue's id too: the bills name their issues by it (the calendar feeds below matched on it and, without it, never
// held an event, 10/5).
const issues = await rows('public_issues?select=id,slug,name,description,category,bill_ids,stance,followers');   // category: the issue picture's topic; stance and followers: the picture versions (R-183)

// The share picture versions (R-183). Which are switched on, the issues' checked words and the counts come from public views
// the page reads; anything missing (the test or the words table not made yet) means no versions are built, and the
// pages are exactly what they were. A version is built only where its picture is drawn (tools/og_images.py).
const tryRows = async path => { try { return await rows(path); } catch { return []; } };
const picTest = (await tryRows('public_ab_tests?select=key,arms,is_on,arms_on&key=eq.pic'))[0];
const liveArms = new Set(picTest && picTest.is_on ? (picTest.arms_on || picTest.arms).filter(a => ARMS.includes(a) && a !== 'today') : []);
const liveWords = wordsMap(await tryRows('public_issue_share_words?select=issue_id,slogan,before_text,after_text,island,slogan_ok,fact_ok'), { onlyChecked: true });
const countsRows = Object.fromEntries((await tryRows('public_action_counts?select=bill_id,testimonies,emails,actions')).map(c => [c.bill_id, c]));
const pics = picBuilder({ ROOT, want, page });
// A deadline by its key for this bill's session, or the budget bills' own row that replaces it (pub/core.js deadlineOf).
const deadlineFor = b => key => {
  const mine = deadlines.filter(d => +d.session_year === +b.session_year);
  const d = mine.find(x => x.replaces === key && (x.bills || []).includes(b.bill_number)) || mine.filter(x => x.key === key && !(x.bills || []).length).slice(-1)[0];
  return d ? { label: d.label, date: d.deadline_date } : null;
};
const hearingsBy = new Map();
for (const h of allHearings) { if (!hearingsBy.has(h.bill_id)) hearingsBy.set(h.bill_id, []); hearingsBy.get(h.bill_id).push(h); }
// The card's picture (R-169, Nate's pick 10/5): the ask's look for this issue, pub/og/<ask>/<issue>.jpg, once drawn; until
// then the ask's own. tools/og_wanted.json lists every issue picture in use, each marked drawn or not, for
// tools/og_images.py (the job draws the missing ones, then builds the pages again; --redraw redraws them all). A bill
// with no issue has the ask's own.
const wanted = new Map();
const pic = (img, issue) => {
  if (!issue || !/^[a-z0-9-]+$/.test(issue.slug || '')) return `og/${img}.jpg`;
  const have = existsSync(join(ROOT, 'pub', 'og', img, `${issue.slug}.jpg`));
  wanted.set(`${img}/${issue.slug}`, { img, slug: issue.slug, name: issue.name, category: issue.category || (issue.categories || [])[0] || '', have });
  return have ? `og/${img}/${issue.slug}.jpg` : `og/${img}.jpg`;
};
// The bills' and issues' pages for one set of data. The live site's go in b/ and i/; the practice copy's in b/demo/ and
// i/demo/ (below), opening the practice copy (?demo=1) and read at its own day, so a share made there shows a real card.
// pic (R-183): { arms (the versions to build pages for), words (issue id -> its share words), counts (bill -> counts or null),
// only (bill numbers to build versions for, or null for all), practice }.
function sharePages({ bills, hearingsBy, outcomes, deadlineFor, committees, issues, now, dir = '', query = 'via=share', noindex = false, pic: pv = null }) {
  const issueById = new Map(issues.filter(i => /^[a-z0-9-]+$/.test(i.slug)).map(i => [i.id, i]));
  const sub = dir ? `${dir}/` : '', up = dir ? 1 : 0;
  const goTo = (depth, hash) => `${'../'.repeat(depth + up)}track.html?${query}${hash}`;
  for (const b of bills) {   // oldest session first, so the latest wins b/<number> when a number repeats
    const n = b.bill_number.replace(/\s/g, ''), y = +b.session_year || 0;
    const state = billState(b, { hearings: hearingsBy.get(b.id) || [], outcomes, deadlineFor: deadlineFor(b), now });
    const ctx = { committees, issue: (b.hiphi_issues || []).map(id => issueById.get(id)).find(Boolean) || null };
    const card = ask => cardFor(b, ask, state, ctx);
    // b/HB1573: the bill's ask of the moment (links made before R-169, staff copies, the 404 page's guesses).
    const cur = card(state.ask), curPic = pic(cur.image, ctx.issue);
    want.set(`b/${sub}${n}.html`, page({ ...cur, image: curPic, to: goTo(1, cur.hash), noindex }));
    if (y && !dir) want.set(`b/${y}/${n}.html`, page({ ...cur, image: curPic, to: goTo(2, cur.hash) }));
    // One page per ask, at the short address (links made before C5-2) and under the year (b/2026/HB2121-testify), which
    // is what the tracker shares since C5-2 (R-199): a 2027 bill with the same number then never takes the link over.
    const asks = asksFor(b, state);
    for (const ask of asks) {
      const c = card(ask), cPic = pic(c.image, ctx.issue);
      want.set(`b/${sub}${n}-${ask}.html`, page({ ...c, image: cPic, to: goTo(1, c.hash), noindex }));
      if (y && !dir) want.set(`b/${y}/${n}-${ask}.html`, page({ ...c, image: cPic, to: goTo(2, c.hash) }));
      // The picture versions that fit this page (R-183): p/<version>/b/HB1573-testify, and under the year as well.
      if (pv && pv.arms.size && (!pv.only || pv.only.has(n))) {
        const inp = { b, ask, state, card: c, ctx, words: ctx.issue ? pv.words.get(ctx.issue.id) || null : null, counts: pv.counts(b, ctx.issue), practice: pv.practice };
        pics.add(`b/${sub}${n}-${ask}`, c, f => `${'../'.repeat(f)}track.html?${query}${c.hash}`, inp, pv.arms, noindex);
        if (y && !dir) pics.add(`b/${y}/${n}-${ask}`, c, f => `${'../'.repeat(f)}track.html?${query}${c.hash}`, inp, pv.arms, noindex);
      }
    }
    // An ask that has closed keeps its page, carrying the bill's card of the moment (C5-2; W3C, "Cool URIs don't
    // change"): it was deleted before, so an old post lost its card and a re-share got none. Only pages that exist are
    // kept this way, so no page is made for an ask that never was.
    if (!dir) for (const ask of SHARE_ASKS.filter(a => !asks.includes(a))) {
      for (const [f, depth] of [[`b/${n}-${ask}.html`, 1], ...(y ? [[`b/${y}/${n}-${ask}.html`, 2]] : [])])
        if (existsSync(join(OUT, f)) || existsSync(join(ROOT, f))) want.set(f, page({ ...cur, image: curPic, to: goTo(depth, cur.hash) }));
    }
  }
  for (const i of issues) {
    if (!/^[a-z0-9-]+$/.test(i.slug)) continue;
    const n = (i.bill_ids || []).length;
    const desc = `${cut(i.description || '', 180)} ${n ? `HIPHI is working on ${n} bill${n === 1 ? '' : 's'} on it.` : ''} Follow the issue and we’ll tell you when your voice can count.`.replace(/\s+/g, ' ').trim();
    // The ask first (R-169): following is what an issue's link asks, and its page's main button.
    want.set(`i/${sub}${i.slug}.html`, page({ title: `Follow the issue: ${i.name}`, desc, to: `${'../'.repeat(1 + up)}track.html?${query}#/issue/${i.slug}`, image: pic('follow', i), noindex }));
    if (pv && pv.arms.size && (!pv.onlyIssues || pv.onlyIssues.has(i.slug))) {
      const card = { title: `Follow the issue: ${i.name}`, desc, image: 'follow' };
      const inp = { b: null, ask: 'follow', state: null, card, ctx: { committees, issue: i }, words: pv.words.get(i.id) || null, counts: pv.counts(null, i), practice: pv.practice };
      pics.add(`i/${sub}${i.slug}`, card, f => `${'../'.repeat(f)}track.html?${query}#/issue/${i.slug}`, inp, pv.arms, noindex);
    }
    if (!dir) for (const [was, now] of Object.entries(FORMER)) if (now === i.slug) want.set(`i/${was}.html`, want.get(`i/${i.slug}.html`));
  }
}
sharePages({ bills, hearingsBy, outcomes, deadlineFor, committees, issues, pic: { arms: liveArms, words: liveWords, practice: false,
  counts: (b, i) => { const c = b ? countsRows[b.id] : null, f = i && i.followers >= 10 ? i.followers : null; return c || f ? { testimonies: c?.testimonies, emails: c?.emails, followers: f } : null; } } });

// The practice copy's pages (R-169, 10/5): built from demo/snapshot.json the way pub/demo.js shapes it, at the practice
// copy's day (Mon 16 Mar 2026, in session), so its shares preview the in-session cards ("Speak up by Wed, Mar 18: ...")
// long before January. The between-sessions practice copy (?season=off) keeps sharing the tracker's own address.
{
  const snap = JSON.parse(readFileSync(join(ROOT, 'demo', 'snapshot.json'), 'utf8'));
  const D = demoSets(snap);
  // The practice copy builds every picture version, from every draft word, for a few bills that between them show each kind
  // of page (the tester sheet, the gallery and the practice share links use them); every bill keeps today's picture.
  const featured = new Set(DEMO_FEATURED), featuredIssues = new Set(D.issues.filter(i => D.bills.some(b => featured.has(b.bill_number.replace(/\s/g, '')) && (b.hiphi_issues || []).includes(i.id))).map(i => i.slug));
  const practiceWords = wordsMap(existsSync(join(ROOT, 'demo', 'share_words.json')) ? JSON.parse(readFileSync(join(ROOT, 'demo', 'share_words.json'), 'utf8')) : [], { onlyChecked: false });
  sharePages({ ...D, dir: 'demo', query: 'demo=1&via=share', noindex: true,
    pic: { arms: new Set(ARMS.filter(a => a !== 'today')), words: practiceWords, practice: true, only: featured, onlyIssues: featuredIssues,
      counts: (b, i) => ({ testimonies: 212, emails: 87, followers: 140 }) } });
}
// The calendar feeds (R-125, the assessment's W3): cal/<issue slug>.ics, one per issue, every hearing still ahead (and the
// last week's) on the issue's bills as an event, with its testimony deadline as a second event that rings two hours before.
// A phone subscribes once (webcal://, from the issue page) and the calendar app refreshes it; this job rebuilds the file
// each morning. Nothing personal: the feed is the same for everyone.
const icsEsc = t => String(t ?? '').replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');
const icsDate = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsEvent = (uid, start, mins, title, desc, url, alarm) => ['BEGIN:VEVENT', `UID:${uid}@bills.hiphi.org`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(start)}`,
  `DTEND:${icsDate(new Date(start).getTime() + mins * 6e4)}`, `SUMMARY:${icsEsc(title)}`, `DESCRIPTION:${icsEsc(desc)}`, `URL:${url}`,
  'LOCATION:Hawaiʻi State Capitol\\, 415 S Beretania St\\, Honolulu\\, HI 96813',
  ...(alarm ? ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(title)}`, 'TRIGGER:-PT2H', 'END:VALARM'] : []), 'END:VEVENT'];
const since = Date.now() - 7 * 864e5, billsById = new Map(bills.map(b => [b.id, b]));
for (const i of issues) {
  if (!/^[a-z0-9-]+$/.test(i.slug)) continue;
  const mine = hearings.filter(h => { const b = billsById.get(h.bill_id); return b && (b.hiphi_issues || []).includes(i.id) && new Date(h.scheduled_at).getTime() > since; });
  const ev = [];
  for (const h of mine) {
    const b = billsById.get(h.bill_id), n = b.bill_number.replace(/\s/g, ''), name = b.hiphi_nickname ? `${b.hiphi_nickname} (${spaced(n)})` : spaced(n);
    const ref = `${b.session_year ? `${b.session_year}/` : ''}${n}`, url = `${SITE}track.html?via=calendar#/bill/${ref}/testify`;
    const open = h.testimony_deadline && new Date(h.testimony_deadline).getTime() > Date.now();
    if (open) ev.push(...icsEvent(`${h.bill_id}-${h.scheduled_at}-due`, h.testimony_deadline, 15, `Testimony due: ${name}`, `Send testimony in a few minutes: ${url}`, url, true));
    const cm = committeeWords(h.committee, committees).replace(/^the /, '').replace(/ committees?$/, '');
    ev.push(...icsEvent(`${h.bill_id}-${h.scheduled_at}`, h.scheduled_at, 60, `Hearing: ${name}`, `${cm} hearing${h.room ? `, ${h.room}` : ''}. Anyone can attend. ${url}`, url, false));
  }
  const cal = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI//Bill Tracker//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEsc(`HIPHI · ${i.name}`)}`,
    'X-WR-TIMEZONE:Pacific/Honolulu', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  want.set(`cal/${i.slug}.ics`, cal);
  for (const [was, now] of Object.entries(FORMER)) if (now === i.slug) want.set(`cal/${was}.ics`, cal);
}
// A share page on the live site is never deleted (C5-2, R-199): a link in an old post or text keeps its card and still
// opens the tracker, even for a bill or issue no longer on the lists. Only the practice copy's pages (b/demo/, i/demo/)
// and the calendar feeds are tidied.
let added = 0, changed = 0, removed = 0, kept = 0;
for (const dir of ['b', 'i', 'cal']) {
  const d = join(OUT, dir); if (!existsSync(d)) { if (!CHECK) mkdirSync(d); }
  const years = existsSync(d) ? readdirSync(d).filter(f => /^(\d{4}|demo)$/.test(f)) : [];   // b/2026/, one folder per session; b/demo/
  for (const sub of ['', ...years]) {
    const dd = sub ? join(d, sub) : d, keep = dir !== 'cal' && sub !== 'demo';
    for (const f of readdirSync(dd)) if (/\.(html|ics)$/.test(f) && !want.has(`${dir}/${sub ? `${sub}/` : ''}${f}`)) { if (keep) { kept++; continue; } removed++; if (!CHECK) unlinkSync(join(dd, f)); }
  }
}
// The picture versions' pages (p/<version>/...) are kept like the live pages (C5-2): a link in an old text keeps its card. Only
// the practice copy's are tidied.
if (existsSync(join(OUT, 'p'))) for (const arm of readdirSync(join(OUT, 'p'))) for (const d of ['b', 'i']) {
  const dd = join(OUT, 'p', arm, d, 'demo'); if (!existsSync(dd)) continue;
  for (const f of readdirSync(dd)) if (/\.html$/.test(f) && !want.has(`p/${arm}/${d}/demo/${f}`)) { removed++; if (!CHECK) unlinkSync(join(dd, f)); }
}
for (const [f, html] of want) {
  const p = join(OUT, f), old = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (old === html) continue; old === null ? added++ : changed++;
  if (!CHECK) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); }
}
// Every issue picture in use, for tools/og_images.py.
const wantedList = [...wanted.values()].sort((a, b) => `${a.img}/${a.slug}`.localeCompare(`${b.img}/${b.slug}`));
if (!CHECK) writeFileSync(join(ROOT, 'tools', 'og_wanted.json'), JSON.stringify(wantedList, null, 1) + '\n');
// The picture versions (R-183): which page has which versions (the tracker reads it when someone shares), and the pictures
// still to draw (tools/og_images.py reads og_wanted_pics.json; not committed, rebuilt each run).
if (!CHECK) {
  const fitSorted = Object.fromEntries(Object.entries(pics.fit).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(OUT, 'share-fit.json'), JSON.stringify(fitSorted) + '\n');
  writeFileSync(join(ROOT, 'tools', 'og_wanted_pics.json'), JSON.stringify([...pics.wantedPics].map(([file, spec]) => ({ file, spec }))) + '\n');
}
// A version picture no page uses any more (its bill's date moved, its words changed) is deleted, so the site keeps one picture for
// every page and no more (the repository stays small, R-183). A page counts if it is in p/ at all, kept or rebuilt just now, and
// the gallery's pictures count too.
if (!CHECK && existsSync(join(OUT, 'pub', 'og', 't'))) {
  const used = new Set(), gal = join(ROOT, 'tools', 'og_wanted_gallery.json');
  if (existsSync(gal)) for (const w of JSON.parse(readFileSync(gal, 'utf8'))) used.add(w.file);
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  if (existsSync(join(OUT, 'p'))) for (const f of walk(join(OUT, 'p'))) { const m = /og:image" content="[^"]*\/pub\/(og\/t\/[^"]+\.jpg)"/.exec(readFileSync(f, 'utf8')); if (m) used.add(m[1]); }
  let pruned = 0;
  for (const f of walk(join(OUT, 'pub', 'og', 't'))) { const rel = f.slice(join(OUT, 'pub').length + 1); if (/\.jpg$/.test(f) && !used.has(rel)) { unlinkSync(f); pruned++; } }
  if (pruned) console.log(`${pruned} version pictures no page uses were removed`);
}
console.log(`${Object.keys(pics.fit).length} pages with picture versions; ${pics.wantedPics.size} pictures to draw`);
console.log(`${wantedList.length} issue pictures in use, ${wantedList.filter(w => !w.have).length} to draw`);
console.log(`${want.size} share pages (${bills.length} bills, ${issues.length} issues): ${added} new, ${changed} changed, ${removed} removed, ${kept} older pages kept as they are${CHECK ? ' (check only, nothing written)' : ''}`);
