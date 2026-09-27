/* IO — capa de datos: local-first (localStorage) + Supabase + Google Sheet histórico.
 * Nada se pierde si no hay red: todo lo que registras queda en el dispositivo
 * y se sincroniza con Supabase cuando se puede. */

/* ---------- utilidades de fecha ---------- */
export const pad = n => String(n).padStart(2, '0');
export const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayIso = () => isoOf(new Date());
export const dateOf = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((dateOf(isoOf(b)) - dateOf(isoOf(a))) / 864e5);
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- configuración ---------- */
const CFG_KEY = 'io_cfg';
const DEFAULT_CFG = {
  name: 'Andrés',
  supaUrl: '',
  supaKey: '',
  sheetCsv: '',
  presupuesto: 501,          // presupuesto variable mensual
  model: 'claude-opus-5',
  demo: true,
  avatar: { skin: '#c4855a', hair: '#1a0f0a', hoodie: '#7c5cff', room: 'noche' },
  seededFijos: false,
  telegramBot: ''
};
function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* almacenamiento lleno o bloqueado */ }
}
export const cfg = { ...DEFAULT_CFG, ...readJSON(CFG_KEY, {}) };
cfg.avatar = { ...DEFAULT_CFG.avatar, ...(cfg.avatar || {}) };
export function saveCfg(patch = {}) { Object.assign(cfg, patch); writeJSON(CFG_KEY, cfg); }
export const hasSupabase = () => !!(cfg.supaUrl && cfg.supaKey);
export const isDemo = () => cfg.demo && !hasSupabase() && !cfg.sheetCsv;

/* La API key de Anthropic NUNCA va a localStorage ni al código: solo sessionStorage ('io_k'). */
export const getKey = () => { try { return sessionStorage.getItem('io_k') || ''; } catch { return ''; } };
export const setKey = k => { try { k ? sessionStorage.setItem('io_k', k) : sessionStorage.removeItem('io_k'); } catch { /* */ } };

/* ---------- Supabase REST ---------- */
function sbHeaders(extra = {}) {
  return { apikey: cfg.supaKey, Authorization: 'Bearer ' + cfg.supaKey, 'Content-Type': 'application/json', ...extra };
}
async function sb(path, opts = {}) {
  const res = await fetch(`${cfg.supaUrl.replace(/\/$/, '')}/rest/v1/${path}`, { ...opts, headers: sbHeaders(opts.headers) });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
export async function testSupabase() {
  await sb('transactions?select=id&limit=1');
  let items = true;
  try { await sb('io_items?select=id&limit=1'); } catch { items = false; }
  return { transactions: true, items };
}

/* ---------- transacciones ---------- */
export const txKey = t => `${t.fecha}|${t.hora || ''}|${(t.descripcion || '').trim().toLowerCase()}|${Number(t.monto).toFixed(2)}|${t.tipo}`;

function normTx(r, origen) {
  let fecha = r.fecha || '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) { const [d, m, y] = fecha.split('/'); fecha = `${y}-${pad(m)}-${pad(d)}`; }
  if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
  fecha = fecha.slice(0, 10);
  const monto = Math.abs(parseFloat(String(r.monto).replace(/[^0-9.-]/g, ''))) || 0;
  if (!monto) return null;
  const t = {
    id: r.id ?? null,
    fecha, d: dateOf(fecha), hora: (r.hora || '').slice(0, 5),
    descripcion: r.descripcion || 'Movimiento',
    monto, tipo: (r.tipo || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto',
    categoria: (r.categoria || 'otros').toLowerCase(),
    original: r.mensaje_original ?? r.original ?? '',
    origen: r.origen || origen,
  };
  t.fromApp = t.origen === 'app';
  t.key = txKey(t);
  return t;
}

export function parseCSV(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',' || ch === ';' && !text.includes(',')) { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur.trim()); cur = '';
      if (row.some(c => c)) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur.trim());
  if (row.some(c => c)) rows.push(row);
  return rows;
}

const state = {
  remoteTx: [],                       // Supabase + Sheet
  localTx: readJSON('io_tx_local', []), // registrados en este dispositivo (con flag synced)
  items: readJSON('io_items', {}),    // salud, diario, personas, interacciones, metas, fijos
  demoTx: [], demoItems: {},
  status: { supabase: 'off', sheet: 'off', items: 'off', lastSync: null, error: '' },
};
export const status = state.status;
const saveLocalTx = () => writeJSON('io_tx_local', state.localTx);
const saveItems = () => writeJSON('io_items', state.items);

