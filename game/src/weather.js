// Weather: a day/night cycle and rolling rain fronts over Solmara. One
// full day takes four minutes of play: dawn, noon, golden hour, night.
// Rain cuts the car's grip by up to a quarter and darkens the streets;
// a storm front brings lightning over the bay. The clock starts mid-morning
// so the first minutes keep the game's dusk look. All original: a fictional
// city, no real places or brands.
import { WEATHER_DAY_SECONDS } from './config.js';

export const EVENT_THUNDER = 32768;

const RAIN_RAMP = 0.12;
const FRONT_MIN = 25;
const FRONT_SPREAD = 25;
const GAP_MIN = 90;
const GAP_SPREAD = 70;

export function createWeather(api) {
  const { random, state } = api;

  const weather = {
    clock: 0.35,
    daylight: 0.92,
    raining: false,
    rain: 0,
    storm: false,
    nextFront: 90,
    frontTimer: 0,
    frontTarget: 0,
    lightning: 0,
    flashTimer: 0,
    day: 1,
    grip: 1,
    golden: false,
  };

  function daylightAt(clock) {
    // Noon (clock 0.25) is full light, midnight (0.75) is darkest, dawn and
    // dusk sit in between — the city's dusk look is the middle of the curve.
    return 0.2 + 0.8 * (0.5 + 0.5 * Math.cos(2 * Math.PI * (clock - 0.25)));
  }

  function clockLabel() {
    const hours = (6 + weather.clock * 24) % 24;
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  function label() {
    const when = weather.daylight > 0.55 ? 'DAY' : 'NIGHT';
    if (weather.storm && weather.raining) return `STORM ${clockLabel()}`;
    if (weather.raining) return `RAIN ${clockLabel()}`;
    return `${when} ${clockLabel()}`;
  }

  function reset() {
    weather.clock = 0.35;
    weather.daylight = daylightAt(0.35);
    weather.raining = false;
    weather.rain = 0;
    weather.storm = false;
    weather.nextFront = 90;
    weather.frontTimer = 0;
    weather.frontTarget = 0;
    weather.lightning = 0;
    weather.flashTimer = 0;
    weather.day = 1;
    weather.grip = 1;
    weather.golden = false;
  }

  function startFront() {
    weather.raining = true;
    weather.frontTarget = 0.4 + random.next() * 0.6;
    weather.storm = weather.frontTarget > 0.8;
    weather.frontTimer = FRONT_MIN + random.next() * FRONT_SPREAD;
    weather.nextFront = GAP_MIN + random.next() * GAP_SPREAD;
    if (weather.storm) {
      api.pushFeed('@NeonRowNews', 'Storm over the Marina. Lightning over the bay — grip is gone.');
    } else {
      api.pushFeed('@NeonRowNews', 'Rain over Neon Row. The streets shine, the grip does not.');
    }
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    let events = 0;

    weather.clock += dt / WEATHER_DAY_SECONDS;
    if (weather.clock >= 1) {
      weather.clock -= 1;
      weather.day += 1;
      weather.golden = false;
      api.pushFeed('@NeonRowNews', `Day ${weather.day} in Solmara. The city never sleeps.`);
    }
    weather.daylight = daylightAt(weather.clock);

    // Golden hour: the one feed post a day when the neon wakes up.
    if (weather.clock >= 0.45 && weather.clock < 0.55 && !weather.golden) {
      weather.golden = true;
      api.pushFeed('@NeonRowNews', 'Golden hour over Solmara. The neon wakes up.');
    }
    if (weather.clock < 0.4 || weather.clock >= 0.6) weather.golden = false;

    // Rain fronts roll in, soak the city, roll out.
    weather.nextFront -= dt;
    if (weather.nextFront <= 0 && !weather.raining) startFront();
    if (weather.raining) {
      weather.rain += Math.max(-RAIN_RAMP * dt, Math.min(RAIN_RAMP * dt, weather.frontTarget - weather.rain));
      weather.frontTimer -= dt;
      if (weather.frontTimer <= 0) {
        weather.raining = false;
        weather.frontTarget = 0;
        api.pushFeed('@NeonRowNews', 'The rain lets up. The streets steam.');
      }
    } else {
      weather.rain += Math.max(-RAIN_RAMP * dt, Math.min(RAIN_RAMP * dt, 0 - weather.rain));
    }
    weather.grip = 1 - 0.25 * weather.rain;

    // Lightning during a storm: a flash, then a rumble the caller plays.
    if (weather.flashTimer > 0) {
      weather.flashTimer -= dt;
      if (weather.flashTimer <= 0) weather.lightning = 0;
    } else if (weather.storm && weather.raining && random.next() < dt * 0.12) {
      weather.lightning = 1;
      weather.flashTimer = 0.12;
      events |= EVENT_THUNDER;
    }
    return events;
  }

  return { state: weather, reset, step, label };
}
