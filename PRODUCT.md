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

Gameplay upgrade (2026-10-14): J passes, steals, or calls for a pass from an AI teammate. Shift + J selects a fast pass (10 turbo) with the ball or a shove (25 turbo, hit or miss) without it. Shoves have 300 ms slow recovery and 900 ms cooldown; victims stagger for 400 ms with another 300 ms of shove protection. Contact spills a loose ball rather than granting possession. Passes steer toward a moving receiver with bounded turn rate and physical first-contact interception.

Tap K near the rim for a committed dunk. Standing and running dunks cost zero; 150 ms of actual forward movement earns running reach. Shift + K spends 20 for more reach and height. Players carry the ball along the dunk trajectory; low takeoffs can be shoved, high dunks can be blocked. A successful dunk can posterize one close defender with a 150 ms fall, 300 ms down, and 250 ms get-up. Final scores are authoritative immediately; the results panel waits for that cosmetic recovery.

The court remains 100 by 56. High airborne players clear ground bodies and forced displacement stops at bodies/bounds. General collision sliding and a taller court projection remain follow-up candidates; crowded ground contact can still feel sticky. No on-fire mode, alley-oops, airborne passing, or separate shove button was added.
## Evidence and limits
Approved design and plan live in docs/superpowers. Imported sprites and source records live in public/assets. Hosting destination and separate-network verification remain open. Do not advertise a live public service before deployment.
## Accessibility
Keyboard-accessible HTML controls, visible focus, readable labels, mute, reduced motion, text plus color for team identification.
