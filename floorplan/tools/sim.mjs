// Balance simulator: node floorplan/tools/sim.mjs [runs=400] [deckId=standard]
import { newRun } from '../js/engine/engine.js';
import { MANSIONS } from '../js/data/mansions.js';
import { playOut } from './bot.mjs';

const N = Number(process.argv[2] || 400);
const deckId = process.argv[3] || 'standard';
const deeds = [0, 2, 5, 10];

console.log(`deck=${deckId} runs=${N}`);
console.log('mansion        deed  win%   avgSteps  avgDrafts  losses(steps/sealed/locked)');
for (const m of MANSIONS) {
  for (const deed of deeds) {
    let wins = 0, steps = 0, drafts = 0;
    const why = { steps: 0, sealed: 0, locked: 0 };
    for (let i = 0; i < N; i++) {
      const s = playOut(newRun({ seed: `sim-${m.id}-${deed}-${i}`, mansionId: m.id, deed, deckId }));
      if (s.result.won) { wins++; steps += s.res.steps; } else why[s.result.why]++;
      drafts += s.drafts;
    }
    console.log(
      `${m.name.padEnd(15)}${String(deed).padStart(4)}  ${(100 * wins / N).toFixed(1).padStart(5)}  `
      + `${(wins ? steps / wins : 0).toFixed(1).padStart(8)}  ${(drafts / N).toFixed(1).padStart(9)}  `
      + `${why.steps}/${why.sealed}/${why.locked}`,
    );
  }
}
