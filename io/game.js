/* IO — el juego de la vida real.
 * No se juega en el celular: se juega viviendo. Las misiones salen de tus datos reales
 * (agua, ejercicio, sueño, diario, tu gente, metas, presupuesto, hábitos, agenda).
 * Al cumplirlas ganas XP (niveles → la casa mejora) y monedas (→ tienda de ítems).
 * Nada se compra con dinero. */
import * as S from './store.js';
import { cfg, saveCfg, todayIso } from './store.js';

/* ---------- niveles y casas ---------- */
export const levelOf = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
export const xpFor = lvl => 50 * (lvl - 1) ** 2;
export const TIERS = [
  { min: 1, name: 'Cuarto', ic: '🛏️' },
  { min: 3, name: 'Cuarto acogedor', ic: '🕯️' },
  { min: 5, name: 'Apartamento', ic: '🏢' },
  { min: 8, name: 'Loft', ic: '🌆' },
  { min: 12, name: 'Casa propia', ic: '🏡' },
];
export const tierOf = lvl => TIERS.reduce((t, x, i) => (lvl >= x.min ? i : t), 0);

/* ---------- tienda: todo se paga con monedas ganadas en la vida real ---------- */
export const SLOTS = {
  wallL: 'Pared', ceiling: 'Techo', floorL: 'Piso izquierdo', floorR: 'Piso derecho', pet: 'Mascota', head: 'Cabeza', face: 'Cara',
};
export const CATALOG = [
  // casa
  { id: 'libros', e: '📚', n: 'Libros', slot: 'wallL', price: 0, lvl: 1, cat: 'casa' },
  { id: 'cuadro', e: '🖼️', n: 'Cuadro', slot: 'wallL', price: 40, lvl: 1, cat: 'casa' },
  { id: 'guitarra', e: '🎸', n: 'Guitarra', slot: 'wallL', price: 90, lvl: 3, cat: 'casa' },
  { id: 'medallas', e: '🏅', n: 'Medallas', slot: 'wallL', price: 160, lvl: 5, cat: 'casa' },
  { id: 'planta', e: '🪴', n: 'Planta', slot: 'floorL', price: 0, lvl: 1, cat: 'casa' },
  { id: 'cactus', e: '🌵', n: 'Cactus', slot: 'floorL', price: 35, lvl: 1, cat: 'casa' },
  { id: 'sofa', e: '🛋️', n: 'Sofá', slot: 'floorL', price: 150, lvl: 4, cat: 'casa' },
  { id: 'arcade', e: '🕹️', n: 'Arcade', slot: 'floorL', price: 260, lvl: 6, cat: 'casa' },
  { id: 'piano', e: '🎹', n: 'Piano', slot: 'floorL', price: 340, lvl: 9, cat: 'casa' },
  { id: 'escritorio', e: '💻', n: 'Escritorio', slot: 'floorR', price: 0, lvl: 1, cat: 'casa' },
  { id: 'tv', e: '📺', n: 'Televisor', slot: 'floorR', price: 180, lvl: 4, cat: 'casa' },
  { id: 'setup', e: '🖥️', n: 'Setup gamer', slot: 'floorR', price: 240, lvl: 6, cat: 'casa' },
  { id: 'globos', e: '🎈', n: 'Globos', slot: 'ceiling', price: 30, lvl: 1, cat: 'casa' },
  { id: 'lampara', e: '💡', n: 'Lámpara', slot: 'ceiling', price: 60, lvl: 2, cat: 'casa' },
  { id: 'disco', e: '🪩', n: 'Bola disco', slot: 'ceiling', price: 200, lvl: 5, cat: 'casa' },
  // mascotas
  { id: 'pecera', e: '🐠', n: 'Pecera', slot: 'pet', price: 120, lvl: 2, cat: 'mascotas' },
  { id: 'gato', e: '🐈', n: 'Gato', slot: 'pet', price: 200, lvl: 3, cat: 'mascotas' },
  { id: 'perro', e: '🐕', n: 'Perro', slot: 'pet', price: 220, lvl: 4, cat: 'mascotas' },
  { id: 'loro', e: '🦜', n: 'Loro', slot: 'pet', price: 280, lvl: 7, cat: 'mascotas' },
  { id: 'unicornio', e: '🦄', n: 'Unicornio', slot: 'pet', price: 900, lvl: 12, cat: 'mascotas' },
  // avatar
  { id: 'gorra', e: '🧢', n: 'Gorra', slot: 'head', price: 60, lvl: 1, cat: 'avatar' },
  { id: 'audifonos', e: '🎧', n: 'Audífonos', slot: 'head', price: 110, lvl: 3, cat: 'avatar' },
  { id: 'sombrero', e: '🎩', n: 'Sombrero', slot: 'head', price: 180, lvl: 5, cat: 'avatar' },
  { id: 'corona', e: '👑', n: 'Corona', slot: 'head', price: 600, lvl: 10, cat: 'avatar' },
  { id: 'gafas', e: '🕶️', n: 'Gafas de sol', slot: 'face', price: 80, lvl: 2, cat: 'avatar' },
];
export const itemById = id => CATALOG.find(i => i.id === id);

