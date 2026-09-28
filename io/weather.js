/* IO — el clima real en tu ventana (opcional). Usa Open-Meteo, sin llave ni cuenta.
 * La ubicación se pide una vez y solo se guarda redondeada en este dispositivo. */
import { cfg, saveCfg } from './store.js';

const K = 'io.wx';
const CODES = c => c <= 1 ? 'sol' : c <= 3 ? 'nubes' : c <= 48 ? 'niebla' : c <= 67 || (c >= 80 && c <= 82) ? 'lluvia' : c <= 77 || c === 85 || c === 86 ? 'nieve' : c >= 95 ? 'tormenta' : 'nubes';
const ICON = { sol: '☀️', nubes: '☁️', niebla: '🌫️', lluvia: '🌧️', nieve: '❄️', tormenta: '⛈️' };
export const icon = k => ICON[k] || '';
function cached() { try { const v = JSON.parse(localStorage.getItem(K) || 'null'); return v && Date.now() - v.t < 30 * 60000 ? v : null; } catch { return null; } }
const where = () => new Promise((res, rej) => navigator.geolocation ? navigator.geolocation.getCurrentPosition(p => res([+p.coords.latitude.toFixed(2), +p.coords.longitude.toFixed(2)]), rej, { timeout: 8000, maximumAge: 36e5 }) : rej(new Error('Sin GPS')));
export async function enable(on) {
  if (!on) { saveCfg({ weather: false }); apply(null); return true; }
  try { const ll = await where(); saveCfg({ weather: true, wxLoc: ll }); await refresh(true); return true; } catch { saveCfg({ weather: false }); return false; }
}
export async function refresh(force = false) {
  if (!cfg.weather || !cfg.wxLoc) return apply(null);
  let v = !force && cached();
  if (!v) {
    try {
      const [la, lo] = cfg.wxLoc; const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=weather_code,temperature_2m,is_day`);
      const j = await r.json(); v = { t: Date.now(), k: CODES(j.current.weather_code), temp: Math.round(j.current.temperature_2m), day: !!j.current.is_day };
      localStorage.setItem(K, JSON.stringify(v));
    } catch { return apply(null); }
  }
  apply(v); return v;
}
export function apply(v) {
  const sc = document.getElementById('scene'); const tag = document.getElementById('wxTag'); if (!sc) return;
  if (!v) { delete sc.dataset.weather; if (tag) tag.hidden = true; return; }
  sc.dataset.weather = v.k; if (tag) { tag.hidden = false; tag.textContent = `${ICON[v.k]} ${v.temp}°`; }
}
export const now = () => cached();
