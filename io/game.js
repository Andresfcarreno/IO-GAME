/* IO — el juego de la vida real.
 * No se juega en el celular: se juega viviendo. Las misiones salen de tus datos reales.
 * XP → niveles → pisos nuevos en tu edificio (del garaje al rascacielos).
 * Monedas → tienda (muebles por piso, vehículos, mascotas, accesorios). Nada se compra con dinero. */
import * as S from './store.js';
import { cfg, saveCfg, todayIso } from './store.js';

/* ---------- niveles ---------- */
export const levelOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpFor = lvl => 50 * (lvl - 1) ** 2;

/* ---------- el edificio: cada piso se desbloquea con un nivel y trae una ventaja ---------- */
export const FLOORS = [
  { id: 'garaje', num: 'G', n: 'Garaje', ic: '🚗', lvl: 3, view: 'garage', perk: 'Tu vehículo te acompaña · cofre del día +10🪙', act: ['drive', '💨'] },
  { id: 'cuarto', num: '1', n: 'Tu cuarto', ic: '🛏️', lvl: 1, view: 'street', perk: 'Aquí empieza todo', act: ['wave', '👋'] },
  { id: 'sala', num: '2', n: 'Sala', ic: '🛋️', lvl: 2, view: 'street', perk: 'Misiones con tu gente +50% monedas', act: ['sit', '🍿'] },
  { id: 'gym', num: '3', n: 'Gimnasio', ic: '🏋️', lvl: 4, view: 'city', perk: 'Misiones de salud +50% XP', act: ['flex', '🏋️'] },
  { id: 'oficina', num: '4', n: 'Oficina', ic: '💼', lvl: 5, view: 'city', perk: 'Misiones de dinero y metas +50% XP', act: ['wave', '💻'] },
  { id: 'terraza', num: '6', n: 'Terraza', ic: '🌴', lvl: 7, view: 'high', perk: 'Diario y ánimo +50% XP', act: ['dance', '🎶'] },
  { id: 'piscina', num: '9', n: 'Piscina', ic: '🏊', lvl: 9, view: 'high', perk: 'Cofre del día +1🪙 por cada día de racha', act: ['jump', '💦'] },
  { id: 'penthouse', num: '20', n: 'Penthouse', ic: '🌆', lvl: 12, view: 'clouds', perk: 'Todas las misiones +25% monedas', act: ['dance', '🥂'] },
  { id: 'azotea', num: 'R', n: 'Azotea · helipuerto', ic: '🚁', lvl: 15, view: 'sky', perk: 'Cofre del día doble', act: ['fly', '🚁'] },
];
export const floorById = id => FLOORS.find(f => f.id === id);
export const unlockedFloors = lvl => FLOORS.filter(f => lvl >= f.lvl);
export const ORDER = ['garaje', 'cuarto', 'sala', 'gym', 'oficina', 'terraza', 'piscina', 'penthouse', 'azotea']; // de abajo hacia arriba

/* Multiplicadores según los pisos desbloqueados. grupo: salud | dinero | meta | social | mente | habito | agenda */
export function perks(lvl, grupo) {
  let x = 1, c = 1;
  if (lvl >= 2 && grupo === 'social') c += 0.5;
  if (lvl >= 4 && grupo === 'salud') x += 0.5;
  if (lvl >= 5 && (grupo === 'dinero' || grupo === 'meta')) x += 0.5;
  if (lvl >= 7 && grupo === 'mente') x += 0.5;
  if (lvl >= 12) c += 0.25;
  return { x, c };
}
export function chestReward(lvl, streak) {
  let xp = 50, c = 30;
  if (lvl >= 3) c += 10;
  if (lvl >= 9) c += streak;
  if (lvl >= 15) { xp *= 2; c *= 2; }
  return { xp, c };
}

