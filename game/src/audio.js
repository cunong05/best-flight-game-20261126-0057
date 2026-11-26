// WebAudio synthesis only — no audio files, no network.
// Engine hum follows the throttle, rings chime, wind whooshes, landings thud.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  // Start the continuous engine + wind bed. Called on first user gesture.
  function startEngine() {
    const ac = ensureContext();
    if (!ac || started) return;
    started = true;

    engineOsc = ac.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 62;
    engineOsc2 = ac.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 31;
    const engineFilter = ac.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ac.createGain();
    engineGain.gain.value = 0.0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ac.destination);
    engineOsc.start();
    engineOsc2.start();

    // Wind: looped noise buffer through a band-pass filter.
    const len = ac.sampleRate * 2;
    const buffer = ac.createBuffer(1, len, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSource = ac.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ac.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 700;
    windFilter.Q.value = 0.6;
    windGain = ac.createGain();
    windGain.gain.value = 0.0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ac.destination);
    windSource.start();
  }

  // Per-frame update: engine pitch follows throttle, wind follows speed.
  function updateEngine(throttle, speed, maxSpeed) {
    if (!ctx || !started || muted) return;
    const t = ctx.currentTime;
    const hum = 52 + throttle * 68;
    engineOsc.frequency.setTargetAtTime(hum, t, 0.08);
    engineOsc2.frequency.setTargetAtTime(hum / 2, t, 0.08);
    engineGain.gain.setTargetAtTime(muted ? 0 : 0.045 + throttle * 0.05, t, 0.1);
    const windLevel = Math.max(0, speed / maxSpeed);
    windGain.gain.setTargetAtTime(muted ? 0 : windLevel * 0.05, t, 0.15);
    windFilter.frequency.setTargetAtTime(500 + windLevel * 900, t, 0.15);
  }

  function blip(freq, dur, type, volume, when = 0) {
    const ac = ensureContext();
    if (!ac || muted) return;
    const t = ac.currentTime + when;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function ringChime() {
    blip(880, 0.35, 'sine', 0.16);
    blip(1318, 0.5, 'sine', 0.12, 0.07);
  }

  function warningBeep() {
    blip(620, 0.12, 'square', 0.07);
  }

  function thud(strength = 1) {
    const ac = ensureContext();
    if (!ac || muted) return;
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.22);
    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.28 * strength, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  function whoosh() {
    const ac = ensureContext();
    if (!ac || muted || !windGain) return;
    const t = ac.currentTime;
    windGain.gain.cancelScheduledValues(t);
    windGain.gain.setValueAtTime(windGain.gain.value, t);
    windGain.gain.linearRampToValueAtTime(0.16, t + 0.12);
    windGain.gain.linearRampToValueAtTime(0.04, t + 0.6);
  }

  function setMuted(m) {
    muted = m;
    if (ctx && engineGain) {
      engineGain.gain.setTargetAtTime(m ? 0 : 0.06, ctx.currentTime, 0.05);
      if (windGain) windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }
  }

  return {
    startEngine,
    updateEngine,
    ringChime,
    warningBeep,
    thud,
    whoosh,
    setMuted,
    get muted() { return muted; },
  };
}
