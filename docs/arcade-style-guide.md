# Boba arcade style guide

The pixel boba on the homepage opens a menu of seven small games; the Konami
code drops straight into the first. The arcade is signposted quietly, so a
reader who came for the research is never asked anything: a pencilled
`arcade` note under the homepage photo points at the boba, the boba gives one
small wiggle a few seconds into a visit (once a session, never under Reduce
Motion), and the footer on every page carries an `arcade` link with a small
pixel cup beside the music player. This guide is the contract for how those
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
| order up   | Ice, syrup, pour, scoop, serve  | Hold, tap, click, Space                              | Everywhere   |
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

Tickets pinned along the top: score at the start, controls (and lives,
where a game has them) at the end, anything else in the middle (a phone moves the middle ticket to a second
row). A paper wash fades the site header behind them.

- The score ticket is the one with a slab.
- Timers are a drawn cup whose tea drains. Where a game has lives, they are
  tapioca pearls, and a dropped one becomes a dashed ring.
- **A life changing hands blinks.** A lost pearl flickers hard between an
  accent pearl and the ring before it settles; a pearl won back flickers in
  and lands with a small pop. The player's own sprite (the basket, the straw
  in hand, the next lander, the runner) flickers on and off for 1.2 s at the
  same moment (`src/lib/arcade/blink.ts`), so the loss or the revive is seen
  on the thing being played. Under Reduce Motion neither flickers.
- `<ExpertTag />` sits in the score ticket and says `expert` during an expert
  run, so the player always knows which board the score goes to.
- Space on the HUD's pause and mute buttons belongs to the game: focus lands
  on pause after a resume, and Space is every game's main action. Enter
  still presses them.
- The song's name waves on a small flag that hugs its text, capped at
  `12rem`, so there is never a gap between it and the buttons beside it.
- Numbers that change use tabular figures and update at most about ten times
  a second.
- The first-run tip is a small raised strip under the tickets: one
  instruction and one key. It shows once per device, and hides while the
  game is paused.

## Dialogs

- **Menu.** A menu board: each game's name with its best score where the
  price would be, its shortcut key, and a quiet italic `demo` beside it. A
  `normal | expert` switch sits by the title (key `E`); the prices follow
  it. The menu's primary button opens the leaderboards (key `L`).
- **Leaderboards.** The menu card turns over to every game's board at once:
  the top five of each, for the mode the switch is on, the leader in the
  accent, with a `play` link into each game. A board nobody has signed shows
  only its name. Back or Escape returns to the menu.
- **Pause says each thing once.** A title, one sentence, and three buttons
  that carry their own key chips, on one line. Nothing else.
- **Share.** The results slip's secondary `Share` button turns the board
  over to a share panel (`Board` turns it back): the run's card as it will
  be sent, with `Copy image` and `Copy text` beside it (under it on a
  phone). A phone whose share sheet takes images offers `Share image`
  instead of copying it. Each button says `Copied` for a moment.
  - **The card** (`share-card.ts`) is a 1200 × 800 riso sheet on the shop
    wall, always in the light palette: the game's pixel icon and name, the
    mode, the site, the score circled in pen with its unit under it and a
    `new best` stamp when it earned one, up to three stats as a receipt,
    and the game's emoji lines along the foot. It stands on its own, since
    some apps drop the text sent beside an image. It is drawn as the slip
    opens, so a copy starts inside the click.
  - **The text** reads without the game: the game and mode, the score in a
    sentence, up to three stats in words (never the personal best, a stat
    that repeats the score, or one that came to nothing), the emoji lines,
    and a link that opens the arcade straight on the game
    (`atreydesai.com/?play=stack`; the root layout opens it and tidies the
    address).
- **Results.** The slip's top is two columns: title, deck, and the circled
  score with its unit on the left, with any `new best` stamp pressed across
  the top of the circle; the run's stats as a single receipt column on the
  right (label, dot leader, figure; at most five, named so a first-time player
  understands them). Below: the leaderboard and the sign-in field, then the
  actions. On a phone the receipt drops under the score, still one column.
