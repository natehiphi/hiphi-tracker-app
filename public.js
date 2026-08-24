// ============================================================
// HIPHI Bill Tracker — PUBLIC page (no sign-in)
// Reads only the anon-visible views: public_bills, public_hearings.
// January flip: set SESSION_OVER = false and update the session line
// in the header template below (see JANUARY.md in the Bill-Tracker repo).
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const SESSION_YEAR = 2026;
const SESSION_OVER = true;

const STAGE_LABEL = { introduced:'Introduced', first_triple:'1st Triple', first_lateral:'1st Lateral',
  first_decking:'1st Decking', first_crossover:'Crossover', second_triple:'2nd Triple',
  second_lateral:'2nd Lateral', second_decking:'2nd Decking', second_crossover:'Passed Both',
  conference:'Conference', governor:'Governor', enacted:'Law', vetoed:'Vetoed', dead:'Dead' };
const RAIL = [['introduced','Intro'],['first_lateral','1st<br>Lat'],['first_decking','1st<br>Deck'],
  ['first_crossover','Cross'],['second_lateral','2nd<br>Lat'],['second_decking','2nd<br>Deck'],
  ['conference','Conf'],['governor','Gov'],['enacted','Law']];
const RAIL_IDX = { introduced:0, first_triple:1, first_lateral:1, first_decking:2, first_crossover:3,
  second_triple:4, second_lateral:4, second_decking:5, second_crossover:5, conference:6, governor:7,
  enacted:8, vetoed:7, dead:null };

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtDate = (d, opts) => d ? new Date(d).toLocaleString('en-US',
  { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric', ...opts }) : '—';
const fmtDT = d => fmtDate(d, { hour: 'numeric', minute: '2-digit' });

// ===PURE-START=== (unit-tested in node)
function groupRows(rows) {
  // public_bills has one row per (bill, campaign); fold to one bill each
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.bill_number)) map.set(r.bill_number, { ...r, campaigns: [] });
    const b = map.get(r.bill_number);
    if (r.campaign && !b.campaigns.some(c => c.slug === r.campaign_slug))
      b.campaigns.push({ name: r.campaign, slug: r.campaign_slug || r.campaign });
  }
  return [...map.values()].sort((a, b) => a.bill_number.localeCompare(b.bill_number));
}
function diedish(b, hasUpcomingHearing) {
  const st = b.stage || 'introduced';
  if (st === 'dead' || st === 'vetoed') return true;
  if (hasUpcomingHearing) return false;
  if (/deferred|failed to pass/i.test(b.last_action || '')) return true;
  return SESSION_OVER && !['enacted', 'governor'].includes(st);
}
const SECTIONS = [
  ['SUPPORT', b => b.position === 'support'],
  ['SUPPORT WITH AMENDMENTS', b => b.position === 'support_amend'],
  ['OPPOSE', b => b.position === 'oppose'],
  ['COMMENT', b => b.position === 'neutral'],
  ['MONITORING', b => !b.position || b.position === 'monitor'],
];
const headClass = b => ({ support:'solid-g', oppose:'solid-r', support_amend:'hatch-g',
  neutral:'hatch-t' }[b.position] || 'plain');
const posLabel = b => ({ support:'SUPPORT', support_amend:'SUPPORT W/ AMENDMENTS',
  oppose:'OPPOSE', neutral:'COMMENT' }[b.position] || 'MONITOR');
const ctaVerb = b => ({ support: 'Testify in SUPPORT', support_amend: 'Testify in support, with amendments',
  oppose: 'Testify in OPPOSITION', neutral: 'Submit comments' }[b.position] || 'Submit testimony');
