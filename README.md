# PokéJam

A Pokémon basketball fan game with seven NBA-inspired franchises and 21 selectable Pokémon. Four players, two baskets, three-minute matches, timed shots, huge dunks, steals, blocks, turbo, and signature moves earned through play. Original game code; no NBA Jam ROM or source code required.

**Current focus: local development and gameplay features. Hosting is deferred.** For a fresh coding session, start with [AGENTS.md](AGENTS.md), which links the design, architecture, verification evidence, and known issues. The original implementation plan is completed history.

## Run

Install Node.js 24 or newer, then run from this directory:

```sh
npm ci
npm test
npm start
```

Open **http://127.0.0.1:3000**. Press **Play**, choose two different franchises, pick two starters from each three-Pokémon roster, review the matchup, then **Tip off**. Empty slots use AI. Copy the invite to let friends choose any free slot; up to four humans can play. Two friends can share a team against AI. Late joins take control at the next stoppage.

Each side's oldest connected human is its captain; the host configures all-AI sides. Captains choose teams and AI starters, and each human chooses their own Pokémon. A second human or reservation locks that side's franchise. Selecting your AI teammate's Pokémon swaps the two species. To control another free slot, select it and use **Play as P…**. Lineups lock at countdown and persist for rematches. Back preserves choices; the home logo leaves the room. Enter starts from Home, arrows browse focused grids, Escape goes back, and Tab reaches every enabled control.

| Franchise | Roster (choose two) |
| --- | --- |
| Chicago Tauros | Tauros, Machamp, Hitmontop |
| Miami Heatmors | Heatmor, Charizard, Infernape |
| Boston Celebis | Celebi, Gallade, Breloom |
| Golden State Wartortles | Wartortle, Blastoise, Drednaw |
| Toronto Tyrantrums | Tyrantrum, Sceptile, Aerodactyl |
| Minnesota Lycanrocs | Midday Lycanroc, Mightyena, Lucario |
| Sacramento Kingdras | Kingdra, Nidoking, Slowking |

Ratings are real tuning, on a 1–10 scale: speed sets movement speed, shooting widens the timing window, dunk sets reach, and steal reduces recovery time. These are initial profiles, not a claim of competitive balance. Signature descriptions state the effect and activation requirement.

Localhost links work on this computer only. For another computer on your LAN, start with `HOST=0.0.0.0` and use your computer's LAN address. Internet play needs the hosted service below.

PowerShell configuration example:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '3000'
npm start
```

## Controls

Click or Tab to the court to focus it. Leaving gameplay focus stops held controls without firing a charged shot.

| Key | Action |
| --- | --- |
| WASD / arrows | Move |
| Shift | Turbo |
| J | Pass; steal on defense |
| K | Hold and release near the shot-meter marker; block on defense |
| K near the rim | Dunk when at least 20 turbo remains |
| L | Signature at full meter |
| Space | Switch to your AI teammate; human/reserved slots are protected |

Signatures reuse four basketball effects: dash, fast pass, shot boost, and boosted dunk. Each species has its own named move. Scores, assists, steals, blocks, and defensive rebounds earn meter. Tied games enter next-basket-wins overtime. Host can return to player selection for a rematch.

Sound starts muted. The header has sound and reduced-motion controls. Desktop keyboard required; touch controls and gamepads are outside this build.

## Online service

The Node server owns movement, collisions, possession, timers, meter, and scores at 60 Hz. WebSocket snapshots run at 20 Hz. Clients interpolate remote movement about 100 ms behind, predict their own movement, and reconcile against acknowledgements. Shot/score outcomes stay authoritative.

Disconnects hand the player to AI immediately. Automatic reconnect backs off from 500 ms to 5 seconds and reclaims the slot with a rotated token stored in this tab's session storage. Reservations last 60 seconds. The invite contains only the room ID. All state lives in one process: restarting or redeploying ends rooms. Empty rooms expire after two minutes; capacity is 16 rooms / 96 sockets. Run **one instance**.

## Deploy package

Use a long-lived Node web service or this Dockerfile, with HTTPS termination and WebSocket upgrades forwarded to `/ws` on the same host. The proxy must preserve the public `Host` header for same-origin checks. Static-only hosting cannot run the match server.

```sh
docker build -t pokejam .
docker run --rm -p 3000:3000 pokejam
```

The container uses a version-pinned [official Node image](https://hub.docker.com/_/node), installs locked production dependencies, and runs as the unprivileged `node` user. Docker is not installed in the development environment, so container execution remains unverified.

Example destination: a Render **Web Service** connected to this repository/branch, runtime Docker, one instance, port 3000. Render terminates HTTPS; the browser automatically uses WSS. See [Render's WebSocket guide](https://render.com/docs/websocket). No external service has been created or purchased. Before inviting remote players, verify a full match from separate computers on separate networks, reconnect, and host restart recovery. Public internet acceptance is still pending.

## Verify

```sh
npm test
npm run test:browser
npm run test:latency
```

The browser suite uses locally installed Microsoft Edge through Playwright, takes screenshots into `docs/verification/arcade-selection`, and runs a real-time solo match/rematch plus room/control/fallback checks. The latency suite uses four independent WebSocket clients with 75 ms delay each way and compares franchises, species, abilities, score, possession, and phase at every common tick. These longer suites can take several minutes. Unit and protocol checks use Node's built-in test runner. `node test/selection.mjs` checks the complete short menu journey and desktop/small layouts; `node test/exit.mjs` and `node test/recovery.mjs` check recovery.

See [arcade-selection verification](docs/verification/arcade-selection/verification.md) for current evidence; [first playable](docs/verification/first-playable.md) is historical. Core files: `public/game/` rules, catalog and AI; `server/` authority and room protocol; `public/app.js` controls/session lifecycle; `public/menu.js` screen navigation and selection; `public/render.js` canvas/audio; `public/connection.js` prediction/reconnect.

## Art

Existing Pokémon sprite pixels come from a pinned SpriteCollab revision. Basketball animation sequencing, timing, pivots, ball anchors, court art, UI, and effects are added here. Source terms differ per sheet; [credits and provenance](public/assets/CREDITS.md) accompany the assets. This is an unofficial fan game.

Runtime uses committed assets and needs no Python. To regenerate sprite metadata/download source sheets, install Python 3 and Pillow, then run `python tools/import_sprites.py`. Use `python tools/import_sprites.py --check` for local validation without downloads. The importer was verified with Python 3.14.3 / Pillow 12.2.0. `node test/animations.mjs` captures franchise action atlases for visual inspection.
