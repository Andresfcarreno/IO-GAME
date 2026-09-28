/* IO — configuración inicial en 4 pasos: IO → tu personaje → tu rutina → ¡a jugar!
 * La rutina se arma tocando tarjetas; hora, minutos y días se eligen con chips (sin teclear),
 * y cada hábito muestra en vivo cómo lo hará tu personaje. */
import { cfg, saveCfg, todayIso } from './store.js';
import * as H from './habits.js';
import { avatarSVG, editorHTML, normLook } from './avatar.js';
import { sceneHTML } from './scenes.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = [['intro', 'IO'], ['char', 'Tú'], ['habits', 'Rutina'], ['go', '¡A jugar!']];
const ALL = [0, 1, 2, 3, 4, 5, 6], WEEK = [1, 2, 3, 4, 5], WKND = [0, 6];
const MOMENTS = [['🌅', 'Mañana', '06:30'], ['☀️', 'Mediodía', '12:30'], ['🌇', 'Tarde', '18:00'], ['🌙', 'Noche', '21:00']];
const MINS = [1, 5, 10, 15, 20, 30, 45, 60];
const EMOJIS = ['⭐', '📖', '🧘', '🏃', '🏋️', '🚶', '🐕', '🥗', '💧', '🇬🇧', '💻', '🎓', '🎸', '🎨', '✍️', '🧹', '🍳', '🙏', '😴', '📵', '🤸', '🏊', '🧠', '🌱'];
let d, step, onDone, avTab = 'cuerpo', rainT, cat = 0;

export function openOnboarding(opts) {
  onDone = opts.onDone;
  const existing = H.list();
  d = { name: cfg.name || '', look: normLook(cfg.avatar), habits: existing.map(h => ({ ...h, dias: h.dias?.length ? h.dias : [...ALL], act: H.actOf(h) })), open: -1 };
  step = Math.min(opts.step ?? 0, STEPS.length - 1);
  $('onb').hidden = false; document.body.style.overflow = 'hidden';
  draw();
}
function close() { cancelAnimationFrame(rainT); $('onb').hidden = true; document.body.style.overflow = ''; }

/* ---------- utilidades de la rutina ---------- */
const sameDays = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const daysLabel = dias => sameDays(dias, ALL) ? 'todos los días' : sameDays(dias, WEEK) ? 'lunes a viernes' : sameDays(dias, WKND) ? 'fines de semana' : dias.map(k => H.DAYS[k]).join(' ');
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
const picked = n => d.habits.findIndex(x => x.nombre === n);

