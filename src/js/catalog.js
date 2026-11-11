/*
 * Posters, backdrops, faces and "where it streams in India" for the titles the launcher knows,
 * fetched on the Mac from TMDB by scripts/fetch-catalog.mjs into js/catalog.local.js and
 * img/catalog/ (both gitignored: the artwork belongs to its owners and stays on your TV).
 * Without that file everything falls back to the graded photos.
 *
 * This product uses the TMDB API but is not endorsed or certified by TMDB.
 */
(function () {
    'use strict';

    var C = window.CATALOG || { titles: {}, faces: {} };

    function slug(s) {
        return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function title(name) {
        return (C.titles && C.titles[slug(name)]) || null;
    }

    function face(name, show) {
        return (C.faces && C.faces[slug(show + ' ' + name)]) || null;
    }

    // The service a title is on: the configured one if TMDB lists it there (or TMDB has no data),
    // otherwise the first service TMDB lists that is in the app list.
    function appFor(name, app) {
        var e = title(name);
        if (!e || !e.on || !e.on.length || e.on.indexOf(app) >= 0) return app;
        return e.on[0];
    }

    window.Catalog = { slug: slug, title: title, face: face, appFor: appFor, loaded: !!window.CATALOG };
})();
