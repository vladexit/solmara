// SOLMARA — constants: the city grid, the story missions, the radio stations and
// the fake social feed. Everything original: a fictional coastal city, no real
// places, no real brands, no Rockstar content.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmara-3d-save-v1';

// City: blocks of BLOCK with ROAD-wide streets on a PITCH grid. Roads run at the
// coordinates below on both axes; the city spans about +/-CITY_HALF.
export const BLOCK = 46;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD;
export const ROAD_COORDS = [-180, -120, -60, 0, 60, 120, 180];
export const CITY_HALF = 215;
export const BUILDING_MAX_H = 46;

export const WALK_SPEED = 6.5;
export const RUN_SPEED = 10;
export const CAR_ACCEL = 16;
export const CAR_MAX_SPEED = 27;
export const CAR_REVERSE = 9;
export const CAR_TURN = 2.4;
export const POLICE_SPEED = 17;
// At wanted 4-5 the police outrun the player's car: the chase stops being
// an escort and starts being a threat.
export const POLICE_TOP_SPEED = 29;

// City life, round 3: a visibly busier city than round 2 (14 traffic, 18 peds).
export const TRAFFIC_COUNT = 28;
export const PED_COUNT = 36;

export const START_CASH = 60;

// Missions: a point (or a list of points in order) the player must reach. needCar
// means the point only counts while driving. onArrive runs when a point is reached.
// A point may also carry a timeLimit (seconds left to reach it once it becomes
// current) or a ram count (traffic cars to smash near the point before it clears):
// round 3 adds timed runs and a ramming objective next to the plain reach points.
export const MISSIONS = [
  {
    title: 'Chapter 1 — New in Town',
    brief: 'Walk to Mara\u2019s Garage. Mara Voss is waiting, and she has work for you.',
    points: [{ x: -8, z: 6 }],
    needCar: false,
    reward: 100,
    arrive: 'Mara: "Fresh face. You drive? Good. This city eats the slow."',
  },
  {
    title: 'Chapter 2 — Borrowed Wheels',
    brief: 'Steal the red coupe parked on Neon Row. Press E beside a car to take it.',
    points: [{ x: 60, z: -14 }],
    needCar: true,
    reward: 150,
    arrive: 'Mara: "Nice. It was never theirs anyway. Keep it running."',
  },
  {
    title: 'Chapter 3 — The 10-Day Contract',
    brief: 'The Contract: hit all three checkpoints across Solmara — 60 seconds per stop. Ten days of work, one night of driving.',
    points: [
      { x: -180, z: -120, timeLimit: 60 },
      { x: 180, z: 60, timeLimit: 60 },
      { x: -60, z: 180, timeLimit: 60 },
    ],
    needCar: true,
    reward: 300,
    arrive: 'Contract signed. Three stops down — the city is starting to know your name.',
  },
  {
    title: 'Chapter 4 — POV: Getaway Driver',
    brief: 'Pick up the passenger at the Marina, then lose the cops and reach the safehouse.',
    points: [
      { x: -180, z: 180, wanted: 2 },
      { x: 120, z: -180 },
    ],
    needCar: true,
    reward: 400,
    arrive: 'Passenger: "You drive like the city owes you money. I like it."',
  },
  {
    title: 'Chapter 5 — Golden Token Hunt',
    brief: 'A Golden Token is hidden in Plaza Chest. Find it — it is worth a fortune.',
    points: [{ x: 32, z: 32 }],
    needCar: false,
    reward: 500,
    arrive: 'GOLDEN TOKEN! The shop is yours for the night. The feed is going wild.',
  },
  {
    title: 'Chapter 6 — Neon Row Delivery',
    brief: 'Deliver the package to the far corner of town. 75 seconds on the clock. Fast, quiet, no cops.',
    points: [{ x: -180, z: -180, timeLimit: 75 }],
    needCar: true,
    reward: 350,
    arrive: 'Delivered. No questions, no names. That is how Solmara works.',
  },
  {
    title: 'Chapter 7 — The Big Score',
    brief: 'Ram the vault convoy — smash 3 escort cars at the old bank — grab the cash, then escape to the Marina.',
    points: [
      { x: 0, z: -180, wanted: 3, ram: 3 },
      { x: -180, z: 180 },
    ],
    needCar: true,
    reward: 1000,
    arrive: 'THE BIG SCORE! Solmara is yours now. Mara is already planning the next one.',
  },
];

