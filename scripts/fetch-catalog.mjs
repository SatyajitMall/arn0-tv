// Fetches real artwork and Indian streaming availability from TMDB for every title the launcher
// knows: My Shows and Favourites (src/js/config.local.js), the mood deck (src/js/moods-data.js)
// and your imported viewing history (src/js/history.local.js).
//
//   posters    img/catalog/p-<slug>.jpg   342 wide, for mood cards
//   backdrops  img/catalog/b-<slug>.jpg   780 wide, for My Shows and favourite scenes
//   faces      img/catalog/f-<slug>.jpg   the actor who plays a favourite character
//   js/catalog.local.js                   window.CATALOG: paths + which apps stream it in India
//
// Both outputs are gitignored. Needs a free TMDB key (themoviedb.org > Settings > API) in .env
// (this folder or the one above):  TMDB_API_KEY=<v3 key>  or  TMDB_ACCESS_TOKEN=<v4 read token>
//
//   node scripts/fetch-catalog.mjs
//
// Uses curl over IPv4 to api.tmdb.org: Node's fetch stalls on this network's IPv6 route, and
// api.themoviedb.org has its TLS reset by some Indian ISPs (api.tmdb.org is the same API).
// This product uses the TMDB API but is not endorsed or certified by TMDB.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const outDir = join(root, 'src/img/catalog');
mkdirSync(outDir, { recursive: true });

