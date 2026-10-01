/* IO — formulario de hábito (el mismo en el onboarding y en "Nuevo hábito").
 * Escribes el hábito con tus palabras ("Levantarme a las 7", "Leer 20 minutos") y el juego entiende
 * la hora, la duración, el ícono y lo que hará tu personaje. Todo lo demás es opcional. */
import * as H from './habits.js';
import { isEn } from './i18n.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MINS = [1, 5, 10, 15, 20, 30, 45, 60];
const MOMENTS = [['🌅', 'Mañana', '07:00'], ['☀️', 'Mediodía', '12:00'], ['🌇', 'Tarde', '17:30'], ['🌙', 'Noche', '21:00']];
const TIPOS = [['reloj', '⏱', 'Con duración', 'Cronómetro · más puntos'], ['marca', '✓', 'Solo marcarlo', 'Un toque · menos puntos'], ['conteo', '🔢', 'Contar veces', 'Ej. 8 vasos de agua']];
export const EXAMPLES = ['Levantarme a las 7 de la mañana', 'Leer un libro 20 minutos', 'Comer una manzana', 'Respirar 1 minuto', 'Ir al gimnasio 30 min', 'Mandarle un mensaje a alguien', 'Escribir mi diario 10 min', 'Tomar agua'];
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
const ALL = [0, 1, 2, 3, 4, 5, 6];
const st = new WeakMap();

export const blank = () => ({ nombre: '', emoji: '⭐', tipo: 'reloj', min: 20, hora: '', dias: [...ALL], motivo: '' });

export function formHTML(h = blank(), { examples = true } = {}) {
  const tipo = h.tipo === 'marca' || h.tipo === 'conteo' ? h.tipo : 'reloj';
  const hora = H.hasTime(h) ? h.hora : '';
  return `<div class="hf" data-tipo="${tipo}" data-hora="${hora ? 1 : 0}">
    <label class="hf-l">¿Qué hábito quieres?</label>
    <div class="hf-name"><span class="hf-em" data-hf-em>${esc(h.emoji || '⭐')}</span><input class="inp hf-in" data-hf-in value="${esc(h.nombre)}" maxlength="60" placeholder="Ej: Leer 20 minutos" autocomplete="off" enterkeyhint="done"></div>
    <p class="hf-hint" data-hf-hint></p>
    ${examples ? `<div class="hf-chips" aria-label="Ejemplos">${EXAMPLES.map(e => `<button type="button" data-hf="ex" data-v="${esc(e)}">${esc(e)}</button>`).join('')}</div>` : ''}
    <div class="hf-rest">
    <label class="hf-l">¿Cómo lo vas a cumplir?</label>
    <div class="hf-types">${TIPOS.map(([k, e, t, s]) => `<button type="button" data-hf="tipo" data-v="${k}"><i>${e}</i><b>${t}</b><small>${s}</small></button>`).join('')}</div>
    <div class="hf-sec" data-hf-sec="reloj"><label class="hf-l">¿Cuánto tiempo? <em>tú lo inicias; el reloj sigue aunque apagues la pantalla</em></label>
      <div class="hf-pick">${MINS.map(m => `<button type="button" data-hf="min" data-v="${m}">${fmtMin(m)}</button>`).join('')}<label class="hf-own">✎<input type="number" min="1" max="240" data-hf-min value="${esc(h.min || 20)}" inputmode="numeric" aria-label="Otros minutos"></label></div></div>
    <div class="hf-sec" data-hf-sec="conteo"><label class="hf-l">¿Cuántas veces al día y de qué?</label>
      <div class="hf-row"><input class="inp" type="number" min="1" max="50" data-hf-meta value="${esc(h.meta || 8)}" inputmode="numeric" aria-label="Veces"><input class="inp" data-hf-uni value="${esc(h.unidad || 'vasos')}" maxlength="14" aria-label="De qué"></div>
      <label class="hf-l">Mínimo entre cada una <em>minutos</em></label>
      <div class="hf-pick">${[5, 15, 30, 60, 120].map(m => `<button type="button" data-hf="pausa" data-v="${m}">${fmtMin(m)}</button>`).join('')}</div></div>
    <p class="hf-pts" data-hf-pts></p>
    <label class="hf-l">¿Con horario? <em>opcional · te avisamos a esa hora</em></label>
    <div class="hf-seg"><button type="button" data-hf="hora" data-v="0">Sin hora<small>cuando pueda</small></button><button type="button" data-hf="hora" data-v="1">🔔 Ponerle hora<small>y que me avise</small></button></div>
    <div class="hf-time" data-hf-time><div class="hf-pick">${MOMENTS.map(([e, l, t]) => `<button type="button" data-hf="moment" data-v="${t}">${e} ${l}<small>${t}</small></button>`).join('')}<label class="hf-own wide">🕘<input type="time" data-hf-hora value="${esc(hora || '08:00')}" aria-label="Hora"></label></div></div>
    <details class="hf-more"><summary>Más opciones</summary>
      <label class="hf-l">¿Qué días?</label>
      <div class="hf-pick">${[['Todos', ALL], ['Lun–Vie', [1, 2, 3, 4, 5]], ['Fin de semana', [0, 6]]].map(([l, v]) => `<button type="button" data-hf="days" data-v="${v.join(',')}">${l}</button>`).join('')}</div>
      <div class="hb-days big" data-hf-days>${H.DAYS.map((d, k) => `<button type="button" data-hf="day" data-k="${k}" aria-label="día ${d}">${d}</button>`).join('')}</div>
      <label class="hf-l">Tu personaje mientras lo haces</label>
      <select class="inp" data-hf-act>${Object.entries(H.ACTS).map(([k, [e, l]]) => `<option value="${k}">${e} ${l}</option>`).join('')}</select>
      <label class="hf-l">¿Por qué? <em>opcional · te lo recordamos si quieres pausar</em></label>
      <input class="inp" data-hf-mot value="${esc(h.motivo || '')}" maxlength="120" placeholder="Quiero…"></details>
    </div>
  </div>`;
}