export const TOKEN_SPOT = { x: 32, z: 32 };

// Side systems, round 3: street races, Mara's garage, weather and taxi
// jobs. All original: a fictional city, no real places or brands.
export const WEATHER_DAY_SECONDS = 240;
export const RACE_START_PAD = { x: 0, z: 60 };
// One lap: the start pad, four corners, back to the pad. All road coords.
export const RACE_COURSE = [
  { x: 0, z: 60 },
  { x: 120, z: 60 },
  { x: 120, z: -120 },
  { x: -120, z: -120 },
  { x: -120, z: 120 },
  { x: 0, z: 60 },
];
export const RACE_PRIZES = [500, 300, 150, 50];
export const RACE_NAMES = ['Vex', 'Kiko', 'Bram'];
export const RACE_COLORS = [0xff5a3c, 0x22e6ff, 0xffc93c];
export const GARAGE_POS = { x: -8, z: 6 };
export const GARAGE_ITEMS = [
  { id: 'paint-pink', kind: 'paint', name: 'Neon Pink paint', desc: 'Hot pink, hard to miss', price: 150, color: 0xff2e88 },
  { id: 'paint-gold', kind: 'paint', name: 'Gold Leaf paint', desc: 'Gold leaf, heavy shine', price: 250, color: 0xffc93c },
  { id: 'paint-midnight', kind: 'paint', name: 'Midnight Black paint', desc: 'Black as the bay at night', price: 400, color: 0x111118 },
  { id: 'engine-1', kind: 'engine', name: 'Engine Tune I (+2 top speed)', desc: 'A quicker pull off the line', price: 300, level: 1 },
  { id: 'engine-2', kind: 'engine', name: 'Engine Tune II (+4 top speed)', desc: 'A real street-race tune', price: 600, level: 2 },
  { id: 'engine-3', kind: 'engine', name: 'Engine Tune III (+6 top speed)', desc: "Mara's best work", price: 1000, level: 3 },
  { id: 'armor-1', kind: 'armor', name: 'Armor Plate I', desc: 'Softer crashes', price: 250, level: 1 },
  { id: 'armor-2', kind: 'armor', name: 'Armor Plate II', desc: 'Much softer crashes', price: 500, level: 2 },
  { id: 'armor-3', kind: 'armor', name: 'Armor Plate III', desc: 'Barely a scratch', price: 800, level: 3 },
  { id: 'neon', kind: 'neon', name: 'Neon underglow', desc: 'Magenta glow under the car', price: 200 },
  { id: 'repair', kind: 'repair', name: 'Full repair (health to 100)', desc: 'Health back to 100', price: 50 },
  { id: 'nitro', kind: 'nitro', name: 'Nitro boost', desc: '3 charges, press N for a burst', price: 300 },
];
export const NITRO_BOOST = 10;
export const NITRO_SECONDS = 3;
export const NITRO_MAX_CHARGES = 9;

// Achievements: ten one-time badges. kind names the thing the badge watches;
// the list order is the order they are checked in, not the order they unlock.
export const ACHIEVEMENTS = [
  { id: 'race-win', kind: 'race-win', name: 'Neon Row King', desc: 'Win a street race' },
  { id: 'taxi-job', kind: 'taxi-job', name: 'Licensed Cab', desc: 'Finish a taxi fare' },
  { id: 'rich', kind: 'rich', name: 'A Grand in the Pocket', desc: 'Hold $1,000 at once' },
  { id: 'token', kind: 'token', name: 'Golden Touch', desc: 'Find the Golden Token' },
  { id: 'ram-10', kind: 'ram-10', name: 'Battering Ram', desc: 'Ram 10 traffic cars' },
  { id: 'punch-10', kind: 'punch-10', name: 'Strong Arm', desc: 'Punch 10 pedestrians' },
  { id: 'steal-5', kind: 'steal-5', name: 'Five-Finger Discount', desc: 'Steal 5 cars' },
  { id: 'missions-3', kind: 'missions-3', name: 'Contract Player', desc: 'Finish 3 chapters' },
  { id: 'challenge-3', kind: 'challenge-3', name: 'Goal Getter', desc: 'Finish 3 challenges' },
  { id: 'garage-buy', kind: 'garage-buy', name: "Mara's Customer", desc: 'Buy something at the garage' },
];
export const TAXI_BASE_FARE = 20;
export const TAXI_PER_METER = 0.3;

