# Balance log

Run `node tools/sim.mjs [runs] [deckId]` from `/floorplan`. The greedy bot in `tools/bot.mjs`
heads for the vault by BFS distance, values Chambers when Steps are low and Gardens when short of the toll.
It does not use Archive unlocks, so real players with unlocks should do better.

Targets: Hollow House deed 0 ≈ 25–45%; each deed noticeably harder but not 0% at low deeds; Crooked House ≈ 15–30%.

## v1 (first pass, 300 runs per row)

```
deck=standard runs=300
mansion        deed  win%   avgSteps  avgDrafts  losses(steps/sealed/locked)
Hollow House      0   41.0       2.1       14.8  174/0/3
Hollow House      2   25.3       2.1       13.5  223/1/0
Hollow House      5   19.0       1.7       13.7  240/0/3
Hollow House     10    3.7       0.6       13.6  285/1/3
Crooked House     0   20.7       4.0       18.0  92/72/74
Crooked House     2   10.7       2.3       16.8  137/71/60
Crooked House     5    4.7       2.4       16.3  156/38/92
Crooked House    10    0.3       0.0       15.2  167/48/84
Locked Wing       0   23.0       3.1       18.4  133/35/63
Locked Wing       2   12.3       1.5       16.6  195/27/41
Locked Wing       5    2.3       2.0       16.8  190/28/75
Locked Wing      10    0.0       0.0       15.8  221/16/63
Flooded Manor     0   11.3       1.8       21.0  199/42/25
Flooded Manor     2    7.0       1.0       18.4  241/27/11
Flooded Manor     5    3.0       1.2       18.3  215/40/36
Flooded Manor    10    0.0       0.0       16.6  246/23/31
```

Levers used: starting Steps 16, Vault toll (7/6/7/8 Gems), lock chance by row, per-mansion start bonuses.
Known gaps: median drafts (~14–21) are below the 18–30 target. Deed 10 is close to 0% for the bot.