function exampleCards() {
  const [, , list] = H.CATEGORIES[cat];
  return list.map(([e, n, m, h, , cf]) => {
    const on = picked(n) >= 0;
    return `<button class="ex-card${on ? ' on' : ''}" data-o="ex" data-n="${esc(n)}" aria-pressed="${on}">
      <span class="ex-e">${e}</span><b>${esc(n)}</b><small>${cf?.tipo === 'conteo' ? `${cf.meta} ${cf.unidad}` : fmtMin(m)} · ${h}</small><i>${on ? '✓' : '＋'}</i></button>`;
  }).join('');
}
function timeline() {
  if (!d.habits.length) return '';
  const pos = t => { const m = H.minutesOf(t); return Math.max(0, Math.min(100, (m - 300) / (1440 - 300) * 100)); };
  const total = d.habits.reduce((a, h) => a + (+h.min || 0), 0);
  return `<div class="tl"><div class="tl-h"><b>Tu día</b><small>${d.habits.length} hábito${d.habits.length > 1 ? 's' : ''} · ${fmtMin(total)} al día</small></div>
    <div class="tl-bar"><span class="tl-sun">🌅</span><span class="tl-moon">🌙</span>${d.habits.map((h, i) => `<button class="tl-dot" style="left:${pos(h.hora)}%" data-o="edit" data-i="${i}" title="${esc(h.nombre)} · ${h.hora}">${esc(h.emoji)}</button>`).join('')}</div>
    <div class="tl-ax"><span>5:00</span><span>12:00</span><span>18:00</span><span>24:00</span></div></div>`;
}
function habitCard(h, i) {
  const open = d.open === i; const act = H.ACTS[h.act] ? h.act : H.guessAct(h.nombre, h.emoji);
  const head = `<div class="hc-head"><button class="hc-e" data-o="edit" data-i="${i}" aria-label="Editar">${esc(h.emoji)}</button>
      <button class="hc-t" data-o="edit" data-i="${i}"><b>${esc(h.nombre || 'Nuevo hábito')}</b><small>🕘 ${esc(h.hora)} · ${h.tipo === 'conteo' ? `🔢 ${h.meta} ${esc(h.unidad)}` : `⏱ ${fmtMin(h.min)}`} · ${daysLabel(h.dias)}</small></button>
      <button class="hc-x" data-o="del" data-i="${i}" aria-label="Quitar">✕</button></div>`;
  if (!open) return `<div class="hc" data-i="${i}">${head}</div>`;
  return `<div class="hc open" data-i="${i}">${head}
    <div class="hc-body">
      <div class="hc-prev">${sceneHTML(act, d.look)}<span>Así lo hará tu personaje: <b>${H.ACTS[act][0]} ${H.ACTS[act][1].toLowerCase()}</b></span></div>
      <label class="hc-l">Nombre</label>
      <input class="inp" data-f="nombre" data-i="${i}" value="${esc(h.nombre)}" maxlength="40" placeholder="Ej: sacar al perro">
      <div class="emo-strip">${EMOJIS.map(e => `<button class="${h.emoji === e ? 'on' : ''}" data-o="emoji" data-i="${i}" data-v="${e}">${e}</button>`).join('')}</div>
      <label class="hc-l">¿A qué hora?</label>
      <div class="pick">${MOMENTS.map(([e, l, t]) => `<button class="${h.hora === t ? 'on' : ''}" data-o="hora" data-i="${i}" data-v="${t}">${e} ${l}<small>${t}</small></button>`).join('')}
        <label class="pick-own">✎<input type="time" data-f="hora" data-i="${i}" value="${esc(h.hora)}" aria-label="Otra hora"></label></div>
      ${h.tipo === 'conteo' ? `<label class="hc-l">¿Cuántas veces al día? <em>un toque por vez, con pausa entre toques</em></label>
      <div class="pick">${[2, 3, 5, 8, 10].map(m => `<button class="${+h.meta === m ? 'on' : ''}" data-o="meta" data-i="${i}" data-v="${m}">${m} ${esc(h.unidad || '')}</button>`).join('')}</div>
      <label class="hc-l">Mínimo entre cada una</label>
      <div class="pick">${[5, 15, 30, 60, 120].map(m => `<button class="${+h.pausa === m ? 'on' : ''}" data-o="pausa" data-i="${i}" data-v="${m}">${fmtMin(m)}</button>`).join('')}</div>` : `      <label class="hc-l">¿Cuánto tiempo? <em>el reloj debe llegar al final</em></label>
      <div class="pick">${MINS.map(m => `<button class="${+h.min === m ? 'on' : ''}" data-o="min" data-i="${i}" data-v="${m}">${fmtMin(m)}</button>`).join('')}
        <label class="pick-own">✎<input type="number" min="1" max="240" data-f="min" data-i="${i}" value="${esc(h.min)}" inputmode="numeric" aria-label="Otros minutos"></label></div>
`}
      <label class="hc-l">¿Qué días?</label>
      <div class="pick">${[['Todos', ALL], ['Lun–Vie', WEEK], ['Fin de semana', WKND]].map(([l, v]) => `<button class="${sameDays(h.dias, v) ? 'on' : ''}" data-o="days" data-i="${i}" data-v="${v.join(',')}">${l}</button>`).join('')}</div>
      <div class="hb-days">${H.DAYS.map((dd, k) => `<button class="${h.dias.includes(k) ? 'on' : ''}" data-o="day" data-i="${i}" data-k="${k}" aria-label="día ${dd}">${dd}</button>`).join('')}</div>
      <label class="hc-l">Tu personaje</label>
      <select class="inp" data-f="act" data-i="${i}">${Object.entries(H.ACTS).map(([k, [e, l]]) => `<option value="${k}"${k === act ? ' selected' : ''}>${e} ${l}</option>`).join('')}</select>
      <label class="hc-l">¿Por qué? <em>opcional · te lo recordamos si quieres pausar</em></label>
      <input class="inp" data-f="motivo" data-i="${i}" value="${esc(h.motivo || '')}" maxlength="120" placeholder="Quiero…">
      <button class="hc-ok" data-o="done">Listo ✓</button>
    </div></div>`;
}
function habitsStep() {
  return `<div class="onb-eyebrow">PASO 2 · TU RUTINA</div>
    <h1 class="onb-h">¿Qué quieres hacer cada día?</h1>
    <p class="onb-p">Toca los hábitos que quieras. Ya traen hora y minutos: si quieres, los ajustas con un toque.</p>
    <form class="own" data-o="own"><input class="inp" id="ownIn" maxlength="40" placeholder="＋ Escribe el tuyo: “sacar al perro”…" autocomplete="off"><button class="btn-acc" type="submit">Agregar</button></form>
    <div class="cat-tabs" role="tablist">${H.CATEGORIES.map(([e, n], k) => `<button role="tab" class="${k === cat ? 'on' : ''}" data-o="cat" data-k="${k}">${e} ${n}</button>`).join('')}</div>
    <div class="ex-grid" id="exGrid">${exampleCards()}</div>
    <div id="onbRoutine">${routine()}</div>`;
}
function routine() {
  if (!d.habits.length) return '<p class="hint center">Elige al menos uno para empezar. Puedes cambiar todo después.</p>';
  return `${timeline()}<div class="sec-t">TU RUTINA · toca uno para ajustarlo</div><div class="hc-list">${d.habits.map(habitCard).join('')}</div>`;
}

