/* IO — escenas del modo enfoque: mientras corre el reloj, tu personaje hace lo mismo que tú.
 * Cada actividad define qué sostienen sus manos (se mueve con los brazos), el escenario de atrás,
 * lo de adelante, su postura y un contador en vivo (páginas, km, reps, respiraciones…).
 * En todas crece un arbolito con tu progreso. La coreografía vive en styles.css (.fs-<actividad>). */
import { avatarSVG } from './avatar.js';

// emoji dentro del SVG del personaje, opcionalmente girado para compensar el brazo
const T = (e, x, y, size = 22, rot = 0, cls = '') => `<text class="${cls}" x="${x}" y="${y}" font-size="${size}" fill="#fff" text-anchor="middle" dominant-baseline="central"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${e}</text>`;
const dumbbell = (x, y) => `<g transform="rotate(90 ${x} ${y})"><rect x="${x - 10}" y="${y - 1.8}" width="20" height="3.6" rx="1.5" fill="#94a3b8"/><rect x="${x - 13}" y="${y - 6.5}" width="5" height="13" rx="1.6" fill="#1f2937"/><rect x="${x + 8}" y="${y - 6.5}" width="5" height="13" rx="1.6" fill="#1f2937"/></g>`;
const bubbles = words => words.map((w, i) => `<span class="fx-bub" style="--i:${i}">${w}</span>`).join('');
const floaters = (chars, n = 6) => [...Array(n)].map((_, i) => `<i class="fx-fl" style="--i:${i};--x:${10 + (i * 83) % 80}%">${chars[i % chars.length]}</i>`).join('');
// franja que se repite sin costura para el paisaje en movimiento (parallax)
const strip = (cls, items) => `<div class="px ${cls}"><div>${items}</div><div>${items}</div></div>`;
const PARK = strip('px-cloud', '<i>☁️</i><i>☁️</i><i>☁️</i>')
  + '<div class="px-hills"></div>'
  + strip('px-mid', '<i>🌳</i><i>🏡</i><i>🌲</i><i>🌳</i><i>⛲</i><i>🌲</i><i>🏠</i><i>🌳</i><i>🏪</i>')
  + strip('px-near', '<i>🌷</i><i>🌼</i><i>🌿</i><i>🌻</i><i>🍄</i><i>🌸</i><i>🌿</i><i>🌷</i><i>🌼</i><i>🌱</i>');
const FLIERS = e => `<span class="fx-fly f1">${e}</span><span class="fx-fly f2">${e}</span>`;
const CHAIR_BACK = '<div class="fx-chair-b"></div><div class="fx-lamp"></div>';
const CHAIR_FRONT = '<div class="fx-chair-f"><i></i><i></i></div>';
const DESK = (top = '') => `<div class="fx-desk2">${top}</div>`;

