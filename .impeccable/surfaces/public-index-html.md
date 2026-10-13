---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/style.css","public/menu.js","public/app.js"]
---

# Arcade opening surface
Mode: Experience, with keyboard-operable selection controls.
Scope: Home, team/player selection, matchup, match/result transitions.
Authority: user-approved NBA Jam-inspired arcade sequence and written spec. Code-led, pinned world; no alternate identity requested.

## Direction contract
THESIS: Start a Pokémon basketball arcade cabinet; each screen advances toward tip-off.
OWN-WORLD: Aubergine stadium, maple hardwood, cream pixel lettering, brass borders, team-colored selection frames and original geometric emblems.
STORY: Enter arena, choose franchise, compare Pokémon, lock lineup, play.
FIRST VIEWPORT: Large centered PokéJam wordmark, two oversized Pokémon framing it, one gold Play control, secondary Join Friends and How to Play; settings stay in compact marquee.
FORM: User-pinned NBA Jam title and selection-board composition; seed not applicable to the approved reference.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Built surface

The implementation is the approved home → teams → players and ratings → matchup/countdown → court → results/rematch sequence. `DESIGN.md` records its visual system; `.impeccable/design.json` carries component examples and schema extensions. The older single-page invitation/court composition is superseded.

- **Home:** the large two-line cream/gold wordmark, Charizard and Nidoking, subdued animated court, one gold Play control and Enter hint. Join friends and How to play are secondary. Sound and Less motion remain in the marquee. No eyebrow precedes the wordmark; facts belong at the cabinet foot or outer footer.
- **Teams:** two editable-side controls, opposing team previews, and all seven franchise tiles inside the wood-framed board. Each tile has an original SVG emblem, mascot, city, and selected-side tag. Initial matchup remains Chicago versus Miami.
- **Players:** four numbered human/AI slots precede the active franchise's three portraits. Choose two distinct starters. Focus previews four 1–10 ratings and the named signature; the shared catalog drives both these values and game mechanics.
- **Matchup:** opposing franchise panels show all four starters and compact rating summaries around VS. The host's Tip Off gives way to the authoritative countdown; guests receive explicit host-start copy.
- **Court/results:** retain the angled 640×360 pixel court, selected franchise signage, score/clock strip, team-and-number ground markers, player meters, and control legend. Final score and winner remain over the court. Rematch retains lineups and returns to selection.

## Responsive contract

The cabinet is capped at 1196px. Desktop teams use seven columns; four starter slots sit in one row; roster and ratings share a two-column drafting area. Desktop matchup players share a row within each franchise.

The implementation tightens at 1000px and changes composition at 760px. At the inspected 390px width: teams use three columns, starter slots use two, roster choices retain three, and ratings appear below. Matchup retains two opposing franchise columns, with each side's two players stacked. Selection pages scroll vertically. Home portraits sit between title and Play; decorative portrait captions hide. Functional HTML labels remain at least 11px, with bold sans replacing cramped pixel names. Gameplay still requires a keyboard.

## State and ownership contract

Humans edit their own starter; the side captain edits AI starters and chooses the franchise only while no teammate/reservation protects the side. The host controls an all-AI side. Disabled controls and status copy communicate locks. Human/reserved slots cannot be displaced; choosing an AI teammate's Pokémon is an explicit atomic swap. Available slots expose Play as P… . Team keys must differ, starters on a side must differ, and the lineup locks at countdown.

Native Tab navigation, arrows within enabled choice groups, Enter activation, and Escape back remain available. Menu keys ignore text fields and gameplay. Screen changes focus the heading; tip-off focuses the court. Back preserves choices. Escape from teams returns locally to the title while retaining the room/session, and the primary action becomes Resume. Explicit Home buttons and the logo leave the room. Muted startup, mint visible focus, readable status notices, text beside color, and Less motion are part of this surface.

## Motion and asset contract

CSS portrait float and Canvas idle loops decorate menus; reduced motion stops both, freezes the exhibition, and suppresses crowd bounce and score shake. Live basketball action remains legible. The 21 species use credited multi-frame sprite assets; preserve animation metadata, pivots, scale, right/left facing rows, and front-facing ball anchors. Emblems are original SVG artwork. No generated image comp or random design seed applies to this user-pinned direction.

## Evidence and exclusions

The final documenter inspected the built HTML/CSS/menu/renderer/catalog and `.impeccable/review/{home,teams,players,matchup}-{desktop,small}.png`. `desktop.png` and `mobile.png` are home aliases. Fresh test outcomes and remaining limitations are owned by `docs/verification/arcade-selection/verification.md`; screenshots alone do not establish gameplay or browser coverage.

The removed home eyebrow, superseded four-column mobile board, and incidental one-off layout values are not reusable design rules. Franchise ratings remain initial tuning. Visual review does not establish competitive balance, touch controls, other browser engines, audible output, or internet deployment.