- **Signing the board** prefills the last name signed on this device. Once
  signed, the field simply goes away and the player's row is highlighted on
  the board; nothing else is added. Leaderboard rows centre their text in
  the row.
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
There are twelve songs, each in its own style. Each run shuffles them and
never opens on a song that opened any of the last six runs; those openers
are remembered on the device, so a fresh visit doesn't open the same way
either. Straw stab draws four, one from each tempo band, slowest first, so
its difficulty still climbs, and its opener skips the slow songs that opened
recently. Effects are
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

## Every game

- **Expert mode.** One switch on the menu for all seven games
  (`arcadeExpert` in `src/lib/boba.ts`, remembered on the device). A game
  reads it once when it opens and passes it to its engine, where the expert
  rules live and are tested. Expert is a lot harder, not a small tweak, and
  stays fair: where a game proves something is reachable (coasters, gaps,
  rooms), the proof covers expert too. Expert runs keep their own bests and
  their own boards; `scores.ts` and `/api/scores` take the mode from the
  switch.
- **A demo first.** Each game can play itself for 15 to 30 seconds on its
  real rules: an autopilot pressing the same inputs a player would, never
  scoring, always on normal rules. The first time a game opens on a device a
  card asks whether to watch it (`DemoCard`); the menu's `demo` opens it any
  time (`openDemo`). While it plays, `DemoBar` carries the word demo, one
  caption at a time, and `Play`; at the end, `Watch again`. The strip is a
  riso sheet with no box behind it. The first-run tip waits for the first
  real run.
- **Share.** Each game builds its own emoji lines for the results slip's
  `share` prop (`emojiRows` in `src/lib/arcade/share.ts` wraps a sequence):
  at most four short lines that say how the run went without explaining it.
  The words come from the slip's receipt `stats`, so a game names its stats
  for a stranger. `/dev/share` draws every game's card and text from sample
  runs, with an expert run and an empty one.
- **New rules, new board.** When a game's scoring changes enough that old
  scores can't be matched (catch going endless, sugar rush and cup stack
  getting much harder), its best cookie and its board move to a new version;
  the old board is kept, not shown.

## Game by game

### Boba catch

Cups fly out of the page's own links and you catch them in a basket, on the
page itself. It needs a mouse.

- **No clock: the shift lasts until the last pearl drops.** Each miss costs
  one of three pearls. Everything climbs with time on shift: throws come
  faster and closer together, fall harder, and fly wider, and a link glows
  for less time before it throws. After the opening, links throw in pairs
  and threes, high lobs that hang and drift, and low flicks. Normal reaches
  its top pace at three and a half minutes and stays there. The music's
  opening, steady, and rush follow the same climb.
- **Brutal, never impossible.** Each throw is planned so a quick hand can
  get the basket from every other landing to this one. A link with nowhere
  fair to throw holds its cup a moment, and lets it go rather than throw
  unfairly. A test plays four minutes at the top pace with a basket that
  moves exactly as fast as the rule assumes, and it misses nothing.
- **Golden cups** are every tenth throw and worth three points. While a pearl
  is down, three golden cups in a row with no miss between win it back,
  never past three.
- **Expert** starts where normal is at a minute and three quarters and
  climbs faster to a harder top pace, with a basket a third narrower
  (caught exactly where it is drawn), a tighter perfect, less warning, and no
  pearls coming back.
- **The tickets.** The middle ticket counts time on shift up, with the
  pace's name under it. The end ticket carries the pearls, the song flag,
  and the HUD buttons.
- **The demo** moves the basket itself, a little late and a little off
  centre like a hand, lets one cup fall to show a pearl dropping, and jumps
  to rush hour for its last stretch. Its strip sits under the tickets, clear
  of the basket, and no link behind it throws.
- **The share** is one square per fifteen seconds on shift (a clean stretch,
  a golden cup, a pearl won back, or a pearl dropped), then the time on
  shift.

### Straw stab

A conveyor belt carries cups past a straw; stab each on the beat.

