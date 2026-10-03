/* IO — la radio. Música de videojuego compuesta para IO y tocada en vivo con Web Audio:
 * sin archivos, sin licencias, funciona sin internet. Suave a propósito: es para acompañarte
 * mientras haces tus hábitos, no para distraerte. Se desbloquea en el nivel 2 y cada estación abre en un nivel. */
import { cfg, saveCfg } from './store.js';

export const STATIONS = [
  { id: 'pixel', e: '👾', n: 'Pixel Pop', lvl: 2 },
  { id: 'lofi', e: '🎧', n: 'Lo-fi', lvl: 3 },
  { id: 'cafe', e: '☕', n: 'Café 8-bit', lvl: 4 },
  { id: 'aventura', e: '🗺️', n: 'Aventura', lvl: 6 },
  { id: 'noche', e: '🌙', n: 'Noche estrellada', lvl: 9 },
  { id: 'lluvia', e: '🌧️', n: 'Lluvia suave', lvl: 12 },
  { id: 'olas', e: '🌊', n: 'Olas', lvl: 15 },
  { id: 'espacio', e: '🌌', n: 'Espacio', lvl: 20 },
];
export const RADIO_LVL = 2;
export const unlocked = lvl => STATIONS.filter(s => lvl >= s.lvl);
export const byId = id => STATIONS.find(s => s.id === id);

let ac, master, bus, noiseBuf, softSq, cur = null, nodes = [], timer = 0, seq = null;
export const current = () => cur;

/* ---------- la consola de mezcla: todo pasa por un filtro tibio, un compresor y un eco suave ---------- */
function ctx() {
  ac ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  if (!master) {
    master = ac.createGain(); master.gain.value = 0;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4800; lp.Q.value = .4;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -22; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .25;
    master.connect(lp).connect(comp).connect(ac.destination);
    bus = ac.createGain(); bus.gain.value = 1; bus.connect(master);
    const dl = ac.createDelay(1); dl.delayTime.value = .29; const fb = ac.createGain(); fb.gain.value = .3;
    const tn = ac.createBiquadFilter(); tn.type = 'lowpass'; tn.frequency.value = 2000; const wet = ac.createGain(); wet.gain.value = .2;
    bus.connect(dl); dl.connect(tn).connect(fb).connect(dl); tn.connect(wet).connect(master);
    // onda "cuadrada suave": el sonido de consola, sin lo chillón
    const n = 16, re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k += 2) im[k] = 1 / Math.pow(k, 1.7);
    softSq = ac.createPeriodicWave(re, im);
  }
  if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return ac;
}
const keep = n => (nodes.push(n), n);
const mf = m => 440 * Math.pow(2, (m - 69) / 12);
/** Una nota. type: 'soft' (consola suave), 'sine', 'triangle'. */
function tone(m, t, dur, { type = 'triangle', g = .04, a = .01, rel = .2, vib = 0 } = {}) {
  const f = mf(m); const o = ac.createOscillator(), v = ac.createGain();
  if (type === 'soft') o.setPeriodicWave(softSq); else o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 5.2; lg.gain.value = f * vib; l.connect(lg).connect(o.frequency); l.start(t + .12); l.stop(t + dur + rel + .1); }
  v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + a);
  v.gain.setValueAtTime(g, t + Math.max(a + .005, dur * .6)); v.gain.exponentialRampToValueAtTime(.0004, t + dur + rel);
  o.connect(v).connect(bus); o.start(t); o.stop(t + dur + rel + .05);
}
function hit(t, { freq = 7000, type = 'highpass', g = .012, dur = .04, q = .7 } = {}) {
  const s = ac.createBufferSource(); s.buffer = noiseBuf; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const v = ac.createGain(); v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0003, t + dur);
  s.connect(f).connect(v).connect(bus); s.start(t, Math.random()); s.stop(t + dur + .02);
}
function kick(t, g = .1) {
  const o = ac.createOscillator(), v = ac.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .14);
  v.gain.setValueAtTime(g, t); v.gain.exponentialRampToValueAtTime(.0005, t + .22);
  o.connect(v).connect(bus); o.start(t); o.stop(t + .25);
}
/** Ruido de fondo continuo (lluvia, olas…), siempre suave. */
function bed(freq, g, type = 'lowpass', q = .5) {
  const s = keep(ac.createBufferSource()); s.buffer = noiseBuf; s.loop = true;
  const f = keep(ac.createBiquadFilter()); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const v = keep(ac.createGain()); v.gain.value = g; s.connect(f).connect(v).connect(master); s.start();
  return { s, f, g: v };
}
function lfo(param, rate, depth, base) {
  const o = keep(ac.createOscillator()); o.frequency.value = rate; const g = keep(ac.createGain()); g.gain.value = depth;
  param.value = base; o.connect(g).connect(param); o.start();
}

