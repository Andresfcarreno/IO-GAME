/* IO — tu cuenta. Entras con Google o con tu correo (te llega un código de 6 dígitos).
 * Con cuenta, tu partida se guarda en la nube y apareces en el ranking con tu nombre.
 * Usa Supabase Auth por REST (sin librerías). El proyecto se configura en config.js. */
import { cfg, saveCfg, setCloud, isDemo } from './store.js';
import { RANKING } from './config.js';

const K = 'io.auth';
export const conn = () => ({ url: (RANKING.url || '').replace(/\/+$/, ''), key: RANKING.key || '' });
export const configured = () => { const c = conn(); return !!(c.url && c.key) && !isDemo; };
const appUrl = () => location.origin + location.pathname;
function read() { try { return JSON.parse(localStorage.getItem(K) || 'null'); } catch { return null; } }
function write(a) { try { a ? localStorage.setItem(K, JSON.stringify(a)) : localStorage.removeItem(K); } catch { /* */ } }
export const user = () => { const a = read(); return a?.uid ? { id: a.uid, email: a.email, name: a.name, pic: a.pic, provider: a.provider } : null; };
export const signedIn = () => !!user();
let listeners = [];
export const onChange = fn => { listeners.push(fn); };
const emit = () => listeners.forEach(fn => { try { fn(user()); } catch { /* */ } });

async function call(path, body, token) {
  const c = conn();
  const r = await fetch(`${c.url}/auth/v1/${path}`, { method: body ? 'POST' : 'GET', headers: { apikey: c.key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(friendly(j.msg || j.error_description || j.message || j.error || `Error ${r.status}`));
  return j;
}
const friendly = m => /expired|invalid.*otp|token has expired/i.test(m) ? 'El código no es válido o ya venció. Pide uno nuevo.'
  : /rate limit|too many/i.test(m) ? 'Espera un minuto antes de pedir otro código.'
  : /provider is not enabled/i.test(m) ? 'Ese método de inicio de sesión aún no está activado.' : m;
async function save(j, provider) {
  const u = j.user || await call('user', null, j.access_token);
  const md = u.user_metadata || {};
  const a = { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, uid: u.id, email: u.email, name: md.full_name || md.name || '', pic: md.avatar_url || md.picture || '', provider: provider || u.app_metadata?.provider || 'email' };
  write(a);
  if (!cfg.name && a.name) saveCfg({ name: a.name.split(' ')[0].slice(0, 20) });
  connectCloud(); emit(); return user();
}

/* ---------- Google ---------- */
export function google() {
  const c = conn(); if (!configured()) throw new Error('El servidor aún no está configurado.');
  location.href = `${c.url}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(appUrl())}`;
}
/** Al volver de Google (o de un enlace del correo) la sesión llega en el #hash. */
export async function handleRedirect() {
  if (!location.hash || !/access_token|error_description/.test(location.hash)) return null;
  const q = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', location.pathname + location.search);
  if (q.get('error_description')) throw new Error(friendly(q.get('error_description')));
  return save({ access_token: q.get('access_token'), refresh_token: q.get('refresh_token'), expires_in: +q.get('expires_in') || 3600 });
}

/* ---------- correo con código ---------- */
export async function sendCode(email) {
  if (!configured()) throw new Error('El servidor aún no está configurado.');
  await call(`otp?redirect_to=${encodeURIComponent(appUrl())}`, { email: String(email).trim().toLowerCase(), create_user: true });
}
export async function verifyCode(email, code) {
  const j = await call('verify', { type: 'email', email: String(email).trim().toLowerCase(), token: String(code).replace(/\D/g, '') });
  return save(j, 'email');
}

/* ---------- sesión ---------- */
let refreshing = null;
export async function token() {
  const a = read(); if (!a?.access) return null;
  if (a.exp > Date.now()) return a.access;
  refreshing ||= call('token?grant_type=refresh_token', { refresh_token: a.refresh }).then(j => save(j, a.provider)).then(() => read().access).catch(() => { write(null); emit(); return null; }).finally(() => { refreshing = null; });
  return refreshing;
}
export async function signOut() {
  const t = read()?.access; write(null); setCloud(null); emit();
  if (t && configured()) call('logout', {}, t).catch(() => {});
}
/** Llamadas a la base de datos como tú. */
export async function rest(path, { method = 'GET', body, headers = {} } = {}) {
  const c = conn(); const t = await token(); if (!t) throw new Error('Inicia sesión para continuar');
  const r = await fetch(`${c.url}/rest/v1/${path}`, { method, headers: { apikey: c.key, Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) { const txt = await r.text().catch(() => ''); throw new Error(txt.slice(0, 140) || `HTTP ${r.status}`); }
  return r;
}
/** Lecturas públicas (ranking) sin necesidad de cuenta. */
export async function publicGet(path, headers = {}) {
  const c = conn(); const t = await token();
  const r = await fetch(`${c.url}/rest/v1/${path}`, { headers: { apikey: c.key, Authorization: `Bearer ${t || c.key}`, ...headers } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`); return r;
}

/* ---------- tu partida en la nube (tabla io_saves, una fila por dato) ---------- */
function connectCloud() {
  if (!configured() || !user()) return;
  setCloud({
    push: rows => rest('io_saves?on_conflict=user_id,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: rows.map(r => ({ user_id: user().id, id: r.id, kind: r.kind, data: r.data, updated_at: r.updated_at, deleted: !!r.deleted })) }),
    pull: async () => (await rest(`io_saves?select=id,kind,data,updated_at,deleted&user_id=eq.${user().id}`)).json(),
  });
}
/** Borra tu cuenta de IO: tu partida en la nube y tu fila del ranking. */
export async function deleteData() {
  const u = user(); if (!u) return;
  await rest(`io_saves?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => {});
  await rest(`io_ranking?user_id=eq.${u.id}`, { method: 'DELETE' }).catch(() => {});
  await signOut();
}
export function init() { if (user()) connectCloud(); }
