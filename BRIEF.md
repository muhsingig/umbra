# Umbra — BRIEF

**Self-authored under explicit creative delegation.** The user's words, verbatim:
"you decide everything it should be the best i mean the best visually appealing
user friendly anyone opens the website their reaction should be wow". No brand,
no assets and no kie.ai key were supplied. Every answer below is an authored
decision, not a quotation.

## The subject (authored)

Umbra: a concept dark-sky lodge at 4,300 m on the Changthang plateau, Ladakh,
open only for the nights around each new moon, October to April. The lodge is
fictional and the page says so in its fine print. **The sky is real**: 5,044
catalogued stars and the Milky Way, placed for 32.8° N 79.0° E on the night of
10–11 October 2026 (new moon 21:21 IST, computed with Meeus ch. 49), with the
sun's real altitude driving dusk and dawn.

Why this subject for "wow": the night sky is the one photographic subject a
live renderer can reproduce more truthfully than a generated image, because it
is points of light in exact positions, and it gives the page a real clock to
scroll through.

- What must the visitor believe by the end: *most of us have never actually seen
  the night, and this is where you go to see it.*
- One action, one label everywhere: **Hold your nights**.

## The eight topics (authored)

1. **Vibe:** cold, silent, vast, exact. References: a long-exposure star-trail
   photograph; the hush of an observatory dome; the film *Arrival* (restraint,
   scale, grey-blue).
2. **Journey:** dusk at the lake → the sky you already know (washed out) → the
   sky clears as your eyes adjust → a four-hour exposure you make by scrolling
   → what the lodge is and when the dark windows fall → dawn, and holding your
   nights.
3. **Energy:** calm open, a low uneasy second beat, a very quiet third, the loud
   peak, informative and steady after it, warm and settled at the end.
4. **Feeling and the one moment:** see the curve and peak below.
5. **Something no site does:** your scrolling *is* the shutter. The sky wheels
   around Polaris and the page records real star trails as you go, then tells
   you how long your four-hour exposure actually took you.
6. **Range:** premium-minimal, but not charcoal-with-one-accent by default: the
   ground is the real sky, the accent is an astronomer's red lamp, and the
   interface chrome itself turns red after dark and back at dawn.
7. **One unbroken world or scenes:** one unbroken world. The whole page is one
   night in one place, dusk to dawn, without a cut.
8. **Assets:** none. Fully rendered world: real star catalogue, baked Milky Way
   map, procedural landscape planes, hand-drawn silhouettes. No generation spend.

## Feeling curve (written before the waypoints)

```
1  Wonder      blue hour over a still lake, the first stars arriving, lodge lights warm
2  Unease      the same sky drowned in orange skyglow, a dozen stars, a hard fact
3  Stillness   the glow drains, eyes adjust, stars keep filling in, red lamps only
4  Awe (PEAK)  camera locks, shutter opens, the whole sky wheels into trails round Polaris
5  Trust       the lodge in plain facts, and the real new-moon calendar you can pick from
6  Resolve     dawn warms the peaks, your chosen nights, one place to hold them
```

## The peak

> "I scrolled and the whole sky spun into circles around the pole star, and then
> it told me I'd just made a four-hour photograph in forty seconds."

Lives in waypoint 4 (Exposure). It gets the most scroll room (3.4 of 10.5
viewport-heights), the silence before it (waypoint 3 is the quietest screen on
the page), and the rendering budget (the trail integrator).

## Tell-someone sentence

**It's the site where you scroll through one night in the Himalaya and your
scrolling takes a star-trail photograph.**

## Authored silence

Waypoint 3 (Adjust) is deliberately sparse: one short line, then the sky alone
while faint stars keep arriving. Stars appearing is the content. It is not dead
scroll; `data-sc-verify-state` publishes the limiting magnitude so the harness
can see it change.

## Structure decisions

- **Grammar: Continuous world.** One fixed stage for the whole page, waypoints
  not sections, nav as a map of the night, close as arrival at dawn in the same
  place. Implemented on the engine's worldflight mode with media-less legs
  (waypoints, copy windows and spacer come from the engine); the world itself is
  a page-local WebGL sky plus DOM landscape planes.
  - Filmic one-shot lost: it is made of acts and pins; a night has no cuts.
  - Chaptered editorial lost: the argument is felt, not read.
  - Live surface lost: this is not software.
  - Typographic poster lost: the sky is the asset; type would be competing.
  - Gallery lost: there is no range of objects.
  - Split stage lost: no two-sided argument (skyglow vs dark is one beat, not
    the page).
  - Rhythmic cutlist lost: the brand is silence; speed is the opposite.
- **Nav:** a night map. Wordmark, a clickable dusk-to-dawn rail with six stops,
  the in-world clock and sun altitude, one CTA. Turns red-lamp after dark.
- **Hero:** establishing position inside the world at blue hour; layered planes
  (sky, far range, lake reflection, near ridge with the lodge, observer and
  telescope on a rock, foreground flags and grass, mist) with a small camera
  crane on the first scroll.
- **Signature move:** scroll-as-shutter star trails, integrated from the real
  catalogue, reversible, and timed against the visitor's own scroll.
- **Close:** dawn. A planner of the next six real new-moon windows, chosen
  window carried into the request, honest confirmation (concept lodge).

## Honesty rules for this build

- No invented statistics. The only figure is Falchi et al. 2016 (Science
  Advances): the Milky Way is hidden from more than a third of humanity.
- Lodge details are fiction and the fine print says Umbra is a concept.
- The request form confirms on the page and states nothing was sent.

## Verification notes (after build)

**Feel check, read cold from the contact sheets, one word per waypoint:**
Dusk: *calm*. Skyglow: *flat* (intended unease; reads as dullness, which is the point). Dark: *hush*, turning to *anticipation* as the Milky Way arrives. Exposure: *awe*. Lodge: *grounded*. Dawn: *warm*.

Diff against the intended curve: matches, with one change made during the build. In the first pass the Milky Way was already visible at the end of Dusk, so the reveal happened *before* the skyglow beat and the Dark act had nothing to arrive at. Fixed by gating the Milky Way to the Dark act onward and shortening Dusk to 18:30–18:57. The peak is the largest visual change on every sheet and holds the most scroll (3.4 of 10.5 vh). The last screen resolves and holds (planner and form at 05:58).

**Harness notes.** Dead-scroll flags on this page are a harness gap: its continuous-world branch ignores `data-sc-verify-state`. Re-checked from report.json using the published state; the one remaining pair was a stale attribute read (frame 43 paints 03:13, not 02:38). Scrims were originally `data-sc-copy` blocks, which the harness hides before sampling, so they were never measured; they are now plain siblings that mirror their block's opacity, and contrast passes at 1440×900, 390×844, 360×640 and reduced motion.

## Version 2 (user asked for "something anyone has never seen")

Added, all driven by real data: the hero headline assembles from star-points on arrival and dissolves into real star positions on scroll (reversible); tap any named star and the telescope in the scene slews to it while a card gives its distance (HYG v4.1) and when its light left, dated against a historical anchor; a meteor crosses at 00:47 and stays in the exposure; the finished photograph can be saved (downloads capability) stamped with the visitor's own exposure time; opt-in synthesised wind, prayer flags and shutter sounds. Re-verified: harness clean at 1440×900, 390×844, 360×640 and reduced motion; functional suite passes. The dissolving headline's particle layer is marked as copy so the contrast pass measures the sky behind it, not the letters themselves.
