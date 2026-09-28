/* IO — tu compañero. Empieza como un huevo, nace con tus primeras coronas y evoluciona
 * mientras sigues cumpliendo. Se pone triste si fallas, pero nunca se muere: te espera. */
import * as W from './world.js';
import * as H from './habits.js';
import { todayIso, addDays } from './store.js';

export const SPECIES = {
  ave: { n: 'Ave', chain: ['🥚', '🐣', '🐥', '🦜', '🦚'], name: 'Pío' },
  dragon: { n: 'Dragón', chain: ['🥚', '🦎', '🐊', '🐲', '🐉'], name: 'Draco' },
  felino: { n: 'Felino', chain: ['🥚', '🐱', '🐈', '🐆', '🐅'], name: 'Michi' },
  marino: { n: 'Marino', chain: ['🥚', '🐟', '🐠', '🐬', '🐳'], name: 'Burbuja' },
};
export const STAGES = [['Huevo', 0], ['Bebé', 3], ['Joven', 15], ['Adulto', 45], ['Leyenda', 120]];
const stageOf = sessions => STAGES.reduce((k, [, min], i) => (sessions >= min ? i : k), 0);

export function get(g = W.game()) {
  const p = g.pet || null; const sessions = g.stats.sessions || 0; const st = stageOf(sessions);
  const sp = SPECIES[p?.sp] || null;
  const next = STAGES[st + 1];
  const claimedOn = d => Object.values(H.log(d).s).some(s => s.claimed) || !!g.shielded?.[d];
  const today = claimedOn(todayIso()), yest = claimedOn(addDays(todayIso(), -1));
  const planned = H.forDay(addDays(todayIso(), -1)).length > 0;
  const mood = today ? 'feliz' : yest || !planned ? 'tranquilo' : 'triste';
  return {
    stage: st, stageName: STAGES[st][0], e: st === 0 || !sp ? '🥚' : sp.chain[st], sp: p?.sp, spName: sp?.n, name: p?.name || sp?.name || 'Huevo',
    toNext: next ? next[1] - sessions : 0, nextName: next?.[0], pct: next ? (sessions - STAGES[st][1]) / (next[1] - STAGES[st][1]) : 1, mood,
  };
}
/** Llamar después de cada corona: devuelve si nació o evolucionó. */
export function check() {
  const g = W.game(); const st = stageOf(g.stats.sessions || 0);
  g.pet ||= { stage: 0 };
  const before = g.pet.stage || 0; if (st <= before) return null;
  if (!g.pet.sp) { const keys = Object.keys(SPECIES); g.pet.sp = keys[Math.floor(Math.random() * keys.length)]; g.pet.born = todayIso(); }
  g.pet.stage = st; W.saveGame(g);
  const p = get(g); return { type: before === 0 ? 'hatch' : 'evolve', from: before === 0 ? '🥚' : SPECIES[g.pet.sp].chain[before], to: p.e, p };
}
export function rename(name) { const g = W.game(); g.pet ||= { stage: 0 }; g.pet.name = String(name).trim().slice(0, 14); W.saveGame(g); }
const LINES = {
  feliz: ['¡Hoy vamos con todo!', '¡Estoy orgulloso de ti!', '¿Otro hábito? ¡Vamos!', '❤️'],
  tranquilo: ['¿Qué hacemos hoy?', 'Te acompaño en el próximo hábito.', 'Un hábito y salimos a jugar.'],
  triste: ['Ayer te extrañé… ¿volvemos hoy?', 'No pasa nada. Hoy empezamos otra vez.', 'Un hábito cortito y quedo feliz.'],
};
export const line = p => { const l = LINES[p.mood]; return l[Math.floor(Math.random() * l.length)]; };
