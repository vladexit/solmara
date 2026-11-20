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
