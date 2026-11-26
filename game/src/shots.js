// Screenshot staging: ?shot=start|play|end|crash (&seed=1).
// Each shot puts the game into a fixed, deterministic state, renders twice,
// then sets window.__shotReady so the screenshot tool knows the frame is done.

import { buildWorld } from './world.js';
import { createPlane } from './physics.js';

export function parseShot() {
  const params = new URLSearchParams(window.location.search);
  return {
    shot: params.get('shot') || null,
    seed: Number(params.get('seed') || 1),
  };
}

// Returns a ready-made game state for the requested shot, or null for normal play.
export function stagedState(shot, seed) {
  if (!shot) return null;

  if (shot === 'start') {
    const world = buildWorld(0, seed);
    const plane = createPlane();
    plane.distance = 0;
    plane.lateral = 0;
    plane.altitude = 60; // sitting on the runway
    plane.speed = 0;
    plane.throttle = 0;
    plane.onGround = true;
    return { world, plane, screen: 'title', score: 0, timeLeft: null, message: '' };
  }

  if (shot === 'play') {
    const world = buildWorld(0, seed);
    const plane = createPlane();
    // Mid-flight: just passing the second ring, canyon + river + runway ahead.
    plane.distance = world.rings[1].z - 120;
    plane.lateral = world.rings[1].x - 18;
    plane.altitude = 460;
    plane.speed = 142;
    plane.throttle = 0.72;
    plane.bank = -9;
    plane.heading = -4;
    plane.pitch = 3;
    plane.fuel = 78;
    world.rings[0].passed = true;
    return { world, plane, screen: 'play', score: 250, timeLeft: null, message: '' };
  }

  if (shot === 'end') {
    const world = buildWorld(1, seed);
    const plane = createPlane();
    // Landed on the Duskmere runway after mission 2 (on the strip, runway
    // stretching ahead of the plane).
    plane.distance = world.runwayAt - 200;
    plane.lateral = 4;
    plane.altitude = 62;
    plane.speed = 0;
    plane.throttle = 0;
    plane.onGround = true;
    plane.landed = true;
    plane.fuel = 41;
    world.rings.forEach((r) => { r.passed = true; });
    return {
      world, plane, screen: 'complete', score: 4850, timeLeft: null,
      message: 'Cargo delivered — Duskmere Field welcomes the Skylark.',
    };
  }

  if (shot === 'crash') {
    const world = buildWorld(0, seed);
    const plane = createPlane();
    plane.distance = 1500;
    plane.lateral = 190; // buried in the canyon wall
    plane.altitude = 380;
    plane.speed = 64;
    plane.throttle = 0.4;
    plane.bank = 28;
    plane.damage = 100;
    plane.crashed = true;
    return {
      world, plane, screen: 'over', score: 1250, timeLeft: null,
      message: 'Clipped the canyon wall — the Skylark is down.',
    };
  }

  return null;
}

// After the main loop has drawn two frames, signal readiness to the shooter.
export function armShotReady(frames = 2) {
  let drawn = 0;
  return function tick() {
    drawn += 1;
    if (drawn >= frames) window.__shotReady = true;
  };
}
