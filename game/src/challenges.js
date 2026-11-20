// Daily challenges: three rotating goals that pay cash on top of everything
// else the city pays for. Ram five traffic cars, earn $200 driving taxi,
// win a street race, hold $1,000, punch five pedestrians — finish one and
// the slot pays out and rolls to the next goal on the list. Progress is the
// change since the goal was dealt, so a finished goal never completes twice
// and a goal you already passed still needs fresh work. All original: a
// fictional city, no real places or brands.
import { CHALLENGES } from './config.js';

export const EVENT_CHALLENGE = 65536;

function statFor(state, kind) {
  if (kind === 'rams') return state.stats.rams;
  if (kind === 'taxi') return state.taxi.total;
  if (kind === 'race') return state.race.wins;
  if (kind === 'cash') return state.cash;
  if (kind === 'punch') return state.stats.punches;
  return 0;
}

export function createChallenges(api) {
  const { state } = api;

  const challenges = {
    slots: [],
    nextDef: 3,
    completed: 0,
    earned: 0,
  };

  function assignSlot(slot, defIndex) {
    const def = CHALLENGES[defIndex % CHALLENGES.length];
    slot.def = def;
    // Progress is measured from the moment the goal is dealt, so a goal
    // dealt after the work is already done still needs fresh work.
    slot.base = statFor(state, def.kind);
    slot.done = false;
  }

  function reset() {
    challenges.slots = [{}, {}, {}];
    challenges.nextDef = 3;
    challenges.completed = 0;
    challenges.earned = 0;
    for (let i = 0; i < 3; i += 1) assignSlot(challenges.slots[i], i);
  }

  // The HUD line: the first open goal with its live progress.
  function line() {
    const slot = challenges.slots.find((s) => s && s.def && !s.done);
    if (!slot) return '';
    const progress = Math.max(0, statFor(state, slot.def.kind) - slot.base);
    return `★ ${slot.def.name} ${Math.min(progress, slot.def.target)}/${slot.def.target}`;
  }

  // The pause-menu line: how many goals are done and what they paid.
  function summary() {
    if (challenges.completed === 0) return '';
    return `${challenges.completed} challenge${challenges.completed === 1 ? '' : 's'} done · $${challenges.earned} earned`;
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    let events = 0;
    for (const slot of challenges.slots) {
      if (!slot.def || slot.done) continue;
      const progress = statFor(state, slot.def.kind) - slot.base;
      if (progress < slot.def.target) continue;
      slot.done = true;
      state.cash += slot.def.reward;
      challenges.completed += 1;
      challenges.earned += slot.def.reward;
      api.pushFeed('@NeonRowNews', `Challenge done: ${slot.def.name} — $${slot.def.reward} in the pocket.`);
      events |= EVENT_CHALLENGE;
      // The slot pays out and immediately deals the next goal on the list.
      assignSlot(slot, challenges.nextDef);
      challenges.nextDef = (challenges.nextDef + 1) % CHALLENGES.length;
    }
    return events;
  }

  return { state: challenges, reset, step, line, summary };
}
