/* IO — la consola. Motor 2D del juego:
 * caminar (◀ ▶), ascensor (puerta a la izquierda: ▲ o A), interactuar con objetos (A),
 * modo decorar (SELECT: elegir, mover y guardar objetos), menú (START), minimapa, efectos y sonido.
 * Teclado: flechas/WASD · Z o Espacio = A · X = B · Shift = SELECT · Enter = START. */
import { setOf, furnHTML, BASE_SURF } from './rooms.js';
import { t as tr, locale } from './i18n.js';
import * as W from './world.js';
import * as Pet from './pet.js';
import { cfg, saveCfg } from './store.js';
import { avatarSVG } from './avatar.js';
import { speaker, NPC, npcSVG } from './npc.js';
import * as Lobby from './lobby.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

const E = {
  x: .45, dir: 1, held: null, raf: 0, last: 0,
  mode: 'walk', // walk | menu | elev | deco | ride | busy
  menuIdx: 0, elevSel: 1, elevWorld: null,
  deco: { sel: 0, moving: false, orig: null },
  hooks: {}, sayT: 0, typeT: 0,
  W: 1, cam: 0, zone: '', // W = ancho del piso en pantallas (el lobby es ancho y la cámara te sigue)
};
export const state = E;

/* ================= sonido 8-bit ================= */
let ac;
export function blip(kind = 'coin') {
  if (cfg.sound === false) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const seq = {
      coin: [[988, .07], [1319, .12]], menu: [[660, .04]], select: [[880, .05], [1175, .07]], back: [[523, .06], [392, .08]],
      error: [[220, .09], [196, .12]], ding: [[1318, .25], [1046, .4]], door: [[140, .12]], level: [[523, .1], [659, .1], [784, .1], [1047, .25]],
      crown: [[784, .08], [988, .08], [1175, .08], [1568, .3]], buy: [[392, .06], [523, .06], [659, .12]], start: [[440, .08], [660, .12]],
      done: [[523, .12], [659, .12], [784, .12], [1047, .12], [1319, .35]], step: [[90, .03]], place: [[330, .05], [247, .08]],
      shake: [[160, .05], [190, .05]], rare: [[659, .07], [880, .07], [1175, .2]], legend: [[523, .07], [659, .07], [784, .07], [1047, .07], [1319, .07], [1568, .07], [2093, .45]], tab: [[1175, .03]],
    }[kind] || [[988, .1]];
    let t = ac.currentTime;
    seq.forEach(([f, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = kind === 'ding' || kind === 'tab' ? 'triangle' : kind === 'door' || kind === 'step' || kind === 'shake' ? 'sawtooth' : 'square';
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(kind === 'step' || kind === 'tab' ? .02 : .045, t); g.gain.exponentialRampToValueAtTime(.0008, t + d);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02); t += d * .85;
    });
  } catch { /* sin audio */ }
}

/* ================= diálogo (estilo consola de bolsillo, con retrato del que habla) ================= */
const WHO = new Set(['io', 'me', 'pedro', 'rita', 'max']);
function normWho(who) {
  if (who && typeof who === 'object') return who;
  if (WHO.has(who)) return who;
  return who && (who === cfg.name || who === 'Tú') ? 'me' : 'io';
}
/** "Voz" del que habla: un bip corto por sílaba, con el tono de cada personaje. */
function voiceTick(v) {
  if (cfg.sound === false || !v) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') return;
    const t = ac.currentTime; const o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(v * (.9 + Math.random() * .2), t);
    g.gain.setValueAtTime(.011, t); g.gain.exponentialRampToValueAtTime(.0004, t + .045);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .05);
  } catch { /* sin audio */ }
}
function finishTyping() {
  clearInterval(E.typeT); E.typeT = 0;
  const box = $('dlg'); if (!box) return;
  $('dlgText').textContent = E.fullText || ''; box.classList.remove('typing'); $('dlgPt').classList.remove('talking');
}
/** Muestra una frase. ms = 0: se queda hasta que la cierras. who: 'io' | 'me' | 'pedro' | 'rita' | 'max' | { pet, name } */
export function say(text, ms = 5200, who = 'io') {
  text = tr(text); // en inglés se escribe ya traducido, letra por letra
  const box = $('dlg'); const el = $('dlgText'); if (!box) return;
  const sp = speaker(normWho(who));
  const id = sp.key + ':' + sp.name;
  box.style.setProperty('--sc', sp.c); box.dataset.who = sp.key;
  if (box.hidden || box.dataset.id !== id) { const pt = $('dlgPt'); pt.innerHTML = `<div class="pt-in" data-mood="happy">${sp.pt}</div>`; pt.classList.remove('pop'); void pt.offsetWidth; pt.classList.add('pop'); box.dataset.id = id; }
  $('dlgName').textContent = sp.name;
  if (box.hidden) { box.hidden = false; box.classList.remove('in'); void box.offsetWidth; box.classList.add('in'); }
  clearInterval(E.typeT); clearTimeout(E.sayT); E.fullText = text;
  if (reduced()) { el.textContent = text; box.classList.remove('typing'); }
  else {
    let i = 0; el.textContent = ''; box.classList.add('typing'); $('dlgPt').classList.add('talking');
    const chars = [...text];
    E.typeT = setInterval(() => {
      i++; el.textContent = chars.slice(0, i).join('');
      if (i % 2 === 0 && /[\p{L}\d]/u.test(chars[i - 1] || '')) voiceTick(sp.voice);
      if (i >= chars.length) finishTyping();
    }, 24);
  }
  if (ms) E.sayT = setTimeout(() => { if (E.mode !== 'talk') hush(); }, ms + text.length * 12);
}
export const hush = () => { clearInterval(E.typeT); E.typeT = 0; clearTimeout(E.sayT); const b = $('dlg'); if (b) { b.hidden = true; b.classList.remove('wait'); } };
/** Conversación: varias frases que avanzan con A (B cierra). lines: ['texto', …] o [['pedro', 'texto'], ['me', 'texto'], …] */
export function talk(who, lines, done) {
  if (E.mode !== 'talk') E.talkPrev = E.mode === 'busy' || E.mode === 'ride' ? 'walk' : E.mode;
  E.mode = 'talk'; E.talk = { who, lines: [].concat(lines).filter(Boolean), i: 0, done };
  $('hero')?.classList.remove('walking'); E.held = null;
  showLine();
}
function showLine() {
  const T = E.talk; const l = T.lines[T.i];
  const [w, txt] = Array.isArray(l) ? l : [T.who, l];
  say(txt, 0, w); const box = $('dlg'); box.classList.add('wait'); box.dataset.more = T.i < T.lines.length - 1 ? '1' : '';
}
function talkNext() {
  if (E.typeT) { finishTyping(); return; }
  const T = E.talk; if (!T) return hush();
  T.i++; blip('tab');
  if (T.i >= T.lines.length) endTalk(); else showLine();
}
/** Pregunta con opciones (como el SÍ / NO de las consolas). cb(i): i = opción elegida, -1 = cancelado. */
export function ask(who, text, opts, cb) {
  if (E.mode !== 'talk' && E.mode !== 'ask') E.talkPrev = E.mode === 'busy' || E.mode === 'ride' ? 'walk' : E.mode;
  E.mode = 'ask'; E.ask = { opts, i: 0, cb }; E.held = null; $('hero')?.classList.remove('walking');
  say(text, 0, who); $('dlg').classList.add('wait'); renderAsk();
}
function renderAsk() {
  const A = E.ask; const b = $('askBox'); if (!A || !b) return;
  b.innerHTML = A.opts.map((o, i) => `<button class="ask-o${i === A.i ? ' sel' : ''}" data-i="${i}">${esc(tr(o))}</button>`).join('');
  b.hidden = false;
}
function askPick(i) {
  const A = E.ask; if (!A) return; E.ask = null; $('askBox').hidden = true; hush();
  E.mode = E.talkPrev || 'walk'; blip(i >= 0 ? 'select' : 'back'); hints(); A.cb?.(i);
}
export function endTalk() {
  const T = E.talk; hush(); E.mode = E.talkPrev || 'walk'; E.talk = null; hints(); T?.done?.();
}

