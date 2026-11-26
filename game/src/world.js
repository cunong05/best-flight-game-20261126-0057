// Ember Canyon itself: the meandering centreline, the canyon floor, the glowing
// rings, the trees, the river and the Duskmere runway — plus collision checks.

import { CANYON, MISSIONS, PHYSICS, SCORE } from './config.js';
import { noise1, makeRng } from './random.js';

// Where the canyon centreline sits at a given forward distance.
export function centrelineAt(distance) {
  return (
    Math.sin(distance * CANYON.curveFreq) * CANYON.curveAmp +
    Math.sin(distance * CANYON.curveFreq * 2.7 + 1.7) * CANYON.curveAmp * 0.35
  );
}

// Ground height (ft) of the canyon floor at a forward distance.
export function floorHeightAt(distance) {
  return 30 + noise1(distance * 0.0016) * CANYON.floorRoughness;
}

// Build one mission's world: rings along the centreline, trees, runway.
export function buildWorld(missionIndex, seed = 1) {
  const mission = MISSIONS[missionIndex];
  const rng = makeRng(seed * 7919 + missionIndex * 131);
  const rings = [];
  const firstRingAt = 500;
  for (let i = 0; i < mission.rings; i++) {
    const z = firstRingAt + i * CANYON.ringSpacing;
    rings.push({
      id: i,
      z,
      x: centrelineAt(z) + (rng() - 0.5) * 90,
      y: 300 + rng() * 420, // ft above the floor
      passed: false,
      radius: CANYON.ringRadius,
    });
  }

  // Trees scattered along the canyon floor, deterministic per seed.
  const trees = [];
  for (let z = 120; z < 9000; z += CANYON.treeEvery) {
    if (rng() < 0.62) {
      trees.push({
        z: z + (rng() - 0.5) * 70,
        x: centrelineAt(z) + (rng() - 0.5) * (CANYON.halfWidth * 1.7),
        size: 14 + rng() * 22,
        shade: rng(),
      });
    }
  }

  const runwayAt = mission.runwayAt ?? 5200;
  return {
    missionIndex,
    mission,
    rings,
    trees,
    runwayAt,
    // Storm gusts change a few times a second in mission 3.
    gustTimer: 0,
  };
}

// The next ring the pilot still has to fly, or null when all are passed.
export function nextRing(world) {
  return world.rings.find((r) => !r.passed) || null;
}

export function ringsLeft(world) {
  return world.rings.filter((r) => !r.passed).length;
}

// Storm wind: gusts that shove the plane sideways in mission 3.
export function updateWind(world, plane, dt, time) {
  if (!world.mission.storm) {
    plane.windGust = 0;
    return;
  }
  world.gustTimer -= dt;
  if (world.gustTimer <= 0) {
    world.gustTimer = 0.4 + Math.random() * 0.5;
    plane.windGust = (Math.random() - 0.5) * 2 * world.mission.wind * 6;
  }
}

// Ring collection: close enough in distance, lateral and altitude.
export function checkRings(world, plane) {
  const ring = nextRing(world);
  if (!ring) return null;
  const dz = Math.abs(plane.distance - ring.z);
  if (dz > 26) return null;
  const dx = Math.abs(plane.lateral - ring.x);
  const dy = Math.abs(plane.altitude - (floorHeightAt(ring.z) + ring.y));
  if (dx < ring.radius + 26 && dy < ring.radius * 9) {
    ring.passed = true;
    if (world.mission.ringFuel) plane.fuel = Math.min(100, plane.fuel + 6);
    return ring;
  }
  return null;
}

// Collision with canyon walls or the floor. Returns a hit record or null.
export function checkTerrain(world, plane) {
  const centre = centrelineAt(plane.distance);
  const wallGap = Math.abs(plane.lateral - centre);
  if (wallGap > CANYON.halfWidth && plane.altitude < 900) {
    return { kind: 'wall', severity: PHYSICS.damageWallHit };
  }
  const floor = floorHeightAt(plane.distance);
  if (plane.altitude <= floor + PHYSICS.groundClearance * 0.4) {
    return { kind: 'ground', severity: PHYSICS.damageGroundHit };
  }
  return null;
}

// Bounce the plane back inside the canyon after a wall scrape.
export function bounceOffWall(plane) {
  const centre = centrelineAt(plane.distance);
  const over = plane.lateral - centre;
  plane.lateral = centre + Math.sign(over) * (CANYON.halfWidth - 8);
  plane.heading = -plane.heading * 0.4;
  plane.bank = -plane.bank * 0.5;
  plane.speed = Math.max(PHYSICS.minSpeed, plane.speed - 18);
}

// Bounce off the floor after a terrain strike.
export function bounceOffGround(plane) {
  plane.altitude = floorHeightAt(plane.distance) + 90;
  plane.pitch = Math.max(plane.pitch, 6);
  plane.verticalSpeed = Math.abs(plane.verticalSpeed) * 0.4;
  plane.speed = Math.max(PHYSICS.minSpeed, plane.speed - 22);
}

// Is the plane over the runway strip, low enough to touch down?
export function overRunway(world, plane) {
  const dz = plane.distance - world.runwayAt;
  return dz > -40 && dz < 420 && Math.abs(plane.lateral - centrelineAt(world.runwayAt)) < 70;
}

// Score for one ring, with a time bonus in the storm sprint.
export function ringScore(world, timeLeft) {
  let s = SCORE.ring;
  if (world.mission.timeLimit) s += Math.round(timeLeft * SCORE.ringTimeBonus);
  return s;
}
