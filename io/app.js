/* IO — app principal. Una sola pantalla que se scrollea verticalmente:
 * ① consola (avatar + necesidades + misiones de la vida real)  ② Hoy/Semana/Mes  ③ transacciones (infinita)  ④ calendario
 * ⑤ programados  ⑥ metas  ⑦ salud  ⑧ relaciones  ⑨ diario  ⑩ categorías  ⑪ conexiones */
import * as S from './store.js';
import { cfg, saveCfg, isoOf, todayIso, dateOf, daysBetween, pad } from './store.js';
import { parseCapture, chat as aiChat, localParse, CATS } from './ai.js';
import { analyzeCSV } from './importer.js';
import * as G from './game.js';
import { openOnboarding, parseAgenda } from './onboarding.js';

/* ================= constantes ================= */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const CAT = {
  comida: { c: '#f87171', e: '🍔' }, gasolina: { c: '#fbbf24', e: '⛽' }, supermercado: { c: '#4ade80', e: '🛒' },
  transporte: { c: '#60a5fa', e: '🚗' }, salud: { c: '#f472b6', e: '💪' }, entretenimiento: { c: '#a78bfa', e: '🎬' },
  suscripcion: { c: '#fb923c', e: '📱' }, vivienda: { c: '#22d3ee', e: '🏠' }, educacion: { c: '#38bdf8', e: '📚' },
  ropa: { c: '#e879f9', e: '👕' }, regalos: { c: '#fb7185', e: '🎁' }, negocio: { c: '#34d399', e: '💼' },
  ingreso: { c: '#4ade80', e: '💵' }, otros: { c: '#9ca3af', e: '💳' },
};
const ME = {
  'couche-tard': '🏪', 'couche tard': '🏪', mcdonald: '🍔', 'tim horton': '☕', walmart: '🛒', maxi: '🥬', iga: '🛒',
  metro: '🛒', dollarama: '💸', 'canadian tire': '🔧', 'best buy': '💻', shell: '⛽', esso: '⛽', 'petro-canada': '⛽',
  starbucks: '☕', netflix: '📺', spotify: '🎵', amazon: '📦', renta: '🏠', fizz: '📱', ymca: '💪', 'f.s.s.t': '💵',
  cnesst: '💵', gouv: '🏛', pollo: '🍗', poulet: '🍗', coq: '🍗', cine: '🎬', 'jean coutu': '💊', saq: '🍷', marche: '🥕',
  'marché': '🥕', jeep: '🚙', seguro: '🛡️', unique: '🛡️', uber: '🚕', stm: '🚇', costco: '🛒',
};
const MOODS = ['😣', '😕', '😐', '🙂', '😄'];
const PILLARS = {
  finanzas: { lbl: 'Finanzas', ic: '💰', sec: 'chipsCard' },
  salud: { lbl: 'Salud', ic: '💪', sec: 'healthCard' },
  social: { lbl: 'Social', ic: '💬', sec: 'relCard' },
  mente: { lbl: 'Mente', ic: '🧠', sec: 'journalCard' },
};
const J_PROMPTS = [
  '¿Qué fue lo mejor de hoy?', '¿Por qué estás agradecido hoy?', '¿Qué aprendiste hoy?', '¿Qué te quitó energía?',
  '¿Qué harías distinto mañana?', '¿A quién le quieres escribir esta semana?', '¿Qué te acercó hoy a tus metas?',
];

/* ================= estado de UI ================= */
const now0 = new Date();
const ui = {
  chip: 'today', vm: now0.getMonth(), vy: now0.getFullYear(), txShown: 30, txQuery: '', catMode: 'cat',
  nudges: [], nudgeIdx: 0, chatHistory: [], jMood: null, capture: null, installEvt: null, lastMood: null,
};

/* ================= utilidades ================= */
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => '$' + Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = n => '$' + Math.round(Math.abs(n)).toLocaleString('en-CA');
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
function emojiFor(desc, cat) {
  const low = (desc || '').toLowerCase();
  for (const [k, v] of Object.entries(ME)) if (low.includes(k)) return v;
  return (CAT[cat] || CAT.otros).e;
}
const catCfg = c => CAT[c] || CAT.otros;
let toastT;
function toast(msg, ms = 2600) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}
function fechaCorta(d) { return d.toLocaleDateString('es-CA', { day: 'numeric', month: 'short' }); }
function relDay(iso) {
  const n = daysBetween(dateOf(iso), new Date());
  if (n === 0) return 'Hoy'; if (n === 1) return 'Ayer'; if (n === -1) return 'Mañana';
  return dateOf(iso).toLocaleDateString('es-CA', { weekday: 'long', day: 'numeric', month: 'short' });
}

