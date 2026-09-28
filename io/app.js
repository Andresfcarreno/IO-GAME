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
    const st = stateOf(h); const s = H.sess(h.id); const el = H.elapsed(h.id); const p = el / (h.min * 60);
    const streak = H.streakOf(h.id); const late = st === 'todo' && H.minutesOf(h.hora) < nowM - 30;
    const btn = st === 'claimed' ? `<span class="hb-ok">✓ +${s.reward?.xp ?? ''} XP</span>`
      : st === 'crown' ? `<button class="hb-btn crown" data-act="claim" data-id="${h.id}">👑 Activar</button>`
      : st === 'running' ? `<button class="hb-btn run" data-act="start" data-id="${h.id}">● ${mmss(h.min * 60 - el)}</button>`
      : st === 'paused' ? `<button class="hb-btn" data-act="start" data-id="${h.id}">⏯ ${mmss(h.min * 60 - el)}</button>`
      : `<button class="hb-btn go" data-act="start" data-id="${h.id}">▶ Empezar</button>`;
    return `<div class="hab st-${st}${late ? ' late' : ''}" data-hid="${h.id}">
      <div class="hab-ic">${ring(st === 'claimed' ? 1 : p, st === 'claimed' ? 'var(--green)' : st === 'crown' ? 'var(--amber)' : 'var(--acc2)')}<span>${st === 'crown' ? '👑' : esc(h.emoji)}</span></div>
      <button class="hab-inf" data-act="editHabit" data-id="${h.id}"><b>${esc(h.nombre)}</b><small>${h.hora} · ${h.min} min${streak ? ` · 🔥${streak}` : ''}${late ? ' · se te pasó la hora' : ''}</small></button>
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
function renderAll() { renderTop(); renderHabits(); L.render(); G.render(); renderMini(); R.publish(); }

/* ================= mini reproductor: tu próximo hábito siempre a un toque ================= */
let listVisible = false;
function renderMini() {
  const m = $('mini'); const r = H.running();
  const crown = H.forDay().find(x => { const s = H.sess(x.id); return s.done && !s.claimed; });
  const h = r ? H.get(r.hid) : crown || H.nextUp();
  const show = !!h && cfg.onboarded && !listVisible && !Focus.isOpen() && $('onb').hidden;
  m.classList.toggle('show', show); if (!show) return;
  const el = H.elapsed(h.id); const st = stateOf(h);
  const p = st === 'claimed' ? 1 : el / (h.min * 60);
  m.innerHTML = `<div class="mi-bar"><i style="width:${Math.min(100, p * 100)}%"></i></div>
    <span class="mi-e">${st === 'crown' ? '👑' : esc(h.emoji)}</span>
    <div class="mi-t"><b>${esc(h.nombre)}</b><small>${st === 'crown' ? 'Corona lista: actívala' : st === 'running' ? `● quedan ${mmss(h.min * 60 - el)}` : st === 'paused' ? `⏸ pausado · quedan ${mmss(h.min * 60 - el)}` : `Próximo · ${h.hora} · ${h.min} min`}</small></div>
    ${st === 'crown' ? `<button class="mi-go crown" data-act="claim" data-id="${h.id}" aria-label="Activar corona">👑</button>` : `<button class="mi-go" data-act="start" data-id="${h.id}" aria-label="${st === 'running' ? 'Abrir reloj' : 'Empezar'}">${st === 'running' ? '⤢' : '▶'}</button>`}`;
}

/* ================= reloj y corona ================= */
function startHabit(id) {
  Focus.open(id, { onClaim: claimFlow, onClose: () => { renderAll(); G.say('Pausado. Lo que llevas quedó guardado ⏸', 3000); } });
  renderAll();
}
function claimFlow(id) {
  const r = H.claim(id); if (!r) { renderAll(); return; }
  try { navigator.vibrate?.([40, 30, 90]); } catch { /* */ }
  renderAll();
  const row = document.querySelector(`.hab[data-hid="${id}"]`);
  const act = H.actOf(r.habit);
  G.celebrate({ kind: ANIM[act] || 'jump', prop: H.PROP[act], xp: r.xp, bits: r.bits, fromEl: row,
    line: `¡${r.habit.nombre} completo! +${r.xp} XP y ${r.bits} bits${r.onTime ? ' (a tiempo +25%)' : ''}${r.streak > 1 ? `. Racha de ${r.streak} 🔥` : ''}.` });
  setTimeout(() => {
    if (r.after > r.before) G.levelUp(r.before, r.after);
    else if (H.chestReady()) { G.say('🎁 ¡Completaste todo lo de hoy! Abre el cofre del día abajo.', 5000); L.show('hoy'); }
    renderAll();
  }, 2400);
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
    <div class="row"><div class="field"><label for="hfMin">Duración (min)</label><input class="inp" id="hfMin" type="number" min="1" max="240" value="${h.min}" inputmode="numeric"></div>
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
    <p class="note">IO es un juego que solo se gana viviendo. Siempre gratis y sin anuncios. Nada se compra con dinero: todo se gana haciendo.</p></div>`);
}
function settingsSheet() {
  openSheet('Ajustes', `
    <div class="field"><label for="stName">Tu nombre</label><input class="inp" id="stName" value="${esc(cfg.name)}" maxlength="20"></div>
    <label class="tog"><input type="checkbox" id="stSound"${cfg.sound !== false ? ' checked' : ''}> Sonidos 8-bit</label>
    <label class="tog"><input type="checkbox" id="stWake"${cfg.wake !== false ? ' checked' : ''}> Mantener la pantalla encendida durante el reloj</label>
    <div class="stack" style="margin:10px 0 4px"><button class="btn-acc" data-act="saveSettings">Guardar</button>
      <button class="btn-ghost" data-act="allHabits">📋 Mis hábitos</button>
      <button class="btn-ghost" data-act="redoOnb">🎮 Rehacer configuración inicial</button></div>
    <div class="sec-t">Ranking</div>
    <label class="tog"><input type="checkbox" id="stRank"${cfg.rankOn ? ' checked' : ''}> Aparecer en el ranking mundial</label>
    <div class="field"><label for="stRankName">Nombre público</label><input class="inp" id="stRankName" value="${esc(cfg.rankName || cfg.name)}" maxlength="20"></div>
    <p class="note">${R.online() ? 'Solo se publica tu nombre público, nivel, XP, racha y personaje. Nada de tus hábitos.' : 'El ranking mundial aún no está conectado: juegas la liga de práctica con bots 🤖.'}</p>
    <div class="sec-t">Sincronizar entre dispositivos (opcional)</div>
    <div class="field"><label for="stUrl">Supabase URL</label><input class="inp" id="stUrl" value="${esc(cfg.supaUrl)}" placeholder="https://xxxx.supabase.co"></div>
    <div class="field"><label for="stKey">Anon key</label><input class="inp" id="stKey" value="${esc(cfg.supaKey)}" autocomplete="off"></div>
    <p class="note">Estado: ${S.status.supabase === 'ok' ? '✅ sincronizado' : S.status.supabase === 'error' ? '⚠️ ' + esc(S.status.error) : 'solo en este dispositivo'}. Corre <code>supabase/schema.sql</code> una vez.</p>
    <button class="btn-ghost" data-act="testSupa">Probar conexión</button>
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
  start: el => startHabit(el.dataset.id),
  claim: el => claimFlow(el.dataset.id),
  chest: openChest,
  newHabit: () => habitSheet(null), editHabit: el => habitSheet(el.dataset.id), allHabits: allHabitsSheet,
  pickEmoji: el => { $('hfEmoji').value = el.dataset.e; document.querySelectorAll('.emo').forEach(b => b.classList.toggle('on', b === el)); },
  toggleDay: el => el.classList.toggle('on'),
  saveHabit: el => {
    const nombre = $('hfName').value.trim(); if (!nombre) return toast('Ponle nombre al hábito');
    const dias = [...document.querySelectorAll('#hfDays button')].map((b, k) => b.classList.contains('on') ? k : -1).filter(k => k >= 0);
    if (!dias.length) return toast('Elige al menos un día');
    const old = el.dataset.id ? H.get(el.dataset.id) : null;
    const { id: _o, ...rest } = old || {};
    H.save({ ...rest, emoji: $('hfEmoji').value, nombre, min: parseInt($('hfMin').value) || 10, hora: $('hfHora').value || '08:00', dias, motivo: $('hfMot').value.trim(), act: $('hfAct').value }, el.dataset.id || null);
    closeSheet(); renderAll(); toast('Hábito guardado ✓');
  },
  delHabit: el => { if (el.dataset.sure) { H.remove(el.dataset.id); closeSheet(); renderAll(); toast('Hábito eliminado'); } else { el.dataset.sure = 1; el.textContent = '¿Seguro? Toca otra vez para eliminar'; } },
  ...L.actions,
  shop: () => { closeSheet(); L.show('tienda', { scroll: true }); }, buy: el => buy(el.dataset.id),
  bag: bagSheet, place: el => { closeSheet(); place(el.dataset.id); }, character: charSheet, map: mapSheet,
  goFloor: el => { const n = +el.dataset.n; if (n > W.level()) return toast(`🔒 Se abre en el nivel ${n}`); closeSheet(); $('screen').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); setTimeout(() => G.ride(n), 350); },
  storeObj: el => { G.storeSelected(el.dataset.u); closeSheet(); toast('Guardado en la mochila 🎒'); },
  saveChar: () => { saveCfg({ avatar: editLook, name: $('chName').value.trim() || cfg.name }); closeSheet(); renderAll(); G.act('dance', '✨'); G.say('¡Nuevo look!', 2500); },
  saveSettings: async () => {
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
  onMenu: k => ({ mochila: bagSheet, tienda: () => L.show('tienda', { scroll: true }), ranking: () => L.show('ranking', { scroll: true }), progreso: () => L.show('progreso', { scroll: true }), mapa: mapSheet, personaje: charSheet, logros: achievementsTab, ajustes: settingsSheet })[k]?.(),
  onDecoMenu: u => decoSheet(u),
  onFloor: () => { renderTop(); L.render(); },
});
L.init({ renderAll, buy, place, celebrate });
H.closeStale();
const shielded = H.applyShields();
renderAll();
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
setInterval(() => { if (document.visibilityState === 'visible' && !Focus.isOpen()) { renderHabits(); renderTop(); L.badges(); } }, 20000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
