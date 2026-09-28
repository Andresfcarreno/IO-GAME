/* IO — el personaje. 2D vectorial con sombreado, piernas y brazos articulados (camina de verdad),
 * cara expresiva por estado de ánimo y muchas opciones para que sea característico. */

export const LOOK_DEFAULT = {
  body: 'm', build: 'medio', skin: '#c68a5e', hairStyle: 'corto', hair: '#1c120c', beard: 'ninguna', eye: '#3b2314',
  feature: 'ninguno', top: 'hoodie', topColor: '#7c5cff', bottom: 'pantalon', pants: '#27306b', shoes: '#f1f5f9',
};
export const OPTIONS = {
  body: [['m', '♂ Masculino'], ['f', '♀ Femenino'], ['n', '⚧ Neutro']],
  build: [['delgado', 'Delgado'], ['medio', 'Medio'], ['robusto', 'Robusto']],
  skin: ['#f6d7c3', '#eec1a0', '#e0a77f', '#c68a5e', '#a86d45', '#8a5433', '#6b3e24', '#4a2a18'],
  hairStyle: [['corto', 'Corto'], ['rapado', 'Rapado'], ['ondulado', 'Ondulado'], ['rizado', 'Rizado'], ['largo', 'Largo'], ['moño', 'Moño'], ['cola', 'Cola'], ['trenzas', 'Trenzas'], ['afro', 'Afro'], ['calvo', 'Calvo']],
  hair: ['#1c120c', '#3b2314', '#6b3f1f', '#a86b32', '#d6a85a', '#ecd6a0', '#9ca3af', '#f8fafc', '#b93a1c', '#7c5cff', '#ec4899', '#22d3ee'],
  beard: [['ninguna', 'Sin barba'], ['bigote', 'Bigote'], ['corta', 'Barba corta'], ['completa', 'Barba completa']],
  eye: ['#3b2314', '#1c120c', '#6b4a1e', '#3f7d4e', '#2f6fd6', '#6b7280', '#8b5cf6'],
  feature: [['ninguno', 'Ninguno'], ['pecas', 'Pecas'], ['lunar', 'Lunar'], ['rubor', 'Rubor']],
  top: [['hoodie', 'Hoodie'], ['camiseta', 'Camiseta'], ['camisa', 'Camisa'], ['chaqueta', 'Chaqueta'], ['deportiva', 'Deportiva'], ['vestido', 'Vestido']],
  topColor: ['#7c5cff', '#22d3ee', '#4ade80', '#f472b6', '#fbbf24', '#f87171', '#1f2937', '#f1f5f9', '#0f766e', '#9a3412', '#1d4ed8', '#be185d'],
  bottom: [['pantalon', 'Pantalón'], ['shorts', 'Shorts'], ['falda', 'Falda']],
  pants: ['#27306b', '#1e3a8a', '#111827', '#78716c', '#14532d', '#e7e5e4', '#7c2d12', '#4c1d95'],
  shoes: ['#f1f5f9', '#111827', '#dc2626', '#7c5cff', '#a16207'],
};
export function normLook(a) {
  const l = { ...LOOK_DEFAULT, ...(a || {}) };
  if (a?.hoodie && !a.topColor) l.topColor = a.hoodie;
  if (!OPTIONS.hairStyle.some(([v]) => v === l.hairStyle)) l.hairStyle = 'corto';
  if (!OPTIONS.top.some(([v]) => v === l.top)) l.top = 'hoodie';
  return l;
}

/* ---------- color ---------- */
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const f = v => Math.max(0, Math.min(255, Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt)));
  return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
}
let seq = 0;

