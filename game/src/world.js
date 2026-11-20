// The game's rules and state, with no drawing and no browser in it: the player on
// foot and by car, traffic, pedestrians, police, the wanted level, the 7-mission
// story, the Golden Token and the fake social feed. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. The city layout (buildings, trees,
// lamps, signs) is generated once from the seed and never changes.
import {
  BLOCK, BUILDING_MAX_H, CAR_ACCEL, CAR_MAX_SPEED, CAR_REVERSE, CAR_TURN,
  CITY_HALF, FEED_POOL, MISSIONS, PED_COUNT, PITCH, POLICE_SPEED,
  POLICE_TOP_SPEED, ROAD, ROAD_COORDS, RUN_SPEED, START_CASH, TOKEN_SPOT,
  TRAFFIC_COUNT, WALK_SPEED,
} from './config.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_TOKEN = 4;
export const EVENT_WANTED = 8;
export const EVENT_CASH = 16;
export const EVENT_PUNCH = 32;
export const EVENT_WIN = 64;
export const EVENT_MISSION_FAIL = 128;
export const EVENT_RAM = 256;
export const EVENT_CRASH = 512;

const CAR_COLORS = [0xd8d8e0, 0x3a6fd8, 0xd83a3a, 0x3ad8a0, 0xe0a53a, 0x8a5ad8, 0x222226, 0xd8d8d8];
const PED_COLORS = [0xe0a53a, 0x3a6fd8, 0xd83a7a, 0x3ad8a0, 0xe8e8e8, 0x8a5ad8, 0x5ad8d8];

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function angleTo(x1, z1, x2, z2) {
  return Math.atan2(x2 - x1, z2 - z1);
}
function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
function nearestRoadCoord(v) {
  let best = ROAD_COORDS[0];
  for (const c of ROAD_COORDS) if (Math.abs(v - c) < Math.abs(v - best)) best = c;
  return best;
}

