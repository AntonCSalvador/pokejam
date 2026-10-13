# Arcade Opening and Seven-Team Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution is the established project preference. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved arcade opening, seven selectable franchises, and 21 playable Pokémon with meaningful ratings and protected multiplayer lineup choices.

**Architecture:** Retain the four authoritative player slots and distinguish match sides from franchise keys. A shared catalog supplies simulation profiles and menu ratings; the server validates lobby selections before constructing a match. A small menu module manages local screen navigation while existing connection code retains session and gameplay responsibilities.

**Tech Stack:** Node.js 24+, JavaScript ES modules, native HTML/CSS/Canvas/WebSocket/Web Audio, `ws`, Node test runner, installed Playwright with headless Edge. Python 3.14 and Pillow 12.2 are already available for development-only sprite import; neither is a game runtime dependency.

**Spec:** [Approved arcade-selection design](../specs/2026-10-12-arcade-selection-design.md).

## Global Constraints

- Seven franchises, three available Pokémon each, two starters per side.
- Match sides stay 0 and 1; player IDs stay 0–3, preserving teammate pairing and control-slot semantics.
- Keep one authoritative process at 60 Hz and snapshots at 20 Hz.
- No framework, router, database, build pipeline, or new production dependency is required.
- Selection changes are lobby-only and broadcast after validation.
- Signatures dispatch by the selected Pokémon's ability kind, never by its player slot.
- Preserve the original four players' speed, shot windows, and dunk ranges when first introducing the catalog.
- Neutral-on-blur, short input edges, control epochs, token rotation, reservation expiry, and late-join protection remain.
- Runtime missing-art fallbacks remain available, but placeholder rectangles do not satisfy completion.
- This work targets the local playable game. Hosting remains deferred.

## Review Focus

1. Stale selection racing with another client joining: reject edits that would replace the new occupant; test in Task 2.
2. Reconnecting after host/captain handoff: retain species and slots, recompute permissions, reject the replaced token; test in Task 2 and Task 5.
3. Species moved to the opposite side or alternate starter slot: ability, ratings, art, and selected-franchise signage remain correct; test in Tasks 1 and 4.
4. Keyboard focus during incoming lobby updates and text entry: preserve the focused selection; menu keys never send gameplay inputs or consume typing; test in Task 5.
5. Missing sheet or unusually large/floating species: show a readable fallback or complete sprite with visible ball, no clipped portrait; test in Tasks 3–5.

## Starting evidence and file map

Planning starts on clean `main` after spec commit `f0814fb`. `npm test` passed 28/28 on 2026-10-12 during planning. This is baseline evidence, not proof of the future implementation.

All 17 added species returned HTTP 200 for `AnimData.xml` under SpriteCollab revision `6e4cbc000566b1628daff88c317e15c907acf98f`; required families are present, sometimes through `CopyOf`. Downloading and visual inspection remain Task 3.

| Files | Responsibility |
| --- | --- |
| `public/game/data.js`, `public/game/simulation.js` | Catalog, rating conversion, validated match creation, species abilities |
| `server/rooms.js` | Selection messages, permissions, lobby state, frozen match lineups |
| `tools/import_sprites.py` (new), `public/assets/sprites/`, `public/assets/CREDITS.md` | Reproducible credited sprite ingestion and manifest |
| `public/render.js` | Dynamic franchise rendering and species-specific scaling |
| `public/menu.js` (new), `public/index.html`, `public/style.css` | Arcade menu screens and keyboard navigation |
| `public/app.js` | Menu/connection integration and UI lifecycle |
| `test/roster.test.js` (new), existing `test/*.test.js` | Catalog, simulation, rooms, assets, prediction, real sockets |
| `test/selection.mjs` (new), existing browser scripts | Short menu checks plus complete browser/recovery/latency journeys |
| `docs/verification/arcade-selection/` (new) | New screenshots, species atlases, and acceptance record |