/* ---------- tienda ---------- */
// slot: W pared · C techo · L piso izq · R piso der · V vehículo · pet mascota (te sigue) · head/face avatar
export const SLOT_NAMES = { W: 'Pared', C: 'Techo', L: 'Piso izq.', R: 'Piso der.', V: 'Vehículo', pet: 'Mascota', head: 'Cabeza', face: 'Cara' };
export const CATALOG = [
  // cuarto
  { id: 'libros', e: '📚', n: 'Libros', floor: 'cuarto', slot: 'W', price: 0, lvl: 1 },
  { id: 'cuadro', e: '🖼️', n: 'Cuadro', floor: 'cuarto', slot: 'W', price: 40, lvl: 1 },
  { id: 'guitarra', e: '🎸', n: 'Guitarra', floor: 'cuarto', slot: 'W', price: 90, lvl: 3 },
  { id: 'planta', e: '🪴', n: 'Planta', floor: 'cuarto', slot: 'L', price: 0, lvl: 1 },
  { id: 'cactus', e: '🌵', n: 'Cactus', floor: 'cuarto', slot: 'L', price: 35, lvl: 1 },
  { id: 'escritorio', e: '💻', n: 'Escritorio', floor: 'cuarto', slot: 'R', price: 0, lvl: 1 },
  { id: 'setup', e: '🖥️', n: 'Setup gamer', floor: 'cuarto', slot: 'R', price: 240, lvl: 6 },
  { id: 'globos', e: '🎈', n: 'Globos', floor: 'cuarto', slot: 'C', price: 30, lvl: 1 },
  { id: 'lampara', e: '💡', n: 'Lámpara', floor: 'cuarto', slot: 'C', price: 60, lvl: 2 },
  { id: 'disco', e: '🪩', n: 'Bola disco', floor: 'cuarto', slot: 'C', price: 200, lvl: 5 },
  // sala
  { id: 'sofa', e: '🛋️', n: 'Sofá', floor: 'sala', slot: 'L', price: 0, lvl: 2 },
  { id: 'arcade', e: '🕹️', n: 'Arcade', floor: 'sala', slot: 'L', price: 260, lvl: 6 },
  { id: 'piano', e: '🎹', n: 'Piano', floor: 'sala', slot: 'L', price: 340, lvl: 9 },
  { id: 'tv', e: '📺', n: 'Televisor', floor: 'sala', slot: 'R', price: 120, lvl: 2 },
  { id: 'mapa', e: '🗺️', n: 'Mapa del mundo', floor: 'sala', slot: 'W', price: 50, lvl: 2 },
  { id: 'medallas', e: '🏅', n: 'Medallas', floor: 'sala', slot: 'W', price: 160, lvl: 5 },
  // garaje
  { id: 'bici', e: '🚲', n: 'Bicicleta', floor: 'garaje', slot: 'V', price: 0, lvl: 3 },
  { id: 'scooter', e: '🛵', n: 'Scooter', floor: 'garaje', slot: 'V', price: 150, lvl: 3 },
  { id: 'moto', e: '🏍️', n: 'Moto', floor: 'garaje', slot: 'V', price: 300, lvl: 4 },
  { id: 'carro', e: '🚗', n: 'Carro', floor: 'garaje', slot: 'V', price: 500, lvl: 5 },
  { id: 'jeep', e: '🚙', n: 'Jeep', floor: 'garaje', slot: 'V', price: 650, lvl: 6 },
  { id: 'camper', e: '🚐', n: 'Camper', floor: 'garaje', slot: 'V', price: 900, lvl: 8 },
  { id: 'deportivo', e: '🏎️', n: 'Deportivo', floor: 'garaje', slot: 'V', price: 1200, lvl: 10 },
  { id: 'herramientas', e: '🧰', n: 'Herramientas', floor: 'garaje', slot: 'W', price: 0, lvl: 3 },
  { id: 'llantas', e: '🛞', n: 'Llantas', floor: 'garaje', slot: 'L', price: 30, lvl: 3 },
  // gimnasio
  { id: 'saco', e: '🥊', n: 'Saco de boxeo', floor: 'gym', slot: 'L', price: 0, lvl: 4 },
  { id: 'estatica', e: '🚴', n: 'Bici estática', floor: 'gym', slot: 'R', price: 120, lvl: 4 },
  { id: 'espejo', e: '🪞', n: 'Espejo', floor: 'gym', slot: 'W', price: 60, lvl: 4 },
  { id: 'parlante', e: '🔊', n: 'Parlante', floor: 'gym', slot: 'C', price: 80, lvl: 4 },
  // oficina
  { id: 'monitor', e: '🖥️', n: 'Monitor', floor: 'oficina', slot: 'R', price: 0, lvl: 5 },
  { id: 'helecho', e: '🌿', n: 'Helecho', floor: 'oficina', slot: 'L', price: 45, lvl: 5 },
  { id: 'tablero', e: '📈', n: 'Tablero de metas', floor: 'oficina', slot: 'W', price: 90, lvl: 5 },
  { id: 'trofeo', e: '🏆', n: 'Trofeo', floor: 'oficina', slot: 'W', price: 220, lvl: 8 },
  // terraza
  { id: 'palmera', e: '🌴', n: 'Palmera', floor: 'terraza', slot: 'L', price: 0, lvl: 7 },
  { id: 'parrilla', e: '🍖', n: 'Parrilla', floor: 'terraza', slot: 'R', price: 150, lvl: 7 },
  { id: 'farolitos', e: '🏮', n: 'Farolitos', floor: 'terraza', slot: 'C', price: 60, lvl: 7 },
  // piscina
  { id: 'flotador', e: '🛟', n: 'Flotador', floor: 'piscina', slot: 'L', price: 0, lvl: 9 },
  { id: 'coctel', e: '🍹', n: 'Barra de cócteles', floor: 'piscina', slot: 'R', price: 200, lvl: 9 },
  { id: 'sombrilla', e: '⛱️', n: 'Sombrilla', floor: 'piscina', slot: 'C', price: 80, lvl: 9 },
  // penthouse
  { id: 'escultura', e: '🗿', n: 'Escultura', floor: 'penthouse', slot: 'L', price: 400, lvl: 12 },
  { id: 'champana', e: '🍾', n: 'Bar privado', floor: 'penthouse', slot: 'R', price: 300, lvl: 12 },
  { id: 'arte', e: '🎨', n: 'Arte original', floor: 'penthouse', slot: 'W', price: 350, lvl: 12 },
  { id: 'candelabro', e: '💎', n: 'Candelabro', floor: 'penthouse', slot: 'C', price: 0, lvl: 12 },
  // azotea
  { id: 'bandera', e: '🚩', n: 'Bandera IO', floor: 'azotea', slot: 'R', price: 0, lvl: 15 },
  { id: 'telescopio', e: '🔭', n: 'Telescopio', floor: 'azotea', slot: 'L', price: 300, lvl: 15 },
  { id: 'helicoptero', e: '🚁', n: 'Helicóptero', floor: 'azotea', slot: 'V', price: 2000, lvl: 15 },
  // mascotas (te siguen a cualquier piso)
  { id: 'hamster', e: '🐹', n: 'Hámster', floor: '*', slot: 'pet', price: 100, lvl: 2 },
  { id: 'gato', e: '🐈', n: 'Gato', floor: '*', slot: 'pet', price: 200, lvl: 3 },
  { id: 'perro', e: '🐕', n: 'Perro', floor: '*', slot: 'pet', price: 220, lvl: 4 },
  { id: 'loro', e: '🦜', n: 'Loro', floor: '*', slot: 'pet', price: 280, lvl: 7 },
  { id: 'unicornio', e: '🦄', n: 'Unicornio', floor: '*', slot: 'pet', price: 900, lvl: 12 },
  // avatar
  { id: 'lentes', e: '👓', n: 'Lentes', floor: '*', slot: 'face', price: 40, lvl: 1 },
  { id: 'gafas', e: '🕶️', n: 'Gafas de sol', floor: '*', slot: 'face', price: 80, lvl: 2 },
  { id: 'gorra', e: '🧢', n: 'Gorra', floor: '*', slot: 'head', price: 60, lvl: 1 },
  { id: 'lazo', e: '🎀', n: 'Lazo', floor: '*', slot: 'head', price: 50, lvl: 1 },
  { id: 'audifonos', e: '🎧', n: 'Audífonos', floor: '*', slot: 'head', price: 110, lvl: 3 },
  { id: 'casco', e: '⛑️', n: 'Casco de piloto', floor: '*', slot: 'head', price: 150, lvl: 3 },
  { id: 'sombrero', e: '🎩', n: 'Sombrero', floor: '*', slot: 'head', price: 180, lvl: 5 },
  { id: 'corona', e: '👑', n: 'Corona', floor: '*', slot: 'head', price: 600, lvl: 10 },
];
export const itemById = id => CATALOG.find(i => i.id === id);
export const slotKey = it => (it.floor === '*' ? it.slot : `${it.floor}.${it.slot}`);
export const isVehicle = it => it?.slot === 'V';

