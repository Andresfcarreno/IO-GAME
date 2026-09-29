/* IO — tarjeta para historias (1080×1920): tu personaje, tu edificio y tu racha.
 * Se comparte con el menú del celular o se descarga. Publicidad gratis y honesta. */
import { cfg } from './store.js';
import * as W from './world.js';
import * as H from './habits.js';
import { avatarSVG } from './avatar.js';

/** SVG del personaje listo para pintarse fuera de la página (con sus estilos adentro). */
function avatarImage(look, wear) {
  const acc = ['head', 'face'].map(s => wear?.[s]).filter(Boolean).map(w => `.acc-${w}{display:block}`).join('');
  const css = `<style>.eyes,.mouth,.acc{display:none}.ey-happy,.mo-happy{display:block}${acc}</style>`;
  const svg = avatarSVG(look, 'av', '0 0 120 200').replace(/<svg([^>]*)>/, `<svg$1 width="480" height="800">${css}`);
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); });
}
function round(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
const EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

export async function storyCanvas() {
  const g = W.game(); const lvl = W.level(g); const f = W.floorInfo(lvl); const w = W.worldOf(lvl);
  const streak = H.dayStreak(); const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const x = c.getContext('2d');
  // fondo
  const bg = x.createLinearGradient(0, 0, 0, 1920); bg.addColorStop(0, '#2c2166'); bg.addColorStop(.55, '#1d1650'); bg.addColorStop(1, '#07060f'); x.fillStyle = bg; x.fillRect(0, 0, 1080, 1920);
  x.globalAlpha = .12; x.fillStyle = '#a78bfa'; x.font = '700 34px "Space Mono", monospace';
  for (let i = 0; i < 26; i++) for (let j = 0; j < 44; j++) if ((i * 7 + j * 13) % 5 === 0) x.fillText((i + j) % 2 ? '1' : '0', i * 44, j * 46);
  x.globalAlpha = 1;
  // logo
  const lg = x.createLinearGradient(380, 0, 700, 0); lg.addColorStop(0, '#a78bfa'); lg.addColorStop(.5, '#22d3ee'); lg.addColorStop(1, '#4ade80');
  x.fillStyle = lg; x.font = '700 150px "Space Grotesk", system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('IO', 540, 220);
  x.fillStyle = '#c4b5fd'; x.font = '600 36px "Space Grotesk", system-ui, sans-serif'; x.fillText('el código de tu vida', 540, 280);
  // edificio a la derecha
  const floors = Math.min(12, lvl + 2); const bw = 360, fh = 62, bx = 620, by = 1320 - floors * fh;
  x.fillStyle = '#231d52'; round(x, bx - 14, by - 40, bw + 28, floors * fh + 60, 18); x.fill();
  x.fillStyle = '#fbbf24'; x.fillRect(bx - 14, by - 40, bw + 28, 10);
  for (let k = 0; k < floors; k++) {
    const n = lvl + 2 - k; const y = by + k * fh; const open = n <= lvl; const here = n === lvl;
    x.fillStyle = here ? 'rgba(251,191,36,.55)' : open ? 'rgba(253,230,138,.2)' : '#0f0d24'; round(x, bx, y + 6, bw, fh - 10, 8); x.fill();
    x.fillStyle = open ? '#e2e8f0' : '#475569'; x.font = '700 26px "Space Mono", monospace'; x.textAlign = 'left'; x.fillText(n, bx + 16, y + fh / 2 + 10);
    x.font = `34px ${EMO}`; x.fillText(open ? W.floorInfo(n).ic : '🔒', bx + 90, y + fh / 2 + 12);
    if (here) { x.fillStyle = '#fde68a'; x.font = '700 24px "Space Grotesk", sans-serif'; x.fillText('← aquí', bx + 150, y + fh / 2 + 9); }
  }
  x.fillStyle = '#94a3b8'; x.font = '700 22px "Space Mono", monospace'; x.textAlign = 'center'; x.fillText(w.n.toUpperCase(), bx + bw / 2, by - 58);
  // personaje a la izquierda
  try { const img = await avatarImage(cfg.avatar, g.wear); x.drawImage(img, 70, 560, 480, 800); } catch { /* */ }
  x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(310, 1352, 150, 22, 0, 0, Math.PI * 2); x.fill();
  // textos
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.font = '700 76px "Space Grotesk", sans-serif'; x.fillText(cfg.name || 'Player 1', 540, 430);
  x.fillStyle = '#fde68a'; x.font = '700 40px "Space Grotesk", sans-serif'; x.fillText(`${W.titleOf(lvl)} · Piso ${lvl} · ${f.ic} ${f.name}`, 540, 500);
  const pill = (X, Y, e, big, small, col) => {
    x.fillStyle = 'rgba(11,10,24,.75)'; round(x, X, Y, 300, 190, 30); x.fill(); x.strokeStyle = col; x.lineWidth = 4; x.stroke();
    x.font = `64px ${EMO}`; x.fillText(e, X + 150, Y + 76); x.fillStyle = col; x.font = '700 50px "Space Mono", monospace'; x.fillText(big, X + 150, Y + 140); x.fillStyle = '#c4b5fd'; x.font = '600 26px "Space Grotesk", sans-serif'; x.fillText(small, X + 150, Y + 176); x.fillStyle = '#fff';
  };
  pill(60, 1420, '🔥', String(streak), streak === 1 ? 'día de racha' : 'días de racha', '#fb923c');
  pill(390, 1420, '⏱️', String(g.stats.minutes), 'minutos de hábitos', '#22d3ee');
  pill(720, 1420, '👑', String(g.stats.sessions), 'coronas ganadas', '#fbbf24');
  x.fillStyle = '#e9e5ff'; x.font = '600 38px "Space Grotesk", sans-serif';
  x.fillText('Aquí los puntos no se compran:', 540, 1720); x.fillStyle = '#4ade80'; x.fillText('se ganan cumpliendo hábitos. ¿Me alcanzas?', 540, 1772);
  x.fillStyle = '#8f86c9'; x.font = '700 30px "Space Mono", monospace'; x.fillText((location.host + location.pathname).replace(/\/$/, ''), 540, 1850);
  return c;
}
export async function storyBlob() { const c = await storyCanvas(); return new Promise(r => c.toBlob(r, 'image/png')); }
export async function shareStory() {
  const blob = await storyBlob(); const file = new File([blob], 'io-mi-edificio.png', { type: 'image/png' });
  const text = `Voy en el piso ${W.level()} de mi edificio en IO 🏢🔥 ${location.origin + location.pathname}`;
  try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text }); return 'shared'; } } catch (e) { if (e?.name === 'AbortError') return 'cancel'; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); return 'download';
}
