/* IO — el lobby de la torre (planta baja). Es un mundo ancho que se recorre caminando:
 * ◀ garaje del edificio (el IO-100 rojo que cuida Max) · parqueadero con puestos y nombres ·
 * muro de fundadores y ascensor · recepción con Don Pedro · pantalla gigante (el único anuncio de IO) ·
 * piscina · gimnasio · biblioteca ▶. Las zonas comunes se llenan con jugadores reales que están en línea. */
import { npcSVG } from './npc.js';
import * as W from './world.js';

export const LOBBY_W = 8;              // ancho del lobby, en pantallas
export const ELEV_X = .355;            // el ascensor (fracción del ancho total)
export const START_X = .4;             // donde apareces al llegar
const Z = i => i / LOBBY_W;            // borde izquierdo de la zona i
const ZW = 100 / LOBBY_W;              // ancho de una zona en %

/** Zonas (para el letrero de arriba y las presentaciones al entrar). */
export const ZONES = [
  { id: 'garaje', ic: '🏎️', n: 'Garaje IO-100' },
  { id: 'parqueo', ic: '🅿️', n: 'Parqueadero' },
  { id: 'muro', ic: '🏛️', n: 'Muro de fundadores' },
  { id: 'recepcion', ic: '🛎️', n: 'Recepción' },
  { id: 'tv', ic: '📺', n: 'IO TV' },
  { id: 'piscina', ic: '🏊', n: 'Piscina' },
  { id: 'gym', ic: '🏋️', n: 'Gimnasio' },
  { id: 'biblio', ic: '📚', n: 'Biblioteca' },
];
export const zoneAt = x => ZONES[Math.max(0, Math.min(LOBBY_W - 1, Math.floor(x * LOBBY_W)))];

/** Puntos donde A hace algo (x = fracción del ancho total, r = qué tan cerca hay que estar). */
export const HOT = [
  { id: 'car', x: Z(0) + .04, r: .035, label: 'IO-100' },
  { id: 'max', x: Z(0) + .086, r: .022, label: 'Max' },
  { id: 'park', x: Z(1) + .062, r: .06, label: 'Parqueadero' },
  { id: 'wall', x: Z(2) + .045, r: .045, label: 'Muro' },
  { id: 'pedro', x: Z(3) + .08, r: .04, label: 'Don Pedro' },
  { id: 'tv', x: Z(4) + .062, r: .055, label: 'IO TV' },
  { id: 'pool', x: Z(5) + .062, r: .055, label: 'Piscina' },
  { id: 'gym', x: Z(6) + .062, r: .055, label: 'Gimnasio' },
  { id: 'lib', x: Z(7) + .062, r: .055, label: 'Biblioteca' },
];

/* ---------- el carro rojo (dibujo propio) ---------- */
const RED_CAR = `<svg class="redcar" viewBox="0 0 240 96" aria-hidden="true">
  <defs><linearGradient id="rcB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a5a"/><stop offset=".45" stop-color="#dc1f26"/><stop offset="1" stop-color="#7f0d12"/></linearGradient>
  <linearGradient id="rcG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#bfe9ff"/><stop offset="1" stop-color="#1e3a5f"/></linearGradient>
  <radialGradient id="rcW" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#e5e7eb"/><stop offset=".55" stop-color="#9ca3af"/><stop offset=".62" stop-color="#111827"/><stop offset="1" stop-color="#030712"/></radialGradient></defs>
  <ellipse cx="120" cy="88" rx="108" ry="7" fill="rgba(0,0,0,.45)"/>
  <path d="M14 66C14 56 22 50 36 48L78 42C92 26 116 20 142 21C166 22 186 32 200 44L222 49C232 52 236 59 235 66L234 74H14Z" fill="url(#rcB)"/>
  <path d="M86 44C98 31 116 26 140 26C160 27 176 34 188 45Z" fill="url(#rcG)"/><path d="M137 26.5V45" stroke="#7f0d12" stroke-width="3"/>
  <path d="M96 40C106 32 118 29 132 29" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55" fill="none"/>
  <path d="M20 60H232" stroke="#ff9a9a" stroke-width="2" opacity=".6"/><path d="M40 52L210 52" stroke="#7f0d12" stroke-width="1.4" opacity=".5"/>
  <rect x="222" y="54" width="12" height="7" rx="3" fill="#fef9c3" class="rc-lamp"/><rect x="14" y="56" width="10" height="6" rx="2" fill="#ef4444"/>
  <text x="122" y="66" text-anchor="middle" font-family="Press Start 2P,monospace" font-size="9" fill="#fde68a">IO-100</text>
  <g class="rc-wheel"><circle cx="62" cy="74" r="15" fill="url(#rcW)"/><path d="M62 62v24M50 74h24M54 66l16 16M70 66L54 82" stroke="#d1d5db" stroke-width="2"/><circle cx="62" cy="74" r="4" fill="#dc2626"/></g>
  <g class="rc-wheel"><circle cx="190" cy="74" r="15" fill="url(#rcW)"/><path d="M190 62v24M178 74h24M182 66l16 16M198 66l-16 16" stroke="#d1d5db" stroke-width="2"/><circle cx="190" cy="74" r="4" fill="#dc2626"/></g>
</svg>`;

