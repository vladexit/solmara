// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, the 3D city syncs and the HUD updates. The game moves between
// four screens: title, play, paused and busted.
//
// ?seed=N fixes the city. ?shot=start|play|chase|busted (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP, TAXI_BASE_FARE, TAXI_PER_METER } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ACHIEVEMENT, EVENT_BUSTED, EVENT_CASH, EVENT_CHALLENGE, EVENT_CRASH, EVENT_MISSION, EVENT_MISSION_FAIL, EVENT_NITRO, EVENT_PACKAGE, EVENT_PUNCH, EVENT_RACE_COUNT, EVENT_RACE_DONE, EVENT_RAM, EVENT_TAXI_DROPOFF, EVENT_TAXI_PICKUP, EVENT_THUNDER, EVENT_TOKEN, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_CONTINUE, ACTION_DANCE, ACTION_ENTER, ACTION_GARAGE, ACTION_HORN, ACTION_MUTE,
  ACTION_NITRO, ACTION_PAUSE, ACTION_PUNCH, ACTION_RADIO, createInput,
} from './input.js';
import { createCity } from './city.js';
import { createAudio } from './audio.js';
import { createHud, SCREEN_BUSTED, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
// Taxi work takes the beacon while a fare is live: cyan to the waiting
// passenger, green to the drop-off. Otherwise the mission marker leads.
const city = createCity(canvas, world.state, () => {
  const taxiTarget = world.taxi.target();
  if (taxiTarget && !world.state.won) {
    return { x: taxiTarget.x, z: taxiTarget.z, color: taxiTarget.kind === 'pickup' ? 0x2dd4ff : 0x7dff5a };
  }
  return world.missionTarget();
});
const audio = createAudio();
const hud = createHud({
  cash: document.getElementById('hud-cash'),
  healthBar: document.getElementById('hud-health-bar'),
  wanted: document.getElementById('hud-wanted'),
  wantedLabel: document.getElementById('hud-wanted-label'),
  missionTitle: document.getElementById('hud-mission-title'),
  missionBrief: document.getElementById('hud-mission-brief'),
  objective: document.getElementById('hud-objective'),
  hint: document.getElementById('hud-hint'),
  radio: document.getElementById('hud-radio'),
  speed: document.getElementById('hud-speed'),
  prompt: document.getElementById('hud-prompt'),
  feed: document.getElementById('hud-feed'),
  minimap: document.getElementById('minimap'),
  weatherLine: document.getElementById('hud-weather'),
  raceLine: document.getElementById('hud-race'),
  taxiLine: document.getElementById('hud-taxi'),
  challengeLine: document.getElementById('hud-challenge'),
  achievementLine: document.getElementById('hud-achievements'),
  packageLine: document.getElementById('hud-packages'),
  garageOverlay: document.getElementById('garage-screen'),
  titleOverlay: document.getElementById('title-screen'),
  pausedOverlay: document.getElementById('paused-screen'),
  bustedOverlay: document.getElementById('busted-screen'),
  wonOverlay: document.getElementById('won-screen'),
  winStats: document.getElementById('win-stats'),
  pausedStats: document.getElementById('paused-stats'),
});

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.state.cash,
      missionIndex: world.state.missionIndex,
      tokenTaken: world.state.token.taken,
      // Garage upgrades persist: paint, tunes, armor and neon come back
      // with the next car the player steals.
      garage: world.garage.saveData(),
      // The package hunt persists: found parcels stay found, and paid
      // milestones never pay twice.
      packages: world.packages.saveData(),
    }));
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
}

