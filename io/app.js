/* IO — app. Arriba la consola (el juego), abajo tus hábitos de hoy con su reloj. */
import * as S from './store.js';
import { cfg, saveCfg, todayIso } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import * as G from './engine.js';
import * as Focus from './focus.js';
import { openOnboarding } from './onboarding.js';
import { avatarSVG, editorHTML, normLook } from './avatar.js';

import { $, esc, toast, openSheet, closeSheet } from './ui.js';
import * as L from './lower.js';
import * as R from './ranking.js';
import * as Radio from './radio.js';
import * as Rem from './remind.js';
import * as Pet from './pet.js';
import * as Wx from './weather.js';
const mmss = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const ANIM = { read: 'sit', study: 'sit', write: 'sit', type: 'sit', talk: 'wave', float: 'float', breathe: 'float', yoga: 'flex', pray: 'float', unplug: 'dance', sleep: 'float', flex: 'flex', run: 'jump', walk: 'dance', dog: 'dance', swim: 'jump', eat: 'jump', cook: 'dance', water: 'jump', clean: 'dance', music: 'dance', draw: 'wave', jump: 'jump' };

/* ================= hábitos de hoy ================= */
function stateOf(h) {
  const s = H.sess(h.id); const r = H.running();
  if (s.claimed) return 'claimed';
  if (s.done) return 'crown';
  if (r && r.hid === h.id) return 'running';
  if (s.el > 0) return 'paused';
  return 'todo';
}
function ring(p, col = 'var(--acc2)') {
  const R = 19, C = 2 * Math.PI * R;
  return `<svg viewBox="0 0 44 44" class="hring"><circle cx="22" cy="22" r="${R}" stroke="var(--s4)" stroke-width="3.5" fill="none"/><circle cx="22" cy="22" r="${R}" stroke="${col}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" transform="rotate(-90 22 22)"/></svg>`;
}
function renderHabits() {
  const t = H.today(); const hs = t.hs;
  $('dayProg').textContent = hs.length ? `${t.claimed}/${t.total} · ${t.minutes} min` : '';
  $('dayFill').style.width = hs.length ? (t.claimed / t.total * 100) + '%' : '0%';
  const now = new Date(); const nowM = now.getHours() * 60 + now.getMinutes();
  const next = H.nextUp();
  if (next && stateOf(next) === 'todo') {
    const diff = H.minutesOf(next.hora) - nowM;
    $('hNext').innerHTML = `<span class="hn-ic">${esc(next.emoji)}</span><div><b>${diff > 0 ? `En ${diff >= 60 ? Math.floor(diff / 60) + 'h ' : ''}${diff % 60} min` : diff >= -30 ? '¡Es la hora!' : 'Pendiente'}</b><small>${esc(next.nombre)} · ${next.hora} · ${next.min} min${diff <= 30 && diff >= -30 ? ' · empieza ya y gana +25%' : ''}</small></div><button class="hn-go" data-act="start" data-id="${next.id}" aria-label="Empezar ${esc(next.nombre)}">▶</button>`;
    $('hNext').hidden = false;
  } else $('hNext').hidden = true;
  if (!hs.length) { $('habitList').innerHTML = `<div class="empty">${H.list().length ? 'Hoy no tienes hábitos programados. Descansa 🌙' : 'Aún no tienes hábitos. Crea el primero 👇'}</div>`; }
  else $('habitList').innerHTML = hs.map(h => {
    const st = stateOf(h); const s = H.sess(h.id); const el = H.elapsed(h.id); const cnt = H.isCount(h); const p = cnt ? (s.n || 0) / (h.meta || 1) : el / (h.min * 60);
    const streak = H.streakOf(h.id); const late = st === 'todo' && H.minutesOf(h.hora) < nowM - 30;
    const btn = st === 'claimed' ? `<span class="hb-ok">✓ +${s.reward?.xp ?? ''} XP</span>`
      : st === 'crown' ? `<button class="hb-btn crown" data-act="claim" data-id="${h.id}">👑 Activar</button>`
      : st === 'running' ? `<button class="hb-btn run" data-act="start" data-id="${h.id}">● ${mmss(h.min * 60 - el)}</button>`
      : st === 'paused' ? `<button class="hb-btn" data-act="start" data-id="${h.id}">⏯ ${mmss(h.min * 60 - el)}</button>`
      : cnt ? (H.countWait(h.id) ? `<button class="hb-btn" data-act="count" data-id="${h.id}">⏳ ${H.countWait(h.id)} min</button>` : `<button class="hb-btn go" data-act="count" data-id="${h.id}">＋1 · ${s.n || 0}/${h.meta}</button>`)
      : `<button class="hb-btn go" data-act="start" data-id="${h.id}">▶ Empezar</button>`;
    return `<div class="hab st-${st}${late ? ' late' : ''}" data-hid="${h.id}">
      <div class="hab-ic">${ring(st === 'claimed' ? 1 : p, st === 'claimed' ? 'var(--green)' : st === 'crown' ? 'var(--amber)' : 'var(--acc2)')}<span>${st === 'crown' ? '👑' : esc(h.emoji)}</span></div>
      <button class="hab-inf" data-act="editHabit" data-id="${h.id}"><b>${esc(h.nombre)}</b><small>${h.hora} · ${cnt ? `${s.n || 0}/${h.meta} ${esc(h.unidad || '')}` : `${h.min} min`}${streak ? ` · 🔥${streak}` : ''}${late ? ' · se te pasó la hora' : ''}</small></button>
      ${btn}</div>`;
  }).join('');
  const others = H.list().filter(h => !H.scheduled(h, todayIso()));
  if (others.length) $('habitList').insertAdjacentHTML('beforeend', `<div class="h-rest">Hoy no toca: ${others.map(h => esc(h.emoji + ' ' + h.nombre)).join(' · ')} · <button data-act="allHabits">ver todos</button></div>`);
  const g = W.game();
  $('chestBox').innerHTML = g.chest[todayIso()] ? '<div class="chest opened">🎁 Día perfecto · cofre abierto</div>'
    : H.chestReady() ? '<button class="chest ready" data-act="chest">🎁 ¡Día perfecto! Abrir cofre</button>'
    : t.total >= 2 ? `<div class="chest">🎁 Cofre del día: completa todos tus hábitos (${t.claimed}/${t.total})</div>` : '';
}
function renderTop() {
  const g = W.game();
  $('hdrLvl').textContent = `NV ${W.level(g)} · ◆ ${g.bits}`;
  $('streakN').textContent = `🔥${H.dayStreak()}`;
  $('demoBar').hidden = !cfg.demo;
  const t = H.today();
  G.setMood(H.running() ? 'neutral' : t.claimed ? 'happy' : 'neutral');
  $('led').classList.toggle('on', !!H.running());
}
function renderAll() { renderTop(); renderHabits(); L.render(); G.render(); renderMini(); R.publish(); Rem.badge(); }

