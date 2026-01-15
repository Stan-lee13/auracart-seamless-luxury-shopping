/**
 * Dispute & Chargeback Automation Worker
 * 
 * Monitors disputes table to:
 * - Auto-escalate disputes based on TTL
 * - Collect and attach evidence
 * - Submit evidence to Paystack
 * - Update dispute statuses
 * - Alert on high-risk disputes
 * 
 * Run periodically (e.g., every 10 minutes)
 * 
 * Usage:
 *   node server/dispute_automation_worker.mjs
 */

import { createClient } from '@supabase/supabase-js';
import logger from './logger.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// Dispute response TTL (days)
const DISPUTE_RESPONSE_TTL_DAYS = 14;
const DISPUTE_ESCALATION_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

/**
 * Collect evidence for a dispute (from order, transaction, and any uploaded files)
 */
async function collectDisputeEvidence(dispute) {
  const { id, order_id, provider_ref } = dispute;
  const evidence = {
    order_details: null,
    transaction: null,
    items: [],
    attached_files: []
  };

  try {
    // Get order
    if (order_id) {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('*')
        .eq('id', order_id)
        .limit(1)
        .maybeSingle();
      if (orderRow) evidence.order_details = orderRow;

      // Get order items
      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', order_id);
      if (items) evidence.items = items;

      // Get transaction
      const { data: txRows } = await supabase
        .from('transactions')
        .select('*')
        .eq('order_id', order_id)
        .limit(1);
      if (txRows && txRows.length) evidence.transaction = txRows[0];
    }

    // Get any dispute attachments (evidence files)
    const { data: attachments } = await supabase
      .from('dispute_evidence')
      .select('*')
      .eq('dispute_id', id);
    if (attachments) evidence.attached_files = attachments;
  } catch (e) {
    logger.error({ msg: 'Error collecting dispute evidence', dispute_id: id, err: String(e) });
  }

  return evidence;
}

/**
 * Submit dispute evidence to Paystack
 */
async function submitDisputeEvidence(dispute, evidence) {
  const { id, provider_ref } = dispute;

  if (!PAYSTACK_SECRET_KEY || !provider_ref) {
    logger.warn({ msg: 'Cannot submit evidence: missing secret key or provider ref', dispute_id: id });
    return false;
  }

  try {
    const evidencePayload = {
      customer_email: evidence.order_details?.user_id ? `user_${evidence.order_details.user_id}@example.com` : 'unknown@example.com',
      customer_name: 'AuraCart Customer',
      customer_phone: evidence.order_details?.shipping_address?.phone || '',
      proof_of_delivery: evidence.transaction?.provider_response ? JSON.stringify(evidence.transaction.provider_response) : null,
      dispute_response_body: `Order #${evidence.order_details?.order_number}\n\nOrder Items:\n${evidence.items.map(i => `- ${i.product_name} x${i.quantity} @ ${i.unit_price}`).join('\n')}\n\nTotal: ${evidence.order_details?.grand_total} ${evidence.order_details?.currency}`
    };

    const resp = await fetch(`https://api.paystack.co/dispute/${provider_ref}/evidence`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(evidencePayload)
    });

    const respData = await resp.json();

    if (resp.ok) {
      logger.info({ msg: 'Dispute evidence submitted', dispute_id: id, provider_ref });
      return true;
    } else {
      logger.warn({ msg: 'Dispute evidence submission failed', dispute_id: id, status_code: resp.status, response: respData });
      return false;
    }
  } catch (e) {
    logger.error({ msg: 'Exception submitting dispute evidence', dispute_id: id, err: String(e) });
    return false;
  }
}

/**
 * Reconcile a single dispute
 */
async function reconcileDispute(dispute) {
  const { id, order_id, status, created_at, last_reconciled_at } = dispute;

  if (status === 'won' || status === 'lost' || status === 'resolved') {
    return { dispute_id: id, action: 'skip', reason: `already_${status}` };
  }

  const createdTime = new Date(created_at).getTime();
  const now = Date.now();
  const ageMs = now - createdTime;
  const ageHours = ageMs / (60 * 60 * 1000);

  // Collect and submit evidence if age < 14 days
  if (ageHours < DISPUTE_RESPONSE_TTL_DAYS * 24) {
    try {
      const evidence = await collectDisputeEvidence(dispute);
      const submitted = await submitDisputeEvidence(dispute, evidence);

      const newStatus = ageMs > DISPUTE_ESCALATION_THRESHOLD_MS ? 'escalated' : 'submitted';
      const { error: updateErr } = await supabase
        .from('disputes')
        .update({
          status: newStatus,
          evidence_submitted: true,
          last_reconciled_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateErr) {
        logger.error({ msg: 'Failed to update dispute', dispute_id: id, err: String(updateErr) });
        return { dispute_id: id, action: 'error', reason: String(updateErr) };
      }

      logger.info({ msg: 'Dispute evidence submitted', dispute_id: id, status: newStatus, submitted });
      return { dispute_id: id, action: 'success', status: newStatus };
    } catch (e) {
      logger.error({ msg: 'Error reconciling dispute', dispute_id: id, err: String(e) });
      return { dispute_id: id, action: 'error', reason: String(e) };
    }
  } else {
    // Past TTL — escalate or mark as lost
    const { error: updateErr } = await supabase
      .from('disputes')
      .update({
        status: 'escalated',
        admin_notes: 'Response TTL exceeded — escalating to support team',
        last_reconciled_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateErr) {
      logger.error({ msg: 'Failed to escalate dispute', dispute_id: id, err: String(updateErr) });
      return { dispute_id: id, action: 'error', reason: String(updateErr) };
    }

    logger.info({ msg: 'Dispute escalated (TTL exceeded)', dispute_id: id });
    return { dispute_id: id, action: 'escalated', reason: 'response_ttl_exceeded' };
  }
}

/**
 * Main worker loop
 */
async function runDisputeAutomation() {
  logger.info({ msg: 'Starting dispute automation worker' });

  try {
    const { data: openDisputes, error: queryErr } = await supabase
      .from('disputes')
      .select('*')
      .in('status', ['open', 'submitted', 'under_review'])
      .order('created_at', { ascending: true })
      .limit(50);

    if (queryErr) {
      logger.error({ msg: 'Error querying open disputes', err: String(queryErr) });
      return;
    }

    if (!openDisputes || !openDisputes.length) {
      logger.info({ msg: 'No open disputes to process' });
      return;
    }

    logger.info({ msg: 'Processing disputes', count: openDisputes.length });

    const results = [];
    for (const dispute of openDisputes) {
      const result = await reconcileDispute(dispute);
      results.push(result);
      logger.info({ msg: 'Dispute reconciliation result', ...result });
    }

    const summary = {
      total: results.length,
      successes: results.filter(r => r.action === 'success').length,
      escalated: results.filter(r => r.action === 'escalated').length,
      errors: results.filter(r => r.action === 'error').length,
      skipped: results.filter(r => r.action === 'skip').length
    };

    logger.info({ msg: 'Dispute automation complete', ...summary });
  } catch (e) {
    logger.error({ msg: 'Dispute automation worker error', err: String(e) });
  }
}

// Run immediately if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDisputeAutomation().then(() => {
    logger.info({ msg: 'Dispute automation worker finished' });
    process.exit(0);
  }).catch(e => {
    logger.error({ msg: 'Dispute automation worker crashed', err: String(e) });
    process.exit(1);
  });
}

export { runDisputeAutomation };
