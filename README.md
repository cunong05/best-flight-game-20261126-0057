[![make.fun competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun rank](https://make.fun/badge/best-flight-game-20261126-0057/cunong05/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![make.fun reward](https://make.fun/badge/best-flight-game-20261126-0057/cunong05/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

# Skylark Courier: Ember Canyon Run

A 2D canvas chase-view flight game built from scratch for the [make.fun "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057).

You are the courier pilot of the little prop plane **Skylark K-7**, flying a delivery run down Ember Canyon to **Duskmere Field**. Thread the glowing rings, watch your fuel, respect the canyon walls — and bring her down gentle on the runway.

## How to play

- **W / S** or **↑ / ↓** — pitch (climb / descend)
- **A / D** or **← / →** — bank and turn (heading follows the bank)
- **Shift / Ctrl** — throttle up / down (mouse wheel works too)
- **Move the mouse** — steer toward the pointer
- **Space** — short boost (burns extra fuel)
- **P** — pause · **R** — restart · **M** — mute

Fly too slow and the Skylark stalls — the nose drops and the **STALL** lamp lights. Scrape a canyon wall or the canyon floor and you take damage. Run out of fuel or reach 100% damage and the run ends in the canyon.

## Missions

1. **Ring Run** — fly all 8 glowing rings. Each ring scores points and refunds a little fuel.
2. **Cargo Drop** — carry the cargo to Duskmere Field and land gently on the runway: low speed and a shallow descent earns a soft-landing bonus; come in hot and the plane takes damage.
3. **Storm Sprint** — race the clock through 8 rings in a storm: strong gusts shove the plane sideways and visibility drops.

## HUD

Altitude, speed and heading (with a compass strip), throttle and fuel gauges, score, rings remaining, mission text, a storm timer, an artificial horizon, and warning lamps for **STALL**, **LOW FUEL** and **TERRAIN**.

## Tech

- Pure 2D canvas, zero libraries, zero network requests — all art is drawn in code, all sound is WebAudio synthesis (engine hum follows the throttle, rings chime, landings thud).
- Source is split by job: `game/src/config.js` (tuning), `random.js` (seedable RNG), `input.js` (keyboard + mouse), `audio.js` (synth), `physics.js` (flight model), `world.js` (canyon, rings, runway, collisions), `render.js` (scene + gauges), `shots.js` (screenshot staging), `main.js` (boot + loop + screens).
- Open `game/index.html` in a browser to play. Screenshot staging: `?shot=start|play|end|crash&seed=1` — the page sets `window.__shotReady` when the frame is ready.

## Referral

Made with make.fun — referral code **4w89k05q**.

## License

MIT — see [LICENSE](LICENSE).