/* ================= cálculos por pilar ================= */
function fijos() { return S.itemsOf('fijo').sort((a, b) => a.dia - b.dia); }
function isFijoTx(t, fs) {
  if (/\[fijo/i.test(t.original)) return true;
  const d = t.descripcion.toLowerCase();
  return fs.some(f => d.includes((f.match || f.descripcion).toLowerCase()));
}
function financeFor(y, m) {
  const txs = S.allTx();
  const now = new Date(), eod = endOfToday();
  const isCur = y === now.getFullYear() && m === now.getMonth();
  const md = txs.filter(t => t.d.getFullYear() === y && t.d.getMonth() === m);
  const paid = md.filter(t => t.d <= eod);
  const future = md.filter(t => t.d > eod);
  const fs = fijos();
  const ing = paid.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const gast = paid.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const gastVar = paid.filter(t => t.tipo === 'gasto' && !isFijoTx(t, fs)).reduce((s, t) => s + t.monto, 0);
  const presup = Number(cfg.presupuesto) || 501;
  const pct = Math.round(gastVar / presup * 100);
  const incToday = paid.some(t => t.tipo === 'ingreso' && t.fecha === todayIso());
  const fijosPend = isCur ? fs.filter(f => !md.some(t => t.tipo === 'gasto' && (t.descripcion.toLowerCase().includes((f.match || f.descripcion).toLowerCase()) || /\[fijo/i.test(t.original) && t.descripcion.toLowerCase() === f.descripcion.toLowerCase()))) : [];
  const futGast = future.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const pendTotal = futGast + fijosPend.reduce((s, f) => s + Number(f.monto), 0);
  const futIng = future.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  return { txs, md, paid, future, ing, gast, bal: ing - gast, gastVar, pct, presup, incToday, isCur, fijosPend, pendTotal, proj: ing + futIng - gast - pendTotal };
}
function scoreFinance(f) {
  let s = f.bal >= 0 ? 70 : 32;
  s += f.pct < 50 ? 25 : f.pct < 80 ? 12 : f.pct < 100 ? 0 : f.pct < 115 ? -10 : -25;
  if (f.incToday) s += 5;
  return clamp(s, 5, 100);
}
const TG = () => ({ agua: 8, sueno: 7, ejercicio: 30, pasos: 8000, ...(cfg.targets || {}) });
function healthOf(iso) { return S.getItem(`health:${iso}`) || { fecha: iso }; }
function healthInfo() {
  const t = todayIso(); const y = new Date(); y.setDate(y.getDate() - 1);
  const today = healthOf(t), yest = healthOf(isoOf(y));
  const src = Object.keys(today).length > 2 ? today : Object.keys(yest).length > 2 ? yest : null;
  let score = null;
  if (src) {
    const sl = src.sueno;
    score = (sl == null ? 18 : sl >= 7 && sl <= 9.5 ? 35 : sl >= 6 ? 25 : sl >= 5 ? 15 : 5)
      + Math.min((src.agua || 0) / TG().agua, 1) * 20 + Math.min((src.ejercicio || 0) / TG().ejercicio, 1) * 25
      + (src.animo ? (src.animo - 1) / 4 * 20 : 10);
  }
  const lastSleep = today.sueno ?? yest.sueno ?? null;
  return { today, score: score == null ? null : clamp(Math.round(score)), lastSleep };
}
function peopleInfo() {
  const inter = S.itemsOf('interaction');
  const people = S.itemsOf('person').map(p => {
    const mine = inter.filter(i => i.personaId === p.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
    const last = mine[0]?.fecha || null;
    const days = last ? daysBetween(dateOf(last), new Date()) : null;
    const cada = Number(p.cada) || 7;
    const ratio = days == null ? 1 : days / cada;
    return { ...p, last, days, cada, ratio, count: mine.length, history: mine };
  }).sort((a, b) => b.ratio - a.ratio);
  const score = people.length ? clamp(Math.round(people.reduce((s, p) => s + clamp(1 - Math.max(0, (p.days ?? p.cada) - p.cada) / (p.cada * 2), 0, 1), 0) / people.length * 100)) : null;
  return { people, score };
}
function mindInfo() {
  const entries = S.itemsOf('journal').sort((a, b) => (b.fecha + (b.hora || '')).localeCompare(a.fecha + (a.hora || '')));
  const wk = new Date(); wk.setDate(wk.getDate() - 7);
  const recent = entries.filter(e => dateOf(e.fecha) >= wk);
  const moods = [...recent.map(e => e.animo), ...S.itemsOf('health').filter(h => dateOf(h.fecha) >= wk).map(h => h.animo)].filter(Boolean);
  const avg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
  const score = entries.length || moods.length ? clamp(Math.round(Math.min(recent.length / 4, 1) * 50 + (avg ? (avg - 1) / 4 * 50 : 25))) : null;
  return { entries, recent, avg, score };
}
function legacyXp() {
  const txs = S.allTx();
  return txs.filter(t => t.fromApp || t.local).length * 5 + S.itemsOf('health').length * 10 + S.itemsOf('journal').length * 15 + S.itemsOf('interaction').length * 10;
}
function progress() {
  const g = G.state();
  const txs = S.allTx();
  const lvl = G.levelOf(g.xp);
  const lo = G.xpFor(lvl), hi = G.xpFor(lvl + 1);
  const days = new Set([...txs.map(t => t.fecha), ...S.itemsOf('health').map(h => h.fecha), ...S.itemsOf('journal').map(j => j.fecha), ...S.itemsOf('interaction').map(i => i.fecha), ...Object.keys(g.claimed).filter(k => g.claimed[k].length)]);
  let streak = 0; const d = new Date();
  if (!days.has(isoOf(d))) d.setDate(d.getDate() - 1);
  while (days.has(isoOf(d))) { streak++; d.setDate(d.getDate() - 1); }
  return { xp: g.xp, coins: g.coins, lvl, pct: (g.xp - lo) / (hi - lo) * 100, next: hi, streak, tier: G.tierOf(lvl) };
}

/* ================= render principal ================= */
let F; // finanzas del mes visto
function render() {
  const now = new Date();
  F = financeFor(ui.vy, ui.vm);
  const cur = ui.vy === now.getFullYear() && ui.vm === now.getMonth() ? F : financeFor(now.getFullYear(), now.getMonth());
  const H = healthInfo(), P = peopleInfo(), M = mindInfo();
  const scores = { finanzas: scoreFinance(cur), salud: H.score, social: P.score, mente: M.score };

  $('datec').textContent = now.toLocaleDateString('es-CA', { weekday: 'short', day: 'numeric', month: 'short' });
  $('demoBar').hidden = !S.isDemo();
  renderSync();
  renderAvatar(cur, H, P, M, scores);
  renderChip();
  renderTx();
  renderCalendar();
  renderPending();
  renderGoals();
  renderHealth(H);
  renderPeople(P);
  renderJournal(M);
  renderCats();
  renderConn();
}

function renderSync() {
  const st = S.status, dot = $('syncDot'), txt = $('syncTxt');
  const pend = S.pendingSyncCount();
  dot.className = 'ldot';
  if (S.isDemo()) { dot.classList.add('off'); txt.textContent = 'demo'; }
  else if (st.supabase === 'ok') txt.textContent = pend ? `↑${pend}` : 'en vivo';
  else if (st.supabase === 'error') { dot.classList.add('err'); txt.textContent = 'sin conexión'; }
  else if (st.sheet === 'ok') txt.textContent = 'sheet';
  else { dot.classList.add('off'); txt.textContent = 'local'; }
}

/* ---------- ① avatar ---------- */
function greeting() {
  const h = new Date().getHours(), n = cfg.name;
  if (h >= 5 && h < 12) return [`Buenos días, ${n} ☀️`, 'Arranca fuerte. Aquí está tu día.'];
  if (h >= 12 && h < 19) return [`Buenas tardes, ${n} 🌤`, '¿Cómo va el día? Todo organizado acá.'];
  return [`Buenas noches, ${n} 🌙`, 'Hora de revisar el día y cerrar bien.'];
}
function renderAvatar(f, H, P, M, scores) {
  const [g, sub] = greeting();
  $('greetName').textContent = g; $('greetSub').textContent = sub;
  const vals = Object.values(scores).filter(v => v != null);
  const life = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 60;

  // Lógica de ánimo: generosa. "worried" SOLO con balance negativo o presupuesto variable >115%.
  let mood = 'neutral', col = '#fbbf24', lbl = 'tranquilo';
  if (f.incToday) { mood = 'excited'; col = '#a78bfa'; lbl = '¡emocionado!'; }
  else if (f.bal < 0 || f.gastVar > f.presup * 1.15) { mood = 'worried'; col = '#f87171'; lbl = 'preocupado'; }
  else if (H.lastSleep != null && H.lastSleep < 5) { mood = 'tired'; col = '#818cf8'; lbl = 'cansado'; }
  else if ((f.bal > 400 && f.pct < 60) || life >= 75) { mood = 'happy'; col = '#4ade80'; lbl = 'muy bien'; }
  else if (f.bal > 0 && f.pct < 90) { mood = 'neutral'; col = '#fbbf24'; lbl = 'tranquilo'; }

  const wrap = $('avWrap'); wrap.dataset.mood = mood;
  const pb = $('plumbob'); pb.style.background = col; pb.style.filter = `drop-shadow(0 0 9px ${col})`;
  if (ui.lastMood && ui.lastMood !== mood) { pb.classList.remove('spin'); void pb.offsetWidth; pb.classList.add('spin'); }
  ui.lastMood = mood;
  $('moodLbl').textContent = lbl; $('moodLbl').style.color = col;
  applyAvatarColors();

  // Habitación: cielo según hora, planta según salud, trofeo según metas
  const h = new Date().getHours();
  $('sky').className = 'sky ' + (h >= 6 && h < 17 ? 'dia' : h >= 17 && h < 20 ? 'tarde' : 'noche');
  renderRoom(scores, life);

  // Frases (tócala para rotar)
  const n = [];
  if (mood === 'excited') n.push('🎉 ¡Llegó dinero hoy! Ya lo tengo registrado. ¿Separamos algo para tus metas?');
  if (mood === 'worried') n.push('😰 Presupuesto apretado este mes. ¿Le damos una revisada juntos? Toca 🔮');
  if (mood === 'tired') n.push(`😴 Dormiste ${H.lastSleep}h. Hoy vamos suave: agua, algo de luz y a acostarse temprano.`);
  if (mood === 'happy') n.push('😄 Todo bajo control. ¡Así se hace, socio!');
  const libre = f.presup - f.gastVar;
  if (f.isCur && libre > 0) {
    const left = new Date(ui.vy, ui.vm + 1, 0).getDate() - new Date().getDate() + 1;
    n.push(`💡 Te quedan ${fmt0(libre)} de presupuesto variable: ~${fmt0(libre / left)}/día por ${left} días.`);
  }
  const due = P.people.find(p => p.days != null && p.days > p.cada) || P.people.find(p => p.days == null);
  if (due) n.push(due.days == null ? `💬 Aún no registras nada con ${due.nombre}. ¿Le escribes hoy?` : `💬 Hace ${due.days} días no hablas con ${due.nombre}. ¿Un mensajito?`);
  if (!H.today.agua) n.push('💧 ¿Ya tomaste agua hoy? Registra un vaso en Salud.');
  if (!M.entries.some(e => e.fecha === todayIso()) && h >= 18) n.push('📝 ¿Cómo estuvo tu día? Dos líneas en el diario bastan.');
  if (f.fijosPend.length) n.push(`🗓 Te faltan ${f.fijosPend.length} pagos fijos este mes (${fmt0(f.fijosPend.reduce((s, x) => s + Number(x.monto), 0))}).`);
  if (!n.length) n.push(f.txs.length ? '🌙 Aquí estoy, listo para ayudarte.' : 'Registra algo con el botón verde o por Telegram y aparece aquí. 📲');
  const qs = questsToday(); const pend = qs.filter(q => !q.claimed);
  if (pend.length) n.splice(mood === 'neutral' ? 0 : 1, 0, pend.some(q => q.done) ? '🎁 ¡Tienes misiones listas para reclamar! Míralas abajo.' : `🎯 Hoy tienes ${pend.length} misiones. Cumple la primera: ${pend[0].t.toLowerCase()}.`);
  ui.nudges = n; ui.nudgeIdx = 0;
  if (!ui.sayLock || Date.now() > ui.sayLock) say(n[0]);

  // Necesidades estilo Sims
  $('needs').innerHTML = Object.entries(PILLARS).map(([k, p]) => {
    const v = scores[k];
    const color = v == null ? 'var(--dim)' : v >= 70 ? 'var(--green)' : v >= 45 ? 'var(--amber)' : 'var(--red)';
    return `<button class="need" data-act="goto" data-sec="${p.sec}">
      <div class="need-top"><span>${p.ic} ${p.lbl}</span><span>${v == null ? 'sin datos' : v}</span></div>
      <div class="need-bar"><div class="need-fill" style="width:${v ?? 50}%;background:${color};${v == null ? 'opacity:.35' : ''}"></div></div></button>`;
  }).join('');

  const pr = progress();
  $('lvlN').textContent = pr.lvl;
  $('xpFill').style.width = clamp(pr.pct) + '%';
  $('xpFill').parentElement.title = `${pr.xp} / ${pr.next} XP`;
  $('coinN').textContent = pr.coins;
  $('streak').textContent = `🔥${pr.streak}`;
  $('streak').title = `${pr.streak} días seguidos registrando`;
  const nextT = G.TIERS[pr.tier + 1];
  $('tierBadge').textContent = `${G.TIERS[pr.tier].ic} ${G.TIERS[pr.tier].name}${nextT ? ` · nv ${nextT.min} → ${nextT.ic}` : ''}`;
  renderQuests(qs);
}
function applyAvatarColors() {
  const r = document.documentElement.style;
  r.setProperty('--skin', cfg.avatar.skin); r.setProperty('--hair', cfg.avatar.hair); r.setProperty('--hoodie', cfg.avatar.hoodie);
}

/* ---------- ② chips ---------- */
function chipData(v) {
  const txs = S.allTx(), now = new Date(), eod = endOfToday();
  if (v === 'today') return txs.filter(t => t.fecha === todayIso());
  if (v === 'week') {
    const ws = new Date(now); ws.setDate(now.getDate() - ((now.getDay() + 6) % 7)); ws.setHours(0, 0, 0, 0); // semana desde el lunes
    return txs.filter(t => t.d >= ws && t.d <= eod);
  }
  return F.paid;
}
function renderChip() {
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.chip === ui.chip));
  const data = chipData(ui.chip);
  const out = data.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const inn = data.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const b = inn - out;
  $('chipOut').textContent = fmt(out); $('chipIn').textContent = fmt(inn);
  $('chipBal').textContent = (b >= 0 ? '+' : '-') + fmt(b); $('chipBal').style.color = b >= 0 ? 'var(--green)' : 'var(--red)';

  // Barra de presupuesto variable con marcador de ritmo ideal
  const pctUse = clamp(F.gastVar / F.presup * 100, 0, 100);
  const dim = new Date(ui.vy, ui.vm + 1, 0).getDate();
  const pace = F.isCur ? new Date().getDate() / dim * 100 : 100;
  const col = F.pct > 115 ? 'var(--red)' : F.pct > pace + 10 ? 'var(--amber)' : 'var(--green)';
  $('budget').innerHTML = `<div class="budget-top"><span>Presupuesto variable · ${MESES[ui.vm]}</span><span><b>${fmt0(F.gastVar)}</b> / ${fmt0(F.presup)}</span></div>
    <div class="budget-bar"><div class="budget-fill" style="width:${pctUse}%;background:${col}"></div><div class="budget-pace" style="left:${pace}%" title="ritmo ideal"></div></div>`;

  const el = $('insightBox');
  if (!data.length) { el.textContent = ui.chip === 'today' ? '🌟 Sin movimientos hoy. ¡Buen comienzo!' : '💡 Sin movimientos en este período.'; return; }
  const byDesc = {};
  data.filter(t => t.tipo === 'gasto').forEach(t => { byDesc[t.descripcion] = (byDesc[t.descripcion] || 0) + t.monto; });
  const top = Object.entries(byDesc).sort((a, b) => b[1] - a[1])[0];
  let msg;
  if (ui.chip === 'today') msg = out === 0 ? '🌟 Sin gastos hoy. ¡Buen comienzo!' : `📌 Mayor gasto hoy: ${top[0]} (${fmt(top[1])}) · ${data.length} movimiento(s).`;
  else if (ui.chip === 'week') {
    const days = ((new Date().getDay() + 6) % 7) + 1;
    msg = top ? `📊 Esta semana: ${fmt0(out / days)}/día en promedio. Top: ${top[0]} (${fmt(top[1])}).` : `📈 ${data.length} movimiento(s) esta semana.`;
  } else {
    const libre = F.presup - F.gastVar;
    msg = top ? `💡 Top comercio del mes: ${top[0]} (${fmt(top[1])}). Presupuesto libre: ${libre >= 0 ? fmt(libre) : '-' + fmt(libre)}. Proyección fin de mes: ${F.proj >= 0 ? '+' : '-'}${fmt0(F.proj)}.` : `📅 ${data.length} movimientos este mes.`;
  }
  el.textContent = msg;
}

/* ---------- ③ transacciones: lista infinita agrupada por día ---------- */
let txObserver;
function filteredTx() {
  const eod = endOfToday();
  const q = ui.txQuery.trim().toLowerCase();
  return S.allTx().filter(t => t.d <= eod && (!q || `${t.descripcion} ${t.categoria} ${t.monto.toFixed(2)} ${t.fecha}`.toLowerCase().includes(q)));
}
function renderTx() {
  const all = filteredTx();
  const items = all.slice(0, ui.txShown);
  $('txCount').textContent = all.length ? `${all.length}` : '';
  if (!items.length) { $('txList').innerHTML = `<div class="empty">${ui.txQuery ? 'Nada coincide con tu búsqueda.' : 'Aún no hay transacciones. Toca <b>+ Registrar</b> o escríbele al bot.'}</div>`; return; }
  const byDay = {};
  all.forEach(t => { (byDay[t.fecha] ||= { out: 0, in: 0 }); byDay[t.fecha][t.tipo === 'ingreso' ? 'in' : 'out'] += t.monto; });
  let html = '', lastDay = '';
  items.forEach((t, i) => {
    if (t.fecha !== lastDay) {
      lastDay = t.fecha; const s = byDay[t.fecha];
      html += `<div class="tx-day"><span>${esc(relDay(t.fecha))}</span><span>${s.out ? '-' + fmt(s.out) : ''}${s.in ? ' +' + fmt(s.in) : ''}</span></div>`;
    }
    html += txRow(t, i);
  });
  if (all.length <= ui.txShown) html += `<div class="tx-end">— ${all.length} movimientos · eso es todo —</div>`;
  $('txList').innerHTML = html;
}
function txRow(t, i = 0) {
  const c = catCfg(t.categoria), isIn = t.tipo === 'ingreso';
  const badge = t.local && !t.synced && S.hasSupabase() ? '<span class="badge q">pendiente</span>'
    : t.fromApp && t.fecha === todayIso() ? '<span class="badge">nuevo</span>'
    : t.origen === 'telegram' && t.fecha === todayIso() ? '<span class="badge tg">telegram</span>' : '';
  return `<button class="tx" data-act="txDetail" data-key="${esc(t.key)}" style="animation-delay:${Math.min(i, 10) * 25}ms">
    <div class="tx-ic" style="background:${c.c}22">${emojiFor(t.descripcion, t.categoria)}</div>
    <div class="tx-inf"><div class="tx-nm">${esc(t.descripcion)}${badge}</div><div class="tx-mt">${esc(t.categoria)}${t.hora ? ' · ' + esc(t.hora) : ''}</div></div>
    <div class="tx-r"><span class="tx-am" style="color:${isIn ? 'var(--green)' : 'var(--text)'}">${isIn ? '+' : '-'}${fmt(t.monto)}</span></div>
  </button>`;
}
function setupInfinite() {
  txObserver = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting) && ui.txShown < filteredTx().length) { ui.txShown += 30; renderTx(); }
  }, { rootMargin: '400px' });
  txObserver.observe($('txSentinel'));
}
function txDetail(key) {
  const t = S.allTx().find(x => x.key === key); if (!t) return;
  const c = catCfg(t.categoria), isIn = t.tipo === 'ingreso';
  const canDel = (t.local) || (t.id != null && S.hasSupabase());
  const src = { app: 'App', telegram: 'Telegram', sheet: 'Google Sheet (histórico)', demo: 'Demo', banco: 'Import. banco', correo: 'Alerta por correo' }[t.origen] || t.origen;
  openSheet('Movimiento', `
    <div class="rev" style="animation:none"><div class="rev-top">
      <div class="rev-ic" style="background:${c.c}22">${emojiFor(t.descripcion, t.categoria)}</div>
      <div class="rev-inf"><div class="rev-nm">${esc(t.descripcion)}</div><div class="tx-mt">${esc(t.categoria)} · ${isIn ? 'ingreso' : 'gasto'}</div></div>
      <div class="rev-am" style="color:${isIn ? 'var(--green)' : 'var(--red)'}">${isIn ? '+' : '-'}${fmt(t.monto)}</div></div></div>
    <div class="stack" style="font-size:13px;color:var(--muted);margin:10px 0 16px">
      <div>📅 ${esc(relDay(t.fecha))}${t.hora ? ' · ' + esc(t.hora) : ''}</div>
      <div>📥 Origen: ${esc(src)}${t.local ? (t.synced ? ' · sincronizado ✓' : S.hasSupabase() ? ' · pendiente de subir' : ' · guardado en este dispositivo') : ''}</div>
      ${t.original ? `<div>💬 “${esc(t.original)}”</div>` : ''}
    </div>
    <div class="stack">
      <button class="btn-ghost" data-act="askAbout" data-key="${esc(t.key)}">🔮 Preguntarle a IO sobre esto</button>
      ${canDel ? `<button class="btn-ghost btn-danger" data-act="delTx" data-key="${esc(t.key)}">🗑 Eliminar</button>` : '<div class="hint">Los movimientos del Sheet histórico/demo son de solo lectura.</div>'}
    </div>`);
}

/* ---------- ④ calendario ---------- */
function renderCalendar() {
  $('calMonth').textContent = `${MESES[ui.vm]} ${ui.vy}`;
  const byDay = {};
  const add = (iso, k, v = 1) => { const d = dateOf(iso); if (d.getMonth() !== ui.vm || d.getFullYear() !== ui.vy) return; (byDay[d.getDate()] ||= { out: 0, in: 0, h: 0, j: 0 })[k] += v; };
  F.md.forEach(t => add(t.fecha, t.tipo === 'ingreso' ? 'in' : 'out', t.monto));
  S.itemsOf('health').forEach(h => add(h.fecha, 'h'));
  S.itemsOf('journal').forEach(j => add(j.fecha, 'j'));
  const maxOut = Math.max(1, ...Object.values(byDay).map(d => d.out));
  const first = new Date(ui.vy, ui.vm, 1).getDay();
  const dim = new Date(ui.vy, ui.vm + 1, 0).getDate();
  const now = new Date();
  const isCur = ui.vy === now.getFullYear() && ui.vm === now.getMonth();
  let html = '<div class="cal-grid">' + DIAS.map(d => `<div class="cal-dh">${d}</div>`).join('');
  for (let i = 0; i < first; i++) html += '<div class="cal-d empty"></div>';
  for (let d = 1; d <= dim; d++) {
    const x = byDay[d]; const today = isCur && d === now.getDate(); const future = isCur && d > now.getDate();
    const dots = x ? [x.out && 'var(--red)', x.in && 'var(--green)', x.h && 'var(--pink)', x.j && 'var(--acc2)'].filter(Boolean).map(c => `<i class="cdot" style="background:${c}"></i>`).join('') : '';
    const heat = x?.out ? `<span class="heat" style="background:rgba(248,113,113,${(0.05 + x.out / maxOut * 0.22).toFixed(2)})"></span>` : '';
    html += `<button class="cal-d${today ? ' today' : ''}${future ? ' future' : ''}" data-act="day" data-day="${d}">${heat}${d}<span class="cdots">${dots}</span></button>`;
  }
  $('calGrid').innerHTML = html + '</div>';
}
function showDay(day) {
  const iso = `${ui.vy}-${pad(ui.vm + 1)}-${pad(day)}`;
  const txs = S.allTx().filter(t => t.fecha === iso).sort((a, b) => (b.hora || '').localeCompare(a.hora || ''));
  const out = txs.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0);
  const inn = txs.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0);
  const h = S.getItem(`health:${iso}`);
  const js = S.itemsOf('journal').filter(j => j.fecha === iso);
  const people = S.itemsOf('person');
  const inter = S.itemsOf('interaction').filter(i => i.fecha === iso);
  const fs = fijos().filter(f => Number(f.dia) === day);
  let html = `<div class="day-sum">${out ? `<div><div class="day-sum-v red">-${fmt(out)}</div><div class="cn-lbl">Gastado</div></div>` : ''}${inn ? `<div><div class="day-sum-v green">+${fmt(inn)}</div><div class="cn-lbl">Recibido</div></div>` : ''}${!out && !inn ? '<div class="muted" style="font-size:13px">Sin movimientos de dinero.</div>' : ''}</div>`;
  if (h) html += `<div class="sec-t">Salud</div>${h.sueno != null ? `<span class="day-chip">😴 ${h.sueno}h</span>` : ''}${h.agua ? `<span class="day-chip">💧 ${h.agua} vasos</span>` : ''}${h.ejercicio ? `<span class="day-chip">🏋️ ${h.ejercicio} min</span>` : ''}${h.pasos ? `<span class="day-chip">👟 ${h.pasos}</span>` : ''}${h.animo ? `<span class="day-chip">${MOODS[h.animo - 1]} ánimo</span>` : ''}`;
  if (inter.length) html += `<div class="sec-t">Relaciones</div>${inter.map(i => `<span class="day-chip">${esc(people.find(p => p.id === i.personaId)?.emoji || '💬')} ${esc(people.find(p => p.id === i.personaId)?.nombre || '')}${i.nota ? ' · ' + esc(i.nota) : ''}</span>`).join('')}`;
  if (js.length) html += `<div class="sec-t">Diario</div>${js.map(j => `<div class="j-entry"><div class="j-meta"><span>${esc(j.hora || '')}</span><span>${j.animo ? MOODS[j.animo - 1] : ''}</span></div><div class="j-txt">${esc(j.texto)}</div></div>`).join('')}`;
  const evs = S.itemsOf('event').filter(e => e.fecha === iso);
  if (evs.length) html += `<div class="sec-t">Agenda</div>${evs.map(e => `<span class="day-chip">📅 ${esc(e.hora || '')} ${esc(e.titulo)}</span>`).join('')}`;
  if (fs.length) html += `<div class="sec-t">Pagos fijos este día</div>${fs.map(f => `<span class="day-chip">${emojiFor(f.descripcion, f.categoria)} ${esc(f.descripcion)} · ${fmt(f.monto)}</span>`).join('')}`;
  if (txs.length) html += `<div class="sec-t">Movimientos</div>${txs.map(txRow).join('')}`;
  openSheet(`${day} de ${MESES[ui.vm]} ${ui.vy}`, html);
}

