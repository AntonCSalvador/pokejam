# Arcade selection verification

Session: 2026-10-12–13. Branch: `feat/arcade-selection`, based on `e0fb115`. Local Node server; Microsoft Edge 155.0.4283.45 through headless Playwright. No hosting work.

## Accepted behavior

- Home → Play → teams → players/ratings → matchup/countdown → match/results → rematch. Seven franchises, 21 species, two distinct starters from each three-player roster.
- Captain and human ownership rules enforced by server, including stale edits, reservations, reconnect handoff and AI swaps. Franchises cannot duplicate. Selection locks at match creation and survives rematches.
- Displayed ratings drive actual movement, shooting timing window, dunk reach and steal recovery. Signatures follow species rather than slot. Original four profiles retain prior speed/window/dunk/recovery values.
- Selected franchises drive scoreboards, court signage/colors, player rings, portraits and winner text. Source sprites for all 21 species are present. No new runtime or frontend dependencies.

## Executed checks

| Command | Evidence |
| --- | --- |
| `npm test` | 36/36 pass: catalog/invalid selections, all 42 ordered team pairs, complete seeded matches covering all species, abilities/prediction, room permissions/races/reconnect, real HTTP/WebSocket, existing basketball rules |
| `python tools/import_sprites.py --check` | All source sheets and metadata validated locally |
| `node test/animations.mjs` | Seven franchise action atlases and release samples generated and visually inspected; both directions, nine poses, ball anchors |
| `node test/selection.mjs` | Real UI/socket path, catalog-matching ratings/signatures, Back, Enter/arrows/Escape/Tab, focus retention, invite text entry, zero menu input messages, two-client ownership, full-room Home, create-error recovery, all 21 portraits, zero browser exceptions |
| `node test/exit.mjs` | Reload recovers; Home exits pregame/live match; new room stays new |
| `node test/recovery.mjs` | Two browsers at 150 ms RTT, late join at stoppage, movement acknowledgement, duplicate token replacement, real server restart recovery; zero browser exceptions |

| `npm run test:browser` | Complete Sacramento/Toronto solo match (0–5), four-human room, protected teammate, full-room recovery, missing-art fallback, controls/blur/switch/reconnect, results/rematch. Rematch preserved teams/species and reset score, clocks, meter and actions; zero browser exceptions |
| `npm run test:latency` | Complete Boston/Golden State game (50–44), four independent clients with 75 ms delay each direction. All 4,572 common ticks agreed on franchises, species, abilities, score, possession and phase; zero protocol errors |

## Visual evidence

Home, teams, players and matchup have paired `*-desktop.png` (1280×960 viewport) and `*-small.png` (390×844 viewport) full-page captures. `court-selected.png` shows selected Sacramento/Toronto identities. `delayed-coop.png` shows actual delayed co-op. Franchise `atlas-*.png` files and release samples document sprites.

Two author inspection batches checked every menu capture. Functional labels were enlarged to at least 11px; compact labels use system type while display headlines retain the pixel face. Small team board uses three columns; player ratings move below the roster. No horizontal overflow at 390px. Gameplay still needs a keyboard.

Impeccable's detector ran once. Typography findings were corrected; home clipping deliberately contains the decorative court backdrop and portraits. A fresh reviewer used the shipped degraded-role instructions because typed Impeccable agents are not exposed by this harness. Review covered the eight captures, code-led direction contract and craft floor; no separate QUALITY BAR card was supplied. Final verdict and code review are recorded after completion.

## Assets and limits

Pinned SpriteCollab source: `6e4cbc000566b1628daff88c317e15c907acf98f`. Original pixels and per-sheet author/license records retained in `public/assets/CREDITS.md` and species source files. Importer uses Python 3/Pillow only for asset development; runtime uses committed files.

Source Pokémon poses are sequenced as basketball actions, not newly drawn sport animations. The 21 profiles are initial tuning, not verified competitive balance. Audible output, other browser engines, subjective game feel, internet play and Docker execution remain unverified. Full-room recovery copy is now explicit; historical font-license trailing whitespace remains untouched. Historical first-playable screenshots/record were preserved.

## Implementation decisions

- New roster, ability, prediction and seeded-match checks share `roster.test.js`; tradeoff: this file also contains integration coverage.
- Added per-frame alpha bounds to sprite metadata so large/floating portraits fit; tradeoff: regenerated manifest, with source pixels unchanged.
- Extended menu updates with `ready`/`busy` loading flags; tradeoff: a small interface extension, with the app retaining session ownership.
