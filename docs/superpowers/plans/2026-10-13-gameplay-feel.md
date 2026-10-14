# Gameplay Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver readable passes and AI pass requests, costly turbo shoves, committed standing/running/turbo dunks, and posterized defender falls.

**Architecture:** Extend the existing shared simulation and input protocol. Keep outcomes authoritative, bots on ordinary inputs, and render effects driven by match state/events. Extract only keyboard state into a small module; keep basketball rule helpers in the existing simulation.

**Tech Stack:** Node.js 24+, JavaScript ES modules, Canvas, WebSocket, Web Audio; existing `ws` and development-only Playwright.

**Spec:** `docs/superpowers/specs/2026-10-13-gameplay-feel-design.md` (approved 2026-10-13).

**Status:** Ready for plan review. Base: `7605cd9` on `feat/gameplay-feel`; no gameplay code changed during planning.

## Global Constraints

- Local development, native Canvas, and the existing authoritative Node/WebSocket match server.
- There is no separate shove button. Shift + J means turbo + pass/steal. No friendly shoves.
- Tap K attempts an eligible dunk immediately. Standing/running dunks cost 0; turbo dunk 20, turbo pass 10, shove 25.
- All 21 profiles, humans or AI in any slot, and the existing room and reconnect flow.
- Do not introduce dependencies or client-selected outcomes. Server remains 60 Hz with 20 Hz snapshots.
- Preserve short input edges, control epochs, token rotation, neutral-on-blur behavior, once-only scoring, and blockable buzzer shots.
- Bot decision functions may update decision memory only. Source sprite pixels and credits remain intact.
- Put new captures under `docs/verification/arcade-selection/` with distinct gameplay-prefixed filenames.
- Court stays 100 by 56 world units for this plan. General collision sliding and taller court framing were recommendations during discussion; the written spec covers ground/air collision and forced movement needed by these actions. Record any remaining sticky contact or crowding found in playtesting for that follow-up.

## Review Focus

1. Two Shift keys held, one released, and repeated keydown events: latch the modifier that was present on the first action edge, never a later modifier. Pin in Task 1.
2. A queued AI request survives reconnect/control handoff: discard it before a human gains control or possession changes. Pin in Task 5.
3. K remains held through possession loss or a completed dunk: later release must not launch an unarmed shot or extra block. Pin in Task 4.
4. The same final snapshot arrives repeatedly: never restart the posterized fall or delay results indefinitely. Pin in Tasks 6–7.
5. A human switches or disconnects during a dunk/shove: action, resource cost, and recovery stay with the Pokémon and finish once. Pin in Tasks 4–5.

## File map and shared decisions

| Files | Responsibility |
| --- | --- |
| Create `public/controls.js`; modify `public/app.js` | Keyboard state and latched action modifiers; existing focus/session guards stay in app |
| Modify `public/game/data.js` | New tuning constants, neutral input field, existing roster tuning |
| Modify `public/game/simulation.js` | Pass steering/contact order, shove resolution, run-up, committed dunk/landing, posterization and resets |
| Modify `public/game/bots.js` | Explicit turbo actions, pass requests, spacing and shot/dunk decisions |
| Modify `server/rooms.js`, `server/index.js` | Validated input field, AI request routing, a programmatic match factory for deterministic tests |
| Modify `public/connection.js` | Flight identity interpolation and forced-action reconciliation |
| Modify `public/render.js`, `public/index.html` | Action playback, readable ball/cues, control copy and accessible description |
| Create `test/controls.test.js`, `test/gameplay.test.js`, `test/gameplay-fixtures.js`, `test/gameplay.mjs` | Focused input/rule regressions and real-key browser scenarios |
| Modify existing room/server/roster/browser/latency tests | Protocol producers, handoffs, complete matches and cross-client agreement |
| Modify README, PRODUCT, AGENTS and current verification record | Shipped rules, new work links, evidence and limitations |

Keep public `createMatch()`, `stepMatch(m, inputs)`, `movePlayer(p, input, dt, players)` and `chooseBotInput(m, id)` signatures working for existing callers. Use these concrete additions:

