import * as cheerio from 'cheerio';

// The UWI Seismic Research Centre (UWI-SRC) is the authoritative agency for
// earthquake and volcano monitoring in the English-speaking Eastern
// Caribbean — one region among the many this app now covers worldwide via
// USGS/EMSC, but still a valuable supplementary source for that region
// specifically. As of this writing they do NOT publish a documented public
// JSON/REST API for recent earthquakes — only an RSS feed for their news
// section, and an interactive map app at https://map.uwiseismic.com.
//
// This module makes a best-effort attempt to scrape the public
// earthquake-monitoring page as a supplementary source. IMPORTANT: this
// was written without the ability to fetch uwiseismic.com from the build
// environment (network egress was restricted there), so the selectors
// below are a reasonable guess based on typical listing/table markup and
// have NOT been verified against the live page. Treat this as a starting
// point:
//   1. Inspect the live HTML at UWI_MONITORING_URL in a browser devtools.
//   2. Update the selectors in parseUwiRow()/fetchUwiEarthquakes() to match.
//   3. If UWI-SRC offers (or you obtain) a real data feed/API, replace this
//      scraper with a direct fetch — that will always be more robust.
//
// The rest of the app does not depend on this source working: it fails
// soft (returns an empty array on any error) so USGS + EMSC data always
// keeps the tracker functional, and the frontend links directly to UWI's
// own live map as an authoritative fallback for Eastern Caribbean users.
const UWI_MONITORING_URL = 'https://uwiseismic.com/earthquakes/earthquake-monitoring/';

export async function fetchUwiEarthquakes() {
  try {
    const response = await fetch(UWI_MONITORING_URL, {
      signal: AbortSignal.timeout(10000),
      headers: {
        'User-Agent': 'WorldQuakeWatch/1.0 (+https://uwiseismic.com)',
      },
    });
    if (!response.ok) {
      console.warn(`[uwi] non-OK response: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const results = [];

    $('table tr').each((_, row) => {
      const cells = $(row)
        .find('td')
        .map((__, cell) => $(cell).text().trim())
        .get();
      if (cells.length < 3) return;

      const parsed = parseUwiRow(cells);
      if (parsed) results.push(parsed);
    });

    if (results.length === 0) {
      console.warn(
        '[uwi] scraper found no matching rows — page markup likely changed; see server/lib/sources/uwi.js'
      );
    }

    return results;
  } catch (error) {
    console.warn(`[uwi] source unavailable: ${error.message}`);
    return [];
  }
}

function parseUwiRow(cells) {
  const dateCell = cells.find((c) => /\d{4}[-/]\d{2}[-/]\d{2}/.test(c));
  const magCell = cells.find((c) => /^\d(\.\d)?$/.test(c.trim()));
  const depthCell = cells.find((c) => /km/i.test(c));
  const locationCell = cells.find(
    (c) => /[A-Za-z]{3,}/.test(c) && c !== dateCell && c !== depthCell
  );

  if (!dateCell || !magCell) return null;

  const normalizedDate = dateCell.replace('/', '-').replace(' ', 'T');
  const time = new Date(normalizedDate.endsWith('Z') ? normalizedDate : `${normalizedDate}Z`);
  if (Number.isNaN(time.getTime())) return null;

  return {
    id: `uwi-${dateCell}-${magCell}-${locationCell ?? ''}`.replace(/\s+/g, '-'),
    source: 'UWI-SRC',
    time: time.toISOString(),
    magnitude: Number.parseFloat(magCell),
    magType: null,
    depthKm: depthCell ? Number.parseFloat(depthCell) : null,
    // UWI's listing page is not guaranteed to include coordinates, so these
    // events may be map-invisible but still show up in the list/table.
    lat: null,
    lon: null,
    place: locationCell ?? 'Eastern Caribbean',
    url: UWI_MONITORING_URL,
    tsunami: false,
    felt: null,
    status: 'reviewed',
  };
}
