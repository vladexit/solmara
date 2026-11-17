// The game's rules and state, with no drawing and no browser in it: the player on
// foot and by car, traffic, pedestrians, police, the wanted level, the 7-mission
// story, the Golden Token and the fake social feed. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound. The city layout (buildings, trees,
// lamps, signs) is generated once from the seed and never changes.
import {
  BLOCK, BUILDING_MAX_H, CAR_ACCEL, CAR_MAX_SPEED, CAR_REVERSE, CAR_TURN,
  CITY_HALF, FEED_POOL, MISSIONS, PITCH, POLICE_SPEED, ROAD, ROAD_COORDS,
  RUN_SPEED, START_CASH, TOKEN_SPOT, WALK_SPEED,
} from './config.js';

export const EVENT_MISSION = 1;
export const EVENT_BUSTED = 2;
export const EVENT_TOKEN = 4;
export const EVENT_WANTED = 8;
export const EVENT_CASH = 16;
export const EVENT_PUNCH = 32;
export const EVENT_WIN = 64;

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
  const city = { buildings, trees, lamps, signs };

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
    stats: { stolen: 0, punches: 0, missionsDone: 0 },
  };

  let carSeq = 0;
  function makeCar(kind, x, z, heading, color) {
    return {
      id: carSeq++, kind, x, z, heading, speed: 0, color,
      // traffic lane-following
      axis: 'x', coord: nearestRoadCoord(z), dir: 1, s: x,
      wheelSpin: 0, brake: false,
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
    state.hint = '';
    state.hintTimer = 0;
    state.token = { x: TOKEN_SPOT.x, z: TOKEN_SPOT.z, taken: false };
    state.feed = [];
    state.stats = { stolen: 0, punches: 0, missionsDone: 0 };
    const p = state.player;
    p.x = 24; p.z = 40; p.heading = Math.PI; p.speed = 0;
    p.onFoot = true; p.carId = -1; p.walkPhase = 0; p.punchTimer = 0; p.danceTimer = 0; p.moving = false;
    // Parked cars, including the red coupe for the Chapter 2 mission.
    state.cars = [
      makeCar('parked', 60, -14, 0, 0xd83a3a),
      makeCar('parked', -58, 26, Math.PI / 2, 0x3a6fd8),
      makeCar('parked', 122, -58, -Math.PI / 2, 0xe0a53a),
      makeCar('parked', -122, -122, 0, 0xd8d8e0),
      makeCar('parked', 178, 122, Math.PI, 0x3ad8a0),
      makeCar('parked', 26, 178, Math.PI / 2, 0x222226),
      makeCar('parked', -178, 58, 0, 0x8a5ad8),
      makeCar('parked', 58, 122, -Math.PI / 2, 0xd8d8d8),
    ];
    // Traffic: lane followers on the road grid.
    for (let i = 0; i < 14; i += 1) {
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
    // Pedestrians on the sidewalks.
    state.peds = [];
    for (let i = 0; i < 18; i += 1) {
      const bx = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
      const bz = ROAD_COORDS[random.int(0, ROAD_COORDS.length - 2)];
      state.peds.push({
        x: bx + ROAD / 2 + 2 + random.range(0, BLOCK),
        z: bz + ROAD / 2 + 2 + random.range(0, BLOCK),
        heading: random.range(0, Math.PI * 2),
        speed: random.range(1.2, 2.2),
        color: PED_COLORS[random.int(0, PED_COLORS.length - 1)],
        mode: 'walk', fleeTimer: 0, tx: 0, tz: 0, walkPhase: random.range(0, 6),
        downTimer: 0,
      });
    }
    state.police = [];
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
      if (car.axis === 'x') {
        car.x = car.s;
        car.z = car.coord + (car.dir > 0 ? 3.5 : -3.5);
        car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.z = car.s;
        car.x = car.coord + (car.dir > 0 ? 3.5 : -3.5);
        car.heading = car.dir > 0 ? 0 : Math.PI;
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
      } else {
        // Walk toward a sidewalk waypoint; pick a new one on arrival.
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
        ped.walkPhase += dt * 7;
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

  function stepPolice(dt) {
    const p = state.player;
    const pcar = playerCar();
    const px = p.onFoot ? p.x : (pcar ? pcar.x : p.x);
    const pz = p.onFoot ? p.z : (pcar ? pcar.z : p.z);
    const want = state.wanted === 0 ? 0 : state.wanted <= 1 ? 1 : state.wanted <= 2 ? 2 : state.wanted <= 3 ? 3 : 4;
    while (state.police.length < want) {
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
    }
    while (state.police.length > want) {
      const car = state.police.pop();
      const i = state.cars.indexOf(car);
      if (i >= 0) state.cars.splice(i, 1);
    }
    let near = false;
    for (const car of state.police) {
      const a = angleTo(car.x, car.z, px, pz);
      car.heading += clampAngle(a - car.heading) * Math.min(1, dt * 2.2);
      const target = POLICE_SPEED + state.wanted * 0.8;
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
        // Driving: y = throttle, x = steering.
        if (input.y > 0) car.speed += CAR_ACCEL * dt;
        else if (input.y < 0) car.speed -= (car.speed > 0.5 ? CAR_ACCEL * 1.4 : CAR_REVERSE) * dt;
        else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
        car.speed = Math.max(-CAR_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
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
        }
        car.x = fixed.x;
        car.z = fixed.z;
        car.x = clampCity(car.x);
        car.z = clampCity(car.z);
        p.x = car.x;
        p.z = car.z;
        p.heading = car.heading;
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
        if (d < 8) {
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
  }

  reset();
  return {
    state, reset, step, respawnAfterBusted, applySave,
    currentMission, missionTarget, nearestParkedCar,
  };
}
