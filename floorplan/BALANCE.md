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

## v3: meta-progression (300 runs per row)

Feedback: Hollow House shouldn't be trivial; instead repeated failure should make you stronger.
Hollow House is back to toll 6 with no bonus Steps. Growth comes from Upgrades (Ink), kept Blueprints and a chosen starting Heirloom.
`node tools/sim.mjs 300 standard <new|vet|max>` compares a fresh player with an upgraded one.

```
deck=standard runs=300 profile=new
mansion        deed  win%   avgSteps  avgDrafts  losses(steps/sealed/locked)
Hollow House      0   59.7       4.9       16.0  97/17/7
Hollow House      2   57.3       3.6       15.0  114/11/3
Hollow House      5   48.0       3.2       15.2  140/4/12
Hollow House     10   18.0       1.9       15.2  218/16/12
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
deck=standard runs=300 profile=vet
mansion        deed  win%   avgSteps  avgDrafts  losses(steps/sealed/locked)
Hollow House      0   79.0       8.2       14.7  38/23/2
Hollow House      2   81.7       6.9       12.6  45/10/0
Hollow House      5   77.7       6.6       13.5  57/9/1
Hollow House     10   59.0       4.1       15.2  109/11/3
Crooked House     0   53.7      10.0       16.0  16/113/10
Crooked House     2   54.7       8.5       15.1  28/99/9
Crooked House     5   45.0       8.1       16.6  29/98/38
Crooked House    10   39.0       5.6       16.5  47/95/41
Locked Wing       0   38.0       8.1       19.1  28/105/53
Locked Wing       2   37.7       5.9       18.5  58/99/30
Locked Wing       5   28.7       6.6       18.7  63/76/75
Locked Wing      10   16.0       4.1       18.8  109/73/70
Flooded Manor     0   49.0       7.1       20.8  24/117/12
Flooded Manor     2   38.3       5.9       20.3  63/108/14
Flooded Manor     5   35.0       4.9       21.1  69/90/36
Flooded Manor    10   20.7       3.7       19.6  101/111/26
```
