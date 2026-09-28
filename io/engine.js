/* IO — la consola. Motor 2D del juego:
 * caminar (◀ ▶), ascensor (puerta a la izquierda: ▲ o A), interactuar con objetos (A),
 * modo decorar (SELECT: elegir, mover y guardar objetos), menú (START), minimapa, efectos y sonido.
 * Teclado: flechas/WASD · Z o Espacio = A · X = B · Shift = SELECT · Enter = START. */
import * as W from './world.js';
import { cfg } from './store.js';
import { avatarSVG } from './avatar.js';

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

/* ================= diálogo ================= */
export function say(text, ms = 5200, name = 'IO') {
  const box = $('dlg'); const el = $('dlgText'); if (!box) return;
  $('dlgName').textContent = name;
  box.hidden = false; clearInterval(E.typeT); clearTimeout(E.sayT);
  if (reduced()) el.textContent = text;
  else { let i = 0; el.textContent = ''; E.typeT = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(E.typeT); }, 15); }
  if (ms) E.sayT = setTimeout(() => { box.hidden = true; }, ms);
}
export const hush = () => { const b = $('dlg'); if (b) b.hidden = true; };

/* ================= escena ================= */
function floorNow() { const g = W.game(); const lvl = W.level(g); if (g.floor > lvl) { g.floor = lvl; W.saveGame(g); } return g.floor; }
export function render() {
  const g = W.game(); const n = floorNow(); const f = W.floorInfo(n); const lvl = W.level(g);
  const scene = $('scene');
  scene.dataset.skin = f.world.skin; scene.dataset.type = f.type; scene.dataset.view = f.view; scene.dataset.elev = f.world.elev;
  scene.classList.toggle('open', f.open);
  scene.style.setProperty('--hue', (f.world.hue || 0) + 'deg');
  const h = new Date().getHours();
  scene.dataset.time = h >= 6 && h < 17 ? 'dia' : h >= 17 && h < 20 ? 'tarde' : 'noche';
  $('elevNum').textContent = n;
  $('floorTag').textContent = `${n === 1 ? 'PISO 1' : 'PISO ' + n} · ${f.name.toUpperCase()}`;
  // objetos
  const objs = W.placedOn(g, n);
  $('objs').innerHTML = objs.map(p => {
    const it = W.itemById(p.item); if (!it) return '';
    const band = it.band;
    const pos = band === 'floor' ? `bottom:var(--floorY)` : band === 'wall' ? `top:${wallTop(p.y ?? .35)}` : `top:var(--ceilY)`;
    return `<button class="obj b-${band}${it.kind === 'pet' ? ' pet' : ''}${it.kind === 'veh' ? ' veh' : ''}" data-u="${p.u}" data-y="${p.y ?? .35}" style="left:${p.x * 100}%;${pos};--s:${it.s}" aria-label="${esc(it.n)}" tabindex="-1"><span class="spr">${it.e}</span></button>`;
  }).join('');
  // héroe
  const look = cfg.avatar || {};
  const key = JSON.stringify(look);
  if ($('heroIn').dataset.k !== key) { $('heroIn').innerHTML = avatarSVG(look, 'av'); $('heroIn').dataset.k = key; }
  const hero = $('hero');
  hero.className = 'hero ' + ['head', 'face'].map(s => g.wear[s] ? 'wear-' + g.wear[s] : '').join(' ');
  placeHero();
  // HUD
  const pr = W.progressOf(g.xp);
  $('lvlN').textContent = lvl; $('xpFill').style.width = (pr.pct * 100).toFixed(1) + '%'; $('xpFill').parentElement.title = `${pr.into}/${pr.need} XP`;
  $('bitsN').textContent = g.bits;
  renderMinimap(g, n, lvl);
  hints();
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
}

