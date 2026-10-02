/* IO — cada tipo de piso tiene su propio escenario: fondo, muebles y superficies donde poner cosas.
 * Un escenario dice qué partes del cuarto base esconde (ventana, cortinas…), qué dibuja detrás de los objetos
 * y dónde quedan sus superficies (repisas, mesas, mostradores). Las posiciones son fracciones de la escena:
 * x de 0 (izquierda) a 1 (derecha) y f = altura desde abajo (el piso termina en .18). */

// Superficies del cuarto original: dos repisas a la izquierda y el aparador bajo la ventana.
export const BASE_SURF = {
  table: { x0: .62, x1: .88, f: .27, look: 'sideboard' },
  shelf2: { x0: .29, x1: .49, f: .475, look: 'wood' },
  shelf1: { x0: .29, x1: .49, f: .655, look: 'wood' },
};
const HIDE_WIN = ['win', 'curt', 'sill', 'beams'];

/* fondo de cada escenario (se dibuja detrás de los objetos y del personaje) */
const SETS = {
  cuarto: { base: true },
  sala: {
    hide: ['sill', 'beams'],
    bg: `<div class="rs-fire"><i class="rs-flame"></i><i class="rs-flame f2"></i><i class="rs-flame f3"></i><b class="rs-logs"></b></div>
      <div class="rs-frame rs-sala-art"></div>`,
    surf: { table: { x0: .62, x1: .84, f: .43, look: 'mantel' }, shelf2: { x0: .29, x1: .49, f: .475, look: 'wood' }, shelf1: { x0: .29, x1: .49, f: .655, look: 'wood' } },
  },
  garaje: {
    hide: [...HIDE_WIN, 'poster', 'lampc', 'prug'],
    bg: `<div class="rs-tube"></div><div class="rs-gdoor"><i></i></div><div class="rs-peg"><span>🔧</span><span>🔨</span><span>🪛</span><span>🪚</span><span>📏</span></div><div class="rs-oil"></div><div class="rs-cone">🚧</div>`,
    surf: { table: { x0: .56, x1: .9, f: .27, look: 'bench' }, shelf2: { x0: .27, x1: .47, f: .44, look: 'metal' } },
  },
  garaje2: {
    hide: [...HIDE_WIN, 'poster', 'lampc', 'prug'],
    bg: `<div class="rs-tube"></div><div class="rs-tube t2"></div><div class="rs-gdoor d2a"><i></i></div><div class="rs-gdoor d2b"><i></i></div><div class="rs-oil"></div><div class="rs-oil o2"></div>`,
    surf: { shelf2: { x0: .24, x1: .4, f: .55, look: 'metal' } },
  },
  cocina: {
    hide: ['sill', 'beams', 'poster'],
    bg: `<div class="rs-cab"><i></i><i></i><i></i></div><div class="rs-hang"><span>🍳</span><span>🥄</span><span>🔪</span><span>🧂</span></div><div class="rs-hood"></div>`,
    surf: { table: { x0: .58, x1: .92, f: .31, look: 'counter' }, shelf2: { x0: .29, x1: .49, f: .52, look: 'wood' } },
  },
  gimnasio: {
    hide: [...HIDE_WIN, 'poster', 'prug'],
    bg: `<div class="rs-band"><b>1% MEJOR CADA DÍA</b></div><div class="rs-mirror"><i></i></div><div class="rs-mat"></div>`,
    surf: { table: { x0: .6, x1: .9, f: .25, look: 'rack' } },
  },
  biblioteca: {
    hide: [...HIDE_WIN, 'poster'],
    bg: `<div class="rs-books"><i></i><i></i><i></i><i></i></div><div class="rs-ladder"></div>`,
    surf: { table: { x0: .62, x1: .88, f: .27, look: 'desk' }, shelf2: { x0: .27, x1: .52, f: .43, look: 'bookledge' }, shelf1: { x0: .27, x1: .52, f: .6, look: 'bookledge' } },
  },
  jardin: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'prug'],
    bg: `<div class="rs-glass"><i class="rs-trees"></i></div><div class="rs-vines">${'<span>🌿</span>'.repeat(9)}</div><div class="rs-path"></div><div class="rs-fountain"><i></i></div>`,
    surf: { table: { x0: .6, x1: .9, f: .26, look: 'planter' }, shelf2: { x0: .28, x1: .48, f: .52, look: 'rope' } },
  },
  oficina: {
    hide: ['curt', 'sill', 'beams'],
    bg: `<div class="rs-wb"><svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><polyline points="6,50 22,40 38,44 54,26 70,30 92,8" fill="none" stroke="#2563eb" stroke-width="3"/><circle cx="92" cy="8" r="3" fill="#16a34a"/></svg><i class="note n1"></i><i class="note n2"></i><i class="note n3"></i></div><div class="rs-file"><i></i><i></i><i></i></div>`,
    surf: { table: { x0: .58, x1: .9, f: .28, look: 'desk' }, shelf2: { x0: .29, x1: .49, f: .52, look: 'wood' } },
  },
  juegos: {
    hide: [...HIDE_WIN, 'prug'],
    bg: `<div class="rs-led"></div><div class="rs-neon"><b>GAME ON</b></div><div class="rs-inv"><span>👾</span><span>🕹️</span><span>👾</span></div><div class="rs-checker"></div>`,
    surf: { shelf2: { x0: .29, x1: .49, f: .475, look: 'neon' }, shelf1: { x0: .29, x1: .49, f: .655, look: 'neon' } },
  },
  spa: {
    hide: [...HIDE_WIN, 'poster', 'prug'],
    bg: `<div class="rs-slats"></div><div class="rs-bamboo"><i></i><i></i><i></i></div><div class="rs-steam"><i></i><i></i><i></i></div><div class="rs-stones">🪨</div>`,
    surf: { table: { x0: .6, x1: .9, f: .24, look: 'stone' }, shelf2: { x0: .29, x1: .49, f: .475, look: 'stone' } },
  },
  piscina: {
    hide: ['curt', 'sill', 'poster'],
    bg: `<div class="rs-tiles"></div><div class="rs-poolladder"></div><div class="rs-glare"></div>`,
  },
  terraza: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'ceil', 'lampc', 'prug'],
    bg: `<div class="rs-sky"><i class="rs-moon"></i><i class="rs-skyline"></i></div><div class="rs-lights">${'<i></i>'.repeat(11)}</div><div class="rs-rail"></div>`,
    surf: { table: { x0: .6, x1: .9, f: .27, look: 'bar' } },
  },
  musica: {
    hide: [...HIDE_WIN, 'poster'],
    bg: `<div class="rs-foam f1"></div><div class="rs-foam f2"></div><div class="rs-vinyl v1"></div><div class="rs-vinyl v2"></div><div class="rs-onair">ON AIR</div><div class="rs-spk"></div>`,
    surf: { table: { x0: .6, x1: .9, f: .27, look: 'mixer' }, shelf2: { x0: .29, x1: .49, f: .475, look: 'wood' } },
  },
  cine: {
    hide: [...HIDE_WIN, 'poster', 'prug', 'lampc'],
    bg: `<div class="rs-screen"><i class="rs-film"></i></div><div class="rs-velvet l"></div><div class="rs-velvet r"></div><div class="rs-beam"></div><div class="rs-seats"><i></i><i></i><i></i><i></i><i></i></div>`,
    surf: { table: { x0: .76, x1: .94, f: .27, look: 'snack' } },
  },
  galeria: {
    hide: [...HIDE_WIN, 'poster', 'prug'],
    bg: `<div class="rs-spots"><i></i><i></i><i></i></div><div class="rs-artw a1"></div><div class="rs-artw a2"></div><div class="rs-rope"></div>`,
    surf: { table: { x0: .62, x1: .82, f: .3, look: 'plinth' } },
  },
  observatorio: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'prug'],
    bg: `<div class="rs-dome"><i class="rs-slit"></i></div><div class="rs-chart"></div><div class="rs-orbit"><i></i></div>`,
    surf: { shelf2: { x0: .29, x1: .49, f: .475, look: 'brass' } },
  },
  hangar: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'lampc', 'prug'],
    bg: `<div class="rs-truss"></div><div class="rs-hdoor"><i class="rs-runway"></i></div><div class="rs-hstripe"></div>`,
  },
  helipuerto: { base: true },
  mirador: { base: true },
  puente: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'prug', 'lampc'],
    bg: `<div class="rs-view"><i class="rs-planet"></i><i class="rs-warp"></i></div><div class="rs-cons"><i></i><i></i><i></i><i></i><i></i><i></i></div>`,
    surf: { table: { x0: .6, x1: .9, f: .27, look: 'console' } },
  },
  lobby: {
    hide: [...HIDE_WIN, 'poster', 'wains', 'prug', 'lampc'],
    bg: `<div class="rs-cols"><i></i><i></i><i></i></div><div class="rs-chand"><i></i></div>
      <div class="rs-founders"><b>MURO DE FUNDADORES</b><div class="rs-plates"><i>?</i><i>?</i><i>?</i><i>?</i><i>?</i><i>?</i></div><small>Tu nombre puede estar aquí</small></div>
      <div class="rs-desk"><b translate="no">IO TOWER</b></div><div class="rs-marble"></div><div class="rs-plant l">🪴</div><div class="rs-plant r">🪴</div>`,
  },
};

export function setOf(type) {
  const s = SETS[type];
  if (!s || s.base) return { hide: [], bg: '', surf: BASE_SURF, base: true };
  return { hide: s.hide || [], bg: s.bg || '', surf: s.surf || {}, base: false };
}

/** Muebles de las superficies (repisas, mesas, mostradores), dibujados según su estilo. */
export function furnHTML(surf) {
  return Object.entries(surf).map(([name, s]) => {
    const left = (s.x0 - .045) * 100, width = (s.x1 - s.x0 + .09) * 100;
    const shelf = ['wood', 'metal', 'neon', 'stone', 'rope', 'bookledge', 'brass', 'mantel'].includes(s.look);
    return shelf
      ? `<i class="sf sf-shelf sf-${s.look}" data-s="${name}" style="left:${left}%;width:${width}%;bottom:calc(${s.f * 100}% - 7px)"></i>`
      : `<i class="sf sf-block sf-${s.look}" data-s="${name}" style="left:${left}%;width:${width}%;bottom:18%;height:calc(${(s.f - .18) * 100}% + 1px)"><b></b><b></b><b></b></i>`;
  }).join('');
}