Before source edits, use using-git-worktrees to select an isolated feature workspace. Do not reuse or delete `.worktrees/playable`. Read AGENTS.md and the approved spec in that workspace. Run tasks sequentially; Tasks 4–5 consume all earlier interfaces. Preserve native execution, then obtain the required final independent review.

## Task 1: Shared roster and species-driven simulation

**Files:** Modify `public/game/data.js`, `public/game/simulation.js`; create `test/roster.test.js`; extend `test/simulation.test.js` and `test/server.test.js`.

**Interfaces:**
- `TEAMS`: seven objects `{key,name,short,color,dark,roster:[key,key,key],emblem}`; keys are `chicago`, `miami`, `boston`, `golden-state`, `toronto`, `minnesota`, `sacramento`.
- `PLAYERS`: object keyed by species; profiles include `key,name,role,move,ability,description,ratings,speed,window,dunk,stealRecoveryMs`, with `ratings:{speed,shooting,dunk,steal}`. Ability values are `dash`, `pass`, `heat`, `sky`.
- `getTeam(key) -> team | undefined`; `defaultSelection() -> {teamKeys:[key,key],playerKeys:[key,key,key,key]}` returns a fresh Chicago/Miami selection.
- `validateSelection(value) -> boolean`: exact lengths, distinct known franchises, two distinct starters belonging to each corresponding roster.
- `createMatch({seed=7,selection=defaultSelection()}={}) -> match`: rejects invalid selections with `RangeError`; copies `teamKeys`, builds exactly four players, assigns `id` and side `team` independently of catalog identity.
- Keep `ROSTER` as the existing default four materialized profiles during intermediate commits so the old UI remains runnable. Remove that compatibility export in Task 5 only after migrating every consumer.

Ratings use integer values 1–10. Convert once in the catalog: `speed=16+speedRating`, `window=55+10*shootingRating`, `dunk=4+dunkRating`, `stealRecoveryMs=900-50*stealRating`. Original steal cooldown remains 650 ms through rating 5. Names and initial tuning are:

| Species | Speed / Shooting / Dunk / Steal | Ability | Signature |
| --- | --- | --- | --- |
| Tauros | 5 / 4 / 5 / 5 | dash | Raging Bull |
| Machamp | 3 / 5 / 6 / 5 | pass | Bullet Pass |
| Hitmontop | 8 / 3 / 3 / 9 | dash | Spin Cycle |
| Heatmor | 4 / 8 / 3 / 5 | heat | Heat Check |
| Charizard | 6 / 5 / 8 / 5 | sky | Sky Slam |
| Infernape | 9 / 5 / 5 / 6 | dash | Flame Drive |
| Celebi | 7 / 6 / 2 / 8 | pass | Future Assist |
| Gallade | 7 / 7 / 5 / 6 | heat | Sharp Shooter |
| Breloom | 6 / 4 / 5 / 10 | dash | Spore Step |
| Wartortle | 7 / 8 / 2 / 6 | heat | Splash Zone |
| Blastoise | 2 / 10 / 6 / 4 | heat | Hydro Cannon |
| Drednaw | 3 / 3 / 9 / 8 | sky | Jawbreaker |
| Tyrantrum | 3 / 3 / 10 / 4 | sky | Jurassic Jam |
| Sceptile | 10 / 5 / 5 / 7 | dash | Leaf Break |
| Aerodactyl | 8 / 4 / 9 / 6 | sky | Fossil Flight |
| Lycanroc | 10 / 4 / 5 / 8 | dash | Rock Rush |
| Mightyena | 8 / 3 / 4 / 10 | dash | Pack Attack |
| Lucario | 7 / 6 / 6 / 7 | pass | Aura Assist |
| Kingdra | 5 / 10 / 3 / 5 | heat | Royal Flush |
| Nidoking | 4 / 4 / 10 / 6 | sky | Crown Crusher |
| Slowking | 2 / 8 / 4 / 6 | pass | King's Assist |

