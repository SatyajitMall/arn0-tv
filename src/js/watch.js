/*
 * What you actually watch, from the three free signals there are:
 *
 *   sessions   which app was open and for how long. From tizen.application's app status listener
 *              when the TV delivers it (that covers apps opened from Samsung Home too); otherwise
 *              from "launched X from here, came back N minutes later".
 *   pins       a show you opened from this launcher (My Shows, Favourites, moods): kept for
 *              Continue, with the minutes spent in its app afterwards.
 *   history    your Netflix viewing activity, imported on the Mac by scripts/import-netflix.mjs
 *              into js/history.local.js (gitignored).
 *
 * The Continue row on Home is pins and history merged, newest first. Sessions also feed the habit
 * learning (js/usage.js, kind 'watch', weighted by minutes) so the app you spend evenings in rises.
 *
 * Everything stays on the TV (localStorage). Settings > Advanced > Forget my habits clears it.
 */
(function () {
    'use strict';

    var STORE = 'arn0.watch.v1';
    var MAX_SESSIONS = 300;
    var MAX_PINS = 40;
    var MIN_SESSION_MS = 2 * 60 * 1000;      // shorter is browsing, not watching
    var MAX_SESSION_MS = 6 * 60 * 60 * 1000; // longer means the TV slept with the app open
    var PIN_DAYS = 21;
    var HISTORY_DAYS = 60;
    var DAY = 86400000;

    var log = function (m) { if (window.DevLog) DevLog.log(m); };

    function load() {
        try {
            var v = JSON.parse(localStorage.getItem(STORE));
            if (v && Array.isArray(v.sessions) && Array.isArray(v.pins)) return v;
        } catch (e) { /* fresh start */ }
        return { sessions: [], pins: [] };
    }

    var data = load();

    function save() {
        try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) { /* pauses */ }
    }

    function selfId() {
        try { return tizen.application.getCurrentApplication().appInfo.id; } catch (e) { return null; }
    }

    // ---------- sessions

    var open = {};          // appId -> start time, from the status listener
    var pending = null;     // { id, t, title } the app we just launched
    var listener = { id: null, events: 0, error: null };

    function addSession(id, start, end, via) {
        var ms = end - start;
        if (!id || id === selfId() || ms < MIN_SESSION_MS) return;
        if (ms > MAX_SESSION_MS) ms = MAX_SESSION_MS;
        var s = { id: id, t: start, ms: ms, via: via };
        data.sessions.push(s);
        if (data.sessions.length > MAX_SESSIONS) data.sessions = data.sessions.slice(-MAX_SESSIONS);
        // A pin opened just before this session gets its minutes.
        if (pending && pending.id === id && pending.title && Math.abs(pending.t - start) < 5 * 60000) {
            var p = findPin(pending.title);
            if (p) p.mins = (p.mins || 0) + Math.round(ms / 60000);
        }
        save();
        // Habit learning: one 'watch' event per session, worth more the longer it ran.
        if (window.Usage) Usage.record('watch', id, Math.max(0.3, Math.min(3, ms / (20 * 60000))));
        log('watch: ' + id + ' ' + Math.round(ms / 60000) + ' min (' + via + ')');
    }

    function onStatus(appId, isActive) {
        listener.events++;
        if (listener.events <= 40) log('watch: status ' + appId + (isActive ? ' active' : ' inactive'));
        if (!appId || appId === selfId()) return;
        var now = Date.now();
        if (isActive) {
            open[appId] = now;
        } else if (open[appId]) {
            addSession(appId, open[appId], now, 'listener');
            delete open[appId];
            if (pending && pending.id === appId) pending.done = true;
        }
    }

    function startListener() {
        try {
            var a = window.tizen && tizen.application;
            if (!a || typeof a.addAppStatusChangeListener !== 'function') {
                listener.error = 'not available';
                return;
            }
            listener.id = a.addAppStatusChangeListener(onStatus);
            log('watch: app status listener on (' + listener.id + ')');
        } catch (e) {
            listener.error = (e && (e.name + ': ' + e.message)) || String(e);
            log('watch: app status listener failed: ' + listener.error);
        }
    }

    // Apps.launch calls this; title is set when a show card opened the app.
    function launched(id, title) {
        pending = { id: id, t: Date.now(), title: title || null, done: false };
    }

    // Back on the launcher: if the listener did not report the app we opened, time it ourselves.
    function resumed() {
        var now = Date.now();
        Object.keys(open).forEach(function (id) {   // anything the listener saw start but not stop
            addSession(id, open[id], now, 'listener-open');
            delete open[id];
        });
        if (pending && !pending.done) addSession(pending.id, pending.t, now, 'resume');
        pending = null;
    }

    // ---------- pins

    function findPin(title) {
        for (var i = 0; i < data.pins.length; i++) if (data.pins[i].title === title) return data.pins[i];
        return null;
    }

    function pin(title, app) {
        if (!title) return;
        var p = findPin(title);
        if (p) {
            data.pins.splice(data.pins.indexOf(p), 1);
        } else {
            p = { title: title, mins: 0 };
        }
        p.app = app;
        p.t = Date.now();
        data.pins.push(p);
        if (data.pins.length > MAX_PINS) data.pins = data.pins.slice(-MAX_PINS);
        save();
    }

    function unpin(title) {
        var p = findPin(title);
        if (p) { data.pins.splice(data.pins.indexOf(p), 1); save(); }
        hidden[title] = Date.now();
        try { localStorage.setItem(STORE + '.hidden', JSON.stringify(hidden)); } catch (e) { /* */ }
    }

    var hidden = (function () {
        try { return JSON.parse(localStorage.getItem(STORE + '.hidden')) || {}; } catch (e) { return {}; }
    })();

    // ---------- history (js/history.local.js)

    function history() {
        var h = window.WATCH_HISTORY;
        return (h && Array.isArray(h.shows)) ? h : null;
    }

    function historyShows() {
        var h = history();
        return h ? h.shows : [];
    }

    // ---------- Continue: pins and history, newest first, one card per title

    function continueList(max) {
        var now = Date.now();
        var byTitle = {};
        var out = [];
        function add(e) {
            // Removed from Continue: stays off until you open it again.
            if (hidden[e.title] && e.t <= hidden[e.title]) return;
            var prev = byTitle[e.title];
            if (prev) {
                // Keep the newer time; keep episode detail from history.
                if (e.t > prev.t) { prev.t = e.t; prev.app = e.app || prev.app; }
                prev.ep = prev.ep || e.ep;
                prev.at = prev.at || e.at;
                prev.mins = prev.mins || e.mins;
                return;
            }
            byTitle[e.title] = e;
            out.push(e);
        }
        data.pins.forEach(function (p) {
            if (now - p.t < PIN_DAYS * DAY) add({ title: p.title, app: p.app, t: p.t, mins: p.mins, pinned: true });
        });
        historyShows().forEach(function (s) {
            var t = Date.parse(s.last);
            if (s.type === 'film' || !t || now - t > HISTORY_DAYS * DAY) return;
            add({ title: s.title, app: s.app || 'netflix', t: t, ep: s.latest, at: s.bookmark, from: 'history' });
        });
        out.sort(function (a, b) { return b.t - a.t; });
        return out.slice(0, max || 8);
    }

    // Shows from the import, most watched lately first, for My Shows.
    function topShows(max) {
        var now = Date.now();
        return historyShows()
            .filter(function (s) { return s.type !== 'film'; })
            .map(function (s) {
                var age = (now - (Date.parse(s.last) || 0)) / DAY;
                return { s: s, w: (s.count || 1) * Math.pow(0.5, age / 45) };
            })
            .sort(function (a, b) { return b.w - a.w; })
            .slice(0, max || 6)
            .map(function (x) { return { title: x.s.title, app: x.s.app || 'netflix', from: 'history' }; });
    }

    // Minutes per app over the last `days`, for the Lab and Settings.
    function minutesByApp(days) {
        var since = Date.now() - (days || 7) * DAY;
        var m = {};
        data.sessions.forEach(function (s) {
            if (s.t >= since) m[s.id] = (m[s.id] || 0) + s.ms / 60000;
        });
        return m;
    }

    function lastSession(id) {
        for (var i = data.sessions.length - 1; i >= 0; i--) if (data.sessions[i].id === id) return data.sessions[i];
        return null;
    }

    // Lab: what the TV gives us here.
    function probe() {
        var lines = [];
        lines.push('listener: ' + (listener.id !== null ? 'on, ' + listener.events + ' events' : 'off (' + listener.error + ')'));
        lines.push('sessions stored: ' + data.sessions.length + ', pins: ' + data.pins.length +
            ', history: ' + (history() ? historyShows().length + ' titles (' + history().imported + ')' : 'none'));
        var by = { listener: 0, 'listener-open': 0, resume: 0 };
        data.sessions.forEach(function (s) { by[s.via] = (by[s.via] || 0) + 1; });
        lines.push('sessions by source: ' + JSON.stringify(by));
        return new Promise(function (resolve) {
            try {
                tizen.application.getAppsContext(function (ctx) {
                    lines.push('running apps: ' + ctx.map(function (c) { return c.appId; }).join(', '));
                    resolve(lines);
                }, function (e) {
                    lines.push('getAppsContext error: ' + (e && e.name) + ' ' + (e && e.message));
                    resolve(lines);
                });
            } catch (e) {
                lines.push('getAppsContext threw: ' + (e && e.message));
                resolve(lines);
            }
        });
    }

    function clear() {
        data = { sessions: [], pins: [] };
        hidden = {};
        save();
        try { localStorage.removeItem(STORE + '.hidden'); } catch (e) { /* */ }
    }

    function init() {
        startListener();
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) resumed();
        });
    }

    window.Watch = {
        init: init,
        launched: launched,
        pin: pin,
        unpin: unpin,
        continueList: continueList,
        topShows: topShows,
        minutesByApp: minutesByApp,
        lastSession: lastSession,
        hasHistory: function () { return !!history(); },
        probe: probe,
        clear: clear
    };
})();
