# Boba arcade style guide

The pixel boba on the homepage opens a menu of seven small games; the Konami
code drops straight into the first. This guide is the contract for how those
games look, read, move, and sound. It sits beside the
[website style guide](style-guide.md), which still governs everything the
arcade inherits: the palette, focus, contrast, target size, reduced motion,
and the layer scale. Where the two differ, this guide wins inside the arcade
and nowhere else. Game styles must not leak into ordinary routes.

## Character

The arcade is the site's one loud room, and it is still the same house. Its
surfaces extend the riso banner (cream paper, a rough ink outline, one accent
plate printed off register) and its drinks are pixel sprites. It should feel
like a boba shop's printed menu that turned out to be playable: warm, a
little crooked, hand-made. It should never feel like a generic arcade: no
neon, glow-as-decoration, scanlines, bezels, or gamer faces.

Three rules hold everywhere:

1. **One idea per game, and the idea is physical.** Catch, stab, pour, stack,
   land. The verb fits in one line of the menu.
2. **Emphasis is earned.** The accent slab, a stamp, a circled number: each
   appears where it means something and nowhere else.
3. **Say each thing once.** A key hint, a state, a number lives in one place
   on screen.

## The games

| Game       | Verb                            | Input                                                | Where        |
| ---------- | ------------------------------- | ---------------------------------------------------- | ------------ |
| boba catch | Catch cups thrown by links      | Mouse                                                | Desktop only |
| straw stab | Stab each cup on the beat       | Tap, click, Space                                    | Everywhere   |
| order up   | Pour, scoop, shake, and serve   | Hold, tap, click, Space                              | Everywhere   |
| cup stack  | Drop cups onto a tower          | Tap, click, Space                                    | Everywhere   |
| tea minus  | Land a cup of tea on a moon     | Arrows or `WASD`, Space; three hold buttons on touch | Everywhere   |
| sugar rush | Run the rooftops and deliver    | Space, `↓`, `X`; three buttons on touch              | Everywhere   |
| spill      | Draw straws to steer the pour   | Drag to draw; arrows and Space as a pen              | Everywhere   |

Every game plays by keyboard as well as pointer. A game that needs a fine
pointer (catch) is shown in the menu but disabled on touch devices, with a
sentence saying why.

## Type

One family: Neue Haas Grotesk. There is no Optima inside the arcade, and no
arcade or monospace face.

| Role                                   | Face                     | Notes                                                    |
| -------------------------------------- | ------------------------ | -------------------------------------------------------- |
| Scores, clocks, countdown numerals     | NHG Display `700`        | Lining tabular figures; `.boba-big` is `30px` (`24px` on phones) |
| Dialog titles                          | NHG Display `700`        | `30px`, lowercase (`.boba-title`)                         |
| Menu names                             | NHG Text `400`           | The site's `type-item-heading` recipe                     |
| Decks (the sentence under a title)     | NHG Text `400`, upright  | `15px / 1.5` (`.boba-deck`)                               |
| Labels, stats, tips, controls, meta    | NHG Text `400`           | `12px` (`.boba-meta`, `.boba-tip`)                        |
| Button labels, a live combo            | NHG Text `500`           | `13px` on buttons                                         |
| Asides: phases, tip labels, captions, section labels | NHG Text italic `400` | `14px` (`.boba-phase`); the arcade's second voice |
| Canvas text (popups, pad labels)       | NHG Text via `arcadeFont()` | Reads `--font-ui`, so it follows the site             |

- Hierarchy comes from size, colour, and the italic. Nothing in NHG Text goes
  above `500` (the kit has no `600`).
- No uppercase outside the rubber stamps.
- Text sizes are `rem` in CSS; canvas text is in `px` because the canvas is.

## Colour

Scoped `--b-*` variables on `.boba-ui` map to palette values and switch with
the theme (see the top of `arcade.css`); canvas marks read the same values
through `risoColors()`.

- Paper is `#FBF2E8` (`#2A2422` dark); ink is `ink-900` (`cream-100` dark);
  the accent plate is `accent` (`#F07563` dark).
