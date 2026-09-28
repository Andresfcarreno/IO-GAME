/* IO — recordatorios y calendario.
 * - Notificaciones a la hora de cada hábito (mientras la app está abierta o en segundo plano;
 *   las notificaciones con la app cerrada llegan con la versión de tiendas).
 * - Exportar tus hábitos a cualquier calendario (.ics con alarma) o a Google Calendar.
 * - Número de hábitos pendientes en el ícono de la app. */
import { cfg, saveCfg, todayIso, pad } from './store.js';
import * as H from './habits.js';

const K = 'io.notified';
const supported = () => 'Notification' in window;
export const state = () => (!supported() ? 'unsupported' : Notification.permission);
export const enabled = () => !!cfg.remind && state() === 'granted';

export async function enable(on = true) {
  if (!on) { saveCfg({ remind: false }); return 'off'; }
  if (!supported()) return 'unsupported';
  const p = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  saveCfg({ remind: p === 'granted' });
  if (p === 'granted') notify('🔔 Recordatorios listos', 'Te aviso a la hora de cada hábito. Tu personaje ya se está preparando.', 'io-test');
  return p;
}
async function notify(title, body, tag, url = './') {
  const opt = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url }, vibrate: [60, 40, 60] };
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.showNotification(title, opt); return; } } catch { /* */ }
  try { new Notification(title, opt); } catch { /* */ }
}
function seen() { try { const v = JSON.parse(localStorage.getItem(K) || '{}'); return v.d === todayIso() ? v : { d: todayIso(), ids: {} }; } catch { return { d: todayIso(), ids: {} }; } }
function mark(v) { try { localStorage.setItem(K, JSON.stringify(v)); } catch { /* */ } }
const LINES = { read: 'ya tiene el libro en la mano', flex: 'ya está calentando', dog: 'ya tiene la correa lista 🐕', pray: 'te espera en silencio', breathe: 'ya está respirando', run: 'ya se amarró los tenis', study: 'ya abrió el cuaderno', music: 'ya afinó', float: 'ya se sentó a meditar' };
/** Revisa cada 30 s si toca avisar de algún hábito. */
export function tick() {
  if (!enabled()) return;
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes(); const lead = +(cfg.remindLead ?? 5);
  const v = seen();
  for (const h of H.forDay()) {
    const s = H.sess(h.id); if (s.done || s.el > 0 || v.ids[h.id]) continue;
    const at = H.minutesOf(h.hora) - lead;
    if (m >= at && m <= at + 10) {
      v.ids[h.id] = 1; mark(v);
      const act = H.actOf(h);
      notify(`${h.emoji} ${h.nombre} · ${lead ? `en ${lead} min` : 'es la hora'}`, `${cfg.name || 'Tu personaje'} ${LINES[act] || 'te está esperando'}. ${h.min} min · empieza a tiempo y ganas +25%.`, 'io-' + h.id, `./?start=${encodeURIComponent(h.id)}`);
    }
  }
}
export function start() { tick(); setInterval(tick, 30000); }

/** Pendientes de hoy en el ícono de la app (Android/PC instaladas). */
export function badge() {
  try {
    const n = H.forDay().filter(h => !H.sess(h.id).claimed).length;
    if (!('setAppBadge' in navigator)) return;
    n ? navigator.setAppBadge(n) : navigator.clearAppBadge();
  } catch { /* */ }
}

/* ---------- calendario ---------- */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const stamp = (d, hhmm) => { const [a, b] = hhmm.split(':'); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(a)}${pad(b)}00`; };
const esc = s => String(s).replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
function nextDate(h) { const d = new Date(); for (let i = 0; i < 7; i++) { if ((h.dias || [0, 1, 2, 3, 4, 5, 6]).includes(d.getDay())) return d; d.setDate(d.getDate() + 1); } return new Date(); }
const rrule = h => `FREQ=WEEKLY;BYDAY=${(h.dias || [0, 1, 2, 3, 4, 5, 6]).map(k => BYDAY[k]).join(',')}`;
export function ics(habits = H.list()) {
  const now = new Date(); const dt = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const url = location.origin + location.pathname;
  const ev = habits.map(h => ['BEGIN:VEVENT', `UID:${h.id.replace(/[^\w-]/g, '')}@io.habitos`, `DTSTAMP:${dt}`, `DTSTART:${stamp(nextDate(h), h.hora || '08:00')}`, `DURATION:PT${h.min}M`, `RRULE:${rrule(h)}`,
    `SUMMARY:${esc(`${h.emoji} ${h.nombre} · IO`)}`, `DESCRIPTION:${esc(`${h.min} min con reloj en IO. ${h.motivo ? 'Tu porqué: ' + h.motivo + '. ' : ''}Ábrelo aquí: ${url}?start=${h.id}`)}`, `URL:${url}?start=${h.id}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${h.emoji} ${h.nombre}`)}`, `TRIGGER:-PT${+(cfg.remindLead ?? 5)}M`, 'END:VALARM', 'END:VEVENT'].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//IO//Habitos//ES', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:IO · mis hábitos', ...ev, 'END:VCALENDAR'].join('\r\n');
}
export async function exportIcs() {
  const blob = new Blob([ics()], { type: 'text/calendar' });
  const file = new File([blob], 'io-habitos.ics', { type: 'text/calendar' });
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'IO · mis hábitos' }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'io-habitos.ics'; a.click(); return 'download';
}
export function googleLink(h) {
  const d = nextDate(h); const [a, b] = (h.hora || '08:00').split(':').map(Number);
  const end = new Date(d); end.setHours(a, b + h.min, 0, 0); const e = stamp(end, `${pad(end.getHours())}:${pad(end.getMinutes())}`);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: `${h.emoji} ${h.nombre} · IO`, dates: `${stamp(d, h.hora || '08:00')}/${e}`, details: `${h.min} min con reloj en IO: ${location.origin + location.pathname}?start=${h.id}`, recur: `RRULE:${rrule(h)}` });
  return `https://calendar.google.com/calendar/render?${q}`;
}