function actionItems(bills, hearings, now) {
  // One action per bill: a curated ask (already expiry-guarded by the view)
  // wins; otherwise an open testimony window. Sorted by soonest deadline.
  const items = [];
  for (const b of bills) {
    const h = hearings.filter(x => x.bill_number === b.bill_number &&
        new Date(x.scheduled_at) > now)
      .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0] || null;
    const ask = b.public_action || null;
    const autoOk = h && h.testimony_deadline && new Date(h.testimony_deadline) > now;
    if (!ask && !autoOk) continue;
    const due = ask ? (b.public_action_until ? b.public_action_until + 'T23:59:59-10:00' : null)
                    : h.testimony_deadline;
    items.push({ b, h, ask, due });
  }
  return items.sort((x, y) => String(x.due || '9999').localeCompare(String(y.due || '9999')));
}
// ===PURE-END===

function pvRail(b) {
  const dead = diedish(b, hearingsFor(b).length > 0);
  let idx = RAIL_IDX[b.stage]; if (idx == null) idx = 0;
  return `<div class="pv-rail">${RAIL.map(([v, l], i) => `
    <div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx && !dead ? 'now' : (i === idx ? 'done' : '')}">
      <span class="sq"></span><span class="sl">${l}</span></div>`).join('')}</div>`;
}

let BILLS = [], HEARINGS = [], CAMP = '';
const hearingsFor = b => HEARINGS.filter(h => h.bill_number === b.bill_number &&
  new Date(h.scheduled_at) > new Date());

function card(b) {
  const dead = diedish(b, hearingsFor(b).length > 0);
  const h = hearingsFor(b)[0];
  return `<div class="pv-card ${dead ? 'dead' : ''}">
    <div class="pv-head ${headClass(b)}">${posLabel(b)}</div>
    ${dead ? '<div class="pv-stamp">DID NOT ADVANCE</div>' : ''}
    <div class="pv-body">
      <div class="pv-meta"><span class="pv-bno">${esc(b.bill_number)}</span>
        ${b.campaigns.map(c => `<span class="pv-tag coal">${esc(c.name)}</span>`).join('')}</div>
      <div class="pv-title">${esc(b.title || '')}</div>
      ${b.public_summary ? `<div class="pv-desc">${esc(b.public_summary)}</div>` : ''}
      <div class="pv-kv">
        <span class="k">Latest</span><span>${esc(b.last_action || b.status_text || '—')}
          <span class="date">${fmtDate(b.last_action_date, { year: '2-digit' })}</span></span>
        ${h ? `<span class="k">Hearing</span><span>${esc(h.committee)} · ${fmtDT(h.scheduled_at)}
          · ${esc(h.room || 'room TBD')}${h.testimony_deadline ?
          ` · <b>testimony due ${fmtDT(h.testimony_deadline)}</b>` : ''}</span>` : ''}
      </div>
      ${pvRail(b)}
    </div>
    <div class="pv-foot">${b.state_url ?
      `<a href="${esc(b.state_url)}" target="_blank" rel="noopener">Official page ↗</a>` : '<span></span>'}
      <span style="color:var(--ptealD)">${STAGE_LABEL[b.stage] || ''}</span></div>
  </div>`;
}

