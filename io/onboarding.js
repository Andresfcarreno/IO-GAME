/* IO — configuración inicial: antes del juego, defines qué significa "ir bien" en tu vida.
 * De aquí salen las misiones diarias: prioridades, finanzas, tu gente, salud/hábitos, metas y agenda. */
import * as S from './store.js';
import { cfg, saveCfg, todayIso } from './store.js';
import * as G from './game.js';
import { avatarSVG, editorHTML, normLook } from './avatar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PRIORITIES = [
  ['dinero', '💰', 'No gastar de más'], ['sueno', '😴', 'Dormir bien'], ['ejercicio', '🏋️', 'Moverme / hacer ejercicio'],
  ['gente', '💬', 'Ver y hablar con mi gente'], ['diario', '📝', 'Escribir y reflexionar'], ['proyectos', '🎯', 'Avanzar en mis metas'],
  ['agua', '💧', 'Tomar agua'], ['calma', '🧘', 'Estar tranquilo'],
];
const HABITS = [['📖', 'Leer 20 min'], ['🧘', 'Meditar 10 min'], ['🛏️', 'Tender la cama'], ['🥗', 'Comer sano'], ['📵', '1 hora sin pantalla'], ['🙏', 'Agradecer 3 cosas'], ['🚶', 'Caminar al aire libre'], ['🇬🇧', 'Practicar inglés']];
const GOAL_SUGG = [['🛟', 'Fondo de emergencia', 1500, '$', 'finanzas'], ['🚀', 'Lanzar AI Staff', 10, 'hitos', 'mente'], ['🏋️', 'Gym 12 sesiones al mes', 12, 'sesiones', 'salud'], ['📚', 'Leer 12 libros', 12, 'libros', 'mente'], ['✈️', 'Viaje a Colombia', 2000, '$', 'finanzas']];
const CATS = ['vivienda', 'suscripcion', 'salud', 'transporte', 'educacion', 'otros'];
const REL = ['familia', 'pareja', 'amigo', 'trabajo', 'mentor', 'otro'];
const TITLES = ['IO', 'Tú', 'Prioridades', 'Finanzas', 'Tu gente', 'Salud y hábitos', 'Metas', 'Agenda', 'Listo'];

let d, step, onDone, importICS;

function load() {
  const people = S.itemsOf('person').map(p => ({ ...p }));
  while (people.length < 3) people.push({ emoji: ['💜', '👩‍👦', '🤝'][people.length], nombre: '', relacion: ['pareja', 'familia', 'amigo'][people.length], cada: [2, 3, 7][people.length] });
  return {
    name: cfg.name, avatar: normLook(cfg.avatar),
    priorities: cfg.priorities?.length ? [...cfg.priorities] : ['dinero', 'sueno', 'ejercicio', 'gente', 'diario', 'proyectos'],
    ingreso: cfg.ingreso ?? '', presupuesto: cfg.presupuesto ?? 501,
    fijos: S.itemsOf('fijo').sort((a, b) => a.dia - b.dia).map(f => ({ ...f })),
    people,
    targets: { agua: 8, sueno: 7, ejercicio: 30, pasos: 8000, ...(cfg.targets || {}) },
    habits: S.itemsOf('habit').map(h => ({ ...h })),
    goals: S.itemsOf('goal').map(g => ({ ...g })),
    events: S.itemsOf('event').filter(e => e.fecha >= todayIso()).map(e => ({ ...e })),
    newEvents: [],
  };
}

export function openOnboarding(opts) {
  onDone = opts.onDone; importICS = opts.importICS;
  d = load(); step = 0;
  $('onb').hidden = false; document.body.style.overflow = 'hidden';
  draw();
}
function close() { $('onb').hidden = true; document.body.style.overflow = ''; }

