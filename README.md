# World Quake Watch

A real-time worldwide dashboard for earthquake and seismic activity. An
Express backend aggregates multiple public seismic data sources,
deduplicates events reported by more than one network, and serves them to a
Leaflet map + list frontend that auto-refreshes.

## Data sources

| Source | Coverage | Access method |
| --- | --- | --- |
| [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | Global | Public FDSNWS GeoJSON API (no auth, CORS-enabled) |
| [EMSC](https://www.emsc-csem.org/) (seismicportal.eu) | Global, independent detection network — good cross-check against USGS | Public FDSNWS JSON API (no auth) |
| [UWI Seismic Research Centre](https://uwiseismic.com/) | Supplementary — authoritative specifically for the Eastern Caribbean (Lesser Antilles, Trinidad & Tobago) | **Best-effort HTML scrape** — see caveat below |

### Important caveat about UWI-SRC

UWI-SRC does not currently publish a documented public JSON/REST API for
recent earthquakes (only an RSS feed for their news section).
`server/lib/sources/uwi.js` makes a best-effort attempt to scrape their
public earthquake-monitoring page, but it was written without the ability
to fetch `uwiseismic.com` from the development sandbox this project was
built in, so **the CSS selectors have not been verified against the live
page** and may need adjusting. It fails soft — if scraping doesn't return
results, the app keeps working fine on USGS + EMSC alone, and the footer
links directly to UWI's own [live interactive map](https://map.uwiseismic.com/)
as the authoritative source for the Eastern Caribbean.

To fix/verify it:
1. Open `https://uwiseismic.com/earthquakes/earthquake-monitoring/` in a
   browser and inspect the markup for the recent-earthquakes listing.
2. Update the selectors/parsing logic in `parseUwiRow()` in
   `server/lib/sources/uwi.js` to match.
3. If UWI-SRC ever offers a real data feed, swap this scraper for a direct
   fetch — it'll be far more reliable.

## Architecture

```
server/
  index.js              Express app entrypoint, serves /public and /api
  routes/
    earthquakes.js       GET /api/earthquakes — orchestrates + caches
    push.js               Push subscribe/unsubscribe/vapid-key/check endpoints
  lib/
    aggregate.js          Shared fetch+merge, used by the route and the notifier
    cache.js             In-memory TTL cache (avoids hammering upstream APIs)
    geo.js               Haversine distance for dedup
    merge.js             Cross-source dedup (time + distance + magnitude window)
    push.js               Web Push subscription storage + sending
    notifier.js           Detects newly-appeared earthquakes, triggers pushes
    sources/
      usgs.js
      emsc.js
      uwi.js
  data/                  Push subscriptions (gitignored, created at runtime)
public/
  index.html             Dashboard shell
  css/style.css
  js/app.js               Leaflet map, list rendering, filters, auto-refresh, alerts
  sw.js                   Service worker — shows push notifications
  manifest.json           PWA manifest (needed for push to work on iOS)
```

### API

`GET /api/earthquakes?days=7&minMagnitude=2`

```json
{
  "generatedAt": "2026-08-10T12:00:00.000Z",
  "region": "Worldwide",
  "filters": { "days": 7, "minMagnitude": 2 },
  "counts": { "usgs": 42, "emsc": 40, "uwi": 0, "merged": 45 },
  "sourceErrors": [],
  "earthquakes": [
    {
      "id": "usgs-us7000abcd",
      "source": "USGS",
      "sources": ["USGS", "EMSC"],
      "time": "2026-08-10T11:52:00.000Z",
      "magnitude": 4.6,
      "magType": "mb",
      "depthKm": 32.1,
      "lat": 18.2,
      "lon": -68.4,
      "place": "45 km N of Punta Cana, Dominican Republic",
      "url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000abcd",
      "tsunami": false,
      "felt": 12,
      "status": "reviewed"
    }
  ]
}
```

Events reported by multiple sources are merged into one entry; `sources`
lists every network that reported it, while the top-level fields come from
the highest-priority source (USGS > EMSC > UWI-SRC).

## Running locally

```bash
npm install
npm start        # http://localhost:3000
# or, for auto-restart on file changes:
npm run dev
```

Configuration (optional, via `.env` or environment variables — see
`.env.example`):

- `PORT` — server port (default `3000`)
- `CACHE_TTL_MS` — how long aggregated results are cached before re-fetching
  upstream sources (default `60000`)
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` — enable push
  notifications (see below). Leave unset to disable the feature entirely —
  the site works fine without it.
- `CRON_SECRET` — shared secret required to call `POST /api/push/check`
  (see below).

## Push notifications

Visitors can tap **Enable alerts**, pick a magnitude threshold, and get a
phone notification when a new earthquake at or above that threshold shows
up — even with the site closed, as long as their browser is running.

### One-time setup

1. Generate a VAPID keypair: `npx web-push generate-vapid-keys`
2. Set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`
   (`mailto:you@example.com`) as environment variables — locally in `.env`,
   and on Render under the service's **Environment** tab.
3. Generate a random `CRON_SECRET` (e.g. `openssl rand -hex 32`) and set it
   the same way.
4. Set up a free external scheduler to hit the check endpoint every few
   minutes — e.g. [cron-job.org](https://cron-job.org) (free): create a job
   that sends `POST https://<your-app>.onrender.com/api/push/check` with
   header `X-Cron-Secret: <your CRON_SECRET>` every 5 minutes.

### Why an external scheduler, not just a timer in the app

The app *does* also poll internally every 5 minutes on its own — but
Render's free tier suspends the whole process after 15 minutes with no
incoming HTTP traffic, which stops that timer along with everything else.
The external scheduler both wakes the app back up and reliably triggers the
check, regardless of Render's sleep behavior. On a paid Render plan (no
sleep) the external scheduler is optional but still a good redundancy.

### Two things worth knowing

- **iPhone/iPad**: Apple only allows web push for sites added to the Home
  Screen (Share → Add to Home Screen), not for Safari tabs directly. This
  is an iOS platform restriction, not something this app can work around.
  Android and desktop browsers support it directly, no install needed.
- **Subscriptions aren't durably stored on Render's free tier**: they're
  saved to a local file (`server/data/subscriptions.json`), which is wiped
  on every redeploy and on every free-tier spin-down/spin-up cycle. Anyone
  subscribed will need to tap "Enable alerts" again after either of those.
  For durable subscriptions, either move to a Render plan with a
  [persistent disk](https://render.com/docs/disks), or swap the file
  storage in `server/lib/push.js` for a small external database.

## Customizing

- **Restrict to a region**: the app queries USGS/EMSC worldwide by default.
  To scope it back down, add `minlatitude`/`maxlatitude`/`minlongitude`/
  `maxlongitude` params in `server/lib/sources/usgs.js` and
  `minlat`/`maxlat`/`minlon`/`maxlon` in `server/lib/sources/emsc.js`.
- **Dedup sensitivity**: tune `TIME_WINDOW_MS`, `DISTANCE_WINDOW_KM`, and
  `MAGNITUDE_WINDOW` in `server/lib/merge.js`.
- **Default filters**: change the defaults in `public/index.html`'s
  `#mag-filter`/`#days-filter` and in `server/routes/earthquakes.js`. The
  magnitude default is set higher than a regional tracker would use (M4.0+)
  since a worldwide feed at low magnitudes returns a lot of events.

## Disclaimer

This tool aggregates public seismic data for situational awareness. It is
not an official earthquake or tsunami alerting system. In an emergency,
follow guidance from your national or local disaster management agency
(for the Eastern Caribbean specifically: ODPM, NEMO, CDEMA, or UWI-SRC
directly).
