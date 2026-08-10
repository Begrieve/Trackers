# Caribbean Earthquake Tracker

A real-time dashboard for earthquake and seismic activity across the
Caribbean basin. An Express backend aggregates multiple public seismic data
sources, deduplicates events reported by more than one network, and serves
them to a Leaflet map + list frontend that auto-refreshes.

## Data sources

| Source | Coverage | Access method |
| --- | --- | --- |
| [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/) | Global, including full Caribbean | Public FDSNWS GeoJSON API (no auth, CORS-enabled) |
| [EMSC](https://www.emsc-csem.org/) (seismicportal.eu) | Global, independent detection network — good cross-check against USGS | Public FDSNWS JSON API (no auth) |
| [UWI Seismic Research Centre](https://uwiseismic.com/) | Authoritative for the Eastern Caribbean (Lesser Antilles, Trinidad & Tobago) | **Best-effort HTML scrape** — see caveat below |

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
  routes/earthquakes.js  GET /api/earthquakes — orchestrates + caches
  lib/
    region.js            Caribbean bounding box
    cache.js             In-memory TTL cache (avoids hammering upstream APIs)
    geo.js               Haversine distance for dedup
    merge.js             Cross-source dedup (time + distance + magnitude window)
    sources/
      usgs.js
      emsc.js
      uwi.js
public/
  index.html             Dashboard shell
  css/style.css
  js/app.js               Leaflet map, list rendering, filters, auto-refresh
```

### API

`GET /api/earthquakes?days=7&minMagnitude=2`

```json
{
  "generatedAt": "2026-08-10T12:00:00.000Z",
  "region": "Caribbean",
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

## Customizing

- **Region**: adjust the bounding box in `server/lib/region.js`.
- **Dedup sensitivity**: tune `TIME_WINDOW_MS`, `DISTANCE_WINDOW_KM`, and
  `MAGNITUDE_WINDOW` in `server/lib/merge.js`.
- **Default filters**: change the defaults in `public/index.html`'s
  `#mag-filter`/`#days-filter` and in `server/routes/earthquakes.js`.

## Disclaimer

This tool aggregates public seismic data for situational awareness. It is
not an official earthquake or tsunami alerting system. In an emergency,
follow guidance from your national disaster management agency (e.g. ODPM,
NEMO, CDEMA) or UWI-SRC directly.