/* ================= mini reproductor: tu próximo hábito siempre a un toque ================= */
let listVisible = false;
function renderMini() {
  const m = $('mini'); const r = H.running();
  const crown = H.forDay().find(x => { const s = H.sess(x.id); return s.done && !s.claimed; });
  const h = r ? H.get(r.hid) : crown || H.nextUp();
  const show = !!h && cfg.onboarded && !listVisible && !Focus.isOpen() && $('onb').hidden;
  m.classList.toggle('show', show); if (!show) return;
  const el = H.elapsed(h.id); const st = stateOf(h);
  const p = st === 'claimed' ? 1 : H.isCount(h) ? (H.sess(h.id).n || 0) / (h.meta || 1) : el / (h.min * 60);
  m.innerHTML = `<div class="mi-bar"><i style="width:${Math.min(100, p * 100)}%"></i></div>
    <span class="mi-e">${st === 'crown' ? '👑' : esc(h.emoji)}</span>
    <div class="mi-t"><b>${esc(h.nombre)}</b><small>${st === 'crown' ? 'Corona lista: actívala' : H.isCount(h) ? `${H.sess(h.id).n || 0}/${h.meta} ${esc(h.unidad || '')} · toca +1` : st === 'running' ? `● quedan ${mmss(h.min * 60 - el)}` : st === 'paused' ? `⏸ pausado · quedan ${mmss(h.min * 60 - el)}` : `Próximo · ${h.hora} · ${h.min} min`}</small></div>
    ${st === 'crown' ? `<button class="mi-go crown" data-act="claim" data-id="${h.id}" aria-label="Activar corona">👑</button>` : `<button class="mi-go" data-act="start" data-id="${h.id}" aria-label="${st === 'running' ? 'Abrir reloj' : 'Empezar'}">${st === 'running' ? '⤢' : '▶'}</button>`}`;
}

/* ================= reloj y corona ================= */
/** Hábito de conteo: +1 con celebración chiquita en la consola. */
function countHabit(id) {
  const h = H.get(id); const r = H.count(id);
  if (!r.ok) { if (r.wait) toast(`⏳ Espera ${r.wait} min para el siguiente (así cuenta de verdad)`, 3000); G.blip('error'); return; }
  G.blip('coin'); try { navigator.vibrate?.(25); } catch { /* */ }
  G.act(ANIM[H.actOf(h)] || 'jump', h.emoji); G.floatText(`+1 ${h.emoji} ${r.n}/${r.meta}`);
  renderAll();
  if (r.done) setTimeout(() => claimFlow(id), 700);
}
function startHabit(id) {
  if (H.isCount(H.get(id))) return countHabit(id);
  Focus.open(id, { onClaim: claimFlow, onClose: () => { renderAll(); G.say('Pausado. Lo que llevas quedó guardado ⏸', 3000); } });
  renderAll();
}
function claimFlow(id) {
  const streakBefore = H.dayStreak();
  const r = H.claim(id); if (!r) { renderAll(); return; }
  const streakAfter = H.dayStreak();
  try { navigator.vibrate?.([40, 30, 90]); } catch { /* */ }
  renderAll();
  const row = document.querySelector(`.hab[data-hid="${id}"]`);
  const act = H.actOf(r.habit);
  G.celebrate({ kind: ANIM[act] || 'jump', prop: H.PROP[act], xp: r.xp, bits: r.bits, fromEl: row,
    line: `¡${r.habit.nombre} completo! +${r.xp} XP y ${r.bits} bits${r.onTime ? ' (a tiempo +25%)' : ''}${r.streak > 1 ? `. Racha de ${r.streak} 🔥` : ''}.` });
  setTimeout(() => {
    const lv = () => { if (r.after > r.before) { G.levelUp(r.before, r.after); giftRadio(); } else if (H.chestReady()) { G.say('🎁 ¡Completaste todo lo de hoy! Abre el cofre del día abajo.', 5000); L.show('hoy'); } renderAll(); };
    if (streakAfter > streakBefore) streakScreen(streakAfter, () => petEvent(lv)); else petEvent(lv);
  }, 2400);
}
/** Pantalla de racha (como Duolingo): la llama crece y la semana se marca. */
function streakScreen(n, then) {
  const ov = $('streakOv'); const DN = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const days = [...Array(7)].map((_, i) => S.addDays(todayIso(), i - 6));
  const any = d => Object.values(H.log(d).s).some(x => x.claimed) || W.game().shielded?.[d];
  const msg = n === 1 ? '¡Empieza tu racha! Vuelve mañana para mantenerla.' : n < 7 ? `Vas ${n} días seguidos. ¡No la rompas mañana!` : n < 30 ? `¡${n} días! Ya es parte de ti.` : `¡${n} días! Esto es leyenda. 🏆`;
  ov.innerHTML = `<div class="so-in"><div class="so-flame">🔥</div><b class="so-n" id="soN">${Math.max(0, n - 1)}</b><span class="so-l">${n === 1 ? 'día de racha' : 'días de racha'}</span>
    <div class="so-week">${days.map((d, i) => `<div class="${any(d) ? 'on' : ''}${i === 6 ? ' today' : ''}"><i>${any(d) ? '✓' : ''}</i><small>${DN[S.dateOf(d).getDay()]}</small></div>`).join('')}</div>
    <p>${msg}</p><button class="btn-acc" id="soGo">¡Sigo! 💪</button>${n >= 3 ? '<button class="so-share" id="soShare">📸 Presumir mi racha</button>' : ''}</div>`;
  ov.hidden = false; G.blip('level'); try { navigator.vibrate?.([30, 40, 30, 40, 120]); } catch { /* */ }
  setTimeout(() => { const e = $('soN'); if (e) { e.textContent = n; e.classList.add('bump'); } G.blip('crown'); }, 700);
  const done = () => { ov.hidden = true; ov.innerHTML = ''; then?.(); };
  $('soGo').onclick = done; if ($('soShare')) $('soShare').onclick = () => { done(); L.actions.story(); }; clearTimeout(streakScreen.t); streakScreen.t = setTimeout(() => { if (!ov.hidden) done(); }, 7000);
}
function openChest() {
  const r = H.openChest(); if (!r) return;
  G.celebrate({ kind: 'dance', prop: '🎁', xp: r.xp, bits: r.bits, fromEl: $('chestBox'), line: `¡Día perfecto! El cofre trae +${r.xp} XP y ${r.bits} bits.` });
  setTimeout(() => { if (r.after > r.before) G.levelUp(r.before, r.after); renderAll(); }, 2400);
}