/* ================= caminar e interacción ================= */
const nearDoor = () => E.x < .2;
function nearObj() {
  const g = W.game(); const objs = W.placedOn(g, floorNow());
  let best = null, bd = .075;
  for (const p of objs) { const it = W.itemById(p.item); if (!it || it.band === 'ceiling') continue; const d = Math.abs(p.x - E.x); if (d < bd) { bd = d; best = p; } }
  return best;
}
function hints() {
  document.querySelectorAll('#objs .obj.near').forEach(o => o.classList.remove('near'));
  $('doorHint').hidden = !(E.mode === 'walk' && nearDoor());
  if (E.mode !== 'walk') return;
  const p = nearObj(); if (p) document.querySelector(`#objs .obj[data-u="${p.u}"]`)?.classList.add('near');
}
function loop(t) {
  const dt = Math.min(.05, (t - (E.last || t)) / 1000); E.last = t;
  if (E.held === 'left' || E.held === 'right') {
    const d = E.held === 'left' ? -1 : 1;
    if (E.mode === 'walk') {
      E.dir = d; E.x = clamp(E.x + d * .3 * dt, .07, .94); placeHero(); hints();
      $('hero').classList.add('walking');
    } else if (E.mode === 'deco' && E.deco.moving) moveSel(d * .35 * dt, 0);
  } else if ((E.held === 'up' || E.held === 'down') && E.mode === 'deco' && E.deco.moving) moveSel(0, (E.held === 'up' ? -1 : 1) * .5 * dt);
  else $('hero')?.classList.remove('walking');
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
  const p = nearObj();
  if (!p) { act('jump'); blip('menu'); return; }
  const it = W.itemById(p.item);
  if (it.kind === 'veh') { const el = document.querySelector(`#objs .obj[data-u="${p.u}"]`); el?.classList.remove('drive'); void el?.offsetWidth; el?.classList.add('drive'); blip('door'); say(`¡${it.e} Vamos a dar una vuelta!`, 2600, cfg.name || 'Tú'); setTimeout(() => el?.classList.remove('drive'), 2300); return; }
  if (it.kind === 'pet') { act('wave', '❤️'); say(`${it.e} ¡Te quiere!`, 2200, cfg.name || 'Tú'); blip('select'); return; }
  const [a, prop, line] = INTERACT[p.item] || ['wave', '✨', `${it.e} ${it.n}`];
  act(a, prop); blip('select'); say(line, 2600, cfg.name || 'Tú');
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
    const n = floorNow(); E.elevSel = n; E.elevWorld = W.worldOf(n);
    E.mode = 'elev'; renderElevPanel();
  }, 450);
}
function closeElevator() {
  $('elevPanel').hidden = true; $('hero').classList.remove('inside');
  $('scene').classList.remove('doors-open'); E.mode = 'walk'; E.x = .2; placeHero(); hints();
}
function renderElevPanel() {
  const lvl = W.level(); const w = E.elevWorld; const cur = floorNow();
  const worlds = W.worldsUpTo(Math.max(lvl, w.to));
  let btns = '';
  for (let k = w.from; k <= w.to; k++) {
    const f = W.floorInfo(k);
    btns += `<button class="eb${k <= lvl ? '' : ' locked'}${k === E.elevSel ? ' sel' : ''}${k === cur ? ' cur' : ''}" data-floor="${k}" title="${esc(f.name)}">${k <= lvl ? k : '🔒'}</button>`;
  }
  const sel = W.floorInfo(E.elevSel);
  const wi = worlds.findIndex(x => x.id === w.id);
  $('elevPanel').innerHTML = `
    <div class="ep-top"><button class="ep-w" data-ew="-1" ${wi <= 0 ? 'disabled' : ''}>◀</button><div><small>EDIFICIO ${w.id}</small><b>${esc(w.n)}</b></div><button class="ep-w" data-ew="1" ${w.from > lvl ? 'disabled' : ''}>▶</button></div>
    <div class="ep-grid" data-skin="${w.skin}">${btns}</div>
    <div class="ep-info">${E.elevSel <= lvl ? `${sel.ic} Piso ${E.elevSel} · ${esc(sel.name)}` : `🔒 Piso ${E.elevSel} · se abre en el nivel ${E.elevSel}`}</div>
    <div class="ep-help">✥ elegir · A subir/bajar · B salir</div>`;
  $('elevPanel').hidden = false;
}
function elevMove(dx, dy) {
  const w = E.elevWorld; const cols = 5;
  let k = E.elevSel + dx + dy * -cols;
  if (k < w.from || k > w.to) { blip('error'); return; }
  E.elevSel = k; blip('menu'); renderElevPanel();
}
function elevWorld(d) {
  const lvl = W.level(); const worlds = W.worldsUpTo(Math.max(lvl, E.elevWorld.to + 25));
  const i = worlds.findIndex(x => x.id === E.elevWorld.id) + d;
  if (i < 0 || i >= worlds.length || (d > 0 && worlds[i].from > lvl + 25)) { blip('error'); return; }
  E.elevWorld = worlds[i]; E.elevSel = clamp(E.elevSel, E.elevWorld.from, E.elevWorld.to); if (E.elevSel < E.elevWorld.from || E.elevSel > E.elevWorld.to) E.elevSel = E.elevWorld.from;
  blip('menu'); renderElevPanel();
}
export function ride(target) {
  const lvl = W.level(); const cur = floorNow();
  if (target > lvl) { blip('error'); say(`🔒 El piso ${target} se abre cuando llegues al nivel ${target}. Cada hábito completo te acerca.`, 3800); return; }
  if (target === cur) { closeElevator(); return; }
  $('elevPanel').hidden = true; E.mode = 'ride';
  const r = $('elevRide'); const w = W.worldOf(target);
  r.dataset.elev = w.elev; r.hidden = false;
  const num = $('rideNum'); const arrow = $('rideArrow');
  arrow.textContent = target > cur ? '▲' : '▼';
  const steps = Math.min(18, Math.abs(target - cur)); let i = 0;
  const tick = setInterval(() => {
    i++; const v = Math.round(cur + (target - cur) * (i / steps)); num.textContent = v; blip('step');
    if (i >= steps) {
      clearInterval(tick); blip('ding');
      setTimeout(() => {
        const g = W.game(); g.floor = target; W.saveGame(g);
        E.x = .09; E.dir = 1; render();
        r.hidden = true; $('hero').classList.remove('inside');
        $('scene').classList.add('doors-open');
        setTimeout(() => { $('scene').classList.remove('doors-open'); }, 900);
        walkTo(.24, () => { E.mode = 'walk'; hints(); });
        const f = W.floorInfo(target);
        say(`${f.ic} Piso ${target} · ${f.name}${f.world.from === target ? ` — bienvenido a ${f.world.n}` : ''}.`, 3500);
        E.hooks.onFloor?.(target);
      }, 380);
    }
  }, Math.max(45, 900 / Math.max(steps, 1)));
}
function walkTo(x, done) {
  const hero = $('hero'); hero.classList.add('walking');
  const step = () => {
    const d = x - E.x; if (Math.abs(d) < .005) { hero.classList.remove('walking'); done?.(); return; }
    E.dir = Math.sign(d); E.x += Math.sign(d) * Math.min(Math.abs(d), .006); placeHero(); requestAnimationFrame(step);
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
    : E.deco.moving ? `<b>MOVIENDO ${it.e} ${esc(it.n.toUpperCase())}</b><span>✥ mover · A soltar · B cancelar</span>`
    : `<b>MODO DECORAR · ${it.e} ${esc(it.n)}</b><span>◀▶ elegir · A mover · START opciones · B salir</span>`;
}
const wallTop = y => `calc(var(--wallTop) + ${(y * 100).toFixed(1)}% * var(--wallK))`;
function moveSel(dx, dy) {
  const p = decoObjs()[E.deco.sel]; if (!p) return;
  const el = document.querySelector(`#objs .obj[data-u="${p.u}"]`); if (!el) return;
  const it = W.itemById(p.item);
  el.style.left = clamp(parseFloat(el.style.left) / 100 + dx, .2, .95) * 100 + '%';
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
  });
  g.stats.moved = (g.stats.moved || 0) + 1;
  W.saveGame(g);
}
function decoB() {
  if (E.deco.moving) { // cancelar: volver a la posición original
    const o = E.deco.orig; const el = document.querySelector(`#objs .obj[data-u="${o.u}"]`);
    if (el) { el.style.left = o.x * 100 + '%'; if (o.y != null && W.itemById(o.item).band === 'wall') { el.dataset.y = o.y; el.style.top = wallTop(o.y); } }
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
  W.placedOn(g, n).push(p); W.saveGame(g); render();
  enterDeco(p.u); say(`Mueve ${it.e} con ◀ ▶ y suelta con A.`, 3500);
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
    if (E.mode !== 'walk' || e.target.closest('.obj,.elev,#minimap,.hud,#dlg')) return;
    const r = $('scene').getBoundingClientRect(); walkTo(clamp((e.clientX - r.left) / r.width, .07, .94));
  });
  $('elevBox').addEventListener('click', () => { if (E.mode === 'walk') walkTo(.1, () => openElevator()); });
}

