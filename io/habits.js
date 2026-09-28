/* IO — hábitos. Cada hábito tiene horario, días y duración.
 * El temporizador es la única forma de cumplirlo: los puntos solo cuentan si el reloj llega al final.
 * El tiempo se calcula con marcas de tiempo, así sigue contando aunque bloquees el celular
 * (leer un libro de papel, ir al gym, una clase). Pausar guarda lo que llevas. */
import * as S from './store.js';
import { todayIso, addDays, dateOf } from './store.js';
import * as W from './world.js';

export const EXAMPLES = [
  ['📖', 'Leer', 20, '21:00', 'read'], ['🧘', 'Meditar', 10, '07:00', 'float'], ['🏃', 'Hacer ejercicio', 30, '06:30', 'flex'],
  ['🥗', 'Comer saludable (sin pantalla)', 30, '13:00', 'eat'], ['🇬🇧', 'Practicar inglés', 20, '19:00', 'talk'], ['💻', 'Trabajo profundo', 50, '09:00', 'type'],
  ['🎓', 'Ir a clase / estudiar', 60, '18:00', 'read'], ['🎸', 'Practicar instrumento', 30, '20:00', 'music'], ['🚶', 'Caminar', 20, '17:30', 'walk'],
  ['✍️', 'Escribir el diario', 10, '22:00', 'write'], ['🧹', 'Ordenar la casa', 15, '10:00', 'clean'], ['📵', 'Desconexión digital', 60, '21:30', 'float'],
  ['🌬️', 'Respirar', 1, '12:00', 'float'],
];
const ACT_BY_EMOJI = { '📖': 'read', '📚': 'read', '🎓': 'read', '🧘': 'float', '📵': 'float', '🌬️': 'float', '🏃': 'flex', '🏋️': 'flex', '🚴': 'flex', '🥗': 'eat', '🍎': 'eat', '🇬🇧': 'talk', '🗣️': 'talk', '💻': 'type', '🎸': 'music', '🎹': 'music', '🚶': 'walk', '✍️': 'write', '🧹': 'clean' };
export const actOf = h => h.act || ACT_BY_EMOJI[h.emoji] || 'jump';
export const PROP = { read: '📖', float: '✨', flex: '💪', eat: '🥗', talk: '💬', type: '💻', music: '🎵', walk: '👟', write: '✍️', clean: '🧽', jump: '⭐' };
export const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/* ---------- hábitos ---------- */
export const list = () => S.itemsOf('habit').sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99'));
export const get = id => S.getItem(id);
export const save = (h, id = null) => S.putItem('habit', { dias: [0, 1, 2, 3, 4, 5, 6], ...h, min: Math.max(1, Math.min(240, +h.min || 10)) }, id);
export const remove = id => S.delItem(id);
export const scheduled = (h, iso) => (h.dias || [0, 1, 2, 3, 4, 5, 6]).includes(dateOf(iso).getDay());
export const forDay = (iso = todayIso()) => list().filter(h => scheduled(h, iso));
export const minutesOf = hora => { const [a, b] = (hora || '00:00').split(':').map(Number); return a * 60 + b; };

/* ---------- registro diario ---------- */
const logId = iso => `log:${iso}`;
export const log = iso => S.getItem(logId(iso)) || { s: {} };
function saveLog(iso, l) { const { id, ...d } = l; S.putItem('log', d, logId(iso)); }
export const sess = (id, iso = todayIso()) => log(iso).s[id] || { el: 0, done: false, claimed: false };

/* ---------- temporizador ---------- */
const RUN = 'io:run';
export const running = () => { const r = S.getItem(RUN); return r && r.hid ? r : null; };
export function elapsed(id, iso = todayIso()) {
  const h = get(id); const s = sess(id, iso); const r = running();
  let el = s.el + (r && r.hid === id && r.date === iso ? (Date.now() - r.since) / 1000 : 0);
  return Math.min(el, (h?.min || 1) * 60);
}
export function start(id) {
  const iso = todayIso(); const r = running();
  if (r && r.hid !== id) pause();
  if (r && r.hid === id) return;
  const l = log(iso); const s = l.s[id] || { el: 0, done: false, claimed: false };
  if (s.done) return;
  if (!s.el) {
    const h = get(id); const now = new Date(); const diff = Math.abs(now.getHours() * 60 + now.getMinutes() - minutesOf(h.hora));
    s.onTime = diff <= 30; s.startedAt = Date.now();
  }
  l.s[id] = s; saveLog(iso, l);
  S.putItem('run', { hid: id, date: iso, since: Date.now() }, RUN);
}
export function pause() {
  const r = running(); if (!r) return;
  const l = log(r.date); const s = l.s[r.hid] || { el: 0 };
  const h = get(r.hid);
  s.el = Math.min((s.el || 0) + (Date.now() - r.since) / 1000, (h?.min || 1) * 60);
  l.s[r.hid] = s; saveLog(r.date, l);
  S.putItem('run', {}, RUN);
}
/** Si el reloj llegó al final, marca el hábito como completo (aparece la corona). */
export function checkDone(id) {
  const h = get(id); if (!h) return false;
  const r = running(); const iso = r && r.hid === id ? r.date : todayIso();
  if (elapsed(id, iso) < h.min * 60) return false;
  const l = log(iso); const s = l.s[id] || {};
  if (!s.done) { s.el = h.min * 60; s.done = true; s.doneAt = Date.now(); l.s[id] = s; saveLog(iso, l); }
  if (r && r.hid === id) S.putItem('run', {}, RUN);
  return true;
}
/** Si el reloj quedó corriendo de ayer, se cierra ahí (no se regalan minutos). */
export function closeStale() {
  const r = running(); if (!r || r.date === todayIso()) return;
  pause();
}

