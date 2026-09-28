/* IO — modo enfoque. Pantalla completa mientras corre el hábito.
 * El anillo se escribe en 1 y 0; el tiempo sigue contando aunque bloquees el celular.
 * Se puede pausar, no terminar antes: sin reloj completo no hay corona. */
import * as H from './habits.js';
import { cfg } from './store.js';
import { sceneHTML, runScene } from './scenes.js';
import * as Radio from './radio.js';
import * as Pet from './pet.js';
import * as W from './world.js';
import { blip } from './engine.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOTIVOS = [
  'Lo que haces hoy es el código de quien serás mañana. 1 &gt; 0.',
  'El tú del futuro te va a agradecer estos minutos.',
  'Disciplina es elegir entre lo que quieres ahora y lo que más quieres.',
  'El reloj no regala puntos: tú te los ganas.',
  'Terminar lo que empiezas es como se construye la confianza en ti.',
  'No tiene que ser perfecto. Solo tiene que estar hecho.',
  'Tu racha depende de este momento.',
  'Cada minuto completo es un piso más alto en tu edificio.',
];
/* ---------- coach: tu personaje te habla mientras corre el reloj ---------- */
const COACH = {
  all: ['Tú puedes. Un minuto a la vez.', 'Respira. Estás construyendo a quien quieres ser.', 'Nadie lo está haciendo por ti. Y lo estás haciendo.', 'Cada segundo cuenta: 1 > 0.', 'Tu personaje no se rinde. Tú tampoco.', 'Quédate. La corona te espera 👑', 'Esto es disciplina en tiempo real.', 'El tú de mañana ya te está aplaudiendo.', 'No pienses en terminar. Piensa en este minuto.'],
  read: ['Una página más. Solo una.', 'Cada libro te hace más grande por dentro.', 'Leer es entrenar la mente. Sigue.'],
  study: ['Lo que aprendes hoy nadie te lo quita.', 'Concéntrate en una cosa. Solo esa.', 'Tu cerebro está haciendo pesas ahora mismo.'],
  write: ['Escribe sin juzgar. Después se corrige.', 'Tus ideas merecen papel.', 'Una frase más. Ahí va saliendo.'],
  type: ['Trabajo profundo: sin notificaciones, sin afán.', 'Una tarea a la vez. Así se hacen las grandes.', 'Estás en la zona. Quédate ahí.'],
  talk: ['Equivocarse también es practicar.', 'Cada palabra nueva abre una puerta.', 'You got this! 💪'],
  float: ['Suelta los pensamientos. Vuelve a la respiración.', 'Aquí y ahora. Nada más.', 'La calma también se entrena.'],
  breathe: ['Inhala en 4… exhala en 4.', 'Deja que los hombros bajen.', 'Cada respiración te devuelve a ti.'],
  yoga: ['Estira sin forzar. Tu cuerpo te lo agradece.', 'Equilibrio por fuera, equilibrio por dentro.'],
  pray: ['Aquí no hay afán. Solo tú y Dios.', 'Agradece tres cosas de hoy.', 'Suelta lo que no controlas.', 'Habla con el corazón. Te escucha.'],
  unplug: ['El mundo puede esperar. Tú primero.', 'Sin pantalla, la vida se ve en alta definición.'],
  sleep: ['Descansar también es ganar.', 'Mañana te lo vas a agradecer.'],
  flex: ['¡Una rep más! ¡Vamos!', 'El dolor de hoy es la fuerza de mañana.', 'Aprieta, respira, sigue.', 'Tu cuerpo puede más de lo que crees.'],
  run: ['Paso a paso, kilómetro a kilómetro.', 'Mantén el ritmo. Respira por la nariz.', '¡Vas volando! 🏃'],
  walk: ['Mira el cielo. Esto también es vida.', 'Caminar aclara la mente.', 'Cada paso suma.'],
  dog: ['Tu perro está feliz. Tú también deberías 🐕', 'Paseo juntos: los dos ganan.', 'Huele las flores, como él.'],
  swim: ['Brazada larga, respiración tranquila.', 'Un largo más.'],
  eat: ['Mastica despacio. Saborea.', 'Comer sin pantalla también es un hábito.'],
  cook: ['Cocinar es cuidarte.', 'Huele delicioso desde aquí.'],
  clean: ['Espacio ordenado, mente ordenada.', 'Un rincón a la vez.'],
  music: ['Repite la parte difícil. Ahí se mejora.', 'Tus dedos están aprendiendo aunque no lo notes.'],
  draw: ['No tiene que ser perfecto. Tiene que ser tuyo.', 'Cada trazo cuenta.'],
};
/** Hitos: se dicen una sola vez y con más énfasis. */
function milestone(el, rem, dur, done) {
  const M = [
    ['start', el >= 8 && dur > 90, '¡Arrancamos! Lo más difícil ya lo hiciste: empezar. 💜'],
    ['m1', el >= 60 && dur > 150, '1 minuto ✓ Ya estás en ritmo.'],
    ['m5', el >= 300 && dur > 600, '5 minutos. Esto ya es un hábito en marcha 🔥'],
    ['p25', el / dur >= .25 && dur >= 240, '25% ✦ Un cuarto del camino. ¡Sigue así!'],
    ['p50', el / dur >= .5 && dur >= 120, '¡MITAD! 🔥 Ya vas de bajada.'],
    ['p75', el / dur >= .75 && dur >= 240, '75% · La corona ya se ve 👑'],
    ['last', rem <= 60 && dur >= 180, '¡Último minuto! Aguanta, ya casi.'],
  ];
  return M.find(([k, ok]) => ok && !done.has(k));
}
const fmt = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };
let F = { id: null, raf: 0, rainT: 0, wake: null, onClaim: null, onClose: null, flick: 0, scene: null, said: new Set(), lastSay: 0, act: 'jump' };

