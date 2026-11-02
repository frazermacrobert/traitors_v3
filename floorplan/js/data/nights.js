// V2 run structure data: Omens (per-Night rule breakers), House acts (Dread), mystery Events,
// Landings (between Nights), Wing bonuses and the Steward's voice.

// ---------- Omens ----------
// tier 1 = mild, 2 = nasty, 3 = brutal. Hooks match the modifier system in engine.js.
export const OMENS = {
  dust: { id: 'dust', tier: 1, name: 'Dust Sheets', icon: '🕸️', text: 'Reshuffling costs 1 extra Step.', reshufflePenalty: (n) => n + 1 },
  overgrown: { id: 'overgrown', tier: 1, name: 'Overgrown', icon: '🌿', text: 'Gardens cost 1 more Gem.', gemCost: (c, room) => (room.family === 'green' ? c + 1 : c) },
  rusted: { id: 'rusted', tier: 1, name: 'Rusted Hinges', icon: '🔩', text: 'Doorways lock more often.', lockBonus: (n) => n + 0.12 },
  damp: { id: 'damp', tier: 1, name: 'Rising Damp', icon: '💧', text: 'Chambers restore 1 fewer Step.',
    gainAmount: (n, s, { res, room }) => (res === 'steps' && n > 0 && room && room.family === 'violet' ? n - 1 : n) },
  dim: { id: 'dim', tier: 1, name: 'Dim Lamps', icon: '🕯️', text: 'Your first 4 drafts show 1 fewer card.', nightStart: (s) => { s.buffs.smallDraw += 4; } },
  restless: { id: 'restless', tier: 2, name: 'Restless House', icon: '🌀', text: 'The house acts 2 Dread sooner.', dreadEvery: (n) => n - 2 },
  hungry: { id: 'hungry', tier: 2, name: 'Hungry Walls', icon: '🦷', text: 'Chambers cost 1 Gem.', gemCost: (c, room) => (room.family === 'violet' ? c + 1 : c) },
  flooded: { id: 'flooded', tier: 2, name: 'Flooded Halls', icon: '🌊', text: 'Four extra cells are flooded.', extraBlocks: 4 },
  greedy: { id: 'greedy', tier: 2, name: 'Greedy Steward', icon: '🪙', text: 'Goals ask for 2 more.', goalAmount: (n) => n + 2 },
  narrow: { id: 'narrow', tier: 2, name: 'Narrow Halls', icon: '📏', text: 'Cross rooms cost 1 more Gem.', gemCost: (c, room) => (room.shape === 'X' ? c + 1 : c) },
  cold: { id: 'cold', tier: 3, name: 'Bitter Cold', icon: '❄️', text: 'Start the Night with 3 fewer Steps.', nightStart: (s) => { s.res.steps = Math.max(1, s.res.steps - 3); } },
  watchful: { id: 'watchful', tier: 3, name: 'Watchful Portraits', icon: '🖼️', text: 'Every draft raises Dread by 1 more.', dreadPerDraft: (n) => n + 1 },
  barred: { id: 'barred', tier: 3, name: 'Barred Windows', icon: '🚧', text: 'Rooms on the outer wall cost 1 Step to place.',
    onPlace: (c) => { if (c.onEdge()) c.gain('steps', -1); } },
};

// ---------- House acts (triggered by Dread) ----------
export const HOUSE_ACTS = [
  { id: 'seal', weight: 3, minNight: 1, text: 'A door swings shut.' },
  { id: 'collapse', weight: 3, minNight: 1, text: 'The floor gives way.' },
  { id: 'chill', weight: 2, minNight: 1, text: 'A cold draught: −2 Steps.' },
  { id: 'rubble', weight: 2, minNight: 1, text: 'Rubble slides into your plans.' },
  { id: 'whisper', weight: 2, minNight: 1, text: 'Whispers: your next 2 drafts show 1 fewer card.' },
  { id: 'toll', weight: 2, minNight: 2, text: 'The goal grows hungrier: +1.' },
  { id: 'shift', weight: 2, minNight: 2, text: 'A room turns on its foundations.' },
];

