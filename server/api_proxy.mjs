import express from 'express';
import bodyParser from 'body-parser';
import { createCharge } from './create_paystack_charge.mjs';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

const app = express();
app.use(bodyParser.json());

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

// Simple API proxy to create a charge (server-side to hide secret)
app.post('/api/create-charge', async (req, res) => {
  try {
    const { amount, email, line_items, shipping, tax, discount } = req.body || {};
    const reference = `aura_${Date.now()}`;
    const init = await createCharge({ line_items, amount, shipping, tax, discount, email, reference });
    return res.status(200).json(init);
  } catch (e) {
    logger.error({ msg: 'create-charge error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Admin endpoints (server-side, protected by requireAdmin middleware)
// Redis-backed rate limiter using rate-limiter-flexible
const REDIS_URL = process.env.REDIS_URL || process.env.REDIS_URI || null;
let redisClient = null;
let rateLimiter = null;
const RATE_LIMIT_POINTS = 60; // per minute
const RATE_LIMIT_DURATION = 60; // seconds

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL);
    rateLimiter = new RateLimiterRedis({
      storeClient: redisClient,
      points: RATE_LIMIT_POINTS,
      duration: RATE_LIMIT_DURATION,
      keyPrefix: 'rl_admin'
    });
    logger.info({ msg: 'Redis rate limiter initialized' });
  } catch (e) {
    logger.warn({ msg: 'Failed to initialize Redis rate limiter', err: String(e) });
    redisClient = null;
    rateLimiter = null;
  }
} else {
  logger.warn('REDIS_URL not set — falling back to in-process rate limiting (single-process only)');
}

// If Redis is required in this environment, perform a startup health-check and fail-fast
if (REDIS_URL && process.env.REDIS_REQUIRED === 'true') {
  (async () => {
    try {
      const pong = await redisClient.ping();
      logger.info({ msg: 'Redis health-check', pong });
    } catch (e) {
      logger.error({ msg: 'Redis health-check failed, exiting', err: String(e) });
      process.exit(1);
    }
  })();
}

async function rateLimitAdmin(req, res, next) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const authHeader = req.headers.authorization || req.headers.Authorization || '';
    const tokenParts = String(authHeader).split(' ');
    const token = tokenParts.length === 2 ? tokenParts[1] : (tokenParts[0] || null);
    const key = token ? `t:${token.slice(0,12)}` : `i:${ip}`;

    if (rateLimiter) {
      try {
        const rlRes = await rateLimiter.consume(key, 1);
        res.setHeader('X-RateLimit-Limit', RATE_LIMIT_POINTS);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, rlRes.remainingPoints));
        res.setHeader('X-RateLimit-Reset', Math.ceil((Date.now() / 1000) + rlRes.msBeforeNext / 1000));
        return next();
      } catch (rejRes) {
        const retrySecs = Math.ceil(rejRes.msBeforeNext / 1000) || RATE_LIMIT_DURATION;
        res.setHeader('Retry-After', String(retrySecs));
        return res.status(429).json({ error: 'rate_limited', detail: `Rate limit exceeded`, retry_after_seconds: retrySecs });
      }
    }

    // fallback naive per-process limiter
    // reuse previous in-memory approach with reduced scope
    const now = Date.now();
    if (!global.__adminRate) global.__adminRate = new Map();
    const adminRateMap = global.__adminRate;
    const WINDOW_MS = RATE_LIMIT_DURATION * 1000;
    const entry = adminRateMap.get(key) || { count: 0, resetAt: now + WINDOW_MS };
    if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + WINDOW_MS; }
    entry.count += 1;
    adminRateMap.set(key, entry);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_POINTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_POINTS - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));
    if (entry.count > RATE_LIMIT_POINTS) return res.status(429).json({ error: 'rate_limited' });
    return next();
  } catch (e) {
    logger.error({ msg: 'rateLimitAdmin error', err: String(e) });
    return next();
  }
}

function adminLogger(req, res, next) {
  const start = Date.now();
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  const tokenSnippet = authHeader ? String(authHeader).slice(0, 64) : '';
  logger.info({ ts: new Date().toISOString(), event: 'admin_req_start', method: req.method, path: req.originalUrl || req.url, ip, token: tokenSnippet });
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ ts: new Date().toISOString(), event: 'admin_req_end', method: req.method, path: req.originalUrl || req.url, status: res.statusCode, duration_ms: duration });
  });
  next();
}
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: 'missing_authorization' });
    const parts = String(authHeader).split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid_token' });

    const userId = userData.user.id;
    const { data: roleRow, error: roleErr } = await supabase.from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (roleErr) return res.status(500).json({ error: 'role_check_failed' });
    if (!roleRow) return res.status(403).json({ error: 'forbidden' });

    // attach user id for downstream handlers
    req.user = userData.user;
    return next();
  } catch (e) {
    logger.error({ msg: 'requireAdmin error', err: String(e) });
    return res.status(500).json({ error: 'auth_error' });
  }
}