export function allTx() {
  const seen = new Set(); const out = [];
  const locals = state.localTx
    .map(r => { const t = normTx(r, 'app'); return t && { ...t, local: true, lid: r.lid, synced: r.synced }; })
    .filter(Boolean);
  for (const t of [...state.remoteTx, ...locals, ...(isDemo() ? state.demoTx : [])]) {
    if (seen.has(t.key)) continue;
    seen.add(t.key); out.push(t);
  }
  return out.sort((a, b) => b.d - a.d || (b.hora || '').localeCompare(a.hora || ''));
}

async function fetchSheet() {
  if (!cfg.sheetCsv) { state.status.sheet = 'off'; return []; }
  try {
    const res = await fetch(cfg.sheetCsv + (cfg.sheetCsv.includes('?') ? '&' : '?') + 't=' + Date.now());
    const rows = parseCSV(await res.text());
    state.status.sheet = 'ok';
    return rows.slice(1).map(r => normTx({ fecha: r[0], hora: r[1], descripcion: r[2], monto: r[3], tipo: r[4], categoria: r[5], mensaje_original: r[6] }, 'sheet')).filter(Boolean);
  } catch (e) { state.status.sheet = 'error'; state.status.error = 'Sheet: ' + e.message; return []; }
}

async function fetchSupabaseTx() {
  if (!hasSupabase()) { state.status.supabase = 'off'; return []; }
  try {
    const rows = await sb('transactions?select=*&order=fecha.desc&limit=5000');
    state.status.supabase = 'ok';
    return rows.map(r => normTx(r, 'telegram')).filter(Boolean);
  } catch (e) { state.status.supabase = 'error'; state.status.error = e.message; return []; }
}

function txRow(t) {
  return {
    fecha: t.fecha, hora: t.hora || null, descripcion: t.descripcion, monto: t.monto, tipo: t.tipo,
    categoria: t.categoria, mensaje_original: t.original || null, origen: t.origen || 'app',
  };
}

async function syncLocalTx() {
  if (!hasSupabase()) return;
  let changed = false;
  for (const r of state.localTx.filter(r => !r.synced)) {
    try {
      const out = await sb('transactions', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(txRow(r)) });
      r.synced = true; r.id = out?.[0]?.id ?? null; changed = true;
    } catch (e) { state.status.error = 'No se pudo sincronizar: ' + e.message; break; }
  }
  if (changed) saveLocalTx();
}

export async function addTx(entry) {
  const r = { ...entry, lid: uid(), synced: false, origen: entry.origen || 'app' };
  state.localTx.unshift(r); saveLocalTx();
  syncLocalTx().then(() => { /* el render siguiente lo reflejará */ });
  return r;
}

export async function deleteTx(t) {
  if (t.local && t.lid) {
    const r = state.localTx.find(x => x.lid === t.lid);
    state.localTx = state.localTx.filter(x => x.lid !== t.lid); saveLocalTx();
    if (r?.id && hasSupabase()) await sb(`transactions?id=eq.${r.id}`, { method: 'DELETE' }).catch(() => {});
    return true;
  }
  if (t.id != null && hasSupabase()) {
    await sb(`transactions?id=eq.${t.id}`, { method: 'DELETE' });
    state.remoteTx = state.remoteTx.filter(x => x.id !== t.id);
    return true;
  }
  return false; // filas del Sheet histórico o demo: solo lectura
}

