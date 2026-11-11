// Renders the chess pieces as real 3D models (three.js, dev dependency only) in headless Chrome:
// lathe-turned Staunton-style pieces of original proportions, an extruded horse head for the Rider,
// ivory and obsidian physical materials, studio key light, cold rim, ember rim on the Regent's side,
// and a soft contact shadow. Output replaces the sprites make-chess.mjs drew:
//
//   src/img/chess/{w,b}{k,q,r,b,n,p}.png   192x240, transparent, piece standing on the bottom edge
//
// The TV never runs three.js; it shows these PNGs on the tilted board.
//
//   node scripts/render-chess3d.mjs
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, extname } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = resolve(import.meta.dirname, '..');
const out = join(root, 'src/img/chess');
const tmp = mkdtempSync(join(tmpdir(), 'chess3d-'));
const PORT = 8765;

const TYPES = { '.js': 'text/javascript', '.html': 'text/html' };
const server = createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const file = url === '/render.html' ? join(tmp, 'render.html') : join(root, url);
    if (!file.startsWith(root) && !file.startsWith(tmp) || !existsSync(file)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

writeFileSync(join(tmp, 'render.html'), `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
const q = new URLSearchParams(location.search), COLOR = q.get('c'), T = q.get('t');
const W = 384, H = 480;
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = COLOR === 'w' ? 0.8 : 1.25;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = COLOR === 'w' ? 0.35 : 0.9;

const mat = COLOR === 'w'
  ? new THREE.MeshPhysicalMaterial({ color: 0xe2d6c0, roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: 0xfff4e0 })
  : new THREE.MeshPhysicalMaterial({ color: 0x0a0b0e, roughness: 0.14, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.06 });
const detail = COLOR === 'w' ? new THREE.MeshStandardMaterial({ color: 0x4a4339, roughness: 0.6 }) : new THREE.MeshStandardMaterial({ color: 0xff3a1e, emissive: 0xff3a1e, emissiveIntensity: 1.6 });

const BASE = [[0,0],[0.43,0],[0.45,0.03],[0.44,0.07],[0.38,0.095],[0.35,0.12],[0.37,0.15],[0.40,0.17],[0.33,0.2]];
const P = {
  p: BASE.concat([[0.2,0.3],[0.15,0.46],[0.23,0.5],[0.24,0.53],[0.13,0.56],[0.17,0.6],[0.205,0.67],[0.2,0.74],[0.15,0.8],[0.07,0.835],[0,0.84]]),
  r: BASE.concat([[0.28,0.27],[0.25,0.6],[0.31,0.64],[0.32,0.68],[0.3,0.7],[0.3,0.84],[0.22,0.84],[0.22,0.78],[0,0.78]]),
  b: BASE.concat([[0.18,0.32],[0.13,0.62],[0.23,0.66],[0.24,0.69],[0.13,0.72],[0.18,0.77],[0.21,0.86],[0.19,0.95],[0.13,1.03],[0.06,1.07],[0.075,1.1],[0.06,1.13],[0,1.14]]),
  q: BASE.concat([[0.2,0.34],[0.13,0.76],[0.25,0.8],[0.26,0.83],[0.14,0.86],[0.19,0.9],[0.27,1.07],[0.22,1.09],[0.13,1.12],[0,1.13]]),
  k: BASE.concat([[0.21,0.34],[0.14,0.8],[0.27,0.84],[0.28,0.87],[0.15,0.9],[0.2,0.95],[0.25,1.12],[0.17,1.16],[0,1.17]]),
  n: BASE.concat([[0.3,0.24],[0,0.24]])
};
const g = new THREE.Group();
function add(geo, m) { const mesh = new THREE.Mesh(geo, m || mat); mesh.castShadow = true; g.add(mesh); return mesh; }
add(new THREE.LatheGeometry(P[T].map(([x, y]) => new THREE.Vector2(x, y)), 96));
if (T === 'r') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const m = add(new THREE.BoxGeometry(0.1, 0.1, 0.07)); m.position.set(Math.cos(a) * 0.265, 0.89, Math.sin(a) * 0.265); m.rotation.y = -a; } }
if (T === 'b') { const s = add(new THREE.BoxGeometry(0.02, 0.17, 0.3), detail); s.position.set(0.04, 0.9, 0.06); s.rotation.set(0, 0.6, -0.55); add(new THREE.SphereGeometry(0.05, 32, 16)).position.set(0, 1.18, 0); }
if (T === 'q') { for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(new THREE.SphereGeometry(0.042, 24, 12)).position.set(Math.cos(a) * 0.245, 1.11, Math.sin(a) * 0.245); } add(new THREE.SphereGeometry(0.07, 32, 16)).position.set(0, 1.2, 0); }
if (T === 'k') { add(new THREE.BoxGeometry(0.065, 0.26, 0.065)).position.set(0, 1.3, 0); add(new THREE.BoxGeometry(0.2, 0.065, 0.065)).position.set(0, 1.33, 0); }
if (T === 'n') {
  const pts = [[-0.27,0.22],[0.27,0.22],[0.24,0.48],[0.3,0.78],[0.24,1.0],[0.1,1.12],[0.04,1.24],[-0.02,1.14],[-0.16,1.06],[-0.3,0.93],[-0.4,0.8],[-0.38,0.72],[-0.26,0.7],[-0.12,0.74],[-0.06,0.66],[-0.2,0.5]];
  const sh = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 6, curveSegments: 24 });
  geo.translate(0, 0, -0.1);
  const head = add(geo); head.rotation.y = 0.5;
  const eye = add(new THREE.SphereGeometry(0.03, 16, 8), detail); eye.position.set(-0.13, 0.98, 0.15); eye.position.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
}
scene.add(g);

// light: warm-white key from the front left, cold rim behind, ember rim on the Regent's side
const key = new THREE.DirectionalLight(0xfff1e0, COLOR === 'w' ? 2.6 : 3.2); key.position.set(-2.4, 6, 2.2); key.castShadow = true;
key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6; key.shadow.camera.left = -1; key.shadow.camera.right = 1; key.shadow.camera.top = 2; key.shadow.camera.bottom = -1;
scene.add(key);
const rim = new THREE.DirectionalLight(0x9cc3ff, COLOR === 'w' ? 1.6 : 2.6); rim.position.set(2.5, 2, -3); scene.add(rim);
if (COLOR === 'b') { const ember = new THREE.DirectionalLight(0xff4b2b, 2.2); ember.position.set(-3, 0.6, -2); scene.add(ember); }
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.ShadowMaterial({ opacity: 0.55 }));
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const cam = new THREE.PerspectiveCamera(24, W / H, 0.1, 50);
const el = 20 * Math.PI / 180, dist = 4.6;
cam.position.set(0, 0.62 + Math.sin(el) * dist, Math.cos(el) * dist); cam.lookAt(0, 0.62, 0);
// frame so the base sits near the bottom edge
cam.setViewOffset(W, H, 0, 22, W, H);
renderer.render(scene, cam);
document.title = 'done';
</script></body></html>`);

for (const c of ['w', 'b']) {
    for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
        const png = join(tmp, c + t + '.png');
        // async: the page is served by this same process, so it must keep running meanwhile
        await run(CHROME, ['--headless=new', '--hide-scrollbars', '--window-size=384,480', '--force-device-scale-factor=1',
            '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--virtual-time-budget=15000',
            `--user-data-dir=${join(tmp, 'profile')}`, '--default-background-color=00000000', `--screenshot=${png}`,
            `http://127.0.0.1:${PORT}/render.html?c=${c}&t=${t}`], { timeout: 120000 });
        execFileSync('sips', ['-z', '240', '192', png, '--out', join(out, c + t + '.png')], { stdio: 'ignore' });
        console.log('rendered', c + t);
    }
}
server.close();
