# PokéJam: first playable design

Date: 2026-10-12

Status: Written spec approved by the user on 2026-10-12. Implementation planning is authorized; implementation has not started.

## 1. Intent and agreed scope

Build a browser basketball game starring Pokémon, with the arcade feel of NBA Jam: two players per team, an angled pixel-art court, oversized characters, fast movement, and exaggerated dunks. Teams reinterpret NBA identities through Pokémon names, colors, and rosters.

The user explicitly chose real online 2-on-2, with humans or AI occupying the four player slots. Successful basketball plays build a meter that unlocks a Pokémon signature move. Existing sprites are the starting point, with additional basketball animations.

The approved first playable has one court and two teams:

| Team | Roster | Identity |
| --- | --- | --- |
| Chicago Tauros | Tauros, Machamp | Red/black; physical interior play |
| Miami Heatmors | Heatmor, Charizard | Red/orange; shooting and aerial finishes |

Success means friends can open a room link on separate computers, choose sides, and finish a complete, readable, responsive basketball match. One human must also be able to play a complete match with three bots. A local four-tab demonstration alone does not establish that internet play works.

This is an original implementation of the chosen gameplay concept. No NBA Jam binary, version, timing measurements, or source assets have been supplied. Exact reproduction of its internal rules is not a claim or acceptance criterion.

## 2. Defaults introduced by this spec

The following details make the approved concept implementable and remain subject to this review:

- Desktop browsers and keyboard controls for the first version.
- A three-minute match, followed by first-basket-wins overtime if tied.
- Private rooms without accounts, matchmaking, spectators, or chat.
- Each person controls one Pokémon at a time. A solo human on a team may switch to their AI teammate.
- Chicago and Miami occupy fixed opposite sides in the first version; each roster member appears once.
- One small Node process serves the game and runs its matches. Native Canvas renders the court; native browser WebSocket connects to the server. The server uses the `ws` package.
- Art acquisition begins with a per-sheet inspection. No sprite set is claimed to be ready yet.

The project belongs in `C:/Users/anton/Desktop/rea/pokejam`, beside the existing REA checkout. REA is a separate reverse-engineering tool, not the game's application framework.

## 3. Player journey and controls

Home offers Create room and Join room. Creation opens a lobby with a copyable room link and four named character slots. Joining presents that same lobby. Players choose an unoccupied slot; simultaneous claims are resolved by the server, with a visible message to the unsuccessful claimant. Empty slots display AI.

The room creator can start once at least one human occupies a slot. A three-second countdown leads into the match. If the creator leaves, the longest-connected remaining human gets lobby and rematch control.

| Input | With ball | Without ball |
| --- | --- | --- |
| WASD or arrow keys | Move | Move |
| Shift, held | Turbo | Turbo |
| J, press | Pass to teammate | Attempt steal |
| K, hold/release | Charge/release shot; dunk when eligible | Press to jump/block |
| L, press | Signature move when eligible | Signature move when eligible |
| Space, press | Switch if teammate is AI | Switch if teammate is AI |

The controls legend stays available from the lobby and match. Gameplay shortcuts apply only while the game has focus, not inside text fields. Losing focus releases held inputs. An individual online player cannot pause everyone's match.

During a match, late joiners may claim an unreserved AI slot and take control at the next dead ball. The server reserves it immediately so another joiner or teammate switch cannot take it first. They see “Joining at next stoppage” until transfer completes. A full room gives a clear error and a return action. No team changes occur during live play.

The results screen shows the final score and winner. The host can return everyone to the lobby for a rematch. New match state clears scores, clocks, meter, and pending actions.

## 4. Basketball rules

These are starting rules for this game, not measured NBA Jam internals. Timing, speed, range, and animation durations live together as tuning values so playtesting can adjust them without changing the architecture.

### Court, possession, and scoring

Movement uses a flat court coordinate system. The renderer projects it into an angled view; jump height is a separate value. Screen pixels never determine possession or scores. The ball is either held, in flight, or loose, with at most one holder.

