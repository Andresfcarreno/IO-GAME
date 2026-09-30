/* IO — idiomas (español / inglés).
 * El juego se escribe en español. En inglés, este módulo traduce el texto que aparece en pantalla usando
 * un diccionario (i18n-en.js): frases exactas, frases con números (# = cualquier número) y frases con
 * partes variables ({} = cualquier texto, por ejemplo un nombre). Lo que no está en el diccionario se
 * queda en español, nunca se rompe nada.
 * Idioma: 1) el que elegiste (se guarda en io.lang), 2) ?lang=en|es, 3) el idioma del celular. */
const K = 'io.lang';
const qs = (() => { try { return new URLSearchParams(location.search).get('lang'); } catch { return null; } })();
const saved = (() => { try { return localStorage.getItem(K); } catch { return null; } })();
const device = (() => { try { return (navigator.languages?.[0] || navigator.language || 'es').toLowerCase(); } catch { return 'es'; } })();
export const lang = ['es', 'en'].includes(qs) ? qs : ['es', 'en'].includes(saved) ? saved : device.startsWith('es') ? 'es' : 'en';
if (qs && ['es', 'en'].includes(qs)) try { localStorage.setItem(K, qs); } catch { /* */ }
export const isEn = lang === 'en';
export const locale = isEn ? 'en-US' : 'es-CO';

/** Cambia el idioma y recarga para que todo se dibuje de nuevo. */
export function setLang(l) {
  try { localStorage.setItem(K, l); } catch { /* */ }
  const u = new URL(location.href); u.searchParams.delete('lang'); location.replace(u.toString());
}

let exact = new Map(), upper = new Map(), pats = [];
const cache = new Map();
const norm = s => s.replace(/\s+/g, ' ').trim();
const esc = s => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
const wrap = (v, r) => v.match(/^\s*/)[0] + r + v.match(/\s*$/)[0];
// Un {} es un número cuando va pegado a una unidad (20 min, 3 días, +5 XP…) o después de "nivel", "piso", "#"…
const NUM_AFTER = /^(\s?(min|minutos?|XP|días?|bits|veces|pasos|reps|coronas?|hábitos?|escudos?|largos|palabras|líneas|frases|respiraciones|posturas|notas|trazos|rincones|ml|páginas?|semanas?|horas?|jugador(es)?|vehículos?|registros|bocados)\b|%|◆|–|\/|ª)/;
const NUM_BEFORE = /(Nivel|nivel|NIVEL|Piso|piso|PISO|pisos|NV|LV|#|\+|◆|−|–|\/) ?$/;
const NUM = '([\\d][\\d.,:/]*)', ANY = '(.*?)';
/** Carga un diccionario { 'texto en español': 'english text' }.
 * En la frase en español, {} es una parte variable (un número, un nombre…). En la traducción, {} usa las
 * partes en el mismo orden y {1}, {2}… las usa en el orden que necesite el inglés. */
export function addDict(dict) {
  for (const [es, en] of Object.entries(dict)) {
    const k = norm(es).replace(/(\{\})+/g, '{}');
    if (!k || (k === en && !k.includes('{}'))) continue;
    if (k.includes('{}')) {
      const parts = k.split('{}');
      if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(parts.join('')) && k !== en) continue; // sin letras: solo los separadores (que se traducen por pedazos)
      let re = '^' + esc(parts[0]);
      for (let i = 1; i < parts.length; i++) re += (NUM_AFTER.test(parts[i]) || NUM_BEFORE.test(parts[i - 1]) ? NUM : ANY) + esc(parts[i]);
      pats.push([new RegExp(re + '$'), en]);
    } else {
      exact.set(k, en);
      if (/[a-záéíóúñ]/.test(k)) upper.set(k.toUpperCase(), en.toUpperCase());
    }
  }
  cache.clear();
}
function sub(v) { const k = norm(v); const r = k ? look(k) : null; return r == null ? v : wrap(v, r); }
function fill(en, vals) { let i = 0; return en.replace(/\{(\d*)\}/g, (_, d) => (d ? vals[+d - 1] : vals[i++]) ?? ''); }
/** Traduce una frase (sin espacios de borde). Devuelve null si no hay traducción. */
function look(k) {
  if (cache.has(k)) return cache.get(k);
  cache.set(k, null); // evita ciclos
  let r = exact.get(k) ?? upper.get(k) ?? null;
  if (r == null) {
    // De todas las frases con partes variables que encajan, la que deja menos texto variable.
    // Si la mejor no cambia nada (sus partes no tienen traducción), se prueba la siguiente.
    const hits = [];
    for (const [re, en] of pats) { const m = k.match(re); if (m) hits.push([m.slice(1), en, m.slice(1).join('').length]); }
    hits.sort((a, b) => a[2] - b[2]);
    for (const [vals, en] of hits) { const x = fill(en, vals.map(sub)); if (x !== k) { r = x; break; } }
  }
  if (r == null) {
    // Emojis, números o signos al principio o al final: se traduce lo de adentro.
    const m = k.match(/^([^\p{L}¿¡]*?)([¿¡\p{L}][\s\S]*?)([\s\d.,:%◆+×\-−–/()!?…·✓👑🔥⭐💪🎁📻🛡️]*)$/u);
    if (m && (m[1] || m[3])) { const inner = look(m[2]); if (inner != null) r = m[1] + inner + m[3]; }
  }
  cache.set(k, r); return r;
}
/** Traduce un texto para código que no dibuja en la página (lienzos, notificaciones, calendario). */
export function t(s) {
  if (!isEn || s == null) return s;
  const str = String(s); const k = norm(str); if (!k) return str;
  const r = look(k); return r == null ? str : wrap(str, r);
}