/* ---------- ⑤ programados ---------- */
function renderPending() {
  const today = new Date().getDate();
  const rows = [
    ...F.future.filter(t => t.tipo === 'gasto').map(t => ({ kind: 'tx', desc: t.descripcion, monto: t.monto, cat: t.categoria, dia: t.d.getDate(), key: t.key })),
    ...F.fijosPend.map(f => ({ kind: 'fijo', desc: f.descripcion, monto: Number(f.monto), cat: f.categoria, dia: Number(f.dia), id: f.id })),
  ].sort((a, b) => a.dia - b.dia);
  if (!F.isCur) { $('pendList').innerHTML = '<div class="empty">Los pagos programados se muestran para el mes actual.</div>'; return; }
  if (!rows.length) { $('pendList').innerHTML = '<div class="empty">Sin pagos pendientes este mes ✅</div>'; return; }
  $('pendList').innerHTML = rows.map((r, i) => {
    const c = catCfg(r.cat); const late = r.kind === 'fijo' && r.dia < today;
    const when = r.dia === today ? 'hoy' : late ? `día ${r.dia} · ¿pagado?` : `día ${r.dia} · en ${r.dia - today} días`;
    return `<div class="pend" style="animation-delay:${i * 30}ms">
      <div class="pend-ic" style="background:${c.c}22">${emojiFor(r.desc, r.cat)}</div>
      <div class="pend-inf"><div class="pend-nm">${esc(r.desc)}</div><div class="pend-dt${late ? ' late' : ''}">${when}</div></div>
      <span class="pend-am">${fmt(r.monto)}</span>
      ${r.kind === 'fijo' ? `<button class="pay-btn" data-act="payFijo" data-id="${esc(r.id)}">✓ Pagado</button>` : ''}
    </div>`;
  }).join('') + `<div class="pend-sum"><span>Por pagar este mes</span><b>${fmt(F.pendTotal)}</b></div>`;
}
function payFijo(id) {
  const f = S.getItem(id); if (!f) return;
  S.addTx({ fecha: todayIso(), hora: nowHM(), descripcion: f.descripcion, monto: Number(f.monto), tipo: 'gasto', categoria: f.categoria || 'otros', original: `[Fijo] ${f.descripcion}` });
  toast(`✓ ${f.descripcion} marcado como pagado`); render();
}
function fijosSheet() {
  const fs = fijos();
  openSheet('Gastos fijos mensuales', `
    <div class="hint">Se muestran como pendientes cada mes hasta que aparezca el pago (por Telegram, banco o “✓ Pagado”). No cuentan contra tu presupuesto variable.</div>
    <div class="stack" id="fijoList">${fs.map(f => `
      <div class="imp-row"><span style="font-size:18px">${emojiFor(f.descripcion, f.categoria)}</span>
        <div class="d"><div>${esc(f.descripcion)}</div><div>día ${f.dia} · ${esc(f.categoria)}</div></div>
        <b style="font-family:var(--mono)">${fmt(f.monto)}</b>
        <button class="rev-x" data-act="delFijo" data-id="${esc(f.id)}" aria-label="Eliminar">✕</button></div>`).join('') || '<div class="empty">Sin fijos.</div>'}
    </div>
    <div class="sec-t">Agregar fijo</div>
    <div class="row"><div class="field"><label>Descripción</label><input class="inp" id="fjDesc" placeholder="Renta"></div>
    <div class="field" style="max-width:100px"><label>Monto</label><input class="inp" id="fjMonto" type="number" step="0.01" inputmode="decimal"></div></div>
    <div class="row"><div class="field" style="max-width:90px"><label>Día</label><input class="inp" id="fjDia" type="number" min="1" max="31" value="1"></div>
    <div class="field"><label>Categoría</label><select class="sel" id="fjCat">${CATS.filter(c => c !== 'ingreso').map(c => `<option>${c}</option>`).join('')}</select></div></div>
    <button class="btn-acc" data-act="addFijo">+ Agregar</button>`);
}

/* ---------- ⑥ metas ---------- */
function ringSVG(pct, color, size = 52, stroke = 5) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--s4)" stroke-width="${stroke}" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamp(pct) / 100)}" style="transition:stroke-dashoffset .8s"/></svg>`;
}
const PCOL = { finanzas: 'var(--green)', salud: 'var(--pink)', social: 'var(--cyan)', mente: 'var(--acc2)' };
function renderGoals() {
  const gs = S.itemsOf('goal');
  if (!gs.length) { $('goals').innerHTML = '<div class="empty">Define una meta: un fondo de emergencia, ir al gym 3×/semana, lanzar un proyecto…</div>'; return; }
  $('goals').innerHTML = gs.map(g => {
    const pct = Math.round(g.actual / g.objetivo * 100);
    const unit = g.unidad === '$' ? fmt0 : v => `${v} ${esc(g.unidad || '')}`;
    const left = g.limite ? daysBetween(new Date(), dateOf(g.limite)) : null;
    return `<div class="goal"><div class="ring">${ringSVG(pct, PCOL[g.pilar] || 'var(--acc2)')}<span>${esc(g.emoji || '🎯')}</span></div>
      <button class="goal-inf" data-act="goalSheet" data-id="${esc(g.id)}" style="text-align:left"><div class="goal-nm">${esc(g.nombre)}</div>
      <div class="goal-mt">${unit(g.actual)} / ${unit(g.objetivo)}${left != null ? ` · ${left >= 0 ? `${left} días` : 'vencida'}` : ''}</div></button>
      <span class="goal-pct" style="color:${pct >= 100 ? 'var(--green)' : 'var(--text)'}">${pct >= 100 ? '🏆' : pct + '%'}</span>
      <button class="plus-btn" data-act="goalSheet" data-id="${esc(g.id)}" aria-label="Aportar">+</button></div>`;
  }).join('');
}
function goalSheet(id) {
  const g = id ? S.getItem(id) : null;
  openSheet(g ? g.nombre : 'Nueva meta', `
    ${g ? `<div class="sec-t">Aportar progreso</div>
      <div class="row"><div class="field"><label>Cantidad (${esc(g.unidad || '')})</label><input class="inp" id="gAdd" type="number" step="0.01" inputmode="decimal" placeholder="${g.unidad === '$' ? '100' : '1'}"></div>
      <div class="field" style="flex:0 0 auto;justify-content:flex-end"><button class="btn-acc btn-green" data-act="goalAdd" data-id="${esc(g.id)}" style="padding:10px 18px">+ Sumar</button></div></div>
      <div class="sec-t">Editar</div>` : ''}
    <div class="row"><div class="field" style="max-width:70px"><label>Emoji</label><input class="inp" id="gEmoji" value="${esc(g?.emoji || '🎯')}" maxlength="4"></div>
    <div class="field"><label>Nombre</label><input class="inp" id="gName" value="${esc(g?.nombre || '')}" placeholder="Fondo de emergencia"></div></div>
    <div class="row"><div class="field"><label>Objetivo</label><input class="inp" id="gObj" type="number" step="0.01" value="${g?.objetivo ?? ''}" placeholder="1500"></div>
    <div class="field"><label>Actual</label><input class="inp" id="gAct" type="number" step="0.01" value="${g?.actual ?? 0}"></div>
    <div class="field" style="max-width:100px"><label>Unidad</label><input class="inp" id="gUnit" value="${esc(g?.unidad || '$')}"></div></div>
    <div class="row"><div class="field"><label>Pilar</label><select class="sel" id="gPilar">${Object.entries(PILLARS).map(([k, p]) => `<option value="${k}"${g?.pilar === k ? ' selected' : ''}>${p.ic} ${p.lbl}</option>`).join('')}</select></div>
    <div class="field"><label>Fecha límite</label><input class="inp" id="gLim" type="date" value="${esc(g?.limite || '')}"></div></div>
    <div class="stack"><button class="btn-acc" data-act="goalSave" data-id="${esc(g?.id || '')}">Guardar meta</button>
    ${g ? `<button class="btn-ghost btn-danger" data-act="goalDel" data-id="${esc(g.id)}">Eliminar meta</button>` : ''}</div>`);
}

/* ---------- ⑦ salud ---------- */
function renderHealth(H) {
  const h = H.today;
  $('healthScore').textContent = H.score == null ? '' : `${H.score}/100`;
  const tiles = [
    ['sueno', '😴', h.sueno ?? '—', 'sueño h', 0.5],
    ['agua', '💧', h.agua ?? 0, 'vasos', 1],
    ['ejercicio', '🏋️', h.ejercicio ?? 0, 'min ejerc.', 15],
    ['pasos', '👟', h.pasos ? (h.pasos / 1000).toFixed(1) + 'k' : '0', 'pasos', 1000],
  ];
  $('hGrid').innerHTML = tiles.map(([k, ic, v, l, st]) => `<div class="h-tile"><span class="h-ic">${ic}</span><span class="h-val">${v}</span><span class="h-lbl">${l}</span>
    <div class="h-btns"><button data-act="h" data-k="${k}" data-v="${-st}" aria-label="menos">−</button><button data-act="h" data-k="${k}" data-v="${st}" aria-label="más">+</button></div></div>`).join('');
  $('moodPick').innerHTML = `<span>¿Cómo te sientes?</span><div class="mp">${MOODS.map((m, i) => `<button class="${h.animo === i + 1 ? 'on' : ''}" data-act="hMood" data-v="${i + 1}" aria-label="ánimo ${i + 1}">${m}</button>`).join('')}</div>`;
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return isoOf(d); });
  const vals = days.map(d => healthOf(d).sueno);
  const any = vals.some(v => v != null);
  $('sleepSpark').innerHTML = any ? `<div style="flex:1"><div class="spark-cap">Sueño · últimos 7 días (meta 7–9h)</div><div class="spark" style="height:60px">${days.map((d, i) => `<div class="spark-col"><div class="spark-bar" style="height:${vals[i] ? vals[i] / 10 * 100 : 3}%;${vals[i] != null && vals[i] < 6 ? 'background:var(--amber)' : ''};animation-delay:${i * 50}ms" title="${vals[i] ?? '—'}h"></div><span class="spark-lbl">${DIAS[dateOf(d).getDay()]}</span></div>`).join('')}</div></div>` : '<div class="hint" style="margin:0">Registra tu sueño con los botones o dile a IO “dormí 7 horas”.</div>';
}
function bumpHealth(k, delta) {
  const iso = todayIso(); const h = { ...healthOf(iso) };
  const base = h[k] ?? (k === 'sueno' ? 7 - delta : 0);
  h[k] = Math.max(0, Math.round((base + delta) * 10) / 10);
  if (k !== 'sueno' && h[k] === 0) delete h[k];
  S.putItem('health', h, `health:${iso}`); render();
}

/* ---------- ⑧ relaciones ---------- */
function renderPeople(P) {
  if (!P.people.length) { $('people').innerHTML = '<div class="empty">Agrega a las personas que importan (familia, pareja, amigos) y cada cuánto quieres hablar con ellas. IO te recordará.</div>'; return; }
  $('people').innerHTML = P.people.map(p => {
    const due = p.days == null || p.days > p.cada;
    const pct = p.days == null ? 0 : clamp((1 - p.days / (p.cada * 2)) * 100);
    const col = pct > 50 ? 'var(--green)' : pct > 20 ? 'var(--amber)' : 'var(--red)';
    return `<div class="person"><div class="p-av">${ringSVG(pct, col, 48, 3)}<span style="position:relative">${esc(p.emoji || '🙂')}</span></div>
      <button class="p-inf" data-act="personSheet" data-id="${esc(p.id)}"><div class="p-nm">${esc(p.nombre)}</div>
      <div class="p-mt${due ? ' due' : ''}">${p.days == null ? 'sin registros aún' : p.days === 0 ? 'hablaron hoy ✓' : `hace ${p.days} día${p.days > 1 ? 's' : ''}`} · cada ${p.cada} días</div></button>
      <div class="p-acts"><button data-act="contact" data-id="${esc(p.id)}" title="Registrar contacto hoy">💬</button></div></div>`;
  }).join('');
}
function personSheet(id) {
  const P = peopleInfo(); const p = id ? P.people.find(x => x.id === id) : null;
  openSheet(p ? `${p.emoji || ''} ${p.nombre}` : 'Nueva persona', `
    ${p ? `<div class="sec-t">Registrar contacto</div>
      <div class="ex-chips" style="margin-bottom:10px">${['💬 mensaje', '📞 llamada', '🎥 videollamada', '☕ nos vimos', '🎁 detalle'].map(t => `<button class="ex-chip" data-act="contactType" data-id="${esc(p.id)}" data-t="${t}">${t}</button>`).join('')}</div>
      <div class="field"><input class="inp" id="pNote" placeholder="Nota opcional (de qué hablaron, cómo está…)"></div>
      ${p.history.length ? `<div class="sec-t">Historial</div>${p.history.slice(0, 12).map(h => `<div class="imp-row"><div class="d"><div>${esc(h.tipo || 'contacto')}${h.nota ? ' · ' + esc(h.nota) : ''}</div><div>${esc(relDay(h.fecha))}</div></div><button class="rev-x" data-act="delInter" data-id="${esc(h.id)}">✕</button></div>`).join('')}` : ''}
      <div class="sec-t">Editar</div>` : ''}
    <div class="row"><div class="field" style="max-width:70px"><label>Emoji</label><input class="inp" id="pEmoji" value="${esc(p?.emoji || '🙂')}" maxlength="4"></div>
    <div class="field"><label>Nombre</label><input class="inp" id="pName" value="${esc(p?.nombre || '')}" placeholder="Mamá"></div></div>
    <div class="row"><div class="field"><label>Relación</label><select class="sel" id="pRel">${['familia', 'pareja', 'amigo', 'trabajo', 'mentor', 'otro'].map(r => `<option${p?.relacion === r ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
    <div class="field"><label>Hablar cada (días)</label><input class="inp" id="pCada" type="number" min="1" value="${p?.cada || 7}"></div></div>
    <div class="field"><label>Cumpleaños (opcional)</label><input class="inp" id="pBday" type="date" value="${esc(p?.cumple || '')}"></div>
    <div class="stack"><button class="btn-acc" data-act="personSave" data-id="${esc(p?.id || '')}">Guardar</button>
    ${p ? `<button class="btn-ghost btn-danger" data-act="personDel" data-id="${esc(p.id)}">Eliminar</button>` : ''}</div>`);
}
function logContact(personaId, tipo = 'contacto', nota = '') {
  S.putItem('interaction', { personaId, fecha: todayIso(), tipo, nota });
  const p = S.getItem(personaId);
  toast(`💬 Contacto con ${p?.nombre || ''} registrado`); render(); autoClaim(`contacto:${personaId}`);
}

