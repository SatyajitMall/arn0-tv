// Turns your Netflix viewing history into src/js/history.local.js (gitignored), which fills the
// launcher's "Continue watching" row and adds what you watch most to My Shows.
//
// Two kinds of file work:
//   quick    netflix.com > Account > Profile > Viewing activity > "Download all"  ->  NetflixViewingHistory.csv
//            (Title, Date)
//   full     netflix.com > Account > Security & privacy > Download your personal information  ->  a .zip
//            whose CONTENT_INTERACTION/ViewingActivity.csv also has time, duration and where you stopped
//
//   npm run import-netflix -- ~/Downloads/NetflixViewingHistory.csv
//   npm run import-netflix -- ~/Downloads/netflix-report.zip --profile "Satyajit"
//
// Then `npm run catalog` (artwork for the new titles) and `npm run build`. Nothing leaves the Mac
// except the .wgt you install on your own TV.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const pi = args.indexOf('--profile');
const wantProfile = pi >= 0 ? args[pi + 1] : null;
if (!file || !existsSync(file)) {
    console.error('Usage: npm run import-netflix -- <NetflixViewingHistory.csv | netflix-report.zip> [--profile NAME]');
    process.exit(1);
}

// ---------- read the CSV (from inside the zip if need be)
let text;
if (/\.zip$/i.test(file)) {
    const list = execFileSync('unzip', ['-Z1', file]).toString().split('\n');
    const inner = list.find((n) => /ViewingActivity\.csv$/i.test(n));
    if (!inner) { console.error('No ViewingActivity.csv in that zip.'); process.exit(1); }
    text = execFileSync('unzip', ['-p', file, inner], { maxBuffer: 1 << 28 }).toString('utf8');
} else {
    text = readFileSync(file, 'utf8');
}
text = text.replace(/^﻿/, '');

function parseCsv(s) {
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (q) {
            if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') q = false;
            else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i++;
            row.push(cell); cell = '';
            if (row.length > 1 || row[0]) rows.push(row);
            row = [];
        } else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows;
}

const rows = parseCsv(text);
const head = rows.shift().map((h) => h.trim().toLowerCase());
const col = (name) => head.indexOf(name);
const full = col('start time') >= 0;

// ---------- dates: the quick file uses the account's locale (15/10/2026 or 10/15/26)
let dmy = null;
if (!full) {
    for (const r of rows) {
        const p = (r[col('date')] || '').split(/[/.-]/).map(Number);
        if (p[0] > 12) { dmy = true; break; }
        if (p[1] > 12) { dmy = false; break; }
    }
    if (dmy === null) dmy = true; // India and most of the world
}
function when(r) {
    if (full) return new Date(r[col('start time')].replace(' ', 'T') + 'Z'); // UTC in the export
    const p = (r[col('date')] || '').split(/[/.-]/).map(Number);
    if (p.length < 3) return null;
    let [a, b, y] = p;
    if (y < 100) y += 2000;
    return dmy ? new Date(y, b - 1, a, 21) : new Date(y, a - 1, b, 21); // no time: say 9 pm
}
const secs = (hms) => (hms || '').split(':').reduce((t, x) => t * 60 + Number(x || 0), 0);

// ---------- which profile
let use = rows;
if (full) {
    const counts = {};
    rows.forEach((r) => { const p = r[col('profile name')]; counts[p] = (counts[p] || 0) + 1; });
    const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const profile = wantProfile || names[0];
    if (!counts[profile]) { console.error('No profile "' + profile + '". Profiles: ' + names.join(', ')); process.exit(1); }
    console.log('Profiles: ' + names.map((n) => `${n} (${counts[n]})`).join(', ') + '  ->  using ' + profile +
        (wantProfile ? '' : '  (pick another with --profile NAME)'));
    use = rows.filter((r) => r[col('profile name')] === profile &&
        !r[col('supplemental video type')] &&          // trailers, teasers, recaps
        secs(r[col('duration')]) >= 120);              // under two minutes is browsing
}

// ---------- series vs film. "Breaking Bad: Season 5: Felina" -> Breaking Bad / Season 5: Felina
const MARK = /^(.*?):\s+((?:Season|Series|Part|Volume|Book|Chapter|Collection)\s+\w+|Limited Series|Miniseries)\b:?\s*(.*)$/i;
const prefixCount = {};
use.forEach((r) => {
    const t = r[col('title')] || '';
    const i = t.indexOf(': ');
    if (i > 0) { const k = t.slice(0, i); (prefixCount[k] = prefixCount[k] || new Set()).add(t); }
});
function split(t) {
    const m = t.match(MARK);
    if (m) return { show: m[1].trim(), ep: (m[2] + (m[3] ? ': ' + m[3] : '')).trim(), series: true };
    const i = t.indexOf(': ');
    if (i > 0 && prefixCount[t.slice(0, i)].size > 1) return { show: t.slice(0, i), ep: t.slice(i + 2), series: true };
    return { show: t, ep: null, series: false };
}

// ---------- fold into one entry per show
const shows = {};
for (const r of use) {
    const t = r[col('title')];
    const d = when(r);
    if (!t || !d || isNaN(d)) continue;
    const s = split(t);
    const e = shows[s.show] || (shows[s.show] = { title: s.show, type: s.series ? 'series' : 'film', app: 'netflix', count: 0, last: 0, latest: null, bookmark: null, minutes: 0 });
    e.count++;
    if (full) e.minutes += secs(r[col('duration')]) / 60;
    if (d > e.last) {
        e.last = d;
        e.latest = s.ep;
        if (full && r[col('latest bookmark')]) e.bookmark = r[col('latest bookmark')].replace(/^00:/, '');
    }
}

const list = Object.values(shows)
    .sort((a, b) => b.last - a.last)
    .slice(0, 80)
    .map((e) => {
        const o = { title: e.title, type: e.type, app: e.app, count: e.count, last: e.last.toISOString() };
        if (e.latest) o.latest = e.latest;
        if (e.bookmark) o.bookmark = e.bookmark;
        if (e.minutes) o.minutes = Math.round(e.minutes);
        return o;
    });

const out = { source: 'netflix', imported: new Date().toISOString().slice(0, 10), shows: list };
writeFileSync(join(root, 'src/js/history.local.js'),
    '/* Your Netflix viewing history, from scripts/import-netflix.mjs. Personal: gitignored. */\n' +
    'window.WATCH_HISTORY = ' + JSON.stringify(out, null, 1) + ';\n');

console.log(`${use.length} views -> ${list.length} titles (${list.filter((x) => x.type === 'series').length} series) -> src/js/history.local.js`);
list.slice(0, 8).forEach((x) => console.log(`  ${x.last.slice(0, 10)}  ${x.title}${x.latest ? '  ·  ' + x.latest : ''}`));
console.log('Next: npm run catalog (artwork for these), then npm run build and install.');