- Golden cups and the ×5 coaster use ochre. Support hues keep their meanings
  from the site guide.
- Sprite and scene colours are game art and may be hard-coded.
- State is never colour alone: a warning also changes its word, a selection
  also gains a mark.

## Surfaces

### Riso sheets

HUD tickets, the menu, pause cards, results slips, and order tickets are
`.boba-riso` sheets: paper with a `2.25px` ink outline (`1.75px` for
`.is-small`), roughened by the shared displacement filter in `RisoDefs`. The
text on a sheet is never filtered and never tilted.

### The accent slab is earned

The misregistered orange slab behind a sheet is opt-in, because a slab behind
everything means nothing. It prints only behind:

- the score ticket (`.boba-ticket-start`, in every game, automatically);
- a ticket in a rush (`.is-rush`), where it also jitters;
- the primary button;
- anything a game marks `has-slab` because it needs the emphasis, such as a
  customer about to walk out.

It sits `5px` down-right (`3px` on small sheets and buttons) and takes a
`--tilt` of at most `±2deg`. Dialog cards carry `shadow-dialog` instead (black
at 32% in the dark theme, where the ink outline is the boundary).

### Stages

- Catch plays on the page itself, lightly dimmed.
- Every other game paints its own opaque pixel scene, the same in both
  themes, and drops the HUD's paper wash (`.boba-hud.is-bare`). See Scenes.

## Scenes

Every game but boba catch plays in a painted scene. They share one way of
being made, so they read as a set:

- **A pixel grid.** Screen-space art snaps to a `4px` cell; world-space art
  to the sprite's own cell. Nothing is vector-smooth.
- **Flat colour, dithered joins.** Skies and shading are flat bands joined by
  ordered (Bayer 4×4) dithering, never a smooth gradient.
- **Seeded, cached, still.** Detail is seeded by position so it never
  shimmers, and anything that doesn't change per frame is drawn once
  offscreen.