- **A stab is judged when it happened.** Song time is the heard audio time
  (`audioClock()`) less the first downbeat, and the page clock maps onto it
  by one steady offset. A key or tap is timed by its event's own timestamp,
  not by when the page got round to it; each frame is drawn for the moment
  it reaches the screen, a frame after its timestamp; so a cup is seen on
  the notch when its beat is heard, and a stab made then is judged dead on.
  A cup is only called missed a moment after its window closes, so a stab
  that was in time but handled late still finds it.
- **The nearest cup still waiting takes the stab**, the earlier on a tie.
  Perfect is within `50ms`, good `100ms`, a graze `150ms`; anything further
  hits the belt. Off the notch, a second note says `early` or `late`.
- **Space always stabs during a run,** even on a focused pause or mute
  button, which lets go of focus; the letter keys stab everywhere. Enter
  still presses a focused button.
- **Expert** narrows the windows to `30`, `60`, and `90ms`, plays with two
  pearls, opens two tiers up and climbs a tier every song into a syncopated
  tier of its own, and pushes about a third of bars half a beat off the
  beat. Its scene opens at twilight.
- **A demo** plays itself on the same rules for about twenty seconds: a
  good, a graze, and a let-go cup in turn, each while its caption is up.
- **The share** is a row per song, a square per bar, coloured by the worst
  stab in it.
- **A night-market stall, kept in the background.** The scene is a painted
  pixel dusk, the same in both themes, printed with most of its saturation
  and some of its light taken out. The engine's tier is the time of day:
  tier 0 is dusk with a small sun setting over the play lane, the top tier
  is full night. The dithered sky, dim stars, and windows that come on in
  two slowly scrolling skylines all follow it, each change eased in over a
  bar. Nothing blinks.
- **A dark lane.** A flat dark band, dithered along its top edge, runs
  behind the cups from above the straw down to the belt, so whatever the
  market has there sits under it.
- **Lantern strings, above the lane.** A running light brightens one
  lantern's core along each string per bar; lanterns never change size. A
  perfect stab tints a string in that drink's colour; a miss dims them all
  for a moment. Tiers add a string, then another, then still bunting, and
  at the top a small firework every other bar, bursting high and clear of
  the straw's column.
- **The stall.** The belt is a cream face between ink lips on a dark housing
  whose rollers turn at the belt's real speed, over a wooden counter.
- **Restraint.** Cups, belt, straw, and judgement text stay the most legible
  things on screen, and popups are cream on a dark backing.
- The stab point is a small accent notch on the belt, not a ring, centred
  exactly where a cup's centre is at its beat.

### Order up

Guests walk up to the counter and hand over a ticket, which goes up and is
clipped to the rail. You take one ticket at a time through the stations: drop
in the ice, pump the syrup, hold a tap to pour the tea to the ice line, drop
each topping from a swinging ladle, shake, and the drink is sealed, graded,
and handed over.

- **Tickets read like a boba shop's:** the tea, the sugar as 0 to 100% in
  quarters, the ice as no, less, regular or extra, and any toppings. Sugar
  and ice each show a mark per pump or cube, and the same marks appear on
  the cup or bottle and on the hand, filling as they go in; the station moves
  on by itself when they're full. Pressing a tap early leaves a drink short;
  extra ice at the pour, or the wrong count, is graded down.
- **Each station is a small physical act with its own grade** out of 100, and
  the receipt mixes those with how long the guest waited.
- **Guests stand across the counter,** cut off at the waist by its edge,
  between the back bar's columns and never where the cup does its work. Each
  of the cast of about forty has a written look (hair, glasses, a cap, a
  phone, a hood). Their faces follow their patience (calm, eyes on the clock,
  cross) and their drink as they take it (starry for perfect, surprised by a
  good one served fast, content, unmoved, unimpressed), and a cross guest
  storms out. Under Reduce Motion nobody walks; the faces still change.
- **Serving well pays three ways:** good drinks in a row climb a combo that
  multiplies each drink (×2 from the third, ×3 from the sixth); tips fly into
  a tip jar on the counter, which pays a bonus and buys back a lost pearl
  when full; and a perfect drink cheers everyone waiting, buying them
  patience.
