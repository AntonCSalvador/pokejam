# PokéJam: arcade opening and seven-team roster

Date: 2026-10-12

Status: Written spec approved by the user on 2026-10-12. Implementation planning is authorized; implementation has not started.

## Intent

Make opening PokéJam feel like starting a 1990s basketball arcade game: title screen, Play, team selection, player selection with meaningful ratings, matchup presentation, then basketball. Preserve the existing pixel-art court, desktop keyboard controls, private rooms, four human-or-AI slots, and local Node/WebSocket service.

The opening should be a sequence of game screens. Each screen has one clear next action and a working Back action. The existing long home page with the court and room controls is replaced. NBA Jam is the composition and energy reference; team emblems, interface art, and code belong to this project.

## Roster

Seven franchises, three available Pokémon each, two starters per side. The third Pokémon is a pregame lineup option, not an in-match substitute. Existing Chicago and Miami pairs remain their default starters. The first two names below are the defaults for the other teams.

| Franchise | Roster | Team identity |
| --- | --- | --- |
| Chicago Tauros | Tauros, Machamp, Hitmontop | Red/black; physical interior play, passing, disruptive defense |
| Miami Heatmors | Heatmor, Charizard, Infernape | Red/gold; shooting, aerial finishes, fast offense |
| Boston Celebis | Celebi, Gallade, Breloom | Green/cream; finesse, passing, precision |
| Golden State Wartortles | Wartortle, Blastoise, Drednaw | Blue/gold; perimeter shooting with a paint specialist |
| Toronto Tyrantrums | Tyrantrum, Sceptile, Aerodactyl | Red/purple; powerful dunks, speed, aerial defense |
| Minnesota Lycanrocs | Lycanroc, Mightyena, Lucario | Navy/ice blue; pressure defense and transition offense |
| Sacramento Kingdras | Kingdra, Nidoking, Slowking | Purple/silver; long-range shooting, paint power, deliberate passing |

Use standard species forms, including Midday Lycanroc. Milwaukee and Phoenix remain alternate pitches outside this implementation.

Sacramento's individual pitch:

- Kingdra: perimeter shooter; a charged shooting boost called Royal Flush.
- Nidoking: powerful interior finisher; Crown Crusher extends dunk reach.
- Slowking: slower playmaker with strong shooting; King's Assist accelerates one pass.

These are basketball abilities for PokéJam, not claims about Pokémon battle mechanics. Each player gets a short role, a named signature, and an explicit effect description.

## Screen flow

### 1. Home

One viewport contains the main composition: a large PokéJam wordmark, Pokémon in basketball poses, stadium lighting, and a dominant Play button with an Enter-key hint. Join Friends and How to Play are secondary actions. Sound and reduced-motion controls remain accessible.

Keep warm maple, pixel typography, hard-edged arcade panels, oversized sprites, and bold team colors. Use authored pixel/CSS/Canvas artwork and existing sprite assets. A subdued AI exhibition can animate behind the title; it must not obscure controls or create a second competing screen. Reduced motion removes decorative animation, shake, and flashing.

Play creates a private room and enters selection with the creator in the first slot. Solo play uses the same flow with the other three slots filled by AI. Creating a room remains a visible pending state with a retryable error.

### 2. Choose teams

Show all seven franchises in a compact selection board. Two opposing panels display selected team emblems, names, colors, and the current side being edited. The initial matchup is Chicago versus Miami. Both sides may select any franchise, but the two sides must be different franchises.

For solo play, the host chooses both teams. For multiplayer, the first connected person on each side is that side's captain; the host controls a side that has no connected humans. The captain selects its franchise. A disconnect passes captain control to the next connected person on that side; it does not change the selected franchise.

Team changes are disabled for a side containing another human or a disconnected person's reserved slot. This prevents silently replacing someone else's Pokémon. Explain the reason next to the locked control. The side captain may change its own team's franchise when it is the only occupant of that side. Changing a franchise resets both starters to the new defaults, keeping the captain in its existing slot. An all-AI side is editable by the host.

