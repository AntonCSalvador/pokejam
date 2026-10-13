# Product
<!-- impeccable:product-schema 1 -->
## Platform
web
## Current focus
As of 2026-10-12, the user wants local development and new gameplay features. Public hosting is deferred. Keep the existing localhost server and multiplayer architecture; do not treat deployment as the next required task.
## Stack
User approved native Canvas, JavaScript, and one Node WebSocket server. Native execution of the implementation plan is approved.
## Users and purpose
The user and friends play online Pokémon basketball. Four character slots, two per team, can be controlled by humans or AI. Success is a complete readable match from separate computers, with working reconnects.
## Confirmed commitments
NBA Jam-inspired arcade home → teams → players and ratings → matchup/countdown → angled pixel-art court → results/rematch. Oversized Pokémon, exaggerated dunks, original NBA-spoof emblems, private invites, no accounts. Seven franchises with three Pokémon each; two distinct starters per side: Chicago Tauros, Miami Heatmors, Boston Celebis, Golden State Wartortles, Toronto Tyrantrums, Minnesota Lycanrocs, Sacramento Kingdras. The full roster is in README.md and public/game/data.js.

Speed, shooting, dunk, and steal ratings map to actual movement, shot timing, dunk reach, and steal recovery. All 21 species have credited sprites and named signatures using the existing dash/pass/shot/dunk effects. Basketball builds signature meter; the original four players retain their initial tuning. Profile balance remains a playtesting question.

Selection is authoritative: each human edits their own Pokémon; the side captain edits AI starters and chooses the franchise only while no teammate/reservation occupies the side. The host controls all-AI sides. Different franchises, distinct starters, no client-supplied stats. Selection freezes at countdown and survives rematches; match state resets.
## Evidence and limits
Approved design and plan live in docs/superpowers. Imported sprites and source records live in public/assets. Hosting destination and separate-network verification remain open. Do not advertise a live public service before deployment.
## Accessibility
Keyboard-accessible HTML controls, visible focus, readable labels, mute, reduced motion, text plus color for team identification.