- Input: `turboActions: number`, allowed bits `A.PASS | A.SHOOT`, a subset of `pressed`; `neutral()` supplies 0.
- Match: `flightId: number` monotonic counter; each new ball flight receives `id: ++m.flightId`.
- Player: `runUpMs`, `recoveryMs`, `shoveProtectionMs` start at 0; `knockback` and `flight` start null; `shotArmed` starts false. Existing `stunMs`, `action`, `actionMs`, `actionStart`, and `ageMs` also drive posterized recovery.
- `knockback`: `{start:{x,y}, end:{x,y}, elapsed, duration}`. `flight`: `{id, kind:'dunk'|'landing', tier, start:{x,y,z}, end:{x,y,z}, elapsed, duration, peakHeight}`. These are committed motion records, not client commands.
- Export `dunkOption(p, input) -> null | {tier, reach, cost, duration, peakHeight}` from simulation for rules, bots and the contextual cue. Read only; eligibility includes grounded/action/resource state and distance to `hoop(p.team)`.
- Bot memory: `passRequest: null | {from, untilTick}`. Score event: optional `posterized: slotId`. No separate posterization scoring event.
- Test fixtures: `live(selection?) -> Match`, `giveBall(m,id) -> void`, `act(id,fields={}) -> Map`, `advance(m,ticks,inputs=new Map()) -> void`. Fixtures put other players far from the isolated action unless a test explicitly positions them.

## Task 1: Preserve keyboard combo intent through the protocol

**Files:** Create `public/controls.js`, `test/controls.test.js`. Modify `public/app.js`, `public/game/data.js`, `public/game/bots.js`, `server/rooms.js`, `test/rooms.test.js`, and explicit input literals in existing tests.

**Interfaces:** `createControls()` returns `{keyDown(code), keyUp(code), read(), consumeEdges(), reset()}`. Key methods return whether the key is handled. `read()` returns the current neutral-shaped input without consuming edges. App supplies sequence and epoch as before.

- [ ] Write tests named `combo remembers modifier before release`, `later Shift does not rewrite action`, and `either Shift keeps turbo active`. Assert `read().turboActions === A.PASS` after Shift-down/J-down/J-up/Shift-up, 0 for J-down/Shift-down, and `read().held & A.TURBO` after releasing only one of two Shift keys. Assert repeated J-down causes no second edge after `consumeEdges()`; `reset()` equals `neutral()`.
- [ ] Add room tests rejecting `turboActions: A.SPECIAL`, negative/fractional masks, and a PASS modifier without a PASS edge (`BAD_MESSAGE`). Queue one valid turbo-marked K chord with both press/release and no held modifier; assert no protocol error and one block start. Task 7 proves the chosen combo's gameplay outcome. Update existing test inputs to carry the required field so failure comes from the intended invalid value.
- [ ] Run `node --test test/controls.test.js test/rooms.test.js`; confirm new behavior fails before implementation.
- [ ] Implement the module and wire it into existing app handlers. Capture modifiers only on the initial J/K keydown; clear all state on blur, stale session and control reset. Keep menu/text-field guards. Extend the exact server input schema and mask validation; clear `turboActions` together with `pressed/released` in room replay and bot cached inputs. Search all input producers with `rg -n 'released:|type:.*input' public server test`.
- [ ] Run `npm test`; new and existing tests pass. Commit `feat: preserve turbo action chords`.

## Task 2: Make moving passes readable and interceptable

**Files:** Create `test/gameplay-fixtures.js`, `test/gameplay.test.js`. Modify `public/game/data.js`, `public/game/simulation.js`, `public/connection.js`, `test/server.test.js`.

**Interfaces:** Ball pass flight adds `{id, target, speed, heading, tier:'normal'|'turbo'|'signature', elapsed, duration}` while preserving fields used by possession/assists. Implement private `pass(m,p,tier='normal')`; signature calls select the signature tier explicitly. Fixtures use the shared interfaces above.

