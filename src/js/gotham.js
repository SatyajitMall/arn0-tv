/*
 * Gotham theme: an amber-on-black skin plus a few moving images over the baked wallpaper.
 *
 * Everything that looks like a glow is a pre-rendered image (scripts/make-gotham.mjs); at runtime
 * only transform and opacity change, on elements with their own layer. Effects:
 *   off          nothing moves (the beam still shows, held still)
 *   searchlight  beam sweeps slowly, rooftop lights blink           (default)
 *   storm        searchlight + rain + occasional lightning          (heaviest: a full-screen
 *                                                                    translucent layer; check it
 *                                                                    by eye on your TV)
 * Animations pause whenever Home is not the visible screen (html[data-view]).
 */
(function () {
    'use strict';

    // The Gotham wallpaper is not a photo, so it is not in the generated wallpapers.js catalog.
    var WALLPAPER = {
        key: 'gotham',
        title: 'Gotham City',
        file: 'img/wallpapers/gotham.jpg',
        thumb: 'img/wallpapers/thumbs/gotham.jpg',
        credit: 'Original art, scripts/make-gotham.mjs'
    };
    window.WALLPAPERS = window.WALLPAPERS || [];
    if (!window.WALLPAPERS.some(function (w) { return w.key === WALLPAPER.key; })) {
        window.WALLPAPERS.unshift(WALLPAPER);
    }

    var THEMES = [
        { key: 'classic', label: 'Classic' },
        { key: 'gotham', label: 'Gotham' }
    ];

    var EFFECTS = [
        { key: 'off', label: 'Still' },
        { key: 'searchlight', label: 'Searchlight' },
        { key: 'storm', label: 'Storm' }
    ];

    // Rooftop tips on the baked skyline (printed by make-gotham.mjs).
    var BEACONS = [[1752, 670], [545, 736], [1088, 785], [55, 807]];

    var built = false;

    function build() {
        if (built) return;
        built = true;
        var fx = document.createElement('div');
        fx.id = 'gotham-fx';
        fx.innerHTML =
            '<img class="gx-flash" src="img/gotham/flash.png" alt="">' +
            '<img class="gx-beam" src="img/gotham/beam.png" alt="">' +
            BEACONS.map(function (b, i) {
                return '<span class="gx-beacon gx-b' + i + '" style="left:' + (b[0] - 3) + 'px;top:' + (b[1] - 3) + 'px"></span>';
            }).join('') +
            '<div class="gx-rain"></div>';
        var bg = document.getElementById('bg');
        bg.parentNode.insertBefore(fx, bg.nextSibling);
    }

    function find(list, key) {
        return list.find(function (t) { return t.key === key; }) || list[0];
    }

    function apply(themeKey, effectsKey) {
        var root = document.documentElement;
        var on = themeKey === 'gotham';
        if (on) build();
        root.classList.toggle('theme-gotham', on);
        EFFECTS.forEach(function (e) { root.classList.toggle('gx-' + e.key, on && e.key === effectsKey); });
    }

    window.Gotham = {
        THEMES: THEMES,
        EFFECTS: EFFECTS,
        WALLPAPER: WALLPAPER.key,
        theme: function (key) { return find(THEMES, key); },
        effects: function (key) { return find(EFFECTS, key); },
        apply: apply
    };
})();
