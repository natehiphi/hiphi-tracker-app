// "What kind of advocate are you?" (R-217, a draft for Nate's yes or no; the words and scoring are pub/quiz-data.js).
// A person comes here to find the one way of helping that fits them, and to try one small step (DESIGN.md B-1).
// Five one-tap questions, then one of four ways to help and ONE step. No score, no timer, no account (DESIGN.md C-7, C-13).
// Each step has its own address (#/quiz/1 to #/quiz/5, #/quiz/result) so a phone's back gesture and the on-screen Back do the
// same thing (B-4) and a picked answer stays picked when the person goes back. The result is kept on this device (hiphi_quiz),
// nowhere else; nothing is counted yet (that needs a database change, and Nate's yes, after he has seen it).
// A draft: the address works only in the practice copy (?demo=1); parseRoute in app.js sends anyone else to Home until it is
// approved. Where it would live once approved: More, and the Mahalo's "Bring one friend along".
import { DEMO, esc, icon, toast, app } from './core.js';
import { btn } from './ui.js';
import { burst } from './fx.js';
import { QUESTIONS, TYPES, SHARE_TEXT, INTRO, resultOf } from './quiz-data.js';

const KEY = 'hiphi_quiz', PICKS = 'hiphi_quiz_picks', N = QUESTIONS.length;
const saved = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && TYPES[v.type] ? v.type : null; } catch { return null; } };
const keep = type => { try { localStorage.setItem(KEY, JSON.stringify({ type })); } catch { /* the result still shows */ } };
// The answers so far live for this visit (a reload on question 3 keeps the first two).
const loadPicks = () => { try { const v = JSON.parse(sessionStorage.getItem(PICKS) || '[]'); return Array.isArray(v) ? v.slice(0, N) : []; } catch { return []; } };
const Q = { picks: loadPicks(), hist: false, celebrate: false, drawn: 0, key: '' };
const savePicks = () => { try { sessionStorage.setItem(PICKS, JSON.stringify(Q.picks)); } catch { /* kept in memory */ } };
// (a plain loop: `every` skips the empty slots of a half-filled array)
const have = n => { for (let i = 0; i < n; i++) if (!Q.picks[i]) return false; return true; };
const complete = () => have(N);
const go = to => { Q.hist = true; location.hash = to; };

function intro() {
  return `<div class="qz"><div class="pagehead"><h1 class="hero" id="qz-h" tabindex="-1">What kind of advocate are you?</h1>
    <p class="lede">${esc(INTRO)}</p></div>
    ${btn('Start', { kind: 'primary', full: true, iconEnd: 'arrow-right', attrs: { 'data-qz': 'start' } })}</div>`;
}

function question(n) {
  const item = QUESTIONS[n - 1], chosen = Q.picks[n - 1];
  return `<div class="qz">
    <h1 class="qz-h" id="qz-h" tabindex="-1"><span class="qz-count">Question ${n} of ${N}</span><span class="qz-q">${esc(item.q)}</span></h1>
    <div class="qz-opts qz-nohover" role="group" aria-labelledby="qz-h">
      ${item.a.map(([k, text]) => `<button type="button" class="qz-opt${chosen === k ? ' qz-picked' : ''}" data-pick="${k}" aria-pressed="${chosen === k}">${esc(text)}</button>`).join('')}
    </div>
    ${n > 1 ? `<p class="qz-nav">${btn('Back', { kind: 'text', icon: 'arrow-left', attrs: { 'data-qz': 'back' } })}</p>` : ''}
  </div>`;
}

