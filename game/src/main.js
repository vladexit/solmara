// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, the 3D city syncs and the HUD updates. The game moves between
// four screens: title, play, paused and busted.
//
// ?seed=N fixes the city. ?shot=start|play|chase|busted (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CASH, EVENT_CRASH, EVENT_MISSION, EVENT_MISSION_FAIL, EVENT_PUNCH, EVENT_RAM, EVENT_TOKEN, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM, ACTION_CONTINUE, ACTION_DANCE, ACTION_ENTER, ACTION_HORN, ACTION_MUTE,
  ACTION_PAUSE, ACTION_PUNCH, ACTION_RADIO, createInput,
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
const city = createCity(canvas, world.state, () => world.missionTarget());
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
    return `Chapter ${s.missionIndex + 1}/7 · $${s.cash} · ${s.wanted === 0 ? 'clean' : `wanted ${s.wanted}`} · ${mins}:${String(secs).padStart(2, '0')} in the city · ${audio.stationName()}`;
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
    const actions = firstStep ? queuedActions : 0;
    queuedActions = 0;
    const wish = worldWish();
    const events = world.step(STEP, {
      x: wish.x,
      y: wish.y,
      run: wish.run,
      enter: Boolean(actions & ACTION_ENTER),
      punch: Boolean(actions & ACTION_PUNCH),
      dance: Boolean(actions & ACTION_DANCE),
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
    return {
      stationName: audio.stationName(),
      muted: audio.isMuted(),
      speedKmh: car ? Math.round(Math.abs(car.speed) * 3.6) : 0,
      inCar: !p.onFoot,
      prompt: nearCar
        ? 'Press E to steal the car'
        : p.onFoot
          ? 'WASD move · Shift run · E steal car · Space punch · F dance'
          : 'WASD drive · E get out · Space punch · F dance · R radio',
      target: world.missionTarget(),
      objective: missionObjective(),
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
    audio.update(STEP, car ? car.speed : 0, world.state.wanted);
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
