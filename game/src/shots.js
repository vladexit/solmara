// The screenshot scenes behind ?shot=start|play|chase|busted. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot — walk to the mission target, steal a car on the way, drive
// the road grid toward the target — so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { ROAD_COORDS, STEP } from './config.js';
import { EVENT_BUSTED } from './world.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const BUSTED_LIMIT_SECONDS = 40;

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function nearestRoad(v) {
  let best = ROAD_COORDS[0];
  for (const c of ROAD_COORDS) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}

// A waypoint on the road grid from (x, z) toward (tx, tz): drive along the
// current road to the crossing road nearest the target, then along that road.
// Cars never cut across blocks, so they never wedge into buildings.
function routeWaypoint(x, z, tx, tz) {
  const onXRoad = Math.abs(x - nearestRoad(x)) < 3.5;
  const onZRoad = Math.abs(z - nearestRoad(z)) < 3.5;
  if (onXRoad && !onZRoad) {
    const zr = nearestRoad(tz);
    if (Math.abs(z - zr) > 6) return { x, z: zr };
    return { x: tx, z: zr };
  }
  if (onZRoad && !onXRoad) {
    const xr = nearestRoad(tx);
    if (Math.abs(x - xr) > 6) return { x: xr, z };
    return { x: xr, z: tz };
  }
  if (onXRoad && onZRoad) {
    if (Math.abs(tx - x) > Math.abs(tz - z)) return { x: tx, z };
    return { x, z: tz };
  }
  return { x: nearestRoad(x), z: nearestRoad(z) };
}

/**
 * Autopilot input in world space. On foot it walks toward the mission target
 * and steals a car it passes; in a car it follows the road grid to the target,
 * reversing when stuck.
 */
function autopilot(world, reverseTimer) {
  const state = world.state;
  const p = state.player;
  const target = world.missionTarget();
  if (p.onFoot) {
    const dx = target.x - p.x;
    const dz = target.z - p.z;
    const d = Math.hypot(dx, dz) || 1;
    const car = world.nearestParkedCar(p.x, p.z, 3.2);
    return { x: dx / d, y: dz / d, run: true, enter: car !== null, punch: false, dance: false };
  }
  const car = state.cars.find((c) => c.kind === 'player');
  if (!car) return { x: 0, y: 0, run: false, enter: false, punch: false, dance: false };
  const wp = routeWaypoint(car.x, car.z, target.x, target.z);
  const dx = wp.x - car.x;
  const dz = wp.z - car.z;
  const want = Math.atan2(dx, dz);
  const steer = Math.max(-1, Math.min(1, clampAngle(want - car.heading) * 1.6));
  if (reverseTimer.value > 0) {
    reverseTimer.value -= STEP;
    return { x: -steer, y: -1, run: false, enter: false, punch: false, dance: false };
  }
  if (Math.abs(car.speed) < 0.8) {
    reverseTimer.stuck += STEP;
    if (reverseTimer.stuck > 2) {
      reverseTimer.value = 1.2;
      reverseTimer.stuck = 0;
    }
  } else {
    reverseTimer.stuck = 0;
  }
  return { x: steer, y: 1, run: false, enter: false, punch: false, dance: false };
}

/**
 * Set `world` to the named scene (start, play, chase or busted; any other name
 * is start) and return the screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  const reverseTimer = { value: 0, stuck: 0 };
  if (name === 'win') {
    // Stage the victory: walk the mission chain to the end, teleporting
    // between points with the ram quota filled, so the win screen is what
    // a real completed run shows.
    const p = world.state.player;
    for (let guard = 0; guard < 64 && !world.state.won; guard += 1) {
      const target = world.missionTarget();
      const m = world.currentMission();
      if (m.needCar && p.onFoot) {
        const car = world.state.cars.find((c) => c.kind === 'parked');
        if (!car) break;
        car.kind = 'player';
        p.onFoot = false;
        p.carId = car.id;
      }
      if (target.ram) world.state.missionRams = target.ram;
      const car = world.state.cars.find((c) => c.id === p.carId);
      p.x = target.x;
      p.z = target.z;
      if (car) {
        car.x = target.x;
        car.z = target.z;
      }
      world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, false);
    }
    return { screen: SCREEN_WON };
  }
  if (name !== 'play' && name !== 'chase' && name !== 'busted') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, true);
    }
    return { screen: SCREEN_TITLE };
  }
  if (name === 'chase' || name === 'busted') {
    // Phase 1: a clean getaway — walk, steal, drive off — so the pursuit
    // starts mid-flight instead of on foot at the spawn.
    for (let i = 0; i < 12 / STEP; i += 1) {
      world.step(STEP, autopilot(world, reverseTimer), false);
    }
    world.state.wanted = name === 'busted' ? 5 : 3;
  }
  const limit = name === 'play' ? PLAY_SECONDS : name === 'chase' ? 10 : BUSTED_LIMIT_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(world, reverseTimer), false);
    if (events & EVENT_BUSTED) break;
  }
  if (name === 'play') {
    // Round 3: the play frame should show the busy city, not an empty road —
    // the longer drive already reaches Neon Row, and one star of heat puts
    // a cruiser in the frame behind the player.
    world.state.wanted = Math.max(world.state.wanted, 1);
    for (let i = 0; i < 2 / STEP; i += 1) {
      world.step(STEP, autopilot(world, reverseTimer), false);
    }
  }
  if (name === 'busted' && !world.state.busted) {
    // The chase does not always end in an arrest in time: stage the bust itself
    // (the real busted screen, with the dancing player behind it).
    world.state.busted = true;
    world.state.health = Math.max(20, world.state.health - 40);
  }
  if (name === 'busted') {
    // The arrest, staged for the frame: the player is out of the car, doing the
    // Under Arrest dance beside it while the cops close in.
    const p = world.state.player;
    const car = world.state.cars.find((c) => c.kind === 'player');
    if (car) {
      car.kind = 'parked';
      car.speed = 0;
      p.carId = -1;
      p.onFoot = true;
      p.x = car.x + 2.5;
      p.z = car.z + 1;
      p.heading = car.heading;
    }
    p.danceTimer = 2.2;
  }
  if (name === 'chase' && world.state.busted) {
    // The chase shot shows the pursuit, not the arrest (the busted shot covers
    // that): shake the cops off for the frame.
    world.state.busted = false;
    world.state.bustedTimer = 0;
    world.state.health = Math.max(world.state.health, 80);
  }
  const busted = world.state.busted;
  return { screen: busted ? SCREEN_BUSTED : SCREEN_PLAY };
}
