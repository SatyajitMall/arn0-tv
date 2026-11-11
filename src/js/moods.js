/*
 * "Don't have time to browse?" — a choice-paralysis breaker.
 *
 *   Deck:    one mood card at a time. Left = nope (the card flies away, next mood).
 *            Right or OK = yes.
 *   Reel:    that mood's titles spin past like a slot reel and land on one.
 *   Pick:    the title card, then its app opens after a 3-second countdown.
 *            OK = open now, Left = spin again, Back = back to the deck.
 *
 * Data: js/moods-data.js. Only transform and opacity animate (card fly, reel), each on an element
 * with its own layer; nothing repaints per frame.
 */
(function () {
    'use strict';

    var KEY = UI.KEY;
    var $ = UI.$;
    var el = UI.el;

    var FLY_MS = 320;
    var REEL_MS = 2600;
    var REEL_ITEM = 150;      // px per reel row (must match .reel-item height in style.css)
    var REEL_LEN = 26;        // rows in a spin; the pick is near the end
    var COUNTDOWN = 3;

    var data = window.MOOD_DATA || { apps: {}, moods: [] };
    // TMDB catalog (js/catalog.js): real posters, and each title moved to the service that
    // actually streams it in India when that differs from moods-data.js.
    if (window.Catalog) {
        data.moods.forEach(function (m) {
            m.titles = (m.titles || []).map(function (t) {
                var e = Catalog.title(t.title);
                return { title: t.title, note: t.note, app: Catalog.appFor(t.title, t.app), poster: t.poster || (e && e.poster) || null };
            });
        });
    }
    var state = { mode: 'deck', index: 0, mood: null, pick: null, timers: [] };

    function later(fn, ms) { state.timers.push(setTimeout(fn, ms)); }
    function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; }
    function sound(name) { if (window.Sound) Sound.play(name); }

    // Installed app ids, so titles on apps you do not have are skipped. Before the app list has
    // loaded (or in the preview) everything counts as installed.
    function installed() {
        if (window.__TIZEN_MOCK__) return null;   // preview: the mock's app list is made up
        var apps = window.Home ? Home.apps() : [];
        if (!apps || !apps.length) return null;
        var ids = {};
        apps.forEach(function (a) { ids[a.id] = true; });
        return ids;
    }

    function titlesFor(mood) {
        var ids = installed();
        var source = mood.any
            ? data.moods.reduce(function (all, m) { return all.concat(m.any ? [] : m.titles); }, [])
            : mood.titles;
        return source.filter(function (t) {
            var app = data.apps[t.app];
            return app && (!ids || ids[app.id]);
        });
    }

    // Moods you keep saying yes to around this time come first; "Anything at all" stays last.
    function moodScore(m) {
        if (m.any || !window.Usage) return -1e9;
        return Usage.score('mood-yes', m.key) - 0.5 * Usage.score('mood-nope', m.key);
    }

    // The order is fixed for one visit (refreshOrder on show), so a yes or nope does not reshuffle
    // the deck under you.
    var order = null;
    function refreshOrder() {
        var list = data.moods.filter(function (m) { return titlesFor(m).length; });
        order = window.Usage ? Usage.rank(list, moodScore) : list;
    }

    function moods() {
        if (!order) refreshOrder();
        return order;
    }

    // A title on an app you use at this hour is likelier to be picked; one picked lately, less.
    function choose(titles) {
        var weights = titles.map(function (t) {
            if (!window.Usage) return 1;
            var app = data.apps[t.app];
            return (1 + Usage.score('app', app.id)) / (1 + 2 * Usage.score('pick', t.title));
        });
        var total = weights.reduce(function (a, b) { return a + b; }, 0);
        var r = Math.random() * total;
        for (var i = 0; i < titles.length; i++) {
            r -= weights[i];
            if (r <= 0) return titles[i];
        }
        return titles[titles.length - 1];
    }

    // ---------- Faces

    function hue(text) {
        var h = 0;
        for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360;
        return h;
    }

    // A typographic "poster": your own image if given, else the title on a colour from its name.
    function poster(t, cls) {
        var p = el('div', 'poster ' + (cls || ''));
        var app = data.apps[t.app];
        if (t.poster) {
            p.style.backgroundImage = 'url("' + t.poster + '")';
            p.classList.add('has-image');
        } else if (document.documentElement.classList.contains('theme-noir')) {
            // Noir: a graded night photo under the title instead of a flat colour.
            var shots = ['noir-street', 'fog-traffic', 'dark-tower', 'fog-towers', 'cloud-towers', 'city-aerial', 'stone-angel', 'storm-tower'];
            p.style.backgroundImage = 'url("img/cards/tall/' + shots[hue(t.title) % shots.length] + '.jpg")';
            p.classList.add('photo-poster');
        } else {
            var h = hue(t.title);
            p.style.background = 'linear-gradient(160deg, hsl(' + h + ',45%,30%), hsl(' + ((h + 40) % 360) + ',55%,12%))';
        }
        p.appendChild(el('div', 'poster-title', t.title));
        var badge = el('div', 'poster-app', app.label);
        badge.style.borderColor = app.color;
        p.appendChild(badge);
        return p;
    }

    function moodCard(m) {
        var c = el('div', 'mood-card');
        c.style.borderColor = m.color;
        c.style.setProperty('--mood-c', m.color);
        var n = titlesFor(m).length;
        c.appendChild(el('div', 'mood-kicker', 'Tonight’s mood'));
        // A fan of the first three titles, like a hand of cards held up.
        var fan = el('div', 'mood-fan');
        titlesFor(m).slice(0, 3).forEach(function (t, i, all) {
            var p = poster(t, 'fan fan' + (all.length === 3 ? i : i + 1));
            fan.appendChild(p);
        });
        c.appendChild(fan);
        var name = el('div', 'mood-name', m.name);
        name.style.color = m.color;
        c.appendChild(name);
        c.appendChild(el('div', 'mood-line', m.line));
        c.appendChild(el('div', 'mood-count', n + (n === 1 ? ' title' : ' titles')));
        return c;
    }

    // ---------- Deck

    function renderDeck() {
        var list = moods();
        var deck = $('mood-deck');
        deck.innerHTML = '';
        if (!list.length) {
            deck.appendChild(el('div', 'mood-empty', 'No moods match your installed apps. Edit js/moods-data.js.'));
            return;
        }
        state.index = state.index % list.length;
        // Top card plus two behind it; the rest are not in the DOM.
        for (var k = 2; k >= 0; k--) {
            var m = list[(state.index + k) % list.length];
            var card = moodCard(m);
            card.classList.add('pos' + k);
            deck.appendChild(card);
        }
        $('mood-progress').textContent = (state.index + 1) + ' / ' + list.length;
        var wash = $('mood-wash');
        if (wash) wash.style.backgroundColor = list[state.index].color;
    }

    function topCard() {
        var cards = $('mood-deck').children;
        return cards.length ? cards[cards.length - 1] : null;
    }

    function nope() {
        var card = topCard();
        if (!card || state.mode !== 'deck') return;
        state.mode = 'busy';
        sound('move');
        if (window.Usage) Usage.record('mood-nope', moods()[state.index % moods().length].key);
        card.classList.add('fly-left');
        later(function () {
            state.index += 1;
            state.mode = 'deck';
            renderDeck();
        }, FLY_MS);
    }

    function yes() {
        var card = topCard();
        if (!card || state.mode !== 'deck') return;
        state.mode = 'busy';
        sound('select');
        state.mood = moods()[state.index % moods().length];
        if (window.Usage) Usage.record('mood-yes', state.mood.key);
        card.classList.add('fly-right');
        later(spin, FLY_MS);
    }

    // ---------- Reel

    function shuffled(list) {
        var a = list.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function spin() {
        clearTimers();
        var titles = titlesFor(state.mood);
        var pick = choose(titles);
        // Fill the strip with shuffled titles and put the pick at a fixed late row.
        var strip = [];
        while (strip.length < REEL_LEN) strip = strip.concat(shuffled(titles));
        strip = strip.slice(0, REEL_LEN);
        var land = REEL_LEN - 3;
        strip[land] = pick;
        state.pick = pick;

        var track = $('mood-reel-track');
        track.innerHTML = '';
        strip.forEach(function (t) {
            var row = el('div', 'reel-item');
            row.appendChild(el('span', 'reel-title', t.title));
            row.appendChild(el('span', 'reel-app', data.apps[t.app].label));
            track.appendChild(row);
        });
        $('mood-reel-mood').textContent = state.mood.name;
        $('mood-reel-mood').style.color = state.mood.color;

        state.mode = 'spinning';
        show('reel');
        // Start at the top without animation, then animate to the landing row (centred in a
        // three-row window).
        track.style.transition = 'none';
        track.style.transform = 'translate3d(0,0,0)';
        void track.offsetHeight;
        track.style.transition = 'transform ' + REEL_MS + 'ms cubic-bezier(0.12, 0.7, 0.18, 1)';
        track.style.transform = 'translate3d(0,' + (-(land - 1) * REEL_ITEM) + 'px,0)';
        later(function () { sound('select'); showPick(); }, REEL_MS + 150);
    }

    // ---------- Pick + countdown

    function showPick() {
        var t = state.pick;
        var app = data.apps[t.app];
        var holder = $('mood-pick-poster');
        holder.innerHTML = '';
        holder.appendChild(poster(t, 'big'));
        $('mood-pick-title').textContent = t.title;
        $('mood-pick-app').textContent = 'on ' + app.label + (t.note ? ' · ' + t.note : '');
        state.mode = 'picked';
        show('pick');
        var n = COUNTDOWN;
        var tick = function () {
            if (state.mode !== 'picked') return;
            if (n === 0) { open(); return; }
            $('mood-pick-count').textContent = 'Opening ' + app.label + ' in ' + n + '…';
            n -= 1;
            later(tick, 1000);
        };
        tick();
    }

    function open() {
        clearTimers();
        var t = state.pick;
        var app = data.apps[t.app];
        state.mode = 'deck';
        if (window.Usage) Usage.record('pick', t.title);
        UI.toast('Opening ' + app.label + ': search “' + t.title + '”');
        Apps.launch(app.id).catch(function (err) {
            UI.toast('Could not open ' + app.label + ': ' + DevLog.errorText(err));
        });
        // Come back to a fresh deck next time.
        show('deck');
        renderDeck();
    }

    function backToDeck() {
        clearTimers();
        state.mode = 'deck';
        show('deck');
        renderDeck();
    }

    // ---------- View

    function show(part) {
        $('mood-deck-wrap').classList.toggle('hidden', part !== 'deck');
        $('mood-reel').classList.toggle('hidden', part !== 'reel');
        $('mood-pick').classList.toggle('hidden', part !== 'pick');
        UI.refreshHints();
    }

    function hints() {
        if (state.mode === 'picked') return [['OK', 'Open now'], ['◀', 'Spin again'], ['Back', 'Moods']];
        if (state.mode === 'spinning') return [['Back', 'Moods']];
        return [['◀', 'Nope'], ['▶ / OK', 'Yes'], ['Back', 'Home']];
    }

    function onKey(k) {
        if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) return false; // onBack
        if (state.mode === 'deck') {
            if (k === KEY.LEFT) nope();
            else if (k === KEY.RIGHT || k === KEY.ENTER) yes();
            return true;
        }
        if (state.mode === 'picked') {
            if (k === KEY.ENTER) open();
            else if (k === KEY.LEFT) spin();
            return true;
        }
        return true; // busy / spinning: swallow
    }

    function init() {
        UI.register('moods', {
            el: $('moods'),
            // opts.start: a mood chosen on Home; its card flies right and the reel spins at once.
            onShow: function (opts) {
                clearTimers();
                state.mode = 'deck';
                if (opts && opts.start !== undefined) state.index = opts.start;
                else refreshOrder();
                show('deck');
                renderDeck();
                if (opts && opts.start !== undefined) later(yes, 180);
            },
            onKey: onKey,
            onBack: function () {
                if (state.mode === 'deck') return false;   // leave to Home
                backToDeck();
                return true;
            },
            hints: hints
        });
    }

    // Home's row: one card per mood, a fan of its titles held up. OK goes straight to the spin.
    function renderHome(row) {
        refreshOrder();
        row.innerHTML = '';
        moods().forEach(function (m, i) {
            var wrap = el('div', 'mood-tile');
            var card = el('div', 'mood-tile-card');
            card.style.setProperty('--mood-c', m.color);
            var fan = el('div', 'mood-fan');
            titlesFor(m).slice(0, 3).forEach(function (t, k, all) {
                fan.appendChild(poster(t, 'fan fan' + (all.length === 3 ? k : k + 1)));
            });
            card.appendChild(fan);
            card.appendChild(el('div', 'mood-tile-name', m.name));
            card.appendChild(el('div', 'mood-tile-line', m.line));
            wrap.appendChild(card);
            wrap._item = { kind: 'mood', index: i };
            row.appendChild(wrap);
        });
        return row.children.length;
    }

    window.Moods = { init: init, renderHome: renderHome, titlesFor: titlesFor };
})();
