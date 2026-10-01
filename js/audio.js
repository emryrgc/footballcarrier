// WebAudio ile üretilen ses efektleri (dosya gerektirmez).
let ctx = null;
let master = null;
let crowd = null;
let noiseBuf = null;

export function initAudio() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function noise(dur, freq, q, gain, type = 'bandpass', attack = 0.005) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
  return { f, g, t };
}

function tone(freq, dur, type, gain, slide) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

export const sfx = {
  kick(p = 0.6) { tone(140, 0.09, 'sine', 0.5 * p + 0.2, 60); noise(0.06, 1800, 1, 0.25 * p + 0.1); },
  pass() { tone(180, 0.06, 'sine', 0.3, 90); noise(0.04, 2000, 1, 0.12); },
  post() { tone(880, 0.6, 'triangle', 0.25, 860); tone(1320, 0.4, 'sine', 0.12); },
  tackle() { noise(0.18, 600, 0.8, 0.35); },
  whistle(long = false) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.value = 2900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 38;
    const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain();
    const d = long ? 1.1 : 0.35;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + d - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(master);
    o.start(t); lfo.start(t); o.stop(t + d + 0.05); lfo.stop(t + d + 0.05);
  },
  cheer(big = true) {
    const n = noise(big ? 3.2 : 1.4, 900, 0.6, big ? 0.5 : 0.25, 'bandpass', 0.15);
    if (n && big) n.f.frequency.exponentialRampToValueAtTime(1500, n.t + 1);
  },
  groan() { const n = noise(1.4, 500, 0.7, 0.3, 'bandpass', 0.1); if (n) n.f.frequency.exponentialRampToValueAtTime(250, n.t + 1.2); },
  click() { tone(660, 0.05, 'square', 0.06); },
  crowdOn() {
    if (!ctx || crowd) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0.06;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    crowd = { src, g };
  },
  crowdOff() {
    if (!crowd) return;
    try { crowd.src.stop(); } catch (e) { /* zaten durdu */ }
    crowd = null;
  },
};
