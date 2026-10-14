# PokéJam: passing, shoves, and dunks

Date: 2026-10-13

Status: Conversational design approved. This written spec includes review refinements and proposed starting values; awaiting written-spec review before implementation planning. No gameplay code has changed.

Baseline: `631aa86` on `main`. Local development, native Canvas, and the existing authoritative Node/WebSocket match server.

## Intent and agreed scope

Make possessions more readable, physical, and expressive with NBA Jam-style button combinations. The user wants powerful but costly shoves, clear passing, and enjoyable standing and running dunks. Running improves dunk reach; turbo improves it further. Tap K attempts an eligible dunk immediately.

The approved package is normal and turbo passes, turbo + steal shoves, standing/running/turbo dunks, corresponding bot behavior, and readable presentation. During review, the user also approved calling for a pass from an AI teammate with J and explicitly requested that a defender who gets dunked on (posterized) fall down. Headless Playwright validation is explicitly approved.

Success means a player can reliably pass to a moving teammate, recognize and counter a costly shove, and intentionally launch different dunks. These actions must work with all 21 profiles, humans or AI in any slot, and the existing room and reconnect flow. Timing and balance require hands-on playtesting.

## Controls

| Input | Holding the ball | Without the ball |
| --- | --- | --- |
| WASD / arrows | Move | Move |
| Shift held | Turbo movement | Turbo movement |
| J press | Normal pass | Call for pass if an AI teammate holds the ball; otherwise ordinary steal attempt |
| Shift + J press | Turbo pass | Shove a nearby opponent, including while a teammate has the ball |
| K press near attacking rim | Start eligible dunk immediately | Jump/block |
| K hold/release outside eligible dunk range | Existing timed shot | One jump/block on the press |
| Shift + K | Turbo dunk if eligible; otherwise timed shot | Existing jump/block |
| L | Species signature when eligible | Species signature when eligible |
| Space | Switch to eligible AI teammate | Switch to eligible AI teammate |

There is no separate shove button. Shift + J means turbo + pass/steal. No friendly shoves. A normal J press cannot command a human teammate or change their control assignment.

J has priority over K when both action edges arrive together. Resolve L first: a successful dash or pass signature consumes the action, while a shot/dunk boost may arm before the same tick's J/K action, preserving existing combinations. Existing shots begun outside dunk range remain timed shots on release, even if the player subsequently walks into dunk range. Releasing K after a dunk must not create another shot or block. Holding any action cannot repeat it automatically.

Capture the turbo modifier at the moment J or K is pressed. Releasing Shift before the next network send must not change the chosen action; pressing Shift after J must not retroactively make that J a shove. Preserve this through server queues, focus loss, reconnect, and control switches. The input protocol will add a validated `turboActions` bit mask containing only PASS/SHOOT bits also present in `pressed`. It resets with consumed edges and neutral controls. The server still decides eligibility, costs, and outcomes.

## Passing

Normal J always targets the one teammate. The pass starts toward the teammate's predicted movement, then follows with limited steering and a finite lifetime. A moving receiver should not routinely outrun the aim point as happens with the current fixed endpoint. A sharp reversal can still cause a miss.

Starting values are normal speed 65 court units/second, turbo speed 1.35 times normal, signature pass speed 1.8 times normal, maximum steering 180 degrees/second, and maximum flight lifetime 2.2 seconds. Keep the low visible arc and catch reach of 3 court units. Lifetime expiry creates a loose ball; out-of-bounds follows existing turnover rules. These values belong in shared tuning.

Turbo pass costs 10 turbo at release. With less than 10, Shift + J makes a normal pass. A signature pass spends signature meter under its existing rules and remains faster than a turbo pass, without an additional turbo charge. Both are interceptable.

Test the entire ball movement segment for catches, so fast passes cannot tunnel through defenders. If multiple eligible players intersect that segment, the earliest contact along the segment wins; distance then slot ID resolves an exact tie. A stunned player or a player above the low catch height cannot catch. A pass never grants possession merely because its target was selected.

On launch, briefly mark the receiver with a small ball/arrow cue and a distinct ring treatment. Keep the traveling ball readable above overlapping sprites, with a short trail for fast passes. The cue expires on catch, interception, or loss. Existing assist and shot-clock rules apply: a teammate pass does not reset the clock or earn meter by itself.

### Calling for a pass

