/* IO — la segunda pantalla del Game Boy avanzado.
 * Hoy · Tienda · Ranking · Progreso · Mundo. Todo lo que antes vivía escondido en el menú START
 * ahora también está a un toque, abajo de la consola. */
import { cfg, todayIso, addDays, dateOf } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import * as G from './engine.js';
import * as R from './ranking.js';
import { avatarSVG } from './avatar.js';
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
  else if (tab === 'ranking') renderRank();
  else if (tab === 'progreso') renderProg();
  else if (tab === 'mundo') renderWorld();
}
function badge(id, txt) { const b = $('bdg-' + id); if (!b) return; b.hidden = !txt; b.textContent = txt || ''; }
export function badges() {
  const g = W.game(); const d = W.dailyDeal(g);
  const crowns = H.forDay().filter(h => { const s = H.sess(h.id); return s.done && !s.claimed; }).length;
  badge('hoy', crowns ? '👑' : H.chestReady() ? '🎁' : '');
  badge('tienda', d && !d.taken && g.bits >= d.price ? '%' : g.bits >= W.BOX_PRICE && W.level(g) >= 2 ? '!' : '');
  badge('progreso', H.weekChallenge().ready ? '!' : '');
  const lvl = W.level(g); badge('mundo', g.floor < lvl ? '▲' : '');
}

