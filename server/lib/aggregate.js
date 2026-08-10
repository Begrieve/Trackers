import { fetchUsgsEarthquakes } from './sources/usgs.js';
import { fetchEmscEarthquakes } from './sources/emsc.js';
import { fetchUwiEarthquakes } from './sources/uwi.js';
import { mergeEarthquakeSources } from './merge.js';

const SOURCE_NAMES = ['USGS', 'EMSC', 'UWI-SRC'];

export async function fetchAggregatedEarthquakes({ days, minMagnitude }) {
  const settled = await Promise.allSettled([
    fetchUsgsEarthquakes({ days, minMagnitude }),
    fetchEmscEarthquakes({ days, minMagnitude }),
    fetchUwiEarthquakes(),
  ]);

  const [usgs, emsc, uwi] = settled.map((r) => (r.status === 'fulfilled' ? r.value : []));
  const sourceErrors = settled
    .map((r, i) => (r.status === 'rejected' ? { source: SOURCE_NAMES[i], error: r.reason.message } : null))
    .filter(Boolean);

  const earthquakes = mergeEarthquakeSources([usgs, emsc, uwi]).filter(
    (eq) => eq.magnitude == null || eq.magnitude >= minMagnitude
  );

  return {
    generatedAt: new Date().toISOString(),
    region: 'Caribbean',
    filters: { days, minMagnitude },
    counts: { usgs: usgs.length, emsc: emsc.length, uwi: uwi.length, merged: earthquakes.length },
    sourceErrors,
    earthquakes,
  };
}