/* ---------- ⑨ diario ---------- */
function renderJournal(M) {
  $('journalCount').textContent = M.entries.length ? `${M.entries.length} entradas` : '';
  $('jMoods').innerHTML = MOODS.map((m, i) => `<button class="${ui.jMood === i + 1 ? 'on' : ''}" data-act="jMood" data-v="${i + 1}" aria-label="ánimo ${i + 1}">${m}</button>`).join('');
  const pr = J_PROMPTS[new Date().getDate() % J_PROMPTS.length];
  $('jPrompt').innerHTML = `💭 ${esc(pr)} <button data-act="useJPrompt">usar</button>`;
  $('jList').innerHTML = M.entries.slice(0, 8).map(e => `<div class="j-entry"><div class="j-meta"><span>${esc(relDay(e.fecha))}${e.hora ? ' · ' + esc(e.hora) : ''} ${e.animo ? MOODS[e.animo - 1] : ''}</span><button class="j-del" data-act="delJournal" data-id="${esc(e.id)}">borrar</button></div><div class="j-txt">${esc(e.texto)}</div></div>`).join('') || '<div class="empty">Tu diario está vacío. Escribe cómo te fue — IO lo usará para entenderte mejor.</div>';
}
function saveJournal() {
  const t = $('jText').value.trim(); if (!t) { $('jText').focus(); return; }
  S.putItem('journal', { fecha: todayIso(), hora: nowHM(), texto: t, animo: ui.jMood });
  $('jText').value = ''; ui.jMood = null;
  toast('📝 Guardado en tu diario'); render(); autoClaim('diario');
}

/* ---------- ⑩ categorías / fuentes ---------- */
function renderCats() {
  document.querySelectorAll('#catSeg button').forEach(b => b.classList.toggle('on', b.dataset.cat === ui.catMode));
  const src = ui.catMode === 'src' ? F.paid.filter(t => t.tipo === 'ingreso') : F.paid.filter(t => t.tipo === 'gasto');
  $('catTitle').textContent = `${ui.catMode === 'src' ? 'Ingresos' : 'Gastos'} · ${MESES[ui.vm]}`;
  const tot = {}, catOf = {};
  src.forEach(t => { const k = ui.catMode === 'cat' ? t.categoria : t.descripcion; tot[k] = (tot[k] || 0) + t.monto; catOf[k] ||= t.categoria; });
  const items = Object.entries(tot).sort((a, b) => b[1] - a[1]);
  const sum = items.reduce((s, [, v]) => s + v, 0);
  if (!items.length) { $('catList').innerHTML = '<div class="empty">Sin datos este mes.</div>'; $('donut').innerHTML = ''; $('donutC').innerHTML = ''; return; }
  const palette = ['#7c5cff', '#22d3ee', '#4ade80', '#fbbf24', '#f472b6', '#f87171', '#60a5fa', '#fb923c', '#a78bfa', '#9ca3af'];
  const colorOf = (k, i) => ui.catMode === 'cat' ? catCfg(k).c : palette[i % palette.length];
  const r = 48, C = 2 * Math.PI * r; let off = 0;
  $('donut').innerHTML = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--s3)" stroke-width="14"/>` + items.slice(0, 9).map(([k, v], i) => {
    const len = v / sum * C; const s = `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${colorOf(k, i)}" stroke-width="14" stroke-dasharray="${Math.max(len - 1.5, 0.5)} ${C}" stroke-dashoffset="${-off}"/>`;
    off += len; return s;
  }).join('');
  $('donutC').innerHTML = `<b>${fmt0(sum)}</b><small>${ui.catMode === 'src' ? 'recibido' : 'gastado'}</small>`;
  const max = items[0][1];
  $('catList').innerHTML = items.slice(0, 12).map(([k, v], i) => `<div class="cat-item"><div class="cat-top"><span class="cat-left"><span>${emojiFor(k, catOf[k])}</span><span>${esc(k)}</span></span><span class="cat-v">${fmt(v)} · ${Math.round(v / sum * 100)}%</span></div>
    <div class="cat-bar-t"><div class="cat-bar-f" style="width:${v / max * 100}%;background:${colorOf(k, i)};animation-delay:${i * 40}ms"></div></div></div>`).join('');
}

/* ---------- ⑪ conexiones ---------- */
function renderConn() {
  const st = S.status;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const c = [
    ['claude', '🔮', 'Claude (IA)', S.getKey() ? 'Activo en esta sesión' : 'Toca para activar', S.getKey() ? 'ok' : ''],
    ['settings', '🗄️', 'Supabase', st.supabase === 'ok' ? `En vivo${st.items === 'missing' ? ' · falta tabla io_items' : ''}` : st.supabase === 'error' ? 'Error de conexión' : 'No conectado', st.supabase === 'ok' ? (st.items === 'missing' ? 'err' : 'ok') : st.supabase === 'error' ? 'err' : ''],
    ['telegram', '✈️', 'Telegram', cfg.telegramBot ? `@${cfg.telegramBot}` : 'Háblale a IO por chat', cfg.telegramBot ? 'ok' : ''],
    ['bank', '🏦', 'Banco (CSV)', 'Importa tu estado de cuenta', ''],
    ['email', '📧', 'Alertas del correo', 'Reenvía alertas del banco', ''],
    ['settings', '📊', 'Google Sheet', st.sheet === 'ok' ? 'Histórico cargado' : 'Histórico (opcional)', st.sheet === 'ok' ? 'ok' : st.sheet === 'error' ? 'err' : ''],
    ['install', '📲', 'Instalar app', standalone ? 'Instalada ✓' : 'Android · iPhone · PC', standalone ? 'ok' : ''],
    ['ics', '📅', 'Calendario', `${S.itemsOf('event').filter(e => e.fecha >= todayIso()).length} eventos · importar .ics`, S.itemsOf('event').length ? 'ok' : ''],
    ['backup', '💾', 'Respaldo', 'Exportar / importar', ''],
  ];
  $('connGrid').innerHTML = c.map(([a, ic, n, d, s]) => `<button class="conn" data-act="${a}"><div class="conn-top"><span class="conn-ic">${ic}</span><span class="conn-st ${s}"></span></div><div class="conn-nm">${n}</div><div class="conn-d">${esc(d)}</div></button>`).join('');
}


/* ================= el juego de la vida real ================= */
let sayT;
function say(text, lockMs = 0) {
  const el = $('dlgText'); if (!el) return;
  clearInterval(sayT);
  if (lockMs) ui.sayLock = Date.now() + lockMs;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = text; return; }
  let i = 0; el.textContent = '';
  sayT = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) clearInterval(sayT); }, 16);
}

function renderRoom(scores, life) {
  const g = G.state(); const lvl = G.levelOf(g.xp); const tier = G.tierOf(lvl);
  $('room').dataset.tier = tier;
  const deco = [];
  if (tier >= 1) deco.push('<span style="top:92px;left:22px;font-size:14px">🕯️</span>');
  if (tier >= 2) deco.push('<span style="top:40px;left:27%;font-size:16px">🖼️</span>');
  if (tier >= 3) deco.push('<span class="neon">IO</span>');
  if (tier >= 4) deco.push('<span style="bottom:140px;right:40%;font-size:18px">🔥</span>');
  $('tierDeco').innerHTML = deco.join('');
  for (const slot of ['wallL', 'ceiling', 'floorL', 'floorR', 'pet']) {
    const it = G.itemById(g.equipped[slot]);
    const el = $('slot-' + slot); el.textContent = it ? it.e : ''; el.title = it ? it.n : '';
    if (slot === 'floorL') el.classList.toggle('wilt', !!it && ['planta', 'cactus'].includes(it.id) && scores.salud != null && scores.salud < 35);
  }
  $('trophy').textContent = S.itemsOf('goal').some(x => x.actual >= x.objetivo) ? '🏆' : '';
  const wrap = $('avWrap');
  wrap.className = 'av-wrap ' + ['head', 'face'].map(k => g.equipped[k] ? 'wear-' + g.equipped[k] : '').join(' ');
  $('led').classList.toggle('low', life < 45);
}