/* ---------- estado (sincronizado vía io_items como 'game:state') ---------- */
const GID = 'game:state';
export function state() {
  let g = S.getItem(GID);
  if (!g) {
    g = { xp: 0, coins: 50, claimed: {}, owned: ['libros', 'planta', 'escritorio'], equipped: { wallL: 'libros', floorL: 'planta', floorR: 'escritorio' }, chest: {}, noSpend: {}, x: 0 };
  }
  g.claimed ||= {}; g.owned ||= []; g.equipped ||= {}; g.chest ||= {}; g.noSpend ||= {};
  return g;
}
export function save(g) {
  // guardar solo los últimos 14 días de misiones reclamadas
  const keep = Object.keys(g.claimed).sort().slice(-14);
  g.claimed = Object.fromEntries(keep.map(k => [k, g.claimed[k]]));
  const { id, ...data } = g;
  S.putItem('game', data, GID);
}
export const claimedToday = g => new Set(g.claimed[todayIso()] || []);

export function buy(itemId) {
  const g = state(); const it = itemById(itemId);
  if (!it) return { ok: false, msg: 'Ese ítem no existe' };
  if (g.owned.includes(itemId)) return equip(itemId);
  if (levelOf(g.xp) < it.lvl) return { ok: false, msg: `Se desbloquea en el nivel ${it.lvl}` };
  if (g.coins < it.price) return { ok: false, msg: `Te faltan ${it.price - g.coins} 🪙. ¡A cumplir misiones!` };
  g.coins -= it.price; g.owned.push(itemId); g.equipped[it.slot] = itemId; save(g);
  return { ok: true, msg: `${it.e} ${it.n} es tuyo` };
}
export function equip(itemId) {
  const g = state(); const it = itemById(itemId);
  if (!it || !g.owned.includes(itemId)) return { ok: false, msg: 'Aún no lo tienes' };
  if (g.equipped[it.slot] === itemId) delete g.equipped[it.slot]; else g.equipped[it.slot] = itemId;
  save(g);
  return { ok: true, msg: g.equipped[it.slot] ? `${it.e} equipado` : `${it.e} guardado en la mochila` };
}

/* ---------- efectos: el avatar hace algo cuando cumples algo ---------- */
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let actT;
export function avatarAct(act = 'jump', prop = '') {
  const mover = document.getElementById('avMover'); const p = document.getElementById('prop');
  if (!mover) return;
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
    const notes = kind === 'level' ? [523, 659, 784, 1047] : kind === 'buy' ? [392, 523] : [988, 1319];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f;
      const t = ac.currentTime + i * (kind === 'level' ? 0.11 : 0.08);
      g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.15);
    });
  } catch { /* sin audio */ }
}
export function toggleSound() { saveCfg({ sound: cfg.sound === false }); return cfg.sound !== false; }
