// The Skylark's flight model: lift, stall, bank, pitch, throttle, fuel, damage.
// One fixed-step update per tick; the numbers come from config.js.

import { PHYSICS } from './config.js';

export function createPlane() {
  return {
    // Position along the canyon (world units forward) and across it.
    distance: 0,
    lateral: 0,        // world units left(-)/right(+) of the canyon centreline
    altitude: 420,     // ft above the canyon floor
    speed: 118,        // knots
    heading: 0,        // degrees, 0 = straight down the canyon
    bank: 0,           // degrees of roll, + = banking right
    pitch: 0,          // degrees, + = nose up
    throttle: 0.68,    // 0..1
    fuel: 100,         // percent
    damage: 0,         // percent — 100 = crash
    boosting: false,
    stalled: false,
    onGround: false,
    verticalSpeed: 0,  // ft per second, for landing judgement
    windGust: 0,       // current lateral wind push (storm)
    crashed: false,
    landed: false,
  };
}

// Commanded bank from keys + mouse steer, in degrees.
export function commandedBank(input) {
  let target = 0;
  if (input.bankLeft) target -= PHYSICS.maxBankDeg;
  if (input.bankRight) target += PHYSICS.maxBankDeg;
  const steer = input.pointerActive ? (input.pointerX - 0.5) * 2 : 0;
  target += steer * PHYSICS.maxBankDeg * 0.8;
  return Math.max(-PHYSICS.maxBankDeg, Math.min(PHYSICS.maxBankDeg, target));
}

// Commanded pitch from keys, in degrees (+ = nose up).
export function commandedPitch(input) {
  let target = 0;
  if (input.pitchUp) target += 14;
  if (input.pitchDown) target -= 12;
  return target;
}

export function updatePlane(plane, input, dt, mission) {
  if (plane.crashed || plane.landed) return plane;

  // Throttle: Shift up, Ctrl down, mouse wheel in 5% steps.
  if (input.throttleUp) plane.throttle += PHYSICS.throttleRate * dt;
  if (input.throttleDown) plane.throttle -= PHYSICS.throttleRate * dt;
  const wheel = input.takeWheel ? input.takeWheel() : 0;
  if (wheel) plane.throttle += wheel * 0.05;
  plane.throttle = Math.max(0, Math.min(1, plane.throttle));

  // Boost: Space, only while fuel remains and the plane is airborne.
  plane.boosting = Boolean(input.boost) && plane.fuel > 0 && !plane.onGround;

  // Bank eases toward the commanded bank; heading follows the bank.
  const targetBank = commandedBank(input);
  const bankStep = PHYSICS.bankRate * dt;
  plane.bank += Math.max(-bankStep, Math.min(bankStep, targetBank - plane.bank));
  plane.heading += plane.bank * PHYSICS.headingRate * dt;
  plane.heading = ((plane.heading + 180) % 360 + 360) % 360 - 180;

  // Pitch eases toward the commanded pitch.
  const targetPitch = commandedPitch(input);
  plane.pitch += Math.max(-60 * dt, Math.min(60 * dt, targetPitch - plane.pitch));

  // Speed chases the throttle target; boost adds a surge.
  let targetSpeed = PHYSICS.minSpeed + plane.throttle * (PHYSICS.maxSpeed - PHYSICS.minSpeed);
  if (plane.boosting) targetSpeed += PHYSICS.boostSpeed;
  const speedStep = PHYSICS.accelRate * dt;
  plane.speed += Math.max(-speedStep, Math.min(speedStep, targetSpeed - plane.speed));

  // Stall: too slow and the wing stops lifting — nose drops, altitude bleeds.
  plane.stalled = plane.speed < PHYSICS.stallSpeed;
  const liftFactor = Math.max(0, Math.min(1, (plane.speed - PHYSICS.stallSpeed) / 40));

  // Vertical speed from pitch, scaled by lift; a stalled plane sinks.
  let vs = Math.sin((plane.pitch * Math.PI) / 180) * PHYSICS.pitchRate * liftFactor;
  if (plane.stalled) vs -= 90;
  plane.verticalSpeed = vs;
  plane.altitude += vs * dt;

  // Forward motion: speed in knots -> world units per second (1 kt ~ 0.9 units).
  const forward = plane.speed * 0.9 * dt;
  plane.distance += forward;

  // Lateral drift: banking turns the plane across the canyon; heading also
  // carries it sideways; storm wind shoves it around.
  const headingRad = (plane.heading * Math.PI) / 180;
  plane.lateral += Math.sin(headingRad) * forward;
  plane.lateral += Math.sin((plane.bank * Math.PI) / 180) * forward * 0.35;
  plane.lateral += plane.windGust * dt;

  // Fuel burns with throttle; boost and high throttle drink faster.
  let burn = PHYSICS.baseFuelRate * (0.35 + plane.throttle);
  if (plane.boosting) burn += PHYSICS.boostFuelRate;
  plane.fuel -= burn * dt;
  if (plane.fuel <= 0) {
    plane.fuel = 0;
    plane.throttle = Math.max(plane.throttle - 0.4 * dt, 0);
  }

  // Ceiling and floor clamps.
  if (plane.altitude > PHYSICS.maxAltitude) plane.altitude = PHYSICS.maxAltitude;
  if (plane.altitude < 0) plane.altitude = 0;

  return plane;
}

// Landing judgement at the runway: soft + slow + shallow = success.
export function judgeLanding(plane) {
  const speedOk = plane.speed < 95;
  const descentOk = plane.verticalSpeed > -220;
  const centred = Math.abs(plane.lateral) < 60;
  if (speedOk && descentOk && centred) {
    return plane.speed < 70 && plane.verticalSpeed > -120 ? 'soft' : 'ok';
  }
  return 'hard';
}

export function applyDamage(plane, amount) {
  plane.damage = Math.min(100, plane.damage + amount);
  if (plane.damage >= 100) plane.crashed = true;
  return plane.damage;
}
