# solmara

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vladexit/solmara/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vladexit/solmara/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMARA is a complete open-world crime game that runs in the browser: a neon coastal city that never sleeps — and never forgives. You are new in town with $60, a borrowed jacket, and a name nobody knows yet. Steal cars, outrun the cops, climb the wanted ladder from 0 to 5 stars, run the 10-Day Contract's 7-mission story chain with Mara Voss, hunt the Golden Token, and take the city for yourself.

Built in proper 3D with Three.js (vendored 0.160.0, fully offline): a dusk city with lit-window buildings, roads with dashed markings and zebra crossings, varied sidewalks, benches, hydrants, bins and grass/plaza plots, 3D cars in three silhouettes and pedestrians who walk, jog and idle, a closer third-person chase camera, and a cinematic title flyover — plus timed deliveries, a ram-the-convoy objective, road-grid police pursuit with roadblocks at wanted 3+, a win screen with run stats, a loading screen, a fuller pause menu, a HUD and minimap, localStorage saves, combat, and original WebAudio radio with 4 stations including dangdut.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Run |
| E | Steal a car / get out of a car |
| Space | Punch |
| F | Dance (the Under Arrest dance when busted) |
| H | Horn |
| R | Change radio station — also works on the title screen |
| M | Mute |
| C | Continue a saved game |
| P / Esc | Pause |

Drag the mouse to look around, scroll to zoom the camera.

## Screenshots

Real in-game renders from the deterministic `?shot=` scenes (seed 1): the cinematic title flyover (`1-start.jpg`), driving the 10-Day Contract through busy Neon Row (`2-play.jpg`, restaged in round 3 for the densest part of town), a three-star police chase (`3-chase.jpg`), and the Under Arrest dance after getting busted (`4-busted.jpg`).

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=nxe4y3cz&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
