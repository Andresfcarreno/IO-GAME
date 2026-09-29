/* IO — datos local-first. Todo vive en el dispositivo y, si conectas Supabase,
 * se sincroniza entre dispositivos (tabla io_items, un documento JSON por item). */

export const pad = n => String(n).padStart(2, '0');
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
export const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Modo demo (?demo): datos de ejemplo guardados aparte, nunca se mezclan con tu partida ni se publican. */
export const isDemo = (() => { try { return new URLSearchParams(location.search).has('demo'); } catch { return false; } })();
const K_CFG = isDemo ? 'io.demo.cfg' : 'io.v7.cfg', K_ITEMS = isDemo ? 'io.demo.items' : 'io.v7.items';
function readJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* lleno o bloqueado */ } }

/* ---------- configuración ---------- */
const old = readJSON('io_cfg', {}); // nombre y personaje de la versión anterior
const DEFAULT_CFG = { name: old.name || '', avatar: old.avatar || null, sound: true, wake: true, supaUrl: old.supaUrl || '', supaKey: old.supaKey || '', onboarded: false, demo: false };
export const cfg = { ...DEFAULT_CFG, ...readJSON(K_CFG, {}) };
export function saveCfg(patch = {}) { Object.assign(cfg, patch); writeJSON(K_CFG, cfg); }

/* ---------- items (hábitos, registro diario, estado del juego) ---------- */
let items = readJSON(K_ITEMS, {});
const persist = () => writeJSON(K_ITEMS, items);
export const status = { supabase: 'off', lastSync: null, error: '' };

export function itemsOf(kind) {
  return Object.values(items).filter(i => i.kind === kind && !i.deleted).map(i => ({ id: i.id, ...i.data }));
}
export function getItem(id) { const i = items[id]; return i && !i.deleted ? { id: i.id, ...i.data } : null; }
export function putItem(kind, data, id = null) {
  id = id || `${kind}:${uid()}`;
  const { id: _drop, ...clean } = data;
  const it = { id, kind, data: clean, updated_at: new Date().toISOString(), deleted: false, synced: false };
  items[id] = it; persist(); queuePush();
  return { id, ...clean };
}
export function delItem(id) {
  if (!items[id]) return;
  items[id] = { ...items[id], deleted: true, updated_at: new Date().toISOString(), synced: false };
  persist(); queuePush();
}
export function resetAll() { items = {}; persist(); saveCfg({ ...DEFAULT_CFG, name: '', avatar: null, onboarded: false }); }

/* ---------- nube: la conecta auth.js cuando inicias sesión (tu partida viaja contigo) ---------- */
let cloud = null;
export function setCloud(c) { cloud = c; if (c) return sync(); status.supabase = 'off'; }
export const hasSupabase = () => !!cloud;
let pushT;
function queuePush() { if (!cloud) return; clearTimeout(pushT); pushT = setTimeout(pushPending, 1500); }
async function pushPending() {
  const pending = Object.values(items).filter(i => !i.synced);
  if (!pending.length || !cloud) return;
  try { await cloud.push(pending.map(({ synced, ...i }) => i)); pending.forEach(i => { i.synced = true; }); persist(); status.supabase = 'ok'; }
  catch (e) { status.supabase = 'error'; status.error = e.message; }
}
/** Trae lo de la nube (gana lo más reciente) y sube lo pendiente. */
export async function sync() {
  if (!cloud) { status.supabase = 'off'; return; }
  try {
    const rows = await cloud.pull();
    for (const r of rows) { const mine = items[r.id]; if (!mine || new Date(r.updated_at) > new Date(mine.updated_at)) items[r.id] = { id: r.id, kind: r.kind, data: r.data, updated_at: r.updated_at, deleted: r.deleted, synced: true }; }
    Object.values(items).forEach(i => { if (!rows.some(r => r.id === i.id)) i.synced = false; });
    persist(); await pushPending();
    status.supabase = 'ok'; status.lastSync = new Date(); return rows.length;
  } catch (e) { status.supabase = 'error'; status.error = e.message; }
}
export const itemCount = () => Object.values(items).filter(i => !i.deleted).length;

export function exportBackup() { return JSON.stringify({ app: 'IO', version: 7, exported: new Date().toISOString(), cfg: { name: cfg.name, avatar: cfg.avatar, since: cfg.since, gb: cfg.gb }, items }, null, 2); }
export function importBackup(json) {
  const b = JSON.parse(json);
  if (b.items) { for (const [k, v] of Object.entries(b.items)) items[k] = { ...v, synced: false, updated_at: new Date().toISOString() }; persist(); queuePush(); }
  if (b.cfg) saveCfg({ name: b.cfg.name, avatar: b.cfg.avatar, since: b.cfg.since, gb: b.cfg.gb, onboarded: true });
}
/** Código de tu partida para pasarla a otro dispositivo o navegador (copiar y pegar). */
export function exportCode() { return 'IO1:' + btoa(unescape(encodeURIComponent(exportBackup()))); }
export function importCode(code) {
  const t = String(code || '').trim(); const json = t.startsWith('IO1:') ? decodeURIComponent(escape(atob(t.slice(4)))) : t;
  importBackup(json);
}