function body() {
  switch (STEPS[step][0]) {
    case 'intro': return `<div class="io-intro"><canvas id="ioRain" aria-hidden="true"></canvas>
      <div class="io-big"><span class="logo-flip"><span class="lf lf-a">IO</span><span class="lf lf-b">10</span></span></div>
      <div class="io-def"><b>IO</b><span>se lee “yo”. Eres tú, frente a tu espejo.</span><b>1 0</b><span>el código con el que se escribe todo.</span><b>1</b><span>lo que haces.</span><b>0</b><span>lo que aún no.</span></div>
      <h1 class="onb-h">Tu vida es el juego.</h1>
      <div class="how">
        <div><i>1</i><b>Eliges tus hábitos</b><small>con hora y minutos</small></div>
        <div><i>2</i><b>Arrancas el reloj</b><small>y tu personaje lo hace contigo</small></div>
        <div><i>3</i><b>Ganas la corona 👑</b><small>subes de piso y decoras</small></div>
      </div></div>`;
    case 'char': return `<div class="onb-eyebrow">PASO 1 · CREA TU PERSONAJE</div>
      <div class="av-stage" data-mood="happy" id="onbPrev">${avatarSVG(d.look, 'av')}</div>
      <div class="field"><label for="onbName">Tu nombre</label><input class="inp" id="onbName" value="${esc(d.name)}" autocomplete="given-name" maxlength="20" placeholder="¿Cómo te llamas?"></div>
      <div id="onbEditor">${editorHTML(d.look, avTab)}</div>`;
    case 'habits': return habitsStep();
    case 'go': return `<div class="onb-eyebrow">PASO 3 · ¡A JUGAR!</div>
      <div class="av-stage" data-mood="excited">${avatarSVG(d.look, 'av')}</div>
      <h1 class="onb-h">${esc(d.name || 'Player 1')}, tu partida empieza en el piso 1.</h1>
      <ul class="rules">
        <li><span>▶</span><div><b>Empieza a la hora.</b> ±30 min = +25% de premio.</div></li>
        <li><span>⏸</span><div><b>Se puede pausar, no terminar antes.</b> Sin reloj completo no hay corona.</div></li>
        <li><span>👑</span><div><b>Activa la corona</b> y ganas XP y bits. Las rachas suman más.</div></li>
        <li><span>🏢</span><div><b>Nivel = piso.</b> Garaje en el 3, helipuerto en el 50… y sigue.</div></li>
        <li><span>🎮</span><div><b>Consola:</b> ✥ caminar · puerta = ascensor · A usar · SELECT decorar · START menú.</div></li>
        <li><span>💜</span><div><b>Siempre gratis.</b> Nada se compra con dinero: todo se gana haciendo.</div></li>
      </ul>`;
  }
  return '';
}
function draw() {
  const last = step === STEPS.length - 1; const isHab = STEPS[step][0] === 'habits';
  $('onb').innerHTML = `
    <div class="onb-top"><div class="onb-steps">${STEPS.map(([, l], i) => `<i class="${i < step ? 'done' : i === step ? 'on' : ''}"><span>${l}</span></i>`).join('')}</div>
      ${!cfg.onboarded && step === 0 ? '<button class="onb-skip" data-o="demo">Ver demo</button>' : cfg.onboarded ? '<button class="onb-skip" data-o="close">Cerrar</button>' : ''}</div>
    <div class="onb-body" id="onbBody">${body()}</div>
    <div class="onb-foot">${step > 0 ? '<button class="btn-ghost" data-o="back" aria-label="Atrás">←</button>' : ''}
      <button class="btn-acc${last ? ' btn-green' : ''}${isHab && !d.habits.length ? ' off' : ''}" data-o="next" id="onbNext">${nextLabel()}</button></div>`;
  $('onbBody').scrollTop = 0;
  if (step === 0) binaryRain();
  if (isHab) wireInputs();
}
const nextLabel = () => step === 0 ? 'Empezar →' : STEPS[step][0] === 'habits' ? (d.habits.length ? `Listo, ${d.habits.length} hábito${d.habits.length > 1 ? 's' : ''} →` : 'Elige al menos un hábito') : step === STEPS.length - 1 ? '▶ PRESS START' : 'Siguiente →';
/** Redibuja solo la rutina (sin perder el scroll). */
function redrawRoutine(scrollTo = -1) {
  $('onbRoutine').innerHTML = routine(); $('exGrid').innerHTML = exampleCards(); $('onbNext').textContent = nextLabel(); $('onbNext').classList.toggle('off', !d.habits.length);
  wireInputs();
  if (scrollTo >= 0) document.querySelector(`.hc[data-i="${scrollTo}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function wireInputs() {
  document.querySelectorAll('#onb [data-f]').forEach(inp => {
    inp.oninput = () => {
      const h = d.habits[+inp.dataset.i]; const f = inp.dataset.f;
      if (f === 'min') h.min = Math.max(1, Math.min(240, parseInt(inp.value) || 1));
      else if (f === 'nombre') { h.nombre = inp.value; if (!h._emoji) { const e = H.guessEmoji(h.nombre); if (e !== '⭐') h.emoji = e; } if (!h._act) h.act = H.guessAct(h.nombre, h.emoji); }
      else if (f === 'act') { h.act = inp.value; h._act = true; }
      else h[f] = inp.value;
    };
    inp.onchange = () => { if (['hora', 'min', 'act', 'nombre'].includes(inp.dataset.f)) redrawRoutine(); };
  });
}
function readName() { if ($('onbName')) d.name = $('onbName').value.trim(); }
function addHabit(h, openIt = false) {
  d.habits.push({ dias: [...ALL], motivo: '', ...h });
  if (openIt) d.open = d.habits.length - 1;
}
function finish() {
  readName();
  saveCfg({ name: d.name || 'Player 1', avatar: d.look, onboarded: true, since: cfg.since || todayIso() });
  const keep = new Set();
  d.habits.filter(h => h.nombre.trim()).forEach(h => {
    const it = H.save({ nombre: h.nombre.trim(), emoji: h.emoji || '⭐', min: h.min, hora: h.hora || '08:00', dias: h.dias?.length ? h.dias : [...ALL], motivo: h.motivo || '', act: h.act || H.guessAct(h.nombre, h.emoji), ...(h.tipo === 'conteo' ? { tipo: 'conteo', meta: h.meta || 1, unidad: h.unidad || 'veces', pausa: h.pausa ?? 15 } : {}) }, h.id || null);
    keep.add(it.id);
  });
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

document.addEventListener('submit', e => {
  if ($('onb').hidden || !e.target.matches('.own')) return;
  e.preventDefault();
  const n = $('ownIn').value.trim(); if (!n) return $('ownIn').focus();
  addHabit({ emoji: H.guessEmoji(n), nombre: n, min: 15, hora: '08:00', act: H.guessAct(n) }, true);
  $('ownIn').value = ''; redrawRoutine(d.open);
});
document.addEventListener('click', e => {
  if ($('onb').hidden) return;
  const tab = e.target.closest('[data-avtab]');
  if (tab) { avTab = tab.dataset.avtab; $('onbEditor').innerHTML = editorHTML(d.look, avTab); return; }
  const av = e.target.closest('[data-av]');
  if (av) { d.look[av.dataset.av] = av.dataset.v; $('onbPrev').innerHTML = avatarSVG(d.look, 'av'); av.parentElement.querySelectorAll('[data-av]').forEach(b => b.classList.toggle('on', b === av)); return; }
  const el = e.target.closest('[data-o]'); if (!el || el.tagName === 'FORM' || el.tagName === 'LABEL') return;
  e.preventDefault(); readName();
  const o = el.dataset.o; const i = +el.dataset.i; const h = d.habits[i];
  if (o === 'next') {
    if (STEPS[step][0] === 'habits' && !d.habits.length) return;
    if (step === STEPS.length - 1) return finish();
    step++; d.open = -1; return draw();
  }
  if (o === 'back') { step = Math.max(0, step - 1); return draw(); }
  if (o === 'close') { close(); return onDone?.({ first: false }); }
  if (o === 'demo') { close(); return onDone?.({ demo: true }); }
  if (o === 'cat') { cat = +el.dataset.k; document.querySelectorAll('.cat-tabs button').forEach((b, k) => b.classList.toggle('on', k === cat)); $('exGrid').innerHTML = exampleCards(); return; }
  if (o === 'ex') {
    const ex = H.EXAMPLES.find(x => x[1] === el.dataset.n); const k = picked(ex[1]);
    if (k >= 0) { d.habits.splice(k, 1); d.open = -1; } else addHabit({ emoji: ex[0], nombre: ex[1], min: ex[2], hora: ex[3], act: ex[4], ...(ex[5] || {}) });
    return redrawRoutine();
  }
  if (o === 'edit') { d.open = d.open === i ? -1 : i; return redrawRoutine(i); }
  if (o === 'done') { d.open = -1; return redrawRoutine(); }
  if (o === 'del') { d.habits.splice(i, 1); d.open = -1; return redrawRoutine(); }
  if (o === 'emoji') { h.emoji = el.dataset.v; h._emoji = true; if (!h._act) h.act = H.guessAct(h.nombre, h.emoji); return redrawRoutine(i); }
  if (o === 'hora') { h.hora = el.dataset.v; return redrawRoutine(i); }
  if (o === 'min') { h.min = +el.dataset.v; return redrawRoutine(i); }
  if (o === 'meta') { h.meta = +el.dataset.v; return redrawRoutine(i); }
  if (o === 'pausa') { h.pausa = +el.dataset.v; return redrawRoutine(i); }
  if (o === 'days') { h.dias = el.dataset.v.split(',').map(Number); return redrawRoutine(i); }
  if (o === 'day') { const k = +el.dataset.k; h.dias = h.dias.includes(k) ? h.dias.filter(x => x !== k) : [...h.dias, k].sort(); if (!h.dias.length) h.dias = [k]; return redrawRoutine(i); }
});
