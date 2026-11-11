// Renders the "Noir" wallpaper with headless Chrome (macOS): a photographic night city seen from
// high up, out of focus, through rain on armoured glass. Everything is procedural and original.
//
//   src/img/wallpapers/noir.jpg         1920x1080, UI-safe fade baked into the bottom
//   src/img/wallpapers/thumbs/noir.jpg  320x180 thumb for Settings > Background
//   src/img/noir/drops.png              sparse transparent droplets layer (Rain effect drifts it)
//
// Why it reads as a photo: the city is defocused (bokeh discs, not drawn lights), the drops on
// the glass are sharp and refract the scene above them, the colour is graded like a night lens
// (teal shadows, sodium highlights), and grain plus vignette sit over everything.
// Runtime cost is one JPEG and one PNG: no live gradients or blur on the TV.
//
//   node scripts/make-noir.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const wallDir = join(root, 'src/img/wallpapers');
const fxDir = join(root, 'src/img/noir');
mkdirSync(join(wallDir, 'thumbs'), { recursive: true });
mkdirSync(fxDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'noir-'));

function shoot(name, html, w, h, transparent) {
    const file = join(tmp, name + '.html');
    const png = join(tmp, name + '.png');
    writeFileSync(file, html);
    const args = ['--headless=new', '--hide-scrollbars', `--window-size=${w},${h}`, '--force-device-scale-factor=1',
        '--allow-file-access-from-files', '--virtual-time-budget=60000', `--user-data-dir=${join(tmp, 'profile')}`,
        `--screenshot=${png}`];
    if (transparent) args.push('--default-background-color=00000000');
    execFileSync(CHROME, [...args, 'file://' + file], { stdio: 'ignore', timeout: 180000 });
    return png;
}

