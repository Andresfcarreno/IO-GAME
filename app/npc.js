/* IO — la gente de la torre. Personajes que viven en el edificio y hablan contigo en cajas de diálogo
 * al estilo de las consolas de bolsillo, con su retrato. Se dibujan con el mismo motor que tu personaje. */
import { avatarSVG, normLook } from './avatar.js';
import { cfg } from './store.js';
import * as W from './world.js';

const tie = c => `<path d="M58.2 69h3.6l1.4 3-1.6 1.6 1.8 14-3.4 3.6-3.4-3.6 1.8-14-1.6-1.6z" fill="${c}"/>`;
const badge = `<path d="M${67} 84l3 -1.4 3 1.4v4q-3 2.4-6 0z" fill="#fbbf24" stroke="#b45309" stroke-width=".6"/>`;
const buttons = c => [80, 90, 100, 110].map(y => `<circle cx="56" cy="${y}" r="1.3" fill="${c}"/><circle cx="64" cy="${y}" r="1.3" fill="${c}"/>`).join('');
const key = `<g transform="rotate(-20 70 92)"><circle cx="70" cy="88" r="2.6" fill="none" stroke="#fbbf24" stroke-width="1.4"/><path d="M70 90.6v7.4M70 95.4h2.2M70 97.6h1.6" stroke="#fbbf24" stroke-width="1.4" stroke-linecap="round"/></g>`;

/** Personajes del edificio. look = apariencia; wear = accesorios; extra = ropa especial; c = color de su caja. */
export const NPC = {
  pedro: { n: 'Don Pedro', role: 'Recepción', c: '#fbbf24', voice: 220,
    look: { body: 'm', build: 'robusto', skin: '#e0a77f', hairStyle: 'corto', hair: '#f8fafc', beard: 'completa', eye: '#3b2314', top: 'chaqueta', topColor: '#1e3a8a', bottom: 'pantalon', pants: '#1e293b', shoes: '#111827' },
    wear: ['lentes', 'halo'], extra: tie('#b91c1c') + key },
  rita: { n: 'Rita', role: 'Ascensorista', c: '#f87171', voice: 520,
    look: { body: 'f', build: 'delgado', skin: '#c68a5e', hairStyle: 'moño', hair: '#1c120c', eye: '#3b2314', feature: 'rubor', top: 'chaqueta', topColor: '#b91c1c', bottom: 'falda', pants: '#7f1d1d', shoes: '#111827' },
    wear: ['kepi'], extra: buttons('#fbbf24') },
  max: { n: 'Max', role: 'Seguridad', c: '#38bdf8', voice: 150,
    look: { body: 'm', build: 'robusto', skin: '#8a5433', hairStyle: 'rapado', hair: '#1c120c', beard: 'bigote', eye: '#1c120c', top: 'camisa', topColor: '#1e293b', bottom: 'pantalon', pants: '#0f172a', shoes: '#111827' },
    wear: ['gorraseg', 'gafas'], extra: badge },
};

/** El personaje entero (para la escena). */
export function npcSVG(k, mood = 'happy') {
  const p = NPC[k]; if (!p) return '';
  return `<div class="npc-in ${p.wear.map(w => 'wear-' + w).join(' ')}" data-mood="${mood}">${avatarSVG(normLook(p.look), 'av', '0 0 120 200', { extra: p.extra })}</div>`;
}

/* ---------- quién habla: retrato y nombre para la caja de diálogo ---------- */
const IO_FACE = `<svg viewBox="0 0 64 64" class="io-face" aria-hidden="true"><rect x="8" y="4" width="48" height="56" rx="7" fill="#d9d4ea"/><rect x="8" y="50" width="48" height="10" rx="5" fill="#b9b2d6"/><rect x="14" y="10" width="36" height="28" rx="3" fill="#3c3a5a"/><rect x="18" y="13" width="28" height="22" rx="2" fill="#a7d62a"/><rect x="24" y="19" width="4" height="6" rx="1" fill="#1d3311" class="io-eye"/><rect x="36" y="19" width="4" height="6" rx="1" fill="#1d3311" class="io-eye"/><path d="M27 28q5 4 10 0" stroke="#1d3311" stroke-width="2.2" fill="none" stroke-linecap="round" class="io-mouth"/><path d="M17 44h8M21 40v8" stroke="#2b2944" stroke-width="3.4" stroke-linecap="round"/><circle cx="42" cy="46" r="3.2" fill="#a12a62"/><circle cx="49" cy="42" r="3.2" fill="#a12a62"/></svg>`;
/** Datos de quien habla. who: 'io' | 'me' | 'pedro' | 'rita' | 'max' | { pet: emoji, name } */
export function speaker(who) {
  if (who && typeof who === 'object') return { key: 'pet', name: who.name, c: '#86efac', voice: 700, pt: `<span class="pt-emoji">${who.pet}</span>` };
  if (who === 'me') { const w = W.game().wear || {}; return { key: 'me', name: cfg.name || 'Tú', c: '#c4b5fd', voice: 380, pt: `<div class="${['head', 'face'].map(k => w[k] ? 'wear-' + w[k] : '').join(' ')}">${avatarSVG(cfg.avatar || {}, 'av', '28 -4 64 70')}</div>` }; }
  if (NPC[who]) { const p = NPC[who]; return { key: who, name: p.n, c: p.c, voice: p.voice, pt: `<div class="${p.wear.map(w => 'wear-' + w).join(' ')}">${avatarSVG(normLook(p.look), 'av', '28 -6 64 72', { extra: p.extra })}</div>` }; }
  return { key: 'io', name: 'IO', c: '#a7d62a', voice: 600, pt: IO_FACE };
}
