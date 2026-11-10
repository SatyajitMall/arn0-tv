/*
 * Weather for the screen saver, from Open-Meteo. No API key, free for non-commercial use.
 *
 * Coordinates come from js/config.js and default to null, which disables the widget entirely.
 * They are not a Settings page: the TV does not move, and nobody types coordinates with a remote.
 *
 * There is no polling. A TV launcher spends most of its life in the background with JavaScript
 * paused, so a timer would be both useless and rude; instead the reading is refreshed when
 * something is about to show it, and never more than once an hour. The last reading is cached in
 * localStorage so the screen saver opens with real numbers rather than a blank corner, even after
 * the TV has been off.
 */
(function () {
    'use strict';

    var STORE_KEY = 'arn0.weather.v2';   // v2: one reading per place
    var ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
    var FRESH_MS = 60 * 60 * 1000;          // inside the hour, the cached reading will do
    var USABLE_MS = 3 * 60 * 60 * 1000;     // older than this counts as no reading at all
    var TIMEOUT_MS = 8000;
    var RETRY_MS = 10 * 60 * 1000;          // quiet period after a failed attempt

    /*
     * Open-Meteo returns 25 WMO codes. They collapse to the eight that are worth a different
     * icon at a glance from a sofa — on a screen saver nobody needs "depositing rime fog".
     */
    function group(code) {
        if (code <= 1) return 'clear';
        if (code <= 3) return 'cloudy';
        if (code <= 48) return 'fog';
        if (code <= 57) return 'drizzle';
        if (code <= 67) return 'rain';
        if (code <= 77) return 'snow';
        if (code <= 84) return 'showers';
        if (code <= 86) return 'snow';
        return 'storm';
    }

    // Translated for the same locales as the date, so the corner does not mix languages.
    var LABELS = {
        'en-GB': {
            clear: 'Clear', cloudy: 'Cloudy', fog: 'Fog', drizzle: 'Drizzle',
            rain: 'Rain', showers: 'Showers', snow: 'Snow', storm: 'Thunderstorm'
        },
        'es-ES': {
            clear: 'Despejado', cloudy: 'Nublado', fog: 'Niebla', drizzle: 'Llovizna',
            rain: 'Lluvia', showers: 'Chubascos', snow: 'Nieve', storm: 'Tormenta'
        },
        'fr-FR': {
            clear: 'Dégagé', cloudy: 'Nuageux', fog: 'Brouillard', drizzle: 'Bruine',
            rain: 'Pluie', showers: 'Averses', snow: 'Neige', storm: 'Orage'
        }
    };

    /*
     * Stroke icons in the same style as the gear on Home: 24x24, no fill, round caps. A shared
     * cloud outline with different marks under it, so eight states cost one shape and a line each.
     */
    var CLOUD = 'M7.5 18.5h9a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.5-1A3.75 3.75 0 0 0 7.5 18.5z';
    // Centred on 12,13 so it sits at the same height as the cloud in the other seven.
    var SUN = '<circle cx="12" cy="13" r="3.8"/>' +
        '<path d="M12 7.8V5.6M12 18.2v2.2M6.8 13H4.6M17.2 13h2.2' +
        'M9.3 10.3L7.1 8.1M14.7 15.7l2.2 2.2M14.7 10.3l2.2-2.2M9.3 15.7L7.1 17.9"/>';

    var ICONS = {
        clear: SUN,
        cloudy: '<path d="' + CLOUD + '"/>',
        fog: '<path d="' + CLOUD + '"/><path d="M5 21h5M14 21h5"/>',
        drizzle: '<path d="' + CLOUD + '"/><path d="M10 21v1M14 21v1"/>',
        rain: '<path d="' + CLOUD + '"/><path d="M9 20.5v2.5M12.5 20.5v2.5M16 20.5v2.5"/>',
        showers: '<path d="' + CLOUD + '"/><path d="M9.5 20.5L8 23M13 20.5L11.5 23M16.5 20.5L15 23"/>',
        snow: '<path d="' + CLOUD + '"/><path d="M9 21.5h.01M12.5 22.5h.01M16 21.5h.01"/>',
        storm: '<path d="' + CLOUD + '"/><path d="M13 19.5l-3 3.5h4l-2.5 3"/>'
    };

    function icon(name) {
        return '<svg viewBox="0 0 24 26" fill="none" stroke="currentColor" stroke-width="1.6" ' +
            'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || ICONS.cloudy) +
            '</svg>';
    }

    // ---------- Configuration

    function cfg() {
        return (window.LAUNCHER_CONFIG && window.LAUNCHER_CONFIG.weather) || {};
    }

    // weather.places: [{ name, latitude, longitude }, ...], or the original single
    // weather.latitude / weather.longitude. The first place is the screen saver's.
    function places() {
        var c = cfg();
        var list = Array.isArray(c.places) ? c.places : [{ name: '', latitude: c.latitude, longitude: c.longitude }];
        return list.filter(function (p) { return typeof p.latitude === 'number' && typeof p.longitude === 'number'; });
    }

    function configured() {
        return places().length > 0;
    }

    // ---------- Cache

    var reading = null;
    var fetching = false;
    var lastFailure = 0;
    var listeners = [];

    function load() {
        try {
            reading = JSON.parse(localStorage.getItem(STORE_KEY));
        } catch (e) {
            reading = null;
        }
    }

    function store() {
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(reading));
        } catch (e) {
            // Without the cache we only lose the instant first paint.
        }
    }

    function age() {
        return reading && reading.at ? Date.now() - reading.at : Infinity;
    }

    /*
     * A stale reading is worse than none: an unattended screen showing yesterday's temperature as
     * if it were now is a confidently wrong answer, so past USABLE_MS the widget simply hides.
     */
    function describe(r, place) {
        var locale = Prefs.get().appearance.locale;
        var labels = LABELS[locale] || LABELS['en-GB'];
        var name = group(r.code);
        return {
            place: place ? place.name : '',
            temp: Math.round(r.temp) + '°',
            label: labels[name],
            detail: labels[name] + ' · ' + Math.round(r.max) + '° / ' + Math.round(r.min) + '°',
            icon: icon(name)
        };
    }

    function usable() {
        return configured() && reading && Array.isArray(reading.list) && age() <= USABLE_MS;
    }

    // The first place (screen saver corner).
    function current() {
        if (!usable() || !reading.list[0]) return null;
        return describe(reading.list[0], places()[0]);
    }

    // Every place with a reading (Home, next to the clock).
    function all() {
        if (!usable()) return [];
        var p = places();
        return reading.list.map(function (r, i) { return r && describe(r, p[i]); }).filter(Boolean);
    }

    // ---------- Fetching

    function url() {
        var c = cfg();
        var p = places();
        // Open-Meteo takes comma-separated coordinates and answers with one result per place.
        return ENDPOINT +
            '?latitude=' + p.map(function (x) { return encodeURIComponent(x.latitude); }).join(',') +
            '&longitude=' + p.map(function (x) { return encodeURIComponent(x.longitude); }).join(',') +
            '&current=temperature_2m,weather_code' +
            '&daily=temperature_2m_max,temperature_2m_min' +
            (c.unit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '') +
            '&timezone=auto';
    }

    function one(data) {
        var now = data && data.current;
        var day = data && data.daily;
        if (!now || !day || typeof now.temperature_2m !== 'number') return null;
        return {
            temp: now.temperature_2m,
            code: typeof now.weather_code === 'number' ? now.weather_code : 3,
            max: day.temperature_2m_max[0],
            min: day.temperature_2m_min[0]
        };
    }

    function accept(data) {
        var list = (Array.isArray(data) ? data : [data]).map(one);
        if (!list.length || !list[0]) return false;
        reading = { at: Date.now(), list: list };
        store();
        listeners.forEach(function (fn) { fn(); });
        return true;
    }

    /*
     * The hourly rule is keyed on the last *successful* reading, so on its own it does not slow
     * down retries: while the API is unreachable every trigger would ask again. This is the
     * backoff for that — a failed attempt buys ten minutes of quiet, which matters because the
     * triggers are things the viewer controls (opening the screen saver) rather than a timer.
     */
    function failed(why) {
        fetching = false;
        lastFailure = Date.now();
        DevLog.log('Weather: ' + why);
    }

    // force: ignore both rules (the Lab entry, so a test does not wait an hour).
    function refresh(force) {
        if (!configured() || fetching) return;
        if (!force && age() < FRESH_MS) return;
        if (!force && Date.now() - lastFailure < RETRY_MS) return;
        fetching = true;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url(), true);
        xhr.timeout = TIMEOUT_MS;
        xhr.onload = function () {
            var ok = false;
            try {
                ok = xhr.status >= 200 && xhr.status < 300 && accept(JSON.parse(xhr.responseText));
            } catch (e) {
                ok = false;
            }
            // Failure is silence: the widget keeps the cached reading, or stays hidden.
            if (ok) {
                fetching = false;
                lastFailure = 0;
            } else {
                failed('unusable response (HTTP ' + xhr.status + ')');
            }
        };
        xhr.onerror = function () { failed('request failed'); };
        xhr.ontimeout = function () { failed('request timed out'); };
        xhr.send();
    }

    function start() {
        load();
        if (!configured()) {
            DevLog.log('Weather off: set weather.places (or latitude/longitude) in js/config.js');
            return;
        }
        refresh();
    }

    window.Weather = {
        start: start,
        refresh: refresh,
        current: current,
        all: all,
        configured: configured,
        // Exposed so Home can reuse the same marks if weather ever moves there too.
        icon: icon,
        group: group,
        onUpdate: function (fn) { listeners.push(fn); },
        actions: function () {
            return [{
                label: 'Weather: fetch now and log the reading',
                run: function () {
                    if (!configured()) {
                        UI.toast('No coordinates in config.js');
                        return;
                    }
                    DevLog.log('Weather: requesting ' + url());
                    var once = function () {
                        DevLog.log('Weather: ' + JSON.stringify(reading));
                        UI.toast('Weather updated');
                    };
                    listeners.push(once);
                    refresh(true);
                }
            }];
        }
    };
})();
