# Floorplan: design notes

An original, mobile-first roguelike room-drafting game. It borrows Blue Prince's "draft 1 of 3 rooms at a doorway" idea,
Carcassonne's rotate-to-fit placement, and Slay the Spire / Balatro run structure. No names, rooms or story are taken from them.

## Core loop
- Tap a glowing doorway (an empty cell next to a door of a room connected to the Entrance). Pay 1 Step, draw 3 cards.
- Pick 1 (the other 2 go to the discard pile), rotate it (it must have a door facing back) and place it.
- Win: connect the Vault **and** hold its Gem toll. Lose: 0 Steps, no open doorways, or only locked doorways and no Keys.
- An empty deck reshuffles the discard pile and costs Steps.

## Judgement calls made during the build
- **The target is a cell, not a specific door.** If several doorways lead into the same empty cell, any valid rotation that faces one of them is allowed. This is simpler to tap on a phone.
- **Vault toll (Gems).** Without it the shortest route was ~6 drafts and the bot won ~80% of Mansion 1. The toll makes you detour through Gardens and weigh Gems against rare rooms.
- **Broom Closet fallback.** Offered only when no offer is affordable, so you're never soft-locked by costs.
- **Pre-placed rooms** don't trigger their effects; they join the house once a door connects to them.
- **Locks** are random per exit, more likely in the far rows (mansion `lockChance`). Mansions can also have always-locked cells.
- **Deeds are per mansion.** Beating mansion X at deed N unlocks deed N+1 for that mansion.
- **Ink** is earned every run (rooms placed + 2×rows advanced, + a win bonus) and buys Archive unlocks: new rooms (added to every starting deck), starting decks and perks.
- Saves use localStorage (meta + run in progress). Storage failures are ignored.
- The tutorial is a rules sheet shown before the first run, not a guided scripted run (yet).

## Structure
- `js/engine/`: pure rules (`engine.js`), meta-progression (`meta.js`), seeded RNG.
- `js/data/`: rooms, heirlooms, mansions/curses/deeds/decks/unlocks. Content is data plus small hook functions.
- `js/ui/`: DOM rendering and input only.
- `tests/`: `node --test tests/*.test.mjs`.
- `tools/`: `sim.mjs` (balance), `bot.mjs`, `screenshot.mjs` (Playwright, 390×844).

## Modifier hooks
Decks, mansions, curses, deeds, heirlooms and passive rooms can all implement:
`start`, `drawCount`, `gemCost`, `shopPrice`, `reshufflePenalty`, `draftCost`, `gainAmount`, `toll`, `lockBonus`, `freeLock`, `onPlace`, `onReshuffle`.

## Ideas parked for later
- Guided tutorial run with a fixed seed.
- Daily seeded mansion with shareable score.
- More mansions (two vaults, rotating wings), more curses drawn randomly per run.
- Room upgrades (Balatro-style card enhancement), sound.
