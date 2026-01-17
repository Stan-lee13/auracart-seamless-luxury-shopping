import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import logger from './logger.mjs';

// Simple test sender for Paystack-style webhook with HMAC-SHA512 signature
// Usage: set PAYSTACK_SECRET and WEBHOOK_URL, then `node server/send_test_webhook.mjs`

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || 'test_secret';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8787/webhook/paystack';

const exampleEvent = {
  event: 'charge.success',
  data: {
    id: 'evt_test_123',
    reference: `test_ref_${Date.now()}`,
    amount: 12345,
    currency: 'NGN',
    status: 'success',
  }
};

const raw = Buffer.from(JSON.stringify(exampleEvent), 'utf8');
const signature = crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex');

async function send() {
  const url = new URL(WEBHOOK_URL);
  const isHttps = url.protocol === 'https:';
  const opts = {
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname + (url.search || ''),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': raw.length,
      'x-paystack-signature': signature,
      'User-Agent': 'aura-test-webhook/1.0'
    }
  };

  const lib = isHttps ? https : http;

  const req = lib.request(opts, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk.toString());
    res.on('end', () => {
      logger.info({ msg: 'Test webhook response', status: res.statusCode, body });
    });
  });

  req.on('error', (err) => {
    logger.error({ msg: 'Request error', err: String(err) });
  });

  req.write(raw);
  req.end();
}

send();