export function open(id, { onClaim, onClose } = {}) {
  const h = H.get(id); if (!h) return;
  F = { ...F, id, onClaim, onClose, said: new Set(), lastSay: 0 };
  if (!H.sess(id).done) { H.start(id); blip('start'); }
  const act = H.actOf(h);
  const fc = $('focus');
  const who = `${(cfg.name || 'Tu personaje').toUpperCase()} · ${(H.ACTS[act] || H.ACTS.jump)[1].toUpperCase()} CONTIGO`;
  fc.innerHTML = `
    <canvas class="fc-rain" id="fcRain" aria-hidden="true"></canvas>
    <div class="fgb">
      <div class="fgb-top"><span class="led on"></span><span class="fc-emoji">${esc(h.emoji)}</span><div><b>${esc(h.nombre)}</b><small id="fcSub"></small></div><button class="fgb-radio" id="fcRadio" aria-label="Radio" hidden>📻</button></div>
      <div class="fgb-bezel">
        <div class="fgb-screen">
          <div class="fc-clock" id="fcClock"><canvas id="fcRing" aria-hidden="true"></canvas>
            <div class="fc-center"><div class="fc-time" id="fcTime">--:--</div><div class="fc-bin" id="fcBin" title="Minutos restantes en binario"></div><div class="fc-pct" id="fcPct"></div></div></div>
          ${sceneHTML(act, cfg.avatar, W.game().wear, { big: true, pet: Pet.get() })}
        </div>
        <div class="bezel-label"><span class="bz-io">IO</span><em>1·0</em><span class="fgb-who">${esc(who)}</span></div>
      </div>
      <div class="fgb-lower">
        <div class="ghost-pad" aria-hidden="true"><i></i><i></i></div><div class="ghost-ab" aria-hidden="true"><i></i><i></i></div>
        <div class="fc-coach" id="fcMsg"><p id="fcCoachT">Quédate aquí. El reloj sigue contando aunque bloquees la pantalla.</p></div>
        <div class="fc-prize" id="fcPrize"></div>
        <div class="fc-actions"><button class="fc-pause" id="fcPause"><i></i>PAUSAR</button></div>
      </div>
    </div>
    <div class="fc-modal" id="fcModal" hidden></div>
    <div class="fc-done" id="fcDone" hidden></div>`;
  fc.hidden = false; document.body.style.overflow = 'hidden';
  $('fcPause').onclick = askPause;
  { // radio: desde el nivel 2
    const lvl = W.level(); const rb = $('fcRadio');
    if (lvl >= Radio.RADIO_LVL) {
      rb.hidden = false; F.radioMine = false;
      if (cfg.radioAuto && cfg.radio && !Radio.current()) { Radio.toggle(lvl); F.radioMine = true; }
      rb.classList.toggle('on', !!Radio.current());
      rb.onclick = () => { const st = Radio.next(lvl); F.radioMine = !!st; rb.classList.toggle('on', !!st); say(st ? `📻 ${st.e} ${st.n}` : '📻 Radio apagada'); F.lastSay = performance.now(); };
    }
  }
  const pv = H.preview(id); if (pv) $('fcPrize').innerHTML = `Al terminar: <span>👑</span><b>+${pv.xp} XP</b><i>+${pv.bits} ◆</i>${pv.onTime ? '<span>⏰ a tiempo</span>' : ''}`;
  F.act = act; F.scene = runScene(fc.querySelector('.fs'), act);
  { // al retomar, los hitos que ya pasaron no se repiten: solo se dice el último
    const dur = h.min * 60, el0 = H.elapsed(id); let m, last = null;
    while ((m = milestone(el0, dur - el0, dur, F.said))) { F.said.add(m[0]); last = m; }
    if (last && el0 > 20) { F.lastSay = performance.now(); setTimeout(() => say(`De vuelta 💜 ${last[2]}`, true), 300); }
  }
  wake(true); rain(); loop();
  document.addEventListener('visibilitychange', onVis);
}
function onVis() { if (document.visibilityState === 'visible' && F.id) { wake(true); } }
async function wake(on) {
  try {
    if (on && cfg.wake !== false && 'wakeLock' in navigator && !F.wake) { F.wake = await navigator.wakeLock.request('screen'); F.wake.addEventListener?.('release', () => { F.wake = null; }); }
    if (!on && F.wake) { await F.wake.release(); F.wake = null; }
  } catch { F.wake = null; }
}
export function close() {
  cancelAnimationFrame(F.raf); clearInterval(F.rainT); wake(false); OV = null;
  if (F.radioMine) { Radio.stop(); F.radioMine = false; }
  document.removeEventListener('visibilitychange', onVis);
  $('focus').hidden = true; $('focus').innerHTML = ''; $('focus').classList.remove('won'); document.body.style.overflow = '';
  F.id = null;
}