Room invitations are available from selection. A joining friend sees the current matchup and chooses an available player slot on either side before making player choices. A full room shows a clear full-room message and Back to Home.

### 3. Choose players and inspect ratings

Each side shows its three Pokémon as large portraits with names and roles, plus its two numbered starter slots. Focus or selection shows Speed, Shooting, Dunk, and Steal ratings as labeled 1–10 segmented bars and the signature's effect in plain language.

Each human can change the Pokémon in its own starter slot. The side captain can change AI starters; another human's or reserved starter is protected. Selecting the same Pokémon into both starter slots is rejected. To pick a Pokémon occupying an AI starter, explicitly swap the two starters atomically; never displace a person. Label human, AI, reserved, and joining states with text.

Arrow keys move through selections, Enter confirms, and Escape goes back one screen. Tab and native buttons remain usable. Menu shortcuts ignore text-entry fields and do not send gameplay inputs. Returning from player selection to teams preserves the lineup unless the franchise changes.

Each client can open matchup review once both sides have valid lineups. Separate ready votes are outside this change; the existing host-start model remains. Guests see that the host starts the game.

### 4. Tonight's matchup

Show both team emblems, all four starters, compact rating summaries, and a large VS. Before the host starts, this reviews the shared lineup with Copy Invite and Back to Selection. Menu navigation is local to each client; incoming lobby updates refresh the lineup being reviewed. Starting freezes the server-approved lineup, shows the existing three-second countdown within this presentation for everyone, then moves to the court.

The server can use its existing countdown phase; this does not require an additional simulated match phase. Late joiners enter the existing join-at-stoppage flow, not a new team draft. They cannot change the active lineup.

### 5. Match and results

Scoreboard, court signage, player markers, signature labels, and winner text use the selected franchises and starters. Preserve the existing basketball loop and actual two-on-two play.

Results retain final score and winner. The host's rematch action returns everyone to selection, retaining franchises, starters, and human slots. Starting again resets match state. No mid-match bench substitutions, persistent records, or career statistics are added.

## Ratings and signatures

The ratings must describe mechanics that run on the server. Keep one shared catalog as the source for menu bars and simulation tuning:

- Speed maps to base movement speed.
- Shooting maps to the timed release window; stronger shooters receive more forgiveness, not guaranteed scores.
- Dunk maps to maximum dunk initiation distance; turbo cost and blocking remain active.
- Steal maps to steal recovery time; higher ratings allow faster recovery after an attempt. Steal range, facing checks, and possession rules remain unchanged.

Use monotonic documented conversions and tune profiles around the existing playable values. Preserve the original four players' speed, shot windows, and dunk ranges when first introducing the catalog. Starting ratings and profile mappings are tuning data, subject to playtesting; do not advertise balance as verified.

Reuse the four existing signature mechanics as the initial ability families: directional dash, faster pass, temporary shooting-window boost, and temporary dunk-range boost. Each Pokémon gets an appropriate name and effect description. Avoid introducing 17 new mechanics as a side effect of adding 17 characters. Steal specialists are differentiated by their ordinary rating as well as mobility and signature selection.

Signatures dispatch by the selected Pokémon's ability kind, never by its player slot. A species must keep the same ability when it moves to another lineup position or side. Existing meter earnings, activation guards, costs, windup, and counterplay remain.

## Shared state and code boundaries

Separate franchise identity from match side. A stable team key identifies Chicago, Miami, and the other franchises. Match sides stay 0 and 1; player IDs stay 0–3, preserving teammate pairing and control-slot semantics.

