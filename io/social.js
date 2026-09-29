/* IO — lo social: visitar edificios, likes ❤️, ligas semanales y sesiones juntos.
 * Solo con personas reales que tienen cuenta. Nada de bots ni números inventados. */
import { cfg, saveCfg, uid } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import * as R from './ranking.js';
import * as Auth from './auth.js';

/* ---------- likes ---------- */
const K_LIKES = 'io.likes';
const localLikes = () => { try { const v = JSON.parse(localStorage.getItem(K_LIKES) || '{}'); return v.k === W.weekKey() ? v : { k: W.weekKey(), given: {}, got: 0 }; } catch { return { k: W.weekKey(), given: {}, got: 0 }; } };
const saveLocal = v => { try { localStorage.setItem(K_LIKES, JSON.stringify(v)); } catch { /* */ } };
export const liked = id => !!localLikes().given[id];
/** Da ❤️ a alguien (una vez por semana por persona). */
export async function like(row) {
  const v = localLikes(); if (v.given[row.id]) return { ok: false, msg: 'Ya le diste ❤️ esta semana' };
  if (row.me) return { ok: false, msg: '¡No se vale darte ❤️ a ti mismo! 😄' };
  if (!Auth.signedIn()) return { ok: false, msg: 'Inicia sesión para dar ❤️' };
  try { await R.rest('io_likes', { method: 'POST', body: { to_user: row.id, week_key: W.weekKey() }, headers: { Prefer: 'return=minimal' } }); } catch (e) { return { ok: false, msg: /duplicate|23505/.test(e.message) ? 'Ya le diste ❤️ esta semana' : '⚠️ No se pudo enviar' }; }
  v.given[row.id] = 1; saveLocal(v); return { ok: true };
}
/** ❤️ recibidos esta semana (reales). */
export async function likesOf(id) {
  if (!R.online() || !id || id === 'me') return 0;
  try { const r = await Auth.publicGet(`io_likes?select=to_user&to_user=eq.${encodeURIComponent(id)}&week_key=eq.${W.weekKey()}`, { Prefer: 'count=exact', Range: '0-0' }); return +(r.headers.get('content-range') || '').split('/')[1] || 0; } catch { return 0; }
}

/* ---------- ligas semanales ---------- */
export const DIVS = [['Bronce', '🥉', '#b45309'], ['Plata', '🥈', '#94a3b8'], ['Oro', '🥇', '#fbbf24'], ['Zafiro', '🔷', '#3b82f6'], ['Rubí', '🔴', '#ef4444'], ['Esmeralda', '💚', '#22c55e'], ['Amatista', '🔮', '#a855f7'], ['Diamante', '💎', '#22d3ee']];
export const ZONE = 5; // los 5 primeros suben, los 5 últimos bajan
export function league(g = W.game()) { g.league ||= { div: 0, wk: W.weekKey(), rank: 0, size: 0 }; return g.league; }
/** Mi puesto en la tabla semanal de mi liga. */
export function weekStanding() {
  const rows = R.state.scope === 'semana' ? R.state.rows : [];
  const i = rows.findIndex(r => r.me);
  return { rank: i >= 0 ? i + 1 : (R.state.me?.pos || 0), size: Math.max(rows.length, R.state.total || 0) };
}
/** Guarda el puesto (se llama al ver el ranking) y, si cambió la semana, sube o baja de liga. */
export function updateLeague() {
  const g = W.game(); const L = league(g); const wk = W.weekKey(); let moved = null;
  if (L.wk !== wk) {
    if (L.size >= 10) { // las ligas se mueven cuando hay al menos 10 jugadores
      if (L.rank && L.rank <= ZONE && L.div < DIVS.length - 1) { L.div++; moved = 'up'; }
      else if (L.rank && L.rank > L.size - ZONE && L.div > 0) { L.div--; moved = 'down'; }
      else moved = 'stay';
    }
    L.last = { rank: L.rank, size: L.size, moved }; L.wk = wk; L.rank = 0; L.size = 0;
  }
  if (R.state.scope === 'semana') { const st = weekStanding(); L.rank = st.rank; L.size = st.size; } g.league = L; W.saveGame(g);
  return moved;
}
export const endsIn = () => { const now = new Date(); const next = new Date(W.weekKey() + 'T00:00:00'); next.setDate(next.getDate() + 7); const ms = next - now; const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24; return d ? `${d}d ${h}h` : `${h}h ${Math.floor(ms / 6e4) % 60}m`; };

/* ---------- sesiones juntos ---------- */
const CODE = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
export const room = () => cfg.room || '';
export function createRoom() { const c = CODE(); saveCfg({ room: c }); return c; }
export function joinRoom(code) { const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (c.length < 4) return ''; saveCfg({ room: c }); return c; }
export function leaveRoom() { saveCfg({ room: '' }); }
export const roomLink = c => `${location.origin + location.pathname}?sala=${c}`;
/** Publica que estás enfocado (o pausado) en tu sala. */
export async function presence(h, act, remSec, paused = false) {
  if (!room() || !Auth.signedIn()) return;
  try {
    await R.rest('io_rooms?on_conflict=room,user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: { room: room(), user_id: Auth.user().id, name: (cfg.rankName || cfg.name || 'Player').slice(0, 20), look: { a: cfg.avatar }, act, habit: `${h.emoji} ${h.nombre}`.slice(0, 40), until: new Date(Date.now() + remSec * 1000).toISOString(), paused, updated_at: new Date().toISOString() } });
  } catch { /* sin conexión: se intenta en el siguiente ciclo */ }
}
/** Quién más está en la sala (activos en los últimos 2 min). */
export async function buddies() {
  if (!room() || !Auth.signedIn()) return [];
  try {
    const since = new Date(Date.now() - 120000).toISOString();
    const rows = await (await R.rest(`io_rooms?select=user_id,name,look,act,habit,until,paused,updated_at&room=eq.${room()}&updated_at=gte.${since}`)).json();
    const me = R.myId();
    return rows.filter(r => r.user_id !== me).slice(0, 6).map(r => ({ id: r.user_id, name: String(r.name || 'Anónimo').slice(0, 20), look: R.safeLook(r.look?.a), act: H.ACTS[r.act] ? r.act : 'jump', habit: String(r.habit || '').slice(0, 40), rem: Math.max(0, (new Date(r.until) - Date.now()) / 1000), paused: !!r.paused, bot: false }));
  } catch { return []; }
}
export const newId = uid;