- **The back bar is real:** a wooden shelf on brackets, with the ice bin, a
  dispenser per tea (a glass tank with its tea showing, on a steel base whose
  tap reaches over the shelf's edge) and the syrup bottle standing on it.
  Each machine is its own button. Its name is a printed paper label on the
  glass, drawn on the jar's cells with a lifted corner; a jar too narrow for
  its word shows the flavour's mark instead. Nothing has a box behind it, and
  nothing that moves crosses a label.
- **More around the drink:** tea has to be brewed, samples can be handed
  out, a critic turns up, and each shift has a daily special.
- **Expert** puts four tickets on the rail, sends guests faster with less
  patience and bigger orders, tightens every grading window, swings the ladle
  and the sealer faster, gives two samples, and sends the critic twice.
- **A demo first.** A first-time visitor is offered a short demo before the
  shift starts; the menu's demo button opens it directly.
- **The shop, kept quiet.** The wall behind the play area is one flat tone;
  the room lives in the side walls, mixed toward the wall colour: a menu
  board, a few large jars, a clock whose hand shows the shift's time left,
  and a small window where the day turns to night. A perfect drink briefly
  brightens the lamps; a lost guest briefly dims the edges.
- Order slips carry no slab at rest; a guest about to walk out earns one.

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
  colour once the streak is growing the cup. When the tower falls, the sky
  sweeps back down to the rooftop.
- **Never cut more than you saw.** The tray is judged at the width it is
  drawn. The sliding cup glides on the screen's pixel grid (half CSS pixels
  on a sharp screen), and a drop is judged exactly where it was last drawn.
  It then snaps to the unit grid toward the tower, never away from it, so an
  edge that looks supported is never cut.
- **Perfect is earned.** The perfect window is a time either side of centre,
  turned into distance at the slide's speed: `30` ms at the first cup,
  tightening to `14` ms by 24 cups (about half a unit throughout, as the
  slide speeds up). It is never narrower than one frame of the slide at
  60 fps plus half a pixel, so no pass can skip over it. A drop just outside
  it still snaps onto the centre whole, so the game says “a hair off”: it
  looks lined up, but it isn't a perfect and it ends the streak.
- **Regrowth.** The third perfect in a row grows the cup back a unit, and
  so does every perfect after it, never past a fresh cup.
- **Expert** is a narrower cup (`10` units, on a narrower tray), a slide
  half again as fast from the start that speeds up sooner (`22` to `44`
  units a second by 22 cups), each cup from a random side at its own pace
  (±20%), the narrowest perfect window allowed (about `14` to `11` ms), and
  slower regrowth: the fourth perfect in a row, then every second one. The
  music rushes sooner.
- **The demo** plays fourteen scripted cups on the real rules, in normal
  mode, through the same drop the player's input calls: perfects, trims, a
  regrowth, a near miss, then a miss and the fall. Its strip sits at the
  top, clear of the tower. Pressing Play mid-demo drops its cup and brings
  the sky home as a fall does, then a real run starts.
- **Sharing** draws the run as a little tower: a square per drop, ten to a
  row, newest row on top, ending on the cup that fell (gold perfect, white
  whole, orange trimmed, red fell).
- A dashed line marks the personal best's height, ink over pale sky and
  cream over dark. Anything drifting behind the top cups fades back.

### Tea minus

You land a pixel cup of milk tea on the moon, and the tea is the fuel: the
level in the cup on screen and in the HUD's cup drains together.

- **A pixel-print night,** the same in both themes: a dithered sky in flat
  bands, pixel stars that twinkle and the odd shooting star, and lit regolith
  shaded by depth. The surface keeps one riso touch: an ink edge over the
  off-register accent plate.
