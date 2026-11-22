// Legislator page, style B (R-398 drawing opt_b_*.png): tabs Now · Bills · N · Talks and asks · N · About. The switch is inside Now and Bills only. About is hidden on the live app
// (its staff-entered facts wait for migration 206). role=tablist with arrow keys, Home and End; only the chosen tab is in the tab order.
export function renderB(s) {
  const tabs = [['now', 'Now'], ['bills', `Bills <span class="lpmut">· ${s.counts.bills}</span>`], ['talks', `Talks and asks <span class="lpmut">· ${s.counts.talks}</span>`]];
  if (s.extras) tabs.push(['about', 'About']);
  const cur = tabs.some(t => t[0] === s.tab) ? s.tab : 'now';
  const panel = { now: () => s.sw() + s.now() + s.latest({ allOpen: false }), bills: () => s.sw() + s.bills(), talks: () => s.notesAll() + s.asks() + s.testimony(), about: () => s.about() };
  return `<div class="lpcol"><div class="lptabs" role="tablist" aria-label="About this legislator">${tabs.map(([k, t]) => `<button class="lptab" role="tab" type="button" id="lpTab-${k}" data-tab="${k}" aria-selected="${k === cur}" aria-controls="lpPanel" tabindex="${k === cur ? 0 : -1}">${t}</button>`).join('')}</div>`
    + `<div id="lpPanel" role="tabpanel" aria-labelledby="lpTab-${cur}" tabindex="0">${panel[cur]()}</div></div>`;
}
export function bindTabs(root, pick) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => pick(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const j = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
      if (j === undefined) return; e.preventDefault(); pick(tabs[j].dataset.tab);
    });
  });
}
