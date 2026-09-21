// The one truly stateful, async piece of "find my legislators by address": type a street address, wait for a
// pause in typing, fetch suggestions from our address table, then resolve a pick (or a freely typed address) to
// its Senate and House districts. Extracted out of pub/people.js (HANDOFF 3.5: the full finder's address lookup
// "is stateful and async, so it needs extracting, not copying") so both the full Legislators finder and the
// onboarding wizard's own address step can each run an independent instance instead of sharing one singleton.
// Everything else about address lookup - ranking suggestions against towns and people, formatting a result,
// drawing the page - stays where it was; this factory only owns the debounced fetch and its result cache.
import { looksLikeAddress, fetchAddrSuggest, legLookupAddress } from './core.js';

export function createAddressPicker() {
  let addr = null;      // { q, results } for the most recently fetched query
  let latestQ = '';      // the last query this instance was asked to search, so a slow response can tell it is stale
  let loading = false;
  let timer = 0;

  // Called on every keystroke. Only ZIP-shaped and address-shaped text triggers a fetch; onDone repaints the
  // caller's suggestion list once fresh results land, but never for a query that has since been typed over.
  function search(q, onDone) {
    latestQ = q;
    clearTimeout(timer);
    if (!looksLikeAddress(q) || /^\d{5}$/.test(q) || (addr && addr.q === q)) { loading = false; return; }
    loading = true;
    timer = setTimeout(async () => {
      let results; try { results = await fetchAddrSuggest(q); } catch { results = []; }
      if (latestQ !== q) return;   // superseded by later typing
      addr = { q, results }; loading = false; onDone();
    }, 250);
  }
  const results = q => (addr && addr.q === q) ? addr.results : [];
  const isLoading = () => loading;
  // A chosen suggestion (pt carries its own lat/lon or district numbers) or a freely typed address, to districts.
  const resolve = (query, pt) => legLookupAddress(query, pt || null);

  return { search, results, isLoading, resolve };
}