// .env here or in the folder above (names are matched without regard to case).
function env() {
    const vars = {};
    for (const [k, v] of Object.entries(process.env)) vars[k.toUpperCase()] = v;
    for (const file of [join(root, '.env'), join(root, '..', '.env')]) {
        if (!existsSync(file)) continue;
        for (const line of readFileSync(file, 'utf8').split('\n')) {
            const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*(.*?)\s*$/);
            const k = m && m[1].toUpperCase();
            if (m && m[2] && !vars[k]) vars[k] = m[2].replace(/^["']|["']$/g, '');
        }
    }
    return vars;
}
const vars = env();
const TMDB_API_KEY = vars.TMDB_API_KEY;
const TMDB_TOKEN = vars.TMDB_TOKEN || vars.TMDB_ACCESS_TOKEN;
if (!TMDB_API_KEY && !TMDB_TOKEN) {
    console.error('No TMDB key. Add TMDB_API_KEY=... (or TMDB_TOKEN=...) to .env, then run again.');
    process.exit(1);
}

// Three tries with a pause: this network drops the odd TMDB connection. Errors never print the
// command line, which carries the key.
function curl(url, args = []) {
    let last = null;
    for (let i = 0; i < 3; i++) {
        try {
            return execFileSync('curl', ['-s', '-4', '--http1.1', '--connect-timeout', '8', '--max-time', '25', '--fail', ...args, url],
                { maxBuffer: 1 << 24, stdio: ['ignore', 'pipe', 'ignore'] });
        } catch (e) {
            last = e.status;
            execFileSync('sleep', [String(1 + i)]);
        }
    }
    throw new Error('curl exit ' + last + ' for ' + url.split('?')[0]);
}

// The read token goes in a header; the v3 key (only if there is no token) has to go in the query.
function api(path, params = {}) {
    const q = new URLSearchParams(params);
    if (!TMDB_TOKEN) q.set('api_key', TMDB_API_KEY);
    const headers = TMDB_TOKEN ? ['-H', `Authorization: Bearer ${TMDB_TOKEN}`] : [];
    return JSON.parse(curl(`https://api.tmdb.org/3${path}?${q}`, headers).toString());
}

function image(path, size, file) {
    if (!path) return null;
    const dest = join(outDir, file);
    if (!existsSync(dest)) writeFileSync(dest, curl(`https://image.tmdb.org/t/p/${size}${path}`));
    return 'img/catalog/' + file;
}

// Same slug as src/js/catalog.js
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Read the launcher's own data files the way the TV does.
const sandbox = { window: {} };
vm.createContext(sandbox);
for (const f of ['src/js/config.local.js', 'src/js/moods-data.js', 'src/js/history.local.js']) {
    const file = join(root, f);
    if (existsSync(file)) vm.runInContext(readFileSync(file, 'utf8'), sandbox, { filename: f });
}
const local = sandbox.window.LAUNCHER_LOCAL || {};
const moodData = sandbox.window.MOOD_DATA || { apps: {}, moods: [] };

// TMDB provider names (India) -> app keys in moods-data.js
const PROVIDERS = [
    [/netflix/i, 'netflix'],
    [/amazon prime|prime video/i, 'prime'],
    [/hotstar|jio ?cinema/i, 'hotstar'],
    [/sony ?liv/i, 'sonyliv'],
    [/zee5/i, 'zee5'],
    [/apple tv/i, 'appletv'],
    [/hoichoi/i, 'hoichoi'],
    [/youtube/i, 'youtube']
];
function appsFor(providers) {
    const out = [];
    for (const p of providers || []) {
        const hit = PROVIDERS.find(([re]) => re.test(p.provider_name));
        if (hit && moodData.apps[hit[1]] && !out.includes(hit[1])) out.push(hit[1]);
    }
    return out;
}

// Best match: of the series and films with exactly this name, the one most people have rated
// (Spider-Man -> the 2002 film, not the 1994 cartoon); else TMDB's top result.
function find(title) {
    const res = api('/search/multi', { query: title, region: 'IN', language: 'en-IN', include_adult: 'false' }).results || [];
    const want = slug(title);
    const media = res.filter((r) => r.media_type === 'tv' || r.media_type === 'movie');
    const exact = media.filter((r) => slug(r.name || r.title) === want).sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
    return exact[0] || media[0] || null;
}

const catalog = { fetched: new Date().toISOString().slice(0, 10), titles: {}, faces: {} };
const titles = new Set();
(local.shows || []).forEach((s) => titles.add(s.title));
(local.favourites || []).forEach((f) => f.show && titles.add(f.show));
moodData.moods.forEach((m) => (m.titles || []).forEach((t) => titles.add(t.title)));
// Imported Netflix history (scripts/import-netflix.mjs): the 30 most recent series feed Continue
// and My Shows. Their app stays Netflix; TMDB only supplies the artwork.
const history = (sandbox.window.WATCH_HISTORY || { shows: [] }).shows;
history.filter((s) => s.type !== 'film').slice(0, 30).forEach((s) => titles.add(s.title));

const found = {};
for (const title of titles) {
    try {
        const r = find(title);
        if (!r) { console.log('  not found:', title); continue; }
        const type = r.media_type;
        const s = slug(title);
        const prov = api(`/${type}/${r.id}/watch/providers`).results || {};
        const on = appsFor((prov.IN || {}).flatrate);
        catalog.titles[s] = {
            title,
            type,
            year: (r.first_air_date || r.release_date || '').slice(0, 4),
            poster: image(r.poster_path, 'w342', `p-${s}.jpg`),
            backdrop: image(r.backdrop_path, 'w780', `b-${s}.jpg`),
            on
        };
        found[title] = { id: r.id, type };
        console.log(`  ${title} (${type} ${catalog.titles[s].year}) on: ${on.join(', ') || 'no Indian streaming data'}`);
    } catch (e) {
        console.log('  failed:', title, e.message.split('\n')[0]);
    }
}

// Favourites: the actor credited with the character in that show.
for (const f of local.favourites || []) {
    const hit = found[f.show];
    if (!hit) continue;
    try {
        const credits = hit.type === 'tv' ? api(`/tv/${hit.id}/aggregate_credits`) : api(`/movie/${hit.id}/credits`);
        const first = f.name.toLowerCase().split(/\s+/)[0];
        const person = (credits.cast || []).find((c) => {
            const roles = c.roles ? c.roles.map((r) => r.character) : [c.character];
            return roles.some((ch) => (ch || '').toLowerCase().includes(first));
        });
        if (person && person.profile_path) {
            const s = slug(f.show + ' ' + f.name);
            catalog.faces[s] = image(person.profile_path, 'h632', `f-${s}.jpg`);
            console.log(`  face: ${f.name} -> ${person.name}`);
        } else {
            console.log(`  no face for ${f.name}`);
        }
    } catch (e) {
        console.log('  face failed:', f.name, e.message.split('\n')[0]);
    }
}

writeFileSync(join(root, 'src/js/catalog.local.js'),
    '/* Generated by scripts/fetch-catalog.mjs from TMDB. Gitignored. ' +
    'This product uses the TMDB API but is not endorsed or certified by TMDB. */\n' +
    'window.CATALOG = ' + JSON.stringify(catalog, null, 1) + ';\n');
console.log(`Catalog: ${Object.keys(catalog.titles).length} titles, ${Object.keys(catalog.faces).length} faces -> src/js/catalog.local.js`);
