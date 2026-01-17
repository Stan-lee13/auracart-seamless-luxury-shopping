import express from 'express';
import bodyParser from 'body-parser';
import { verifyPaystackSignature } from './paystack-utils.mjs';
import { createClient } from '@supabase/supabase-js';
import apiProxy from './api_proxy.mjs';
import logger from './logger.mjs';

const app = express();
const PORT = process.env.PORT || 8787;

// Need raw body for signature verification
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// Environment checks
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // service role key (keep secret)
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET; // webhook secret

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
}

if (!PAYSTACK_SECRET) {
  logger.warn('PAYSTACK_SECRET not set — webhook signature verification will fail');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

app.post('/webhook/paystack', async (req, res) => {
  try {
    const raw = req.rawBody ? Buffer.from(req.rawBody).toString('utf8') : JSON.stringify(req.body || {});
    const sig = req.headers['x-paystack-signature'];

    const verified = verifyPaystackSignature(raw, PAYSTACK_SECRET, sig);
    if (!verified) {
      logger.warn({ msg: 'Paystack signature verification failed' });
      return res.status(400).send('invalid signature');
    }

    const event = (() => {
      try { return JSON.parse(raw); } catch (e) { return req.body || {}; }
    })();

    // idempotency: check by provider event id
    const providerEventId = event?.id || null;
    if (providerEventId) {
      const { data: existing } = await supabase.from('webhook_events').select('id').eq('event_id', providerEventId).limit(1);
      if (existing && existing.length) {
        logger.info({ msg: 'duplicate webhook event ignored', event_id: providerEventId });
        return res.status(200).send('ok');
      }
    }

    // persist audit record
    const reference = event?.data?.reference || event?.data?.tx_ref || null;
    const headers = JSON.stringify(req.headers || {});
    const { data: audit, error: auditErr } = await supabase.from('webhook_events').insert({
      provider: 'paystack',
      event_id: providerEventId,
      event_type: event?.event || null,
      reference,
      signature: sig || null,
      headers,
      raw_body: raw,
      received_at: new Date().toISOString()
    }).select().maybeSingle();
    if (auditErr) logger.warn({ msg: 'Failed to insert webhook audit', err: String(auditErr) });

    // handle common events
    const evt = event?.event || '';
    const data = event?.data || {};

    if (evt === 'charge.success') {
      logger.info({ msg: 'handling charge.success', event_id: providerEventId });
      const reference = data.reference || data.tx_ref || null;
      if (reference) {
        const { data: txRows } = await supabase.from('transactions').select('*').eq('provider_reference', reference).limit(1);
        if (txRows && txRows.length) {
          const txRow = txRows[0];
          await supabase.from('transactions').update({ status: 'success', provider_response: JSON.stringify(data) }).eq('id', txRow.id);
          await supabase.from('orders').update({ status: 'paid' }).eq('id', txRow.order_id);
        } else {
          // fallback: create order record if none exists
          const orderPayload = {
            order_number: reference,
            grand_total: (Number(data.amount || 0) / 100) || 0,
            subtotal: (Number(data.amount || 0) / 100) || 0,
            total_cost: 0,
            total_profit: 0,
            tax_total: 0,
            shipping_total: 0,
            discount_total: 0,
            currency: data.currency || 'NGN',
            status: 'paid',
            user_id: null,
            shipping_address: {}
          };
          const { data: inserted, error } = await supabase.from('orders').insert(orderPayload).select().maybeSingle();
          if (error) {
            const msg = String(error.message || '');
            if (error.code === '23505' || /duplicate key/i.test(msg)) {
              // idempotent: nothing else to do
            } else {
              logger.error({ msg: 'Failed to insert order from webhook', err: String(error) });
            }
          } else {
            if (audit && inserted) await supabase.from('webhook_events').update({ processed: true, processed_at: new Date().toISOString(), order_id: inserted.id }).eq('id', audit.id);
          }
        }
      }
      return res.status(200).send('ok');
    }

    if (evt === 'charge.failed') {
      logger.info({ msg: 'handling charge.failed', event_id: providerEventId });
      const reference = data.reference || data.tx_ref || null;
      if (reference) {
        const { data: orderRow, error: orderErr } = await supabase.from('orders').select('id').eq('order_number', reference).limit(1).maybeSingle();
        if (orderErr) logger.error({ msg: 'Error querying order for charge.failed', err: String(orderErr) });
        if (orderRow) {
          await supabase.from('orders').update({ status: 'failed' }).eq('id', orderRow.id);
          if (audit && orderRow) await supabase.from('webhook_events').update({ processed: true, processed_at: new Date().toISOString(), order_id: orderRow.id }).eq('id', audit.id);
        }
      }
      return res.status(200).send('ok');
    }

    if (evt && evt.includes('refund')) {
      logger.info({ msg: 'handling refund event', event_id: providerEventId });
      const reference = data.reference || data.tx_ref || null;
      const amount = Number(data.amount || 0) / 100;
      let orderId = null;
      if (reference) {
        const { data: orderRow } = await supabase.from('orders').select('id').eq('order_number', reference).limit(1).maybeSingle();
        orderId = orderRow?.id || null;
      }
      const refundPayload = {
        order_id: orderId,
        provider: 'paystack',
        amount: amount || 0,
        currency: data.currency || 'NGN',
        status: 'created',
        provider_ref: data.id || data.reference || null
      };
      const { data: refundInserted, error: refundErr } = await supabase.from('refunds').insert(refundPayload).select().maybeSingle();
      if (refundErr) logger.error({ msg: 'Failed to insert refund record', err: String(refundErr) });
      if (audit && refundInserted) await supabase.from('webhook_events').update({ processed: true, processed_at: new Date().toISOString(), refund_id: refundInserted.id }).eq('id', audit.id);
      return res.status(200).send('ok');
    }

    if (evt && (evt.includes('dispute') || evt.includes('chargeback'))) {
      logger.info({ msg: 'handling dispute event', event_id: providerEventId });
      const reference = data.reference || data.tx_ref || null;
      let orderId = null;
      if (reference) {
        const { data: orderRow } = await supabase.from('orders').select('id').eq('order_number', reference).limit(1).maybeSingle();
        orderId = orderRow?.id || null;
      }
      const disputePayload = {
        order_id: orderId,
        provider: 'paystack',
        provider_ref: data.id || data.reference || null,
        status: 'open',
        details: data || {}
      };
      const { data: disputeInserted, error: disputeErr } = await supabase.from('disputes').insert(disputePayload).select().maybeSingle();
      if (disputeErr) logger.error({ msg: 'Failed to insert dispute record', err: String(disputeErr) });
      if (audit && disputeInserted) await supabase.from('webhook_events').update({ processed: true, processed_at: new Date().toISOString(), dispute_id: disputeInserted.id }).eq('id', audit.id);
      return res.status(200).send('ok');
    }

    // mark audit as processed for ignored events
    if (audit) await supabase.from('webhook_events').update({ processed: true, processed_at: new Date().toISOString() }).eq('id', audit.id);
    return res.status(200).send('ignored');
  } catch (err) {
    logger.error({ msg: 'Webhook handler error', err: String(err) });
    try {
      const { error: dlqErr } = await supabase.from('webhook_failures').insert({
        provider: 'paystack',
        reference: (req.body && req.body.data && (req.body.data.reference || req.body.data.tx_ref)) || null,
        event_type: (req.body && req.body.event) || null,
        payload: req.body || {},
        headers: req.headers || {},
        error_text: (err && (err.message || String(err))) || 'handler_error',
        attempts: 1,
        last_error_at: new Date().toISOString()
      });
      if (dlqErr) logger.error({ msg: 'Failed to insert into webhook_failures', err: String(dlqErr) });
    } catch (e) {
      logger.error({ msg: 'Error writing to webhook_failures', err: String(e) });
    }
    return res.status(500).send('error');
  }
});

app.get('/', (req, res) => res.send('AuraCart webhook listener'));

// Mount minimal API proxy on same process so local dev can call /api/create-charge
app.use('/api', apiProxy);

app.listen(PORT, () => {
  logger.info({ msg: `Paystack webhook listener running on port ${PORT}` });
});