// Shared page code. MODE 'wall' draws everything; MODE 'drops' draws only a sparse drop layer.
const page = (mode) => `<!doctype html><html><body style="margin:0;background:${mode === 'wall' ? '#000' : 'transparent'}">
<canvas id="c" width="1920" height="1080" style="display:block"></canvas>
<script>
var MODE = '${mode}';
var W = 1920, H = 1080, S = 2;               // city drawn at 2x, then downsampled
var seed = 7;
function rnd() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function rr(a, b) { return a + rnd() * (b - a); }
function ri(a, b) { return Math.floor(rr(a, b + 1)); }
function pick(l) { return l[Math.floor(rnd() * l.length)]; }
var c = document.getElementById('c');
var ctx = c.getContext('2d');

// ---------- value noise for cloud deck
function makeNoise(gw, gh) { var g = []; for (var i = 0; i < gw * gh; i++) g.push(rnd()); return { g: g, w: gw, h: gh }; }
function sm(t) { return t * t * (3 - 2 * t); }
function nAt(n, x, y) {
  var xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
  function g(a, b) { return n.g[((b % n.h + n.h) % n.h) * n.w + ((a % n.w + n.w) % n.w)]; }
  var a = g(xi, yi), b = g(xi + 1, yi), c2 = g(xi, yi + 1), d = g(xi + 1, yi + 1);
  return a + (b - a) * xf + (c2 - a) * yf + (a - b - c2 + d) * xf * yf;
}
function fbm(n, x, y) { var v = 0, amp = 0.5, f = 1; for (var o = 0; o < 6; o++) { v += amp * nAt(n, x * f, y * f); f *= 2.03; amp *= 0.5; } return v; }

function sky(t) {
  // Overcast night: near-black zenith, sodium-lit cloud base toward the horizon.
  var cw = 480, ch = 270, img = ctx.createImageData(cw, ch), n = makeNoise(64, 64);
  for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
    var v = y / ch;
    var cl = fbm(n, x / 70, y / 38 + x / 900);
    cl = Math.max(0, cl - 0.3) * 3.0;
    var glow = Math.pow(Math.max(0, v - 0.18) / 0.82, 2.2);
    var r = 5 + 40 * glow + cl * (14 + 95 * glow);
    var g = 7 + 28 * glow + cl * (13 + 62 * glow);
    var b = 10 + 18 * glow + cl * (15 + 36 * glow);
    var i = (y * cw + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  var tmp = document.createElement('canvas'); tmp.width = cw; tmp.height = ch;
  tmp.getContext('2d').putImageData(img, 0, 0);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tmp, 0, 0, W, H);
}

// ---------- city, drawn sharp on an offscreen canvas, defocused onto the main one
var WARM = ['255,196,120', '255,214,150', '255,226,180', '255,170,90'];
var COOL = ['200,225,255', '226,238,255', '190,240,225'];
function city() {
  var oc = document.createElement('canvas'); oc.width = W * S; oc.height = H * S;
  var o = oc.getContext('2d'); o.scale(S, S);
  var lc = document.createElement('canvas'); lc.width = W * S; lc.height = H * S;
  var lw = lc.getContext('2d'); lw.scale(S, S);
  var lights = [];
  // Layers far -> near. horizon is where the far layer's bases sit.
  var layers = [
    { base: 690, hmin: 50, hmax: 200, wmin: 16, wmax: 54, haze: 0.85, win: 1.6, gap: 2.6, p: 0.3, n: 0 },
    { base: 760, hmin: 80, hmax: 320, wmin: 26, wmax: 80, haze: 0.66, win: 2.2, gap: 3.4, p: 0.28, n: 0 },
    { base: 860, hmin: 130, hmax: 460, wmin: 44, wmax: 120, haze: 0.45, win: 3, gap: 4.4, p: 0.26, n: 0 },
    { base: 1020, hmin: 240, hmax: 700, wmin: 80, wmax: 210, haze: 0.2, win: 4.2, gap: 5.6, p: 0.2, n: 0 }
  ];
  layers.forEach(function (L, li) {
    var x = -40;
    while (x < W + 40) {
      var w = rr(L.wmin, L.wmax), h = rr(L.hmin, L.hmax);
      // keep a valley in the middle of the near layer so the centre of the frame breathes
      if (li === 3 && x > 640 && x < 1180) h *= 0.45;
      var top = L.base - h;
      var hz = L.haze;
      var body = 'rgb(' + Math.round(10 + 40 * hz) + ',' + Math.round(11 + 30 * hz) + ',' + Math.round(13 + 22 * hz) + ')';
      o.fillStyle = body;
      o.fillRect(x, top, w, H - top);
      // rain-wet glass catches the sodium sky on one edge
      o.fillStyle = 'rgba(160,130,100,' + (0.05 + 0.08 * (1 - hz)).toFixed(3) + ')';
      o.fillRect(x + w - Math.max(1, w * 0.03), top, Math.max(1, w * 0.03), H - top);
      if (rnd() < 0.3) {   // curtain-wall tower: faint mullion grid instead of punched windows
        o.fillStyle = 'rgba(120,140,160,' + (0.04 + 0.05 * (1 - hz)).toFixed(3) + ')';
        for (var mx = x + 3; mx < x + w - 2; mx += Math.max(3, L.gap * 1.2)) o.fillRect(mx, top, 0.6, H - top);
      }
      // rooftop massing
      if (rnd() < 0.35) { o.fillRect(x + w * 0.2, top - h * 0.06, w * 0.6, h * 0.06 + 1); }
      if (rnd() < 0.12) { var aw = Math.max(1.5, w * 0.03); o.fillRect(x + w / 2 - aw / 2, top - h * 0.18, aw, h * 0.18); lw.fillStyle = 'rgba(255,50,35,0.95)'; lw.beginPath(); lw.arc(x + w / 2, top - h * 0.18, 1 + 1.6 * (1 - hz), 0, 7); lw.fill(); }
      // windows: lit in floor bands, a few whole floors on, colour temperatures mixed per building
      var warm = rnd() < 0.7, pal = warm ? WARM : COOL;
      var cols = Math.floor((w - L.gap) / (L.win + L.gap * 0.5));
      for (var fy = top + L.gap; fy < L.base + 200; fy += L.win * 1.6 + L.gap * 0.6) {
        var band = rnd(), floorP = band < 0.08 ? 0.92 : band < 0.5 ? L.p : L.p * 0.25;
        for (var ci = 0; ci < cols; ci++) {
          if (rnd() > floorP) continue;
          var wx = x + L.gap * 0.6 + ci * (L.win + L.gap * 0.5), col = pick(pal), a = rr(0.35, 1) * (1 - hz * 0.55);
          lw.fillStyle = 'rgba(' + col + ',' + a.toFixed(3) + ')';
          lw.fillRect(wx, fy, L.win, L.win * 1.25);
          if (li === 3 && rnd() < 0.006) lights.push({ x: wx + L.win / 2, y: fy, r: L.win * rr(0.8, 1.6), c: col, a: a * 0.5 });
        }
      }
      x += w + rr(-6, 10);
    }
    if (li === 2) {
      var sx = 1290, sb = 860, sh2 = 500, sw = 64;
      o.fillStyle = 'rgb(24,24,26)';
      o.fillRect(sx - sw / 2, sb - sh2, sw, sh2);
      o.beginPath(); o.moveTo(sx - sw / 2, sb - sh2); o.lineTo(sx - sw * 0.28, sb - sh2 - 70); o.lineTo(sx, sb - sh2 - 230);
      o.lineTo(sx + sw * 0.28, sb - sh2 - 70); o.lineTo(sx + sw / 2, sb - sh2); o.fill();
      // floodlit crown: light thrown upward from the setback
      var fl = o.createLinearGradient(0, sb - sh2 + 40, 0, sb - sh2 - 230);
      fl.addColorStop(0, 'rgba(225,232,242,0.30)'); fl.addColorStop(0.35, 'rgba(190,200,215,0.12)'); fl.addColorStop(1, 'rgba(200,210,225,0)');
      o.fillStyle = fl;
      o.beginPath(); o.moveTo(sx - sw / 2, sb - sh2 + 40); o.lineTo(sx - sw / 2, sb - sh2); o.lineTo(sx - sw * 0.28, sb - sh2 - 70); o.lineTo(sx, sb - sh2 - 230);
      o.lineTo(sx + sw * 0.28, sb - sh2 - 70); o.lineTo(sx + sw / 2, sb - sh2); o.lineTo(sx + sw / 2, sb - sh2 + 40); o.fill();
      o.fillStyle = 'rgba(0,0,0,0.35)';
      for (var rb = -2; rb <= 2; rb++) { o.beginPath(); o.moveTo(sx + rb * 9, sb - sh2 + 30); o.lineTo(sx + rb * 2.2, sb - sh2 - 200); o.lineTo(sx + rb * 2.2 + 1.2, sb - sh2 - 200); o.lineTo(sx + rb * 9 + 2, sb - sh2 + 30); o.fill(); }
      lw.fillStyle = 'rgba(255,50,35,1)'; lw.beginPath(); lw.arc(sx, sb - sh2 - 232, 2.2, 0, 7); lw.fill();
      for (var fy2 = sb - sh2 + 60; fy2 < sb; fy2 += 7) for (var fx2 = sx - sw / 2 + 5; fx2 < sx + sw / 2 - 5; fx2 += 6)
        if (rnd() < 0.18) { lw.fillStyle = 'rgba(255,214,160,' + rr(0.3, 0.8).toFixed(2) + ')'; lw.fillRect(fx2, fy2, 2.4, 3); }
    }
    // haze veil over this layer: distant layers sink into the sodium fog
    var hzg = o.createLinearGradient(0, L.base - L.hmax, 0, L.base + 80);
    hzg.addColorStop(0, 'rgba(70,52,38,0)');
    hzg.addColorStop(0.55, 'rgba(78,60,44,' + (0.45 * L.haze).toFixed(3) + ')');
    hzg.addColorStop(1, 'rgba(66,50,36,' + (0.8 * L.haze).toFixed(3) + ')');
    o.fillStyle = hzg; o.fillRect(0, L.base - L.hmax - 20, W, L.hmax + 200);
  });
  // street-level glow and traffic streams far below
  var st = o.createLinearGradient(0, 820, 0, 1080);
  st.addColorStop(0, 'rgba(255,150,70,0)'); st.addColorStop(1, 'rgba(255,140,60,0.22)');
  o.fillStyle = st; o.fillRect(0, 820, W, 260);
  // traffic: thin streams of head/tail lights along a few avenues far below
  for (var av = 0; av < 5; av++) {
    var ay = rr(985, 1070), tail = rnd() < 0.5;
    for (var q = 0; q < 140; q++) {
      lw.fillStyle = tail ? 'rgba(255,60,40,' + rr(0.3, 0.8).toFixed(2) + ')' : 'rgba(255,225,180,' + rr(0.3, 0.9).toFixed(2) + ')';
      lw.fillRect(rr(0, W), ay + rr(-2, 2), rr(2, 5), 1.6);
    }
  }

  // shallow defocus (the glass is in focus, the city slightly behind it) plus lens bloom
  ctx.save();
  ctx.filter = 'blur(2.2px)';
  ctx.drawImage(oc, 0, 0, W, H);
  ctx.filter = 'blur(1.4px)';
  ctx.drawImage(lc, 0, 0, W, H);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.55; ctx.filter = 'blur(10px)'; ctx.drawImage(lc, 0, 0, W, H);
  ctx.globalAlpha = 0.35; ctx.filter = 'blur(34px)'; ctx.drawImage(lc, 0, 0, W, H);
  ctx.restore();
  ctx.globalCompositeOperation = 'lighter';
  lights.forEach(function (L) {
    var R = L.r * 2.4 + 3;
    var g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, R);
    g.addColorStop(0, 'rgba(' + L.c + ',' + (L.a * 0.22).toFixed(3) + ')');
    g.addColorStop(0.82, 'rgba(' + L.c + ',' + (L.a * 0.28).toFixed(3) + ')');
    g.addColorStop(0.93, 'rgba(' + L.c + ',' + (L.a * 0.4).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(' + L.c + ',0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.x, L.y, R, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- rain on the glass: sharp drops that refract the (blurred) scene above them
function drops(sparse) {
  var src = MODE === 'wall' ? ctx.getImageData(0, 0, W, H).data : null;
  function sample(x, y) {
    if (!src) return [120, 110, 100];
    x = Math.max(0, Math.min(W - 1, Math.round(x))); y = Math.max(0, Math.min(H - 1, Math.round(y)));
    var i = (y * W + x) * 4; return [src[i], src[i + 1], src[i + 2]];
  }
  function drop(x, y, r, a) {
    var s = sample(x, y - r * 6);  // refraction: a drop shows the scene above it, flipped
    var lift = function (v, k) { return Math.min(255, Math.round(v * k + 14)); };
    var g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, 'rgba(' + lift(s[0], 1.5) + ',' + lift(s[1], 1.5) + ',' + lift(s[2], 1.5) + ',' + (0.85 * a) + ')');
    g.addColorStop(0.75, 'rgba(' + lift(s[0], 0.9) + ',' + lift(s[1], 0.9) + ',' + lift(s[2], 0.95) + ',' + (0.8 * a) + ')');
    g.addColorStop(1, 'rgba(0,0,0,' + (0.55 * a) + ')');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r, r * 1.08, 0, 0, Math.PI * 2); ctx.fill();
    // bright crescent on the lower edge (light focused through the drop) and a tiny specular
    ctx.strokeStyle = 'rgba(255,240,220,' + (0.35 * a) + ')'; ctx.lineWidth = Math.max(0.6, r * 0.12);
    ctx.beginPath(); ctx.arc(x, y + r * 0.05, r * 0.82, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * a) + ')';
    ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.4, Math.max(0.5, r * 0.16), 0, Math.PI * 2); ctx.fill();
  }
  function trail(x, y, len, r) {
    // a drop that ran: thin wet track above it, wobbling as glass does
    ctx.lineCap = 'round';
    for (var p = 0; p < 2; p++) {
      ctx.strokeStyle = p ? 'rgba(255,235,210,0.07)' : 'rgba(0,0,0,0.10)';
      ctx.lineWidth = p ? r * 0.25 : r * 0.7;
      ctx.beginPath(); ctx.moveTo(x, y);
      var cx = x;
      for (var t = 0; t < len; t += 5) { cx += rr(-2.2, 2.2) * (rnd() < 0.15 ? 2.5 : 1); ctx.lineTo(cx + (p ? -r * 0.15 : 0), y - t); }
      ctx.stroke();
    }
    drop(x, y, r, 1);
  }
  var tiny = sparse ? 260 : 2600, mid = sparse ? 40 : 380, big = sparse ? 6 : 22;
  for (var i = 0; i < tiny; i++) drop(rr(0, W), rr(0, H), rr(0.7, 2.2), rr(0.35, 0.8));
  for (var j = 0; j < mid; j++) drop(rr(0, W), rr(0, H), rr(2.4, 5.5), rr(0.6, 0.95));
  for (var k = 0; k < big; k++) {
    var x = rr(20, W - 20), y = rr(120, H - 40), r = rr(5, 10);
    if (rnd() < 0.55) trail(x, y, rr(80, 420), r); else drop(x, y, r, 1);
  }
}

// ---------- lens: grade, vignette, grain, and the fade the UI sits on
function grade() {
  var img = ctx.getImageData(0, 0, W, H), d = img.data;
  for (var i = 0; i < d.length; i += 4) {
    var r = d[i], g = d[i + 1], b = d[i + 2];
    var l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    var sh = 1 - Math.min(1, l * 2.2);                // shadows -> cold teal
    r = r * 0.92 - 6 * sh; g = g * 0.98 + 3 * sh; b = b * 1.02 + 10 * sh;
    var hl = Math.max(0, l - 0.45) * 1.8;            // highlights -> sodium
    r += 16 * hl; g += 6 * hl; b -= 8 * hl;
    var x = (i / 4) % W, y = Math.floor(i / 4 / W);
    var dx = (x - W / 2) / (W / 2), dy = (y - H * 0.45) / (H / 2);
    var v = 1 - 0.42 * Math.pow(Math.min(1, Math.sqrt(dx * dx * 0.8 + dy * dy)), 2.2);
    var f = y > H * 0.38 ? 1 - Math.min(0.86, Math.pow((y - H * 0.38) / (H * 0.62), 0.8) * 0.86) : 1;  // UI band: fades to 86% black
    var n = (rnd() - 0.5) * 9;
    d[i] = Math.max(0, r * v * f + n); d[i + 1] = Math.max(0, g * v * f + n); d[i + 2] = Math.max(0, b * v * f + n);
  }
  ctx.putImageData(img, 0, 0);
}

if (MODE === 'wall') { sky(); city(); drops(false); grade(); }
else { seed = 99; drops(true); }
</script></body></html>`;

const wallPng = shoot('noir', page('wall'), 1920, 1080, false);
const wallJpg = join(wallDir, 'noir.jpg');
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '86', wallPng, '--out', wallJpg], { stdio: 'ignore' });
execFileSync('sips', ['-Z', '320', '-s', 'formatOptions', '78', wallJpg, '--out', join(wallDir, 'thumbs/noir.jpg')], { stdio: 'ignore' });
execFileSync('cp', [shoot('drops', page('drops'), 1920, 1080, true), join(fxDir, 'drops.png')]);
console.log('noir.jpg, thumbs/noir.jpg, noir/drops.png written');
