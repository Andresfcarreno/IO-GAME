/* IO — escenas del modo enfoque: mientras corre el reloj, tu personaje hace lo mismo que tú.
 * Cada actividad define qué sostienen sus manos (se mueve con los brazos), qué hay detrás,
 * qué hay delante y su ánimo. La coreografía vive en styles.css (.fs-<actividad>). */
import { avatarSVG } from './avatar.js';

// emoji dentro del SVG del personaje, opcionalmente girado para compensar el brazo
const T = (e, x, y, size = 22, rot = 0, cls = '') => `<text class="${cls}" x="${x}" y="${y}" font-size="${size}" fill="#fff" text-anchor="middle" dominant-baseline="central"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${e}</text>`;
const dumbbell = (x, y) => `<g transform="rotate(90 ${x} ${y})"><rect x="${x - 10}" y="${y - 1.8}" width="20" height="3.6" rx="1.5" fill="#94a3b8"/><rect x="${x - 13}" y="${y - 6.5}" width="5" height="13" rx="1.6" fill="#1f2937"/><rect x="${x + 8}" y="${y - 6.5}" width="5" height="13" rx="1.6" fill="#1f2937"/></g>`;
const bubbles = words => words.map((w, i) => `<span class="fx-bub" style="--i:${i}">${w}</span>`).join('');
const floaters = (chars, n = 6) => [...Array(n)].map((_, i) => `<i class="fx-fl" style="--i:${i};--x:${10 + (i * 83) % 80}%">${chars[i % chars.length]}</i>`).join('');

const SCENES = {
  read: { mood: 'happy', holdR: (x, y) => T('📖', x - 12, y - 10, 38, -26, 'page'), front: floaters(['a', 'b', 'c', '✦'], 5) },
  study: { mood: 'neutral', holdR: (x, y) => T('📘', x - 12, y - 10, 34, -26), holdL: (x, y) => T('✏️', x + 6, y - 4, 16, 20), front: floaters(['A+', '∑', '✓', 'π'], 5) },
  write: { mood: 'happy', holdL: (x, y) => T('📓', x + 13, y - 8, 34, 24), holdR: (x, y) => T('✏️', x - 6, y - 10, 18, -20, 'pen'), front: floaters(['~', '✎', '…'], 4) },
  type: { mood: 'neutral', front: '<div class="fx-desk"><span class="fx-laptop">💻</span></div>' + floaters(['0', '1', '{ }', '</>'], 6) },
  talk: { mood: 'excited', holdR: (x, y) => T('💬', x, y + 6, 12), back: bubbles(['Hello!', 'How are you?', 'Bonjour', 'Thank you!']) },
  float: { mood: 'calm', back: '<div class="fx-aura"></div>', front: floaters(['✦', '·', '✧'], 6) },
  breathe: { mood: 'calm', back: '<div class="fx-breath"><span class="in">Inhala</span><span class="out">Exhala</span></div>' },
  yoga: { mood: 'calm', back: '<div class="fx-mat"></div>' },
  pray: { mood: 'calm', back: '<div class="fx-light"></div>', front: floaters(['✦', '♡', '✧'], 5) },
  unplug: { mood: 'happy', holdR: (x, y) => T('🍵', x - 4, y - 5, 26, -10), back: '<span class="fx-phone">📵</span>', front: floaters(['🍃', '🍂'], 4) },
  sleep: { mood: 'tired', back: '<div class="fx-bed"></div>', front: '<span class="fx-z" style="--i:0">z</span><span class="fx-z" style="--i:1">z</span><span class="fx-z" style="--i:2">Z</span>' },
  flex: { mood: 'excited', holdL: dumbbell, holdR: dumbbell, front: floaters(['💦', '💪'], 3) },
  run: { mood: 'excited', bg: 'park', front: floaters(['💦'], 2) },
  walk: { mood: 'happy', bg: 'park' },
  dog: { mood: 'happy', bg: 'park', holdR: (x, y) => `<circle cx="${x}" cy="${y + 3}" r="2.2" fill="#b91c1c"/>`, front: '<svg class="fx-leash" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 0 Q 40 80 100 84" /></svg><span class="fx-dog">🐕</span>' },
  swim: { mood: 'excited', front: '<div class="fx-water"><i></i><i></i></div>' },
  eat: { mood: 'happy', holdR: (x, y) => T('🍴', x - 2, y - 6, 16, -30), front: '<div class="fx-table"><span>🥗</span></div>' },
  cook: { mood: 'happy', holdR: (x, y) => T('🍳', x - 12, y - 2, 32, -20, 'pan'), front: floaters(['♨', '~', '♨'], 4) },
  water: { mood: 'happy', holdR: (x, y) => T('🥤', x - 2, y - 9, 26, 0), front: floaters(['💧'], 4) },
  clean: { mood: 'happy', holdR: (x, y) => T('🧹', x - 4, y + 14, 54, 150), front: '<div class="fx-dust"><i></i><i></i><i></i></div>' },
  music: { mood: 'excited', holdL: (x, y) => T('🎸', x + 16, y - 8, 56, 40), front: floaters(['♪', '♫', '♬'], 6) },
  draw: { mood: 'happy', holdL: (x, y) => T('🎨', x + 8, y - 6, 30, 30), holdR: (x, y) => T('🖌️', x - 4, y - 10, 18, -30, 'brush'), back: '<div class="fx-easel"><i></i></div>' },
  jump: { mood: 'happy', front: floaters(['⭐', '✦'], 4) },
};

/** Escena completa para el modo enfoque. */
export function sceneHTML(act, look, wear = {}) {
  const sc = SCENES[act] || SCENES.jump;
  const wearCls = ['head', 'face'].map(s => (wear[s] ? 'wear-' + wear[s] : '')).join(' ');
  return `<div class="fs fs-${SCENES[act] ? act : 'jump'}${sc.bg ? ' bg-' + sc.bg : ''}" data-mood="${sc.mood}">
    <div class="fs-bg"><i class="b1"></i><i class="b2"></i><i class="b3"></i></div>
    <div class="fs-back">${sc.back || ''}</div>
    <div class="fs-char ${wearCls}">${avatarSVG(look, 'av', undefined, { holdL: sc.holdL, holdR: sc.holdR })}</div>
    <div class="fs-front">${sc.front || ''}</div>
  </div>`;
}
export const hasScene = act => !!SCENES[act];
