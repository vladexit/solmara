// Hidden packages: 50 parcels stashed around Solmara — 42 hand-placed on
// road crossings (a few metres off the corner, on the sidewalk edge) plus
// 8 more dealt by a fixed local shuffle, so the hunt is the same every
// seed and never disturbs the seeded city. Walk or drive within three
// metres to grab one; the HUD counts them and names the next payout, the
// minimap shows the nearest one still out there, and milestones pay at
// 10, 25 and 50 — the last one a grand. All original: a fictional city,
// no real places or brands.
import { PACKAGE_COUNT, PACKAGE_MILESTONES, PACKAGE_RADIUS, PACKAGE_SPOTS, ROAD_COORDS } from './config.js';

export const EVENT_PACKAGE = 524288;

const PICKUP_RADIUS2 = PACKAGE_RADIUS * PACKAGE_RADIUS;
const MIN_SPOT_GAP2 = 144;

// A fixed local shuffle (mulberry32): the extra spots look random but are
// identical every run, and the shared seeded random is never touched, so
// the city layout and the other systems stay exactly as they were.
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The full hunt: the hand-placed spots plus the dealt ones, each at least
// 12 m from any spot already placed, so the parcels spread across the
// whole city instead of bunching on one corner. The dealt spots sit
// mid-block along the roads — one coordinate on a road line, the other
// 20-26 m along it — because only seven crossings lack a hand-placed
// parcel and two draws on one crossing can never clear the 12 m gap.
function buildSpots() {
  const spots = PACKAGE_SPOTS.map((s) => ({ x: s[0], z: s[1], taken: false }));
  const rng = mulberry32(1337);
  let guard = 0;
  while (spots.length < PACKAGE_COUNT && guard < 500) {
    guard += 1;
    const road = ROAD_COORDS[Math.floor(rng() * ROAD_COORDS.length)];
    const mid = ROAD_COORDS[Math.floor(rng() * ROAD_COORDS.length)] + 20 + Math.floor(rng() * 7);
    const jitter = Math.floor(rng() * 7) - 3;
    const x = rng() < 0.5 ? road + jitter : mid;
    const z = x === road + jitter ? mid : road + jitter;
    if (spots.some((s) => (s.x - x) ** 2 + (s.z - z) ** 2 < MIN_SPOT_GAP2)) continue;
    spots.push({ x, z, taken: false });
  }
  return spots;
}

export function createPackages(api) {
  const { state } = api;

  const packages = {
    spots: buildSpots(),
    found: 0,
    paid: [],
  };

  function reset() {
    packages.spots = buildSpots();
    packages.found = 0;
    packages.paid = [];
  }

  function nextMilestone() {
    for (const m of PACKAGE_MILESTONES) if (!packages.paid.includes(m.count)) return m;
    return null;
  }

  // The nearest parcel still out there, with its distance — the HUD's
  // hot/cold compass for the hunt.
  function nearest(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const spot of packages.spots) {
      if (spot.taken) continue;
      const d = (spot.x - x) ** 2 + (spot.z - z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = spot;
      }
    }
    return best ? { x: best.x, z: best.z, dist: Math.sqrt(bestD) } : null;
  }

  // The HUD line: the count, the next payout, and how far the nearest
  // parcel is, so the hunt always has a direction to run in.
  function line() {
    const next = nextMilestone();
    const p = state.player;
    const near = nearest(p.x, p.z);
    const range = near ? ` · nearest ~${Math.round(near.dist)} m` : '';
    if (packages.found === 0) return `📦 0/${PACKAGE_COUNT} packages — 50 hidden around the city${range}`;
    if (!next) return `📦 ${PACKAGE_COUNT}/${PACKAGE_COUNT} · all packages found!`;
    return `📦 ${packages.found}/${PACKAGE_COUNT} · next $${next.reward} at ${next.count}${range}`;
  }

  // The save: which spots are gone and which milestones already paid, so
  // a hunt survives quitting to the title screen.
  function saveData() {
    return {
      taken: packages.spots.map((s, i) => (s.taken ? i : -1)).filter((i) => i >= 0),
      paid: packages.paid.slice(),
    };
  }

  function applySave(data) {
    if (!data) return;
    reset();
    for (const i of data.taken || []) {
      if (packages.spots[i] && !packages.spots[i].taken) {
        packages.spots[i].taken = true;
        packages.found += 1;
      }
    }
    packages.paid = (data.paid || []).filter((c) => PACKAGE_MILESTONES.some((m) => m.count === c));
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    const p = state.player;
    let events = 0;
    // Grab every parcel in reach — on foot or in a car, the player is the
    // player, so the car counts too.
    for (const spot of packages.spots) {
      if (spot.taken) continue;
      if (api.dist2(p.x, p.z, spot.x, spot.z) >= PICKUP_RADIUS2) continue;
      spot.taken = true;
      packages.found += 1;
      events |= EVENT_PACKAGE;
    }
    if (!(events & EVENT_PACKAGE)) return 0;
    if (packages.found === 1) {
      api.pushFeed('@NeonRowNews', 'A hidden package! Someone is stashing parcels all over Solmara.');
    }
    // Milestones pay the moment the count crosses them.
    for (const m of PACKAGE_MILESTONES) {
      if (packages.found >= m.count && !packages.paid.includes(m.count)) {
        packages.paid.push(m.count);
        state.cash += m.reward;
        api.pushFeed('@MaraVoss', `Package milestone — ${m.count} found, $${m.reward} in your pocket.`);
        if (m.count === PACKAGE_COUNT) {
          api.pushFeed('@NeonRowNews', 'ALL 50 PACKAGES FOUND! The city has no more secrets from you.');
        }
      }
    }
    return events;
  }

  return { state: packages, reset, step, line, nearest, saveData, applySave };
}
