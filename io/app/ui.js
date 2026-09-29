/* IO — utilidades de interfaz compartidas: toast, hoja inferior, escape. */
export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmtN = n => Number(n || 0).toLocaleString('es-CO');
let toastT;
export function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }
export function openSheet(title, html) { $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBody').scrollTop = 0; $('sheetOv').classList.add('open'); $('sheet').classList.add('open'); document.body.style.overflow = 'hidden'; }
export function closeSheet() { $('sheetOv').classList.remove('open'); $('sheet').classList.remove('open'); document.body.style.overflow = ''; }
export const sheetOpen = () => $('sheet').classList.contains('open');
