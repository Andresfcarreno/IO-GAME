/* IO — coach: lee tus últimas dos semanas y te propone ajustes concretos, con un botón para aplicarlos.
 * Reglas simples y transparentes (la versión con IA llegará con IO+). */
import * as H from './habits.js';
import { todayIso, addDays, pad } from './store.js';

const hhmm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(Math.round(m % 60 / 5) * 5 % 60)}`;
export function tips() {
  const out = []; const hs = H.list(); if (!hs.length) return [{ e: '👋', t: 'Crea tu primer hábito', d: 'Empieza con algo de 5 a 10 minutos. Lo pequeño que se cumple gana.', act: null }];
  for (const h of hs) {
    let plan = 0, done = 0, late = 0, startM = [];
    for (let i = 1; i <= 14; i++) {
      const iso = addDays(todayIso(), -i); if (!H.scheduled(h, iso)) continue; plan++;
      const s = H.sess(h.id, iso); if (s.claimed) { done++; if (s.onTime === false) late++; if (s.startedAt) { const d = new Date(s.startedAt); startM.push(d.getHours() * 60 + d.getMinutes()); } }
    }
    if (plan < 3) continue;
    const rate = done / plan;
    if (rate < .4 && !H.isCount(h) && h.min > 10) out.push({ e: '🪜', t: `${h.emoji} ${h.nombre}: hazlo más pequeño`, d: `Lo cumpliste ${done} de ${plan} veces. Bájalo a ${Math.max(5, Math.round(h.min / 2))} min por dos semanas: un hábito pequeño que se cumple vale más.`, act: { id: h.id, min: Math.max(5, Math.round(h.min / 2)) }, w: 3 });
    else if (late >= 3 && startM.length >= 3) { const avg = startM.reduce((a, b) => a + b, 0) / startM.length; const nh = hhmm(avg); if (nh !== h.hora) out.push({ e: '⏰', t: `${h.emoji} ${h.nombre}: cámbialo a las ${nh}`, d: `Casi siempre lo empiezas cerca de las ${nh}, no a las ${h.hora}. Si lo mueves, ganas el +25% de "a tiempo".`, act: { id: h.id, hora: nh }, w: 2 }); }
    else if (rate >= .9 && done >= 7 && !H.isCount(h) && h.min < 60) out.push({ e: '🚀', t: `${h.emoji} ${h.nombre}: ¡súbele!`, d: `Lo cumpliste ${done} de ${plan} veces. ¿Pasas de ${h.min} a ${h.min + 5} min? Más minutos, más XP.`, act: { id: h.id, min: h.min + 5 }, w: 1 });
  }
  const pend = H.forDay().filter(h => !H.sess(h.id).claimed); const hr = new Date().getHours();
  if (pend.length && hr >= 19) out.push({ e: '🔥', t: 'Protege tu racha hoy', d: `Te quedan ${pend.length} hábito${pend.length > 1 ? 's' : ''}. Haz aunque sea el más corto: ${pend.sort((a, b) => a.min - b.min)[0].emoji} ${pend[0].nombre}.`, act: { start: pend[0].id }, w: 4 });
  const ms = H.moodStats(14);
  if (ms.byHabit.length >= 2) { const best = [...ms.byHabit].sort((a, b) => b.avg - a.avg)[0]; out.push({ e: '💜', t: `${best.h.emoji} ${best.h.nombre} te hace sentir mejor`, d: `Tu ánimo promedio después de hacerlo es ${H.MOODS[Math.round(best.avg) - 1]}. Úsalo cuando tengas un mal día.`, act: null, w: 0 }); }
  if (!out.length) out.push({ e: '🏆', t: 'Vas muy bien', d: 'No veo nada que ajustar. Sigue así y revisa aquí en una semana.', act: null, w: 0 });
  return out.sort((a, b) => (b.w || 0) - (a.w || 0)).slice(0, 3);
}
