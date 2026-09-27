/* IO — el personaje: se arma por partes (cuerpo, piel, peinado, barba, ojos, ropa, colores).
 * Los ojos y la boca de cada estado de ánimo se muestran/ocultan por CSS según data-mood. */

export const LOOK_DEFAULT = {
  body: 'm', skin: '#c4855a', hair: '#1a0f0a', hairStyle: 'corto', beard: 'ninguna',
  eye: '#1a0f0a', top: 'hoodie', topColor: '#7c5cff', pants: '#312e81',
};
export const OPTIONS = {
  body: [['m', '♂ Masculino'], ['f', '♀ Femenino'], ['n', '⚧ Neutro']],
  skin: ['#f5d0b5', '#e8b995', '#d49a6a', '#c4855a', '#a0663f', '#7a4a2a', '#5a3620', '#3f2616'],
  hairStyle: [['corto', 'Corto'], ['rapado', 'Rapado'], ['rizado', 'Rizado'], ['largo', 'Largo'], ['moño', 'Moño'], ['cola', 'Cola'], ['afro', 'Afro'], ['calvo', 'Calvo']],
  hair: ['#1a0f0a', '#3b2314', '#6b3f1f', '#a86b32', '#d4a24c', '#e8d19a', '#b0b0b0', '#c2410c', '#7c5cff', '#ec4899'],
  beard: [['ninguna', 'Sin barba'], ['bigote', 'Bigote'], ['corta', 'Barba corta'], ['completa', 'Barba completa']],
  eye: ['#1a0f0a', '#5b3a1e', '#2f6b3a', '#2563eb', '#6b7280'],
  top: [['hoodie', 'Hoodie'], ['camiseta', 'Camiseta'], ['camisa', 'Camisa'], ['vestido', 'Vestido']],
  topColor: ['#7c5cff', '#22d3ee', '#4ade80', '#f472b6', '#fbbf24', '#f87171', '#1f2937', '#e5e7eb', '#0f766e', '#9a3412'],
  pants: ['#312e81', '#1e3a8a', '#1f2937', '#78716c', '#14532d', '#e5e7eb'],
};

/** Normaliza configuraciones viejas ({skin, hair, hoodie}) al formato nuevo. */
export function normLook(a = {}) {
  const l = { ...LOOK_DEFAULT, ...a };
  if (a.hoodie && !a.topColor) l.topColor = a.hoodie;
  return l;
}

