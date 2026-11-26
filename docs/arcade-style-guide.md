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
| sugar rush | Run the rooftops and deliver    | Space, `↓`, `X`; three buttons on touch              | Everywhere   |
| tea minus  | Land a cup of tea on a moon     | Arrows or `WASD`, Space; three pixel keys on touch   | Everywhere   |
| cup stack  | Drop cups onto a tower          | Tap, click, Space                                    | Everywhere   |
| spill      | Draw straws to steer the pour   | Drag to draw; arrows and Space as a pen              | Everywhere   |
| straw stab | Stab each cup on the beat       | Tap, click, Space                                    | Everywhere   |
| order up   | Ice, syrup, pour, scoop, serve  | Hold, tap, click, Space                              | Everywhere   |

The menu lists them in this order, and their shortcut keys are `1` to `7` in
the same order.

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
| Labels, stats, controls, meta          | NHG Text `400`           | `12px` (`.boba-meta`)                                     |
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

### Pixel chips and keys

A painted scene prints its own HUD and on-screen controls in its pixel
language rather than laying paper over the art. Dialogs (menu, pause card,
results slip) sit outside the scene and stay paper; catch plays on the page,
so its tickets stay paper too.

- **Chips.** The dark riso paper (`#2A2422`) cut with one cell stepped off
  each corner (`--notch`, a `4px` cell), a faint cream rule just inside the
  edge, cream type in the one family. The same in both themes, as the
  scenes are. HUD tickets in a scene (`.boba-hud.is-bare`) render this way
  automatically, with the dark palette; `.boba-chip` prints any other.
- **The accent step.** Where a riso sheet earns a slab, a chip earns the
  accent printed a cell down and right of it, pixel-crisp, never tilted or
  roughened: the score ticket, a ticket in a rush (where it jumps a cell),
  and the lesson callout.
