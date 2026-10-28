# Rooster mascot animations

Eleven animations of the HIPHI rooster, one per kind of moment in the public tracker, designed with Nate on
19 Oct 2026. **They are design assets, not yet wired into any page.** Which moments get the rooster is Nate's
decision: put it on the board (`../backend/docs/ASSESSMENT-2026-09.md` section 9) before building it, and mind the
freeze dates in the backend CLAUDE.md.

- Design source (private canvas, Nate's account): https://claude.ai/artifact/DyemohrbzpBteHNQegn4W5
- Preview every animation once pushed: https://natehiphi.github.io/hiphi-tracker-app/rooster/preview.html
  (locally, open `rooster/preview.html`)

## What is here

| Path | What it is |
|---|---|
| `animations/<id>.html` | One self-contained animation per file: an inline SVG plus its CSS. Plays once on load (loops keep looping). The comment at the top repeats its use, trigger, timing and design-rule notes. |
| `manifest.json` | The same information in machine-readable form, plus the character's colours, pivots and easing. |
| `character.svg` | The still rooster (the "H4+" character) for static use: a 200x200 viewBox, facing right. |
| `preview.html` | A private review page with every animation and a Replay button (noindex, nothing links to it). |

## Which animation goes where

| id | Moment | Plays | Length | Design rules (docs/DESIGN.md) |
|---|---|---|---|---|
| `small-win` | Saving or following a bill, picking a stance, an address found | once | 0.6 s | Fits A-10 and C-7 |
| `big-win` | Testimony submitted, the first action sent | once | 1.6 s | Trim to 1.5 s; any tap, key or scroll must end it (A-10) |
| `milestone` | End of the first visit (the Mahalo page) | once | 2.6 s | Too long for a 1.5 s moment; use on a page that waits for Next (A-10, R-140/R-298) |
| `bill-passed` | A followed bill becomes law: a lei blooms around the rooster's neck | once | 2.9 s | Start at the bloom (about 1.3 s) for a moment, or use the whole thing on a page (A-10, C-7) |
| `welcome` | First visit or onboarding: struts in and waves | once | 2.3 s | Must not delay Next; the first visit must still fit the window (R-265) |
| `submitting` | While testimony is sending: pecking, with three pulsing dots | loop | 1.0 s per cycle | Stop at 5 s and show the still rooster if the send is slow (A-10) |
| `error` | Something failed: a sympathetic head tilt | once | 1.5 s | Fits A-10; the error words and Retry carry the meaning |
| `empty-state` | Empty lists: pecks, then looks up | loop | 5 s per cycle | Play one cycle, then stop (A-10's 5 s limit) |
| `deadline-reminder` | A gentle nudge: chest puff and one "ahem" | once | 1.5 s | Fits A-10 |
| `streak` | Several actions in a session: quick ta-da with three sparkles | once | 1.0 s | **Conflicts with C-7** ("never a streak counter, a badge, a score"). Do not use without Nate |
| `idle` | Resting rooster beside content | loop | 8 s per cycle | **Conflicts with A-10** (nothing moves by itself for more than 5 s). Limit to 5 s, or play on tap |

## Wiring one in

1. **Route it through `pub/fx.js`** (A-10's implementation note: fx.js stays the one place motion lives). Add a
   helper there, such as `rooster(id, el)`, rather than scattering markup across screens.
2. Copy the animation's `<style>` rules into the page's CSS (or `pub/fx.css`) and its stage `<div>` (or just its
   `<svg>`) into the template. The class names are prefixed per animation (`r-`, `s-`, `m-`, `ld-`...) so they
   don't collide with each other or with the app.
3. To play it again, remove the element and insert a fresh copy (CSS animations restart when the element is
   re-created). To end a moment early, remove it.
4. **Motion is never alone (A-10):** always show the words the moment stands for. The rooster SVG is decoration:
   give it `aria-hidden="true"` (or keep its `role="img"` label only when it adds meaning).
5. **Reduce Motion:** every file already has a `prefers-reduced-motion` block that shows a still rooster. Gate any
   JS timing on `fx.reduced()`.
6. Keep it from covering the next button (A-10: celebrations never block).
7. Follow the repo's push checklist (CLAUDE.md "Before every push to main"): look at phone and desktop
   screenshots before pushing.

## The character (keep these when drawing new poses)

- Body `#F68B2C`, belly `#FCD09D`, wing `#D86F1C`, legs `#AD560F`, comb and wattle `#E5483A` (back wattle
  `#C93A2E`), beak `#FBB040`, cheek `#F9A77C`, eye `#142B35`. Tail fan from dark to light: `#093546 #00698E
  #129DCB #6BCDF8 #C4E8F6`. Lei flowers are white, `#F28AAE` pink and `#6BCDF8` blue, with `#3F8F5F` leaves.
- The head group is scaled 121% around (136.1, 67.4) in the 200x200 viewBox; the body stays full size.
- Pivots: head turns around (118, 100) with `transform-box: view-box`. The comb rocks around the centre of the head
  (`transform-origin: 50% 115%` of the comb), so it never lifts off the head. Wing at the shoulder (85% 15%), tail
  at its base (100% 80%), body squash from the feet (50% 100%).
- Easing matches the app: `cubic-bezier(.2,.7,.3,1)` for moves, `cubic-bezier(.34,1.4,.64,1)` for springy pops.
- Text-free and emoji-free, as the public page requires.
