/*
 * Tile styling per brand. `match` is tested against "<name> <id>" of an installed app.
 * `mark` is a file in img/marks/; the build recolours it in `fg` (img/tiles/<key>.svg), shown over `bg`.
 * `text` instead of `mark` draws a typographic logo (for brands without an available mark).
 * `pad` optionally overrides the mark's [vertical, horizontal] inset in % of the tile (default [26, 22]).
 * `glow` and `line` are used by the Dock style (Settings > Appearance > Apps): the light behind the
 * focused logo, and the short line shown above it.
 */
window.BRANDS = [
    { key: 'youtube', match: /youtube|tizentube|cobalt-yt/i, mark: 'youtube', bg: '#e62117', fg: '#fff', glow: '#ff2a1f', line: 'Down the rabbit hole.' },
    { key: 'netflix', match: /netflix/i, mark: 'netflix', bg: '#141414', fg: '#e50914', glow: '#e50914', line: 'One more episode won’t hurt.' },
    { key: 'primevideo', match: /prime ?video/i, mark: 'primevideo', bg: 'linear-gradient(135deg,#0b4f7a,#1aa0e0)', fg: '#fff', pad: [12, 10], glow: '#1aa0e0', line: 'Your watchlist misses you.' },
    { key: 'disneyplus', match: /disney/i, mark: 'disneyplus', bg: 'linear-gradient(135deg,#091550,#1f5bd8)', fg: '#fff' },
    { key: 'appletv', match: /apple ?tv|aria-video/i, mark: 'appletv', bg: '#1c1c1e', fg: '#fff', glow: '#c7c7cc', line: 'Something sharp and shiny.' },
    { key: 'spotify', match: /spotify/i, mark: 'spotify', bg: '#121212', fg: '#1ed760', glow: '#1ed760', line: 'Press play on the evening.' },
    { key: 'movistar', match: /movistar/i, mark: 'movistar', bg: '#0b6fd8', fg: '#fff' },
    { key: 'max', match: /(^|\s)max(\s|$)|hbo/i, mark: 'max', bg: '#002be7', fg: '#fff' },
    { key: 'dazn', match: /dazn/i, mark: 'dazn', bg: '#0c161c', fg: '#f8fc00' },
    { key: 'plex', match: /plex/i, mark: 'plex', bg: '#1f1f1f', fg: '#e5a00d' },
    { key: 'twitch', match: /twitch/i, mark: 'twitch', bg: '#9146ff', fg: '#fff' },
    { key: 'tf1', match: /tf1/i, text: 'TF1+', bg: 'linear-gradient(135deg,#071a4d,#1d4ed8)', fg: '#fff' },
    // India (no free marks available: typographic logos)
    { key: 'jiohotstar', match: /hotstar/i, text: 'JioHotstar', bg: 'linear-gradient(135deg,#0c1445,#1f4bff)', fg: '#fff', glow: '#2f5bff', line: 'Cricket, drama and everything between.' },
    { key: 'sonyliv', match: /sonyliv/i, text: 'SonyLIV', bg: 'linear-gradient(135deg,#1a1300,#b88a00)', fg: '#fff', glow: '#e0aa00', line: 'Big stories, bigger twists.' },
    { key: 'zee5', match: /zee ?5/i, text: 'ZEE5', bg: 'linear-gradient(135deg,#2a0a45,#8230c6)', fg: '#fff', glow: '#9a3ff0', line: 'Desi nights start here.' },
    { key: 'hoichoi', match: /hoichoi/i, text: 'hoichoi', bg: 'linear-gradient(135deg,#3a0000,#e02b2b)', fg: '#fff', glow: '#ff3d3d', line: 'Ekta golpo hoye jak.' },
    { key: 'crunchyroll', match: /crunchyroll/i, mark: 'crunchyroll', bg: '#f47521', fg: '#fff' },

    // Consoles (used by inputs in config.js)
    { key: 'playstation', mark: 'playstation', bg: 'linear-gradient(135deg,#00205c,#0070d1)', fg: '#fff' },
    { key: 'xbox', mark: 'xbox', bg: 'linear-gradient(135deg,#0a3a0a,#16a016)', fg: '#fff' },
    { key: 'switch', mark: 'nintendoswitch', bg: 'linear-gradient(135deg,#b3000e,#ff2a2a)', fg: '#fff' }
];

window.findBrand = function (keyOrApp) {
    if (typeof keyOrApp === 'string') {
        return window.BRANDS.find(function (b) { return b.key === keyOrApp; }) || null;
    }
    var text = (keyOrApp.name || '') + ' ' + (keyOrApp.id || '');
    return window.BRANDS.find(function (b) { return b.match && b.match.test(text); }) || null;
};
