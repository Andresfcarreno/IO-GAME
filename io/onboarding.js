/* IO — configuración inicial al estilo Duolingo/Finch: una pregunta por pantalla, la mascota IO
 * te habla, y en 2 minutos tienes personaje, hábitos con horario, meta de racha y tu cuenta.
 * Sin demo ni datos falsos: todo lo que ves es tuyo. */
import { cfg, saveCfg, todayIso, putItem, getItem, sync } from './store.js';
import * as H from './habits.js';
import { avatarSVG, editorHTML, normLook, PRESETS } from './avatar.js';
import { sceneHTML } from './scenes.js';
import * as Auth from './auth.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = ['hola', 'nombre', 'look', 'areas', 'habitos', 'rutina', 'compromiso', 'cuenta', 'listo'];
const ALL = [0, 1, 2, 3, 4, 5, 6], WEEK = [1, 2, 3, 4, 5], WKND = [0, 6];
const MOMENTS = [['🌅', 'Mañana', '06:30'], ['☀️', 'Mediodía', '12:30'], ['🌇', 'Tarde', '18:00'], ['🌙', 'Noche', '21:00']];
const MINS = [1, 5, 10, 15, 20, 30, 45, 60];
const EMOJIS = ['⭐', '📖', '🧘', '🏃', '🏋️', '🚶', '🐕', '🥗', '💧', '🇬🇧', '💻', '🎓', '🎸', '🎨', '✍️', '🧹', '🍳', '🙏', '😴', '📵', '🤸', '🏊', '🧠', '🌱'];
const AREAS = [['Mente', '🧠', 'Leer, meditar, escribir, desconectarte'], ['Cuerpo', '💪', 'Moverte, entrenar, comer mejor'], ['Crecer', '🚀', 'Estudiar, idiomas, trabajo, arte'], ['Casa y calma', '🏠', 'Orden, cocina, agua, descanso']];
const GOALS = [[3, 'Casual', 'para arrancar con calma'], [7, 'Serio', 'una semana entera'], [14, 'Intenso', 'dos semanas sin fallar'], [30, 'Leyenda', 'un mes: ya es parte de ti']];
const K_DRAFT = 'io.onbDraft';
let d, step, onDone, avTab = 'cuerpo', rainT, custom = false, mail = { sent: false, email: '' };

export function openOnboarding(opts) {
  onDone = opts.onDone;
  const existing = H.list();
  d = { name: cfg.name || '', look: normLook(cfg.avatar || PRESETS[0]), areas: [], habits: existing.map(h => ({ ...h, dias: h.dias?.length ? h.dias : [...ALL], act: H.actOf(h) })), open: -1, goal: cfg.goalDays || 7, returning: false };
  step = opts.step ?? 0;
  try { const dr = JSON.parse(localStorage.getItem(K_DRAFT) || 'null'); if (dr) { d = { ...d, ...dr.d }; step = dr.step; localStorage.removeItem(K_DRAFT); } } catch { /* */ }
  $('onb').hidden = false; document.body.style.overflow = 'hidden';
  draw();
}
const at = k => STEPS.indexOf(k);
const go = k => { step = at(k); d.open = -1; draw(); };
/** La mascota IO: un Game Boy con carita que te habla. */
const mascot = (txt, mood = '') => `<div class="masc ${mood}"><div class="masc-gb" aria-hidden="true"><i class="masc-scr"><b></b><b></b><em></em></i><span></span></div><div class="bubble">${txt}</div></div>`;
function close() { cancelAnimationFrame(rainT); $('onb').hidden = true; document.body.style.overflow = ''; }