// The objective line: the live timer on a timed point, the ram count on a
// ram point, nothing otherwise. Module-level so both the live HUD and the
// screenshot staging share it.
function missionObjective() {
  if (world.state.won) return '';
  const target = world.missionTarget();
  if (target.ram) return `CARS RAMMED ${world.state.missionRams}/${target.ram}`;
  if (target.timeLimit && world.state.missionTimer > 0) {
    const t = Math.max(0, Math.ceil(world.state.missionTimer));
    return `TIME LEFT ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  }
  return '';
}

// The race line: the countdown, the live position and lap time, the result,
// or the career record once the player has won one.
function raceLine() {
  const r = world.state.race;
  if (r.phase === 'countdown') return `RACE — ${Math.ceil(r.countdown)}`;
  if (r.phase === 'racing') {
    const mins = Math.floor(r.lapTime / 60);
    const secs = (r.lapTime % 60).toFixed(1);
    return `RACE — POS ${r.position}/4 · ${mins}:${secs.padStart(4, '0')}`;
  }
  if (r.phase === 'done') {
    const place = r.position === 1 ? '1st' : r.position === 2 ? '2nd' : r.position === 3 ? '3rd' : '4th';
    return `RACE DONE — ${place} · $${r.prize}`;
  }
  return r.wins > 0 ? `RACES WON ${r.wins} · BEST ${r.best.toFixed(1)}s` : '';
}

// The taxi line: the live fare with its estimated payout, or the career
// rating once the player has driven a job.
function taxiLine() {
  const t = world.state.taxi;
  if (t.active) {
    const fare = t.fare;
    const est = Math.round(TAXI_BASE_FARE + TAXI_PER_METER * Math.hypot(fare.dx - fare.ped.x, fare.dz - fare.ped.z));
    return `TAXI — drop the passenger · ~$${est}`;
  }
  if (t.fare) return 'TAXI — pick up the fare';
  if (t.jobs > 0) return `TAXI ★${t.rating.toFixed(1)} · ${t.jobs} jobs · $${t.total} earned`;
  return '';
}

function runShot(name) {
  const staged = stageShot(name, world);
  city.setCameraMode('shot', { shot: name });
  hud.showOverlay(staged.screen === SCREEN_TITLE ? 'title' : staged.screen === SCREEN_BUSTED ? 'busted' : staged.screen === SCREEN_WON ? 'won' : null);
  if (staged.screen === SCREEN_WON) hud.showWin(world.state);
  const playerCar = world.state.cars.find((c) => c.kind === 'player');
  const info = {
    stationName: audio.stationName(),
    muted: audio.isMuted(),
    speedKmh: playerCar ? Math.round(Math.abs(playerCar.speed) * 3.6) : 0,
    inCar: !world.state.player.onFoot,
    prompt: '',
    target: world.missionTarget(),
    objective: missionObjective(),
    weatherLine: world.weather.label(),
    raceLine: raceLine(),
    taxiLine: taxiLine(),
    challengeLine: world.challenges.line(),
    achievementLine: world.achievements.line(),
    packageLine: world.packages.line(),
    garage: world.garage.state,
  };
  hud.update(world.state, info);
  let painted = 0;
  function paint() {
    city.sync(STEP);
    city.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else {
      document.getElementById('loading-screen').classList.add('hidden');
      window.__shotReady = true;
    }
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const save = readSave();
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();
  let loadingHidden = false;
  // One-shot presses queued for the next simulation step; handleActions takes
  // them once per frame and step() spends them on its first step.
  let queuedActions = 0;

  function announce(message) {
    status.textContent = message;
  }

  function pauseStats() {
    const s = world.state;
    const mins = Math.floor(s.time / 60);
    const secs = Math.floor(s.time % 60);
    const challengeSummary = world.challenges.summary();
    const achievementSummary = world.achievements.summary();
    return `Chapter ${s.missionIndex + 1}/7 · $${s.cash} · ${s.wanted === 0 ? 'clean' : `wanted ${s.wanted}`} · ${mins}:${String(secs).padStart(2, '0')} in the city · ${audio.stationName()}${s.race.wins > 0 ? ` · ${s.race.wins} race wins` : ''}${s.taxi.jobs > 0 ? ` · taxi ★${s.taxi.rating.toFixed(1)}` : ''}${s.packages.found > 0 ? ` · 📦 ${s.packages.found}/50 packages` : ''}${challengeSummary ? ` · ${challengeSummary}` : ''}${achievementSummary ? ` · ${achievementSummary}` : ''}`;
  }

  function pauseGame() {
    screen = SCREEN_PAUSED;
    hud.showOverlay('paused');
    hud.showPause(pauseStats());
    writeSave();
    announce('Paused.');
  }

  function startGame(continued) {
    world.reset();
    if (continued && save) world.applySave(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    city.setCameraMode('chase');
    hud.showOverlay(null);
    announce('Playing. Follow the mission marker.');
  }

  function showTitle() {
    screen = SCREEN_TITLE;
    city.setCameraMode('title');
    hud.showOverlay('title');
    const cont = document.getElementById('continue-line');
    if (save) {
      cont.textContent = `Save found — Chapter ${save.missionIndex + 1}, $${save.cash}. Press C to continue.`;
      cont.classList.remove('hidden');
    } else {
      cont.classList.add('hidden');
    }
    announce('Solmara. Press Enter to start. R changes the radio station.');
  }

  function handleActions() {
    const actions = input.takeActions();
    queuedActions |= actions;
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (actions & ACTION_RADIO) audio.nextStation();
    if (actions & ACTION_HORN) audio.horn();
    // Mara's shop eats the frame's keys: W/S pick, Enter buys, G closes.
    // The world is paused behind it, so no cop or fare can interrupt.
    if (screen === SCREEN_PLAY && world.garage.state.open) {
      const wish = input.moveWish();
      if (wish.y > 0.5) world.garage.moveSelection(-1);
      else if (wish.y < -0.5) world.garage.moveSelection(1);
      if (actions & ACTION_CONFIRM) {
        const result = world.garage.buySelected();
        if (result === 'bought') audio.buy();
        else audio.fail();
      }
      if (actions & ACTION_GARAGE) {
        world.garage.closeShop();
        // The closing G must not reach the world and reopen the shop.
        queuedActions &= ~ACTION_GARAGE;
      } else if (actions & ACTION_PAUSE) {
        world.garage.closeShop();
        pauseGame();
      }
      return;
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_RADIO) {
        // The station already advanced above; just name it, so the player
        // can pick a station to start with before pressing Enter.
        announce(`Radio: ${audio.stationName()}. Press Enter to start.`);
      } else if (actions & ACTION_CONTINUE && save) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame(false);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) pauseGame();
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        hud.showOverlay(null);
        announce('Playing.');
      }
    } else if (screen === SCREEN_WON) {
      if (actions & ACTION_CONFIRM) {
        // Free roam after the win: the city stays yours.
        screen = SCREEN_PLAY;
        hud.showOverlay(null);
        announce('Free roam. Solmara is yours.');
      }
    } else if (screen === SCREEN_BUSTED) {
      if (actions & ACTION_CONFIRM) {
        world.respawnAfterBusted();
        screen = SCREEN_PLAY;
        hud.showOverlay(null);
        announce('Back on the street. Stay clean.');
      }
    }
  }

  // Keyboard wish (screen space) rotated by the camera yaw into world space.
  // Screen-right is (-cos yaw, sin yaw) and screen-forward is (sin yaw,
  // cos yaw): W walks where the camera looks, D strafes to the camera's right.
  function worldWish() {
    const wish = input.moveWish();
    const yaw = city.cameraYaw();
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    return {
      x: -wish.x * cos + wish.y * sin,
      y: wish.x * sin + wish.y * cos,
      run: wish.run,
    };
  }

  function step(firstStep) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    // The shop pauses the world behind it.
    if (world.garage.state.open) {
      queuedActions = 0;
      return;
    }
    const actions = firstStep ? queuedActions : 0;
    queuedActions = 0;
    const wish = worldWish();
    const racePhaseBefore = world.state.race.phase;
    const events = world.step(STEP, {
      x: wish.x,
      y: wish.y,
      run: wish.run,
      enter: Boolean(actions & ACTION_ENTER),
      punch: Boolean(actions & ACTION_PUNCH),
      dance: Boolean(actions & ACTION_DANCE),
      garage: Boolean(actions & ACTION_GARAGE),
      nitro: Boolean(actions & ACTION_NITRO),
    }, false);
    if (events & EVENT_MISSION) {
      audio.missionDone();
      writeSave();
    }
    if (events & EVENT_TOKEN) audio.blip(880, 1320, 0.12, 0.3);
    else if (events & EVENT_CASH) audio.blip(660, 990, 0.08, 0.2);
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_RAM) audio.crash();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_MISSION_FAIL) audio.fail();
    // Round-3 side systems: the countdown ticks, the green light, the
    // finish fanfare, the taxi meter and the storm rumble.
    if (events & EVENT_RACE_COUNT) audio.countdown();
    if (racePhaseBefore === 'countdown' && world.state.race.phase === 'racing') audio.raceGo();
    if (events & EVENT_RACE_DONE) audio.raceDone();
    if (events & EVENT_TAXI_PICKUP) audio.blip(880, 1108, 0.1, 0.25);
    if (events & EVENT_TAXI_DROPOFF) {
      audio.fare();
      writeSave();
    }
    if (events & EVENT_THUNDER) audio.thunder();
    if (events & EVENT_CHALLENGE) audio.challenge();
    if (events & EVENT_NITRO) audio.boost();
    if (events & EVENT_ACHIEVEMENT) audio.achievement();
    // A hidden package: the pickup chime, and the hunt is saved at once.
    if (events & EVENT_PACKAGE) {
      audio.pickup();
      writeSave();
    }
    if (events & EVENT_WIN) {
      audio.win();
      writeSave();
      screen = SCREEN_WON;
      hud.showWin(world.state);
      hud.showOverlay('won');
      announce('SOLMARA IS YOURS. Press Enter to keep roaming.');
    }
    if (events & EVENT_BUSTED) {
      audio.busted();
      writeSave();
      screen = SCREEN_BUSTED;
      hud.showOverlay('busted');
      announce('Busted. Press Enter to get back on the street.');
    }
  }

  function hudInfo() {
    const p = world.state.player;
    const car = world.state.cars.find((c) => c.kind === 'player');
    const nearCar = p.onFoot ? world.nearestParkedCar(p.x, p.z, 4) : null;
    // Nitro charges show in the driving prompt, so the driver knows the
    // burst is there before the race starts.
    const nitroHint = !p.onFoot && world.garage.state.nitro > 0 ? ` · N nitro x${world.garage.state.nitro}` : '';
    return {
      stationName: audio.stationName(),
      muted: audio.isMuted(),
      speedKmh: car ? Math.round(Math.abs(car.speed) * 3.6) : 0,
      inCar: !p.onFoot,
      prompt: nearCar
        ? 'Press E to steal the car'
        : p.onFoot
          ? 'WASD move · Shift run · E steal car · Space punch · F dance · G garage'
          : `WASD drive · E get out · Space punch · F dance · R radio${nitroHint}`,
      target: world.missionTarget(),
      objective: missionObjective(),
      weatherLine: world.weather.label(),
      raceLine: raceLine(),
      taxiLine: taxiLine(),
      challengeLine: world.challenges.line(),
      achievementLine: world.achievements.line(),
      packageLine: world.packages.line(),
      garage: world.garage.state,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    const drag = input.takeDrag();
    if (drag.dx || drag.dy || drag.wheel) city.applyOrbit(drag.dx, drag.dy, drag.wheel);
    let firstStep = true;
    while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
      step(firstStep);
      firstStep = false;
      accumulator -= STEP;
    }
    if (screen !== SCREEN_TITLE && screen !== SCREEN_PLAY) accumulator = 0;
    const car = world.state.cars.find((c) => c.kind === 'player');
    audio.update(STEP, car ? car.speed : 0, world.state.wanted, world.state.weather.rain);
    city.sync(STEP);
    city.render();
    if (!loadingHidden) {
      loadingHidden = true;
      document.getElementById('loading-screen').classList.add('hidden');
    }
    if (screen !== SCREEN_TITLE) hud.update(world.state, hudInfo());
  }

  // First user gesture unlocks audio.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Leaving the tab pauses a running game.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });

  showTitle();
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
