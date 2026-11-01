// Balance simulator: node tools/sim.mjs [runs=200] [deckId=standard] [profile=new|vet|max] [deeds=0,3,6,10]
import { newRun } from '../js/engine/engine.js';
import { MANSIONS } from '../js/data/mansions.js';
import { playOut } from './bot.mjs';

const N = Number(process.argv[2] || 200);
const deckId = process.argv[3] || 'standard';
const PROFILES = {
  new: {},
  vet: { upgrades: { stamina: 1, pockets: 1, dice: 1, sight: 1 }, extraCards: ['orchard', 'suite', 'library'] },
  max: { upgrades: { stamina: 2, pockets: 2, dice: 2, sight: 2, keyring: 1, purse: 2, secondwind: 1 },
    extraCards: ['orchard', 'suite', 'library', 'arboretum', 'lift', 'tollhouse'] },
};
const pname = process.argv[4] || 'new';
const profile = PROFILES[pname];
const deeds = (process.argv[5] || '0,5,10').split(',').map(Number);

console.log(`deck=${deckId} runs=${N} profile=${pname}`);
console.log('mansion        deed  win%   N1%   N2%   N3%  avgDrafts  losses(steps/sealed/locked)');
for (const m of MANSIONS) {
  for (const deed of deeds) {
    let wins = 0, drafts = 0;
    const cleared = [0, 0, 0, 0];
    const why = { steps: 0, sealed: 0, locked: 0 };
    for (let i = 0; i < N; i++) {
      const s = playOut(newRun({ seed: `sim-${m.id}-${deed}-${i}`, mansionId: m.id, deed, deckId, ...profile }));
      if (s.result.won) wins++; else why[s.result.why]++;
      for (let k = 1; k <= s.nightsCleared; k++) cleared[k]++;
      drafts += s.drafts;
    }
    const pc = (x) => (100 * x / N).toFixed(0).padStart(5);
    console.log(`${m.name.padEnd(15)}${String(deed).padStart(4)}  ${(100 * wins / N).toFixed(1).padStart(5)} ${pc(cleared[1])} ${pc(cleared[2])} ${pc(cleared[3])}  ${(drafts / N).toFixed(1).padStart(9)}  ${why.steps}/${why.sealed}/${why.locked}`);
  }
}