function render() {
  const list = CAMP ? BILLS.filter(b => b.campaigns.some(c => c.slug === CAMP)) : BILLS;
  const upcoming = HEARINGS.filter(h => new Date(h.scheduled_at) > new Date())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const enacted = list.filter(b => b.stage === 'enacted').length;
  const gone = list.filter(b => diedish(b, hearingsFor(b).length > 0)).length;
  const campCounts = {};
  BILLS.forEach(b => b.campaigns.forEach(c => {
    campCounts[c.slug] = campCounts[c.slug] || { name: c.name, n: 0 }; campCounts[c.slug].n++; }));
  const acts = actionItems(list, HEARINGS, new Date());
  const tix = acts.slice(0, 8).map(a => {
    const hrs = a.due ? (new Date(a.due) - Date.now()) / 36e5 : null;
    const due = hrs == null ? '' : hrs < 48
      ? `<div class="due">DUE IN ${Math.max(0, Math.round(hrs))}H</div>`
      : `<div class="due">BY ${fmtDate(a.due)}</div>`;
    const what = a.ask ? esc(a.ask)
      : `${ctaVerb(a.b)} — ${esc(a.h.committee)} hearing ${fmtDT(a.h.scheduled_at)} · ${esc(a.h.room || 'room TBD')}`;
    return `<div class="pv-tick" style="min-width:230px;max-width:340px">
      <div class="bn">${esc(a.b.bill_number)} · ${posLabel(a.b)}</div>
      <div class="when">${what}</div>${due}
      ${a.b.state_url ? `<a href="${esc(a.b.state_url)}" target="_blank" rel="noopener" style="font-size:11px">Bill page ↗</a>` : ''}
    </div>`; }).join('');
  const active = list.filter(b => !diedish(b, hearingsFor(b).length > 0));
  const done = list.filter(b => diedish(b, hearingsFor(b).length > 0))
    .sort((a, b) => (a.position || 'z').localeCompare(b.position || 'z') ||
      a.bill_number.localeCompare(b.bill_number));

  $('#app').innerHTML = `
    <div class="top">
      <span class="logo"><span class="mark">☀</span>HIPHI Bill Tracker</span>
      <span class="fresh">${SESSION_YEAR} legislative session${SESSION_OVER ?
        ' · adjourned sine die — final outcomes shown' : ''} · updated daily</span>
    </div>
    <div class="pv">
      ${acts.length ? `<div class="pv-testify"><div class="h"><span class="t">TAKE ACTION NOW</span>
        <span class="s">What you can do today on the bills we follow</span></div>
        <div class="pv-tix">${tix}</div></div>` : ''}
      <div class="pv-stats">
        <div class="pv-stat"><div class="v pdisp">${list.length}</div><div class="l">Bills followed</div></div>
        <div class="pv-stat"><div class="v pdisp">${upcoming.length}</div><div class="l">Hearings scheduled</div></div>
        <div class="pv-stat"><div class="v pdisp">${enacted}</div><div class="l">Enacted</div></div>
        <div class="pv-stat"><div class="v pdisp">${gone}</div><div class="l">Did not advance</div></div>
      </div>
      <div class="pv-tabs"><button class="pv-tab ${!CAMP ? 'on' : ''}" data-camp="">All<span class="n">${BILLS.length}</span></button>
        ${Object.entries(campCounts).sort((a, b) => b[1].n - a[1].n).map(([slug, c]) =>
          `<button class="pv-tab ${CAMP === slug ? 'on' : ''}" data-camp="${esc(slug)}">${esc(c.name)}<span class="n">${c.n}</span></button>`).join('')}
      </div>
      ${SECTIONS.map(([label, fn]) => { const bs = active.filter(fn); return bs.length ? `
        <div class="pv-sechead">${label}</div>
        <div class="pv-grid">${bs.map(card).join('')}</div>` : ''; }).join('')}
      ${done.length ? `<div class="pv-sechead">DID NOT ADVANCE — ${SESSION_YEAR} SESSION</div>
        <div class="pv-grid">${done.map(card).join('')}</div>` : ''}
      <div style="text-align:center;color:var(--muted);font-size:12px;padding:26px 12px 40px">
        Maintained by the Hawai‘i Public Health Institute · Positions shown are HIPHI's.<br>
        Bill data from the Hawai‘i State Legislature (capitol.hawaii.gov), synced daily.
      </div>
    </div>`;
  document.querySelectorAll('[data-camp]').forEach(el =>
    el.onclick = () => { CAMP = el.dataset.camp; render(); });
}

(async () => {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    const [bills, hearings] = await Promise.all([
      supa.from('public_bills').select('*').order('bill_number').limit(3000),
      supa.from('public_hearings').select('*'),
    ]);
    if (bills.error) throw bills.error;
    BILLS = groupRows(bills.data || []);
    HEARINGS = hearings.data || [];
    render();
  } catch (e) {
    $('#app').innerHTML = `<div class="boot">Could not load bill data: ${esc(e.message)}<br><br>
      <button class="btn" onclick="location.reload()">Retry</button></div>`;
  }
})();
