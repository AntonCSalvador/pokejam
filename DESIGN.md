---
name: PokéJam
description: A Pokémon basketball arcade cabinet, from franchise selection to the final dunk.
colors:
  bg: "#15101e"
  panel: "#291d36"
  ink: "#fff3d7"
  muted: "#cbbbcc"
  line: "#6c516d"
  gold: "#ffc460"
  mint: "#c9ef93"
  surface-deep: "#1c1427"
  control: "#33253d"
  control-hover: "#4b3654"
  action-ink: "#301b23"
  action-hover: "#ffdc8d"
  chicago: "#ee4c59"
  chicago-dark: "#671f35"
  miami: "#ffb33b"
  miami-dark: "#803b20"
  boston: "#7bcd88"
  boston-dark: "#245a45"
  golden-state: "#80baff"
  golden-state-dark: "#244e8a"
  toronto: "#ed7d9d"
  toronto-dark: "#6b315a"
  minnesota: "#9edce7"
  minnesota-dark: "#284e65"
  sacramento: "#c4a0f2"
  sacramento-dark: "#503674"
typography:
  display:
    fontFamily: "Arcade, monospace"
    fontSize: "clamp(54px, 7.6vw, 92px)"
    fontWeight: 400
    lineHeight: 1.05
  headline:
    fontFamily: "Arcade, monospace"
    fontSize: "clamp(18px, 2.4vw, 29px)"
    fontWeight: 400
    lineHeight: 1.6
  action:
    fontFamily: "Arcade, monospace"
    fontSize: "13px"
    fontWeight: 750
    lineHeight: 1.8
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  compact-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 800
    lineHeight: 1.8
  label:
    fontFamily: "system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  square: "0"
spacing:
  compact: "8px"
  control: "12px"
  group: "16px"
  panel: "20px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.square}"
    padding: "12px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "{colors.control}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "12px 18px"
  button-secondary-hover:
    backgroundColor: "{colors.control-hover}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "8px 13px"
  selection-nav:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.muted}"
    padding: "19px 28px"
  ratings:
    backgroundColor: "{colors.surface-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "22px"
---

# Design System: PokéJam

## Overview

**Creative North Star: "The Indigo Arena arcade cabinet"**

PokéJam uses the user-approved NBA Jam-inspired world: oversized Pokémon, pixel lettering, a warm hardwood court, stadium darkness, and direct game controls. The opening is a sequence of game screens that advances toward basketball. It supersedes the original long page with the court and room controls beneath an introduction.

This system records the built HTML, stylesheet, menu, renderer, and shared roster catalog. The direction is pinned and code-led; no generated comp or design seed applies. Screen composition lives in `.impeccable/surfaces/public-index-html.md`. Current menu captures are in `.impeccable/review/`; executed checks and remaining limits belong in `docs/verification/arcade-selection/verification.md`.

**Key Characteristics:**

- Aubergine enclosure, cream text, gold actions, mint focus, and franchise-colored identity.
- Square panels and original geometric franchise emblems around credited pixel sprites.
- Display type for spectacle; system sans for compact names, descriptions, and state labels.
- Animated portraits and basketball action, with an explicit reduced-motion path.

## Colors

The palette combines a dark stadium enclosure with warm cabinet materials and clear, bright game state.

### Primary

- **Cabinet gold** (`gold`) identifies forward actions, section headings, selected borders, and filled rating segments.
- **Control mint** (`mint`) identifies keyboard focus, signature names, and available player actions. Court selection rings use the renderer's related mint highlight.

### Secondary

Each franchise owns a bright identity color and a dark field from `public/game/data.js`. The same pair follows its emblem, roster panels, matchup, court paint, and scoreboard: Chicago red, Miami amber, Boston green, Golden State blue, Toronto rose, Minnesota ice blue, and Sacramento lavender. Names and side numbers always accompany color.

### Neutral

- **Stadium aubergine** (`bg`, `panel`, `surface-deep`) separates the page, cabinet, and inset tools or ratings.
- **Warm cream** (`ink`) carries functional text; **muted lavender** (`muted`) carries supporting instructions.
- **Plum line** (`line`) separates quiet controls. Maple and brass tones frame the court and team board; these are material treatments, not new action colors.

