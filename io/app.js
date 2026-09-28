/* IO — app. Arriba la consola (el juego), abajo tus hábitos de hoy con su reloj. */
import * as S from './store.js';
import { cfg, saveCfg, todayIso } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import * as G from './engine.js';
import * as Focus from './focus.js';
import { openOnboarding } from './onboarding.js';
import { avatarSVG, editorHTML, normLook } from './avatar.js';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mmss = s => { s = Math.max(0, Math.round(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const ANIM = { read: 'sit', float: 'float', flex: 'flex', eat: 'jump', talk: 'wave', type: 'sit', music: 'dance', walk: 'dance', write: 'sit', clean: 'dance', jump: 'jump' };
let toastT;
function toast(msg, ms = 2600) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

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
function renderWeek() {
  const w = H.week(); const g = W.game();
  const DN = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  $('week').innerHTML = w.rows.length ? `<div class="wk-row wk-h"><span></span>${w.days.map(d => `<i>${DN[S.dateOf(d).getDay()]}</i>`).join('')}</div>` + w.rows.map(r => `<div class="wk-row"><span title="${esc(r.h.nombre)}">${esc(r.h.emoji)} ${esc(r.h.nombre)}</span>${r.cells.map(c => `<i class="c-${c}"></i>`).join('')}</div>`).join('') : '<div class="empty">Aquí verás tu semana.</div>';
  const streak = H.dayStreak();
  $('weekSum').textContent = `🔥 ${streak} ${streak === 1 ? 'día' : 'días'}`;
  $('stats').innerHTML = `<div><b>${g.stats.minutes}</b><span>minutos de hábitos</span></div><div><b>${g.stats.sessions}</b><span>hábitos completos</span></div><div><b>${W.level(g)}</b><span>piso más alto</span></div>`;
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
function renderAll() { renderTop(); renderHabits(); renderWeek(); G.render(); }

/* ================= reloj y corona ================= */
function startHabit(id) {
  Focus.open(id, { onClaim: claimFlow, onClose: () => { renderAll(); G.say('Pausado. Lo que llevas quedó guardado ⏸', 3000); } });
  renderAll();
}
function claimFlow(id) {
  const r = H.claim(id); if (!r) { renderAll(); return; }
  renderAll();
  const row = document.querySelector(`.hab[data-hid="${id}"]`);
  const act = H.actOf(r.habit);
  G.celebrate({ kind: ANIM[act] || 'jump', prop: H.PROP[act], xp: r.xp, bits: r.bits, fromEl: row,
    line: `¡${r.habit.nombre} completo! +${r.xp} XP y ${r.bits} bits${r.onTime ? ' (a tiempo +25%)' : ''}${r.streak > 1 ? `. Racha de ${r.streak} 🔥` : ''}.` });
  setTimeout(() => {
    if (r.after > r.before) G.levelUp(r.before, r.after);
    else if (H.chestReady()) G.say('🎁 ¡Completaste todo lo de hoy! Abre el cofre del día abajo.', 5000);
    renderAll();
  }, 2400);
}
function openChest() {
  const r = H.openChest(); if (!r) return;
  G.celebrate({ kind: 'dance', prop: '🎁', xp: r.xp, bits: r.bits, fromEl: $('chestBox'), line: `¡Día perfecto! El cofre trae +${r.xp} XP y ${r.bits} bits.` });
  setTimeout(() => { if (r.after > r.before) G.levelUp(r.before, r.after); renderAll(); }, 2400);
}

/* ================= sheets ================= */
function openSheet(title, html) { $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBody').scrollTop = 0; $('sheetOv').classList.add('open'); $('sheet').classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeSheet() { $('sheetOv').classList.remove('open'); $('sheet').classList.remove('open'); document.body.style.overflow = ''; }

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
    <div class="field"><label for="hfMot">¿Por qué? (te lo recordaremos si quieres pausar)</label><input class="inp" id="hfMot" value="${esc(h.motivo || '')}" maxlength="120" placeholder="Quiero…"></div>
    <div class="stack"><button class="btn-acc" data-act="saveHabit" data-id="${id || ''}">Guardar</button>
    ${id ? `<button class="btn-ghost danger" data-act="delHabit" data-id="${id}">Eliminar hábito</button>` : ''}</div>`);
}
function allHabitsSheet() {
  const hs = H.list();
  openSheet('Todos mis hábitos', `${hs.map(h => `<button class="list-row" data-act="editHabit" data-id="${h.id}"><span>${esc(h.emoji)}</span><div><b>${esc(h.nombre)}</b><small>${h.hora} · ${h.min} min · ${(h.dias || []).length === 7 ? 'todos los días' : (h.dias || []).map(d => H.DAYS[d]).join(' ')}</small></div><em>✎</em></button>`).join('') || '<div class="empty">Sin hábitos.</div>'}
    <button class="btn-acc" data-act="newHabit" style="margin-top:12px">＋ Nuevo hábito</button>`);
}

/* tienda, mochila, mapa, personaje, logros */
let shopTab = 'muebles';
function shopSheet(tab = shopTab) {
  shopTab = tab; const g = W.game(); const lvl = W.level(g); const n = g.floor; const here = W.floorInfo(n);
  const items = tab === 'ropa' ? W.WEAR : W.CATALOG.filter(i => tab === 'vehiculos' ? i.kind === 'veh' : tab === 'mascotas' ? i.kind === 'pet' : i.kind === 'mueble' && i.price > 0);
  const sorted = [...items].sort((a, b) => a.lvl - b.lvl || a.price - b.price);
  openSheet('Tienda', `
    <div class="shop-top"><span class="wallet">◆ ${g.bits} bits</span><span class="hint">Piso ${n} · ${esc(here.name)}</span></div>
    <div class="tabs">${[['muebles', '🛋️ Muebles'], ['vehiculos', '🚗 Vehículos'], ['mascotas', '🐾 Mascotas'], ['ropa', '🧢 Ropa']].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="shopTab" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="grid">${sorted.map(i => {
      const locked = lvl < i.lvl; const own = i.kind === 'wear' ? !!g.owned[i.id] : W.bagCount(g, i.id);
      const worn = i.kind === 'wear' && g.wear[i.slot] === i.id;
      return `<button class="it${locked ? ' locked' : ''}${worn ? ' on' : ''}" data-act="buy" data-id="${i.id}"><span class="e">${i.e}</span><span class="n">${esc(i.n)}</span>
        <span class="p">${worn ? 'PUESTO' : i.kind === 'wear' && own ? 'TUYO · PONER' : locked ? `🔒 NV ${i.lvl}` : `◆ ${i.price}`}</span>${own && i.kind !== 'wear' ? `<span class="bag">×${own}</span>` : ''}</button>`;
    }).join('')}</div>
    <p class="note">Los bits se ganan completando hábitos con el reloj. Nada se compra con dinero. Lo que compres aparece en este piso y lo mueves con <b>SELECT</b>.${tab === 'vehiculos' ? ' Los vehículos van en el garaje (piso 3), el garaje doble (10), el hangar (45) y el helipuerto (50).' : ''}</p>`);
}
function buy(id) {
  const it = W.itemById(id); const r = W.buy(id);
  if (!r.ok) { toast(r.msg); G.blip('error'); return; }
  G.blip('buy');
  if (it.kind === 'wear') { G.render(); G.act('dance', it.e); shopSheet(); toast(r.msg); renderTop(); return; }
  closeSheet(); renderTop();
  if (!G.placeFromBag(id)) toast(`${it.e} quedó en tu mochila`, 3500);
  else G.act('jump', it.e);
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
function achSheet() {
  const g = W.game(); const a = W.achievements(g, { streak: H.dayStreak() });
  openSheet(`Logros · ${a.filter(x => x.done).length}/${a.length}`, `<div class="ach-grid">${a.sort((x, y) => y.done - x.done).map(x => `<div class="ach${x.done ? ' done' : ''}"><span class="e">${x.e}</span><span class="n">${esc(x.n)}</span><span class="v">${x.done ? '✓' : `${x.v}/${x.goal}`}</span></div>`).join('')}</div>`);
}
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
  const pick = [0, 1, 2, 3, 12];
  const ids = pick.map(k => { const [e, n, m, h, act] = H.EXAMPLES[k]; return H.save({ emoji: e, nombre: n, min: m, hora: h, act, dias: [0, 1, 2, 3, 4, 5, 6], motivo: '' }).id; });
  const g = W.game(); g.xp = W.xpAt(7) + 40; g.bits = 900; g.stats = { minutes: 640, sessions: 31 }; g.floor = 1; W.saveGame(g);
  const l = { s: {} }; // hoy: meditar ya reclamado, ejercicio completo esperando su corona
  l.s[ids[1]] = { el: 600, done: true, claimed: true, onTime: true, reward: { xp: 16, bits: 7 } };
  l.s[ids[2]] = { el: 1800, done: true, claimed: false, onTime: true };
  S.putItem('log', l, `log:${todayIso()}`);
  for (let i = 1; i <= 4; i++) { const d = S.addDays(todayIso(), -i); const ll = { s: {} }; ids.slice(0, 3 + (i % 2)).forEach(id => { ll.s[id] = { el: 60, done: true, claimed: true }; }); S.putItem('log', ll, `log:${d}`); }
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
    H.save({ ...rest, emoji: $('hfEmoji').value, nombre, min: parseInt($('hfMin').value) || 10, hora: $('hfHora').value || '08:00', dias, motivo: $('hfMot').value.trim() }, el.dataset.id || null);
    closeSheet(); renderAll(); toast('Hábito guardado ✓');
  },
  delHabit: el => { if (el.dataset.sure) { H.remove(el.dataset.id); closeSheet(); renderAll(); toast('Hábito eliminado'); } else { el.dataset.sure = 1; el.textContent = '¿Seguro? Toca otra vez para eliminar'; } },
  shop: () => shopSheet(), shopTab: el => shopSheet(el.dataset.t), buy: el => buy(el.dataset.id),
  bag: bagSheet, place: el => { closeSheet(); G.placeFromBag(el.dataset.id); },
  goFloor: el => { const n = +el.dataset.n; if (n > W.level()) return toast(`🔒 Se abre en el nivel ${n}`); closeSheet(); $('screen').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); setTimeout(() => G.ride(n), 350); },
  storeObj: el => { G.storeSelected(el.dataset.u); closeSheet(); toast('Guardado en la mochila 🎒'); },
  saveChar: () => { saveCfg({ avatar: editLook, name: $('chName').value.trim() || cfg.name }); closeSheet(); renderAll(); G.act('dance', '✨'); G.say('¡Nuevo look!', 2500); },
  saveSettings: () => { saveCfg({ name: $('stName').value.trim() || cfg.name, sound: $('stSound').checked, wake: $('stWake').checked }); closeSheet(); toast('Guardado ✓'); },
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
addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
$('backupIn').addEventListener('change', async e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; try { S.importBackup(await f.text()); location.reload(); } catch { toast('Archivo inválido'); } });

/* ================= arranque ================= */
function afterOnb({ first, demo } = {}) {
  if (demo) seedDemo();
  if (!cfg.onboarded) saveCfg({ onboarded: true, name: cfg.name || 'Player 1' });
  renderAll();
  if (demo) { G.say('Modo demo: estás en el nivel 7. Activa la corona de “Hacer ejercicio” 👑 abajo, prueba “Respirar” (1 min) y camina hasta la puerta del ascensor.', 9000); return; }
  if (first) { G.act('dance', '👋'); G.say(`¡Bienvenido, ${cfg.name}! Este es tu cuarto en el piso 1. Cumple tus hábitos con el reloj para subir de piso. ▶ Empieza el primero abajo.`, 9000); }
}
G.init({
  onMenu: k => ({ mochila: bagSheet, tienda: () => shopSheet(), mapa: mapSheet, personaje: charSheet, logros: achSheet, ajustes: settingsSheet })[k]?.(),
  onDecoMenu: u => decoSheet(u),
  onFloor: () => renderTop(),
});
H.closeStale();
renderAll();
if (!cfg.onboarded) openOnboarding({ onDone: afterOnb });
else {
  const r = H.running();
  if (r) startHabit(r.hid);
  else { const n = H.nextUp(); G.say(n ? `Hola ${cfg.name}. Próximo: ${n.emoji} ${n.nombre} a las ${n.hora}.` : `Hola ${cfg.name}. ¡Todo listo por hoy! Camina, decora o visita tus pisos.`, 5000); }
}
S.sync().then(renderAll);
setInterval(() => { if (document.visibilityState === 'visible' && !Focus.isOpen()) { renderHabits(); renderTop(); } }, 20000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
