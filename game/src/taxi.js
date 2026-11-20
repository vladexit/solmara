// Taxi work: pick up a waiting passenger, drive them to the marker, get
// paid by distance with a bonus for a fast trip. Fares appear once the
// player has a car; the waiting passenger stands still until collected.
// A fast trip earns five stars, a slow one four — keep the average at
// 4.8 or better over five jobs and the city calls you a five-star driver.
// All original: a fictional city, no real places or brands.
import { TAXI_BASE_FARE, TAXI_PER_METER } from './config.js';

export const EVENT_TAXI_PICKUP = 4096;
export const EVENT_TAXI_DROPOFF = 8192;

const PICKUP_RADIUS2 = 36;
const DROP_RADIUS2 = 100;
const OFFER_RANGE2 = 3600;
const FAST_TRIP_SECONDS = 45;
const NEXT_OFFER_SECONDS = 15;
const NO_PED_RETRY_SECONDS = 8;
const MIN_TRIP_METERS = 120;

export function createTaxi(api) {
  const { state } = api;

  const taxi = {
    fare: null,
    active: false,
    pickupTimer: 0,
    passenger: null,
    rating: 5.0,
    jobs: 0,
    total: 0,
    star: false,
  };

  function reset() {
    taxi.fare = null;
    taxi.active = false;
    taxi.pickupTimer = 0;
    taxi.passenger = null;
    taxi.rating = 5.0;
    taxi.jobs = 0;
    taxi.total = 0;
    taxi.star = false;
  }

  function target() {
    if (!taxi.fare) return null;
    if (taxi.active) return { x: taxi.fare.dx, z: taxi.fare.dz, kind: 'drop' };
    return { x: taxi.fare.ped.x, z: taxi.fare.ped.z, kind: 'pickup' };
  }

  function nearestWaitingPed() {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const ped of state.peds) {
      if (ped.mode !== 'idle' || ped.taxi) continue;
      const d = api.dist2(ped.x, ped.z, p.x, p.z);
      if (d < OFFER_RANGE2 && d < bestD) {
        best = ped;
        bestD = d;
      }
    }
    return best;
  }

  function pickDrop(px, pz) {
    for (let tries = 0; tries < 8; tries += 1) {
      const dx = api.nearestRoadCoord(api.random.range(-90, 90));
      const dz = api.nearestRoadCoord(api.random.range(-90, 90));
      if (Math.hypot(dx - px, dz - pz) > MIN_TRIP_METERS) return { x: dx, z: dz };
    }
    return {
      x: api.nearestRoadCoord(api.random.range(-90, 90)),
      z: api.nearestRoadCoord(api.random.range(-90, 90)),
    };
  }

  function offerFare() {
    const ped = nearestWaitingPed();
    if (!ped) {
      taxi.pickupTimer = NO_PED_RETRY_SECONDS;
      return;
    }
    const drop = pickDrop(ped.x, ped.z);
    ped.taxi = true;
    taxi.fare = { ped, dx: drop.x, dz: drop.z, startedAt: state.time };
    taxi.pickupTimer = 0;
    api.pushFeed('@NeonRowNews', 'A fare is waiting on the corner — follow the marker, driver.');
  }

  function cancelJob(reason) {
    if (taxi.passenger) {
      taxi.passenger.mode = 'walk';
      taxi.passenger.taxi = false;
      taxi.passenger = null;
    } else if (taxi.fare) {
      taxi.fare.ped.taxi = false;
    }
    taxi.fare = null;
    taxi.active = false;
    taxi.pickupTimer = NEXT_OFFER_SECONDS;
    if (reason) api.pushFeed('@NeonRowNews', reason);
  }

  function pickupPassenger() {
    taxi.passenger = taxi.fare.ped;
    taxi.passenger.mode = 'ride';
    taxi.active = true;
    api.pushFeed('@NeonRowNews', 'Passenger in. Take them to the marker — fast is five stars.');
    return EVENT_TAXI_PICKUP;
  }

  function dropoffPassenger() {
    const car = api.playerCar();
    const fare = taxi.fare;
    const tripTime = state.time - fare.startedAt;
    const tripMeters = Math.hypot(fare.dx - fare.ped.x, fare.dz - fare.ped.z);
    let amount = Math.round(TAXI_BASE_FARE + TAXI_PER_METER * tripMeters);
    if (tripTime < FAST_TRIP_SECONDS) amount = Math.round(amount * 1.25);
    const stars = tripTime < FAST_TRIP_SECONDS ? 5 : 4;
    taxi.jobs += 1;
    taxi.rating = (taxi.rating * (taxi.jobs - 1) + stars) / taxi.jobs;
    taxi.total += amount;
    state.cash += amount;
    if (taxi.jobs >= 5 && taxi.rating >= 4.8 && !taxi.star) {
      taxi.star = true;
      api.pushFeed('@NeonRowNews', 'Five-star driver! The city knows your name now.');
    }
    taxi.passenger.mode = 'walk';
    taxi.passenger.taxi = false;
    taxi.passenger = null;
    taxi.fare = null;
    taxi.active = false;
    taxi.pickupTimer = NEXT_OFFER_SECONDS;
    api.pushFeed('@NeonRowNews', `Fare done — $${amount} for the ride. ${stars} stars.`);
    return EVENT_TAXI_DROPOFF;
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    const p = state.player;
    const car = api.playerCar();

    if (!taxi.fare && !taxi.active) {
      // Fares unlock once the player has a car and has been in the city a
      // while, so the opening minutes stay clean.
      if (state.time < 60 || !car || p.onFoot) return 0;
      taxi.pickupTimer -= dt;
      if (taxi.pickupTimer <= 0) offerFare();
      return 0;
    }

    if (!taxi.active) {
      if (!car || p.onFoot) return 0;
      if (api.dist2(car.x, car.z, taxi.fare.ped.x, taxi.fare.ped.z) < PICKUP_RADIUS2) {
        return pickupPassenger();
      }
      return 0;
    }

    // A passenger is riding.
    if (!car || p.onFoot || state.busted) {
      cancelJob('The passenger ran off — the fare is gone.');
      return 0;
    }
    taxi.passenger.x = car.x;
    taxi.passenger.z = car.z;
    if (api.dist2(car.x, car.z, taxi.fare.dx, taxi.fare.dz) < DROP_RADIUS2) {
      return dropoffPassenger();
    }
    return 0;
  }

  return { state: taxi, reset, step, target };
}
