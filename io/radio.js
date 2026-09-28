/* IO — la radio. Sonidos ambiente generados en vivo con Web Audio: sin archivos, sin licencias,
 * funciona sin internet. Se desbloquea en el nivel 2 y cada estación abre en un nivel. */
import { cfg, saveCfg } from './store.js';

export const STATIONS = [
  { id: 'lluvia', e: '🌧️', n: 'Lluvia', lvl: 2 },
  { id: 'chip', e: '👾', n: '8-bit suave', lvl: 3 },
  { id: 'lofi', e: '🎧', n: 'Lo-fi', lvl: 4 },
  { id: 'bosque', e: '🌲', n: 'Bosque', lvl: 6 },
  { id: 'olas', e: '🌊', n: 'Olas', lvl: 9 },
  { id: 'cafe', e: '☕', n: 'Cafetería', lvl: 12 },
  { id: 'fuego', e: '🔥', n: 'Chimenea', lvl: 15 },
  { id: 'espacio', e: '🌌', n: 'Espacio', lvl: 20 },
];
export const RADIO_LVL = 2;
export const unlocked = lvl => STATIONS.filter(s => lvl >= s.lvl);
export const byId = id => STATIONS.find(s => s.id === id);

let ac, master, noiseBuf, cur = null, nodes = [], timers = [];
export const current = () => cur;

function ctx() {
  ac ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  if (!master) { master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination); }
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return ac;
}
const keep = n => (nodes.push(n), n);
const every = (ms, fn) => { const t = setInterval(fn, ms); timers.push(t); return t; };
function noise(type = 'lowpass', freq = 800, q = .7, gain = .3) {
  const s = keep(ac.createBufferSource()); s.buffer = noiseBuf; s.loop = true;
  const f = keep(ac.createBiquadFilter()); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = keep(ac.createGain()); g.gain.value = gain;
  s.connect(f).connect(g).connect(master); s.start();
  return { s, f, g };
}
function lfo(param, rate, depth, base) {
  const o = keep(ac.createOscillator()); o.frequency.value = rate; const g = keep(ac.createGain()); g.gain.value = depth;
  param.value = base; o.connect(g).connect(param); o.start();
}
function ping(freq, dur = .3, type = 'sine', gain = .08, when = 0, slideTo = 0) {
  const t = ac.currentTime + when; const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + .01); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
function burst(freq, dur = .05, gain = .1, type = 'bandpass', q = 4) {
  const t = ac.currentTime; const s = ac.createBufferSource(); s.buffer = noiseBuf;
  const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ac.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(.0005, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random() * 2); s.stop(t + dur + .02);
}
const R = (a, b) => a + Math.random() * (b - a);
const CHORDS = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 349.2], [164.8, 207.7, 246.9, 329.6]];

const BUILD = {
  lluvia() { noise('lowpass', 1200, .5, .35); noise('highpass', 5000, .5, .05); every(90, () => { if (Math.random() < .5) burst(R(2500, 6000), .03, R(.02, .07)); }); },
  olas() { const n = noise('lowpass', 500, .6, .25); lfo(n.g.gain, 1 / 8, .22, .25); lfo(n.f.frequency, 1 / 8, 350, 650); },
  bosque() { const n = noise('bandpass', 700, .4, .12); lfo(n.g.gain, 1 / 11, .06, .1); every(1700, () => { if (Math.random() < .55) { const f = R(1800, 3200); for (let i = 0; i < R(2, 5); i++) ping(f * R(.9, 1.15), .12, 'sine', .05, i * .14, f * 1.3); } }); },
  cafe() { const n = noise('bandpass', 600, .8, .16); lfo(n.f.frequency, .3, 200, 650); every(2300, () => { if (Math.random() < .4) ping(R(2400, 3600), .5, 'triangle', .035); }); },
  fuego() { noise('lowpass', 300, .5, .4); every(70, () => { if (Math.random() < .35) burst(R(1500, 4000), R(.01, .04), R(.05, .18), 'highpass', 1); }); },
  espacio() {
    [110, 164.8, 220.5, 277].forEach((f, i) => { const o = keep(ac.createOscillator()); o.type = 'sine'; o.frequency.value = f; const g = keep(ac.createGain()); g.gain.value = .05; lfo(g.gain, .05 + i * .03, .03, .05); o.connect(g).connect(master); o.start(); });
    const n = noise('bandpass', 400, 6, .04); lfo(n.f.frequency, .02, 300, 500);
  },
  lofi() {
    noise('highpass', 3000, .3, .025); // crujido de vinilo
    every(90, () => { if (Math.random() < .08) burst(R(3000, 7000), .01, .05, 'highpass', 1); });
    let step = 0; const beat = 60 / 72 / 2;
    const bar = () => {
      const ch = CHORDS[Math.floor(step / 8) % CHORDS.length];
      if (step % 8 === 0) ch.forEach((f, i) => ping(f, beat * 7.5, 'triangle', .03, i * .03));
      if (step % 4 === 0) ping(60, .25, 'sine', .22, 0, 40); // bombo suave
      if (step % 4 === 2) burst(1800, .12, .06);               // caja
      if (step % 2 === 1) burst(8000, .03, .03, 'highpass', 1); // hi-hat
      if (Math.random() < .25) ping(ch[Math.floor(R(0, 4))] * 2, beat * 1.8, 'sine', .025);
      step++;
    };
    every(beat * 1000, bar);
  },
  chip() {
    const notes = [523.3, 659.3, 784, 659.3, 587.3, 698.5, 880, 698.5, 493.9, 587.3, 784, 587.3, 523.3, 659.3, 784, 1046.5];
    let i = 0; every(220, () => { ping(notes[i % notes.length], .18, 'square', .018); if (i % 4 === 0) ping(notes[i % notes.length] / 4, .4, 'triangle', .04); i++; });
  },
};

export function stop() {
  timers.forEach(clearInterval); timers = [];
  const old = nodes; nodes = [];
  if (master && ac) { master.gain.setTargetAtTime(0, ac.currentTime, .15); }
  setTimeout(() => old.forEach(n => { try { n.stop?.(); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }), 600);
  cur = null;
}
export function play(id) {
  const st = byId(id); if (!st) return stop();
  stop(); ctx();
  setTimeout(() => {
    cur = id; BUILD[id]();
    master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime((cfg.radioVol ?? .6) * .7, ac.currentTime, .6);
  }, nodes.length ? 0 : 20);
  cur = id; saveCfg({ radio: id });
}
export function setVolume(v) { saveCfg({ radioVol: v }); if (master && cur) master.gain.setTargetAtTime(v * .7, ac.currentTime, .1); }
/** Pasa a la siguiente estación desbloqueada; después de la última, se apaga. */
export function next(lvl) {
  const list = unlocked(lvl); if (!list.length) return null;
  const i = list.findIndex(s => s.id === cur);
  if (i === list.length - 1) { stop(); saveCfg({ radio: '' }); return null; }
  const st = list[i + 1] || list[0]; play(st.id); return st;
}
export function toggle(lvl) {
  if (cur) { stop(); return null; }
  const st = byId(cfg.radio) && lvl >= byId(cfg.radio).lvl ? byId(cfg.radio) : unlocked(lvl)[0];
  if (st) play(st.id); return st || null;
}