const ALL_PRIOS = ['dinero', 'sueno', 'ejercicio', 'gente', 'diario', 'proyectos', 'agua', 'calma'];
function questsToday() {
  const t = todayIso(), g = G.state(), claimed = G.claimedToday(g), tg = TG();
  const pr = new Set(cfg.priorities?.length ? cfg.priorities : ALL_PRIOS);
  const h = healthOf(t); const q = [];
  const add = o => q.push({ pct: null, ...o, claimed: claimed.has(o.id) });
  const txToday = S.allTx().filter(x => x.fecha === t);
  if (pr.has('dinero')) {
    add({ id: 'registro', ic: '🧾', t: 'Registra tus movimientos de hoy', s: txToday.length ? `${txToday.length} registrado(s) ✓` : g.noSpend[t] ? 'Hoy no gastaste 💪' : 'Un gasto, un ingreso… o marca que no gastaste', done: txToday.length > 0 || !!g.noSpend[t], xp: 10, c: 6, act: 'jump', prop: '💰', go: 'capture', goLbl: 'Registrar', alt: 'Hoy no gasté' });
    const now = new Date(); const fs = fijos();
    const daily = (Number(cfg.presupuesto) || 501) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const spent = txToday.filter(x => x.tipo === 'gasto' && !isFijoTx(x, fs)).reduce((a, x) => a + x.monto, 0);
    const late = now.getHours() >= 20;
    add({ id: 'presupuesto', ic: '🛡️', t: `Cierra el día bajo ${fmt0(daily)} de gasto variable`, s: `llevas ${fmt(spent)}${late ? '' : ' · se evalúa desde las 8pm'}${spent > daily ? ' · te pasaste hoy' : ''}`, pct: Math.min(spent / daily, 1), bad: spent > daily, done: late && spent <= daily, xp: 30, c: 15, act: 'dance', prop: '💎' });
  }
  if (pr.has('agua')) add({ id: 'agua', ic: '💧', t: `Toma ${tg.agua} vasos de agua`, s: `${h.agua || 0}/${tg.agua} vasos`, pct: (h.agua || 0) / tg.agua, done: (h.agua || 0) >= tg.agua, xp: 15, c: 8, act: 'jump', prop: '🥤', go: 'water', goLbl: '+1 💧' });
  if (pr.has('ejercicio')) add({ id: 'mover', ic: '🏋️', t: `Muévete ${tg.ejercicio} minutos`, s: `${h.ejercicio || 0}/${tg.ejercicio} min`, pct: (h.ejercicio || 0) / tg.ejercicio, done: (h.ejercicio || 0) >= tg.ejercicio, xp: 25, c: 12, act: 'flex', prop: '🏋️', go: 'move', goLbl: '+15 min' });
  if (pr.has('sueno')) add({ id: 'dormir', ic: '😴', t: `Dormir ${tg.sueno}h o más`, s: h.sueno != null ? `anoche: ${h.sueno}h${h.sueno < tg.sueno ? ' · esta noche lo logras' : ''}` : '¿cuánto dormiste anoche?', done: h.sueno != null && h.sueno >= tg.sueno, xp: 20, c: 10, act: 'flex', prop: '🌙', go: h.sueno == null ? 'sleep' : null, goLbl: 'Anotar' });
  if (pr.has('calma')) add({ id: 'animo', ic: '🧘', t: 'Haz check-in de cómo te sientes', s: h.animo ? `hoy: ${MOODS[h.animo - 1]}` : '', done: !!h.animo, xp: 10, c: 5, act: 'wave', prop: '💜', moods: !h.animo });
  if (pr.has('diario')) add({ id: 'diario', ic: '📝', t: 'Escribe en tu diario', s: J_PROMPTS[new Date().getDate() % J_PROMPTS.length], done: S.itemsOf('journal').some(j => j.fecha === t), xp: 20, c: 10, act: 'wave', prop: '📝', go: 'journal', goLbl: 'Escribir' });
  if (pr.has('gente')) {
    const P = peopleInfo();
    P.people.filter(p => p.last === t || p.days == null || p.days >= p.cada).slice(0, 2).forEach(p =>
      add({ id: `contacto:${p.id}`, ic: p.emoji || '💬', t: `Habla con ${p.nombre}`, s: p.last === t ? 'hablaron hoy ✓' : p.days == null ? 'aún sin registros' : `hace ${p.days} días · quieres cada ${p.cada}`, done: p.last === t, xp: 20, c: 12, act: 'dance', prop: '💬', go: 'contact', goLbl: 'Ya hablé', data: p.id }));
  }
  if (pr.has('proyectos')) {
    S.itemsOf('goal').filter(x => x.actual < x.objetivo || x.lastAporte === t).slice(0, 2).forEach(x =>
      add({ id: `meta:${x.id}`, ic: x.emoji || '🎯', t: `Avanza en “${x.nombre}”`, s: `${Math.round(x.actual / x.objetivo * 100)}% · ${x.unidad === '$' ? fmt0(x.actual) : x.actual} de ${x.unidad === '$' ? fmt0(x.objetivo) : x.objetivo + ' ' + (x.unidad || '')}`, pct: x.actual / x.objetivo, done: x.lastAporte === t, xp: 25, c: 15, act: 'jump', prop: '🚩', go: 'goal', goLbl: 'Aportar', data: x.id }));
  }
  const dow = new Date().getDay();
  S.itemsOf('habit').filter(x => !x.dias || x.dias.includes(dow)).forEach(x =>
    add({ id: `habit:${x.id}`, ic: x.emoji || '⭐', t: x.nombre, s: '', tag: 'hábito', manual: true, done: false, xp: 15, c: 8, act: 'flex', prop: x.emoji || '⭐' }));
  S.itemsOf('event').filter(e => e.fecha === t).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')).forEach(e =>
    add({ id: `event:${e.id}`, ic: '📅', t: e.titulo, s: e.hora || 'hoy', tag: 'agenda', manual: true, done: false, xp: 10, c: 5, act: 'wave', prop: '📅', del: e.id }));
  q.forEach(x => { if (x.manual) x.done = x.claimed; });
  return q;
}
function renderQuests(qs = questsToday()) {
  const done = qs.filter(q => q.claimed).length;
  $('questProg').textContent = qs.length ? `${done}/${qs.length}` : '';
  if (!qs.length) { $('questList').innerHTML = '<div class="empty">Configura tus prioridades para recibir misiones. <button class="q-link" data-act="onboarding">Configurar</button></div>'; $('chest').innerHTML = ''; return; }
  const order = q => q.claimed ? 2 : q.done ? 0 : 1;
  $('questList').innerHTML = [...qs].sort((a, b) => order(a) - order(b)).map(q => {
    const ready = q.done && !q.claimed;
    let btn;
    if (q.claimed) btn = '<span class="q-check">✓</span>';
    else if (ready || q.manual) btn = `<button class="q-btn" data-act="qClaim" data-id="${esc(q.id)}">${ready ? 'Reclamar 🎁' : 'Hecho ✓'}</button>`;
    else if (q.go) btn = `<button class="q-btn" data-act="qGo" data-id="${esc(q.id)}">${esc(q.goLbl)}</button>`;
    else btn = '<span class="q-rw">⏳</span>';
    return `<div class="q${ready ? ' ready' : ''}${q.claimed ? ' done' : ''}" data-q="${esc(q.id)}">
      <div class="q-ic">${esc(q.ic)}</div>
      <div><div class="q-t">${esc(q.t)}</div>
        <div class="q-s">${q.tag ? `<span class="q-tag">${q.tag}</span>` : ''}<span class="q-rw">+${q.xp}XP · ${q.c}🪙</span>${q.s ? `<span>${esc(q.s)}</span>` : ''}
          ${q.alt && !q.done && !q.claimed ? `<button class="q-link" data-act="qNoSpend">${q.alt}</button>` : ''}
          ${q.del && !q.claimed ? `<button class="q-link" data-act="delEvent" data-id="${esc(q.del)}">quitar</button>` : ''}</div>
        ${q.moods ? `<div class="q-moods">${MOODS.map((m, i) => `<button data-act="qMood" data-v="${i + 1}" aria-label="ánimo ${i + 1}">${m}</button>`).join('')}</div>` : ''}
        ${q.pct != null && !q.claimed ? `<div class="q-bar"><i style="width:${clamp(q.pct * 100)}%;${q.bad ? 'background:var(--red)' : ''}"></i></div>` : ''}
      </div>${btn}</div>`;
  }).join('');
  const g = G.state(); const t = todayIso();
  const all = qs.length >= 3 && done === qs.length;
  $('chest').innerHTML = g.chest[t] ? '<div class="chest opened">🎁 Cofre del día abierto · vuelve mañana por más</div>'
    : all ? '<button class="chest open-me" data-act="openChest">🎁 ¡Abrir el cofre del día! +50 XP · 30🪙</button>'
    : `<div class="chest">🎁 Cofre del día: completa todas las misiones (${done}/${qs.length})</div>`;
}
function claimQuest(id) {
  const q = questsToday().find(x => x.id === id);
  if (!q || q.claimed || !(q.done || q.manual)) return false;
  const g = G.state(); const before = G.levelOf(g.xp); const t = todayIso();
  g.xp += q.xp; g.coins += q.c; g.claimed[t] = [...(g.claimed[t] || []), id];
  G.save(g);
  celebrate(q.act, q.prop, q.xp, q.c, document.querySelector(`[data-q="${CSS.escape(id)}"]`), `¡Misión cumplida! ${q.t}. +${q.xp} XP y ${q.c} monedas.`);
  render();
  const after = G.levelOf(G.state().xp);
  if (after > before) setTimeout(() => levelUp(after, G.tierOf(after) > G.tierOf(before)), 900);
  return true;
}
function celebrate(act, prop, xp, c, fromEl, line) {
  $('screen').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  fromEl?.classList.add('claiming');
  G.avatarAct(act, prop); G.confetti(); G.blip('coin');
  G.floatText(`+${c} 🪙`); setTimeout(() => G.floatText(`+${xp} XP`, 'xp'), 200);
  G.coinsFly(fromEl?.querySelector('.q-btn') || fromEl, Math.min(8, Math.ceil(c / 2)));
  say(line, 4500);
}
function autoClaim(id) { setTimeout(() => claimQuest(id), 250); }
function autoClaimReady() {
  const ready = questsToday().filter(q => q.done && !q.claimed && !q.manual);
  ready.forEach((q, i) => setTimeout(() => claimQuest(q.id), 400 + i * 1300));
}
function levelUp(lvl, newTier) {
  const tier = G.TIERS[G.tierOf(lvl)];
  const unlocked = G.CATALOG.filter(i => i.lvl === lvl);
  const el = $('lvlup');
  el.innerHTML = `<b>¡NIVEL ${lvl}!</b>${newTier ? `<span>NUEVA CASA<br>${tier.ic} ${tier.name.toUpperCase()}</span>` : ''}${unlocked.length ? `<small>Desbloqueaste en la tienda: ${unlocked.map(i => i.e).join(' ')}</small>` : '<small>Sigue así 💪</small>'}`;
  el.hidden = false; G.blip('level'); G.confetti(50); G.avatarAct('dance', '⭐');
  say(newTier ? `¡Subiste al nivel ${lvl}! Te mudaste a: ${tier.name}.` : `¡Subiste al nivel ${lvl}!`, 5000);
  clearTimeout(levelUp.t); levelUp.t = setTimeout(() => { el.hidden = true; }, 3200);
  el.onclick = () => { el.hidden = true; };
}
function openChest() {
  const g = G.state(); const t = todayIso(); if (g.chest[t]) return;
  const before = G.levelOf(g.xp);
  g.chest[t] = true; g.xp += 50; g.coins += 30; G.save(g);
  celebrate('dance', '🎁', 50, 30, $('chest'), '¡Cofre del día abierto! Hoy fuiste imparable. +50 XP y 30 monedas.');
  G.confetti(60); render();
  const after = G.levelOf(G.state().xp);
  if (after > before) setTimeout(() => levelUp(after, G.tierOf(after) > G.tierOf(before)), 900);
}
function questGo(id) {
  const q = questsToday().find(x => x.id === id); if (!q) return;
  if (q.go === 'capture') return openCapture();
  if (q.go === 'water') { bumpHealth('agua', 1); if (questsToday().find(x => x.id === id)?.done) autoClaim(id); else { G.avatarAct('jump', '💧'); say(`¡Glup! Vas ${healthOf(todayIso()).agua}/${TG().agua} vasos.`, 2500); } return; }
  if (q.go === 'move') { bumpHealth('ejercicio', 15); if (questsToday().find(x => x.id === id)?.done) autoClaim(id); else { G.avatarAct('flex', '💪'); say(`¡Eso! Llevas ${healthOf(todayIso()).ejercicio} minutos.`, 2500); } return; }
  if (q.go === 'sleep') return sleepSheet();
  if (q.go === 'journal') { $('journalCard').scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => $('jText').focus(), 500); return; }
  if (q.go === 'contact') { logContact(q.data); autoClaim(id); return; }
  if (q.go === 'goal') return goalSheet(q.data);
}
function sleepSheet() {
  const tg = TG().sueno;
  openSheet('¿Cuánto dormiste anoche? 😴', `<div class="ex-chips">${[4, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 10].map(v => `<button class="ex-chip" data-act="setSleep" data-v="${v}" style="${v >= tg ? 'border-color:rgba(74,222,128,.4)' : ''}">${v}h</button>`).join('')}</div><div class="hint" style="margin-top:12px">Tu meta: ${tg}h o más.</div>`);
}

