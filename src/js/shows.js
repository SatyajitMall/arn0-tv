/*
 * "My Shows" row on Home: wide cards for the series you keep coming back to. OK opens the show's
 * app and says what to search (TV apps do not take a "play this title" link from a web app).
 *
 * config: shows: [{ title, app, image }]   app = key in js/moods-data.js,
 *         image = 'img/shows/<file>.jpg' (your own still, 16:9, ~960x540). Without one the card
 *         is typographic: the title on graphite with the service's colour as an edge.
 */
(function () {
    'use strict';

    var el = UI.el;
    var cfg = window.LAUNCHER_CONFIG;

    function list() {
        return (cfg.shows || []).filter(function (s) { return s && s.title; });
    }

    function appFor(s) {
        var apps = (window.MOOD_DATA && MOOD_DATA.apps) || {};
        return apps[s.app] || null;
    }

    // Without your own still, each card borrows a graded night photo, so the row is never empty boxes.
    var MOOD = ['city-aerial', 'noir-street', 'fog-traffic', 'fog-towers', 'cloud-towers', 'dark-tower', 'storm-tower'];

    function tile(s, i) {
        var app = appFor(s);
        if (!s.image) s = { title: s.title, app: s.app, image: 'img/cards/' + MOOD[i % MOOD.length] + '.jpg' };
        var wrap = el('div', 'show');
        var card = el('div', 'show-card');
        card.style.setProperty('--show-c', (app && app.color) || '#888');
        if (s.image) {
            card.style.backgroundImage = 'url("' + s.image + '")';
            card.classList.add('has-image');
        }
        var meta = el('div', 'show-meta');
        meta.appendChild(el('div', 'show-title', s.title));
        meta.appendChild(el('div', 'show-app', app ? app.label : ''));
        card.appendChild(meta);
        wrap.appendChild(card);
        wrap._item = { kind: 'show', show: s };
        return wrap;
    }

    function render(row) {
        row.innerHTML = '';
        list().forEach(function (s, i) { row.appendChild(tile(s, i)); });
        return row.children.length;
    }

    function activate(item) {
        var s = item.show;
        var app = appFor(s);
        if (!app) { UI.toast(s.title + ': no app set (shows[].app in config)'); return; }
        UI.toast('Opening ' + app.label + ': search “' + s.title + '”');
        Apps.launch(app.id).catch(function (err) {
            UI.toast('Could not open ' + app.label + ': ' + DevLog.errorText(err));
        });
    }

    window.Shows = { render: render, activate: activate };
})();
