// USGS FDSNWS Event API: public, no auth, CORS-enabled, updated continuously.
// https://earthquake.usgs.gov/fdsnws/event/1/
const USGS_ENDPOINT = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export async function fetchUsgsEarthquakes({ days, minMagnitude }) {
  const endtime = new Date();
  const starttime = new Date(endtime.getTime() - days * 24 * 60 * 60 * 1000);

  const url = new URL(USGS_ENDPOINT);
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', starttime.toISOString());
  url.searchParams.set('endtime', endtime.toISOString());
  url.searchParams.set('minmagnitude', String(minMagnitude));
  url.searchParams.set('orderby', 'time');
  url.searchParams.set('limit', '1000');

  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`USGS request failed: ${response.status}`);
  }
  const data = await response.json();

  return data.features.map((feature) => {
    const [lon, lat, depthKm] = feature.geometry.coordinates;
    return {
      id: `usgs-${feature.id}`,
      source: 'USGS',
      time: new Date(feature.properties.time).toISOString(),
      magnitude: feature.properties.mag,
      magType: feature.properties.magType ?? null,
      depthKm: depthKm ?? null,
      lat,
      lon,
      place: feature.properties.place ?? 'Unknown location',
      url: feature.properties.url ?? null,
      tsunami: Boolean(feature.properties.tsunami),
      felt: feature.properties.felt ?? null,
      status: feature.properties.status ?? 'automatic',
    };
  });
}
