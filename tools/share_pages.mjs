// Share pages: one tiny page per bill HIPHI has a position on (b/HB2121.html) and per issue (i/<slug>.html), so a link
// (and, since R-125, one calendar feed per issue, cal/<slug>.ics, for phones to subscribe to)
// pasted into a text or a post previews with the bill's own name and what it does, instead of the tracker's general
// card (R-067). The tracker's bill pages are addresses after a # (#/bill/HB2121), which no link preview can read. Each
// page sends a person straight on to the tracker (?via=share, so arrivals by shared link are counted as such) and gives
// a preview robot the title, description and picture. Bill numbers start again every session (R-110): b/HB2121 is the
// latest session's bill of that number, b/2026/HB2121 that session's, and every page sends people to the exact bill it
// describes (#/bill/2026/HB2121), so a link shared in 2026 still opens the 2026 bill in 2027.
//
//   node tools/share_pages.mjs            writes b/ and i/ from the live public views (read-only, the public key)
//   node tools/share_pages.mjs --check    says what would change, writes nothing
//
// Run daily by .github/workflows/share-pages.yml, which commits the pages when they changed. Only public views are read
// (public_all_bills, public_issues), with the publishable key the public page already carries.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const core = readFileSync(join(ROOT, 'pub/core.js'), 'utf8');
const URL_ = /SUPABASE_URL\s*=\s*'([^']+)'/.exec(core)[1], KEY = /SUPABASE_KEY\s*=\s*'([^']+)'/.exec(core)[1];
const SITE = 'https://natehiphi.github.io/hiphi-tracker-app/';
const CHECK = process.argv.includes('--check');

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
const POS = { strongly_support: 'HIPHI strongly supports it.', support: 'HIPHI supports it.', support_amend: 'HIPHI supports it with changes.',
  strongly_oppose: 'HIPHI strongly opposes it.', oppose: 'HIPHI opposes it.', neutral: 'HIPHI is following it.', monitor: 'HIPHI is watching it.' };

function page({ title, desc, to, self }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Hawaiʻi Public Health Institute">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(self)}">
<meta property="og:image" content="${SITE}pub/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url=${esc(to)}">
<script>
/* A partner's word or a campaign's utm_ words on this link go on to the tracker in place of ?via=share, so the arrival
   is counted under them (R-113, W1). */
(function () { var t = ${JSON.stringify(to)};
  try { var p = new URLSearchParams(location.search), u = new URL(t, location.href);
    if (/^[a-z0-9-]{2,40}$/i.test(p.get('via') || '')) u.searchParams.set('via', p.get('via'));
    ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (p.get(k)) u.searchParams.set(k, p.get(k).slice(0, 60)); });
    t = u.href; } catch (e) { /* the plain address */ }
  location.replace(t); })();
</script>
</head><body style="font-family:system-ui,sans-serif;padding:24px"><p><a href="${esc(to)}">${esc(title)}</a></p></body></html>
`;
}

const bills = (await rows('public_all_bills?select=id,bill_number,session_year,hiphi_nickname,hiphi_summary,description,hiphi_position,hiphi_issues&hiphi_position=not.is.null&order=session_year.asc'));
const hearings = await rows('public_all_hearings?select=bill_id,bill_number,committee,scheduled_at,room,status,testimony_deadline&status=eq.scheduled&order=scheduled_at.asc');
const issues = await rows('public_issues?select=slug,name,description,bill_ids');
const want = new Map();   // file -> html
for (const b of bills) {   // oldest session first, so the latest wins b/<number> when a number repeats
  const n = b.bill_number.replace(/\s/g, ''), y = +b.session_year || 0, name = b.hiphi_nickname;
  const title = `${name ? `${name} (${spaced(n)})` : spaced(n)} · HIPHI Bill Tracker`;
  const desc = `${cut(b.hiphi_summary || b.description || '', 180)} ${POS[b.hiphi_position] || ''} Follow it and speak up in a few minutes.`.replace(/\s+/g, ' ').trim();
  const hash = `#/bill/${y ? `${y}/` : ''}${n}`;   // the exact bill, by its session (R-110)
  want.set(`b/${n}.html`, page({ title, desc, to: `../track.html?via=share${hash}`, self: `${SITE}b/${n}` }));
  if (y) want.set(`b/${y}/${n}.html`, page({ title, desc, to: `../../track.html?via=share${hash}`, self: `${SITE}b/${y}/${n}` }));
}
for (const i of issues) {
  if (!/^[a-z0-9-]+$/.test(i.slug)) continue;
  const n = (i.bill_ids || []).length;
  const desc = `${cut(i.description || '', 180)} ${n ? `HIPHI is working on ${n} bill${n === 1 ? '' : 's'} on it.` : ''} Follow the issue and we’ll tell you when your voice can count.`.replace(/\s+/g, ' ').trim();
  want.set(`i/${i.slug}.html`, page({ title: `${i.name} · HIPHI Bill Tracker`, desc, to: `../track.html?via=share#/issue/${i.slug}`, self: `${SITE}i/${i.slug}` }));
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
    ev.push(...icsEvent(`${h.bill_id}-${h.scheduled_at}`, h.scheduled_at, 60, `Hearing: ${name}`, `${h.committee} hearing${h.room ? `, ${h.room}` : ''}. Anyone can attend. ${url}`, url, false));
  }
  const cal = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI//Bill Tracker//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${icsEsc(`HIPHI · ${i.name}`)}`,
    'X-WR-TIMEZONE:Pacific/Honolulu', 'REFRESH-INTERVAL;VALUE=DURATION:PT12H', 'X-PUBLISHED-TTL:PT12H', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  want.set(`cal/${i.slug}.ics`, cal);
}
let added = 0, changed = 0, removed = 0;
for (const dir of ['b', 'i', 'cal']) {
  const d = join(ROOT, dir); if (!existsSync(d)) { if (!CHECK) mkdirSync(d); }
  const years = existsSync(d) ? readdirSync(d).filter(f => /^\d{4}$/.test(f)) : [];   // b/2026/, one folder per session
  for (const sub of ['', ...years]) {
    const dd = sub ? join(d, sub) : d;
    for (const f of readdirSync(dd)) if (/\.(html|ics)$/.test(f) && !want.has(`${dir}/${sub ? `${sub}/` : ''}${f}`)) { removed++; if (!CHECK) unlinkSync(join(dd, f)); }
  }
}
for (const [f, html] of want) {
  const p = join(ROOT, f), old = existsSync(p) ? readFileSync(p, 'utf8') : null;
  if (old === html) continue; old === null ? added++ : changed++;
  if (!CHECK) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, html); }
}
console.log(`${want.size} share pages (${bills.length} bills, ${issues.length} issues): ${added} new, ${changed} changed, ${removed} removed${CHECK ? ' (check only, nothing written)' : ''}`);