- [x] Add failing catalog/match tests: `assert.equal(TEAMS.length,7)`, `assert.equal(Object.keys(PLAYERS).length,21)`, `assert.deepEqual(defaultSelection().playerKeys,['tauros','machamp','heatmor','charizard'])`; assert all four original speed/window/dunk triples equal the current values. Reject null/malformed arrays, duplicate teams, duplicate starters, unknown keys, and foreign-roster starters. Check all 42 ordered franchise pairs with valid defaults.
- [x] Run `node --test test/roster.test.js`; confirm failure on missing catalog interfaces or unsupported selection, not syntax errors.
- [x] Implement catalog and helpers in `data.js`, then selection-aware `createMatch` in `simulation.js`. Keep profile data immutable by use: materialize fresh players and fresh rating objects for each match.
- [x] Add failing behavior cases: Tauros in slot 3 still dashes without ball; Machamp in slot 2 still passes; Kingdra in slot 0 needs the ball for its shooting boost. Assert one meter charge per activation, original four signatures unchanged, and steal recovery differs according to catalog values. In `server.test.js`, reconcile a Nidoking snapshot and assert key, ratings, and ability survive without mutating the authoritative snapshot.
- [x] Replace slot-based signature branching with ability dispatch and use `p.stealRecoveryMs` for steals. Bots keep emitting normal inputs; change bot code only if a reproduced species assumption requires it.
- [x] Run `node --test test/roster.test.js test/simulation.test.js test/server.test.js`; all pass. Run seeded complete matches covering every species at least once, asserting finite positions, valid possession, and completion; extend the existing simulation harness rather than introducing a second engine.
- [x] Commit only this task's files: `feat: add selectable species profiles and team matchups`.

## Task 2: Authoritative team and starter choices

**Files:** Modify `server/rooms.js`, `test/rooms.test.js`, `test/server.test.js`.

**Consumes:** Task 1 catalog/selection helpers and `createMatch({seed,selection})`.

**Produces:**
- Room `selection`, initialized with `defaultSelection()`; lobby adds `teamKeys`, `playerKeys`, and `captains` arrays. `captains[side]` is the oldest connected human slot on that side, or the host slot for an all-AI/disconnected side, or null if no one can act. Use the existing session `order`; reconnect retains that order. Derive this on each lobby snapshot; do not persist a competing captain record.
- Client messages `{type:'selectTeam',side,teamKey}` and `{type:'selectPlayer',slot,playerKey}` with exact-field validation. Lobby error codes: `BAD_SELECTION`, `CAPTAIN_ONLY`, `TEAM_LOCKED`, `PLAYER_LOCKED`, plus existing phase/message errors. Error responses include actionable text; send refreshed lobby state to the actor after rejected selection requests.

- [x] Extend existing room harness tests. Assert default lobby keys, successful Sacramento/Toronto selection, wrong-side captain rejection, no duplicate franchise, correct starter reset, own-player edit, captain editing AI, atomic AI-starter swap, and rejection of another human/reserved slot. Failed requests must preserve the complete selection.
- [x] Add race/recovery cases: a guest joins the target slot before the host's stale edit; captain disconnect/reconnect and host handoff; reserved teammate blocks team changes; claiming a different pregame slot recomputes permissions; unchanged selected team is an idempotent no-op. A non-captain human may swap its own species with its AI teammate, but cannot independently replace the AI's bench choice.
- [x] Run `node --test test/rooms.test.js`; confirm the new assertions fail with current room messages.
- [x] Extend strict message schemas; resolve permissions against current room slots on every request. For team change, allow only controller with no other human or reservation on that side; reset both species while retaining session slots. For player change, allow actor's own slot or captain-controlled AI slot. If desired species is in the other AI slot, swap the species atomically; never swap sessions or tokens.
- [x] Pass a cloned validated selection into match creation. Reject edits whenever `room.match` exists, including countdown/finished; rematch clears match while retaining selection. Preserve epoch resets and reservations. After invalid-start/edit races, the match must hold one valid selection.
- [x] Extend real-socket test to choose Sacramento versus Toronto before other clients join; assert four clients receive identical team keys/species, reject numeric-stat injection, freeze selection after start, and retain metadata through snapshots.
- [x] Run `node --test test/rooms.test.js test/server.test.js`; all pass. Commit `feat: authorize multiplayer roster selection`.