The opening possession begins with a center toss. Players can collect the ball when it is within pickup reach and low enough. Fixed simulation order resolves simultaneous claims consistently for every client.

Passes target the teammate's current motion and can be intercepted. Shots have a release phase, an airborne arc, and either a basket or rebound. Dunks also have an airborne phase and a block window; pressing the dunk button does not instantly award points.

Field goals score two points; shots released outside the three-point arc score three. Dunks always score two. The server records the release location once and scores a shot at most once.

A made basket causes a 1.25-second dead ball and gives possession to the conceding team at its baseline. Players stay within court bounds. A loose ball crossing the boundary causes a turnover against the last touching team and a baseline restart for the other team. There are no fouls, free throws, or manual inbound plays in this version.

### Shooting and defense

Holding K charges the shot; releasing near the displayed sweet spot improves accuracy. Distance and nearby defenders tighten the successful release window. The server evaluates the input timing, range, and contest at release. A timed shot within its valid window follows a scoring trajectory, subject to a later block; misses produce a rebound trajectory. Use a seeded match random source only for miss direction and opening-toss variation, so checks are reproducible.

Holding beyond the maximum charge automatically releases a mistimed shot outside the successful release window. In dunk range, pressing and releasing K starts a dunk if the player has sufficient turbo. Otherwise it produces a normal shot. Steals require reach and facing; blocks require the defender to jump into the airborne ball's reachable path. Attempts have recovery time, so holding a key cannot create repeated steals or jumps each tick.

Turbo drains while held and refills while released. Empty turbo returns movement to normal speed. All four Pokémon use the same basic collision and possession rules; modest speed, shooting-window, and dunk-range differences express their roles. These values require playtesting, not additional progression systems.

### Clocks and match end

The match clock counts down during live play. A 24-second shot clock starts on the first pickup and resets on opposing-team possession or any collected rebound; teammate passes do not reset it. At shot-clock expiry, possession turns over unless a shot or dunk is already in flight. Such an attempt may finish, with the shot clock suspended until a rebound is collected or a dead ball occurs. Dead balls and countdowns stop both clocks.

At the final buzzer, a shot or dunk already released may resolve, including a defensive block, but no new offensive action can begin. A miss ends regulation when it hits the ground or is collected; follow-up shots do not count. Then the server ends the match if scores differ. A tie starts overtime with a center toss; the first made basket ends overtime. Movement, scoring, and power activation stop in the finished state.

## 5. Signature moves

Each Pokémon owns a meter from 0 to 100. Starting values: made basket +25, assist +10, successful steal or block +15, defensive rebound +10. An assist is the most recent completed teammate pass within six seconds before a made basket, without an intervening opponent possession. Ordinary passes, misses, failed steals, and offensive rebounds do not award meter.

A signature costs 100 and only consumes meter when its activation conditions are met. Repeated input cannot activate it twice. Meter stays attached to the Pokémon when humans switch characters or AI takes over.

| Pokémon | Signature | Effect and counter |
| --- | --- | --- |
| Tauros | Raging Bull | A brief, announced straight-line dash. Opponents can move aside or steal; the dash cannot teleport through bodies or guarantee possession. |
| Machamp | Bullet Pass | While holding the ball, delivers one faster pass to its teammate. A defender in the lane can still intercept. |
| Heatmor | Heat Check | Activate while holding the ball to widen the next jump shot's release window for up to five seconds. It does not increase point value or bypass blocks. |
| Charizard | Sky Slam | Activate while holding the ball to extend the next dunk's launch range for up to five seconds. The launch is telegraphed and the airborne ball remains blockable. |

Pending Heat Check and Sky Slam effects expire on use, timeout, passing, losing the ball, or choosing a different kind of scoring attempt. Raging Bull may activate with or without the ball during live play. Failed eligibility checks show brief feedback such as “Need ball” or “Meter not full.” Existing flight animations and effects communicate moves; the underlying basketball remains readable.

