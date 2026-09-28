/* IO — ranking. Cada jugador es una fila en io_ranking (Supabase), con login anónimo:
 * sin correo ni contraseña, solo tu nombre público. Unirse es opcional.
 * Sin backend configurado se juega la liga de práctica: bots 🤖 claramente marcados. */
import { cfg, saveCfg } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import { OPTIONS, LOOK_DEFAULT } from './avatar.js';
import { RANKING } from './config.js';

const K_AUTH = 'io.rank.auth';
const conn = () => ({ url: (RANKING.url || cfg.supaUrl || '').replace(/\/+$/, ''), key: RANKING.key || cfg.supaKey || '' });
export const online = () => { const c = conn(); return !!(c.url && c.key); };
export const joined = () => !!cfg.rankOn;
export const state = { rows: [], me: null, scope: 'global', error: '', loadedAt: 0, loading: false };

/* ---------- datos de otros jugadores: nunca se confía en ellos ---------- */
const pick = (list, v) => (list.some(o => (Array.isArray(o) ? o[0] : o) === v) ? v : undefined);
export function safeLook(l) {
  const out = { ...LOOK_DEFAULT };
  if (l && typeof l === 'object') for (const k of Object.keys(LOOK_DEFAULT)) { const v = pick(OPTIONS[k] || [], l[k]); if (v !== undefined) out[k] = v; }
  return out;
}
const safeWear = w => ({ head: W.WEAR.some(i => i.id === w?.head) ? w.head : null, face: W.WEAR.some(i => i.id === w?.face) ? w.face : null });
const num = v => Math.max(0, Math.min(1e9, Math.floor(+v || 0)));
const clean = r => ({ id: String(r.user_id || r.id || ''), name: String(r.name || 'Anónimo').slice(0, 20), level: Math.max(1, num(r.level)), xp: num(r.xp), week_xp: num(r.week_xp), streak: num(r.streak), look: safeLook(r.look?.a || r.look), wear: safeWear(r.look?.w), bot: !!r.bot, me: !!r.me });

/* ---------- auth anónima ---------- */
function readAuth() { try { return JSON.parse(localStorage.getItem(K_AUTH) || 'null'); } catch { return null; } }
function writeAuth(a) { try { a ? localStorage.setItem(K_AUTH, JSON.stringify(a)) : localStorage.removeItem(K_AUTH); } catch { /* */ } }
async function authCall(path, body) {
  const c = conn();
  const r = await fetch(`${c.url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.msg || j.error_description || j.message || `Auth ${r.status}`);
  const a = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, uid: j.user?.id };
  writeAuth(a); return a;
}
async function session() {
  let a = readAuth();
  if (a?.access && a.exp > Date.now()) return a;
  if (a?.refresh) { try { return await authCall('token?grant_type=refresh_token', { refresh_token: a.refresh }); } catch { /* sesión vencida: nueva cuenta anónima */ } }
  return authCall('signup', {});
}
async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const c = conn(); const a = await session();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { method, headers: { apikey: c.key, Authorization: `Bearer ${a.access}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text().catch(() => ''); throw new Error(t.slice(0, 140) || `HTTP ${r.status}`); }
  return r;
}