**The Side Identity Rule.** Franchise color follows the selected franchise, never a fixed left/right side. Gold marks selection and mint marks focus; neither replaces the franchise name or player status.

## Typography

**Display Font:** self-hosted Press Start 2P, registered as `Arcade`, with monospace fallback. Preserve its bundled license and existing font asset.

**Body Font:** system UI sans-serif. Its compact, heavy variants keep long franchise and Pokémon names readable.

### Hierarchy

- **Display:** the two-line home wordmark uses the display token; the JAM line is slightly larger. At the small breakpoint the base wordmark is 62px.
- **Headline:** gold screen titles use the headline token; small-screen titles are 19px.
- **Action:** primary controls use arcade type. Play and Tip Off are deliberately larger than selection navigation.
- **Compact title:** bold sans names appear on franchise tiles and replace selected pixel labels on narrow screens. Desktop player and matchup names retain arcade type.
- **Body and labels:** descriptions, city names, ownership states, rating numbers, and help use readable sans text. Functional HTML text has an 11px minimum; reduce density or change font before shrinking it.

**The Readable Cabinet Rule.** Pixel lettering supplies identity at display scale. Compact functional content may use sans; preserving a decorative font never justifies clipped names or sub-11px HTML controls. Canvas lettering uses the fixed game coordinate system and is not an HTML text-size token.

## Layout

A compact marquee and footer flank one centered cabinet (1196px maximum width). Menus replace one another inside it. Desktop selection screens use horizontal comparisons, with the next action in a distinct lower navigation strip and room tools below.

- **Home:** centered wordmark and gold Play control, flanked by Charizard and Nidoking portraits. A subdued Canvas exhibition and stadium glow sit behind them. Join Friends and How to Play form a secondary row; factual roster/capacity copy sits at the cabinet foot.
- **Teams:** two side controls and two matchup previews sit above a seven-column franchise board on desktop.
- **Players:** four numbered starter slots lead a two-column drafting area: the active side's three-player roster on the left, ratings and signature on the right. Only two of the three roster members start.
- **Matchup:** two opposing franchise panels and a central VS. Each side shows its two starters, names, and compact ratings before the countdown replaces the start action.
- **Court:** a 640×360 Canvas scales at 16:9. Preserve the angled hardwood projection, pixel crowd, hoops, team paint, and court signage. Scoreboard above; court status, player meters, and control legend below. Results reuse the court with an overlay.

Recurring spacing is compact within controls and larger between functional groups; the frontmatter records the recurring 8–24px steps. Breakpoints are 1000px and 760px. At 1000px, emblems and padding tighten and starter contents stack. At 760px and below, cabinet margins become 10px, the header wraps, and nonessential connection/step text hides.

At the inspected 390px width, the team board is **three columns**, the four starter slots form **two columns**, and the roster stays **three columns**. Ratings move below the roster. Matchup keeps **two opposing sides** while each side's two players stack vertically. Long menus scroll vertically; they do not compress into one viewport. Home portraits move between title and Play. Small-screen menus remain usable, but gameplay requires a desktop keyboard.

## Elevation & Depth

Depth comes from dark tonal layers, brass borders, inset wood framing, and the subdued stadium behind the title. The cabinet has a diffuse ambient shadow (`0 12px 35px #08060d80`); the franchise board has an inset shadow (`inset 0 4px 12px #36201970`). Home lettering and portraits have soft drop shadows. These support the arcade materials without adding raised card stacks.

Selected side controls have a gold inset bottom edge. Selected franchise tiles have an outer gold outline; keyboard focus has a separate mint outline (3px, offset 4px). Do not treat focus and selection as the same state.

## Shapes

Controls and panels have square corners, generally with 1–3px borders. The frame is rectilinear; round forms belong to basketballs, hoops, ground markers, and the circular original franchise emblems. Franchise marks are authored SVG paths, not text glyph substitutes or copied NBA logos.

**The Pixel Edge Rule.** Render Canvas and sprite imagery without smoothing. Preserve sprite frame bounds, pivots, per-species scales, and front-facing ball anchors; source row 2 faces right and row 6 faces left. Keep sprite provenance in `public/assets/CREDITS.md` when changing assets.

