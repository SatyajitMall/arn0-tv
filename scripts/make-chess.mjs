// Renders the Noir chess set with headless Chrome (macOS): carved ivory and obsidian pieces from
// the original vector tokens in src/js/chess.js, lit with SVG lighting filters, plus a stone board.
//
//   src/img/chess/{w,b}{k,q,r,b,n,p}.png   192x240 sprites, piece standing on the bottom edge
//   src/img/chess/board.jpg                880x880 board: 8x8 stone squares in a gunmetal frame
//
// All lighting is baked; on the TV the board is one image and the pieces are plain <img>s.
//
//   node scripts/make-chess.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const out = join(root, 'src/img/chess');
mkdirSync(out, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'chess-'));

function shoot(name, html, w, h) {
    const file = join(tmp, name + '.html');
    const png = join(tmp, name + '.png');
    writeFileSync(file, html);
    execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', `--window-size=${w},${h}`, '--force-device-scale-factor=1',
        '--allow-file-access-from-files', '--virtual-time-budget=5000', `--user-data-dir=${join(tmp, 'profile')}`,
        '--default-background-color=00000000', `--screenshot=${png}`, 'file://' + file], { stdio: 'ignore', timeout: 120000 });
    return png;
}

// The token art, read from chess.js so the two never drift apart.
const src = readFileSync(join(root, 'src/js/chess.js'), 'utf8');
const ART = {};
for (const t of ['p', 'r', 'n', 'b', 'q', 'k']) {
    const m = src.match(new RegExp('\\n\\s*' + t + ": '([^']+)'"));
    if (!m) throw new Error('No art for ' + t);
    ART[t] = m[1];
}

const MATERIAL = {
    // ivory: warm stone, cylindrical shading, soft key light from upper left
    w: { stops: ['#5f5a51', '#cfc6b4', '#f7f2e7', '#e4dccb', '#8d8577', '#4a463f'], line: '#2a2723', eye: '#2a2723', rim: null },
    // obsidian: near-black glass, cold highlight, a thin ember rim (the Regent's colour)
    b: { stops: ['#000000', '#101114', '#2c2f35', '#15171a', '#060708', '#000000'], line: '#000', eye: '#ff4b2b', rim: 'rgba(255,75,43,0.38)' }
};

function piece(color, t) {
    const M = MATERIAL[color];
    const offs = [0, 0.22, 0.38, 0.55, 0.82, 1];
    return `<!doctype html><html><body style="margin:0;background:transparent">
<svg width="192" height="240" viewBox="0 0 192 240" xmlns="http://www.w3.org/2000/svg">
<defs>
  <linearGradient id="body" x1="0" x2="1" y1="0" y2="0">${M.stops.map((c, i) => `<stop offset="${offs[i]}" stop-color="${c}"/>`).join('')}</linearGradient>
  <linearGradient id="fall" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.18"/><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.35"/></linearGradient>
  <radialGradient id="shadow"><stop offset="0" stop-color="#000" stop-opacity="0.75"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
  <filter id="carve" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.6" result="blur"/>
    <feSpecularLighting in="blur" surfaceScale="${color === 'w' ? 4 : 6}" specularConstant="${color === 'w' ? 0.75 : 1.1}" specularExponent="${color === 'w' ? 18 : 34}" lighting-color="#ffffff" result="spec">
      <fePointLight x="10" y="-40" z="160"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <feComposite in="SourceGraphic" in2="specIn" operator="arithmetic" k1="0" k2="1" k3="${color === 'w' ? 0.5 : 0.7}" k4="0"/>
  </filter>
</defs>
<ellipse cx="96" cy="226" rx="64" ry="12" fill="url(#shadow)"/>
<g transform="translate(0,28) scale(4)">
  <g filter="url(#carve)">
    <g fill="url(#body)" stroke="${M.line}" stroke-width="0.6" stroke-linejoin="round">${ART[t]
        .replace(/class="eye"/g, `class="eye" style="fill:${M.eye};stroke:none"`)
        .replace(/class="cut"/g, `class="cut" style="fill:none;stroke:${M.line};stroke-width:1.4"`)}</g>
    <g fill="url(#fall)" stroke="none">${ART[t].replace(/class="(eye|cut)"/g, 'style="display:none"')}</g>
  </g>
  ${M.rim ? `<g fill="none" stroke="${M.rim}" stroke-width="0.7" stroke-linejoin="round" transform="translate(0.5,0)">${ART[t].replace(/class="(eye|cut)"/g, 'style="display:none"')}</g>` : ''}
</g>
</svg></body></html>`;
}