// Daily challenges: three goals at a time, dealt from this list in order.
// kind names the stat the goal watches (rams, taxi earnings, race wins,
// cash held, punches); target is the fresh work needed, reward the payout.
export const CHALLENGES = [
  { id: 'ram-5', kind: 'rams', name: 'Ram 5 traffic cars', desc: 'Shove 5 cars off their lane', target: 5, reward: 150 },
  { id: 'taxi-200', kind: 'taxi', name: 'Earn $200 driving taxi', desc: 'Fares add up, driver', target: 200, reward: 100 },
  { id: 'race-1', kind: 'race', name: 'Win a street race', desc: 'Beat Vex, Kiko and Bram', target: 1, reward: 200 },
  { id: 'cash-1000', kind: 'cash', name: 'Hold $1,000', desc: 'A grand in the pocket', target: 1000, reward: 150 },
  { id: 'punch-5', kind: 'punch', name: 'Punch 5 pedestrians', desc: 'The city respects a strong arm', target: 5, reward: 100 },
];

// Hidden packages, round 3: 50 parcels stashed around the city — 42
// hand-placed on road crossings (a few metres off the corner, on the
// sidewalk edge) plus 8 more dealt by the packages system itself. Walk
// or drive within three metres to grab one; milestones pay at 10, 25
// and 50. All original: a fictional city, no real places or brands.
export const PACKAGE_COUNT = 50;
export const PACKAGE_RADIUS = 3;
export const PACKAGE_SPOTS = [
  [-177, -183], [-117, -177], [-57, -183], [63, -183], [123, -177], [177, -183],
  [-183, -117], [-117, -123], [-63, -117], [-3, -123], [117, -123], [183, -117],
  [-177, -57], [-57, -57], [3, -63], [63, -57], [117, -63], [177, -57],
  [-183, -3], [-117, 3], [-63, -3], [57, 3], [123, -3], [177, 3],
  [-177, 57], [-123, 63], [-57, 57], [3, 63], [63, 57], [117, 63],
  [-183, 117], [-117, 123], [-3, 123], [57, 117], [117, 123], [177, 117],
  [-177, 183], [-117, 177], [-57, 183], [3, 177], [63, 183], [183, 183],
];
export const PACKAGE_MILESTONES = [
  { count: 10, reward: 150 },
  { count: 25, reward: 400 },
  { count: 50, reward: 1000 },
];

// Radio: four original stations. Songs are step patterns the audio engine plays.
export const STATIONS = [
  { name: 'DANGDUT PANTURA', tag: 'dangdut-style', bpm: 124 },
  { name: 'NEON WAVE', tag: 'synthwave', bpm: 100 },
  { name: 'SOLMARA LO-FI', tag: 'lo-fi', bpm: 76 },
  { name: 'TURBO ROCK', tag: 'rock', bpm: 132 },
];

// Fake social feed lines shown in the HUD. Original parody posts, no real people.
export const FEED_POOL = [
  ['@StaticNoodle', 'NOODLE DROP is out now. If your noodles are not from Solmara, are they even noodles?'],
  ['@CaptainCrumb', 'I put a crumb in the vault and the vault said thanks.'],
  ['@AuntieTurbo', 'Walked to the Marina in 9 minutes. The bus took 40. Walk, kids.'],
  ['@LilVolcano', 'Six Seven challenge at the arcade. My fingers are tired but my score is not.'],
  ['@SirHonksALot', 'Traffic on Neon Row is a myth. I have never seen a red light I respected.'],
  ['@BramTheBaker', 'Fresh bread at Plaza Chest. The line is long but the gossip is longer.'],
  ['@MomoCircus', 'Tonight only: the dancing car! It does the Bicep Heart. You have to see it.'],
  ['@NeonRowNews', 'Same spot, years apart. Neon Row looked better then. It looks better now. Fight me.'],
];

export const BUSTED_LINES = [
  'BUSTED — You\u2019re Under Arrest',
  'The cops got you. The dance, though? The dance was flawless.',
];
