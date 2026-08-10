import { haversineKm } from './geo.js';

// USGS and EMSC independently detect and report most of the same events
// within seconds to a couple of minutes of each other. These windows
// decide when two reports are "the same earthquake" so it isn't shown
// twice.
const TIME_WINDOW_MS = 120 * 1000;
const DISTANCE_WINDOW_KM = 100;
const MAGNITUDE_WINDOW = 0.8;
const SOURCE_PRIORITY = ['USGS', 'EMSC', 'UWI-SRC'];

export function mergeEarthquakeSources(sourceArrays) {
  const merged = [];

  for (const event of sourceArrays.flat()) {
    const match = merged.find((existing) => isLikelyDuplicate(existing, event));
    if (!match) {
      merged.push({ ...event, sources: [event.source] });
      continue;
    }

    match.sources = [...new Set([...match.sources, event.source])];
    const keepIncoming =
      SOURCE_PRIORITY.indexOf(event.source) < SOURCE_PRIORITY.indexOf(match.source);
    if (keepIncoming) {
      const sources = match.sources;
      Object.assign(match, event, { sources });
    }
  }

  return merged.sort((a, b) => new Date(b.time) - new Date(a.time));
}

function isLikelyDuplicate(a, b) {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) {
    return false;
  }

  const timeDeltaMs = Math.abs(new Date(a.time) - new Date(b.time));
  if (timeDeltaMs > TIME_WINDOW_MS) return false;

  if (haversineKm(a.lat, a.lon, b.lat, b.lon) > DISTANCE_WINDOW_KM) return false;

  if (a.magnitude != null && b.magnitude != null) {
    if (Math.abs(a.magnitude - b.magnitude) > MAGNITUDE_WINDOW) return false;
  }

  return true;
}