/* ---------- utilidades de la rutina ---------- */
const sameDays = (a, b) => a.length === b.length && a.every(x => b.includes(x));
const daysLabel = dias => sameDays(dias, ALL) ? 'todos los días' : sameDays(dias, WEEK) ? 'lunes a viernes' : sameDays(dias, WKND) ? 'fines de semana' : dias.map(k => H.DAYS[k]).join(' ');
const fmtMin = m => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}` : `${m} min`);
const picked = n => d.habits.findIndex(x => x.nombre === n);

function exampleCards() {
  const cats = H.CATEGORIES.filter(([, n]) => !d.areas.length || d.areas.includes(n));
  return cats.map(([ce, cn, list]) => `<div class="ex-cat">${ce} ${cn}</div>` + list.map(([e, n, m, h, , cf]) => {
    const on = picked(n) >= 0;
    return `<button class="ex-card${on ? ' on' : ''}" data-o="ex" data-n="${esc(n)}" aria-pressed="${on}">
      <span class="ex-e">${e}</span><b>${esc(n)}</b><small>${cf?.tipo === 'conteo' ? `${cf.meta} ${cf.unidad}` : fmtMin(m)} · ${h}</small><i>${on ? '✓' : '＋'}</i></button>`;
  }).join('')).join('');
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
  const n = esc(d.name || 'jugador');
  switch (STEPS[step]) {
    case 'hola': return `<div class="onb-hero"><canvas id="ioRain" aria-hidden="true"></canvas>
      ${mascot('¡Hola! Soy <b>IO</b>. Aquí <b>tu vida es el juego</b>: cumples hábitos de verdad con un reloj, ganas coronas 👑 y construyes tu edificio piso por piso.', 'big')}
      <div class="how"><div><i>⏱</i><b>Haces tu hábito</b><small>con reloj de verdad</small></div><div><i>👑</i><b>Ganas la corona</b><small>XP y bits</small></div><div><i>🏢</i><b>Subes de piso</b><small>y decoras tu mundo</small></div></div></div>`;
    case 'nombre': return `${mascot('¿Cómo te llamas? Así te van a ver en el ranking.')}
      <input class="inp big" id="onbName" value="${esc(d.name)}" autocomplete="given-name" maxlength="20" placeholder="Tu nombre">`;
    case 'look': return `${mascot(`¡Mucho gusto, ${n}! Elige cómo te ves. Luego lo cambias cuando quieras.`)}
      <div class="presets">${PRESETS.map((p, i) => `<button class="pre${JSON.stringify(p) === JSON.stringify(d.look) ? ' on' : ''}" data-o="preset" data-k="${i}" aria-label="Apariencia ${i + 1}" data-mood="happy">${avatarSVG(p, 'av', '14 0 92 110')}</button>`).join('')}</div>
      <button class="onb-add" data-o="custom">${custom ? '▲ Ocultar opciones' : '✏️ Personalizar piel, pelo, ojos y ropa'}</button>
      ${custom ? `<div class="av-stage" data-mood="happy" id="onbPrev">${avatarSVG(d.look, 'av')}</div><div id="onbEditor">${editorHTML(d.look, avTab)}</div>` : ''}`;
    case 'areas': return `${mascot('¿Qué quieres mejorar? Elige una o varias.')}
      <div class="areas">${AREAS.map(([a, e, t]) => `<button class="area${d.areas.includes(a) ? ' on' : ''}" data-o="area" data-v="${a}" aria-pressed="${d.areas.includes(a)}"><span>${e}</span><b>${a}</b><small>${t}</small><i>${d.areas.includes(a) ? '✓' : ''}</i></button>`).join('')}</div>`;
    case 'habitos': return `${mascot('Estos van con lo que elegiste. Empieza con <b>2 o 3</b>: lo pequeño que se cumple gana.')}
      <form class="own" data-o="own"><input class="inp" id="ownIn" maxlength="40" placeholder="＋ Escribe el tuyo: “sacar al perro”…" autocomplete="off"><button class="btn-acc" type="submit">Agregar</button></form>
      <div class="ex-grid" id="exGrid">${exampleCards()}</div>
      <div id="onbRoutine" hidden></div>`;
    case 'rutina': return `${mascot('¿Cuándo los harás? Toca cada uno para cambiar la hora, los minutos o los días.')}
      <div id="onbRoutine">${routine()}</div><div id="exGrid" hidden></div>`;
    case 'compromiso': return `${mascot('¿Cuál es tu meta de racha? Días seguidos cumpliendo al menos un hábito.')}
      <div class="goals">${GOALS.map(([g, t, s2]) => `<button class="goal${d.goal === g ? ' on' : ''}" data-o="goal" data-v="${g}"><b>${g} días</b><span>${t}</span><small>${s2}</small><i>🔥</i></button>`).join('')}</div>`;
    case 'cuenta': return accountStep();
    case 'listo': return `${mascot(`¡Listo, ${n}! Tu partida empieza en el <b>piso 1</b>. Estas son las reglas:`, 'party')}
      <div class="av-stage" data-mood="excited">${avatarSVG(d.look, 'av')}</div>
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
function accountStep() {
  const u = Auth.user();
  if (!Auth.configured()) return `${mascot('Muy pronto podrás guardar tu partida en la nube con Google o tu correo. Por ahora queda guardada en este celular.')}`;
  if (u) return `${mascot(`¡Listo! Tu partida queda guardada como <b>${esc(u.email || u.name)}</b>.`, 'party')}`;
  return `${mascot(d.returning ? '¡Qué bueno verte! Entra con tu cuenta y traigo tu partida.' : 'Guarda tu partida para no perderla nunca y aparecer en el ranking con tu nombre.')}
    <div class="login">
      <button class="btn-google" data-o="google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuar con Google</button>
      <div class="or"><span>o con tu correo</span></div>
      ${!mail.sent ? `<input class="inp" id="obEmail" type="email" autocomplete="email" placeholder="tu@correo.com" value="${esc(mail.email)}"><button class="btn-ghost" data-o="sendcode">Enviarme un código</button>`
        : `<p class="note">Te enviamos un código de 6 dígitos a <b>${esc(mail.email)}</b>. Revisa también spam.</p><input class="inp code" id="obCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"><button class="btn-acc" data-o="verify">Entrar</button><button class="onb-add" data-o="resend">Usar otro correo</button>`}
      <p class="note small" id="obErr"></p></div>`;
}
function draw() {
  const k = STEPS[step]; const last = k === 'listo';
  const blocked = (k === 'areas' && !d.areas.length) || ((k === 'habitos' || k === 'rutina') && !d.habits.length) || (k === 'nombre' && !d.name.trim()) || (k === 'cuenta' && Auth.configured() && !Auth.signedIn());
  $('onb').innerHTML = `
    <div class="onb-top">${step > 0 && !(k === 'cuenta' && d.returning) ? '<button class="onb-back" data-o="back" aria-label="Atrás">←</button>' : d.returning ? '<button class="onb-back" data-o="home" aria-label="Atrás">←</button>' : ''}
      <div class="onb-prog" aria-hidden="true"><i style="width:${Math.round(step / (STEPS.length - 1) * 100)}%"></i></div>
      ${cfg.onboarded ? '<button class="onb-skip" data-o="close">Cerrar</button>' : ''}</div>
    <div class="onb-body" id="onbBody">${body()}</div>
    <div class="onb-foot">
      ${k === 'hola' ? `<button class="btn-acc btn-green big" data-o="next">EMPEZAR</button>${Auth.configured() ? '<button class="btn-ghost" data-o="returning">YA TENGO CUENTA</button>' : ''}`
        : k === 'cuenta' && blocked ? '' : `<button class="btn-acc big${last ? ' btn-green' : ''}${blocked ? ' off' : ''}" data-o="next" id="onbNext">${nextLabel()}</button>`}</div>`;
  $('onbBody').scrollTop = 0;
  if (k === 'hola') binaryRain();
  if (k === 'nombre') { const i = $('onbName'); i.focus(); i.oninput = () => { d.name = i.value; $('onbNext').classList.toggle('off', !i.value.trim()); }; i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); next(); } }; }
  if (k === 'rutina') wireInputs();
  if (k === 'cuenta') { const e = $('obEmail'); if (e) e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('onb').querySelector('[data-o="sendcode"]').click(); } }; }
}
const nextLabel = () => { const k = STEPS[step]; return k === 'habitos' ? (d.habits.length ? `CONTINUAR · ${d.habits.length} hábito${d.habits.length > 1 ? 's' : ''}` : 'ELIGE AL MENOS UNO') : k === 'areas' && !d.areas.length ? 'ELIGE AL MENOS UNA' : k === 'compromiso' ? `ME COMPROMETO · ${d.goal} DÍAS 🔥` : k === 'listo' ? '▶ PRESS START' : 'CONTINUAR'; };
function next() {
  const k = STEPS[step];
  if (k === 'nombre' && !d.name.trim()) return;
  if (k === 'areas' && !d.areas.length) return;
  if ((k === 'habitos' || k === 'rutina') && !d.habits.length) return;
  if (k === 'cuenta' && Auth.configured() && !Auth.signedIn()) return;
  if (k === 'listo') return finish();
  if (k === 'areas' && !d.habits.length) seedSuggestions();
  step++; d.open = -1; draw();
}
/** Primer hábito de cada área elegida, ya marcado: el jugador solo ajusta. */
function seedSuggestions() {
  H.CATEGORIES.filter(([, n]) => d.areas.includes(n)).forEach(([, , list]) => { const ex = list[0]; if (picked(ex[1]) < 0 && d.habits.length < 3) addHabit({ emoji: ex[0], nombre: ex[1], min: ex[2], hora: ex[3], act: ex[4], ...(ex[5] || {}) }); });
}
/** Redibuja solo la rutina (sin perder el scroll). */
function redrawRoutine(scrollTo = -1) {
  if ($('onbRoutine')) $('onbRoutine').innerHTML = routine(); if ($('exGrid')) $('exGrid').innerHTML = exampleCards(); if ($('onbNext')) { $('onbNext').textContent = nextLabel(); $('onbNext').classList.toggle('off', !d.habits.length); }
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
  saveCfg({ name: (d.name || 'Jugador').trim().slice(0, 20), avatar: d.look, onboarded: true, since: cfg.since || todayIso(), goalDays: d.goal, rankOn: cfg.rankOn !== false });
  const keep = new Set();
  d.habits.filter(h => h.nombre.trim()).forEach(h => {
    const it = H.save({ nombre: h.nombre.trim(), emoji: h.emoji || '⭐', min: h.min, hora: h.hora || '08:00', dias: h.dias?.length ? h.dias : [...ALL], motivo: h.motivo || '', act: h.act || H.guessAct(h.nombre, h.emoji), ...(h.tipo === 'conteo' ? { tipo: 'conteo', meta: h.meta || 1, unidad: h.unidad || 'veces', pausa: h.pausa ?? 15 } : {}) }, h.id || null);
    keep.add(it.id);
  });
  H.list().forEach(h => { if (!keep.has(h.id)) H.remove(h.id); });
  putItem('profile', { name: cfg.name, avatar: cfg.avatar, since: cfg.since, goalDays: cfg.goalDays }, 'io:profile');
  $('onb').innerHTML = `<div class="onb-boot"><b>IO SYSTEM</b><span>01001001 01001111</span><span class="blink">▶ PRESS START</span></div>`;
  setTimeout(() => { close(); onDone?.({ first: true }); }, 1500);
}
/** Al entrar con cuenta: si ya tenías partida en la nube, la traigo y sigues jugando. */
async function onLogin() {
  await sync();
  const prof = getItem('io:profile');
  if (d.returning && prof && getItem('io:game')) {
    saveCfg({ name: prof.name || cfg.name, avatar: prof.avatar || cfg.avatar, since: prof.since, goalDays: prof.goalDays, onboarded: true });
    $('onb').innerHTML = `<div class="onb-boot"><b>¡DE VUELTA!</b><span>Tu partida está aquí</span><span class="blink">▶ PRESS START</span></div>`;
    return setTimeout(() => { close(); onDone?.({ first: false, restored: true }); }, 1400);
  }
  if (d.returning) { d.returning = false; step = at('nombre'); if (!d.name && Auth.user()?.name) d.name = Auth.user().name.split(' ')[0]; return draw(); }
  draw(); setTimeout(next, 900);
}
window.addEventListener('io:login', () => { if (!$('onb').hidden) onLogin(); });
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
  if ($('exGrid') && !$('exGrid').hidden) $('exGrid').insertAdjacentHTML('afterbegin', `<div class="ex-cat">✨ Agregado: ${esc(n)} · lo ajustas en el siguiente paso</div>`);
});
document.addEventListener('click', async e => {
  if ($('onb').hidden) return;
  const tab = e.target.closest('[data-avtab]');
  if (tab) { avTab = tab.dataset.avtab; $('onbEditor').innerHTML = editorHTML(d.look, avTab); return; }
  const av = e.target.closest('[data-av]');
  if (av) { d.look[av.dataset.av] = av.dataset.v; $('onbPrev').innerHTML = avatarSVG(d.look, 'av'); av.parentElement.querySelectorAll('[data-av]').forEach(b => b.classList.toggle('on', b === av)); document.querySelectorAll('.pre.on').forEach(p => p.classList.remove('on')); return; }
  const el = e.target.closest('[data-o]'); if (!el || el.tagName === 'FORM' || el.tagName === 'LABEL') return;
  e.preventDefault(); readName();
  const o = el.dataset.o; const i = +el.dataset.i; const h = d.habits[i];
  const err = m => { const x = $('obErr'); if (x) x.textContent = m; };
  if (o === 'next') return next();
  if (o === 'back') { step = Math.max(0, step - 1); d.open = -1; return draw(); }
  if (o === 'home') { d.returning = false; return go('hola'); }
  if (o === 'returning') { d.returning = true; return go('cuenta'); }
  if (o === 'close') { close(); return onDone?.({ first: false }); }
  if (o === 'preset') { d.look = normLook(PRESETS[+el.dataset.k]); document.querySelectorAll('.pre').forEach(p => p.classList.toggle('on', p === el)); if (custom) { $('onbPrev').innerHTML = avatarSVG(d.look, 'av'); $('onbEditor').innerHTML = editorHTML(d.look, avTab); } return; }
  if (o === 'custom') { custom = !custom; return draw(); }
  if (o === 'area') { const v = el.dataset.v; d.areas = d.areas.includes(v) ? d.areas.filter(x => x !== v) : [...d.areas, v]; return draw(); }
  if (o === 'goal') { d.goal = +el.dataset.v; return draw(); }
  if (o === 'google') { try { localStorage.setItem(K_DRAFT, JSON.stringify({ d, step })); Auth.google(); } catch (x) { err(x.message); } return; }
  if (o === 'sendcode') { const em = ($('obEmail')?.value || '').trim(); if (!/^\S+@\S+\.\S+$/.test(em)) return err('Escribe un correo válido.'); el.disabled = true; try { await Auth.sendCode(em); mail = { sent: true, email: em }; draw(); $('obCode')?.focus(); } catch (x) { err(x.message); el.disabled = false; } return; }
  if (o === 'resend') { mail = { sent: false, email: mail.email }; return draw(); }
  if (o === 'verify') { el.disabled = true; try { await Auth.verifyCode(mail.email, $('obCode').value); mail = { sent: false, email: '' }; await onLogin(); } catch (x) { err(x.message); el.disabled = false; } return; }
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
