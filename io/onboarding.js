/* IO — configuración inicial: IO → tu personaje → tus hábitos (con horario y duración) → tus motivos → reglas. */
import { cfg, saveCfg } from './store.js';
import * as H from './habits.js';
import { avatarSVG, editorHTML, normLook } from './avatar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = 5;
let d, step, onDone, avTab = 'cuerpo', rainT;

export function openOnboarding(opts) {
  onDone = opts.onDone;
  const existing = H.list();
  d = {
    name: cfg.name || '', look: normLook(cfg.avatar),
    habits: existing.length ? existing.map(h => ({ ...h })) : [],
  };
  step = opts.step ?? 0;
  $('onb').hidden = false; document.body.style.overflow = 'hidden';
  draw();
}
function close() { cancelAnimationFrame(rainT); $('onb').hidden = true; document.body.style.overflow = ''; }

function habitRow(h, i) {
  return `<div class="hb-row" data-i="${i}">
    <div class="hb-l1"><input class="hb-e" data-f="emoji" value="${esc(h.emoji)}" maxlength="4" aria-label="Emoji">
      <input class="hb-n" data-f="nombre" value="${esc(h.nombre)}" placeholder="Nombre del hábito" aria-label="Hábito">
      <button class="hb-x" data-o="del" data-i="${i}" aria-label="Quitar">✕</button></div>
    <div class="hb-l2">
      <label>⏱ <input type="number" data-f="min" min="1" max="240" value="${esc(h.min)}" inputmode="numeric"> min</label>
      <label>🕘 <input type="time" data-f="hora" value="${esc(h.hora || '08:00')}"></label>
    </div>
    <div class="hb-days">${H.DAYS.map((dd, k) => `<button class="${(h.dias || [0, 1, 2, 3, 4, 5, 6]).includes(k) ? 'on' : ''}" data-o="day" data-i="${i}" data-k="${k}" aria-label="día ${dd}">${dd}</button>`).join('')}</div>
  </div>`;
}
function body() {
  switch (step) {
    case 0: return `<div class="io-intro"><canvas id="ioRain" aria-hidden="true"></canvas>
      <div class="io-big"><span class="logo-flip"><span class="lf lf-a">IO</span><span class="lf lf-b">10</span></span></div>
      <div class="io-def"><b>IO</b><span>se lee “yo”. Eres tú, frente a tu espejo.</span><b>1 0</b><span>el código con el que se escribe todo.</span><b>1</b><span>lo que haces.</span><b>0</b><span>lo que aún no.</span></div>
      <h1 class="onb-h">Tu vida es el juego.</h1>
      <p class="onb-p">Eliges tus hábitos y su horario. Cuando llega la hora, arrancas el reloj y lo cumples en la vida real. Solo cuando el reloj termina aparece la corona 👑: ahí ganas XP y bits, subes de piso en tu edificio y decoras tu mundo.</p></div>`;
    case 1: return `<div class="onb-eyebrow">PLAYER 1 · CREA TU PERSONAJE</div>
      <div class="av-stage" data-mood="happy" id="onbPrev">${avatarSVG(d.look, 'av')}</div>
      <div class="field"><label for="onbName">Tu nombre</label><input class="inp" id="onbName" value="${esc(d.name)}" autocomplete="given-name" maxlength="20" placeholder="¿Cómo te llamas?"></div>
      <div id="onbEditor">${editorHTML(d.look, avTab)}</div>`;
    case 2: return `<div class="onb-eyebrow">TUS MISIONES DIARIAS</div>
      <h1 class="onb-h">¿Qué hábitos quieres construir?</h1>
      <p class="onb-p">Cada hábito tiene <b>hora</b>, <b>duración</b> y <b>días</b>. Todo lleva reloj, hasta comer saludable o ir a una clase: si el reloj no llega al final, no suma.</p>
      <div class="chips">${H.EXAMPLES.map(([e, n, m, h], k) => `<button class="chip-o${d.habits.some(x => x.nombre === n) ? ' on' : ''}" data-o="ex" data-k="${k}">${e} ${esc(n)} · ${m}′</button>`).join('')}</div>
      <div class="hb-list">${d.habits.map(habitRow).join('') || '<p class="hint">Toca los ejemplos de arriba o crea uno propio.</p>'}</div>
      <button class="onb-add" data-o="add">＋ Crear un hábito propio</button>`;
    case 3: return `<div class="onb-eyebrow">TU PORQUÉ</div>
      <h1 class="onb-h">¿Por qué lo quieres?</h1>
      <p class="onb-p">Si algún día quieres pausar antes de tiempo, IO te va a recordar tu propia razón. Es opcional, pero funciona.</p>
      ${d.habits.map((h, i) => `<div class="field"><label>${esc(h.emoji)} ${esc(h.nombre)}</label><input class="inp" data-motivo="${i}" value="${esc(h.motivo || '')}" maxlength="120" placeholder="${['Quiero leer 12 libros este año', 'Para estar tranquilo en el día', 'Quiero sentirme fuerte', 'Quiero hablar inglés en el trabajo'][i % 4]}"></div>`).join('') || '<p class="hint">Primero agrega al menos un hábito.</p>'}`;
    case 4: return `<div class="onb-eyebrow">REGLAS DEL JUEGO</div>
      <div class="av-stage" data-mood="excited">${avatarSVG(d.look, 'av')}</div>
      <h1 class="onb-h">${esc(d.name || 'Player 1')}, tu partida empieza en el piso 1.</h1>
      <ul class="rules">
        <li><b>▶ Empieza un hábito</b> a su hora. El reloj ocupa toda la pantalla para que no te distraigas.</li>
        <li><b>⏸ Se puede pausar, no terminar antes.</b> Sin reloj completo no hay corona.</li>
        <li><b>👑 Activa la corona</b> y ganas XP y bits. A tiempo = +25%. Rachas = más.</li>
        <li><b>Nivel = piso.</b> Garaje en el 3, garaje doble en el 10, helipuerto en el 50… y el edificio sigue.</li>
        <li><b>Controles:</b> ✥ caminar · puerta a la izquierda = ascensor · A usar · SELECT decorar · START menú.</li>
        <li><b>Siempre gratis.</b> Nada se compra con dinero: todo se gana haciendo.</li>
      </ul>`;
  }
  return '';
}
function draw() {
  $('onb').innerHTML = `
    <div class="onb-top"><div class="onb-steps">${[...Array(STEPS)].map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      ${!cfg.onboarded && step === 0 ? '<button class="onb-skip" data-o="demo">Ver demo</button>' : cfg.onboarded ? '<button class="onb-skip" data-o="close">Cerrar</button>' : ''}</div>
    <div class="onb-body" id="onbBody">${body()}</div>
    <div class="onb-foot">${step > 0 ? '<button class="btn-ghost" data-o="back">←</button>' : ''}
      <button class="btn-acc${step === STEPS - 1 ? ' btn-green' : ''}" data-o="next">${step === 0 ? 'Crear mi personaje →' : step === 2 && !d.habits.length ? 'Elige al menos un hábito' : step === STEPS - 1 ? '▶ PRESS START' : 'Siguiente →'}</button></div>`;
  $('onbBody').scrollTop = 0;
  if (step === 0) binaryRain();
}
function readInputs() {
  if ($('onbName')) d.name = $('onbName').value.trim();
  document.querySelectorAll('#onb .hb-row').forEach(r => {
    const h = d.habits[+r.dataset.i]; if (!h) return;
    r.querySelectorAll('[data-f]').forEach(inp => { h[inp.dataset.f] = inp.dataset.f === 'min' ? Math.max(1, Math.min(240, parseInt(inp.value) || 1)) : inp.value.trim(); });
  });
  document.querySelectorAll('#onb [data-motivo]').forEach(inp => { const h = d.habits[+inp.dataset.motivo]; if (h) h.motivo = inp.value.trim(); });
}
function finish() {
  readInputs();
  saveCfg({ name: d.name || 'Player 1', avatar: d.look, onboarded: true });
  const keep = new Set();
  d.habits.filter(h => h.nombre).forEach(h => { const it = H.save({ nombre: h.nombre, emoji: h.emoji || '⭐', min: h.min, hora: h.hora || '08:00', dias: h.dias || [0, 1, 2, 3, 4, 5, 6], motivo: h.motivo || '', act: h.act || H.actOf(h) }, h.id || null); keep.add(it.id); });
  H.list().forEach(h => { if (!keep.has(h.id)) H.remove(h.id); });
  $('onb').innerHTML = `<div class="onb-boot"><b>IO SYSTEM</b><span>01001001 01001111</span><span class="blink">▶ PRESS START</span></div>`;
  setTimeout(() => { close(); onDone?.({ first: true }); }, 1500);
}
function binaryRain() {
  const c = $('ioRain'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d'); const W = c.width = c.offsetWidth * 2, Hh = c.height = c.offsetHeight * 2;
  const cols = Math.floor(W / 22); const y = Array.from({ length: cols }, () => Math.random() * Hh);
  cancelAnimationFrame(rainT);
  const tick = () => {
    if (!document.body.contains(c)) return;
    ctx.fillStyle = 'rgba(9,9,15,.2)'; ctx.fillRect(0, 0, W, Hh); ctx.font = '22px "Space Mono", monospace';
    y.forEach((v, i) => { ctx.fillStyle = i % 3 ? '#7c5cff' : '#22d3ee'; ctx.fillText(Math.random() > .5 ? '1' : '0', i * 22, v); y[i] = v > Hh + Math.random() * 400 ? 0 : v + 12; });
    rainT = requestAnimationFrame(tick);
  };
  tick();
}

document.addEventListener('click', e => {
  if ($('onb').hidden) return;
  const tab = e.target.closest('[data-avtab]');
  if (tab) { avTab = tab.dataset.avtab; $('onbEditor').innerHTML = editorHTML(d.look, avTab); return; }
  const av = e.target.closest('[data-av]');
  if (av) { d.look[av.dataset.av] = av.dataset.v; $('onbPrev').innerHTML = avatarSVG(d.look, 'av'); av.parentElement.querySelectorAll('[data-av]').forEach(b => b.classList.toggle('on', b === av)); return; }
  const el = e.target.closest('[data-o]'); if (!el) return;
  e.preventDefault(); readInputs();
  const o = el.dataset.o;
  if (o === 'next') { if (step === 2 && !d.habits.length) return; if (step === STEPS - 1) return finish(); step++; return draw(); }
  if (o === 'back') { step = Math.max(0, step - 1); return draw(); }
  if (o === 'close') { close(); return onDone?.({ first: false }); }
  if (o === 'demo') { close(); return onDone?.({ demo: true }); }
  if (o === 'ex') {
    const [e2, n, m, h, act] = H.EXAMPLES[+el.dataset.k];
    const i = d.habits.findIndex(x => x.nombre === n);
    if (i >= 0) d.habits.splice(i, 1); else d.habits.push({ emoji: e2, nombre: n, min: m, hora: h, act, dias: [0, 1, 2, 3, 4, 5, 6] });
    return draw();
  }
  if (o === 'add') { d.habits.push({ emoji: '⭐', nombre: '', min: 15, hora: '08:00', dias: [0, 1, 2, 3, 4, 5, 6] }); draw(); const rows = document.querySelectorAll('#onb .hb-n'); rows[rows.length - 1]?.focus(); return; }
  if (o === 'del') { d.habits.splice(+el.dataset.i, 1); return draw(); }
  if (o === 'day') { const h = d.habits[+el.dataset.i]; const k = +el.dataset.k; h.dias = h.dias || [0, 1, 2, 3, 4, 5, 6]; h.dias = h.dias.includes(k) ? h.dias.filter(x => x !== k) : [...h.dias, k].sort(); el.classList.toggle('on'); return; }
});
