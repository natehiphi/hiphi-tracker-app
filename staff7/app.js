// Staff7's gate: draws the practice copy, or says this page is practice-only for now; nothing live is imported before that is decided.
// The test is the data layer's own (staff6/data.js DEMO), so the two can never disagree. frame.js (the app) is loaded only when it passes.
if (new URLSearchParams(location.search).has('demo')) {
  import('./frame.js').catch(e => { console.error(e); document.getElementById('app').innerHTML = '<div class="msg"><h1>We could not load the practice copy</h1><p>Reload the page to try again.</p></div>'; });
} else {
  const u = new URL(location.href); u.searchParams.set('demo', '1');
  const a = document.getElementById('app');
  a.innerHTML = '<div class="msg"><h1>This page is a practice copy for now.</h1><p>Nothing here is live, and nothing you do here is saved.</p><p><a class="btn filled" id="goPractice">Open the practice copy</a></p></div>';
  document.getElementById('goPractice').href = u.toString();
}
