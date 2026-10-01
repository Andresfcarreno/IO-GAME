/* IO — configuración inicial al estilo Duolingo/Finch: una pregunta por pantalla, la mascota IO
 * te habla, y en 2 minutos tienes personaje, hábitos con horario, meta de racha y tu cuenta.
 * Sin demo ni datos falsos: todo lo que ves es tuyo. */
import { cfg, saveCfg, todayIso, putItem, getItem, sync, importCode } from './store.js';
import * as H from './habits.js';
import * as HF from './habform.js';
import { avatarSVG, editorHTML, normLook, PRESETS } from './avatar.js';
import { sceneHTML } from './scenes.js';
import * as Auth from './auth.js';
import * as I18N from './i18n.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STEPS = ['hola', 'nombre', 'look', 'habitos', 'compromiso', 'cuenta', 'listo'];
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

const named = () => d.habits.filter(h => (h.nombre || '').trim()).length;
function slotsHTML() {
  if (!d.habits.length) d.habits.push({ ...HF.blank() });
  return d.habits.map((h, i) => `<div class="hslot" data-i="${i}"><div class="hslot-h"><b>Hábito ${i + 1}${i ? ' <em>opcional</em>' : ''}</b>${d.habits.length > 1 ? `<button class="hc-x" data-o="delslot" data-i="${i}" aria-label="Quitar">✕</button>` : ''}</div>${HF.formHTML(h, { examples: !(h.nombre || '').trim() })}</div>`).join('');
}
function mountSlots() {
  document.querySelectorAll('#hbSlots .hslot').forEach(el => {
    const i = +el.dataset.i;
    HF.mount(el, d.habits[i], v => {
      if (!v) return; Object.assign(d.habits[i], v);
      if ($('onbNext')) { $('onbNext').textContent = nextLabel(); $('onbNext').classList.toggle('off', !named()); }
      if ($('addSlot')) $('addSlot').hidden = !named();
    });
  });
}
function body() {
  const n = esc(d.name || 'jugador');
  switch (STEPS[step]) {
    case 'hola': return `<div class="onb-hero"><canvas id="ioRain" aria-hidden="true"></canvas>
      ${mascot('¡Hola! Soy <b>IO</b>. Aquí <b>tu vida es el juego</b>: cumples hábitos de verdad con un reloj, ganas coronas 👑 y construyes tu edificio piso por piso.', 'big')}
      <div class="how"><div><i>⏱</i><b>Haces tu hábito</b><small>con reloj de verdad</small></div><div><i>👑</i><b>Ganas la corona</b><small>XP y bits</small></div><div><i>🏢</i><b>Subes de piso</b><small>y decoras tu mundo</small></div></div>
      ${d.code ? `<div class="code-in"><p class="note">Pega el código que copiaste en ⚙️ Ajustes → “Copiar el código de mi partida”.</p><textarea class="inp" id="obPaste" rows="3" placeholder="IO1:…" autocomplete="off" spellcheck="false"></textarea><button class="btn-acc" data-o="loadCode">⬇️ Cargar mi partida</button><p class="note small" id="obCodeErr"></p></div>` : ''}</div>`;
    case 'nombre': return `${mascot('¿Cómo te llamas? Así te van a ver en el ranking.')}
      <input class="inp big" id="onbName" value="${esc(d.name)}" autocomplete="given-name" maxlength="20" placeholder="Tu nombre">`;
    case 'look': return `${mascot(`¡Mucho gusto, ${n}! Elige cómo te ves. Luego lo cambias cuando quieras.`)}
      <div class="presets">${PRESETS.map((p, i) => `<button class="pre${JSON.stringify(p) === JSON.stringify(d.look) ? ' on' : ''}" data-o="preset" data-k="${i}" aria-label="Apariencia ${i + 1}" data-mood="happy">${avatarSVG(p, 'av', '14 0 92 110')}</button>`).join('')}</div>
      <button class="onb-add" data-o="custom">${custom ? '▲ Ocultar opciones' : '✏️ Personalizar piel, pelo, ojos y ropa'}</button>
      ${custom ? `<div class="av-stage" data-mood="happy" id="onbPrev">${avatarSVG(d.look, 'av')}</div><div id="onbEditor">${editorHTML(d.look, avTab)}</div>` : ''}`;
    case 'habitos': return `${mascot('Escribe los hábitos de tu día, <b>desde que despiertas hasta que duermes</b>. Si les pones hora, te avisamos.')}
      <div id="hbSlots">${slotsHTML()}</div>
      <button class="onb-add" data-o="addslot" id="addSlot"${named() ? '' : ' hidden'}>＋ Otro hábito</button>
      <p class="hint center">Entre más hábitos tengas, más rápido subes de nivel. Puedes empezar con uno y agregar más después.</p>`;
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
  return `${mascot(d.imported ? `¡Listo, ${esc(cfg.name || 'jugador')}! Tu partida ya está aquí. Entra con tu cuenta para guardarla en la nube y aparecer en el ranking.` : d.returning ? '¡Qué bueno verte! Entra con tu cuenta y traigo tu partida.' : 'Guarda tu partida para no perderla nunca y aparecer en el ranking con tu nombre.')}
    <div class="login">
      <button class="btn-google" data-o="google"><svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continuar con Google</button>
      <div class="or"><span>o con tu correo</span></div>
      ${!mail.sent ? `<input class="inp" id="obEmail" type="email" autocomplete="email" placeholder="tu@correo.com" value="${esc(mail.email)}"><button class="btn-ghost" data-o="sendcode">Enviarme un código</button>`
        : `<p class="note">Te enviamos un código de 6 dígitos a <b>${esc(mail.email)}</b>. Revisa también spam.</p><input class="inp code" id="obCode" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="123456"><button class="btn-acc" data-o="verify">Entrar</button><button class="onb-add" data-o="resend">Usar otro correo</button>`}
      <p class="note small" id="obErr"></p></div>`;
}
function draw() {
  const k = STEPS[step]; const last = k === 'listo';
  const blocked = (k === 'habitos' && !named()) || (k === 'nombre' && !d.name.trim()) || (k === 'cuenta' && Auth.configured() && !Auth.signedIn());
  $('onb').innerHTML = `
    <div class="onb-top">${k === 'hola' ? `<button class="onb-lang" data-o="lang" translate="no">🌐 ${I18N.isEn ? 'Español' : 'English'}</button>` : ''}${step > 0 && !(k === 'cuenta' && d.returning) ? '<button class="onb-back" data-o="back" aria-label="Atrás">←</button>' : d.returning ? '<button class="onb-back" data-o="home" aria-label="Atrás">←</button>' : ''}
      <div class="onb-prog" aria-hidden="true"><i style="width:${Math.round(step / (STEPS.length - 1) * 100)}%"></i></div>
      ${cfg.onboarded ? '<button class="onb-skip" data-o="close">Cerrar</button>' : ''}</div>
    <div class="onb-body" id="onbBody">${body()}</div>
    <div class="onb-foot">
      ${k === 'hola' ? `<button class="btn-acc btn-green big" data-o="next">EMPEZAR</button>${Auth.configured() ? '<button class="btn-ghost" data-o="returning">YA TENGO CUENTA</button>' : ''}<button class="onb-add" data-o="haveCode">${d.code ? '▲ Ocultar' : '🔑 Tengo un código de partida'}</button>`
        : k === 'cuenta' && blocked ? '' : `<button class="btn-acc big${last ? ' btn-green' : ''}${blocked ? ' off' : ''}" data-o="next" id="onbNext">${nextLabel()}</button>`}</div>`;
  $('onbBody').scrollTop = 0;
  if (k === 'hola') binaryRain();
  if (k === 'nombre') { const i = $('onbName'); i.focus(); i.oninput = () => { d.name = i.value; $('onbNext').classList.toggle('off', !i.value.trim()); }; i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); next(); } }; }
  if (k === 'habitos') mountSlots();
  if (k === 'cuenta') { const e = $('obEmail'); if (e) e.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); $('onb').querySelector('[data-o="sendcode"]').click(); } }; }
}
const nextLabel = () => { const k = STEPS[step]; return k === 'habitos' ? (named() ? `CONTINUAR · ${named()} hábito${named() > 1 ? 's' : ''}` : 'ESCRIBE TU PRIMER HÁBITO') : k === 'compromiso' ? `ME COMPROMETO · ${d.goal} DÍAS 🔥` : k === 'listo' ? '▶ PRESS START' : 'CONTINUAR'; };
function next() {
  const k = STEPS[step];
  if (k === 'nombre' && !d.name.trim()) return;
  if (k === 'habitos') { if (!named()) return; d.habits = d.habits.filter(h => (h.nombre || '').trim()); }
  if (k === 'cuenta' && Auth.configured() && !Auth.signedIn()) return;
  if (k === 'listo') return finish();
  step++; d.open = -1; draw();
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
    const it = H.save({ nombre: h.nombre.trim(), emoji: h.emoji || '⭐', min: h.min, hora: h.hora || '', tipo: h.tipo || 'reloj', dias: h.dias?.length ? h.dias : [...ALL], motivo: h.motivo || '', act: h.act || H.guessAct(h.nombre, h.emoji), ...(h.tipo === 'conteo' ? { meta: h.meta || 1, unidad: h.unidad || 'veces', pausa: h.pausa ?? 15 } : {}) }, h.id || null);
    keep.add(it.id);
  });
  H.list().forEach(h => { if (!keep.has(h.id)) H.remove(h.id); });
  putItem('profile', { name: cfg.name, avatar: cfg.avatar, since: cfg.since, goalDays: cfg.goalDays }, 'io:profile');
  $('onb').innerHTML = `<div class="onb-boot"><b>IO GAME LIFE</b><span>01001001 01001111</span><span class="blink">▶ PRESS START</span></div>`;
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
  if (o === 'lang') return I18N.setLang(I18N.isEn ? 'es' : 'en');
  if (o === 'returning') { d.returning = true; return go('cuenta'); }
  if (o === 'haveCode') { d.code = !d.code; draw(); return $('obPaste')?.focus(); }
  if (o === 'loadCode') {
    try { importCode($('obPaste').value); } catch { $('obCodeErr').textContent = 'Ese código no es válido. Cópialo completo, empieza por IO1:'; return; }
    putItem('profile', { name: cfg.name, avatar: cfg.avatar, since: cfg.since, goalDays: cfg.goalDays }, 'io:profile');
    d.code = false; d.name = cfg.name; d.look = normLook(cfg.avatar);
    // Con servidor: entra con tu cuenta para subir la partida a la nube y al ranking.
    if (Auth.configured() && !Auth.signedIn()) { d.returning = true; d.imported = true; return go('cuenta'); }
    $('onb').innerHTML = `<div class="onb-boot"><b>¡PARTIDA CARGADA!</b><span>Seguimos donde ibas</span><span class="blink">▶ PRESS START</span></div>`;
    return setTimeout(() => { close(); onDone?.({ first: false, restored: true }); }, 1400);
  }
  if (o === 'close') { close(); return onDone?.({ first: false }); }
  if (o === 'preset') { d.look = normLook(PRESETS[+el.dataset.k]); document.querySelectorAll('.pre').forEach(p => p.classList.toggle('on', p === el)); if (custom) { $('onbPrev').innerHTML = avatarSVG(d.look, 'av'); $('onbEditor').innerHTML = editorHTML(d.look, avTab); } return; }
  if (o === 'custom') { custom = !custom; return draw(); }
  if (o === 'goal') { d.goal = +el.dataset.v; return draw(); }
  if (o === 'google') { try { localStorage.setItem(K_DRAFT, JSON.stringify({ d, step })); Auth.google(); } catch (x) { err(x.message); } return; }
  if (o === 'sendcode') { const em = ($('obEmail')?.value || '').trim(); if (!/^\S+@\S+\.\S+$/.test(em)) return err('Escribe un correo válido.'); el.disabled = true; try { await Auth.sendCode(em); mail = { sent: true, email: em }; draw(); $('obCode')?.focus(); } catch (x) { err(x.message); el.disabled = false; } return; }
  if (o === 'resend') { mail = { sent: false, email: mail.email }; return draw(); }
  if (o === 'verify') { el.disabled = true; try { await Auth.verifyCode(mail.email, $('obCode').value); mail = { sent: false, email: '' }; await onLogin(); } catch (x) { err(x.message); el.disabled = false; } return; }
  if (o === 'addslot') { d.habits.push({ ...HF.blank() }); draw(); return setTimeout(() => { const l = document.querySelector('.hslot:last-child'); l?.scrollIntoView({ behavior: 'smooth', block: 'start' }); l?.querySelector('[data-hf-in]')?.focus({ preventScroll: true }); }, 80); }
  if (o === 'delslot') { d.habits.splice(i, 1); if (!d.habits.length) d.habits.push({ ...HF.blank() }); return draw(); }
});