When the human's teammate is AI-controlled and currently holds the ball, a normal J press requests a pass back. The caller must be in live play, unstunned, and outside committed actions or shove recovery. It works for vacant slots and disconnected slots currently covered by AI, without altering reservations or control ownership. Shift + J remains a shove.

The server routes the request only to that teammate's bot decision memory. The next eligible bot decision prioritizes a normal pass through its ordinary input path. A request lasts at most 300 ms, is consumed once, and expires if possession, phase, or human control changes. A stunned or committed bot cannot bypass its action rules. Human-controlled teammates receive no injected actions. Holding J produces one request, and repeated requests replace the pending request rather than queueing passes.

## Shoves

An eligible off-ball Shift + J press spends 25 turbo, hit or miss. With less than 25, do not shove or silently substitute a steal: give brief local feedback, "Need 25 turbo to shove." When already on cooldown or stunned, ignore the press without charging again.

The shove has reach 4.5 court units and targets the nearest eligible opponent within a 120-degree cone. Use movement direction when moving, otherwise facing; the visual animation must point toward the resolved attempt. Opponents without the ball can also be shoved to open a lane for a teammate. Teammates are never targets.

On a hit, push the victim up to 5 court units away over 150 ms, stop at court bounds or blocking ground bodies, and stagger them for 400 ms. They cannot move voluntarily, act, or catch while staggered. If holding the ball, spill it as a loose ball, cancel their charge/pending power, and clear the assist chain. A shove does not transfer possession directly or award steal meter. Whoever subsequently collects the loose ball determines possession normally; its last touch is the shover's team.

The attacker has 900 ms between shove attempts and 300 ms of recovery after every attempt: movement at 40% normal speed and no other basketball action during that recovery. The shared defensive cooldown also prevents alternating a shove immediately into a steal or block. A missed shove therefore spends energy and leaves an opening.

Victims are immune to new shoves until 300 ms after their stagger ends. A shove aimed only at protected opponents is a miss: spend the one attempt cost, without restarting stun or extending knockback. This prevents two defenders from pinning one player indefinitely. Protection does not grant immunity to passes, steals after recovery, or blocks.

A shove can hit only an opponent at height 3 or lower. A dunk can therefore be interrupted at takeoff, while a high airborne dunk must be challenged with a block. Interrupting a dunk clears its flight and scoring attempt together, drops the ball once, and produces an ordinary loose-ball play. Collect eligible shove attempts before applying their contact effects so two simultaneous shoves can trade rather than one being suppressed solely by iteration order. Resolve those contacts before starting offensive actions, rechecking possession and stun: a connecting shove defeats a same-tick dunk start. Register defensive blocks before advancing any ball flight.

## Dunks

### Eligibility and cost

Use the profile's existing dunk reach as the running-dunk base. Initial tiers:

| Tier | Eligibility | Maximum launch distance | Turbo cost |
| --- | --- | --- | --- |
| Standing | Grounded, holding ball, no qualifying run-up | 0.55 times profile dunk reach | 0 |
| Running | Grounded, holding ball, qualifying run-up | Profile dunk reach | 0 |
| Turbo | Either eligible stance, turbo modifier pressed with K, sufficient meter | 1.25 times that stance's reach | 20 |

Basic dunks working at zero turbo is a proposed refinement: turbo buys extra reach and spectacle. If turbo is below 20, evaluate the appropriate ordinary tier. If no tier is eligible, K begins the existing timed shot. A small contextual "DUNK" cue can show when the controlled player is eligible; low energy must never grant the turbo reach or height.

A qualifying run-up requires 150 ms of actual movement toward the attacking basket, at least 60% of the profile's normal speed, with direction within 60 degrees of the basket. Running against a body or moving away does not count. Stopping, being stunned, or beginning a committed action clears the run-up. This is a short movement history, not a new acceleration or stamina system.

Sky signatures multiply the selected tier's reach by the existing 1.6 factor and retain their existing expiry/consumption rules. Other signatures retain their documented basketball effects. Costs are checked and deducted once at action acceptance; a failed eligibility check cannot spend a dunk cost.

### Takeoff, travel, and finish

K press starts the dunk, without waiting for release or using the shot meter. Record tier, takeoff, target, and duration once. Standing dunks have a compact jump; running dunks visibly carry the Pokémon toward the rim; turbo dunks have a higher, more exaggerated arc. Start with 500 ms standing, 650 ms running, and 750 ms turbo attempts, with player peak heights of 11, 14, and 18 court units respectively. Height and reach improve the attack but never bypass the block check.

