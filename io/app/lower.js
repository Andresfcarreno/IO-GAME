/* IO — la segunda pantalla del Game Boy avanzado.
 * Hoy · Tienda · Ranking · Progreso · Mundo. Todo lo que antes vivía escondido en el menú START
 * ahora también está a un toque, abajo de la consola. */
import { cfg, saveCfg, todayIso, addDays, dateOf } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import * as G from './engine.js';
import * as R from './ranking.js';
import { avatarSVG } from './avatar.js';
import * as Radio from './radio.js';
import * as Rem from './remind.js';
import * as Share from './share.js';
import * as Pet from './pet.js';
import * as So from './social.js';
import * as Auth from './auth.js';
import * as Coach from './coach.js';
import { $, esc, fmtN, toast, openSheet, closeSheet } from './ui.js';

const TABS = ['hoy', 'tienda', 'ranking', 'progreso', 'mundo'];
let tab = (() => { try { const t = localStorage.getItem('io.tab'); return TABS.includes(t) ? t : 'hoy'; } catch { return 'hoy'; } })();
let ctx = {};
export const current = () => tab;

/* ================= pestañas ================= */
export function show(t, { scroll = false, sound = true } = {}) {
  if (!TABS.includes(t)) return;
  tab = t; try { localStorage.setItem('io.tab', t); } catch { /* */ }
  document.querySelectorAll('#ltabs [data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('.lpane').forEach(p => { p.hidden = p.dataset.pane !== t; });
  $('lscreen').dataset.tab = t;
  if (sound) G.blip('tab');
  render();
  if (scroll) $('lower').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
export function render() {
  badges();
  if (tab === 'hoy') renderHoy();
  else if (tab === 'tienda') renderShop();
  else if (tab === 'ranking') { const g = W.game(); if (!g.stats.sawRank) { g.stats.sawRank = 1; W.saveGame(g); } renderRank(); }
  else if (tab === 'progreso') renderProg();
  else if (tab === 'mundo') renderWorld();
}
function badge(id, txt) { const b = $('bdg-' + id); if (!b) return; b.hidden = !txt; b.textContent = txt || ''; }
export function badges() {
  const g = W.game(); const d = W.dailyDeal(g);
  const crowns = H.forDay().filter(h => { const s = H.sess(h.id); return s.done && !s.claimed; }).length;
  badge('hoy', crowns ? '👑' : H.chestReady() ? '🎁' : H.quests().some(q => q.done && !q.claimed) ? '!' : '');
  badge('tienda', d && !d.taken && g.bits >= d.price ? '%' : g.bits >= W.BOX_PRICE && W.level(g) >= 2 ? '!' : '');
  badge('progreso', H.weekChallenge().ready ? '!' : '');
  const lvl = W.level(g); badge('mundo', g.floor < lvl ? '▲' : '');
}

/* ================= HOY: extras debajo de la lista ================= */
function renderHoy() {
  const c = H.weekChallenge();
  $('hoyWeekly').innerHTML = questsCard() + weeklyCard(c, true);
  const mp = H.moodPending()[0];
  $('hoyMood').innerHTML = mp ? `<div class="mood-card"><b>¿Cómo te sentiste con ${esc(mp.emoji)} ${esc(mp.nombre)}?</b>
    <div class="mood-row">${H.MOODS.map((m, i) => `<button data-act="mood" data-id="${mp.id}" data-v="${i + 1}" aria-label="Ánimo ${i + 1}">${m}</button>`).join('')}</div>
    <input class="inp" id="moodNote" maxlength="140" placeholder="Una línea para tu diario (opcional)">
    <button class="mood-skip" data-act="mood" data-id="${mp.id}" data-v="0">Ahora no</button></div>` : '';
  const g = W.game(); const d = W.dailyDeal(g); const col = W.collection(g);
  const chase = chaser();
  $('quick').innerHTML = `
    ${d && !d.taken ? `<button class="qk qk-deal r-${W.rarityOf(d.item).id}" data-act="tab" data-t="tienda"><span class="qk-e">${d.item.e}</span><span><b>Oferta del día −30%</b><small>${esc(d.item.n)} · ◆${d.price}</small></span></button>` : ''}
    ${chase ? `<button class="qk qk-rank" data-act="tab" data-t="ranking"><span class="qk-e">🏆</span><span><b>#${chase.pos} en ${R.online() && R.joined() ? 'el ranking' : 'tu liga'}</b><small>${chase.next ? `Te faltan ${fmtN(chase.gap)} XP para pasar a ${esc(chase.next)}` : '¡Vas de primero!'}</small></span></button>` : ''}
    ${!Rem.enabled() && Rem.state() !== 'unsupported' && Rem.state() !== 'denied' ? '<button class="qk" data-act="remindOn"><span class="qk-e">🔔</span><span><b>Activa recordatorios</b><small>te aviso a la hora de cada hábito</small></span></button>' : ''}
    <button class="qk" data-act="calendar"><span class="qk-e">📅</span><span><b>Al calendario</b><small>tus hábitos con alarma</small></span></button>
    <button class="qk" data-act="tab" data-t="tienda"><span class="qk-e">🧩</span><span><b>Colección ${col.own}/${col.total}</b><small>${Math.round(col.pct * 100)}% completa</small></span></button>`;
}
function questsCard() {
  const qs = H.quests(); if (qs.every(q => q.claimed)) return '';
  const n = qs.filter(q => q.claimed).length;
  return `<div class="qst"><div class="wch-h"><b>🎯 Primeros pasos</b><small>${n}/${qs.length}</small></div>
    ${qs.map(q => `<div class="qs${q.claimed ? ' claimed' : q.done ? ' done' : ''}"><span class="qs-e">${q.claimed ? '✓' : q.e}</span><span class="qs-n">${esc(q.n)}</span>
      ${q.claimed ? '' : q.done ? `<button class="qs-go" data-act="quest" data-id="${q.id}">+${q.bits}◆</button>` : `<em>+${q.bits}◆</em>`}</div>`).join('')}</div>`;
}
/** A quién tienes justo encima en el ranking que está cargado. */
function chaser() {
  const rows = R.state.rows; if (!rows.length) return null;
  const key = R.state.scope === 'semana' ? 'week_xp' : 'xp';
  const i = rows.findIndex(r => r.me);
  if (i < 0) return R.state.me ? { pos: R.state.me.pos, next: rows[rows.length - 1]?.name, gap: rows[rows.length - 1][key] - R.state.me[key] + 1 } : null;
  return { pos: i + 1, next: i > 0 ? rows[i - 1].name : null, gap: i > 0 ? rows[i - 1][key] - rows[i][key] + 1 : 0 };
}

/* ================= TIENDA ================= */
let shopCat = 'todo';
const CATS = [['todo', '✨ Todo'], ['season', '⏳ Temporada'], ['nuevo', '🆕 Nuevo'], ['mueble', '🛋️ Muebles'], ['veh', '🚗 Vehículos'], ['pet', '🐾 Mascotas'], ['wear', '🧢 Ropa']];
const untilMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); const s = Math.floor((m - n) / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function renderShop() {
  const g = W.game(); const lvl = W.level(g); const col = W.collection(g); const d = W.dailyDeal(g);
  let items = W.SHOPPABLE();
  if (shopCat === 'season') items = items.filter(i => i.season);
  else if (shopCat === 'nuevo') items = items.filter(i => i.lvl > lvl - 2 && i.lvl <= lvl + 3);
  else if (shopCat === 'wear') items = items.filter(i => i.kind === 'wear');
  else if (shopCat !== 'todo') items = items.filter(i => i.kind === shopCat);
  const open = items.filter(i => i.lvl <= lvl).sort((a, b) => a.price - b.price);
  const locked = items.filter(i => i.lvl > lvl).sort((a, b) => a.lvl - b.lvl || a.price - b.price);
  const cheapest = open.filter(i => !g.owned[i.id]).sort((a, b) => a.price - b.price)[0];
  $('p-tienda').innerHTML = `
    <div class="sh-wallet">
      <div class="sw-bits"><small>Tus bits</small><b><i>◆</i>${fmtN(g.bits)}</b></div>
      <div class="sw-col"><small>Colección</small><b>${col.own}<span>/${col.total}</span></b><div class="sw-bar"><i style="width:${col.pct * 100}%"></i></div></div>
      <button class="sw-share" data-act="invite" aria-label="Invitar amigos">📣<span>Invitar</span></button>
    </div>
    ${d ? dealCard(g, d) : ''}
    <button class="mbox${lvl < 2 ? ' locked' : ''}" data-act="box">
      <span class="mb-ic" aria-hidden="true"><i class="mb-lid"></i>🎁</span>
      <span class="mb-t"><b>Caja sorpresa</b><small>${W.RARITY.map(r => `<em class="rt r-${r.id}">${r.n} ${r.w}%</em>`).join('')}</small></span>
      <span class="mb-p">${lvl < 2 ? '🔒 NV 2' : `◆${W.BOX_PRICE}`}</span>
    </button>
    ${seasonBanner()}
    ${shieldCard(g, lvl)}
    <div class="chips-row" role="tablist">${CATS.map(([k, l]) => `<button class="${k === shopCat ? 'on' : ''}" data-act="shopCat" data-c="${k}">${l}</button>`).join('')}</div>
    ${cheapest && g.bits < cheapest.price ? `<p class="sh-hint">💡 Te faltan <b>${cheapest.price - g.bits}◆</b> para ${cheapest.e} ${esc(cheapest.n)} · ≈ ${Math.max(1, Math.ceil((cheapest.price - g.bits) / 12))} hábito${Math.ceil((cheapest.price - g.bits) / 12) > 1 ? 's' : ''}</p>` : ''}
    <div class="sgrid">${[...open, ...locked].map(i => shopItem(g, lvl, i)).join('') || '<div class="empty">Nada por aquí todavía.</div>'}</div>
    <p class="note">◆ Los bits solo se ganan cumpliendo hábitos con el reloj. Nada se compra con dinero, nunca.</p>`;
}
function seasonBanner() {
  const items = W.SHOPPABLE().filter(i => i.season); if (!items.length) return '';
  const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); const d = Math.ceil((end - now) / 864e5);
  return `<button class="season" data-act="shopCat" data-c="season"><span class="ss-e">${items.map(i => i.e).join('')}</span><div><b>Temporada: ${esc(W.seasonName())}</b><small>⏳ Solo este mes · quedan ${d} día${d === 1 ? '' : 's'}</small></div><em>LIMITADO</em></button>`;
}
function shieldCard(g, lvl) {
  const n = g.shields || 0; const lock = lvl < W.SHIELD.lvl;
  return `<div class="shield${lock ? ' locked' : ''}"><span class="sh-e">🛡️</span><div><b>Escudo de racha <em>${n}/${W.SHIELD.max}</em></b><small>Si un día fallas, tu racha 🔥 no se rompe. Se activa solo.</small></div>
    <button data-act="shield"${n >= W.SHIELD.max || lock ? ' disabled' : ''}>${lock ? `🔒 NV ${W.SHIELD.lvl}` : n >= W.SHIELD.max ? 'Lleno' : `◆${W.SHIELD.price}`}</button></div>`;
}
function dealCard(g, d) {
  const it = d.item; const r = W.rarityOf(it);
  if (d.taken) return `<div class="deal taken"><span class="deal-e">✓</span><div class="deal-t"><b>Oferta de hoy tomada</b><small>Mañana hay otra. Vuelve en <span data-countdown>${untilMidnight()}</span></small></div></div>`;
  return `<div class="deal r-${r.id}">
    <span class="deal-tag">OFERTA DEL DÍA · −30%</span>
    <button class="deal-e" data-act="item" data-id="${it.id}" aria-label="Ver ${esc(it.n)}">${it.e}</button>
    <div class="deal-t"><b>${esc(it.n)}</b><small><em class="rt r-${r.id}">${r.n}</em> <s>◆${it.price}</s> <strong>◆${d.price}</strong></small><small>⏳ termina en <span data-countdown>${untilMidnight()}</span></small></div>
    <button class="deal-buy" data-act="buyDeal"${g.bits < d.price ? ' data-poor="1"' : ''}>${g.bits < d.price ? `Faltan ${d.price - g.bits}◆` : 'Comprar'}</button>
  </div>`;
}
function shopItem(g, lvl, i) {
  const r = W.rarityOf(i); const locked = lvl < i.lvl; const own = g.owned[i.id] || 0;
  const worn = i.kind === 'wear' && g.wear[i.slot] === i.id; const isNew = !locked && i.lvl >= lvl - 1 && !own && i.lvl > 1;
  const p = worn ? 'PUESTO' : i.kind === 'wear' && own ? 'TUYO' : locked ? `🔒 NV ${i.lvl}` : `◆${fmtN(i.price)}`;
  const poor = !locked && !(i.kind === 'wear' && own) && g.bits < i.price;
  return `<button class="si r-${r.id}${locked ? ' locked' : ''}${worn ? ' on' : ''}${poor ? ' poor' : ''}" data-act="item" data-id="${i.id}">
    <span class="si-e">${i.e}</span><span class="si-n">${esc(i.n)}</span><span class="si-p">${p}</span>
    ${i.season ? '<i class="si-new ltd">LIMITADO</i>' : isNew ? '<i class="si-new">NUEVO</i>' : ''}${own && i.kind !== 'wear' ? `<i class="si-own">×${own}</i>` : ''}
  </button>`;
}
const WHERE = { floor: 'Va en el piso', wall: 'Va en la pared', ceiling: 'Cuelga del techo' };
export function itemSheet(id) {
  const g = W.game(); const lvl = W.level(g); const it = W.itemById(id); if (!it) return;
  const r = W.rarityOf(it); const d = W.dailyDeal(g); const isDeal = !!(d && !d.taken && d.item.id === id);
  const price = isDeal ? d.price : it.price;
  const own = g.owned[id] || 0; const locked = lvl < it.lvl && !isDeal;
  const need = W.xpAt(it.lvl) - g.xp;
  const kind = it.kind === 'veh' ? '🚗 Vehículo · solo en garajes, hangar y helipuerto' : it.kind === 'pet' ? '🐾 Mascota · camina sola por tu piso' : it.kind === 'wear' ? `🧢 Para tu personaje · ${it.slot === 'head' ? 'cabeza' : 'cara'}` : `🛋️ Mueble · ${WHERE[it.band]}`;
  const wearCls = w => ['head', 'face'].map(s => (s === it.slot && w ? 'wear-' + it.id : g.wear[s] ? 'wear-' + g.wear[s] : '')).join(' ');
  const action = it.kind === 'wear' && own
    ? `<button class="btn-acc" data-act="buy" data-id="${id}">${g.wear[it.slot] === id ? 'Quitármelo' : 'Ponérmelo'}</button>`
    : locked ? `<div class="lock-box"><b>🔒 Se desbloquea en el nivel ${it.lvl}</b><small>Te faltan ${fmtN(need)} XP · sigue cumpliendo hábitos</small><div class="sw-bar"><i style="width:${Math.min(100, g.xp / W.xpAt(it.lvl) * 100)}%"></i></div></div>`
    : `<button class="btn-acc${g.bits < price ? ' poor' : ''}" data-act="${isDeal ? 'buyDeal' : 'buy'}" data-id="${id}">${g.bits < price ? `Te faltan ${price - g.bits}◆` : `Comprar · ◆${fmtN(price)}`}</button>`;
  openSheet(it.n, `
    <div class="is-hero r-${r.id}">
      ${it.kind === 'wear' ? `<div class="is-av ${wearCls(true)}" data-mood="happy">${avatarSVG(cfg.avatar, 'av')}</div>` : `<span class="is-e">${it.e}</span>`}
      <em class="rt r-${r.id}">${r.n}</em>
    </div>
    <div class="is-info"><div><small>Tipo</small><b>${kind}</b></div>
      <div><small>Precio</small><b>${isDeal && price !== it.price ? `<s>◆${it.price}</s> ◆${price}` : `◆${fmtN(it.price)}`}</b></div>
      <div><small>Tienes</small><b>${it.kind === 'wear' ? (own ? 'Sí' : 'No') : own}</b></div>
      <div><small>Nivel</small><b>${it.lvl}</b></div></div>
    <div class="stack">${action}
      <button class="btn-ghost" data-act="shareItem" data-id="${id}">📣 Presumirlo</button></div>`);
}

/* caja sorpresa */
export function openBox() {
  const r = W.mysteryBox();
  if (!r.ok) { toast(r.msg); G.blip('error'); return; }
  const el = $('reveal'); const rar = r.rarity.id;
  el.innerHTML = `<div class="rv-in"><div class="rv-box"><i class="rv-lid"></i><span>🎁</span></div><p class="rv-tap">Abriendo…</p></div>`;
  el.hidden = false; el.dataset.r = ''; document.body.style.overflow = 'hidden';
  G.blip('shake'); setTimeout(() => G.blip('shake'), 350); setTimeout(() => G.blip('shake'), 700);
  setTimeout(() => {
    const it = r.item; el.dataset.r = rar;
    G.blip(rar === 'legend' || rar === 'epico' ? 'legend' : rar === 'raro' ? 'rare' : 'buy');
    el.innerHTML = `<div class="rv-in show">
      <div class="rv-rays"></div>
      <div class="rv-item">${it.e}</div>
      <em class="rt r-${rar}">${r.rarity.n}</em>
      <h3>${esc(it.n)}</h3>
      <p>${r.isNew ? '✨ ¡Nuevo en tu colección!' : 'Repetido · queda en tu mochila'}</p>
      <div class="rv-bin" aria-hidden="true">${[...Array(24)].map(() => `<i style="--d:${(Math.random() * 1.2).toFixed(2)}s;--x:${(Math.random() * 100).toFixed(0)}%">${Math.random() > .5 ? 1 : 0}</i>`).join('')}</div>
      <div class="rv-btns">
        ${it.kind === 'wear' ? `<button class="btn-acc" data-act="rvWear" data-id="${it.id}">Ponérmelo</button>` : `<button class="btn-acc" data-act="rvPlace" data-id="${it.id}">Colocar en mi piso</button>`}
        <button class="btn-ghost" data-act="shareItem" data-id="${it.id}" data-box="1">📣 Presumirlo</button>
        <button class="btn-ghost" data-act="rvClose">${W.game().bits >= W.BOX_PRICE ? `Otra caja ◆${W.BOX_PRICE}` : 'Cerrar'}</button>
      </div></div>`;
    el.querySelector('[data-act="rvClose"]').dataset.again = W.game().bits >= W.BOX_PRICE ? '1' : '';
    ctx.renderAll?.();
  }, 1250);
}
export function closeReveal() { $('reveal').hidden = true; $('reveal').innerHTML = ''; document.body.style.overflow = ''; }

/* compartir / invitar: el crecimiento viene de la gente, no de anuncios */
export async function share(text) {
  const url = location.origin + location.pathname;
  const data = { title: 'IO · el código de tu vida', text, url };
  try { if (navigator.share) { await navigator.share(data); return; } } catch (e) { if (e?.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Copiado. Pégalo donde quieras 📋'); } catch { toast(`${text} ${url}`, 6000); }
}
export function inviteText() {
  const g = W.game(); const lvl = W.level(g); const f = W.floorInfo(lvl);
  return `Voy en el piso ${lvl} de mi edificio en IO (${f.ic} ${f.name}) con 🔥${H.dayStreak()} días de racha. Los puntos solo se ganan cumpliendo hábitos con el reloj. ¿Me alcanzas?`;
}

/* ================= RANKING ================= */
let rankBusy = false;
export async function loadRank(scope = R.state.scope) {
  if (rankBusy) return; rankBusy = true;
  try { await R.load(scope); } finally { rankBusy = false; }
  if (tab === 'ranking') renderRank(); else if (tab === 'hoy') renderHoy();
}
const face = (look, wear, cls = 'rk-face') => `<span class="${cls} ${['head', 'face'].map(s => wear?.[s] ? 'wear-' + wear[s] : '').join(' ')}" data-mood="happy">${avatarSVG(look, 'av', '28 2 64 64')}</span>`;
function renderRank() {
  const st = R.state; const scope = st.scope; const key = scope === 'semana' ? 'week_xp' : 'xp';
  const practice = !R.online() || st.local;
  const rows = st.rows;
  const top3 = rows.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]].map((r, k) => r ? `<div class="pd pd-${[2, 1, 3][k]}${r.me ? ' me' : ''}" data-act="visitTop" data-k="${rows.indexOf(r)}" role="button">
      ${[2, 1, 3][k] === 1 ? '<span class="pd-crown">👑</span>' : ''}${face(r.look, r.wear, 'pd-face')}
      <b>${esc(r.name)}</b><small>NV ${r.level} · ${fmtN(r[key])} XP</small><i>${[2, 1, 3][k]}</i></div>` : '<div class="pd"></div>').join('');
  const ch = chaser(); shown = [];
  const moved = So.updateLeague(); const L = So.league(); const D = So.DIVS[L.div];
  if (moved && !L.told) { const g = W.game(); g.league.told = 1; W.saveGame(g); toast(moved === 'up' ? `⬆️ ¡Subiste a la liga ${D[0]} ${D[1]}!` : moved === 'down' ? `⬇️ Bajaste a la liga ${D[0]}. ¡Esta semana la recuperas!` : `Sigues en la liga ${D[0]} ${D[1]}`, 5000); }
  const zone = (pos, n) => scope !== 'semana' ? '' : pos <= So.ZONE && L.div < So.DIVS.length - 1 ? ' z-up' : pos > n - So.ZONE && L.div > 0 ? ' z-down' : '';
  $('p-ranking').innerHTML = `
    <div class="rk-head">
      <div class="chips-row"><button class="${scope === 'global' ? 'on' : ''}" data-act="rankScope" data-s="global">🌎 Global</button><button class="${scope === 'semana' ? 'on' : ''}" data-act="rankScope" data-s="semana">⚡ Esta semana</button></div>
      <button class="rk-ref" data-act="rankReload" aria-label="Actualizar">↻</button>
    </div>
    ${!R.online() ? `<div class="rk-note">🌎 <b>El ranking mundial se activa con el servidor.</b> Por ahora ves solo tu progreso.</div>`
      : !Auth.signedIn() ? `<div class="rk-join"><b>Entra con tu cuenta para aparecer</b><small>Con Google o tu correo. Tu nombre y tu nivel aparecen aquí; tus hábitos nunca salen de tu celular.</small><button class="btn-acc" data-act="login">Iniciar sesión</button></div>`
      : st.error ? `<div class="rk-note">⚠️ No se pudo cargar el ranking. <small>${esc(st.error.slice(0, 80))}</small></div>` : ''}
    ${R.online() && st.total ? `<div class="rk-count">👥 ${fmtN(st.total)} jugador${st.total === 1 ? '' : 'es'} en IO${st.total < 10 ? ' · ¡invita a tus amigos y llénalo!' : ''}</div>` : ''}
    ${ch && ch.next ? `<div class="rk-chase">🎯 Te faltan <b>${fmtN(ch.gap)} XP</b> para pasar a <b>${esc(ch.next)}</b> y quedar #${ch.pos - 1}</div>` : ch ? '<div class="rk-chase gold">👑 ¡Vas de primero! Todos te quieren alcanzar.</div>' : ''}
    ${scope === 'semana' ? `<div class="lg-card" style="--lc:${D[2]}"><span class="lg-ic">${D[1]}</span><div><b>Liga ${D[0]}</b><small>Termina en ${So.endsIn()} · vas <b>#${L.rank || '—'}</b></small><small>⬆ los ${So.ZONE} primeros suben · ⬇ los ${So.ZONE} últimos bajan</small></div>
      <div class="lg-ladder">${So.DIVS.map((d, i) => `<i class="${i === L.div ? 'on' : i < L.div ? 'past' : ''}" title="${d[0]}">${d[1]}</i>`).join('')}</div></div>` : ''}
    <div class="podium">${podium}</div>
    <ol class="rk-list">${rows.slice(3, 100).map((r, i) => rankRow(r, i + 4, key, zone(i + 4, rows.length))).join('')}</ol>
    ${st.me ? `<div class="rk-me-sep">···</div><ol class="rk-list">${rankRow(st.me, st.me.pos, key)}</ol>` : ''}
    ${togetherCard()}
    ${!rows.length ? '<div class="empty">Cargando ranking…</div>' : ''}
    <div class="stack" style="margin-top:12px"><button class="btn-ghost" data-act="invite">📣 Reta a tus amigos</button>
      ${R.online() && R.joined() ? '<button class="btn-ghost" data-act="rankLeave">Salir del ranking</button>' : ''}</div>
    <p class="note">${scope === 'semana' ? 'La tabla semanal se reinicia cada lunes: cualquiera puede ganarla.' : 'Top 100 por XP total. Tu nivel es tu piso.'} Títulos: ${W.TITLES.map(([l, t]) => `${t} (${l}+)`).join(' · ')}.</p>`;
}
let shown = [];
function rankRow(r, pos, key, zone = '') {
  shown.push(r);
  return `<li class="rk${r.me ? ' me' : ''}${zone}" data-act="visit" data-i="${shown.length - 1}" role="button" tabindex="0"><span class="rk-pos">${pos}</span>${face(r.look, r.wear)}
    <span class="rk-n"><b>${esc(r.name)}${r.me ? ' <em>TÚ</em>' : ''}</b><small>${W.titleOf(r.level)} · piso ${r.level}${r.streak ? ` · 🔥${r.streak}` : ''}</small></span>
    <span class="rk-xp">${fmtN(r[key])}<small>XP</small></span></li>`;
}

function togetherCard() {
  const code = So.room();
  return `<div class="pg-sec tg-card"><div class="h-head"><h2>👥 Sesiones juntos</h2><span class="h-prog">${code ? 'sala ' + code : 'enfócate acompañado'}</span></div>
    <p class="note">Crea una sala e invita a tus amigos: cuando arranquen su reloj, sus personajes aparecen en tu pantalla haciendo lo suyo. Estudiar o entrenar acompañado funciona.</p>
    ${code ? `<div class="tg-code"><b>${code}</b><button class="btn-ghost" data-act="roomShare">📣 Invitar</button><button class="btn-ghost" data-act="roomLeave">Salir</button></div>${Auth.signedIn() ? '' : '<p class="note">Inicia sesión para que tus amigos te vean en la sala.</p>'}`
      : `<div class="row"><button class="btn-acc" data-act="roomNew">＋ Crear sala</button><input class="inp" id="roomIn" maxlength="8" placeholder="Código" style="text-transform:uppercase"><button class="btn-ghost" data-act="roomJoin" style="width:auto">Entrar</button></div>`}</div>`;
}
/** El cuarto de otra persona, en miniatura. */
export function miniRoom(room, look, wear, name = '') {
  const f = W.floorInfo(room.f); const B = { '': '14%', table: 'calc(14% + 24px)', shelf2: '47%', shelf1: '64%' };
  const pet = room.p ? Pet.SPECIES[room.p[0]]?.chain[room.p[1]] : '';
  return `<div class="vroom${f.open ? ' open' : ''}" data-skin="${f.world.skin}" data-type="${f.type}">
    <div class="vr-wall"></div><div class="vr-floor"></div><div class="vr-win"></div>
    ${f.open ? '' : '<i class="vr-shf s1"></i><i class="vr-shf s2"></i><div class="vr-sb"></div>'}
    ${room.r.map(([id, x, on, y]) => { const it = W.itemById(id); if (!it) return ''; const k = on ? .72 : 1;
      const pos = it.band === 'wall' ? `top:${12 + Math.max(0, y) * .4}%` : it.band === 'ceiling' ? 'top:8%' : `bottom:${B[on] || B['']}`;
      return `<span class="vr-it" style="left:${x}%;${pos};font-size:${Math.round(26 * it.s * k * (it.band === 'wall' ? 1.2 : 1))}px">${it.e}</span>`; }).join('')}
    <div class="vr-av ${['head', 'face'].map(s => wear?.[s] ? 'wear-' + wear[s] : '').join(' ')}" data-mood="happy">${avatarSVG(look, 'av')}</div>
    ${pet ? `<span class="vr-pet">${pet}</span>` : ''}
    <div class="vr-tag">PISO ${room.f} · ${f.ic} ${esc(f.name)}${name ? ' · de ' + esc(name) : ''}</div></div>`;
}
async function visit(r) {
  if (!r) return;
  const st = R.state.scope === 'semana' ? 'week_xp' : 'xp';
  openSheet(r.me ? 'Tu edificio' : `Visitando a ${r.name}`, `
    ${miniRoom(r.room || { f: 1, r: [], p: null }, r.look, r.wear, r.me ? '' : r.name)}
    <div class="vs-info"><div><small>Título</small><b>${esc(W.titleOf(r.level))}</b></div><div><small>Nivel</small><b>${r.level}</b></div><div><small>Racha</small><b>🔥 ${r.streak}</b></div><div><small>${st === 'xp' ? 'XP total' : 'XP semana'}</small><b>${fmtN(r[st])}</b></div></div>
    <div class="vs-likes"><span id="vsLikes">❤️ …</span> esta semana</div>
    ${r.me ? '<button class="btn-acc" data-act="story">📸 Compartir mi edificio</button>' : `<button class="btn-acc${So.liked(r.id) ? ' off' : ''}" data-act="like" data-id="${esc(r.id)}">${So.liked(r.id) ? '❤️ Ya le diste like' : '❤️ Dar like'}</button>`}
`);
  visit.row = r;
  const n = await So.likesOf(r.me ? 'me' : r.id); const el = document.getElementById('vsLikes'); if (el) el.textContent = `❤️ ${n}`;
}

/* ================= PROGRESO ================= */
function weeklyCard(c, compact = false) {
  const dl = c.daysLeft;
  return `<div class="wch${c.ready ? ' ready' : ''}${c.claimed ? ' claimed' : ''}${compact ? ' compact' : ''}">
    <div class="wch-h"><b>⚡ Reto semanal</b><small>${c.claimed ? '✓ reclamado' : dl ? `quedan ${dl} día${dl > 1 ? 's' : ''}` : 'último día'}</small></div>
    <p>Cumple <b>${c.target}</b> hábitos esta semana · premio <b>◆${c.reward.bits} + ${c.reward.xp} XP</b></p>
    <div class="wch-bar"><i style="width:${c.pct * 100}%"></i><span>${Math.min(c.done, c.target)}/${c.target}</span></div>
    ${c.ready ? '<button class="wch-go" data-act="weekly">🏆 Reclamar premio</button>' : ''}
  </div>`;
}
function renderProg() {
  const g = W.game(); const w = H.week(); const DN = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const month = H.monthGoals(); const hm = H.heatmap(12); const ach = W.achievements(g, { streak: H.dayStreak() });
  const mname = dateOf(todayIso()).toLocaleDateString('es', { month: 'long' });
  const best = Math.max(g.stats.best || 0, ...H.list().map(h => H.streakOf(h.id)), 0);
  const tips = Coach.tips(); renderProg.tips = tips; const ms = H.moodStats(30);
  $('p-progreso').innerHTML = `
    <div class="coach-card"><div class="h-head"><h2>🧠 Coach IO</h2><span class="h-prog">tus últimas 2 semanas</span></div>
      ${tips.map((t, i) => `<div class="tip"><span>${t.e}</span><div><b>${esc(t.t)}</b><small>${esc(t.d)}</small></div>${t.act ? `<button data-act="coachApply" data-i="${i}">${t.act.start ? '▶ Ya' : 'Aplicar'}</button>` : ''}</div>`).join('')}</div>
    ${weeklyCard(H.weekChallenge())}
    <div class="pg-sec"><div class="h-head"><h2>Tu semana</h2><span class="h-prog">🔥 ${H.dayStreak()} ${H.dayStreak() === 1 ? 'día' : 'días'}</span></div>
      <div class="week">${w.rows.length ? `<div class="wk-row wk-h"><span></span>${w.days.map(d => `<i>${DN[dateOf(d).getDay()]}</i>`).join('')}</div>` + w.rows.map(r => `<div class="wk-row"><span title="${esc(r.h.nombre)}">${esc(r.h.emoji)} ${esc(r.h.nombre)}</span>${r.cells.map(c => `<i class="c-${c}"></i>`).join('')}</div>`).join('') : '<div class="empty">Aquí verás tu semana.</div>'}</div></div>
    <div class="pg-sec"><div class="h-head"><h2>Metas de ${esc(mname)}</h2><span class="h-prog">minutos</span></div>
      ${month.map(m => `<div class="mg"><span class="mg-e">${esc(m.h.emoji)}</span><div class="mg-b"><div class="mg-t"><b>${esc(m.h.nombre)}</b><small>${m.minutes}/${m.goal} min · ${m.done}/${m.plan} días</small></div><div class="mg-bar"><i style="width:${Math.min(100, m.pct * 100)}%"></i></div></div></div>`).join('') || '<div class="empty">Crea hábitos para ver tus metas.</div>'}</div>
    <div class="pg-sec"><div class="h-head"><h2>12 semanas en 1 y 0</h2><span class="h-prog">L → D</span></div>
      <div class="heat">${hm.map(wk => `<div class="hcol">${wk.map(c => `<i class="h${c.future ? 'f' : Math.min(3, c.n)}" title="${c.iso}: ${c.n}">${c.future ? '' : c.n ? 1 : 0}</i>`).join('')}</div>`).join('')}</div></div>
    <div class="pg-sec"><div class="h-head"><h2>Tu ánimo</h2><span class="h-prog">${ms.n ? `${H.MOODS[Math.round(ms.avg) - 1]} promedio · ${ms.n} registros` : 'últimos 30 días'}</span></div>
      ${ms.byHabit.length ? ms.byHabit.map(x => `<div class="mg"><span class="mg-e">${esc(x.h.emoji)}</span><div class="mg-b"><div class="mg-t"><b>${esc(x.h.nombre)}</b><small>${H.MOODS[Math.round(x.avg) - 1]} ${x.avg.toFixed(1)}/5</small></div><div class="mg-bar mood"><i style="width:${x.avg / 5 * 100}%"></i></div></div></div>`).join('')
        : '<div class="empty">Después de cada corona te pregunto cómo te sentiste. Aquí verás qué hábitos te hacen bien.</div>'}
      ${ms.notes.length ? `<div class="diary">${ms.notes.map(n => `<div><span>${H.MOODS[n.mood - 1]}</span><p>${esc(n.note)}<small>${esc(n.h?.emoji || '')} ${esc(n.h?.nombre || '')} · ${n.iso.slice(5).split('-').reverse().join('/')}</small></p></div>`).join('')}</div>` : ''}</div>
    <div class="stats">
      <div><b>${fmtN(g.stats.minutes)}</b><span>minutos</span></div><div><b>${fmtN(g.stats.sessions)}</b><span>hábitos completos</span></div><div><b>${best}</b><span>mejor racha</span></div>
      <div><b>${Object.keys(g.chest).length}</b><span>días perfectos</span></div><div><b>${fmtN(g.stats.spent || 0)}</b><span>bits invertidos</span></div><div><b>${g.stats.boxes || 0}</b><span>cajas abiertas</span></div>
    </div>
    <div class="pg-sec" id="achSec"><div class="h-head"><h2>Logros</h2><span class="h-prog">${ach.filter(x => x.done).length}/${ach.length}</span></div>
      <div class="ach-grid">${ach.sort((x, y) => y.done - x.done || y.v / y.goal - x.v / x.goal).map(x => `<div class="ach${x.done ? ' done' : ''}"><span class="e">${x.e}</span><span class="n">${esc(x.n)}</span><span class="v">${x.done ? '✓' : `${x.v}/${x.goal}`}</span><i class="ach-bar" style="width:${x.v / x.goal * 100}%"></i></div>`).join('')}</div></div>`;
}

/* ================= MUNDO ================= */
function themeCard(lvl) {
  const cur = cfg.gb || 'clasico';
  return `<div class="pg-sec"><div class="h-head"><h2>🎮 Tu consola</h2><span class="h-prog">nuevos colores al subir</span></div>
    <div class="themes">${W.THEMES.map(([id, n, l, c]) => `<button class="${cur === id ? 'on' : ''}${lvl < l ? ' locked' : ''}" data-act="theme" data-id="${id}" style="--tc:${c}"${lvl < l ? ' disabled' : ''}><i></i><b>${n}</b><small>${lvl < l ? '🔒 nivel ' + l : cur === id ? 'puesto' : 'usar'}</small></button>`).join('')}</div></div>`;
}
function petCard() {
  const p = Pet.get();
  const chain = p.sp ? Pet.SPECIES[p.sp].chain : ['🥚', '❔', '❔', '❔', '❔'];
  return `<div class="pg-sec pet-card"><div class="h-head"><h2>${p.stage ? esc(p.name) : 'Tu compañero'}</h2><span class="h-prog">${p.stage ? `${esc(p.spName)} · ${p.stageName}` : 'huevo'}</span></div>
    <div class="pet-row"><span class="pet-big mood-${p.mood}${p.stage === 0 ? ' egg' : ''}">${p.e}</span>
      <div><div class="pet-chain">${chain.map((e, i) => `<i class="${i <= p.stage ? 'on' : ''}">${i <= p.stage ? e : '❔'}</i>`).join('<b>›</b>')}</div>
        <small>${p.toNext ? `${p.stage === 0 ? 'Nace' : 'Evoluciona a ' + p.nextName.toLowerCase()} en <b>${p.toNext}</b> corona${p.toNext === 1 ? '' : 's'}` : '¡Forma legendaria!'}</small>
        <div class="sw-bar"><i style="width:${p.pct * 100}%"></i></div>
        <small>Ánimo: ${p.mood === 'feliz' ? '😊 feliz, cumpliste hoy' : p.mood === 'triste' ? '😢 te extrañó ayer' : '🙂 tranquilo'}</small></div></div>
    ${p.stage ? '<button class="btn-ghost" data-act="petName">✏️ Cambiarle el nombre</button>' : ''}</div>`;
}
function radioCard(lvl) {
  const on = Radio.current();
  if (lvl < Radio.RADIO_LVL) return `<div class="pg-sec radio-card locked"><div class="h-head"><h2>📻 Radio</h2><span class="h-prog">🔒 nivel ${Radio.RADIO_LVL}</span></div><p class="note">Sonidos para acompañar tus hábitos: lluvia, lo-fi, bosque, olas… Llega de regalo en el nivel ${Radio.RADIO_LVL}.</p></div>`;
  return `<div class="pg-sec radio-card"><div class="h-head"><h2>📻 Radio</h2><span class="h-prog">${on ? '● sonando' : 'apagada'}</span></div>
    <div class="rst">${Radio.STATIONS.map(st => `<button class="${on === st.id ? 'on' : ''}${lvl < st.lvl ? ' locked' : ''}" data-act="radioSt" data-id="${st.id}"${lvl < st.lvl ? ' disabled' : ''}><span>${lvl < st.lvl ? '🔒' : st.e}</span><b>${st.n}</b><small>${lvl < st.lvl ? 'nivel ' + st.lvl : on === st.id ? 'sonando' : 'tocar'}</small></button>`).join('')}</div>
    <div class="radio-row"><label>🔈 <input type="range" min="0" max="1" step=".05" value="${cfg.radioVol ?? .6}" data-radio-vol aria-label="Volumen"></label>
      <label class="tog"><input type="checkbox" data-radio-auto${cfg.radioAuto ? ' checked' : ''}> Prender sola en el reloj</label></div>
    ${on ? '<button class="btn-ghost" data-act="radioOff">⏹ Apagar</button>' : ''}</div>`;
}
function renderWorld() {
  const g = W.game(); const lvl = W.level(g); const p = W.progressOf(g.xp); const nx = W.floorInfo(lvl + 1);
  const w = W.worldOf(g.floor); const top = Math.min(w.to, Math.max(lvl + 3, w.from + 5));
  const floors = []; for (let k = top; k >= w.from; k--) floors.push(W.floorInfo(k));
  const miles = Object.entries({ 3: 'Garaje', 10: 'Garaje doble', 11: 'Torre Centro', 15: 'Piscina', 20: 'Spa', 25: 'Terraza', 26: 'Rascacielos IO', 30: 'Cine', 40: 'Observatorio', 50: 'Helipuerto', 51: 'Ciudad en las nubes', 76: 'Estación orbital', 100: 'Puente de mando' })
    .map(([n, t]) => [+n, t]).filter(([n]) => n > lvl).slice(0, 4);
  const look = cfg.avatar; const f = W.floorInfo(g.floor);
  $('p-mundo').innerHTML = `
    <div class="wd-card">
      <div class="wd-av ${['head', 'face'].map(s => g.wear[s] ? 'wear-' + g.wear[s] : '').join(' ')}" data-mood="happy">${avatarSVG(look, 'av')}</div>
      <div class="wd-inf"><small>${esc(W.titleOf(lvl))}</small><b>${esc(cfg.name || 'Player 1')}</b>
        <span>Nivel ${lvl} · ${esc(w.n)}</span>
        <div class="wd-xp"><i style="width:${p.pct * 100}%"></i></div><small>${fmtN(p.into)}/${fmtN(p.need)} XP · piso ${lvl + 1}: ${nx.ic} ${esc(nx.name)}</small>
        <div class="wd-btns"><button data-act="character">🧍 Personaje</button><button data-act="bag">🎒 Mochila</button></div></div>
    </div>
    <div class="tower" data-skin="${w.skin}">
      <div class="tw-roof"><b>${esc(w.n)}</b><small>pisos ${w.from}–${w.to}</small></div>
      ${floors.map(fl => `<button class="tw-f${fl.n > lvl ? ' locked' : ''}${fl.n === g.floor ? ' here' : ''}${fl.n === lvl + 1 ? ' next' : ''}" data-act="goFloor" data-n="${fl.n}">
        <i>${fl.n}</i><span>${fl.n > lvl + 1 ? '▒▒▒▒▒▒' : `${fl.ic} ${esc(fl.name)}`}</span><em>${fl.n === g.floor ? '📍 aquí' : fl.n <= lvl ? 'ir ▸' : fl.n === lvl + 1 ? `${Math.round(p.pct * 100)}%` : '🔒'}</em></button>`).join('')}
      <div class="tw-base">🚪 Lobby</div>
    </div>
    <div class="pg-sec"><div class="h-head"><h2>Próximas metas</h2><span class="h-prog">nivel = piso</span></div>
      ${miles.map(([n, t]) => { const need = W.xpAt(n) - g.xp; return `<div class="mile"><i>${n}</i><b>${esc(t)}</b><small>faltan ${fmtN(need)} XP · ≈ ${Math.max(1, Math.round(need / 90))} días</small></div>`; }).join('')}</div>
    ${petCard()}
    ${themeCard(lvl)}
    ${radioCard(lvl)}
    <div class="stack"><button class="btn-ghost" data-act="map">🗺️ Mapa completo del edificio</button><button class="btn-ghost" data-act="story">📸 Tarjeta para mis historias</button></div>
    <p class="note">Estás en el piso ${g.floor} · ${f.ic} ${esc(f.name)}. Toca un piso para tomar el ascensor.</p>`;
}

/* ================= acciones ================= */
export const actions = {
  tab: el => { closeSheet(); show(el.dataset.t, { scroll: true }); },
  shopCat: el => { shopCat = el.dataset.c; G.blip('menu'); renderShop(); },
  item: el => itemSheet(el.dataset.id),
  buyDeal: () => { const d = W.dailyDeal(); if (d) ctx.buy(d.item.id, { deal: true }); },
  box: () => openBox(),
  theme: el => { saveCfg({ gb: el.dataset.id }); document.body.dataset.gb = el.dataset.id; G.blip('select'); renderWorld(); },
  mood: el => { const v = +el.dataset.v; H.setMood(el.dataset.id, v, v ? (document.getElementById('moodNote')?.value || '') : ''); if (v) { G.blip('select'); toast(v >= 4 ? '💜 ¡Qué bien! Guardado en tu diario' : '💜 Gracias por contarlo. Mañana es otro día', 2600); } renderHoy(); },
  coachApply: el => { const t = renderProg.tips?.[+el.dataset.i]; if (!t?.act) return; if (t.act.start) return ctx.start(t.act.start); const h = H.get(t.act.id); if (!h) return; const { id, ...rest } = h; H.save({ ...rest, ...(t.act.min ? { min: t.act.min } : {}), ...(t.act.hora ? { hora: t.act.hora } : {}) }, id); G.blip('buy'); toast('✅ Ajustado. Tu coach lo revisa en unos días', 3000); ctx.renderAll(); },
  visit: el => visit(shown[+el.dataset.i]),
  visitTop: el => visit(R.state.rows[+el.dataset.k]),
  like: async el => { const r = visit.row; if (!r) return; const res = await So.like(r); if (!res.ok) return toast(res.msg); G.blip('coin'); el.textContent = '❤️ ¡Enviado!'; el.classList.add('off'); const v = document.getElementById('vsLikes'); if (v) v.textContent = v.textContent.replace(/\d+/, n => +n + 1); },
  roomNew: () => { const c = So.createRoom(); G.blip('select'); renderRank(); share(`Enfoquémonos juntos en IO 👥 Sala ${c}: ${So.roomLink(c)}`); },
  roomJoin: () => { const c = So.joinRoom(document.getElementById('roomIn').value); if (!c) return toast('Escribe un código válido'); toast(`👥 Entraste a la sala ${c}`); renderRank(); },
  roomShare: () => share(`Enfoquémonos juntos en IO 👥 Sala ${So.room()}: ${So.roomLink(So.room())}`),
  roomLeave: () => { So.leaveRoom(); renderRank(); },
  petName: () => { const n = prompt('¿Cómo se llama tu compañero?', Pet.get().name); if (n && n.trim()) { Pet.rename(n); ctx.renderAll(); toast('❤️ ¡Le encantó su nombre!'); } },
  radioSt: el => { if (Radio.current() === el.dataset.id) Radio.stop(); else Radio.play(el.dataset.id); document.getElementById('scene')?.classList.toggle('radio-on', !!Radio.current()); G.blip('select'); renderWorld(); },
  radioOff: () => { Radio.stop(); document.getElementById('scene')?.classList.remove('radio-on'); renderWorld(); },
  shield: () => { const r = W.buyShield(); toast(r.msg); G.blip(r.ok ? 'buy' : 'error'); if (r.ok) ctx.renderAll(); },
  quest: el => { const q = H.claimQuest(el.dataset.id); if (!q) return; G.blip('coin'); try { navigator.vibrate?.(40); } catch { /* */ } G.bitsFly(el, 6); toast(`${q.e} ¡Misión cumplida! +${q.bits}◆`); ctx.renderAll(); },
  rvClose: el => { const again = el.dataset.again; closeReveal(); if (again) openBox(); },
  rvPlace: el => { closeReveal(); ctx.place(el.dataset.id); },
  rvWear: el => { closeReveal(); const g = W.game(); const it = W.itemById(el.dataset.id); g.wear[it.slot] = it.id; W.saveGame(g); ctx.renderAll(); G.act('dance', it.e); $('screen').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  invite: () => share(inviteText()),
  story: async () => {
    openSheet('Tu tarjeta', '<div class="story-prev"><div class="empty">Pintando tu edificio…</div></div>');
    const blob = await Share.storyBlob(); const url = URL.createObjectURL(blob);
    document.querySelector('.story-prev').innerHTML = `<img src="${url}" alt="Tarjeta con tu personaje, tu edificio y tu racha">`;
    document.getElementById('sheetBody').insertAdjacentHTML('beforeend', '<div class="stack"><button class="btn-acc" data-act="storyShare">📣 Compartir</button><p class="note">Ideal para historias de Instagram o WhatsApp. Cada persona que llega por ti ve cómo vas.</p></div>');
  },
  storyShare: async () => { const r = await Share.shareStory(); if (r === 'download') toast('📸 Imagen descargada: súbela a tus historias', 4000); },
  shareItem: el => { const it = W.itemById(el.dataset.id); const r = W.rarityOf(it); share(`${el.dataset.box ? 'Me salió' : 'Tengo'} ${it.e} ${it.n} (${r.n}) en IO. Lo gané cumpliendo mis hábitos, no con dinero. Piso ${W.level()} 🏢`); },
  rankScope: el => { R.state.scope = el.dataset.s; R.state.rows = []; renderRank(); loadRank(el.dataset.s); },
  rankReload: () => { R.publish(true); loadRank(); },
  rankJoin: async () => { const n = $('rkName').value.trim(); if (!n) return toast('Escribe tu nombre público'); try { await R.join(n); toast('¡Estás en el ranking! 🏆'); loadRank(); } catch (e) { toast('⚠️ ' + e.message, 5000); } },
  rankLeave: async el => { if (!el.dataset.sure) { el.dataset.sure = 1; el.textContent = '¿Seguro? Toca otra vez'; return; } await R.leave(); toast('Saliste del ranking'); loadRank(); },
  weekly: el => { const r = H.claimWeekly(); if (!r) return; ctx.celebrate({ kind: 'dance', prop: '🏆', xp: r.xp, bits: r.bits, fromEl: el, line: `¡Reto semanal cumplido! +${r.bits} bits y ${r.xp} XP.`, before: r.before, after: r.after }); },
};

export function init(c) {
  ctx = c;
  $('ltabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  // deslizar entre pestañas en la pantalla inferior
  let sx = null, sy = 0;
  $('lscreen').addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  $('lscreen').addEventListener('touchend', e => {
    if (sx === null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8 && !e.target.closest('.chips-row,.heat,.week')) { const i = TABS.indexOf(tab) + (dx < 0 ? 1 : -1); if (TABS[i]) show(TABS[i]); }
  }, { passive: true });
  document.addEventListener('input', e => { if (e.target.matches('[data-radio-vol]')) Radio.setVolume(+e.target.value); });
  document.addEventListener('change', e => { if (e.target.matches('[data-radio-auto]')) saveCfg({ radioAuto: e.target.checked }); });
  setInterval(() => { document.querySelectorAll('[data-countdown]').forEach(s => { s.textContent = untilMidnight(); }); }, 1000);
  show(tab, { sound: false });
  loadRank('global');
}