## Task 3: Import and inspect all roster sprites

**Files:** Create `tools/import_sprites.py`; add 17 character directories under `public/assets/sprites/`; extend `manifest.json`, `public/assets/CREDITS.md`, `test/assets.test.js`, `test/animations.mjs`.

**Consumes:** Task 1 species keys and the current manifest structure. Uses Python standard libraries for HTTP/XML/JSON and installed Pillow for alpha-bound inspection.

**Produces:** All 21 manifest entries with current `sources`/`animations` structure, plus per-entry `courtScale` and `portraitScale` calibrated to visible bounds. Existing source PNG bytes remain unchanged. Importer supports `python tools/import_sprites.py` (acquire/build) and `python tools/import_sprites.py --check` (local validation only).

Pinned source base: `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/6e4cbc000566b1628daff88c317e15c907acf98f/sprite/`. Added IDs: Hitmontop 0237, Infernape 0392, Celebi 0251, Gallade 0475, Breloom 0286, Wartortle 0008, Blastoise 0009, Drednaw 0834, Tyrantrum 0697, Sceptile 0254, Aerodactyl 0142, Midday Lycanroc 0745, Mightyena 0262, Lucario 0448, Kingdra 0230, Nidoking 0034, Slowking 0199.

- [x] Change asset tests to compare manifest keys against `PLAYERS`. Assert every species/action/direction has credited multi-frame poses, finite anchors, positive timing, valid source dimensions, and a ball anchor in front of the player. Preserve current facing regression; record per-entry direction rows if inspection establishes a genuine different layout, never weaken the assertion globally.
- [x] Run `node --test test/assets.test.js`; expect failure listing missing species.
- [x] Implement importer: fetch pinned XML, `credits.txt`, and only sheets used by selected animations; resolve `CopyOf` with cycle/missing-target checks. Map idle→Idle, run/dribble→Walk, pass/shoot→Shoot or Charge, dunk/block→Hop, stagger→Hurt, signature→Attack. Keep the original four manifests unless a deliberate metadata addition is needed. Use alpha bounds to establish ground pivots and front ball anchors; store explicit per-species adjustments for unusual bodies.
- [x] Preserve upstream credits, author IDs/names, terms per used sheet, original URLs/revision, and descriptions of sequencing/anchor additions. Never infer one sheet's license from another. Keep original source pixels. Missing usable art blocks only that asset task and requires a concrete report, not silent roster substitution.
- [x] Update atlas script to produce one labeled atlas per franchise in `docs/verification/arcade-selection/`, showing all three species, nine actions, both directions, and ball positions. Settle fonts/images before capture; verify failures array is empty. Sample early/middle/late frames of shoot/dunk sequences for wings, tails, and floating species.
- [x] Run importer, `python tools/import_sprites.py --check`, `node --test test/assets.test.js`, and `node test/animations.mjs`. Inspect every franchise atlas, batch fixes, and recheck affected captures. Correct wrong-facing, clipping, transparent-only frames, excessive size, and hidden-ball defects.
- [x] Commit `feat: add credited sprites for the seven-team roster`.

## Task 4: Dynamic match identity and portrait rendering

**Files:** Modify `public/render.js`, `public/app.js`, `public/index.html`; extend `test/selection.mjs` (new), and relevant `test/server.test.js` assertions.

**Consumes:** `match.teamKeys`, Task 1 profiles, Task 3 manifest scale metadata.

**Produces:** Existing `renderMatch(ctx,match,options)` and `drawPortrait(ctx,key,assets,tick=0)` signatures remain. Court signage/paint, rings, scoreboard labels/colors, player HUD, and winner copy resolve franchise by match side. Default preview uses defaultSelection; a lobby preview can use its selected lineup without modifying server state.

