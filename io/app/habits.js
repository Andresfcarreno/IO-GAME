/* IO — hábitos. Cada hábito tiene horario, días y duración.
 * El temporizador es la única forma de cumplirlo: los puntos solo cuentan si el reloj llega al final.
 * El tiempo se calcula con marcas de tiempo, así sigue contando aunque bloquees el celular
 * (leer un libro de papel, ir al gym, una clase). Pausar guarda lo que llevas. */
import { isEn } from './i18n.js';
import * as S from './store.js';
import { todayIso, addDays, dateOf } from './store.js';
import * as W from './world.js';

/* Ejemplos por categoría: [emoji, nombre, min, hora, actividad del personaje] */
export const CATEGORIES = [
  ['🧠', 'Mente', [['📖', 'Leer', 20, '21:00', 'read'], ['🧘', 'Meditar', 10, '07:00', 'float'], ['🌬️', 'Respirar', 1, '12:00', 'breathe'], ['✍️', 'Escribir el diario', 10, '22:00', 'write'], ['📵', 'Desconexión digital', 60, '21:30', 'unplug']]],
  ['💪', 'Cuerpo', [['🏃', 'Hacer ejercicio', 30, '06:30', 'flex'], ['🚶', 'Caminar', 20, '17:30', 'walk'], ['🐕', 'Sacar al perro', 20, '07:30', 'dog'], ['🤸', 'Yoga', 15, '06:45', 'yoga'], ['🏊', 'Nadar', 40, '18:30', 'swim'], ['🥗', 'Comer saludable (sin pantalla)', 30, '13:00', 'eat'], ['🍎', 'Comer 3 frutas', 1, '09:00', 'eat', { tipo: 'conteo', meta: 3, unidad: 'frutas', pausa: 60 }]]],
  ['🚀', 'Crecer', [['🇬🇧', 'Practicar inglés', 20, '19:00', 'talk'], ['🎓', 'Ir a clase / estudiar', 60, '18:00', 'study'], ['💻', 'Trabajo profundo', 50, '09:00', 'type'], ['🎸', 'Practicar instrumento', 30, '20:00', 'music'], ['🎨', 'Dibujar', 20, '16:00', 'draw']]],
  ['🏠', 'Casa y calma', [['🧹', 'Ordenar la casa', 15, '10:00', 'clean'], ['🍳', 'Cocinar en casa', 30, '19:30', 'cook'], ['💧', 'Tomar 8 vasos de agua', 1, '08:00', 'water', { tipo: 'conteo', meta: 8, unidad: 'vasos', pausa: 30 }], ['🙏', 'Orar / agradecer', 5, '06:15', 'pray'], ['😴', 'Dormir a tiempo', 10, '22:30', 'sleep']]],
];
export const EXAMPLES = CATEGORIES.flatMap(c => c[2]);
/** Lo que hace el personaje durante el reloj. */
export const ACTS = {
  read: ['📖', 'Lee'], study: ['📘', 'Estudia'], write: ['✍️', 'Escribe'], type: ['💻', 'Trabaja'], talk: ['💬', 'Habla otro idioma'],
  float: ['🧘', 'Medita'], breathe: ['🌬️', 'Respira'], yoga: ['🤸', 'Hace yoga'], pray: ['🙏', 'Ora'], unplug: ['🍵', 'Se desconecta'], sleep: ['😴', 'Duerme'],
  flex: ['🏋️', 'Hace pesas'], run: ['🏃', 'Corre'], walk: ['🚶', 'Camina'], dog: ['🐕', 'Saca al perro'], swim: ['🏊', 'Nada'],
  eat: ['🥗', 'Come'], cook: ['🍳', 'Cocina'], water: ['💧', 'Toma agua'], clean: ['🧹', 'Limpia'],
  music: ['🎸', 'Toca música'], draw: ['🎨', 'Dibuja'], jump: ['⭐', 'Se anima'],
};
const ACT_BY_EMOJI = { '📖': 'read', '📚': 'read', '🎓': 'study', '📘': 'study', '🧘': 'float', '📵': 'unplug', '🌬️': 'breathe', '🏃': 'run', '🏋️': 'flex', '🚴': 'run', '🥗': 'eat', '🍎': 'eat', '🇬🇧': 'talk', '🗣️': 'talk', '💻': 'type', '🎸': 'music', '🎹': 'music', '🚶': 'walk', '✍️': 'write', '🧹': 'clean', '🐕': 'dog', '🐶': 'dog', '🤸': 'yoga', '🏊': 'swim', '🍳': 'cook', '💧': 'water', '🙏': 'pray', '😴': 'sleep', '💤': 'sleep', '🎨': 'draw', '🧠': 'study', '🍵': 'unplug' };
const ACT_BY_WORD = [
  [/perr|mascota|dog/i, 'dog'], [/respir/i, 'breathe'], [/medit|mindful/i, 'float'], [/yoga|estir/i, 'yoga'], [/or(ar|aci)|rez|agradec|gratitud/i, 'pray'],
  [/dorm|sueñ|siesta/i, 'sleep'], [/descon|pantalla|celular/i, 'unplug'], [/corr|trot|bici|ciclis|running/i, 'run'], [/nad|piscina/i, 'swim'],
  [/camin|pase/i, 'walk'], [/gym|gimnas|ejercic|pesas|entren|flexion|sentadill/i, 'flex'], [/cocin|receta/i, 'cook'], [/agua|hidrat/i, 'water'],
  [/com(er|ida)|almuerz|desayun|cena/i, 'eat'], [/ingl|idioma|franc|alem|portug|hablar/i, 'talk'], [/estudi|clase|curso|tarea/i, 'study'],
  [/le(er|ctura)|libro/i, 'read'], [/diario|escrib|journal/i, 'write'], [/trabaj|program|código|codigo|proyecto|oficina/i, 'type'],
  [/guitar|piano|instrument|música|musica|cantar|violin/i, 'music'], [/dibuj|pint|arte|diseñ/i, 'draw'], [/orden|limpi|casa|barr/i, 'clean'],
];
export const guessAct = (nombre = '', emoji = '') => ACT_BY_WORD.find(([re]) => re.test(nombre))?.[1] || ACT_BY_EMOJI[emoji] || 'jump';
export const guessEmoji = nombre => { const a = guessAct(nombre); return a === 'jump' ? '⭐' : ACTS[a][0]; };
export const actOf = h => (h.act && ACTS[h.act] ? h.act : guessAct(h.nombre, h.emoji));
export const PROP = Object.fromEntries(Object.entries(ACTS).map(([k, v]) => [k, v[0]]));
export const DAYS = isEn ? ['S', 'M', 'T', 'W', 'T', 'F', 'S'] : ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