The current implementation lets the ball fly toward the rim while the dunker can remain near takeoff or walk elsewhere. Replace that with one committed player-and-ball trajectory: the Pokémon travels to the rim, visibly carries the ball, and finishes it at the hoop. Voluntary movement, passing, signatures, extra jumps, and new shots are unavailable during that commitment. Preserve meaningful world-space ball position for blocking and front-facing sprite ball anchors for rendering.

Once above the low shove height, airborne motion can pass over ground bodies. It remains subject to the blockable ball trajectory. A block immediately ends the scoring attempt, detaches the ball as a rebound, and lets the player finish a short landing without recapturing or scoring the same ball. A successful attempt scores exactly two points once at the finish, followed by the normal restart. The character's landing/settling animation continues during dead ball so they do not freeze at rim height.

At the buzzer, an already-started dunk can finish and remains blockable. No new dunk can start. Settle active landings during dead ball, then clear flight, run-up, recovery, knockback, protection, and charged actions on the baseline restart or overtime toss. A finished match accepts no actions; a rematch recreates all action state from defaults. Existing phase/control input resets also clear the combo modifier.

### Posterization

A successful dunk over a defender knocks that defender down. Apply this to all dunk tiers when the defender is directly under or contesting the finish; an uncontested dunk does not knock over bystanders. Determine the result on the server only after the last block check and once-only scoring decision. A blocked or interrupted dunk never posterizes anyone.

Initial contact rule: at the scoring instant, consider opponents within 3.5 court units of the dunker's ground position and within 6 units of the attacking hoop. An upright grounded defender or a defender in a block jump is eligible; an already stunned or downed opponent is not. Choose the closest eligible defender, with slot ID breaking an exact tie. Record the victim on the score event, and apply the fall once. One dunk can posterize one defender; a successful block takes priority even when the would-be victim meets these proximity rules.

Use a visible fall, brief downed pose, then get-up sequence: initially 150 ms falling, 300 ms down, and 250 ms rising. Add up to 2 court units of bounded displacement away from the dunker, using the dunk's approach direction when positions coincide. Cancel the victim's jump or pending action and use the shared recovery/knockback rules. The fall must read as a knockdown rather than the existing upright Hurt/stagger pose. Reuse suitable credited frames where available; otherwise compose the fall from existing frames with rotation/offset and inspect every profile for a readable result.

Show "POSTERIZED!" with the made basket. The 700 ms sequence plays during the existing 1.25-second dead ball and finishes before the next possession. All players reset normally on restart. A game-ending dunk still finishes the match immediately, while cosmetic fall playback completes before the results panel covers the court. This does not delay the authoritative result or permit more inputs. Reduced motion retains the fall and get-up information while suppressing decorative shake and flashes.

## Architecture, bots, and presentation

Keep simulation rules, tuning, and bot decisions in `public/game/`. The server gathers validated human inputs, routes eligible AI pass requests, generates bot inputs, and steps the same authoritative simulation. It continues to own all resources, contact outcomes, possession, and scores. Do not introduce dependencies or client-selected outcomes.

New match state is limited to the action state needed for committed dunk travel, recovery/knockback/protection, posterized knockdown playback, and run-up. Existing ball flight and event structures carry pass target/tier and dunk identity, and the score event records the posterized defender when present. Use a unique action/flight identity so interpolation does not blend two consecutive flights with coincidentally equal start coordinates.

`public/app.js` latches combo modifiers and clears them with existing input resets. `server/rooms.js` validates the added mask and handles AI request routing. `public/connection.js` must respect committed actions and knockback during movement reconciliation; pending movement must not pull a dunker away from its authoritative path. Only movement is predicted. Shoves, catches, and scores wait for authoritative state, so latency may still be noticeable.

Bots use the same button combinations, costs, run-up, catches, and recovery. They spend turbo selectively, attempt a shove only with reachable targets, and can be punished for misses. Off-ball teammates seek a passing lane and receive an incoming pass instead of blindly chasing its old location. Bot decision functions may update decision memory only.

Keep existing pixel-art direction and credited sprite sources. Reuse compatible attack/stagger/jump frames with appropriate sequencing. Show the shove attempt even on a miss, victim displacement and recovery, the intended receiver, distinct dunk travel/height, and posterized falls. Sound can reinforce these events, but they must read while muted. Reduced motion removes shake, large flashes, and decorative trails while preserving ball path, jump height, target cues, and action readability.