function loop() {
  const h = H.get(F.id); if (!h) return close();
  const dur = h.min * 60; const el = H.elapsed(F.id); const rem = dur - el; const p = Math.min(1, el / dur);
  $('fcTime').textContent = fmt(rem);
  const mins = Math.ceil(rem / 60);
  $('fcBin').textContent = `${mins.toString(2)} · ${mins} min`;
  $('fcPct').textContent = `${Math.floor(p * 100)}%`;
  const end = new Date(Date.now() + rem * 1000);
  $('fcSub').textContent = rem > 0 ? `${h.min} min · termina a las ${end.toTimeString().slice(0, 5)}` : '¡Completo!';
  drawRing(p);
  F.scene?.update(p, el);
  coach(el, rem, dur);
  if (rem <= 0) { H.checkDone(F.id); return showDone(h); }
  F.raf = requestAnimationFrame(loop);
}
function say(txt, hot = false, big = false) {
  const b = $('fcMsg'); const t = $('fcCoachT'); if (!b || t.textContent === txt) return;
  t.textContent = txt; b.classList.toggle('hot', hot); b.classList.toggle('count', big);
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
}
function coach(el, rem, dur) {
  const now = performance.now();
  if (rem <= 10 && rem > 0 && dur >= 30) { say(`${Math.ceil(rem)}`, true, true); if (F.tick !== Math.ceil(rem)) { F.tick = Math.ceil(rem); blip('menu'); } return; }
  const m = milestone(el, rem, dur, F.said);
  if (m) { F.said.add(m[0]); F.lastSay = now; say(m[2], true); if (m[0] !== 'start') { blip('coin'); try { navigator.vibrate?.(35); } catch { /* */ } } return; }
  if (now - F.lastSay > 26000 && el > 5) {
    F.lastSay = now; const pool = [...(COACH[F.act] || []), ...COACH.all]; F.ci = ((F.ci ?? Math.floor(Math.random() * pool.length)) + 1) % pool.length;
    say(pool[F.ci].replace('{n}', cfg.name || ''));
  }
}
/* reloj ovalado: los 1 y 0 recorren un óvalo a lo ancho de la pantalla */
let OV = null;
function ovalTable(a, b) {
  const M = 720, pts = []; let L = 0, px = 0, py = -b;
  for (let i = 0; i <= M; i++) { const t = -Math.PI / 2 + i / M * Math.PI * 2; const x = a * Math.cos(t), y = b * Math.sin(t); if (i) L += Math.hypot(x - px, y - py); pts.push([x, y, L, t]); px = x; py = y; }
  return { pts, L };
}
function ovalAt(f) {
  const { pts, L } = OV.tab; const target = f * L; let lo = 0, hi = pts.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (pts[m][2] < target) lo = m + 1; else hi = m; }
  const [x, y, , t] = pts[lo]; return [x, y, Math.atan2(OV.b * Math.cos(t), -OV.a * Math.sin(t))];
}
function drawRing(p) {
  const c = $('fcRing'); const box = $('fcClock'); if (!c || !box) return;
  const dpr = devicePixelRatio || 1; const W = box.clientWidth, Hh = box.clientHeight;
  if (!OV || OV.W !== W || OV.H !== Hh) {
    c.width = Math.round(W * dpr); c.height = Math.round(Hh * dpr); c.style.width = W + 'px'; c.style.height = Hh + 'px';
    const a = (W / 2 - 16) * dpr, b = (Hh / 2 - 12) * dpr; const fs = Math.max(10, Math.min(14, Hh * .08)) * dpr;
    OV = { W, H: Hh, a, b, fs, tab: ovalTable(a, b) }; OV.N = Math.floor(OV.tab.L / (fs * 1.05));
    OV.ia = a - fs * 1.2; OV.ib = b - fs * 1.2;
  }
  const x = c.getContext('2d'); const { a, b, fs, N } = OV;
  x.clearRect(0, 0, c.width, c.height); x.save(); x.translate(c.width / 2, c.height / 2);
  // pista y progreso por dentro del óvalo
  x.lineWidth = 2 * dpr; x.strokeStyle = 'rgba(167,139,250,.16)'; x.beginPath(); x.ellipse(0, 0, OV.ia, OV.ib, 0, 0, Math.PI * 2); x.stroke();
  const grad = x.createLinearGradient(-a, 0, a, 0); grad.addColorStop(0, '#a78bfa'); grad.addColorStop(.5, '#22d3ee'); grad.addColorStop(1, '#4ade80');
  x.strokeStyle = grad; x.lineWidth = 3.5 * dpr; x.lineCap = 'round'; x.beginPath();
  const steps = Math.max(2, Math.floor(p * 180));
  for (let i = 0; i <= steps; i++) { const f = p * i / steps; const [ox, oy] = ovalAt(f); const k = OV.ia / a; i ? x.lineTo(ox * k, oy * (OV.ib / b)) : x.moveTo(ox * k, oy * (OV.ib / b)); }
  if (p > 0) x.stroke();
  // los dígitos
  const filled = Math.floor(p * N); const now = performance.now();
  if (now - F.flick > 140) F.flick = now;
  x.font = `700 ${Math.round(fs)}px "Space Mono", ui-monospace, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const [ox, oy, ang] = ovalAt(i / N);
    x.save(); x.translate(ox, oy); x.rotate(ang);
    if (i < filled) { const t = i / N; x.fillStyle = `hsl(${258 - t * 110} 90% ${66 + 8 * Math.sin(now / 600 + i)}%)`; x.shadowColor = x.fillStyle; x.shadowBlur = 8 * dpr; x.fillText('1', 0, 0); }
    else if (i === filled && p < 1) { x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 12 * dpr; x.fillText(Math.floor(F.flick / 140) % 2 ? '1' : '0', 0, 0); }
    else { x.fillStyle = 'rgba(148,138,210,.24)'; x.shadowBlur = 0; x.fillText('0', 0, 0); }
    x.restore();
  }
  x.restore();
}
function rain() {
  const c = $('fcRain'); if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const dpr = devicePixelRatio || 1; c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const x = c.getContext('2d'); const fs = 16 * dpr; const cols = Math.ceil(c.width / fs);
  const y = Array.from({ length: cols }, () => Math.random() * c.height);
  const sp = Array.from({ length: cols }, () => .4 + Math.random() * .8);
  clearInterval(F.rainT);
  F.rainT = setInterval(() => {
    x.fillStyle = 'rgba(7,6,16,.2)'; x.fillRect(0, 0, c.width, c.height);
    x.font = `${fs}px "Space Mono", monospace`;
    y.forEach((v, i) => { x.fillStyle = i % 4 ? 'rgba(124,92,255,.35)' : 'rgba(34,211,238,.35)'; x.fillText(Math.random() > .5 ? '1' : '0', i * fs, v); y[i] = v > c.height + Math.random() * 3000 ? 0 : v + fs * sp[i] * .5; });
  }, 70);
}
function askPause() {
  const h = H.get(F.id); const dur = h.min * 60; const el = H.elapsed(F.id);
  const pick = [...MOTIVOS].sort(() => Math.random() - .5).slice(0, h.motivo ? 1 : 2);
  $('fcModal').innerHTML = `<div class="fc-card">
    <b>¿Pausar ${esc(h.nombre.toLowerCase())}?</b>
    <p>Llevas <strong>${fmt(el)}</strong> de ${fmt(dur)}. Si no lo completas, <strong>no ganas la corona</strong>: ni XP ni bits. Lo que llevas se guarda para cuando vuelvas.</p>
    <ul>${h.motivo ? `<li>💜 <em>Tu motivo:</em> ${esc(h.motivo)}</li>` : ''}${pick.map(m => `<li>✦ ${m}</li>`).join('')}</ul>
    <button class="fc-keep" id="fcKeep">Seguir 💪</button>
    <button class="fc-stop" id="fcStop">Pausar por ahora</button></div>`;
  $('fcModal').hidden = false; blip('error');
  $('fcKeep').onclick = () => { $('fcModal').hidden = true; blip('select'); };
  $('fcStop').onclick = () => { H.pause(); blip('back'); const cb = F.onClose; close(); cb?.(); };
}
function showDone(h) {
  cancelAnimationFrame(F.raf); drawRing(1); blip('done');
  const r = H.preview(F.id);
  const fs = document.querySelector('#focus .fs'); if (fs) fs.dataset.mood = 'excited'; $('focus').classList.add('won');
  try { navigator.vibrate?.([60, 40, 120]); } catch { /* */ }
  $('fcPause').hidden = true; say('¡Lo lograste! 👑 Activa tu corona.', true); $('fcPrize').innerHTML = '';
  $('fcDone').innerHTML = `<div class="fc-crown">👑</div><b>¡${esc(h.nombre)} completo!</b>
    <p>${h.min} ${h.min === 1 ? 'minuto' : 'minutos'} de verdad.${r?.onTime ? ' ⏰ ¡A tiempo! +25%' : ''}${r?.streak > 1 ? ` · 🔥 racha de ${r.streak}` : ''}</p>
    <button class="fc-claim" id="fcClaim">👑 Activar corona · +${r?.xp ?? 0} XP · +${r?.bits ?? 0} ◆</button>`;
  $('fcDone').hidden = false;
  $('fcClaim').onclick = () => { const id = F.id; const cb = F.onClaim; close(); cb?.(id); };
}
export const isOpen = () => !!F.id;