- **The scene answers the game.** Each one has a single thing that moves it
  along (the song's tier, the tower's height, the shift's clock, the burn)
  and a small response to a great move and to a mistake.
- **Legibility first.** The things you play with stay the most readable
  things on screen; sprites keep their paper halo; canvas text is cream on a
  dark backing because the scene doesn't follow the theme.
- **One soft effect.** Firelight or a lantern's halo may be a faint additive
  wash. Everything else has a hard pixel edge.
- Paused, the scene is frozen. Under Reduce Motion it is static at its
  current state.

## Buttons

Arcade buttons (`.boba-btn`) are hand-cut labels, not the site's plain
controls.

- **Shape.** Irregular corners and a `1.75px` rough ink outline, drawn on
  pseudo-elements so the label stays crisp. Neighbours in a row lean about
  `-0.6deg` / `0.5deg`, like labels placed by hand.
- **Primary.** An ink face with a cream label on an accent slab `3px`
  down-right. Hover lifts the face off the slab; pressing lands it on the
  slab (`motion-instant`).
- **Secondary** (`.boba-btn.secondary`). A paper face one step off its card,
  no slab. Hover adds a wash and tips the face about `-1deg`; pressing is
  `translateY(1px)`.
- **Labels.** NHG Text `500`, `13px`, sentence case; `40px` minimum height,
  `16px` horizontal padding.
- **Key chips.** A button's shortcut sits inside it as a small `<kbd>` chip
  (`Resume` `P`, `Exit` `Esc`), hidden on touch. No screen lists its keys a
  second time.
- **States.** Disabled is 60% opacity with no lift. The global focus ring
  follows the label's shape and is never restyled or removed.
- **Reduced motion.** No lift, tip, or press travel; the colour changes stay.

HUD icon buttons (pause, mute) stay quiet: a `32px` pixel icon with a wash on
hover.

## HUD

Tickets pinned along the top: score at the start, controls and lives at the
end, anything else in the middle (a phone moves the middle ticket to a second
row). A paper wash fades the site header behind them.

- The score ticket is the one with a slab.
- Timers are a drawn cup whose tea drains; lives are three tapioca pearls,
  and a dropped one becomes a dashed ring.
- The song's name waves on a small flag that hugs its text, capped at
  `12rem`, so there is never a gap between it and the buttons beside it.
- Numbers that change use tabular figures and update at most about ten times
  a second.
- The first-run tip is a small raised strip under the tickets: one
  instruction and one key. It shows once per device, and hides while the
  game is paused.

## Dialogs

- **Menu.** A menu board: each game's name with its best score where the
  price would be, and its shortcut key.
- **Pause says each thing once.** A title, one sentence, and three buttons
  that carry their own key chips. Nothing else.
- **Results.** The slip's top is two columns: title, deck, and the circled
  score with its unit and any `new best` stamp on the left; the run's stats as
  a single receipt column on the right (label, dot leader, figure; at most
  five). Below: the leaderboard and the sign-in field, then the actions. On a
  phone the receipt drops under the score, still one column.
- All three trap focus, close on Escape through the host, and return focus to
  where the visitor was.

## Marks and feedback

- Countdowns and final scores are circled with the same unclosed pen loops as
  the homepage interest markers, drawn on with a stroke-dash reveal.
- A new personal best gets a crooked rubber stamp.
- Canvas popups use the page's text colours for the active theme, except over
  a scene that is dark in both themes (tea minus), where they are cream on a
  dark backing.

## Motion

The arcade may use bespoke physical timing, but menus and controls honour the
site's motion tokens. Under Reduce Motion, read live:

- pops, draws, stamps, jitter, bumps, shake, flicker, and ambient animation
  are removed, and every mark shows in its finished state;
- physics, cameras, and anything the player needs in order to play stay.

## Sound

Everything is synthesized; there are no audio files. The songs and the synth
that plays them live in `src/lib/music/`, and effects in `src/lib/sfx.ts`,
which also re-exports the music controls so games import from one place.
There are twelve songs, each in its own style. Each run shuffles them and never opens on
the song that opened the last one; straw stab draws four, one from each
tempo band, slowest first, so its difficulty still climbs. Effects are
short and gentle and sit under the music's key where they can. Mute silences everything, and nothing throws when audio is locked.
Straw stab draws its belt against the audio clock (`audioClock()`), so cups
land on what is heard; pausing suspends the audio context so the music
resumes on the same beat. Music has three phases (opening, steady, rush) that
differ by arrangement, not volume.

## Voice

Lowercase titles and labels, sentence-case actions. Calm, specific, dry. No
exclamation marks, no “Oops”.

- **One thing at a time.** The first-run tip is one instruction plus the main
  action's key (“drop each cup onto the last” `Space`). A caption or toast is
  one line. No kicker above it, no second clause after it.
- **No dot separators.** Not the drawn dot, not `·`, in tips, captions,
  popups, or receipts. If two facts need a separator, one of them should go.
- **No filler.** An empty state shows nothing: no “nobody yet”, no “score
  something to sign the board”. One light joke may live in a deck (“The
  pearls will wait.”); copy elsewhere is functional.
- Live-region messages are plain sentences that say what happened and what it
  cost or earned.

## Game by game

### Boba catch

Cups fly out of the page's own links and you catch them in a basket, on the
page itself. It needs a mouse. Its end ticket carries the pearls, the song
flag, and the HUD buttons.

### Straw stab

A conveyor belt carries cups past a straw; stab each on the beat.

- **A night-market stall, and the song runs the clock.** The scene is a
  painted pixel dusk, the same in both themes. The engine's tier is the time
  of day: tier 0 is golden dusk with a half-set sun, the top tier is full
  night. The dithered sky, the stars, and the windows in two scrolling
  skylines all follow it, each change eased in over a bar.
- **Lantern strings play along.** A running light steps one lantern along
  each string per beat, and every lantern swells on the downbeat. A perfect
  stab flashes a string in that drink's colour; a miss dims them all for a
  moment. Tiers add a string, then another, then bunting, then windows that
  blink on the beat, and at the top fireworks on each downbeat.
- **The stall.** The belt is a cream face between ink lips on a dark housing
  whose rollers turn at the belt's real speed, over a wooden counter.
- **Restraint.** Cups, belt, straw, and judgement text stay the most legible
  things on screen: nothing bright or animated sits behind the cup at the
  stab point, and popups are cream on a dark backing.
- The stab point is a small accent notch on the belt, not a ring.

### Order up

Customers queue tickets on a rail. You take one ticket at a time through the
stations: hold to pour the tea to the ice line, drop each topping from a
swinging ladle, shake, and the drink is sealed, graded, and served.

- **Each station is a small physical act with its own grade** out of 100, and
  the receipt mixes those with how long the customer waited.
- **More to a drink than tea and toppings.** Orders also set the ice, the
  jar to pull from, and a timed seal; tea has to be brewed, samples can be
  handed out, a critic turns up, and each shift has a daily special.
- **A demo first.** A first-time visitor is offered a short demo before the
  shift starts.
- **A written cast.** Customers come from a set list of about forty regulars
  with their own quirks, not from the leaderboard.
- **The shop, from behind the counter.** A painted pixel room: shelves, a
  clock whose hands show the shift's time left, a steaming urn, the waiting
  queue, and a front window where the day turns from afternoon to night as
  the shift runs out.
- Order slips and station panels carry no slab at rest; a customer about to
  walk out earns one.

### Cup stack

A cup slides over the tower; drop it, and what overhangs is sliced off.

- **The tower climbs out of the city.** One tall painted world, so height is
  something you see: a rooftop table at dusk with the city behind it, then
  open sky with drifting clouds, a flock of birds, and a balloon shaped like
  a boba cup, then thin high air with cirrus and a plane, then space, with
  the curve of the earth below and, around fifty cups, a small moon with a
  coaster on it. Sky colour is a function of altitude.
- **It moves with the game.** Clouds and birds drift faster as the slide
  speeds up. A perfect drop sends out a ring of sparkle cells, in the drink's
  colour from the third in a row. When the tower falls, the sky sweeps back
  down to the rooftop.
- **Never cut more than you saw.** The tray is judged at the width it is
  drawn. The sliding cup glides smoothly, and a drop snaps to the pixel grid
  toward the tower, never away from it, so an edge that looks supported is
  never cut.
- A drop within `1.5` units of centre is perfect; three perfect drops in a
  row start growing the cup back.
- A dashed line marks the personal best's height, ink over pale sky and
  cream over dark. Anything drifting behind the top cups fades back.

### Tea minus

You land a pixel cup of milk tea on the moon, and the tea is the fuel: the
level in the cup on screen and in the HUD's cup drains together.

- **A pixel-print night,** the same in both themes: a dithered sky in flat
  bands, pixel stars that twinkle and the odd shooting star, a slowly turning
  pixel earth, two stepped mountain ranges in parallax, and lit regolith
  shaded by depth with seeded craters and rocks. The surface keeps one riso
  touch: an ink edge over the off-register accent plate.
- **Fire is animated pixel flame** on the sprite's own grid: tongues
  travelling down the plume, embers, smoke, and dust billowing where it meets
  the ground, with a faint additive firelight (the arcade's only soft-edged
  effect).
- The flight path is chalk dashes that stay on the sky; a retry keeps the
  last attempt's line, fainter.
- Landing pads are coasters with a pennant that leans with the wind; the ×5
  coaster is labelled in ochre.
- A landing is circled in chalk. A crash is a fireball, then spilled pearls
  bouncing in the low gravity.
- Telemetry that has gone unsafe changes colour and gains a word (“too
  fast”, “drifting”).

### Sugar rush

An endless run across the rooftops as a delivery cup on legs. **The tea in
the cup is your health and your pay.**

- **Rough play spills.** Hard landings, bumps, slams, and pigeons slosh tea
  out; clean hops and glides don't. The level in the runner's cup and in the
  HUD's cup are the same number. An empty cup, or a fall, costs a pearl.
- **Deliveries are the heartbeat.** Customers wait at coasters along the
  route. Crossing one hands off a cup: a fuller cup pays more, a streak
  multiplies it, and the cup refills. A cup at nine tenths or more is a full
  cup and gets a stamp.
- **Four moves that combine:** a jump whose height follows the hold, a glide
  on the straw as a rotor, a slide, and a slam.
- **Sugar rush.** Pearls fill a meter of ten sugar cubes; triggering it
  smashes obstacles for a few seconds, with afterimages and speed lines. The
  full meter is the one ticket here that earns a slab.
- **The course is authored, then shuffled.** Eighteen set pieces (awnings
  that bounce, vents that lift, cables to ride, crates, pigeons, split
  routes) unlock with distance and never repeat back to back. A test bot must
  finish long runs on many seeds without losing a life, so every gap is
  clearable.
- **Hop or slide, at a glance.** Things you hop are ink-outlined with a cream
  top; things you slide under carry red and cream on their underside.
- **The scene** is cup stack's city from the side: dusk at the start, full
  night by about a kilometre and a half, windows coming on as it darkens.
- New moves are taught in context, once per device, one caption at a time.

### Spill

A kettle pours a stream of tea; you draw straws, with a limited length per
room, to steer it into the cup.

- **The liquid is simulated and drawn as pixels,** never as circles: tea,
  milk, and a quantised blend where they mix, with a lighter surface line and
  duller puddles. Cups fill and overflow.
- **Straws** are pink and white, drawn by dragging and removed with a tap,
  refunding their length. They can be drawn and removed during the pour.
- **Rooms teach one thing, then combine.** Eighteen authored rooms in six
  pages: ramps, fans, moving cups and overflow, jelly and pipes, milk to a
  ratio with sponges and hot plates in the way, then pearls and a scale that
  lifts a gate. After those, rooms return as remixes labelled after hours.
- **Every room is proven.** Each ships with a reference solution, and tests
  check that it clears with the solution, fails with nothing drawn, and needs
  most of its straw.
- **Planning time.** Each room gives ten to thirty seconds before the kettle
  pours on its own, shown on a dial by the kettle; pouring early earns a
  bonus.
- **The order is drawn on the cup:** a fill line, a two-tone band for a milk
  ratio, slots for pearls, and a tick and a lid once it is met.
- **Fixtures show how they work before they are used:** a fan's wind drifts
  across the region it pushes, and a scale is joined to its gate by a dashed
  line.
- A failed room costs a pearl, shows its one-line hint, and is retried. Runs
  may start at room 7 or 13 once reached.
- **The scene** is the shop's back kitchen, with the tiles tinted differently
  for each page.

## Structure

- The arcade is loaded the first time it opens, so its code and its global
  sheet (`arcade.css`) never ship with an ordinary page view. It sets
  `data-justify="off"` so the paragraph justifier leaves game copy alone.
- Shared pieces live in `src/lib/components/arcade/` (menu, countdown, pause
  card, results slip with the per-game leaderboard, pearls, cup timer, HUD
  buttons, track flag), and `src/lib/arcade/shell.ts` wires a game into the
  window (auto-pause, Tab cycling, the pause key, Reduce Motion, resizing).
- Each game's rules live in a DOM-free module under `src/lib/arcade/` with
  node tests in `tests/`.
- Game-specific styles are scoped to the game's component; `arcade.css` holds
  only what more than one game uses.

## Adding or changing a game

- [ ] One verb, stated in one line in the menu.
- [ ] Rules in a DOM-free engine with tests; the component only draws and
      listens.
- [ ] Uses the shared HUD tickets, pause card, results slip, and buttons
      without restyling them.
- [ ] NHG only; nothing above `500` in NHG Text; no uppercase.
- [ ] A slab only where this guide says one is earned.
- [ ] Plays by keyboard and by touch; key hints hidden on touch.
- [ ] Every key hint and state appears once.
- [ ] Pauses on blur and tab-hide; cancels its timers, listeners, and sounds
      on close.
- [ ] Reduce Motion removes decoration and keeps play.
- [ ] Checked at `375px` and `1280px` in both themes.
- [ ] A row in the table above and an entry under Game by game.
