// Headless test for SOLMARA's daily challenges (node, no DOM): the three
// goals dealt at reset, each kind's payout, the rotation to the next goal,
// and the rule that a goal only counts fresh work done after it was dealt.
import { createWorld, EVENT_CHALLENGE } from '/home/hatch/workspace/makefun/gta6-01/repo-3d/game/src/world.js';
import { createRandom } from '/home/hatch/workspace/makefun/gta6-01/repo-3d/game/src/random.js';

const STEP = 1 / 60;
const IDLE = { x: 0, y: 0, run: false, enter: false, punch: false, dance: false };
let failed = 0;
function ok(label, holds) {
  console.log((holds ? 'PASS' : 'FAIL') + ' ' + label);
  if (!holds) failed += 1;
}
function fresh() {
  return createWorld(createRandom(21));
}
function advance(world, steps) {
  let events = 0;
  for (let i = 0; i < steps; i += 1) events |= world.step(STEP, IDLE, false);
  return events;
}

// --- A. Reset deals three goals: ram, taxi, race — in that order.
{
  const w = fresh();
  const names = w.state.challenges.slots.map((s) => s.def.id);
  ok('reset deals ram-5, taxi-200, race-1', names.join(',') === 'ram-5,taxi-200,race-1');
  ok('HUD line shows the first goal at 0/5', w.challenges.line() === '★ Ram 5 traffic cars 0/5');
  ok('summary is empty before any goal is done', w.challenges.summary() === '');
  ok('no goals completed yet', w.state.challenges.completed === 0);
}

// --- B. The ram goal pays $150 at 5 rams and rotates to the cash goal.
{
  const w = fresh();
  w.state.stats.rams = 4;
  advance(w, 1);
  ok('4 rams does not finish the goal', w.state.challenges.completed === 0);
  w.state.stats.rams = 5;
  const ev = advance(w, 1);
  ok('5 rams fires EVENT_CHALLENGE', Boolean(ev & EVENT_CHALLENGE));
  ok('one goal completed', w.state.challenges.completed === 1);
  ok('ram goal pays $150 (cash 60 -> 210)', w.state.cash === 210);
  ok('slot rotates to cash-1000', w.state.challenges.slots[0].def.id === 'cash-1000');
  ok('summary counts it', w.challenges.summary() === '1 challenge done · $150 earned');
}

// --- C. The taxi goal pays $100 at $200 of fares.
{
  const w = fresh();
  w.state.taxi.total = 199;
  advance(w, 1);
  ok('$199 of fares does not finish the goal', w.state.challenges.completed === 0);
  w.state.taxi.total = 200;
  advance(w, 1);
  ok('$200 of fares finishes the goal', w.state.challenges.completed === 1);
  ok('taxi goal pays $100 (cash 60 -> 160)', w.state.cash === 160);
  ok('slot rotates to the next goal on the list (cash-1000)', w.state.challenges.slots[1].def.id === 'cash-1000');
}

// --- D. The race goal pays $200 at one win.
{
  const w = fresh();
  w.state.race.wins = 1;
  const ev = advance(w, 1);
  ok('one race win fires EVENT_CHALLENGE', Boolean(ev & EVENT_CHALLENGE));
  ok('race goal pays $200 (cash 60 -> 260)', w.state.cash === 260);
  ok('slot rotates to the next goal on the list (cash-1000)', w.state.challenges.slots[2].def.id === 'cash-1000');
}

// --- E. A re-dealt ram goal needs five FRESH rams, not the old ones.
{
  const w = fresh();
  w.state.stats.rams = 5;
  advance(w, 1); // slot 0 (ram-5) completes and rotates to cash-1000
  w.state.taxi.total = 200;
  advance(w, 1); // slot 1 (taxi-200) completes and rotates to punch-5
  w.state.race.wins = 1;
  advance(w, 1); // slot 2 (race-1) completes and rotates to ram-5
  const slot = w.state.challenges.slots[2];
  ok('third slot is ram-5 again', slot.def.id === 'ram-5');
  ok('re-dealt ram goal bases on the 5 old rams', slot.base === 5);
  advance(w, 1);
  ok('old rams do not finish the re-dealt goal', w.state.challenges.completed === 3);
  w.state.stats.rams = 10;
  advance(w, 1);
  ok('five fresh rams finish it', w.state.challenges.completed === 4);
}

// --- F. The cash goal pays $150 once $1,000 is held.
{
  const w = fresh();
  w.state.stats.rams = 5;
  advance(w, 1); // slot 0 rotates to cash-1000; cash is now 210
  ok('cash goal is dealt after the ram goal', w.state.challenges.slots[0].def.id === 'cash-1000');
  w.state.cash = 1209;
  advance(w, 1);
  ok('$1,209 held does not finish it (base 210)', w.state.challenges.completed === 1);
  w.state.cash = 1210;
  advance(w, 1);
  ok('$1,210 held finishes it', w.state.challenges.completed === 2);
  ok('cash goal pays $150 (cash 1210 -> 1360)', w.state.cash === 1360);
}

// --- G. The punch goal pays $100 at five punches.
{
  const w = fresh();
  w.state.stats.rams = 5;
  advance(w, 1);
  w.state.taxi.total = 200;
  advance(w, 1); // slot 1 rotates to punch-5
  ok('punch goal is dealt after the taxi goal', w.state.challenges.slots[1].def.id === 'punch-5');
  w.state.stats.punches = 5;
  advance(w, 1);
  ok('five punches finish it', w.state.challenges.completed === 3);
  ok('punch goal pays $100', w.state.cash === 60 + 150 + 100 + 100);
}

// --- H. The HUD line tracks live progress.
{
  const w = fresh();
  w.state.stats.rams = 3;
  advance(w, 1);
  ok('HUD line shows 3/5 after three rams', w.challenges.line() === '★ Ram 5 traffic cars 3/5');
}

// --- I. Attract mode never pays a goal out.
{
  const w = fresh();
  w.state.stats.rams = 5;
  w.step(STEP, IDLE, true);
  ok('attract step pays nothing', w.state.challenges.completed === 0 && w.state.cash === 60);
}

console.log(failed === 0 ? 'ALL CHALLENGE TESTS PASSED' : failed + ' CHALLENGE TESTS FAILED');
process.exit(failed === 0 ? 0 : 1);