/* ---------- partes ---------- */
function hairBack(s, H) {
  if (s === 'largo') return `<path fill="${H}" d="M38 36C36 18 48 12 60 12C72 12 84 18 82 36L86 88C81 95 74 90 74 82L76 54C70 47 50 47 44 54L46 82C46 90 39 95 34 88Z"/>`;
  if (s === 'afro') return `<circle fill="${H}" cx="60" cy="32" r="30"/>`;
  if (s === 'moño') return `<circle fill="${H}" cx="60" cy="10" r="9"/><rect x="53" y="16" width="14" height="3.5" rx="1.7" fill="rgba(0,0,0,.28)"/>`;
  if (s === 'cola') return `<path fill="${H}" d="M74 22C92 28 95 58 86 78C83 66 81 50 72 36Z"/>`;
  if (s === 'trenzas') return [38, 82].map(x => [48, 56, 64, 72, 80, 88].map(y => `<ellipse fill="${H}" cx="${x}" cy="${y}" rx="4.6" ry="4.4"/>`).join('')).join('') + `<circle fill="#f472b6" cx="38" cy="93" r="2.4"/><circle fill="#f472b6" cx="82" cy="93" r="2.4"/>`;
  return '';
}
function hairFront(s, H, HL) {
  const sheen = `<path d="M47 22C52 18 58 17 64 18" stroke="${HL}" stroke-width="2.4" stroke-linecap="round" fill="none" opacity=".7"/>`;
  switch (s) {
    case 'corto': return `<path fill="${H}" d="M39 38C38 22 48 14 60 14C73 14 82 22 81 38C78 30 72 25 64 24C58 27 49 27 44 31C41 33 40 35 39 38Z"/><path fill="${H}" d="M39 36h3.4v9h-3.4zM77.6 36h3.4v9h-3.4z"/>${sheen}`;
    case 'rapado': return `<path fill="${H}" opacity=".82" d="M40 36C40 22 49 16.5 60 16.5C71 16.5 80 22 80 36C75 28.5 68 26.5 60 26.5C52 26.5 45 28.5 40 36Z"/>`;
    case 'ondulado': return `<path fill="${H}" d="M38 42C35 24 46 12 60 12C75 12 86 24 82 42C80 36 78 32 74 30C72 34 68 30 64 30C61 34 56 30 52 31C49 35 45 31 43 34C41 36 39 38 38 42Z"/>${sheen}`;
    case 'rizado': return `<g fill="${H}">${[[40, 36, 5.5], [42, 27, 6], [48, 20, 6.2], [55, 16, 6.2], [63, 15.5, 6.2], [71, 18, 6.2], [77, 24, 6], [80, 33, 5.5], [50, 27, 5], [60, 24, 5.4], [70, 27, 5]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
    case 'largo': return `<path fill="${H}" d="M38 42C37 22 47 13 60 13C73 13 83 22 82 42C78 31 71 25 63 25C58 31 50 33 44 32C41 35 39 38 38 42Z"/>${sheen}`;
    case 'moño': case 'cola': case 'trenzas': return `<path fill="${H}" d="M39 38C38 21 48 14 60 14C72 14 82 21 81 38C76 28 68 24 60 24C52 24 44 28 39 38Z"/>${sheen}`;
    case 'afro': return `<path fill="${H}" d="M39 40C40 26 48 21 60 21C72 21 80 26 81 40C75 32 68 30 60 30C52 30 45 32 39 40Z"/>`;
    default: return `<ellipse cx="52" cy="22" rx="7" ry="3" fill="#fff" opacity=".22"/>`;
  }
}
function beard(b, H) {
  const bigote = `<path fill="${H}" d="M52.5 52.4Q56 50.2 60 51.8Q64 50.2 67.5 52.4Q64 54.4 60 53.2Q56 54.4 52.5 52.4Z"/>`;
  if (b === 'bigote') return bigote;
  if (b === 'corta') return `<path fill="${H}" opacity=".42" d="M41 42C42 57 50 63.5 60 63.5C70 63.5 78 57 79 42C77 54 70 59.5 60 60C50 59.5 43 54 41 42Z"/>` + bigote.replace('fill=', 'opacity=".7" fill=');
  if (b === 'completa') return `<path fill="${H}" d="M40 40C40 61 49 67.5 60 67.5C71 67.5 80 61 80 40C78 53 72 57.5 66.5 57C63.5 55 56.5 55 53.5 57C48 57.5 42 53 40 40Z"/>${bigote}`;
  return '';
}
function torso(L, k, T, TD, TL) {
  const f = L.body === 'f';
  const sh = (f ? 17.5 : 20) * k, wa = (f ? 12.5 : 15) * k, hi = (f ? 19 : 17.5) * k;
  const base = `M${60 - sh} 81C${60 - sh} 72 ${60 - sh + 4} 69 50 68L70 68C${60 + sh - 4} 69 ${60 + sh} 72 ${60 + sh} 81L${60 + wa} 106Q${60 + hi + 1} 118 ${60 + hi} 130L${60 - hi} 130Q${60 - hi - 1} 118 ${60 - wa} 106Z`;
  const dress = `M${60 - sh} 81C${60 - sh} 72 ${60 - sh + 4} 69 50 68L70 68C${60 + sh - 4} 69 ${60 + sh} 72 ${60 + sh} 81L${60 + wa} 106L${60 + hi + 12} 156Q60 162 ${60 - hi - 12} 156L${60 - wa} 106Z`;
  const shadeL = `<path d="${L.top === 'vestido' ? dress : base}" fill="url(#tg${L._id})"/>`;
  let out = `<path d="${L.top === 'vestido' ? dress : base}" fill="${T}"/>` + shadeL;
  if (L.top === 'deportiva') out = `<path d="M${60 - 12 * k} 70L${60 - 9 * k} 70Q60 80 ${60 + 9 * k} 70L${60 + 12 * k} 70L${60 + wa + 1} 106Q${60 + hi + 1} 118 ${60 + hi} 130L${60 - hi} 130Q${60 - hi - 1} 118 ${60 - wa - 1} 106Z" fill="${T}"/><path d="M${60 - 12 * k} 70L${60 - 9 * k} 70Q60 80 ${60 + 9 * k} 70L${60 + 12 * k} 70L${60 + wa + 1} 106Q${60 + hi + 1} 118 ${60 + hi} 130L${60 - hi} 130Q${60 - hi - 1} 118 ${60 - wa - 1} 106Z" fill="url(#tg${L._id})"/>`;
  if (L.top === 'hoodie') out += `<path d="M47 71Q60 83 73 71Q69 64 60 64Q51 64 47 71Z" fill="${TD}"/><path d="M${60 - 11 * k} 108h${22 * k}v13a4 4 0 0 1-4 4h-${14 * k}a4 4 0 0 1-4-4z" fill="${TD}" opacity=".55"/><path d="M56 75v13M64 75v13" stroke="${TL}" stroke-width="1.5" stroke-linecap="round"/>`;
  if (L.top === 'camiseta' || L.top === 'vestido') out += `<path d="M51 69Q60 77 69 69" stroke="${TD}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  if (L.top === 'camisa') out += `<path d="M51 68L60 80L69 68L65.5 66L60 73L54.5 66Z" fill="#f8fafc"/><path d="M60 80v48" stroke="${TD}" stroke-width="1"/>${[88, 99, 110, 121].map(y => `<circle cx="60" cy="${y}" r="1.4" fill="${TD}"/>`).join('')}<rect x="${60 + 5 * k}" y="86" width="${8 * k}" height="7" rx="1.5" fill="none" stroke="${TD}" stroke-width="1"/>`;
  if (L.top === 'chaqueta') out += `<path d="M53 68L60 90L67 68Z" fill="#f1f5f9"/><path d="M53 68L60 90L58 130H62L60 90L67 68" fill="none" stroke="${TD}" stroke-width="1.4"/><path d="M53 68L50 84L57 82ZM67 68L70 84L63 82Z" fill="${TD}"/>`;
  if (L.bottom === 'falda' && L.top !== 'vestido') out += `<path d="M${60 - hi} 124L${60 + hi} 124L${60 + hi + 9} 152Q60 157 ${60 - hi - 9} 152Z" fill="${L.pants}"/><path d="M${60 - hi} 124L${60 + hi} 124L${60 + hi + 9} 152Q60 157 ${60 - hi - 9} 152Z" fill="url(#tg${L._id})" opacity=".6"/>`;
  return { svg: out, sh };
}
function leg(side, L, k, S, SD) {
  const cx = 60 + side * 8.5 * k; const P = L.pants;
  let body;
  const skinLeg = (y, h) => `<rect x="${cx - 5}" y="${y}" width="10" height="${h}" rx="5" fill="${S}"/><rect x="${cx - 5}" y="${y}" width="4" height="${h}" rx="2" fill="${SD}" opacity=".35"/>`;
  if (L.top === 'vestido' || L.bottom === 'falda') body = skinLeg(126, 56);
  else if (L.bottom === 'shorts') body = `${skinLeg(140, 42)}<rect x="${cx - 7}" y="122" width="14" height="26" rx="6" fill="${P}"/>`;
  else body = `<rect x="${cx - 7}" y="122" width="14" height="58" rx="6.5" fill="${P}"/><rect x="${cx - 7}" y="122" width="5" height="58" rx="2.5" fill="#000" opacity=".16"/>`;
  const shoe = `<path d="M${cx - 8} 188Q${cx - 8} 178 ${cx} 178Q${cx + 9} 178 ${cx + 10} 186L${cx + 10} 189L${cx - 8} 189Z" fill="${L.shoes}"/><rect x="${cx - 8}" y="187" width="18" height="2.6" rx="1.3" fill="#000" opacity=".3"/>`;
  return `<g class="leg ${side < 0 ? 'leg-l' : 'leg-r'}">${body}${shoe}</g>`;
}
function arm(side, L, sh, S, SD, T, TD) {
  const px = 60 + side * (sh - 3.5);
  const short = ['camiseta', 'vestido'].includes(L.top), bare = L.top === 'deportiva';
  let a = '';
  if (bare) a = `<rect x="${px - 4.8}" y="72" width="9.6" height="46" rx="4.8" fill="${S}"/><rect x="${px - 4.8}" y="72" width="3.4" height="46" rx="1.7" fill="${SD}" opacity=".35"/>`;
  else if (short) a = `<rect x="${px - 4.6}" y="82" width="9.2" height="36" rx="4.6" fill="${S}"/><rect x="${px - 6}" y="70" width="12" height="18" rx="5.5" fill="${T}"/><rect x="${px - 6}" y="70" width="4" height="18" rx="2" fill="${TD}" opacity=".45"/>`;
  else a = `<rect x="${px - 6}" y="70" width="12" height="47" rx="6" fill="${T}"/><rect x="${px - 6}" y="70" width="4.2" height="47" rx="2" fill="${TD}" opacity=".45"/><rect x="${px - 5.6}" y="112" width="11.2" height="4" rx="2" fill="${TD}"/>`;
  a += `<circle cx="${px}" cy="121" r="5.6" fill="${S}"/>`;
  return `<g class="arm ${side < 0 ? 'arm-l' : 'arm-r'}"><g transform="rotate(${-side * 6} ${px} 74)">${a}</g></g>`;
}
function face(L, S, SD, H) {
  const f = L.body === 'f'; const E = L.eye; const lip = f ? '#b4535b' : '#6b2b2b';
  const brow = (x1, y1, cx, cy, x2, y2) => `<path d="M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}" stroke="${shade(H, -0.1)}" stroke-width="${f ? 1.8 : 2.4}" stroke-linecap="round" fill="none"/>`;
  const eye = x => `<ellipse cx="${x}" cy="42" rx="4.7" ry="4.3" fill="#fff"/><circle cx="${x}" cy="42.4" r="3.1" fill="${E}"/><circle cx="${x}" cy="42.6" r="1.55" fill="#0b0610"/><circle cx="${x + 1.1}" cy="41.2" r=".95" fill="#fff"/><path d="M${x - 4.9} 41.2Q${x} 36.8 ${x + 4.9} 41.2" stroke="#2a1616" stroke-width="1.3" fill="none" stroke-linecap="round"/>${f ? `<path d="M${x + (x < 60 ? -4.8 : 4.8)} 40.6l${x < 60 ? -2 : 2}-1.8" stroke="#2a1616" stroke-width="1.2" stroke-linecap="round"/>` : ''}`;
  const nose = `<path d="M60 43.5Q58.2 48.8 59 50.4Q60.2 51.4 62 50.5" stroke="${shade(S, -0.28)}" stroke-width="1.35" fill="none" stroke-linecap="round"/>`;
  const cheeks = `<ellipse cx="48" cy="51" rx="4.6" ry="2.6" fill="#f87171" opacity=".24"/><ellipse cx="72" cy="51" rx="4.6" ry="2.6" fill="#f87171" opacity=".24"/>`;
  let feat = '';
  if (L.feature === 'pecas') feat = [[49, 48], [52, 50], [47, 51], [71, 48], [68, 50], [73, 51], [57, 47.5], [63, 47.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r=".75" fill="${shade(S, -0.35)}"/>`).join('');
  if (L.feature === 'lunar') feat = `<circle cx="67" cy="54.5" r="1.1" fill="#3b1d12"/>`;
  if (L.feature === 'rubor') feat = cheeks;
  return `${feat}
  <g class="eyes ey-neutral"><g class="blink">${eye(52)}${eye(68)}</g>${brow(47, 35.5, 52, 33, 57, 34.6)}${brow(63, 34.6, 68, 33, 73, 35.5)}</g>
  <g class="eyes ey-happy"><path d="M47.5 43Q52 38.4 56.5 43M63.5 43Q68 38.4 72.5 43" stroke="#2a1616" stroke-width="2.1" fill="none" stroke-linecap="round"/>${brow(47, 34.5, 52, 31.5, 57, 33.5)}${brow(63, 33.5, 68, 31.5, 73, 34.5)}${cheeks}</g>
  <g class="eyes ey-worried">${eye(52)}${eye(68)}${brow(47, 34, 52, 35.5, 57, 32.5)}${brow(63, 32.5, 68, 35.5, 73, 34)}<ellipse cx="77" cy="38" rx="1.8" ry="3" fill="#7dd3fc" opacity=".8"/></g>
  <g class="eyes ey-excited"><path d="M52 37.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5zM68 37.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6-3.2-1.7-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" fill="#fbbf24"/>${brow(47, 33.5, 52, 30.5, 57, 32.5)}${brow(63, 32.5, 68, 30.5, 73, 33.5)}</g>
  <g class="eyes ey-tired"><path d="M47.4 42.5Q52 45.5 56.6 42.5M63.4 42.5Q68 45.5 72.6 42.5" stroke="#2a1616" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M47.8 46.5Q52 48 56.2 46.5M63.8 46.5Q68 48 72.2 46.5" stroke="#6d28d9" stroke-width="1.1" opacity=".35" fill="none"/>${brow(47, 36, 52, 35, 57, 36)}${brow(63, 36, 68, 35, 73, 36)}</g>
  ${nose}
  ${beard(L.beard, H)}
  <g class="mouth mo-neutral"><path d="M54.5 55Q60 58.4 65.5 55" stroke="${lip}" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>
  <g class="mouth mo-happy"><path d="M53 54Q60 62 67 54Z" fill="#6b1f28"/><path d="M54.2 54.6Q60 56.4 65.8 54.6L65 55.8Q60 57 55 55.8Z" fill="#fff"/></g>
  <g class="mouth mo-worried"><path d="M55 57.8Q60 54.2 65 57.8" stroke="${lip}" stroke-width="1.7" fill="none" stroke-linecap="round"/></g>
  <g class="mouth mo-excited"><path d="M52.5 53Q60 64.5 67.5 53Z" fill="#6b1f28"/><ellipse cx="60" cy="59.6" rx="3.6" ry="2" fill="#f87171"/></g>
  <g class="mouth mo-tired"><ellipse cx="60" cy="56.5" rx="2.6" ry="2" fill="#6b1f28"/></g>`;
}
const ACC = `
 <g class="acc acc-lentes"><circle cx="52" cy="42" r="5.9" fill="rgba(255,255,255,.1)" stroke="#1f1a2e" stroke-width="1.6"/><circle cx="68" cy="42" r="5.9" fill="rgba(255,255,255,.1)" stroke="#1f1a2e" stroke-width="1.6"/><path d="M57.9 41.5h4.2M46.1 41l-5.6-1.6M73.9 41l5.6-1.6" stroke="#1f1a2e" stroke-width="1.5"/></g>
 <g class="acc acc-gafas"><path d="M45 38.5h14l-1.2 6.6q-1 2.6-5.8 2.6t-6.2-2.6zM61 38.5h14l-.8 6.6q-1.4 2.6-6.2 2.6t-5.8-2.6z" fill="#111827"/><path d="M59 40h2M45 39l-5-1M75 39l5-1" stroke="#111827" stroke-width="1.8"/><path d="M47.5 40.6l3.2 2.6M63.5 40.6l3.2 2.6" stroke="#fff" stroke-width="1.1" opacity=".55" stroke-linecap="round"/></g>
 <g class="acc acc-gorra"><path d="M38 32C38 16 50 10.5 60 10.5C71 10.5 82 16 82 32C72 26.5 48 26.5 38 32Z" fill="#dc2626"/><path d="M60 28.5C76 27 92 30 101 35C91 38.5 72 35 60 32.5Z" fill="#991b1b"/><circle cx="60" cy="11.5" r="2.2" fill="#991b1b"/></g>
 <g class="acc acc-gorro"><path d="M38 33C37 14 50 7.5 60 7.5C71 7.5 83 14 82 33Z" fill="#0ea5e9"/><rect x="36.5" y="27.5" width="47" height="7.5" rx="3.7" fill="#0369a1"/><circle cx="60" cy="6.5" r="5" fill="#f8fafc"/></g>
 <g class="acc acc-lazo"><path d="M66 20L78 13L78 27ZM66 20L54 13L54 27Z" fill="#f472b6"/><circle cx="66" cy="20" r="3.4" fill="#db2777"/></g>
 <g class="acc acc-audifonos"><path d="M38.5 44C36 11 84 11 81.5 44" stroke="#1f2937" stroke-width="4.4" fill="none" stroke-linecap="round"/><rect x="32.5" y="36" width="9" height="15" rx="4.5" fill="#7c5cff"/><rect x="78.5" y="36" width="9" height="15" rx="4.5" fill="#7c5cff"/></g>
 <g class="acc acc-casco"><path d="M36.5 41C36.5 11 83.5 11 83.5 41Z" fill="#f1f5f9"/><path d="M42 35Q60 28 78 35L78 42Q60 36 42 42Z" fill="#38bdf8" opacity=".85"/><path d="M60 12v9" stroke="#dc2626" stroke-width="3"/></g>
 <g class="acc acc-sombrero"><rect x="44" y="-1" width="32" height="24" rx="2.5" fill="#111827"/><rect x="44" y="15" width="32" height="5" fill="#7c5cff"/><rect x="33" y="21" width="54" height="5.5" rx="2.7" fill="#111827"/></g>
 <g class="acc acc-corona"><path d="M41 25L44 6L52.5 16L60 2L67.5 16L76 6L79 25Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.3" stroke-linejoin="round"/><circle cx="60" cy="18" r="2.6" fill="#ef4444"/><circle cx="48" cy="20.5" r="1.7" fill="#22d3ee"/><circle cx="72" cy="20.5" r="1.7" fill="#22d3ee"/></g>`;

export function avatarSVG(look, cls = 'av', vb = '0 0 120 200') {
  const L = { ...normLook(look), _id: ++seq };
  const k = { delgado: .88, medio: 1, robusto: 1.16 }[L.build] || 1;
  const S = L.skin, SD = shade(S, -0.22), SL = shade(S, 0.14);
  const H = L.hair, HL = shade(H, 0.35);
  const T = L.topColor, TD = shade(T, -0.28), TL = shade(T, 0.5);
  const f = L.body === 'f';
  const tor = torso(L, k, T, TD, TL);
  return `<svg class="${cls}" viewBox="${vb}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tu personaje">
  <defs>
    <radialGradient id="sg${L._id}" cx=".42" cy=".36" r=".75"><stop offset="0" stop-color="${SL}"/><stop offset=".62" stop-color="${S}"/><stop offset="1" stop-color="${SD}"/></radialGradient>
    <linearGradient id="tg${L._id}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>
  </defs>
  <ellipse class="av-shadow" cx="60" cy="191" rx="${26 * k}" ry="4.5" fill="rgba(0,0,0,.35)"/>
  <g class="av-body">
    ${hairBack(L.hairStyle, H)}
    ${leg(-1, L, k, S, SD)}${leg(1, L, k, S, SD)}
    ${tor.svg}
    ${arm(-1, L, tor.sh, S, SD, T, TD)}${arm(1, L, tor.sh, S, SD, T, TD)}
    <rect x="54" y="56" width="12" height="15" rx="4" fill="${S}"/><path d="M54 62Q60 67 66 62L66 58L54 58Z" fill="${SD}" opacity=".5"/>
    <g class="av-head">
      <ellipse cx="40" cy="43" rx="3.8" ry="5.8" fill="${S}"/><ellipse cx="80" cy="43" rx="3.8" ry="5.8" fill="${S}"/>
      <ellipse cx="40.5" cy="43" rx="1.8" ry="3.2" fill="${SD}" opacity=".6"/><ellipse cx="79.5" cy="43" rx="1.8" ry="3.2" fill="${SD}" opacity=".6"/>
      <ellipse cx="60" cy="40" rx="${f ? 19.5 : 20.5}" ry="23.5" fill="url(#sg${L._id})"/>
      ${f ? '<circle cx="40" cy="50.5" r="1.8" fill="#fbbf24"/><circle cx="80" cy="50.5" r="1.8" fill="#fbbf24"/>' : ''}
      ${face(L, S, SD, H)}
      ${hairFront(L.hairStyle, H, HL)}
      ${ACC}
    </g>
  </g>
</svg>`;
}

/** Editor reutilizable: clicks con data-av="clave" data-v="valor". */
export function editorHTML(look, tab = 'cuerpo') {
  const L = normLook(look);
  const chips = (k, lbl) => `<div class="av-lbl">${lbl}</div><div class="chips">${OPTIONS[k].map(([v, l]) => `<button class="chip-o${L[k] === v ? ' on' : ''}" data-av="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const sw = (k, lbl) => `<div class="av-lbl">${lbl}</div><div class="sw-row">${OPTIONS[k].map(c => `<button class="sw${L[k] === c ? ' on' : ''}" style="background:${c}" data-av="${k}" data-v="${c}" aria-label="${lbl}"></button>`).join('')}</div>`;
  const tabs = [['cuerpo', 'Cuerpo'], ['cara', 'Cara'], ['pelo', 'Pelo'], ['ropa', 'Ropa']];
  const panes = {
    cuerpo: chips('body', 'Cuerpo') + chips('build', 'Complexión') + sw('skin', 'Piel'),
    cara: sw('eye', 'Ojos') + chips('feature', 'Rasgo') + chips('beard', 'Barba'),
    pelo: chips('hairStyle', 'Peinado') + sw('hair', 'Color'),
    ropa: chips('top', 'Arriba') + sw('topColor', 'Color') + chips('bottom', 'Abajo') + sw('pants', 'Color') + sw('shoes', 'Zapatos'),
  };
  return `<div class="av-tabs">${tabs.map(([k, l]) => `<button class="${k === tab ? 'on' : ''}" data-avtab="${k}">${l}</button>`).join('')}</div><div class="av-pane">${panes[tab]}</div>`;
}
