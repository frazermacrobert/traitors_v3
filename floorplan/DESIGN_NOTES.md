# Floorplan: design notes

## V2 (current)
A run is **three Nights**. Each Night generates a fresh floor from the seed (entrance bottom, Stairwell top; Vault on Night 3),
with blocked cells, locked cells and **?** mystery cells, a **goal** (hold N Gems/Coins/Keys, or have a Wing of N) and an **Omen**.
- **Dread** rises 1 per draft (+1 when 6+ doorways are open). At thresholds the house acts: seals the doorway nearest the goal,
  collapses a cell, chills Steps, slips Rubble into the deck, whispers (fewer cards), raises the goal, or rotates a room.
  Calming rooms (Hearth Room, Vigil Room, Lamplit Hall), events and the Chapel landing push back.
- **Wings**: 3+ connected rooms of one family give a family bonus, again each time the Wing grows.
- **Mystery events** (9) offer two-way choices. **Landings** between Nights: rest, shop, burn, heirloom, plan chest, locksmith, chapel.
- Placed rooms return to the deck between Nights; Steps reset per Night (+ half your leftover).
- The **Steward** comments on events. Optional synthesized sound (muted by default).
- Meta upgrades are capped and smaller; mansions are difficulty tiers rather than fixed layouts.
- Settings: sound toggle and **Restart game** (two-step, erases all progress). V1 saves reset with up to 60 Ink credit.

Not yet done from the V2 plan: custom illustrated icon set, Pact-style modifiers, Daily mansion, Codex, room upgrades, secret rooms.

---


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

## Rooms, rarity and decks (v2)
- About 85 rooms in 7 families, each with its own job: Halls (blue) bend the draft, Gardens (green) grow Gems, Chambers (purple) restore Steps,
  Corridors (orange) route cheaply, Shops (gold) handle Coins, Keys and trades, Cursed rooms (red) pay big with a sting, Wonders (white) break rules.
- Four rarities (Common, Uncommon, Rare, Legendary) set how often a room is drawn into the random part of the deck and how its card is framed.
- Each run's deck = the chosen Plans' core cards + Archive-unlocked rooms + 18 random rooms weighted by rarity (and by the Plans' family bias).
- New mechanics: guaranteed family next draft, free-cost draft, +2-card peek, collapsing cells, toll changes, echo (repeat a neighbour's effect),
  copy/add cards to the deck, burn cards, interest, conversions, standing passives (Observatory, Conservatory, Chapel).
- Heirlooms last for one run. Archive unlocks (rooms, Plans, perks) are permanent. The Effects sheet shows all of this in one place.

## Getting stronger between runs (v3)
- **Upgrades** (Archive → Upgrades): tiered, permanent, bought with Ink: Stamina, Deep Pockets, Loaded Dice, Foresight, Keyring, Purse, Second Wind, Drafting Table.
- **Blueprints**: after every run (win or lose) you keep 1 of up to 3 rooms you drafted, rarest first. Equipped Blueprints join the starting deck; slots start at 3 (+3 via Drafting Table).
- **Heirlooms found** are recorded. The Family Chest perk lets you pick one to start every run with.
- Ink still comes from every run, so failing repeatedly always moves you forward.

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
