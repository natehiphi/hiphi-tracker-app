# Shared page checks for the public tracker redesign (plan section 10). Import from journey.py.
import re, json

EMOJI_JS = r"""(() => {
  const bad = /[\p{Extended_Pictographic}✓✕★☆↗→←▸▾▴◷☰＋‹›▶⚡]/u;
  const out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const t = n.nodeValue; if (bad.test(t) && n.parentElement && n.parentElement.offsetParent !== null && !n.parentElement.closest('.band')) out.push(t.trim().slice(0, 60)); }
  document.querySelectorAll('[aria-label],[title]').forEach(e => { const t = (e.getAttribute('aria-label') || '') + (e.getAttribute('title') || ''); if (bad.test(t)) out.push('attr:' + t.slice(0, 60)); });
  return out;
})()"""

TARGETS_JS = r"""(() => {
  const out = [];
  document.querySelectorAll('a, button, input, select, textarea, summary, [role=button], [tabindex="0"]').forEach(e => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(e).visibility === 'hidden') return;
    if (e.closest('.skip')) return;
    // links inside running text are exempt (WCAG 2.5.8 inline exception)
    if (e.tagName === 'A' && e.closest('p, li') && !e.classList.contains('btn') && !e.classList.contains('row')) return;
    if (e.type === 'checkbox' || e.type === 'radio') { const l = e.closest('label'); if (l) { const lr = l.getBoundingClientRect(); if (lr.height >= 43.5) return; } }
    if (r.height < 43.5 || r.width < 43.5) out.push(`${e.tagName.toLowerCase()}.${(e.className && e.className.baseVal === undefined ? e.className : '').toString().split(' ').slice(0,2).join('.')} "${(e.innerText || e.getAttribute('aria-label') || '').trim().slice(0,30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
  });
  return out;
})()"""

FONTS_JS = r"""(() => {
  const sizes = new Set(), small = [], inputs = [];
  const w = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || el.offsetParent === null) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize); sizes.add(fs); }
  document.querySelectorAll('input:not([type=checkbox]):not([type=radio]), textarea, select').forEach(e => { if (e.offsetParent === null) return; const fs = parseFloat(getComputedStyle(e).fontSize); if (fs < 16) inputs.push(`${e.id || e.name || e.type}:${fs}`); });
  return { sizes: [...sizes].sort((a, b) => a - b), inputs };
})()"""

OVERFLOW_JS = "document.documentElement.scrollWidth > document.documentElement.clientWidth + 1"

TEXT_JS = "(document.querySelector('main') || document.body).innerText"

def syllables(word):
    w = word.lower()
    w = re.sub(r'[^a-z]', '', w)
    if not w: return 0
    if len(w) <= 3: return 1
    w = re.sub(r'(?:[^laeiouy]es|ed|[^laeiouy]e)$', '', w)
    w = re.sub(r'^y', '', w)
    return max(1, len(re.findall(r'[aeiouy]{1,2}', w)))

def fk_grade(text):
    sents = [s for s in re.split(r'[.!?]+\s|\n+', text) if len(s.split()) >= 3]
    words = [w for s in sents for w in s.split() if re.search(r'[A-Za-z]', w)]
    if not sents or not words: return 0
    syl = sum(syllables(w) for w in words)
    return round(0.39 * (len(words) / len(sents)) + 11.8 * (syl / len(words)) - 15.59, 1)

AXE = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'
def axe(pg):
    try:
        pg.add_script_tag(url=AXE)
        res = pg.evaluate("""async () => { const r = await axe.run(document, { resultTypes: ['violations'] });
          return r.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes.slice(0,2).map(x => x.target.join(' ')) })); }""")
        return res
    except Exception as e:
        return [{'id': 'axe-failed', 'err': str(e)[:120]}]

def page_report(pg, name, do_axe=False):
    r = {'screen': name}
    r['emoji'] = pg.evaluate(EMOJI_JS)
    r['small_targets'] = pg.evaluate(TARGETS_JS)
    f = pg.evaluate(FONTS_JS); r['font_sizes'] = f['sizes']; r['small_inputs'] = f['inputs']
    r['overflow'] = pg.evaluate(OVERFLOW_JS)
    r['fk'] = fk_grade(pg.evaluate(TEXT_JS))
    if do_axe: r['axe'] = axe(pg)
    return r