/* ---------- traducción de la pantalla ---------- */
const done = new WeakMap(); // nodo → texto que ya pusimos (para no traducir dos veces)
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'data-tip'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'svg', 'CANVAS']); // su texto interno no se traduce
function textNode(n) {
  const v = n.data; if (done.get(n) === v || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(v)) return;
  const p = n.parentNode; if (p && (SKIP.has(p.nodeName) || p.closest?.('[translate="no"]'))) return;
  const k = norm(v); const r = k && look(k);
  if (r != null) { const nv = wrap(v, r); done.set(n, nv); n.data = nv; }
  else done.set(n, v);
}
function element(el) {
  if (el.nodeName === 'SCRIPT' || el.nodeName === 'STYLE' || el.closest?.('[translate="no"]')) return;
  for (const a of ATTRS) {
    const v = el.getAttribute?.(a); if (!v) continue;
    const mine = el.__io18 || (el.__io18 = {}); if (mine[a] === v) continue;
    const r = look(norm(v)); mine[a] = r ?? v; if (r != null) el.setAttribute(a, r);
  }
  if (el.nodeName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) { const r = look(norm(el.value)); if (r != null) el.value = r; }
}
export function translateTree(root) {
  if (!isEn || !root) return;
  if (root.nodeType === 3) return textNode(root);
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  if (root.nodeType === 1) { element(root); if (SKIP.has(root.nodeName)) return; }
  const w = document.createTreeWalker(root, 5, { acceptNode: n => n.nodeType === 1 && SKIP.has(n.nodeName) ? (element(n), 2) : 1 });
  let n; while ((n = w.nextNode())) n.nodeType === 3 ? textNode(n) : element(n);
}
/** Empieza a traducir todo lo que aparezca en la página (en español no hace nada). */
export function start(root = document.body) {
  document.documentElement.lang = lang;
  if (!isEn) return;
  if (document.title) document.title = t(document.title);
  translateTree(root);
  new MutationObserver(ms => {
    for (const m of ms) {
      if (m.type === 'characterData') textNode(m.target);
      else if (m.type === 'attributes') element(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