- `public/game/data.js`: seven-team catalog, 21 species profiles, default lineups, rating conversions, signature kinds, and pure selection validation.
- `public/game/simulation.js`: construct exactly four players from validated lineup keys; retain selected franchise keys in match state; dispatch signatures by ability kind.
- `server/rooms.js`: authoritative franchise and starter selection, permissions, atomic swaps, and phase restrictions. Lobby messages include both franchise keys and four starter keys. Clients send keys and slots, never numeric ratings or ability definitions. Invalid or unauthorized requests return an actionable error and preserve state.
- `public/app.js` and a small menu module if needed: screen transitions, keyboard selection, shared lobby rendering, invite/recovery UI. Server state wins over optimistic local choices.
- `public/index.html` and `public/style.css`: full-screen menu compositions and responsive layouts, keeping the current game canvas and controls.
- `public/render.js`: species portraits, dynamic team colors and signage, correctly scaled sprites, menu/countdown presentation as appropriate.
- `public/connection.js`: retain prediction, reconciliation, interpolation, reconnect, and rotated session tokens. Keep player identity/profile fields through reconciliation.

Keep one authoritative process at 60 Hz and snapshots at 20 Hz. No framework, router, database, build pipeline, or new production dependency is required.

Selection changes are lobby-only and broadcast after validation. Process competing choices serially against current server state. A rejected stale choice shows the current lineup plus the error, not a locally divergent roster. Starting and editing in the same tick must still produce one valid frozen matchup.

## Recovery and navigation

Home clears the active connection, retries, saved session, local match state, and room URL as it does today. Escape during selection only changes the local menu screen; it does not silently abandon a room. An explicit Home action leaves the room.

Reload/reconnect restores the authoritative room and selected lineup. Pre-match sessions return to selection or matchup review; live sessions return to the court. Expired sessions may claim an available slot again. Missing rooms return to Home with an explanation. Neutral-on-blur, short input edges, control epochs, token rotation, reservation expiry, and late-join protection remain.

## Assets and accessibility

Import compatible multi-frame art for all 21 species with pinned source revisions, per-sheet author/terms records, and retained credits. Existing four characters and their credits remain. Validate source metadata, frame bounds, both directions, pivots, and front-facing ball anchors per species. Do not assume every source uses an identical sheet layout.

New species need readable idle, movement/dribble, pass, shot, dunk, block, stagger, and signature sequences using compatible source poses and authored timing. Runtime missing-art fallbacks remain available, but placeholder rectangles do not satisfy completion. If a selected species lacks usable art, report the specific gap before changing the approved roster.

Scale large and small Pokémon deliberately; neither portraits nor on-court sprites should clip or hide the ball. All shipped raster art carries provenance. Team emblems are original simple marks derived from the Pokémon/team theme.

Use visible keyboard focus, native controls, accessible labels, text alongside color, readable rating numbers, and restrained live announcements. Small screens keep menus usable without horizontal overflow and state that gameplay requires a keyboard. Focus moves to the new screen heading or main control on navigation and to the court on tip-off.

## Acceptance and limits

1. Home → Play → teams → players/ratings → matchup → complete match → rematch works with one human and three bots.
2. All seven teams and all 21 Pokémon are selectable. Any pair of distinct franchises can play. Both roster positions and court sides preserve the chosen species, profile, art, and ability.
3. Four independent clients share the same matchup, choose protected slots, and receive consistent selections. Invalid teams, duplicate starters, foreign-roster starters, unauthorized edits, and edits after start are rejected.
4. Human/reserved-slot protection, captain handoff, AI-starter swaps, rematch, reconnect, late join, room expiry, and Home exit have focused coverage.
5. Displayed ratings agree with simulation profiles. Existing once-only scoring, blockable buzzer shots, turbo exhaustion, and signature/input regressions continue passing.
6. Headless Edge checks capture each new screen, keyboard navigation, a small viewport, missing-art recovery, and a full match/rematch. Inspect screenshots and all-species action atlases. Run the delayed four-client match because roster identity now crosses the protocol and snapshots.
7. Record executed checks and remaining gaps; update README, PRODUCT, DESIGN, and handoff references to describe shipped behavior. The original completed plan remains historical.

Asset readiness for the 17 additional Pokémon is not yet verified. Planning checks found animation metadata for all 17 at the existing pinned SpriteCollab revision; sheet quality, credits, frame extraction, and basketball readability still require inspection. Subjective balance, audible output, other browser engines, internet deployment, and separate-network play retain their existing verification limits. This work targets the local playable game.