/* ---------- hábitos ---------- */
export const isCount = h => h?.tipo === 'conteo';
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
/** Hábito de conteo: suma uno si ya pasó la pausa mínima. */
export function count(id) {
  const h = get(id); if (!isCount(h)) return { ok: false };
  const iso = todayIso(); const l = log(iso); const s = l.s[id] || { el: 0, done: false, claimed: false, n: 0 };
  if (s.done) return { ok: false, done: true };
  const gap = (h.pausa ?? 15) * 60000; const now = Date.now();
  if (s.last && now - s.last < gap) return { ok: false, wait: Math.ceil((gap - (now - s.last)) / 60000) };
  if (!s.n) { const d = new Date(); s.onTime = Math.abs(d.getHours() * 60 + d.getMinutes() - minutesOf(h.hora)) <= 30; s.startedAt = now; }
  s.n = (s.n || 0) + 1; s.last = now;
  if (s.n >= (h.meta || 1)) { s.done = true; s.doneAt = now; }
  l.s[id] = s; saveLog(iso, l);
  return { ok: true, n: s.n, meta: h.meta || 1, done: s.done };
}
/** Minutos para el próximo toque permitido (0 = ya). */
export function countWait(id) { const h = get(id); const s = sess(id); if (!isCount(h) || !s.last || s.done) return 0; return Math.max(0, Math.ceil(((h.pausa ?? 15) * 60000 - (Date.now() - s.last)) / 60000)); }
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
  const sh = W.game().shielded || {};
  for (let i = 0; i < 400; i++, iso = addDays(iso, -1)) {
    if (!scheduled(h, iso) || (sh[iso] && !sess(id, iso).claimed)) continue;
    if (sess(id, iso).claimed) n++; else break;
  }
  return n;
}
export function dayStreak() {
  let n = 0; let iso = todayIso();
  const sh = W.game().shielded || {};
  const any = d => sh[d] || Object.values(log(d).s).some(s => s.claimed);
  if (!any(iso)) iso = addDays(iso, -1);
  // los días de descanso (sin hábitos programados) no rompen la racha
  for (let i = 0; i < 1000; i++, iso = addDays(iso, -1)) { if (any(iso)) n++; else if (forDay(iso).length || i > 400) break; }
  return n;
}
export function rewardOf(h, s, streak) {
  let xp = isCount(h) ? Math.max(5, Math.min(40, 4 * (h.meta || 1))) : Math.max(5, Math.min(120, h.min)), bits = Math.max(3, Math.round(xp / 2));
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
  g.xp += r.xp; g.bits += r.bits; g.stats.minutes += isCount(h) ? 0 : h.min; g.stats.sessions += 1;
  addWeekXp(g, r.xp); g.stats.best = Math.max(g.stats.best || 0, r.streak);
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
  g.xp += r.xp; g.bits += r.bits; g.chest[todayIso()] = true; addWeekXp(g, r.xp); W.saveGame(g);
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


/* ---------- semana: XP semanal (ranking) y reto semanal ---------- */
function addWeekXp(g, xp) {
  const k = W.weekKey();
  if (g.wk?.k !== k) g.wk = { k, xp: 0, claimed: false };
  g.wk.xp += xp;
}
export const weekXp = (g = W.game()) => (g.wk?.k === W.weekKey() ? g.wk.xp : 0);
/** Reto semanal: cumple el 80% de lo programado esta semana (mínimo 3). */
export function weekChallenge() {
  const k = W.weekKey(); const days = [...Array(7)].map((_, i) => addDays(k, i)); const hs = list();
  let planned = 0, done = 0;
  const since = S.cfg.since || '0000'; // la primera semana solo cuenta desde que empezaste
  days.forEach(d => hs.forEach(h => { if (scheduled(h, d) && d >= since) { planned++; if (sess(h.id, d).claimed) done++; } }));
  const target = Math.max(3, Math.ceil(planned * .8));
  const g = W.game(); const claimed = g.wk?.k === k && !!g.wk.claimed;
  const left = Math.max(0, 7 - days.indexOf(todayIso()) - 1);
  return { k, done, target, planned, pct: Math.min(1, done / target), ready: done >= target && !claimed, claimed, daysLeft: left, reward: { xp: 50, bits: 100 } };
}
export function claimWeekly() {
  const c = weekChallenge(); if (!c.ready) return null;
  const g = W.game(); const before = W.levelOf(g.xp);
  if (g.wk?.k !== c.k) g.wk = { k: c.k, xp: 0, claimed: false };
  g.xp += c.reward.xp; g.bits += c.reward.bits; g.wk.xp += c.reward.xp; g.wk.claimed = true; W.saveGame(g);
  return { ...c.reward, before, after: W.levelOf(g.xp) };
}
/** Metas del mes por hábito: minutos hechos vs programados. */
export function monthGoals(iso = todayIso()) {
  const d0 = dateOf(iso); const first = `${iso.slice(0, 8)}01`;
  const dim = new Date(d0.getFullYear(), d0.getMonth() + 1, 0).getDate();
  const days = [...Array(dim)].map((_, i) => addDays(first, i));
  return list().map(h => {
    const plan = days.filter(d => scheduled(h, d)).length;
    const done = days.filter(d => sess(h.id, d).claimed).length;
    return { h, plan, done, minutes: done * h.min, goal: plan * h.min, pct: plan ? done / plan : 0 };
  });
}
/** Mapa de calor: últimas N semanas, 1 si ese día reclamaste algo. */
export function heatmap(weeks = 12) {
  const start = addDays(W.weekKey(), -7 * (weeks - 1));
  return [...Array(weeks)].map((_, w) => [...Array(7)].map((_, d) => {
    const iso = addDays(start, w * 7 + d);
    const n = Object.values(log(iso).s).filter(x => x.claimed).length;
    return { iso, n, future: iso > todayIso() };
  }));
}

/** Al abrir la app: si fallaste días recientes y tienes escudos, protegen la racha. Devuelve cuántos se usaron. */
export function applyShields() {
  const g = W.game(); if (!g.shields) return 0;
  const claimedOn = d => Object.values(log(d).s).some(s => s.claimed);
  const planned = d => forDay(d).length > 0;
  const missed = []; let d = addDays(todayIso(), -1);
  for (let i = 0; i < 7 && !claimedOn(d) && !g.shielded[d]; i++, d = addDays(d, -1)) if (planned(d)) missed.push(d);
  if (!missed.length || !claimedOn(d) || missed.length > g.shields) return 0; // solo si había racha que salvar
  missed.forEach(x => { g.shielded[x] = true; }); g.shields -= missed.length; W.saveGame(g);
  return missed.length;
}
/** Estado de las misiones de primeros pasos. */
export function quests() {
  const g = W.game(); const st = g.stats;
  const done = { q1: st.sessions >= 1, q2: (st.spent || 0) > 0, q3: (st.moved || 0) > 0, q4: !!st.sawRank, q5: dayStreak() >= 3 };
  return W.QUESTS.map(([id, e, n, bits]) => ({ id, e, n, bits, done: !!done[id], claimed: !!g.quests[id] }));
}
export function claimQuest(id) {
  const q = quests().find(x => x.id === id); if (!q || !q.done || q.claimed) return null;
  const g = W.game(); g.quests[id] = true; g.bits += q.bits; W.saveGame(g); return q;
}

/* ---------- diario de ánimo: una línea después de cada corona ---------- */
export const MOODS = ['😫', '😕', '😐', '🙂', '🤩'];
export function setMood(id, mood, note = '', iso = todayIso()) {
  const l = log(iso); const s = l.s[id]; if (!s) return;
  if (mood) s.mood = Math.max(1, Math.min(5, +mood)); else s.moodSkip = true;
  if (note) s.note = String(note).slice(0, 140);
  l.s[id] = s; saveLog(iso, l);
}
export const moodPending = () => forDay().filter(h => { const s = sess(h.id); return s.claimed && !s.mood && !s.moodSkip; });
export function moodStats(days = 30) {
  const hs = list(); const per = {}; const notes = []; let sum = 0, n = 0;
  for (let i = 0; i < days; i++) {
    const iso = addDays(todayIso(), -i); const l = log(iso);
    for (const [id, s] of Object.entries(l.s)) {
      if (!s.mood) continue; sum += s.mood; n++;
      (per[id] ||= []).push(s.mood);
      if (s.note && notes.length < 12) notes.push({ iso, id, mood: s.mood, note: s.note, h: hs.find(h => h.id === id) });
    }
  }
  const byHabit = hs.map(h => ({ h, n: per[h.id]?.length || 0, avg: per[h.id] ? per[h.id].reduce((a, b) => a + b, 0) / per[h.id].length : 0 })).filter(x => x.n);
  return { avg: n ? sum / n : 0, n, byHabit, notes };
}
