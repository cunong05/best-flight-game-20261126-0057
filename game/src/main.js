// Skylark Courier: Ember Canyon Run — boot + fixed-step game loop + screens.
// Title -> play -> paused / mission complete / game over, with missions in order.

import { GAME_NAME, PLANE_NAME, MISSIONS, SCORE, PHYSICS } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlane, updatePlane, judgeLanding, applyDamage } from './physics.js';
import {
  buildWorld, nextRing, ringsLeft, updateWind, checkRings,
  checkTerrain, bounceOffWall, bounceOffGround, overRunway, ringScore, centrelineAt,
} from './world.js';
import { createRenderer } from './render.js';
import { parseShot, stagedState, armShotReady } from './shots.js';

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

const hud = {
  alt: document.getElementById('hud-alt'),
  speed: document.getElementById('hud-speed'),
  heading: document.getElementById('hud-heading'),
  throttle: document.getElementById('hud-throttle'),
  throttleBar: document.getElementById('hud-throttle-bar'),
  fuel: document.getElementById('hud-fuel'),
  fuelBar: document.getElementById('hud-fuel-bar'),
  score: document.getElementById('hud-score'),
  rings: document.getElementById('hud-rings'),
  mission: document.getElementById('hud-mission'),
  timer: document.getElementById('hud-timer'),
  warnings: document.getElementById('hud-warnings'),
  stall: document.getElementById('warn-stall'),
  lowFuel: document.getElementById('warn-fuel'),
  terrain: document.getElementById('warn-terrain'),
};
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const overlayHint = document.getElementById('overlay-hint');

const FIXED_DT = 1 / 60;
const { shot, seed } = parseShot();
const staged = stagedState(shot, seed);
const onShotReady = staged ? armShotReady(2) : null;

let state = staged || {
  world: buildWorld(0, 1),
  plane: createPlane(),
  screen: 'title',
  score: 0,
  timeLeft: null,
  message: '',
};
let missionIndex = staged ? state.world.missionIndex : 0;
let missionTime = 0;
let elapsed = 0;
let lastFrame = performance.now();
let accumulator = 0;
let beepTimer = 0;

function setOverlay(title, body, hint) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlayHint.textContent = hint;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function showTitle() {
  state.screen = 'title';
  setOverlay(
    GAME_NAME,
    `${PLANE_NAME} — courier run down Ember Canyon to Duskmere Field. Fly the rings, mind your fuel, land her gentle.`,
    'Press SPACE to take off  •  W/S pitch  •  A/D bank  •  Shift/Ctrl throttle  •  P pause  •  M mute',
  );
}

function startMission(index) {
  missionIndex = index;
  state.world = buildWorld(index, 1);
  state.plane = createPlane();
  state.screen = 'play';
  state.timeLeft = state.world.mission.timeLimit ?? null;
  missionTime = 0;
  hideOverlay();
  audio.startEngine();
}

function startGame() {
  state.score = 0;
  startMission(0);
}

function missionComplete(kind) {
  state.screen = 'complete';
  let bonus = SCORE.missionComplete;
  let title = 'MISSION COMPLETE';
  let body = '';
  if (kind === 'landing-soft') {
    bonus += SCORE.landingSoft;
    body = 'Butter-smooth touchdown on the Duskmere runway. The cargo is safe and the crowd is cheering.';
  } else if (kind === 'landing-ok') {
    bonus += SCORE.landingOk;
    body = 'Down on the runway in one piece — a firm landing, but the cargo survived.';
  } else if (kind === 'storm') {
    bonus += SCORE.stormWin;
    body = 'All storm rings flown with time to spare. The canyon run is yours, courier.';
  } else {
    body = 'All rings flown. The route is clear and the Skylark is still in one piece.';
  }
  state.score += bonus;
  state.message = body;
  audio.thud(0.4);
  if (missionIndex < MISSIONS.length - 1) {
    setOverlay(title, `${body}  Bonus +${bonus}. Score: ${state.score}.`, 'Press SPACE for the next mission');
  } else {
    setOverlay(
      'COURIER RUN COMPLETE',
      `${body}  Final score: ${state.score}. Three missions, one very tired little plane.`,
      'Press R to fly the canyon again',
    );
  }
}

function gameOver(reason) {
  state.screen = 'over';
  state.message = reason;
  audio.thud(1);
  setOverlay(
    'CRASHED',
    `${reason}  Score: ${state.score}. The Skylark will fly again — she always does.`,
    'Press R to restart the run',
  );
}