// apply logging + rate limit + auth middleware to admin namespace
app.use('/api/admin', adminLogger, rateLimitAdmin, requireAdmin);

app.get('/api/admin/refunds', async (req, res) => {
  try {
    const { data, error } = await supabase.from('refunds').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    logger.error({ msg: 'admin refunds error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    logger.error({ msg: 'admin orders error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Public endpoint for users to fetch their orders (requires Authorization bearer token)
app.get('/api/orders', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader) return res.status(401).json({ error: 'missing_authorization' });
    const parts = String(authHeader).split(' ');
    const token = parts.length === 2 ? parts[1] : parts[0];
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return res.status(401).json({ error: 'invalid_token' });
    const userId = userData.user.id;
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    logger.error({ msg: 'user orders error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Confirm payment / lookup by reference. Returns order, items, and transactions.
app.get('/api/confirm', async (req, res) => {
  try {
    const reference = String(req.query.reference || req.query.ref || req.query.tx_ref || '');
    if (!reference) return res.status(400).json({ error: 'missing_reference' });

    // find transaction by provider reference or order by order_number
    const { data: txRows } = await supabase.from('transactions').select('*').or(`provider_reference.eq.${reference},paystack_reference.eq.${reference}`).limit(1);
    let order = null;
    let items = [];
    let tx = null;
    if (txRows && txRows.length) {
      tx = txRows[0];
      const { data: orderRow } = await supabase.from('orders').select('*').eq('id', tx.order_id).limit(1).maybeSingle();
      order = orderRow || null;
    } else {
      const { data: orderRow } = await supabase.from('orders').select('*').eq('order_number', reference).limit(1).maybeSingle();
      order = orderRow || null;
      if (order && order.id) {
        const { data: tx2 } = await supabase.from('transactions').select('*').eq('order_id', order.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        tx = tx2 || null;
      }
    }

    if (order && order.id) {
      const { data: orderItems } = await supabase.from('order_items').select('*').eq('order_id', order.id);
      items = orderItems || [];
    }

    return res.json({ order, items, transaction: tx });
  } catch (e) {
    logger.error({ msg: 'confirm endpoint error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

app.get('/api/admin/disputes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('disputes').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ data });
  } catch (e) {
    logger.error({ msg: 'admin disputes error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Issue a refund (server-side): creates refund record and attempts to call Paystack refund API if configured
app.post('/api/admin/refunds/issue', async (req, res) => {
  try {
    const { order_id, refund_amount, reason } = req.body || {};
    if (!order_id || !refund_amount) return res.status(400).json({ error: 'order_id and refund_amount required' });

    // Create refund record in DB
    const refundPayload = {
      order_id,
      transaction_id: null,
      user_id: null,
      is_full_refund: false,
      refund_amount: refund_amount,
      supplier_refund_amount: 0,
      platform_loss: 0,
      status: 'requested',
      reason: reason || null
    };

    const { data: refundInserted, error: refundErr } = await supabase.from('refunds').insert(refundPayload).select().maybeSingle();
    if (refundErr) return res.status(500).json({ error: refundErr.message });

    // Attempt to call Paystack refund API if secret key present and transaction reference exists
    if (PAYSTACK_SECRET_KEY) {
      try {
        // Find the latest transaction for this order
        const { data: txData } = await supabase.from('transactions').select('*').eq('order_id', order_id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const paystackRef = txData?.paystack_reference;
        if (paystackRef) {
          const body = { transaction: paystackRef, amount: Math.round(Number(refund_amount) * 100) };
          const resp = await fetch('https://api.paystack.co/refund', {
            method: 'POST',
            headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          });
          const j = await resp.json();
          // Update refund record with provider response
          await supabase.from('refunds').update({ status: j.status ? 'processing' : 'failed', admin_notes: JSON.stringify(j) }).eq('id', refundInserted.id);
          return res.json({ data: refundInserted, provider: j });
        }
      } catch (e) {
        logger.error({ msg: 'Paystack refund call failed', err: String(e) });
        await supabase.from('refunds').update({ status: 'failed', admin_notes: String(e) }).eq('id', refundInserted.id);
        return res.status(500).json({ error: 'refund_failed', detail: String(e) });
      }
    }

    return res.json({ data: refundInserted });
  } catch (e) {
    logger.error({ msg: 'issue refund error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Attach evidence to a dispute
app.post('/api/admin/disputes/:dispute_id/evidence', async (req, res) => {
  try {
    const disputeId = String(req.params.dispute_id || '');
    const { description, file_url, evidence_type } = req.body || {};
    if (!disputeId || !description) return res.status(400).json({ error: 'dispute_id and description required' });

    const evidencePayload = {
      dispute_id: disputeId,
      evidence_type: evidence_type || 'document',
      description,
      file_url: file_url || null,
      uploaded_at: new Date().toISOString(),
      admin_id: req.user?.id || null
    };

    const { data: evidence, error: evidenceErr } = await supabase
      .from('dispute_evidence')
      .insert(evidencePayload)
      .select()
      .maybeSingle();
    if (evidenceErr) return res.status(500).json({ error: evidenceErr.message });

    // Mark dispute as evidence-submitted
    await supabase.from('disputes').update({ evidence_submitted: true }).eq('id', disputeId);
    return res.json({ data: evidence });
  } catch (e) {
    logger.error({ msg: 'admin attach evidence error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Get dispute details with evidence
app.get('/api/admin/disputes/:dispute_id', async (req, res) => {
  try {
    const disputeId = String(req.params.dispute_id || '');
    const { data: dispute, error: disputeErr } = await supabase
      .from('disputes')
      .select('*')
      .eq('id', disputeId)
      .limit(1)
      .maybeSingle();
    if (disputeErr || !dispute) return res.status(404).json({ error: 'not_found' });

    const { data: evidence } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', disputeId);

    return res.json({ dispute, evidence: evidence || [] });
  } catch (e) {
    logger.error({ msg: 'admin get dispute error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Update dispute status (e.g., escalate, resolve)
app.patch('/api/admin/disputes/:dispute_id', async (req, res) => {
  try {
    const disputeId = String(req.params.dispute_id || '');
    const { status, admin_notes } = req.body || {};
    if (!disputeId) return res.status(400).json({ error: 'dispute_id required' });

    const updatePayload = {
      status: status || null,
      admin_notes: admin_notes || null,
      last_reconciled_at: new Date().toISOString()
    };
    Object.keys(updatePayload).forEach(k => updatePayload[k] === null && delete updatePayload[k]);

    const { data: updated, error: updateErr } = await supabase
      .from('disputes')
      .update(updatePayload)
      .eq('id', disputeId)
      .select()
      .maybeSingle();
    if (updateErr) return res.status(500).json({ error: updateErr.message });

    return res.json({ data: updated });
  } catch (e) {
    logger.error({ msg: 'admin update dispute error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Get supplier metrics and performance
app.get('/api/admin/suppliers', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('supplier_metrics')
      .select('*')
      .order('sla_score', { ascending: false })
      .order('calculated_at', { ascending: false })
      .limit(500);
    if (error) return res.status(500).json({ error: error.message });
    
    // Group by supplier name, keeping only latest metrics per supplier
    const latest = {};
    (data || []).forEach(metric => {
      const key = metric.supplier_name;
      if (!latest[key] || new Date(metric.calculated_at) > new Date(latest[key].calculated_at)) {
        latest[key] = metric;
      }
    });

    return res.json({ data: Object.values(latest) });
  } catch (e) {
    logger.error({ msg: 'admin suppliers error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

// Get supplier details
app.get('/api/admin/suppliers/:supplier_name', async (req, res) => {
  try {
    const supplierName = decodeURIComponent(String(req.params.supplier_name || ''));
    
    // Get latest metrics
    const { data: metrics } = await supabase
      .from('supplier_metrics')
      .select('*')
      .eq('supplier_name', supplierName)
      .order('calculated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get recent supplier orders
    const { data: orders } = await supabase
      .from('supplier_orders')
      .select('*')
      .eq('supplier_name', supplierName)
      .order('created_at', { ascending: false })
      .limit(50);

    return res.json({ metrics, orders: orders || [] });
  } catch (e) {
    logger.error({ msg: 'admin supplier detail error', err: String(e) });
    return res.status(500).json({ error: 'failed' });
  }
});

export default app;