/* ================= sheets ================= */

const EMOJIS = ['📖', '🧘', '🏃', '🏋️', '🥗', '🇬🇧', '💻', '🎓', '🎸', '🚶', '✍️', '🧹', '📵', '🌬️', '🎨', '🙏', '💤', '🧠', '🍳', '💧', '🚴', '🏊', '📚', '⭐'];
function habitSheet(id) {
  const h = id ? H.get(id) : { emoji: '⭐', nombre: '', min: 20, hora: '08:00', dias: [0, 1, 2, 3, 4, 5, 6], motivo: '' };
  openSheet(id ? 'Editar hábito' : 'Nuevo hábito', `
    <div class="emo-row">${EMOJIS.map(e => `<button class="emo${h.emoji === e ? ' on' : ''}" data-act="pickEmoji" data-e="${e}">${e}</button>`).join('')}</div>
    <input type="hidden" id="hfEmoji" value="${esc(h.emoji)}">
    <div class="field"><label for="hfName">Hábito</label><input class="inp" id="hfName" value="${esc(h.nombre)}" placeholder="Leer, meditar, ir a clase…" maxlength="40"></div>
    <div class="field"><label>Tipo</label><div class="seg" id="hfTipo"><button class="${H.isCount(h) ? '' : 'on'}" data-act="hfTipo" data-v="reloj">⏱ Con reloj</button><button class="${H.isCount(h) ? 'on' : ''}" data-act="hfTipo" data-v="conteo">🔢 De conteo</button></div></div>
    <div class="row cnt-only"${H.isCount(h) ? '' : ' hidden'}><div class="field"><label for="hfMeta">¿Cuántas veces?</label><input class="inp" id="hfMeta" type="number" min="1" max="50" value="${h.meta || 8}" inputmode="numeric"></div>
      <div class="field"><label for="hfUni">¿De qué?</label><input class="inp" id="hfUni" value="${esc(h.unidad || 'veces')}" maxlength="14"></div>
      <div class="field"><label for="hfPausa">Cada (min)</label><input class="inp" id="hfPausa" type="number" min="1" max="240" value="${h.pausa ?? 30}" inputmode="numeric"></div></div>
    <div class="row"><div class="field tmr-only"${H.isCount(h) ? ' hidden' : ''}><label for="hfMin">Duración (min)</label><input class="inp" id="hfMin" type="number" min="1" max="240" value="${h.min}" inputmode="numeric"></div>
    <div class="field"><label for="hfHora">Hora</label><input class="inp" id="hfHora" type="time" value="${esc(h.hora)}"></div></div>
    <div class="field"><label>Días</label><div class="hb-days big" id="hfDays">${H.DAYS.map((d, k) => `<button class="${(h.dias || []).includes(k) ? 'on' : ''}" data-act="toggleDay" data-k="${k}">${d}</button>`).join('')}</div></div>
    <div class="field"><label for="hfAct">Tu personaje durante el reloj</label><select class="inp" id="hfAct">${Object.entries(H.ACTS).map(([k, [e, l]]) => `<option value="${k}"${k === H.actOf(h) ? ' selected' : ''}>${e} ${l}</option>`).join('')}</select></div>
    <div class="field"><label for="hfMot">¿Por qué? (te lo recordaremos si quieres pausar)</label><input class="inp" id="hfMot" value="${esc(h.motivo || '')}" maxlength="120" placeholder="Quiero…"></div>
    <div class="stack"><button class="btn-acc" data-act="saveHabit" data-id="${id || ''}">Guardar</button>
    ${id ? `<button class="btn-ghost danger" data-act="delHabit" data-id="${id}">Eliminar hábito</button>` : ''}</div>`);
  let manual = !!id; $('hfAct').onchange = () => { manual = true; };
  $('hfName').oninput = () => { if (manual) return; const a = H.guessAct($('hfName').value, $('hfEmoji').value); $('hfAct').value = a; };
}
function allHabitsSheet() {
  const hs = H.list();
  openSheet('Todos mis hábitos', `${hs.map(h => `<button class="list-row" data-act="editHabit" data-id="${h.id}"><span>${esc(h.emoji)}</span><div><b>${esc(h.nombre)}</b><small>${h.hora} · ${h.min} min · ${(h.dias || []).length === 7 ? 'todos los días' : (h.dias || []).map(d => H.DAYS[d]).join(' ')}</small></div><em>✎</em></button>`).join('') || '<div class="empty">Sin hábitos.</div>'}
    <button class="btn-acc" data-act="newHabit" style="margin-top:12px">＋ Nuevo hábito</button>`);
}

