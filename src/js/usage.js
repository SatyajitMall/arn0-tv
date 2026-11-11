/*
 * Learns your habits from what you do in this launcher, and nothing else: which apps you open
 * and when, which moods you say yes or no to, which shows and favourites you pick. The TV gives
 * a web app no access to watch history inside Netflix and the rest, so this is the signal there is.
 *
 * Kept on the TV (localStorage, the last MAX events). Settings > Advanced > Forget my habits clears it.
 *
 * A score is a sum over matching events, each weighted by
 *   recency      halves every HALF_LIFE days
 *   time of day  closeness to the current hour (Gaussian, sigma SIGMA_H hours)
 *   day type     a weekday event counts less on a weekend and the other way round
 * so "Hoichoi at 10 pm on Saturdays" ranks Hoichoi first late on a Saturday, not on a Monday morning.
 */
(function () {
    'use strict';

    var STORE = 'arn0.usage.v1';
    var MAX = 600;
    var HALF_LIFE = 21;   // days
    var SIGMA_H = 2;      // hours
    var DAY = 86400000;

    function load() {
        try {
            var v = JSON.parse(localStorage.getItem(STORE));
            return Array.isArray(v) ? v : [];
        } catch (e) {
            return [];
        }
    }

    var events = load();

    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(events)); } catch (e) { /* learning just pauses */ }
    }

    function record(kind, id) {
        if (!id) return;
        events.push({ t: Date.now(), k: kind, id: String(id) });
        if (events.length > MAX) events = events.slice(-MAX);
        save();
    }

    function weekend(d) {
        var w = d.getDay();
        return w === 0 || w === 6;
    }

    function hours(d) { return d.getHours() + d.getMinutes() / 60; }

    function score(kind, id, now) {
        now = now || new Date();
        var h = hours(now);
        var we = weekend(now);
        var s = 0;
        id = String(id);
        for (var i = 0; i < events.length; i++) {
            var e = events[i];
            if (e.k !== kind || e.id !== id) continue;
            var d = new Date(e.t);
            var age = (now - d) / DAY;
            var dh = Math.abs(hours(d) - h);
            dh = Math.min(dh, 24 - dh);
            var tod = Math.exp(-(dh * dh) / (2 * SIGMA_H * SIGMA_H));
            s += Math.pow(0.5, age / HALF_LIFE) * (0.25 + 0.75 * tod) * (weekend(d) === we ? 1 : 0.6);
        }
        return s;
    }

    // Items sorted by fn(item) score, highest first; ties keep their given order.
    function rank(items, fn) {
        return items.map(function (item, i) { return { item: item, i: i, s: fn(item) }; })
            .sort(function (a, b) { return b.s - a.s || a.i - b.i; })
            .map(function (x) { return x.item; });
    }

    // The app you usually open around now, if the habit is strong enough to act on.
    var USUAL = 1.2;
    function usualApp(ids, now) {
        var best = null;
        var bestScore = USUAL;
        ids.forEach(function (id) {
            var s = score('app', id, now);
            if (s > bestScore) { best = id; bestScore = s; }
        });
        return best;
    }

    function clear() {
        events = [];
        save();
    }

    window.Usage = {
        record: record,
        score: score,
        rank: rank,
        usualApp: usualApp,
        clear: clear,
        count: function () { return events.length; }
    };
})();