Update README controls and HTML/canvas descriptions together. Gameplay-facing text describes buttons and outcomes, without protocol details. During implementation, record final rule changes in PRODUCT.md and evidence/limitations in the current verification record.

## Review findings addressed

- Shove needed explicit miss cost, recovery, low-turbo behavior, off-ball targets, and protection against repeated stun.
- Basic, turbo, and signature passes needed different costs/speeds and one collision rule.
- Fast moving catches needed segment collision and contact ordering, not array-first pickup.
- Running dunks needed actual player travel and run-up eligibility, rather than a ball-only arc or one-frame movement tap.
- Dunk contact needed a single cancellation path shared by blocks, low shoves, buzzer handling, and resets.
- Posterization needs successful contested contact, one victim, block priority, a visible fall/get-up, and playback through the scoring stoppage or final whistle.
- Quick combo taps needed modifier state captured on the action edge.
- AI call-for-pass was missing and is now explicitly included by user request.
- Snapshot interpolation and local movement prediction must respect new committed actions.

## Verification and acceptance

Add focused Node checks to the existing suite for the new rules. Tests must exercise observable outcomes rather than reproduce formulas alone:

- All normal/turbo action combinations, short press/release chords, modifier order, action priority, held buttons, stale input, blur, and control epochs.
- Passes to a moving and reversing teammate, first-contact interceptions, high/stunned receivers, flight expiry, low-turbo fallback, and distinct signature speed; assists and clocks remain correct.
- AI call-for-pass with a vacant/disconnected teammate, expiry or possession loss, and prevention of commands to a human slot.
- Shove hit, miss, direction/range, cost, cooldown, recovery, knockback bounds, no friendly hit, loose possession, no shove meter reward, simultaneous attempts, and protection against repeat stun.
- Standing dunk with zero turbo; legitimate run-up versus blocked/one-frame motion; turbo and signature reach; same-frame tap; player/ball travel; low and high shove windows; block interruption; once-only scoring; buzzer and rematch cleanup.
- Posterization for each dunk tier; no fall on blocked/interrupted/uncontested dunks or for teammates, bystanders, or already downed players; deterministic victim selection; one fall per basket; completed fall/get-up before restart and visible final-whistle playback.
- Representative seeded games covering all species, legal bot inputs/state mutation, and complete match outcomes.

Use headless Playwright through the real local server to press actual keys, observe snapshots, and inspect captured action frames. A deterministic development/test scenario may arrange court positions through the existing test harness or shared simulation; production sockets must not accept a debug state-setting command. Validate normal and turbo passes, AI call-for-pass, shove hit/miss/recovery, three dunk tiers, blocked dunks, posterized fall/down/get-up frames including a game-ending dunk, muted/reduced-motion presentation, and zero browser errors. Put new captures under `docs/verification/arcade-selection/` with distinct gameplay-prefixed filenames.

Run the full browser match/rematch journey and four-client latency suite for the final behavior change. Extend delayed-client comparison beyond possession and scores to the authoritative action/ball state relevant to this upgrade, and ensure these new actions actually occur during the run. Inspect changed tracked screenshots. Report measured results and visible corrections; automated evidence cannot certify subjective fun, audible output, competitive balance, or internet play.

## Scope and references

On-fire streaks, alley-oops, pump fakes, airborne passing, separate super-block controls, gamepads, and new signature categories are future candidates. This package uses the approved existing controls and local match architecture.

NBA Jam references establish the inspiration, not exact timing or balance for PokéJam:

- [Midway NBA Jam arcade operations manual](https://manualzz.com/doc/9701813/midway-nba-jam-arcade-game-operations-manual): shoot/block, pass/steal, turbo-enhanced actions, and commands to the CPU teammate.
- [NBA Jam Genesis manual transcription](https://manuals.plus/m/78734e385538f0b2075c82181c1b20ad3d1b59a77e03977d428be0f8377f0697): the control tables describe turbo + pass/steal as shove off ball and super-pass with ball. Its prose contains an inconsistent shove-button label; this design uses the table and the user's explicit correction. PokéJam deliberately adds standing dunks.

Next step after written-spec review: write the implementation plan, then choose execution method under the active Superpowers workflow.
