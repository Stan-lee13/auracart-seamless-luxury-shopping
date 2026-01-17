import crypto from 'crypto';

/**
 * Verify a Paystack webhook signature.
 * @param {Buffer|string} rawBody - raw request body buffer or string
 * @param {string} secret - webhook secret
 * @param {string} signatureHeader - signature header from provider
 * @returns {boolean}
 */
export function verifyPaystackSignature(rawBody, secret, signatureHeader) {
  if (!signatureHeader || !secret) return false;
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  const hash = crypto.createHmac('sha512', secret).update(buf).digest('hex');
  return hash === signatureHeader;
}

export default verifyPaystackSignature;
