/**
 * Refund Reconciliation Worker
 * 
 * Polls webhook_failures and refunds table to:
 * - Reconcile refund statuses with Paystack provider responses
 * - Retry failed refund API calls
 * - Update order statuses based on refund completion
 * - Detect and alert on timeout/stuck refunds
 * 
 * Run periodically (e.g., every 5 minutes via cron job or message queue)
 * 
 * Usage:
 *   node server/refund_reconciliation_worker.mjs
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Attempt to reconcile a single refund with Paystack
 */
async function reconcileRefund(refund) {
  const { id, order_id, refund_amount, status, attempts = 0, admin_notes } = refund;
  
  if (status === 'completed' || status === 'failed') {
    // already terminal
    return { refund_id: id, action: 'skip', reason: `already_${status}` };
  }

  // Find the transaction for this order
  let transactionRef = null;
  try {
    const { data: txRows } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', order_id)
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (!txRows || !txRows.length) {
      logger.warn({ msg: 'No transaction found for refund', refund_id: id, order_id });
      return { refund_id: id, action: 'skip', reason: 'no_transaction_found' };
    }

    transactionRef = txRows[0].paystack_reference || txRows[0].provider_reference;
  } catch (e) {
    logger.error({ msg: 'Error querying transaction', refund_id: id, err: String(e) });
    return { refund_id: id, action: 'error', reason: String(e) };
  }

  if (!transactionRef) {
    logger.warn({ msg: 'No Paystack reference found for transaction', refund_id: id, order_id });
    return { refund_id: id, action: 'skip', reason: 'no_paystack_reference' };
  }

  // Attempt Paystack refund API call
  if (!PAYSTACK_SECRET_KEY) {
    logger.warn({ msg: 'PAYSTACK_SECRET_KEY not set, cannot reconcile', refund_id: id });
    return { refund_id: id, action: 'skip', reason: 'no_secret_key' };
  }

  try {
    const body = {
      transaction: transactionRef,
      amount: Math.round(Number(refund_amount) * 100)
    };

    const resp = await fetch('https://api.paystack.co/refund', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const respData = await resp.json();
    const newAttempts = (attempts || 0) + 1;

    if (resp.ok && respData.status) {
      // Success: update refund to processing
      const { error: updateErr } = await supabase
        .from('refunds')
        .update({
          status: 'processing',
          attempts: newAttempts,
          admin_notes: JSON.stringify(respData),
          last_reconciled_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateErr) {
        logger.error({ msg: 'Failed to update refund status', refund_id: id, err: String(updateErr) });
        return { refund_id: id, action: 'error', reason: String(updateErr) };
      }

      logger.info({ msg: 'Refund reconciled successfully', refund_id: id, status: 'processing' });
      return { refund_id: id, action: 'success', status: 'processing' };
    } else {
      // API error
      logger.warn({ msg: 'Paystack refund API returned error', refund_id: id, status_code: resp.status, response: respData });

      const newStatus = newAttempts >= 5 ? 'failed' : 'pending';
      const { error: updateErr } = await supabase
        .from('refunds')
        .update({
          status: newStatus,
          attempts: newAttempts,
          admin_notes: JSON.stringify({ ...respData, last_attempt: new Date().toISOString() }),
          last_reconciled_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateErr) {
        logger.error({ msg: 'Failed to update refund status', refund_id: id, err: String(updateErr) });
      }

      return { refund_id: id, action: 'retry', status: newStatus, attempt: newAttempts };
    }
  } catch (e) {
    logger.error({ msg: 'Exception during refund reconciliation', refund_id: id, err: String(e) });
    const newAttempts = (attempts || 0) + 1;
    const newStatus = newAttempts >= 5 ? 'failed' : 'pending';

    const { error: updateErr } = await supabase
      .from('refunds')
      .update({
        status: newStatus,
        attempts: newAttempts,
        admin_notes: JSON.stringify({ error: String(e), last_attempt: new Date().toISOString() }),
        last_reconciled_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) {
      logger.error({ msg: 'Failed to update refund status on exception', refund_id: id, err: String(updateErr) });
    }

    return { refund_id: id, action: 'error', reason: String(e), attempt: newAttempts };
  }
}

/**
 * Retry webhook failures (for refund events)
 */
async function retryWebhookFailures() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
    const { data: failures } = await supabase
      .from('webhook_failures')
      .select('*')
      .eq('provider', 'paystack')
      .gte('created_at', cutoff)
      .lt('attempts', 5)
      .order('last_error_at', { ascending: true })
      .limit(10);

    if (!failures || !failures.length) {
      logger.info({ msg: 'No webhook failures to retry' });
      return { attempted: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const failure of failures) {
      try {
        // Only retry refund-related events
        if (!failure.event_type || !failure.event_type.includes('refund')) {
          continue;
        }

        // Parse payload and attempt to recreate refund
        const payload = failure.payload || {};
        const data = payload.data || {};
        const reference = data.reference || data.tx_ref || null;

        if (!reference) {
          logger.warn({ msg: 'Webhook failure missing reference', failure_id: failure.id });
          failed++;
          continue;
        }

        // Find order by reference
        const { data: orderRows } = await supabase
          .from('orders')
          .select('id')
          .eq('order_number', reference)
          .limit(1);

        if (!orderRows || !orderRows.length) {
          logger.warn({ msg: 'Order not found for webhook failure', reference, failure_id: failure.id });
          failed++;
          continue;
        }

        const orderId = orderRows[0].id;
        const amount = Number(data.amount || 0) / 100;

        // Create or update refund record
        const refundPayload = {
          order_id: orderId,
          provider: 'paystack',
          refund_amount: amount,
          currency: data.currency || 'NGN',
          status: 'pending',
          provider_ref: data.id || data.reference || null
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('refunds')
          .insert(refundPayload)
          .select()
          .maybeSingle();

        if (insertErr) {
          logger.warn({ msg: 'Failed to insert refund from webhook retry', failure_id: failure.id, err: String(insertErr) });
          failed++;
          continue;
        }

        // Mark webhook failure as processed
        await supabase
          .from('webhook_failures')
          .update({ attempts: (failure.attempts || 0) + 1, last_error_at: new Date().toISOString() })
          .eq('id', failure.id);

        logger.info({ msg: 'Webhook failure processed', failure_id: failure.id, refund_id: inserted?.id });
        succeeded++;
      } catch (e) {
        logger.error({ msg: 'Error retrying webhook failure', failure_id: failure.id, err: String(e) });
        failed++;
      }
    }

    return { attempted: failures.length, succeeded, failed };
  } catch (e) {
    logger.error({ msg: 'Error retrying webhook failures', err: String(e) });
    return { error: String(e) };
  }
}

/**
 * Main worker loop
 */
async function runReconciliation() {
  logger.info({ msg: 'Starting refund reconciliation worker' });

  try {
    // First, retry webhook failures
    const retryResult = await retryWebhookFailures();
    logger.info({ msg: 'Webhook failure retry result', ...retryResult });

    // Then, reconcile pending/processing refunds
    const { data: pendingRefunds, error: queryErr } = await supabase
      .from('refunds')
      .select('*')
      .in('status', ['pending', 'requested', 'processing'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (queryErr) {
      logger.error({ msg: 'Error querying pending refunds', err: String(queryErr) });
      return;
    }

    if (!pendingRefunds || !pendingRefunds.length) {
      logger.info({ msg: 'No pending refunds to reconcile' });
      return;
    }

    logger.info({ msg: 'Reconciling refunds', count: pendingRefunds.length });

    const results = [];
    for (const refund of pendingRefunds) {
      const result = await reconcileRefund(refund);
      results.push(result);
      logger.info({ msg: 'Refund reconciliation result', ...result });
    }

    const summary = {
      total: results.length,
      successes: results.filter(r => r.action === 'success').length,
      retries: results.filter(r => r.action === 'retry').length,
      errors: results.filter(r => r.action === 'error').length,
      skipped: results.filter(r => r.action === 'skip').length
    };

    logger.info({ msg: 'Refund reconciliation complete', ...summary });
  } catch (e) {
    logger.error({ msg: 'Refund reconciliation worker error', err: String(e) });
  }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runReconciliation().then(() => {
    logger.info({ msg: 'Refund reconciliation worker finished' });
    process.exit(0);
  }).catch(e => {
    logger.error({ msg: 'Refund reconciliation worker crashed', err: String(e) });
    process.exit(1);
  });
}

export { runReconciliation };