/* ---------- partituras: [paso, nota MIDI, duración en pasos] (16 pasos por compás) ---------- */
const M = bars => bars.flatMap((bar, b) => bar.map(([s, m, l]) => [b * 16 + s, m, l]));
const PIXEL_LEAD = M([
  [[0, 76, 2], [2, 79, 2], [4, 81, 1], [5, 79, 1], [6, 76, 2], [8, 74, 2], [10, 76, 2], [12, 72, 4]],
  [[0, 72, 2], [2, 76, 2], [4, 81, 2], [6, 79, 2], [8, 76, 2], [10, 74, 2], [12, 72, 2], [14, 69, 2]],
  [[0, 69, 2], [2, 72, 2], [4, 77, 2], [6, 76, 1], [7, 77, 1], [8, 79, 2], [10, 81, 2], [12, 79, 4]],
  [[0, 79, 2], [2, 77, 2], [4, 76, 2], [6, 74, 2], [8, 71, 2], [10, 74, 2], [12, 79, 4]],
]);
const ADV_LEAD = M([
  [[0, 67, 2], [2, 71, 2], [4, 74, 3], [7, 79, 1], [8, 78, 2], [10, 76, 2], [12, 74, 4]],
  [[0, 69, 2], [2, 74, 2], [4, 78, 3], [7, 81, 1], [8, 79, 2], [10, 78, 2], [12, 76, 4]],
  [[0, 76, 2], [2, 79, 2], [4, 83, 3], [7, 81, 1], [8, 79, 2], [10, 78, 2], [12, 79, 2], [14, 76, 2]],
  [[0, 72, 2], [2, 76, 2], [4, 79, 2], [6, 76, 2], [8, 74, 4], [12, 71, 1], [13, 72, 1], [14, 74, 2]],
]);
const CAFE_LEAD = M([
  [[0, 81, 3], [3, 79, 1], [4, 77, 2], [6, 76, 2], [10, 72, 2], [12, 74, 4]],
  [[0, 79, 3], [3, 77, 1], [4, 76, 2], [6, 74, 4], [12, 71, 4]],
  [[0, 77, 3], [3, 76, 1], [4, 74, 2], [6, 72, 2], [10, 69, 2], [12, 72, 4]],
  [[0, 76, 4], [4, 74, 2], [6, 72, 2], [8, 71, 2], [10, 72, 6]],
]);
// acordes (notas MIDI), uno por compás
const CH = {
  pixel: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
  lofi: [[50, 53, 57, 60, 64], [43, 53, 59, 64], [48, 52, 59, 62, 67], [45, 55, 61, 64]],
  cafe: [[41, 45, 48, 52], [40, 43, 47, 50], [38, 41, 45, 48], [36, 40, 43, 47]],
  adv: [[43, 47, 50], [38, 42, 45], [40, 43, 47], [36, 40, 43]],
  noche: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]],
  lluvia: [[45, 52, 57, 60], [41, 48, 53, 57], [36, 43, 48, 52], [43, 50, 55, 59]],
};
const loopOf = (step, bars = 4) => Math.floor(step / (bars * 16));
const at = (score, st) => score.find(x => x[0] === st % 64);