/* ================= escena ================= */
function floorNow() { const g = W.game(); const lvl = W.level(g); if (g.floor > lvl) { g.floor = lvl; W.saveGame(g); } return g.floor; }
export function render() {
  const g = W.game(); const n = floorNow(); const f = W.floorInfo(n); const lvl = W.level(g);
  const scene = $('scene');
  scene.dataset.skin = f.world.skin; scene.dataset.type = f.type; scene.dataset.view = f.view; scene.dataset.elev = f.world.elev;
  scene.classList.toggle('open', f.open);
  const set = setOf(f.type); SURF = mkSurf(set.surf);
  scene.dataset.hide = set.hide.join(' '); scene.classList.toggle('custom', !set.base); scene.classList.toggle('lobby', !!f.lobby);
  const rk = f.type + (W.roomHasFurniture(n) ? '+' : '');
  if ($('rset').dataset.k !== rk) { $('rset').dataset.k = rk; $('rset').innerHTML = f.lobby ? Lobby.lobbyHTML() : set.bg + (!set.base && W.roomHasFurniture(n) ? furnHTML(set.surf) : ''); if (f.lobby) E.hooks.onLobbyDraw?.(); }
  const wide = f.lobby ? Lobby.LOBBY_W : 1;
  if (E.W !== wide) { E.W = wide; E.x = wide > 1 ? (E.x < .2 ? Lobby.ELEV_X + .03 : clamp(E.x, .01, .99)) : clamp(E.x, .07, .94); }
  scene.classList.toggle('wide', wide > 1); scene.style.width = wide > 1 ? wide * 100 + '%' : '';
  $('elevBox').style.left = wide > 1 ? `calc(${Lobby.ELEV_X * 100}% - 31px)` : '';
  if (wide === 1) { scene.style.transform = ''; E.cam = 0; }
  scene.style.setProperty('--hue', (f.world.hue || 0) + 'deg');
  const h = new Date().getHours();
  scene.dataset.time = h >= 5 && h < 8 ? 'amanecer' : h >= 8 && h < 17 ? 'dia' : h >= 17 && h < 19 ? 'tarde' : 'noche';
  $('elevNum').textContent = n === 0 ? 'L' : n;
  $('floorTag').textContent = n === 0 ? `LOBBY · ${Lobby.zoneAt(E.x).n.toUpperCase()}` : `PISO ${n} · ${f.name.toUpperCase()}`;
  // objetos
  const objs = W.placedOn(g, n); const furn = W.roomHasFurniture(n);
  scene.classList.toggle('furn', furn);
  $('objs').innerHTML = objs.map(p => {
    const it = W.itemById(p.item); if (!it) return '';
    const band = it.band; const on = band === 'floor' && furn && p.on && SURF[p.on] ? p.on : 'floor';
    const x = on === 'floor' ? p.x : clamp(p.x, SURF[on].x0, SURF[on].x1);
    const pos = band === 'floor' ? `bottom:${SURF[on].b}` : band === 'wall' ? `top:${wallTop(p.y ?? .35)}` : `top:var(--ceilY)`;
    return `<button data-item="${p.item}" class="obj b-${band} on-${on}${it.kind === 'pet' ? ' pet' : ''}${it.kind === 'veh' ? ' veh' : ''}" data-u="${p.u}" data-y="${p.y ?? .35}" data-on="${on}" style="left:${x * 100}%;${pos};--s:${(it.s * (SURF[on]?.k || 1) * (band === 'wall' ? 1.3 : 1)).toFixed(2)}" aria-label="${esc(it.n)}" tabindex="-1"><span class="spr">${it.e}</span></button>`;
  }).join('');
  // héroe
  const look = cfg.avatar || {};
  const key = JSON.stringify(look);
  if ($('heroIn').dataset.k !== key) { $('heroIn').innerHTML = avatarSVG(look, 'av'); $('heroIn').dataset.k = key; }
  const hero = $('hero');
  hero.className = 'hero ' + ['head', 'face'].map(s => g.wear[s] ? 'wear-' + g.wear[s] : '').join(' ');
  renderPet(g);
  placeHero(); camera(true);
  // HUD
  const pr = W.progressOf(g.xp);
  $('lvlN').textContent = lvl; $('xpFill').style.width = (pr.pct * 100).toFixed(1) + '%'; $('xpFill').parentElement.title = `${pr.into}/${pr.need} XP`; $('xpT').textContent = `${pr.into}/${pr.need}`;
  countTo($('bitsN'), g.bits);
  renderMinimap(g, n, lvl);
  hints();
}
/** Los números suben contando, como monedas cayendo. */
function countTo(el, to) {
  const from = +el.dataset.v || 0; el.dataset.v = to;
  if (!el.textContent || from === to || reduced()) { el.textContent = to; return; }
  const t0 = performance.now(), d = Math.min(900, 250 + Math.abs(to - from) * 8);
  const step = t => { const k = Math.min(1, (t - t0) / d); el.textContent = Math.round(from + (to - from) * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function renderPet(g) {
  const pc = $('petc'); if (!pc) return; const p = Pet.get(g);
  pc.hidden = false; pc.classList.toggle('egg', p.stage === 0); pc.dataset.mood = p.mood;
  $('petE').textContent = p.e; $('petB').textContent = p.mood === 'triste' ? '💧' : p.mood === 'feliz' ? '❤️' : '';
  if (p.stage === 0) pc.style.left = '88%';
  pc.style.setProperty('--ps', [1, .75, .9, 1.1, 1.3][p.stage]);
}
function renderMinimap(g, n, lvl) {
  const w = W.worldOf(n);
  const count = w.to - w.from + 1;
  let html = '';
  for (let k = w.to; k >= w.from; k--) html += `<i class="${k === n ? 'here' : k <= lvl ? 'open' : ''}"></i>`;
  const mm = $('minimap');
  mm.innerHTML = `<b>${esc(w.n.split(' ').map(s => s[0]).join('').slice(0, 3))}</b><div class="mm-tower" style="--rows:${count}">${html}</div><span>${n}</span>`;
  mm.dataset.skin = w.skin;
}
function placeHero() {
  const hero = $('hero');
  hero.style.left = (E.x * 100) + '%';
  hero.classList.toggle('flip', E.dir < 0);
  const pc = $('petc'); if (pc && !pc.hidden && !pc.classList.contains('egg')) { pc.style.left = clamp(E.x - .1 / E.W * (E.dir || 1), .1 / E.W, 1 - .05 / E.W) * 100 + '%'; pc.classList.toggle('flip', E.dir < 0); }
  if (E.W > 1) zoneCheck();
}
/** Cámara: en el lobby el piso es más ancho que la pantalla y la vista sigue al personaje. */
function camera(snap = false) {
  if (E.W === 1) return;
  const sw = $('screen').clientWidth; const total = sw * E.W;
  const target = clamp(E.x * total - sw / 2, 0, total - sw);
  E.cam = snap ? target : E.cam + (target - E.cam) * .14;
  if (Math.abs(target - E.cam) < .3) E.cam = target;
  $('scene').style.transform = `translate3d(${-E.cam.toFixed(1)}px,0,0)`;
}
/** Al pasar de una zona del lobby a otra: letrero arriba, como en los juegos de antes. */
function zoneCheck() {
  const z = Lobby.zoneAt(E.x); if (z.id === E.zone) return;
  const first = !E.zone; E.zone = z.id;
  $('floorTag').textContent = tr(`LOBBY · ${z.n.toUpperCase()}`);
  if (first) return;
  const b = $('zoneBan'); b.textContent = tr(`${z.ic} ${z.n.toUpperCase()}`); b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); blip('tab');
}

/* ================= caminar e interacción ================= */
const xBounds = () => E.W > 1 ? [.012, .988] : [.07, .94];
const nearDoor = () => E.W > 1 ? Math.abs(E.x - Lobby.ELEV_X) < .032 : E.x < .2;
/** Punto del lobby más cercano donde A hace algo. */
function nearHot() {
  if (E.W === 1) return null;
  let best = null, bd = 1;
  for (const h of Lobby.HOT) { const d = Math.abs(h.x - E.x); if (d < h.r && d < bd) { bd = d; best = h; } }
  return best;
}
function nearObj() {
  const g = W.game(); const objs = W.placedOn(g, floorNow());
  let best = null, bd = .075;
  for (const p of objs) { const it = W.itemById(p.item); if (!it || it.band === 'ceiling') continue; const d = Math.abs(p.x - E.x); if (d < bd) { bd = d; best = p; } }
  return best;
}
function hints() {
  document.querySelectorAll('#objs .obj.near').forEach(o => o.classList.remove('near'));
  $('doorHint').hidden = !(E.mode === 'walk' && nearDoor());
  const hh = $('hotHint'); const h = E.mode === 'walk' && !nearDoor() ? nearHot() : null;
  if (hh) { hh.hidden = !h; if (h) { hh.style.left = h.x * 100 + '%'; hh.dataset.id = h.id; hh.querySelector('em').textContent = tr(h.label); } }
  if (E.mode !== 'walk') return;
  const p = nearObj(); if (p) document.querySelector(`#objs .obj[data-u="${p.u}"]`)?.classList.add('near');
}
function loop(t) {
  const dt = Math.min(.05, (t - (E.last || t)) / 1000); E.last = t;
  if (E.held === 'left' || E.held === 'right') {
    const d = E.held === 'left' ? -1 : 1;
    if (E.mode === 'walk') {
      E.dir = d; E.x = clamp(E.x + d * .3 * dt / E.W, ...xBounds()); placeHero(); hints();
      $('hero').classList.add('walking');
    } else if (E.mode === 'deco' && E.deco.moving) moveSel(d * .35 * dt, 0);
  } else if ((E.held === 'up' || E.held === 'down') && E.mode === 'deco' && E.deco.moving && decoObjs()[E.deco.sel] && W.itemById(decoObjs()[E.deco.sel].item).band === 'wall') moveSel(0, (E.held === 'up' ? -1 : 1) * .5 * dt);
  else $('hero')?.classList.remove('walking');
  if (E.W > 1) camera();
  E.raf = requestAnimationFrame(loop);
}

const INTERACT = {
  cama: ['sleep', '💤', 'Zzz… un descanso rápido.'], sofa: ['sit', '🍿', 'Un rato de sofá. Te lo ganaste.'], tv: ['sit', '📺', '¿Una serie? Primero el hábito 😉'], pantalla: ['sit', '🎬', '¡Función privada!'],
  piano: ['dance', '🎵', '♪ ♫ ♪'], guitarra: ['dance', '🎸', '¡Rock!'], microfono: ['dance', '🎤', '¡Uno, dos, probando!'],
  pesas: ['flex', '💪', '¡Una más!'], saco: ['flex', '🥊', '¡Pum! ¡Pum!'], bici_est: ['flex', '🚴', '¡A pedalear!'], colchoneta: ['float', '🧘', 'Respira…'],
  planta: ['wave', '💧', 'Planta regada 🌱'], arbol: ['wave', '💧', 'Crece como tú 🌳'], flores: ['wave', '🌸', 'Huele bien.'], cactus: ['wave', '🌵', '¡Auch!'], bambu: ['float', '🎋', 'Paz.'],
  estante: ['wave', '📖', 'Un buen libro espera.'], sillon: ['sit', '📖', 'El mejor rincón para leer.'], arcade: ['dance', '🕹️', '¡Nuevo récord!'], consola_tv: ['dance', '🎮', '¡Player 1!'],
  nevera: ['jump', '🥗', 'Algo saludable 🥗'], estufa: ['jump', '🍳', '¡Huele delicioso!'], frutas: ['jump', '🍎', 'Una manzana al día.'], cafetera: ['jump', '☕', 'Cafecito.'],
  jacuzzi: ['float', '🫧', 'Relax total.'], flotador: ['float', '💦', '¡Al agua!'], telescopio: ['wave', '✨', 'Se ven las estrellas.'], robot: ['wave', '🤖', 'BEEP. Sigue así, capitán.'],
  escritorio: ['wave', '💻', 'A trabajar en lo importante.'], monitor: ['wave', '💻', 'Enfocado.'], fuente: ['wave', '🪙', 'Pide un deseo.'],
};
function interact() {
  if (nearDoor()) return openElevator();
  const h = nearHot(); if (h) return lobbyAct(h);
  const p = nearObj();
  if (!p) { act('jump'); blip('menu'); return; }
  const it = W.itemById(p.item);
  if (it.kind === 'veh') { const el = document.querySelector(`#objs .obj[data-u="${p.u}"]`); el?.classList.remove('drive'); void el?.offsetWidth; el?.classList.add('drive'); blip('door'); say(`¡${it.e} Vamos a dar una vuelta!`, 2600, 'me'); setTimeout(() => el?.classList.remove('drive'), 2300); return; }
  if (it.kind === 'pet') { act('wave', '❤️'); say(`${it.e} ¡Te quiere!`, 2200, 'me'); blip('select'); return; }
  if (p.item === 'radio') { const on = E.hooks.onRadio?.(); act('dance', on ? '🎶' : '📻'); blip('select'); say(on ? `📻 ${on} · toca A otra vez para cambiar de estación` : '📻 Radio apagada', 3200, 'me'); return; }
  const [a, prop, line] = INTERACT[p.item] || ['wave', '✨', `${it.e} ${it.n}`];
  act(a, prop); blip('select'); say(line, 2600, 'me');
}
/** Lo que pasa al tocar A junto a algo del lobby. */
function lobbyAct(h) {
  blip('select');
  if (h.id === 'pedro' || h.id === 'max') { E.dir = h.x > E.x ? 1 : -1; placeHero(); document.querySelector(`.npc-${h.id}`)?.classList.add('talking'); }
  if (Lobby.AMENITY[h.id]) { E.hooks.onAmenity?.(h.id); return; }
  const g = W.game(); const lvl = W.level(g);
  const ctx = { name: cfg.name || 'Player', lvl, next: E.hooks.nextHabit?.() || '', streak: E.hooks.streak?.() || 0 };
  const L = Lobby.lines(h.id, ctx); if (!L) return;
  const end = () => { document.querySelectorAll('.npc.talking').forEach(n => n.classList.remove('talking')); };
  if (h.id === 'max' && lvl >= 100 && !g.owned.io100) { talk('max', L, () => { end(); const g2 = W.game(); g2.owned.io100 = 1; W.saveGame(g2); confetti(60); blip('legend'); act('dance', '🔑'); E.hooks.onLobbyDraw?.(); }); return; }
  talk(L[0][0], L, end);
}
export function act(kind = 'jump', prop = '') {
  const hero = $('hero'); if (!hero) return;
  ['act-jump', 'act-flex', 'act-dance', 'act-wave', 'act-sit', 'act-float', 'act-sleep'].forEach(c => hero.classList.remove(c));
  void hero.offsetWidth; hero.classList.add('act-' + kind);
  const p = $('prop');
  if (prop) { p.textContent = prop; p.classList.remove('show'); void p.offsetWidth; p.classList.add('show'); }
  clearTimeout(act.t); act.t = setTimeout(() => hero.classList.remove('act-' + kind), kind === 'sleep' || kind === 'float' ? 2600 : 1500);
}
export function setMood(m) { const w = $('heroIn'); if (w) w.dataset.mood = m; }

/* ================= ascensor ================= */
function openElevator() {
  hush(); E.mode = 'busy'; blip('door');
  $('scene').classList.add('doors-open');
  const hero = $('hero'); E.dir = -1; placeHero();
  setTimeout(() => {
    hero.classList.add('inside');
    const n = floorNow(); E.elevSel = n; E.elevWorld = W.worldOf(n); E.elevGreet = RITA_HI[Math.floor(Math.random() * RITA_HI.length)].replace('{n}', cfg.name || 'Player');
    E.mode = 'elev'; renderElevPanel();
  }, 450);
}
const RITA_HI = ['¿A qué piso vamos, {n}?', '¡Hola, {n}! ¿Arriba o abajo?', 'Bienvenido a bordo. ¿Qué piso?', '¿Visitamos tus pisos, {n}?'];
const RITA_TIPS = [
  '¡Subiendo! El hábito difícil va primero, cuando tienes más energía.',
  'Dicen que 2 minutos bastan para empezar. Lo demás llega solo.',
  'Cada piso que ves por aquí lo construiste tú. ¡Qué vista!',
  'Toma agua. Tu cerebro también hace ejercicio.',
  'Si hoy fallas, mañana vuelves. La racha se construye volviendo.',
  'Respira hondo: 4 segundos entra, 4 sale. ¿Ves? Ya hiciste uno.',
  'El que madruga… sube más pisos.',
  'Invita a un amigo: subir acompañado es más fácil.',
  'Ponle hora a tu hábito y el reloj te espera.',
  'No compares tu piso 3 con el piso 50 de otro. Cada quien sube a su ritmo.',
  'Un hábito pequeño hecho hoy vale más que uno grande planeado para mañana.',
  'Ordena tu cuarto y ordenas tu cabeza. Bueno, al menos el cuarto.',
];
function closeElevator() {
  $('elevPanel').hidden = true; $('hero').classList.remove('inside');
  $('scene').classList.remove('doors-open'); E.mode = 'walk'; E.x = E.W > 1 ? Lobby.ELEV_X + .03 : .2; placeHero(); hints();
}
function renderElevPanel() {
  const g = W.game(); const lvl = W.level(g); const w = E.elevWorld; const cur = floorNow(); const selN = E.elevSel;
  const worlds = W.worldsUpTo(Math.max(lvl, w.to)); const wi = worlds.findIndex(x => x.id === w.id);
  const count = w.to - w.from + 1; const bh = Math.max(9, Math.min(26, Math.floor(262 / count)));
  let bands = '';
  for (let k = w.to; k >= w.from; k--) {
    const f = W.floorInfo(k); const open = k <= lvl;
    bands += `<button class="tw-b${open ? '' : ' locked'}${k === selN ? ' sel' : ''}${k === cur ? ' cur' : ''}${k === lvl + 1 ? ' next' : ''}" data-floor="${k}" style="height:${bh}px" aria-label="Piso ${k}">
      <i>${k}</i>${bh >= 16 ? `<span>${open ? f.ic : '🔒'}</span>` : ''}${bh >= 22 && open ? `<em class="tw-n">${esc(f.name)}</em>` : ''}${k === cur ? `<em class="tw-car">${avatarSVG(cfg.avatar, 'av', '28 2 64 64')}</em>` : ''}</button>`;
  }
  const sel = W.floorInfo(selN); const open = selN <= lvl;
  const objs = open && g.placed[selN] ? g.placed[selN].map(p => W.itemById(p.item)?.e).filter(Boolean) : [];
  const need = W.xpAt(selN) - g.xp;
  const dir = selN > cur ? '▲' : selN < cur ? '▼' : '●';
  $('elevPanel').innerHTML = `
    <div class="ev-op"><div class="ev-op-pt">${speaker('rita').pt}</div><span>${esc(tr(E.elevGreet || '¿A qué piso vamos?'))}</span></div>
    <div class="ev-disp"><span class="ev-arrow${selN !== cur ? ' go' : ''}">${dir}</span><b>${selN === 0 ? 'LB' : String(selN).padStart(2, '0')}</b><div><small>ESTÁS EN EL ${cur}</small><strong>${esc(w.n.toUpperCase())}</strong></div></div>
    <div class="ev-main">
      <div class="ev-tower" data-skin="${w.skin}">
        <div class="ev-wsw"><button data-ew="-1" ${wi <= 0 ? 'disabled' : ''} aria-label="Edificio anterior">◀</button><small>${w.from}–${w.to}</small><button data-ew="1" ${w.to >= lvl + 25 ? 'disabled' : ''} aria-label="Edificio siguiente">▶</button></div>
        <div class="ev-roof"></div><div class="ev-bands">${bands}</div>${w.id === 1 ? `<button class="ev-lobby tw-b${selN === 0 ? ' sel' : ''}${cur === 0 ? ' cur' : ''}" data-floor="0" aria-label="Lobby">🏛️ LOBBY</button>` : '<div class="ev-lobby">LOBBY</div>'}
      </div>
      <div class="ev-card${open ? '' : ' locked'}">
        <div class="ev-ic">${open ? sel.ic : '🔒'}</div>
        <small>${selN === 0 ? 'PLANTA BAJA' : 'PISO ' + selN}</small><b>${esc(sel.name)}</b>
        <span class="ev-w">${esc(sel.world.n)}${sel.cap ? ` · 🚗×${sel.cap}` : ''}</span>
        ${selN === 0 ? '<div class="ev-objs"><em>Muro de fundadores · jugadores de IO</em></div>' : open ? `<div class="ev-objs">${objs.length ? objs.slice(0, 8).join(' ') : '<em>Aún sin visitar · trae regalos</em>'}</div>`
          : `<div class="ev-lock">Se abre en el <b>nivel ${selN}</b><small>faltan ${need.toLocaleString(locale)} XP</small><div class="ev-bar"><i style="width:${Math.min(100, g.xp / W.xpAt(selN) * 100)}%"></i></div></div>`}
        <button class="ev-go" data-go="${selN}" ${!open || selN === cur ? 'disabled' : ''}>${selN === cur ? 'Aquí estás' : open ? (selN === 0 ? `${dir} Ir al lobby` : `${dir} Ir al ${selN}`) : 'Bloqueado'}</button>
      </div>
    </div>
    <div class="ep-help">▲▼ piso · ◀▶ edificio · A ir · B salir</div>`;
  $('elevPanel').hidden = false;
  $('elevPanel').querySelector('.tw-b.sel')?.scrollIntoView({ block: 'nearest' });
}
function elevMove(dx, dy) {
  if (dx) return elevWorld(dx);
  const w = E.elevWorld; const k = E.elevSel + dy;
  if (k < (w.id === 1 ? 0 : w.from) || k > w.to) { blip('error'); return; }
  E.elevSel = k; blip('menu'); renderElevPanel();
}
function elevWorld(d) {
  const lvl = W.level(); const worlds = W.worldsUpTo(Math.max(lvl, E.elevWorld.to + 25));
  const i = worlds.findIndex(x => x.id === E.elevWorld.id) + d;
  if (i < 0 || i >= worlds.length || (d > 0 && worlds[i].from > lvl + 25)) { blip('error'); return; }
  E.elevWorld = worlds[i]; E.elevSel = clamp(Math.min(lvl, E.elevWorld.to), E.elevWorld.from, E.elevWorld.to);
  blip('menu'); renderElevPanel();
}
export function ride(target) {
  const lvl = W.level(); const cur = floorNow();
  if (target > lvl) { blip('error'); say(`🔒 El piso ${target} se abre cuando llegues al nivel ${target}. Cada hábito completo te acerca.`, 3800); return; }
  if (target === cur) { closeElevator(); return; }
  $('elevPanel').hidden = true; E.mode = 'ride';
  const r = $('elevRide'); const w = W.worldOf(target); const up = target > cur;
  const lo = Math.min(cur, target), hi = Math.max(cur, target); const span = hi - lo;
  const ticks = []; for (let k = hi; k >= lo; k--) if (span <= 14 || k === lo || k === hi || (k - lo) % Math.ceil(span / 12) === 0) ticks.push(k);
  const pos = k => (hi === lo ? 0 : (hi - k) / (hi - lo)) * 100;
  const dur = Math.min(3600, 2100 + span * 70);
  r.dataset.elev = w.elev; r.dataset.dir = up ? 'up' : 'down';
  const g0 = W.game();
  r.innerHTML = `<div class="rd-top"><div class="rd-disp"><span>${up ? '▲' : '▼'}</span><b id="rideNum">${cur}</b></div><div class="rd-tx"><small id="rideName">${esc(W.floorInfo(cur).name)}</small><em>${esc(tr('DESTINO'))} · ${target === 0 ? 'LOBBY' : target} ${W.floorInfo(target).ic}</em></div></div>
    <div class="rd-cab"><div class="rd-win"><i></i></div><div class="rd-rail"></div><div class="rd-btns">${'<i></i>'.repeat(12)}</div>
      <div class="npc rd-rita">${npcSVG('rita')}</div>
      <div class="rd-me ${['head', 'face'].map(k => g0.wear?.[k] ? 'wear-' + g0.wear[k] : '').join(' ')}" data-mood="happy">${avatarSVG(cfg.avatar, 'av')}</div>
      ${w.from === target && target > 1 ? `<div class="rd-new">✨ ${esc(w.n)}</div>` : ''}</div>
    <div class="rd-shaft"><div class="rd-cables"></div>${ticks.map(k => `<i class="rd-tick" style="top:${pos(k)}%"><b>${k}</b></i>`).join('')}<div class="rd-car" id="rdCar" style="top:${pos(cur)}%"></div></div>`;
  $('screen').classList.add('riding');
  setTimeout(() => say(RITA_TIPS[Math.floor(Math.random() * RITA_TIPS.length)], 0, 'rita'), 250);
  r.hidden = false; blip('door');
  const car = $('rdCar'); car.style.transition = `top ${dur}ms cubic-bezier(.55,0,.35,1)`;
  requestAnimationFrame(() => requestAnimationFrame(() => { car.style.top = pos(target) + '%'; }));
  const t0 = performance.now(); let last = cur;
  const tick = () => {
    const t = Math.min(1, (performance.now() - t0) / dur); const e = t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    const v = Math.round(cur + (target - cur) * e);
    if (v !== last) { last = v; $('rideNum').textContent = v; $('rideName').textContent = W.floorInfo(v).name; blip('step'); }
    if (t < 1) return requestAnimationFrame(tick);
    blip('ding'); r.classList.add('arrived');
    setTimeout(() => {
      const g = W.game(); g.floor = target; W.saveGame(g);
      E.x = target === 0 ? Lobby.ELEV_X : .09; E.dir = 1; E.zone = ''; render();
      r.hidden = true; r.classList.remove('arrived'); $('hero').classList.remove('inside'); $('screen').classList.remove('riding'); hush();
      $('hero').classList.remove('pop'); void $('hero').offsetWidth; $('hero').classList.add('pop');
      $('scene').classList.add('doors-open');
      setTimeout(() => { $('scene').classList.remove('doors-open'); }, 900);
      walkTo(target === 0 ? Lobby.ELEV_X + .035 : .24, () => { E.mode = 'walk'; hints(); });
      const f = W.floorInfo(target);
      if (target === 0) { const d = new Date().toDateString(); if (cfg.lobbyHi !== d) { saveCfg({ lobbyHi: d }); setTimeout(() => talk('pedro', [['pedro', '¡Bienvenido al lobby! Camina a la izquierda para ver el garaje del edificio, o a la derecha para la piscina, el gimnasio y la biblioteca.']]), 900); } }
      else say(`${f.ic} Piso ${target} · ${f.name}${f.world.from === target ? ` — bienvenido a ${f.world.n}` : ''}. ¡Que te vaya bien!`, 3200, 'rita');
      E.hooks.onFloor?.(target);
    }, 650);
  };
  requestAnimationFrame(tick);
}
function walkTo(x, done) {
  const hero = $('hero'); hero.classList.add('walking');
  const step = () => {
    const d = x - E.x; if (Math.abs(d) < .005) { hero.classList.remove('walking'); done?.(); return; }
    E.dir = Math.sign(d); E.x += Math.sign(d) * Math.min(Math.abs(d), .006 / E.W); placeHero(); hints(); requestAnimationFrame(step);
  };
  step();
}

/* ================= menú START (estilo Game Boy) ================= */
const MENU = [['continuar', 'Continuar'], ['mochila', '🎒 Mochila'], ['tienda', '🛒 Tienda'], ['ranking', '🏆 Ranking'], ['progreso', '📈 Progreso'], ['mapa', '🗺️ Mapa'], ['personaje', '🧍 Personaje'], ['logros', '🏅 Logros'], ['ajustes', '⚙️ Ajustes']];
function openMenu() {
  hush(); E.mode = 'menu'; E.menuIdx = 0; blip('start'); renderMenu();
}
function renderMenu() {
  const g = W.game();
  $('gbMenu').innerHTML = `<div class="gbm-box"><div class="gbm-h">${esc(cfg.name || 'PLAYER 1')}<span>NV ${W.level(g)} · ${g.bits}◆</span></div>${MENU.map(([k, l], i) => `<button class="gbm-i${i === E.menuIdx ? ' sel' : ''}" data-menu="${k}">${l}</button>`).join('')}<div class="gbm-f">✥ mover · A elegir · B cerrar</div></div>`;
  $('gbMenu').hidden = false;
}
function closeMenu() { $('gbMenu').hidden = true; E.mode = 'walk'; }
function chooseMenu(k) {
  closeMenu(); blip('select');
  if (k === 'continuar') return;
  E.hooks.onMenu?.(k);
}

/* ================= modo decorar ================= */
function decoObjs() { const g = W.game(); return [...W.placedOn(g, floorNow())].sort((a, b) => a.x - b.x); }
export function enterDeco(selectU = null) {
  if (floorNow() === 0) { say('🏛️ El lobby es de todos. Decora tus propios pisos.', 3000); return; }
  hush(); E.mode = 'deco'; E.deco = { sel: 0, moving: false, orig: null };
  const list = decoObjs();
  if (selectU) { E.deco.sel = Math.max(0, list.findIndex(p => p.u === selectU)); E.deco.moving = true; E.deco.orig = { ...list[E.deco.sel] }; }
  $('screen').classList.add('deco'); blip('select'); decoUI();
}
function exitDeco() { E.mode = 'walk'; $('screen').classList.remove('deco'); $('decoBar').hidden = true; document.querySelectorAll('#objs .obj.sel,#objs .obj.moving').forEach(o => o.classList.remove('sel', 'moving')); blip('back'); hints(); }
function decoUI() {
  const list = decoObjs(); const p = list[E.deco.sel];
  document.querySelectorAll('#objs .obj').forEach(o => o.classList.toggle('sel', !!p && o.dataset.u === p.u));
  document.querySelectorAll('#objs .obj').forEach(o => o.classList.toggle('moving', !!p && E.deco.moving && o.dataset.u === p.u));
  const it = p ? W.itemById(p.item) : null;
  $('decoBar').hidden = false;
  $('decoBar').innerHTML = !list.length ? `<b>MODO DECORAR</b><span>Este piso está vacío · START → poner algo de la mochila</span>`
    : E.deco.moving ? `<b>MOVIENDO ${it.e} ${esc(it.n.toUpperCase())}</b><span>◀▶ mover · ${it.band === 'wall' ? '▲▼ subir/bajar' : W.surfacesOf(it).length > 1 ? (it.kind === 'veh' ? '▲▼ elevador/piso' : '▲▼ repisa/mesa/piso') : ''} · A soltar · B cancelar</span>`
    : `<b>MODO DECORAR · ${it.e} ${esc(it.n)}</b><span>◀▶ elegir · A mover · START opciones · B salir</span>`;
}
const wallTop = y => `calc(var(--wallTop) + ${(y * 100).toFixed(1)}% * var(--wallK))`;
/* superficies del cuarto (fracciones de la escena): piso, aparador bajo la ventana y dos repisas */
// Cada piso define sus propias superficies (rooms.js); el piso siempre existe.
const FLOOR_SURF = { x0: .22, x1: .95, b: 'var(--floorY)', k: 1, f: .17 };
const kindOf = (k, s) => s.kind || (k.startsWith('shelf') ? 'shelf' : k.startsWith('lift') ? 'lift' : 'table');
const mkSurf = surf => {
  const out = { floor: FLOOR_SURF };
  for (const [k, s] of Object.entries(surf)) { const kind = kindOf(k, s); out[k] = { x0: s.x0, x1: s.x1, b: (s.f * 100).toFixed(1) + '%', f: s.f, kind, k: kind === 'lift' ? .9 : kind === 'table' ? .82 : .7, max: s.max || 3 }; }
  return out;
};
let SURF = mkSurf(BASE_SURF);
/** Superficies libres donde puede ir el objeto, de abajo hacia arriba (piso, mesas, repisas, elevador de carros). */
function surfOptions(p) {
  const it = W.itemById(p.item); if (!W.roomHasFurniture(floorNow())) return ['floor'];
  const kinds = W.surfacesOf(it);
  const others = W.placedOn(W.game(), floorNow()).filter(q => q.u !== p.u);
  const names = Object.keys(SURF).filter(k => k !== 'floor' && kinds.includes(SURF[k].kind) && others.filter(q => q.on === k).length < SURF[k].max).sort((a, b) => SURF[a].f - SURF[b].f);
  return ['floor', ...names];
}
function applySurf(el, it, on) {
  el.dataset.on = on; el.className = el.className.replace(/\bon-\w+/, 'on-' + on);
  el.style.bottom = SURF[on].b; el.style.setProperty('--s', (it.s * SURF[on].k).toFixed(2));
  const x = clamp(parseFloat(el.style.left) / 100, SURF[on].x0, SURF[on].x1); el.style.left = x * 100 + '%';
}
/** Un hueco libre en la repisa o el aparador (3 puestos por superficie). */
function freeSlot(on, skipU = null) {
  const S = SURF[on]; const m = S.max || 3; const w = (S.x1 - S.x0) / m;
  const used = W.placedOn(W.game(), floorNow()).filter(q => q.on === on && q.u !== skipU).map(q => q.x);
  const slots = [...Array(m)].map((_, i) => S.x0 + w * (i + .5));
  return slots.find(x => used.every(u => Math.abs(u - x) > w * .6)) ?? slots[Math.floor(m / 2)];
}
function cycleSurf(dir) {
  const p = decoObjs()[E.deco.sel]; if (!p) return;
  const el = document.querySelector(`#objs .obj[data-u="${p.u}"]`); const it = W.itemById(p.item);
  const opts = surfOptions(p); const i = opts.indexOf(el.dataset.on || 'floor') + dir;
  if (i < 0 || i >= opts.length) { blip('error'); if (opts.length === 1) say(`${it.e} va en el piso. Lo pequeño (velas, plantas, cactus, TV…) va en repisas o en el aparador.`, 3500); return; }
  applySurf(el, it, opts[i]); if (opts[i] !== 'floor') el.style.left = freeSlot(opts[i], p.u) * 100 + '%'; blip('place');
}
function moveSel(dx, dy) {
  const p = decoObjs()[E.deco.sel]; if (!p) return;
  const el = document.querySelector(`#objs .obj[data-u="${p.u}"]`); if (!el) return;
  const it = W.itemById(p.item);
  const sf = it.band === 'floor' ? SURF[el.dataset.on || 'floor'] : { x0: .2, x1: .95 };
  el.style.left = clamp(parseFloat(el.style.left) / 100 + dx, sf.x0, sf.x1) * 100 + '%';
  if (it.band === 'wall' && dy) { const y = clamp(parseFloat(el.dataset.y) + dy, 0, 1); el.dataset.y = y; el.style.top = wallTop(y); }
}
function decoA() {
  const list = decoObjs(); if (!list.length) return;
  if (!E.deco.moving) { E.deco.moving = true; E.deco.orig = { ...list[E.deco.sel] }; blip('select'); }
  else { E.deco.moving = false; saveDecoPositions(); blip('place'); }
  decoUI();
}
function saveDecoPositions() {
  // las posiciones se mutaron en el objeto de estado cargado; volver a leer y aplicar desde el DOM
  const g = W.game(); const n = floorNow(); const list = W.placedOn(g, n);
  document.querySelectorAll('#objs .obj').forEach(el => {
    const p = list.find(q => q.u === el.dataset.u); if (!p) return;
    p.x = parseFloat(el.style.left) / 100;
    if (el.classList.contains('b-wall')) p.y = parseFloat(el.dataset.y);
    if (el.classList.contains('b-floor')) { if (el.dataset.on && el.dataset.on !== 'floor') p.on = el.dataset.on; else delete p.on; }
  });
  g.stats.moved = (g.stats.moved || 0) + 1;
  W.saveGame(g);
}
function decoB() {
  if (E.deco.moving) { // cancelar: volver a la posición original
    const o = E.deco.orig; const el = document.querySelector(`#objs .obj[data-u="${o.u}"]`);
    if (el) { el.style.left = o.x * 100 + '%'; const it = W.itemById(o.item); if (o.y != null && it.band === 'wall') { el.dataset.y = o.y; el.style.top = wallTop(o.y); } if (it.band === 'floor') applySurf(el, it, o.on && SURF[o.on] ? o.on : 'floor'); }
    E.deco.moving = false; blip('back'); decoUI(); return;
  }
  saveDecoPositions(); exitDeco();
}
function decoStart() {
  const list = decoObjs(); const p = list[E.deco.sel];
  E.hooks.onDecoMenu?.(p ? p.u : null);
}
export function storeSelected(u) {
  const g = W.game(); const n = floorNow();
  g.placed[n] = W.placedOn(g, n).filter(p => p.u !== u); W.saveGame(g);
  render(); if (E.mode === 'deco') { E.deco.sel = 0; E.deco.moving = false; decoUI(); }
}
export function placeFromBag(itemId) {
  const g = W.game(); const n = floorNow(); const it = W.itemById(itemId);
  const why = W.canPlaceHere(g, it, n); if (why) { say(why, 4200); blip('error'); return false; }
  const p = { u: Math.random().toString(36).slice(2, 9), item: itemId, x: clamp(E.x + .12, .22, .9), y: it.band === 'wall' ? .35 : null };
  let up = surfOptions(p).filter(s => s !== 'floor').reverse()[0]; // lo pequeño va directo a una repisa libre
  if (it.kind === 'veh') { const floorTaken = W.placedOn(g, n).some(q => W.itemById(q.item)?.kind === 'veh' && (!q.on || q.on === 'floor')); up = floorTaken ? surfOptions(p).find(s => SURF[s]?.kind === 'lift') : null; }
  if (up) { p.on = up; p.x = freeSlot(up); }
  W.placedOn(g, n).push(p); W.saveGame(g); render();
  enterDeco(p.u); say(W.surfacesOf(it).length > 1 && W.roomHasFurniture(n) ? (it.kind === 'veh' ? `Mueve ${it.e} con ◀ ▶ · ▲▼ elevador o piso · A suelta.` : `Mueve ${it.e} con ◀ ▶ · ▲▼ repisa, mesa o piso · A suelta.`) : `Mueve ${it.e} con ◀ ▶ y suelta con A.`, 4000);
  return true;
}
// arrastrar con el dedo en modo decorar
function setupDrag() {
  const layer = $('objs'); let drag = null;
  layer.addEventListener('pointerdown', e => {
    const o = e.target.closest('.obj'); if (!o) return;
    if (E.mode !== 'deco') { if (E.mode === 'walk') { const u = o.dataset.u; const p = decoObjs().find(q => q.u === u); if (p) { walkTo(clamp(p.x - .06 * Math.sign(p.x - E.x || 1), .07, .94), () => interact()); } } return; }
    const list = decoObjs(); E.deco.sel = list.findIndex(p => p.u === o.dataset.u); E.deco.moving = true; E.deco.orig = { ...list[E.deco.sel] }; decoUI();
    drag = { o, rect: $('scene').getBoundingClientRect() }; o.setPointerCapture(e.pointerId); e.preventDefault();
  });
  layer.addEventListener('pointermove', e => {
    if (!drag) return;
    const x = clamp((e.clientX - drag.rect.left) / drag.rect.width, .2, .95);
    drag.o.style.left = x * 100 + '%';
    if (drag.o.classList.contains('b-floor')) {
      const p = decoObjs()[E.deco.sel]; const it = W.itemById(p.item); const opts = surfOptions(p);
      const yb = (drag.rect.bottom - e.clientY) / drag.rect.height;
      // la superficie más cercana a donde está el dedo (si el objeto cabe ahí)
      let on = 'floor', best = Math.abs(yb - SURF.floor.f) + .06;
      for (const sName of opts) { const S = SURF[sName]; if (sName === 'floor' || !S || x < S.x0 - .04 || x > S.x1 + .04) continue; const d = Math.abs(yb - S.f - .04); if (d < best) { best = d; on = sName; } }
      if (on !== drag.o.dataset.on) applySurf(drag.o, it, on); else if (on !== 'floor') drag.o.style.left = clamp(x, SURF[on].x0, SURF[on].x1) * 100 + '%';
    }
    if (drag.o.classList.contains('b-wall')) {
      const cs = getComputedStyle($('scene')); const top = parseFloat(cs.getPropertyValue('--wallTop')) || 64; const k = parseFloat(cs.getPropertyValue('--wallK')) || .45;
      const y = clamp((e.clientY - drag.rect.top - top - 16) / (drag.rect.height * k), 0, 1);
      drag.o.dataset.y = y; drag.o.style.top = wallTop(y);
    }
  });
  const up = () => { if (!drag) return; drag = null; E.deco.moving = false; saveDecoPositions(); blip('place'); decoUI(); };
  layer.addEventListener('pointerup', up); layer.addEventListener('pointercancel', up);
  // tocar el piso: caminar hasta ahí
  $('scene').addEventListener('pointerdown', e => {
    if (E.mode !== 'walk' || e.target.closest('.obj,.elev,#minimap,.hud,#dlg,#petc')) return;
    const r = $('scene').getBoundingClientRect(); walkTo(clamp((e.clientX - r.left) / r.width, ...xBounds()));
  });
  $('elevBox').addEventListener('click', () => { if (E.mode === 'walk') walkTo(E.W > 1 ? Lobby.ELEV_X : .1, () => openElevator()); });
  $('hotHint')?.addEventListener('click', e => { e.stopPropagation(); const h = Lobby.HOT.find(x => x.id === $('hotHint').dataset.id); if (h && E.mode === 'walk') walkTo(clamp(h.x - .012 * Math.sign(h.x - E.x || 1), ...xBounds()), () => interact()); });
}

/* ================= controles ================= */
function press(btn) {
  if (E.mode === 'ride' || E.mode === 'busy') return;
  if (E.mode === 'talk') { if (btn === 'a' || btn === 'start' || btn === 'down') talkNext(); else if (btn === 'b') endTalk(); return; }
  if (E.mode === 'ask') {
    if (E.typeT && btn === 'a') { finishTyping(); return; }
    if (btn === 'up' || btn === 'down' || btn === 'left' || btn === 'right') { const n = E.ask.opts.length; E.ask.i = (E.ask.i + (btn === 'up' || btn === 'left' ? -1 : 1) + n) % n; blip('menu'); renderAsk(); }
    else if (btn === 'a' || btn === 'start') askPick(E.ask.i); else if (btn === 'b') askPick(-1);
    return;
  }
  if (E.mode === 'menu') {
    if (btn === 'up' || btn === 'down') { E.menuIdx = (E.menuIdx + (btn === 'up' ? -1 : 1) + MENU.length) % MENU.length; blip('menu'); renderMenu(); }
    else if (btn === 'a') chooseMenu(MENU[E.menuIdx][0]);
    else if (btn === 'b' || btn === 'start') { closeMenu(); blip('back'); }
    return;
  }
  if (E.mode === 'elev') {
    if (btn === 'left') elevMove(-1, 0); else if (btn === 'right') elevMove(1, 0);
    else if (btn === 'up') elevMove(0, 1); else if (btn === 'down') elevMove(0, -1);
    else if (btn === 'a') ride(E.elevSel); else if (btn === 'b') { closeElevator(); blip('back'); }
    else if (btn === 'select') elevWorld(1);
    return;
  }
  if (E.mode === 'deco') {
    if (!E.deco.moving && (btn === 'left' || btn === 'right')) { const n = decoObjs().length; if (n) { E.deco.sel = (E.deco.sel + (btn === 'left' ? -1 : 1) + n) % n; blip('menu'); decoUI(); } }
    else if (btn === 'a') decoA(); else if (btn === 'b' || btn === 'select') decoB(); else if (btn === 'start') decoStart();
    else if (E.deco.moving && btn === 'left') moveSel(-.03, 0); else if (E.deco.moving && btn === 'right') moveSel(.03, 0);
    else if (E.deco.moving && (btn === 'up' || btn === 'down')) { const p = decoObjs()[E.deco.sel]; if (p && W.itemById(p.item).band === 'floor') cycleSurf(btn === 'up' ? 1 : -1); else moveSel(0, btn === 'up' ? -.08 : .08); }
    return;
  }
  // caminando
  if (btn === 'left' || btn === 'right') { E.dir = btn === 'left' ? -1 : 1; E.x = clamp(E.x + E.dir * .035 / E.W, ...xBounds()); placeHero(); hints(); }
  else if (btn === 'up') { if (nearDoor()) openElevator(); else { act('jump'); blip('menu'); } }
  else if (btn === 'down') { act('sit'); }
  else if (btn === 'a') interact();
  else if (btn === 'b') { act('dance', '🎶'); blip('select'); }
  else if (btn === 'select') enterDeco();
  else if (btn === 'start') openMenu();
}
function setupControls() {
  document.querySelectorAll('[data-btn]').forEach(b => {
    const k = b.dataset.btn;
    b.addEventListener('pointerdown', e => {
      e.preventDefault(); b.classList.add('down'); press(k); try { navigator.vibrate?.(6); } catch { /* */ }
      if (['left', 'right', 'up', 'down'].includes(k)) E.held = k;
      if (ac?.state === 'suspended') ac.resume();
    });
    const up = () => { b.classList.remove('down'); if (E.held === k) E.held = null; };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', z: 'a', ' ': 'a', x: 'b', Shift: 'select', Enter: 'start' };
  addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select') || document.querySelector('.sheet.open,.focus:not([hidden]),.onb:not([hidden]),.reveal:not([hidden]),.streak-ov:not([hidden])')) return;
    const k = map[e.key]; if (!k) return; e.preventDefault();
    if (!e.repeat) press(k);
    if (['left', 'right', 'up', 'down'].includes(k)) E.held = k;
  });
  addEventListener('keyup', e => { const k = map[e.key]; if (k && E.held === k) E.held = null; });
  $('gbMenu').addEventListener('click', e => { const b = e.target.closest('[data-menu]'); if (b) chooseMenu(b.dataset.menu); else if (e.target === $('gbMenu')) closeMenu(); });
  $('elevPanel').addEventListener('click', e => {
    const b = e.target.closest('[data-floor]'); if (b) { E.elevSel = +b.dataset.floor; blip('menu'); renderElevPanel(); return; }
    const go = e.target.closest('[data-go]'); if (go && !go.disabled) { ride(+go.dataset.go); return; }
    const w = e.target.closest('[data-ew]'); if (w) elevWorld(+w.dataset.ew);
  });
  $('minimap').addEventListener('click', () => E.hooks.onMenu?.('mapa'));
  $('petc').addEventListener('click', e => { e.stopPropagation(); if (E.mode !== 'walk') return; const p = Pet.get(); blip('select'); $('petc').classList.remove('hop'); void $('petc').offsetWidth; $('petc').classList.add('hop');
    say(p.stage === 0 ? `🥚 Se mueve… nace en ${p.toNext} corona${p.toNext === 1 ? '' : 's'}.` : Pet.line(p), 3000, { pet: p.e, name: p.stage ? p.name : 'Huevo' }); });
  document.querySelector('.hud').addEventListener('click', e => { const h = e.target.closest('[data-hud]'); if (h && E.mode === 'walk') { blip('select'); E.hooks.onMenu?.('stats:' + h.dataset.hud); } });
  $('dlg').addEventListener('click', e => { e.stopPropagation(); if (E.mode === 'talk') talkNext(); else if (E.mode === 'ask') { if (E.typeT) finishTyping(); } else hush(); });
  $('askBox').addEventListener('click', e => { e.stopPropagation(); const o = e.target.closest('[data-i]'); if (o && E.mode === 'ask') askPick(+o.dataset.i); });
}

/* ================= efectos ================= */
export function confetti(n = 30) {
  const fx = $('fx'); if (!fx || reduced()) return;
  const cols = ['#4ade80', '#a78bfa', '#22d3ee', '#fbbf24', '#f472b6', '#f87171'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'cf';
    s.textContent = Math.random() > .55 ? (Math.random() > .5 ? '1' : '0') : '';
    s.style.setProperty('--dx', (Math.random() * 2 - 1) * 170 + 'px'); s.style.setProperty('--dy', -(70 + Math.random() * 130) + 'px'); s.style.setProperty('--r', Math.random() * 720 + 'deg');
    s.style.color = s.style.background = cols[i % cols.length]; if (s.textContent) s.style.background = 'none';
    s.style.left = (E.x * 100 + (Math.random() * 10 - 5)) + '%';
    fx.appendChild(s); setTimeout(() => s.remove(), 1500);
  }
}
export function floatText(txt, cls = '') {
  const fx = $('fx'); const s = document.createElement('span'); s.className = 'ftxt ' + cls; s.textContent = txt;
  s.style.left = E.x * 100 + '%'; fx.appendChild(s); setTimeout(() => s.remove(), 1700);
}
export function bitsFly(fromEl, n = 8) {
  const to = $('bitsN'); if (!fromEl || !to || reduced()) return;
  const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span'); c.className = 'bit-fly'; c.textContent = i % 2 ? '1' : '0';
    c.style.left = a.left + a.width / 2 + 'px'; c.style.top = a.top + a.height / 2 + 'px';
    document.body.appendChild(c);
    requestAnimationFrame(() => { c.style.transitionDelay = i * 55 + 'ms'; c.style.transform = `translate(${b.left - a.left - a.width / 2}px,${b.top - a.top - a.height / 2}px) scale(.5)`; c.style.opacity = '.2'; });
    setTimeout(() => c.remove(), 1200 + i * 55);
  }
  setTimeout(() => { const h = to.parentElement; h.classList.remove('bump'); void h.offsetWidth; h.classList.add('bump'); }, 850);
}
/** La gran celebración al activar la corona. */
export function celebrate({ kind = 'jump', prop = '⭐', xp = 0, bits = 0, line = '', fromEl = null }) {
  $('screen').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (E.mode !== 'walk') { if (E.mode === 'menu') closeMenu(); if (E.mode === 'deco') exitDeco(); if (E.mode === 'elev') closeElevator(); }
  setMood('excited');
  const crown = $('crownDrop'); crown.hidden = false; crown.classList.remove('go'); void crown.offsetWidth; crown.classList.add('go');
  blip('crown');
  setTimeout(() => {
    act(kind, prop); confetti(36); blip('done');
    floatText(`+${bits} ◆`); setTimeout(() => floatText(`+${xp} XP`, 'xp'), 220);
    bitsFly(fromEl || crown, Math.min(10, Math.max(4, Math.round(bits / 3))));
    if (line) say(line, 5200);
    render();
  }, 700);
  setTimeout(() => { crown.hidden = true; setMood('happy'); }, 1900);
}
export function levelUp(before, after) {
  const el = $('lvlup');
  const newFloors = []; for (let k = before + 1; k <= after; k++) newFloors.push(W.floorInfo(k));
  const newWorld = newFloors.find(f => f.world.from === f.n && f.n > 1);
  const items = W.CATALOG.concat(W.WEAR).filter(i => i.lvl > before && i.lvl <= after && i.price > 0);
  el.innerHTML = `<div class="lu-in"><b>NIVEL ${after}</b>
    ${newWorld ? `<span class="lu-world">¡NUEVO EDIFICIO!<br>${esc(newWorld.world.n.toUpperCase())}</span>` : ''}
    ${newFloors.map(f => `<span>PISO ${f.n} DESBLOQUEADO<br>${f.ic} ${esc(f.name.toUpperCase())}</span>`).join('')}
    ${items.length ? `<small>Nuevo en la tienda: ${items.slice(0, 8).map(i => i.e).join(' ')}</small>` : ''}
    <small class="lu-go">Toma el ascensor ▲ para subir</small></div>`;
  el.hidden = false; blip('level'); confetti(60); act('dance', '⭐');
  say(`¡Nivel ${after}! ${newWorld ? `Te ganaste un edificio nuevo: ${newWorld.world.n}. ` : ''}Ve al ascensor para visitar el piso ${after}.`, 7000);
  clearTimeout(levelUp.t); levelUp.t = setTimeout(() => { el.hidden = true; }, 4200);
  el.onclick = () => { el.hidden = true; };
}

export function init(hooks = {}) {
  E.hooks = hooks;
  setupControls(); setupDrag(); render();
  E.raf = requestAnimationFrame(loop);
  addEventListener('resize', () => { placeHero(); camera(true); });
}