/* ---------- tienda: se paga con monedas de la vida real ---------- */
function shopSheet(tab = ui.shopTab || 'casa') {
  ui.shopTab = tab;
  const g = G.state(); const lvl = G.levelOf(g.xp);
  const items = G.CATALOG.filter(i => i.cat === tab);
  openSheet('Tienda 🛒', `
    <div class="shop-top"><span class="shop-wallet">🪙 ${g.coins}</span><span class="hint" style="margin:0">Nivel ${lvl} · ${G.TIERS[G.tierOf(lvl)].name}</span></div>
    <div class="shop-tabs">${[['casa', '🏠 Casa'], ['mascotas', '🐾 Mascotas'], ['avatar', '🧢 Avatar']].map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-act="shopTab" data-t="${k}">${l}</button>`).join('')}</div>
    <div class="shop-grid">${items.map(i => {
      const owned = g.owned.includes(i.id), eq = g.equipped[i.slot] === i.id, locked = !owned && lvl < i.lvl;
      return `<button class="shop-it${locked ? ' locked' : ''}${owned ? ' owned' : ''}${eq ? ' equipped' : ''}" data-act="shopBuy" data-id="${i.id}">
        <span class="e">${i.e}</span><span class="n">${i.n}</span><span class="slot-lbl">${G.SLOTS[i.slot]}</span>
        <span class="p">${eq ? 'EQUIPADO' : owned ? 'TUYO' : locked ? `🔒 NV ${i.lvl}` : i.price ? `🪙${i.price}` : 'GRATIS'}</span></button>`;
    }).join('')}</div>
    <div class="shop-note">Las monedas se ganan cumpliendo misiones de tu vida real: tomar agua, moverte, hablar con tu gente, escribir, avanzar en tus metas. Nada se compra con dinero. Toca algo tuyo para ponerlo o guardarlo.</div>`);
}
function shopBuy(id) {
  const r = G.buy(id);
  if (!r.ok) { toast(r.msg); return; }
  const it = G.itemById(id);
  G.blip('buy'); G.avatarAct('dance', it.e); G.confetti(18);
  say(r.msg.includes('tuyo') ? `¡Nuevo! ${it.e} ${it.n} ya está en tu casa.` : r.msg, 3000);
  render(); shopSheet();
}

/* ---------- controles de la consola ---------- */
const QUIPS = ['¡Hola! 👋 ¿Qué misión cumplimos hoy?', 'Tu vida es el juego. Yo solo llevo el marcador. 😉', '¿Ya tomaste agua? 💧', 'Cada misión cuenta, hasta la más pequeña.', 'Presiona START para ir a la tienda 🛒'];
function padMove(d) {
  const sc = $('screen'); const x = parseFloat(sc.style.getPropertyValue('--x')) || 0;
  if (d === 'left' || d === 'right') {
    const nx = clamp(x + (d === 'left' ? -40 : 40), -110, 110);
    sc.style.setProperty('--x', nx + 'px');
    const m = $('avMover'); m.classList.remove('walk'); void m.offsetWidth; m.classList.add('walk');
  } else G.avatarAct(d === 'up' ? 'jump' : 'sit');
}

/* ---------- agenda y calendario (.ics) ---------- */
function addAgenda(text) {
  if (!text.trim()) return;
  const e = { fecha: todayIso(), ...parseAgenda(text) };
  S.putItem('event', e);
  toast(`📅 Agregado a tu agenda de hoy${e.hora ? ' · ' + e.hora : ''}`); render();
}
function parseICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, '');
  const evs = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const get = k => block.match(new RegExp(`\\n${k}(?:;[^:\\n]*)?:([^\\r\\n]*)`))?.[1]?.trim();
    const dt = get('DTSTART'); const sum = (get('SUMMARY') || 'Evento').replace(/\\,/g, ',').replace(/\\n/g, ' ');
    if (!dt) continue;
    const m = dt.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/); if (!m) continue;
    let d, hora = null;
    if (m[4]) { d = m[7] ? new Date(Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5])) : new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5]); hora = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
    else d = new Date(+m[1], m[2] - 1, +m[3]);
    evs.push({ fecha: isoOf(d), hora, titulo: sum.slice(0, 120), uid: get('UID') || null });
  }
  return evs;
}
const pad2 = n => String(n).padStart(2, '0');
function importICSFile(cb) {
  const inp = $('icsIn');
  inp.onchange = async () => {
    const f = inp.files?.[0]; inp.value = ''; if (!f) return;
    const from = todayIso(); const to = new Date(); to.setDate(to.getDate() + 30); const toIso = isoOf(to);
    const have = new Set(S.itemsOf('event').map(e => e.uid || `${e.fecha}|${e.hora}|${e.titulo}`));
    let n = 0;
    parseICS(await f.text()).filter(e => e.fecha >= from && e.fecha <= toIso).forEach(e => {
      const k = e.uid || `${e.fecha}|${e.hora}|${e.titulo}`; if (have.has(k)) return;
      have.add(k); S.putItem('event', e); n++;
    });
    toast(n ? `📅 ${n} eventos importados de tu calendario` : 'No encontré eventos nuevos en los próximos 30 días');
    render(); cb?.(n);
  };
  inp.click();
}

/* ================= sheets ================= */
let sheetOnClose = null;
function openSheet(title, html, onClose = null) {
  $('sheetTitle').textContent = title; $('sheetBody').innerHTML = html; $('sheetBody').scrollTop = 0;
  $('sheetOv').classList.add('open'); $('sheet').classList.add('open');
  document.body.style.overflow = 'hidden'; sheetOnClose = onClose;
}
function closeSheet() {
  $('sheetOv').classList.remove('open'); $('sheet').classList.remove('open');
  document.body.style.overflow = ''; stopDictation();
  const cb = sheetOnClose; sheetOnClose = null; cb?.();
}

/* ================= captura universal ================= */
const EXAMPLES = ['gasté 25 en Walmart', 'me llegaron 1138 de la CNESST', 'dormí 7 horas y fui al gym 45 min', 'llamé a mamá', 'Tim Hortons 4.50', 'ahorré 100 para el fondo de emergencia', 'hoy me sentí muy enfocado con AI Staff'];
function lifeCtxShort() {
  return { personas: S.itemsOf('person').map(p => p.nombre), metas: S.itemsOf('goal').map(g => g.nombre) };
}
function openCapture(pre = {}) {
  ui.capture = { text: pre.text || '', file: pre.file || null, result: null, source: pre.source || 'app' };
  renderCaptureInput();
  $('sheetOv').classList.add('open'); $('sheet').classList.add('open'); document.body.style.overflow = 'hidden';
  setTimeout(() => $('capText')?.focus(), 350);
}
function renderCaptureInput() {
  const c = ui.capture; const key = !!S.getKey();
  $('sheetTitle').textContent = 'Registrar';
  $('sheetBody').innerHTML = `
    <div class="cap-box">
      <textarea id="capText" rows="3" placeholder="Escribe, dicta o sube un pantallazo… “gasté 25 en Walmart”, “dormí 6h”, “salí con Diana”">${esc(c.text)}</textarea>
      ${c.file ? `<div class="cap-file">${c.file.type.startsWith('image/') ? `<img src="${URL.createObjectURL(c.file)}" alt="">` : '<span style="font-size:24px">📄</span>'}<span>${esc(c.file.name || 'archivo')}</span><button data-act="capClearFile" aria-label="Quitar">✕</button></div>` : ''}
      <div class="cap-tools">
        <button class="icon-btn mic" data-act="dictate" data-target="capText" aria-label="Dictar">🎙️</button>
        <button class="icon-btn" data-act="capCamera" aria-label="Tomar foto">📷</button>
        <button class="icon-btn" data-act="capFile" aria-label="Subir archivo">📎</button>
        <span class="grow"></span>
        <button class="btn-acc sm" data-act="capAnalyze">${key ? '🔮 Analizar' : '⚡ Analizar'}</button>
      </div>
    </div>
    <div class="ex-lbl">Prueba con</div>
    <div class="ex-chips">${EXAMPLES.map(e => `<button class="ex-chip" data-act="capEx">${esc(e)}</button>`).join('')}</div>
    <div class="ex-lbl">También puedes</div>
    <div class="ex-chips"><button class="ex-chip" data-act="capFile">📸 Pantallazo del banco</button><button class="ex-chip" data-act="capFile">🧾 Foto de un recibo</button><button class="ex-chip" data-act="bank">🏦 CSV del banco</button><button class="ex-chip" data-act="capPaste">📧 Pegar alerta del correo</button></div>
    <div class="ai-note">${key ? '🔮 Claude activo — entiende texto, fotos, PDFs y alertas.' : `⚡ Modo rápido sin IA (texto simple). <button data-act="claude">Activar Claude</button> para fotos y lenguaje libre.`}</div>`;
}
async function captureAnalyze() {
  const c = ui.capture; c.text = ($('capText')?.value || '').trim();
  if (!c.text && !c.file) { $('capText')?.focus(); return; }
  if (c.file && /csv/.test(c.file.type + c.file.name)) { const t = await c.file.text(); closeSheet(); return importCSVText(t); }
  if (c.file && !S.getKey()) { toast('Para leer fotos y PDFs activa Claude 🔮'); return keySheet(() => openCapture(c)); }
  $('sheetTitle').textContent = 'Analizando…';
  $('sheetBody').innerHTML = `<div class="loading"><div class="spinner"></div><p>${c.file ? 'Leyendo tu archivo…' : 'Entendiendo tu mensaje…'}</p></div>`;
  try {
    c.result = S.getKey() ? await parseCapture({ text: c.text, file: c.file }, lifeCtxShort()) : localParse(c.text, lifeCtxShort());
  } catch (e) {
    console.warn(e);
    const msg = e.message === 'REFUSAL' ? 'Claude no pudo procesar eso.' : /401|authentication|invalid x-api-key/i.test(e.message) ? 'La API key no es válida.' : 'No pude conectar con Claude.';
    c.result = c.file ? { items: [], respuesta: msg } : { ...localParse(c.text, lifeCtxShort()), respuesta: `${msg} Usé el modo rápido.` };
  }
  renderReview();
}
const KIND = {
  gasto: { lbl: 'Gasto', col: 'var(--red)' }, ingreso: { lbl: 'Ingreso', col: 'var(--green)' }, salud: { lbl: 'Salud', col: 'var(--pink)' },
  diario: { lbl: 'Diario', col: 'var(--acc2)' }, relacion: { lbl: 'Relación', col: 'var(--cyan)' }, meta: { lbl: 'Meta', col: 'var(--amber)' },
};
function itemSummary(it) {
  if (it.kind === 'salud') return [it.sueno_horas != null && `😴 ${it.sueno_horas}h`, it.agua_vasos && `💧 ${it.agua_vasos}`, it.ejercicio_min && `🏋️ ${it.ejercicio_min}min`, it.pasos && `👟 ${it.pasos}`, it.animo && MOODS[it.animo - 1]].filter(Boolean).join(' · ');
  if (it.kind === 'diario') return (it.texto || '').slice(0, 80);
  if (it.kind === 'relacion') return `${it.persona || ''}${it.texto ? ' · ' + it.texto.slice(0, 50) : ''}`;
  if (it.kind === 'meta') return it.meta || '';
  return `${it.categoria}${it.fecha && it.fecha !== todayIso() ? ' · ' + relDay(it.fecha) : ''}`;
}
function renderReview() {
  const r = ui.capture.result;
  $('sheetTitle').textContent = r.items.length ? `¿Esto es correcto? (${r.items.length})` : 'Hmm…';
  $('sheetBody').innerHTML = `${r.respuesta ? `<div class="rev-reply">🔮 ${esc(r.respuesta)}</div>` : ''}
    ${r.items.map((it, i) => {
      const k = KIND[it.kind] || KIND.gasto; const money = it.kind === 'gasto' || it.kind === 'ingreso' || (it.kind === 'meta' && it.monto);
      return `<div class="rev" data-i="${i}" style="animation-delay:${i * 60}ms"><div class="rev-top">
        <div class="rev-ic" style="background:${catCfg(it.categoria).c}22">${esc(it.emoji || catCfg(it.categoria).e)}</div>
        <div class="rev-inf"><div class="rev-k" style="color:${k.col}">${k.lbl}</div><div class="rev-nm">${esc(it.descripcion || k.lbl)}</div><div class="tx-mt">${esc(itemSummary(it))}</div></div>
        ${money ? `<div class="rev-am" style="color:${it.kind === 'ingreso' ? 'var(--green)' : 'var(--text)'}">${it.kind === 'ingreso' ? '+' : it.kind === 'gasto' ? '-' : ''}${fmt(it.monto || 0)}</div>` : ''}
        <button class="rev-x" data-act="revDel" data-i="${i}" aria-label="Quitar">✕</button></div>
        ${it.kind === 'gasto' || it.kind === 'ingreso' ? `<button class="rev-toggle" data-act="revEdit" data-i="${i}">✏️ editar</button><div class="rev-edit" id="revEdit${i}" hidden>
          <input class="inp full" data-f="descripcion" value="${esc(it.descripcion)}" placeholder="Descripción">
          <input class="inp" data-f="monto" type="number" step="0.01" value="${it.monto ?? ''}" inputmode="decimal">
          <select class="sel" data-f="kind"><option value="gasto"${it.kind === 'gasto' ? ' selected' : ''}>Gasto</option><option value="ingreso"${it.kind === 'ingreso' ? ' selected' : ''}>Ingreso</option></select>
          <select class="sel" data-f="categoria">${CATS.map(c => `<option${c === it.categoria ? ' selected' : ''}>${c}</option>`).join('')}</select>
          <input class="inp" data-f="fecha" type="date" value="${esc(it.fecha || todayIso())}"></div>` : ''}
      </div>`;
    }).join('')}
    <div class="stack" style="margin-top:12px">
      ${r.items.length ? `<button class="btn-acc btn-green" data-act="capSave">✓ Guardar ${r.items.length > 1 ? 'todo' : ''}</button>` : ''}
      <button class="btn-ghost" data-act="capBack">← Volver a escribir</button>
    </div>`;
}
function readReviewEdits() {
  document.querySelectorAll('.rev').forEach(el => {
    const it = ui.capture.result.items[+el.dataset.i]; if (!it) return;
    el.querySelectorAll('[data-f]').forEach(inp => {
      const f = inp.dataset.f; let v = inp.value;
      if (f === 'monto') v = parseFloat(v) || 0;
      it[f] = v;
      if (f === 'kind' && v === 'ingreso') it.categoria = 'ingreso';
    });
  });
}
function findByName(list, name, key) {
  const n = (name || '').toLowerCase().trim(); if (!n) return null;
  return list.find(x => x[key].toLowerCase() === n) || list.find(x => x[key].toLowerCase().startsWith(n) || n.startsWith(x[key].toLowerCase())) || list.find(x => x[key].toLowerCase().includes(n) || n.includes(x[key].toLowerCase()));
}
function commitItem(it, original, origen = 'app') {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(it.fecha || '') ? it.fecha : todayIso();
  if (it.kind === 'gasto' || it.kind === 'ingreso') {
    if (!(it.monto > 0)) return 0;
    S.addTx({ fecha, hora: it.hora || (fecha === todayIso() ? nowHM() : ''), descripcion: it.descripcion || 'Movimiento', monto: +it.monto, tipo: it.kind,
      categoria: it.kind === 'ingreso' ? 'ingreso' : (CAT[it.categoria] ? it.categoria : 'otros'), original: `[App] ${original}`.slice(0, 500), origen });
    return 5;
  }
  if (it.kind === 'salud') {
    const h = { ...healthOf(fecha) };
    if (it.sueno_horas != null) h.sueno = it.sueno_horas;
    if (it.agua_vasos) h.agua = (h.agua || 0) + it.agua_vasos;
    if (it.ejercicio_min) h.ejercicio = (h.ejercicio || 0) + it.ejercicio_min;
    if (it.pasos) h.pasos = Math.max(h.pasos || 0, it.pasos);
    if (it.animo) h.animo = it.animo;
    S.putItem('health', h, `health:${fecha}`); return 10;
  }
  if (it.kind === 'diario') { S.putItem('journal', { fecha, hora: nowHM(), texto: it.texto || it.descripcion, animo: it.animo || null }); return 15; }
  if (it.kind === 'relacion') {
    let p = findByName(S.itemsOf('person'), it.persona, 'nombre');
    if (!p && it.persona) p = S.putItem('person', { nombre: it.persona.replace(/^\w/, c => c.toUpperCase()), emoji: '🙂', cada: 7, relacion: 'otro' });
    if (!p) return 0;
    S.putItem('interaction', { personaId: p.id, fecha, tipo: 'contacto', nota: it.texto || '' }); return 10;
  }
  if (it.kind === 'meta') {
    const g = findByName(S.itemsOf('goal'), it.meta || it.descripcion, 'nombre');
    if (!g || !it.monto) return 0;
    S.putItem('goal', { ...g, actual: Math.round((Number(g.actual) + Number(it.monto)) * 100) / 100, lastAporte: todayIso() }, g.id); return 20;
  }
  return 0;
}
function captureSave() {
  readReviewEdits();
  const c = ui.capture;
  const original = c.text || (c.file ? `archivo: ${c.file.name}` : '');
  const xp = c.result.items.reduce((s, it) => s + commitItem(it, original, c.source), 0);
  const pb = $('plumbob'); pb.classList.remove('spin'); void pb.offsetWidth; pb.classList.add('spin');
  $('sheetTitle').textContent = '¡Listo!';
  $('sheetBody').innerHTML = `<div class="success"><div class="success-ring">✓</div><b>¡Guardado!</b><p>${esc(c.result.respuesta || 'Registrado.')}</p>${xp ? `<span class="xp-gain">+${xp} XP</span>` : ''}</div>`;
  render();
  setTimeout(() => { if (ui.capture === c) closeSheet(); autoClaimReady(); }, 1700);
}

/* ================= importación CSV del banco ================= */
function existingKeySet() {
  const s = new Set();
  S.allTx().forEach(t => { s.add(t.key); s.add(`${t.fecha}|${t.descripcion.trim().toLowerCase()}|${t.monto.toFixed(2)}|${t.tipo}`); });
  return s;
}
let importRows = [];
function importCSVText(text) {
  const res = analyzeCSV(text, existingKeySet());
  if (res.error || !res.rows.length) { toast(res.error || 'No encontré movimientos en el CSV'); return; }
  importRows = res.rows;
  const n = importRows.filter(r => !r.skip).length;
  openSheet(`Importar del banco (${n})`, `
    <div class="hint">Revisa antes de importar. Marqué como omitidas las transferencias internas entre tus cuentas (montos iguales), la pensión (ya viene descontada del CNESST) y lo que ya estaba registrado.</div>
    <div>${importRows.map((r, i) => `<label class="imp-row${r.skip ? ' skip' : ''}"><input type="checkbox" data-imp="${i}"${r.skip ? '' : ' checked'}>
      <span>${emojiFor(r.descripcion, r.categoria)}</span><div class="d"><div>${esc(r.descripcion)}</div><div>${esc(r.fecha)} · ${esc(r.categoria)}${r.reason ? ' · ' + esc(r.reason) : ''}</div></div>
      <b style="font-family:var(--mono);color:${r.tipo === 'ingreso' ? 'var(--green)' : 'var(--text)'}">${r.tipo === 'ingreso' ? '+' : '-'}${fmt(r.monto)}</b></label>`).join('')}</div>
    <div class="stack" style="margin-top:14px"><button class="btn-acc btn-green" data-act="doImport">Importar seleccionados</button></div>`);
}
function doImport() {
  let n = 0;
  document.querySelectorAll('[data-imp]').forEach(cb => {
    if (!cb.checked) return; const r = importRows[+cb.dataset.imp];
    S.addTx({ fecha: r.fecha, hora: '', descripcion: r.descripcion, monto: r.monto, tipo: r.tipo, categoria: r.categoria, original: `[Banco] ${r.descripcion}`, origen: 'banco' }); n++;
  });
  closeSheet(); toast(`🏦 ${n} movimientos importados`); render();
}

/* ================= dictado por voz ================= */
let rec = null, recBtn = null;
function startDictation(targetId, btn, onDone) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Tu navegador no soporta dictado. Usa el micrófono del teclado 🎙️'); return false; }
  if (rec) { stopDictation(); return false; }
  const el = $(targetId); if (!el) return false;
  const base = el.value ? el.value.trim() + ' ' : '';
  rec = new SR(); rec.lang = 'es-CO'; rec.interimResults = true; rec.continuous = false;
  recBtn = btn; btn?.classList.add('rec');
  let finalTxt = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    el.value = base + finalTxt + interim;
  };
  rec.onerror = e => { if (e.error === 'not-allowed') toast('Permite el micrófono para dictar'); };
  rec.onend = () => { recBtn?.classList.remove('rec'); rec = null; recBtn = null; if (finalTxt.trim()) onDone?.(); };
  rec.start();
  return true;
}
function stopDictation() { try { rec?.stop(); } catch { /* */ } }

/* ================= chat ================= */
function lifeContext() {
  const now = new Date(); const f = financeFor(now.getFullYear(), now.getMonth());
  const cat = {}; f.paid.filter(t => t.tipo === 'gasto').forEach(t => { cat[t.categoria] = Math.round((cat[t.categoria] || 0) + t.monto); });
  const H = healthInfo(), P = peopleInfo(), M = mindInfo(), pr = progress();
  const last7 = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - i); const h = healthOf(isoOf(d)); return Object.keys(h).length > 1 ? h : null; }).filter(Boolean);
  return {
    hoy: todayIso(), hora: nowHM(), nombre: cfg.name,
    finanzas_mes: { mes: MESES[now.getMonth()], ingresos: +f.ing.toFixed(2), gastos: +f.gast.toFixed(2), balance: +f.bal.toFixed(2),
      presupuesto_variable: f.presup, gastado_variable: +f.gastVar.toFixed(2), uso_presupuesto_pct: f.pct, por_pagar: +f.pendTotal.toFixed(2), proyeccion_fin_de_mes: +f.proj.toFixed(2),
      por_categoria: cat, fijos_pendientes: f.fijosPend.map(x => `${x.descripcion} $${x.monto} (día ${x.dia})`) },
    ultimos_movimientos: S.allTx().filter(t => t.d <= endOfToday()).slice(0, 25).map(t => `${t.fecha} ${t.tipo} ${t.descripcion} $${t.monto} [${t.categoria}]`),
    salud_7_dias: last7, puntaje_salud: H.score,
    relaciones: P.people.map(p => ({ nombre: p.nombre, relacion: p.relacion, dias_sin_hablar: p.days, frecuencia_deseada_dias: p.cada })),
    metas: S.itemsOf('goal').map(g => ({ nombre: g.nombre, actual: g.actual, objetivo: g.objetivo, unidad: g.unidad, limite: g.limite })),
    diario_reciente: M.entries.slice(0, 6).map(e => ({ fecha: e.fecha, animo: e.animo, texto: e.texto.slice(0, 400) })),
    nivel: pr.lvl, racha_dias: pr.streak, monedas: pr.coins, casa: G.TIERS[pr.tier].name,
    prioridades: cfg.priorities || [], metas_diarias: TG(),
    misiones_hoy: questsToday().map(q => `${q.claimed ? '[x]' : '[ ]'} ${q.t}`),
    agenda_hoy: S.itemsOf('event').filter(e => e.fecha === todayIso()).map(e => `${e.hora || ''} ${e.titulo}`),
  };
}
const QUICK = ['¿Cómo voy este mes?', 'Resumen de mi semana', '¿En qué puedo recortar?', 'Plan para ahorrar $300', '¿Cómo va mi salud?', '¿A quién debería escribirle?'];
function openChat(prefill = '') {
  $('chat').classList.add('open'); document.body.style.overflow = 'hidden';
  $('chatQuick').innerHTML = QUICK.map(q => `<button data-act="quick">${q}</button>`).join('');
  if (!S.getKey()) { renderKeyInChat(); }
  else if (!$('cmsgs').children.length || $('cmsgs').querySelector('.key-box')) {
    $('cmsgs').innerHTML = '';
    addMsg('ag', `¡Hola, ${cfg.name}! 👋 Tengo a la mano tus finanzas, salud, relaciones y diario. ¿En qué te ayudo?`);
  }
  if (prefill) $('cinp').value = prefill;
  setTimeout(() => $('cinp').focus(), 350);
}
function closeChat() { $('chat').classList.remove('open'); document.body.style.overflow = ''; stopDictation(); }
const PREVIEW_NOTE = '👀 Esta es una vista previa: aquí la IA, Supabase y Telegram están apagados porque la página no puede conectarse a otros servidores. Registrar funciona en modo rápido (sin IA). En la app instalada todo se conecta.';
function renderKeyInChat() {
  if (window.IO_PREVIEW) { $('cmsgs').innerHTML = `<div class="key-box">${PREVIEW_NOTE}</div>`; return; }
  $('cmsgs').innerHTML = `<div class="key-box">🔮 Para hablar con IO necesito tu API key de Anthropic.<br><small>Se guarda solo mientras esta pestaña esté abierta (nunca en el código ni en la nube). Consíguela en <b>console.anthropic.com</b>.</small>
    <input class="inp" type="password" id="chatKey" placeholder="sk-ant-…" autocomplete="off"><button class="btn-acc" data-act="chatKeySave">Activar IO</button></div>`;
}
function md(s) {
  const lines = esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n');
  let html = '', inList = false;
  for (const l of lines) {
    const li = l.match(/^\s*[-•*]\s+(.*)/) || l.match(/^\s*\d+[.)]\s+(.*)/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    if (l.trim()) html += `<p>${l}</p>`;
  }
  return html + (inList ? '</ul>' : '');
}
function addMsg(role, text) {
  const d = document.createElement('div'); d.className = 'msg ' + role;
  if (role === 'ag') d.innerHTML = md(text); else d.textContent = text;
  $('cmsgs').appendChild(d); $('cmsgs').scrollTop = $('cmsgs').scrollHeight; return d;
}
let chatBusy = false;
async function sendChat(text) {
  text = (text ?? $('cinp').value).trim();
  if (!text || chatBusy) return;
  if (!S.getKey()) return renderKeyInChat();
  $('cinp').value = ''; addMsg('us', text);
  ui.chatHistory.push({ role: 'user', content: text });
  const bubble = addMsg('ag', ''); bubble.classList.add('typing');
  chatBusy = true; let acc = '';
  try {
    const reply = await aiChat(ui.chatHistory, lifeContext(), t => { acc += t; bubble.innerHTML = md(acc); $('cmsgs').scrollTop = $('cmsgs').scrollHeight; });
    bubble.innerHTML = md(reply || acc); ui.chatHistory.push({ role: 'assistant', content: reply || acc });
  } catch (e) {
    console.warn(e); ui.chatHistory.pop();
    bubble.textContent = e.message === 'REFUSAL' ? 'No puedo ayudar con eso, pero pregúntame otra cosa.' : /401|authentication|api-key/i.test(e.message) ? 'La API key no funcionó. Revísala en ⚙️ Ajustes.' : 'Error de conexión. Intenta de nuevo.';
  }
  bubble.classList.remove('typing'); chatBusy = false;
}

/* ================= ajustes y conexiones ================= */
function keySheet(after) {
  if (window.IO_PREVIEW) return openSheet('Vista previa', `<div class="hint" style="font-size:13px">${PREVIEW_NOTE}</div>`);
  openSheet('Activar Claude 🔮', `
    <div class="hint">IO usa Claude para entender lo que escribes, leer pantallazos/recibos y conversar. Tu key se guarda <b>solo en esta pestaña</b> (sessionStorage) y se borra al cerrarla — nunca en el código ni en la nube.</div>
    <div class="field"><label>API key de Anthropic</label><input class="inp" type="password" id="keyInp" placeholder="sk-ant-…" value="" autocomplete="off"></div>
    <div class="hint">Consíguela en <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a>. ⚠️ Si alguna vez la pegaste en un chat o en Make, regénerala.</div>
    <div class="stack"><button class="btn-acc" data-act="keySave">Activar</button>${S.getKey() ? '<button class="btn-ghost btn-danger" data-act="keyClear">Olvidar key</button>' : ''}</div>`);
  keySheet.after = after;
}
function settingsSheet() {
  const st = S.status;
  openSheet('Ajustes', `
    <div class="sec-t">Tú</div>
    <div class="row"><div class="field"><label>Nombre</label><input class="inp" id="stName" value="${esc(cfg.name)}"></div>
    <div class="field" style="max-width:130px"><label>Presupuesto var.</label><input class="inp" id="stPres" type="number" value="${esc(cfg.presupuesto)}"></div></div>
    <button class="btn-ghost" data-act="avatar">🎨 Personalizar avatar</button>

    <div class="sec-t">Datos · Supabase</div>
    <div class="field"><label>Project URL</label><input class="inp" id="stUrl" value="${esc(cfg.supaUrl)}" placeholder="https://xxxx.supabase.co"></div>
    <div class="field"><label>Anon / publishable key</label><input class="inp" id="stKey" value="${esc(cfg.supaKey)}" placeholder="sb_publishable_…" autocomplete="off"></div>
    <div class="hint">Estado: ${st.supabase === 'ok' ? '✅ conectado' : st.supabase === 'error' ? '⚠️ ' + esc(st.error) : 'sin conectar'}${st.items === 'missing' ? ' · falta la tabla <b>io_items</b> (corre <code>supabase/schema.sql</code>)' : ''}. Se guarda en este dispositivo, no en el código.</div>
    <button class="btn-ghost" data-act="testSupa">Probar conexión</button>
    <div class="field" style="margin-top:12px"><label>CSV publicado del Google Sheet (histórico, opcional)</label><input class="inp" id="stSheet" value="${esc(cfg.sheetCsv)}" placeholder="https://docs.google.com/…output=csv"></div>
    <label class="imp-row" style="border:none"><input type="checkbox" id="stDemo"${cfg.demo ? ' checked' : ''}><div class="d"><div>Mostrar datos de ejemplo si no hay nada conectado</div></div></label>

    <div class="sec-t">IA</div>
    <div class="field"><label>Modelo</label><select class="sel" id="stModel">
      ${[['claude-opus-5', 'Claude Opus 5 · el más capaz (recomendado)'], ['claude-sonnet-5', 'Claude Sonnet 5 · rápido y muy capaz'], ['claude-haiku-4-5', 'Claude Haiku 4.5 · el más rápido y barato']].map(([v, l]) => `<option value="${v}"${cfg.model === v ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <button class="btn-ghost" data-act="claude">${S.getKey() ? '🔮 Claude activo · cambiar key' : '🔮 Activar Claude'}</button>

    <div class="sec-t">Juego</div>
    <div class="stack"><button class="btn-ghost" data-act="onboarding">🎮 Rehacer configuración inicial</button>
    <button class="btn-ghost" data-act="sound">${cfg.sound === false ? '🔇 Sonidos apagados · activar' : '🔊 Sonidos activados · apagar'}</button></div>

    <div class="sec-t">Telegram</div>
    <div class="field"><label>Usuario del bot (sin @)</label><input class="inp" id="stBot" value="${esc(cfg.telegramBot)}" placeholder="io_finanzas_bot"></div>

    <div class="stack" style="margin-top:16px"><button class="btn-acc" data-act="saveSettings">Guardar ajustes</button></div>`);
}
function avatarSheet() {
  const pr = progress();
  const opts = {
    skin: ['#f5d0b5', '#e0ac85', '#c4855a', '#a0663f', '#7a4a2a', '#4f2f1b'],
    hair: ['#1a0f0a', '#4a2c17', '#8b5a2b', '#d4a24c', '#b0b0b0', '#7c5cff'],
    hoodie: ['#7c5cff', '#22d3ee', '#4ade80', '#f472b6', '#fbbf24', '#f87171', '#1f2937', '#e5e7eb'],
  };
  const svg = document.querySelector('.av-svg').outerHTML.replace('class="av-svg"', 'class="av-svg-prev"');
  openSheet(`Nivel ${pr.lvl} · ${cfg.name}`, `
    <div class="av-prev ${$('avWrap').className.replace('av-wrap', '')}" data-mood="happy" id="avPrev">${svg}</div>
    <div class="hint" style="text-align:center">${pr.xp} XP · 🪙 ${pr.coins} · 🔥 ${pr.streak} días de racha · faltan ${pr.next - pr.xp} XP para el nivel ${pr.lvl + 1}<br>Ganas XP y monedas cumpliendo las misiones de tu vida real. Gorras, gafas y más en la tienda 🛒.</div>
    <button class="btn-ghost" data-act="shop" style="margin-bottom:14px">🛒 Ir a la tienda</button>
    ${Object.entries({ skin: 'Piel', hair: 'Pelo', hoodie: 'Hoodie' }).map(([k, l]) => `<div class="lbl" style="margin-bottom:8px">${l}</div><div class="sw-row">${opts[k].map(c => `<button class="sw${cfg.avatar[k] === c ? ' on' : ''}" style="background:${c}" data-act="sw" data-k="${k}" data-c="${c}" aria-label="${l} ${c}"></button>`).join('')}</div>`).join('')}`);
}
function telegramSheet() {
  openSheet('Telegram ✈️', `
    <div class="hint">Escríbele a tu bot como a un amigo: “gasté 25 en Walmart”, “dormí 6h”, “llamé a mamá”, o mándale el pantallazo del banco o la foto de un recibo. Todo aparece aquí en vivo.</div>
    ${cfg.telegramBot ? `<a class="btn-acc" style="text-decoration:none;margin-bottom:12px" href="https://t.me/${esc(cfg.telegramBot)}" target="_blank" rel="noopener">Abrir @${esc(cfg.telegramBot)}</a>` : ''}
    <div class="sec-t">Nuevo motor (reemplaza Make.com)</div>
    <div class="hint">La carpeta <code>io/supabase/functions/telegram</code> trae una Edge Function que recibe el webhook de Telegram, entiende texto, fotos y PDFs con Claude y guarda en Supabase — sin Make, sin el bug de <code>{{3.data.content[1].text}}</code>, sin límites de operaciones. Pasos en <code>io/README.md</code>.</div>
    <div class="hint">Comandos del bot: <b>/hoy</b>, <b>/mes</b>, <b>/salud</b>, <b>/ayuda</b>.</div>
    <div class="hint">⚠️ El token anterior del bot quedó expuesto: regénéralo con @BotFather (<code>/revoke</code>) antes de configurar el webhook.</div>`);
}
function emailSheet() {
  openSheet('Alertas del correo 📧', `
    <div class="hint"><b>Rápido:</b> copia el texto de la alerta del banco y pégalo en <b>+ Registrar</b>. Claude saca monto, comercio y fecha.</div>
    <div class="hint"><b>Automático:</b> un Google Apps Script (gratis, en tu Gmail) busca cada 10 minutos las alertas del banco y las manda a la función <code>ingest</code> de Supabase. El script está en <code>io/README.md</code> → “Alertas del correo”.</div>
    <button class="btn-acc" data-act="capPaste">📋 Pegar una alerta ahora</button>`);
}
function installSheet() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ui.installEvt) { ui.installEvt.prompt(); ui.installEvt.userChoice.finally(() => { ui.installEvt = null; renderConn(); }); return; }
  openSheet('Instalar IO 📲', ios
    ? '<div class="hint" style="font-size:13px">En iPhone (Safari): toca <b>Compartir</b> ⬆️ → <b>Agregar a pantalla de inicio</b>. IO se abrirá a pantalla completa como una app.</div>'
    : '<div class="hint" style="font-size:13px">En Android (Chrome): menú ⋮ → <b>Instalar app</b>. En PC: el ícono de instalar en la barra de direcciones.<br><br>Ya instalada, puedes <b>compartir un pantallazo o PDF directo a IO</b> desde la galería o el banco.</div>');
}
function backupSheet() {
  openSheet('Respaldo 💾', `
    <div class="hint">Descarga un archivo con todo lo guardado en este dispositivo (salud, diario, relaciones, metas, fijos y movimientos pendientes de subir). Tu key de Supabase no se incluye.</div>
    <div class="stack"><button class="btn-acc" data-act="exportBackup">⬇️ Exportar respaldo</button><button class="btn-ghost" data-act="importBackup">⬆️ Importar respaldo</button></div>`);
}

