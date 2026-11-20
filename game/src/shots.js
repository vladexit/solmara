// The screenshot scenes behind ?shot=start|play|chase|busted. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot — walk to the mission target, steal a car on the way, drive
// the road grid toward the target — so the frame is what a short game really
// looks like and the same seed always gives the same frame.
import { GARAGE_POS, RACE_COURSE, RACE_START_PAD, ROAD_COORDS, STEP } from './config.js';
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

// Drive the player's car toward any (tx, tz) on the road grid, reversing
// when wedged. The race and taxi scenes steer with this; the mission
// autopilot above has its own copy for the story shots.
function driveToward(world, reverseTimer, tx, tz) {
  const car = world.state.cars.find((c) => c.kind === 'player');
  const idle = { x: 0, y: 0, run: false, enter: false, punch: false, dance: false };
  if (!car) return idle;
  const wp = routeWaypoint(car.x, car.z, tx, tz);
  const want = Math.atan2(wp.x - car.x, wp.z - car.z);
  const steer = Math.max(-1, Math.min(1, clampAngle(want - car.heading) * 1.6));
  // Wedged against a wall: back up for a second, then try again.
  if (Math.abs(car.speed) < 0.8) reverseTimer.stuck += STEP;
  else reverseTimer.stuck = 0;
  if (reverseTimer.stuck > 2) {
    reverseTimer.stuck = 0;
    reverseTimer.value = 1.2;
  }
  if (reverseTimer.value > 0) {
    reverseTimer.value -= STEP;
    return { x: -steer, y: -1, run: false, enter: false, punch: false, dance: false };
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
  if (name === 'race') {
    // Stage a street race mid-flight: put the player on the Neon Row pad,
    // let the countdown run, then chase the first gates with the rivals.
    const p = world.state.player;
    const car = world.state.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      p.onFoot = false;
      p.carId = car.id;
      car.x = RACE_START_PAD.x;
      car.z = RACE_START_PAD.z;
      car.heading = 0;
      p.x = car.x;
      p.z = car.z;
    }
    world.state.time = 61;
    for (let i = 0; i < 4 / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, false);
    }
    for (let i = 0; i < 8 / STEP; i += 1) {
      const gate = RACE_COURSE[Math.min(world.state.race.next, RACE_COURSE.length - 1)];
      world.step(STEP, driveToward(world, reverseTimer, gate.x, gate.z), false);
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'taxi') {
    // Stage a taxi fare: put the player in a car at a quiet crossing with
    // a waiting passenger five metres away, so the fare is offered and
    // picked up on the first two steps, then run the cab toward the drop.
    const p = world.state.player;
    const car = world.state.cars.find((c) => c.kind === 'parked');
    if (car) {
      car.kind = 'player';
      p.onFoot = false;
      p.carId = car.id;
      car.x = 60;
      car.z = 0;
      car.heading = Math.PI / 2;
      p.x = car.x;
      p.z = car.z;
    }
    world.state.time = 61;
    const ped = world.state.peds.find((q) => q.mode === 'idle') || world.state.peds[0];
    ped.mode = 'idle';
    ped.taxi = false;
    ped.x = 65;
    ped.z = 0;
    for (let i = 0; i < 2 / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, false);
    }
    if (world.state.taxi.fare) {
      for (let i = 0; i < 6 / STEP && world.state.taxi.active; i += 1) {
        const fare = world.state.taxi.fare;
        world.step(STEP, driveToward(world, reverseTimer, fare.dx, fare.dz), false);
      }
    }
    return { screen: SCREEN_PLAY };
  }
  if (name === 'packages') {
    // Stage a package pickup: put the player on foot beside the first
    // hidden package, step once, and the counter ticks to 1.
    const p = world.state.player;
    const spot = world.state.packages.spots[0];
    p.x = spot.x + 1;
    p.z = spot.z;
    world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false }, false);
    return { screen: SCREEN_PLAY };
  }
  if (name === 'garage') {
    // Stage Mara's shop: walk the player to the garage door and open it.
    const p = world.state.player;
    p.x = GARAGE_POS.x + 2;
    p.z = GARAGE_POS.z + 2;
    world.state.time = 61;
    world.step(STEP, { x: 0, y: 0, run: false, enter: false, punch: false, dance: false, garage: true }, false);
    return { screen: SCREEN_PLAY };
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
