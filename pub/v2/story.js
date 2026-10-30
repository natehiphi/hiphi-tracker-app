// Version 2's story card (R-357 part 4, Nate's pick of 30 Oct 2026: "the first visit in seven taps"). The story, "How a bill becomes law"
// (four short pages with two choices, pub/lessons.js, on the person's own bill), left the first visit. It is one card on Home for a
// newcomer instead, opened when they choose it: DESIGN C-12 (teaching is shown, not hidden, and now offered at the moment they have a
// bill of their own to care about).
//
// Home (pub/calm/home.js, another build's file) draws the card when `app.v2()` is on:
//     import { storyCard } from '../v2/story.js';
//     const story = storyCard();            // { html, wire } ; html is '' when there is nothing to show
//     ... put story.html where the card goes (under the slide), then after the page is drawn: story.wire(root)
// Reading it opens the story's own page, #/learn/story, in the first visit's frame (the first visit's drawing, Back, Next and a last
// button "Done", which returns to Home: pub/start-rest.js stepLearn/wireLearn, where Done calls storyMark below). "Not now", and
// reading the story to its end, hide the card for good (a kept mark in this browser).
//
// Nothing runs on import: no storage, no styles, no DOM. The module imports only the first wave's helpers, so Home can load it alone.
import { btn } from '../ui.js';

export const STORY_KEY = 'hiphi_v2_story';   // '1' once the card was dismissed or the story read to its end
export const storyMarked = () => { try { return localStorage.getItem(STORY_KEY) === '1'; } catch { return false; } };
export const storyMark = () => { try { localStorage.setItem(STORY_KEY, '1'); } catch { /* storage blocked: the card comes back, which is harmless */ } };

// The card's rules, inline: version 2's first-visit pages have no stylesheet of their own to register (the router loads one per screen)
// and Home must not wait for another file to draw it right. One box in Home's box style (white, one thin border, the soft shadow),
// tinted pale blue so it reads as an offer and not as one of the week's rows (the review's mock); no filled button (A-3: the slide's is
// the one), its two choices are plain text buttons with 44px targets (A-6), the words at the first visit's reading size (C-14).
const CSS = `<style>
.story-v2 { display: flex; flex-direction: column; gap: var(--s4); padding: var(--s12) var(--s16) var(--s4); background: var(--p50); border: 1px solid var(--p100); border-radius: var(--r16); }
.story-v2 b { display: block; font: 700 var(--t18)/1.3 var(--font-h); color: var(--n900); text-wrap: balance; }
.story-v2 p { margin: 2px 0 0; font-size: var(--t16); line-height: 1.4; color: var(--n700); }
.story-v2-go { display: flex; align-items: center; justify-content: space-between; gap: var(--s8); margin: 0 calc(var(--s12) * -1); }
.story-v2-go .btn.text { min-height: 44px; padding-inline: var(--s12); }
.story-v2-go .story-v2-not { font-weight: 400; color: var(--n700); }
</style>`;

export function storyCard() {
  if (storyMarked()) return { html: '', wire() {} };
  const html = `${CSS}<section class="story-v2" aria-labelledby="story-v2-h">
    <div><b id="story-v2-h">New here? How a bill becomes law</b><p>Four short pages on your own bill · 2 min</p></div>
    <div class="story-v2-go">${btn('Read it', { kind: 'text', iconEnd: 'chevron-right', href: '#/learn/story', cls: 'story-v2-read', attrs: { 'data-story-read': '1' } })}${btn('Not now', { kind: 'text', cls: 'story-v2-not', attrs: { 'data-story-not': '1' } })}</div></section>`;
  const wire = (root = document) => {
    const card = root.querySelector('.story-v2'); if (!card) return;
    // Not now: the card goes (with its rules), for good, and focus moves to the next thing on the page rather than staying on a button
    // that no longer exists.
    card.querySelector('[data-story-not]')?.addEventListener('click', () => {
      storyMark();
      const after = card.nextElementSibling, style = card.previousElementSibling?.matches?.('style') ? card.previousElementSibling : null;
      card.remove(); style?.remove();
      (after?.matches?.('a, button') ? after : after?.querySelector?.('a, button'))?.focus?.({ preventScroll: true });
    });
  };
  return { html, wire };
}