/* ================= acciones ================= */
const actions = {
  settings: settingsSheet, closeSheet, closeChat, chat: () => openChat(), capture: () => openCapture(),
  nextNudge: () => { ui.nudgeIdx = (ui.nudgeIdx + 1) % ui.nudges.length; say(ui.nudges[ui.nudgeIdx]); },
  goto: el => $(el.dataset.sec)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
  month: el => { ui.vm += +el.dataset.dir; if (ui.vm < 0) { ui.vm = 11; ui.vy--; } if (ui.vm > 11) { ui.vm = 0; ui.vy++; } render(); },
  day: el => showDay(+el.dataset.day),
  txDetail: el => txDetail(el.dataset.key),
  delTx: async el => {
    const t = S.allTx().find(x => x.key === el.dataset.key); if (!t || !confirm(`¿Eliminar “${t.descripcion}” ${fmt(t.monto)}?`)) return;
    try { await S.deleteTx(t); toast('🗑 Eliminado'); } catch (e) { toast('No se pudo eliminar: ' + e.message); }
    closeSheet(); render();
  },
  askAbout: el => { const t = S.allTx().find(x => x.key === el.dataset.key); closeSheet(); openChat(`Sobre mi movimiento “${t.descripcion}” de ${fmt(t.monto)} el ${t.fecha}: `); },
  fijos: fijosSheet,
  addFijo: () => {
    const d = $('fjDesc').value.trim(), m = parseFloat($('fjMonto').value);
    if (!d || !m) return toast('Completa descripción y monto');
    S.putItem('fijo', { descripcion: d, monto: m, dia: clamp(parseInt($('fjDia').value) || 1, 1, 31), categoria: $('fjCat').value, match: d.toLowerCase().split(' ')[0] });
    fijosSheet(); render();
  },
  delFijo: el => { S.delItem(el.dataset.id); fijosSheet(); render(); },
  payFijo: el => payFijo(el.dataset.id),
  goalForm: () => goalSheet(null), goalSheet: el => goalSheet(el.dataset.id),
  goalAdd: el => {
    const g = S.getItem(el.dataset.id); const v = parseFloat($('gAdd').value); if (!g || !v) return;
    const actual = Math.round((Number(g.actual) + v) * 100) / 100;
    S.putItem('goal', { ...g, actual, lastAporte: todayIso() }, g.id); closeSheet(); render();
    toast(actual >= g.objetivo ? `🏆 ¡Meta cumplida: ${g.nombre}!` : `🎯 +${v} a ${g.nombre}`); autoClaim(`meta:${g.id}`);
  },
  goalSave: el => {
    const nombre = $('gName').value.trim(), objetivo = parseFloat($('gObj').value);
    if (!nombre || !objetivo) return toast('Ponle nombre y objetivo');
    S.putItem('goal', { nombre, objetivo, actual: parseFloat($('gAct').value) || 0, unidad: $('gUnit').value.trim() || '$', emoji: $('gEmoji').value.trim() || '🎯', pilar: $('gPilar').value, limite: $('gLim').value || null, lastAporte: el.dataset.id ? S.getItem(el.dataset.id)?.lastAporte || null : null }, el.dataset.id || null);
    closeSheet(); render();
  },
  goalDel: el => { if (confirm('¿Eliminar meta?')) { S.delItem(el.dataset.id); closeSheet(); render(); } },
  h: el => bumpHealth(el.dataset.k, +el.dataset.v),
  hMood: el => { const iso = todayIso(); S.putItem('health', { ...healthOf(iso), animo: +el.dataset.v }, `health:${iso}`); render(); autoClaim('animo'); },
  qMood: el => { const iso = todayIso(); S.putItem('health', { ...healthOf(iso), animo: +el.dataset.v }, `health:${iso}`); render(); autoClaim('animo'); },
  qGo: el => questGo(el.dataset.id),
  qClaim: el => claimQuest(el.dataset.id),
  qNoSpend: () => { const g = G.state(); g.noSpend[todayIso()] = true; G.save(g); render(); autoClaim('registro'); },
  openChest,
  setSleep: el => { const iso = todayIso(); S.putItem('health', { ...healthOf(iso), sueno: +el.dataset.v }, `health:${iso}`); closeSheet(); render(); if (+el.dataset.v >= TG().sueno) autoClaim('dormir'); else say(`Anotado: ${el.dataset.v}h. Esta noche vamos por ${TG().sueno}h 😴`, 3000); },
  delEvent: el => { S.delItem(el.dataset.id); render(); },
  shop: () => shopSheet(), shopTab: el => shopSheet(el.dataset.t), shopBuy: el => shopBuy(el.dataset.id),
  pad: el => padMove(el.dataset.d),
  padA: () => { G.avatarAct('wave', '👋'); say(QUIPS[Math.floor(Math.random() * QUIPS.length)], 3000); },
  onboarding: () => { closeSheet(); openOnboarding({ onDone: afterOnboarding, importICS: importICSFile }); },
  ics: () => importICSFile(),
  sound: () => { const on = G.toggleSound(); toast(on ? '🔊 Sonidos activados' : '🔇 Sonidos apagados'); settingsSheet(); },
  personForm: () => personSheet(null), personSheet: el => personSheet(el.dataset.id),
  contact: el => logContact(el.dataset.id),
  contactType: el => { logContact(el.dataset.id, el.dataset.t.replace(/^\S+\s/, ''), $('pNote')?.value.trim() || ''); personSheet(el.dataset.id); },
  delInter: el => { const id = el.dataset.id; const pid = S.getItem(id)?.personaId; S.delItem(id); render(); personSheet(pid); },
  personSave: el => {
    const nombre = $('pName').value.trim(); if (!nombre) return toast('Ponle nombre');
    S.putItem('person', { nombre, emoji: $('pEmoji').value.trim() || '🙂', relacion: $('pRel').value, cada: parseInt($('pCada').value) || 7, cumple: $('pBday').value || null }, el.dataset.id || null);
    closeSheet(); render();
  },
  personDel: el => { if (confirm('¿Eliminar persona?')) { S.delItem(el.dataset.id); closeSheet(); render(); } },
  jMood: el => { ui.jMood = ui.jMood === +el.dataset.v ? null : +el.dataset.v; renderJournal(mindInfo()); },
  useJPrompt: () => { const t = $('jText'); t.value = J_PROMPTS[new Date().getDate() % J_PROMPTS.length] + ' '; t.focus(); },
  saveJournal, delJournal: el => { if (confirm('¿Borrar entrada?')) { S.delItem(el.dataset.id); render(); } },
  dictate: el => startDictation(el.dataset.target, el),
  dictateCapture: el => {
    openCapture();
    setTimeout(() => startDictation('capText', el, () => captureAnalyze()), 380);
  },
  capEx: el => { $('capText').value = el.textContent; $('capText').focus(); },
  capCamera: () => { ui.capture.text = $('capText').value; $('camIn').click(); },
  capFile: () => { if (ui.capture) ui.capture.text = $('capText')?.value || ''; else openCapture(); $('fileIn').click(); },
  capClearFile: () => { ui.capture.text = $('capText').value; ui.capture.file = null; renderCaptureInput(); },
  capPaste: async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch { /* sin permiso */ }
    if (!ui.capture || !$('capText')) openCapture({ text: t }); else { $('capText').value = t; }
    if (!t) toast('Pega aquí el texto de la alerta del banco');
    $('capText')?.focus();
  },
  capAnalyze: captureAnalyze,
  capBack: () => renderCaptureInput(),
  capSave: captureSave,
  revDel: el => { readReviewEdits(); ui.capture.result.items.splice(+el.dataset.i, 1); renderReview(); },
  revEdit: el => { const b = $('revEdit' + el.dataset.i); b.hidden = !b.hidden; },
  bank: () => { ui.capture = ui.capture || { text: '', file: null }; $('fileIn').click(); },
  doImport,
  claude: () => keySheet(), keySave: () => {
    const k = $('keyInp').value.trim(); if (!/^sk-ant-/.test(k)) return toast('Esa no parece una key de Anthropic (sk-ant-…)');
    S.setKey(k); toast('🔮 Claude activado'); const a = keySheet.after; keySheet.after = null; closeSheet(); render(); a?.();
  },
  keyClear: () => { S.setKey(''); closeSheet(); render(); toast('Key olvidada'); },
  chatKeySave: () => { const k = $('chatKey').value.trim(); if (!/^sk-ant-/.test(k)) return toast('Key inválida'); S.setKey(k); $('cmsgs').innerHTML = ''; openChat(); renderConn(); },
  quick: el => sendChat(el.textContent),
  testSupa: async () => {
    const prev = { supaUrl: cfg.supaUrl, supaKey: cfg.supaKey };
    saveCfg({ supaUrl: $('stUrl').value.trim(), supaKey: $('stKey').value.trim() });
    try { const r = await S.testSupabase(); toast(r.items ? '✅ Supabase conectado' : '✅ Conectado · falta crear la tabla io_items'); }
    catch (e) { toast('⚠️ ' + e.message, 5000); saveCfg(prev); }
  },
  saveSettings: async () => {
    saveCfg({ name: $('stName').value.trim() || 'tú', presupuesto: parseFloat($('stPres').value) || 501, supaUrl: $('stUrl').value.trim(), supaKey: $('stKey').value.trim(),
      sheetCsv: $('stSheet').value.trim(), demo: $('stDemo').checked, model: $('stModel').value, telegramBot: $('stBot').value.trim().replace(/^@/, '') });
    closeSheet(); toast('Guardado ✓'); await refresh();
  },
  avatar: avatarSheet,
  sw: el => { cfg.avatar[el.dataset.k] = el.dataset.c; saveCfg({ avatar: cfg.avatar }); applyAvatarColors(); avatarSheet(); },
  telegram: telegramSheet, email: emailSheet, install: installSheet, backup: backupSheet,
  exportBackup: () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([S.exportBackup()], { type: 'application/json' }));
    a.download = `io-respaldo-${todayIso()}.json`; a.click();
  },
  importBackup: () => $('backupIn').click(),
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = actions[el.dataset.act]; if (!fn) return;
  e.preventDefault(); fn(el);
});
document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => { ui.chip = c.dataset.chip; renderChip(); }));
$('catSeg').addEventListener('click', e => { const b = e.target.closest('[data-cat]'); if (b) { ui.catMode = b.dataset.cat; renderCats(); } });
$('sheetOv').addEventListener('click', closeSheet);
$('chatForm').addEventListener('submit', e => { e.preventDefault(); sendChat(); });
let searchT;
$('txSearch').addEventListener('input', e => { clearTimeout(searchT); searchT = setTimeout(() => { ui.txQuery = e.target.value; ui.txShown = 30; renderTx(); }, 150); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { if ($('chat').classList.contains('open')) closeChat(); else closeSheet(); }
  if (e.key === 'Enter' && !e.shiftKey && e.target.id === 'capText') { e.preventDefault(); captureAnalyze(); }
});
const onPick = async e => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  if (/csv/.test(f.type) || /\.csv$/i.test(f.name)) { closeSheet(); return importCSVText(await f.text()); }
  if (!ui.capture || !$('sheet').classList.contains('open')) openCapture({ file: f });
  else { ui.capture.file = f; renderCaptureInput(); }
};
$('fileIn').addEventListener('change', onPick);
$('camIn').addEventListener('change', onPick);
$('backupIn').addEventListener('change', async e => {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  try { S.importBackup(await f.text()); toast('Respaldo importado ✓'); closeSheet(); render(); } catch { toast('Archivo de respaldo inválido'); }
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.installEvt = e; });

