/* IO — el mundo. Nivel = piso. Los edificios crecen en lujo y no se acaban:
 *   Edificio Barrio (1–10) → Torre Centro (11–25) → Rascacielos IO (26–50, helipuerto)
 *   → Ciudad en las nubes (51–75) → Estación orbital (76–100) → Sectores sin fin (cada 25 pisos).
 * XP y bits solo salen de hábitos cumplidos con el reloj completo. Nada se compra con dinero. */
import * as S from './store.js';

/* ---------- niveles: lentos a propósito (nivel 10 ≈ 2 semanas, nivel 50 ≈ 9 meses) ---------- */
export const xpToNext = lvl => 60 + 20 * lvl;
export function levelOf(xp) { let l = 1, need = xpToNext(1); while (xp >= need) { xp -= need; l++; need = xpToNext(l); } return l; }
export function xpAt(lvl) { let t = 0; for (let l = 1; l < lvl; l++) t += xpToNext(l); return t; }
export function progressOf(xp) { const l = levelOf(xp), a = xpAt(l), b = a + xpToNext(l); return { lvl: l, into: xp - a, need: b - a, pct: (xp - a) / (b - a) }; }

/* ---------- edificios (mundos) ---------- */
const BASE_WORLDS = [
  { id: 1, n: 'Edificio Barrio', from: 1, to: 10, elev: 'madera', skin: 'barrio' },
  { id: 2, n: 'Torre Centro', from: 11, to: 25, elev: 'acero', skin: 'torre' },
  { id: 3, n: 'Rascacielos IO', from: 26, to: 50, elev: 'cristal', skin: 'rasca' },
  { id: 4, n: 'Ciudad en las nubes', from: 51, to: 75, elev: 'oro', skin: 'nubes' },
  { id: 5, n: 'Estación orbital', from: 76, to: 100, elev: 'neon', skin: 'orbital' },
];
const SECTOR_NAMES = ['Sector Nova', 'Anillo Ámbar', 'Nébula Índigo', 'Cúpula Solar', 'Archipiélago Binario', 'Ciudad Espejo', 'Faro Cuántico', 'Jardín de Saturno'];
const ROMAN = n => [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']].reduce((s, [v, r]) => { while (n >= v) { s += r; n -= v; } return s; }, '');
export function worldOf(floor) {
  const w = BASE_WORLDS.find(x => floor >= x.from && floor <= x.to);
  if (w) return w;
  const k = Math.floor((floor - 101) / 25); // 0,1,2…
  const from = 101 + k * 25;
  const skins = ['barrio', 'torre', 'rasca', 'nubes', 'orbital'];
  return { id: 6 + k, n: `${SECTOR_NAMES[k % SECTOR_NAMES.length]}${k >= SECTOR_NAMES.length ? ' ' + ROMAN(Math.floor(k / SECTOR_NAMES.length) + 1) : ''}`, from, to: from + 24, elev: 'neon', skin: skins[(k + 3) % 5], hue: (k * 47) % 360 };
}
export const worldsUpTo = floor => { const out = []; for (let f = 1; f <= Math.max(floor, 1);) { const w = worldOf(f); out.push(w); f = w.to + 1; } return out; };

/* ---------- pisos ---------- */
export const ROOMS = {
  cuarto: { n: 'Tu cuarto', ic: '🛏️', starter: [['cama', .62], ['lampara_pie', .88], ['planta', .32]] },
  sala: { n: 'Sala', ic: '🛋️', starter: [['sofa', .55], ['tv', .85], ['cuadro', .5, .35]] },
  garaje: { n: 'Garaje', ic: '🚗', cap: 1, starter: [['bici', .6], ['herramientas', .88, .4]] },
  garaje2: { n: 'Garaje doble', ic: '🏎️', cap: 2, starter: [['bici', .45], ['herramientas', .9, .4]] },
  cocina: { n: 'Cocina', ic: '🍳', starter: [['estufa', .55], ['nevera', .85], ['frutas', .35]] },
  gimnasio: { n: 'Gimnasio', ic: '🏋️', starter: [['pesas', .5], ['saco', .85], ['espejo', .33, .35]] },
  biblioteca: { n: 'Biblioteca', ic: '📚', starter: [['estante', .55, .3], ['sillon', .7], ['lampara_pie', .88]] },
  jardin: { n: 'Jardín interior', ic: '🌿', starter: [['arbol', .6], ['flores', .38], ['banca', .82]] },
  oficina: { n: 'Oficina', ic: '💼', starter: [['escritorio', .6], ['monitor', .6, .55], ['planta', .88]] },
  juegos: { n: 'Sala de juegos', ic: '🕹️', starter: [['arcade', .55], ['dardos', .85, .35], ['puff', .35]] },
  spa: { n: 'Spa', ic: '🧖', starter: [['jacuzzi', .6], ['vela', .35], ['bambu', .88]] },
  cine: { n: 'Cine en casa', ic: '🎬', starter: [['pantalla', .55, .3], ['sofa', .55], ['palomitas', .82]] },
  galeria: { n: 'Galería de arte', ic: '🖼️', starter: [['arte', .35, .35], ['escultura', .6], ['arte2', .8, .35]] },
  piscina: { n: 'Piscina', ic: '🏊', starter: [['flotador', .55], ['sombrilla', .85], ['palmera', .3]] },
  terraza: { n: 'Terraza', ic: '🌇', starter: [['parrilla', .6], ['palmera', .88], ['farolitos', .45, .15]] },
  musica: { n: 'Estudio de música', ic: '🎸', starter: [['piano', .58], ['guitarra', .85, .35], ['microfono', .35]] },
  observatorio: { n: 'Observatorio', ic: '🔭', starter: [['telescopio', .6], ['globo', .35], ['mapa', .85, .35]] },
  hangar: { n: 'Hangar', ic: '🛩️', cap: 2, starter: [['avioneta', .6]] },
  helipuerto: { n: 'Helipuerto', ic: '🚁', cap: 1, open: true, starter: [['bandera', .9]] },
  mirador: { n: 'Mirador', ic: '🌄', open: true, starter: [['telescopio', .8], ['banca', .35]] },
  puente: { n: 'Puente de mando', ic: '🛰️', starter: [['consola', .55], ['robot', .85], ['planeta', .3, .35]] },
};
const SPECIAL = { 1: 'cuarto', 2: 'sala', 3: 'garaje', 4: 'cocina', 5: 'gimnasio', 6: 'biblioteca', 7: 'jardin', 8: 'oficina', 9: 'juegos', 10: 'garaje2', 15: 'piscina', 20: 'spa', 25: 'terraza', 30: 'cine', 35: 'galeria', 40: 'observatorio', 45: 'hangar', 50: 'helipuerto', 60: 'jardin', 75: 'mirador', 100: 'puente' };
const ROTATION = ['cuarto', 'sala', 'estudio_musica', 'cocina', 'biblioteca', 'gimnasio', 'oficina', 'juegos', 'spa', 'cine', 'galeria', 'jardin', 'garaje2'];
export function floorInfo(n) {
  let type = SPECIAL[n] || ROTATION[(n * 7) % ROTATION.length];
  if (type === 'estudio_musica') type = 'musica';
  const r = ROOMS[type]; const w = worldOf(n);
  const view = n <= 3 ? 'calle' : n <= 10 ? 'barrio' : n <= 25 ? 'ciudad' : n <= 50 ? 'skyline' : n <= 75 ? 'nubes' : 'espacio';
  return { n, type, name: n === 1 ? r.n : `${r.n}`, ic: r.ic, world: w, view, cap: r.cap || 0, open: !!r.open, starter: r.starter };
}

/* ---------- catálogo (todo se paga con bits ganados cumpliendo hábitos) ---------- */
// band: floor | wall | ceiling · s: escala · veh: solo en garajes/hangar/helipuerto
export const CATALOG = [
  // cuarto / sala
  ['cama', '🛏️', 'Cama', 'floor', 1.5, 0, 1], ['lampara_pie', '🪔', 'Lámpara de pie', 'floor', 1, 0, 1], ['planta', '🪴', 'Planta', 'floor', 1.1, 0, 1],
  ['sofa', '🛋️', 'Sofá', 'floor', 1.6, 0, 2], ['tv', '📺', 'Televisor', 'floor', 1.3, 0, 2], ['cuadro', '🖼️', 'Cuadro', 'wall', 1.1, 0, 2],
  ['cactus', '🌵', 'Cactus', 'floor', 1, 25, 1], ['reloj', '🕰️', 'Reloj antiguo', 'wall', 1, 40, 1], ['lampara', '💡', 'Lámpara colgante', 'ceiling', 1, 30, 1],
  ['globos', '🎈', 'Globos', 'ceiling', 1, 20, 1], ['osito', '🧸', 'Oso de peluche', 'floor', .9, 30, 1], ['tapete', '🟪', 'Tapete', 'floor', 1.2, 35, 2],
  ['guitarra', '🎸', 'Guitarra', 'wall', 1.2, 90, 3], ['disco', '🪩', 'Bola disco', 'ceiling', 1.1, 150, 4], ['vela', '🕯️', 'Vela', 'floor', .8, 15, 1],
  // cocina / comida
  ['estufa', '🍳', 'Estufa', 'floor', 1.2, 0, 4], ['nevera', '🧊', 'Nevera', 'floor', 1.3, 0, 4], ['frutas', '🍎', 'Frutero', 'floor', .9, 0, 4], ['cafetera', '☕', 'Cafetera', 'floor', .9, 45, 3],
  // gimnasio
  ['pesas', '🏋️', 'Pesas', 'floor', 1.3, 0, 5], ['saco', '🥊', 'Saco de boxeo', 'floor', 1.3, 0, 5], ['espejo', '🪞', 'Espejo', 'wall', 1.3, 0, 5], ['bici_est', '🚴', 'Bici estática', 'floor', 1.3, 120, 5], ['colchoneta', '🧘', 'Tapete de yoga', 'floor', 1.1, 60, 3],
  // biblioteca / oficina
  ['estante', '📚', 'Estante de libros', 'wall', 1.3, 0, 6], ['sillon', '💺', 'Sillón', 'floor', 1.2, 0, 6], ['escritorio', '🗄️', 'Escritorio', 'floor', 1.4, 0, 8], ['monitor', '🖥️', 'Monitor', 'floor', 1.2, 0, 8],
  ['laptop', '💻', 'Laptop', 'floor', 1, 80, 2], ['tablero', '📈', 'Tablero de metas', 'wall', 1.2, 90, 8], ['trofeo', '🏆', 'Trofeo', 'wall', 1.1, 250, 12],
  // jardín / exterior
  ['arbol', '🌳', 'Árbol', 'floor', 1.9, 0, 7], ['flores', '🌷', 'Flores', 'floor', 1, 0, 7], ['banca', '🪑', 'Banca', 'floor', 1.2, 0, 7], ['palmera', '🌴', 'Palmera', 'floor', 1.8, 0, 15], ['bambu', '🎋', 'Bambú', 'floor', 1.6, 0, 20],
  ['sombrilla', '⛱️', 'Sombrilla', 'floor', 1.6, 0, 15], ['flotador', '🛟', 'Flotador', 'floor', 1.1, 0, 15], ['parrilla', '🍖', 'Parrilla', 'floor', 1.1, 0, 25], ['farolitos', '🏮', 'Farolitos', 'ceiling', 1, 0, 25], ['fuente', '⛲', 'Fuente', 'floor', 1.7, 400, 20],
  // juegos / cine / arte / música
  ['arcade', '🕹️', 'Arcade', 'floor', 1.3, 0, 9], ['dardos', '🎯', 'Dardos', 'wall', 1.1, 0, 9], ['puff', '🟣', 'Puff', 'floor', 1, 0, 9], ['consola_tv', '🎮', 'Consola retro', 'floor', 1, 140, 6],
  ['jacuzzi', '🛁', 'Jacuzzi', 'floor', 1.7, 0, 20], ['pantalla', '🎞️', 'Pantalla de cine', 'wall', 1.6, 0, 30], ['palomitas', '🍿', 'Palomitas', 'floor', .9, 0, 30],
  ['arte', '🎨', 'Pintura', 'wall', 1.3, 0, 35], ['arte2', '🗺️', 'Mapa antiguo', 'wall', 1.3, 0, 35], ['escultura', '🗿', 'Escultura', 'floor', 1.5, 0, 35], ['piano', '🎹', 'Piano', 'floor', 1.4, 0, 11], ['microfono', '🎤', 'Micrófono', 'floor', 1, 0, 11],
  ['telescopio', '🔭', 'Telescopio', 'floor', 1.4, 0, 40], ['globo', '🌍', 'Globo terráqueo', 'floor', 1, 0, 40], ['mapa', '🧭', 'Brújula', 'wall', 1, 0, 40], ['bandera', '🚩', 'Bandera IO', 'floor', 1.3, 0, 50],
  ['consola', '🎛️', 'Consola de mando', 'floor', 1.4, 0, 100], ['robot', '🤖', 'Robot asistente', 'floor', 1.2, 0, 100], ['planeta', '🪐', 'Planeta', 'wall', 1.4, 0, 100],
  ['candelabro', '💎', 'Candelabro', 'ceiling', 1.3, 600, 26], ['acuario', '🐠', 'Acuario', 'floor', 1.3, 350, 16], ['champana', '🍾', 'Bar privado', 'floor', 1.2, 500, 30], ['cohete', '🚀', 'Cohete de colección', 'floor', 1.4, 1500, 76],
  // vehículos (garajes, hangar, helipuerto)
  ['bici', '🚲', 'Bicicleta', 'floor', 1.6, 0, 3, 'veh'], ['herramientas', '🧰', 'Herramientas', 'wall', 1, 0, 3], ['patineta', '🛹', 'Patineta', 'floor', 1.1, 40, 3, 'veh'],
  ['scooter', '🛵', 'Scooter', 'floor', 1.7, 180, 3, 'veh'], ['moto', '🏍️', 'Moto', 'floor', 1.8, 400, 6, 'veh'], ['carro', '🚗', 'Carro', 'floor', 2, 700, 10, 'veh'], ['jeep', '🚙', 'Jeep', 'floor', 2.1, 900, 12, 'veh'],
  ['camper', '🚐', 'Camper', 'floor', 2.2, 1300, 18, 'veh'], ['deportivo', '🏎️', 'Deportivo', 'floor', 2.1, 2200, 25, 'veh'], ['avioneta', '🛩️', 'Avioneta', 'floor', 2.3, 0, 45, 'veh'], ['helicoptero', '🚁', 'Helicóptero', 'floor', 2.4, 3500, 50, 'veh'], ['ovni', '🛸', 'Nave', 'floor', 2.2, 8000, 90, 'veh'],
  // mascotas (se mueven solas)
  ['hamster', '🐹', 'Hámster', 'floor', .8, 90, 2, 'pet'], ['gato', '🐈', 'Gato', 'floor', 1, 200, 4, 'pet'], ['perro', '🐕', 'Perro', 'floor', 1.1, 240, 6, 'pet'], ['loro', '🦜', 'Loro', 'floor', .9, 320, 9, 'pet'],
  ['tortuga', '🐢', 'Tortuga', 'floor', .9, 150, 3, 'pet'], ['zorro', '🦊', 'Zorro', 'floor', 1, 600, 20, 'pet'], ['unicornio', '🦄', 'Unicornio', 'floor', 1.3, 2500, 40, 'pet'], ['dragon', '🐉', 'Dragón', 'floor', 1.5, 9000, 100, 'pet'],
].map(([id, e, n, band, s, price, lvl, kind]) => ({ id, e, n, band, s, price, lvl, kind: kind || 'mueble' }));
export const WEAR = [
  ['lentes', '👓', 'Lentes', 'face', 40, 1], ['gafas', '🕶️', 'Gafas de sol', 'face', 90, 2], ['gorra', '🧢', 'Gorra', 'head', 60, 1], ['gorro', '🧶', 'Gorro de lana', 'head', 70, 2],
  ['lazo', '🎀', 'Lazo', 'head', 50, 1], ['audifonos', '🎧', 'Audífonos', 'head', 130, 3], ['casco', '⛑️', 'Casco de piloto', 'head', 220, 10], ['sombrero', '🎩', 'Sombrero de copa', 'head', 300, 15], ['corona', '👑', 'Corona', 'head', 1200, 30],
].map(([id, e, n, slot, price, lvl]) => ({ id, e, n, slot, price, lvl, kind: 'wear' }));
export const itemById = id => CATALOG.find(i => i.id === id) || WEAR.find(i => i.id === id);

/** Semana ISO-ish que empieza el lunes: 'YYYY-MM-DD' del lunes. */
export function weekKey(iso = S.todayIso()) { const d = S.dateOf(iso); const k = (d.getDay() + 6) % 7; return S.addDays(iso, -k); }
/** Títulos por nivel (se ven en el ranking). */
export const TITLES = [[1, 'Novato'], [5, 'Vecino'], [11, 'Constructor'], [26, 'Arquitecto'], [40, 'Magnate'], [51, 'Piloto'], [76, 'Astronauta'], [101, 'Leyenda']];
export const titleOf = lvl => TITLES.filter(([l]) => lvl >= l).pop()[1];

/* ---------- estado del juego ---------- */
const GID = 'io:game';
export function game() {
  const g = S.getItem(GID) || { xp: 0, bits: 60, floor: 1, placed: {}, owned: {}, wear: {}, chest: {}, stats: { minutes: 0, sessions: 0 }, seen: 1, deals: {}, wk: {} };
  g.placed ||= {}; g.owned ||= {}; g.wear ||= {}; g.chest ||= {}; g.stats ||= { minutes: 0, sessions: 0 }; g.deals ||= {}; g.wk ||= {};
  return g;
}
export function saveGame(g) { const { id, ...d } = g; S.putItem('game', d, GID); }
export const level = (g = game()) => levelOf(g.xp);

/** Objetos del piso; la primera visita coloca los muebles iniciales (regalo: pasan a ser tuyos). */
export function placedOn(g, n) {
  if (!g.placed[n]) {
    g.placed[n] = floorInfo(n).starter.map(([item, x, y]) => ({ u: S.uid(), item, x, y: y ?? null }));
    g.placed[n].forEach(p => { g.owned[p.item] = (g.owned[p.item] || 0) + 1; });
    saveGame(g);
  }
  return g.placed[n];
}
export function countPlaced(g, itemId) { return Object.values(g.placed).flat().filter(p => p.item === itemId).length; }
export const bagCount = (g, itemId) => Math.max(0, (g.owned[itemId] || 0) - countPlaced(g, itemId));
export function canPlaceHere(g, it, n) {
  const f = floorInfo(n);
  if (it.kind === 'veh') {
    if (!f.cap) return 'Los vehículos van en el garaje (piso 3), el garaje doble (10), el hangar (45) o el helipuerto (50).';
    const vehs = placedOn(g, n).filter(p => itemById(p.item)?.kind === 'veh').length;
    if (vehs >= f.cap) return `Este ${f.name.toLowerCase()} tiene espacio para ${f.cap} vehículo${f.cap > 1 ? 's' : ''}.`;
  }
  if (placedOn(g, n).length >= 9) return 'Este piso está lleno. Guarda algo en la mochila primero.';
  return '';
}
/* ---------- tienda: rarezas, oferta del día, caja sorpresa, colección ---------- */
export const RARITY = [
  { id: 'comun', n: 'Común', max: 100, w: 60 }, { id: 'raro', n: 'Raro', max: 400, w: 28 },
  { id: 'epico', n: 'Épico', max: 1500, w: 10 }, { id: 'legend', n: 'Legendario', max: Infinity, w: 2 },
];
/** Rareza por precio; los regalos de piso (precio 0) valen por su nivel. */
export function rarityOf(it) {
  const v = it.price || it.lvl * 30;
  return RARITY.find(r => v < r.max) || RARITY[3];
}
const hash = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export const SHOPPABLE = () => [...CATALOG.filter(i => i.price > 0), ...WEAR];
/** Oferta del día: igual para todos ese día, -30%, dentro de tu nivel (+3 para antojar). */
export function dailyDeal(g = game(), iso = S.todayIso()) {
  const lvl = level(g);
  const pool = SHOPPABLE().filter(i => i.lvl <= lvl + 3 && !(i.kind === 'wear' && g.owned[i.id]));
  if (!pool.length) return null;
  const it = pool[hash(iso + ':' + Math.floor(lvl / 5)) % pool.length];
  return { item: it, price: Math.max(1, Math.round(it.price * .7)), taken: !!(g.deals || {})[iso] };
}
export const newItems = (g = game()) => SHOPPABLE().filter(i => i.lvl === level(g) || i.lvl === level(g) - 1);
export function collection(g = game()) {
  const all = [...CATALOG, ...WEAR]; const own = all.filter(i => g.owned[i.id]);
  return { own: own.length, total: all.length, pct: own.length / all.length };
}
export function buy(itemId, { deal = false } = {}) {
  const g = game(); const it = itemById(itemId); const lvl = level(g);
  if (!it) return { ok: false, msg: 'No existe' };
  if (it.kind === 'wear' && g.owned[itemId]) { g.wear[it.slot] = g.wear[it.slot] === itemId ? null : itemId; saveGame(g); return { ok: true, msg: g.wear[it.slot] ? `${it.e} puesto` : `${it.e} guardado` }; }
  const d = deal ? dailyDeal(g) : null;
  const useDeal = d && d.item.id === itemId && !d.taken;
  const price = useDeal ? d.price : it.price;
  if (!useDeal && lvl < it.lvl) return { ok: false, msg: `🔒 Se desbloquea en el nivel ${it.lvl}` };
  if (g.bits < price) return { ok: false, msg: `Te faltan ${price - g.bits} bits. Cumple un hábito y vuelve 💪` };
  g.bits -= price; g.owned[itemId] = (g.owned[itemId] || 0) + 1;
  if (useDeal) { g.deals = { ...(g.deals || {}), [S.todayIso()]: itemId }; }
  if (it.kind === 'wear') g.wear[it.slot] = itemId;
  g.stats.spent = (g.stats.spent || 0) + price;
  saveGame(g);
  return { ok: true, bought: true, price, msg: `${it.e} ${it.n} es tuyo` };
}
/** Caja sorpresa: rareza al azar (60/28/10/2), prefiere lo que aún no tienes. */
export const BOX_PRICE = 150;
export function mysteryBox(rand = Math.random) {
  const g = game(); const lvl = level(g);
  if (lvl < 2) return { ok: false, msg: '🔒 La caja sorpresa se abre en el nivel 2' };
  if (g.bits < BOX_PRICE) return { ok: false, msg: `Te faltan ${BOX_PRICE - g.bits} bits para la caja 🎁` };
  let roll = rand() * 100, rar = RARITY[0];
  for (const r of RARITY) { if (roll < r.w) { rar = r; break; } roll -= r.w; }
  const order = [rar, ...RARITY.filter(r => r !== rar).reverse()];
  let pool = [];
  for (const r of order) {
    const all = SHOPPABLE().filter(i => rarityOf(i) === r && i.lvl <= lvl + 10 && !(i.kind === 'wear' && g.owned[i.id]));
    const fresh = all.filter(i => !g.owned[i.id]);
    pool = fresh.length ? fresh : all;
    if (pool.length) { rar = r; break; }
  }
  if (!pool.length) return { ok: false, msg: 'Ya tienes todo 🤯' };
  const it = pool[Math.floor(rand() * pool.length)];
  const isNew = !g.owned[it.id];
  g.bits -= BOX_PRICE; g.owned[it.id] = (g.owned[it.id] || 0) + 1;
  g.stats.boxes = (g.stats.boxes || 0) + 1; g.stats.spent = (g.stats.spent || 0) + BOX_PRICE;
  saveGame(g);
  return { ok: true, item: it, rarity: rar, isNew };
}

/* ---------- logros ---------- */
export function achievements(g, extra) {
  const lvl = level(g);
  const L = [
    ['s1', '🥇', 'Primer hábito completo', g.stats.sessions, 1], ['s10', '🔟', '10 hábitos completos', g.stats.sessions, 10], ['s100', '💯', '100 hábitos completos', g.stats.sessions, 100],
    ['m60', '⏱️', '1 hora de hábitos', g.stats.minutes, 60], ['m600', '⌛', '10 horas de hábitos', g.stats.minutes, 600], ['m6000', '🕰️', '100 horas de hábitos', g.stats.minutes, 6000],
    ['r3', '🔥', 'Racha de 3 días', extra.streak, 3], ['r7', '⚡', 'Racha de 7 días', extra.streak, 7], ['r30', '🌋', 'Racha de 30 días', extra.streak, 30], ['r100', '☄️', 'Racha de 100 días', extra.streak, 100],
    ['cofre', '🎁', '10 días perfectos', Object.keys(g.chest).length, 10],
    ['p3', '🚗', 'Garaje desbloqueado', lvl, 3], ['p10', '🏎️', 'Garaje doble', lvl, 10], ['p11', '🏙️', 'Torre Centro', lvl, 11], ['p26', '🌆', 'Rascacielos IO', lvl, 26], ['p50', '🚁', 'Helipuerto', lvl, 50], ['p76', '🛰️', 'Estación orbital', lvl, 76],
  ];
  return L.map(([id, e, n, v, goal]) => ({ id, e, n, v: Math.min(v || 0, goal), goal, done: (v || 0) >= goal }));
}
