import { Router } from 'express';
import { fetchAggregatedEarthquakes } from '../lib/aggregate.js';
import { getCached, setCached } from '../lib/cache.js';

const router = Router();
const CACHE_TTL_MS = Number.parseInt(process.env.CACHE_TTL_MS, 10) || 60_000;

router.get('/earthquakes', async (req, res) => {
  const days = clamp(Number.parseInt(req.query.days, 10) || 7, 1, 90);
  const minMagnitude = clamp(Number.parseFloat(req.query.minMagnitude) ?? 2, 0, 9);

  const cacheKey = `earthquakes:${days}:${minMagnitude}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const payload = await fetchAggregatedEarthquakes({ days, minMagnitude });
  setCached(cacheKey, payload, CACHE_TTL_MS);
  res.json(payload);
});

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default router;
