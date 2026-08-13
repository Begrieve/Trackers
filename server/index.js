import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import earthquakesRouter from './routes/earthquakes.js';
import pushRouter from './routes/push.js';
import { checkAndNotify } from './lib/notifier.js';
import { pushConfigured } from './lib/push.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const POLL_INTERVAL_MS = 5 * 60 * 1000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', earthquakesRouter);
app.use('/api', pushRouter);
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`World Quake Watch running at http://localhost:${PORT}`);
  if (pushConfigured) {
    // Best-effort in-process fallback. On platforms that suspend the
    // process when idle (e.g. Render's free tier), this stops running
    // while asleep — the /api/push/check endpoint hit by an external
    // scheduler is the reliable path there. See README.
    checkAndNotify();
    setInterval(checkAndNotify, POLL_INTERVAL_MS);
  } else {
    console.log('Push notifications disabled: set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY to enable.');
  }
});
