// Skylark Courier: Ember Canyon Run — game constants.
// All tuning numbers for the flight model, the canyon, the missions and the look
// live here so the rest of the code reads as plain behaviour, not magic numbers.

export const GAME_NAME = 'Skylark Courier: Ember Canyon Run';
export const PLANE_NAME = 'Skylark K-7';
export const DESTINATION = 'Duskmere Field';

// Canvas the game is designed for (the page scales it to fit the window).
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HORIZON_Y = 296;

// Flight model limits.
export const PHYSICS = {
  minSpeed: 38,          // knots — below this the Skylark stalls
  maxSpeed: 210,         // knots at full throttle, level flight
  cruiseSpeed: 120,      // knots the plane settles toward at 70% throttle
  stallSpeed: 52,        // knots — nose drops and the STALL lamp lights
  maxAltitude: 2600,     // ft — canyon ceiling for this run
  groundClearance: 40,   // ft — lowest safe altitude above the canyon floor
  maxBankDeg: 38,        // degrees of roll
  bankRate: 95,          // deg per second toward the commanded bank
  headingRate: 0.55,     // heading deg per second per deg of bank
  pitchRate: 150,        // ft per second of climb/descent at full pitch
  throttleRate: 0.55,    // throttle fraction per second
  accelRate: 55,         // knots per second toward the throttle target speed
  boostSpeed: 46,        // extra knots while boosting
  boostFuelRate: 1.9,    // fuel % per second while boosting
  baseFuelRate: 0.55,    // fuel % per second at cruise throttle
  fuelPerRing: 6,        // fuel % refunded for each ring flown
  damageWallHit: 14,     // damage % per canyon-wall scrape
  damageGroundHit: 22,   // damage % per terrain strike
  damageHardLanding: 26, // damage % for a landing that is too fast or too steep
};

// The canyon the courier flies through.
export const CANYON = {
  halfWidth: 150,        // world units from centreline to each wall
  wallHeight: 720,       // ft the walls rise above the floor — taller than cruise altitude
  floorRoughness: 46,    // world units of ground-height variation
  curveAmp: 90,          // world units the centreline meanders
  curveFreq: 0.0035,     // meander frequency per world unit of distance
  ringRadius: 26,        // world units — the glowing target rings
  ringSpacing: 420,      // world units between rings in Ring Run
  drawDistance: 1500,    // world units of terrain drawn ahead
  treeEvery: 90,         // average world units between trees
};

// Missions, flown in order. Each one changes the goal line and the weather.
export const MISSIONS = [
  {
    id: 'ring-run',
    name: 'Mission 1 — Ring Run',
    goal: 'Fly all 8 rings to warm up the route',
    rings: 8,
    wind: 0,
    storm: 0,
    ringFuel: true,
  },
  {
    id: 'cargo-drop',
    name: 'Mission 2 — Cargo Drop',
    goal: 'Deliver the cargo: land gently on Duskmere runway',
    rings: 3,
    wind: 4,
    storm: 0,
    runwayAt: 5200, // world units of distance where the runway sits
    ringFuel: true,
  },
  {
    id: 'storm-sprint',
    name: 'Mission 3 — Storm Sprint',
    goal: 'Beat the storm clock: 8 rings before the timer ends',
    rings: 8,
    wind: 16,
    storm: 1,
    timeLimit: 150, // seconds
    ringFuel: true,
  },
];

// Scoring.
export const SCORE = {
  ring: 250,
  ringTimeBonus: 5,      // points per second left in Storm Sprint, per ring
  landingSoft: 1200,
  landingOk: 600,
  missionComplete: 1000,
  stormWin: 1500,
};

// Colours — one warm ember-canyon palette for sky, rock, river and plane.
export const PALETTE = {
  skyTop: '#2b4a7a',
  skyMid: '#e08a4e',
  skyLow: '#f7c873',
  sun: '#ffd98a',
  sunGlow: 'rgba(255, 214, 130, 0.55)',
  mountainFar: '#7a5a72',
  mountainNear: '#5d3f4a',
  rockLight: '#b06a3f',
  rockMid: '#8a4a2e',
  rockDark: '#5f301f',
  rockShadow: '#472216',
  ground: '#c98d4e',
  groundDark: '#a86f38',
  fieldGreen: '#7d9b4a',
  fieldGold: '#d9b45c',
  river: '#4fa3c9',
  riverLight: '#8fd0e8',
  tree: '#3f6b34',
  treeDark: '#2c4f26',
  runway: '#3c3f46',
  runwayMark: '#f2ead8',
  ring: '#ffd34d',
  ringGlow: 'rgba(255, 211, 77, 0.5)',
  ringNext: '#ffe9a3',
  planeBody: '#f4ead8',
  planeTrim: '#c8452c',
  planeWing: '#e8d9b8',
  planeGlass: '#9fd8e8',
  hudText: '#fff3d6',
  hudPanel: 'rgba(20, 16, 28, 0.55)',
  hudAmber: '#ffb347',
  hudRed: '#ff5a4e',
  hudGreen: '#7de08a',
};
