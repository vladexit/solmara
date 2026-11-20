// Achievements: ten one-time badges for the things Solmara rewards — first
// race win, first taxi fare, first grand in the pocket, the Golden Token,
// ten rams, ten punches, five stolen cars, three chapters done, three
// challenges done, and the first thing bought at Mara's. Each unlocks once,
// posts to the feed, and stays unlocked for the run. The HUD shows the
// count; the pause menu shows the names. All original: a fictional city,
// no real places or brands.
import { ACHIEVEMENTS } from './config.js';

export const EVENT_ACHIEVEMENT = 262144;

function conditionMet(state, kind) {
  if (kind === 'race-win') return state.race.wins >= 1;
  if (kind === 'taxi-job') return state.taxi.jobs >= 1;
  if (kind === 'rich') return state.cash >= 1000;
  if (kind === 'token') return state.token.taken;
  if (kind === 'ram-10') return state.stats.rams >= 10;
  if (kind === 'punch-10') return state.stats.punches >= 10;
  if (kind === 'steal-5') return state.stats.stolen >= 5;
  if (kind === 'missions-3') return state.stats.missionsDone >= 3;
  if (kind === 'challenge-3') return state.challenges.completed >= 3;
  if (kind === 'garage-buy') {
    const g = state.garage;
    return g.paint !== 'stock' || g.engine >= 1 || g.armor >= 1 || g.neon || g.nitro > 0;
  }
  return false;
}

export function createAchievements(api) {
  const { state } = api;

  const achievements = {
    unlocked: [],
    count: 0,
  };

  function reset() {
    achievements.unlocked = [];
    achievements.count = 0;
  }

  // The HUD line: the count, plus the latest badge's name.
  function line() {
    if (achievements.count === 0) return '';
    const lastId = achievements.unlocked[achievements.unlocked.length - 1];
    const last = ACHIEVEMENTS.find((d) => d.id === lastId);
    return `🏆 ${achievements.count}/${ACHIEVEMENTS.length} · ${last ? last.name : lastId}`;
  }

  // The pause-menu line: every badge earned, in order.
  function summary() {
    if (achievements.count === 0) return '';
    const names = achievements.unlocked.map((id) => {
      const def = ACHIEVEMENTS.find((d) => d.id === id);
      return def ? def.name : id;
    });
    return `Achievements: ${names.join(', ')}`;
  }

  function step(dt, input, attract) {
    if (attract) return 0;
    let events = 0;
    for (const def of ACHIEVEMENTS) {
      if (achievements.unlocked.includes(def.id)) continue;
      if (!conditionMet(state, def.kind)) continue;
      achievements.unlocked.push(def.id);
      achievements.count += 1;
      api.pushFeed('@NeonRowNews', `Achievement unlocked: ${def.name} — ${def.desc}`);
      events |= EVENT_ACHIEVEMENT;
    }
    return events;
  }

  return { state: achievements, reset, step, line, summary };
}