/* ---------- estaciones ---------- */
const BUILD = {
  pixel: { bpm: 96, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.pixel[bar], lp = loopOf(st);
    if (s % 4 === 0) tone(ch[0] - 12, t, sp * 3, { type: 'triangle', g: .06, rel: .1 });
    if (s % 4 === 2) tone(ch[0], t, sp * 1.5, { type: 'triangle', g: .035, rel: .08 });
    if (s % 2 === 0) tone(ch[(s / 2) % 3] + 12, t, sp * .9, { type: 'soft', g: .014, rel: .12 });
    if (lp % 2 === 0) { const n = at(PIXEL_LEAD, st); if (n) tone(n[1], t, sp * n[2], { type: 'soft', g: .026, rel: .25, vib: .004 }); }
    else if (s === 0 || s === 8) tone(ch[2] + 24, t, sp * 6, { type: 'sine', g: .02, rel: .8 });
    if (s === 0 || s === 8) kick(t, .07);
    if (s % 4 === 2) hit(t, { g: .008 });
  } },
  lofi: { bpm: 72, crackle: true, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.lofi[bar];
    if (s === 0) ch.forEach((m, i) => tone(m, t + i * .025, sp * 14, { type: 'sine', g: .022, a: .03, rel: 1.4 }));
    if (s === 10) ch.slice(1).forEach((m, i) => tone(m, t + i * .02, sp * 5, { type: 'sine', g: .012, a: .03, rel: .8 }));
    if (s === 0 || s === 7 || s === 10) kick(t, .08);
    if (s === 4 || s === 12) hit(t, { freq: 1800, type: 'bandpass', g: .028, dur: .13, q: 1.2 });
    if (s % 2 === 1) hit(t + sp * .1, { g: .006 });
    if ((s === 2 || s === 6 || s === 13) && Math.random() < .5) tone(ch[1 + Math.floor(Math.random() * (ch.length - 1))] + 12, t, sp * 2, { type: 'triangle', g: .014, rel: .5 });
  } },
  cafe: { bpm: 108, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.cafe[bar], lp = loopOf(st);
    if (s === 0 || s === 6 || s === 10) tone(ch[0] - 12 + (s === 6 ? 7 : 0), t, sp * 2, { type: 'triangle', g: .05, rel: .1 });
    if ([2, 5, 8, 11, 14].includes(s)) ch.forEach(m => tone(m + 12, t, sp * 1.2, { type: 'sine', g: .011, rel: .15 }));
    const n = at(CAFE_LEAD, st); if (n && lp % 2 === 0) tone(n[1], t, sp * n[2], { type: 'sine', g: .03, a: .03, rel: .3, vib: .006 });
    if (s % 2 === 0) hit(t, { freq: 6000, g: .006, dur: .05 });
  } },
  aventura: { bpm: 116, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.adv[bar], lp = loopOf(st);
    if (s % 2 === 0) tone((s % 4 === 0 ? ch[0] : ch[2]) - 12, t, sp * 1.6, { type: 'triangle', g: .055, rel: .06 });
    if (s % 4 === 2) ch.forEach(m => tone(m + 12, t, sp * .8, { type: 'soft', g: .009, rel: .08 }));
    const n = at(ADV_LEAD, st);
    if (n) tone(n[1] - (lp % 2 ? 12 : 0), t, sp * n[2], { type: 'soft', g: lp % 2 ? .02 : .026, rel: .22, vib: .004 });
    if (s % 8 === 0) kick(t, .07);
    if (s % 8 === 4) hit(t, { freq: 2000, type: 'bandpass', g: .022, dur: .1 });
  } },
  noche: { bpm: 60, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.noche[bar];
    if (s === 0) ch.forEach(m => [-.06, .06].forEach(d => tone(m + d, t, sp * 15, { type: 'sine', g: .012, a: 1.2, rel: 2.2 })));
    if (s % 2 === 0 && Math.random() < .7) tone(ch[Math.floor(Math.random() * ch.length)] + 24, t, sp, { type: 'sine', g: .018, a: .005, rel: .9 });
  } },
  lluvia: { bpm: 66, rain: true, play(st, t, sp) {
    const bar = Math.floor(st / 16) % 4, s = st % 16, ch = CH.lluvia[bar];
    if (s === 0) ch.forEach((m, i) => tone(m, t + i * .18, sp * 12, { type: 'sine', g: .022, a: .02, rel: 1.6 }));
    if (s === 8 && Math.random() < .6) tone(ch[3] + 12, t, sp * 4, { type: 'triangle', g: .012, rel: 1 });
  } },
  olas: { bpm: 60, waves: true, play(st, t, sp) {
    const bar = Math.floor(st / 32) % 4, s = st % 32;
    if (s === 0) CH.noche[bar].forEach(m => tone(m, t, sp * 28, { type: 'sine', g: .01, a: 2, rel: 3 }));
  } },
  espacio: { bpm: 50, space: true, play(st, t, sp) {
    if (st % 8 === 0 && Math.random() < .5) tone([72, 76, 79, 84, 88][Math.floor(Math.random() * 5)], t, sp * 3, { type: 'sine', g: .014, a: .02, rel: 2.5 });
  } },
};
function ambience(def) {
  if (def.crackle) { const n = bed(3500, .006, 'highpass'); lfo(n.g.gain, .7, .003, .006); }
  if (def.rain) { bed(900, .05, 'lowpass'); bed(2600, .012, 'bandpass', .6); }
  if (def.waves) { const n = bed(520, .12, 'lowpass', .6); lfo(n.g.gain, 1 / 8, .1, .12); lfo(n.f.frequency, 1 / 8, 260, 560); }
  if (def.space) {
    [110, 164.8, 220.5].forEach((f, i) => { const o = keep(ac.createOscillator()); o.type = 'sine'; o.frequency.value = f; const g = keep(ac.createGain()); g.gain.value = .025; lfo(g.gain, .05 + i * .03, .015, .025); o.connect(g).connect(master); o.start(); });
  }
}

export function stop() {
  clearInterval(timer); timer = 0; seq = null;
  const old = nodes; nodes = [];
  if (master && ac) master.gain.setTargetAtTime(0, ac.currentTime, .15);
  setTimeout(() => old.forEach(n => { try { n.stop?.(); } catch { /* */ } try { n.disconnect(); } catch { /* */ } }), 700);
  cur = null;
}
export function play(id) {
  const st = byId(id); if (!st) return stop();
  stop(); ctx();
  const def = BUILD[id]; cur = id; saveCfg({ radio: id });
  setTimeout(() => {
    if (cur !== id) return;
    ambience(def);
    seq = { step: 0, next: ac.currentTime + .1, sp: 60 / def.bpm / 4 };
    timer = setInterval(() => { // agenda las notas un poquito antes de que suenen: el ritmo no tiembla
      if (!seq) return;
      while (seq.next < ac.currentTime + .2) { def.play(seq.step, seq.next, seq.sp); seq.step++; seq.next += seq.sp; }
    }, 40);
    master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime((cfg.radioVol ?? .6) * .8, ac.currentTime, .5);
  }, 120);
}
export function setVolume(v) { saveCfg({ radioVol: v }); if (master && cur) master.gain.setTargetAtTime(v * .8, ac.currentTime, .1); }
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