/* ================= controles ================= */
function press(btn) {
  if (E.mode === 'ride' || E.mode === 'busy') return;
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
    else if (E.deco.moving && (btn === 'up' || btn === 'down')) moveSel(0, btn === 'up' ? -.08 : .08);
    return;
  }
  // caminando
  if (btn === 'left' || btn === 'right') { E.dir = btn === 'left' ? -1 : 1; E.x = clamp(E.x + E.dir * .035, .07, .94); placeHero(); hints(); }
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
      e.preventDefault(); b.classList.add('down'); press(k);
      if (['left', 'right', 'up', 'down'].includes(k)) E.held = k;
      if (ac?.state === 'suspended') ac.resume();
    });
    const up = () => { b.classList.remove('down'); if (E.held === k) E.held = null; };
    b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
  });
  const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down', z: 'a', ' ': 'a', x: 'b', Shift: 'select', Enter: 'start' };
  addEventListener('keydown', e => {
    if (e.target.closest('input,textarea,select') || document.querySelector('.sheet.open,.focus:not([hidden]),.onb:not([hidden]),.reveal:not([hidden])')) return;
    const k = map[e.key]; if (!k) return; e.preventDefault();
    if (!e.repeat) press(k);
    if (['left', 'right', 'up', 'down'].includes(k)) E.held = k;
  });
  addEventListener('keyup', e => { const k = map[e.key]; if (k && E.held === k) E.held = null; });
  $('gbMenu').addEventListener('click', e => { const b = e.target.closest('[data-menu]'); if (b) chooseMenu(b.dataset.menu); else if (e.target === $('gbMenu')) closeMenu(); });
  $('elevPanel').addEventListener('click', e => {
    const b = e.target.closest('[data-floor]'); if (b) { E.elevSel = +b.dataset.floor; renderElevPanel(); ride(E.elevSel); return; }
    const w = e.target.closest('[data-ew]'); if (w) elevWorld(+w.dataset.ew);
  });
  $('minimap').addEventListener('click', () => E.hooks.onMenu?.('mapa'));
  $('dlg').addEventListener('click', () => hush());
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
  addEventListener('resize', () => placeHero());
}