const SCENES = {
  read: { mood: 'happy', sit: true, sky: 'room', holdR: (x, y) => T('📖', x - 12, y - 10, 38, -26, 'page'), back: CHAIR_BACK + '<span class="fx-pagefly">📄</span>', front: CHAIR_FRONT + '<span class="fx-cat">🐈</span>' },
  study: { mood: 'neutral', sit: true, sky: 'room', holdR: (x, y) => T('✏️', x - 6, y - 10, 18, -20, 'pen'), back: '<div class="fx-lamp r"></div>' + floaters(['A+', '∑', '✓', 'π', '💡'], 5), front: DESK('<span class="fx-books">📚</span><span class="fx-open">📖</span>') },
  write: { mood: 'happy', sit: true, sky: 'room', holdR: (x, y) => T('✏️', x - 6, y - 10, 18, -20, 'pen'), back: floaters(['✎', '…', '✦'], 4), front: DESK('<div class="fx-paper"><i></i><i></i><i></i><i></i><i></i></div><span class="fx-cup">☕</span>') },
  type: { mood: 'neutral', sit: true, sky: 'room', back: floaters(['0', '1', '{ }', '</>', '✓'], 6), front: DESK('<div class="fx-mon"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="fx-cup">☕</span>') },
  talk: { mood: 'excited', sky: 'room', holdR: (x, y) => T('💬', x, y + 6, 12), back: bubbles(['Hello!', 'How are you?', 'Bonjour', 'Thank you!', 'Ciao!', 'Nice to meet you']) + floaters(['🇬🇧', '🇺🇸', '🇫🇷', '🇮🇹'], 4) },
  float: { mood: 'calm', sit: 'cross', sky: 'dusk', back: '<div class="fx-aura"></div><div class="fx-orbit"><i>✦</i><i>✧</i><i>·</i></div>', front: '<div class="fx-cushion"></div>' + floaters(['✦', '·', '✧'], 5) },
  breathe: { mood: 'calm', sky: 'dusk', back: '<div class="fx-breath"><span class="in">Inhala</span><span class="out">Exhala</span></div>' },
  yoga: { mood: 'calm', sky: 'dawn', back: '<div class="fx-sun"></div><div class="fx-mat"></div>' },
  pray: { mood: 'calm', sit: 'kneel', sky: 'dusk', back: '<div class="fx-rays"></div><div class="fx-light"></div><span class="fx-dove">🕊️</span><span class="fx-candle l">🕯️</span><span class="fx-candle r">🕯️</span>', front: '<div class="fx-cushion"></div>' + ['gracias', 'paz', 'fe', 'amor', 'luz'].map((w, i) => `<i class="fx-word" style="--i:${i};--x:${12 + i * 18}%">${w}</i>`).join('') },
  unplug: { mood: 'happy', sit: true, sky: 'dawn', holdR: (x, y) => T('🍵', x - 4, y - 5, 26, -10), back: '<span class="fx-phone">📵</span>' + FLIERS('🦋'), front: CHAIR_FRONT + floaters(['🍃', '🍂'], 4) },
  sleep: { mood: 'tired', sky: 'night', back: '<div class="fx-moon"></div><div class="fx-bed"></div>', front: '<span class="fx-z" style="--i:0">z</span><span class="fx-z" style="--i:1">z</span><span class="fx-z" style="--i:2">Z</span>' },
  flex: { mood: 'excited', sky: 'gym', holdL: dumbbell, holdR: dumbbell, back: '<div class="fx-rack">🏋️ 🥊 🏋️</div>', front: floaters(['💦', '💪', '🔥'], 4), move: 'press' },
  run: { mood: 'excited', sky: 'day', park: true, back: '<div class="fx-speed"><i></i><i></i><i></i></div>', front: floaters(['💦'], 2) },
  walk: { mood: 'happy', sky: 'day', park: true, back: FLIERS('🦋') },
  dog: { mood: 'happy', sky: 'day', park: true, holdR: (x, y) => `<circle cx="${x}" cy="${y + 3}" r="2.2" fill="#b91c1c"/>`, back: FLIERS('🦋'), front: '<svg class="fx-leash" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0 Q 40 80 100 84" /></svg><span class="fx-dog">🐕</span><span class="fx-heart">❤️</span>' },
  swim: { mood: 'excited', sky: 'pool', back: strip('px-fish', '<i>🐠</i><i>🐟</i><i>🐡</i><i>🐠</i>'), front: '<div class="fx-water"><i></i><i></i></div><div class="fx-lane"></div>' + floaters(['○', '◦'], 5) },
  eat: { mood: 'happy', sky: 'room', holdR: (x, y) => T('🍴', x - 2, y - 6, 16, -30), front: '<div class="fx-table"><span>🥗</span><em>🥤</em></div>' },
  cook: { mood: 'happy', sky: 'room', holdR: (x, y) => T('🍳', x - 12, y - 2, 32, -20, 'pan'), front: '<div class="fx-stove"><span class="fx-fire">🔥</span><span class="fx-pot">🍲</span></div>' + floaters(['♨', '🥕', '🧅', '♨'], 4) },
  water: { mood: 'happy', sky: 'day', holdR: (x, y) => T('🥤', x - 2, y - 9, 26, 0), front: floaters(['💧'], 5) },
  clean: { mood: 'happy', sky: 'room', holdR: (x, y) => T('🧹', x - 4, y + 14, 54, 150), front: '<div class="fx-dust"><i></i><i></i><i></i></div><div class="fx-shine">' + '<i>✨</i>'.repeat(6) + '</div>' },
  music: { mood: 'excited', sky: 'stage', holdL: (x, y) => T('🎸', x + 16, y - 8, 56, 40), back: '<div class="fx-spot l"></div><div class="fx-spot r"></div>', front: '<div class="fx-eq">' + '<i></i>'.repeat(9) + '</div>' + floaters(['♪', '♫', '♬'], 6) },
  draw: { mood: 'happy', sky: 'room', holdL: (x, y) => T('🎨', x + 8, y - 6, 30, 30), holdR: (x, y) => T('🖌️', x - 4, y - 10, 18, -30, 'brush'), back: '<div class="fx-easel"><i></i></div>' },
  jump: { mood: 'happy', sky: 'dusk', front: floaters(['⭐', '✦'], 5) },
};