## 6. AI and ownership

AI emits the same movement and action inputs as a human and obeys the same rules, meters, recovery times, and movement limits. It does not write the score or possession directly.

Basic offense advances toward the basket, passes to a less contested teammate, and shoots when in range. The off-ball bot seeks open space. Defense assigns one opponent to each defender, contests near the hoop, and chases reachable loose balls. A short decision interval and reaction delay keep bots readable. This is one bot difficulty, without learning or behavior-tree infrastructure.

When a team has one human, Space atomically swaps that person's control with their AI teammate. The old character immediately becomes AI-controlled. Both characters keep their own ball state, meter, cooldowns, and stats. When two humans share a team, each controls their own slot; Space cannot take another person's character.

## 7. Online architecture and failure behavior

### Boundaries and data flow

Use small, direct modules with three responsibilities:

1. Shared rules and roster data: court units, actions, simulation step, tuning values, and match transitions. No DOM or socket dependencies.
2. Server: rooms, slot ownership, session tokens, input validation, bots, fixed-step simulation, and snapshots.
3. Browser: semantic HTML lobby/results, keyboard input, Canvas rendering, sprite playback, and connection feedback.

The server is authoritative. Browsers send input sequence numbers and bounded movement/action fields, never player positions, shot success, scores, or meter changes. The server binds messages to the socket's assigned room and slot and rejects malformed, oversized, out-of-order, or excessive input. Serve local static assets through a fixed public root; user-supplied paths cannot read arbitrary files.

Start with a 60 Hz simulation and 20 Hz snapshots. Snapshots carry a server tick, latest accepted input sequence, match phase, clocks, score, four players, and ball state. A few room participants do not justify binary encoding or a database.

The browser predicts only its controlled character's movement using shared movement rules, then reconciles with acknowledged snapshots. Other players and the ball interpolate between snapshots. Scores, possession, steals, and signature outcomes always follow server state. A full rollback or historical hit-rewind system is outside this version; noticeable latency limits must be reported by playtesting.

### Rooms, disconnects, and reconnects

Room links contain unpredictable room identifiers. Each participant receives a separate unpredictable reconnect token stored in that tab's session storage, never included in the invite link or routine logs. The server uses this token to reclaim a reserved slot, not a display name.

Release movement when input goes stale for 250 ms. On socket close, AI takes over immediately; heartbeat timeout detects silent loss within five seconds. Reserve the disconnected human's control assignment for 60 seconds while AI plays. During this reservation, teammates cannot switch into the reserved character and new joiners cannot claim it. A successful reconnect atomically restores the assignment and invalidates any superseded connection. After expiry, the slot becomes available like another AI slot.

Reconnection retries use bounded backoff and show status. An expired token offers an available AI slot; a gone room offers Create room. The same browser tab cannot use a token to obtain two simultaneous controllers.

Empty rooms expire after two minutes. For the first single-process build, cap active rooms at 16 and return a readable busy message at capacity. This is a resource ceiling to revisit after measurement. Server restart loses in-memory rooms; clients say the room ended and offer a new room instead of pretending the match resumed.

## 8. Art, feedback, and accessibility

Render at a fixed low internal resolution, initially 640 × 360, with nearest-neighbor scaling and letterboxing. All four characters and both baskets remain visible. Character shadows establish court position; draw order follows court depth. Use team-colored ground markers plus names and player numbers so color is not the only identifier.