// ---------- Mystery events ----------
// Each option: { label, need?: (s) => bool, run: (ctx) => void }
export const EVENTS = [
  { id: 'trunk', icon: '🧳', title: 'A Locked Trunk', text: 'Brass corners. A keyhole worn smooth.',
    options: [
      { label: 'Open it (1 🗝️): choose an Heirloom', need: (s) => s.res.keys >= 1, run: (c) => { c.gain('keys', -1); c.queue('heirloom'); } },
      { label: 'Kick it: 50% +4 💎, else −2 👣', run: (c) => { if (c.rand() < 0.5) c.gain('gems', 4); else c.gain('steps', -2); } },
    ] },
  { id: 'draught', icon: '🌬️', title: 'An Open Window', text: 'Night air pours in. Somewhere, a door creaks.',
    options: [
      { label: 'Breathe it in: +4 👣, +3 Dread', run: (c) => { c.gain('steps', 4); c.dread(3); } },
      { label: 'Close it: −3 Dread', run: (c) => c.dread(-3) },
    ] },
  { id: 'portrait', icon: '🖼️', title: 'The Portrait Gallery', text: 'Painted eyes follow you. One frame hangs crooked.',
    options: [
      { label: 'Straighten it: +5 🪙', run: (c) => c.gain('coins', 5) },
      { label: 'Look behind it: a Rare room joins your deck', run: (c) => c.addRandom(1, (r) => r.rarity === 'rare') },
    ] },
  { id: 'gambler', icon: '🎩', title: 'A Gentleman Caller', text: '"Double or nothing?" He shuffles a worn deck.',
    options: [
      { label: 'Bet 3 🪙: 50% win 8', need: (s) => s.res.coins >= 3, run: (c) => { c.gain('coins', -3); if (c.rand() < 0.5) c.gain('coins', 8); } },
      { label: 'Decline politely: +1 🎲', run: (c) => c.gain('rerolls', 1) },
    ] },
  { id: 'steward', icon: '🫖', title: 'Tea with the Steward', text: '"Some plans are best forgotten," he says, pouring.',
    options: [
      { label: 'Burn your 2 worst cards', run: (c) => c.burn(2) },
      { label: 'Ask for directions: goal −1', run: (c) => c.goalDelta(-1) },
    ] },
  { id: 'chandelier', icon: '💡', title: 'A Swaying Chandelier', text: 'Crystal tinkles overhead. The chain groans.',
    options: [
      { label: 'Run under it: −2 👣', run: (c) => c.gain('steps', -2) },
      { label: 'Pry out a crystal: +3 💎, +4 Dread', run: (c) => { c.gain('gems', 3); c.dread(4); } },
    ] },
  { id: 'nursery', icon: '🧸', title: 'A Music Box', text: 'It plays a lullaby you almost remember.',
    options: [
      { label: 'Listen: −5 Dread', run: (c) => c.dread(-5) },
      { label: 'Wind it fully: +2 👣, +1 🗝️', run: (c) => { c.gain('steps', 2); c.gain('keys', 1); } },
    ] },
  { id: 'map', icon: '🗺️', title: 'A Torn Floorplan', text: 'Half a map, in your grandfather’s hand.',
    options: [
      { label: 'Study it: your next 3 drafts show +1 card', run: (c) => c.buff('extraDraw', 3) },
      { label: 'Follow it: your next 2 drafts are free', run: (c) => c.buff('freeDraft', 2) },
    ] },
  { id: 'mirror', icon: '🪞', title: 'A Tall Mirror', text: 'Your reflection is a step behind.',
    options: [
      { label: 'Step through: +1 Heirloom choice, +5 Dread', run: (c) => { c.queue('heirloom'); c.dread(5); } },
      { label: 'Cover it: −2 Dread, +2 🪙', run: (c) => { c.dread(-2); c.gain('coins', 2); } },
    ] },
];

