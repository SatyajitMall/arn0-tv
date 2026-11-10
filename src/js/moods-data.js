/*
 * "Don't have time to browse?" mood deck (js/moods.js). Edit freely: this is your list.
 *
 * apps:   short name -> Tizen app id (read from the TV: Lab > "Send installed app list to log",
 *         or the id shown at the bottom of All apps). Titles whose app is not installed are skipped.
 * moods:  name, one-line pitch, accent colour, and titles. A title opens its app; the TV apps do
 *         not take a "play this title" link from a web app, so the card tells you what to search.
 *         Optional per title: poster: 'img/moods/<file>.jpg' (your own image, 600x900).
 *
 * Catalogues change: these were on the listed Indian services as of late 2026. Swap in your own.
 */
window.MOOD_DATA = {
    apps: {
        netflix: { id: 'org.tizen.netflix-app', label: 'Netflix', color: '#e50914' },
        prime: { id: 'org.tizen.primevideo', label: 'Prime Video', color: '#1a98ff' },
        hotstar: { id: 'fiZNCxMH9Y.Hotstar', label: 'JioHotstar', color: '#1f4bff' },
        sonyliv: { id: 'EUKHUxrGQA.SonyLIV', label: 'SonyLIV', color: '#d9a400' },
        zee5: { id: 'wKDM33Rods.ZEE5', label: 'ZEE5', color: '#8230c6' },
        appletv: { id: 'com.samsung.tv.aria-video', label: 'Apple TV', color: '#9aa0a6' },
        hoichoi: { id: 'reAEEFwRi8.hoichoi', label: 'Hoichoi', color: '#ff3d3d' },
        spotify: { id: 'rJeHak5zRg.Spotify', label: 'Spotify', color: '#1db954' },
        youtube: { id: '9Ur5IzDKqV.TizenYouTube', label: 'YouTube', color: '#ff0033' }
    },

    moods: [
        {
            key: 'comfort', name: 'Comfort rewatch', line: 'Something warm you already love.', color: '#e8a64a',
            titles: [
                { title: 'Panchayat', app: 'prime' },
                { title: 'Gullak', app: 'sonyliv' },
                { title: 'Brooklyn Nine-Nine', app: 'netflix' },
                { title: 'Ted Lasso', app: 'appletv' },
                { title: 'Kota Factory', app: 'netflix' }
            ]
        },
        {
            key: 'edge', name: 'Edge of your seat', line: 'Crime, chases, one more episode.', color: '#e0483c',
            titles: [
                { title: 'Sacred Games', app: 'netflix' },
                { title: 'Paatal Lok', app: 'prime' },
                { title: 'Scam 1992', app: 'sonyliv' },
                { title: 'Delhi Crime', app: 'netflix' },
                { title: 'Special Ops', app: 'hotstar' }
            ]
        },
        {
            key: 'night', name: 'After dark', line: 'Rain on the window, lights off.', color: '#ffd34d',
            titles: [
                { title: 'Dark', app: 'netflix' },
                { title: 'Asur', app: 'hotstar' },
                { title: 'Severance', app: 'appletv' },
                { title: 'Stranger Things', app: 'netflix' },
                { title: 'Byomkesh', app: 'hoichoi' }
            ]
        },
        {
            key: 'laugh', name: 'Laugh out loud', line: 'Zero effort, maximum giggles.', color: '#4ad991',
            titles: [
                { title: 'TVF Pitchers', app: 'zee5' },
                { title: 'Brooklyn Nine-Nine', app: 'netflix' },
                { title: 'Gullak', app: 'sonyliv' },
                { title: 'Laapataa Ladies', app: 'netflix' }
            ]
        },
        {
            key: 'mass', name: 'Big-screen mass', line: 'Whistles, slow-mo, full volume.', color: '#ff7a2e',
            titles: [
                { title: 'RRR', app: 'netflix' },
                { title: 'Jawan', app: 'netflix' },
                { title: 'Rocket Boys', app: 'sonyliv' }
            ]
        },
        {
            key: 'bangla', name: 'Bangla night', line: 'Detectives, drama, adda.', color: '#c86bff',
            titles: [
                { title: 'Byomkesh', app: 'hoichoi' },
                { title: 'Mandaar', app: 'hoichoi' },
                { title: 'Taqdeer', app: 'hoichoi' }
            ]
        },
        {
            key: 'music', name: 'Just music', line: 'Lights low, something playing.', color: '#1db954',
            titles: [
                { title: 'Your Daily Mix', app: 'spotify' },
                { title: 'Lo-fi beats live', app: 'youtube' }
            ]
        },
        // Special: spins through every title above.
        { key: 'any', name: 'Anything at all', line: 'Let the deck decide.', color: '#9fb3c8', any: true, titles: [] }
    ]
};
