# First-playable verification — 2026-10-12

Status: local build and browser acceptance checks pass. Independent whole-branch review completed; all three Important findings fixed with failing-then-passing regressions. Internet acceptance remains open.

## Environment

Windows, Node 24.14.0, npm 11.9.0, Microsoft Edge 155.0.4283.45 in headless Playwright 1.64.0. Browser testing explicitly authorized by the user after browser-control tools reported no connected browser. Desktop screenshots: 1280 × 960 viewport. Small-width layout check: 390 × 844. No other browser engine has been tested.

## Executed evidence

- `npm test`: **28 checks passing** after review fixes across source-asset bounds/provenance, real simulation, AI-only seeded matches, rooms, and a real HTTP/WebSocket server. Covers once-only scoring, misses/rebounds, pass interception, steals, blockable dunks/buzzer shots, overtime, shot-clock/out-of-bounds turnovers, all four signatures, neutral input cancel, human/reserved-slot protection, token rotation, capacity/rate limits, 250 ms stale input, and 60/120-second expiry with an injected clock.
- `node test/latency.mjs`: four separate WebSocket clients completed a real-time match with **75 ms delay each direction**. Final **53–48**; **4,547 common authoritative ticks**, identical score, ball holder, and phase at each. No protocol errors. Scripted inputs use normal controls, never scores or positions.
- `node test/recovery.mjs`: two independent browser contexts shared a team against two AI players at 150 ms simulated RTT; a live late join remained pending until stoppage, then took its reserved slot. Movement was acknowledged. Duplicate-tab token reclaimed the same player and returned the old tab to recovery. Restarting the actual Node service returned the browser to “Room ended” with Create court available. Zero uncaught browser errors.
- `node test/browser.mjs`: home/create/join, malformed invite, four separate human slots, human teammate protection, sound/motion controls, focus loss while moving with turbo, automatic reconnect, and missing-art fallback passed. A real-time solo match finished **57–41**, displayed results, and returned to a clean **0–0** rematch countdown. Zero uncaught browser errors.
- Small-width page had no horizontal overflow. It still requires a desktop keyboard to play.
- Sprite atlas inspected in both directions for all nine action sequences and all four Pokémon. Visual inspection found and fixed a reversed source-row mapping: row 2 faces right, row 6 faces left. A new manifest regression locks direction and front-of-player ball anchors. Source pixels are unchanged.
- Full-match browser testing exposed a results-screen freeze: repeated final snapshots reset interpolation time while the authoritative tick stopped. Duplicate ticks now preserve the render clock, covered RED → GREEN by the snapshot test. The end-to-end result/rematch rerun passed.

## Presentation evidence

[Home](home.png), [lobby](lobby.png), [match](match.png), [results](results.png), [small viewport](small.png), [missing-sheet fallback](fallback.png), [delayed co-op](delayed-coop.png), [all-action sprite atlas](animations.png). Home/lobby/match and atlas include the facing correction; other journey captures preceded it.

The court, player rings, scoreboard, controls, and four distinct Pokémon are visible. Existing frame sequences have new basketball timing and independent ball motion. The atlas checks attachment/facing; it does not establish that every pose is polished enough for final art direction. The large sprites can overlap in crowded play.

## Measured limits and pending checks

- 150 ms simulated RTT passed authoritative consistency and browser movement checks. Remote players/ball intentionally render ~100 ms behind their received server state. Shot feedback still follows server acknowledgement; difficult timing under latency needs human playtesting. No competitive fairness or jitter/loss guarantee.
- Headless sound toggling and AudioContext initialization were exercised; actual speaker output was not listened to.
- Buzzer/overtime and 60-second reservation expiry ran against real rules/room logic with controlled clocks; they were not each waited out manually in a browser.
- No separate-computer/separate-network match has been run. No hosting account or deployment destination has been authorized. No public URL exists. Localhost is not evidence of internet acceptance.
- Dockerfile and HTTPS/WSS recipe prepared. Docker/Render/Fly/Railway CLIs are unavailable here (GitHub CLI exists); container execution remains unverified. No remote publishing or spending performed.
- Rooms are ephemeral and single-process. No mobile controls, accounts, matchmaking, spectator mode, saved results, or additional teams.

## Execution decisions

- Manual ignored git worktree after managed creation could not resolve the non-repository task parent; cost: manual cleanup when integration is chosen.
- Reused compatible multi-frame sprite poses with new timing and anchors; cost: bespoke basketball poses may improve readability later.
- Reused approved native implementation plan and arcade brief without reopening visual-direction questions; cost: visual choices remain subject to user playtest.
- Internet deployment stays pending because no destination or separate-network endpoints are authorized/available; cost: real-network failures may remain undiscovered.
- Container execution stays unverified because Docker is unavailable; cost: platform/runtime deployment issues may remain undiscovered.
- Audible output and subjective responsiveness stay pending human playtest; cost: sound balance and shot timing may need tuning.
- Browser coverage stays Edge-only for this pass; cost: other engines may have compatibility differences.

## Independent review and final fix pass

Fresh-context reviewer inspected the complete branch, ran the 26-check suite, and reproduced three Important issues. All three were fixed in one pass:

1. Empty turbo regenerated on alternating held ticks, granting unlimited extra speed. A sustained empty-meter regression failed, then passed after recharge was restricted to released turbo.
2. Pure vertical Raging Bull incorrectly substituted horizontal facing. Up/down/neutral-direction regressions failed, then passed with vector normalization and a neutral-only facing fallback.
3. Home immediately restored the room it was supposed to leave. `node test/exit.mjs` failed, then passed after Home cleared memory/storage, cancelled retry, closed the socket, and restored entry UI. Ordinary reload still restores the room; a new court gets a new ID; exit also works during live play.

The final suite passed 28/28. Long browser/latency matches were executed before these focused review fixes; seeded complete-match checks and affected browser exit behavior were rerun afterward. No second reviewer was dispatched.

Deferred minors: full-room inspection still says to choose an available Pokémon while all slots are disabled (Home now works as the return action); imported `assets/fonts/OFL.txt:21` retains upstream trailing whitespace. Working-diff whitespace checks pass; whole-branch `git diff --check` flags that single license line. Original license text was preserved.

See the approved [design](../superpowers/specs/2026-10-12-pokejam-design.md) and [plan](../superpowers/plans/2026-10-12-pokejam.md). This record distinguishes implemented local behavior from pending internet acceptance.