- [ ] Add short headless test using `startServer()` and Edge: configure Sacramento against Toronto over the real socket, start, assert selected team labels and four species survive countdown/live snapshots; render portraits of all 21 species. Assert no browser errors and no missing image requests. Use the same test later for new menu controls.
- [ ] Run `node test/selection.mjs`; confirm failure on static Chicago/Miami identity.
- [ ] Replace every hard-coded franchise reference in render/app/HTML with selected identity. Scope rink colors to selected teams; keep ball/hoop geometry and projection unchanged. Use manifest scale values and occupied bounds for portraits; preserve established court scale for the original four unless a visual defect requires adjustment.
- [ ] Run `node test/selection.mjs`; all assertions pass. Record a reversed-side Sacramento/Toronto court capture for the final visual batch. Commit `feat: render selected franchises and player lineups`.

## Task 5: Full arcade screen sequence

**Files:** Create `public/menu.js`; replace menu structure/styles in `public/index.html` and `public/style.css`; integrate in `public/app.js`; extend `test/selection.mjs`; update `test/exit.mjs` and `test/recovery.mjs` selectors/steps where necessary.

**Consumes:** Task 2 lobby/selection messages, Task 3 portraits, Task 4 dynamic match rendering, existing session/connection functions.

**Produces:** `createMenu({onCreate,onJoin,onSend,onHome,onInvite}) -> {show(screen),update({lobby,session,match,assets,reduced})}` in `menu.js`. Screens are `home`, `join`, `help`, `teams`, `players`, `matchup`, `game`, `results`; selection-screen navigation is local. `onSend(message)` forwards existing and Task 2 socket messages. `onCreate()`/`onJoin(roomId)` delegate connection setup to app, never create a parallel session layer.

Stable UI anchors: retain `#create` (now Play), `#join-form`, `#room-link`, `#start`, `#invite`, `#rematch`, `#sound`, `#motion`, `#court`, `#notice`; add `#team-grid`, `#starter-slots`, `#player-grid`, `#ratings`, `#selection-next`, `#selection-back`. Use species/team keys in data attributes and accessible names for browser tests. Do not bind behavior to visual position.

- [ ] Read Impeccable craft-floor immediately before UI editing. Keep the approved NBA Jam arcade direction; do not reopen a visual-world tournament. Write the development-only surface brief/direction contract for `public/index.html` with the title/selection/matchup compositions and user-approved reference as authority. No contract content belongs under `public/`.
- [ ] Expand the short browser test to exercise Home → Play → choose Sacramento/Toronto → pick Nidoking/Slowking → ratings → matchup → countdown → court. Assert displayed bars/numeric labels equal catalog values, signature text describes actual effects, chosen lineup matches snapshots, and Back preserves selection.
- [ ] Add keyboard/error assertions: Enter on Home, arrows/Enter within grids, Escape back, Tab focus visibility, incoming lobby update retains focused choice, typing in invite does not navigate, menu presses emit no input messages, malformed invite stays recoverable, full room has Home, and create errors restore usable Play. Two clients choose their own slots/species without overwriting each other.
- [ ] Run `node test/selection.mjs`; confirm the new menu cases fail before building the screens.
- [ ] Build the title screen with dominant wordmark/Play, animated portraits or muted exhibition backdrop, stadium composition, and secondary Join Friends/How to Play. Build team board, three-player roster panels with two starter slots per side, segmented ratings and signature description, and full matchup review/countdown. Use original emblem marks, existing fonts, native controls, team colors, and no external UI dependency.
- [ ] Implement menu navigation and focus restoration in `menu.js`. Update existing DOM nodes on lobby changes rather than rebuilding focused controls. Disable impossible choices with a visible reason. Use reduced-motion preference to suppress decorative animation. At 390px, menus remain readable and do not overflow; gameplay retains keyboard requirement.
- [ ] Integrate in `app.js`: one room/session lifecycle, server-validated edits, existing clipboard fallback, reconnect notices, session expiry/replacement, host handoff, late-join pending, Home cleanup, results/rematch. First live phase focuses court; countdown stays on matchup. Polling/render loops must not force a user's selection step on each snapshot. Adapt asset loading to show a loading state and enable selection when ready; failed sprites retain names and playable fallback.
- [ ] Remove compatibility `ROSTER` after `rg -n 'ROSTER|CHICAGO|MIAMI|chi-score|mia-score' public test` confirms every behavior consumer has migrated; default roster labels may remain only as catalog/default data. Preserve all previous regression assertions when changing test journeys.
- [ ] Run `node test/selection.mjs`, `node test/exit.mjs`, `node test/recovery.mjs`, and `npm test`; all pass. Capture each menu at 1280×960 and 390×844 into the new verification directory. Inspect together, batch material fixes, confirm once; honor Impeccable's two-pass visual ceiling. Run the mechanical detector once on changed UI files and fix mechanical findings.
- [ ] Commit `feat: add arcade home and pregame selection screens`.