/* ---------- estado (sincronizado vía io_items como 'game:state') ---------- */
const GID = 'game:state';
const OLD_SLOTS = { wallL: 'cuarto.W', floorL: 'cuarto.L', floorR: 'cuarto.R', ceiling: 'cuarto.C' };
export function state() {
  let g = S.getItem(GID);
  if (!g) g = { xp: 0, coins: 50, claimed: {}, owned: [], equipped: {}, chest: {}, noSpend: {}, floor: 'cuarto' };
  g.claimed ||= {}; g.owned ||= []; g.equipped ||= {}; g.chest ||= {}; g.noSpend ||= {}; g.floor ||= 'cuarto';
  for (const [o, n] of Object.entries(OLD_SLOTS)) if (g.equipped[o]) { g.equipped[n] ??= g.equipped[o]; delete g.equipped[o]; }
  return g;
}
export function save(g) {
  const keep = Object.keys(g.claimed).sort().slice(-60);
  g.claimed = Object.fromEntries(keep.map(k => [k, g.claimed[k]]));
  const { id, ...data } = g;
  S.putItem('game', data, GID);
}
export const claimedToday = g => new Set(g.claimed[todayIso()] || []);
export const owns = (g, it) => it.price === 0 || g.owned.includes(it.id);
/** Ítem visible en un slot: el equipado, o el gratuito por defecto si nunca se eligió nada. */
export function equippedIn(g, key) {
  if (key in g.equipped) return itemById(g.equipped[key]) || null;
  return CATALOG.find(i => slotKey(i) === key && i.price === 0) || null;
}