/* ---------- recompensas ---------- */
export function streakOf(id) {
  const h = get(id); if (!h) return 0;
  let n = 0; let iso = todayIso();
  if (!sess(id, iso).claimed) iso = addDays(iso, -1);
  for (let i = 0; i < 400; i++, iso = addDays(iso, -1)) {
    if (!scheduled(h, iso)) continue;
    if (sess(id, iso).claimed) n++; else break;
  }
  return n;
}
export function dayStreak() {
  let n = 0; let iso = todayIso();
  const any = d => Object.values(log(d).s).some(s => s.claimed);
  if (!any(iso)) iso = addDays(iso, -1);
  for (let i = 0; i < 1000 && any(iso); i++, iso = addDays(iso, -1)) n++;
  return n;
}
export function rewardOf(h, s, streak) {
  let xp = Math.max(5, Math.min(120, h.min)), bits = Math.max(3, Math.round(h.min / 2));
  if (s.onTime) { xp = Math.round(xp * 1.25); bits = Math.round(bits * 1.25); }
  const st = Math.min(streak, 10);
  return { xp: xp + st * 2, bits: bits + st, onTime: !!s.onTime, streak };
}
export function preview(id) { const h = get(id); return h ? rewardOf(h, sess(id), streakOf(id) + 1) : null; }
/** Activar la corona: suma XP y bits. */
export function claim(id) {
  const iso = todayIso(); const h = get(id); const l = log(iso); const s = l.s[id];
  if (!h || !s?.done || s.claimed) return null;
  const r = rewardOf(h, s, streakOf(id) + 1);
  const g = W.game(); const before = W.levelOf(g.xp);
  g.xp += r.xp; g.bits += r.bits; g.stats.minutes += h.min; g.stats.sessions += 1;
  W.saveGame(g);
  s.claimed = true; s.reward = r; l.s[id] = s; saveLog(iso, l);
  return { ...r, habit: h, before, after: W.levelOf(g.xp) };
}
export function today() {
  const iso = todayIso(); const hs = forDay(iso); const l = log(iso);
  const st = hs.map(h => ({ h, s: l.s[h.id] || { el: 0 } }));
  return { hs, total: hs.length, claimed: st.filter(x => x.s.claimed).length, done: st.filter(x => x.s.done).length, minutes: st.reduce((a, x) => a + (x.s.claimed ? x.h.min : 0), 0) };
}
export function chestReady() { const t = today(); const g = W.game(); return t.total >= 2 && t.claimed === t.total && !g.chest[todayIso()]; }
export function openChest() {
  const t = today(); const g = W.game(); if (!chestReady()) return null;
  const before = W.levelOf(g.xp);
  const r = { xp: 25 + 5 * t.total, bits: 15 + 5 * t.total };
  g.xp += r.xp; g.bits += r.bits; g.chest[todayIso()] = true; W.saveGame(g);
  return { ...r, before, after: W.levelOf(g.xp) };
}
/** Últimos 7 días por hábito: ok | miss | off | hoy */
export function week() {
  const days = [...Array(7)].map((_, i) => addDays(todayIso(), i - 6));
  return { days, rows: list().map(h => ({ h, cells: days.map(d => !scheduled(h, d) ? 'off' : sess(h.id, d).claimed || sess(h.id, d).done ? 'ok' : d === todayIso() ? 'hoy' : 'miss') })) };
}
export function nextUp() {
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
  const pend = forDay().filter(h => !sess(h.id).done);
  return pend.find(h => minutesOf(h.hora) >= m - 30) || pend[0] || null;
}
