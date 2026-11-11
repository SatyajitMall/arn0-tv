// Grades the licensed photos in art-src/photos/ into one look and writes 1920x1080 wallpapers.
//
// The look (night-city thriller): colour drained to near monochrome with cold teal shadows,
// except warm lights (sodium lamps, tail lights, windows), which keep their colour; blacks
// crushed with an S-curve; fine grain; a vignette; and a fade low and to the left where the
// launcher's text sits. Run in headless Chrome so the maths is plain canvas, no image tools.
//
//   art-src/photos/<name>.jpg   (Unsplash License; credits in src/img/wallpapers/CREDITS.md)
//   -> src/img/wallpapers/<name>.jpg + thumbs/<name>.jpg
//
//   node scripts/grade-photos.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const srcDir = join(root, 'art-src/photos');
const wallDir = join(root, 'src/img/wallpapers');
mkdirSync(join(wallDir, 'thumbs'), { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'grade-'));

// name: [focus x 0..1, focus y 0..1, exposure, keep-warm 0..1]
export const PHOTOS = {
    'storm-tower': [0.4, 0.35, 1.3, 0.85],
    'fog-towers': [0.55, 0.45, 0.95, 0.7],
    'cloud-towers': [0.5, 0.4, 0.95, 0.6],
    'fog-traffic': [0.5, 0.55, 0.9, 0.9],
    'noir-street': [0.5, 0.5, 1.0, 0.5],
    'stone-angel': [0.5, 0.42, 0.85, 0.3],
    'dark-tower': [0.5, 0.4, 1.15, 0.5],
    'city-aerial': [0.5, 0.6, 1.35, 0.8]
};

function page(name, f) {
    return `<!doctype html><html><body style="margin:0;background:#000">
<canvas id="c" width="1920" height="1080"></canvas><script>
var img = new Image();
img.onload = function () {
  var W = 1920, H = 1080, c = document.getElementById('c'), x = c.getContext('2d');
  // cover-crop around the focus point
  var s = Math.max(W / img.width, H / img.height), dw = img.width * s, dh = img.height * s;
  var ox = Math.min(0, Math.max(W - dw, W / 2 - dw * ${f[0]})), oy = Math.min(0, Math.max(H - dh, H / 2 - dh * ${f[1]}));
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, ox, oy, dw, dh);
  var d = x.getImageData(0, 0, W, H), p = d.data, seed = 9;
  function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
  var EXP = ${f[2]}, WARM = ${f[3]};
  for (var i = 0; i < p.length; i += 4) {
    var r = p[i] / 255 * EXP, g = p[i + 1] / 255 * EXP, b = p[i + 2] / 255 * EXP;
    var l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    // warmth of this pixel: how much red/orange leads blue
    var warm = Math.max(0, Math.min(1, (r - b) * 3 - 0.05)) * Math.min(1, l * 3);
    var keep = 0.12 + WARM * 0.75 * warm;              // saturation kept
    r = l + (r - l) * keep; g = l + (g - l) * keep; b = l + (b - l) * keep;
    // S-curve with crushed toe
    function curve(v) { v = Math.max(0, Math.min(1, v)); v = Math.pow(v, 1.08); return v * v * (3 - 2 * v) * 0.82 + v * 0.18; }
    r = curve(r); g = curve(g); b = curve(b);
    // split tone: cold teal shadows, slightly warm highlights
    var sh = Math.pow(1 - Math.min(1, l * 1.6), 1.6);
    var mid = Math.max(0, 1 - Math.abs(l - 0.3) * 3);
    r += -0.022 * sh - 0.02 * mid; g += 0.012 * sh + 0.004 * mid; b += 0.06 * sh + 0.045 * mid;
    var hl = Math.max(0, l - 0.55);
    r += 0.05 * hl; b -= 0.03 * hl;
    // vignette + UI fade (bottom and left)
    var px = (i / 4) % W, py = (i / 4 - px) / W;
    var dx = (px - W * 0.55) / (W * 0.62), dy = (py - H * 0.45) / (H * 0.62);
    var v = 1 - 0.55 * Math.pow(Math.min(1, Math.sqrt(dx * dx + dy * dy)), 2.4);
    var fb = py > H * 0.5 ? 1 - 0.72 * Math.pow((py - H * 0.5) / (H * 0.5), 1.3) : 1;
    var fl = px < W * 0.45 ? 1 - 0.28 * Math.pow(1 - px / (W * 0.45), 1.5) : 1;
    var k = v * fb * fl;
    var n = (rnd() - 0.5) * 0.035;
    p[i] = Math.max(0, Math.min(255, (r * k + n) * 255));
    p[i + 1] = Math.max(0, Math.min(255, (g * k + n) * 255));
    p[i + 2] = Math.max(0, Math.min(255, (b * k + n) * 255));
  }
  x.putImageData(d, 0, 0);
  document.title = 'done';
};
img.src = 'file://${join(srcDir, name + '.jpg')}';
</script></body></html>`;
}

for (const [name, f] of Object.entries(PHOTOS)) {
    const file = join(tmp, name + '.html');
    const png = join(tmp, name + '.png');
    writeFileSync(file, page(name, f));
    execFileSync(CHROME, ['--headless=new', '--hide-scrollbars', '--window-size=1920,1080', '--force-device-scale-factor=1',
        '--allow-file-access-from-files', '--virtual-time-budget=30000', `--user-data-dir=${join(tmp, 'profile')}`,
        `--screenshot=${png}`, 'file://' + file], { stdio: 'ignore', timeout: 180000 });
    const out = join(wallDir, name + '.jpg');
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', png, '--out', out], { stdio: 'ignore' });
    execFileSync('sips', ['-Z', '320', '-s', 'formatOptions', '78', out, '--out', join(wallDir, 'thumbs', name + '.jpg')], { stdio: 'ignore' });
    // Card crops for My Shows (16:9) and Favourites (3:4), small enough to decode on the TV.
    mkdirSync(join(root, 'src/img/cards/tall'), { recursive: true });
    execFileSync('sips', ['-Z', '640', '-s', 'formatOptions', '82', out, '--out', join(root, 'src/img/cards', name + '.jpg')], { stdio: 'ignore' });
    const tallX = Math.round(Math.min(1920 - 810, Math.max(0, 1920 * f[0] - 405)));
    const tall = join(root, 'src/img/cards/tall', name + '.jpg');
    execFileSync('sips', ['-c', '1080', '810', '--cropOffset', '0', String(tallX), out, '--out', tall], { stdio: 'ignore' });
    execFileSync('sips', ['-Z', '480', '-s', 'formatOptions', '82', tall, '--out', tall], { stdio: 'ignore' });
    console.log('graded', name);
}