- [ ] Write `pass catches moving teammate` and `pass uses first segment contact` tests with a moving receiver, then defender 3 intersecting the swept segment before defender 2. Core assertions for the respective fixtures: `assert.equal(m.ball.holder, 1)` and `assert.equal(m.ball.holder, 3)`. Keep the players array in its required slot order. Verify stunned/high players do not catch, expired passes become loose, ordinary teammate passes preserve the clock, and passes alone earn no meter.
- [ ] Assert pass speed values are 65, `65 * 1.35`, and `65 * 1.8`; turbo costs exactly 10 at acceptance, 9 turbo falls back to a normal pass, and signature spends only its signature meter. Account separately for the existing per-tick turbo drain/fill. Add two consecutive same-origin flight snapshots with different IDs and assert `sampleRemote()` does not blend them.
- [ ] Run `node --test --test-name-pattern='pass|flight' test/gameplay.test.js test/server.test.js`; confirm intended failures.
- [ ] Implement bounded steering at `Math.PI` radians/second, finite 2200 ms lifetime, low arc, catch radius 3 and swept first-contact ordering. Exclude the passer, stunned players, and players at height 3 or above. Check out-of-bounds during flight. Preserve assist ownership and reset rules. Assign flight IDs to shots/dunks too and make interpolation compare IDs.
- [ ] Run `node --test test/gameplay.test.js test/simulation.test.js test/server.test.js`; pass. Commit `feat: improve targeted and turbo passes`.

## Task 3: Add costly shoves and bounded knockback

**Files:** Modify `public/game/data.js`, `public/game/simulation.js`, `test/gameplay.test.js`, `test/server.test.js`.

**Interfaces:** Add the player recovery/knockback fields listed above. Private `advancePlayerState(p,dt,players)` advances timers/forced motion; private `collectShoves(m,inputs)` resolves eligible attempts from one pre-contact view. Existing `movePlayer()` respects stun, recovery and forced motion. Scoring interruption of an already-started dunk is added in Task 4.

- [ ] Write `shove miss spends resource and recovery` and `shove hit spills loose ball` tests. Start the carrier 4 units ahead of the shover to stay outside immediate pickup reach. Core assertions: `assert.equal(p.cooldownMs, 900)`, `assert.equal(p.recoveryMs, 300)`, `assert.equal(victim.stunMs, 400)`, `assert.equal(m.ball.mode, 'loose')`. Verify cost 25, displacement capped at 5 units over 150 ms, no direct possession transfer, and no shove meter reward. Verify `turbo:24` yields `Need 25 turbo to shove` without a steal; exact 25 is accepted before continuous drain.
- [ ] Test reach 4.5 and cone 120 degrees with moving direction and stationary facing, teammate immunity, height above 3 immunity, boundary/body-limited knockback, off-ball targets, missed attempts and held buttons. Assert two eligible simultaneous shoves trade; new shoves cannot extend a victim's stun during the 300 ms protection after recovery. Assert recovery movement is `0.4 * p.speed` and ignores turbo speed multiplication.
- [ ] Run `node --test --test-name-pattern='shove|knockback' test/gameplay.test.js`; confirm intended failures.
- [ ] Add tuning and contact processing before offensive actions, with J/K priority and signature rules from the spec. Snapshot shove eligibility before applying effects. Set last touch to the shover's team on a spill, clear charge/power/assist state, and prevent a repeat hit from prolonging stun. Share bounded forced motion with later landings; keep meaningful body blocking and exclude high airborne bodies from ground obstruction.
- [ ] Run `node --test test/gameplay.test.js test/simulation.test.js test/server.test.js`; pass. Commit `feat: add turbo shoves with recovery`.

## Task 4: Commit standing, running and turbo dunk trajectories

**Files:** Modify `public/game/data.js`, `public/game/simulation.js`, `public/game/bots.js`, `public/connection.js`, `public/app.js`, `test/gameplay.test.js`, `test/simulation.test.js`, `test/server.test.js`.

