# PokéJam handoff

## Current direction

- User is focusing on **local development and new gameplay features**. Hosting is deferred; keep the existing local HTTP/WebSocket server and avoid deployment work unless requested.
- This is an NBA Jam-inspired browser game starring Pokémon: actual 2-on-2, humans or AI in all four slots, private rooms, keyboard controls, signature moves earned through basketball.
- Seven teams, three Pokémon per roster, two starters: Chicago Tauros, Miami Heatmors, Boston Celebis, Golden State Wartortles, Toronto Tyrantrums, Minnesota Lycanrocs, Sacramento Kingdras. Default Chicago/Miami remains. Preserve the approved arcade home → teams → players/ratings → matchup → game flow and pixel-art direction.
- User prefers very concise communication (Caveman full) and the simplest correct implementation (Ponytail full). Avoid unnecessary dependencies and repeated confirmations for already-authorized work.

## Pick up a new task

- Start from this repository root; inspect current branch, working changes, and recent commits before editing. The first playable was merged and pushed to `main` at `06031e8`. Do not assume that commit is still current.
- `.worktrees/playable` is the original build worktree, not the primary checkout. Ignored scratch there is historical; do not restart its completed plan. Leave adjacent repositories untouched.
- Read `README.md` for running the game and the module map. Read the relevant sections of these documents as needed:
  - `PRODUCT.md`: product commitments and current scope.
  - `DESIGN.md`: visual direction.
  - `docs/superpowers/specs/2026-10-12-pokejam-design.md`: detailed baseline rules and protocol behavior.
  - `docs/verification/first-playable.md`: actual evidence, review fixes, limitations, and known minor issues.
  - `docs/superpowers/specs/2026-10-12-arcade-selection-design.md`: approved selection and roster behavior.
  - `docs/verification/arcade-selection/verification.md`: current roster/menu acceptance and remaining limits; first-playable evidence is historical.
  - `public/assets/CREDITS.md`: sprite provenance and terms.
- `docs/superpowers/plans/2026-10-12-pokejam.md` is the **completed initial-build plan**, retained as history. Its original unchecked boxes and planning-stage handoff are not an active task list. New features get their own scoped work.
- Keep behavior-changing decisions and material limitations in the relevant repo docs so future chats do not depend on this conversation.

## Run and check

- Node.js 24+, JavaScript ES modules, native Canvas/WebSocket/Web Audio. `ws` is the only production dependency; Playwright is development-only.
- `npm ci` if dependencies are missing; `npm start` serves `http://127.0.0.1:3000`. No frontend build step.
- `npm test` runs fast asset, simulation, room, and real-server checks. Arcade-selection baseline on 2026-10-12: 36 passing; rerun appropriate checks for changes instead of treating that number as current proof.
- `npm run test:browser` runs the full headless Edge journey and match/rematch; `npm run test:latency` runs four delayed clients through a full match. Both take several minutes. Browser tests can overwrite tracked verification screenshots; inspect those diffs.
- Focused scripts: `node test/selection.mjs`, `node test/recovery.mjs`, `node test/exit.mjs`, `node test/animations.mjs`. New captures go under `docs/verification/arcade-selection/`. Headless Playwright testing was explicitly approved. Follow current tool permissions.

## Boundaries worth preserving

- `public/game/`: shared simulation, roster, tuning, and bots. Bots emit normal inputs; only decision memory may be mutated by the decision function.
- `server/`: one authoritative process owns matches at 60 Hz and sends 20 Hz snapshots. All room state is in memory. Browser inputs cannot choose scores, possession, or positions.
- `public/connection.js`: movement prediction/reconciliation, interpolation, reconnect. `public/app.js`: controls/session lifecycle. `public/menu.js`: screen navigation, keyboard menus, franchise/starter selection. `public/render.js`: Canvas and audio.
- Species key and ability belong to profiles; slot id and team side remain 0–3 and 0–1. Resolve identities through match.teamKeys, never slot-based signatures. Preserve server captain/reservation protections and selection locks; rematch retains only selection.
- Preserve short input edges, control epochs, token rotation, neutral-on-blur behavior, once-only scoring, and blockable buzzer shots.
- Sprite sheet row 2 faces right; row 6 faces left. Preserve frame metadata and front-facing ball anchors. Keep source credits when changing assets.
- Known limits: internet deployment, Docker execution, other browser engines, audible output, and subjective gameplay feel/balance are unverified. Source Pokémon poses are reused for basketball; the original font license retains trailing whitespace. Full rooms now have explicit recovery copy and Home. See the current verification record before claiming other limits resolved.