/* ---------- items de vida (salud, diario, personas, metas, fijos) ---------- */
export function itemsOf(kind) {
  const src = { ...(isDemo() ? state.demoItems : {}), ...state.items };
  return Object.values(src).filter(i => i.kind === kind && !i.deleted).map(i => ({ id: i.id, ...i.data }));
}
export function getItem(id) {
  const i = state.items[id] || (isDemo() ? state.demoItems[id] : null);
  return i && !i.deleted ? { id: i.id, ...i.data } : null;
}
export function putItem(kind, data, id = null) {
  id = id || `${kind}:${uid()}`;
  const { id: _drop, ...clean } = data;
  const it = { id, kind, data: clean, updated_at: new Date().toISOString(), deleted: false };
  state.items[id] = it; saveItems();
  pushItem(it);
  return { id, ...clean };
}
export function delItem(id) {
  const it = state.items[id] || (state.demoItems[id] && { ...state.demoItems[id] });
  if (!it) return;
  it.deleted = true; it.updated_at = new Date().toISOString();
  state.items[id] = it; saveItems();
  pushItem(it);
}
async function pushItem(it) {
  if (!hasSupabase() || state.status.items === 'missing') return;
  try {
    await sb('io_items', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([it]) });
    it.synced = true; saveItems();
  } catch { it.synced = false; saveItems(); }
}
async function syncItems() {
  if (!hasSupabase()) { state.status.items = 'off'; return; }
  try {
    const rows = await sb('io_items?select=*');
    state.status.items = 'ok';
    for (const r of rows) {
      const mine = state.items[r.id];
      if (!mine || new Date(r.updated_at) > new Date(mine.updated_at)) state.items[r.id] = { ...r, synced: true };
    }
    const pending = Object.values(state.items).filter(i => !i.synced);
    if (pending.length) {
      await sb('io_items', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(pending.map(({ synced, ...i }) => i)) });
      pending.forEach(i => { i.synced = true; });
    }
    saveItems();
  } catch (e) {
    state.status.items = /404|does not exist|relation/i.test(e.message) ? 'missing' : 'error';
  }
}

/* ---------- fijos por defecto (del contexto real de Andrés; editables) ---------- */
export function seedFijos() {
  if (cfg.seededFijos) return;
  [
    { descripcion: 'Renta', monto: 825, dia: 1, categoria: 'vivienda', match: 'renta' },
    { descripcion: 'YMCA', monto: 67, dia: 1, categoria: 'salud', match: 'ymca' },
    { descripcion: 'Jeep', monto: 35, dia: 1, categoria: 'transporte', match: 'jeep' },
    { descripcion: 'Amazon Prime', monto: 11.49, dia: 5, categoria: 'suscripcion', match: 'amazon' },
    { descripcion: 'Fizz', monto: 50, dia: 15, categoria: 'suscripcion', match: 'fizz' },
    { descripcion: 'Seguro L\'Unique', monto: 33.07, dia: 29, categoria: 'suscripcion', match: 'unique' },
  ].forEach(f => putItem('fijo', f));
  saveCfg({ seededFijos: true });
}

/* ---------- datos demo (basados en el export real del banco, desplazados a hoy) ---------- */
const DEMO_CSV = `15/06/2026,Fizz,50.23,gasto,suscripcion
12/06/2026,Couche-Tard,11.9,gasto,comida
12/06/2026,Dollarama,21.09,gasto,otros
11/06/2026,McDonald's,21.97,gasto,comida
11/06/2026,Esso,40,gasto,gasolina
11/06/2026,CNESST,1138.13,ingreso,ingreso
10/06/2026,Best Buy,40.87,gasto,otros
09/06/2026,Walmart,26.22,gasto,supermercado
09/06/2026,Marché Andes,13.64,gasto,supermercado
08/06/2026,Coq Lala,16.99,gasto,comida
08/06/2026,Maxi,12.87,gasto,supermercado
08/06/2026,Shell,25,gasto,gasolina
08/06/2026,Cine Starz,15,gasto,entretenimiento
05/06/2026,Tim Hortons,6.4,gasto,comida
05/06/2026,Mobile deposit,70.49,ingreso,ingreso
05/06/2026,Gouv. du Canada,266.5,ingreso,ingreso
04/06/2026,Maxi,16.72,gasto,supermercado
03/06/2026,Shell,20,gasto,gasolina
02/06/2026,Walmart,71.65,gasto,supermercado
29/05/2026,Seguro L'Unique,33.07,gasto,suscripcion
28/05/2026,CNESST,1138.13,ingreso,ingreso
19/05/2026,Poulet Rouge,16.43,gasto,comida
14/05/2026,CNESST,1138.13,ingreso,ingreso`;