/** Escena completa. big = modo enfoque (cielo por hora, arbolito y contador). */
export function sceneHTML(act, look, wear = {}, { big = false, pet = null } = {}) {
  const key = SCENES[act] ? act : 'jump'; const sc = SCENES[key];
  const wearCls = ['head', 'face'].map(s => (wear[s] ? 'wear-' + wear[s] : '')).join(' ');
  const h = new Date().getHours(); const tod = h >= 6 && h < 17 ? 'dia' : h >= 17 && h < 20 ? 'tarde' : 'noche';
  const sit = sc.sit === true ? ' sit' : sc.sit ? ' sit sit-' + sc.sit : '';
  return `<div class="fs fs-${key}${sc.park ? ' bg-park' : ''}${big ? ' big' : ''}${sit} sky-${sc.sky || 'dusk'}" data-mood="${sc.mood}" data-tod="${tod}"${sc.move ? ` data-move="${sc.move}"` : ''}>
    <div class="fs-bg">${sc.park ? PARK : ''}</div>
    <div class="fs-back">${sc.back || ''}</div>
    <div class="fs-char ${wearCls}">${avatarSVG(look, 'av', undefined, { holdL: sc.holdL, holdR: sc.holdR })}</div>
    <div class="fs-front">${sc.front || ''}</div>
    ${pet ? `<span class="fx-pet${pet.stage === 0 ? ' egg' : ''}" style="--ps:${[.8, .8, .95, 1.1, 1.25][pet.stage]}">${pet.e}</span>` : ''}
    ${big ? '<div class="fx-count" aria-live="off"></div><div class="fx-grow"><b>🌰</b><small>crece contigo</small></div>' : ''}
  </div>`;
}
export const hasScene = act => !!SCENES[act];

/* ---------- lo que pasa con el tiempo: contador, rutina de ejercicio y arbolito ---------- */
const GROW = ['🌰', '🌱', '🌿', '🪴', '🌳'];
const MOVES = [['press', 'Press de hombros'], ['squat', 'Sentadillas'], ['jacks', 'Jumping jacks'], ['curl', 'Curl de bíceps']];
const n0 = n => Math.floor(n).toLocaleString('es-CO');
const km = (el, kmh) => `${(el / 3600 * kmh).toFixed(2)} km`;
const COUNT = {
  read: el => `📄 página ${1 + Math.floor(el / 50)}`,
  study: el => `📝 ${1 + Math.floor(el / 90)} ejercicio${el >= 90 ? 's' : ''}`,
  write: el => `✍️ ${n0(el * .6)} palabras`,
  type: el => `⌨️ ${n0(el * 1.4)} líneas`,
  talk: el => `💬 ${1 + Math.floor(el / 20)} frases`,
  float: el => `🧘 ${n0(el / 60)} min en calma`,
  breathe: el => `🌬️ ${Math.floor(el / 8)} respiraciones`,
  yoga: el => `🤸 ${1 + Math.floor(el / 8)} posturas`,
  pray: () => '🙏 en conversación',
  unplug: el => `📵 ${n0(el / 60)} min sin pantalla`,
  sleep: () => '🌙 descansando',
  flex: (el, root) => { const m = Math.floor(el / 12) % MOVES.length; if (root.dataset.move !== MOVES[m][0]) root.dataset.move = MOVES[m][0]; return `💪 ${MOVES[m][1]} · ${1 + Math.floor((el % 12) / 1.6)} reps · ${1 + Math.floor(el / 48)}ª ronda`; },
  run: el => `🏃 ${km(el, 9)}`,
  walk: el => `👣 ${n0(el * 1.8)} pasos · ${km(el, 4.8)}`,
  dog: el => `🐕 ${n0(el * 1.8)} pasos juntos`,
  swim: el => `🏊 ${1 + Math.floor(el / 45)} largos`,
  eat: el => `🍴 ${1 + Math.floor(el / 25)} bocados con calma`,
  cook: el => `🍲 paso ${1 + Math.floor(el / 120)} de la receta`,
  water: el => `💧 ${Math.min(250, Math.floor(el * 4))} ml`,
  clean: el => `✨ ${Math.floor(el / 30)} rincones limpios`,
  music: el => `🎵 ${n0(el * 2)} notas`,
  draw: el => `🎨 ${n0(el * .8)} trazos`,
  jump: el => `⭐ ${n0(el / 60)} min`,
};
export function runScene(root, act) {
  const cnt = root.querySelector('.fx-count'); const grow = root.querySelector('.fx-grow b');
  let stage = -1, lastTxt = '';
  return {
    update(p, el) {
      root.style.setProperty('--p', Math.min(1, p).toFixed(3));
      const st = Math.min(4, Math.floor(p * 5));
      if (grow && st !== stage) { stage = st; grow.textContent = GROW[st]; grow.classList.remove('pop'); void grow.offsetWidth; grow.classList.add('pop'); }
      const txt = (COUNT[act] || COUNT.jump)(el, root);
      if (cnt && txt !== lastTxt) { lastTxt = txt; cnt.textContent = txt; }
    },
  };
}