function tick(dt) {
  const plane = state.plane;
  const world = state.world;
  if (state.screen !== 'play') return;
  elapsed += dt;
  missionTime += dt;

  // Storm countdown.
  if (state.timeLeft !== null) {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      gameOver('The storm clock ran out over Ember Canyon.');
      return;
    }
  }

  updateWind(world, plane, dt, elapsed);
  updatePlane(plane, input.state, dt, world.mission);

  // Ring collection.
  const rung = checkRings(world, plane);
  if (rung) {
    state.score += ringScore(world, state.timeLeft ?? 0);
    audio.ringChime();
    if (ringsLeft(world) === 0) {
      if (world.mission.id === 'ring-run') missionComplete('rings');
      else if (world.mission.id === 'storm-sprint') missionComplete('storm');
      // Cargo Drop ends at the runway, not at the last ring.
      return;
    }
  }

  // Terrain: wall scrape or floor strike.
  const hit = checkTerrain(world, plane);
  if (hit) {
    applyDamage(plane, hit.severity);
    audio.thud(0.8);
    if (hit.kind === 'wall') bounceOffWall(plane);
    else bounceOffGround(plane);
    if (plane.crashed) {
      gameOver('The canyon wall won that argument.');
      return;
    }
  }

  // Out of fuel: glide down until the ground (or a wall) ends the flight.
  if (plane.fuel <= 0 && plane.altitude <= 60) {
    plane.crashed = true;
    gameOver('Out of fuel — the Skylark came down in the canyon.');
    return;
  }

  // Landing: over the runway, low, slow and descending gently.
  if (world.mission.id === 'cargo-drop' && overRunway(world, plane) && plane.altitude < 130) {
    const verdict = judgeLanding(plane);
    if (verdict === 'soft' || verdict === 'ok') {
      plane.landed = true;
      plane.onGround = true;
      plane.speed = 0;
      missionComplete(verdict === 'soft' ? 'landing-soft' : 'landing-ok');
      return;
    }
    // Too fast or too steep: a hard landing damages the plane and bounces it.
    applyDamage(plane, PHYSICS.damageHardLanding);
    audio.thud(1);
    plane.altitude = 220;
    plane.pitch = 8;
    if (plane.crashed) {
      gameOver('The landing was too hard — the Skylark broke up on the runway.');
      return;
    }
  }

  // Warning beeps, at most twice a second.
  beepTimer -= dt;
  if (beepTimer <= 0 && (plane.stalled || plane.fuel < 20)) {
    audio.warningBeep();
    beepTimer = 0.5;
  }
}

function updateHud() {
  const plane = state.plane;
  const world = state.world;
  hud.alt.textContent = `${Math.round(plane.altitude)} ft`;
  hud.speed.textContent = `${Math.round(plane.speed)} kt`;
  const heading = ((plane.heading % 360) + 360) % 360;
  hud.heading.textContent = `${String(Math.round(heading)).padStart(3, '0')}°`;
  hud.throttle.textContent = `${Math.round(plane.throttle * 100)}%`;
  hud.throttleBar.style.width = `${Math.round(plane.throttle * 100)}%`;
  hud.fuel.textContent = `${Math.round(plane.fuel)}%`;
  hud.fuelBar.style.width = `${Math.round(plane.fuel)}%`;
  hud.fuelBar.classList.toggle('low', plane.fuel < 20);
  hud.score.textContent = String(state.score);
  hud.rings.textContent = `${world.rings.filter((r) => r.passed).length}/${world.rings.length}`;
  hud.mission.textContent = world.mission.name;
  hud.timer.textContent = state.timeLeft !== null ? `⏱ ${Math.ceil(state.timeLeft)}s` : '';
  hud.stall.classList.toggle('on', plane.stalled && state.screen === 'play');
  hud.lowFuel.classList.toggle('on', plane.fuel < 20 && state.screen === 'play');
  const nearWall = Math.abs(plane.lateral - centrelineAt(plane.distance)) > 120;
  hud.terrain.classList.toggle('on', nearWall && state.screen === 'play');
  hud.warnings.classList.toggle('hidden', state.screen !== 'play');
}

function frame(now) {
  requestAnimationFrame(frame);
  const elapsedMs = Math.min(100, now - lastFrame);
  lastFrame = now;
  accumulator += elapsedMs / 1000;

  // Edge-triggered keys.
  if (input.wasPressed('Space')) {
    audio.startEngine();
    if (state.screen === 'title') startGame();
    else if (state.screen === 'complete' && missionIndex < MISSIONS.length - 1) startMission(missionIndex + 1);
  }
  if (input.wasPressed('KeyR')) {
    if (state.screen === 'over' || state.screen === 'complete') startGame();
    else startMission(missionIndex);
  }
  if (input.state.paused && state.screen === 'play') {
    state.screen = 'paused';
    setOverlay('PAUSED', 'The Skylark is holding station over the canyon.', 'Press P to keep flying');
  } else if (!input.state.paused && state.screen === 'paused') {
    state.screen = 'play';
    hideOverlay();
  }
  if (input.state.muted !== audio.muted) audio.setMuted(input.state.muted);

  // Fixed-step simulation.
  while (accumulator >= FIXED_DT) {
    tick(FIXED_DT);
    accumulator -= FIXED_DT;
  }

  audio.updateEngine(state.plane.throttle, state.plane.speed, PHYSICS.maxSpeed);
  renderer.render(state, now / 1000);
  updateHud();
  input.endTick();
  if (onShotReady) onShotReady();
}

// Staged shots render their fixed state; normal play starts at the title.
if (staged) {
  if (staged.screen === 'complete') {
    setOverlay('MISSION COMPLETE', staged.message, `Score: ${staged.score}  •  Press SPACE for the next mission`);
  } else if (staged.screen === 'over') {
    setOverlay('CRASHED', staged.message, `Score: ${staged.score}  •  Press R to restart the run`);
  } else if (staged.screen === 'title') {
    showTitle();
  }
  // Keep the HUD honest for the staged state.
  state.score = staged.score;
} else {
  showTitle();
}

requestAnimationFrame(frame);
