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

    // Your configured shows, then what you watch most on Netflix (js/watch.js import), no repeats.
    function list() {
        var out = (cfg.shows || []).filter(function (s) { return s && s.title; });
        var have = {};
        out.forEach(function (s) { have[s.title.toLowerCase()] = true; });
        if (window.Watch) {
            Watch.topShows(6).forEach(function (s) {
                if (!have[s.title.toLowerCase()]) { have[s.title.toLowerCase()] = true; out.push(s); }
            });
        }
        return out;
    }

    function appFor(s) {
        var apps = (window.MOOD_DATA && MOOD_DATA.apps) || {};
        return apps[s.app] || null;
    }

    // Without your own still, each card borrows a graded night photo, so the row is never empty boxes.
    var MOOD = ['city-aerial', 'noir-street', 'fog-traffic', 'fog-towers', 'cloud-towers', 'dark-tower', 'storm-tower'];

    function tile(s, i, kind, note) {
        // Your still, else the TMDB backdrop, else a graded night photo; and the service TMDB says
        // streams it (unless the entry came from your history, which knows where you watched it).
        var e = window.Catalog ? Catalog.title(s.title) : null;
        s = {
            title: s.title,
            app: window.Catalog && s.from !== 'history' ? Catalog.appFor(s.title, s.app) : s.app,
            image: s.image || (e && e.backdrop) || 'img/cards/' + MOOD[i % MOOD.length] + '.jpg'
        };
        var app = appFor(s);
        var wrap = el('div', 'show');
        var card = el('div', 'show-card');
        card.style.setProperty('--show-c', (app && app.color) || '#888');
        if (s.image) {
            card.style.backgroundImage = 'url("' + s.image + '")';
            card.classList.add('has-image');
        }
        var meta = el('div', 'show-meta');
        if (note && note.ep) meta.appendChild(el('div', 'show-ep', note.ep));
        meta.appendChild(el('div', 'show-title', s.title));
        meta.appendChild(el('div', 'show-app', (app ? app.label : '') + (note && note.when ? '  ·  ' + note.when : '')));
        card.appendChild(meta);
        wrap.appendChild(card);
        wrap._item = { kind: kind || 'show', show: s };
        return wrap;
    }

    // "Last night", "3 days ago": how long since, in words you would say.
    function ago(t) {
        var now = new Date();
        var d = new Date(t);
        var days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
            new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
        if (days <= 0) return 'Today';
        if (days === 1) return d.getHours() >= 18 || d.getHours() < 4 ? 'Last night' : 'Yesterday';
        if (days < 7) return days + ' days ago';
        if (days < 14) return 'Last week';
        return Math.round(days / 7) + ' weeks ago';
    }

    // Continue: shows you opened from here and your imported Netflix history, newest first.
    // History knows the episode ("Season 5: Felina"); a show opened here knows how long you stayed.
    function renderContinue(row) {
        row.innerHTML = '';
        if (!window.Watch) return 0;
        Watch.continueList(8).forEach(function (c, i) {
            var ep = c.ep ? c.ep.replace(/^Season (\d+):\s*/i, 'S$1 · ').replace(/^Limited Series:\s*/i, '') : '';
            if (!ep && c.mins) ep = c.mins + ' min watched';
            row.appendChild(tile(c, i + 2, 'continue', { ep: ep, when: ago(c.t) }));
        });
        return row.children.length;
    }

    // The show you open most around this time comes first.
    function render(row) {
        row.innerHTML = '';
        var shows = list();
        if (window.Usage) shows = Usage.rank(shows, function (s) { return Usage.score('show', s.title); });
        shows.forEach(function (s, i) { row.appendChild(tile(s, i)); });
        return row.children.length;
    }

    function activate(item) {
        var s = item.show;
        var app = appFor(s);
        if (!app) { UI.toast(s.title + ': no app set (shows[].app in config)'); return; }
        if (window.Usage) Usage.record('show', s.title);
        UI.toast('Opening ' + app.label + ': search “' + s.title + '”');
        if (window.Watch) Watch.pin(s.title, s.app);
        Apps.launch(app.id, s.title).catch(function (err) {
            UI.toast('Could not open ' + app.label + ': ' + DevLog.errorText(err));
        });
    }

    window.Shows = { render: render, renderContinue: renderContinue, activate: activate };
})();