/* ---------- vehículo según el nivel (para los puestos del parqueadero) ---------- */
const carForLevel = l => l >= 100 ? 'io100' : l >= 25 ? '🏎️' : l >= 18 ? '🚐' : l >= 12 ? '🚙' : l >= 10 ? '🚗' : l >= 6 ? '🏍️' : '🛵';
/** Tu mejor vehículo (el más caro que tengas), o el IO-100 si ya te lo ganaste. */
export function myBestCar(g = W.game()) {
  if (g.owned?.io100) return 'io100';
  const vehs = W.CATALOG.filter(i => i.kind === 'veh' && g.owned?.[i.id] && i.id !== 'bici' && i.id !== 'patineta').sort((a, b) => b.price - a.price);
  return vehs[0]?.e || '';
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const carHTML = c => c === 'io100' ? `<span class="pk-car pk-red">${RED_CAR}</span>` : c ? `<span class="pk-car">${c}</span>` : '';
/** Los puestos del parqueadero: el tuyo (desde el nivel 5) y los de jugadores reales del ranking. */
export function parkingHTML({ me, lvl, rows = [] }) {
  const bays = [];
  bays.push(lvl >= 5 ? { n: me, car: myBestCar(), mine: true } : { lock: true });
  rows.filter(r => !r.me && r.level >= 5).slice(0, 3).forEach(r => bays.push({ n: r.name, car: carForLevel(r.level), lv: r.level }));
  while (bays.length < 4) bays.push({ free: true });
  return bays.map((b, i) => `<div class="pk-bay${b.mine ? ' mine' : ''}${b.lock ? ' lock' : ''}" style="left:${4 + i * 24}%">
    <span class="pk-num">P-${String(i + 1).padStart(2, '0')}</span>
    <span class="pk-sign">${b.lock ? '🔒 NIVEL 5' : b.free ? 'LIBRE' : esc(String(b.n).slice(0, 12).toUpperCase())}</span>
    ${b.mine && !b.car ? '<span class="pk-ghost">🚗</span>' : carHTML(b.car)}${b.lv ? `<small class="pk-lv">NV ${b.lv}</small>` : ''}<i class="pk-stop"></i>${b.free || b.lock ? `<em class="pk-paint">${b.lock ? 'NV 5' : 'P'}</em>` : ''}</div>`).join('');
}

/* ---------- el lobby completo ---------- */
const zone = (i, cls, inner) => `<div class="lz lz-${cls}" style="left:${i * ZW}%;width:${ZW}%">${inner}</div>`;
const sign = t => `<span class="lz-sign">${t}</span>`;
export function lobbyHTML() {
  const tvSlides = [
    '<b>IO TV</b><span>Tu vida es el juego</span>',
    '<b>ESPACIO PUBLICITARIO</b><span>Tu marca aquí, frente a todos los jugadores</span>',
    '<b>EL ÚNICO ANUNCIO DE IO</b><span>Gracias a esta pantalla, el juego sigue gratis</span>',
    '<b>👑 1% MEJOR CADA DÍA</b><span>Haz tu hábito y sube de piso</span>',
  ];
  return [
    zone(0, 'garage', `<div class="lz-wall"></div><div class="lz-ceil"><i></i><i></i><i></i></div>
      <div class="gx-neon">IO-100</div><div class="gx-spot s1"></div><div class="gx-spot s2"></div>
      <div class="gx-plinth"><i class="gx-ring"></i>${RED_CAR}</div>
      <div class="gx-rope"><i></i><i></i><i></i></div>
      <div class="gx-plaque"><b>NIVEL 100</b><small>Se entrega al llegar al piso 100</small></div>
      <div class="npc npc-max" data-npc="max">${npcSVG('max')}</div>
      <div class="lz-floor"></div><div class="gx-stripe"></div>`),
    zone(1, 'park', `<div class="lz-wall"></div><div class="lz-ceil"><i></i><i></i><i></i></div>
      <div class="pk-pipes"></div><div class="pk-level">P1</div><div class="pk-lift"><b>▲ P2</b><b>▼ P3</b></div>
      <div class="pk-bays" id="lzPark"></div>
      <div class="lz-floor"></div>${sign('🅿️ PARQUEADERO')}`),
    zone(2, 'founders', `<div class="lz-wall"></div><div class="lz-cols"><i></i><i></i></div>
      <div class="lz-chand"><i></i></div>
      <div class="rs-founders"><b>MURO DE FUNDADORES</b><div class="rs-plates"><i>?</i><i>?</i><i>?</i><i>?</i><i>?</i><i>?</i></div><small>Tu nombre puede estar aquí</small></div>
      <div class="lz-floor"></div><div class="lz-arrows"><span>⬅ 🏎️ 🅿️</span><span>🛎️ 📺 🏊 🏋️ 📚 ➡</span></div>`),
    zone(3, 'desk', `<div class="lz-wall"></div><div class="lz-cols"><i></i><i></i></div><div class="lz-chand"><i></i></div>
      <div class="dk-win"><i></i></div><div class="dk-keys">${'<i>🔑</i>'.repeat(6)}</div><div class="dk-clock"></div>
      <div class="npc npc-pedro" data-npc="pedro">${npcSVG('pedro')}</div>
      <div class="dk-desk"><b translate="no">IO TOWER</b><span class="dk-bell">🛎️</span><span class="dk-book">📒</span></div>
      <div class="lz-floor"></div>${sign('🛎️ RECEPCIÓN')}`),
    zone(4, 'tv', `<div class="lz-wall"></div>
      <div class="tv-frame"><div class="tv-screen">${tvSlides.map((h, i) => `<div class="tv-slide" style="--i:${i}">${h}</div>`).join('')}<i class="tv-scan"></i></div><span class="tv-led"></span></div>
      <div class="tv-tag">ANUNCIA AQUÍ · ESPACIO DISPONIBLE</div>
      <div class="tv-sofa"></div><div class="lz-floor"></div>`),
    zone(5, 'pool', `<div class="lz-wall"></div><div class="pl-win"><i></i></div>
      <div class="pl-chair"></div><span class="pl-ring">🛟</span><span class="pl-palm">🌴</span>
      <div class="lz-floor"></div><div class="pl-water"><i></i><i></i></div><div class="pl-ladder"></div>${sign('🏊 PISCINA')}`),
    zone(6, 'gym', `<div class="lz-wall"></div><div class="gy-mirror"><i></i></div><div class="gy-band">1% MEJOR CADA DÍA</div>
      <span class="gy-it g1">🏋️</span><span class="gy-it g2">🚴</span><span class="gy-it g3">🥊</span>
      <div class="lz-floor"></div>${sign('🏋️ GIMNASIO')}`),
    zone(7, 'lib', `<div class="lz-wall"></div><div class="lb-shelf"><i></i><i></i><i></i><i></i></div><div class="lb-lamp"></div>
      <div class="lb-table"><span>📖</span><span>☕</span></div><span class="lb-chair">💺</span>
      <div class="lz-floor"></div>${sign('📚 BIBLIOTECA')}`),
  ].join('');
}

/* ---------- lo que dicen ---------- */
const TIPS = [
  'Empieza con 2 minutos. Lo difícil es arrancar, no seguir.',
  'Pon el hábito al lado de algo que ya haces: después del café, leo una página.',
  'Si fallas un día, no pasa nada. Si fallas dos, ahí sí toca volver.',
  'Deja listo lo que necesitas la noche anterior: los tenis junto a la puerta.',
  'No cuentes cuánto falta. Cuenta cuántas veces volviste.',
  'El hábito difícil, temprano. La fuerza de voluntad se gasta en el día.',
  'Celebra cada corona. Tu cerebro aprende lo que se siente bien.',
  'Hazlo tan fácil que sea ridículo no hacerlo.',
  'Un hábito a la vez. Los edificios se suben piso por piso.',
  'Cuando no tengas ganas, haz la versión mínima. Cuenta igual.',
  'Tu ambiente manda más que tu motivación. Ordénalo a tu favor.',
  'Contarle a alguien tu meta te ayuda a cumplirla. Invita a un amigo.',
];
const tip = () => TIPS[Math.floor(Math.random() * TIPS.length)];
const hello = name => { const h = new Date().getHours(); return `${h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches'}, ${name}!`; };

/** Conversación de cada punto del lobby. ctx = { name, lvl, next (texto del próximo hábito), streak, spot } */
export function lines(id, ctx) {
  const { name = 'Player', lvl = 1, next = '', streak = 0 } = ctx;
  switch (id) {
    case 'pedro': return [
      ['pedro', `${hello(name)} Bienvenido a IO Tower. Yo cuido esta puerta desde que se puso el primer ladrillo.`],
      ['pedro', `Consejo de la casa: ${tip()}`],
      next ? ['pedro', `Tu próximo hábito es ${next}. Te espero de vuelta con la corona.`] : ['pedro', streak > 1 ? `Llevas ${streak} días seguidos. Así se construye una torre.` : 'Hoy ya cumpliste. Recorre el lobby: a la derecha están la piscina, el gimnasio y la biblioteca.'],
    ];
    case 'max': return lvl >= 100 ? [
      ['max', `¡${name}! Llegaste al piso 100. Palabra cumplida.`],
      ['max', 'Aquí tienes las llaves del IO-100. Ya está en tu puesto del parqueadero.'],
    ] : [
      ['max', `Alto ahí, ${name}. Este es el IO-100. Solo se entrega a quien llega al nivel 100.`],
      ['max', `Vas en el nivel ${lvl}. Te faltan ${100 - lvl} niveles. Yo te lo cuido mientras tanto.`],
      ['max', lvl >= 5 ? 'Ya tienes puesto propio en el parqueadero, junto al mío. Ahí se ve tu mejor vehículo.' : 'Desde el nivel 5 tienes puesto propio en el parqueadero, con tu nombre.'],
    ];
    case 'car': return [['io', lvl >= 100 ? '🏎️ El IO-100 es tuyo.' : '🏎️ IO-100 · edición única. Se entrega en el nivel 100. Habla con Max.']];
    case 'park': return [['io', lvl >= 5 ? `🅿️ Tu puesto es el P-01. Allí se ve tu mejor vehículo. Compra vehículos en la tienda y guárdalos en tu garaje.` : '🅿️ Desde el nivel 5 tienes puesto propio aquí, con tu nombre. Los demás puestos son de jugadores reales.']];
    case 'wall': return [['pedro', 'El muro de fundadores. Aquí van los nombres de quienes apoyan a IO para llegar a las tiendas. Apoyar nunca da ventajas en el juego.']];
    case 'tv': return [['io', '📺 IO TV: el único anuncio de la torre. Gracias a esta pantalla, IO sigue gratis para todos. Muy pronto abrimos este espacio para marcas.']];
    default: return null;
  }
}
/** Qué actividad corresponde a cada zona común. */
export const AMENITY = { pool: ['swim'], gym: ['flex', 'run', 'yoga', 'walk', 'jump'], lib: ['read', 'study', 'write'] };
/** Dónde aparecen los jugadores en línea (zona y actividad), por turnos. */
export const FOLK_SPOTS = [
  { x: Z(5) + .03, act: 'swim' }, { x: Z(6) + .035, act: 'flex' }, { x: Z(7) + .04, act: 'read' }, { x: Z(3) + .112, act: 'stand' },
  { x: Z(5) + .085, act: 'swim' }, { x: Z(6) + .09, act: 'flex' }, { x: Z(7) + .09, act: 'read' }, { x: Z(4) + .07, act: 'stand' },
];
