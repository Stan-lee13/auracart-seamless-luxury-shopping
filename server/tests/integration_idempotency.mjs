import http from 'http';
import https from 'https';
import { URL } from 'url';
import crypto from 'crypto';
import logger from '../logger.mjs';

// Sends the same webhook twice to exercise idempotency handling on the local listener.
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || 'test_secret';
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:8787/webhook/paystack';

const reference = `itest_ref_${Date.now()}`;
const exampleEvent = {
  event: 'charge.success',
  data: {
    id: 'evt_test_integration',
    reference: reference,
    amount: 5000,
    currency: 'NGN',
    status: 'success'
  }
};

function sign(payload) {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8');
  return { raw, sig: crypto.createHmac('sha512', PAYSTACK_SECRET).update(raw).digest('hex') };
}

async function sendOnce(payload) {
  const url = new URL(WEBHOOK_URL);
  const lib = url.protocol === 'https:' ? https : http;
  const { raw, sig } = sign(payload);

  return new Promise((resolve, reject) => {
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': raw.length,
        'x-paystack-signature': sig
      }
    };

    const req = lib.request(opts, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk.toString());
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(raw);
    req.end();
  });
}

(async () => {
  logger.info('Sending first webhook (should insert)...');
  const r1 = await sendOnce(exampleEvent);
  logger.info({ msg: 'First response', status: r1.status, body: r1.body });

  logger.info('Sending second webhook (should be idempotent)...');
  const r2 = await sendOnce(exampleEvent);
  logger.info({ msg: 'Second response', status: r2.status, body: r2.body });
})();
