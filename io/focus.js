/* IO — modo enfoque. Pantalla completa mientras corre el hábito.
 * El anillo se escribe en 1 y 0; el tiempo sigue contando aunque bloquees el celular.
 * Se puede pausar, no terminar antes: sin reloj completo no hay corona. */
import * as H from './habits.js';
import { cfg } from './store.js';
import { sceneHTML } from './scenes.js';
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
const CHEERS = ['Quédate aquí. El reloj sigue contando aunque bloquees la pantalla.', '25% ✦ Ya arrancaste, que es lo más difícil.', '50% ✦ Mitad del camino. Tu personaje sigue contigo.', '75% ✦ Recta final. La corona ya se ve.'];
const fmt = s => { s = Math.max(0, Math.ceil(s)); const m = Math.floor(s / 60), r = s % 60; return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`; };
let F = { id: null, raf: 0, rainT: 0, wake: null, onClaim: null, onClose: null, flick: 0 };

export function open(id, { onClaim, onClose } = {}) {
  const h = H.get(id); if (!h) return;
  F = { ...F, id, onClaim, onClose, stage: -1 };
  if (!H.sess(id).done) { H.start(id); blip('start'); }
  const act = H.actOf(h);
  const fc = $('focus');
  fc.innerHTML = `
    <canvas class="fc-rain" id="fcRain" aria-hidden="true"></canvas>
    <div class="fc-top"><span class="fc-emoji">${esc(h.emoji)}</span><div><b>${esc(h.nombre)}</b><small id="fcSub"></small></div></div>
    <div class="fc-ring"><canvas id="fcRing" aria-hidden="true"></canvas>
      <div class="fc-center"><div class="fc-time" id="fcTime">--:--</div><div class="fc-bin" id="fcBin" title="Minutos restantes en binario"></div><div class="fc-pct" id="fcPct"></div></div></div>
    <div class="fc-stage"><div class="fc-act">${esc((cfg.name || 'Tu personaje').toUpperCase())} · ${esc((H.ACTS[act] || H.ACTS.jump)[1].toUpperCase())} CONTIGO</div>${sceneHTML(act, cfg.avatar, W.game().wear)}</div>
    <p class="fc-msg" id="fcMsg">Quédate aquí. El reloj sigue contando aunque bloquees la pantalla.</p>
    <div class="fc-prize" id="fcPrize"></div>
    <div class="fc-actions"><button class="fc-pause" id="fcPause">⏸ Pausar</button></div>
    <div class="fc-modal" id="fcModal" hidden></div>
    <div class="fc-done" id="fcDone" hidden></div>`;
  fc.hidden = false; document.body.style.overflow = 'hidden';
  $('fcPause').onclick = askPause;
  const pv = H.preview(id); if (pv) $('fcPrize').innerHTML = `Al terminar: <span>👑</span><b>+${pv.xp} XP</b><i>+${pv.bits} ◆</i>${pv.onTime ? '<span>⏰ a tiempo</span>' : ''}`;
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
  cancelAnimationFrame(F.raf); clearInterval(F.rainT); wake(false);
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
  const st = Math.floor(p * 4); // 0..4: ánimos a 25, 50 y 75%
  if (st !== F.stage) { if (F.stage >= 0 && st > F.stage && st < 4) { blip('coin'); try { navigator.vibrate?.(30); } catch { /* */ } } F.stage = st; $('fcMsg').textContent = CHEERS[st] || ''; }
  if (rem <= 0) { H.checkDone(F.id); return showDone(h); }
  F.raf = requestAnimationFrame(loop);
}
function drawRing(p) {
  const c = $('fcRing'); if (!c) return;
  const size = Math.min(innerWidth - 32, innerHeight * .38, 330); const dpr = devicePixelRatio || 1;
  if (c.width !== Math.round(size * dpr)) { c.width = c.height = Math.round(size * dpr); c.style.width = c.style.height = size + 'px'; }
  const x = c.getContext('2d'); const S = c.width; const R = S * .44; const N = 72;
  x.clearRect(0, 0, S, S); x.save(); x.translate(S / 2, S / 2);
  // arco fino de progreso
  x.lineWidth = 2 * dpr; x.strokeStyle = 'rgba(167,139,250,.18)'; x.beginPath(); x.arc(0, 0, R * .86, 0, Math.PI * 2); x.stroke();
  const grad = x.createLinearGradient(-R, -R, R, R); grad.addColorStop(0, '#a78bfa'); grad.addColorStop(1, '#22d3ee');
  x.strokeStyle = grad; x.lineWidth = 3 * dpr; x.lineCap = 'round'; x.beginPath(); x.arc(0, 0, R * .86, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); x.stroke();
  // anillo de dígitos
  const filled = Math.floor(p * N); const now = performance.now();
  if (now - F.flick > 140) F.flick = now;
  x.font = `700 ${Math.round(S * .045)}px "Space Mono", ui-monospace, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + i / N * Math.PI * 2;
    x.save(); x.rotate(a + Math.PI / 2); x.translate(0, -R);
    if (i < filled) {
      const t = i / N; x.fillStyle = `hsl(${258 - t * 70} 90% ${68 + 8 * Math.sin(now / 600 + i)}%)`; x.shadowColor = x.fillStyle; x.shadowBlur = 8 * dpr;
      x.fillText('1', 0, 0);
    } else if (i === filled && p < 1) {
      x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 12 * dpr; x.fillText(Math.floor(F.flick / 140) % 2 ? '1' : '0', 0, 0);
    } else { x.fillStyle = 'rgba(148,138,210,.22)'; x.shadowBlur = 0; x.fillText('0', 0, 0); }
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
  $('fcPause').hidden = true; $('fcMsg').textContent = ''; $('fcPrize').innerHTML = '';
  $('fcDone').innerHTML = `<div class="fc-crown">👑</div><b>¡${esc(h.nombre)} completo!</b>
    <p>${h.min} ${h.min === 1 ? 'minuto' : 'minutos'} de verdad.${r?.onTime ? ' ⏰ ¡A tiempo! +25%' : ''}${r?.streak > 1 ? ` · 🔥 racha de ${r.streak}` : ''}</p>
    <button class="fc-claim" id="fcClaim">👑 Activar corona · +${r?.xp ?? 0} XP · +${r?.bits ?? 0} ◆</button>`;
  $('fcDone').hidden = false;
  $('fcClaim').onclick = () => { const id = F.id; const cb = F.onClaim; close(); cb?.(id); };
}
export const isOpen = () => !!F.id;
