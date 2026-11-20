// Original WebAudio sound: four radio stations (a tiny step sequencer, all notes
// synthesized — no samples, no copyrighted music), an engine hum, a police
// siren and one-shot effects. Everything is created lazily on the first user
// gesture; with no gesture yet every call is a no-op, so headless runs stay quiet.
import { STATIONS } from './config.js';

const midi = (m) => 440 * 2 ** ((m - 69) / 12);

// 16-step patterns. 0 means rest. Dangdut uses kendang drums (dang = low thump,
// tak = sharp slap); the others use kick / snare / hats.
const PATTERNS = [
  {
    // Dangdut Pantura: kendang + pentatonic melody.
    bass: [45, 0, 0, 48, 0, 0, 50, 0, 45, 0, 0, 48, 52, 0, 50, 0],
    lead: [69, 0, 72, 0, 74, 0, 72, 69, 67, 0, 69, 0, 72, 0, 74, 76],
    dang: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1],
    tak: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    hat: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
  },
  {
    // Neon Wave: synthwave bass arpeggio + pad.
    bass: [33, 0, 33, 0, 36, 0, 33, 0, 31, 0, 31, 0, 36, 0, 38, 0],
    lead: [57, 0, 0, 60, 0, 0, 64, 0, 62, 0, 0, 60, 0, 0, 57, 0],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  {
    // Solmara Lo-Fi: soft chords, lazy kick.
    bass: [41, 0, 0, 0, 0, 0, 0, 0, 36, 0, 0, 0, 0, 0, 0, 0],
    lead: [65, 0, 69, 0, 72, 0, 69, 0, 64, 0, 67, 0, 71, 0, 69, 0],
    kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    hat: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
  },
  {
    // Turbo Rock: square riff + backbeat.
    bass: [45, 45, 0, 48, 45, 0, 50, 0, 48, 45, 0, 43, 45, 0, 48, 0],
    lead: [69, 0, 69, 72, 0, 69, 0, 67, 69, 0, 72, 0, 74, 0, 72, 69],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
  },
];

export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let station = 0;
  let step = 0;
  let nextTime = 0;
  let muted = false;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let sirenPhase = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.16;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      // Engine: a low saw that follows the car's speed.
      engine = ctx.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engine.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engine.start();
      // Siren: two-tone square, quiet.
      siren = ctx.createOscillator();
      siren.type = 'square';
      siren.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      siren.connect(sirenGain);
      sirenGain.connect(master);
      siren.start();
      nextTime = ctx.currentTime + 0.1;
    } catch {
      ctx = null;
    }
  }

  function tone(time, type, freq, freqEnd, dur, gain) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), time + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }
  function noise(time, dur, gain, filterFreq) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function scheduleStep(index, time) {
    const pat = PATTERNS[station];
    const stepDur = 60 / STATIONS[station].bpm / 4;
    if (pat.dang && pat.dang[index]) tone(time, 'sine', 170, 75, 0.16, 0.5);
    if (pat.tak && pat.tak[index]) noise(time, 0.05, 0.3, 2400);
    if (pat.kick && pat.kick[index]) tone(time, 'sine', 130, 42, 0.14, 0.6);
    if (pat.snare && pat.snare[index]) noise(time, 0.12, 0.35, 1800);
    if (pat.hat && pat.hat[index]) noise(time, 0.03, 0.12, 7000);
    if (pat.bass[index]) tone(time, station === 3 ? 'square' : 'sawtooth', midi(pat.bass[index]), 0, stepDur * 0.9, 0.22);
    if (pat.lead[index]) tone(time, station === 1 ? 'sawtooth' : 'triangle', midi(pat.lead[index]), 0, stepDur * 0.85, 0.16);
    return stepDur;
  }

  // Called every frame: schedule radio notes just ahead of the playhead.
  function update(dt, speed, wanted) {
    if (!ctx) return;
    const stepDur = 60 / STATIONS[station].bpm / 4;
    while (nextTime < ctx.currentTime + 0.18) {
      scheduleStep(step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % 16;
    }
    if (engine && engineGain) {
      engine.frequency.value = 50 + Math.abs(speed) * 3.2;
      engineGain.gain.value = Math.abs(speed) > 0.5 ? 0.05 : 0.015;
    }
    if (siren && sirenGain) {
      if (wanted > 0) {
        sirenPhase += dt;
        siren.frequency.value = Math.floor(sirenPhase * 2) % 2 === 0 ? 720 : 950;
        sirenGain.gain.value = 0.025;
      } else {
        sirenGain.gain.value = 0;
      }
    }
  }

  function blip(freqA, freqB, dur, gain) {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'sine', freqA, 0, dur, gain);
    tone(t + dur, 'sine', freqB, 0, dur, gain);
  }
  function punch() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.08, 0.4, 900);
    tone(t, 'sine', 110, 55, 0.12, 0.4);
  }
  function crash() {
    // A crunch: filtered noise burst plus a low thud. Used for building
    // hits, roadblocks and ramming traffic.
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.18, 0.5, 500);
    tone(t, 'sine', 90, 40, 0.22, 0.5);
  }
  function fail() {
    // The clock ran out: two flat descending notes.
    if (!ctx) return;
    const t = ctx.currentTime;
    [57, 53].forEach((m, i) => tone(t + i * 0.18, 'triangle', midi(m), 0, 0.28, 0.22));
  }
  function horn() {
    // A car horn: two detuned squares, short.
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(t, 'square', 370, 0, 0.22, 0.12);
    tone(t, 'square', 466, 0, 0.22, 0.12);
  }
  function win() {
    // The Big Score fanfare: a rising major arpeggio, twice.
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84, 79, 84, 88, 91].forEach((m, i) => tone(t + i * 0.11, 'triangle', midi(m), 0, 0.3, 0.25));
  }
  function missionDone() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => tone(t + i * 0.09, 'triangle', midi(m), 0, 0.22, 0.25));
  }
  function busted() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [64, 60, 57, 52].forEach((m, i) => tone(t + i * 0.14, 'sawtooth', midi(m), 0, 0.3, 0.2));
  }

  function nextStation() {
    station = (station + 1) % STATIONS.length;
    step = 0;
    return STATIONS[station].name;
  }
  function stationName() {
    return STATIONS[station].name;
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.16;
    return muted;
  }
  function isMuted() {
    return muted;
  }

  return { unlock, update, blip, punch, crash, fail, horn, win, missionDone, busted, nextStation, stationName, toggleMute, isMuted };
}
