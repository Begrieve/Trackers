import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import webpush from 'web-push';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'subscriptions.json');

// NOTE ON PERSISTENCE: subscriptions are stored in a local JSON file, which
// works for local development and any host with a persistent disk. On
// Render's free tier the filesystem does not survive a redeploy or a
// spin-down/spin-up cycle, so subscribers will need to re-enable alerts
// after those events. See README for the durable-hosting options.

export const pushConfigured = Boolean(
  process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
);

if (pushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

function loadSubscriptions() {
  try {
    const raw = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSubscriptions(subscriptions) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
}

export function addSubscription(subscription, minMagnitude) {
  const subscriptions = loadSubscriptions().filter((s) => s.endpoint !== subscription.endpoint);
  subscriptions.push({ ...subscription, minMagnitude, createdAt: new Date().toISOString() });
  saveSubscriptions(subscriptions);
}

export function removeSubscription(endpoint) {
  const subscriptions = loadSubscriptions().filter((s) => s.endpoint !== endpoint);
  saveSubscriptions(subscriptions);
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export async function notifySubscribers(quake) {
  if (!pushConfigured) return;
  const subscriptions = loadSubscriptions();
  if (subscriptions.length === 0) return;

  const magText = quake.magnitude != null ? quake.magnitude.toFixed(1) : 'N/A';
  const depthText = quake.depthKm != null ? `${quake.depthKm.toFixed(0)} km deep` : 'depth unknown';
  const payload = JSON.stringify({
    title: `M${magText} earthquake — ${quake.place}`,
    body: `${depthText} · ${new Date(quake.time).toLocaleString()}`,
    url: quake.url || 'https://earthquake.usgs.gov/',
  });

  const stillValid = [];
  for (const sub of subscriptions) {
    if (quake.magnitude == null || quake.magnitude < sub.minMagnitude) {
      stillValid.push(sub);
      continue;
    }
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
      stillValid.push(sub);
    } catch (error) {
      // 404/410 means the browser subscription expired or was revoked —
      // drop it. Any other error, keep the subscription and try again
      // next time (could be a transient network issue).
      if (error.statusCode !== 404 && error.statusCode !== 410) {
        stillValid.push(sub);
      }
    }
  }
  saveSubscriptions(stillValid);
}
