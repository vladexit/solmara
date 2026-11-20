// Mara's Garage: a tune shop for the player's car. Walk up to the garage
// and press G — the game pauses into a menu where W/S pick an item and
// Enter buys it. Paints change the car's colour, engine tunes raise its
// top speed, armor plates soften crashes, neon underglow lights the street
// under it, and a full repair puts health back to 100. Upgrades belong to
// the driver, not the car: steal a new ride and Mara tunes that one too.
// All original: a fictional city, no real places or brands.
import { GARAGE_ITEMS, GARAGE_POS, NITRO_MAX_CHARGES } from './config.js';

const NAV_DELAY_MS = 180;

function paintColor(id) {
  for (const item of GARAGE_ITEMS) {
    if (item.kind === 'paint' && item.id === id) return item.color;
  }
  return null;
}

export function createGarage(api) {
  const { state } = api;

  const garage = {
    open: false,
    selected: 0,
    paint: 'stock',
    engine: 0,
    armor: 0,
    neon: false,
    // Nitro charges ride with the driver like the tunes do; the boost timer
    // lives here too, so the world can read both in one place.
    nitro: 0,
    nitroTimer: 0,
    lastNav: 0,
  };

  function reset() {
    garage.open = false;
    garage.selected = 0;
    garage.paint = 'stock';
    garage.engine = 0;
    garage.armor = 0;
    garage.neon = false;
    garage.nitro = 0;
    garage.nitroTimer = 0;
    garage.lastNav = 0;
  }

  function applyToCar(car) {
    if (!car) return;
    car.upgrades = { engine: garage.engine, armor: garage.armor };
    const color = paintColor(garage.paint);
    if (color !== null) car.color = color;
    car.neon = garage.neon;
  }

  function saveData() {
    return {
      paint: garage.paint,
      engine: garage.engine,
      armor: garage.armor,
      neon: garage.neon,
      nitro: garage.nitro,
    };
  }

  function applySave(data) {
    if (!data || typeof data !== 'object') return;
    if (typeof data.paint === 'string') garage.paint = data.paint;
    if (typeof data.engine === 'number') garage.engine = Math.max(0, Math.min(3, data.engine));
    if (typeof data.armor === 'number') garage.armor = Math.max(0, Math.min(3, data.armor));
    garage.neon = data.neon === true;
    if (typeof data.nitro === 'number') garage.nitro = Math.max(0, Math.min(NITRO_MAX_CHARGES, data.nitro));
    applyToCar(api.playerCar());
  }

  function openShop() {
    garage.open = true;
    garage.selected = 0;
    api.pushFeed('@MaraVoss', 'Mara: "My garage, my prices. Cash only, no refunds on taste."');
  }

  function closeShop() {
    garage.open = false;
  }

  function moveSelection(dir) {
    const now = performance.now();
    if (now - garage.lastNav < NAV_DELAY_MS) return;
    garage.lastNav = now;
    const n = GARAGE_ITEMS.length;
    garage.selected = (garage.selected + dir + n) % n;
  }

  function failHint(text) {
    state.hint = text;
    state.hintTimer = 2.5;
  }

  // Returns 'bought', 'poor', 'owned', 'locked', 'maxed' or 'healthy'.
  // The caller plays the sound; the hint line carries the reason.
  function buySelected() {
    const item = GARAGE_ITEMS[garage.selected];
    if (!item) return 'maxed';
    if (state.cash < item.price) {
      failHint(`Not enough cash — ${item.name} costs $${item.price}.`);
      return 'poor';
    }
    if (item.kind === 'paint') {
      if (garage.paint === item.id) {
        failHint('That paint is already on the car.');
        return 'owned';
      }
      state.cash -= item.price;
      garage.paint = item.id;
      applyToCar(api.playerCar());
      api.pushFeed('@MaraVoss', `Mara: "${item.name} — the car finally looks like yours."`);
      return 'bought';
    }
    if (item.kind === 'engine') {
      if (garage.engine >= item.level) {
        failHint('That tune is already installed.');
        return 'owned';
      }
      if (garage.engine !== item.level - 1) {
        failHint(`Buy Engine Tune ${item.level - 1} first — Mara builds in order.`);
        return 'locked';
      }
      state.cash -= item.price;
      garage.engine = item.level;
      applyToCar(api.playerCar());
      api.pushFeed('@MaraVoss', `Mara: "${item.name} — she pulls harder now. Feel it."`);
      return 'bought';
    }
    if (item.kind === 'armor') {
      if (garage.armor >= item.level) {
        failHint('That plate is already bolted on.');
        return 'owned';
      }
      if (garage.armor !== item.level - 1) {
        failHint(`Buy Armor Plate ${item.level - 1} first — Mara builds in order.`);
        return 'locked';
      }
      state.cash -= item.price;
      garage.armor = item.level;
      applyToCar(api.playerCar());
      api.pushFeed('@MaraVoss', `Mara: "${item.name} — the car can take a hit now."`);
      return 'bought';
    }
    if (item.kind === 'neon') {
      if (garage.neon) {
        failHint('The underglow is already installed.');
        return 'owned';
      }
      state.cash -= item.price;
      garage.neon = true;
      applyToCar(api.playerCar());
      api.pushFeed('@NeonRowNews', 'Neon underglow on Neon Row. The street approves.');
      return 'bought';
    }
    if (item.kind === 'nitro') {
      // Nitro is a consumable: three charges a can, nine in the tank, and
      // the driver burns one per burst with N.
      if (garage.nitro >= NITRO_MAX_CHARGES) {
        failHint('The nitro tank is full — burn some first.');
        return 'maxed';
      }
      state.cash -= item.price;
      garage.nitro = Math.min(NITRO_MAX_CHARGES, garage.nitro + 3);
      api.pushFeed('@MaraVoss', `Mara: "Nitro, ${garage.nitro} charges. Press N and hold on."`);
      return 'bought';
    }
    if (item.kind === 'repair') {
      if (state.health >= 100) {
        failHint('The car is already in perfect shape.');
        return 'healthy';
      }
      state.cash -= item.price;
      state.health = 100;
      api.pushFeed('@MaraVoss', 'Mara: "Good as new. Try not to bend it again."');
      return 'bought';
    }
    return 'maxed';
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    if (garage.open) return 0;
    const p = state.player;
    if (!p.onFoot) return 0;
    if (api.dist2(p.x, p.z, GARAGE_POS.x, GARAGE_POS.z) >= 100) return 0;
    if (state.hint === '') {
      state.hint = "Press G for Mara's Garage";
      state.hintTimer = 2;
    }
    if (input.garage) openShop();
    return 0;
  }

  return {
    state: garage, reset, step, openShop, closeShop, moveSelection,
    buySelected, saveData, applySave, applyToCar,
  };
}