- **Keys** (`.boba-key`): on-screen controls in a scene (touch pads, a
  game's bottom bar) are pixel keys. A dark face with the chip's rule and a
  shaded foot; pressed (`:active` or `.is-down`) it sinks into the foot. A
  primary key (`.is-primary`) has the accent face. Key chips ride inside as
  small cream-on-dark tags, hidden on touch. Focus is drawn inside the key
  (the notch would cut a ring outside).
- **Canvas** chips and the sugar rush meter use the same paper
  (`NOTE_BACK`).

### Stages

- Catch plays on the page itself, lightly dimmed.
- Every other game paints its own opaque pixel scene, the same in both
  themes, and drops the HUD's paper wash (`.boba-hud.is-bare`), its tickets
  printed as pixel chips. See Scenes.

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
- **States.** Disabled is 60% opacity with no lift. Keyboard focus is the
  site's ring (`focus-ring`, `2px` past a paper gap), drawn on the face
  itself, so the rough filter bends it with the label's hand-cut edge
  rather than a smooth rectangle round it; a transparent outline stays for
  forced colours.
- **Reduced motion.** No lift, tip, or press travel; the colour changes stay.

HUD icon buttons (pause, mute) stay quiet: a `32px` pixel icon with a wash on
hover.

## HUD

Tickets pinned along the top: score at the start, controls (and lives,
where a game has them) at the end, anything else in the middle (a phone moves the middle ticket to a second
row). A paper wash fades the site header behind them.

The top is for what is glanced at between moves. A meter the player reads
while playing (a power-up filling, a level draining) belongs where the eye
already is: sugar rush draws its tea and sugar into the scene, low on the
screen under the runner, between the thumb pads on a phone. A thing drawn in
a pixel scene is pixel art on the scene's own cell grid, never a paper
ticket laid over it.

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
- There is no first-run tip strip: games teach in play (see Teaching).

## Dialogs

- **Menu.** A menu board: each game's name with its best score where the
  price would be, and its shortcut key. A `normal | expert` switch sits by
  the title (key `E`); the prices follow it. The menu's primary button opens
  the leaderboards (key `L`).
- **Leaderboards.** The menu card turns over to every game's board at once:
  the top five of each, for the mode the switch is on, the leader in the
  accent, with a `play` link into each game. A board nobody has signed shows
  only its name. Back or Escape returns to the menu.
- **Pause says each thing once.** A title and three buttons that carry
  their own key chips, on one line. Nothing else.
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
  the homepage interest markers, drawn on with a stroke-dash reveal. Inside
  a pixel scene a thing is ringed with pixel corner brackets instead
  (`drawBrackets` in `core/ghost.ts`): a lesson's thing in the accent, a
  landing in tea minus and straw stab's practice in cream, their arms
  growing on.
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

People skim screens and skip anything wordy, so every extra word hides the
ones that matter (Joel Spolsky, "Designing for People Who Have Better Things
to Do with Their Lives"). Keep only what the player acts on: a fact they
need, the next step, or why something failed. Cut slogans, flavor text,
reassurance, how the game works inside, words that restate a label or a
control's own state, and "please". Say what happened, not how or when the
game decided it.

- **Full sentences, never fragments.** A lesson, a deck, a live-region
  message is one short full sentence in sentence case with a full stop
  ("Hold jump to go higher.", "The last pearl dropped."). Labels and titles
  stay lowercase words (`points`, `paused`, `clocked out`).
- **One thing at a time.** A lesson is one sentence of eight words or fewer,
  plus its key. No kicker above it, no second clause after it.
- **Nothing to say, say nothing.** An empty state shows nothing: no "no
  combo yet", no "none yet", no line under a countdown that only repeats the
  number. The pause card is its title and its buttons. A results deck is
  there only when it says what ended the run.
- **No dot separators.** Not the drawn dot, not `·`, in tips, captions,
  popups, or receipts. If two facts need a separator, one of them should go.
- Live-region messages are plain sentences that say what happened and what
  it cost or earned ("You delivered a full cup for 150 points.").

## Every game

- **Expert mode.** One switch on the menu for all seven games
  (`arcadeExpert` in `src/lib/boba.ts`, remembered on the device). A game
  reads it once when it opens and passes it to its engine, where the expert
  rules live and are tested. Expert is a lot harder, not a small tweak, and
  stays fair: where a game proves something is reachable (coasters, gaps,
  rooms), the proof covers expert too. Expert runs keep their own bests and
  their own boards; `scores.ts` and `/api/scores` take the mode from the
  switch.
- **Teaching in play.** No game opens on a card or a self-playing demo: it
  goes straight to its countdown and teaches inside the live game, the first
  time each thing matters on this device (`createCoach` in
  `src/lib/arcade/core/coach.ts`, remembered per device). The pattern comes
  from the games that do it best (Mario's 1-1, Portal's chambers, Plants vs.
  Zombies' one-line tips):
  - **One thing at a time, where the eye is.** A callout (`Coach.svelte`)
    sits beside the thing in the world, never in the tickets and never on a
    card: one short full sentence with its key chip (a touch word, and the
    lit pad, on a phone), a dotted tail, and pixel corner brackets around
    the thing. The callout is a pixel chip (see Pixel chips and keys): the
    dark riso paper, stepped corners, the accent a cell behind it, cream
    text at deck size, the thing's name in ochre italic, keys as pixel
    keycaps (a cream face, ink lettering, a shaded foot) and Continue as a
    pixel key. It steps in rather than fading, and once the lesson is over
    it holds its place instead of following its thing.
  - **Important things pause play.** A lesson that explains something
    stops the game (`slow: 0`) within a beat, and Continue (`Enter` on the
    playfield; a focused button keeps its own Enter) brings it back to
    speed. A lesson that asks for a move freezes play at the exact moment
    to make it, while a ghost of the player's own sprite, dithered in cream
    (in the page's ink where a game plays on the page itself), runs the
    move in real time from where to make it along a line of chalk dashes;
    the player's move both resumes play and makes the move, and the lesson
    counts once the move has worked. A move made before it is taught is
    never taught; a move missed takes its lesson down so the next one
    teaches it. A lesson asks for its moment, not before it: a thing is
    named as it becomes relevant, not as it enters the screen's edge.
  - **Placement.** A callout never covers the player, the thing it names,
    the path the player is about to take, or the place they need to look or
    act; it takes the side away from the action, measured.
  - **The spotlight.** While something is being explained, the scene dims
    under a flat wash and what matters stays in full light: the player and
    the thing, each in a rectangle a cell clear of it, stepped down at the
    edge by one band of half the wash. On a pixel scene the rectangles are
    cut from its cell grid with stepped corners, the same shape as its
    chips; on the page (catch) they are rounded like the page's cards.
    Never an oval, a soft glow, or a dithered screen over the art. It eases
    in and out in a moment (at once under Reduce Motion) and goes as soon
    as the move is made.
  - **Smooth at any speed.** Where a game steps its rules at a fixed rate,
    play easing into and out of a pause draws the player and the camera
    between the last two steps, so it glides rather than judders; the rules
    themselves never change.
  - **Where time can't bend** (a beat on the audio clock, a window in
    milliseconds), a ghost and a highlight teach instead.
  - Ghosts, chalk and brackets are the arcade's only "holograms": dither,
    chalk dashes and pixel steps, never glow. Under Reduce Motion nothing
    pulses or draws on; the lessons and the pauses stay, because they are
    play.
- **Share.** Each game builds its own emoji lines for the results slip's
  `share` prop (`emojiRows` in `src/lib/arcade/share.ts` wraps a sequence):
  at most four short lines that say how the run went without explaining it.
  The words come from the slip's receipt `stats`, so a game names its stats
  for a stranger. `/dev/share` draws every game's card and text from sample
  runs, with an expert run and an empty one.
- **New rules, new board.** When a game's scoring changes enough that old
  scores can't be matched (catch going endless, sugar rush and cup stack
  getting much harder), its best cookie and its board move to a new version;
  the old board is kept, not shown. A change that leaves the opening alone
  keeps its board: sugar rush's second climb, which only makes the late game
  harder, kept existing bests and the existing board.

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
- **Pauses need intent.** The basket follows the mouse's x alone and the
  pointer is hidden over the page, so it drifts. During play a click on the
  tickets counts only once the pointer has rested on them; a pointer off
  the page holds play still for half a second, then pauses. P, Space, Enter
  on a focused button, and leaving the window or tab pause at once.
- **Taught on shift** (`catch-lessons.js`, timed on simulated shifts by
  `tests/catch-lessons.test.mjs`). Every lesson stops the whole shift while
  it explains; the page dims under a wash of ink, and only the basket and
  what the lesson is about stay lit, in rounded rectangles. Continue (Enter,
  or the slip's button) ends it, and play eases back. The first link to
  light up stops play with "A glowing link is about to throw." When its cup
  leaves the link, play freezes again: the way down is chalked to the catch
  line and a dithered ghost basket runs from the basket to where the cup
  will land, again and again (it waits there under Reduce Motion), with
  "Move the basket under the cup." beside it. The player's own move brings
  play back (the basket moved once the freeze has held a moment, or already
  waiting under the cup), and the basket follows the mouse all the while,
  so no move is lost. A cup let go past takes the lesson down for a later
  cup; a lesson whose cup is overtaken stands down, and the catch moves to
  that cup if it can still be reached; unmade after seven seconds it waits
  for a later run. The first golden cup, the first golden cup while a pearl
  is down (never on expert), and the first pair, lob and flick each stop
  play with a line beside the cup. A lost pearl and the bonus point are said
  beside the basket, where it was. A lesson about a cup is only ever about
  the next cup down, and play stops only while a hand that went to the
  slip's button could still get back under that cup (for any other line,
  from anywhere on the page), so stopping never costs a pearl (a test
  proves it, with hands that go to the button and back); lessons leave a
  second and a half of full-speed play between them. The slip never covers
  the basket, its way along the row to the landing, the cup, its way down,
  or the landing. Because catch plays on the page, its marks print in ink
  on the light theme and cream on the dark.
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
- **Taught on the belt** (`stab-lessons.js`, timed on simulated runs by
  `tests/stab-lessons.test.mjs`). The beat is the audio clock, so nothing
  slows; a device's first run opens on a practice instead. Its first four
  cups score nothing and cost no pearl, and neither does the bare belt
  meanwhile. "Stab when the cup reaches the notch." sits under the belt by
  the notch while cream pixel brackets close onto the notch in whole
  art-pixel steps for each practice cup, drawn over the spotlight, snug on
  the cup exactly on its beat; for the first two, a dithered cream ghost
  straw goes in on the beat as a dead-on stab would. Two good stabs in a
  row end the practice early; one with no good stab comes back next run.
  After that each thing is named as it first happens, under the belt by the
  notch: the early and late notes, a perfect, a graze, a pearl lost to a
  cup let go or to the bare belt, a new song's beat, nightfall's busier
  belt, and in expert the tighter windows. The first golden cup and the
  first cup between the beats are ringed in accent pixel brackets once they
  are the next cup the straw needs and wholly in view, never sooner. While
  a line explains, the sky, the stall and the belt behind the notch dim and
  the lane stays lit to the right edge. The two pearl lines stop the belt
  the way the pause card does (the audio clock suspended, so the music and
  the belt hold together and pick up exactly where they stopped): at the
  first moment within a second of the line that the next cup will still be
  a beat, and half a second, off, a quarter second on so the sound just
  made finishes; with no such moment the line is said over the running
  belt. Stopped, the line waits for Continue (Enter, its button, or a stab
  press once the stop has lasted a moment; a press never stabs a stopped
  belt). Every other line holds up to six seconds with Continue while the
  music plays on, since it is feedback best taken in the rhythm; Enter
  doesn't stab.
- **Beat lights.** The tickets' four beat lights are square pixel cells,
  lit solid in the accent on their beat.
- **The climb.** Normal plays two songs at tier 0 and two at tier 1, then
  steps every other song to tier 3, tier 4 at the eighth song and the top
  at the tenth. From tier 3 each tier carries a syncopated bar, and in each
  mode's top two tiers a perfect is a tenth tighter (`45ms`, expert
  `27ms`); good and graze never change.
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
clipped to the rail. You take one ticket at a time through the stations:
pump the syrup, drop in the ice, hold a tap to pour the tea to the ice line,
drop each topping from a swinging ladle, shake, and the drink is sealed,
graded, and handed over.

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
- **Taught on the shift** (`orders-lessons.js`, tested by
  `tests/orders-lessons.test.mjs`). The counter opens on its countdown, and
  the first drink on a device is walked through one step at a time: the
  ticket, then each station. Every line stops the whole shift (patience,
  arrivals, the clock and the bench) until it is answered, so no guest
  loses patience to reading; the step's own press brings play back and is
  made at once, and Continue counts it as known. The drop and the stamp stop
  at the very moment to make them, the ladle right over the cup and the
  needle mid-band, while a ghost plays the move (syrup squirting, a cube
  arcing in, the tea rising to the line, the scoop falling, the cup
  jolting, the press coming down). Each step waits a second of play after
  the last has gone, and a station already begun isn't taught. Until the
  shift's first ticket is taken nothing else is said, and that ticket is
  marked with accent pixel brackets stepping out a cell and back (still
  under Reduce Motion). Later things are named once each, only with the
  bench empty, a few seconds apart, and hold play until Continue or the next
  press. While a line is up the shop dims and the drink in hand stays lit.
  A slip never covers the cup, the station in use, the hand being taught,
  or (for a ticket) the rail. If a tap runs dry mid-pour, letting go isn't
  judged; the line says to brew, and the pour goes on after.
- **The hand row is on the counter.** The hand, Dump, Sample, Brew and Less
  are pixel keys (`.boba-key`), the hand's face in the accent; it shows
  pressed while the tap is held.
- **The making card.** The ticket being made is pinned under the cup: the
  drink's stations in the order it is built, with what each wants, the one
  at hand marked and the ones behind graded, and the guest's patience. The
  cup starts under its tea's tap. Dump pours the cup out and starts the same
  drink again; an empty cup can still go to another ticket; ↓ takes back the
  last pump or cube until the cup moves on. On a phone the card's lines sit
  in two rows, and a finished line shows its grade. A notice takes the
  guest's name's place, never their patience.
- **Patience** is a bar on every ticket and on the card. At 30% the ticket
  says *leaving* and earns a slab, and at 25% it jitters (not under Reduce
  Motion).
- **The pace** climbs smoothly between the phases, holding each phase's
  values at its middle. The first two orders of a normal shift are plain,
  the critic waits for three drinks to be served, and the ladle dips into
  the next scoop's jar by itself, except in expert.
- **The hand-off.** A perfect drink turns once on the counter as it goes
  over (sprite stacking), and is served at the same moment as any other; the
  receipt rises over the guest who took it.
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
  turned into distance at the slide's speed: `32` ms at the first cup,
  tightening to `15` ms by 24 cups (about half a unit throughout, as the
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
- **Taught on the tower** (`stack-lessons.js`, tested on the real rules and
  the real coach by `tests/stack-lessons.test.mjs`). In normal, each first
  stops play: the game comes to a stop within a beat and a spotlight dims
  everything but the row the cup slides in and the tower's top, until
  Continue (`Enter`, the slip's button, or a drop press once the line has
  been up a moment; a press while play is stopped never drops the cup,
  which stopped wherever the line found it). The first cup slides at full
  speed over a dithered cream ghost of itself, sitting exactly where a
  perfect drop lands, and stops the moment it covers it, under "Drop the
  cup when it covers the ghost."; the drop starts play again and lands
  perfect, and a cup landed before it gets there counts as known. Then come
  the first slice (which hangs where it was cut while its line is up,
  riding with the tower), the first perfect, a streak one perfect short of
  growing the cup back (in expert, learned only when it does), and the
  personal best's line, named beside the tower as it comes down. Expert
  shows the same lines and ghost at full speed and never slows or stops, so
  its board's timing is untouched; there the named slice falls slowly.
  Callouts never cover the row the cup slides in, the tower's top or the
  named slice. A missed first cup is taught again.
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
- **Taught in flight** (`lander-lessons.js`, timed on real sites by
  `tests/lander-lessons.test.mjs`). The game opens on its countdown, and the
  first site's intro is read during it. Every lesson pauses play and dims
  the scene to the cup and what it names. A thing waits for Continue
  (Enter, or the slip's button); a move freezes play at the moment to make
  it while its ghost flies it in real time, and the move itself (or
  Continue) brings play back. Burning comes first, just after "go": a
  dithered cream ghost of the cup holds burn below it until its fall stops.
  The coaster is named next: the one the flight aims at, nearest straight
  below the cup (within 20 units counts as a tie, which the lower one
  wins). Then the tilt: the ghost flies the path the engine's own autopilot
  would take to that coaster from here, along chalk dashes, and the tilt
  counts once burns against the drift have the cup lined up over it. A
  touchdown about to go wrong (too fast, leaning, drifting) is frozen for
  when 0.2 to 0.5 s are left to fix it, and only while coming down slow,
  level and still from there would still land by the engine's own rules;
  otherwise no warning comes, and one already up is withdrawn. The tea, a
  windy site's pennants, a lander lost to a crash, and a feather landing
  each get a line the first time they matter. A move made before it is
  taught is never taught; one made without working (4 s, 8 for the tilt)
  comes down uncounted and waits for a later run. On touch the controls are
  pixel keys with pixel icons, burn the primary key; the key to press earns
  the accent step (cream behind burn), and each key, pointer and button
  holds on its own. Captions are pixel chips low over the regolith and
  never share the screen with a lesson. The cup and camera are drawn
  between physics steps, so pauses ease smoothly, and replays prove the
  same inputs land the same at any speed, frame rate or pause.
- **The first flight is guided.** Until the device has landed once, the
  autopilot's path from the start to the coaster nearest straight below it
  is drawn in chalk the whole way down, from the countdown on, with a
  dithered ghost of the cup a beat ahead of it; the way already flown is
  the cup's own trail. Strayed 40 units off it, it is flown again from the
  cup (as it is for the tilt lesson). It goes in three steps at the
  touchdown. Such a device's site 1 is always the same (`FIRST_SITE_SEED`,
  a site the engine itself makes, with a wide coaster on a flat plateau
  just ahead), and its cup starts low enough for a lesson's line to fit
  above it on a phone.
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
- A landing is ringed with cream pixel brackets that grow on round the
  lander. A crash is a fireball, then spilled pearls
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
- **Then it climbs again.** Once every set piece is out (a minute and a
  half in, 44 seconds in expert), a second climb runs to about five minutes
  (two and a half in expert). Set pieces start to chain: two, later three,
  back to back with only a short run-in between instead of a plain roof,
  picked so the moves change (hop, slide, hop; slam, slide). A chain never
  lays anything after a piece that comes down from the air, never puts two
  timed pieces together, and pairs two that can kill only in the second
  half; anything lethal keeps its full runway. Pieces carry more (up to six
  to hop or slide under), gaps lose their easy end, lethal pieces come up
  twice as often, and the top speed creeps from 390 to 415 (430 to 460 in
  expert). After every eight or so chained pieces (ten in expert) comes a
  breather, a plain roof and a line of pearls, so the climb comes in waves
  rather than a wall. Four pieces belong to it, made of the same things: a
  barrage (barrels, then a drone to slide under), steamworks (a row of pipes
  on one rolling timer), a wire walk (chimney tops over low roofs live from
  wall to wall; in a rush the hops carry too far, so slam onto each top),
  and boards that crumble into a railway gap. The opening is untouched, and
  the test bot runs the whole climb in both modes without losing a cup.
- **Spare cups are the lives.** A run starts with one and can hold two; the
  HUD shows a slot for each, the cup when held, a dashed outline when not.
  Running into anything you should have hopped or slid under (a crate, a
  sign, a barrel) costs one, as does a fall into the alley or a cup
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
  a slam just before something low never lands standing into it. A slide
  lasts as long as down is held (half a second from a tap). Flying into a
  flock of pigeons only scatters it; it never costs a cup.
- **Sugar rush.** Pearls fill a meter of ten sugar cubes; triggering it
  smashes anything that would cost a cup (never anything lethal) for a few
  seconds, with afterimages and speed lines. The meter and the tea are drawn
  in the scene under the runner, not in the tickets
  (`src/lib/arcade/runner-meter.js`): a dark chip on the scene's 4 px grid,
  like the lesson callout, with a pixel cup whose tea drains in half rows
  (its outline blinks in the accent under a quarter) and ten sugar cubes,
  five cells a side, printed under the word "sugar". Full cubes are solid;
  empty ones are faint outlines. A full meter turns the cubes gold under
  "rush", with the X key beside it on a keyboard and a glint along the
  cubes (still under Reduce Motion); a rush drains them. On a wide screen
  the cup sits beside the word over a row of ten cubes. Between a phone's
  slide and jump pads it stands up, the word beside the cup's foot and the
  cubes under both in two rows of five; in one row where the pads leave
  room (a tablet, a phone on its side); smaller if the room is short, just
  over the pads when larger text leaves none, and under the tickets if even
  that would squeeze the course. It is placed only on a resize, so it never
  moves mid-run, and sits outside the screen shake.
- **The course is authored, then shuffled.** Thirty-one set pieces unlock
  with distance and never repeat back to back. Besides awnings that bounce,
  vents that lift, cables to ride, crates, pigeons and split routes, things
  move or keep time: barrels that roll at the runner, a rival's drone at
  slide height, signs swinging from a gantry, steam pipes that blow on a
  timer (hop the pipe, or jump the plume), and rotten boards over a gap
  that give way a moment after they take the weight. A test bot runs long stretches on many seeds, in both modes, without
  losing a cup, so every gap is clearable and everything can be avoided.
- **Expert** starts at 215 and climbs to 430 in about a minute and a half
  (creeping on to 460 over its second climb),
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
- **Taught on the run** (`runner-lessons.js`, timed on real courses by
  `tests/runner-lessons.test.mjs`). Every lesson pauses play. A move stops
  play at a small accent post on the roof, the moment to make it, while the
  runner's ghost makes it from there in real time; its own key or pad
  resumes play and makes the move, and other keys wait: jump over the first
  gap or crate, hold for a tall one, slide under the first line, glide off
  the first long drop (letting go over the roof below), and slam the first
  crates, taught in the air over them at the moment to press down. Pearls,
  the customer, a spare cup, a golden cup (worth points once both spares
  are held), hazard stripes and each set piece get one line about half a
  second before the runner meets them (pigeons just before they take off),
  never in a move's run-up, and Continue brings play back; the first slosh
  says what spilled tea costs. The sugar rush names itself the first time
  the meter is full, on a plain stretch, and X starts it. The callout takes
  the side clear of the runner, the way ahead and its thing. A tap is held
  until the run has seen it, a press made while play is stopped never
  carries into it, and each key, pointer and pad holds on its own. The
  touch pads are pixel keys with pixel icons, rush in the accent; the pad a
  lesson is about gets pixel corner brackets.
- **Sharing** pastes the distance, each coaster as a cup (full, part, or
  missed), and the cups lost, then what ended the run.

### Spill

A kettle pours a stream of tea; you draw straws, with a limited length per
room, to steer it into the cup.

- **The liquid is simulated and drawn as pixels,** never as circles: tea,
  milk, and a quantised blend where they mix, with a lighter surface line and
  duller puddles. Cups fill and overflow. The simulation runs while a room
  is on screen, stopping only while a lesson holds it: the verdict waits
  until the tea has come to rest, and the tea keeps moving after it.
- **Straws** are pink and white, drawn by dragging and removed with a tap,
  refunding their length; `Clear` removes them all. There is no undo. They
  can be drawn and removed during the pour, and a straw's end that comes
  close to another straw snaps onto it so a joint never holds tea back.
- **Straw left is always in sight.** The gauge is painted into the counter
  between Pour and Clear (`spill-gauge.js`): a dark chip on the kitchen's
  4 px grid, like the callout, printing "straw" and the figure left in the
  pixel alphabet over a pixel straw that shortens from the right; the
  stroke being drawn eats into it live, dithered, and each straw down is a
  faint outline at its cost. Under a fifth the straw goes coral, the chip's
  rule blinks in the accent (steady under Reduce Motion) and it says `low`;
  it says `out` in place of the figure when none is left. On a phone it uses
  three-pixel cells to share a row with the keys. While drawing, a dashed
  ring around the pen shows how far the straw left can still reach.
- **The controls are part of the kitchen.** The room stands on a steel
  counter the width of the kitchen; Pour (Next once a room is cleared, the
  same key) and Clear are pixel keys (`.boba-key`, Pour in the accent) set
  into sockets in its front, with the gauge between them. On a short, wide
  screen they stand in a steel cabinet beside the room, gauge over keys,
  the caption over the cabinet, so the room has the screen's height. All of
  it is measured and painted on a resize only. The caption and the verdict
  are pixel chips.
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
- **Taught in the room** (`spill-lessons.js`, proven by
  `tests/spill-lessons.test.mjs`). A device that has cleared nothing goes
  straight into room 1 through its countdown; one with progress opens on the
  level select, as before. Nothing is slowed: every lesson holds its part of
  the room instead, frozen outright (dial, belts, rails, the tea in the air
  and all), so it later plays out step for step from where it stopped: a
  planning lesson holds planning, the fill line stops the pour on the step
  tea first reaches a cup, taking a straw back holds whichever part it
  comes up in, and a result's lessons hold the next room. Straws can still
  be drawn and taken back while it waits. Each lesson may hold for seven
  seconds of a visit (planning time is points).
  Continue (`Enter`, or the slip's button), pressing Pour, or doing what the
  lesson asks lets the room run on. While any lesson is up the kitchen dims
  to the thing it is about, in expert too, though expert never holds its
  five seconds. Room 1, the first time on a device, draws its own route as a
  cream ghost straw, with chalk marching the way to draw it from an accent
  post under the stream and the pen keys beside it; the route counts as
  learned when the straws as laid would pour into the cup, or when the
  player continues past it, and then
  Pour is pointed out. A straw that spoils it is where taking a straw back
  is taught. Each fixture is named, in italic with brackets round it, at
  the start of the first room that has one. The gauge is named the first
  time straw runs low, the dial as the kettle is about to pour by itself,
  and the fill line as tea first reaches a cup, the whole cup bracketed and
  the slip off to its side, clear of the tea coming in. The stars, the
  points and a spill's hint are named the first time a room ends that way.
  The callout's side is chosen as it goes up, from the sides that fit, by
  what each would cover: the line being taught first, then cups and tea on
  its way (or where each stream will fall), kettles, what the lesson
  lights, and least of all a key it isn't about. A fixture bigger than the
  brackets (a fan's draught, glass, a pipe's whole run) is bracketed whole.
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

- **One core.** What more than one game needs lives once in
  `src/lib/arcade/core/`: `math` (clamp, lerp, smoothstep, damp, snapping),
  `rng` (the seeded mulberry32 and position hashes every scene is seeded
  by, pinned by tests so nothing seeded ever moves), `color`, `dither` (the
  Bayer threshold and the dithered band sky), `loop` (the frame loop: capped
  steps, paused drawing, a clean stop; and `frameSteps`, a fixed-step
  clock's steps per frame), `pool` (particles, walked last to first, which
  is the order they are drawn in), `controls` (keys held and on-screen hold
  buttons, each source holding on its own, presses latched until a step
  sees them, and when to show the buttons on touch), `city` (the skylines,
  seeded cell by cell), `coach` and `ghost` (the teaching), and
  `sprite-stack`. Palette values shared across scenes (cream, the accent,
  the halo, the popup chip, gold), the boba-cup balloon, and `drawChipNote`
  (a popup on its dark chip) are in `art.ts`. A game keeps a local helper
  only where the shared one would change what it draws.
- **Sprite stacking, sparingly.** `sprite-stack.ts` builds a round object
  from slices (`latheSlices`, one disc per layer of its profile), turns
  every slice by the same angle with nearest-neighbour sampling, squashes
  them for a camera looking down at a slant, lifts each a cell above the
  last, and outlines the finished stack once. The result is an ordinary
  sprite grid, so it goes through `cachedSprite` like everything else.
  It is for a drink that turns in place, not for anything a player aims at.

- The arcade is loaded the first time it opens, so its code and its global
  sheet (`arcade.css`) never ship with an ordinary page view. It sets
  `data-justify="off"` so the paragraph justifier leaves game copy alone.
- Shared pieces live in `src/lib/components/arcade/` (menu, leaderboards,
  countdown, pause card, results slip with the per-game leaderboard and
  share button, the coach's callout, expert tag, pearls, cup timer, HUD
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
