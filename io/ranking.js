/* IO — ranking. Solo personas reales: cada jugador con cuenta (Google o correo) es una fila en io_ranking.
 * Nada de bots ni datos inventados: si todavía no hay nadie más, ves solo tu fila. */
import { cfg, saveCfg } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import { OPTIONS, LOOK_DEFAULT } from './avatar.js';
import * as Auth from './auth.js';

export const online = () => Auth.configured();
export const joined = () => Auth.signedIn() && cfg.rankOn !== false;
export const myId = () => Auth.user()?.id || null;
export const state = { rows: [], me: null, scope: 'global', error: '', loadedAt: 0, loading: false, total: 0 };
export const rest = Auth.rest;

/* ---------- datos de otros jugadores: nunca se confía en ellos ---------- */
const pick = (list, v) => (list.some(o => (Array.isArray(o) ? o[0] : o) === v) ? v : undefined);
export function safeLook(l) {
  const out = { ...LOOK_DEFAULT };
  if (l && typeof l === 'object') for (const k of Object.keys(LOOK_DEFAULT)) { const v = pick(OPTIONS[k] || [], l[k]); if (v !== undefined) out[k] = v; }
  return out;
}
const safeWear = w => ({ head: W.WEAR.some(i => i.id === w?.head) ? w.head : null, face: W.WEAR.some(i => i.id === w?.face) ? w.face : null });
const num = v => Math.max(0, Math.min(1e9, Math.floor(+v || 0)));
const clean = r => ({ id: String(r.user_id || r.id || ''), name: String(r.name || 'Jugador').slice(0, 20), level: Math.max(1, num(r.level)), xp: num(r.xp), week_xp: num(r.week_xp), streak: num(r.streak), look: safeLook(r.look?.a || r.look), wear: safeWear(r.look?.w), room: safeRoom(r.look), bot: false, me: !!r.me });

/* ---------- mi fila ---------- */
/** Foto pequeña de tu piso para que otros lo visiten (máx. 9 objetos). */
export function roomSnap(g) {
  const f = g.floor || 1; const list = (g.placed?.[f] || []).slice(0, 9).map(p => [p.item, Math.round((p.x || .5) * 100), p.on || '', p.y == null ? -1 : Math.round(p.y * 100)]);
  const pet = g.pet?.sp && g.pet.stage ? [g.pet.sp, g.pet.stage] : null;
  return { f, r: list, p: pet };
}
const ON = new Set(['', 'table', 'shelf1', 'shelf2']);
export function safeRoom(look) {
  const f = Math.max(1, Math.min(100000, Math.floor(+look?.f || 1)));
  const r = (Array.isArray(look?.r) ? look.r : []).slice(0, 9).filter(x => Array.isArray(x) && W.itemById(x[0])).map(([id, x, on, y]) => [id, Math.max(0, Math.min(100, +x || 50)), ON.has(on) ? on : '', Math.max(-1, Math.min(100, Number.isFinite(+y) ? +y : -1))]);
  const p = Array.isArray(look?.p) && ['ave', 'dragon', 'felino', 'marino'].includes(look.p[0]) ? [look.p[0], Math.max(0, Math.min(4, +look.p[1] || 0))] : null;
  return { f, r, p };
}
function mine() {
  const g = W.game();
  return { name: (cfg.rankName || cfg.name || Auth.user()?.name || 'Jugador').slice(0, 20), level: W.level(g), xp: g.xp, week_key: W.weekKey(), week_xp: H.weekXp(g), streak: H.dayStreak(), look: { a: cfg.avatar || LOOK_DEFAULT, w: { head: g.wear.head || null, face: g.wear.face || null }, ...roomSnap(g) } };
}
let pushT;
const upsert = () => rest('io_ranking?on_conflict=user_id', { method: 'POST', body: { user_id: myId(), ...mine(), updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
/** Publica tu progreso (con calma: como mucho una vez cada 15 s). */
export function publish(now = false) {
  if (!joined() || cfg.demo) return;
  clearTimeout(pushT);
  pushT = setTimeout(async () => { try { await upsert(); state.error = ''; } catch (e) { state.error = e.message; } }, now ? 0 : 15000);
}
export async function join(name) {
  saveCfg({ rankOn: true, ...(name ? { rankName: name.trim().slice(0, 20) } : {}) });
  if (Auth.signedIn() && !cfg.demo) await upsert();
}
export async function leave() {
  saveCfg({ rankOn: false });
  if (!Auth.signedIn()) return;
  try { await rest(`io_ranking?user_id=eq.${myId()}`, { method: 'DELETE' }); } catch { /* */ }
}
const meRow = () => { const g = W.game(); return clean({ id: myId() || 'me', ...mine(), look: mine().look, me: true }); };

/* ---------- tabla ---------- */
export async function load(scope = state.scope) {
  state.scope = scope;
  if (!online()) { state.rows = [meRow()]; state.me = null; state.local = true; state.total = 1; state.loadedAt = Date.now(); return state; }
  state.loading = true; state.local = false;
  try {
    if (joined()) await upsert().catch(() => {});
    const wk = W.weekKey(); const sel = 'select=user_id,name,level,xp,week_xp,streak,look';
    const q = scope === 'semana' ? `io_ranking?${sel}&week_key=eq.${wk}&order=week_xp.desc&limit=100` : `io_ranking?${sel}&order=xp.desc&limit=100`;
    const r = await Auth.publicGet(q, { Prefer: 'count=exact' });
    const rows = await r.json(); state.total = +(r.headers.get('content-range') || '').split('/')[1] || rows.length;
    const uid = myId();
    state.rows = rows.map(x => ({ ...clean(x), me: x.user_id === uid }));
    state.me = null;
    if (joined() && uid && !state.rows.some(x => x.me)) {
      const m = mine(); const v = scope === 'semana' ? m.week_xp : m.xp;
      const f = scope === 'semana' ? `week_key=eq.${wk}&week_xp=gt.${v}` : `xp=gt.${v}`;
      const c = await Auth.publicGet(`io_ranking?select=user_id&${f}`, { Prefer: 'count=exact', Range: '0-0' });
      state.me = { ...meRow(), pos: (+(c.headers.get('content-range') || '').split('/')[1] || 0) + 1 };
    }
    state.error = ''; state.loadedAt = Date.now();
  } catch (e) { state.error = e.message; state.rows = [meRow()]; state.local = true; }
  state.loading = false;
  return state;
}
/** Jugadores registrados (para la página de inicio y el ranking). */
export async function count() { try { const r = await Auth.publicGet('io_ranking?select=user_id', { Prefer: 'count=exact', Range: '0-0' }); return +(r.headers.get('content-range') || '').split('/')[1] || 0; } catch { return 0; } }
