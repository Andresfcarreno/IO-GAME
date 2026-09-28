/* IO — datos local-first. Todo vive en el dispositivo y, si conectas Supabase,
 * se sincroniza entre dispositivos (tabla io_items, un documento JSON por item). */

export const pad = n => String(n).padStart(2, '0');
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
export const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const K_CFG = 'io.v7.cfg', K_ITEMS = 'io.v7.items';
function readJSON(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* lleno o bloqueado */ } }

/* ---------- configuración ---------- */
const old = readJSON('io_cfg', {}); // nombre y personaje de la versión anterior
const DEFAULT_CFG = { name: old.name || '', avatar: old.avatar || null, sound: true, wake: true, supaUrl: old.supaUrl || '', supaKey: old.supaKey || '', onboarded: false, demo: false };
export const cfg = { ...DEFAULT_CFG, ...readJSON(K_CFG, {}) };
export function saveCfg(patch = {}) { Object.assign(cfg, patch); writeJSON(K_CFG, cfg); }
export const hasSupabase = () => !!(cfg.supaUrl && cfg.supaKey);

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

/* ---------- Supabase (opcional) ---------- */
async function sb(path, opts = {}) {
  const res = await fetch(`${cfg.supaUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    ...opts, headers: { apikey: cfg.supaKey, Authorization: 'Bearer ' + cfg.supaKey, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 140)}`);
  const t = await res.text(); return t ? JSON.parse(t) : null;
}
export async function testSupabase() { await sb('io_items?select=id&limit=1'); return true; }
let pushT;
function queuePush() { if (!hasSupabase()) return; clearTimeout(pushT); pushT = setTimeout(pushPending, 1200); }
async function pushPending() {
  const pending = Object.values(items).filter(i => !i.synced);
  if (!pending.length || !hasSupabase()) return;
  try {
    await sb('io_items', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(pending.map(({ synced, ...i }) => i)) });
    pending.forEach(i => { i.synced = true; }); persist(); status.supabase = 'ok';
  } catch (e) { status.supabase = 'error'; status.error = e.message; }
}
export async function sync() {
  if (!hasSupabase()) { status.supabase = 'off'; return; }
  try {
    const rows = await sb('io_items?select=*');
    for (const r of rows) {
      const mine = items[r.id];
      if (!mine || new Date(r.updated_at) > new Date(mine.updated_at)) items[r.id] = { ...r, synced: true };
    }
    persist(); await pushPending();
    status.supabase = 'ok'; status.lastSync = new Date();
  } catch (e) { status.supabase = 'error'; status.error = e.message; }
}

export function exportBackup() { return JSON.stringify({ app: 'IO', version: 7, exported: new Date().toISOString(), cfg: { ...cfg, supaKey: undefined }, items }, null, 2); }
export function importBackup(json) {
  const b = JSON.parse(json);
  if (b.items) { items = { ...items, ...b.items }; persist(); }
  if (b.cfg) saveCfg({ name: b.cfg.name, avatar: b.cfg.avatar, onboarded: true });
}
