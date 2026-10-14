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

Impeccable's detector ran once. Typography findings were corrected; home clipping deliberately contains the decorative court backdrop and portraits. A fresh reviewer used the shipped degraded-role instructions because typed Impeccable agents are not exposed by this harness. Review covered the eight captures, code-led direction contract and craft floor; no separate QUALITY BAR card was supplied. Final scoring returned **ship**: the title-label removal and design-document refresh were both resolved, with no observed regressions from those fixes. This verdict covers the scored fixes, not a new whole-surface review. The documenter recorded the built system in DESIGN.md, its generated sidecar, and the surface contract using the shipped degraded documenter instructions.

A separate fresh whole-branch code review found one Important defect: Escape from teams silently left the room. A regression first failed on the lost token, then passed after separating local Escape navigation from explicit Home exit. Escape now retains token, room URL, connection and selection; Resume returns to the same room without creating another. `npm test` (36/36), selection and exit checks passed after the fix. Reviewer reported no Critical issues, deferred minors or declined judgments. No repeat review was used to certify the fix.

## Assets and limits

Pinned SpriteCollab source: `6e4cbc000566b1628daff88c317e15c907acf98f`. Original pixels and per-sheet author/license records retained in `public/assets/CREDITS.md` and species source files. Importer uses Python 3/Pillow only for asset development; runtime uses committed files.

Source Pokémon poses are sequenced as basketball actions, not newly drawn sport animations. The 21 profiles are initial tuning, not verified competitive balance. Audible output, other browser engines, subjective game feel, internet play and Docker execution remain unverified. Full-room recovery copy is now explicit; historical font-license trailing whitespace remains untouched. Historical first-playable screenshots/record were preserved.

## Implementation decisions

- New roster, ability, prediction and seeded-match checks share `roster.test.js`; tradeoff: this file also contains integration coverage.
- Added per-frame alpha bounds to sprite metadata so large/floating portraits fit; tradeoff: regenerated manifest, with source pixels unchanged.
- Extended menu updates with `ready`/`busy` loading flags; tradeoff: a small interface extension, with the app retaining session ownership.


# Gameplay upgrade verification

Session: 2026-10-14. Branch: `feat/gameplay-feel`, based on `631aa86`; implementation started after plan commit `9697b10`. Native execution of the [approved plan](../../superpowers/plans/2026-10-13-gameplay-feel.md), following the [gameplay spec](../../superpowers/specs/2026-10-13-gameplay-feel-design.md). Local Node 24 server and headless Microsoft Edge 155.0.4283.45. Earlier selection evidence above remains historical.

## Shipped behavior

- J passes, steals, or requests a normal pass from an AI teammate holding the ball. Shift + J is a turbo pass with possession (10 turbo), or a shove without possession (25 turbo, hit or miss). Modifier state is captured at the action's initial keydown.
- Passes lead/steer toward the receiver within a fixed turn rate. Swept contact chooses the first reachable interceptor or receiver. Ball-flight IDs prevent interpolation from blending separate throws. Receiver marks, visible ball anchors and turbo trails clarify the play.
- Shoves trade power for 300 ms slow recovery and 900 ms cooldown. Victims stagger for 400 ms, then retain another 300 ms shove protection. Hits spill a loose ball and apply bounded knockback; possession is not granted to the shover.
- K takes off immediately for an eligible standing, running, or turbo dunk. Standing/running cost zero. Running requires 150 ms of actual movement toward the hoop; turbo adds reach/height for 20 turbo. Player and ball follow one committed trajectory. Low takeoffs can be shoved; well-timed airborne blocks interrupt dunks, including buzzer attempts.
- A made dunk can posterize one close eligible defender: 150 ms fall, 300 ms down, 250 ms rise, with short displacement. A successful block prevents posterization. Final scores freeze immediately on the server while a render-only copy completes the fall before results appear.
- Bots use the same controls and costs. AI calls respect signature → J → K priority, expire, and clear on possession/phase/control changes. Phase/focus/control transitions clear inputs. Dropped switch requests recover via acknowledgment or a fresh control epoch; OS key repeats cannot create new action edges after reset.

## Final executed checks

