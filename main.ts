// SOLMARA 3D: the game in game/ is a Three.js open-world crime game written fresh
// for gta6-01 — a neon coastal city to explore on foot and by car, with traffic,
// police, missions, combat, a HUD with minimap, a save and original WebAudio radio.
// Round 3 filled the empty ground (varied sidewalks, zebra crossings, benches,
// hydrants, bins, grass and plaza plots), pulled the chase camera in, gave the
// cars three silhouettes, added timed deliveries, a ram-the-convoy objective,
// road-grid police pursuit with roadblocks at wanted 3+, a win screen with
// stats, a loading screen and a fuller pause menu — and restaged the play
// screenshot in the busiest part of town.
// A working gta6-01 entry (Node 22, standard library only): the game is this directory's
// game/ folder, plain static files a desktop browser loads offline (game/index.html and its ES
// modules, no library and no network request), and the program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library. Only the plumbing, not an open world: Block
// Dodger, a plain 2D canvas game where a paddle dodges falling blocks and catches coins, with a
// title screen, score, lives and levels, game over and restart, flat colours and no sound. Build
// your own open-world crime game in its place (three.js or any library you vendor under game/),
// put your 3 or 4 PNG or JPEG screenshots in screenshots/ (the first by name is the cover) and run it.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Pre-flight: the dossier refuses more than 4 screenshots or one over 256 KiB,
// so check the set first and fail with the file name instead of a bare cap error.
const shotDir = join(here, 'screenshots');
const shots = existsSync(shotDir) ? readdirSync(shotDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort() : [];
if (shots.length === 0 || shots.length > 4) {
  throw new Error(`main.ts: expected 1-4 screenshots in screenshots/, found ${shots.length}`);
}
for (const shot of shots) {
  const bytes = statSync(join(shotDir, shot)).size;
  if (bytes > 262144) throw new Error(`main.ts: screenshot ${shot} is ${bytes} bytes, over the 256 KiB cap`);
  console.log(`screenshot: ${shot}`);
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