function buildDemo() {
  const lines = DEMO_CSV.split('\n').map(l => l.split(','));
  const last = dateOf('2026-06-15');
  const shift = daysBetween(last, new Date()) - 1;
  const hours = ['08:12', '09:40', '12:25', '13:05', '17:48', '19:30', '21:10'];
  state.demoTx = lines.map(([f, desc, monto, tipo, cat], i) => {
    const [dd, mm, yy] = f.split('/').map(Number);
    const d = new Date(yy, mm - 1, dd); d.setDate(d.getDate() + shift);
    return normTx({ fecha: isoOf(d), hora: hours[i % hours.length], descripcion: desc, monto, tipo, categoria: cat, mensaje_original: '[Demo]', origen: 'demo' }, 'demo');
  }).filter(Boolean);

  const di = {}; const now = new Date();
  const put = (kind, data, id) => { id = id || `${kind}:demo${Object.keys(di).length}`; di[id] = { id, kind, data, updated_at: '2000-01-01T00:00:00Z', demo: true }; };
  for (let k = 6; k >= 1; k--) {
    const d = new Date(now); d.setDate(d.getDate() - k);
    put('health', { fecha: isoOf(d), sueno: [6.5, 7, 5.5, 8, 7.5, 6][k - 1], agua: [5, 7, 4, 8, 6, 6][k - 1], ejercicio: [0, 45, 30, 0, 60, 20][k - 1], animo: [3, 4, 3, 5, 4, 4][k - 1], pasos: [4200, 8100, 6500, 3000, 11200, 7000][k - 1] }, `health:${isoOf(d)}`);
  }
  const ago = n => { const d = new Date(now); d.setDate(d.getDate() - n); return isoOf(d); };
  put('person', { nombre: 'Mamá', emoji: '👩‍👦', cada: 3, relacion: 'familia' }, 'person:demo-mama');
  put('person', { nombre: 'Diana', emoji: '💜', cada: 2, relacion: 'pareja' }, 'person:demo-diana');
  put('person', { nombre: 'Juan', emoji: '🤝', cada: 7, relacion: 'amigo' }, 'person:demo-juan');
  put('interaction', { personaId: 'person:demo-mama', fecha: ago(5), tipo: 'llamada', nota: 'Videollamada del domingo' });
  put('interaction', { personaId: 'person:demo-diana', fecha: ago(1), tipo: 'plan', nota: 'Cine' });
  put('interaction', { personaId: 'person:demo-juan', fecha: ago(3), tipo: 'mensaje', nota: 'Hablamos de AI Staff' });
  put('goal', { nombre: 'Fondo de emergencia', emoji: '🛟', pilar: 'finanzas', objetivo: 1500, actual: 420, unidad: '$', limite: ago(-120) });
  put('goal', { nombre: 'Lanzar AI Staff', emoji: '🚀', pilar: 'mente', objetivo: 10, actual: 6, unidad: 'hitos', limite: ago(-45) });
  put('goal', { nombre: 'Gym 3× por semana', emoji: '🏋️', pilar: 'salud', objetivo: 12, actual: 5, unidad: 'sesiones', limite: ago(-24) });
  put('journal', { fecha: ago(1), hora: '22:14', texto: 'Buen día. Avancé con la landing de AI Staff y fui al cine con Diana. Me siento enfocado.', animo: 4 });
  put('journal', { fecha: ago(3), hora: '21:02', texto: 'Día pesado, dormí mal. Mañana gym temprano sí o sí.', animo: 2 });
  state.demoItems = di;
}

/* ---------- carga completa ---------- */
export async function loadAll() {
  buildDemo();
  const [supa, sheet] = await Promise.all([fetchSupabaseTx(), fetchSheet()]);
  // Supabase es la fuente de verdad hacia adelante; el Sheet cubre el histórico.
  const seen = new Set();
  state.remoteTx = [...supa, ...sheet].filter(t => (seen.has(t.key) ? false : (seen.add(t.key), true)));
  // Lo que ya llegó a Supabase se limpia de la cola local
  const remoteKeys = new Set(supa.map(t => t.key));
  const before = state.localTx.length;
  state.localTx = state.localTx.filter(r => { const t = normTx(r, 'app'); return !(r.synced && t && remoteKeys.has(t.key)); });
  if (state.localTx.length !== before) saveLocalTx();
  await Promise.all([syncLocalTx(), syncItems()]);
  state.status.lastSync = new Date();
}

export function exportBackup() {
  return JSON.stringify({ version: 5, exported: new Date().toISOString(), cfg: { ...cfg, supaKey: undefined }, localTx: state.localTx, items: state.items }, null, 2);
}
export function importBackup(json) {
  const b = JSON.parse(json);
  if (b.items) { state.items = { ...state.items, ...b.items }; saveItems(); }
  if (b.localTx) { state.localTx = [...b.localTx, ...state.localTx]; saveLocalTx(); }
}
export function pendingSyncCount() {
  if (!hasSupabase()) return 0;
  return state.localTx.filter(r => !r.synced).length + Object.values(state.items).filter(i => !i.synced).length;
}
