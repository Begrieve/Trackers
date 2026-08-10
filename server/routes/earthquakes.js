import { Router } from 'express';
import { fetchUsgsEarthquakes } from '../lib/sources/usgs.js';
import { fetchEmscEarthquakes } from '../lib/sources/emsc.js';
import { fetchUwiEarthquakes } from '../lib/sources/uwi.js';
import { mergeEarthquakeSources } from '../lib/merge.js';
import { getCached, setCached } from '../lib/cache.js';

const router = Router();
const CACHE_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS, 10) || 60_000;
const SOURCE_NAMES = ['USGS', 'EMSC', 'UWI-SRC'];

router.get('/earthquakes', async (req, res) => {
  const days = clamp(Number.parseInt(req.query.days, 10) || 7, 1, 90);
  const minMagnitude = clamp(Number.parseFloat(req.query.minMagnitude) ?? 2, 0, 9);

  const cacheKey = `earthquakes:${days}:${minMagnitude}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

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

  const payload = {
    generatedAt: new Date().toISOString(),
    region: 'Caribbean',
    filters: { days, minMagnitude },
    counts: { usgs: usgs.length, emsc: emsc.length, uwi: uwi.length, merged: earthquakes.length },
    sourceErrors,
    earthquakes,
  };

  setCached(cacheKey, payload, CACHE_TTL_MS);
  res.json(payload);
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default router;