/* compras (la tienda vive en la pantalla de abajo: lower.js) */
function buy(id, opts = {}) {
  const it = W.itemById(id); const r = W.buy(id, opts);
  if (!r.ok) { toast(r.msg); G.blip('error'); return; }
  G.blip('buy'); closeSheet(); renderAll();
  if (it.kind === 'wear') { G.act('dance', it.e); toast(r.msg); $('screen').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  place(id, true);
}
/** Lleva el objeto a la consola: sube la pantalla y entra a modo decorar. */
function place(id, fresh = false) {
  const it = W.itemById(id);
  $('screen').scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => {
    if (G.placeFromBag(id)) { G.act('jump', it.e); G.confetti(24); if (fresh) G.floatText(`${it.e} ¡nuevo!`); }
    else toast(`${it.e} quedó en tu mochila 🎒`, 3500);
    renderAll();
  }, 420);
}
/** Nacimiento o evolución del compañero, con su propia revelación. */
function petEvent(then) {
  const ev = Pet.check(); if (!ev) return then?.();
  const el = $('reveal'); el.dataset.r = ev.type === 'hatch' ? 'raro' : 'epico';
  el.innerHTML = `<div class="rv-in"><div class="rv-box">${ev.from}</div><p class="rv-tap">${ev.type === 'hatch' ? '¡Algo se mueve!' : '¡Está cambiando!'}</p></div>`;
  el.hidden = false; G.blip('shake'); setTimeout(() => G.blip('shake'), 400); setTimeout(() => G.blip('shake'), 800);
  setTimeout(() => {
    G.blip('legend'); const p = ev.p;
    el.innerHTML = `<div class="rv-in show"><div class="rv-rays"></div><div class="rv-item">${ev.to}</div><em class="rt r-${el.dataset.r}">${ev.type === 'hatch' ? '¡NACIÓ!' : '¡EVOLUCIONÓ!'}</em>
      <h3>${ev.type === 'hatch' ? `Es un ${esc(p.spName.toLowerCase())}` : `${esc(p.name)} ahora es ${p.stageName.toLowerCase()}`}</h3>
      <p>${ev.type === 'hatch' ? 'Crece con cada corona que ganes. Ponle nombre:' : `Sigue así: ${p.toNext ? `evoluciona otra vez en ${p.toNext} coronas` : 'llegó a su forma legendaria'}.`}</p>
      ${ev.type === 'hatch' ? `<input class="inp" id="petIn" maxlength="14" value="${esc(p.name)}" style="max-width:220px;text-align:center">` : ''}
      <div class="rv-btns"><button class="btn-acc" id="petOk">❤️ ${ev.type === 'hatch' ? 'Bienvenido' : '¡Genial!'}</button></div></div>`;
    $('petOk').onclick = () => { if ($('petIn')?.value.trim()) Pet.rename($('petIn').value); el.hidden = true; el.innerHTML = ''; renderAll(); then?.(); };
  }, 1300);
}
function giftRadio() {
  if (!W.grantRadio()) return;
  setTimeout(() => { G.say('🎁 ¡Nivel 2! Te ganaste una 📻 radio. Está en tu mochila: ponla en una repisa y tócala con A, o prende música en el reloj.', 8000); renderAll(); }, 4600);
}
function celebrate(o) {
  G.celebrate(o); renderAll();
  setTimeout(() => { if (o.after > o.before) G.levelUp(o.before, o.after); renderAll(); }, 2400);
}
function bagSheet() {
  const g = W.game(); const items = W.CATALOG.filter(i => W.bagCount(g, i.id) > 0);
  const wear = W.WEAR.filter(i => g.owned[i.id]);
  openSheet('Mochila', `${items.length ? `<div class="grid">${items.map(i => `<button class="it" data-act="place" data-id="${i.id}"><span class="e">${i.e}</span><span class="n">${esc(i.n)}</span><span class="p">COLOCAR AQUÍ</span><span class="bag">×${W.bagCount(g, i.id)}</span></button>`).join('')}</div>` : '<div class="empty">Tu mochila está vacía. En modo decorar (SELECT, luego START) puedes guardar objetos aquí.</div>'}
    ${wear.length ? `<div class="sec-t">Ropa y accesorios</div><div class="grid">${wear.map(i => `<button class="it${g.wear[i.slot] === i.id ? ' on' : ''}" data-act="buy" data-id="${i.id}"><span class="e">${i.e}</span><span class="n">${esc(i.n)}</span><span class="p">${g.wear[i.slot] === i.id ? 'PUESTO' : 'PONER'}</span></button>`).join('')}</div>` : ''}`);
}
function mapSheet() {
  const g = W.game(); const lvl = W.level(g);
  const worlds = W.worldsUpTo(Math.max(lvl + 25, 100)); const nx = W.floorInfo(lvl + 1);
  openSheet('Mapa', `<p class="note">Nivel ${lvl} · cada nivel abre un piso. Siguiente: piso ${lvl + 1} (${nx.ic} ${esc(nx.name)}) · faltan ${W.xpAt(lvl + 1) - g.xp} XP.</p>
    ${worlds.map(w => {
      const open = lvl >= w.from; const fl = [];
      for (let k = w.to; k >= w.from; k--) { const f = W.floorInfo(k); fl.push(`<button class="mp-f${k <= lvl ? '' : ' locked'}${k === g.floor ? ' here' : ''}" data-act="goFloor" data-n="${k}"><i>${k}</i><span>${f.ic} ${esc(f.name)}</span><em>${k === g.floor ? '📍' : k <= lvl ? '▸' : '🔒'}</em></button>`); }
      return `<details class="mp-w"${w.id === W.worldOf(g.floor).id ? ' open' : ''}><summary><b>${esc(w.n)}</b><small>pisos ${w.from}–${w.to}${open ? '' : ' · 🔒 nivel ' + w.from}</small></summary><div class="mp-list">${fl.join('')}</div></details>`;
    }).join('')}
    <p class="note">…y el edificio sigue: cada 25 pisos, un mundo nuevo.</p>`);
}
let charTab = 'cuerpo', editLook = null;
function charSheet() {
  editLook = normLook(cfg.avatar); const g = W.game();
  openSheet('Tu personaje', `<div class="av-stage ${['head', 'face'].map(s => g.wear[s] ? 'wear-' + g.wear[s] : '').join(' ')}" data-mood="happy" id="chPrev">${avatarSVG(editLook, 'av')}</div>
    <div class="field"><label for="chName">Nombre</label><input class="inp" id="chName" value="${esc(cfg.name)}" maxlength="20"></div>
    <div id="chEditor">${editorHTML(editLook, charTab)}</div>
    <div class="stack" style="margin-top:14px"><button class="btn-acc" data-act="saveChar">Guardar personaje</button></div>`);
}
/** Tocar el HUD: qué es XP, bits y racha, cuánto llevas y cuánto falta. */
function statsSheet(focus = 'xp') {
  const g = W.game(); const lvl = W.level(g); const pr = W.progressOf(g.xp); const nx = W.floorInfo(lvl + 1);
  const streak = H.dayStreak(); const next = H.nextUp(); const pv = next ? H.rewardOf(next, { onTime: true }, H.streakOf(next.id) + 1) : null;
  const rk = R.state.rows.findIndex(r => r.me); const pos = rk >= 0 ? rk + 1 : R.state.me?.pos;
  openSheet('Tu progreso', `
    <div class="pg-hero"><div class="pg-face ${['head', 'face'].map(s => g.wear[s] ? 'wear-' + g.wear[s] : '').join(' ')}" data-mood="happy">${avatarSVG(cfg.avatar, 'av', '28 2 64 64')}</div>
      <div><small>${esc(W.titleOf(lvl).toUpperCase())} · NIVEL ${lvl}</small><b>${esc(cfg.name || 'Player 1')}</b>
        <div class="pg-xp"><i style="width:${pr.pct * 100}%"></i></div><span>${pr.into}/${pr.need} XP · faltan <b style="display:inline;font-size:12px">${pr.need - pr.into} XP</b> para el piso ${lvl + 1} ${nx.ic} ${esc(nx.name)}</span></div></div>
    <div class="ex-tiles">
      <div class="ext ext-xp${focus === 'xp' ? ' hl' : ''}"><span class="ext-ic">⭐</span><div><b>XP · experiencia</b><p>Sube tu nivel, y tu nivel es tu piso. Solo se gana completando hábitos con el reloj. No se gasta nunca.</p></div><strong>${g.xp.toLocaleString('es-CO')}<small>total · ${H.weekXp(g)} esta semana</small></strong></div>
      <div class="ext ext-bits${focus === 'bits' ? ' hl' : ''}"><span class="ext-ic">◆</span><div><b>Bits · tus monedas</b><p>Se ganan con cada corona, cofres, retos y misiones. Se gastan en la tienda: muebles, ropa, cajas sorpresa y escudos.</p></div><strong>${g.bits.toLocaleString('es-CO')}<small>${(g.stats.spent || 0).toLocaleString('es-CO')} invertidos</small></strong></div>
      <div class="ext ext-racha${focus === 'racha' ? ' hl' : ''}"><span class="ext-ic">🔥</span><div><b>Racha</b><p>Días seguidos cumpliendo al menos un hábito. Cada día de racha suma más XP y bits (hasta +10). Los días de descanso no la rompen.</p></div><strong>${streak}<small>🛡️ ${g.shields || 0}/${W.SHIELD.max} escudos</small></strong></div>
      <div class="ext ext-rank"><span class="ext-ic">🏆</span><div><b>Ranking</b><p>Tu XP total te pone en la tabla mundial; la semanal se reinicia cada lunes.</p></div><strong>${pos ? '#' + pos : '—'}<small>${R.online() ? 'mundial' : 'liga de práctica'}</small></strong></div>
    </div>
    <div class="sec-t">CÓMO SE GANA</div>
    <table class="earn"><tr><td>👑 Cada minuto de hábito</td><td>+1 XP · +½ ◆</td></tr><tr><td>⏰ Empezar a tiempo (±30 min)</td><td>+25%</td></tr><tr><td>🔥 Cada día de racha</td><td>+2 XP · +1 ◆</td></tr>
      <tr><td>🎁 Día perfecto (cofre)</td><td>+25 XP · +15 ◆ o más</td></tr><tr><td>⚡ Reto semanal</td><td>+50 XP · +100 ◆</td></tr></table>
    ${next && pv ? `<p class="note">Tu próximo hábito, ${esc(next.emoji)} ${esc(next.nombre)} (${next.min} min), te da ≈ <b>+${pv.xp} XP</b> y <b>+${pv.bits} ◆</b> si empiezas a tiempo.</p>` : ''}
    <div class="stack"><button class="btn-ghost" data-act="tab" data-t="ranking">🏆 Ver ranking</button><button class="btn-ghost" data-act="tab" data-t="tienda">🛒 Gastar bits</button></div>`);
}
function calendarSheet() {
  const hs = H.list();
  openSheet('Tu calendario', `<p class="note">Tus hábitos como eventos que se repiten, con alarma ${+(cfg.remindLead ?? 5) ? (cfg.remindLead ?? 5) + ' min antes' : 'a la hora'}. Funcionan aunque IO esté cerrada, y al tocarlos se abre el reloj.</p>
    <button class="btn-acc" data-act="icsAll">📅 Descargar todos (.ics)</button>
    <p class="note">Sirve para Google Calendar, Apple Calendario y Outlook. O agrégalos uno por uno a Google:</p>
    ${hs.map(h => `<a class="list-row" href="${Rem.googleLink(h)}" target="_blank" rel="noopener"><span>${esc(h.emoji)}</span><div><b>${esc(h.nombre)}</b><small>${h.hora} · ${h.min} min · ${(h.dias || []).length === 7 ? 'todos los días' : (h.dias || []).map(d => H.DAYS[d]).join(' ')}</small></div><em>＋ Google</em></a>`).join('') || '<div class="empty">Sin hábitos aún.</div>'}`);
}
function achievementsTab() { L.show('progreso'); setTimeout(() => $('achSec')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }
function decoSheet(u) {
  const g = W.game(); const p = u ? W.placedOn(g, g.floor).find(q => q.u === u) : null; const it = p ? W.itemById(p.item) : null;
  openSheet('Decorar', `<div class="stack">
    ${it ? `<button class="btn-ghost" data-act="storeObj" data-u="${u}">🎒 Guardar ${it.e} ${esc(it.n)} en la mochila</button>` : ''}
    <button class="btn-ghost" data-act="bag">➕ Poner algo de la mochila</button>
    <button class="btn-ghost" data-act="shop">🛒 Ir a la tienda</button>
    <button class="btn-acc" data-act="closeSheet">Seguir decorando</button></div>
    <p class="note">En modo decorar: ◀▶ eliges un objeto · A lo levantas · lo mueves con la cruceta (los cuadros también suben y bajan) · A lo sueltas · B sales. También puedes arrastrarlos con el dedo.</p>`);
}
function aboutSheet() {
  openSheet('IO', `<div class="io-intro small"><div class="io-big"><span class="logo-flip"><span class="lf lf-a">IO</span><span class="lf lf-b">10</span></span></div>
    <div class="io-def"><b>IO</b><span>se lee “yo”. Eres tú, frente a tu espejo.</span><b>1 0</b><span>el código binario con el que se escribe todo.</span><b>1</b><span>lo que haces.</span><b>0</b><span>lo que aún no. Cada día eliges cuál escribir.</span></div>
    <p class="note">IO es un juego que solo se gana viviendo. Siempre gratis y sin anuncios. Nada se compra con dinero: todo se gana haciendo.</p>
    <a class="btn-acc" href="lanzamiento/" style="display:block;text-align:center;text-decoration:none">🚀 Cómo nació IO y lista de espera</a></div>`);
}
function settingsSheet() {
  openSheet('Ajustes', `
    <div class="field"><label for="stName">Tu nombre</label><input class="inp" id="stName" value="${esc(cfg.name)}" maxlength="20"></div>
    <label class="tog"><input type="checkbox" id="stSound"${cfg.sound !== false ? ' checked' : ''}> Sonidos 8-bit</label>
    <label class="tog"><input type="checkbox" id="stWake"${cfg.wake !== false ? ' checked' : ''}> Mantener la pantalla encendida durante el reloj</label>
    <div class="stack" style="margin:10px 0 4px"><button class="btn-acc" data-act="saveSettings">Guardar</button>
      <button class="btn-ghost" data-act="allHabits">📋 Mis hábitos</button>
      <button class="btn-ghost" data-act="redoOnb">🎮 Rehacer configuración inicial</button></div>
    <label class="tog"><input type="checkbox" id="stWx"${cfg.weather ? ' checked' : ''}> Clima real en la ventana de mi cuarto (usa tu ubicación)</label>
    <div class="sec-t">Recordatorios y calendario</div>
    <label class="tog"><input type="checkbox" id="stRemind"${Rem.enabled() ? ' checked' : ''}${Rem.state() === 'unsupported' || Rem.state() === 'denied' ? ' disabled' : ''}> Avisarme a la hora de cada hábito</label>
    <div class="field"><label for="stLead">Avisar</label><select class="inp" id="stLead">${[[0, 'A la hora exacta'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes']].map(([v, l]) => `<option value="${v}"${+(cfg.remindLead ?? 5) === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <p class="note">${Rem.state() === 'denied' ? '⚠️ Bloqueaste las notificaciones: actívalas en los ajustes del navegador para este sitio.' : Rem.state() === 'unsupported' ? 'Este navegador no permite notificaciones. En iPhone, instala IO en la pantalla de inicio (iOS 16.4+).' : 'Llegan mientras IO está abierta o en segundo plano. Para avisos con el celular bloqueado, agrega tus hábitos a tu calendario:'}</p>
    <button class="btn-ghost" data-act="calendar">📅 Agregar mis hábitos al calendario</button>
    <div class="sec-t">Ranking</div>
    <label class="tog"><input type="checkbox" id="stRank"${cfg.rankOn ? ' checked' : ''}> Aparecer en el ranking mundial</label>
    <div class="field"><label for="stRankName">Nombre público</label><input class="inp" id="stRankName" value="${esc(cfg.rankName || cfg.name)}" maxlength="20"></div>
    <p class="note">${R.online() ? 'Solo se publica tu nombre público, nivel, XP, racha y personaje. Nada de tus hábitos.' : 'El ranking mundial aún no está conectado: juegas la liga de práctica con bots 🤖.'}</p>
    <div class="sec-t">Sincronizar entre dispositivos (opcional)</div>
    <div class="field"><label for="stUrl">Supabase URL</label><input class="inp" id="stUrl" value="${esc(cfg.supaUrl)}" placeholder="https://xxxx.supabase.co"></div>
    <div class="field"><label for="stKey">Anon key</label><input class="inp" id="stKey" value="${esc(cfg.supaKey)}" autocomplete="off"></div>
    <p class="note">Estado: ${S.status.supabase === 'ok' ? '✅ sincronizado' : S.status.supabase === 'error' ? '⚠️ ' + esc(S.status.error) : 'solo en este dispositivo'}. Corre <code>supabase/schema.sql</code> una vez.</p>
    <button class="btn-ghost" data-act="testSupa">Probar conexión</button>
    <a class="btn-ghost" href="lanzamiento/" style="display:block;text-align:center;text-decoration:none;margin-top:14px">🚀 Lanzamiento: historia, cómo instalar y lista de espera</a>
    <div class="sec-t">Respaldo</div>
    <div class="stack"><button class="btn-ghost" data-act="exportBackup">⬇️ Exportar</button><button class="btn-ghost" data-act="importBackup">⬆️ Importar</button>
    <button class="btn-ghost danger" data-act="wipe">Borrar todo y empezar de cero</button></div>`);
}

/* ================= demo ================= */
function seedDemo() {
  const pick = ['Leer', 'Meditar', 'Hacer ejercicio', 'Sacar al perro', 'Respirar'].map(n => H.EXAMPLES.findIndex(x => x[1] === n));
  const ids = pick.map(k => { const [e, n, m, h, act] = H.EXAMPLES[k]; return H.save({ emoji: e, nombre: n, min: m, hora: h, act, dias: [0, 1, 2, 3, 4, 5, 6], motivo: '' }).id; });
  const g = W.game(); g.xp = W.xpAt(7) + 40; g.bits = 900; g.stats = { minutes: 640, sessions: 31, best: 9, spent: 420, boxes: 1 }; g.floor = 1;
  g.owned = { ...g.owned, cactus: 1, gato: 1, gorra: 1 }; g.wear = { head: 'gorra' }; g.wk = { k: W.weekKey(), xp: 140, claimed: false };
  W.saveGame(g);
  const l = { s: {} }; // hoy: meditar ya reclamado, ejercicio completo esperando su corona
  l.s[ids[1]] = { el: 600, done: true, claimed: true, onTime: true, reward: { xp: 16, bits: 7 } };
  l.s[ids[2]] = { el: 1800, done: true, claimed: false, onTime: true };
  S.putItem('log', l, `log:${todayIso()}`);
  for (let i = 1; i <= 60; i++) { const d = S.addDays(todayIso(), -i); const ll = { s: {} }; const n = i <= 9 ? 3 + (i % 2) : (i * 7) % 5; ids.slice(0, n).forEach(id => { ll.s[id] = { el: 60, done: true, claimed: true }; }); S.putItem('log', ll, `log:${d}`); }
  saveCfg({ demo: true, onboarded: true, name: cfg.name || 'Player 1' });
}

/* ================= acciones ================= */
const A = {
  closeSheet, about: aboutSheet, settings: settingsSheet,
  start: el => startHabit(el.dataset.id), count: el => countHabit(el.dataset.id),
  claim: el => claimFlow(el.dataset.id),
  chest: openChest,
  newHabit: () => habitSheet(null), editHabit: el => habitSheet(el.dataset.id), allHabits: allHabitsSheet,
  pickEmoji: el => { $('hfEmoji').value = el.dataset.e; document.querySelectorAll('.emo').forEach(b => b.classList.toggle('on', b === el)); },
  toggleDay: el => el.classList.toggle('on'),
  hfTipo: el => { document.querySelectorAll('#hfTipo button').forEach(b => b.classList.toggle('on', b === el)); const c = el.dataset.v === 'conteo'; document.querySelector('.cnt-only').hidden = !c; document.querySelector('.tmr-only').hidden = c; },
  saveHabit: el => {
    const nombre = $('hfName').value.trim(); if (!nombre) return toast('Ponle nombre al hábito');
    const dias = [...document.querySelectorAll('#hfDays button')].map((b, k) => b.classList.contains('on') ? k : -1).filter(k => k >= 0);
    if (!dias.length) return toast('Elige al menos un día');
    const old = el.dataset.id ? H.get(el.dataset.id) : null;
    const { id: _o, ...rest } = old || {};
    H.save({ ...rest, emoji: $('hfEmoji').value, nombre, min: parseInt($('hfMin').value) || 10, hora: $('hfHora').value || '08:00', dias, motivo: $('hfMot').value.trim(), act: $('hfAct').value,
      ...(document.querySelector('#hfTipo .on')?.dataset.v === 'conteo' ? { tipo: 'conteo', meta: Math.max(1, Math.min(50, parseInt($('hfMeta').value) || 1)), unidad: $('hfUni').value.trim() || 'veces', pausa: Math.max(1, Math.min(240, parseInt($('hfPausa').value) || 15)) } : { tipo: 'reloj' }) }, el.dataset.id || null);
    closeSheet(); renderAll(); toast('Hábito guardado ✓');
  },
  delHabit: el => { if (el.dataset.sure) { H.remove(el.dataset.id); closeSheet(); renderAll(); toast('Hábito eliminado'); } else { el.dataset.sure = 1; el.textContent = '¿Seguro? Toca otra vez para eliminar'; } },
  ...L.actions,
  calendar: calendarSheet, icsAll: async () => { const r = await Rem.exportIcs(); if (r === 'download') toast('📅 Abre el archivo para agregarlo a tu calendario', 4000); },
  remindOn: async () => { const r = await Rem.enable(true); toast(r === 'granted' ? '🔔 Listo: te aviso a la hora' : 'No se pudieron activar las notificaciones', 3500); L.render(); },
  shop: () => { closeSheet(); L.show('tienda', { scroll: true }); }, buy: el => buy(el.dataset.id),
  bag: bagSheet, place: el => { closeSheet(); place(el.dataset.id); }, character: charSheet, map: mapSheet,
  goFloor: el => { const n = +el.dataset.n; if (n > W.level()) return toast(`🔒 Se abre en el nivel ${n}`); closeSheet(); $('screen').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); setTimeout(() => G.ride(n), 350); },
  storeObj: el => { G.storeSelected(el.dataset.u); closeSheet(); toast('Guardado en la mochila 🎒'); },
  saveChar: () => { saveCfg({ avatar: editLook, name: $('chName').value.trim() || cfg.name }); closeSheet(); renderAll(); G.act('dance', '✨'); G.say('¡Nuevo look!', 2500); },
  saveSettings: async () => {
    saveCfg({ remindLead: +$('stLead').value });
    if ($('stWx').checked !== !!cfg.weather) { const ok = await Wx.enable($('stWx').checked); if (!ok && $('stWx').checked) toast('No se pudo leer la ubicación', 3500); }
    if ($('stRemind').checked !== Rem.enabled()) { const r = await Rem.enable($('stRemind').checked); if (r === 'denied') toast('Notificaciones bloqueadas en el navegador', 4000); }
    const wasOn = !!cfg.rankOn; const on = $('stRank').checked; const rankName = $('stRankName').value.trim().slice(0, 20) || cfg.name;
    saveCfg({ name: $('stName').value.trim() || cfg.name, sound: $('stSound').checked, wake: $('stWake').checked, rankName });
    closeSheet(); toast('Guardado ✓');
    try { if (on && (!wasOn || R.online())) await R.join(rankName); else if (!on && wasOn) await R.leave(); } catch (e) { toast('⚠️ Ranking: ' + e.message, 5000); }
    L.loadRank();
  },
  redoOnb: () => { closeSheet(); openOnboarding({ onDone: afterOnb, step: 1 }); },
  testSupa: async () => { saveCfg({ supaUrl: $('stUrl').value.trim(), supaKey: $('stKey').value.trim() }); try { await S.testSupabase(); await S.sync(); toast('✅ Conectado y sincronizado'); renderAll(); } catch (e) { toast('⚠️ ' + e.message, 5000); } },
  exportBackup: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([S.exportBackup()], { type: 'application/json' })); a.download = `io-respaldo-${todayIso()}.json`; a.click(); },
  importBackup: () => $('backupIn').click(),
  wipe: el => { if (el.dataset.sure) { S.resetAll(); location.reload(); } else { el.dataset.sure = 1; el.textContent = '¿Seguro? Se borra todo. Toca otra vez.'; } },
  startReal: () => { S.resetAll(); location.reload(); },
};
document.addEventListener('click', e => {
  if (!$('onb').hidden) return; // la configuración inicial maneja sus propios toques
  const tab = e.target.closest('[data-avtab]');
  if (tab) { charTab = tab.dataset.avtab; $('chEditor').innerHTML = editorHTML(editLook, charTab); return; }
  const av = e.target.closest('[data-av]');
  if (av) { editLook[av.dataset.av] = av.dataset.v; $('chPrev').innerHTML = avatarSVG(editLook, 'av'); av.parentElement.querySelectorAll('[data-av]').forEach(b => b.classList.toggle('on', b === av)); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = A[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el);
});
$('sheetOv').addEventListener('click', closeSheet);
addEventListener('keydown', e => { if (e.key === 'Escape') { closeSheet(); if (!$('reveal').hidden) L.closeReveal(); } });
$('backupIn').addEventListener('change', async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { S.importBackup(await f.text()); location.reload(); } catch { toast('Archivo inválido'); } });

/* ================= arranque ================= */
function afterOnb({ first, demo } = {}) {
  if (demo) seedDemo();
  if (!cfg.onboarded) saveCfg({ onboarded: true, name: cfg.name || 'Player 1' });
  renderAll(); L.loadRank();
  if (demo) { G.say('Modo demo: estás en el nivel 7. Activa la corona de “Hacer ejercicio” 👑 abajo, prueba “Respirar” (1 min) y camina hasta la puerta del ascensor.', 9000); return; }
  if (first) { G.act('dance', '👋'); G.say(`¡Bienvenido, ${cfg.name}! Este es tu cuarto en el piso 1. Cumple tus hábitos con el reloj para subir de piso. ▶ Empieza el primero abajo.`, 9000); }
}
G.init({
  onMenu: k => k.startsWith('stats') ? statsSheet(k.split(':')[1]) : ({ mochila: bagSheet, tienda: () => L.show('tienda', { scroll: true }), ranking: () => L.show('ranking', { scroll: true }), progreso: () => L.show('progreso', { scroll: true }), mapa: mapSheet, personaje: charSheet, logros: achievementsTab, ajustes: settingsSheet })[k]?.(),
  onDecoMenu: u => decoSheet(u),
  onRadio: () => { const st = Radio.toggle(W.level()); $('scene').classList.toggle('radio-on', !!st); L.render(); return st ? `${st.e} ${st.n}` : ''; },
  onFloor: () => { renderTop(); L.render(); },
});
L.init({ renderAll, buy, place, celebrate, start: id => startHabit(id) });
document.body.dataset.gb = cfg.gb || 'clasico';
H.closeStale();
const shielded = H.applyShields();
W.grantRadio();
renderAll();
if (cfg.onboarded) setTimeout(() => { if (!Focus.isOpen()) petEvent(); }, 2500);
new IntersectionObserver(es => { listVisible = es.some(e => e.isIntersecting); renderMini(); }, { rootMargin: '-130px 0px -90px 0px' }).observe($('habitList'));
setInterval(() => { if (H.running() && !Focus.isOpen()) renderMini(); }, 1000);
if (!cfg.onboarded) openOnboarding({ onDone: afterOnb });
else {
  const r = H.running();
  if (r) startHabit(r.hid);
  else if (shielded) G.say(`🛡️ Ayer se te pasó, pero tu escudo protegió la racha (${shielded} día${shielded > 1 ? 's' : ''}). ¡Hoy toca volver!`, 7000);
  else { const n = H.nextUp(); G.say(n ? `Hola ${cfg.name}. Próximo: ${n.emoji} ${n.nombre} a las ${n.hora}.` : `Hola ${cfg.name}. ¡Todo listo por hoy! Camina, decora o visita tus pisos.`, 5000); }
}
S.sync().then(renderAll);
Rem.start();
Wx.refresh(); setInterval(() => Wx.refresh(), 30 * 60000);
{ // atajos del ícono y notificaciones: ?start=<id|next> · ?tab=<pestaña>
  const q = new URLSearchParams(location.search); const st = q.get('start'); const tb = q.get('tab');
  const sala = q.get('sala'); if (sala) { import('./social.js').then(So => { const c = So.joinRoom(sala); if (c) { toast(`👥 Entraste a la sala ${c}. Arranca un hábito y enfóquense juntos.`, 5000); L.show('ranking'); } }); history.replaceState(null, '', location.pathname); }
  if (cfg.onboarded && (st || tb)) {
    history.replaceState(null, '', location.pathname);
    if (tb) L.show(tb, { scroll: true });
    if (st) { const h = st === 'next' ? H.nextUp() : H.get(st); if (h && !H.sess(h.id).done) setTimeout(() => startHabit(h.id), 400); }
  }
}
setInterval(() => { if (document.visibilityState === 'visible' && !Focus.isOpen()) { renderHabits(); renderTop(); L.badges(); } }, 20000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