/* ---------- mi fila ---------- */
function mine() {
  const g = W.game();
  return { name: (cfg.rankName || cfg.name || 'Player').slice(0, 20), level: W.level(g), xp: g.xp, week_key: W.weekKey(), week_xp: H.weekXp(g), streak: H.dayStreak(), look: { a: cfg.avatar || LOOK_DEFAULT, w: { head: g.wear.head || null, face: g.wear.face || null } } };
}
let pushT;
/** Publica tu progreso (con calma: como mucho una vez cada 20 s). */
export function publish(now = false) {
  if (!joined() || !online()) return;
  clearTimeout(pushT);
  pushT = setTimeout(async () => {
    try { const a = await session(); await rest('io_ranking?on_conflict=user_id', { method: 'POST', body: { user_id: a.uid, ...mine(), updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } }); state.error = ''; }
    catch (e) { state.error = e.message; }
  }, now ? 0 : 20000);
}
export async function join(name) {
  saveCfg({ rankOn: true, rankName: (name || cfg.name || 'Player').trim().slice(0, 20) });
  if (!online()) return;
  const a = await session();
  await rest('io_ranking?on_conflict=user_id', { method: 'POST', body: { user_id: a.uid, ...mine(), updated_at: new Date().toISOString() }, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' } });
}
export async function leave() {
  saveCfg({ rankOn: false });
  if (!online() || !readAuth()) return;
  try { const a = await session(); await rest(`io_ranking?user_id=eq.${a.uid}`, { method: 'DELETE' }); } catch { /* */ }
}

/* ---------- tabla ---------- */
export async function load(scope = state.scope) {
  state.scope = scope;
  if (!online()) { practice(scope); return state; }
  state.loading = true;
  try {
    const wk = W.weekKey(); const sel = 'select=user_id,name,level,xp,week_xp,streak,look';
    const q = scope === 'semana' ? `io_ranking?${sel}&week_key=eq.${wk}&order=week_xp.desc&limit=100` : `io_ranking?${sel}&order=xp.desc&limit=100`;
    const rows = await (await rest(q)).json();
    const uid = readAuth()?.uid;
    state.rows = rows.map(r => ({ ...clean(r), me: r.user_id === uid }));
    state.me = null;
    if (joined() && uid && !state.rows.some(r => r.me)) {
      const m = mine(); const v = scope === 'semana' ? m.week_xp : m.xp;
      const f = scope === 'semana' ? `week_key=eq.${wk}&week_xp=gt.${v}` : `xp=gt.${v}`;
      const r = await rest(`io_ranking?select=user_id&${f}`, { method: 'HEAD', headers: { Prefer: 'count=exact' } });
      const total = +(r.headers.get('content-range') || '').split('/')[1] || 0;
      state.me = { ...clean({ ...m, user_id: uid, me: true }), pos: total + 1 };
    }
    state.error = ''; state.loadedAt = Date.now();
  } catch (e) { state.error = e.message; practice(scope); state.fallback = true; }
  state.loading = false;
  return state;
}

/* ---------- liga de práctica (sin backend): bots 🤖, nunca personas inventadas ---------- */
const BOT_NAMES = ['Byte', 'Nibble', 'Pixel', 'Bit', 'Chip', 'Kilo', 'Mega', 'Giga', 'Qubit', 'Bool', 'Loop', 'Array', 'Cache', 'Sprite', 'Glitch', 'Turbo', 'Ping', 'Nano', 'Tera', 'Hex'];
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function practice(scope) {
  const g = W.game(); const days = Math.floor(Date.now() / 864e5);
  const bots = BOT_NAMES.map((n, i) => {
    const r = rng(i * 977 + 13); const pace = 25 + r() * 70; // XP por día
    const age = 1 + Math.floor(r() ** 2.2 * 320); // muchos empiezan como tú, pocos van muy arriba
    const xp = Math.floor(pace * (age + Math.max(0, days - 20700) * .35));
    const look = {}; for (const k of Object.keys(OPTIONS)) { const o = OPTIONS[k]; const v = o[Math.floor(r() * o.length)]; look[k] = Array.isArray(v) ? v[0] : v; }
    const wr = rng(i * 31 + Math.floor((days + 3) / 7)); const now = new Date(); const into = (now.getDay() + 6) % 7 + (now.getHours() + 6) / 24; const week_xp = Math.floor(pace * 1.5 * into * (.5 + wr() * .9));
    return clean({ id: 'bot' + i, name: '🤖 ' + n, level: W.levelOf(xp), xp, week_xp, streak: Math.floor(r() * 40), look, bot: true });
  });
  const me = clean({ id: 'me', name: cfg.rankName || cfg.name || 'Tú', level: W.level(g), xp: g.xp, week_xp: H.weekXp(g), streak: H.dayStreak(), look: { a: cfg.avatar, w: g.wear }, me: true });
  const key = scope === 'semana' ? 'week_xp' : 'xp';
  state.rows = [...bots, me].sort((a, b) => b[key] - a[key]);
  state.me = null; state.loadedAt = Date.now();
}