function result(type) {
  const t = TYPES[type], s = t.step, share = s.to === 'share';
  return `<div class="qz qz-result">
    <span class="qz-badge" id="qz-badge">${icon(t.icon, { size: '32px' })}</span>
    <h1 class="qz-h qz-rh" id="qz-h" tabindex="-1"><span class="qz-count">Your way to help</span><span class="qz-name">${esc(t.name)}</span></h1>
    <p class="lede">${esc(t.line)}</p>
    <p class="qz-body">${esc(t.body)}</p>
    <div class="qz-step card">
      <h2 class="qz-steph">Your one step</h2>
      <p>${esc(s.text)}</p>
      ${share ? btn(s.label, { kind: 'primary', full: true, icon: 'share-2', attrs: { 'data-qz': 'share' } }) : btn(s.label, { kind: 'primary', full: true, iconEnd: 'arrow-right', href: s.to })}
    </div>
    <p class="qz-more">${share ? btn('Or choose an issue to follow', { kind: 'text', iconEnd: 'arrow-right', href: '#/find' }) : btn('Send this quiz to a friend', { kind: 'text', icon: 'share-2', attrs: { 'data-qz': 'share' } })}</p>
    <p class="qz-more">${btn('Take it again', { kind: 'text', icon: 'rotate-ccw', attrs: { 'data-qz': 'again' } })}</p>
  </div>`;
}

// The phone's own share menu when there is one, else the link is copied (the way "Keep your issues" does).
async function send() {
  const url = `${location.origin}${location.pathname}?${DEMO ? 'demo=1&' : ''}via=quiz#/quiz`;
  try { if (navigator.share) { await navigator.share({ title: 'What kind of advocate are you?', text: SHARE_TEXT, url }); toast('Sent. Mahalo!'); return; } }
  catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${SHARE_TEXT} ${url}`); toast('Link copied. Paste it in a text.'); }
  catch { toast('Could not copy. Copy the address from your browser instead.'); }
}

// What the address asks for, and what we can show: a question needs the answers before it; the result needs all five (or a
// kept one). Anything else is the start, with the address made plain so Back does not loop.
function plan(route) {
  const step = route.step || 0;
  if (step >= 1 && step <= N && have(step - 1)) return { view: 'q', n: step };
  if (step === 6 && complete()) return { view: 'r', type: resultOf(Q.picks) };
  if (step === 6 && saved()) return { view: 'r', type: saved() };
  if (step === 0 && saved()) return { view: 'r', type: saved() };
  return { view: 'start', fix: step !== 0 };
}

export default {
  tab: 'more',
  title: () => 'What kind of advocate are you?',
  render(route) {
    const v = plan(route); Q.drawn = Date.now(); Q.v = v;
    if (v.fix) history.replaceState(history.state, '', '#/quiz');
    return v.view === 'q' ? question(v.n) : v.view === 'r' ? result(v.type) : intro();
  },
  wire() {
    const root = document.getElementById('main'); if (!root) return;
    // A step changed: the screen reader and the keyboard land on the new heading, which reads the count with the question.
    if (Q.key !== location.hash) { Q.key = location.hash; document.getElementById('qz-h')?.focus({ preventScroll: true }); window.scrollTo(0, 0); }
    // Answers sit in the same place on every question, so a double-tap would answer two; taps in the first moments are ignored.
    // A cursor left over the first answer must not look like a choice, so the hover look waits for the pointer to move.
    const opts = root.querySelector('.qz-opts'); if (opts) opts.addEventListener('pointermove', () => opts.classList.remove('qz-nohover'), { once: true });
    root.querySelectorAll('[data-qz]').forEach(el => el.onclick = () => {
      const k = el.dataset.qz;
      if (k === 'start') go('#/quiz/1');
      else if (k === 'back') { const n = Q.v?.n || 2; if (Q.hist && history.length > 1) history.back(); else location.hash = `#/quiz/${n - 1}`; }
      else if (k === 'again') { Q.picks = []; savePicks(); go('#/quiz/1'); }
      else if (k === 'share') send();
    });
    root.querySelectorAll('[data-pick]').forEach(el => el.onclick = () => {
      if (Date.now() - Q.drawn < 350) return;
      const n = Q.v.n; Q.picks[n - 1] = el.dataset.pick; savePicks();
      if (n < N) return go(`#/quiz/${n + 1}`);
      if (!complete()) { let i = 0; while (Q.picks[i]) i++; return go(`#/quiz/${i + 1}`); }
      keep(resultOf(Q.picks)); Q.celebrate = true; go('#/quiz/result');
    });
    // A small celebration for a finished quiz, sized like the other small wins (DESIGN.md C-7; the motion honours Reduce Motion).
    if (Q.celebrate && Q.v?.view === 'r') { Q.celebrate = false; const b = document.getElementById('qz-badge'); if (b) burst(b); }
  },
};
