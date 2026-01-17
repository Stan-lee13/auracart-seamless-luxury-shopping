import assert from 'assert';
import { describe, it } from 'node:test';
import { verifyPaystackSignature } from '../paystack-utils.mjs';
import crypto from 'crypto';

describe('verifyPaystackSignature', () => {
  it('returns true for valid signature', () => {
    const secret = 'test_secret_123';
    const payload = JSON.stringify({ hello: 'world', ts: Date.now() });
    const sig = crypto.createHmac('sha512', secret).update(Buffer.from(payload, 'utf8')).digest('hex');
    const ok = verifyPaystackSignature(payload, secret, sig);
    assert.ok(ok, 'should validate correct signature');
  });

  it('returns false for invalid signature', () => {
    const secret = 'test_secret_123';
    const payload = JSON.stringify({ hello: 'world' });
    const badSig = 'deadbeef';
    const ok = verifyPaystackSignature(payload, secret, badSig);
    assert.strictEqual(ok, false);
  });

  it('returns false when secret missing', () => {
    const payload = JSON.stringify({ a: 1 });
    const sig = crypto.createHmac('sha512', 'other').update(Buffer.from(payload, 'utf8')).digest('hex');
    const ok = verifyPaystackSignature(payload, '', sig);
    assert.strictEqual(ok, false);
  });
});