/* ================= arranque ================= */
async function refresh() {
  try { await S.loadAll(); } catch (e) { console.warn(e); }
  render();
}
async function handleLaunchParams() {
  const q = new URLSearchParams(location.search);
  if (q.has('shared')) {
    try {
      const c = await caches.open('io-share');
      const text = await (await c.match('shared-text'))?.text() || '';
      const fr = await c.match('shared-file');
      let file = null;
      if (fr) { const b = await fr.blob(); file = new File([b], decodeURIComponent(fr.headers.get('x-name') || 'compartido'), { type: b.type }); }
      await c.delete('shared-text'); await c.delete('shared-file');
      if (file && /csv/.test(file.type + file.name)) importCSVText(await file.text());
      else openCapture({ text, file, source: 'app' });
    } catch (e) { console.warn(e); }
  } else if (q.has('add')) openCapture();
  else if (q.has('chat')) openChat();
  if ([...q.keys()].length) history.replaceState(null, '', location.pathname);
}

function afterOnboarding(first) {
  applyAvatarColors(); render();
  if (first) { G.confetti(50); G.avatarAct('dance', '🎮'); say(`¡Bienvenido a tu vida, ${cfg.name}! Te regalé 100 monedas para empezar. Tus misiones de hoy están abajo 👇`, 7000); }
}
$('agendaForm').addEventListener('submit', e => { e.preventDefault(); addAgenda($('agendaIn').value); $('agendaIn').value = ''; });

S.seedFijos();
if (!S.getItem('game:state')) { const g = G.state(); g.xp = legacyXp(); G.save(g); }
applyAvatarColors();
render();
setupInfinite();
refresh().then(() => {
  if (!cfg.onboarded) openOnboarding({ onDone: afterOnboarding, importICS: importICSFile });
  else handleLaunchParams();
});
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 90000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