Start asset inspection with [SpriteCollab](https://github.com/PMDCollab/SpriteCollab), which supplies Pokémon overworld sprite resources and animation metadata. It is a candidate catalog, not evidence that the four chosen sheets fit this game. Inspect the exact Tauros, Machamp, Heatmor, and Charizard sheets for directions, scale, frame timing, authors, and applicable usage terms before importing them. Keep original attribution and a source/version/modification record for every imported sheet. The repository contains both official and contributed assets; a repository-wide label alone does not settle an individual sheet's provenance.

The required animation set for each character is idle, run, dribble, pass, shoot, dunk, jump/block, hit/stagger, and signature. Reuse compatible poses, then add missing poses and timing. A hopping static sprite is acceptable only as a labeled development placeholder and cannot satisfy final animation acceptance. Asset limits do not silently change the selected roster.

Draw the basketball separately. Define character-specific attachment points so Tauros handles the ball through head/horn motion and the other characters use appropriate hands or claws. Keep the ball visible through each pass, release, and dunk. Court, hoops, team wordmarks, interface, and effects are made for this project.

Score, clock, selected Pokémon, turbo, and meter remain readable. Sound is short procedural court/impact feedback with a mute control; no announcer recordings are required. Reduced-motion mode removes screen shake and large flashes. Lobby, errors, controls, and results use keyboard-accessible HTML with visible focus. Essential UI information is not available only inside Canvas.

If an image fails to load, show the Pokémon name and a clear fallback shape so the match remains operable, and report the asset error. Development may proceed with placeholders, but finished first-playable acceptance requires the selected sprites and animations.

## 9. Hosting and verification

Serve the browser and WebSocket endpoint from one origin. Local runs must support multiple independent browser sessions. Internet play additionally requires a reachable HTTPS/WSS host that keeps the Node process running and supports WebSocket upgrades; a static-only deployment does not satisfy this design. The provider is an execution choice, not a game feature. Publishing and any paid hosting purchase are separate from drafting or local implementation.

Keep automated checks small and directed at failure-prone behavior. Use Node's built-in test runner for rules and a real server/WebSocket integration check. Add browser automation only if existing tooling makes it practical; manual browser verification still checks presentation and feel.

The first playable passes when:

- One human and three bots can finish regulation, see the correct result, and start a clean rematch.
- Four independent clients can occupy exactly four slots, with no duplicate claims or cross-team switching. Two friends can share a team against bots.
- All clients agree on score, ball ownership, match phase, and final result. A shot can score only once; blocked shots cannot also score.
- Buzzer shots, overtime, shot-clock turnovers, rebounds, passes, steals, and dunks behave according to the rules above.
- Signatures charge from valid plays, cannot be spammed or spent while ineligible, and retain their stated counters.
- A disconnected player becomes AI, rejoins within the reservation period, and resumes their assignment without creating a fifth player. Late input and superseded connections cannot move someone else's Pokémon.
- Malformed input, invalid room links, room capacity, missing sprites, and a server restart produce explicit recoverable states.
- Four-client tests with approximately 150 ms round-trip latency show consistent outcomes. Report visible control delay or corrections rather than calling this a guarantee of competitive netcode.
- Real internet verification uses separate computers on separate networks. Until run, internet play remains unverified even if localhost passes.
- Every selected Pokémon visibly runs, dribbles, passes, shoots, dunks, blocks, and performs its signature with the ball aligned. Keyboard focus, mute, reduced motion, and readable labels work.

## 10. Scope boundary and remaining evidence

This first playable includes the complete online match loop and selected art, rather than a menu-only or single-player substitute. More teams, mobile touch controls, gamepads, accounts, matchmaking, ranked play, persistent records, spectators, commentary, and additional courts come after this version.

Two kinds of evidence must be gathered during implementation: visual inspection of exact sprite sheets and playtesting of timing/netcode. They are explicitly unverified now. Tuning numbers in this spec are proposed starting values, not experimentally proven settings.

The next stage is a short implementation plan covering asset inspection, the shared basketball simulation, authoritative rooms and bots, presentation, and end-to-end checks. Written-spec approval is required before that stage under the selected Superpowers workflow.

## Technical references

- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API): native browser 2D drawing and accessibility limitations.
- [ws](https://github.com/websockets/ws): Node WebSocket server; browsers use their native WebSocket API.
- [SpriteCollab](https://github.com/PMDCollab/SpriteCollab): candidate sprite catalog, metadata, and attribution policy; individual sheets still require inspection.
