// Renders the Gotham theme's art with headless Chrome (macOS), all original, all baked:
//
//   src/img/wallpapers/gotham.jpg         night sky, moon glow, clouds, 3-layer skyline, fog, scrim
//   src/img/wallpapers/thumbs/gotham.jpg  320x180 thumb for Settings > Background
//   src/img/gotham/beam.png               searchlight beam + signal in the clouds (transparent)
//   src/img/gotham/flash.png              lightning glow (transparent), Storm effect only
//   src/img/gotham/rain.svg               240px seamless rain tile, Storm effect only
//
// Every gradient lives in these files, never in live CSS: the README's render probe measured
// three live radial-gradient layers at 4.6 fps on a Q70B. At runtime the TV only moves images.
//
//   node scripts/make-gotham.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const wallDir = join(root, 'src/img/wallpapers');
const fxDir = join(root, 'src/img/gotham');
mkdirSync(join(wallDir, 'thumbs'), { recursive: true });
mkdirSync(fxDir, { recursive: true });
const tmp = mkdtempSync(join(tmpdir(), 'gotham-'));

// Seeded RNG so the skyline is the same on every build.
let seed = 11;
function rand() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
function int(a, b) { return a + Math.floor(rand() * (b - a + 1)); }
function pick(list) { return list[Math.floor(rand() * list.length)]; }

