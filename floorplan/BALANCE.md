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

## v2: bigger pool, easier onboarding (300 runs per row)

Playtest feedback: 0 wins in 7 human runs of Hollow House, so Mansion 1 is now an onboarding level
(toll 5, +2 starting Steps, fewer locks). Decks are now a 28-card core plus 18 rarity-weighted random rooms from the pool.

```
deck=standard runs=300
mansion        deed  win%   avgSteps  avgDrafts  losses(steps/sealed/locked)
Hollow House      0   74.0       6.8       15.4  48/26/4
Hollow House      2   69.7       5.5       13.9  77/13/1
Hollow House      5   66.3       4.7       14.6  85/10/6
Hollow House     10   38.7       2.9       15.7  163/16/5
Crooked House     0   37.7       6.3       16.4  36/113/38
Crooked House     2   33.3       5.3       16.2  61/105/34
Crooked House     5   18.7       4.2       16.5  76/89/79
Crooked House    10   11.3       3.2       15.9  94/101/71
Locked Wing       0   20.7       4.4       19.0  67/113/58
Locked Wing       2   12.3       2.8       18.2  121/89/53
Locked Wing       5    5.0       3.3       17.4  102/89/94
Locked Wing      10    1.3       3.5       16.7  161/84/51
Flooded Manor     0   24.7       4.6       20.4  75/125/26
Flooded Manor     2   17.3       3.2       19.4  130/97/21
Flooded Manor     5    8.7       3.5       19.4  148/75/51
Flooded Manor    10    2.7       2.8       17.8  163/79/50
```