// The piece sprites now come from scripts/render-chess3d.mjs (real 3D); --flat restores these.
for (const color of process.argv.includes('--flat') ? ['w', 'b'] : []) {
    for (const t of Object.keys(ART)) {
        execFileSync('cp', [shoot(color + t, piece(color, t), 192, 240), join(out, color + t + '.png')]);
    }
}

// ---------- board: 8x8 stone at 100px a square inside a 40px gunmetal frame with coordinates
const fontUrl = 'file://' + join(root, 'src/fonts/outfit.woff2');
const board = `<!doctype html><html><head><style>
@font-face { font-family: Outfit; src: url("${fontUrl}"); font-weight: 100 900; }
body { margin: 0; background: transparent; }
</style></head><body><canvas id="c" width="880" height="880"></canvas><script>
var c = document.getElementById('c'), x = c.getContext('2d');
var seed = 3; function r() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
// frame: brushed gunmetal with a bevel
var fg = x.createLinearGradient(0, 0, 880, 880);
fg.addColorStop(0, '#2a2d32'); fg.addColorStop(0.5, '#15171a'); fg.addColorStop(1, '#22252a');
x.fillStyle = fg; x.fillRect(0, 0, 880, 880);
for (var i = 0; i < 2200; i++) { x.fillStyle = 'rgba(255,255,255,' + (r() * 0.025) + ')'; x.fillRect(r() * 880, r() * 880, r() * 60 + 10, 1); }
x.strokeStyle = 'rgba(255,255,255,0.10)'; x.lineWidth = 2; x.strokeRect(2, 2, 876, 876);
x.strokeStyle = 'rgba(0,0,0,0.8)'; x.lineWidth = 3; x.strokeRect(37.5, 37.5, 805, 805);
// squares: honed stone, each with its own slight tone and fine veining
function stone(px, py, light) {
  var base = light ? [96, 100, 106] : [26, 28, 32];
  var k = (r() - 0.5) * (light ? 12 : 6);
  x.fillStyle = 'rgb(' + (base[0] + k) + ',' + (base[1] + k) + ',' + (base[2] + k) + ')';
  x.fillRect(px, py, 100, 100);
  var img = x.getImageData(px, py, 100, 100), d = img.data;
  for (var j = 0; j < d.length; j += 4) { var n = (r() - 0.5) * (light ? 14 : 8); d[j] += n; d[j + 1] += n; d[j + 2] += n; }
  x.putImageData(img, px, py);
  x.save(); x.beginPath(); x.rect(px, py, 100, 100); x.clip();
  for (var v = 0; v < 2; v++) {
    x.strokeStyle = light ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)'; x.lineWidth = r() * 0.8 + 0.4;
    x.beginPath(); var vx = px - 10 + r() * 60, vy = py - 5; x.moveTo(vx, vy);
    x.bezierCurveTo(vx + r() * 60, vy + 35, vx + r() * 40, vy + 70, vx + 30 + r() * 60, vy + 110);
    x.stroke();
  }
  // polish: a faint sheen toward the light
  var sh = x.createLinearGradient(px, py, px + 100, py + 100);
  sh.addColorStop(0, 'rgba(255,255,255,' + (light ? 0.07 : 0.04) + ')'); sh.addColorStop(1, 'rgba(0,0,0,0.08)');
  x.fillStyle = sh; x.fillRect(px, py, 100, 100);
  x.restore();
}
for (var row = 0; row < 8; row++) for (var col = 0; col < 8; col++) stone(40 + col * 100, 40 + row * 100, (row + col) % 2 === 0);
// coordinates engraved in the frame (after the font has loaded)
document.fonts.load('500 18px Outfit').then(function () {
x.font = '500 18px Outfit'; x.textAlign = 'center'; x.textBaseline = 'middle';
x.fillStyle = 'rgba(220,225,232,0.45)';
'abcdefgh'.split('').forEach(function (f, i) { x.fillText(f.toUpperCase(), 90 + i * 100, 860); });
for (var k2 = 0; k2 < 8; k2++) x.fillText(String(8 - k2), 20, 90 + k2 * 100);
});
</script></body></html>`;
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', shoot('board', board, 880, 880), '--out', join(out, 'board.jpg')], { stdio: 'ignore' });
console.log('chess sprites and board written to src/img/chess');