// ---------- skyline (SVG, 1920x620 anchored to the bottom of the screen)
const W = 1920, H = 620;
const tips = [];
function layer(base, vary, minW, maxW, fill, winP, winColors, track) {
    const out = [];
    let x = -20;
    while (x < W) {
        const w = int(minW, maxW), h = base + int(0, vary), y = H - h;
        let top = y;
        out.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`);
        const k = rand();
        if (k < 0.18) {                       // gothic spire
            const sh = int(60, 150);
            out.push(`<polygon points="${x + w * 0.3},${y} ${x + w * 0.5},${y - sh} ${x + w * 0.7},${y}" fill="${fill}"/>`);
            top = y - sh;
            if (track) tips.push([Math.round(x + w * 0.5), top]);
        } else if (k < 0.38) {                // stepped art-deco crown
            out.push(`<rect x="${x + w * 0.15}" y="${y - 26}" width="${w * 0.7}" height="26" fill="${fill}"/>`);
            out.push(`<rect x="${x + w * 0.32}" y="${y - 50}" width="${w * 0.36}" height="24" fill="${fill}"/>`);
        } else if (k < 0.52) {                // antenna
            const ah = int(40, 90);
            out.push(`<rect x="${x + w / 2 - 2}" y="${y - ah}" width="4" height="${ah}" fill="${fill}"/>`);
            if (track) tips.push([Math.round(x + w / 2), y - ah]);
        }
        for (let wy = y + 14; wy < H - 10; wy += 18) {
            for (let wx = x + 8; wx < x + w - 8; wx += 14) {
                if (rand() < winP) out.push(`<rect x="${wx}" y="${wy}" width="5" height="8" fill="${pick(winColors)}"/>`);
            }
        }
        x += w + int(-6, 4);
    }
    return out.join('');
}
const skyline = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g>${layer(300, 180, 40, 90, '#141b29', 0.035, ['#2c3850'])}</g>` +
    `<g>${layer(200, 220, 60, 130, '#0c111b', 0.05, ['#56607a', '#8a6a2a'])}</g>` +
    `<g>${layer(90, 250, 80, 180, '#05070b', 0.07, ['#e8b64a', '#f3cf78', '#c98d2e'], true)}</g></svg>`;
writeFileSync(join(tmp, 'skyline.svg'), skyline);

// ---------- scenes
const page = (body, transparent) => `<!DOCTYPE html><html><body style="margin:0;width:1920px;height:1080px;` +
    `overflow:hidden;position:relative;background:${transparent ? 'transparent' : '#05070b'}">${body}</body></html>`;
const abs = 'position:absolute;';

const wallpaper = page(`
  <div style="${abs}inset:0;width:1920px;height:1080px;background:
      radial-gradient(1200px 700px at 52% 8%, #1f2938 0%, #0d131d 52%, #05070b 100%)"></div>
  <div style="${abs}left:1180px;top:-220px;width:1000px;height:760px;background:
      radial-gradient(closest-side, rgba(190,205,230,.20), rgba(190,205,230,0))"></div>
  <div style="${abs}left:640px;top:-40px;width:900px;height:380px;background:
      radial-gradient(closest-side, rgba(120,135,160,.20), rgba(120,135,160,0))"></div>
  <div style="${abs}left:-200px;top:120px;width:1100px;height:300px;background:
      radial-gradient(closest-side, rgba(90,105,130,.14), rgba(90,105,130,0))"></div>
  <img src="skyline.svg" style="${abs}left:0;bottom:0;width:1920px;height:${H}px">
  <div style="${abs}left:0;bottom:0;width:1920px;height:460px;background:
      linear-gradient(to top, rgba(5,7,11,.9), rgba(5,7,11,.45) 45%, rgba(5,7,11,0))"></div>
  <div style="${abs}left:0;top:0;width:1920px;height:1080px;background:
      radial-gradient(1300px 700px at 0% 0%, rgba(0,0,0,.5), rgba(0,0,0,0) 70%),
      radial-gradient(ellipse 78% 72% at 50% 45%, rgba(0,0,0,0) 58%, rgba(0,0,0,.6) 100%)"></div>`);

// Beam image: 600x560, pivot at bottom centre (300, 560) = a rooftop spire. Signal at the far end.
const beam = `<!DOCTYPE html><html><body style="margin:0;width:600px;height:560px;background:transparent;position:relative">
  <div style="${abs}left:130px;bottom:0;width:340px;height:470px;
      background:linear-gradient(to top, rgba(255,225,140,.30), rgba(255,225,140,.08) 80%, rgba(255,225,140,0));
      clip-path:polygon(47% 100%, 53% 100%, 100% 0, 0 0)"></div>
  <div style="${abs}left:150px;top:0;width:300px;height:190px;border-radius:50%;background:
      radial-gradient(closest-side, rgba(255,228,145,.95) 0%, rgba(255,214,100,.78) 55%, rgba(255,200,80,.18) 85%, rgba(255,200,80,0) 100%)"></div>
  <svg style="${abs}left:235px;top:58px" width="130" height="72" viewBox="0 0 65 36"><path fill="#0a0c10" d="M0,20 C8,10 16,6 24,8 L28,0 L31,6 L34,6 L37,0 L41,8 C49,6 57,10 65,20 C58,18 53,20 50,26 C46,22 40,24 37,30 L32.5,36 L28,30 C25,24 19,22 15,26 C12,20 7,18 0,20 Z"/></svg>
</body></html>`;

const flash = page(`<div style="${abs}left:0;top:0;width:1920px;height:1080px;background:
    radial-gradient(1150px 520px at 72% 6%, rgba(205,220,255,.6), rgba(205,220,255,0))"></div>`, true);

function shoot(name, html, w, h, transparent) {
    const file = join(tmp, name + '.html');
    const png = join(tmp, name + '.png');
    writeFileSync(file, html);
    const args = ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--window-size=${w},${h}`,
        '--allow-file-access-from-files', '--virtual-time-budget=3000', `--user-data-dir=${join(tmp, 'profile')}`,
        `--screenshot=${png}`];
    if (transparent) args.push('--default-background-color=00000000');
    execFileSync(CHROME, [...args, 'file://' + file], { stdio: 'ignore' });
    return png;
}

const wallPng = shoot('wallpaper', wallpaper, 1920, 1080, false);
const wallJpg = join(wallDir, 'gotham.jpg');
execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '84', wallPng, '--out', wallJpg], { stdio: 'ignore' });
execFileSync('sips', ['-Z', '320', '-s', 'formatOptions', '78', wallJpg, '--out', join(wallDir, 'thumbs/gotham.jpg')], { stdio: 'ignore' });

execFileSync('cp', [shoot('beam', beam, 600, 560, true), join(fxDir, 'beam.png')]);
execFileSync('cp', [shoot('flash', flash, 1920, 1080, true), join(fxDir, 'flash.png')]);
// Half size is plenty for a soft glow (shown at 1920x1080 via CSS, never animated in scale).
execFileSync('sips', ['-Z', '960', join(fxDir, 'flash.png')], { stdio: 'ignore' });

// Rain: lines drawn 9x (tile + neighbours) so the 240px tile repeats seamlessly.
const drops = [];
for (let i = 0; i < 14; i++) {
    const x = int(0, 240), y = int(0, 240), len = int(14, 30), o = pick([0.18, 0.25, 0.32]);
    for (const dy of [0, -240, 240]) for (const dx of [0, -240, 240]) {
        drops.push(`<line x1="${x + dx}" y1="${y + dy}" x2="${x + dx - 4}" y2="${y + dy + len}" stroke="#a9b8d0" stroke-opacity="${o}" stroke-width="1.4" stroke-linecap="round"/>`);
    }
}
writeFileSync(join(fxDir, 'rain.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">${drops.join('')}</svg>`);

rmSync(tmp, { recursive: true, force: true });
for (const f of [wallJpg, join(fxDir, 'beam.png'), join(fxDir, 'flash.png'), join(fxDir, 'rain.svg')]) {
    console.log(`${f.replace(root + '/', '')}  ${(statSync(f).size / 1024).toFixed(0)} KB`);
}
// Rooftop tips (screen coordinates) for the blinking aircraft lights in js/gotham.js.
console.log('Tips:', JSON.stringify(tips.map(([x, y]) => [x, y + 1080 - H]).sort((a, b) => a[1] - b[1]).slice(0, 12)));