export function buy(itemId) {
  const g = state(); const it = itemById(itemId);
  if (!it) return { ok: false, msg: 'Ese ítem no existe' };
  if (owns(g, it)) return equip(itemId);
  if (levelOf(g.xp) < it.lvl) return { ok: false, msg: `Se desbloquea en el nivel ${it.lvl}` };
  if (g.coins < it.price) return { ok: false, msg: `Te faltan ${it.price - g.coins} 🪙. ¡A cumplir misiones!` };
  g.coins -= it.price; g.owned.push(itemId); g.equipped[slotKey(it)] = itemId; save(g);
  return { ok: true, bought: true, msg: `${it.e} ${it.n} es tuyo` };
}
export function equip(itemId) {
  const g = state(); const it = itemById(itemId);
  if (!it || !owns(g, it)) return { ok: false, msg: 'Aún no lo tienes' };
  const k = slotKey(it);
  const cur = equippedIn(g, k);
  if (cur?.id === itemId) g.equipped[k] = null; else g.equipped[k] = itemId;
  save(g);
  return { ok: true, msg: g.equipped[k] ? `${it.e} equipado` : `${it.e} guardado` };
}
export function setFloor(id) { const g = state(); g.floor = id; save(g); }

/* ---------- logros ---------- */
export function achievements(ctx) {
  const { g, streak, lvl, journal, contacts, goalsDone, txs } = ctx;
  const claimedDays = Object.values(g.claimed).filter(a => a.length).length;
  const chests = Object.keys(g.chest).length;
  const hasVehicle = g.owned.some(id => isVehicle(itemById(id)) && id !== 'bici');
  const list = [
    ['primera', '🥇', 'Primera misión', claimedDays, 1],
    ['racha3', '🔥', 'Racha de 3 días', streak, 3],
    ['racha7', '⚡', 'Racha de 7 días', streak, 7],
    ['racha30', '🌋', 'Racha de 30 días', streak, 30],
    ['cofres', '🎁', '5 cofres abiertos', chests, 5],
    ['gente', '💬', '10 contactos con tu gente', contacts, 10],
    ['diario', '📝', '10 entradas de diario', journal, 10],
    ['registros', '🧾', '50 movimientos registrados', txs, 50],
    ['meta', '🎯', 'Cumpliste una meta', goalsDone, 1],
    ['garaje', '🚗', 'Primer vehículo', hasVehicle ? 1 : 0, 1],
    ['gym', '🏋️', 'Llegaste al gimnasio', lvl, 4],
    ['penthouse', '🌆', 'Vives en el penthouse', lvl, 12],
    ['cielo', '🚁', 'Llegaste a la azotea', lvl, 15],
  ];
  return list.map(([id, e, n, v, goal]) => ({ id, e, n, v: Math.min(v, goal), goal, done: v >= goal }));
}