**Interfaces:** Implement `dunkOption()` and player `flight`/`shotArmed` fields. Private `startDunk(m,p,option)` records one flight; `interruptDunk(m,p,cause)` detaches the ball once and starts a 200 ms landing from the current position/height. Dunk and ball share their flight ID until resolution.

- [ ] Write `standing dunk needs no turbo` with `assert.equal(dunkOption(p, input).cost, 0)` and `assert.equal(dunkOption(p, input).reach, p.dunk * .55)`. True 150 ms run-up gives `reach === p.dunk`; turbo gives `reach === stanceReach * 1.25`, cost 20, and sky multiplies reach by 1.6. Assert durations 500/650/750 ms and peak heights 11/14/18. Reject one-frame input, blocked movement, backwards movement, and insufficient-resource turbo reach.
- [ ] Test that K press alone starts one dunk, moves player toward hoop, carries the ball, and rejects mid-flight movement/actions. Assert failed eligibility preserves turbo and begins a normal shot. A shot armed outside range stays a shot after moving closer. Held K through loss/catch or a completed dunk must not arm another shot; an unarmed release produces none.
- [ ] Test low shove interruption, high shove immunity, successful blocks, rebound landing, exactly one two-point score, release before buzzer, no start after buzzer, and complete restart/rematch cleanup. Update old dunk tests whose previous fixtures used the wider automatic standing range, retaining their original block/once-only intent.
- [ ] Run `node --test --test-name-pattern='dunk|buzzer|shot|prediction' test/gameplay.test.js test/simulation.test.js test/server.test.js`; confirm new failures.
- [ ] Track run-up from actual movement toward hoop: at least `.6 * p.speed`, cosine at least `.5`, accumulating to 150 ms and clearing on stop/stun/commitment. Implement the recorded trajectory, finishing player at z=8 with logical ball at z=10 (offset 2), then a 200 ms landing. Continue landing/timers in dead ball; clear state at restart. Process final blocks before scoring. Arm timed shots only from a valid K press while holding the ball. Adapt the existing bot dunk branch to `dunkOption()` and preserve forward movement on its takeoff input so the current seeded suite stays playable before Task 5's tactical updates.
- [ ] Preserve authoritative forced motion in prediction: `reconcileLocal()` does not replay movement into a flight/knockback; app uses the interpolated controlled player during those states and resets smoothing at transitions. Test snapshot immutability and that pending inputs cannot pull a dunker off its path. Run `npm test`; pass. Commit `feat: add committed dunk tiers and counters`.

## Task 5: Teach bots the actions and route AI pass requests

**Files:** Modify `public/game/bots.js`, `server/rooms.js`, `server/index.js`, `test/rooms.test.js`, `test/roster.test.js`, `test/gameplay.test.js`.

**Interfaces:** Keep `chooseBotInput(m,id)`; it consumes `p.bot.passRequest`. Add optional programmatic `matchFactory=createMatch` to `createRooms({now,matchFactory})` and `startServer({port,host,now,matchFactory})`, passing it to the normal match-creation call. Tests can inject a configured real match; this adds no socket field, URL switch or public debug endpoint.

- [ ] Use the injected match factory for `J requests a normal pass from AI holder`: after its next eligible decision, `assert.equal(m.ball.kind, 'pass')`, `assert.equal(m.ball.from, 1)`, and `assert.equal(m.ball.tier, 'normal')`. Assert expiry after 18 ticks, consumption once, replacement rather than queuing, and cancellation on possession/phase changes. A human or pending human becoming active never receives injected actions; a disconnected reservation covered by AI can answer a request.
- [ ] Test Shift + J stays shove when teammate holds ball. Test requests during caller stun/recovery/flight are ignored. Switch or disconnect during an active dunk/shove and assert the Pokémon retains its cost, flight and recovery without another action. Reconnect the AI holder as human before a pending request executes and assert no pass is forced.
- [ ] Add bot tests asserting legal modifier masks, actual run-up before running dunks, reachable-target/cost checks before shoves, turbo pass choice, and receiver movement toward a catchable lane. Compare match before/after each `chooseBotInput()` with only the selected player's `.bot` memory allowed to differ.
- [ ] Run `node --test test/rooms.test.js test/roster.test.js test/gameplay.test.js`; confirm intended new failures.
- [ ] Gather human inputs/control transfers first, derive the current AI slot set, route eligible requests to bot memory, then choose AI inputs before `stepMatch()`. Clear pending requests whenever control/possession/phase invalidates them. Bots use the common `dunkOption()`, explicit action modifiers, existing reaction cadence and resource rules; interrupted actions remain committed regardless of who controls the slot.
- [ ] Run `npm test`, including existing all-species seeded matches. Commit `feat: add AI pass calls and new move decisions`.