- **Every site is a different part of the moon.** Each has a terrain
  character, and a run visits them in a shuffled order that never repeats
  back to back, starting on the gentlest:
  - **mare:** low rolling plain in cool grey basalt, with bright ray craters;
  - **highlands:** jagged ridges between coasters in the valleys, boulders;
  - **craters:** real bowls cut into the ground, a ×5 on a crater floor;
  - **rille:** a deep trench with a ×5 on its floor and coasters on both banks;
  - **mesas:** flat tops with sheer, banded cliffs and a ×5 below them;
  - **dunes:** low rounded ridges in blue-grey, with long soft shadows.

  Each has its own ground tones, far silhouettes, surface detail, and sun
  height. The earth shows a different phase in a different place at each
  site; some skies carry a faint band of the galaxy or a comet, and some
  sites an old rover, a flag, or a small base with one blinking lamp. A test
  checks every coaster in every character has room to come straight down.
- **Later sites pay more.** Coasters narrow, the cup shrinks, and wind grows
  as the sites go on, so landings are multiplied by the site: ×1 at the
  first, a quarter more each site, up to ×3. The multiplier lives in the
  scoring only and is never shown: a landing's note and the score say the
  points it paid, not the factor behind them. The coasters' own ×2, ×3, ×5
  stay on the pads, because they say where to land.
- **Every coaster is in reach.** The cup shrinks by 30 a site to a floor of
  450, about a third more than a careful autopilot burns reaching the
  furthest coaster from the start in the strongest wind. A test holds it to
  landing on every coaster from the start with a fifth of the cup to spare.
- **Expert is a lot harder from the first site.** Wind already blows at site
  1 (3, rising 0.7 a site to normal's cap of 6.5) and gusts harder, with a
  quick flutter on top; coasters are a quarter narrower (never under 27); the
  cup starts at 560 and shrinks to a floor of 430; a touchdown must be slower,
  straighter, and more upright (descent 12, drift 7, tilt 0.15, against 16, 10,
  and 0.2); and there are two landers. The wind stops at normal's cap because
  past it even the autopilot can't hold still over the narrowest coaster. A
  test flies the autopilot to every expert coaster from the start, landing
  with 15% of the cup to spare.
- **The demo is the real game flying itself.** The engine's autopilot (the
  same one the tests fly) presses the three keys on a calm first site and
  lands on its ×5 coaster in about fifteen seconds, under four lines: hold
  burn to slow the fall, the tea is the fuel, line up over a coaster, come
  down slow and level. On touch the hold buttons light as it presses them,
  and the strip sits at the top, under the tickets.
- **Sharing** gives one emoji per attempt (the coaster's keycap for a
  landing, a burst for a crash) after a moon, and a feather for each feather
  landing.
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

An endless run across the rooftops as a delivery cup on legs, faster the
whole way. **Spare cups are the lives; the tea is the pay.**

- **It never stops speeding up.** Speed climbs in a straight line with
  distance from 180 to a cap of 390 units a second, so in time it gathers
  pace: about 15% faster after half a minute, a third faster after a minute,
  nearly double by two and a half. Set pieces unlock and remix with
  difficulty, and the flat roof between them shrinks, so they come faster
  still.
- **Spare cups are the lives.** A run starts with one and can hold two; the
  HUD shows a slot for each, the cup when held, a dashed outline when not.
  Running into anything you should have hopped or slid under (a crate, a
  pigeon, a sign, a barrel) costs one, as does a fall into the alley or a cup
  run dry. With none left, the next of those ends the run. After a hit the
  runner stumbles and has a moment of grace (1.2 s) so one mistake is one
  cup; a fall comes back on the next proper roof.
- **Losing a cup blinks.** A runner brought back blinks hard on and off
  through its grace; the lost cup's slot flickers in the accent before it
  settles empty, and a cup won back flickers in and lands with a pop, as the
  shared pearls do. Under Reduce Motion both show their final state at once.
- **Some things are lethal.** A live wire down on the roof, a skylight, a
  shorting neon sign, and a gap with the railway below end the run with
  spare cups in hand, in grace or in a rush. They are always avoidable (a
  test holds every wire and skylight to a tenth of a second or more of
  take-off, every railway gap to well inside a full jump) and never come
  before the first stretch.
