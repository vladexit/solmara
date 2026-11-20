// Street races: a one-lap course around Solmara against three AI rivals.
// Drive onto the start pad on Neon Row and the countdown starts — no menu,
// no key. First across the line takes the biggest prize; the rivals are
// fast enough to punish a sloppy line but slower than a tuned player car,
// so the race is winnable and losable. All original: a fictional city, no
// real places, no real brands, no Rockstar content.
import {
  RACE_COLORS, RACE_COURSE, RACE_NAMES, RACE_PRIZES, RACE_START_PAD,
} from './config.js';

export const EVENT_RACE_COUNT = 1024;
export const EVENT_RACE_DONE = 2048;

const PAD_RADIUS2 = 36;
const GATE_RADIUS2 = 100;
const RIVAL_TOP = [19, 21, 23];
const RIVAL_ACCEL = 7;

function clampAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createRace(api) {
  const { random, state } = api;
  const course = RACE_COURSE;

  const race = {
    phase: 'idle',
    countdown: 0,
    lastCount: 0,
    next: 0,
    racers: [],
    position: 1,
    lapTime: 0,
    best: 0,
    wins: 0,
    prize: 0,
    doneTimer: 0,
    results: [],
  };

  function reset() {
    for (const rival of race.racers) {
      const i = state.cars.indexOf(rival.car);
      if (i >= 0) state.cars.splice(i, 1);
    }
    race.phase = 'idle';
    race.countdown = 0;
    race.lastCount = 0;
    race.next = 0;
    race.racers = [];
    race.position = 1;
    race.lapTime = 0;
    race.prize = 0;
    race.doneTimer = 0;
    race.results = [];
  }

  // Next grid waypoint for a car at (x, z) heading for (tx, tz): stay on
  // the roads, turn at the crossing nearest the target, never cut a block.
  function gridStep(x, z, tx, tz) {
    const nearX = Math.abs(x - api.nearestRoadCoord(x)) < 3.5;
    const nearZ = Math.abs(z - api.nearestRoadCoord(z)) < 3.5;
    if (nearX && nearZ) {
      return Math.abs(tx - x) > Math.abs(tz - z) ? { x: tx, z } : { x, z: tz };
    }
    if (nearX) {
      const zr = api.nearestRoadCoord(tz);
      return Math.abs(z - zr) > 6 ? { x, z: zr } : { x: tx, z: zr };
    }
    if (nearZ) {
      const xr = api.nearestRoadCoord(tx);
      return Math.abs(x - xr) > 6 ? { x: xr, z } : { x: xr, z: tz };
    }
    return { x: api.nearestRoadCoord(x), z: api.nearestRoadCoord(z) };
  }

  function spawnRivals() {
    race.racers = [];
    for (let i = 0; i < 3; i += 1) {
      const car = {
        id: 9000 + i,
        kind: 'racer',
        x: RACE_START_PAD.x - 4 + i * 4,
        z: RACE_START_PAD.z - 6 - i * 2,
        heading: 0,
        speed: 0,
        color: RACE_COLORS[i],
        tune: 1,
        axis: 'z',
        coord: 0,
        dir: 1,
        s: 0,
        wheelSpin: 0,
        brake: false,
        lat: 0,
        wobble: 0,
        rammedAt: -99,
        jitter: 0,
        roadblock: false,
      };
      state.cars.push(car);
      race.racers.push({
        name: RACE_NAMES[i],
        car,
        next: 1,
        finished: false,
        finishTime: 0,
        top: RIVAL_TOP[i] + random.range(-0.6, 0.6),
      });
    }
  }

  function removeRivals() {
    for (const rival of race.racers) {
      const i = state.cars.indexOf(rival.car);
      if (i >= 0) state.cars.splice(i, 1);
    }
    race.racers = [];
  }

  function livePosition() {
    const mine = race.next;
    const myGate = course[Math.min(mine, course.length - 1)];
    const myLeft = Math.hypot(myGate.x - state.player.x, myGate.z - state.player.z);
    let ahead = 0;
    for (const rival of race.racers) {
      if (rival.finished) {
        ahead += 1;
        continue;
      }
      if (rival.next > mine) {
        ahead += 1;
        continue;
      }
      if (rival.next === mine) {
        const gate = course[Math.min(rival.next, course.length - 1)];
        const rivalLeft = Math.hypot(gate.x - rival.car.x, gate.z - rival.car.z);
        if (rivalLeft < myLeft) ahead += 1;
      }
    }
    return ahead + 1;
  }

  function driveRival(rival, dt) {
    const car = rival.car;
    if (rival.finished) {
      car.speed = Math.max(0, car.speed - 10 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      car.wheelSpin += car.speed * dt * 1.4;
      return;
    }
    const gate = course[Math.min(rival.next, course.length - 1)];
    const wp = gridStep(car.x, car.z, gate.x, gate.z);
    const want = api.angleTo(car.x, car.z, wp.x, wp.z);
    car.heading += clampAngle(want - car.heading) * Math.min(1, dt * 3.2);
    car.speed += Math.max(-12 * dt, Math.min(RIVAL_ACCEL * dt, rival.top - car.speed));
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    car.wheelSpin += car.speed * dt * 1.4;
    if (api.dist2(car.x, car.z, gate.x, gate.z) < GATE_RADIUS2) {
      rival.next += 1;
      if (rival.next >= course.length) {
        rival.finished = true;
        rival.finishTime = race.lapTime;
        race.results.push({ name: rival.name, time: race.lapTime });
      }
    }
  }

  function startRace(staged) {
    race.phase = staged ? 'racing' : 'countdown';
    race.countdown = staged ? 0 : 3.0;
    race.lastCount = staged ? 0 : 3;
    race.next = 1;
    race.lapTime = 0;
    race.prize = 0;
    race.results = [];
    spawnRivals();
    if (!staged) {
      api.pushFeed('@NeonRowNews', 'Street race on Neon Row! Three rivals, one lap, winner takes the pot.');
    }
  }

  function finishRace() {
    race.phase = 'done';
    race.doneTimer = 3;
    race.position = livePosition();
    const prize = RACE_PRIZES[Math.min(race.position - 1, RACE_PRIZES.length - 1)];
    race.prize = prize;
    state.cash += prize;
    if (race.position === 1) race.wins += 1;
    if (race.best === 0 || race.lapTime < race.best) race.best = race.lapTime;
    race.results.push({ name: 'You', time: race.lapTime });
    race.results.sort((a, b) => a.time - b.time);
    const place = race.position === 1 ? '1st' : race.position === 2 ? '2nd' : race.position === 3 ? '3rd' : '4th';
    api.pushFeed('@NeonRowNews', `Race over — you took ${place} and $${prize}. ${race.position === 1 ? 'Neon Row has a new king.' : 'Rematch at the pad.'}`);
    return EVENT_RACE_DONE;
  }

  function abortRace(why) {
    removeRivals();
    race.phase = 'idle';
    race.next = 0;
    if (why) api.pushFeed('@NeonRowNews', why);
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    let events = 0;
    const p = state.player;

    if (race.phase === 'idle') {
      // Races unlock after a minute in the city, so the title flyover and
      // the screenshot staging never trip one by accident.
      if (state.time < 60) return 0;
      const car = api.playerCar();
      if (!car || p.onFoot) return 0;
      if (api.dist2(car.x, car.z, RACE_START_PAD.x, RACE_START_PAD.z) < PAD_RADIUS2) {
        startRace(false);
      }
      return 0;
    }

    if (race.phase === 'countdown') {
      race.countdown -= dt;
      const whole = Math.ceil(race.countdown);
      if (whole !== race.lastCount && whole > 0) {
        race.lastCount = whole;
        events |= EVENT_RACE_COUNT;
      }
      if (race.countdown <= 0) {
        race.phase = 'racing';
        race.lapTime = 0;
        api.pushFeed('@NeonRowNews', 'GO! One lap, no mercy.');
      }
      return events;
    }

    if (race.phase === 'racing') {
      race.lapTime += dt;
      const car = api.playerCar();
      if (!car || p.onFoot || state.busted || state.won) {
        abortRace('Race abandoned — the driver left the car.');
        return 0;
      }
      for (const rival of race.racers) driveRival(rival, dt);
      const gate = course[Math.min(race.next, course.length - 1)];
      if (api.dist2(car.x, car.z, gate.x, gate.z) < GATE_RADIUS2) {
        race.next += 1;
        if (race.next >= course.length) {
          return finishRace();
        }
      }
      race.position = livePosition();
      return events;
    }

    if (race.phase === 'done') {
      race.doneTimer -= dt;
      for (const rival of race.racers) driveRival(rival, dt);
      if (race.doneTimer <= 0) {
        removeRivals();
        race.phase = 'idle';
        race.next = 0;
      }
      return 0;
    }
    return 0;
  }

  return { state: race, reset, step, startRace };
}
