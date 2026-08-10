import { CARIBBEAN_BBOX } from '../region.js';

// EMSC (European-Mediterranean Seismological Centre) FDSNWS event service.
// Public, no auth. Used as a cross-check against USGS since the two
// networks process the same raw seismic data independently.
// https://www.seismicportal.eu/fdsnws/event/1/
const EMSC_ENDPOINT = 'https://www.seismicportal.eu/fdsnws/event/1/query';

export async function fetchEmscEarthquakes({ days, minMagnitude }) {
  const endtime = new Date();
  const starttime = new Date(endtime.getTime() - days * 24 * 60 * 60 * 1000);

  const url = new URL(EMSC_ENDPOINT);
  url.searchParams.set('format', 'json');
  url.searchParams.set('start', starttime.toISOString());
  url.searchParams.set('end', endtime.toISOString());
  url.searchParams.set('minlat', String(CARIBBEAN_BBOX.minLatitude));
  url.searchParams.set('maxlat', String(CARIBBEAN_BBOX.maxLatitude));
  url.searchParams.set('minlon', String(CARIBBEAN_BBOX.minLongitude));
  url.searchParams.set('maxlon', String(CARIBBEAN_BBOX.maxLongitude));
  url.searchParams.set('minmag', String(minMagnitude));
  url.searchParams.set('limit', '500');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`EMSC request failed: ${response.status}`);
  }
  const data = await response.json();
  const features = Array.isArray(data) ? data : (data.features ?? []);

  return features
    .map((feature) => {
      const props = feature.properties ?? feature;
      const coords = feature.geometry?.coordinates;
      const lon = coords ? coords[0] : props.lon;
      const lat = coords ? coords[1] : props.lat;
      const depthKm = coords ? coords[2] : props.depth;

      if (lat == null || lon == null || !props.time) return null;

      const id = props.unid ?? props.source_id ?? feature.id;
      return {
        id: `emsc-${id}`,
        source: 'EMSC',
        time: new Date(props.time).toISOString(),
        magnitude: props.mag ?? null,
        magType: props.magtype ?? null,
        depthKm: depthKm ?? null,
        lat,
        lon,
        place: props.flynn_region ?? 'Unknown location',
        url: props.unid
          ? `https://www.seismicportal.eu/eventid/${props.unid}`
          : null,
        tsunami: false,
        felt: null,
        status: props.evtype ?? 'reviewed',
      };
    })
    .filter(Boolean);
}