/* ---------- efectos: el avatar hace algo cuando cumples algo ---------- */
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let actT;
export function avatarAct(act = 'jump', prop = '') {
  const mover = document.getElementById('avMover'); const p = document.getElementById('prop');
  if (!mover) return;
  if (act === 'drive' || act === 'fly') {
    const v = document.getElementById('slot-V');
    if (v && v.textContent) { v.classList.remove('drive', 'fly'); void v.offsetWidth; v.classList.add(act); setTimeout(() => v.classList.remove(act), 2200); }
    act = 'wave';
  }
  mover.classList.remove('act-jump', 'act-dance', 'act-flex', 'act-wave', 'act-sit');
  void mover.offsetWidth;
  mover.classList.add('act-' + act);
  if (prop && p) { p.textContent = prop; p.classList.remove('show'); void p.offsetWidth; p.classList.add('show'); }
  clearTimeout(actT); actT = setTimeout(() => mover.classList.remove('act-' + act), 1500);
}
export function confetti(n = 28) {
  const fx = document.getElementById('fx'); if (!fx || reduce()) return;
  const cols = ['#4ade80', '#a78bfa', '#22d3ee', '#fbbf24', '#f472b6', '#f87171'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'cf';
    s.style.setProperty('--dx', (Math.random() * 2 - 1) * 160 + 'px');
    s.style.setProperty('--dy', -(60 + Math.random() * 120) + 'px');
    s.style.setProperty('--r', Math.random() * 720 + 'deg');
    s.style.background = cols[i % cols.length];
    s.style.left = 50 + (Math.random() * 10 - 5) + '%';
    fx.appendChild(s); setTimeout(() => s.remove(), 1400);
  }
}
export function floatText(txt, cls = '') {
  const fx = document.getElementById('fx'); if (!fx) return;
  const s = document.createElement('span'); s.className = 'ftxt ' + cls; s.textContent = txt;
  fx.appendChild(s); setTimeout(() => s.remove(), 1600);
}
export function coinsFly(fromEl, n = 6) {
  const to = document.getElementById('coinN'); if (!fromEl || !to || reduce()) return;
  const a = fromEl.getBoundingClientRect(), b = to.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span'); c.className = 'coin-fly'; c.textContent = '🪙';
    c.style.left = a.left + a.width / 2 + 'px'; c.style.top = a.top + a.height / 2 + 'px';
    document.body.appendChild(c);
    requestAnimationFrame(() => {
      c.style.transitionDelay = i * 60 + 'ms';
      c.style.transform = `translate(${b.left - a.left - a.width / 2 + (Math.random() * 10 - 5)}px, ${b.top - a.top - a.height / 2}px) scale(.6)`;
      c.style.opacity = '0.2';
    });
    setTimeout(() => c.remove(), 1100 + i * 60);
  }
  setTimeout(() => { to.parentElement?.classList.remove('bump'); void to.offsetWidth; to.parentElement?.classList.add('bump'); }, 800);
}

/* ---------- sonido 8-bit (solo tras un toque del usuario) ---------- */
let ac;
export function blip(kind = 'coin') {
  if (cfg.sound === false) return;
  try {
    ac ||= new (window.AudioContext || window.webkitAudioContext)();
    const notes = { level: [523, 659, 784, 1047], buy: [392, 523], ding: [880, 660], coin: [988, 1319] }[kind] || [988, 1319];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), gn = ac.createGain();
      o.type = kind === 'ding' ? 'triangle' : 'square'; o.frequency.value = f;
      const t = ac.currentTime + i * (kind === 'level' ? 0.11 : 0.09);
      gn.gain.setValueAtTime(0.05, t); gn.gain.exponentialRampToValueAtTime(0.001, t + (kind === 'ding' ? 0.35 : 0.14));
      o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + 0.4);
    });
  } catch { /* sin audio */ }
}
export function toggleSound() { saveCfg({ sound: cfg.sound === false }); return cfg.sound !== false; }