## Task 6: Posterize the defender after a made dunk

**Files:** Modify `public/game/data.js`, `public/game/simulation.js`, `test/gameplay.test.js`.

**Interfaces:** Private `posterize(m,dunker) -> slotId | null` is called only by successful dunk scoring after the final block check. Set victim `action:'posterized'`, `actionMs:700`, `stunMs:700` and bounded knockback; attach the returned ID to that one score event.

- [ ] Write `made contested dunk posterizes one defender` for each tier: arrange one upright defender within 3.5 units of dunker's ground finish and 6 of hoop but outside a successful block. Assert `assert.equal(scoreEvent.posterized, defender.id)`, `assert.equal(m.score[0], 2)`, and `assert.equal(defender.action, 'posterized')`. Verify closest-target selection and slot tie-break with two eligible opponents.
- [ ] Assert no posterization for blocked/interrupted/uncontested attempts, teammates, distant defenders, or already stunned/downed opponents. Confirm the victim's prior jump/power/charge is canceled, displacement is at most 2 units, and recovery finishes in 700 ms during the 1250 ms dead ball. Replay reads of the same score event and assert no new scoring or knockdown state.
- [ ] Run `node --test --test-name-pattern='poster' test/gameplay.test.js`; confirm intended failures.
- [ ] Implement score-time eligibility and one victim. Use takeoff-to-rim direction if positions coincide. Use ground knockback for a grounded victim or a 150 ms forced landing from the current height for an airborne blocker; do not teleport an airborne victim to the floor. Advance the fall in live/dead-ball state; keep finished match outcomes frozen for client cosmetic playback in Task 7. Reset action state on restart and rematch.
- [ ] Run `node --test test/gameplay.test.js test/simulation.test.js`; pass. Commit `feat: knock down posterized defenders`.

## Task 7: Show the actions and verify actual keyboard play

**Files:** Create `test/gameplay.mjs`. Modify `public/render.js`, `public/app.js`, `public/index.html`, `README.md`; use injected `startServer({matchFactory})` from Task 5. Inspect existing sprite metadata without requiring new source downloads.

**Interfaces:** Extend `renderMatch(ctx,m,options)` with optional `finishElapsedMs:0` for cosmetic final-event playback. App keys first receipt time by match seed plus final score event ID and clears it on room/session reset or a new match. Define `resultsReady = phase === 'finished' && (noPosterizedFinalScore || finishElapsedMs >= 700)`; repeated snapshots never reset this clock. Rendering works on a copy and never mutates authoritative state.