function hairBack(s) {
  if (s === 'largo') return '<path class="hair" d="M28 50 Q26 18 60 17 Q94 18 92 50 L95 110 Q88 118 80 106 L81 62 Q60 52 39 62 L40 106 Q32 118 25 110Z"/>';
  if (s === 'afro') return '<circle class="hair" cx="60" cy="46" r="39"/>';
  if (s === 'moño') return '<circle class="hair" cx="60" cy="15" r="11"/><rect x="52" y="22" width="16" height="4" rx="2" fill="rgba(0,0,0,.25)"/>';
  if (s === 'cola') return '<path class="hair" d="M80 34 Q106 44 100 92 Q96 104 90 96 Q96 70 84 52Z"/>';
  return '';
}
function hairFront(s) {
  switch (s) {
    case 'corto': return '<path class="hair" d="M32 48 Q30 25 60 22 Q90 22 88 48 Q82 38 72 36 Q60 32 48 36 Q38 38 32 48Z"/><path class="hair-s" d="M32 48 Q28 52 31 58M88 48 Q92 52 89 58" stroke-width="5" stroke-linecap="round"/>';
    case 'rapado': return '<path class="hair" opacity=".7" d="M32 46 Q31 26 60 24 Q89 26 88 46 Q80 36 60 34 Q40 36 32 46Z"/>';
    case 'rizado': return `<g class="hair">${[[33, 46, 6], [36, 35, 7], [44, 27, 7], [54, 23, 7], [66, 23, 7], [76, 27, 7], [84, 35, 7], [87, 46, 6], [50, 32, 6], [60, 30, 6], [70, 32, 6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
    case 'largo': return '<path class="hair" d="M31 52 Q29 21 60 19 Q91 21 89 52 Q85 34 68 31 Q58 40 42 38 Q34 42 31 52Z"/>';
    case 'moño': case 'cola': return '<path class="hair" d="M32 46 Q31 24 60 22 Q89 24 88 46 Q82 34 60 32 Q38 34 32 46Z"/>';
    case 'afro': return '<path class="hair" d="M31 48 Q33 28 60 26 Q87 28 89 48 Q77 38 60 38 Q43 38 31 48Z"/>';
    default: return '<ellipse cx="50" cy="34" rx="7" ry="3" fill="rgba(255,255,255,.18)"/>';
  }
}
function beard(b) {
  if (b === 'bigote') return '<path class="hair" d="M47 71 Q54 66 60 69 Q66 66 73 71 Q66 74 60 72 Q54 74 47 71Z"/>';
  if (b === 'corta') return '<path class="hair" opacity=".55" d="M33 60 Q35 85 60 89 Q85 85 87 60 Q85 77 73 81 Q60 85 47 81 Q35 77 33 60Z"/>';
  if (b === 'completa') return '<path class="hair" d="M31 56 Q31 92 60 94 Q89 92 89 56 Q87 74 75 77 Q67 69 60 71 Q53 69 45 77 Q33 74 31 56Z"/>';
  return '';
}
function torso(L) {
  const f = L.body === 'f', n = L.body === 'n';
  const s = f ? 4 : n ? 2 : 0; // hombros más angostos
  let body = f
    ? `<path class="top" d="M${32} 98 Q34 88 60 86 Q86 88 ${88} 98 L86 116 Q83 124 90 142 Q60 150 30 142 Q37 124 34 116Z"/>`
    : `<path class="top" d="M${28 + s} 98 Q${30 + s} 88 60 86 Q${90 - s} 88 ${92 - s} 98 L${96 - s} 142 Q60 150 ${24 + s} 142Z"/>`;
  if (L.top === 'vestido') body = `<path class="top" d="M${32} 98 Q34 88 60 86 Q86 88 88 98 L86 114 Q96 134 102 150 Q60 160 18 150 Q24 134 34 114Z"/><path d="M36 114 Q60 120 84 114" stroke="rgba(0,0,0,.2)" stroke-width="3" fill="none"/>`;
  let extra = '';
  if (L.top === 'hoodie') extra = '<path d="M44 90 Q60 101 76 90 Q72 84 60 84 Q48 84 44 90Z" fill="rgba(0,0,0,.2)"/><rect x="46" y="118" width="28" height="15" rx="6" fill="rgba(0,0,0,.16)"/><path d="M54 94v12M66 94v12" stroke="rgba(255,255,255,.55)" stroke-width="1.6" stroke-linecap="round"/>';
  if (L.top === 'camisa') extra = '<path d="M50 86 L60 98 L70 86 L66 84 L60 90 L54 84Z" fill="#f8fafc"/><circle cx="60" cy="106" r="1.6" fill="rgba(0,0,0,.35)"/><circle cx="60" cy="116" r="1.6" fill="rgba(0,0,0,.35)"/><circle cx="60" cy="126" r="1.6" fill="rgba(0,0,0,.35)"/>';
  if (L.top === 'camiseta') extra = '<path d="M50 87 Q60 95 70 87" stroke="rgba(0,0,0,.2)" stroke-width="2.5" fill="none"/>';
  const lx = 28 + s, rx = 92 - s;
  const arms = L.top === 'camiseta' || L.top === 'vestido'
    ? `<path class="top" d="M${lx} 98 Q${lx - 9} 104 ${lx - 11} 114 L${lx + 1} 118 L${lx + 6} 106Z"/><path class="skin" d="M${lx - 9} 112 Q${lx - 13} 126 ${lx - 12} 134 Q${lx - 10} 142 ${lx - 4} 140 Q${lx} 132 ${lx + 2} 118Z"/>
       <path class="top" d="M${rx} 98 Q${rx + 9} 104 ${rx + 11} 114 L${rx - 1} 118 L${rx - 6} 106Z"/><path class="skin" d="M${rx + 9} 112 Q${rx + 13} 126 ${rx + 12} 134 Q${rx + 10} 142 ${rx + 4} 140 Q${rx} 132 ${rx - 2} 118Z"/>`
    : `<path class="top" d="M${lx} 98 Q${lx - 10} 108 ${lx - 12} 128 Q${lx - 14} 138 ${lx - 8} 141 Q${lx - 2} 144 ${lx} 136 L${lx + 6} 115"/><path class="top" d="M${rx} 98 Q${rx + 10} 108 ${rx + 12} 128 Q${rx + 14} 138 ${rx + 8} 141 Q${rx + 2} 144 ${rx} 136 L${rx - 6} 115"/>`;
  const hands = `<circle class="skin" cx="${lx - 10}" cy="143" r="8"/><circle class="skin" cx="${rx + 10}" cy="143" r="8"/>`;
  return body + extra + arms + hands;
}
function legs(L) {
  if (L.top === 'vestido') return '<rect class="skin" x="44" y="146" width="9" height="14" rx="4"/><rect class="skin" x="67" y="146" width="9" height="14" rx="4"/>';
  return '<rect class="pants" x="38" y="138" width="14" height="22" rx="6"/><rect class="pants" x="68" y="138" width="14" height="22" rx="6"/>';
}
const ACC = `
  <g class="acc acc-gafas"><circle cx="49" cy="56" r="10" fill="rgba(10,10,20,.85)" stroke="#111" stroke-width="2"/><circle cx="71" cy="56" r="10" fill="rgba(10,10,20,.85)" stroke="#111" stroke-width="2"/><path d="M59 55h2M39 54l-8-3M81 54l8-3" stroke="#111" stroke-width="2"/><path d="M44 52l4-3M66 52l4-3" stroke="rgba(255,255,255,.5)" stroke-width="2" stroke-linecap="round"/></g>
  <g class="acc acc-lentes"><circle cx="49" cy="56" r="10" fill="rgba(255,255,255,.08)" stroke="#111" stroke-width="2"/><circle cx="71" cy="56" r="10" fill="rgba(255,255,255,.08)" stroke="#111" stroke-width="2"/><path d="M59 55h2M39 54l-8-3M81 54l8-3" stroke="#111" stroke-width="2"/></g>
  <g class="acc acc-gorra"><path d="M30 42 Q31 17 60 16 Q89 17 90 42 Q75 34 60 34 Q45 34 30 42Z" fill="#ef4444"/><path d="M60 34 Q86 32 106 40 Q92 46 62 42Z" fill="#b91c1c"/><circle cx="60" cy="17" r="3" fill="#b91c1c"/></g>
  <g class="acc acc-audifonos"><path d="M29 56 Q27 14 60 14 Q93 14 91 56" stroke="#1f2937" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="21" y="46" width="14" height="22" rx="6" fill="#7c5cff"/><rect x="85" y="46" width="14" height="22" rx="6" fill="#7c5cff"/></g>
  <g class="acc acc-sombrero"><rect x="40" y="0" width="40" height="28" rx="3" fill="#111827"/><rect x="40" y="19" width="40" height="6" fill="#7c5cff"/><rect x="28" y="26" width="64" height="7" rx="3.5" fill="#111827"/></g>
  <g class="acc acc-corona"><path d="M36 30 L40 8 L51 21 L60 3 L69 21 L80 8 L84 30 Z" fill="#fbbf24" stroke="#b45309" stroke-width="1.5" stroke-linejoin="round"/><circle cx="60" cy="22" r="3" fill="#f87171"/><circle cx="46" cy="25" r="2" fill="#22d3ee"/><circle cx="74" cy="25" r="2" fill="#22d3ee"/></g>
  <g class="acc acc-lazo"><path d="M70 22 L84 14 L84 30Z M70 22 L56 14 L56 30Z" fill="#f472b6"/><circle cx="70" cy="22" r="4" fill="#db2777"/></g>
  <g class="acc acc-casco"><path d="M28 50 Q28 12 60 12 Q92 12 92 50Z" fill="#e5e7eb"/><path d="M36 44 Q60 36 84 44 L84 52 Q60 46 36 52Z" fill="#38bdf8" opacity=".8"/></g>`;

export function avatarSVG(look, cls = 'av-svg') {
  const L = normLook(look); const f = L.body === 'f';
  const style = `--skin:${L.skin};--hair:${L.hair};--top:${L.topColor};--pants:${L.pants};--eye:${L.eye}`;
  return `<svg class="${cls}" viewBox="0 0 120 165" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tu personaje" style="${style}">
  <ellipse cx="60" cy="160" rx="30" ry="4" fill="rgba(0,0,0,.35)"/>
  ${hairBack(L.hairStyle)}
  ${legs(L)}
  <ellipse cx="46" cy="160" rx="10" ry="4" fill="#e5e7eb"/><ellipse cx="74" cy="160" rx="10" ry="4" fill="#e5e7eb"/>
  ${torso(L)}
  <rect class="skin" x="52" y="79" width="16" height="12" rx="4"/>
  <ellipse class="skin" cx="60" cy="56" rx="${f ? 28 : 29}" ry="31"/>
  <ellipse class="skin" cx="31" cy="58" rx="5" ry="7"/><ellipse class="skin" cx="89" cy="58" rx="5" ry="7"/>
  ${f ? '<circle cx="31" cy="66" r="2.2" fill="#fbbf24"/><circle cx="89" cy="66" r="2.2" fill="#fbbf24"/>' : ''}
  ${beard(L.beard)}
  ${hairFront(L.hairStyle)}
  <g class="eyes ey-neutral"><g class="blink">
    <ellipse cx="49" cy="55" rx="8" ry="9" fill="#fff"/><ellipse cx="71" cy="55" rx="8" ry="9" fill="#fff"/>
    <ellipse class="pupil" cx="49" cy="57" rx="5" ry="6"/><ellipse class="pupil" cx="71" cy="57" rx="5" ry="6"/>
    <circle cx="51" cy="54" r="2" fill="#fff"/><circle cx="73" cy="54" r="2" fill="#fff"/></g></g>
  <g class="eyes ey-happy"><path d="M41 54 Q49 46 57 54M63 54 Q71 46 79 54" stroke="#1a0f0a" stroke-width="3.5" stroke-linecap="round"/>
    <ellipse cx="38" cy="66" rx="8" ry="4.5" fill="rgba(248,113,113,.28)"/><ellipse cx="82" cy="66" rx="8" ry="4.5" fill="rgba(248,113,113,.28)"/></g>
  <g class="eyes ey-worried"><ellipse cx="49" cy="55" rx="8" ry="9" fill="#fff"/><ellipse cx="71" cy="55" rx="8" ry="9" fill="#fff"/>
    <ellipse class="pupil" cx="49" cy="58" rx="5" ry="6"/><ellipse class="pupil" cx="71" cy="58" rx="5" ry="6"/>
    <path d="M40 42 Q49 48 58 43M62 43 Q71 48 80 42" stroke="#1a0f0a" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="86" cy="48" rx="3.5" ry="5.5" fill="rgba(96,165,250,.6)"/></g>
  <g class="eyes ey-excited"><path d="M49 47 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8zM71 47 l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#fbbf24"/></g>
  <g class="eyes ey-tired"><path d="M42 57 Q49 61 56 57M64 57 Q71 61 78 57" stroke="#1a0f0a" stroke-width="3" stroke-linecap="round"/>
    <path d="M42 63 Q49 65 56 63M64 63 Q71 65 78 63" stroke="rgba(76,29,149,.35)" stroke-width="2" stroke-linecap="round"/></g>
  ${f ? '<path d="M40 48l-3-3M42 46l-2-4M80 48l3-3M78 46l2-4" stroke="#1a0f0a" stroke-width="1.8" stroke-linecap="round"/>' : ''}
  <g class="mouth mo-neutral"><path d="M50 74 Q60 79 70 74" stroke="#1a0f0a" stroke-width="2.5" stroke-linecap="round"/></g>
  <g class="mouth mo-happy"><path d="M46 72 Q60 86 74 72" stroke="#1a0f0a" stroke-width="3" stroke-linecap="round"/></g>
  <g class="mouth mo-worried"><path d="M48 77 Q60 70 72 77" stroke="#1a0f0a" stroke-width="2.5" stroke-linecap="round"/></g>
  <g class="mouth mo-excited"><path d="M46 70 Q60 90 74 70Z" fill="#fff" stroke="#1a0f0a" stroke-width="2.5" stroke-linejoin="round"/></g>
  <g class="mouth mo-tired"><ellipse cx="60" cy="76" rx="4" ry="3" fill="#1a0f0a"/></g>
  ${ACC}
</svg>`;
}

/** Editor de personaje reutilizable (configuración inicial y SELECT). Clicks: data-av="clave" data-v="valor". */
export function editorHTML(look) {
  const L = normLook(look);
  const chips = (k, lbl) => `<div class="lbl av-lbl">${lbl}</div><div class="onb-chips av-chips">${OPTIONS[k].map(([v, l]) => `<button class="onb-chip${L[k] === v ? ' on' : ''}" data-av="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const sw = (k, lbl) => `<div class="lbl av-lbl">${lbl}</div><div class="sw-row">${OPTIONS[k].map(c => `<button class="sw${L[k] === c ? ' on' : ''}" style="background:${c}" data-av="${k}" data-v="${c}" aria-label="${lbl} ${c}"></button>`).join('')}</div>`;
  return `<div class="av-editor">
    ${chips('body', 'Cuerpo')}${sw('skin', 'Piel')}
    ${chips('hairStyle', 'Peinado')}${sw('hair', 'Color de pelo')}
    ${chips('beard', 'Barba')}${sw('eye', 'Ojos')}
    ${chips('top', 'Ropa')}${sw('topColor', 'Color de la ropa')}${sw('pants', 'Pantalón')}
  </div>`;
}
