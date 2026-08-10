import { Router } from 'express';
import crypto from 'node:crypto';
import { addSubscription, removeSubscription, getVapidPublicKey, pushConfigured } from '../lib/push.js';
import { checkAndNotify } from '../lib/notifier.js';

const router = Router();

router.get('/push/vapid-public-key', (req, res) => {
  if (!pushConfigured) {
    return res.status(503).json({ error: 'Push notifications are not configured on this server.' });
  }
  res.json({ publicKey: getVapidPublicKey() });
});

router.post('/push/subscribe', (req, res) => {
  const { subscription, minMagnitude } = req.body || {};
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription payload.' });
  }
  const magnitude = Number.parseFloat(minMagnitude);
  if (Number.isNaN(magnitude) || magnitude < 0 || magnitude > 9) {
    return res.status(400).json({ error: 'minMagnitude must be a number between 0 and 9.' });
  }
  addSubscription(subscription, magnitude);
  res.status(201).json({ status: 'subscribed' });
});

router.post('/push/unsubscribe', (req, res) => {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: 'endpoint is required.' });
  }
  removeSubscription(endpoint);
  res.json({ status: 'unsubscribed' });
});

// Meant to be hit by an external scheduler (see README) since Render's free
// tier suspends the process — and any in-process setInterval with it —
// after 15 minutes of no HTTP traffic. Protected by a shared secret so
// strangers can't trigger it or infer when checks run.
router.post('/push/check', async (req, res) => {
  if (!requireCronSecret(req, res)) return;
  const result = await checkAndNotify();
  res.json(result);
});

function requireCronSecret(req, res) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    res.status(503).json({ error: 'CRON_SECRET is not configured on this server.' });
    return false;
  }
  const provided = req.get('x-cron-secret') || '';
  const configuredHash = crypto.createHash('sha256').update(configured).digest();
  const providedHash = crypto.createHash('sha256').update(provided).digest();
  if (!crypto.timingSafeEqual(configuredHash, providedHash)) {
    res.status(403).json({ error: 'Invalid cron secret.' });
    return false;
  }
  return true;
}

export default router;