// ---------- Landings (between Nights) ----------
export const LANDINGS = [
  { id: 'rest', icon: '🛏️', name: 'Guest Bedroom', text: '+6 Steps next Night.', run: (s) => { s.carryBonus += 6; } },
  { id: 'shop', icon: '🛍️', name: 'Night Market', text: 'Open a shop. You also get 4 🪙.', run: (s) => { s.res.coins += 4; s.queue.push('shop'); } },
  { id: 'study', icon: '🔥', name: 'Furnace', text: 'Burn your 3 worst cards.', run: (s, h) => { h.burn(3); } },
  { id: 'trophy', icon: '🏆', name: 'Trophy Case', text: 'Choose an Heirloom.', run: (s) => { s.queue.push('heirloom'); } },
  { id: 'archive', icon: '🗄️', name: 'Plan Chest', text: 'Add a Rare and an Uncommon room to your deck.',
    run: (s, h) => { h.addRandom(1, (r) => r.rarity === 'rare'); h.addRandom(1, (r) => r.rarity === 'uncommon'); } },
  { id: 'smith', icon: '🔧', name: 'Locksmith', text: '+2 Keys, +2 Gems.', run: (s) => { s.res.keys += 2; s.res.gems += 2; } },
  { id: 'chapel', icon: '🕯️', name: 'Quiet Chapel', text: 'Next Night: the house acts 3 Dread later.', run: (s) => { s.calmBonus += 3; } },
];

// ---------- Wings (3+ connected rooms of one family) ----------
export const WINGS = {
  green: { text: '+2 Gems', run: (c) => c.gain('gems', 2) },
  violet: { text: '+2 Steps', run: (c) => c.gain('steps', 2) },
  blue: { text: '+1 Reroll, next draft +1 card', run: (c) => { c.gain('rerolls', 1); c.buff('extraDraw', 1); } },
  amber: { text: 'Next draft is free', run: (c) => c.buff('freeDraft', 1) },
  gold: { text: '+3 Coins', run: (c) => c.gain('coins', 3) },
  crimson: { text: '+3 Gems, +3 Dread', run: (c) => { c.gain('gems', 3); c.dread(3); } },
  ivory: { text: 'Calm: −6 Dread', run: (c) => c.dread(-6) },
};

// ---------- The Steward ----------
export const STEWARD = {
  night1: ['"Mind the floors. They have opinions."', '"The house remembers you. Not fondly."', '"Draft carefully. It is listening."'],
  night2: ['"The second floor. Fewer people come back from here."', '"You may find the stairs… rearranged."'],
  night3: ['"The Vault is close. So is the house’s patience."', '"Last floor. Do try to finish it."'],
  act: ['"Ah. It noticed you."', '"I did warn you."', '"The house is restless tonight."', '"That will have consequences."'],
  wing: ['"A proper wing. Grandfather would approve."', '"Now that is architecture."'],
  mystery: ['"I wouldn’t touch that."', '"Curious. Very curious."'],
  low: ['"You look tired."', '"Your feet are failing you."'],
  clear: ['"The stairs. Well done, I suppose."', '"Up you go."'],
  win: ['"The Vault. After all these years."'],
  lose: ['"The house keeps what it takes."', '"Another one for the walls."', '"Better luck next visit."'],
};

export const STEWARD_STORY = {
  night1: ['The crime scene is upstairs. The house will not make it easy.', 'Someone died here. The rooms have been rearranged since.', 'Build your way up. The evidence is waiting.'],
  night2: ['The second floor. Closer to the truth now.', 'The rooms are shifting. Someone does not want you to arrive.'],
  night3: ['The crime scene is close. So are the answers.', 'Last floor. The locked room is just ahead.'],
  act: ['The house is hiding something.', 'Someone does not want you investigating.', 'The walls are closing ranks.', 'Evidence does not destroy itself.'],
  wing: ['A connected wing. Good for the investigation.', 'That architecture tells a story.'],
  mystery: ['A clue, perhaps.', 'Evidence. Handle it carefully.'],
  low: ['Running out of time, detective.', 'The trail is going cold.'],
  clear: ['Upstairs. The scene is closer.', 'Keep moving. The house will not wait.'],
  win: ['The crime scene. Now — reconstruct what happened.'],
  lose: ['Case closed. Unsolved.', 'The house wins this round, detective.', 'Come back when you are ready to try again.'],
};