## Task 6: Complete-match acceptance, review, and handoff

**Files:** Update `test/browser.mjs`, `test/latency.mjs`, `README.md`, `PRODUCT.md`, `DESIGN.md`, `AGENTS.md`; create `docs/verification/arcade-selection/verification.md`; update plan checkboxes as work completes.

**Consumes:** Finished Tasks 1–5, all existing test scripts, final rendered screens.

**Produces:** Verified local full flow, executed evidence, current design/product docs, and independently reviewed feature branch. No deployment or automatic merge/push is implied.

- [ ] Update the long browser journey to use the actual new screens and a non-default matchup. Retain original control, blur, reconnect, four-human, reservation, missing-art, full match/results/rematch assertions. After rematch, assert selected franchises/species remain while scores/clocks/meter/actions reset. Save new captures under `docs/verification/arcade-selection/`; preserve historical first-playable evidence.
- [ ] Update delayed-client setup to select non-default franchises before others join; retain 75 ms delay each direction. Compare franchise keys and player species/abilities as well as score, ball holder, and phase at every common authoritative tick. Assert zero protocol errors and a finished match.
- [ ] Run `npm test`, `npm run test:browser`, `npm run test:latency`. Long suites may run concurrently on their independent ephemeral servers; await and inspect both results, keep user updated at least every minute. Use the existing focused checks from Task 5 as evidence without rerunning them unless behavior changed.
- [ ] Update README running/selection instructions and document importer prerequisites separately from runtime. Update PRODUCT, DESIGN, and AGENTS with the seven-team commitment, screen flow, real rating meanings, selection permissions, and current module map. Keep the old plan/verification record explicitly historical. Record test counts, commands, screenshots, source revision, limitations, and any intentional tuning changes in the new verification record.
- [ ] Complete Impeccable's required finish review/documentation handoff for the rendered screens; provide valid desktop/small-screen captures and the surface brief. Obtain one fresh whole-branch code review under native execution using the applicable review skill. Reuse a review only if it actually covers both required scopes; fix reproduced important findings and rerun affected checks.
- [ ] Run `git diff --check`, inspect changed/untracked files, confirm no dependency churn, generated scratch, or unintended old screenshots. Commit remaining accepted work and report actual checks and limits. Use the finishing-branch skill for integration; do not resurrect the original build plan or start hosting work.

## Plan self-review

- Coverage: Tasks 1–2 implement catalog, mechanics, permissions, rematch state, and validation; Task 3 provides every required species/action and attribution; Task 4 removes static match identities; Task 5 implements every screen, navigation/recovery/accessibility state; Task 6 provides complete-match evidence and durable handoff.
- Interfaces: `teamKeys`/`playerKeys` identify franchise/species; `team`/`id` still identify match side/slot. Selection message names, ability kinds, scaling fields, and menu callbacks agree across tasks.
- Review focus: each listed failure mode has an owning task and concrete assertions.
- Limits: numeric profiles are initial tuning, not a balance claim. Source XML availability is not visual asset acceptance. Internet/audible/other-browser acceptance is not claimed.

Plan status: Approved 2026-10-12; native implementation in progress.