- [ ] Build deterministic scenarios for normal/turbo moving passes, interception, AI call, shove hit/miss, each dunk tier, blocked dunk, posterization and game-ending posterization. Drive them through actual app keyboard events and a real WebSocket server; observe snapshots and capture sent input frames. Scope seeded court setup to the injected match factory.
- [ ] Add assertions for fast Shift/J press-release, opposite modifier order, two Shift keys, menu/focus exclusion, neutral-on-blur and no stale actions after switch/reconnect. Confirm observed score/possession/cost/event outcomes instead of relying on screenshots alone. For the game-ending posterization, assert `await page.locator('#match-overlay').isVisible()` is false while the fall is playing and true after the first 700 ms; repeated final snapshots must not reset that deadline. Capture fall, down and get-up frames within their specified windows.
- [ ] Run `node test/gameplay.mjs`; record failures before presentation changes.
- [ ] Render pass target and fast-pass trail, visible shove attempt/impact/recovery, tier-specific committed dunk motion with attached ball, and `POSTERIZED!`. Preview the contextual DUNK cue with `dunkOption()` using a prospective K edge and the currently held Shift state, without spending resources. Compose fall/down/get-up phases at 150/300/250 ms from existing credited frames and transforms; show the fall rather than an upright stagger. Continue final fall from a render-only copy and reveal results after it completes. Use the same layout/colors, proper ball anchors, and a text/shape cue in reduced-motion mode.
- [ ] Update all control descriptions, README and canvas accessible text together, including low-turbo rules and AI call-for-pass. Keep indicators legible while muted. Capture both directions and all 21 profiles in new gameplay action atlases, including fall/down/get-up, and inspect them with image tools. Capture the real game sequences and reduced-motion variant; inspect ball visibility, sprite overlap and defender recovery.
- [ ] Run `node test/gameplay.mjs` and `npm test`; pass with zero browser errors and visually verified captures. Commit `feat: present readable arcade moves and posterization`.

## Task 8: Verify complete matches and record the shipped result

**Files:** Modify `test/latency.mjs`, `test/browser.mjs` as needed for protocol/new expectations; update `PRODUCT.md`, `AGENTS.md`, `docs/verification/arcade-selection/verification.md`; update this plan's checkboxes and the spec's implementation status.

**Interfaces:** Delayed-client comparison at each common authoritative tick serializes team/player identity, score/phase/clocks, complete ball state, player position/resources/action/flight/knockback/recovery, and relevant event IDs/payloads. Compare before local bot calls mutate snapshot decision memory; exclude `.bot` and client-specific sequence/slot metadata.

- [ ] Extend the delayed-client script to count observed normal/turbo passes, shoves, dunk tiers, block interruption and posterization. Add short scripted scenarios through the programmatic test factory with 75 ms delay each direction to guarantee coverage, followed by the existing full match. Cover AI pass request with three humans and one AI in a separate short scenario, then keep all four clients human-controlled for the main comparison.
- [ ] Verify the scripts clear `turboActions` when replacing a bot input's `pressed` field; invalid stale modifier bits must not enter the protocol. Check rematch resets all new state and preserves selections. Record new action counts alongside common-tick count and final result.
- [ ] Run `npm test`, `node test/gameplay.mjs`, `npm run test:browser`, and `npm run test:latency`. Expected: all assertions pass, all required action counts nonzero, four-client states agree, matches finish/rematch, and zero browser/protocol errors. Run recovery/exit focused scripts only if session/focus changes exposed a concrete remaining risk. Inspect tracked screenshot diffs; retain relevant new evidence without replacing historical captures unnecessarily.
- [ ] Perform the chosen execution workflow's required final code review, resolve findings, and rerun only affected checks. Record what ran, results, and actual remaining limits; subjective fun/balance, audible output and internet play still require their own evidence.
- [ ] Update docs with shipped controls, costs, collision limitations, posterization behavior and captures. Add links to this spec/plan in AGENTS so the old initial-build plan remains historical. Run `git diff --check`, inspect changed files, and commit `docs: record gameplay upgrade verification`.

## Coverage and handoff

Controls/protocol map to Task 1; passes and flight identity to Task 2; shoves/forced ground motion to Task 3; dunk tiers/run-up/air collision/prediction to Task 4; bots/pass calls/ownership to Task 5; posterization rules to Task 6; visual feedback/accessibility/real-key checks to Task 7; complete matches/latency/docs to Task 8. Every Review Focus item has a named owning test above.

Recommended execution: native in this session. These tasks share the same small simulation and depend on each other's input/action state; one implementer can keep those transitions consistent, with a fresh whole-branch review at the end. Plan review and execution-method selection come before implementation.
