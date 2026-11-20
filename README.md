# solmara

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vladexit/solmara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vladexit/solmara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMARA is a complete open-world crime game that runs in the browser: a neon coastal city that never sleeps — and never forgives. You are new in town with $60, a borrowed jacket, and a name nobody knows yet. Steal cars, outrun the cops, climb the wanted ladder from 0 to 5 stars, run the 10-Day Contract's 7-mission story chain with Mara Voss, hunt the Golden Token, and take the city for yourself.

Built in proper 3D with Three.js (vendored 0.160.0, fully offline): a dusk city with lit-window buildings, roads with dashed markings and zebra crossings, varied sidewalks, benches, hydrants, bins and grass/plaza plots, 3D cars in three silhouettes and pedestrians who walk, jog and idle, a closer third-person chase camera, and a cinematic title flyover — plus timed deliveries, a ram-the-convoy objective, road-grid police pursuit with roadblocks at wanted 3+, a win screen with run stats, a loading screen, a fuller pause menu, a HUD and minimap, localStorage saves, combat, and original WebAudio radio with 4 stations including dangdut.

Round 3 also added four side systems, so the city pays even between missions: **street races** on Neon Row (drive onto the orange pad — one lap against three rivals, prizes up to $500), **Mara's Garage** (walk up to the pink sign and press G: paints, three engine tunes, three armor plates, neon underglow and repairs, all saved), **weather** (a four-minute day/night cycle with golden hour, rain fronts that cut grip, and lightning storms), and **taxi fares** (pick up a waiting passenger, drive them to the marker, get paid by distance with a bonus for a fast trip — five stars at a 4.8 average earns the five-star driver badge). A fifth system, **daily challenges**, deals three rotating cash goals at a time (ram traffic, drive taxi, win races, hold cash, throw punches) and pays out the moment one is done. A seventh, **hidden packages**, stashes 50 parcels around the city — walk or drive within three metres to grab one, follow the minimap dot and the HUD's nearest-package compass, and milestones pay $150 at 10, $400 at 25 and $1,000 at all 50, saved across sessions. Mara also sells **nitro** (three charges a can, press N in a car for a three-second burst of +10 top speed). Ten **achievements** track the run — first race win, first fare, a grand in the pocket, the Golden Token, ten rams, ten punches, five stolen cars, three chapters, three challenges, and the first garage purchase — each posting to the feed the moment it unlocks, with the count on the HUD.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Steal a car / get out of a car |
| Space | Punch |
| F | Dance (the Under Arrest dance when busted) |
| H | Horn |
| G | Open Mara's Garage at the pink sign (W/S pick, Enter buys) |
| N | Nitro boost (needs charges from the garage) |
| R | Change radio station — also works on the title screen |
| M | Mute |
| C | Continue a saved game |
| P / Esc | Pause |

Drag the mouse to look around, scroll to zoom the camera.

## Screenshots

Real in-game renders from the deterministic `?shot=` scenes (seed 1): the cinematic title flyover (`1-start.jpg`), driving the 10-Day Contract through busy Neon Row (`2-play.jpg`, restaged in round 3 for the densest part of town), a three-star police chase (`3-chase.jpg`), and the Under Arrest dance after getting busted (`4-busted.jpg`). The round-3 side systems have their own scenes too: a street race mid-flight (`5-race.jpg`), a taxi fare (`6-taxi.jpg`) and Mara's shop (`7-garage.jpg`).

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=nxe4y3cz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