## Components

### Buttons and fields

Gold primary buttons advance the game; plum secondary buttons and transparent quiet buttons serve alternate actions and settings. Buttons change fill on hover, move down 2px while pressed, and show reduced opacity when disabled. Their short transition is 150ms. Visible focus applies to buttons, links, inputs, and the court.

Join uses one labeled text field for a court link or code, with a dark fill, pale plum border, gold caret, and mint focus outline. Invalid joins and connection issues use a readable status notice above the cabinet. Creation and asset loading change the Play label and disable it while pending.

### Selection boards and ownership

Native buttons carry `aria-pressed` selection state. Franchise tiles contain an emblem, mascot name, city, and explicit SIDE 1 / SIDE 2 tags. Starter slots contain a portrait, P1–P4 number, name, franchise, and YOU / AI / HUMAN / RESERVED / JOINING state.

The server owns permission: humans edit their own starter; side captains edit AI starters and choose the franchise only when no teammate or reservation protects that side. The host configures all-AI sides. Unavailable choices are disabled and explained in adjacent text. Choosing a Pokémon already on an AI teammate shows SWAP WITH AI; a protected human's choice shows PLAYER TAKEN. An available slot can be claimed through Play as P… . Lineups lock at countdown and persist for rematch selection.

### Ratings and signature

Focus or pointer hover on an enabled roster choice updates a separate ratings panel. Four rows combine a label, ten segmented blocks, and an explicit number out of ten. Speed, Shooting, Dunk, and Steal come from the same catalog as actual movement speed, shot timing, dunk range, and steal recovery. Signature name, full-meter + L requirement, and effect description appear below. Do not imply balance has been verified.

### Navigation and focus

Play → teams → players → matchup/countdown → court → results/rematch is the main sequence. Back preserves selections; explicit Home buttons and the logo exit the room. Escape from the team screen returns locally to the title while keeping the room and session; the primary action becomes Resume and returns to selection. The cabinet foot carries 2 ON 2, roster, and capacity facts; the outer footer carries keyboard requirements, sprite credits, and fan-game attribution. Join and Help remain separate simple screens.

Tab reaches enabled native controls. Arrow keys cycle enabled choices in the focused side, team, starter, or roster group; Enter activates the focused button and starts Play from Home. Escape goes back in menus. Shortcuts ignore editable fields and gameplay. New screens focus their heading, and tip-off focuses the court. Sound starts muted; Sound and Less motion stay in the marquee.

### Motion and Canvas

Home portraits have a slow CSS float (3.5 seconds, staggered) and Canvas idle animation; roster and matchup portraits animate from their source frames. The exhibition is subdued behind controls. CSS uses no large screen transitions.

Less motion initializes from the operating-system preference. It disables CSS animation/transitions, freezes the exhibition and portrait idle ticks, and suppresses crowd bounce and score shake. Meaningful basketball animation remains: movement, dribbling, passes, jumps, shot arcs, dunks, blocks, staggers, and signature actions. Preserve readable possession and the front-facing ball anchor throughout. No new decorative flashing is part of this system.

## Do's and Don'ts

### Do:

- **Do** keep one clear forward action per game screen and usable Back/Home navigation.
- **Do** pair franchise color with names, side numbers, and explicit ownership state.
- **Do** keep functional HTML text at least 11px and use compact sans labels where pixel names become cramped.
- **Do** preserve pixel edges, sprite metadata, source credits, and basketball readability.
- **Do** preserve visible keyboard focus, reduced motion, muted startup, and readable numeric ratings.

### Don't:

- **Don't** shrink the team board below three columns or the roster below three columns at the established 390px layout; let the page scroll vertically.
- **Don't** replace the angled court or authored basketball motion with a menu-only spectacle.
- **Don't** add an eyebrow above the home wordmark; it competes with the title and was removed in review.
- **Don't** present locked choices as editable or display invented ratings unrelated to the simulation.
- **Don't** infer touch gameplay, competitive balance, audible verification, other-engine verification, or public hosting from these visuals.