/** Conecta el formulario ya puesto en pantalla. `onChange` avisa cada vez que algo cambia. */
export function mount(root, h = blank(), onChange = () => {}) {
  const f = root.querySelector('.hf'); if (!f) return;
  const q = s => f.querySelector(s);
  const s = {
    tipo: ['marca', 'conteo'].includes(h.tipo) ? h.tipo : 'reloj', min: +h.min || 20, hora: H.hasTime(h) ? h.hora : '', dias: [...(h.dias?.length ? h.dias : ALL)],
    pausa: h.pausa ?? 30, emoji: h.emoji || '⭐', act: h.act || null, manual: new Set(h.nombre ? ['tipo', 'min', 'hora'] : []), emojiLocked: !!(h.nombre && h.emoji && h.emoji !== '⭐'),
  };
  st.set(f, s);
  q('[data-hf-act]').value = s.act && H.ACTS[s.act] ? s.act : H.guessAct(h.nombre, h.emoji);
  if (h.nombre) s.act = q('[data-hf-act]').value;
  const paint = () => {
    f.dataset.tipo = s.tipo; f.dataset.hora = s.hora ? 1 : 0; f.dataset.empty = q('[data-hf-in]').value.trim() ? 0 : 1;
    f.querySelectorAll('[data-hf="tipo"]').forEach(b => b.classList.toggle('on', b.dataset.v === s.tipo));
    f.querySelectorAll('[data-hf-sec]').forEach(x => { x.hidden = x.dataset.hfSec !== s.tipo; });
    f.querySelectorAll('[data-hf="min"]').forEach(b => b.classList.toggle('on', +b.dataset.v === s.min));
    f.querySelectorAll('[data-hf="pausa"]').forEach(b => b.classList.toggle('on', +b.dataset.v === +s.pausa));
    f.querySelectorAll('[data-hf="hora"]').forEach(b => b.classList.toggle('on', (b.dataset.v === '1') === !!s.hora));
    q('[data-hf-time]').hidden = !s.hora;
    f.querySelectorAll('[data-hf="moment"]').forEach(b => b.classList.toggle('on', b.dataset.v === s.hora));
    f.querySelectorAll('[data-hf="day"]').forEach(b => b.classList.toggle('on', s.dias.includes(+b.dataset.k)));
    f.querySelectorAll('[data-hf="days"]').forEach(b => b.classList.toggle('on', b.dataset.v.split(',').map(Number).sort().join() === [...s.dias].sort().join()));
    const mi = q('[data-hf-min]'); if (document.activeElement !== mi) mi.value = s.min;
    if (s.hora) { const hi = q('[data-hf-hora]'); if (document.activeElement !== hi) hi.value = s.hora; }
    q('[data-hf-em]').textContent = s.emoji;
    const meta = +q('[data-hf-meta]').value || 8;
    q('[data-hf-pts]').textContent = s.tipo === 'marca' ? '⭐ Un toque y listo · +6 XP. Con duración ganas más.'
      : s.tipo === 'conteo' ? `⭐ +${Math.max(5, Math.min(40, 4 * meta))} XP al completar las ${meta}.` : `⭐ +${Math.max(5, Math.min(120, s.min))} XP al completar los ${fmtMin(s.min)}.`;
  };
  const hint = p => {
    const bits = [];
    if (p.hora) bits.push('🔔 a las ' + p.hora);
    if (p.min) bits.push('⏱ ' + fmtMin(p.min));
    q('[data-hf-hint]').textContent = bits.length ? 'Entendí: ' + bits.join(' · ') + '. Puedes cambiarlo abajo.' : 'Pequeño vale: un minuto o una sola acción ya es un hábito.';
  };
  const apply = () => {
    const p = H.parseQuick(q('[data-hf-in]').value);
    if (p.hora && !s.manual.has('hora')) s.hora = p.hora;
    if (p.min && !s.manual.has('min')) s.min = Math.max(1, Math.min(240, p.min));
    if (!s.manual.has('tipo')) { if (p.min) s.tipo = 'reloj'; else if (p.hora || H.MARK_RE.test(p.nombre)) s.tipo = 'marca'; else if (s.tipo === 'marca') s.tipo = 'reloj'; }
    const g = H.guessAct(p.nombre); const e = H.guessEmoji(p.nombre);
    if (!s.emojiLocked) s.emoji = e;
    if (!s.manual.has('act')) { s.act = g; q('[data-hf-act]').value = g; }
    hint(p); paint(); onChange(read(root));
  };
  f.addEventListener('input', e => {
    const t = e.target;
    if (t.matches('[data-hf-in]')) return apply();
    if (t.matches('[data-hf-min]')) { s.min = Math.max(1, Math.min(240, parseInt(t.value) || 1)); s.manual.add('min'); }
    else if (t.matches('[data-hf-hora]')) { s.hora = t.value || s.hora; s.manual.add('hora'); }
    else if (t.matches('[data-hf-act]')) { s.act = t.value; s.manual.add('act'); }
    paint(); onChange(read(root));
  });
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-hf]'); if (!b || !f.contains(b)) return;
    e.preventDefault(); e.stopPropagation();
    const k = b.dataset.hf, v = b.dataset.v;
    if (k === 'ex') { q('[data-hf-in]').value = v; apply(); q('[data-hf-in]').focus({ preventScroll: true }); return; }
    if (k === 'tipo') { s.tipo = v; s.manual.add('tipo'); }
    else if (k === 'min') { s.min = +v; s.manual.add('min'); }
    else if (k === 'pausa') s.pausa = +v;
    else if (k === 'hora') { s.manual.add('hora'); s.hora = v === '1' ? (s.hora || '08:00') : ''; }
    else if (k === 'moment') { s.hora = v; s.manual.add('hora'); }
    else if (k === 'days') s.dias = v.split(',').map(Number);
    else if (k === 'day') { const n = +b.dataset.k; s.dias = s.dias.includes(n) ? s.dias.filter(x => x !== n) : [...s.dias, n]; }
    paint(); onChange(read(root));
  });
  hint(H.parseQuick(q('[data-hf-in]').value)); paint();
}

/** Lee lo que hay en el formulario: ya limpio y listo para guardar. */
export function read(root) {
  const f = root.querySelector('.hf'); const s = st.get(f); if (!f || !s) return null;
  const q = x => f.querySelector(x);
  const raw = q('[data-hf-in]').value.trim(); const p = H.parseQuick(raw);
  const nombre = (p.nombre || raw).slice(0, 40);
  const act = s.manual.has('act') ? q('[data-hf-act]').value : H.guessAct(nombre);
  const emoji = s.emojiLocked ? s.emoji : H.guessEmoji(nombre);
  const out = { nombre, emoji, act, tipo: s.tipo, hora: s.hora || '', dias: s.dias.length ? s.dias : [...ALL], motivo: q('[data-hf-mot]').value.trim() };
  if (s.tipo === 'reloj') out.min = s.min;
  else if (s.tipo === 'marca') out.min = 1;
  else { out.min = 1; out.meta = Math.max(1, Math.min(50, parseInt(q('[data-hf-meta]').value) || 1)); out.unidad = q('[data-hf-uni]').value.trim() || (isEn ? 'times' : 'veces'); out.pausa = Math.max(1, Math.min(240, +s.pausa || 15)); }
  return out;
}
