# PokéJam

A first playable Pokémon basketball fan game: Chicago Tauros versus Miami Heatmors. Four players, two baskets, three-minute matches, timed shots, huge dunks, steals, blocks, turbo, and signature moves earned through play. Original game code; no NBA Jam ROM or source code required.

## Run

Install Node.js 24 or newer, then run from this directory:

```sh
npm ci
npm test
npm start
```

Open **http://127.0.0.1:3000**. Create a court, choose your player, then start. Empty slots use AI. Copy the invite to let friends choose any free slot; up to four humans can play. Two friends can share a team against AI. Late joins take control at the next stoppage.

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

Tauros: Raging Bull. Machamp: Bullet Pass. Heatmor: Heat Check. Charizard: Sky Slam. Scores, assists, steals, blocks, and defensive rebounds earn meter. Tied games enter next-basket-wins overtime. Host can return to the lobby for a rematch.

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

The browser suite uses locally installed Microsoft Edge through Playwright, takes screenshots into `docs/verification`, and runs a real-time solo match/rematch plus room/control/fallback checks. The latency suite uses four independent WebSocket clients with 75 ms delay each way and compares their authoritative state at every common tick. These longer suites can take several minutes. Unit and protocol checks use Node's built-in test runner.

See [verification record](docs/verification/first-playable.md) for executed checks and remaining limits. Core files: `public/game/` rules and AI; `server/` authority and room protocol; `public/app.js` controls/session/UI; `public/render.js` canvas/audio.

## Art

Existing Pokémon sprite pixels come from a pinned SpriteCollab revision. Basketball animation sequencing, timing, pivots, ball anchors, court art, UI, and effects are added here. Source terms differ per sheet; [credits and provenance](public/assets/CREDITS.md) accompany the assets. This is an unofficial fan game.