- **Spare cups are rare and risky.** One is placed only every fourteen to
  twenty thousand units after the first nine thousand (about once a minute
  of running, a third as often as before), and only low at the far end of a
  skylight or a railway gap, on the line of the earliest full jump that
  still clears it. The safe jump passes over it; taking it means coming down
  a moment from the edge. A spare found with both slots full is a golden cup
  worth points.
- **The tea is the pay.** Hard landings and slams slosh tea out; clean hops
  and glides don't. Customers wait at coasters along the route: crossing one
  hands off a cup, a fuller cup pays more, a streak multiplies it, and the
  cup refills. A cup at nine tenths or more is a full cup and gets a stamp.
  Running dry costs a spare cup and refills it part way.
- **Four moves that combine:** a jump whose height follows the hold, a glide
  on the straw as a rotor, a slide, and a slam. Down tapped in the air
  slams; down still held when the slam lands goes straight into a slide, so
  a slam just before something low never lands standing into it.
- **Sugar rush.** Pearls fill a meter of ten sugar cubes; triggering it
  smashes anything that would cost a cup (never anything lethal) for a few
  seconds, with afterimages and speed lines. The full meter is the one
  ticket here that earns a slab.
- **The course is authored, then shuffled.** Twenty-seven set pieces unlock
  with distance and never repeat back to back. Besides awnings that bounce,
  vents that lift, cables to ride, crates, pigeons and split routes, things
  move or keep time: barrels that roll at the runner, a rival's drone at
  slide height, signs swinging from a gantry, steam pipes that blow on a
  timer (hop the pipe, or jump the plume), and rotten boards over a gap
  that give way a moment after they take the weight. A test bot (also the
  demo's player) runs long stretches on many seeds, in both modes, without
  losing a cup, so every gap is clearable and everything can be avoided.
- **Expert** starts at 215 and climbs to 430 in about a minute and a half,
  reaches full difficulty twice as soon, starts with no spare cup and finds
  one only every fifty thousand units or so after the first forty thousand,
  and brings lethal pieces in at half their usual distance and more often.
- **Every pearl can be taken.** Pearl curves are plotted from the runner's
  real speed and take-off, and a test proves each group (and each spare) is
  collected in full by one ordinary input, with a little slack in the timing.
  Pearls are drawn exactly where they are judged.
- **Hop, slide, or never touch, at a glance.** Things you hop are
  ink-outlined with a cream top; things you slide under carry red and cream
  on their underside. Lethal things are striped hazard yellow and ink on the
  side that kills (the top of what lies on the roof, the underside of what
  hangs, the walls either side of the railway) and spark or flicker.
- **The scene** is cup stack's city from the side: dusk at the start, full
  night by about a kilometre and a half, windows coming on as it darkens.
- New moves are taught in context, once per device, one caption at a time;
  the first lethal thing gets one too (“hazard stripes end the run”).
- **A demo** plays a calm opening on a fixed seed with the bot at the keys,
  captioning each move the first time it happens, for about half a minute.
- **Sharing** pastes the distance, each coaster as a cup (full, part, or
  missed), and the cups lost, then what ended the run.

### Spill

A kettle pours a stream of tea; you draw straws, with a limited length per
room, to steer it into the cup.

- **The liquid is simulated and drawn as pixels,** never as circles: tea,
  milk, and a quantised blend where they mix, with a lighter surface line and
  duller puddles. Cups fill and overflow. The simulation never stops while
  a room is on screen: the verdict waits until the tea has come to rest, and
  the tea keeps moving after it.
- **Straws** are pink and white, drawn by dragging and removed with a tap,
  refunding their length; `Clear` removes them all. There is no undo. They
  can be drawn and removed during the pour, and a straw's end that comes
  close to another straw snaps onto it so a joint never holds tea back.
- **Straw left is always in sight.** A long striped gauge in the bottom bar
  shortens as straw is spent, with each straw's cost marked on the spent
  part and the stroke in progress shown live; it turns coral and says `low`
  under a fifth, and `out` when gone. While drawing, a dashed ring around the
  pen shows how far the straw left can still reach.
- **Rooms teach one thing, then combine.** Forty-eight authored rooms in
  sixteen pages of three. Each page brings in or deepens one idea and its
  last room combines it with what came before: ramps, fans, moving cups and
  overflow, jelly and pipes, milk to a ratio with sponges and hot plates in
  the way, pearls and a scale that lifts a gate; then hatched glass that
  takes no straw (tea flies straight through it), kettles that slide on a
  rail as they pour, cups that run over into the next, wind that pushes back
  and holds tea up, flat jelly that bounces, pipes in a row and up a wall,
  ratios that leave tea out, a sieve that holds pearls and lets tea through,
  scales weighed by overflow, pearls or milk, and three closing rooms with
  everything at once. After those, rooms return as remixes labelled after
  hours, a step harder every sixteen.
- **Levels, not lives.** Spill has no lives. A failed room shows its one-line
  hint and is tried again. A `Levels` button (key `L`) opens the room grid,
  a page of three to a row on a phone and two pages to a row on a wider
  screen, scrolling inside its card: each room's best stars, locked rooms
  marked with a padlock, the next room to play marked and focused, and after
  hours as one tile opened by clearing the last room. Arrow keys move by
  what is on screen. Progress lives on the device, expert's apart from
  normal's; a save from when there were eighteen rooms keeps every star, and
  the new rooms open in order before after hours does. The leaderboard score
  is the total of best points across every room, signed when the last room
  is cleared.
- **Every room is proven.** Each ships with a reference solution, and tests
  check that it clears with the solution, fails with nothing drawn, needs
  most of its straw, and settles to a verdict that holds.
- **Planning time.** Each room gives ten to thirty seconds before the kettle
  pours on its own, shown on a dial by the kettle; pouring early earns a
  bonus.
- **Expert** is every room with five seconds to plan, just enough straw for
  the room's own route and three percent more, orders half way up from
  their minimum to their full line, keep marks a tenth higher for stars, and
  a ratio tolerance at three fifths. A test draws each expert route one
  straw every second and a half from the moment the room opens, and every
  room still clears. Expert after hours cuts straw to exactly the route,
  keeps each room's own droplet seed, and holds its fuller orders and faster
  belts back until the second lap, so its first lap is every expert room,
  mirrored or not, on just the route; a test clears each of them at that
  pace.
- **The demo** plays room 1 on its real rules for about twenty seconds: a
  pen draws a straw the wrong way, takes it back with a tap, draws the
  room's route, and presses pour, and the room clears. It records nothing,
  takes no game keys, and holds on pause. Its strip sits at the top, clear
  of the straw gauge.
- **The share** is a square per room by its best stars (green three, yellow
  two, orange one), a page of three to a group and four pages to a line.
- **The order is drawn on the cup:** a fill line, a two-tone band for a milk
  ratio, slots for pearls, and a tick and a lid once it is met.
- **Fixtures show how they work before they are used:** a fan's wind drifts
  across the region it pushes, a scale is joined to its gate by a dashed
  line, a kettle on a rail hangs from a trolley in a slot as long as its run,
  and a sieve is a steel mesh with gaps.
- **The scene** is the shop's back kitchen, with the tiles tinted differently
  for each of the sixteen pages, and a window where the day passes once over
  them, then night after hours.

## Structure

- The arcade is loaded the first time it opens, so its code and its global
  sheet (`arcade.css`) never ship with an ordinary page view. It sets
  `data-justify="off"` so the paragraph justifier leaves game copy alone.
- Shared pieces live in `src/lib/components/arcade/` (menu, leaderboards,
  countdown, pause card, results slip with the per-game leaderboard and
  share button, demo card and demo strip, expert tag, pearls, cup timer, HUD
  buttons, track flag), and `src/lib/arcade/shell.ts` wires a game into the
  window (auto-pause, Tab cycling, the pause key, Reduce Motion, resizing).
  `share.ts` builds share text and `blink.ts` times the revive blink.
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
