# Power-on, Home button and live viewing data: research and plan

Researched 2026-11-12 for the living-room TV (UA43DUE76AKLXL, 2024). A read-only debug-port check
reports **Tizen 9.0**, Developer Mode on. The Samsung public certificate is valid 2026-11-11 to
2027-11-11. Sources are listed at the end.

## 1. Making the TV open on the launcher

| Route | What it covers | Risk | Verdict |
|---|---|---|---|
| **Autorun Last App** (Settings > All Settings > General & Privacy > Start Screen Options; older menus: General > Smart Features). Also turn off "Start with Smart Hub Home". | Power-on reopens the last app if it was the launcher | None, it is a Samsung toggle | **Do this.** Samsung says it "may not be supported depending on the app", so test both a quick off/on and a mains-unplug cold boot. |
| Pin the launcher first in the Smart Hub app row | Home, then OK, opens it | None | **Do this as well** |
| arn0-tv Home override (`db/appfw/home_appid`, `main` app-control operation) | Home button | High on Tizen 9 | **Not viable.** It needs a shell on the TV. `sdb shell` is closed on retail sets, and the only known way in on Tizen 9 is a security exploit (SVE-2025-50109). The helper is also firmware-locked to a Tizen 6.5 Q70B. |
| Web-app autostart (`on-boot`, `prelaunch`, config.xml metadata) | Power-on | n/a | Does not exist for web apps on 2019 and later TVs |

The launcher should come back cleanly when the TV resumes from instant-on. It already refreshes the
clock, weather and inputs on `visibilitychange`.

## 2. Why Samsung's Home has "Continue watching" and we cannot read it

- **Each partner app writes its own rows.** Smart Hub Preview is write-only, per app. Netflix and
  the others publish their own tiles, either from a server JSON or with
  `webapis.preview.setPreviewData`. There is no API to read another app's tiles.
- **Samsung's server-side rows are closed.** "Continue Playing", Universal Guide and For You come from
  partner-to-Samsung server feeds under contract. There is no consumer or third-party read API.
- **The TV's own databases are out of reach.** Without a shell, reading Smart Hub's databases on the
  TV is impossible, and Samsung's security labels block it even with code execution.
- **No now-playing API.** No Tizen web API reports another app's title or playback position.

## 3. What can be live, and from where

| Signal | Source | Freshness | Cost / effort |
|---|---|---|---|
| Which app is open and for how long, including apps opened from Samsung Home | `tizen.application.addAppStatusChangeListener` plus `getAppsContext` on the TV (privilege we already have; needs a probe on this TV) | Live | Build |
| Netflix, Prime Video, Apple TV+ history and **continue watching** | **Trakt.tv VIP Streaming Scrobbler** syncs from the service accounts; the launcher reads Trakt `/sync/playback`, `/sync/history` and `/sync/watchlist` directly over HTTPS. Trakt IDs map to TMDB. | Minutes to hours | About $60 a year; India accounts unverified |
| Netflix history (free) | Viewing activity CSV (Account > Profile > Viewing activity > Download all), imported on the Mac | Whenever downloaded | 1 minute, manual |
| Prime, Apple, YouTube history (free) | Amazon "Request your data", privacy.apple.com, Google Takeout | Days, one-off | Manual |
| Spotify now playing and recently played | Spotify Web API (since Feb 2026, the app owner needs Premium) | Live | Build |
| JioHotstar, Hoichoi, SonyLIV, ZEE5 | No API or export exists. The launcher's own app timing, plus a "Continue" pin on any show card | Live (app level) | Build |

Not recommended: scraping Netflix's or Prime's private web endpoints with saved login cookies. It
breaks often, it is against their terms, and it means storing your session on disk.

## 4. Plan

1. **You:** turn on Autorun Last App, turn off Start with Smart Hub Home, and pin the launcher
   first. Test a cold boot.
2. **Probe (Lab):** check on this TV whether `addAppStatusChangeListener` and `getAppsContext`
   work. If they do, learn from real app sessions (which app, when, how long), not only launches
   from the launcher.
3. **Netflix import:** `npm run import-netflix <csv>` fills My Shows with what you actually watch
   (latest episode, how often, last watched) and feeds the habit learning.
4. **Trakt** (only if you take VIP): connect once with a device code, then the launcher polls Trakt
   every 15 minutes for a "Continue watching" row with episode and progress, plus "Recently
   watched".
5. **Spotify** (optional, needs Premium): a "Now playing / recently played" tile.
6. **Pins:** a "Continue" pin for the services with no data.

## 5. Built (free path), 2026-11-12

- `src/js/watch.js`: app sessions, Continue pins, imported history. Continue row on Home (first
  section below the dock). Red on a Continue card removes it until you open that show again.
- Sessions feed habit learning as `watch` events weighted by minutes (`src/js/usage.js`).
- `npm run import-netflix -- <csv|zip> [--profile NAME]` writes `src/js/history.local.js`
  (gitignored); `npm run catalog` then fetches artwork for those titles.
- **Probe result on this TV (Tizen 9):** `addAppStatusChangeListener` registers without error but
  delivered no events when YouTube was opened and closed (the launcher is suspended while hidden).
  So viewing time is measured only for apps opened from the launcher (launch to return). Apps
  opened from Samsung Home are not seen.

## Sources

- Samsung, Start Screen Options / Autorun Last App: https://www.samsung.com/au/support/tv-audio-video/use-autorun-start-screen-options-on-your-samsung-tv/
- Smart Hub Preview (write-only, per app): https://developer.samsung.com/smarttv/develop/guides/smart-hub-preview/implementing-personal-preview.html
- Samsung partner data platform (Continue Playing is partner-tier): https://developer.samsung.com/smarttv/develop/ai-tv-platform-standards/data-platform-integration.html
- Prelaunch unsupported since 2019: https://developer.samsung.com/smarttv/develop/guides/fundamentals/prelaunching-applications.html
- Tizen Application API: https://developer.samsung.com/smarttv/develop/api-references/tizen-web-device-api-references/application-api.html
- sdb shell closed on retail TVs: https://forum.developer.samsung.com/t/unable-to-sdb-shell-permission-restriction/38748
- Tizen 9 security research (why the Home override is out): https://bishopfox.com/blog/samsung-tizen-os-version-through-9-0
- SmartThings tvChannelName unreliable: https://community.smartthings.com/t/title-samsung-tv-tvchannelname-stopped-reporting-the-currently-running-app/311123
- Trakt Streaming Scrobbler: https://prnewswire.com/news-releases/trakt-partners-with-younify-to-launch-its-streaming-scrobbler-302324174.html
- Spotify 2026 developer changes: https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