| Command | Observed result |
| --- | --- |
| `npm test` | 70/70 passed after review fixes: assets, simulation, controls, room permissions/epochs, real server, forced motion and interpolation |
| `node test/gameplay.mjs` | 18 real-key scenarios and seven action atlases; zero unexpected browser/protocol errors, one intentionally injected backlog rejection recovered; delayed rematch, held-K repeat and lost/rejected Space regressions included |
| `npm run test:browser` | Complete Sacramento/Toronto match, final 42–55, then rematch; four-human room, blur/switch/reconnect, missing-art fallback, small viewport; all new action/resource state reset; zero browser exceptions and protocol errors |
| `npm run test:latency` | Nine guaranteed action scenarios followed by four humans through Boston/Golden State, final 48–35; all 4,446 common full-state ticks agreed; zero protocol errors |
| `node test/recovery.mjs` | Two browsers at 150 ms RTT, late join, movement acknowledgment, duplicate-token replacement, real server restart; zero browser exceptions |
| `node test/exit.mjs` | Reload recovery, Home exits lobby/live, new room remains new |

Aggregate delayed action coverage: 62 normal passes, 8 turbo passes, 56 shoves, 3 standing dunks, 1 running dunk, 2 turbo dunks, 3 blocks, 1 posterization, 1 AI call. These include the scripted coverage scenarios; they are acceptance evidence, not balance statistics.

Gameplay results: [scenario record](gameplay-results.json). Delayed-client results, per-scenario common ticks and action counts: [latency record](gameplay-latency-results.json). The delayed comparison hashes the complete serialized authoritative match before client bot decisions; only player bot decision memory is excluded. Snapshot slot/ack metadata is client-specific and is not part of the compared match.

## Review and regressions

One fresh, read-only whole-branch reviewer independently passed the then-current 65 tests and found three Important issues and one labeled Minor. The executor regraded the AI call priority issue as Important because it could make a receiver jump during a pass request. All four were reproduced and fixed in one pass:

1. Space could pause inputs forever when its packet expired or was rejected. Stale accepted sequences now acknowledge discard; an unacknowledged switch resyncs after one second, and backlog rejection resyncs immediately. Both recovery paths obtain a fresh epoch before resuming. Room and real-browser dropped/rejected-switch regressions failed first, then passed.
2. Holding K through a dunk/restart allowed an OS repeat to create another SHOOT edge. A real Edge repeat event reproduced the extra block. Recognized repeated keydowns now stay neutral after reset until a fresh press; the browser regression passed.
3. Loose-ball pickup cleared a paid dash. Windup and moving-dash pickup tests failed, then passed after possession acquisition reset shot arming without deleting active power.
4. An AI pass call left simultaneous K active and routed before a successful L dash. J+K and L+J+K room regressions failed, then passed with the intended priority.

The first full-browser run also displayed INPUT_BACKLOG, which its old exception-only check missed. Browser verification now collects server error packets. Identical queued held-only inputs collapse, while every press/release edge remains ordered; a delayed-burst regression failed before this change and passed afterward. The stricter gate then exposed old-epoch inputs during rematch. A browser regression with 75 ms delayed server replies reproduced six STALE_CONTROL packets; stopping gameplay input after the finished snapshot made it pass. The final whole suite has 70 tests. No second review was used as proof of the fixes; fresh regression and suite runs provide that evidence. All reviewer findings are resolved. Final capture inspection found one cosmetic minor deferred: the finished clock can display `0:01` when a tiny positive remainder is rounded up, while the result and score are already final.

## Visual evidence and limits

`gameplay-journey-*.png` covers home/lobby/match/results, small viewport and art fallback; `gameplay-delayed-coop.png` covers delayed co-op. Action captures cover normal/turbo passing, interception, pass call, shove hit/miss, all dunk tiers, block interruption, poster fall/down/rise, reduced motion, and final-score playback. Seven `gameplay-atlas-*.png` sheets were generated and visually inspected: all 21 species, both directions, and shove/fall/down/rise/three dunk poses. Render checks assert input state is not mutated. Source pixels/credits are unchanged; existing poses are rotated and sequenced.

The gameplay browser suite intentionally injects a lost switch and INPUT_BACKLOG to verify recovery; its JSON separately counts expected rejection packets and unexpected errors. The existing favicon 404 is excluded from console-runtime errors. Full browser/latency match gates require zero protocol errors.

Court dimensions remain 100×56. High airborne bodies clear ground players; forced movement stops at ground bodies and bounds. General movement still rejects a blocked step instead of sliding. Visible crowding, especially with larger Pokémon, and sticky ground contact remain follow-up candidates. Subjective fun/balance, audible output, other browser engines, internet deployment and Docker execution remain unverified.

## Execution rulings

- Used the existing clean feature checkout, preserving the user's selected workspace. Cost if wrong: no separate filesystem isolation from concurrent edits.
- Kept general ground sliding and taller framing outside this approved scope. Cost if wrong: sticky contact and crowding need a follow-up.
- Kept subjective feel/balance, audible output and internet deployment unverified. Automated local checks cannot establish them; tuning or environment issues may remain.