export function createWorld(random) {
  // ---- city layout, generated once from the seed ----
  const buildings = [];
  const trees = [];
  const lamps = [];
  const signs = [];
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz += 1) {
      const x0 = ROAD_COORDS[ix] + ROAD / 2 + 2;
      const z0 = ROAD_COORDS[iz] + ROAD / 2 + 2;
      const cx = (x0 + x0 + BLOCK) / 2;
      const cz = (z0 + z0 + BLOCK) / 2;
      const downtown = 1 - Math.hypot(cx, cz) / 320;
      // The central plaza stays open (Plaza Chest, home of the Golden Token).
      if (ix === 3 && iz === 3) {
        trees.push({ x: cx - 14, z: cz - 12 });
        trees.push({ x: cx + 14, z: cz + 10 });
        trees.push({ x: cx + 10, z: cz - 14 });
        continue;
      }
      // The marina corner is open water-side promenade.
      if (ix === 0 && iz === 6) {
        for (let t = 0; t < 6; t += 1) trees.push({ x: x0 + 4 + t * 7, z: z0 + 6 });
        continue;
      }
      const count = random.int(1, 3);
      for (let b = 0; b < count; b += 1) {
        const w = random.range(14, 26);
        const d = random.range(14, 26);
        const bx = random.range(x0 + 2, x0 + BLOCK - 2 - w);
        const bz = random.range(z0 + 2, z0 + BLOCK - 2 - d);
        const h = 8 + Math.max(0, downtown) * 26 + random.range(0, 10);
        buildings.push({
          x: bx, z: bz, w, d, h: Math.min(h, BUILDING_MAX_H),
          cx: bx + w / 2, cz: bz + d / 2, seed: buildings.length,
        });
      }
    }
  }
  // Street lamps along every road, palms on the sidewalks.
  for (const c of ROAD_COORDS) {
    for (let s = -180; s <= 180; s += 36) {
      lamps.push({ x: s, z: c + ROAD / 2 + 1.5 });
      lamps.push({ x: c + ROAD / 2 + 1.5, z: s });
      if (random.next() < 0.5) trees.push({ x: s + 8, z: c - ROAD / 2 - 2 });
    }
  }
  // Neon billboards: original names only.
  signs.push({ x: 0, z: -193, y: 26, w: 60, h: 10, text: 'SOLMARA', color: '#ff2e88' });
  signs.push({ x: 60, z: -52, y: 18, w: 34, h: 7, text: 'NEON ROW', color: '#22e6ff' });
  signs.push({ x: -120, z: 52, y: 14, w: 30, h: 6, text: 'TURBO GYM', color: '#ffe14d' });
  signs.push({ x: 120, z: 68, y: 16, w: 34, h: 7, text: "MOMO'S CIRCUS", color: '#ff5a3c' });
  signs.push({ x: -60, z: -128, y: 12, w: 44, h: 7, text: 'SAME SPOT, YEARS APART', color: '#7dff5a' });
  signs.push({ x: 180, z: -68, y: 15, w: 30, h: 6, text: 'MARA\u2019S GARAGE', color: '#ff2e88' });
  // Ground fill, round 3: the blocks were bare concrete. Props sit on the
  // 2 m sidewalk band between the road edge and the block (never inside a
  // building footprint), and grass/plaza plots break up the flat ground.
  const props = [];
  const plots = [];
  for (let ix = 0; ix < ROAD_COORDS.length - 1; ix += 1) {
    for (let iz = 0; iz < ROAD_COORDS.length - 1; iz += 1) {
      const x0 = ROAD_COORDS[ix] + ROAD / 2;
      const z0 = ROAD_COORDS[iz] + ROAD / 2;
      const cx = x0 + BLOCK / 2;
      const cz = z0 + BLOCK / 2;
      // The central plaza: grass plots and benches around the Golden Token.
      if (ix === 3 && iz === 3) {
        plots.push({ x: cx - 16, z: cz - 16, w: 12, h: 9, kind: 'grass' });
        plots.push({ x: cx + 4, z: cz - 16, w: 12, h: 9, kind: 'grass' });
        plots.push({ x: cx - 16, z: cz + 7, w: 12, h: 9, kind: 'grass' });
        plots.push({ x: cx + 4, z: cz + 7, w: 12, h: 9, kind: 'grass' });
        plots.push({ x: cx - 8, z: cz - 8, w: 16, h: 16, kind: 'plaza' });
        props.push({ x: cx - 18, z: cz, kind: 'bench', rot: Math.PI / 2 });
        props.push({ x: cx + 18, z: cz, kind: 'bench', rot: -Math.PI / 2 });
        props.push({ x: cx, z: cz - 18, kind: 'bench', rot: 0 });
        props.push({ x: cx, z: cz + 18, kind: 'bench', rot: Math.PI });
        continue;
      }
      // The marina corner: a promenade plot with benches facing the water.
      if (ix === 0 && iz === 6) {
        plots.push({ x: cx - 18, z: cz - 6, w: 36, h: 12, kind: 'plaza' });
        props.push({ x: cx - 12, z: cz + 8, kind: 'bench', rot: Math.PI });
        props.push({ x: cx + 12, z: cz + 8, kind: 'bench', rot: Math.PI });
        continue;
      }
      // A random block sometimes gets a small grass plot.
      if (random.next() < 0.22) {
        plots.push({ x: cx - 5 + random.range(-8, 8), z: cz - 4 + random.range(-8, 8), w: 10, h: 8, kind: 'grass' });
      }
      // Benches on the west sidewalk band, hydrants on corners, bins by benches.
      if (random.next() < 0.55) {
        const bx = x0 + 1;
        const bz = z0 + 4 + random.range(0, BLOCK - 8);
        props.push({ x: bx, z: bz, kind: 'bench', rot: Math.PI / 2 });
        if (random.next() < 0.6) props.push({ x: bx + 1.5, z: bz + 3, kind: 'bin', rot: 0 });
      }
      if (random.next() < 0.35) {
        props.push({ x: x0 + 1, z: z0 + 1, kind: 'hydrant', rot: 0 });
      }
      if (random.next() < 0.3) {
        props.push({ x: x0 + BLOCK - 1, z: z0 + BLOCK - 1, kind: 'hydrant', rot: 0 });
      }
    }
  }
  const city = { buildings, trees, lamps, signs, props, plots };

  // ---- dynamic state ----
  const state = {
    city,
    time: 0,
    cash: START_CASH,
    health: 100,
    wanted: 0,
    crimeTimer: 99,
    busted: false,
    bustedTimer: 0,
    won: false,
    missionIndex: 0,
    missionPoint: 0,
    missionTimer: 0,
    missionRams: 0,
    hint: '',
    hintTimer: 0,
    token: { x: TOKEN_SPOT.x, z: TOKEN_SPOT.z, taken: false },
    feed: [],
    player: {
      x: 24, z: 40, heading: Math.PI, speed: 0, onFoot: true, carId: -1,
      walkPhase: 0, punchTimer: 0, danceTimer: 0, moving: false,
    },
    cars: [],
    peds: [],
    police: [],
    stats: { stolen: 0, punches: 0, missionsDone: 0, rams: 0 },
  };

  let carSeq = 0;
  function makeCar(kind, x, z, heading, color) {
    return {
      id: carSeq++, kind, x, z, heading, speed: 0, color,
      // Round 3: every car handles a little differently — a stolen coupe is
      // never quite the same car twice.
      tune: 0.9 + random.range(0, 0.25),
      // traffic lane-following
      axis: 'x', coord: nearestRoadCoord(z), dir: 1, s: x,
      wheelSpin: 0, brake: false,
      // Ram feedback: lateral shove and wobble decay back to the lane.
      lat: 0, wobble: 0, rammedAt: -99,
      // Police extras: a per-car speed jitter and the roadblock flag.
      jitter: random.range(-1, 1), roadblock: false,
    };
  }
  // The player's car, looked up by id: array indices shift when police despawn.
  function playerCar() {
    const p = state.player;
    return p.carId < 0 ? null : state.cars.find((c) => c.id === p.carId) || null;
  }

  function pushFeed(who, text) {
    state.feed.unshift({ who, text, t: state.time });
    if (state.feed.length > 5) state.feed.length = 5;
  }
  function ambientFeed() {
    const line = FEED_POOL[Math.floor(random.next() * FEED_POOL.length)];
    pushFeed(line[0], line[1]);
  }

  function reset() {
    carSeq = 0;
    state.time = 0;
    state.cash = START_CASH;
    state.health = 100;
    state.wanted = 0;
    state.crimeTimer = 99;
    state.busted = false;
    state.bustedTimer = 0;
    state.won = false;
    state.missionIndex = 0;
    state.missionPoint = 0;
    state.missionTimer = 0;
    state.missionRams = 0;
    state.hint = '';
    state.hintTimer = 0;
    state.token = { x: TOKEN_SPOT.x, z: TOKEN_SPOT.z, taken: false };
    state.feed = [];
    state.stats = { stolen: 0, punches: 0, missionsDone: 0, rams: 0 };
    const p = state.player;
    p.x = 24; p.z = 40; p.heading = Math.PI; p.speed = 0;
    p.onFoot = true; p.carId = -1; p.walkPhase = 0; p.punchTimer = 0; p.danceTimer = 0; p.moving = false;
    // Parked cars, including the red coupe for the Chapter 2 mission. The
    // row is shuffled per seed so the street never parks the same way twice.
    const parkedSpots = random.shuffle([
      [60, -14, 0, 0xd83a3a],
      [-58, 26, Math.PI / 2, 0x3a6fd8],
      [122, -58, -Math.PI / 2, 0xe0a53a],
      [-122, -122, 0, 0xd8d8e0],
      [178, 122, Math.PI, 0x3ad8a0],
      [26, 178, Math.PI / 2, 0x222226],
      [-178, 58, 0, 0x8a5ad8],
      [58, 122, -Math.PI / 2, 0xd8d8d8],
      [-62, -58, 0, 0xd8d8e0],
      [118, 62, Math.PI, 0x3a6fd8],
      [-182, 118, Math.PI / 2, 0xe0a53a],
      [182, -122, -Math.PI / 2, 0x8a5ad8],
      [-118, 178, 0, 0x3ad8a0],
      [62, 182, Math.PI, 0xd83a3a],
    ]);
    state.cars = parkedSpots.map(([x, z, heading, color]) => makeCar('parked', x, z, heading, color));
    // Traffic: lane followers on the road grid.
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const axis = random.next() < 0.5 ? 'x' : 'z';
      const coord = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 1)];
      const dir = random.next() < 0.5 ? 1 : -1;
      const s = random.range(-180, 180);
      const car = makeCar('traffic', axis === 'x' ? s : coord + (dir > 0 ? 3.5 : -3.5), axis === 'x' ? coord + (dir > 0 ? 3.5 : -3.5) : s, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), CAR_COLORS[random.int(0, CAR_COLORS.length - 1)]);
      car.axis = axis;
      car.coord = coord;
      car.dir = dir;
      car.s = s;
      car.speed = random.range(7, 11);
      state.cars.push(car);
    }
    // Pedestrians on the sidewalks: walkers, joggers and idlers standing
    // around chatting, so the street reads as lived-in instead of a parade.
    state.peds = [];
    for (let i = 0; i < PED_COUNT; i += 1) {
      const bx = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
      const bz = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
      const roll = random.next();
      const mode = roll < 0.6 ? 'walk' : roll < 0.85 ? 'jog' : 'idle';
      state.peds.push({
        x: bx + ROAD / 2 + 2 + random.range(0, BLOCK),
        z: bz + ROAD / 2 + 2 + random.range(0, BLOCK),
        heading: random.range(0, Math.PI * 2),
        speed: mode === 'jog' ? random.range(3.2, 4.4) : random.range(1.2, 2.2),
        color: PED_COLORS[random.int(0, PED_COLORS.length - 1)],
        mode, fleeTimer: 0, tx: 0, tz: 0, walkPhase: random.range(0, 6),
        downTimer: 0,
      });
    }
    state.police = [];
    enterPoint();
    pushFeed('@NeonRowNews', 'Welcome to Solmara. New in town? Mara Voss is waiting at the garage.');
  }

  // Circle (x, z, r) pushed out of every building AABB. Returns true if it hit one.
  function collideBuildings(x, z, r) {
    let hit = false;
    for (const b of buildings) {
      const cx = Math.max(b.x, Math.min(x, b.x + b.w));
      const cz = Math.max(b.z, Math.min(z, b.z + b.d));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        const d = Math.sqrt(d2) || 0.001;
        const push = (r - d) / d;
        x += dx * push;
        z += dz * push;
      }
    }
    return { x, z, hit };
  }
  function clampCity(v) {
    return Math.max(-CITY_HALF, Math.min(CITY_HALF, v));
  }

  function nearestParkedCar(x, z, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.kind !== 'parked') continue;
      const d = dist2(x, z, car.x, car.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function currentMission() {
    return MISSIONS[Math.min(state.missionIndex, MISSIONS.length - 1)];
  }
  function missionTarget() {
    const m = currentMission();
    return m.points[Math.min(state.missionPoint, m.points.length - 1)];
  }

  // Arm the current point: a timed point starts its countdown, a ram point
  // starts its counter at zero. Called whenever the mission or point changes.
  function enterPoint() {
    const target = missionTarget();
    state.missionTimer = target.timeLimit || 0;
    state.missionRams = 0;
  }

  function addWanted(n, events) {
    if (state.wanted < 5) {
      state.wanted = Math.min(5, state.wanted + n);
      state.crimeTimer = 0;
      return events | EVENT_WANTED;
    }
    state.crimeTimer = 0;
    return events;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      // Slow down for a car ahead in the same lane.
      let ahead = Infinity;
      for (const other of state.cars) {
        if (other === car || other.kind === 'parked') continue;
        if (other.axis !== car.axis || other.coord !== car.coord || other.dir !== car.dir) continue;
        const gap = (other.s - car.s) * car.dir;
        if (gap > 0 && gap < ahead) ahead = gap;
      }
      const want = ahead < 9 ? 0 : 9;
      car.speed += Math.max(-14 * dt, Math.min(6 * dt, want - car.speed));
      car.s += car.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing road.
      const cross = nearestRoadCoord(car.s);
      if (Math.abs(car.s - cross) < 1 && random.next() < 0.004) {
        const oldAxis = car.axis;
        car.axis = oldAxis === 'x' ? 'z' : 'x';
        car.coord = cross;
        car.dir = random.next() < 0.5 ? 1 : -1;
        car.s = oldAxis === 'x' ? car.z : car.x;
      }
      if (car.s > 195) { car.s = -195; }
      if (car.s < -195) { car.s = 195; }
      // A rammed car slides sideways and wobbles back onto its lane.
      car.lat *= Math.max(0, 1 - 2.2 * dt);
      car.wobble *= Math.max(0, 1 - 2.5 * dt);
      if (car.axis === 'x') {
        car.x = car.s;
        car.z = car.coord + (car.dir > 0 ? 3.5 : -3.5) + car.lat;
        car.heading = (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) + car.wobble;
      } else {
        car.z = car.s;
        car.x = car.coord + (car.dir > 0 ? 3.5 : -3.5) + car.lat;
        car.heading = (car.dir > 0 ? 0 : Math.PI) + car.wobble;
      }
      car.wheelSpin += car.speed * dt * 1.4;
    }
  }

  function stepPeds(dt, playerCar) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.downTimer > 0) {
        ped.downTimer -= dt;
        continue;
      }
      if (ped.mode === 'flee') {
        ped.fleeTimer -= dt;
        const a = angleTo(p.x, p.z, ped.x, ped.z);
        ped.heading = a;
        ped.x += Math.sin(a) * 6.5 * dt;
        ped.z += Math.cos(a) * 6.5 * dt;
        ped.walkPhase += dt * 14;
        if (ped.fleeTimer <= 0) ped.mode = 'walk';
      } else if (ped.mode === 'idle') {
        // Standing around chatting: slow turn, occasional small step.
        ped.heading += dt * 0.4;
        ped.walkPhase += dt * 1.5;
        if (random.next() < 0.002) ped.mode = 'walk';
      } else {
        // Walk or jog toward a sidewalk waypoint; pick a new one on arrival.
        if (Math.hypot(ped.tx - ped.x, ped.tz - ped.z) < 2 || (ped.tx === 0 && ped.tz === 0)) {
          const bx = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
          const bz = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
          ped.tx = bx + ROAD / 2 + 2 + random.range(0, BLOCK);
          ped.tz = bz + ROAD / 2 + 2 + random.range(0, BLOCK);
        }
        const a = angleTo(ped.x, ped.z, ped.tx, ped.tz);
        ped.heading += clampAngle(a - ped.heading) * Math.min(1, dt * 4);
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        ped.walkPhase += dt * (ped.mode === 'jog' ? 12 : 7);
      }
      const fixed = collideBuildings(ped.x, ped.z, 0.6);
      ped.x = fixed.x;
      ped.z = fixed.z;
      ped.x = clampCity(ped.x);
      ped.z = clampCity(ped.z);
      // A fast car hitting a pedestrian knocks them down.
      const car = playerCar;
      if (car && Math.abs(car.speed) > 3 && dist2(car.x, car.z, ped.x, ped.z) < 6) {
        ped.downTimer = 3;
        ped.mode = 'walk';
      }
    }
  }

  // A waypoint on the road grid from (x, z) toward (tx, tz): drive along the
  // current road to the crossing road nearest the target, then along that road.
  // Police use it to chase through the grid instead of beelining through blocks.
  function roadWaypoint(x, z, tx, tz) {
    const onXRoad = Math.abs(x - nearestRoadCoord(x)) < 3.5;
    const onZRoad = Math.abs(z - nearestRoadCoord(z)) < 3.5;
    if (onXRoad && !onZRoad) {
      const zr = nearestRoadCoord(tz);
      if (Math.abs(z - zr) > 6) return { x, z: zr };
      return { x: tx, z: zr };
    }
    if (onZRoad && !onXRoad) {
      const xr = nearestRoadCoord(tx);
      if (Math.abs(x - xr) > 6) return { x: xr, z };
      return { x: xr, z: tz };
    }
    if (onXRoad && onZRoad) {
      if (Math.abs(tx - x) > Math.abs(tz - z)) return { x: tx, z };
      return { x, z: tz };
    }
    return { x: nearestRoadCoord(x), z: nearestRoadCoord(z) };
  }

  function stepPolice(dt) {
    const p = state.player;
    const pcar = playerCar();
    const px = p.onFoot ? p.x : (pcar ? pcar.x : p.x);
    const pz = p.onFoot ? p.z : (pcar ? pcar.z : p.z);
    const want = state.wanted === 0 ? 0 : state.wanted <= 1 ? 1 : state.wanted <= 2 ? 2 : state.wanted <= 3 ? 3 : 4;
    const chasers = state.police.filter((c) => !c.roadblock);
    while (chasers.length < want) {
      const axis = random.next() < 0.5 ? 'x' : 'z';
      const coord = nearestRoadCoord(axis === 'x' ? pz : px);
      const dir = random.next() < 0.5 ? 1 : -1;
      const s = (axis === 'x' ? px : pz) + dir * random.range(45, 70);
      const car = makeCar('police', axis === 'x' ? s : coord, axis === 'x' ? coord : s, 0, 0x1a2a6b);
      car.axis = axis;
      car.coord = coord;
      car.dir = dir;
      car.s = s;
      car.speed = POLICE_SPEED;
      state.police.push(car);
      state.cars.push(car);
      chasers.push(car);
    }
    while (chasers.length > want) {
      const car = chasers.pop();
      let i = state.police.indexOf(car);
      if (i >= 0) state.police.splice(i, 1);
      i = state.cars.indexOf(car);
      if (i >= 0) state.cars.splice(i, 1);
    }
    // Roadblocks at wanted 3+: two parked cruisers across the road ahead of
    // the player, so a straight-line escape runs into a wall. They vanish
    // once the heat drops.
    const blocks = state.police.filter((c) => c.roadblock);
    if (state.wanted >= 3) {
      while (blocks.length < 2) {
        const ahead = 45 + blocks.length * 14;
        const ax = px + Math.sin(p.heading) * ahead;
        const az = pz + Math.cos(p.heading) * ahead;
        const onXRoad = Math.abs(pz - nearestRoadCoord(pz)) < Math.abs(px - nearestRoadCoord(px));
        const coord = nearestRoadCoord(onXRoad ? pz : px);
        const bx = onXRoad ? ax : coord + (blocks.length === 0 ? -3.5 : 3.5);
        const bz = onXRoad ? coord + (blocks.length === 0 ? -3.5 : 3.5) : az;
        const car = makeCar('police', clampCity(bx), clampCity(bz), onXRoad ? 0 : Math.PI / 2, 0x1a2a6b);
        car.roadblock = true;
        car.speed = 0;
        state.police.push(car);
        state.cars.push(car);
        blocks.push(car);
      }
    } else {
      for (const car of blocks) {
        let i = state.police.indexOf(car);
        if (i >= 0) state.police.splice(i, 1);
        i = state.cars.indexOf(car);
        if (i >= 0) state.cars.splice(i, 1);
      }
    }
    let near = false;
    for (const car of state.police) {
      if (car.roadblock) {
        const d = Math.hypot(car.x - px, car.z - pz);
        if (d < 6) near = true;
        continue;
      }
      // Chase through the road grid: steer at the next grid waypoint, not at
      // the player through buildings.
      const wp = roadWaypoint(car.x, car.z, px, pz);
      const a = angleTo(car.x, car.z, wp.x, wp.z);
      car.heading += clampAngle(a - car.heading) * Math.min(1, dt * 3.2);
      // Wanted 4-5: the police are faster than the player's car.
      const target = (state.wanted >= 4 ? POLICE_TOP_SPEED : POLICE_SPEED + state.wanted * 0.8) + car.jitter;
      car.speed += Math.max(-18 * dt, Math.min(10 * dt, target - car.speed));
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      const fixed = collideBuildings(car.x, car.z, 1.9);
      car.x = fixed.x;
      car.z = fixed.z;
      car.x = clampCity(car.x);
      car.z = clampCity(car.z);
      car.wheelSpin += car.speed * dt * 1.4;
      const d = Math.hypot(car.x - px, car.z - pz);
      if (d < 6) {
        near = true;
        // Ramming the player damages them and slows their car.
        if (!p.onFoot && pcar) {
          state.health = Math.max(0, state.health - 5 * dt);
          pcar.speed *= 1 - 0.4 * dt;
        }
      }
    }
    if (near) state.bustedTimer += dt;
    else state.bustedTimer = Math.max(0, state.bustedTimer - dt * 2);
    return near;
  }

  // input: {x, y} screen wish (-1..1, y forward), run, enter, punch, dance.
  // The caller has already rotated the wish by the camera yaw into world space.
  function step(dt, input, attract) {
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (state.hintTimer > 0) {
      state.hintTimer -= dt;
      if (state.hintTimer <= 0) state.hint = '';
    }

    const car = playerCar();

    if (!attract) {
      // ---- player ----
      if (p.onFoot) {
        const speed = input.run ? RUN_SPEED : WALK_SPEED;
        const moving = Math.hypot(input.x, input.y) > 0.1;
        p.moving = moving;
        if (moving) {
          const targetHeading = Math.atan2(input.x, input.y);
          p.heading += clampAngle(targetHeading - p.heading) * Math.min(1, dt * 12);
          p.x += Math.sin(p.heading) * speed * dt;
          p.z += Math.cos(p.heading) * speed * dt;
          p.walkPhase += dt * 11;
        }
        const fixed = collideBuildings(p.x, p.z, 0.6);
        p.x = fixed.x;
        p.z = fixed.z;
        p.x = clampCity(p.x);
        p.z = clampCity(p.z);
        if (p.punchTimer > 0) p.punchTimer -= dt;
        if (p.danceTimer > 0) p.danceTimer -= dt;
        if (input.punch && p.punchTimer <= 0) {
          p.punchTimer = 0.45;
          events |= EVENT_PUNCH;
          state.stats.punches += 1;
          // A punch landing on a nearby pedestrian: they drop cash and run.
          for (const ped of state.peds) {
            if (ped.downTimer <= 0 && dist2(p.x, p.z, ped.x, ped.z) < 5.3) {
              ped.mode = 'flee';
              ped.fleeTimer = 3;
              if (random.next() < 0.35) {
                state.cash += 15;
                events |= EVENT_CASH;
              }
              events = addWanted(1, events);
              pushFeed('@NeonRowNews', 'Someone just got punched on Neon Row. Solmara, never change.');
              break;
            }
          }
        }
        if (input.dance && p.danceTimer <= 0) {
          p.danceTimer = 2.2;
          pushFeed('@MomoCircus', 'The Bicep Heart pose, live on Neon Row. The crowd goes wild.');
        }
        if (input.enter) {
          const near = nearestParkedCar(p.x, p.z, 4);
          if (near) {
            p.onFoot = false;
            p.carId = near.id;
            near.kind = 'player';
            state.stats.stolen += 1;
            state.hint = '';
            state.hintTimer = 0;
            events = addWanted(1, events);
            pushFeed('@SirHonksALot', 'Someone just took a car on Neon Row. Not mine. Probably.');
          }
        }
      } else if (car) {
        // Driving: y = throttle, x = steering. Each stolen car is tuned a
        // little differently, so the top speed is the car's, not the city's.
        const maxSpeed = CAR_MAX_SPEED * (car.tune || 1);
        if (input.y > 0) car.speed += CAR_ACCEL * dt;
        else if (input.y < 0) car.speed -= (car.speed > 0.5 ? CAR_ACCEL * 1.4 : CAR_REVERSE) * dt;
        else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
        car.speed = Math.max(-CAR_REVERSE, Math.min(maxSpeed, car.speed));
        const steer = input.x * CAR_TURN * Math.min(1, Math.abs(car.speed) / 8);
        car.heading += steer * Math.sign(car.speed) * dt;
        car.x += Math.sin(car.heading) * car.speed * dt;
        car.z += Math.cos(car.heading) * car.speed * dt;
        car.wheelSpin += car.speed * dt * 1.4;
        car.brake = input.y < 0 && car.speed > 0.5;
        const fixed = collideBuildings(car.x, car.z, 1.9);
        if (fixed.hit && Math.abs(car.speed) > 6) {
          car.speed *= 0.4;
          state.health = Math.max(0, state.health - 2);
          events |= EVENT_CRASH;
        }
        car.x = fixed.x;
        car.z = fixed.z;
        car.x = clampCity(car.x);
        car.z = clampCity(car.z);
        p.x = car.x;
        p.z = car.z;
        p.heading = car.heading;
        // Ramming traffic: a fast hit shoves the other car sideways, slows
        // you down, and counts toward a ram objective when one is current.
        if (Math.abs(car.speed) > 4) {
          for (const other of state.cars) {
            if (other.kind !== 'traffic' || other === car) continue;
            if (state.time - other.rammedAt < 2) continue;
            if (dist2(car.x, car.z, other.x, other.z) < 7) {
              other.rammedAt = state.time;
              other.lat = random.next() < 0.5 ? 3 : -3;
              other.wobble = random.next() < 0.5 ? 0.5 : -0.5;
              other.speed *= 0.4;
              car.speed *= 0.75;
              events |= EVENT_RAM;
              state.stats.rams += 1;
              const target = missionTarget();
              if (!state.won && target.ram) {
                state.missionRams += 1;
                if (state.missionRams >= target.ram) {
                  state.hint = 'Convoy smashed. Grab the cash!';
                  state.hintTimer = 3;
                }
              }
            }
          }
          // A roadblock is a wall, not a bump: hitting one stops the car.
          for (const block of state.police) {
            if (!block.roadblock) continue;
            if (dist2(car.x, car.z, block.x, block.z) < 10) {
              car.speed *= 0.3;
              state.health = Math.max(0, state.health - 3);
              events |= EVENT_CRASH;
              const push = angleTo(block.x, block.z, car.x, car.z);
              car.x += Math.sin(push) * 1.2;
              car.z += Math.cos(push) * 1.2;
            }
          }
        }
        if (input.enter) {
          // Get out beside the car.
          p.onFoot = true;
          p.x = car.x + Math.cos(car.heading) * 2.5;
          p.z = car.z - Math.sin(car.heading) * 2.5;
          car.kind = 'parked';
          car.speed = 0;
          p.carId = -1;
        }
      }
      // A fast car hitting a pedestrian is a crime.
      if (car && Math.abs(car.speed) > 3) {
        for (const ped of state.peds) {
          if (ped.downTimer > 0) continue;
          if (dist2(car.x, car.z, ped.x, ped.z) < 6) {
            events = addWanted(1, events);
            break;
          }
        }
      }

      // ---- missions ----
      if (!state.won) {
        const target = missionTarget();
        const px = p.x;
        const pz = p.z;
        const d = Math.hypot(target.x - px, target.z - pz);
        // A timed point runs its clock down; missing the deadline fails the
        // mission back to its first point and costs $50.
        let failed = false;
        if (target.timeLimit && state.missionTimer > 0) {
          state.missionTimer -= dt;
          if (state.missionTimer <= 0) {
            state.missionTimer = 0;
            state.missionPoint = 0;
            state.cash = Math.max(0, state.cash - 50);
            state.hint = 'Too slow — the deal moved on. Mara gives you one more shot.';
            state.hintTimer = 4;
            events |= EVENT_MISSION_FAIL;
            pushFeed('@MaraVoss', 'Clock ran out. The city does not wait. Run it again.');
            enterPoint();
            failed = true;
          }
        }
        // A ram point clears only when enough escort cars are smashed near it.
        const ramDone = !target.ram || state.missionRams >= target.ram;
        const closeEnough = target.ram ? d < 14 : d < 8;
        if (!failed && ramDone && closeEnough) {
          const m = currentMission();
          if (m.needCar && p.onFoot) {
            state.hint = 'You need a car for this. Press E beside one to take it.';
            state.hintTimer = 2;
          } else {
            if (target.wanted) {
              state.wanted = Math.max(state.wanted, target.wanted);
              events |= EVENT_WANTED;
            }
            state.missionPoint += 1;
            if (state.missionPoint >= m.points.length) {
              state.cash += m.reward;
              state.missionIndex += 1;
              state.missionPoint = 0;
              state.stats.missionsDone += 1;
              events |= EVENT_MISSION | EVENT_CASH;
              pushFeed('@MaraVoss', m.arrive);
              if (state.missionIndex >= MISSIONS.length) {
                state.won = true;
                events |= EVENT_WIN;
                pushFeed('@NeonRowNews', 'THE BIG SCORE! Someone just took the vault. Solmara has a new name.');
              }
            }
            enterPoint();
          }
        }
      }

      // ---- Golden Token ----
      if (!state.token.taken && dist2(p.x, p.z, state.token.x, state.token.z) < 9) {
        state.token.taken = true;
        state.cash += 500;
        events |= EVENT_TOKEN | EVENT_CASH;
        pushFeed('@StaticNoodle', 'GOLDEN TOKEN FOUND! The shop is free tonight. I am first in line.');
      }

      // ---- wanted decay ----
      state.crimeTimer += dt;
      if (state.wanted > 0 && state.crimeTimer > 25) {
        let nearest = Infinity;
        for (const cop of state.police) nearest = Math.min(nearest, Math.hypot(cop.x - p.x, cop.z - p.z));
        if (nearest > 60) {
          state.wanted -= 1;
          state.crimeTimer = 0;
          events |= EVENT_WANTED;
        }
      }
      // Slow health regen while clean.
      if (state.wanted === 0 && state.health > 0 && state.health < 100) {
        state.health = Math.min(100, state.health + 2 * dt);
      }
    }

    stepTraffic(dt);
    stepPeds(dt, car);
    const policeNear = stepPolice(dt);

    // Busted: a cop sat on the player, or health ran out.
    if (!attract && !state.busted && (state.bustedTimer > 2.2 || state.health <= 0)) {
      state.busted = true;
      events |= EVENT_BUSTED;
      pushFeed('@NeonRowNews', 'BUSTED on Neon Row. And yes, they did the dance.');
    }
    // Ambient feed chatter, slow enough to stay readable.
    if (!attract && state.time > 0 && Math.floor(state.time) % 23 === 0 && Math.floor((state.time - dt)) % 23 !== 0) {
      ambientFeed();
    }
    return events;
  }

  function respawnAfterBusted() {
    const lost = Math.floor(state.cash * 0.1);
    state.cash -= lost;
    state.health = 100;
    state.wanted = 0;
    state.busted = false;
    state.bustedTimer = 0;
    const p = state.player;
    const pcar = playerCar();
    if (pcar) {
      pcar.kind = 'parked';
      pcar.speed = 0;
    }
    p.onFoot = true;
    p.carId = -1;
    p.x = -176;
    p.z = -60;
    p.heading = 0;
    p.danceTimer = 2.2;
    pushFeed('@MaraVoss', 'Out already? The cops like you. Get back to work.');
  }

  function applySave(save) {
    if (!save) return;
    state.cash = save.cash ?? START_CASH;
    state.missionIndex = Math.min(save.missionIndex ?? 0, MISSIONS.length - 1);
    state.missionPoint = 0;
    if (save.tokenTaken) state.token.taken = true;
    enterPoint();
  }

  reset();
  return {
    state, reset, step, respawnAfterBusted, applySave,
    currentMission, missionTarget, nearestParkedCar,
  };
}
