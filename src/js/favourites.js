/*
 * "My Favourites" row on Home: portrait cards of characters you love. Each card sits in grey and
 * turns to colour when focused, and the screen behind takes on that show's scene (or colour).
 * OK opens the show's app and tells you what to search.
 *
 * Pictures are yours to add: put them in img/favourites/ and name them in config
 * (favourites: [{ photo: 'img/favourites/x.jpg', scene: 'img/favourites/x-scene.jpg' }]).
 * Without a photo a card gets original art: a plain bust and initials in the show's colour.
 *
 * Performance: the grey version is a static layer (filter painted once, never animated); the
 * colour version sits on top and only its opacity changes. The scene is one full-screen layer
 * whose opacity fades. Nothing animates except opacity and transform.
 */
(function () {
    'use strict';

    var $ = UI.$;
    var el = UI.el;
    var cfg = window.LAUNCHER_CONFIG;

    var BUST = '<svg viewBox="0 0 100 120" aria-hidden="true">' +
        '<circle cx="50" cy="44" r="21" fill="currentColor"/>' +
        '<path d="M10 120c2-27 19-42 40-42s38 15 40 42z" fill="currentColor"/></svg>';

    function list() {
        return (cfg.favourites || []).filter(function (f) { return f && f.name; });
    }

    function appFor(f) {
        var apps = (window.MOOD_DATA && MOOD_DATA.apps) || {};
        return apps[f.app] || null;
    }

    function initials(name) {
        return name.split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
    }

    function colourOf(f) {
        var app = appFor(f);
        return f.color || (app && app.color) || '#ffd34d';
    }

    function face(f, grey) {
        var layer = el('div', 'fav-face ' + (grey ? 'fav-grey' : 'fav-colour'));
        if (f.photo) {
            layer.style.backgroundImage = 'url("' + f.photo + '")';
            layer.classList.add('fav-photo');
        } else {
            layer.style.backgroundColor = grey ? '#2a2a2e' : colourOf(f);
            var art = el('div', 'fav-art');
            art.innerHTML = BUST;
            layer.appendChild(art);
            layer.appendChild(el('div', 'fav-initials', initials(f.name)));
        }
        return layer;
    }

    function tile(f, i) {
        var wrap = el('div', 'fav');
        var card = el('div', 'fav-card');
        card.style.setProperty('--fav-c', colourOf(f));
        card.appendChild(el('div', 'fav-index', 'No. ' + (i < 9 ? '0' : '') + (i + 1)));
        card.appendChild(face(f, true));
        card.appendChild(face(f, false));
        wrap.appendChild(card);
        wrap.appendChild(el('div', 'fav-name', f.name));
        wrap.appendChild(el('div', 'fav-show', f.show || ''));
        wrap._item = { kind: 'favourite', fav: f };
        return wrap;
    }

    function render(row) {
        row.innerHTML = '';
        list().forEach(function (f, i) { row.appendChild(tile(f, i)); });
        return row.children.length;
    }

    // The scene layer: the favourite's own picture if given, else a wash of its colour.
    var sceneFor = null;
    function focus(item) {
        var scene = $('fav-scene');
        var f = item && item._item && item._item.kind === 'favourite' ? item._item.fav : null;
        if (!f) {
            scene.style.opacity = '0';
            sceneFor = null;
            return;
        }
        if (sceneFor !== f) {
            sceneFor = f;
            scene.style.backgroundImage = f.scene ? 'url("' + f.scene + '")' : '';
            scene.style.backgroundColor = f.scene ? '#000' : colourOf(f);
            scene.classList.toggle('fav-scene-photo', !!f.scene);
        }
        var noir = document.documentElement.classList.contains('theme-noir');
        scene.style.opacity = f.scene ? (noir ? '0.45' : '0.6') : (noir ? '0.1' : '0.22');
    }

    function activate(item) {
        var f = item.fav;
        var app = appFor(f);
        if (!app) {
            UI.toast(f.name + ': no app set (favourites[].app in config)');
            return;
        }
        UI.toast('Opening ' + app.label + (f.show ? ': search “' + f.show + '”' : ''));
        Apps.launch(app.id).catch(function (err) {
            UI.toast('Could not open ' + app.label + ': ' + DevLog.errorText(err));
        });
    }

    window.Favourites = { render: render, focus: focus, activate: activate, count: function () { return list().length; } };
})();