/* ================= HOY: extras debajo de la lista ================= */
function renderHoy() {
  const c = H.weekChallenge();
  $('hoyWeekly').innerHTML = weeklyCard(c, true);
  const g = W.game(); const d = W.dailyDeal(g); const col = W.collection(g);
  const chase = chaser();
  $('quick').innerHTML = `
    ${d && !d.taken ? `<button class="qk qk-deal r-${W.rarityOf(d.item).id}" data-act="tab" data-t="tienda"><span class="qk-e">${d.item.e}</span><span><b>Oferta del día −30%</b><small>${esc(d.item.n)} · ◆${d.price}</small></span></button>` : ''}
    ${chase ? `<button class="qk qk-rank" data-act="tab" data-t="ranking"><span class="qk-e">🏆</span><span><b>#${chase.pos} en ${R.online() && R.joined() ? 'el ranking' : 'tu liga'}</b><small>${chase.next ? `Te faltan ${fmtN(chase.gap)} XP para pasar a ${esc(chase.next)}` : '¡Vas de primero!'}</small></span></button>` : ''}
    <button class="qk" data-act="tab" data-t="tienda"><span class="qk-e">🧩</span><span><b>Colección ${col.own}/${col.total}</b><small>${Math.round(col.pct * 100)}% completa</small></span></button>`;
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
const CATS = [['todo', '✨ Todo'], ['nuevo', '🆕 Nuevo'], ['mueble', '🛋️ Muebles'], ['veh', '🚗 Vehículos'], ['pet', '🐾 Mascotas'], ['wear', '🧢 Ropa']];
const untilMidnight = () => { const n = new Date(); const m = new Date(n); m.setHours(24, 0, 0, 0); const s = Math.floor((m - n) / 1000); return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function renderShop() {
  const g = W.game(); const lvl = W.level(g); const col = W.collection(g); const d = W.dailyDeal(g);
  let items = W.SHOPPABLE();
  if (shopCat === 'nuevo') items = items.filter(i => i.lvl > lvl - 2 && i.lvl <= lvl + 3);
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
    <div class="chips-row" role="tablist">${CATS.map(([k, l]) => `<button class="${k === shopCat ? 'on' : ''}" data-act="shopCat" data-c="${k}">${l}</button>`).join('')}</div>
    ${cheapest && g.bits < cheapest.price ? `<p class="sh-hint">💡 Te faltan <b>${cheapest.price - g.bits}◆</b> para ${cheapest.e} ${esc(cheapest.n)} · ≈ ${Math.max(1, Math.ceil((cheapest.price - g.bits) / 12))} hábito${Math.ceil((cheapest.price - g.bits) / 12) > 1 ? 's' : ''}</p>` : ''}
    <div class="sgrid">${[...open, ...locked].map(i => shopItem(g, lvl, i)).join('') || '<div class="empty">Nada por aquí todavía.</div>'}</div>
    <p class="note">◆ Los bits solo se ganan cumpliendo hábitos con el reloj. Nada se compra con dinero, nunca.</p>`;
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
    ${isNew ? '<i class="si-new">NUEVO</i>' : ''}${own && i.kind !== 'wear' ? `<i class="si-own">×${own}</i>` : ''}
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
  const practice = !R.online() || st.fallback;
  const rows = st.rows;
  const top3 = rows.slice(0, 3);
  const podium = [top3[1], top3[0], top3[2]].map((r, k) => r ? `<div class="pd pd-${[2, 1, 3][k]}${r.me ? ' me' : ''}">
      ${[2, 1, 3][k] === 1 ? '<span class="pd-crown">👑</span>' : ''}${face(r.look, r.wear, 'pd-face')}
      <b>${esc(r.name)}</b><small>NV ${r.level} · ${fmtN(r[key])} XP</small><i>${[2, 1, 3][k]}</i></div>` : '<div class="pd"></div>').join('');
  const ch = chaser();
  $('p-ranking').innerHTML = `
    <div class="rk-head">
      <div class="chips-row"><button class="${scope === 'global' ? 'on' : ''}" data-act="rankScope" data-s="global">🌎 Global</button><button class="${scope === 'semana' ? 'on' : ''}" data-act="rankScope" data-s="semana">⚡ Esta semana</button></div>
      <button class="rk-ref" data-act="rankReload" aria-label="Actualizar">↻</button>
    </div>
    ${practice ? `<div class="rk-note">🤖 <b>Liga de práctica.</b> Compites contra bots mientras se activa el ranking mundial. ${st.error ? `<small>(${esc(st.error.slice(0, 80))})</small>` : ''}</div>`
      : !R.joined() ? `<div class="rk-join"><b>Únete al ranking mundial</b><small>Sin correo ni contraseña: solo tu nombre público, tu nivel y tu personaje.</small>
        <div class="row"><input class="inp" id="rkName" maxlength="20" value="${esc(cfg.rankName || cfg.name || '')}" placeholder="Tu nombre público"><button class="btn-acc" data-act="rankJoin" style="width:auto;padding:10px 16px">Entrar</button></div></div>` : ''}
    ${ch && ch.next ? `<div class="rk-chase">🎯 Te faltan <b>${fmtN(ch.gap)} XP</b> para pasar a <b>${esc(ch.next)}</b> y quedar #${ch.pos - 1}</div>` : ch ? '<div class="rk-chase gold">👑 ¡Vas de primero! Todos te quieren alcanzar.</div>' : ''}
    <div class="podium">${podium}</div>
    <ol class="rk-list">${rows.slice(3, 100).map((r, i) => rankRow(r, i + 4, key)).join('')}</ol>
    ${st.me ? `<div class="rk-me-sep">···</div><ol class="rk-list">${rankRow(st.me, st.me.pos, key)}</ol>` : ''}
    ${!rows.length ? '<div class="empty">Cargando ranking…</div>' : ''}
    <div class="stack" style="margin-top:12px"><button class="btn-ghost" data-act="invite">📣 Reta a tus amigos</button>
      ${R.online() && R.joined() ? '<button class="btn-ghost" data-act="rankLeave">Salir del ranking</button>' : ''}</div>
    <p class="note">${scope === 'semana' ? 'La tabla semanal se reinicia cada lunes: cualquiera puede ganarla.' : 'Top 100 por XP total. Tu nivel es tu piso.'} Títulos: ${W.TITLES.map(([l, t]) => `${t} (${l}+)`).join(' · ')}.</p>`;
}
function rankRow(r, pos, key) {
  return `<li class="rk${r.me ? ' me' : ''}${r.bot ? ' bot' : ''}"><span class="rk-pos">${pos}</span>${face(r.look, r.wear)}
    <span class="rk-n"><b>${esc(r.name)}${r.me ? ' <em>TÚ</em>' : ''}</b><small>${W.titleOf(r.level)} · piso ${r.level}${r.streak ? ` · 🔥${r.streak}` : ''}</small></span>
    <span class="rk-xp">${fmtN(r[key])}<small>XP</small></span></li>`;
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
  $('p-progreso').innerHTML = `
    ${weeklyCard(H.weekChallenge())}
    <div class="pg-sec"><div class="h-head"><h2>Tu semana</h2><span class="h-prog">🔥 ${H.dayStreak()} ${H.dayStreak() === 1 ? 'día' : 'días'}</span></div>
      <div class="week">${w.rows.length ? `<div class="wk-row wk-h"><span></span>${w.days.map(d => `<i>${DN[dateOf(d).getDay()]}</i>`).join('')}</div>` + w.rows.map(r => `<div class="wk-row"><span title="${esc(r.h.nombre)}">${esc(r.h.emoji)} ${esc(r.h.nombre)}</span>${r.cells.map(c => `<i class="c-${c}"></i>`).join('')}</div>`).join('') : '<div class="empty">Aquí verás tu semana.</div>'}</div></div>
    <div class="pg-sec"><div class="h-head"><h2>Metas de ${esc(mname)}</h2><span class="h-prog">minutos</span></div>
      ${month.map(m => `<div class="mg"><span class="mg-e">${esc(m.h.emoji)}</span><div class="mg-b"><div class="mg-t"><b>${esc(m.h.nombre)}</b><small>${m.minutes}/${m.goal} min · ${m.done}/${m.plan} días</small></div><div class="mg-bar"><i style="width:${Math.min(100, m.pct * 100)}%"></i></div></div></div>`).join('') || '<div class="empty">Crea hábitos para ver tus metas.</div>'}</div>
    <div class="pg-sec"><div class="h-head"><h2>12 semanas en 1 y 0</h2><span class="h-prog">L → D</span></div>
      <div class="heat">${hm.map(wk => `<div class="hcol">${wk.map(c => `<i class="h${c.future ? 'f' : Math.min(3, c.n)}" title="${c.iso}: ${c.n}">${c.future ? '' : c.n ? 1 : 0}</i>`).join('')}</div>`).join('')}</div></div>
    <div class="stats">
      <div><b>${fmtN(g.stats.minutes)}</b><span>minutos</span></div><div><b>${fmtN(g.stats.sessions)}</b><span>hábitos completos</span></div><div><b>${best}</b><span>mejor racha</span></div>
      <div><b>${Object.keys(g.chest).length}</b><span>días perfectos</span></div><div><b>${fmtN(g.stats.spent || 0)}</b><span>bits invertidos</span></div><div><b>${g.stats.boxes || 0}</b><span>cajas abiertas</span></div>
    </div>
    <div class="pg-sec" id="achSec"><div class="h-head"><h2>Logros</h2><span class="h-prog">${ach.filter(x => x.done).length}/${ach.length}</span></div>
      <div class="ach-grid">${ach.sort((x, y) => y.done - x.done || y.v / y.goal - x.v / x.goal).map(x => `<div class="ach${x.done ? ' done' : ''}"><span class="e">${x.e}</span><span class="n">${esc(x.n)}</span><span class="v">${x.done ? '✓' : `${x.v}/${x.goal}`}</span><i class="ach-bar" style="width:${x.v / x.goal * 100}%"></i></div>`).join('')}</div></div>`;
}

/* ================= MUNDO ================= */
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
    <div class="stack"><button class="btn-ghost" data-act="map">🗺️ Mapa completo del edificio</button><button class="btn-ghost" data-act="invite">📣 Mostrar mi edificio</button></div>
    <p class="note">Estás en el piso ${g.floor} · ${f.ic} ${esc(f.name)}. Toca un piso para tomar el ascensor.</p>`;
}

/* ================= acciones ================= */
export const actions = {
  tab: el => show(el.dataset.t, { scroll: true }),
  shopCat: el => { shopCat = el.dataset.c; G.blip('menu'); renderShop(); },
  item: el => itemSheet(el.dataset.id),
  buyDeal: () => { const d = W.dailyDeal(); if (d) ctx.buy(d.item.id, { deal: true }); },
  box: () => openBox(),
  rvClose: el => { const again = el.dataset.again; closeReveal(); if (again) openBox(); },
  rvPlace: el => { closeReveal(); ctx.place(el.dataset.id); },
  rvWear: el => { closeReveal(); const g = W.game(); const it = W.itemById(el.dataset.id); g.wear[it.slot] = it.id; W.saveGame(g); ctx.renderAll(); G.act('dance', it.e); $('screen').scrollIntoView({ behavior: 'smooth', block: 'center' }); },
  invite: () => share(inviteText()),
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
  setInterval(() => { document.querySelectorAll('[data-countdown]').forEach(s => { s.textContent = untilMidnight(); }); }, 1000);
  show(tab, { sound: false });
  loadRank('global');
}
