// Everything the player sees: the chase-view canyon, the Skylark, the rings,
// the runway, the storm — and the little artificial horizon gauge.
// All drawing is plain 2D canvas; the depth comes from a simple projection.

import { VIEW_W, VIEW_H, PALETTE, CANYON } from './config.js';
import { centrelineAt, floorHeightAt, nextRing } from './world.js';
import { noise1 } from './random.js';

const FOCAL = 260;      // projection focal length (world units)
const LAT_PX = 1.6;     // screen pixels per world unit of lateral offset
const ALT_PX = 0.45;    // screen pixels per foot of altitude difference

function scaleAt(d) {
  return FOCAL / (d + FOCAL);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // Horizon line moves with pitch and a little with altitude, like a real view.
  function horizonY(plane) {
    const y = 296 - plane.pitch * 2.2 - (plane.altitude - 420) * 0.03;
    return Math.max(180, Math.min(380, y));
  }

  function groundY(d, horizon) {
    return horizon + (VIEW_H - horizon) * scaleAt(d);
  }

  function screenX(d, worldX, plane, horizon) {
    const dx = worldX - plane.lateral;
    return VIEW_W / 2 + dx * LAT_PX * scaleAt(d) - plane.heading * 2.2 * scaleAt(d);
  }

  function screenY(d, altFt, plane, horizon) {
    return groundY(d, horizon) - (altFt - plane.altitude) * ALT_PX * scaleAt(d);
  }

  function drawSky(plane, time, storm) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    if (storm) {
      g.addColorStop(0, '#3a3f4d');
      g.addColorStop(0.45, '#6b5a52');
      g.addColorStop(0.62, '#c98a52');
      g.addColorStop(1, '#8a5a34');
    } else {
      g.addColorStop(0, PALETTE.skyTop);
      g.addColorStop(0.42, PALETTE.skyMid);
      g.addColorStop(0.62, PALETTE.skyLow);
      g.addColorStop(1, PALETTE.groundDark);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // Low ember sun, hanging over the canyon mouth.
    const sunX = VIEW_W * 0.72 - plane.heading * 1.5;
    const sunY = 168;
    const glow = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 130);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 130, sunY - 130, 260, 260);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();

    // Drifting clouds, parallaxed by heading and time.
    ctx.fillStyle = storm ? 'rgba(40, 38, 48, 0.85)' : 'rgba(255, 246, 226, 0.85)';
    for (let i = 0; i < 9; i++) {
      const speed = 6 + i * 2.2;
      const cx = ((i * 173 + time * speed - plane.heading * (4 + i)) % (VIEW_W + 260) + VIEW_W + 260) % (VIEW_W + 260) - 130;
      const cy = 52 + (i % 4) * 42 + Math.sin(time * 0.3 + i) * 6;
      const cw = 90 + (i % 3) * 46;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, 15 + (i % 3) * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountains(plane, horizon) {
    // Two ridges: a far pale one and a nearer darker one, parallaxed by heading.
    const ridges = [
      { amp: 46, base: horizon - 6, color: '#8a6a7c', shift: 0.9, seed: 3 },
      { amp: 78, base: horizon + 4, color: '#6b4a58', shift: 1.8, seed: 11 },
    ];
    for (const r of ridges) {
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.moveTo(0, VIEW_H);
      for (let x = 0; x <= VIEW_W; x += 16) {
        const n = noise1((x + plane.heading * 22 * r.shift + r.seed * 97) * 0.008);
        ctx.lineTo(x, r.base - n * r.amp);
      }
      ctx.lineTo(VIEW_W, VIEW_H);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCanyonFloorAndWalls(world, plane, horizon, time) {
    const steps = 26;
    const maxD = CANYON.drawDistance;
    // Sample the canyon from far to near so near quads paint over far ones.
    const samples = [];
    for (let i = 0; i <= steps; i++) {
      const d = (i / steps) * maxD;
      const z = plane.distance + d;
      const centre = centrelineAt(z);
      const floor = floorHeightAt(z);
      samples.push({
        d,
        z,
        centre,
        floor,
        leftX: screenX(d, centre - CANYON.halfWidth, plane, horizon),
        rightX: screenX(d, centre + CANYON.halfWidth, plane, horizon),
        groundY: groundY(d, horizon),
        leftTopY: screenY(d, floor + CANYON.wallHeight, plane, horizon),
        rightTopY: screenY(d, floor + CANYON.wallHeight, plane, horizon),
      });
    }

    // Floor: one big quad fan from the horizon down to the bottom of the screen.
    ctx.fillStyle = PALETTE.ground;
    ctx.beginPath();
    ctx.moveTo(samples[steps].leftX, samples[steps].groundY);
    for (let i = steps; i >= 0; i--) ctx.lineTo(samples[i].leftX, samples[i].groundY);
    ctx.lineTo(samples[0].leftX, VIEW_H);
    ctx.lineTo(samples[0].rightX, VIEW_H);
    for (let i = 0; i <= steps; i++) ctx.lineTo(samples[i].rightX, samples[i].groundY);
    ctx.closePath();
    ctx.fill();

    // Canyon walls, far to near, in alternating rock strata.
    for (let i = steps; i >= 1; i--) {
      const far = samples[i];
      const near = samples[i - 1];
      const band = (i % 3 === 0) ? PALETTE.rockLight : (i % 3 === 1 ? PALETTE.rockMid : PALETTE.rockDark);
      // Left wall.
      ctx.fillStyle = band;
      ctx.beginPath();
      ctx.moveTo(far.leftX, far.groundY);
      ctx.lineTo(near.leftX, near.groundY);
      ctx.lineTo(near.leftX, near.leftTopY);
      ctx.lineTo(far.leftX, far.leftTopY);
      ctx.closePath();
      ctx.fill();
      // Right wall.
      ctx.fillStyle = band === PALETTE.rockLight ? PALETTE.rockMid : PALETTE.rockDark;
      ctx.beginPath();
      ctx.moveTo(far.rightX, far.groundY);
      ctx.lineTo(near.rightX, near.groundY);
      ctx.lineTo(near.rightX, near.rightTopY);
      ctx.lineTo(far.rightX, far.rightTopY);
      ctx.closePath();
      ctx.fill();
      // Rock strata: thin darker seams across each wall band, plus a lit rim
      // along the wall top so the bands read as layered rock, not flat slabs.
      for (const t of [0.33, 0.66]) {
        ctx.strokeStyle = 'rgba(40, 18, 10, 0.45)';
        ctx.lineWidth = Math.max(1, 3 * scaleAt(near.d));
        ctx.beginPath();
        ctx.moveTo(far.leftX, far.groundY + (far.leftTopY - far.groundY) * t);
        ctx.lineTo(near.leftX, near.groundY + (near.leftTopY - near.groundY) * t);
        ctx.moveTo(far.rightX, far.groundY + (far.rightTopY - far.groundY) * t);
        ctx.lineTo(near.rightX, near.groundY + (near.rightTopY - near.groundY) * t);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255, 214, 150, 0.35)';
      ctx.lineWidth = Math.max(1, 2 * scaleAt(near.d));
      ctx.beginPath();
      ctx.moveTo(far.leftX, far.leftTopY);
      ctx.lineTo(near.leftX, near.leftTopY);
      ctx.moveTo(far.rightX, far.rightTopY);
      ctx.lineTo(near.rightX, near.rightTopY);
      ctx.stroke();
      // Shadow strip where wall meets floor.
      ctx.fillStyle = 'rgba(40, 18, 10, 0.35)';
      ctx.beginPath();
      ctx.moveTo(far.leftX, far.groundY);
      ctx.lineTo(near.leftX, near.groundY);
      ctx.lineTo(near.leftX, near.groundY - 14 * scaleAt(near.d));
      ctx.lineTo(far.leftX, far.groundY - 14 * scaleAt(far.d));
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(far.rightX, far.groundY);
      ctx.lineTo(near.rightX, near.groundY);
      ctx.lineTo(near.rightX, near.groundY - 14 * scaleAt(near.d));
      ctx.lineTo(far.rightX, far.groundY - 14 * scaleAt(far.d));
      ctx.closePath();
      ctx.fill();
    }

    // Winding river down the canyon floor.
    ctx.strokeStyle = PALETTE.river;
    ctx.lineCap = 'round';
    for (let i = steps; i >= 1; i--) {
      const far = samples[i];
      const near = samples[i - 1];
      const riverFarX = screenX(far.d, far.centre + Math.sin(far.z * 0.006) * 55, plane, horizon);
      const riverNearX = screenX(near.d, near.centre + Math.sin(near.z * 0.006) * 55, plane, horizon);
      ctx.lineWidth = Math.max(1, 26 * scaleAt(near.d));
      ctx.beginPath();
      ctx.moveTo(riverFarX, far.groundY);
      ctx.lineTo(riverNearX, near.groundY);
      ctx.stroke();
    }

    // Patchwork fields on the floor.
    for (let i = steps; i >= 2; i -= 2) {
      const s = samples[i];
      const patch = noise1(s.z * 0.01) > 0.5 ? PALETTE.fieldGreen : PALETTE.fieldGold;
      ctx.fillStyle = patch;
      ctx.globalAlpha = 0.55;
      const w = 60 * scaleAt(s.d);
      ctx.beginPath();
      ctx.ellipse(screenX(s.d, s.centre + (noise1(s.z * 0.02) - 0.5) * 160, plane, horizon), s.groundY - 6 * scaleAt(s.d), w, w * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Trees, far to near.
    const visibleTrees = world.trees
      .filter((t) => t.z > plane.distance - 10 && t.z < plane.distance + maxD)
      .sort((a, b) => b.z - a.z);
    for (const t of visibleTrees) {
      const d = t.z - plane.distance;
      const x = screenX(d, t.x, plane, horizon);
      const y = groundY(d, horizon);
      const s = scaleAt(d);
      const h = t.size * s * 1.4;
      if (h < 2) continue;
      ctx.fillStyle = t.shade > 0.5 ? PALETTE.tree : PALETTE.treeDark;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x - h * 0.45, y);
      ctx.lineTo(x + h * 0.45, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawRunway(world, plane, horizon) {
    const dz = world.runwayAt - plane.distance;
    if (dz < -420 || dz > CANYON.drawDistance) return;
    const centre = centrelineAt(world.runwayAt);
    const points = [];
    for (let d = Math.max(0, dz - 420); d <= dz + 60; d += 60) {
      const z = plane.distance + d;
      points.push({
        d,
        left: screenX(d, centre - 26, plane, horizon),
        right: screenX(d, centre + 26, plane, horizon),
        y: groundY(d, horizon),
      });
    }
    if (points.length < 2) return;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(points[points.length - 1].left, points[points.length - 1].y);
    for (let i = points.length - 1; i >= 0; i--) ctx.lineTo(points[i].left, points[i].y);
    for (let i = 0; i < points.length; i++) ctx.lineTo(points[i].right, points[i].y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes.
    ctx.fillStyle = PALETTE.runwayMark;
    for (const p of points) {
      const w = Math.max(1, 3 * scaleAt(p.d));
      ctx.fillRect((p.left + p.right) / 2 - w / 2, p.y - 4 * scaleAt(p.d), w, 8 * scaleAt(p.d));
    }
    // "DUSKMERE" threshold marker at the far end.
    const far = points[points.length - 1];
    if (scaleAt(far.d) > 0.12) {
      ctx.fillStyle = PALETTE.hudText;
      ctx.font = `bold ${Math.round(15 * scaleAt(far.d) + 8)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('DUSKMERE', (far.left + far.right) / 2, far.y - 12);
    }
  }

  function drawRings(world, plane, horizon, time) {
    const target = nextRing(world);
    const sorted = [...world.rings].sort((a, b) => b.z - a.z);
    for (const ring of sorted) {
      const d = ring.z - plane.distance;
      if (d < -30 || d > CANYON.drawDistance) continue;
      const alt = floorHeightAt(ring.z) + ring.y;
      const x = screenX(d, ring.x, plane, horizon);
      const y = screenY(d, alt, plane, horizon);
      const s = scaleAt(d);
      const r = Math.max(3, ring.radius * 2.4 * s);
      if (ring.passed) continue;
      const isNext = ring === target;
      const pulse = 0.75 + Math.sin(time * 4 + ring.id) * 0.25;
      // Glow.
      ctx.save();
      ctx.globalAlpha = isNext ? 0.55 * pulse : 0.3;
      ctx.strokeStyle = PALETTE.ringGlow;
      ctx.lineWidth = r * 0.55;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      // The ring itself.
      ctx.strokeStyle = isNext ? PALETTE.ringNext : PALETTE.ring;
      ctx.lineWidth = Math.max(2, r * 0.16);
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.86, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Inner tick marks so the ring reads as a gate, not a circle.
      ctx.strokeStyle = 'rgba(120, 60, 10, 0.6)';
      ctx.lineWidth = Math.max(1, r * 0.05);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + 0.4;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.7);
        ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.86);
        ctx.stroke();
      }
      if (isNext && d > 60) {
        ctx.fillStyle = PALETTE.hudText;
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`RING ${ring.id + 1} — ${Math.round(d * 3.2)} ft`, x, y - r - 10);
      }
    }
  }

  function drawPlane(plane, time, screen) {
    const px = VIEW_W / 2;
    const py = screen === 'title' ? 500 : 468;
    const bankRad = (plane.bank * Math.PI) / 180;
    const pitchShift = -plane.pitch * 1.4;
    ctx.save();
    ctx.translate(px, py + pitchShift);
    ctx.rotate(bankRad * 0.55);
    // Soft shadow on the ground below.
    ctx.fillStyle = 'rgba(30, 14, 8, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 150, 66, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail fin.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.moveTo(-58, -6);
    ctx.lineTo(-78, -34);
    ctx.lineTo(-64, -36);
    ctx.lineTo(-44, -10);
    ctx.closePath();
    ctx.fill();
    // Tailplane.
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-52, 2);
    ctx.lineTo(-78, 12);
    ctx.lineTo(-76, 20);
    ctx.lineTo(-48, 10);
    ctx.closePath();
    ctx.fill();
    // Main wings (seen from behind-above).
    ctx.fillStyle = PALETTE.planeWing;
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-96, 22);
    ctx.lineTo(-92, 34);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(14, -4);
    ctx.lineTo(96, 22);
    ctx.lineTo(92, 34);
    ctx.lineTo(8, 10);
    ctx.closePath();
    ctx.fill();
    // Fuselage.
    ctx.fillStyle = PALETTE.planeBody;
    ctx.beginPath();
    ctx.ellipse(0, -4, 26, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    // Ember cheatline.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.fillRect(-25, 6, 50, 7);
    // Cockpit glass.
    ctx.fillStyle = PALETTE.planeGlass;
    ctx.beginPath();
    ctx.ellipse(0, -30, 13, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.ellipse(-4, -36, 4, 8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Propeller: blurred disc + two spinning blades.
    const bladeAngle = time * 34;
    ctx.fillStyle = 'rgba(60, 40, 30, 0.16)';
    ctx.beginPath();
    ctx.arc(0, -58, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50, 32, 22, 0.75)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, -58 - Math.sin(bladeAngle) * 28);
    ctx.lineTo(0, -58 + Math.sin(bladeAngle) * 28);
    ctx.moveTo(0 - Math.cos(bladeAngle) * 28, -58);
    ctx.lineTo(0 + Math.cos(bladeAngle) * 28, -58);
    ctx.stroke();
    // Spinner.
    ctx.fillStyle = PALETTE.planeTrim;
    ctx.beginPath();
    ctx.arc(0, -58, 7, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red left, green right, blinking white tail.
    const blink = Math.sin(time * 5) > 0;
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(-94, 28, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4dff7a';
    ctx.beginPath();
    ctx.arc(94, 28, 4, 0, Math.PI * 2);
    ctx.fill();
    if (blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 52, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Boost speed lines.
    if (plane.boosting) {
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 10; i++) {
        const y = 120 + ((i * 67 + time * 900) % 520);
        const x = 60 + (i * 137) % (VIEW_W - 120);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 34);
        ctx.stroke();
      }
    }
  }

  function drawSmoke(plane, time) {
    if (!plane.crashed) return;
    const px = VIEW_W / 2;
    const py = 430;
    // Orange embers at the impact point.
    for (let i = 0; i < 8; i++) {
      const flicker = 0.5 + Math.sin(time * 9 + i * 2.1) * 0.5;
      ctx.fillStyle = `rgba(255, ${120 + Math.round(60 * flicker)}, 30, ${0.55 + 0.35 * flicker})`;
      ctx.beginPath();
      ctx.arc(px + Math.sin(i * 3.3) * 30, py - 10 - (i % 3) * 8, 4 + flicker * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 14; i++) {
      const age = ((time * 0.7 + i * 0.13) % 1);
      const sx = px + Math.sin(i * 2.4) * 26 * age - 20 * age;
      const sy = py - 40 - age * 150 - Math.sin(i * 1.7) * 12;
      ctx.fillStyle = `rgba(52, 46, 46, ${0.8 * (1 - age)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 14 + age * 38, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStormOverlay(plane, time, storm) {
    if (!storm) return;
    // Rain streaks slanting across the frame.
    ctx.strokeStyle = 'rgba(200, 210, 230, 0.35)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 70; i++) {
      const x = ((i * 181 + time * 700) % (VIEW_W + 120)) - 60;
      const y = ((i * 97 + time * 1100) % (VIEW_H + 80)) - 40;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 14, y + 34);
      ctx.stroke();
    }
    // Visibility vignette.
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 220, VIEW_W / 2, VIEW_H / 2, 720);
    vg.addColorStop(0, 'rgba(30, 30, 40, 0)');
    vg.addColorStop(1, 'rgba(30, 30, 40, 0.55)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Little artificial horizon gauge, bottom-right of the canvas.
  function drawArtificialHorizon(plane) {
    const cx = VIEW_W - 92;
    const cy = VIEW_H - 92;
    const r = 52;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate((-plane.bank * Math.PI) / 180);
    const pitchPx = plane.pitch * 1.6;
    ctx.fillStyle = '#3a6ea8';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#8a5a34';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = '#fff3d6';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    ctx.restore();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 16);
  }

  // Compass strip across the top centre of the canvas.
  function drawCompass(plane) {
    const cx = VIEW_W / 2;
    const cy = 30;
    const w = 340;
    ctx.fillStyle = 'rgba(20, 16, 28, 0.55)';
    ctx.fillRect(cx - w / 2, cy - 16, w, 32);
    ctx.fillStyle = PALETTE.hudText;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW'], [360, 'N']];
    for (const [deg, label] of labels) {
      let rel = deg - plane.heading;
      while (rel > 180) rel -= 360;
      while (rel < -180) rel += 360;
      const x = cx + rel * 1.6;
      if (x < cx - w / 2 + 8 || x > cx + w / 2 - 8) continue;
      ctx.fillText(label, x, cy + 5);
      ctx.fillRect(x - 0.5, cy + 10, 1, 5);
    }
    // Centre caret.
    ctx.fillStyle = PALETTE.ring;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx - 6, cy - 24);
    ctx.lineTo(cx + 6, cy - 24);
    ctx.closePath();
    ctx.fill();
  }

  function render(state, time) {
    const { world, plane, screen } = state;
    const horizon = horizonY(plane);
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    drawSky(plane, time, world.mission.storm);
    drawMountains(plane, horizon);
    drawCanyonFloorAndWalls(world, plane, horizon, time);
    drawRunway(world, plane, horizon);
    drawRings(world, plane, horizon, time);
    if (screen === 'title') {
      // Title screen: the Skylark sits on the runway at the canyon mouth.
      drawPlane({ ...plane, bank: 0, pitch: 0, boosting: false }, time, 'title');
    } else {
      drawPlane(plane, time, 'play');
    }
    drawSmoke(plane, time);
    drawStormOverlay(plane, time, world.mission.storm);
    if (screen === 'play' || screen === 'paused' || screen === 'over' || screen === 'complete') {
      drawArtificialHorizon(plane);
      drawCompass(plane);
    }
  }

  return { render, horizonY };
}
