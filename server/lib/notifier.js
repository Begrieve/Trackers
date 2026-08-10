import { fetchAggregatedEarthquakes } from './aggregate.js';
import { notifySubscribers, pushConfigured } from './push.js';

// Tracks earthquake IDs we've already evaluated, purely in memory. On the
// very first check after a (re)start we only seed this set — we never fire
// notifications for the backlog of events already in the window, only for
// ones that show up in a later check. This also means a restart can't
// cause old events to be re-notified as "new".
let seenIds = null;
let checking = false;

export async function checkAndNotify() {
  if (!pushConfigured || checking) return { skipped: true };
  checking = true;
  try {
    const { earthquakes } = await fetchAggregatedEarthquakes({ days: 1, minMagnitude: 0 });

    if (seenIds === null) {
      seenIds = new Set(earthquakes.map((eq) => eq.id));
      return { seeded: true, count: earthquakes.length };
    }

    const freshQuakes = earthquakes.filter((eq) => !seenIds.has(eq.id));
    for (const quake of freshQuakes) {
      seenIds.add(quake.id);
      await notifySubscribers(quake);
    }

    // Keep the set from growing forever across a long-lived process.
    if (seenIds.size > 2000) {
      seenIds = new Set(earthquakes.map((eq) => eq.id));
    }

    return { notified: freshQuakes.length };
  } finally {
    checking = false;
  }
}