function avatarPreview() {
  return `<div class="av-stage" data-mood="happy" id="onbPrev">${avatarSVG(d.avatar)}</div>`;
}
let rainT;
function binaryRain() {
  const c = $('ioRain'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = c.getContext('2d'); const W = c.width = c.offsetWidth * 2, H = c.height = c.offsetHeight * 2;
  const cols = Math.floor(W / 22); const y = Array.from({ length: cols }, () => Math.random() * H);
  cancelAnimationFrame(rainT);
  const tick = () => {
    if (!document.body.contains(c)) return;
    ctx.fillStyle = 'rgba(9,9,15,.18)'; ctx.fillRect(0, 0, W, H);
    ctx.font = '22px Space Mono, monospace';
    y.forEach((v, i) => { ctx.fillStyle = i % 3 ? '#7c5cff' : '#22d3ee'; ctx.fillText(Math.random() > .5 ? '1' : '0', i * 22, v); y[i] = v > H + Math.random() * 400 ? 0 : v + 14; });
    rainT = requestAnimationFrame(tick);
  };
  tick();
}
function rowsHTML(kind) {
  if (kind === 'fijos') return d.fijos.map((f, i) => `<div class="onb-row" data-row="fijos" data-i="${i}">
    <input class="inp" data-f="dia" type="number" min="1" max="31" value="${esc(f.dia)}" aria-label="Día del mes">
    <input class="inp" data-f="descripcion" value="${esc(f.descripcion)}" placeholder="Renta" aria-label="Descripción">
    <input class="inp" data-f="monto" type="number" step="0.01" inputmode="decimal" value="${esc(f.monto)}" placeholder="$" aria-label="Monto">
    <select class="sel inp" data-f="categoria" aria-label="Categoría">${CATS.map(c => `<option${c === f.categoria ? ' selected' : ''}>${c}</option>`).join('')}</select>
    <button class="x" data-onb="del" data-k="fijos" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('');
  if (kind === 'people') return d.people.map((p, i) => `<div class="onb-row" data-row="people" data-i="${i}">
    <input class="inp" data-f="emoji" value="${esc(p.emoji || '🙂')}" maxlength="4" aria-label="Emoji">
    <input class="inp" data-f="nombre" value="${esc(p.nombre)}" placeholder="${['Diana', 'Mamá', 'Juan'][i] || 'Nombre'}" aria-label="Nombre">
    <select class="sel inp" data-f="relacion" aria-label="Relación">${REL.map(r => `<option${r === p.relacion ? ' selected' : ''}>${r}</option>`).join('')}</select>
    <input class="inp" data-f="cada" type="number" min="1" value="${esc(p.cada || 7)}" aria-label="Cada cuántos días">
    <button class="x" data-onb="del" data-k="people" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('');
  if (kind === 'goals') return d.goals.map((g, i) => `<div class="onb-row" data-row="goals" data-i="${i}">
    <input class="inp" data-f="emoji" value="${esc(g.emoji || '🎯')}" maxlength="4" aria-label="Emoji">
    <input class="inp" data-f="nombre" value="${esc(g.nombre)}" placeholder="Mi meta" aria-label="Meta">
    <input class="inp" data-f="objetivo" type="number" value="${esc(g.objetivo)}" placeholder="Objetivo" aria-label="Objetivo">
    <input class="inp" data-f="unidad" value="${esc(g.unidad || '$')}" aria-label="Unidad">
    <button class="x" data-onb="del" data-k="goals" data-i="${i}" aria-label="Quitar">✕</button></div>`).join('');
  return '';
}
function stepper(k, lbl, sub, st, fmt) {
  return `<div class="onb-step"><b>${lbl}<small>${sub}</small></b><div class="stepper">
    <button data-onb="tgt" data-k="${k}" data-v="${-st}" aria-label="menos">−</button><span>${fmt(d.targets[k])}</span>
    <button data-onb="tgt" data-k="${k}" data-v="${st}" aria-label="más">+</button></div></div>`;
}

function body() {
  switch (step) {
    case 0: return `<div class="io-intro"><canvas id="ioRain" aria-hidden="true"></canvas>
      <div class="io-big"><span class="logo-flip"><span class="lf lf-a">IO</span><span class="lf lf-b">10</span></span><span class="logo-mirror" aria-hidden="true"><span>IO</span></span></div>
      <div class="io-def"><b>IO</b><span>se lee “yo”. Eres tú, reflejado como en un espejo.</span><b>1 0</b><span>uno y cero: el código con el que se escribe todo.</span><b>1</b><span>lo que haces · <b style="font-size:14px">0</b> lo que aún no.</span></div>
      <h1 class="onb-h" style="margin-top:8px">Tu vida es el juego.</h1>
      <p class="onb-p">No se juega tocando la pantalla: se juega viviendo. Cada día tendrás misiones de tu vida real. Cuando las cumples, tu personaje lo celebra, subes de nivel, tu edificio crece piso a piso y ganas monedas para la tienda.</p></div>`;
    case 1: return `<div class="onb-eyebrow">PLAYER 1 · CREA TU PERSONAJE</div>
      ${avatarPreview()}
      <div class="field" style="margin-top:14px"><label for="onbName">¿Cómo te llamas?</label><input class="inp" id="onbName" value="${esc(d.name)}" autocomplete="given-name" maxlength="24"></div>
      ${editorHTML(d.avatar)}`;
    case 2: return `<div class="onb-eyebrow">¿CÓMO SABES QUE VAS BIEN?</div>
      <h1 class="onb-h">¿Qué te dice que tu vida va bien?</h1>
      <p class="onb-p">Escoge lo que de verdad te importa. Con esto IO arma tus misiones diarias.</p>
      <div class="onb-chips">${PRIORITIES.map(([k, e, l]) => `<button class="onb-chip${d.priorities.includes(k) ? ' on' : ''}" data-onb="prio" data-k="${k}">${e} ${l}</button>`).join('')}</div>`;
    case 3: return `<div class="onb-eyebrow">PILAR 1 · FINANZAS</div>
      <h1 class="onb-h">Tu plata, sin estrés.</h1>
      <p class="onb-p">Con esto IO calcula cuánto puedes gastar al día y te avisa de los pagos fijos. Puedes cambiarlo cuando quieras.</p>
      <div class="row"><div class="field"><label for="onbIng">Ingreso mensual aprox.</label><input class="inp" id="onbIng" type="number" inputmode="decimal" value="${esc(d.ingreso)}" placeholder="2276"></div>
      <div class="field"><label for="onbPres">Presupuesto variable</label><input class="inp" id="onbPres" type="number" inputmode="decimal" value="${esc(d.presupuesto)}"></div></div>
      <div class="hint">El presupuesto variable es lo que gastas en comida, gasolina, salidas… sin contar los fijos.</div>
      <div class="lbl" style="margin:6px 0 8px">Pagos fijos del mes · día · descripción · monto</div>
      ${rowsHTML('fijos')}<button class="onb-add" data-onb="add" data-k="fijos">＋ Agregar pago fijo</button>`;
    case 4: return `<div class="onb-eyebrow">PILAR 2 · RELACIONES</div>
      <h1 class="onb-h">Tus 3 personas.</h1>
      <p class="onb-p">¿Con quiénes te juntas más o quieres estar más presente? Dile a IO cada cuántos días te gustaría hablar con cada una y te lo pondrá como misión.</p>
      <div class="lbl" style="margin-bottom:8px">Emoji · nombre · relación · cada (días)</div>
      ${rowsHTML('people')}${d.people.length < 6 ? '<button class="onb-add" data-onb="add" data-k="people">＋ Agregar persona</button>' : ''}`;
    case 5: return `<div class="onb-eyebrow">PILAR 3 · SALUD</div>
      <h1 class="onb-h">Tu cuerpo también juega.</h1>
      <p class="onb-p">Metas diarias y hábitos que quieres construir. Cada uno será una misión.</p>
      ${stepper('agua', '💧 Agua', 'vasos al día', 1, v => v)}
      ${stepper('sueno', '😴 Sueño', 'horas por noche', 0.5, v => v + 'h')}
      ${stepper('ejercicio', '🏋️ Movimiento', 'minutos al día', 5, v => v + ' min')}
      ${stepper('pasos', '👟 Pasos', 'por día', 1000, v => (v / 1000) + 'k')}
      <div class="lbl" style="margin:16px 0 8px">Hábitos diarios</div>
      <div class="onb-chips">${[...HABITS, ...d.habits.filter(h => !HABITS.some(x => x[1] === h.nombre)).map(h => [h.emoji, h.nombre])].map(([e, n]) => `<button class="onb-chip${d.habits.some(h => h.nombre === n) ? ' on' : ''}" data-onb="habit" data-e="${esc(e)}" data-n="${esc(n)}">${e} ${esc(n)}</button>`).join('')}</div>
      <div class="agenda-add" style="margin-top:0"><input id="onbHabit" placeholder="Otro hábito (ej. Estudiar 30 min)" maxlength="40"><button data-onb="habitAdd" aria-label="Agregar hábito">＋</button></div>`;
    case 6: return `<div class="onb-eyebrow">MISIONES GRANDES</div>
      <h1 class="onb-h">¿Hacia dónde vas?</h1>
      <p class="onb-p">Metas de semanas o meses. Cada aporte que hagas cuenta como misión y las metas cumplidas ponen un trofeo en tu casa.</p>
      <div class="onb-chips">${GOAL_SUGG.filter(s => !d.goals.some(g => g.nombre === s[1])).map((s, i) => `<button class="onb-chip" data-onb="goalSugg" data-i="${GOAL_SUGG.indexOf(s)}">${s[0]} ${s[1]}</button>`).join('')}</div>
      <div class="lbl" style="margin-bottom:8px">Emoji · meta · objetivo · unidad</div>
      ${rowsHTML('goals')}<button class="onb-add" data-onb="add" data-k="goals">＋ Agregar meta</button>`;
    case 7: return `<div class="onb-eyebrow">TU AGENDA</div>
      <h1 class="onb-h">Lo que tienes que hacer también cuenta.</h1>
      <p class="onb-p">Tus compromisos del día aparecen como misiones. Cumplir lo que te propusiste también sube de nivel.</p>
      <div class="agenda-add" style="margin-top:0"><input id="onbEvent" placeholder="Hoy: 3pm reunión con Juan" maxlength="120"><button data-onb="eventAdd" aria-label="Agregar">＋</button></div>
      <div style="margin:10px 0 16px">${[...d.events, ...d.newEvents].map(e => `<span class="day-chip">📅 ${esc(e.fecha === todayIso() ? 'hoy' : e.fecha)} ${esc(e.hora || '')} · ${esc(e.titulo)}</span>`).join('') || '<span class="hint">Aún no hay nada en tu agenda.</span>'}</div>
      <button class="btn-ghost" data-onb="ics">📅 Importar calendario (.ics)</button>
      <div class="hint" style="margin-top:10px">Desde Google Calendar: Configuración → Importar y exportar → Exportar, y subes el archivo .ics aquí. Se importan los eventos de los próximos 30 días.</div>`;
    case 8: {
      const n = { prio: d.priorities.length, people: d.people.filter(p => p.nombre.trim()).length, habits: d.habits.length, goals: d.goals.filter(g => g.nombre.trim()).length };
      return `<div class="onb-eyebrow">TODO LISTO</div>
      <h1 class="onb-h">${esc(d.name)}, tu partida está lista.</h1>
      <p class="onb-p">Cada mañana verás tus misiones debajo de la consola. Márcalas cuando las cumplas en la vida real.</p>
      ${avatarPreview()}
      <div class="onb-sum"><div><b>${n.prio}</b><span>prioridades</span></div><div><b>${n.people}</b><span>personas</span></div><div><b>${n.habits}</b><span>hábitos</span></div><div><b>${n.goals}</b><span>metas</span></div></div>
      <div class="hint">Recompensas: misiones diarias de 10 a 30 XP y monedas 🪙 · cofre diario al completarlas todas · cada nivel abre pisos nuevos en tu edificio: garaje (nivel 3), gimnasio (4), oficina (5)… hasta la azotea (15). Nada se compra con dinero.</div>`;
    }
  }
  return '';
}

function draw() {
  const first = !cfg.onboarded;
  $('onb').innerHTML = `
    <div class="onb-top"><div class="onb-steps">${TITLES.map((_, i) => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
      <button class="onb-skip" data-onb="skip">${first ? (S.isDemo() ? 'Ver demo' : 'Saltar') : 'Cerrar'}</button></div>
    <div class="onb-body" id="onbBody">${body()}</div>
    <div class="onb-foot">${step > 0 ? '<button class="btn-ghost" data-onb="back">← Atrás</button>' : ''}
      <button class="btn-acc${step === 8 ? ' btn-green' : ''}" data-onb="next">${step === 0 ? 'Crear mi personaje →' : step === 8 ? '🎮 Empezar a jugar' : 'Siguiente →'}</button></div>`;
  $('onbBody').scrollTop = 0;
  if (step === 0) binaryRain();
}

function readInputs() {
  if ($('onbName')) d.name = $('onbName').value.trim() || d.name;
  if ($('onbIng')) d.ingreso = parseFloat($('onbIng').value) || '';
  if ($('onbPres')) d.presupuesto = parseFloat($('onbPres').value) || d.presupuesto;
  document.querySelectorAll('#onb [data-row]').forEach(r => {
    const o = d[r.dataset.row][+r.dataset.i]; if (!o) return;
    r.querySelectorAll('[data-f]').forEach(inp => {
      const f = inp.dataset.f; o[f] = ['dia', 'monto', 'cada', 'objetivo'].includes(f) ? (parseFloat(inp.value) || '') : inp.value.trim();
    });
  });
}

export function parseAgenda(text) {
  const m = text.match(/\b(\d{1,2})(?:[:h.](\d{2}))?\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?(?=\s|$)/i);
  let hora = null, titulo = text.trim();
  if (m && (m[2] || m[3] || /^\d{1,2}$/.test(text.trim().split(/\s/)[0]))) {
    let h = +m[1]; const pm = /p/i.test(m[3] || ''), am = /a/i.test(m[3] || '');
    if (pm && h < 12) h += 12; if (am && h === 12) h = 0;
    if (h <= 23) { hora = `${String(h).padStart(2, '0')}:${m[2] || '00'}`; titulo = (text.slice(0, m.index) + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').replace(/^(a las|at)\s+/i, '').trim(); }
  }
  return { hora, titulo: titulo.replace(/^\w/, c => c.toUpperCase()) || 'Compromiso' };
}

function finish() {
  readInputs();
  const wasFirst = !cfg.onboarded;
  saveCfg({ name: d.name, avatar: d.avatar, priorities: d.priorities, ingreso: d.ingreso || null, presupuesto: d.presupuesto, targets: d.targets, onboarded: true });
  // fijos: reemplazar la lista
  const keepF = new Set();
  d.fijos.filter(f => f.descripcion && f.monto).forEach(f => {
    const it = S.putItem('fijo', { descripcion: f.descripcion, monto: +f.monto, dia: Math.min(31, Math.max(1, +f.dia || 1)), categoria: f.categoria || 'otros', match: f.match || f.descripcion.toLowerCase().split(' ')[0] }, f.id || null);
    keepF.add(it.id);
  });
  S.itemsOf('fijo').forEach(f => { if (!keepF.has(f.id)) S.delItem(f.id); });
  d.people.filter(p => p.nombre).forEach(p => S.putItem('person', { nombre: p.nombre, emoji: p.emoji || '🙂', relacion: p.relacion || 'otro', cada: +p.cada || 7, cumple: p.cumple || null }, p.id || null));
  const keepH = new Set();
  d.habits.forEach(h => { const it = S.putItem('habit', { nombre: h.nombre, emoji: h.emoji || '⭐', dias: h.dias || [0, 1, 2, 3, 4, 5, 6] }, h.id || null); keepH.add(it.id); });
  S.itemsOf('habit').forEach(h => { if (!keepH.has(h.id)) S.delItem(h.id); });
  d.goals.filter(g => g.nombre && g.objetivo).forEach(g => S.putItem('goal', { nombre: g.nombre, emoji: g.emoji || '🎯', objetivo: +g.objetivo, actual: +g.actual || 0, unidad: g.unidad || '$', pilar: g.pilar || 'mente', limite: g.limite || null, lastAporte: g.lastAporte || null }, g.id || null));
  d.newEvents.forEach(e => S.putItem('event', e));
  if (wasFirst) { const g = G.state(); if (!g.welcome) { g.coins += 100; g.welcome = true; G.save(g); } }

  $('onb').innerHTML = `<div class="onb-boot"><b>IO SYSTEM</b><span>CARGANDO TU VIDA…</span><span style="color:#fde68a">▶ PRESS START</span></div>`;
  setTimeout(() => { close(); onDone?.(wasFirst); }, 1400);
}

document.addEventListener('click', e => {
  const av = e.target.closest('[data-av]');
  if (av && !$('onb').hidden && !av.dataset.act) {
    d.avatar[av.dataset.av] = av.dataset.v;
    $('onbPrev').innerHTML = avatarSVG(d.avatar);
    av.parentElement.querySelectorAll('[data-av]').forEach(b => b.classList.toggle('on', b === av));
    return;
  }
  const el = e.target.closest('[data-onb]'); if (!el || $('onb').hidden) return;
  e.preventDefault();
  const a = el.dataset.onb;
  readInputs();
  if (a === 'next') { if (step === 8) return finish(); step++; return draw(); }
  if (a === 'back') { step = Math.max(0, step - 1); return draw(); }
  if (a === 'skip') { if (!cfg.onboarded) saveCfg({ onboarded: true }); close(); return onDone?.(false); }
  if (a === 'prio') { const k = el.dataset.k; d.priorities = d.priorities.includes(k) ? d.priorities.filter(x => x !== k) : [...d.priorities, k]; return draw(); }
  if (a === 'del') { d[el.dataset.k].splice(+el.dataset.i, 1); return draw(); }
  if (a === 'add') {
    if (el.dataset.k === 'fijos') d.fijos.push({ dia: 1, descripcion: '', monto: '', categoria: 'vivienda' });
    if (el.dataset.k === 'people') d.people.push({ emoji: '🙂', nombre: '', relacion: 'amigo', cada: 7 });
    if (el.dataset.k === 'goals') d.goals.push({ emoji: '🎯', nombre: '', objetivo: '', unidad: '$', actual: 0, pilar: 'mente' });
    return draw();
  }
  if (a === 'tgt') {
    const k = el.dataset.k, lim = { agua: [2, 16], sueno: [5, 10], ejercicio: [5, 180], pasos: [1000, 20000] }[k];
    d.targets[k] = Math.min(lim[1], Math.max(lim[0], Math.round((d.targets[k] + +el.dataset.v) * 10) / 10)); return draw();
  }
  if (a === 'habit') { const n = el.dataset.n; d.habits = d.habits.some(h => h.nombre === n) ? d.habits.filter(h => h.nombre !== n) : [...d.habits, { emoji: el.dataset.e, nombre: n }]; return draw(); }
  if (a === 'habitAdd') { const v = $('onbHabit').value.trim(); if (v) d.habits.push({ emoji: '⭐', nombre: v }); return draw(); }
  if (a === 'goalSugg') { const s = GOAL_SUGG[+el.dataset.i]; d.goals.push({ emoji: s[0], nombre: s[1], objetivo: s[2], unidad: s[3], pilar: s[4], actual: 0 }); return draw(); }
  if (a === 'eventAdd') { const v = $('onbEvent').value.trim(); if (v) d.newEvents.push({ fecha: todayIso(), ...parseAgenda(v) }); return draw(); }
  if (a === 'ics') { importICS?.(n => { d = { ...d, events: S.itemsOf('event').filter(x => x.fecha >= todayIso()) }; draw(); return n; }); }
});
